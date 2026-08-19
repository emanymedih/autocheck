import test from "node:test";
import assert from "node:assert/strict";
import {
  SeekAutoCatalogProvider,
  SeekAutoListingProvider,
  extractSeekAutoHydration,
  parseSeekAutoDetailData,
  parseSeekAutoDetailHtml,
  parseSeekAutoRecommendationsData,
  seekAutoProxyDetailUrl,
  seekAutoProxyRecommendsUrl
} from "../src/providers/seekauto-provider.js";
import { normalizeListing, toPublicVehicle } from "../src/normalizer.js";

function response(url, payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    async text() { return typeof payload === "string" ? payload : JSON.stringify(payload); }
  };
}

function hydrationScript(detail, id = detail.car_code) {
  const decoded = `5:["$","$L18",null,{"id":${JSON.stringify(id)},"lng":"en","initialCarDetail":${JSON.stringify(detail)}}]`;
  return `<script>self.__next_f.push(${JSON.stringify([1, decoded])})</script>`;
}

const activeDetail = {
  car_code: "SC043375C6Y08",
  inner_car_id: 0,
  name: "NIO 2024 EC7 75 kWh",
  model_id: 78180,
  description: "original paint, untouched",
  plate_date: "2025/07/10",
  built_date: "2024/09",
  category_type: "SUV",
  gearbox: "Automatic",
  fuel_type: "Pure Electric",
  drive_type: "All-Wheel Drive",
  price: "268000",
  currency_price: "$37,000",
  mileage: 23000,
  capacity: "New Energy",
  emission: "Pure Electric",
  max_power: 480,
  is_detection_report: 1,
  images: [
    "user/5483756/car/image/a/one.jpg",
    "user/5483756/car/image/a/two.jpg"
  ],
  reports: [],
  first_audited_at: "2026-06-10 01:32:43",
  last_audited_at: "2026-08-01 02:18:05",
  engine: "New Energy 653PS",
  car_status: 99
};

