/**
 * Generates an ExecutionManifest combining the results of Stages 2 through 7.
 *
 * Implements Master Technical Specification §5, Module 2 (Deterministic Instruction Parser), Stage 8 — Execution Manifest Generation.
 * Consumed by:
 * - §5 Module 3 (Project Planner) — to convert into CREATE / UPDATE / MKDIR operations
 * - §5 Module 4 (File Engine) — to write files and create directories
 * - API server tasks/plan endpoints
 */

import { createHash } from 'node:crypto';
import type { DeduplicatedBlock, DuplicateConflict } from './duplicate-detector.js';
import type { MissingContentIssue } from './missing-content-detector.js';

export interface ManifestFile {
  path: string;
  content: string;
  language: string | null;
  isNew: boolean;
}

export interface ManifestWarning {
  code: string;
  message: string;
  filename?: string | null;
  codeBlockIndex?: number;
}

export interface ManifestError {
  code: string;
  message: string;
  filename?: string | null;
  codeBlockIndex?: number;
}

export interface ExecutionManifest {
  version: string;
  createdAt: string;
  instructionsHash: string;
  folders: string[];
  files: ManifestFile[];
  warnings: ManifestWarning[];
  errors: ManifestError[];
}

export interface GenerateManifestInput {
  markdown: string;
  /**
   * Deduplicated blocks output from Stage 6 (DeduplicatedBlock[]).
   * IMPORTANT: This field is expected to be the clean deduplicated output of Stage 6;
   * it must NOT contain the losing duplicate code blocks.
   */
  blocks?: DeduplicatedBlock[];
  folders?: string[];
  duplicateConflicts?: DuplicateConflict[];
  contentIssues?: MissingContentIssue[];
  existingFiles?: string[];
}

function normalizePath(rawPath: string): string {
  return rawPath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/[/\\]+$/, '')
    .replace(/\/+/g, '/')
    .trim();
}

function mapErrorCode(type: string): string {
  switch (type) {
    case 'placeholder':
      return 'PLACEHOLDER_CONTENT';
    case 'orphan_block':
      return 'ORPHAN_BLOCK';
    case 'empty_content':
      return 'EMPTY_CONTENT';
    case 'whitespace_only':
      return 'WHITESPACE_ONLY';
    default:
      return type.toUpperCase();
  }
}

/**
 * Generates an ExecutionManifest combining the outputs of Stages 2 through 7.
 *
 * @param input - Pipeline outputs and optional existing file list
 * @returns ExecutionManifest ready for the Project Planner
 */
export function generateManifest(input: GenerateManifestInput): ExecutionManifest {
  const version = '1.0';
  const createdAt = new Date().toISOString();

  // Compute SHA-256 hash of raw source instructions
  const instructionsHash = createHash('sha256')
    .update(input.markdown || '')
    .digest('hex');

  // Normalize and deduplicate folders from Stage 4
  const folders: string[] = [];
  if (input.folders && input.folders.length > 0) {
    const seenFolders = new Set<string>();
    for (const folder of input.folders) {
      const normalized = normalizePath(folder);
      if (normalized && !seenFolders.has(normalized)) {
        seenFolders.add(normalized);
        folders.push(normalized);
      }
    }
  }

  const warnings: ManifestWarning[] = [];
  const errors: ManifestError[] = [];

  // Map Stage 6 duplicate resolutions to non-fatal warnings
  if (input.duplicateConflicts && input.duplicateConflicts.length > 0) {
    for (const conflict of input.duplicateConflicts) {
      warnings.push({
        code: 'DUPLICATE_FILE_RESOLVED',
        message: `Duplicate file '${conflict.filename}' resolved: block #${conflict.winnerBlockIndex} selected (${conflict.reason})`,
        filename: conflict.filename,
        codeBlockIndex: conflict.winnerBlockIndex
      });
    }
  }

  // Process Stage 7 content issues
  // Explicit exclusion rule: any codeBlockIndex that appears in contentIssues with a fatal type
  // (orphan_block, placeholder, empty_content, whitespace_only) is marked fatal and excluded from files
  const fatalIssueTypes = new Set(['orphan_block', 'placeholder', 'empty_content', 'whitespace_only']);
  const fatalBlockIndices = new Set<number>();

  if (input.contentIssues && input.contentIssues.length > 0) {
    for (const issue of input.contentIssues) {
      if (fatalIssueTypes.has(issue.type)) {
        fatalBlockIndices.add(issue.codeBlockIndex);
        errors.push({
          code: mapErrorCode(issue.type),
          message: issue.message,
          filename: issue.filename,
          codeBlockIndex: issue.codeBlockIndex
        });
      } else {
        warnings.push({
          code: mapErrorCode(issue.type),
          message: issue.message,
          filename: issue.filename,
          codeBlockIndex: issue.codeBlockIndex
        });
      }
    }
  }

  // Normalize existing files set to compute `isNew` flag
  let existingSet: Set<string> | null = null;
  if (input.existingFiles && input.existingFiles.length > 0) {
    existingSet = new Set(input.existingFiles.map((f) => normalizePath(f)));
  }

  // Build files list from Stage 6 deduplicated blocks, explicitly excluding fatal blocks
  const files: ManifestFile[] = [];

  if (input.blocks && input.blocks.length > 0) {
    for (const block of input.blocks) {
      // Explicit check: exclude block if its codeBlockIndex has a fatal issue
      if (fatalBlockIndices.has(block.codeBlockIndex)) {
        continue;
      }

      const normalizedFilePath = normalizePath(block.filename);
      const isNew = existingSet !== null ? !existingSet.has(normalizedFilePath) : true;

      files.push({
        path: normalizedFilePath,
        content: block.content,
        language: block.language,
        isNew
      });
    }
  }

  return {
    version,
    createdAt,
    instructionsHash,
    folders,
    files,
    warnings,
    errors
  };
}
