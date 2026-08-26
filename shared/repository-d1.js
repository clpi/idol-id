import { repositoryObservationSummary } from "./repository-core.js";

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

function auditStatement(database, event) {
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

async function atomicBatch(database, statements) {
  if (typeof database.batch !== "function") throw new TypeError("D1 batch support is required for atomic repository commits");
  const results = await database.batch(statements);
  if (Array.isArray(results) && results.some((result) => result?.success === false)) {
    throw new Error("D1 repository transaction failed");
  }
}

export function createD1RepositoryStore(database) {
  if (!database?.prepare) throw new TypeError("D1 database binding is required");
  return Object.freeze({
    async commitObservation(record, event) {
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
      await atomicBatch(database, [insert, auditStatement(database, event)]);
      return decodeObservation({ id: record.id, document: JSON.stringify(record.document), created_at: record.created_at });
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
      return rows(result).map(repositoryObservationSummary);
    },

    async getObservation(subject, id) {
      return decodeObservation(await database.prepare(
        "SELECT id, document, created_at FROM platform_repository_observation WHERE subject = ?1 AND id = ?2",
      ).bind(subject, id).first());
    },

    async commitScaffold(record, event) {
      const insert = database.prepare(`
        INSERT INTO platform_repository_scaffold(id, subject, observation_id, document, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `).bind(record.id, record.subject, record.observation_id, JSON.stringify(record.document), record.created_at);
      await atomicBatch(database, [insert, auditStatement(database, event)]);
      return decodeScaffold({
        id: record.id,
        observation_id: record.observation_id,
        document: JSON.stringify(record.document),
        created_at: record.created_at,
      });
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
