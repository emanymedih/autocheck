import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Che168GlobalCatalogProvider } from "./providers/che168-global-provider.js";
import { normalizeListing, toPublicVehicle } from "./normalizer.js";
import { JsonCatalogStore } from "./store/json-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORE = path.resolve(__dirname, "../data/global-catalog.json");
const DEFAULT_PUBLIC = path.resolve(__dirname, "../data/global-public-catalog.json");
const PROVIDER_ID = "che168-global-pilot";

function argsFrom(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    result[key] = argv[index + 1];
    index += 1;
  }
  return result;
}

function positiveInteger(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

async function writePublicSnapshot(store, filePath) {
  const data = await store.read();
  const vehicles = data.vehicles
    .filter((vehicle) => vehicle.source?.providerId === PROVIDER_ID)
    .map(toPublicVehicle);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify({ updatedAt: data.updatedAt, items: vehicles }, null, 2)}\n`, "utf8");
  return vehicles.length;
}

async function writeResult(filePath, result) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return resolved;
}

const args = argsFrom(process.argv.slice(2));

try {
  const targetListings = positiveInteger(args.limit, 20);
  const maxPages = positiveInteger(args.pages, 5);
  const concurrency = positiveInteger(args.concurrency, 3);
  const provider = new Che168GlobalCatalogProvider({
    locale: args.locale || "en",
    maxListings: targetListings,
    maxPages,
    detailConcurrency: concurrency
  });

  const startedAt = new Date().toISOString();
  const { rows, meta } = await provider.read();
  if (!rows.length) throw new Error("No global catalog listings were imported");

  const normalized = [];
  const normalizationErrors = [];
  for (const raw of rows) {
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

  const storePath = path.resolve(args.store || DEFAULT_STORE);
  const publicPath = path.resolve(args.public || DEFAULT_PUBLIC);
  const store = new JsonCatalogStore(storePath);
  const storeSummary = await store.upsertMany(normalized, {
    providerId: PROVIDER_ID,
    snapshot: false
  });
  const publicItems = await writePublicSnapshot(store, publicPath);

  const result = {
    mode: "che168-global-pilot",
    providerId: PROVIDER_ID,
    startedAt,
    finishedAt: new Date().toISOString(),
    targetListings,
    maxPages,
    concurrency,
    ...meta,
    normalizationErrors,
    snapshotApplied: false,
    publicItems,
    storePath,
    publicPath,
    ...storeSummary
  };
  const resultPath = await writeResult(args.result, result);
  if (resultPath) result.resultPath = resultPath;
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
