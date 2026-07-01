import type React from 'react';

/**
 * Delt interaktions-kerne for de to dropdown-implementeringer (`StyledDropdown` og `TableDropdown`).
 *
 * Kun den adfærd der var *verbatim identisk* mellem de to er løftet hertil: typeahead-matchnings-
 * algoritmen (første-bogstav, dansk locale, cirkulær wrap) og de to tastatur-prædikater. Den
 * divergerende adfærd — open/close-livscyklus, fokus-genskabelse, portal/positionering, celle-editor-
 * integration — bliver bevidst i hver komponent (jf. keyboard-navigation-kontrakten). Funktionerne her
 * er rene/stateless, så de ikke kan ændre fokus- eller commit-flowet.
 */

/**
 * Finder næste option-indeks hvis første bogstav matcher `key` (dansk locale), med cirkulær wrap fra
 * `currentIndex`. `labels` er en parallel-array hvor ikke-matchbare pladser (dividers, disabled,
 * tomme) gives som tom streng — de springes over. Returnerer -1 hvis intet matcher.
 *
 * Identisk algoritme som tidligere fandtes inline i begge dropdowns (StyledDropdown.findNextMatchIndex
 * + TableDropdown's wrapper-typeahead).
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
