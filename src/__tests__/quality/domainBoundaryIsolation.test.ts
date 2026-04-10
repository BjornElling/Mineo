import fs from 'node:fs';
import path from 'node:path';
import type { StorageKey } from '../../config/storageManifest';
import { persistenceSchemas } from '../../config/persistenceRegistry';
import { assertPathExists, collectSourceFiles, toRepoRelativePath } from './testUtils';

type PageBoundaryRule = Readonly<{
  label: string;
  rootRelativePath: string;
  allowedSections: readonly StorageKey[];
}>;

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const PAGES_ROOT = path.resolve(SRC_ROOT, 'components/pages');
const SPECIAL_EO_IMPORT_HOOK_PATH = path.resolve(SRC_ROOT, 'hooks/useMidlertidigtEetInsertSource.ts');
const FORM_PERSISTENCE_STORE_IMPORT_PATTERN = /from\s+['"][^'"]*formPersistenceStore['"]/;
const STORAGE_KEYS = Object.keys(persistenceSchemas) as StorageKey[];
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SECTION_NAME_ALTERNATION = STORAGE_KEYS.map(escapeRegExp).join('|');
const SECTION_ACCESS_PATTERN = new RegExp(
  String.raw`\b(?:usePersistedForm|usePersistedSectionSelector|usePersistedSection|useFormFieldErrors|useFormFieldErrorReporter|getPersistedSectionSnapshot|getPersistedData|getFieldErrorsBySourceSnapshot|getSectionRevisionSnapshot|getFieldErrorRevisionSnapshot|useSectionRevisionSelector|useFieldErrorRevisionSelector|commitSection)\s*\([^)]*?['"\`](?:${SECTION_NAME_ALTERNATION})['"\`]`,
  'g'
);
const WRITE_ACCESS_PATTERN = new RegExp(
  String.raw`\b(?:usePersistedForm|commitSection)\s*\([^)]*?['"\`](${SECTION_NAME_ALTERNATION})['"\`]`,
  'g'
);
const SPECIAL_EO_READ_SECTION_PATTERN = new RegExp(
  String.raw`sections\.(${SECTION_NAME_ALTERNATION})\b`,
  'g'
);

const PAGE_BOUNDARY_RULES: readonly PageBoundaryRule[] = [
  {
    label: 'Årslønsberegning',
    rootRelativePath: 'components/pages/Aarsloen.tsx',
    allowedSections: ['aarsloen', 'stamdata'],
  },
  {
    label: 'Erhvervsevnetab',
    rootRelativePath: 'components/pages/Erhvervsevnetab.tsx',
    allowedSections: ['erhvervsevnetab', 'faellesAarsloen', 'stamdata'],
  },
  {
    label: 'Erhvervsevnetab tabs',
    rootRelativePath: 'components/pages/erhvervsevnetab',
    allowedSections: ['erhvervsevnetab', 'faellesAarsloen', 'stamdata'],
  },
  {
    label: 'Erstatningsopgørelse',
    rootRelativePath: 'components/pages/Erstatningsopgoerelse.tsx',
    allowedSections: ['erstatningsopgoerelse', 'stamdata'],
  },
  {
    label: 'Erstatningsopgørelse tabs',
    rootRelativePath: 'components/pages/erstatningsopgoerelse',
    allowedSections: ['erstatningsopgoerelse', 'stamdata'],
  },
  {
    label: 'Forsørgertab',
    rootRelativePath: 'components/pages/Forsoergertab.tsx',
    allowedSections: ['forsoergertab', 'faellesAarsloen', 'stamdata'],
  },
  {
    label: 'Renteberegning',
    rootRelativePath: 'components/pages/Renteberegning.tsx',
    allowedSections: ['renteberegning', 'stamdata'],
  },
  {
    label: 'Satser',
    rootRelativePath: 'components/pages/Satser.tsx',
    allowedSections: ['satser', 'stamdata'],
  },
  {
    label: 'Stamdata',
    rootRelativePath: 'components/pages/Stamdata.tsx',
    allowedSections: ['stamdata'],
  },
  {
    label: 'Varige mén',
    rootRelativePath: 'components/pages/VarigeMen.tsx',
    allowedSections: ['stamdata', 'varigemen'],
  },
  {
    label: 'Varige mén tabs',
    rootRelativePath: 'components/pages/varigemen',
    allowedSections: ['stamdata', 'varigemen'],
  },
];

// Bruges kun med patterns der matcher sektionsnavn som streng-literal ('x', "x", `x`).
// Brug ikke denne funktion med patterns der matcher sections.x-notation.
const findSectionMatches = (source: string, pattern: RegExp): StorageKey[] => {
  const matches = source.matchAll(pattern);
  return Array.from(matches, (match) => {
    const matchedSegment = match[0];
    const matchedSection = STORAGE_KEYS.find((section) =>
      matchedSegment.includes(`'${section}'`) ||
      matchedSegment.includes(`"${section}"`) ||
      matchedSegment.includes(`\`${section}\``)
    );

    if (!matchedSection) {
      throw new Error(`Kunne ikke udlede sektion fra match: ${matchedSegment}`);
    }

    return matchedSection;
  });
};

describe('domainBoundaryIsolation', () => {
  it('PAGE_BOUNDARY_RULES dækker alle kendte StorageKeys', () => {
    const coveredSections = new Set(
      PAGE_BOUNDARY_RULES.flatMap((rule) => rule.allowedSections)
    );

    expect(Array.from(coveredSections).sort()).toEqual([...STORAGE_KEYS].sort());
  });

  it('forbyder direkte formPersistenceStore-imports i page-laget', () => {
    const violations: string[] = [];

    for (const absolutePath of collectSourceFiles(PAGES_ROOT)) {
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (!FORM_PERSISTENCE_STORE_IMPORT_PATTERN.test(source)) continue;
      violations.push(toRepoRelativePath(absolutePath));
    }

    expect(violations).toEqual([]);
  });

  it('begrænser page-lagets persisted adgang til autoriserede sektioner', () => {
    const violations: string[] = [];

    for (const rule of PAGE_BOUNDARY_RULES) {
      const rootPath = path.resolve(SRC_ROOT, rule.rootRelativePath);
      assertPathExists(rootPath, `Page-boundary root for ${rule.label}`);

      for (const absolutePath of collectSourceFiles(rootPath)) {
        const source = fs.readFileSync(absolutePath, 'utf8');
        const relativePath = toRepoRelativePath(absolutePath);
        const accessedSections = findSectionMatches(source, SECTION_ACCESS_PATTERN);

        for (const section of accessedSections) {
          if (!rule.allowedSections.includes(section)) {
            violations.push(`${rule.label}: ${relativePath} -> ${section}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('holder EO-specialimporten snæver: read-only stamdata + erhvervsevnetab + faellesAarsloen', () => {
    assertPathExists(SPECIAL_EO_IMPORT_HOOK_PATH, 'EO specialimport-hook');
    const source = fs.readFileSync(SPECIAL_EO_IMPORT_HOOK_PATH, 'utf8');
    const readSections = Array.from(
      source.matchAll(SPECIAL_EO_READ_SECTION_PATTERN),
      (match) => match[1] as StorageKey
    );
    const writeSections = findSectionMatches(source, WRITE_ACCESS_PATTERN);

    expect(Array.from(new Set(readSections)).sort()).toEqual(['erhvervsevnetab', 'faellesAarsloen', 'stamdata']);
    expect(writeSections).toEqual([]);
  });
});
