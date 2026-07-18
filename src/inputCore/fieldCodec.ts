// Greenfield-kerne (§3.3): ét codec pr. inputfamilie på tværs af form og grid. Codecs er rene funktioner
// uden React, DOM eller storage. Den eneste ændring fra legacy er, at en afvist resolution bærer en
// MASKINLÆSBAR årsag + detaljer, så UI aldrig reparser råteksten for at finde tooltipteksten (§1.8).

/**
 * Årsag til at et settle blev AFVIST (rejected råtekst, canonical slot ryddet til tomværdien). Efter
 * kravændringen 2026-07-18 er `format` den eneste afvisningsårsag: kun rå tekst, som ikke kan omsættes til en
 * værdi i feltets persisterede schema, er rejected (§1.6). Afvisning giver en rød feltfejl og blokerer `.eo`.
 *
 * - `format` — teksten kan ikke parses til feltets type eller kan ikke repræsenteres sikkert i schemaet.
 *
 * Feltets aktive min/max, kronologiske/tværgående bounds og feltplacerede domæneregler afvises IKKE her.
 * En schema-repræsenterbar out-of-bounds-værdi committes canonical og bærer et afledt `bounds`/`rule`-issue
 * fra en feltvalidator (§1.6). Den forbliver dermed gembar i `.eo`, selv om den blokerer afhængige consumers.
 */
export type FieldRejectReason = 'format';

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
