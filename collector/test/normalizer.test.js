import test from "node:test";
import assert from "node:assert/strict";
import { normalizeListing, toPublicVehicle } from "../src/normalizer.js";

const raw = {
  source_listing_id: "abc-42",
  title: "Audi A6L",
  year: "2022",
  mileage_km: "29,000 km",
  city: "Linyi",
  price_cny: "252800",
  photo_urls: "https://img/1.jpg|https://img/2.jpg",
  source_url: "https://source/listing/42",
  status: "active"
};

test("normalizer creates stable internal id and public DTO hides source fields", () => {
  const vehicle = normalizeListing(raw, { providerId: "dealer-a" });
  const again = normalizeListing(raw, { providerId: "dealer-a" });
  assert.equal(vehicle.id, again.id);
  assert.equal(vehicle.mileage, 29000);
  assert.equal(vehicle.price, 252800);
  assert.deepEqual(vehicle.photos, ["https://img/1.jpg", "https://img/2.jpg"]);

  const publicVehicle = toPublicVehicle(vehicle);
  assert.equal(publicVehicle.title, "Audi A6L");
  assert.equal("source" in publicVehicle, false);
  assert.equal(JSON.stringify(publicVehicle).includes("source/listing/42"), false);
});

test("invalid VIN is not exposed as VIN", () => {
  const vehicle = normalizeListing({ ...raw, vin: "INVALIDVIN" }, { providerId: "dealer-a" });
  assert.equal(vehicle.vin, null);
});
