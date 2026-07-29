import type {
  CollectionRef,
  FieldAddress,
  FieldAddressPathSegment,
  SectionKey,
} from './fieldAddress';
import type { PersistedInputSections } from './settledInput';

// Inputkernen (§3.2): generiske strukturelle accessorer, der navigerer en FieldAddress/CollectionRef
// direkte over det almindelige sektionsobjekt. De gør descriptor-katalogets read/write mekaniske — en
// descriptor behøver ikke en håndskrevet per-felt-lukning, kun sin strukturelle template.
//
// Adressen ER den kanoniske sti: `property`-led er objektnøgler, `entity`-led er et array-opslag på
// entity-id-egenskaben. Det er samme struktur, som serialiseringen håndhæver, så der findes ét sandt sted
// for "hvor i sektionen ligger dette felt". `PersistedInputSections` tillader `null` pr. sektion (endnu
// ikke oprettet); en `null`/manglende container behandles som en manglende værdi ved læsning.

/**
 * De fleste persisterede entities identificeres på `id`. Nogle få samlinger bruger et andet
 * id-egenskabsnavn (fx `sfggAnsaettelsesforhold` → `ansaettelsesforholdId`), så accessoren slår
 * id-egenskaben op per samlingsnavn via en {@link EntityIdPropertyResolver}.
 */
export const ENTITY_ID_PROPERTY = 'id';

export type EntityIdPropertyResolver = (collection: string) => string;

export const defaultEntityIdPropertyResolver: EntityIdPropertyResolver = () => ENTITY_ID_PROPERTY;

type MutableSection = Record<string, unknown>;

const isPlainObject = (value: unknown): value is MutableSection =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const findEntity = (
  container: unknown,
  collection: string,
  entityId: string,
  resolver: EntityIdPropertyResolver
): unknown => {
  if (!isPlainObject(container)) return undefined;
  const array = container[collection];
  if (!Array.isArray(array)) return undefined;
  const idProperty = resolver(collection);
  return array.find((entity) => isPlainObject(entity) && entity[idProperty] === entityId);
};

const descend = (
  container: unknown,
  segment: FieldAddressPathSegment,
  resolver: EntityIdPropertyResolver
): unknown =>
  segment.kind === 'property'
    ? (isPlainObject(container) ? container[segment.name] : undefined)
    : findEntity(container, segment.collection, segment.entityId, resolver);

const resolveContainer = (
  root: unknown,
  path: readonly FieldAddressPathSegment[],
  resolver: EntityIdPropertyResolver
): unknown => path.reduce<unknown>((container, segment) => descend(container, segment, resolver), root);

const sectionRoot = (sections: PersistedInputSections, section: SectionKey): unknown =>
  (sections as Record<string, unknown>)[section] ?? undefined;

/**
 * Læser feltets canonical værdi. Snapshottet er allerede isoleret af kataloget; funktionen muterer intet og
 * returnerer den navigerede værdi (eller `undefined`, hvis en container mangler — fx et endnu ikke oprettet felt).
 */
export const readCanonicalAtAddress = (
  sections: PersistedInputSections,
  address: FieldAddress,
  resolver: EntityIdPropertyResolver = defaultEntityIdPropertyResolver
): unknown => {
  const container = resolveContainer(sectionRoot(sections, address.section), address.path, resolver);
  return isPlainObject(container) ? container[address.field] : undefined;
};

/**
 * Muterer den allerede klonede `sections` in place og returnerer den. En manglende/`null` sektion oprettes
 * fra `createEmptySection`, så et enkeltfelt-commit kan lande i en tom sag. Manglende property-containere er
 * en katalog-/schemafejl og fejler fail-closed frem for at opdigte en delvis struktur.
 */
export const writeCanonicalAtAddress = (
  sections: PersistedInputSections,
  address: FieldAddress,
  value: unknown,
  createEmptySection: () => unknown,
  resolver: EntityIdPropertyResolver = defaultEntityIdPropertyResolver
): PersistedInputSections => {
  const mutable = sections as MutableSection;
  const sectionValue = mutable[address.section] ?? createEmptySection();
  if (!isPlainObject(sectionValue)) {
    throw new Error('StructuralAccessor: sektionen kan ikke bære et felt (ikke et objekt)');
  }
  mutable[address.section] = sectionValue;

  const container = resolveContainer(sectionValue, address.path, resolver);
  if (!isPlainObject(container)) {
    throw new Error('StructuralAccessor: feltets container findes ikke i sektionen');
  }
  container[address.field] = value;
  return sections;
};

/** Læser en samlings entities read-only via samme navigation som feltaccessoren. */
export const readEntitiesAtCollection = (
  sections: PersistedInputSections,
  collection: CollectionRef,
  resolver: EntityIdPropertyResolver = defaultEntityIdPropertyResolver
): readonly unknown[] => {
  const container = resolveContainer(sectionRoot(sections, collection.section), collection.path, resolver);
  if (!isPlainObject(container)) return [];
  const array = container[collection.collection];
  return Array.isArray(array) ? array : [];
};

/**
 * Skriver en samlings entities in place i den klonede `sections`. Sektionen oprettes fra `createEmptySection`,
 * hvis den mangler/er `null`, så en første indsættelse kan oprette både sektion og samling.
 */
export const writeEntitiesAtCollection = (
  sections: PersistedInputSections,
  collection: CollectionRef,
  entities: readonly unknown[],
  createEmptySection: () => unknown,
  resolver: EntityIdPropertyResolver = defaultEntityIdPropertyResolver
): PersistedInputSections => {
  const mutable = sections as MutableSection;
  const sectionValue = mutable[collection.section] ?? createEmptySection();
  if (!isPlainObject(sectionValue)) {
    throw new Error('StructuralAccessor: sektionen kan ikke bære en samling (ikke et objekt)');
  }
  mutable[collection.section] = sectionValue;

  const container = resolveContainer(sectionValue, collection.path, resolver);
  if (!isPlainObject(container)) {
    throw new Error('StructuralAccessor: samlingens container findes ikke i sektionen');
  }
  container[collection.collection] = [...entities];
  return sections;
};

/** Bygger en resolver fra et samlingsnavn→id-egenskab-map (default `id` for ukendte samlinger). */
export const makeEntityIdResolver = (
  entityIdProperties: Readonly<Record<string, string>> | undefined
): EntityIdPropertyResolver => {
  if (entityIdProperties === undefined) return defaultEntityIdPropertyResolver;
  return (collection) => entityIdProperties[collection] ?? ENTITY_ID_PROPERTY;
};
