export const AUTH_STORAGE_KEY = 'mineo:authenticated';
export const AUTH_STORAGE_VALUE = 'true';

type SharedPasswordHashEntry = Readonly<{
  description: string;
  hash: string;
}>;

const defineSharedPasswordHashes = (
  entries: readonly SharedPasswordHashEntry[],
): readonly SharedPasswordHashEntry[] => {
  for (const entry of entries) {
    if (!entry.description.trim()) {
      throw new Error('Alle auth-password-hashes skal have en beskrivende tekst.');
    }
  }

  return entries;
};

/**
 * Beslutningsnote (normativ, jf. src/contracts/auth-gate-contract.md):
 * - Denne gate er en permanent UX-barriere mod utilsigtet adgang. Det er et bevidst designvalg.
 * - Den er bevidst svag og er ikke en sikkerhedsgrænse — dette er acceptabelt og intentionelt.
 * - Kan omgås via DevTools/localStorage og beskytter ikke mod målrettet adgang.
 * Re-evaluering:
 * - Erstattes kun hvis der opstår krav om reel adgangskontrol pr. bruger, revisionsspor,
 *   central sessionstyring eller compliance-krav. I så fald skal løsningen flyttes til
 *   et egentligt sikkerheds-/infrastrukturlag uden for klienten.
 * - Adgangskoder er case-neutrale; hashes nedenfor er SHA-256 af lowercased plaintext.
 * - Hver hash skal have en beskrivende tekst, så aktive adgangskoder kan auditeres uden plaintext.
 */
export const SHARED_PASSWORD_HASHES = defineSharedPasswordHashes([
  {
    description: 'Generelt password til test-personer i forbundene 2026',
    hash: '324ae39817dc46525ab92dde7a1263e27b218aa14a9eb64cde10948c0a71869e',
  },
  {
    description: 'KSS personligt password',
    hash: '7edb340c0afc7e8d87ddc2dc75266b2f2da603d53d404da4824de6470ef9a912',
  },
]);
