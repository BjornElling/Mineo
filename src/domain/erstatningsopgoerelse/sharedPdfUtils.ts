/**
 * Delte utilities for erstatningsopgørelse PDF-system
 *
 * Disse funktioner bruges af både eoPdfModel.ts (modelbygger) og
 * erstatningsopgoerelsePdf.ts (renderer), og er samlet her for at
 * undgå duplikering og sikre konsistens.
 */

import type { ISODateString } from '../../types/branded';
import { danishToISO, dateToISO, isISODateString, parseISODate } from '../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { formatIsoDateLong, formatIsoDateShort } from '../../utils/dateFormatting';
import type { StatistiskLoenudviklingId } from '../../data/statistiskLoenudviklingRates';
import { roundByMethod } from '../../utils/rounding';
import { formatAsAmount } from '../../utils/formatUtils';
import { TIMER_TIL_MAANED_FAKTOR } from '../../config/regulatoryRates';

// =============================================================================
// KONSTANTER
// =============================================================================

// =============================================================================
// DATO-FUNKTIONER
// =============================================================================

/**
 * Parser en optionel streng som ISODateString.
 * Returnerer undefined hvis input ikke er en gyldig ISO-dato.
 */
export const parseOptionalIsoDate = (value: unknown): ISODateString | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!isISODateString(trimmed)) return undefined;
  return trimmed;
};

/**
 * Parser dansk dato-format (dd-mm-yyyy) til ISODateString.
 */
export const parseDanishToIso = (value: string | undefined): ISODateString | undefined => {
  if (!value || value.trim() === '') return undefined;
  return danishToISO(value);
};

// =============================================================================
// FORMATERING
// =============================================================================

/**
 * Formaterer ISO-dato til kort dansk format (dd-mm-yyyy).
 */
export const formatDateShort = (isoDate: ISODateString | undefined): string => {
  return formatIsoDateShort(isoDate);
};

/**
 * Formaterer ISO-dato til langt dansk format (d. måned yyyy).
 */
export const formatDateLong = (isoDate: ISODateString | undefined): string => {
  return formatIsoDateLong(isoDate);
};

/**
 * Formaterer et tal som procent med præcis 2 decimaler i dansk format.
 */
export const formatPercentFixed2 = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return `${formatAsAmount(value, 2)} %`;
};

export const roundToTwoDecimals = (value: number): number => roundByMethod(value, 2, 'halfAwayFromZero');

export const roundToFourDecimals = (value: number): number => roundByMethod(value, 4, 'halfAwayFromZero');

export const formatAmount2 = (value: number): string =>
  formatAsAmount(value, 2);

export const formatAmountWithoutTrailingDecimals = (value: number): string => {
  const formatted = formatAmount2(value);
  return formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
};

export const numOrZero = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * Returnerer procentpoint (fx 15,3 for 15,3 %) fra overenskomstsats.
 * Falder tilbage til brugerens indtastede sats, når overenskomstsatsen mangler.
 */
export const resolvePctPointFromSatsOrInput = (
  overenskomstPctDecimal: number | null | undefined,
  inputPct: number | undefined
): number => {
  if (typeof overenskomstPctDecimal === 'number' && Number.isFinite(overenskomstPctDecimal)) {
    return roundToTwoDecimals(overenskomstPctDecimal * 100);
  }
  return typeof inputPct === 'number' && Number.isFinite(inputPct) ? roundToTwoDecimals(inputPct) : 0;
};

/**
 * Returnerer decimal-procent (fx 0,153 for 15,3 %) fra overenskomstsats.
 * Falder tilbage til brugerens indtastede sats, når overenskomstsatsen mangler.
 */
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

/**
 * Angiver om et pct-led skal vises i formel/tabeller:
 * - ja, når overenskomstsats findes, eller
 * - ja, når brugersats er en ikke-nul værdi.
 */
