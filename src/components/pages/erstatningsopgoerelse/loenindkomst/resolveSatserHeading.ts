import type { ISODateString } from '../../../../types/branded';
import { parseISODate } from '../../../../types/branded';
import { formatDanishDate } from '../../../../utils/dateUtils';
import { formatIsoDateLong } from '../../../../utils/dateFormatting';

const formatIsoDateShortLabel = (value: ISODateString | undefined): string | undefined => {
  if (!value) return undefined;
  const parsed = parseISODate(value);
  if (!parsed) return undefined;
  return formatDanishDate(parsed);
};

export const resolveSatserHeading = (params: Readonly<{
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype: string | undefined;
  beregningsperiodeTil: ISODateString | undefined;
}>): string => {
  const { anvendtReguleringsdato, skadedato, skadestype, beregningsperiodeTil } = params;
  if (!anvendtReguleringsdato) return 'Satser';

  const shortDate = formatIsoDateShortLabel(anvendtReguleringsdato);
  const longDate = formatIsoDateLong(anvendtReguleringsdato);

  if (skadedato && anvendtReguleringsdato === skadedato && shortDate) {
    return skadestype === 'Erhvervssygdom'
      ? `Satser på anmeldelsesdatoen (${shortDate})`
      : `Satser på skadedatoen (${shortDate})`;
  }

  if (beregningsperiodeTil && anvendtReguleringsdato === beregningsperiodeTil && shortDate) {
    return `Satser ved beregningsperiodens udløb (${shortDate})`;
  }

  if (longDate) {
    return `Satser den ${longDate}`;
  }

  return 'Satser';
};
