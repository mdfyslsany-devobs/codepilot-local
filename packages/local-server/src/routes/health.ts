import type { FastifyInstance } from 'fastify';

export async function healthRoutes(server: FastifyInstance) {
  const startTime = Date.now();

  server.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000)
    };
  });
}
