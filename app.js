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
