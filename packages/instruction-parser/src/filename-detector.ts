/**
 * Detects target filenames from context lines immediately above code blocks.
 *
 * Implements Master Technical Specification §5, Module 2 (Deterministic Instruction Parser), Stage 3 — File Path Detection.
 */

const KNOWN_EXTENSIONS = new Set([
  'html',
  'css',
  'js',
  'ts',
  'tsx',
  'jsx',
  'json',
  'md',
  'php',
  'py'
]);

function extractFilename(rawLine: string): string | null {
  let line = rawLine.trim();
  if (!line) {
    return null;
  }

  // 1. Strip markdown heading hashes (e.g. `### index.html`, `# script.js`)
  line = line.replace(/^#+\s*/, '').trim();

  // 2. Strip bold, italic, or backtick wrappers (e.g. `**style.css**`, `` `script.js` ``)
  line = line.replace(/^(\*\*|__|`)(.*?)\1$/, '$2').trim();

  // 3. Optional prefix label like "File: index.html" or "Filename: index.html"
  line = line.replace(/^(?:file|filename):\s*/i, '').trim();

  // Filenames should not contain spaces (which indicate prose / descriptive text)
  if (!line || /\s/.test(line)) {
    return null;
  }

  // Check for known file extension
  const extMatch = line.match(/\.([a-zA-Z0-9]+)$/);
  if (!extMatch) {
    return null;
  }

  const ext = extMatch[1]?.toLowerCase();
  if (ext && KNOWN_EXTENSIONS.has(ext)) {
    return line;
  }

  return null;
}

/**
 * Detects filename for a code block from context lines preceding it.
 *
 * @param markdown - Full markdown content
 * @param codeBlockIndex - 0-based index of the target code block
 * @returns Detected filename or null
 */
export function detectFilenameFromContext(
  markdown: string,
  codeBlockIndex: number
): string | null {
  if (codeBlockIndex < 0 || !markdown) {
    return null;
  }

  const lines = markdown.split(/\r?\n/);
  let currentBlockIndex = -1;
  let targetBlockStartLine = -1;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!inBlock) {
      const match = line.trimStart().match(/^```([^\s`]*)/);
      if (match) {
        inBlock = true;
        currentBlockIndex++;
        if (currentBlockIndex === codeBlockIndex) {
          targetBlockStartLine = i;
          break;
        }
      }
    } else {
      if (line.trim() === '```') {
        inBlock = false;
      }
    }
  }

  if (targetBlockStartLine === -1) {
    return null;
  }

  // Look at up to 3 non-empty lines ABOVE the opening fence
  let nonEmptyCount = 0;
  for (let i = targetBlockStartLine - 1; i >= 0 && nonEmptyCount < 3; i--) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    // Stop if encountering previous code block's fence
    if (trimmed.startsWith('```')) {
      break;
    }

    nonEmptyCount++;

    const filename = extractFilename(trimmed);
    if (filename) {
      return filename;
    }
  }

  return null;
}
