import { z } from 'zod';
import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import { cloneAndDeepFreeze, type DeepReadonly } from '../utils/deepFreeze';
import type { PersistedInputSections } from './inputState';
import {
  createCollectionRef,
  createFieldAddress,
  type CollectionRef,
  type FieldAddress,
} from './fieldAddress';
import { bindField, type FieldDefinition, type FieldDefinitionBase, type FieldRef } from './fieldDefinition';

const templatePartSchema = z.string().min(1).refine(
  (value) => value.trim() === value,
  'Feltkatalogets adresseled må ikke have indledende eller afsluttende mellemrum'
);

const templateSectionSchema = z.enum(PERSISTED_SECTION_KEYS as [
  (typeof PERSISTED_SECTION_KEYS)[number],
  ...(typeof PERSISTED_SECTION_KEYS)[number][],
]);

export const fieldAddressTemplatePathSegmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('property'), name: templatePartSchema }).strict().readonly(),
  z.object({ kind: z.literal('entity'), collection: templatePartSchema }).strict().readonly(),
]);

export const fieldAddressTemplateSchema = z.object({
  section: templateSectionSchema,
  path: z.array(fieldAddressTemplatePathSegmentSchema).readonly(),
  field: templatePartSchema,
}).strict().readonly();

export type FieldAddressTemplate = z.infer<typeof fieldAddressTemplateSchema>;

export const collectionRefTemplateSchema = z.object({
  section: templateSectionSchema,
  path: z.array(fieldAddressTemplatePathSegmentSchema).readonly(),
  collection: templatePartSchema,
}).strict().readonly();

export type CollectionRefTemplate = z.infer<typeof collectionRefTemplateSchema>;

type ReadCanonicalField<T> = (
  sections: DeepReadonly<PersistedInputSections>,
  address: FieldAddress
) => T;

type WriteCanonicalField<T> = (
  sections: PersistedInputSections,
  address: FieldAddress,
  value: T
) => PersistedInputSections;

const FIELD_REGISTRATION: unique symbol = Symbol('fieldRegistration');
const COLLECTION_REGISTRATION: unique symbol = Symbol('collectionRegistration');

export type FieldBinding<T> = Readonly<{
  definition: FieldDefinition<T>;
  template: FieldAddressTemplate;
  createRef: (...entityIds: readonly string[]) => FieldRef<T>;
  [FIELD_REGISTRATION]: Readonly<{
    readCanonical: ReadCanonicalField<T>;
    writeCanonical: WriteCanonicalField<T>;
  }>;
}>;

type RegisteredField = Readonly<{
  definition: FieldDefinitionBase;
  readCanonical: (sections: DeepReadonly<PersistedInputSections>, address: FieldAddress) => unknown;
  writeCanonical: (
    sections: PersistedInputSections,
    address: FieldAddress,
    value: unknown
  ) => PersistedInputSections;
}>;

type ReadEntities<TEntity> = (
  sections: DeepReadonly<PersistedInputSections>,
  collection: CollectionRef
) => readonly TEntity[];

type WriteEntities<TEntity> = (
  sections: PersistedInputSections,
  collection: CollectionRef,
  entities: readonly TEntity[]
) => PersistedInputSections;

export type CollectionBinding<TEntity> = Readonly<{
  template: CollectionRefTemplate;
  createRef: (...parentEntityIds: readonly string[]) => CollectionRef;
  [COLLECTION_REGISTRATION]: Readonly<{
    getEntityId: (entity: TEntity) => string;
    readEntities: ReadEntities<TEntity>;
    writeEntities: WriteEntities<TEntity>;
  }>;
}>;

type RegisteredCollection = Readonly<{
  binding: CollectionBinding<unknown>;
  getEntityId: (entity: unknown) => string;
  readEntities: ReadEntities<unknown>;
  writeEntities: WriteEntities<unknown>;
}>;

type InputSectionsSnapshot = DeepReadonly<PersistedInputSections>;

const templateKey = (template: FieldAddressTemplate | CollectionRefTemplate): string => JSON.stringify(template);

const addressTemplate = (address: FieldAddress): FieldAddressTemplate => fieldAddressTemplateSchema.parse({
  section: address.section,
  path: address.path.map((segment) => segment.kind === 'property'
    ? segment
    : { kind: 'entity', collection: segment.collection }),
  field: address.field,
});

const collectionTemplate = (collection: CollectionRef): CollectionRefTemplate => collectionRefTemplateSchema.parse({
  section: collection.section,
  path: collection.path.map((segment) => segment.kind === 'property'
    ? segment
    : { kind: 'entity', collection: segment.collection }),
  collection: collection.collection,
});

