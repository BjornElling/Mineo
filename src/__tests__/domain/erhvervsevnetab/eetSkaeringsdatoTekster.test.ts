import {
  buildDifferencekravFradragLinjer,
  buildLoebendeErstatningsniveauTekst,
  buildLoebendeGrundloenNiveauTekst,
} from '../../../domain/erhvervsevnetab/eetSkaeringsdatoTekster';

describe('eetSkaeringsdatoTekster', () => {
  it('formulerer differencekravets fradragslinjer efter skadestypen', () => {
    expect(buildDifferencekravFradragLinjer({ skadestype: 'Arbejdsulykke', fradragGaelderForFoer2011: true })).toEqual([
      'Skaden er indtrådt før 16. juni 2011.',
      'Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser.',
    ]);
    expect(buildDifferencekravFradragLinjer({ skadestype: 'Erhvervssygdom', fradragGaelderForFoer2011: false })).toEqual([
      'Erhvervssygdommen er anmeldt den 16. juni 2011 eller senere.',
      'Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser.',
    ]);
  });

  it('formulerer grundlønsniveauet efter skadestypen', () => {
    expect(buildLoebendeGrundloenNiveauTekst({ skadestype: undefined, grundloenNiveau: '2003' }))
      .toBe('Skaden er sket før 1. juli 2024, og grundlønnen beregnes derfor i 2003-niveau.');
    expect(buildLoebendeGrundloenNiveauTekst({ skadestype: 'Erhvervssygdom', grundloenNiveau: '2024' }))
      .toBe('Erhvervssygdommen er anmeldt fra 1. juli 2024, og grundlønnen beregnes derfor i 2024-niveau.');
  });

  it('formulerer erstatningsniveauet efter skadestypen', () => {
    expect(buildLoebendeErstatningsniveauTekst({ skadestype: 'Arbejdsulykke', erstatningsniveauPct: 83 }))
      .toBe('Da skaden er sket 1/1-2011 eller senere, udgør erstatningsniveauet');
    expect(buildLoebendeErstatningsniveauTekst({ skadestype: 'Arbejdsulykke', erstatningsniveauPct: 80 }))
      .toBe('Da skaden er før 1/1-2011, udgør erstatningsniveauet');
    expect(buildLoebendeErstatningsniveauTekst({ skadestype: 'Erhvervssygdom', erstatningsniveauPct: 83 }))
      .toBe('Da erhvervssygdommen er anmeldt 1/1-2011 eller senere, udgør erstatningsniveauet');
    expect(buildLoebendeErstatningsniveauTekst({ skadestype: 'Erhvervssygdom', erstatningsniveauPct: 80 }))
      .toBe('Da anmeldelsen er før 1/1-2011, udgør erstatningsniveauet');
  });
});
