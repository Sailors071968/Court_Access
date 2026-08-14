#!/usr/bin/env bash
# ============================================================================
# Collect the evidence that discharges C1–C7 in DEPLOYMENT_CERTIFICATION.md,
# and say whether the deployment is certified.
#
# This certifies. It does not deploy. Bringing a release up is the staged
# procedure in DEPLOY_FROM_SCRATCH.md, which has go/no-go gates for the three
# irreversible actions; nothing here bypasses them. What this adds is the
# recording: one command that runs every verification in order, writes an
# evidence bundle a reviewer can read without trusting the operator's memory,
# and prints a verdict derived from the files rather than asserted.
#
#   export NODE22=... ; export V1=/var/www/courtaccess-v1
#   bash deploy/certify-production.sh                 # everything except a real reboot
#   bash deploy/certify-production.sh reboot-before   # then reboot the host
#   bash deploy/certify-production.sh reboot-after    # after it comes back
#
# SITE=courtaccess.net is audited when set; without it the public checks are
# recorded as NOT VERIFIED rather than skipped silently.
#
# Read-only except for the restart tests in verify-restart-survival.sh, which
# restart the application (and restore .env byte-for-byte). It never edits nginx,
# never cuts over, and never writes a secret into the bundle.
# ============================================================================

STAGE_NAME="Production certification"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=stages/_common.sh
. "$DIR/stages/_common.sh"

MODE="${1:-certify}"
SITE="${SITE:-}"
BASE="http://127.0.0.1:$V1_PORT"
BUNDLE_ROOT="$STATE/certification"
mkdir -p "$BUNDLE_ROOT"

PASSES=0
ok() { printf '    [ OK ] %s\n' "$*"; PASSES=$((PASSES+1)); }

deploy_env || { finish; exit 1; }

# Condition results, keyed C1..C7, written to the bundle and used for the verdict.
declare -A COND=()
cond() { COND["$1"]="$2"; }   # cond <id> <PASS|FAIL|NOT VERIFIED>

pm2_field() {
  pm2 jlist 2>/dev/null | PM2_EXPR="$1" "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
      let o="";try{o=p?eval(process.env.PM2_EXPR):""}catch(e){o=""}
      console.log(o===undefined||o===null?"":o);});' 2>/dev/null
}
code() { curl -s -o /dev/null -w '%{http_code}' --max-time "${2:-20}" "$1" 2>/dev/null; }

