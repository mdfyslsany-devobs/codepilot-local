import { eq, desc } from 'drizzle-orm';
import type { AppDatabase } from '../connection.js';
import * as schema from '../schema/index.js';
import { generateUuid } from '@codepilot/shared';

export class ProjectRepository {
  constructor(private db: AppDatabase) {}

  async create(data: { name: string; path: string; description?: string }) {
    const id = generateUuid();
    const now = new Date().toISOString();
    const record = {
      id,
      name: data.name,
      path: data.path,
      description: data.description ?? null,
      status: 'ACTIVE',
      settings: '{}',
      createdAt: now,
      updatedAt: now
    };
    this.db.insert(schema.projects).values(record).run();
    return record;
  }

  async findById(id: string) {
    const results = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .all();
    return results[0] ?? null;
  }

  async findByPath(path: string) {
    const results = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.path, path))
      .all();
    return results[0] ?? null;
  }

  async listAll() {
    return this.db
      .select()
      .from(schema.projects)
      .orderBy(desc(schema.projects.updatedAt))
      .all();
  }
}

export class TaskRepository {
  constructor(private db: AppDatabase) {}

  async create(data: {
    projectId?: string | null;
    title: string;
    description?: string;
    inputType?: 'TEXT' | 'ZIP' | 'LOCAL_FOLDER';
    rawContent?: string;
  }) {
    const id = generateUuid();
    const now = new Date().toISOString();
    const taskRecord = {
      id,
      projectId: data.projectId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: 'PENDING',
      inputType: data.inputType ?? 'TEXT',
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    this.db.insert(schema.tasks).values(taskRecord).run();

    if (data.rawContent) {
      const inputRecord = {
        id: generateUuid(),
        taskId: id,
        rawContent: data.rawContent,
        sourceType: data.inputType ?? 'TEXT',
        metadata: '{}',
        createdAt: now
      };
      this.db.insert(schema.taskInputs).values(inputRecord).run();
    }

    return taskRecord;
  }

  async findById(id: string) {
    const tasks = this.db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .all();
    return tasks[0] ?? null;
  }

  async updateStatus(id: string, status: string, error?: string | null) {
    const now = new Date().toISOString();
    this.db
      .update(schema.tasks)
      .set({
        status,
        error: error ?? null,
        updatedAt: now,
        completedAt: ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status) ? now : null
      })
      .where(eq(schema.tasks.id, id))
      .run();
  }

  async listRecent(limit: number = 20) {
    return this.db
      .select()
      .from(schema.tasks)
      .orderBy(desc(schema.tasks.createdAt))
      .limit(limit)
      .all();
  }
}

export class ExecutionPlanRepository {
  constructor(private db: AppDatabase) {}

  async create(data: { taskId: string; totalOperations: number }) {
    const id = generateUuid();
    const now = new Date().toISOString();
    const record = {
      id,
      taskId: data.taskId,
      totalOperations: data.totalOperations,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now
    };
    this.db.insert(schema.executionPlans).values(record).run();
    return record;
  }

  async findByTaskId(taskId: string) {
    const plans = this.db
      .select()
      .from(schema.executionPlans)
      .where(eq(schema.executionPlans.taskId, taskId))
      .all();
    return plans[0] ?? null;
  }

  async updateStatus(id: string, status: string) {
    const now = new Date().toISOString();
    this.db
      .update(schema.executionPlans)
      .set({ status, updatedAt: now })
      .where(eq(schema.executionPlans.id, id))
      .run();
  }
}

export class FileOperationRepository {
  constructor(private db: AppDatabase) {}

  async createMany(operations: Array<{
    planId: string;
    taskId: string;
    operationType: string;
    relativePath: string;
    targetPath?: string | null;
    content?: string | null;
    previousContent?: string | null;
  }>) {
    const now = new Date().toISOString();
    const records = operations.map((op) => ({
      id: generateUuid(),
      planId: op.planId,
      taskId: op.taskId,
      operationType: op.operationType,
      relativePath: op.relativePath,
      targetPath: op.targetPath ?? null,
      content: op.content ?? null,
      previousContent: op.previousContent ?? null,
      status: 'PENDING',
      error: null,
      createdAt: now,
      executedAt: null
    }));

    if (records.length > 0) {
      this.db.insert(schema.fileOperations).values(records).run();
    }
    return records;
  }

  async findByTaskId(taskId: string) {
    return this.db
      .select()
      .from(schema.fileOperations)
      .where(eq(schema.fileOperations.taskId, taskId))
      .all();
  }

  async updateStatus(id: string, status: string, error?: string | null) {
    const now = new Date().toISOString();
    this.db
      .update(schema.fileOperations)
      .set({
        status,
        error: error ?? null,
        executedAt: status === 'EXECUTED' ? now : null
      })
      .where(eq(schema.fileOperations.id, id))
      .run();
  }
}

export class BackupRepository {
  constructor(private db: AppDatabase) {}

  async create(data: {
    taskId: string;
    projectId: string;
    filePath: string;
    backupPath: string;
    originalChecksum: string;
  }) {
    const id = generateUuid();
    const now = new Date().toISOString();
    const record = {
      id,
      taskId: data.taskId,
      projectId: data.projectId,
      filePath: data.filePath,
      backupPath: data.backupPath,
      originalChecksum: data.originalChecksum,
      createdAt: now,
      restoredAt: null
    };
    this.db.insert(schema.backups).values(record).run();
    return record;
  }

  async findById(id: string) {
    const results = this.db
      .select()
      .from(schema.backups)
      .where(eq(schema.backups.id, id))
      .all();
    return results[0] ?? null;
  }

  async findByTaskId(taskId: string) {
    return this.db
      .select()
      .from(schema.backups)
      .where(eq(schema.backups.taskId, taskId))
      .all();
  }

  async listRecent(limit: number = 50) {
    return this.db
      .select()
      .from(schema.backups)
      .orderBy(desc(schema.backups.createdAt))
      .limit(limit)
      .all();
  }

  async markRestored(id: string) {
    const now = new Date().toISOString();
    this.db
      .update(schema.backups)
      .set({ restoredAt: now })
      .where(eq(schema.backups.id, id))
      .run();
  }
}

export class ActivityLogRepository {
  constructor(private db: AppDatabase) {}

  async log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, context: Record<string, unknown> = {}, taskId?: string, projectId?: string) {
    const id = generateUuid();
    const now = new Date().toISOString();
    const record = {
      id,
      taskId: taskId ?? null,
      projectId: projectId ?? null,
      level,
      message,
      context: JSON.stringify(context),
      createdAt: now
    };
    this.db.insert(schema.activityLogs).values(record).run();
    return record;
  }
}

export class ApplicationSettingRepository {
  constructor(private db: AppDatabase) {}

  async get(key: string): Promise<string | null> {
    const result = this.db
      .select()
      .from(schema.applicationSettings)
      .where(eq(schema.applicationSettings.key, key))
      .all();
    return result[0]?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.get(key);
    if (existing !== null) {
      this.db
        .update(schema.applicationSettings)
        .set({ value, updatedAt: now })
        .where(eq(schema.applicationSettings.key, key))
        .run();
    } else {
      this.db
        .insert(schema.applicationSettings)
        .values({ id: generateUuid(), key, value, updatedAt: now })
        .run();
    }
  }
}
