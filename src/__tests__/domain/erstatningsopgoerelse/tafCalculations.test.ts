import type { FerieperiodeRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import {
  calculateTafAntalArbejdsdage,
  calculateTafArbejdsdageBreakdown,
} from '../../../domain/erstatningsopgoerelse/tafCalculations';

const iso = (value: string): ISODateString => value as ISODateString;

describe('calculateTafArbejdsdageBreakdown', () => {
  it('subtracts SH days and matches calculateTafAntalArbejdsdage', () => {
    const ferieperioder: readonly FerieperiodeRow[] = [
      { id: 'fp1', fra: iso('2024-08-01'), til: iso('2024-08-31') },
      { id: 'fp2', fra: iso('2024-09-01'), til: iso('2024-09-14') },
    ];

    const breakdown = calculateTafArbejdsdageBreakdown(iso('2023-08-01'), iso('2025-10-31'), ferieperioder, 10);
    expect(breakdown).not.toBeNull();
    if (!breakdown) return;

    expect(breakdown.arbejdsdage).toBe(589);
    expect(breakdown.shDage).toBe(16);
    expect(breakdown.arbejdsdageMinusSH).toBe(573);
    expect(breakdown.feriedage).toBe(32);
    expect(breakdown.loseFeriedage).toBe(10);
    expect(breakdown.tafDage).toBe(531);

    expect(calculateTafAntalArbejdsdage(iso('2023-08-01'), iso('2025-10-31'), ferieperioder, 10)).toBe(breakdown.tafDage);
  });
});

