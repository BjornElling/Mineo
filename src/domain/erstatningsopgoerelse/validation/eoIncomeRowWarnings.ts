import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { coerceToISODateString, dateToISO, isoToDanish, parseISODate, type ISODateString } from '../../../types/branded';
import { findAmountOutliers } from '../../../utils/tableAmountOutlierDetection';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import type { IsoRange } from '../../../utils/isoDateHelpers';
import { parseAarsloenRowInterval } from '../../aarsloen/aarsloenRowInterval';
import { buildBeregningsperiodeRange, buildTafRanges } from '../helpers/indtaegtPerioder';
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
//  - offentlige ydelser: identisk række (BB-289) og negativt beløb (BB-290);
//  - begge: et beløb over ti gange højere end de øvrige rækker i samme periode (BB-297, `tableAmountOutlierDetection.ts`).
// Alle regnes med i beregningen; advarslen beder kun brugeren om at se efter.

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

/**
 * Rækkens periode i rimelighedskontrollen (BB-297): beregningsperioden, erstatningsperioden eller ingen af dem. Der
 * sammenlignes kun inden for samme periode, så en lav løn efter skaden ikke får lønnen før skaden til at se høj ud.
 *
 * Erstatningsperioden er TAF-perioderne uden skadedatoens beskæring: den rammer kun midlertidig EET for skader før
 * 2011-06-16 og flytter ikke en lønrække mellem perioderne i praksis – og uden den grupperer fladen og «Fejl og
 * advarsler» ens, også hvor skadedatoen ikke er ved hånden.
 */
const buildIndtaegtsperiodeGruppe = (values: ErstatningsopgoerelseValues) => {
  const beregningsperiode = values.beregnesUdFra === 'Beregningsperiode' ? buildBeregningsperiodeRange(values) : undefined;
  const tafRanges = buildTafRanges(values);
  const overlaps = (fra: ISODateString, til: ISODateString, range: IsoRange): boolean => fra <= range.til && range.fra <= til;
  return (fra: ISODateString | undefined, til: ISODateString | undefined): string => {
    if (fra === undefined || til === undefined) return 'ingen';
    if (beregningsperiode !== undefined && overlaps(fra, til, beregningsperiode)) return 'beregningsperiode';
    if (tafRanges.some((range) => overlaps(fra, til, range))) return 'erstatningsperiode';
    return 'oevrige';
  };
};

/** Lønindkomstens rækkeadvarsler for ét ansættelsesforhold, i tabellens rækkefølge. */
export const resolveLoenindkomstRowWarnings = (
  values: ErstatningsopgoerelseValues,
  ansaettelsesforhold: Ansaettelsesforhold,
  skadedato: ISODateString | undefined,
  today: ISODateString
): readonly StandardLoenRowWarning[] => {
  const rows = ansaettelsesforhold.indtaegtsoplysningerTableData ?? [];
  const periodeGruppe = buildIndtaegtsperiodeGruppe(values);
  // Samme «Samlet løn», som tabellen og bilaget viser for rækken.
  const rowTotal = (row: (typeof rows)[number]): number =>
    calculateLoenindkomstRowDerived({ row, ansaettelsesforhold, context: values, skadedato }).samlet;
  return resolveStandardLoenRowWarnings({
    fieldSet: createEoStandardLoenFieldSet(ansaettelsesforhold.id),
    rows,
    loenperiode: ansaettelsesforhold.loenperiode,
    tillaegAngivesSom: ansaettelsesforhold.tillaegAngivesSom,
    today,
    errorRowIds: getStandardLoenErrorRowIdSet(rows, ansaettelsesforhold.loenperiode, ansaettelsesforhold.tillaegAngivesSom),
    rowTotal,
    amountOutlier: {
      rowTotal,
      group: (row) => {
        const interval = parseAarsloenRowInterval(row, ansaettelsesforhold.loenperiode);
        return periodeGruppe(
          interval === null ? undefined : dateToISO(interval.start),
          interval === null ? undefined : dateToISO(interval.end)
        );
      },
      sammenligning: 'ansættelsesforholdets øvrige lønrækker i perioden',
    },
  });
};

export type OffentligeYdelserRowWarningKind = 'duplicateRow' | 'negativeAmount' | 'amountOutlier';

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

/** Ydelsesrækker kortere end en uge vurderes ikke for et usandsynligt højt beløb (BB-297). */
const OUTLIER_MIN_YDELSE_DAGE = 7;

/**
 * Offentlige ydelsers rækkeadvarsler i tabellens rækkefølge. Uden `values` (sagens perioder) vurderes beløbenes
 * rimelighed ikke.
 */
export const resolveOffentligeYdelserRowWarnings = (
  rows: readonly OffentligeYdelserRow[],
  values?: ErstatningsopgoerelseValues
): readonly OffentligeYdelserRowWarning[] => {
  const errorRowIds = getOffentligeYdelserErrorRowIdSet(rows);
  const indexById = new Map(rows.map((row, index) => [row.id, index]));
  const nameOf = (row: OffentligeYdelserRow): string => formatOffentligYdelseRowName(row, indexById.get(row.id) ?? 0);
  const duplicateIds = new Set(findDuplicateRows(
    rows.filter((row) => getOffentligeYdelserRowFilledState(row).hasAnyFilled),
    (row) => [row.fraDato, row.tilDato, row.ydelse, row.tillaeg, row.ydelsestype]
  ).map((match) => match.row.id));

  // Rimelighedskontrollen (BB-297): ydelse pr. kalenderdag, sammenlignet inden for ydelsestype og periode.
  const periodeGruppe = values === undefined ? undefined : buildIndtaegtsperiodeGruppe(values);
  const outlierIds = periodeGruppe === undefined ? new Set<string>() : findAmountOutliers(rows.flatMap((row) => {
    if (errorRowIds.has(row.id)) return [];
    const fra = coerceToISODateString(row.fraDato);
    const til = coerceToISODateString(row.tilDato);
    const typeKey = row.ydelsestype?.trim() ?? '';
    if (fra === undefined || til === undefined || typeKey === '') return [];
    const fraDato = parseISODate(fra);
    const tilDato = parseISODate(til);
    const dage = fraDato && tilDato ? (countInclusiveUtcDays(fraDato, tilDato) ?? 0) : 0;
    if (dage < OUTLIER_MIN_YDELSE_DAGE) return [];
    const total = (amountValueToNumber(row.ydelse) ?? 0) + (amountValueToNumber(row.tillaeg) ?? 0);
    return [{ id: row.id, group: `${typeKey}|${periodeGruppe(fra, til)}`, value: total / dage }];
  }));

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
    if (outlierIds.has(row.id)) {
      const positiveCells = [
        ...(ydelse !== undefined && ydelse > 0 ? [toAnyFieldRef(eoOffentligeYdelserYdelseField.bind(row.id))] : []),
        ...(tillaeg !== undefined && tillaeg > 0 ? [toAnyFieldRef(eoOffentligeYdelserTillaegField.bind(row.id))] : []),
      ];
      const udsagn = 'over ti gange højere end ydelsestypens øvrige rækker i perioden – kontrollér beløbet';
      warnings.push(Object.freeze({
        kind: 'amountOutlier' as const,
        rowId: row.id,
        summaryMessage: `${nameOf(row)} er ${udsagn}`,
        cellMessage: `Ydelsen er ${udsagn}`,
        cells: positiveCells.length > 0 ? positiveCells : [toAnyFieldRef(eoOffentligeYdelserYdelseField.bind(row.id))],
      }));
    }
  }
  return Object.freeze(warnings);
};
