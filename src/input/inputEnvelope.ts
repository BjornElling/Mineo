import { z } from 'zod';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { cloneAndDeepFreeze } from '../utils/deepFreeze';
import {
  persistedInputSectionsSchema,
  rejectedInputsSchema,
  type PersistedInputSections,
  type RejectedInputs,
} from './inputState';
import { deserializeFieldAddress } from './fieldAddress';
import { readLegacyFieldPath } from './legacyInputCompatibility';

export const INPUT_ENVELOPE_VERSION = '1' as const;
/** Fase-3-formatet indeholder sentinel-adresser; fase 4 oversætter dem atomisk til FIELD_ADDRESS_VERSION. */
export const INPUT_ENVELOPE_FIELD_ADDRESS_VERSION = 'legacy-bridge-1' as const;

const envelopeInputSchema = z.object({
  sections: persistedInputSectionsSchema,
  rejectedInputs: rejectedInputsSchema,
}).strict().superRefine((input, context) => {
  for (const serializedAddress of Object.keys(input.rejectedInputs)) {
    const address = deserializeFieldAddress(serializedAddress);
    if (address === null || readLegacyFieldPath(address) === null) {
      context.addIssue({
        code: 'custom',
        path: ['rejectedInputs', serializedAddress],
        message: 'Fase-3-envelopen accepterer kun eksplicitte legacy-broadresser',
      });
    }
  }
}).readonly();

export const inputEnvelopeSchema = z.object({
  envelopeVersion: z.literal(INPUT_ENVELOPE_VERSION),
  fieldAddressVersion: z.literal(INPUT_ENVELOPE_FIELD_ADDRESS_VERSION),
  persistedDataVersion: z.literal(PERSISTED_DATA_VERSION),
  input: envelopeInputSchema,
}).strict().readonly();

export type InputEnvelope = z.infer<typeof inputEnvelopeSchema>;
export type RuntimePersistedInputState = z.output<typeof envelopeInputSchema>;

export const createInputEnvelope = (input: Readonly<{
  sections: PersistedInputSections;
  rejectedInputs: RejectedInputs;
}>): InputEnvelope =>
  inputEnvelopeSchema.parse({
    envelopeVersion: INPUT_ENVELOPE_VERSION,
    fieldAddressVersion: INPUT_ENVELOPE_FIELD_ADDRESS_VERSION,
    persistedDataVersion: PERSISTED_DATA_VERSION,
    input,
  });

export const parseInputEnvelope = (raw: string): InputEnvelope => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Inputenvelopen indeholder ugyldig JSON.');
  }
  const result = inputEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Inputenvelopen matcher ikke den aktuelle struktur: ${result.error.message}`);
  }
  // Deep-freeze gør resultatet mere restriktivt end schema-outputtet; castet fjerner kun den
  // TypeScript-mismatch, som mutable arraytyper i de eksisterende sektionsschemas ellers giver.
  return cloneAndDeepFreeze(result.data) as InputEnvelope;
};

export const serializeInputEnvelope = (input: RuntimePersistedInputState): string =>
  JSON.stringify(createInputEnvelope(input));
