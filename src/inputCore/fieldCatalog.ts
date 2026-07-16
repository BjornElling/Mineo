import { deepEqual } from '../utils/deepEqual';
import { cloneAndDeepFreeze } from '../utils/deepFreeze';
import {
  createCollectionRef,
  deserializeFieldAddress,
  type CollectionRef,
  type FieldAddress,
  type FieldAddressPathSegment,
  type SectionKey,
} from './fieldAddress';
import type { CanonicalView, FieldDescriptor, FieldRef } from './fieldDescriptor';

// Type-erasure er isoleret til katalogets heterogene samling; alle writes forbliver typed ved FieldRef-callsitet.
type AnyFieldRef = FieldRef<unknown>;
import {
  persistedInputSectionsSchema,
  rejectedInputsSchema,
  settledInputBaseSchema,
  type PersistedInputSections,
  type SettledInput,
  type SettledInputCandidate,
} from './settledInput';

// Greenfield-kerne (§3.2): produktkataloget er ét almindeligt statisk readonly katalog, valideret ÉN gang
// ved konstruktion og derefter immutabelt. Ingen seal-lifecycle, symbols, brands eller WeakSet.

export type CollectionTemplateSegment =
  | Readonly<{ kind: 'property'; name: string }>
  | Readonly<{ kind: 'entity'; collection: string }>;

export type CollectionTemplate = Readonly<{
  section: SectionKey;
  path: readonly CollectionTemplateSegment[];
  collection: string;
}>;

export type CollectionDescriptor<TEntity> = Readonly<{
  id: string;
  template: CollectionTemplate;
  getEntityId: (entity: TEntity) => string;
  readEntities: (sections: PersistedInputSections, collection: CollectionRef) => readonly TEntity[];
  writeEntities: (
    sections: PersistedInputSections,
    collection: CollectionRef,
    entities: readonly TEntity[]
  ) => PersistedInputSections;
}>;

type AnyFieldDescriptor = FieldDescriptor<unknown>;
type AnyCollectionDescriptor = CollectionDescriptor<unknown>;

/**
 * Samler heterogene, allerede typed descriptors til katalogets eksistentielle registry-visning. Castet er
 * sikkert, fordi hvert descriptor fortsat ejer codec/read/write/relevans som én udelelig enhed; kataloget
 * flytter aldrig en værdi mellem descriptors.
 */
export const catalogFields = <TValues extends readonly unknown[]>(
  ...descriptors: { readonly [K in keyof TValues]: FieldDescriptor<TValues[K]> }
): readonly AnyFieldDescriptor[] => Object.freeze(
  descriptors.map((descriptor) => descriptor as unknown as AnyFieldDescriptor)
);

/** Samme eksistentielle indkapsling for collections; entity-værdier bruges kun med deres eget descriptor. */
export const catalogCollections = <TEntities extends readonly unknown[]>(
  ...descriptors: { readonly [K in keyof TEntities]: CollectionDescriptor<TEntities[K]> }
): readonly AnyCollectionDescriptor[] => Object.freeze(
  descriptors.map((descriptor) => descriptor as unknown as AnyCollectionDescriptor)
);

// Læse-closures får en dybtfrossen, isoleret kopi, så binding-callbacks aldrig kan mutere kildesnapshottet.
// Den frosne kopi castes til `PersistedInputSections`; read-closures muterer den aldrig (og kan det ikke).
const isolateSections = (sections: PersistedInputSections): PersistedInputSections =>
  cloneAndDeepFreeze(sections) as unknown as PersistedInputSections;

const templatePathKey = (path: readonly CollectionTemplateSegment[]): readonly (readonly string[])[] =>
  path.map((segment) => segment.kind === 'property'
    ? ['property', segment.name]
    : ['entity', segment.collection]);

const fieldTemplateKey = (template: AnyFieldDescriptor['template']): string => JSON.stringify([
  template.section,
  templatePathKey(template.path),
  template.field,
]);

const collectionTemplateKey = (template: CollectionTemplate): string => JSON.stringify([
  template.section,
  templatePathKey(template.path),
  template.collection,
]);

