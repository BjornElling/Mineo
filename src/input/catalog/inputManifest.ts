import {
  InputCatalog,
  type CollectionBinding,
  type FieldBinding,
} from '../fieldCatalog';

type CheckedFieldBindings<TBindings extends readonly unknown[]> = {
  readonly [TIndex in keyof TBindings]: TBindings[TIndex] extends FieldBinding<infer TValue>
    ? FieldBinding<TValue>
    : never;
};

type CheckedCollectionBindings<TBindings extends readonly unknown[]> = {
  readonly [TIndex in keyof TBindings]: TBindings[TIndex] extends CollectionBinding<infer TEntity>
    ? CollectionBinding<TEntity>
    : never;
};

const INPUT_MANIFEST: unique symbol = Symbol('InputManifest');

export type InputManifest = Readonly<{
  id: string;
  fields: readonly unknown[];
  collections: readonly unknown[];
  [INPUT_MANIFEST]: true;
}>;

/**
 * Samler et bindingsmoduls felter og samlinger som én auditerbar registreringsenhed.
 * De mapped tuple-typer afviser andet end de konkrete typed bindings ved callsite.
 */
export const defineInputManifest = <
  const TFields extends readonly unknown[],
  const TCollections extends readonly unknown[],
>(options: Readonly<{
  id: string;
  fields: TFields & CheckedFieldBindings<TFields>;
  collections: TCollections & CheckedCollectionBindings<TCollections>;
}>): InputManifest => {
  if (options.id === '' || options.id.trim() !== options.id) {
    throw new Error('InputManifest: id skal være ikke-tomt og uden ydre mellemrum');
  }

  return Object.freeze({
    id: options.id,
    fields: Object.freeze([...options.fields]),
    collections: Object.freeze([...options.collections]),
    [INPUT_MANIFEST]: true as const,
  });
};

/**
 * Registrerer først alle samlinger og dernæst alle felter, så parent-invarianten er
 * uafhængig af manifesternes kompositionsrækkefølge. Type-erasure er bevidst isoleret her:
 * factoryen har allerede bevist hvert elements konkrete generiske bindingstype.
 */
export const registerInputManifests = (
  catalog: InputCatalog,
  manifests: readonly InputManifest[]
): void => {
  const manifestIds = manifests.map((manifest) => manifest.id);
  if (new Set(manifestIds).size !== manifestIds.length) {
    throw new Error('InputManifest: et manifest-id er allerede registreret');
  }

  for (const manifest of manifests) {
    for (const binding of manifest.collections) {
      catalog.registerCollection(binding as CollectionBinding<unknown>);
    }
  }
  for (const manifest of manifests) {
    for (const binding of manifest.fields) {
      catalog.registerField(binding as FieldBinding<unknown>);
    }
  }
};
