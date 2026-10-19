import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { formatAsAmount } from '../../../utils/formatUtils';
import { toAnyFieldRef, type AnyFieldRef } from '../../../inputCore/fieldDescriptor';
import {
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserTilDatoField,
  eoOffentligeYdelserYdelseField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { DUPLICATE_ROW_WARNING, findDuplicateRows } from '../../../utils/tableDuplicateRowDetection';
import { resolveYdelsestype } from '../../../data/ydelsestyper';
import {
  resolveStandardLoenRowWarnings,
  type StandardLoenRowWarning,
} from '../../standardLoen/standardLoenRowWarnings';
import { createEoStandardLoenFieldSet } from '../eoStandardLoenFieldSet';
import { calculateLoenindkomstRowDerived } from '../helpers/loenindkomstRowDerived';
import { getOffentligeYdelserErrorRowIdSet, getStandardLoenErrorRowIdSet } from './indkomstRowValidation';
import { getOffentligeYdelserRowFilledState } from './offentligeYdelserTableValidation';

// EO's indtægtstabellers IKKE-blokerende rækkeadvarsler – gul ring på cellen og en linje i «Fejl og advarsler»
// (udviklerafgørelser 2026-10-19):
//  - lønindkomst (pr. ansættelsesforhold, aldrig på tværs): identisk række (BB-289), periode efter dags dato
//    (BB-298) og negativ samlet løn (BB-290) – den fælles løntabelregel, `standardLoenRowWarnings.ts`;
//  - offentlige ydelser: identisk række (BB-289) og negativt beløb (BB-290).
// Begge regnes med i beregningen; advarslen beder kun brugeren om at se efter.

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

/** Lønindkomstens rækkeadvarsler for ét ansættelsesforhold, i tabellens rækkefølge. */
export const resolveLoenindkomstRowWarnings = (
  values: ErstatningsopgoerelseValues,
  ansaettelsesforhold: Ansaettelsesforhold,
  skadedato: ISODateString | undefined,
  today: ISODateString
): readonly StandardLoenRowWarning[] => {
  const rows = ansaettelsesforhold.indtaegtsoplysningerTableData ?? [];
  return resolveStandardLoenRowWarnings({
    fieldSet: createEoStandardLoenFieldSet(ansaettelsesforhold.id),
    rows,
    loenperiode: ansaettelsesforhold.loenperiode,
    tillaegAngivesSom: ansaettelsesforhold.tillaegAngivesSom,
    today,
    errorRowIds: getStandardLoenErrorRowIdSet(rows, ansaettelsesforhold.loenperiode, ansaettelsesforhold.tillaegAngivesSom),
    // Samme «Samlet løn», som tabellen og bilaget viser for rækken.
    rowTotal: (row) => calculateLoenindkomstRowDerived({ row, ansaettelsesforhold, context: values, skadedato }).samlet,
  });
};

export type OffentligeYdelserRowWarningKind = 'duplicateRow' | 'negativeAmount';

export type OffentligeYdelserRowWarning = Readonly<{
  kind: OffentligeYdelserRowWarningKind;
  rowId: string;
  summaryMessage: string;
  cellMessage: string;
  cells: readonly AnyFieldRef[];
}>;

const danish = (iso: string | undefined): string | undefined =>
  iso === undefined ? undefined : (isoToDanish(iso as ISODateString) ?? iso);

/** «Ydelsen Sygedagpenge 01-01-2024 - 31-01-2024» – eller uden periode «Ydelsesrække 3». */
export const formatOffentligYdelseRowName = (row: OffentligeYdelserRow, rowIndex: number): string => {
  const typeLabel = resolveYdelsestype(row.ydelsestype?.trim() ?? '')?.config.label;
  const fra = danish(row.fraDato);
  const til = danish(row.tilDato);
  const periode = fra !== undefined && til !== undefined ? `${fra} - ${til}` : (fra ?? til);
  if (periode === undefined) return `Ydelsesrække ${rowIndex + 1}`;
  return typeLabel === undefined ? `Ydelsen ${periode}` : `Ydelsen ${typeLabel} ${periode}`;
};

/**
 * Dato- og beløbscellerne. Ydelsestypen indgår i sammenligningen, men dropdown-cellen har ingen gul ring; de
 * fire øvrige celler bærer advarslen.
 */
const ydelseCells = (rowId: string): readonly AnyFieldRef[] => [
  toAnyFieldRef(eoOffentligeYdelserFraDatoField.bind(rowId)),
  toAnyFieldRef(eoOffentligeYdelserTilDatoField.bind(rowId)),
  toAnyFieldRef(eoOffentligeYdelserYdelseField.bind(rowId)),
  toAnyFieldRef(eoOffentligeYdelserTillaegField.bind(rowId)),
];

/** Offentlige ydelsers rækkeadvarsler i tabellens rækkefølge. */
export const resolveOffentligeYdelserRowWarnings = (
  rows: readonly OffentligeYdelserRow[]
): readonly OffentligeYdelserRowWarning[] => {
  const errorRowIds = getOffentligeYdelserErrorRowIdSet(rows);
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const nameOf = (row: OffentligeYdelserRow): string => formatOffentligYdelseRowName(row, indexById.get(row.id) ?? 0);
  const duplicateIds = new Set(findDuplicateRows(
    rows.filter((row) => getOffentligeYdelserRowFilledState(row).hasAnyFilled),
    (row) => [row.fraDato, row.tilDato, row.ydelse, row.tillaeg, row.ydelsestype]
  ).map((match) => match.row.id));

  const warnings: OffentligeYdelserRowWarning[] = [];
  for (const row of rows) {
    if (errorRowIds.has(row.id)) continue;
    if (duplicateIds.has(row.id)) {
      warnings.push(Object.freeze({
        kind: 'duplicateRow' as const,
        rowId: row.id,
        summaryMessage: `${nameOf(row)} er identisk med en tidligere række`,
        cellMessage: DUPLICATE_ROW_WARNING,
        cells: ydelseCells(row.id),
      }));
    }
    const ydelse = amountValueToNumber(row.ydelse);
    const tillaeg = amountValueToNumber(row.tillaeg);
    const total = (ydelse ?? 0) + (tillaeg ?? 0);
    if ((ydelse !== undefined || tillaeg !== undefined) && Number.isFinite(total) && total < 0) {
      const amount = `${formatAsAmount(total, 2)} kr.`;
      const negativeCells = [
        ...(ydelse !== undefined && ydelse < 0 ? [toAnyFieldRef(eoOffentligeYdelserYdelseField.bind(row.id))] : []),
        ...(tillaeg !== undefined && tillaeg < 0 ? [toAnyFieldRef(eoOffentligeYdelserTillaegField.bind(row.id))] : []),
      ];
      warnings.push(Object.freeze({
        kind: 'negativeAmount' as const,
        rowId: row.id,
        summaryMessage: `${nameOf(row)} er negativ (${amount}) – beløbet modregnes i den øvrige indkomst`,
        cellMessage: `Rækkens samlede beløb er negativt (${amount}) – beløbet modregnes i den øvrige indkomst`,
        cells: negativeCells.length > 0 ? negativeCells : [toAnyFieldRef(eoOffentligeYdelserYdelseField.bind(row.id))],
      }));
    }
  }
  return Object.freeze(warnings);
};
