import type { TillaegstidEnhed } from '../../schemas/formSchemas';

export type RentekravDraftRow = Readonly<{
  id: string;
  belob: string;
  renterFra: string;
  tillaegstid: string;
  enhed: TillaegstidEnhed | '';
}>;
