import fs from "node:fs/promises";
import path from "node:path";

const TARGET = process.argv[2] || "https://www.seekauto.com/en/car/detail/SC043375C6Y08";
const OUTPUT = path.resolve(process.argv[3] || "data/seekauto-probe.json");
const KEYWORDS = /api|car|vehicle|listing|stock|search|detail|goods|inventory|jyt|seekauto/i;

function uniq(values, limit = 300) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function scriptSources(html, base) {
  const found = [];
  const regex = /<script\b[^>]*src\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  let match;
  while ((match = regex.exec(html))) {
    try { found.push(new URL(match[2], base).href); } catch (_) { /* ignore */ }
  }
  return uniq(found, 120);
}

function inlineScripts(html) {
  return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter(Boolean);
}

function candidates(text) {
  const urls = [];
  for (const match of text.matchAll(/https?:\\?\/\\?\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%\\-]+/g)) {
    const value = match[0].replace(/\\\//g, "/");
    if (KEYWORDS.test(value)) urls.push(value.slice(0, 500));
  }

  const paths = [];
  for (const match of text.matchAll(/["'`]((?:\\?\/)[A-Za-z0-9._~:@!$&()*+,;=%?{}\[\]\\/-]{3,220})["'`]/g)) {
    const value = match[1].replace(/\\\//g, "/");
    if (KEYWORDS.test(value)) paths.push(value);
  }

  const snippets = [];
  const tokens = ["baseURL", "axios", "fetch(", "carDetail", "carList", "vehicle", "inventory", "refNo", "api/"];
  for (const token of tokens) {
    let cursor = 0;
    const lower = text.toLowerCase();
    const needle = token.toLowerCase();
    while ((cursor = lower.indexOf(needle, cursor)) >= 0 && snippets.length < 120) {
      const start = Math.max(0, cursor - 140);
      const end = Math.min(text.length, cursor + token.length + 220);
      snippets.push(text.slice(start, end).replace(/\s+/g, " "));
      cursor += token.length;
    }
  }

  return { urls: uniq(urls), paths: uniq(paths), snippets: uniq(snippets, 120) };
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/javascript,text/javascript,*/*",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (compatible; AvtocheckIntegrationProbe/1.0)"
    },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return { text: await response.text(), url: response.url || url, contentType: response.headers.get("content-type") };
}

const startedAt = new Date().toISOString();
const page = await fetchText(TARGET);
const scripts = scriptSources(page.text, page.url);
const inline = inlineScripts(page.text);
const pageCandidates = candidates(page.text);
const assets = [];

for (const url of scripts.slice(0, 60)) {
  try {
    const loaded = await fetchText(url);
    const found = candidates(loaded.text);
    if (found.urls.length || found.paths.length || found.snippets.length) {
      assets.push({
        url,
        bytes: loaded.text.length,
        contentType: loaded.contentType,
        ...found
      });
    }
  } catch (error) {
    assets.push({ url, error: error.message });
  }
}

const inlineCandidates = inline.map((text, index) => ({ index, bytes: text.length, ...candidates(text) }))
  .filter((entry) => entry.urls.length || entry.paths.length || entry.snippets.length);

const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  target: TARGET,
  pageBytes: page.text.length,
  scripts,
  pageCandidates,
  inlineCandidates,
  assets
};
await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ scripts: scripts.length, inline: inline.length, interestingAssets: assets.length, output: OUTPUT }, null, 2));
