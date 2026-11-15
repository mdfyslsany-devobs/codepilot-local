# CodePilot Local — Progress Tracker

## Milestone Overview

| Milestone | Status | Description |
|---|---|---|
| **Phase 1: Foundation** | **COMPLETED & VERIFIED** | Monorepo setup, shared types, SQLite database, Drizzle ORM, local Fastify server, Auth, Health API |
| **Phase 2: File Engine** | **COMPLETED & VERIFIED** | Project registration, file/folder CRUD, safe path validation, backup/restore, atomic writes, approval system |
| **Phase 3: Instruction Parser** | Ready to begin | Markdown parsing, code block extraction, path heuristics, manifest generator, ZIP importer |
| **Phase 4: Desktop Application** | Planned | Tauri 2 + React + Tailwind desktop UI, execution plan preview, diff viewer, approvals |
| **Phase 5: VS Code Extension** | Planned | Native sidebar, workspace auto-detection, execution controls, shared task history |
| **Phase 6: Terminal & Preview** | Planned | Controlled execution, process supervisor, live output streaming, web preview |
| **Phase 7: Testing & Packaging** | Planned | Full test suite (unit, integration, security, e2e), release bundles for Windows/Linux |

---

## Phase 1: Foundation Detail (Status: 100% Complete)

- [x] **Monorepo setup**: Initialized pnpm workspace with `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, and `.gitignore`.
- [x] **Node.js, npm, pnpm global verification**: Node.js v24.11.1, npm 11.16.0, pnpm 12.21.0 configured with `.cmd` execution wrappers.
- [x] **SQLite native runtime**: Upgraded to `better-sqlite3@13.2.0` which includes native Windows x64 Node 24 prebuilds; verified query execution.
- [x] **`@codepilot/shared` package**:
  - Implemented Zod schemas for all 10 core domain entities (`projects`, `tasks`, `task_inputs`, `parsed_files`, `execution_plans`, `file_operations`, `backups`, `activity_logs`, `application_settings`, `registered_workspaces`).
  - Implemented utility functions (`isPathInside` path traversal guard, `normalizePath`, `computeSha256`, `generateUuid`).
  - Constants for task/operation statuses, log levels, default ports, and error codes.
- [x] **`@codepilot/database` package**:
  - Drizzle ORM schemas with foreign keys and cascading deletes.
  - SQLite connection manager with WAL mode, foreign keys PRAGMA, and DDL initializers.
  - Full repositories: `ProjectRepository`, `TaskRepository`, `ExecutionPlanRepository`, `FileOperationRepository`, `BackupRepository`, `ActivityLogRepository`, `ApplicationSettingRepository`.
- [x] **`@codepilot/local-server` package**:
  - Bounded strictly to `127.0.0.1`.
  - Cryptographically secure token management in `~/.codepilot-local/auth.token`.
  - Security middleware: Host header validation, Origin header restriction (`tauri://localhost`, `vscode-webview://`, `localhost`).
  - Fastify plugins: `@fastify/cors`, `@fastify/websocket`, `@fastify/sensible`.
  - WebSocket broadcaster for live task events on `WS /api/v1/events`.
  - Implemented endpoints: `GET /api/v1/health`, `GET /api/v1/projects`, `POST /api/v1/projects`, `GET /api/v1/projects/:id`.
  - Windows direct execution helper `isMainModule` extracted and exported.

---

## Phase 2: File Engine Detail (Status: 100% Complete)

- [x] **`@codepilot/file-engine` package**:
  - `path-validator.ts`: Path traversal rejection (`..`), null-byte checks, and protected segment guards (`.git`).
  - `symlink-guard.ts`: Symlink escape protection resolving target with `realpathSync` strictly within project root.
  - `file-creator.ts`: Atomic write to `.cp_tmp_<hex>` temporary file and atomic rename; blocks accidental overwrite of existing files.
  - `folder-creator.ts`: Recursive folder creation within project boundary.
  - `file-updater.ts`: Safe atomic modification reading previous buffer, backing up, and atomic replacing.
  - `file-mover.ts`: File moving, copying, renaming, and safe deletion.
  - `diff-generator.ts`: Unified diff generation using `diff` library with addition/deletion counts and binary detection.
  - `integrity-checker.ts`: SHA-256 calculation and file integrity tampering verification against stored hash.
  - `approval-guard.ts`: Enforces Master Specification §5 Module 5: creates allowed, existing file updates and all deletions strictly require explicit approval (`isApproved: true`).
  - `backup-manager.ts`: Automatic pre-modification backup recording file path, SHA-256 checksum, timestamp, and database registration.
  - `restore-manager.ts`: Individual file restoration with checksum verification and full task rollback (`rollbackTask`).
  - `project-scanner.ts`: Recursive filesystem scanner ignoring `node_modules`, `.git`, `.codepilot-local`, `dist`, etc.
  - `engine.ts`: High-level `FileEngine` coordinator tying together operations, transactions, diffs, approvals, and backups.
- [x] **API Endpoints Wire-up in `@codepilot/local-server`**:
  - `GET /api/v1/files/read`: Reads file safely.
  - `POST /api/v1/files/create`: Atomically creates new file.
  - `POST /api/v1/files/update`: Updates existing file with approval enforcement and auto-backup.
  - `POST /api/v1/files/delete`: Deletes file with approval enforcement and auto-backup.
  - `GET /api/v1/files/diff`: Computes unified diff preview against disk content.
  - `POST /api/v1/files/restore`: Restores file from backup and verifies SHA-256 integrity.
  - `GET /api/v1/files/scan`: Recursively scans project files.
  - `GET /api/v1/projects/:id/files`: Project explorer directory tree.
  - `POST /api/v1/tasks/:id/rollback`: Reverts all backups created in a task.
- [x] **Automated Tests**:
  - `tests/unit/database.test.ts` (7 tests passing)
  - `tests/unit/file-engine.test.ts` (18 tests passing)
  - `tests/unit/approval.test.ts` (5 tests passing)
  - `tests/unit/integrity.test.ts` (4 tests passing)
  - `tests/unit/entrypoint.test.ts` (4 tests passing)
  - `tests/unit/security.test.ts` (5 tests passing)
  - `tests/integration/server.test.ts` (11 tests passing)
  - `tests/integration/files-api.test.ts` (9 tests passing)
  - Total: **63 passed, 0 failed**.
