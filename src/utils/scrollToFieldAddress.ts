/**
 * Finder, scroller til og markerer et synligt felt gennem den kanoniske feltadresse.
 *
 * Et link kan starte et route- eller fane-skift, før destinationens editor er mountet. Derfor må
 * opmærksomhedsmarkeringen ikke sættes ved klikket eller på en overordnet sektion: den venter på
 * præcis den synlige editor og markeres først dér. Det gør samme flow stabilt for fejl og advarsler.
 */
import type { FieldAddress } from '../inputCore/fieldAddress';
import { serializeFieldAddress } from '../inputCore/fieldAddress';
import {
  findFirstVisibleEditorForTemplate,
  lookupEditorLocation,
} from '../inputCore/react/editorLocationDestination';
import type { FieldAddressTemplate } from '../inputCore/fieldDescriptor';
import { blinkFieldAttention } from '../inputCore/react/fieldAttentionBlink';
import { scrollWithRetry, type CancelScrollWithRetry } from './scrollWithRetry';

export const findVisibleFieldEditor = (address: FieldAddress): HTMLElement | null => {
  const lookup = lookupEditorLocation(serializeFieldAddress(address));
  return lookup.kind === 'visible' ? lookup.element : null;
};

/**
 * Scroll til og markér feltet i den FØRSTE række af en collection – feltet udpeget af sin adressetemplate.
 *
 * Bruges når issuet handler om en indtastning, brugeren endnu ikke har OPRETTET: der findes ingen konkret
 * feltadresse, men tabellen viser altid en tom indtastningsrække. Adfærden er ellers identisk med
 * `scrollToFieldAddress` – samme retry-løkke og PRÆCIS samme blinkmarkering, så der ikke opstår en
 * parallel «peg på feltet»-vej.
 */
export const scrollToCollectionFieldTemplate = (
  template: FieldAddressTemplate,
  options: {
    maxRetries?: number;
    onSuccess?: () => void;
    onFailure?: (reason: string) => void;
  } = {}
): CancelScrollWithRetry => {
  const { maxRetries = 150, onSuccess, onFailure } = options;

  return scrollWithRetry({
    maxRetries,
    findTarget: () => findFirstVisibleEditorForTemplate(template),
    onSuccess: (target) => {
      blinkFieldAttention(target);
      onSuccess?.();
    },
    onFailure,
    failureMessage: `Første række-felt for ${template.section}.${template.field} blev ikke synligt inden for ${maxRetries} forsøg`,
  });
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
