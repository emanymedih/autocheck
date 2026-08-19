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
  engine: "2.0T",
  transmission: "Автомат",
  body: "Седан",
  bodyColor: "Чёрный",
  interiorColor: "Тёмный",
  transfers: 1,
  vin: null,
  status: "active",
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
  extraSpecs: [],
  photos: [],
  photoCount: 15,
  reportAvailability: "unknown"
};

const GALLERY_VIEWS = ["front", "side", "rear", "interior"];
const VEHICLE_SESSION_KEY = "avtocheck-selected-vehicle";
const VEHICLE_API_BASE = window.AVTOCHECK_CATALOG_API || "/api";
let activeGalleryIndex = 0;
let activeVehicle = VEHICLE_REFERENCE;
let isLiveVehicle = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function safePhoto(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch (_) { return null; }
}

function formatPrice(value, currency = "CNY") {
  if (!Number.isFinite(Number(value))) return "Цена уточняется";
  const formatted = new Intl.NumberFormat("ru-RU").format(Number(value));
  return currency === "CNY" ? `${formatted} ¥` : `${formatted} ${currency || ""}`.trim();
}

function formatMileage(value) {
  return Number.isFinite(Number(value)) ? `${new Intl.NumberFormat("ru-RU").format(Number(value))} км` : null;
}

function setText(id, value, fallback = "Уточняется") {
  const element = document.getElementById(id);
  if (element) element.textContent = value !== null && value !== undefined && value !== "" ? String(value) : fallback;
}

function vehicleVisual(view = "front", { main = false } = {}) {
  const labels = { front: "Основной ракурс", side: "Вид сбоку", rear: "Вид сзади", interior: "Интерьер" };
  const transform = view === "rear" ? "scale(-1 1) translate(-420 0)" : "";
  const shift = view === "side" ? 8 : 0;

  if (view === "interior") {
    return `<svg viewBox="0 0 420 260" role="img" aria-label="${labels[view]}"><defs><linearGradient id="interior-bg-${main ? "main" : "tile"}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#252b29"/><stop offset="1" stop-color="#69726d"/></linearGradient></defs><rect width="420" height="260" fill="url(#interior-bg-${main ? "main" : "tile"})"/><path d="M45 183c35-54 79-83 132-88h83c54 5 94 36 116 88v39H45z" fill="#151a18"/><path d="M126 93c24-22 52-33 85-33s62 11 86 33l-17 35H143z" fill="#50616a" opacity=".82"/><rect x="179" y="112" width="72" height="43" rx="5" fill="#101513" stroke="#8b9a92"/><circle cx="113" cy="163" r="32" fill="none" stroke="#919d97" stroke-width="8"/><path d="M80 222h260" stroke="#88948e" stroke-width="3" opacity=".45"/></svg>${main ? `<span class="vehicle-gallery-label">${labels[view]}</span>` : ""}`;
  }

  return `<svg viewBox="0 0 420 260" role="img" aria-label="${labels[view]}"><defs><linearGradient id="car-${view}-${main ? "main" : "tile"}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151b1e"/><stop offset=".55" stop-color="#535f65"/><stop offset="1" stop-color="#a1aaad"/></linearGradient><linearGradient id="bg-${view}-${main ? "main" : "tile"}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1ef"/><stop offset="1" stop-color="#dfe5e1"/></linearGradient></defs><rect width="420" height="260" fill="url(#bg-${view}-${main ? "main" : "tile"})"/><ellipse cx="210" cy="208" rx="145" ry="17" fill="rgba(18,24,21,.13)"/><g transform="translate(${shift} 0) ${transform}"><path d="M64 169c8-34 32-53 70-63l35-9c18-5 34-31 62-33h58c29 0 45 19 66 51l11 18c32 7 49 21 54 47l2 16H54l10-27z" fill="url(#car-${view}-${main ? "main" : "tile"})" stroke="#27312d" stroke-width="3"/><path d="M164 102c20-10 32-28 62-30h49c22 2 36 15 56 48H136l28-18z" fill="#526b78" opacity=".74"/><circle cx="127" cy="191" r="30" fill="#1d2320"/><circle cx="337" cy="191" r="30" fill="#1d2320"/><circle cx="127" cy="191" r="13" fill="#aab3ae"/><circle cx="337" cy="191" r="13" fill="#aab3ae"/><path d="M362 145l39 10-8 17-38-6z" fill="#e2eee8" opacity=".9"/></g></svg>${main ? `<span class="vehicle-gallery-label">${labels[view]}</span>` : ""}`;
}

