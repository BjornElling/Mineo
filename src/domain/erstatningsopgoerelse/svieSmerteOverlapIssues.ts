import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import {
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { isSvieSmerteRowEmpty } from './helpers/rowEmpty';
import { detectOverlappingPeriodPartners } from './engines/periodOverlapDetection';
import { isoToDanish } from '../../types/branded';

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

  const rows = values.svieSmertePerioder.filter((row) => !isSvieSmerteRowEmpty(row));
  if (rows.length < 2) return [];

  const partnersById = detectOverlappingPeriodPartners(rows);
  if (partnersById.size === 0) return [];

  const rowById = new Map(rows.map((row) => [row.id, row]));

  const buildMessage = (partnerIds: readonly string[]): string => {
    const perioder = partnerIds
      .map((partnerId) => {
        const partner = rowById.get(partnerId);
        if (partner?.fra === undefined || partner.til === undefined) return undefined;
        const fra = isoToDanish(partner.fra) ?? partner.fra;
        const til = isoToDanish(partner.til) ?? partner.til;
        return `${fra} - ${til}`;
      })
      .filter((text): text is string => text !== undefined);
    if (perioder.length === 0) return 'Der er overlappende perioder';
    return perioder.length === 1
      ? `Perioden overlapper perioden ${perioder[0]}`
      : `Perioden overlapper perioderne ${perioder.join(' og ')}`;
  };

  return [...partnersById.entries()].flatMap(([rowId, partnerIds]) => {
    const message = buildMessage(partnerIds);
    // Begge celler markeres: perioden er ét hele, og brugeren kan rette overlappet fra hvilken
    // som helst af de to ender.
    return [eoSvieSmertePeriodeFraField.bind(rowId), eoSvieSmertePeriodeTilField.bind(rowId)].map(
      (field) =>
        Object.freeze({
          kind: 'field' as const,
          code: `${field.descriptor.id}.overlap`,
          severity: 'error' as const,
          field: toAnyFieldRef(field),
          reason: 'rule' as const,
          message,
        }),
    );
  });
};
