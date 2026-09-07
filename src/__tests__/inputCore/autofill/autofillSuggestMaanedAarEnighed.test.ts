import { buildStandardLoenAutofillModel } from '../../../components/tables/autofill/standardLoenAutofillModel';
import { createEoStandardLoenFieldSet } from '../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
import { createEmptyStandardLoenRow } from '../../../domain/aarsloen/standardLoenRowInitialValues';
import { resolveAutofillSuggestion } from '../../../inputCore/autofill/autofillSuggestEngine';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';

// Måned og år er ÉN serie, men to celler, og brugeren ser dem side om side. Modsagde de hinanden, ville
// rækken være forkert uanset hvilken af de to ghosts brugeren accepterede – og det er en fejl, en test af
// hver kolonne for sig ikke kan fange. Denne fil måler derfor SAMMENHÆNGEN som en invariant over en bred
// vifte af tabeltilstande, i stedet for at fastlåse et forventet tal for hver enkelt.

const fieldSet = createEoStandardLoenFieldSet('af-1');
const row = (id: string, r: Partial<StandardLoenTableRow>) => ({ ...createEmptyStandardLoenRow(id), ...r });

const build = (pairs: readonly (readonly [string, string])[]) => buildStandardLoenAutofillModel({
  rowIds: [...pairs.map((_, i) => `r${String(i)}`), 'ny'],
  committedById: new Map(pairs.map(([mo, yr], i) => [`r${String(i)}`, row(`r${String(i)}`, {
    col0_maaned: mo, col1_maaned: yr,
  })])),
  fieldSet,
  loenperiode: 'maaned',
  beloebMode: false,
});

const ghost = (m: ReturnType<typeof build>, colIndex: number): string | null =>
  resolveAutofillSuggestion(m, 'ny', colIndex)?.displayText ?? null;

/** Tabeltilstande, der dækker de veje motoren kan tage frem til et måneds- og et årsforslag. */
const TILSTANDE: readonly (readonly (readonly [string, string])[])[] = [
  [['1', '2026'], ['2', '2026']],
  [['11', '2025'], ['12', '2025']],
  [['12', '2025'], ['1', '2026']],
  [['12', '2026']],
  [['1', '2026']],
  [['2', '2026'], ['1', '2026']],
  [['3', '2026'], ['2', '2026'], ['1', '2026']],
  [['1', '2026'], ['4', '2026'], ['7', '2026'], ['10', '2026']],
  [['10', '2026'], ['1', '2027']],
  [['6', '2026'], ['12', '2026']],
  [['1', '2026'], ['1', '2026']],
  [['1', '2026'], ['2', '2030']],
  [['1', '2026'], ['2', ''], ['3', '2026']],
  [['1', ''], ['2', ''], ['3', '2026']],
  [['12', '2025'], ['1', ''], ['2', '']],
  [['11', '2025'], ['12', '2025'], ['1', '']],
  [['5', '2026'], ['6', '2026'], ['7', ''], ['8', '']],
  [['12', '2025'], ['11', '2025'], ['10', '']],
];

const absolute = (month: number, year: number): number => year * 12 + (month - 1);

describe('måneds- og årsforslaget modsiger aldrig hinanden', () => {
  it.each(TILSTANDE.map((pairs) => [
    pairs.map(([mo, yr]) => `${mo}/${yr === '' ? '____' : yr}`).join(' '),
    pairs,
  ] as const))('%s', (_label, pairs) => {
    const built = build(pairs);
    const maaned = ghost(built, 0);
    const aar = ghost(built, 1);
    if (maaned === null || aar === null) return;

    // Det par, de to ghosts danner, skal være en NY plads i kalenderen – aldrig den samme som den
    // seneste komplette prøve, for da ville accepten skrive en række, der allerede står i tabellen.
    const lastComplete = [...pairs].reverse().find(([, yr]) => yr !== '');
    expect(lastComplete).toBeDefined();
    const [lastMonth, lastYear] = lastComplete ?? ['', ''];
    const suggested = absolute(Number(maaned), Number(aar));
    expect(suggested).not.toBe(absolute(Number(lastMonth), Number(lastYear)));

    // Og parret skal ligge i samme retning som serien selv løber: en voksende serie må ikke få et
    // forslag, der peger bagud, og en faldende ikke et, der peger fremad.
    const complete = pairs.filter(([, yr]) => yr !== '');
    const [firstComplete] = complete;
    if (complete.length >= 2 && firstComplete !== undefined) {
      const first = absolute(Number(firstComplete[0]), Number(firstComplete[1]));
      const last = absolute(Number(lastMonth), Number(lastYear));
      if (last > first) expect(suggested).toBeGreaterThan(last);
      if (last < first) expect(suggested).toBeLessThan(last);
    }
  });

  it('foreslår intet årstal, når årscellen ovenover er tom – uanset månedsforslaget', () => {
    // Situationen fra det andet skærmbillede. Månedskolonnen fortsætter, fordi dens egen nabocelle er
    // udfyldt; årskolonnen gør ikke, fordi dens ikke er.
    for (const pairs of [
      [['12', '2025'], ['1', ''], ['2', '']],
      [['11', '2025'], ['12', '2025'], ['1', '']],
      [['12', '2025'], ['11', '2025'], ['10', '']],
    ] as const) {
      const built = build(pairs);
      expect(ghost(built, 0)).not.toBeNull();
      expect(ghost(built, 1)).toBeNull();
    }
  });
});
