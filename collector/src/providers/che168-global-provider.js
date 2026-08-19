const GLOBAL_HOST = "global.che168.com";
const DEFAULT_LOCALE = "en";
const DEFAULT_BASE = `https://${GLOBAL_HOST}`;

const BRAND_PREFIXES = [
  ["Mercedes-Benz", "Mercedes-Benz"], ["Xiaomi Auto", "Xiaomi"], ["Fang Cheng Bao", "Fangchengbao"],
  ["Aston Martin", "Aston Martin"], ["Rolls-Royce", "Rolls-Royce"], ["Land Rover", "Land Rover"],
  ["Leapmotor", "Leapmotor"], ["Volkswagen", "Volkswagen"], ["Lamborghini", "Lamborghini"],
  ["Chevrolet", "Chevrolet"], ["Cadillac", "Cadillac"], ["Genesis", "Genesis"], ["Maserati", "Maserati"],
  ["McLaren", "McLaren"], ["Yangwang", "Yangwang"], ["Mengshi", "Mengshi"], ["Changan", "Changan"],
  ["Toyota", "Toyota"], ["Honda", "Honda"], ["Volvo", "Volvo"], ["Audi", "Audi"], ["BMW", "BMW"],
  ["NIO", "NIO"], ["BYD", "BYD"], ["Tank", "Tank"], ["Jeep", "Jeep"], ["Mazda", "Mazda"],
  ["Lexus", "Lexus"], ["Jaguar", "Jaguar"], ["Peugeot", "Peugeot"], ["Porsche", "Porsche"],
  ["Tesla", "Tesla"], ["Zeekr", "Zeekr"], ["XPeng", "XPeng"], ["Li Auto", "Li Auto"],
  ["Ford", "Ford"], ["Buick", "Buick"], ["Hyundai", "Hyundai"], ["Kia", "Kia"], ["Nissan", "Nissan"],
  ["Subaru", "Subaru"], ["Mitsubishi", "Mitsubishi"], ["Infiniti", "Infiniti"], ["Bentley", "Bentley"],
  ["Ferrari", "Ferrari"], ["Zunjie", "Zunjie"]
].sort((a, b) => b[0].length - a[0].length);

const CITY_RU = new Map(Object.entries({
  beijing: "Пекин", shanghai: "Шанхай", guangzhou: "Гуанчжоу", shenzhen: "Шэньчжэнь",
  chengdu: "Чэнду", chongqing: "Чунцин", hangzhou: "Ханчжоу", nanjing: "Нанкин", suzhou: "Сучжоу",
  wuhan: "Ухань", xian: "Сиань", "xi'an": "Сиань", tianjin: "Тяньцзинь", qingdao: "Циндао",
  dalian: "Далянь", ningbo: "Нинбо", dongguan: "Дунгуань", foshan: "Фошань", zhengzhou: "Чжэнчжоу",
  jinan: "Цзинань", changsha: "Чанша", kunming: "Куньмин", haerbin: "Харбин", harbin: "Харбин",
  shenyang: "Шэньян", fuzhou: "Фучжоу", xiamen: "Сямынь", meishan: "Мэйшань", dazhou: "Дачжоу"
}));

const DETAIL_STOP_LABELS = [
  "Mfg.Date", "1st Reg. Date", "Model Year", "Mileage (km)", "Fuel Type", "Engine (cc)", "Trans.",
  "Steering", "Location", "Drive Train", "Body Type", "Seats", "Doors", "Exterior Color", "Curb Weight (kg)",
  "Dimensions (mm)", "Inspection Report", "Specifications", "Model Name", "Manufacturer Suggested Retail Price", "Manufacturer",
  "Class", "Energy Type", "Launch Date", "Vehicle Details", "Price", "Vehicle Price", "WhatsApp", "Wechat",
  "How to Buy", "Quick Links", "Contact Us"
];

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
    .replace(/<\/(?:p|div|li|h[1-6]|section|article|dd|dt|tr)>/gi, "\n")
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

function absoluteUrl(raw, baseUrl = DEFAULT_BASE) {
  if (!raw || /^data:/i.test(raw)) return null;
  try {
    const url = new URL(decodeEntities(raw), baseUrl);
    if (url.protocol !== "https:" || url.hostname !== GLOBAL_HOST) return null;
    return url;
  } catch (_) {
    return null;
  }
}

