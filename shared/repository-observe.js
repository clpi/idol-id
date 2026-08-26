import { TEXT, MAX_FILES, REPOSITORY_AUTHORITY_BOUNDARY, RepositoryError, exact, fileRecord, parseRepositoryLocator, summarizeRepositoryFiles, text } from "./repository-core.js";

const RESPONSE_LIMIT = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

function timeoutError(label) {
  return new RepositoryError("REPOSITORY_PROVIDER_TIMEOUT", `${label} exceeded the admitted time limit`, 504);
}

async function readBoundedText(response, limit = RESPONSE_LIMIT, signal = null, label = "repository provider response") {
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > limit) throw new RepositoryError("PROVIDER_RESPONSE_TOO_LARGE", "repository provider response exceeds the admitted limit", 502);
  if (signal?.aborted) throw timeoutError(label);
  if (!response.body?.getReader) {
    const result = await response.text();
    if (signal?.aborted) throw timeoutError(label);
    if (TEXT.encode(result).byteLength > limit) throw new RepositoryError("PROVIDER_RESPONSE_TOO_LARGE", "repository provider response exceeds the admitted limit", 502);
    return result;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  const abort = () => { reader.cancel("repository provider timeout").catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw timeoutError(label);
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel("repository provider response too large");
        throw new RepositoryError("PROVIDER_RESPONSE_TOO_LARGE", "repository provider response exceeds the admitted limit", 502);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (signal?.aborted) throw timeoutError(label);
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function providerJson(url, fetcher, label, timeoutMs) {
  const milliseconds = Math.max(1, Math.min(30_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError(label));
    }, milliseconds);
  });
  try {
    const response = await Promise.race([
      fetcher(url, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": "idol-platform-repository-observer/1",
        },
      }),
      deadline,
    ]);
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new RepositoryError("PUBLIC_REPOSITORY_UNAVAILABLE", `${label} is unavailable as a public repository`, 404);
    }
    if (!response.ok) throw new RepositoryError("REPOSITORY_PROVIDER_UNAVAILABLE", `${label} answered ${response.status}`, 502);
    const raw = await Promise.race([
      readBoundedText(response, RESPONSE_LIMIT, controller.signal, label),
      deadline,
    ]);
    try {
      return { value: JSON.parse(raw), headers: response.headers };
    } catch {
      throw new RepositoryError("REPOSITORY_PROVIDER_INVALID", `${label} returned invalid JSON`, 502);
    }
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    if (controller.signal.aborted) throw timeoutError(label);
    throw new RepositoryError("REPOSITORY_PROVIDER_UNAVAILABLE", `${label} request failed`, 502);
  } finally {
    clearTimeout(timer);
  }
}

async function observeGitHub(locator, fetcher, timeoutMs) {
  const base = `https://api.github.com/repos/${encodeURIComponent(locator.namespace)}/${encodeURIComponent(locator.repository)}`;
  const metadata = (await providerJson(base, fetcher, "GitHub repository metadata", timeoutMs)).value;
  if (metadata.private) throw new RepositoryError("PUBLIC_REPOSITORY_REQUIRED", "private GitHub repositories require a provider connection", 403);
  const ref = locator.requested_ref === "HEAD" ? metadata.default_branch : locator.requested_ref;
  const commit = (await providerJson(`${base}/commits/${encodeURIComponent(ref)}`, fetcher, "GitHub repository revision", timeoutMs)).value;
  const sha = exact(commit.sha, "GitHub revision", 128);
  const tree = (await providerJson(`${base}/git/trees/${encodeURIComponent(sha)}?recursive=1`, fetcher, "GitHub repository tree", timeoutMs)).value;
  const files = (Array.isArray(tree.tree) ? tree.tree : [])
    .filter((entry) => entry?.type === "blob")
    .map((entry) => fileRecord(entry.path, entry.size))
    .filter(Boolean);
  return { default_branch: metadata.default_branch, resolved_revision: sha, files, truncated: Boolean(tree.truncated) || files.length > MAX_FILES };
}

