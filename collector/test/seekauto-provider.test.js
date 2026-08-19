import test from "node:test";
import assert from "node:assert/strict";
import {
  SeekAutoCatalogProvider,
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

const activeDetail = `<!doctype html><html><head>
  <title>NIO 2024 EC7 75 kWh · 2025/07/10 | seekauto</title>
</head><body>
  <div>Ref No #SC043375C6Y08</div>
  <h1>NIO 2024 EC7 75 kWh</h1>
  <div>Listing Date: 2026-06-10 01:32:43</div>
  <div>FOB (USD) ≈$3**** ¥268,000</div>
  <div>Vehicle Information Configuration List</div>
  <div>R Year / Month <span>2025/07/10</span></div>
  <div>Mileage <span>23000km</span></div>
  <div>P Year / Month <span>2024/09</span></div>
  <div>Displacement <span>New Energy</span></div>
  <div>Engine <span>New Energy 653PS</span></div>
  <div>Emission Standard <span>Pure Electric</span></div>
  <div>Transmission <span>Automatic</span></div>
  <div>Fuel <span>Pure Electric</span></div>
  <div>Maximum power(kW) <span>480</span></div>
  <div>Drive <span>All-Wheel Drive</span></div>
  <div>Seller’s Vehicle Description <span>original paint, untouched</span></div>
  <div>Inspection Report View Insurance Claims Record View 4S Maintenance Record View</div>
  <div>Dear overseas car dealer partners:</div>
  <img src="https://img.jytche.com/user/1/car/image/a/one.jpg?x-oss-process=style/thumbnail">
  <img data-src="https://img.jytche.com/user/1/car/image/a/two.jpg">
  <img src="https://www.seekauto.com/logo.svg">
</body></html>`;

const soldDetail = `<!doctype html><html><head>
  <title>TANK 2021 Tank 300 2.0T Off-Road Edition Conqueror · 2021/07/15 | seekauto</title>
</head><body>
  <div>Ref No #SC661642651SG</div>
  <div>This vehicle has been sold and is no longer listed for sale.</div>
  <div>R Year / Month 2021/07/15</div>
  <div>Mileage 51000km</div>
  <div>P Year / Month 2021</div>
  <div>Engine 2.0T 227PS L4</div>
  <div>Transmission Automatic</div>
  <div>Fuel Gasoline</div>
</body></html>`;

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

test("SeekAuto detail parser keeps source CNY, vehicle facts, photos and platform", () => {
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
  assert.equal(raw.listing_platform, "SeekAuto");
  assert.equal(raw.status, "active");

  const normalized = normalizeListing(raw, { providerId: "seekauto-public" });
  const publicVehicle = toPublicVehicle(normalized);
  assert.equal(normalized.energyType, "Электро");
  assert.equal(publicVehicle.listingPlatform, "SeekAuto");
  assert.equal(publicVehicle.currency, "CNY");
});

test("SeekAuto masked prices are not guessed and sold cards become inactive", () => {
  const raw = parseSeekAutoDetailHtml(soldDetail, "https://www.seekauto.com/en/car/detail/SC661642651SG");
  assert.equal(raw.status, "inactive");
  assert.equal(raw.price, null);
  assert.equal(raw.mileage_km, 51000);
  assert.equal(raw.energy_type, "Gasoline");
});

test("SeekAuto provider reads discovered cards through the public detail pages", async () => {
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
