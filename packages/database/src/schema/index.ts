import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  description: text('description'),
  status: text('status').notNull().default('ACTIVE'),
  settings: text('settings').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('PENDING'),
  inputType: text('input_type').notNull().default('TEXT'),
  error: text('error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at')
});

export const taskInputs = sqliteTable('task_inputs', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  rawContent: text('raw_content').notNull(),
  sourceType: text('source_type').notNull(),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: text('created_at').notNull()
});

export const parsedFiles = sqliteTable('parsed_files', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  relativePath: text('relative_path').notNull(),
  fileName: text('file_name').notNull(),
  language: text('language').notNull(),
  content: text('content').notNull(),
  contentChecksum: text('content_checksum').notNull(),
  lineCount: integer('line_count').notNull(),
  byteSize: integer('byte_size').notNull(),
  metadata: text('metadata').notNull().default('{}'),
  createdAt: text('created_at').notNull()
});

export const executionPlans = sqliteTable('execution_plans', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  totalOperations: integer('total_operations').notNull().default(0),
  status: text('status').notNull().default('DRAFT'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const fileOperations = sqliteTable('file_operations', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  operationType: text('operation_type').notNull(),
  relativePath: text('relative_path').notNull(),
  targetPath: text('target_path'),
  content: text('content'),
  previousContent: text('previous_content'),
  status: text('status').notNull().default('PENDING'),
  error: text('error'),
  createdAt: text('created_at').notNull(),
  executedAt: text('executed_at')
});

export const backups = sqliteTable('backups', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  backupPath: text('backup_path').notNull(),
  originalChecksum: text('original_checksum').notNull(),
  createdAt: text('created_at').notNull(),
  restoredAt: text('restored_at')
});

export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  level: text('level').notNull(),
  message: text('message').notNull(),
  context: text('context').notNull().default('{}'),
  createdAt: text('created_at').notNull()
});

export const applicationSettings = sqliteTable('application_settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const registeredWorkspaces = sqliteTable('registered_workspaces', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  workspacePath: text('workspace_path').notNull(),
  lastOpenedAt: text('last_opened_at').notNull(),
  createdAt: text('created_at').notNull()
});
