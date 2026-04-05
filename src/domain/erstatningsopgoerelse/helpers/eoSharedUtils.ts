/**
 * EO-domænets fælles hjælpefunktioner på tværs af engines, snapshot, validatorer og PDF.
 */

import type { ISODateString } from '../../../types/branded';
import { danishToISO, dateToISO, isISODateString } from '../../../types/branded';
import { isoDateToDate } from '../../dates/isoDate';
import { addDays } from '../../../utils/dateUtils';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { StatistiskLoenudviklingId } from '../../../data/statistiskeRates';
import { round2 } from '../../../utils/roundingShortcuts';
import { formatAsAmount } from '../../../utils/formatUtils';
import { TIMER_TIL_MAANED_FAKTOR } from '../../../config/regulatoryRates';

export const parseOptionalIsoDate = (value: unknown): ISODateString | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!isISODateString(trimmed)) return undefined;
  return trimmed;
};

export const parseDanishToIso = (value: string | undefined): ISODateString | undefined => {
  if (!value || value.trim() === '') return undefined;
  return danishToISO(value);
};

export const getDayAfterIso = (isoDate: ISODateString): ISODateString => {
  const date = isoDateToDate(isoDate);
  const nextDate = addDays(date, 1);
  return (dateToISO(nextDate) ?? isoDate) as ISODateString;
};

export const formatPercentFixed2 = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return `${formatAsAmount(value, 2)} %`;
};

export const formatAmount2 = (value: number): string => formatAsAmount(value, 2);

export const formatAmountWithoutTrailingDecimals = (value: number): string => {
  const formatted = formatAmount2(value);
  return formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
};

export const numOrZero = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const resolvePctPointFromSatsOrInput = (
  overenskomstPctDecimal: number | null | undefined,
  inputPct: number | undefined
): number => {
  if (typeof overenskomstPctDecimal === 'number' && Number.isFinite(overenskomstPctDecimal)) {
    return round2(overenskomstPctDecimal * 100);
  }
  return typeof inputPct === 'number' && Number.isFinite(inputPct) ? round2(inputPct) : 0;
};

export const resolvePctDecimalFromSatsOrInput = (
  overenskomstPctDecimal: number | null | undefined,
  inputPct: number | undefined
): number => {
  if (typeof overenskomstPctDecimal === 'number' && Number.isFinite(overenskomstPctDecimal)) {
    return overenskomstPctDecimal;
  }
  if (typeof inputPct === 'number' && Number.isFinite(inputPct)) {
    return inputPct / 100;
  }
  return 0;
};

export const hasPctSourceOrInput = (
  overenskomstPctDecimal: number | null | undefined,
  inputPct: number | undefined
): boolean => {
  if (typeof overenskomstPctDecimal === 'number' && Number.isFinite(overenskomstPctDecimal)) return true;
  return typeof inputPct === 'number' && Number.isFinite(inputPct) && Math.abs(inputPct) > 0;
};

export const hasAnyPctSourceOrInput = <TSats>(
  satser: readonly TSats[],
  readOverenskomstPctDecimal: (sats: TSats) => number | null | undefined,
  inputPct: number | undefined
): boolean => {
  if (satser.length === 0) return hasPctSourceOrInput(undefined, inputPct);
  return satser.some((sats) => hasPctSourceOrInput(readOverenskomstPctDecimal(sats), inputPct));
};

export const resolveOffentligLoenEkstraGrundloen = (
  rawAmount: number | undefined,
  inputPer: 'Måned' | 'Time',
  grundloenPer: 'Måned' | 'Time'
): number => {
  if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount) || rawAmount <= 0) return 0;
  return round2(convertAnciennitetSats(rawAmount, inputPer, grundloenPer));
};

export const convertAnciennitetSats = (
  satsValue: number,
  inputPer: 'Time' | 'Måned',
  grundloenAngivetPer: 'Time' | 'Måned'
): number => {
  if (grundloenAngivetPer === 'Måned') {
    return inputPer === 'Måned' ? satsValue : satsValue * TIMER_TIL_MAANED_FAKTOR;
  }
  return inputPer === 'Måned' ? satsValue / TIMER_TIL_MAANED_FAKTOR : satsValue;
};

export const formatAnciennitetConversion = (
  inputAmount: number,
  inputPer: 'Time' | 'Måned',
  grundloenAngivetPer: 'Time' | 'Måned',
  formatAmount: (value: number) => string
): Readonly<{ displayText: string; convertedValue: number }> => {
  const roundedInput = round2(inputAmount);
  const convertedValue = round2(convertAnciennitetSats(roundedInput, inputPer, grundloenAngivetPer));
  const inputText = formatAmount(roundedInput);
  const convertedText = formatAmount(convertedValue);
  const factorText = formatAmount(TIMER_TIL_MAANED_FAKTOR);

  if (grundloenAngivetPer === 'Måned' && inputPer === 'Måned') {
    return { displayText: `${inputText} kr./måned`, convertedValue };
  }
  if (grundloenAngivetPer === 'Måned' && inputPer === 'Time') {
    return { displayText: `${inputText} kr./time x ${factorText} = ${convertedText} kr./måned`, convertedValue };
  }
  if (grundloenAngivetPer === 'Time' && inputPer === 'Måned') {
    return { displayText: `${inputText} kr./måned / ${factorText} = ${convertedText} kr./time`, convertedValue };
  }
  return { displayText: `${inputText} kr./time`, convertedValue };
};

export const resolveAnvendtReguleringsdato = (params: {
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'] | undefined;
  angivetLoenMetodeOpreguleresFraDato: ISODateString | undefined;
  saerligFraDatoRegulering: ISODateString | undefined;
  beregningsperiodeTil: ISODateString | undefined;
  skadedato: ISODateString | undefined;
}): ISODateString | undefined => {
  if (params.beregnesUdFra === 'Beregningsperiode') {
    return params.saerligFraDatoRegulering ?? params.beregningsperiodeTil;
  }
  return params.angivetLoenMetodeOpreguleresFraDato ?? params.skadedato;
};

export const resolveStatistikModelId = (label: string | undefined): StatistiskLoenudviklingId | undefined => {
  if (!label) return undefined;
  const trimmed = label.trim();
  if (trimmed.startsWith('ILON12')) return 'ILON12' as StatistiskLoenudviklingId;
  if (trimmed.startsWith('SBLON2')) return 'SBLON2' as StatistiskLoenudviklingId;
  return undefined;
};

export const isAslStatistikModel = (label: string | undefined): boolean => {
  if (!label) return false;
  const trimmed = label.trim();
  return trimmed.startsWith('ASL-') || trimmed === 'ASL-årslønsmaksimum';
};

export const detectDecimalPlaces = (values: readonly number[], maxPlaces = 4): number => {
  let max = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    let places = 0;
    for (; places < maxPlaces; places += 1) {
      const scaled = value * 10 ** places;
      if (!Number.isFinite(scaled)) {
        places = maxPlaces;
        break;
      }
      if (Math.abs(scaled - Math.round(scaled)) < 1e-9) break;
    }
    if (places > max) max = places;
  }
  return max;
};

export const perioderCoverDate = (perioder: Array<{ fra: Date; til: Date }>, target: ISODateString): boolean => {
  const targetDate = isoDateToDate(target);
  for (const periode of perioder) {
    if (periode.fra <= targetDate && periode.til >= targetDate) return true;
  }
  return false;
};
