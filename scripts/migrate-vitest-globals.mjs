#!/usr/bin/env node
/**
 * Migrerer testfiler til Vitest globals
 *
 * Fjerner: import { describe, it, expect, vi, ... } from 'vitest';
 * Bevarer: import type { Mock } from 'vitest'; (type imports)
 *
 * Kør med --dry-run for at se ændringer uden at skrive
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_FILE_REGEX = /\.(test|spec)\.(ts|tsx)$/;

// Matcher KUN value imports fra vitest (ikke type imports)
// Denne regex matcher: import { ... } from 'vitest'; (inkl. multiline)
// Men IKKE: import type { ... } from 'vitest';
const VITEST_VALUE_IMPORT_REGEX = /^import\s+\{[\s\S]*?\}\s+from\s+['"]vitest['"];?\s*\n?/gm;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = walk(path.join(ROOT, 'src'))
  .filter(f => TEST_FILE_REGEX.test(f));

console.log(`\nVitest Globals Migration ${DRY_RUN ? '(DRY RUN)' : ''}`);
console.log('='.repeat(50));
console.log(`Fundet ${files.length} testfiler\n`);

let changed = 0;
let skipped = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(ROOT, file);

  // Reset regex lastIndex for hver fil
  VITEST_VALUE_IMPORT_REGEX.lastIndex = 0;

  // Tjek om filen har value imports fra vitest
  const hasVitestImport = VITEST_VALUE_IMPORT_REGEX.test(original);
  VITEST_VALUE_IMPORT_REGEX.lastIndex = 0; // Reset igen efter test()

  if (!hasVitestImport) {
    skipped++;
    continue;
  }

  // Fjern value imports (bevarer type imports)
  const updated = original.replace(VITEST_VALUE_IMPORT_REGEX, '');

  // Fjern eventuelle tomme linjer i starten
  const cleaned = updated.replace(/^\n+/, '');

  if (cleaned !== original) {
    if (DRY_RUN) {
      console.log(`[DRY] Vil migrere: ${relativePath}`);

      // Vis hvad der fjernes
      const removedImports = original.match(VITEST_VALUE_IMPORT_REGEX);
      if (removedImports) {
        removedImports.forEach(imp => {
          console.log(`      - ${imp.trim()}`);
        });
      }
    } else {
      fs.writeFileSync(file, cleaned, 'utf8');
      console.log(`Migreret: ${relativePath}`);
    }
    changed++;
  }
}

console.log('\n' + '='.repeat(50));
console.log(`Resultat: ${changed} fil(er) ${DRY_RUN ? 'vil blive' : 'blev'} opdateret`);
console.log(`Sprunget over: ${skipped} fil(er) (ingen vitest imports)`);

if (DRY_RUN && changed > 0) {
  console.log('\nKor uden --dry-run for at udfore migreringen');
}

process.exit(0);
