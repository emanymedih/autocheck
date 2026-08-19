(() => {
  const params = new URL(window.location.href).searchParams;
  if (params.get("pilot") !== "1") return;

  const PUBLIC_SNAPSHOT_URL = "collector/data/pilot-public-catalog.json";
  const SESSION_KEY = "avtocheck-selected-vehicle";
  const nf = new Intl.NumberFormat("ru-RU");
  let items = [];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function safePhoto(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
    } catch (_) { return null; }
  }

  function formatPrice(value) {
    return Number.isFinite(Number(value)) ? `${nf.format(Number(value))} ¥` : "Цена уточняется";
  }

  function formatMileage(value) {
    return Number.isFinite(Number(value)) ? `${nf.format(Number(value))} км` : null;
  }

  function ensureStyles() {
    if (document.getElementById("pilotCatalogStyles")) return;
    const style = document.createElement("style");
    style.id = "pilotCatalogStyles";
    style.textContent = `
      .pilot-catalog-card{overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--page);box-shadow:0 9px 26px rgba(29,39,33,.06);cursor:pointer}
      .pilot-catalog-card:hover{border-color:var(--brand);box-shadow:0 14px 32px rgba(29,39,33,.1)}
      .pilot-catalog-media{position:relative;height:184px;overflow:hidden;background:var(--soft)}
      .pilot-catalog-media img{width:100%;height:100%;display:block;object-fit:cover}
      .pilot-catalog-status{position:absolute;right:12px;bottom:12px;padding:6px 9px;border-radius:999px;background:rgba(34,81,63,.92);color:#fff;font-size:9px;font-weight:800}
      .pilot-catalog-body{padding:17px}.pilot-catalog-body h3{margin:0 0 7px;font-size:17px;line-height:1.25;letter-spacing:-.025em}
      .pilot-catalog-meta{display:flex;flex-wrap:wrap;gap:7px;color:var(--muted);font-size:11px}.pilot-catalog-meta span+span::before{content:"·";margin-right:7px}
      .pilot-catalog-price{margin:17px 0 15px;font-size:21px;font-weight:850;letter-spacing:-.02em}
      .pilot-catalog-actions{display:grid;grid-template-columns:1fr auto;gap:8px}.pilot-catalog-request,.pilot-catalog-open{min-height:40px;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer}
      .pilot-catalog-request{border:0;background:var(--brand);color:#fff;padding:0 13px}.pilot-catalog-open{width:40px;border:1px solid var(--line);background:var(--page);color:var(--text)}
      .pilot-live-state{display:inline-flex;align-items:center;gap:7px;margin:0 0 16px;color:var(--muted);font-size:11px}.pilot-live-state::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--brand)}
    `;
    document.head.appendChild(style);
  }

  function cardMarkup(vehicle) {
    const photo = safePhoto(vehicle.photos?.[0]);
    const meta = [vehicle.year, formatMileage(vehicle.mileage), vehicle.city].filter(Boolean);
    return `<article class="pilot-catalog-card" data-pilot-vehicle-id="${escapeHtml(vehicle.id)}" tabindex="0" aria-label="${escapeHtml(vehicle.title || "Автомобиль")}">
      <div class="pilot-catalog-media">${photo ? `<img src="${photo}" alt="${escapeHtml(vehicle.title || "Автомобиль")}" loading="eager" decoding="async">` : ""}<span class="pilot-catalog-status">В продаже</span></div>
      <div class="pilot-catalog-body"><h3>${escapeHtml(vehicle.title)}</h3><div class="pilot-catalog-meta">${meta.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</div><div class="pilot-catalog-price">${formatPrice(vehicle.price)}</div><div class="pilot-catalog-actions"><button class="pilot-catalog-request" type="button" data-pilot-report="${escapeHtml(vehicle.id)}">Запросить отчёт</button><button class="pilot-catalog-open" type="button" data-pilot-open="${escapeHtml(vehicle.id)}" aria-label="Открыть карточку">→</button></div></div>
    </article>`;
  }

  function openVehicle(id, report = false) {
    const vehicle = items.find((item) => item.id === id);
    if (!vehicle) return;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...vehicle, entry: "catalog-api" })); } catch (_) {}
    const query = new URLSearchParams({ id: vehicle.id, pilot: "1" });
    if (report) query.set("action", "report");
    window.location.href = `vehicle.html?${query.toString()}`;
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const report = event.target.closest?.("[data-pilot-report]");
      const open = event.target.closest?.("[data-pilot-open]");
      const card = event.target.closest?.("[data-pilot-vehicle-id]");
      if (!report && !open && !card) return;
      const id = report?.dataset.pilotReport || open?.dataset.pilotOpen || card?.dataset.pilotVehicleId;
      if (!id) return;
      event.preventDefault();
      openVehicle(id, Boolean(report));
    });
  }

  async function init() {
    const root = document.getElementById("catalogRoot");
    if (!root) return;
    ensureStyles();
    bind();

    try {
      const response = await fetch(PUBLIC_SNAPSHOT_URL, { cache: "no-store", headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`pilot_http_${response.status}`);
      const payload = await response.json();
      items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) throw new Error("pilot_empty");

      root.innerHTML = items.map(cardMarkup).join("");
      const count = document.getElementById("catalogCount");
      if (count) count.textContent = `Найдено: ${items.length}`;
      const summary = document.getElementById("catalogPageSummary");
      if (summary) summary.textContent = "Пилотная живая карточка";
      document.getElementById("catalogPagination")?.setAttribute("hidden", "");
      document.querySelector(".catalog-demo-note")?.remove();

      const intro = document.querySelector(".catalog-page-intro");
      if (intro && !document.getElementById("pilotLiveState")) {
        const state = document.createElement("div");
        state.id = "pilotLiveState";
        state.className = "pilot-live-state";
        const date = payload.updatedAt ? new Date(payload.updatedAt) : null;
        state.textContent = date && !Number.isNaN(date.getTime()) ? `Живая карточка проверена ${date.toLocaleString("ru-RU")}` : "Живая карточка загружена";
        intro.after(state);
      }
    } catch (_) {
      root.innerHTML = `<div class="catalog-grid-empty">Пилотная карточка временно недоступна.</div>`;
    }
  }

  init();
})();
