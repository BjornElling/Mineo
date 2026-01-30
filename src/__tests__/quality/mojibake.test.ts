/**
 * IMPORTANT:
 * This test intentionally contains ASCII-only string literals.
 * Literal mojibake sequences must never appear in this file,
 * otherwise the test would correctly fail on itself.
 */

import fs from 'node:fs';
import path from 'node:path';
type MojibakeHit = {
  file: string;
  line: number;
  column: number;
  text: string;
  description: string;
};

const PROJECT_ROOT = path.resolve(process.cwd());

const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.md',
  '.txt',
  '.json',
  '.css',
]);

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

/**
 * Known mojibake patterns caused by UTF-8 text decoded as Latin-1 / Windows-1252.
 * Patterns are constructed via character codes to avoid self-hits.
 */
const MOJIBAKE_PATTERNS: Array<{
  pattern: RegExp;
  description: string;
}> = [
  {
    // UTF-8 decoded as Latin-1: Nordic letters (ae / oe / aa)
    pattern: new RegExp(
      String.fromCharCode(0x00c3, 0x00a6) + '|' +
      String.fromCharCode(0x00c3, 0x00b8) + '|' +
      String.fromCharCode(0x00c3, 0x00a5) + '|' +
      String.fromCharCode(0x00c3, 0x0086) + '|' +
      String.fromCharCode(0x00c3, 0x0098) + '|' +
      String.fromCharCode(0x00c3, 0x0085),
    ),
    description: 'UTF-8 decoded as Latin-1 (Nordic letters)',
  },
  {
    // UTF-8 punctuation mojibake
    pattern: new RegExp(
      String.fromCharCode(0x00e2, 0x0080, 0x0099) + '|' +
      String.fromCharCode(0x00e2, 0x0080, 0x009c) + '|' +
      String.fromCharCode(0x00e2, 0x0080, 0x009d) + '|' +
      String.fromCharCode(0x00e2, 0x0080, 0x0093) + '|' +
      String.fromCharCode(0x00e2, 0x0080, 0x0094),
    ),
    description: 'UTF-8 punctuation mojibake',
  },
  {
    // UTF-8 punctuation mojibake with Euro sign variants (common in editors)
    pattern: new RegExp(
      String.fromCharCode(0x00e2, 0x20ac, 0x2019) + '|' +
      String.fromCharCode(0x00e2, 0x20ac, 0x201c) + '|' +
      String.fromCharCode(0x00e2, 0x20ac, 0x201d) + '|' +
      String.fromCharCode(0x00e2, 0x20ac, 0x2013) + '|' +
      String.fromCharCode(0x00e2, 0x20ac, 0x2014) + '|' +
      String.fromCharCode(0x00e2, 0x20ac, 0x2022) + '|' +
      String.fromCharCode(0x00e2, 0x20ac, 0x2026),
    ),
    description: 'UTF-8 punctuation mojibake (Euro sign variants)',
  },
  {
    // Leaked UTF-8 BOM
    pattern: new RegExp(
      String.fromCharCode(0x00ef, 0x00bb, 0x00bf),
    ),
    description: 'Leaked UTF-8 BOM',
  },
  {
    // Unicode replacement character
    pattern: /\uFFFD/,
    description: 'Unicode replacement character (decoding error)',
  },
];

const collectFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name))) continue;

    files.push(fullPath);
  }

  return files;
};

const indexToLineColumn = (text: string, index: number) => {
  let line = 1;
  let column = 1;

  for (let i = 0; i < index; i++) {
    const char = text[i];
    if (char === '\n') {
      line++;
      column = 1;
    } else if (char !== '\r') {
      column++;
    }
  }

  return { line, column };
};

const findMojibake = (text: string, file: string): MojibakeHit[] => {
  const hits: MojibakeHit[] = [];

  for (const { pattern, description } of MOJIBAKE_PATTERNS) {
    const regex = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const index = match.index;
      const { line, column } = indexToLineColumn(text, index);

      hits.push({
        file,
        line,
        column,
        text: match[0],
        description,
      });
    }
  }

  return hits;
};

describe('mojibake guard', () => {
  it('contains no mojibake patterns in tracked text files', () => {
    const files = collectFiles(PROJECT_ROOT);
    const hits: MojibakeHit[] = [];

    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      hits.push(
        ...findMojibake(text, path.relative(process.cwd(), file)),
      );
    }

    if (hits.length > 0) {
      const preview = hits
        .slice(0, 20)
        .map(
          (hit) =>
            `${hit.file}:${hit.line}:${hit.column} "${hit.text}" - ${hit.description}`,
        )
        .join('\n');

      expect.fail(
        `Found mojibake patterns (${hits.length} total):\n${preview}`,
      );
    }
  });
});
