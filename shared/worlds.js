function text(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function originFamily(manifest) {
  return text(manifest?.provenance?.origin?.family || manifest?.provenance?.family).trim();
}

function exactTags(manifest) {
  return Array.isArray(manifest?.tags) ? manifest.tags.map(text).filter(Boolean) : [];
}

export function classifyWorld(manifest) {
  const origin = originFamily(manifest).toLowerCase();
  const tags = exactTags(manifest).map((tag) => tag.toLowerCase());
  if ((origin && origin !== "idol") || tags.includes("foreign")) return "foreign";
  if (text(manifest?.publisher).toLowerCase() === "idol.id") return "provided";
  return "published";
}

export function normaliseWorld(manifest) {
  const stats = manifest?.stats && typeof manifest.stats === "object" ? manifest.stats : {};
  const provenance = manifest?.provenance && typeof manifest.provenance === "object" ? manifest.provenance : {};
  const world = {
    ...manifest,
    name: text(manifest?.name),
    version: text(manifest?.version || "latest"),
    summary: text(manifest?.summary),
    publisher: text(manifest?.publisher),
    graph_id: text(manifest?.graph_id),
    source_hash: text(stats.source_hash),
    lines: Number(stats.lines || 0),
    bytes: Number(stats.bytes || 0),
    tags: exactTags(manifest),
    provenance,
    origin: originFamily(manifest),
    mirror: text(manifest?.mirror),
    published_at: text(manifest?.published_at),
    category: classifyWorld(manifest),
  };
  return Object.freeze(world);
}

function searchText(world) {
  return [
    world.name,
    world.version,
    world.summary,
    world.publisher,
    world.graph_id,
    world.source_hash,
    world.origin,
    world.mirror,
    ...world.tags,
  ].join(" ").toLowerCase();
}

export function filterWorlds(worlds, query = "", category = "all") {
  const needle = text(query).trim().toLowerCase();
  return (worlds || [])
    .map(normaliseWorld)
    .filter((world) => category === "all" || world.category === category)
    .filter((world) => !needle || searchText(world).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name) || b.version.localeCompare(a.version));
}

function comparable(world, field) {
  if (field === "tags") return [...world.tags].sort().join(", ");
  return text(world[field]);
}

export function compareWorlds(leftManifest, rightManifest) {
  const left = normaliseWorld(leftManifest || {});
  const right = normaliseWorld(rightManifest || {});
  const fields = ["name", "version", "publisher", "category", "origin", "graph_id", "source_hash", "tags", "lines", "bytes", "mirror", "published_at"];
  return fields.map((field) => {
    const a = comparable(left, field);
    const b = comparable(right, field);
    return Object.freeze({ field, left: a, right: b, equal: a === b });
  });
}

export function worldCoordinate(manifest) {
  const world = normaliseWorld(manifest);
  return `${world.name}@${world.version || "latest"}`;
}

export function registryUrl(manifest) {
  return `https://lib.idol.id/#${encodeURIComponent(normaliseWorld(manifest).name)}`;
}

export function graphUrl(manifest) {
  return `https://graph.idol.id/?world=${encodeURIComponent(normaliseWorld(manifest).name)}`;
}
