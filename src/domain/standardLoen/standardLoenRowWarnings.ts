import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import { dateToISO, isoToDanish, coerceToISODateString, type ISODateString } from '../../types/branded';
import { parseWeekString } from '../../utils/dateUtils';
import { formatAsAmount } from '../../utils/formatUtils';
import { toAnyFieldRef, type AnyFieldRef, type FieldDescriptor } from '../../inputCore/fieldDescriptor';
import { bindCollectionCell } from '../../inputCore/collectionCellBinding';
import { DUPLICATE_ROW_WARNING, findDuplicateRows } from '../../utils/tableDuplicateRowDetection';
import { parseAarsloenRowInterval } from '../aarsloen/aarsloenRowInterval';
import { getStandardLoenPeriodKeys } from './standardLoenTableValidation';
import type { StandardLoenTableFieldSet } from './standardLoenTableFieldSet';

// Løntabellens IKKE-blokerende rækkeadvarsler – gul ring på cellerne og en linje pr. række i sidens
// advarsler. Fælles for Årsløn og EO's lønindkomst, så samme række giver samme gule ring og samme ordlyd
// på begge flader.
//
// Tre regler:
//  - `duplicateRow` – rækken gentager en tidligere række ordret (BB-096/BB-289). Udviklerafgørelse
//    2026-10-19: det spærrer IKKE – dobbelt løn for samme periode kan i sjældne tilfælde være reel – men skal
//    ses. Sammenligningen er `findDuplicateRows`' (beregnet beløb, kun den 2., 3., … forekomst).
//  - `futurePeriod` – en periodecelle ligger helt efter dags dato (BB-115/BB-298). Lovligt (en lønseddel kan
//    udstedes forud), men oftest en tastefejl i året. En månedscelle er «efter», når hele måneden er det; den
//    igangværende måned er altså ikke markeret.
//  - `negativeTotal` – rækkens samlede løn er negativ (BB-290, kun EO). Rækken regnes med og modregnes;
//    advarslen er der, fordi en negativ lønseddel er sjælden nok til at fortjene et blik.

export type StandardLoenRowWarningKind = 'duplicateRow' | 'futurePeriod' | 'negativeTotal';

export type StandardLoenRowWarning = Readonly<{
  kind: StandardLoenRowWarningKind;
  rowId: string;
  /** Rækkens periode som brugeren skrev den («06-2017», «uge 10/2018», «01-05-2018 - 31-05-2018»). */
  periodLabel: string | undefined;
  /** Linjen i sidens advarsler – navngiver rækken. */
  summaryMessage: string;
  /** Tooltippet på de markerede celler – står ved rækken og behøver ikke navngive den. */
  cellMessage: string;
  /** De celler, der får gul ring. Den første er linkets mål. */
  cells: readonly AnyFieldRef[];
}>;

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

export const buildFuturePeriodWarningMessage = (today: ISODateString): string =>
  `Perioden ligger efter dags dato (${danish(today)})`;

/** Rækkens periode i den form, brugeren tastede den. `undefined`, når periodecellerne ikke er udfyldt. */
export const formatStandardLoenRowPeriodLabel = (
  row: StandardLoenTableRow,
  loenperiode: Loenperiode
): string | undefined => {
  if (loenperiode === 'maaned') {
    const month = row.col0_maaned?.trim() ?? '';
    const year = row.col1_maaned?.trim() ?? '';
    if (month === '' || year === '') return undefined;
    return `${month.padStart(2, '0')}-${year}`;
  }
  if (loenperiode === 'uge') {
    const fra = row.col0_uge?.trim() ?? '';
    const til = row.col1_uge?.trim() ?? '';
    if (fra === '' && til === '') return undefined;
    if (fra === '' || til === '' || fra === til) return `uge ${fra === '' ? til : fra}`;
    return `uge ${fra} - ${til}`;
  }
  const fra = coerceToISODateString(row.col0_dag);
  const til = coerceToISODateString(row.col1_dag);
  if (fra === undefined && til === undefined) return undefined;
  if (fra === undefined || til === undefined) return danish((fra ?? til) as ISODateString);
  return `${danish(fra)} - ${danish(til)}`;
};

/** «Lønrækken 06-2017» eller – uden periode – «Række 13» (rækkens plads i tabellen). */
export const formatStandardLoenRowName = (
  row: StandardLoenTableRow,
  loenperiode: Loenperiode,
  rowIndex: number
): string => {
  const periodLabel = formatStandardLoenRowPeriodLabel(row, loenperiode);
  return periodLabel === undefined ? `Række ${rowIndex + 1}` : `Lønrækken ${periodLabel}`;
};

