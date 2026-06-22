import * as React from 'react';
// Infrastruktur-hook: importerer FormPersistenceContext direkte for at kunne degradere context-frit til
// no-op, når en tabel/side rendres uden provider (tests/isolerede render) — parallelt til
// useCellInvalidDraftChannel. Audited undtagelse i persistenceAccessIsolation-værnet.
import { FormPersistenceContext } from '../../contexts/FormPersistenceContext.internal';
import { CellInvalidDraftScopeContext } from '../../contexts/CellInvalidDraftScopeContext';
import { isCellInvalidDraftRowOrphan, isCellInvalidDraftScopeOrphan } from '../../config/cellInvalidDraftScopes';
import type { StorageKey } from '../../config/storageManifest';

/**
 * Ryd celle-`invalidDrafts` for rækker der ikke længere RENDERES i denne tabel (slettede rækker).
 *
 * Dette er `invalidDrafts`-kanalens modstykke til `useTableCellErrorTracker`s read-time-filtrering mod
 * gyldige rækker: en grid-celles ikke-committbare rå draft persisteres i et store-slice nøglet på rækkens
 * id (`${tableId}:${rowScope}:${rowId}:${col}`), og Gem-gaten (`saveBlockedFocus`) læser disse nøgler
 * DIREKTE. Sletter man en række der bærer en draft, forsvinder kun rækken fra sektionen — draften
 * forbliver og blokerer Gem som et spøgelses-mål uden et synligt felt at rette (overlever F5).
 *
 * Tabellen er den eneste der både kender sit scope (via `CellInvalidDraftScopeProvider`) OG sine aktuelt
 * renderede rækker, så reconcile hører hjemme her. Liveness er bevidst de RENDEREDE rækker (inkl. den
 * efterfølgende tomme række), ikke de committede — så en draft på en ellers tom, men stadig synlig række
 * fortsat blokerer Gem (uændret adfærd); kun en faktisk fjernet rækkes draft ryddes.
 *
 * `liveRowIds` SKAL være en memoiseret `Set` (stabil identitet pr. rækkeliste), ellers kører effekten
 * ved hver render. Effekten er en no-op (ingen store-/storage-skrivning, ingen undo-frame) når der ikke
 * findes forældreløse drafts — dvs. inert i normal redigering; den rører kun store ved en reel sletning.
 * Ubundet (ingen scope/provider, fx isolerede tabel-tests) → no-op.
 */
export const useReconcileInvalidDraftsToLiveRows = (liveRowIds: ReadonlySet<string>): void => {
  const scope = React.useContext(CellInvalidDraftScopeContext);
  const persistence = React.useContext(FormPersistenceContext);

  React.useEffect(() => {
    if (scope === null || persistence === null) return;
    persistence.reconcileInvalidDrafts(scope.pageKey, (fieldPath) =>
      isCellInvalidDraftRowOrphan(fieldPath, scope.tableId, scope.rowScope, liveRowIds)
    );
  }, [scope, persistence, liveRowIds]);
};

/**
 * Scope-niveau `invalidDrafts`-reconcile: ryd celle-drafts hvis deres rowScope (fx ansættelsesforhold-id)
 * ikke længere lever. Komplement til `useReconcileInvalidDraftsToLiveRows`: når et helt scope slettes
 * (AF fjernet), er dets tabeller afmonteret, så den per-tabel række-reconcile kan ikke nå deres drafts.
 *
 * Kaldes fra det lag der ejer scope-listen (fx lønindkomst-view-modellen), som IKKE selv ligger inde i en
 * `CellInvalidDraftScopeProvider` — derfor leveres `pageKey` + de scope-kvalificerede `tableIds` eksplicit.
 * `scopedTableIds` SKAL have stabil identitet (modul-konstant), så effekten ikke kører ved hver render.
 * Degraderer context-frit til no-op uden provider; fanger ingen undo-frame (housekeeping).
 */
export const useReconcileInvalidDraftScopes = (
  pageKey: StorageKey,
  scopedTableIds: readonly string[],
  liveRowScopes: ReadonlySet<string>
): void => {
  const persistence = React.useContext(FormPersistenceContext);

  React.useEffect(() => {
    if (persistence === null) return;
    persistence.reconcileInvalidDrafts(pageKey, (fieldPath) =>
      isCellInvalidDraftScopeOrphan(fieldPath, scopedTableIds, liveRowScopes)
    );
  }, [persistence, pageKey, scopedTableIds, liveRowScopes]);
};
