import { toAnyFieldRef, type FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import { isoToDanish, type ISODateString } from '../../types/branded';
import { detectOverlappingPeriodPartners, type PeriodRow } from './engines/periodOverlapDetection';

type RowDateField = FieldDescriptor<ISODateString | undefined>;

/**
 * Projekterer overlaps-reglen for én periodetabel til de konkrete datoceller.
 *
 * Overlappet spærrede opgørelsen gennem rækkeevalueringen, men uden en feltadresse og dermed uden rød
 * celle – mens datoorden, afskæringer og feltets egne grænser på de samme celler farvede dem. Fraværet af
 * rød kant læses som «denne celle er kontrolleret og i orden» (BB-218 for svie/smerte, BB-251 for TAF- og
 * ferieperioderne). BEGGE celler i BEGGE rækker markeres: perioden er ét hele, og brugeren kan rette
 * overlappet fra hvilken som helst af de to ender.
 *
 * **Tooltippen navngiver modparten.** «Fejl og advarsler» viser én linje pr. tabel om overlap, så boksen
 * siger ikke, hvilke rækker der er tale om; det gør den røde celles tooltip.
 */
export const collectPeriodOverlapIssues = (
  rows: readonly PeriodRow[],
  fields: Readonly<{ fra: RowDateField; til: RowDateField }>,
): readonly FieldIssue[] => {
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
    return [fields.fra.bind(rowId), fields.til.bind(rowId)].map((field) =>
      Object.freeze({
        kind: 'field' as const,
        code: `${field.descriptor.id}.overlap`,
        severity: 'error' as const,
        field: toAnyFieldRef(field),
        reason: 'rule' as const,
        message,
      }));
  });
};
