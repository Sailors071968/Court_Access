// ============================================================================
// Program 0 — Contact API tests
// ============================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerContactRoutes } from '../src/marketing/contactRoutes.js';

describe('Program 0 — Contact API', () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    app = Fastify();
    await registerContactRoutes(app);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('rejects missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/contact',
      payload: { name: 'Test' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('rejects invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/contact',
      payload: { name: 'Test', email: 'not-an-email', message: 'Hello' },
    });
    assert.equal(res.statusCode, 400);
  });
});
