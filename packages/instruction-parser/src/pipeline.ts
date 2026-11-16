/**
 * Deterministic Instruction Parser Pipeline Orchestrator.
 *
 * Implements Master Technical Specification §5, Module 2 (Deterministic Instruction Parser).
 * Sequences Stages 1 through 8:
 * 1. extractCodeBlocks
 * 2. detectFilenameFromContext (per block)
 * 3. detectFolderStructure
 * 4. detectLanguage (per block)
 * 5. detectDuplicateFiles
 * 6. detectMissingContent
 * 7. generateManifest
 */

import { extractCodeBlocks } from './code-block-extractor.js';
import { detectFilenameFromContext } from './filename-detector.js';
import { detectFolderStructure } from './folder-structure-detector.js';
import { detectLanguage } from './language-detector.js';
import { detectDuplicateFiles, type CandidateBlock } from './duplicate-detector.js';
import { detectMissingContent } from './missing-content-detector.js';
import { generateManifest, type ExecutionManifest } from './manifest-generator.js';

export interface ParsePipelineOptions {
  /**
   * List of normalized relative paths existing in the target project.
   * Used to calculate `isNew` boolean flags for each file in the manifest.
   */
  existingFiles?: string[];
}

/**
 * Executes the complete 7-stage deterministic instruction parsing pipeline.
 *
 * @param markdown - Raw instructions containing markdown and code blocks
 * @param options - Pipeline options including project existing file paths
 * @returns ExecutionManifest ready for the project planner
 */
export function parseInstructions(
  markdown: string,
  options?: ParsePipelineOptions
): ExecutionManifest {
  if (!markdown || typeof markdown !== 'string') {
    return generateManifest({
      markdown: '',
      blocks: [],
      folders: [],
      duplicateConflicts: [],
      contentIssues: [],
      existingFiles: options?.existingFiles
    });
  }

  // Stage 2: Extract fenced code blocks
  const rawBlocks = extractCodeBlocks(markdown);

  // Stage 3: Detect filename for each code block from preceding context lines
  const filenames: Array<string | null> = rawBlocks.map((_, index) =>
    detectFilenameFromContext(markdown, index)
  );

  // Stage 4: Detect directory structures and folder declarations
  const folders = detectFolderStructure(markdown);

  // Stage 5: Detect and canonicalize language for each code block
  const candidateBlocks: CandidateBlock[] = rawBlocks.map((block, index) => {
    const filename = filenames[index] ?? null;
    const language = detectLanguage({
      content: block.content,
      fencedHint: block.language,
      filename
    });

    return {
      codeBlockIndex: index,
      filename,
      content: block.content,
      language
    };
  });

  // Stage 6: Detect duplicate filenames and resolve collisions
  const duplicateResult = detectDuplicateFiles(candidateBlocks);

  // Stage 7: Detect missing content, blank blocks, placeholders, or orphan blocks
  const missingContentResult = detectMissingContent(candidateBlocks);

  // Stage 8: Generate execution manifest combining stages 2 through 7
  return generateManifest({
    markdown,
    blocks: duplicateResult.deduplicated,
    folders,
    duplicateConflicts: duplicateResult.duplicates,
    contentIssues: missingContentResult.issues,
    existingFiles: options?.existingFiles
  });
}
