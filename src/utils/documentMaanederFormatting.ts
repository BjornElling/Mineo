import { formatAsAmount, formatAsAmountTrimmed } from './formatUtils';
import { roundByMethod } from './rounding';

export const DOCUMENT_MAANEDER_DECIMALS = 5;

const roundDocumentMaaneder = (value: number): number =>
  roundByMethod(value, DOCUMENT_MAANEDER_DECIMALS, 'halfAwayFromZero');

export const formatDocumentMaanederTrimmed = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return formatAsAmountTrimmed(roundDocumentMaaneder(value), DOCUMENT_MAANEDER_DECIMALS);
};

export const formatDocumentMaanederFixed = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return formatAsAmount(roundDocumentMaaneder(value), DOCUMENT_MAANEDER_DECIMALS);
};
