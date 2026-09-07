import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';
import { isoWeeksInYear } from '../../utils/dateUtils';
import { DEFAULT_AMOUNT_PRECISION } from '../../utils/amountInputUtils';
import { isSafeCanonicalDecimal } from '../../utils/numericSafety';
import { MAX_REPRESENTABLE_YEAR, MIN_REPRESENTABLE_YEAR } from './autofillSeries';
import type { FieldCodec } from '../fieldCodec';
import type { FieldDescriptor } from '../fieldDescriptor';
import type { AutofillColumn, AutofillSampleValue, AutofillSuggestion } from './autofillSuggestModel';

// Autofill-suggest, lag 3 (typede kolonnebyggere). Her – og kun her – er en kolonnes VÆRDITYPE stadig
// kendt: byggeren får feltets descriptor og de canonical værdier, tabellen har læst, og lukker begge veje
// (prøve ud, forslag ind) inde i den færdige `AutofillColumn`. Derefter er modellen type-udslettet, og
// hverken contexten eller celle-komponenten behøver kende tabellens rækketype.
//
// Formateringen går ALTID gennem feltets eget codec. Ghost-teksten er derfor per konstruktion identisk med
// det, cellen vil vise efter accept, og råteksten er den form, brugeren selv ville have tastet. Et
// autofill-forslag kan dermed ikke vise en værdi, feltets egen parse ikke kan læse tilbage.

/**
 * Forslaget fra en canonical værdi, gennem feltets codec.
 *
 * En værdi, der formaterer til tom tekst, giver INTET forslag: en tom ghost er ikke et forslag, og et
 * accept af den ville rydde cellen – stik imod at Enter kun må skrive det, brugeren kan se.
 */
const suggestionFromCodec = <T>(codec: FieldCodec<T>, value: T): AutofillSuggestion | null => {
  const displayText = codec.format(value);
  const rawText = codec.formatForEdit(value);
  if (displayText.trim() === '' || rawText.trim() === '') return null;
  return Object.freeze({ displayText, rawText });
};

/** Datokolonne (fra-/til-dato, løntabellens dagskolonner). */
export const dateAutofillColumn = (
  colIndex: number,
  descriptor: FieldDescriptor<ISODateString | undefined>,
  values: readonly (ISODateString | undefined)[]
): AutofillColumn => Object.freeze({
  colIndex,
  kind: 'date' as const,
  samples: Object.freeze(values.map((value): AutofillSampleValue | undefined =>
    value === undefined || value === '' ? undefined : { kind: 'date', iso: value })),
  format: (value) => (value.kind === 'date' ? suggestionFromCodec(descriptor.codec, value.iso) : null),
});

/**
 * Ugekolonne. Den canonical form er «UU/ÅÅÅÅ»; prøven afkodes til tal, så mønstret kan regnes på uger og
 * ikke på tekst.
 *
 * Afkodningen er STRENG, og det er ikke overforsigtighed. Ugefelternes canonical type er en almindelig
 * streng (`allowEmptyString`), og et tolerant `.eo`-load bevarer en historisk streng, indtil brugeren
 * settler feltet igen (se `createStringBackedFieldCodec`). Prøven kan derfor møde tekst, som feltets
 * egen parse aldrig ville have accepteret. `parseInt` ville læse `1e5/2026` som uge 1, og et
 * fircifret-plus årstal ville give en ugyldig kalenderdato, der forplantede sig som `NaN` hele vejen ud
 * i ghost-teksten. Derfor: eksakt cifferform, årstal inden for det repræsenterbare domæne, og et
 * ugenummer der faktisk FINDES i det ISO-år.
 */
export const weekAutofillColumn = (
  colIndex: number,
  descriptor: FieldDescriptor<string | undefined>,
  values: readonly (string | undefined)[]
): AutofillColumn => Object.freeze({
  colIndex,
  kind: 'week' as const,
  samples: Object.freeze(values.map((value): AutofillSampleValue | undefined => {
    const parts = (value ?? '').trim().split('/');
    if (parts.length !== 2) return undefined;
    const [weekPart = '', yearPart = ''] = parts;
    if (!/^\d{1,2}$/.test(weekPart) || !/^\d{4}$/.test(yearPart)) return undefined;
    const week = Number.parseInt(weekPart, 10);
    const year = Number.parseInt(yearPart, 10);
    if (year < MIN_REPRESENTABLE_YEAR || year > MAX_REPRESENTABLE_YEAR) return undefined;
    if (week < 1 || week > isoWeeksInYear(year)) return undefined;
    return { kind: 'week', week, year };
  })),
  format: (value) => (value.kind === 'week'
    ? suggestionFromCodec(
        descriptor.codec,
        `${String(value.week).padStart(2, '0')}/${String(value.year)}`
      )
    : null),
});

/**
 * Månedskolonne (løntabellens `col0_maaned`), koblet til årskolonnen.
 *
 * Værdien er string-backed – feltet er et heltal 1..12 gemt som tekst – og prøven afkodes derfor til tal.
 */
