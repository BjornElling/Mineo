/// <reference types="vitest/globals" />

/**
 * Golden-value-net for TAF-kravgrafens scene-model (#50).
 *
 * Grafen kunne før kun verificeres med øjnene: `renderTafKravGrafChartPng` og alle
 * `draw*`-funktioner var utestede, fordi jsdom ikke har et canvas-API. Efter opdelingen
 * er hver visuel beslutning – koordinat, farve, skrift, tekst, rækkefølge – en værdi i
 * scene-modellen, og dette net fastfryser den.
 *
 * Kontrakten er PIXEL-TROSKAB (udviklerbeslutning 2026-08-06, pkt. 3): scene-modellen skal
 * reproducere den hidtidige tegning. En utilsigtet afvigelse – et flyttet koordinat, en
 * ændret farve, en tabt label – fejler her. Ægte tegnefejl må rettes, men skal forelægges
 * brugeren enkeltvis; en snapshot-opdatering uden den forelæggelse er et kontraktbrud.
 *
 * Tekstmåling injiceres som en deterministisk stub (bredde = tegn × faktor), så
 * snapshottet ikke afhænger af en font-motor. Kollisions- og centreringslogikken testes
 * derfor på sin egen regel, ikke på Arials metrikker.
 */

import { moneyOre } from '../../domain/money/money';
import {
  buildTafKravGrafScene,
  type MeasureText,
  type SceneCommand,
  type TafKravGrafScene,
} from '../../document/generators/tafFordelt/tafKravGrafScene';
import type {
  TafKravGrafDocument,
  TafKravGrafSeries,
} from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import { toISODateString } from '../../types/branded';

// Deterministisk tekstmåling: proportional med tegnantallet og fontens px-størrelse, så
// snapshottet er stabilt på tværs af maskiner. Formen er tilstrækkelig til at drive de
// beslutninger scenen træffer (centrering af signaturrækken, kollision mellem x-labels).
const measureText: MeasureText = (text, font) => {
  const px = Number(/(\d+)px/.exec(font)?.[1] ?? 30);
  return text.length * px * 0.5;
};

const iso = toISODateString;

const series = (
  id: string,
  label: string,
  color: string,
  segments: readonly (readonly [string, string, number])[]
): TafKravGrafSeries => ({
  id,
  label,
  color,
  segments: segments.map(([fra, til, ore]) => ({
    fra: iso(fra),
    til: iso(til),
    amountOre: moneyOre(ore),
  })),
});

/**
 * Fixture der bevidst rammer HVER visuel gren: to tidsvinduer (⇒ akse-brud), stablede
 * serier, en serie der starter og ophører midt i et vindue (⇒ skarpe lodrette kanter),
 * et rent niveauskift (⇒ blød bue), beregningsperiode, skademarkør og feriebånd
 * (⇒ begge signaturrækker).
 */
const fullDocument = {
  model: { titel: 'Visuel graf over indtægtsniveau' },
  unit: 'maaned',
  timeWindows: [
    { fra: iso('2023-01-01'), til: iso('2023-06-30') },
    { fra: iso('2024-01-01'), til: iso('2024-04-30') },
  ],
  beregningsperiode: { fra: iso('2023-02-01'), til: iso('2023-04-30') },
  skadeMarker: { date: iso('2023-05-15'), label: 'Skadedato' },
  ferieAbsenceMarkers: [{ fra: iso('2024-02-05'), til: iso('2024-02-16') }],
  series: [
    series('loen', 'Løn', '#2F6B9A', [
      // Niveauskift 30.000 → 35.000 uden nulpunkt imellem: skal give en blød bue.
      ['2023-01-01', '2023-03-31', 30_000_00],
      ['2023-04-01', '2023-06-30', 35_000_00],
      ['2024-01-01', '2024-04-30', 38_000_00],
    ]),
    series('sygedagpenge', 'Sygedagpenge', '#4F8A5B', [
      // Starter og ophører inde i vinduet: skal give to skarpe lodrette kanter.
      ['2023-03-01', '2023-04-15', 4_695_00],
    ]),
  ],
} as unknown as TafKravGrafDocument;

/** Minimalt dokument: ét vindue, én serie, ingen markører (⇒ kun én signaturrække). */
const minimalDocument = {
  model: { titel: 'Visuel graf over indtægtsniveau' },
  unit: 'arbejdsdag',
  timeWindows: [{ fra: iso('2024-01-01'), til: iso('2024-03-31') }],
  beregningsperiode: null,
  skadeMarker: null,
  ferieAbsenceMarkers: [],
  series: [series('loen', 'Løn', '#2F6B9A', [['2024-01-01', '2024-03-31', 1_850_00]])],
} as unknown as TafKravGrafDocument;

// Koordinater afrundes til 3 decimaler i snapshottet: nok til at fange enhver synlig
// forskydning (grafen er 2570 px bred), men uden at binde nettet til flydende-komma-støj.
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const roundDeep = (value: unknown): unknown => {
  if (typeof value === 'number') return round3(value);
  if (Array.isArray(value)) return value.map(roundDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, roundDeep(inner)]));
  }
  return value;
};

const serializeScene = (scene: TafKravGrafScene): unknown => roundDeep(scene);

const textsOf = (scene: TafKravGrafScene): string[] =>
  scene.commands.filter((c): c is Extract<SceneCommand, { kind: 'text' }> => c.kind === 'text')
    .map((c) => c.text);

