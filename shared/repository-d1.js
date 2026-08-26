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

function decodeObservationSummary(row) {
  if (!row) return null;
  return Object.freeze({
    schema: "idol.web.repository.observation.summary.v1",
    id: row.id,
    provider: row.provider,
    namespace: row.namespace,
    repository: row.repository,
    coordinate: `${row.provider}:${row.namespace}/${row.repository}`,
    resolved_revision: row.resolved_revision,
    inventory: Object.freeze({
      file_count: Number(row.file_count || 0),
      truncated: Boolean(row.inventory_truncated),
    }),
    created_at: row.created_at,
  });
}

function decodeScaffold(row) {
  if (!row) return null;
  return Object.freeze({ ...decodeJson(row.document, {}), id: row.id, observation_id: row.observation_id, created_at: row.created_at });
}

function decodeScaffoldSummary(row) {
  if (!row) return null;
  return Object.freeze({
    schema: "idol.web.repository.scaffold.summary.v1",
    id: row.id,
    observation_id: row.observation_id,
    status: row.status,
    file_count: Number(row.file_count || 0),
    refusal_code: row.refusal_code || null,
    created_at: row.created_at,
  });
}

function auditInsert(database, event) {
  return database.prepare(`
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
  );
}

function requireBatch(database) {
  if (typeof database.batch !== "function") throw new TypeError("D1 transactional batch support is required for repository writes");
}

export function createD1RepositoryStore(database) {
  if (!database?.prepare) throw new TypeError("D1 database binding is required");
  return Object.freeze({
    async commitObservation(record, event) {
      requireBatch(database);
      const insert = database.prepare(`
        INSERT INTO platform_repository_observation(
          id, subject, provider, namespace, repository, resolved_revision,
          file_count, inventory_truncated, document, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `).bind(
        record.id,
        record.subject,
        record.provider,
        record.namespace,
        record.repository,
        record.resolved_revision,
        record.file_count,
        record.inventory_truncated ? 1 : 0,
        JSON.stringify(record.document),
        record.created_at,
      );
      await database.batch([insert, auditInsert(database, event)]);
      return Object.freeze({ ...record.document, id: record.id, created_at: record.created_at });
    },

    async listObservations(subject, limit = 50) {
      const result = await database.prepare(`
        SELECT id, provider, namespace, repository, resolved_revision,
               file_count, inventory_truncated, created_at
        FROM platform_repository_observation
        WHERE subject = ?1
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?2
      `).bind(subject, limit).all();
      return rows(result).map(decodeObservationSummary);
    },

    async getObservation(subject, id) {
      return decodeObservation(await database.prepare(
        "SELECT id, document, created_at FROM platform_repository_observation WHERE subject = ?1 AND id = ?2",
      ).bind(subject, id).first());
    },

    async commitScaffold(record, event) {
      requireBatch(database);
      const insert = database.prepare(`
        INSERT INTO platform_repository_scaffold(
          id, subject, observation_id, status, file_count, refusal_code, document, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `).bind(
        record.id,
        record.subject,
        record.observation_id,
        record.status,
        record.file_count,
        record.refusal_code,
        JSON.stringify(record.document),
        record.created_at,
      );
      await database.batch([insert, auditInsert(database, event)]);
      return Object.freeze({
        ...record.document,
        id: record.id,
        observation_id: record.observation_id,
        created_at: record.created_at,
      });
    },

    async listScaffolds(subject, limit = 50) {
      const result = await database.prepare(`
        SELECT id, observation_id, status, file_count, refusal_code, created_at
        FROM platform_repository_scaffold
        WHERE subject = ?1
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?2
      `).bind(subject, limit).all();
      return rows(result).map(decodeScaffoldSummary);
    },

    async getScaffold(subject, id) {
      return decodeScaffold(await database.prepare(
        "SELECT id, observation_id, document, created_at FROM platform_repository_scaffold WHERE subject = ?1 AND id = ?2",
      ).bind(subject, id).first());
    },
  });
}
