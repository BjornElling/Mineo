/**
 * E2E-banernes tags – ét sted, delt af Playwright-konfigurationen, spec-filerne og vagten
 * `scripts/check-e2e-lane-tags.mjs`.
 *
 * En test uden tag kører i basisbanen: én gang, i Chrome ved basisviewporten. Et tag udvider den
 * ene test til flere projekter og koster derfor kørselstid – sæt det kun, når adfærden faktisk
 * afhænger af browsermotoren eller af den viewport, projektet giver. Se `playwright.config.ts`
 * for hele banemodellen.
 */

/**
 * Kør testen i alle fire browsermotorer.
 *
 * Bruges når det er MOTOREN, der er under kontrol: fokus- og Tab-semantik, filvælger-fallbacks,
 * animation og maling, tekstmål. Ikke til almindelige brugerrejser – de opfører sig ens.
 */
export const BROWSER_LANE_TAG = '@browsere';

/**
 * Kør testen ved app-shell-kontraktens to minimumsviewporter ud over basisviewporten.
 *
 * Bruges kun når testen AFLÆSER den viewport, projektet giver den. En test, der selv kalder
 * `page.setViewportSize(...)`, får intet ud af taget – den måler jo sin egen bredde.
 */
export const VIEWPORT_LANE_TAG = '@viewporter';
