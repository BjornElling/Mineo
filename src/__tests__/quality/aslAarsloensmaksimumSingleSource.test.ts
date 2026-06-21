/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

/**
 * ASL-årslønsmaksimum (§24) skal slås op ÉT sted: `resolveAslAarsloensmaksimumForAar`
 * i `domain/satser/aslAarsloensmaksimum.ts`. Tidligere blev `aarsloenAslMax[year]` slået
 * op rå ~10 forskellige steder, der hver gentog "findes / positiv-finit"-værnet og hver
 * formulerede sin egen "mangler"-besked (B10). Denne guard fejler, hvis et nyt rå subscript-
 * opslag (`aarsloenAslMax[...]`) genintroduceres uden for gateway'en og selve datakilden.
 *
 * Tilladt: at sende HELE map'et videre som injiceret indeks (`aarsloenAslMax,` /
 * `aarsloenAslMax }`) og bounds-opslag (`getYearBoundsForYearlyRate(aarsloenAslMax)`) —
 * det er ikke et rå enkelt-år-opslag og divergerer ikke fra gateway-semantikken.
 */

const SRC_ROOT = path.resolve(__dirname, '../../');

// Datakilden selv definerer tabellen + udleder ASL_MAX_AARSLOEN_2024 af aarsloenAslMax[2024]
// (kontrolleret, én-kilde-afledning). Gateway'en er det kanoniske opslagspunkt. Begge undtages.
const ALLOWED_FILES = new Set<string>([
  path.resolve(SRC_ROOT, 'data/lovbestemteRates.ts'),
  path.resolve(SRC_ROOT, 'domain/satser/aslAarsloensmaksimum.ts'),
]);

const RAW_SUBSCRIPT = /aarsloenAslMax\s*\[/;

const collectSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      collectSourceFiles(full, acc);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
};

describe('ASL-maks har ét opslagspunkt (gateway)', () => {
  describe('selvtest: detektoren fanger et rå subscript-opslag', () => {
    it('flagger aarsloenAslMax[...] men ikke map-videregivelse/bounds-opslag', () => {
      expect(RAW_SUBSCRIPT.test('const v = aarsloenAslMax[year];')).toBe(true);
      expect(RAW_SUBSCRIPT.test('const v = aarsloenAslMax[skadesaar]')).toBe(true);
      expect(RAW_SUBSCRIPT.test('  aarsloenAslMax,')).toBe(false);
      expect(RAW_SUBSCRIPT.test('getYearBoundsForYearlyRate(aarsloenAslMax)')).toBe(false);
      expect(RAW_SUBSCRIPT.test('resolveAslAarsloensmaksimumForAar(year)')).toBe(false);
    });
  });

  it('intet rå aarsloenAslMax[...]-opslag uden for gateway + datakilde', () => {
    const offenders = collectSourceFiles(SRC_ROOT)
      .filter((file) => !ALLOWED_FILES.has(file))
      .filter((file) => RAW_SUBSCRIPT.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC_ROOT, file));

    expect(
      offenders,
      `Rå ASL-maks-opslag fundet i: ${offenders.join(', ')}. Brug ` +
        `resolveAslAarsloensmaksimumForAar() fra domain/satser/aslAarsloensmaksimum.ts.`,
    ).toEqual([]);
  });
});
