import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SeekAutoCatalogProvider,
  seekAutoDetailUrl
} from "./providers/seekauto-provider.js";
import { normalizeListing, toPublicVehicle } from "./normalizer.js";
import { JsonCatalogStore } from "./store/json-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");
const PROVIDER_ID = "seekauto-public";
const PUBLIC_PLATFORM = "SeekAuto";
const DEFAULT_STORE = path.resolve(__dirname, "../.state/seekauto-catalog.json");
const DEFAULT_PUBLIC = path.resolve(__dirname, "../data/global-public-catalog.json");
const THUMBNAIL_DIR = path.resolve(ROOT_DIR, "assets/catalog-thumbs");
const THUMBNAIL_PUBLIC_PREFIX = "assets/catalog-thumbs";
const DEFAULT_BOOTSTRAP_IDS = [
  "SC45956390F3F",
  "SC46097597YKB",
  "SC043375C6Y08"
];

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

function bootstrapEntries(value, locale) {
  const ids = String(value || DEFAULT_BOOTSTRAP_IDS.join(","))
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^SC[A-Z0-9]+$/.test(item));
  return [...new Set(ids)].map((listingId) => ({
    listingId,
    url: seekAutoDetailUrl(listingId, locale),
    title: null,
    scope: "bootstrap"
  }));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

function imageExtension(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    const match = pathname.match(/\.(jpe?g|png|webp)$/);
    if (!match) return "jpg";
    return match[1] === "jpeg" ? "jpg" : match[1];
  } catch (_) {
    return "jpg";
  }
}

async function cacheSeekAutoThumbnail(vehicle, timeoutMs = 15000) {
  if (vehicle?.listingPlatform !== PUBLIC_PLATFORM) return vehicle;
  const photos = Array.isArray(vehicle?.photos) ? vehicle.photos.filter(Boolean) : [];
  const source = photos.find((value) => /^https:\/\/img\.jytche\.com\//i.test(String(value)));
  if (!source) return vehicle;

  const extension = imageExtension(source);
  const relativePath = `${THUMBNAIL_PUBLIC_PREFIX}/${vehicle.id}.${extension}`;
  const absolutePath = path.resolve(ROOT_DIR, relativePath);

  if (!(await fileExists(absolutePath))) {
    try {
      const response = await fetch(source, {
        method: "GET",
        redirect: "follow",
        headers: {
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          referer: "https://www.seekauto.com/",
          "user-agent": "Mozilla/5.0 (compatible; AvtocheckCatalogSync/1.0)"
        },
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) return vehicle;
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (contentType && !contentType.startsWith("image/")) return vehicle;
      const body = Buffer.from(await response.arrayBuffer());
      if (!body.length || body.length > 8 * 1024 * 1024) return vehicle;
      await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
      await fs.writeFile(absolutePath, body);
    } catch (_) {
      return vehicle;
    }
  }

  return {
    ...vehicle,
    photos: [relativePath, ...photos.filter((value) => value !== relativePath)]
  };
}

async function cacheSeekAutoThumbnails(vehicles, { concurrency = 2, timeoutMs = 15000 } = {}) {
  const results = new Array(vehicles.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= vehicles.length) return;
      results[index] = await cacheSeekAutoThumbnail(vehicles[index], timeoutMs);
    }
  }
  const count = Math.max(1, Math.min(Number(concurrency) || 1, vehicles.length || 1));
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}

function chooseStaleRechecks(storeData, discoveredIds, limit) {
  return storeData.vehicles
    .filter((vehicle) => vehicle.source?.providerId === PROVIDER_ID)
    .filter((vehicle) => vehicle.status !== "inactive")
    .filter((vehicle) => !discoveredIds.has(String(vehicle.source?.listingId || "")))
    .filter((vehicle) => vehicle.source?.url)
    .sort((a, b) => {
      const missingDelta = Number(b.sync?.missingRuns || 0) - Number(a.sync?.missingRuns || 0);
      if (missingDelta) return missingDelta;
      return String(a.source?.checkedAt || a.lastSeenAt || "").localeCompare(String(b.source?.checkedAt || b.lastSeenAt || ""));
    })
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
    const key = vehicle.vin
      ? `vin:${vehicle.vin}`
      : `source:${vehicle.source?.providerId}:${vehicle.source?.listingId}`;
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, vehicle);
      continue;
    }

    duplicates += 1;
    const previousScore = (previous.photos?.length || 0) + (previous.extraSpecs?.length || 0) + (previous.price ? 2 : 0);
    const nextScore = (vehicle.photos?.length || 0) + (vehicle.extraSpecs?.length || 0) + (vehicle.price ? 2 : 0);
    if (nextScore >= previousScore) byKey.set(key, vehicle);
  }

  return { vehicles: [...byKey.values()], duplicates };
}

function publicVehicleKey(vehicle) {
  const vin = String(vehicle?.vin || "").trim().toUpperCase();
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return `vin:${vin}`;
  return `id:${String(vehicle?.id || "")}`;
}

