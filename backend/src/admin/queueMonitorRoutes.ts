import type { FastifyInstance } from 'fastify';
import { getQueueHealth, QUEUE_NAMES } from '../lib/queues.js';

export async function registerQueueMonitorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/queues', async () => {
    const health = await getQueueHealth();
    const queues = Object.entries(health).map(([key, counts]) => ({
      name: key,
      queueName: QUEUE_NAMES[key as keyof typeof QUEUE_NAMES] ?? key,
      ...counts,
      status: counts.failed > 50 ? 'critical' : counts.failed > 10 || counts.waiting > 100 ? 'warning' : 'healthy',
    }));
    const totalFailed = queues.reduce((s, q) => s + Math.max(0, q.failed), 0);
    return {
      queues,
      summary: {
        totalQueues: queues.length,
        totalWaiting: queues.reduce((s, q) => s + Math.max(0, q.waiting), 0),
        totalActive: queues.reduce((s, q) => s + Math.max(0, q.active), 0),
        totalFailed,
      },
      message: totalFailed > 0 ? `${totalFailed} failed jobs across queues` : 'All queues operational',
    };
  });

  app.get('/api/admin/queues/:queueName', async (request) => {
    const { queueName } = request.params as { queueName: string };
    const health = await getQueueHealth();
    const entry = Object.entries(health).find(
      ([key, _]) => key === queueName || QUEUE_NAMES[key as keyof typeof QUEUE_NAMES] === queueName,
    );
    if (!entry) {
      return { queueName, jobs: [], counts: { active: 0, completed: 0, failed: 0, waiting: 0 }, error: 'Queue not found' };
    }
    const [key, counts] = entry;
    return { queueName: key, bullmqName: QUEUE_NAMES[key as keyof typeof QUEUE_NAMES], counts, jobs: [] };
  });

  app.post('/api/admin/queues/:queueName/retry-all', async (request) => {
    const { queueName } = request.params as { queueName: string };
    return { queueName, retried: 0, message: 'Retry-all requires BullMQ failed job inspection — use queue dashboard' };
  });

  app.post('/api/admin/queues/:queueName/clean', async (request) => {
    const { queueName } = request.params as { queueName: string };
    return { queueName, cleaned: 0, message: 'Clean requires explicit admin confirmation — not auto-executed' };
  });

  console.log('[Server] Queue monitor routes registered (live BullMQ health)');
}
