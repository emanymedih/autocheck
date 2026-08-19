(() => {
  const API_BASE = window.AVTOCHECK_CATALOG_API || "/api";
  const STATIC_SNAPSHOT_URL = "collector/data/global-public-catalog.json";
  const SESSION_KEY = "avtocheck-selected-vehicle";
  const PAGE_SIZE = 24;
  const CONTROL_IDS = [
    "catalogSearch",
    "catalogBrand",
    "catalogCity",
    "catalogBody",
    "catalogEngine",
    "catalogYearMin",
    "catalogYearMax",
    "catalogPriceMin",
    "catalogPriceMax",
    "catalogMileageMin",
    "catalogMileageMax",
    "catalogStatus",
    "catalogSort",
    "catalogReset"
  ];

  let controls = {};
  let baseOptions = { brands: [], bodies: [], engines: [] };
  let liveVehicles = [];
  let staticSnapshot = null;
  let sourceMode = null;
  let captureBound = false;
  let liveMode = false;
  let currentPage = 1;
  let requestSerial = 0;
  let debounceTimer = null;

  const nf = new Intl.NumberFormat("ru-RU");
  const formatPrice = (value, currency = "CNY") => {
    if (!Number.isFinite(Number(value))) return "Цена уточняется";
    const formatted = nf.format(Number(value));
    if (currency === "CNY") return `${formatted} ¥`;
    if (currency === "USD") return `$${formatted}`;
    if (currency === "EUR") return `€${formatted}`;
    if (currency === "RUB") return `${formatted} ₽`;
    return `${formatted} ${currency || ""}`.trim();
  };
  const formatMileage = (value) => Number.isFinite(Number(value)) ? `${nf.format(Number(value))} км` : "Пробег уточняется";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function lower(value) {
    return text(value).toLocaleLowerCase("ru-RU");
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
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

  function statusLabel(status) {
    if (status === "active") return "В продаже";
    if (status === "inactive") return "Снято с продажи";
    return "Статус уточняется";
  }

  function ensureStyles() {
    if (document.getElementById("liveCatalogStyles")) return;
    const style = document.createElement("style");
    style.id = "liveCatalogStyles";
    style.textContent = `
      .catalog-filter-panel{display:grid;gap:10px;margin-bottom:18px}
      .catalog-page .catalog-toolbar{margin-bottom:0}
      .catalog-page .catalog-toolbar-primary{grid-template-columns:minmax(280px,1.5fr) repeat(3,minmax(150px,.7fr))}
      .catalog-page .catalog-toolbar-secondary{grid-template-columns:repeat(5,minmax(125px,1fr));align-items:center}
      .catalog-filter-reset{min-height:44px;border:1px solid var(--line);border-radius:8px;background:var(--page);color:var(--text);padding:0 13px;font-weight:750;cursor:pointer}
      .catalog-filter-reset:hover{border-color:var(--brand);color:var(--brand)}
      .catalog-card-media img.catalog-live-photo{width:100%;height:100%;display:block;object-fit:cover}
      .catalog-card-media .catalog-live-placeholder{width:100%;height:100%;display:grid;place-items:center;background:var(--soft);color:var(--muted);font-size:12px;font-weight:750;letter-spacing:.02em}
      .catalog-card-status{position:absolute;right:12px;bottom:12px;padding:6px 9px;border-radius:999px;color:#fff;font-size:9px;font-weight:800;background:rgba(34,81,63,.92)}
      .catalog-card-status.inactive{background:rgba(93,98,95,.92)}
      .catalog-card-status.unknown{background:rgba(151,113,46,.94)}
      .catalog-card-request[disabled]{cursor:default;opacity:.5}
      .catalog-live-state{display:inline-flex;align-items:center;gap:7px;margin:0 0 16px;color:var(--muted);font-size:11px}
      .catalog-live-state::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--brand)}
      .catalog-results-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px}
      .catalog-results-head .catalog-count,.catalog-page-summary{margin:0;color:var(--muted);font-size:11px}
      .catalog-pagination{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:32px}
      .catalog-pagination[hidden]{display:none}
      .catalog-page-button{min-width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--line);border-radius:8px;background:var(--page);color:var(--text);cursor:pointer;font-size:11px;font-weight:750}
      .catalog-page-button:hover{border-color:var(--brand);color:var(--brand)}
      .catalog-page-button.is-current{border-color:var(--brand);background:var(--brand);color:#fff}
      .catalog-page-button[disabled]{cursor:default;opacity:.4}
      .catalog-loading{grid-column:1/-1;padding:42px;border:1px solid var(--line);border-radius:14px;text-align:center;color:var(--muted);font-size:12px}
      @media(max-width:1040px){.catalog-page .catalog-toolbar-primary{grid-template-columns:repeat(2,minmax(0,1fr))}.catalog-page .catalog-toolbar-secondary{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:760px){.catalog-page .catalog-toolbar-primary,.catalog-page .catalog-toolbar-secondary{grid-template-columns:1fr}.catalog-results-head{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function cardMarkup(vehicle) {
    const photo = safePhoto(vehicle.photos?.[0]);
    const media = photo
      ? `<img class="catalog-live-photo" src="${photo}" alt="${escapeHtml(vehicle.title || "Автомобиль")}" loading="lazy" decoding="async">`
      : `<div class="catalog-live-placeholder">Фотография ожидается</div>`;
    const meta = [vehicle.year, vehicle.energyType, vehicle.mileage !== null && vehicle.mileage !== undefined ? formatMileage(vehicle.mileage) : null, vehicle.city].filter(Boolean);
    const active = vehicle.status === "active";

    return `<article class="catalog-card" data-vehicle-id="${escapeHtml(vehicle.id)}" data-live-vehicle="1" tabindex="0" aria-label="${escapeHtml(vehicle.title || "Автомобиль")}">
      <div class="catalog-card-media">${media}<span class="catalog-card-status ${escapeHtml(vehicle.status || "unknown")}">${escapeHtml(statusLabel(vehicle.status))}</span></div>
      <div class="catalog-card-body">
        <h3>${escapeHtml(vehicle.title || [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Автомобиль")}</h3>
        <div class="catalog-card-meta">${meta.map((item) => `<span>${escapeHtml(String(item))}</span>`).join("")}</div>
        <div class="catalog-card-price">${formatPrice(vehicle.price, vehicle.currency)}</div>
        <div class="catalog-card-actions"><button class="catalog-card-request" type="button" data-request-report="${escapeHtml(vehicle.id)}" ${active ? "" : "disabled"}>${active ? "Запросить отчёт" : "Недоступно для заказа"}</button><button class="catalog-card-open" type="button" data-open-vehicle="${escapeHtml(vehicle.id)}" aria-label="Открыть карточку">→</button></div>
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

  function optionValues(select) {
    if (!select) return [];
    return [...select.options].map((option) => option.value).filter(Boolean);
  }

  function collectControls() {
    CONTROL_IDS.forEach((id) => { controls[id] = replaceControl(id); });
    baseOptions = {
      brands: optionValues(controls.catalogBrand),
      bodies: optionValues(controls.catalogBody),
      engines: optionValues(controls.catalogEngine)
    };
  }

  function openVehicle(id, request = false) {
    const vehicle = liveVehicles.find((item) => item.id === id);
    if (!vehicle) return;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...vehicle, entry: sourceMode === "snapshot" ? "catalog-snapshot" : "catalog-api" })); } catch (_) {}
    const params = new URLSearchParams({ id: vehicle.id });
    if (request && vehicle.status === "active") params.set("action", "report");
    window.location.href = `vehicle.html?${params.toString()}`;
  }

  function bindCaptureNavigation() {
    if (captureBound) return;
    captureBound = true;

    document.addEventListener("click", (event) => {
      const card = event.target.closest?.(".catalog-card[data-live-vehicle='1']");
      if (!card) return;
      const request = event.target.closest?.("[data-request-report]");
      if (request?.disabled) return;
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

  function optionList(values, firstLabel) {
    return `<option value="">${escapeHtml(firstLabel)}</option>${(values || []).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  }

  function uniqueSorted(values) {
    return [...new Set(values.map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  }

  function numericRange(values) {
    const numbers = values.map(finiteNumber).filter((value) => value !== null);
    return numbers.length ? { min: Math.min(...numbers), max: Math.max(...numbers) } : { min: null, max: null };
  }

  function setSelectOptions(select, values, firstLabel, preferredValue = "") {
    if (!select) return;
    select.innerHTML = optionList(values, firstLabel);
    if (preferredValue && values?.includes(preferredValue)) select.value = preferredValue;
  }

  function applyFacets(facets) {
    const url = new URL(window.location.href);
    setSelectOptions(controls.catalogBrand, facets.brands, "Все марки", url.searchParams.get("brand") || "");
    setSelectOptions(controls.catalogCity, facets.cities, "Все города", url.searchParams.get("city") || "");
    setSelectOptions(controls.catalogBody, facets.bodies, "Все кузова", url.searchParams.get("body") || "");
    setSelectOptions(controls.catalogEngine, facets.engines, "Любая силовая установка", url.searchParams.get("engine") || "");

    if (controls.catalogYearMin && facets.year?.min !== null) controls.catalogYearMin.min = String(facets.year.min);
    if (controls.catalogYearMax && facets.year?.max !== null) controls.catalogYearMax.max = String(facets.year.max);
    if (controls.catalogPriceMin && facets.price?.min !== null) controls.catalogPriceMin.min = String(facets.price.min);
    if (controls.catalogPriceMax && facets.price?.max !== null) controls.catalogPriceMax.max = String(facets.price.max);
    if (controls.catalogMileageMin && facets.mileage?.min !== null) controls.catalogMileageMin.min = String(facets.mileage.min);
    if (controls.catalogMileageMax && facets.mileage?.max !== null) controls.catalogMileageMax.max = String(facets.mileage.max);

    if (controls.catalogStatus && facets.statusCounts) {
      const labels = {
        active: `В продаже (${facets.statusCounts.active || 0})`,
        all: `Все статусы (${(facets.statusCounts.active || 0) + (facets.statusCounts.inactive || 0) + (facets.statusCounts.unknown || 0)})`,
        inactive: `Снято с продажи (${facets.statusCounts.inactive || 0})`,
        unknown: `Статус уточняется (${facets.statusCounts.unknown || 0})`
      };
      [...controls.catalogStatus.options].forEach((option) => { if (labels[option.value]) option.textContent = labels[option.value]; });
    }
  }

  function staticFacets(items) {
    const active = items.filter((vehicle) => vehicle.status === "active");
    const source = active.length ? active : items;
    const statusCounts = items.reduce((acc, vehicle) => {
      const key = vehicle.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      brands: uniqueSorted([...baseOptions.brands, ...source.map((vehicle) => vehicle.brand)]),
      cities: uniqueSorted(source.map((vehicle) => vehicle.city)),
      bodies: uniqueSorted([...baseOptions.bodies, ...source.map((vehicle) => vehicle.body)]),
      engines: uniqueSorted([...baseOptions.engines, ...source.map((vehicle) => vehicle.energyType)]),
      year: numericRange(source.map((vehicle) => vehicle.year)),
      price: numericRange(source.map((vehicle) => vehicle.price)),
      mileage: numericRange(source.map((vehicle) => vehicle.mileage)),
      statusCounts: {
        active: statusCounts.active || 0,
        inactive: statusCounts.inactive || 0,
        unknown: statusCounts.unknown || 0
      }
    };
  }

  function updatePricePlaceholders(items) {
    const currencies = uniqueSorted(items.map((vehicle) => vehicle.currency));
    const symbols = { CNY: "¥", USD: "$", EUR: "€", RUB: "₽" };
    const suffix = currencies.length === 1 ? `, ${symbols[currencies[0]] || currencies[0]}` : "";
    if (controls.catalogPriceMin) controls.catalogPriceMin.placeholder = `Цена от${suffix}`;
    if (controls.catalogPriceMax) controls.catalogPriceMax.placeholder = `Цена до${suffix}`;
  }

  function restoreFiltersFromUrl() {
    const params = new URL(window.location.href).searchParams;
    const mapping = {
      catalogSearch: "q",
      catalogBrand: "brand",
      catalogCity: "city",
      catalogBody: "body",
      catalogEngine: "engine",
      catalogYearMin: "year_min",
      catalogYearMax: "year_max",
      catalogPriceMin: "price_min",
      catalogPriceMax: "price_max",
      catalogMileageMin: "mileage_min",
      catalogMileageMax: "mileage_max",
      catalogStatus: "status",
      catalogSort: "sort"
    };

    Object.entries(mapping).forEach(([id, key]) => {
      const value = params.get(key);
      if (value && controls[id]) controls[id].value = value;
    });
    currentPage = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  }

  function buildQuery(page = currentPage) {
    const params = new URLSearchParams();
    const values = [
      ["q", controls.catalogSearch?.value.trim()],
      ["brand", controls.catalogBrand?.value],
      ["city", controls.catalogCity?.value],
      ["body", controls.catalogBody?.value],
      ["engine", controls.catalogEngine?.value],
      ["year_min", controls.catalogYearMin?.value],
      ["year_max", controls.catalogYearMax?.value],
      ["price_min", controls.catalogPriceMin?.value],
      ["price_max", controls.catalogPriceMax?.value],
      ["mileage_min", controls.catalogMileageMin?.value],
      ["mileage_max", controls.catalogMileageMax?.value],
      ["status", controls.catalogStatus?.value || "active"],
      ["sort", controls.catalogSort?.value || "updated-desc"]
    ];
    values.forEach(([key, value]) => { if (value !== null && value !== undefined && value !== "") params.set(key, value); });
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    return params;
  }

  function syncUrl(params) {
    const url = new URL(window.location.href);
    [...url.searchParams.keys()].forEach((key) => url.searchParams.delete(key));
    params.forEach((value, key) => {
      if (key !== "page_size") url.searchParams.set(key, value);
    });
    if (url.searchParams.get("page") === "1") url.searchParams.delete("page");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function pageNumbers(page, totalPages) {
    const pages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
    return [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  }

  function renderPagination(payload) {
    const root = document.getElementById("catalogPagination");
    if (!root) return;
    const totalPages = Math.max(1, Number(payload.totalPages || 1));
    if (totalPages <= 1) {
      root.hidden = true;
      root.innerHTML = "";
      return;
    }

    const pages = pageNumbers(payload.page, totalPages);
    let previous = 0;
    const numberButtons = pages.map((page) => {
      const gap = previous && page - previous > 1 ? `<span class="catalog-page-gap">…</span>` : "";
      previous = page;
      return `${gap}<button class="catalog-page-button ${page === payload.page ? "is-current" : ""}" type="button" data-catalog-page="${page}" ${page === payload.page ? "aria-current=\"page\"" : ""}>${page}</button>`;
    }).join("");

    root.innerHTML = `<button class="catalog-page-button" type="button" data-catalog-page="${payload.page - 1}" ${payload.hasPrevious ? "" : "disabled"} aria-label="Предыдущая страница">←</button>${numberButtons}<button class="catalog-page-button" type="button" data-catalog-page="${payload.page + 1}" ${payload.hasNext ? "" : "disabled"} aria-label="Следующая страница">→</button>`;
    root.hidden = false;
  }

  function updateLiveState(updatedAt) {
    const intro = document.querySelector(".catalog-page-intro");
    if (!intro) return;
    let state = document.getElementById("catalogLiveState");
    if (!state) {
      state = document.createElement("div");
      state.id = "catalogLiveState";
      state.className = "catalog-live-state";
      intro.after(state);
    }
    const date = updatedAt ? new Date(updatedAt) : null;
    state.textContent = date && !Number.isNaN(date.getTime())
      ? `Каталог Авточек обновлён ${date.toLocaleString("ru-RU")}`
      : "Каталог Авточек загружен";
  }

  function renderPayload(payload) {
    const root = document.getElementById("catalogRoot");
    const count = document.getElementById("catalogCount");
    const summary = document.getElementById("catalogPageSummary");
    if (!root) return;

    liveVehicles = Array.isArray(payload.items) ? payload.items : [];
    if (count) count.textContent = `Найдено: ${payload.total || 0}`;
    if (summary) {
      const from = payload.total ? (payload.page - 1) * payload.pageSize + 1 : 0;
      const to = Math.min(payload.total || 0, payload.page * payload.pageSize);
      summary.textContent = payload.total ? `Показано ${from}–${to} · страница ${payload.page} из ${payload.totalPages}` : "";
    }

    root.innerHTML = liveVehicles.length
      ? liveVehicles.map(cardMarkup).join("")
      : `<div class="catalog-grid-empty">По выбранным параметрам автомобилей пока нет.</div>`;
    renderPagination(payload);
    updateLiveState(payload.updatedAt);
  }

  function compareNullableNumbers(a, b, direction = 1) {
    const left = finiteNumber(a);
    const right = finiteNumber(b);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * direction;
  }

  function staticPayload(items, params, updatedAt) {
    let result = [...items];
    const status = params.get("status") || "active";
    const brand = params.get("brand") || "";
    const city = params.get("city") || "";
    const body = params.get("body") || "";
    const engine = lower(params.get("engine"));
    const q = lower(params.get("q"));
    const yearMin = finiteNumber(params.get("year_min"));
    const yearMax = finiteNumber(params.get("year_max"));
    const priceMin = finiteNumber(params.get("price_min"));
    const priceMax = finiteNumber(params.get("price_max"));
    const mileageMin = finiteNumber(params.get("mileage_min"));
    const mileageMax = finiteNumber(params.get("mileage_max"));
    const sort = params.get("sort") || "updated-desc";
    const pageSize = Math.max(1, Number.parseInt(params.get("page_size") || String(PAGE_SIZE), 10) || PAGE_SIZE);
    const requestedPage = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);

    if (status !== "all") result = result.filter((vehicle) => (vehicle.status || "unknown") === status);
    if (brand) result = result.filter((vehicle) => vehicle.brand === brand);
    if (city) result = result.filter((vehicle) => vehicle.city === city);
    if (body) result = result.filter((vehicle) => vehicle.body === body);
    if (engine) {
      result = result.filter((vehicle) => {
        const energyType = lower(vehicle.energyType);
        const engineValue = lower(vehicle.engine);
        return energyType === engine || energyType.includes(engine) || engineValue.includes(engine);
      });
    }
    if (yearMin !== null) result = result.filter((vehicle) => finiteNumber(vehicle.year) !== null && finiteNumber(vehicle.year) >= yearMin);
    if (yearMax !== null) result = result.filter((vehicle) => finiteNumber(vehicle.year) !== null && finiteNumber(vehicle.year) <= yearMax);
    if (priceMin !== null) result = result.filter((vehicle) => finiteNumber(vehicle.price) !== null && finiteNumber(vehicle.price) >= priceMin);
    if (priceMax !== null) result = result.filter((vehicle) => finiteNumber(vehicle.price) !== null && finiteNumber(vehicle.price) <= priceMax);
    if (mileageMin !== null) result = result.filter((vehicle) => finiteNumber(vehicle.mileage) !== null && finiteNumber(vehicle.mileage) >= mileageMin);
    if (mileageMax !== null) result = result.filter((vehicle) => finiteNumber(vehicle.mileage) !== null && finiteNumber(vehicle.mileage) <= mileageMax);
    if (q) {
      result = result.filter((vehicle) => lower([
        vehicle.title,
        vehicle.brand,
        vehicle.model,
        vehicle.trim,
        vehicle.body,
        vehicle.energyType,
        vehicle.engine,
        vehicle.city
      ].filter(Boolean).join(" ")).includes(q));
    }

    if (sort === "year-desc") result.sort((a, b) => compareNullableNumbers(a.year, b.year, -1));
    if (sort === "year-asc") result.sort((a, b) => compareNullableNumbers(a.year, b.year, 1));
    if (sort === "price-asc") result.sort((a, b) => compareNullableNumbers(a.price, b.price, 1));
    if (sort === "price-desc") result.sort((a, b) => compareNullableNumbers(a.price, b.price, -1));
    if (sort === "mileage-asc") result.sort((a, b) => compareNullableNumbers(a.mileage, b.mileage, 1));
    if (sort === "mileage-desc") result.sort((a, b) => compareNullableNumbers(a.mileage, b.mileage, -1));
    if (sort === "updated-desc") result.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    const total = result.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    return {
      items: result.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
      updatedAt
    };
  }

  async function loadStaticSnapshot() {
    if (staticSnapshot) return staticSnapshot;
    const response = await fetch(STATIC_SNAPSHOT_URL, { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`snapshot_http_${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) throw new Error("snapshot_empty");
    staticSnapshot = { items, updatedAt: payload.updatedAt || null };
    return staticSnapshot;
  }

  async function renderFromSnapshot(params, scroll) {
    const snapshot = await loadStaticSnapshot();
    sourceMode = "snapshot";
    liveMode = true;
    document.querySelector(".catalog-demo-note")?.remove();
    applyFacets(staticFacets(snapshot.items));
    restoreFiltersFromUrl();
    updatePricePlaceholders(snapshot.items);
    const payload = staticPayload(snapshot.items, params, snapshot.updatedAt);
    currentPage = payload.page;
    syncUrl(params);
    renderPayload(payload);
    if (scroll) document.querySelector(".catalog-filter-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadVehicles({ page = currentPage, scroll = false } = {}) {
    const root = document.getElementById("catalogRoot");
    if (!root) return;
    const serial = ++requestSerial;
    const params = buildQuery(page);
    currentPage = page;

    if (liveMode) root.innerHTML = `<div class="catalog-loading">Обновляем выборку автомобилей…</div>`;

    if (sourceMode === "snapshot") {
      try {
        await renderFromSnapshot(params, scroll);
      } catch (_) {
        root.innerHTML = `<div class="catalog-grid-empty">Каталог временно недоступен. Попробуйте обновить страницу.</div>`;
      }
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/vehicles?${params.toString()}`, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`catalog_http_${response.status}`);
      const payload = await response.json();
      if (serial !== requestSerial) return;

      sourceMode = "api";
      liveMode = true;
      document.querySelector(".catalog-demo-note")?.remove();
      syncUrl(params);
      renderPayload(payload);
      if (scroll) document.querySelector(".catalog-filter-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (_) {
      if (serial !== requestSerial) return;
      try {
        await renderFromSnapshot(params, scroll);
      } catch (_) {
        if (!liveMode) return;
        root.innerHTML = `<div class="catalog-grid-empty">Каталог временно недоступен. Попробуйте обновить страницу.</div>`;
      }
    }
  }

  async function loadFacets() {
    try {
      const response = await fetch(`${API_BASE}/vehicles/facets`, { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload.facets) applyFacets(payload.facets);
    } catch (_) {}
  }

  function resetFilters() {
    ["catalogSearch", "catalogBrand", "catalogCity", "catalogBody", "catalogEngine", "catalogYearMin", "catalogYearMax", "catalogPriceMin", "catalogPriceMax", "catalogMileageMin", "catalogMileageMax"].forEach((id) => {
      if (controls[id]) controls[id].value = "";
    });
    if (controls.catalogStatus) controls.catalogStatus.value = "active";
    if (controls.catalogSort) controls.catalogSort.value = "updated-desc";
    currentPage = 1;
    loadVehicles({ page: 1 });
  }

  function bindFilters() {
    const delayedIds = new Set(["catalogSearch", "catalogYearMin", "catalogYearMax", "catalogPriceMin", "catalogPriceMax", "catalogMileageMin", "catalogMileageMax"]);
    Object.entries(controls).forEach(([id, control]) => {
      if (!control || id === "catalogReset") return;
      const eventName = delayedIds.has(id) ? "input" : "change";
      control.addEventListener(eventName, () => {
        currentPage = 1;
        if (delayedIds.has(id)) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => loadVehicles({ page: 1 }), 280);
        } else {
          loadVehicles({ page: 1 });
        }
      });
    });
    controls.catalogReset?.addEventListener("click", resetFilters);

    document.getElementById("catalogPagination")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-catalog-page]");
      if (!button || button.disabled) return;
      const page = Number.parseInt(button.dataset.catalogPage, 10);
      if (!Number.isFinite(page) || page < 1 || page === currentPage) return;
      loadVehicles({ page, scroll: true });
    });
  }

  async function init() {
    if (!document.getElementById("catalogRoot")) return;
    if (new URL(window.location.href).searchParams.get("pilot") === "1") return;
    ensureStyles();
    collectControls();
    restoreFiltersFromUrl();
    bindCaptureNavigation();
    bindFilters();
    await loadFacets();
    restoreFiltersFromUrl();
    await loadVehicles({ page: currentPage });
  }

  init();
})();
