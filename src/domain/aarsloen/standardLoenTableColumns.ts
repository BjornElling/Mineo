import type { Loenperiode, StandardLoenTableRow } from '../../schemas/formSchemas';
import { STANDARD_LOEN_COLUMN_LABELS, type StandardLoenTableColumnKey } from '../../types/table';
import { formatISOToDanish } from '../../utils/dateFormatting';

// Normativt: col2 og col3 er to visuelt adskilte lønfelter med identisk domænebetydning.
// De må kun adskilles i præsentationen; beregningsmæssigt summeres de blot.
//
// KOLONNENAVNE ER ÉT SANDT STED (§3.2a): `STANDARD_LOEN_COLUMN_LABELS` i `types/table.ts`. Både de to
// descriptor-kataloger og overskrifterne herunder læser derfra. Modulet havde tidligere sin EGEN navneliste,
// og de to drev fra hinanden: `col4` hed «Ikke-pensionsgivende løn» i overskriften, mens en fejl på præcis
// den celle bad brugeren rette «Løn (3)». Samme fejlklasse, blot mellem gridoverskrift og
// feltfejl frem for mellem formularlabel og feltfejl.
//
// Linjeskiftene i overskrifterne er REN LAYOUT – de ombryder et langt navn i en smal kolonne og tilføjes
// oven på navnet i `withHeaderLineBreak`. De er derfor aldrig en del af navnet.

/**
 * Kolonner, hvis navn ombrydes i tabeloverskriften. Nøglen er kolonnen; værdien er navnet med et `\n`
 * indsat – og det SKAL være samme tegn i samme rækkefølge som navnet, kun med et linjeskift tilføjet.
 * `standardLoenDeclaredLabelForms.test.ts` beviser det ved at strippe skiftene og sammenligne med
 * descriptor-labelen.
 */
const HEADER_LINE_BREAKS: Readonly<Partial<Record<StandardLoenTableColumnKey, string>>> = Object.freeze({
  col4: 'Ikke-pensions-\ngivende løn',
  col5: 'ATP og anden\nløn u. tillæg',
  fpFvShSoBeloeb: 'FP/FV/SH/\nSO/St.B.',
  pensionBeloeb: 'Arb.g.\nPension',
});

/** Overskriftens form af et kolonnenavn: navnet, eventuelt ombrudt for den smalle kolonne. */
const withHeaderLineBreak = (colKey: StandardLoenTableColumnKey): string =>
  HEADER_LINE_BREAKS[colKey] ?? STANDARD_LOEN_COLUMN_LABELS[colKey];

/**
 * DOKUMENT-formen af et kolonnenavn: navnet forkortet, så det holder inden for den plads, kolonnen har i
 * bilagets tabel.
 *
 * Forkortelserne stod tidligere som frie strenge inde i `aarsloenDocument.ts` ved siden af de kanoniske
 * navne. Modulets egen regel er, at et kolonnenavn har ÉT sandt sted, netop for at samme kolonne ikke kan
 * hedde to ting – og generatoren gjorde præcis det, reglen skulle forhindre, blot mellem skærm og papir i
 * stedet for mellem to sider. En feltfejl på cellen navngav den «Ikke-pensionsgivende løn», mens bilaget
 * kaldte den noget andet.
 *
 * Formen er derfor ERKLÆRET her, på samme måde som `HEADER_LINE_BREAKS` er den erklærede overskrifts-form,
 * og `standardLoenDeclaredLabelForms.test.ts` beviser, at hver forkortelse er afledt af
 * navnet: samme ord i samme rækkefølge, kun forkortet og eventuelt ombrudt. Det VISTE resultat er uændret.
 */
type DocumentLabelForm = Readonly<{
  /** Den tekst, dokumentet viser. Uændret fra før forkortelserne blev en erklæret form. */
  text: string;
  /**
   * Sat, når teksten ikke er en ren afkortning af navnet, men ERSTATTER ord med en anden vending.
   * Værdien er begrundelsen. En erstatning kan ikke afledes maskinelt af navnet, så værnet kan kun
   * kræve, at den er bevidst erklæret – ikke at den er udledt.
   */
  substitutionReason?: string;
}>;

