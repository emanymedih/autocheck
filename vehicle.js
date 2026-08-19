const VEHICLE_REFERENCE = {
  id: "cn-demo-003",
  title: "Audi A6L",
  brand: "Audi",
  model: "A6L",
  year: 2022,
  trim: "45 TFSI",
  city: "Линьи",
  price: 252800,
  currency: "CNY",
  registration: "03.2022",
  mileage: 29000,
  energyType: "Бензин",
  engine: "2.0T",
  transmission: "Автомат",
  body: "Седан",
  bodyColor: "Чёрный",
  interiorColor: "Тёмный",
  transfers: 1,
  vin: null,
  status: "active",
  listingPlatform: "Каталог Авточек",
  sellerName: null,
  description: "Демонстрационная карточка показывает, как Авточек собирает данные предложения в единую структуру.",
  listingFacts: [
    { label: "История владения", text: "В референсной карточке указано одно переоформление.", status: "info" },
    { label: "Обслуживание", text: "В описании заявлены сервисные записи.", status: "info" },
    { label: "Кузов", text: "В референсных данных указана замена правой передней двери.", status: "warning" }
  ],
  conditionChecks: [
    { label: "Силовая структура", text: "В референсной карточке серьёзные повреждения силовой структуры не заявлены.", status: "ok" },
    { label: "Проверка на затопление", text: "Перед покупкой требуется сверка с полным отчётом.", status: "info" },
    { label: "Проверка на пожар", text: "В референсном осмотре критические признаки не заявлены.", status: "ok" }
  ],
  features: ["Круговой обзор 360°", "Auto Hold", "Круиз-контроль", "Парктроники", "Голосовое управление"],
  extraSpecs: [{ label: "Привод", value: "Полный" }, { label: "Руль", value: "Левый" }],
  photos: [],
  photoCount: 15
};

const GALLERY_VIEWS = ["front", "side", "rear", "interior"];
const VEHICLE_SESSION_KEY = "avtocheck-selected-vehicle";
const VEHICLE_API_BASE = window.AVTOCHECK_CATALOG_API || "/api";
const nf = new Intl.NumberFormat("ru-RU");
let activeGalleryIndex = 0;
let activeVehicle = VEHICLE_REFERENCE;
let isLiveVehicle = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function safePhoto(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch (_) { return null; }
}

function photoCandidates(url) {
  const source = safePhoto(url);
  if (!source) return [];
  try {
    const parsed = new URL(source);
    const values = [];
    if (parsed.hostname.toLowerCase() === "img.jytche.com") {
      const normal = new URL(parsed.href);
      normal.searchParams.set("x-oss-process", "style/normal");
      values.push(normal.href);

      const raw = new URL(parsed.href);
      raw.search = "";
      values.push(raw.href);

      const thumb = new URL(parsed.href);
      thumb.searchParams.set("x-oss-process", "style/thumbnail");
      values.push(thumb.href);
    }
    values.push(source);
    return [...new Set(values)];
  } catch (_) {
    return [source];
  }
}

function formatPrice(value, currency = "CNY", priceText = "") {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return clean(priceText) || "Цена не раскрыта";
  const formatted = nf.format(Number(value));
  const code = clean(currency).toUpperCase();
  if (code === "USD") return `$${formatted}`;
  if (code === "EUR") return `€${formatted}`;
  if (code === "RUB") return `${formatted} ₽`;
  if (code === "CNY") return `${formatted} ¥`;
  return `${formatted} ${code}`.trim();
}

function formatMileage(value) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return null;
  return `${nf.format(Number(value))} км`;
}

function setText(id, value, fallback = "Уточняется") {
  const element = document.getElementById(id);
  if (element) element.textContent = value !== null && value !== undefined && value !== "" ? String(value) : fallback;
}

function extraSpec(vehicle, label) {
  const target = clean(label).toLocaleLowerCase("ru-RU");
  const item = Array.isArray(vehicle?.extraSpecs)
    ? vehicle.extraSpecs.find((entry) => clean(entry?.label).toLocaleLowerCase("ru-RU") === target)
    : null;
  return clean(item?.value);
}

