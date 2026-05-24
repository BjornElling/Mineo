import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { allowPdfDownload, blockPdfDownload, type PdfDownloadGateResult } from '../../pdf/pdfGateTypes';

export type SatserValues = PersistedSectionMap['satser'];

export const resolveSatserEffectiveAargang = (
  satser: SatserValues | null,
  minYear: number,
  maxYear: number
): number | undefined => {
  const year = satser?.aargang;
  if (year === undefined) return undefined;
  if (year < minYear || year > maxYear) return undefined;
  return year;
};

export const resolveSatserAargangErrorMessage = (
  satser: SatserValues | null,
  minYear: number,
  maxYear: number
): string | undefined => {
  const year = satser?.aargang;
  if (year === undefined) return `Årstallet skal være mellem ${minYear} og ${maxYear}`;
  if (year < minYear || year > maxYear) return `Årstallet skal være mellem ${minYear} og ${maxYear}`;
  return undefined;
};

export const canDownloadSatser = (satser: SatserValues | null, minYear: number, maxYear: number): boolean => {
  return resolveSatserEffectiveAargang(satser, minYear, maxYear) !== undefined;
};

export const resolveSatserPdfGate = (
  satser: SatserValues | null,
  minYear: number,
  maxYear: number
): PdfDownloadGateResult => {
  const errorMessage = resolveSatserAargangErrorMessage(satser, minYear, maxYear);
  if (!errorMessage) return allowPdfDownload();
  return blockPdfDownload({ code: 'satser:invalid-aargang', message: errorMessage });
};

export const hasSatserAny = (satser: SatserValues | null): boolean => {
  return satser?.aargang !== undefined;
};
