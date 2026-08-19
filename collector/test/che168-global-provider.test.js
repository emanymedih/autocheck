import test from "node:test";
import assert from "node:assert/strict";
import {
  Che168GlobalCatalogProvider,
  globalCatalogPageUrl,
  parseChe168GlobalCatalogHtml,
  parseChe168GlobalDetailHtml
} from "../src/providers/che168-global-provider.js";
import { normalizeListing } from "../src/normalizer.js";

function response(url, html, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    async text() { return html; }
  };
}

const listHtml = `<!doctype html><html><body>
  <div>Search Results (259821)</div>
  <a href="/en/detail/59196143">Xiaomi Auto Xiaomi SU7 Ultra 2025 Model Ultra</a>
  <a href="https://global.che168.com/en/detail/59171681">BMW BMW X1 2023 sDrive20Li X Design Package</a>
  <a href="/ru/detail/59182493">BYD Dolphin 2025 420km Freedom Edition</a>
</body></html>`;

const xiaomiDetail = `<!doctype html><html><head><title>Used Xiaomi Auto Xiaomi SU7 Ultra 2025 Model Ultra - Autohome</title></head><body>
  <h1>Xiaomi Auto Xiaomi SU7 Ultra 2025 Model Ultra</h1>
  <div>Price <strong>$75,340</strong></div>
  <div>1st Reg. Date <span>2025.08</span></div>
  <div>Model Year <span>2025.02</span></div>
  <div>Mileage (km) <span>6500</span></div>
  <div>Fuel Type <span>Pure Electric</span></div>
  <div>Engine (cc) <span>--</span></div>
  <div>Trans. <span>Electric vehicle single-speed transmission</span></div>
  <div>Steering <span>Left</span></div>
  <div>Location <span>guangzhou</span></div>
  <div>Drive Train <span>Triple Motor, All-Wheel Drive</span></div>
  <div>Body Type <span>Sedan</span></div>
  <div>Seats <span>5</span></div>
  <div>Doors <span>4</span></div>
  <div>Exterior Color <span>Green</span></div>
  <div>Curb Weight (kg) <span>2360</span></div>
  <div>Dimensions (mm) <span>5070*1970*1465</span></div>
  <div>Inspection Report Auto Verified No Accident History No Fire Damage No Water Damage Accident Records Service Records</div>
  <img alt="Xiaomi Auto Xiaomi SU7 Ultra 2025 Model Ultra 1" src="https://img.example/vehicle-1.jpg">
  <img alt="thumb-0" src="https://img.example/vehicle-thumb.jpg">
  <img alt="logo" src="https://global.che168.com/logo.svg">
</body></html>`;

const bmwDetail = `<!doctype html><html><body>
  <h1>BMW BMW X1 2023 sDrive20Li X Design Package</h1>
  <div>Price $33,250</div>
  <div>1st Reg. Date 2023.09</div>
  <div>Model Year 2023.01</div>
  <div>Mileage (km) 29000</div>
  <div>Fuel Type Gasoline</div>
  <div>Engine (cc) 1.5T 156hp L3</div>
  <div>Trans. 7-speed dual-clutch transmission</div>
  <div>Location chengdu</div>
  <div>Body Type SUV</div>
  <div>Exterior Color White</div>
</body></html>`;

test("global catalog parser discovers export detail URLs and inventory count", () => {
  const parsed = parseChe168GlobalCatalogHtml(listHtml, { pageUrl: globalCatalogPageUrl(1), locale: "en" });
  assert.equal(parsed.advertisedCount, 259821);
  assert.deepEqual(parsed.entries.map((item) => item.listingId), ["59196143", "59171681", "59182493"]);
  assert.equal(parsed.entries[0].url, "https://global.che168.com/en/detail/59196143");
});

test("global detail parser extracts USD price, vehicle details, photos and inspection claims", () => {
  const raw = parseChe168GlobalDetailHtml(xiaomiDetail, "https://global.che168.com/en/detail/59196143");
  assert.equal(raw.source_listing_id, "59196143");
  assert.equal(raw.brand, "Xiaomi");
  assert.equal(raw.model, "SU7 Ultra");
  assert.equal(raw.price, 75340);
  assert.equal(raw.currency, "USD");
  assert.equal(raw.mileage_km, 6500);
  assert.equal(raw.city, "Гуанчжоу");
  assert.equal(raw.body, "Sedan");
  assert.equal(raw.energy_type, "Pure Electric");
  assert.equal(raw.photo_urls.length, 2);
  assert.equal(raw.condition_checks.length, 3);

  const normalized = normalizeListing(raw, { providerId: "che168-global-pilot" });
  assert.equal(normalized.currency, "USD");
  assert.equal(normalized.energyType, "Электро");
  assert.equal(normalized.body, "Седан");
});

test("sold global detail becomes inactive and can use title from discovery", () => {
  const raw = parseChe168GlobalDetailHtml(
    `<html><body><h1>Car Detail - Autohome</h1><div>Vehicle has been sold. This vehicle has been sold.</div></body></html>`,
    "https://global.che168.com/en/detail/58855114",
    { fallbackTitle: "Audi Audi A5 2019 Sportback 45 TFSI" }
  );
  assert.equal(raw.status, "inactive");
});

test("global provider imports a limited multi-card pilot and never applies a full snapshot", async () => {
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value === globalCatalogPageUrl(1)) return response(value, listHtml);
    if (value.includes("59196143")) return response(value, xiaomiDetail);
    if (value.includes("59171681")) return response(value, bmwDetail);
    return response(value, "<html><body>Vehicle has been sold</body></html>");
  };

  const provider = new Che168GlobalCatalogProvider({
    fetchImpl,
    maxListings: 2,
    maxPages: 1,
    detailConcurrency: 2
  });
  const result = await provider.read();

  assert.equal(result.rows.length, 2);
  assert.equal(result.meta.importedListings, 2);
  assert.equal(result.meta.advertisedInventoryCount, 259821);
  assert.equal(result.meta.completeSnapshot, false);
});
