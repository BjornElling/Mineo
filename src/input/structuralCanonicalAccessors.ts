import type { DeepReadonly } from '../utils/deepFreeze';
import type {
  CollectionRef,
  FieldAddress,
  FieldAddressPathSegment,
} from './fieldAddress';
import type { PersistedInputSections } from './inputState';

/** Læse-accessorer kaldes med et frosset snapshot; skrive-accessorer med en muterbar klon. */
type ReadonlySections = DeepReadonly<PersistedInputSections>;

/**
 * Generiske strukturelle accessorer, der navigerer en {@link FieldAddress}/{@link CollectionRef}
 * direkte over det almindelige sektionsobjekt. De gør feltbindinger mekaniske: en binding behøver
 * ikke længere en håndskrevet read/write-lukning per felt, kun sin strukturelle template.
 *
 * Adressen ER den kanoniske sti: `property`-led er objektnøgler, `entity`-led er et array-opslag på
 * `id`. Det er samme struktur, som serialiseringen allerede håndhæver, så der findes ét sandt sted
 * for "hvor i sektionen ligger dette felt".
 */

/** Persisterede entities identificeres altid på `id` (jf. `entityId()`/`WithId` i schemas). */
export const ENTITY_ID_PROPERTY = 'id';

type MutableSection = Record<string, unknown>;

const isPlainObject = (value: unknown): value is MutableSection =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const findEntity = (container: unknown, collection: string, entityId: string): unknown => {
  if (!isPlainObject(container)) return undefined;
  const array = container[collection];
  if (!Array.isArray(array)) return undefined;
  return array.find((entity) => isPlainObject(entity) && entity[ENTITY_ID_PROPERTY] === entityId);
};

const descend = (container: unknown, segment: FieldAddressPathSegment): unknown =>
  segment.kind === 'property'
    ? (isPlainObject(container) ? container[segment.name] : undefined)
    : findEntity(container, segment.collection, segment.entityId);

const resolveContainer = (
  root: unknown,
  path: readonly FieldAddressPathSegment[]
): unknown => path.reduce<unknown>((container, segment) => descend(container, segment), root);

/**
 * Læser feltets canonical værdi. Modtageren fra `InputCatalog.readCanonical` er allerede et frosset
 * snapshot; funktionen muterer derfor intet og returnerer blot den navigerede værdi (eller `undefined`,
 * hvis en container mangler — fx et endnu ikke oprettet felt).
 */
export const readCanonicalAtAddress = (
  sections: ReadonlySections,
  address: FieldAddress
): unknown => {
  const container = resolveContainer((sections as Record<string, unknown>)[address.section], address.path);
  return isPlainObject(container) ? container[address.field] : undefined;
};

/**
 * Muterer den allerede klonede `sections` (kontrakten fra `InputCatalog.writeCanonical`) in place og
 * returnerer den. En manglende sektion oprettes fra `createEmptySection`, så et enkeltfelt-commit kan
 * lande i en tom sag uden at kalderen skal genskabe hele sektionen. Manglende property-containere er
 * en katalog-/schemafejl og fejler fail-closed frem for at opdigte en delvis struktur.
 */
export const writeCanonicalAtAddress = (
  sections: PersistedInputSections,
  address: FieldAddress,
  value: unknown,
  createEmptySection: () => unknown
): PersistedInputSections => {
  const mutable = sections as MutableSection;
  const sectionValue = mutable[address.section] ?? createEmptySection();
  if (!isPlainObject(sectionValue)) {
    throw new Error('StructuralAccessor: sektionen kan ikke bære et felt (ikke et objekt)');
  }
  mutable[address.section] = sectionValue;

  const container = resolveContainer(sectionValue, address.path);
  if (!isPlainObject(container)) {
    throw new Error('StructuralAccessor: feltets container findes ikke i sektionen');
  }
  container[address.field] = value;
  return sections;
};

/** Læser en samlings entities read-only via samme navigation som feltaccessoren. */
export const readEntitiesAtCollection = (
  sections: ReadonlySections,
  collection: CollectionRef
): readonly unknown[] => {
  const container = resolveContainer((sections as Record<string, unknown>)[collection.section], collection.path);
  if (!isPlainObject(container)) return [];
  const array = container[collection.collection];
  return Array.isArray(array) ? array : [];
};

/**
 * Skriver en samlings entities in place i den klonede `sections`. Sektionen oprettes fra
 * `createEmptySection`, hvis den mangler, så en første indsættelse kan oprette både sektion og samling.
 */
export const writeEntitiesAtCollection = (
  sections: PersistedInputSections,
  collection: CollectionRef,
  entities: readonly unknown[],
  createEmptySection: () => unknown
): PersistedInputSections => {
  const mutable = sections as MutableSection;
  const sectionValue = mutable[collection.section] ?? createEmptySection();
  if (!isPlainObject(sectionValue)) {
    throw new Error('StructuralAccessor: sektionen kan ikke bære en samling (ikke et objekt)');
  }
  mutable[collection.section] = sectionValue;

  const container = resolveContainer(sectionValue, collection.path);
  if (!isPlainObject(container)) {
    throw new Error('StructuralAccessor: samlingens container findes ikke i sektionen');
  }
  container[collection.collection] = [...entities];
  return sections;
};
