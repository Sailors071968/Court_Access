#!/usr/bin/env bash
# ============================================================================
# Does the deployment survive a restart, a daemon reload and a reboot?
#
# The crash loop that prompted this was not a startup fault. The application
# started correctly, ran for a 30-minute observation window with zero restarts,
# and only failed later, when PM2 respawned it from a saved definition that no
# longer carried an environment. Nothing in the deployment tested that path, so
# the failure could only be found in production.
#
# This tests it. Three properties, in increasing strength:
#
#   1. The saved definition (dump.pm2) carries --env-file and holds no copy of
#      the application's own variables. A copy would take precedence over the
#      file and go stale silently.
#   2. `pm2 restart` picks up an edit to .env. If it does not, the running
#      environment is daemon state, not the file.
#   3. Optionally, a full daemon kill and resurrect — the actual reboot path.
#
# Step 3 stops every process the daemon manages, including the application still
# serving the live site, so it is off by default and refuses to run while
# anything other than this deployment is present:
#
#   bash deploy/stages/verify-restart-survival.sh              # steps 1 and 2
#   FULL_CYCLE=yes bash deploy/stages/verify-restart-survival.sh
#
# Run it after `pm2 save`. Step 2 restarts the V1 process, which is not serving
# traffic before cut-over; run it before cut-over, not after.
#
# Rollback: none — no configuration is modified. .env is restored byte for byte
# and verified, and the process is left running.
# ============================================================================

STAGE_NAME="Restart, reload and reboot survivability"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

FULL_CYCLE="${FULL_CYCLE:-no}"
BASE="http://127.0.0.1:$V1_PORT"
DUMP="${PM2_HOME:-$HOME/.pm2}/dump.pm2"

deploy_env || { finish; exit 1; }
verify_interpreter
baseline_existing

# pm2 jlist for one field, so the several call sites do not each restate it.
pm2_field() {  # pm2_field <js expression over `p`>
  pm2 jlist 2>/dev/null | PM2_EXPR="$1" "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
      let out="";try{out=p?eval(process.env.PM2_EXPR):""}catch(e){out=""}
      console.log(out===undefined||out===null?"":out);});' 2>/dev/null
}

say "PRE-FLIGHT"
[ -f "$V1/.env" ] || { bad "$V1/.env missing"; finish; exit 1; }
if ! pm2 ping >/dev/null 2>&1; then
  bad "the pm2 daemon is not responding"; finish; exit 1
fi
RUNNING_PID="$(pm2_field 'p.pid')"
check_nonempty "$V1_PM2_NAME is running (pid)" "$RUNNING_PID"
[ -n "$RUNNING_PID" ] || { info "start it with stage 3 first"; finish; exit 1; }

CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/api/health")"
check "health before we touch anything" "200" "$CODE"

# ---------------------------------------------------------------------------
say "1 — THE SAVED DEFINITION"
# ---------------------------------------------------------------------------
if [ ! -f "$DUMP" ]; then
  bad "no $DUMP — run 'pm2 save', otherwise a reboot starts nothing"
else
  kv "dump.pm2" "$DUMP  ($(stat -c '%y' "$DUMP" 2>/dev/null))"
  DUMP_REPORT="$(DUMP_PATH="$DUMP" "$NODE22" -e '
    const fs=require("fs");
    let apps=[];try{apps=JSON.parse(fs.readFileSync(process.env.DUMP_PATH,"utf8"))}catch(e){}
    const a=apps.find(x=>x.name===process.env.V1_PM2_NAME);
    if(!a){console.log("ABSENT");process.exit(0)}
    const args=[].concat(a.node_args||[]).join(" ");
    const secrets=["DATABASE_URL","JWT_SECRET","JWT_REFRESH_SECRET","COOKIE_SECRET"];
    const held=secrets.filter(k=>a.env&&a.env[k]);
    console.log(JSON.stringify({args,held,script:a.script||a.pm_exec_path||""}));
  ' 2>/dev/null)"

  if [ "$DUMP_REPORT" = "ABSENT" ]; then
    bad "$V1_PM2_NAME is not in the saved definition — a reboot would not start it"
    info "Run: pm2 save"
  elif [ -z "$DUMP_REPORT" ]; then
    bad "could not read the saved definition"
  else
    SAVED_ARGS="$(printf '%s' "$DUMP_REPORT" | "$NODE22" -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).args')"
    SAVED_HELD="$(printf '%s' "$DUMP_REPORT" | "$NODE22" -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).held.join(" ")')"
    kv "saved node_args" "${SAVED_ARGS:-<none>}"

    case "$SAVED_ARGS" in
      *"--env-file=$V1/.env"*) ok "the saved definition carries --env-file — it survives pm2 save" ;;
      *) bad "the saved definition has no --env-file; a resurrect would start with no environment" ;;
    esac

    if [ -z "$SAVED_HELD" ]; then
      ok "the saved definition holds no application secrets — nothing to go stale"
    else
      bad "the saved definition holds a copy of: $SAVED_HELD"
      info "A saved copy takes precedence over --env-file, so after a reboot the"
      info "process would use these values however .env changes. Re-run stage 3"
      info "from a shell that has not sourced .env, then pm2 save again."
    fi
  fi
