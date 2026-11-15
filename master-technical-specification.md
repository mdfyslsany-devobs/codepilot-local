# CODEPILOT LOCAL
## Master Technical Specification & Development Blueprint
**Version:** 1.0  
**Project Type:** Local-First Personal Coding Automation Agent  
**Target OS:** Windows 10/11, Ubuntu/Linux  
**License Strategy:** Open-Source Dependencies / No Paid API  
**AI Dependency:** None

---

# 1. Project Vision

Build a personal local coding automation platform that converts externally generated AI instructions and code into real project files on the user's computer.

The user can copy code and instructions from ChatGPT, Claude, DeepSeek, Gemini or any other AI and paste them into CodePilot Local.

The application must:

1. Read and parse the provided instructions.
2. Detect project names and folder structures.
3. Extract code blocks and associated file paths.
4. Generate a structured execution plan.
5. Create folders and files on the local disk.
6. Place code into the correct files.
7. Import existing ZIP projects.
8. Update existing projects with approval.
9. Display code differences before modification.
10. Maintain backups and operation history.
11. Communicate between Desktop App and VS Code Extension.
12. Support local development commands and project previews.

**Important:** This is a deterministic automation application, not an AI chatbot. It must never claim to understand or generate missing code using an AI model.

# 2. Final Technology Stack

## Primary Programming Languages

- TypeScript: Main application logic, Agent Engine, Desktop UI and VS Code Extension.
- JavaScript: Runtime ecosystem through Node.js.
- Rust: Tauri native desktop host and controlled native capabilities.
- HTML: Webview and web project support.
- CSS: Application styling.
- SQL: SQLite database queries and migrations.

## Frameworks and Tools

| Component | Technology |
|---|---|
| Desktop Framework | Tauri 2 |
| Frontend | React |
| Programming | TypeScript |
| Runtime | Node.js |
| Styling | Tailwind CSS |
| Component System | Reusable React Components |
| Desktop Native Layer | Rust |
| Editor Integration | VS Code Extension API |
| Local Database | SQLite |
| Database Access | Drizzle ORM |
| Validation | Zod |
| Local API | Fastify |
| Live Communication | WebSocket |
| Package Manager | pnpm |
| Monorepo | pnpm Workspaces |
| Testing | Vitest |
| E2E Testing | Playwright |
| Version Control | Git |
| Archive Support | ZIP Library |

Use stable compatible versions and commit the lockfile.

# 3. Architecture

The system must use a shared local Agent Engine.

### Applications

A. Desktop Application:
- Tauri 2
- React
- TypeScript
- Tailwind CSS

B. VS Code Extension:
- VS Code Extension API
- TypeScript
- Native VS Code commands
- Workspace integration

### Shared Backend

A standalone local Node.js Agent Service will handle:
- Instruction parsing
- Project planning
- File management
- Backup
- Validation
- Task management
- Terminal execution
- Database operations

### Communication

Desktop Application → Local Agent API

VS Code Extension → Local Agent API

Use:
- HTTP for normal requests.
- WebSocket for live task events.
- Localhost-only network access.
- Authenticated client sessions.

The Desktop Application should be able to start and supervise the Agent Service.

The VS Code Extension should also be able to launch the packaged local service when the Desktop Application is not running.

Both interfaces must connect to the same Agent Service and database.

# 4. Monorepo Structure

Create the following root project structure:

codepilot-local/

apps/
  desktop/
    src/
      components/
      layouts/
      pages/
      hooks/
      services/
      stores/
      styles/
    src-tauri/
      src/
      capabilities/
      icons/
      tauri.conf.json

  vscode-extension/
    src/
      commands/
      providers/
      views/
      services/
      extension.ts
    media/
    package.json

packages/
  agent-core/
    src/
      tasks/
      planner/
      events/
      validation/

  instruction-parser/
    src/
      markdown/
      code-blocks/
      file-paths/
      folder-structure/
      asset-detection/
      conflict-detection/

  file-engine/
    src/
      creator/
      updater/
      mover/
      backup/
      restore/
      scanner/
      security/

  local-server/
    src/
      routes/
      middleware/
      websocket/
      authentication/
      server.ts

  terminal-engine/
    src/
      command-registry/
      runner/
      approvals/
      process-management/

  database/
    src/
      schema/
      repositories/
      migrations/

  shared/
    src/
      types/
      schemas/
      constants/
      utilities/

  ui/
    src/
      components/
      icons/
      theme/

tests/
  unit/
  integration/
  security/
  e2e/

docs/
  architecture.md
  api-reference.md
  database-schema.md
  security.md
  development-guide.md

scripts/
.gitignore
package.json
pnpm-workspace.yaml
tsconfig.base.json
README.md

Every package must have a clear responsibility. Avoid unnecessary duplication and circular dependencies.

# 5. Core Functional Modules

## Module 1: Instruction Importer

Support three input methods:

1. Full text Copy-Paste.
2. ZIP archive import.
3. Existing local project folder selection.

