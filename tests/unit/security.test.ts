import { describe, it, expect } from 'vitest';
import { isPathInside, normalizePath, computeSha256, generateUuid } from '@codepilot/shared';
import { AuthManager } from '@codepilot/local-server';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Security Utilities & Auth Manager (Phase 1)', () => {
  it('should accurately detect path traversal and unauthorized escapes', () => {
    const base = 'C:/projects/myapp';

    expect(isPathInside(base, 'C:/projects/myapp/src/index.ts')).toBe(true);
    expect(isPathInside(base, 'C:/projects/myapp/sub/folder/file.txt')).toBe(true);
    expect(isPathInside(base, 'C:/projects/myapp/package.json')).toBe(true);

    // Traversal attempts
    expect(isPathInside(base, 'C:/projects/myapp/../secret.txt')).toBe(false);
    expect(isPathInside(base, 'C:/projects/otherapp/file.txt')).toBe(false);
    expect(isPathInside(base, 'C:/Windows/System32/calc.exe')).toBe(false);
  });

  it('should normalize paths consistently across operating systems', () => {
    expect(normalizePath('foo\\bar\\baz')).toBe('foo/bar/baz');
    expect(normalizePath('foo/bar/../baz')).toBe('foo/baz');
  });

  it('should compute deterministic SHA-256 hashes', () => {
    const hash1 = computeSha256('Hello World');
    const hash2 = computeSha256('Hello World');
    const hash3 = computeSha256('Different Content');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toBe('a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e');
  });

  it('should generate valid UUIDv4 strings', () => {
    const uuid1 = generateUuid();
    const uuid2 = generateUuid();
    expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(uuid1).not.toBe(uuid2);
  });

  it('should generate, persist, and validate local auth tokens', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'cp-test-auth-'));
    try {
      const auth1 = new AuthManager(tempDir);
      const token = auth1.getToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 random bytes as hex

      expect(auth1.validateToken(token)).toBe(true);
      expect(auth1.validateToken('invalid-token')).toBe(false);
      expect(auth1.validateToken('')).toBe(false);

      // Re-instantiate from the same data directory should load the same token
      const auth2 = new AuthManager(tempDir);
      expect(auth2.getToken()).toBe(token);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