function translateColor(value) {
  const source = clean(value);
  if (!source) return "";
  const normalized = source.toLowerCase();
  const map = [
    ["black", "Чёрный"], ["white", "Белый"], ["silver", "Серебристый"], ["gray", "Серый"], ["grey", "Серый"],
    ["blue", "Синий"], ["red", "Красный"], ["green", "Зелёный"], ["brown", "Коричневый"], ["beige", "Бежевый"],
    ["gold", "Золотистый"], ["orange", "Оранжевый"], ["yellow", "Жёлтый"], ["purple", "Фиолетовый"]
  ];
  const found = map.find(([key]) => normalized === key || normalized.includes(key));
  return found ? found[1] : source;
}

function translateTransmission(value) {
  const source = clean(value);
  if (!source) return "";
  if (/dual[- ]clutch|dct|双离合/i.test(source)) return "Робот";
  if (/cvt|continuously variable/i.test(source)) return "Вариатор";
  if (/single[- ]speed|electric vehicle single/i.test(source)) return "Одноступенчатая";
  if (/automatic|auto|\bat\b|manual shift mode/i.test(source)) return "Автомат";
  if (/manual|\bmt\b/i.test(source)) return "Механика";
  return source;
}

function translateDrive(value) {
  const source = clean(value);
  if (!source) return "";
  if (/all[- ]wheel|four[- ]wheel|awd|4wd/i.test(source)) return "Полный привод";
  if (/front[- ]wheel|fwd/i.test(source)) return "Передний привод";
  if (/rear[- ]wheel|rwd/i.test(source)) return "Задний привод";
  return source;
}

function translateSteering(value) {
  const source = clean(value);
  if (!source) return "";
  if (/^left$/i.test(source)) return "Левый";
  if (/^right$/i.test(source)) return "Правый";
  return source;
}

function compactEngine(value) {
  return clean(value).replace(/horsepower/gi, "л.с.").replace(/\bHP\b/gi, "л.с.").replace(/\s+/g, " ");
}

function platformName(vehicle) {
  const explicit = clean(vehicle?.listingPlatform || vehicle?.sourcePlatform || vehicle?.marketplace);
  if (explicit) return explicit;
  return isLiveVehicle ? "Autohome Global" : "Каталог Авточек";
}

function sellerLine(vehicle) {
  const seller = clean(vehicle?.sellerName);
  const city = clean(vehicle?.city);
  if (seller && city) return `${seller} · ${city}`;
  if (seller) return seller;
  if (city) return city;
  return "Международный каталог";
}

function vehicleVisual(view = "front", { main = false } = {}) {
  const labels = { front: "Основной ракурс", side: "Вид сбоку", rear: "Вид сзади", interior: "Интерьер" };
  const transform = view === "rear" ? "scale(-1 1) translate(-420 0)" : "";
  const shift = view === "side" ? 8 : 0;
  if (view === "interior") {
    return `<svg viewBox="0 0 420 260" role="img" aria-label="${labels[view]}"><defs><linearGradient id="interior-bg-${main ? "main" : "tile"}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#252b29"/><stop offset="1" stop-color="#69726d"/></linearGradient></defs><rect width="420" height="260" fill="url(#interior-bg-${main ? "main" : "tile"})"/><path d="M45 183c35-54 79-83 132-88h83c54 5 94 36 116 88v39H45z" fill="#151a18"/><path d="M126 93c24-22 52-33 85-33s62 11 86 33l-17 35H143z" fill="#50616a" opacity=".82"/><rect x="179" y="112" width="72" height="43" rx="5" fill="#101513" stroke="#8b9a92"/><circle cx="113" cy="163" r="32" fill="none" stroke="#919d97" stroke-width="8"/></svg>`;
  }
  return `<svg viewBox="0 0 420 260" role="img" aria-label="${labels[view]}"><defs><linearGradient id="car-${view}-${main ? "main" : "tile"}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151b1e"/><stop offset=".55" stop-color="#535f65"/><stop offset="1" stop-color="#a1aaad"/></linearGradient><linearGradient id="bg-${view}-${main ? "main" : "tile"}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1ef"/><stop offset="1" stop-color="#dfe5e1"/></linearGradient></defs><rect width="420" height="260" fill="url(#bg-${view}-${main ? "main" : "tile"})"/><ellipse cx="210" cy="208" rx="145" ry="17" fill="rgba(18,24,21,.13)"/><g transform="translate(${shift} 0) ${transform}"><path d="M64 169c8-34 32-53 70-63l35-9c18-5 34-31 62-33h58c29 0 45 19 66 51l11 18c32 7 49 21 54 47l2 16H54l10-27z" fill="url(#car-${view}-${main ? "main" : "tile"})" stroke="#27312d" stroke-width="3"/><path d="M164 102c20-10 32-28 62-30h49c22 2 36 15 56 48H136l28-18z" fill="#526b78" opacity=".74"/><circle cx="127" cy="191" r="30" fill="#1d2320"/><circle cx="337" cy="191" r="30" fill="#1d2320"/><circle cx="127" cy="191" r="13" fill="#aab3ae"/><circle cx="337" cy="191" r="13" fill="#aab3ae"/></g></svg>`;
}

