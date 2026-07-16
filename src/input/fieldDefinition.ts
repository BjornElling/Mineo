import { z } from 'zod';
import { createFieldAddress, type FieldAddress } from './fieldAddress';

export type FieldResolution<T> =
  | Readonly<{ status: 'valid'; value: T }>
  | Readonly<{ status: 'invalid' }>;

export type FieldCodec<T> = Readonly<{
  parseForSettle: (raw: string) => FieldResolution<T>;
  format: (value: T) => string;
  formatForEdit: (value: T) => string;
  acceptsInitialKey: (key: string) => boolean;
  normalizePaste?: (raw: string) => string;
}>;

export type FieldControlKind = 'text' | 'choice' | 'toggle';

export type FieldDefinitionBase = Readonly<{
  label: string;
  controlKind: FieldControlKind;
}>;

export type FieldDefinitionConfig<T> = FieldDefinitionBase & Readonly<{
  codec: FieldCodec<T>;
}>;

const FIELD_DEFINITION: unique symbol = Symbol('FieldDefinition');

export type FieldDefinition<T> = FieldDefinitionBase & Readonly<{
  codec: FieldCodec<T>;
  // Factory-brandet gør codec- og metadatavalidering obligatorisk ved almindelig typed konstruktion.
  [FIELD_DEFINITION]: true;
}>;

export type FieldRefBase = Readonly<{
  address: FieldAddress;
  definition: FieldDefinitionBase;
}>;

export type FieldRef<T> = Readonly<{
  address: FieldAddress;
  definition: FieldDefinition<T>;
}>;

const nonBlankMetadataSchema = z.string()
  .min(1, 'Feltmetadata må ikke være tom')
  .refine((value) => value.trim() === value, 'Feltmetadata må ikke have indledende eller afsluttende mellemrum');

const fieldDefinitionMetadataSchema = z.object({
  label: nonBlankMetadataSchema,
  controlKind: z.enum(['text', 'choice', 'toggle']),
}).strict().readonly();

export const defineField = <T>(definition: FieldDefinitionConfig<T>): FieldDefinition<T> => {
  const metadata = fieldDefinitionMetadataSchema.parse({
    label: definition.label,
    controlKind: definition.controlKind,
  });
  const codecFunctions: ReadonlyArray<readonly [string, unknown]> = [
    ['parseForSettle', definition.codec.parseForSettle],
    ['format', definition.codec.format],
    ['formatForEdit', definition.codec.formatForEdit],
    ['acceptsInitialKey', definition.codec.acceptsInitialKey],
    ['normalizePaste', definition.codec.normalizePaste ?? null],
  ];
  for (const [name, candidate] of codecFunctions) {
    if (candidate !== null && typeof candidate !== 'function') {
      throw new Error(`FieldDefinition: codec.${name} skal være en funktion`);
    }
  }
  const codec = Object.freeze({ ...definition.codec });

  return Object.freeze({
    ...metadata,
    codec,
    [FIELD_DEFINITION]: true,
  }) as FieldDefinition<T>;
};

export const bindField = <T>(definition: FieldDefinition<T>, address: FieldAddress): FieldRef<T> => {
  if (definition[FIELD_DEFINITION] !== true) {
    throw new Error('FieldDefinition: feltdefinitionen er ikke oprettet med defineField');
  }
  return Object.freeze({
    address: createFieldAddress(address),
    definition,
  });
};

export const toFieldRefBase = <T>(field: FieldRef<T>): FieldRefBase => field;
