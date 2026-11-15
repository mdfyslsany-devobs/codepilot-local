/**
 * Validates parsed code blocks to ensure no file content is missing, blank,
 * placeholder-only, or orphaned without a file destination.
 *
 * Implements Master Technical Specification §5, Module 2 (Deterministic Instruction Parser), Stage 7 — Missing Content Detection.
 * Upholds the core principle: "Never silently invent missing source code."
 */

export type MissingContentIssueType =
  | 'empty_content'
  | 'whitespace_only'
  | 'placeholder'
  | 'orphan_block';

export interface MissingContentIssue {
  codeBlockIndex: number;
  filename: string | null;
  type: MissingContentIssueType;
  message: string;
  snippet?: string;
}

export interface ContentCheckBlock {
  codeBlockIndex: number;
  filename: string | null;
  content: string;
  language?: string | null;
}

export interface MissingContentDetectionResult {
  hasIssues: boolean;
  issues: MissingContentIssue[];
  validBlocks: ContentCheckBlock[];
}

/**
 * Explicit regex patterns identifying truncated code placeholders.
 * Lone `// TODO` comments are intentionally NOT flagged unless followed by `implement`.
 */
export const PLACEHOLDER_PATTERNS: RegExp[] = [
  // 1. `// TODO: implement` or `// TODO implement`
  /\/\/\s*TODO:?\s+implement/i,
  // 2. `// ... rest of code`, `// ... rest of the code`, `// ... remaining code`
  /\/\/\s*\.{3}\s*(?:rest of(?: the)? code|remaining code)/i,
  // 3. `// same as above`, `// same as before`
  /\/\/\s*same as (?:above|before)/i,
  // 4. A line consisting only of `...` or `// ...` or `# ...` (no other text)
  /^\s*(?:\.{3}|\/\/\s*\.{3}|#\s*\.{3})\s*$/m,
  // 5. `/* TODO */` with nothing else inside on that line
  /^\s*\/\*\s*TODO\s*\*\/\s*$/m
];

function formatSnippet(content: string): string {
  if (!content) {
    return '';
  }
  if (content.length <= 100) {
    return content;
  }
  return content.slice(0, 97) + '...';
}

/**
 * Validates candidate code blocks to detect empty, whitespace-only, placeholder,
 * or orphan code blocks.
 *
 * @param blocks - Code blocks to check
 * @returns MissingContentDetectionResult with issue list and verified valid blocks
 */
export function detectMissingContent(
  blocks: ContentCheckBlock[]
): MissingContentDetectionResult {
  if (!blocks || blocks.length === 0) {
    return {
      hasIssues: false,
      issues: [],
      validBlocks: []
    };
  }

  const issues: MissingContentIssue[] = [];
  const validBlocks: ContentCheckBlock[] = [];

  for (const block of blocks) {
    const blockIssues: MissingContentIssue[] = [];

    // Check orphan block (missing filename)
    if (block.filename === null || block.filename.trim().length === 0) {
      blockIssues.push({
        codeBlockIndex: block.codeBlockIndex,
        filename: null,
        type: 'orphan_block',
        message: 'Code block has no associated filename heading',
        snippet: formatSnippet(block.content)
      });
    }

    // Check content emptiness / whitespace / placeholder
    if (block.content.length === 0) {
      blockIssues.push({
        codeBlockIndex: block.codeBlockIndex,
        filename: block.filename,
        type: 'empty_content',
        message: 'Code block content is empty (zero-length)',
        snippet: ''
      });
    } else if (block.content.trim().length === 0) {
      blockIssues.push({
        codeBlockIndex: block.codeBlockIndex,
        filename: block.filename,
        type: 'whitespace_only',
        message: 'Code block contains only whitespace',
        snippet: formatSnippet(block.content)
      });
    } else {
      for (const pattern of PLACEHOLDER_PATTERNS) {
        if (pattern.test(block.content)) {
          blockIssues.push({
            codeBlockIndex: block.codeBlockIndex,
            filename: block.filename,
            type: 'placeholder',
            message: 'Code block contains incomplete code placeholder',
            snippet: formatSnippet(block.content)
          });
          break;
        }
      }
    }

    if (blockIssues.length === 0) {
      validBlocks.push(block);
    } else {
      issues.push(...blockIssues);
    }
  }

  return {
    hasIssues: issues.length > 0,
    issues,
    validBlocks
  };
}
