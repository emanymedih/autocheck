const VEHICLE_REFERENCE = {
  id: "cn-demo-003",
  title: "Audi A6L",
  year: 2022,
  trim: "45 TFSI",
  city: "Линьи",
  price: 252800,
  registration: "03.2022",
  engine: "2.0T",
  transmission: "Автомат",
  bodyColor: "Чёрный",
  interiorColor: "Тёмный",
  transfers: 1,
  reportAvailability: "unknown",
  photoCount: 15
};

const GALLERY_VIEWS = ["front", "side", "rear", "interior"];
const VEHICLE_SESSION_KEY = "avtocheck-selected-vehicle";
const VEHICLE_API_BASE = window.AVTOCHECK_CATALOG_API || "/api";
let activeGalleryIndex = 0;
let activeVehicle = VEHICLE_REFERENCE;
let isLiveVehicle = false;

function safePhoto(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch (_) { return null; }
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
  return `<img src="${safe}" alt="${activeVehicle.title || "Автомобиль"}, фото ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block" decoding="async">${main ? `<span class="vehicle-gallery-label">Фото ${index + 1}</span>` : ""}`;
}

function galleryLength() {
  const photos = currentPhotos();
  return photos.length || GALLERY_VIEWS.length;
}

function renderMainGalleryView(index) {
  const total = galleryLength();
  activeGalleryIndex = (index + total) % total;
  const main = document.getElementById("vehicleMainVisual");
  if (!main) return;

  const photos = currentPhotos();
  const content = photos.length
    ? photoMarkup(photos[activeGalleryIndex], { main: true, index: activeGalleryIndex })
    : vehicleVisual(GALLERY_VIEWS[activeGalleryIndex], { main: true });

  const prev = document.getElementById("vehicleGalleryPrev");
  const next = document.getElementById("vehicleGalleryNext");
  const photoCount = photos.length || activeVehicle.photoCount || total;
  main.innerHTML = `${content}${prev?.outerHTML || ""}${next?.outerHTML || ""}<span class="vehicle-gallery-counter" id="vehicleGalleryCounter">${activeGalleryIndex + 1} / ${photoCount}</span>`;

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
    const content = photos.length ? photoMarkup(photos[index], { index }) : vehicleVisual(GALLERY_VIEWS[index]);
    const moreLabel = id === "vehicleVisualFive" ? `<span class="vehicle-gallery-more-label">Все фото <strong>${photos.length || activeVehicle.photoCount || 15}</strong></span>` : "";
    target.innerHTML = `${content || vehicleVisual(GALLERY_VIEWS[index])}${moreLabel}`;
    target.onclick = () => renderMainGalleryView(index);
  });
  renderMainGalleryView(0);
}

function formatPrice(value) {
  return Number.isFinite(Number(value)) ? `${new Intl.NumberFormat("ru-RU").format(Number(value))} ¥` : "Цена уточняется";
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value !== null && value !== undefined && value !== "") element.textContent = String(value);
}

function applyLiveVehicle(vehicle) {
  activeVehicle = { ...vehicle, photoCount: vehicle.photos?.length || 0 };
  isLiveVehicle = true;
  document.title = `${vehicle.title || "Автомобиль"} — Авточек`;
  setText(".vehicle-breadcrumbs span:last-child", vehicle.title);
  setText(".vehicle-summary h1", vehicle.title);
  setText(".vehicle-trim", [vehicle.year, vehicle.trim].filter(Boolean).join(" · "));

  const price = document.querySelector(".vehicle-price");
  if (price) price.innerHTML = `${formatPrice(vehicle.price)} <small>цена в каталоге</small>`;

  const summaryValues = [vehicle.registration || "Уточняется", vehicle.city || "Уточняется", vehicle.engine || "Уточняется", vehicle.transmission || "Уточняется"];
  document.querySelectorAll(".vehicle-summary-grid strong").forEach((element, index) => { if (summaryValues[index]) element.textContent = summaryValues[index]; });

  const specValues = [vehicle.title || [vehicle.brand, vehicle.model].filter(Boolean).join(" "), vehicle.year, vehicle.registration || "Уточняется", vehicle.transfers ?? "Уточняется", vehicle.engine || "Уточняется", vehicle.transmission || "Уточняется", vehicle.bodyColor || "Уточняется", vehicle.interiorColor || "Уточняется", vehicle.vin || "Уточняется системой"];
  document.querySelectorAll(".vehicle-spec strong").forEach((element, index) => { if (specValues[index] !== undefined) element.textContent = String(specValues[index] ?? "Уточняется"); });

  const note = document.querySelector(".vehicle-demo-note");
  if (note) note.textContent = "Данные из каталога Авточек";

  const panels = document.querySelectorAll(".vehicle-main-column .vehicle-panel");
  [1, 2, 3].forEach((index) => { if (panels[index]) panels[index].hidden = true; });
  installVehicleVisuals();
}

async function loadRequestedVehicle() {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
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
  const state = document.getElementById("vehicleRequestState");
  if (state) {
    state.hidden = false;
    state.innerHTML = `<strong>Автомобиль зафиксирован для проверки.</strong><br>Следующий backend-шаг: проверить доступность отчёта и вернуть пользователю цену до оплаты.`;
    state.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  try {
    sessionStorage.setItem(VEHICLE_SESSION_KEY, JSON.stringify({ ...activeVehicle, entry: isLiveVehicle ? "catalog-api" : "vehicle-card" }));
  } catch (_) {}
}

async function initVehiclePage() {
  installVehicleVisuals();
  const requested = await loadRequestedVehicle();
  if (requested) applyLiveVehicle(requested);

  document.getElementById("requestVehicleReport")?.addEventListener("click", openReportRequest);
  document.getElementById("requestVehicleReportSecondary")?.addEventListener("click", openReportRequest);

  const params = new URLSearchParams(window.location.search);
  if (params.get("action") === "report") requestAnimationFrame(openReportRequest);
}

initVehiclePage();
