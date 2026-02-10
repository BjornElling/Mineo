/**
 * Delte utilities for erstatningsopgørelse PDF-system
 *
 * Disse funktioner bruges af både eoPdfModel.ts (modelbygger) og
 * erstatningsopgoerelsePdf.ts (renderer), og er samlet her for at
 * undgå duplikering og sikre konsistens.
 */

import type { ISODateString } from '../../types/branded';
import { danishToISO, isISODateString } from '../../types/branded';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { formatIsoDateLong, formatIsoDateShort } from '../../utils/dateFormatting';
import type { StatistiskLoenudviklingId } from '../../data/statistiskLoenudviklingRates';

// =============================================================================
// KONSTANTER
// =============================================================================

/**
 * Store bededag blev afskaffet fra 2024 – giver 0,45 % tillæg fra denne dato.
 */
export const STORE_BEDEDAG_START = '2024-01-01' as ISODateString;
export const STORE_BEDEDAG_PCT = 0.45;

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
  return `${value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
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
