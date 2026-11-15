import { describe, it, expect } from 'vitest';
import { detectDuplicateFiles } from '../../packages/instruction-parser/src/duplicate-detector.js';

describe('duplicate-detector (Phase 3 Step 5 — Stage 6)', () => {
  it('should return no duplicates for unique files (Test Case 1)', () => {
    const input = [
      { codeBlockIndex: 0, filename: 'index.html', content: '<div>Hello</div>', language: 'html' },
      { codeBlockIndex: 1, filename: 'style.css', content: 'body { margin: 0; }', language: 'css' }
    ];

    const result = detectDuplicateFiles(input);

    expect(result.hasDuplicates).toBe(false);
    expect(result.duplicates).toEqual([]);
    expect(result.deduplicated).toEqual([
      { codeBlockIndex: 0, filename: 'index.html', content: '<div>Hello</div>', language: 'html' },
      { codeBlockIndex: 1, filename: 'style.css', content: 'body { margin: 0; }', language: 'css' }
    ]);
  });

  it('should identify identical duplicate blocks and keep the first occurrence (Test Case 2)', () => {
    const input = [
      { codeBlockIndex: 0, filename: 'index.html', content: '<h1>Hello</h1>', language: 'html' },
      { codeBlockIndex: 1, filename: 'index.html', content: '<h1>Hello</h1>', language: 'html' }
    ];

    const result = detectDuplicateFiles(input);

    expect(result.hasDuplicates).toBe(true);
    expect(result.duplicates).toEqual([
      {
        filename: 'index.html',
        occurrences: [
          { codeBlockIndex: 0, contentLength: 14 },
          { codeBlockIndex: 1, contentLength: 14 }
        ],
        winnerBlockIndex: 0,
        reason: 'identical'
      }
    ]);
    expect(result.deduplicated).toEqual([
      { codeBlockIndex: 0, filename: 'index.html', content: '<h1>Hello</h1>', language: 'html' }
    ]);
  });

  it('should resolve conflicting duplicates by selecting the longest content (Test Case 3)', () => {
    const input = [
      { codeBlockIndex: 0, filename: 'script.js', content: "console.log('hi');", language: 'js' },
      {
        codeBlockIndex: 1,
        filename: 'script.js',
        content: "function main() {\n  console.log('hi');\n}\nmain();",
        language: 'js'
      }
    ];

    const result = detectDuplicateFiles(input);

    expect(result.hasDuplicates).toBe(true);
    expect(result.duplicates).toEqual([
      {
        filename: 'script.js',
        occurrences: [
          { codeBlockIndex: 0, contentLength: 18 },
          { codeBlockIndex: 1, contentLength: 48 }
        ],
        winnerBlockIndex: 1,
        reason: 'longest_content'
      }
    ]);
    expect(result.deduplicated).toEqual([
      {
        codeBlockIndex: 1,
        filename: 'script.js',
        content: "function main() {\n  console.log('hi');\n}\nmain();",
        language: 'js'
      }
    ]);
  });

  it('should resolve equal length conflicts using latest occurrence as tie-breaker (Test Case 4)', () => {
    const input = [
      { codeBlockIndex: 0, filename: 'config.json', content: '{"env":"dev"}', language: 'json' },
      { codeBlockIndex: 1, filename: 'config.json', content: '{"env":"prd"}', language: 'json' }
    ];

    const result = detectDuplicateFiles(input);

    expect(result.hasDuplicates).toBe(true);
    expect(result.duplicates).toEqual([
      {
        filename: 'config.json',
        occurrences: [
          { codeBlockIndex: 0, contentLength: 13 },
          { codeBlockIndex: 1, contentLength: 13 }
        ],
        winnerBlockIndex: 1,
        reason: 'latest_occurrence'
      }
    ]);
    expect(result.deduplicated).toEqual([
      { codeBlockIndex: 1, filename: 'config.json', content: '{"env":"prd"}', language: 'json' }
    ]);
  });

  it('should normalize paths when checking for duplicates (Test Case 5)', () => {
    const input = [
      { codeBlockIndex: 0, filename: 'src/App.tsx', content: 'export const App = () => 1;', language: 'tsx' },
      { codeBlockIndex: 1, filename: './src\\App.tsx', content: 'export const App = () => 2;', language: 'tsx' }
    ];

    const result = detectDuplicateFiles(input);

    expect(result.hasDuplicates).toBe(true);
    expect(result.duplicates[0]?.filename).toBe('src/App.tsx');
    expect(result.deduplicated).toEqual([
      { codeBlockIndex: 1, filename: 'src/App.tsx', content: 'export const App = () => 2;', language: 'tsx' }
    ]);
  });
});
