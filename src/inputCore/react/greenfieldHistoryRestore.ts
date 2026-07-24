import * as React from 'react';
import { serializeFieldAddress } from '../fieldAddress';
import type { FieldAddress } from '../fieldAddress';
import type { EditorLocation } from '../editor/fieldEditorState';
import type { HistoryOrigin } from '../inputHistory';
import { runHistoryTargetRestoreLoop } from '../../utils/historyTargetRestore';

// Greenfield undo/redo felt-fokus-restore (§3.7, WI-002 trin 3): efter en gennemført undo/redo re-targeteres fokus
// til det felt/celle, ændringen kom fra. Selve værdi-/draft-gendannelsen sker gennem den restored revision (§3.5) —
// denne modul flytter KUN fokus (+ scroll + fokus-ring) via den DELTE `runHistoryTargetRestoreLoop`, så legacy- og
// greenfield-restore ikke kan drifte fra hinanden.
//
// Til forskel fra legacy (der slog op via `data-mineo-undo-field-path`) lokaliserer greenfield målet PRÆCIST via
// BÅDE feltadressen OG editorlokationen. Det er nødvendigt, fordi samme datafelt kan redigeres flere steder (§3.2):
// fokus skal lande på den editor, der faktisk lavede ændringen — ikke en vilkårlig spejling af samme felt.

/** DOM-attribut for et greenfield-felts serialiserede feltadresse. Sat af form-/grid-surface på det fokuserbare element. */
export const GREENFIELD_FIELD_ADDRESS_ATTR = 'data-mineo-field-address';
/** DOM-attribut for greenfield-editorlokationens stabile id. Diskriminerer flere editorlokationer for samme felt. */
export const GREENFIELD_EDITOR_LOCATION_ATTR = 'data-mineo-editor-location-id';

/**
 * De to DOM-attributter, et greenfield-fokuserbart element skal bære, for at undo/redo-restoren kan finde det:
 * serialiseret feltadresse + editorlokations-id. Bygges af form-/grid-surfacen og spredes på det redigerbare
 * `<input>`. Samlet ÉT sted, så surface og restore-opslag ikke kan drifte fra hinanden.
 */
export type RestoreTargetAttributes = Readonly<{
  [GREENFIELD_FIELD_ADDRESS_ATTR]: string;
  [GREENFIELD_EDITOR_LOCATION_ATTR]: string;
}>;

export const buildRestoreTargetAttributes = (
  serializedFieldAddress: string,
  editorLocationId: string
): RestoreTargetAttributes => Object.freeze({
  [GREENFIELD_FIELD_ADDRESS_ATTR]: serializedFieldAddress,
  [GREENFIELD_EDITOR_LOCATION_ATTR]: editorLocationId,
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

const isVisible = (element: HTMLElement): boolean => {
  if (!element.isConnected) return false;
  if (element.hasAttribute('hidden')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('hidden')) return false;
    if (current.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
};

/**
 * Finder det synlige greenfield-fokusmål for en history-origin: elementet, der bærer BÅDE den serialiserede
 * feltadresse OG editorlokations-id'et. Returnerer `null`, hvis intet synligt match findes (fx endnu ikke mountet
 * efter et faneskift — den delte retry-løkke prøver igen).
 */
export const findGreenfieldRestoreTarget = (origin: HistoryOrigin): HTMLElement | null => {
  const selector = attrEquals(GREENFIELD_FIELD_ADDRESS_ATTR, serializeFieldAddress(origin.field))
    + attrEquals(GREENFIELD_EDITOR_LOCATION_ATTR, origin.editorLocationId);
  for (const element of document.querySelectorAll(selector)) {
    if (element instanceof HTMLElement && isVisible(element)) return element;
  }
  return null;
};

/**
 * Planlæg greenfield-fokusrestore for en gendannet undo/redo-origin. No-op, hvis origin ingen feltadresse har
 * (defensivt — en origin bærer altid en adresse i praksis). Genbruger den delte scroll-/fokus-/afbrydelses-løkke.
 */
export const scheduleGreenfieldHistoryTargetRestore = (origin: HistoryOrigin): void => {
  runHistoryTargetRestoreLoop(() => findGreenfieldRestoreTarget(origin));
};
