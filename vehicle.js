const VEHICLE_REFERENCE = {
  id: "cn-demo-003",
  title: "Audi A6L",
  year: 2022,
  trim: "45 TFSI",
  city: "Линьи",
  price: 252800,
  registration: "03.2022",
  engine: "2.0T",
  transmission: "Автомат",
  bodyColor: "Чёрный",
  interiorColor: "Тёмный",
  transfers: 1,
  reportAvailability: "unknown"
};

function vehicleVisual(view = "front") {
  const labels = { front: "Основное изображение", side: "Вид сбоку", rear: "Вид сзади" };
  const transform = view === "rear" ? "scale(-1 1) translate(-420 0)" : "";
  const shift = view === "side" ? 8 : 0;
  return `
    <svg viewBox="0 0 420 260" role="img" aria-label="${labels[view]}">
      <defs>
        <linearGradient id="car-${view}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151b1e"/><stop offset=".55" stop-color="#535f65"/><stop offset="1" stop-color="#a1aaad"/></linearGradient>
        <linearGradient id="bg-${view}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1ef"/><stop offset="1" stop-color="#dfe5e1"/></linearGradient>
      </defs>
      <rect width="420" height="260" fill="url(#bg-${view})"/>
      <ellipse cx="210" cy="208" rx="145" ry="17" fill="rgba(18,24,21,.13)"/>
      <g transform="translate(${shift} 0) ${transform}">
        <path d="M64 169c8-34 32-53 70-63l35-9c18-5 34-31 62-33h58c29 0 45 19 66 51l11 18c32 7 49 21 54 47l2 16H54l10-27z" fill="url(#car-${view})" stroke="#27312d" stroke-width="3"/>
        <path d="M164 102c20-10 32-28 62-30h49c22 2 36 15 56 48H136l28-18z" fill="#526b78" opacity=".74"/>
        <circle cx="127" cy="191" r="30" fill="#1d2320"/><circle cx="337" cy="191" r="30" fill="#1d2320"/>
        <circle cx="127" cy="191" r="13" fill="#aab3ae"/><circle cx="337" cy="191" r="13" fill="#aab3ae"/>
        <path d="M362 145l39 10-8 17-38-6z" fill="#e2eee8" opacity=".9"/>
      </g>
    </svg><span class="vehicle-gallery-label">${labels[view]}</span>`;
}

function installVehicleVisuals() {
  const targets = [
    ["vehicleMainVisual", "front"],
    ["vehicleVisualTwo", "side"],
    ["vehicleVisualThree", "rear"]
  ];
  targets.forEach(([id, view]) => {
    const target = document.getElementById(id);
    if (target) target.innerHTML = vehicleVisual(view);
  });
}

function openReportRequest() {
  const state = document.getElementById("vehicleRequestState");
  if (state) {
    state.hidden = false;
    state.innerHTML = `<strong>Автомобиль зафиксирован для проверки.</strong><br>Следующий backend-шаг: проверить доступность отчёта и вернуть пользователю цену до оплаты.`;
    state.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  try {
    sessionStorage.setItem("avtocheck-selected-vehicle", JSON.stringify({
      id: VEHICLE_REFERENCE.id,
      title: VEHICLE_REFERENCE.title,
      year: VEHICLE_REFERENCE.year,
      city: VEHICLE_REFERENCE.city,
      price: VEHICLE_REFERENCE.price,
      entry: "vehicle-card"
    }));
  } catch (_) {}
}

function initVehiclePage() {
  installVehicleVisuals();
  document.getElementById("requestVehicleReport")?.addEventListener("click", openReportRequest);
  document.getElementById("requestVehicleReportSecondary")?.addEventListener("click", openReportRequest);

  const params = new URLSearchParams(window.location.search);
  if (params.get("action") === "report") requestAnimationFrame(openReportRequest);
}

initVehiclePage();
