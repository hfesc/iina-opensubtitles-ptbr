import {
  createOpenSubtitlesClient,
  DEFAULT_BASE_URL,
  normalizeBaseUrl,
} from "./opensubtitles-client.js";

const SERVICE = "iina-opensubtitles-ptbr";
const TOKEN_LIFETIME_MS = 23 * 60 * 60 * 1000;
const KEYCHAIN_NAMES = {
  apiKey: "api-key",
  username: "username",
  password: "password",
  token: "jwt-token",
};

export function createAuth({ utils, preferences, http }) {
  function readCredentials() {
    return {
      apiKey: readSecret(utils, KEYCHAIN_NAMES.apiKey),
      username: readSecret(utils, KEYCHAIN_NAMES.username),
      password: readSecret(utils, KEYCHAIN_NAMES.password),
    };
  }

  function configured() {
    const credentials = readCredentials();
    return Boolean(credentials.apiKey && credentials.username && credentials.password);
  }

  function storeCredentials(credentials) {
    let changed = false;
    for (const key of ["apiKey", "username", "password"]) {
      const value = credentials[key];
      if (value) {
        writeSecret(utils, KEYCHAIN_NAMES[key], value);
        changed = true;
      }
    }
    if (changed) clearToken();
    preferences.set("credentialsConfigured", configured());
    preferences.sync();
    return configured();
  }

  function clearCredentials() {
    let failed = false;
    for (const name of Object.values(KEYCHAIN_NAMES)) {
      try {
        writeSecret(utils, name, "");
      } catch {
        failed = true;
      }
    }
    preferences.set("credentialsConfigured", false);
    preferences.set("tokenExpiresAt", 0);
    preferences.set("apiBaseUrl", DEFAULT_BASE_URL);
    preferences.sync();
    if (failed) throw new Error("Não foi possível remover todos os dados do Chaves do macOS.");
  }

  function clearToken() {
    writeSecret(utils, KEYCHAIN_NAMES.token, "");
    preferences.set("tokenExpiresAt", 0);
    preferences.set("apiBaseUrl", DEFAULT_BASE_URL);
    preferences.sync();
  }

  async function authenticate(force = false) {
    const credentials = readCredentials();
    if (!credentials.apiKey || !credentials.username || !credentials.password) {
      throw new Error("Configure a chave da API e sua conta do OpenSubtitles primeiro.");
    }

    const expiresAt = Number(preferences.get("tokenExpiresAt") || 0);
    const cachedToken = readSecret(utils, KEYCHAIN_NAMES.token);
    const baseUrl = normalizeBaseUrl(preferences.get("apiBaseUrl"));
    if (!force && cachedToken && expiresAt > Date.now()) {
      return { ...credentials, token: cachedToken, baseUrl };
    }

    const anonymousClient = createOpenSubtitlesClient({
      http,
      apiKey: credentials.apiKey,
      baseUrl: DEFAULT_BASE_URL,
    });
    const response = await anonymousClient.login(credentials.username, credentials.password);
    if (!response?.token) throw new Error("O OpenSubtitles não retornou um token de acesso.");

    const nextBaseUrl = normalizeBaseUrl(response.base_url);
    writeSecret(utils, KEYCHAIN_NAMES.token, response.token);
    preferences.set("tokenExpiresAt", Date.now() + TOKEN_LIFETIME_MS);
    preferences.set("apiBaseUrl", nextBaseUrl);
    preferences.set("credentialsConfigured", true);
    preferences.sync();

    return { ...credentials, token: response.token, baseUrl: nextBaseUrl };
  }

  return {
    authenticate,
    clearCredentials,
    clearToken,
    configured,
    readCredentials,
    storeCredentials,
  };
}

function readSecret(utils, name) {
  const value = utils.keychainRead(SERVICE, name);
  return typeof value === "string" ? value : "";
}

function writeSecret(utils, name, value) {
  if (!utils.keychainWrite(SERVICE, name, value)) {
    throw new Error("Não foi possível acessar o Chaves do macOS.");
  }
}

export { KEYCHAIN_NAMES, SERVICE, TOKEN_LIFETIME_MS };
