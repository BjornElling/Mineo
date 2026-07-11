import type { ManuelProcentsatsEntry } from './manuelProcentsatsRegulering';
import type { KrlIndexEntry } from './krlRegulering';
import type { StatistikIndexEntry } from './statistikRegulering';
import type { KlLoenaftalerIndexEntry } from './klLoenaftalerRegulering';

// R2 — det autoritative regulerings-visnings-forløb, emitteret af motoren (LoenudviklingModel)
// og LÆST af præsentation/inspektion, så det viste forløb er samme kilde som beløbet
// (ingen re-derivation → ingen drift, jf. greenfield-reviewets kandidat #23).
//
// Diskrimineret union for de fire former med en selvstændig kildeserie. Former uden sådan en
// serie bruger delte formel-/opslagsprimitiver og repræsenteres ved fravær. Unionen bor her —
// neutralt for alle former — frem for i en enkelt forms modul.
export type ReguleringForloeb =
  | Readonly<{ kind: 'manuelProcentsats'; entries: readonly ManuelProcentsatsEntry[] }>
  | Readonly<{ kind: 'krl'; entries: readonly KrlIndexEntry[] }>
  | Readonly<{ kind: 'statistik'; entries: readonly StatistikIndexEntry[] }>
  | Readonly<{ kind: 'klLoenaftaler'; entries: readonly KlLoenaftalerIndexEntry[] }>;
