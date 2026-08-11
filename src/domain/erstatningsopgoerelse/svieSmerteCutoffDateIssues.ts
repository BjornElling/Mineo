import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { isISODateString, type ISODateString } from '../../types/branded';
import {
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  buildSvieSmerteCutoffErrorMessage,
  resolveSvieSmerteCutoffDate,
} from './validation/svieSmerteConstraints';

/**
 * Projekterer svie/smerte-ménafgørelsesgrænsen til de konkrete datoceller.
 *
 * Række-evalueringen kan blokere Beregning-siden med et kolonne-hint, men et hint er ikke en FieldRef og kan
 * derfor ikke give den røde ring. Denne projektion binder samme regel til begge datoer, der faktisk ligger
 * efter cutoffen. Den læser den samme cutoff-resolver som engineen, så klage- og relevansregler ikke kan drive.
 */
export const collectSvieSmerteCutoffDateIssues = (
  values: ErstatningsopgoerelseValues,
): readonly FieldIssue[] => {
  if (values.kravPaaSvieSmerteGodtgoerelse !== 'Ja' || values.tidligereSsMax !== 'Nej') return [];

  const menAfgoerelseDato = resolveSvieSmerteCutoffDate(values);
  if (menAfgoerelseDato === undefined) return [];

  const issueFor = (
    value: ISODateString | undefined,
    field: ReturnType<typeof eoSvieSmertePeriodeFraField.bind>,
  ): FieldIssue | undefined => {
    const message = buildSvieSmerteCutoffErrorMessage({ value, menAfgoerelseDato });
    if (message === undefined) return undefined;
    return Object.freeze({
      kind: 'field' as const,
      code: `${field.descriptor.id}.menCutoff`,
      severity: 'error' as const,
      field: toAnyFieldRef(field),
      reason: 'rule' as const,
      priority: 'context' as const,
      message,
    });
  };

  return values.svieSmertePerioder.flatMap((row) => [
    ...(!isISODateString(row.fra) ? [] : [issueFor(row.fra, eoSvieSmertePeriodeFraField.bind(row.id))]).filter(
      (issue): issue is FieldIssue => issue !== undefined
    ),
    ...(!isISODateString(row.til) ? [] : [issueFor(row.til, eoSvieSmertePeriodeTilField.bind(row.id))]).filter(
      (issue): issue is FieldIssue => issue !== undefined
    ),
  ]);
};
