const TEXT = new TextEncoder();
const RESPONSE_LIMIT = 2 * 1024 * 1024;
const MAX_FILES = 5000;
const MAX_PATH_BYTES = 1024;
const MAX_REF = 160;
const ALLOWED_CAPABILITIES = Object.freeze(["authority", "build", "test", "bench", "ci", "graph"]);

export const REPOSITORY_AUTHORITY_BOUNDARY =
  "repository provenance and transport observations only; no semantic identity, world grant, equivalence, or repository write";

export class RepositoryError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.status = status;
  }
}

function text(value) {
  return String(value ?? "").trim();
}

function exact(value, label, maximum = 240) {
  const result = text(value);
  if (!result || result.length > maximum) {
    throw new RepositoryError("INVALID_REPOSITORY_INPUT", `${label} must contain 1 to ${maximum} characters`, 422);
  }
  return result;
}

function cleanSegment(value, label) {
  const result = exact(value, label, 160);
  if (!/^[A-Za-z0-9_.-]+$/.test(result) || result === "." || result === "..") {
    throw new RepositoryError("INVALID_REPOSITORY_COORDINATE", `${label} contains unsupported characters`, 422);
  }
  return result.replace(/\.git$/i, "");
}

function cleanNamespace(value, label) {
  const parts = exact(value, label, 320).split("/").filter(Boolean).map((part) => cleanSegment(part, label));
  if (!parts.length) throw new RepositoryError("INVALID_REPOSITORY_COORDINATE", `${label} is empty`, 422);
  return parts.join("/");
}

