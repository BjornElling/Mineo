import type { ISODateString } from '../types/branded';
import type { DateRangeBoundsOrigin, DateRangeSpecialErrors } from '../utils/dateRangeErrorMessages';
import type { CanonicalView, FieldRef } from './fieldDescriptor';

// Datofelters grænse-ERKLÆRING som ren type (§1.6a). Typerne bor her og ikke i
// `catalog/dateBoundsValidators.ts`, fordi `fieldDescriptor.ts` skal kunne referere dem, mens validatoren
// omvendt bygger på `fieldDescriptor.ts`. En delt type-kun-modul bryder den cirkel uden en runtime-afhængighed.
//
// Se `catalog/dateBoundsValidators.ts` for baggrunden: konfigurationen deklarerede grænser, som intet bandt
// til håndhævelsen, og 31 af 54 datofelter accepterede derfor år 1900 og år 2100 uden ét issue.

/** Feltets kontekst under validering: den canonical view plus feltets egen adresse. */
export type DateBoundsContext = Readonly<{
  view: CanonicalView;
  field: FieldRef<ISODateString | undefined>;
}>;

/**
 * En grænse er enten en fast ISO-dato, en thunk (dags dato-afhængige grænser) eller en funktion af feltets
 * egen kontekst (grænser, der krydslæser ANDRE felter, fx skadedato eller rækkens modpart).
 *
 * `undefined` fra en kontekstfunktion betyder "ingen skærpelse fra denne kilde" — spec'ens ydre grænse
 * gælder da. Det er netop situationen, hvor brugeren endnu ikke har udfyldt det felt, grænsen udledes af.
 */
export type DateBoundResolver =
  | ISODateString
  | (() => ISODateString)
  | ((context: DateBoundsContext) => ISODateString);

/** Oprindelsen kan afhænge af, om en skærpelse faktisk var aktiv, og er derfor også kontekstafhængig. */
export type DateBoundsOriginSpec =
  | DateRangeBoundsOrigin
  | ((context: DateBoundsContext) => DateRangeBoundsOrigin);

/**
 * Et datofelts erklærede grænser.
 *
 * `min`/`max` er den YDRE ramme (typisk fra `dateRanges`-konfigurationen) og er PÅKRÆVET — det er dem, der
 * fanger år 1900 og år 2100. `narrowMin`/`narrowMax` er valgfrie skærpelser udledt af andre felters værdier;
 * de kan kun gøre intervallet SMALLERE, aldrig bredere, så et tomt afhængighedsfelt aldrig kan åbne rammen.
 */
export type DateBoundsSpec = Readonly<{
  /** Ydre nedre grænse. Altid gældende, uanset hvad brugeren har udfyldt. */
  min: DateBoundResolver;
  /** Ydre øvre grænse. Altid gældende. */
  max: DateBoundResolver;
  /** Skærper `min` når den kan udledes (fx skadedato, rækkens fra-dato). */
  narrowMin?: (context: DateBoundsContext) => ISODateString | undefined;
  /** Skærper `max` når den kan udledes (fx rækkens til-dato, beregningsdato). */
  narrowMax?: (context: DateBoundsContext) => ISODateString | undefined;
  /**
   * Beskedens oprindelse. `STATIC_DATE_BOUNDS` når begge grænser er konfigurationskonstanter;
   * `derivedDateBounds('<Felt A> og <Felt B>')` så snart en skærpelse kan gøre intervallet umuligt — ellers
   * får brugeren at vide, at ingen dato er gyldig, uden at få at vide hvilke felter der skal rettes.
   */
  origin: DateBoundsOriginSpec;
  /** Domænespecifik beskedform (fx «Datoen kan ikke være før skadedatoen»). */
  special?: (context: DateBoundsContext) => DateRangeSpecialErrors | undefined;
}>;

/**
 * Den bevidst grænseløse erklæring.
 *
 * Findes for at gøre fravalget SYNLIGT og aktivt: værnet kræver en erklæring på hvert datofelt, og et felt
 * uden reelle grænser skal derfor sige det højt med en begrundelse frem for bare at mangle en validator.
 * `reason` læses af værnet og står som feltets dokumentation.
 */
export type UnconstrainedDateBounds = Readonly<{ unconstrained: true; reason: string }>;

export type DateBoundsDeclaration = DateBoundsSpec | UnconstrainedDateBounds;

export const unconstrainedDateBounds = (reason: string): UnconstrainedDateBounds =>
  Object.freeze({ unconstrained: true as const, reason });

export const isUnconstrainedDateBounds = (
  declaration: DateBoundsDeclaration
): declaration is UnconstrainedDateBounds =>
  (declaration as UnconstrainedDateBounds).unconstrained === true;
