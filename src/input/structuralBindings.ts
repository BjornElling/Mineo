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
  readCanonicalAtAddress,
  readEntitiesAtCollection,
  writeCanonicalAtAddress,
  writeEntitiesAtCollection,
} from './structuralCanonicalAccessors';

/**
 * Strukturelle bindingfactories: de udleder read/write mekanisk fra templaten via de generiske
 * accessorer, så en sektion registreres uden håndskrevne per-felt-lukninger. `createEmptySection`
 * er sektionens canonical tomme værdi og bruges kun, når et første commit lander i en tom sag.
 */

type EntityWithId = Readonly<{ [ENTITY_ID_PROPERTY]: string }>;

export const createStructuralFieldBinding = <T>(options: Readonly<{
  definition: FieldDefinition<T>;
  template: FieldAddressTemplate;
  createEmptySection: () => unknown;
}>): FieldBinding<T> => createFieldBinding<T>({
  definition: options.definition,
  template: options.template,
  readCanonical: (sections, address) => readCanonicalAtAddress(sections, address) as T,
  writeCanonical: (sections, address, value) =>
    writeCanonicalAtAddress(sections, address, value, options.createEmptySection),
});

export const createStructuralCollectionBinding = <TEntity extends EntityWithId>(options: Readonly<{
  template: CollectionRefTemplate;
  createEmptySection: () => unknown;
}>): CollectionBinding<TEntity> => createCollectionBinding<TEntity>({
  template: options.template,
  getEntityId: (entity) => entity[ENTITY_ID_PROPERTY],
  readEntities: (sections, collection) => readEntitiesAtCollection(sections, collection) as readonly TEntity[],
  writeEntities: (sections, collection, entities) =>
    writeEntitiesAtCollection(sections, collection, entities, options.createEmptySection),
});
