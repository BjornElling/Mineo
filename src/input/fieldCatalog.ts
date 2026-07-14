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

export type FieldBinding<T> = Readonly<{
  definition: FieldDefinition<T>;
  template: FieldAddressTemplate;
  createRef: (...entityIds: readonly string[]) => FieldRef<T>;
}>;

type RegisteredBinding = Readonly<{
  definition: FieldDefinitionBase;
  readCanonical: (sections: PersistedInputSections, address: FieldAddress) => unknown;
}>;

type ReadEntityIds = (
  sections: PersistedInputSections,
  collection: CollectionRef
) => readonly string[];

export type CollectionBinding = Readonly<{
  template: CollectionRefTemplate;
  createRef: (...parentEntityIds: readonly string[]) => CollectionRef;
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
}>): FieldBinding<T> & Readonly<{ readCanonical: ReadCanonicalField<T> }> => {
  const template = fieldAddressTemplateSchema.parse(options.template);

  return Object.freeze({
    definition: options.definition,
    template,
    readCanonical: options.readCanonical,
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
}>): CollectionBinding & Readonly<{ readEntityIds: ReadEntityIds }> => {
  const template = collectionRefTemplateSchema.parse(options.template);
  return Object.freeze({
    template,
    readEntityIds: options.readEntityIds,
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

  register<T>(binding: FieldBinding<T> & Readonly<{ readCanonical: ReadCanonicalField<T> }>): void {
    const key = templateKey(binding.template);
    if (this.#bindings.has(key)) {
      throw new Error('FieldCatalog: feltadressen er allerede registreret');
    }

    this.#bindings.set(key, {
      definition: binding.definition,
      readCanonical: binding.readCanonical,
    });
  }

  isKnownAddress(address: FieldAddress): boolean {
    return this.#bindings.has(templateKey(addressTemplate(address)));
  }

  readCanonical<T>(sections: PersistedInputSections, field: FieldRef<T>): T {
    const binding = this.#bindings.get(templateKey(addressTemplate(field.address)));
    if (binding === undefined || binding.definition !== field.definition) {
      throw new Error('FieldCatalog: ukendt eller forkert bundet feltreference');
    }

    // Samme template og samme definition-identitet blev registreret sammen med denne resolver.
    return binding.readCanonical(sections, field.address) as T;
  }
}

/** Katalog for persisted entity-samlinger; værdier udstilles aldrig gennem denne grænse. */
export class CollectionCatalog {
  readonly #collections = new Map<string, RegisteredCollection>();

  register(binding: CollectionBinding & Readonly<{ readEntityIds: ReadEntityIds }>): void {
    const key = templateKey(binding.template);
    if (this.#collections.has(key)) {
      throw new Error('CollectionCatalog: samlingen er allerede registreret');
    }
    this.#collections.set(key, { readEntityIds: binding.readEntityIds });
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
}
