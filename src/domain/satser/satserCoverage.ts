import type { SatserProjectionValue } from './satserProjection';

type Satser = SatserProjectionValue['satser'];

const isMissing = (value: number | null): boolean => value === null;

/** Om Mineo har mindst én EAL-sats for året. Siden og dokumentet skjuler en sektion helt uden satser. */
export const hasAnyEalSats = (satser: Satser): boolean =>
  Object.values(satser.eal).some((value) => !isMissing(value));

/**
 * De satskategorier, Mineo endnu ikke har for et ellers accepteret år (BB-392), i den rækkefølge siden viser dem.
 *
 * Satsåret accepteres, når mindst én satsserie dækker det; det betyder ikke fuld dækning. En kategori, hvis
 * samtlige satser mangler, udelades ellers tavst på skærmen og i dokumentet, så «Mineo har endnu ikke
 * oplysningen» ikke kan skelnes fra «oplysningen hører ikke til årets oversigt». En enkelt manglende række
 * (fx en minimumsårsløn, der kun findes i bestemte år) er ikke en dækningsmangel og nævnes ikke.
 */
const missingCoverageCategories = (satser: Satser): readonly string[] => {
  const categories: string[] = [];
  if (!hasAnyEalSats(satser)) categories.push('satser efter erstatningsansvarsloven');
  if (Object.values(satser.asl).every(isMissing)) categories.push('satser efter arbejdsskadesikringsloven');
  const { friProcesEnlig, friProcesSamlevende, friProcesBarn } = satser.diverse;
  if ([friProcesEnlig, friProcesSamlevende, friProcesBarn].every(isMissing)) {
    categories.push('beløbsgrænser for fri proces');
  }
  if (isMissing(satser.diverse.reguleringssats)) categories.push('reguleringssatsen');
  return categories;
};

const joinWithEller = (parts: readonly string[]): string =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} eller ${parts[parts.length - 1]}`;

/**
 * Den ene formulering af manglende dækning, delt af siden og specifikationen. `null` = intet mangler.
 * Beskeden følger automatisk de berørte kategorier, når nye satser tilføjes; der vises aldrig et fallback-år.
 */
export const describeMissingSatserCoverage = (year: number, satser: Satser): string | null => {
  const categories = missingCoverageCategories(satser);
  if (categories.length === 0) return null;
  return `Mineo indeholder endnu ikke ${joinWithEller(categories)} for ${year}.`;
};
