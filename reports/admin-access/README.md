# Administrator access verification

Evidence that `admin@courtaccess.local` authenticates against the running
CourtAccess release (`courtaccess-v1` / PostgreSQL `courtaccess_acc`), reaches
`/dashboard`, shows the Admin sidebar, and loads `/admin`.

Credentials are not stored in this folder. They were issued in the agent reply
and can be reset at any time with `deploy/admin-reset-password.mjs`.

| File | What it shows |
| --- | --- |
| `01-login-page.png` | Login form at `/login` |
| `01-login-response.redacted.json` | `/api/auth/login` → `role=admin` |
| `02-after-login-dashboard.png` | Redirect to `/dashboard` |
| `02-admin-me.json` | `/api/auth/me` with Bearer token |
| `03-administrator-menu.png` | Admin section visible in the sidebar |
| `04-admin-dashboard.png` | Administrative Dashboard at `/admin` |
| `05-health-after-pm2-restart.json` | Service healthy after `pm2 restart` |
| `07-db-row-after-restart.txt` | User row still `admin` in Postgres after restart |
| `08-persistence-notes.txt` | Persistence conclusions |
