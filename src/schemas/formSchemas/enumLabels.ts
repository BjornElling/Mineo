import {
  loenperiodeEnum,
  svieSmerteDelvisSygemeldingSatsEnum,
  type Loenperiode,
  type SvieSmerteDelvisSygemeldingSats,
} from './enumSchemas';

/**
 * Brugervendte etiketter for de enums, hvis værdier IKKE selv er dansk visningstekst.
 *
 * `enumSchemas.ts` er ét sandt sted for enum-VÆRDIERNE, men etiketterne havde intet hjem, og
 * derfor stod de samme tre-fire strenge skrevet i hånden på hver flade der viste enummet —
 * inklusive i dokument-/rækkeevaluerings-laget, hvor teksten ender i et bilag. To flader
 * kunne dermed kalde samme værdi noget forskelligt uden at nogen test kunne se det.
 *
 * Etiketterne er derfor her, ved enummet selv, som fuldt dækkende `Record`s: en ny
 * enum-værdi bliver en typefejl frem for en manglende etiket. Formen er bevidst et `Record`
 * og ikke en `switch`- eller ternær-funktion — en ternær «`=== 'fuld' ? … : …`» giver tavst
 * den forkerte etiket, hvis enummet får et tredje medlem.
 *
 * **Uden for scope:** de enums hvis værdier ALLEREDE er dansk visningstekst
 * (`loenPaaHelligdageEnum`, `afsluttesMedEnum` m.fl.). De renderes direkte, og en
 * identitets-etiket-tabel for dem ville være tom ceremoni.
 */

/** Etiket-tabel + den afledte `{ value, label }`-liste, som felt-familien tager. */
type EnumLabels<TValue extends string> = Readonly<{
  labels: Readonly<Record<TValue, string>>;
  options: readonly Readonly<{ value: TValue; label: string }>[];
}>;

const buildEnumLabels = <TValue extends string>(
  values: readonly TValue[],
  labels: Readonly<Record<TValue, string>>
): EnumLabels<TValue> => ({
  labels,
  // Rækkefølgen følger enummets egen — så en ny værdi dukker op på alle flader uden at
  // nogen skal huske at tilføje den til en parallel liste.
  options: values.map((value) => ({ value, label: labels[value] })),
});

/**
 * «Løn indtastes som» / lønperiode. Bemærk at `dag` hedder **Dato** for brugeren, ikke
 * «Dag» — etiketten er ikke afledelig af værdien, og det er netop derfor tabellen findes.
 */
export const LOENPERIODE_LABELS: EnumLabels<Loenperiode> = buildEnumLabels(
  loenperiodeEnum.options,
  { maaned: 'Måned', uge: 'Uge', dag: 'Dato' }
);

/** Svie/smerte-satsen ved delvis sygemelding. */
export const SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_LABELS: EnumLabels<SvieSmerteDelvisSygemeldingSats> =
  buildEnumLabels(svieSmerteDelvisSygemeldingSatsEnum.options, { fuld: 'Fuld sats', halv: 'Halv sats' });
