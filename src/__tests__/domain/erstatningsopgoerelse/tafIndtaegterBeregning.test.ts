import { buildTafIndtaegterBeregning } from '../../../domain/erstatningsopgoerelse/engines/tafIndtaegterBeregning';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { fromKroner } from '../../../domain/money/money';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { ydelsestypeKeys, ydelsestyper } from '../../../data/ydelsestyper';

const iso = toISODateString;
const amount = (value: number): AmountValue => ({ kind: 'number', value });
const ranges = [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }];

const makeValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  beregnesUdFra: 'Angivet månedsløn' as const,
  loenindkomstAnsaettelsesforhold: [1000, 2000].map((wage, index) => ({
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: `job-${index}`,
    navnPaaArbejdssted: '',
    loenperiode: 'dag' as const,
    tillaegAngivesSom: 'beloeb' as const,
    beregnStoreBededagstillaeg: false,
    indtaegtsoplysningerTableData: [{
      id: `wage-${index}`,
      col0_dag: iso('2024-01-01'), col1_dag: iso('2024-01-31'),
      col2: amount(wage),
    }],
  })),
  offentligeYdelserRows: [
    { id: 'eet', fraDato: iso('2024-01-01'), tilDato: iso('2024-01-31'), ydelse: amount(100.8), ydelsestype: 'midlertidigt_eet' },
    { id: 'dagpenge', fraDato: iso('2024-01-01'), tilDato: iso('2024-01-31'), ydelse: amount(200), ydelsestype: 'dagpenge' },
  ],
});

const groups: readonly MidlertidigtEetAfgoerelseGroup[] = [{
  afgoerelsesdato: iso('2024-01-01'), eetPct: 20, rows: [],
  perioder: [
    { fra: iso('2024-01-01'), til: iso('2024-01-31') },
    { fra: iso('2024-02-01'), til: iso('2024-02-29') },
  ].map((range) => ({
    ...range, satsAar: 2024, maanederPraecis: 1,
    grundydelseAfrundetOre: fromKroner(100), reguleringPct: 0,
    maanedligYdelseOre: fromKroner(50.4), beregnetEetOre: fromKroner(50.4),
  })),
}];

describe('buildTafIndtaegterBeregning', () => {
  it.each(ydelsestypeKeys)('bevarer hele indkomsten for ydelsestypen %s, også med historisk gemt visningsnavn', (typeKey) => {
    for (const storedType of [typeKey, ydelsestyper[typeKey].label]) {
      const values = {
        ...makeValues(), loenindkomstAnsaettelsesforhold: [],
        offentligeYdelserRows: [{
          id: 'ydelse', fraDato: ranges[0].fra, tilDato: ranges[0].til,
          ydelsestype: storedType, ydelse: amount(123.45),
        }],
      };
      const result = buildTafIndtaegterBeregning(values, ranges, { midlertidigtEetGroups: [] });
      expect(result.entries).toEqual([{
        kind: 'ydelse', typeKey, imported: false, label: ydelsestyper[typeKey].label, amountOre: 12345,
      }]);
      expect(result.totalOre).toBe(12345);
    }
  });

  it('medtager alle ansættelser og ydelsestyper med stabile kilder og samme afrunding', () => {
    const values = makeValues();
    const before = structuredClone(values);
    const result = buildTafIndtaegterBeregning(values, ranges, { midlertidigtEetGroups: [] });
    expect(result.entries).toEqual([
      { kind: 'loen', employmentId: 'job-0', label: 'Ansættelsesforhold 1', amountOre: 100000 },
      { kind: 'loen', employmentId: 'job-1', label: 'Ansættelsesforhold 2', amountOre: 200000 },
      { kind: 'ydelse', typeKey: 'dagpenge', imported: false, label: 'Dagpenge', amountOre: 20000 },
      { kind: 'ydelse', typeKey: 'midlertidigt_eet', imported: false, label: 'Midlertidigt EET', amountOre: 10080 },
    ]);
    expect(result.totalOre).toBe(330080);
    expect(values).toEqual(before);
  });

  it('bruger EET-bilagets afrunding pr. periode frem for at afrunde den samlede indkomst', () => {
    const base = makeValues();
    const values = {
      ...base, midlertidigtEetFraEetSiden: 'Ja' as const,
      offentligeYdelserRows: base.offentligeYdelserRows.map((row) => row.ydelsestype === 'midlertidigt_eet'
        ? { ...row, tilDato: iso('2024-02-29') }
        : row),
    };
    const result = buildTafIndtaegterBeregning(values, [{ fra: iso('2024-01-01'), til: iso('2024-02-29') }], { midlertidigtEetGroups: groups });
    // To perioder á 50,40 kr. bliver 50 + 50 kr.; rå totalafrunding ville give 101 kr.
    expect(result.entries.at(-1)).toEqual({
      kind: 'ydelse', typeKey: 'midlertidigt_eet', imported: true, label: 'Midlertidigt EET', amountOre: 10000,
    });
    expect(result.totalOre).toBe(330000);
  });

  it('giver ingen indkomst uden valgte perioder', () => {
    expect(buildTafIndtaegterBeregning(makeValues(), [], { midlertidigtEetGroups: groups })).toEqual({
      entries: [], forbeholdYdelsestyper: [], totalOre: 0,
    });
  });
});
