import { createHash, randomUUID } from 'node:crypto';
import { normalize, resolve, relative, isAbsolute } from 'node:path';

export function computeSha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function generateUuid(): string {
  return randomUUID();
}

/**
 * Normalizes a path to forward slashes for consistent multi-platform representation.
 */
export function normalizePath(p: string): string {
  return normalize(p).replace(/\\/g, '/');
}

/**
 * Validates that a target path is strictly inside an allowed base directory.
 * Returns true if valid, false if path traversal or outside root.
 */
export function isPathInside(baseDir: string, targetPath: string): boolean {
  const resolvedBase = resolve(baseDir);
  const resolvedTarget = resolve(targetPath);
  const rel = relative(resolvedBase, resolvedTarget);
  return !rel.startsWith('..') && !isAbsolute(rel);
}
