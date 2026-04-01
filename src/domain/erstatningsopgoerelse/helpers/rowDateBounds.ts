import type { ISODateString } from '../../../types/branded';
import { minISO, maxISO } from '../../../utils/isoDateHelpers';

export type RowDateBounds = Readonly<{
  fra: Readonly<{ min: ISODateString; max: ISODateString }>;
  til: Readonly<{ min: ISODateString; max: ISODateString }>;
}>;

export const computeRowDateBounds = (args: {
  skadesdatoMinDate?: ISODateString | undefined;
  rowFra: ISODateString | undefined;
  rowTil: ISODateString | undefined;
  fallbackMin: ISODateString;
  fallbackMax: ISODateString;
  tilFallbackMax: ISODateString;
  /** Ekstra øvre grænse for til-dato (fx menAfgoerelseDato eller endelig EET dato) */
  tilExtraMaxDate?: ISODateString | undefined;
  /** Om tilExtraMaxDate-regel skal bruges (false hvis verserende klagesag) */
  useTilExtraMaxDate?: boolean;
}): RowDateBounds => {
  // Fra-dato: >= skadesdato (eller fallback), <= til-dato i samme række (eller fallback)
  // Bemærk: Skadesdato-regel gælder ikke for erhvervssygdomme
  const absoluteMin = args.skadesdatoMinDate ?? args.fallbackMin;
  const fraMax = args.rowTil || args.fallbackMax;

  // Til-dato: >= fra-dato i samme række (eller absoluteMin), <= dags dato og evt. ekstra afgrænsning
  const tilMin = args.rowFra ? maxISO(args.rowFra, absoluteMin) : absoluteMin;
  let tilMax = args.tilFallbackMax; // Default: dags dato

  // Hvis der er en ekstra øvre grænse (fx menAfgoerelseDato), brug den laveste
  // Bemærk: Regel gælder ikke hvis verserende klagesag
  if (args.useTilExtraMaxDate !== false && args.tilExtraMaxDate) {
    tilMax = minISO(tilMax, args.tilExtraMaxDate);
  }

  return { fra: { min: absoluteMin, max: fraMax }, til: { min: tilMin, max: tilMax } };
};
