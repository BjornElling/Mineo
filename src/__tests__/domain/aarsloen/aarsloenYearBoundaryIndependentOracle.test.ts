import { computeAarsloenBeregning } from '../../../domain/aarsloen/aarsloenBeregning';
import type { AarsloenValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';

const iso = (value: string): ISODateString => value as ISODateString;
const amount = (value: number): StandardLoenTableRow['col2'] => ({ kind: 'number', value });

const dayRow = (id: string, from: string, to: string, value: number): StandardLoenTableRow => ({
  id,
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: iso(from),
  col1_dag: iso(to),
  col2: amount(value),
  col3: undefined,
  col4: undefined,
  col5: undefined,
  fpFvShSoBeloeb: undefined,
  pensionBeloeb: undefined,
});

const utcDate = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month - 1, day));

const values: AarsloenValues = {
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.DAG,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB,
  tableData: [
    dayRow('december-2024', '2024-12-01', '2024-12-31', 30_000),
    dayRow('januar-2025', '2025-01-01', '2025-01-31', 30_000),
  ],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: false,
  antalFeriedage: 0,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
};

describe('CALC-002/DATE-001 – uafhængigt årsskiftefacit for dagløn', () => {
  it('periodiserer hele december og januar korrekt over kalenderårsskiftet', () => {
    const result = computeAarsloenBeregning({ values, omregningAktiveret: true });

    // Native UTC-datoer er oraklet for yderpunkterne, så testen ikke genbruger Mineos datohelpers.
    expect(result.periodeData?.perioder).toEqual([
      { start: utcDate(2024, 12, 1), end: utcDate(2024, 12, 31) },
      { start: utcDate(2025, 1, 1), end: utcDate(2025, 1, 31) },
    ]);
    expect(result.periodeData?.unikkeEnheder).toBe(62);
    expect(result.periodeData?.datoSet.has(iso('2024-12-31'))).toBe(true);
    expect(result.periodeData?.datoSet.has(iso('2025-01-01'))).toBe(true);
    expect(result.periodeData?.datoSet.has(iso('2024-11-30'))).toBe(false);
    expect(result.periodeData?.datoSet.has(iso('2025-02-01'))).toBe(false);

    // 30.000 kr. + 30.000 kr. over to hele måneder omregnes til 360.000 kr. årligt.
    expect(result.beregningsData).toMatchObject({
      metode: 'C',
      antalHeleKalendermaaneder: 2,
      omregnetAarsloen: 360_000,
    });
    expect(result.beregningsFejl).toBeNull();
    expect(result.harFatalBeregningsFejl).toBe(false);
  });
});
