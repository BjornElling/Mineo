/**
 * Finder, scroller til og markerer et synligt felt gennem den kanoniske feltadresse.
 *
 * Et link kan starte et route- eller fane-skift, før destinationens editor er mountet. Derfor må
 * opmærksomhedsmarkeringen ikke sættes ved klikket eller på en overordnet sektion: den venter på
 * præcis den synlige editor og markeres først dér. Det gør samme flow stabilt for fejl og advarsler.
 */
import type { FieldAddress } from '../inputCore/fieldAddress';
import { serializeFieldAddress } from '../inputCore/fieldAddress';
import { lookupEditorLocation } from '../inputCore/react/editorLocationDestination';
import { blinkFieldAttention } from '../inputCore/react/fieldAttentionBlink';
import { scrollWithRetry, type CancelScrollWithRetry } from './scrollWithRetry';

export const findVisibleFieldEditor = (address: FieldAddress): HTMLElement | null => {
  const lookup = lookupEditorLocation(serializeFieldAddress(address));
  return lookup.kind === 'visible' ? lookup.element : null;
};

export const scrollToFieldAddress = (
  address: FieldAddress,
  options: {
    maxRetries?: number;
    onSuccess?: () => void;
    onFailure?: (reason: string) => void;
  } = {}
): CancelScrollWithRetry => {
  const { maxRetries = 150, onSuccess, onFailure } = options;

  return scrollWithRetry({
    maxRetries,
    findTarget: () => findVisibleFieldEditor(address),
    onSuccess: (target) => {
      blinkFieldAttention(target);
      onSuccess?.();
    },
    onFailure,
    failureMessage: `Feltet ${serializeFieldAddress(address)} blev ikke synligt inden for ${maxRetries} forsøg`,
  });
};
