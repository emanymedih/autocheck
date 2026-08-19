import { CATALOG_BRANDS } from "../catalog-taxonomy.js";

const SEEK_HOSTS = new Set(["seekauto.com", "www.seekauto.com"]);
const DEFAULT_BASE = "https://www.seekauto.com";
const IMAGE_BASE = "https://img.jytche.com";
const DEFAULT_LOCALE = "en";
const SORTED_BRANDS = [...CATALOG_BRANDS].sort((a, b) => b.length - a.length);

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value) {
  return decodeEntities(String(value ?? ""))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|section|article|dd|dt|tr|span)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function flatText(html) {
  return stripTags(html).replace(/\s+/g, " ").trim();
}

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
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

function normalizeDetailUrl(raw, baseUrl = DEFAULT_BASE, locale = DEFAULT_LOCALE) {
  if (!raw) return null;
  try {
    const url = new URL(decodeEntities(String(raw).replace(/\\\//g, "/")), baseUrl);
    if (!SEEK_HOSTS.has(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?car\/detail\/(SC[A-Z0-9]+)\/?$/i);
    if (!match) return null;
    return {
      listingId: match[1].toUpperCase(),
      url: new URL(`/${locale}/car/detail/${match[1].toUpperCase()}`, DEFAULT_BASE).href
    };
  } catch (_) {
    return null;
  }
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
  const brand = SORTED_BRANDS.find((candidate) => new RegExp(`^${candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(source)) || null;
  if (!brand) {
    return {
      brand: null,
      model: source || null,
      trim: null,
      titleYear: source.match(/\b((?:19|20)\d{2})\b/)?.[1] || null
    };
  }

  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rest = source.replace(new RegExp(`^${escapedBrand}\\s*`, "i"), "").trim();
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
  const expected = clean(expectedListingId)?.toUpperCase() || null;
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
      const carCode = clean(detail?.car_code)?.toUpperCase() || null;
      if (expected && carCode && carCode !== expected) continue;
      return detail;
    } catch (_) {
      // A page can contain several React Server Component chunks; inspect the next one.
    }
  }
  return null;
}

function hydrationPhotoUrl(raw) {
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

function hydrationPhotos(detail) {
  const values = Array.isArray(detail?.images) ? detail.images : [];
  return [...new Set(values.map(hydrationPhotoUrl).filter(Boolean))].slice(0, 60);
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

function sellerName(detail) {
  return clean(detail?.seller_name ?? detail?.dealer_name ?? detail?.shop_name ?? detail?.merchant_name ?? detail?.company_name);
}

export function seekAutoHomeUrl(locale = DEFAULT_LOCALE) {
  const safeLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(locale) ? locale.toLowerCase() : DEFAULT_LOCALE;
  return new URL(`/${safeLocale}`, DEFAULT_BASE).href;
}

export function seekAutoDetailUrl(listingId, locale = DEFAULT_LOCALE) {
  const normalized = String(listingId ?? "").trim().toUpperCase();
  if (!/^SC[A-Z0-9]+$/.test(normalized)) throw new Error(`Invalid SeekAuto listing id: ${listingId}`);
  const safeLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(locale) ? locale.toLowerCase() : DEFAULT_LOCALE;
  return new URL(`/${safeLocale}/car/detail/${normalized}`, DEFAULT_BASE).href;
}

export function parseSeekAutoDiscoveryHtml(html, { pageUrl = seekAutoHomeUrl(), locale = DEFAULT_LOCALE } = {}) {
  const source = String(html ?? "");
  const normalizedSource = source.replace(/\\\//g, "/");
  const entries = new Map();
  const anchorRegex = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(source))) {
    const detail = normalizeDetailUrl(match[2], pageUrl, locale);
    if (!detail) continue;
    const title = cleanVehicleTitle(stripTags(match[3]));
    entries.set(detail.listingId, {
      listingId: detail.listingId,
      url: detail.url,
      title: title && title.length > 3 ? title : null
    });
  }

  const pathRegex = /\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?car\/detail\/(SC[A-Z0-9]+)/gi;
  while ((match = pathRegex.exec(normalizedSource))) {
    const listingId = match[1].toUpperCase();
    if (!entries.has(listingId)) entries.set(listingId, { listingId, url: seekAutoDetailUrl(listingId, locale), title: null });
  }

  const serializedIdRegex = /\bSC[A-Z0-9]{8,}\b/g;
  while ((match = serializedIdRegex.exec(normalizedSource))) {
    const listingId = match[0].toUpperCase();
    if (!entries.has(listingId)) entries.set(listingId, { listingId, url: seekAutoDetailUrl(listingId, locale), title: null });
  }

  const text = flatText(html);
  const stockMatch = text.match(/(?:In Stock|在售)\s*([\d,]+)/i);
  return {
    entries: [...entries.values()],
    advertisedCount: stockMatch ? toInteger(stockMatch[1]) : null
  };
}

export function parseSeekAutoDetailHtml(html, sourceUrl, { fallbackTitle = null } = {}) {
  const url = new URL(sourceUrl);
  if (!SEEK_HOSTS.has(url.hostname.toLowerCase())) throw new Error(`Unsupported SeekAuto host: ${url.hostname}`);
  const listingMatch = url.pathname.match(/\/car\/detail\/(SC[A-Z0-9]+)\/?$/i);
  if (!listingMatch) throw new Error("Expected SeekAuto detail URL: /en/car/detail/{listing_id}");

  const listingId = listingMatch[1].toUpperCase();
  const text = flatText(html);
  const sold = /This vehicle has been sold|no longer listed for sale|已售|车辆已售/i.test(text);
  const detail = extractSeekAutoHydration(html, listingId);

  if (!detail) {
    if (!sold || !cleanVehicleTitle(fallbackTitle)) {
      throw new Error(`SeekAuto hydration payload is missing for ${listingId}`);
    }
    const inactiveTitle = cleanVehicleTitle(fallbackTitle);
    const identity = inferIdentity(inactiveTitle);
    return {
      source_listing_id: listingId,
      title: inactiveTitle,
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

  const rawTitle = cleanVehicleTitle(detail.name || fallbackTitle);
  if (!rawTitle) throw new Error(`SeekAuto vehicle name is missing for ${listingId}`);
  const identity = inferIdentity(rawTitle);
  const productionYear = clean(detail.built_date)?.match(/((?:19|20)\d{2})/)?.[1] || null;
  const registrationYear = clean(detail.plate_date)?.match(/((?:19|20)\d{2})/)?.[1] || null;
  const status = sold ? "inactive" : Number(detail.car_status) === 99 || detail.car_status === null || detail.car_status === undefined ? "active" : "unknown";
  const lastUpdated = sourceDateToIso(detail.last_audited_at) || sourceDateToIso(detail.first_audited_at);
  const photos = hydrationPhotos(detail);
  const power = toInteger(detail.max_power);
  const drive = clean(detail.drive_type);
  const extraSpecs = [
    ["Привод", drive],
    ["Максимальная мощность", power !== null ? `${power} кВт` : null],
    ["Экологический стандарт", clean(detail.emission)]
  ].filter(([, value]) => value).map(([label, value]) => ({ label, value }));

  return {
    source_listing_id: listingId,
    title: rawTitle,
    brand: identity.brand,
    model: identity.model,
    trim: identity.trim,
    year: productionYear || identity.titleYear || registrationYear,
    mileage_km: toInteger(detail.mileage),
    city: clean(detail.city ?? detail.location ?? detail.location_name),
    price: toInteger(detail.price),
    currency: "CNY",
    body: clean(detail.category_type),
    energy_type: clean(detail.fuel_type || detail.emission),
    engine: clean(detail.engine),
    transmission: clean(detail.gearbox),
    body_color: clean(detail.body_color ?? detail.exterior_color),
    interior_color: clean(detail.interior_color),
    registration: clean(detail.plate_date),
    description: clean(detail.description) || (sold ? "Карточка автомобиля отмечена как снятая с продажи." : null),
    listing_facts: detailFacts(detail),
    condition_checks: [],
    extra_specs: extraSpecs,
    photo_urls: photos,
    status,
    listing_platform: "SeekAuto",
    seller_name: sellerName(detail),
    source_url: url.href,
    checked_at: new Date().toISOString(),
    updated_at: lastUpdated
  };
}

async function fetchHtml(fetchImpl, url, timeoutMs) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "AvtocheckCatalogSync/1.0 (+public vehicle inventory)"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    const error = new Error(`SeekAuto returned HTTP ${response.status} for ${url}`);
    error.status = response.status;
    throw error;
  }
  return { html: await response.text(), url: response.url || url };
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
  constructor({ url, fallbackTitle = null, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
    this.url = url;
    this.fallbackTitle = fallbackTitle;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async read() {
    if (typeof this.fetchImpl !== "function") throw new Error("fetch implementation is required");
    const { html, url } = await fetchHtml(this.fetchImpl, this.url, this.timeoutMs);
    return [parseSeekAutoDetailHtml(html, url, { fallbackTitle: this.fallbackTitle })];
  }
}

export class SeekAutoCatalogProvider {
  constructor({
    locale = DEFAULT_LOCALE,
    fetchImpl = globalThis.fetch,
    timeoutMs = 15000,
    maxListings = 60,
    detailConcurrency = 4
  } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
    this.locale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(locale) ? locale.toLowerCase() : DEFAULT_LOCALE;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxListings = Math.max(1, Number(maxListings) || 60);
    this.detailConcurrency = Math.max(1, Number(detailConcurrency) || 4);
  }

  async discover() {
    const requestedUrl = seekAutoHomeUrl(this.locale);
    try {
      const { html, url } = await fetchHtml(this.fetchImpl, requestedUrl, this.timeoutMs);
      const parsed = parseSeekAutoDiscoveryHtml(html, { pageUrl: url, locale: this.locale });
      return {
        entries: parsed.entries.slice(0, this.maxListings),
        advertisedCount: parsed.advertisedCount,
        errors: []
      };
    } catch (error) {
      return {
        entries: [],
        advertisedCount: null,
        errors: [{ scope: "catalog", url: requestedUrl, status: Number(error.status) || null, message: error.message }]
      };
    }
  }

  async readEntries(entries) {
    const detailErrors = [];
    const rows = (await mapWithConcurrency(entries, this.detailConcurrency, async (entry) => {
      try {
        const provider = new SeekAutoListingProvider({
          url: entry.url,
          fallbackTitle: entry.title,
          fetchImpl: this.fetchImpl,
          timeoutMs: this.timeoutMs
        });
        const [row] = await provider.read();
        return row || null;
      } catch (error) {
        const statusMatch = String(error.message || "").match(/HTTP\s+(\d{3})/i);
        detailErrors.push({
          scope: entry.scope || "listing",
          listingId: entry.listingId,
          url: entry.url,
          status: Number(error.status) || (statusMatch ? Number(statusMatch[1]) : null),
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
        advertisedInventoryCount: discovery.advertisedCount,
        discoveredListings: discovery.entries.length,
        importedListings: detail.rows.length,
        failedListings: detail.errors.length,
        completeSnapshot: false,
        errors: [...discovery.errors, ...detail.errors]
      }
    };
  }
}
