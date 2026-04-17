/**
 * Validerings- og beregningslogik for årslønsberegning
 *
 * Disse funktioner er rene (ingen side effects) og kan testes isoleret.
 */

import type { StandardLoenTableRow, LoenPaaHelligdage, Loenperiode } from '../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../types/loen';
import { formatPercent } from '../../utils/formatUtils';
import { hasCompletePeriodForLoenperiode } from './standardLoenRowCalculations';
import { getStandardLoenTableValidation } from './standardLoenTableValidation';
import type { StandardLoenTableValidationSummary } from '../../types/table';

/**
 * Tjekker om der er valideringsfejl i tabeldata
 *
 * @param tableData - Tabeldata
 * @param loenperiode - Lønperiode type
 * @returns true hvis der er valideringsfejl
 */
export const harTabelValideringsFejl = (
  tableData: StandardLoenTableRow[],
  loenperiode: Loenperiode
): boolean => {
  if (!tableData || tableData.length === 0) {
    return false;
  }

  return getStandardLoenTableValidation({ rows: tableData, loenperiode }).summary.hasErrors;
};

/**
 * Beregner fejlmeddelelser for årslønsberegning
 *
 * @param feriePct - Feriegodtgørelse procent
 * @param shSoPct - SH/SO procent
 * @param fuldLoenUnderFerie - Har fuld løn under ferie
 * @param retTilSjetteFerieuge - Ret til 6. ferieuge
 * @param loenPaaHelligdage - Løn på helligdage type
 * @returns Array af fejlmeddelelser
 */
export const beregnFejlmeddelelser = (
  feriePct: number | undefined,
  shSoPct: number | undefined,
  fuldLoenUnderFerie: boolean,
  retTilSjetteFerieuge: boolean,
  loenPaaHelligdage: LoenPaaHelligdage
): string[] => {
  const errors: string[] = [];

  const parsePct = (pct: number | undefined) => (typeof pct === 'number' && Number.isFinite(pct) ? pct : 0);

  const ferieProcent = parsePct(feriePct);
  const shProcent = parsePct(shSoPct);

  // FEJL 1: Feriegodtgørelse konflik (for høj sats MED fuld løn)
  if (ferieProcent >= 12.0 && fuldLoenUnderFerie) {
    errors.push(
      `En feriepengesats på ${formatPercent(ferieProcent)} gør det højst usandsynligt, at der er ret til løn under ferie.`
    );
  }

  // FEJL 2: Feriegodtgørelse konflik (for lav sats UDEN fuld løn)
  if (ferieProcent > 0 && ferieProcent < 12.0 && !fuldLoenUnderFerie) {
    errors.push(
      `En feriepengesats på ${formatPercent(ferieProcent)} gør det usandsynligt, at der ikke er ret til fuld løn under ferie.`
    );
  }

  // FEJL 3: SH/SO-sats konflik (for høj sats)
  if (shProcent > 2.5) {
    if (loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG) {
      errors.push(
        `En SH/SO-sats på ${formatPercent(shProcent)} gør det usandsynligt, at der betales almindelig løn på SH-dage.`
      );
    } else if (loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.INGEN) {
      errors.push(
        `En SH/SO-sats på ${formatPercent(shProcent)} gør det usandsynligt, at der ikke er ret til SH-betaling på helligdage.`
      );
    }
  }

  // FEJL 4: SH/SO-sats konflik (for lav sats)
  if (shProcent > 0 && shProcent < 2.5 && loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.SH_UDBETALING) {
    errors.push(
      `En SH/SO-sats på ${formatPercent(shProcent)} gør det yderst tvivlsomt, at der er ret til SH-betaling på helligdage.`
    );
  }

  // FEJL 5: 6. ferieuge med for lav feriegodtgørelse
  if (!fuldLoenUnderFerie && retTilSjetteFerieuge && ferieProcent > 0 && ferieProcent < 15.0) {
    errors.push(
      'Retten til 6. ferieuge vil typisk skulle omsættes til feriegodtgørelse med 15 %.'
    );
  }

  return errors;
};

/**
 * Tjekker om der er data i tabellen for den valgte lønperiode
 *
 * @param tableData - Tabeldata
 * @param loenperiode - Lønperiode type
 * @returns true hvis der er data
 */
export const harTabelData = (
  tableData: StandardLoenTableRow[],
  loenperiode: Loenperiode
): boolean => {
  if (!tableData || tableData.length === 0) {
    return false;
  }

  return tableData.some((row) => hasCompletePeriodForLoenperiode(row, loenperiode));
};

export type AarsloenOmregningGate = Readonly<{
  checked: boolean;
  effectiveEnabled: boolean;
  canEnable: boolean;
  hasValidPeriod: boolean;
  hasBlockingTableIssue: boolean;
  validationSummary: StandardLoenTableValidationSummary;
}>;

export const EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY: StandardLoenTableValidationSummary = {
  rowIssues: [],
  hasErrors: false,
  hasWarnings: false,
};

export const resolveAarsloenOmregningGate = (args: Readonly<{
  requestedEnabled: boolean;
  tableData: StandardLoenTableRow[];
  loenperiode: Loenperiode;
  validationSummary: StandardLoenTableValidationSummary;
}>): AarsloenOmregningGate => {
  const hasValidPeriod = harTabelData(args.tableData, args.loenperiode);
  const hasBlockingTableIssue = args.validationSummary.hasErrors || !hasValidPeriod;
  const checked = args.requestedEnabled && !hasBlockingTableIssue;

  return {
    checked,
    effectiveEnabled: checked,
    canEnable: !hasBlockingTableIssue,
    hasValidPeriod,
    hasBlockingTableIssue,
    validationSummary: args.validationSummary,
  };
};
