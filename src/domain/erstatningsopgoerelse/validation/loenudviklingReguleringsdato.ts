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

/**
 * Lønudviklingen bygger på kortets overenskomst, men den er slået fra. Validatoren og rækkebyggeren bruger samme
 * tekst, så sikkerhedsnettet genkender linjen som dækket (BB-316).
 */
export const OVERENSKOMST_SKAL_SLAAS_TIL_BESKED = 'Overenskomst skal slås til, når lønudviklingen beregnes ud fra overenskomst';

/** En «Manuel procentsats» uden en eneste sats ud over den låste første række (BB-303). */
export const MANUEL_PROCENTSATS_UDEN_SATSER_BESKED = 'Manuel procentsats mangler: angiv mindst én sats – eller vælg «Ingen»';
