# CodePilot Local — API Reference

Base URL: `http://127.0.0.1:41777` (default port, or allocated dynamic port)
Authorization Header: `Authorization: Bearer <LOCAL_TOKEN>` or `x-api-key: <LOCAL_TOKEN>`

## Endpoints

### 1. Health
- `GET /api/v1/health`
  - Response: `{ status: "ok", timestamp: string, version: string, uptime: number }`

### 2. Projects
- `GET /api/v1/projects`
  - Response: `{ success: true, data: Project[] }`
- `POST /api/v1/projects`
  - Body: `{ name: string, path: string, description?: string }`
  - Response: `{ success: true, data: Project }`
- `GET /api/v1/projects/:id`
  - Response: `{ success: true, data: Project }`

### 3. Tasks
- `POST /api/v1/tasks/import`
  - Body: `{ projectId?: string, content: string, sourceType: "TEXT" | "ZIP" | "LOCAL_FOLDER", title?: string }`
  - Response: `{ success: true, data: { task: Task, input: TaskInput } }`
- `POST /api/v1/tasks/parse`
  - Body: `{ taskId: string }`
  - Response: `{ success: true, data: { task: Task, parsedFiles: ParsedFile[] } }`
- `POST /api/v1/tasks/plan`
  - Body: `{ taskId: string }`
  - Response: `{ success: true, data: { plan: ExecutionPlan, operations: FileOperation[] } }`
- `GET /api/v1/tasks/:id`
  - Response: `{ success: true, data: { task: Task, plan?: ExecutionPlan, operations?: FileOperation[] } }`
- `GET /api/v1/tasks/:id/diff`
  - Response: `{ success: true, data: OperationDiff[] }`
- `POST /api/v1/tasks/:id/approve`
  - Body: `{ operationIds?: string[] }` (omitted for Approve All)
  - Response: `{ success: true, message: string }`
- `POST /api/v1/tasks/:id/reject`
  - Body: `{ operationIds?: string[], reason?: string }`
  - Response: `{ success: true, message: string }`
- `POST /api/v1/tasks/:id/execute`
  - Response: `{ success: true, data: { executed: number, failed: number } }`
- `POST /api/v1/tasks/:id/cancel`
  - Response: `{ success: true, message: string }`

### 4. Backups
- `GET /api/v1/backups?taskId=&projectId=`
  - Response: `{ success: true, data: Backup[] }`
- `POST /api/v1/backups/restore`
  - Body: `{ backupId: string }`
  - Response: `{ success: true, message: string }`

### 5. WebSocket Live Events
- `WS /api/v1/events`
  - Protocol: JSON messages with `{ type: string, payload: any, timestamp: string }`
  - Events: `task:progress`, `task:completed`, `task:failed`, `operation:executed`, `server:log`
