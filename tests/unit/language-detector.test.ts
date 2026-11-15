import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../packages/instruction-parser/src/language-detector.js';

describe('language-detector (Phase 3 Step 4 — Stage 5)', () => {
  it('should canonicalize language from fenced hint without filename (Test Case 1)', () => {
    const result = detectLanguage({
      fencedHint: 'python',
      content: 'def calculate_sum(a, b):\n    return a + b'
    });
    expect(result).toBe('py');
  });

  it('should prioritize filename extension over conflicting fenced hint (Test Case 2)', () => {
    const result = detectLanguage({
      filename: 'src/components/Header.tsx',
      fencedHint: 'js',
      content: 'export const Header = () => <h1>Header</h1>;'
    });
    expect(result).toBe('tsx');
  });

  it('should fallback to content heuristics when neither hint nor filename is provided (Test Case 3)', () => {
    const result = detectLanguage({
      content: '<!DOCTYPE html>\n<html lang="en">\n<head><title>Test</title></head>\n</html>'
    });
    expect(result).toBe('html');
  });

  it('should normalize fenced hints case-insensitively (Test Case 4)', () => {
    const result = detectLanguage({
      fencedHint: 'TypeScript',
      content: 'interface Config { port: number; }'
    });
    expect(result).toBe('ts');
  });

  it('should return null for undetermined/unknown code snippet (Test Case 5)', () => {
    const result = detectLanguage({
      content: 'plain unstructured notes without any recognized code syntax or headers'
    });
    expect(result).toBeNull();
  });
});
