#!/usr/bin/env bash
# ============================================================================
# Stage 5 — Observation period after cut-over.
#
# Switching nginx is not the end of the deployment. This samples the running
# system at intervals and reports whether it is stable or drifting. The
# previous application stays running throughout, so rollback remains one file
# restore away for the whole window.
#
#   export NODE22=...
#   bash deploy/stages/stage5-observe.sh            # default 30 minutes
#   OBSERVE_MINUTES=60 bash deploy/stages/stage5-observe.sh
#
# Rollback at any point: bash deploy/stages/rollback.sh
# ============================================================================

STAGE_NAME="Stage 5 — post-cut-over observation"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

SITE="${SITE:-courtaccess.net}"
OBSERVE_MINUTES="${OBSERVE_MINUTES:-30}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-120}"
SAMPLES=$(( OBSERVE_MINUTES * 60 / INTERVAL_SECONDS ))
LOG="$STATE/observation-$(date +%Y%m%d-%H%M%S).log"

deploy_env || { finish; exit 1; }

say "OBSERVATION WINDOW"
kv "site"        "https://$SITE"
kv "duration"    "$OBSERVE_MINUTES minutes"
kv "interval"    "$INTERVAL_SECONDS seconds ($SAMPLES samples)"
kv "log"         "$LOG"
info "Rollback stays available for the whole window: bash deploy/stages/rollback.sh"

sample() {
  local n="$1"
  local pm2json restarts mem cpu health ready code_login rss
  pm2json="$(pm2 jlist 2>/dev/null)"
  restarts="$(printf '%s' "$pm2json" | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
      console.log(p?p.pm2_env.restart_time:"?");});' 2>/dev/null)"
  mem="$(printf '%s' "$pm2json" | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
      console.log(p&&p.monit?Math.round(p.monit.memory/1048576):"?");});' 2>/dev/null)"
  cpu="$(printf '%s' "$pm2json" | "$NODE22" -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      let ps=[];try{ps=JSON.parse(d)}catch(e){}
      const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
      console.log(p&&p.monit?p.monit.cpu:"?");});' 2>/dev/null)"
  health="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$SITE/api/health")"
  ready="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$SITE/api/health/ready")"
  code_login="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST \
    -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}' \
    "https://$SITE/api/auth/login")"
  local disk; disk="$(df -Pm /var | awk 'NR==2{print $4}')"

  printf '%-5s %-20s restarts=%-4s mem=%-6s cpu=%-5s health=%-4s ready=%-4s login=%-4s freeMB=%s\n' \
    "$n" "$(date -u +%H:%M:%S)" "$restarts" "${mem}MB" "$cpu" "$health" "$ready" "$code_login" "$disk" \
    | tee -a "$LOG"

  # Anything here means stop and consider rollback.
  [ "$health" != "200" ] && bad "sample $n: health returned $health"
  [ "$ready" = "503" ]   && bad "sample $n: readiness returned 503"
  [ "$code_login" = "404" ] && bad "sample $n: login returned 404 — the old application may be answering"
  [ "${restarts:-0}" != "${FIRST_RESTARTS:-0}" ] && bad "sample $n: restart count moved ${FIRST_RESTARTS} -> ${restarts}"
  [ "${disk:-999999}" -lt 2048 ] && bad "sample $n: less than 2 GB free on /var"
  return 0
}

say "SAMPLING"
FIRST_RESTARTS="$(pm2 jlist 2>/dev/null | "$NODE22" -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    let ps=[];try{ps=JSON.parse(d)}catch(e){}
    const p=ps.find(x=>x.name===process.env.V1_PM2_NAME);
    console.log(p?p.pm2_env.restart_time:"0");});' 2>/dev/null)"
kv "restart count at start" "$FIRST_RESTARTS"
MEM_FIRST=""

for i in $(seq 1 "$SAMPLES"); do
  sample "$i"
  [ "$i" -eq 1 ] && MEM_FIRST="$(tail -1 "$LOG" | sed -E 's/.*mem=([0-9]+)MB.*/\1/')"
  [ "$FAILURES" -gt 0 ] && { info "stopping early — see the [FAIL] lines"; break; }
  [ "$i" -lt "$SAMPLES" ] && sleep "$INTERVAL_SECONDS"
done

say "TREND"
MEM_LAST="$(tail -1 "$LOG" | sed -E 's/.*mem=([0-9]+)MB.*/\1/')"
kv "memory first sample" "${MEM_FIRST:-?} MB"
kv "memory last sample"  "${MEM_LAST:-?} MB"
if [ -n "${MEM_FIRST:-}" ] && [ -n "${MEM_LAST:-}" ] && [ "$MEM_FIRST" -gt 0 ] 2>/dev/null; then
  GROWTH=$(( (MEM_LAST - MEM_FIRST) * 100 / MEM_FIRST ))
  kv "memory growth" "${GROWTH}%"
  if [ "$GROWTH" -gt 50 ]; then
    bad "memory grew ${GROWTH}% during the window — investigate before declaring complete"
  else ok "memory growth within tolerance"; fi
fi

say "APPLICATION LOG — errors during the window"
ERRS="$(pm2 logs "$V1_PM2_NAME" --lines 400 --nostream 2>/dev/null | grep -icE 'error|unhandled|fatal' || echo 0)"
kv "error-ish log lines (last 400)" "$ERRS"
pm2 logs "$V1_PM2_NAME" --lines 400 --nostream 2>/dev/null \
  | grep -iE 'error|unhandled|fatal' | tail -8 | sed 's/^/    /'

manifest_record "observationMinutes" "$OBSERVE_MINUTES"
manifest_record "restartCountStart"  "$FIRST_RESTARTS"
manifest_record "memoryFirstMB"      "${MEM_FIRST:-}"
manifest_record "memoryLastMB"       "${MEM_LAST:-}"
manifest_record "observationLog"     "$LOG"

assert_existing_unchanged

if [ "$FAILURES" -eq 0 ]; then
  say "DEPLOYMENT MAY NOW BE DECLARED COMPLETE"
  info "Keep the previous installation and its database until Case 001 has completed."
fi
finish