# --- Host and process facts, with no secrets in them ------------------------
# dump.pm2 and /proc/<pid>/environ both contain live secrets. Only names, flags
# and counts are recorded, so the bundle is safe to attach to a ticket.
capture_state() {  # capture_state <destination-directory> <label>
  local d="$1"; mkdir -p "$d"
  {
    echo "label:      $2"
    echo "capturedAt: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "host:       $(hostname)  $(uname -sr)"
    echo "operator:   $(whoami)"
    echo "node:       $("$NODE22" --version 2>&1)  ($NODE22)"
    echo "pm2:        $(pm2 --version 2>&1 | tail -1)"
    echo "nginx:      $(nginx -v 2>&1)"
    echo "uptime:     $(uptime -p 2>/dev/null)"
    echo "booted:     $(uptime -s 2>/dev/null)"
  } > "$d/host.txt"

  pm2 jlist 2>/dev/null | "$NODE22" -e '
    let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(s)}catch(e){}
      const secrets=["DATABASE_URL","JWT_SECRET","JWT_REFRESH_SECRET","COOKIE_SECRET"];
      console.log(JSON.stringify(ps.map(p=>({
        name:p.name, pid:p.pid, status:p.pm2_env.status,
        restarts:p.pm2_env.restart_time, unstable:p.pm2_env.unstable_restarts,
        uptimeSeconds:Math.round((Date.now()-(p.pm2_env.pm_uptime||Date.now()))/1000),
        interpreter:p.pm2_env.exec_interpreter,
        nodeArgs:[].concat(p.pm2_env.node_args||[]),
        cwd:p.pm2_env.pm_cwd,
        secretsHeldCount:secrets.filter(k=>p.pm2_env[k]).length,
      })),null,2));});' > "$d/pm2.json" 2>/dev/null

  if [ -f "${PM2_HOME:-$HOME/.pm2}/dump.pm2" ]; then
    DUMP_PATH="${PM2_HOME:-$HOME/.pm2}/dump.pm2" "$NODE22" -e '
      const fs=require("fs");
      let a=[];try{a=JSON.parse(fs.readFileSync(process.env.DUMP_PATH,"utf8"))}catch(e){}
      const secrets=["DATABASE_URL","JWT_SECRET","JWT_REFRESH_SECRET","COOKIE_SECRET"];
      console.log(JSON.stringify(a.map(x=>({
        name:x.name, nodeArgs:[].concat(x.node_args||[]),
        secretsHeldCount:secrets.filter(k=>x.env&&x.env[k]).length,
      })),null,2));' > "$d/dump-summary.json" 2>/dev/null
  else
    echo '"no dump.pm2"' > "$d/dump-summary.json"
  fi

  { for p in /api/health /api/health/ready /api/health/deep; do
      printf '%-22s local=%s' "$p" "$(code "$BASE$p")"
      [ -n "$SITE" ] && printf '  public=%s' "$(code "https://$SITE$p" 25)"
      printf '\n'
    done
    printf '%-22s local=%s' "POST /api/auth/login" \
      "$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST \
         -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
         "$BASE/api/auth/login" 2>/dev/null)"
    [ -n "$SITE" ] && printf '  public=%s' \
      "$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 -X POST \
         -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
         "https://$SITE/api/auth/login" 2>/dev/null)"
    printf '\n'
  } > "$d/health.txt"

  curl -s --max-time 20 "$BASE/api/health"       > "$d/health-body.json" 2>/dev/null
  curl -s --max-time 25 "$BASE/api/health/ready" > "$d/ready-body.json"  2>/dev/null
  sudo ss -lntp 2>/dev/null | grep -E ":($V1_PORT)\b" > "$d/listeners.txt"
  sudo nginx -T 2>/dev/null | grep -E 'server_name|proxy_pass|listen|root ' > "$d/nginx-effective.txt"

  local pid; pid="$(pm2_field 'p.pid')"
  if [ -n "$pid" ]; then
    printf 'secrets present in /proc/%s/environ: %s\n' "$pid" \
      "$(sudo tr '\0' '\n' < /proc/"$pid"/environ 2>/dev/null \
         | grep -cE '^(DATABASE_URL|JWT_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET)=')" \
      > "$d/provenance.txt"
  fi
}

# ===========================================================================
case "$MODE" in

# ---------------------------------------------------------------------------
reboot-before)
  BUNDLE="$BUNDLE_ROOT/reboot"
  rm -rf "$BUNDLE/before"; capture_state "$BUNDLE/before" "before reboot"
  say "PRE-REBOOT STATE RECORDED"
  kv "bundle" "$BUNDLE/before"
  sed 's/^/    /' "$BUNDLE/before/health.txt"
  info "Saved list and boot autostart must both be in place first:"
  if [ -f "${PM2_HOME:-$HOME/.pm2}/dump.pm2" ]; then ok "dump.pm2 exists"; else bad "no dump.pm2 — run pm2 save before rebooting"; fi
  if systemctl list-unit-files 2>/dev/null | grep -q '^pm2-'; then ok "a pm2 systemd unit exists"
  else bad "no pm2 systemd unit — a reboot will start nothing. Run pm2 startup"; fi
  say "NEXT"
  info "  sudo reboot"
  info "  then: bash deploy/certify-production.sh reboot-after"
  finish; exit $?
  ;;

