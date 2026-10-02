import type { ISODateString } from '../../../types/branded';
import { isPeriodOverlapIssue } from '../periodOverlapIssues';
import { detectOverlappingPeriods } from '../engines/periodOverlapDetection';
import { isNonEmptyString } from './eoDateRangeMessages';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import type { TafPeriodeEvaluation } from './tafPeriodeValidation';
import { assessPeriodeDatoMangler, buildPeriodeRaekkeNavn, FERIE_OVERLAP_LINJE, resolvePeriodeNavneDatoer } from './tafRowRules';

/**
 * Ren (React-/kontrol-frit) blokerings-afgørelse for TAF-ferieperiode-rækker (`taf.ferie.*`) – linjen i
 * «Fejl og advarsler».
 *
 * Rækkens datoregler ligger IKKE her længere. Feriens vindue (skadedato, dags dato, afskæringerne) og
 * overlappet projekteres til cellerne i `tafRowCellIssues.ts`, hvor de farver cellen og blokerer TAF-grenen
 * som enhver rød feltfejl (BB-248, BB-251); dato-orden og systemrammen bærer descriptoren selv. Her samles
 * rækkens røde celler og dens manglende datoer til ÉN linje med rækkens navn (BB-253) – så cellen og linjen
 * aldrig siger to forskellige ting om samme dato.
 */

export type FerieperiodeRowInput = Readonly<{
  id: string;
  fra?: ISODateString;
  til?: ISODateString;
}>;

export type FerieperiodeCellIssues = Readonly<{
  fra?: FieldIssue | undefined;
  til?: FieldIssue | undefined;
}>;

const isRed = (issue: FieldIssue | undefined): issue is FieldIssue =>
  issue !== undefined && issue.severity === 'error' && issue.message.trim() !== '';

const isRowLineIssue = (issue: FieldIssue | undefined): issue is FieldIssue =>
  isRed(issue) && !isPeriodOverlapIssue(issue);

const evaluateOne = (
  periode: FerieperiodeRowInput,
  cellIssues: FerieperiodeCellIssues,
  hasOverlap: boolean,
  overlapLinje: string,
): TafPeriodeEvaluation => {
  const harFra = isNonEmptyString(periode.fra) || isRed(cellIssues.fra);
  const harTil = isNonEmptyString(periode.til) || isRed(cellIssues.til);
  if (!harFra && !harTil) return { kind: 'skip' };

  const dele: Array<Readonly<{ message: string; field: 'fra' | 'til' }>> = [];
  if (isRowLineIssue(cellIssues.fra)) dele.push({ message: cellIssues.fra.message.trim(), field: 'fra' });
  if (isRowLineIssue(cellIssues.til)) dele.push({ message: cellIssues.til.message.trim(), field: 'til' });
  const mangler = assessPeriodeDatoMangler(harFra, harTil);
  if (mangler) dele.push(mangler);

  if (dele.length === 0) {
    return hasOverlap ? { kind: 'error', message: overlapLinje, field: 'fra' } : { kind: 'ok' };
  }
  const beskeder = [...new Set(dele.map((del) => del.message))];
  if (hasOverlap) beskeder.push(overlapLinje);
  return {
    kind: 'error',
    message: `${buildPeriodeRaekkeNavn('Ferieperioden', resolvePeriodeNavneDatoer(periode, cellIssues))}: ${beskeder.join('; ')}`,
    field: dele[0]!.field,
  };
};

/**
 * Gælder begge ferietabeller: TAF-afsnittets og beregningsperiodens (BB-264). `overlapLinje` navngiver
 * tabellen, så to tabellers overlap ikke foldes sammen til én linje i «Fejl og advarsler» (BB-251).
 */
export const evaluateFerieperioder = (
  ferieperioder: ReadonlyArray<FerieperiodeRowInput>,
  cellIssues: (rowId: string) => FerieperiodeCellIssues,
  overlapLinje: string = FERIE_OVERLAP_LINJE,
): ReadonlyMap<string, TafPeriodeEvaluation> => {
  const overlappingIds = detectOverlappingPeriods(ferieperioder);
  const result = new Map<string, TafPeriodeEvaluation>();
  for (const periode of ferieperioder) {
    result.set(periode.id, evaluateOne(periode, cellIssues(periode.id), overlappingIds.has(periode.id), overlapLinje));
  }
  return result;
};
