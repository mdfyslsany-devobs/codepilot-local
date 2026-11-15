import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { validateSafePath } from '../security/path-validator.js';
import { verifySymlinkSafety } from '../security/symlink-guard.js';
import { computeSha256 } from '@codepilot/shared';

export interface FileUpdateResult {
  fullPath: string;
  relativePath: string;
  previousContent: string;
  previousChecksum: string;
  newChecksum: string;
  byteSize: number;
}

export async function updateFile(
  projectRoot: string,
  relativePath: string,
  newContent: string | Buffer
): Promise<FileUpdateResult> {
  const { fullPath, safeRelativePath } = validateSafePath(projectRoot, relativePath);
  verifySymlinkSafety(projectRoot, fullPath);

  if (!existsSync(fullPath)) {
    throw new Error(`File not found for update at '${safeRelativePath}'. Use create operation instead.`);
  }

  const previousBuffer = await readFile(fullPath);
  const previousContent = previousBuffer.toString('utf8');
  const previousChecksum = computeSha256(previousBuffer);

  const dir = dirname(fullPath);
  const newBuffer = Buffer.isBuffer(newContent) ? newContent : Buffer.from(newContent, 'utf8');
  const tempFile = join(dir, `.cp_tmp_${randomBytes(8).toString('hex')}`);

  try {
    await writeFile(tempFile, newBuffer);
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
    previousContent,
    previousChecksum,
    newChecksum: computeSha256(newBuffer),
    byteSize: newBuffer.byteLength
  };
}