# ---------------------------------------------------------------------------
reboot-after)
  BUNDLE="$BUNDLE_ROOT/reboot"
  [ -d "$BUNDLE/before" ] || { bad "no pre-reboot capture — run 'reboot-before' first"; finish; exit 1; }
  rm -rf "$BUNDLE/after"; capture_state "$BUNDLE/after" "after reboot"

  say "REBOOT COMPARISON"
  kv "booted before" "$(grep '^booted:' "$BUNDLE/before/host.txt" | cut -d: -f2-)"
  kv "booted after"  "$(grep '^booted:' "$BUNDLE/after/host.txt"  | cut -d: -f2-)"
  if [ "$(grep '^booted:' "$BUNDLE/before/host.txt")" = "$(grep '^booted:' "$BUNDLE/after/host.txt")" ]; then
    bad "the host has the same boot time — it has not actually rebooted"
  else
    ok "the host rebooted between the two captures"
  fi

  # The application must be back, healthy, and configured from the file.
  check "status after reboot" "online" "$(pm2_field 'p.pm2_env.status')"
  check "restart count after reboot" "0" "$(pm2_field 'p.pm2_env.restart_time')"
  for p in /api/health /api/health/ready /api/health/deep; do
    check "local $p after reboot" "200" "$(code "$BASE$p")"
  done
  [ -n "$SITE" ] && for p in /api/health /api/health/ready; do
    check "public $p after reboot" "200" "$(code "https://$SITE$p" 25)"
  done

  ARGS_AFTER="$(pm2_field 'p.pm2_env.node_args ? [].concat(p.pm2_env.node_args).join(" ") : ""')"
  case "$ARGS_AFTER" in
    *"--env-file=$V1/.env"*) ok "the resurrected process carries --env-file" ;;
    *) bad "the resurrected process has no --env-file — it is running on inherited state" ;;
  esac
  LEAKED_AFTER="$(sed -n 's/.*environ: //p' "$BUNDLE/after/provenance.txt" 2>/dev/null)"
  check "secrets injected by PM2 after reboot" "0" "${LEAKED_AFTER:-unknown}"

  if [ "$FAILURES" -eq 0 ]; then
    printf '\n    C4 / 5.7 DISCHARGED — reboot persistence verified on this host\n'
    printf '    Evidence: %s\n' "$BUNDLE"
  fi
  finish; exit $?
  ;;

# ---------------------------------------------------------------------------
certify) ;;
*) bad "unknown mode '$MODE' — use certify, reboot-before or reboot-after"; finish; exit 1 ;;
esac

# ===========================================================================
# certify
# ===========================================================================
BUNDLE="$BUNDLE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BUNDLE"

say "EVIDENCE BUNDLE"
kv "bundle" "$BUNDLE"
kv "release" "$V1"
kv "site" "${SITE:-<not set — public checks will be NOT VERIFIED>}"
capture_state "$BUNDLE/state" "at certification"
ok "host, process, health, listener, nginx and provenance state recorded"

# --- C1 · the artifact starts without PM2 ----------------------------------
say "C1 · STANDALONE STARTUP  (no PM2, emptied environment)"
if bash "$DIR/stages/standalone-check.sh" > "$BUNDLE/c1-standalone.log" 2>&1; then
  ok "standalone-check.sh PASS"; cond C1 PASS
else
  bad "standalone-check.sh FAILED — see $BUNDLE/c1-standalone.log"
  grep '\[FAIL\]' "$BUNDLE/c1-standalone.log" | head -5 | sed 's/^/      /'
  cond C1 FAIL
fi

# --- C2, C3 · the deployment audit -----------------------------------------
say "C2 / C3 · DEPLOYMENT AUDIT"
if bash "$DIR/audit-deployment.sh" > "$BUNDLE/c2-audit.log" 2>&1; then
  ok "audit-deployment.sh reports PRODUCTION READY"; cond C2 PASS; cond C6 PASS
else
  bad "audit-deployment.sh reports NOT PRODUCTION READY"
  grep '\[FAIL\]' "$BUNDLE/c2-audit.log" | head -10 | sed 's/^/      /'
  cond C2 FAIL; cond C6 FAIL
fi
# C3 is specifically the saved definition, which the audit checks in group 9.
if grep -q 'the saved definition carries --env-file' "$BUNDLE/c2-audit.log" \
   && grep -q 'the saved definition holds no application secrets' "$BUNDLE/c2-audit.log"; then
  ok "the saved definition carries --env-file and holds no secrets"; cond C3 PASS
else
  bad "the saved definition is not certifiable — run pm2 save, then re-run"; cond C3 FAIL
fi

# --- C3 · restart, resurrect, systemd unit ---------------------------------
say "C3 · RESTART AND RESURRECT"
if bash "$DIR/stages/verify-restart-survival.sh" > "$BUNDLE/c3-survival.log" 2>&1; then
  ok "verify-restart-survival.sh PASS"
else
  bad "verify-restart-survival.sh FAILED"
  grep '\[FAIL\]' "$BUNDLE/c3-survival.log" | head -5 | sed 's/^/      /'
  cond C3 FAIL
fi

# --- C4 · reboot -----------------------------------------------------------
say "C4 · REBOOT PERSISTENCE"
if [ -d "$BUNDLE_ROOT/reboot/after" ]; then
  kv "previous reboot evidence" "$BUNDLE_ROOT/reboot"
  if grep -q '^booted:' "$BUNDLE_ROOT/reboot/after/host.txt" 2>/dev/null \
     && ! diff -q <(grep '^booted:' "$BUNDLE_ROOT/reboot/before/host.txt") \
                  <(grep '^booted:' "$BUNDLE_ROOT/reboot/after/host.txt") >/dev/null 2>&1; then
    ok "a real reboot has been recorded on this host"; cond C4 PASS
  else
    bad "the recorded reboot evidence does not show a boot-time change"; cond C4 FAIL
  fi
