import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '@codepilot/local-server';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Phase 2: /api/v1/files/* API Integration', () => {
  let server: FastifyInstance;
  let token: string;
  let tempDir: string;
  let sampleProjectDir: string;
  let projectId: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cp-test-files-api-'));
    sampleProjectDir = join(tempDir, 'project');
    mkdirSync(sampleProjectDir, { recursive: true });

    const instance = await createServer({
      dataDir: tempDir,
      dbPath: ':memory:'
    });

    server = instance.server;
    token = instance.authManager.getToken();
    await server.ready();

    // Register project
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        name: 'Files Test Project',
        path: sampleProjectDir
      }
    });

    const body = JSON.parse(projRes.body);
    projectId = body.data.id;
  });

  afterAll(async () => {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('POST /api/v1/files/create creates a new file', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/files/create',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId,
        relativePath: 'src/main.ts',
        content: 'console.log("hello world");\n'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.checksum).toBeDefined();
  });

  it('GET /api/v1/files/read reads existing file', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/files/read?projectId=${projectId}&path=src/main.ts`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.content).toBe('console.log("hello world");\n');
  });

  it('GET /api/v1/files/diff generates unified diff', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/files/diff?projectId=${projectId}&path=src/main.ts&proposedContent=console.log("updated");\n`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.diffText).toContain('+console.log("updated");');
    expect(body.data.diffText).toContain('-console.log("hello world");');
  });

  it('POST /api/v1/files/update blocks modification if approved is false', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/files/update',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId,
        relativePath: 'src/main.ts',
        content: 'unapproved modification',
        approved: false
      }
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('OPERATION_REJECTED');
  });

  let backupFilePath: string;
  let backupChecksum: string;

  it('POST /api/v1/files/update succeeds when approved is true and creates backup', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/files/update',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId,
        relativePath: 'src/main.ts',
        content: 'console.log("approved update");\n',
        approved: true
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.success).toBe(true);
    expect(body.data.backupId).toBeDefined();

    // Verify file content updated
    const readRes = await server.inject({
      method: 'GET',
      url: `/api/v1/files/read?projectId=${projectId}&path=src/main.ts`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(JSON.parse(readRes.body).data.content).toBe('console.log("approved update");\n');

    // Retrieve backup metadata
    const backupsRes = await server.inject({
      method: 'GET',
      url: '/api/v1/backups',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    const backups = JSON.parse(backupsRes.body).data;
    expect(backups.length).toBeGreaterThan(0);
    backupFilePath = backups[0].backupPath;
    backupChecksum = backups[0].originalChecksum;
  });

  it('POST /api/v1/files/delete blocks deletion if approved is false', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/files/delete',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId,
        relativePath: 'src/main.ts',
        approved: false
      }
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('OPERATION_REJECTED');
  });

  it('POST /api/v1/files/delete deletes file when approved is true', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/files/delete',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId,
        relativePath: 'src/main.ts',
        approved: true
      }
    });

    expect(res.statusCode).toBe(200);

    // Verify file no longer exists
    const readRes = await server.inject({
      method: 'GET',
      url: `/api/v1/files/read?projectId=${projectId}&path=src/main.ts`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(readRes.statusCode).toBe(400);
  });

  it('POST /api/v1/files/restore restores file from backup', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/files/restore',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId,
        relativePath: 'src/main.ts',
        backupPath: backupFilePath,
        expectedChecksum: backupChecksum
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Verify restored content matches original
    const readRes = await server.inject({
      method: 'GET',
      url: `/api/v1/files/read?projectId=${projectId}&path=src/main.ts`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });
    expect(readRes.statusCode).toBe(200);
    expect(JSON.parse(readRes.body).data.content).toBe('console.log("hello world");\n');
  });

  it('GET /api/v1/files/scan scans project hierarchy', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/files/scan?projectId=${projectId}`,
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((f: any) => f.relativePath === 'src/main.ts')).toBe(true);
  });
});
