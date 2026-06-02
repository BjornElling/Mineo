export const AUTH_STORAGE_KEY = 'mineo:authenticated';
export const AUTH_STORAGE_VALUE = 'true';

/**
 * Beslutningsnote (normativ, jf. src/contracts/auth-gate-contract.md):
 * - Denne gate er en permanent UX-barriere mod utilsigtet adgang. Det er et bevidst designvalg.
 * - Den er bevidst svag og er ikke en sikkerhedsgrænse — dette er acceptabelt og intentionelt.
 * - Kan omgås via DevTools/localStorage og beskytter ikke mod målrettet adgang.
 * Re-evaluering:
 * - Erstattes kun hvis der opstår krav om reel adgangskontrol pr. bruger, revisionsspor,
 *   central sessionstyring eller compliance-krav. I så fald skal løsningen flyttes til
 *   et egentligt sikkerheds-/infrastrukturlag uden for klienten.
 */
export const SHARED_PASSWORD_HASHES = [
  '324ae39817dc46525ab92dde7a1263e27b218aa14a9eb64cde10948c0a71869e',
  '63714dc239e08018130789a1c253e1eff06c3bce01d8b97bb8c1f11d23288a41',
];