test("SeekAuto detail JSON maps target vehicle into canonical source data", () => {
  const raw = parseSeekAutoDetailData(activeDetail);
  assert.equal(raw.source_listing_id, "SC043375C6Y08");
  assert.equal(raw.brand, "NIO");
  assert.equal(raw.model, "EC7 75 kWh");
  assert.equal(raw.year, "2024");
  assert.equal(raw.registration, "2025/07/10");
  assert.equal(raw.mileage_km, 23000);
  assert.equal(raw.price, 268000);
  assert.equal(raw.currency, "CNY");
  assert.equal(raw.energy_type, "Pure Electric");
  assert.equal(raw.transmission, "Automatic");
  assert.equal(raw.body, "SUV");
  assert.equal(raw.photo_urls.length, 2);
  assert.match(raw.photo_urls[0], /^https:\/\/img\.jytche\.com\/user\/5483756\/car\/image\//);
  assert.equal(raw.listing_platform, "SeekAuto");
  assert.equal(raw.status, "active");
  assert.equal(raw.description, "original paint, untouched");

  const normalized = normalizeListing(raw, { providerId: "seekauto-public" });
  const publicVehicle = toPublicVehicle(normalized);
  assert.equal(normalized.energyType, "Электро");
  assert.equal(publicVehicle.listingPlatform, "SeekAuto");
  assert.equal(publicVehicle.currency, "CNY");
  assert.equal(publicVehicle.price, 268000);
  assert.equal(Object.hasOwn(publicVehicle, "source"), false);
});

test("SeekAuto masked source prices stay null instead of being inferred", () => {
  const raw = parseSeekAutoDetailData({ ...activeDetail, price: "2*****", currency_price: "$3****" });
  assert.equal(raw.price, null);
  assert.equal(raw.currency, "CNY");
});

test("SeekAuto recommendation JSON yields stable listing codes for graph discovery", () => {
  const parsed = parseSeekAutoRecommendationsData({
    total: 3,
    list: [
      { car_code: "SC27589737BSU", name: "NIO 2024 EC7 75 kWh" },
      { car_code: "SC45932075ZEV", name: "NIO 2024 EC7 75 kWh" },
      { car_code: "SC27589737BSU", name: "duplicate" }
    ]
  });
  assert.equal(parsed.total, 3);
  assert.deepEqual(parsed.entries.map((item) => item.listingId), ["SC27589737BSU", "SC45932075ZEV"]);
});

test("SeekAuto still understands the public Next hydration payload as a fallback", () => {
  const html = `<html><body>${hydrationScript(activeDetail)}</body></html>`;
  const hydration = extractSeekAutoHydration(html, "SC043375C6Y08");
  assert.equal(hydration.car_code, "SC043375C6Y08");
  const raw = parseSeekAutoDetailHtml(html, "https://www.seekauto.com/en/car/detail/SC043375C6Y08");
  assert.equal(raw.title, "NIO 2024 EC7 75 kWh");
  assert.equal(raw.mileage_km, 23000);
});

test("SeekAuto listing provider reads the public JSON proxy endpoint", async () => {
  const fetchImpl = async (url) => {
    const value = String(url);
    assert.equal(value, seekAutoProxyDetailUrl("SC043375C6Y08"));
    return response(value, activeDetail);
  };
  const provider = new SeekAutoListingProvider({ listingId: "SC043375C6Y08", fetchImpl });
  const [row] = await provider.read();
  assert.equal(row.source_listing_id, "SC043375C6Y08");
  assert.equal(row.mileage_km, 23000);
});

test("SeekAuto catalog provider grows a valid inventory through recommendation graph", async () => {
  const recommendationPayload = {
    total: 2,
    list: [
      { car_code: "SC27589737BSU", name: "NIO 2024 EC7 75 kWh" },
      { car_code: "SC45932075ZEV", name: "NIO 2024 EC7 75 kWh" }
    ]
  };
  const detailById = new Map([
    ["SC043375C6Y08", activeDetail],
    ["SC27589737BSU", { ...activeDetail, car_code: "SC27589737BSU", mileage: 10000 }],
    ["SC45932075ZEV", { ...activeDetail, car_code: "SC45932075ZEV", mileage: 53000 }]
  ]);

  const fetchImpl = async (url) => {
    const value = String(url);
    if (value === seekAutoProxyRecommendsUrl("SC043375C6Y08")) return response(value, recommendationPayload);
    const detailMatch = value.match(/\/cars\/(SC[A-Z0-9]+)\/detail$/);
    if (detailMatch && detailById.has(detailMatch[1])) return response(value, detailById.get(detailMatch[1]));
    return response(value, { message: "not found" }, 404);
  };

  const provider = new SeekAutoCatalogProvider({
    fetchImpl,
    maxListings: 3,
    detailConcurrency: 2,
    seedListingIds: ["SC043375C6Y08"],
    maxRecommendationRequests: 3
  });
  const result = await provider.read();
  assert.equal(result.meta.discoveredListings, 3);
  assert.equal(result.meta.importedListings, 3);
  assert.equal(result.meta.failedListings, 0);
  assert.deepEqual(result.rows.map((row) => row.source_listing_id), ["SC043375C6Y08", "SC27589737BSU", "SC45932075ZEV"]);
});

test("SeekAuto detail HTTP errors retain status for stale-listing handling", async () => {
  const fetchImpl = async (url) => response(String(url), { message: "not found" }, 404);
  const provider = new SeekAutoCatalogProvider({
    fetchImpl,
    maxListings: 1,
    seedListingIds: ["SC043375C6Y08"]
  });
  const detail = await provider.readEntries([{ listingId: "SC043375C6Y08", scope: "stale_recheck" }]);
  assert.equal(detail.rows.length, 0);
  assert.equal(detail.errors.length, 1);
  assert.equal(detail.errors[0].status, 404);
  assert.equal(detail.errors[0].scope, "stale_recheck");
});
