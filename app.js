const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const INVALID_VIN_LETTERS = /[IOQ]/;
const THEME_STORAGE_KEY = "avtocheck-theme";
const FLOW_STORAGE_KEY = "avtocheck-flow";
const SELECTED_VEHICLE_KEY = "avtocheck-selected-vehicle";
const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const flowState = { stage: "vin", vin: "" };

// Демонстрационная витрина. В production массив заменит API Авточек.
// Здесь намеренно нет полей с названием внешней площадки или внешними ссылками.
const DEMO_VEHICLES = [
  { id: "cn-demo-001", title: "BMW 530Li", year: 2022, mileage: 34000, city: "Шанхай", price: 268000, body: "Седан", engine: "2.0T", tone: "graphite" },
  { id: "cn-demo-002", title: "Mercedes-Benz E 300 L", year: 2021, mileage: 46000, city: "Пекин", price: 259800, body: "Седан", engine: "2.0T", tone: "silver" },
  { id: "cn-demo-003", title: "Audi A6L 45 TFSI", year: 2022, mileage: 29000, city: "Гуанчжоу", price: 246000, body: "Седан", engine: "2.0T", tone: "navy" },
  { id: "cn-demo-004", title: "Volvo S90 B5", year: 2021, mileage: 52000, city: "Ханчжоу", price: 198000, body: "Седан", engine: "2.0T", tone: "green" },
  { id: "cn-demo-005", title: "Li Auto L7 Pro", year: 2023, mileage: 18000, city: "Шэньчжэнь", price: 249000, body: "Кроссовер", engine: "EREV", tone: "sand" },
  { id: "cn-demo-006", title: "Zeekr 001 WE", year: 2023, mileage: 22000, city: "Нинбо", price: 218000, body: "Лифтбек", engine: "EV", tone: "blue" },
  { id: "cn-demo-007", title: "Lexus ES 300h", year: 2020, mileage: 61000, city: "Чэнду", price: 226000, body: "Седан", engine: "2.5 Hybrid", tone: "pearl" },
  { id: "cn-demo-008", title: "Porsche Macan", year: 2020, mileage: 43000, city: "Сучжоу", price: 368000, body: "Кроссовер", engine: "2.0T", tone: "red" },
  { id: "cn-demo-009", title: "Toyota Camry 2.5", year: 2022, mileage: 31000, city: "Ухань", price: 139800, body: "Седан", engine: "2.5", tone: "white" },
  { id: "cn-demo-010", title: "Honda CR-V 240TURBO", year: 2021, mileage: 48000, city: "Нанкин", price: 128000, body: "Кроссовер", engine: "1.5T", tone: "bronze" }
];

function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "dark" || saved === "light" ? saved : null;
  } catch (_) {
    return null;
  }
}

function applyTheme(theme, { persist = false } = {}) {
  const resolvedTheme = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;
  const isDark = resolvedTheme === "dark";
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", isDark ? "Включить светлую тему" : "Включить тёмную тему");
    toggle.title = isDark ? "Светлая тема" : "Тёмная тема";
  }

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", isDark ? "#0f1412" : "#ffffff");
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme); } catch (_) {}
  }
}

function initTheme() {
  const initialTheme = getSavedTheme() || document.documentElement.dataset.theme || (darkModeQuery.matches ? "dark" : "light");
  applyTheme(initialTheme);
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, { persist: true });
  });
  darkModeQuery.addEventListener?.("change", (event) => {
    if (getSavedTheme()) return;
    applyTheme(event.matches ? "dark" : "light");
  });
  requestAnimationFrame(() => document.documentElement.classList.add("theme-ready"));
}

