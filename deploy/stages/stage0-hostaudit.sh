#!/usr/bin/env bash
# ============================================================================
# Stage 0 — Host audit. PURE OBSERVATION.
#
# Standalone by design: it sources nothing and writes nothing. No directories,
# no state files, no manifest, no clone, no download, no install. It can be run
# on any host, at any time, repeatedly, and leaves the machine exactly as it
# found it.
#
# Run it without cloning anything:
#
#   curl -fsSL https://raw.githubusercontent.com/Sailors071968/Court_Access/\
# cursor/gold-standard-upload-portal-9f94/deploy/stages/stage0-hostaudit.sh | bash
#
# Output is a verdict and, if not ready, the exact commands to fix each blocker.
# ============================================================================

set -uo pipefail

# Targets the deployment will use. Nothing here is created.
V1="${V1:-/var/www/courtaccess-v1}"
V1_PORT="${V1_PORT:-3100}"
APP_EXISTING="${APP_EXISTING:-/var/www/courtaccess}"

BLOCKERS=()
REMEDIES=()

say()  { printf '\n=== %s ===\n' "$*"; }
kv()   { printf '    %-32s %s\n' "$1" "${2:-}"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '    [ OK ] %s\n' "$*"; }
blocker() { printf '    [BLOCK] %s\n' "$1"; BLOCKERS+=("$1"); REMEDIES+=("$2"); }

say "1. OPERATING SYSTEM"
( . /etc/os-release 2>/dev/null && kv "distribution" "$PRETTY_NAME" )
kv "id / version"  "$( . /etc/os-release 2>/dev/null && echo "${ID:-?} ${VERSION_ID:-?}" )"
kv "kernel"        "$(uname -r)"
kv "architecture"  "$(uname -m)"
kv "package mgr"   "$(command -v dnf || command -v yum || command -v apt-get || echo unknown)"
kv "user"          "$(whoami)   groups: $(id -Gn 2>/dev/null)"
if sudo -n true 2>/dev/null; then kv "sudo" "passwordless"
else kv "sudo" "password required (fine if you are at the terminal)"; fi

say "2. NODE INSTALLATIONS"
kv "default node" "$(command -v node 2>/dev/null || echo 'not found')  $(node --version 2>/dev/null)"
kv "default npm"  "$(command -v npm 2>/dev/null || echo 'not found')  $(npm --version 2>/dev/null)"
kv "default npx"  "$(command -v npx 2>/dev/null || echo 'not found')"
ND="$(dirname "$(command -v node 2>/dev/null || echo /nonexistent)")"
NPD="$(dirname "$(command -v npm 2>/dev/null || echo /nonexistent)")"
if [ "$ND" = "$NPD" ]; then ok "default node and npm share an installation"
else info "note: node ($ND) and npm ($NPD) come from different installations —"
     info "      harmless, because every deployment command uses absolute paths"; fi
rpm -qa 2>/dev/null | grep -iE '^nodejs' | sed 's/^/    rpm:  /'
dpkg -l 2>/dev/null | awk '/^ii +nodejs/{print "    deb:  "$2" "$3}'

say "3. NODE 22 AVAILABILITY"
NODE22_FOUND=""
NODE22_SOURCE=""

