import { __tafKravGrafChartTestables } from '../../document/generators/tafFordelt/tafKravGrafChart';
import { toISODateString } from '../../types/branded';

const { niceCeil, buildNiceMoneyTicks, smoothWithinActiveRuns, buildWindowLayout, buildDateTicks, canAppendTerminalDateLabel } =
  __tafKravGrafChartTestables;

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

describe('tafKravGrafChart — smoothWithinActiveRuns', () => {
  it('lader idel-nul-serier forblive nul', () => {
    expect(smoothWithinActiveRuns([0, 0, 0, 0], 3)).toEqual([0, 0, 0, 0]);
  });

  it('bevarer nul-måneder (intet visuelt tilbageløb før start / efter ophør)', () => {
    const result = smoothWithinActiveRuns([0, 0, 100, 100, 100, 0, 0], 3);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(0);
    expect(result[5]).toBe(0);
    expect(result[6]).toBe(0);
  });

  it('holder en konstant aktiv strækning konstant (fladt gennemsnit = fladt)', () => {
    const result = smoothWithinActiveRuns([0, 100, 100, 100, 0], 3);
    expect(result[1]).toBe(100);
    expect(result[2]).toBe(100);
    expect(result[3]).toBe(100);
  });

  it('window ≤ 1 efterlader de aktive værdier uændrede (radius 0)', () => {
    expect(smoothWithinActiveRuns([0, 40, 0, 90, 0], 1)).toEqual([0, 40, 0, 90, 0]);
  });

  it('smitter ikke på tværs af to adskilte aktive strækninger', () => {
    // To runs adskilt af en nul-måned: den lave run må ikke trække den høje runs niveau ned/op.
    const result = smoothWithinActiveRuns([10, 10, 0, 1000, 1000], 3);
    expect(result[0]).toBe(10);
    expect(result[1]).toBe(10);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(1000);
    expect(result[4]).toBe(1000);
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
