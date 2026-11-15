import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '@codepilot/local-server';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Local Fastify Server & API (Phase 1 & 2)', () => {
  let server: FastifyInstance;
  let token: string;
  let tempDir: string;
  let sampleProjectDir: string;
  let sampleProjectId: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cp-test-server-'));
    sampleProjectDir = join(tempDir, 'sample-app');
    mkdirSync(sampleProjectDir, { recursive: true });

    const serverInstance = await createServer({
      dataDir: tempDir,
      dbPath: ':memory:'
    });

    server = serverInstance.server;
    token = serverInstance.authManager.getToken();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/v1/health should respond without authentication', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { host: '127.0.0.1:41777' }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toBeDefined();
    expect(typeof body.uptime).toBe('number');
  });

  it('should block requests with malicious Host header', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { host: 'attacker.evil.com' }
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should block requests with unauthorized Origin header', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: {
        host: 'localhost:41777',
        origin: 'https://evil-site.com'
      }
    });

    expect(res.statusCode).toBe(403);
  });

  it('should allow requests with tauri:// or localhost Origin header', async () => {
    const res1 = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: {
        host: '127.0.0.1:41777',
        origin: 'tauri://localhost'
      }
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: {
        host: 'localhost:41777',
        origin: 'http://localhost:3000'
      }
    });
    expect(res2.statusCode).toBe(200);
  });

  it('should reject unauthenticated requests to protected endpoints', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { host: 'localhost:41777' }
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('should allow protected requests with valid Bearer token', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should allow protected requests with valid x-api-key header', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: {
        host: 'localhost:41777',
        'x-api-key': token
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it('POST /api/v1/projects should register a valid directory and prevent duplicates', async () => {
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        name: 'Sample App',
        path: sampleProjectDir,
        description: 'Test application'
      }
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body);
    expect(createBody.success).toBe(true);
    expect(createBody.data.id).toBeDefined();

    sampleProjectId = createBody.data.id;

    // Fetch by id
    const getRes = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${sampleProjectId}`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.data.name).toBe('Sample App');

    // Duplicate registration returns existing project
    const dupRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        name: 'Sample App Duplicate',
        path: sampleProjectDir
      }
    });
    expect(dupRes.statusCode).toBe(200);
    const dupBody = JSON.parse(dupRes.body);
    expect(dupBody.data.id).toBe(sampleProjectId);
  });

  it('GET /api/v1/projects/:id/files should scan and list files in project directory', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${sampleProjectId}/files`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/projects should reject non-existent paths', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        name: 'Invalid App',
        path: join(tempDir, 'does-not-exist-dir')
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('BAD_REQUEST');
  });

  it('should support full task import, parse, plan, approve, execute lifecycle', async () => {
    // 1. Import task with registered project
    const importRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/import',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        title: 'Feature Task',
        content: '# Implementation Plan\nCreate index.ts\n```typescript\nconsole.log(1);\n```',
        sourceType: 'TEXT'
      }
    });

    expect(importRes.statusCode).toBe(201);
    const importBody = JSON.parse(importRes.body);
    const taskId = importBody.data.id;
    expect(taskId).toBeDefined();

    // 2. Parse task
    const parseRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/parse',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: { taskId }
    });
    expect(parseRes.statusCode).toBe(200);

    // 3. Plan task
    const planRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/plan',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: { taskId }
    });
    expect(planRes.statusCode).toBe(200);

    // 4. Get Task with plan
    const taskGetRes = await server.inject({
      method: 'GET',
      url: `/api/v1/tasks/${taskId}`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(taskGetRes.statusCode).toBe(200);
    const taskGetBody = JSON.parse(taskGetRes.body);
    expect(taskGetBody.data.task.id).toBe(taskId);

    // 5. Diff task
    const diffRes = await server.inject({
      method: 'GET',
      url: `/api/v1/tasks/${taskId}/diff`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(diffRes.statusCode).toBe(200);

    // 6. Approve task
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/approve`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(approveRes.statusCode).toBe(200);

    // 7. Execute task
    const execRes = await server.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/execute`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(execRes.statusCode).toBe(200);
    const execBody = JSON.parse(execRes.body);
    expect(execBody.success).toBe(true);

    // 8. Rollback task
    const rollbackRes = await server.inject({
      method: 'POST',
      url: `/api/v1/tasks/${taskId}/rollback`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(rollbackRes.statusCode).toBe(200);
  });
});