function cleanRef(value) {
  const result = text(value || "HEAD");
  if (!result || result.length > MAX_REF || /[\u0000-\u001f\u007f\s~^:?*\[\\]/.test(result) || result.includes("..") || result.startsWith("/") || result.endsWith("/")) {
    throw new RepositoryError("INVALID_REPOSITORY_REF", "repository ref is invalid", 422);
  }
  return result;
}

function cleanPath(value) {
  const path = String(value ?? "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || TEXT.encode(path).byteLength > MAX_PATH_BYTES || path.startsWith("/") || path.includes("\u0000")) return null;
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.join("/");
}

function sourceUrl(provider, namespace, repository) {
  if (provider === "github") return `https://github.com/${namespace}/${repository}`;
  if (provider === "gitlab") return `https://gitlab.com/${namespace}/${repository}`;
  return `https://bitbucket.org/${namespace}/${repository}`;
}

export function parseRepositoryLocator(input) {
  const source = typeof input === "string" ? { url: input } : input;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new RepositoryError("INVALID_REPOSITORY_INPUT", "repository request must be an object or URL", 400);
  }
  const requestedRef = cleanRef(source.ref || "HEAD");
  if (source.provider) {
    const provider = text(source.provider).toLowerCase();
    if (!new Set(["github", "gitlab", "bitbucket"]).has(provider)) {
      throw new RepositoryError("REPOSITORY_PROVIDER_UNSUPPORTED", `unsupported repository provider: ${provider}`, 422);
    }
    const namespace = cleanNamespace(source.namespace || source.owner || source.workspace, "repository namespace");
    const repository = cleanSegment(source.repository || source.repo, "repository name");
    return Object.freeze({
      provider,
      namespace,
      repository,
      requested_ref: requestedRef,
      coordinate: `${provider}:${namespace}/${repository}`,
      source_url: sourceUrl(provider, namespace, repository),
    });
  }

  let url;
  try {
    url = new URL(exact(source.url, "repository URL", 2048));
  } catch {
    throw new RepositoryError("INVALID_REPOSITORY_URL", "repository URL is invalid", 422);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) {
    throw new RepositoryError("INVALID_REPOSITORY_URL", "repository URL must be a credential-free HTTPS repository URL", 422);
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  let provider;
  let namespaceParts;
  let repositoryPart;
  if (host === "github.com") {
    provider = "github";
    if (parts.length !== 2) throw new RepositoryError("INVALID_REPOSITORY_URL", "GitHub URL must identify owner/repository", 422);
    namespaceParts = parts.slice(0, 1);
    repositoryPart = parts[1];
  } else if (host === "gitlab.com") {
    provider = "gitlab";
    if (parts.length < 2) throw new RepositoryError("INVALID_REPOSITORY_URL", "GitLab URL must identify namespace/repository", 422);
    namespaceParts = parts.slice(0, -1);
    repositoryPart = parts.at(-1);
  } else if (host === "bitbucket.org") {
    provider = "bitbucket";
    if (parts.length !== 2) throw new RepositoryError("INVALID_REPOSITORY_URL", "Bitbucket URL must identify workspace/repository", 422);
    namespaceParts = parts.slice(0, 1);
    repositoryPart = parts[1];
  } else {
    throw new RepositoryError("REPOSITORY_PROVIDER_UNSUPPORTED", `repository host is not admitted: ${host}`, 422);
  }
  const namespace = cleanNamespace(namespaceParts.join("/"), "repository namespace");
  const repository = cleanSegment(repositoryPart, "repository name");
  return Object.freeze({
    provider,
    namespace,
    repository,
    requested_ref: requestedRef,
    coordinate: `${provider}:${namespace}/${repository}`,
    source_url: sourceUrl(provider, namespace, repository),
  });
}

async function readBoundedText(response, limit = RESPONSE_LIMIT) {
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > limit) throw new RepositoryError("PROVIDER_RESPONSE_TOO_LARGE", "repository provider response exceeds the admitted limit", 502);
  if (!response.body?.getReader) {
    const result = await response.text();
    if (TEXT.encode(result).byteLength > limit) throw new RepositoryError("PROVIDER_RESPONSE_TOO_LARGE", "repository provider response exceeds the admitted limit", 502);
    return result;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new RepositoryError("PROVIDER_RESPONSE_TOO_LARGE", "repository provider response exceeds the admitted limit", 502);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function providerJson(url, fetcher, label) {
  let response;
  try {
    response = await fetcher(url, {
      method: "GET",
      redirect: "error",
      headers: {
        accept: "application/json",
        "user-agent": "idol-platform-repository-observer/1",
      },
    });
  } catch {
    throw new RepositoryError("REPOSITORY_PROVIDER_UNAVAILABLE", `${label} request failed`, 502);
  }
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new RepositoryError("PUBLIC_REPOSITORY_UNAVAILABLE", `${label} is unavailable as a public repository`, 404);
  }
  if (!response.ok) throw new RepositoryError("REPOSITORY_PROVIDER_UNAVAILABLE", `${label} answered ${response.status}`, 502);
 ²È="25ÍÑ•µÌ¤°(€€€µ…¹¥™•ÍÑÌè=‰©•Ð¹™É••é”¡µ…¹¥™•ÍÑÌ¤°(€€€Ñ•ÍÑÌè=‰©•Ð¹™É••é”¡Ñ•ÍÑÌ¤°(€€€‰•¹¡µ…É­Ìè=‰©•Ð¹™É••é”¡‰•¹¡µ…É­Ì¤°(€€€¤è=‰©•Ð¹™É••é”¡¤¤°(€€€½µµ…¹‘Ìè=‰©•Ð¹™É••é”¡½µµ…¹‘Ì¤°(€ô¤ì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸½‰Í•ÉÙ•AÕ‰±¥I•Á½Í¥Ñ½Éä¡¥¹ÁÕÐ°ì™•Ñ¡•È€ô™•Ñ °½‰Í•ÉÙ•‘Ð€ô€ ¤€ôø¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤ô€ôíô¤ì(€½¹ÍÐ±½…Ñ½È€ôÁ…ÉÍ•I•Á½Í¥Ñ½Éå1½…Ñ½È¡¥¹ÁÕÐ¤ì(€±•Ð½‰Í•ÉÙ•ì(€¥˜€¡±½…Ñ½È¹ÁÉ½Ù¥‘•È€ôôô€‰¥Ñ¡Õˆˆ¤½‰Í•ÉÙ•€ô…Ý…¥Ð½‰Í•ÉÙ•¥Ñ!Õˆ¡±½…Ñ½È°™•Ñ¡•È¤ì(€•±Í”¥˜€¡±½…Ñ½È¹ÁÉ½Ù¥‘•È€ôôô€‰¥Ñ±…ˆˆ¤½‰Í•ÉÙ•€ô…Ý…¥Ð½‰Í•ÉÙ•¥Ñ1…ˆ¡±½…Ñ½È°™•Ñ¡•È¤ì(€•±Í”½‰Í•ÉÙ•€ô…Ý…¥Ð½‰Í•ÉÙ•	¥Ñ‰Õ­•Ð¡±½…Ñ½È°™•Ñ¡•È¤ì(€½¹ÍÐ¥¹Ù•¹Ñ½Éä€ôÍÕµµ…É¥é•I•Á½Í¥Ñ½Éå¥±•Ì¡½‰Í•ÉÙ•¹™¥±•Ì°ìÑÉÕ¹…Ñ•è½‰Í•ÉÙ•¹ÑÉÕ¹…Ñ•ô¤ì(€½¹ÍÐÉ•Í½±Ù•€ô•á…Ð¡½‰Í•ÉÙ•¹É•Í½±Ù•‘}É•Ù¥Í¥½¸°€‰É•Í½±Ù•É•Á½Í¥Ñ½ÉäÉ•Ù¥Í¥½¸ˆ°€ÄÈà¤ì(€É•ÑÕÉ¸=‰©•Ð¹™É••é”¡ì(€€€Í¡•µ„è€‰¥‘½°¹Ý•ˆ¹É•Á½Í¥Ñ½Éä¹½‰Í•ÉÙ…Ñ¥½¸¹ØÄˆ°(€€€Í•µ…¹Ñ¥}¥è¹Õ±°°(€€€¥‘•¹Ñ¥Ñå}ÍÑ…ÑÕÌè€‰¹½ÐµÁÕ‰±¥Í¡•ˆ°(€€€…ÕÑ¡½É¥ÑäèIA=M%Q=Ie}UQ!=I%Qe}	=U9Id°(€€€ÁÉ½Ù¥‘•Èè±½…Ñ½È¹ÁÉ½Ù¥‘•È°(€€€¹…µ•ÍÁ…”è±½…Ñ½È¹¹…µ•ÍÁ…”°(€€€É•Á½Í¥Ñ½Éäè±½…Ñ½È¹É•Á½Í¥Ñ½Éä°(€€€½½É‘¥¹…Ñ”è±½…Ñ½È¹½½É‘¥¹…Ñ”°(€€€Í½ÕÉ•}ÕÉ°è±½…Ñ½È¹Í½ÕÉ•}ÕÉ°°(€€€É•ÅÕ•ÍÑ•‘}É•˜è±½…Ñ½È¹É•ÅÕ•ÍÑ•‘}É•˜°(€€€‘•™…Õ±Ñ}‰É…¹ èÑ•áÐ¡½‰Í•ÉÙ•¹‘•™…Õ±Ñ}‰É…¹ ¤°(€€€É•Í½±Ù•‘}É•Ù¥Í¥½¸èÉ•Í½±Ù•°(€€€Ù¥Í¥‰¥±¥Ñäè€‰ÁÕ‰±¥Œˆ°(€€€½‰Í•ÉÙ•‘}…Ðè•á…Ð¡½‰Í•ÉÙ•‘Ð ¤°€‰½‰Í•ÉÙ…Ñ¥½¸Ñ¥µ”ˆ°€ØÐ¤°(€€€¥¹Ù•¹Ñ½Éä°(€€€…¹‘¥‘…Ñ•}Ý½É±è=‰©•Ð¹™É••é”¡ì(€€€€€Í•µ…¹Ñ¥}¥è¹Õ±°°(€€€€€¥‘•¹Ñ¥Ñå}ÍÑ…ÑÕÌè€‰¹½ÐµÁÕ‰±¥Í¡•ˆ°(€€€€€ÁÉ½Ù•¹…¹”è=‰©•Ð¹™É••é”¡ìÁÉ½Ù¥‘•Èè±½…Ñ½È¹ÁÉ½Ù¥‘•È°½½É‘¥¹…Ñ”è±½…Ñ½È¹½½É‘¥¹…Ñ”°É•Ù¥Í¥½¸èÉ•Í½±Ù•ô¤°(€€€€€É•ÅÕ¥É•µ•¹ÑÌè=‰©•Ð¹™É••é”¡l‰ÍÑ…‰±”¥µÁ½ÉÑ•¥‘•¹Ñ¥Ñ¥•Ìˆ°€‰‰•¡…Ù¥½È½ÉÉ•ÍÁ½¹‘•¹”ˆ°€‰Ý½É±½…Á…‰¥±¥ÑäÝ¥Ñ¹•ÍÌˆ°€‰‰Õ¥±½Ñ•ÍÐ•Ù¥‘•¹”‰t¤°(€€€€€Õ¹•ÉÑ…¥¹Ñäè=‰©•Ð¹™É••é”¡l(€€€€€€€€‰É•Á½Í¥Ñ½ÉäÁ…Ñ¡Ì…¹ÁÉ½Ù¥‘•È½½É‘¥¹…Ñ•Ì…É”ÁÉ½Ù•¹…¹”°¹½ÐÍ•µ…¹Ñ¥Œ¥‘•¹Ñ¥Ñäˆ°(€€€€€€€€‰ÑÉ•”µ•Ñ…‘…Ñ„‘½•Ì¹½ÐÁÉ½Ù”ÉÕ¹Ñ¥µ”‰•¡…Ù¥½È°½Ý¹•ÉÍ¡¥À°™…¥±ÕÉ”°•™™•ÑÌ°½È…ÕÑ¡½É¥Ñäˆ°(€€€€€€€€¸¸¸¡¥¹Ù•¹Ñ½Éä¹ÑÉÕ¹…Ñ•€ül‰ÁÉ½Ù¥‘•ÈÑÉ•”ÁÉ½©•Ñ¥½¸¥ÌÑÉÕ¹…Ñ•‰t€èmt¤°(€€€€€t¤°(€€€ô¤°(€ô¤ì)ô()™Õ¹Ñ¥½¸¹½Éµ…±¥é•…Á…‰¥±¥Ñ¥•Ì¡¥¹ÁÕÐ¤ì(€¥˜€ …ÉÉ…ä¹¥ÍÉÉ…ä¡¥¹ÁÕÐ¤ñð€…¥¹ÁÕÐ¹±•¹Ñ ¤Ñ¡É½Ü¹•ÜI•Á½Í¥Ñ½ÉåÉÉ½È ‰M=1}A	%1%Qe}IEU%Iˆ°€‰Í•±•Ð…Ð±•…ÍÐ½¹”Í…™™½±…Á…‰¥±¥Ñäˆ°€ÐÈÈ¤ì(€½¹ÍÐ…±±½Ý•€ô¹•ÜM•Ð¡11=]}A	%1%Q%L¤ì(€½¹ÍÐ…Á…‰¥±¥Ñ¥•Ì€ôl¸¸¹¹•ÜM•Ð¡¥¹ÁÕÐ¹µ…À ¡Ù…±Õ”¤€ôøÑ•áÐ¡Ù…±Õ”¤¤¹™¥±Ñ•È¡	½½±•…¸¤¥t¹Í½ÉÐ ¤ì(€™½È€¡½¹ÍÐ…Á…‰¥±¥Ñä½˜…Á…‰¥±¥Ñ¥•Ì¤¥˜€ ……±±½Ý•¹¡…Ì¡…Á…‰¥±¥Ñä¤¤Ñ¡É½Ü¹•ÜI•Á½Í¥Ñ½ÉåÉÉ½È ‰M=1}A	%1%Qe}U9MUAA=IQˆ°Õ¹ÍÕÁÁ½ÉÑ•Í…™™½±…Á…‰¥±¥Ñäè€‘í…Á…‰¥±¥Ñåõ€°€ÐÈÈ¤ì(€É•ÑÕÉ¸=‰©•Ð¹™É••é”¡…Á…‰¥±¥Ñ¥•Ì¤ì)ô()™Õ¹Ñ¥½¸ÅÕ½Ñ•e…µ°¡Ù…±Õ”¤ì(€É•ÑÕÉ¸)M=8¹ÍÑÉ¥¹¥™ä¡MÑÉ¥¹œ¡Ù…±Õ”¤¤ì)ô()™Õ¹Ñ¥½¸Ý½É­™±½Ü¡½‰Í•ÉÙ…Ñ¥½¸°…Á…‰¥±¥Ñ¥•Ì¤ì(€½¹ÍÐÁ¡…Í•Ì€ô…Á…‰¥±¥Ñ¥•Ì¹™¥±Ñ•È ¡Ù…±Õ”¤€ôøl‰‰Õ¥±ˆ°€‰Ñ•ÍÐˆ°€‰‰•¹ ˆ°€‰É…Á ‰t¹¥¹±Õ‘•Ì¡Ù…±Õ”¤¤ì(€½¹ÍÐÍÑ•ÁÌ€ôÁ¡…Í•Ì¹µ…À ¡Á¡…Í”¤€ôø€€€€€€€´¹…µ”è%‘½°€‘íÁ¡…Í•õq¸€€€€€€€ÉÕ¸è¥‘½°€‘íÁ¡…Í•õ€¤ì(€É•ÑÕÉ¸¹…µ”è¥‘½±q¹q¹½¸éq¸€ÁÕÍ éq¸€ÁÕ±±}É•ÅÕ•ÍÐéq¹q¹Á•Éµ¥ÍÍ¥½¹Ìéq¸€½¹Ñ•¹ÑÌèÉ•…‘q¹q¹©½‰Ìéq¸€Ù•É¥™äéq¸€€€ÉÕ¹Ìµ½¸èÕ‰Õ¹ÑÔµ±…Ñ•ÍÑq¸€€€ÍÑ•ÁÌéq¸€€€€€€´ÕÍ•Ìè…Ñ¥½¹Ì½¡•­½ÕÑØÑq¸€€€€€€´¹…µ”è%¹ÍÑ…±°Á¥¹¹•%‘½°‰½½ÑÍÑÉ…ÀÍ••‘q¸€€€€€€€•¹Øéq¸€€€€€€€€€%=1}UQ!=I%Qdè€‘íÅÕ½Ñ•e…µ°¡½‰Í•ÉÙ…Ñ¥½¸¹…ÕÑ¡½É¥Ñå}Á¥¸¹±…¹Õ…”¹½µµ¥Ð¥õq¸€€€€€€€ÉÕ¸èÕÉ°€µ™ÍM0¡ÑÑÁÌè¼½¥‘½°¹¥½¥¹ÍÑ…±°ðÍ¡q¸‘íÍÑ•ÁÌ¹©½¥¸ ‰q¸ˆ¤ñð€ˆ€€€€€€´¹…µ”è%¹ÍÁ•Ð%‘½°…ÕÑ¡½É¥Ñåq¸€€€€€€€ÉÕ¸è¥‘½°€´µÙ•ÉÍ¥½¸‰õq¹€ì)ô()™Õ¹Ñ¥½¸•¹•É…Ñ•‘¥±•Ì¡½‰Í•ÉÙ…Ñ¥½¸°…Á…‰¥±¥Ñ¥•Ì°…ÕÑ¡½É¥ÑåA¥¸¤ì(€½¹ÍÐ…ÕÑ¡½É¥Ñä€ôì(€€€Í¡•µ„è€‰¥‘½°¹…ÕÑ¡½É¥Ñä¹Á¥¸¹ØÄˆ°(€€€±…¹Õ…”è…ÕÑ¡½É¥ÑåA¥¸¹±…¹Õ…”°(€€€¹…Ñ¥Ù”è…ÕÑ¡½É¥ÑåA¥¸¹¹…Ñ¥Ù”°(€€€Í½ÕÉ”èìÁÉ½Ù¥‘•Èè½‰Í•ÉÙ…Ñ¥½¸¹ÁÉ½Ù¥‘•È°½½É‘¥¹…Ñ”è½‰Í•ÉÙ…Ñ¥½¸¹½½É‘¥¹…Ñ”°É•Ù¥Í¥½¸è½‰Í•ÉÙ…Ñ¥½¸¹É•Í½±Ù•‘}É•Ù¥Í¥½¸ô°(€€€…ÕÑ¡½É¥Ñå}‰½Õ¹‘…ÉäèIA=M%Q=Ie}UQ!=I%Qe}	=U9Id°(€ôì(€½¹ÍÐÁÉ½©•Ð€ôì(€€€Í¡•µ„è€‰¥‘½°¹É•Á½Í¥Ñ½Éä¹Í…™™½±¹ØÄˆ°(€€€Í•µ…¹Ñ¥}¥è¹Õ±°°(€€€¥‘•¹Ñ¥Ñå}ÍÑ…ÑÕÌè€‰¹½ÐµÁÕ‰±¥Í¡•ˆ°(€€€Í½ÕÉ”èìÁÉ½Ù¥‘•Èè½‰Í•ÉÙ…Ñ¥½¸¹ÁÉ½Ù¥‘•È°½½É‘¥¹…Ñ”è½‰Í•ÉÙ…Ñ¥½¸¹½½É‘¥¹…Ñ”°É•Ù¥Í¥½¸è½‰Í•ÉÙ…Ñ¥½¸¹É•Í½±Ù•‘}É•Ù¥Í¥½¸ô°(€€€…Á…‰¥±¥Ñ¥•Ì°(€€€½‰Í•ÉÙ•èì(€€€€€‰Õ¥±‘}ÍåÍÑ•µÌè½‰Í•ÉÙ…Ñ¥½¸¹¥¹Ù•¹Ñ½Éä¹‰Õ¥±‘}ÍåÍÑ•µÌ°(€€€€€½µµ…¹‘Ìè½‰Í•ÉÙ…Ñ¥½¸¹¥¹Ù•¹Ñ½Éä¹½µµ…¹‘Ì°(€€€€€Ñ•ÍÑÌè½‰Í•ÉÙ…Ñ¥½¸¹¥¹Ù•¹Ñ½Éä¹Ñ•ÍÑÌ°(€€€€€‰•¹¡µ…É­Ìè½‰Í•ÉÙ…Ñ¥½¸¹¥¹Ù•¹Ñ½Éä¹‰•¹¡µ…É­Ì°(€€€ô°(€€€…ÕÑ¡½É¥Ñå}‰½Õ¹‘…Éäè€‰…¹‘¥‘…Ñ”ÁÉ½©•Ð¥¹Ñ•É…Ñ¥½¸½¹±äì•¹•É…Ñ•™¥±•Ì‘¼¹½ÐÁÉ½Ù”½µÁ¥±•È…‘µ¥ÍÍ¥½¸½ÈÉ•Á½Í¥Ñ½Éä‰•¡…Ù¥½Èˆ°(€ôì(€½¹ÍÐ™¥±•Ì€ôl(€€€ìÁ…Ñ è€ˆ¹¥‘½°½…ÕÑ¡½É¥Ñä¹©Í½¸ˆ°½¹Ñ•¹Ðè€‘í)M=8¹ÍÑÉ¥¹¥™ä¡…ÕÑ¡½É¥Ñä°¹Õ±°°€È¥õq¹€ô°(€€€ìÁ…Ñ è€ˆ¹¥‘½°½ÁÉ½©•Ð¹©Í½¸ˆ°½¹Ñ•¹Ðè€‘í)M=8¹ÍÑÉ¥¹¥™ä¡ÁÉ½©•Ð°¹Õ±°°€È¥õq¹€ô°(€€€ìÁ…Ñ è€ˆ¹¥‘½°½I5¹µˆ°½¹Ñ•¹Ðè€Œ%‘½°¥¹Ñ•É…Ñ¥½¸…¹‘¥‘…Ñ•q¹q¹•¹•É…Ñ•™É½´€‘í½‰Í•ÉÙ…Ñ¥½¸¹½½É‘¥¹…Ñ•õ ‘í½‰Í•ÉÙ…Ñ¥½¸¹É•Í½±Ù•‘}É•Ù¥Í¥½¹ô¹q¹q¹Q¡¥ÌÍ…™™½±¥Ì„É•Ù¥•Ý…‰±”…¹‘¥‘…Ñ”¸%Ð‘½•Ì¹½Ð±…¥´Í•µ…¹Ñ¥Œ¥‘•¹Ñ¥Ñä°‰•¡…Ù¥½È•ÅÕ¥Ù…±•¹”°Ý½É±…ÕÑ¡½É¥Ñä°½È„ÍÕ•ÍÍ™Õ°%‘½°‰Õ¥±¹q¹€ô°(€tì(€¥˜€¡…Á…‰¥±¥Ñ¥•Ì¹¥¹±Õ‘•Ì ‰¤ˆ¤¤™¥±•Ì¹ÁÕÍ ¡ìÁ…Ñ è€ˆ¹¥Ñ¡Õˆ½Ý½É­™±½ÝÌ½¥‘½°¹åµ°ˆ°½¹Ñ•¹ÐèÝ½É­™±½Ü¡ì€¸¸¹½‰Í•ÉÙ…Ñ¥½¸°…ÕÑ¡½É¥Ñå}Á¥¸è…ÕÑ¡½É¥ÑåA¥¸ô°…Á…‰¥±¥Ñ¥•Ì¤ô¤ì(€É•ÑÕÉ¸™¥±•Ìì)ô()•áÁ½ÉÐ™Õ¹Ñ¥½¸Õ¹¥™¥•‘‘‘A…Ñ ¡™¥±•Ì¤ì(€É•ÑÕÉ¸™¥±•Ì¹µ…À ¡ìÁ…Ñ °½¹Ñ•¹Ðô¤€ôøì(€€€½¹ÍÐ±¥¹•Ì€ôMÑÉ¥¹œ¡½¹Ñ•¹Ð¤¹É•Á±…” ½q¸¼°€ˆˆ¤¹ÍÁ±¥Ð ‰q¸ˆ¤ì(€€€É•ÑÕÉ¸m‘¥™˜€´µ¥Ð„¼‘íÁ…Ñ¡ôˆ¼‘íÁ…Ñ¡õ€°€‰¹•Ü™¥±”µ½‘”€ÄÀÀØÐÐˆ°€ˆ´´´€½‘•Ø½¹Õ±°ˆ°€¬¬¬ˆ¼‘íÁ…Ñ¡õ€° €´À°À€¬Ä°‘í±¥¹•Ì¹±•¹Ñ¡ô€°€¸¸¹±¥¹•Ì¹µ…À ¡±¥¹”¤€ôø€¬‘í±¥¹•õ€¤°€ˆ‰t¹©½¥¸ ‰q¸ˆ¤ì(€ô¤¹©½¥¸ ‰q¸ˆ¤ì)ô()•áÁ½ÉÐ™Õ¹Ñ¥½¸É•…Ñ•I•Á½Í¥Ñ½ÉåM…™™½±¡½‰Í•ÉÙ…Ñ¥½¸°¥¹ÁÕÐ°ì…ÕÑ¡½É¥ÑåA¥¸°É•…Ñ•‘Ð€ô€ ¤€ôø¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤ô€ôíô¤ì(€¥˜€ …½‰Í•ÉÙ…Ñ¥½¸ñð½‰Í•ÉÙ…Ñ¥½¸¹Í¡•µ„€„ôô€‰¥‘½°¹Ý•ˆ¹É•Á½Í¥Ñ½Éä¹½‰Í•ÉÙ…Ñ¥½¸¹ØÄˆ¤Ñ¡É½Ü¹•ÜI•Á½Í¥Ñ½ÉåÉÉ½È ‰=	MIYQ%=9}IEU%Iˆ°€‰Ù…±¥É•Á½Í¥Ñ½Éä½‰Í•ÉÙ…Ñ¥½¸É•ÅÕ¥É•ˆ°€ÐÈÈ¤ì(€¥˜€ ……ÕÑ¡½É¥ÑåA¥¸ü¹±…¹Õ…”ü¹½µµ¥Ðñð€……ÕÑ¡½É¥ÑåA¥¸ü¹¹…Ñ¥Ù”ü¹½µµ¥Ð¤Ñ¡É½Ü¹•ÜI•Á½Í¥Ñ½ÉåÉÉ½È ‰UQ!=I%Qe}A%9}IEU%Iˆ°€‰±…¹Õ…”…¹¹…Ñ¥Ù”…ÕÑ¡½É¥ÑäÁ¥¹Ì…É”É•ÅÕ¥É•ˆ°€ÔÀÀ¤ì(€½¹ÍÐ…Á…‰¥±¥Ñ¥•Ì€ô¹½Éµ…±¥é•…Á…‰¥±¥Ñ¥•Ì¡¥¹ÁÕÐü¹…Á…‰¥±¥Ñ¥•Ì¤ì(€½¹ÍÐ™¥±•Ì€ô•¹•É…Ñ•‘¥±•Ì¡½‰Í•ÉÙ…Ñ¥½¸°…Á…‰¥±¥Ñ¥•Ì°…ÕÑ¡½É¥ÑåA¥¸¤ì(€½¹ÍÐ•á¥ÍÑ¥¹œ€ô¹•ÜM•Ð¡½‰Í•ÉÙ…Ñ¥½¸¹¥¹Ù•¹Ñ½Éä¹Á…Ñ¡Ìñðmt¤ì(€½¹ÍÐ½¹™±¥ÑÌ€ô™¥±•Ì¹µ…À ¡™¥±”¤€ôø™¥±”¹Á…Ñ ¤¹™¥±Ñ•È ¡Á…Ñ ¤€ôø•á¥ÍÑ¥¹œ¹¡…Ì¡Á…Ñ ¤¤ì(€¥˜€¡½¹™±¥ÑÌ¹±•¹Ñ ¤ì(€€€É•ÑÕÉ¸=‰©•Ð¹™É••é”¡ì(€€€€€Í¡•µ„è€‰¥‘½°¹Ý•ˆ¹É•Á½Í¥Ñ½Éä¹Í…™™½±¹ØÄˆ°(€€€€€ÍÑ…ÑÕÌè€‰É•™ÕÍ•ˆ°(€€€€€É•™ÕÍ…°è=‰©•Ð¹™É••é”¡ì½‘”è€‰M=1}AQ!}=91%Pˆ°‘•Ñ…¥°è€‰•¹•É…Ñ•Í…™™½±Ý½Õ±½Ù•ÉÝÉ¥Ñ”•á¥ÍÑ¥¹œÉ•Á½Í¥Ñ½ÉäÁ…Ñ¡Ìˆ°Á…Ñ¡Ìè=‰©•Ð¹™É••é”¡½¹™±¥ÑÌ¤ô¤°(€€€€€½‰Í•ÉÙ…Ñ¥½¹}¥è½‰Í•ÉÙ…Ñ¥½¸¹¥ñð¹Õ±°°(€€€€€™¥±•Ìè=‰©•Ð¹™É••é”¡mt¤°(€€€€€Á…Ñ è€ˆˆ°(€€€€€Í•µ…¹Ñ¥}¥è¹Õ±°°(€€€€€¥‘•¹Ñ¥Ñå}ÍÑ…ÑÕÌè€‰¹½ÐµÁÕ‰±¥Í¡•ˆ°(€€€ô¤ì(€ô(€½¹ÍÐ™É½é•¹¥±•Ì€ô=‰©•Ð¹™É••é”¡™¥±•Ì¹µ…À ¡™¥±”¤€ôø=‰©•Ð¹™É••é”¡ì€¸¸¹™¥±”°‰åÑ•ÌèQaP¹•¹½‘”¡™¥±”¹½¹Ñ•¹Ð¤¹‰åÑ•1•¹Ñ ô¤¤¤ì(€É•ÑÕÉ¸=‰©•Ð¹™É••é”¡ì(€€€Í¡•µ„è€‰¥‘½°¹Ý•ˆ¹É•Á½Í¥Ñ½Éä¹Í…™™½±¹ØÄˆ°(€€€ÍÑ…ÑÕÌè€‰ÁÉ•Ù¥•Üˆ°(€€€Í•µ…¹Ñ¥}¥è¹Õ±°°(€€€¥‘•¹Ñ¥Ñå}ÍÑ…ÑÕÌè€‰¹½ÐµÁÕ‰±¥Í¡•ˆ°(€€€…ÕÑ¡½É¥ÑäèIA=M%Q=Ie}UQ!=I%Qe}	=U9Id°(€€€½‰Í•ÉÙ…Ñ¥½¹}¥è½‰Í•ÉÙ…Ñ¥½¸¹¥ñð¹Õ±°°(€€€Í½ÕÉ”è=‰©•Ð¹™É••é”¡ìÁÉ½Ù¥‘•Èè½‰Í•ÉÙ…Ñ¥½¸¹ÁÉ½Ù¥‘•È°½½É‘¥¹…Ñ”è½‰Í•ÉÙ…Ñ¥½¸¹½½É‘¥¹…Ñ”°É•Ù¥Í¥½¸è½‰Í•ÉÙ…Ñ¥½¸¹É•Í½±Ù•‘}É•Ù¥Í¥½¸ô¤°(€€€…Á…‰¥±¥Ñ¥•Ì°(€€€™¥±•Ìè™É½é•¹¥±•Ì°(€€€Á…Ñ èÕ¹¥™¥•‘‘‘A…Ñ ¡™É½é•¹¥±•Ì¤°(€€€É•…Ñ•‘}…Ðè•á…Ð¡É•…Ñ•‘Ð ¤°€‰Í…™™½±Ñ¥µ”ˆ°€ØÐ¤°(€€€•á•ÕÑ•è™…±Í”°(€€€É•Á½Í¥Ñ½Éå}ÝÉ¥ÑÑ•¸è™…±Í”°(€ô¤ì)ô(