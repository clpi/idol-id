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

test("Access JWT validation verifies signature, issuer, audience, expiry, and email domain", async () => {
  const { token, publicJwk, now } = await fixtureJwt();
  const identity = await verifyAccessJwt(token, {
    teamDomain: "idol-clpi.cloudflareaccess.com",
    audience: "idol-platform-aud",
    emailDomain: "pecunies.com",
    now: () => now * 1000,
    fetcher: async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }),
  });
  assert.deepEqual(identity, {
    subject: "access-user-1",
    email: "chris@pecunies.com",
    displayName: "Chris",
    issuer: "https://idol-clpi.cloudflareaccess.com",
    audience: "idol-platform-aud",
  });
});

test("Access JWT validation rejects wrong audience, email domain, expiry, and algorithm", async () => {
  const valid = await fixtureJwt();
  const fetcher = async () => new Response(JSON.stringify({ keys: [valid.publicJwk] }));
  await assert.rejects(() => verifyAccessJwt(valid.token, {
    teamDomain: "idol-clpi.cloudflareaccess.com", audience: "wrong", emailDomain: "pecunies.com", now: () => valid.now * 1000, fetcher,
  }), /audience/i);

  const wrongEmail = await fixtureJwt({ email: "attacker@example.com" });
  await assert.rejects(() => verifyAccessJwt(wrongEmail.token, {
    teamDomain: "idol-clpi.cloudflareaccess.com", audience: "idol-platform-aud", emailDomain: "pecunies.com", now: () => wrongEmail.now * 1000,
    fetcher: async () => new Response(JSON.stringify({ keys: [wrongEmail.publicJwk] })),
  }), /email domain/i);

  const expired = await fixtureJwt({ exp: valid.now - 1 });
  await assert.rejects(() => verifyAccessJwt(expired.token, {
    teamDomain: "idol-clpi.cloudflareaccess.com", audience: "idol-platform-aud", emailDomain: "pecunies.com", now: () => expired.now * 1000,
    fetcher: async () => new Response(JSON.stringify({ keys: [expired.publicJwk] })),
  }), /expired/i);

  const [h, p, s] = valid.token.split(".");
  const noneHeader = b64url(JSON.stringify({ alg: "none", kid: "test-key" }));
  await assert.rejects(() => verifyAccessJwt(`${noneHeader}.${p}.${s}`, {
    teamDomain: "idol-clpi.cloudflareaccess.com", audience: "idol-platform-aud", emailDomain: "pecunies.com", now: () => valid.now * 1000, fetcher,
  }), /algorithm/i);
});

test("API token material is prefix-addressable, random, digest-only, and scoped", async () => {
  let cursor = 0;
  const randomBytes = (length) => Uint8Array.from({ length }, () => (cursor++ * 17 + 11) & 255);
  const material = await createApiToken({ randomBytes });
  assert.match(material.token, /^idol_pat_[a-z0-9_-]{12,}\.[A-Za-z0-9_-]{32,}$/);
  assert.equal(parseApiToken(material.token).id, material.id);
  assert.equal(material.prefix, material.token.slice(0, 22));
  assert.equal(await hashApiToken(material.token), material.digest);
  assert.notEqual(material.digest, material.token);

  assert.deepEqual(normalizeScopes(["world:read", "profile:read", "world:read"]), ["profile:read", "world:read"]);
  assert.throws(() => normalizeScopes(["token:mint-admin"]), /unsupported scope/i);
});
