const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

function normalizeVin(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);
}

function wireVinForm({ formId, inputId, errorId, showResult = false }) {
  const form = document.getElementById(formId);
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);

  if (!form || !input || !error) return;

  input.addEventListener("input", () => {
    input.value = normalizeVin(input.value);
    error.textContent = "";

    const result = document.getElementById("resultCard");
    if (result) result.hidden = true;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const vin = normalizeVin(input.value.trim());
    input.value = vin;

    if (!VIN_RE.test(vin)) {
      error.textContent = "Проверьте VIN: нужно 17 символов. Буквы I, O и Q в стандартном VIN не используются.";
      input.focus();
      return;
    }

    error.textContent = "";

    const mainInput = document.getElementById("vinInput");
    const bottomInput = document.getElementById("vinInputBottom");
    if (mainInput) mainInput.value = vin;
    if (bottomInput) bottomInput.value = vin;

    const result = document.getElementById("resultCard");
    const resultVin = document.getElementById("resultVin");
    if (result && resultVin) {
      resultVin.textContent = vin;
      result.hidden = false;
      if (showResult) {
        result.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        document.getElementById("check")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
}

wireVinForm({ formId: "vinForm", inputId: "vinInput", errorId: "vinError", showResult: true });
wireVinForm({ formId: "vinFormBottom", inputId: "vinInputBottom", errorId: "vinErrorBottom", showResult: false });
