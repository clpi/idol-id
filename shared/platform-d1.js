function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function decodeToken(row) {
  if (!row) return null;
  return { ...row, scopes: JSON.parse(row.scopes || "[]") };
}

function decodeAudit(row) {
  if (!row) return null;
  return { ...row, metadata: JSON.parse(row.metadata || "{}") };
}

export function createD1PlatformRepository(database) {
  if (!database?.prepare) throw new TypeError("D1 database binding is required");

  const repository = {
    async getProfile(subject) {
      return database.prepare(
        "SELECT subject, email, display_name, created_at, updated_at FROM platform_profile WHERE subject = ?1",
      ).bind(subject).first();
    },

    async upsertProfile(identity, now) {
      await database.prepare(`
        INSERT INTO platform_profile(subject, email, display_name, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?4)
        ON CONFLICT(subject) DO UPDATE SET
          email = excluded.email,
          updated_at = excluded.updated_at
      `).bind(identity.subject, identity.email, identity.displayName || identity.email, now).run();
      return repository.getProfile(identity.subject);
    },

    async updateProfile(subject, patch, now) {
      await database.prepare(
        "UPDATE platform_profile SET display_name = ?2, updated_at = ?3 WHERE subject = ?1",
      ).bind(subject, patch.display_name, now).run();
      return repository.getProfile(subject);
    },

    async insertToken(record) {
      await database.prepare(`
        INSERT INTO platform_token(
          id, subject, name, prefix, digest, scopes,
          created_at, expires_at, revoked_at, last_used_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `).bind(
        record.id,
        record.subject,
        record.name,
        record.prefix,
        record.digest,
        JSON.stringify(record.scopes),
        record.created_at,
        record.expires_at,
        record.revoked_at,
        record.last_used_at,
      ).run();
      return decodeToken(await database.prepare("SELECT * FROM platform_token WHERE id = ?1").bind(record.id).first());
    },

    async listTokens(subject) {
      const result = await database.prepare(`
        SELECT id, subject, name, prefix, scopes, created_at, expires_at, revoked_at, last_used_at
        FROM platform_token
        WHERE subject = ?1
        ORDER BY created_at DESC, rowid DESC
      `).bind(subject).all();
      return rows(result).map(decodeToken);
    },

    async getToken(id) {
      return decodeToken(await database.prepare("SELECT * FROM platform_token WHERE id = ?1").bind(id).first());
    },

    async revokeToken(subject, id, now) {
      await database.prepare(`
        UPDATE platform_token
        SET revoked_at = COALESCE(revoked_at, ?3)
        WHERE subject = ?1 AND id = ?2
      `).bind(subject, id, now).run();
      return decodeToken(await database.prepare(
        "SELECT * FROM platform_token WHERE subject = ?1 AND id = ?2",
      ).bind(subject, id).first());
    },

    async touchToken(id, now) {
      await database.prepare(
        "UPDATE platform_token SET last_used_at = ?2 WHERE id = ?1",
      ).bind(id, now).run();
    },

    async appendAudit(event) {
      await database.prepare(`
        INSERT INTO platform_audit(id, subject, actor_email, type, target, metadata, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `).bind(
        event.id,
        event.subject,
        event.actor_email,
        event.type,
        event.target,
        JSON.stringify(event.metadata || {}),
        event.created_at,
      ).run();
      return event;
    },

    async listAudit(subject, limit) {
      const result = await database.prepare(`
        SELECT id, subject, actor_email, type, target, metadata, created_at
        FROM platform_audit
        WHERE subject = ?1
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?2
      `).bind(subject, limit).all();
      return rows(result).map(decodeAudit);
    },
  };

  return Object.freeze(repository);
}
