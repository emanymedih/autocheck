import fs from "node:fs/promises";
import path from "node:path";

const TARGET_ID = process.argv[2] || "SC043375C6Y08";
const OUTPUT = path.resolve(process.argv[3] || "data/seekauto-probe.json");
const BASE = "https://www.seekauto.com";

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

function hydrationDetail(html) {
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
      return JSON.parse(objectText);
    } catch (_) {
      // Try another RSC chunk.
    }
  }
  return null;
}

async function request(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
        referer: `${BASE}/en/car/detail/${TARGET_ID}`,
        "user-agent": "Mozilla/5.0 (compatible; AvtocheckIntegrationProbe/1.0)"
      },
      signal: AbortSignal.timeout(20000)
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* keep text sample */ }
    return {
      url,
      status: response.status,
      contentType: response.headers.get("content-type"),
      bytes: text.length,
      json,
      textSample: json ? null : text.slice(0, 2000)
    };
  } catch (error) {
    return { url, error: error.message };
  }
}

const detailPage = await request(`${BASE}/en/car/detail/${TARGET_ID}`);
const pageHtml = detailPage.textSample || (detailPage.json ? JSON.stringify(detailPage.json) : "");
let html = "";
try {
  const response = await fetch(`${BASE}/en/car/detail/${TARGET_ID}`, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (compatible; AvtocheckIntegrationProbe/1.0)"
    },
    signal: AbortSignal.timeout(20000)
  });
  html = await response.text();
} catch (_) {
  html = pageHtml;
}

const proxyPaths = [
  `/api/proxy/cars/${TARGET_ID}/detail`,
  `/api/proxy/cars/${TARGET_ID}/recommends`,
  `/api/proxy/cars/${TARGET_ID}/fobPrice`,
  `/api/proxy/cars?limit=20&page=1`,
  `/api/proxy/cars/list?limit=20&page=1`,
  `/api/proxy/cars/search?limit=20&page=1`
];
const proxy = [];
for (const proxyPath of proxyPaths) proxy.push(await request(`${BASE}${proxyPath}`));

const report = {
  startedAt: new Date().toISOString(),
  targetId: TARGET_ID,
  pageBytes: html.length,
  hydration: hydrationDetail(html),
  proxy,
  finishedAt: new Date().toISOString()
};
await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
await fs.writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ targetId: TARGET_ID, hydration: Boolean(report.hydration), proxy: proxy.map((item) => ({ url: item.url, status: item.status, error: item.error || null, bytes: item.bytes || 0 })) }, null, 2));
