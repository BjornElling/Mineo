/// <reference types="vitest/globals" />

import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

vi.mock('../../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

import { canDownloadEoPdf } from '../../../utils/pdf/pdfService';

describe('canDownloadEoPdf', () => {
  it('returnerer false ved blokkerende fejl', () => {
    expect(
      canDownloadEoPdf({
        hasBlockingErrors: true,
        stamdataValues: STAMDATA_INITIAL_VALUES,
        eoValues: createErstatningsopgoerelseInitialValues(),
      })
    ).toBe(false);
  });

  it('returnerer false ved ugyldig payload selvom værdier ikke er null', () => {
    expect(
      canDownloadEoPdf({
        hasBlockingErrors: false,
        stamdataValues: { foo: 'bar' },
        eoValues: { baz: 1 },
      })
    ).toBe(false);
  });

  it('returnerer true ved gyldig payload uden blokkerende fejl', () => {
    expect(
      canDownloadEoPdf({
        hasBlockingErrors: false,
        stamdataValues: STAMDATA_INITIAL_VALUES,
        eoValues: createErstatningsopgoerelseInitialValues(),
      })
    ).toBe(true);
  });
});
