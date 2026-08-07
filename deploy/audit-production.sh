#!/usr/bin/env bash
#
# Production cutover readiness audit — READ ONLY.
#
# Changes nothing. Starts nothing. Stops nothing. Every command below either
# reads a file, queries a service for its status, or prints a version.
#
#   bash audit-production.sh > courtaccess-audit-$(date +%F).txt 2>&1
#
# Secrets are never printed — only whether a variable is set.

set -uo pipefail
say() { printf '\n========== %s ==========\n' "$*"; }
val() { printf '  %-34s %s\n' "$1" "${2:-<not found>}"; }
present() { [ -n "${2:-}" ] && printf '  %-34s SET (%s chars)\n' "$1" "${#2}" || printf '  %-34s MISSING\n' "$1"; }

say "PHASE 1 — RUNTIME"
val "OS" "$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")"
val "kernel" "$(uname -r)"
val "node" "$(node --version 2>/dev/null)"
val "npm" "$(npm --version 2>/dev/null)"
val "pm2" "$(pm2 --version 2>/dev/null)"
val "ffmpeg" "$(ffprobe -version 2>/dev/null | head -1)"

echo; echo "-- PM2 processes --"; pm2 list 2>/dev/null
echo; echo "-- PM2 process detail --"
for NAME in $(pm2 jlist 2>/dev/null | python3 -c 'import json,sys;[print(p["name"]) for p in json.load(sys.stdin)]' 2>/dev/null); do
  echo "  [$NAME]"
  pm2 describe "$NAME" 2>/dev/null | grep -E 'script path|exec cwd|exec mode|status|restarts|node args|script args|instances|unstable' | sed 's/^/    /'
done
echo; echo "-- PM2 startup / persistence --"
val "dump file" "$([ -f ~/.pm2/dump.pm2 ] && stat -c '%s bytes, modified %y' ~/.pm2/dump.pm2)"
val "startup unit" "$(systemctl list-units --all 2>/dev/null | grep -i pm2 | head -1)"
echo "  processes in dump:"; python3 -c "
import json,sys
try: print('   ', ', '.join(p['name'] for p in json.load(open('$HOME/.pm2/dump.pm2'))))
except Exception as e: print('    could not read:', e)
" 2>/dev/null
echo; echo "-- ecosystem file --"
for F in /var/www/courtaccess/ecosystem.config.js /var/www/courtaccess/ecosystem.config.cjs ~/ecosystem.config.js; do
  [ -f "$F" ] && { echo "  found: $F"; cat "$F" | sed 's/^/    /'; }
done
[ -f /var/www/courtaccess/ecosystem.config.js ] || echo "  no ecosystem file found in the usual places"

say "PHASE 1 — APPLICATION DIRECTORY"
val "path" "/var/www/courtaccess"
ls -la /var/www/courtaccess/ 2>/dev/null | sed 's/^/  /'
echo; echo "-- dist --"; ls -la /var/www/courtaccess/dist/ 2>/dev/null | head -20 | sed 's/^/  /'
val "dist/index.js sha256" "$(sha256sum /var/www/courtaccess/dist/index.js 2>/dev/null | cut -d' ' -f1)"
val "dist/index.js modified" "$(stat -c '%y' /var/www/courtaccess/dist/index.js 2>/dev/null)"
val "node_modules present" "$([ -d /var/www/courtaccess/node_modules ] && echo yes || echo NO)"
val "git repo" "$(git -C /var/www/courtaccess rev-parse --git-dir 2>/dev/null && echo yes || echo 'not a git checkout')"
val "git commit" "$(git -C /var/www/courtaccess rev-parse HEAD 2>/dev/null)"
val "git branch" "$(git -C /var/www/courtaccess rev-parse --abbrev-ref HEAD 2>/dev/null)"

say "PHASE 1 / 8 — ENVIRONMENT (presence only, never values)"
PID=$(pm2 jlist 2>/dev/null | python3 -c 'import json,sys;[print(p["pid"]) for p in json.load(sys.stdin) if p["pm2_env"]["status"]=="online"]' 2>/dev/null | head -1)
if [ -n "${PID:-}" ] && [ -r "/proc/$PID/environ" ]; then
  ENVDUMP=$(tr '\0' '\n' < "/proc/$PID/environ")
  for V in NODE_ENV PORT HOST DATABASE_URL REDIS_URL REDIS_HOST JWT_SECRET JWT_REFRESH_SECRET COOKIE_SECRET FRONTEND_URL \
           CERTIFICATION_STAGING_DIR EVIDENCE_UPLOAD_DIR AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION S3_BUCKET \
           STRIPE_SECRET_KEY OPENAI_API_KEY ANTHROPIC_API_KEY GOOGLE_AI_API_KEY TWILIO_ACCOUNT_SID SMTP_HOST SES_REGION; do
    LINE=$(echo "$ENVDUMP" | grep "^$V=" | head -1)
    case "$V" in
      NODE_ENV|PORT|HOST|AWS_REGION|SES_REGION|FRONTEND_URL|CERTIFICATION_STAGING_DIR|EVIDENCE_UPLOAD_DIR)
        val "$V" "${LINE#*=}" ;;
      *) present "$V" "${LINE#*=}" ;;
    esac
  done
