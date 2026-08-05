import { createAuth } from "./auth.js";
import { downloadSubtitle } from "./download.js";
import { buildSearchParams } from "./media-query.js";
import { createOpenSubtitlesClient, OpenSubtitlesError } from "./opensubtitles-client.js";
import { describeResult, prepareResults } from "./results.js";

const {
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
standaloneWindow.setFrame(500, 480);
standaloneWindow.loadFile("dist/ui/window/index.html");

menu.addItem(menu.item("Configurar OpenSubtitles…", () => {
  standaloneWindow.open();
  postCredentialStatus();
}));

standaloneWindow.onMessage("credentials-status-request", postCredentialStatus);
standaloneWindow.onMessage("credentials-clear", () => {
  try {
    auth.clearCredentials();
    postCredentialStatus("Credenciais removidas.", true);
  } catch (error) {
    postCredentialStatus(messageFor(error), false);
  }
});
standaloneWindow.onMessage("credentials-save", async (payload) => {
  try {
    if (!payload || !auth.storeCredentials(payload)) {
      throw new Error("Preencha os três campos na primeira configuração.");
    }
    await auth.authenticate(true);
    postCredentialStatus("Credenciais salvas e validadas.", true);
  } catch (error) {
    try {
      auth.clearToken();
    } catch {
      // Preserve the original error so the configuration window can display it.
    }
    postCredentialStatus(messageFor(error), false);
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
        if (!(error instanceof OpenSubtitlesError) || error.code !== "authentication") throw error;
        auth.clearToken();
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
  const configured = auth.configured();
  standaloneWindow.postMessage("credentials-status", {
    configured,
    ok,
    message: message || (configured
      ? "Credenciais configuradas no Chaves do macOS."
      : "Credenciais ainda não configuradas."),
  });
}

function handleError(error) {
  core.osd(messageFor(error));
}

function messageFor(error) {
  if (error instanceof OpenSubtitlesError || error instanceof Error) return error.message;
  return "Não foi possível acessar o OpenSubtitles.";
}