function currentPhotos() {
  return Array.isArray(activeVehicle.photos) ? activeVehicle.photos.map(safePhoto).filter(Boolean) : [];
}

function photoMarkup(url, { index = 0 } = {}) {
  const candidates = photoCandidates(url);
  if (!candidates.length) return "";
  return `<img src="${escapeHtml(candidates[0])}" data-photo-candidates="${escapeHtml(JSON.stringify(candidates))}" alt="${escapeHtml(activeVehicle.title || "Автомобиль")}, фото ${index + 1}" decoding="async" referrerpolicy="no-referrer">`;
}

function installPhotoFallbacks(root) {
  root?.querySelectorAll?.("img[data-photo-candidates]").forEach((image) => {
    if (image.dataset.photoFallbackBound === "1") return;
    image.dataset.photoFallbackBound = "1";
    let candidates = [];
    try { candidates = JSON.parse(image.dataset.photoCandidates || "[]"); } catch (_) {}
    let index = Math.max(0, candidates.indexOf(image.src));
    image.addEventListener("error", () => {
      index += 1;
      if (index < candidates.length) {
        image.src = candidates[index];
        return;
      }
      image.style.visibility = "hidden";
    });
  });
}

function galleryLength() {
  const photos = currentPhotos();
  if (photos.length) return photos.length;
  return isLiveVehicle ? 1 : GALLERY_VIEWS.length;
}

function renderMainGalleryView(index) {
  const total = galleryLength();
  activeGalleryIndex = (index + total) % total;
  const main = document.getElementById("vehicleMainVisual");
  if (!main) return;
  const photos = currentPhotos();
  let content = "";
  if (photos.length) content = photoMarkup(photos[activeGalleryIndex], { index: activeGalleryIndex });
  else if (isLiveVehicle) content = `<div class="vehicle-gallery-empty vehicle-gallery-empty-main">Фотографии по этой машине пока не переданы</div>`;
  else content = vehicleVisual(GALLERY_VIEWS[activeGalleryIndex] || GALLERY_VIEWS[0], { main: true });
  const hasMultiple = photos.length > 1 || (!isLiveVehicle && GALLERY_VIEWS.length > 1);
  const photoCount = photos.length || (isLiveVehicle ? 0 : activeVehicle.photoCount || GALLERY_VIEWS.length);
  main.innerHTML = `${content}${hasMultiple ? `<button class="vehicle-gallery-nav prev" id="vehicleGalleryPrev" type="button" aria-label="Предыдущее фото">←</button><button class="vehicle-gallery-nav next" id="vehicleGalleryNext" type="button" aria-label="Следующее фото">→</button>` : ""}<span class="vehicle-gallery-counter">${photoCount ? `${activeGalleryIndex + 1} / ${photoCount}` : "Фото нет"}</span>`;
  installPhotoFallbacks(main);
  document.getElementById("vehicleGalleryPrev")?.addEventListener("click", () => renderMainGalleryView(activeGalleryIndex - 1));
  document.getElementById("vehicleGalleryNext")?.addEventListener("click", () => renderMainGalleryView(activeGalleryIndex + 1));
  document.querySelectorAll("[data-gallery-index]").forEach((tile) => tile.classList.toggle("is-active", Number(tile.dataset.galleryIndex) === activeGalleryIndex));
}

