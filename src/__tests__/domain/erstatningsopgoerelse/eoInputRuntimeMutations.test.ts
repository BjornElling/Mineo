// @vitest-environment jsdom
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  persistedErstatningsopgoerelseSchema, stamdataSchema,
  type PersistedLoenindkomstAnsaettelsesforhold,
  type SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { runEoPage, type EoRuntimeCase } from './helpers/eoRuntimePage';

const iso = toISODateString;
const amount = (value: number) => ({ kind: 'number' as const, value });
const loenRows = (startMonth: number, startYear: number, count: number, value = 30000) =>
  Array.from({ length: count }, (_, index) => {
    const m0 = startMonth - 1 + index;
    return {
      id: `l${index}`,
      col0_maaned: String((m0 % 12) + 1),
      col1_maaned: String(startYear + Math.floor(m0 / 12)),
      col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined,
      col2: amount(value), col3: undefined, col4: undefined, col5: undefined,
    };
  });

const employment = (id: string): PersistedLoenindkomstAnsaettelsesforhold => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id,
  navnPaaArbejdssted: 'Arbejdsplads',
  harOverenskomst: false,
  feriePct: 12.5,
  loenperiode: 'maaned',
  loenPaaHelligdage: 'Almindelig løn',
  fuldLoenUnderFerie: 'Ja',
  loenudviklingBeregningsgrundlag: 'Ingen',
  indtaegtsoplysningerTableData: loenRows(6, 2017, 12),
});

const sfggIngen = (id: string): SygeferiegodtgoerelseAnsaettelsesforholdRow => ({
  ansaettelsesforholdId: id, sfggBeregningskilde: 'Ingen', sfggManuelDagssats: undefined,
  sfggManuelBeloebIHenholdTil: undefined, sfggManuelFoerstEfterSygeloen: 'Nej', sfggReferenceperiodeFra: undefined,
  sfggReferenceperiodeTil: undefined, sfggReferenceperiodeFravaersdageUdenLoen: 0, sfggSatsvalg: undefined,
  sfggAlleredeBetaltBeloeb: undefined,
});

const baseCase = (): EoRuntimeCase => {
  const init = createErstatningsopgoerelseInitialValues();
  return {
    seed: 0,
    stamdata: stamdataSchema.parse({
      journalnr: 'J-1', advokat: 'A', sagsbehandler: 'S', skadelidte: 'T', skadestype: 'Arbejdsulykke',
      skadedato: '2018-06-01', skadelidteFodselsdato: '1980-01-01',
    }),
    erstatningsopgoerelse: persistedErstatningsopgoerelseSchema.parse({
      ...init,
      tafArbejdsstatus: 'Uarbejdsdygtig',
      eoNummer: '1',
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
      svieSmerteHelbredsstatus: 'Sygemeldt',
      svieSmertePerioder: [{ id: 's1', fra: '2024-01-01', til: '2024-03-31', tilstand: 'sygemeldt' }],
      svieSmerteSatserAar: 2024,
      kravPaaOevrigeErstatningskrav: 'Ja',
      oevrigeKravPerioder: [{ id: 'o1', dato: '2024-02-01', udgiftTil: 'Transport', beloeb: amount(1000) }],
      vedroererPeriodeFra: '2024-01-01',
      vedroererPeriodeTil: '2024-12-31',
      opgørelseLavetDen: '2025-02-01',
      tafPerioder: [{ id: 't1', fra: '2024-01-01', til: '2024-12-31', loseFeriedage: undefined }],
      ferieperioder: [],
      fravaerPerioder: [],
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: '2017-06-01',
      tafBeregningsperiodeTil: '2018-05-31',
      loenindkomstAnsaettelsesforhold: [employment('af-1')],
      sfggAnsaettelsesforhold: [sfggIngen('af-1')],
      offentligeYdelserRows: [],
      eoAngivetLoenLoenudvikling: { ...init.eoAngivetLoenLoenudvikling, loenudviklingBeregningsgrundlag: 'Ingen' },
    }),
  };
};


