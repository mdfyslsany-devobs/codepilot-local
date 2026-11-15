import { resolve, normalize, relative, isAbsolute } from 'node:path';
import { ErrorCode } from '@codepilot/shared';

export class SecurityError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

const PROTECTED_SEGMENTS = ['.git', '.svn', '.hg'];

/**
 * Validates and normalizes a file path ensuring it strictly resides
 * within the approved project root directory.
 */
export function validateSafePath(projectRoot: string, relativePath: string): {
  safeRelativePath: string;
  fullPath: string;
} {
  if (!projectRoot || typeof projectRoot !== 'string') {
    throw new SecurityError(ErrorCode.BAD_REQUEST, 'Project root directory must be specified');
  }

  if (!relativePath || typeof relativePath !== 'string') {
    throw new SecurityError(ErrorCode.BAD_REQUEST, 'Relative path must be specified');
  }

  // Reject paths containing null bytes
  if (relativePath.includes('\0') || projectRoot.includes('\0')) {
    throw new SecurityError(ErrorCode.PATH_TRAVERSAL, 'Path contains invalid characters (null bytes)');
  }

  const normalizedRoot = resolve(projectRoot);
  // Normalize forward/backward slashes
  const cleanRelative = normalize(relativePath).replace(/^[\\/]+/, '');
  const targetFullPath = resolve(normalizedRoot, cleanRelative);

  // Check if target is inside project root
  const rel = relative(normalizedRoot, targetFullPath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new SecurityError(
      ErrorCode.PATH_TRAVERSAL,
      `Path traversal detected. '${relativePath}' resolves outside project root: '${projectRoot}'`
    );
  }

  // Check protected directory segments (e.g. .git)
  const segments = cleanRelative.split(/[\\/]/);
  for (const segment of segments) {
    if (PROTECTED_SEGMENTS.includes(segment.toLowerCase())) {
      throw new SecurityError(
        ErrorCode.FORBIDDEN,
        `Access to protected directory segment '${segment}' is strictly prohibited`
      );
    }
  }

  return {
    safeRelativePath: rel.replace(/\\/g, '/'),
    fullPath: targetFullPath
  };
}
