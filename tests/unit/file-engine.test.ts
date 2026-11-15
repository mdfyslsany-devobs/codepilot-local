import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FileEngine,
  validateSafePath,
  SecurityError,
  createFolder,
  createFile,
  updateFile,
  moveFile,
  copyFile,
  renameFile,
  deleteFile,
  generateDiff,
  scanProjectDirectory
} from '@codepilot/file-engine';
import {
  initializeDatabase,
  ProjectRepository,
  TaskRepository,
  BackupRepository,
  FileOperationRepository
} from '@codepilot/database';

describe('Phase 2: Local File Engine', () => {
  let tempRoot: string;
  let dbInstance: ReturnType<typeof initializeDatabase>;
  let projectRepo: ProjectRepository;
  let taskRepo: TaskRepository;
  let backupRepo: BackupRepository;
  let fileOpRepo: FileOperationRepository;
  let engine: FileEngine;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'cp-test-file-engine-'));
    dbInstance = initializeDatabase(':memory:');
    projectRepo = new ProjectRepository(dbInstance.db);
    taskRepo = new TaskRepository(dbInstance.db);
    backupRepo = new BackupRepository(dbInstance.db);
    fileOpRepo = new FileOperationRepository(dbInstance.db);
    engine = new FileEngine(backupRepo, fileOpRepo);
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  describe('Path Validation & Security', () => {
    it('should validate allowed relative paths inside project root', () => {
      const res = validateSafePath(tempRoot, 'src/index.ts');
      expect(res.safeRelativePath).toBe('src/index.ts');
      expect(res.fullPath).toBe(join(tempRoot, 'src', 'index.ts'));
    });

    it('should reject path traversal using ..', () => {
      expect(() => validateSafePath(tempRoot, '../outside.txt')).toThrow(SecurityError);
      expect(() => validateSafePath(tempRoot, 'src/../../outside.txt')).toThrow(SecurityError);
    });

    it('should reject null bytes in path', () => {
      expect(() => validateSafePath(tempRoot, 'file\0.txt')).toThrow(SecurityError);
    });

    it('should block access to protected .git segments', () => {
      expect(() => validateSafePath(tempRoot, '.git/config')).toThrow(SecurityError);
      expect(() => validateSafePath(tempRoot, 'nested/.git/HEAD')).toThrow(SecurityError);
    });
  });

  describe('Folder Creation', () => {
    it('should create directories recursively', async () => {
      const createdPath = await createFolder(tempRoot, 'deep/nested/directory');
      expect(existsSync(createdPath)).toBe(true);
    });

    it('should be idempotent for existing directories', async () => {
      await createFolder(tempRoot, 'my-folder');
      const secondCall = await createFolder(tempRoot, 'my-folder');
      expect(existsSync(secondCall)).toBe(true);
    });
  });

  describe('File Creation & Reading', () => {
    it('should create new file atomically with content and checksum', async () => {
      const content = 'export const greeting = "Hello World";\n';
      const res = await createFile(tempRoot, 'src/greeting.ts', content);

      expect(res.fullPath).toBeDefined();
      expect(existsSync(res.fullPath)).toBe(true);
      expect(res.byteSize).toBe(content.length);
      expect(res.checksum).toMatch(/^[0-9a-f]{64}$/);

      const readBack = await engine.readFile(tempRoot, 'src/greeting.ts');
      expect(readBack).toBe(content);
    });

    it('should prevent accidental overwrite when using createFile', async () => {
      await createFile(tempRoot, 'config.json', '{"version": 1}');
      await expect(createFile(tempRoot, 'config.json', '{"version": 2}')).rejects.toThrow(
        /File already exists/
      );
    });
  });

  describe('File Updating & Diffs', () => {
    it('should safely update an existing file atomically', async () => {
      await createFile(tempRoot, 'version.txt', '1.0.0');
      const updateRes = await updateFile(tempRoot, 'version.txt', '1.1.0');

      expect(updateRes.previousContent).toBe('1.0.0');
      expect(updateRes.previousChecksum).not.toBe(updateRes.newChecksum);

      const current = await engine.readFile(tempRoot, 'version.txt');
      expect(current).toBe('1.1.0');
    });

    it('should fail update when target file does not exist', async () => {
      await expect(updateFile(tempRoot, 'missing.txt', 'data')).rejects.toThrow(
        /File not found for update/
      );
    });

    it('should generate accurate unified diffs with line statistics', () => {
      const diffResult = generateDiff(
        'op-1',
        'src/hello.ts',
        'UPDATE',
        'PENDING',
        'const a = 1;\nconst b = 2;\n',
        'const a = 1;\nconst b = 3;\nconst c = 4;\n'
      );

      expect(diffResult.operationId).toBe('op-1');
      expect(diffResult.isBinary).toBe(false);
      expect(diffResult.additions).toBe(2);
      expect(diffResult.deletions).toBe(1);
      expect(diffResult.diffText).toContain('+const b = 3;');
      expect(diffResult.diffText).toContain('-const b = 2;');
    });
  });

  describe('File Mover (Move, Copy, Rename, Delete)', () => {
    it('should move file between directories safely', async () => {
      await createFile(tempRoot, 'source.txt', 'movable content');
      await moveFile(tempRoot, 'source.txt', 'dest/sub/moved.txt');

      expect(engine.fileExists(tempRoot, 'source.txt')).toBe(false);
      expect(engine.fileExists(tempRoot, 'dest/sub/moved.txt')).toBe(true);
      expect(await engine.readFile(tempRoot, 'dest/sub/moved.txt')).toBe('movable content');
    });

    it('should copy file safely preserving original', async () => {
      await createFile(tempRoot, 'original.txt', 'copyable content');
      await copyFile(tempRoot, 'original.txt', 'copied.txt');

      expect(engine.fileExists(tempRoot, 'original.txt')).toBe(true);
      expect(engine.fileExists(tempRoot, 'copied.txt')).toBe(true);
      expect(await engine.readFile(tempRoot, 'copied.txt')).toBe('copyable content');
    });

    it('should rename file', async () => {
      await createFile(tempRoot, 'old-name.txt', 'renamed content');
      await renameFile(tempRoot, 'old-name.txt', 'new-name.txt');

      expect(engine.fileExists(tempRoot, 'old-name.txt')).toBe(false);
      expect(engine.fileExists(tempRoot, 'new-name.txt')).toBe(true);
    });

    it('should delete existing file safely', async () => {
      await createFile(tempRoot, 'to-delete.txt', 'delete me');
      await deleteFile(tempRoot, 'to-delete.txt');
      expect(engine.fileExists(tempRoot, 'to-delete.txt')).toBe(false);
    });
  });

  describe('Backup & Restore Flow', () => {
    it('should create backup before modifying existing file and restore it', async () => {
      const project = await projectRepo.create({ name: 'Test Pkg', path: tempRoot });
      const task = await taskRepo.create({ projectId: project.id, title: 'Modify Task' });

      const original = 'original pristine content';
      await createFile(tempRoot, 'important.txt', original);

      const opResult = await engine.executeOperation({
        projectRoot: tempRoot,
        taskId: task.id,
        projectId: project.id,
        operationType: 'UPDATE',
        relativePath: 'important.txt',
        content: 'destructive modification',
        autoBackup: true,
        isApproved: true
      });

      expect(opResult.backupId).toBeDefined();
      expect(await engine.readFile(tempRoot, 'important.txt')).toBe('destructive modification');

      // Check backup record in DB
      const backups = await backupRepo.findByTaskId(task.id);
      expect(backups.length).toBe(1);
      const backup = backups[0]!;

      // Restore file
      const restoreResult = await engine.restoreFile(
        tempRoot,
        backup.filePath,
        backup.backupPath,
        backup.originalChecksum,
        backup.id
      );

      expect(restoreResult.restoredPath).toBe('important.txt');
      expect(await engine.readFile(tempRoot, 'important.txt')).toBe(original);
    });

    it('should rollback multiple files modified in a task', async () => {
      const project = await projectRepo.create({ name: 'Test Pkg 2', path: tempRoot });
      const task = await taskRepo.create({ projectId: project.id, title: 'Rollback Task' });

      await createFile(tempRoot, 'fileA.txt', 'content A original');
      await createFile(tempRoot, 'fileB.txt', 'content B original');

      await engine.executeOperation({
        projectRoot: tempRoot,
        taskId: task.id,
        projectId: project.id,
        operationType: 'UPDATE',
        relativePath: 'fileA.txt',
        content: 'content A changed',
        autoBackup: true,
        isApproved: true
      });

      await engine.executeOperation({
        projectRoot: tempRoot,
        taskId: task.id,
        projectId: project.id,
        operationType: 'UPDATE',
        relativePath: 'fileB.txt',
        content: 'content B changed',
        autoBackup: true,
        isApproved: true
      });

      expect(await engine.readFile(tempRoot, 'fileA.txt')).toBe('content A changed');
      expect(await engine.readFile(tempRoot, 'fileB.txt')).toBe('content B changed');

      // Rollback all backups for the task
      const rollbackResult = await engine.rollbackTask(tempRoot, task.id);
      expect(rollbackResult.restoredFiles).toContain('fileA.txt');
      expect(rollbackResult.restoredFiles).toContain('fileB.txt');

      expect(await engine.readFile(tempRoot, 'fileA.txt')).toBe('content A original');
      expect(await engine.readFile(tempRoot, 'fileB.txt')).toBe('content B original');
    });
  });

  describe('Project Scanner', () => {
    it('should scan directories and ignore system/dependency folders', async () => {
      await createFile(tempRoot, 'src/index.ts', 'console.log(1);');
      await createFile(tempRoot, 'src/utils/math.ts', 'export const add = 1;');
      await createFolder(tempRoot, 'node_modules/dummy');
      await createFile(tempRoot, 'node_modules/dummy/pkg.json', '{}');

      const scanned = await scanProjectDirectory(tempRoot);
      const paths = scanned.map((s) => s.relativePath);

      expect(paths).toContain('src');
      expect(paths).toContain('src/index.ts');
      expect(paths).toContain('src/utils/math.ts');

      // node_modules ignored
      expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
    });
  });
});
