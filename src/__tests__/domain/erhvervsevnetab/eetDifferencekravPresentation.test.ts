import { buildBeregnetDifferencekravLabel } from '../../../domain/erhvervsevnetab/eetDifferencekravPresentation';

describe('buildBeregnetDifferencekravLabel', () => {
  it('viser plain label uden parentes når der ikke er noget forlig', () => {
    expect(buildBeregnetDifferencekravLabel(null, '1.095.121 kr.')).toBe('Beregnet differencekrav');
  });

  it('viser forligs-label og det fulde krav i parentes ved brøk-forlig', () => {
    expect(buildBeregnetDifferencekravLabel('2/3', '1.095.121 kr.')).toBe(
      'Beregnet differencekrav (2/3 af 1.095.121 kr.)'
    );
  });

  it('viser procent-forlig i parentes', () => {
    expect(buildBeregnetDifferencekravLabel('50 %', '1.095.121 kr.')).toBe(
      'Beregnet differencekrav (50 % af 1.095.121 kr.)'
    );
  });
});
