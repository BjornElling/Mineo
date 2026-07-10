import { moneyOre } from '../../domain/money/money';
import { __tafKravGrafChartTestables } from '../../document/generators/tafFordelt/tafKravGrafChart';
import type { TafKravGrafDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import { toISODateString } from '../../types/branded';

const {
  niceCeil,
  buildNiceMoneyTicks,
  appendSmoothCurve,
  buildWindowLayout,
  buildXMapper,
  buildWindowSamples,
  buildDateTicks,
  canAppendTerminalDateLabel,
} =
  __tafKravGrafChartTestables;

// Optager de tegnekommandoer appendSmoothCurve udsteder, så vi kan hævde kurvens
// invarianter uden et rigtigt canvas (jsdom har intet 2D-API).
type DrawCommand =
  | { op: 'lineTo'; x: number; y: number }
  | { op: 'bezierCurveTo'; c1x: number; c1y: number; c2x: number; c2y: number; x: number; y: number };

const recordCurve = (points: readonly { x: number; y: number }[]): DrawCommand[] => {
  const commands: DrawCommand[] = [];
  const ctx = {
    lineTo: (x: number, y: number) => commands.push({ op: 'lineTo', x, y }),
    bezierCurveTo: (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) =>
      commands.push({ op: 'bezierCurveTo', c1x, c1y, c2x, c2y, x, y }),
  } as unknown as CanvasRenderingContext2D;
  appendSmoothCurve(ctx, points);
  return commands;
};

// Rene tegne-/sampling-helpers fra TAF-kravgrafen. De er præsentationsgeometri (de tal
// brugeren stoler på står i TAF-tabellerne med egne tests), men er rene og deterministiske,
// så deres invarianter låses her — de var tidligere udækkede (udskudt fund fra 10.6).

describe('tafKravGrafChart — niceCeil', () => {
  it('returnerer 0 for ikke-positive værdier', () => {
    expect(niceCeil(0)).toBe(0);
    expect(niceCeil(-5)).toBe(0);
  });

  it('runder op til nærmeste pæne tal (1·2·2,5·5 × 10ⁿ)', () => {
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(1.5)).toBe(2);
    expect(niceCeil(2)).toBe(2);
    expect(niceCeil(2.3)).toBe(2.5);
    expect(niceCeil(4)).toBe(5);
    expect(niceCeil(7)).toBe(10);
  });

  it('skalerer korrekt over titalsstørrelser', () => {
    expect(niceCeil(100)).toBe(100);
    expect(niceCeil(150)).toBe(200);
    expect(niceCeil(2300)).toBe(2500);
    expect(niceCeil(3000)).toBe(5000);
    expect(niceCeil(60000)).toBe(100000);
  });

  it('resultatet er altid ≥ input', () => {
    for (const v of [0.3, 1, 3.7, 42, 999, 12345, 678901]) {
      expect(niceCeil(v)).toBeGreaterThanOrEqual(v);
    }
  });
});

describe('tafKravGrafChart — buildNiceMoneyTicks', () => {
  it('starter på 0 og er strengt stigende med heltals-øre', () => {
    const ticks = buildNiceMoneyTicks(1_000_000); // 10.000 kr.
    expect(ticks[0]).toBe(0);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
      expect(Number.isInteger(ticks[i])).toBe(true);
    }
  });

  it('den øverste tick dækker hele beløbet inkl. headroom', () => {
    const maxOre = 4_873_00; // vilkårligt beløb i øre
    const ticks = buildNiceMoneyTicks(maxOre);
    const top = ticks.at(-1)!;
    // Y_AXIS_HEADROOM = 1.02: toppen skal være mindst lige så stor som maks × 1,02.
    expect(top).toBeGreaterThanOrEqual(maxOre * 1.02);
  });

  it('giver mindst to ticks (0 + en positiv top) selv ved meget små beløb', () => {
    const ticks = buildNiceMoneyTicks(1);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)!).toBeGreaterThan(0);
  });
});

