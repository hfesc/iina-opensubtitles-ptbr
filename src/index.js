import { createAuth } from "./auth.js";
import { downloadSubtitle } from "./download.js";
import { buildSearchParams } from "./media-query.js";
import { createOpenSubtitlesClient, OpenSubtitlesError } from "./opensubtitles-client.js";
import { describeResult, prepareResults } from "./results.js";

const {
  console,
  core,
  http,
  menu,
  standaloneWindow,
  subtitle,
  utils,
  preferences,
} = iina;

const auth = createAuth({ utils, preferences, http });

standaloneWindow.setProperty({
  title: "Configurar OpenSubtitles",
  resizable: false,
  hudWindow: false,
});
standaloneWindow.setFrame(500, 580);
standaloneWindow.loadFile("dist/ui/window/index.html");

menu.addItem(menu.item("Configurar OpenSubtitles…", () => {
  standaloneWindow.open();
}));

standaloneWindow.onMessage("credentials-status-request", postCredentialStatus);
standaloneWindow.onMessage("credentials-clear", () => {
  try {
    auth.disableCredentials();
    postCredentialStatus("Credenciais desativadas. Use o Acesso às Chaves para remoção física.", true);
  } catch (error) {
    postCredentialStatus(messageFor(error), false);
  }
});
standaloneWindow.onMessage("credentials-save", async (payload) => {
  try {
    if (!payload || !auth.storeCredentials(payload)) {
      throw new Error("Informe ao menos a chave da API na primeira configuração.");
    }
    const session = await auth.authenticate(true);
    postCredentialStatus(
      session.token
        ? "Chave e conta salvas e validadas."
        : "Chave da API salva. Sem conta vinculada, o limite é de 100 downloads por dia.",
      true,
    );
  } catch (error) {
    auth.invalidateToken();
    const message = messageFor(error);
    console.error(`[OpenSubtitles PT-BR] Falha ao validar credenciais: ${message}`);
    postCredentialStatus(message, false);
  }
});

subtitle.registerProvider("opensub-ptbr", {
  async search() {
    try {
      const params = buildSearchParams({
        url: core.status.url,
        title: core.status.title,
        isNetworkResource: core.status.isNetworkResource,
      });
      if (!params) throw new Error("Abra um vídeo antes de buscar legendas.");

      const session = await auth.authenticate();
      const client = sessionClient(session);
      const results = prepareResults(await client.search(params));
      if (!results.length) core.osd("Nenhuma legenda PT-BR encontrada.");
      return results.map((result) => subtitle.item(result));
    } catch (error) {
      handleError(error);
      return [];
    }
  },

  description(item) {
    return describeResult(item);
  },

  async download(item) {
    try {
      let session = await auth.authenticate();
      try {
        return await downloadSubtitle({ item, client: sessionClient(session), http, utils });
      } catch (error) {
        // Retrying only helps when an account token can be refreshed.
        if (!session.token) throw error;
        if (!(error instanceof OpenSubtitlesError) || error.code !== "authentication") throw error;
        auth.invalidateToken();
        session = await auth.authenticate(true);
        return await downloadSubtitle({ item, client: sessionClient(session), http, utils });
      }
    } catch (error) {
      handleError(error);
      throw error;
    }
  },
});

function sessionClient(session) {
  return createOpenSubtitlesClient({
    http,
    apiKey: session.apiKey,
    token: session.token,
    baseUrl: session.baseUrl,
  });
}

function postCredentialStatus(message = "", ok = false) {
  const credentialStatus = auth.credentialStatus();
  standaloneWindow.postMessage("credentials-status", {
    ...credentialStatus,
    ok,
    message: message || (credentialStatus.configured
      ? credentialStatus.accountLinked
        ? "Chave da API e conta configuradas no Chaves do macOS."
        : "Chave da API configurada. Sem conta vinculada, o limite é de 100 downloads por dia."
      : "Chave da API ainda não configurada."),
  });
}

function handleError(error) {
  const message = messageFor(error);
  console.error(`[OpenSubtitles PT-BR] ${message}`);
  core.osd(message);
}

function messageFor(error) {
  if (error instanceof OpenSubtitlesError || error instanceof Error) return error.message;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    return error.message || error.reason || error.description ||
      `Falha no OpenSubtitles (HTTP ${error.statusCode || "desconhecido"}).`;
  }
  return "Não foi possível acessar o OpenSubtitles.";
}
