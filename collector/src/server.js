import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonCatalogStore } from "./store/json-store.js";
import { toPublicVehicle } from "./normalizer.js";
import { buildVehicleFacets, filterAndPaginateVehicles } from "./catalog-query.js";

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

const server = http.createServer(async (req, res) => {
  if (!req.url || req.method !== "GET") return json(res, 405, { error: "method_not_allowed" });
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/health") {
    return json(res, 200, { ok: true, service: "catalog-collector" });
  }

  const storeData = await store.read();

  if (url.pathname === "/api/vehicles/facets") {
    return json(res, 200, {
      facets: buildVehicleFacets(storeData.vehicles),
      updatedAt: storeData.updatedAt
    });
  }

  if (url.pathname === "/api/vehicles") {
    const result = filterAndPaginateVehicles(storeData.vehicles, url.searchParams);
    return json(res, 200, {
      items: result.items.map(toPublicVehicle),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      hasPrevious: result.hasPrevious,
      hasNext: result.hasNext,
      updatedAt: storeData.updatedAt
    });
  }

  const match = url.pathname.match(/^\/api\/vehicles\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const vehicle = storeData.vehicles.find((item) => item.id === id);
    if (!vehicle) return json(res, 404, { error: "vehicle_not_found" });
    return json(res, 200, { vehicle: toPublicVehicle(vehicle) });
  }

  return json(res, 404, { error: "not_found" });
});

server.listen(port, () => {
  console.log(`Catalog API listening on http://localhost:${port}`);
});
