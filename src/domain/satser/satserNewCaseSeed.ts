import { getCurrentYear } from '../../config/dateRanges';
import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';
import type { NewCaseSeed } from '../../inputCore/newCaseSections';
import { resolveSatserDefaultAargang } from '../policies/satserCalculations';

// Seed af en HELT NY sag (§1.12): Der findes intet ikke-persisteret skygge-input (§1.9), så
// default-året skrives som ét ægte committed input, når — og kun når — en tom ny sag
// bootstrappes. Herefter er feltet udfyldt, satser vises OG download virker straks (vist = beregnet = downloadbar).
// Et gemt/indlæst valg (også et bevidst tomt) rammes aldrig af seeden: `initializeInputRuntime` kalder den kun,
// når der ikke findes en aktiv session, og re-validerer resultatet gennem kataloget (så invarianterne holder).

/**
 * Seeder `satser.aargang` med default-året for en frisk sag. Er der intet gyldigt default-år, seedes intet.
 *
 * Seeden siger kun HVILKEN sektionsværdi der ønskes; `initializeInputRuntime` ejer konstruktionen af aggregatet
 * og re-validerer gennem kataloget. Den tidligere udgave modtog hele den tomme `SettledInput` og spread'ede
 * `empty.sections` — altså rå sektionsadgang i domænelaget, som `domain/raw-section-access-boundary` forbyder
 * Grænsen er lukket i selve `NewCaseSeed`-signaturen frem for ved en allowlist-post.
 */
export const seedSatserNewCase: NewCaseSeed = () => {
  const defaultYear = resolveSatserDefaultAargang(
    // Læses når sagen faktisk bootstrappes, ikke ved modulets import: en session der står
    // åben over et årsskifte skal seede det NYE år i den næste nye sag.
    getCurrentYear(),
    satserAngivAarYearBounds.minYear,
    satserAngivAarYearBounds.maxYear
  );
  if (defaultYear === undefined) return undefined;
  return { satser: { aargang: defaultYear } };
};
