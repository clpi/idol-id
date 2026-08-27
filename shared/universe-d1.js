import { publicUniverseView, universeViewSummary } from "./universe.js";

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function decode(value) {
  try { return JSON.parse(value || "null"); } catch { return null; }
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
  if (typeof database.batch !== "function") throw new TypeError("D1 batch support is required for atomic Universe View commits");
  const results = await database.batch(statements);
  if (Array.isArray(results) && results.some((result) => result?.success === false)) {
    throw new Error("D1 Universe View transaction failed");
  }
}

function decodeView(row) {
  if (!row) return null;
  const document = decode(row.document);
  return document && typeof document === "object" ? Object.freeze(document) : null;
}

function decodeSummary(row) {
  if (!row) return null;
  return Object.freeze({
    schema: "idol.web.universe.view.summary.v1",
    id: String(row.id),
    title: String(row.title),
    visibility: String(row.visibility),
    lens: String(row.lens),
    selection_count: Number(row.selection_count || 0),
    violation_count: Number(row.violation_count || 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  });
}

export function createD1UniverseStore(database) {
  if (!database?.prepare) throw new TypeError("D1 database binding is required");
  return Object.freeze({
    async commitView(record, event) {
      const view = record.document;
      const upsert = database.prepare(`
        INSERT INTO platform_universe_view(
          id, subject, title, visibility, lens, selection_count,
          violation_count, document, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          visibility = excluded.visibility,
          lens = excluded.lens,
          selection_count = excluded.selection_count,
          violation_count = excluded.violation_count,
          document = excluded.document,
          updated_at = excluded.updated_at
        WHERE platform_universe_view.subject = excluded.subject
      `).bind(
        record.id,
        record.subject,
        view.title,
        view.visibility,
        view.lens,
        Number(view.analysis?.selection_count || view.selections?.length || 0),
        Number(view.analysis?.violation_count || 0),
        JSON.stringify(view),
        record.created_at,
        record.updated_at,
      );
      await atomicBatch(database, [upsert, auditStatement(database, event)]);
      return view;
    },

    async listViews(subject, limit = 50) {
      const result = await database.prepare(`
        SELECT id, title, visibility, lens, selection_count,
               violation_count, created_at, updated_at
        FROM platform_universe_view
        WHERE subject = ?1
        ORDER BY updated_at DESC, rowid DESC
        LIMIT ?2
      `).bind(subject, limit).all();
      return rows(result).map(decodeSummary);
    },

    async getView(subject, id) {
      return decodeView(await database.prepare(`
        SELECT document
        FROM platform_universe_view
        WHERE subject = ?1 AND id = ?2
      `).bind(subject, id).first());
    },

    async getPublicView(id) {
      const view = decodeView(await database.prepare(`
        SELECT document
        FROM platform_universe_view
        WHERE id = ?1 AND visibility = 'public'
      `).bind(id).first());
      return view ? publicUniverseView(view) : null;
    },

    async listPublicViews(limit = 50) {
      const result = await database.prepare(`
        SELECT id, title, visibility, lens, selection_count,
               violation_count, created_at, updated_at
        FROM platform_universe_view
        WHERE visibility = 'public'
        ORDER BY updated_at DESC, rowid DESC
        LIMIT ?1
      `).bind(limit).all();
      return rows(result).map(decodeSummary);
    },
  });
}
