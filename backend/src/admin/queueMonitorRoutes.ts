import type { FastifyInstance } from 'fastify';

export async function registerQueueMonitorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/queues', async () => ({
    queues: [],
    message: 'Queue monitor stub — full implementation not yet deployed',
  }));

  app.get('/api/admin/queues/:queueName', async (request) => {
    const { queueName } = request.params as { queueName: string };
    return { queueName, jobs: [], counts: { active: 0, completed: 0, failed: 0, waiting: 0 } };
  });

  app.post('/api/admin/queues/:queueName/retry-all', async (request) => {
    const { queueName } = request.params as { queueName: string };
    return { queueName, retried: 0, message: 'Stub — no jobs to retry' };
  });

  app.post('/api/admin/queues/:queueName/clean', async (request) => {
    const { queueName } = request.params as { queueName: string };
    return { queueName, cleaned: 0, message: 'Stub — no jobs to clean' };
  });

  console.log('[Server] Queue monitor routes registered (stub mode)');
}