# Accept any Node 22+, wherever it comes from. nvm is one option, not a
# requirement: a system installation that already exists is preferable to
# installing anything.
_is_node22() { [ -x "${1:-}" ] && [ "$("$1" -pe 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 22 ] 2>/dev/null; }

# 1. an interpreter the operator has already chosen
if [ -n "${NODE22:-}" ] && _is_node22 "$NODE22"; then
  NODE22_FOUND="$NODE22"; NODE22_SOURCE="NODE22 environment variable"
fi
# 2. the system interpreter — note the existing production process uses this
if [ -z "$NODE22_FOUND" ] && _is_node22 /usr/bin/node; then
  NODE22_FOUND="/usr/bin/node"; NODE22_SOURCE="system install (/usr/bin/node)"
fi
# 3. whatever PATH resolves
if [ -z "$NODE22_FOUND" ]; then
  P="$(command -v node 2>/dev/null || true)"
  _is_node22 "$P" && { NODE22_FOUND="$P"; NODE22_SOURCE="PATH"; }
fi
# 4. nvm
if [ -z "$NODE22_FOUND" ]; then
  for d in "$HOME"/.nvm/versions/node/v22.*/bin/node; do
    _is_node22 "$d" && { NODE22_FOUND="$d"; NODE22_SOURCE="nvm"; }
  done
fi

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  kv "nvm" "present — versions: $(ls "$HOME/.nvm/versions/node" 2>/dev/null | tr '\n' ' ')"
else
  kv "nvm" "absent (not required)"
fi
kv "/usr/bin/node" "$( [ -x /usr/bin/node ] && /usr/bin/node --version 2>&1 || echo 'absent' )"

if [ -n "$NODE22_FOUND" ]; then
  ok "Node 22 available — $NODE22_FOUND ($("$NODE22_FOUND" --version 2>&1)) via $NODE22_SOURCE"
  NPM_CAND="$(dirname "$NODE22_FOUND")/npm"
  if [ -x "$NPM_CAND" ]; then
    kv "matching npm" "$NPM_CAND  $("$NPM_CAND" --version 2>/dev/null)"
  else
    blocker "no npm alongside $NODE22_FOUND" "install the npm that ships with that Node, or choose an installation that has one"
  fi
  info "for Stage 1:  export NODE22=\"$NODE22_FOUND\""
else
  blocker "Node 22 is not installed anywhere (checked NODE22, /usr/bin/node, PATH, nvm)" \
"curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
     export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"
     nvm install 22
     # installs under \$HOME/.nvm only; /usr/bin/node is untouched"
fi

say "4. PM2 AND THE EXISTING PRODUCTION PROCESS"
kv "pm2"       "$(command -v pm2 2>/dev/null || echo 'not found')  $(pm2 --version 2>/dev/null | tail -1)"
kv "boot unit" "$(systemctl list-unit-files 2>/dev/null | grep -iE '(^|[^a-z])pm2' | tr -s ' ' | tr '\n' ';')"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null | sed 's/^/    /'
  for P in $(pm2 jlist 2>/dev/null | python3 -c "import json,sys;[print(p['pid']) for p in json.load(sys.stdin) if p.get('pm2_env',{}).get('status')=='online']" 2>/dev/null); do
    kv "pid $P exe" "$(sudo readlink -f /proc/"$P"/exe 2>/dev/null)"
    kv "pid $P cwd" "$(sudo readlink /proc/"$P"/cwd 2>/dev/null)"
  done
else
  blocker "PM2 is not installed" "sudo npm install -g pm2   # or install it under the deployment user"
fi

say "5. SELINUX AND FIREWALL"
SEL="$(getenforce 2>/dev/null || echo 'not installed')"
kv "selinux" "$SEL"
if [ "$SEL" = "Enforcing" ]; then
  blocker "SELinux is Enforcing — nginx will likely be refused access to $V1/dist/public at cut-over" \
"sudo semanage fcontext -a -t httpd_sys_content_t \"$V1/dist/public(/.*)?\"
     sudo restorecon -Rv $V1/dist/public
     # run AFTER Stage 1 creates the directory; verify with: sudo ausearch -m avc -ts recent"
else
  ok "SELinux will not block the new document root"
fi
kv "firewalld" "$(systemctl is-active firewalld 2>/dev/null || echo 'inactive/absent')"
kv "ufw"       "$(ufw status 2>/dev/null | head -1 || echo 'not installed')"
info "the new app binds 127.0.0.1:$V1_PORT (loopback) — no firewall change required"
if command -v ss >/dev/null 2>&1 && sudo ss -lntH "sport = :$V1_PORT" 2>/dev/null | grep -q .; then
  blocker "port $V1_PORT is already in use" "sudo ss -lntp | grep :$V1_PORT   # identify it, then choose another V1_PORT"
else
  ok "port $V1_PORT is free"
fi

say "6. NGINX"
if command -v nginx >/dev/null 2>&1; then
  kv "nginx" "$(nginx -v 2>&1)"
  sudo nginx -t 2>&1 | sed 's/^/    /'
  info "server block(s) mentioning courtaccess:"
  sudo nginx -T 2>/dev/null | grep -nE 'server_name.*courtaccess' | sed 's/^/      /' | head -5
  info "configuration files loaded:"
  sudo nginx -T 2>/dev/null | grep -E '^# configuration file' | sed 's/^/      /' | head -8
  info "current body limit and upstream:"
  sudo nginx -T 2>/dev/null | grep -nE '^\s*(client_max_body_size|proxy_pass|root)' | sed 's/^/      /' | head -8
else
  blocker "nginx is not installed" "install nginx before cut-over"
fi

say "7. OPENSSL AND TLS"
kv "openssl" "$(openssl version 2>&1)"
echo | timeout 15 openssl s_client -servername courtaccess.net -connect courtaccess.net:443 2>/dev/null \
  | openssl x509 -noout -dates -serial 2>/dev/null | sed 's/^/    /' || info "could not read the served certificate"

say "8. DNS AND OUTBOUND CONNECTIVITY"
for H in github.com registry.npmjs.org cdn.jsdelivr.net leginfo.legislature.ca.gov; do
  kv "$H" "$(getent hosts "$H" 2>/dev/null | awk '{print $1}' | head -1 || echo 'RESOLUTION FAILED')"
done
probe() {
  local code; code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" 2>/dev/null)"
  printf '    %-40s %s\n' "$2" "$code"
  [ "$code" = "200" ] || return 1
}
probe "https://github.com/" "GitHub (clone source)" || \
  blocker "GitHub unreachable — Stage 1 cannot clone" "check egress rules / proxy for https://github.com"
probe "https://registry.npmjs.org/" "npm registry (build)" || \
  blocker "npm registry unreachable — the build cannot install dependencies" "check egress rules for https://registry.npmjs.org"
probe "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz" "jsDelivr (OCR model, 10.9 MB)" || \
  blocker "jsDelivr unreachable — OCR will report every scanned page as blank, indistinguishable from a genuinely blank page" \
"allow egress to https://cdn.jsdelivr.net, or plan to ship eng.traineddata and set langPath"
probe "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=459." "leginfo (statutes)" || \
  blocker "leginfo unreachable — charges will resolve to nothing" "allow egress to https://leginfo.legislature.ca.gov"

say "9. OWNERSHIP AND WRITABILITY (inspection only — nothing is created)"
for d in /var/www /opt "$HOME" "$APP_EXISTING"; do
  if [ -e "$d" ]; then kv "$d" "$(stat -c 'owner=%U:%G perms=%a' "$d" 2>/dev/null)"
  else kv "$d" "absent"; fi
done
if [ -w /var/www ] || sudo -n test -w /var/www 2>/dev/null || sudo -n true 2>/dev/null; then
  ok "/var/www can be written to (directly or via sudo)"
else
  blocker "/var/www is not writable and sudo is unavailable" "grant write access, or run the deployment as a user with sudo"
fi
if [ -e "$V1" ]; then
  blocker "$V1 already exists — Stage 1 will not overwrite it" "inspect it, then: sudo rm -rf $V1   (only if it is not wanted)"
else
  ok "$V1 does not exist — Stage 1 will create it"
fi

say "10. CAPACITY"
kv "cpu cores" "$(nproc)"
kv "load"      "$(cut -d' ' -f1-3 /proc/loadavg)"
free -h 2>/dev/null | sed 's/^/    /'
kv "swap"      "$(swapon --show 2>/dev/null | tail -n +2 | tr '\n' ' ' || echo 'none configured')"
df -h / /var /opt "$HOME" 2>/dev/null | sed 's/^/    /'
FREE_VAR=$(df -Pm /var 2>/dev/null | awk 'NR==2{print $4}')
kv "free on /var (MB)" "$FREE_VAR"
if [ "${FREE_VAR:-0}" -ge 2048 ]; then ok "sufficient disk (build needs ~1.5 GB transiently, ~600 MB after)"
else blocker "less than 2 GB free on /var" "free space, or set V1 to a volume that has it"; fi
MEM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
if [ "${MEM_MB:-0}" -ge 1800 ]; then ok "sufficient memory (${MEM_MB} MB)"
else info "only ${MEM_MB} MB RAM with no swap — the build may be slow or fail; consider adding swap"; fi

say "VERDICT"
if [ "${#BLOCKERS[@]}" -eq 0 ]; then
  printf '\n    HOST READY FOR GREENFIELD DEPLOYMENT\n\n'
  [ -n "$NODE22_FOUND" ] && {
    printf '    Proceed with:\n'
    printf '      export NODE22="%s"\n' "$NODE22_FOUND"
    printf '      bash deploy/stages/stage1-provision.sh\n\n'
  }
  exit 0
fi

printf '\n    HOST NOT READY — %s blocker(s)\n\n' "${#BLOCKERS[@]}"
i=0
while [ "$i" -lt "${#BLOCKERS[@]}" ]; do
  printf '    %d. %s\n' "$((i+1))" "${BLOCKERS[$i]}"
  printf '       resolve with:\n       %s\n\n' "${REMEDIES[$i]}"
  i=$((i+1))
done
printf '    Re-run this audit after resolving. It writes nothing, so it is safe to repeat.\n\n'
exit 1
