import type { AarsloenTableRow, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import {
  buildBilagIndkomstYdelserRanges,
  hasAarsloenRowOverlapWithRanges,
  hasOffentligYdelseRowOverlapWithRanges,
  shouldIncludeLoenRowInBilag,
  shouldIncludeOffentligYdelseRowInBilag,
} from '../../../utils/pdf/erstatningsopgoerelsePdf';

const makeLoenRow = (overrides: Partial<AarsloenTableRow>): AarsloenTableRow => ({
  id: 'row1',
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

describe('erstatningsopgoerelsePdf periodefilter', () => {
  it('ignorerer ranges og medtager række i Alle-mode', () => {
    const loenRow = makeLoenRow({
      col0_dag: '01-01-2024',
      col1_dag: '31-01-2024',
    });
    const arbitraryRanges = [{ fra: '2025-01-01', til: '2025-12-31' }] as const;

    expect(hasAarsloenRowOverlapWithRanges(loenRow, 'dag', 'Alle', arbitraryRanges)).toBe(true);

    const offentligRow: OffentligeYdelserRow = {
      id: 'oy-alle',
      fraDato: '01-01-2024',
      tilDato: '31-01-2024',
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligRow, 'Alle', arbitraryRanges)).toBe(true);
  });

  it('ekskluderer række i Alle-mode når rækkens dato ikke kan parses (fail-closed)', () => {
    const arbitraryRanges = [{ fra: '2025-01-01', til: '2025-12-31' }] as const;

    const offentligUgyldig: OffentligeYdelserRow = {
      id: 'oy-alle-invalid',
      fraDato: '31-02-2024',
      tilDato: '31-02-2024',
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligUgyldig, 'Alle', arbitraryRanges)).toBe(false);

    const loenUgyldig = makeLoenRow({
      col0_dag: '31-02-2024',
      col1_dag: '31-02-2024',
    });
    expect(hasAarsloenRowOverlapWithRanges(loenUgyldig, 'dag', 'Alle', arbitraryRanges)).toBe(false);
  });

  it('ekskluderer rækker når Perioden er valgt uden gyldige perioder (fail-closed)', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.eoNummer = '2';
    eoValues.vedroererPeriodeFra = undefined;
    eoValues.vedroererPeriodeTil = undefined;
    eoValues.periodeTilBeregningFra = undefined;
    eoValues.periodeTilBeregningTil = undefined;

    const ranges = buildBilagIndkomstYdelserRanges(eoValues, 'Perioden');
    expect(ranges).toHaveLength(0);

    const offentligRow: OffentligeYdelserRow = {
      id: 'oy-1',
      fraDato: '01-01-2024',
      tilDato: '31-01-2024',
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligRow, 'Perioden', ranges)).toBe(false);

    const loenRow = makeLoenRow({
      col0_dag: '01-01-2024',
      col1_dag: '31-01-2024',
    });
    expect(hasAarsloenRowOverlapWithRanges(loenRow, 'dag', 'Perioden', ranges)).toBe(false);
  });

  it('medtager via beregningsperiode ved første erstatningsopgørelse', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.eoNummer = '1';
    eoValues.vedroererPeriodeFra = '2024-02-01';
    eoValues.vedroererPeriodeTil = '2024-02-29';
    eoValues.periodeTilBeregningFra = '2024-01-01';
    eoValues.periodeTilBeregningTil = '2024-01-31';

    const ranges = buildBilagIndkomstYdelserRanges(eoValues, 'Perioden');
    expect(ranges).toHaveLength(2);

    const offentligKunBeregningsperiode: OffentligeYdelserRow = {
      id: 'oy-2',
      fraDato: '15-01-2024',
      tilDato: '20-01-2024',
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligKunBeregningsperiode, 'Perioden', ranges)).toBe(true);

    const offentligUdenOverlap: OffentligeYdelserRow = {
      id: 'oy-3',
      fraDato: '01-03-2024',
      tilDato: '15-03-2024',
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligUdenOverlap, 'Perioden', ranges)).toBe(false);
  });

  it('ekskluderer række i Perioden-mode når rækkens dato ikke kan parses (fail-closed)', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.eoNummer = '2';
    eoValues.vedroererPeriodeFra = '2024-02-01';
    eoValues.vedroererPeriodeTil = '2024-02-29';

    const ranges = buildBilagIndkomstYdelserRanges(eoValues, 'Perioden');
    expect(ranges.length).toBeGreaterThan(0);

    const offentligUgyldig: OffentligeYdelserRow = {
      id: 'oy-invalid',
      fraDato: '31-02-2024',
      tilDato: '31-02-2024',
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligUgyldig, 'Perioden', ranges)).toBe(false);

    const loenUgyldigDato = makeLoenRow({
      col0_dag: '31-02-2024',
      col1_dag: '31-02-2024',
    });
    expect(hasAarsloenRowOverlapWithRanges(loenUgyldigDato, 'dag', 'Perioden', ranges)).toBe(false);
  });

  it('filtrerer lønrækker i Perioden-mode selv når ansættelsesforholdet har andre overlap', () => {
    const ranges = [{ fra: '2022-03-18', til: '2024-01-01' }] as const;
    const errorRowIds = new Set<string>();

    const rowIOverlap = makeLoenRow({
      id: 'loen-overlap',
      col0_dag: '01-01-2024',
      col1_dag: '31-01-2024',
      col2: { kind: 'fixed', value: 1000 },
    });
    const rowUdenforPeriode = makeLoenRow({
      id: 'loen-udenfor',
      col0_dag: '01-02-2024',
      col1_dag: '29-02-2024',
      col2: { kind: 'fixed', value: 1000 },
    });

    expect(
      shouldIncludeLoenRowInBilag({
        row: rowIOverlap,
        loenperiode: 'dag',
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(true);
    expect(
      shouldIncludeLoenRowInBilag({
        row: rowUdenforPeriode,
        loenperiode: 'dag',
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });

  it('filtrerer offentlige ydelser i Perioden-mode med samme overlapregel', () => {
    const ranges = [{ fra: '2022-03-18', til: '2024-01-01' }] as const;
    const errorRowIds = new Set<string>();

    const ydelseIOverlap: OffentligeYdelserRow = {
      id: 'oy-overlap',
      fraDato: '15-12-2023',
      tilDato: '15-01-2024',
      ydelsestype: 'sygedagpenge',
    };
    const ydelseUdenforPeriode: OffentligeYdelserRow = {
      id: 'oy-udenfor',
      fraDato: '01-02-2024',
      tilDato: '29-02-2024',
      ydelsestype: 'sygedagpenge',
    };

    expect(
      shouldIncludeOffentligYdelseRowInBilag({
        row: ydelseIOverlap,
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(true);
    expect(
      shouldIncludeOffentligYdelseRowInBilag({
        row: ydelseUdenforPeriode,
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });

  it('ekskluderer lønrække helt før erstatningsperioden', () => {
    const ranges = [{ fra: '2022-03-18', til: '2024-01-01' }] as const;
    const errorRowIds = new Set<string>();

    const rowFoerPeriode = makeLoenRow({
      id: 'loen-foer',
      col0_dag: '01-02-2022',
      col1_dag: '28-02-2022',
      col2: { kind: 'fixed', value: 1000 },
    });

    expect(
      shouldIncludeLoenRowInBilag({
        row: rowFoerPeriode,
        loenperiode: 'dag',
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });

  it('ekskluderer offentlig ydelse helt før erstatningsperioden', () => {
    const ranges = [{ fra: '2022-03-18', til: '2024-01-01' }] as const;
    const errorRowIds = new Set<string>();

    const ydelseFoerPeriode: OffentligeYdelserRow = {
      id: 'oy-foer',
      fraDato: '01-02-2022',
      tilDato: '28-02-2022',
      ydelsestype: 'sygedagpenge',
    };

    expect(
      shouldIncludeOffentligYdelseRowInBilag({
        row: ydelseFoerPeriode,
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });
});
