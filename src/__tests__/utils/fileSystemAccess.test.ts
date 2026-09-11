// @vitest-environment jsdom
import { isFileSystemAccessSupported } from '../../utils/fileSystemAccess';

type PickerName = 'showOpenFilePicker' | 'showSaveFilePicker';

const pickerNames: readonly PickerName[] = ['showOpenFilePicker', 'showSaveFilePicker'];
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

describe('fileSystemAccess', () => {
  beforeEach(() => {
    for (const name of pickerNames) removePickerCapability(name);
  });

  afterEach(() => {
    restorePickerCapabilities();
  });

  describe('isFileSystemAccessSupported', () => {
    it('returnerer true når begge picker-kapabiliteter er callable', () => {
      setPickerCapability('showOpenFilePicker', vi.fn());
      setPickerCapability('showSaveFilePicker', vi.fn());

      expect(isFileSystemAccessSupported()).toBe(true);
    });

    it.each([
      ['showOpenFilePicker', 'showOpenFilePicker'],
      ['showSaveFilePicker', 'showSaveFilePicker'],
    ] as const)('returnerer false når %s mangler', (_label, missingPicker) => {
      setPickerCapability('showOpenFilePicker', vi.fn());
      setPickerCapability('showSaveFilePicker', vi.fn());
      removePickerCapability(missingPicker);

      expect(isFileSystemAccessSupported()).toBe(false);
    });

    // TD-017: Den nuværende property-only-detektion accepterer disse værdier som en picker.
    // `it.fails` holder fundet synligt i testlaget uden at ændre produktets fallback-adfærd.
    it.fails.each([
      ['showOpenFilePicker', undefined],
      ['showSaveFilePicker', undefined],
      ['showOpenFilePicker', null],
      ['showSaveFilePicker', null],
      ['showOpenFilePicker', {}],
      ['showSaveFilePicker', {}],
    ] as const)('skal afvise %s når værdien er undefined eller ikke-callable: %o', (brokenPicker, value) => {
      setPickerCapability('showOpenFilePicker', vi.fn());
      setPickerCapability('showSaveFilePicker', vi.fn());
      setPickerCapability(brokenPicker, value);

      expect(isFileSystemAccessSupported()).toBe(false);
    });
  });
});
