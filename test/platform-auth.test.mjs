import test from "node:test";
import assert from "node:assert/strict";
import {
  createApiToken,
  hashApiToken,
  normalizeScopes,
  parseApiToken,
  verifyAccessJwt,
} from "../shared/platform-auth.js";

const enc = new TextEncoder();
const b64url = (bytes) => Buffer.from(bytes).toString("base64url");

async function fixtureJwt(overrides = {}) {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  const now = 1_800_000_000;
  const header = { alg: "RS256", typ: "JWT", kid: "test-key" };
  const payload = {
    iss: "https://idol-clpi.cloudflareaccess.com",
    aud: ["idol-platform-aud"],
    sub: "access-user-1",
    email: "chris@pecunies.com",
    name: "Chris",
    iat: now - 30,
    nbf: now - 30,
    exp: now + 3600,
    ...overrides,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, enc.encode(signingInput));
  return { token: `${signingInput}.${b64url(signature)}`, publicJwk, now };
}

function options(fixture, overrides = {}) {
  return {
    teamDomain: "idol-clpi.cloudflareaccess.com",
    audience: "idol-platform-aud",
    email: "chris@pecunies.com",
    now: () => fixture.now * 1000,
    fetcher: async () => new Response(JSON.stringify({ keys: [fixture.publicJwk] }), { status: 200 }),
    ...overrides,
  };
}

test("Access JWT validation verifies signature, issuer, audience, expiry, and exact owner email", async () => {
  const fixture = await fixtureJwt();
  const identity = await verifyAccessJwt(fixture.token, options(fixture));
  assert.deepEqual(identity, {
    subject: "access-user-1",
    email: "chris@pecunies.com",
    displayName: "Chris",
    issuer: "https://idol-clpi.cloudflareaccess.com",
    audience: "idol-platform-aud",
  });
});

test("Access JWT validation rejects wrong audience, owner email, expiry, future issue time, and algorithm", async () => {
  const valid = await fixtureJwt();
  await assert.rejects(() => verifyAccessJwt(valid.token, options(valid, { audience: "wrong" })), /audience/i);

  const wrongEmail = await fixtureJwt({ email: "other@pecunies.com" });
  await assert.rejects(() => verifyAccessJwt(wrongEmail.token, options(wrongEmail)), /email refused/i);

  const expired = await fixtureJwt({ exp: valid.now - 1 });
  await assert.rejects(() => verifyAccessJwt(expired.token, options(expired)), /expired/i);

  const future = await fixtureJwt({ iat: valid.now + 600 });
  await assert.rejects(() => verifyAccessJwt(future.token, options(future)), /issued-at/i);

  const [, p, s] = valid.token.split(".");
  const noneHeader = b64url(JSON.stringify({ alg: "none", kid: "test-key" }));
  await assert.rejects(() => verifyAccessJwt(`${noneHeader}.${p}.${s}`, options(valid)), /algorithm/i);
});

test("Access JWT input is bounded and domain fallback remains explicit", async () => {
  const fixture = await fixtureJwt();
  await assert.rejects(() => verifyAccessJwt("x".repeat(17 * 1024), options(fixture)), /too large/i);
  const identity = await verifyAccessJwt(fixture.token, options(fixture, { email: "", emailDomain: "pecunies.com" }));
  assert.equal(identity.email, "chris@pecunies.com");
});

test("API token material is prefix-addressable, random, digest-only, and scoped", async () => {
  let cursor = 0;
  const randomBytes = (length) => Uint8Array.from({ length }, () => (cursor++ * 17 + 11) & 255);
  const material = await createApiToken({ randomBytes });
  assert.match(material.token, /^idol_pat_[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{32,}$/);
  assert.equal(parseApiToken(material.token).id, material.id);
  assert.equal(material.prefix, material.token.slice(0, 22));
  assert.equal(await hashApiToken(material.token), material.digest);
  assert.notEqual(material.digest, material.token);

  assert.deepEqual(normalizeScopes(["world:read", "profile:read", "world:read"]), ["profile:read", "world:read"]);
  assert.throws(() => normalizeScopes(["token:mint-admin"]), /unsupported scope/i);
});