fi

# ---------------------------------------------------------------------------
say "2 — DOES A RESTART READ THE FILE AGAIN?"
# ---------------------------------------------------------------------------
# A marker variable is appended, rather than an existing one being changed, so
# the application's configuration is never briefly wrong. It is removed and the
# file compared byte for byte afterwards.
ENV_BACKUP="$STATE/env.before-survival-check"
cp -a "$V1/.env" "$ENV_BACKUP" || { bad "could not back up .env"; finish; exit 1; }
kv "backup of .env" "$ENV_BACKUP"
MARKER="survival-probe-$(date +%s)-$$"

restore_env() {
  if [ -f "$ENV_BACKUP" ]; then
    cp -a "$ENV_BACKUP" "$V1/.env"
    if cmp -s "$ENV_BACKUP" "$V1/.env"; then
      ok ".env restored and byte-identical to the backup"
    else
      bad ".env does NOT match the backup — restore it by hand from $ENV_BACKUP"
    fi
  fi
}
trap 'restore_env' EXIT INT TERM

printf '\nSURVIVAL_PROBE=%s\n' "$MARKER" >> "$V1/.env"
info "appended SURVIVAL_PROBE to .env, then restarting"

# --update-env is deliberately absent: it would copy this shell's environment
# over the process's, which is the behaviour being replaced.
pm2 restart "$V1_PM2_NAME" >/dev/null 2>&1
for _ in $(seq 1 40); do
  curl -sf --max-time 2 "$BASE/api/health" >/dev/null 2>&1 && break
  sleep 1
done

NEW_PID="$(pm2_field 'p.pid')"
check_nonempty "process after restart (pid)" "$NEW_PID"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/health")"
check "health after restart" "200" "$CODE"

# Deliberately not read from /proc/PID/cmdline. PM2 rewrites process.title for
# the processes it manages, which overwrites that region: the real argv is
# replaced by "node /path/to/index.js" padded with spaces, and --env-file
# disappears from it even though the process was started with it [verified]. ps
# shows the same rewritten string. The live definition is the reliable source.
RESPAWN_ARGS="$(pm2_field 'p.pm2_env.node_args ? [].concat(p.pm2_env.node_args).join(" ") : ""')"
kv "node_args after restart" "${RESPAWN_ARGS:-<none>}"
case "$RESPAWN_ARGS" in
  *"--env-file=$V1/.env"*) ok "the respawned process kept --env-file" ;;
  *) bad "--env-file was lost from the definition on restart" ;;
esac

# The authoritative test: ask a Node process started exactly as PM2 starts this
# one whether it can see the marker. If the file is genuinely re-read at spawn,
# it can.
SEEN="$(env -i "$NODE22" --env-file="$V1/.env" -p 'process.env.SURVIVAL_PROBE||""' 2>/dev/null)"
check "a fresh spawn reads the edited file" "$MARKER" "$SEEN"

restore_env
trap - EXIT INT TERM
pm2 restart "$V1_PM2_NAME" >/dev/null 2>&1
for _ in $(seq 1 40); do
  curl -sf --max-time 2 "$BASE/api/health" >/dev/null 2>&1 && break
  sleep 1
done
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/health")"
check "health after restoring .env and restarting" "200" "$CODE"

