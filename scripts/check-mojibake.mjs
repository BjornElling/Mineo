#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PROJECT_ROOT = process.cwd();

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.txt',
  '.css',
  '.html',
  '.yml',
  '.yaml',
  '.sh',
  '.mjs',
  '.cjs',
]);

const CLI_OPTIONS = new Set(process.argv.slice(2));
const QUIET = CLI_OPTIONS.has('--quiet');

const toMojibake = (text, passes) => {
  let current = text;
  for (let i = 0; i < passes; i += 1) {
    current = Buffer.from(current, 'utf8').toString('latin1');
  }
  return current;
};

const DANISH_BASE = ['æ', 'ø', 'å', 'Æ', 'Ø', 'Å'];
const PUNCTUATION_BASE = ['—', '–', '…', '“', '”', '’', '•'];

// CP437/OEM-encoding mojibake patterns (rare but found in wild)
// Using Unicode escapes to avoid triggering self-check
const CP437_MOJIBAKE = [
  '\u251C\u00A9', // ø misencoded as box-drawing + copyright
  '\u251C\u00D1', // å misencoded as box-drawing + Ñ
  '\u251C\u00AA', // æ misencoded as box-drawing + feminine ordinal
  '\u251C\u00F9', // × misencoded as box-drawing + ù
  '\u00D4\u00E5\u00C6', // → misencoded as Ô + å + Æ
];

const FORBIDDEN_TOKENS = new Set(
  [...DANISH_BASE, ...PUNCTUATION_BASE].flatMap((token) => [toMojibake(token, 1), toMojibake(token, 2)]),
);

// Add CP437 mojibake patterns to forbidden tokens
CP437_MOJIBAKE.forEach(token => FORBIDDEN_TOKENS.add(token));

const FORBIDDEN_PATTERNS = [
  {
    regex: /\u00C3(?:\u0192\u00C2[\u00A0-\u00BF]|[\u00A0-\u00BF])/gu,
    reason: 'Mojibake-sekvens (C3-variant)',
  },
  {
    regex: /\u00E2(?:\u201A\u00AC|\u20AC)(?:\u2122|\u0153|\u201D|\u201C|\u2022|\u2026)?/gu,
    reason: 'Mojibake-sekvens (E2-variant)',
  },
  {
    regex: /\u00C2[\u00A0-\u00BF]/gu,
    reason: 'Mojibake-sekvens (C2-variant)',
  },
];

const indexToLineColumn = (text, index) => {
  let line = 1;
  let column = 1;
  for (let i = 0; i < index; i += 1) {
    const char = text[i];
    if (char === '\n') {
      line += 1;
      column = 1;
    } else if (char !== '\r') {
      column += 1;
    }
  }
  return { line, column };
};

const listTrackedTextFiles = () => {
  const raw = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' });
  return raw
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((relativePath) => TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase()));
};

const containsUtf8Bom = (buffer) =>
  buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;

const decodeUtf8Strict = (buffer) => {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return decoder.decode(buffer);
};

const findTokenHits = (text, relativePath) => {
  const hits = [];
  for (const token of FORBIDDEN_TOKENS) {
    let start = 0;
    while (start < text.length) {
      const index = text.indexOf(token, start);
      if (index === -1) break;
      const { line, column } = indexToLineColumn(text, index);
      hits.push({
        file: relativePath,
        line,
        column,
        token,
        reason: 'Mojibake-token fundet',
      });
      start = index + token.length;
    }
  }

  let replacementIndex = 0;
  while (replacementIndex < text.length) {
    const index = text.indexOf('\uFFFD', replacementIndex);
    if (index === -1) break;
    const { line, column } = indexToLineColumn(text, index);
    hits.push({
      file: relativePath,
      line,
      column,
      token: '\uFFFD',
      reason: 'Unicode replacement character fundet',
    });
    replacementIndex = index + 1;
  }

  for (const { regex, reason } of FORBIDDEN_PATTERNS) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const index = match.index;
      const { line, column } = indexToLineColumn(text, index);
      hits.push({
        file: relativePath,
        line,
        column,
        token: match[0],
        reason,
      });
    }
  }

  return hits;
};

const main = () => {
  const files = listTrackedTextFiles();
  const failures = [];

  for (const relativePath of files) {
    const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
    const buffer = fs.readFileSync(absolutePath);

    if (containsUtf8Bom(buffer)) {
      failures.push({
        file: relativePath,
        line: 1,
        column: 1,
        token: 'BOM',
        reason: 'UTF-8 BOM er ikke tilladt',
      });
    }

    let text;
    try {
      text = decodeUtf8Strict(buffer);
    } catch {
      failures.push({
        file: relativePath,
        line: 1,
        column: 1,
        token: '<invalid utf-8>',
        reason: 'Filen kan ikke dekodes som UTF-8',
      });
      continue;
    }

    failures.push(...findTokenHits(text, relativePath));
  }

  if (failures.length > 0) {
    const lines = failures
      .slice(0, 100)
      .map((hit) => `${hit.file}:${hit.line}:${hit.column} ${hit.reason} (${JSON.stringify(hit.token)})`);
    const truncated = failures.length > 100 ? `\n... ${failures.length - 100} flere fund` : '';
    const message = `Mojibake/encoding-fejl fundet (${failures.length}):\n${lines.join('\n')}${truncated}`;
    if (!QUIET) {
      console.error(message);
    } else {
      process.stderr.write(`${message}\n`);
    }
    process.exit(1);
  }

  if (!QUIET) {
    console.log(`Encoding-check OK (${files.length} filer).`);
  }
};

main();
