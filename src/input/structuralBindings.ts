import {
  createCollectionBinding,
  createFieldBinding,
  type CollectionBinding,
  type CollectionRefTemplate,
  type FieldAddressTemplate,
  type FieldBinding,
} from './fieldCatalog';
import type { FieldDefinition } from './fieldDefinition';
import {
  ENTITY_ID_PROPERTY,
  defaultEntityIdPropertyResolver,
  readCanonicalAtAddress,
  readEntitiesAtCollection,
  writeCanonicalAtAddress,
  writeEntitiesAtCollection,
  type EntityIdPropertyResolver,
} from './structuralCanonicalAccessors';

/**
 * Strukturelle bindingfactories: de udleder read/write mekanisk fra templaten via de generiske
 * accessorer, så en sektion registreres uden håndskrevne per-felt-lukninger. `createEmptySection`
 * er sektionens canonical tomme værdi og bruges kun, når et første commit lander i en tom sag.
 *
 * De fleste samlinger identificeres på `id`. Bruger en samling et andet id-egenskabsnavn (fx
 * `sfggAnsaettelsesforhold` → `ansaettelsesforholdId`), leveres et `entityIdProperties`-map
 * (samlingsnavn → id-egenskab). Det threades ind i BÅDE `getEntityId` og de strukturelle accessorer,
 * så en rækkefeltadresses entity-led resolver på den rigtige egenskab.
 */

/** Map fra samlingsnavn til den egenskab, samlingens entities identificeres på. */
export type EntityIdProperties = Readonly<Record<string, string>>;

const makeResolver = (entityIdProperties: EntityIdProperties | undefined): EntityIdPropertyResolver => {
  if (entityIdProperties === undefined) return defaultEntityIdPropertyResolver;
  return (collection) => entityIdProperties[collection] ?? ENTITY_ID_PROPERTY;
};

export const createStructuralFieldBinding = <T>(options: Readonly<{
  definition: FieldDefinition<T>;
  template: FieldAddressTemplate;
  createEmptySection: () => unknown;
  entityIdProperties?: EntityIdProperties;
}>): FieldBinding<T> => {
  const resolver = makeResolver(options.entityIdProperties);
  return createFieldBinding<T>({
    definition: options.definition,
    template: options.template,
    readCanonical: (sections, address) => readCanonicalAtAddress(sections, address, resolver) as T,
    writeCanonical: (sections, address, value) =>
      writeCanonicalAtAddress(sections, address, value, options.createEmptySection, resolver),
  });
};

export const createStructuralCollectionBinding = <TEntity extends Readonly<Record<string, unknown>>>(options: Readonly<{
  template: CollectionRefTemplate;
  createEmptySection: () => unknown;
  /**
   * Egenskaben, denne samlings entities identificeres på. Default: `id`. Sættes fx til
   * `ansaettelsesforholdId` for `sfggAnsaettelsesforhold`.
   */
  entityIdProperty?: string;
  /** Id-egenskaber for eventuelle parent-samlinger i templatens sti (nested samlinger). */
  parentEntityIdProperties?: EntityIdProperties;
}>): CollectionBinding<TEntity> => {
  const idProperty = options.entityIdProperty ?? ENTITY_ID_PROPERTY;
  const resolver = makeResolver({
    ...options.parentEntityIdProperties,
    [options.template.collection]: idProperty,
  });
  return createCollectionBinding<TEntity>({
    template: options.template,
    getEntityId: (entity) => {
      const id = entity[idProperty];
      if (typeof id !== 'string') {
        throw new Error(`StructuralCollectionBinding: entity mangler streng-id på egenskaben "${idProperty}"`);
      }
      return id;
    },
    readEntities: (sections, collection) =>
      readEntitiesAtCollection(sections, collection, resolver) as readonly TEntity[],
    writeEntities: (sections, collection, entities) =>
      writeEntitiesAtCollection(sections, collection, entities, options.createEmptySection, resolver),
  });
};
