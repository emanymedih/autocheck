import { createHash } from "node:crypto";
import { canonicalBody, canonicalBrand, canonicalEnergyType } from "./catalog-taxonomy.js";

const ACTIVE_VALUES = new Set(["active", "available", "in_stock", "instock", "在售", "可售", "1", "true", "yes"]);
const INACTIVE_VALUES = new Set(["inactive", "sold", "unavailable", "removed", "下架", "已售", "0", "false", "no"]);
const ALLOWED_CURRENCIES = new Set(["CNY", "USD", "EUR", "RUB"]);
const PUBLIC_PLATFORM_BY_PROVIDER = new Map([
  ["che168-global-pilot", "Autohome Global"],
  ["che168-pilot", "Che168"],
  ["che168-dealer-pilot", "Che168"],
  ["seekauto-public", "SeekAuto"]
]);

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

function normalizeCurrency(raw) {
  const explicit = clean(raw.currency)?.toUpperCase();
  if (explicit && ALLOWED_CURRENCIES.has(explicit)) return explicit;
  if (raw.price_usd !== null && raw.price_usd !== undefined && raw.price_usd !== "") return "USD";
  if (raw.price_eur !== null && raw.price_eur !== undefined && raw.price_eur !== "") return "EUR";
  if (raw.price_rub !== null && raw.price_rub !== undefined && raw.price_rub !== "") return "RUB";
  return "CNY";
}

function normalizedPrice(raw) {
  return integerValue(raw.price ?? raw.price_cny ?? raw.price_usd ?? raw.price_eur ?? raw.price_rub);
}

function tryJson(value) {
  if (typeof value !== "string") return null;
  const source = value.trim();
  if (!source.startsWith("[") && !source.startsWith("{")) return null;
  try { return JSON.parse(source); } catch (_) { return null; }
}

function normalizeTextList(value, separator = "|") {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const parsed = tryJson(value);
  if (Array.isArray(parsed)) return parsed.map((item) => clean(typeof item === "object" ? item?.label ?? item?.name ?? item?.value : item)).filter(Boolean);
  const text = clean(value);
  if (!text) return [];
  return text.split(separator).map((item) => item.trim()).filter(Boolean);
}

function normalizePhotos(value, separator = "|") {
  return normalizeTextList(value, separator);
}

function normalizeDetailItems(value, { itemSeparator = "|", partSeparator = "::" } = {}) {
  const normalizeObject = (item) => {
    if (!item || typeof item !== "object") return null;
    const label = clean(item.label ?? item.name ?? item.title);
    const text = clean(item.text ?? item.value ?? item.description);
    const status = clean(item.status ?? item.state ?? item.tone);
    if (!label && !text) return null;
    return { label: label || "Сведения", text: text || "Уточняется", status };
  };

  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? normalizeObject(item) : normalizeDetailItems(String(item), { itemSeparator, partSeparator })[0]).filter(Boolean);
  const parsed = tryJson(value);
  if (Array.isArray(parsed)) return parsed.map(normalizeObject).filter(Boolean);

  const text = clean(value);
  if (!text) return [];
  return text.split(itemSeparator).map((chunk) => {
    const parts = chunk.split(partSeparator).map((part) => part.trim());
    const label = clean(parts[0]);
    const description = clean(parts[1]);
    const status = clean(parts[2]);
    if (!label && !description) return null;
    return { label: label || "Сведения", text: description || "Уточняется", status };
  }).filter(Boolean);
}

function normalizeExtraSpecs(value, { itemSeparator = "|", partSeparator = "::" } = {}) {
  return normalizeDetailItems(value, { itemSeparator, partSeparator }).map((item) => ({
    label: item.label,
    value: item.text
  }));
}

function stableVehicleId(providerId, sourceListingId) {
  const digest = createHash("sha256").update(`${providerId}:${sourceListingId}`).digest("hex").slice(0, 20);
  return `av_${digest}`;
}

export function normalizeListing(raw, { providerId, photoSeparator = "|", detailSeparator = "|", detailPartSeparator = "::" } = {}) {
  if (!providerId) throw new Error("providerId is required");

  const sourceListingId = clean(raw.source_listing_id);
  if (!sourceListingId) throw new Error("source_listing_id is required");

  const brand = canonicalBrand(clean(raw.brand));
  const model = clean(raw.model);
  const title = clean(raw.title) || [brand, model, clean(raw.trim)].filter(Boolean).join(" ");
  if (!title) throw new Error(`title/model is required for listing ${sourceListingId}`);

  const now = new Date().toISOString();
  const sourceUpdatedAt = clean(raw.updated_at);
  const detailOptions = { itemSeparator: detailSeparator, partSeparator: detailPartSeparator };

  return {
    id: stableVehicleId(providerId, sourceListingId),
    title,
    brand,
    model,
    trim: clean(raw.trim),
    year: integerValue(raw.year),
    mileage: integerValue(raw.mileage_km),
    city: clean(raw.city),
    price: normalizedPrice(raw),
    priceText: clean(raw.price_text),
    fobPriceText: clean(raw.fob_price_text),
    currency: normalizeCurrency(raw),
    body: canonicalBody(clean(raw.body)),
    energyType: canonicalEnergyType(clean(raw.energy_type ?? raw.powertrain ?? raw.energy)),
    engine: clean(raw.engine),
    transmission: clean(raw.transmission),
    bodyColor: clean(raw.body_color),
    interiorColor: clean(raw.interior_color),
    registration: clean(raw.registration),
    transfers: integerValue(raw.transfers),
    vin: normalizeVin(raw.vin),
    description: clean(raw.description),
    features: normalizeTextList(raw.features, detailSeparator),
    listingFacts: normalizeDetailItems(raw.listing_facts, detailOptions),
    conditionChecks: normalizeDetailItems(raw.condition_checks, detailOptions),
    extraSpecs: normalizeExtraSpecs(raw.extra_specs, detailOptions),
    photos: normalizePhotos(raw.photo_urls, photoSeparator),
    status: normalizeStatus(raw.status),
    listingPlatform: clean(raw.listing_platform),
    sellerName: clean(raw.seller_name),
    sourceUpdatedAt,
    firstSeenAt: now,
    lastSeenAt: now,
    source: {
      providerId,
      listingId: sourceListingId,
      dealerId: clean(raw.source_dealer_id),
      url: clean(raw.source_url),
      checkedAt: clean(raw.checked_at) || now
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
    priceText: vehicle.priceText || null,
    fobPriceText: vehicle.fobPriceText || null,
    currency: vehicle.currency,
    body: vehicle.body,
    energyType: vehicle.energyType || null,
    engine: vehicle.engine,
    transmission: vehicle.transmission,
    bodyColor: vehicle.bodyColor,
    interiorColor: vehicle.interiorColor,
    registration: vehicle.registration,
    transfers: vehicle.transfers,
    vin: vehicle.vin,
    description: vehicle.description || null,
    features: Array.isArray(vehicle.features) ? vehicle.features : [],
    listingFacts: Array.isArray(vehicle.listingFacts) ? vehicle.listingFacts : [],
    conditionChecks: Array.isArray(vehicle.conditionChecks) ? vehicle.conditionChecks : [],
    extraSpecs: Array.isArray(vehicle.extraSpecs) ? vehicle.extraSpecs : [],
    photos: vehicle.photos,
    status: vehicle.status,
    listingPlatform: vehicle.listingPlatform || PUBLIC_PLATFORM_BY_PROVIDER.get(vehicle.source?.providerId) || null,
    sellerName: vehicle.sellerName || null,
    updatedAt: vehicle.sourceUpdatedAt || vehicle.lastSeenAt
  };
}
