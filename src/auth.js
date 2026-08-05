import {
  createOpenSubtitlesClient,
  DEFAULT_BASE_URL,
  normalizeBaseUrl,
} from "./opensubtitles-client.js";

const TOKEN_LIFETIME_MS = 23 * 60 * 60 * 1000;
const PREF_NAMES = {
  apiKey: "os_api_key",
  username: "os_username",
  password: "os_password",
  token: "os_jwt_token",
};

export function createAuth({ preferences, http }) {
  function readCredentials() {
    return {
      apiKey: readPref(PREF_NAMES.apiKey),
      username: readPref(PREF_NAMES.username),
      password: readPref(PREF_NAMES.password),
    };
  }

  function credentialStatus() {
    const credentials = readCredentials();
    return {
      // The API key alone is enough to search and to download within the
      // anonymous daily quota; the account is optional and only raises it.
      configured: configured() && Boolean(credentials.apiKey),
      accountLinked: Boolean(credentials.username && credentials.password),
      username: credentials.username,
      apiKeySaved: Boolean(credentials.apiKey),
      passwordSaved: Boolean(credentials.password),
    };
  }

  function configured() {
    return preferences.get("credentialsConfigured") === true;
  }

  function storeCredentials(credentials) {
    let changed = false;
    for (const key of ["apiKey", "username", "password"]) {
      const value = credentials[key];
      if (value) {
        preferences.set(PREF_NAMES[key], value);
        changed = true;
      }
    }
    if (changed) invalidateToken();

    const hasKey = Boolean(readCredentials().apiKey);
    preferences.set("credentialsConfigured", hasKey);
    preferences.sync();

    return hasKey;
  }

  function disableCredentials() {
    preferences.set("credentialsConfigured", false);
    for (const name of Object.values(PREF_NAMES)) {
      preferences.set(name, "");
    }
    invalidateToken();
  }

  function invalidateToken() {
    preferences.set("tokenExpiresAt", 0);
    preferences.set("apiBaseUrl", DEFAULT_BASE_URL);
    preferences.set(PREF_NAMES.token, "");
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
    const cachedToken = readPref(PREF_NAMES.token);
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
    preferences.set(PREF_NAMES.token, response.token);
    preferences.set("tokenExpiresAt", Date.now() + TOKEN_LIFETIME_MS);
    preferences.set("apiBaseUrl", nextBaseUrl);
    preferences.set("credentialsConfigured", true);
    preferences.sync();

    return { ...credentials, token: response.token, baseUrl: nextBaseUrl };
  }

  function readPref(name) {
    const value = preferences.get(name);
    return typeof value === "string" ? value : "";
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

export { PREF_NAMES, TOKEN_LIFETIME_MS };
