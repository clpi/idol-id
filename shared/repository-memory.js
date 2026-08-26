function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function observationSummary(record) {
  const document = record.document;
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

function scaffoldSummary(record) {
  return Object.freeze({
    schema: "idol.web.repository.scaffold.summary.v1",
    id: record.document.id,
    observation_id: record.document.observation_id,
    status: record.status,
    file_count: Number(record.file_count || 0),
    refusal_code: record.refusal_code || null,
    created_at: record.document.created_at,
  });
}

export function createMemoryRepositoryStore() {
  const observations = new Map();
  const scaffolds = new Map();
  const audits = new Map();
  return Object.freeze({
    async commitObservation(record, event) {
      const document = Object.freeze({ ...clone(record.document), id: record.id, created_at: record.created_at });
      observations.set(record.id, { subject: record.subject, document });
      audits.set(event.id, clone(event));
      return document;
    },
    async listObservations(subject, limit = 50) {
      return [...observations.values()]
        .filter((record) => record.subject === subject)
        .sort((left, right) => String(right.document.created_at).localeCompare(String(left.document.created_at)))
        .slice(0, limit)
        .map(observationSummary);
    },
    async getObservation(subject, id) {
      const record = observations.get(id);
      return record?.subject === subject ? record.document : null;
    },
    async commitScaffold(record, event) {
      const document = Object.freeze({ ...clone(record.document), id: record.id, observation_id: record.observation_id, created_at: record.created_at });
      scaffolds.set(record.id, {
        subject: record.subject,
        document,
        status: record.status,
        file_count: record.file_count,
        refusal_code: record.refusal_code,
      });
      audits.set(event.id, clone(event));
      return document;
    },
    async listScaffolds(subject, limit = 50) {
      return [...scaffolds.values()]
        .filter((record) => record.subject === subject)
        .sort((left, right) => String(right.document.created_at).localeCompare(String(left.document.created_at)))
        .slice(0, limit)
        .map(scaffoldSummary);
    },
    async getScaffold(subject, id) {
      const record = scaffolds.get(id);
      return record?.subject === subject ? record.document : null;
    },
  });
}
