export function extractCodeBlocks(
  markdown: string
): Array<{ language: string | null; content: string }> {
  const blocks: Array<{ language: string | null; content: string }> = [];
  const lines = markdown.split(/\r?\n/);
  let inBlock = false;
  let currentLanguage: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (!inBlock) {
      const match = line.trimStart().match(/^```([^\s`]*)/);
      if (match) {
        inBlock = true;
        const lang = match[1]?.trim() ?? '';
        currentLanguage = lang.length > 0 ? lang : null;
        currentLines = [];
      }
    } else {
      if (line.trim() === '```') {
        inBlock = false;
        blocks.push({
          language: currentLanguage,
          content: currentLines.join('\n')
        });
        currentLanguage = null;
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
  }

  return blocks;
}
