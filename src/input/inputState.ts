import { z } from 'zod';
import { persistenceSchemas } from '../config/persistenceRegistry';
import { cloneAndDeepFreeze } from '../utils/deepFreeze';
import {
  deserializeFieldAddress,
  serializedFieldAddressSchema,
} from './fieldAddress';
import type { InputCatalog } from './fieldCatalog';

const nullablePersistenceSchemas = Object.fromEntries(
  Object.entries(persistenceSchemas).map(([section, schema]) => [section, schema.nullable()])
) as {
  [K in keyof typeof persistenceSchemas]: z.ZodNullable<(typeof persistenceSchemas)[K]>;
};

export const persistedInputSectionsSchema = z.object(nullablePersistenceSchemas).strict().readonly();

export const rejectedInputSchema = z.object({
  raw: z.string().min(1, 'Rejected input må ikke være tomt'),
}).strict().readonly();

export const rejectedInputsSchema = z.record(serializedFieldAddressSchema, rejectedInputSchema).readonly();

const persistedInputStateBaseSchema = z.object({
  sections: persistedInputSectionsSchema,
  rejectedInputs: rejectedInputsSchema,
}).strict().readonly();

export type PersistedInputSections = z.infer<typeof persistedInputSectionsSchema>;
export type RejectedInput = z.infer<typeof rejectedInputSchema>;
export type RejectedInputs = z.infer<typeof rejectedInputsSchema>;
export type PersistedInputStateCandidate = z.input<typeof persistedInputStateBaseSchema>;

declare const VALIDATED_INPUT_STATE: unique symbol;
export type PersistedInputState = z.output<typeof persistedInputStateBaseSchema> & Readonly<{
  [VALIDATED_INPUT_STATE]: true;
}>;

/**
 * Current-state-schemaet bindes til ét forseglet katalog. Dermed kan callers ikke godkende
 * adresser med en parallel predicate, og både canonical entities og rejections valideres samlet.
 */
export const createPersistedInputStateSchema = (catalog: InputCatalog): z.ZodType<PersistedInputState> => {
  if (!catalog.isSealed) throw new Error('PersistedInputState: kataloget skal være forseglet');

  return persistedInputStateBaseSchema
    .superRefine((input, context) => {
      try {
        catalog.validateCollections(input.sections);
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: ['sections'],
          message: error instanceof Error ? error.message : 'Canonical collections er ugyldige',
        });
      }

      for (const serializedAddress of Object.keys(input.rejectedInputs)) {
        const address = deserializeFieldAddress(serializedAddress);
        if (address === null || !catalog.isKnownAddress(address) || !catalog.containsAddressEntities(input.sections, address)) {
          context.addIssue({
            code: 'custom',
            path: ['rejectedInputs', serializedAddress],
            message: 'Feltadressen findes ikke i det aktuelle inputkatalog',
          });
        }
      }
    })
    .transform((input) => cloneAndDeepFreeze(input) as PersistedInputState) as z.ZodType<PersistedInputState>;
};

export const createEmptyPersistedInputSections = (): PersistedInputSections =>
  persistedInputSectionsSchema.parse(
    Object.fromEntries(Object.keys(persistenceSchemas).map((section) => [section, null]))
  );
