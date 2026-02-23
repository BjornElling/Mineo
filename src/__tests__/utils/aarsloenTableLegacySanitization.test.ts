import { describe, expect, it } from 'vitest';
import { sanitizeLegacyPersistedSectionForAarsloenTables } from '../../utils/aarsloenTableLegacySanitization';

// ─── Helper: typisk årslønsrække ──────────────────────────────────────────────

const baseRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: '',
  col1_dag: '',
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
  ...overrides,
});

// ─── aarsloen pageKey ──────────────────────────────────────────────────────────

describe('sanitizeLegacyPersistedSectionForAarsloenTables – aarsloen', () => {
  it('ikke-record value → ingen ændring', () => {
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('aarsloen', 'ikke et objekt');
    expect(result.changed).toBe(false);
    expect(result.value).toBe('ikke et objekt');
  });

  it('mangler tableData → ingen ændring', () => {
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('aarsloen', { other: 1 });
    expect(result.changed).toBe(false);
  });

  it('moderne rækker uden legacy-felter → ingen ændring', () => {
    const value = {
      tableData: [baseRow('r1', { col2: '100' })],
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('aarsloen', value);
    expect(result.changed).toBe(false);
  });

  it('legacy col10 → flyttes til col5 hvis col5 er tom', () => {
    const value = {
      tableData: [{ ...baseRow('r1'), col10: '5000' }],
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('aarsloen', value);
    expect(result.changed).toBe(true);
    const rows = (result.value as { tableData: Record<string, unknown>[] }).tableData;
    expect(rows[0].col5).toBe('5000');
    expect(rows[0]).not.toHaveProperty('col10');
  });

  it('legacy col10 → ignoreres hvis col5 allerede er udfyldt', () => {
    const value = {
      tableData: [{ ...baseRow('r1', { col5: 'eksisterende' }), col10: 'gammel' }],
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('aarsloen', value);
    expect(result.changed).toBe(true);
    expect(result.warnings.some(w => w.includes('Ignorerede'))).toBe(true);
    const rows = (result.value as { tableData: Record<string, unknown>[] }).tableData;
    expect(rows[0].col5).toBe('eksisterende');
  });

  it('legacy col10 flytning genererer advarsel', () => {
    const value = {
      tableData: [{ ...baseRow('r1'), col10: '8000' }],
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('aarsloen', value);
    expect(result.warnings.some(w => w.includes('col10') && w.includes('ATP'))).toBe(true);
  });

  it('ukendt legacy-nøgle med ikke-tom værdi → tæller i ignoredLegacyNonEmptyCount', () => {
    const value = {
      tableData: [{ ...baseRow('r1'), gammelKolonne: 'noget' }],
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('aarsloen', value);
    expect(result.changed).toBe(true);
    expect(result.warnings.some(w => w.includes('Ignorerede'))).toBe(true);
  });

  it('manglende id → tildeles legacy_row_N', () => {
    const value = {
      tableData: [{ col2: '100' }], // ingen id
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('aarsloen', value);
    expect(result.changed).toBe(true);
    const rows = (result.value as { tableData: Record<string, unknown>[] }).tableData;
    expect(rows[0].id).toBe('legacy_row_1');
  });
});

// ─── erstatningsopgoerelse pageKey ────────────────────────────────────────────

describe('sanitizeLegacyPersistedSectionForAarsloenTables – erstatningsopgoerelse', () => {
  it('ikke-record → ingen ændring', () => {
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('erstatningsopgoerelse', 'string');
    expect(result.changed).toBe(false);
  });

  it('ingen loenindkomstAnsaettelsesforhold → ingen ændring', () => {
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('erstatningsopgoerelse', { other: 1 });
    expect(result.changed).toBe(false);
  });

  it('top-level fuldLoenUnderFerie migreres til hvert ansættelsesforhold', () => {
    const value = {
      fuldLoenUnderFerie: 'Ja',
      loenindkomstAnsaettelsesforhold: [{ id: 'af1' }],
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('erstatningsopgoerelse', value);
    expect(result.changed).toBe(true);
    const next = result.value as Record<string, unknown>;
    expect(next).not.toHaveProperty('fuldLoenUnderFerie');
    const list = next.loenindkomstAnsaettelsesforhold as Record<string, unknown>[];
    expect(list[0].fuldLoenUnderFerie).toBe('Ja');
  });

  it('top-level loenPaaHelligdage migreres til hvert ansættelsesforhold', () => {
    const value = {
      loenPaaHelligdage: 'Ingen',
      loenindkomstAnsaettelsesforhold: [{ id: 'af1' }],
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('erstatningsopgoerelse', value);
    expect(result.changed).toBe(true);
    const next = result.value as Record<string, unknown>;
    expect(next).not.toHaveProperty('loenPaaHelligdage');
    const list = next.loenindkomstAnsaettelsesforhold as Record<string, unknown>[];
    expect(list[0].loenPaaHelligdage).toBe('Ingen');
  });

  it('eksisterende fuldLoenUnderFerie på item → overskrives ikke', () => {
    const value = {
      fuldLoenUnderFerie: 'Ja',
      loenindkomstAnsaettelsesforhold: [{ id: 'af1', fuldLoenUnderFerie: 'Nej' }],
    };
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('erstatningsopgoerelse', value);
    const next = result.value as Record<string, unknown>;
    const list = next.loenindkomstAnsaettelsesforhold as Record<string, unknown>[];
    expect(list[0].fuldLoenUnderFerie).toBe('Nej'); // bevaret
  });
});

// ─── ukendt pageKey ───────────────────────────────────────────────────────────

describe('sanitizeLegacyPersistedSectionForAarsloenTables – ukendt pageKey', () => {
  it('ukendt pageKey → ingen ændring', () => {
    const value = { data: 'noget' };
    // @ts-expect-error – bevidst ukendt pageKey
    const result = sanitizeLegacyPersistedSectionForAarsloenTables('stamdata', value);
    expect(result.changed).toBe(false);
    expect(result.value).toBe(value);
  });
});
