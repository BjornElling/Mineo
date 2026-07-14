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

const entityPathSchema = z.array(fieldAddressPathSegmentSchema)
  .min(1, 'En entity-sti må ikke være tom')
  .refine(
    (path) => path.at(-1)?.kind === 'entity',
    'En entity-sti skal ende i en entity'
  )
  .readonly()
  .brand<'EntityPath'>();

export type EntityPath = z.infer<typeof entityPathSchema>;

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

type SerializedFieldAddressEnvelope = z.infer<typeof serializedFieldAddressEnvelopeSchema>;

const serializeCurrentFieldAddressEnvelope = (address: FieldAddress): string => JSON.stringify({
  version: FIELD_ADDRESS_VERSION,
  address: fieldAddressSchema.parse(address),
});

/** Current-formatet er kanonisk, så samme adresse aldrig kan eksistere under flere record-keys. */
const parseCurrentFieldAddressEnvelope = (value: string): SerializedFieldAddressEnvelope | null => {
  try {
    const parsed = serializedFieldAddressEnvelopeSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    return serializeCurrentFieldAddressEnvelope(parsed.data.address) === value ? parsed.data : null;
  } catch {
    return null;
  }
};

export const serializedFieldAddressSchema = z.string()
  .min(1)
  .refine((value) => parseCurrentFieldAddressEnvelope(value) !== null, 'Ugyldig serialiseret feltadresse')
  .brand<'SerializedFieldAddress'>();

export type SerializedFieldAddress = z.infer<typeof serializedFieldAddressSchema>;

export const createFieldAddress = (address: FieldAddress): FieldAddress => fieldAddressSchema.parse(address);

export const createCollectionRef = (collection: CollectionRef): CollectionRef => collectionRefSchema.parse(collection);

export const createEntityPath = (path: readonly FieldAddressPathSegment[]): EntityPath => entityPathSchema.parse(path);

export const serializeFieldAddress = (address: FieldAddress): SerializedFieldAddress => serializedFieldAddressSchema.parse(
  serializeCurrentFieldAddressEnvelope(address)
);

/** Decoder kun for det aktuelle, kanoniske adresseformat; legacyformater håndteres af migrationslaget. */
export const deserializeFieldAddress = (serialized: string): FieldAddress | null =>
  parseCurrentFieldAddressEnvelope(serialized)?.address ?? null;

export const fieldAddressesEqual = (left: FieldAddress, right: FieldAddress): boolean =>
  serializeFieldAddress(left) === serializeFieldAddress(right);

/**
 * Afgør om feltet ligger under en konkret entity. Det bruges af række- og entity-sletning,
 * så descendant-rejections kan fjernes i samme transaktion uden efterfølgende reconcile.
 */
export const isFieldAddressBelowEntity = (
  address: FieldAddress,
  section: FieldAddress['section'],
  entityPath: EntityPath
): boolean => {
  // Destruktive callsites må aldrig kunne bruge et tomt/property-only prefix og dermed ramme en hel sektion.
  const validatedEntityPath = entityPathSchema.parse(entityPath);
  if (address.section !== section || validatedEntityPath.length > address.path.length) return false;

  return validatedEntityPath.every((segment, index) => {
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
