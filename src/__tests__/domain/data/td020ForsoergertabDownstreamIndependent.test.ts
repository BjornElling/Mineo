import { computeForsoergertabEalKrav } from '../../../domain/forsoergertab/forsoergertabEalKrav';
import { fromKroner, toKroner } from '../../../domain/money/money';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

describe('DATA-001/TD-020 – forsørgertabets EAL-mindstesats som downstream-facit', () => {
  it('fører 2025-mindstesatsen gennem EAL-kravet med aldersreduktion', () => {
    const result = computeForsoergertabEalKrav({
      beregningsdato: toISODateString('2025-01-01'),
      skadedato: toISODateString('2025-01-01'),
      skadelidteFodselsdato: toISODateString('1995-01-01'),
      aslAarsloen: undefined,
      ealAarsloen: asAmount(350000),
    });

    expect(result.issues).toEqual([]);
    expect(result.computation).not.toBeNull();
    const computation = result.computation!;

    // 350.000 kr. × 100 % = 3.500.000 kr.; 30 % = 1.050.000 kr.
    // 2025-mindstesatsen på 1.182.500 kr. vinder derfor. Alder 30 år giver 1 %:
    // 1.182.500 kr. − 11.825 kr. = 1.170.675 kr.
    expect(toKroner(computation.eetAnvendtOre)).toBe(3500000);
    expect(toKroner(computation.forsoergertabBeregnetOre)).toBe(1050000);
    expect(toKroner(result.foersoergertabEalMinSatsOre!)).toBe(1182500);
    expect(result.foersoergertabForhoejtetTilMin).toBe(true);
    expect(toKroner(computation.forsoergertabAnvendtOre)).toBe(1182500);
    expect(computation.aldersreduktionPct).toBe(1);
    expect(toKroner(computation.aldersreduktionBeloebOre)).toBe(11825);
    expect(toKroner(computation.ealKravOre)).toBe(1170675);
    expect(computation.ealKravOre).toBe(fromKroner(1170675));
  });
});
