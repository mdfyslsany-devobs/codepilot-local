import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeDatabase,
  ProjectRepository,
  TaskRepository,
  ExecutionPlanRepository,
  FileOperationRepository,
  BackupRepository,
  ActivityLogRepository,
  ApplicationSettingRepository
} from '@codepilot/database';

describe('Database & Repositories (Phase 1)', () => {
  let dbInstance: ReturnType<typeof initializeDatabase>;
  let projectRepo: ProjectRepository;
  let taskRepo: TaskRepository;
  let planRepo: ExecutionPlanRepository;
  let fileOpRepo: FileOperationRepository;
  let backupRepo: BackupRepository;
  let activityRepo: ActivityLogRepository;
  let settingRepo: ApplicationSettingRepository;

  beforeEach(() => {
    dbInstance = initializeDatabase(':memory:');
    projectRepo = new ProjectRepository(dbInstance.db);
    taskRepo = new TaskRepository(dbInstance.db);
    planRepo = new ExecutionPlanRepository(dbInstance.db);
    fileOpRepo = new FileOperationRepository(dbInstance.db);
    backupRepo = new BackupRepository(dbInstance.db);
    activityRepo = new ActivityLogRepository(dbInstance.db);
    settingRepo = new ApplicationSettingRepository(dbInstance.db);
  });

  it('should initialize all 10 tables and allow schema operations', () => {
    const tables = dbInstance.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('task_inputs');
    expect(tableNames).toContain('parsed_files');
    expect(tableNames).toContain('execution_plans');
    expect(tableNames).toContain('file_operations');
    expect(tableNames).toContain('backups');
    expect(tableNames).toContain('activity_logs');
    expect(tableNames).toContain('application_settings');
    expect(tableNames).toContain('registered_workspaces');
  });

  it('should create and retrieve projects', async () => {
    const project = await projectRepo.create({
      name: 'Test Project',
      path: 'C:/projects/test',
      description: 'A test project'
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe('Test Project');

    const foundById = await projectRepo.findById(project.id);
    expect(foundById?.path).toBe('C:/projects/test');

    const foundByPath = await projectRepo.findByPath('C:/projects/test');
    expect(foundByPath?.id).toBe(project.id);

    const all = await projectRepo.listAll();
    expect(all.length).toBe(1);
  });

  it('should create and update tasks with raw inputs', async () => {
    const task = await taskRepo.create({
      title: 'Setup Monorepo',
      description: 'Initialize monorepo structure',
      inputType: 'TEXT',
      rawContent: '# Test Instruction\nCreate file index.ts'
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe('PENDING');

    await taskRepo.updateStatus(task.id, 'PARSED');
    const updated = await taskRepo.findById(task.id);
    expect(updated?.status).toBe('PARSED');

    await taskRepo.updateStatus(task.id, 'COMPLETED');
    const completed = await taskRepo.findById(task.id);
    expect(completed?.status).toBe('COMPLETED');
    expect(completed?.completedAt).toBeDefined();
  });

  it('should handle execution plans and file operations', async () => {
    const task = await taskRepo.create({ title: 'Plan Task' });
    const plan = await planRepo.create({ taskId: task.id, totalOperations: 2 });

    expect(plan.id).toBeDefined();
    expect(plan.totalOperations).toBe(2);

    const ops = await fileOpRepo.createMany([
      {
        planId: plan.id,
        taskId: task.id,
        operationType: 'CREATE',
        relativePath: 'src/main.ts',
        content: 'console.log("hello");'
      },
      {
        planId: plan.id,
        taskId: task.id,
        operationType: 'MKDIR',
        relativePath: 'src'
      }
    ]);

    expect(ops.length).toBe(2);

    const taskOps = await fileOpRepo.findByTaskId(task.id);
    expect(taskOps.length).toBe(2);

    await fileOpRepo.updateStatus(ops[0]!.id, 'EXECUTED');
    const updatedOps = await fileOpRepo.findByTaskId(task.id);
    const executedOp = updatedOps.find((o) => o.id === ops[0]!.id);
    expect(executedOp?.status).toBe('EXECUTED');
    expect(executedOp?.executedAt).toBeDefined();
  });

  it('should record backups and mark them restored', async () => {
    const project = await projectRepo.create({ name: 'Backup Test', path: 'C:/test' });
    const task = await taskRepo.create({ projectId: project.id, title: 'Backup Task' });

    const backup = await backupRepo.create({
      taskId: task.id,
      projectId: project.id,
      filePath: 'src/index.ts',
      backupPath: '.codepilot/backups/index.ts.bak',
      originalChecksum: 'abc123sha'
    });

    expect(backup.id).toBeDefined();
    expect(backup.restoredAt).toBeNull();

    await backupRepo.markRestored(backup.id);
    const backups = await backupRepo.findByTaskId(task.id);
    expect(backups[0]?.restoredAt).toBeDefined();
  });

  it('should manage application settings persistently', async () => {
    expect(await settingRepo.get('theme')).toBeNull();

    await settingRepo.set('theme', 'dark');
    expect(await settingRepo.get('theme')).toBe('dark');

    await settingRepo.set('theme', 'light');
    expect(await settingRepo.get('theme')).toBe('light');
  });

  it('should record activity logs', async () => {
    const log = await activityRepo.log('INFO', 'Server initialized', { port: 41777 });
    expect(log.id).toBeDefined();
    expect(log.level).toBe('INFO');
  });
});
