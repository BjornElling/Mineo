/**
 * Fysisk-fokus-værn (delt af `useDraftField` og `useTableInputCore`): er `el` — eller en
 * efterkommer af det — det aktuelle `document.activeElement`?
 *
 * Ved hurtig tab-navigation kan Reacts fokus-state lagge bag DOM'ens `activeElement`. Dette er det
 * robuste værn, der hindrer resync af et felt/en celle der reelt har fokus, selv før React-fokus-
 * state'n er sat. `el.contains(active)` dækker sammensatte editorer (fx et wrapper-element med et
 * indre `<input>`).
 */
export const elementHasPhysicalFocus = (el: HTMLElement | null): boolean => {
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  return (
    el !== null &&
    active !== null &&
    (active === el || (active instanceof Node && el.contains(active)))
  );
};
