/**
 * Konfiguration for scroll-to-top funktionalitet
 *
 * SINGLE SOURCE OF TRUTH for scroll-threshold og relaterede konstanter.
 * Bruges både i komponenten og i tests for at sikre konsistens.
 */

/**
 * Minimum scroll-distance i pixels før scroll-to-top knappen vises
 *
 * Kan justeres baseret på UX-feedback eller responsivt layout.
 * For fremtidig dynamisk threshold (fx baseret på viewport-højde),
 * kan denne konstant erstattes med en beregnet værdi.
 */
export const SCROLL_VISIBILITY_THRESHOLD_PX = 200;

/**
 * Position af scroll-to-top knappen fra bunden og højre kant (i pixels)
 */
export const SCROLL_BUTTON_POSITION_BOTTOM_PX = 32;
export const SCROLL_BUTTON_POSITION_RIGHT_PX = 32;

/**
 * Størrelse af scroll-to-top knappen (i pixels)
 * Matcher størrelsen af plus-knappen i ansættelsesforhold-tabeller
 */
export const SCROLL_BUTTON_SIZE_PX = 56;
