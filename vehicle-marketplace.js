(() => {
  if (!document.querySelector('script[data-marketplace-header-loader]')) {
    const script = document.createElement("script");
    script.src = new URL("marketplace-header.js?v=20260825-1", document.baseURI).href;
    script.defer = true;
    script.dataset.marketplaceHeaderLoader = "1";
    document.head.appendChild(script);
  }
})();

(() => {
  const GRADE_FIELDS = ["reportGrade", "inspectionGrade", "evaluationGrade", "grade", "inspectionScore", "reportScore"];

  function clean(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function extraSpecValue(vehicle, labels) {
    const wanted = labels.map((label) => label.toLocaleLowerCase("ru-RU"));
    const item = Array.isArray(vehicle?.extraSpecs)
      ? vehicle.extraSpecs.find((entry) => wanted.includes(clean(entry?.label).toLocaleLowerCase("ru-RU")))
      : null;
    return clean(item?.value);
  }

  function currentVehicle() {
    try {
      return typeof activeVehicle !== "undefined" ? activeVehicle : null;
    } catch (_) {
      return null;
    }
  }

  function reportGrade(vehicle) {
    for (const key of GRADE_FIELDS) {
      const value = clean(vehicle?.[key]);
      if (value) return /^оценка\s/i.test(value) ? value : `Оценка ${value}`;
    }
    const fromSpecs = extraSpecValue(vehicle, ["Оценка", "Оценка состояния", "Итоговая оценка"]);
    return fromSpecs ? (/^оценка\s/i.test(fromSpecs) ? fromSpecs : `Оценка ${fromSpecs}`) : "После проверки";
  }

  function relabelOwnership() {
    const rows = document.querySelectorAll("#vehicleOwnershipList .vehicle-info-row");
    rows.forEach((row) => {
      const label = row.querySelector("span");
      if (!label) return;
      if (label.textContent.trim() === "Регистрация") label.textContent = "Первая регистрация";
      if (label.textContent.trim() === "Переоформления") label.textContent = "Смен владельца";
    });

    const vehicle = currentVehicle();
    const root = document.getElementById("vehicleOwnershipList");
    if (!vehicle || !root) return;

    const additions = [
      ["Тип использования", extraSpecValue(vehicle, ["Тип использования", "Назначение", "Использование"])],
      ["Регион регистрации", extraSpecValue(vehicle, ["Регион регистрации", "Место регистрации"])],
      ["VIN", clean(vehicle.vin)]
    ].filter(([, value]) => value);

    const labels = new Set([...root.querySelectorAll(".vehicle-info-row span")].map((node) => node.textContent.trim()));
    additions.forEach(([label, value]) => {
      if (labels.has(label)) return;
      const row = document.createElement("div");
      row.className = "vehicle-info-row";
      const name = document.createElement("span");
      name.textContent = label;
      const data = document.createElement("strong");
      data.textContent = value;
      row.append(name, data);
      root.appendChild(row);
    });
  }

  function improveQuickSpecs() {
    const vehicle = currentVehicle();
    const root = document.getElementById("vehicleQuickSpecs");
    if (!vehicle || !root) return;
    const first = root.querySelector(".vehicle-quick-spec");
    const label = first?.querySelector("span");
    const value = first?.querySelector("strong");
    const trim = clean(vehicle.trim);
    if (label?.textContent.trim() === "Комплектация" && value && trim && value.textContent.trim() !== trim) value.textContent = trim;
  }

  function updateHistoryGrade() {
    const vehicle = currentVehicle();
    const target = document.getElementById("vehicleReportGrade");
    if (!target) return;
    const next = reportGrade(vehicle || {});
    if (target.textContent.trim() !== next) target.textContent = next;
  }

  function updateSourceCopy() {
    const vehicle = currentVehicle();
    const context = document.getElementById("vehiclePriceContext");
    if (context && context.textContent.trim() === "Цена площадки") context.textContent = "Цена предложения";

    const footer = document.getElementById("vehiclePlatformFooter");
    if (footer) {
      const platform = clean(vehicle?.listingPlatform || vehicle?.sourcePlatform || vehicle?.marketplace)
        || document.getElementById("vehiclePlatform")?.textContent
        || "Каталог Авточек";
      if (footer.textContent.trim() !== platform) footer.textContent = platform;
    }

    const description = document.getElementById("vehicleDescription");
    if (description && vehicle && !clean(vehicle.description)) {
      const fallback = "Описание продавца по этой карточке не передано.";
      if (description.textContent.trim() !== fallback) description.textContent = fallback;
    }

    const secondary = document.getElementById("requestVehicleReportSecondary");
    if (secondary && !secondary.disabled && secondary.textContent.trim() !== "Запросить полный отчёт") secondary.textContent = "Запросить полный отчёт";
  }

  function update() {
    relabelOwnership();
    improveQuickSpecs();
    updateHistoryGrade();
    updateSourceCopy();
  }

  const watchedIds = ["vehicleTitle", "vehicleOwnershipList", "vehicleQuickSpecs", "vehiclePlatform", "vehiclePriceContext", "vehicleDescription"];
  watchedIds.forEach((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    const observer = new MutationObserver(() => requestAnimationFrame(update));
    observer.observe(node, { childList: true, characterData: true, subtree: true });
  });

  window.addEventListener("load", () => requestAnimationFrame(update), { once: true });
  requestAnimationFrame(update);
})();
