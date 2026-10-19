// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { withSfggIngenForEmployments } from '../../utils/sfggTestSupport';
import { calculateLoenindkomstRowDerived } from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstRowDerived';
import { shouldIncludeLoenRowInEoBilag } from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import { sortStandardLoenRowsChronologically } from '../../../domain/standardLoen/standardLoenRowOrder';
import { renderOffentligeYdelserRowsPage } from '../../../document/generators/eo/sections/offentligeYdelserSection';
import type { RowSpec } from '../../../document/layout/tableSpec';
import { renderEoBilagSections } from '../../../document/generators/eo/sections/eoBilagSections';
import type { DocumentComposer } from '../../../document/model/documentModel';

// Brugerblik 12h (ansættelsesforholdets indtægtsoplysninger), udviklerafgørelser 2026-10-19. Testene går gennem
// den rigtige reader, så cellens issue, «Fejl og advarsler», blokeringen og kravet læser samme tilstand som skærmen.

type Ansaettelse = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

const catalog = getProductionInputCatalog();
const iso = (value: string) => toISODateString(value);
const amount = (value: number) => ({ kind: 'number' as const, value });

const stamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'T',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2018-06-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

/** Tolv lønrækker à 30.000 kr. fra den angivne måned, som fundets sag. */
const loenRaekker = (fra = { maaned: 6, aar: 2017 }, antal = 12) => Array.from({ length: antal }, (_, index) => {
  const maaned0 = fra.maaned - 1 + index;
  return {
    id: `l${index}`,
    col0_maaned: String((maaned0 % 12) + 1),
    col1_maaned: String(fra.aar + Math.floor(maaned0 / 12)),
    col0_uge: '',
    col1_uge: '',
    col0_dag: undefined,
    col1_dag: undefined,
    col2: amount(30000),
    col3: undefined,
    col4: undefined,
    col5: undefined,
  };
});

const ansaettelse = (patch: Partial<Ansaettelse> = {}): Ansaettelse => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  navnPaaArbejdssted: 'Firma A',
  feriePct: 12.5,
  loenperiode: 'maaned' as const,
  loenPaaHelligdage: 'Almindelig løn' as const,
  fuldLoenUnderFerie: 'Ja',
  loenudviklingBeregningsgrundlag: 'Ingen' as const,
  indtaegtsoplysningerTableData: loenRaekker(),
  ...patch,
});

const sag = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => withSfggIngenForEmployments({
  ...createErstatningsopgoerelseInitialValues(),
  tafArbejdsstatus: 'Uarbejdsdygtig',
  eoNummer: '1',
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  kravPaaOevrigeErstatningskrav: 'Nej',
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-12-31'),
  opgørelseLavetDen: iso('2025-02-01'),
  tafPerioder: [{ id: 't1', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined }],
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: iso('2017-06-01'),
  tafBeregningsperiodeTil: iso('2018-05-31'),
  loenindkomstAnsaettelsesforhold: [ansaettelse()],
  ...patch,
  eoAngivetLoenLoenudvikling: {
    ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
    loenudviklingBeregningsgrundlag: 'Ingen',
    ...patch.eoAngivetLoenLoenudvikling,
  },
});

const project = (eo: ErstatningsopgoerelseValues, stamdataPatch: Partial<StamdataValues> = {}) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: { ...stamdata, ...stamdataPatch }, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null, varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });
  const rows = collectAllEoRows(
    projection.stamdataValues,
    projection.stamdataErrors,
    projection.eoValues,
    projection.eoErrors,
    {},
    undefined,
    projection.snapshot.data?.canonicalOutput,
    projection.snapshot.data?.pdfModel,
  );
  const linjer = (list: typeof rows.errors) => list.map((row) => row.summaryText ?? row.message ?? row.displayValue);
  return { projection, evaluation, rows, errorLinjer: linjer(rows.errors), warningLinjer: linjer(rows.warnings) };
};

