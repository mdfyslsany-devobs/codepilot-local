import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '@codepilot/local-server';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

describe('Tasks Parser & Planner API Integration (Phase 4 Step 1)', () => {
  let server: FastifyInstance;
  let token: string;
  let tempDir: string;
  let sampleProjectDir: string;
  let sampleProjectId: string;
  let repositories: any;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cp-parser-api-test-'));
    sampleProjectDir = join(tempDir, 'sample-app');
    mkdirSync(sampleProjectDir, { recursive: true });

    const serverInstance = await createServer({
      dataDir: tempDir,
      dbPath: ':memory:'
    });

    server = serverInstance.server;
    token = serverInstance.authManager.getToken();
    repositories = serverInstance.repositories;
    await server.ready();

    // Register a test project
    const projRes = await server.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        name: 'Parser Test Project',
        path: sampleProjectDir,
        description: 'Project for parser API tests'
      }
    });

    expect(projRes.statusCode).toBe(201);
    const projBody = JSON.parse(projRes.body);
    sampleProjectId = projBody.data.id;
  });

  afterAll(async () => {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // Test Case 1: Successful Parse
  it('Test Case 1: POST /api/v1/tasks/parse parses instructions and returns an ExecutionManifest', async () => {
    const markdown = `# Application Setup

Directory setup:
- src/
  - components/

### src/index.ts
\`\`\`ts
console.log('hello world');
\`\`\`

### src/components/Button.tsx
\`\`\`tsx
export const Button = () => <button>Click</button>;
\`\`\`
`;

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/parse',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        markdown
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const manifest = body.data;
    expect(manifest.version).toBe('1.0');
    expect(typeof manifest.instructionsHash).toBe('string');
    expect(manifest.instructionsHash).toHaveLength(64);
    expect(manifest.folders).toContain('src/components');
    expect(manifest.files).toHaveLength(2);

    const indexFile = manifest.files.find((f: any) => f.path === 'src/index.ts');
    expect(indexFile).toBeDefined();
    expect(indexFile.content).toBe("console.log('hello world');");
    expect(indexFile.language).toBe('ts');
    expect(indexFile.isNew).toBe(true);

    const buttonFile = manifest.files.find((f: any) => f.path === 'src/components/Button.tsx');
    expect(buttonFile).toBeDefined();
    expect(buttonFile.content).toBe('export const Button = () => <button>Click</button>;');
    expect(buttonFile.language).toBe('tsx');
    expect(buttonFile.isNew).toBe(true);

    expect(manifest.errors).toEqual([]);
    expect(manifest.warnings).toEqual([]);
  });

  it('ignores orphan blocks when smart extraction finds named files', async () => {
    const markdown = `### index.html
\`\`\`html
<!DOCTYPE html>
<html><body>Hello</body></html>
\`\`\`

\`\`\`text
Unrelated text block
\`\`\`

\`\`\`text
Another unrelated block
\`\`\`
`;

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/parse',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        markdown
      }
    });

    expect(res.statusCode).toBe(200);
    const manifest = JSON.parse(res.body).data;
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual(['index.html']);
    expect(manifest.errors.some((error: { code: string }) => error.code === 'ORPHAN_BLOCK')).toBe(false);
  });

  // Test Case 2: Parse Validation Error & Missing Content Handling
  it('Test Case 2: POST /api/v1/tasks/parse reports placeholders and ignores orphan blocks when named files exist', async () => {
    // 2a. Validation Error
    const invalidRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/parse',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: 'not-a-valid-uuid',
        markdown: ''
      }
    });

    expect(invalidRes.statusCode).toBe(400);
    const invalidBody = JSON.parse(invalidRes.body);
    expect(invalidBody.success).toBe(false);
    expect(invalidBody.error).toBe('VALIDATION_ERROR');

    // 2b. Placeholder detection and orphan suppression when a named file exists
    const problematicMarkdown = `### src/todo.ts
\`\`\`ts
// TODO: implement
\`\`\`

\`\`\`ts
orphanFunction();
\`\`\`
`;

    const issueRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/parse',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        markdown: problematicMarkdown
      }
    });

    expect(issueRes.statusCode).toBe(200);
    const issueBody = JSON.parse(issueRes.body);
    expect(issueBody.success).toBe(true);

    const manifest = issueBody.data;
    expect(manifest.files).toHaveLength(0); // Both invalid blocks excluded
    expect(manifest.errors).toHaveLength(1);

    const placeholderError = manifest.errors.find((e: any) => e.code === 'PLACEHOLDER_CONTENT');
    expect(placeholderError).toBeDefined();
    expect(placeholderError.filename).toBe('src/todo.ts');

    const orphanError = manifest.errors.find((e: any) => e.code === 'ORPHAN_BLOCK');
    expect(orphanError).toBeUndefined();
  });

  // Test Case 3: Successful Plan Generation from Manifest (CREATE, UPDATE, MKDIR)
  it('Test Case 3: POST /api/v1/tasks/plan generates MKDIR, UPDATE and CREATE file operations', async () => {
    // Pre-create an existing file in the project directory
    const existingFileRel = 'src/app.ts';
    const existingFileAbs = join(sampleProjectDir, existingFileRel);
    mkdirSync(join(sampleProjectDir, 'src'), { recursive: true });
    writeFileSync(existingFileAbs, "console.log('original code');", 'utf8');

    const manifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      instructionsHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      folders: ['dist'],
      files: [
        {
          path: 'src/app.ts',
          content: "console.log('updated code');",
          language: 'ts',
          isNew: false
        },
        {
          path: 'src/new-feature.ts',
          content: 'export const feature = true;',
          language: 'ts',
          isNew: true
        }
      ],
      warnings: [],
      errors: []
    };

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/plan',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        manifest
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.planId).toBeDefined();

    const ops = body.data.operations;
    expect(ops).toHaveLength(3);

    const mkdirOp = ops.find((o: any) => o.operationType === 'MKDIR');
    expect(mkdirOp).toBeDefined();
    expect(mkdirOp.relativePath).toBe('dist');

    const updateOp = ops.find((o: any) => o.relativePath === 'src/app.ts');
    expect(updateOp).toBeDefined();
    expect(updateOp.operationType).toBe('UPDATE');
    expect(updateOp.content).toBe("console.log('updated code');");
    expect(updateOp.previousContent).toBe("console.log('original code');");

    const createOp = ops.find((o: any) => o.relativePath === 'src/new-feature.ts');
    expect(createOp).toBeDefined();
    expect(createOp.operationType).toBe('CREATE');
    expect(createOp.content).toBe('export const feature = true;');
    expect(createOp.previousContent).toBeNull();
  });

  // Test Case 4: Plan Validation & Non-Existent Project Handling
  it('Test Case 4: POST /api/v1/tasks/plan rejects non-existent projects and malformed manifests', async () => {
    // 4a. Non-existent project
    const notFoundRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/plan',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: '99999999-9999-9999-9999-999999999999',
        manifest: {
          version: '1.0',
          createdAt: new Date().toISOString(),
          instructionsHash: '1234567890123456789012345678901234567890123456789012345678901234',
          folders: [],
          files: [],
          warnings: [],
          errors: []
        }
      }
    });

    expect(notFoundRes.statusCode).toBe(404);
    const notFoundBody = JSON.parse(notFoundRes.body);
    expect(notFoundBody.error).toBe('NOT_FOUND');

    // 4b. Malformed manifest
    const badManifestRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/plan',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        manifest: {
          version: '1.0'
          // Missing required fields
        }
      }
    });

    expect(badManifestRes.statusCode).toBe(400);
    const badManifestBody = JSON.parse(badManifestRes.body);
    expect(badManifestBody.error).toBe('VALIDATION_ERROR');
  });

  // Test Case 5: End-to-End Chained Pipeline with Auth & WebSocket Broadcast
  it('Test Case 5: Full parse -> plan workflow with authentication and WebSocket event broadcasting', async () => {
    // 5a. Unauthenticated request should fail with 401
    const unauthRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/parse',
      headers: {
        host: 'localhost:41777'
      },
      payload: {
        projectId: sampleProjectId,
        markdown: '### file.ts\n```ts\nconst x = 1;\n```'
      }
    });
    expect(unauthRes.statusCode).toBe(401);

    // 5b. Create a task via /import to test task association and WebSocket emission
    const importRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/import',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        title: 'Chained Workflow Task',
        content: '### src/chained.ts\n```ts\nexport const chained = true;\n```',
        sourceType: 'TEXT'
      }
    });
    expect(importRes.statusCode).toBe(201);
    const taskId = JSON.parse(importRes.body).data.id;

    // 5c. Authenticated Parse
    const parseRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/parse',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        markdown: '### src/chained.ts\n```ts\nexport const chained = true;\n```',
        taskId
      }
    });
    expect(parseRes.statusCode).toBe(200);
    const manifest = JSON.parse(parseRes.body).data;
    expect(manifest.files).toHaveLength(1);

    // 5d. Authenticated Plan with taskId
    const planRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/plan',
      headers: {
        host: 'localhost:41777',
        authorization: `Bearer ${token}`
      },
      payload: {
        projectId: sampleProjectId,
        manifest,
        taskId
      }
    });
    expect(planRes.statusCode).toBe(200);
    const planBody = JSON.parse(planRes.body);
    expect(planBody.success).toBe(true);
    expect(planBody.data.operations).toHaveLength(1);

    // 5e. Verify SQLite persistence in execution_plans and file_operations
    const persistedPlan = await repositories.planRepo.findByTaskId(taskId);
    expect(persistedPlan).toBeDefined();
    expect(persistedPlan.status).toBe('READY');

    const persistedOps = await repositories.fileOpRepo.findByTaskId(taskId);
    expect(persistedOps).toHaveLength(1);
    expect(persistedOps[0].relativePath).toBe('src/chained.ts');
    expect(persistedOps[0].operationType).toBe('CREATE');
  });
});
