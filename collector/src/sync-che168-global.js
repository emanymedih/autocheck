import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Che168GlobalListingProvider,
  globalCatalogPageUrl,
  parseChe168GlobalCatalogHtml
} from "./providers/che168-global-provider.js";
import { normalizeListing, toPublicVehicle } from "./normalizer.js";
import { JsonCatalogStore } from "./store/json-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVIDER_ID = "che168-global-pilot";
const DEFAULT_SEED_STORE = path.resolve(__dirname, "../data/global-catalog.json");
const DEFAULT_STORE = path.resolve(__dirname, "../.state/global-catalog.json");
const DEFAULT_CURSOR = path.resolve(__dirname, "../.state/global-sync-cursor.json");
const DEFAULT_PUBLIC = path.resolve(__dirname, "../data/global-public-catalog.json");

function argsFrom(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

function positiveInteger(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return structuredClone(fallback);
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureStateStore(storePath) {
  try {
    await fs.access(storePath);
    return;
  } catch (_) {
    // First run: seed workflow state from the existing MVP store if it exists.
  }

  try {
    const seed = await fs.readFile(DEFAULT_SEED_STORE, "utf8");
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, seed, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function fetchCatalogHtml(fetchImpl, url, timeoutMs) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "AvtocheckCatalogSync/1.0 (+public vehicle inventory)"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    const error = new Error(`Global catalog returned HTTP ${response.status} for ${url}`);
    error.status = response.status;
    throw error;
  }
  return { html: await response.text(), url: response.url || url };
}

async function discoverRange({ fetchImpl, startPage, maxPages, locale, timeoutMs }) {
  const entries = new Map();
  const errors = [];
  let advertisedCount = null;
  let pagesVisited = 0;
  let lastPage = startPage - 1;
  let stoppedOnEmptyPage = false;

  for (let offset = 0; offset < maxPages; offset += 1) {
    const page = startPage + offset;
    const requestedUrl = globalCatalogPageUrl(page, locale);
    try {
      const { html, url } = await fetchCatalogHtml(fetchImpl, requestedUrl, timeoutMs);
      pagesVisited += 1;
      lastPage = page;
      const parsed = parseChe168GlobalCatalogHtml(html, { pageUrl: url, locale });
      if (parsed.advertisedCount !== null) advertisedCount = parsed.advertisedCount;

      let added = 0;
      for (const entry of parsed.entries) {
        if (entries.has(entry.listingId)) continue;
        entries.set(entry.listingId, { ...entry, page });
        added += 1;
      }

      if (parsed.entries.length === 0 || added === 0) {
        stoppedOnEmptyPage = true;
        break;
      }
    } catch (error) {
      errors.push({
        scope: "catalog_page",
        page,
        url: requestedUrl,
        status: Number(error.status) || null,
        message: error.message
      });
      break;
    }
  }

  return {
    entries: [...entries.values()],
    advertisedCount,
    pagesVisited,
    lastPage,
    stoppedOnEmptyPage,
    errors
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(positiveInteger(concurrency, 1), items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function httpStatusFromError(error) {
  const explicit = Number(error?.status);
  if (Number.isFinite(explicit) && explicit >= 100) return explicit;
  const match = String(error?.message || "").match(/HTTP\s+(\d{3})/i);
  return match ? Number(match[1]) : null;
}

async function readDetailQueue(entries, { fetchImpl, timeoutMs, concurrency }) {
  const errors = [];
  const results = await mapWithConcurrency(entries, concurrency, async (entry) => {
    try {
      const provider = new Che168GlobalListingProvider({
        url: entry.url,
        fallbackTitle: entry.title || null,
        fetchImpl,
        timeoutMs
      });
      const [row] = await provider.read();
      return { entry, row: row || null };
    } catch (error) {
      errors.push({
        scope: entry.scope || "listing",
        listingId: entry.listingId,
        url: entry.url,
        status: httpStatusFromError(error),
        message: error.message
      });
      return { entry, row: null };
    }
  });

  return {
    rows: results.filter((item) => item.row).map((item) => item.row),
    errors
  };
}

function chooseStaleRechecks(storeData, discoveredIds, limit) {
  return storeData.vehicles
    .filter((vehicle) => vehicle.source?.providerId === PROVIDER_ID)
    .filter((vehicle) => vehicle.status !== "inactive")
    .filter((vehicle) => !discoveredIds.has(String(vehicle.source?.listingId || "")))
    .filter((vehicle) => vehicle.source?.url)
    .sort((a, b) => String(a.source?.checkedAt || a.lastSeenAt || "").localeCompare(String(b.source?.checkedAt || b.lastSeenAt || "")))
    .slice(0, limit)
    .map((vehicle) => ({
      listingId: String(vehicle.source.listingId),
      url: vehicle.source.url,
      title: vehicle.title,
      scope: "stale_recheck"
    }));
}

function dedupeNormalizedListings(vehicles) {
  const byKey = new Map();
  let duplicates = 0;

  for (const vehicle of vehicles) {
    const strongKey = vehicle.vin
      ? `vin:${vehicle.vin}`
      : `source:${vehicle.source?.providerId}:${vehicle.source?.listingId}`;
    const previous = byKey.get(strongKey);
    if (!previous) {
      byKey.set(strongKey, vehicle);
      continue;
    }

    duplicates += 1;
    const previousScore = (previous.photos?.length || 0) + (previous.extraSpecs?.length || 0) + (previous.price ? 2 : 0);
    const nextScore = (vehicle.photos?.length || 0) + (vehicle.extraSpecs?.length || 0) + (vehicle.price ? 2 : 0);
    if (nextScore >= previousScore) byKey.set(strongKey, vehicle);
  }

  return { vehicles: [...byKey.values()], duplicates };
}

async function writePublicSnapshot(store, filePath) {
  const data = await store.read();
  const normalized = data.vehicles.filter((vehicle) => vehicle.source?.providerId === PROVIDER_ID);
  const { vehicles, duplicates } = dedupeNormalizedListings(normalized);
  const items = vehicles.map(toPublicVehicle);
  await writeJson(filePath, { updatedAt: data.updatedAt, items });
  return { items: items.length, duplicates };
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  const runStartedAt = new Date().toISOString();
  const storePath = path.resolve(args.store || DEFAULT_STORE);
  const cursorPath = path.resolve(args.cursor || DEFAULT_CURSOR);
  const publicPath = path.resolve(args.public || DEFAULT_PUBLIC);
  const resultPath = args.result ? path.resolve(args.result) : null;
  const locale = args.locale === "ru" ? "ru" : "en";
  const maxPages = positiveInteger(args.pages, 8);
  const targetListings = positiveInteger(args.limit, 5000);
  const concurrency = positiveInteger(args.concurrency, 4);
  const recheckLimit = positiveInteger(args.recheck, 24);
  const missingThreshold = positiveInteger(args["missing-threshold"], 2);
  const timeoutMs = positiveInteger(args.timeout, 15000);

  await ensureStateStore(storePath);
  const cursor = await readJson(cursorPath, { nextPage: 1 });
  const startPage = positiveInteger(args["start-page"], positiveInteger(cursor.nextPage, 1));
  const store = new JsonCatalogStore(storePath);
  const before = await store.read();

  const discovery = await discoverRange({
    fetchImpl: globalThis.fetch,
    startPage,
    maxPages,
    locale,
    timeoutMs
  });
  if (!discovery.entries.length) {
    throw new Error(`No global catalog listings discovered from page ${startPage}`);
  }

  const truncated = discovery.entries.length > targetListings;
  const discoveredEntries = discovery.entries.slice(0, targetListings).map((entry) => ({ ...entry, scope: "listing" }));
  const discoveredIds = new Set(discoveredEntries.map((entry) => entry.listingId));
  const staleEntries = chooseStaleRechecks(before, discoveredIds, recheckLimit);

  const queueByListingId = new Map();
  for (const entry of [...discoveredEntries, ...staleEntries]) {
    if (!queueByListingId.has(entry.listingId)) queueByListingId.set(entry.listingId, entry);
  }
  const queue = [...queueByListingId.values()];

  const detail = await readDetailQueue(queue, {
    fetchImpl: globalThis.fetch,
    timeoutMs,
    concurrency
  });
  if (!detail.rows.length) throw new Error("No global listings survived detail loading");

  const normalizationErrors = [];
  const normalized = [];
  for (const raw of detail.rows) {
    try {
      normalized.push(normalizeListing(raw, { providerId: PROVIDER_ID }));
    } catch (error) {
      normalizationErrors.push({
        listingId: raw?.source_listing_id || null,
        message: error.message
      });
    }
  }
  if (!normalized.length) throw new Error("No global listings survived normalization");

  const deduped = dedupeNormalizedListings(normalized);
  const storeSummary = await store.upsertMany(deduped.vehicles, {
    providerId: PROVIDER_ID,
    snapshot: false
  });

  const goneIds = detail.errors
    .filter((error) => error.scope === "stale_recheck" && (error.status === 404 || error.status === 410))
    .map((error) => error.listingId);
  const missingSummary = await store.markMissing(goneIds, {
    providerId: PROVIDER_ID,
    deactivateAfterMisses: missingThreshold
  });

  const publicSummary = await writePublicSnapshot(store, publicPath);
  const nextPage = discovery.stoppedOnEmptyPage
    ? 1
    : truncated
      ? startPage
      : Math.max(startPage + 1, discovery.lastPage + 1);

  await writeJson(cursorPath, {
    providerId: PROVIDER_ID,
    updatedAt: new Date().toISOString(),
    previousPage: startPage,
    lastVisitedPage: discovery.lastPage,
    nextPage,
    stoppedOnEmptyPage: discovery.stoppedOnEmptyPage,
    truncated
  });

  const result = {
    success: true,
    mode: "che168-global-sync",
    providerId: PROVIDER_ID,
    startedAt: runStartedAt,
    finishedAt: new Date().toISOString(),
    locale,
    startPage,
    nextPage,
    targetListings,
    maxPages,
    concurrency,
    recheckLimit,
    missingThreshold,
    advertisedInventoryCount: discovery.advertisedCount,
    pagesVisited: discovery.pagesVisited,
    discoveredListings: discoveredEntries.length,
    queuedListings: queue.length,
    recheckedListings: staleEntries.length,
    importedListings: deduped.vehicles.length,
    failedListings: detail.errors.length,
    duplicateListings: deduped.duplicates,
    goneRechecks: goneIds.length,
    normalizationErrors,
    snapshotApplied: false,
    completeSnapshot: false,
    publicItems: publicSummary.items,
    publicDuplicatesRemoved: publicSummary.duplicates,
    errors: [...discovery.errors, ...detail.errors],
    state: {
      inserted: storeSummary.inserted,
      updated: storeSummary.updated,
      total: storeSummary.total,
      missingMarked: missingSummary.marked,
      deactivated: missingSummary.deactivated
    }
  };

  if (resultPath) await writeJson(resultPath, result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  const args = argsFrom(process.argv.slice(2));
  const failure = {
    success: false,
    mode: "che168-global-sync",
    providerId: PROVIDER_ID,
    finishedAt: new Date().toISOString(),
    error: error.message
  };
  if (args.result) {
    try { await writeJson(path.resolve(args.result), failure); } catch (_) { /* keep original error */ }
  }
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
