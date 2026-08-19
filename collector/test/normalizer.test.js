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
  assert.equal(vehicle.currency, "CNY");
  assert.deepEqual(vehicle.photos, ["https://img/1.jpg", "https://img/2.jpg"]);

  const publicVehicle = toPublicVehicle(vehicle);
  assert.equal(publicVehicle.title, "Audi A6L");
  assert.equal("source" in publicVehicle, false);
  assert.equal(JSON.stringify(publicVehicle).includes("source/listing/42"), false);
});

test("preserves explicit USD source price", () => {
  const vehicle = normalizeListing({
    ...raw,
    source_listing_id: "usd-1",
    price_cny: null,
    price: "75,340",
    currency: "USD"
  }, { providerId: "global-pilot" });

  assert.equal(vehicle.price, 75340);
  assert.equal(vehicle.currency, "USD");
  assert.equal(toPublicVehicle(vehicle).currency, "USD");
});

test("invalid VIN is not exposed as VIN", () => {
  const vehicle = normalizeListing({ ...raw, vin: "INVALIDVIN" }, { providerId: "dealer-a" });
  assert.equal(vehicle.vin, null);
});

test("detail fields become reusable public data blocks", () => {
  const vehicle = normalizeListing({
    ...raw,
    features: "Круиз-контроль|Камера 360",
    listing_facts: "Владение::Один владелец|Сервис::Есть сервисные записи",
    condition_checks: "Кузов::Есть окрашенные элементы::warning|Пожар::Признаки не заявлены::ok",
    extra_specs: "Привод::Полный|Мощность::245 л.с."
  }, { providerId: "dealer-a" });

  const publicVehicle = toPublicVehicle(vehicle);
  assert.deepEqual(publicVehicle.features, ["Круиз-контроль", "Камера 360"]);
  assert.equal(publicVehicle.listingFacts[0].label, "Владение");
  assert.equal(publicVehicle.conditionChecks[0].status, "warning");
  assert.deepEqual(publicVehicle.extraSpecs[1], { label: "Мощность", value: "245 л.с." });
});

test("Chinese source brand body and energy values normalize to public taxonomy", () => {
  const vehicle = normalizeListing({
    ...raw,
    title: null,
    brand: "比亚迪",
    model: "宋PLUS",
    body: "SUV",
    energy_type: "插电式混合动力"
  }, { providerId: "dealer-a" });

  const publicVehicle = toPublicVehicle(vehicle);
  assert.equal(publicVehicle.brand, "BYD");
  assert.equal(publicVehicle.title, "BYD 宋PLUS");
  assert.equal(publicVehicle.body, "SUV");
  assert.equal(publicVehicle.energyType, "Подключаемый гибрид (PHEV)");
});
