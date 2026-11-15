# CodePilot Local — Development Guide

## Prerequisites

- Node.js >= 20 (Node.js 24 supported)
- pnpm >= 9 (pnpm 12 supported)
- Git

## Getting Started

1. **Clone and enter workspace:**
   ```bash
   cd codepilot-local
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build workspace packages:**
   ```bash
   pnpm build
   ```

4. **Run the local agent server:**
   ```bash
   pnpm dev
   ```

5. **Run test suite:**
   ```bash
   pnpm test
   ```

6. **Type check:**
   ```bash
   pnpm typecheck
   ```

## Workspaces Structure

- `packages/shared`: Shared types, constants, Zod schemas, utilities.
- `packages/database`: SQLite database layer with Drizzle ORM.
- `packages/file-engine`: Safe file operations, backups, diffs.
- `packages/instruction-parser`: Deterministic parser for AI instructions.
- `packages/agent-core`: Task planning, validation, event coordination.
- `packages/local-server`: Fastify local API and WebSocket engine.
- `packages/terminal-engine`: Sandboxed terminal commands and preview.
- `apps/desktop`: Tauri 2 + React + Tailwind desktop application.
- `apps/vscode-extension`: Native VS Code extension.
