import { z } from 'zod';
import { cloneAndDeepFreeze } from '../utils/deepFreeze';
import { createCollectionRef } from './fieldAddress';
import type { CollectionRef } from './fieldAddress';
import { serializeFieldAddress } from './fieldAddress';
import type { FieldRef } from './fieldDefinition';
import type { InputCatalog } from './fieldCatalog';
import type { PersistedInputState } from './inputState';

export const inputRevisionSchema = z.number()
  .int()
  .nonnegative()
  // Revisionen er en identitetsnøgle; et usikkert heltal kan kollidere med naborevisionen.
  .refine(Number.isSafeInteger, 'Inputrevisionen skal være et sikkert heltal')
  .brand<'InputRevision'>();
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

type CreateInputReaderOptions = Readonly<{
  input: PersistedInputState;
  revision: InputRevision;
  catalog: InputCatalog;
}>;

export const createInputReader = ({ input, revision, catalog }: CreateInputReaderOptions): InputReader => {
  if (!catalog.isSealed) throw new Error('InputReader: kataloget skal være forseglet');
  // Readeren ejer en isoleret kopi, så caller- eller consumer-mutation aldrig kan ændre samme revision.
  const snapshot = cloneAndDeepFreeze(input);

  return Object.freeze({
    revision,
    read: <T>(field: FieldRef<T>): SettledFieldState<T> => {
      // Snapshotmedlemskab valideres før rejected-short-circuit, så en ref til en slettet række
      // aldrig kan ligne et almindeligt invalid/missing felt.
      catalog.assertKnownFieldInInput(snapshot.sections, field);

      const rejected = snapshot.rejectedInputs[serializeFieldAddress(field.address)];
      if (rejected !== undefined) return Object.freeze({ status: 'invalid', raw: rejected.raw });

      const value = catalog.readCanonical(snapshot.sections, field);
      return Object.freeze({
        status: 'valid',
        // Readeren overtager aldrig en reference, som en binding eventuelt genbruger uden for snapshottet.
        value: cloneAndDeepFreeze(value) as T,
      });
    },
    listEntities: (collection) => {
      const canonicalCollection = createCollectionRef(collection);
      return Object.freeze(
        catalog.listEntityIds(snapshot.sections, canonicalCollection)
          .map((entityId) => Object.freeze({ collection: canonicalCollection, entityId }))
      );
    },
  });
};

export const createInputRevision = (value: number): InputRevision => inputRevisionSchema.parse(value);