export const hasPctSourceOrInput = (
  overenskomstPctDecimal: number | null | undefined,
  inputPct: number | undefined
): boolean => {
  if (typeof overenskomstPctDecimal === 'number' && Number.isFinite(overenskomstPctDecimal)) return true;
  return typeof inputPct === 'number' && Number.isFinite(inputPct) && Math.abs(inputPct) > 0;
};

/**
 * Samlet check for om et pct-led skal vises på tværs af en sats-liste:
 * - true hvis mindst én sats har en kildeværdi, eller input er ikke-nul
 * - true ved tom liste hvis input er ikke-nul
 */
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
  return roundToTwoDecimals(convertAnciennitetSats(rawAmount, inputPer, grundloenPer));
};

export const addOneDayIso = (iso: ISODateString): ISODateString | null => {
  const date = parseISODate(iso);
  if (!date) return null;

  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  return dateToISO(nextDate) ?? null;
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
  const roundedInput = roundToTwoDecimals(inputAmount);
  const convertedValue = roundToTwoDecimals(convertAnciennitetSats(roundedInput, inputPer, grundloenAngivetPer));
  const inputText = formatAmount(roundedInput);
  const convertedText = formatAmount(convertedValue);
  const factorText = formatAmount(TIMER_TIL_MAANED_FAKTOR);

  if (grundloenAngivetPer === 'Måned' && inputPer === 'Måned') {
    return {
      displayText: `${inputText} kr./måned`,
      convertedValue,
    };
  }
  if (grundloenAngivetPer === 'Måned' && inputPer === 'Time') {
    return {
      displayText: `${inputText} kr./time x ${factorText} = ${convertedText} kr./måned`,
      convertedValue,
    };
  }
  if (grundloenAngivetPer === 'Time' && inputPer === 'Måned') {
    return {
      displayText: `${inputText} kr./måned / ${factorText} = ${convertedText} kr./time`,
      convertedValue,
    };
  }
  return {
    displayText: `${inputText} kr./time`,
    convertedValue,
  };
};

// =============================================================================
// REGULERING
// =============================================================================

/**
 * Bestemmer reguleringsdato baseret på beregningsmetode.
 *
 * - Ved 'Beregningsperiode': saerligFraDatoRegulering (fra ansættelsesforholdet) ?? skadesdato
 * - Ved andre metoder: opreguleringsdato for den valgte angivet-løn-metode ?? skadesdato
 */
export const resolveReguleringsdato = (params: {
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'] | undefined;
  angivetLoenMetodeOpreguleresFraDato: ISODateString | undefined;
  saerligFraDatoRegulering: ISODateString | undefined;
  skadesdato: ISODateString | undefined;
}): ISODateString | undefined => {
  if (params.beregnesUdFra === 'Beregningsperiode') {
    return params.saerligFraDatoRegulering ?? params.skadesdato;
  }
  return params.angivetLoenMetodeOpreguleresFraDato ?? params.skadesdato;
};

// =============================================================================
// STATISTIK
// =============================================================================

/**
 * Mapper et statistikmodel-label til dets ID.
 */
export const resolveStatistikModelId = (label: string | undefined): StatistiskLoenudviklingId | undefined => {
  if (!label) return undefined;
  const trimmed = label.trim();
  if (trimmed.startsWith('ILON12')) return 'ILON12' as StatistiskLoenudviklingId;
  if (trimmed.startsWith('SBLON2')) return 'SBLON2' as StatistiskLoenudviklingId;
  return undefined;
};

// =============================================================================
// DECIMALDETEKTERING
// =============================================================================

/**
 * Finder det nødvendige antal decimalpladser for at vise `values` præcist,
 * op til `maxPlaces` (default 4).
 *
 * Antager normal størrelsesorden (fx løn-/procentdata). Hvis en skalering
 * bliver uendelig/ikke-endelig, fail-closed vi til `maxPlaces`.
 */
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
