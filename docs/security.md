# CodePilot Local — Security Architecture

## 1. Network Boundary Security
- **Localhost Only:** The Fastify server binds exclusively to `127.0.0.1`. Binding to `0.0.0.0` or external interfaces is strictly prohibited.
- **Host / Origin Validation:** Every incoming request must contain a valid Host header matching `localhost` or `127.0.0.1`. Requests originating from unauthorized browser pages are rejected to block DNS rebinding and cross-site request attacks.
- **Session Authentication:** Every request must provide a valid session bearer token generated at local server startup and stored securely in `~/.codepilot-local/auth.token`.

## 2. Filesystem Security
- **Path Traversal Defense:** All destination paths are normalized and verified using `path.relative` against the authorized project root. Any path resolving outside the root is blocked immediately.
- **Symlink Protection:** Symlinks resolving outside the project root are prohibited.
- **Dangerous File Protections:** Critical files (e.g. `.git/`, `.env`, system files) require elevated warnings and separate protection.
- **Pre-execution Backup:** Before any existing file is modified or overwritten, a backup is created in `.codepilot-local/backups/` and registered with a SHA-256 checksum.

## 3. Command & Script Execution Safety
- **No Automatic Execution:** Code blocks or scripts extracted from AI instructions are never executed automatically.
- **Strict Command Registry:** Terminal commands are checked against a predefined whitelist of approved developer commands (e.g., `npm install`, `pnpm install`, `npm run dev`, etc.).
- **User Approval Required:** Every terminal command requires explicit user review before execution.
