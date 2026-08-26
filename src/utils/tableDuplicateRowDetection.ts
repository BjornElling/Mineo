import type { AmountValue } from '../schemas/amountExpressionSchema';
import { isAmountValueStrict } from './tableValidationCommon';

/**
 * Kryds-række-dublet-detektion – ÉN kerne for alle periodetabeller (brugerkrav 2026-08-26).
 *
 * **Reglen.** To rækker i samme tabel, hvis SAMMENLIGNEDE felter alle er ens, er en fejl. Det gælder både
 * periodefelterne (fra/til) og beløbsfelterne. Reglen er bevidst SNÆVER: den rammer kun den ordrette
 * gentagelse, ikke to rækker der blot overlapper i tid.
 *
 * **Hvorfor ikke overlap.** Overlappende perioder er LOVLIGE her – to ansættelsesforhold i samme måned
 * giver to lønbilag for samme periode, og beløbene skal da lægges sammen. Behovet for at kunne lave den
 * beregning uden fejl overstiger risikoen for en gentagen indtastning. Det er en anden regel end
 * `periodOverlapDetection.ts`, som ferie-/TAF-/svie-og-smerte-perioderne bruger, hvor overlap ER en fejl.
 *
 * **Hvorfor "beregnet" beløb og ikke rå tekst.** Beløbsceller er `AmountValue` og kan bære et regneudtryk.
 * `1000+1000` og `2000` er den samme oplysning og skal derfor tælle som ens; det er den beregnede værdi,
 * der er rækkens indhold. Det er samme normalisering, tabellens sortering allerede bruger.
 *
 * **Hvorfor kun den 2., 3., … forekomst flages.** Den første række er den, brugeren skrev først, og den er
 * ikke fejlen – dubletten er. At farve begge ville udpege et vilkårligt offer blandt to ens rækker og gøre
 * det uklart, hvilken der skal rettes. Samme afgrænsning som `validateDuplicateAfgoerelse` i
 * `eetAslAfgoerelser.ts`, der er repoets kanoniske dublet-regel.
 */

/** Normaliseret celleværdi til sammenligning. `null` betyder "tom" – to tomme celler er ens. */
type NormalizedCellValue = string | number | null;

/**
 * Normaliserer én celleværdi til sin SAMMENLIGNELIGE form.
 *
 * Et beløb reduceres til sin beregnede talværdi (så `1000+1000` og `2000` er ens), en streng trimmes, og
 * enhver tom form – `undefined`, `null`, `''`, whitespace, et ikke-endeligt tal – bliver `null`.
 *
 * Bemærk at en eksplicit `0` IKKE er tom her. Det er med vilje: to rækker med samme periode og 0 kr. i
 * begge er ordret den samme oplysning to gange, og 0 er en bevidst indtastning (jf. brugerbeslutningen om,
 * at 0 kr. i en beløbstabel bevares som en oplysning).
 */
export const normalizeCellValueForDuplicateComparison = (value: unknown): NormalizedCellValue => {
  if (value === undefined || value === null) return null;
  if (isAmountValueStrict(value)) {
    return Number.isFinite(value.value) ? value.value : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'boolean') return String(value);
  return null;
};

/** Rækkens sammenligningsnøgle: de normaliserede værdier i fast kolonnerækkefølge. */
const buildRowComparisonKey = (values: readonly NormalizedCellValue[]): string =>
  JSON.stringify(values);

/**
 * En række er TOM, når alle sammenlignede celler er tomme. Tomme rækker flages aldrig som dubletter:
 * tabellerne viser med vilje et par blanke pladsholderrækker, og to blanke rækker er ikke en gentagen
 * indtastning.
 */
const isRowEmpty = (values: readonly NormalizedCellValue[]): boolean =>
  values.every((value) => value === null);

export type DuplicateRowMatch<TRow> = Readonly<{
  /** Rækken, der er en gentagelse (2., 3., … forekomst – aldrig den første). */
  row: TRow;
  /** Den tidligere række, den er identisk med. */
  duplicateOf: TRow;
}>;

/**
 * Finder de rækker, der ordret gentager en tidligere række.
 *
 * `getComparableValues` leverer de celler, der indgår i sammenligningen – kun de RELEVANTE for den aktuelle
 * tilstand (fx kun den valgte lønperiodes to kolonner, og kun tillægsbeløbene i Beløb-tilstand). En skjult
 * eller irrelevant celle må ikke afgøre, om to synligt ens rækker er dubletter.
 *
 * Rækkefølgen er den afsluttede rækkefølge: `rows[0]` er den første forekomst.
 */
export const findDuplicateRows = <TRow>(
  rows: readonly TRow[],
  getComparableValues: (row: TRow) => readonly unknown[]
): readonly DuplicateRowMatch<TRow>[] => {
  const firstOccurrenceByKey = new Map<string, TRow>();
  const matches: DuplicateRowMatch<TRow>[] = [];

  for (const row of rows) {
    const values = getComparableValues(row).map(normalizeCellValueForDuplicateComparison);
    if (isRowEmpty(values)) continue;

    const key = buildRowComparisonKey(values);
    const firstOccurrence = firstOccurrenceByKey.get(key);
    if (firstOccurrence === undefined) {
      firstOccurrenceByKey.set(key, row);
      continue;
    }
    matches.push(Object.freeze({ row, duplicateOf: firstOccurrence }));
  }

  return Object.freeze(matches);
};

/**
 * Fejlteksten. ÉN ordlyd for alle tabeller, så reglen læses ens uanset hvilken tabel brugeren står i.
 *
 * Teksten siger både HVAD der er galt og HVAD udvejen er, fordi den vises som tooltip på et `rule`-issue,
 * hvor den fulde besked er det, brugeren får at se.
 */
export const DUPLICATE_ROW_MESSAGE =
  'Rækken er identisk med en tidligere række. Ret den, eller slet den ene af de to.';

export type { NormalizedCellValue };

/** Genanvendt af tabeller, hvis beløbsceller er `AmountValue`. */
export type ComparableAmount = AmountValue | undefined;
