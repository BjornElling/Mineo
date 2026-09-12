// @vitest-environment jsdom
import { createManualLoadSource } from '../../utils/fileLoadSource';

const pickerNames = ['showOpenFilePicker', 'showSaveFilePicker'] as const;
type PickerName = (typeof pickerNames)[number];

const selectFileMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('../../utils/fileHelpers', () => ({
  getStartInValue: vi.fn(() => 'desktop'),
  readFile: (...args: unknown[]) => readFileMock(...args),
  selectFile: (...args: unknown[]) => selectFileMock(...args),
}));

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

const originalPickerDescriptors = new Map(
  pickerNames.map((name) => [name, Object.getOwnPropertyDescriptor(window, name)]),
);

const setPickerCapability = (name: PickerName, value: unknown): void => {
  Object.defineProperty(window, name, {
    configurable: true,
    writable: true,
    value,
  });
};

const removePickerCapability = (name: PickerName): void => {
  Reflect.deleteProperty(window, name);
};

const restorePickerCapabilities = (): void => {
  for (const name of pickerNames) {
    const descriptor = originalPickerDescriptors.get(name);
    if (descriptor) {
      Object.defineProperty(window, name, descriptor);
    } else {
      removePickerCapability(name);
    }
  }
};

describe('createManualLoadSource – capability og fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of pickerNames) removePickerCapability(name);
  });

  afterEach(() => {
    restorePickerCapabilities();
  });

  // TD-017: Ved den faktiske Hent-grænse skal fallbacken vælges, når open-picker-værdien
  // ikke er en funktion.
  it.each([
    ['showOpenFilePicker', undefined],
    ['showOpenFilePicker', null],
    ['showOpenFilePicker', {}],
  ] as const)('bruger fallback når %s ikke er en funktion: %o', (brokenPicker, brokenValue) => {
    const selectedFile = new File(['bytes'], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValue(selectedFile);
    readFileMock.mockResolvedValue('bytes');

    setPickerCapability('showOpenFilePicker', vi.fn());
    setPickerCapability('showSaveFilePicker', vi.fn());
    setPickerCapability(brokenPicker, brokenValue);

    return expect(createManualLoadSource().open()).resolves.toMatchObject({
      status: 'selected',
      source: 'manual',
      file: selectedFile,
    });
  });
});
