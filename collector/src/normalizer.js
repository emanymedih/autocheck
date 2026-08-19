import { createHash } from "node:crypto";

const ACTIVE_VALUES = new Set(["active", "available", "in_stock", "instock", "在售", "可售", "1", "true", "yes"]);
const INACTIVE_VALUES = new Set(["inactive", "sold", "unavailable", "removed", "下架", "已售", "0", "false", "no"]);

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function numberValue(value) {
  const text = clean(value);
  if (!text) return null;
  const normalized = text.replace(/\s/g, "").replace(/,/g, "").replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function integerValue(value) {
  const number = numberValue(value);
  return number === null ? null : Math.round(number);
}

function normalizeVin(value) {
  const vin = clean(value)?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? null;
  return vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : null;
}

function normalizeStatus(value) {
  const status = clean(value)?.toLowerCase();
  if (!status) return "active";
  if (ACTIVE_VALUES.has(status)) return "active";
  if (INACTIVE_VALUES.has(status)) return "inactive";
  return "unknown";
}

function normalizePhotos(value, separator = "|") {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const text = clean(value);
  if (!text) return [];
  return text.split(separator).map((item) => item.trim()).filter(Boolean);
}

function stableVehicleId(providerId, sourceListingId) {
  const digest = createHash("sha256").update(`${providerId}:${sourceListingId}`).digest("hex").slice(0, 20);
  return `av_${digest}`;
}

export function normalizeListing(raw, { providerId, photoSeparator = "|" } = {}) {
  if (!providerId) throw new Error("providerId is required");

  const sourceListingId = clean(raw.source_listing_id);
  if (!sourceListingId) throw new Error("source_listing_id is required");

  const brand = clean(raw.brand);
  const model = clean(raw.model);
  const title = clean(raw.title) || [brand, model, clean(raw.trim)].filter(Boolean).join(" ");
  if (!title) throw new Error(`title/model is required for listing ${sourceListingId}`);

  const now = new Date().toISOString();
  const sourceUpdatedAt = clean(raw.updated_at);

  return {
    id: stableVehicleId(providerId, sourceListingId),
    title,
    brand,
    model,
    trim: clean(raw.trim),
    year: integerValue(raw.year),
    mileage: integerValue(raw.mileage_km),
    city: clean(raw.city),
    price: integerValue(raw.price_cny),
    currency: "CNY",
    body: clean(raw.body),
    engine: clean(raw.engine),
    transmission: clean(raw.transmission),
    bodyColor: clean(raw.body_color),
    interiorColor: clean(raw.interior_color),
    registration: clean(raw.registration),
    transfers: integerValue(raw.transfers),
    vin: normalizeVin(raw.vin),
    photos: normalizePhotos(raw.photo_urls, photoSeparator),
    status: normalizeStatus(raw.status),
    sourceUpdatedAt,
    firstSeenAt: now,
    lastSeenAt: now,
    source: {
      providerId,
      listingId: sourceListingId,
      url: clean(raw.source_url)
    }
  };
}

export function toPublicVehicle(vehicle) {
  return {
    id: vehicle.id,
    title: vehicle.title,
    brand: vehicle.brand,
    model: vehicle.model,
    trim: vehicle.trim,
    year: vehicle.year,
    mileage: vehicle.mileage,
    city: vehicle.city,
    price: vehicle.price,
    currency: vehicle.currency,
    body: vehicle.body,
    engine: vehicle.engine,
    transmission: vehicle.transmission,
    bodyColor: vehicle.bodyColor,
    interiorColor: vehicle.interiorColor,
    registration: vehicle.registration,
    transfers: vehicle.transfers,
    vin: vehicle.vin,
    photos: vehicle.photos,
    status: vehicle.status,
    updatedAt: vehicle.sourceUpdatedAt || vehicle.lastSeenAt
  };
}
