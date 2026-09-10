import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import {
  eoVedroererPeriodeFraField,
  eoTafBeregningsperiodeFraField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowSvieSmerteRows';
import { buildEoTaftRows } from '../../../domain/eoRowEvaluation/eoRowTaftRows';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildTestFieldIssueSet } from '../../utils/fieldIssueTestSupport';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const tafContext = {
  skadedatoISO: iso('2024-01-01'),
  skadelidteFodselsdato: undefined,
  erErhvervssygdom: false,
  endeligEETBeregnetDato: undefined,
  midlertidigEETBeregnetDato: undefined,
  differencekravDato: undefined,
  verserendeKlageEet: false,
} as const;

const svieSmerteContext = {
  skadedatoISO: iso('2023-12-01'),
  erErhvervssygdom: false,
  menAfgoerelseDatoForTabel: undefined,
  menAfgoerelseDato: undefined,
  verserendeKlageMen: false,
} as const;

const rowById = <T extends { id: string }>(rows: readonly T[], id: string): T => {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`Forventet række mangler i testfacit: ${id}`);
  return row;
};

describe('CALC-006 – uafhængigt rækkeprioritets- og periodefacit', () => {
  it('viser den konkrete EO-periodefejl, men undertrykker afledte TAF-/S/S-rækker', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaSvieSmerteGodtgoerelse = 'Ja';
    values.kravPaaTabtArbejdsfortjeneste = 'Ja';
    values.tidligereSsMax = 'Nej';
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-01-31');
    values.svieSmertePerioder = [{
      id: 'ss-1',
      fra: iso('2024-01-01'),
      til: undefined,
      tilstand: 'sygemeldt',
    }];
    values.tafPerioder = [{
      id: 'taf-1',
      fra: iso('2024-01-01'),
      til: undefined,
      loseFeriedage: 0,
    }];

    const result = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      EMPTY_FIELD_ISSUE_SET,
      values,
      buildTestFieldIssueSet(eoVedroererPeriodeFraField.bind(), 'Ugyldig dato')
    );

    expect(rowById(result.allRows, 'erstatningsopgoerelse.vedroererPeriode')).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Fra og med: Ugyldig dato)',
    });
    expect(rowById(result.allRows, 'sviesmerte.periode.ss-1')).toMatchObject({ status: 'error' });
    expect(rowById(result.allRows, 'sviesmerte.beregnetPeriode')).toMatchObject({ status: 'error' });
    expect(rowById(result.allRows, 'taf.periode.taf-1')).toMatchObject({ status: 'error' });

    const priorityIds = new Set([
      'erstatningsopgoerelse.vedroererPeriode',
      'sviesmerte.periode.ss-1',
      'sviesmerte.beregnetPeriode',
      'taf.periode.taf-1',
    ]);
    expect(result.errors.filter((row) => priorityIds.has(row.id)).map((row) => row.id)).toEqual([
      'erstatningsopgoerelse.vedroererPeriode',
      'sviesmerte.periode.ss-1',
    ]);
  });

  it('prioriterer en konkret svie/smerte-række over dens afledte periode- og dagrækker', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmerteHelbredsstatus: 'Sygemeldt' as const,
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmertePerioder: [{
        id: 'ss-1',
        fra: iso('2024-01-01'),
        til: undefined,
        tilstand: 'sygemeldt' as const,
      }],
    };

    const result = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      EMPTY_FIELD_ISSUE_SET,
      values,
      EMPTY_FIELD_ISSUE_SET
    );

    expect(rowById(result.allRows, 'sviesmerte.periode.ss-1')).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Til-dato er ikke angivet)',
    });
    expect(rowById(result.allRows, 'sviesmerte.beregnetPeriode')).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Til-dato er ikke angivet)',
    });
    expect(result.errors.filter((row) => row.id.startsWith('sviesmerte.')).map((row) => row.id)).toEqual([
      'sviesmerte.periode.ss-1',
    ]);
  });

  it('fastholder håndberegnet TAF-facit for SH-dag, ferie og løs feriedag', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
      dagsloenenUdgoer: amount(1000),
      tafPerioder: [{
        id: 'taf-1',
        fra: iso('2024-01-01'),
        til: iso('2024-01-05'),
        loseFeriedage: 1,
      }],
      ferieperioder: [{
        id: 'ferie-1',
        fra: iso('2024-01-02'),
        til: iso('2024-01-03'),
      }],
    };

    const row = rowById(buildEoTaftRows(values, EMPTY_FIELD_ISSUE_SET, tafContext), 'taf.periode.taf-1');

    // 01-01-2024 til 05-01-2024 har fem hverdage, hvor nytårsdag er SH-dag.
    // To hverdage er ferie, én resterende hverdag er løs feriedag: 5 - 1 - 2 - 1 = 1.
    expect(row).toMatchObject({
      status: 'ok',
      displayValue: '5 hverdage - 1 SH-dage - 2 feriedage - 1 løse feriedage = 1 arbejdsdage',
    });
  });

  it('viser både månedssporet og den tomme TAF-indsats som konkrete rækkegrene', () => {
    const monthValues = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesUdFra: 'Angivet månedsløn' as const,
      maanedsloenenUdgoer: amount(10000),
      tafPerioder: [{
        id: 'taf-month',
        fra: iso('2024-01-01'),
        til: iso('2024-01-31'),
        loseFeriedage: 0,
      }],
    };
    const monthRow = rowById(
      buildEoTaftRows(monthValues, EMPTY_FIELD_ISSUE_SET, tafContext),
      'taf.periode.taf-month'
    );
    expect(monthRow).toMatchObject({ status: 'ok', displayValue: '1 måneder' });

    const emptyValues = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [],
    };
    const emptyRows = buildEoTaftRows(emptyValues, EMPTY_FIELD_ISSUE_SET, tafContext);
    expect(rowById(emptyRows, 'taf.ingenTafIEoPerioden')).toMatchObject({
      status: 'warning',
      displayValue: 'Advarsel (Der er ikke angivet nogen TAF-periode i EO-perioden)',
    });
    expect(rowById(emptyRows, 'taf.periode.empty')).toMatchObject({ status: 'ok', displayValue: 'Ingen' });
    expect(emptyRows.find((row) => row.id === 'taf.ophoerSkyldes')).toBeUndefined();
  });

  it('fastholder overlap som svie/smerte-rækkefejl og ikke som gyldig samlet periode', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmerteHelbredsstatus: 'Sygemeldt' as const,
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'fuld' as const,
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmertePerioder: [
        { id: 'ss-1', fra: iso('2024-01-01'), til: iso('2024-01-03'), tilstand: 'sygemeldt' as const },
        { id: 'ss-2', fra: iso('2024-01-03'), til: iso('2024-01-05'), tilstand: 'sygemeldt' as const },
      ],
    };

    const rows = buildEoSvieSmerteRows(values, EMPTY_FIELD_ISSUE_SET, svieSmerteContext);

    expect(rowById(rows, 'sviesmerte.periode.ss-1')).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Der er overlappende perioder)',
    });
    expect(rowById(rows, 'sviesmerte.periode.ss-2')).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Der er overlappende perioder)',
    });
    expect(rowById(rows, 'sviesmerte.beregnetPeriode')).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Der er overlappende perioder)',
    });
  });

  it('prioriterer ugyldig TAF-beregningsperiode over afledt indkomst og ferie', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      beregnesUdFra: 'Beregningsperiode' as const,
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-01-31'),
      fravaerPerioder: [{
        id: 'fravaer-1',
        fra: iso('2024-01-02'),
        til: undefined,
      }],
    };

    const result = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      EMPTY_FIELD_ISSUE_SET,
      values,
      buildTestFieldIssueSet(eoTafBeregningsperiodeFraField.bind(), 'Ugyldig dato')
    );
    const rowsById = new Map(result.allRows.map((row) => [row.id, row]));

    expect(rowsById.get('taf.beregningsgrundlag.beregningsperiode')).toMatchObject({
      status: 'error',
      displayValue: 'Fejl (Fra og med: Ugyldig dato)',
    });
    expect(rowsById.get('taf.beregningsgrundlag.indkomst')).toMatchObject({ status: 'error' });
    expect(rowsById.get('taf.beregningsgrundlag.ferie.fravaer-1')).toMatchObject({ status: 'error' });

    const priorityIds = new Set([
      'taf.beregningsgrundlag.beregningsperiode',
      'taf.beregningsgrundlag.indkomst',
      'taf.beregningsgrundlag.ferie.fravaer-1',
    ]);
    expect(result.errors.filter((row) => priorityIds.has(row.id)).map((row) => row.id)).toEqual([
      'taf.beregningsgrundlag.beregningsperiode',
    ]);
  });
});
