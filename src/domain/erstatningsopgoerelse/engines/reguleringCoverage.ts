import type { ISODateString } from '../../../types/branded';
import { getReguleringsDatoIntervalForOverenskomst } from '../../../data/overenskomstRates';
import { parseDanishToIso } from '../helpers/eoSharedUtils';

export const resolveOverenskomstEffectiveStartIso = (
  overenskomstId: string | undefined,
  reguleringTableStartIso: ISODateString
): ISODateString => {
  const minCoverageIso = resolveOverenskomstCoverageStartIso(overenskomstId);
  if (minCoverageIso && minCoverageIso > reguleringTableStartIso) return minCoverageIso;
  return reguleringTableStartIso;
};

export const resolveOverenskomstCoverageStartIso = (
  overenskomstId: string | undefined
): ISODateString | undefined => {
  const interval = overenskomstId ? getReguleringsDatoIntervalForOverenskomst(overenskomstId) : undefined;
  return interval ? parseDanishToIso(interval.fraDato) : undefined;
};
