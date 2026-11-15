import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import sensible from '@fastify/sensible';
import { AuthManager } from './authentication/auth-manager.js';
import { createSecurityHooks } from './middleware/security.js';
import { EventBroadcaster } from './websocket/broadcaster.js';
import {
  initializeDatabase,
  ProjectRepository,
  TaskRepository,
  ExecutionPlanRepository,
  FileOperationRepository,
  BackupRepository,
  ActivityLogRepository,
  ApplicationSettingRepository
} from '@codepilot/database';
import { FileEngine } from '@codepilot/file-engine';
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';
import { taskRoutes } from './routes/tasks.js';
import { backupRoutes } from './routes/backups.js';
import { fileRoutes } from './routes/files.js';

export interface ServerOptions {
  dbPath?: string;
  dataDir?: string;
  port?: number;
  host?: string;
}

export async function createServer(options: ServerOptions = {}): Promise<{
  server: FastifyInstance;
  authManager: AuthManager;
  broadcaster: EventBroadcaster;
  fileEngine: FileEngine;
  db: ReturnType<typeof initializeDatabase>;
  repositories: {
    projectRepo: ProjectRepository;
    taskRepo: TaskRepository;
    planRepo: ExecutionPlanRepository;
    fileOpRepo: FileOperationRepository;
    backupRepo: BackupRepository;
    activityRepo: ActivityLogRepository;
    settingRepo: ApplicationSettingRepository;
  };
}> {
  const server = Fastify({
    logger: false
  });

  await server.register(sensible);
  await server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. desktop native, curl, server-to-server)
      if (!origin) return cb(null, true);
      const isAllowed =
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
        /^tauri:\/\/localhost$/.test(origin) ||
        /^vscode-webview:\/\/.*$/.test(origin);
      if (isAllowed) {
        return cb(null, true);
      }
      const forbiddenError = new Error('Cross-origin request blocked');
      (forbiddenError as Error & { statusCode: number }).statusCode = 403;
      return cb(forbiddenError, false);
    }
  });

  await server.register(websocket);

  const authManager = new AuthManager(options.dataDir);
  const broadcaster = new EventBroadcaster();
  const dbInstance = initializeDatabase(options.dbPath || ':memory:');

  const repositories = {
    projectRepo: new ProjectRepository(dbInstance.db),
    taskRepo: new TaskRepository(dbInstance.db),
    planRepo: new ExecutionPlanRepository(dbInstance.db),
    fileOpRepo: new FileOperationRepository(dbInstance.db),
    backupRepo: new BackupRepository(dbInstance.db),
    activityRepo: new ActivityLogRepository(dbInstance.db),
    settingRepo: new ApplicationSettingRepository(dbInstance.db)
  };

  const fileEngine = new FileEngine(repositories.backupRepo, repositories.fileOpRepo);
  const securityHooks = createSecurityHooks(authManager);

  // Security Hooks
  server.addHook('onRequest', securityHooks.validateHostAndOrigin);
  server.addHook('preHandler', securityHooks.requireAuthentication);

  // WebSocket Route
  server.get('/api/v1/events', { websocket: true }, (socket) => {
    broadcaster.registerClient(socket);
  });

  // REST API Routes
  await healthRoutes(server);
  await projectRoutes(server, {
    projectRepo: repositories.projectRepo,
    fileEngine
  });
  await fileRoutes(server, {
    projectRepo: repositories.projectRepo,
    taskRepo: repositories.taskRepo,
    fileEngine
  });
  await taskRoutes(server, {
    taskRepo: repositories.taskRepo,
    planRepo: repositories.planRepo,
    fileOpRepo: repositories.fileOpRepo,
    projectRepo: repositories.projectRepo,
    fileEngine,
    broadcaster
  });
  await backupRoutes(server, {
    backupRepo: repositories.backupRepo,
    projectRepo: repositories.projectRepo,
    fileEngine
  });

  return {
    server,
    authManager,
    broadcaster,
    fileEngine,
    db: dbInstance,
    repositories
  };
}
