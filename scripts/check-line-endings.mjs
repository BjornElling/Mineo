#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';

const options = process.argv.slice(2);
if (options.some((option) => option !== '--fix')) {
  console.error('Brug: node scripts/check-line-endings.mjs [--fix]');
  process.exit(1);
}
const fix = options.includes('--fix');
const git = (args, input) => execFileSync('git', args, {
  input,
  maxBuffer: 256 * 1024 * 1024,
});
const split = (buffer) => buffer.toString('utf8').split('\0').filter(Boolean);
const files = split(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']));
const uniqueFiles = [...new Set(files)];
const getAttributes = (cached) => {
  const attributes = split(git(['check-attr', ...(cached ? ['--cached'] : []), '-z', '--stdin', 'text'], `${uniqueFiles.join('\0')}\0`));
  const result = new Map();
  for (let index = 0; index < attributes.length; index += 3) {
    result.set(attributes[index], attributes[index + 2]);
  }
  return result;
};
const diskAttributes = getAttributes(false);
const indexAttributes = getAttributes(true);

// Eksplicitte binærregler har forrang. Ukendte filer skal være UTF-8 uden binære
// kontroltegn, før --fix må skrive i dem. CR alene skal stadig give en fejl i tekst.
const isText = (file, buffer, attributes) => {
  if (attributes.get(file) === 'unset') return false;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return !/[\x00-\x08\x0b\x0e-\x1f\x7f]/u.test(text);
  } catch {
    return false;
  }
};
const failures = [];
let fixed = 0;
const inspect = (file, buffer, source, attributes) => {
  if (!isText(file, buffer, attributes) || !buffer.includes(13)) return;
  failures.push(`${source}: ${file}`);
};

for (const file of uniqueFiles) {
  let buffer;
  try {
    // Følg aldrig symlinks: et link kan pege på data uden for repoet.
    if (!lstatSync(file).isFile()) continue;
    buffer = readFileSync(file);
  } catch (error) {
    // Sletninger er tilladt; andre læsefejl må ikke give en grøn kontrol.
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  if (fix && isText(file, buffer, diskAttributes) && buffer.includes(Buffer.from('\r\n'))) {
    // Bytevis udskiftning bevarer encoding og alt andet indhold, også i store filer.
    buffer = Buffer.from(buffer.filter((byte, index) => byte !== 13 || buffer[index + 1] !== 10));
    writeFileSync(file, buffer);
    fixed += 1;
  }
  inspect(file, buffer, 'Disk', diskAttributes);
}

// Læs de faktiske staged blobs samlet. Git normaliserer normalt CRLF ved git add, men
// --no-filters og delvis staging kan ellers skjule fejl bag en korrekt fil på disken.
const entries = split(git(['ls-files', '--stage', '-z'])).map((entry) => {
  const tab = entry.indexOf('\t');
  const [mode, hash, stage] = entry.slice(0, tab).split(' ');
  return { mode, hash, stage, file: entry.slice(tab + 1) };
}).filter(({ mode }) => mode === '100644' || mode === '100755');
if (entries.length > 0) {
  const blobs = git(['cat-file', '--batch'], `${entries.map(({ hash }) => hash).join('\n')}\n`);
  let offset = 0;
  for (const entry of entries) {
    const end = blobs.indexOf(10, offset);
    const size = Number(blobs.subarray(offset, end).toString('ascii').split(' ')[2]);
    if (end < 0 || !Number.isSafeInteger(size) || size < 0) throw new Error('Ugyldigt svar fra git cat-file');
    const buffer = blobs.subarray(end + 1, end + 1 + size);
    inspect(entry.file, buffer, `Index (stage ${entry.stage})`, indexAttributes);
    offset = end + 1 + size + 1;
  }
}

if (fixed > 0) console.log(`CRLF erstattet med LF i ${fixed} filer på disken.`);
if (failures.length > 0) {
  console.error(`Linjeskift skal være LF. CR fundet i ${failures.length} filer/kopier:\n${failures.join('\n')}`);
  console.error('Kør npm run fix:line-endings, og stage derefter filerne igen med git add.');
  console.error('Enkeltstående CR skal vurderes og rettes manuelt; binære filer ændres aldrig.');
  process.exitCode = 1;
} else {
  console.log(`LF-kontrol OK (${uniqueFiles.length} filer samt Git-index).`);
}
