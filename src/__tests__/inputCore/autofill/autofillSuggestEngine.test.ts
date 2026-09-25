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

// De committede rækker i en fixture bærer per konstruktion afsluttet input; de trailing id'er er tomme
// indtastningsrækker. `rowsWithInput` sættes derfor af rækkelisten, præcis som tabellens
// `rowsWithSettledInput` gør i produktionen.
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
    it('starter næste sammenhængende fireugersperiode efter seneste til-dato', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-04-01'), tilDato: iso('2026-04-26') }),
        ydelseRow('r2', { fraDato: iso('2026-04-27'), tilDato: iso('2026-05-24') }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)?.displayText).toBe('25-05-2026');
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.tilDato)?.displayText).toBe('21-06-2026');
    });

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

    it('giver intet forslag, hvis en af de to foregående fra-datoceller mangler', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01') }),
        ydelseRow('r2', { tilDato: iso('2026-02-28') }),
        ydelseRow('r3', { fraDato: iso('2026-02-01') }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)).toBeNull();
    });

    it('foreslår december efter januar-juni og august-november', () => {
      const rows = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11].map((month) => ydelseRow(`r${String(month)}`, {
        fraDato: iso(`2026-${String(month).padStart(2, '0')}-01`),
      }));
      const model = ydelserModel(rows);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)?.displayText).toBe('01-12-2026');
    });
  });

  describe('beløbskolonner kræver to ens værdier og en passende periode', () => {
    it('foreslår beløbet, når de to foregående værdier er ens', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01'), tilDato: iso('2026-01-31'), ydelse: amount(3100), tillaeg: amount(100) }),
        ydelseRow('r2', { fraDato: iso('2026-02-01'), tilDato: iso('2026-02-28'), ydelse: amount(3100), tillaeg: amount(100) }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)).toEqual({
        displayText: '3.100,00',
        rawText: '3100,00',
      });
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.tillaeg)?.displayText).toBe('100,00');
    });

    it('foreslår intet, når de to beløb ikke er ens uden en forventelig lønændringsgrænse', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { fraDato: iso('2026-02-01'), ydelse: amount(3200) }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)).toBeNull();
    });

    it('kræver to beløbsceller over målet', () => {
      const model = ydelserModel([ydelseRow('r1', { ydelse: amount(3100) })]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)).toBeNull();
    });

    it('bruger seneste beløb ved grænsen mellem december og januar', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-11-01'), tilDato: iso('2025-11-30'), ydelse: amount(3100) }),
        ydelseRow('r2', { fraDato: iso('2025-12-01'), tilDato: iso('2025-12-31'), ydelse: amount(3200) }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.fraDato)?.displayText).toBe('01-01-2026');
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)?.displayText).toBe('3.200,00');
    });

    it('foreslår ikke et gentaget beløb for en længere indtjeningsperiode', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-04-01'), tilDato: iso('2026-04-26'), ydelse: amount(19323) }),
        ydelseRow('r2', { fraDato: iso('2026-04-27'), tilDato: iso('2026-05-24'), ydelse: amount(19323) }),
        ydelseRow('r3', { fraDato: iso('2026-05-25'), tilDato: iso('2026-06-21'), ydelse: amount(19323) }),
        ydelseRow('r4', { fraDato: iso('2026-06-22'), tilDato: iso('2026-07-26') }),
      ], []);
      expect(resolveAutofillSuggestion(model, 'r4', YDELSE_COL.ydelse)).toBeNull();

      // Et længere femugersmønster i den ene prøverække må heller ikke få et mellemlangt mål til at gå fri.
      const mixedLengths = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-04-01'), tilDato: iso('2026-04-26'), ydelse: amount(19323) }),
        ydelseRow('r2', { fraDato: iso('2026-04-27'), tilDato: iso('2026-05-31'), ydelse: amount(19323) }),
        ydelseRow('r3', { fraDato: iso('2026-06-01'), tilDato: iso('2026-06-28'), ydelse: amount(19323) }),
        ydelseRow('r4', { fraDato: iso('2026-06-29'), tilDato: iso('2026-07-30') }),
      ], []);
      expect(resolveAutofillSuggestion(mixedLengths, 'r4', YDELSE_COL.ydelse)).toBeNull();
    });

    it('bruger seneste beløb ved grænsen til 1. marts, også i skudår', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2024-02-01'), tilDato: iso('2024-02-28'), ydelse: amount(3000) }),
        ydelseRow('r2', { fraDato: iso('2024-02-29'), tilDato: iso('2024-03-31'), ydelse: amount(3150) }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)?.displayText).toBe('3.150,00');

      const nonLeapYear = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-02-01'), tilDato: iso('2025-02-27'), ydelse: amount(3000) }),
        ydelseRow('r2', { fraDato: iso('2025-02-28'), tilDato: iso('2025-02-28'), ydelse: amount(3150) }),
        ydelseRow('r3', { fraDato: iso('2025-03-01'), tilDato: iso('2025-03-31') }),
      ], []);
      expect(resolveAutofillSuggestion(nonLeapYear, 'r3', YDELSE_COL.ydelse)?.displayText).toBe('3.150,00');
    });

    it('foreslår INTET beløb, når cellen ovenover er tom', () => {
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2026-01-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { fraDato: iso('2026-02-01') }),
      ]);
      expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)).toBeNull();
      // Én værdi over er ikke nok til at vise et sikkert forslag.
      expect(resolveAutofillSuggestion(model, 'r2', YDELSE_COL.ydelse)).toBeNull();
    });

    it('afviser et beløb, der ikke kan repræsenteres canonical', () => {
      // Kontrollen hører i kolonnebyggeren, hvor prøven dannes: en beløbskolonne har intet mønster at
      // forkaste en urimelig værdi i, og et tolerant load kan bære et tal, feltet aldrig ville tage imod.
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1e20, 0.001]) {
        const model = ydelserModel([
          ydelseRow('r1', { ydelse: amount(3100) }),
          ydelseRow('r2', { ydelse: amount(bad) }),
        ]);
        expect(resolveAutofillSuggestion(model, 'ny', YDELSE_COL.ydelse)).toBeNull();
      }
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

    it('foreslår måned, år OG lønbeløb hen over årsskiftet', () => {
      // Alle tre kolonner har en udfyldt celle ovenover, så alle tre har en ghost. Beløbet standsede
      // tidligere ved årsskiftet; reglen er væk, fordi den gjorde ghostens tilstedeværelse uforudsigelig.
      const model = loenModel([
        loenRow('r1', { col0_maaned: '11', col1_maaned: '2025', col2: amount(30000) }),
        loenRow('r2', { col0_maaned: '12', col1_maaned: '2025', col2: amount(30000) }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('1');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)?.displayText).toBe('2026');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.col2)?.displayText).toBe('30.000,00');
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

  describe('kun den FØRSTE tomme række under serien (review 2026-09-07)', () => {
    it('viser forslaget i rækken lige under serien, men ikke i rækkerne længere nede', () => {
      // Udvikleren observerede en ghost «to linjer under den seneste udfyldte celle». Årsagen var, at
      // `collectAbove` springer tomme rækker over – rigtigt for et hul MIDT i serien, forkert for
      // afstanden ned til dens ende, hvor der ikke længere er en serie at fortsætte.
      const model = loenModel([
        loenRow('r1', { col0_maaned: '1', col1_maaned: '2026' }),
        loenRow('r2', { col0_maaned: '2', col1_maaned: '2026' }),
        loenRow('r3', { col0_maaned: '3', col1_maaned: '2026' }),
      ], { loenperiode: 'maaned', trailingRowIds: ['tom1', 'tom2', 'tom3'] });
      expect(resolveAutofillSuggestion(model, 'tom1', LOEN_COL.period0)?.displayText).toBe('4');
      expect(resolveAutofillSuggestion(model, 'tom1', LOEN_COL.period1)?.displayText).toBe('2026');
      expect(resolveAutofillSuggestion(model, 'tom2', LOEN_COL.period0)).toBeNull();
      expect(resolveAutofillSuggestion(model, 'tom2', LOEN_COL.period1)).toBeNull();
      expect(resolveAutofillSuggestion(model, 'tom3', LOEN_COL.period0)).toBeNull();
    });

    it('måler reglen på CELLEN og ikke på rækken', () => {
      // r3 har periode, men beløbscellen er tom. Rækken er udfyldt – og netop derfor målte en RÆKKEprøve
      // forkert: den lod beløbskolonnen foreslå i «ny», to celler under det seneste beløb. Med
      // celleprøven har periodekolonnen en ghost i «ny» (cellen over er udfyldt), mens beløbskolonnen
      // ikke har (cellen over er tom) – og beløbet tilbydes i stedet i r3, hvor det hører.
      const model = loenModel([
        loenRow('r1', { col0_maaned: '1', col1_maaned: '2026', col2: amount(30000) }),
        loenRow('r2', { col0_maaned: '2', col1_maaned: '2026', col2: amount(30000) }),
        loenRow('r3', { col0_maaned: '3', col1_maaned: '2026' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)?.displayText).toBe('4');
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.col2)).toBeNull();
      expect(resolveAutofillSuggestion(model, 'r3', LOEN_COL.col2)?.displayText).toBe('30.000,00');
    });

    it('foreslår intet under en celle, hvis værdi ikke kan bruges', () => {
      // r3 har måned 13. Cellen ER udfyldt, men den bærer ingen brugbar prøve, og der findes derfor
      // ingen værdi at fortsætte fra. En ghost dér ville foreslå 3 – tallet efter r2 – i rækken under en
      // celle, hvor der står 13, altså et forslag der hverken passer til cellen over eller til serien.
      // Årskolonnen i samme række er uberørt: dens celle ovenover er en gyldig 2026.
      const model = loenModel([
        loenRow('r1', { col0_maaned: '1', col1_maaned: '2026' }),
        loenRow('r2', { col0_maaned: '2', col1_maaned: '2026' }),
        loenRow('r3', { col0_maaned: '13', col1_maaned: '2026' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)).toBeNull();
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)).toBeNull();
    });

    it('viser forslaget i et hul MIDT i serien og i den første tomme række efter den', () => {
      const model = buildStandardLoenAutofillModel({
        rowIds: ['r1', 'r2', 'hul', 'r4', 'ny'],
        committedById: new Map([
          ['r1', loenRow('r1', { col0_maaned: '1', col1_maaned: '2026' })],
          ['r2', loenRow('r2', { col0_maaned: '2', col1_maaned: '2026' })],
          ['hul', loenRow('hul', {})],
          ['r4', loenRow('r4', { col0_maaned: '4', col1_maaned: '2026' })],
        ]),
        fieldSet,
        loenperiode: 'maaned',
        beloebMode: false,
      });
      // Hullet står lige under r2 og bærer derfor mønstrets næste værdi.
      expect(resolveAutofillSuggestion(model, 'hul', LOEN_COL.period0)?.displayText).toBe('3');
      // «ny» står under et hul og mangler dermed to sammenhængende rækker til et sikkert mønster.
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)).toBeNull();
    });

    it('giver intet forslag i en helt tom tabel', () => {
      const model = loenModel([], { loenperiode: 'maaned', trailingRowIds: ['t1', 't2'] });
      expect(resolveAutofillSuggestion(model, 't1', LOEN_COL.period0)).toBeNull();
      expect(resolveAutofillSuggestion(model, 't2', LOEN_COL.period0)).toBeNull();
    });
  });

  describe('årskolonnen kræver en sammenhængende måned/år-serie', () => {
    it('foreslår ikke et årstal uden to kendte måned/år-par', () => {
      const sameYear = loenModel([
        loenRow('r1', { col1_maaned: '2026' }),
        loenRow('r2', { col1_maaned: '2026' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(sameYear, 'ny', LOEN_COL.period1)).toBeNull();

      // To årstal uden måneder fortæller ikke, hvilken periode det næste årstal skal følge.
      const rising = loenModel([
        loenRow('r1', { col1_maaned: '2025' }),
        loenRow('r2', { col1_maaned: '2026' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(rising, 'ny', LOEN_COL.period1)).toBeNull();
    });

    it('foreslår intet årstal, når de to foregående måneder ikke danner en serie', () => {
      const model = loenModel([
        loenRow('r1', { col0_maaned: '1', col1_maaned: '2026' }),
        loenRow('r2', { col0_maaned: '1', col1_maaned: '2026' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)).toBeNull();
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)).toBeNull();
    });

    it('lader måned/år-serien vinde over gentagelsen, hvor den findes', () => {
      // Faldbacket må ikke overtage en fungerende serie: efter 12/2025 er årstallet 2026, ikke 2025.
      const model = loenModel([
        loenRow('r1', { col0_maaned: '11', col1_maaned: '2025' }),
        loenRow('r2', { col0_maaned: '12', col1_maaned: '2025' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)?.displayText).toBe('2026');
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

    it('foreslår ikke beløb, når periodeintervallet er længere end de to beløbsprøver', () => {
      const model = loenModel([
        loenRow('r1', { col0_uge: '50/2025', col1_uge: '50/2025', col2: amount(7000) }),
        loenRow('r2', { col0_uge: '51/2025', col1_uge: '51/2025', col2: amount(7000) }),
        loenRow('r3', { col0_uge: '52/2025', col1_uge: '04/2026' }),
      ], { loenperiode: 'uge', trailingRowIds: [] });
      expect(resolveAutofillSuggestion(model, 'r3', LOEN_COL.col2)).toBeNull();

      const acrossNewYear = loenModel([
        loenRow('r1', { col0_uge: '51/2025', col1_uge: '51/2025', col2: amount(7000) }),
        loenRow('r2', { col0_uge: '52/2025', col1_uge: '52/2025', col2: amount(7000) }),
      ], { loenperiode: 'uge' });
      expect(resolveAutofillSuggestion(acrossNewYear, 'ny', LOEN_COL.period0)?.displayText).toBe('01/2026');
      // To ens beløb fortsætter over årsskiftet, når målrækkens periode endnu ikke er angivet.
      expect(resolveAutofillSuggestion(acrossNewYear, 'ny', LOEN_COL.col2)?.displayText).toBe('7.000,00');
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
    it('gentager beløbet uafhængigt af, hvad periodekolonnen gør i rækken', () => {
      // En delvist udfyldt række (beløb, men ingen periodestart) forstyrrer intet: beløbskolonnen ser kun
      // sin egen celle ovenover. Det var netop denne rækkeform, den tidligere årsskifte-gate læste
      // forkert – den gjorde referenceåret ukendt og åbnede gaten, mens en anden rækkeform lukkede den.
      const model = ydelserModel([
        ydelseRow('r1', { fraDato: iso('2025-11-01'), ydelse: amount(3100) }),
        ydelseRow('r2', { ydelse: amount(3100) }),
        ydelseRow('r3', { fraDato: iso('2026-05-01') }),
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
      // Den ugyldige værdi står MIDT i serien, så synlighedsreglen (cellen ovenover skal være udfyldt)
      // er opfyldt og testen måler det, den skal: at prøven forkastes frem for at forplante sig.
      for (const historisk of ['1/999999', '1e5/2026', '01-2026', '53/2025']) {
        const model = loenModel([
          loenRow('r1', { col0_uge: '01/2026' }),
          loenRow('r2', { col0_uge: historisk }),
          loenRow('r3', { col0_uge: '02/2026' }),
        ], { loenperiode: 'uge' });
        const suggestion = resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0);
        // En ugyldig celle umiddelbart over målet kan ikke indgå i de to rækkers mønster.
        expect(suggestion).toBeNull();
      }
    });

    it('afviser en måneds- eller årsprøve uden for feltets form', () => {
      // `202` (tre cifre) og `13` er canonical-mulige med rød ring, men er ikke prøver. Rækken står MIDT
      // i serien, så synlighedsreglen er opfyldt, og det målte er prøvens forkastelse.
      const model = loenModel([
        loenRow('r1', { col0_maaned: '1', col1_maaned: '2026' }),
        loenRow('r2', { col0_maaned: '13', col1_maaned: '202' }),
        loenRow('r3', { col0_maaned: '2', col1_maaned: '2026' }),
      ], { loenperiode: 'maaned' });
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period0)).toBeNull();
      expect(resolveAutofillSuggestion(model, 'ny', LOEN_COL.period1)).toBeNull();
    });
  });
});