function anyHttpsUrl(raw, baseUrl = DEFAULT_BASE) {
  if (!raw || /^data:/i.test(raw)) return null;
  try {
    const url = new URL(decodeEntities(raw), baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch (_) {
    return null;
  }
}

function h1Text(html) {
  const match = String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripTags(match[1]).replace(/\s+/g, " ").trim() : null;
}

function titleText(html) {
  const match = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return stripTags(match[1]).replace(/\s+-\s+.*$/, "").trim();
}

function toInteger(value) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function labeledValue(text, label, stopLabels = DETAIL_STOP_LABELS) {
  const labelPattern = escapeRegex(label);
  const stopPattern = stopLabels
    .filter((item) => item !== label)
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length)
    .join("|");
  const pattern = new RegExp(`${labelPattern}\\s*:?\\s*(.+?)(?=\\s+(?:${stopPattern})\\s*:?|$)`, "i");
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

function normalizeTitle(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+(?:for Sale|Cheap Price|Autohome).*$/i, "")
    .trim();
}

function inferIdentity(title) {
  const source = normalizeTitle(title);
  const yearIndex = source.search(/\b(?:19|20)\d{2}\b/);
  const identityZone = yearIndex >= 0 ? source.slice(0, yearIndex) : source;
  const pair = BRAND_PREFIXES.find(([prefix]) => new RegExp(`(?:^|\\s)${escapeRegex(prefix)}(?:\\s|$)`, "i").test(identityZone));
  if (!pair) {
    const model = identityZone.trim() || source;
    return { brand: null, model: model || null, trim: source || null };
  }

  const [prefix, canonicalBrand] = pair;
  const lowerSource = source.toLowerCase();
  const brandIndex = lowerSource.indexOf(prefix.toLowerCase());
  let rest = source.slice(Math.max(0, brandIndex) + prefix.length).trim();
  if (rest.toLowerCase().startsWith(prefix.toLowerCase())) rest = rest.slice(prefix.length).trim();
  if (rest.toLowerCase().startsWith(canonicalBrand.toLowerCase())) rest = rest.slice(canonicalBrand.length).trim();

  const restYearIndex = rest.search(/\b(?:19|20)\d{2}\b/);
  const model = (restYearIndex >= 0 ? rest.slice(0, restYearIndex) : rest).trim() || null;
  const trim = restYearIndex >= 0 ? rest.slice(restYearIndex).trim() || null : null;
  return { brand: canonicalBrand, model, trim };
}

function canonicalDisplayTitle(originalTitle, identity) {
  if (!identity.brand || !identity.model) return normalizeTitle(originalTitle);
  return [identity.brand, identity.model, identity.trim].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function russianCity(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  return CITY_RU.get(key) || raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function sourceBodyToken(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/hardtop coupe|coupe/i.test(raw)) return "coupe";
  if (/station wagon|wagon|estate/i.test(raw)) return "wagon";
  if (/fastback|liftback/i.test(raw)) return "liftback";
  return raw;
}

function extractVehiclePhotos(html, title, baseUrl) {
  const source = String(html ?? "");
  const result = [];
  const seen = new Set();
  const normalizedTitle = String(title ?? "").toLowerCase();
  const imageRegex = /<img\b[^>]*>/gi;
  let match;

  const push = (raw) => {
    const url = anyHttpsUrl(raw, baseUrl);
    if (!url || seen.has(url)) return;
    if (/\.(?:svg)(?:\?|$)/i.test(url)) return;
    if (/logo|whatsapp|wechat|qrcode|icon|avatar/i.test(url)) return;
    seen.add(url);
    result.push(url);
  };

  while ((match = imageRegex.exec(source))) {
    const tag = match[0];
    const alt = (attribute(tag, "alt") || "").toLowerCase();
    const looksLikeVehicle =
      (normalizedTitle && alt && (alt.includes(normalizedTitle.slice(0, Math.min(32, normalizedTitle.length))) || normalizedTitle.includes(alt))) ||
      /^thumb-\d+$/i.test(alt) ||
      /vehicle|car photo|gallery/i.test(alt);
    if (!looksLikeVehicle) continue;

    ["src", "data-src", "data-original", "data-lazy-src"].forEach((name) => push(attribute(tag, name)));
    const srcset = attribute(tag, "srcset");
    if (srcset) {
      const candidates = srcset.split(",").map((item) => item.trim().split(/\s+/)[0]).filter(Boolean);
      if (candidates.length) push(candidates[candidates.length - 1]);
    }
  }

  return result.slice(0, 60);
}

function inspectionChecks(text) {
  const checks = [];
  if (/No Accident History/i.test(text)) {
    checks.push({ label: "ДТП", text: "В предварительном осмотре заявлено отсутствие истории ДТП.", status: "ok" });
  }
  if (/No Fire Damage/i.test(text)) {
    checks.push({ label: "Пожар", text: "В предварительном осмотре заявлено отсутствие следов пожара.", status: "ok" });
  }
  if (/No Water Damage/i.test(text)) {
    checks.push({ label: "Затопление", text: "В предварительном осмотре заявлено отсутствие следов затопления.", status: "ok" });
  }
  return checks;
}

export function globalCatalogPageUrl(page = 1, locale = DEFAULT_LOCALE) {
  const safeLocale = locale === "ru" ? "ru" : "en";
  const url = new URL(`/${safeLocale}/used-cars`, DEFAULT_BASE);
  url.searchParams.set("vehicle_list", "1");
  if (Number(page) > 1) url.searchParams.set("page", String(Math.floor(Number(page))));
  return url.href;
}

export function parseChe168GlobalCatalogHtml(html, { pageUrl = globalCatalogPageUrl(1), locale = DEFAULT_LOCALE } = {}) {
  const baseUrl = new URL(pageUrl);
  if (baseUrl.hostname !== GLOBAL_HOST) throw new Error(`Unsupported global catalog host: ${baseUrl.hostname}`);
  const entries = new Map();
  const anchorRegex = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(String(html ?? "")))) {
    const url = absoluteUrl(match[2], pageUrl);
    if (!url) continue;
    const detailMatch = url.pathname.match(/^\/(?:en|ru)\/detail\/(\d+)$/);
    if (!detailMatch) continue;
    const listingId = detailMatch[1];
    const title = normalizeTitle(stripTags(match[3]));
    const canonical = new URL(`/${locale === "ru" ? "ru" : "en"}/detail/${listingId}`, DEFAULT_BASE);
    const previous = entries.get(listingId);
    entries.set(listingId, {
      listingId,
      url: canonical.href,
      title: title || previous?.title || null
    });
  }

  const inlineRegex = /\/(?:en|ru)\/detail\/(\d+)/gi;
  while ((match = inlineRegex.exec(String(html ?? "")))) {
    const listingId = match[1];
    if (entries.has(listingId)) continue;
    entries.set(listingId, {
      listingId,
      url: new URL(`/${locale === "ru" ? "ru" : "en"}/detail/${listingId}`, DEFAULT_BASE).href,
      title: null
    });
  }

  const text = flatText(html);
  const countMatch = text.match(/(?:Search Results|Результаты поиска)\s*\(?\s*([\d,]+)\s*\)?/i);
  const advertisedCount = countMatch ? toInteger(countMatch[1]) : null;

  return {
    entries: [...entries.values()],
    advertisedCount
  };
}