const bindCell = <T>(fieldSet: StandardLoenTableFieldSet, descriptor: FieldDescriptor<T>, rowId: string): AnyFieldRef =>
  toAnyFieldRef(bindCollectionCell(fieldSet.collection, descriptor, rowId));

const periodCells = (fieldSet: StandardLoenTableFieldSet, rowId: string, loenperiode: Loenperiode): readonly AnyFieldRef[] =>
  loenperiode === 'maaned'
    ? [bindCell(fieldSet, fieldSet.col0_maaned, rowId), bindCell(fieldSet, fieldSet.col1_maaned, rowId)]
    : loenperiode === 'uge'
      ? [bindCell(fieldSet, fieldSet.col0_uge, rowId), bindCell(fieldSet, fieldSet.col1_uge, rowId)]
      : [bindCell(fieldSet, fieldSet.col0_dag, rowId), bindCell(fieldSet, fieldSet.col1_dag, rowId)];

const comparedCells = (
  fieldSet: StandardLoenTableFieldSet,
  rowId: string,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): readonly AnyFieldRef[] => [
  ...periodCells(fieldSet, rowId, loenperiode),
  bindCell(fieldSet, fieldSet.col2, rowId),
  bindCell(fieldSet, fieldSet.col3, rowId),
  bindCell(fieldSet, fieldSet.col4, rowId),
  bindCell(fieldSet, fieldSet.col5, rowId),
  ...(tillaegAngivesSom === 'beloeb'
    ? [bindCell(fieldSet, fieldSet.fpFvShSoBeloeb, rowId), bindCell(fieldSet, fieldSet.pensionBeloeb, rowId)]
    : []),
];

/**
 * De celler i rækken, der er brugt i dublet-sammenligningen – kun den valgte lønperiodes to kolonner og
 * tillægsbeløbene kun i Beløb-tilstand, så en skjult celle ikke afgør, om to synligt ens rækker er ens.
 */
const duplicateComparableValues = (
  row: StandardLoenTableRow,
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom
): readonly unknown[] => {
  const [periodStartKey, periodEndKey] = getStandardLoenPeriodKeys(loenperiode);
  const values: unknown[] = [row[periodStartKey], row[periodEndKey], row.col2, row.col3, row.col4, row.col5];
  if (tillaegAngivesSom === 'beloeb') values.push(row.fpFvShSoBeloeb, row.pensionBeloeb);
  return values;
};

/**
 * Periodecellerne, der ligger efter dags dato. Måned: begge celler, når hele måneden ligger efter. Uge og
 * dato: hver celle for sig, så det er den fremtidige ende, der markeres.
 */
const futurePeriodCells = (
  fieldSet: StandardLoenTableFieldSet,
  row: StandardLoenTableRow,
  loenperiode: Loenperiode,
  today: ISODateString
): readonly AnyFieldRef[] => {
  if (loenperiode === 'maaned') {
    const interval = parseAarsloenRowInterval(row, 'maaned');
    const start = interval === null ? undefined : dateToISO(interval.start);
    return start !== undefined && start > today ? periodCells(fieldSet, row.id, loenperiode) : [];
  }
  if (loenperiode === 'uge') {
    const startOf = (value: string | undefined): ISODateString | undefined => {
      const parsed = value === undefined || value.trim() === '' ? null : parseWeekString(value.trim());
      return parsed === null ? undefined : dateToISO(parsed.start);
    };
    return ([[row.col0_uge, fieldSet.col0_uge], [row.col1_uge, fieldSet.col1_uge]] as const).flatMap(([value, descriptor]) => {
      const start = startOf(value);
      return start !== undefined && start > today ? [bindCell(fieldSet, descriptor, row.id)] : [];
    });
  }
  return ([[row.col0_dag, fieldSet.col0_dag], [row.col1_dag, fieldSet.col1_dag]] as const).flatMap(([value, descriptor]) => {
    const iso = coerceToISODateString(value);
    return iso !== undefined && iso > today ? [bindCell(fieldSet, descriptor, row.id)] : [];
  });
};

