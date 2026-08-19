import { CATALOG_BRANDS } from "../catalog-taxonomy.js";

const SEEK_HOSTS = new Set(["seekauto.com", "www.seekauto.com"]);
const DEFAULT_BASE = "https://www.seekauto.com";
const DEFAULT_LOCALE = "en";
const DETAIL_STOP_LABELS = [
  "R Year / Month", "P Year / Month", "Mileage", "Displacement", "Engine", "Emission Standard",
  "Transmission", "Gearbox", "Fuel", "Maximum power(kW)", "Drive", "Body Type", "Exterior Color",
  "Interior Color", "Seller’s Vehicle Description", "Seller's Vehicle Description", "Listing Date",
  "Vehicle Information", "Configuration List", "Inspection Report", "Insurance Claims Record", "4S Maintenance Record"
];
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function attribute(tag, name) {
  const match = String(tag).match(new RegExp(`${escapeRegex(name)}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? decodeEntities(match[2]).trim() : null;
}

function titleText(html) {
  const match = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]).replace(/\s+/g, " ").trim() : null;
}

function h1Text(html) {
  const matches = [...String(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => stripTags(match[1]).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return matches.find((value) => !/welcome|seekauto|used cars/i.test(value)) || null;
}

function cleanVehicleTitle(value) {
  return String(value ?? "")
    .replace(/\s*[·•]\s*\d{4}[/-]\d{1,2}(?:[/-]\d{1,2})?\s*\|\s*seekauto.*$/i, "")
    .replace(/\s*\|\s*seekauto.*$/i, "")
    .replace(/\s+-\s*seekauto.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
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

function imageUrl(raw, baseUrl = DEFAULT_BASE) {
  if (!raw || /^data:/i.test(raw)) return null;
  try {
    const url = new URL(decodeEntities(raw), baseUrl);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.hostname.toLowerCase() !== "img.jytche.com") return null;
    if (!/\/car\/image\//i.test(url.pathname)) return null;
    return url.href;
  } catch (_) {
    return null;
  }
}

function toInteger(value) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function exactCurrencyAmount(text, symbol) {
  const match = String(text ?? "").match(new RegExp(`${escapeRegex(symbol)}\\s*([0-9*.,]+)`));
  if (!match || match[1].includes("*")) return null;
  return toInteger(match[1]);
}

function labeledValue(text, label) {
  const stopPattern = DETAIL_STOP_LABELS
    .filter((item) => item !== label)
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:?\\s*(.+?)(?=\\s+(?:${stopPattern})\\s*:?|$)`, "i");
  const match = String(text ?? "").match(pattern);
  return match?.[1]?.trim() || null;
}

function firstMatching(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text ?? "").match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
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

function extractVehiclePhotos(html, sourceUrl) {
  const result = [];
  const seen = new Set();
  const imageRegex = /<img\b[^>]*>/gi;
  let match;

  const push = (raw) => {
    const url = imageUrl(raw, sourceUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push(url);
  };

  while ((match = imageRegex.exec(String(html ?? "")))) {
    const tag = match[0];
    ["src", "data-src", "data-original", "data-lazy-src"].forEach((name) => push(attribute(tag, name)));
    const srcset = attribute(tag, "srcset");
    if (srcset) {
      const candidates = srcset.split(",").map((item) => item.trim().split(/\s+/)[0]).filter(Boolean);
      if (candidates.length) push(candidates[candidates.length - 1]);
    }
  }

  return result.slice(0, 60);
}

function sellerDescription(text) {
  const match = String(text ?? "").match(/Seller[’']s Vehicle Description\s*(.+?)(?=\s+(?:Dear overseas car dealer partners|Inspection Report|Insurance Claims Record|4S Maintenance Record|Same brand\/model|Same price\/year|$))/i);
  return match?.[1]?.trim() || null;
}

function detailFacts(text, listingDate) {
  const facts = [];
  if (listingDate) facts.push({ label: "Дата объявления", text: listingDate, status: "info" });
  if (/Inspection Report/i.test(text)) facts.push({ label: "Осмотр", text: "На площадке указана возможность просмотра отчёта осмотра.", status: "info" });
  if (/Insurance Claims Record/i.test(text)) facts.push({ label: "Страховые случаи", text: "На площадке указана возможность проверки страховых обращений.", status: "info" });
  if (/4S Maintenance Record/i.test(text)) facts.push({ label: "Сервис", text: "На площадке указана возможность проверки сервисной истории 4S.", status: "info" });
  return facts;
}

export function seekAutoHomeUrl(locale = DEFAULT_LOCALE) {
  const safeLocale = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(locale) ? locale.toLowerCase() : DEFAULT_LOCALE;
  return new URL(`/${safeLocale}`, DEFAULT_BASE).href;
}

export function seekAutoDetailUrl(listingId, locale = DEFAULT_LOCALE) {
  const normalized = String(listingId ?? "").trim().toUpperCase();
  if (!/^SC[A-Z0-9]+$/.test(normalized)) throw new Error(`Invalid SeekAuto listing id: ${listingId}`);
  return new URL(`/${locale}/car/detail/${normalized}`, DEFAULT_BASE).href;
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
  const pageTitle = cleanVehicleTitle(titleText(html));
  const heading = cleanVehicleTitle(h1Text(html));
  const title = pageTitle || heading || cleanVehicleTitle(fallbackTitle) || null;
  if (!title && !sold) throw new Error(`Could not parse SeekAuto title ${listingId}`);

  const rawTitle = title || `Автомобиль ${listingId}`;
  const identity = inferIdentity(rawTitle);
  const registration = firstMatching(text, [
    /R Year\s*\/\s*Month\s*:?\s*(\d{4}[/-]\d{1,2}(?:[/-]\d{1,2})?)/i,
    /(\d{4}[/-]\d{1,2}(?:[/-]\d{1,2})?)\s*R Year\s*\/\s*Month/i
  ]);
  const production = firstMatching(text, [
    /P Year\s*\/\s*Month\s*:?\s*(\d{4}(?:[/-]\d{1,2})?)/i,
    /(\d{4}(?:[/-]\d{1,2})?)\s*P Year\s*\/\s*Month/i
  ]);
  const mileageRaw = firstMatching(text, [
    /Mileage\s*:?\s*([\d,]+)\s*km\b/i,
    /([\d,]+)\s*km\s*Mileage\b/i
  ]);
  const listingDateRaw = firstMatching(text, [/(?:Listing Date)\s*:?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i]);
  const sourceUpdatedAt = sourceDateToIso(listingDateRaw);
  const engine = labeledValue(text, "Engine");
  const transmission = labeledValue(text, "Transmission") || labeledValue(text, "Gearbox");
  const fuel = labeledValue(text, "Fuel");
  const drive = labeledValue(text, "Drive");
  const displacement = labeledValue(text, "Displacement");
  const emission = labeledValue(text, "Emission Standard");
  const power = labeledValue(text, "Maximum power(kW)");
  const body = labeledValue(text, "Body Type");
  const bodyColor = labeledValue(text, "Exterior Color");
  const description = sellerDescription(text);
  const photos = extractVehiclePhotos(html, sourceUrl);
  const cnyPrice = exactCurrencyAmount(text, "¥");
  const titleYear = identity.titleYear;
  const year = production?.match(/((?:19|20)\d{2})/)?.[1] || titleYear || registration?.slice(0, 4) || null;
  const energyType = fuel || (/new energy/i.test(String(displacement || "")) ? "New Energy" : null);

  const extraSpecs = [
    ["Рабочий объём", displacement],
    ["Экологический стандарт", emission],
    ["Максимальная мощность", power ? `${power} кВт` : null],
    ["Привод", drive]
  ].filter(([, value]) => value).map(([label, value]) => ({ label, value }));

  return {
    source_listing_id: listingId,
    title: rawTitle,
    brand: identity.brand,
    model: identity.model,
    trim: identity.trim,
    year,
    mileage_km: mileageRaw ? toInteger(mileageRaw) : null,
    city: null,
    price: cnyPrice,
    currency: "CNY",
    body,
    energy_type: energyType,
    engine,
    transmission,
    body_color: bodyColor,
    registration,
    description: description || (sold ? "Карточка автомобиля отмечена как снятая с продажи." : null),
    listing_facts: detailFacts(text, listingDateRaw),
    condition_checks: [],
    extra_specs: extraSpecs,
    photo_urls: photos,
    status: sold ? "inactive" : "active",
    listing_platform: "SeekAuto",
    seller_name: null,
    source_url: url.href,
    checked_at: new Date().toISOString(),
    updated_at: sourceUpdatedAt
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
    this.locale = locale;
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
        detailErrors.push({
          scope: entry.scope || "listing",
          listingId: entry.listingId,
          url: entry.url,
          status: Number(error.status) || String(error.message || "").match(/HTTP\s+(\d{3})/i)?.[1] || null,
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