function currentPhotos() {
  return Array.isArray(activeVehicle.photos) ? activeVehicle.photos.map(safePhoto).filter(Boolean) : [];
}

function photoMarkup(url, { main = false, index = 0 } = {}) {
  const safe = safePhoto(url);
  if (!safe) return null;
  return `<img src="${safe}" alt="${escapeHtml(activeVehicle.title || "Автомобиль")}, фото ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block" decoding="async">${main ? `<span class="vehicle-gallery-label">Фото ${index + 1}</span>` : ""}`;
}

function galleryLength() {
  const photos = currentPhotos();
  if (isLiveVehicle) return Math.max(photos.length, 1);
  return GALLERY_VIEWS.length;
}

function renderMainGalleryView(index) {
  const total = galleryLength();
  activeGalleryIndex = (index + total) % total;
  const main = document.getElementById("vehicleMainVisual");
  if (!main) return;

  const photos = currentPhotos();
  let content;
  if (photos.length) {
    content = photoMarkup(photos[activeGalleryIndex], { main: true, index: activeGalleryIndex });
  } else if (isLiveVehicle) {
    content = `<div class="vehicle-gallery-empty vehicle-gallery-empty-main">Фотографии по этой машине пока не переданы</div>`;
  } else {
    content = vehicleVisual(GALLERY_VIEWS[activeGalleryIndex], { main: true });
  }

  const hasMultiple = photos.length > 1 || (!isLiveVehicle && GALLERY_VIEWS.length > 1);
  const photoCount = photos.length || (isLiveVehicle ? 0 : activeVehicle.photoCount || total);
  main.innerHTML = `${content}${hasMultiple ? `<button class="vehicle-gallery-nav prev" id="vehicleGalleryPrev" type="button" aria-label="Предыдущее фото">←</button><button class="vehicle-gallery-nav next" id="vehicleGalleryNext" type="button" aria-label="Следующее фото">→</button>` : ""}<span class="vehicle-gallery-counter" id="vehicleGalleryCounter">${photoCount ? `${activeGalleryIndex + 1} / ${photoCount}` : "Фото нет"}</span>`;

  document.getElementById("vehicleGalleryPrev")?.addEventListener("click", () => renderMainGalleryView(activeGalleryIndex - 1));
  document.getElementById("vehicleGalleryNext")?.addEventListener("click", () => renderMainGalleryView(activeGalleryIndex + 1));
  document.querySelectorAll("[data-gallery-index]").forEach((tile) => tile.classList.toggle("is-active", Number(tile.dataset.galleryIndex) === activeGalleryIndex));
}

function installVehicleVisuals() {
  const ids = ["vehicleVisualTwo", "vehicleVisualThree", "vehicleVisualFour", "vehicleVisualFive"];
  const photos = currentPhotos();

  ids.forEach((id, index) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.dataset.galleryIndex = String(index);
    const hasPhoto = Boolean(photos[index]);
    const content = hasPhoto
      ? photoMarkup(photos[index], { index })
      : (isLiveVehicle ? `<div class="vehicle-gallery-empty">${photos.length ? "Дополнительное фото отсутствует" : "Фото отсутствует"}</div>` : vehicleVisual(GALLERY_VIEWS[index]));
    const totalPhotos = photos.length || (!isLiveVehicle ? activeVehicle.photoCount || 15 : 0);
    const moreLabel = id === "vehicleVisualFive" && totalPhotos > 4 ? `<span class="vehicle-gallery-more-label">Все фото <strong>${totalPhotos}</strong></span>` : "";

    target.innerHTML = `${content}${moreLabel}`;
    target.disabled = isLiveVehicle && !hasPhoto;
    target.setAttribute("aria-label", hasPhoto ? `Открыть фото ${index + 1}` : "Фотография отсутствует");
    target.onclick = hasPhoto || !isLiveVehicle ? () => renderMainGalleryView(index) : null;
  });

  renderMainGalleryView(0);
  const count = photos.length || (!isLiveVehicle ? activeVehicle.photoCount || 15 : 0);
  setText("vehiclePhotoCountLabel", count ? `${count} ${count === 1 ? "фотография" : "фотографий"}` : "Фотографии пока не переданы", "Фотографии пока не переданы");
  setText("vehicleGallerySourceLabel", isLiveVehicle ? "Фотографии из каталога Авточек" : "Демонстрационная галерея", "Галерея Авточек");
}

