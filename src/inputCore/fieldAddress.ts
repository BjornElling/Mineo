import { z } from 'zod';
import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';

// Inputkernen (§3.2): en feltadresse er REN struktur — sektion, properties, stabile entity-id'er og
// feltnavn. Den indeholder aldrig kolonneindeks, DOM-id, route eller formatteret string-key, og har
// bevidst INGEN versions-envelope (§3.7: sessionen har ingen `fieldAddressVersion`-bro).

const addressPartSchema = z.string().min(1).refine(
  (value) => value.trim() === value,
  'Adresseled må ikke have indledende eller afsluttende mellemrum'
);

const sectionSchema = z.enum(PERSISTED_SECTION_KEYS as [
  (typeof PERSISTED_SECTION_KEYS)[number],
  ...(typeof PERSISTED_SECTION_KEYS)[number][],
]);

export type SectionKey = z.infer<typeof sectionSchema>;

export const fieldAddressPathSegmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('property'), name: addressPartSchema }).strict().readonly(),
  z.object({
    kind: z.literal('entity'),
    collection: addressPartSchema,
    entityId: addressPartSchema,
  }).strict().readonly(),
]);

export type FieldAddressPathSegment = z.infer<typeof fieldAddressPathSegmentSchema>;

export const fieldAddressSchema = z.object({
  section: sectionSchema,
  path: z.array(fieldAddressPathSegmentSchema).readonly(),
  field: addressPartSchema,
}).strict().readonly();

export type FieldAddress = z.infer<typeof fieldAddressSchema>;

export const collectionRefSchema = z.object({
  section: sectionSchema,
  path: z.array(fieldAddressPathSegmentSchema).readonly(),
  collection: addressPartSchema,
}).strict().readonly();

export type CollectionRef = z.infer<typeof collectionRefSchema>;

const entityPathSchema = z.array(fieldAddressPathSegmentSchema)
  .min(1, 'En entity-sti må ikke være tom')
  .refine((path) => path.at(-1)?.kind === 'entity', 'En entity-sti skal ende i en entity')
  .readonly()
  .brand<'EntityPath'>();

export type EntityPath = z.infer<typeof entityPathSchema>;

// Kanonisk serialisering: samme adresse giver altid samme nøgle, så en rejected-adresse aldrig kan
// eksistere under to record-keys. JSON.stringify på det parsede objekt er kanonisk fordi Zod-parsing
// giver stabil nøglerækkefølge for det strikte skema.
export const serializedFieldAddressSchema = z.string()
  .min(1)
  .refine((value) => deserializeFieldAddress(value) !== null, 'Ugyldig serialiseret feltadresse')
  .brand<'SerializedFieldAddress'>();

export type SerializedFieldAddress = z.infer<typeof serializedFieldAddressSchema>;

export const createFieldAddress = (address: FieldAddress): FieldAddress => fieldAddressSchema.parse(address);

export const createCollectionRef = (collection: CollectionRef): CollectionRef =>
  collectionRefSchema.parse(collection);

export const createEntityPath = (path: readonly FieldAddressPathSegment[]): EntityPath =>
  entityPathSchema.parse(path);

const canonicalSerialize = (address: FieldAddress): string => JSON.stringify({
  section: address.section,
  path: address.path.map((segment) => segment.kind === 'property'
    ? { kind: 'property', name: segment.name }
    : { kind: 'entity', collection: segment.collection, entityId: segment.entityId }),
  field: address.field,
});

export const serializeFieldAddress = (address: FieldAddress): SerializedFieldAddress =>
  canonicalSerialize(fieldAddressSchema.parse(address)) as SerializedFieldAddress;

/** Kun det aktuelle kanoniske format dekodes; round-trip-kravet afviser enhver ikke-kanonisk repræsentation. */
export const deserializeFieldAddress = (serialized: string): FieldAddress | null => {
  try {
    const parsed = fieldAddressSchema.safeParse(JSON.parse(serialized));
    if (!parsed.success) return null;
    return canonicalSerialize(parsed.data) === serialized ? parsed.data : null;
  } catch {
    return null;
  }
};

export const fieldAddressesEqual = (left: FieldAddress, right: FieldAddress): boolean =>
  serializeFieldAddress(left) === serializeFieldAddress(right);

/**
 * Afgør om feltet ligger under en konkret entity. Bruges af række-/entity-sletning, så descendant-rejections
 * fjernes i samme reducertrin uden efterfølgende reconcile (§3.8).
 */
export const isFieldAddressBelowEntity = (
  address: FieldAddress,
  section: SectionKey,
  entityPath: EntityPath
): boolean => {
  const validated = entityPathSchema.parse(entityPath);
  if (address.section !== section || validated.length > address.path.length) return false;
  return validated.every((segment, index) => {
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
