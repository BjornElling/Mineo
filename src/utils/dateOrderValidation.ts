import type { ISODateString } from '../types/branded';

export const DATE_ORDER_ERROR_MESSAGE = 'Til-dato skal være efter fra-dato';

export const validateDateOrder = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): string | undefined => {
  if (!fra || !til) return undefined;
  return til < fra ? DATE_ORDER_ERROR_MESSAGE : undefined;
};
