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

    const breakdown = calculateTafArbejdsdageBreakdown(
      iso('2023-08-01'),
      iso('2025-10-31'),
      ferieperioder,
      10,
      { kind: 'beregningsgrundlag', oevrigeFravaersdage: 5 }
    );
    expect(breakdown).not.toBeNull();
    if (!breakdown) return;

    expect(breakdown.arbejdsdage).toBe(589);
    expect(breakdown.shDage).toBe(16);
    expect(breakdown.arbejdsdageMinusSH).toBe(573);
    expect(breakdown.feriedage).toBe(32);
    expect(breakdown.loseFeriedage).toBe(10);
    expect(breakdown.oevrigeFravaersdage).toBe(5);
    expect(breakdown.tafDage).toBe(526);

    expect(
      calculateTafAntalArbejdsdage(iso('2023-08-01'), iso('2025-10-31'), ferieperioder, 10, {
        kind: 'beregningsgrundlag',
        oevrigeFravaersdage: 5,
      })
    ).toBe(breakdown.tafDage);
  });

  it('places loose feriedage only on unblocked weekdays', () => {
    const ferieperioder: readonly FerieperiodeRow[] = [
      { id: 'fp1', fra: iso('2024-01-02'), til: iso('2024-01-02') },
    ];

    const breakdown = calculateTafArbejdsdageBreakdown(
      iso('2024-01-01'),
      iso('2024-01-03'),
      ferieperioder,
      2,
      { kind: 'taf' }
    );
    expect(breakdown).not.toBeNull();
    if (!breakdown) return;

    expect(breakdown.loseFeriedage).toBe(1);
  });

  it('clamps tafDage to zero when fradrag exceeds arbejdsdage', () => {
    const ferieperioder: readonly FerieperiodeRow[] = [
      { id: 'fp1', fra: iso('2024-01-01'), til: iso('2024-01-05') },
    ];

    const breakdown = calculateTafArbejdsdageBreakdown(
      iso('2024-01-01'),
      iso('2024-01-05'),
      ferieperioder,
      10,
      { kind: 'beregningsgrundlag', oevrigeFravaersdage: 10 }
    );
    expect(breakdown).not.toBeNull();
    if (!breakdown) return;

    expect(breakdown.tafDage).toBe(0);
  });

  it('places loose feriedage correctly across DST (kanariefugl)', () => {
    const breakdown = calculateTafArbejdsdageBreakdown(
      iso('2024-03-29'),
      iso('2024-04-02'),
      [],
      2,
      { kind: 'taf' }
    );
    expect(breakdown).not.toBeNull();
    if (!breakdown) return;

    expect(breakdown.arbejdsdage).toBe(3);
    expect(breakdown.shDage).toBe(2);
    expect(breakdown.arbejdsdageMinusSH).toBe(1);
    expect(breakdown.loseFeriedage).toBe(1);
    expect(breakdown.tafDage).toBe(0);
  });
});
