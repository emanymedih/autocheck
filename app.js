const form = document.getElementById("vinForm");
const input = document.getElementById("vinInput");
const error = document.getElementById("vinError");
const result = document.getElementById("resultCard");
const resultVin = document.getElementById("resultVin");

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

input.addEventListener("input", () => {
  const normalized = input.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);

  input.value = normalized;
  error.textContent = "";
  result.hidden = true;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const vin = input.value.trim().toUpperCase();

  if (!VIN_RE.test(vin)) {
    error.textContent = "Проверьте VIN: нужно 17 символов. Буквы I, O и Q в стандартном VIN не используются.";
    input.focus();
    return;
  }

  error.textContent = "";
  resultVin.textContent = vin;
  result.hidden = false;
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
