import type { FastifyInstance } from 'fastify';
import type { ProjectRepository } from '@codepilot/database';
import type { FileEngine } from '@codepilot/file-engine';
import { CreateProjectSchema, ErrorCode, normalizePath } from '@codepilot/shared';
import { existsSync, statSync } from 'node:fs';

export async function projectRoutes(
  server: FastifyInstance,
  opts: { projectRepo: ProjectRepository; fileEngine: FileEngine }
) {
  const { projectRepo, fileEngine } = opts;

  server.get('/api/v1/projects', async () => {
    const list = await projectRepo.listAll();
    return {
      success: true,
      data: list
    };
  });

  server.post('/api/v1/projects', async (request, reply) => {
    const parseResult = CreateProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parseResult.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { name, path: rawPath, description } = parseResult.data;
    const normalized = normalizePath(rawPath);

    if (!existsSync(normalized)) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: `Project directory does not exist: ${normalized}`
      });
    }

    const stats = statSync(normalized);
    if (!stats.isDirectory()) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.BAD_REQUEST,
        message: `Project path is not a directory: ${normalized}`
      });
    }

    const existing = await projectRepo.findByPath(normalized);
    if (existing) {
      return reply.status(200).send({
        success: true,
        data: existing,
        message: 'Project already registered'
      });
    }

    const created = await projectRepo.create({
      name,
      path: normalized,
      description
    });

    return reply.status(201).send({
      success: true,
      data: created
    });
  });

  server.get('/api/v1/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await projectRepo.findById(id);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: `Project not found with id: ${id}`
      });
    }
    return {
      success: true,
      data: project
    };
  });

  // Get project files (file explorer)
  server.get('/api/v1/projects/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = await projectRepo.findById(id);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: `Project not found with id: ${id}`
      });
    }

    const files = await fileEngine.scanProject(project.path);
    return {
      success: true,
      data: files
    };
  });
}
