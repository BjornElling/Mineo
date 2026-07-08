import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../../types/branded';

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

export const resolveSkadeEllerAnmeldelsesdatoReference = (
  skadestype: Skadestype | undefined
): EoDatoReference =>
  skadestype === 'Erhvervssygdom'
    ? { kind: 'anmeldelsesdato', label: 'Anmeldelsesdato', labelLower: 'anmeldelsesdatoen' }
    : { kind: 'skadedato', label: 'Skadedato', labelLower: 'skadedatoen' };

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