/** De målrettede mutationer bevarer auditprobernes dybe beregningsgrene uden maskinlokale logfiler. */
const mutations: ReadonlyArray<readonly [string, (input: EoRuntimeCase) => void]> = [
  ['tom TAF-periode', ({ erstatningsopgoerelse: eo }) => { eo.tafPerioder = []; }],
  ['ufuldstændig TAF-periode', ({ erstatningsopgoerelse: eo }) => { eo.tafPerioder[0]!.til = undefined; }],
  ['TAF kun på en helligdag', ({ erstatningsopgoerelse: eo }) => {
    eo.tafPerioder = [{ id: 'taf', fra: iso('2024-12-25'), til: iso('2024-12-25'), loseFeriedage: 5 }];
  }],
  ['ferie dækker hele TAF-perioden', ({ erstatningsopgoerelse: eo }) => {
    eo.ferieperioder = [{ id: 'ferie', fra: iso('2024-01-01'), til: iso('2024-12-31') }];
  }],
  ['fravær dækker hele beregningsperioden', ({ erstatningsopgoerelse: eo }) => {
    eo.fravaerPerioder = [{ id: 'fravaer', fra: iso('2017-06-01'), til: iso('2018-05-31') }];
  }],
  ['uspecificeret ferie overstiger arbejdsdagene', ({ erstatningsopgoerelse: eo }) => { eo.uspecificeredeFerieFridage = 10000; }],
  ['øvrigt fravær overstiger arbejdsdagene', ({ erstatningsopgoerelse: eo }) => {
    eo.oevrigtFravaerUdenLoen = 'Ja'; eo.oevrigeFravaersdage = 10000;
  }],
  ['beregningsperiode overlapper TAF', ({ erstatningsopgoerelse: eo }) => {
    eo.tafBeregningsperiodeFra = iso('2023-06-01'); eo.tafBeregningsperiodeTil = iso('2024-05-31');
  }],
  ['beregningsperiode på én weekenddag', ({ erstatningsopgoerelse: eo }) => {
    eo.tafBeregningsperiodeFra = iso('2018-01-06'); eo.tafBeregningsperiodeTil = iso('2018-01-06');
  }],
  ['ingen ansættelser', ({ erstatningsopgoerelse: eo }) => { eo.loenindkomstAnsaettelsesforhold = []; }],
  ['to ansættelser', ({ erstatningsopgoerelse: eo }) => {
    eo.loenindkomstAnsaettelsesforhold.push(employment('af-2')); eo.sfggAnsaettelsesforhold.push(sfggIngen('af-2'));
  }],
  ['SFGG uden tilsvarende ansættelse', ({ erstatningsopgoerelse: eo }) => { eo.sfggAnsaettelsesforhold.push(sfggIngen('slettet')); }],
  ['ingen SFGG-rækker', ({ erstatningsopgoerelse: eo }) => { eo.sfggAnsaettelsesforhold = []; }],
  ['negativ løn', ({ erstatningsopgoerelse: eo }) => {
    eo.loenindkomstAnsaettelsesforhold[0]!.indtaegtsoplysningerTableData = loenRows(6, 2017, 12, -100);
  }],
  ['forlig med udefineret brøk', ({ erstatningsopgoerelse: eo }) => { eo.forligAnsvarsgradBroek = '1/0'; }],
  ['forlig med meget lille brøk', ({ erstatningsopgoerelse: eo }) => { eo.forligAnsvarsgradBroek = '1/999999999'; }],
];

describe('EO-input – målrettede mutationer af en udfyldt TAF-sag', () => {
  it('har en schema-gyldig grundsag uden runtimefejl', () => {
    expect(runEoPage(baseCase())).toEqual([]);
  });

  it.each(mutations)('afviser eller beregner kontrolleret: %s', (_name, mutate) => {
    const input = baseCase();
    mutate(input);
    expect(persistedErstatningsopgoerelseSchema.safeParse(input.erstatningsopgoerelse).success).toBe(true);
    expect(runEoPage(input)).toEqual([]);
  });

  it.each([0, 0.01, 0.07, 1, 30000])('tåler små lønbeløb og alle reguleringskilder med SFGG: %s', (value) => {
    for (const source of ['Ingen', 'KL-lønaftaler', 'Statistik', 'Manuel procentsats', 'Overenskomst'] as const) {
      for (const sfggSource of ['Ingen', 'Ferieloven'] as const) {
        const input = baseCase();
        const eo = input.erstatningsopgoerelse;
        const employment = eo.loenindkomstAnsaettelsesforhold[0]!;
        employment.indtaegtsoplysningerTableData = loenRows(6, 2017, 12, value);
        employment.fuldLoenUnderFerie = 'Nej';
        employment.loenudviklingBeregningsgrundlag = source;
        employment.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';
        employment.loenudviklingManuelProcentsatsTableData = [
          { id: 'basis', dato: iso('2018-05-31'), procent: undefined },
          { id: 'stigning', dato: iso('2020-01-01'), procent: 2 },
        ];
        employment.harOverenskomst = source === 'Overenskomst';
        employment.overenskomstId = 'kl-overenskomst';
        const sfgg = eo.sfggAnsaettelsesforhold[0]!;
        sfgg.sfggBeregningskilde = sfggSource;
        sfgg.sfggReferenceperiodeFra = iso('2017-06-01');
        sfgg.sfggReferenceperiodeTil = iso('2018-05-31');
        expect(runEoPage(input), `${source}/${sfggSource}/${value}`).toEqual([]);
      }
    }
  }, 60000);

  it.each([undefined, '2024-12-31'] as const)('tåler EET-import med beregningsdato %s og delvise afgørelser', (date) => {
    for (const complete of [false, true]) {
      const input = baseCase();
      input.erstatningsopgoerelse.midlertidigtEetFraEetSiden = 'Ja';
      expect(runEoPage({
        ...input,
        faellesAarsloen: { aslAarsloen: amount(400000), ealAarsloen: undefined },
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: date === undefined ? undefined : iso(date),
          aslAfgoerelser: [{
            id: 'afgoerelse', afgoerelsesDato: complete ? iso('2024-03-01') : undefined,
            virkningsDato: iso('2024-01-01'), eetPct: complete ? 50 : undefined,
            kapDato: undefined, kapPct: undefined, afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined, fsTilbageholdtEet: 'Nej',
          }],
        },
      })).toEqual([]);
    }
  });
});
