export interface SmartExtractedFile {
  filename: string | null;
  content: string;
  language: string | null;
}

interface TreeFile {
  lineIndex: number;
  filename: string;
}

interface ExtractedBlock {
  startLine: number;
  endLine: number;
  content: string;
  language: string | null;
}

function cleanFilename(rawFilename: string): string | null {
  const filename = rawFilename
    .trim()
    .replace(/^[`'"]|[`'",:;]+$/g, '')
    .replace(/^\.\//, '');
  return filename && /[./\\]/.test(filename) ? filename : null;
}

function detectLabel(line: string): string | null {
  const patterns = [
    /^(?:\d+\.\s*)?File\s*\d*\s*:\s*(.+?)\s*$/i,
    /^\*\*([^*]+)\*\*\s*:?\s*$/,
    /^#{1,6}\s+(.+?)\s*$/,
    /^([.\w/-]+(?:\\[.\w/-]+)*\.[\w-]+)\s*:\s*$/
  ];

  for (const pattern of patterns) {
    const match = line.trim().match(pattern);
    if (match?.[1]) {
      const filename = cleanFilename(match[1]);
      if (filename) return filename;
    }
  }
  return null;
}

function detectContextFilename(context: string): string | null {
  const match = context.match(
    /\bhere\s+is\s+(?:your\s+|the\s+)?(html|css|javascript|js)\b/i
  );
  if (!match?.[1]) return null;

  switch (match[1].toLowerCase()) {
    case 'html':
      return 'index.html';
    case 'css':
      return 'style.css';
    case 'javascript':
    case 'js':
      return 'script.js';
    default:
      return null;
  }
}

function detectFilenameFromContent(content: string): string | null {
  const trimmed = content.trim();
  if (/^(?:<!doctype\s+html\b|<html\b)/i.test(trimmed)) return 'index.html';
  if (/\b(?:function\s*\(|const\b|addEventListener\b)/.test(trimmed)) {
    return 'script.js';
  }
  if (/\{[\s\S]*?\b[\w-]+\s*:\s*[^;}]+[;}]/.test(trimmed)) {
    return 'style.css';
  }
  return null;
}

function detectLanguage(content: string, filename: string | null, hint: string | null): string | null {
  if (hint) return hint;
  const extension = filename?.split(/[./\\]/).pop()?.split('.').pop()?.toLowerCase();
  if (extension && ['html', 'htm', 'css', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(extension)) {
    return extension === 'htm' ? 'html' : extension;
  }
  if (/^(?:<!doctype\s+html\b|<html\b)/i.test(content.trim())) return 'html';
  if (/\b(?:function\s*\(|const\b|addEventListener\b)/.test(content)) return 'js';
  if (/\{[\s\S]*?\b[\w-]+\s*:\s*[^;}]+[;}]/.test(content)) return 'css';
  return null;
}

function cleanTreePath(rawPath: string): string {
  return rawPath
    .replace(/[│├└─]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .trim();
}

function getTreeFiles(lines: string[]): TreeFile[] {
  const files: TreeFile[] = [];
  const directories: string[] = [];
  const treeLine =
    /^((?:(?:│| {4})\s{0,3})*)(?:├──|└──)\s*(.+?)\s*$/;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const match = lines[lineIndex]?.match(treeLine);
    if (match?.[1] === undefined || !match[2]) continue;

    const depth = Math.floor(match[1].length / 4);
    const isDirectory = /\/\s*$/.test(match[2]);
    const entry = cleanTreePath(match[2]);
    directories.length = depth;
    if (isDirectory) {
      directories[depth] = entry;
    } else {
      const filename = cleanTreePath([...directories.slice(0, depth), entry].join('/'));
      files.push({ lineIndex, filename });
    }
  }
  return files;
}

function deduplicateByBasename(files: SmartExtractedFile[]): SmartExtractedFile[] {
  const result: SmartExtractedFile[] = [];
  const indexesByBasename = new Map<string, number>();

  for (const file of files) {
    if (!file.filename) {
      result.push(file);
      continue;
    }

    const basename = file.filename.replace(/\\/g, '/').split('/').pop()?.toLowerCase();
    if (!basename) {
      result.push(file);
      continue;
    }

    const existingIndex = indexesByBasename.get(basename);
    if (existingIndex === undefined) {
      indexesByBasename.set(basename, result.length);
      result.push(file);
      continue;
    }

    const existing = result[existingIndex];
    if (!existing?.filename) continue;

    const pathSource =
      file.filename.length > existing.filename.length ? file : existing;
    const contentSource =
      file.content.length > existing.content.length ? file : existing;

    result[existingIndex] = {
      filename: pathSource.filename,
      content: contentSource.content,
      language: contentSource.language ?? pathSource.language
    };
  }

  return result;
}

function isCodeStart(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^<!doctype\s+html\b/i.test(trimmed) ||
    /<\/?[a-z][\w:-]*(?:\s|>|\/)/i.test(trimmed) ||
    /^(?:[.#]?[\w-]+\s*)\{/.test(trimmed) ||
    /\{[^}]*\b[\w-]+\s*:\s*[^}]+}/.test(trimmed) ||
    /\b(?:function\s*\(|const\b|let\b|var\b|addEventListener\b)/.test(trimmed)
  );
}

function isCodeLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    /^(?:<\/?[a-z][\w:-]*|<!doctype\b)/i.test(trimmed) ||
    /^(?:[.#]?[\w-]+\s*)\{/.test(trimmed) ||
    /^(?:[\w-]+\s*:|[{});,]|\/\/|\/\*|\*\/)/.test(trimmed) ||
    /\b(?:function\b|const\b|let\b|var\b|return\b|addEventListener\b|=>)/.test(trimmed) ||
    /^[\w$.]+\s*(?:=|\(|\.|\+\+|--)/.test(trimmed) ||
    /^[\s]*(?:[}\]);]|<\/)/.test(line)
  );
}

function collectPlainBlock(lines: string[], startLine: number): ExtractedBlock {
  const contentLines: string[] = [];
  let endLine = startLine;
  let braceDepth = 0;
  let sawOpeningBrace = false;
  const firstLine = lines[startLine] ?? '';
  const isHtml = /<\s*(?:!doctype|html)\b/i.test(firstLine);

  for (let index = startLine; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (index > startLine && (detectLabel(line) || line.includes('```') || isTreeLine(line))) {
      break;
    }
    if (index > startLine && !isCodeLine(line)) break;

    contentLines.push(line);
    endLine = index;
    for (const character of line) {
      if (character === '{') {
        braceDepth++;
        sawOpeningBrace = true;
      } else if (character === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      }
    }

    if (isHtml && /<\/html\s*>/i.test(line)) break;
    if (sawOpeningBrace && braceDepth === 0) break;
  }

  return { startLine, endLine, content: contentLines.join('\n').trim(), language: null };
}

function isTreeLine(line: string): boolean {
  return /^\s*(?:(?:│\s{3}| {4})*)(?:├──|└──)\s*.+$/.test(line);
}

function findBlocks(lines: string[]): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const fence = line.trimStart().match(/^```([^\s`]*)/);
    if (fence) {
      const contentLines: string[] = [];
      const startLine = index;
      const language = fence[1]?.trim() || null;
      index++;
      while (index < lines.length && lines[index]?.trim() !== '```') {
        contentLines.push(lines[index] ?? '');
        index++;
      }
      const endLine = index;
      if (index < lines.length) index++;
      blocks.push({
        startLine,
        endLine,
        content: contentLines.join('\n'),
        language
      });
      continue;
    }

    if (isCodeStart(line)) {
      const block = collectPlainBlock(lines, index);
      blocks.push(block);
      index = block.endLine + 1;
      continue;
    }
    index++;
  }
  return blocks;
}

