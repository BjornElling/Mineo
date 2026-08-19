import {
  VISUAL_ROW_TOLERANCE_PX,
  buildFocusRows,
  resolveCircularNeighbor,
  resolveHorizontalTarget,
  resolveRowMembers,
  resolveVerticalTarget,
  type FocusCandidate,
} from '../../../components/layout/containerNavigation/focusRowGeometry';

/**
 * Det VARIGE net under `Container`s pil-navigation (#26).
 *
 * Værdien ligger i at geometrien nu er en ren funktion: før omlægningen kunne disse regler
 * kun rammes gennem en fuld render, hvor jsdom ikke har layout – alle rects var 0×0, så
 * række-tolerancen, den vandrette sortering og prioriteten mellem DOM-række og visuel linje
 * var i praksis udækkede. Her er de tabelsatte, med præcise koordinater.
 *
 * `Container.test.tsx` dækker fortsat den observerbare tastatur-kontrakt gennem DOM;
 * dette dækker beslutningen om HVEM der er nabo.
 */

type Row = string | null;

/** Kortform: `candidate('a', left, top, rowContainer?, { table })`. */
const candidate = (
  element: string,
  left: number,
  top: number,
  rowContainer: Row = null,
  options: { table?: boolean; rowContainerTop?: number } = {},
): FocusCandidate<string> => ({
  element,
  rect: { left, top },
  rowContainer,
  rowContainerTop: rowContainer === null ? null : options.rowContainerTop ?? top,
  isInTableNavigation: options.table === true,
});

const elementsOf = <T,>(candidates: readonly FocusCandidate<T>[]): T[] =>
  candidates.map((entry) => entry.element);

describe('resolveCircularNeighbor', () => {
  it('går frem og tilbage med wrap i begge ender', () => {
    const items = ['a', 'b', 'c'];
    expect(resolveCircularNeighbor(items, 'a', 1)).toBe('b');
    expect(resolveCircularNeighbor(items, 'c', 1)).toBe('a');
    expect(resolveCircularNeighbor(items, 'a', -1)).toBe('c');
    expect(resolveCircularNeighbor(items, 'b', -1)).toBe('a');
  });

  it('peger på sig selv i en enkelt-element-liste (ingen bevægelse, ingen fejl)', () => {
    expect(resolveCircularNeighbor(['a'], 'a', 1)).toBe('a');
  });

  it('returnerer null når det aktive element ikke er i listen – kalderen skal lade tasten passere', () => {
    expect(resolveCircularNeighbor(['a', 'b'], 'x', 1)).toBeNull();
    expect(resolveCircularNeighbor([], 'a', 1)).toBeNull();
  });
});

describe('resolveRowMembers', () => {
  it('sorterer rækken vandret uanset DOM-rækkefølge', () => {
    const right = candidate('right', 200, 100, 'r1');
    const left = candidate('left', 20, 100, 'r1');
    // Bevidst omvendt indsat: DOM-rækkefølgen må ikke afgøre rækkefølgen.
    expect(elementsOf(resolveRowMembers([right, left], left))).toEqual(['left', 'right']);
  });

  it('bryder lige `left` på `top`, så to felter aldrig får ustabil orden', () => {
    const lower = candidate('lower', 50, 108, 'r1');
    const upper = candidate('upper', 50, 100, 'r1');
    expect(elementsOf(resolveRowMembers([lower, upper], upper))).toEqual(['upper', 'lower']);
  });

  it('holder rækker med hver sin DOM-container adskilt, også når de ligger på samme top', () => {
    const a = candidate('a', 20, 100, 'r1');
    const b = candidate('b', 200, 100, 'r2');
    expect(elementsOf(resolveRowMembers([a, b], a))).toEqual(['a']);
  });

  it('optager et container-løst felt i en containerbaseret række, når det ligger på linjen', () => {
    const inRow = candidate('inRow', 20, 100, 'r1');
    const loose = candidate('loose', 300, 100 + VISUAL_ROW_TOLERANCE_PX, null);
    expect(elementsOf(resolveRowMembers([inRow, loose], inRow))).toEqual(['inRow', 'loose']);
  });

  it('udelukker et container-løst felt lige uden for tolerancen', () => {
    const inRow = candidate('inRow', 20, 100, 'r1');
    const tooFar = candidate('tooFar', 300, 100 + VISUAL_ROW_TOLERANCE_PX + 1, null);
    expect(elementsOf(resolveRowMembers([inRow, tooFar], inRow))).toEqual(['inRow']);
  });

  it('er ASYMMETRISK: fra et container-løst felt ses kun andre container-løse felter', () => {
    // Bevaret arv fra den oprindelige Container (#26 ændrede den bevidst ikke): et
    // container-løst felt kan nås fra rækken, men kan ikke pile tilbage ind i den.
    // Casen står her, så en fremtidig ændring af reglen bliver et synligt valg.
    const inRow = candidate('inRow', 20, 100, 'r1');
    const loose = candidate('loose', 300, 100, null);
    expect(elementsOf(resolveRowMembers([inRow, loose], loose))).toEqual(['loose']);
  });

  it('grupperer to container-løse felter på samme linje', () => {
    const a = candidate('a', 20, 100, null);
    const b = candidate('b', 200, 104, null);
    expect(elementsOf(resolveRowMembers([a, b], a))).toEqual(['a', 'b']);
  });
});

