#!/bin/sh
# Idol bootstrap-seed installer. This builds the exact pinned source authority;
# it is not a claim that a self-hosted production compiler release exists.
set -eu

IDOL_AUTHORITY="${IDOL_AUTHORITY:-f1dfa2c36e1f495f97bd9282b3f93e4cbc812d99}"
CANONICAL_IDOL_REPOSITORY="https://github.com/clpi/idol.git"
IDOL_PREFIX="${IDOL_PREFIX:-${HOME}/.local}"

fail() { printf '%s\n' "idol install: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"; }

if [ -n "${IDOL_REPOSITORY:-}" ] && [ "$IDOL_REPOSITORY" != "$CANONICAL_IDOL_REPOSITORY" ]; then
  fail "IDOL_REPOSITORY overrides are not admitted; installer provenance is pinned to clpi/idol"
fi
IDOL_REPOSITORY="$CANONICAL_IDOL_REPOSITORY"

need git
need zig

case "$(uname -s 2>/dev/null || true)" in
  Darwin|Linux) ;;
  *) fail "this installer supports macOS and Linux; use https://idol.id/install.ps1 on Windows" ;;
esac

work="$(mktemp -d 2>/dev/null || mktemp -d -t idol-install)"
cleanup() { [ "${IDOL_KEEP_SOURCE:-0}" = "1" ] || rm -rf "$work"; }
trap cleanup EXIT HUP INT TERM

printf '%s\n' "idol install: cloning exact authority ${IDOL_AUTHORITY}"
git clone --filter=blob:none --no-checkout "$IDOL_REPOSITORY" "$work/idol" >/dev/null 2>&1 || fail "repository clone failed"
git -C "$work/idol" checkout --detach "$IDOL_AUTHORITY" >/dev/null 2>&1 || fail "authority commit is unavailable"
actual="$(git -C "$work/idol" rev-parse HEAD)"
[ "$actual" = "$IDOL_AUTHORITY" ] || fail "authority mismatch: expected $IDOL_AUTHORITY, received $actual"

printf '%s\n' "idol install: building bootstrap seed with Zig"
(
  cd "$work/idol"
  zig build -Doptimize=ReleaseFast
) || fail "zig build failed"

binary="$work/idol/zig-out/bin/idol"
[ -x "$binary" ] || fail "build completed without zig-out/bin/idol"
mkdir -p "$IDOL_PREFIX/bin" "$IDOL_PREFIX/share/idol"
cp "$binary" "$IDOL_PREFIX/bin/idol"
chmod 0755 "$IDOL_PREFIX/bin/idol"
cat > "$IDOL_PREFIX/share/idol/authority.json" <<JSON
{
  "schema": "idol.install.authority.v1",
  "repository": "clpi/idol",
  "source": "$CANONICAL_IDOL_REPOSITORY",
  "commit": "$IDOL_AUTHORITY",
  "kind": "bootstrap-seed",
  "self_hosted": false
}
JSON

printf '\n%s\n' "Installed Idol bootstrap seed: $IDOL_PREFIX/bin/idol"
printf '%s\n' "Repository: clpi/idol"
printf '%s\n' "Authority: $IDOL_AUTHORITY"
printf '%s\n' "Add $IDOL_PREFIX/bin to PATH when needed."
printf '%s\n' "This installs the current Zig-built seed transport, not a self-hosted release."
