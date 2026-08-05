const form = document.querySelector("#credentials-form");
const status = document.querySelector("#status");
const clearButton = document.querySelector("#clear");
const submitButton = form.querySelector('button[type="submit"]');
const fields = {
  apiKey: document.querySelector("#api-key"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
};

function setStatus(message, kind = "") {
  status.textContent = message;
  status.dataset.kind = kind;
}

function clearFields() {
  Object.values(fields).forEach((field) => {
    field.value = "";
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus("Salvando e validando…");
  submitButton.disabled = true;
  clearButton.disabled = true;

  window.iina.postMessage("credentials-save", {
    apiKey: fields.apiKey.value.trim(),
    username: fields.username.value.trim(),
    password: fields.password.value,
  });
});

clearButton.addEventListener("click", () => {
  if (window.confirm("Remover as credenciais do Chaves do macOS?")) {
    submitButton.disabled = true;
    clearButton.disabled = true;
    window.iina.postMessage("credentials-clear", null);
  }
});

window.iina.onMessage("credentials-status", (payload) => {
  submitButton.disabled = false;
  clearButton.disabled = false;

  if (payload.ok) {
    clearFields();
  }

  setStatus(payload.message, payload.ok ? "success" : payload.configured ? "warning" : "error");
});

window.iina.postMessage("credentials-status-request", null);
