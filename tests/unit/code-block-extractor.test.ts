import { describe, it, expect } from 'vitest';
import { extractCodeBlocks } from '../../packages/instruction-parser/src/code-block-extractor.js';

describe('code-block-extractor', () => {
  it('should extract a markdown string with one ```html block', () => {
    const markdown = [
      '# Sample HTML',
      '```html',
      '<div>Hello World</div>',
      '```'
    ].join('\n');

    const result = extractCodeBlocks(markdown);
    expect(result).toEqual([
      {
        language: 'html',
        content: '<div>Hello World</div>'
      }
    ]);
  });

  it('should extract a markdown string with one ```css block', () => {
    const markdown = [
      '# Sample CSS',
      '```css',
      'body { color: red; }',
      '```'
    ].join('\n');

    const result = extractCodeBlocks(markdown);
    expect(result).toEqual([
      {
        language: 'css',
        content: 'body { color: red; }'
      }
    ]);
  });

  it('should extract a markdown string with one ```js block', () => {
    const markdown = [
      '# Sample JS',
      '```js',
      "console.log('hello');",
      '```'
    ].join('\n');

    const result = extractCodeBlocks(markdown);
    expect(result).toEqual([
      {
        language: 'js',
        content: "console.log('hello');"
      }
    ]);
  });

  it('should extract a markdown string with two code blocks of different languages', () => {
    const markdown = [
      'First code block:',
      '```html',
      '<h1>Title</h1>',
      '```',
      'Some text in between.',
      '```css',
      'h1 { font-size: 24px; }',
      '```'
    ].join('\n');

    const result = extractCodeBlocks(markdown);
    expect(result).toEqual([
      {
        language: 'html',
        content: '<h1>Title</h1>'
      },
      {
        language: 'css',
        content: 'h1 { font-size: 24px; }'
      }
    ]);
  });

  it('should extract a markdown string with a code block that has no language (should return language: null)', () => {
    const markdown = [
      '```',
      'plain text content',
      '```'
    ].join('\n');

    const result = extractCodeBlocks(markdown);
    expect(result).toEqual([
      {
        language: null,
        content: 'plain text content'
      }
    ]);
  });

  it('should return empty array for a markdown string with no code blocks', () => {
    const markdown = 'Just regular text without any code blocks.\nAnother line.';

    const result = extractCodeBlocks(markdown);
    expect(result).toEqual([]);
  });
});