else
  echo "  Could not read the running process environment (need the owning user or root)."
fi
echo; echo "-- .env files on disk (presence and key names only) --"
for F in /var/www/courtaccess/.env /var/www/courtaccess/.env.production; do
  [ -f "$F" ] && { echo "  $F: $(grep -c '=' "$F") entries"; grep -oE '^[A-Z_]+' "$F" | sed 's/^/    /'; }
done

say "PHASE 2 — POSTGRESQL"
val "server version" "$(psql --version 2>/dev/null)"
val "listening" "$(ss -lntH 'sport = :5432' 2>/dev/null | head -1)"
if command -v psql >/dev/null; then
  DB="${PGDATABASE:-courtaccess}"
  psql -d "$DB" -tAc "select version();" 2>/dev/null | sed 's/^/  version: /'
  psql -d "$DB" -tAc "select pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null | sed 's/^/  size: /'
  psql -d "$DB" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';" 2>/dev/null | sed 's/^/  tables: /'
  psql -d "$DB" -tAc "select count(*) from _prisma_migrations;" 2>/dev/null | sed 's/^/  migrations recorded: /'
  psql -d "$DB" -tAc "select count(*) from _prisma_migrations where finished_at is null;" 2>/dev/null | sed 's/^/  migrations unfinished: /'
  psql -d "$DB" -tAc "select count(*) from pg_stat_activity where datname=current_database();" 2>/dev/null | sed 's/^/  active connections: /'
fi
echo "-- backups --"
ls -lht /var/backups/*.dump /var/backups/*.sql* /var/lib/pgsql/backups/* 2>/dev/null | head -5 | sed 's/^/  /' || echo "  no dumps found in the usual locations"
crontab -l 2>/dev/null | grep -iE 'pg_dump|backup' | sed 's/^/  cron: /' || echo "  no backup cron entry for this user"

say "PHASE 3 — REDIS"
val "listening" "$(ss -lntH 'sport = :6379' 2>/dev/null | head -1)"
if command -v redis-cli >/dev/null; then
  redis-cli INFO server 2>/dev/null | grep -E 'redis_version|uptime_in_days' | sed 's/^/  /'
  redis-cli INFO persistence 2>/dev/null | grep -E 'aof_enabled|rdb_last_bgsave_status|rdb_changes' | sed 's/^/  /'
  redis-cli INFO memory 2>/dev/null | grep -E 'used_memory_human|maxmemory_human' | sed 's/^/  /'
  redis-cli INFO clients 2>/dev/null | grep -E 'connected_clients' | sed 's/^/  /'
  echo "  bull queues: $(redis-cli --scan --pattern 'bull:*' 2>/dev/null | head -20 | wc -l) key(s) sampled"
else
  echo "  redis-cli not installed"
fi

say "PHASE 1 — HOST RESOURCES"
val "cpu cores" "$(nproc 2>/dev/null)"
val "load average" "$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null)"
echo "-- memory --"; free -h 2>/dev/null | sed 's/^/  /'
echo "-- swap --"; swapon --show 2>/dev/null | sed 's/^/  /' || echo "  no swap configured"
val "uptime" "$(uptime -p 2>/dev/null)"

say "PHASE 4 — STORAGE"
df -h / /var /var/www 2>/dev/null | sed 's/^/  /'
echo "-- upload directories --"
for D in /var/www/courtaccess/uploads /var/lib/courtaccess /var/www/courtaccess/evidence /tmp/courtaccess-certification-staging; do
  [ -d "$D" ] && { printf '  %-44s ' "$D"; stat -c 'owner=%U:%G perms=%a' "$D"; du -sh "$D" 2>/dev/null | sed 's/^/    size: /'; }
done
val "inodes free on /var" "$(df -i /var 2>/dev/null | awk 'NR==2{print $4}')"

say "PHASE 5 — NGINX"
val "version" "$(nginx -v 2>&1)"
echo "-- effective configuration for courtaccess --"
nginx -T 2>/dev/null | awk '/server[[:space:]]*\{/,/^\}/' | grep -B2 -A40 'courtaccess' | head -70 | sed 's/^/  /'
echo "-- key directives anywhere in the config --"
for D in client_max_body_size proxy_read_timeout proxy_send_timeout proxy_request_buffering gzip ssl_certificate expires; do
  printf '  %-28s ' "$D"; nginx -T 2>/dev/null | grep -E "^\s*$D" | head -2 | tr -d '\n' | sed 's/^\s*//' ; echo
