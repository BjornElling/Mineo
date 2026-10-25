import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { buildEOInspektionSammentaellingModel, buildSvieSmerteContext, buildTaftContext } from '../../../domain/eoInspektion/eoInspektionSammentaelling';
import { collectSammentaellingControlMismatchMessages } from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ErstatningsopgoerelseValues, Loenperiode, OffentligeYdelserRow, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { toISODateString as iso } from '../../../types/branded';

const amount = (value: number) => ({ kind: 'number' as const, value });
const base = (): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: iso('2024-01-01'),
  tafBeregningsperiodeTil: iso('2024-01-31'),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  tafPerioder: [{ id: 'taf', fra: iso('2024-02-01'), til: iso('2024-02-29') }],
});

const verifyIncome = (values: ErstatningsopgoerelseValues) => {
  const model = buildEOInspektionModel(values);
  const controls = buildEOInspektionSammentaellingModel({
    values,
    model,
    svieSmerteContext: buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values),
    taftContext: buildTaftContext(STAMDATA_INITIAL_VALUES, values),
    tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }],
  });
  // Den gyldige naborække skal stadig kontrolleres; en helt tømt kontrol ville skjule asymmetrien.
  expect(controls.beregningsperiodeIndtaegter.length).toBeGreaterThan(0);
  expect(collectSammentaellingControlMismatchMessages([
    ...controls.beregningsperiodeIndtaegter,
    ...controls.tafIndtaegter,
  ])).toEqual([]);
  expect(model.integrityIssues.filter((issue) => issue.severity === 'error')).toEqual([]);
  return controls;
};

describe('indtægtskontrollens to kolonner ved mangelfulde og afvigende rækker', () => {
  const periods: readonly [Loenperiode, Partial<StandardLoenTableRow>][] = [
    ['maaned', { col0_maaned: '01', col1_maaned: '2024' }],
    ['uge', { col0_uge: '1/2024', col1_uge: '5/2024' }],
    ['dag', { col0_dag: iso('2024-01-01'), col1_dag: iso('2024-02-29') }],
  ];

  it.each(periods)('behandler ufuldstændig løn og modregninger ens ved %s', (loenperiode, period) => {
    const rows: StandardLoenTableRow[] = [
      { id: 'gyldig', ...period, col2: amount(10_000) },
      { id: 'ufuldstaendig', col2: amount(500) },
      { id: 'nul', ...period, col2: amount(0) },
      { id: 'modregning', ...period, col2: amount(-100) },
    ];
    for (const [tillaegAngivesSom, fuldLoenUnderFerie] of [
      ['procent', 'Ja'], ['procent', 'Nej'], ['beloeb', 'Ja'], ['beloeb', 'Nej'],
    ] as const) {
      verifyIncome({
        ...base(),
        loenindkomstAnsaettelsesforhold: [{
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          harOverenskomst: false,
          fuldLoenUnderFerie,
          loenperiode,
          tillaegAngivesSom,
          indtaegtsoplysningerTableData: rows,
        }],
      });
    }
  });

  it.each([
    ['manglende start', { fraDato: undefined }],
    ['manglende slutning', { tilDato: undefined }],
    ['omvendte datoer', { fraDato: iso('2024-03-01') }],
    ['manglende type', { ydelsestype: undefined }],
    ['ukendt type', { ydelsestype: 'ukendt' }],
    ['negativt beløb', { ydelse: amount(-100) }],
    ['nulbeløb', { ydelse: amount(0) }],
    ['modgående tillæg', { ydelse: amount(100), tillaeg: amount(-100) }],
    ['type som label', { ydelsestype: 'Sygedagpenge' }],
  ] satisfies readonly [string, Partial<OffentligeYdelserRow>][])(
    'behandler offentlig ydelse med %s ens', (_label, patch) => {
      const row: OffentligeYdelserRow = {
        id: 'gyldig',
        fraDato: iso('2024-01-01'),
        tilDato: iso('2024-02-29'),
        ydelsestype: 'sygedagpenge',
        ydelse: amount(10_000),
      };
      for (const fuldLoenUnderFerie of ['Ja', 'Nej'] as const) {
        const controls = verifyIncome({
          ...base(),
          loenindkomstAnsaettelsesforhold: [{
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            harOverenskomst: false,
            loenPaaHelligdage: 'Almindelig løn',
            fuldLoenUnderFerie,
            loenperiode: 'maaned',
            indtaegtsoplysningerTableData: [{ id: 'loen', col0_maaned: '1', col1_maaned: '2024', col2: amount(1000) }],
          }],
          offentligeYdelserRows: [row, { ...row, id: 'afvigende', ydelse: amount(500), ...patch }],
        });
        expect(controls.beregningsperiodeIndtaegter.find((entry) => entry.label === 'Sygedagpenge')?.control.beregnetValue)
          .toBeGreaterThan(0);
      }
    },
  );
});