describe('tafKravGrafScene – golden (pixel-troskab)', () => {
  it('fastfryser hele scenen for det fulde dokument', () => {
    expect(serializeScene(buildTafKravGrafScene(fullDocument, measureText))).toMatchSnapshot();
  });

  it('fastfryser hele scenen for det minimale dokument', () => {
    expect(serializeScene(buildTafKravGrafScene(minimalDocument, measureText))).toMatchSnapshot();
  });
});

describe('tafKravGrafScene – strukturelle invarianter', () => {
  const scene = buildTafKravGrafScene(fullDocument, measureText);

  it('er deterministisk: samme input giver identisk scene', () => {
    expect(serializeScene(buildTafKravGrafScene(fullDocument, measureText))).toEqual(
      serializeScene(scene)
    );
  });

  it('har lærredsmål der matcher PDF-indlejringens sideforhold', () => {
    expect(scene.width).toBe(2570);
    expect(scene.height).toBe(1420);
  });

  it('balancerer clip og restore, så intet efterlades klippet', () => {
    let depth = 0;
    for (const command of scene.commands) {
      if (command.kind === 'clipRoundRect') depth += 1;
      if (command.kind === 'restore') depth -= 1;
      // Et `restore` uden matchende `clip` ville nulstille canvas-tilstand, kalderen ejer.
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });

  it('tegner båndene inde i clip-området og markørerne uden for', () => {
    const clipIndex = scene.commands.findIndex((c) => c.kind === 'clipRoundRect');
    const restoreIndex = scene.commands.findIndex((c) => c.kind === 'restore');
    const bandIndexes = scene.commands
      .map((c, index) => (c.kind === 'fillPath' ? index : -1))
      .filter((index) => index >= 0);

    expect(bandIndexes.length).toBeGreaterThan(0);
    for (const index of bandIndexes) {
      expect(index).toBeGreaterThan(clipIndex);
      expect(index).toBeLessThan(restoreIndex);
    }
    // Signaturen står under grafen og må aldrig ligge inde i clippet.
    const legendIndex = scene.commands.findIndex(
      (c) => c.kind === 'text' && c.text === 'Sygedagpenge'
    );
    expect(legendIndex).toBeGreaterThan(restoreIndex);
  });

  it('viser titel, enhed, alle serie-etiketter og begge markør-etiketter', () => {
    const texts = textsOf(scene);
    expect(texts).toContain('Visuel graf over indtægtsniveau');
    expect(texts).toContain('Beløb pr. måned');
    expect(texts).toContain('Løn');
    expect(texts).toContain('Sygedagpenge');
    expect(texts).toContain('Skadedato');
    expect(texts).toContain('Beregningsperiode');
    expect(texts).toContain('Ferie uden løn');
  });

  it('viser «Beløb pr. arbejdsdag» når enheden er arbejdsdag', () => {
    expect(textsOf(buildTafKravGrafScene(minimalDocument, measureText))).toContain(
      'Beløb pr. arbejdsdag'
    );
  });

  it('udelader markør-signaturerne når dokumentet ikke har markører', () => {
    const texts = textsOf(buildTafKravGrafScene(minimalDocument, measureText));
    expect(texts).not.toContain('Beregningsperiode');
    expect(texts).not.toContain('Ferie uden løn');
    expect(texts).toContain('Løn');
  });

  it('holder alle tegnede koordinater inden for lærredet', () => {
    const xs: number[] = [];
    const ys: number[] = [];
    const addPoint = (x: number, y: number): void => {
      xs.push(x);
      ys.push(y);
    };
    for (const command of scene.commands) {
      switch (command.kind) {
        case 'fillRect':
        case 'fillRoundRect':
        case 'strokeRect':
        case 'clipRoundRect':
          addPoint(command.x, command.y);
          addPoint(command.x + command.width, command.y + command.height);
          break;
        case 'strokeLines':
          for (const [from, to] of command.lines) {
            addPoint(from.x, from.y);
            addPoint(to.x, to.y);
          }
          break;
        case 'strokeSubpaths':
          for (const subpath of command.subpaths) {
            for (const point of subpath) addPoint(point.x, point.y);
          }
          break;
        case 'fillPolygon':
          for (const point of command.points) addPoint(point.x, point.y);
          break;
        case 'fillPath':
          addPoint(command.start.x, command.start.y);
          for (const segment of command.segments) addPoint(segment.x, segment.y);
          break;
        case 'text':
          addPoint(command.x, command.y);
          break;
        case 'restore':
          break;
      }
    }
    // Marginal tolerance: skade-trekanten stikker bevidst 2 px op over plot-toppen.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(scene.width);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(scene.height);
  });

  it('bruger kun serie-farverne fra dokumentet til båndene', () => {
    const bandColors = new Set(
      scene.commands.filter((c) => c.kind === 'fillPath').map((c) => c.color)
    );
    expect([...bandColors].sort()).toEqual(['#2F6B9A', '#4F8A5B']);
  });

  it('centrerer signaturrækken i plot-området', () => {
    const seriesLabels = scene.commands.filter(
      (c): c is Extract<SceneCommand, { kind: 'text' }> =>
        c.kind === 'text' && (c.text === 'Løn' || c.text === 'Sygedagpenge')
    );
    expect(seriesLabels).toHaveLength(2);
    // Begge etiketter i samme række (samme y) og inden for plot-området vandret.
    expect(seriesLabels[0].y).toBe(seriesLabels[1].y);
    for (const label of seriesLabels) {
      expect(label.x).toBeGreaterThan(196);
      expect(label.x).toBeLessThan(2480);
    }
  });
});
