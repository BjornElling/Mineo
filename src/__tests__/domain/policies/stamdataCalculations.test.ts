import {
  resolveStamdataDatoReference,
  resolveSkadestypeDatoLabel,
} from '../../../domain/policies/stamdataCalculations';

describe('stamdataCalculations', () => {
  it('bruger Skadedato som sikker standard, når skadestypen mangler', () => {
    // BB-121: referencen bærer nu også tidspunkts- og årsformerne, så skadestype-afledt tekst
    // ("på skadestidspunktet", "Regulering fra skadesår") kan bøjes ét sted frem for i hvert kaldssted.
    expect(resolveStamdataDatoReference(undefined)).toEqual({
      kind: 'skadedato',
      label: 'Skadedato',
      labelLower: 'skadedatoen',
      tidspunkt: 'skadestidspunkt',
      tidspunktBestemt: 'skadestidspunktet',
      aar: 'skadesår',
    });
    expect(resolveSkadestypeDatoLabel(undefined)).toBe('Skadedato');
  });

  it('bruger Anmeldelsesdato ved erhvervssygdom med korrekt bøjet form', () => {
    expect(resolveStamdataDatoReference('Erhvervssygdom')).toEqual({
      kind: 'anmeldelsesdato',
      label: 'Anmeldelsesdato',
      labelLower: 'anmeldelsesdatoen',
      tidspunkt: 'anmeldelsestidspunkt',
      tidspunktBestemt: 'anmeldelsestidspunktet',
      aar: 'anmeldelsesår',
    });
  });
});