const bindTemplatePath = (
  path: FieldAddressTemplate['path'],
  entityIds: readonly string[],
  errorPrefix: string
): FieldAddress['path'] => {
  const entityCount = path.filter((segment) => segment.kind === 'entity').length;
  if (entityIds.length !== entityCount) {
    throw new Error(`${errorPrefix}: forventede ${entityCount} entity-id'er, modtog ${entityIds.length}`);
  }

  let entityIndex = 0;
  return path.map((segment) => {
    if (segment.kind === 'property') return segment;
    const entityId = entityIds[entityIndex];
    entityIndex += 1;
    return { kind: 'entity' as const, collection: segment.collection, entityId };
  });
};

export const createFieldBinding = <T>(options: Readonly<{
  definition: FieldDefinition<T>;
  template: FieldAddressTemplate;
  readCanonical: ReadCanonicalField<T>;
  writeCanonical: WriteCanonicalField<T>;
}>): FieldBinding<T> => {
  const template = fieldAddressTemplateSchema.parse(options.template);

  return Object.freeze({
    definition: options.definition,
    template,
    [FIELD_REGISTRATION]: Object.freeze({
      readCanonical: options.readCanonical,
      writeCanonical: options.writeCanonical,
    }),
    createRef: (...entityIds: readonly string[]) => bindField(options.definition, createFieldAddress({
      section: template.section,
      path: bindTemplatePath(template.path, entityIds, 'FieldBinding'),
      field: template.field,
    })),
  });
};

export const createCollectionBinding = <TEntity>(options: Readonly<{
  template: CollectionRefTemplate;
  getEntityId: (entity: TEntity) => string;
  readEntities: ReadEntities<TEntity>;
  writeEntities: WriteEntities<TEntity>;
}>): CollectionBinding<TEntity> => {
  const template = collectionRefTemplateSchema.parse(options.template);
  return Object.freeze({
    template,
    [COLLECTION_REGISTRATION]: Object.freeze({
      getEntityId: options.getEntityId,
      readEntities: options.readEntities,
      writeEntities: options.writeEntities,
    }),
    createRef: (...parentEntityIds: readonly string[]) => createCollectionRef({
      section: template.section,
      path: bindTemplatePath(template.path, parentEntityIds, 'CollectionBinding'),
      collection: template.collection,
    }),
  });
};

const assertEntityIds = (ids: readonly string[]): void => {
  if (ids.some((id) => id === '' || id.trim() !== id) || new Set(ids).size !== ids.length) {
    throw new Error('InputCatalog: entity-id’er skal være ikke-tomme, trimmede og unikke');
  }
};

/**
 * Eneste katalogautoritet for persisted felter og samlinger. Kataloget bygges ved bootstrap og
 * forsegles før state kan valideres eller læses, så samme revision aldrig skifter semantik.
 */
export class InputCatalog {
  readonly #fields = new Map<string, RegisteredField>();
  readonly #collections = new Map<string, RegisteredCollection>();
  #sealed = false;

