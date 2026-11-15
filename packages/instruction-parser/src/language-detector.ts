/**
 * Detects and canonicalizes the programming/markup language of a code block
 * using filename extensions, fenced code block hints, and explicit content heuristics.
 *
 * Implements Master Technical Specification §5, Module 2 (Deterministic Instruction Parser), Stage 5 — Language Detection.
 */

export interface LanguageDetectionInput {
  content?: string | null;
  fencedHint?: string | null;
  filename?: string | null;
}

const EXTENSION_MAP: Record<string, string> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'ts',
  mts: 'ts',
  cts: 'ts',
  tsx: 'tsx',
  jsx: 'jsx',
  json: 'json',
  md: 'md',
  markdown: 'md',
  php: 'php',
  py: 'py',
  python: 'py'
};

const HINT_MAP: Record<string, string> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  javascript: 'js',
  js: 'js',
  node: 'js',
  mjs: 'js',
  cjs: 'js',
  typescript: 'ts',
  ts: 'ts',
  mts: 'ts',
  cts: 'ts',
  tsx: 'tsx',
  jsx: 'jsx',
  json: 'json',
  markdown: 'md',
  md: 'md',
  php: 'php',
  python: 'py',
  py: 'py'
};

function getExtension(filename: string): string | null {
  const normalized = filename.replace(/\\/g, '/').trim();
  const lastSegment = normalized.split('/').pop();
  if (!lastSegment || !lastSegment.includes('.')) {
    return null;
  }
  const ext = lastSegment.split('.').pop()?.toLowerCase();
  return ext || null;
}

function detectFromContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  // 1. php: content starts with <?php
  if (trimmed.startsWith('<?php')) {
    return 'php';
  }

  // 2. html: content starts with <!DOCTYPE html> or <html (case-insensitive, after trimming)
  const lowerTrimmed = trimmed.toLowerCase();
  if (lowerTrimmed.startsWith('<!doctype html>') || lowerTrimmed.startsWith('<html')) {
    return 'html';
  }

  // 3. json: content, after trimming, starts with { or [ and is valid JSON (try JSON.parse)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // not valid JSON, continue to other heuristics
    }
  }

  const lines = trimmed.split(/\r?\n/);

  // 4. py: content contains a line matching ^\s*def\s+\w+\s*\( or ^\s*import\s+\w+ or ^\s*from\s+\w+\s+import
  const pyPattern = /^\s*(?:def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import)/;
  if (lines.some((line) => pyPattern.test(line))) {
    return 'py';
  }

  // 5. css: content contains a line matching ^\s*[.#]?[\w-]+\s*\{ and does not contain < or function or def
  const cssPattern = /^\s*[.#]?[\w-]+\s*\{/;
  if (
    lines.some((line) => cssPattern.test(line)) &&
    !trimmed.includes('<') &&
    !trimmed.includes('function') &&
    !trimmed.includes('def ')
  ) {
    return 'css';
  }

  // 6. js/ts: content contains function , const , let , =>, or import 
  // (ts vs js: if content contains : type annotations or interface , classify as ts; otherwise js)
  const jsTokens = ['function ', 'const ', 'let ', '=>', 'import '];
  if (jsTokens.some((token) => trimmed.includes(token))) {
    if (trimmed.includes('interface ') || /:\s*[a-zA-Z_]/.test(trimmed)) {
      return 'ts';
    }
    return 'js';
  }

  // 7. md: content contains a line starting with # or ## or - or * and no code tokens
  const mdHeadingOrList = /^\s*(?:#{1,6}\s+|[-*]\s+)/;
  const hasMdTokens = lines.some((line) => mdHeadingOrList.test(line));
  const hasCodeTokens =
    trimmed.includes('function ') ||
    trimmed.includes('const ') ||
    trimmed.includes('let ') ||
    trimmed.includes('def ') ||
    trimmed.includes('<?php') ||
    trimmed.includes('class ') ||
    trimmed.includes('import ') ||
    trimmed.includes('=>') ||
    trimmed.includes('{') ||
    trimmed.includes(';');

  if (hasMdTokens && !hasCodeTokens) {
    return 'md';
  }

  return null;
}

/**
 * Detects the canonical language of a code block.
 *
 * Priority Order:
 * 1. Target filename extension
 * 2. Fenced language hint
 * 3. Explicit content heuristics
 *
 * @param input - Detection options (content, fencedHint, filename)
 * @returns Canonical language identifier or null if undetermined
 */
export function detectLanguage(input: LanguageDetectionInput): string | null {
  if (!input) {
    return null;
  }

  // Priority 1: Filename extension
  if (input.filename) {
    const ext = getExtension(input.filename);
    if (ext && EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  // Priority 2: Fenced language hint
  if (input.fencedHint) {
    const normalizedHint = input.fencedHint.trim().toLowerCase();
    if (HINT_MAP[normalizedHint]) {
      return HINT_MAP[normalizedHint];
    }
  }

  // Priority 3: Content heuristics
  if (input.content) {
    const fromContent = detectFromContent(input.content);
    if (fromContent) {
      return fromContent;
    }
  }

  return null;
}
