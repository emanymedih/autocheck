import test from "node:test";
import assert from "node:assert/strict";
import {
  Che168DealerInventoryProvider,
  inventoryUrlForDealer,
  parseChe168DealerInventoryHtml
} from "../src/providers/che168-dealer-inventory-provider.js";

const dealerId = "123615";

function detailHtml({ id, title = "奥迪A3 2024款 A3L Limousine 35 TFSI 时尚运动型", price = "15.88", mileage = "0.70" } = {}) {
  return `<!doctype html>
  <html><head><title>〖绍兴〗${title}_${price}万_二手车之家</title></head>
  <body>
    <h1>${title}</h1>
    <div>0次过户 ${price}万 （不包含过户费） 询底价</div>
    <div>${mileage}万公里表显里程</div>
    <div>2023年12月首次上牌</div>
    <div>自动/1.4L档位/排量</div>
    <div>绍兴牌照所在地</div>
    <div>0次过户次数</div>
    <div>国VI查询准迁地</div>
    <div>车辆描述 原版原漆！支持任何第三方检测！！ 联系我时</div>
    <div>在售2丨已售10</div>
    <img src="https://2sc2.autoimg.cn/escimg/test/${id}.jpg">
  </body></html>`;
}

function response(url, html, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    async text() { return html; }
  };
}

test("inventory parser finds listing links, pagination and advertised inventory count", () => {
  const html = `
    <div>在售 3</div>
    <a href="/dealer/${dealerId}/58736709.html?pvareaid=106453">A</a>
    <a href="https://s.che168.com/dealer/${dealerId}/58804670.html">B</a>
    <script>window.detail="/dealer/${dealerId}/58411120.html";</script>
    <a href="/dealer/carlist.html?dealerid=${dealerId}&page=2&pvareaid=106453">2</a>
  `;
  const parsed = parseChe168DealerInventoryHtml(html, {
    dealerId,
    pageUrl: inventoryUrlForDealer(dealerId)
  });

  assert.deepEqual(parsed.listingIds.sort(), ["58411120", "58736709", "58804670"]);
  assert.equal(parsed.advertisedInventoryCount, 3);
  assert.equal(parsed.pageUrls.some((url) => url.includes("page=2")), true);
});

test("dealer provider marks limited pilot import as incomplete snapshot", async () => {
  const startUrl = inventoryUrlForDealer(dealerId);
  const firstListing = `https://s.che168.com/dealer/${dealerId}/58736709.html`;
  const secondListing = `https://s.che168.com/dealer/${dealerId}/58804670.html`;
  const fetchImpl = async (url) => {
    const normalized = String(url);
    if (normalized.startsWith(startUrl)) {
      return response(normalized, `
        <div>在售2</div>
        <a href="${firstListing}">A</a>
        <a href="${secondListing}">B</a>
      `);
    }
    if (normalized.includes("58736709")) return response(normalized, detailHtml({ id: "58736709" }));
    if (normalized.includes("58804670")) return response(normalized, detailHtml({ id: "58804670", price: "14.28", mileage: "4.00" }));
    return response(normalized, "", 404);
  };

  const provider = new Che168DealerInventoryProvider({
    dealerId,
    fetchImpl,
    maxListings: 1,
    maxPages: 5,
    detailConcurrency: 1
  });
  const result = await provider.read();

  assert.equal(result.rows.length, 1);
  assert.equal(result.meta.discoveredListings, 2);
  assert.equal(result.meta.stoppedByListingLimit, true);
  assert.equal(result.meta.completeSnapshot, false);
});

test("dealer provider allows snapshot only when full advertised inventory is discovered and every detail succeeds", async () => {
  const startUrl = inventoryUrlForDealer(dealerId);
  const page2Url = `https://s.che168.com/dealer/carlist.html?dealerid=${dealerId}&page=2`;
  const firstListing = `https://s.che168.com/dealer/${dealerId}/58736709.html`;
  const secondListing = `https://s.che168.com/dealer/${dealerId}/58804670.html`;

  const fetchImpl = async (url) => {
    const normalized = String(url);
    if (normalized === startUrl) {
      return response(normalized, `
        <div>在售2</div>
        <a href="${firstListing}">A</a>
        <a href="${page2Url}">2</a>
      `);
    }
    if (normalized === page2Url) {
      return response(normalized, `
        <div>在售2</div>
        <a href="${secondListing}">B</a>
        <a href="${startUrl}">1</a>
      `);
    }
    if (normalized.includes("58736709")) return response(normalized, detailHtml({ id: "58736709" }));
    if (normalized.includes("58804670")) return response(normalized, detailHtml({ id: "58804670", price: "14.28", mileage: "4.00" }));
    return response(normalized, "", 404);
  };

  const provider = new Che168DealerInventoryProvider({
    dealerId,
    fetchImpl,
    maxPages: 5,
    detailConcurrency: 2
  });
  const result = await provider.read();

  assert.equal(result.rows.length, 2);
  assert.equal(result.meta.advertisedInventoryCount, 2);
  assert.equal(result.meta.completeDiscovery, true);
  assert.equal(result.meta.completeSnapshot, true);
  assert.deepEqual(result.rows.map((row) => row.source_listing_id).sort(), ["58736709", "58804670"]);
});
