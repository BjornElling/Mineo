import { buildStandardLoenAutofillModel } from '../../../components/tables/autofill/standardLoenAutofillModel';
import { createEoStandardLoenFieldSet } from '../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
import { createEmptyStandardLoenRow } from '../../../domain/aarsloen/standardLoenRowInitialValues';
import { resolveAutofillSuggestion } from '../../../inputCore/autofill/autofillSuggestEngine';
import type { Loenperiode, StandardLoenTableRow } from '../../../schemas/formSchemas';

// De tre tabeltilstande, udvikleren fotograferede i den kørende app 2026-09-07, og som hver især viste en
// forkert ghost. Testen gengiver dem CELLE FOR CELLE, så det målte er præcis det, der stod på skærmen –
// ikke en abstraktion over det. Hver beskrivelse siger, hvad skærmen viste, og hvad den skulle have vist.

const fieldSet = createEoStandardLoenFieldSet('af-1');
const loenRow = (id: string, row: Partial<StandardLoenTableRow>): StandardLoenTableRow => ({
  ...createEmptyStandardLoenRow(id),
  ...row,
});
const amount = (value: number) => ({ kind: 'number' as const, value });

const model = (
  rows: readonly StandardLoenTableRow[],
  loenperiode: Loenperiode,
  trailingRowIds: readonly string[] = ['ny']
) => buildStandardLoenAutofillModel({
  rowIds: [...rows.map((row) => row.id), ...trailingRowIds],
  committedById: new Map(rows.map((row) => [row.id, row])),
  fieldSet,
  loenperiode,
  beloebMode: false,
});

const COL = { maaned: 0, aar: 1, ugeFra: 0, ugeTil: 1, loen: 2, loen2: 3 } as const;
const ghost = (
  built: ReturnType<typeof model>,
  rowId: string,
  colIndex: number
): string | null => resolveAutofillSuggestion(built, rowId, colIndex)?.displayText ?? null;

describe('skærmbillede 1: måned 1, 2, 3 med årstal og en måned 4 UDEN årstal', () => {
  // Skærmen viste ghosten «4» i den tomme månedscelle nederst – i rækken under en celle, hvor der
  // ALLEREDE stod 4. Årsagen var, at månedsserien kun talte rækker, hvor både måned og år stod: måned 4
  // faldt ud, mønstret blev dannet af 1, 2, 3, og forslaget blev 4. Brugeren læser månedskolonnen som
  // 1, 2, 3, 4 og forventer 5.
  const built = model([
    loenRow('r1', { col0_maaned: '1', col1_maaned: '2026', col2: amount(1234) }),
    loenRow('r2', { col0_maaned: '2', col1_maaned: '2026', col2: amount(1234) }),
    loenRow('r3', { col0_maaned: '3', col1_maaned: '2026' }),
    loenRow('r4', { col0_maaned: '4' }),
  ], 'maaned');

  it('foreslår 5 i den tomme månedscelle, ikke 4', () => {
    expect(ghost(built, 'ny', COL.maaned)).toBe('5');
  });

  it('foreslår intet årstal, når årscellen ovenover er tom', () => {
    // Skærmbillede 2 er den samme tabel med caret i den nederste ÅRScelle, hvor ghosten «2026» stod.
    // Cellen ovenover (rækkens fjerde) er tom, så forslaget lå to celler under det seneste årstal.
    expect(ghost(built, 'ny', COL.aar)).toBeNull();
  });

  it('tilbyder årstallet i den række, hvor årscellen faktisk mangler', () => {
    // r4 har måned 4 og en tom årscelle, og cellen ovenover (r3) bærer 2026. Der HØRER forslaget.
    expect(ghost(built, 'r4', COL.aar)).toBe('2026');
  });

  it('foreslår intet lønbeløb, når løncellen ovenover er tom', () => {
    expect(ghost(built, 'ny', COL.loen)).toBeNull();
    expect(ghost(built, 'r4', COL.loen)).toBeNull();
    // … men r3 står lige under et udfyldt beløb og får det tilbudt.
    expect(ghost(built, 'r3', COL.loen)).toBe('1.234,00');
  });
});

