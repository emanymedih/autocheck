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

test("publishes marketplace label without exposing source URL or listing id", () => {
  const vehicle = normalizeListing({
    ...raw,
    source_listing_id: "global-42",
    listing_platform: "Autohome Global",
    seller_name: "Export Dealer"
  }, { providerId: "che168-global-pilot" });

  const publicVehicle = toPublicVehicle(vehicle);
  assert.equal(publicVehicle.listingPlatform, "Autohome Global");
  assert.equal(publicVehicle.sellerName, "Export Dealer");
  assert.equal("source" in publicVehicle, false);
  assert.equal(JSON.stringify(publicVehicle).includes("global-42"), false);
});

test("global provider gets a public marketplace label even without an explicit source field", () => {
  const vehicle = normalizeListing({ ...raw, source_listing_id: "global-43" }, { providerId: "che168-global-pilot" });
  assert.equal(toPublicVehicle(vehicle).listingPlatform, "Autohome Global");
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

test("supplier description is published in buyer-friendly Russian while raw text stays private", () => {
  const sourceDescription = "Produced in 2017, registered in 2017; BMW M4 ZCP right rear fender, replaced at 4S shop with damage record documented, repaired and replaced by 4S; all body lines and details in good condition; odometer shows over 80,000 kilometers, but there is evidence of odometer adjustment to around 40,000 kilometers in the vehicle system; upgraded with titanium alloy turbo pipes; four nearly new Michelin PS4S tires, 265mm front and 295mm rear; upgraded to 19th-generation Night Black underglow tail lights; EVO chassis unit; SSR racing short springs; HSR racing front suspension; carbon fiber front bumper, side skirts, and rear spoiler; all fluids replaced on August 12; interior wear minimal, vehicle in excellent condition; comprehensive insurance valid until June next year.";
  const vehicle = normalizeListing({
    ...raw,
    source_listing_id: "m4-description",
    title: "BMW M4",
    description: sourceDescription
  }, { providerId: "seekauto-public" });

  const publicVehicle = toPublicVehicle(vehicle);
  assert.match(publicVehicle.description, /правое заднее крыло заменено/i);
  assert.match(publicVehicle.description, /признаки корректировки пробега/i);
  assert.match(publicVehicle.description, /Michelin PS4S/i);
  assert.equal(publicVehicle.description.includes("Produced in 2017"), false);
  assert.equal(vehicle.source.description, sourceDescription);
  assert.equal(JSON.stringify(publicVehicle).includes(sourceDescription), false);
});

test("unknown foreign supplier prose never leaks raw into the public card", () => {
  const sourceDescription = "Dealer note about unusual custom work that is not covered by the phrasebook.";
  const vehicle = normalizeListing({ ...raw, source_listing_id: "fallback-description", description: sourceDescription }, { providerId: "seekauto-public" });
  const publicVehicle = toPublicVehicle(vehicle);
  assert.match(publicVehicle.description, /Поставщик передал дополнительное описание/i);
  assert.equal(publicVehicle.description.includes("Dealer note"), false);
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
