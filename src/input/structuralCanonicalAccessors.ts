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

/**
 * De fleste persisterede entities identificeres på `id` (jf. `entityId()`/`WithId` i schemas). Nogle
 * få samlinger bruger et andet id-egenskabsnavn (fx `sfggAnsaettelsesforhold` → `ansaettelsesforholdId`),
 * så accessoren slår id-egenskaben op per samlingsnavn via en {@link EntityIdPropertyResolver}.
 */
export const ENTITY_ID_PROPERTY = 'id';

/**
 * Afgør hvilken egenskab et entity-array identificeres på for et givet samlingsnavn. Default-resolveren
 * returnerer altid `'id'`; bindinger med afvigende id-egenskab leverer deres egen.
 */
export type EntityIdPropertyResolver = (collection: string) => string;

export const defaultEntityIdPropertyResolver: EntityIdPropertyResolver = () => ENTITY_ID_PROPERTY;

type MutableSection = Record<string, unknown>;

const isPlainObject = (value: unknown): value is MutableSection =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const findEntity = (
  container: unknown,
  collection: string,
  entityId: string,
  entityIdProperty: EntityIdPropertyResolver
): unknown => {
  if (!isPlainObject(container)) return undefined;
  const array = container[collection];
  if (!Array.isArray(array)) return undefined;
  const idProperty = entityIdProperty(collection);
  return array.find((entity) => isPlainObject(entity) && entity[idProperty] === entityId);
};

const descend = (
  container: unknown,
  segment: FieldAddressPathSegment,
  entityIdProperty: EntityIdPropertyResolver
): unknown =>
  segment.kind === 'property'
    ? (isPlainObject(container) ? container[segment.name] : undefined)
    : findEntity(container, segment.collection, segment.entityId, entityIdProperty);

const resolveContainer = (
  root: unknown,
  path: readonly FieldAddressPathSegment[],
  entityIdProperty: EntityIdPropertyResolver
): unknown => path.reduce<unknown>((container, segment) => descend(container, segment, entityIdProperty), root);

/**
 * Læser feltets canonical værdi. Modtageren fra `InputCatalog.readCanonical` er allerede et frosset
 * snapshot; funktionen muterer derfor intet og returnerer blot den navigerede værdi (eller `undefined`,
 * hvis en container mangler — fx et endnu ikke oprettet felt).
 */
export const readCanonicalAtAddress = (
  sections: ReadonlySections,
  address: FieldAddress,
  entityIdProperty: EntityIdPropertyResolver = defaultEntityIdPropertyResolver
): unknown => {
  const container = resolveContainer(
    (sections as Record<string, unknown>)[address.section],
    address.path,
    entityIdProperty
  );
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
  createEmptySection: () => unknown,
  entityIdProperty: EntityIdPropertyResolver = defaultEntityIdPropertyResolver
): PersistedInputSections => {
  const mutable = sections as MutableSection;
  const sectionValue = mutable[address.section] ?? createEmptySection();
  if (!isPlainObject(sectionValue)) {
    throw new Error('StructuralAccessor: sektionen kan ikke bære et felt (ikke et objekt)');
  }
  mutable[address.section] = sectionValue;

  const container = resolveContainer(sectionValue, address.path, entityIdProperty);
  if (!isPlainObject(container)) {
    throw new Error('StructuralAccessor: feltets container findes ikke i sektionen');
  }
  container[address.field] = value;
  return sections;
};

/** Læser en samlings entities read-only via samme navigation som feltaccessoren. */
export const readEntitiesAtCollection = (
  sections: ReadonlySections,
  collection: CollectionRef,
  entityIdProperty: EntityIdPropertyResolver = defaultEntityIdPropertyResolver
): readonly unknown[] => {
  const container = resolveContainer(
    (sections as Record<string, unknown>)[collection.section],
    collection.path,
    entityIdProperty
  );
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
  createEmptySection: () => unknown,
  entityIdProperty: EntityIdPropertyResolver = defaultEntityIdPropertyResolver
): PersistedInputSections => {
  const mutable = sections as MutableSection;
  const sectionValue = mutable[collection.section] ?? createEmptySection();
  if (!isPlainObject(sectionValue)) {
    throw new Error('StructuralAccessor: sektionen kan ikke bære en samling (ikke et objekt)');
  }
  mutable[collection.section] = sectionValue;

  const container = resolveContainer(sectionValue, collection.path, entityIdProperty);
  if (!isPlainObject(container)) {
    throw new Error('StructuralAccessor: samlingens container findes ikke i sektionen');
  }
  container[collection.collection] = [...entities];
  return sections;
};