function isPublishableSeekAuto(vehicle) {
  const title = String(vehicle?.title || "").trim();
  if (!title || /^(?:seekauto|used cars?|car detail)$/i.test(title)) return false;
  if (!vehicle?.id) return false;
  if (!vehicle?.year && !vehicle?.registration) return false;
  if (vehicle?.mileage === null || vehicle?.mileage === undefined) return false;
  if (!Array.isArray(vehicle?.photos) || vehicle.photos.length === 0) return false;
  const meaningful = [vehicle.brand, vehicle.model, vehicle.body, vehicle.energyType, vehicle.engine, vehicle.transmission]
    .filter((value) => String(value || "").trim()).length;
  return meaningful >= 2;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return structuredClone(fallback);
    throw error;
  }
}

async function writePublicSnapshot(store, filePath) {
  const data = await store.read();
  const normalized = data.vehicles.filter((vehicle) => vehicle.source?.providerId === PROVIDER_ID);
  const managedAll = dedupeNormalizedListings(normalized).vehicles.map(toPublicVehicle);
  const managed = managedAll.filter(isPublishableSeekAuto);
  const rejected = managedAll.length - managed.length;
  if (!managed.length) throw new Error("SeekAuto quality gate rejected every managed listing");

  const managedWithThumbnails = await cacheSeekAutoThumbnails(managed, { concurrency: 2, timeoutMs: 15000 });
  const cachedThumbnails = managedWithThumbnails.filter((vehicle) => String(vehicle?.photos?.[0] || "").startsWith(`${THUMBNAIL_PUBLIC_PREFIX}/`)).length;

  const existing = await readJson(filePath, { updatedAt: null, items: [] });
  const existingWithoutSeekAuto = (Array.isArray(existing.items) ? existing.items : [])
    .filter((vehicle) => vehicle?.listingPlatform !== PUBLIC_PLATFORM);
  const byKey = new Map();
  let duplicates = 0;

  for (const vehicle of [...existingWithoutSeekAuto, ...managedWithThumbnails]) {
    if (!vehicle?.id) continue;
    const key = publicVehicleKey(vehicle);
    if (byKey.has(key)) duplicates += 1;
    byKey.set(key, vehicle);
  }

  const items = [...byKey.values()];
  await writeJson(filePath, { updatedAt: data.updatedAt || new Date().toISOString(), items });
  return { items: items.length, managed: managedWithThumbnails.length, rejected, duplicates, cachedThumbnails };
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  const runStartedAt = new Date().toISOString();
  const storePath = path.resolve(args.store || DEFAULT_STORE);
  const publicPath = path.resolve(args.public || DEFAULT_PUBLIC);
  const resultPath = args.result ? path.resolve(args.result) : null;
  const locale = args.locale || "en";
  const targetListings = positiveInteger(args.limit, 60);
  const concurrency = positiveInteger(args.concurrency, 4);
  const recheckLimit = positiveInteger(args.recheck, 20);
  const missingThreshold = positiveInteger(args["missing-threshold"], 2);
  const timeoutMs = positiveInteger(args.timeout, 15000);

  const provider = new SeekAutoCatalogProvider({
    locale,
    maxListings: targetListings,
    detailConcurrency: concurrency,
    timeoutMs
  });

  const store = new JsonCatalogStore(storePath);
  const before = await store.read();
  const discovery = await provider.discover();
  const bootstrapUsed = discovery.entries.length === 0;
  const discoveredEntries = (bootstrapUsed ? bootstrapEntries(args["bootstrap-ids"], locale) : discovery.entries)
    .slice(0, targetListings)
    .map((entry) => ({ ...entry, scope: entry.scope || "listing" }));

  if (!discoveredEntries.length) throw new Error("No SeekAuto listings discovered or configured for bootstrap");

  const discoveredIds = new Set(discoveredEntries.map((entry) => entry.listingId));
  const staleEntries = chooseStaleRechecks(before, discoveredIds, recheckLimit);
  const queueByListingId = new Map();
  for (const entry of [...discoveredEntries, ...staleEntries]) {
    if (!queueByListingId.has(entry.listingId)) queueByListingId.set(entry.listingId, entry);
  }
  const queue = [...queueByListingId.values()];

  const detail = await provider.readEntries(queue);
  if (!detail.rows.length) throw new Error("No SeekAuto listings survived detail loading");

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
  if (!normalized.length) throw new Error("No SeekAuto listings survived normalization");

  const deduped = dedupeNormalizedListings(normalized);
  const storeSummary = await store.upsertMany(deduped.vehicles, {
    providerId: PROVIDER_ID,
    snapshot: false
  });

  const goneIds = detail.errors
    .filter((error) => error.scope === "stale_recheck" && (Number(error.status) === 404 || Number(error.status) === 410))
    .map((error) => error.listingId);
  const missingSummary = await store.markMissing(goneIds, {
    providerId: PROVIDER_ID,
    deactivateAfterMisses: missingThreshold
  });

  const publicSummary = await writePublicSnapshot(store, publicPath);
  const result = {
    success: true,
    mode: "seekauto-sync",
    providerId: PROVIDER_ID,
    startedAt: runStartedAt,
    finishedAt: new Date().toISOString(),
    locale,
    targetListings,
    concurrency,
    recheckLimit,
    missingThreshold,
    bootstrapUsed,
    advertisedInventoryCount: discovery.advertisedCount,
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
    publicSeekAutoItems: publicSummary.managed,
    cachedThumbnails: publicSummary.cachedThumbnails,
    qualityRejected: publicSummary.rejected,
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
    mode: "seekauto-sync",
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
