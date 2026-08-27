import { publicUniverseView, universeViewSummary } from "./universe.js";

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function newestFirst(left, right) {
  return String(right.document.updated_at).localeCompare(String(left.document.updated_at))
    || right.sequence - left.sequence;
}

export function createMemoryUniverseStore() {
  const views = new Map();
  const audits = [];
  let sequence = 0;
  return Object.freeze({
    async commitView(record, event) {
      const existing = views.get(record.id);
      if (existing && existing.subject !== record.subject) throw new Error("universe view subject mismatch");
      const document = Object.freeze(clone(record.document));
      views.set(record.id, {
        subject: record.subject,
        document,
        sequence: ++sequence,
      });
      audits.push(Object.freeze(clone(event)));
      return document;
    },

    async listViews(subject, limit = 50) {
      return [...views.values()]
        .filter((record) => record.subject === subject)
        .sort(newestFirst)
        .slice(0, limit)
        .map((record) => universeViewSummary(record.document));
    },

    async getView(subject, id) {
      const record = views.get(id);
      return record?.subject === subject ? record.document : null;
    },

    async getPublicView(id) {
      const record = views.get(id);
      if (!record || record.document.visibility !== "public") return null;
      return publicUniverseView(record.document);
    },

    async listPublicViews(limit = 50) {
      return [...views.values()]
        .filter((record) => record.document.visibility === "public")
        .sort(newestFirst)
        .slice(0, limit)
        .map((record) => universeViewSummary(record.document));
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
