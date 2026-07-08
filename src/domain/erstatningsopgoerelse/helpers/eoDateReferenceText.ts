import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { formatIsoDateLong } from '../../../utils/dateFormatting';

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
}>): EoDatoReference => {
  const skadeEllerAnmeldelse = resolveSkadeEllerAnmeldelsesdatoReference(params.skadestype);
  if (!params.anvendtReguleringsdato) return skadeEllerAnmeldelse;

  if (params.skadedato && params.anvendtReguleringsdato === params.skadedato) {
    return skadeEllerAnmeldelse;
  }

  if (
    params.saerligFraDatoRegulering &&
    params.anvendtReguleringsdato === params.saerligFraDatoRegulering
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
      labelLower: 'beregningsperiodens slutdato',
    };
  }

  return { kind: 'andenDato', label: 'Anvendt reguleringsdato', labelLower: 'den anvendte reguleringsdato' };
};

export const resolveLoenReferencedatoText = (params: Readonly<{
  subject: 'lønnen';
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype: Skadestype | undefined;
  useUntilWordingForImplicitBeregningsperiodeDate?: boolean;
}>): string => {
  const { subject, anvendtReguleringsdato, skadedato, skadestype, useUntilWordingForImplicitBeregningsperiodeDate = false } = params;
  const skadeEllerAnmeldelse = resolveSkadeEllerAnmeldelsesdatoReference(skadestype);

  if (anvendtReguleringsdato && anvendtReguleringsdato !== skadedato) {
    const formatted = formatIsoDateLong(anvendtReguleringsdato);
    if (formatted) {
      if (useUntilWordingForImplicitBeregningsperiodeDate) {
        return `${subject} opgjort frem til ${formatted}`;
      }
      return `${subject} opgjort per ${formatted}`;
    }
  }

  return `${subject} på ${skadeEllerAnmeldelse.labelLower}`;
};
