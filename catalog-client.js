(() => {
  const API_BASE = window.AVTOCHECK_CATALOG_API || "/api";
  const SESSION_KEY = "avtocheck-selected-vehicle";
  let liveVehicles = [];
  let captureBound = false;

  const nf = new Intl.NumberFormat("ru-RU");
  const formatPrice = (value) => Number.isFinite(Number(value)) ? `${nf.format(Number(value))} ¥` : "Цена уточняется";
  const formatMileage = (value) => Number.isFinite(Number(value)) ? `${nf.format(Number(value))} км` : "Пробег уточняется";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function safePhoto(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url, window.location.href);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
    } catch (_) {
      return null;
    }
  }

  function ensureStyles() {
    if (document.getElementById("liveCatalogStyles")) return;
    const style = document.createElement("style");
    style.id = "liveCatalogStyles";
    style.textContent = `
      .catalog-card-media img.catalog-live-photo{width:100%;height:100%;display:block;object-fit:cover}
      .catalog-card-media .catalog-live-placeholder{width:100%;height:100%;display:grid;place-items:center;background:var(--soft);color:var(--muted);font-size:12px;font-weight:750;letter-spacing:.02em}
      .catalog-live-state{display:inline-flex;align-items:center;gap:7px;margin:0 0 16px;color:var(--muted);font-size:11px}
      .catalog-live-state::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--brand)}
    `;
    document.head.appendChild(style);
  }

  function cardMarkup(vehicle) {
    const photo = safePhoto(vehicle.photos?.[0]);
    const media = photo
      ? `<img class="catalog-live-photo" src="${photo}" alt="${escapeHtml(vehicle.title || "Автомобиль")}" loading="lazy" decoding="async">`
      : `<div class="catalog-live-placeholder">Фотография ожидается</div>`;
    const meta = [vehicle.year, vehicle.mileage ? formatMileage(vehicle.mileage) : null, vehicle.city].filter(Boolean);

    return `<article class="catalog-card" data-vehicle-id="${escapeHtml(vehicle.id)}" data-live-vehicle="1" tabindex="0" aria-label="${escapeHtml(vehicle.title || "Автомобиль")}">
      <div class="catalog-card-media">${media}<span class="catalog-card-ready">Можно запросить отчёт</span></div>
      <div class="catalog-card-body">
        <h3>${escapeHtml(vehicle.title || [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Автомобиль")}</h3>
        <div class="catalog-card-meta">${meta.map((item) => `<span>${escapeHtml(String(item))}</span>`).join("")}</div>
        <div class="catalog-card-price">${formatPrice(vehicle.price)}</div>
        <div class="catalog-card-actions"><button class="catalog-card-request" type="button" data-request-report="${escapeHtml(vehicle.id)}">Запросить отчёт</button><button class="catalog-card-open" type="button" data-open-vehicle="${escapeHtml(vehicle.id)}" aria-label="Открыть карточку">→</button></div>
      </div>
    </article>`;
  }

  function replaceControl(id) {
    const current = document.getElementById(id);
    if (!current) return null;
    const clone = current.cloneNode(true);
    current.replaceWith(clone);
    return clone;
  }

  function openVehicle(id, request = false) {
    const vehicle = liveVehicles.find((item) => item.id === id);
    if (!vehicle) return;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...vehicle, entry: "catalog-api" })); } catch (_) {}
    const params = new URLSearchParams({ id: vehicle.id });
    if (request) params.set("action", "report");
    window.location.href = `vehicle.html?${params.toString()}`;
  }

  function bindCaptureNavigation() {
    if (captureBound) return;
    captureBound = true;

    document.addEventListener("click", (event) => {
      const card = event.target.closest?.(".catalog-card[data-live-vehicle='1']");
      if (!card) return;
      const request = event.target.closest?.("[data-request-report]");
      event.preventDefault();
      event.stopImmediatePropagation();
      openVehicle(card.dataset.vehicleId, Boolean(request));
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest?.(".catalog-card[data-live-vehicle='1']");
      if (!card || event.target.closest?.("button")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openVehicle(card.dataset.vehicleId, false);
    }, true);
  }

  function hydrateCatalog(items, updatedAt) {
    const root = document.getElementById("catalogRoot");
    if (!root || !items.length) return;
    liveVehicles = items;
    ensureStyles();
    bindCaptureNavigation();

    const search = replaceControl("catalogSearch");
    const city = replaceControl("catalogCity");
    const sort = replaceControl("catalogSort");
    const count = document.getElementById("catalogCount");

    const cities = [...new Set(items.map((vehicle) => vehicle.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
    if (city) city.innerHTML = `<option value="">Все города</option>${cities.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;

    const intro = document.querySelector(".catalog-page-intro");
    if (intro && !document.getElementById("catalogLiveState")) {
      const state = document.createElement("div");
      state.id = "catalogLiveState";
      state.className = "catalog-live-state";
      const date = updatedAt ? new Date(updatedAt) : null;
      state.textContent = date && !Number.isNaN(date.getTime()) ? `Каталог синхронизирован ${date.toLocaleString("ru-RU")}` : "Каталог загружен из базы Авточек";
      intro.after(state);
    }

    document.querySelector(".catalog-demo-note")?.remove();

    const draw = () => {
      const q = search?.value.trim().toLowerCase() || "";
      const selectedCity = city?.value || "";
      let filtered = items.filter((vehicle) => {
        const haystack = `${vehicle.title || ""} ${vehicle.brand || ""} ${vehicle.model || ""} ${vehicle.year || ""} ${vehicle.body || ""}`.toLowerCase();
        return (!q || haystack.includes(q)) && (!selectedCity || vehicle.city === selectedCity);
      });

      if (sort?.value === "price-asc") filtered = [...filtered].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      if (sort?.value === "price-desc") filtered = [...filtered].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
      if (sort?.value === "mileage") filtered = [...filtered].sort((a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity));
      if (!sort || sort.value === "year") filtered = [...filtered].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

      if (count) count.textContent = `Найдено: ${filtered.length}`;
      root.innerHTML = filtered.length ? filtered.map(cardMarkup).join("") : `<div class="catalog-grid-empty">По выбранным параметрам автомобилей пока нет.</div>`;
    };

    [search, city, sort].filter(Boolean).forEach((control) => control.addEventListener("input", draw));
    draw();

    const params = new URLSearchParams(window.location.search);
    const selected = params.get("car");
    if (selected && items.some((vehicle) => vehicle.id === selected)) openVehicle(selected, params.get("action") === "report");
  }

  async function load() {
    if (!document.getElementById("catalogRoot")) return;
    try {
      const response = await fetch(`${API_BASE}/vehicles?limit=500`, { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const payload = await response.json();
      if (!Array.isArray(payload.items) || !payload.items.length) return;
      hydrateCatalog(payload.items, payload.updatedAt);
    } catch (_) {
      // Static preview keeps the demo catalog as fallback.
    }
  }

  load();
})();
