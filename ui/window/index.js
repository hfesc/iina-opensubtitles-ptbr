window.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#credentials-form");
  const status = document.querySelector("#status");
  const summary = document.querySelector("#credentials-summary");
  const clearButton = document.querySelector("#clear");
  const submitButton = form.querySelector('button[type="submit"]');
  const fields = {
    apiKey: document.querySelector("#api-key"),
    username: document.querySelector("#username"),
    password: document.querySelector("#password"),
  };
  const summaryFields = {
    apiKey: document.querySelector("#saved-api-key"),
    username: document.querySelector("#saved-username"),
    password: document.querySelector("#saved-password"),
  };
  let statusReceived = false;
  let statusAttempts = 0;

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function clearFields() {
    Object.values(fields).forEach((field) => {
      field.value = "";
    });
  }

  function setPending(pending) {
    submitButton.disabled = pending;
    clearButton.disabled = pending;
  }

  function renderCredentialSummary(payload) {
    const username = typeof payload.username === "string" ? payload.username : "";
    summary.hidden = false;
    summaryFields.apiKey.textContent = payload.apiKeySaved ? "Salva" : "Não salva";
    summaryFields.username.textContent = username || "Não salvo (opcional)";
    summaryFields.password.textContent = payload.passwordSaved
      ? "Salva"
      : "Não salva (opcional)";
    fields.apiKey.placeholder = payload.apiKeySaved
      ? "Chave salva — deixe vazio para manter"
      : "Informe a chave da API";
    fields.username.placeholder = username
      ? `Usuário salvo: ${username} — deixe vazio para manter`
      : "Opcional";
    fields.password.placeholder = payload.passwordSaved
      ? "Senha salva — deixe vazio para manter"
      : "Opcional";
  }

  function requestCredentialStatus() {
    if (statusReceived || statusAttempts >= 5) return;
    statusAttempts += 1;
    window.iina.postMessage("credentials-status-request", null);
    window.setTimeout(requestCredentialStatus, statusAttempts * 250);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setStatus("Salvando e validando…");
    setPending(true);
    window.iina.postMessage("credentials-save", {
      apiKey: fields.apiKey.value.trim(),
      username: fields.username.value.trim(),
      password: fields.password.value,
    });
  });

  clearButton.addEventListener("click", () => {
    if (window.confirm("Remover as credenciais deste plugin?")) {
      setPending(true);
      window.iina.postMessage("credentials-clear", null);
    }
  });

  window.iina.onMessage("credentials-status", (payload) => {
    statusReceived = true;
    setPending(false);
    renderCredentialSummary(payload);

    if (payload.ok) {
      clearFields();
    }

    setStatus(payload.message, payload.ok ? "success" : payload.configured ? "warning" : "error");
  });

  window.setTimeout(() => {
    if (!statusReceived) {
      setPending(false);
      setStatus(
        "Não foi possível verificar a configuração. Feche e abra esta janela novamente.",
        "error",
      );
    }
  }, 3000);

  requestCredentialStatus();
});
