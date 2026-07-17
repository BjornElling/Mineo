import * as React from 'react';
import { useSyncExternalStore } from 'react';
import type { CollectionRef } from '../fieldAddress';
import { insertRow, deleteRow, reorderRows } from '../inputReducer';
import { useInputRuntime } from './inputRuntimeContext';
import type { DispatchInputResult } from '../runtime/dispatchInput';

// Greenfield-React (§2.5 trin 1 / §3.8): rækkeinfrastrukturen for en dynamisk collection. Den ejer KUN de
// stabile entity-id'er, rækkefølgen og add/delete/reorder — læst DIREKTE fra den afsluttede revision gennem
// katalogets `listEntityIds`. Der findes ingen `draftRows`, `internalTableData`, fingerprint-kopi eller
// effect-flush til persistence (§3.8): en celles værdi bor kun i inputaggregaten, aldrig i en konkurrerende
// række-værdikopi. Selve celleredigeringen ejes af `useCellEditor`; denne hook rører aldrig en celleværdi.

/** Ren, stabil UI-cache-nøgle for en collection-ref (ikke en core-identitet — kun til hookens memoisering). */
const collectionCacheKey = (collection: CollectionRef): string => JSON.stringify({
  section: collection.section,
  path: collection.path.map((segment) => segment.kind === 'property'
    ? { kind: 'property', name: segment.name }
    : { kind: 'entity', collection: segment.collection, entityId: segment.entityId }),
  collection: collection.collection,
});

/**
 * Rækkeoperationerne for en collection. `insert`/`remove`/`reorder` dispatcher de tilsvarende reducer-row-
 * commands gennem den ene write-grænse (§3.6), så én brugerhandling giver højst ét history-trin. Row-delete
 * fjerner rækkens rejected descendants i samme reducertrin (§3.8) — kalderen skal ikke rydde celler først.
 */
export type CollectionRowsController<TEntity> = Readonly<{
  /** De aktuelle rækkers stabile entity-id'er i rækkefølge, læst fra den afsluttede revision. */
  rowIds: readonly string[];
  /** Indsæt en fuldt formet entity (typisk en tom række via row-factory) på `index` (default: sidst). */
  insert: (entity: TEntity, index?: number) => DispatchInputResult;
  /** Slet rækken med `entityId`; rejected descendants ryddes atomisk i samme command (§3.8). */
  remove: (entityId: string) => DispatchInputResult;
  /** Ny rækkefølge; skal indeholde præcis de eksisterende entity-id'er (katalogets reorder-invariant). */
  reorder: (orderedEntityIds: readonly string[]) => DispatchInputResult;
}>;

/**
 * Abonnerer på den afsluttede revision og udleder collectionens entity-id'er via katalogets `listEntityIds`.
 * Re-renderer kun ved en revisionsændring (det afsluttede snapshots identitet er stabil pr. revision), og id-
 * listen er cachet pr. sektionsidentitet, så `useSyncExternalStore`-identitetstjekket ikke looper.
 */
export const useCollectionRows = <TEntity>(collection: CollectionRef): CollectionRowsController<TEntity> => {
  const runtime = useInputRuntime();
  const { catalog, subscribe, getSettled, dispatch } = runtime;

  // Stabil nøgle for collectionen, så caches ikke krydser to forskellige collections i samme komponenttræ.
  const collectionKey = collectionCacheKey(collection);

  const rowIdsRef = React.useRef<{ key: string; sections: unknown; ids: readonly string[] } | null>(null);
  const getRowIds = React.useCallback((): readonly string[] => {
    const { input } = getSettled();
    const cached = rowIdsRef.current;
    // Genbrug den frosne id-liste, hvis hverken collection eller det afsluttede sections-objekt har ændret sig.
    if (cached !== null && cached.key === collectionKey && cached.sections === input.sections) {
      return cached.ids;
    }
    const ids = catalog.listEntityIds(input.sections, collection);
    rowIdsRef.current = { key: collectionKey, sections: input.sections, ids };
    return ids;
    // `collection` er værdimæssigt stabil pr. `collectionKey`; nøglen driver cachen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, getSettled, collectionKey]);

  const rowIds = useSyncExternalStore(subscribe, getRowIds, getRowIds);

  const insert = React.useCallback(
    (entity: TEntity, index?: number) => dispatch(insertRow(collection, entity, index)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, collectionKey]
  );
  const remove = React.useCallback(
    (entityId: string) => dispatch(deleteRow(collection, entityId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, collectionKey]
  );
  const reorder = React.useCallback(
    (orderedEntityIds: readonly string[]) => dispatch(reorderRows(collection, orderedEntityIds)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, collectionKey]
  );

  return React.useMemo(
    () => Object.freeze({ rowIds, insert, remove, reorder }),
    [rowIds, insert, remove, reorder]
  );
};