else
  info "no real reboot recorded on this host."
  info "  bash deploy/certify-production.sh reboot-before"
  info "  sudo reboot"
  info "  bash deploy/certify-production.sh reboot-after"
  cond C4 "NOT VERIFIED"
fi

# --- C5 · the public endpoints ---------------------------------------------
say "C5 · PUBLIC ENDPOINTS"
if [ -z "$SITE" ]; then
  info "SITE is not set — export SITE=courtaccess.net to audit the public name"
  cond C5 "NOT VERIFIED"
else
  PUB_OK=yes
  for p in /api/health /api/health/ready /api/health/deep; do
    c="$(code "https://$SITE$p" 25)"
    if [ "$c" = "200" ]; then ok "https://$SITE$p — 200"
    else bad "https://$SITE$p — $c"; PUB_OK=no; fi
  done
  LOGIN="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 -X POST \
    -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
    "https://$SITE/api/auth/login" 2>/dev/null)"
  if [ "$LOGIN" = "401" ]; then ok "public bad login — 401 (the real build is answering)"
  else bad "public bad login — $LOGIN (404 means an older application is live)"; PUB_OK=no; fi
  [ "$PUB_OK" = yes ] && cond C5 PASS || cond C5 FAIL
fi

# --- functional evidence ---------------------------------------------------
say "FUNCTIONAL SMOKE TEST"
if "$NODE22" "$DIR/stages/smoke-test.mjs" "$BASE" > "$BUNDLE/smoke.log" 2>&1; then
  ok "$(grep -oE '[0-9]+/[0-9]+ checks passed' "$BUNDLE/smoke.log" | tail -1) — functional smoke test passed"
else
  bad "functional smoke test FAILED — see $BUNDLE/smoke.log"
fi

# --- C7 · backup restores --------------------------------------------------
say "C7 · BACKUP RESTORE DRILL"
info "not run automatically: it creates a scratch database and takes a full dump."
info "  See OPERATIONS_PLAYBOOK.md §9, then record the table count here."
if [ -f "$BUNDLE_ROOT/backup-drill.txt" ]; then
  kv "recorded drill" "$(cat "$BUNDLE_ROOT/backup-drill.txt")"
  ok "a restore drill has been recorded"; cond C7 PASS
else
  info "  To record one:  echo '<tables restored> on <date>' > $BUNDLE_ROOT/backup-drill.txt"
  cond C7 "NOT VERIFIED"
fi

# --- Verdict ---------------------------------------------------------------
say "CONDITIONS"
CERT=yes
for c in C1 C2 C3 C4 C5 C6 C7; do
  s="${COND[$c]:-NOT VERIFIED}"
  printf '    %-4s %s\n' "$c" "$s"
  [ "$s" = PASS ] || CERT=no
done

{ printf '{\n  "capturedAt": "%s",\n  "host": "%s",\n  "release": "%s",\n  "site": "%s",\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(hostname)" "$V1" "${SITE:-}"
  printf '  "conditions": {'
  first=1
  for c in C1 C2 C3 C4 C5 C6 C7; do
    [ $first -eq 0 ] && printf ','
    first=0
    printf '\n    "%s": "%s"' "$c" "${COND[$c]:-NOT VERIFIED}"
  done
  printf '\n  },\n  "failures": %s,\n  "verdict": "%s"\n}\n' \
    "$FAILURES" "$([ "$CERT" = yes ] && echo CERTIFIED || echo 'NOT CERTIFIED')"
} > "$BUNDLE/summary.json"

say "VERDICT"
if [ "$CERT" = yes ]; then
  printf '    CERTIFIED\n'
  printf '    Every condition C1-C7 is PASS, from executed evidence in:\n      %s\n' "$BUNDLE"
  printf '    Next: tag the release and freeze the deployment infrastructure.\n'
  printf '      See DEPLOYMENT_CERTIFICATION.md, "Tagging and freeze".\n'
else
  printf '    NOT CERTIFIED\n'
  printf '    Conditions above that are not PASS are the reasons. Evidence:\n      %s\n' "$BUNDLE"
fi
kv "summary" "$BUNDLE/summary.json"
finish
