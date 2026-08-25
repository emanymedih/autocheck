(() => {
  const selector = "#catalogEngine";

  function priority(label) {
    const value = String(label || "").trim().toLocaleLowerCase("ru-RU");
    if (!value) return -100;
    if (value.includes("бенз")) return 10;
    if (value.includes("диз")) return 20;
    if (value.includes("phev") || value.includes("подключаем")) return 40;
    if (value.includes("erev") || value.includes("увеличителем запаса хода")) return 50;
    if (value.includes("mhev") || value.includes("48v") || value.includes("мягкий гибрид")) return 60;
    if (value.includes("hev") || value === "гибрид") return 30;
    if (value.includes("элект")) return 70;
    if (value.includes("проч")) return 80;
    if (value.includes("метан")) return 90;
    if (value.includes("газ") || value.includes("lpg") || value.includes("cng")) return 100;
    return 85;
  }

  function reorderEnergyOptions() {
    const select = document.querySelector(selector);
    if (!select || select.options.length < 2) return;

    const preferred = select.value;
    const options = [...select.options];
    const empty = options.find((option) => option.value === "") || null;
    const rest = options
      .filter((option) => option !== empty)
      .sort((a, b) => {
        const delta = priority(a.textContent) - priority(b.textContent);
        return delta || a.textContent.localeCompare(b.textContent, "ru");
      });

    const desired = [empty, ...rest].filter(Boolean);
    const current = [...select.options];
    const alreadyOrdered = desired.length === current.length && desired.every((option, index) => option === current[index]);
    if (alreadyOrdered) return;

    desired.forEach((option) => select.appendChild(option));
    if (preferred && desired.some((option) => option.value === preferred)) select.value = preferred;
  }

  reorderEnergyOptions();

  const observer = new MutationObserver(() => reorderEnergyOptions());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