function installVehicleVisuals() {
  const photos = currentPhotos();
  const thumbs = document.getElementById("vehicleThumbnails");
  if (thumbs) {
    const sourceItems = photos.length ? photos : (isLiveVehicle ? [] : GALLERY_VIEWS);
    const visible = sourceItems.slice(0, 7);
    thumbs.hidden = sourceItems.length <= 1;
    thumbs.innerHTML = visible.map((item, index) => {
      const content = photos.length ? photoMarkup(item, { index }) : vehicleVisual(item);
      const more = index === visible.length - 1 && sourceItems.length > visible.length
        ? `<span class="vehicle-gallery-more-label">Ещё ${sourceItems.length - visible.length} фото</span>` : "";
      return `<button class="vehicle-gallery-tile ${index === 0 ? "is-active" : ""}" type="button" data-gallery-index="${index}" aria-label="Открыть фото ${index + 1}">${content}${more}</button>`;
    }).join("");
    installPhotoFallbacks(thumbs);
    thumbs.querySelectorAll("[data-gallery-index]").forEach((button) => button.addEventListener("click", () => renderMainGalleryView(Number(button.dataset.galleryIndex))));
  }
  renderMainGalleryView(0);
  const count = photos.length || (!isLiveVehicle ? activeVehicle.photoCount || GALLERY_VIEWS.length : 0);
  setText("vehiclePhotoCountLabel", count ? `${count} ${count === 1 ? "фотография" : "фотографий"}` : "Фотографии пока не переданы", "Фотографии пока не переданы");
  setText("vehicleGallerySourceLabel", isLiveVehicle ? `Фото: ${platformName(activeVehicle)}` : "Демонстрационная галерея", "Галерея Авточек");
}

function statusView(status) {
  if (status === "active") return { sale: "В продаже", availability: "Можно запросить отчёт", tone: "ready", disabled: false };
  if (status === "inactive") return { sale: "Снято с продажи", availability: "Заказ по карточке закрыт", tone: "inactive", disabled: true };
  return { sale: "Статус уточняется", availability: "Доступность отчёта проверим", tone: "unknown", disabled: false };
}

