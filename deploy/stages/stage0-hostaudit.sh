#!/usr/bin/env bash
# ============================================================================
# Stage 0b — Final host audit.
#
# Read-only. Installs nothing, changes nothing. Determines whether the host
# can support the greenfield deployment, and records the existing production
# process so later stages can prove it was never touched.
#
#   bash deploy/stages/stage0-hostaudit.sh
#
# Runs before Node 22 exists, so it must not depend on it.
# ============================================================================

STAGE_NAME="Stage 0b — host audit"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
. "$DIR/_common.sh"

say "1. OPERATING SYSTEM"
( . /etc/os-release 2>/dev/null && kv "distribution" "$PRETTY_NAME"; kv "id/version" "${ID:-?} ${VERSION_ID:-?}" )
kv "kernel"       "$(uname -r)"
kv "architecture" "$(uname -m)"
kv "package mgr"  "$(command -v dnf || command -v yum || command -v apt-get || echo unknown)"
kv "user"         "$(whoami)  groups: $(id -Gn)"
kv "sudo"         "$(sudo -n true 2>/dev/null && echo 'passwordless' || echo 'password required')"

say "2. NODE INSTALLATIONS"
kv "default node"  "$(command -v node 2>/dev/null || echo 'not found')  $(node --version 2>/dev/null)"
kv "default npm"   "$(command -v npm 2>/dev/null || echo 'not found')  $(npm --version 2>/dev/null)"
kv "default npx"   "$(command -v npx 2>/dev/null || echo 'not found')"
DEFAULT_NODE_DIR="$(dirname "$(command -v node 2>/dev/null || echo /nonexistent)")"
DEFAULT_NPM_DIR="$(dirname "$(command -v npm 2>/dev/null || echo /nonexistent)")"
if [ "$DEFAULT_NODE_DIR" = "$DEFAULT_NPM_DIR" ]; then
  ok "default node and npm come from the same installation"
else
  info "default node and npm come from DIFFERENT installations —"
  info "  node: $DEFAULT_NODE_DIR   npm: $DEFAULT_NPM_DIR"
  info "  harmless once NODE22 is pinned; every deployment command uses absolute paths."
fi
rpm -qa 2>/dev/null | grep -iE '^nodejs' | sed 's/^/    rpm:  /'
dpkg -l 2>/dev/null | awk '/^ii +nodejs/{print "    deb:  "$2" "$3}'

say "3. NVM AND NODE 22"
NVM_OK=0
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  ok "nvm present at \$HOME/.nvm"
  kv "installed versions" "$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tr '\n' ' ')"
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
  CAND="$(nvm which 22 2>/dev/null)"
  if [ -n "$CAND" ] && [ -x "$CAND" ]; then
    ok "Node 22 available — $CAND ($("$CAND" --version 2>&1))"
    kv "matching npm" "$(dirname "$CAND")/npm  $("$(dirname "$CAND")/npm" --version 2>&1)"
    NVM_OK=1
    echo "$CAND" > "$STATE/node22.path"
    info "export NODE22=\"$CAND\"    # required by every later stage"
  else
    info "nvm is present but Node 22 is not installed"
    info "  resolve with:  . \"\$HOME/.nvm/nvm.sh\" && nvm install 22"
  fi
else
  info "nvm is absent"
  info "  install it side by side (does not touch /usr/bin/node):"
  info "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  info "    export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"; nvm install 22"
fi
[ "$NVM_OK" -eq 1 ] || bad "Node 22 is not yet available — install it, then re-run this audit"

say "4. PM2 AND THE EXISTING PROCESS"
kv "pm2"      "$(command -v pm2 2>/dev/null || echo 'not found')  $(pm2 --version 2>/dev/null | tail -1)"
kv "boot unit" "$(systemctl list-unit-files 2>/dev/null | grep -iE '(^|[^a-z])pm2' | tr -s ' ' | tr '\n' ';' || echo 'none found')"
pm2 list 2>/dev/null | sed 's/^/    /'
for P in $(pm2 jlist 2>/dev/null | python3 -c "import json,sys;[print(p['pid']) for p in json.load(sys.stdin) if p.get('pm2_env',{}).get('status')=='online']" 2>/dev/null); do
  kv "pid $P exe" "$(sudo readlink -f /proc/"$P"/exe 2>/dev/null)"
  kv "pid $P cwd" "$(sudo readlink /proc/"$P"/cwd 2>/dev/null)"
done
baseline_existing

say "5. SELINUX AND FIREWALL"
SEL="$(getenforce 2>/dev/null || echo 'not installed')"
kv "selinux" "$SEL"
if [ "$SEL" = "Enforcing" ]; then
  bad "SELinux is Enforcing — nginx may be refused access to $V1/dist/public at cut-over"
  info "  check at Stage 4 with:  sudo ausearch -m avc -ts recent"
  info "  and if needed:          sudo semanage fcontext -a -t httpd_sys_content_t \"$V1/dist/public(/.*)?\""
  info "                          sudo restorecon -Rv $V1/dist/public"
else
  ok "SELinux will not block the new document root"
fi
kv "firewalld" "$(systemctl is-active firewalld 2>/dev/null || echo 'inactive/absent')"
kv "ufw"       "$(ufw status 2>/dev/null | head -1 || echo 'not installed')"
info "the new app binds 127.0.0.1:$V1_PORT — loopback only, so no firewall change is needed"

say "6. NGINX"
kv "nginx" "$(nginx -v 2>&1)"
sudo nginx -t 2>&1 | sed 's/^/    /'
info "server block(s) for the site:"
sudo nginx -T 2>/dev/null | grep -nE 'server_name.*courtaccess' | sed 's/^/      /' | head -5
info "configuration files loaded:"
sudo nginx -T 2>/dev/null | grep -E '^# configuration file' | sed 's/^/      /' | head -8

say "7. OWNERSHIP"
for d in /var/www /opt /var/www/courtaccess; do
  if [ -e "$d" ]; then kv "$d" "$(stat -c 'owner=%U:%G perms=%a' "$d")"
  else kv "$d" "absent"; fi
done
if [ -w /var/www ] || sudo -n test -w /var/www 2>/dev/null; then ok "/var/www is writable (directly or via sudo)"
else bad "/var/www is not writable — Stage 1 cannot create $V1"; fi

say "8. CAPACITY"
kv "cpu cores" "$(nproc)"
kv "load"      "$(cut -d' ' -f1-3 /proc/loadavg)"
free -h 2>/dev/null | sed 's/^/    /'
kv "swap"      "$(swapon --show 2>/dev/null | tail -n +2 | tr '\n' ' ' || echo 'none configured')"
df -h / /var /opt "$HOME" 2>/dev/null | sed 's/^/    /'
FREE_VAR=$(df -Pm /var | awk 'NR==2{print $4}')
kv "free on /var (MB)" "$FREE_VAR"
if [ "${FREE_VAR:-0}" -ge 2048 ]; then ok "sufficient space for the build (needs ~1.5 GB transiently)"
else bad "less than 2 GB free on /var"; fi
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "${MEM_MB:-0}" -ge 1800 ]; then ok "sufficient memory (${MEM_MB} MB)"
else info "only ${MEM_MB} MB RAM and swap $(swapon --show >/dev/null 2>&1 && echo present || echo absent) — the build may be slow"; fi

if [ "$FAILURES" -eq 0 ]; then
  say "HOST READY FOR GREENFIELD DEPLOYMENT"
  info "Next:  export NODE22=\"$(cat "$STATE/node22.path" 2>/dev/null)\""
  info "       bash deploy/stages/stage1-provision.sh"
fi
finish
