import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { computeSha256 } from '@codepilot/shared';
import type { BackupRepository } from '@codepilot/database';
import { validateSafePath } from '../security/path-validator.js';
import { createFolder } from '../creator/folder-creator.js';
import { dirname } from 'node:path';

export class RestoreManager {
  constructor(private backupRepo?: BackupRepository) {}

  public async restoreFile(
    projectRoot: string,
    relativePath: string,
    backupFilePath: string,
    expectedChecksum?: string,
    backupId?: string
  ): Promise<{ restoredPath: string; checksum: string }> {
    if (!existsSync(backupFilePath)) {
      throw new Error(`Backup file does not exist at '${backupFilePath}'`);
    }

    const { fullPath, safeRelativePath } = validateSafePath(projectRoot, relativePath);
    const backupBuffer = await readFile(backupFilePath);
    const actualChecksum = computeSha256(backupBuffer);

    if (expectedChecksum && actualChecksum !== expectedChecksum) {
      throw new Error(
        `Backup file integrity check failed! Expected checksum ${expectedChecksum}, got ${actualChecksum}`
      );
    }

    await createFolder(projectRoot, dirname(safeRelativePath));
    await writeFile(fullPath, backupBuffer);

    if (backupId && this.backupRepo) {
      await this.backupRepo.markRestored(backupId);
    }

    return {
      restoredPath: safeRelativePath,
      checksum: actualChecksum
    };
  }

  public async rollbackTask(
    projectRoot: string,
    taskId: string
  ): Promise<{ restoredFiles: string[] }> {
    if (!this.backupRepo) {
      throw new Error('BackupRepository required to rollback task by taskId');
    }

    const backups = await this.backupRepo.findByTaskId(taskId);
    const restoredFiles: string[] = [];

    // Sort backups to restore in reverse order if multiple revisions exist
    for (const backup of backups) {
      await this.restoreFile(
        projectRoot,
        backup.filePath,
        backup.backupPath,
        backup.originalChecksum,
        backup.id
      );
      restoredFiles.push(backup.filePath);
    }

    return { restoredFiles };
  }
}
