/**
 * Typer for EO-række-evaluering og den nedstrøms EOInspektion-visning.
 */

import type { FieldAddress } from '../../inputCore/fieldAddress';
import type { FieldAddressTemplate } from '../../inputCore/fieldDescriptor';
import type { ISODateString } from '../../types/branded';

/**
 * Status for EO-rækker og integrity-checks
 *
 * - 'ok': Alt er konsistent og korrekt
 * - 'warning': Bør give anledning til overvejelse, men blokerer ikke beregning
 * - 'error': Åbenlyst forkert, blokerer beregning
 *
 * VIGTIGT: Denne type er canonical for hele Mineo.
 * Andre lag må IKKE definere egen status-type.
 *
 * @see eoRowCommon.ts - Helper-funktioner der mapper issues til status
 */
export type EoRowStatus = 'ok' | 'warning' | 'error';

/**
 * Severity for integrity-fejl
 */
export type IntegritySeverity = Exclude<EoRowStatus, 'ok'>;

/**
 * Invariant-typer for integrity checks
 */
export const IntegrityInvariant = {
  PERIOD_OVERLAP: 'PERIOD_OVERLAP',
  DATE_HOLES: 'DATE_HOLES',
  BASE_DATE_INCONSISTENT: 'BASE_DATE_INCONSISTENT',
  TAF_DAYS_MISMATCH: 'TAF_DAYS_MISMATCH',
  SVIE_SMERTE_MISMATCH: 'SVIE_SMERTE_MISMATCH',
} as const;

export type IntegrityInvariantValue =
  typeof IntegrityInvariant[keyof typeof IntegrityInvariant];

export type PrimitiveCell =
  number | ISODateString | string | boolean | null;

/**
 * Celle-værdi med både rå og formateret værdi
 */
export type CellValue<T extends PrimitiveCell> = {
  readonly rawValue: T;
  readonly displayValue: string;
};

/**
 * Række-celle kan være enten structured (med raw+display) eller ren tekst
 */
export type RowCellValue =
  | CellValue<PrimitiveCell>
  | string;

/**
 * Integrity-problem fundet i kontrol-model
 */
export type IntegrityIssue = {
  readonly severity: IntegritySeverity;
  readonly invariant: IntegrityInvariantValue;
  readonly message: string;
  readonly affectedRows?: readonly number[];
  readonly expected?: number | string;
  readonly actual?: number | string;
};

/**
 * Dato-interval (inklusiv–inklusiv)
 */
export type DateRange = {
  readonly start: ISODateString;
  readonly end: ISODateString;
};

/**
 * Overlap-resultat mellem to dato-intervaller
 */
export type OverlapResult = {
  readonly overlaps: boolean;
  readonly start?: ISODateString;
  readonly end?: ISODateString;
  readonly kind?: 'partial' | 'contained' | 'contains' | 'touching';
};

/**
 * Svie/smerte niveau
 */
export type SvieSmerte = 'Ingen' | 'Delvis' | 'Fuld';

/**
 * EO row model - bruges af både download-gaten og EOInspektion.
 *
 * VIGTIGT: id skal være semantisk stabil (tied to field identity, ikke label eller array order).
 * Dette sikrer React key stability og gør række-output auditérbart.
 */
export type EoRowGroup =
  | 'aes.varigeMen'
  | 'aes.midlertidigtEet'
  | 'aes.endeligtEet'
  | 'aes.oevrigt'
  | 'aes.differencekrav';

export type DependencySpec =
  | Readonly<{ kind: 'id'; id: string }>
  | Readonly<{ kind: 'prefix'; prefix: string }>;

/**
 * Fokusmålet for et navigerbart EO-issue.
 *
 * Målet er en KANONISK feltadresse (§3.2) — den samme dataidentitet undo/redo (`findRestoreTarget`) og
 * save-blokeringens fokus (`lookupEditorLocation`) bruger. Adressen bindes af issue-kataloget fra
 * produktionens egne felt-descriptorer, så et omdøbt felt bliver en compilerfejl frem for et link, der
 * lydløst falder tilbage til rækkeankeret.
 *
 * `rowId` er ikke et alternativt identitetssystem, men det GROVERE mål: en række uden et enkelt ansvarligt
 * felt (fx et overlap mellem to rækker) forankres til rækkens `data-mineo-row-id`.
 *
 * `collectionField` løser den TREDJE situation, de to første ikke kan udtrykke sandt: advarslen handler om en
 * indtastning, der IKKE FINDES ENDNU («Der er ikke angivet nogen TAF-periode i EO-perioden»). Der er intet
 * række-id at pege på, fordi brugeren ikke har oprettet rækken — men tabellen viser altid en tom
 * indtastningsrække, hvis celler bærer en fuldt bundet feltadresse. Målet navngiver derfor feltet gennem
 * descriptorens `template` (collection + feltnavn UDEN entity-id) og lader opslaget finde den FØRSTE editor
 * for netop det felt. Det er samme feltidentitet som `fieldAddress` — kun med rækkeleddet ubundet, fordi
 * placeholderens id dannes i UI'et (`usePlaceholderSlotIds`) og derfor ikke kan kendes i domænet.
 */
export type EoIssueFocusTarget =
  | Readonly<{ kind: 'fieldAddress'; address: FieldAddress }>
  | Readonly<{ kind: 'rowId'; rowId: string }>
  | Readonly<{ kind: 'collectionField'; template: FieldAddressTemplate }>;

/**
 * Hvilket konkret input i en periode-/tabelrække en fejl er forankret til. Sættes af row-builderne
 * ud fra valideringsresultatet og bruges af issue-kataloget til at vælge den korrekte celle som
 * primært fokus-mål — i stedet for at gætte kolonnen ud fra fejlbeskedens ordlyd (som ikke kan
 * skelne fx en fra-dato efter en cutoff fra en til-dato-fejl).
 */
