import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TRACKED_FIELDS = [
  "title", "brand", "model", "trim", "year", "mileage", "city", "price", "currency",
  "body", "energyType", "engine", "transmission", "bodyColor", "registration", "status", "photos",
  "listingFacts", "conditionChecks", "extraSpecs"
];

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

function numberArg(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function changedFields(before, after) {
  return TRACKED_FIELDS.filter((field) => stableValue(before?.[field]) !== stableValue(after?.[field]));
}

function mapById(items) {
  const map = new Map();
  const duplicates = [];
  for (const item of items || []) {
    const id = String(item?.id || "").trim();
    if (!id) continue;
    if (map.has(id)) duplicates.push(id);
    map.set(id, item);
  }
  return { map, duplicates };
}

export function buildSyncAudit({
  baselineItems = [],
  currentItems = [],
  importResult = {},
  minItems = 35,
  maxErrorRate = 0.25,
  maxMissingRate = 0.85
} = {}) {
  const baseline = mapById(baselineItems);
  const current = mapById(currentItems);
  const added = [];
  const updated = [];
  const unchanged = [];
  const missing = [];
  const sold = [];

  for (const [id, vehicle] of current.map.entries()) {
    const before = baseline.map.get(id);
    if (!before) {
      added.push(id);
      if (vehicle.status === "inactive") sold.push(id);
      continue;
    }
    const fields = changedFields(before, vehicle);
    if (fields.length) updated.push({ id, fields });
    else unchanged.push(id);
    if (before.status !== "inactive" && vehicle.status === "inactive") sold.push(id);
  }

  for (const id of baseline.map.keys()) {
    if (!current.map.has(id)) missing.push(id);
  }

  const sourceErrors = Array.isArray(importResult.errors) ? importResult.errors.length : 0;
  const normalizationErrors = Array.isArray(importResult.normalizationErrors) ? importResult.normalizationErrors.length : 0;
  const failed = sourceErrors + normalizationErrors;
  const discovered = Number(importResult.discoveredListings || 0);
  const denominator = Math.max(discovered, current.map.size + failed, 1);
  const errorRate = failed / denominator;
  const missingRate = baseline.map.size ? missing.length / baseline.map.size : 0;
  const invalidItems = (currentItems || []).filter((item) => !item?.id || !item?.title || !item?.status).length;

  const checks = {
    minimumItems: current.map.size >= minItems,
    errorRate: errorRate <= maxErrorRate,
    uniqueIds: current.duplicates.length === 0,
    validRecords: invalidItems === 0,
    continuity: baseline.map.size < 10 || missingRate <= maxMissingRate
  };
  const healthy = Object.values(checks).every(Boolean);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    healthy,
    checks,
    thresholds: { minItems, maxErrorRate, maxMissingRate },
    counts: {
      baseline: baseline.map.size,
      current: current.map.size,
      discovered,
      imported: Number(importResult.importedListings || current.map.size),
      failed,
      added: added.length,
      updated: updated.length,
      unchanged: unchanged.length,
      missing: missing.length,
      sold: sold.length,
      duplicateIds: current.duplicates.length,
      invalidItems
    },
    rates: {
      errorRate: Number(errorRate.toFixed(4)),
      missingRate: Number(missingRate.toFixed(4))
    },
    run: {
      startedAt: importResult.startedAt || null,
      finishedAt: importResult.finishedAt || null,
      pagesVisited: Number(importResult.pagesVisited || 0),
      targetListings: Number(importResult.targetListings || 0)
    },
    changes: {
      added,
      updated,
      missing,
      sold
    }
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const args = argsFrom(process.argv.slice(2));
  const baselinePath = path.resolve(args.baseline || "data/global-public-catalog.baseline.json");
  const currentPath = path.resolve(args.current || "data/global-public-catalog.json");
  const importResultPath = path.resolve(args.import || "data/global-import-result.json");
  const reportPath = path.resolve(args.report || "data/global-sync-report.json");
  const statusPath = path.resolve(args.status || "data/global-sync-status.json");

  const baseline = await readJson(baselinePath, { items: [] });
  const current = await readJson(currentPath, { items: [] });
  const importResult = await readJson(importResultPath, {});
  const audit = buildSyncAudit({
    baselineItems: Array.isArray(baseline.items) ? baseline.items : [],
    currentItems: Array.isArray(current.items) ? current.items : [],
    importResult,
    minItems: numberArg(args["min-items"], 35),
    maxErrorRate: numberArg(args["max-error-rate"], 0.25),
    maxMissingRate: numberArg(args["max-missing-rate"], 0.85)
  });

  const publicStatus = {
    updatedAt: current.updatedAt || audit.generatedAt,
    healthy: audit.healthy,
    checks: audit.checks,
    counts: audit.counts,
    rates: audit.rates,
    run: audit.run
  };

  await writeJson(reportPath, audit);
  await writeJson(statusPath, publicStatus);
  console.log(JSON.stringify(publicStatus, null, 2));

  if (!audit.healthy) {
    const failedChecks = Object.entries(audit.checks).filter(([, ok]) => !ok).map(([name]) => name);
    throw new Error(`Global catalog health gate failed: ${failedChecks.join(", ")}`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
