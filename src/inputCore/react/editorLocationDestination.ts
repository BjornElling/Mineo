import { FIELD_ADDRESS_ATTR, EDITOR_ROUTE_ATTR, EDITOR_TAB_ATTR } from './historyRestoreTarget';
import { isRestoreTargetVisible } from './historyTargetRestoreLoop';

// Fokusdestinationen ejes af EDITORLOKATIONEN, ikke af feltets dataadresse (§3.2).
//
// Den afløste model (`fieldAddressDestination.ts`, R7-F03) afbildede en feltadresse til route + fane gennem fem
// globale kort, sektionsdefaults og særregler for brugerens aktuelle route. Kortene måtte kompensere, hver gang
// et felt blev redigeret på mere end ét sted — `faellesAarsloen` uden egen route, de tre forligsfelter på både
// EO-oplysninger og EETs Differencekrav, `eoBilagSelection` hvis felter HEDDER som andre faners felter. Hver
// særregel var evidens for det samme: dataidentiteten kan ikke afgøre, hvor feltet redigeres.
//
// Her spørger vi i stedet den editor, der faktisk RENDERER feltet. En mounted editor bærer sin egen destination
// i DOM (`data-mineo-editor-route`/`-tab`, sat af form-/grid-surfacen fra `EditorLocation`), og den er sand pr.
// konstruktion: attributten står på præcis det element, brugeren skal ende på. To spejlede editorer for samme
// felt giver derfor to forskellige destinationer uden en eneste særregel.
//
// EO's faner mountes ved første besøg og forbliver mountet (skjult med `display: none`), så en editor på en
// besøgt fane findes i DOM, selv når fanen ikke er synlig. Netop derfor kan destinationen læses af DOM: opslaget
// skelner MOUNTET (destination kendes) fra SYNLIG (fokus kan ske straks).

/** Destinationen for en konkret editorlokation: hvor brugeren skal føres hen for at se den. */
export type EditorLocationDestination = Readonly<{
  /** Route lokationen hører til. */
  route: string;
  /** Fane inden for `route`, eller `null` hvis siden ikke har faner. */
  tabKey: string | null;
}>;

/** Udfaldet af at slå en feltadresse op blandt de mounted editorer. */
export type EditorLocationLookup =
  /** Editoren er mountet OG synlig: fokusér den, hvor brugeren står. Ingen navigation. */
  | Readonly<{ kind: 'visible'; element: HTMLElement }>
  /** Editoren er mountet, men skjult (fx en ikke-aktiv fane): den kender sin egen destination. */
  | Readonly<{ kind: 'mounted'; element: HTMLElement; destination: EditorLocationDestination }>
  /** Ingen editor for adressen er mountet: destinationen kan ikke udledes af en lokation. */
  | Readonly<{ kind: 'unmounted' }>;

const attrEquals = (attr: string, value: string): string => `[${attr}=${JSON.stringify(value)}]`;

/**
 * Lokationens erklærede destination, læst af elementet selv.
 *
 * `EditorLocation.route` er PÅKRÆVET, så en inputsurface sætter altid attributten. Guarden mod en
 * manglende/tom værdi er derfor ikke et "ikke navigerbar"-begreb — det er defensiv DOM-læsning: finder vi et
 * element, der bærer feltadressen UDEN en route (et fremmed element med samme attribut, eller en surface, der
 * ikke er gået gennem `buildRestoreTargetAttributes`), er "jeg ved det ikke" det sande svar. Vi behandler det
 * som ukendt frem for at gætte en route.
 */
const readDeclaredDestination = (element: HTMLElement): EditorLocationDestination | null => {
  const route = element.getAttribute(EDITOR_ROUTE_ATTR) ?? '';
  if (route === '') return null;
  const tab = element.getAttribute(EDITOR_TAB_ATTR) ?? '';
  return Object.freeze({ route, tabKey: tab === '' ? null : tab });
};

/**
 * Find den editor, der viser feltet på `serializedAddress`, og hvad den siger om sin egen placering.
 *
 * En SYNLIG editor vinder altid: kan feltet rettes, hvor brugeren står, bliver brugeren dér (den godkendte
 * adfærd for R7-F03). Ellers bruges en mountet, men skjult editors egen destination. Er flere spejlede editorer
 * mountet og skjulte, vælges den første i dokumentrækkefølge — vilkårligt, men entydigt, og enhver af dem er en
 * gyldig flade for feltet.
 */
export const lookupEditorLocation = (serializedAddress: string): EditorLocationLookup => {
  if (typeof document === 'undefined') return Object.freeze({ kind: 'unmounted' });

  const elements = document.querySelectorAll(attrEquals(FIELD_ADDRESS_ATTR, serializedAddress));
  let mounted: EditorLocationLookup | null = null;

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    if (isRestoreTargetVisible(element)) return Object.freeze({ kind: 'visible', element });
    if (mounted !== null) continue;
    const destination = readDeclaredDestination(element);
    if (destination !== null) mounted = Object.freeze({ kind: 'mounted', element, destination });
  }

  return mounted ?? Object.freeze({ kind: 'unmounted' });
};
