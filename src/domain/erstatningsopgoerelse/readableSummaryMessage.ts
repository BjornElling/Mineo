export const toReadableSummaryMessage = (message: string): string => {
  const trimmed = message.trim();
  if (trimmed === '') return '';

  const wrappedPrefixMatch = trimmed.match(/^(Fejl|Advarsel)\s*\((.*)\)$/s);
  const core = wrappedPrefixMatch?.[2]?.trim() ?? trimmed;

  if (core === 'Indtastning mangler') return 'mangler';
  if (core === 'Alle lønoplysninger indtastet korrekt mangler') return 'Lønoplysninger mangler';
  if (core === 'Ugyldig indtastning') return 'indeholder ugyldig indtastning';
  if (
    core === 'Værdier mangler at blive udfyldt for manuel regulering'
    || core === 'Mangler udfyldelse af værdier for Manuel Regulering'
  ) {
    return 'mangler udfyldte værdier for manuel regulering';
  }

  const notSelectedMatch = core.match(/^(.*)\ser ikke valgt$/);
  if (notSelectedMatch?.[1]) {
    const field = notSelectedMatch[1].trim();
    if (field.length > 0) {
      const lowerField = `${field.charAt(0).toLowerCase()}${field.slice(1)}`;
      return `"${lowerField}" mangler`;
    }
  }

  const missingFieldMatch = core.match(/^(.*)\smangler$/);
  if (missingFieldMatch?.[1]) {
    const field = missingFieldMatch[1].trim();
    if (field.length > 0 && field.toLowerCase() !== 'indtastning') {
      const lowerField = `${field.charAt(0).toLowerCase()}${field.slice(1)}`;
      return `"${lowerField}" mangler`;
    }
  }

  return core;
};