describe('tafKravGrafChart — appendSmoothCurve', () => {
  it('går gennem alle datapunkter (interpolerende — ekstremer bevares i fuld højde)', () => {
    const points = [
      { x: 0, y: 100 },
      { x: 10, y: 40 },
      { x: 20, y: 90 },
      { x: 30, y: 10 },
    ];
    const commands = recordCurve(points);
    const beziers = commands.filter((c) => c.op === 'bezierCurveTo');
    // Ét bezier-segment pr. interval; hvert segments endepunkt er det næste datapunkt.
    expect(beziers).toHaveLength(points.length - 1);
    beziers.forEach((bezier, index) => {
      if (bezier.op !== 'bezierCurveTo') throw new Error('forventede bezier');
      expect(bezier.x).toBeCloseTo(points[index + 1].x, 6);
      expect(bezier.y).toBeCloseTo(points[index + 1].y, 6);
    });
  });

  it('bevarer et lodret spring som en skarp, ret linje (start/ophør af ydelse)', () => {
    // To punkter på samme x = en ydelse der starter/ophører. Springet skal tegnes som
    // en ret lineTo, ALDRIG som en blød bue.
    const points = [
      { x: 0, y: 200 },
      { x: 50, y: 200 },
      { x: 50, y: 0 }, // lodret fald: ophør
      { x: 90, y: 0 },
    ];
    const commands = recordCurve(points);
    // Selve springet (200 → 0 på x=50) er en lineTo, ikke en bezier.
    const verticalDrop = commands.find((c) => c.op === 'lineTo' && c.x === 50 && c.y === 0);
    expect(verticalDrop).toBeDefined();
    // Ingen bezier må have et endepunkt oven i springet fra oven (blød afrunding af kanten).
    const bezierAtDrop = commands.find(
      (c) => c.op === 'bezierCurveTo' && c.x === 50 && c.y === 0
    );
    expect(bezierAtDrop).toBeUndefined();
  });

  it('buer ud mellem punkterne (rund bue, ikke ret linje) ved et niveauskift', () => {
    // Et rent niveauskift 100 → 300 (faldende y i pixels) med naboer, så tangenten
    // ved skiftet ikke er nul: kurven skal bue ud forbi den rette forbindelse.
    const points = [
      { x: 0, y: 300 },
      { x: 10, y: 300 },
      { x: 20, y: 100 },
      { x: 30, y: 100 },
    ];
    const commands = recordCurve(points);
    const bows = commands.filter(
      (c) => c.op === 'bezierCurveTo' && (c.c1y !== c.y || c.c2y !== c.y)
    );
    // Mindst ét segment har kontrolpunkter der afviger fra en ret linje = en bue.
    expect(bows.length).toBeGreaterThan(0);
  });

  it('holder en konstant strækning fladt (ingen bue på et fladt niveau)', () => {
    const points = [
      { x: 0, y: 150 },
      { x: 10, y: 150 },
      { x: 20, y: 150 },
    ];
    const commands = recordCurve(points);
    const beziers = commands.filter((c) => c.op === 'bezierCurveTo');
    // Alle kontrolpunkter ligger på samme y som endepunkterne → ingen bue, ren vandret.
    for (const bezier of beziers) {
      if (bezier.op !== 'bezierCurveTo') continue;
      expect(bezier.c1y).toBeCloseTo(150, 6);
      expect(bezier.c2y).toBeCloseTo(150, 6);
      expect(bezier.y).toBeCloseTo(150, 6);
    }
  });
});