async function observeGitLab(locator, fetcher, timeoutMs) {
  const project = encodeURIComponent(`${locator.namespace}/${locator.repository}`);
  const base = `https://gitlab.com/api/v4/projects/${project}`;
  const metadata = (await providerJson(base, fetcher, "GitLab project metadata", timeoutMs)).value;
  if (metadata.visibility && metadata.visibility !== "public") {
    throw new RepositoryError("PUBLIC_REPOSITORY_REQUIRED", "private GitLab projects require a provider connection", 403);
  }
  const ref = locator.requested_ref === "HEAD" ? metadata.default_branch : locator.requested_ref;
  const commit = (await providerJson(`${base}/repository/commits/${encodeURIComponent(ref)}`, fetcher, "GitLab repository revision", timeoutMs)).value;
  const sha = exact(commit.id, "GitLab revision", 128);
  const page = await providerJson(`${base}/repository/tree?recursive=true&per_page=100&ref=${encodeURIComponent(sha)}`, fetcher, "GitLab repository tree", timeoutMs);
  const files = (Array.isArray(page.value) ? page.value : [])
    .filter((entry) => entry?.type === "blob")
    .map((entry) => fileRecord(entry.path))
    .filter(Boolean);
  return { default_branch: metadata.default_branch, resolved_revision: sha, files, truncated: Boolean(page.headers.get("x-next-page")) || files.length >= 100 };
}

async function observeBitbucket(locator, fetcher, timeoutMs) {
  const base = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(locator.namespace)}/${encodeURIComponent(locator.repository)}`;
  const metadata = (await providerJson(base, fetcher, "Bitbucket repository metadata", timeoutMs)).value;
  if (metadata.is_private) throw new RepositoryError("PUBLIC_REPOSITORY_REQUIRED", "private Bitbucket repositories require a provider connection", 403);
  const defaultBranch = metadata.mainbranch?.name || "main";
  const ref = locator.requested_ref === "HEAD" ? defaultBranch : locator.requested_ref;
  const commit = (await providerJson(`${base}/commit/${encodeURIComponent(ref)}`, fetcher, "Bitbucket repository revision", timeoutMs)).value;
  const sha = exact(commit.hash, "Bitbucket revision", 128);
  const page = (await providerJson(`${base}/src/${encodeURIComponent(sha)}/?pagelen=100`, fetcher, "Bitbucket repository tree", timeoutMs)).value;
  const files = (Array.isArray(page.values) ? page.values : [])
    .filter((entry) => /file$/i.test(String(entry?.type || "")))
    .map((entry) => fileRecord(entry.path, entry.size))
    .filter(Boolean);
  return { default_branch: defaultBranch, resolved_revision: sha, files, truncated: Boolean(page.next) || files.length >= 100 };
}

export async function observePublicRepository(input, {
  fetcher = fetch,
  observedAt = () => new Date().toISOString(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const locator = parseRepositoryLocator(input);
  let observed;
  if (locator.provider === "github") observed = await observeGitHub(locator, fetcher, timeoutMs);
  else if (locator.provider === "gitlab") observed = await observeGitLab(locator, fetcher, timeoutMs);
  else observed = await observeBitbucket(locator, fetcher, timeoutMs);
  const inventory = summarizeRepositoryFiles(observed.files, { truncated: observed.truncated });
  const resolved = exact(observed.resolved_revision, "resolved repository revision", 128);
  return Object.freeze({
    schema: "idol.web.repository.observation.v1",
    semantic_id: null,
    identity_status: "not-published",
    authority: REPOSITORY_AUTHORITY_BOUNDARY,
    provider: locator.provider,
    namespace: locator.namespace,
    repository: locator.repository,
    coordinate: locator.coordinate,
    source_url: locator.source_url,
    requested_ref: locator.requested_ref,
    default_branch: text(observed.default_branch),
    resolved_revision: resolved,
    visibility: "public",
    observed_at: exact(observedAt(), "observation time", 64),
    inventory,
    candidate_world: Object.freeze({
      semantic_id: null,
      identity_status: "not-published",
      provenance: Object.freeze({ provider: locator.provider, coordinate: locator.coordinate, revision: resolved }),
      requirements: Object.freeze(["stable imported identities", "behavior correspondence", "world/capability witness", "build/test evidence"]),
      uncertainty: Object.freeze([
        "repository paths and provider coordinates are provenance, not semantic identity",
        "tree metadata does not prove runtime behavior, ownership, failure, effects, or authority",
        ...(inventory.truncated ? ["provider tree projection is truncated"] : []),
      ]),
    }),
  });
}
