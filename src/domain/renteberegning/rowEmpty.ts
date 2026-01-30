import type { RentekravRow } from '../../schemas/formSchemas';

export const isRentekravRowEmpty = (row: RentekravRow): boolean => {
  return row.belob === undefined && row.renterFra === undefined && row.tillaegstid === undefined;
};
