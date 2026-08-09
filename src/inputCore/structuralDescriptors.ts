import { defineField, type FieldControlKind, type FieldDescriptor, type FieldDescriptorConfig, type FieldValidator, type RelevanceRule } from './fieldDescriptor';
import type { DateBoundsDeclaration } from './dateBoundsDeclaration';
import type { CollectionDescriptor } from './fieldCatalog';
import type { FieldAddressTemplate } from './fieldDescriptor';
import type { CollectionTemplate } from './fieldCatalog';
import type { FieldCodec } from './fieldCodec';
import type { CollectionRef, FieldAddress } from './fieldAddress';
import type { PersistedInputSections } from './settledInput';
import {
  makeEntityIdResolver,
  readCanonicalAtAddress,
  readEntitiesAtCollection,
  writeCanonicalAtAddress,
  writeEntitiesAtCollection,
  type EntityIdPropertyResolver,
} from './structuralAccessors';

// Inputkernen (§3.2): strukturelle descriptor-factories, der udleder canonical read/write MEKANISK fra
// templaten via de generiske accessorer. Descriptoren ejer stadig sin egen id, codec, semantiske tomhed,
// relevans og validatorer som én udelelig enhed — helperen fjerner kun den håndskrevne per-felt-navigation,
// så de ~239 produktdescriptors ikke gentager identisk read/write-boilerplate (feedback: strukturel forenkling).

/** Map fra samlingsnavn til den egenskab, samlingens entities identificeres på (default `id`). */
export type EntityIdProperties = Readonly<Record<string, string>>;

/** Delte semantiske tomværdier — de fleste felter er optionelle med canonical tomhed `undefined`. */
export const isUndefined = (value: unknown): boolean => value === undefined;
export const isEmptyString = (value: string | undefined): boolean => value === undefined || value === '';

export type StructuralFieldOptions<T> = Readonly<{
  id: string;
  template: FieldAddressTemplate;
  codec: FieldCodec<T>;
  emptyValue: T;
  isEmpty: (value: T) => boolean;
  label: string;
  controlKind: FieldControlKind;
  /** Sektionens canonical tomme værdi; bruges kun når et første commit lander i en tom/`null` sektion. */
  createEmptySection: () => unknown;
  relevance?: RelevanceRule<T>;
  validators?: readonly FieldValidator<T>[];
  /** Datofelters erklærede grænser (§1.6a); `defineField` afviser datofelter uden erklæring. */
  dateBounds?: DateBoundsDeclaration;
  /** Id-egenskaber for samlinger i templatens sti, der ikke bruger `id`. */
  entityIdProperties?: EntityIdProperties;
}>;

export const defineStructuralField = <T>(options: StructuralFieldOptions<T>): FieldDescriptor<T> => {
  const resolver: EntityIdPropertyResolver = makeEntityIdResolver(options.entityIdProperties);
  const config: FieldDescriptorConfig<T> = {
    id: options.id,
    template: options.template,
    codec: options.codec,
    emptyValue: options.emptyValue,
    isEmpty: options.isEmpty,
    label: options.label,
    controlKind: options.controlKind,
    readCanonical: (sections: PersistedInputSections, address: FieldAddress): T =>
      readCanonicalAtAddress(sections, address, resolver) as T,
    writeCanonical: (sections: PersistedInputSections, address: FieldAddress, value: T): PersistedInputSections =>
      writeCanonicalAtAddress(sections, address, value, options.createEmptySection, resolver),
    ...(options.relevance === undefined ? {} : { relevance: options.relevance }),
    ...(options.validators === undefined ? {} : { validators: options.validators }),
    ...(options.dateBounds === undefined ? {} : { dateBounds: options.dateBounds }),
  };
  return defineField(config);
};

export type StructuralCollectionOptions = Readonly<{
  id: string;
  template: CollectionTemplate;
  createEmptySection: () => unknown;
  /** Entity-id-egenskaben for denne samling (default `id`). Fx `ansaettelsesforholdId`. */
  entityIdProperty?: string;
  /** Id-egenskaber for eventuelle parent-samlinger i templatens sti (nested samlinger). */
  parentEntityIdProperties?: EntityIdProperties;
}>;

export const defineStructuralCollection = <TEntity extends Readonly<Record<string, unknown>>>(
  options: StructuralCollectionOptions
): CollectionDescriptor<TEntity> => {
  const idProperty = options.entityIdProperty ?? 'id';
  const resolver = makeEntityIdResolver({
    ...options.parentEntityIdProperties,
    [options.template.collection]: idProperty,
  });
  return {
    id: options.id,
    template: options.template,
    getEntityId: (entity: TEntity): string => {
      const id = entity[idProperty];
      if (typeof id !== 'string') {
        throw new Error(`StructuralCollection(${options.id}): entity mangler streng-id på "${idProperty}"`);
      }
      return id;
    },
    readEntities: (sections: PersistedInputSections, collection: CollectionRef): readonly TEntity[] =>
      readEntitiesAtCollection(sections, collection, resolver) as readonly TEntity[],
    writeEntities: (
      sections: PersistedInputSections,
      collection: CollectionRef,
      entities: readonly TEntity[]
    ): PersistedInputSections =>
      writeEntitiesAtCollection(sections, collection, entities, options.createEmptySection, resolver),
  };
};
