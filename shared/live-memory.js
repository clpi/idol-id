function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function newest(left, right) {
  return String(right.updated_at || right.created_at).localeCompare(String(left.updated_at || left.created_at))
    || String(right.id).localeCompare(String(left.id));
}
function projectKey(projectId, id) { return `${projectId}:${id}`; }

export function createMemoryLiveStore() {
  const projects = new Map();
  const members = new Map();
  const nodes = new Map();
  const applications = new Map();
  const events = new Map();
  const frontier = [];
  const audits = [];

  function ownerProject(subject, projectId) {
    const record = projects.get(projectId);
    return record?.subject === subject ? record : null;
  }
  function requireProject(subject, projectId) {
    const record = ownerProject(subject, projectId);
    if (!record) return null;
    return record;
  }
  function append(event) { audits.push(Object.freeze(clone(event))); }

  return Object.freeze({
    async commitProject(record, member, event) {
      if (projects.has(record.id)) throw new Error("live project already exists");
      for (const project of projects.values()) {
        if (project.subject === record.subject && project.document.slug === record.document.slug) throw new Error("live project slug already exists");
      }
      projects.set(record.id, { subject: record.subject, document: Object.freeze(clone(record.document)) });
      members.set(projectKey(record.id, member.subject), Object.freeze(clone(member)));
      append(event);
      return clone(record.document);
    },

    async listProjects(subject, limit = 50) {
      return [...projects.values()]
        .filter((record) => record.subject === subject)
        .map((record) => clone(record.document))
        .sort(newest)
        .slice(0, limit);
    },

    async getProject(subject, id) {
      const record = ownerProject(subject, id);
      return record ? clone(record.document) : null;
    },

    async updateProject(record, event) {
      const current = ownerProject(record.subject, record.id);
      if (!current) return null;
      for (const [id, project] of projects.entries()) {
        if (id !== record.id && project.subject === record.subject && project.document.slug === record.document.slug) throw new Error("live project slug already exists");
      }
      projects.set(record.id, { subject: record.subject, document: Object.freeze(clone(record.document)) });
      append(event);
      return clone(record.document);
    },

    async commitNode(record, event) {
      if (!requireProject(record.subject, record.project_id)) return null;
      const key = projectKey(record.project_id, record.id);
      if (nodes.has(key)) throw new Error("live node already exists");
      nodes.set(key, Object.freeze(clone(record.document)));
      append(event);
      return clone(record.document);
    },

    async commitApplication(record, event) {
      if (!requireProject(record.subject, record.project_id)) return null;
      const key = projectKey(record.project_id, record.id);
      if (applications.has(key)) throw new Error("live application already exists");
      applications.set(key, Object.freeze(clone(record.document)));
      append(event);
      return clone(record.document);
    },

    async commitEvent(record, audit) {
      if (!requireProject(record.subject, record.project_id)) return null;
      const key = projectKey(record.project_id, record.id);
      if (events.has(key)) throw new Error("live event already exists");
      events.set(key, Object.freeze(clone(record.document)));
      append(audit);
      return clone(record.document);
    },

    async commitFrontier(record, audit) {
      if (!requireProject(record.subject, record.project_id)) return null;
      frontier.push(Object.freeze(clone(record.document)));
      append(audit);
      return clone(record.document);
    },

    async projectGraph(subject, projectId) {
      const project = ownerProject(subject, projectId);
      if (!project) return null;
      const collect = (map) => [...map.entries()]
        .filter(([key]) => key.startsWith(`${projectId}:`))
        .map(([, value]) => clone(value));
      return {
        project: clone(project.document),
        nodes: collect(nodes),
        applications: collect(applications),
        events: collect(events),
        frontier: frontier.filter((decision) => decision.project_id === projectId).map(clone),
      };
    },

    async listAudit(subject, limit = 100) {
      return audits.filter((event) => event.subject === subject).slice(-limit).reverse().map(clone);
    },

    _state: Object.freeze({ projects, members, nodes, applications, events, frontier, audits }),
  });
}
