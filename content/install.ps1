# Idol bootstrap-seed installer for Windows.
# Builds the exact authority projected by idol.id; does not claim self-hosting.
$ErrorActionPreference = "Stop"
$canonicalRepository = "https://github.com/clpi/idol.git"
$authorityEndpoint = "https://idol.id/runtime/authority.json"
if ($env:IDOL_REPOSITORY -and $env:IDOL_REPOSITORY -ne $canonicalRepository) {
  throw "idol install: IDOL_REPOSITORY overrides are not admitted; installer provenance is pinned to clpi/idol"
}
$repository = $canonicalRepository
$prefix = if ($env:IDOL_PREFIX) { $env:IDOL_PREFIX } else { Join-Path $HOME ".idol" }

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "idol install: required command not found: $Name" }
}
Require-Command "git"
Require-Command "zig"

$authority = if ($env:IDOL_AUTHORITY) {
  $env:IDOL_AUTHORITY
} else {
  try { (Invoke-RestMethod -Uri $authorityEndpoint -Method Get).language.commit }
  catch { throw "idol install: unable to read $authorityEndpoint — $($_.Exception.Message)" }
}
if ($authority -notmatch '^[0-9a-f]{40}$') { throw "idol install: authority endpoint did not publish an exact commit" }

$work = Join-Path ([System.IO.Path]::GetTempPath()) ("idol-install-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $work | Out-Null
try {
  $source = Join-Path $work "idol"
  Write-Host "idol install: cloning exact authority $authority"
  & git clone --filter=blob:none --no-checkout $repository $source | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "idol install: repository clone failed" }
  & git -C $source checkout --detach $authority | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "idol install: authority commit is unavailable" }
  $actual = (& git -C $source rev-parse HEAD).Trim()
  if ($actual -ne $authority) { throw "idol install: authority mismatch: expected $authority, received $actual" }

  Write-Host "idol install: building bootstrap seed with Zig"
  Push-Location $source
  try {
    & zig build -Doptimize=ReleaseFast
    if ($LASTEXITCODE -ne 0) { throw "idol install: zig build failed" }
  } finally { Pop-Location }

  $binary = Join-Path $source "zig-out\bin\idol.exe"
  if (-not (Test-Path $binary)) { $binary = Join-Path $source "zig-out\bin\idol" }
  if (-not (Test-Path $binary)) { throw "idol install: build completed without zig-out/bin/idol" }

  $bin = Join-Path $prefix "bin"
  $share = Join-Path $prefix "share\idol"
  New-Item -ItemType Directory -Force -Path $bin, $share | Out-Null
  $target = Join-Path $bin "idol.exe"
  Copy-Item -Force $binary $target
  @{
    schema = "idol.install.authority.v1"
    repository = "clpi/idol"
    source = $canonicalRepository
    commit = $authority
    authority_projection = $authorityEndpoint
    kind = "bootstrap-seed"
    self_hosted = $false
  } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $share "authority.json")

  Write-Host ""
  Write-Host "Installed Idol bootstrap seed: $target"
  Write-Host "Repository: clpi/idol"
  Write-Host "Authority: $authority"
  Write-Host "Add $bin to PATH when needed."
  Write-Host "This installs the current Zig-built seed transport, not a self-hosted release."
} finally {
  if ($env:IDOL_KEEP_SOURCE -ne "1") { Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue }
}
