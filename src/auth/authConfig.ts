export const AUTH_STORAGE_KEY = 'mineo:authenticated';
export const AUTH_STORAGE_VALUE = 'true';

/**
 * Beslutningsnote (bevidst undtagelse):
 * - Denne gate er en midlertidig udviklingsskal.
 * - Den fungerer kun som en svag UX-barriere mod almindelig adgang under udvikling.
 * - Den er ikke en sikkerhedsgrænse og kan omgås via DevTools/localStorage.
 * - Den skal fjernes helt, når programmet er færdigudviklet.
 * Risiko:
 * - Kan skabe falsk tryghed, hvis den opfattes som reel sikkerhed.
 * Re-evaluering:
 * - Ved release fjernes den. Hvis der mod forventning senere opstår krav om egentlig adgangskontrol,
 *   skal auth flyttes til server/infrastruktur-lag.
 */
export const SHARED_PASSWORD_HASH = '324ae39817dc46525ab92dde7a1263e27b218aa14a9eb64cde10948c0a71869e';
