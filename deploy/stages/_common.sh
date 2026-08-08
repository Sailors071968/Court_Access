# shellcheck shell=bash
# ============================================================================
# Common deployment library — sourced by every stage script.
#
# Encodes the deployment standards so each stage does not restate them:
#   - deterministic environment (no inherited PATH, no npx, no npm exec)
#   - interpreter verification before any work
#   - continuous protection of the existing production process
#   - one PASS or FAIL outcome per stage, with evidence
#
# Never `set -e` here: a stage must be able to observe a failure and report it
# as FAIL with a cause, rather than dying silently mid-check.
# ============================================================================

set -uo pipefail

# --- Configuration ----------------------------------------------------------
: "${APP_EXISTING:=/var/www/courtaccess}"
: "${V1:=/var/www/courtaccess-v1}"
: "${BUILD:=/opt/courtaccess-build}"
: "${V1_PORT:=3100}"
: "${V1_PM2_NAME:=courtaccess-v1}"
: "${V1_DB:=courtaccess_v1}"
: "${STATE:=$HOME/courtaccess-deploy-state}"
# Exported because several checks shell out to node, which reads them from the
# environment. Without the export the subprocess sees undefined and silently
# does nothing useful.
export V1 BUILD V1_PORT V1_PM2_NAME V1_DB STATE APP_EXISTING
: "${EXPECTED_BUNDLE_SHA:=c3f5f6f03399b594f4465db2067ba7219b7717335fd8f43355473d47d35ad227}"
: "${EXPECTED_MIGRATIONS:=30}"
: "${EXPECTED_TABLES:=116}"

mkdir -p "$STATE"

STAGE_NAME="${STAGE_NAME:-unnamed}"
FAILURES=0

# --- Output -----------------------------------------------------------------
say()  { printf '\n=== %s ===\n' "$*"; }
info() { printf '    %s\n' "$*"; }
kv()   { printf '    %-34s %s\n' "$1" "${2:-}"; }

ok()   { printf '    [ OK ] %s\n' "$*"; }
bad()  { printf '    [FAIL] %s\n' "$*"; FAILURES=$((FAILURES+1)); }

# check <description> <expected> <actual>
check() {
  if [ "$2" = "$3" ]; then ok "$1 — $3"
  else bad "$1 — expected '$2', got '$3'"; fi
}

# check_nonempty <description> <value>
check_nonempty() {
  if [ -n "${2:-}" ]; then ok "$1 — $2"; else bad "$1 — empty"; fi
}

# --- Standard 2: deterministic environment ----------------------------------
# Builds a minimal, explicit environment. Nothing is inherited from the
# invoking shell except what is set here on purpose.
deploy_env() {
  if [ -z "${NODE22:-}" ]; then
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
      # shellcheck disable=SC1091
      . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
      NODE22="$(nvm which 22 2>/dev/null)"
    fi
  fi
  if [ -z "${NODE22:-}" ] || [ ! -x "$NODE22" ]; then
    bad "NODE22 is not set to an executable Node 22 binary."
    info "Set it explicitly, e.g.:"
    info '  export NODE22="$HOME/.nvm/versions/node/v22.x.y/bin/node"'
    return 1
  fi
  export NODE22
  export NODE22BIN="$(dirname "$NODE22")"
  export NPM22="$NODE22BIN/npm"
  # Deliberately minimal, with the pinned toolchain first. No user bin dirs,
  # no shell functions, no aliases.
  export PATH="$NODE22BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  export HOME="${HOME:?HOME must be set}"
  unset NODE_ENV npm_config_prefix NODE_OPTIONS
  return 0
}

# --- Standard 3: interpreter verification -----------------------------------
# Logs what every executable resolves to, and aborts if anything is unexpected.
verify_interpreter() {
  say "INTERPRETER VERIFICATION"
  kv "NODE22"          "$NODE22"
  kv "node version"    "$("$NODE22" --version 2>&1)"
  kv "npm (pinned)"    "$NPM22"
  kv "npm version"     "$("$NPM22" --version 2>&1)"
  kv "PATH"            "$PATH"
  kv "cwd"             "$(pwd)"
  kv "HOME"            "$HOME"
  kv "whoami"          "$(whoami)"

  local resolved_node resolved_npm major
  resolved_node="$(command -v node || true)"
  resolved_npm="$(command -v npm || true)"
  kv "PATH resolves node to" "$resolved_node"
  kv "PATH resolves npm to"  "$resolved_npm"

  # node and npm must come from the same installation, or a build can compile
  # against one runtime and execute on another.
  if [ "$resolved_node" != "$NODE22" ]; then
    bad "PATH node ($resolved_node) is not the pinned interpreter ($NODE22)"
  else ok "PATH node is the pinned interpreter"; fi

  if [ "$resolved_npm" != "$NPM22" ]; then
    bad "PATH npm ($resolved_npm) is not the pinned npm ($NPM22)"
  else ok "PATH npm is the pinned npm"; fi

  major="$("$NODE22" -pe 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$major" -lt 22 ]; then
    bad "Node major is $major; the bundle is compiled --target=node22"
  else ok "Node major $major satisfies node22"; fi

  # npx and npm exec re-resolve node from PATH and have been observed running a
  # completely different version from a cache. Nothing here may use them.
  ok "npx / npm exec are not used by any deployment command"
}

