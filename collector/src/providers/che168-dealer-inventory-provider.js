import { Che168PilotProvider } from "./che168-pilot-provider.js";

const HOST = "s.che168.com";
const DEFAULT_BASE = "https://s.che168.com";
const TRACKING_PARAMS = new Set(["pvareaid", "utm_source", "utm_medium", "utm_campaign", "ref", "from"]);

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function absoluteUrl(raw, baseUrl = DEFAULT_BASE) {
  try {
    const url = new URL(decodeEntities(raw), baseUrl);
    if (url.protocol !== "https:" || url.hostname !== HOST) return null;
    return url;
  } catch (_) {
    return null;
  }
}

function canonicalInventoryPageUrl(url, dealerId) {
  const next = new URL(url.href);
  next.hash = "";
  for (const key of [...next.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) next.searchParams.delete(key);
  }
  next.searchParams.set("dealerid", String(dealerId));
  next.searchParams.sort();
  return next.href;
}

function hrefsFromHtml(html) {
  const result = [];
  const source = String(html ?? "");
  const regex = /href\s*=\s*(["'])(.*?)\1/gi;
  let match;
  while ((match = regex.exec(source))) result.push(match[2]);
  return result;
}

function dealerCountFromHtml(html) {
  const text = String(html ?? "").replace(/<[^>]+>/g, " ");
  const patterns = [
    /在售\s*(\d+)/g,
    /共找到\s*(\d+)\s*辆/g,
    /共\s*(\d+)\s*辆/g
  ];
  const values = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const number = Number(match[1]);
      if (Number.isFinite(number)) values.push(number);
    }
  }
  return values.length ? Math.max(...values) : null;
}

function listingUrlsFromHtml(html, dealerId, baseUrl) {
  const listingById = new Map();
  const collect = (raw) => {
    const url = absoluteUrl(raw, baseUrl);
    if (!url) return;
    const match = url.pathname.match(new RegExp(`^/dealer/${dealerId}/(\\d+)\\.html$`));
    if (!match) return;
    const listingId = match[1];
    const canonical = new URL(`/dealer/${dealerId}/${listingId}.html`, DEFAULT_BASE);
    const pvareaid = url.searchParams.get("pvareaid");
    if (pvareaid) canonical.searchParams.set("pvareaid", pvareaid);
    listingById.set(listingId, canonical.href);
  };

  hrefsFromHtml(html).forEach(collect);

  const source = String(html ?? "");
  const inlineRegex = new RegExp(`(?:https?:)?//${HOST.replace(/\\./g, "\\.")}/dealer/${dealerId}/\\d+\\.html[^\"'<>\\s]*|/dealer/${dealerId}/\\d+\\.html[^\"'<>\\s]*`, "gi");
  (source.match(inlineRegex) || []).forEach(collect);

  return listingById;
}

export function inventoryUrlForDealer(dealerId) {
  if (!/^\d+$/.test(String(dealerId ?? ""))) throw new Error("dealerId must be numeric");
  const url = new URL("/dealer/carlist.html", DEFAULT_BASE);
  url.searchParams.set("dealerid", String(dealerId));
  return url.href;
}

export function parseChe168DealerInventoryHtml(html, { dealerId, pageUrl } = {}) {
  if (!/^\d+$/.test(String(dealerId ?? ""))) throw new Error("dealerId must be numeric");
  const baseUrl = pageUrl || inventoryUrlForDealer(dealerId);
  const listingById = listingUrlsFromHtml(html, dealerId, baseUrl);
  const pageUrls = new Set([canonicalInventoryPageUrl(new URL(baseUrl), dealerId)]);

  for (const rawHref of hrefsFromHtml(html)) {
    const url = absoluteUrl(rawHref, baseUrl);
    if (!url) continue;
    if (url.pathname !== "/dealer/carlist.html") continue;
    if (url.searchParams.get("dealerid") !== String(dealerId)) continue;
    pageUrls.add(canonicalInventoryPageUrl(url, dealerId));
  }

  return {
    dealerId: String(dealerId),
    listingUrls: [...listingById.values()],
    listingIds: [...listingById.keys()],
    pageUrls: [...pageUrls],
    advertisedInventoryCount: dealerCountFromHtml(html)
  };
}

