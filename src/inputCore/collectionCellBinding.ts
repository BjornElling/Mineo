import type { CollectionRef } from './fieldAddress';
import type { FieldDescriptor, FieldRef } from './fieldDescriptor';

/**
 * Ejer-id'erne før rækkens eget id, udledt af collectionens egen sti.
 *
 * En top-level collection har ingen ejer-id'er. En nested collection får automatisk alle entity-led
 * fra stien i samme rækkefølge som inputaggregatet. Funktionen er ren inputkerne-logik og må derfor
 * kunne bruges af både editorlaget og domænets read-only projektioner uden en React-afhængighed.
 */
export const collectionOwnerEntityIds = (collection: CollectionRef): readonly string[] =>
  collection.path.flatMap((segment) => segment.kind === 'entity' ? [segment.entityId] : []);

/**
 * Den ENE bindingsregel for en celle i en collection: ejerstien fra collectionen, derefter rækkens id.
 *
 * Celleeditoren og domænets tabelprojektion skal læse præcis samme adresse. En fælles ren primitive
 * forhindrer, at en nested tabel binder med for få entity-led og først opdager fejlen under render.
 */
export const bindCollectionCell = <T>(
  collection: CollectionRef,
  descriptor: FieldDescriptor<T>,
  rowId: string
): FieldRef<T> => descriptor.bind(...collectionOwnerEntityIds(collection), rowId);
