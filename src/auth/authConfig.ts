export const AUTH_STORAGE_KEY = 'mineo:authenticated';
export const AUTH_STORAGE_VALUE = 'true';

/**
 * Beslutningsnote (bevidst undtagelse):
 * - Denne gate er en midlertidig udviklingsbarriere.
 * - Den er bevidst svag og skal kun holde uvedkommende fra siden, mens programmet udvikles.
 * - Den er ikke reel sikkerhed og må ikke behandles som sikkerhedsgrænse.
 * - Den skal fjernes igen, når programmet ikke længere er under udvikling.
 * Risiko:
 * - Kan omgås via DevTools/localStorage og beskytter ikke mod målrettet adgang.
 * Re-evaluering:
 * - Fjernes ved afsluttet udvikling. Hvis der senere opstår krav om reel adgangskontrol,
 *   skal det løses i et egentligt sikkerheds-/infrastrukturlag.
 */
export const SHARED_PASSWORD_HASH = '324ae39817dc46525ab92dde7a1263e27b218aa14a9eb64cde10948c0a71869e';
