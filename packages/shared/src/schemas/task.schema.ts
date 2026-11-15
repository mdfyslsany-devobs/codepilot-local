import { z } from 'zod';
import { TASK_STATUSES, TASK_INPUT_TYPES, EXECUTION_PLAN_STATUSES } from '../constants/defaults.js';

export const TaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES).default('PENDING'),
  inputType: z.enum(TASK_INPUT_TYPES).default('TEXT'),
  error: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional()
});

export const TaskInputSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  rawContent: z.string(),
  sourceType: z.enum(TASK_INPUT_TYPES),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime()
});

export const ParsedFileSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  relativePath: z.string().min(1),
  fileName: z.string().min(1),
  language: z.string().min(1),
  content: z.string(),
  contentChecksum: z.string(),
  lineCount: z.number().int().nonnegative(),
  byteSize: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime()
});

export const ExecutionPlanSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  totalOperations: z.number().int().nonnegative().default(0),
  status: z.enum(EXECUTION_PLAN_STATUSES).default('DRAFT'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskInput = z.infer<typeof TaskInputSchema>;
export type ParsedFile = z.infer<typeof ParsedFileSchema>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