const kravKr = (result: ReturnType<typeof project>): number | undefined => {
  const ore = result.projection.snapshot.data?.canonicalOutput.totals.tabtArbejdsfortjenesteOre;
  return ore === undefined ? undefined : Number(ore) / 100;
};
const invariantIds = (result: ReturnType<typeof project>): readonly string[] =>
  (result.projection.snapshot.invariants ?? []).map((invariant) => invariant.id);
const raekke = (id: string, maaned: number, aar: number, loen: number) => ({
  ...loenRaekker()[0]!,
  id,
  col0_maaned: String(maaned),
  col1_maaned: String(aar),
  col2: amount(loen),
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('grundsagen', () => {
  it('giver kravet 405.000,00 kr. uden fejl og advarsler', () => {
    const result = project(sag());

    expect(result.projection.snapshot.status).toBe('ok');
    expect(kravKr(result)).toBe(405000);
    expect(result.errorLinjer).toEqual([]);
  });
});

describe('BB-289 – identiske lønrækker advarer, men spærrer ikke', () => {
  it('giver en gul linje, der navngiver rækken, og regner begge rækker med', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        indtaegtsoplysningerTableData: [...loenRaekker(), raekke('kopi', 6, 2017, 30000)],
      })],
    }));

    expect(result.warningLinjer).toContain('Lønrækken 06-2017 er identisk med en tidligere række');
    expect(result.errorLinjer).toEqual([]);
    expect(result.projection.snapshot.status).toBe('ok');
  });

  it('vurderer inden for det enkelte ansættelsesforhold – ikke på tværs', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [
        ansaettelse(),
        ansaettelse({ id: 'af-2', navnPaaArbejdssted: 'Firma B', indtaegtsoplysningerTableData: [raekke('b1', 6, 2017, 30000)] }),
      ],
    }));

    expect(result.warningLinjer.some((linje) => linje.includes('identisk'))).toBe(false);
  });

  it('advarer også om identiske ydelsesrækker', () => {
    const ydelse = {
      fraDato: iso('2017-07-01'), tilDato: iso('2017-07-31'), ydelse: amount(5000), tillaeg: undefined, ydelsestype: 'dagpenge',
    };
    const result = project(sag({ offentligeYdelserRows: [{ id: 'y1', ...ydelse }, { id: 'y2', ...ydelse }] }));

    expect(result.warningLinjer.some((linje) => linje.endsWith('er identisk med en tidligere række'))).toBe(true);
    expect(result.errorLinjer).toEqual([]);
  });
});

describe('BB-290 – en negativ række regnes med og modregnes', () => {
  it('modregner en negativ række i beregningsperioden uden kontroluoverensstemmelse', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        indtaegtsoplysningerTableData: [...loenRaekker(), raekke('neg', 7, 2017, -2000)],
      })],
    }));

    expect(invariantIds(result)).not.toContain('control:sammentaelling_mismatch');
    expect(result.projection.snapshot.status).toBe('ok');
    // (360.000 − 2.000) × 1,125
    expect(kravKr(result)).toBe(402750);
    expect(result.warningLinjer.some((linje) =>
      linje.startsWith('Lønrækken 07-2017 har negativ samlet løn (-2.250,00 kr.)'))).toBe(true);
    expect(result.errorLinjer).toEqual([]);
  });

  it('modregner en negativ række i erstatningsperioden i fradraget', () => {
    const udenFradrag = kravKr(project(sag()));
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        indtaegtsoplysningerTableData: [...loenRaekker(), raekke('m', 3, 2024, 10000), raekke('a', 4, 2024, -3000)],
      })],
    }));

    expect(invariantIds(result)).not.toContain('control:sammentaelling_mismatch');
    expect(result.projection.snapshot.status).toBe('ok');
    // Fradraget er (10.000 − 3.000) × 1,125 = 7.875 kr.
    expect(udenFradrag! - kravKr(result)!).toBeCloseTo(7875, 2);
  });

  it('spærrer med en navngiven linje – ikke en intern fejl – når et ansættelsesforhold samlet er negativt', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [
        ansaettelse(),
        ansaettelse({ id: 'af-2', navnPaaArbejdssted: 'Firma B', indtaegtsoplysningerTableData: [raekke('b1', 7, 2017, -2000)] }),
      ],
    }));

    expect(result.errorLinjer.some((linje) =>
      linje.startsWith('Lønnen fra Firma B er samlet negativ i beregningsperioden (-2.250,00 kr.)'))).toBe(true);
    expect(result.projection.snapshot.failClosedReason).not.toBe('runtime_exception');
    expect(invariantIds(result)).not.toContain('control:sammentaelling_mismatch');
  });

  it('modregner en negativ ydelsesrække i ydelsestypens øvrige beløb', () => {
    const result = project(sag({
      offentligeYdelserRows: [
        { id: 'y1', fraDato: iso('2024-03-01'), tilDato: iso('2024-03-31'), ydelse: amount(5000), tillaeg: undefined, ydelsestype: 'dagpenge' },
        { id: 'y2', fraDato: iso('2024-04-01'), tilDato: iso('2024-04-30'), ydelse: amount(-1000), tillaeg: undefined, ydelsestype: 'dagpenge' },
      ],
    }));

    expect(invariantIds(result)).not.toContain('control:sammentaelling_mismatch');
    expect(result.projection.snapshot.status).toBe('ok');
    expect(result.warningLinjer.some((linje) => linje.includes('er negativ (-1.000,00 kr.)'))).toBe(true);
  });

  it('lader en række på 0 kr. være uændret', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        indtaegtsoplysningerTableData: [...loenRaekker(undefined, 11), raekke('nul', 5, 2018, 0)],
      })],
    }));

    expect(result.projection.snapshot.status).toBe('ok');
    expect(kravKr(result)).toBe(371250);
    expect(result.warningLinjer.some((linje) => linje.includes('negativ'))).toBe(false);
  });
});