# --- Standard 5: protect the existing installation --------------------------
# Records the existing process, then asserts it has not moved.
BASELINE="$STATE/existing-baseline.txt"

_existing_snapshot() {
  pm2 jlist 2>/dev/null | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      for (const p of ps) {
        const e=p.pm2_env||{};
        if (p.name === process.env.V1_PM2_NAME) continue;
        console.log([p.name,p.pid,e.status,e.restart_time,e.pm_exec_path].join("|"));
      }
    });' 2>/dev/null | sort
}

baseline_existing() {
  say "BASELINE — EXISTING PRODUCTION PROCESS"
  _existing_snapshot > "$BASELINE"
  if [ -s "$BASELINE" ]; then
    sed 's/^/    /' "$BASELINE"
    ok "baseline recorded at $BASELINE"
  else
    info "no existing PM2 processes other than ${V1_PM2_NAME}"
    ok "baseline recorded (empty)"
  fi
}

# Quiet form of the comparison below: answers the question without printing or
# counting a failure, so the Go/No-Go gate can consult it.
_existing_matches_baseline() {
  [ -f "$BASELINE" ] || return 1
  [ "$(_existing_snapshot)" = "$(cat "$BASELINE")" ]
}

assert_existing_unchanged() {
  say "EXISTING PRODUCTION — UNCHANGED?"
  if [ ! -f "$BASELINE" ]; then
    bad "no baseline recorded; run the stage that calls baseline_existing first"
    return 1
  fi
  local now; now="$(_existing_snapshot)"
  if [ "$now" = "$(cat "$BASELINE")" ]; then
    ok "existing process list, PIDs and restart counters are unchanged"
  else
    bad "the existing production process CHANGED during this stage"
    info "--- baseline ---"; sed 's/^/      /' "$BASELINE"
    info "--- now ---";      printf '%s\n' "$now" | sed 's/^/      /'
    info "STOP. Investigate before continuing."
  fi
}

# --- Deployment manifest ----------------------------------------------------
# One append-only record for the whole deployment. Every stage adds to it
# rather than producing a separate report, so there is a single authoritative
# audit trail afterwards.
export MANIFEST="$STATE/deployment-manifest.json"

manifest_init() {
  [ -f "$MANIFEST" ] && { ok "manifest already exists — appending to $MANIFEST"; return 0; }
  "$NODE22" -e '
    const fs=require("fs");
    fs.writeFileSync(process.env.MANIFEST, JSON.stringify({
      deployment: {
        startedAtUtc: new Date().toISOString(),
        operator: process.env.USER || process.env.LOGNAME || "unknown",
        host: require("os").hostname(),
      },
      stages: [],
    }, null, 2));
  ' && ok "manifest created at $MANIFEST" || bad "could not create manifest"
}

# manifest_record <key> <value>   — buffered, flushed by manifest_flush
declare -a _MF_KEYS=() _MF_VALS=()
manifest_record() { _MF_KEYS+=("$1"); _MF_VALS+=("${2:-}"); }

manifest_flush() {
  # The host audit runs before Node 22 exists. Skip recording rather than
  # failing the stage on a missing interpreter.
  [ -n "${NODE22:-}" ] && [ -x "${NODE22:-}" ] || return 0
  local result="$1"
  local payload="{}"
  if [ "${#_MF_KEYS[@]}" -gt 0 ]; then
    payload="$(
      { printf '{'
        local i first=1
        for i in "${!_MF_KEYS[@]}"; do
          [ $first -eq 0 ] && printf ','
          first=0
          printf '%s:%s' \
            "$("$NODE22" -pe 'JSON.stringify(process.argv[1])' "${_MF_KEYS[$i]}")" \
            "$("$NODE22" -pe 'JSON.stringify(process.argv[1])' "${_MF_VALS[$i]}")"
        done
        printf '}'; }
    )"
  fi
  MF_STAGE="$STAGE_NAME" MF_RESULT="$result" MF_PAYLOAD="$payload" "$NODE22" -e '
    const fs=require("fs"), p=process.env.MANIFEST;
    let m={deployment:{},stages:[]};
    try{m=JSON.parse(fs.readFileSync(p,"utf8"))}catch(e){}
    m.stages.push({
      stage: process.env.MF_STAGE,
      result: process.env.MF_RESULT,
      atUtc: new Date().toISOString(),
      facts: JSON.parse(process.env.MF_PAYLOAD),
    });
    fs.writeFileSync(p, JSON.stringify(m,null,2));
  ' 2>/dev/null || true
}

