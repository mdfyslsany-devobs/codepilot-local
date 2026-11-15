import { writeFile, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { validateSafePath } from '../security/path-validator.js';
import { verifySymlinkSafety } from '../security/symlink-guard.js';
import { createFolder } from './folder-creator.js';
import { computeSha256 } from '@codepilot/shared';

export interface FileWriteResult {
  fullPath: string;
  relativePath: string;
  checksum: string;
  byteSize: number;
}

export async function createFile(
  projectRoot: string,
  relativePath: string,
  content: string | Buffer
): Promise<FileWriteResult> {
  const { fullPath, safeRelativePath } = validateSafePath(projectRoot, relativePath);
  verifySymlinkSafety(projectRoot, fullPath);

  if (existsSync(fullPath)) {
    throw new Error(`File already exists at '${safeRelativePath}'. Use update operation instead of create.`);
  }

  const dir = dirname(fullPath);
  await createFolder(projectRoot, dirname(safeRelativePath));

  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const tempFile = join(dir, `.cp_tmp_${randomBytes(8).toString('hex')}`);

  try {
    await writeFile(tempFile, buffer);
    await rename(tempFile, fullPath);
  } catch (err) {
    if (existsSync(tempFile)) {
      try {
        await unlink(tempFile);
      } catch {
        // Ignore temporary file cleanup failure
      }
    }
    throw err;
  }

  return {
    fullPath,
    relativePath: safeRelativePath,
    checksum: computeSha256(buffer),
    byteSize: buffer.byteLength
  };
}
