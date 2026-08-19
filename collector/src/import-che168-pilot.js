import path from "node:path";
import { fileURLToPath } from "node:url";
import { Che168PilotProvider } from "./providers/che168-pilot-provider.js";
import { normalizeListing, toPublicVehicle } from "./normalizer.js";
import { JsonCatalogStore } from "./store/json-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORE = path.resolve(__dirname, "../data/catalog.json");
const DEFAULT_PROVIDER = "che168-pilot";

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

function usage() {
  console.error("Usage: npm run import:che168-pilot -- --url https://s.che168.com/dealer/{dealer_id}/{listing_id}.html [--provider che168-pilot] [--store ./data/catalog.json]");
}

const args = argsFrom(process.argv.slice(2));
if (!args.url) {
  usage();
  process.exitCode = 1;
} else {
  try {
    const providerId = args.provider || DEFAULT_PROVIDER;
    const provider = new Che168PilotProvider({ url: args.url });
    const rows = await provider.read();
    const vehicles = rows.map((raw) => normalizeListing(raw, { providerId }));
    const store = new JsonCatalogStore(path.resolve(args.store || DEFAULT_STORE));
    const summary = await store.upsertMany(vehicles, { providerId, snapshot: false });

    console.log(JSON.stringify({
      provider: providerId,
      mode: "single-listing-pilot",
      sourceUrl: args.url,
      ...summary,
      vehicle: toPublicVehicle(vehicles[0])
    }, null, 2));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}
