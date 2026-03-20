import {
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';

describe('eetKapitaliseringPresentation', () => {
  it('udelader AM-bidrag i grundydelsesformlen for skader foer 2011', () => {
    expect(buildKapitaliseringGrundydelseLabel('50 %', 0)).toBe(
      'Grundydelse (50 %): Grundløn × EET × Erstatningsniveau'
    );

    expect(
      buildKapitaliseringGrundydelseExpression('351.539 kr.', '50 %', 80, 0, '140.615,60 kr.')
    ).toBe('351.539 kr. × 50 % × 80 % = 140.615,60 kr.');
  });

  it('bevarer AM-bidrag i grundydelsesformlen for skader fra 2011', () => {
    expect(buildKapitaliseringGrundydelseLabel('50 %', 8)).toBe(
      'Grundydelse (50 %): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag)'
    );

    expect(
      buildKapitaliseringGrundydelseExpression('351.539 kr.', '50 %', 83, 8, '134.998,98 kr.')
    ).toBe('351.539 kr. × 50 % × 83 % × 92 % = 134.998,98 kr.');
  });
});