describe('buildFocusRows', () => {
  it('sorterer rækkerne oppefra og ned og fletter DOM- og visuelle rækker', () => {
    const rows = buildFocusRows([
      candidate('c', 20, 300, null),
      candidate('a1', 20, 100, 'r1'),
      candidate('b', 20, 200, null),
      candidate('a2', 200, 100, 'r1'),
    ]);
    expect(rows.map((row) => elementsOf(row.elements))).toEqual([['a1', 'a2'], ['b'], ['c']]);
  });

  it('bruger DOM-containerens egen top som rækkens nøgle, ikke det første felts', () => {
    // Containeren starter over sine felter (padding); rækkefølgen skal følge containeren.
    const rows = buildFocusRows([
      candidate('inContainer', 20, 150, 'r1', { rowContainerTop: 100 }),
      candidate('loose', 20, 120, null),
    ]);
    expect(rows.map((row) => elementsOf(row.elements))).toEqual([['inContainer'], ['loose']]);
  });

  it('samler alle felter fra samme container i én række, uanset deres egen top', () => {
    const rows = buildFocusRows([
      candidate('a', 20, 100, 'r1'),
      candidate('b', 200, 130, 'r1'),
    ]);
    expect(rows).toHaveLength(1);
    expect(elementsOf(rows[0].elements)).toEqual(['a', 'b']);
  });

  it('medtager tabel-felter, så en kant-exit kan finde nabo-rækken', () => {
    const rows = buildFocusRows([
      candidate('above', 20, 100, null),
      candidate('cell', 20, 200, null, { table: true }),
    ]);
    expect(rows.map((row) => elementsOf(row.elements))).toEqual([['above'], ['cell']]);
  });

  it('giver en tom liste for ingen kandidater', () => {
    expect(buildFocusRows([])).toEqual([]);
  });
});

describe('resolveVerticalTarget', () => {
  const rows = [
    candidate('r1a', 20, 100, 'r1'),
    candidate('r1b', 200, 100, 'r1'),
    candidate('r2a', 20, 200, 'r2'),
    candidate('r2b', 200, 200, 'r2'),
  ];

  it('ArrowDown lander på næste rækkes FØRSTE felt', () => {
    expect(resolveVerticalTarget(rows, rows[0], 'down')?.element).toBe('r2a');
  });

  it('ArrowUp lander på forrige rækkes SIDSTE felt', () => {
    expect(resolveVerticalTarget(rows, rows[2], 'up')?.element).toBe('r1b');
  });

  it('wrapper i begge retninger', () => {
    expect(resolveVerticalTarget(rows, rows[2], 'down')?.element).toBe('r1a');
    expect(resolveVerticalTarget(rows, rows[0], 'up')?.element).toBe('r2b');
  });

  it('returnerer null når det aktive felt ikke er blandt kandidaterne', () => {
    expect(resolveVerticalTarget(rows, candidate('fremmed', 0, 0, null), 'down')).toBeNull();
  });

  it('peger på det aktive felts egen række, når det er den eneste', () => {
    const only = candidate('only', 20, 100, null);
    expect(resolveVerticalTarget([only], only, 'down')?.element).toBe('only');
  });
});

describe('resolveHorizontalTarget', () => {
  it('går til naboen i rækken med wrap', () => {
    const row = [
      candidate('a', 20, 100, 'r1'),
      candidate('b', 120, 100, 'r1'),
      candidate('c', 220, 100, 'r1'),
    ];
    expect(resolveHorizontalTarget(row, row[0], 'right')?.element).toBe('b');
    expect(resolveHorizontalTarget(row, row[2], 'right')?.element).toBe('a');
    expect(resolveHorizontalTarget(row, row[0], 'left')?.element).toBe('c');
  });

  it('UDELUKKER tabel-felter: et sidefelt på tabellens linje pile ikke ind i cellerne', () => {
    const candidates = [
      candidate('cell1', 20, 500, null, { table: true }),
      candidate('cell2', 120, 500, null, { table: true }),
      candidate('beside', 320, 500, null),
    ];
    const beside = candidates[2];
    // Uden udelukkelsen ville naboen være 'cell2'.
    expect(resolveHorizontalTarget(candidates, beside, 'left')?.element).toBe('beside');
    expect(resolveHorizontalTarget(candidates, beside, 'right')?.element).toBe('beside');
  });

  it('returnerer null når det aktive felt selv er et tabel-felt (tabellen ejer tasten)', () => {
    const candidates = [
      candidate('cell1', 20, 500, null, { table: true }),
      candidate('beside', 320, 500, null),
    ];
    expect(resolveHorizontalTarget(candidates, candidates[0], 'right')).toBeNull();
  });

  it('returnerer null når det aktive felt ikke er blandt kandidaterne', () => {
    const row = [candidate('a', 20, 100, 'r1')];
    expect(resolveHorizontalTarget(row, candidate('fremmed', 0, 0, null), 'right')).toBeNull();
  });
});
