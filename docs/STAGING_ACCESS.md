# CourtAccess V1 — Staging Access (external, browser-reachable)

> The staging app is now reachable **from a normal web browser over HTTPS, with no SSH port-forwarding**, via an outbound Cloudflare tunnel fronted by Nginx. Production `/var/www/courtaccess` untouched; `courtaccess.net` unchanged; no cutover.

## 1. Public staging URL (live now)

**https://dependent-commitments-conviction-charter.trycloudflare.com**

Open it in any browser. Architecture:
```
browser ──HTTPS──► Cloudflare edge ──QUIC tunnel──► cloudflared ──► Nginx :8090 ──► { dist/ static, /api → backend :3001 }
```
- HTTPS/TLS is terminated at the Cloudflare edge (valid public cert — no Let's Encrypt needed for this URL).
- WebSocket upgrade, `/api` routing, static assets, and 550 MB uploads are all handled by the Nginx config.

> **Ephemerality (honest):** this is a Cloudflare *quick tunnel* — the URL is stable while `cloudflared` runs (tmux session `ca-tunnel`) but **changes if it restarts**. For a permanent `staging.courtaccess.net`, see §2.

## 2. DNS changes (for the preferred `staging.courtaccess.net`)

Requires access to the `courtaccess.net` DNS zone (which I do not control). Two options:

**Option A — Named Cloudflare Tunnel (recommended; matches what's running, auto-TLS):**
1. On a host with the tunnel: `cloudflared tunnel login` (authenticates to your Cloudflare account), then `cloudflared tunnel create courtaccess-staging` → yields `<TUNNEL_ID>`.
2. DNS record (in Cloudflare for courtaccess.net):
   ```
   Type: CNAME   Name: staging   Target: <TUNNEL_ID>.cfargotunnel.com   Proxied: Yes
   ```
3. Route + run: `cloudflared tunnel route dns courtaccess-staging staging.courtaccess.net` then run the tunnel to `http://localhost:8090`. TLS is automatic via Cloudflare.

**Option B — Public host + Let's Encrypt:**
1. DNS record: `A   staging.courtaccess.net → <PUBLIC_SERVER_IP>` (a host with inbound :80/:443).
2. `sudo certbot --nginx -d staging.courtaccess.net` (issues + installs the cert).
   - **Not possible from this sandbox** — it has no inbound public IP (egress IP is `54.197.218.84`, a NAT address; inbound :80/:443 is not reachable), so ACME HTTP-01 validation would fail here. Use a host you control.

## 3. Nginx configuration

Committed at `deploy/nginx/courtaccess-staging.conf` (also installed at `/etc/nginx/sites-available/courtaccess-staging`, enabled, `nginx -t` OK). Serves the production `dist/` build, proxies `/api/` → `127.0.0.1:3001` with WebSocket upgrade headers, SPA `try_files` fallback, and `client_max_body_size 550M`.

## 4. SSL status

- **Public URL:** ✅ HTTPS via Cloudflare edge certificate (automatic, trusted).
- **`staging.courtaccess.net`:** pending your DNS — auto-TLS with Option A, or `certbot` with Option B.

## 5. Browser accessibility verification (external, via public URL)

All returned **HTTP 200** through Cloudflare (browser-equivalent path):

| Page | Result |
|------|--------|
| Landing `/` | ✅ 200 (0.34s) |
| `/login` | ✅ 200 |
| `/register` | ✅ 200 |
| `/dashboard` (attorney/investigator role-routed) | ✅ 200 |
| `/client-portal` (defendant) | ✅ 200 |

## 6. External API verification (authenticated, via public URL)

| Endpoint | Result |
|----------|--------|
| `POST /api/auth/login` | ✅ 200 — real token acquired |
| `POST /api/auth/login` (defendant) | ✅ 200 |
| `GET /api/providers` | ✅ 200 |
| `GET /api/courtlistener/search?q=miranda` | ✅ 200 (external CourtListener via tunnel) |
| `GET /api/cases` | ✅ 200 |
| `GET /api/cases/:id/workbench` | ✅ 200 |
| `GET /api/cases/:id/intelligence` (reports) | ✅ 200 |
| `GET /api/cases/:id/knowledge-graph` | ✅ 200 |
| `GET /api/search?q=burglary` | ✅ 200 |
| `GET /api/cases/:id/litigation-strategy` (motions) | ✅ 200 |
| `GET /api/timeline/:id/events` | ✅ 200 |
| `POST /api/evidence/upload` (+ OCR) | ✅ 201 |

## Test accounts

Password `TestPass123!` — attorney `attorney2@courtaccess.test` (seeded case *People v. Jordan Rivera*, CR-2026-04821), investigator `investigator2@`, defendant `defendant2@`, paralegal `paralegal2@`, legal assistant `legalassistant@`, office admin `officeadmin@`, administrator `admin@courtaccess.test`. (Full list: `STAGING_V1_DEPLOYMENT.md`.)

## 7. Remaining blockers

- **Ephemeral URL:** the `trycloudflare.com` URL changes if `cloudflared` restarts. For a stable `staging.courtaccess.net`, apply §2 Option A (needs your Cloudflare account) — a named tunnel keeps a permanent DNS-mapped URL.
- **Let's Encrypt from this sandbox:** not possible (no inbound public IP); use Option A (Cloudflare auto-TLS) or issue the cert on a public host (Option B).
- **External integrations** (Stripe/OpenAI/AWS/R2) remain staging placeholders.

## Verdict

**EXTERNALLY ACCESSIBLE — verified.** The application opens in a normal browser at the public HTTPS URL above with no SSH forwarding; landing/login/registration/dashboards/portal and the full authenticated API (including CourtListener, knowledge graph, search, reports, motions, evidence upload) all return success through the public edge. `staging.courtaccess.net` is one DNS record away (records provided).
