import assert from "node:assert/strict";
import test from "node:test";
import { createAuth, SERVICE } from "../src/auth.js";

function harness(overrides = {}) {
  const secrets = new Map();
  const values = new Map();
  const utils = {
    keychainRead(service, name) {
      assert.equal(service, SERVICE);
      return secrets.get(name) || false;
    },
    keychainWrite(service, name, value) {
      assert.equal(service, SERVICE);
      secrets.set(name, value);
      return true;
    },
  };
  const preferences = {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    sync() {},
  };
  return { secrets, values, utils, preferences, ...overrides };
}

test("stores credentials only in the keychain", () => {
  const setup = harness({ http: {} });
  const auth = createAuth(setup);
  assert.equal(auth.storeCredentials({ apiKey: "key", username: "user", password: "pass" }), true);
  assert.equal(auth.configured(), true);
  assert.equal(setup.values.has("apiKey"), false);
  assert.equal(setup.values.has("password"), false);
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
  setup.secrets.set("jwt-token", "jwt");
  setup.values.set("tokenExpiresAt", 123);

  auth.storeCredentials({ apiKey: "", username: "", password: "" });
  assert.equal(setup.secrets.get("jwt-token"), "jwt");
  assert.equal(setup.values.get("tokenExpiresAt"), 123);
});

test("disables credentials logically without trying to delete from keychain", () => {
  const setup = harness({ http: {} });
  const auth = createAuth(setup);
  auth.storeCredentials({ apiKey: "key", username: "user", password: "pass" });
  auth.disableCredentials();

  assert.equal(auth.configured(), false);
  assert.equal(setup.values.get("tokenExpiresAt"), 0);
  assert.equal(setup.values.get("credentialsConfigured"), false);
  // Real secrets are left untouched because IINA has no SecItemDelete
  assert.equal(setup.secrets.get("api-key"), "key");
});

test("throws when storing a secret in the keychain fails", () => {
  const setup = harness({ http: {} });
  setup.utils.keychainWrite = () => false;
  const auth = createAuth(setup);
  assert.throws(
    () => auth.storeCredentials({ apiKey: "key", username: "user", password: "pass" }),
    /acessar o Chaves/,
  );
});
