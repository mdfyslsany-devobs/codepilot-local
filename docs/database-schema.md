# CodePilot Local — Database Schema

CodePilot Local uses **SQLite** managed via **Drizzle ORM**. All tables use UUID primary keys and ISO UTC timestamp strings.

## Tables

### 1. `projects`
- `id` (text, primary key, UUID)
- `name` (text, not null)
- `path` (text, not null, unique normalized path)
- `description` (text)
- `status` (text, default 'ACTIVE')
- `settings` (text, JSON object)
- `created_at` (text, ISO timestamp)
- `updated_at` (text, ISO timestamp)

### 2. `tasks`
- `id` (text, primary key, UUID)
- `project_id` (text, foreign key -> projects.id, nullable)
- `title` (text, not null)
- `description` (text)
- `status` (text, default 'PENDING') — values: `PENDING`, `PARSED`, `PLANNED`, `AWAITING_APPROVAL`, `EXECUTING`, `COMPLETED`, `FAILED`, `CANCELLED`
- `input_type` (text, default 'TEXT') — values: `TEXT`, `ZIP`, `LOCAL_FOLDER`
- `error` (text)
- `created_at` (text, ISO timestamp)
- `updated_at` (text, ISO timestamp)
- `completed_at` (text, ISO timestamp)

### 3. `task_inputs`
- `id` (text, primary key, UUID)
- `task_id` (text, foreign key -> tasks.id, not null)
- `raw_content` (text, not null)
- `source_type` (text, not null)
- `metadata` (text, JSON object)
- `created_at` (text, ISO timestamp)

### 4. `parsed_files`
- `id` (text, primary key, UUID)
- `task_id` (text, foreign key -> tasks.id, not null)
- `relative_path` (text, not null)
- `file_name` (text, not null)
- `language` (text, not null)
- `content` (text, not null)
- `content_checksum` (text, not null, SHA-256)
- `line_count` (integer, not null)
- `byte_size` (integer, not null)
- `metadata` (text, JSON object)
- `created_at` (text, ISO timestamp)

### 5. `execution_plans`
- `id` (text, primary key, UUID)
- `task_id` (text, foreign key -> tasks.id, not null)
- `total_operations` (integer, not null, default 0)
- `status` (text, default 'DRAFT') — values: `DRAFT`, `APPROVED`, `PARTIALLY_APPROVED`, `REJECTED`, `EXECUTED`
- `created_at` (text, ISO timestamp)
- `updated_at` (text, ISO timestamp)

### 6. `file_operations`
- `id` (text, primary key, UUID)
- `plan_id` (text, foreign key -> execution_plans.id, not null)
- `task_id` (text, foreign key -> tasks.id, not null)
- `operation_type` (text, not null) — values: `CREATE`, `UPDATE`, `MOVE`, `COPY`, `RENAME`, `DELETE`, `MKDIR`
- `relative_path` (text, not null)
- `target_path` (text) — used for MOVE, COPY, RENAME
- `content` (text) — for CREATE / UPDATE
- `previous_content` (text) — for diffs
- `status` (text, default 'PENDING') — values: `PENDING`, `APPROVED`, `REJECTED`, `EXECUTED`, `FAILED`
- `error` (text)
- `created_at` (text, ISO timestamp)
- `executed_at` (text, ISO timestamp)

### 7. `backups`
- `id` (text, primary key, UUID)
- `task_id` (text, foreign key -> tasks.id, not null)
- `project_id` (text, foreign key -> projects.id, not null)
- `file_path` (text, not null)
- `backup_path` (text, not null)
- `original_checksum` (text, not null, SHA-256)
- `created_at` (text, ISO timestamp)
- `restored_at` (text, ISO timestamp)

### 8. `activity_logs`
- `id` (text, primary key, UUID)
- `task_id` (text, foreign key -> tasks.id)
- `project_id` (text, foreign key -> projects.id)
- `level` (text, not null) — values: `INFO`, `WARN`, `ERROR`, `DEBUG`
- `message` (text, not null)
- `context` (text, JSON object)
- `created_at` (text, ISO timestamp)

### 9. `application_settings`
- `id` (text, primary key, UUID)
- `key` (text, unique, not null)
- `value` (text, not null)
- `updated_at` (text, ISO timestamp)

### 10. `registered_workspaces`
- `id` (text, primary key, UUID)
- `project_id` (text, foreign key -> projects.id, not null)
- `workspace_path` (text, not null)
- `last_opened_at` (text, ISO timestamp)
- `created_at` (text, ISO timestamp)