const DOCUMENT_LABEL_FORMS: Readonly<Partial<Record<StandardLoenTableColumnKey, DocumentLabelForm>>> =
  Object.freeze({
    col4: { text: 'Ikke-pens.\ngiv. løn' },
    col5: {
      text: 'ATP mv.\nu. tillæg',
      // «mv.» (med videre) står i stedet for «og anden løn» – det er en omskrivning, ikke en afkortning.
      // Kolonnen er en af de smalleste i bilaget, og «ATP og and. løn u. till.» ville hverken være
      // kortere eller lettere at læse. Teksten er brugerens, og den er uændret.
      substitutionReason: '«mv.» erstatter «og anden løn»; pladsen i bilagets smalleste kolonne',
    },
    fpFvShSoBeloeb: { text: 'FP/FV/SH/\nSO/St.B.' },
    pensionBeloeb: { text: 'Arb.g.\nPension' },
  });

/** Kolonnens navn i et DOKUMENT: den erklærede form, ellers det fulde navn. */
export const resolveStandardLoenDocumentColumnLabel = (colKey: StandardLoenTableColumnKey): string =>
  DOCUMENT_LABEL_FORMS[colKey]?.text ?? STANDARD_LOEN_COLUMN_LABELS[colKey];

/** Er kolonnens dokument-form en erklæret OMSKRIVNING frem for en ren afkortning? */
export const isStandardLoenDocumentLabelSubstitution = (colKey: StandardLoenTableColumnKey): boolean =>
  DOCUMENT_LABEL_FORMS[colKey]?.substitutionReason !== undefined;

/** Kolonner med en erklæret dokument-form – værnets kilde. */
export const STANDARD_LOEN_DOCUMENT_LABEL_FORM_KEYS = Object.freeze(
  Object.keys(DOCUMENT_LABEL_FORMS) as StandardLoenTableColumnKey[]
);

export const STANDARD_LOEN_COL2_LABEL = withHeaderLineBreak('col2');
export const STANDARD_LOEN_COL3_LABEL = withHeaderLineBreak('col3');
export const STANDARD_LOEN_COL4_LABEL = withHeaderLineBreak('col4');
export const STANDARD_LOEN_COL5_LABEL = withHeaderLineBreak('col5');
export const STANDARD_LOEN_FPFVSHSO_LABEL = withHeaderLineBreak('fpFvShSoBeloeb');
export const STANDARD_LOEN_PENSION_LABEL = withHeaderLineBreak('pensionBeloeb');
/** Beregnet kolonne uden redigerbart felt – og derfor uden descriptor at hente navnet fra. */
export const STANDARD_LOEN_SAMLET_LABEL = 'Samlet løn';

const PERIOD_HEADERS: Record<Loenperiode, readonly [string, string]> = {
  maaned: [STANDARD_LOEN_COLUMN_LABELS.col0_maaned, STANDARD_LOEN_COLUMN_LABELS.col1_maaned],
  uge: [STANDARD_LOEN_COLUMN_LABELS.col0_uge, STANDARD_LOEN_COLUMN_LABELS.col1_uge],
  dag: [STANDARD_LOEN_COLUMN_LABELS.col0_dag, STANDARD_LOEN_COLUMN_LABELS.col1_dag],
};

/**
 * Resolver de to periode-kolonner (fra/til) for en standard-løn-række til den tekst,
 * der vises i dokument-output. Kanonisk og delt mellem alle dokument-generatorer, så
 * periode-visningen er ens på tværs af kanaler og dokumenttyper.
 *
 * - `maaned`: måned-nummer + år (rene tal-strenge).
 * - `uge`: uge fra/til (rene tal-strenge).
 * - `dag`: `col0_dag`/`col1_dag` er gemt som ISODateString (ÅÅÅÅ-MM-DD) og SKAL
 *   formateres til dansk DD-MM-ÅÅÅÅ her. Uden denne formatering lækkede datoen
 *   tidligere rå ISO ud i lønindkomst-/årsløns-tabellen.
 */