function renderOwnership(vehicle) {
  const root = document.getElementById("vehicleOwnershipList");
  if (!root) return;
  const rows = [
    ["Год выпуска", vehicle.year],
    ["Дата производства", extraSpec(vehicle, "Дата производства")],
    ["Пробег", formatMileage(vehicle.mileage)],
    ["Регистрация", vehicle.registration],
    ["Переоформления", vehicle.transfers],
    ["Город", vehicle.city]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  root.innerHTML = rows.length
    ? rows.map(([label, value]) => `<div class="vehicle-info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")
    : `<div class="vehicle-empty-state">Данные владения пока не переданы.</div>`;
}

function renderQuickSpecs(vehicle) {
  const root = document.getElementById("vehicleQuickSpecs");
  if (!root) return;
  const drive = translateDrive(extraSpec(vehicle, "Привод"));
  const steering = translateSteering(extraSpec(vehicle, "Руль"));
  const seats = extraSpec(vehicle, "Мест");
  const rows = [
    ["☷", "Комплектация", Array.isArray(vehicle.features) && vehicle.features.length ? `${vehicle.features.length} опций` : null],
    ["⌁", "Силовая установка", vehicle.energyType],
    ["⚙", "Двигатель", compactEngine(vehicle.engine)],
    ["⚡", "Мощность", extraSpec(vehicle, "Максимальная мощность")],
    ["⛽", "Топливо", extraSpec(vehicle, "Топливо")],
    ["⇄", "Коробка", translateTransmission(vehicle.transmission)],
    ["↔", "Привод", drive],
    ["◉", "Руль", steering],
    ["▱", "Кузов", vehicle.body],
    ["●", "Цвет", translateColor(vehicle.bodyColor)],
    ["○", "Мест", seats]
  ].filter(([, , value]) => value !== null && value !== undefined && value !== "");
  root.innerHTML = rows.length
    ? rows.map(([icon, label, value]) => `<div class="vehicle-quick-spec"><i class="vehicle-quick-icon" aria-hidden="true">${escapeHtml(icon)}</i><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div></div>`).join("")
    : `<div class="vehicle-empty-state">Характеристики пока не переданы.</div>`;
}

function renderSpecs(vehicle) {
  const root = document.getElementById("vehicleSpecGrid");
  if (!root) return;
  const specs = [
    ["Модель", vehicle.title || [vehicle.brand, vehicle.model].filter(Boolean).join(" ")],
    ["Год", vehicle.year],
    ["Пробег", formatMileage(vehicle.mileage)],
    ["Первая регистрация", vehicle.registration],
    ["Переоформлений", vehicle.transfers],
    ["Силовая установка", vehicle.energyType],
    ["Кузов", vehicle.body],
    ["Двигатель", compactEngine(vehicle.engine)],
    ["Коробка передач", translateTransmission(vehicle.transmission)],
    ["Цвет кузова", translateColor(vehicle.bodyColor)],
    ["Цвет салона", translateColor(vehicle.interiorColor)],
    ["Цена площадки", formatPrice(vehicle.price, vehicle.currency, vehicle.priceText)],
    ["FOB", vehicle.fobPriceText ? `≈ ${vehicle.fobPriceText}` : null],
    ["VIN", vehicle.vin],
    ["Площадка", platformName(vehicle)]
  ];
  if (Array.isArray(vehicle.extraSpecs)) {
    vehicle.extraSpecs.forEach((item) => {
      if (item?.label && item?.value) {
        let value = item.value;
        if (clean(item.label).toLocaleLowerCase("ru-RU") === "привод") value = translateDrive(value);
        if (clean(item.label).toLocaleLowerCase("ru-RU") === "руль") value = translateSteering(value);
        specs.push([item.label, value]);
      }
    });
  }
  const available = specs.filter(([, value]) => value !== null && value !== undefined && value !== "");
  root.innerHTML = available.length
    ? available.map(([label, value]) => `<div class="vehicle-spec"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")
    : `<div class="vehicle-empty-state">Характеристики по этой карточке пока не переданы.</div>`;
}

function detailIcon(status, index) {
  if (status === "ok" || status === "success") return "✓";
  if (status === "warning" || status === "danger") return "!";
  if (status === "info") return "i";
  return String(index + 1);
}

function renderDetailItems(rootId, items, emptyText) {
  const root = document.getElementById(rootId);
  if (!root) return;
  const valid = Array.isArray(items) ? items.filter((item) => item && (item.label || item.text)) : [];
  root.innerHTML = valid.length
    ? valid.map((item, index) => `<div class="vehicle-fact"><span class="vehicle-fact-icon ${escapeHtml(item.status || "")}">${detailIcon(item.status, index)}</span><div><strong>${escapeHtml(item.label || "Сведения")}</strong><span>${escapeHtml(item.text || "Уточняется")}</span></div></div>`).join("")
    : `<div class="vehicle-empty-state">${escapeHtml(emptyText)}</div>`;
}

function renderFeatures(features) {
  const root = document.getElementById("vehicleFeatures");
  if (!root) return;
  const valid = Array.isArray(features) ? features.filter(Boolean) : [];
  root.innerHTML = valid.length
    ? valid.map((feature) => `<span class="vehicle-feature">${escapeHtml(feature)}</span>`).join("")
    : `<div class="vehicle-empty-state">Данные об оснащении по этой карточке пока не переданы.</div>`;
}

function renderVehicle(vehicle, { live = false } = {}) {
  activeVehicle = {
    ...vehicle,
    photos: Array.isArray(vehicle.photos) ? vehicle.photos : [],
    listingFacts: Array.isArray(vehicle.listingFacts) ? vehicle.listingFacts : [],
    conditionChecks: Array.isArray(vehicle.conditionChecks) ? vehicle.conditionChecks : [],
    features: Array.isArray(vehicle.features) ? vehicle.features : [],
    extraSpecs: Array.isArray(vehicle.extraSpecs) ? vehicle.extraSpecs : []
  };
  isLiveVehicle = live;
  activeGalleryIndex = 0;
  const title = activeVehicle.title || [activeVehicle.brand, activeVehicle.model].filter(Boolean).join(" ") || "Автомобиль";
  document.title = `${title} — Авточек`;
  setText("vehicleBreadcrumbTitle", title, "Автомобиль");
  setText("vehicleTitle", title, "Автомобиль");
  setText("vehicleDataNote", live ? "Актуальное предложение из каталога" : "Демонстрационная карточка");
  const trimParts = [activeVehicle.trim, activeVehicle.energyType, activeVehicle.body].filter(Boolean);
  setText("vehicleTrim", trimParts.join(" · "), "Характеристики автомобиля");
  setText("vehiclePrice", formatPrice(activeVehicle.price, activeVehicle.currency, activeVehicle.priceText), "Цена уточняется");
  const contextParts = [];
  if (activeVehicle.fobPriceText) contextParts.push(`FOB ≈ ${activeVehicle.fobPriceText}`);
  if (activeVehicle.updatedAt) {
    const date = new Date(activeVehicle.updatedAt);
    if (!Number.isNaN(date.getTime())) contextParts.push(`обновлено ${date.toLocaleString("ru-RU")}`);
  }
  setText("vehiclePriceContext", contextParts.length ? `Цена площадки · ${contextParts.join(" · ")}` : "Цена площадки");
  setText("vehiclePlatform", platformName(activeVehicle), "Площадка продажи");
  setText("vehicleSeller", sellerLine(activeVehicle), "Международный каталог");
  setText("vehicleDescription", activeVehicle.description || "Характеристики, которые доступны по текущему предложению.");
  const status = statusView(activeVehicle.status);
  const availability = document.getElementById("vehicleAvailabilityChip");
  if (availability) availability.textContent = status.availability;
  const sale = document.getElementById("vehicleSaleStatusChip");
  if (sale) {
    sale.textContent = status.sale;
    sale.className = `vehicle-source-status ${status.tone === "ready" ? "" : status.tone}`.trim();
  }
  ["requestVehicleReport", "requestVehicleReportSecondary"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = status.disabled;
    button.textContent = status.disabled ? "Автомобиль снят с продажи" : "Запросить отчёт";
  });
  renderOwnership(activeVehicle);
  renderQuickSpecs(activeVehicle);
  renderSpecs(activeVehicle);
  renderDetailItems("vehicleFacts", activeVehicle.listingFacts, "Дополнительные сведения из карточки продажи пока не переданы.");
  renderDetailItems("vehicleCondition", activeVehicle.conditionChecks, "Результаты предварительного осмотра по этой карточке пока не переданы.");
  renderFeatures(activeVehicle.features);
  installVehicleVisuals();
}

function renderUnavailable(requestedId) {
  renderVehicle({ id: requestedId, title: "Автомобиль недоступен", status: "inactive", photos: [], listingFacts: [], conditionChecks: [], features: [], extraSpecs: [] }, { live: true });
  setText("vehicleDataNote", "Карточка отсутствует в текущем каталоге");
  const state = document.getElementById("vehicleRequestState");
  if (state) {
    state.hidden = false;
    state.textContent = "Карточка могла быть снята с продажи или временно отсутствовать в каталоге.";
  }
}

async function loadRequestedVehicle(requestedId) {
  if (!requestedId) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(VEHICLE_SESSION_KEY) || "null");
    if (saved?.id === requestedId && (saved?.title || saved?.brand || saved?.model)) return saved;
  } catch (_) {}
  try {
    const response = await fetch(`${VEHICLE_API_BASE}/vehicles/${encodeURIComponent(requestedId)}`, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.vehicle || payload.item || (payload.id ? payload : null);
  } catch (_) { return null; }
}

