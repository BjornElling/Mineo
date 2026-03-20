import { getNavigationTargetFromRowId } from '../../../domain/debug/eoDebugNavigationMap';

describe('getNavigationTargetFromRowId', () => {
  it('navigerer lønindkomst-rækker til Lønindkomst-fanen og sektionen', () => {
    expect(getNavigationTargetFromRowId('loenindkomst.af-1.loenoplysninger')).toEqual({
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'loenindkomst',
      sectionId: 'loenindkomst',
      tabName: 'Lønindkomst',
      sectionTitle: 'Lønindkomst',
    });
  });
});