describe('BB-291 – én linje pr. fejlbehæftet lønrække med cellens egen tekst og link til cellen', () => {
  it('navngiver en rød måned med cellens tekst og melder ikke et hul for samme fejl', () => {
    const raekker = loenRaekker();
    raekker[0] = { ...raekker[0]!, col0_maaned: '13' };
    const result = project(sag({ loenindkomstAnsaettelsesforhold: [ansaettelse({ indtaegtsoplysningerTableData: raekker })] }));

    const linje = result.rows.errors.find((row) => row.id.startsWith('loenindkomst.af-1.loenoplysninger.'));
    expect(linje?.summaryText).toMatch(/^Række 1: Måned – /);
    expect(linje?.summaryText).not.toContain('ikke angivet');
    expect(linje?.focusTarget).toMatchObject({ kind: 'fieldAddress', address: { field: 'col0_maaned' } });
    expect([...result.errorLinjer, ...result.warningLinjer].some((tekst) => tekst.includes('hverken angivet løn'))).toBe(false);
  });

  it('giver hver fejlbehæftet række sin egen linje', () => {
    const raekker = loenRaekker();
    raekker[2] = { ...raekker[2]!, col0_maaned: '' };
    raekker[5] = { ...raekker[5]!, col1_maaned: '' };
    const result = project(sag({ loenindkomstAnsaettelsesforhold: [ansaettelse({ indtaegtsoplysningerTableData: raekker })] }));

    expect(result.errorLinjer).toEqual(expect.arrayContaining([
      'Række 3: Måned er ikke angivet',
      'Række 6: År er ikke angivet',
    ]));
  });

  it('gør en omvendt uge-periode rød på begge celler med hver sin udvej (BB-295)', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        loenperiode: 'uge',
        indtaegtsoplysningerTableData: [{ ...loenRaekker()[0]!, col0_maaned: '', col1_maaned: '', col0_uge: '10/2018', col1_uge: '05/2018' }],
      })],
    }));

    const messages = result.projection.eoErrors.all
      .filter((issue) => issue.code.endsWith('.weekOrder'))
      .map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([
      'Uge fra skal ligge før eller i uge til (05/2018)',
      'Uge til skal ligge efter eller i uge fra (10/2018)',
    ]));
  });
});

