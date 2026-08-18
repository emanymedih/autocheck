const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const INVALID_VIN_LETTERS = /[IOQ]/;
const THEME_STORAGE_KEY = "avtocheck-theme";
const FLOW_STORAGE_KEY = "avtocheck-flow";
const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

const flowState = {
  stage: "vin",
  vin: ""
};

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
  if (themeColor) {
    themeColor.setAttribute("content", isDark ? "#0f1412" : "#ffffff");
  }

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    } catch (_) {}
  }
}

function initTheme() {
  const savedTheme = getSavedTheme();
  const initialTheme = savedTheme || document.documentElement.dataset.theme || (darkModeQuery.matches ? "dark" : "light");
  applyTheme(initialTheme);

  const toggle = document.getElementById("themeToggle");
  toggle?.addEventListener("click", () => {
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
      .hero-visual.hero-visual-image {
        min-height: 484px;
        display: grid;
        place-items: center;
        align-self: end;
        overflow: visible;
        padding: 20px 0 8px;
      }
      .hero-report-image {
        display: block;
        width: min(100%, 500px);
        height: auto;
        max-height: 470px;
        object-fit: contain;
        filter: drop-shadow(0 18px 35px rgba(28, 35, 31, .10));
      }
      .report-showcase-layout {
        display: grid;
        grid-template-columns: minmax(360px, .9fr) minmax(0, 1.1fr);
        gap: 30px;
        align-items: start;
      }
      .report-overview-figure {
        position: sticky;
        top: 92px;
        margin: 0;
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--soft);
        box-shadow: var(--shadow);
      }
      .report-overview-image {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 12px;
        object-fit: contain;
      }
      .report-overview-figure figcaption {
        margin-top: 13px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }
      .report-showcase-layout .services-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 15px;
        margin: 0;
      }
      .report-showcase-layout .service-card {
        min-height: 220px;
      }
      .report-showcase-layout .service-card.featured {
        grid-column: 1 / -1;
        min-height: 190px;
      }
      @media (max-width: 1040px) {
        .report-showcase-layout {
          grid-template-columns: 1fr;
          gap: 32px;
        }
        .report-overview-figure {
          position: static;
          width: min(100%, 720px);
          justify-self: center;
        }
      }
      @media (max-width: 760px) {
        .hero-visual.hero-visual-image {
          min-height: 390px;
          padding-top: 4px;
        }
        .hero-report-image {
          width: min(100%, 370px);
          max-height: 370px;
        }
        .report-overview-figure {
          padding: 11px;
          border-radius: 14px;
        }
        .report-showcase-layout .services-grid {
          grid-template-columns: 1fr;
        }
        .report-showcase-layout .service-card.featured {
          grid-column: auto;
        }
      }
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
    caption.textContent = "Пример структуры исходных данных, которые Авточек переводит и собирает в понятный отчёт.";

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
    .result-card.core-flow-card {
      width: min(100%, 610px);
      margin-top: 18px;
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--page);
      color: var(--text);
      box-shadow: var(--shadow);
    }
    .core-flow-progress {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border-bottom: 1px solid var(--line);
      background: var(--soft);
    }
    .core-flow-step {
      position: relative;
      min-height: 48px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 14px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 750;
    }
    .core-flow-step + .core-flow-step { border-left: 1px solid var(--line); }
    .core-flow-step i {
      width: 20px;
      height: 20px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--page);
      color: var(--muted);
      font-style: normal;
      font-size: 9px;
    }
    .core-flow-step.is-active { color: var(--text); }
    .core-flow-step.is-active i,
    .core-flow-step.is-complete i {
      border-color: var(--brand);
      background: var(--brand);
      color: #fff;
    }
    .core-flow-body { padding: 20px; }
    .core-flow-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 18px;
    }
    .core-flow-kicker {
      display: block;
      margin-bottom: 5px;
      color: var(--brand);
      font-size: 10px;
      font-weight: 850;
      letter-spacing: .05em;
      text-transform: uppercase;
    }
    .core-flow-head h3 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
      letter-spacing: -.025em;
    }
    .core-link-button {
      flex: 0 0 auto;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--brand);
      cursor: pointer;
      font-size: 11px;
      font-weight: 750;
    }
    .core-identity {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px 18px;
      padding: 14px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .core-identity span { color: var(--muted); font-size: 11px; }
    .core-identity strong {
      max-width: 280px;
      overflow-wrap: anywhere;
      text-align: right;
      font-size: 11px;
      letter-spacing: .035em;
    }
    .core-status {
      display: grid;
      grid-template-columns: 26px 1fr;
      gap: 10px;
      align-items: start;
      margin: 16px 0;
      padding: 13px 14px;
      border-radius: 10px;
      background: var(--soft);
    }
    .core-status-icon {
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--brand-soft);
      color: var(--brand);
      font-size: 11px;
      font-weight: 900;
    }
    .core-status strong,
    .core-status span { display: block; }
    .core-status strong { margin-bottom: 3px; font-size: 12px; }
    .core-status span { color: var(--muted); font-size: 11px; line-height: 1.45; }
    .core-primary-button {
      width: 100%;
      min-height: 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border: 0;
      border-radius: 9px;
      background: var(--brand);
      color: #fff;
      cursor: pointer;
      font-size: 13px;
      font-weight: 800;
    }
    .core-primary-button:hover { background: var(--brand-dark); }
    .core-primary-button[disabled] {
      cursor: default;
      opacity: .55;
    }
    .core-flow-note {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.5;
    }
    .core-order-list {
      display: grid;
      gap: 0;
      margin: 14px 0 18px;
      border-top: 1px solid var(--line);
    }
    .core-order-item {
      display: grid;
      grid-template-columns: 28px 1fr;
      gap: 10px;
      padding: 13px 0;
      border-bottom: 1px solid var(--line);
    }
    .core-order-item > span {
      width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--soft);
      color: var(--brand);
      font-size: 10px;
      font-weight: 850;
    }
    .core-order-item strong,
    .core-order-item small { display: block; }
    .core-order-item strong { margin-bottom: 3px; font-size: 12px; }
    .core-order-item small { color: var(--muted); font-size: 10px; line-height: 1.45; }
    @media (max-width: 760px) {
      .core-flow-step { min-height: 44px; padding: 0 9px; font-size: 9px; }
      .core-flow-step i { width: 18px; height: 18px; }
      .core-flow-body { padding: 17px; }
      .core-flow-head h3 { font-size: 18px; }
    }
  `;
  document.head.appendChild(style);
}

function persistFlowState() {
  try {
    sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(flowState));
  } catch (_) {}
}

function clearFlowState() {
  flowState.stage = "vin";
  flowState.vin = "";
  try {
    sessionStorage.removeItem(FLOW_STORAGE_KEY);
  } catch (_) {}
}

function getFlowProgress(stage) {
  const current = stage === "order" ? 3 : stage === "availability" ? 2 : 1;
  const labels = ["VIN", "Проверка", "Отчёт"];

  return labels.map((label, index) => {
    const step = index + 1;
    const className = step === current ? "is-active" : step < current ? "is-complete" : "";
    const icon = step < current ? "✓" : String(step);
    return `<div class="core-flow-step ${className}"><i>${icon}</i><span>${label}</span></div>`;
  }).join("");
}

function renderAvailabilityStage(vin) {
  return `
    <div class="core-flow-progress">${getFlowProgress("availability")}</div>
    <div class="core-flow-body">
      <div class="core-flow-head">
        <div>
          <span class="core-flow-kicker">Ядро проверки</span>
          <h3>VIN готов к проверке источников</h3>
        </div>
        <button class="core-link-button" type="button" data-core-action="reset">Изменить VIN</button>
      </div>
      <div class="core-identity">
        <span>VIN</span><strong>${vin}</strong>
        <span>Рынок</span><strong>Китай</strong>
      </div>
      <div class="core-status">
        <span class="core-status-icon">i</span>
        <div>
          <strong>Следующий backend-шаг — определить доступность отчёта</strong>
          <span>Сюда будет подключён внутренний запрос к источникам. Пользователь не выбирает поставщика данных.</span>
        </div>
      </div>
      <button class="core-primary-button" type="button" data-core-action="request-report">Запросить отчёт</button>
      <p class="core-flow-note">Платная покупка исходного отчёта запускается только после подтверждённой оплаты клиента на Авточек.</p>
    </div>
  `;
}

function renderOrderStage(vin) {
  return `
    <div class="core-flow-progress">${getFlowProgress("order")}</div>
    <div class="core-flow-body">
      <div class="core-flow-head">
        <div>
          <span class="core-flow-kicker">Заказ отчёта</span>
          <h3>Сценарий оплаты и получения отчёта</h3>
        </div>
        <button class="core-link-button" type="button" data-core-action="back">Назад</button>
      </div>
      <div class="core-identity">
        <span>VIN</span><strong>${vin}</strong>
        <span>Рынок</span><strong>Китай</strong>
      </div>
      <div class="core-order-list">
        <div class="core-order-item"><span>1</span><div><strong>Проверить доступность</strong><small>Backend получает актуальную возможность сформировать отчёт для этого автомобиля.</small></div></div>
        <div class="core-order-item"><span>2</span><div><strong>Показать цену и принять оплату</strong><small>Клиент заранее видит стоимость. Заказ получает статус paid только после подтверждения платежа.</small></div></div>
        <div class="core-order-item"><span>3</span><div><strong>Получить и обработать исходный отчёт</strong><small>Авточек запускает покупку у источника, переводит, нормализует и собирает итоговый отчёт.</small></div></div>
      </div>
      <button class="core-primary-button" type="button" disabled>Оплата будет подключена следующим этапом</button>
      <p class="core-flow-note">Сейчас это интерактивный каркас ядра. Реальная цена, платёж и обращение к китайской площадке ещё не подключены.</p>
    </div>
  `;
}

function renderCoreFlow(stage, vin, { scroll = true } = {}) {
  const result = document.getElementById("resultCard");
  if (!result) return;

  flowState.stage = stage;
  flowState.vin = vin;
  persistFlowState();

  result.classList.add("core-flow-card");
  result.innerHTML = stage === "order" ? renderOrderStage(vin) : renderAvailabilityStage(vin);
  result.hidden = false;

  if (scroll) {
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function resetCoreFlow() {
  const result = document.getElementById("resultCard");
  if (result) result.hidden = true;
  clearFlowState();

  const input = document.getElementById("vinInput");
  if (input) {
    input.focus();
    input.select();
  }
}

function initCoreFlow() {
  installCoreFlowStyles();

  document.getElementById("resultCard")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-core-action]");
    if (!button) return;

    const action = button.dataset.coreAction;
    if (action === "reset") {
      resetCoreFlow();
      return;
    }
    if (action === "request-report") {
      renderCoreFlow("order", flowState.vin);
      return;
    }
    if (action === "back") {
      renderCoreFlow("availability", flowState.vin);
    }
  });
}

function normalizeVin(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);
}

function setVinFeedback(input, counter, status) {
  const vin = input.value;
  const length = vin.length;

  if (counter) counter.textContent = `${length}/17`;
  input.closest(".vin-field")?.classList.toggle("is-complete", length === 17 && VIN_RE.test(vin));

  if (!status) return;

  if (length === 0) {
    status.textContent = "На первом шаге нужен только VIN";
    return;
  }

  if (INVALID_VIN_LETTERS.test(vin)) {
    status.textContent = "В стандартном VIN не используются буквы I, O и Q";
    return;
  }

  if (length < 17) {
    status.textContent = `Осталось символов: ${17 - length}`;
    return;
  }

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

  input.addEventListener("paste", () => {
    requestAnimationFrame(() => {
      input.value = normalizeVin(input.value);
      setVinFeedback(input, counter, status);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const vin = normalizeVin(input.value.trim());
    input.value = vin;
    setVinFeedback(input, counter, status);

    if (INVALID_VIN_LETTERS.test(vin)) {
      error.textContent = "Проверьте VIN: буквы I, O и Q в стандартном VIN не используются.";
      input.focus();
      return;
    }

    if (vin.length !== 17) {
      error.textContent = `Проверьте VIN: сейчас ${vin.length} из 17 символов.`;
      input.focus();
      return;
    }

    if (!VIN_RE.test(vin)) {
      error.textContent = "Проверьте формат VIN.";
      input.focus();
      return;
    }

    error.textContent = "";
    syncVin(vin, inputId);
    renderCoreFlow("availability", vin, { scroll: showResult });

    if (!showResult) {
      document.getElementById("check")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function openVinHelp() {
  const target = document.getElementById("vin-help");
  if (!target) return;
  target.open = true;
}

document.querySelectorAll('a[href="#vin-help"]').forEach((link) => {
  link.addEventListener("click", () => {
    openVinHelp();
    requestAnimationFrame(() => document.getElementById("vin-help")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  });
});

if (window.location.hash === "#vin-help") openVinHelp();

installReportVisuals();
initCoreFlow();
initTheme();

wireVinForm({
  formId: "vinForm",
  inputId: "vinInput",
  errorId: "vinError",
  counterId: "vinCounter",
  statusId: "vinStatus",
  showResult: true
});

wireVinForm({
  formId: "vinFormBottom",
  inputId: "vinInputBottom",
  errorId: "vinErrorBottom",
  counterId: "vinCounterBottom",
  showResult: false
});