# ---------------------------------------------------------------------------
say "3 — FULL DAEMON KILL AND RESURRECT  (the reboot path)"
# ---------------------------------------------------------------------------
if [ "$FULL_CYCLE" != "yes" ]; then
  info "skipped — set FULL_CYCLE=yes to run it."
  info "It stops every process this daemon manages. Before cut-over that"
  info "includes the application serving the live site, so it is only safe once"
  info "this deployment is the only thing in 'pm2 list'."
  OTHERS="$(pm2 jlist 2>/dev/null | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      console.log(ps.filter(p=>p.name!==process.env.V1_PM2_NAME).map(p=>p.name).join(", "));});' 2>/dev/null)"
  kv "other PM2 processes" "${OTHERS:-none}"
  [ -z "$OTHERS" ] && info "Nothing else is managed by this daemon, so FULL_CYCLE is safe to run now."
else
  OTHERS="$(pm2 jlist 2>/dev/null | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      console.log(ps.filter(p=>p.name!==process.env.V1_PM2_NAME).map(p=>p.name).join(", "));});' 2>/dev/null)"
  if [ -n "$OTHERS" ]; then
    bad "refusing FULL_CYCLE: the daemon also manages $OTHERS"
    info "Killing it would stop those too. Run this only when $V1_PM2_NAME is alone."
  else
    pm2 save >/dev/null 2>&1 && ok "saved the current process list" || bad "pm2 save failed"
    info "killing the daemon..."
    pm2 kill >/dev/null 2>&1
    sleep 2
    if curl -sf --max-time 3 "$BASE/api/health" >/dev/null 2>&1; then
      bad "the application still answers after pm2 kill — something else holds the port"
    else
      ok "the daemon and the application are stopped"
    fi

    # Resurrect from an environment stripped of everything .env defines: the
    # reboot case, where systemd starts the daemon with no operator shell.
    ENV_KEYS="$("$NODE22" -e '
      const fs=require("fs");
      const keep=new Set(["PATH","HOME","PM2_HOME","USER","LOGNAME","SHELL","TERM","LANG","LC_ALL"]);
      const keys=new Set();
      for (const line of fs.readFileSync(process.argv[1],"utf8").split("\n")) {
        const m=/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
        if (m && !keep.has(m[1])) keys.add(m[1]);
      }
      console.log([...keys].join(" "));' "$V1/.env" 2>/dev/null)"
    UNSET_ARGS=(); for k in $ENV_KEYS; do UNSET_ARGS+=( -u "$k" ); done
    info "resurrecting with $(printf '%s' "$ENV_KEYS" | wc -w) variables stripped from the shell"
    env "${UNSET_ARGS[@]}" pm2 resurrect >/dev/null 2>&1

    for _ in $(seq 1 60); do
      curl -sf --max-time 2 "$BASE/api/health" >/dev/null 2>&1 && break
      sleep 1
    done
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/health")"
    READY="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/api/health/ready")"
    check "health after resurrect"  "200" "$CODE"
    check "readiness after resurrect" "200" "$READY"
    RESTARTS="$(pm2_field 'p.pm2_env.restart_time')"
    check "restart count after resurrect" "0" "${RESTARTS:-missing}"
    if [ "$CODE" = "200" ] && [ "$READY" = "200" ]; then
      ok "the deployment survives a reboot: environment reloaded from the file"
    fi
  fi
fi

say "REBOOT AUTOSTART"
# dump.pm2 is only consulted if something runs `pm2 resurrect` at boot.
if systemctl list-unit-files 2>/dev/null | grep -q '^pm2-'; then
  UNIT="$(systemctl list-unit-files 2>/dev/null | grep '^pm2-' | awk '{print $1}' | head -1)"
  kv "systemd unit" "$UNIT"
  if systemctl is-enabled "$UNIT" >/dev/null 2>&1; then
    ok "$UNIT is enabled — the saved list is resurrected at boot"
  else
    bad "$UNIT exists but is not enabled — nothing starts after a reboot"
    info "Run: sudo systemctl enable $UNIT"
  fi
else
  bad "no pm2 systemd unit — nothing resurrects the saved list after a reboot"
  info "Run 'pm2 startup' and then the command it prints."
fi

manifest_record "survivalSavedArgs"  "${SAVED_ARGS:-<none>}"
manifest_record "survivalSavedHeld"  "${SAVED_HELD:-none}"
manifest_record "survivalFullCycle"  "$FULL_CYCLE"

assert_existing_unchanged
finish
