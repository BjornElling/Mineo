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