describe('BB-298 – en lønperiode efter dags dato får en gul advarsel', () => {
  it('advarer om en måned efter dags dato, men ikke om den igangværende', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        indtaegtsoplysningerTableData: [...loenRaekker(), raekke('okt', 10, 2026, 30000), raekke('dec', 12, 2026, 30000)],
      })],
    }));

    expect(result.warningLinjer).toContain('Lønrækken 12-2026 ligger efter dags dato (19-10-2026)');
    expect(result.warningLinjer.some((linje) => linje.startsWith('Lønrækken 10-2026'))).toBe(false);
  });
});

describe('BB-292 – en række, beregningen medregner, står med sit beløb i tabel og bilag', () => {
  it('viser en weekendrække med det beløb, beregningen bruger', () => {
    const af = ansaettelse({
      loenperiode: 'dag',
      fuldLoenUnderFerie: 'Nej',
      indtaegtsoplysningerTableData: [
        { ...loenRaekker()[0]!, id: 'd1', col0_maaned: '', col1_maaned: '', col0_dag: iso('2017-06-01'), col1_dag: iso('2018-05-04'), col2: amount(340000) },
        { ...loenRaekker()[0]!, id: 'd2', col0_maaned: '', col1_maaned: '', col0_dag: iso('2018-05-05'), col1_dag: iso('2018-05-06'), col2: amount(2000) },
      ],
    });
    const values = sag({ loenindkomstAnsaettelsesforhold: [af] });

    const weekend = calculateLoenindkomstRowDerived({ row: af.indtaegtsoplysningerTableData[1]!, ansaettelsesforhold: af, context: values });
    expect(weekend.samlet).toBe(2250);
  });

  it('tager en række med kun tillæg med i bilaget i Beløb-tilstand', () => {
    const row = { ...loenRaekker()[0]!, col2: undefined, fpFvShSoBeloeb: amount(10000) };
    const params = {
      row,
      loenperiode: 'maaned' as const,
      mode: 'Alle' as const,
      ranges: [],
      errorRowIds: new Set<string>(),
    };

    expect(shouldIncludeLoenRowInEoBilag({ ...params, tillaegAngivesSom: 'beloeb' })).toBe(true);
    expect(shouldIncludeLoenRowInEoBilag({ ...params, tillaegAngivesSom: 'procent' })).toBe(false);
  });
});

describe('BB-294 – bilaget trykker rækkerne kronologisk', () => {
  it('sorterer efter periode uanset tabellens rækkefølge og bevarer rækkefølgen for samme periode', () => {
    const rows = [
      raekke('a', 1, 2018, 1),
      raekke('b', 6, 2017, 2),
      raekke('c', 12, 2017, 3),
      raekke('d', 6, 2017, 4),
      { ...raekke('e', 1, 2018, 5), col0_maaned: '' },
    ];

    expect(sortStandardLoenRowsChronologically(rows, 'maaned').map((row) => row.id)).toEqual(['b', 'd', 'c', 'a', 'e']);
  });
});

describe('BB-294 – ydelsesbilaget trykker også rækkerne kronologisk', () => {
  it('sorterer efter fra-dato uanset tabellens rækkefølge', () => {
    const tables: RowSpec[][] = [];
    const ydelse = (id: string, fra: string, til: string) => ({
      id, fraDato: iso(fra), tilDato: iso(til), ydelse: amount(1000), tillaeg: undefined, ydelsestype: 'dagpenge',
    });
    renderOffentligeYdelserRowsPage({
      rows: [ydelse('c', '2024-03-01', '2024-03-31'), ydelse('a', '2024-01-01', '2024-01-31'), ydelse('b', '2024-02-01', '2024-02-29')],
      writer: {
        addSectionSpacer: () => undefined,
        writeUnderlinedSubheader: () => undefined,
        writeWrappedText: () => undefined,
        addTable: (table) => { tables.push([...table.rows]); },
      },
    });

    expect(tables[0]!.slice(1).map((row) => row.cells[0]?.text)).toEqual(['01-01-2024', '01-02-2024', '01-03-2024']);
  });
});

