import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { computeSha256 } from '@codepilot/shared';
import type { BackupRepository } from '@codepilot/database';
import { validateSafePath } from '../security/path-validator.js';

export class BackupManager {
  constructor(
    private backupRepo?: BackupRepository,
    private customBackupBaseDir?: string
  ) {}

  public async createBackup(
    projectRoot: string,
    relativePath: string,
    taskId: string,
    projectId: string
  ): Promise<{
    backupId: string;
    filePath: string;
    backupPath: string;
    checksum: string;
  }> {
    const { fullPath, safeRelativePath } = validateSafePath(projectRoot, relativePath);

    if (!existsSync(fullPath)) {
      throw new Error(`Cannot backup non-existent file: ${relativePath}`);
    }

    const contentBuffer = await readFile(fullPath);
    const checksum = computeSha256(contentBuffer);

    const baseBackupDir =
      this.customBackupBaseDir || join(projectRoot, '.codepilot-local', 'backups');
    const taskBackupDir = join(baseBackupDir, taskId);

    // Formulate a unique backup filename preserving extension
    const timestamp = Date.now();
    const safeName = safeRelativePath.replace(/[/\\:]/g, '_');
    const backupFileName = `${timestamp}_${checksum.substring(0, 8)}_${safeName}`;
    const destinationBackupPath = join(taskBackupDir, backupFileName);

    await mkdir(dirname(destinationBackupPath), { recursive: true });
    await writeFile(destinationBackupPath, contentBuffer);

    let backupId = `${taskId}_${timestamp}`;
    if (this.backupRepo) {
      const record = await this.backupRepo.create({
        taskId,
        projectId,
        filePath: safeRelativePath,
        backupPath: destinationBackupPath,
        originalChecksum: checksum
      });
      backupId = record.id;
    }

    return {
      backupId,
      filePath: safeRelativePath,
      backupPath: destinationBackupPath,
      checksum
    };
  }
}
