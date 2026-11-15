import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileEngine, createFile, SecurityError } from '@codepilot/file-engine';
import { initializeDatabase, ProjectRepository, TaskRepository } from '@codepilot/database';
import { ErrorCode } from '@codepilot/shared';

describe('Phase 2: Approval System Guard (Specification §5 Module 5)', () => {
  let tempRoot: string;
  let dbInstance: ReturnType<typeof initializeDatabase>;
  let projectRepo: ProjectRepository;
  let taskRepo: TaskRepository;
  let engine: FileEngine;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'cp-test-approval-'));
    dbInstance = initializeDatabase(':memory:');
    projectRepo = new ProjectRepository(dbInstance.db);
    taskRepo = new TaskRepository(dbInstance.db);
    engine = new FileEngine();
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('allows new file creation without separate approval', async () => {
    const project = await projectRepo.create({ name: 'Approval App', path: tempRoot });
    const task = await taskRepo.create({ projectId: project.id, title: 'Create Task' });

    const result = await engine.executeOperation({
      projectRoot: tempRoot,
      taskId: task.id,
      projectId: project.id,
      operationType: 'CREATE',
      relativePath: 'new-file.txt',
      content: 'hello',
      isApproved: false
    });

    expect(result.success).toBe(true);
    expect(await engine.readFile(tempRoot, 'new-file.txt')).toBe('hello');
  });

  it('strictly blocks existing file modification when isApproved is false', async () => {
    const project = await projectRepo.create({ name: 'Approval App', path: tempRoot });
    const task = await taskRepo.create({ projectId: project.id, title: 'Update Task' });

    await createFile(tempRoot, 'existing.txt', 'v1');

    try {
      await engine.executeOperation({
        projectRoot: tempRoot,
        taskId: task.id,
        projectId: project.id,
        operationType: 'UPDATE',
        relativePath: 'existing.txt',
        content: 'v2',
        isApproved: false
      });
      expect.fail('Expected operation to be rejected without approval');
    } catch (err) {
      expect(err).toBeInstanceOf(SecurityError);
      expect((err as SecurityError).code).toBe(ErrorCode.OPERATION_REJECTED);
      expect((err as SecurityError).message).toContain('approval');
    }

    // Verify file remains unmodified
    expect(await engine.readFile(tempRoot, 'existing.txt')).toBe('v1');
  });

  it('allows existing file modification when isApproved is true', async () => {
    const project = await projectRepo.create({ name: 'Approval App', path: tempRoot });
    const task = await taskRepo.create({ projectId: project.id, title: 'Update Task' });

    await createFile(tempRoot, 'existing.txt', 'v1');

    const result = await engine.executeOperation({
      projectRoot: tempRoot,
      taskId: task.id,
      projectId: project.id,
      operationType: 'UPDATE',
      relativePath: 'existing.txt',
      content: 'v2',
      isApproved: true
    });

    expect(result.success).toBe(true);
    expect(await engine.readFile(tempRoot, 'existing.txt')).toBe('v2');
  });

  it('strictly blocks file deletion when isApproved is false', async () => {
    const project = await projectRepo.create({ name: 'Approval App', path: tempRoot });
    const task = await taskRepo.create({ projectId: project.id, title: 'Delete Task' });

    await createFile(tempRoot, 'to-delete.txt', 'keep me');

    try {
      await engine.executeOperation({
        projectRoot: tempRoot,
        taskId: task.id,
        projectId: project.id,
        operationType: 'DELETE',
        relativePath: 'to-delete.txt',
        isApproved: false
      });
      expect.fail('Expected deletion to be rejected without approval');
    } catch (err) {
      expect(err).toBeInstanceOf(SecurityError);
      expect((err as SecurityError).code).toBe(ErrorCode.OPERATION_REJECTED);
    }

    expect(engine.fileExists(tempRoot, 'to-delete.txt')).toBe(true);
  });

  it('allows file deletion when isApproved is true', async () => {
    const project = await projectRepo.create({ name: 'Approval App', path: tempRoot });
    const task = await taskRepo.create({ projectId: project.id, title: 'Delete Task' });

    await createFile(tempRoot, 'to-delete.txt', 'delete me');

    const result = await engine.executeOperation({
      projectRoot: tempRoot,
      taskId: task.id,
      projectId: project.id,
      operationType: 'DELETE',
      relativePath: 'to-delete.txt',
      isApproved: true
    });

    expect(result.success).toBe(true);
    expect(engine.fileExists(tempRoot, 'to-delete.txt')).toBe(false);
  });
});
