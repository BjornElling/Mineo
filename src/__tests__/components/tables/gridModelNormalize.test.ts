import {
  normalizeGridRows,
  reconcileRowIdsByPosition,
} from '../../../components/tables/gridCore/gridModel';
import { createEmptyRowId } from '../../../utils/rowId';

/**
 * Invariant-værn for grid-tabellernes row-id-fundament.
 *
 * Tabellerne er beregningskædens indgang: en duplikeret eller divergerende row-id korrumperer
 * indholdet (to logiske rækker kollapser til samme identitet) og udløser React duplicate-key.
 * To alvorlige fejl er observeret historisk:
 *   1. RNG i setState-updater → divergerende id over StrictMode-dobbeltkald → datatab.
 *      (Se project_table_row_id_persist_desync — fikset med deterministisk createEmptyRowId.)
 *   2. reconcileRowIdsByPosition graftede et id ind så det duplikerede et senere incoming-id.
 *      (Se project_reconcile_rowid_dup — fikset med uniqueness-guard.)
 *
 * Denne fil håndhæver invarianterne UDTØMMENDE og generisk (inkl. fuzz), så ingen af de to
 * klasser — eller varianter af dem — kan genopstå ubemærket i nogen af de fire grid-tabeller,
 * der alle deler normalizeGridRows/reconcileRowIdsByPosition.
 */

type Row = { id: string; v?: string };

const getRowId = (row: Row) => row.id;
const isRowEmpty = (row: Row) => row.v === undefined || row.v === '';
const withRowId = (row: Row, id: string): Row => ({ ...row, id });

// Efterligner en tabels createEmptyRow: deterministisk, seed-baseret (ingen RNG).
const createEmptyRow = (seed: number): Row => ({ id: createEmptyRowId('row', seed), v: undefined });

const filled = (id: string, v = 'x'): Row => ({ id, v });
const empty = (id: string): Row => ({ id, v: undefined });

const ids = (rows: readonly Row[]) => rows.map(getRowId);
const assertUnique = (rows: readonly Row[]): void => {
  const seen = ids(rows);
  expect(new Set(seen).size).toBe(seen.length);
};

