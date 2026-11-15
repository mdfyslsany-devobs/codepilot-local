import { describe, it, expect } from 'vitest';
import { detectFolderStructure } from '../../packages/instruction-parser/src/folder-structure-detector.js';

describe('folder-structure-detector (Phase 3 Step 3 — Stage 4)', () => {
  it('should detect folders from standard ASCII/Unicode tree diagram (Test Case 1)', () => {
    const markdown = [
      'Project structure:',
      '```',
      'src/',
      '├── components/',
      '│   └── App.tsx',
      '└── utils/',
      '    └── helper.ts',
      '```'
    ].join('\n');

    const result = detectFolderStructure(markdown);
    expect(result).toEqual(['src', 'src/components', 'src/utils']);
  });

  it('should detect folders from indented bullet list with directory slashes (Test Case 2)', () => {
    const markdown = [
      'Directory setup:',
      '- app/',
      '  - api/',
      '  - styles/',
      '- public/'
    ].join('\n');

    const result = detectFolderStructure(markdown);
    expect(result).toEqual(['app', 'app/api', 'app/styles', 'public']);
  });

  it('should exclude files and return only folders from mixed tree structure (Test Case 3)', () => {
    const markdown = [
      '```',
      '├── backend/',
      '│   ├── src/',
      '│   │   └── server.ts',
      '│   └── package.json',
      '└── README.md',
      '```'
    ].join('\n');

    const result = detectFolderStructure(markdown);
    expect(result).toEqual(['backend', 'backend/src']);
  });

  it('should handle duplicate and redundant paths cleanly (Test Case 4)', () => {
    const markdown = [
      'Create the following folders:',
      '- `src/controllers/`',
      '- `src/`',
      '- `src/controllers/`',
      '- `src/models/`'
    ].join('\n');

    const result = detectFolderStructure(markdown);
    expect(result).toEqual(['src', 'src/controllers', 'src/models']);
  });

  it('should return empty array for plain prose with no folder structure (Test Case 5)', () => {
    const markdown = [
      '# Overview',
      'Please write a function to calculate checksums. No new directories are needed.'
    ].join('\n');

    const result = detectFolderStructure(markdown);
    expect(result).toEqual([]);
  });
});
