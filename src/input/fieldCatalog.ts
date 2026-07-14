import { z } from 'zod';
import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
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
  sections: PersistedInputSections,
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
    writeCanonical?: WriteCanonicalField<T>;
  }>;
}>;

type RegisteredBinding = Readonly<{
  definition: FieldDefinitionBase;
  readCanonical: (sections: PersistedInputSections, address: FieldAddress) => unknown;
  writeCanonical?: (sections: PersistedInputSections, address: FieldAddress, value: unknown) => PersistedInputSections;
}>;

type ReadEntityIds = (
  sections: PersistedInputSections,
  collection: CollectionRef
) => readonly string[];

export type CollectionBinding = Readonly<{
  template: CollectionRefTemplate;
  createRef: (...parentEntityIds: readonly string[]) => CollectionRef;
  [COLLECTION_REGISTRATION]: Readonly<{ readEntityIds: ReadEntityIds }>;
}>;

type RegisteredCollection = Readonly<{
  readEntityIds: ReadEntityIds;
}>;

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
  /**
   * Midlertidigt valgfri, fordi kataloget indføres før alle eksisterende read-only bindinger
   * migreres. Nye persisted felter skal registrere både læse- og skrivevejen her.
   */
  writeCanonical?: WriteCanonicalField<T>;
}>): FieldBinding<T> => {
  const template = fieldAddressTemplateSchema.parse(options.template);

  return Object.freeze({
    definition: options.definition,
    template,
    [FIELD_REGISTRATION]: Object.freeze({
      readCanonical: options.readCanonical,
      ...(options.writeCanonical === undefined ? {} : { writeCanonical: options.writeCanonical }),
    }),
    createRef: (...entityIds: readonly string[]) => {
      return bindField(options.definition, createFieldAddress({
        section: template.section,
        path: bindTemplatePath(template.path, entityIds, 'FieldBinding'),
        field: template.field,
      }));
    },
  });
};

export const createCollectionBinding = (options: Readonly<{
  template: CollectionRefTemplate;
  readEntityIds: ReadEntityIds;
}>): CollectionBinding => {
  const template = collectionRefTemplateSchema.parse(options.template);
  return Object.freeze({
    template,
    [COLLECTION_REGISTRATION]: Object.freeze({ readEntityIds: options.readEntityIds }),
    createRef: (...parentEntityIds: readonly string[]) => createCollectionRef({
      section: template.section,
      path: bindTemplatePath(template.path, parentEntityIds, 'CollectionBinding'),
      collection: template.collection,
    }),
  });
};

/**
 * Kataloget er autoriteten for kendte persisted feltadresser. Det matcher dynamiske entity-id'er
 * mod en strukturel template, mens definition og canonical resolver registreres én gang.
 */
export class FieldCatalog {
  readonly #bindings = new Map<string, RegisteredBinding>();

  register<T>(binding: FieldBinding<T>): void {
    const key = templateKey(binding.template);
    if (this.#bindings.has(key)) {
      throw new Error('FieldCatalog: feltadressen er allerede registreret');
    }

    this.#bindings.set(key, {
      definition: binding.definition,
      readCanonical: binding[FIELD_REGISTRATION].readCanonical,
      // Registreringen binder definition, læse- og skrivefunktion med samme T. Den erasede
      // registry-grænse kan derfor kun modtage den T, som assertKnownField netop har bevist.
      writeCanonical: binding[FIELD_REGISTRATION].writeCanonical as RegisteredBinding['writeCanonical'],
    });
  }

  isKnownAddress(address: FieldAddress): boolean {
    return this.#bindings.has(templateKey(addressTemplate(address)));
  }

  isKnownField<T>(field: FieldRef<T>): boolean {
    const binding = this.#bindings.get(templateKey(addressTemplate(field.address)));
    return binding !== undefined && binding.definition === field.definition;
  }

  assertKnownField<T>(field: FieldRef<T>): void {
    if (!this.isKnownField(field)) {
      throw new Error('FieldCatalog: ukendt eller forkert bundet feltreference');
    }
  }

  readCanonical<T>(sections: PersistedInputSections, field: FieldRef<T>): T {
    const binding = this.#bindings.get(templateKey(addressTemplate(field.address)));
    this.assertKnownField(field);
    if (binding === undefined) throw new Error('FieldCatalog: intern kataloginvariant brudt');

    // Samme template og samme definition-identitet blev registreret sammen med denne resolver.
    return binding.readCanonical(sections, field.address) as T;
  }

  writeCanonical<T>(sections: PersistedInputSections, field: FieldRef<T>, value: T): PersistedInputSections {
    const binding = this.#bindings.get(templateKey(addressTemplate(field.address)));
    this.assertKnownField(field);
    if (binding?.writeCanonical === undefined) {
      throw new Error('FieldCatalog: feltet har ingen registreret canonical skrivevej');
    }

    return binding.writeCanonical(sections, field.address, value);
  }
}

/** Katalog for persisted entity-samlinger; værdier udstilles aldrig gennem denne grænse. */
export class CollectionCatalog {
  readonly #collections = new Map<string, RegisteredCollection>();

  register(binding: CollectionBinding): void {
    const key = templateKey(binding.template);
    if (this.#collections.has(key)) {
      throw new Error('CollectionCatalog: samlingen er allerede registreret');
    }
    this.#collections.set(key, { readEntityIds: binding[COLLECTION_REGISTRATION].readEntityIds });
  }

  listEntityIds(sections: PersistedInputSections, collection: CollectionRef): readonly string[] {
    const binding = this.#collections.get(templateKey(collectionTemplate(collection)));
    if (binding === undefined) {
      throw new Error('CollectionCatalog: ukendt samlingsreference');
    }

    const ids = binding.readEntityIds(sections, collection);
    if (ids.some((id) => id === '') || new Set(ids).size !== ids.length) {
      throw new Error('CollectionCatalog: entity-id’er skal være ikke-tomme og unikke');
    }
    return Object.freeze([...ids]);
  }

  /** Validerer alle dynamiske adresseled mod de entities, der faktisk findes i kandidatsnapshotet. */
  containsAddressEntities(sections: PersistedInputSections, address: FieldAddress): boolean {
    const parentPath: FieldAddress['path'][number][] = [];
    for (const segment of address.path) {
      if (segment.kind === 'entity') {
        const collection = createCollectionRef({
          section: address.section,
          path: parentPath,
          collection: segment.collection,
        });
        const binding = this.#collections.get(templateKey(collectionTemplate(collection)));
        if (binding === undefined) return false;
        const entityIds = this.listEntityIds(sections, collection);
        if (!entityIds.includes(segment.entityId)) return false;
      }
      parentPath.push(segment);
    }
    return true;
  }
}

/** Samlet katalogmedlemskab til rejected-input-schemaet, inklusive aktive entity-id'er. */
export const isKnownFieldAddressInInput = (
  fieldCatalog: FieldCatalog,
  collectionCatalog: CollectionCatalog,
  sections: PersistedInputSections,
  address: FieldAddress
): boolean => fieldCatalog.isKnownAddress(address)
  && collectionCatalog.containsAddressEntities(sections, address);