export function smartExtract(markdown: string): SmartExtractedFile[] {
  if (!markdown.trim()) return [];

  const lines = markdown.split(/\r?\n/);
  const treeFiles = getTreeFiles(lines);
  const blocks = findBlocks(lines);
  const results: SmartExtractedFile[] = [];
  let contextStartLine = 0;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    if (!block) continue;

    const treeFile = treeFiles[blockIndex]?.filename ?? null;
    const contextLines = lines.slice(contextStartLine, block.startLine);
    const precedingLabel = contextLines
      .slice()
      .reverse()
      .map(detectLabel)
      .find((filename): filename is string => filename !== null) ?? null;
    const context = contextLines.join('\n');
    const filename =
      treeFile ??
      precedingLabel ??
      detectContextFilename(context) ??
      detectFilenameFromContent(block.content);

    results.push({
      filename,
      content: block.content,
      language: detectLanguage(block.content, filename, block.language)
    });
    contextStartLine = block.endLine + 1;
  }

  for (const treeFile of treeFiles.slice(blocks.length)) {
    results.push({
      filename: treeFile.filename,
      content: '',
      language: detectLanguage('', treeFile.filename, null)
    });
  }

  const deduplicated = deduplicateByBasename(results);
  const namedFiles = deduplicated.filter((file) => file.filename !== null);

  return namedFiles.length > 0 ? namedFiles : deduplicated;
}
