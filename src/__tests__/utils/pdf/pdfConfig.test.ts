/// <reference types="vitest/globals" />

import { COLORS, TABLE_STYLES } from '../../../pdf/infrastructure/pdfConfig';

describe('pdfConfig', () => {
  it('bruger lys baggrund til alternerende tabelrækker', () => {
    expect(TABLE_STYLES.alternateRowBackgroundColor).toEqual(COLORS.lightBackground);
  });
});