const addressTemplateKey = (address: FieldAddress): string => JSON.stringify([
  address.section,
  address.path.map((segment) => segment.kind === 'property'
    ? ['property', segment.name]
    : ['entity', segment.collection]),
  address.field,
]);

const collectionTemplateKeyFromRef = (collection: CollectionRef): string => JSON.stringify([
  collection.section,
  collection.path.map((segment) => segment.kind === 'property'
    ? ['property', segment.name]
    : ['entity', segment.collection]),
  collection.collection,
]);

const assertEntityIds = (ids: readonly string[]): void => {
  if (ids.some((id) => id === '' || id.trim() !== id) || new Set(ids).size !== ids.length) {
    throw new Error('InputCatalog: entity-id’er skal være ikke-tomme, trimmede og unikke');
  }
};

const assertMetadataPart = (value: string, description: string): void => {
  if (value === '' || value.trim() !== value) {
    throw new Error(`InputCatalog: ${description} skal være ikke-tom og uden ydre mellemrum`);
  }
};

export type InputCatalog = Readonly<{
  resolveField: (address: FieldAddress) => AnyFieldDescriptor | undefined;
  isKnownField: <T>(field: FieldRef<T>) => boolean;
  containsAddressEntities: (sections: PersistedInputSections, address: FieldAddress) => boolean;
  listEntityIds: (sections: PersistedInputSections, collection: CollectionRef) => readonly string[];
  getCollection: (collection: CollectionRef) => AnyCollectionDescriptor | undefined;
  insertEntity: <TEntity>(
    sections: PersistedInputSections,
    collection: CollectionRef,
    entity: TEntity,
    index?: number
  ) => PersistedInputSections;
  deleteEntity: (
    sections: PersistedInputSections,
    collection: CollectionRef,
    entityId: string
  ) => PersistedInputSections;
  reorderEntities: (
    sections: PersistedInputSections,
    collection: CollectionRef,
    orderedEntityIds: readonly string[]
  ) => PersistedInputSections;
  getEntityId: <TEntity>(collection: CollectionRef, entity: TEntity) => string;
  /** Alle konkrete feltinstanser i den aktuelle tilstand (statiske + pr. række). Bruges af issue-snapshot og `.eo`-gate. */
  listFieldInstances: (sections: PersistedInputSections) => readonly AnyFieldRef[];
  /** Katalog-afhængig envelope-validering: struktur + XOR + inputdrevet eksistens (§3.1). */
  validateSettledInput: (candidate: SettledInputCandidate) => SettledInput;
  /** Reducer-intern før/efter-validering, før ny-irrelevante rejected inputs er ryddet. */
  validateSettledInputBeforeRelevanceCleanup: (candidate: SettledInputCandidate) => SettledInput;
}>;

