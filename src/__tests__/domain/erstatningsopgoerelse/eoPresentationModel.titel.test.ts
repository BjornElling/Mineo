import { toISODateString } from '../../../types/branded';
import { buildEoPdfPresentation } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

// Titlen er dokumentets FØRSTE linje – det, modparten ser før alt andet. Sammensætningen var en
// skabelon-interpolation med faste mellemrum, og et tomt nummer efterlod derfor et DOBBELT mellemrum midt
// i overskriften. `.trim()` fjerner kun mellemrum i enderne, og fejlen var usynlig i begge de kanaler,
// brugeren kunne have opdaget den i: skærmens forhåndsvisning er HTML, som kollapser blanktegn, og
// filnavnet normaliseres af `sanitizeFilenamePart`. Den kunne kun ses i det åbnede dokument.

const DAGS_DATO = toISODateString('2026-03-01');

const titelFor = (overrides: Partial<ErstatningsopgoerelseValues>): string =>
  buildEoPdfPresentation(
    STAMDATA_INITIAL_VALUES,
    { ...createErstatningsopgoerelseInitialValues(), ...overrides },
    { dagsDatoISO: DAGS_DATO }
  ).titel;

describe('buildEoPdfPresentation – dokumentets titel', () => {
  it('efterlader intet dobbelt mellemrum, når nummeret er tomt og ledsageteksten udfyldt', () => {
    expect(titelFor({ eoNummer: undefined, eoLedsagetekst: 'revideret efter møde' }))
      .toBe('Erstatningsopgørelse (revideret efter møde)');
  });

  it('sætter ét mellemrum mellem hvert udfyldt led', () => {
    expect(titelFor({ eoNummer: '3', eoLedsagetekst: 'revideret efter møde' }))
      .toBe('Erstatningsopgørelse 3 (revideret efter møde)');
  });

  it('står alene, når hverken nummer eller ledsagetekst er udfyldt', () => {
    expect(titelFor({ eoNummer: undefined, eoLedsagetekst: undefined })).toBe('Erstatningsopgørelse');
  });

  it('bærer «Revideret» med lille begyndelsesbogstav på det andet ord, som dansk retskrivning kræver', () => {
    expect(titelFor({ revideretOpgoerelse: 'Ja', eoNummer: '3' }))
      .toBe('Revideret erstatningsopgørelse 3');
  });

  it('holder også en revideret titel fri for dobbelt mellemrum uden nummer', () => {
    expect(titelFor({ revideretOpgoerelse: 'Ja', eoNummer: undefined, eoLedsagetekst: 'efter møde' }))
      .toBe('Revideret erstatningsopgørelse (efter møde)');
  });

  it('lader et nummer, der kun er mellemrum, tælle som tomt', () => {
    expect(titelFor({ eoNummer: '   ', eoLedsagetekst: 'note' }))
      .toBe('Erstatningsopgørelse (note)');
  });
});
