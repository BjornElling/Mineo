import type { FormFieldError } from '../types/fieldErrors';

/** Udleder entity-id'er med en blokerende fejl på et navngivet syntetisk felt-suffix. */
export const selectBlockingFieldIdsBySuffix = (
  fieldErrors: Readonly<Record<string, Record<string, FormFieldError | undefined> | undefined>>,
  suffix: string
): Readonly<Record<string, true>> => {
  const result: Record<string, true> = {};

  for (const [fieldKey, bySource] of Object.entries(fieldErrors)) {
    if (!fieldKey.endsWith(suffix) || bySource === undefined) continue;
    const hasBlockingError = Object.values(bySource).some(
      (entry) => entry?.severity === 'error' && entry.blocksSave !== false
    );
    if (!hasBlockingError) continue;
    const entityId = fieldKey.slice(0, -suffix.length);
    if (entityId !== '') result[entityId] = true;
  }

  return result;
};
