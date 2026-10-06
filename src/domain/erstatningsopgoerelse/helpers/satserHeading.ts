import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { isISODateString, isoToDanish, type ISODateString } from '../../../types/branded';
import { resolveAnvendtReguleringsdatoReference } from './eoDateReferenceText';
import { getAngivetLoenOpreguleresFraDato } from './angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from './eoSharedUtils';

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

/**
 * Overskriften over et ansættelsesforholds satser – «Satser ved beregningsperiodens udløb (31-05-2018)».
 *
 * ÉT sted for kortets satsafsnit, linjen i «Fejl og advarsler» og lønindkomstbilagets satslinjer. Boksen
 * skrev før fast «Satser på skadedatoen», mens skærmen nævnte den dato, satserne faktisk slås op på (BB-284),
 * og bilaget skrev satserne uden dato over rækker, der regner med månedens satser (BB-276).
 */
export const resolveSatserHeading = (params: Readonly<{
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype: StamdataValues['skadestype'] | undefined;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'] | undefined;
  beregningsperiodeTil: ISODateString | undefined;
  saerligFraDatoRegulering: ISODateString | undefined;
  angivetLoenMetodeOpreguleresFraDato?: ISODateString | undefined;
}>): string => {
  const shortDate = params.anvendtReguleringsdato ? isoToDanish(params.anvendtReguleringsdato) : undefined;
  if (!shortDate) return 'Satser';

  const reference = resolveAnvendtReguleringsdatoReference(params);
  switch (reference.kind) {
    case 'beregningsperiodeSlutdato':
      return `Satser ved beregningsperiodens udløb (${shortDate})`;
    case 'manuelReguleringsdato':
      return `Satser på den manuelt angivne reguleringsdato (${shortDate})`;
    default:
      return `Satser på ${reference.labelLower} (${shortDate})`;
  }
};

/** Datoen, et ansættelsesforholds satser slås op på – samme opløsning som projektionen og motoren. */
export const resolveAnvendtReguleringsdatoForAnsaettelsesforhold = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  ansaettelsesforhold: Pick<Ansaettelsesforhold, 'saerligFraDatoRegulering'>;
  skadedato: ISODateString | undefined;
}>): ISODateString | undefined => resolveAnvendtReguleringsdato({
  beregnesUdFra: args.values.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(args.values),
  saerligFraDatoRegulering: isISODateString(args.ansaettelsesforhold.saerligFraDatoRegulering)
    ? args.ansaettelsesforhold.saerligFraDatoRegulering
    : undefined,
  beregningsperiodeTil: args.values.tafBeregningsperiodeTil,
  skadedato: args.skadedato,
});

/** {@link resolveSatserHeading} for ét ansættelsesforhold, med datoen opløst som overalt ellers. */
export const resolveSatserHeadingForAnsaettelsesforhold = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  ansaettelsesforhold: Pick<Ansaettelsesforhold, 'saerligFraDatoRegulering'>;
  skadedato: ISODateString | undefined;
  skadestype: StamdataValues['skadestype'] | undefined;
}>): string => resolveSatserHeading({
  anvendtReguleringsdato: resolveAnvendtReguleringsdatoForAnsaettelsesforhold(args),
  skadedato: args.skadedato,
  skadestype: args.skadestype,
  beregnesUdFra: args.values.beregnesUdFra,
  beregningsperiodeTil: args.values.tafBeregningsperiodeTil,
  saerligFraDatoRegulering: isISODateString(args.ansaettelsesforhold.saerligFraDatoRegulering)
    ? args.ansaettelsesforhold.saerligFraDatoRegulering
    : undefined,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(args.values),
});
