import type { FieldRef } from '../../../../inputCore/fieldDescriptor';
import type { CollectionRef } from '../../../../inputCore/fieldAddress';
import type { AmountValue } from '../../../../schemas/amountExpressionSchema';
import type { ManualBindings } from '../../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';

/**
 * Bindings-seamen for den delte Lønudvikling-flade (`LoenudviklingFields.tsx`).
 *
 * De to overflader adresserer de samme logiske felter på hver sin måde:
 *
 * - **Lønindkomst** binder pr. ansættelsesforhold — `field(eoEmploymentFields.X)` med et
 *   entity-led for `af.id`, og en `locationId` der er feltnavnet alene.
 * - **EO-oplysninger** binder «angivet løn» statisk — `eoAngivetLoenFields.X.bind()` med
 *   en fuldt kvalificeret `locationId`.
 *
 * Fladen må ikke kende den forskel, og den må ikke gætte adresserne ud fra strenge.
 * Derfor leverer ejeren et `LoenudviklingBinding`: ét felt pr. logisk felt, hver med sin
 * `FieldRef` og sin `location`. Feltidentiteten bliver hos katalogerne (jf.
 * `mineo-field-pattern.md`) i stedet for at blive genopfundet i præsentationslaget.
 *
 * Bemærk at dette er en **record** og ikke en `field(name)`-opslagsfunktion. Felterne har
 * reelt forskellige værditypér (`string`, `number`, `AmountValue`), så en fælles accessor
 * ville kræve en type-assertion, der ikke er beviseligt sikker. Recorden giver i stedet
 * fuld typecheck pr. felt, og en manglende binding er en compile-fejl i den overflade der
 * mangler den — ikke en runtime-overraskelse.
 */

/** Navigation-metadata (§3.7). Feltets fane kan ikke udledes af adressen. */
export type FieldLocation = Readonly<{
  locationId: string;
  route: string;
  tabKey: string | null;
}>;

/** Én binding: hvor feltet bor (adresse) og hvor det bor i navigationen (location). */
export type BoundField<T> = Readonly<{
  field: FieldRef<T>;
  location: FieldLocation;
}>;

/**
 * De felter den delte flade adresserer. Alle er påkrævede, så en ny gren i fladen tvinger
 * et bevidst valg i BEGGE overflader.
 *
 * Valg-felterne er generiske over deres egen literal-union frem for at være skrevet som
 * `string | undefined`. Det er ikke kosmetik: `FieldDescriptor<T>` er **invariant** i `T`
 * (codec'en både formatterer og parser), så en widening til `string` er ikke type-sikker
 * og afvises af compileren. Overfladerne har desuden hver sin union (fx har «angivet løn»
 * ikke nødvendigvis samme grundlagsmenu som et ansættelsesforhold), så en fast union her
 * ville binde de to overflader til hinandens domæne. Fladen læser aldrig værdierne selv —
 * den videregiver kun ref'en til det typede feltkomponent.
 */
export type LoenudviklingBinding<
  TGrundlag extends string | undefined = string | undefined,
  TStatistikModel extends string | undefined = string | undefined,
  TKrlSatstabel extends string | undefined = string | undefined,
  TOffentligLoenType extends string | undefined = string | undefined,
> = Readonly<{
  loenudviklingBeregningsgrundlag: BoundField<TGrundlag>;
  loenudviklingStatistikModel: BoundField<TStatistikModel>;
  loenudviklingKRLSatstabel: BoundField<TKrlSatstabel>;
  loenudviklingManuelNavn: BoundField<string | undefined>;
  offentligLoenType: BoundField<TOffentligLoenType>;
  offentligLoenTrin: BoundField<number | undefined>;
  offentligLoenGruppe: BoundField<number | undefined>;
  offentligLoenEkstraGrundloen: BoundField<AmountValue | undefined>;
}>;

export type LoenudviklingManualBindings = ManualBindings;

export type { FieldRef, CollectionRef };