export const monthOfYearAutofillColumn = (
  colIndex: number,
  descriptor: FieldDescriptor<string | undefined>,
  values: readonly (string | undefined)[],
  yearColIndex: number
): AutofillColumn => Object.freeze({
  colIndex,
  kind: 'monthOfYear' as const,
  linkedColIndex: yearColIndex,
  samples: Object.freeze(values.map((value): AutofillSampleValue | undefined => {
    const raw = (value ?? '').trim();
    if (!/^\d{1,2}$/.test(raw)) return undefined;
    const month = Number.parseInt(raw, 10);
    return month >= 1 && month <= 12 ? { kind: 'monthOfYear', month } : undefined;
  })),
  format: (value) => (value.kind === 'monthOfYear'
    ? suggestionFromCodec(descriptor.codec, String(value.month))
    : null),
});

/** Årskolonne (løntabellens `col1_maaned`), koblet til månedskolonnen. */
export const yearAutofillColumn = (
  colIndex: number,
  descriptor: FieldDescriptor<string | undefined>,
  values: readonly (string | undefined)[],
  monthColIndex: number
): AutofillColumn => Object.freeze({
  colIndex,
  kind: 'year' as const,
  linkedColIndex: monthColIndex,
  samples: Object.freeze(values.map((value): AutofillSampleValue | undefined => {
    const raw = (value ?? '').trim();
    if (!/^\d{4}$/.test(raw)) return undefined;
    const year = Number.parseInt(raw, 10);
    return year >= MIN_REPRESENTABLE_YEAR && year <= MAX_REPRESENTABLE_YEAR
      ? { kind: 'year', year }
      : undefined;
  })),
  format: (value) => (value.kind === 'year'
    ? suggestionFromCodec(descriptor.codec, String(value.year))
    : null),
});

/**
 * Beløbskolonne.
 *
 * Prøven er beløbets TAL, og forslaget er altid et tal-beløb – aldrig det oprindelige udtryk. Et gentaget
 * `5000*2` ville vise `fx`-mærket og invitere til at redigere et udtryk, brugeren ikke selv har skrevet i
 * netop denne celle; tallet er den værdi, forslaget faktisk står for.
 *
 * Prøven kræver et CANONICAL repræsenterbart beløb. Kontrollen hører her, hvor prøven dannes: en
 * beløbskolonne har intet mønster at forkaste en urimelig værdi i (den gentager blot cellen ovenover), og
 * et tolerant `.eo`-load kan bære et tal, feltets egen præcision aldrig ville have accepteret.
 */
export const amountAutofillColumn = (
  colIndex: number,
  descriptor: FieldDescriptor<AmountValue | undefined>,
  values: readonly (AmountValue | undefined)[]
): AutofillColumn => Object.freeze({
  colIndex,
  kind: 'amount' as const,
  samples: Object.freeze(values.map((value): AutofillSampleValue | undefined =>
    value === undefined || !isSafeCanonicalDecimal(value.value, DEFAULT_AMOUNT_PRECISION)
      ? undefined
      : { kind: 'amount', value: value.value })),
  format: (value) => {
    if (value.kind !== 'amount') return null;
    const suggestion = suggestionFromCodec(descriptor.codec, { kind: 'number', value: value.value });
    if (suggestion === null) return null;

    // Beløbsdraften tillader med vilje ikke punktummer (§2.2), mens codecets visningsform bruger dem
    // som tusindtalsseparator. Ghosten skal derfor acceptere som samme tekst, brugeren kan taste: ellers
    // filtrerer celleoverfladen et gyldigt beløbsforslag væk fra fx 30.000,00.
    const rawText = suggestion.rawText.replaceAll('.', '');
    return Object.freeze({ ...suggestion, rawText });
  },
});

/**
 * Dropdown-kolonne med et lukket, kendt katalog. Ukendte eller historiske værdier bliver aldrig prøver:
 * autofill må ikke gøre en gammel værdi, som brugeren ikke længere kan vælge, til et nyt valg.
 */
export const choiceAutofillColumn = (
  colIndex: number,
  descriptor: FieldDescriptor<string | undefined>,
  values: readonly (string | undefined)[],
  labelOf: (value: string) => string | undefined,
  availableValues: readonly string[],
): AutofillColumn => {
  const available = new Set(availableValues);
  return Object.freeze({
    colIndex,
    kind: 'choice' as const,
    samples: Object.freeze(values.map((value): AutofillSampleValue | undefined =>
      value === undefined || !available.has(value) ? undefined : { kind: 'choice', value })),
    format: (value) => {
      if (value.kind !== 'choice' || !available.has(value.value)) return null;
      const displayText = labelOf(value.value);
      if (displayText === undefined || displayText.trim() === '') return null;
      // `rawText` er dropdownens canonical option-værdi, ikke den menneskelige label.
      const rawText = descriptor.codec.formatForEdit(value.value);
      return rawText.trim() === '' ? null : Object.freeze({ displayText, rawText });
    },
  });
};
