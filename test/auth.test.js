import assert from "node:assert/strict";
import test from "node:test";
import { createAuth, PREF_NAMES } from "../src/auth.js";

function harness(overrides = {}) {
  const values = new Map();
  const preferences = {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    sync() {},
  };
  return { values, preferences, ...overrides };
}

test("stores credentials in IINA preferences", () => {
  const setup = harness({ http: {} });
  const auth = createAuth(setup);
  assert.equal(auth.storeCredentials({ apiKey: "key", username: "user", password: "pass" }), true);
  assert.equal(auth.configured(), true);
  assert.equal(setup.values.get(PREF_NAMES.apiKey), "key");
  assert.equal(setup.values.get(PREF_NAMES.password), "pass");
});

test("treats the API key alone as configured, with the account optional", async () => {
  const setup = harness({
    http: {
      async post() {
        throw new Error("must not log in without an account");
      },
    },
  });
  const auth = createAuth(setup);
  auth.storeCredentials({ apiKey: "key" });

  assert.equal(auth.configured(), true);
  assert.equal(auth.credentialStatus().accountLinked, false);

  const session = await auth.authenticate();
  assert.equal(session.apiKey, "key");
  assert.equal(session.token, "");
});

test("requires the API key before searching", async () => {
  const auth = createAuth(harness({ http: {} }));
  await assert.rejects(() => auth.authenticate(), /chave da API/);
});

test("reports saved credentials without exposing secrets", () => {
  const setup = harness({ http: {} });
  const auth = createAuth(setup);
  auth.storeCredentials({ apiKey: "key", username: "user", password: "pass" });

  assert.deepEqual(auth.credentialStatus(), {
    configured: true,
    accountLinked: true,
    username: "user",
    apiKeySaved: true,
    passwordSaved: true,
  });
  assert.equal(Object.values(auth.credentialStatus()).includes("key"), false);
  assert.equal(Object.values(auth.credentialStatus()).includes("pass"), false);
});

test("logs in, caches the token and reuses it", async () => {
  let logins = 0;
  const setup = harness({
    http: {
      async post() {
        logins += 1;
        return { statusCode: 200, data: { token: "jwt", base_url: "vip-api.opensubtitles.com" } };
      },
    },
  });
  const auth = createAuth(setup);
  auth.storeCredentials({ apiKey: "key", username: "user", password: "pass" });

  const first = await auth.authenticate();
  const second = await auth.authenticate();
  assert.equal(logins, 1);
  assert.equal(first.token, "jwt");
  assert.equal(second.token, "jwt");
  assert.equal(second.baseUrl, "https://vip-api.opensubtitles.com/api/v1");
});

test("does not clear the token when no credential changes", () => {
  const setup = harness({ http: {} });
  const auth = createAuth(setup);
  auth.storeCredentials({ apiKey: "key", username: "user", password: "pass" });
  setup.values.set(PREF_NAMES.token, "jwt");
  setup.values.set("tokenExpiresAt", 123);

  auth.storeCredentials({ apiKey: "", username: "", password: "" });
  assert.equal(setup.values.get(PREF_NAMES.token), "jwt");
  assert.equal(setup.values.get("tokenExpiresAt"), 123);
});

test("disables credentials logically and removes preferences", () => {
  const setup = harness({ http: {} });
  const auth = createAuth(setup);
  auth.storeCredentials({ apiKey: "key", username: "user", password: "pass" });
  auth.disableCredentials();

  assert.equal(auth.configured(), false);
  assert.equal(setup.values.get("tokenExpiresAt"), 0);
  assert.equal(setup.values.get("credentialsConfigured"), false);
  assert.equal(setup.values.get(PREF_NAMES.apiKey), "");
});
