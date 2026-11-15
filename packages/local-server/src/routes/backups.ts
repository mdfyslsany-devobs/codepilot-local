import type { FastifyInstance } from 'fastify';
import type { BackupRepository, ProjectRepository } from '@codepilot/database';
import type { FileEngine } from '@codepilot/file-engine';
import { RestoreBackupRequestSchema, ErrorCode } from '@codepilot/shared';

export async function backupRoutes(
  server: FastifyInstance,
  opts: {
    backupRepo: BackupRepository;
    projectRepo: ProjectRepository;
    fileEngine: FileEngine;
  }
) {
  const { backupRepo, projectRepo, fileEngine } = opts;

  server.get('/api/v1/backups', async (request) => {
    const { taskId } = (request.query as { taskId?: string }) || {};
    if (taskId) {
      const list = await backupRepo.findByTaskId(taskId);
      return {
        success: true,
        data: list
      };
    }
    const recent = await backupRepo.listRecent(50);
    return {
      success: true,
      data: recent
    };
  });

  server.post('/api/v1/backups/restore', async (request, reply) => {
    const parse = RestoreBackupRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: parse.error.errors.map((e) => e.message).join(', ')
      });
    }

    const { backupId } = parse.data;
    const backup = await backupRepo.findById(backupId);
    if (!backup) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: `Backup not found with id: ${backupId}`
      });
    }

    const project = await projectRepo.findById(backup.projectId);
    if (!project) {
      return reply.status(404).send({
        success: false,
        error: ErrorCode.NOT_FOUND,
        message: 'Project associated with this backup not found'
      });
    }

    const result = await fileEngine.restoreFile(
      project.path,
      backup.filePath,
      backup.backupPath,
      backup.originalChecksum,
      backup.id
    );

    return {
      success: true,
      data: result,
      message: `File ${result.restoredPath} successfully restored from backup`
    };
  });
}
