import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { allowDocumentDownload, blockDocumentDownload, type DocumentDownloadGateResult } from '../../document/layout/documentGateTypes';

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
  // Manglende årgang og årgang uden for [minYear, maxYear] giver samme brugervendte fejl.
  if (year === undefined || year < minYear || year > maxYear) {
    return `Årstallet skal være mellem ${minYear} og ${maxYear}`;
  }
  return undefined;
};

export const canDownloadSatser = (satser: SatserValues | null, minYear: number, maxYear: number): boolean => {
  return resolveSatserEffectiveAargang(satser, minYear, maxYear) !== undefined;
};

export const resolveSatserPdfGate = (
  satser: SatserValues | null,
  minYear: number,
  maxYear: number
): DocumentDownloadGateResult => {
  const errorMessage = resolveSatserAargangErrorMessage(satser, minYear, maxYear);
  if (!errorMessage) return allowDocumentDownload();
  return blockDocumentDownload({ code: 'satser:invalid-aargang', message: errorMessage });
};

export const hasSatserAny = (satser: SatserValues | null): boolean => {
  return satser?.aargang !== undefined;
};
