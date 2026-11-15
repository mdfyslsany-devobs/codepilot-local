import { describe, it, expect } from 'vitest';
import { isMainModule } from '@codepilot/local-server';
import { pathToFileURL } from 'node:url';

describe('Direct-Execution Entrypoint Guard (Regression Test)', () => {
  it('should match Windows-style backslash paths against file:/// URLs', () => {
    const windowsPath = 'C:\\xampp\\htdocs\\codepilot-local\\packages\\local-server\\dist\\index.js';
    const importMetaUrl = pathToFileURL(windowsPath).href;

    // Verify it matches the standard Windows file:/// URL format
    expect(importMetaUrl).toMatch(/^file:\/\/\/[A-Z]:\//i);

    expect(isMainModule(importMetaUrl, windowsPath)).toBe(true);
  });

  it('should verify exact user test case with drive letter and backslashes', () => {
    const metaUrl = 'file:///C:/xampp/htdocs/codepilot-local/packages/local-server/dist/index.js';
    const argv1 = 'C:\\xampp\\htdocs\\codepilot-local\\packages\\local-server\\dist\\index.js';

    expect(isMainModule(metaUrl, argv1)).toBe(true);
  });

  it('should return false when argv1 is undefined or does not match', () => {
    const metaUrl = 'file:///C:/xampp/htdocs/codepilot-local/packages/local-server/dist/index.js';

    expect(isMainModule(metaUrl, undefined)).toBe(false);
    expect(isMainModule(metaUrl, 'C:\\some\\other\\path.js')).toBe(false);
  });

  it('should work with forward slash relative or absolute paths', () => {
    const forwardPath = 'C:/xampp/htdocs/codepilot-local/packages/local-server/dist/index.js';
    const metaUrl = 'file:///C:/xampp/htdocs/codepilot-local/packages/local-server/dist/index.js';

    expect(isMainModule(metaUrl, forwardPath)).toBe(true);
  });
});
