/// <reference types="vitest/globals" />

import { COLORS, TABLE_STYLES } from '../../../document/layout/pdfConfig';

describe('pdfConfig', () => {
  it('bruger lys baggrund til alternerende tabelrækker', () => {
    expect(TABLE_STYLES.alternateRowBackgroundColor).toEqual(COLORS.lightBackground);
  });
});