  registerField<T>(binding: FieldBinding<T>): void {
    this.#assertOpen();
    const key = templateKey(binding.template);
    if (this.#fields.has(key)) throw new Error('InputCatalog: feltadressen er allerede registreret');

    this.#fields.set(key, {
      definition: binding.definition,
      readCanonical: binding[FIELD_REGISTRATION].readCanonical,
      // Binding-factoryen binder definition, read og write med samme T. Type-erasure findes kun i registryet.
      writeCanonical: binding[FIELD_REGISTRATION].writeCanonical as RegisteredField['writeCanonical'],
    });
  }

  registerCollection<TEntity>(binding: CollectionBinding<TEntity>): void {
    this.#assertOpen();
    const key = templateKey(binding.template);
    if (this.#collections.has(key)) throw new Error('InputCatalog: samlingen er allerede registreret');

    this.#collections.set(key, {
      binding: binding as CollectionBinding<unknown>,
      getEntityId: binding[COLLECTION_REGISTRATION].getEntityId as (entity: unknown) => string,
      readEntities: binding[COLLECTION_REGISTRATION].readEntities as ReadEntities<unknown>,
      writeEntities: binding[COLLECTION_REGISTRATION].writeEntities as WriteEntities<unknown>,
    });
  }

  seal(): this {
    if (this.#sealed) return this;

    for (const fieldKey of this.#fields.keys()) {
      this.#assertTemplateParents(JSON.parse(fieldKey) as FieldAddressTemplate);
    }
    for (const collectionKey of this.#collections.keys()) {
      this.#assertTemplateParents(JSON.parse(collectionKey) as CollectionRefTemplate);
    }

    this.#sealed = true;
    return this;
  }

  get isSealed(): boolean {
    return this.#sealed;
  }

  isKnownAddress(address: FieldAddress): boolean {
    this.#assertSealed();
    return this.#fields.has(templateKey(addressTemplate(address)));
  }

  isKnownField<T>(field: FieldRef<T>): boolean {
    this.#assertSealed();
    const binding = this.#fields.get(templateKey(addressTemplate(field.address)));
    return binding !== undefined && binding.definition === field.definition;
  }

  assertKnownFieldInInput<T>(sections: InputSectionsSnapshot, field: FieldRef<T>): void {
    if (!this.isKnownField(field) || !this.containsAddressEntities(sections, field.address)) {
      throw new Error('InputCatalog: ukendt, slettet eller forkert bundet feltreference');
    }
  }

  readCanonical<T>(sections: InputSectionsSnapshot, field: FieldRef<T>): T {
    this.assertKnownFieldInInput(sections, field);
    const binding = this.#fields.get(templateKey(addressTemplate(field.address)));
    if (binding === undefined) throw new Error('InputCatalog: intern feltinvariant brudt');
    return binding.readCanonical(cloneAndDeepFreeze(sections), field.address) as T;
  }

  writeCanonical<T>(sections: PersistedInputSections, field: FieldRef<T>, value: T): PersistedInputSections {
    this.assertKnownFieldInInput(sections, field);
    const binding = this.#fields.get(templateKey(addressTemplate(field.address)));
    if (binding === undefined) throw new Error('InputCatalog: intern feltinvariant brudt');
    return binding.writeCanonical(structuredClone(sections), field.address, value);
  }

  listEntityIds(sections: InputSectionsSnapshot, collection: CollectionRef): readonly string[] {
    this.#assertKnownCollectionInInput(sections, collection);
    const registered = this.#collections.get(templateKey(collectionTemplate(collection)));
    if (registered === undefined) throw new Error('InputCatalog: intern samlingsinvariant brudt');
    return this.#readEntityIds(registered, sections, collection);
  }

  containsAddressEntities(sections: InputSectionsSnapshot, address: FieldAddress): boolean {
    this.#assertSealed();
    const parentPath: FieldAddress['path'][number][] = [];
    for (const segment of address.path) {
      if (segment.kind === 'entity') {
        const collection = createCollectionRef({
          section: address.section,
          path: parentPath,
          collection: segment.collection,
        });
        const registered = this.#collections.get(templateKey(collectionTemplate(collection)));
        if (registered === undefined) return false;
        const entityIds = this.#readEntityIds(registered, sections, collection);
        if (!entityIds.includes(segment.entityId)) return false;
      }
      parentPath.push(segment);
    }
    return true;
  }

  validateCollections(sections: InputSectionsSnapshot): void {
    this.#assertSealed();
    for (const collectionKey of this.#collections.keys()) {
      const template = collectionRefTemplateSchema.parse(JSON.parse(collectionKey));
      for (const collection of this.#resolveCollections(sections, template)) {
        this.listEntityIds(sections, collection);
      }
    }
  }

  getEntityId<TEntity>(binding: CollectionBinding<TEntity>, entity: TEntity): string {
    this.#assertSealed();
    const registered = this.#collections.get(templateKey(binding.template));
    if (registered === undefined || registered.binding !== binding) {
      throw new Error('InputCatalog: ukendt collection-binding');
    }
    // Binding-callbacks må aldrig kunne mutere commandens entity uden om reducerens kandidattilstand.
    const id = this.#readEntityId(registered, entity);
    assertEntityIds([id]);
    return id;
  }

  insertEntity<TEntity>(
    sections: PersistedInputSections,
    binding: CollectionBinding<TEntity>,
    collection: CollectionRef,
    entity: TEntity,
    index?: number
  ): PersistedInputSections {
    const registered = this.#registeredCollection(binding, sections, collection);
    const current = registered.readEntities(cloneAndDeepFreeze(sections), collection);
    const isolatedEntity = structuredClone(entity) as TEntity;
    const id = this.#readEntityId(registered, isolatedEntity);
    assertEntityIds([...current.map((currentEntity) => this.#readEntityId(registered, currentEntity)), id]);
    const insertionIndex = index ?? current.length;
    if (!Number.isInteger(insertionIndex) || insertionIndex < 0 || insertionIndex > current.length) {
      throw new Error('InputCatalog: indsættelsesindeks ligger uden for samlingen');
    }
    const next = [...current.slice(0, insertionIndex), isolatedEntity, ...current.slice(insertionIndex)];
    return registered.writeEntities(structuredClone(sections), collection, next);
  }

  deleteEntity<TEntity>(
    sections: PersistedInputSections,
    binding: CollectionBinding<TEntity>,
    collection: CollectionRef,
    entityId: string
  ): PersistedInputSections {
    const registered = this.#registeredCollection(binding, sections, collection);
    const current = registered.readEntities(cloneAndDeepFreeze(sections), collection);
    const index = current.findIndex((entity) => this.#readEntityId(registered, entity) === entityId);
    if (index < 0) throw new Error('InputCatalog: entity til sletning findes ikke');
    return registered.writeEntities(
      structuredClone(sections),
      collection,
      [...current.slice(0, index), ...current.slice(index + 1)]
    );
  }

  reorderEntities<TEntity>(
    sections: PersistedInputSections,
    binding: CollectionBinding<TEntity>,
    collection: CollectionRef,
    orderedEntityIds: readonly string[]
  ): PersistedInputSections {
    const registered = this.#registeredCollection(binding, sections, collection);
    const current = registered.readEntities(cloneAndDeepFreeze(sections), collection);
    const currentIds = current.map((entity) => this.#readEntityId(registered, entity));
    assertEntityIds(orderedEntityIds);
    if (orderedEntityIds.length !== currentIds.length || currentIds.some((id) => !orderedEntityIds.includes(id))) {
      throw new Error('InputCatalog: ny rækkefølge skal indeholde præcis de eksisterende entity-id’er');
    }
    const byId = new Map(current.map((entity) => [this.#readEntityId(registered, entity), entity]));
    const ordered = orderedEntityIds.map((id) => {
      const entity = byId.get(id);
      if (entity === undefined) throw new Error('InputCatalog: intern reorder-invariant brudt');
      return entity;
    });
    return registered.writeEntities(structuredClone(sections), collection, ordered);
  }

  #assertOpen(): void {
    if (this.#sealed) throw new Error('InputCatalog: et forseglet katalog kan ikke ændres');
  }

  #assertSealed(): void {
    if (!this.#sealed) throw new Error('InputCatalog: kataloget skal forsegles før brug');
  }

  #assertTemplateParents(template: FieldAddressTemplate | CollectionRefTemplate): void {
    const parentPath: CollectionRefTemplate['path'][number][] = [];
    for (const segment of template.path) {
      if (segment.kind === 'entity') {
        const parentTemplate = collectionRefTemplateSchema.parse({
          section: template.section,
          path: parentPath,
          collection: segment.collection,
        });
        if (!this.#collections.has(templateKey(parentTemplate))) {
          throw new Error('InputCatalog: entity-sti mangler registrering af sin parentsamling');
        }
      }
      parentPath.push(segment);
    }
  }

  #assertKnownCollectionInInput(sections: InputSectionsSnapshot, collection: CollectionRef): void {
    this.#assertSealed();
    if (!this.#collections.has(templateKey(collectionTemplate(collection)))) {
      throw new Error('InputCatalog: ukendt samlingsreference');
    }
    const fieldLikeAddress = createFieldAddress({
      section: collection.section,
      path: collection.path,
      field: '__collection_membership__',
    });
    if (!this.containsAddressEntities(sections, fieldLikeAddress)) {
      throw new Error('InputCatalog: samlingen ligger under en slettet eller ukendt entity');
    }
  }

  #readEntityIds(
    registered: RegisteredCollection,
    sections: InputSectionsSnapshot,
    collection: CollectionRef
  ): readonly string[] {
    const entities = registered.readEntities(cloneAndDeepFreeze(sections), collection);
    const ids = entities.map((entity) => this.#readEntityId(registered, entity));
    assertEntityIds(ids);
    return Object.freeze(ids);
  }

  #readEntityId(registered: RegisteredCollection, entity: unknown): string {
    return registered.getEntityId(cloneAndDeepFreeze(entity));
  }

  #registeredCollection<TEntity>(
    binding: CollectionBinding<TEntity>,
    sections: InputSectionsSnapshot,
    collection: CollectionRef
  ): RegisteredCollection {
    this.#assertKnownCollectionInInput(sections, collection);
    const registered = this.#collections.get(templateKey(binding.template));
    if (registered === undefined || registered.binding !== binding || templateKey(binding.template) !== templateKey(collectionTemplate(collection))) {
      throw new Error('InputCatalog: ukendt eller forkert bundet samlingsreference');
    }
    return registered;
  }

  #resolveCollections(
    sections: InputSectionsSnapshot,
    template: CollectionRefTemplate
  ): readonly CollectionRef[] {
    let paths: FieldAddress['path'][] = [[]];
    for (const segment of template.path) {
      if (segment.kind === 'property') {
        paths = paths.map((path) => [...path, segment]);
        continue;
      }

      paths = paths.flatMap((path) => {
        const parent = createCollectionRef({
          section: template.section,
          path,
          collection: segment.collection,
        });
        const registered = this.#collections.get(templateKey(collectionTemplate(parent)));
        if (registered === undefined) throw new Error('InputCatalog: nested samling mangler parentregistrering');
        return this.#readEntityIds(registered, sections, parent).map((entityId) => [
          ...path,
          { kind: 'entity' as const, collection: segment.collection, entityId },
        ]);
      });
    }

    return paths.map((path) => createCollectionRef({
      section: template.section,
      path,
      collection: template.collection,
    }));
  }
}
