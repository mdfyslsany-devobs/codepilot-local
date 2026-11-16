import { describe, expect, it } from 'vitest';
import { smartExtract } from '../../packages/instruction-parser/src/smart-extractor.js';

describe('smart-extractor', () => {
  it('extracts labeled files from messy unfenced text', () => {
    const result = smartExtract(
      '3. File 1: index.html\n<!DOCTYPE html>\n<html><body>Hello</body></html>\n4. File 2: css/style.css\nbody { color: red; }'
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      filename: 'index.html',
      content: expect.stringContaining('<!DOCTYPE html>')
    });
    expect(result[1]).toMatchObject({
      filename: 'css/style.css',
      content: 'body { color: red; }'
    });
  });

  it('associates a filename label with the next block across intervening prose', () => {
    const result = smartExtract(
      '3. File 1: index.html\n\nThe complete page source follows below.\n\n<!DOCTYPE html>\n<html><body>Hello</body></html>'
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe('index.html');
  });

  it('deduplicates matching basenames using the longer path and content', () => {
    const result = smartExtract(
      '**style.css**\nbody { color: red; }\n\nFile 2: css/style.css\nbody { color: red; margin: 0; }'
    );

    expect(result).toEqual([
      {
        filename: 'css/style.css',
        content: 'body { color: red; margin: 0; }',
        language: 'css'
      }
    ]);
  });

  it('builds nested file paths from a folder tree', () => {
    const result = smartExtract('├── index.html\n├── css/\n│   └── style.css');

    expect(result.map((file) => file.filename)).toEqual(['index.html', 'css/style.css']);
    expect(result.every((file) => !/[│├└─]/.test(file.filename ?? ''))).toBe(true);
    expect(result.map((file) => file.content)).toEqual(['', '']);
  });

  it('infers a filename from CSS context without a label', () => {
    const result = smartExtract('Here is your CSS:\nbody { color: red; }');

    expect(result).toEqual([
      {
        filename: 'style.css',
        content: 'body { color: red; }',
        language: 'css'
      }
    ]);
  });

  it('extracts plain text HTML without fences', () => {
    const result = smartExtract('<!DOCTYPE html>\n<html>\n<body>Hello</body>\n</html>');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      filename: 'index.html',
      language: 'html'
    });
    expect(result[0]?.content).toContain('<body>Hello</body>');
  });

  it('ignores orphan blocks when named files were extracted', () => {
    const result = smartExtract(
      '### index.html\n```html\n<!DOCTYPE html>\n<html><body>Hello</body></html>\n```\n\n```text\nSome unrelated text\n```\n\n```text\nMore unrelated text\n```'
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      filename: 'index.html',
      content: '<!DOCTYPE html>\n<html><body>Hello</body></html>'
    });
  });

  it('retains orphan blocks when no named files were extracted', () => {
    const result = smartExtract('```text\nSome unrelated text\n```');

    expect(result).toEqual([
      {
        filename: null,
        content: 'Some unrelated text',
        language: 'text'
      }
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(smartExtract('')).toEqual([]);
  });
});
