import { z } from 'zod';
import { TASK_INPUT_TYPES } from '../constants/defaults.js';

// Health
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  timestamp: z.string(),
  uptime: z.number()
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Generic API response
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional()
  });
}

// Tasks API
export const ImportTaskRequestSchema = z.object({
  projectId: z.string().uuid().optional(),
  content: z.string().min(1, 'Content is required'),
  sourceType: z.enum(TASK_INPUT_TYPES).default('TEXT'),
  title: z.string().max(255).optional()
});
export type ImportTaskRequest = z.infer<typeof ImportTaskRequestSchema>;

export const ParseTaskRequestSchema = z.object({
  taskId: z.string().uuid()
});
export type ParseTaskRequest = z.infer<typeof ParseTaskRequestSchema>;

export const PlanTaskRequestSchema = z.object({
  taskId: z.string().uuid()
});
export type PlanTaskRequest = z.infer<typeof PlanTaskRequestSchema>;

export const ApproveTaskRequestSchema = z.object({
  operationIds: z.array(z.string().uuid()).optional()
});
export type ApproveTaskRequest = z.infer<typeof ApproveTaskRequestSchema>;

export const RejectTaskRequestSchema = z.object({
  operationIds: z.array(z.string().uuid()).optional(),
  reason: z.string().optional()
});
export type RejectTaskRequest = z.infer<typeof RejectTaskRequestSchema>;

export const RestoreBackupRequestSchema = z.object({
  backupId: z.string().uuid()
});
export type RestoreBackupRequest = z.infer<typeof RestoreBackupRequestSchema>;

// WebSocket event
export const WsEventSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
  timestamp: z.string()
});
export type WsEvent = z.infer<typeof WsEventSchema>;
