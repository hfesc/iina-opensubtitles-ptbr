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

  function credentialStatus() {
    const credentials = readCredentials();
    return {
      // The plugin is configured if the user explicitly enabled it and we have a key.
      configured: configured() && Boolean(credentials.apiKey),
      accountLinked: Boolean(credentials.username && credentials.password),
      username: credentials.username,
      apiKeySaved: Boolean(credentials.apiKey),
      passwordSaved: Boolean(credentials.password),
    };
  }

  function configured() {
    // If the preference is unset, fall back to checking if we physically have a key,
    // to preserve backwards compatibility with users upgrading from v0.1.x
    const pref = preferences.get("credentialsConfigured");
    if (pref === undefined || pref === null) {
      return Boolean(readCredentials().apiKey);
    }
    return pref === true;
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
    if (changed) invalidateToken();
    preferences.set("credentialsConfigured", configured());
    preferences.sync();
    return configured();
  }

  function disableCredentials() {
    preferences.set("credentialsConfigured", false);
    invalidateToken();
  }

  function invalidateToken() {
    preferences.set("tokenExpiresAt", 0);
    preferences.set("apiBaseUrl", DEFAULT_BASE_URL);
    preferences.sync();
  }

  async function authenticate(force = false) {
    if (!configured()) {
      throw new Error("Configure a chave da API do OpenSubtitles primeiro.");
    }

    const credentials = readCredentials();
    if (!credentials.apiKey) {
      throw new Error("Configure a chave da API do OpenSubtitles primeiro.");
    }

    // Without an account the API key still authorizes searches and the
    // anonymous download quota, so return a session with no token.
    if (!credentials.username || !credentials.password) {
      return { ...credentials, token: "", baseUrl: DEFAULT_BASE_URL };
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
    disableCredentials,
    invalidateToken,
    configured,
    credentialStatus,
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
