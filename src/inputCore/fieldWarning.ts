import { serializeFieldAddress, type SerializedFieldAddress } from './fieldAddress';
import type { AnyFieldRef } from './fieldDescriptor';

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

/**
 * Gul ring pr. celle fra en liste af rækkeadvarsler, der hver markerer et sæt celler med én tekst. En celle med
 * flere advarsler får dem alle i ét tooltip, i listens rækkefølge; samme tekst gentages ikke.
 */
export const buildFieldWarningMap = (
  warnings: readonly Readonly<{ cells: readonly AnyFieldRef[]; cellMessage: string }>[]
): ReadonlyMap<SerializedFieldAddress, FieldWarning> => {
  const messagesByAddress = new Map<SerializedFieldAddress, string[]>();
  for (const warning of warnings) {
    for (const cell of warning.cells) {
      const address = serializeFieldAddress(cell.address);
      const messages = messagesByAddress.get(address) ?? [];
      if (!messages.includes(warning.cellMessage)) messages.push(warning.cellMessage);
      messagesByAddress.set(address, messages);
    }
  }
  const result = new Map<SerializedFieldAddress, FieldWarning>();
  for (const [address, messages] of messagesByAddress) {
    const fieldWarning = createFieldWarning(messages.join('. '));
    if (fieldWarning !== undefined) result.set(address, fieldWarning);
  }
  return result;
};
