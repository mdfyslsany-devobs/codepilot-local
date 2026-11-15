import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { computeSha256 } from '@codepilot/shared';

/**
 * Computes the SHA-256 checksum of an existing file on disk.
 */
export async function computeFileChecksum(fullPath: string): Promise<string> {
  if (!existsSync(fullPath)) {
    throw new Error(`Cannot compute checksum for non-existent file: ${fullPath}`);
  }
  const buffer = await readFile(fullPath);
  return computeSha256(buffer);
}

/**
 * Verifies whether the file's current SHA-256 checksum matches the expected checksum.
 */
export async function verifyFileIntegrity(
  fullPath: string,
  expectedChecksum: string
): Promise<{ matches: boolean; actualChecksum: string }> {
  const actualChecksum = await computeFileChecksum(fullPath);
  return {
    matches: actualChecksum.toLowerCase() === expectedChecksum.toLowerCase(),
    actualChecksum
  };
}
