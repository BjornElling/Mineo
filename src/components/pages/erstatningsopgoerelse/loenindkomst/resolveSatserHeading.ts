import type { ISODateString } from '../../../../types/branded';
import { parseISODate } from '../../../../types/branded';
import { formatDanishDate } from '../../../../utils/dateUtils';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../../schemas/formSchemas';
import { resolveAnvendtReguleringsdatoReference } from '../../../../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';

const formatIsoDateShortLabel = (value: ISODateString | undefined): string | undefined => {
  if (!value) return undefined;
  const parsed = parseISODate(value);
  if (!parsed) return undefined;
  return formatDanishDate(parsed);
};

export const resolveSatserHeading = (params: Readonly<{
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype: StamdataValues['skadestype'] | undefined;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'] | undefined;
  beregningsperiodeTil: ISODateString | undefined;
  saerligFraDatoRegulering: ISODateString | undefined;
}>): string => {
  const { anvendtReguleringsdato } = params;
  if (!anvendtReguleringsdato) return 'Satser';

  const shortDate = formatIsoDateShortLabel(anvendtReguleringsdato);
  const reference = resolveAnvendtReguleringsdatoReference(params);
  if (shortDate) {
    if (reference.kind === 'skadedato' || reference.kind === 'anmeldelsesdato') {
      return `Satser på ${reference.labelLower} (${shortDate})`;
    }
    if (reference.kind === 'beregningsperiodeSlutdato') {
      return `Satser ved beregningsperiodens udløb (${shortDate})`;
    }
    if (reference.kind === 'manuelReguleringsdato') {
      return `Satser på den manuelt angivne reguleringsdato (${shortDate})`;
    }
    return `Satser på ${reference.labelLower} (${shortDate})`;
  }

  return 'Satser';
};
