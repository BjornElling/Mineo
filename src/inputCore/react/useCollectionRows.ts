import * as React from 'react';
import type { CollectionRef } from '../fieldAddress';
import { insertRow, deleteRow, reorderRows } from '../inputReducer';
import {
  useInputEditPort,
  useInternalInputCatalog,
  useInternalSettledSnapshot,
} from './inputRuntimeContext';
import type { DispatchInputResult } from '../runtime/dispatchInput';
import type { CollectionHistoryOrigin } from '../inputHistory';

// React-laget (§2.5 trin 1 / §3.8): rækkeinfrastrukturen for en dynamisk collection. Den ejer KUN de
// stabile entity-id'er, rækkefølgen og add/delete/reorder — læst DIREKTE fra den afsluttede revision gennem
// katalogets `listEntityIds`. Der findes ingen `draftRows`, `internalTableData`, fingerprint-kopi eller
// effect-flush til persistence (§3.8): en celles værdi bor kun i inputaggregaten, aldrig i en konkurrerende
// række-værdikopi. Selve celleredigeringen ejes af `useCellEditor`; denne hook rører aldrig en celleværdi.

/**
 * Tabellens editorlokation, som en rækkehandlings history-origin skal pege på (§3.7). Kalderen leverer den,
 * fordi kun siden/fanen ved, hvor tabellen bor.
 *
 * ALLE tre felter er PÅKRÆVEDE. Var `route`/`tabKey` valgfrie, kunne en rækkehandling lydløst få en origin uden
 * destination: undo/redo ville gendanne dataene, men efterlade brugeren på en vilkårlig side. `tabKey: null`
 * udtrykker eksplicit "siden har ingen faner" — udeladelse er ikke en lovlig måde at sige det på.
 */
export type CollectionRowOrigin = Readonly<{
  /** Stabilt id for tabellens lokation, fx `eo.oevrigeKrav`. */
  locationId: string;
  /** Route tabellen bor på. Påkrævet, så destinationen altid er navigerbar. */
  route: string;
  /** Fanen inden for `route`, eller `null` for en side uden faner. */
  tabKey: string | null;
}>;

/**
 * Origin for en STRUKTUREL rækkehandling. `kind: 'collection'` gør det type-synligt, at der ikke findes én
 * feltadresse at fokusere; til gengæld er destinationen (route + fane) obligatorisk, så en undo/redo af
 * insert/delete/reorder altid kan navigere til den tabel, ændringen kom fra.
 *
 * EKSPORTERET, fordi et par flader udsteder strukturelle rækketransaktioner direkte gennem
 * `runtime.dispatch` i stedet for gennem denne hook (sygedagpenge-indsættelsen, midlertidigt-EET-togglen og
 * sletningen af et ansættelsesforhold). De skal bygge origin PÅ SAMME MÅDE — ellers ville
 * `editorLocationId`-formen drifte mellem to steder (WI-004 runde 4, fund S4).
 */
export const buildRowHistoryOrigin = (
  collection: CollectionRef,
  origin: CollectionRowOrigin
): CollectionHistoryOrigin => Object.freeze({
  kind: 'collection' as const,
  collection: collection.collection,
  editorLocationId: `${origin.locationId}:rows:${collection.collection}`,
  route: origin.route,
  tabKey: origin.tabKey,
});

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
export type CollectionRowCommands<TEntity> = Readonly<{
  /** Indsæt en fuldt formet entity (typisk en tom række via row-factory) på `index` (default: sidst). */
  insert: (entity: TEntity, index?: number) => DispatchInputResult;
  /** Slet rækken med `entityId`; rejected descendants ryddes atomisk i samme command (§3.8). */
  remove: (entityId: string) => DispatchInputResult;
  /** Ny rækkefølge; skal indeholde præcis de eksisterende entity-id'er (katalogets reorder-invariant). */
  reorder: (orderedEntityIds: readonly string[]) => DispatchInputResult;
}>;

