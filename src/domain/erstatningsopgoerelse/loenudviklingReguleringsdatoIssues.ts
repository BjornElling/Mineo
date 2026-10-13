import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import {
  eoAngivetDagsloenOpreguleresFraDatoField,
  eoAngivetMaanedsloenOpreguleresFraDatoField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from './helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from './helpers/eoSharedUtils';
import { buildMissingLoenudviklingReguleringsdatoMessage } from './validation/loenudviklingReguleringsdato';

/**
 * Projekterer den fælles datokravsregel til det konkrete felt, så samme fejl både spærrer snapshot og giver
 * brugeren en rød indtastning. TAF-reglen køres kun, når TAF faktisk er aktiveret.
 */
export const collectMissingLoenudviklingReguleringsdatoIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato' | 'skadestype'>
): readonly FieldIssue[] => {
  if (
    values.kravPaaTabtArbejdsfortjeneste !== 'Ja' ||
    (values.beregnesUdFra !== 'Angivet månedsløn' && values.beregnesUdFra !== 'Angivet dagsløn')
  ) {
    return [];
  }

  const source = resolveLoenudviklingKilde(values)[0];
  if (!source || !source.loenudviklingBeregningsgrundlag || source.loenudviklingBeregningsgrundlag === 'Ingen') {
    return [];
  }

  const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
    beregnesUdFra: values.beregnesUdFra,
    angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
    saerligFraDatoRegulering: undefined,
    beregningsperiodeTil: values.tafBeregningsperiodeTil,
    skadedato: stamdata.skadedato,
  });
  if (anvendtReguleringsdato !== undefined) return [];

  const field = values.beregnesUdFra === 'Angivet månedsløn'
    ? eoAngivetMaanedsloenOpreguleresFraDatoField
    : eoAngivetDagsloenOpreguleresFraDatoField;
  const fieldRef = field.bind();

  return [Object.freeze({
    kind: 'field' as const,
    code: `${fieldRef.descriptor.id}.manglerReguleringsdato`,
    severity: 'error' as const,
    field: toAnyFieldRef(fieldRef),
    reason: 'rule' as const,
    message: buildMissingLoenudviklingReguleringsdatoMessage(values.beregnesUdFra, stamdata.skadestype),
  })];
};
