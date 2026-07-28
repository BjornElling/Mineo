import * as React from 'react';
import type { CollectionRef } from '../fieldAddress';
import type { FieldDescriptor, FieldRef } from '../fieldDescriptor';
import type { CellSpec } from './useCellEditor';

/**
 * Den ENE cellebindingsmodel for alle dynamiske tabeller (§1.11, §3.2).
 *
 * Problemet den løser: en celles dataidentitet er `descriptor` bundet til HELE ejerstien — for en top-level
 * collection kun rækkens entity-id, for en nested collection (fx EO's løntabel under ét ansættelsesforhold)
 * ejerens id FØRST og derefter rækkens. Da hver tabel tidligere byggede sit eget celle-spec, kunne hver af dem
 * vælge sin egen bindingsmodel, og en nested tabel kunne binde med for få entity-led. Adresseariteten er
 * håndhævet i `FieldDescriptor.bind`, så bruddet blev en runtime-fejl under render frem for en typefejl.
 *
 * Her bindes BEGGE cellearter ét sted, ud fra den samme `ownerEntityIds`-præfiks, så en eksisterende celle og
 * dens placeholder aldrig kan få forskellig adressestruktur.
 */
export type CollectionCellBinding<TEntity> = Readonly<{
  /** Collectionen rækkerne bor i. Bærer selv ejerstien, så den ER kilden til ejer-id'erne. */
  collection: CollectionRef;
  /** Opret den fuldt schemaformede tom-række-entity, som en promotion indsætter. */
  createEmptyRow: (rowId: string) => TEntity;
  /** Stabilt lokations-præfiks for cellernes editorlokationer (§3.7). */
  locationPrefix: string;
  /**
   * Eksplicit navigation-metadata for editorlokationen (§3.7): route + fane. PÅKRÆVET, så en celles undo/redo
   * altid kan navigere til den side/fane, ændringen kom fra. `tabKey: null` = siden har ingen faner.
   */
  locationNav: Readonly<{ route: string; tabKey: string | null }>;
}>;

/** En række i den viste tabel: enten en committet række eller en endnu ikke oprettet placeholder. */
export type CollectionRenderRow = Readonly<{ rowId: string; kind: 'existing' | 'placeholder' }>;

/**
 * Ejer-id'erne før rækkens eget id, udledt af collectionens egen sti — ikke af en separat prop.
 *
 * Det er dét, der gør en forkert arity umulig at indføre lokalt: den samme sti, `insertEntity` og readeren
 * bruger, er også den, cellen bindes fra. En nested collection giver automatisk `[ejerId]`, en top-level `[]`.
 */
export const collectionOwnerEntityIds = (collection: CollectionRef): readonly string[] =>
  collection.path.flatMap((segment) => segment.kind === 'entity' ? [segment.entityId] : []);

/**
 * Den ENE bindingsregel for en celle i en collection: ejerstien fra collectionen, derefter rækkens id.
 *
 * Udtrykket er eksporteret, fordi der er TO legitime aftagere: celle-spec-byggeren nedenfor (redigering) og
 * den fælles løntabel-reader-adapter (rekonstruktion + cellefejl). Begge skal binde IDENTISK — kunne de
 * divergere, ville en celle blive redigeret på én adresse og læst på en anden, og fejlen ville vise sig som
 * en lydløst tom celle (jf. INC-F01). Derfor er reglen ét udtryk og ikke en gentaget `bind(...)`-linje.
 */
export const bindCollectionCell = <T>(
  collection: CollectionRef,
  descriptor: FieldDescriptor<T>,
  rowId: string
): FieldRef<T> => descriptor.bind(...collectionOwnerEntityIds(collection), rowId);

/**
 * Kanonisk, kollisionsfrit lokations-præfiks for en collection-instans (§3.7).
 *
 * Ejer-id'erne SKAL med: EO renderer én løntabel pr. ansættelsesforhold, altså flere instanser af samme
 * collection-type samtidigt. Et præfiks på kun `section.collection` ville give to kort identiske editorlokationer,
 * og en undo/redo kunne dermed fokusere den forkerte tabels celle.
 */
export const collectionLocationPrefix = (collection: CollectionRef): string => {
  const owners = collectionOwnerEntityIds(collection);
  const ownerSuffix = owners.length === 0 ? '' : `[${owners.join('/')}]`;
  return `${collection.section}.${collection.collection}${ownerSuffix}`;
};

/**
 * Byg celle-spec'et for én celle. Både `existing` og `placeholder` bærer en FULDT bundet `FieldRef`, bundet med
 * hele ejerstien fra collectionen efterfulgt af rækkens entity-id.
 */
export const buildCollectionCellSpec = <T, TEntity>(
  binding: CollectionCellBinding<TEntity>,
  renderRow: CollectionRenderRow,
  descriptor: FieldDescriptor<T>,
  colIndex: number
): CellSpec<T, TEntity> => {
  const field: FieldRef<T> = bindCollectionCell(binding.collection, descriptor, renderRow.rowId);
  const location = {
    locationId: `${binding.locationPrefix}:${renderRow.rowId}:${String(colIndex)}`,
    route: binding.locationNav.route,
    tabKey: binding.locationNav.tabKey,
  };
  if (renderRow.kind === 'existing') return { kind: 'existing', field, location };
  return {
    kind: 'placeholder',
    field,
    collection: binding.collection,
    entity: binding.createEmptyRow(renderRow.rowId),
    location,
  };
};

/** Den memoiserede celle-spec-bygger til en tabelkomponent. */
export type CollectionCellSpecBuilder<TEntity> = <T>(
  renderRow: CollectionRenderRow,
  descriptor: FieldDescriptor<T>,
  colIndex: number
) => CellSpec<T, TEntity>;

/**
 * React-indpakningen: én stabil celle-spec-bygger pr. tabel.
 *
 * Memoiseret på bindingens VÆRDIMÆSSIGE identitet, ikke på objektidentitet: `collection` og `locationNav` er
 * literaler, callsites genskaber ved hver render, så en referencebaseret dep-liste ville give en ny bygger hver
 * gang og dermed et nyt celle-spec under en åben editor.
 */
export const useCollectionCellSpecBuilder = <TEntity>(
  binding: CollectionCellBinding<TEntity>
): CollectionCellSpecBuilder<TEntity> => {
  const { collection, createEmptyRow, locationPrefix, locationNav } = binding;
  const collectionKey = JSON.stringify(collection);
  const navKey = `${locationNav.route}|${locationNav.tabKey ?? ''}`;
  const bindingRef = React.useRef(binding);
  bindingRef.current = binding;
  return React.useCallback(
    <T,>(renderRow: CollectionRenderRow, descriptor: FieldDescriptor<T>, colIndex: number) =>
      buildCollectionCellSpec<T, TEntity>(bindingRef.current, renderRow, descriptor, colIndex),
    // Værdimæssige nøgler: en ny bygger kun når collectionen, rækkefabrikken, præfikset eller destinationen
    // reelt ændrer sig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collectionKey, createEmptyRow, locationPrefix, navKey]
  );
};
