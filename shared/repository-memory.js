function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function observationSummary(document) {
  return Object.freeze({
    schema: "idol.web.repository.observation.summary.v1",
    id: document.id,
    provider: document.provider,
    namespace: document.namespace,
    repository: document.repository,
    coordinate: document.coordinate,
    resolved_revision: document.resolved_revision,
    inventory: Object.freeze({
      file_count: Number(document.inventory?.file_count || 0),
      truncated: Boolean(document.inventory?.truncated),
    }),
    created_at: document.created_at,
  });
}

export function createMemoryRepositoryStore() {
  const observations = new Map();
  const scaffolds = new Map();
  const audits = [];

  return Object.freeze({
    async commitObservation(record, event) {
      const document = Object.freeze({ ...clone(record.document), id: record.id, created_at: record.created_at });
      const audit = Object.freeze(clone(event));
      observations.set(record.id, { subject: record.subject, document });
      audits.push(audit);
      return document;
    },

    async listObservations(subject, limit = 50) {
      return [...observations.values()]
        .filter((record) => record.subject === subject)
        .map((record) => observationSummary(record.document))
        .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
        .slice(0, limit);
    },

    async getObservation(subject, id) {
      const record = observations.get(id);
      return record?.subject === subject ? record.document : null;
    },

    async commitScaffold(record, event) {
      const document = Object.freeze({
        ...clone(record.document),
        id: record.id,
        observation_id: record.observation_id,
        created_at: record.created_at,
      });
      const audit = Object.freeze(clone(event));
      scaffolds.set(record.id, { subject: record.subject, document });
      audits.push(audit);
      return document;
    },

    async listScaffolds(subject, limit = 50) {
      return [...scaffolds.values()]
        .filter((record) => record.subject === subject)
        .map((record) => record.document)
        .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
        .slice(0, limit);
    },

    async getScaffold(subject, id) {
      const record = scaffolds.get(id);
      return record?.subject === subject ? record.document : null;
    },

    async listAudit(subject, limit = 100) {
      return audits
        .filter((event) => event.subject === subject)
        .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
        .slice(0, limit)
        .map(clone);
    },
  });
}
