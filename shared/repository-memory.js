import { repositoryObservationSummary, repositoryScaffoldSummary } from "./repository-core.js";

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function newestFirst(left, right) {
  return String(right.document.created_at).localeCompare(String(left.document.created_at))
    || right.sequence - left.sequence;
}

export function createMemoryRepositoryStore() {
  const observations = new Map();
  const scaffolds = new Map();
  const audits = [];
  let sequence = 0;
  return Object.freeze({
    async commitObservation(record, event) {
      const document = Object.freeze({ ...clone(record.document), id: record.id, created_at: record.created_at });
      const audit = Object.freeze(clone(event));
      observations.set(record.id, { subject: record.subject, document, sequence: ++sequence });
      audits.push(audit);
      return document;
    },
    async listObservations(subject, limit = 50) {
      return [...observations.values()]
        .filter((record) => record.subject === subject)
        .sort(newestFirst)
        .slice(0, limit)
        .map((record) => repositoryObservationSummary(record.document));
    },
    async getObservation(subject, id) {
      const record = observations.get(id);
      return record?.subject === subject ? record.document : null;
    },
    async commitScaffold(record, event) {
      const document = Object.freeze({ ...clone(record.document), id: record.id, observation_id: record.observation_id, created_at: record.created_at });
      const audit = Object.freeze(clone(event));
      scaffolds.set(record.id, {
        subject: record.subject,
        document,
        status: record.status,
        file_count: record.file_count,
        refusal_code: record.refusal_code,
        sequence: ++sequence,
      });
      audits.push(audit);
      return document;
    },
    async listScaffolds(subject, limit = 50) {
      return [...scaffolds.values()]
        .filter((record) => record.subject === subject)
        .sort(newestFirst)
        .slice(0, limit)
        .map((record) => repositoryScaffoldSummary({
          ...record.document,
          status: record.status,
          file_count: record.file_count,
          refusal_code: record.refusal_code,
        }));
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
