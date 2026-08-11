import { toISODateString } from '../../../../types/branded';
import {
  findLatestSvieSmerteSatsAarAtOrBefore,
  getYearOneMonthAfter,
  hasSvieSmerteSatserForAar,
  resolveSvieSmerteSatsAarForReferenceDate,
} from '../../../../domain/erstatningsopgoerelse/helpers/svieSmerteSatsAar';

const iso = (value: string) => toISODateString(value);

describe('svieSmerteSatsAar', () => {
  const completeRates = {
    prDag: { 2024: 230, 2025: 240, 2026: 250 },
    max: { 2024: 88_500, 2025: 92_000, 2026: 96_000 },
  };

  it('bruger året én måned efter opgørelsesdatoen, også over et årsskifte', () => {
    expect(getYearOneMonthAfter(iso('2026-12-01'))).toBe(2027);
    expect(resolveSvieSmerteSatsAarForReferenceDate(iso('2025-02-28'), completeRates)).toBe(2025);
  });

  it('falder tilbage til seneste tidligere komplette satsår, når den fremtidige række mangler', () => {
    expect(resolveSvieSmerteSatsAarForReferenceDate(iso('2026-12-01'), completeRates)).toBe(2026);
    expect(findLatestSvieSmerteSatsAarAtOrBefore(2027, completeRates)).toBe(2026);
  });

  it('springer et år med kun den ene sats over', () => {
    const incompleteRates = {
      prDag: { 2024: 230, 2025: 240, 2026: 250 },
      max: { 2024: 88_500, 2026: 96_000 },
    };

    expect(hasSvieSmerteSatserForAar(2025, incompleteRates)).toBe(false);
    expect(findLatestSvieSmerteSatsAarAtOrBefore(2025, incompleteRates)).toBe(2024);
  });

  it('returnerer undefined fail-closed, når der ikke findes et komplet satsår på eller før målet', () => {
    expect(findLatestSvieSmerteSatsAarAtOrBefore(2023, completeRates)).toBeUndefined();
  });
});
