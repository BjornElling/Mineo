import { eoSnapshotToTafKravGrafDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import {
  buildIncomeCalculationContext,
  buildIncomeForRanges,
} from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import type { EoSnapshot, EoSnapshotComputedData } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

vi.mock('../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder')>();
  return {
    ...actual,
    buildIncomeCalculationContext: vi.fn(() => ({
      boundsFra: iso('2016-05-01'),
      boundsTil: iso('2026-03-31'),
      arbejdsdageSet: new Set(),
      shDaysForYdelser: new Set(),
      loenErrorRowIdsByEmploymentId: new Map(),
    })),
    buildIncomeForRanges: vi.fn((_values, ranges) => {
      const range = ranges[0];
      if (!range) return { employers: [], benefits: [] };
      if (range.fra.startsWith('2022')) {
        return {
          employers: [{ id: 'a', index: 0, name: 'Arbejdsgiver A', amount: 30_000, breakdown: {} }],
          benefits: [{ typeKey: 'sygedagpenge', label: 'Sygedagpenge', amount: 5_000 }],
        };
      }
      if (range.fra >= iso('2017-05-01') && range.fra <= iso('2020-01-31')) {
        return {
          employers: [{ id: 'a', index: 0, name: 'Arbejdsgiver A', amount: 36_000, breakdown: {} }],
          benefits: range.fra.startsWith('2017')
            ? [{ typeKey: 'sygedagpenge', label: 'Sygedagpenge', amount: 13_250 }]
            : [],
        };
      }
      if (range.fra.startsWith('2024')) {
        const loen = range.fra >= iso('2024-07-01') ? 34_100 : 30_000;
        const benefits = range.fra >= iso('2024-03-01') && range.fra <= iso('2024-09-30')
          ? [{ typeKey: 'sygedagpenge', label: 'Sygedagpenge', amount: 8_400 }]
          : [];
        return {
          employers: [{ id: 'a', index: 0, name: 'Arbejdsgiver A', amount: loen, breakdown: {} }],
          benefits,
        };
      }
      return {
        employers: [],
        benefits: range.fra >= iso('2020-01-01') && range.fra <= iso('2026-03-31')
          ? [{ typeKey: 'sygedagpenge', label: 'Sygedagpenge', amount: 19_000 }]
          : [],
      };
    }),
  };
});

const buildSnapshot = (): EoSnapshot => {
  const pdfModel = {
    skadestypeLinje: 'Arbejdsskade den 1. januar 2024',
    tafRanges: [
      { fra: iso('2024-01-01'), til: iso('2024-12-31') },
    ],
    tabtArbejdsfortjeneste: {
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      indkomstSkadestidspunkt: {
        skadedato: iso('2024-01-01'),
        periodeTilBeregning: { fra: iso('2022-01-01'), til: iso('2022-12-31') },
        maaneder: 12,
        arbejdsdage: 250,
        totalBreakdown: {
          samletOre: 360_000_00,
        },
        offentligeYdelser: [
          { label: 'Sygedagpenge', amountOre: 60_000_00 },
        ],
      },
      offentligeYdelserUdvikling: {
        entries: [
          { label: 'Sygedagpenge' },
        ],
      },
    },
  } as unknown as EoModel;

  const data = {
    pdfModel,
    engines: {
      tafPerYear: {
        years: [
          {
            year: 2024,
            segments: [
              {
                fra: iso('2024-01-01'),
                til: iso('2024-06-30'),
                sourceLabel: 'Arbejdsgiver A',
                unitAmountOre: 30_000_00,
                deltaPct: 0,
                amountOre: 180_000_00,
              },
              {
                fra: iso('2024-07-01'),
                til: iso('2024-12-31'),
                sourceLabel: 'Arbejdsgiver B',
                unitAmountOre: 31_000_00,
                deltaPct: 10,
                amountOre: 204_600_00,
              },
              {
                fra: iso('2024-03-01'),
                til: iso('2024-09-30'),
                sourceLabel: 'Sygedagpenge',
                unitAmountOre: 8_000_00,
                deltaPct: 5,
                amountOre: 58_800_00,
              },
            ],
          },
        ],
      },
    },
  } as unknown as EoSnapshotComputedData;

  return {
    revision: 'test',
    status: 'ok',
    invariants: [],
    data,
    debugSnapshot: null,
    input: {
      stamdata: { skadedato: iso('2024-01-01') } as EoSnapshot['input']['stamdata'],
      erstatningsopgoerelse: {
        midlertidigtEetFraEetSiden: 'Nej',
      } as EoSnapshot['input']['erstatningsopgoerelse'],
    },
  };
};