export type EoIssueFieldHint = 'fra' | 'til' | 'tilstand';

/**
 * Struktureret tabel på en række, når rækkens værdi ER en tabel.
 *
 * Findes fordi `displayValue` ellers måtte bære tabellen som en formatteret multiline-streng
 * (`"…|…|…\n…"`), som forbrugeren skulle splitte på `\n` og `|` — en skjult
 * serialiseringsaftale mellem builder og præsentation. Den aftale var dobbelt skjult, fordi
 * kolonneantallet varierede med indholdet, og totalrækken kun kunne genkendes ved at
 * strengmatche celleteksten «I alt».
 *
 * `displayValue` bevares uændret ved siden af: dokumentgeneratorerne bruger den formatterede
 * form, og den er derfor ikke redundant. Men UI-forbrugere skal læse `table`.
 */
export type EoRowTable = Readonly<{
  columns: readonly string[];
  rows: readonly EoRowTableRow[];
}>;

export type EoRowTableRow = Readonly<{
  cells: readonly string[];
  /**
   * Sand for en sammentællingsrække. Eksplicit flag frem for at genkende «I alt» i celle 0 —
   * en etiketændring må ikke kunne ændre, hvad der er en totalrække.
   */
  isTotal?: boolean;
}>;

/**
 * Serialiserer en {@link EoRowTable} til `displayValue`-formen: celler adskilt af `" | "`,
 * rækker af `"\n"`.
 *
 * Formen er BEVIDST byte-identisk med den, builderne tidligere byggede i hånden, fordi
 * dokumentgeneratorerne læser `displayValue` direkte. Ændr den ikke uden at opdatere
 * dokument-goldens — strengen er et outputformat, ikke et internt mellemled.
 */
export const serializeEoRowTable = (table: EoRowTable): string =>
  [
    table.columns.join(' | '),
    ...table.rows.map((row) => row.cells.join(' | ')),
  ].join('\n');

/**
 * Serialiserer en liste af linjer til `displayValue`-formen.
 *
 * Samme aftale som {@link serializeEoRowTable}, men for rækker hvis værdi er en LISTE og ikke en
 * tabel: strukturen er kilden, strengen er outputtet. Uden den måtte forbrugeren splitte
 * `displayValue` på `\n` igen for at få listen tilbage — en skjult serialiseringsaftale, der
 * driver synlig UI-forgrening (antal linjer afgør ental/flertal i etiketten), og som en ren
 * formatteringsændring i builderen kunne bryde lydløst.
 */
export const serializeEoRowLines = (lines: readonly string[]): string => lines.join('\n');

export type EoRowModel = {
  id: string;
  label: string;
  displayValue: string;
  /** Sat når rækkens værdi er en tabel; se {@link EoRowTable}. */
  table?: EoRowTable;
  /**
   * Sat når rækkens værdi er en LISTE af linjer. Forbrugeren skal læse denne frem for at splitte
   * {@link displayValue} på `\n`; se {@link serializeEoRowLines}.
   */
  lines?: readonly string[];
  /**
   * Ansættelsesforholdet rækken hører til, når den er per-ansættelsesforhold.
   *
   * Eksplicit felt, fordi forbrugerne ellers måtte udlede tilhørsforholdet ved at regex-parse
   * `id` (`/^loenindkomst\.([^.]+)\./`, `/^sfgg\.[^.]+\.([^.]+)(?:\.|$)/` m.fl.) — altså
   * gætte struktur ud af en id-navnekonvention, som builderne kunne ændre uden at nogen
   * opdagede det. Builderen HAR id'et i hånden; den skal aflevere det frem for at kode det
   * ind i en streng, forbrugeren pakker ud igen.
   */
  employmentId?: string;
  // Status er rækkens max-severity for UI (ikke issue-niveau).
  status: EoRowStatus;
  // Optional domænemeddelelse (uden "Fejl (...)" / "Advarsel (...)").
  message?: string;
  // Optional præsentationshint til Beregning-fanen.
  summaryDisplay?: 'default' | 'messageOnly';
  // Optional færdig fejl-/advarselslinje til "Fejl og advarsler".
  summaryText?: string;
  // Optional primært DOM-mål for fejl-/advarselslink. Bruges før række-/sektionsfallback.
  focusTarget?: EoIssueFocusTarget;
  // Optional hint om hvilket felt i en periode-/tabelrække fejlen vedrører (fra/til/tilstand).
  // Kataloget bruger det til at vælge den korrekte celle som fokus-mål.
  focusFieldHint?: EoIssueFieldHint;
  group?: EoRowGroup;
  dependsOn?: ReadonlyArray<DependencySpec>;
};

/**
 * Række-dag – én dag i række-tidslinjen
 *
 * ANSVAR:
 * - Tidslinje-basis (dato, ugedag, weekend)
 * - Søgnehelligdage
 * - Arbejdsdag-klassifikation
 * - TAF-periode markering
 * - Svie/smerte-status
 *
 * IKKE i scope endnu:
 * - Løn-komponenter (kommer i senere fase)
 * - Offentlige ydelser (kommer i senere fase)
 */
export type RowDay = {
  readonly iso: ISODateString;
  readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=søndag, 1=mandag, ..., 6=lørdag
  readonly isWeekend: boolean;
  readonly isSognehelligdag: boolean;
  readonly isArbejdsdag: boolean;
  readonly tafFlags: ReadonlySet<string>; // Set af TAF-periode-IDs
  readonly svieSmerte: SvieSmerte;
};