/** Bilagenes tekstlinjer, som de skrives under tabellerne – gennem den rigtige bilagsrenderer og opgørelsens model. */
const bilagTekstlinjer = (result: ReturnType<typeof project>): readonly string[] => {
  const model = result.projection.snapshot.data?.pdfModel;
  if (!model) throw new Error('Opgørelsens model mangler');
  const linjer: string[] = [];
  // Kun teksten aflæses; alle øvrige skrivekald er uden betydning for påstandene.
  const writer = new Proxy({}, {
    get: (_target, key) => (key === 'writeWrappedText'
      ? (text: string) => { linjer.push(text); }
      : () => undefined),
  }) as DocumentComposer;
  renderEoBilagSections({
    writer,
    model,
    eoValues: result.projection.eoValues,
    stamdataValues: result.projection.stamdataValues as StamdataValues,
    selectedElements: {
      opgoerelse: true, loenindkomst: true, offentligeYdelser: true, midlertidigEet: false,
      shDage: false, regulering: false, okSatser: false, sygeferiegodtgoerelse: false,
    },
  });
  return linjer;
};
const delvisLinjer = (result: ReturnType<typeof project>) =>
  bilagTekstlinjer(result).filter((linje) => /delvist indgår|i (beregnings|erstatnings)perioden, /.test(linje));
const datoRaekke = (id: string, fra: string, til: string, loen: number) => ({
  ...loenRaekker()[0]!, id, col0_maaned: '', col1_maaned: '', col0_dag: iso(fra), col1_dag: iso(til), col2: amount(loen),
});

