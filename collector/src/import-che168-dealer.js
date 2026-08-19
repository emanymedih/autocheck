import path from "node:path";
import { fileURLToPath } from "node:url";
import { Che168DealerInventoryProvider } from "./providers/che168-dealer-inventory-provider.js";
import { normalizeListing } from "./normalizer.js";
import { JsonCatalogStore } from "./store/json-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORE = path.resolve(__dirname, "../data/catalog.json");
const PROVIDER_ID = "che168-pilot";

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

function numberArg(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function usage() {
  console.error(
    "Usage: npm run import:che168-dealer -- --dealer 123615 [--limit 20] [--max-pages 10] [--concurrency 3] [--store ./data/catalog.json]"
  );
}

const args = argsFrom(process.argv.slice(2));

if (!args.dealer) {
  usage();
  process.exitCode = 1;
} else {
  try {
    const provider = new Che168DealerInventoryProvider({
      dealerId: args.dealer,
      maxListings: numberArg(args.limit, null),
      maxPages: numberArg(args["max-pages"], 40),
      detailConcurrency: numberArg(args.concurrency, 3)
    });

    const { rows, meta } = await provider.read();
    if (!rows.length) throw new Error("No valid Che168 dealer listings were imported");

    const normalized = [];
    const normalizationErrors = [];

    rows.forEach((raw) => {
      try {
        normalized.push(normalizeListing(raw, { providerId: PROVIDER_ID }));
      } catch (error) {
        normalizationErrors.push({
          listingId: raw?.source_listing_id || null,
          message: error.message
        });
      }
    });

    if (!normalized.length) throw new Error("No dealer listings survived normalization");

    const snapshotSafe = meta.completeSnapshot && normalizationErrors.length === 0;
    const store = new JsonCatalogStore(path.resolve(args.store || DEFAULT_STORE));
    const storeSummary = await store.upsertMany(normalized, {
      providerId: PROVIDER_ID,
      snapshot: snapshotSafe
    });

    console.log(JSON.stringify({
      mode: "che168-dealer-pilot",
      providerId: PROVIDER_ID,
      dealerId: String(args.dealer),
      ...meta,
      normalizationErrors,
      snapshotApplied: snapshotSafe,
      ...storeSummary
    }, null, 2));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}
