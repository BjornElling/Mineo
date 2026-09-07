import { buildOffentligeYdelserAutofillModel } from '../../../components/tables/autofill/offentligeYdelserAutofillModel';
import { buildStandardLoenAutofillModel } from '../../../components/tables/autofill/standardLoenAutofillModel';
import { createEoStandardLoenFieldSet } from '../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
import { isAmountExpressionDraftAllowed } from '../../../utils/numericDraftAdmission';
import { resolveAutofillSuggestion } from '../../../inputCore/autofill/autofillSuggestEngine';
import { EMPTY_AUTOFILL_SUGGEST_MODEL } from '../../../inputCore/autofill/autofillSuggestModel';
import { createEmptyStandardLoenRow } from '../../../domain/aarsloen/standardLoenRowInitialValues';
import type { OffentligeYdelserRow, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

// Motoren er ren, men prøves gennem de RIGTIGE modelbyggere og de RIGTIGE produktionsdescriptorer.
// Så måler testen både mønstret og formateringen: ghost-teksten er den, cellen faktisk vil vise, og
// råteksten er den, feltets eget codec kan læse tilbage.

const iso = (value: string) => toISODateString(value);
const amount = (value: number) => ({ kind: 'number' as const, value });

const YDELSE_COL = { fraDato: 0, tilDato: 1, ydelse: 2, tillaeg: 3, ydelsestype: 4 } as const;
const LOEN_COL = { period0: 0, period1: 1, col2: 2 } as const;

const ydelseRow = (id: string, row: Partial<OffentligeYdelserRow>): OffentligeYdelserRow => ({
  id,
  fraDato: undefined,
  tilDato: undefined,
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: '',
  ...row,
});

const ydelserModel = (rows: readonly OffentligeYdelserRow[], trailingRowIds: readonly string[] = ['ny']) =>
  buildOffentligeYdelserAutofillModel(
    [...rows.map((row) => row.id), ...trailingRowIds],
    new Map(rows.map((row) => [row.id, row]))
  );

const loenRow = (id: string, row: Partial<StandardLoenTableRow>): StandardLoenTableRow => ({
  ...createEmptyStandardLoenRow(id),
  ...row,
});

const fieldSet = createEoStandardLoenFieldSet('af-1');

const loenModel = (
  rows: readonly StandardLoenTableRow[],
  options: Readonly<{
    loenperiode: 'maaned' | 'uge' | 'dag';
    beloebMode?: boolean;
    trailingRowIds?: readonly string[];
  }>
) => buildStandardLoenAutofillModel({
  rowIds: [...rows.map((row) => row.id), ...(options.trailingRowIds ?? ['ny'])],
  committedById: new Map(rows.map((row) => [row.id, row])),
  fieldSet,
  loenperiode: options.loenperiode,
  beloebMode: options.beloebMode ?? false,
});

describe('resolveAutofillSuggestion', () => {
  describe('grundregler', () => {
    it('giver intet forslag uden model', () => {
      expect(resolveAutofillSuggestion(EMPTY_AUTOFILL_SUGGEST_MODEL, 'ny', 0)).toBeNull();
    });

    it('giver intet forslag for en ukendt række eller kolonne', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01') }),
        ydelseRow('r2', { fraDato: iso('2026-02-01') }),
      ]);
      expect(resolveAutofillSuggestion(model, 'findes-ikke', YDELSE_COL.fraDato)).toBeNull();
      expect(resolveAutofillSuggestion(model, 'ny', 42)).toBeNull();
    });

    it('kræver to prøver – én udfyldt række giver intet forslag', () => {
      const model = ydelserModel([ydelseRow('r1', { fraDato: iso('2026-01-01') })]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)).toBeNull();
    });

    it('foreslår ALDRIG i en celle, der allerede har en afsluttet værdi', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01') }),
        ydelseRow('r2', { fraDato: iso('2026-02-01') }),
        ydelseRow('r3', { fraDato: iso('2026-07-07') }),
      ], []);
      expect(resolveAutofillSuggestion(model, 'r3', YDELSE_COL.fraDato)).toBeNull();
    });

    it('ekstrapolerer ikke bagud: en tom række OVER de udfyldte får intet forslag', () => {
      const model = ydelserModel([
        ydelseRow('tom', {}),
        ydelseRow('r2', { fraDato: iso('2026-02-01') }),
        ydelseRow('r3', { fraDato: iso('2026-03-01') }),
      ], []);
      expect(resolveAutofillSuggestion(model, 'tom', YDELSE_COL.fraDato)).toBeNull();
    });
  });

  describe('datokolonner (Offentlige ydelser)', () => {
    it('fortsætter en månedsserie i både fra- og til-dato', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01'), tilDato: iso('2026-01-31') }),
        ydelseRow('r2', { fraDato: iso('2026-02-01'), tilDato: iso('2026-02-28') }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)).toEqual({
        displayText: '01-03-2026',
        rawText: '01-03-2026',
      });
      // Til-datoen er sidste dag i måneden og skal derfor vokse til 31 – ikke til 28-03.
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.tilDato)?.displayText).toBe('31-03-2026');
    });

    it('fortsætter en ugeserie og krydser årsskiftet', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-12-15'), tilDato: iso('2025-12-21') }),
        ydelseRow('r2', { fraDato: iso('2025-12-22'), tilDato: iso('2025-12-28') }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)?.displayText).toBe('29-12-2025');
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.tilDato)?.displayText).toBe('04-01-2026');
    });

    it('danner mønster på tværs af en række, der kun er delvist udfyldt', () => {
      // Rækken i midten har INGEN fra-dato. Kravet er, at den springes over, og at mønstret dannes af
      // de øvrige – ikke at hele kolonnen mister sin autofill.
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01') }),
        ydelseRow('r2', { tilDato: iso('2026-02-28') }),
        ydelseRow('r3', { fraDato: iso('2026-02-01') }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)?.displayText).toBe('01-03-2026');
    });

    it('foreslår december efter januar-juni og august-november', () => {
      const rows = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11].map((month) => ydelseRow(`r${String(month)}`, {
        fraDato: iso(`2026-${String(month).padStart(2, '0')}-01`),
      }));
      const model = ydelserModel(rows);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)?.displayText).toBe('01-12-2026');
    });
  });

  describe('beløbskolonner og årsskifte-gaten', () => {
    it('gentager et uændret beløb inden for samme kalenderår', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01'), ydelse: amount(3100), tillaeg: amount(100) }),
        ydelseRow('r2', { fraDato: iso('2026-02-01'), ydelse: amount(3100), tillaeg: amount(100) }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)).toEqual({
        displayText: '3.100,00',
        rawText: '3100,00',
      });
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.tillaeg)?.displayText).toBe('100,00');
    });

    it('standser beløbet, når den FORESLÅEDE startdato falder i et nyt kalenderår', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-11-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { fraDato: iso('2025-12-01'), ydelse: amount(3100) }),
      ]);
      // Datoen fortsætter over årsskiftet …
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)?.displayText).toBe('01-01-2026');
      // … men beløbet gør ikke.
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)).toBeNull();
    });

    it('standser beløbet, når brugeren SELV har indtastet en startdato i et nyt kalenderår', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-06-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { fraDato: iso('2025-07-01'), ydelse: amount(3100) }),
        ydelseRow('r3', { fraDato: iso('2026-03-01') }),
      ], []);
      expect(resolveAutofillSuggestion(model, 'r3', YDELSE_COL.ydelse)).toBeNull();
    });

    it('gentager beløbet, når brugerens egen startdato ligger i SAMME kalenderår', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-06-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { fraDato: iso('2025-07-01'), ydelse: amount(3100) }),
        ydelseRow('r3', { fraDato: iso('2025-09-01') }),
      ], []);
      expect(resolveAutofillSuggestion(model, 'r3', YDELSE_COL.ydelse)?.displayText).toBe('3.100,00');
    });

    it('gentager beløbet, når der slet ikke findes en periodestart at måle årsskiftet på', () => {
      const model = ydelserModel([
        ydelseRow('r1', { ydelse: amount(3100) }),
        ydelseRow('r2', { ydelse: amount(3100) }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)?.displayText).toBe('3.100,00');
    });

    it('foreslår intet beløb, når de to seneste beløb er forskellige', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { fraDato: iso('2026-02-01'), ydelse: amount(3200) }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)).toBeNull();
    });
  });

  describe('ydelsestype-dropdownen', () => {
    it('gentager kun et gyldigt og aktuelt valgbart ydelsestypevalg', () => {
      const model = ydelserModel([
        ydelseRow('r1', { ydelsestype: 'dagpenge' }),
        ydelseRow('r2', { ydelsestype: 'dagpenge' }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelsestype)).toEqual({
        displayText: 'Dagpenge',
        rawText: 'dagpenge',
      });

      // Et midlertidigt deaktiveret valg er ikke acceptabelt som ghost, selv om en ældre række bærer det.
      const disabled = buildOffentligeYdelserAutofillModel(
        ['r1', 'r2', 'ny'],
        new Map([
          ['r1', ydelseRow('r1', { ydelsestype: 'midlertidigt_eet' })],
          ['r2', ydelseRow('r2', { ydelsestype: 'midlertidigt_eet' })],
        ]),
        ['dagpenge'],
      );
      expect(resolveAutofillSuggestion(disabled, 'ny', YDELSE_COL.ydelsestype)).toBeNull();
    });
  });

  describe('løntabellen – måned og år som ét par', () => {
    it('foreslår januar og det NYE år efter december', () => {
      const model = loenModel([
        loenRow('r1', { col0_maaned: '11', col1_maaned: '2025' }),
        loenRow('r2', { col0_maaned: '12', col1_maaned: '2025' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)).toEqual({
        displayText: '1',
        rawText: '1',
      });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)).toEqual({
        displayText: '2026',
        rawText: '2026',
      });
    });

    it('lader en allerede indtastet måned bestemme det foreslåede årstal', () => {
      const model = loenModel([
        loenRow('r1', { col0_maaned: '11', col1_maaned: '2025' }),
        loenRow('r2', { col0_maaned: '12', col1_maaned: '2025' }),
        loenRow('r3', { col0_maaned: '3' }),
      ], { loenperiode: 'maaned', trailingRowIds: [] });
      expect(resolveAutofillSuggestion(model, 'r3', LOEN_COL.period1)?.displayText).toBe('2026');
    });

    it('wrapper måneden modulært, når årskolonnen står tom', () => {
      const model = loenModel([
        loenRow('r1', { col0_maaned: '11' }),
        loenRow('r2', { col0_maaned: '12' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('1');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)).toBeNull();
    });

    it('standser lønbeløbet ved årsskiftet, men foreslår stadig måned og år', () => {
      const model = loenModel([
        loenRow('r1', { col0_maaned: '11', col1_maaned: '2025', col2: amount(30000) }),
        loenRow('r2', { col0_maaned: '12', col1_maaned: '2025', col2: amount(30000) }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('1');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.col2)).toBeNull();
    });

    it('gentager lønbeløbet inden for samme kalenderår', () => {
      const model = loenModel([
        loenRow('r1', { col0_maaned: '1', col1_maaned: '2026', col2: amount(30000) }),
        loenRow('r2', { col0_maaned: '2', col1_maaned: '2026', col2: amount(30000) }),
      ], { loenperiode: 'maaned' });
      const suggestion = resolveAutofillSuggestion(model, 'ny', LOEN_COL.col2);
      expect(suggestion?.displayText).toBe('30.000,00');
      // Ghosten vises med tusindtalsseparator, men den rå accepttekst må ikke have punktum: beløbsfeltets
      // tegnværn afviser punktummer, og ellers forsvinder netop store, ens lønbeløb fra UI'et.
      expect(suggestion?.rawText).toBe('30000,00');
      expect(isAmountExpressionDraftAllowed(suggestion?.rawText ?? '', {
        allowNegative: true,
        maxDecimalDigits: 2,
        maxIntegerDigits: 7,
      })).toBe(true);
    });

    it('holder tillægsbeløbene uden for modellen i Procent-tilstand', () => {
      const rows = [
        loenRow('r1', { col0_maaned: '1', col1_maaned: '2026', fpFvShSoBeloeb: amount(500) }),
        loenRow('r2', { col0_maaned: '2', col1_maaned: '2026', fpFvShSoBeloeb: amount(500) }),
      ];
      expect(resolveAutofillSuggestion(loenModel(rows, { loenperiode: 'maaned' }), 'ny', 6)).toBeNull();
      expect(
        resolveAutofillSuggestion(loenModel(rows, { loenperiode: 'maaned', beloebMode: true }), 'ny', 6)?.displayText
      ).toBe('500,00');
    });
  });

  describe('løntabellen – uge og dag', () => {
    it('fortsætter to selvstændige ugeserier hen over årsskiftet', () => {
      const model = loenModel([
        loenRow('r1', { col0_uge: '50/2025', col1_uge: '51/2025' }),
        loenRow('r2', { col0_uge: '52/2025', col1_uge: '01/2026' }),
      ], { loenperiode: 'uge' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('02/2026');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)?.displayText).toBe('03/2026');
    });

    it('fortsætter et to-ugers interval', () => {
      const model = loenModel([
        loenRow('r1', { col0_uge: '01/2026', col1_uge: '02/2026' }),
        loenRow('r2', { col0_uge: '03/2026', col1_uge: '04/2026' }),
      ], { loenperiode: 'uge' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('05/2026');
    });

    it('standser lønbeløbet, når den foreslåede fra-uge ligger i et nyt kalenderår', () => {
      const model = loenModel([
        loenRow('r1', { col0_uge: '50/2025', col1_uge: '50/2025', col2: amount(7000) }),
        loenRow('r2', { col0_uge: '51/2025', col1_uge: '51/2025', col2: amount(7000) }),
      ], { loenperiode: 'uge' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('52/2025');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.col2)?.displayText).toBe('7.000,00');

      const acrossNewYear = loenModel([
        loenRow('r1', { col0_uge: '51/2025', col1_uge: '51/2025', col2: amount(7000) }),
        loenRow('r2', { col0_uge: '52/2025', col1_uge: '52/2025', col2: amount(7000) }),
      ], { loenperiode: 'uge' });
      expect(resolveAutofillSuggestion(acrossNewYear, 'ny', LOEN_COL.period0)?.displayText).toBe('01/2026');
      expect(resolveAutofillSuggestion(acrossNewYear, 'ny', LOEN_COL.col2)).toBeNull();
    });

    it('fortsætter dagsserier med både uge- og månedsintervaller', () => {
      const weekly = loenModel([
        loenRow('r1', { col0_dag: iso('2026-01-05'), col1_dag: iso('2026-01-11') }),
        loenRow('r2', { col0_dag: iso('2026-01-12'), col1_dag: iso('2026-01-18') }),
      ], { loenperiode: 'dag' });
      expect(resolveAutofillSuggestion(weekly, 'ny', LOEN_COL.period0)?.displayText).toBe('19-01-2026');

      const monthly = loenModel([
        loenRow('r1', { col0_dag: iso('2026-01-01'), col1_dag: iso('2026-01-31') }),
        loenRow('r2', { col0_dag: iso('2026-02-01'), col1_dag: iso('2026-02-28') }),
      ], { loenperiode: 'dag' });
      expect(resolveAutofillSuggestion(monthly, 'ny', LOEN_COL.period1)?.displayText).toBe('31-03-2026');
    });
  });
  describe('regressioner fra reviewet', () => {
    it('standser beløbet, selv om rækken MED beløbet ikke selv har en periodestart', () => {
      // Referenceåret skal læses i den seneste række med en PERIODESTART, ikke i den seneste række med
      // et beløb. Ellers gjorde en delvist udfyldt række referenceåret ukendt, og gaten åbnede.
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-11-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { ydelse: amount(3100) }),
        ydelseRow('r3', { fraDato: iso('2026-05-01') }),
      ], []);
      expect(resolveAutofillSuggestion(model, 'r3', YDELSE_COL.ydelse)).toBeNull();
    });

    it('gentager beløbet, når den samme delvise række ligger inden for året', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-06-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { ydelse: amount(3100) }),
        ydelseRow('r3', { fraDato: iso('2025-09-01') }),
      ], []);
      expect(resolveAutofillSuggestion(model, 'r3', YDELSE_COL.ydelse)?.displayText).toBe('3.100,00');
    });

    it('holder måneds- og årsforslaget enige i en FALDENDE serie', () => {
      // Faldende visningsorden er ét klik på kolonneoverskriften væk. Månedsforslaget er 9, og
      // årsforslaget skal da blive 2025 – både uden og med den indtastede måned i rækken.
      const rows = [
        loenRow('r1', { col0_maaned: '12', col1_maaned: '2025' }),
        loenRow('r2', { col0_maaned: '11', col1_maaned: '2025' }),
        loenRow('r3', { col0_maaned: '10', col1_maaned: '2025' }),
      ];
      const model = loenModel(rows, { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('9');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)?.displayText).toBe('2025');

      const afterMonthAccepted = loenModel(
        [...rows, loenRow('r4', { col0_maaned: '9' })],
        { loenperiode: 'maaned', trailingRowIds: [] }
      );
      expect(resolveAutofillSuggestion(afterMonthAccepted, 'r4', LOEN_COL.period1)?.displayText)
        .toBe('2025');
    });

    it('afviser en ugeprøve, feltets egen parse aldrig kunne have accepteret', () => {
      // Ugefelternes canonical type er en almindelig streng, og et tolerant `.eo`-load bevarer en
      // historisk værdi. Uden en streng afkodning blev `1/999999` en ugyldig kalenderdato, og
      // ghost-teksten kom ud som «NaN/NaN».
      for (const historisk of ['1/999999', '1e5/2026', '01-2026', '53/2025']) {
        const model = loenModel([
          loenRow('r1', { col0_uge: '01/2026' }),
          loenRow('r2', { col0_uge: '02/2026' }),
          loenRow('r3', { col0_uge: historisk }),
        ], { loenperiode: 'uge' });
        const suggestion = resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0);
        // Den ugyldige række springes over, så mønstret 01 → 02 fortsætter til uge 03.
        expect(suggestion?.displayText).toBe('03/2026');
      }
    });

    it('afviser en måneds- eller årsprøve uden for feltets form', () => {
      // `202` (tre cifre) og `13` er canonical-mulige med rød ring, men er ikke prøver.
      const model = loenModel([
        loenRow('r1', { col0_maaned: '1', col1_maaned: '2026' }),
        loenRow('r2', { col0_maaned: '2', col1_maaned: '2026' }),
        loenRow('r3', { col0_maaned: '13', col1_maaned: '202' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('3');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)?.displayText).toBe('2026');
    });
  });
});