function openReportRequest() {
  const status = statusView(activeVehicle.status);
  const state = document.getElementById("vehicleRequestState");
  if (status.disabled) {
    if (state) {
      state.hidden = false;
      state.textContent = "Автомобиль снят с продажи. Новый заказ отчёта из этой карточки сейчас недоступен.";
    }
    return;
  }
  if (state) {
    state.hidden = false;
    state.innerHTML = `<strong>Автомобиль зафиксирован для проверки.</strong><br>Следующий шаг — проверить доступность отчёта и вернуть цену до оплаты.`;
    state.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  try { sessionStorage.setItem(VEHICLE_SESSION_KEY, JSON.stringify({ ...activeVehicle, entry: isLiveVehicle ? "catalog-api" : "vehicle-card" })); } catch (_) {}
}

async function initVehiclePage() {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  if (requestedId) {
    const requested = await loadRequestedVehicle(requestedId);
    if (requested) renderVehicle(requested, { live: true });
    else renderUnavailable(requestedId);
  } else renderVehicle(VEHICLE_REFERENCE, { live: false });
  document.getElementById("requestVehicleReport")?.addEventListener("click", openReportRequest);
  document.getElementById("requestVehicleReportSecondary")?.addEventListener("click", openReportRequest);
  if (params.get("action") === "report" && activeVehicle.status !== "inactive") requestAnimationFrame(openReportRequest);
}

initVehiclePage();