function statusView(status) {
  if (status === "active") return { sale: "В продаже", availability: "Можно запросить отчёт", tone: "ready", disabled: false };
  if (status === "inactive") return { sale: "Снято с продажи", availability: "Заказ по карточке закрыт", tone: "inactive", disabled: true };
  return { sale: "Статус уточняется", availability: "Доступность отчёта проверим", tone: "unknown", disabled: false };
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
    ["Кузов", vehicle.body],
    ["Двигатель", vehicle.engine],
    ["Коробка передач", vehicle.transmission],
    ["Цвет кузова", vehicle.bodyColor],
    ["Цвет салона", vehicle.interiorColor],
    ["VIN", vehicle.vin]
  ];

  if (Array.isArray(vehicle.extraSpecs)) {
    vehicle.extraSpecs.forEach((item) => {
      if (item?.label && item?.value) specs.push([item.label, item.value]);
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
  setText("vehicleDataNote", live ? "Данные из каталога Авточек" : "Демонстрационная карточка на референсных данных");

  const trimParts = [activeVehicle.year, activeVehicle.trim, activeVehicle.body, formatMileage(activeVehicle.mileage)].filter(Boolean);
  setText("vehicleTrim", trimParts.join(" · "), "Характеристики уточняются");
  setText("vehiclePrice", formatPrice(activeVehicle.price, activeVehicle.currency), "Цена уточняется");

  if (activeVehicle.updatedAt) {
    const date = new Date(activeVehicle.updatedAt);
    setText("vehiclePriceContext", Number.isNaN(date.getTime()) ? "Актуальная цена из каталога Авточек" : `Обновлено ${date.toLocaleString("ru-RU")}`);
  } else {
    setText("vehiclePriceContext", live ? "Актуальная цена из каталога Авточек" : "Референсная цена предложения");
  }

  setText("vehicleRegistration", activeVehicle.registration);
  setText("vehicleCity", activeVehicle.city);
  setText("vehicleEngine", activeVehicle.engine);
  setText("vehicleTransmission", activeVehicle.transmission);
  setText("vehicleDescription", activeVehicle.description || "Характеристики, которые доступны по текущему предложению.");

  const status = statusView(activeVehicle.status);
  const availabilityChip = document.getElementById("vehicleAvailabilityChip");
  const saleChip = document.getElementById("vehicleSaleStatusChip");
  if (availabilityChip) {
    availabilityChip.textContent = status.availability;
    availabilityChip.className = `vehicle-chip ${status.tone}`;
  }
  if (saleChip) saleChip.textContent = status.sale;

  ["requestVehicleReport", "requestVehicleReportSecondary"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = status.disabled;
    button.textContent = status.disabled ? "Автомобиль снят с продажи" : "Запросить отчёт";
  });

  renderSpecs(activeVehicle);
  renderDetailItems("vehicleFacts", activeVehicle.listingFacts, "Дополнительные сведения из карточки продажи пока не переданы.");
  renderDetailItems("vehicleCondition", activeVehicle.conditionChecks, "Результаты предварительного осмотра по этой карточке пока не переданы.");
  renderFeatures(activeVehicle.features);
  installVehicleVisuals();
}

function renderUnavailable(requestedId) {
  renderVehicle({
    id: requestedId,
    title: "Автомобиль недоступен",
    status: "inactive",
    photos: [],
    listingFacts: [],
    conditionChecks: [],
    features: [],
    extraSpecs: []
  }, { live: true });
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
    if (saved?.id === requestedId && saved?.entry === "catalog-api") return saved;
  } catch (_) {}

  try {
    const response = await fetch(`${VEHICLE_API_BASE}/vehicles/${encodeURIComponent(requestedId)}`, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.vehicle || null;
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
    state.innerHTML = `<strong>Автомобиль зафиксирован для проверки.</strong><br>Следующий backend-шаг: проверить доступность отчёта и вернуть цену до оплаты.`;
    state.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  try {
    sessionStorage.setItem(VEHICLE_SESSION_KEY, JSON.stringify({ ...activeVehicle, entry: isLiveVehicle ? "catalog-api" : "vehicle-card" }));
  } catch (_) {}
}

async function initVehiclePage() {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");

  if (requestedId) {
    const requested = await loadRequestedVehicle(requestedId);
    if (requested) renderVehicle(requested, { live: true });
    else renderUnavailable(requestedId);
  } else {
    renderVehicle(VEHICLE_REFERENCE, { live: false });
  }

  document.getElementById("requestVehicleReport")?.addEventListener("click", openReportRequest);
  document.getElementById("requestVehicleReportSecondary")?.addEventListener("click", openReportRequest);
  if (params.get("action") === "report" && activeVehicle.status !== "inactive") requestAnimationFrame(openReportRequest);
}

initVehiclePage();
