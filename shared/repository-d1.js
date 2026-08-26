function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function decodeJson(value, fallback) {
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
}

function decodeObservation(row) {
  if (!row) return null;
  return Object.freeze({ ...decodeJson(row.document, {}), id: row.id, created_at: row.created_at });
}

function decodeScaffold(row) {
  if (!row) return null;
  return Object.freeze({ ...decodeJson(row.document, {}), id: row.id, observation_id: row.observation_id, created_at: row.created_at });
}

export function createD1RepositoryStore(database) {
  if (!database?.prepare) throw new TypeError("D1 database binding is required");
  return Object.freeze({
    async insertObservation(record) {
      await database.prepare(`
        INSERT INTO platform_repository_observation(
          id, subject, provider, namespace, repository, resolved_revision, document, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `).bind(
        record.id, record.subject, record.provider, record.namespace, record.repository,
        record.resolved_revision, JSON.stringify(record.document), record.created_at,
      ).run();
      return decodeObservation(await database.prepare(
        "SELECT id, document, created_at FROM platform_repository_observation WHERE id = ?1 AND subject = ?2",
      ).bind(record.id, record.subject).first());
    },

    async listObservations(subject, limit = 50) {
      const result = await database.prepare(`
        SELECT id, document, created_at
        FROM platform_repository_observation
        WHERE subject = ?1
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?2
      `).bind(subject, limit).all();
      return rows(result).map(decodeObservation);
    },

    async getObservation(subject, id) {
      return decodeObservation(await database.prepare(
        "SELECT id, document, created_at FROM platform_repository_observation WHERE subject = ?1 AND id = ?2",
      ).bind(subject, id).first());
    },

    async insertScaffold(record) {
      await database.prepare(`
        INSERT INTO platform_repository_scaffold(id, subject, observation_id, document, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `).bind(record.id, record.subject, record.observation_id, JSON.stringify(record.document), record.created_at).run();
      return decodeScaffold(await database.prepare(
        "SELECT id, observation_id, document, created_at FROM platform_repository_scaffold WHERE id = ?1 AND subject = ?2",
      ).bind(record.id, record.subject).first());
    },

    async listScaffolds(subject, limit = 50) {
      const result = await database.prepare(`
        SELECT id, observation_id, document, created_at
        FROM platform_repository_scaffold
        WHERE subject = ?1
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?2
      `).bind(subject, limit).all();
      return rows(result).map(decodeScaffold);
    },

    async getScaffold(subject, id) {
      return decodeScaffold(await database.prepare(
        "SELECT id, observation_id, document, created_at FROM platform_repository_scaffold WHERE subject = ?1 AND id = ?2",
      ).bind(subject, id).first());
    },
  });
}