The importer must preserve:
- Original instruction text.
- Markdown formatting.
- Code fences.
- File path headings.
- Language identifiers.
- Folder tree information.

Provide a clear import preview before processing.

## Module 2: Deterministic Instruction Parser

Implement a multi-stage parser.

Stage 1: Markdown Parsing.

Stage 2: Code Block Extraction.

Stage 3: File Path Detection.

Stage 4: Folder Structure Detection.

Stage 5: Language Detection.

Stage 6: Duplicate File Detection.

Stage 7: Missing Content Detection.

Stage 8: Execution Manifest Generation.

Priority order for mapping code to files:

1. Explicit file path in code heading.
2. Explicit file path inside code block.
3. Matching folder tree entry.
4. Clear contextual filename reference.
5. Ask the user when mapping remains ambiguous.

Never silently invent missing source code.

## Module 3: Project Planner

Convert parsed instructions into a structured execution plan.

Every operation must contain:

- Operation ID.
- Operation type.
- Relative file path.
- Content reference.
- Detected language.
- Existing file status.
- Validation status.
- Approval status.

Supported operations:

CREATE, UPDATE, MOVE, COPY, RENAME, DELETE, MKDIR.

The planner must detect conflicts before execution.

## Module 4: Local File Engine

Implement:

- Recursive folder creation.
- File creation.
- File content writing.
- Existing file reading.
- File updating.
- File renaming.
- File moving.
- File copying.
- Safe deletion.
- File restoration.
- File comparison.

All paths must be normalized and checked against authorized project roots.

Prevent path traversal, unauthorized symlink escapes and overwriting unrelated files.

Use safe temporary writes and atomic replacement where supported.

## Module 5: Approval System

New files inside authorized project folders can be created under the approved task plan.

Existing files must be reviewed before modification.

Deletion must always require separate confirmation.

Provide:

- Approve All.
- Approve Selected.
- Reject.
- View Diff.
- View Full File.
- Rollback.

The user must be able to review every planned operation.

## Module 6: Backup System

Before modifying existing files:

1. Save the original file.
2. Record its original path.
3. Record a content checksum.
4. Record task ID and timestamp.
5. Execute the approved modification.
6. Verify the result.

Support restoring individual files and complete task snapshots.

Never automatically delete user backups without explicit permission.

## Module 7: ZIP Importer

Support ZIP extraction with:

- Archive path validation.
- File count limits.
- Uncompressed size limits.
- Compression ratio checks.
- Duplicate path detection.
- Symlink rejection.
- Safe extraction boundaries.

Never execute imported scripts automatically.

## Module 8: Terminal Engine

Support common development commands such as:

- npm install
- npm run dev
- npm run build
- npm run test
- composer install
- PHP development server
- Git status
- Git diff

Use explicit command profiles and an approval mechanism.

Do not execute arbitrary shell instructions extracted from imported AI content.

Show command, working directory, output and exit status.

Implement execution timeout and process termination.

## Module 9: Project Preview

Support local development server management.

Provide:
- Start server.
- Stop server.
- View server logs.
- Open local preview.
- Detect build errors.
- Display port information.

Do not assume every project uses the same development command.

# 6. Desktop Application UI

Create a professional, premium developer-oriented interface.

Design direction:
- Dark-first interface.
- Clean typography.
- Professional developer workspace.
- Minimal visual clutter.
- Clear file operation statuses.
- Consistent spacing.
- Responsive layout.
- Accessible contrast.
- Reusable components.

Main navigation:

1. Dashboard
2. New Task
3. Projects
4. File Explorer
5. Execution Queue
6. History
7. Backups
8. Integrations
9. Settings

Dashboard:

- Agent Connection Status.
- Active Project.
- Recent Projects.
- Recent Tasks.
- Files Created.
- Files Updated.
- Recent Activity.
- Quick Import.

New Task Screen:

- Large instruction editor.
- Paste Instruction.
- Import ZIP.
- Select Project.
- Parse Instruction.
- Preview Execution Plan.

Execution Screen:

- File operation list.
- New/Updated/Deleted status.
- Code Diff Viewer.
- Approval controls.
- Live progress.
- Terminal logs.

# 7. VS Code Extension

Create a native VS Code extension.

Features:

- Agent Sidebar.
- Paste Instruction.
- ZIP Import.
- Current Workspace Detection.
- Project Selection.
- Parse Instruction.
- Preview Changes.
- Approve Operations.
- Execution Progress.
- Task History.
- Open Desktop App.

Use native VS Code APIs wherever possible.

Avoid creating an unnecessary duplicate application inside VS Code.

The Extension and Desktop App must share:
- Project records.
- Task records.
- Operation history.
- Backup records.
- Agent status.

# 8. Database Design

Use SQLite.

Required tables:

1. projects
2. tasks
3. task_inputs
4. parsed_files
5. execution_plans
6. file_operations
7. backups
8. activity_logs
9. application_settings
10. registered_workspaces

Use UUID identifiers.

Store timestamps in a consistent UTC format.

