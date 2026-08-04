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
      "User-Agent": "IINA OpenSubtitles PT-BR v1.0.0",
    };
    if (authenticated && token) value.Authorization = `Bearer ${token}`;
    return value;
  }

  async function request(method, path, options = {}) {
    const response = await http[method](`${normalizedBaseUrl}${path}`, {
      headers: headers(options.authenticated !== false),
      params: options.params ?? {},
      data: options.data ?? {},
    });
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

export { DEFAULT_BASE_URL };
