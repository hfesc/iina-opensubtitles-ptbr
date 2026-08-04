import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenSubtitlesClient,
  normalizeBaseUrl,
  OpenSubtitlesError,
} from "../src/opensubtitles-client.js";

test("normalizes only official HTTPS API hosts", () => {
  assert.equal(normalizeBaseUrl("vip-api.opensubtitles.com"), "https://vip-api.opensubtitles.com/api/v1");
  assert.equal(normalizeBaseUrl("https://evil.example/api/v1"), "https://api.opensubtitles.com/api/v1");
  assert.equal(normalizeBaseUrl("http://api.opensubtitles.com"), "https://api.opensubtitles.com/api/v1");
});

test("sends the API key, JWT and PT-BR search parameters", async () => {
  let request;
  const http = {
    async get(url, options) {
      request = { url, options };
      return { statusCode: 200, data: { data: [{ id: "one" }] } };
    },
  };
  const client = createOpenSubtitlesClient({ http, apiKey: "test-key", token: "test-token" });
  const results = await client.search({ languages: "pt-br", query: "Filme" });

  assert.equal(results.length, 1);
  assert.equal(request.options.headers["Api-Key"], "test-key");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(request.options.params.languages, "pt-br");
});

test("does not send the JWT while logging in", async () => {
  let headers;
  const http = {
    async post(_url, options) {
      headers = options.headers;
      return { statusCode: 200, text: JSON.stringify({ token: "jwt" }) };
    },
  };
  await createOpenSubtitlesClient({ http, apiKey: "key", token: "old" }).login("user", "pass");
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers["Api-Key"], "key");
});

for (const [status, code] of [[401, "authentication"], [406, "quota"], [429, "rate_limit"]]) {
  test(`maps HTTP ${status} to ${code}`, async () => {
    const http = {
      async get() {
        return { statusCode: status, data: { message: "API details" } };
      },
    };
    await assert.rejects(
      () => createOpenSubtitlesClient({ http, apiKey: "key" }).search({}),
      (error) => error instanceof OpenSubtitlesError && error.code === code,
    );
  });
}

test("rejects malformed JSON responses", async () => {
  const http = {
    async get() {
      return { statusCode: 200, text: "not-json" };
    },
  };
  await assert.rejects(
    () => createOpenSubtitlesClient({ http, apiKey: "key" }).search({}),
    (error) => error.code === "invalid_response",
  );
});
