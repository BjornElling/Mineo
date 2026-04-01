const SUMMARY_MESSAGES = {
  missingInput: 'Indtastning mangler',
  allSalaryMissing: 'Alle lønoplysninger indtastet korrekt mangler',
  invalidInput: 'Ugyldig indtastning',
  manualRegulationMissing: 'Værdier mangler at blive udfyldt for manuel regulering',
} as const;

export const toReadableSummaryMessage = (message: string): string => {
  const trimmed = message.trim();
  if (trimmed === '') return '';

  const wrappedPrefixMatch = trimmed.match(/^(Fejl|Advarsel)\s*\((.*)\)$/s);
  const core = wrappedPrefixMatch?.[2]?.trim() ?? trimmed;

  if (core === SUMMARY_MESSAGES.missingInput) return 'mangler';
  if (core === SUMMARY_MESSAGES.allSalaryMissing) return 'Lønoplysninger mangler';
  if (core === SUMMARY_MESSAGES.invalidInput) return 'indeholder ugyldig indtastning';
  if (core === SUMMARY_MESSAGES.manualRegulationMissing) {
    return 'Mangler udfyldte værdier for manuel regulering';
  }

  const notSelectedMatch = core.match(/^(.*)\ser ikke valgt$/);
  if (notSelectedMatch?.[1]) {
    const field = notSelectedMatch[1].trim();
    if (field.length > 0) {
      return `${field} mangler`;
    }
  }

  return core;
};
