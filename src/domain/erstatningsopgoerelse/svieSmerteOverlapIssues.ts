import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import {
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { isSvieSmerteRowEmpty } from './helpers/rowEmpty';
import { collectPeriodOverlapIssues } from './periodOverlapIssues';

/**
 * Projekterer overlaps-reglen til de konkrete datoceller.
 *
 * Fladen har fire regler på præcis de samme to datoceller. Tre af dem – datoorden, ménafgørelsens
 * cutoff og feltets egne grænser – farver cellen. Overlappet gjorde det ikke: rækkeevalueringen
 * kunne blokere Beregning-siden, men den returnerer `field: undefined` for overlap og har derfor
 * ingen FieldRef at hænge den røde ring på. Fraværet af rød kant læses som «denne celle er
 * kontrolleret og i orden», selv om cellen spærrer hele opgørelsen (BB-218).
 *
 * Projektionen går samme vej som `collectSvieSmerteCutoffDateIssues` og deler dens relevans-guard,
 * så en skjult sektion ikke kan farve celler, der ikke findes.
 *
 * **Tooltippen navngiver modparten.** «Fejl og advarsler» folder ens overlaps-linjer til én
 * (udviklerbeslutning 2026-09-22), så boksen ikke længere siger hvilke rækker der er tale om. Det
 * er derfor den røde celles tooltip, der bærer udpegningen.
 */
export const collectSvieSmerteOverlapIssues = (
  values: ErstatningsopgoerelseValues,
): readonly FieldIssue[] => {
  if (values.kravPaaSvieSmerteGodtgoerelse !== 'Ja' || values.tidligereSsMax !== 'Nej') return [];
  return collectPeriodOverlapIssues(
    values.svieSmertePerioder.filter((row) => !isSvieSmerteRowEmpty(row)),
    { fra: eoSvieSmertePeriodeFraField, til: eoSvieSmertePeriodeTilField },
  );
};
