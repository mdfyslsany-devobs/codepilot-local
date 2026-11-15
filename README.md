# CodePilot Local

> **Local-First Personal Coding Automation Agent**

CodePilot Local is a local automation platform that converts externally generated AI instructions (ChatGPT, Claude, DeepSeek, Gemini, etc.) into real project files on your computer.

---

## Highlights

- **Deterministic Execution:** No local AI models, Ollama, or third-party paid AI APIs. Works purely on deterministic parsing of instructions you provide.
- **Local-First & Private:** Server runs on `127.0.0.1` only. Your files never leave your machine.
- **Safety First:** Path traversal protection, pre-modification backups, diff previews, and explicit approval before any file is created, updated, or removed.
- **Unified Engine:** Both the Tauri 2 Desktop App and the VS Code Extension share the same local agent backend and SQLite database.
- **Controlled Terminal:** Execute commands like `npm install` and run previews with sandboxed process controls and explicit approvals.

---

## Getting Started

See [Development Guide](file:///C:/xampp/htdocs/codepilot-local/docs/development-guide.md) for build, testing, and setup instructions.
See [Progress Log](file:///C:/xampp/htdocs/codepilot-local/docs/progress.md) for milestone implementation status.
