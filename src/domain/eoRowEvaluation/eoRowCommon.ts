import type { FieldIssue } from '../../inputCore/inputIssue';
import type { EoRowStatus } from './eoRowTypes';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';

// Rækkevisningens fejl-algebra. Ét issue pr. felt (se `eoInputIssues.ts`): der findes intet source-register at
// prioritere imellem, så `collectPresentFieldErrors` og source-prioriteten er væk sammen med registret.
//
// De neutrale tekst-helpers bor i domænets validerings-lag. Modulet re-eksporterer dem IKKE længere (det var en
// bevidst compatibility-facade, så gamle importstier kunne blive stående) – hver konsument importerer dem
// direkte fra `validation/eoDateRangeMessages`, så der kun findes én vej til hver funktion.

/** Har feltet et issue med en visbar besked? Ét issue pr. felt, så der er intet at vælge imellem. */
const presentIssue = (issue: FieldIssue | undefined): FieldIssue | null =>
  issue !== undefined && issue.message.trim() !== '' ? issue : null;

/**
 * De visbare issues på tværs af FLERE felter, der deler én række (fx `vedroererPeriodeFra`/`-Til`, eller
 * forligs procent/brøk).
 *
 * Det er den ene legitime grund til at holde issues i en liste. Tidligere kom listen fra `collectPresentFieldErrors`
 * over ét felts source-register – altså fra en dimension, der ikke fandtes. Nu kommer den fra de felter,
 * rækken faktisk kombinerer, og kaldet siger hvilke.
 */
export const presentIssuesForRow = (
  ...issues: readonly (FieldIssue | undefined)[]
): readonly FieldIssue[] => issues
  .map(presentIssue)
  .filter((issue): issue is FieldIssue => issue !== null);

export const summarizeFieldErrorsForEoRow = (
  issue: FieldIssue | undefined
): { displayValue: string; status: EoRowStatus } | null => {
  const present = presentIssue(issue);
  if (present === null) return null;

  const status: EoRowStatus = present.severity === 'error' ? 'error' : 'warning';
  const prefix = status === 'error' ? 'Fejl' : 'Advarsel';
  return { displayValue: `${prefix} (${present.message.trim()})`, status };
};

export const resolveEoRowDisplay = (args: {
  value: string | undefined;
  issue: FieldIssue | undefined;
  emptyState: EoRowStatus;
}): { displayValue: string; status: EoRowStatus } => {
  const errorSummary = summarizeFieldErrorsForEoRow(args.issue);
  if (errorSummary) return errorSummary;

  if (isNonEmptyString(args.value)) {
    return { displayValue: args.value.trim(), status: 'ok' };
  }

  return { displayValue: '-', status: args.emptyState };
};
