import { z } from 'zod';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { cloneAndDeepFreeze } from '../../utils/deepFreeze';
import { settledInputBaseSchema, type SettledInput } from '../settledInput';

// Greenfield-runtime (§2.1.6/§3.7): ÉN current-only session-envelope. Ingen `fieldAddressVersion`, sentinel-
// adresser eller legacy-migrator. Envelopen bærer kun det, der skal bruges for at genkende og genindlæse den
// aktuelle programversions afsluttede input. Katalog-afhængig XOR-/eksistens-validering ligger på `InputCatalog`
// og køres af hydration/dispatch — envelopen validerer kun strukturen.

export const CURRENT_INPUT_ENVELOPE_VERSION = '2';

const currentInputEnvelopeSchema = z.object({
  envelopeVersion: z.literal(CURRENT_INPUT_ENVELOPE_VERSION),
  persistedDataVersion: z.string().min(1),
  input: settledInputBaseSchema,
}).strict().readonly();

export type CurrentInputEnvelope = z.infer<typeof currentInputEnvelopeSchema>;

/** Serialiserer den aktuelle programversions afsluttede input til den ene sessionsnøgle. */
export const serializeCurrentEnvelope = (input: SettledInput): string => JSON.stringify({
  envelopeVersion: CURRENT_INPUT_ENVELOPE_VERSION,
  persistedDataVersion: PERSISTED_DATA_VERSION,
  input,
} satisfies CurrentInputEnvelope);

/**
 * Parser og strukturvaliderer envelopen. Kaster ved manglende/forkert `envelopeVersion` eller ugyldig struktur,
 * så hydration kan fail-close (§1.12). Returnerer et dybtfrossent `SettledInput` uden at anvende katalog-XOR —
 * det gør `catalog.validateSettledInput` i hydration/dispatch.
 */
export const parseCurrentEnvelope = (raw: string): SettledInput => {
  const parsed = currentInputEnvelopeSchema.parse(JSON.parse(raw));
  return cloneAndDeepFreeze(parsed.input) as SettledInput;
};
