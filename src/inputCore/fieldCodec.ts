// Greenfield-kerne (§3.3): ét codec pr. inputfamilie på tværs af form og grid. Codecs er rene funktioner
// uden React, DOM eller storage. Den eneste ændring fra legacy er, at en afvist resolution bærer en
// MASKINLÆSBAR årsag + detaljer, så UI aldrig reparser råteksten for at finde tooltipteksten (§1.8).

/**
 * Årsag til at et syntaktisk håndteret settle blev afvist. Alle årsager ender som en rød feltfejl med
 * SAMME gate-konsekvens (§1.6); kun beskeden varierer.
 *
 * - `format`  — teksten kan ikke parses til feltets type.
 * - `range`   — teksten parser til en værdi uden for feltets aktive commit-interval (min/max).
 *
 * Kronologiske/tværgående bounds og tolerant-load-canonical håndteres IKKE her, men af feltvalidatorer
 * på en canonical værdi (§1.6): de forbliver canonical med et afledt issue.
 */
export type FieldRejectReason = 'format' | 'range';

export type FieldRejectDetail = Readonly<Record<string, string | number | boolean>>;

export type FieldResolution<T> =
  | Readonly<{ status: 'valid'; value: T }>
  | Readonly<{ status: 'rejected'; reason: FieldRejectReason; detail?: FieldRejectDetail }>;

export type FieldCodec<T> = Readonly<{
  /** Parser rå editortekst ved settle. Semantisk tom tekst skal resolve `valid` til feltets tomværdi. */
  parseForSettle: (raw: string) => FieldResolution<T>;
  /** Visning af en canonical værdi i lukket tilstand. */
  format: (value: T) => string;
  /** Seed af den åbne draft, når editoren åbnes fra en canonical værdi. */
  formatForEdit: (value: T) => string;
  /** Om et tastetryk må åbne editoren og indgå som første tegn. */
  acceptsInitialKey: (key: string) => boolean;
  /** Valgfri normalisering af indsat tekst før parse. */
  normalizePaste?: (raw: string) => string;
}>;

export const validResolution = <T>(value: T): FieldResolution<T> =>
  Object.freeze({ status: 'valid', value });

export const rejectedResolution = <T>(
  reason: FieldRejectReason,
  detail?: FieldRejectDetail
): FieldResolution<T> => Object.freeze(
  detail === undefined
    ? { status: 'rejected', reason }
    : { status: 'rejected', reason, detail: Object.freeze({ ...detail }) }
);
