import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { ErrorCode } from '@codepilot/shared';
import { SecurityError } from './path-validator.js';

/**
 * Ensures that if a path or any of its parent directories is a symbolic link,
 * its target destination resolves strictly inside the authorized project root.
 */
export function verifySymlinkSafety(projectRoot: string, fullPath: string): void {
  const resolvedRoot = resolve(projectRoot);
  let currentPath = fullPath;

  while (currentPath.length >= resolvedRoot.length) {
    if (existsSync(currentPath)) {
      try {
        const stat = lstatSync(currentPath);
        if (stat.isSymbolicLink()) {
          const realTarget = realpathSync(currentPath);
          const rel = relative(resolvedRoot, realTarget);
          if (rel.startsWith('..') || isAbsolute(rel)) {
            throw new SecurityError(
              ErrorCode.FORBIDDEN,
              `Symbolic link '${currentPath}' points outside project root to '${realTarget}'`
            );
          }
        }
      } catch (err) {
        if (err instanceof SecurityError) throw err;
      }
    }

    const parent = dirname(currentPath);
    if (parent === currentPath) break;
    currentPath = parent;
  }
}
