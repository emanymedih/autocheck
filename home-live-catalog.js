(() => {
  if (!document.querySelector('script[data-marketplace-header-loader]')) {
    const script = document.createElement("script");
    script.src = new URL("marketplace-header.js?v=20260825-2", document.baseURI).href;
    script.defer = true;
    script.dataset.marketplaceHeaderLoader = "1";
    document.head.appendChild(script);
  }
})();

(() => {
  const SNAPSHOT_URL = new URL("collector/data/global-public-catalog.json", document.baseURI).href;
  const SESSION_KEY = "avtocheck-selected-vehicle";
  const INITIAL_VISIBLE = 12;
  const LOAD_MORE_STEP = 8;
  const POPULAR_BRANDS_LIMIT = 12;
  const nf = new Intl.NumberFormat("ru-RU");

  let vehicles = [];
  let vehiclesById = new Map();
  let visibleCount = INITIAL_VISIBLE;

  function clean(value) {
    return String(value ?? "").trim();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[char]);
  }

  function safePhoto(value) {
    if (!value) return null;
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  function formatPrice(value, currency = "CNY", priceText = "") {
    const number = Number(value);
    if (!Number.isFinite(number)) return clean(priceText) || "Цена по запросу";
    const formatted = nf.format(number);
    const code = clean(currency).toUpperCase();
    if (code === "USD") return `$${formatted}`;
    if (code === "CNY") return `${formatted} ¥`;
    if (code === "EUR") return `€${formatted}`;
    if (code === "RUB") return `${formatted} ₽`;
    return `${formatted} ${code}`.trim();
  }

  function formatMileage(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${nf.format(number)} км` : null;
  }

  function catalogUrlForBrand(brand = "") {
    const url = new URL("cars.html", document.baseURI);
    if (brand) url.searchParams.set("brand", brand);
    url.searchParams.set("status", "active");
    url.searchParams.set("sort", "updated-desc");
    return `${url.pathname.split("/").pop()}${url.search}`;
  }

  function cardMarkup(vehicle) {
    const id = clean(vehicle?.id);
    const title = clean(vehicle?.title) || [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Автомобиль";
    const photo = safePhoto(vehicle?.photos?.[0]);
    const meta = [vehicle?.year || null, formatMileage(vehicle?.mileage), clean(vehicle?.city)].filter(Boolean);
    const media = `<div class="home-marketplace-photo-placeholder">Фотография ожидается</div>${photo ? `<img class="home-marketplace-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}`;

    return `<article class="home-marketplace-card" data-home-live-id="${escapeHtml(id)}" tabindex="0" aria-label="${escapeHtml(title)}">
      <div class="home-marketplace-media">${media}</div>
      <div class="home-marketplace-copy">
        <div class="home-marketplace-price">${escapeHtml(formatPrice(vehicle?.price, vehicle?.currency, vehicle?.priceText))}</div>
        <h3>${escapeHtml(title)}</h3>
        <div class="home-marketplace-meta">${meta.map((item) => `<span>${escapeHtml(String(item))}</span>`).join("")}</div>
      </div>
    </article>`;
  }

  function selectVehicles(items) {
    return (Array.isArray(items) ? items : [])
      .filter((vehicle) => vehicle?.status === "active" && vehicle?.id)
      .sort((a, b) => {
        const photoDiff = Number(Boolean(b?.photos?.[0])) - Number(Boolean(a?.photos?.[0]));
        if (photoDiff) return photoDiff;
        return String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || ""));
      });
  }

  function topBrands(items) {
    const counts = new Map();
    items.forEach((vehicle) => {
      const brand = clean(vehicle?.brand);
      if (!brand) return;
      counts.set(brand, (counts.get(brand) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
      .slice(0, POPULAR_BRANDS_LIMIT);
  }

  function renderPopularBrands() {
    const root = document.getElementById("popularBrands");
    if (!root) return;
    const brands = topBrands(vehicles);
    if (!brands.length) {
      root.innerHTML = `<span class="home-popular-brands-loading">Марки временно недоступны</span>`;
      return;
    }
    root.innerHTML = brands.map(([brand]) => `<a class="home-popular-brand" href="${escapeHtml(catalogUrlForBrand(brand))}"><span aria-hidden="true"></span><strong>${escapeHtml(brand)}</strong></a>`).join("");
  }

  function renderVehicles() {
    const grid = document.getElementById("vehicleGrid");
    const more = document.getElementById("homeMarketplaceMore");
    const loadMore = document.getElementById("homeLoadMore");
    if (!grid) return;

    const visible = vehicles.slice(0, visibleCount);
    grid.innerHTML = visible.length ? visible.map(cardMarkup).join("") : `<div class="home-live-error">Сейчас нет автомобилей, доступных для показа на главной.</div>`;

    const hasMore = visibleCount < vehicles.length;
    if (more) more.hidden = !hasMore;
    if (loadMore) loadMore.textContent = hasMore ? `Показать ещё` : "Все автомобили показаны";
  }

  function navigate(vehicle) {
    if (!vehicle?.id) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...vehicle, entry: "home-live-catalog" }));
    } catch (_) {}
    window.location.href = `vehicle.html?id=${encodeURIComponent(vehicle.id)}`;
  }

  function bindInteractions() {
    const grid = document.getElementById("vehicleGrid");
    const loadMore = document.getElementById("homeLoadMore");
    if (!grid) return;

    grid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-home-live-id]");
      if (!card) return;
      const vehicle = vehiclesById.get(card.dataset.homeLiveId);
      if (!vehicle) return;
      event.preventDefault();
      navigate(vehicle);
    });

    grid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-home-live-id]");
      if (!card) return;
      const vehicle = vehiclesById.get(card.dataset.homeLiveId);
      if (!vehicle) return;
      event.preventDefault();
      navigate(vehicle);
    });

    grid.addEventListener("error", (event) => {
      const image = event.target.closest?.(".home-marketplace-photo");
      if (image) image.remove();
    }, true);

    loadMore?.addEventListener("click", () => {
      visibleCount = Math.min(vehicles.length, visibleCount + LOAD_MORE_STEP);
      renderVehicles();
      const firstNewCard = grid.children[Math.max(0, visibleCount - LOAD_MORE_STEP)];
      firstNewCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function init() {
    const section = document.getElementById("cars-preview");
    const grid = document.getElementById("vehicleGrid");
    if (!section || !grid) return;

    section.classList.add("home-live-loading");

    try {
      const response = await fetch(SNAPSHOT_URL, {
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      if (!response.ok) throw new Error(`snapshot_http_${response.status}`);
      const payload = await response.json();
      vehicles = selectVehicles(payload.items);
      if (!vehicles.length) throw new Error("snapshot_has_no_active_vehicles");
      vehiclesById = new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle]));

      renderPopularBrands();
      renderVehicles();
      bindInteractions();
      section.classList.remove("home-live-loading");
      section.classList.add("home-live-ready");
    } catch (_) {
      section.classList.remove("home-live-loading");
      section.classList.add("home-live-error-state");
      const brands = document.getElementById("popularBrands");
      if (brands) brands.innerHTML = `<span class="home-popular-brands-loading">Марки временно недоступны</span>`;
      grid.innerHTML = `<div class="home-live-error">Не удалось загрузить текущие автомобили. Полный каталог доступен по ссылке «Все автомобили».</div>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(init), { once: true });
  } else {
    requestAnimationFrame(init);
  }
})();
