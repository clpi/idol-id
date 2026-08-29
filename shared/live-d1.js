function rows(result) { return Array.isArray(result?.results) ? result.results : []; }
function decode(value) { try { return JSON.parse(value || "null"); } catch { return null; } }
function decodeDocument(row) {
  const document = decode(row?.document);
  return document && typeof document === "object" ? Object.freeze(document) : null;
}
function auditStatement(database, event) {
  return database.prepare(`
    INSERT INTO platform_audit(id, subject, actor_email, type, target, metadata, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  `).bind(event.id, event.subject, event.actor_email, event.type, event.target, JSON.stringify(event.metadata || {}), event.created_at);
}
async function atomicBatch(database, statements) {
  if (typeof database.batch !== "function") throw new TypeError("D1 batch support is required for atomic Live commits");
  const results = await database.batch(statements);
  if (Array.isArray(results) && results.some((result) => result?.success === false)) throw new Error("D1 Live transaction failed");
}
function summary(row) {
  return Object.freeze({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    summary: String(row.summary),
    visibility: String(row.visibility),
    universe_view_id: row.universe_view_id ? String(row.universe_view_id) : null,
    frontier_admitted_count: Number(row.frontier_admitted_count || 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  });
}

export function createD1LiveStore(database) {
  if (!database?.prepare) throw new TypeError("D1 database binding is required");
  return Object.freeze({
    async commitProject(record, member, event) {
      const project = record.document;
      const insertProject = database.prepare(`
        INSERT INTO live_project(id, subject, name, slug, summary, visibility, universe_view_id, document, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
      `).bind(record.id, record.subject, project.name, project.slug, project.summary, project.visibility, project.universe_view_id, JSON.stringify(project), record.created_at, record.updated_at);
      const insertMember = database.prepare(`
        INSERT INTO live_project_member(project_id, subject, role, created_at)
        VALUES (?1, ?2, ?3, ?4)
      `).bind(member.project_id, member.subject, member.role, member.created_at);
      await atomicBatch(database, [insertProject, insertMember, auditStatement(database, event)]);
      return project;
    },

    async listProjects(subject, limit = 50) {
      const result = await database.prepare(`
        SELECT p.id, p.name, p.slug, p.summary, p.visibility, p.universe_view_id,
               p.created_at, p.updated_at,
               COALESCE((
                 SELECT COUNT(*) FROM live_frontier f
                 WHERE f.project_id = p.id AND f.state = 'admitted'
                   AND f.rowid = (
                     SELECT MAX(f2.rowid) FROM live_frontier f2
                     WHERE f2.project_id = f.project_id AND f2.event_id = f.event_id
                   )
               ), 0) AS frontier_admitted_count
        FROM live_project p
        WHERE p.subject = ?1
        ORDER BY p.updated_at DESC, p.rowid DESC
        LIMIT ?2
      `).bind(subject, limit).all();
      return rows(result).map(summary);
    },

    async getProject(subject, id) {
      return decodeDocument(await database.prepare(`
        SELECT document FROM live_project WHERE subject = ?1 AND id = ?2
      `).bind(subject, id).first());
    },

    async updateProject(record, event) {
      const project = record.document;
      const update = database.prepare(`
        UPDATE live_project
        SET name = ?3, slug = ?4, summary = ?5, visibility = ?6,
            universe_view_id = ?7, document = ?8, updated_at = ?9
        WHERE id = ?1 AND subject = ?2
      `).bind(record.id, record.subject, project.name, project.slug, project.summary, project.visibility, project.universe_view_id, JSON.stringify(project), record.updated_at);
      await atomicBatch(database, [update, auditStatement(database, event)]);
      return project;
    },

    async commitNode(record, event) {
      const node = record.document;
      const insert = database.prepare(`
        INSERT INTO live_node(id, project_id, subject, category, label, document, created_at, updated_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7
        WHERE EXISTS (SELECT 1 FROM live_project WHERE id = ?2 AND subject = ?3)
      `).bind(record.id, record.project_id, record.subject, node.category, node.label, JSON.stringify(node), record.created_at);
      await atomicBatch(database, [insert, auditStatement(database, event)]);
      return node;
    },

    async commitApplication(record, event) {
      const application = record.document;
      const insert = database.prepare(`
        INSERT INTO live_application(id, project_id, subject, relation_identity, document, created_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6
        WHERE EXISTS (SELECT 1 FROM live_project WHERE id = ?2 AND subject = ?3)
      `).bind(record.id, record.project_id, record.subject, application.relation, JSON.stringify(application), record.created_at);
      await atomicBatch(database, [insert, auditStatement(database, event)]);
      return application;
    },

    async commitEvent(record, audit) {
      const event = record.document;
      const insert = database.prepare(`
        INSERT INTO live_event(id, project_id, subject, kind, predecessor_ids, intent_id, application_ids, payload, document, created_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
        WHERE EXISTS (SELECT 1 FROM live_project WHERE id = ?2 AND subject = ?3)
      `).bind(record.id, record.project_id, record.subject, event.kind, JSON.stringify(event.predecessor_ids), event.intent_id, JSON.stringify(event.application_ids), JSON.stringify(event.payload), JSON.stringify(event), record.created_at);
      await atomicBatch(database, [insert, auditStatement(database, audit)]);
      return event;
    },

    async commitFrontier(record, audit) {
      const decision = record.document;
      const insert = database.prepare(`
        INSERT INTO live_frontier(id, project_id, subject, event_id, state, reason, document, created_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
        WHERE EXISTS (SELECT 1 FROM live_project WHERE id = ?2 AND subject = ?3)
      `).bind(record.id, record.project_id, record.subject, decision.event_id, decision.state, decision.reason, JSON.stringify(decision), record.created_at);
      await atomicBatch(database, [insert, auditStatement(database, audit)]);
      return decision;
    },

    async projectGraph(subject, projectId) {
      const project = await database.prepare("SELECT document FROM live_project WHERE subject = ?1 AND id = ?2").bind(subject, projectId).first();
      if (!project) return null;
      const [nodeRows, applicationRows, eventRows, frontierRows] = await Promise.all([
        database.prepare("SELECT document FROM live_node WHERE subject = ?1 AND project_id = ?2 ORDER BY created_at, rowid").bind(subject, projectId).all(),
        database.prepare("SELECT document FROM live_application WHERE subject = ?1 AND project_id = ?2 ORDER BY created_at, rowid").bind(subject, projectId).all(),
        database.prepare("SELECT document FROM live_event WHERE subject = ?1 AND project_id = ?2 ORDER BY created_at, rowid").bind(subject, projectId).all(),
        database.prepare("SELECT document FROM live_frontier WHERE subject = ?1 AND project_id = ?2 ORDER BY created_at, rowid").bind(subject, projectId).all(),
      ]);
      const documents = (result) => rows(result).map(decodeDocument).filter(Boolean);
      return {
        project: decodeDocument(project),
        nodes: documents(nodeRows),
        applications: documents(applicationRows),
        events: documents(eventRows),
        frontier: documents(frontierRows),
      };
    },
  });
}