done
echo "-- certificates --"
for C in $(nginx -T 2>/dev/null | grep -oP 'ssl_certificate\s+\K[^;]+' | sort -u); do
  echo "  $C"; openssl x509 -in "$C" -noout -subject -dates 2>/dev/null | sed 's/^/    /'
done
echo "-- certificate as actually served (the authoritative check) --"
echo | timeout 15 openssl s_client -servername courtaccess.net -connect 127.0.0.1:443 2>/dev/null \
  | openssl x509 -noout -dates -serial 2>/dev/null | sed 's/^/  /' || echo "  could not handshake locally"

echo "-- certbot: how is it installed? this decides where renewal lives --"
val "certbot path" "$(which certbot 2>/dev/null)"
val "certbot version" "$(command -v certbot >/dev/null && certbot --version 2>&1 | head -1)"
val "rpm package" "$(rpm -qa 2>/dev/null | grep -i certbot | tr '\n' ' ')"
val "pip package" "$(pip3 list 2>/dev/null | grep -i certbot | tr '\n' ' ')"
val "snap" "$([ -x /snap/bin/certbot ] && echo present)"

echo "-- certbot: is renewal scheduled? both unit names, and cron --"
for U in certbot-renew.timer certbot.timer snap.certbot.renew.timer; do
  STATE=$(systemctl is-enabled "$U" 2>/dev/null)
  printf '  %-30s %s\n' "$U" "${STATE:-not present}"
done
systemctl list-timers --all 2>/dev/null | grep -i certbot | sed 's/^/  /' || echo "  no certbot timer"
crontab -l 2>/dev/null | grep -i certbot | sed 's/^/  cron(user): /'
sudo -n crontab -l 2>/dev/null | grep -i certbot | sed 's/^/  cron(root): /'
ls -la /etc/cron.d/ 2>/dev/null | grep -i certbot | sed 's/^/  /'
cat /etc/cron.d/certbot 2>/dev/null | grep -v '^#' | sed 's/^/  /'

echo "-- certbot: what would renewal actually do? --"
# The authenticator decides whether renewal can work unattended. 'standalone'
# needs port 80, which nginx holds — that renews by hand and fails on a timer.
grep -E 'authenticator|installer|renew_hook|deploy_hook|webroot_path' \
  /etc/letsencrypt/renewal/*.conf 2>/dev/null | sed 's/^/  /' || echo "  no renewal config readable"

echo "-- certbot: has renewal ever run unattended? --"
ls -la /var/log/letsencrypt/ 2>/dev/null | tail -4 | sed 's/^/  /' || echo "  no letsencrypt log"
certbot certificates 2>/dev/null | grep -E 'Certificate Name|Expiry Date|Domains' | sed 's/^/  /' || echo "  certbot not available to this user"

say "PHASE 1 — DEPLOYMENT ARTIFACT (if a release has been staged)"
for R in "${RELEASE:-}" /opt/courtaccess-build/out; do
  [ -n "$R" ] && [ -d "$R" ] || continue
  echo "  $R"
  val "  dist/index.js sha256" "$(sha256sum "$R/dist/index.js" 2>/dev/null | cut -d' ' -f1)"
  val "  build-info" "$(cat "$R/dist/build-info.json" 2>/dev/null | tr -d '\n ')"
  val "  .ts outside node_modules" "$(find "$R" -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | wc -l)"
  val "  migrations" "$(ls -d "$R"/prisma/migrations/*/ 2>/dev/null | wc -l)"
done

say "PHASE 7 — EXTERNAL REACHABILITY (from the host)"
for U in https://leginfo.legislature.ca.gov/ https://api.openai.com https://api.anthropic.com https://api.stripe.com; do
  printf '  %-46s ' "$U"; curl -s -o /dev/null -w '%{http_code}\n' --max-time 12 "$U" 2>/dev/null || echo unreachable
done

say "AUDIT COMPLETE"
echo "No change was made. Send this output back for analysis."