describe('skærmbillede 3: uge-tilstand med faldende periodeårstal', () => {
  // Løncellen i tredje række var fokuseret og HAVDE ingen ghost, selv om cellen lige over bar 1.234,00.
  // Årsagen var beløbsgaten: fra-ugerne falder 2025 → 2024 → 2023, så gaten læste et årsskifte mellem
  // hver række og slukkede beløbsforslaget i hele tabellen. Brugeren kunne ikke se nogen grund til det.
  const built = model([
    loenRow('r1', { col0_uge: '42/2025', col1_uge: '43/2025', col2: amount(1234) }),
    loenRow('r2', { col0_uge: '44/2024', col1_uge: '45/2025', col2: amount(1234), col3: amount(123) }),
    loenRow('r3', { col0_uge: '46/2023', col1_uge: '47/2025' }),
    loenRow('r4', { col0_uge: '48/2022', col1_uge: '49/2025' }),
    loenRow('r5', { col0_uge: '50/2021', col1_uge: '51/2025' }),
    loenRow('r6', { col0_uge: '53/2020', col1_uge: '01/2026' }),
  ], 'uge');

  it('foreslår lønbeløbet fra cellen ovenover, uanset periodens årstal', () => {
    expect(ghost(built, 'r3', COL.loen)).toBe('1.234,00');
    expect(ghost(built, 'r3', COL.loen2)).toBe('123,00');
  });

  it('foreslår stadig intet, hvor løncellen ovenover er tom', () => {
    expect(ghost(built, 'r4', COL.loen)).toBeNull();
  });

  it('fortsætter den ensartede til-uge-serie', () => {
    // Til-ugerne vokser med to uger ad gangen hele vejen og krydser årsskiftet til 01/2026.
    expect(ghost(built, 'ny', COL.ugeTil)).toBe('03/2026');
  });
});

describe('grundkravene, som skærmbillederne blev holdt op mod', () => {
  it('altid kun forslag i cellen under en udfyldt celle', () => {
    const built = model([
      loenRow('r1', { col0_maaned: '1', col1_maaned: '2026' }),
      loenRow('r2', { col0_maaned: '2', col1_maaned: '2026' }),
      loenRow('r3', { col0_maaned: '3', col1_maaned: '2026' }),
    ], 'maaned', ['t1', 't2', 't3']);
    expect(ghost(built, 't1', COL.maaned)).toBe('4');
    expect(ghost(built, 't2', COL.maaned)).toBeNull();
    expect(ghost(built, 't3', COL.maaned)).toBeNull();
  });

  it('altid én måned op', () => {
    const pairs = [['1', '2', '3'], ['5', '6', '7'], ['10', '11', '12']] as const;
    for (const [first, second, expected] of pairs) {
      const built = model([
        loenRow('r1', { col0_maaned: first, col1_maaned: '2026' }),
        loenRow('r2', { col0_maaned: second, col1_maaned: '2026' }),
      ], 'maaned');
      expect(ghost(built, 'ny', COL.maaned)).toBe(expected);
      expect(ghost(built, 'ny', COL.aar)).toBe('2026');
    }
  });

  it('altid skifte af årstal ved årsskiftet', () => {
    const built = model([
      loenRow('r1', { col0_maaned: '11', col1_maaned: '2025' }),
      loenRow('r2', { col0_maaned: '12', col1_maaned: '2025' }),
    ], 'maaned');
    expect(ghost(built, 'ny', COL.maaned)).toBe('1');
    expect(ghost(built, 'ny', COL.aar)).toBe('2026');
  });

  it('beløb gentager cellen ovenover, og kun hvis den er udfyldt', () => {
    const repeated = model([
      loenRow('r1', { col0_maaned: '1', col1_maaned: '2026', col2: amount(30000) }),
      loenRow('r2', { col0_maaned: '2', col1_maaned: '2026', col2: amount(31000) }),
    ], 'maaned');
    // Det SENESTE beløb, ikke et mønster: cellen ovenover er den, brugeren kan se.
    expect(ghost(repeated, 'ny', COL.loen)).toBe('31.000,00');

    const emptyAbove = model([
      loenRow('r1', { col0_maaned: '1', col1_maaned: '2026', col2: amount(30000) }),
      loenRow('r2', { col0_maaned: '2', col1_maaned: '2026' }),
    ], 'maaned');
    expect(ghost(emptyAbove, 'ny', COL.loen)).toBeNull();
  });
});
