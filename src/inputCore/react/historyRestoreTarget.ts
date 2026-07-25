import * as React from 'react';
import { serializeFieldAddress } from '../fieldAddress';
import type { FieldAddress } from '../fieldAddress';
import type { EditorLocation } from '../editor/fieldEditorState';
import type { HistoryOrigin } from '../inputHistory';
import { isRestoreTargetVisible, runHistoryTargetRestoreLoop } from './historyTargetRestoreLoop';

// Greenfield undo/redo felt-fokus-restore (§3.7, WI-002 trin 3): efter en gennemført undo/redo re-targeteres fokus
// til det felt/celle, ændringen kom fra. Selve værdi-/draft-gendannelsen sker gennem den restored revision (§3.5) —
// denne modul flytter KUN fokus (+ scroll + fokus-ring) via den DELTE `runHistoryTargetRestoreLoop`, så legacy- og
// greenfield-restore ikke kan drifte fra hinanden.
//
// Til forskel fra legacy (der slog op via `data-mineo-undo-field-path`) lokaliserer greenfield målet PRÆCIST via
// BÅDE feltadressen OG editorlokationen. Det er nødvendigt, fordi samme datafelt kan redigeres flere steder (§3.2):
// fokus skal lande på den editor, der faktisk lavede ændringen — ikke en vilkårlig spejling af samme felt.

/** DOM-attribut for et greenfield-felts serialiserede feltadresse. Sat af form-/grid-surface på det fokuserbare element. */
export const FIELD_ADDRESS_ATTR = 'data-mineo-field-address';
/** DOM-attribut for greenfield-editorlokationens stabile id. Diskriminerer flere editorlokationer for samme felt. */
export const EDITOR_LOCATION_ATTR = 'data-mineo-editor-location-id';

/**
 * De to DOM-attributter, et greenfield-fokuserbart element skal bære, for at undo/redo-restoren kan finde det:
 * serialiseret feltadresse + editorlokations-id. Bygges af form-/grid-surfacen og spredes på det redigerbare
 * `<input>`. Samlet ÉT sted, så surface og restore-opslag ikke kan drifte fra hinanden.
 */
export type RestoreTargetAttributes = Readonly<{
  [FIELD_ADDRESS_ATTR]: string;
  [EDITOR_LOCATION_ATTR]: string;
}>;

export const buildRestoreTargetAttributes = (
  serializedFieldAddress: string,
  editorLocationId: string
): RestoreTargetAttributes => Object.freeze({
  [FIELD_ADDRESS_ATTR]: serializedFieldAddress,
  [EDITOR_LOCATION_ATTR]: editorLocationId,
});

/**
 * De restore-target-attributter for et felt + editorlokation, memoiseret. Til de immediate-commit-controls
 * (dropdown/toggle/radio/checkbox), der IKKE bruger `useFormFieldSurface`/`useGridCellSurface` og derfor selv skal
 * sætte attributterne på deres fokuserbare element. Form-/grid-surfacen returnerer i stedet attributterne direkte.
 */
export const useRestoreTargetAttributes = (
  fieldAddress: FieldAddress,
  location: EditorLocation
): RestoreTargetAttributes =>
  React.useMemo(
    () => buildRestoreTargetAttributes(serializeFieldAddress(fieldAddress), location.locationId),
    [fieldAddress, location.locationId]
  );

const attrEquals = (attr: string, value: string): string => `[${attr}=${JSON.stringify(value)}]`;

/**
 * Finder det synlige greenfield-fokusmål for en history-origin: elementet, der bærer BÅDE den serialiserede
 * feltadresse OG editorlokations-id'et. Returnerer `null`, hvis intet synligt match findes (fx endnu ikke mountet
 * efter et faneskift — den delte retry-løkke prøver igen).
 *
 * En STRUKTUREL rækkehandling (insert/delete/reorder) har ingen feltadresse. Der findes da intet enkelt felt at
 * fokusere: shellen har allerede navigeret til origin-lokationens route/fane, og vi flytter ikke fokus derudover.
 */
export const findRestoreTarget = (origin: HistoryOrigin): HTMLElement | null => {
  if (origin.field === undefined) return null;
  const selector = attrEquals(FIELD_ADDRESS_ATTR, serializeFieldAddress(origin.field))
    + attrEquals(EDITOR_LOCATION_ATTR, origin.editorLocationId);
  for (const element of document.querySelectorAll(selector)) {
    if (element instanceof HTMLElement && isRestoreTargetVisible(element)) return element;
  }
  return null;
};

/**
 * Planlæg greenfield-fokusrestore for en gendannet undo/redo-origin. Genbruger den delte scroll-/fokus-/
 * afbrydelses-løkke. For en rækkehandling uden feltadresse springes fokus-restoren over (kun navigationen,
 * som shellen allerede har udført, er relevant) — løkken startes da ikke unødigt.
 */
export const scheduleHistoryTargetRestore = (origin: HistoryOrigin): void => {
  if (origin.field === undefined) return;
  runHistoryTargetRestoreLoop(() => findRestoreTarget(origin));
};
