import type { ISODateString } from '../../types/branded';
import { getReguleringsDatoIntervalForOverenskomst } from '../../data/overenskomstRates';
import { parseDanishToIso } from './sharedPdfUtils';

export const resolveOverenskomstEffectiveStartIso = (
  overenskomstId: string | undefined,
  reguleringTableStartIso: ISODateString
): ISODateString => {
  const interval = overenskomstId ? getReguleringsDatoIntervalForOverenskomst(overenskomstId) : undefined;
  const minCoverageIso = interval ? parseDanishToIso(interval.fraDato) : undefined;
  if (minCoverageIso && minCoverageIso > reguleringTableStartIso) return minCoverageIso;
  return reguleringTableStartIso;
};
