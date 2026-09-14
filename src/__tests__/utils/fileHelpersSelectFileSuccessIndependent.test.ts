// @vitest-environment jsdom

import { selectFile } from '../../utils/fileHelpers';

vi.mock('../../utils/fileHandleStorage', () => ({
  loadDefaultDirectoryHandle: vi.fn(),
  verifyDirectoryHandle: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

describe('PERSIST-001 – valgt fil gennem input-fallback', () => {
  afterEach(() => document.body.replaceChildren());

  it('returnerer den valgte File og rydder input-elementet efter change', async () => {
    const selectedFile = new File(['indhold'], 'sag.eo', { type: 'application/octet-stream' });
    const selectedPromise = selectFile('.eo');
    const input = document.querySelector('input[type="file"]');

    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('accept', '.eo');
    if (!(input instanceof HTMLInputElement)) throw new Error('Forventede et file-input');

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [selectedFile],
    });
    input.dispatchEvent(new Event('change'));

    await expect(selectedPromise).resolves.toBe(selectedFile);
    expect(document.body.contains(input)).toBe(false);
  });
});
