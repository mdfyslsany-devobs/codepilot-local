import { z } from 'zod';
import { TASK_INPUT_TYPES } from '../constants/defaults.js';
import { FileOperationSchema } from './operation.schema.js';

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

export const ManifestFileSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty'),
  content: z.string(),
  language: z.string().nullable(),
  isNew: z.boolean()
});
export type ManifestFile = z.infer<typeof ManifestFileSchema>;

export const ManifestWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  filename: z.string().nullable().optional(),
  codeBlockIndex: z.number().int().nonnegative().optional()
});
export type ManifestWarning = z.infer<typeof ManifestWarningSchema>;

export const ManifestErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  filename: z.string().nullable().optional(),
  codeBlockIndex: z.number().int().nonnegative().optional()
});
export type ManifestError = z.infer<typeof ManifestErrorSchema>;

export const ExecutionManifestSchema = z.object({
  version: z.string(),
  createdAt: z.string().datetime(),
  instructionsHash: z.string().length(64),
  folders: z.array(z.string()),
  files: z.array(ManifestFileSchema),
  warnings: z.array(ManifestWarningSchema),
  errors: z.array(ManifestErrorSchema)
});
export type ExecutionManifest = z.infer<typeof ExecutionManifestSchema>;

export const ParseTaskRequestSchema = z
  .object({
    projectId: z.string().uuid({ message: 'Valid projectId UUID is required' }).optional(),
    markdown: z.string().min(1, { message: 'Markdown content cannot be empty' }).optional(),
    taskId: z.string().uuid({ message: 'Valid taskId UUID is required' }).optional()
  })
  .superRefine((data, ctx) => {
    if (!data.taskId && (!data.projectId || !data.markdown)) {
      if (!data.projectId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['projectId'],
          message: 'Valid projectId UUID is required'
        });
      }
      if (!data.markdown) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['markdown'],
          message: 'Markdown content cannot be empty'
        });
      }
    }
  });
export type ParseTaskRequest = z.infer<typeof ParseTaskRequestSchema>;

export const PlanTaskRequestSchema = z
  .object({
    projectId: z.string().uuid({ message: 'Valid projectId UUID is required' }).optional(),
    manifest: ExecutionManifestSchema.optional(),
    taskId: z.string().uuid({ message: 'Valid taskId UUID is required' }).optional()
  })
  .superRefine((data, ctx) => {
    if (!data.taskId && (!data.projectId || !data.manifest)) {
      if (!data.projectId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['projectId'],
          message: 'Valid projectId UUID is required'
        });
      }
      if (!data.manifest) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['manifest'],
          message: 'Manifest is required'
        });
      }
    }
  });
export type PlanTaskRequest = z.infer<typeof PlanTaskRequestSchema>;

export const PlanTaskResponseDataSchema = z.object({
  planId: z.string().uuid(),
  operations: z.array(FileOperationSchema)
});
export type PlanTaskResponseData = z.infer<typeof PlanTaskResponseDataSchema>;

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
