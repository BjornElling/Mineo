import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
  buildKapitaliseringOpreguleringTil2024Expression,
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

  describe('buildKapitaliseringOpreguleringTil2024Expression', () => {
    it('udelader resultatled når opreguleret grundydelse ikke er angivet (afsluttes med =)', () => {
      expect(
        buildKapitaliseringOpreguleringTil2024Expression('100.000 kr.', '1,376', '37,6 %')
      ).toBe(
        'Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ 37,6 %): 100.000 kr. × 1,376 ='
      );
    });

    it('inkluderer resultatled når opreguleret grundydelse er angivet', () => {
      expect(
        buildKapitaliseringOpreguleringTil2024Expression('100.000 kr.', '1,376', '37,6 %', '137.600 kr.')
      ).toBe(
        'Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ 37,6 %): 100.000 kr. × 1,376 = 137.600 kr.'
      );
    });
  });

  describe('buildKapitaliseringAarsydelseExpression', () => {
    it('udelader reguleringsled når reguleringsprocenten er null (referenceår)', () => {
      // Uden resultatled afsluttes udtrykket med " =" (klar til at få resultatet sat på).
      expect(buildKapitaliseringAarsydelseExpression('137.600 kr.', null)).toBe(
        'Årlig ydelse (137.600 kr.) ='
      );
      expect(buildKapitaliseringAarsydelseExpression('137.600 kr.', null, '137.600 kr.')).toBe(
        'Årlig ydelse (137.600 kr.) = 137.600 kr.'
      );
    });

    it('inkluderer reguleringsled når reguleringsprocenten er angivet', () => {
      expect(buildKapitaliseringAarsydelseExpression('137.600 kr.', '3,9 %')).toBe(
        'Årlig ydelse (137.600 kr. × 3,9 %) ='
      );
      expect(buildKapitaliseringAarsydelseExpression('137.600 kr.', '3,9 %', '142.966 kr.')).toBe(
        'Årlig ydelse (137.600 kr. × 3,9 %) = 142.966 kr.'
      );
    });
  });
});