describe('BB-293 – bilaget forklarer under tabellen, når en periode skærer igennem en række', () => {
  it('forklarer en lønseddel, der kun delvist ligger i beregningsperioden, med beregningens egne tal', () => {
    // 31 af rækkens 61 kalenderdage ligger i beregningsperioden: 60.000 × 31/61 = 30.491,80 kr. i løn og
    // 34.303,28 kr. med 12,5 % feriegodtgørelse – grundlagets «Løn i beregningsperioden» er 360.491,80 kr.
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        loenperiode: 'dag',
        indtaegtsoplysningerTableData: [
          datoRaekke('d1', '2017-06-01', '2018-04-30', 330000),
          datoRaekke('d2', '2018-05-01', '2018-06-30', 60000),
        ],
      })],
    }));

    expect(result.errorLinjer).toEqual([]);
    expect(delvisLinjer(result)).toEqual([
      'Lønperioder, der kun delvist indgår, medregnes forholdsmæssigt:',
      '01-05-2018 - 30-06-2018: 31 af 61 kalenderdage i beregningsperioden, 34.303,28 af 67.500,00 kr.',
    ]);
  });

  it('forklarer en lønseddel og en ydelse, der kun delvist ligger i erstatningsperioden', () => {
    // 15 af 32 kalenderdage (15-12-2023 – 15-01-2024) ligger i erstatningsperioden fra 01-01-2024.
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        loenperiode: 'dag',
        indtaegtsoplysningerTableData: [
          datoRaekke('d1', '2017-06-01', '2018-05-31', 360000),
          datoRaekke('d2', '2023-12-15', '2024-01-15', 10000),
        ],
      })],
      offentligeYdelserRows: [{
        id: 'y1', fraDato: iso('2023-12-15'), tilDato: iso('2024-01-15'), ydelse: amount(16000), tillaeg: undefined,
        ydelsestype: 'dagpenge',
      }],
    }));

    expect(result.errorLinjer).toEqual([]);
    expect(delvisLinjer(result)).toEqual([
      'Lønperioder, der kun delvist indgår, medregnes forholdsmæssigt:',
      '15-12-2023 - 15-01-2024: 15 af 32 kalenderdage i erstatningsperioden, 5.273,44 af 11.250,00 kr.',
      'Ydelser, der kun delvist indgår, medregnes forholdsmæssigt:',
      '15-12-2023 - 15-01-2024: 15 af 32 kalenderdage i erstatningsperioden, 7.500,00 af 16.000,00 kr.',
    ]);
  });

  it('skriver ingen linje, når ingen række skæres over', () => {
    expect(delvisLinjer(project(sag()))).toEqual([]);
  });

  it('forklarer ikke beregningsperioden i en senere opgørelse, der kun viser det tidligere beregnede beløb', () => {
    // «Alle» trykker rækkerne fra beregningsperioden, men grundlaget står komprimeret – der er ingen udregning at
    // afstemme med. Erstatningsperiodens overskæring forklares fortsat.
    const values = sag({
      eoNummer: '2',
      komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
      eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Alle',
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        loenperiode: 'dag',
        indtaegtsoplysningerTableData: [
          datoRaekke('d1', '2017-06-01', '2018-04-30', 330000),
          datoRaekke('d2', '2018-05-01', '2018-06-30', 60000),
          datoRaekke('d3', '2023-12-15', '2024-01-15', 10000),
        ],
      })],
    });
    const result = project(values);

    expect(result.projection.snapshot.data?.pdfModel.tabtArbejdsfortjeneste.skalKomprimereIndkomstBeregning).toBe(true);
    expect(delvisLinjer(result)).toEqual([
      'Lønperioder, der kun delvist indgår, medregnes forholdsmæssigt:',
      '15-12-2023 - 15-01-2024: 15 af 32 kalenderdage i erstatningsperioden, 5.273,44 af 11.250,00 kr.',
    ]);

    // Samme sag uden komprimering forklarer også beregningsperioden.
    expect(delvisLinjer(project({ ...values, komprimerBeregningEfterFoersteOpgoerelse: 'Nej' }))).toHaveLength(3);
  });

  it('tager beregningsperiodens lønsedler med i opgørelse nr. 2, når udregningen vises', () => {
    // Bilagsvalget «Perioden»: med «Skjul beregning …: Nej» viser opgørelse nr. 2 udregningen og dermed også de
    // lønsedler, den bygger på – som opgørelse nr. 1. Med «Ja» kun erstatningsperiodens.
    const values = sag({
      eoNummer: '2',
      komprimerBeregningEfterFoersteOpgoerelse: 'Nej',
      eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Perioden',
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        loenperiode: 'dag',
        indtaegtsoplysningerTableData: [
          datoRaekke('d1', '2017-06-01', '2018-04-30', 330000),
          datoRaekke('d2', '2018-05-01', '2018-06-30', 60000),
          datoRaekke('d3', '2023-12-15', '2024-01-15', 10000),
        ],
      })],
    });

    expect(delvisLinjer(project(values))).toEqual([
      'Lønperioder, der kun delvist indgår, medregnes forholdsmæssigt:',
      '01-05-2018 - 30-06-2018: 31 af 61 kalenderdage i beregningsperioden, 34.303,28 af 67.500,00 kr.',
      '15-12-2023 - 15-01-2024: 15 af 32 kalenderdage i erstatningsperioden, 5.273,44 af 11.250,00 kr.',
    ]);
    expect(delvisLinjer(project({ ...values, komprimerBeregningEfterFoersteOpgoerelse: 'Ja' }))).toEqual([
      'Lønperioder, der kun delvist indgår, medregnes forholdsmæssigt:',
      '15-12-2023 - 15-01-2024: 15 af 32 kalenderdage i erstatningsperioden, 5.273,44 af 11.250,00 kr.',
    ]);
  });

  it('forklarer en månedsrække, som beregningsperioden starter midt i, i arbejdsdage, når der regnes i arbejdsdage', () => {
    // «Fuld løn under ferie: Nej» giver arbejdsdage. Beregningsperioden 15-06-2017 – 14-06-2018 skærer juni 2017 og
    // juni 2018 over; juni 2017 har 21 arbejdsdage (2. pinsedag og grundlovsdag falder begge 5. juni), og 12 af dem (15. – 30.) ligger i perioden.
    const result = project(sag({
      tafBeregningsperiodeFra: iso('2017-06-15'),
      tafBeregningsperiodeTil: iso('2018-06-14'),
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        fuldLoenUnderFerie: 'Nej',
        indtaegtsoplysningerTableData: loenRaekker({ maaned: 6, aar: 2017 }, 13),
      })],
    }));

    const linjer = delvisLinjer(result);
    expect(linjer).toHaveLength(3);
    expect(linjer[1]).toMatch(/^06-2017: 12 af 21 arbejdsdage i beregningsperioden, /);
    expect(linjer[2]).toMatch(/^06-2018: \d+ af \d+ arbejdsdage i beregningsperioden, /);
  });
});

