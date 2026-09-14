// @vitest-environment jsdom

import { requestPersistentStorage } from '../../utils/fileHandleStorage';
import { logWarning } from '../../utils/logger';

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

const logWarningMock = vi.mocked(logWarning);
const originalNavigatorStorageDescriptor = Object.getOwnPropertyDescriptor(navigator, 'storage');

const setNavigatorStorage = (storage: unknown): void => {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: storage,
  });
};

const restoreNavigatorStorage = (): void => {
  if (originalNavigatorStorageDescriptor) {
    Object.defineProperty(navigator, 'storage', originalNavigatorStorageDescriptor);
  } else {
    Reflect.deleteProperty(navigator, 'storage');
  }
};

describe('PERSIST-002 – persistent storage object-rejection', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => restoreNavigatorStorage());

  it('returnerer false og logger objektets message ved en ikke-Error rejection', async () => {
    const persist = vi.fn().mockRejectedValue({ message: 'browser afviste' });
    setNavigatorStorage({ persist });

    await expect(requestPersistentStorage()).resolves.toBe(false);
    expect(persist).toHaveBeenCalledOnce();
    expect(logWarningMock).toHaveBeenCalledWith(
      'Kunne ikke anmode om persistent storage',
      {
        context: 'requestPersistentStorage',
        data: { errorMessage: 'browser afviste' },
      },
    );
  });
});
