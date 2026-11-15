import { describe, it, expect } from 'vitest';
import { detectMissingContent } from '../../packages/instruction-parser/src/missing-content-detector.js';

describe('missing-content-detector (Phase 3 Step 6 — Stage 7)', () => {
  it('should accept clean and complete blocks with no issues (Test Case 1)', () => {
    const input = [
      { codeBlockIndex: 0, filename: 'index.html', content: '<div>Hello World</div>', language: 'html' },
      { codeBlockIndex: 1, filename: 'style.css', content: 'body { color: red; }', language: 'css' }
    ];

    const result = detectMissingContent(input);

    expect(result.hasIssues).toBe(false);
    expect(result.issues).toEqual([]);
    expect(result.validBlocks).toEqual(input);
  });

  it('should flag zero-length empty content as empty_content (Test Case 2)', () => {
    const input = [
      { codeBlockIndex: 0, filename: 'empty.js', content: '', language: 'js' }
    ];

    const result = detectMissingContent(input);

    expect(result.hasIssues).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      codeBlockIndex: 0,
      filename: 'empty.js',
      type: 'empty_content',
      snippet: ''
    });
    expect(result.validBlocks).toEqual([]);
  });

  it('should flag whitespace-only content as whitespace_only (Test Case 3)', () => {
    const input = [
      { codeBlockIndex: 0, filename: 'blank.ts', content: '   \n\t  \n  ', language: 'ts' }
    ];

    const result = detectMissingContent(input);

    expect(result.hasIssues).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      codeBlockIndex: 0,
      filename: 'blank.ts',
      type: 'whitespace_only'
    });
    expect(result.validBlocks).toEqual([]);
  });

  it('should flag truncation placeholder comments as placeholder (Test Case 4)', () => {
    const input = [
      {
        codeBlockIndex: 0,
        filename: 'server.ts',
        content: 'import express from "express";\n// ... rest of code same as above ...\nexport default app;',
        language: 'ts'
      }
    ];

    const result = detectMissingContent(input);

    expect(result.hasIssues).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      codeBlockIndex: 0,
      filename: 'server.ts',
      type: 'placeholder'
    });
    expect(result.issues[0]?.snippet?.length).toBeLessThanOrEqual(100);
    expect(result.validBlocks).toEqual([]);
  });

  it('should flag code block without filename as orphan_block (Test Case 5)', () => {
    const input = [
      { codeBlockIndex: 0, filename: null, content: 'console.log("orphan snippet");', language: 'js' }
    ];

    const result = detectMissingContent(input);

    expect(result.hasIssues).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      codeBlockIndex: 0,
      filename: null,
      type: 'orphan_block'
    });
    expect(result.validBlocks).toEqual([]);
  });
});