const buildLongSnapshot = (): EoSnapshot => {
  const snapshot = buildSnapshot();
  const model = {
    ...snapshot.data?.pdfModel,
    tafRanges: [
      { fra: iso('2017-05-01'), til: iso('2026-03-31') },
    ],
    tabtArbejdsfortjeneste: {
      ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste,
      indkomstSkadestidspunkt: {
        ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste.indkomstSkadestidspunkt,
        skadedato: iso('2017-05-01'),
        periodeTilBeregning: { fra: iso('2016-05-01'), til: iso('2017-04-30') },
      },
    },
  } as unknown as EoModel;

  return {
    ...snapshot,
    data: {
      ...snapshot.data,
      pdfModel: model,
    } as EoSnapshotComputedData,
    input: {
      ...snapshot.input,
      stamdata: { skadedato: iso('2017-05-01') } as EoSnapshot['input']['stamdata'],
    },
  };
};

describe('eoSnapshotToTafKravGrafDocument', () => {
  it('viser hvert ansættelsesforhold som egen serie og beholder offentlige ydelser som egen serie', () => {
    const projection = eoSnapshotToTafKravGrafDocument(buildSnapshot());

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);

    expect(projection.document.series.map((entry) => entry.label)).toEqual([
      'Løn (Arbejdsgiver A)',
      'Sygedagpenge',
    ]);
    const loenSegments = projection.document.series.find((entry) => entry.label === 'Løn (Arbejdsgiver A)')?.segments ?? [];
    expect(loenSegments.at(0)).toEqual({ fra: iso('2022-01-01'), til: iso('2022-01-31'), amountOre: 30_000_00 });
    expect(loenSegments).toContainEqual({
      fra: iso('2024-01-01'),
      til: iso('2024-01-31'),
      amountOre: 30_000_00,
    });
    expect(loenSegments).toContainEqual({
      fra: iso('2024-07-01'),
      til: iso('2024-07-31'),
      amountOre: 34_100_00,
    });
    expect(projection.document.series.find((entry) => entry.label === 'Sygedagpenge')?.segments).toContainEqual({
      fra: iso('2024-03-01'),
      til: iso('2024-03-31'),
      amountOre: 8_400_00,
    });
    expect(projection.document.unit).toBe('maaned');
  });

  it('medtager beregningsperioden som separat tidsvindue når der er langt til TAF-perioden', () => {
    const projection = eoSnapshotToTafKravGrafDocument(buildSnapshot());

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);

    expect(projection.document.beregningsperiode).toEqual({
      fra: iso('2022-01-01'),
      til: iso('2022-12-31'),
    });
    expect(projection.document.timeWindows).toEqual([
      { fra: iso('2022-01-01'), til: iso('2022-12-31') },
      { fra: iso('2024-01-01'), til: iso('2024-12-31') },
    ]);
  });

  it('bygger bro over en hel kalendermåned uden arbejdsdage (arbejdsdags-grundlag) i stedet for et falsk dyk', () => {
    const ctxMock = vi.mocked(buildIncomeCalculationContext);
    const incomeMock = vi.mocked(buildIncomeForRanges);
    const originalCtx = ctxMock.getMockImplementation();
    const originalIncome = incomeMock.getMockImplementation();

    // Arbejdsdage i alle måneder af 2024 undtagen juli — juli efterligner en hel
    // måned dækket af ferie/fravær (0 arbejdsdage → divisor 0 → springes normalt over).
    const arbejdsdageSet = new Set(
      Array.from({ length: 12 }, (_, monthIndex) => monthIndex + 1)
        .filter((month) => month !== 7)
        .map((month) => iso(`2024-${String(month).padStart(2, '0')}-15`))
    );
    ctxMock.mockImplementation(() => ({
      boundsFra: iso('2024-01-01'),
      boundsTil: iso('2024-12-31'),
      arbejdsdageSet,
      shDaysForYdelser: new Set(),
      loenErrorRowIdsByEmploymentId: new Map(),
    }));
    incomeMock.mockImplementation((_values, ranges) => {
      const range = ranges[0];
      if (!range || !range.fra.startsWith('2024')) return { employers: [], benefits: [] };
      return {
        employers: [{ id: 'a', index: 0, name: 'Arbejdsgiver A', amount: 22_000, breakdown: {} as never }],
        benefits: [],
      };
    });

    const snapshot = buildSnapshot();
    const taf = snapshot.data!.pdfModel.tabtArbejdsfortjeneste as {
      tafBeregningsenhed: unknown;
      indkomstSkadestidspunkt: { periodeTilBeregning?: unknown };
    };
    taf.tafBeregningsenhed = TAF_BEREGNES_SOM.ARBEJDSDAGE;
    taf.indkomstSkadestidspunkt.periodeTilBeregning = undefined;

    const projection = eoSnapshotToTafKravGrafDocument(snapshot);

    // Gendan default-mocks før assertions, så intet lækker til øvrige tests.
    if (originalCtx) ctxMock.mockImplementation(originalCtx);
    if (originalIncome) incomeMock.mockImplementation(originalIncome);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);
    expect(projection.document.unit).toBe('arbejdsdag');

    const loenSegments = projection.document.series.find((entry) => entry.label === 'Løn (Arbejdsgiver A)')?.segments ?? [];
    const juni = loenSegments.find((segment) => segment.fra === iso('2024-06-01'));
    const juli = loenSegments.find((segment) => segment.fra === iso('2024-07-01'));
    expect(juni).toBeDefined();
    // Juli mangler arbejdsdage, men broen holder juni-dagslønnen hen over måneden.
    expect(juli).toEqual({ fra: iso('2024-07-01'), til: iso('2024-07-31'), amountOre: juni!.amountOre });
  });

  it('bygger bro over en enkelt ikke-arbejdsdag isoleret på en måneds-/segmentgrænse (intet falsk hul)', () => {
    const ctxMock = vi.mocked(buildIncomeCalculationContext);
    const incomeMock = vi.mocked(buildIncomeForRanges);
    const originalCtx = ctxMock.getMockImplementation();
    const originalIncome = incomeMock.getMockImplementation();

    // Kontinuerlig løn 18-09 → 08-10-2023. 1. oktober er en søndag (ingen arbejdsdag)
    // og isoleres som dag-fragment mellem måneds-grænsen (1/10) og næste kildeperiode (2/10).
    ctxMock.mockImplementation(() => ({
      boundsFra: iso('2023-09-18'),
      boundsTil: iso('2023-10-08'),
      arbejdsdageSet: new Set([
        iso('2023-09-18'), iso('2023-09-19'), iso('2023-09-20'), iso('2023-09-21'), iso('2023-09-22'),
        iso('2023-09-25'), iso('2023-09-26'), iso('2023-09-27'), iso('2023-09-28'), iso('2023-09-29'),
        iso('2023-10-02'), iso('2023-10-03'), iso('2023-10-04'), iso('2023-10-05'), iso('2023-10-06'),
      ]),
      shDaysForYdelser: new Set(),
      loenErrorRowIdsByEmploymentId: new Map(),
    }));
    incomeMock.mockImplementation((_values, ranges) => {
      const range = ranges[0];
      if (!range || !range.fra.startsWith('2023')) return { employers: [], benefits: [] };
      return {
        employers: [{ id: 'af-1', index: 0, name: 'Arbejdsgiver A', amount: 1_000, breakdown: {} as never }],
        benefits: [],
      };
    });

    const snapshot = buildSnapshot();
    const model = {
      ...snapshot.data?.pdfModel,
      tafRanges: [{ fra: iso('2023-09-18'), til: iso('2023-10-08') }],
      tabtArbejdsfortjeneste: {
        ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste,
        tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
        indkomstSkadestidspunkt: {
          ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste.indkomstSkadestidspunkt,
          skadedato: iso('2023-09-18'),
          periodeTilBeregning: undefined,
        },
      },
    } as unknown as EoModel;
    const projection = eoSnapshotToTafKravGrafDocument({
      ...snapshot,
      data: { ...snapshot.data, pdfModel: model } as EoSnapshotComputedData,
      input: {
        ...snapshot.input,
        stamdata: { skadedato: iso('2023-09-18') } as EoSnapshot['input']['stamdata'],
        erstatningsopgoerelse: {
          ...snapshot.input.erstatningsopgoerelse,
          loenindkomstAnsaettelsesforhold: [
            {
              ...createDefaultLoenindkomstAnsaettelsesforhold(),
              id: 'af-1',
              navnPaaArbejdssted: 'Arbejdsgiver A',
              loenperiode: 'dag',
              tillaegAngivesSom: 'procent',
              loenPaaHelligdage: 'SH-udbetaling',
              fuldLoenUnderFerie: 'Nej',
              feriePct: 0,
              fritvalgPct: 0,
              shSoPct: 0,
              storeBededagPct: 0,
              pensionPct: 0,
              indtaegtsoplysningerTableData: [
                {
                  id: 'loen-sep', col0_maaned: '', col1_maaned: '', col0_uge: '', col1_uge: '',
                  col0_dag: iso('2023-09-18'), col1_dag: iso('2023-10-01'),
                  col2: asAmount(1_000), col3: undefined, col4: undefined, col5: undefined,
                },
                {
                  id: 'loen-okt', col0_maaned: '', col1_maaned: '', col0_uge: '', col1_uge: '',
                  col0_dag: iso('2023-10-02'), col1_dag: iso('2023-10-08'),
                  col2: asAmount(1_000), col3: undefined, col4: undefined, col5: undefined,
                },
              ],
            },
          ],
          offentligeYdelserRows: [],
        } as EoSnapshot['input']['erstatningsopgoerelse'],
      },
    });

    if (originalCtx) ctxMock.mockImplementation(originalCtx);
    if (originalIncome) incomeMock.mockImplementation(originalIncome);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);
    const loenSegments = projection.document.series.find((entry) => entry.label === 'Løn (Arbejdsgiver A)')?.segments ?? [];
    // Søndag 1/10 er broet over → den dækkes af et segment (intet hul).
    expect(loenSegments.some((segment) => segment.fra <= iso('2023-10-01') && segment.til >= iso('2023-10-01'))).toBe(true);
  });

  const buildFerieSnapshot = (
    arbejdsdage: readonly string[],
    incomeRows: ReadonlyArray<{ fra: string; til: string }>,
    ferieperioder: ReadonlyArray<{ fra: string; til: string }>
  ) => {
    const ctxMock = vi.mocked(buildIncomeCalculationContext);
    const incomeMock = vi.mocked(buildIncomeForRanges);
    ctxMock.mockImplementation(() => ({
      boundsFra: iso('2024-06-01'),
      boundsTil: iso('2024-06-30'),
      arbejdsdageSet: new Set(arbejdsdage.map(iso)),
      shDaysForYdelser: new Set(),
      loenErrorRowIdsByEmploymentId: new Map(),
    }));
    incomeMock.mockImplementation((_values, ranges) => {
      const range = ranges[0];
      if (!range || !range.fra.startsWith('2024-06')) return { employers: [], benefits: [] };
      return {
        employers: [{ id: 'af-1', index: 0, name: 'Arbejdsgiver A', amount: 1_000, breakdown: {} as never }],
        benefits: [],
      };
    });

    const snapshot = buildSnapshot();
    const model = {
      ...snapshot.data?.pdfModel,
      tafRanges: [{ fra: iso('2024-06-01'), til: iso('2024-06-30') }],
      tabtArbejdsfortjeneste: {
        ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste,
        tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
        indkomstSkadestidspunkt: {
          ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste.indkomstSkadestidspunkt,
          skadedato: iso('2024-06-01'),
          periodeTilBeregning: undefined,
        },
      },
    } as unknown as EoModel;
    return eoSnapshotToTafKravGrafDocument({
      ...snapshot,
      data: { ...snapshot.data, pdfModel: model } as EoSnapshotComputedData,
      input: {
        ...snapshot.input,
        stamdata: { skadedato: iso('2024-06-01') } as EoSnapshot['input']['stamdata'],
        erstatningsopgoerelse: {
          ...snapshot.input.erstatningsopgoerelse,
          ferieperioder: ferieperioder.map((p, index) => ({ id: `ferie-${index}`, fra: iso(p.fra), til: iso(p.til) })),
          loenindkomstAnsaettelsesforhold: [
            {
              ...createDefaultLoenindkomstAnsaettelsesforhold(),
              id: 'af-1',
              navnPaaArbejdssted: 'Arbejdsgiver A',
              loenperiode: 'dag',
              tillaegAngivesSom: 'procent',
              loenPaaHelligdage: 'SH-udbetaling',
              fuldLoenUnderFerie: 'Nej',
              feriePct: 0,
              fritvalgPct: 0,
              shSoPct: 0,
              storeBededagPct: 0,
              pensionPct: 0,
              indtaegtsoplysningerTableData: incomeRows.map((row, index) => ({
                id: `loen-${index}`, col0_maaned: '', col1_maaned: '', col0_uge: '', col1_uge: '',
                col0_dag: iso(row.fra), col1_dag: iso(row.til),
                col2: asAmount(1_000), col3: undefined, col4: undefined, col5: undefined,
              })),
            },
          ],
          offentligeYdelserRows: [],
        } as EoSnapshot['input']['erstatningsopgoerelse'],
      },
    });
  };

  it('markerer ferie uden løn på ≥3 sammenhængende arbejdsdage (henover weekend) og bygger ikke bro over den', () => {
    const ctxMock = vi.mocked(buildIncomeCalculationContext);
    const incomeMock = vi.mocked(buildIncomeForRanges);
    const originalCtx = ctxMock.getMockImplementation();
    const originalIncome = incomeMock.getMockImplementation();

    // Ferie 13.-18. juni (to-tu, hen over weekend 15.-16.) uden indtastet løn → 4 arbejdsdage.
    const projection = buildFerieSnapshot(
      ['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07', '2024-06-10', '2024-06-11', '2024-06-12',
        '2024-06-19', '2024-06-20', '2024-06-21', '2024-06-24', '2024-06-25', '2024-06-26', '2024-06-27', '2024-06-28'],
      [{ fra: '2024-06-01', til: '2024-06-12' }, { fra: '2024-06-19', til: '2024-06-30' }],
      [{ fra: '2024-06-13', til: '2024-06-18' }]
    );

    if (originalCtx) ctxMock.mockImplementation(originalCtx);
    if (originalIncome) incomeMock.mockImplementation(originalIncome);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);
    expect(projection.document.ferieAbsenceMarkers).toEqual([{ fra: iso('2024-06-13'), til: iso('2024-06-18') }]);
    // Ferien er IKKE broet over: ingen segmenter dækker ferie-/weekend-dagene i hullet.
    const loenSegments = projection.document.series.find((entry) => entry.label === 'Løn (Arbejdsgiver A)')?.segments ?? [];
    for (const dag of [iso('2024-06-13'), iso('2024-06-15'), iso('2024-06-18')]) {
      expect(loenSegments.some((segment) => segment.fra <= dag && segment.til >= dag)).toBe(false);
    }
  });

  it('udvider ferie-båndet til at dække tilstødende weekend-/SH-dage uden indkomst', () => {
    const ctxMock = vi.mocked(buildIncomeCalculationContext);
    const incomeMock = vi.mocked(buildIncomeForRanges);
    const originalCtx = ctxMock.getMockImplementation();
    const originalIncome = incomeMock.getMockImplementation();

    // Løn til og med fredag 14/6, ferie man-fre 17.-21., løn igen fra mandag 24/6.
    // Båndet skal dække forudgående weekend 15.-16. + ferien + efterfølgende weekend 22.-23.
    const projection = buildFerieSnapshot(
      ['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07', '2024-06-10', '2024-06-11', '2024-06-12', '2024-06-13', '2024-06-14',
        '2024-06-24', '2024-06-25', '2024-06-26', '2024-06-27', '2024-06-28'],
      [{ fra: '2024-06-01', til: '2024-06-14' }, { fra: '2024-06-24', til: '2024-06-30' }],
      [{ fra: '2024-06-17', til: '2024-06-21' }]
    );

    if (originalCtx) ctxMock.mockImplementation(originalCtx);
    if (originalIncome) incomeMock.mockImplementation(originalIncome);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);
    expect(projection.document.ferieAbsenceMarkers).toEqual([{ fra: iso('2024-06-15'), til: iso('2024-06-23') }]);
  });

  it('markerer ikke kort ferie (<3 arbejdsdage) og bygger fortsat bro over den', () => {
    const ctxMock = vi.mocked(buildIncomeCalculationContext);
    const incomeMock = vi.mocked(buildIncomeForRanges);
    const originalCtx = ctxMock.getMockImplementation();
    const originalIncome = incomeMock.getMockImplementation();

    // Ferie 13.-14. juni (kun 2 arbejdsdage) uden løn → under tærsklen.
    const projection = buildFerieSnapshot(
      ['2024-06-03', '2024-06-04', '2024-06-05', '2024-06-06', '2024-06-07', '2024-06-10', '2024-06-11', '2024-06-12',
        '2024-06-17', '2024-06-18', '2024-06-19', '2024-06-20', '2024-06-21', '2024-06-24', '2024-06-25', '2024-06-26', '2024-06-27', '2024-06-28'],
      [{ fra: '2024-06-01', til: '2024-06-12' }, { fra: '2024-06-17', til: '2024-06-30' }],
      [{ fra: '2024-06-13', til: '2024-06-14' }]
    );

    if (originalCtx) ctxMock.mockImplementation(originalCtx);
    if (originalIncome) incomeMock.mockImplementation(originalIncome);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);
    expect(projection.document.ferieAbsenceMarkers).toEqual([]);
    // Kort ferie bygges der bro over: hullet 13.-16. juni dækkes af et segment.
    const loenSegments = projection.document.series.find((entry) => entry.label === 'Løn (Arbejdsgiver A)')?.segments ?? [];
    expect(loenSegments.some((segment) => segment.fra <= iso('2024-06-13') && segment.til >= iso('2024-06-14'))).toBe(true);
  });

  it('tegner faktiske indkomstsegmenter helt frem til TAF-periodens sidste indtastede ydelse', () => {
    const projection = eoSnapshotToTafKravGrafDocument(buildLongSnapshot());

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);

    expect(projection.document.series.find((entry) => entry.label === 'Løn (Arbejdsgiver A)')?.segments).toContainEqual({
      fra: iso('2020-01-01'),
      til: iso('2020-01-31'),
      amountOre: 36_000_00,
    });
    expect(projection.document.series.find((entry) => entry.label === 'Sygedagpenge')?.segments).toContainEqual({
      fra: iso('2026-03-01'),
      til: iso('2026-03-31'),
      amountOre: 19_000_00,
    });
  });

  it('afgrænser løn og sygedagpenge på de faktiske skiftedatoer ved arbejdsdagsgraf', () => {
    const ctxMock = vi.mocked(buildIncomeCalculationContext);
    const incomeMock = vi.mocked(buildIncomeForRanges);
    const originalCtx = ctxMock.getMockImplementation();
    const originalIncome = incomeMock.getMockImplementation();

    ctxMock.mockImplementation(() => ({
      boundsFra: iso('2023-10-01'),
      boundsTil: iso('2023-10-31'),
      arbejdsdageSet: new Set([
        iso('2023-10-02'),
        iso('2023-10-03'),
        iso('2023-10-04'),
        iso('2023-10-05'),
        iso('2023-10-06'),
        iso('2023-10-09'),
        iso('2023-10-10'),
        iso('2023-10-11'),
        iso('2023-10-12'),
        iso('2023-10-13'),
        iso('2023-10-16'),
        iso('2023-10-17'),
        iso('2023-10-18'),
        iso('2023-10-19'),
        iso('2023-10-20'),
      ]),
      shDaysForYdelser: new Set(),
      loenErrorRowIdsByEmploymentId: new Map(),
    }));
    incomeMock.mockImplementation((_values, ranges) => {
      const range = ranges[0];
      if (!range) return { employers: [], benefits: [] };
      if (range.fra === iso('2023-10-02') && range.til === iso('2023-10-08')) {
        return {
          employers: [{ id: 'af-1', index: 0, name: 'Arbejdsgiver A', amount: 500, breakdown: {} as never }],
          benefits: [],
        };
      }
      if (range.fra === iso('2023-10-09') && range.til === iso('2023-10-22')) {
        return {
          employers: [],
          benefits: [{ typeKey: 'sygedagpenge', label: 'Sygedagpenge', amount: 1_000 }],
        };
      }
      return { employers: [], benefits: [] };
    });

    const snapshot = buildSnapshot();
    const model = {
      ...snapshot.data?.pdfModel,
      tafRanges: [
        { fra: iso('2023-10-09'), til: iso('2023-10-31') },
      ],
      tabtArbejdsfortjeneste: {
        ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste,
        tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
        indkomstSkadestidspunkt: {
          ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste.indkomstSkadestidspunkt,
          skadedato: iso('2023-10-09'),
          periodeTilBeregning: { fra: iso('2023-10-02'), til: iso('2023-10-08') },
        },
      },
    } as unknown as EoModel;
    const projection = eoSnapshotToTafKravGrafDocument({
      ...snapshot,
      data: {
        ...snapshot.data,
        pdfModel: model,
      } as EoSnapshotComputedData,
      input: {
        ...snapshot.input,
        stamdata: { skadedato: iso('2023-10-09') } as EoSnapshot['input']['stamdata'],
        erstatningsopgoerelse: {
          ...snapshot.input.erstatningsopgoerelse,
          beregnesUdFra: 'Beregningsperiode',
          tafBeregningsperiodeFra: iso('2023-10-02'),
          tafBeregningsperiodeTil: iso('2023-10-08'),
          loenindkomstAnsaettelsesforhold: [
            {
              ...createDefaultLoenindkomstAnsaettelsesforhold(),
              id: 'af-1',
              navnPaaArbejdssted: 'Arbejdsgiver A',
              loenperiode: 'dag',
              tillaegAngivesSom: 'procent',
              loenPaaHelligdage: 'SH-udbetaling',
              fuldLoenUnderFerie: 'Nej',
              feriePct: 0,
              fritvalgPct: 0,
              shSoPct: 0,
              storeBededagPct: 0,
              pensionPct: 0,
              indtaegtsoplysningerTableData: [
                {
                  id: 'loen-okt',
                  col0_maaned: '',
                  col1_maaned: '',
                  col0_uge: '',
                  col1_uge: '',
                  col0_dag: iso('2023-10-02'),
                  col1_dag: iso('2023-10-08'),
                  col2: asAmount(500),
                  col3: undefined,
                  col4: undefined,
                  col5: undefined,
                },
              ],
            },
          ],
          offentligeYdelserRows: [
            {
              id: 'sdp-okt',
              fraDato: iso('2023-10-09'),
              tilDato: iso('2023-10-22'),
              ydelse: asAmount(1_000),
              tillaeg: undefined,
              ydelsestype: 'sygedagpenge',
            },
          ],
        } as EoSnapshot['input']['erstatningsopgoerelse'],
      },
    });

    if (originalCtx) ctxMock.mockImplementation(originalCtx);
    if (originalIncome) incomeMock.mockImplementation(originalIncome);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);
    expect(projection.document.unit).toBe('arbejdsdag');
    expect(projection.document.series.find((entry) => entry.label === 'Løn (Arbejdsgiver A)')?.segments).toEqual([
      { fra: iso('2023-10-02'), til: iso('2023-10-08'), amountOre: 10_000 },
    ]);
    expect(projection.document.series.find((entry) => entry.label === 'Sygedagpenge')?.segments).toEqual([
      { fra: iso('2023-10-09'), til: iso('2023-10-22'), amountOre: 10_000 },
    ]);
  });

  it('medtager indkomstbilag mellem beregningsperioden og TAF-perioden', () => {
    const snapshot = buildSnapshot();
    const model = {
      ...snapshot.data?.pdfModel,
      tafRanges: [
        { fra: iso('2026-02-23'), til: iso('2026-06-21') },
      ],
      tabtArbejdsfortjeneste: {
        ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste,
        indkomstSkadestidspunkt: {
          ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste.indkomstSkadestidspunkt,
          skadedato: iso('2025-01-01'),
          periodeTilBeregning: { fra: iso('2025-01-01'), til: iso('2025-12-31') },
        },
      },
    } as unknown as EoModel;
    const projection = eoSnapshotToTafKravGrafDocument({
      ...snapshot,
      data: {
        ...snapshot.data,
        pdfModel: model,
      } as EoSnapshotComputedData,
      input: {
        ...snapshot.input,
        erstatningsopgoerelse: {
          ...snapshot.input.erstatningsopgoerelse,
          offentligeYdelserRows: [
            {
              id: 'oy-jan',
              fraDato: iso('2026-01-01'),
              tilDato: iso('2026-01-25'),
              ydelse: { kind: 'number', value: 15912 },
              tillaeg: { kind: 'number', value: 332 },
              ydelsestype: 'sygedagpenge',
            },
          ],
        } as EoSnapshot['input']['erstatningsopgoerelse'],
      },
    });

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);
    expect(projection.document.timeWindows).toEqual([
      { fra: iso('2025-01-01'), til: iso('2026-06-21') },
    ]);
    expect(projection.document.series.find((entry) => entry.label === 'Sygedagpenge')?.segments).toContainEqual({
      fra: iso('2026-01-01'),
      til: iso('2026-01-25'),
      amountOre: 23_560_00,
    });
  });

  it('stabiliserer isolerede SH-dyk i sygedagpenge-serien uden at ændre andre måneder', () => {
    const ctxMock = vi.mocked(buildIncomeCalculationContext);
    const incomeMock = vi.mocked(buildIncomeForRanges);
    const originalCtx = ctxMock.getMockImplementation();
    const originalIncome = incomeMock.getMockImplementation();

    ctxMock.mockImplementation(() => ({
      boundsFra: iso('2026-03-01'),
      boundsTil: iso('2026-05-31'),
      arbejdsdageSet: new Set(),
      shDaysForYdelser: new Set([iso('2026-04-03')]),
      loenErrorRowIdsByEmploymentId: new Map(),
    }));
    incomeMock.mockImplementation((_values, ranges) => {
      const range = ranges[0];
      if (!range) return { employers: [], benefits: [] };
      const amount = range.fra.startsWith('2026-04') ? 5_000 : 10_000;
      return {
        employers: [],
        benefits: [{ typeKey: 'sygedagpenge', label: 'Sygedagpenge', amount }],
      };
    });

    const snapshot = buildSnapshot();
    const model = {
      ...snapshot.data?.pdfModel,
      tafRanges: [
        { fra: iso('2026-03-01'), til: iso('2026-05-31') },
      ],
      tabtArbejdsfortjeneste: {
        ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste,
        indkomstSkadestidspunkt: {
          ...snapshot.data?.pdfModel.tabtArbejdsfortjeneste.indkomstSkadestidspunkt,
          periodeTilBeregning: undefined,
        },
      },
    } as unknown as EoModel;
    const projection = eoSnapshotToTafKravGrafDocument({
      ...snapshot,
      data: {
        ...snapshot.data,
        pdfModel: model,
      } as EoSnapshotComputedData,
    });

    if (originalCtx) ctxMock.mockImplementation(originalCtx);
    if (originalIncome) incomeMock.mockImplementation(originalIncome);

    expect(projection.kind).toBe('ok');
    if (projection.kind !== 'ok') throw new Error(projection.message);
    const sygedagpengeSegments = projection.document.series.find((entry) => entry.label === 'Sygedagpenge')?.segments ?? [];
    expect(sygedagpengeSegments).toContainEqual({
      fra: iso('2026-03-01'),
      til: iso('2026-03-31'),
      amountOre: 10_000_00,
    });
    expect(sygedagpengeSegments).toContainEqual({
      fra: iso('2026-04-01'),
      til: iso('2026-04-30'),
      amountOre: 10_000_00,
    });
    expect(sygedagpengeSegments).toContainEqual({
      fra: iso('2026-05-01'),
      til: iso('2026-05-31'),
      amountOre: 10_000_00,
    });
  });

  const buildSnapshotUdenAarsfordeling = (harTafPerioder: boolean): EoSnapshot => {
    const snapshot = buildSnapshot();
    return {
      ...snapshot,
      data: {
        ...snapshot.data,
        engines: {
          ...snapshot.data?.engines,
          tafPerYear: null,
          tafNetto: { harTafPerioder },
        },
      } as EoSnapshotComputedData,
    };
  };

  it('forklarer at der ikke beregnes TAF når der ikke er TAF-perioder', () => {
    const projection = eoSnapshotToTafKravGrafDocument(buildSnapshotUdenAarsfordeling(false));

    expect(projection.kind).toBe('blocked');
    if (projection.kind !== 'blocked') throw new Error('forventede blocked');
    expect(projection.message).toBe(
      'Dokumentet kan ikke genereres, fordi der ikke beregnes tabt arbejdsfortjeneste i erstatningsperioden.'
    );
  });

  it('beholder den generiske årsfordelings-besked når der er TAF-perioder men ingen fordeling', () => {
    const projection = eoSnapshotToTafKravGrafDocument(buildSnapshotUdenAarsfordeling(true));

    expect(projection.kind).toBe('blocked');
    if (projection.kind !== 'blocked') throw new Error('forventede blocked');
    expect(projection.message).toBe(
      'Visuel graf over indtægtsniveau kan ikke genereres, fordi TAF ikke kan fordeles på år.'
    );
  });
});
