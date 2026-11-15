import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required').max(255),
  path: z.string().min(1, 'Project path is required'),
  description: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
  settings: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  path: z.string().min(1, 'Project path is required'),
  description: z.string().optional()
});

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
