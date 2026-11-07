#!/bin/sh
# Release observation only. Canonical semantic law remains in clpi/idol.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

for command in node jq curl; do
    command -v "$command" >/dev/null 2>&1 || {
        printf 'release authority: missing command %s\n' "$command" >&2
        exit 2
    }
done

# Validate coordinates before forming a URL. Never follow a repository or branch
# supplied by the manifest, and never treat a mutable ref as an evidence subject.
jq -e -s '
    def commit: type == "string" and test("^[0-9a-f]{40}$");
    length == 1 and (.[0] | .schema == "idol.web.authority.v2" and
    .language.repository == "clpi/idol" and .language.branch == "main" and
    (.language.commit | commit) and
    (.language.compact_law_blob | commit) and
    (.language.constitution_blob | commit) and
    .native.repository == "clpi/idol-native" and .native.branch == "main" and
    (.native.commit | commit))
' runtime/authority.json >/dev/null || {
    printf '%s\n' 'release authority: invalid authority coordinates' >&2
    exit 2
}

if [ -z "${IDOL_AUTHORITY_READ_TOKEN:-}" ]; then
    printf '%s\n' 'release authority: IDOL_AUTHORITY_READ_TOKEN is unavailable; private upstream authority cannot be verified' >&2
    exit 2
fi

# This existing observer checks the exact upstream language commit and all three
# law identities. Preserve its failure instead of substituting new pin values.
if node scripts/check-upstream-authority.mjs; then
    :
else
    status=$?
    printf '%s\n' 'release authority: upstream verification failed; no release admitted' >&2
    exit "$status"
fi

native_commit=$(jq -er '.native.commit' runtime/authority.json)
language_commit=$(jq -er '.language.commit' runtime/authority.json)
compact_blob=$(jq -er '.language.compact_law_blob' runtime/authority.json)
constitution_blob=$(jq -er '.language.constitution_blob' runtime/authority.json)

# Native is public. Do not send the private language credential to this request.
# Use the exact admitted pin, not native main: a newer commit is not evidence of
# compatibility. No redirects, token, or cookie configuration is accepted here.
if native_document=$(curl --disable --fail --silent --show-error \
    --proto '=https' --connect-timeout 10 --max-time 30 \
    "https://raw.githubusercontent.com/clpi/idol-native/$native_commit/docs/spec/AUTHORITY.json"); then
    :
else
    status=$?
    printf '%s\n' 'release authority: pinned native authority could not be read; no release admitted' >&2
    exit "$status"
fi

printf '%s\n' "$native_document" | jq -e -s \
    --arg language "$language_commit" \
    --arg compact "$compact_blob" \
    --arg constitution "$constitution_blob" '
    length == 1 and (.[0] | .schema == "idol.authority.projection.v2" and
    .role == "native-realization-and-evidence-projection" and
    .authority.repository == "clpi/idol" and .authority.branch == "main" and
    .authority.commit == $language and
    .authority.compact_law.path == "docs/spec/law.md" and
    .authority.compact_law.blob == $compact and
    .authority.long_form_law.path == "docs/spec/constitution.md" and
    .authority.long_form_law.blob == $constitution and
    .rules.local_law_is_authority == false and
    .rules.native_repo_may_mint_semantic_law == false)
' >/dev/null || {
    printf '%s\n' 'release authority: native and web authority subjects differ or are invalid; manual semantic review required' >&2
    exit 3
}

printf 'release authority: language %s and native %s agree; runtime and performance remain unqualified\n' \
    "$language_commit" "$native_commit"
