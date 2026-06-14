/**
 * Opdaterer et fejlflag-map for en tabel-række-id på en måde der bevarer reference-
 * identitet, når intet ændres. Når flaget allerede har den ønskede tilstand returneres
 * `prev` uændret (samme objekt-reference), så React kan bailout på setState og undgå
 * unødige re-renders. `as`-castet stripper kun `Readonly` — `prev` muteres aldrig.
 */
export const updateValidationFlagById = (
  prev: Readonly<Record<string, true>>,
  id: string,
  hasError: boolean
): Record<string, true> => {
  const alreadyMarked = prev[id] === true;
  if (hasError) {
    if (alreadyMarked) return prev as Record<string, true>;
    return { ...prev, [id]: true };
  }
  if (!alreadyMarked) return prev as Record<string, true>;
  const { [id]: _, ...rest } = prev;
  return rest;
};
