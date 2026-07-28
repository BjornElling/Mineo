import type React from 'react';

/**
 * Interaktions-primitiver for dropdownens tastatur-adfærd: typeahead-matchningsalgoritmen
 * (første-bogstav, dansk locale, cirkulær wrap) og de to tastatur-prædikater.
 *
 * `StyledDropdown` er efter greenfield-cutoveren den ene dropdown-implementering — både form-
 * varianten (`ChoiceField`) og celle-varianten (`GridChoiceCell`) renderer den. Modulet blev udskilt,
 * da der var to implementeringer, og er bevaret som rene/stateless funktioner, så typeahead-reglen kan
 * testes uden at mounte kontrollen. Popup-KLASSIFIKATIONEN (er dette en popup, er den åben?) ligger i
 * `popupWidgetSemantics`, som Container og grid-navigationen deler.
 */

/**
 * Finder næste option-indeks hvis første bogstav matcher `key` (dansk locale), med cirkulær wrap fra
 * `currentIndex`. `labels` er en parallel-array hvor ikke-matchbare pladser (dividers, disabled,
 * tomme) gives som tom streng — de springes over. Returnerer -1 hvis intet matcher.
 *
 * Algoritmen er `StyledDropdown`s ene typeahead-regel, udtrykt som en ren funktion.
 */
export const findTypeaheadMatchIndex = (
  labels: readonly string[],
  key: string,
  currentIndex: number
): number => {
  const normalizedKey = key.toLocaleLowerCase('da-DK');
  const matchingIndices: number[] = [];

  labels.forEach((label, index) => {
    const trimmed = label.trim();
    if (trimmed.length === 0) return;
    const firstChar = trimmed.charAt(0).toLocaleLowerCase('da-DK');
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
 * Sandt hvis tastetrykket er et enkelt skrivbart tegn uden modifikator — kandidat til typeahead.
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
