import { mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { validateSafePath } from '../security/path-validator.js';
import { verifySymlinkSafety } from '../security/symlink-guard.js';

export async function createFolder(projectRoot: string, relativePath: string): Promise<string> {
  const { fullPath } = validateSafePath(projectRoot, relativePath);
  verifySymlinkSafety(projectRoot, fullPath);

  if (existsSync(fullPath)) {
    const stat = statSync(fullPath);
    if (!stat.isDirectory()) {
      throw new Error(`Target path exists and is not a directory: ${relativePath}`);
    }
    return fullPath;
  }

  await mkdir(fullPath, { recursive: true });
  return fullPath;
}
