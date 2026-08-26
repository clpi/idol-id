function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function createMemoryRepositoryStore() {
  const observations = new Map();
  const scaffolds = new Map();
  return Object.freeze({
    async insertObservation(record) {
      const document = Object.freeze({ ...clone(record.document), id: record.id, created_at: record.created_at });
      observations.set(record.id, { subject: record.subject, document });
      return document;
    },
    async listObservations(subject, limit = 50) {
      return [...observations.values()]
        .filter((record) => record.subject === subject)
        .map((record) => record.document)
        .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
        .slice(0, limit);
    },
    async getObservation(subject, id) {
      const record = observations.get(id);
      return record?.subject === subject ? record.document : null;
    },
    async insertScaffold(record) {
      const document = Object.freeze({ ...clone(record.document), id: record.id, observation_id: record.observation_id, created_at: record.created_at });
      scaffolds.set(record.id, { subject: record.subject, document });
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
  });
}
