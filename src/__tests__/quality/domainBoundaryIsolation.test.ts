import fs from 'node:fs';
import path from 'node:path';
import type { PersistedSectionKey } from '../../config/persistenceRegistry';
import { PERSISTED_SECTION_KEYS } from '../../config/persistenceRegistry';
import { PAGE_BOUNDARY_RULES } from './architecture/architectureRules';
import { assertPathExists } from './testUtils';

/**
 * Page-lagets persisterede sektionsadgang håndhæves nu STRUKTURELT af den AST-baserede
 * regel `domain/page-section-access-boundary` (greenfield #48): den beviser, at hver
 * page-fil med sektionsadgang ligger under en PAGE_BOUNDARY_RULE-rod (coverage-
 * completeness) og kun rammer rodens autoriserede sektioner. Den forbud-halvdel er
 * derfor flyttet til manifestet; den direkte formPersistenceStore-import i page-laget
 * dækkes af den globale `persistence/form-persistence-store-import`-regel.
 *
 * Tilbage her står de POSITIVE assertioner, der ikke er forbud-grænser:
 *   1. at manifestets PAGE_BOUNDARY_RULES faktisk dækker alle kendte StorageKeys, og
 *   2. den snævre, positive wiring af EO-specialimporten (read-only tvær-sektioner).
 */

const SRC_ROOT = path.resolve(process.cwd(), 'src');
/**
 * EO's specialimport blev i Fase 5 delt i to: React-adapteren (hook'en) og den rene builder i
 * domænelaget, så ikke-React-konsumenter — fx EO's dokumentdefinition — kan bruge builderen uden at
 * trække React ind.
 *
 * Værnet skal derfor dække BEGGE filer. Den samlede kilde tjekkes for de påkrævede reader-markører
 * (så adapteren stadig går gennem `useInputEvaluation`, og builderen stadig gennem den offentlige
 * reader-projektion), mens forbuddene mod rå store-adgang og sektionsskrivning gælder hver fil for sig.
 */
const SPECIAL_EO_IMPORT_PATHS = [
  path.resolve(SRC_ROOT, 'hooks/useMidlertidigtEetInsertSource.ts'),
  path.resolve(SRC_ROOT, 'domain/erhvervsevnetab/eetImportPort.ts'),
] as const;
const STORAGE_KEYS = [...PERSISTED_SECTION_KEYS];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SECTION_NAME_ALTERNATION = STORAGE_KEYS.map(escapeRegExp).join('|');
const WRITE_ACCESS_PATTERN = new RegExp(
  String.raw`\b(?:usePersistedForm|commitSection)\s*\([^)]*?['"\`](${SECTION_NAME_ALTERNATION})['"\`]`,
  'g'
);

describe('domainBoundaryIsolation', () => {
  it('PAGE_BOUNDARY_RULES dækker alle kendte StorageKeys', () => {
    const coveredSections = new Set(PAGE_BOUNDARY_RULES.flatMap((rule) => rule.allowedSections));
    expect(Array.from(coveredSections).sort()).toEqual([...STORAGE_KEYS].sort());
  });

  it('holder EO-specialimporten på den offentlige reader uden raw store- eller write-adgang', () => {
    for (const filePath of SPECIAL_EO_IMPORT_PATHS) {
      assertPathExists(filePath, `EO specialimport (${path.basename(filePath)})`);
    }
    const sources = SPECIAL_EO_IMPORT_PATHS.map((filePath) => fs.readFileSync(filePath, 'utf8'));
    const combined = sources.join('\n');

    // Reader-stien skal findes ét af de to steder: hook'en holder `useInputEvaluation`, porten læser
    // gennem en SPORET reader. Sporingen er pointen — importen må kun blokere på de refs, den faktisk
    // læser, ikke på en hel sektions issue-pose. Begge markører skal være til stede i specialimporten.
    expect(combined).toContain('useInputEvaluation');
    expect(combined).toContain('createTrackedInputReader');

    // Forbuddene gælder pr. fil: ingen af dem må nå den rå store eller skrive en sektion.
    for (const source of sources) {
      const writeSections = Array.from(source.matchAll(WRITE_ACCESS_PATTERN), (match) => match[1] as PersistedSectionKey);
      expect(source).not.toContain('formPersistenceStore');
      expect(source).not.toMatch(/\.sections\b/);
      expect(writeSections).toEqual([]);
    }
  });
});
