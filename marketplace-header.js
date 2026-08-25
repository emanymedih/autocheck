(() => {
  if (window.__AVTOCHECK_MARKETPLACE_HEADER__) return;
  window.__AVTOCHECK_MARKETPLACE_HEADER__ = true;

  const styleHref = new URL("marketplace-header.css?v=20260825-1", document.baseURI).href;
  if (!document.querySelector('link[data-marketplace-header-style]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = styleHref;
    link.dataset.marketplaceHeaderStyle = "1";
    document.head.appendChild(link);
  }

  if (!document.getElementById("marketplaceHeaderRuntimeFixes")) {
    const style = document.createElement("style");
    style.id = "marketplaceHeaderRuntimeFixes";
    style.textContent = `.site-header .main-nav{display:flex}.site-header .header-inner{position:relative;z-index:3}.marketplace-menu{z-index:2}.marketplace-menu-backdrop{z-index:1}.marketplace-service-card .marketplace-service-icon{display:grid}`;
    document.head.appendChild(style);
  }

  function catalogUrl(engine = "") {
    const url = new URL("cars.html", document.baseURI);
    if (engine) url.searchParams.set("engine", engine);
    url.searchParams.set("status", "active");
    url.searchParams.set("sort", "updated-desc");
    return `${url.pathname.split("/").pop()}${url.search}`;
  }

  function homeHref(anchor = "") {
    const path = window.location.pathname.split("/").pop() || "index.html";
    if ((path === "index.html" || path === "") && anchor) return anchor;
    return `index.html${anchor}`;
  }

  function aboutHref(anchor = "") {
    const path = window.location.pathname.split("/").pop();
    if (path === "about.html" && anchor) return anchor;
    return `about.html${anchor}`;
  }

  function isCatalogPage() {
    const path = window.location.pathname.split("/").pop();
    return path === "cars.html" || path === "vehicle.html";
  }

  function vehicleCountLabel(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} автомобиль в продаже`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} автомобиля в продаже`;
    return `${count} автомобилей в продаже`;
  }

  function menuMarkup() {
    const allCars = catalogUrl();
    const electric = catalogUrl("Электро");
    const gasoline = catalogUrl("Бензин");
    const diesel = catalogUrl("Дизель");
    const hev = catalogUrl("Гибрид (HEV)");
    const phev = catalogUrl("Подключаемый гибрид (PHEV)");
    const erev = catalogUrl("Гибрид с увеличителем запаса хода (EREV)");
    const check = homeHref("#check");
    const report = aboutHref("#report");
    const difference = aboutHref("#difference");
    const how = aboutHref("#how");
    const faq = aboutHref("#faq");
    const about = aboutHref("#about");

    return `<div class="marketplace-menu-backdrop" data-marketplace-menu-close></div>
      <nav class="marketplace-menu" id="marketplaceMenu" aria-label="Меню Авточек" aria-hidden="true">
        <div class="marketplace-menu-inner">
          <section class="marketplace-menu-group" aria-labelledby="marketplaceCatalogHeading">
            <span class="marketplace-menu-eyebrow" id="marketplaceCatalogHeading">Автомобили из Китая</span>
            <div class="marketplace-menu-links">
              <a class="marketplace-menu-link" href="${allCars}" data-menu-route="catalog">Все автомобили</a>
              <a class="marketplace-menu-link" href="${electric}">Электромобили</a>
              <a class="marketplace-menu-link" href="${gasoline}">Бензиновые</a>
              <a class="marketplace-menu-link" href="${diesel}">Дизельные</a>
            </div>
            <div class="marketplace-menu-subtitle">Гибриды</div>
            <div class="marketplace-menu-links">
              <a class="marketplace-menu-small-link" href="${hev}">Гибрид (HEV)</a>
              <a class="marketplace-menu-small-link" href="${phev}">Подключаемый гибрид (PHEV)</a>
              <a class="marketplace-menu-small-link" href="${erev}">С увеличителем запаса хода (EREV)</a>
            </div>
          </section>

          <section class="marketplace-menu-group" aria-labelledby="marketplaceCheckHeading">
            <span class="marketplace-menu-eyebrow" id="marketplaceCheckHeading">Проверка и информация</span>
            <div class="marketplace-menu-links">
              <a class="marketplace-menu-link" href="${check}">Проверить VIN</a>
              <a class="marketplace-menu-link" href="${report}">Что входит в отчёт</a>
              <a class="marketplace-menu-link" href="${how}">Как работает Авточек</a>
            </div>
            <div class="marketplace-menu-subtitle">О сервисе</div>
            <div class="marketplace-menu-links">
              <a class="marketplace-menu-small-link" href="${difference}">Почему Авточек</a>
              <a class="marketplace-menu-small-link" href="${faq}">Частые вопросы</a>
              <a class="marketplace-menu-small-link" href="${about}">О проекте</a>
            </div>
          </section>

          <section class="marketplace-menu-services" aria-label="Основные действия">
            <a class="marketplace-service-card" href="${allCars}" data-menu-catalog>
              <span class="marketplace-service-icon" aria-hidden="true">A</span>
              <span><strong>Автомобили в продаже</strong><span id="marketplaceCatalogCount">Актуальный каталог</span></span>
            </a>
            <a class="marketplace-service-card" href="${check}">
              <span class="marketplace-service-icon" aria-hidden="true">VIN</span>
              <span><strong>Проверить автомобиль</strong><span>Начать проверку по VIN</span></span>
            </a>
            <a class="marketplace-service-card" href="${report}">
              <span class="marketplace-service-icon" aria-hidden="true">✓</span>
              <span><strong>Что покажет отчёт</strong><span>Пробег, события, обслуживание и инспекция</span></span>
            </a>
            <a class="marketplace-service-card" href="${how}">
              <span class="marketplace-service-icon" aria-hidden="true">→</span>
              <span><strong>Как работает Авточек</strong><span>От выбора автомобиля до понятного результата</span></span>
            </a>
          </section>

          <div class="marketplace-menu-footnote">
            <span><strong>Первый рынок — Китай.</strong> Показываем только те данные, которые реально доступны по автомобилю.</span>
            <span>Каталог и проверка — в одном интерфейсе Авточек.</span>
          </div>
        </div>
      </nav>`;
  }

  function rewriteSupportingLinks() {
    const targets = {
      "Что в отчёте": aboutHref("#report"),
      "Как работает": aboutHref("#how"),
      "Почему Авточек": aboutHref("#difference"),
      "FAQ": aboutHref("#faq")
    };
    document.querySelectorAll(".site-footer a, .main-nav a").forEach((link) => {
      const label = link.textContent.trim();
      if (targets[label]) link.href = targets[label];
    });
  }

  function initMarketplaceHeader() {
    const header = document.querySelector(".site-header");
    const inner = header?.querySelector(".header-inner");
    const brand = inner?.querySelector(".brand");
    const mainNav = inner?.querySelector(".main-nav");
    const actions = inner?.querySelector(".header-actions");
    if (!header || !inner || !brand || !mainNav || !actions || header.dataset.marketplaceReady === "1") return;
    header.dataset.marketplaceReady = "1";

    rewriteSupportingLinks();

    const toggle = document.createElement("button");
    toggle.className = "header-menu-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Открыть меню");
    toggle.setAttribute("aria-controls", "marketplaceMenu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span class="header-menu-icon" aria-hidden="true"><span></span><span></span><span></span></span>`;
    brand.after(toggle);

    mainNav.innerHTML = `<a class="header-context-link" href="${catalogUrl()}" ${isCatalogPage() ? 'aria-current="page"' : ""}>Автомобили из Китая</a>`;

    const cta = actions.querySelector(".header-cta");
    if (cta) {
      cta.textContent = "Проверить VIN";
      cta.href = homeHref("#check");
    }

    header.insertAdjacentHTML("beforeend", menuMarkup());
    const menu = header.querySelector("#marketplaceMenu");
    const backdrop = header.querySelector("[data-marketplace-menu-close]");

    function setOpen(open, { restoreFocus = false } = {}) {
      header.classList.toggle("is-menu-open", open);
      document.body.classList.toggle("marketplace-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      menu?.setAttribute("aria-hidden", String(!open));
      if (!open && restoreFocus) toggle.focus({ preventScroll: true });
    }

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    backdrop?.addEventListener("click", () => setOpen(false));
    menu?.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && header.classList.contains("is-menu-open")) setOpen(false, { restoreFocus: true });
    });

    document.addEventListener("click", (event) => {
      if (!header.classList.contains("is-menu-open")) return;
      if (header.contains(event.target)) return;
      setOpen(false);
    });

    const catalogLink = menu?.querySelector('[data-menu-route="catalog"]');
    if (catalogLink && isCatalogPage()) catalogLink.classList.add("is-active");

    fetch(new URL("collector/data/global-public-catalog.json", document.baseURI).href, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const count = Array.isArray(payload?.items) ? payload.items.filter((item) => item?.status === "active").length : 0;
        const target = document.getElementById("marketplaceCatalogCount");
        if (target && count) target.textContent = vehicleCountLabel(count);
      })
      .catch(() => {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initMarketplaceHeader, { once: true });
  else initMarketplaceHeader();
})();
