const ALLOWED_STATUSES = new Set(["active", "inactive", "unknown", "all"]);
const ALLOWED_SORTS = new Set([
  "updated-desc",
  "year-desc",
  "year-asc",
  "price-asc",
  "price-desc",
  "mileage-asc",
  "mileage-desc"
]);

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLocaleLowerCase("ru-RU");
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function compareNullableNumbers(a, b, direction = 1) {
  const left = finiteNumber(a);
  const right = finiteNumber(b);
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * direction;
}

function uniqueSorted(values) {
  return [...new Set(values.map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
}

function numericRange(values) {
  const numbers = values.map(finiteNumber).filter((value) => value !== null);
  if (!numbers.length) return { min: null, max: null };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

export function parseCatalogQuery(searchParams) {
  const explicitStatus = lower(searchParams.get("status"));
  const legacyAll = searchParams.get("include_inactive") === "1";
  const status = ALLOWED_STATUSES.has(explicitStatus)
    ? explicitStatus
    : (legacyAll ? "all" : "active");

  const requestedPageSize = searchParams.get("page_size") ?? searchParams.get("limit");
  const pageSize = clampInteger(requestedPageSize, 24, 1, 100);
  const legacyOffset = searchParams.has("offset") && !searchParams.has("page")
    ? clampInteger(searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER)
    : null;
  const page = legacyOffset === null
    ? clampInteger(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER)
    : Math.floor(legacyOffset / pageSize) + 1;

  const requestedSort = lower(searchParams.get("sort"));
  const sort = ALLOWED_SORTS.has(requestedSort) ? requestedSort : "updated-desc";

  return {
    q: lower(searchParams.get("q")),
    city: text(searchParams.get("city")),
    brand: text(searchParams.get("brand")),
    body: text(searchParams.get("body")),
    engine: lower(searchParams.get("engine")),
    status,
    year: finiteNumber(searchParams.get("year")),
    yearMin: finiteNumber(searchParams.get("year_min")),
    yearMax: finiteNumber(searchParams.get("year_max")),
    priceMin: finiteNumber(searchParams.get("price_min")),
    priceMax: finiteNumber(searchParams.get("price_max")),
    mileageMin: finiteNumber(searchParams.get("mileage_min")),
    mileageMax: finiteNumber(searchParams.get("mileage_max")),
    sort,
    page,
    pageSize
  };
}

export function filterAndPaginateVehicles(vehicles, searchParams) {
  const query = parseCatalogQuery(searchParams);
  let result = [...vehicles];

  if (query.status !== "all") result = result.filter((vehicle) => vehicle.status === query.status);
  if (query.city) result = result.filter((vehicle) => vehicle.city === query.city);
  if (query.brand) result = result.filter((vehicle) => vehicle.brand === query.brand);
  if (query.body) result = result.filter((vehicle) => vehicle.body === query.body);
  if (query.engine) result = result.filter((vehicle) => lower(vehicle.engine).includes(query.engine));

  if (query.year !== null) result = result.filter((vehicle) => finiteNumber(vehicle.year) === query.year);
  if (query.yearMin !== null) result = result.filter((vehicle) => finiteNumber(vehicle.year) !== null && finiteNumber(vehicle.year) >= query.yearMin);
  if (query.yearMax !== null) result = result.filter((vehicle) => finiteNumber(vehicle.year) !== null && finiteNumber(vehicle.year) <= query.yearMax);
  if (query.priceMin !== null) result = result.filter((vehicle) => finiteNumber(vehicle.price) !== null && finiteNumber(vehicle.price) >= query.priceMin);
  if (query.priceMax !== null) result = result.filter((vehicle) => finiteNumber(vehicle.price) !== null && finiteNumber(vehicle.price) <= query.priceMax);
  if (query.mileageMin !== null) result = result.filter((vehicle) => finiteNumber(vehicle.mileage) !== null && finiteNumber(vehicle.mileage) >= query.mileageMin);
  if (query.mileageMax !== null) result = result.filter((vehicle) => finiteNumber(vehicle.mileage) !== null && finiteNumber(vehicle.mileage) <= query.mileageMax);

  if (query.q) {
    result = result.filter((vehicle) => lower([
      vehicle.title,
      vehicle.brand,
      vehicle.model,
      vehicle.trim,
      vehicle.body,
      vehicle.engine,
      vehicle.city
    ].filter(Boolean).join(" ")).includes(query.q));
  }

  if (query.sort === "year-desc") result.sort((a, b) => compareNullableNumbers(a.year, b.year, -1));
  if (query.sort === "year-asc") result.sort((a, b) => compareNullableNumbers(a.year, b.year, 1));
  if (query.sort === "price-asc") result.sort((a, b) => compareNullableNumbers(a.price, b.price, 1));
  if (query.sort === "price-desc") result.sort((a, b) => compareNullableNumbers(a.price, b.price, -1));
  if (query.sort === "mileage-asc") result.sort((a, b) => compareNullableNumbers(a.mileage, b.mileage, 1));
  if (query.sort === "mileage-desc") result.sort((a, b) => compareNullableNumbers(a.mileage, b.mileage, -1));
  if (query.sort === "updated-desc") {
    result.sort((a, b) => String(b.sourceUpdatedAt || b.lastSeenAt || "").localeCompare(String(a.sourceUpdatedAt || a.lastSeenAt || "")));
  }

  const total = result.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * query.pageSize;
  const items = result.slice(offset, offset + query.pageSize);

  return {
    items,
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    query: { ...query, page }
  };
}

export function buildVehicleFacets(vehicles) {
  const active = vehicles.filter((vehicle) => vehicle.status === "active");
  const source = active.length ? active : vehicles;
  const statusCounts = vehicles.reduce((acc, vehicle) => {
    const key = vehicle.status || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    brands: uniqueSorted(source.map((vehicle) => vehicle.brand)),
    cities: uniqueSorted(source.map((vehicle) => vehicle.city)),
    bodies: uniqueSorted(source.map((vehicle) => vehicle.body)),
    engines: uniqueSorted(source.map((vehicle) => vehicle.engine)),
    year: numericRange(source.map((vehicle) => vehicle.year)),
    price: numericRange(source.map((vehicle) => vehicle.price)),
    mileage: numericRange(source.map((vehicle) => vehicle.mileage)),
    statusCounts: {
      active: statusCounts.active || 0,
      inactive: statusCounts.inactive || 0,
      unknown: statusCounts.unknown || 0
    }
  };
}