function installReportVisuals() {
  if (!document.getElementById("reportVisualStyles")) {
    const style = document.createElement("style");
    style.id = "reportVisualStyles";
    style.textContent = `
      .hero-visual.hero-visual-image{min-height:484px;display:grid;place-items:center;align-self:end;overflow:visible;padding:20px 0 8px}
      .hero-report-image{display:block;width:min(100%,500px);height:auto;max-height:470px;object-fit:contain;filter:drop-shadow(0 18px 35px rgba(28,35,31,.10))}
      .report-showcase-layout{display:grid;grid-template-columns:minmax(360px,.9fr) minmax(0,1.1fr);gap:30px;align-items:start}
      .report-overview-figure{position:sticky;top:92px;margin:0;padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--soft);box-shadow:var(--shadow)}
      .report-overview-image{display:block;width:100%;height:auto;border-radius:12px;object-fit:contain}
      .report-overview-figure figcaption{margin-top:13px;color:var(--muted);font-size:12px;line-height:1.5}
      .report-showcase-layout .services-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin:0}
      .report-showcase-layout .service-card{min-height:220px}
      .report-showcase-layout .service-card.featured{grid-column:1/-1;min-height:190px}
      @media(max-width:1040px){.report-showcase-layout{grid-template-columns:1fr;gap:32px}.report-overview-figure{position:static;width:min(100%,720px);justify-self:center}}
      @media(max-width:760px){.hero-visual.hero-visual-image{min-height:390px;padding-top:4px}.hero-report-image{width:min(100%,370px);max-height:370px}.report-overview-figure{padding:11px;border-radius:14px}.report-showcase-layout .services-grid{grid-template-columns:1fr}.report-showcase-layout .service-card.featured{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  const hero = document.querySelector(".hero-visual");
  if (hero && !hero.classList.contains("hero-visual-image")) {
    const image = document.createElement("img");
    image.src = "assets/hero-report.webp";
    image.alt = "Пример отчёта Авточек: пробег, повреждения и рекомендуемая проверка";
    image.className = "hero-report-image";
    image.width = 260;
    image.height = 245;
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = "high";
    hero.replaceChildren(image);
    hero.classList.add("hero-visual-image");
    hero.setAttribute("aria-label", "Пример отчёта Авточек");
  }

  const servicesGrid = document.querySelector("#report .services-grid");
  if (servicesGrid && !document.querySelector(".report-showcase-layout")) {
    const layout = document.createElement("div");
    layout.className = "report-showcase-layout";
    const figure = document.createElement("figure");
    figure.className = "report-overview-figure";
    const image = document.createElement("img");
    image.src = "assets/report-overview.webp";
    image.alt = "Пример экрана отчёта с оценкой состояния, данными автомобиля и отмеченными зонами кузова";
    image.className = "report-overview-image";
    image.width = 320;
    image.height = 288;
    image.decoding = "async";
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    caption.textContent = "Пример структуры данных, которые Авточек переводит и собирает в понятный отчёт.";
    figure.append(image, caption);
    servicesGrid.before(layout);
    layout.append(figure, servicesGrid);
  }
}

function installCoreFlowStyles() {
  if (document.getElementById("coreFlowStyles")) return;
  const style = document.createElement("style");
  style.id = "coreFlowStyles";
  style.textContent = `
    .result-card.core-flow-card{width:min(100%,610px);margin-top:18px;padding:0;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:var(--page);color:var(--text);box-shadow:var(--shadow)}
    .core-flow-progress{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line);background:var(--soft)}
    .core-flow-step{min-height:48px;display:flex;align-items:center;gap:8px;padding:0 14px;color:var(--muted);font-size:10px;font-weight:750}.core-flow-step+.core-flow-step{border-left:1px solid var(--line)}
    .core-flow-step i{width:20px;height:20px;display:grid;place-items:center;flex:0 0 auto;border:1px solid var(--line);border-radius:50%;background:var(--page);color:var(--muted);font-style:normal;font-size:9px}
    .core-flow-step.is-active{color:var(--text)}.core-flow-step.is-active i,.core-flow-step.is-complete i{border-color:var(--brand);background:var(--brand);color:#fff}
    .core-flow-body{padding:20px}.core-flow-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.core-flow-kicker{display:block;margin-bottom:5px;color:var(--brand);font-size:10px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}.core-flow-head h3{margin:0;font-size:20px;line-height:1.2;letter-spacing:-.025em}
    .core-link-button{flex:0 0 auto;padding:0;border:0;background:transparent;color:var(--brand);cursor:pointer;font-size:11px;font-weight:750}
    .core-identity{display:grid;grid-template-columns:1fr auto;gap:10px 18px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.core-identity span{color:var(--muted);font-size:11px}.core-identity strong{max-width:280px;overflow-wrap:anywhere;text-align:right;font-size:11px;letter-spacing:.035em}
    .core-status{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;margin:16px 0;padding:13px 14px;border-radius:10px;background:var(--soft)}.core-status-icon{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:var(--brand-soft);color:var(--brand);font-size:11px;font-weight:900}.core-status strong,.core-status span{display:block}.core-status strong{margin-bottom:3px;font-size:12px}.core-status span{color:var(--muted);font-size:11px;line-height:1.45}
    .core-primary-button{width:100%;min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:9px;background:var(--brand);color:#fff;cursor:pointer;font-size:13px;font-weight:800}.core-primary-button:hover{background:var(--brand-dark)}.core-primary-button[disabled]{cursor:default;opacity:.55}.core-flow-note{margin:10px 0 0;color:var(--muted);font-size:10px;line-height:1.5}
    .core-order-list{display:grid;gap:0;margin:14px 0 18px;border-top:1px solid var(--line)}.core-order-item{display:grid;grid-template-columns:28px 1fr;gap:10px;padding:13px 0;border-bottom:1px solid var(--line)}.core-order-item>span{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:var(--soft);color:var(--brand);font-size:10px;font-weight:850}.core-order-item strong,.core-order-item small{display:block}.core-order-item strong{margin-bottom:3px;font-size:12px}.core-order-item small{color:var(--muted);font-size:10px;line-height:1.45}
    @media(max-width:760px){.core-flow-step{min-height:44px;padding:0 9px;font-size:9px}.core-flow-step i{width:18px;height:18px}.core-flow-body{padding:17px}.core-flow-head h3{font-size:18px}}
  `;
  document.head.appendChild(style);
}

function persistFlowState() { try { sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(flowState)); } catch (_) {} }
function clearFlowState() { flowState.stage = "vin"; flowState.vin = ""; try { sessionStorage.removeItem(FLOW_STORAGE_KEY); } catch (_) {} }
function getFlowProgress(stage) {
  const current = stage === "order" ? 3 : stage === "availability" ? 2 : 1;
  return ["VIN", "Проверка", "Отчёт"].map((label, index) => {
    const step = index + 1;
    const className = step === current ? "is-active" : step < current ? "is-complete" : "";
    return `<div class="core-flow-step ${className}"><i>${step < current ? "✓" : step}</i><span>${label}</span></div>`;
  }).join("");
}
function renderAvailabilityStage(vin) {
  return `<div class="core-flow-progress">${getFlowProgress("availability")}</div><div class="core-flow-body"><div class="core-flow-head"><div><span class="core-flow-kicker">Ядро проверки</span><h3>VIN готов к проверке</h3></div><button class="core-link-button" type="button" data-core-action="reset">Изменить VIN</button></div><div class="core-identity"><span>VIN</span><strong>${vin}</strong><span>Рынок</span><strong>Китай</strong></div><div class="core-status"><span class="core-status-icon">i</span><div><strong>Следующий backend-шаг — определить доступность отчёта</strong><span>Авточек сам выполняет внутреннюю проверку и возвращает пользователю единый результат.</span></div></div><button class="core-primary-button" type="button" data-core-action="request-report">Запросить отчёт</button><p class="core-flow-note">Покупка исходных данных запускается только после подтверждённой оплаты клиента.</p></div>`;
}
function renderOrderStage(vin) {
  return `<div class="core-flow-progress">${getFlowProgress("order")}</div><div class="core-flow-body"><div class="core-flow-head"><div><span class="core-flow-kicker">Заказ отчёта</span><h3>Сценарий оплаты и получения отчёта</h3></div><button class="core-link-button" type="button" data-core-action="back">Назад</button></div><div class="core-identity"><span>VIN</span><strong>${vin}</strong><span>Рынок</span><strong>Китай</strong></div><div class="core-order-list"><div class="core-order-item"><span>1</span><div><strong>Проверить доступность</strong><small>Backend проверяет возможность сформировать отчёт по автомобилю.</small></div></div><div class="core-order-item"><span>2</span><div><strong>Показать цену и принять оплату</strong><small>Заказ получает статус paid после подтверждения платежа.</small></div></div><div class="core-order-item"><span>3</span><div><strong>Получить и обработать отчёт</strong><small>Авточек переводит, нормализует и собирает итоговый отчёт.</small></div></div></div><button class="core-primary-button" type="button" disabled>Оплата будет подключена следующим этапом</button><p class="core-flow-note">Сейчас это интерактивный каркас ядра.</p></div>`;
}
function renderCoreFlow(stage, vin, { scroll = true } = {}) {
  const result = document.getElementById("resultCard");
  if (!result) return;
  flowState.stage = stage; flowState.vin = vin; persistFlowState();
  result.classList.add("core-flow-card");
  result.innerHTML = stage === "order" ? renderOrderStage(vin) : renderAvailabilityStage(vin);
  result.hidden = false;
  if (scroll) result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function resetCoreFlow() {
  const result = document.getElementById("resultCard");
  if (result) result.hidden = true;
  clearFlowState();
  const input = document.getElementById("vinInput");
  if (input) { input.focus(); input.select(); }
}
function initCoreFlow() {
  installCoreFlowStyles();
  document.getElementById("resultCard")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-core-action]");
    if (!button) return;
    if (button.dataset.coreAction === "reset") return resetCoreFlow();
    if (button.dataset.coreAction === "request-report") return renderCoreFlow("order", flowState.vin);
    if (button.dataset.coreAction === "back") renderCoreFlow("availability", flowState.vin);
  });
}

function installCatalogStyles() {
  if (document.getElementById("catalogStyles")) return;
  const style = document.createElement("style");
  style.id = "catalogStyles";
  style.textContent = `
    .catalog-preview-section{padding:86px 0 94px;background:var(--soft);border-bottom:1px solid var(--line)}
    .catalog-section-head{display:flex;align-items:end;justify-content:space-between;gap:32px;margin-bottom:34px}.catalog-section-head h2{max-width:720px;margin:0;font-size:clamp(34px,4vw,50px);line-height:1.08;letter-spacing:-.04em}.catalog-section-head p{max-width:420px;margin:10px 0 0;color:var(--muted);font-size:14px;line-height:1.6}
    .catalog-head-actions{display:flex;align-items:center;gap:10px;flex:0 0 auto}.catalog-all-link,.catalog-arrow{min-height:40px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:9px;background:var(--page);color:var(--text);font-size:12px;font-weight:750}.catalog-all-link{padding:0 15px}.catalog-arrow{width:40px;padding:0;cursor:pointer}.catalog-arrow:hover,.catalog-all-link:hover{border-color:var(--brand);color:var(--brand)}
    .catalog-demo-note{display:inline-flex;align-items:center;gap:7px;margin-bottom:16px;padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:var(--page);color:var(--muted);font-size:10px;font-weight:700}.catalog-demo-note::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--amber)}
    .vehicle-carousel{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px 1px 8px}.vehicle-carousel::-webkit-scrollbar{display:none}
    .catalog-card{position:relative;flex:0 0 min(308px,82vw);scroll-snap-align:start;overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--page);box-shadow:0 9px 26px rgba(29,39,33,.06);cursor:pointer;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.catalog-card:hover{transform:translateY(-2px);border-color:var(--brand);box-shadow:0 14px 32px rgba(29,39,33,.10)}
    .catalog-card-media{position:relative;height:184px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(145deg,var(--soft-2),var(--brand-soft))}.catalog-card-media svg{width:86%;height:auto}.catalog-card-badge{position:absolute;top:12px;left:12px;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.9);color:#4b554f;font-size:9px;font-weight:850;letter-spacing:.03em}.catalog-card-ready{position:absolute;right:12px;bottom:12px;padding:6px 9px;border-radius:999px;background:rgba(34,81,63,.92);color:#fff;font-size:9px;font-weight:800}
    .catalog-card-body{padding:17px}.catalog-card h3{margin:0 0 7px;font-size:17px;line-height:1.25;letter-spacing:-.025em}.catalog-card-meta{display:flex;flex-wrap:wrap;gap:7px;color:var(--muted);font-size:11px}.catalog-card-meta span+span::before{content:"·";margin-right:7px}.catalog-card-price{margin:17px 0 15px;font-size:21px;font-weight:850;letter-spacing:-.02em}.catalog-card-price small{margin-left:5px;color:var(--muted);font-size:9px;font-weight:650}.catalog-card-actions{display:grid;grid-template-columns:1fr auto;gap:8px}.catalog-card-request,.catalog-card-open{min-height:40px;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer}.catalog-card-request{border:0;background:var(--brand);color:#fff;padding:0 13px}.catalog-card-open{width:40px;border:1px solid var(--line);background:var(--page);color:var(--text)}
    .catalog-page{min-height:calc(100vh - 68px);padding:58px 0 100px;background:var(--page)}.catalog-page-intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.55fr);gap:50px;align-items:end;margin-bottom:34px}.catalog-page-intro h1{max-width:760px;margin:0;font-size:clamp(42px,5vw,64px);line-height:1.02;letter-spacing:-.05em}.catalog-page-intro p{margin:0;color:var(--muted);font-size:14px;line-height:1.65}
    .catalog-toolbar{display:grid;grid-template-columns:minmax(240px,1fr) 190px 210px;gap:10px;margin-bottom:28px;padding:10px;border:1px solid var(--line);border-radius:13px;background:var(--soft)}.catalog-toolbar input,.catalog-toolbar select{width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;background:var(--page);color:var(--text);padding:0 13px;outline:none}.catalog-toolbar input:focus,.catalog-toolbar select:focus{border-color:var(--brand)}
    .catalog-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.catalog-grid .catalog-card{width:100%;min-width:0;flex:auto}.catalog-grid-empty{grid-column:1/-1;padding:50px;border:1px dashed var(--line);border-radius:14px;text-align:center;color:var(--muted)}
    .catalog-count{margin:0 0 16px;color:var(--muted);font-size:11px}.catalog-back{display:inline-flex;align-items:center;gap:7px;margin-bottom:24px;color:var(--brand);font-size:12px;font-weight:750}
    .catalog-modal{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:20px;background:rgba(8,12,10,.58);backdrop-filter:blur(6px)}.catalog-modal[hidden]{display:none}.catalog-modal-panel{width:min(100%,520px);max-height:min(90vh,720px);overflow:auto;border:1px solid var(--line);border-radius:18px;background:var(--page);color:var(--text);box-shadow:0 30px 80px rgba(0,0,0,.28)}.catalog-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px;border-bottom:1px solid var(--line)}.catalog-modal-head h2{margin:4px 0 0;font-size:23px;letter-spacing:-.03em}.catalog-modal-close{width:36px;height:36px;border:1px solid var(--line);border-radius:9px;background:var(--soft);color:var(--text);cursor:pointer}.catalog-modal-body{padding:20px}.catalog-modal-summary{display:grid;grid-template-columns:1fr auto;gap:9px 20px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.catalog-modal-summary span{color:var(--muted);font-size:11px}.catalog-modal-summary strong{text-align:right;font-size:11px}.catalog-modal-copy{margin:16px 0;color:var(--muted);font-size:12px;line-height:1.6}.catalog-modal-cta{width:100%;min-height:48px;border:0;border-radius:9px;background:var(--brand);color:#fff;font-size:13px;font-weight:800;cursor:pointer}.catalog-request-success{padding:18px;border-radius:12px;background:var(--soft);text-align:center}.catalog-request-success strong{display:block;margin-bottom:6px;font-size:16px}.catalog-request-success span{color:var(--muted);font-size:11px;line-height:1.5}
    html[data-theme="dark"] .catalog-card-badge{background:rgba(22,29,25,.9);color:#d9e2dc}
    @media(max-width:1040px){.catalog-page-intro{grid-template-columns:1fr}.catalog-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.catalog-section-head{align-items:flex-start}.catalog-head-actions{margin-top:4px}}
    @media(max-width:760px){.catalog-preview-section{padding:66px 0 72px}.catalog-section-head{display:block;margin-bottom:24px}.catalog-head-actions{margin-top:18px}.catalog-all-link{margin-right:auto}.catalog-card{flex-basis:84vw}.catalog-page{padding-top:36px}.catalog-page-intro{gap:18px}.catalog-toolbar{grid-template-columns:1fr}.catalog-grid{grid-template-columns:1fr}.catalog-card-media{height:200px}}
  `;
  document.head.appendChild(style);
}

function ensureCatalogNavigation() {
  const nav = document.querySelector(".main-nav");
  if (!nav || nav.querySelector('a[href="cars.html"]')) return;
  const link = document.createElement("a");
  link.href = "cars.html";
  link.textContent = "Автомобили";
  nav.prepend(link);
}
function formatPrice(value) { return new Intl.NumberFormat("ru-RU").format(value) + " ¥"; }
function formatMileage(value) { return new Intl.NumberFormat("ru-RU").format(value) + " км"; }

function vehicleSvg(vehicle) {
  const palettes = {
    graphite:["#2b3034","#697178"],silver:["#aeb6ba","#e2e6e8"],navy:["#1f3650","#587896"],green:["#2e5147","#6d9488"],sand:["#9a896f","#c8bda9"],blue:["#345774","#7da0bd"],pearl:["#c7cbc9","#f0f1ef"],red:["#71362f","#b55f52"],white:["#cfd4d3","#f6f7f5"],bronze:["#72543d","#b48a62"]
  };
  const [a,b] = palettes[vehicle.tone] || palettes.graphite;
  return `<svg viewBox="0 0 420 220" role="img" aria-label="Демонстрационное изображение автомобиля"><defs><linearGradient id="paint-${vehicle.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><ellipse cx="210" cy="181" rx="145" ry="16" fill="rgba(18,24,21,.16)"/><path d="M67 145c7-31 31-48 66-57l37-10c17-5 31-30 59-32h57c27 0 43 18 63 48l11 17c32 7 51 21 56 46l3 14H57l10-26z" fill="url(#paint-${vehicle.id})" stroke="rgba(20,28,24,.68)" stroke-width="3"/><path d="M166 82c18-8 30-27 59-29h50c22 2 35 15 54 46H137l29-17z" fill="#526a78" opacity=".72"/><circle cx="128" cy="166" r="30" fill="#202421"/><circle cx="337" cy="166" r="30" fill="#202421"/><circle cx="128" cy="166" r="13" fill="#aeb7b1"/><circle cx="337" cy="166" r="13" fill="#aeb7b1"/><path d="M360 121l39 10-7 16-37-6z" fill="#dcebe3" opacity=".85"/></svg>`;
}
function vehicleCardMarkup(vehicle) {
  return `<article class="catalog-card" data-vehicle-id="${vehicle.id}" tabindex="0" aria-label="${vehicle.title}, ${vehicle.year}"><div class="catalog-card-media">${vehicleSvg(vehicle)}<span class="catalog-card-badge">Демо</span><span class="catalog-card-ready">Можно запросить отчёт</span></div><div class="catalog-card-body"><h3>${vehicle.title}</h3><div class="catalog-card-meta"><span>${vehicle.year}</span><span>${formatMileage(vehicle.mileage)}</span><span>${vehicle.city}</span></div><div class="catalog-card-price">${formatPrice(vehicle.price)} <small>демо-цена</small></div><div class="catalog-card-actions"><button class="catalog-card-request" type="button" data-request-report="${vehicle.id}">Запросить отчёт</button><button class="catalog-card-open" type="button" data-open-vehicle="${vehicle.id}" aria-label="Открыть карточку">→</button></div></div></article>`;
}
function navigateToVehicle(id, request = false) {
  const suffix = request ? `&action=report` : "";
  window.location.href = `cars.html?car=${encodeURIComponent(id)}${suffix}`;
}
function bindVehicleCardEvents(root, { modalMode = false } = {}) {
  root.addEventListener("click", (event) => {
    const requestButton = event.target.closest("[data-request-report]");
    if (requestButton) { event.stopPropagation(); const id = requestButton.dataset.requestReport; if (modalMode) openCatalogModal(id); else navigateToVehicle(id, true); return; }
    const openButton = event.target.closest("[data-open-vehicle]");
    if (openButton) { event.stopPropagation(); const id = openButton.dataset.openVehicle; if (modalMode) openCatalogModal(id); else navigateToVehicle(id, false); return; }
    const card = event.target.closest(".catalog-card[data-vehicle-id]");
    if (!card) return;
    if (modalMode) openCatalogModal(card.dataset.vehicleId); else navigateToVehicle(card.dataset.vehicleId, false);
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".catalog-card[data-vehicle-id]");
    if (!card || event.target.closest("button")) return;
    event.preventDefault();
    if (modalMode) openCatalogModal(card.dataset.vehicleId); else navigateToVehicle(card.dataset.vehicleId, false);
  });
}

function installHomeCatalogPreview() {
  const confidence = document.querySelector(".confidence-bar");
  if (!confidence || document.getElementById("cars-preview")) return;
  const section = document.createElement("section");
  section.className = "catalog-preview-section";
  section.id = "cars-preview";
  section.innerHTML = `<div class="content-container"><span class="catalog-demo-note">Демонстрационный каталог до подключения живых предложений</span><div class="catalog-section-head"><div><p class="section-eyebrow">АВТОМОБИЛИ В ПРОДАЖЕ</p><h2>Выберите машину и запросите её историю.</h2><p>Карточки будут обновляться автоматически. Пользователь работает только с интерфейсом Авточек.</p></div><div class="catalog-head-actions"><a class="catalog-all-link" href="cars.html">Все автомобили</a><button class="catalog-arrow" type="button" data-carousel-prev aria-label="Предыдущие автомобили">←</button><button class="catalog-arrow" type="button" data-carousel-next aria-label="Следующие автомобили">→</button></div></div><div class="vehicle-carousel" id="vehicleCarousel">${DEMO_VEHICLES.map(vehicleCardMarkup).join("")}</div></div>`;
  confidence.after(section);
  const carousel = section.querySelector("#vehicleCarousel");
  section.querySelector("[data-carousel-prev]")?.addEventListener("click", () => carousel.scrollBy({ left: -660, behavior: "smooth" }));
  section.querySelector("[data-carousel-next]")?.addEventListener("click", () => carousel.scrollBy({ left: 660, behavior: "smooth" }));
  bindVehicleCardEvents(carousel);
}

function createCatalogModal() {
  if (document.getElementById("catalogModal")) return;
  const modal = document.createElement("div");
  modal.className = "catalog-modal";
  modal.id = "catalogModal";
  modal.hidden = true;
  modal.innerHTML = `<div class="catalog-modal-panel" role="dialog" aria-modal="true" aria-labelledby="catalogModalTitle"><div class="catalog-modal-head"><div><span class="section-eyebrow">КАРТОЧКА АВТОМОБИЛЯ</span><h2 id="catalogModalTitle">Автомобиль</h2></div><button class="catalog-modal-close" type="button" aria-label="Закрыть">×</button></div><div class="catalog-modal-body" id="catalogModalBody"></div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => { if (event.target === modal || event.target.closest(".catalog-modal-close")) closeCatalogModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) closeCatalogModal(); });
}
function openCatalogModal(id) {
  const vehicle = DEMO_VEHICLES.find((item) => item.id === id);
  if (!vehicle) return;
  createCatalogModal();
  const modal = document.getElementById("catalogModal");
  const title = document.getElementById("catalogModalTitle");
  const body = document.getElementById("catalogModalBody");
  title.textContent = vehicle.title;
  body.innerHTML = `<div class="catalog-modal-summary"><span>Год</span><strong>${vehicle.year}</strong><span>Пробег</span><strong>${formatMileage(vehicle.mileage)}</strong><span>Город</span><strong>${vehicle.city}</strong><span>Кузов</span><strong>${vehicle.body}</strong><span>Цена</span><strong>${formatPrice(vehicle.price)}</strong></div><p class="catalog-modal-copy">Эта карточка уже строится вокруг внутреннего ID Авточек. После подключения живого каталога кнопка ниже создаст заказ именно для выбранного автомобиля.</p><button class="catalog-modal-cta" type="button" data-confirm-catalog-request="${vehicle.id}">Запросить отчёт через Авточек</button>`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  body.querySelector("[data-confirm-catalog-request]")?.addEventListener("click", () => confirmCatalogRequest(vehicle));
  try { sessionStorage.setItem(SELECTED_VEHICLE_KEY, JSON.stringify({ id: vehicle.id })); } catch (_) {}
}
function confirmCatalogRequest(vehicle) {
  const body = document.getElementById("catalogModalBody");
  if (!body) return;
  body.innerHTML = `<div class="catalog-request-success"><strong>Запрос привязан к автомобилю</strong><span>${vehicle.title} · ${vehicle.year}<br>Следующий этап ядра — проверка доступности отчёта, цена и оплата.</span></div>`;
}
function closeCatalogModal() {
  const modal = document.getElementById("catalogModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function renderFullCatalog() {
  const root = document.getElementById("catalogRoot");
  if (!root) return;
  createCatalogModal();
  const search = document.getElementById("catalogSearch");
  const city = document.getElementById("catalogCity");
  const sort = document.getElementById("catalogSort");
  const count = document.getElementById("catalogCount");
  const cities = [...new Set(DEMO_VEHICLES.map((vehicle) => vehicle.city))].sort((a,b) => a.localeCompare(b,"ru"));
  city.innerHTML = `<option value="">Все города</option>${cities.map((item) => `<option value="${item}">${item}</option>`).join("")}`;
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    let items = DEMO_VEHICLES.filter((vehicle) => (!q || `${vehicle.title} ${vehicle.year} ${vehicle.body}`.toLowerCase().includes(q)) && (!city.value || vehicle.city === city.value));
    if (sort.value === "price-asc") items = [...items].sort((a,b) => a.price - b.price);
    if (sort.value === "price-desc") items = [...items].sort((a,b) => b.price - a.price);
    if (sort.value === "mileage") items = [...items].sort((a,b) => a.mileage - b.mileage);
    if (sort.value === "year") items = [...items].sort((a,b) => b.year - a.year);
    count.textContent = `Найдено: ${items.length}`;
    root.innerHTML = items.length ? items.map(vehicleCardMarkup).join("") : `<div class="catalog-grid-empty">По выбранным параметрам автомобилей пока нет.</div>`;
  };
  [search, city, sort].forEach((control) => control.addEventListener("input", draw));
  bindVehicleCardEvents(root, { modalMode: true });
  draw();
  const params = new URLSearchParams(window.location.search);
  const selectedId = params.get("car");
  if (selectedId && DEMO_VEHICLES.some((vehicle) => vehicle.id === selectedId)) setTimeout(() => openCatalogModal(selectedId), 80);
}
function initCatalogExperience() {
  installCatalogStyles();
  ensureCatalogNavigation();
  installHomeCatalogPreview();
  renderFullCatalog();
}

function normalizeVin(value) { return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17); }
function setVinFeedback(input, counter, status) {
  const vin = input.value;
  const length = vin.length;
  if (counter) counter.textContent = `${length}/17`;
  input.closest(".vin-field")?.classList.toggle("is-complete", length === 17 && VIN_RE.test(vin));
  if (!status) return;
  if (!length) return void (status.textContent = "На первом шаге нужен только VIN");
  if (INVALID_VIN_LETTERS.test(vin)) return void (status.textContent = "В стандартном VIN не используются буквы I, O и Q");
  if (length < 17) return void (status.textContent = `Осталось символов: ${17 - length}`);
  status.textContent = VIN_RE.test(vin) ? "VIN заполнен — можно продолжать" : "Проверьте формат VIN";
}
function syncVin(value, sourceId) {
  ["vinInput", "vinInputBottom"].forEach((id) => {
    if (id === sourceId) return;
    const target = document.getElementById(id);
    if (!target) return;
    target.value = value;
    const counterId = id === "vinInput" ? "vinCounter" : "vinCounterBottom";
    const statusId = id === "vinInput" ? "vinStatus" : null;
    setVinFeedback(target, document.getElementById(counterId), statusId ? document.getElementById(statusId) : null);
  });
}
function wireVinForm({ formId, inputId, errorId, counterId, statusId, showResult = false }) {
  const form = document.getElementById(formId);
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  const counter = counterId ? document.getElementById(counterId) : null;
  const status = statusId ? document.getElementById(statusId) : null;
  if (!form || !input || !error) return;
  setVinFeedback(input, counter, status);
  input.addEventListener("input", () => {
    const normalized = normalizeVin(input.value);
    input.value = normalized;
    error.textContent = "";
    setVinFeedback(input, counter, status);
    syncVin(normalized, inputId);
    const result = document.getElementById("resultCard");
    if (result) result.hidden = true;
    if (flowState.vin && flowState.vin !== normalized) clearFlowState();
  });
  input.addEventListener("paste", () => requestAnimationFrame(() => { input.value = normalizeVin(input.value); setVinFeedback(input, counter, status); }));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const vin = normalizeVin(input.value.trim());
    input.value = vin;
    setVinFeedback(input, counter, status);
    if (INVALID_VIN_LETTERS.test(vin)) { error.textContent = "Проверьте VIN: буквы I, O и Q в стандартном VIN не используются."; input.focus(); return; }
    if (vin.length !== 17) { error.textContent = `Проверьте VIN: сейчас ${vin.length} из 17 символов.`; input.focus(); return; }
    if (!VIN_RE.test(vin)) { error.textContent = "Проверьте формат VIN."; input.focus(); return; }
    error.textContent = "";
    syncVin(vin, inputId);
    renderCoreFlow("availability", vin, { scroll: showResult });
    if (!showResult) document.getElementById("check")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
function openVinHelp() { const target = document.getElementById("vin-help"); if (target) target.open = true; }
document.querySelectorAll('a[href="#vin-help"]').forEach((link) => link.addEventListener("click", () => { openVinHelp(); requestAnimationFrame(() => document.getElementById("vin-help")?.scrollIntoView({ behavior: "smooth", block: "center" })); }));
if (window.location.hash === "#vin-help") openVinHelp();

installReportVisuals();
initCoreFlow();
initTheme();
initCatalogExperience();
wireVinForm({ formId: "vinForm", inputId: "vinInput", errorId: "vinError", counterId: "vinCounter", statusId: "vinStatus", showResult: true });
wireVinForm({ formId: "vinFormBottom", inputId: "vinInputBottom", errorId: "vinErrorBottom", counterId: "vinCounterBottom", showResult: false });