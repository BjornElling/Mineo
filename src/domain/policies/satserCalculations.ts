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

/**
 * Default-årgang for et helt frisk (ikke-committed) satser-felt.
 *
 * Reglen: brug det aktuelle år, hvis det ligger i [minYear, maxYear]. Ligger det aktuelle
 * år over intervallet (satsdata rækker endnu ikke så langt frem), falder vi tilbage til det
 * højeste år ≤ det aktuelle år, som stadig er inden for intervallet — dvs. `maxYear`. Ligger
 * det aktuelle år under intervallet (kun teoretisk), findes intet gyldigt år ≤ aktuelt, og vi
 * returnerer `undefined`, så feltet starter tomt frem for at foreslå et fremtidigt år.
 *
 * Bruges kun som initial-værdi, når der ikke findes en committed satser-sektion (ny sag) —
 * et gemt eller bevidst tomt valg overskrives aldrig af denne default (jf. usePersistedForm).
 */
export const resolveSatserDefaultAargang = (
  currentYear: number,
  minYear: number,
  maxYear: number
): number | undefined => {
  if (currentYear < minYear) return undefined;
  return Math.min(currentYear, maxYear);
};