export function parseChe168GlobalDetailHtml(html, sourceUrl, { fallbackTitle = null } = {}) {
  const url = new URL(sourceUrl);
  if (url.hostname !== GLOBAL_HOST) throw new Error(`Unsupported global detail host: ${url.hostname}`);
  const match = url.pathname.match(/^\/(?:en|ru)\/detail\/(\d+)$/);
  if (!match) throw new Error("Expected global detail URL: /en/detail/{listing_id}");
  const listingId = match[1];
  const text = flatText(html);
  const sold = /Vehicle has been sold|This vehicle has been sold|Автомобиль продан|Этот автомобиль уже продан/i.test(text);
  const h1 = normalizeTitle(h1Text(html));
  const genericSoldTitle = !h1 || /^(?:Car Detail|Vehicle Sold|Автомобиль продан)/i.test(h1);
  const pageTitle = normalizeTitle((sold && genericSoldTitle ? fallbackTitle : null) || h1 || fallbackTitle || titleText(html));
  if (!pageTitle && !sold) throw new Error(`Could not parse global vehicle title ${listingId}`);

  const rawTitle = pageTitle || `Автомобиль ${listingId}`;
  const identity = inferIdentity(rawTitle);
  const title = canonicalDisplayTitle(rawTitle, identity);
  const priceMatch = text.match(/(?:^|\s)(?:Price|Vehicle Price|Цена автомобиля)\s*\$\s*([\d,]+)/i);
  const registrationRaw = labeledValue(text, "1st Reg. Date") || text.match(/1st Reg\. Date\s*(\d{4}\.\d{1,2})/i)?.[1] || null;
  const registration = /^\d{4}\.\d{1,2}$/.test(String(registrationRaw || "")) ? registrationRaw : null;
  const modelYearValue = labeledValue(text, "Model Year");
  const titleYear = identity.trim?.match(/((?:19|20)\d{2})/)?.[1] || null;
  const modelYear = titleYear || modelYearValue?.match(/((?:19|20)\d{2})/)?.[1] || registration?.slice(0, 4) || null;
  const mileageMatch = text.match(/Mileage \(km\)\s*([\d,]+)/i);
  const mileageValue = mileageMatch?.[1] || labeledValue(text, "Mileage (km)");
  const fuelType = labeledValue(text, "Fuel Type") || labeledValue(text, "Energy Type");
  const engine = labeledValue(text, "Engine (cc)");
  const transmission = labeledValue(text, "Trans.");
  const city = russianCity(labeledValue(text, "Location"));
  const body = sourceBodyToken(labeledValue(text, "Body Type"));
  const bodyColor = labeledValue(text, "Exterior Color");
  const driveTrain = labeledValue(text, "Drive Train");
  const steering = labeledValue(text, "Steering");
  const seats = text.match(/Seats\s*(\d+)/i)?.[1] || labeledValue(text, "Seats");
  const doors = text.match(/Doors\s*(\d+)/i)?.[1] || labeledValue(text, "Doors");
  const curbWeight = text.match(/Curb Weight \(kg\)\s*([\d,]+)/i)?.[1] || null;
  const dimensions = text.match(/Dimensions \(mm\)\s*([0-9]+\s*[*xX]\s*[0-9]+\s*[*xX]\s*[0-9]+)/i)?.[1]?.replace(/\s+/g, "") || null;
  const photos = extractVehiclePhotos(html, rawTitle, sourceUrl);

  const extraSpecs = [
    ["Привод", driveTrain], ["Руль", steering], ["Мест", seats], ["Дверей", doors],
    ["Снаряжённая масса", curbWeight ? `${curbWeight} кг` : null], ["Габариты", dimensions ? `${dimensions} мм` : null]
  ].filter(([, value]) => value).map(([label, value]) => ({ label, value }));

  const conditionChecks = inspectionChecks(text);
  const listingFacts = [];
  if (/Auto Verified/i.test(text)) {
    listingFacts.push({ label: "Предварительная проверка", text: "Для карточки заявлен расширенный предварительный осмотр.", status: "info" });
  }
  if (/Accident Records/i.test(text)) {
    listingFacts.push({ label: "Данные о ДТП", text: "Для автомобиля заявлена доступность сведений о ДТП. Полноту проверим при заказе отчёта.", status: "info" });
  }
  if (/Service Records/i.test(text)) {
    listingFacts.push({ label: "Сервисные данные", text: "Для автомобиля заявлена доступность сервисных записей. Полноту проверим при заказе отчёта.", status: "info" });
  }

  return {
    source_listing_id: listingId,
    title,
    brand: identity.brand,
    model: identity.model,
    trim: identity.trim,
    year: modelYear,
    mileage_km: mileageValue ? toInteger(mileageValue) : null,
    city,
    price: priceMatch ? toInteger(priceMatch[1]) : null,
    currency: "USD",
    body,
    energy_type: fuelType,
    engine: engine && engine !== "--" ? engine : null,
    transmission,
    body_color: bodyColor,
    registration,
    description: sold ? "Карточка автомобиля отмечена как снятая с продажи." : null,
    listing_facts: listingFacts,
    condition_checks: conditionChecks,
    extra_specs: extraSpecs,
    photo_urls: photos,
    status: sold ? "inactive" : "active",
    source_url: url.href,
    checked_at: new Date().toISOString(),
    updated_at: null
  };
}

