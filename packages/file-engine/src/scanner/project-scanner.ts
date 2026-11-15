import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { normalizePath } from '@codepilot/shared';

export interface ScannedFileEntry {
  relativePath: string;
  name: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
}

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  '.codepilot-local',
  'dist',
  'build',
  '.cache',
  '.turbo'
]);

export async function scanProjectDirectory(
  projectRoot: string,
  options: {
    maxDepth?: number;
    ignoreDirs?: Set<string>;
  } = {}
): Promise<ScannedFileEntry[]> {
  const maxDepth = options.maxDepth ?? 20;
  const ignore = options.ignoreDirs ?? DEFAULT_IGNORE;
  const results: ScannedFileEntry[] = [];

  if (!existsSync(projectRoot)) {
    return results;
  }

  async function walk(currentDir: string, currentDepth: number) {
    if (currentDepth > maxDepth) return;

    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (ignore.has(entry.name)) {
        continue;
      }

      const fullPath = join(currentDir, entry.name);
      const relPath = normalizePath(relative(projectRoot, fullPath));

      try {
        const fileStat = await stat(fullPath);
        const isDir = entry.isDirectory();

        results.push({
          relativePath: relPath,
          name: entry.name,
          isDirectory: isDir,
          size: isDir ? 0 : fileStat.size,
          updatedAt: fileStat.mtime.toISOString()
        });

        if (isDir) {
          await walk(fullPath, currentDepth + 1);
        }
      } catch {
        // Skip unreadable files or broken links
      }
    }
  }

  await walk(projectRoot, 0);
  return results;
}