describe('tafKravGrafChart — buildWindowLayout', () => {
  const win = (fra: string, til: string) => ({ fra: toISODateString(fra), til: toISODateString(til) });

  it('placerer et enkelt vindue med positiv bredde og venstre-margin', () => {
    const layout = buildWindowLayout([win('2024-01-01', '2024-12-31')]);
    expect(layout).toHaveLength(1);
    expect(layout[0].width).toBeGreaterThan(0);
    expect(layout[0].x).toBeGreaterThan(0);
  });

  it('fordeler bredden proportionalt med vinduernes dag-span', () => {
    // Vindue A er ca. dobbelt så langt som vindue B.
    const layout = buildWindowLayout([
      win('2024-01-01', '2024-12-31'), // ~365 dage
      win('2025-01-01', '2025-06-30'), // ~181 dage
    ]);
    expect(layout).toHaveLength(2);
    const ratio = layout[0].width / layout[1].width;
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(2.3);
  });

  it('lægger vinduer side om side uden overlap (med brud imellem)', () => {
    const layout = buildWindowLayout([
      win('2024-01-01', '2024-06-30'),
      win('2024-07-01', '2024-12-31'),
    ]);
    // Andet vindue starter efter første vindues højre kant (x + bredde) plus brud-mellemrum.
    expect(layout[1].x).toBeGreaterThan(layout[0].x + layout[0].width);
  });
});