async function fetchHtml(fetchImpl, url, timeoutMs) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
      "user-agent": "AvtocheckPartnerPilot/0.2 (+authorized dealer-inventory validation)"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Che168 returned HTTP ${response.status} for ${url}`);
  return {
    html: await response.text(),
    url: response.url || url
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export class Che168DealerInventoryProvider {
  constructor({
    dealerId,
    fetchImpl = globalThis.fetch,
    timeoutMs = 15000,
    maxPages = 40,
    detailConcurrency = 3,
    maxListings = null
  } = {}) {
    if (!/^\d+$/.test(String(dealerId ?? ""))) throw new Error("dealerId must be numeric");
    if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");
    this.dealerId = String(dealerId);
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxPages = Math.max(1, Number(maxPages) || 40);
    this.detailConcurrency = Math.max(1, Number(detailConcurrency) || 3);
    this.maxListings = maxListings === null ? null : Math.max(1, Number(maxListings) || 1);
  }

  async discover() {
    const startUrl = inventoryUrlForDealer(this.dealerId);
    const queue = [startUrl];
    const queued = new Set(queue);
    const visited = new Set();
    const listingUrls = new Map();
    const errors = [];
    let advertisedInventoryCount = null;
    let stoppedByListingLimit = false;

    while (queue.length && visited.size < this.maxPages) {
      if (this.maxListings !== null && listingUrls.size >= this.maxListings) {
        stoppedByListingLimit = true;
        break;
      }

      const requestedUrl = queue.shift();
      try {
        const { html, url } = await fetchHtml(this.fetchImpl, requestedUrl, this.timeoutMs);
        visited.add(requestedUrl);
        const parsed = parseChe168DealerInventoryHtml(html, { dealerId: this.dealerId, pageUrl: url });

        if (parsed.advertisedInventoryCount !== null) {
          advertisedInventoryCount = Math.max(advertisedInventoryCount || 0, parsed.advertisedInventoryCount);
        }

        parsed.listingIds.forEach((listingId, index) => {
          if (!listingUrls.has(listingId)) listingUrls.set(listingId, parsed.listingUrls[index]);
        });

        for (const pageUrl of parsed.pageUrls) {
          if (visited.has(pageUrl) || queued.has(pageUrl)) continue;
          queued.add(pageUrl);
          queue.push(pageUrl);
        }
      } catch (error) {
        visited.add(requestedUrl);
        errors.push({ scope: "inventory_page", url: requestedUrl, message: error.message });
      }
    }

    if (this.maxListings !== null && listingUrls.size >= this.maxListings) stoppedByListingLimit = true;

    const hitPageLimit = queue.length > 0 && visited.size >= this.maxPages;
    const discoveredListingUrls = [...listingUrls.values()];
    const countKnown = advertisedInventoryCount !== null;
    const countSatisfied = countKnown && discoveredListingUrls.length >= advertisedInventoryCount;
    const completeDiscovery =
      errors.length === 0 &&
      !hitPageLimit &&
      !stoppedByListingLimit &&
      countSatisfied;

    return {
      dealerId: this.dealerId,
      listingUrls: discoveredListingUrls,
      advertisedInventoryCount,
      pagesVisited: visited.size,
      pagesQueued: queued.size,
      completeDiscovery,
      stoppedByListingLimit,
      hitPageLimit,
      errors
    };
  }

  async read() {
    const discovery = await this.discover();
    const selectedUrls = this.maxListings === null
      ? discovery.listingUrls
      : discovery.listingUrls.slice(0, this.maxListings);
    const detailErrors = [];

    const rows = (await mapWithConcurrency(selectedUrls, this.detailConcurrency, async (url) => {
      try {
        const provider = new Che168PilotProvider({
          url,
          fetchImpl: this.fetchImpl,
          timeoutMs: this.timeoutMs
        });
        const [row] = await provider.read();
        return row || null;
      } catch (error) {
        detailErrors.push({ scope: "listing", url, message: error.message });
        return null;
      }
    })).filter(Boolean);

    const completeSnapshot =
      discovery.completeDiscovery &&
      detailErrors.length === 0 &&
      rows.length === discovery.listingUrls.length;

    return {
      rows,
      meta: {
        dealerId: this.dealerId,
        advertisedInventoryCount: discovery.advertisedInventoryCount,
        discoveredListings: discovery.listingUrls.length,
        selectedListings: selectedUrls.length,
        importedListings: rows.length,
        failedListings: detailErrors.length,
        pagesVisited: discovery.pagesVisited,
        completeDiscovery: discovery.completeDiscovery,
        completeSnapshot,
        stoppedByListingLimit: discovery.stoppedByListingLimit,
        hitPageLimit: discovery.hitPageLimit,
        errors: [...discovery.errors, ...detailErrors]
      }
    };
  }
}
