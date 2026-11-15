import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { BackupRepository, FileOperationRepository } from '@codepilot/database';
import { validateSafePath } from './security/path-validator.js';
import { verifySymlinkSafety } from './security/symlink-guard.js';
import { createFile } from './creator/file-creator.js';
import { createFolder } from './creator/folder-creator.js';
import { updateFile } from './updater/file-updater.js';
import { moveFile, copyFile, renameFile, deleteFile } from './mover/file-mover.js';
import { generateDiff } from './updater/diff-generator.js';
import { BackupManager } from './backup/backup-manager.js';
import { RestoreManager } from './restore/restore-manager.js';
import { scanProjectDirectory, type ScannedFileEntry } from './scanner/project-scanner.js';
import { computeFileChecksum, verifyFileIntegrity } from './security/integrity-checker.js';
import { checkOperationApproval } from './approval/approval-guard.js';
import type { OperationDiff } from '@codepilot/shared';

export interface ExecuteOperationParams {
  projectRoot: string;
  taskId: string;
  projectId: string;
  operationId?: string;
  operationType: 'CREATE' | 'UPDATE' | 'MOVE' | 'COPY' | 'RENAME' | 'DELETE' | 'MKDIR';
  relativePath: string;
  targetPath?: string | null;
  content?: string | null;
  autoBackup?: boolean;
  isApproved?: boolean;
}

export interface ExecuteOperationResult {
  operationType: string;
  relativePath: string;
  targetPath?: string | null;
  success: boolean;
  backupId?: string;
  checksum?: string;
  diff?: OperationDiff;
}

export class FileEngine {
  private backupManager: BackupManager;
  private restoreManager: RestoreManager;

  constructor(
    backupRepo?: BackupRepository,
    private fileOpRepo?: FileOperationRepository
  ) {
    this.backupManager = new BackupManager(backupRepo);
    this.restoreManager = new RestoreManager(backupRepo);
  }

  public async readFile(projectRoot: string, relativePath: string): Promise<string> {
    const { fullPath } = validateSafePath(projectRoot, relativePath);
    verifySymlinkSafety(projectRoot, fullPath);
    const buf = await readFile(fullPath);
    return buf.toString('utf8');
  }

  public fileExists(projectRoot: string, relativePath: string): boolean {
    try {
      const { fullPath } = validateSafePath(projectRoot, relativePath);
      return existsSync(fullPath);
    } catch {
      return false;
    }
  }

  public async getChecksum(projectRoot: string, relativePath: string): Promise<string> {
    const { fullPath } = validateSafePath(projectRoot, relativePath);
    return computeFileChecksum(fullPath);
  }

  public async verifyIntegrity(
    projectRoot: string,
    relativePath: string,
    expectedChecksum: string
  ): Promise<{ matches: boolean; actualChecksum: string }> {
    const { fullPath } = validateSafePath(projectRoot, relativePath);
    return verifyFileIntegrity(fullPath, expectedChecksum);
  }

  public async getDiff(
    projectRoot: string,
    relativePath: string,
    proposedContent: string,
    operationId: string = 'preview',
    operationType: 'CREATE' | 'UPDATE' | 'MOVE' | 'COPY' | 'RENAME' | 'DELETE' | 'MKDIR' = 'UPDATE'
  ): Promise<OperationDiff> {
    let originalContent = '';
    if (this.fileExists(projectRoot, relativePath)) {
      try {
        originalContent = await this.readFile(projectRoot, relativePath);
      } catch {
        originalContent = '';
      }
    }

    return generateDiff(
      operationId,
      relativePath,
      operationType,
      'PENDING',
      originalContent,
      proposedContent
    );
  }

  public async scanProject(projectRoot: string): Promise<ScannedFileEntry[]> {
    return scanProjectDirectory(projectRoot);
  }

  public async executeOperation(params: ExecuteOperationParams): Promise<ExecuteOperationResult> {
    const {
      projectRoot,
      taskId,
      projectId,
      operationId,
      operationType,
      relativePath,
      targetPath,
      content,
      autoBackup = true,
      isApproved = false
    } = params;

    const fileAlreadyExists = this.fileExists(projectRoot, relativePath);

    // Enforce Approval System rules before touching filesystem
    checkOperationApproval({
      operationType,
      fileExists: fileAlreadyExists,
      isApproved
    });

    let backupId: string | undefined;

    try {
      // 1. Automatic backup before modifying or deleting existing files
      if (
        autoBackup &&
        (operationType === 'UPDATE' || operationType === 'DELETE') &&
        fileAlreadyExists
      ) {
        const backupResult = await this.backupManager.createBackup(
          projectRoot,
          relativePath,
          taskId,
          projectId
        );
        backupId = backupResult.backupId;
      }

      let checksum: string | undefined;
      let diff: OperationDiff | undefined;

      // 2. Perform requested operation
      switch (operationType) {
        case 'CREATE': {
          const res = await createFile(projectRoot, relativePath, content || '');
          checksum = res.checksum;
          diff = generateDiff(operationId || 'op', relativePath, 'CREATE', 'EXECUTED', '', content || '');
          break;
        }
        case 'UPDATE': {
          const originalContent = fileAlreadyExists
            ? await this.readFile(projectRoot, relativePath)
            : '';
          const res = await updateFile(projectRoot, relativePath, content || '');
          checksum = res.newChecksum;
          diff = generateDiff(
            operationId || 'op',
            relativePath,
            'UPDATE',
            'EXECUTED',
            originalContent,
            content || ''
          );
          break;
        }
        case 'MKDIR': {
          await createFolder(projectRoot, relativePath);
          break;
        }
        case 'MOVE': {
          if (!targetPath) throw new Error('targetPath is required for MOVE operation');
          await moveFile(projectRoot, relativePath, targetPath);
          break;
        }
        case 'COPY': {
          if (!targetPath) throw new Error('targetPath is required for COPY operation');
          await copyFile(projectRoot, relativePath, targetPath);
          break;
        }
        case 'RENAME': {
          if (!targetPath) throw new Error('targetPath is required for RENAME operation');
          await renameFile(projectRoot, relativePath, targetPath);
          break;
        }
        case 'DELETE': {
          const originalContent = fileAlreadyExists
            ? await this.readFile(projectRoot, relativePath)
            : '';
          await deleteFile(projectRoot, relativePath);
          diff = generateDiff(operationId || 'op', relativePath, 'DELETE', 'EXECUTED', originalContent, '');
          break;
        }
        default:
          throw new Error(`Unsupported operation type: ${operationType}`);
      }

      // 3. Mark operation as executed in database if opId provided
      if (operationId && this.fileOpRepo) {
        await this.fileOpRepo.updateStatus(operationId, 'EXECUTED');
      }

      return {
        operationType,
        relativePath,
        targetPath,
        success: true,
        backupId,
        checksum,
        diff
      };
    } catch (err) {
      if (operationId && this.fileOpRepo) {
        await this.fileOpRepo.updateStatus(
          operationId,
          'FAILED',
          err instanceof Error ? err.message : String(err)
        );
      }
      throw err;
    }
  }

  public async restoreFile(
    projectRoot: string,
    relativePath: string,
    backupPath: string,
    expectedChecksum?: string,
    backupId?: string
  ) {
    return this.restoreManager.restoreFile(
      projectRoot,
      relativePath,
      backupPath,
      expectedChecksum,
      backupId
    );
  }

  public async rollbackTask(projectRoot: string, taskId: string) {
    return this.restoreManager.rollbackTask(projectRoot, taskId);
  }
}
