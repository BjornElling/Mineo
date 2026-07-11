import { getNumericBoundsConfigErrors } from '../../utils/numericFieldConfig';

describe('getNumericBoundsConfigErrors', () => {
  it('accepterer fraværende og ordnede endelige bounds', () => {
    expect(getNumericBoundsConfigErrors({})).toEqual([]);
    expect(getNumericBoundsConfigErrors({ minValue: -1, maxValue: 2 })).toEqual([]);
  });

  it('rapporterer ikke-endelige bounds i stabil rækkefølge', () => {
    expect(getNumericBoundsConfigErrors({ minValue: Number.NaN, maxValue: Number.POSITIVE_INFINITY }))
      .toEqual([
        'Ugyldig konfiguration: minValue skal være et tal',
        'Ugyldig konfiguration: maxValue skal være et tal',
      ]);
  });

  it('rapporterer et omvendt interval', () => {
    expect(getNumericBoundsConfigErrors({ minValue: 2, maxValue: 1 })).toEqual([
      'Ugyldig konfiguration: minValue er større end maxValue',
    ]);
  });

  it('afviser negative bounds når feltets grammatik ikke tillader fortegn', () => {
    expect(getNumericBoundsConfigErrors({ minValue: -2, maxValue: -1, allowNegative: false }))
      .toEqual([
        'Ugyldig konfiguration: minValue er negativ, men allowNegative=false',
        'Ugyldig konfiguration: maxValue er negativ, men allowNegative=false',
      ]);
  });
});
