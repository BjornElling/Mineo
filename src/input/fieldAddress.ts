import { z } from 'zod';
import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';

export const FIELD_ADDRESS_VERSION = '1' as const;

const nonEmptyAddressPartSchema = z.string().min(1).refine(
  (value) => value.trim() === value,
  'Adresseled må ikke have indledende eller afsluttende mellemrum'
);

const persistedSectionSchema = z.enum(PERSISTED_SECTION_KEYS as [
  (typeof PERSISTED_SECTION_KEYS)[number],
  ...(typeof PERSISTED_SECTION_KEYS)[number][],
]);

export const fieldAddressPathSegmentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('property'),
    name: nonEmptyAddressPartSchema,
  }).strict().readonly(),
  z.object({
    kind: z.literal('entity'),
    collection: nonEmptyAddressPartSchema,
    entityId: nonEmptyAddressPartSchema,
  }).strict().readonly(),
]);

export const fieldAddressSchema = z.object({
  section: persistedSectionSchema,
  path: z.array(fieldAddressPathSegmentSchema).readonly(),
  field: nonEmptyAddressPartSchema,
}).strict().readonly();

export type FieldAddressPathSegment = z.infer<typeof fieldAddressPathSegmentSchema>;
export type FieldAddress = z.infer<typeof fieldAddressSchema>;

export const collectionRefSchema = z.object({
  section: persistedSectionSchema,
  path: z.array(fieldAddressPathSegmentSchema).readonly(),
  collection: nonEmptyAddressPartSchema,
}).strict().readonly();

export type CollectionRef = z.infer<typeof collectionRefSchema>;

const serializedFieldAddressEnvelopeSchema = z.object({
  version: z.literal(FIELD_ADDRESS_VERSION),
  address: fieldAddressSchema,
}).strict().readonly();

const isSerializedFieldAddress = (value: string): boolean => {
  try {
    return serializedFieldAddressEnvelopeSchema.safeParse(JSON.parse(value)).success;
  } catch {
    return false;
  }
};

export const serializedFieldAddressSchema = z.string()
  .min(1)
  .refine(isSerializedFieldAddress, 'Ugyldig serialiseret feltadresse')
  .brand<'SerializedFieldAddress'>();

export type SerializedFieldAddress = z.infer<typeof serializedFieldAddressSchema>;

export const createFieldAddress = (address: FieldAddress): FieldAddress => fieldAddressSchema.parse(address);

export const createCollectionRef = (collection: CollectionRef): CollectionRef => collectionRefSchema.parse(collection);

export const serializeFieldAddress = (address: FieldAddress): SerializedFieldAddress => serializedFieldAddressSchema.parse(
  JSON.stringify({
    version: FIELD_ADDRESS_VERSION,
    address: fieldAddressSchema.parse(address),
  })
);

export const deserializeFieldAddress = (serialized: string): FieldAddress | null => {
  try {
    const parsed = serializedFieldAddressEnvelopeSchema.safeParse(JSON.parse(serialized));
    return parsed.success ? parsed.data.address : null;
  } catch {
    return null;
  }
};

export const fieldAddressesEqual = (left: FieldAddress, right: FieldAddress): boolean =>
  serializeFieldAddress(left) === serializeFieldAddress(right);

/**
 * Afgør om feltet ligger under en konkret entity. Det bruges af række- og entity-sletning,
 * så descendant-rejections kan fjernes i samme transaktion uden efterfølgende reconcile.
 */
export const isFieldAddressBelowEntity = (
  address: FieldAddress,
  section: FieldAddress['section'],
  entityPath: readonly FieldAddressPathSegment[]
): boolean => {
  if (address.section !== section || entityPath.length > address.path.length) return false;

  return entityPath.every((segment, index) => {
    const candidate = address.path[index];
    if (candidate?.kind !== segment.kind) return false;
    if (segment.kind === 'property') {
      return candidate.kind === 'property' && candidate.name === segment.name;
    }
    return candidate.kind === 'entity'
      && candidate.collection === segment.collection
      && candidate.entityId === segment.entityId;
  });
};
