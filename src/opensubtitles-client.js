const DEFAULT_BASE_URL = "https://api.opensubtitles.com/api/v1";
const ALLOWED_API_HOSTS = new Set([
  "api.opensubtitles.com",
  "vip-api.opensubtitles.com",
]);

export class OpenSubtitlesError extends Error {
  constructor(message, code = "api_error", statusCode = 0) {
    super(message);
    this.name = "OpenSubtitlesError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function normalizeBaseUrl(value) {
  if (!value) return DEFAULT_BASE_URL;

  const candidate = value.includes("://") ? value : `https://${value}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return DEFAULT_BASE_URL;
  }

  if (parsed.protocol !== "https:" || !ALLOWED_API_HOSTS.has(parsed.hostname)) {
    return DEFAULT_BASE_URL;
  }

  const pathname = parsed.pathname.replace(/\/$/, "");
  return `${parsed.origin}${pathname.endsWith("/api/v1") ? pathname : "/api/v1"}`;
}

export function createOpenSubtitlesClient({
  http,
  apiKey,
  token = "",
  baseUrl = DEFAULT_BASE_URL,
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  function headers(authenticated = true) {
    const value = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Api-Key": apiKey,
      "User-Agent": "IINAOpenSubtitlesPTBR v0.1.3",
    };
    if (authenticated && token) value.Authorization = `Bearer ${token}`;
    return value;
  }

  async function request(method, path, options = {}) {
    // The API only serves a canonical query string and redirects anything else
    // with a 301, so build it here instead of letting the host encode `params`.
    const query = canonicalQuery(options.params);
    let response;
    try {
      response = await http[method](`${normalizedBaseUrl}${path}${query}`, {
        headers: headers(options.authenticated !== false),
        params: {},
        data: options.data ?? {},
      });
    } catch (error) {
      throw requestError(error);
    }

    if (!response) {
      throw new OpenSubtitlesError(
        "O IINA bloqueou a solicitação ao OpenSubtitles.",
        "network",
      );
    }

    const body = parseBody(response);
    assertSuccessful(response.statusCode, body);
    return body;
  }

  return {
    login(username, password) {
      return request("post", "/login", {
        authenticated: false,
        data: { username, password },
      });
    },

    async search(params) {
      const body = await request("get", "/subtitles", { params });
      return Array.isArray(body.data) ? body.data : [];
    },

    requestDownload(fileId) {
      return request("post", "/download", { data: { file_id: fileId } });
    },
  };
}

export function canonicalQuery(params) {
  const entries = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key.toLowerCase(), String(value).trim().toLowerCase()])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  if (!entries.length) return "";

  // encodeURIComponent leaves spaces as %20, which the API rejects with a 301.
  const encode = (value) => encodeURIComponent(value).replace(/%20/g, "+");
  return `?${entries.map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&")}`;
}

function requestError(error) {
  if (error instanceof OpenSubtitlesError) return error;

  if (error && typeof error === "object") {
    const body = parseBody(error);
    const statusCode = Number(error.statusCode || 0);
    if (statusCode) {
      try {
        assertSuccessful(statusCode, body);
      } catch (mappedError) {
        return mappedError;
      }
    }

    const detail = body?.message || error.reason || error.description || "";
    return new OpenSubtitlesError(
      detail
        ? `Não foi possível acessar o OpenSubtitles: ${detail}`
        : "Não foi possível conectar ao OpenSubtitles. Verifique sua internet e tente novamente.",
      "network",
      statusCode,
    );
  }

  return new OpenSubtitlesError(
    typeof error === "string" && error
      ? `Não foi possível acessar o OpenSubtitles: ${error}`
      : "Não foi possível conectar ao OpenSubtitles. Verifique sua internet e tente novamente.",
    "network",
  );
}

function parseBody(response) {
  if (response?.data && typeof response.data === "object") return response.data;
  if (!response?.text) return {};

  try {
    return JSON.parse(response.text);
  } catch {
    throw new OpenSubtitlesError(
      "O OpenSubtitles retornou uma resposta inválida.",
      "invalid_response",
      response?.statusCode ?? 0,
    );
  }
}

function assertSuccessful(statusCode, body) {
  if (statusCode >= 200 && statusCode < 300) return;

  const apiMessage = body?.message || body?.error || "";
  if (statusCode === 401 || statusCode === 403) {
    throw new OpenSubtitlesError(
      "Credenciais do OpenSubtitles inválidas ou expiradas.",
      "authentication",
      statusCode,
    );
  }
  if (statusCode === 406) {
    throw new OpenSubtitlesError(
      "A cota diária de downloads do OpenSubtitles foi atingida.",
      "quota",
      statusCode,
    );
  }
  if (statusCode === 429) {
    throw new OpenSubtitlesError(
      "Muitas solicitações ao OpenSubtitles. Aguarde e tente novamente.",
      "rate_limit",
      statusCode,
    );
  }

  throw new OpenSubtitlesError(
    apiMessage || `Falha no OpenSubtitles (HTTP ${statusCode || "desconhecido"}).`,
    "api_error",
    statusCode,
  );
}

export { DEFAULT_BASE_URL, requestError };
