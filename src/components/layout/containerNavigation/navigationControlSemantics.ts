/**
 * Semantik for de navigationselementer, der må kunne nås og aktiveres med tastatur,
 * men som ikke må blive en del af Containerens cirkulære indholdssekvens.
 */
export const TAB_NAVIGATION_ATTRIBUTE = 'data-mineo-tab-navigation';

export const isTabNavigationControl = (element: Element | null): boolean =>
  element?.getAttribute(TAB_NAVIGATION_ATTRIBUTE) === 'true';
