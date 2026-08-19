import test from "node:test";
import assert from "node:assert/strict";
import {
  SeekAutoCatalogProvider,
  extractSeekAutoHydration,
  parseSeekAutoDetailHtml,
  parseSeekAutoDiscoveryHtml,
  seekAutoHomeUrl
} from "../src/providers/seekauto-provider.js";
import { normalizeListing, toPublicVehicle } from "../src/normalizer.js";

function response(url, html, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    async text() { return html; }
  };
}

function hydrationScript(detail, id = detail.car_code) {
  const decoded = `5:["$","$L18",null,{"id":${JSON.stringify(id)},"lng":"en","initialCarDetail":${JSON.stringify(detail)}}]`;
  return `<script>self.__next_f.push(${JSON.stringify([1, decoded])})</script>`;
}

function detailPage(detail, { sold = false } = {}) {
  return `<!doctype html><html><head><title>${detail.name || "seekauto"} | seekauto</title></head><body>
    <div>Ref No #${detail.car_code}</div>
    ${hydrationScript(detail)}
    ${sold ? "<div>This vehicle has been sold and is no longer listed for sale.</div>" : ""}
  </body></html>`;
}

const activeHydration = {
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

const activeDetail = detailPage(activeHydration);
const soldHydration = {
  ...activeHydration,
  car_code: "SC661642651SG",
  name: "Tank 2021 Tank 300 2.0T Off-Road Edition Conqueror",
  built_date: "2021",
  plate_date: "2021/07/15",
  mileage: 51000,
  price: "2*****",
  fuel_type: "Gasoline",
  emission: "China VI",
  engine: "2.0T 227PS L4",
  max_power: 167,
  car_status: 0
};
const soldDetail = detailPage(soldHydration, { sold: true });

test("SeekAuto discovery finds detail links and serialized SC identifiers", () => {
  const html = `<!doctype html><html><body>
    <div>In Stock 677906</div>
    <a href="/en/car/detail/SC043375C6Y08">NIO 2024 EC7 75 kWh</a>
    <script>window.__DATA__={"carCode":"SC45956390F3F"};</script>
  </body></html>`;
  const parsed = parseSeekAutoDiscoveryHtml(html, { pageUrl: seekAutoHomeUrl() });
  assert.equal(parsed.advertisedCount, 677906);
  assert.deepEqual(parsed.entries.map((item) => item.listingId), ["SC043375C6Y08", "SC45956390F3F"]);
  assert.equal(parsed.entries[0].title, "NIO 2024 EC7 75 kWh");
});

test("SeekAuto extracts the target car from Next hydration instead of related-card markup", () => {
  const hydration = extractSeekAutoHydration(activeDetail, "SC043375C6Y08");
  assert.equal(hydration.car_code, "SC043375C6Y08");
  assert.equal(hydration.name, "NIO 2024 EC7 75 kWh");
  assert.equal(hydration.mileage, 23000);
});

test("SeekAuto detail parser keeps source CNY, vehicle facts, target photos and platform", () => {
  const raw = parseSeekAutoDetailHtml(activeDetail, "https://www.seekauto.com/en/car/detail/SC043375C6Y08");
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
});

test("SeekAuto masked source prices are not guessed and sold cards become inactive", () => {
  const raw = parseSeekAutoDetailHtml(soldDetail, "https://www.seekauto.com/en/car/detail/SC661642651SG");
  assert.equal(raw.status, "inactive");
  assert.equal(raw.price, null);
  assert.equal(raw.mileage_km, 51000);
  assert.equal(raw.energy_type, "Gasoline");
});

test("SeekAuto refuses a generic server shell without the target hydration payload", () => {
  const shell = `<html><head><title>seekauto</title></head><body>
    <div>Vehicle Information</div><div>Engine</div><div>Transmission</div>
    <img src="https://img.jytche.com/user/other/car/image/related.jpg">
  </body></html>`;
  assert.throws(
    () => parseSeekAutoDetailHtml(shell, "https://www.seekauto.com/en/car/detail/SC043375C6Y08"),
    /hydration payload is missing/
  );
});

test("SeekAuto provider reads discovered cards through public Next-rendered detail pages", async () => {
  const home = `<!doctype html><html><body>
    <div>In Stock 677906</div>
    <a href="/en/car/detail/SC043375C6Y08">NIO 2024 EC7 75 kWh</a>
  </body></html>`;
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value === seekAutoHomeUrl()) return response(value, home);
    if (value.includes("SC043375C6Y08")) return response(value, activeDetail);
    return response(value, "not found", 404);
  };

  const provider = new SeekAutoCatalogProvider({ fetchImpl, maxListings: 10, detailConcurrency: 2 });
  const result = await provider.read();
  assert.equal(result.rows.length, 1);
  assert.equal(result.meta.discoveredListings, 1);
  assert.equal(result.meta.importedListings, 1);
  assert.equal(result.meta.advertisedInventoryCount, 677906);
  assert.equal(result.meta.completeSnapshot, false);
});
