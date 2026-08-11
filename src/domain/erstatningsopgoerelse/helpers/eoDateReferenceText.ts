import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import { resolveSkadestypeDatoLabel } from '../../policies/stamdataCalculations';

type Skadestype = StamdataValues['skadestype'];

export type EoDatoReferenceKind =
  | 'skadedato'
  | 'anmeldelsesdato'
  | 'beregningsperiodeSlutdato'
  | 'manuelReguleringsdato'
  | 'andenDato';

export type EoDatoReference = Readonly<{
  kind: EoDatoReferenceKind;
  label: string;
  labelLower: string;
}>;

/**
 * EO-prosaens form af skadedato-navnet. `label` er IKKE et selvstændigt navnevalg: det læses fra
 * `resolveSkadestypeDatoLabel`, som er feltets ene navneautoritet (§3.2a). Kun `kind` og den bøjede
 * `labelLower` (prosaform: «på skadedatoen») tilføjes her.
 */
export const resolveSkadeEllerAnmeldelsesdatoReference = (
  skadestype: Skadestype | undefined
): EoDatoReference => {
  const label = resolveSkadestypeDatoLabel(skadestype);
  return label === 'Anmeldelsesdato'
    ? { kind: 'anmeldelsesdato', label, labelLower: 'anmeldelsesdatoen' }
    : { kind: 'skadedato', label, labelLower: 'skadedatoen' };
};

export const resolveAnvendtReguleringsdatoReference = (params: Readonly<{
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype: Skadestype | undefined;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'] | undefined;
  beregningsperiodeTil: ISODateString | undefined;
  saerligFraDatoRegulering: ISODateString | undefined;
  angivetLoenMetodeOpreguleresFraDato?: ISODateString | undefined;
}>): EoDatoReference => {
  const skadeEllerAnmeldelse = resolveSkadeEllerAnmeldelsesdatoReference(params.skadestype);
  if (!params.anvendtReguleringsdato) return skadeEllerAnmeldelse;

  if (params.skadedato && params.anvendtReguleringsdato === params.skadedato) {
    return skadeEllerAnmeldelse;
  }

  if (
    (params.saerligFraDatoRegulering &&
      params.anvendtReguleringsdato === params.saerligFraDatoRegulering) ||
    (params.angivetLoenMetodeOpreguleresFraDato &&
      params.anvendtReguleringsdato === params.angivetLoenMetodeOpreguleresFraDato)
  ) {
    return {
      kind: 'manuelReguleringsdato',
      label: 'Manuelt angivet reguleringsdato',
      labelLower: 'den manuelt angivne reguleringsdato',
    };
  }

  if (
    params.beregnesUdFra === 'Beregningsperiode' &&
    params.beregningsperiodeTil &&
    params.anvendtReguleringsdato === params.beregningsperiodeTil
  ) {
    return {
      kind: 'beregningsperiodeSlutdato',
      label: 'Beregningsperiodens slutdato',
      labelLower: 'beregningsperiodens udløb',
    };
  }

  return { kind: 'andenDato', label: 'Reguleringsdato', labelLower: 'reguleringsdatoen' };
};

export const formatEoDatoReferenceWithDate = (
  reference: EoDatoReference,
  dato: ISODateString | undefined
): string => {
  const formatted = dato ? isoToDanish(dato) : undefined;
  return formatted ? `${reference.labelLower} (${formatted})` : reference.labelLower;
};

export const resolveAnvendtReguleringsdatoReferenceText = (params: Parameters<typeof resolveAnvendtReguleringsdatoReference>[0]): string =>
  formatEoDatoReferenceWithDate(resolveAnvendtReguleringsdatoReference(params), params.anvendtReguleringsdato);

/** Tooltiptekst til en særlig fra-dato ud fra den allerede resolverede reference, som også vises længere nede. */
export const formatAnvendtReguleringsdatoInfoTooltip = (
  referenceText: string,
  anvendtReguleringsdato: ISODateString | undefined,
): string => anvendtReguleringsdato === undefined
  ? `Aktuelt kan der ikke anvendes en reguleringsdato, fordi ${referenceText} ikke er udfyldt.`
  : `Aktuelt anvendes ${referenceText}.`;

export const resolveLoenReferencedatoText = (params: Readonly<{
  subject: 'lønnen';
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype: Skadestype | undefined;
  beregnesUdFra?: ErstatningsopgoerelseValues['beregnesUdFra'] | undefined;
  beregningsperiodeTil?: ISODateString | undefined;
  saerligFraDatoRegulering?: ISODateString | undefined;
  angivetLoenMetodeOpreguleresFraDato?: ISODateString | undefined;
  useUntilWordingForImplicitBeregningsperiodeDate?: boolean;
}>): string => {
  const { subject, anvendtReguleringsdato, skadedato, skadestype } = params;
  const skadeEllerAnmeldelse = resolveSkadeEllerAnmeldelsesdatoReference(skadestype);

  if (!anvendtReguleringsdato) return `${subject} på ${skadeEllerAnmeldelse.labelLower}`;

  const reference = resolveAnvendtReguleringsdatoReference({
    anvendtReguleringsdato,
    skadedato,
    skadestype,
    beregnesUdFra: params.beregnesUdFra,
    beregningsperiodeTil: params.beregningsperiodeTil,
    saerligFraDatoRegulering: params.saerligFraDatoRegulering,
    angivetLoenMetodeOpreguleresFraDato: params.angivetLoenMetodeOpreguleresFraDato,
  });
  const referenceText = formatEoDatoReferenceWithDate(reference, anvendtReguleringsdato);
  const preposition = reference.kind === 'beregningsperiodeSlutdato' ? 'ved' : 'på';
  return `${subject} ${preposition} ${referenceText}`;
};
