import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index.js';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

const DDL_STATEMENTS = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  input_type TEXT NOT NULL DEFAULT 'TEXT',
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS task_inputs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  raw_content TEXT NOT NULL,
  source_type TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parsed_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  content_checksum TEXT NOT NULL,
  line_count INTEGER NOT NULL,
  byte_size INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_plans (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  total_operations INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_operations (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES execution_plans(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  target_path TEXT,
  content TEXT,
  previous_content TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  error TEXT,
  created_at TEXT NOT NULL,
  executed_at TEXT
);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  original_checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  restored_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS application_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registered_workspaces (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workspace_path TEXT NOT NULL,
  last_opened_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export function initializeDatabase(dbPath: string = ':memory:'): {
  sqlite: Database.Database;
  db: AppDatabase;
} {
  if (dbPath !== ':memory:') {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Execute DDL initialization
  sqlite.exec(DDL_STATEMENTS);

  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}
