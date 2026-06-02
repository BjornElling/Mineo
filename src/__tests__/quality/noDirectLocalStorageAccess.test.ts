import fs from 'node:fs';
import path from 'node:path';
import { collectSourceFiles, toRepoRelativePath } from './testUtils';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

// Fanger både `localStorage.getItem(...)` (medlemskald) og `window.localStorage` (objekt-opslag).
// Den kanoniske wrapper resolver `window.localStorage` ét sted; alle andre må kun gå gennem den.
const DIRECT_LOCAL_STORAGE_PATTERN =
  /(?:window\.|globalThis\.)?localStorage\.(?:getItem|setItem|removeItem|clear|key|length)\b|(?:window|globalThis)\.localStorage\b/;

const ALLOWED_DIRECT_ACCESS_FILES = new Set([
  // Den ENESTE sanktionerede indgang til window.localStorage.
  'src/utils/safeLocalStorage.ts',
]);

describe('localStorage boundary isolation', () => {
  // Strukturel vagt (modstykke til sessionStorageBoundaryIsolation): ingen rå localStorage-adgang
  // uden for den kanoniske wrapper. Tidligere var denne fil KUN en smoke-test af én wrapper-funktion
  // og scannede slet ikke kildekoden — et `localStorage.getItem(...)` hvor som helst i src/ ville
  // passere uopdaget. Den er nu en rigtig scanner.
  it('begrænser direkte localStorage-adgang til den kanoniske safeLocalStorage-wrapper', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(SRC_ROOT)) {
      const relativePath = toRepoRelativePath(absolutePath);
      if (ALLOWED_DIRECT_ACCESS_FILES.has(relativePath)) {
        continue;
      }

      const source = fs.readFileSync(absolutePath, 'utf8');
      if (DIRECT_LOCAL_STORAGE_PATTERN.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  // Selv-test: bevis at mønsteret faktisk fanger en overtrædelse, så vagten ikke kan passere vakuøst
  // (fx hvis et regex-escape gjorde mønsteret inert ville hovedtesten stadig være grøn uden dette).
  it('mønsteret fanger en syntetisk overtrædelse (vagten er ikke inert)', () => {
    expect(DIRECT_LOCAL_STORAGE_PATTERN.test('const x = localStorage.getItem("k");')).toBe(true);
    expect(DIRECT_LOCAL_STORAGE_PATTERN.test('window.localStorage.setItem("k", "v");')).toBe(true);
    expect(DIRECT_LOCAL_STORAGE_PATTERN.test('const ls = window.localStorage;')).toBe(true);
    // Og at det IKKE fanger ord i prosa/kommentarer uden medlemskald.
    expect(DIRECT_LOCAL_STORAGE_PATTERN.test('// merge af settings fra localStorage')).toBe(false);
  });

  it('allows safeLocalStorage-wrapperen at operere uden at de kaldende lag rører window.localStorage', async () => {
    vi.resetModules();
    const { readLocalStorage, writeLocalStorage } = await import('../../settings/appSettingsStorage');
    expect(() => readLocalStorage('test-key')).not.toThrow();
    expect(() => writeLocalStorage('test-key', 'value')).not.toThrow();
  });
});
