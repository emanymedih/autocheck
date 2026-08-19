import test from "node:test";
import assert from "node:assert/strict";
import { buildSyncAudit } from "../src/global-sync-audit.js";

function vehicle(id, overrides = {}) {
  return {
    id,
    title: `Car ${id}`,
    price: 100,
    mileage: 1000,
    status: "active",
    photos: [],
    ...overrides
  };
}

test("sync audit reports added updated missing and sold transitions", () => {
  const baseline = [
    vehicle("a"),
    vehicle("b", { price: 200 }),
    vehicle("c"),
    vehicle("d")
  ];
  const current = [
    vehicle("a"),
    vehicle("b", { price: 250 }),
    vehicle("c", { status: "inactive" }),
    vehicle("e")
  ];

  const audit = buildSyncAudit({
    baselineItems: baseline,
    currentItems: current,
    importResult: { success: true, discoveredListings: 4, importedListings: 4, errors: [], normalizationErrors: [] },
    minItems: 4,
    maxMissingRate: 1
  });

  assert.equal(audit.healthy, true);
  assert.equal(audit.counts.added, 1);
  assert.equal(audit.counts.updated, 2);
  assert.equal(audit.counts.missing, 1);
  assert.equal(audit.counts.sold, 1);
  assert.deepEqual(audit.changes.added, ["e"]);
  assert.deepEqual(audit.changes.missing, ["d"]);
  assert.equal(audit.changes.updated.find((item) => item.id === "b").fields.includes("price"), true);
});

test("sync audit blocks publication when current inventory collapses", () => {
  const baseline = Array.from({ length: 20 }, (_, index) => vehicle(`old-${index}`));
  const current = [vehicle("old-0"), vehicle("old-1"), vehicle("new-1")];

  const audit = buildSyncAudit({
    baselineItems: baseline,
    currentItems: current,
    importResult: { success: true, discoveredListings: 3, importedListings: 3, errors: [], normalizationErrors: [] },
    minItems: 10,
    maxMissingRate: 0.7
  });

  assert.equal(audit.healthy, false);
  assert.equal(audit.checks.minimumItems, false);
  assert.equal(audit.checks.continuity, false);
});

test("sync audit blocks duplicate ids and excessive source errors", () => {
  const current = [vehicle("a"), vehicle("a"), vehicle("b")];
  const audit = buildSyncAudit({
    currentItems: current,
    importResult: {
      success: true,
      discoveredListings: 10,
      importedListings: 2,
      errors: Array.from({ length: 4 }, () => ({ message: "failed" })),
      normalizationErrors: []
    },
    minItems: 2,
    maxErrorRate: 0.25
  });

  assert.equal(audit.healthy, false);
  assert.equal(audit.checks.uniqueIds, false);
  assert.equal(audit.checks.errorRate, false);
});

test("sync audit blocks publication without explicit successful import result", () => {
  const current = Array.from({ length: 40 }, (_, index) => vehicle(`car-${index}`));
  const audit = buildSyncAudit({
    currentItems: current,
    importResult: {},
    minItems: 35
  });

  assert.equal(audit.healthy, false);
  assert.equal(audit.checks.importCompleted, false);
});
