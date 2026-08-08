#!/usr/bin/env bash
#
# CourtAccess — deploy the whole platform to this host, in one command.
#
# The existing GitHub workflow deploys the frontend only, which is why
# courtaccess.net serves a June bundle in front of a health check that answers
# nothing else. This brings up everything: PostgreSQL, Redis, the API, the
# frontend and nightly backups, all on named volumes so they survive a reboot.
#
# TARGETS DEBIAN/UBUNTU ON A FRESH HOST. It calls apt-get and installs Docker.
# The existing courtaccess.net host runs Amazon Linux 2023 with an established
# layout under /var/www/courtaccess — do not run this against it. Use
# deploy/DEPLOYMENT_PLAN.md for that host.
#
# Run it on a fresh EC2 instance as a user with sudo:
#
#   curl -fsSL https://raw.githubusercontent.com/Sailors071968/Court_Access/cursor/gold-standard-upload-portal-9f94/deploy/bootstrap-ec2.sh | bash -s -- --domain courtaccess.net --email you@example.com
#
# Or, if the repository is already checked out:
#
#   sudo bash deploy/bootstrap-ec2.sh --domain courtaccess.net --email you@example.com
#
# It is safe to re-run. Existing data is left alone; existing secrets are
# reused rather than regenerated, because regenerating JWT_SECRET signs
# everybody out.

set -euo pipefail

BRANCH="${BRANCH:-cursor/gold-standard-upload-portal-9f94}"
REPO="${REPO:-https://github.com/Sailors071968/Court_Access.git}"
APP_DIR="${APP_DIR:-/opt/courtaccess}"
DOMAIN=""
EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email)  EMAIL="$2";  shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  echo "A domain is required: --domain courtaccess.net" >&2
  exit 1
fi

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
say "Checking what is already here"
# ---------------------------------------------------------------------------

command -v sudo >/dev/null || { echo "sudo is required." >&2; exit 1; }

if ! command -v docker >/dev/null; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required and was not found after installing Docker." >&2
  exit 1
fi

command -v git >/dev/null || sudo apt-get update -qq && sudo apt-get install -y -qq git

# ---------------------------------------------------------------------------
say "Fetching the application"
# ---------------------------------------------------------------------------

if [[ -d "$APP_DIR/.git" ]]; then
  sudo git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  sudo git -C "$APP_DIR" checkout -B deploy "origin/$BRANCH"
else
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER":"$USER" "$APP_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

cd "$APP_DIR/deploy"

# ---------------------------------------------------------------------------
say "Configuring"
# ---------------------------------------------------------------------------

# Reuse existing secrets. Regenerating JWT_SECRET would sign everyone out, and
# regenerating the database password would lock the application out of its own
# data.
if [[ -f .env ]]; then
  echo "Existing .env found — keeping the secrets already in it."
else
  ADMIN_PW="$(openssl rand -base64 24)"
  cat > .env <<EOF
POSTGRES_USER=courtaccess
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
POSTGRES_DB=courtaccess
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)
ADMIN_EMAIL=admin@${DOMAIN}
ADMIN_PASSWORD=${ADMIN_PW}
ADMIN_NAME=CourtAccess Administrator
EOF
  chmod 600 .env
  echo "Generated new secrets in $APP_DIR/deploy/.env"
fi

# ---------------------------------------------------------------------------
say "Building and starting"
# ---------------------------------------------------------------------------

docker compose up -d --build

say "Waiting for the API to report healthy"
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    echo "API is up."
    break
  fi
  [[ $i -eq 60 ]] && { echo "The API did not come up. Check: docker compose logs api" >&2; exit 1; }
  sleep 5
done

say "Applying database migrations"
docker compose exec -T api npx prisma migrate deploy

say "Creating the administrator"
docker compose exec -T api node /app/deploy/bootstrap-admin.mjs

# ---------------------------------------------------------------------------
say "Putting nginx in front"
# ---------------------------------------------------------------------------

# The host already runs nginx serving the old static bundle. Replace that site
# with a proxy to the container rather than fighting it for port 80.
if command -v nginx >/dev/null; then
  SITE=/etc/nginx/sites-available/courtaccess
  sudo tee "$SITE" >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Discovery uploads arrive in 8 MB chunks; leave headroom.
    client_max_body_size 64m;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Stream upload chunks rather than spooling them to disk first.
        proxy_request_buffering off;
    }
}
EOF
  sudo ln -sf "$SITE" /etc/nginx/sites-enabled/courtaccess
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx
  echo "nginx now proxies ${DOMAIN} to the application."
else
  echo "nginx is not installed on the host; the application is on 127.0.0.1:8080."
fi

# ---------------------------------------------------------------------------
say "TLS"
# ---------------------------------------------------------------------------

if [[ -n "$EMAIL" ]]; then
  if ! command -v certbot >/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y -qq certbot python3-certbot-nginx
  fi
  sudo certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "$EMAIL" --redirect || \
    echo "certbot did not complete. If a certificate already exists this is expected."
else
  echo "No --email given, so TLS was not requested. Existing certificates are untouched."
fi

# ---------------------------------------------------------------------------
say "Verifying"
# ---------------------------------------------------------------------------

FAILED=0
check() {
  printf '  %-46s' "$1"
  if eval "$2" >/dev/null 2>&1; then echo "ok"; else echo "FAILED"; FAILED=1; fi
}

check "API health"              "curl -sf http://127.0.0.1:8080/api/health"
check "Frontend served"         "curl -sf http://127.0.0.1:8080/ | grep -q CourtAccess"
check "Registration reachable"  "[ \$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8080/api/auth/register) != '404' ]"
check "PostgreSQL"              "docker compose exec -T postgres pg_isready -U courtaccess"
check "Redis"                   "docker compose exec -T redis redis-cli ping"
check "ffmpeg in the API image" "docker compose exec -T api ffprobe -version"
check "Official law reachable"  "docker compose exec -T api wget -qO- --timeout=20 https://leginfo.legislature.ca.gov/ -O /dev/null"

# Restart the stack and confirm the data is still there. The claim that a
# deployment survives a reboot is worth testing rather than asserting.
say "Restarting to prove persistence"
docker compose restart >/dev/null
sleep 20
check "Healthy after restart"   "curl -sf http://127.0.0.1:8080/api/health"
check "Administrator persists"  "docker compose exec -T postgres psql -U courtaccess -d courtaccess -tAc \"select count(*) from users where role='admin'\" | grep -qv '^0$'"

echo
if [[ $FAILED -eq 0 ]]; then
  say "Deployed"
  echo "  URL:      https://${DOMAIN}"
  echo "  Sign in:  $(grep '^ADMIN_EMAIL=' .env | cut -d= -f2)"
  echo "  Password: $(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2)"
  echo
  echo "  Change the password after signing in. The secrets are in"
  echo "  $APP_DIR/deploy/.env — back that file up somewhere else, because"
  echo "  losing JWT_SECRET signs everybody out and losing the database"
  echo "  password locks the application out of its own data."
else
  say "Deployed with failures"
  echo "  Some checks did not pass. Do not treat this as a working deployment."
  echo "  Logs: cd $APP_DIR/deploy && docker compose logs --tail=100"
  exit 1
fi
