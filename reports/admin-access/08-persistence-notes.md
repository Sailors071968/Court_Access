persistence: credentials stored in PostgreSQL (courtaccess_acc.users)
survives: application restart (pm2 restart courtaccess-v1) — verified
survives: host reboot — yes, provided Postgres data directory persists (standard for this deploy)
