/**
 * Scroll + fokus til det input, et navigerbart EO-issue peger på.
 *
 * Fokusmålet er en KANONISK feltadresse (§3.2) og slås op med `lookupEditorLocation` — præcis den
 * mekanisme undo/redo (`findRestoreTarget`) og save-blokeringens fokus bruger. Der findes derfor kun ÉT
 * identitetssystem for "hvilket felt skal brugeren se": adressen, som feltet selv bærer i DOM
 * (`data-mineo-field-address`), sat af form-/grid-surfacen for hver editorlokation.
 *
 * Rækkeankeret (`data-mineo-row-id`) er ikke et alternativt identitetssystem, men det GROVERE mål: en
 * rækkefejl uden ét ansvarligt felt (fx et overlap mellem to rækker) kan kun forankres til rækken. Det
 * bruges også som fallback, hvis feltets editor ikke er synlig.
 */
import { scrollWithRetry } from './scrollWithRetry';
import { serializeFieldAddress } from '../inputCore/fieldAddress';
import { lookupEditorLocation } from '../inputCore/react/editorLocationDestination';
import { blinkFieldAttention } from '../inputCore/react/fieldAttentionBlink';
import type { EoIssueFocusTarget } from '../domain/eoRowEvaluation/eoRowTypes';

const resolveAnchorIdFromRowId = (rowId: string): string | null => {
  const loenindkomstMatch = rowId.match(/^loenindkomst\.([^.]+)(?:\.|$)/);
  if (loenindkomstMatch) return loenindkomstMatch[1];
  const sfggPostTableMatch = rowId.match(/^sfgg\.eftertabel\.[^.]+\.([^.]+)$/);
  if (sfggPostTableMatch) return sfggPostTableMatch[1];
  const sfggMatch = rowId.match(/^sfgg\.[^.]+\.([^.]+)(?:\.|$)/);
  if (sfggMatch) return sfggMatch[1];

  const patterns: readonly RegExp[] = [
    /^sviesmerte\.periode\.([^.]+)(?:\.|$)/,
    /^taf\.periode\.([^.]+)(?:\.|$)/,
    /^taf\.ferie\.([^.]+)(?:\.|$)/,
    /^taf\.beregningsgrundlag\.ferie\.([^.]+)(?:\.|$)/,
    /^offentligeYdelser\.([^.]+)(?:\.|$)/,
    /^oevrigekrav\.([^.]+)(?:\.|$)/,
  ];

  for (const pattern of patterns) {
    const match = rowId.match(pattern);
    if (match) return match[1];
  }

  return null;
};

const findElementByMineoRowId = (rowId: string): HTMLElement | null => {
  if (typeof document === 'undefined') return null;

  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    const escaped = CSS.escape(rowId);
    const bySelector = document.querySelector<HTMLElement>(`[data-mineo-row-id="${escaped}"]`);
    if (bySelector) return bySelector;
  }

  const all = Array.from(document.querySelectorAll<HTMLElement>('[data-mineo-row-id]'));
  return all.find((el) => el.getAttribute('data-mineo-row-id') === rowId) ?? null;
};

/**
 * Feltets SYNLIGE editor, hvis den findes.
 *
 * Kun `visible` er et brugbart scroll-/fokusmål: et mountet-men-skjult felt (fx på en besøgt, men
 * ikke-aktiv EO-fane, som forbliver mountet med `display: none`) kan ikke ses, og en scroll dertil ville
 * ramme ingenting. Retry-løkken kalder igen pr. frame, så en editor, der bliver synlig efter shellens
 * fane-/route-skift, findes så snart den er der.
 */
const findVisibleFieldEditor = (address: EoIssueFocusTarget & { kind: 'fieldAddress' }): HTMLElement | null => {
  const lookup = lookupEditorLocation(serializeFieldAddress(address.address));
  return lookup.kind === 'visible' ? lookup.element : null;
};

const findElementByFocusTarget = (target: EoIssueFocusTarget | undefined): HTMLElement | null => {
  if (target === undefined) return null;
  if (target.kind === 'rowId') return findElementByMineoRowId(target.rowId);
  return findVisibleFieldEditor(target);
};

export const scrollToEoRow = (
  rowId: string,
  options: {
    focusTarget?: EoIssueFocusTarget;
    maxRetries?: number;
    onSuccess?: () => void;
    onFailure?: (reason: string) => void;
  } = {}
): void => {
  const anchorId = resolveAnchorIdFromRowId(rowId);
  if (!anchorId && !options.focusTarget) {
    options.onFailure?.(`No row anchor could be resolved from rowId="${rowId}"`);
    return;
  }

  const { maxRetries = 150, onSuccess, onFailure } = options;

  scrollWithRetry({
    maxRetries,
    findTarget: () => {
      const focusedElement = findElementByFocusTarget(options.focusTarget);

      if (options.focusTarget?.kind === 'rowId') {
        // Et bevidst samlet rækkeanker må ikke falde tilbage til et overordnet
        // kort: det ville blinke et felt, som ikke er årsagen til fejlen.
        return focusedElement;
      }

      return focusedElement ?? (anchorId ? findElementByMineoRowId(anchorId) : null);
    },
    // behavior udelades bevidst: scrollTargetIntoView afleder den fra prefers-reduced-motion.
    onSuccess: (target) => {
      // Den delte blinkmarkering: når linket har ført brugeren hen til indtastningen, peger
      // markeringen på PRÆCIS det element, der blev scrollet til. Faldt vi tilbage til rækkeankeret,
      // blinker rækken — det grovere, men stadig sande mål for en fejl uden ét ansvarligt felt.
      blinkFieldAttention(target);
      onSuccess?.();
    },
    onFailure,
    failureMessage: `Could not find focus target or data-mineo-row-id="${anchorId ?? ''}" for rowId="${rowId}"`,
  });
};
