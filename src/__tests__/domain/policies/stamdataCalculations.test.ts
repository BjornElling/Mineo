import {
  resolveStamdataDatoReference,
  resolveSkadestypeDatoLabel,
} from '../../../domain/policies/stamdataCalculations';

describe('stamdataCalculations', () => {
  it('bruger Skadedato som sikker standard, når skadestypen mangler', () => {
    expect(resolveStamdataDatoReference(undefined)).toEqual({
      kind: 'skadedato',
      label: 'Skadedato',
      labelLower: 'skadedatoen',
    });
    expect(resolveSkadestypeDatoLabel(undefined)).toBe('Skadedato');
  });

  it('bruger Anmeldelsesdato ved erhvervssygdom med korrekt bøjet form', () => {
    expect(resolveStamdataDatoReference('Erhvervssygdom')).toEqual({
      kind: 'anmeldelsesdato',
      label: 'Anmeldelsesdato',
      labelLower: 'anmeldelsesdatoen',
    });
  });
});
