# Administrator recovery

When nobody can sign into the Administrative Dashboard, run this against the
**running release's** environment file — the same directory PM2 uses.

```bash
cd /var/www/courtaccess-v1          # or /tmp/acceptance/courtaccess-v1, etc.
cp /path/to/repo/deploy/admin-reset-password.mjs ./admin-reset-password.mjs

ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='choose-a-temporary-password-12+' \
ADMIN_NAME='CourtAccess Administrator' \
API_URL=http://127.0.0.1:3100 \
  node --env-file=.env ./admin-reset-password.mjs
```

What it does:

- Reads `DATABASE_URL` from the `.env` file (not from ambient shell variables)
- Creates the account if it does not exist, or resets password / role / MFA if it does
- Verifies sign-in through the live `/api/auth/login` and confirms `role=admin`

`npm run admin:reset-password` in `backend/` is the same script; still pass
`ADMIN_*`, `API_URL`, and `--env-file` pointing at the release `.env`.

`bootstrap-admin.mjs` now delegates to this script.
