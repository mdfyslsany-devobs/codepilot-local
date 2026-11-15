/**
 * Detects directory structures from markdown text (e.g., tree graphs, indented lists, folder declarations)
 * and returns an array of unique normalized folder paths in hierarchical order.
 *
 * Implements Master Technical Specification §5, Module 2 (Deterministic Instruction Parser), Stage 4 — Folder Structure Detection.
 */

interface StackEntry {
  depth: number;
  fullPath: string;
}

interface TreeNode {
  segment: string;
  fullPath: string | null;
  firstSeen: number;
  children: Map<string, TreeNode>;
}

const TREE_BRANCH_REGEX = /^[│\s|]*[├└\+\\][-─]+\s*/;
const LIST_ITEM_REGEX = /^(\s*)[-*+]\s+(.*)$/;
const FILE_EXTENSION_REGEX = /\.[a-zA-Z0-9_-]+$/;

function normalizeFolderPath(rawPath: string): string {
  return rawPath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/[/\\]+$/, '')
    .replace(/\/+/g, '/')
    .trim();
}

function cleanEntryName(raw: string): string {
  return raw
    .replace(/\s*(?:#|\/\/).*$/, '')
    .replace(/^[`'"]|[`'"]$/g, '')
    .trim();
}

function isFilePath(name: string): boolean {
  const normalized = normalizeFolderPath(name);
  const baseName = normalized.split('/').pop() ?? normalized;
  return FILE_EXTENSION_REGEX.test(baseName);
}

function orderFoldersHierarchically(folders: string[]): string[] {
  if (folders.length === 0) {
    return [];
  }

  const discoveryIndex = new Map<string, number>();
  folders.forEach((f, idx) => {
    if (!discoveryIndex.has(f)) {
      discoveryIndex.set(f, idx);
    }
  });

  const root: TreeNode = {
    segment: '',
    fullPath: null,
    firstSeen: -1,
    children: new Map()
  };

  for (const folder of folders) {
    const segments = folder.split('/').filter(Boolean);
    let current = root;
    let accPath = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      accPath = accPath ? `${accPath}/${seg}` : seg;
      const isTarget = i === segments.length - 1;
      const seenOrder =
        discoveryIndex.get(accPath) ??
        discoveryIndex.get(folder) ??
        Number.MAX_SAFE_INTEGER;

      let child = current.children.get(seg);
      if (!child) {
        child = {
          segment: seg,
          fullPath: isTarget ? accPath : null,
          firstSeen: seenOrder,
          children: new Map()
        };
        current.children.set(seg, child);
      } else {
        if (isTarget) {
          child.fullPath = accPath;
        }
        if (seenOrder < child.firstSeen) {
          child.firstSeen = seenOrder;
        }
      }
      current = child;
    }
  }

  const result: string[] = [];

  function traverse(node: TreeNode) {
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      if (a.firstSeen !== b.firstSeen) {
        return a.firstSeen - b.firstSeen;
      }
      return a.segment.localeCompare(b.segment);
    });

    for (const child of sortedChildren) {
      if (child.fullPath && discoveryIndex.has(child.fullPath)) {
        result.push(child.fullPath);
      }
      traverse(child);
    }
  }

  traverse(root);
  return result;
}

/**
 * Detects directory structures from markdown text.
 *
 * @param markdown - Raw markdown input text
 * @returns Array of unique relative folder paths
 */
export function detectFolderStructure(markdown: string): string[] {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const detectedFolders: string[] = [];
  const lines = markdown.split(/\r?\n/);

  // Check whether the document contains any tree branch glyphs
  const hasTreeGlyphs = lines.some((l) =>
    l.includes('├──') ||
    l.includes('└──') ||
    l.includes('|--') ||
    l.includes('+--') ||
    l.includes('\\--') ||
    TREE_BRANCH_REGEX.test(l.trimStart())
  );

  if (hasTreeGlyphs) {
    const treeStack: StackEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i]!;
      const trimmed = rawLine.trim();

      // Skip code fence markers or empty lines
      if (!trimmed || trimmed.startsWith('```')) {
        continue;
      }

      // Check if current line is a tree root preceding a tree branch
      const nextLine = lines[i + 1]?.trim();
      const isNextLineBranch =
        nextLine !== undefined &&
        (nextLine.includes('├──') ||
          nextLine.includes('└──') ||
          nextLine.includes('|--') ||
          nextLine.includes('+--') ||
          nextLine.includes('\\--') ||
          TREE_BRANCH_REGEX.test(nextLine));

      const branchMatch = rawLine.match(TREE_BRANCH_REGEX);

      if (!branchMatch && isNextLineBranch) {
        // This is a tree root line (e.g. `src/` or `app/`)
        const cleanName = cleanEntryName(trimmed);
        const normalized = normalizeFolderPath(cleanName);

        if (normalized && !isFilePath(cleanName)) {
          treeStack.length = 0;
          treeStack.push({ depth: 0, fullPath: normalized });
          detectedFolders.push(normalized);
        }
        continue;
      }

      if (branchMatch) {
        const prefix = branchMatch[0];
        const depth = prefix.length;
        const remainder = rawLine.slice(prefix.length);
        const cleanName = cleanEntryName(remainder);

        if (!cleanName) {
          continue;
        }

        const endsWithSlash = cleanName.endsWith('/') || cleanName.endsWith('\\');
        const normalized = normalizeFolderPath(cleanName);
        const isFile = !endsWithSlash && isFilePath(cleanName);

        while (treeStack.length > 0 && treeStack[treeStack.length - 1]!.depth >= depth) {
          treeStack.pop();
        }

        const parent = treeStack[treeStack.length - 1];
        const fullPath = parent ? `${parent.fullPath}/${normalized}` : normalized;

        treeStack.push({ depth, fullPath });

        if (!isFile && fullPath) {
          detectedFolders.push(fullPath);
        }
      }
    }
  }

  // Also parse list items and inline folder paths
  const listStack: Array<{ indent: number; fullPath: string }> = [];

  for (const line of lines) {
    if (line.includes('://')) {
      continue;
    }

    const listMatch = line.match(LIST_ITEM_REGEX);
    if (listMatch) {
      const indent = listMatch[1]!.length;
      const rawContent = cleanEntryName(listMatch[2]!);

      if (!rawContent) {
        continue;
      }

      const endsWithSlash = rawContent.endsWith('/') || rawContent.endsWith('\\');
      const normalized = normalizeFolderPath(rawContent);

      if (!endsWithSlash && isFilePath(rawContent)) {
        continue;
      }

      // If item is explicitly marked as a directory with trailing slash or folder path
      if (endsWithSlash || normalized.includes('/')) {
        let fullPath = normalized;

        if (normalized.includes('/')) {
          // Multi-segment path (e.g. `src/controllers/`) is treated as relative to root
          listStack.length = 0;
          listStack.push({ indent, fullPath });
        } else {
          // Single-segment path indented under a parent
          while (listStack.length > 0 && listStack[listStack.length - 1]!.indent >= indent) {
            listStack.pop();
          }

          const parent = listStack[listStack.length - 1];
          fullPath = parent ? `${parent.fullPath}/${normalized}` : normalized;
          listStack.push({ indent, fullPath });
        }

        if (fullPath) {
          detectedFolders.push(fullPath);
        }
      }
    }
  }

  return orderFoldersHierarchically(detectedFolders);
}
