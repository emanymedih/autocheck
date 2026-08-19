(() => {
  const SNAPSHOT_URL = new URL("collector/data/global-public-catalog.json", document.baseURI).href;
  const originalFetch = window.fetch.bind(window);
  const preferStatic = window.AVTOCHECK_STATIC_CATALOG === true || window.location.hostname.endsWith("github.io");
  const nf = new Intl.NumberFormat("ru-RU");
  let snapshotPromise = null;
  let vehicleById = new Map();

  function clean(value) {
    return String(value ?? "").trim();
  }

  function lower(value) {
    return clean(value).toLocaleLowerCase("ru-RU");
  }

  function numberValue(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function uniqueSorted(values) {
    return [...new Set(values.map(clean).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  }

  function range(values) {
    const numbers = values.map(numberValue).filter((value) => value !== null);
    if (!numbers.length) return { min: null, max: null };
    return { min: Math.min(...numbers), max: Math.max(...numbers) };
  }

  function selectValues(id) {
    const select = document.getElementById(id);
    if (!select) return [];
    return [...select.options].map((option) => option.value).filter(Boolean);
  }

  function formatPrice(vehicle) {
    const value = numberValue(vehicle?.price);
    if (value === null) return clean(vehicle?.priceText) || "Цена не раскрыта";
    const currency = clean(vehicle?.currency).toUpperCase() || "CNY";
    if (currency === "CNY") return `${nf.format(value)} ¥`;
    if (currency === "USD") return `$${nf.format(value)}`;
    if (currency === "EUR") return `${nf.format(value)} €`;
    if (currency === "RUB") return `${nf.format(value)} ₽`;
    return `${nf.format(value)} ${currency}`;
  }

  function patchCurrencyUi() {
    const currencies = new Set([...vehicleById.values()].map((vehicle) => clean(vehicle.currency).toUpperCase()).filter(Boolean));
    const singleCurrency = currencies.size === 1 ? [...currencies][0] : null;
    const min = document.getElementById("catalogPriceMin");
    const max = document.getElementById("catalogPriceMax");
    const minPlaceholder = singleCurrency ? `Цена от, ${singleCurrency}` : "Цена от";
    const maxPlaceholder = singleCurrency ? `Цена до, ${singleCurrency}` : "Цена до";
    if (min && min.placeholder !== minPlaceholder) min.placeholder = minPlaceholder;
    if (max && max.placeholder !== maxPlaceholder) max.placeholder = maxPlaceholder;

    document.querySelectorAll(".catalog-card[data-live-vehicle='1']").forEach((card) => {
      const vehicle = vehicleById.get(card.dataset.vehicleId);
      const price = card.querySelector(".catalog-card-price");
      if (!vehicle || !price) return;
      const formatted = formatPrice(vehicle);
      if (price.textContent !== formatted) price.textContent = formatted;
    });
  }

  async function loadSnapshot() {
    if (!snapshotPromise) {
      snapshotPromise = originalFetch(SNAPSHOT_URL, {
        cache: "no-store",
        headers: { accept: "application/json" }
      }).then(async (response) => {
        if (!response.ok) throw new Error(`static_catalog_http_${response.status}`);
        const payload = await response.json();
        const items = Array.isArray(payload.items) ? payload.items : [];
        vehicleById = new Map(items.map((item) => [String(item.id), item]));
        queueMicrotask(patchCurrencyUi);
        return { updatedAt: payload.updatedAt || null, items };
      });
    }
    return snapshotPromise;
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  function buildFacets(items) {
    const active = items.filter((vehicle) => vehicle.status === "active");
    const source = active.length ? active : items;
    const statusCounts = items.reduce((acc, vehicle) => {
      const status = clean(vehicle.status) || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      brands: uniqueSorted([...selectValues("catalogBrand"), ...source.map((vehicle) => vehicle.brand)]),
      cities: uniqueSorted(source.map((vehicle) => vehicle.city)),
      bodies: uniqueSorted([...selectValues("catalogBody"), ...source.map((vehicle) => vehicle.body)]),
      engines: uniqueSorted([...selectValues("catalogEngine"), ...source.map((vehicle) => vehicle.energyType)]),
      year: range(source.map((vehicle) => vehicle.year)),
      price: range(source.map((vehicle) => vehicle.price)),
      mileage: range(source.map((vehicle) => vehicle.mileage)),
      statusCounts: {
        active: statusCounts.active || 0,
        inactive: statusCounts.inactive || 0,
        unknown: statusCounts.unknown || 0
      }
    };
  }

  function compareNumbers(left, right, direction = 1) {
    const a = numberValue(left);
    const b = numberValue(right);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a - b) * direction;
  }

  function filteredPayload(items, params, updatedAt) {
    let result = [...items];
    const status = clean(params.get("status")) || (params.get("include_inactive") === "1" ? "all" : "active");
    const brand = clean(params.get("brand"));
    const city = clean(params.get("city"));
    const body = clean(params.get("body"));
    const engine = lower(params.get("engine"));
    const q = lower(params.get("q"));
    const year = numberValue(params.get("year"));
    const yearMin = numberValue(params.get("year_min"));
    const yearMax = numberValue(params.get("year_max"));
    const priceMin = numberValue(params.get("price_min"));
    const priceMax = numberValue(params.get("price_max"));
    const mileageMin = numberValue(params.get("mileage_min"));
    const mileageMax = numberValue(params.get("mileage_max"));
    const sort = clean(params.get("sort")) || "updated-desc";

    if (status !== "all") result = result.filter((vehicle) => vehicle.status === status);
    if (brand) result = result.filter((vehicle) => vehicle.brand === brand);
    if (city) result = result.filter((vehicle) => vehicle.city === city);
    if (body) result = result.filter((vehicle) => vehicle.body === body);
    if (engine) {
      result = result.filter((vehicle) => {
        const energy = lower(vehicle.energyType);
        const motor = lower(vehicle.engine);
        return energy === engine || energy.includes(engine) || motor.includes(engine);
      });
    }
    if (year !== null) result = result.filter((vehicle) => numberValue(vehicle.year) === year);
    if (yearMin !== null) result = result.filter((vehicle) => numberValue(vehicle.year) !== null && numberValue(vehicle.year) >= yearMin);
    if (yearMax !== null) result = result.filter((vehicle) => numberValue(vehicle.year) !== null && numberValue(vehicle.year) <= yearMax);
    if (priceMin !== null) result = result.filter((vehicle) => numberValue(vehicle.price) !== null && numberValue(vehicle.price) >= priceMin);
    if (priceMax !== null) result = result.filter((vehicle) => numberValue(vehicle.price) !== null && numberValue(vehicle.price) <= priceMax);
    if (mileageMin !== null) result = result.filter((vehicle) => numberValue(vehicle.mileage) !== null && numberValue(vehicle.mileage) >= mileageMin);
    if (mileageMax !== null) result = result.filter((vehicle) => numberValue(vehicle.mileage) !== null && numberValue(vehicle.mileage) <= mileageMax);
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

    if (sort === "year-desc") result.sort((a, b) => compareNumbers(a.year, b.year, -1));
    if (sort === "year-asc") result.sort((a, b) => compareNumbers(a.year, b.year, 1));
    if (sort === "price-asc") result.sort((a, b) => compareNumbers(a.price, b.price, 1));
    if (sort === "price-desc") result.sort((a, b) => compareNumbers(a.price, b.price, -1));
    if (sort === "mileage-asc") result.sort((a, b) => compareNumbers(a.mileage, b.mileage, 1));
    if (sort === "mileage-desc") result.sort((a, b) => compareNumbers(a.mileage, b.mileage, -1));
    if (sort === "updated-desc") result.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get("page_size") || params.get("limit") || "24", 10) || 24));
    const requestedPage = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
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

  function isCatalogApiUrl(url) {
    return /\/api\/vehicles(?:\/facets|\/[^/?#]+)?$/.test(url.pathname);
  }

  async function staticCatalogResponse(url) {
    const snapshot = await loadSnapshot();
    const path = url.pathname;
    if (path.endsWith("/api/vehicles/facets")) {
      return jsonResponse({ facets: buildFacets(snapshot.items), updatedAt: snapshot.updatedAt });
    }

    const detailMatch = path.match(/\/api\/vehicles\/([^/?#]+)$/);
    if (detailMatch) {
      const id = decodeURIComponent(detailMatch[1]);
      const vehicle = vehicleById.get(id);
      return vehicle ? jsonResponse({ vehicle }) : jsonResponse({ error: "vehicle_not_found" }, 404);
    }

    if (path.endsWith("/api/vehicles")) {
      return jsonResponse(filteredPayload(snapshot.items, url.searchParams, snapshot.updatedAt));
    }

    return jsonResponse({ error: "not_found" }, 404);
  }

  window.fetch = async function avtocheckCatalogFetch(input, init) {
    const rawUrl = typeof input === "string" || input instanceof URL ? input : input?.url;
    const url = new URL(rawUrl, window.location.href);
    if (!isCatalogApiUrl(url)) return originalFetch(input, init);

    if (!preferStatic) {
      try {
        const response = await originalFetch(input, init);
        if (response.ok) return response;
      } catch (_) {}
    }

    try {
      return await staticCatalogResponse(url);
    } catch (staticError) {
      if (preferStatic) {
        try { return await originalFetch(input, init); } catch (_) {}
      }
      throw staticError;
    }
  };

  const observer = new MutationObserver(() => patchCurrencyUi());
  const startObserver = () => observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) startObserver();
})();
