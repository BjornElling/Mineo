import {
  getStandardLoenTableHeaders,
  getStandardLoenHeaderIndex,
  resolveStandardLoenColumnLabel,
  resolveStandardLoenPeriodColumns,
  STANDARD_LOEN_FPFVSHSO_LABEL,
  STANDARD_LOEN_PENSION_LABEL,
  STANDARD_LOEN_SAMLET_LABEL,
} from '../../../domain/aarsloen/standardLoenTableColumns';
import { toISODateString } from '../../../types/branded';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';

const makeRow = (overrides: Partial<StandardLoenTableRow>): StandardLoenTableRow => ({
  id: 'row-1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
  fpFvShSoBeloeb: undefined,
  pensionBeloeb: undefined,
  ...overrides,
});

describe('standardLoenTableColumns', () => {
  it('bruger Løn og Løn (2) som de to standard lønkolonner', () => {
    expect(getStandardLoenTableHeaders('maaned')).toEqual([
      'Måned',
      'År',
      'Løn',
      'Løn (2)',
      'Ikke-pensions-\ngivende løn',
      'ATP og anden\nløn u. tillæg',
      'FP/FV/SH/\nSO/St.B.',
      'Arb.g.\nPension',
      'Samlet løn',
    ]);
  });

  it('giver de nye labels for col2 og col3 i fejl- og inspektionkontekster', () => {
    expect(resolveStandardLoenColumnLabel('col2')).toBe('Løn');
    expect(resolveStandardLoenColumnLabel('col3')).toBe('Løn (2)');
  });

  it.each(['maaned', 'uge', 'dag'] as const)(
    'getStandardLoenHeaderIndex finder korrekte labels for loenperiode=%s',
    (loenperiode) => {
      const headers = getStandardLoenTableHeaders(loenperiode);
      expect(headers[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_FPFVSHSO_LABEL)]).toBe(STANDARD_LOEN_FPFVSHSO_LABEL);
      expect(headers[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_PENSION_LABEL)]).toBe(STANDARD_LOEN_PENSION_LABEL);
      expect(headers[getStandardLoenHeaderIndex(loenperiode, STANDARD_LOEN_SAMLET_LABEL)]).toBe(STANDARD_LOEN_SAMLET_LABEL);
    }
  );

  it('getStandardLoenHeaderIndex fejler hårdt hvis labelen ikke findes', () => {
    expect(() => getStandardLoenHeaderIndex('maaned', 'Ikke-eksisterende kolonne')).toThrow('CRITICAL');
  });
});

describe('resolveStandardLoenPeriodColumns', () => {
  it('måned: returnerer måned-nummer og år som tal-strenge', () => {
    const row = makeRow({ col0_maaned: ' 10 ', col1_maaned: '2022' });
    expect(resolveStandardLoenPeriodColumns(row, 'maaned')).toEqual(['10', '2022']);
  });

  it('uge: returnerer uge fra/til som tal-strenge', () => {
    const row = makeRow({ col0_uge: '40', col1_uge: '43' });
    expect(resolveStandardLoenPeriodColumns(row, 'uge')).toEqual(['40', '43']);
  });

  it('dag: formaterer ISO-datoer til dansk DD-MM-ÅÅÅÅ (aldrig rå ISO)', () => {
    const row = makeRow({
      col0_dag: toISODateString('2022-10-01'),
      col1_dag: toISODateString('2022-10-31'),
    });
    // Regressionsvagt: dag-perioden lækkede tidligere rå ISO (ÅÅÅÅ-MM-DD) til dokumentet.
    expect(resolveStandardLoenPeriodColumns(row, 'dag')).toEqual(['01-10-2022', '31-10-2022']);
  });

  it('dag: tomme datoer giver tomme strenge', () => {
    const row = makeRow({ col0_dag: undefined, col1_dag: undefined });
    expect(resolveStandardLoenPeriodColumns(row, 'dag')).toEqual(['', '']);
  });
});