export const createInputCatalog = (options: Readonly<{
  fields: readonly AnyFieldDescriptor[];
  collections: readonly AnyCollectionDescriptor[];
}>): InputCatalog => {
  const fields = Object.freeze([...options.fields]);
  const collections = Object.freeze(options.collections.map((descriptor) => Object.freeze({
    ...descriptor,
    template: Object.freeze({
      ...descriptor.template,
      path: Object.freeze(descriptor.template.path.map((segment) => Object.freeze({ ...segment }))),
    }),
  })));
  const fieldsByTemplate = new Map<string, AnyFieldDescriptor>();
  const fieldIds = new Set<string>();
  for (const descriptor of fields) {
    const key = fieldTemplateKey(descriptor.template);
    if (fieldsByTemplate.has(key)) throw new Error(`InputCatalog: dubleret feltadresse (${descriptor.id})`);
    if (fieldIds.has(descriptor.id)) throw new Error(`InputCatalog: dubleret felt-id (${descriptor.id})`);
    fieldsByTemplate.set(key, descriptor);
    fieldIds.add(descriptor.id);
  }

  const collectionsByTemplate = new Map<string, AnyCollectionDescriptor>();
  const collectionIds = new Set<string>();
  for (const descriptor of collections) {
    assertMetadataPart(descriptor.id, 'samlings-id');
    assertMetadataPart(descriptor.template.collection, 'samlingsnavn');
    for (const segment of descriptor.template.path) {
      assertMetadataPart(
        segment.kind === 'property' ? segment.name : segment.collection,
        'samlingssti-led'
      );
    }
    for (const [name, fn] of [
      ['getEntityId', descriptor.getEntityId],
      ['readEntities', descriptor.readEntities],
      ['writeEntities', descriptor.writeEntities],
    ] as const) {
      if (typeof fn !== 'function') throw new Error(`InputCatalog: ${descriptor.id}.${name} skal være en funktion`);
    }
    const key = collectionTemplateKey(descriptor.template);
    if (collectionsByTemplate.has(key)) throw new Error(`InputCatalog: dubleret samling (${descriptor.id})`);
    if (collectionIds.has(descriptor.id)) throw new Error(`InputCatalog: dubleret samlings-id (${descriptor.id})`);
    collectionsByTemplate.set(key, descriptor);
    collectionIds.add(descriptor.id);
  }

  // Validér én gang: hvert entity-led i felt-/samlingstemplates skal have en registreret parentsamling.
  const assertTemplateParents = (section: SectionKey, path: readonly CollectionTemplateSegment[]): void => {
    const parent: CollectionTemplateSegment[] = [];
    for (const segment of path) {
      if (segment.kind === 'entity') {
        const parentKey = collectionTemplateKey({ section, path: parent, collection: segment.collection });
        if (!collectionsByTemplate.has(parentKey)) {
          throw new Error(`InputCatalog: entity-sti mangler registrering af parentsamlingen '${segment.collection}'`);
        }
      }
      parent.push(segment);
    }
  };
  for (const descriptor of fields) assertTemplateParents(descriptor.template.section, descriptor.template.path);
  for (const descriptor of collections) {
    assertTemplateParents(descriptor.template.section, descriptor.template.path);
  }

  const resolveField = (address: FieldAddress): AnyFieldDescriptor | undefined =>
    fieldsByTemplate.get(addressTemplateKey(address));

  const getCollection = (collection: CollectionRef): AnyCollectionDescriptor | undefined =>
    collectionsByTemplate.get(collectionTemplateKeyFromRef(collection));

  const readEntityIds = (
    descriptor: AnyCollectionDescriptor,
    sections: PersistedInputSections,
    collection: CollectionRef
  ): readonly string[] => {
    const entities = descriptor.readEntities(isolateSections(sections), collection);
    const ids = entities.map((entity) => descriptor.getEntityId(entity));
    assertEntityIds(ids);
    return Object.freeze(ids);
  };

  const containsAddressEntities = (sections: PersistedInputSections, address: FieldAddress): boolean => {
    const parentPath: FieldAddressPathSegment[] = [];
    for (const segment of address.path) {
      if (segment.kind === 'entity') {
        const collection = createCollectionRef({ section: address.section, path: parentPath, collection: segment.collection });
        const descriptor = getCollection(collection);
        if (descriptor === undefined) return false;
        if (!readEntityIds(descriptor, sections, collection).includes(segment.entityId)) return false;
      }
      parentPath.push(segment);
    }
    return true;
  };

  const requireCollection = (
    sections: PersistedInputSections,
    collection: CollectionRef
  ): AnyCollectionDescriptor => {
    const descriptor = getCollection(collection);
    if (descriptor === undefined) throw new Error('InputCatalog: ukendt samlingsreference');
    // Samlingen skal ligge under eksisterende entities (nested collections under en slettet parent afvises).
    const membershipProbe: FieldAddress = { section: collection.section, path: collection.path, field: '__membership__' };
    if (!containsAddressEntities(sections, membershipProbe)) {
      throw new Error('InputCatalog: samlingen ligger under en slettet eller ukendt entity');
    }
    return descriptor;
  };

  const listEntityIds = (sections: PersistedInputSections, collection: CollectionRef): readonly string[] =>
    readEntityIds(requireCollection(sections, collection), sections, collection);

  const isKnownField = <T>(field: FieldRef<T>): boolean => {
    const descriptor = resolveField(field.address);
    return descriptor !== undefined && descriptor === field.descriptor;
  };

  const getEntityId = <TEntity>(collection: CollectionRef, entity: TEntity): string => {
    const descriptor = getCollection(collection);
    if (descriptor === undefined) throw new Error('InputCatalog: ukendt collection-binding');
    const id = descriptor.getEntityId(cloneAndDeepFreeze(entity));
    assertEntityIds([id]);
    return id;
  };

  const insertEntity = <TEntity>(
    sections: PersistedInputSections,
    collection: CollectionRef,
    entity: TEntity,
    index?: number
  ): PersistedInputSections => {
    const descriptor = requireCollection(sections, collection);
    const current = descriptor.readEntities(isolateSections(sections), collection);
    const isolated = cloneAndDeepFreeze(entity);
    const id = descriptor.getEntityId(isolated);
    assertEntityIds([...current.map((existing) => descriptor.getEntityId(existing)), id]);
    const at = index ?? current.length;
    if (!Number.isInteger(at) || at < 0 || at > current.length) {
      throw new Error('InputCatalog: indsættelsesindeks ligger uden for samlingen');
    }
    return descriptor.writeEntities(structuredClone(sections), collection, [
      ...current.slice(0, at),
      isolated,
      ...current.slice(at),
    ]);
  };

  const deleteEntity = (
    sections: PersistedInputSections,
    collection: CollectionRef,
    entityId: string
  ): PersistedInputSections => {
    const descriptor = requireCollection(sections, collection);
    const current = descriptor.readEntities(isolateSections(sections), collection);
    const index = current.findIndex((entity) => descriptor.getEntityId(entity) === entityId);
    if (index < 0) throw new Error('InputCatalog: entity til sletning findes ikke');
    return descriptor.writeEntities(structuredClone(sections), collection, [
      ...current.slice(0, index),
      ...current.slice(index + 1),
    ]);
  };

  const reorderEntities = (
    sections: PersistedInputSections,
    collection: CollectionRef,
    orderedEntityIds: readonly string[]
  ): PersistedInputSections => {
    const descriptor = requireCollection(sections, collection);
    const current = descriptor.readEntities(isolateSections(sections), collection);
    const currentIds = current.map((entity) => descriptor.getEntityId(entity));
    assertEntityIds(orderedEntityIds);
    if (orderedEntityIds.length !== currentIds.length || currentIds.some((id) => !orderedEntityIds.includes(id))) {
      throw new Error('InputCatalog: ny rækkefølge skal indeholde præcis de eksisterende entity-id’er');
    }
    const byId = new Map(current.map((entity) => [descriptor.getEntityId(entity), entity]));
    return descriptor.writeEntities(
      structuredClone(sections),
      collection,
      orderedEntityIds.map((id) => {
        const entity = byId.get(id);
        if (entity === undefined) throw new Error('InputCatalog: intern reorder-invariant brudt');
        return entity;
      })
    );
  };

  // Ekspanderer en templatesti (property + entity-led) til alle konkrete stier over aktuelle entities.
  const expandConcretePaths = (
    section: SectionKey,
    path: readonly CollectionTemplateSegment[],
    sections: PersistedInputSections
  ): readonly FieldAddressPathSegment[][] => {
    let paths: FieldAddressPathSegment[][] = [[]];
    for (const segment of path) {
      if (segment.kind === 'property') {
        paths = paths.map((current) => [...current, { kind: 'property', name: segment.name }]);
        continue;
      }
      paths = paths.flatMap((current) => {
        const parent = createCollectionRef({ section, path: current, collection: segment.collection });
        const parentDescriptor = getCollection(parent);
        if (parentDescriptor === undefined) throw new Error('InputCatalog: nested samling mangler parentregistrering');
        return readEntityIds(parentDescriptor, sections, parent).map((entityId) => [
          ...current,
          { kind: 'entity' as const, collection: segment.collection, entityId },
        ]);
      });
    }
    return paths;
  };

  const resolveConcreteCollections = (
    descriptor: AnyCollectionDescriptor,
    sections: PersistedInputSections
  ): readonly CollectionRef[] =>
    expandConcretePaths(descriptor.template.section, descriptor.template.path, sections).map((path) =>
      createCollectionRef({ section: descriptor.template.section, path, collection: descriptor.template.collection }));

  const listFieldInstances = (sections: PersistedInputSections): readonly AnyFieldRef[] => {
    const instances: AnyFieldRef[] = [];
    for (const descriptor of fields) {
      for (const path of expandConcretePaths(descriptor.template.section, descriptor.template.path, sections)) {
        const entityIds = path.filter((segment): segment is Extract<FieldAddressPathSegment, { kind: 'entity' }> =>
          segment.kind === 'entity').map((segment) => segment.entityId);
        instances.push(descriptor.bind(...entityIds));
      }
    }
    return Object.freeze(instances);
  };

  const validateSettledInputCandidate = (
    candidate: SettledInputCandidate,
    enforceRejectedRelevance: boolean
  ): SettledInput => {
    const structural = settledInputBaseSchema.parse(candidate);
    const sections = persistedInputSectionsSchema.parse(structural.sections);

    // Alle samlinger skal kunne læses med gyldige entity-id'er.
    for (const [key, descriptor] of collectionsByTemplate) {
      void key;
      for (const collection of resolveConcreteCollections(descriptor, sections)) {
        readEntityIds(descriptor, sections, collection);
      }
    }

    const readCanonical = <T>(field: FieldRef<T>): T => {
      if (!isKnownField(field) || !containsAddressEntities(sections, field.address)) {
        throw new Error('SettledInput: relevansregel læste en ukendt eller slettet feltreference');
      }
      return cloneAndDeepFreeze(field.descriptor.readCanonical(isolateSections(sections), field.address)) as T;
    };
    const view: CanonicalView = Object.freeze({ readCanonical });

    for (const [serialized, rejected] of Object.entries(structural.rejectedInputs)) {
      const address = deserializeFieldAddress(serialized);
      if (address === null) throw new Error('SettledInput: rejected-adresse er ikke kanonisk serialiseret');
      const descriptor = resolveField(address);
      if (descriptor === undefined || !containsAddressEntities(sections, address)) {
        throw new Error(`SettledInput: rejected-adressen findes ikke i kataloget (${serialized})`);
      }
      // XOR-invarianten (§1.5): et rejected felt SKAL samtidig have sin canonical tomværdi i sections.
      const canonical = descriptor.readCanonical(isolateSections(sections), address);
      if (!deepEqual(canonical, descriptor.emptyValue)) {
        throw new Error(`SettledInput: rejected felt har en ikke-tom canonical værdi (${serialized})`);
      }
      const reparsed = descriptor.codec.parseForSettle(rejected.raw);
      if (reparsed.status !== 'rejected'
        || reparsed.reason !== rejected.reason
        || !deepEqual(reparsed.detail, rejected.detail)) {
        throw new Error(`SettledInput: rejected input matcher ikke feltets codec (${serialized})`);
      }
      if (enforceRejectedRelevance) {
        const entityIds = address.path
          .filter((segment): segment is Extract<FieldAddressPathSegment, { kind: 'entity' }> => segment.kind === 'entity')
          .map((segment) => segment.entityId);
        const field = descriptor.bind(...entityIds);
        if (descriptor.relevance !== undefined && !descriptor.relevance(field, view)) {
          throw new Error(`SettledInput: rejected felt er ikke relevant (${serialized})`);
        }
      }
    }

    rejectedInputsSchema.parse(structural.rejectedInputs);
    return cloneAndDeepFreeze(structural) as SettledInput;
  };

  const validateSettledInput = (candidate: SettledInputCandidate): SettledInput =>
    validateSettledInputCandidate(candidate, true);

  return Object.freeze({
    resolveField,
    isKnownField,
    containsAddressEntities,
    listEntityIds,
    getCollection,
    insertEntity,
    deleteEntity,
    reorderEntities,
    getEntityId,
    listFieldInstances,
    validateSettledInput,
    validateSettledInputBeforeRelevanceCleanup: (candidate) =>
      validateSettledInputCandidate(candidate, false),
  });
};