/** De løncelle-adresser, der bærer et negativt beløb – her sidder fortegnet, brugeren skal se på. */
const negativeAmountCells = (
  fieldSet: StandardLoenTableFieldSet,
  row: StandardLoenTableRow,
  tillaegAngivesSom: TillaegAngivesSom
): readonly AnyFieldRef[] => {
  const candidates = [
    [row.col2, fieldSet.col2],
    [row.col3, fieldSet.col3],
    [row.col4, fieldSet.col4],
    [row.col5, fieldSet.col5],
    ...(tillaegAngivesSom === 'beloeb'
      ? [[row.fpFvShSoBeloeb, fieldSet.fpFvShSoBeloeb], [row.pensionBeloeb, fieldSet.pensionBeloeb]] as const
      : []),
  ] as const;
  return candidates.flatMap(([value, descriptor]) =>
    value !== undefined && Number.isFinite(value.value) && value.value < 0 ? [bindCell(fieldSet, descriptor, row.id)] : []);
};

export type ResolveStandardLoenRowWarningsParams = Readonly<{
  fieldSet: StandardLoenTableFieldSet;
  /** Rækkerne i tabellens afsluttede rækkefølge (readerens værdier – en rød celle er allerede tom). */
  rows: readonly StandardLoenTableRow[];
  loenperiode: Loenperiode;
  tillaegAngivesSom: TillaegAngivesSom;
  today: ISODateString;
  /** Rækker, der allerede har en rød fejl – de får ingen gul advarsel oveni (rød vinder alligevel). */
  errorRowIds?: ReadonlySet<string>;
  /**
   * Rækkens samlede løn, som fladen viser den. Kun EO leverer den (BB-290); uden den vurderes negative rækker
   * ikke.
   */
  rowTotal?: (row: StandardLoenTableRow) => number;
}>;

export const resolveStandardLoenRowWarnings = ({
  fieldSet,
  rows,
  loenperiode,
  tillaegAngivesSom,
  today,
  errorRowIds,
  rowTotal,
}: ResolveStandardLoenRowWarningsParams): readonly StandardLoenRowWarning[] => {
  const warnings: StandardLoenRowWarning[] = [];
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const nameOf = (row: StandardLoenTableRow): string =>
    formatStandardLoenRowName(row, loenperiode, indexById.get(row.id) ?? 0);
  const isErrorRow = (row: StandardLoenTableRow): boolean => errorRowIds?.has(row.id) ?? false;

  const duplicateIds = new Set(
    findDuplicateRows(rows, (row) => duplicateComparableValues(row, loenperiode, tillaegAngivesSom)).map((match) => match.row.id)
  );
  const futureMessage = buildFuturePeriodWarningMessage(today);

  for (const row of rows) {
    if (isErrorRow(row)) continue;
    const periodLabel = formatStandardLoenRowPeriodLabel(row, loenperiode);
    if (duplicateIds.has(row.id)) {
      warnings.push(Object.freeze({
        kind: 'duplicateRow' as const,
        rowId: row.id,
        periodLabel,
        summaryMessage: `${nameOf(row)} er identisk med en tidligere række`,
        cellMessage: DUPLICATE_ROW_WARNING,
        cells: comparedCells(fieldSet, row.id, loenperiode, tillaegAngivesSom),
      }));
    }
    const futureCells = futurePeriodCells(fieldSet, row, loenperiode, today);
    if (futureCells.length > 0) {
      warnings.push(Object.freeze({
        kind: 'futurePeriod' as const,
        rowId: row.id,
        periodLabel,
        summaryMessage: `${nameOf(row)} ligger efter dags dato (${danish(today)})`,
        cellMessage: futureMessage,
        cells: futureCells,
      }));
    }
    if (rowTotal !== undefined) {
      const total = rowTotal(row);
      if (Number.isFinite(total) && total < 0) {
        const cells = negativeAmountCells(fieldSet, row, tillaegAngivesSom);
        const amount = `${formatAsAmount(total, 2)} kr.`;
        warnings.push(Object.freeze({
          kind: 'negativeTotal' as const,
          rowId: row.id,
          periodLabel,
          summaryMessage: `${nameOf(row)} har negativ samlet løn (${amount}) – beløbet modregnes i den øvrige indkomst`,
          cellMessage: `Rækkens samlede løn er negativ (${amount}) – beløbet modregnes i den øvrige indkomst`,
          cells: cells.length > 0 ? cells : [bindCell(fieldSet, fieldSet.col2, row.id)],
        }));
      }
    }
  }
  return Object.freeze(warnings);
};
