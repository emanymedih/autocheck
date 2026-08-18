const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const INVALID_VIN_LETTERS = /[IOQ]/;
const THEME_STORAGE_KEY = "avtocheck-theme";
const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

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

    const result = document.getElementById("resultCard");
    const resultVin = document.getElementById("resultVin");
    if (result && resultVin) {
      resultVin.textContent = vin;
      result.hidden = false;

      const target = showResult ? result : document.getElementById("check");
      target?.scrollIntoView({ behavior: "smooth", block: showResult ? "nearest" : "start" });
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
