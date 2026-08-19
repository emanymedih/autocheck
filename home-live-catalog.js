(() => {
  const SNAPSHOT_URL = new URL("collector/data/global-public-catalog.json", document.baseURI).href;
  const SESSION_KEY = "avtocheck-selected-vehicle";
  const VISIBLE_LIMIT = 12;
  const nf = new Intl.NumberFormat("ru-RU");

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

  function formatPrice(value, currency = "CNY") {
    if (value === null || value === undefined || value === "") return "Цена уточняется";
    const number = Number(value);
    if (!Number.isFinite(number)) return "Цена уточняется";
    const formatted = nf.format(number);
    const code = clean(currency).toUpperCase();
    if (code === "USD") return `$${formatted}`;
    if (code === "CNY") return `${formatted} ¥`;
    if (code === "EUR") return `€${formatted}`;
    if (code === "RUB") return `${formatted} ₽`;
    return `${formatted} ${code}`.trim();
  }

  function formatMileage(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? `${nf.format(number)} км` : null;
  }

  function formatUpdatedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Актуальные предложения";
    return `Каталог Авточек обновлён ${new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date)}`;
  }

  function platformName(vehicle) {
    return clean(vehicle?.listingPlatform || vehicle?.sourcePlatform || vehicle?.marketplace) || "Autohome Global";
  }

  function cardMarkup(vehicle) {
    const id = clean(vehicle?.id);
    const title = clean(vehicle?.title) || [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Автомобиль";
    const photo = safePhoto(vehicle?.photos?.[0]);
    const meta = [
      vehicle?.year || null,
      clean(vehicle?.energyType),
      formatMileage(vehicle?.mileage),
      clean(vehicle?.city)
    ].filter(Boolean);
    const platform = platformName(vehicle);
    const media = photo
      ? `<img class="home-live-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`
      : `<div class="home-live-photo-placeholder">Фотография ожидается</div>`;

    return `<article class="catalog-card home-live-card" data-home-live-id="${escapeHtml(id)}" tabindex="0" aria-label="${escapeHtml(title)}">
      <div class="catalog-card-media">
        ${media}
        <span class="catalog-card-ready">В продаже</span>
      </div>
      <div class="catalog-card-body">
        <h3>${escapeHtml(title)}</h3>
        <div class="catalog-card-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        <div class="catalog-card-price">${escapeHtml(formatPrice(vehicle?.price, vehicle?.currency))}</div>
        <div class="home-live-source"><span aria-hidden="true">●</span><strong>${escapeHtml(platform)}</strong></div>
        <div class="catalog-card-actions">
          <button class="catalog-card-request" type="button" data-home-report="${escapeHtml(id)}">Запросить отчёт</button>
          <button class="catalog-card-open" type="button" data-home-open="${escapeHtml(id)}" aria-label="Открыть карточку">→</button>
        </div>
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
      })
      .slice(0, VISIBLE_LIMIT);
  }

  function navigate(vehicle, requestReport = false) {
    if (!vehicle?.id) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...vehicle, entry: "home-live-catalog" }));
    } catch (_) {}
    const params = new URLSearchParams({ id: vehicle.id });
    if (requestReport) params.set("action", "report");
    window.location.href = `vehicle.html?${params.toString()}`;
  }

  function replaceControl(oldControl) {
    if (!oldControl) return null;
    const fresh = oldControl.cloneNode(true);
    oldControl.replaceWith(fresh);
    return fresh;
  }

  async function init() {
    const section = document.getElementById("cars-preview");
    if (!section) return;

    section.classList.add("home-live-loading");
    const note = section.querySelector(".catalog-demo-note");
    if (note) note.textContent = "Загружаем актуальные предложения…";

    const oldCarousel = section.querySelector("#vehicleCarousel");
    if (!oldCarousel) return;
    const carousel = oldCarousel.cloneNode(false);
    carousel.className = oldCarousel.className;
    carousel.id = oldCarousel.id;
    carousel.innerHTML = `<div class="home-live-loading-card">Загружаем автомобили в продаже…</div>`;
    oldCarousel.replaceWith(carousel);

    const prev = replaceControl(section.querySelector("[data-carousel-prev]"));
    const next = replaceControl(section.querySelector("[data-carousel-next]"));

    try {
      const response = await fetch(SNAPSHOT_URL, {
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      if (!response.ok) throw new Error(`snapshot_http_${response.status}`);
      const payload = await response.json();
      const vehicles = selectVehicles(payload.items);
      if (!vehicles.length) throw new Error("snapshot_has_no_active_vehicles");
      const byId = new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle]));

      carousel.innerHTML = vehicles.map(cardMarkup).join("");
      section.classList.remove("home-live-loading");
      section.classList.add("home-live-ready");

      if (note) note.textContent = formatUpdatedAt(payload.updatedAt);
      const description = section.querySelector(".catalog-section-head > div > p:not(.section-eyebrow)");
      if (description) description.textContent = "Живые предложения из подключённого каталога. Карточки и статус продажи обновляются автоматически.";

      const scrollAmount = () => Math.max(320, Math.min(720, carousel.clientWidth * 0.72));
      prev?.addEventListener("click", () => carousel.scrollBy({ left: -scrollAmount(), behavior: "smooth" }));
      next?.addEventListener("click", () => carousel.scrollBy({ left: scrollAmount(), behavior: "smooth" }));

      carousel.addEventListener("click", (event) => {
        const card = event.target.closest("[data-home-live-id]");
        if (!card) return;
        const vehicle = byId.get(card.dataset.homeLiveId);
        if (!vehicle) return;
        event.preventDefault();
        event.stopPropagation();
        navigate(vehicle, Boolean(event.target.closest("[data-home-report]")));
      });

      carousel.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target.closest("button")) return;
        const card = event.target.closest("[data-home-live-id]");
        if (!card) return;
        const vehicle = byId.get(card.dataset.homeLiveId);
        if (!vehicle) return;
        event.preventDefault();
        navigate(vehicle, false);
      });
    } catch (_) {
      section.classList.remove("home-live-loading");
      section.classList.add("home-live-error-state");
      if (note) note.textContent = "Актуальные предложения временно недоступны";
      carousel.innerHTML = `<div class="home-live-error">Не удалось загрузить текущие автомобили. Полный каталог можно открыть по кнопке «Все автомобили».</div>`;
      prev?.setAttribute("disabled", "");
      next?.setAttribute("disabled", "");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(init), { once: true });
  } else {
    requestAnimationFrame(init);
  }
})();
