/**
 * Detects duplicate filename declarations across parsed code blocks,
 * resolves collisions deterministically, and returns deduplicated file operations
 * alongside diagnostic conflict reports.
 *
 * Implements Master Technical Specification §5, Module 2 (Deterministic Instruction Parser), Stage 6 — Duplicate File Detection.
 */

export interface CandidateBlock {
  codeBlockIndex: number;
  filename: string | null;
  content: string;
  language: string | null;
}

export interface DuplicateOccurrence {
  codeBlockIndex: number;
  contentLength: number;
}

export interface DuplicateConflict {
  filename: string;
  occurrences: DuplicateOccurrence[];
  winnerBlockIndex: number;
  reason: 'identical' | 'longest_content' | 'latest_occurrence';
}

export interface DeduplicatedBlock {
  codeBlockIndex: number;
  filename: string;
  content: string;
  language: string | null;
}

export interface DuplicateDetectionResult {
  deduplicated: DeduplicatedBlock[];
  duplicates: DuplicateConflict[];
  hasDuplicates: boolean;
}

function normalizePath(rawPath: string): string {
  return rawPath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/[/\\]+$/, '')
    .replace(/\/+/g, '/')
    .trim();
}

/**
 * Detects duplicate files across candidate blocks and resolves them deterministically:
 * - Rule 1 (identical content): When duplicate blocks for a file share identical content, the first occurrence is kept.
 * - Rule 2 (longest content wins): If duplicate code blocks for a file have differing content, the block with the largest character length wins.
 * - Rule 3 (latest occurrence tie-break): If conflicting duplicate blocks have equal length, the latest block index wins.
 *
 * @param blocks - Candidate blocks from Stages 1-5
 * @returns DuplicateDetectionResult with deduplicated blocks and conflict details
 */
export function detectDuplicateFiles(
  blocks: CandidateBlock[]
): DuplicateDetectionResult {
  if (!blocks || blocks.length === 0) {
    return {
      deduplicated: [],
      duplicates: [],
      hasDuplicates: false
    };
  }

  // Filter blocks that have a valid filename
  const validBlocks = blocks.filter(
    (b): b is CandidateBlock & { filename: string } =>
      typeof b.filename === 'string' && b.filename.trim().length > 0
  );

  // Group blocks by normalized filename while tracking discovery order
  const filenameGroups = new Map<string, Array<CandidateBlock & { filename: string }>>();
  const orderOfAppearance: string[] = [];

  for (const block of validBlocks) {
    const normalized = normalizePath(block.filename);
    if (!filenameGroups.has(normalized)) {
      filenameGroups.set(normalized, []);
      orderOfAppearance.push(normalized);
    }
    filenameGroups.get(normalized)!.push(block);
  }

  const duplicates: DuplicateConflict[] = [];
  const deduplicated: DeduplicatedBlock[] = [];

  for (const normalizedFilename of orderOfAppearance) {
    const group = filenameGroups.get(normalizedFilename)!;

    if (group.length === 1) {
      const single = group[0]!;
      deduplicated.push({
        codeBlockIndex: single.codeBlockIndex,
        filename: normalizedFilename,
        content: single.content,
        language: single.language
      });
      continue;
    }

    // Multiple occurrences detected for this filename
    const occurrences: DuplicateOccurrence[] = group.map((b) => ({
      codeBlockIndex: b.codeBlockIndex,
      contentLength: b.content.length
    }));

    // Rule 1: Check if all occurrences are identical in content
    const isIdentical = group.every((b) => b.content === group[0]!.content);

    let winner: CandidateBlock & { filename: string };
    let reason: 'identical' | 'longest_content' | 'latest_occurrence';

    if (isIdentical) {
      winner = group[0]!;
      reason = 'identical';
    } else {
      // Rule 2: Longest content wins
      let maxLen = -1;
      for (const item of group) {
        if (item.content.length > maxLen) {
          maxLen = item.content.length;
        }
      }

      const longestCandidates = group.filter((b) => b.content.length === maxLen);

      if (longestCandidates.length === 1) {
        winner = longestCandidates[0]!;
        reason = 'longest_content';
      } else {
        // Rule 3: Tie-break — Latest occurrence wins
        winner = longestCandidates[longestCandidates.length - 1]!;
        reason = 'latest_occurrence';
      }
    }

    duplicates.push({
      filename: normalizedFilename,
      occurrences,
      winnerBlockIndex: winner.codeBlockIndex,
      reason
    });

    deduplicated.push({
      codeBlockIndex: winner.codeBlockIndex,
      filename: normalizedFilename,
      content: winner.content,
      language: winner.language
    });
  }

  return {
    deduplicated,
    duplicates,
    hasDuplicates: duplicates.length > 0
  };
}