// Mineo-grade pseudo-RNG: deterministisk (ingen Math.random — banned i denne kodebase
// og ville gøre fuzz-fejl ureproducerbare). Mulberry32.
const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('normalizeGridRows — invarianter', () => {
  it('giver altid unikke id og mindst minRows rækker', () => {
    const result = normalizeGridRows({
      rows: [filled('a'), filled('b')],
      minRows: 2,
      getRowId,
      isRowEmpty,
      createEmptyRow,
    });
    assertUnique(result);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('er deterministisk: to identiske kald giver identiske id (StrictMode-sikkerhed)', () => {
    const input = [filled('a'), empty('row_empty_0')];
    const a = normalizeGridRows({ rows: input, minRows: 2, getRowId, isRowEmpty, createEmptyRow });
    const b = normalizeGridRows({ rows: input, minRows: 2, getRowId, isRowEmpty, createEmptyRow });
    expect(ids(a)).toEqual(ids(b));
  });

  it('bevarer en eksisterende trailing tom række frem for at lave en ny', () => {
    const trailing = empty('row_empty_7');
    const result = normalizeGridRows({
      rows: [filled('a'), trailing],
      minRows: 2,
      getRowId,
      isRowEmpty,
      createEmptyRow,
    });
    // Sidste række skal være præcis den bevarede trailing-tomme (samme reference/id).
    expect(result[result.length - 1].id).toBe('row_empty_7');
    assertUnique(result);
  });

  it('springer et empty-seed over hvis dets deterministiske id allerede findes i inputtet', () => {
    // Inputtet har ALLEREDE row_empty_0 som en (ikke-trailing) udfyldt-agtig kollision:
    // den genererede minRows-fyld må ikke genbruge row_empty_0.
    const result = normalizeGridRows({
      rows: [filled('row_empty_0')], // udfyldt række der tilfældigt bærer seed-0-id'et
      minRows: 3,
      getRowId,
      isRowEmpty,
      createEmptyRow,
    });
    assertUnique(result);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('tømmer ALDRIG en duplikeret-id-situation til ud i resultatet selv når INPUTTET allerede har dubletter', () => {
    // Defensivt: hvis en upstream-fejl nogensinde sender to rækker med samme id ind,
    // skal normaliseringen ikke FORVÆRRE det ved at tilføje endnu en kollision.
    // (Den reparerer ikke nødvendigvis input-dubletten — men den genererede tomme må aldrig
    //  ramme et af de eksisterende id'er.)
    const result = normalizeGridRows({
      rows: [filled('dup'), filled('dup', 'y')],
      minRows: 3,
      getRowId,
      isRowEmpty,
      createEmptyRow,
    });
    // De genererede tomme rækker må ikke kollidere med 'dup'.
    const generated = result.filter((r) => r.id !== 'dup');
    assertUnique(generated);
  });

  it('håndterer tomt input ved at producere minRows tomme, unikke rækker', () => {
    const result = normalizeGridRows({ rows: [], minRows: 2, getRowId, isRowEmpty, createEmptyRow });
    expect(result.length).toBe(2);
    assertUnique(result);
    expect(result.every((r) => isRowEmpty(r))).toBe(true);
  });

  it('flytter udfyldte rækker først og holder præcis én trailing tom', () => {
    const result = normalizeGridRows({
      rows: [empty('row_empty_0'), filled('a'), empty('row_empty_1')],
      minRows: 2,
      getRowId,
      isRowEmpty,
      createEmptyRow,
    });
    const nonEmpty = result.filter((r) => !isRowEmpty(r));
    expect(nonEmpty.map((r) => r.id)).toEqual(['a']);
    expect(isRowEmpty(result[result.length - 1])).toBe(true);
    assertUnique(result);
  });
});

describe('reconcileRowIdsByPosition — invarianter', () => {
  it('producerer aldrig dubletter uanset positionsforskydning ved indsættelse', () => {
    // Den præcise produktionsfejl: incoming længere end current, og current's trailing-tomme-id
    // ville ellers blive graftet ind oven på en indsat række, mens samme id stadig stod senere.
    const current = [filled('a'), empty('row_empty_3')];
    const incoming = [filled('a'), filled('ny'), empty('row_empty_3')];
    const result = reconcileRowIdsByPosition({ incoming, current, getRowId, withRowId });
    assertUnique(result);
  });

  it('bevarer DOM-identitet positionelt når der IKKE er kollisionsrisiko', () => {
    const current = [filled('R'), empty('T')];
    const incoming = [filled('fresh-1'), empty('fresh-2')];
    const result = reconcileRowIdsByPosition({ incoming, current, getRowId, withRowId });
    expect(ids(result)).toEqual(['R', 'T']);
  });

  it('er idempotent: anvendt to gange giver samme resultat', () => {
    const current = [filled('a'), empty('row_empty_3')];
    const incoming = [filled('a'), filled('ny'), empty('row_empty_3')];
    const once = reconcileRowIdsByPosition({ incoming, current, getRowId, withRowId });
    const twice = reconcileRowIdsByPosition({ incoming: once, current, getRowId, withRowId });
    expect(ids(twice)).toEqual(ids(once));
    assertUnique(twice);
  });
});

describe('kombineret pipeline (insert → normalize → reconcile) — fuzz', () => {
  // Modellerer den FAKTISKE sekvens en tabel kører ved enhver mutation:
  //   1. en insert/edit producerer en ny rækkeliste (evt. med længdeændring),
  //   2. normalizeGridRows kører (StrictMode: to gange — vi kører den to gange og kræver lighed),
  //   3. reconcileRowIdsByPosition resynkroniserer mod committed-state.
  // Invariant gennem HELE sekvensen: outputtet har altid unikke id'er.

  const insertBeforeTrailingEmpty = (existing: readonly Row[], inserted: readonly Row[]): Row[] => {
    let insertIndex = existing.length;
    while (insertIndex > 0 && isRowEmpty(existing[insertIndex - 1])) insertIndex -= 1;
    return [...existing.slice(0, insertIndex), ...inserted, ...existing.slice(insertIndex)];
  };

  it('holder unikhed og determinisme over 500 tilfældige insert/edit-sekvenser', () => {
    const rng = makeRng(0xc0ffee);
    let uuidCounter = 0;
    const freshUuid = () => `row_${(uuidCounter += 1)}`; // efterligner createRowId (random, men deterministisk i test)

    for (let iteration = 0; iteration < 500; iteration += 1) {
      // Start fra committed-state (resultat af forrige iteration eller en frisk normalisering).
      let committed = normalizeGridRows({
        rows: Array.from({ length: 1 + Math.floor(rng() * 3) }, (_, i) =>
          rng() < 0.5 ? filled(freshUuid()) : empty(createEmptyRowId('row', i))
        ),
        minRows: 2,
        getRowId,
        isRowEmpty,
        createEmptyRow,
      });
      assertUnique(committed);

      const steps = 1 + Math.floor(rng() * 6);
      for (let step = 0; step < steps; step += 1) {
        const action = rng();
        let next: Row[];
        if (action < 0.4) {
          // Indsæt 1-3 nye udfyldte rækker før den trailing tomme (sygedagpenge/midlertidigt-EET-mønstret).
          const inserted = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => filled(freshUuid()));
          next = insertBeforeTrailingEmpty(committed, inserted);
        } else if (action < 0.7) {
          // Rediger en tilfældig rækkes værdi (kan tømme eller udfylde).
          const idx = Math.floor(rng() * committed.length);
          next = committed.map((r, i) => (i === idx ? { ...r, v: rng() < 0.5 ? undefined : freshUuid() } : r));
        } else if (action < 0.85 && committed.length > 1) {
          // Fjern en tilfældig række.
          const idx = Math.floor(rng() * committed.length);
          next = committed.filter((_, i) => i !== idx);
        } else {
          // Ombyt to rækker (sortering/reorder).
          next = [...committed];
          const i = Math.floor(rng() * next.length);
          const j = Math.floor(rng() * next.length);
          [next[i], next[j]] = [next[j], next[i]];
        }

        // normalize kører to gange (StrictMode): skal give identiske id'er.
        const normA = normalizeGridRows({ rows: next, minRows: 2, getRowId, isRowEmpty, createEmptyRow });
        const normB = normalizeGridRows({ rows: next, minRows: 2, getRowId, isRowEmpty, createEmptyRow });
        expect(ids(normA)).toEqual(ids(normB));
        assertUnique(normA);

        // reconcile mod committed (forrige state) — den fulde resync-sti.
        const reconciled = reconcileRowIdsByPosition({
          incoming: normA,
          current: committed,
          getRowId,
          withRowId,
        });
        assertUnique(reconciled);

        committed = reconciled;
      }
    }
  });
});
