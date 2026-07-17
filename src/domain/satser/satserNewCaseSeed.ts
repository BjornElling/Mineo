import { CURRENT_YEAR } from '../../config/dateRanges';
import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';
import type { NewCaseSeed } from '../../inputCore/runtime/initializeInputRuntime';
import { resolveSatserDefaultAargang } from '../policies/satserCalculations';

// Greenfield-seed af en HELT NY sag (§1.12, brugerbeslutning 2026-07-17): Satser-siden var i legacy forudfyldt
// med et default-satsår som ren VISNING (ikke persisteret). I greenfield findes intet ikke-persisteret
// skygge-input (§1.9), så default-året skrives som ét ægte committed input, når — og kun når — en tom ny sag
// bootstrappes. Herefter er feltet udfyldt, satser vises OG download virker straks (vist = beregnet = downloadbar).
// Et gemt/indlæst valg (også et bevidst tomt) rammes aldrig af seeden: `initializeInputRuntime` kalder den kun,
// når der ikke findes en aktiv session, og re-validerer resultatet gennem kataloget (så invarianterne holder).

/**
 * Seeder `satser.aargang` med default-året for en frisk sag. Er der intet gyldigt default-år, seedes intet.
 * Bygger en ren, ny sektions-map (empty.sections er dybt frosset); `initializeInputRuntime` validerer resultatet.
 */
export const seedSatserNewCase: NewCaseSeed = (empty) => {
  const defaultYear = resolveSatserDefaultAargang(
    CURRENT_YEAR,
    satserAngivAarYearBounds.minYear,
    satserAngivAarYearBounds.maxYear
  );
  if (defaultYear === undefined) return empty;
  return Object.freeze({
    ...empty,
    sections: Object.freeze({ ...empty.sections, satser: Object.freeze({ aargang: defaultYear }) }),
  });
};
