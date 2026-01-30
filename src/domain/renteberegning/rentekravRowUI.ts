import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../types/branded';

export type RentekravEnhed = 'dage' | 'uger' | 'maaneder';

/**
 * UI-layer type for rentekrav-raekke.
 *
 * This is editor state (can be invalid/incomplete).
 * Persisted schema type is `RentekravRow` in `src/schemas/formSchemas.ts`.
 */
export type RentekravRowUI = Readonly<{
  id: string;
  belob?: AmountValue | undefined;
  renterFra?: ISODateString | undefined;
  tillaegstid?: number | undefined;
  enhed: RentekravEnhed;
}>;
