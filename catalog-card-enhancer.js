(() => {
  const cache = new Map();
  const nf = new Intl.NumberFormat("ru-RU");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[char]);
  }

  function clean(value) {
    return String(value ?? "").trim();
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
    if (value === null || value === undefined || value === "") return "Пробег уточняется";
    const number = Number(value);
    return Number.isFinite(number) ? `${nf.format(number)} км` : "Пробег уточняется";
  }

  function statusLabel(status) {
    if (status === "active") return "В продаже";
    if (status === "inactive") return "Снято с продажи";
    return "Статус уточняется";
  }

  function translateColor(value) {
    const source = clean(value);
    if (!source) return "";
    const normalized = source.toLowerCase();
    const map = [
      ["black", "Чёрный"], ["white", "Белый"], ["silver", "Серебристый"], ["gray", "Серый"],
      ["grey", "Серый"], ["blue", "Синий"], ["red", "Красный"], ["green", "Зелёный"],
      ["brown", "Коричневый"], ["beige", "Бежевый"], ["gold", "Золотистый"], ["orange", "Оранжевый"],
      ["yellow", "Жёлтый"], ["purple", "Фиолетовый"]
    ];
    const match = map.find(([key]) => normalized === key || normalized.includes(key));
    return match ? match[1] : source;
  }

  function translateTransmission(value) {
    const source = clean(value);
    if (!source) return "";
    if (/dual[- ]clutch|dct|双离合/i.test(source)) return "Робот";
    if (/cvt|continuously variable/i.test(source)) return "Вариатор";
    if (/single[- ]speed|electric vehicle single/i.test(source)) return "Одноступенчатая";
    if (/automatic|auto|at\b|manual shift mode/i.test(source)) return "Автомат";
    if (/manual|mt\b/i.test(source)) return "Механика";
    return source;
  }

  function translateDrive(value) {
    const source = clean(value);
    if (!source) return "";
    if (/all[- ]wheel|four[- ]wheel|awd|4wd/i.test(source)) return "Полный привод";
    if (/front[- ]wheel|fwd/i.test(source)) return "Передний привод";
    if (/rear[- ]wheel|rwd/i.test(source)) return "Задний привод";
    return source;
  }

  function compactEngine(value) {
    return clean(value)
      .replace(/horsepower/gi, "л.с.")
      .replace(/\bHP\b/gi, "л.с.")
      .replace(/\s+/g, " ");
  }

  function extraSpec(vehicle, label) {
    const item = Array.isArray(vehicle?.extraSpecs)
      ? vehicle.extraSpecs.find((entry) => clean(entry?.label).toLocaleLowerCase("ru-RU") === label.toLocaleLowerCase("ru-RU"))
      : null;
    return clean(item?.value);
  }

  function platformName(vehicle) {
    const explicit = clean(vehicle?.listingPlatform || vehicle?.sourcePlatform || vehicle?.marketplace);
    if (explicit) return explicit;
    if (window.location.hostname.endsWith("github.io")) return "Autohome Global";
    return "Площадка продажи";
  }

  function sourceDetail(vehicle) {
    const seller = clean(vehicle?.sellerName);
    const city = clean(vehicle?.city);
    if (seller && city) return `${seller} · ${city}`;
    if (seller) return seller;
    if (city) return city;
    return "Международный каталог";
  }

  function vehicleSpecs(vehicle) {
    const drive = translateDrive(extraSpec(vehicle, "Привод"));
    const values = [
      compactEngine(vehicle?.engine) || clean(vehicle?.energyType),
      clean(vehicle?.body),
      drive,
      translateTransmission(vehicle?.transmission)
    ].filter(Boolean);
    return values.slice(0, 4);
  }

  function normalizeVehiclePayload(payload) {
    if (payload?.vehicle && typeof payload.vehicle === "object") return payload.vehicle;
    if (payload?.item && typeof payload.item === "object") return payload.item;
    return payload && typeof payload === "object" ? payload : {};
  }

  function cardMarkup(vehicle) {
    const photo = safePhoto(vehicle?.photos?.[0]);
    const title = clean(vehicle?.title) || [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Автомобиль";
    const color = translateColor(vehicle?.bodyColor);
    const specs = vehicleSpecs(vehicle);
    const active = vehicle?.status === "active";
    const status = clean(vehicle?.status) || "unknown";
    const platform = platformName(vehicle);
    const media = photo
      ? `<img class="catalog-live-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`
      : `<div class="catalog-live-placeholder">Фотография ожидается</div>`;

    return `<div class="catalog-card-media">${media}<span class="catalog-card-status ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></div>
      <div class="catalog-card-body">
        <div class="catalog-card-main">
          <h3>${escapeHtml(title)}</h3>
          <div class="catalog-card-color">${color ? escapeHtml(color) : "Характеристики автомобиля"}</div>
          <div class="catalog-card-specs">${specs.map((item) => `<span title="${escapeHtml(item)}">${escapeHtml(item)}</span>`).join("")}</div>
          <div class="catalog-card-source">
            <span class="catalog-card-source-mark" aria-hidden="true">●</span>
            <strong>Площадка: ${escapeHtml(platform)}</strong>
            <span class="catalog-card-source-detail">${escapeHtml(sourceDetail(vehicle))}</span>
          </div>
        </div>
        <aside class="catalog-card-side">
          <div class="catalog-card-year">${vehicle?.year ? escapeHtml(vehicle.year) : "Год уточняется"}</div>
          <div class="catalog-card-mileage">${escapeHtml(formatMileage(vehicle?.mileage))}</div>
          <div class="catalog-card-price">${escapeHtml(formatPrice(vehicle?.price, vehicle?.currency))}</div>
          <div class="catalog-card-price-note">Цена площадки</div>
          <div class="catalog-card-actions">
            <button class="catalog-card-request" type="button" data-request-report="${escapeHtml(vehicle?.id)}" ${active ? "" : "disabled"}>${active ? "Запросить отчёт" : "Недоступно"}</button>
            <button class="catalog-card-open" type="button" data-open-vehicle="${escapeHtml(vehicle?.id)}" aria-label="Открыть карточку">→</button>
          </div>
        </aside>
      </div>`;
  }

  async function loadVehicle(id) {
    if (!cache.has(id)) {
      cache.set(id, fetch(`/api/vehicles/${encodeURIComponent(id)}`, {
        headers: { accept: "application/json" }
      }).then(async (response) => {
        if (!response.ok) throw new Error(`vehicle_http_${response.status}`);
        return normalizeVehiclePayload(await response.json());
      }));
    }
    return cache.get(id);
  }

  async function enhanceCard(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.classList.contains("catalog-card-v2")) return;
    if (card.dataset.catalogEnhancing === "1") return;
    const id = clean(card.dataset.vehicleId);
    if (!id || card.dataset.liveVehicle !== "1") return;

    card.dataset.catalogEnhancing = "1";
    try {
      const vehicle = await loadVehicle(id);
      if (!card.isConnected || clean(card.dataset.vehicleId) !== id) return;
      card.innerHTML = cardMarkup(vehicle);
      card.classList.add("catalog-card-v2");
      card.setAttribute("aria-label", clean(vehicle?.title) || "Автомобиль");
    } catch (_) {
      card.classList.add("catalog-card-v2-fallback");
    } finally {
      delete card.dataset.catalogEnhancing;
    }
  }

  function scan(root = document) {
    root.querySelectorAll?.(".catalog-card[data-live-vehicle='1']").forEach(enhanceCard);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(".catalog-card[data-live-vehicle='1']")) enhanceCard(node);
        scan(node);
      }
    }
  });

  function init() {
    const root = document.getElementById("catalogRoot");
    if (!root) return;
    observer.observe(root, { childList: true, subtree: true });
    scan(root);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