describe('tafKravGrafChart — buildWindowSamples', () => {
  const win = (fra: string, til: string) => ({ fra: toISODateString(fra), til: toISODateString(til) });

  it('lader ikke en kort lønperiode smitte visuelt frem til månedens midtpunkt', () => {
    const document = {
      model: { titel: 'Visuel graf over indtægtsniveau' },
      unit: 'arbejdsdag',
      timeWindows: [win('2023-10-01', '2023-10-31')],
      beregningsperiode: win('2023-10-02', '2023-10-08'),
      skadeMarker: null,
      series: [
        {
          id: 'loen',
          label: 'Løn',
          color: '#2F6B9A',
          segments: [{ fra: toISODateString('2023-10-02'), til: toISODateString('2023-10-08'), amountOre: moneyOre(10_000) }],
        },
        {
          id: 'sygedagpenge',
          label: 'Sygedagpenge',
          color: '#4F8A5B',
          segments: [{ fra: toISODateString('2023-10-09'), til: toISODateString('2023-10-22'), amountOre: moneyOre(20_000) }],
        },
      ],
    } as unknown as TafKravGrafDocument;
    const layout = buildWindowLayout(document.timeWindows);
    const mapDate = buildXMapper(layout);
    const sample = buildWindowSamples(document, layout, mapDate)[0];
    if (!sample) throw new Error('forventede sample');
    const expectedMidX = ((mapDate(toISODateString('2023-10-01')) ?? 0) + (mapDate(toISODateString('2023-10-31')) ?? 0)) / 2;
    const midIndex = sample.sampleX.findIndex((x) => Math.abs(x - expectedMidX) < 0.0001);

    expect(midIndex).toBeGreaterThanOrEqual(0);
    expect(sample.valuesBySeries[0]?.[midIndex]).toBe(0);
    expect(sample.valuesBySeries[1]?.[midIndex]).toBe(20_000);
  });

  it('tilføjer ingen grænse-kolonne ved et rent niveauskift (blød bue mellem midtpunkter)', () => {
    const document = {
      model: { titel: 'x' },
      unit: 'maaned',
      timeWindows: [win('2023-01-01', '2023-02-28')],
      beregningsperiode: null,
      skadeMarker: null,
      series: [
        {
          id: 'loen',
          label: 'Løn',
          color: '#2F6B9A',
          segments: [
            { fra: toISODateString('2023-01-01'), til: toISODateString('2023-01-31'), amountOre: moneyOre(30_000) },
            { fra: toISODateString('2023-02-01'), til: toISODateString('2023-02-28'), amountOre: moneyOre(35_000) },
          ],
        },
      ],
    } as unknown as TafKravGrafDocument;
    const layout = buildWindowLayout(document.timeWindows);
    const mapDate = buildXMapper(layout);
    const sample = buildWindowSamples(document, layout, mapDate)[0];
    if (!sample) throw new Error('forventede sample');

    const xFeb1 = mapDate(toISODateString('2023-02-01')) ?? -1;
    const columnsAtFeb1 = sample.sampleX.filter((x) => Math.abs(x - xFeb1) < 0.0001);
    // Begge niveauer er > 0 → ingen kolonne på grænsedatoen. Skiftet 30000 → 35000
    // bæres alene af de to måneds-midtpunkter, så kurven glider blødt derimellem
    // (intet fladt plateau, ingen lodret kant).
    expect(columnsAtFeb1).toHaveLength(0);
  });

  it('tegner start og ophør som lodrette spring (før/efter-dublet på samme x)', () => {
    const document = {
      model: { titel: 'x' },
      unit: 'maaned',
      timeWindows: [win('2023-01-01', '2023-01-31')],
      beregningsperiode: null,
      skadeMarker: null,
      series: [
        {
          id: 'loen',
          label: 'Løn',
          color: '#2F6B9A',
          segments: [{ fra: toISODateString('2023-01-10'), til: toISODateString('2023-01-20'), amountOre: moneyOre(30_000) }],
        },
      ],
    } as unknown as TafKravGrafDocument;
    const layout = buildWindowLayout(document.timeWindows);
    const mapDate = buildXMapper(layout);
    const sample = buildWindowSamples(document, layout, mapDate)[0];
    if (!sample) throw new Error('forventede sample');

    const valuesAt = (date: string): number[] => {
      const x = mapDate(toISODateString(date)) ?? -1;
      return sample.sampleX
        .map((sx, index) => ({ sx, value: sample.valuesBySeries[0]?.[index] ?? 0 }))
        .filter((column) => Math.abs(column.sx - x) < 0.0001)
        .map((column) => column.value);
    };

    // Start 10/1: 0 → 30000 på samme x (lodret op).
    expect(valuesAt('2023-01-10')).toEqual([0, 30_000]);
    // Ophør dagen efter 20/1 = 21/1: 30000 → 0 på samme x (lodret ned).
    expect(valuesAt('2023-01-21')).toEqual([30_000, 0]);
  });

  it('bevarer fuld højde på det lodrette ophørs-spring', () => {
    // Værdierne udglattes ikke, så ophøret falder fra fuld højde (30000 → 0): før/efter-
    // dubletten på samme x bærer den skarpe kant uafhængigt af kurve-interpolationen.
    const document = {
      model: { titel: 'x' },
      unit: 'maaned',
      timeWindows: [win('2024-01-01', '2024-04-30')],
      beregningsperiode: null,
      skadeMarker: null,
      series: [
        {
          id: 'loen',
          label: 'Løn',
          color: '#2F6B9A',
          segments: [{ fra: toISODateString('2024-01-01'), til: toISODateString('2024-03-31'), amountOre: moneyOre(30_000) }],
        },
      ],
    } as unknown as TafKravGrafDocument;
    const layout = buildWindowLayout(document.timeWindows);
    const mapDate = buildXMapper(layout);
    const sample = buildWindowSamples(document, layout, mapDate)[0];
    if (!sample) throw new Error('forventede sample');

    const xApr1 = mapDate(toISODateString('2024-04-01')) ?? -1;
    const valuesAtApr1 = sample.sampleX
      .map((sx, index) => ({ sx, value: sample.valuesBySeries[0]?.[index] ?? 0 }))
      .filter((column) => Math.abs(column.sx - xApr1) < 0.0001)
      .map((column) => column.value);
    expect(valuesAtApr1).toEqual([30_000, 0]);
  });
});

describe('tafKravGrafChart — x-akse slutdato', () => {
  const win = (fra: string, til: string) => ({ fra: toISODateString(fra), til: toISODateString(til) });

  it('medtager ikke slutdatoen blandt de automatisk genererede måned/år-labels', () => {
    const ticks = buildDateTicks(win('2024-01-17', '2024-12-31'));

    expect(ticks).not.toContain(toISODateString('2024-12-31'));
  });

  it('tillader slutdato-label når den ikke overlapper den seneste automatiske label', () => {
    expect(canAppendTerminalDateLabel(500, 120, 300, 650)).toBe(true);
  });

  it('afviser slutdato-label når den overlapper den seneste automatiske label', () => {
    expect(canAppendTerminalDateLabel(500, 120, 430, 650)).toBe(false);
  });

  it('afviser slutdato-label når den ville blive klippet i højre side', () => {
    expect(canAppendTerminalDateLabel(500, 140, 300, 560)).toBe(false);
  });
});
