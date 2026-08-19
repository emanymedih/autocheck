import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetProvider } from "./providers/spreadsheet-provider.js";
import { normalizeListing } from "./normalizer.js";
import { JsonCatalogStore } from "./store/json-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORE = path.resolve(__dirname, "../data/catalog.json");

function argsFrom(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "snapshot") {
      result.snapshot = true;
      continue;
    }
    result[key] = argv[index + 1];
    index += 1;
  }
  return result;
}

function usage() {
  console.error("Usage: npm run import -- --provider dealer-a --file ./inventory.xlsx --mapping ./mapping.json [--snapshot] [--store ./data/catalog.json]");
}

const args = argsFrom(process.argv.slice(2));
if (!args.provider || !args.file || !args.mapping) {
  usage();
  process.exitCode = 1;
} else {
  try {
    const mapping = JSON.parse(await fs.readFile(path.resolve(args.mapping), "utf8"));
    const provider = new SpreadsheetProvider({
      providerId: args.provider,
      filePath: path.resolve(args.file),
      mapping
    });
    const rawRows = await provider.read();
    const normalized = [];
    const errors = [];

    rawRows.forEach((raw, index) => {
      try {
        normalized.push(normalizeListing(raw, {
          providerId: args.provider,
          photoSeparator: mapping.photoSeparator || "|",
          detailSeparator: mapping.detailSeparator || "|",
          detailPartSeparator: mapping.detailPartSeparator || "::"
        }));
      } catch (error) {
        errors.push({ row: index + 2, message: error.message });
      }
    });

    if (!normalized.length) throw new Error("No valid vehicles found in input file");

    const store = new JsonCatalogStore(path.resolve(args.store || DEFAULT_STORE));
    const summary = await store.upsertMany(normalized, {
      providerId: args.provider,
      snapshot: Boolean(args.snapshot)
    });

    console.log(JSON.stringify({
      provider: args.provider,
      inputRows: rawRows.length,
      validRows: normalized.length,
      rejectedRows: errors.length,
      errors: errors.slice(0, 20),
      ...summary
    }, null, 2));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}
