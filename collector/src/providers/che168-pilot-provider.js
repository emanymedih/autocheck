const SUPPORTED_HOST = "s.che168.com";

const BRAND_PREFIXES = [
  ["奥迪", "Audi"], ["宝马", "BMW"], ["奔驰", "Mercedes-Benz"], ["大众", "Volkswagen"],
  ["丰田", "Toyota"], ["本田", "Honda"], ["比亚迪", "BYD"], ["吉利", "Geely"],
  ["长安", "Changan"], ["奇瑞", "Chery"], ["哈弗", "Haval"], ["红旗", "Hongqi"],
  ["特斯拉", "Tesla"], ["蔚来", "NIO"], ["小鹏", "XPeng"], ["理想", "Li Auto"],
  ["极氪", "Zeekr"], ["问界", "AITO"], ["小米汽车", "Xiaomi"], ["零跑", "Leapmotor"],
  ["腾势", "Denza"], ["阿维塔", "AVATR"], ["深蓝", "Deepal"], ["领克", "Lynk & Co"]
];

const CITY_RU = new Map([
  ["绍兴", "Шаосин"], ["上海", "Шанхай"], ["北京", "Пекин"], ["杭州", "Ханчжоу"],
  ["广州", "Гуанчжоу"], ["深圳", "Шэньчжэнь"], ["苏州", "Сучжоу"], ["宁波", "Нинбо"]
]);

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function plainText(html) {
  return decodeEntities(String(html ?? ""))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/div>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/ +/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function wanToInteger(value) {
  const number = toNumber(value);
  return number === null ? null : Math.round(number * 10000);
}

function extractPageTitle(html, text) {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const decoded = decodeEntities(titleTag || "").replace(/^〖[^〗]+〗/, "").trim();
  if (decoded) return decoded.split(/_[0-9.]+万_/)[0].replace(/_二手车之家.*$/i, "").trim();

  return firstMatch(text, [
    /([\u4e00-\u9fffA-Za-z0-9·&+\-() ]+\s+20\d{2}款[^\n]+)/,
    /([\u4e00-\u9fffA-Za-z0-9·&+\-() ]+\s+20\d{2}[^\n]+)/
  ])?.[1]?.trim() || null;
}

function extractBrandAndModel(sourceTitle) {
  if (!sourceTitle) return { brand: null, model: null, displayTitle: null, trim: null };

  const brandPair = BRAND_PREFIXES.find(([prefix]) => sourceTitle.startsWith(prefix));
  if (!brandPair) {
    return { brand: null, model: null, displayTitle: sourceTitle, trim: sourceTitle };
  }

  const [prefix, brand] = brandPair;
  const afterBrand = sourceTitle.slice(prefix.length).trim();
  const model = afterBrand.match(/^([A-Za-z0-9+\-]+)/)?.[1] || null;
  const displayTitle = [brand, model].filter(Boolean).join(" ") || brand;
  const trim = afterBrand.replace(/^([A-Za-z0-9+\-]+)\s*/, "").trim() || null;
  return { brand, model, displayTitle, trim };
}

function extractDescription(text) {
  const marker = text.indexOf("车辆描述");
  if (marker < 0) return null;
  const tail = text.slice(marker + "车辆描述".length);
  const endMarkers = ["联系我时", "车辆实拍", "全部车源", "进店逛逛"];
  let end = tail.length;
  for (const token of endMarkers) {
    const index = tail.indexOf(token);
    if (index >= 0 && index < end) end = index;
  }
  const value = tail.slice(0, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "展开全部")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return value || null;
}

function extractImages(html) {
  const matches = String(html).match(/(?:https?:)?\/\/2sc2\.autoimg\.cn\/escimg\/[^"'<>\s)]+/gi) || [];
  const urls = matches.map((url) => decodeEntities(url).replace(/^\/\//, "https://"));
  return [...new Set(urls)];
}

function inferEnergyType(text, engine) {
  if (/纯电动|纯电|BEV|EV\b/i.test(text)) return "纯电动";
  if (/插电式混合动力|插电混动|PHEV/i.test(text)) return "插电式混合动力";
  if (/增程式|增程|EREV/i.test(text)) return "增程式";
  if (/油电混合|HEV/i.test(text)) return "油电混合";
  if (/柴油/i.test(text)) return "柴油";
  if (/汽油/i.test(text) || /\d(?:\.\d)?[LT]\b/i.test(engine || "")) return "汽油";
  return null;
}

function inferBody(sourceTitle) {
  const value = sourceTitle || "";
  if (/Limousine|三厢/i.test(value)) return "轿车";
  if (/Sportback|两厢/i.test(value)) return "两厢车";
  if (/SUV|越野/i.test(value)) return "SUV";
  if (/MPV/i.test(value)) return "MPV";
  return null;
}

function russianCity(rawCity) {
  const city = String(rawCity ?? "").trim();
  return CITY_RU.get(city) || city || null;
}

export function validateChe168ListingUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Che168 pilot requires HTTPS");
  if (url.hostname !== SUPPORTED_HOST) throw new Error(`Unsupported host: ${url.hostname}`);
  const match = url.pathname.match(/^\/dealer\/(\d+)\/(\d+)\.html$/);
  if (!match) throw new Error("Expected Che168 listing URL: /dealer/{dealer_id}/{listing_id}.html");
  return { url, dealerId: match[1], listingId: match[2] };
}

export function parseChe168ListingHtml(html, sourceUrl) {
  const { url, dealerId, listingId } = validateChe168ListingUrl(sourceUrl);
  const text = plainText(html);
  const sourceTitle = extractPageTitle(html, text);
  if (!sourceTitle) throw new Error(`Could not parse title for listing ${listingId}`);

  const identity = extractBrandAndModel(sourceTitle);
  const priceMatch = firstMatch(text, [
    new RegExp(`${listingId}[^\\n]*?(\\d+(?:\\.\\d+)?)万`, "i"),
    /(?:0次过户|\d+次过户)[\s\S]{0,120}?(\d+(?:\.\d+)?)万(?:\s|（|\()/,
    /￥\s*(\d+(?:\.\d+)?)万/
  ]);
  const mileageMatch = text.match(/(\d+(?:\.\d+)?)万公里表显里程/);
  const registrationMatch = text.match(/(20\d{2})年(\d{1,2})月首次上牌/);
  const driveMatch = text.match(/([^\s/]+)\s*\/\s*([0-9.]+[LT])档位\/排量/i);
  const cityMatch = text.match(/([\u4e00-\u9fff]{2,10})牌照所在地/);
  const transferMatch = text.match(/(\d+)次过户次数/);
  const yearMatch = sourceTitle.match(/(20\d{2})款/);
  const emissionMatch = text.match(/国(?:VI|V|IV|III|II|I)/i);
  const description = extractDescription(text);
  const photos = extractImages(html);

  const listingFacts = [];
  if (description?.includes("Суйфеньхэ")) {
    listingFacts.push({ label: "Местонахождение по описанию", text: "Продавец указывает наличие автомобиля в Суйфэньхэ.", status: "info" });
  }
  if (/第三方检测/.test(description || "")) {
    listingFacts.push({ label: "Сторонняя проверка", text: "В объявлении заявлена возможность проверки третьей стороной.", status: "info" });
  }
  if (/原版原漆|родная краска/i.test(description || "")) {
    listingFacts.push({ label: "Окраска", text: "Продавец заявляет заводскую окраску. Требуется подтверждение отчётом или осмотром.", status: "info" });
  }

  const extraSpecs = [];
  if (cityMatch?.[1]) extraSpecs.push({ label: "Регион регистрации", value: russianCity(cityMatch[1]) });
  if (emissionMatch?.[0]) extraSpecs.push({ label: "Экостандарт", value: emissionMatch[0].toUpperCase() });
  extraSpecs.push({ label: "Проверено в источнике", value: new Date().toISOString() });

  return {
    source_listing_id: listingId,
    title: identity.displayTitle || sourceTitle,
    brand: identity.brand,
    model: identity.model,
    trim: identity.trim || sourceTitle,
    year: yearMatch?.[1] || null,
    mileage_km: mileageMatch ? wanToInteger(mileageMatch[1]) : null,
    city: cityMatch ? russianCity(cityMatch[1]) : null,
    price_cny: priceMatch ? wanToInteger(priceMatch[1]) : null,
    body: inferBody(sourceTitle),
    energy_type: inferEnergyType(text, driveMatch?.[2]),
    engine: driveMatch?.[2] || null,
    transmission: driveMatch?.[1] || null,
    registration: registrationMatch ? `${String(registrationMatch[2]).padStart(2, "0")}.${registrationMatch[1]}` : null,
    transfers: transferMatch?.[1] || null,
    description,
    listing_facts: listingFacts,
    extra_specs: extraSpecs,
    photo_urls: photos,
    status: /询底价|在售\d+/.test(text) ? "active" : "unknown",
    source_url: url.href,
    source_dealer_id: dealerId,
    updated_at: null
  };
}

export class Che168PilotProvider {
  constructor({ url, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
    this.url = validateChe168ListingUrl(url).url.href;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async read() {
    if (typeof this.fetchImpl !== "function") throw new Error("fetch implementation is required");
    const response = await this.fetchImpl(this.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
        "user-agent": "AvtocheckPartnerPilot/0.1 (+authorized single-listing validation)"
      },
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) throw new Error(`Che168 returned HTTP ${response.status}`);
    const finalUrl = response.url || this.url;
    validateChe168ListingUrl(finalUrl);
    const html = await response.text();
    return [parseChe168ListingHtml(html, finalUrl)];
  }
}
