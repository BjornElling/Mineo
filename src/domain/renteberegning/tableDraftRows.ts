import type { RentekravEnhed } from './rentekravRowUI';

export type RentekravDraftRow = Readonly<{
  id: string;
  belob: string;
  renterFra: string;
  tillaegstid: string;
  enhed: RentekravEnhed | '';
}>;
