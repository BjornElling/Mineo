// @vitest-environment jsdom

import { triggerDocumentDownload } from '../../document/downloadArtifact';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('dokumentaflevering – anchor-livscyklus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mineo-detached-anchor'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('frigiver object-URL sikkert, selv om browseren fjerner anchor før cleanup', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const blob = new Blob(['dokument'], { type: 'application/pdf' });

    triggerDocumentDownload({ blob, filename: 'sag.pdf' });

    const anchor = document.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveAttribute('href', 'blob:mineo-detached-anchor');
    expect(anchor).toHaveAttribute('download', 'sag.pdf');
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    anchor?.remove();

    expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mineo-detached-anchor');
    expect(document.querySelector('a')).toBeNull();

    click.mockRestore();
  });
});
