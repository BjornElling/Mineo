import { formatAsAmount, formatAsAmountTrimmed } from './formatUtils';
import { parseDanishNumberString } from './numberParsing';
import { roundByMethod } from './rounding';
import {
  DEFAULT_PERCENT_DECIMAL_PRECISION,
  MAX_PERCENT_RAW_LENGTH,
} from './percentInputUtils';

export type PercentParseConfig = Readonly<{
  allowNegative: boolean;
  allowDecimals: boolean;
  minValue?: number;
  maxValue?: number;
}>;

export type PercentParseResult =
  | Readonly<{ ok: true; value: number | undefined }>
  | Readonly<{ ok: false; errorMessage: string }>;

export const getPercentPrecision = (allowDecimals: boolean): 0 | 2 =>
  allowDecimals ? DEFAULT_PERCENT_DECIMAL_PRECISION : 0;

/**
 * Formaterer en procent-værdi til visning i et procent-INPUTFELT (commit-værdi → tekst).
 * Bruger fast præcision (0 eller 2 decimaler) afhængigt af `allowDecimals`, så feltet
 * viser samme antal decimaler det accepterer. Adskiller sig bevidst fra
 * `formatUtils.formatPercent`, der trimmer trailing-nuller til fri prosa-visning.
 */
export const formatPercentDisplay = (
  value: number | undefined,
  allowDecimals: boolean
): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return formatAsAmount(value, getPercentPrecision(allowDecimals));
};

export const formatPercentDraft = (
  value: number | undefined,
  decimals: 0 | 1 | 2
): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return formatAsAmountTrimmed(value, decimals);
};

export const buildPercentRangeErrorMessage = (
  value: number,
  { minValue, maxValue, allowDecimals }: Pick<PercentParseConfig, 'minValue' | 'maxValue' | 'allowDecimals'>
): string | null => {
  const precision = getPercentPrecision(allowDecimals);
  if (typeof minValue === 'number' && value < minValue) {
    if (typeof maxValue === 'number') {
      return `Procent skal være mellem ${formatAsAmount(minValue, precision)} og ${formatAsAmount(maxValue, precision)}`;
    }
    return `Procent skal være ${formatAsAmount(minValue, precision)} eller højere`;
  }

  if (typeof maxValue === 'number' && value > maxValue) {
    if (typeof minValue === 'number') {
      return `Procent skal være mellem ${formatAsAmount(minValue, precision)} og ${formatAsAmount(maxValue, precision)}`;
    }
    return `Procent skal være ${formatAsAmount(maxValue, precision)} eller lavere`;
  }

  return null;
};

export const parsePercentDraftForCommit = (
  rawValue: string,
  config: PercentParseConfig
): PercentParseResult => {
  const trimmed = rawValue.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  if (trimmed === '-') return { ok: false, errorMessage: 'Ugyldig procent' };
  if (trimmed.length > MAX_PERCENT_RAW_LENGTH) return { ok: false, errorMessage: 'Ugyldig procent' };

  const compact = trimmed.replace(/\s+/g, '');
  const isNegative = compact.startsWith('-');
  if (isNegative && !config.allowNegative) return { ok: false, errorMessage: 'Procent kan ikke være negativ' };

  const unsigned = isNegative ? compact.slice(1) : compact;
  if (unsigned.includes('-')) return { ok: false, errorMessage: 'Ugyldig procent' };
  if (/\s/.test(trimmed) && unsigned.includes('.')) return { ok: false, errorMessage: 'Ugyldig procent' };
  // En decimaldel AFVISES ikke i et decimalløst procentfelt (BB-118) – den afrundes nedenfor.
  // Afvisningen var uopnåelig for brugeren, fordi tegnfilteret sprang kommaet over, så «15,00 %» nåede
  // hertil som `1500` og blev afvist af 0-100-grænsen i stedet.

  const commaCount = (unsigned.match(/,/g) ?? []).length;
  if (commaCount > 1) return { ok: false, errorMessage: 'Ugyldig procent' };

  const [integerRaw, decimalRaw] = unsigned.split(',') as [string, string | undefined];
  if (!integerRaw) return { ok: false, errorMessage: 'Ugyldig procent' };
  if (decimalRaw !== undefined && decimalRaw === '') return { ok: false, errorMessage: 'Ugyldig procent' };

  if (decimalRaw !== undefined) {
    if (/[^0-9]/.test(decimalRaw)) return { ok: false, errorMessage: 'Ugyldig procent' };
    if (decimalRaw.length > DEFAULT_PERCENT_DECIMAL_PRECISION) return { ok: false, errorMessage: 'Ugyldig procent' };
  }

  if (integerRaw.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})*$/.test(integerRaw)) return { ok: false, errorMessage: 'Ugyldig procent' };
  } else if (/[^0-9]/.test(integerRaw)) {
    return { ok: false, errorMessage: 'Ugyldig procent' };
  }

  /**
   * Parse ved den SKREVNE præcision, og afrund derefter eksplicit (BB-118).
   *
   * `parseDanishNumberString`s `precision` er et sikkerhedsværn – ikke en afrunding: den afviser et tal,
   * hvis decimaler ikke kan rummes sikkert i den angivne præcision. Blev den brugt som afrunder, ville
   * `50,25` i et decimalløst felt komme retur som `undefined` og dermed som «Ugyldig procent», mens
   * `50,00` slap igennem – kun trailing nuller overlevede. Feltet ville da INVITERE til en indtastning
   * (kommaet er lovligt ved tastning og paste), som settle aldrig kunne acceptere, og brugeren fik en bar
   * «Fejl i indtastning» uden nogen forklaring.
   *
   * Afrundingen bruger programmets kanoniske `roundByMethod` med samme metode som beløbsfelterne
   * (`halfAwayFromZero`), så et procentfelt og et beløbsfelt afrunder ens: `50,5` → `51`.
   */
  const writtenValue = parseDanishNumberString(
    `${isNegative ? '-' : ''}${integerRaw}${decimalRaw ? `,${decimalRaw}` : ''}`
  );
  if (writtenValue === undefined) return { ok: false, errorMessage: 'Ugyldig procent' };
  const numericValue = roundByMethod(
    writtenValue,
    getPercentPrecision(config.allowDecimals),
    'halfAwayFromZero'
  );

  const rangeErrorMessage = buildPercentRangeErrorMessage(numericValue, config);
  if (rangeErrorMessage !== null) return { ok: false, errorMessage: rangeErrorMessage };

  return { ok: true, value: numericValue };
};
