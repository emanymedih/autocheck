import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonCatalogStore } from "./store/json-store.js";
import { toPublicVehicle } from "./normalizer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new JsonCatalogStore(process.env.CATALOG_STORE || path.resolve(__dirname, "../data/catalog.json"));
const port = Number(process.env.PORT || 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": allowedOrigin,
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

const server = http.createServer(async (req, res) => {
  if (!req.url || req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/health") {
    return json(res, 200, { ok: true, service: "catalog-collector" });
  }

  const storeData = await store.read();

  if (url.pathname === "/api/vehicles") {
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const city = (url.searchParams.get("city") || "").trim();
    const includeInactive = url.searchParams.get("include_inactive") === "1";
    const limit = clampInteger(url.searchParams.get("limit"), 100, 1, 500);
    const offset = clampInteger(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

    let vehicles = storeData.vehicles.filter((vehicle) => includeInactive || vehicle.status === "active");
    if (city) vehicles = vehicles.filter((vehicle) => vehicle.city === city);
    if (query) {
      vehicles = vehicles.filter((vehicle) => `${vehicle.title || ""} ${vehicle.brand || ""} ${vehicle.model || ""} ${vehicle.body || ""}`.toLowerCase().includes(query));
    }

    vehicles.sort((a, b) => String(b.sourceUpdatedAt || b.lastSeenAt || "").localeCompare(String(a.sourceUpdatedAt || a.lastSeenAt || "")));
    const total = vehicles.length;
    const items = vehicles.slice(offset, offset + limit).map(toPublicVehicle);
    return json(res, 200, { items, total, limit, offset, updatedAt: storeData.updatedAt });
  }

  const match = url.pathname.match(/^\/api\/vehicles\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const vehicle = storeData.vehicles.find((item) => item.id === id && item.status === "active");
    if (!vehicle) return json(res, 404, { error: "vehicle_not_found" });
    return json(res, 200, { vehicle: toPublicVehicle(vehicle) });
  }

  return json(res, 404, { error: "not_found" });
});

server.listen(port, () => {
  console.log(`Catalog API listening on http://localhost:${port}`);
});
