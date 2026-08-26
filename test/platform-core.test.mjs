import test from "node:test";
import assert from "node:assert/strict";
import { createPlatformService } from "../shared/platform.js";

function memoryRepository() {
  const profiles = new Map();
  const tokens = new Map();
  const audits = [];
  return {
    profiles, tokens, audits,
    async upsertProfile(identity, now) {
      const current = profiles.get(identity.subject) || {
        subject: identity.subject,
        email: identity.email,
        display_name: identity.displayName || identity.email,
        created_at: now,
      };
      const next = { ...current, email: identity.email, updated_at: now };
      profiles.set(identity.subject, next);
      return { ...next };
    },
    async getProfile(subject) { return profiles.has(subject) ? { ...profiles.get(subject) } : null; },
    async updateProfile(subject, patch, now) {
      const next = { ...profiles.get(subject), ...patch, updated_at: now };
      profiles.set(subject, next);
      return { ...next };
    },
    async insertToken(record) { tokens.set(record.id, { ...record }); return { ...record }; },
    async listTokens(subject) {
      return [...tokens.values()].filter((token) => token.subject === subject).map(({ digest, ...publicRow }) => ({ ...publicRow }));
    },
    async getToken(id) { return tokens.has(id) ? { ...tokens.get(id) } : null; },
    async revokeToken(subject, id, now) {
      const token = tokens.get(id);
      if (!token || token.subject !== subject) return null;
      token.revoked_at = now;
      return { ...token };
    },
    async touchToken(id, now) { const token = tokens.get(id); if (token) token.last_used_at = now; },
    async appendAudit(event) { audits.push({ ...event }); return { ...event }; },
    async listAudit(subject, limit) { return audits.filter((event) => event.subject === subject).slice(-limit).reverse(); },
  };
}

const identity = {
  subject: "access-user-1",
  email: "chris@pecunies.com",
  displayName: "Chris",
  issuer: "https://idol-clpi.cloudflareaccess.com",
  audience: "idol-platform-aud",
};

test("platform service creates profiles, updates display data, and audits mutations", async () => {
  const repository = memoryRepository();
  const service = createPlatformService({ repository, now: () => "2026-08-25T20:00:00.000Z" });

  const session = await service.session(identity);
  assert.equal(session.profile.subject, identity.subject);
  assert.equal(session.profile.email, identity.email);
  assert.equal(session.authority, "transport identity only; no Idol world grant");

  const updated = await service.updateProfile(identity, { display_name: "Chris P" });
  assert.equal(updated.display_name, "Chris P");
  assert.equal(repository.audits.at(-1).type, "profile.updated");
  assert.throws(() => service.validateProfilePatch({ display_name: "x".repeat(81) }), /display name/i);
});

test("API tokens are returned once, stored by digest, listed without secret, audited, and revocable", async () => {
  const repository = memoryRepository();
  let cursor = 0;
  const randomBytes = (length) => Uint8Array.from({ length }, () => (cursor++ * 13 + 7) & 255);
  const service = createPlatformService({ repository, randomBytes, now: () => "2026-08-25T20:00:00.000Z" });
  await service.session(identity);

  const created = await service.createToken(identity, {
    name: "local cli",
    scopes: ["profile:read", "world:read"],
    expires_in_days: 30,
  });
  assert.match(created.token, /^idol_pat_/);
  const stored = repository.tokens.get(created.id);
  assert.equal(stored.digest === created.token, false);
  assert.equal("token" in stored, false);

  const listed = await service.listTokens(identity);
  assert.equal(listed.length, 1);
  assert.equal("digest" in listed[0], false);
  assert.equal("token" in listed[0], false);

  const principal = await service.authenticateApiToken(created.token, "profile:read");
  assert.equal(principal.subject, identity.subject);
  assert.equal(principal.kind, "api-token");

  await service.revokeToken(identity, created.id);
  await assert.rejects(() => service.authenticateApiToken(created.token, "profile:read"), /revoked/i);
  assert.deepEqual(repository.audits.map((event) => event.type), ["profile.created", "token.created", "token.used", "token.revoked"]);
});

test("expired tokens and missing scopes fail closed", async () => {
  const repository = memoryRepository();
  const dates = ["2026-08-25T20:00:00.000Z", "2027-08-26T20:00:00.000Z"];
  let index = 0;
  const service = createPlatformService({ repository, now: () => dates[Math.min(index, dates.length - 1)] });
  await service.session(identity);
  const created = await service.createToken(identity, { name: "short", scopes: ["profile:read"], expires_in_days: 1 });
  index = 1;
  await assert.rejects(() => service.authenticateApiToken(created.token, "profile:read"), /expired/i);

  index = 0;
  const other = await service.createToken(identity, { name: "scope", scopes: ["world:read"], expires_in_days: 30 });
  await assert.rejects(() => service.authenticateApiToken(other.token, "profile:read"), /scope/i);
});
