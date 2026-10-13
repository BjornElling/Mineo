import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { resolveSkadeEllerAnmeldelsesdatoReference } from '../helpers/eoDateReferenceText';

type AngivetLoenBeregningsgrundlag = Extract<
  ErstatningsopgoerelseValues['beregnesUdFra'],
  'Angivet månedsløn' | 'Angivet dagsløn'
>;

/**
 * Den aktive angivne løn skal have et datogrundlag. EO-/TAF-perioder er kun clamping-grænser og må derfor
 * ikke bruges som skjult fallback, når både den eksplicitte dato og Stamdatas dato mangler.
 */
export const buildMissingLoenudviklingReguleringsdatoMessage = (
  beregnesUdFra: AngivetLoenBeregningsgrundlag,
  skadestype: StamdataValues['skadestype'] | undefined
): string => {
  const loenLabel = beregnesUdFra === 'Angivet månedsløn' ? 'månedsløn' : 'dagsløn';
  const datoReference = resolveSkadeEllerAnmeldelsesdatoReference(skadestype);
  return `Datoen for den angivne ${loenLabel} skal udfyldes, når ${datoReference.labelLower} ikke er udfyldt`;
};