export type CollectionRowsController<TEntity> = CollectionRowCommands<TEntity> & Readonly<{
  /** De aktuelle rækkers stabile entity-id'er i rækkefølge, læst fra den afsluttede revision. */
  rowIds: readonly string[];
}>;

/**
 * Abonnerer på den afsluttede revision og udleder collectionens entity-id'er via katalogets `listEntityIds`.
 * Re-renderer kun ved en revisionsændring (det afsluttede snapshots identitet er stabil pr. revision), og id-
 * listen er cachet pr. sektionsidentitet, så `useSyncExternalStore`-identitetstjekket ikke looper.
 */
export const useCollectionRows = <TEntity>(
  collection: CollectionRef,
  origin: CollectionRowOrigin
): CollectionRowsController<TEntity> => {
  const catalog = useInternalInputCatalog();
  const { input } = useInternalSettledSnapshot();
  const commands = useCollectionRowCommands<TEntity>(collection, origin);

  // Stabil nøgle for collectionen, så caches ikke krydser to forskellige collections i samme komponenttræ.
  const collectionKey = collectionCacheKey(collection);

  const rowIdsRef = React.useRef<{ key: string; sections: unknown; ids: readonly string[] } | null>(null);
  const getRowIds = React.useCallback((): readonly string[] => {
    const cached = rowIdsRef.current;
    // Genbrug den frosne id-liste, hvis hverken collection eller det afsluttede sections-objekt har ændret sig.
    if (cached !== null && cached.key === collectionKey && cached.sections === input.sections) {
      return cached.ids;
    }
    const ids = catalog.listEntityIds(input.sections, collection);
    rowIdsRef.current = { key: collectionKey, sections: input.sections, ids };
    return ids;
  }, [catalog, input, collection, collectionKey]);

  const rowIds = getRowIds();

  return React.useMemo(
    () => Object.freeze({ rowIds, ...commands }),
    [rowIds, commands]
  );
};

/**
 * KUN rækkekommandoerne — uden abonnement på collectionens id-liste.
 *
 * Til consumers, der allerede får rækkerne fra en slice-projektion (den kanoniske read-grænse, §3.4) og derfor
 * ikke skal have et konkurrerende aggregat-read for samme collection. Det giver ÉN reaktiv rækkekilde pr. tabel.
 *
 * Hver kommando bærer en struktur-origin (§3.7), så en undo/redo af en rækkehandling kan navigere til den rette
 * route/fane. `locationNav` leveres af kalderen, fordi kun den ved, hvor tabellen bor.
 */
export const useCollectionRowCommands = <TEntity>(
  collection: CollectionRef,
  origin: CollectionRowOrigin
): CollectionRowCommands<TEntity> => {
  const { dispatch } = useInputEditPort();
  const collectionKey = collectionCacheKey(collection);
  const originKey = `${origin.locationId}|${origin.route}|${origin.tabKey ?? ''}`;

  // En rækkehandling har ingen enkelt feltadresse; origin bærer i stedet tabellens editorlokation, så
  // restoren kan navigere til den rette side/fane efter en undo/redo af insert/delete/reorder.
  // Destinationen er OBLIGATORISK: en rækkehandling uden lokation ville gendanne data, men efterlade brugeren
  // på en vilkårlig side (§3.7).
  const rowOrigin = React.useMemo(
    () => buildRowHistoryOrigin(collection, origin),
    // `collection`/`origin` er værdimæssigt stabile pr. nøgle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionKey, originKey]
  );

  const insert = React.useCallback(
    (entity: TEntity, index?: number) => dispatch(insertRow(collection, entity, index), rowOrigin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, collectionKey, rowOrigin]
  );
  const remove = React.useCallback(
    (entityId: string) => dispatch(deleteRow(collection, entityId), rowOrigin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, collectionKey, rowOrigin]
  );
  const reorder = React.useCallback(
    (orderedEntityIds: readonly string[]) => dispatch(reorderRows(collection, orderedEntityIds), rowOrigin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, collectionKey, rowOrigin]
  );

  return React.useMemo(() => Object.freeze({ insert, remove, reorder }), [insert, remove, reorder]);
};
