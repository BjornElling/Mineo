import { z } from 'zod';
import type { CollectionRef, FieldAddress } from './fieldAddress';
import { serializeFieldAddress } from './fieldAddress';
import type { FieldRef } from './fieldDefinition';
import type { PersistedInputSections, PersistedInputState } from './inputState';

export const inputRevisionSchema = z.number().int().nonnegative().brand<'InputRevision'>();
export type InputRevision = z.infer<typeof inputRevisionSchema>;

export type SettledFieldState<T> =
  | Readonly<{ status: 'valid'; value: T }>
  | Readonly<{ status: 'invalid'; raw: string }>;

export type EntityRef = Readonly<{
  collection: CollectionRef;
  entityId: string;
}>;

export type InputReader = Readonly<{
  revision: InputRevision;
  read: <T>(field: FieldRef<T>) => SettledFieldState<T>;
  listEntities: (collection: CollectionRef) => readonly EntityRef[];
}>;

export type InputFieldCatalog = Readonly<{
  isKnownAddress: (address: FieldAddress) => boolean;
  readCanonical: <T>(sections: PersistedInputSections, field: FieldRef<T>) => T;
}>;

export type InputCollectionCatalog = Readonly<{
  listEntityIds: (
    sections: PersistedInputSections,
    collection: CollectionRef
  ) => readonly string[];
}>;

type CreateInputReaderOptions = Readonly<{
  input: PersistedInputState;
  revision: InputRevision;
  fieldCatalog: InputFieldCatalog;
  collectionCatalog: InputCollectionCatalog;
}>;

export const createInputReader = ({
  input,
  revision,
  fieldCatalog,
  collectionCatalog,
}: CreateInputReaderOptions): InputReader => Object.freeze({
  revision,
  read: <T>(field: FieldRef<T>): SettledFieldState<T> => {
    if (!fieldCatalog.isKnownAddress(field.address)) {
      throw new Error('InputReader: ukendt feltadresse');
    }

    const rejected = input.rejectedInputs[serializeFieldAddress(field.address)];
    if (rejected !== undefined) {
      return Object.freeze({ status: 'invalid', raw: rejected.raw });
    }

    return Object.freeze({
      status: 'valid',
      value: fieldCatalog.readCanonical(input.sections, field),
    });
  },
  listEntities: (collection) => Object.freeze(
    collectionCatalog.listEntityIds(input.sections, collection)
      .map((entityId) => Object.freeze({ collection, entityId }))
  ),
});

export const createInputRevision = (value: number): InputRevision => inputRevisionSchema.parse(value);
