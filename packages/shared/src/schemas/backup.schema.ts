import { z } from 'zod';
import { LOG_LEVELS } from '../constants/defaults.js';

export const BackupSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  filePath: z.string().min(1),
  backupPath: z.string().min(1),
  originalChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  restoredAt: z.string().datetime().nullable().optional()
});

export const ActivityLogSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  level: z.enum(LOG_LEVELS),
  message: z.string().min(1),
  context: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime()
});

export const ApplicationSettingSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  value: z.string(),
  updatedAt: z.string().datetime()
});

export const RegisteredWorkspaceSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  workspacePath: z.string().min(1),
  lastOpenedAt: z.string().datetime(),
  createdAt: z.string().datetime()
});

export type Backup = z.infer<typeof BackupSchema>;
export type ActivityLog = z.infer<typeof ActivityLogSchema>;
export type ApplicationSetting = z.infer<typeof ApplicationSettingSchema>;
export type RegisteredWorkspace = z.infer<typeof RegisteredWorkspaceSchema>;