export const resolveStandardLoenPeriodColumns = (
  row: StandardLoenTableRow,
  loenperiode: Loenperiode
): readonly [string, string] => {
  if (loenperiode === 'maaned') {
    return [row.col0_maaned?.trim() ?? '', row.col1_maaned?.trim() ?? ''];
  }
  if (loenperiode === 'uge') {
    return [row.col0_uge?.trim() ?? '', row.col1_uge?.trim() ?? ''];
  }
  return [formatISOToDanish(row.col0_dag), formatISOToDanish(row.col1_dag)];
};

/**
 * Kolonnens navn i BESKEDER – uden overskriftens layout-linjeskift. Det er samme navn som feltets
 * descriptor-label og dermed samme navn, en feltfejl på cellen bruger (§3.2a).
 */
export const resolveStandardLoenColumnLabel = (colKey: StandardLoenTableColumnKey): string =>
  STANDARD_LOEN_COLUMN_LABELS[colKey];

export const getStandardLoenTableHeaders = (loenperiode: Loenperiode): readonly string[] => {
  return [
    ...PERIOD_HEADERS[loenperiode],
    STANDARD_LOEN_COL2_LABEL,
    STANDARD_LOEN_COL3_LABEL,
    STANDARD_LOEN_COL4_LABEL,
    STANDARD_LOEN_COL5_LABEL,
    STANDARD_LOEN_FPFVSHSO_LABEL,
    STANDARD_LOEN_PENSION_LABEL,
    STANDARD_LOEN_SAMLET_LABEL,
  ];
};

/**
 * Returnerer indekset for en given label i arrayet fra getStandardLoenTableHeaders.
 * Fejler hårdt (invariant) hvis labelen ikke findes – det indikerer et array-strukturbrud.
 *
 * Bruges i stedet for hardkodede integer-konstanter, der tavst ville give forkerte
 * kolonne-lookup ved fremtidige array-ændringer.
 */
/**
 * Tabellens overskrifter i et DOKUMENT – samme kolonner og rækkefølge som `getStandardLoenTableHeaders`, men
 * med kolonnernes erklærede dokument-form. ENESTE kilde for både Årsløns dokument og erstatningsopgørelsens
 * lønindkomst-bilag.
 *
 * Bilaget havde før sin egen oversættelse af skærmens overskrifter, så ATP-kolonnen hed «ATP og løn u.
 * till./pens.» i bilaget og «ATP mv. u. tillæg» i Årsløns dokument – samme beløb med to navne (BB-299,
 * udviklerafgørelse 2026-10-19: samme beløb skal have samme navn, når det kan ske uden visuelle fejl). Den
 * fælles form er kortere end bilagets gamle på begge linjer, så kolonnen hverken bliver bredere eller ombrydes
 * mere.
 */
export const getStandardLoenDocumentTableHeaders = (loenperiode: Loenperiode): readonly string[] => [
  ...PERIOD_HEADERS[loenperiode],
  resolveStandardLoenDocumentColumnLabel('col2'),
  resolveStandardLoenDocumentColumnLabel('col3'),
  resolveStandardLoenDocumentColumnLabel('col4'),
  resolveStandardLoenDocumentColumnLabel('col5'),
  resolveStandardLoenDocumentColumnLabel('fpFvShSoBeloeb'),
  resolveStandardLoenDocumentColumnLabel('pensionBeloeb'),
  STANDARD_LOEN_SAMLET_LABEL,
];

export const getStandardLoenHeaderIndex = (loenperiode: Loenperiode, label: string): number => {
  const headers = getStandardLoenTableHeaders(loenperiode);
  const index = headers.indexOf(label);
  if (index === -1) {
    throw new Error(`CRITICAL: Kolonneoverskrift "${label}" ikke fundet i standardLoenTableHeaders.`);
  }
  return index;
};
