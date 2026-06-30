import {
  ERHVERVSEVNETAB_TAB_KEYS,
  resolveMidlertidigtEetIssueNavigation,
} from '../../../domain/erhvervsevnetab/eetIssueNavigation';

describe('resolveMidlertidigtEetIssueNavigation', () => {
  it('peger EET-importfejl på indtastningsfanen for EET-oplysninger', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'aarsloen-missing' })).toEqual({
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
      focusFieldPath: 'skadedato',
    });
  });

  it('peger skadelidtes fødselsdato-fejl på fødselsdato-feltet', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'skadelidte-fodselsdato-missing' })).toEqual({
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
      focusFieldPath: 'skadelidteFodselsdato',
    });
  });

  it('lader den generiske stamdata-schema-fejl pege på siden uden enkeltfelt', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'midlertidigt-eet-stamdata-schema-invalid' })).toEqual({
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
      focusFieldPath: undefined,
    });
  });
});
