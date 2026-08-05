#!/usr/bin/env node
// Determines whether the rate limiter buckets authenticated traffic per user
// or per source IP. Two distinct authenticated users share one source IP here,
// so if user B is throttled by user A's traffic the bucket is IP-scoped.

import { req, registerUser } from '../lib/harness.mjs';

const a = await registerUser({ prefix: 'rl-a' });
await new Promise((r) => setTimeout(r, 21000)); // registration limit is 3/min per IP
const b = await registerUser({ prefix: 'rl-b' });

if (!a.token || !b.token) {
  console.log('Could not obtain two tokens:', a.status, b.status, a.raw?.text?.slice(0, 200), b.raw?.text?.slice(0, 200));
  process.exit(1);
}
console.log(`user A = ${a.user?.id}, user B = ${b.user?.id}`);

// Wait for the general-limit window to roll over so we start from a clean bucket.
console.log('waiting 61s for the general rate-limit window to reset...');
await new Promise((r) => setTimeout(r, 61000));

let aThrottledAt = null;
for (let i = 1; i <= 120; i++) {
  const res = await req('GET', '/api/cases', { token: a.token });
  if (res.status === 429) {
    aThrottledAt = i;
    break;
  }
}
console.log(`user A throttled after ${aThrottledAt ?? '>120'} requests`);

const bRes = await req('GET', '/api/cases', { token: b.token });
console.log(`user B first-ever request status: ${bRes.status}`);

console.log(
  bRes.status === 429
    ? 'RESULT: IP-SCOPED — user B throttled by user A traffic; per-user keying is not reached.'
    : 'RESULT: USER-SCOPED — user B unaffected by user A traffic.',
);
