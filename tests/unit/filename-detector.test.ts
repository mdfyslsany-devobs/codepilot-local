import { describe, it, expect } from 'vitest';
import { detectFilenameFromContext } from '../../packages/instruction-parser/src/filename-detector.js';

describe('filename-detector (Phase 3 Step 2 — Stage 3)', () => {
  it('should detect filename from markdown heading above code block (Test Case 1)', () => {
    const markdown = [
      '### index.html',
      '```html',
      '<!DOCTYPE html>',
      '```'
    ].join('\n');

    const result = detectFilenameFromContext(markdown, 0);
    expect(result).toBe('index.html');
  });

  it('should detect filename from bold markdown line above code block (Test Case 2)', () => {
    const markdown = [
      '**style.css**',
      '```css',
      'body { color: blue; }',
      '```'
    ].join('\n');

    const result = detectFilenameFromContext(markdown, 0);
    expect(result).toBe('style.css');
  });

  it('should detect filename from plain line above code block (Test Case 3)', () => {
    const markdown = [
      'script.js',
      '```js',
      "console.log('hello');",
      '```'
    ].join('\n');

    const result = detectFilenameFromContext(markdown, 0);
    expect(result).toBe('script.js');
  });

  it('should return correct filename for each block with multiple code blocks (Test Case 4)', () => {
    const markdown = [
      '### index.html',
      '```html',
      '<div>Hello</div>',
      '```',
      '',
      '**style.css**',
      '```css',
      'body { margin: 0; }',
      '```'
    ].join('\n');

    const result0 = detectFilenameFromContext(markdown, 0);
    const result1 = detectFilenameFromContext(markdown, 1);

    expect(result0).toBe('index.html');
    expect(result1).toBe('style.css');
  });

  it('should return null when no heading exists above the code block (Test Case 5)', () => {
    const markdown = [
      'Here is some introductory context without any file heading.',
      '```js',
      'const a = 1;',
      '```'
    ].join('\n');

    const result = detectFilenameFromContext(markdown, 0);
    expect(result).toBeNull();
  });

  it('should return null when heading has no valid extension (Test Case 6)', () => {
    const markdown = [
      '### Introduction',
      '```js',
      'const b = 2;',
      '```'
    ].join('\n');

    const result = detectFilenameFromContext(markdown, 0);
    expect(result).toBeNull();
  });
});
