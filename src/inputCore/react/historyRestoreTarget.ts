import * as React from 'react';
import { serializeFieldAddress } from '../fieldAddress';
import type { FieldAddress } from '../fieldAddress';
import type { EditorLocation } from '../editor/fieldEditorState';
import type { HistoryOrigin } from '../inputHistory';
import { isRestoreTargetVisible, runHistoryTargetRestoreLoop } from './historyTargetRestoreLoop';

// Undo/redo felt-fokus-restore (§3.7): efter en gennemført undo/redo re-targeteres fokus
// til det felt/celle, ændringen kom fra. Selve værdi-/draft-gendannelsen sker gennem den restored revision (§3.5) –
// dette modul flytter KUN fokus (+ scroll + fokus-ring) via den DELTE `runHistoryTargetRestoreLoop`.
//
// Målet lokaliseres PRÆCIST via BÅDE feltadressen OG editorlokationen. Begge dele er nødvendige, fordi samme
// datafelt kan redigeres flere steder (§3.2): fokus skal lande på den editor, der faktisk lavede ændringen –
// ikke en vilkårlig spejling af samme felt. Adressen alene kan derfor ikke bære identiteten.
//
// Attributterne her er DEN ENE feltidentitet i DOM: undo/redo, save-blokeringens fokus og EO's fejllinks slår
// alle op på dem. Håndhævet af `input/single-field-identity-in-dom`.

/** DOM-attribut for et felts serialiserede feltadresse. Sat af form-/grid-surface på det fokuserbare element. */
export const FIELD_ADDRESS_ATTR = 'data-mineo-field-address';
/** DOM-attribut for editorlokationens stabile id. Diskriminerer flere editorlokationer for samme felt. */
export const EDITOR_LOCATION_ATTR = 'data-mineo-editor-location-id';
/** DOM-attribut for editorlokationens EGEN route (§3.2). Sættes altid; `route` er påkrævet på lokationen. */
export const EDITOR_ROUTE_ATTR = 'data-mineo-editor-route';
/** DOM-attribut for editorlokationens EGEN fane. Tom streng når siden ikke har faner, eller lokationen ikke er navigerbar. */
export const EDITOR_TAB_ATTR = 'data-mineo-editor-tab';

/**
 * De DOM-attributter, et fokuserbart element skal bære, for at fokusnavigationen kan finde det:
 * serialiseret feltadresse + editorlokations-id + lokationens EGEN destination (route + fane). Bygges af
 * form-/grid-surfacen og spredes på det redigerbare `<input>`. Samlet ÉT sted, så surface og opslag ikke kan
 * drifte fra hinanden.
 *
 * Destinationen står HER – på den konkrete editor – og ikke i et globalt feltadresse→fane-kort (§3.2). Feltets
 * dataadresse er dataidentitet og DOM-matchnøgle; hvor feltet REDIGERES, ved kun editorlokationen. Et felt kan
 * redigeres på flere sider (fx `faellesAarsloen`, forligsfelterne), og en global afbildning måtte da kompensere
 * med særregler for brugerens aktuelle route og dermed skabe en parallel destinationsmodel.
 */
export type RestoreTargetAttributes = Readonly<{
  [FIELD_ADDRESS_ATTR]: string;
  [EDITOR_LOCATION_ATTR]: string;
  [EDITOR_ROUTE_ATTR]: string;
  [EDITOR_TAB_ATTR]: string;
}>;

/**
 * Bygger attributterne af feltadressen og lokationens PRIMITIVE felter. Primitiver frem for `EditorLocation`-
 * objektet, fordi hvert kaldssted memoiserer på netop dem: kaldssiderne konstruerer typisk en frisk `loc(...)`
 * pr. render, og en objekt-dep ville gøre memoiseringen virkningsløs.
 */
export const buildRestoreTargetAttributes = (
  serializedFieldAddress: string,
  editorLocationId: string,
  route: string,
  tabKey: string | null
): RestoreTargetAttributes => Object.freeze({
  [FIELD_ADDRESS_ATTR]: serializedFieldAddress,
  [EDITOR_LOCATION_ATTR]: editorLocationId,
  // Attributterne sættes ALTID, fordi typen kræver værdierne. `tabKey: null` (side uden faner) bliver en tom
  // fane-attribut – ikke en udeladt attribut, for da kunne fraværet ikke skelnes fra "surfacen glemte den".
  [EDITOR_ROUTE_ATTR]: route,
  [EDITOR_TAB_ATTR]: tabKey ?? '',
});

/**
 * De restore-target-attributter for et felt + editorlokation, memoiseret. Til de immediate-commit-controls
 * (dropdown/toggle/radio/checkbox), der IKKE bruger `useFormFieldSurface`/`useGridCellSurface` og derfor selv skal
 * sætte attributterne på deres fokuserbare element. Form-/grid-surfacen returnerer i stedet attributterne direkte.
 */
export const useRestoreTargetAttributes = (
  fieldAddress: FieldAddress,
  location: EditorLocation
): RestoreTargetAttributes => {
  const { locationId, route, tabKey } = location;
  return React.useMemo(
    () => buildRestoreTargetAttributes(serializeFieldAddress(fieldAddress), locationId, route, tabKey),
    [fieldAddress, locationId, route, tabKey]
  );
};

const attrEquals = (attr: string, value: string): string => `[${attr}=${JSON.stringify(value)}]`;

/**
 * Finder det synlige fokusmålet for en history-origin: elementet, der bærer BÅDE den serialiserede
 * feltadresse OG editorlokations-id'et. Returnerer `null`, hvis intet synligt match findes (fx endnu ikke mountet
 * efter et faneskift – den delte retry-løkke prøver igen).
 *
 * En STRUKTUREL rækkehandling (insert/delete/reorder) har ingen feltadresse. Der findes da intet enkelt felt at
 * fokusere: shellen har allerede navigeret til origin-lokationens route/fane, og vi flytter ikke fokus derudover.
 */
export const findRestoreTarget = (origin: HistoryOrigin): HTMLElement | null => {
  if (origin.kind !== 'field') return null;
  const selector = attrEquals(FIELD_ADDRESS_ATTR, serializeFieldAddress(origin.field))
    + attrEquals(EDITOR_LOCATION_ATTR, origin.editorLocationId);
  for (const element of document.querySelectorAll(selector)) {
    if (element instanceof HTMLElement && isRestoreTargetVisible(element)) return element;
  }
  return null;
};

/**
 * Planlæg fokusrestore for en gendannet undo/redo-origin. Genbruger den delte scroll-/fokus-/
 * afbrydelses-løkke. For en rækkehandling uden feltadresse springes fokus-restoren over (kun navigationen,
 * som shellen allerede har udført, er relevant) – løkken startes da ikke unødigt.
 */
export const scheduleHistoryTargetRestore = (origin: HistoryOrigin): void => {
  if (origin.kind !== 'field') return;
  runHistoryTargetRestoreLoop(
    () => findRestoreTarget(origin),
    // Kun til diagnostikken, når målet aldrig dukker op: begge halvdele af identiteten skal med, for det er
    // netop dét par, opslaget kræver – og et brud sidder typisk i editorlokationen, ikke i feltadressen.
    () => `${serializeFieldAddress(origin.field)} @ ${origin.editorLocationId}`
  );
};
