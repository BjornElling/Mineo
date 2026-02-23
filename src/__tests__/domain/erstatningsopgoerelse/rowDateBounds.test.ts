import { describe, expect, it } from 'vitest';
import { computeRowDateBounds } from '../../../domain/erstatningsopgoerelse/rowDateBounds';
import type { ISODateString } from '../../../types/branded';

const iso = (s: string): ISODateString => s as ISODateString;

const FALLBACK_MIN = iso('2020-01-01');
const FALLBACK_MAX = iso('2024-12-31');
const TIL_FALLBACK_MAX = iso('2024-12-31');

describe('computeRowDateBounds', () => {
  describe('fra-bounds', () => {
    it('ingen skadesdatoMinDate → absoluteMin = fallbackMin', () => {
      const bounds = computeRowDateBounds({
        rowFra: undefined,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
      });
      expect(bounds.fra.min).toBe(FALLBACK_MIN);
    });

    it('skadesdatoMinDate sat → absoluteMin = skadesdatoMinDate', () => {
      const skadesdato = iso('2022-06-15');
      const bounds = computeRowDateBounds({
        skadesdatoMinDate: skadesdato,
        rowFra: undefined,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
      });
      expect(bounds.fra.min).toBe(skadesdato);
    });

    it('rowTil sat → fraMax = rowTil', () => {
      const rowTil = iso('2023-06-30');
      const bounds = computeRowDateBounds({
        rowFra: undefined,
        rowTil,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
      });
      expect(bounds.fra.max).toBe(rowTil);
    });

    it('rowTil ikke sat → fraMax = fallbackMax', () => {
      const bounds = computeRowDateBounds({
        rowFra: undefined,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
      });
      expect(bounds.fra.max).toBe(FALLBACK_MAX);
    });
  });

  describe('til-bounds', () => {
    it('rowFra ikke sat → tilMin = absoluteMin', () => {
      const bounds = computeRowDateBounds({
        rowFra: undefined,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
      });
      expect(bounds.til.min).toBe(FALLBACK_MIN);
    });

    it('rowFra sat og rowFra > absoluteMin → tilMin = rowFra', () => {
      const rowFra = iso('2022-03-01');
      const bounds = computeRowDateBounds({
        rowFra,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
      });
      expect(bounds.til.min).toBe(rowFra);
    });

    it('rowFra sat men rowFra < absoluteMin → tilMin = absoluteMin (max af de to)', () => {
      const rowFra = iso('2019-01-01'); // < FALLBACK_MIN (2020-01-01)
      const bounds = computeRowDateBounds({
        rowFra,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
      });
      expect(bounds.til.min).toBe(FALLBACK_MIN);
    });

    it('tilMax default = tilFallbackMax', () => {
      const bounds = computeRowDateBounds({
        rowFra: undefined,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
      });
      expect(bounds.til.max).toBe(TIL_FALLBACK_MAX);
    });

    it('tilExtraMaxDate < tilFallbackMax → tilMax = tilExtraMaxDate', () => {
      const extraMax = iso('2023-06-30'); // < TIL_FALLBACK_MAX (2024-12-31)
      const bounds = computeRowDateBounds({
        rowFra: undefined,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
        tilExtraMaxDate: extraMax,
      });
      expect(bounds.til.max).toBe(extraMax);
    });

    it('tilExtraMaxDate > tilFallbackMax → tilMax = tilFallbackMax (min af de to)', () => {
      const extraMax = iso('2025-12-31'); // > TIL_FALLBACK_MAX (2024-12-31)
      const bounds = computeRowDateBounds({
        rowFra: undefined,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
        tilExtraMaxDate: extraMax,
      });
      expect(bounds.til.max).toBe(TIL_FALLBACK_MAX);
    });

    it('useTilExtraMaxDate = false → tilExtraMaxDate ignoreres', () => {
      const extraMax = iso('2021-01-01'); // meget tidlig dato
      const bounds = computeRowDateBounds({
        rowFra: undefined,
        rowTil: undefined,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
        tilExtraMaxDate: extraMax,
        useTilExtraMaxDate: false,
      });
      // Reglen er fravalgt — tilMax = tilFallbackMax
      expect(bounds.til.max).toBe(TIL_FALLBACK_MAX);
    });
  });

  describe('kombineret scenarie', () => {
    it('fuld konfiguration giver konsistente bounds', () => {
      const skadesdato = iso('2022-01-15');
      const rowFra = iso('2022-06-01');
      const rowTil = iso('2022-12-31');
      const extraMax = iso('2023-06-30');

      const bounds = computeRowDateBounds({
        skadesdatoMinDate: skadesdato,
        rowFra,
        rowTil,
        fallbackMin: FALLBACK_MIN,
        fallbackMax: FALLBACK_MAX,
        tilFallbackMax: TIL_FALLBACK_MAX,
        tilExtraMaxDate: extraMax,
      });

      expect(bounds.fra.min).toBe(skadesdato);
      expect(bounds.fra.max).toBe(rowTil);
      expect(bounds.til.min).toBe(rowFra); // rowFra (2022-06-01) > skadesdato (2022-01-15)
      expect(bounds.til.max).toBe(extraMax); // extraMax (2023-06-30) < tilFallbackMax (2024-12-31)
    });
  });
});
