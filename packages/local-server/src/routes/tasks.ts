import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type {
  TaskRepository,
  ExecutionPlanRepository,
  FileOperationRepository,
  ProjectRepository
} from '@codepilot/database';
import type { FileEngine } from '@codepilot/file-engine';
import {
  ImportTaskRequestSchema,
  ParseTaskRequestSchema,
  PlanTaskRequestSchema,
  ErrorCode
} from '@codepilot/shared';
import { parseInstructions } from '@codepilot/instruction-parser';
import type { EventBroadcaster } from '../websocket/broadcaster.js';

export async function taskRoutes(
  server: FastifyInstance,
  opts: {
    taskRepo: TaskRepository;
    planRepo: ExecutionPlanRepository;
    fileOpRepo: FileOperationRepository;
    projectRepo: ProjectRepository;
    fileEngine: FileEngine;
    broadcaster: EventBroadcaster;
  }
) {
  const { taskRepo, planRepo, fileOpRepo, projectRepo, fileEngine, broadcaster } = opts;

  // Import Task
  server.post('/api/v1/tasks/import', async (request, reply) => {
    const parse = ImportTaskRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parse.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { projectId, content, sourceType, title } = parse.data;
    const taskTitle = title || `Task on ${new Date().toLocaleDateString()}`;

    const task = await taskRepo.create({
      projectId: projectId ?? null,
      title: taskTitle,
      inputType: sourceType,
      rawContent: content
    });

    broadcaster.broadcast('task:created', { taskId: task.id, title: task.title });

    return reply.status(201).send({
      success: true,
      data: task
    });
  });

  // Get Task by ID
  server.get('/api/v1/tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await taskRepo.findById(id);
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: `Task not found with id: ${id}`
      });
    }

    const plan = await planRepo.findByTaskId(id);
    const operations = await fileOpRepo.findByTaskId(id);

    return {
      success: true,
      data: {
        task,
        plan,
        operations
      }
    };
  });

  // Parse Task
  server.post('/api/v1/tasks/parse', async (request, reply) => {
    const parse = ParseTaskRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parse.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { projectId, markdown, taskId } = parse.data;

    // Dual-mode: if projectId and markdown are provided, run the deterministic parser
    if (projectId && markdown !== undefined) {
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: ErrorCode.NOT_FOUND,
          message: 'Project not found'
        });
      }

      let existingFiles: string[] = [];
      try {
        const scanned = await fileEngine.scanProject(project.path);
        existingFiles = scanned.filter((f) => !f.isDirectory).map((f) => f.relativePath);
      } catch {
        // Project directory may be empty or not yet created
      }

      const manifest = parseInstructions(markdown, { existingFiles });

      if (taskId) {
        const task = await taskRepo.findById(taskId);
        if (task) {
          await taskRepo.updateStatus(taskId, 'PARSED');
          broadcaster.broadcast('task:parsed', { taskId });
        }
      }

      return {
        success: true,
        data: manifest
      };
    }

    // Legacy mode: { taskId } only
    if (taskId) {
      const task = await taskRepo.findById(taskId);
      if (!task) {
        return reply.status(404).send({
          success: false,
          error: ErrorCode.NOT_FOUND,
          message: 'Task not found'
        });
      }

      await taskRepo.updateStatus(taskId, 'PARSED');
      broadcaster.broadcast('task:parsed', { taskId });

      return {
        success: true,
        data: { task: { ...task, status: 'PARSED' } }
      };
    }

    return reply.status(400).send({
      success: false,
      error: ErrorCode.VALIDATION_ERROR,
      message: 'Either { projectId, markdown } or { taskId } is required'
    });
  });

  // Plan Task
  server.post('/api/v1/tasks/plan', async (request, reply) => {
    const parse = PlanTaskRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parse.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { projectId, manifest, taskId: bodyTaskId } = parse.data;

    // Dual-mode: if projectId and manifest are provided, convert manifest into FileOperations
    if (projectId && manifest) {
      const project = await projectRepo.findById(projectId);
      if (!project) {
        return reply.status(404).send({
          success: false,
          error: ErrorCode.NOT_FOUND,
          message: 'Project not found'
        });
      }

      let task = bodyTaskId ? await taskRepo.findById(bodyTaskId) : null;
      if (bodyTaskId && !task) {
        return reply.status(404).send({
          success: false,
          error: ErrorCode.NOT_FOUND,
          message: 'Task not found'
        });
      }

      if (!task) {
        task = await taskRepo.create({
          projectId: project.id,
          title: `Plan generated on ${new Date().toLocaleDateString()}`,
          inputType: 'TEXT'
        });
      }

      const currentTaskId = task.id;
      let plan = await planRepo.findByTaskId(currentTaskId);
      if (!plan) {
        plan = await planRepo.create({ taskId: currentTaskId, totalOperations: 0 });
      }

      const operationsToCreate: Array<{
        planId: string;
        taskId: string;
        operationType: string;
        relativePath: string;
        targetPath?: string | null;
        content?: string | null;
        previousContent?: string | null;
      }> = [];

      // 1. Folders -> MKDIR operations
      if (manifest.folders && Array.isArray(manifest.folders)) {
        for (const rawFolder of manifest.folders) {
          const normalized = rawFolder
            .replace(/\\/g, '/')
            .replace(/^\.\//, '')
            .replace(/[/\\]+$/, '')
            .trim();
          if (normalized) {
            operationsToCreate.push({
              planId: plan.id,
              taskId: currentTaskId,
              operationType: 'MKDIR',
              relativePath: normalized,
              targetPath: null,
              content: null,
              previousContent: null
            });
          }
        }
      }

      // 2. Files -> CREATE / UPDATE operations
      if (manifest.files && Array.isArray(manifest.files)) {
        for (const file of manifest.files) {
          const normalizedPath = file.path
            .replace(/\\/g, '/')
            .replace(/^\.\//, '')
            .trim();
          if (!normalizedPath) continue;

          const fullFilePath = path.resolve(project.path, normalizedPath);
          let existsOnDisk = false;
          let previousContent: string | null = null;

          try {
            if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).isFile()) {
              existsOnDisk = true;
              previousContent = fs.readFileSync(fullFilePath, 'utf8');
            }
          } catch {
            existsOnDisk = false;
          }

          operationsToCreate.push({
            planId: plan.id,
            taskId: currentTaskId,
            operationType: existsOnDisk ? 'UPDATE' : 'CREATE',
            relativePath: normalizedPath,
            targetPath: null,
            content: file.content,
            previousContent
          });
        }
      }

      const createdOperations = await fileOpRepo.createMany(operationsToCreate);

      await planRepo.updateStatus(plan.id, 'READY');
      await taskRepo.updateStatus(currentTaskId, 'PLANNED');
      broadcaster.broadcast('task:planned', { taskId: currentTaskId, planId: plan.id });

      return {
        success: true,
        data: {
          planId: plan.id,
          operations: createdOperations
        }
      };
    }

    // Legacy mode: { taskId } only
    if (bodyTaskId) {
      const task = await taskRepo.findById(bodyTaskId);
      if (!task) {
        return reply.status(404).send({
          success: false,
          error: ErrorCode.NOT_FOUND,
          message: 'Task not found'
        });
      }

      let plan = await planRepo.findByTaskId(bodyTaskId);
      if (!plan) {
        plan = await planRepo.create({ taskId: bodyTaskId, totalOperations: 0 });
      }

      await taskRepo.updateStatus(bodyTaskId, 'PLANNED');
      broadcaster.broadcast('task:planned', { taskId: bodyTaskId, planId: plan.id });

      return {
        success: true,
        data: { plan, operations: [] }
      };
    }

    return reply.status(400).send({
      success: false,
      error: ErrorCode.VALIDATION_ERROR,
      message: 'Either { projectId, manifest } or { taskId } is required'
    });
  });

  // Get Task Diff
  server.get('/api/v1/tasks/:id/diff', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await taskRepo.findById(id);
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Task not found'
      });
    }

    const project = task.projectId ? await projectRepo.findById(task.projectId) : null;
    const projectRoot = project ? project.path : process.cwd();

    const operations = await fileOpRepo.findByTaskId(id);
    const diffs = await Promise.all(
      operations.map(async (op) => {
        return fileEngine.getDiff(
          projectRoot,
          op.relativePath,
          op.content || '',
          op.id,
          op.operationType as any
        );
      })
    );

    return {
      success: true,
      data: diffs
    };
  });

  // Approve Task
  server.post('/api/v1/tasks/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { operationIds?: string[] }) || {};
    const task = await taskRepo.findById(id);
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Task not found'
      });
    }

    const operations = await fileOpRepo.findByTaskId(id);
    const toApprove = body.operationIds
      ? operations.filter((op) => body.operationIds?.includes(op.id))
      : operations;

    for (const op of toApprove) {
      await fileOpRepo.updateStatus(op.id, 'APPROVED');
    }

    await taskRepo.updateStatus(id, 'AWAITING_APPROVAL');
    broadcaster.broadcast('task:approved', {
      taskId: id,
      approvedCount: toApprove.length
    });

    return {
      success: true,
      message: `${toApprove.length} operations approved successfully`
    };
  });

  // Reject Task
  server.post('/api/v1/tasks/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { operationIds?: string[]; reason?: string }) || {};
    const task = await taskRepo.findById(id);
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Task not found'
      });
    }

    const operations = await fileOpRepo.findByTaskId(id);
    const toReject = body.operationIds
      ? operations.filter((op) => body.operationIds?.includes(op.id))
      : operations;

    for (const op of toReject) {
      await fileOpRepo.updateStatus(op.id, 'REJECTED', body.reason || 'Rejected by user');
    }

    if (!body.operationIds || body.operationIds.length === operations.length) {
      await taskRepo.updateStatus(id, 'CANCELLED', body.reason || 'Rejected by user');
    }

    broadcaster.broadcast('task:rejected', {
      taskId: id,
      rejectedCount: toReject.length
    });

    return {
      success: true,
      message: 'Operations rejected'
    };
  });

  // Execute Task
  server.post('/api/v1/tasks/:id/execute', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await taskRepo.findById(id);
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Task not found'
      });
    }

    if (!task.projectId) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: 'Task is not assigned to a project'
      });
    }

    const project = await projectRepo.findById(task.projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    const operations = await fileOpRepo.findByTaskId(id);
    // Execute approved or pending operations
    const executableOps = operations.filter((op) =>
      ['APPROVED', 'PENDING'].includes(op.status)
    );

    let executed = 0;
    let failed = 0;

    await taskRepo.updateStatus(id, 'EXECUTING');
    broadcaster.broadcast('task:executing', { taskId: id, total: executableOps.length });

    for (const op of executableOps) {
      try {
        await fileEngine.executeOperation({
          projectRoot: project.path,
          taskId: id,
          projectId: project.id,
          operationId: op.id,
          operationType: op.operationType as any,
          relativePath: op.relativePath,
          targetPath: op.targetPath,
          content: op.content,
          autoBackup: true
        });

        executed++;
        broadcaster.broadcast('operation:executed', {
          taskId: id,
          operationId: op.id,
          relativePath: op.relativePath
        });
      } catch (err) {
        failed++;
        broadcaster.broadcast('operation:failed', {
          taskId: id,
          operationId: op.id,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const finalStatus = failed > 0 ? 'FAILED' : 'COMPLETED';
    await taskRepo.updateStatus(
      id,
      finalStatus,
      failed > 0 ? `${failed} operations failed to execute` : null
    );

    broadcaster.broadcast('task:finished', { taskId: id, status: finalStatus, executed, failed });

    return {
      success: true,
      data: { executed, failed }
    };
  });

  // Rollback Task
  server.post('/api/v1/tasks/:id/rollback', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await taskRepo.findById(id);
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Task not found'
      });
    }

    if (!task.projectId) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: 'Task has no project attached'
      });
    }

    const project = await projectRepo.findById(task.projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project not found'
      });
    }

    const rollbackResult = await fileEngine.rollbackTask(project.path, id);
    broadcaster.broadcast('task:rolled_back', { taskId: id, restoredFiles: rollbackResult.restoredFiles });

    return {
      success: true,
      data: rollbackResult
    };
  });

  // Cancel Task
  server.post('/api/v1/tasks/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await taskRepo.findById(id);
    if (!task) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Task not found'
      });
    }

    await taskRepo.updateStatus(id, 'CANCELLED', 'Cancelled by user');
    broadcaster.broadcast('task:cancelled', { taskId: id });

    return {
      success: true,
      message: 'Task cancelled successfully'
    };
  });
}
