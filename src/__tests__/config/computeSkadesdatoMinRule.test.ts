import { computeSkadedatoMinRule } from '../../config/dateRanges';
import { toISODateString } from '../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('computeSkadedatoMinRule', () => {
  it('uses fallbackMin when skadedato is missing', () => {
    const result = computeSkadedatoMinRule({
      skadedatoISO: undefined,
      erErhvervssygdom: false,
      fallbackMin: iso('2005-01-01'),
    });
    expect(result).toEqual({ minDate: iso('2005-01-01') });
  });

  it('uses skadedato as min for arbejdsulykke (bounded by fallbackMin)', () => {
    const result = computeSkadedatoMinRule({
      skadedatoISO: iso('2006-02-03'),
      erErhvervssygdom: false,
      fallbackMin: iso('2005-01-01'),
    });
    expect(result.minDate).toBe(iso('2006-02-03'));
    expect(result.minBoundKind).toBe('skadedato');
    expect(result.minBoundReferenceISO).toBe(iso('2006-02-03'));
  });

  it('uses 5-year rule for erhvervssygdom (bounded by 01-01-2005 floor)', () => {
    const result = computeSkadedatoMinRule({
      skadedatoISO: iso('2007-06-01'),
      erErhvervssygdom: true,
      fallbackMin: iso('2005-01-01'),
    });
    // 5 years before would be 2002-06-01, but absolute floor applies.
    expect(result.minDate).toBe(iso('2005-01-01'));
    expect(result.minBoundKind).toBe('anmeldelsesdatoMinus5Aar');
    expect(result.minBoundReferenceISO).toBe(iso('2007-06-01'));
  });

  it('clamps leap day when subtracting 5 years', () => {
    const result = computeSkadedatoMinRule({
      skadedatoISO: iso('2024-02-29'),
      erErhvervssygdom: true,
      fallbackMin: iso('2005-01-01'),
    });
    expect(result.minDate).toBe(iso('2019-02-28'));
  });
});
