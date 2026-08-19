import { CATALOG_BRANDS } from "../catalog-taxonomy.js";

const DEFAULT_BASE = "https://www.seekauto.com";
const IMAGE_BASE = "https://img.jytche.com";
const DEFAULT_LOCALE = "en";
const DEFAULT_SEEDS = [
  "SC043375C6Y08",
  "SC27589737BSU",
  "SC45932075ZEV",
  "SC430582BD3M4",
  "SC38115070HKQ",
  "SC9077025FZXM",
  "SC084297451KA"
];
const SORTED_BRANDS = [...CATALOG_BRANDS].sort((a, b) => b.length - a.length);

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanVehicleTitle(value) {
  const title = String(value ?? "")
    .replace(/\s*[·•]\s*\d{4}[/-]\d{1,2}(?:[/-]\d{1,2})?\s*\|\s*seekauto.*$/i, "")
    .replace(/\s*\|\s*seekauto.*$/i, "")
    .replace(/\s+-\s*seekauto.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return /^(?:seekauto|used cars?|car detail)$/i.test(title) ? "" : title;
}

function normalizeListingId(value) {
  const id = clean(value)?.toUpperCase() || null;
  return id && /^SC[A-Z0-9]+$/.test(id) ? id : null;
}

function toInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const source = String(value).trim();
  if (!source || source.includes("*")) return null;
  const cleaned = source.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function sourceDateToIso(value) {
  const match = String(value ?? "").match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
}

function inferIdentity(title) {
  const source = cleanVehicleTitle(title);
  const brand = SORTED_BRANDS.find((candidate) => new RegExp(`^${escapeRegex(candidate)}(?:\\s|$)`, "i").test(source)) || null;
  if (!brand) {
    return {
      brand: null,
      model: source || null,
      trim: null,
      titleYear: source.match(/\b((?:19|20)\d{2})\b/)?.[1] || null
    };
  }

  const rest = source.replace(new RegExp(`^${escapeRegex(brand)}\\s*`, "i"), "").trim();
  const yearMatch = rest.match(/\b((?:19|20)\d{2})\b/);
  if (!yearMatch) return { brand, model: rest || null, trim: null, titleYear: null };

  const yearIndex = yearMatch.index ?? -1;
  const beforeYear = yearIndex > 0 ? rest.slice(0, yearIndex).trim() : "";
  const afterYear = rest.slice(yearIndex + yearMatch[0].length).trim();
  return {
    brand,
    model: beforeYear || afterYear || rest || null,
    trim: beforeYear && afterYear ? `${yearMatch[1]} ${afterYear}` : null,
    titleYear: yearMatch[1]
  };
}

function imageUrl(raw) {
  const value = clean(raw);
  if (!value) return null;
  try {
    const url = /^https?:\/\//i.test(value)
      ? new URL(value)
      : new URL(`/${value.replace(/^\/+/, "")}`, IMAGE_BASE);
    if (url.hostname.toLowerCase() !== "img.jytche.com") return null;
    if (!/\/car\/image\//i.test(url.pathname)) return null;
    if (!url.search) url.searchParams.set("x-oss-process", "style/normal");
    return url.href;
  } catch (_) {
    return null;
  }
}

function photoList(detail) {
  const images = Array.isArray(detail?.images) ? detail.images : [];
  const candidates = detail?.top_image ? [detail.top_image, ...images] : images;
  return [...new Set(candidates.map(imageUrl).filter(Boolean))].slice(0, 60);
}

function sellerName(detail) {
  return clean(detail?.seller_name ?? detail?.dealer_name ?? detail?.shop_name ?? detail?.merchant_name ?? detail?.company_name);
}

function listingStatus(detail) {
  const value = Number(detail?.car_status);
  if (value === 99) return "active";
  if (!Number.isFinite(value)) return "unknown";
  return "unknown";
}

function detailFacts(detail) {
  const facts = [];
  if (clean(detail?.first_audited_at)) facts.push({ label: "Дата объявления", text: clean(detail.first_audited_at), status: "info" });
  if (clean(detail?.last_audited_at) && detail.last_audited_at !== detail.first_audited_at) {
    facts.push({ label: "Обновлено на площадке", text: clean(detail.last_audited_at), status: "info" });
  }
  if (Number(detail?.is_detection_report) === 1 || (Array.isArray(detail?.reports) && detail.reports.length)) {
    facts.push({ label: "Осмотр", text: "На площадке для автомобиля указан отчёт осмотра.", status: "info" });
  }
  return facts;
}

function inlineScripts(html) {
  return [...String(html ?? "").matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
}

function balancedJsonObject(text, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

export function extractSeekAutoHydration(html, expectedListingId = null) {
  const expected = normalizeListingId(expectedListingId);
  for (const script of inlineScripts(html)) {
    if (!script.includes("initialCarDetail")) continue;
    const pushMatch = script.match(/self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?$/);
    if (!pushMatch) continue;
    try {
      const payload = JSON.parse(pushMatch[1]);
      const decoded = typeof payload?.[1] === "string" ? payload[1] : "";
      const marker = '"initialCarDetail":';
      const markerIndex = decoded.indexOf(marker);
      if (markerIndex < 0) continue;
      const objectStart = decoded.indexOf("{", markerIndex + marker.length);
      if (objectStart < 0) continue;
      const objectText = balancedJsonObject(decoded, objectStart);
      if (!objectText) continue;
      const detail = JSON.parse(objectText);
      const carCode = normalizeListingId(detail?.car_code);
      if (expected && carCode && carCode !== expected) continue;
      return detail;
    } catch (_) {
      // Inspect the next React Server Component chunk.
    }
  }
  return null;
}

export function seekAutoHomeUrl(locale = DEFAULT_LOCALE) {
  const safeLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(locale) ? locale.toLowerCase() : DEFAULT_LOCALE;
  return new URL(`/${safeLocale}`, DEFAULT_BASE).href;
}

export function seekAutoDetailUrl(listingId, locale = DEFAULT_LOCALE) {
  const id = normalizeListingId(listingId);
  if (!id) throw new Error(`Invalid SeekAuto listing id: ${listingId}`);
  const safeLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(locale) ? locale.toLowerCase() : DEFAULT_LOCALE;
  return new URL(`/${safeLocale}/car/detail/${id}`, DEFAULT_BASE).href;
}

export function seekAutoProxyDetailUrl(listingId) {
  const id = normalizeListingId(listingId);
  if (!id) throw new Error(`Invalid SeekAuto listing id: ${listingId}`);
  return new URL(`/api/proxy/cars/${id}/detail`, DEFAULT_BASE).href;
}

export function seekAutoProxyRecommendsUrl(listingId) {
  const id = normalizeListingId(listingId);
  if (!id) throw new Error(`Invalid SeekAuto listing id: ${listingId}`);
  return new URL(`/api/proxy/cars/${id}/recommends`, DEFAULT_BASE).href;
}

export function parseSeekAutoDetailData(detail, { sourceUrl = null } = {}) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) throw new Error("SeekAuto detail payload must be an object");
  const listingId = normalizeListingId(detail.car_code);
  if (!listingId) throw new Error("SeekAuto detail payload is missing car_code");
  const title = cleanVehicleTitle(detail.name);
  if (!title) throw new Error(`SeekAuto vehicle name is missing for ${listingId}`);

  const identity = inferIdentity(title);
  const productionYear = clean(detail.built_date)?.match(/((?:19|20)\d{2})/)?.[1] || null;
  const registrationYear = clean(detail.plate_date)?.match(/((?:19|20)\d{2})/)?.[1] || null;
  const power = toInteger(detail.max_power);
  const drive = clean(detail.drive_type);
  const updatedAt = sourceDateToIso(detail.last_audited_at) || sourceDateToIso(detail.first_audited_at);
  const extraSpecs = [
    ["Привод", drive],
    ["Максимальная мощность", power !== null ? `${power} кВт` : null],
    ["Экологический стандарт", clean(detail.emission)]
  ].filter(([, value]) => value).map(([label, value]) => ({ label, value }));

  return {
    source_listing_id: listingId,
    title,
    brand: identity.brand,
    model: identity.model,
    trim: identity.trim,
    year: productionYear || identity.titleYear || registrationYear,
    mileage_km: toInteger(detail.mileage),
    city: clean(detail.city ?? detail.location ?? detail.location_name),
    price: toInteger(detail.price),
    currency: "CNY",
    body: clean(detail.category_type),
    energy_type: clean(detail.fuel_type || detail.emission || detail.capacity),
    engine: clean(detail.engine),
    transmission: clean(detail.gearbox),
    body_color: clean(detail.body_color ?? detail.exterior_color),
    interior_color: clean(detail.interior_color),
    registration: clean(detail.plate_date),
    description: clean(detail.description),
    listing_facts: detailFacts(detail),
    condition_checks: [],
    extra_specs: extraSpecs,
    photo_urls: photoList(detail),
    status: listingStatus(detail),
    listing_platform: "SeekAuto",
    seller_name: sellerName(detail),
    source_url: sourceUrl || seekAutoDetailUrl(listingId),
    checked_at: new Date().toISOString(),
    updated_at: updatedAt
  };
}

export function parseSeekAutoRecommendationsData(payload, { locale = DEFAULT_LOCALE } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("SeekAuto recommendations payload must be an object");
  const rows = Array.isArray(payload.list) ? payload.list : [];
  const entries = [];
  const seen = new Set();
  for (const row of rows) {
    const listingId = normalizeListingId(row?.car_code);
    if (!listingId || seen.has(listingId)) continue;
    seen.add(listingId);
    entries.push({
      listingId,
      url: seekAutoDetailUrl(listingId, locale),
      title: cleanVehicleTitle(row?.name) || null,
      preview: row
    });
  }
  return { total: toInteger(payload.total) ?? entries.length, entries };
}

export function parseSeekAutoDiscoveryHtml(html, { locale = DEFAULT_LOCALE } = {}) {
  const entries = new Map();
  const normalized = String(html ?? "").replace(/\\\//g, "/");
  let match;
  const detailRegex = /\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?car\/detail\/(SC[A-Z0-9]+)/gi;
  while ((match = detailRegex.exec(normalized))) {
    const listingId = normalizeListingId(match[1]);
    if (listingId && !entries.has(listingId)) entries.set(listingId, { listingId, url: seekAutoDetailUrl(listingId, locale), title: null });
  }
  return { entries: [...entries.values()], advertisedCount: null };
}

export function parseSeekAutoDetailHtml(html, sourceUrl, { fallbackTitle = null } = {}) {
  const url = new URL(sourceUrl);
  const match = url.pathname.match(/\/car\/detail\/(SC[A-Z0-9]+)\/?$/i);
  const listingId = normalizeListingId(match?.[1]);
  if (!listingId) throw new Error("Expected SeekAuto detail URL: /en/car/detail/{listing_id}");
  const detail = extractSeekAutoHydration(html, listingId);
  if (detail) return parseSeekAutoDetailData(detail, { sourceUrl: url.href });

  const sold = /This vehicle has been sold|no longer listed for sale|已售|车辆已售/i.test(String(html ?? ""));
  const title = cleanVehicleTitle(fallbackTitle);
  if (!sold || !title) throw new Error(`SeekAuto hydration payload is missing for ${listingId}`);
  const identity = inferIdentity(title);
  return {
    source_listing_id: listingId,
    title,
    brand: identity.brand,
    model: identity.model,
    trim: identity.trim,
    year: identity.titleYear,
    mileage_km: null,
    city: null,
    price: null,
    currency: "CNY",
    body: null,
    energy_type: null,
    engine: null,
    transmission: null,
    body_color: null,
    registration: null,
    description: "Карточка автомобиля отмечена как снятая с продажи.",
    listing_facts: [],
    condition_checks: [],
    extra_specs: [],
    photo_urls: [],
    status: "inactive",
    listing_platform: "SeekAuto",
    seller_name: null,
    source_url: url.href,
    checked_at: new Date().toISOString(),
    updated_at: null
  };
}

async function fetchJson(fetchImpl, url, timeoutMs, referer = seekAutoHomeUrl()) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "application/json,text/plain,*/*",
      "accept-language": "en-US,en;q=0.9",
      referer,
      "user-agent": "Mozilla/5.0 (compatible; AvtocheckCatalogSync/1.0)"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    const error = new Error(`SeekAuto returned HTTP ${response.status} for ${url}`);
    error.status = response.status;
    throw error;
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`SeekAuto returned non-JSON response for ${url}`);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  const count = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  await Promise.all(Array.from({ length: count }, () => worker()));
  return results;
}

export class SeekAutoListingProvider {
  constructor({ listingId = null, url = null, fetchImpl = globalThis.fetch, timeoutMs = 15000, locale = DEFAULT_LOCALE } = {}) {
    this.listingId = normalizeListingId(listingId) || normalizeListingId(String(url || "").match(/\/car\/detail\/(SC[A-Z0-9]+)/i)?.[1]);
    if (!this.listingId) throw new Error("SeekAuto listingId is required");
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.locale = locale;
  }

  async read() {
    if (typeof this.fetchImpl !== "function") throw new Error("fetch implementation is required");
    const detail = await fetchJson(
      this.fetchImpl,
      seekAutoProxyDetailUrl(this.listingId),
      this.timeoutMs,
      seekAutoDetailUrl(this.listingId, this.locale)
    );
    return [parseSeekAutoDetailData(detail, { sourceUrl: seekAutoDetailUrl(this.listingId, this.locale) })];
  }
}

export class SeekAutoCatalogProvider {
  constructor({
    locale = DEFAULT_LOCALE,
    fetchImpl = globalThis.fetch,
    timeoutMs = 15000,
    maxListings = 60,
    detailConcurrency = 4,
    seedListingIds = DEFAULT_SEEDS,
    maxRecommendationRequests = 30
  } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
    this.locale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(locale) ? locale.toLowerCase() : DEFAULT_LOCALE;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxListings = Math.max(1, Number(maxListings) || 60);
    this.detailConcurrency = Math.max(1, Number(detailConcurrency) || 4);
    this.seedListingIds = [...new Set((seedListingIds || DEFAULT_SEEDS).map(normalizeListingId).filter(Boolean))];
    this.maxRecommendationRequests = Math.max(1, Number(maxRecommendationRequests) || 30);
  }

  async discover() {
    const entries = new Map();
    const queue = [];
    const queued = new Set();
    const recommendationErrors = [];
    let recommendationRequests = 0;

    const add = (listingId, title = null, preview = null) => {
      const id = normalizeListingId(listingId);
      if (!id) return;
      if (!entries.has(id)) {
        entries.set(id, { listingId: id, url: seekAutoDetailUrl(id, this.locale), title: cleanVehicleTitle(title) || null, preview });
      }
      if (!queued.has(id)) {
        queued.add(id);
        queue.push(id);
      }
    };

    for (const seed of this.seedListingIds) add(seed);

    let cursor = 0;
    while (cursor < queue.length && entries.size < this.maxListings && recommendationRequests < this.maxRecommendationRequests) {
      const listingId = queue[cursor++];
      const endpoint = seekAutoProxyRecommendsUrl(listingId);
      recommendationRequests += 1;
      try {
        const payload = await fetchJson(this.fetchImpl, endpoint, this.timeoutMs, seekAutoDetailUrl(listingId, this.locale));
        const parsed = parseSeekAutoRecommendationsData(payload, { locale: this.locale });
        for (const entry of parsed.entries) {
          add(entry.listingId, entry.title, entry.preview);
          if (entries.size >= this.maxListings) break;
        }
      } catch (error) {
        recommendationErrors.push({
          scope: "recommendations",
          listingId,
          url: endpoint,
          status: Number(error.status) || null,
          message: error.message
        });
      }
    }

    return {
      entries: [...entries.values()].slice(0, this.maxListings),
      advertisedCount: null,
      recommendationRequests,
      errors: recommendationErrors
    };
  }

  async readEntries(entries) {
    const detailErrors = [];
    const rows = (await mapWithConcurrency(entries, this.detailConcurrency, async (entry) => {
      try {
        const provider = new SeekAutoListingProvider({
          listingId: entry.listingId,
          fetchImpl: this.fetchImpl,
          timeoutMs: this.timeoutMs,
          locale: this.locale
        });
        const [row] = await provider.read();
        return row || null;
      } catch (error) {
        detailErrors.push({
          scope: entry.scope || "listing",
          listingId: entry.listingId,
          url: seekAutoProxyDetailUrl(entry.listingId),
          status: Number(error.status) || null,
          message: error.message
        });
        return null;
      }
    })).filter(Boolean);
    return { rows, errors: detailErrors };
  }

  async read() {
    const discovery = await this.discover();
    const detail = await this.readEntries(discovery.entries);
    return {
      rows: detail.rows,
      meta: {
        advertisedInventoryCount: null,
        discoveredListings: discovery.entries.length,
        recommendationRequests: discovery.recommendationRequests,
        importedListings: detail.rows.length,
        failedListings: detail.errors.length,
        completeSnapshot: false,
        errors: [...discovery.errors, ...detail.errors]
      }
    };
  }
}
