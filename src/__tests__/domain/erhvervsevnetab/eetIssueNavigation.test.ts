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

  it('peger Stamdata-afledte EET-importfejl på Stamdata', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: 'skadedato-missing' })).toEqual({
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
    });
  });
});