describe('BB-297 – en lønrække over ti gange de øvrige får en gul advarsel', () => {
  const OUTLIER_LINJE = 'er over ti gange højere end ansættelsesforholdets øvrige lønrækker i perioden – kontrollér beløbet';
  const outlierLinjer = (result: ReturnType<typeof project>) =>
    result.warningLinjer.filter((linje) => linje.includes('over ti gange højere'));

  it('advarer om et nul for meget uden at spærre', () => {
    const [juni, ...resten] = loenRaekker();
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        indtaegtsoplysningerTableData: [{ ...juni!, col2: amount(3000000) }, ...resten],
      })],
    }));

    expect(outlierLinjer(result)).toEqual([`Lønrækken 06-2017 ${OUTLIER_LINJE}`]);
    expect(result.errorLinjer).toEqual([]);
    expect(result.projection.snapshot.status).toBe('ok');
  });

  it('advarer ikke om en bonus, en efterregulering eller en lav løn efter skaden', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        indtaegtsoplysningerTableData: [
          ...loenRaekker(),
          raekke('bonus', 12, 2017, 60000),
          raekke('efterregulering', 3, 2018, 1000),
          // Erstatningsperioden sammenlignes for sig – 3.000 kr. pr. måned efter skaden er ikke «lavt» mod 30.000 kr.
          ...[1, 2, 3, 4].map((maaned) => raekke(`efter-${maaned}`, maaned, 2024, 3000)),
        ],
      })],
    }));

    expect(outlierLinjer(result)).toEqual([]);
  });

  it('vurderer en datorække pr. kalenderdag og springer rækker under en uge over', () => {
    const result = project(sag({
      loenindkomstAnsaettelsesforhold: [ansaettelse({
        loenperiode: 'dag',
        indtaegtsoplysningerTableData: [
          datoRaekke('d1', '2017-06-01', '2017-06-30', 30000),
          datoRaekke('d2', '2017-07-01', '2017-07-31', 30000),
          datoRaekke('d3', '2017-08-01', '2017-08-31', 30000),
          datoRaekke('d4', '2017-09-01', '2017-09-30', 30000),
          // To dage med feriepenge: 15.000 kr. pr. dag, men for kort til at blive vurderet.
          datoRaekke('slutloen', '2017-10-01', '2017-10-02', 30000),
          // En uge til 80.000 kr. er over 11.000 kr. pr. dag mod ca. 1.000 kr.
          datoRaekke('uge', '2017-10-03', '2017-10-09', 80000),
        ],
      })],
    }));

    expect(outlierLinjer(result)).toEqual([`Lønrækken 03-10-2017 - 09-10-2017 ${OUTLIER_LINJE}`]);
  });

  it('advarer også om en ydelse over ti gange ydelsestypens øvrige rækker', () => {
    const ydelse = (id: string, fra: string, til: string, beloeb: number) => ({
      id, fraDato: iso(fra), tilDato: iso(til), ydelse: amount(beloeb), tillaeg: undefined, ydelsestype: 'dagpenge',
    });
    const result = project(sag({
      offentligeYdelserRows: [
        ydelse('y1', '2024-01-01', '2024-01-31', 15000),
        ydelse('y2', '2024-02-01', '2024-02-29', 15000),
        ydelse('y3', '2024-03-01', '2024-03-31', 15000),
        ydelse('y4', '2024-04-01', '2024-04-30', 200000),
      ],
    }));

    expect(outlierLinjer(result)).toEqual([
      'Ydelsen Dagpenge 01-04-2024 - 30-04-2024 er over ti gange højere end ydelsestypens øvrige rækker i perioden – '
        + 'kontrollér beløbet',
    ]);
    expect(result.errorLinjer).toEqual([]);
  });
});
