import type { ManuelProcentsatsEntry } from './manuelProcentsatsRegulering';
import type { KrlIndexEntry } from './krlRegulering';

// R2 — det autoritative regulerings-visnings-forløb, emitteret af motoren (LoenudviklingModel)
// og LÆST af præsentation/inspektion, så det viste forløb er samme kilde som beløbet
// (ingen re-derivation → ingen drift, jf. docs/review/regulering-arkitektur-redesign.md R2).
//
// Diskrimineret union pr. reguleringsform. Migrerede former sætter deres variant på modellen;
// de øvrige re-deriverer fortsat og repræsenteres ved fravær (undefined). Unionen bor her —
// neutralt for alle former — frem for i en enkelt forms modul.
export type ReguleringForloeb =
  | Readonly<{ kind: 'manuelProcentsats'; entries: readonly ManuelProcentsatsEntry[] }>
  | Readonly<{ kind: 'krl'; entries: readonly KrlIndexEntry[] }>;
