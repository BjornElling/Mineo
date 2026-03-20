import { isRentekravRowEmpty } from '../../../domain/renteberegning/rowEmpty';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';

const iso = (s: string): ISODateString => s as ISODateString;

const emptyRow = (): RentekravRow => ({
  id: 'row-1',
  belob: undefined,
  renterFra: undefined,
  tillaegstid: undefined,
  enhed: 'dage',
});

const belobValue = { kind: 'number' as const, value: 10000 };

describe('isRentekravRowEmpty', () => {
  it('alle tre felter undefined → true', () => {
    expect(isRentekravRowEmpty(emptyRow())).toBe(true);
  });

  it('belob sat → false', () => {
    expect(isRentekravRowEmpty({ ...emptyRow(), belob: belobValue })).toBe(false);
  });

  it('renterFra sat → false', () => {
    expect(isRentekravRowEmpty({ ...emptyRow(), renterFra: iso('2024-01-01') })).toBe(false);
  });

  it('tillaegstid sat til positiv værdi → false', () => {
    expect(isRentekravRowEmpty({ ...emptyRow(), tillaegstid: 30 })).toBe(false);
  });

  it('tillaegstid = 0 er stadig sat (0 !== undefined) → false', () => {
    expect(isRentekravRowEmpty({ ...emptyRow(), tillaegstid: 0 })).toBe(false);
  });

  it('alle tre felter sat → false', () => {
    const row: RentekravRow = {
      id: 'row-2',
      belob: belobValue,
      renterFra: iso('2024-03-15'),
      tillaegstid: 30,
      enhed: 'dage',
    };
    expect(isRentekravRowEmpty(row)).toBe(false);
  });

  it('kun enhed ændret, resten undefined → true (enhed tæller ikke)', () => {
    // isRentekravRowEmpty tjekker kun belob, renterFra og tillaegstid
    const row: RentekravRow = { ...emptyRow(), enhed: 'maaneder' };
    expect(isRentekravRowEmpty(row)).toBe(true);
  });
});