Store large file content and backup data using an appropriate file-based storage strategy where practical, rather than unnecessarily bloating the database.

Include database migrations and integrity checks.

# 9. Local API

Create versioned API endpoints.

GET /api/v1/health

GET /api/v1/projects

POST /api/v1/projects

GET /api/v1/projects/:id

POST /api/v1/tasks/import

POST /api/v1/tasks/parse

POST /api/v1/tasks/plan

GET /api/v1/tasks/:id

GET /api/v1/tasks/:id/diff

POST /api/v1/tasks/:id/approve

POST /api/v1/tasks/:id/reject

POST /api/v1/tasks/:id/execute

POST /api/v1/tasks/:id/cancel

GET /api/v1/backups

POST /api/v1/backups/restore

WS /api/v1/events

Validate all incoming requests with Zod.

Document request and response contracts.

# 10. Security Requirements

Security is mandatory.

- Bind local server to 127.0.0.1 only.
- Use authenticated local sessions.
- Validate Origin and Host.
- Use CSRF protection where applicable.
- Restrict file operations to registered project roots.
- Prevent path traversal.
- Prevent unauthorized symlink access.
- Validate imported archives.
- Never execute imported code automatically.
- Require approval for destructive actions.
- Protect environment files and credentials.
- Do not transmit project files to external services.
- Keep audit logs.
- Use restrictive Tauri capabilities.
- Do not expose arbitrary shell execution to the UI.

Treat every imported instruction as untrusted data.

# 11. Platform Compatibility

Primary targets:

Windows 10/11 and Ubuntu/Linux.

Use cross-platform Node.js APIs wherever possible.

Implement OS-specific behavior only where necessary.

Test:
- File permissions.
- Path separators.
- File locking.
- Process execution.
- ZIP extraction.
- Application startup.
- Desktop packaging.

Provide installation and development instructions for both operating systems.

# 12. Testing Strategy

Unit tests:
- Parser.
- Path validation.
- Manifest generation.
- File operations.
- Backup and restore.
- ZIP validation.

Integration tests:
- Import to Parse.
- Parse to Plan.
- Plan to Approval.
- Approval to Execution.
- Execution to Backup.
- Rollback.

Security tests:
- Path traversal.
- Malicious archive.
- Symlink escape.
- Unauthorized requests.
- Command injection.
- Destructive operation protection.

E2E tests:
- Desktop workflow.
- VS Code workflow.
- Cross-interface task synchronization.

# 13. Development Phases

Phase 1: Foundation
- Monorepo.
- Shared types.
- Agent Service.
- SQLite.
- Local API.
- Authentication.

Phase 2: File Engine
- File creation.
- Folder creation.
- File update.
- Backup.
- Restore.
- Path security.

Phase 3: Instruction Parser
- Markdown parser.
- Code extraction.
- Path mapping.
- Folder structure.
- Manifest.
- ZIP importer.

Phase 4: Desktop App
- Tauri.
- React.
- Dashboard.
- Instruction Importer.
- Project Explorer.
- Approval Interface.

Phase 5: VS Code Extension
- Extension setup.
- Sidebar.
- Workspace detection.
- Local Agent connection.
- Live task updates.

Phase 6: Terminal & Preview
- Command profiles.
- Approval.
- Execution.
- Build.
- Preview.
- Logs.

Phase 7: Testing & Release
- Security testing.
- Windows packaging.
- Linux packaging.
- Installer.
- Documentation.

# 14. Mandatory Development Rules

1. Follow the approved architecture.
2. Do not replace technologies without approval.
3. Do not introduce paid services or AI APIs.
4. Do not add Ollama or other Local AI Models.
5. Do not create fake functionality or placeholder implementations.
6. Do not claim a feature is complete until it works.
7. Write modular, maintainable TypeScript.
8. Use strict TypeScript settings.
9. Validate user input.
10. Write tests for core functionality.
11. Maintain documentation.
12. Preserve existing working functionality.
13. Do not overwrite user data without approval.
14. Do not silently skip failed operations.
15. Report incomplete work honestly.

# 15. MVP Acceptance Criteria

The first release is successful only when:

- Desktop Application launches successfully.
- VS Code Extension connects to the Local Agent.
- Both interfaces share the same project and task data.
- User can paste AI-generated instructions.
- Parser extracts multiple code blocks.
- Correct folders and files are created.
- ZIP projects can be imported safely.
- Existing files can be updated with approval.
- Code diffs are visible.
- Backups can be restored.
- Terminal commands run through controlled execution.
- Windows and Linux builds work.
- No AI API or Local AI Model is required.

# 16. Final Product Principle

CodePilot Local is a user-controlled local coding automation platform.

It does not replace ChatGPT, Claude or DeepSeek.

It works alongside those tools.

External AI generates the instructions and code. CodePilot Local organizes, validates and executes the file operations on the user's own computer.

The user's local files remain under the user's control.

**FINAL REQUIREMENT: Build a working, secure and maintainable product—not merely an attractive interface or a demonstration.**