import {
  formatSkadestypeMedDato,
  resolveStamdataDatoReference,
  resolveStamdataDatoReferenceForLabel,
  resolveSkadestypeDatoLabel,
  STAMDATA_DATO_REFERENCE_DEFAULT,
  STAMDATA_DATO_REFERENCES,
} from '../../../domain/policies/stamdataCalculations';

describe('stamdataCalculations', () => {
  it('bruger Skadedato som sikker standard, når skadestypen mangler', () => {
    // BB-121: referencen bærer alle former, så skadestype-afledt tekst ("på skadestidspunktet",
    // "Regulering fra skadesår", "Skaden er sket før …") bøjes ét sted frem for i hvert kaldssted.
    expect(resolveStamdataDatoReference(undefined)).toEqual({
      kind: 'skadedato',
      label: 'Skadedato',
      labelLower: 'skadedatoen',
      tidspunkt: 'skadestidspunkt',
      tidspunktBestemt: 'skadestidspunktet',
      aar: 'skadesår',
      skadenEr: 'skaden er',
      skadenErSket: 'skaden er sket',
      skadenErIndtraadt: 'skaden er indtrådt',
      skadeKort: 'skade',
      datoForbindelse: 'den',
    });
    expect(resolveSkadestypeDatoLabel(undefined)).toBe('Skadedato');
    expect(STAMDATA_DATO_REFERENCE_DEFAULT).toEqual(resolveStamdataDatoReference(undefined));
    expect(resolveStamdataDatoReference('Arbejdsulykke')).toEqual(resolveStamdataDatoReference(undefined));
  });

  it('bruger Anmeldelsesdato ved erhvervssygdom med korrekt bøjet form', () => {
    expect(resolveStamdataDatoReference('Erhvervssygdom')).toEqual({
      kind: 'anmeldelsesdato',
      label: 'Anmeldelsesdato',
      labelLower: 'anmeldelsesdatoen',
      tidspunkt: 'anmeldelsestidspunkt',
      tidspunktBestemt: 'anmeldelsestidspunktet',
      aar: 'anmeldelsesår',
      skadenEr: 'skaden er anmeldt',
      skadenErSket: 'skaden er anmeldt',
      skadenErIndtraadt: 'skaden er anmeldt',
      skadeKort: 'skade anmeldt',
      datoForbindelse: 'anmeldt den',
    });
  });

  it('finder referencen ud fra et allerede valgt datonavn', () => {
    expect(resolveStamdataDatoReferenceForLabel('Anmeldelsesdato')).toEqual(resolveStamdataDatoReference('Erhvervssygdom'));
    expect(resolveStamdataDatoReferenceForLabel('Skadedato')).toEqual(resolveStamdataDatoReference('Arbejdsulykke'));
  });

  it('rummer begge referencer til genkendelse af formulerede tekster', () => {
    expect(STAMDATA_DATO_REFERENCES.map((reference) => reference.kind)).toEqual(['skadedato', 'anmeldelsesdato']);
  });

  it('forbinder skadestype og dato efter skadestypen', () => {
    expect(formatSkadestypeMedDato('Arbejdsulykke', '1. juni 2020')).toBe('Arbejdsulykke den 1. juni 2020');
    expect(formatSkadestypeMedDato('Erhvervssygdom', '1. juni 2020')).toBe('Erhvervssygdom anmeldt den 1. juni 2020');
  });
});
