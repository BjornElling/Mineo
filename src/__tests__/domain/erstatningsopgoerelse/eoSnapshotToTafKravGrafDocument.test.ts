import { eoSnapshotToTafKravGrafDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import {
  buildIncomeCalculationContext,
  buildIncomeForRanges,
} from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import type { EoSnapshot, EoSnapshotComputedData } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

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
      'Visuel graf over indtægtsniveau kan ikke genereres, fordi der ikke beregnes tabt arbejdsfortjeneste i erstatningsperioden.'
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
