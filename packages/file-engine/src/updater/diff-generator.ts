import * as diff from 'diff';
import type { OperationDiff } from '@codepilot/shared';

export function isBinaryString(str: string): boolean {
  for (let i = 0; i < Math.min(str.length, 1024); i++) {
    if (str.charCodeAt(i) === 0) {
      return true;
    }
  }
  return false;
}

export function generateDiff(
  operationId: string,
  relativePath: string,
  operationType: 'CREATE' | 'UPDATE' | 'MOVE' | 'COPY' | 'RENAME' | 'DELETE' | 'MKDIR',
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED',
  originalContent: string = '',
  newContent: string = ''
): OperationDiff {
  const isBinary = isBinaryString(originalContent) || isBinaryString(newContent);

  if (isBinary) {
    return {
      operationId,
      relativePath,
      operationType,
      status,
      diffText: 'Binary file differences not displayed',
      additions: 0,
      deletions: 0,
      isBinary: true
    };
  }

  const patch = diff.createTwoFilesPatch(
    `a/${relativePath}`,
    `b/${relativePath}`,
    originalContent,
    newContent,
    'original',
    'proposed'
  );

  let additions = 0;
  let deletions = 0;

  const lines = patch.split('\n');
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  return {
    operationId,
    relativePath,
    operationType,
    status,
    diffText: patch,
    additions,
    deletions,
    isBinary: false
  };
}
