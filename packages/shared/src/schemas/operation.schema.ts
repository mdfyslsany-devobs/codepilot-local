import { z } from 'zod';
import { OPERATION_TYPES, OPERATION_STATUSES } from '../constants/defaults.js';

export const FileOperationSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  taskId: z.string().uuid(),
  operationType: z.enum(OPERATION_TYPES),
  relativePath: z.string().min(1),
  targetPath: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  previousContent: z.string().nullable().optional(),
  status: z.enum(OPERATION_STATUSES).default('PENDING'),
  error: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  executedAt: z.string().datetime().nullable().optional()
});

export type FileOperation = z.infer<typeof FileOperationSchema>;

export const OperationDiffSchema = z.object({
  operationId: z.string().uuid(),
  relativePath: z.string(),
  operationType: z.enum(OPERATION_TYPES),
  status: z.enum(OPERATION_STATUSES),
  diffText: z.string(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  isBinary: z.boolean().default(false)
});

export type OperationDiff = z.infer<typeof OperationDiffSchema>;
