#!/usr/bin/env node
// Create or reset the administrator on a deployment.
//
// Prefer admin-reset-password.mjs for lockout recovery — it always sets the
// password you pass. This script remains for deploy docs that still call it;
// it now resets the password too (it used to promote without resetting).
//
//   cd /var/www/courtaccess-v1
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<12+ chars>' API_URL=http://127.0.0.1:3100 \
//     node --env-file=.env bootstrap-admin.mjs

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, 'admin-reset-password.mjs');

const result = spawnSync(process.execPath, [...process.execArgv, target, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
