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
const SPECIAL_EO_IMPORT_HOOK_PATH = path.resolve(SRC_ROOT, 'hooks/useMidlertidigtEetInsertSource.ts');
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
    assertPathExists(SPECIAL_EO_IMPORT_HOOK_PATH, 'EO specialimport-hook');
    const source = fs.readFileSync(SPECIAL_EO_IMPORT_HOOK_PATH, 'utf8');
    const writeSections = Array.from(source.matchAll(WRITE_ACCESS_PATTERN), (match) => match[1] as PersistedSectionKey);

    expect(source).toContain('useInputEvaluation');
    expect(source).toContain('buildErhvervsevnetabReaderProjection');
    expect(source).not.toContain('formPersistenceStore');
    expect(source).not.toMatch(/\.sections\b/);
    expect(writeSections).toEqual([]);
  });
});
