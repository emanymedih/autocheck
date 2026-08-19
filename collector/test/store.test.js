import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { normalizeListing } from "../src/normalizer.js";
import { JsonCatalogStore } from "../src/store/json-store.js";

function listing(id, status = "active") {
  return normalizeListing({ source_listing_id: id, title: `Car ${id}`, status }, { providerId: "dealer-a" });
}

test("snapshot import deactivates listings missing from the next snapshot", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "avtocheck-store-"));
  const store = new JsonCatalogStore(path.join(dir, "catalog.json"));
  await store.upsertMany([listing("1"), listing("2")], { providerId: "dealer-a", snapshot: true });
  const result = await store.upsertMany([listing("1")], { providerId: "dealer-a", snapshot: true });
  assert.equal(result.deactivated, 1);
  const data = await store.read();
  assert.equal(data.vehicles.find((item) => item.source.listingId === "2").status, "inactive");
});