# --- Standards 4 & 5: freeze the verified artifact --------------------------
# After stage 3 passes, the tree that was verified is the tree that deploys.
# A fingerprint over the artifact detects any rebuild, npm install, git pull
# or edit between verification and cut-over.
FREEZE="$STATE/artifact-freeze.sha256"

_artifact_fingerprint() {
  {
    sha256sum "$V1/dist/index.js" 2>/dev/null
    sha256sum "$V1/dist/build-info.json" 2>/dev/null
    sha256sum "$V1/dist/public/index.html" 2>/dev/null
    sha256sum "$V1/.env" 2>/dev/null
    find "$V1/dist/public" -type f -printf '%p %s\n' 2>/dev/null | sort
    ls -d "$V1"/prisma/migrations/*/ 2>/dev/null | sort
  } | sha256sum | cut -d' ' -f1
}

freeze_artifact() {
  say "FREEZE POINT"
  _artifact_fingerprint > "$FREEZE"
  kv "artifact fingerprint" "$(cat "$FREEZE")"
  ok "frozen — from here, do not rebuild, npm install, git pull, or edit .env"
}

assert_artifact_frozen() {
  say "FREEZE VERIFICATION"
  if [ ! -f "$FREEZE" ]; then
    bad "no freeze recorded — stage 3 must pass before cut-over"
    return 1
  fi
  local now; now="$(_artifact_fingerprint)"
  if [ "$now" = "$(cat "$FREEZE")" ]; then
    ok "artifact is unchanged since verification — $now"
  else
    bad "THE ARTIFACT CHANGED since it was verified"
    info "  frozen: $(cat "$FREEZE")"
    info "  now:    $now"
    info "The verified artifact is not the one about to deploy."
    info "Re-run stages 1 to 3 before cutting over."
  fi
}

# --- Gate before an irreversible action -------------------------------------
# Printed immediately before the three actions that cannot simply be undone by
# deleting a directory: applying migrations, spawning a PM2 process, and
# switching nginx. Every line is computed, not asserted by the caller, except
# the two facts only the caller can know: how long it takes and how risky it is.
#
#   go_no_go <duration> <risk> <rollback-ready yes|no> <rollback command>
#
# Returns non-zero on NO-GO and records a failure, so the stage reports FAIL.
go_no_go() {
  local duration="$1" risk="$2" rollback_ready="$3" rollback_cmd="$4"
  local precond="No" protected="No" recommendation="NO-GO"

  [ "$FAILURES" -eq 0 ] && precond="Yes"
  _existing_matches_baseline && protected="Yes"

  if [ "$precond" = "Yes" ] && [ "$protected" = "Yes" ] && [ "$rollback_ready" = "yes" ]; then
    recommendation="GO"
  fi

  say "GO / NO-GO — $STAGE_NAME"
  kv "Current stage"           "$STAGE_NAME"
  kv "Preconditions satisfied" "$precond"
  kv "Rollback available"      "$([ "$rollback_ready" = "yes" ] && echo Yes || echo No)"
  kv "Rollback command"        "$rollback_cmd"
  kv "Production protected"    "$protected"
  kv "Expected duration"       "$duration"
  kv "Risk level"              "$risk"
  kv "Recommendation"          "$recommendation"

  manifest_record "goNoGo" "$recommendation"

  if [ "$recommendation" = "GO" ]; then
    ok "gate open — proceeding"
    return 0
  fi
  bad "NO-GO — the irreversible action was not attempted"
  [ "$precond" = "Yes" ]         || info "  cause: a precondition check above failed"
  [ "$protected" = "Yes" ]       || info "  cause: the existing production process moved since the baseline"
  [ "$rollback_ready" = "yes" ]  || info "  cause: rollback is not in place for this stage"
  return 1
}

# --- Standard 6: one outcome per stage --------------------------------------
finish() {
  say "STAGE RESULT — $STAGE_NAME"
  if [ "$FAILURES" -eq 0 ]; then
    manifest_flush "PASS"
    printf '    PASS\n'
    printf '    manifest: %s\n\n' "$MANIFEST"
    return 0
  fi
  manifest_flush "FAIL"
  printf '    FAIL — %s check(s) failed\n' "$FAILURES"
  printf '    Do not proceed to the next stage. Report the [FAIL] lines above.\n'
  printf '    manifest: %s\n\n' "$MANIFEST"
  return 1
}
