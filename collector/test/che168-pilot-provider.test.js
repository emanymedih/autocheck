import test from "node:test";
import assert from "node:assert/strict";
import { parseChe168ListingHtml, validateChe168ListingUrl } from "../src/providers/che168-pilot-provider.js";
import { normalizeListing, toPublicVehicle } from "../src/normalizer.js";

const url = "https://s.che168.com/dealer/123615/58736709.html?pvareaid=106453";
const html = `<!doctype html>
<html><head><title>〖绍兴〗奥迪A3 2024款 A3L Limousine 35 TFSI 时尚运动型_15.88万_二手车之家</title></head>
<body>
<h1>奥迪A3 2024款 A3L Limousine 35 TFSI 时尚运动型</h1>
<div>0次过户 质保</div><div>15.88万 （不包含过户费） 询底价</div>
<section><h2>基本信息</h2>
<div>0.70万公里表显里程</div><div>2023年12月首次上牌</div><div>自动/1.4L档位/排量</div>
<div>绍兴牌照所在地</div><div>0次过户次数</div><div>国VI查询准迁地</div></section>
<section><h2>车辆描述</h2><p>Данный автомобиль может быть доставлен на всю террииорию России, машина в налчии в Суйфеньхэ, родная краска.</p><p>支持任何第三方检测！！</p></section>
<div>联系我时，请说明是在二手车之家看到的信息</div><div>在售252丨已售5107</div>
<img src="https://2sc2.autoimg.cn/escimg/g33/M06/DC/BA/one.jpg"><img src="//2sc2.autoimg.cn/escimg/g33/M0B/DC/BA/two.jpg">
</body></html>`;

test("validates a single Che168 detail URL", () => {
  const parsed = validateChe168ListingUrl(url);
  assert.equal(parsed.dealerId, "123615");
  assert.equal(parsed.listingId, "58736709");
  assert.throws(() => validateChe168ListingUrl("https://example.com/dealer/123/456.html"));
});

test("parses a live-card shaped Che168 document into canonical raw fields", () => {
  const raw = parseChe168ListingHtml(html, url);
  assert.equal(raw.source_listing_id, "58736709");
  assert.equal(raw.brand, "Audi");
  assert.equal(raw.model, "A3");
  assert.equal(raw.title, "Audi A3");
  assert.equal(raw.year, "2024");
  assert.equal(raw.price_cny, 158800);
  assert.equal(raw.mileage_km, 7000);
  assert.equal(raw.registration, "12.2023");
  assert.equal(raw.engine, "1.4L");
  assert.equal(raw.transmission, "自动");
  assert.equal(raw.city, "Шаосин");
  assert.equal(raw.transfers, "0");
  assert.equal(raw.energy_type, "汽油");
  assert.equal(raw.body, "轿车");
  assert.equal(raw.photo_urls.length, 2);
  assert.equal(raw.status, "active");
});

test("normalizer keeps source linkage private for the pilot card", () => {
  const raw = parseChe168ListingHtml(html, url);
  const vehicle = normalizeListing(raw, { providerId: "che168-pilot" });
  const publicVehicle = toPublicVehicle(vehicle);
  assert.equal(publicVehicle.brand, "Audi");
  assert.equal(publicVehicle.body, "Седан");
  assert.equal(publicVehicle.energyType, "Бензин");
  assert.equal("source" in publicVehicle, false);
  assert.equal(JSON.stringify(publicVehicle).includes("che168"), false);
});
