// Inputkernen (§3.3): ét codec pr. inputfamilie på tværs af formular og grid. Codecs er rene funktioner
// uden React, DOM eller storage. En afvist resolution bærer en MASKINLÆSBAR årsag og detaljer, så UI
// aldrig reparser råteksten for at finde tooltipteksten (§1.8).

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

/**
 * De codec-FAMILIER, kernen har. §7.1 kræver, at den fælles feltkontrakt køres mod BÅDE form- og
 * grid-adapteren "for hver codecfamilie" — og det krav kan kun håndhæves, hvis familierne er
 * OPREGNELIGE. Uden navnet var listen en hånd-vedligeholdt konstant i en testfil, og præcis derfor kunne
 * dækningen falde bagud til én form-familie og én grid-familie uden at noget blev rødt.
 *
 * Tilføjes en ny familie, er den en compilerfejl her, indtil den har et navn — og derefter en rød
 * kontraktsuite, indtil den har en case (`fieldContract.surfaces.test.tsx`).
 */
export type FieldCodecFamily =
  | 'text'
  | 'optionalText'
  /**
   * `selection` dækker BÅDE `createSelectionFieldCodec` og `createChoiceFieldCodec`: sidstnævnte er en tynd
   * wrapper, der kun tilføjer en dublet-/tomhedskontrol på valgmængden og derefter delegerer HELE parse-,
   * format- og tastaturadfærden. To familienavne for samme adfærd ville have krævet to identiske
   * kontraktcases og dermed foregivet en dækning, der ikke måler noget nyt. `requiredChoice` er derimod
   * sin egen familie: den oversætter tom tekst til en gyldig default frem for til `undefined`.
   */
  | 'selection'
  | 'requiredChoice'
  | 'boolean'
  | 'date'
  | 'integer'
  | 'amount'
  | 'percent'
  /**
   * `stringBacked` er en ADAPTER-familie: den pakker et indre codec (integer/år/uge) og bevarer tomhed som
   * `''` i canonical data. Dens egen adfærd — den strengede tomhed og den tolerante `format` af en
   * historisk `.eo`-streng — er det, kontrakten måler; det indre codec måles af sin egen familie.
   *
   * `week` er navngivet, men har INGEN descriptor i produktionen: hvert eneste uge-felt er wrappet i
   * `stringBacked` (fire descriptors, verificeret). Kontraktsuiten opregner derfor de LEVENDE familier fra
   * produktionskataloget frem for fra denne union — en case for en familie uden descriptor ville have målt
   * en gren, ingen tilstand kan nå. Bygges et rå uge-felt, dukker familien op i kataloget, og suiten bliver
   * rød indtil den har en case.
   */
  | 'stringBacked'
  | 'year'
  | 'week'
  | 'fraction';

/**
 * Feltets FORTEGNS-politik, som den er erklæret på descriptoren.
 *
 * **Hvorfor den skal være DATA på codecet.** `allowNegative` blev erklæret på hvert numerisk codec i
 * kataloget — og honoreret af INGENTING. Codecet parser bevidst med `allowNegative: true`, fordi et fortegn
 * er en BOUNDS-regel og ikke et formatbrud (§1.6): en negativ værdi skal kunne committes canonical og bære et
 * rødt bounds-issue frem for at blive afvist som råtekst. Konfigurationen var derfor kun en
 * construction-time-sanity-check, mens hver enkelt feltkomponent hardkodede sit eget tegnfilter — og de var
 * ikke enige: `GridPercentCell` blokerede minus, `PercentField` tillod det, og begge tjente descriptorer med
 * `allowNegative: false`.
 *
 * Politikken hører derfor på codecet, hvor den ER erklæret, så tastaturfilteret og `acceptsInitialKey` kan
 * læse den ENE sandhed frem for at gætte. Den ændrer IKKE §1.6: parse/settle er stadig fortegns-blind, og
 * bounds-validatoren ejer stadig den røde fejl for en værdi, der NÅR frem (fx via en indlæst `.eo`-fil).
 * Politikken styrer kun, hvad der kan TASTES.
 */
export type FieldSignPolicy = 'nonNegative' | 'signed';
export type FieldDecimalPolicy = 'integerOnly' | 'decimal';

export type FieldCodec<T> = Readonly<{
  /** Codecets familie — den ene identitet, §7.1's dækningskrav opregnes over. */
  family: FieldCodecFamily;
  /**
   * Fortegns-politikken for de NUMERISKE familier (`integer`, `amount`, `percent` og deres string-backed
   * adaptere). Udeladt for familier, hvor fortegn er meningsløst (tekst, valg, dato, uge, år, brøk).
   *
   * Se {@link FieldSignPolicy} for hvorfor den ligger her og ikke i komponenten.
   */
  signPolicy?: FieldSignPolicy;
  /** Om et numerisk felt accepterer decimaladskiller under redigering. Beløbs- og procentflader læser denne politik. */
  decimalPolicy?: FieldDecimalPolicy;
  /**
   * VALGMÆNGDEN for de opregnelige familier (`selection`, `requiredChoice`, `boolean`) som CANONICAL værdier.
   *
   * Samme begrundelse som {@link FieldSignPolicy}: mængden ER erklæret inde i codecet, og uden den udadtil
   * er den eneste maskinlæsbare opregning af "hvilke tilstande kan brugeren sætte dette felt i" umulig.
   * Det var netop den manglende opregning, der lod BF-025 leve: ingen test kunne feje en tom sags
   * dropdown-valg igennem, fordi ingen kunne SPØRGE et felt om dets valg.
   *
   * Udeladt for de frie familier (tekst, dato, tal …), hvor mængden ikke er endelig.
   */
  options?: readonly unknown[];
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
