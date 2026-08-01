/**
 * En ikke-blokerende feltadvarsel. Den er adskilt fra `FieldIssue`, fordi den hverken gør canonical
 * input ugyldigt eller blokerer beregning, save eller dokumenter.
 */
export type FieldWarning = Readonly<{
  severity: 'warning';
  message: string;
}>;

export const createFieldWarning = (message: string): FieldWarning | undefined => {
  const normalizedMessage = message.trim();
  return normalizedMessage === ''
    ? undefined
    : Object.freeze({ severity: 'warning' as const, message: normalizedMessage });
};
