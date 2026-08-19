import {
  ERHVERVSEVNETAB_TAB_KEYS,
  resolveMidlertidigtEetIssueNavigation,
} from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../../inputCore/catalog/stamdataDescriptors';

describe('resolveMidlertidigtEetIssueNavigation', () => {
  /**
   * EET-fanens issues bærer nu OGSÅ en sektion, så linket viser HVOR på fanen problemet hører.
   *
   * Før pegede denne vej kun på fanen: linket skiftede fane og efterlod brugeren øverst på siden uden
   * nogen markering. Målet er bevidst sektionen og ikke feltet – EO-siden forbruger denne rute og må
   * ikke koble til EET's feltdescriptorer (domain-boundary-contract §9/§10).
   */
  it('peger EET-importfejl på den rette sektion på EET-oplysningerfanen', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'aarsloen-missing' })).toEqual({
      kind: 'erhvervsevnetab-tab',
      pageName: 'Erhvervsevnetab',
      tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
      tabName: 'EET oplysninger',
      sectionId: 'eet-oplysninger-asl',
    });
  });

  it('peger en manglende ASL-afgørelse på ASL-sektionen', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'asl-afgoerelser-empty' })).toEqual({
      kind: 'erhvervsevnetab-tab',
      pageName: 'Erhvervsevnetab',
      tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
      tabName: 'EET oplysninger',
      sectionId: 'eet-oplysninger-asl',
    });
  });

  it('beholder fanen som mål for et issue uden kendt sektion', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'et-ukendt-issue-id' })).toEqual({
      kind: 'erhvervsevnetab-tab',
      pageName: 'Erhvervsevnetab',
      tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
      tabName: 'EET oplysninger',
    });
  });

  it('peger Stamdata-afledte EET-importfejl på Stamdata med konkret felt', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'skadedato-missing' })).toEqual({
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
      focusFieldAddress: stamdataSkadedatoField.bind().address,
    });
  });

  it('peger skadelidtes fødselsdato-fejl på fødselsdato-feltet', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'skadelidte-fodselsdato-missing' })).toEqual({
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
      focusFieldAddress: stamdataSkadelidteFodselsdatoField.bind().address,
    });
  });

  it('lader den generiske stamdata-schema-fejl pege på siden uden enkeltfelt', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'midlertidigt-eet-stamdata-schema-invalid' })).toEqual({
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
      focusFieldAddress: undefined,
    });
  });

  it('lader en stamdata-datoordensfejl pege på siden uden at gætte ét af de to felter', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'midlertidigt-eet-stamdata-date-order' })).toEqual({
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
      focusFieldAddress: undefined,
    });
  });
});
