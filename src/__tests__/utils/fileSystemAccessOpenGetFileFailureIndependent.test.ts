// @vitest-environment jsdom

import { logError } from '../../utils/logger';
import { openFileWithPicker } from '../../utils/fileSystemAccess';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

const logErrorMock = vi.mocked(logError);
const originalOpenPickerDescriptor = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');

const restoreOpenPicker = (): void => {
  if (originalOpenPickerDescriptor) {
    Object.defineProperty(window, 'showOpenFilePicker', originalOpenPickerDescriptor);
  } else {
    Reflect.deleteProperty(window, 'showOpenFilePicker');
  }
};

describe('PERSIST-002 – File System Access getFile-fejl efter valgt fil', () => {
  afterEach(() => {
    restoreOpenPicker();
  });

  it('oversætter getFile-fejl efter picker-success og logger den oprindelige fejl', async () => {
    const getFile = vi.fn().mockRejectedValue(new Error('filen kunne ikke hentes'));
    const fileHandle = {
      name: 'sag.eo',
      getFile,
    } as unknown as FileSystemFileHandle;
    const picker = vi.fn().mockResolvedValue([fileHandle]);
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      writable: true,
      value: picker,
    });

    await expect(openFileWithPicker('downloads')).rejects.toThrow(
      'Kunne ikke åbne fil: filen kunne ikke hentes',
    );

    expect(picker).toHaveBeenCalledOnce();
    expect(getFile).toHaveBeenCalledOnce();
    expect(logErrorMock).toHaveBeenCalledWith(
      'Fejl ved fil-åbning:',
      expect.objectContaining({ message: 'filen kunne ikke hentes' }),
    );
  });
});
