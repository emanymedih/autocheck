import test from "node:test";
import assert from "node:assert/strict";
import { buildVehicleFacets, filterAndPaginateVehicles } from "../src/catalog-query.js";

const vehicles = [
  { id: "1", title: "Audi A6L 45 TFSI", brand: "Audi", model: "A6L", year: 2022, price: 252800, mileage: 31000, city: "Линьи", body: "Седан", engine: "2.0T", status: "active", sourceUpdatedAt: "2026-08-19T08:00:00Z" },
  { id: "2", title: "BMW X3 xDrive", brand: "BMW", model: "X3", year: 2021, price: 219000, mileage: 48000, city: "Шанхай", body: "Кроссовер", engine: "2.0T", status: "active", sourceUpdatedAt: "2026-08-18T08:00:00Z" },
  { id: "3", title: "Audi Q5L", brand: "Audi", model: "Q5L", year: 2020, price: 188000, mileage: 68000, city: "Пекин", body: "Кроссовер", engine: "2.0T", status: "inactive", sourceUpdatedAt: "2026-08-17T08:00:00Z" },
  { id: "4", title: "Tesla Model Y", brand: "Tesla", model: "Model Y", year: 2023, price: 228000, mileage: 18000, city: "Шанхай", body: "Кроссовер", engine: "EV", status: "active", sourceUpdatedAt: "2026-08-19T09:00:00Z" }
];

function params(query) {
  return new URL(`http://localhost/?${query}`).searchParams;
}

test("filters active inventory by brand price mileage and body", () => {
  const result = filterAndPaginateVehicles(vehicles, params("brand=Audi&body=Седан&price_min=200000&mileage_max=40000"));
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, "1");
});

test("supports status filter and normal page pagination", () => {
  const pageOne = filterAndPaginateVehicles(vehicles, params("status=all&sort=year-desc&page=1&page_size=2"));
  const pageTwo = filterAndPaginateVehicles(vehicles, params("status=all&sort=year-desc&page=2&page_size=2"));
  assert.deepEqual(pageOne.items.map((item) => item.id), ["4", "1"]);
  assert.deepEqual(pageTwo.items.map((item) => item.id), ["2", "3"]);
  assert.equal(pageOne.totalPages, 2);
  assert.equal(pageOne.hasNext, true);
  assert.equal(pageTwo.hasPrevious, true);
});

test("supports engine and range filters", () => {
  const result = filterAndPaginateVehicles(vehicles, params("status=all&engine=EV&year_min=2022&year_max=2024"));
  assert.deepEqual(result.items.map((item) => item.id), ["4"]);
});

test("builds catalog facets and status counts", () => {
  const facets = buildVehicleFacets(vehicles);
  assert.deepEqual(facets.brands, ["Audi", "BMW", "Tesla"]);
  assert.equal(facets.year.min, 2021);
  assert.equal(facets.year.max, 2023);
  assert.equal(facets.statusCounts.active, 3);
  assert.equal(facets.statusCounts.inactive, 1);
});
