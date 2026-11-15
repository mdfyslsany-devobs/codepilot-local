import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createFile,
  updateFile,
  computeFileChecksum,
  verifyFileIntegrity
} from '@codepilot/file-engine';
import { computeSha256 } from '@codepilot/shared';

describe('Phase 2: SHA-256 Integrity Checker', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'cp-test-integrity-'));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('computes accurate SHA-256 for files on disk', async () => {
    const content = 'Integrity test payload';
    const expectedHash = computeSha256(content);

    const { fullPath } = await createFile(tempRoot, 'data.txt', content);
    const diskHash = await computeFileChecksum(fullPath);

    expect(diskHash).toBe(expectedHash);
  });

  it('verifies integrity matches when file is unaltered', async () => {
    const content = 'Unchanged content';
    const hash = computeSha256(content);
    const { fullPath } = await createFile(tempRoot, 'pristine.txt', content);

    const check = await verifyFileIntegrity(fullPath, hash);
    expect(check.matches).toBe(true);
    expect(check.actualChecksum).toBe(hash);
  });

  it('detects tampering or modifications when file content is altered', async () => {
    const original = 'Pristine Version 1';
    const originalHash = computeSha256(original);
    const { fullPath } = await createFile(tempRoot, 'file.txt', original);

    // Tamper with the file
    await updateFile(tempRoot, 'file.txt', 'Tampered Version 2');

    const check = await verifyFileIntegrity(fullPath, originalHash);
    expect(check.matches).toBe(false);
    expect(check.actualChecksum).not.toBe(originalHash);
  });

  it('throws error when computing checksum for missing file', async () => {
    await expect(computeFileChecksum(join(tempRoot, 'non-existent.txt'))).rejects.toThrow(
      /Cannot compute checksum/
    );
  });
});
