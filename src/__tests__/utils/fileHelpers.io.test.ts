// @vitest-environment jsdom
import { downloadBlob, downloadFile, readFile } from '../../utils/fileHelpers';

vi.mock('../../utils/fileHandleStorage', () => ({
  loadDefaultDirectoryHandle: vi.fn(),
  verifyDirectoryHandle: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('fileHelpers – fil-I/O', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mineo-test'),
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

  it('lægger download-anchor i dokumentet og frigiver URL efter delay', () => {
    const blob = new Blob(['indhold'], { type: 'text/plain' });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.mocked(URL.createObjectURL);
    const revokeObjectURL = vi.mocked(URL.revokeObjectURL);

    downloadBlob(blob, 'sag.eo');

    const anchor = document.querySelector('a');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveAttribute('href', 'blob:mineo-test');
    expect(anchor).toHaveAttribute('download', 'sag.eo');
    expect(anchor).toHaveStyle({ display: 'none' });
    expect(anchor?.isConnected).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(anchor?.isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mineo-test');
    click.mockRestore();
  });

  it('bygger Blob med angivet MIME-type gennem downloadFile', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.mocked(URL.createObjectURL);

    downloadFile('indhold', 'sag.eo', 'application/json');

    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    if (!(blob instanceof Blob)) return;
    expect(blob?.type).toBe('application/json');
    expect(blob?.size).toBe(new Blob(['indhold']).size);
    click.mockRestore();
  });

  it('oversætter fejl under download til en dansk fejl', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => {
        throw new Error('URL fejlede');
      }),
    });

    expect(() => downloadFile('indhold', 'sag.eo')).toThrow('Kunne ikke downloade fil');
  });

  it('læser tekst fra brugerens fil og afviser manglende fil', async () => {
    // jsdom leverer FileReader-resultatet via den virkelige event loop, som fake timers ellers blokerer.
    vi.useRealTimers();
    const file = new File(['indhold'], 'sag.eo', { type: 'application/octet-stream' });

    await expect(readFile(file)).resolves.toBe('indhold');
    await expect(readFile(null)).rejects.toThrow('Ingen fil valgt');
  });
});