async function fetchHtml(fetchImpl, url, timeoutMs) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "AvtocheckGlobalCatalogPilot/0.2 (+public export inventory validation)"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Global catalog returned HTTP ${response.status} for ${url}`);
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

export class Che168GlobalListingProvider {
  constructor({ url, fallbackTitle = null, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
    this.url = url;
    this.fallbackTitle = fallbackTitle;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async read() {
    if (typeof this.fetchImpl !== "function") throw new Error("fetch implementation is required");
    const { html, url } = await fetchHtml(this.fetchImpl, this.url, this.timeoutMs);
    return [parseChe168GlobalDetailHtml(html, url, { fallbackTitle: this.fallbackTitle })];
  }
}

export class Che168GlobalCatalogProvider {
  constructor({
    locale = DEFAULT_LOCALE,
    fetchImpl = globalThis.fetch,
    timeoutMs = 15000,
    maxPages = 5,
    maxListings = 20,
    detailConcurrency = 3
  } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
    this.locale = locale === "ru" ? "ru" : "en";
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxPages = Math.max(1, Number(maxPages) || 1);
    this.maxListings = Math.max(1, Number(maxListings) || 20);
    this.detailConcurrency = Math.max(1, Number(detailConcurrency) || 1);
  }

  async discover() {
    const entries = new Map();
    const errors = [];
    let advertisedCount = null;
    let pagesVisited = 0;
    let stoppedOnEmptyPage = false;

    for (let page = 1; page <= this.maxPages && entries.size < this.maxListings; page += 1) {
      const requestedUrl = globalCatalogPageUrl(page, this.locale);
      try {
        const { html, url } = await fetchHtml(this.fetchImpl, requestedUrl, this.timeoutMs);
        pagesVisited += 1;
        const parsed = parseChe168GlobalCatalogHtml(html, { pageUrl: url, locale: this.locale });
        if (parsed.advertisedCount !== null) advertisedCount = parsed.advertisedCount;
        let added = 0;
        for (const entry of parsed.entries) {
          if (entries.has(entry.listingId)) continue;
          entries.set(entry.listingId, entry);
          added += 1;
        }
        if (parsed.entries.length === 0 || added === 0) {
          stoppedOnEmptyPage = true;
          break;
        }
      } catch (error) {
        errors.push({ scope: "catalog_page", page, url: requestedUrl, message: error.message });
        break;
      }
    }

    return {
      entries: [...entries.values()].slice(0, this.maxListings),
      advertisedCount,
      pagesVisited,
      stoppedOnEmptyPage,
      errors
    };
  }

  async read() {
    const discovery = await this.discover();
    const detailErrors = [];
    const rows = (await mapWithConcurrency(discovery.entries, this.detailConcurrency, async (entry) => {
      try {
        const provider = new Che168GlobalListingProvider({
          url: entry.url,
          fallbackTitle: entry.title,
          fetchImpl: this.fetchImpl,
          timeoutMs: this.timeoutMs
        });
        const [row] = await provider.read();
        return row || null;
      } catch (error) {
        detailErrors.push({ scope: "listing", listingId: entry.listingId, url: entry.url, message: error.message });
        return null;
      }
    })).filter(Boolean);

    return {
      rows,
      meta: {
        locale: this.locale,
        advertisedInventoryCount: discovery.advertisedCount,
        pagesVisited: discovery.pagesVisited,
        discoveredListings: discovery.entries.length,
        importedListings: rows.length,
        failedListings: detailErrors.length,
        stoppedOnEmptyPage: discovery.stoppedOnEmptyPage,
        completeSnapshot: false,
        errors: [...discovery.errors, ...detailErrors]
      }
    };
  }
}
