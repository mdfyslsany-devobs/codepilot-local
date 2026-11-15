import type { FastifyInstance } from 'fastify';
import type { ProjectRepository, TaskRepository } from '@codepilot/database';
import type { FileEngine } from '@codepilot/file-engine';
import { ErrorCode } from '@codepilot/shared';
import { z } from 'zod';

const FileCreateSchema = z.object({
  projectId: z.string().uuid(),
  relativePath: z.string().min(1),
  content: z.string()
});

const FileUpdateSchema = z.object({
  projectId: z.string().uuid(),
  relativePath: z.string().min(1),
  content: z.string(),
  approved: z.boolean().default(false),
  taskId: z.string().uuid().optional()
});

const FileDeleteSchema = z.object({
  projectId: z.string().uuid(),
  relativePath: z.string().min(1),
  approved: z.boolean().default(false),
  taskId: z.string().uuid().optional()
});

const FileRestoreSchema = z.object({
  projectId: z.string().uuid(),
  relativePath: z.string().min(1),
  backupPath: z.string().min(1),
  expectedChecksum: z.string().optional(),
  backupId: z.string().optional()
});

export async function fileRoutes(
  server: FastifyInstance,
  opts: {
    projectRepo: ProjectRepository;
    taskRepo: TaskRepository;
    fileEngine: FileEngine;
  }
) {
  const { projectRepo, taskRepo, fileEngine } = opts;

  // 1. Read file
  server.get('/api/v1/files/read', async (request, reply) => {
    const { projectId, path } = (request.query as { projectId?: string; path?: string }) || {};
    if (!projectId || !path) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: 'projectId and path are required'
      });
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    try {
      const content = await fileEngine.readFile(project.path, path);
      return {
        success: true,
        data: {
          relativePath: path,
          content
        }
      };
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // 2. Create file
  server.post('/api/v1/files/create', async (request, reply) => {
    const parse = FileCreateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parse.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { projectId, relativePath, content } = parse.data;
    const project = await projectRepo.findById(projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    try {
      const task = await taskRepo.create({
        projectId,
        title: `Create file: ${relativePath}`,
        inputType: 'LOCAL_FOLDER'
      });

      const result = await fileEngine.executeOperation({
        projectRoot: project.path,
        taskId: task.id,
        projectId,
        operationType: 'CREATE',
        relativePath,
        content,
        isApproved: true
      });

      return reply.status(201).send({
        success: true,
        data: result
      });
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // 3. Update file (Approval enforced)
  server.post('/api/v1/files/update', async (request, reply) => {
    const parse = FileUpdateSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parse.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { projectId, relativePath, content, approved, taskId } = parse.data;
    const project = await projectRepo.findById(projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    if (!approved) {
      return reply.status(403).send({
        success: false,
        error: ErrorCode.OPERATION_REJECTED,
        message: 'Updating an existing file requires explicit user approval.'
      });
    }

    try {
      let effectiveTaskId = taskId;
      if (!effectiveTaskId) {
        const autoTask = await taskRepo.create({
          projectId,
          title: `Update file: ${relativePath}`,
          inputType: 'LOCAL_FOLDER'
        });
        effectiveTaskId = autoTask.id;
      }

      const result = await fileEngine.executeOperation({
        projectRoot: project.path,
        taskId: effectiveTaskId,
        projectId,
        operationType: 'UPDATE',
        relativePath,
        content,
        isApproved: true,
        autoBackup: true
      });

      return {
        success: true,
        data: result
      };
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // 4. Delete file (Separate Approval enforced)
  server.post('/api/v1/files/delete', async (request, reply) => {
    const parse = FileDeleteSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parse.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { projectId, relativePath, approved, taskId } = parse.data;
    const project = await projectRepo.findById(projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    if (!approved) {
      return reply.status(403).send({
        success: false,
        error: ErrorCode.OPERATION_REJECTED,
        message: 'Deleting a file strictly requires explicit user approval.'
      });
    }

    try {
      let effectiveTaskId = taskId;
      if (!effectiveTaskId) {
        const autoTask = await taskRepo.create({
          projectId,
          title: `Delete file: ${relativePath}`,
          inputType: 'LOCAL_FOLDER'
        });
        effectiveTaskId = autoTask.id;
      }

      const result = await fileEngine.executeOperation({
        projectRoot: project.path,
        taskId: effectiveTaskId,
        projectId,
        operationType: 'DELETE',
        relativePath,
        isApproved: true,
        autoBackup: true
      });

      return {
        success: true,
        data: result
      };
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // 5. Diff view
  server.get('/api/v1/files/diff', async (request, reply) => {
    const { projectId, path, proposedContent } = (request.query as {
      projectId?: string;
      path?: string;
      proposedContent?: string;
    }) || {};

    if (!projectId || !path) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: 'projectId and path are required'
      });
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    const diff = await fileEngine.getDiff(project.path, path, proposedContent || '');
    return {
      success: true,
      data: diff
    };
  });

  // 6. Restore file
  server.post('/api/v1/files/restore', async (request, reply) => {
    const parse = FileRestoreSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parse.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { projectId, relativePath, backupPath, expectedChecksum, backupId } = parse.data;
    const project = await projectRepo.findById(projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    try {
      const result = await fileEngine.restoreFile(
        project.path,
        relativePath,
        backupPath,
        expectedChecksum,
        backupId
      );

      return {
        success: true,
        data: result,
        message: `File ${result.restoredPath} restored successfully`
      };
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // 7. Scan project directory
  server.get('/api/v1/files/scan', async (request, reply) => {
    const { projectId } = (request.query as { projectId?: string }) || {};
    if (!projectId) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: 'projectId is required'
      });
    }

    const project = await projectRepo.findById(projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    const entries = await fileEngine.scanProject(project.path);
    return {
      success: true,
      data: entries
    };
  });
}
