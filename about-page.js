(() => {
  const storageKey = "avtocheck-theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function savedTheme() {
    try {
      const value = localStorage.getItem(storageKey);
      return value === "dark" || value === "light" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function applyTheme(theme, persist = false) {
    const resolved = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      const dark = resolved === "dark";
      toggle.setAttribute("aria-pressed", String(dark));
      toggle.setAttribute("aria-label", dark ? "Включить светлую тему" : "Включить тёмную тему");
      toggle.title = dark ? "Светлая тема" : "Тёмная тема";
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#0f1412" : "#ffffff");
    if (persist) {
      try { localStorage.setItem(storageKey, resolved); } catch (_) {}
    }
  }

  applyTheme(savedTheme() || document.documentElement.dataset.theme || (media.matches ? "dark" : "light"));
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next, true);
  });
  media.addEventListener?.("change", (event) => {
    if (savedTheme()) return;
    applyTheme(event.matches ? "dark" : "light");
  });
})();
