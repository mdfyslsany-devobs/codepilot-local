import { describe, it, expect } from 'vitest';
import { generateManifest } from '../../packages/instruction-parser/src/manifest-generator.js';

describe('manifest-generator (Phase 3 Step 7 — Stage 8)', () => {
  it('should generate a clean manifest for new project with no issues (Test Case 1)', () => {
    const input = {
      markdown: '# New Project\n```ts\nconsole.log(1);\n```',
      folders: ['src', 'src/components'],
      blocks: [
        { codeBlockIndex: 0, filename: 'src/index.ts', content: 'console.log(1);', language: 'ts' }
      ],
      existingFiles: []
    };

    const manifest = generateManifest(input);

    expect(manifest.version).toBe('1.0');
    expect(manifest.instructionsHash).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.createdAt).toBeDefined();
    expect(manifest.folders).toEqual(['src', 'src/components']);
    expect(manifest.files).toEqual([
      { path: 'src/index.ts', content: 'console.log(1);', language: 'ts', isNew: true }
    ]);
    expect(manifest.warnings).toEqual([]);
    expect(manifest.errors).toEqual([]);
  });

  it('should correctly compute isNew flag against existing project files (Test Case 2)', () => {
    const input = {
      markdown: '# Update',
      blocks: [
        { codeBlockIndex: 0, filename: 'index.html', content: '<h1>Hi</h1>', language: 'html' },
        { codeBlockIndex: 1, filename: 'styles.css', content: 'body {}', language: 'css' }
      ],
      existingFiles: ['index.html']
    };

    const manifest = generateManifest(input);

    expect(manifest.files).toEqual([
      { path: 'index.html', content: '<h1>Hi</h1>', language: 'html', isNew: false },
      { path: 'styles.css', content: 'body {}', language: 'css', isNew: true }
    ]);
  });

  it('should record Stage 6 duplicate file resolutions as warnings (Test Case 3)', () => {
    const input = {
      markdown: '# Duplicates',
      duplicateConflicts: [
        {
          filename: 'app.js',
          occurrences: [
            { codeBlockIndex: 0, contentLength: 5 },
            { codeBlockIndex: 1, contentLength: 9 }
          ],
          winnerBlockIndex: 1,
          reason: 'longest_content' as const
        }
      ],
      blocks: [
        { codeBlockIndex: 1, filename: 'app.js', content: 'alert(1);', language: 'js' }
      ]
    };

    const manifest = generateManifest(input);

    expect(manifest.warnings).toHaveLength(1);
    expect(manifest.warnings[0]).toMatchObject({
      code: 'DUPLICATE_FILE_RESOLVED',
      filename: 'app.js',
      codeBlockIndex: 1
    });
    expect(manifest.errors).toEqual([]);
    expect(manifest.files).toEqual([
      { path: 'app.js', content: 'alert(1);', language: 'js', isNew: true }
    ]);
  });

  it('should record Stage 7 issues as errors and exclude broken files (Test Case 4)', () => {
    const input = {
      markdown: '# Bad Code',
      contentIssues: [
        {
          type: 'placeholder' as const,
          codeBlockIndex: 0,
          filename: 'broken.ts',
          message: 'Contains placeholder'
        },
        {
          type: 'orphan_block' as const,
          codeBlockIndex: 1,
          filename: null,
          message: 'No filename'
        }
      ],
      blocks: [
        { codeBlockIndex: 0, filename: 'broken.ts', content: '// TODO implement', language: 'ts' }
      ]
    };

    const manifest = generateManifest(input);

    expect(manifest.errors).toHaveLength(2);
    expect(manifest.errors[0]).toMatchObject({
      code: 'PLACEHOLDER_CONTENT',
      filename: 'broken.ts',
      codeBlockIndex: 0
    });
    expect(manifest.errors[1]).toMatchObject({
      code: 'ORPHAN_BLOCK',
      filename: null,
      codeBlockIndex: 1
    });
    // The broken file should be excluded from executable files
    expect(manifest.files).toEqual([]);
  });

  it('should return a valid manifest without throwing when input has no files (Test Case 5)', () => {
    const input = {
      markdown: 'Just documentation notes with no code blocks.',
      folders: [],
      blocks: []
    };

    const manifest = generateManifest(input);

    expect(manifest.version).toBe('1.0');
    expect(manifest.files).toEqual([]);
    expect(manifest.folders).toEqual([]);
    expect(manifest.warnings).toEqual([]);
    expect(manifest.errors).toEqual([]);
  });
});
