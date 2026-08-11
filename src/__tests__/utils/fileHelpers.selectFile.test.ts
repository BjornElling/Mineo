// @vitest-environment jsdom
import { selectFile } from '../../utils/fileHelpers';

describe('selectFile', () => {
  it('afslutter idempotent når browseren leverer flere dialog-callbacks', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const promise = selectFile('.eo');
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('accept', '.eo');

    const file = new File(['{}'], 'sag.eo', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input?.dispatchEvent(new Event('change'));
    input?.dispatchEvent(new Event('cancel'));

    await expect(promise).resolves.toBe(file);
    expect(input?.isConnected).toBe(false);
    click.mockRestore();
  });
});
