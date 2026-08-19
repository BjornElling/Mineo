import type React from 'react';

/**
 * Interaktions-primitiver for dropdownens tastatur-adfærd: typeahead-matchningsalgoritmen
 * (første-bogstav, dansk locale, cirkulær wrap) og de to tastatur-prædikater.
 *
 * `StyledDropdown` er den ene dropdown-implementering – både formularvarianten (`ChoiceField`) og
 * cellevarianten (`GridChoiceCell`) renderer den. Primitiverne er rene/stateless funktioner, så typeahead-reglen kan
 * testes uden at mounte kontrollen. Popup-KLASSIFIKATIONEN (er dette en popup, er den åben?) ligger i
 * `popupWidgetSemantics`, som Container og grid-navigationen deler.
 */

/**
 * Finder næste option-indeks hvis første bogstav matcher `key` (dansk locale), med cirkulær wrap fra
 * `currentIndex`. `labels` er en parallel-array hvor ikke-matchbare pladser (dividers, disabled,
 * tomme) gives som tom streng – de springes over. Returnerer -1 hvis intet matcher.
 *
 * Algoritmen er `StyledDropdown`s ene typeahead-regel, udtrykt som en ren funktion.
 */
export const findTypeaheadMatchIndex = (
  labels: readonly string[],
  key: string,
  currentIndex: number
): number => {
  const normalizedKey = normalizeDropdownLabel(key);
  const matchingIndices: number[] = [];

  labels.forEach((label, index) => {
    const normalizedLabel = normalizeDropdownLabel(label);
    if (normalizedLabel.length === 0) return;
    const firstChar = normalizedLabel.charAt(0);
    if (firstChar === normalizedKey) {
      matchingIndices.push(index);
    }
  });

  if (matchingIndices.length === 0) return -1;

  const currentPos = matchingIndices.indexOf(currentIndex);
  if (currentPos === -1) return matchingIndices[0];

  const nextPos = (currentPos + 1) % matchingIndices.length;
  return matchingIndices[nextPos];
};

/**
 * Normaliserer en label til dropdownens eneste tekstmatch-regel.
 *
 * Paste og typeahead må ikke have hver sin fortolkning af danske labels. Ydre mellemrum og linjeskift er
 * ikke en del af den viste valgmulighed, og flere whitespace-tegn mellem ord er samme label i en clipboard-
 * tekst. `da-DK` bevarer den forventede sammenligning for æ, ø og å.
 */
export const normalizeDropdownLabel = (label: string): string =>
  label.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('da-DK');

/**
 * Sandt hvis tastetrykket er et enkelt skrivbart tegn uden modifikator – kandidat til typeahead.
 * (Modifier-kombinationer og ikke-tegn-taster som piletaster/Enter springes over.)
 */
export const isTypeaheadCharKey = (event: React.KeyboardEvent<HTMLElement>): boolean => {
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  if (event.key.length !== 1) return false;
  return event.key.trim().length === 1;
};

/** Sandt hvis tastetrykket er Delete/Backspace (rydde-tasterne). */
export const isClearKey = (event: React.KeyboardEvent<HTMLElement>): boolean =>
  event.key === 'Backspace' || event.key === 'Delete';
