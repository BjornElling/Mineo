// @vitest-environment jsdom
import {
  copyWholeValueFromReadOnlyField,
  copyTextToClipboard,
  readClipboardText,
} from '../../utils/clipboardUtils';

/**
 * Bygger et DataTransfer-lignende objekt med kontrollerbar getData/setData.
 */
const makeClipboard = (
  getValues: Readonly<Record<string, string>> = {},
  withSetData = true
) => {
  const setData = withSetData ? vi.fn() : undefined;
  return {
    getData: vi.fn((type: string) => getValues[type] ?? ''),
    setData,
  } as unknown as DataTransfer & { setData?: ReturnType<typeof vi.fn> };
};

describe('readClipboardText', () => {
  it('læser fra event.clipboardData (text)', () => {
    const clipboard = makeClipboard({ text: 'abc' });
    expect(readClipboardText({ clipboardData: clipboard })).toBe('abc');
  });

  it('falder tilbage til text/plain når text er tom', () => {
    const clipboard = makeClipboard({ text: '', 'text/plain': 'plain-værdi' });
    expect(readClipboardText({ clipboardData: clipboard })).toBe('plain-værdi');
  });

  it('falder tilbage til nativeEvent.clipboardData', () => {
    const clipboard = makeClipboard({ text: 'fra-native' });
    expect(readClipboardText({ nativeEvent: { clipboardData: clipboard } })).toBe('fra-native');
  });

  it('falder tilbage til nativeEvent.dataTransfer', () => {
    const clipboard = makeClipboard({ text: 'fra-datatransfer' });
    expect(readClipboardText({ nativeEvent: { dataTransfer: clipboard } })).toBe('fra-datatransfer');
  });

  it('falder tilbage til event.data (string)', () => {
    expect(readClipboardText({ data: 'rå-data' })).toBe('rå-data');
  });

  it('falder tilbage til nativeEvent.data (string)', () => {
    expect(readClipboardText({ nativeEvent: { data: 'native-data' } })).toBe('native-data');
  });

  it('tom/manglende clipboard → tom streng', () => {
    expect(readClipboardText({})).toBe('');
    expect(readClipboardText({ clipboardData: null })).toBe('');
    expect(readClipboardText({ nativeEvent: { data: 42 } })).toBe('');
  });
});

describe('copyWholeValueFromReadOnlyField', () => {
  it('ikke-readonly felt → false (ingen handling)', () => {
    const clipboard = makeClipboard();
    const result = copyWholeValueFromReadOnlyField(
      { clipboardData: clipboard },
      { isReadOnly: false, value: 'x' }
    );
    expect(result).toBe(false);
    expect(clipboard.setData).not.toHaveBeenCalled();
  });

  it('readonly felt uden selektion → kopierer hele værdien og kalder preventDefault', () => {
    const clipboard = makeClipboard();
    const preventDefault = vi.fn();
    const result = copyWholeValueFromReadOnlyField(
      { clipboardData: clipboard, preventDefault },
      { isReadOnly: true, value: '1.234,56' }
    );
    expect(result).toBe(true);
    expect(clipboard.setData).toHaveBeenCalledWith('text/plain', '1.234,56');
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('readonly felt med aktiv markering (start != end) → false (lad browseren kopiere udvalget)', () => {
    const clipboard = makeClipboard();
    const result = copyWholeValueFromReadOnlyField(
      { clipboardData: clipboard },
      { isReadOnly: true, value: 'abc', selectionStart: 0, selectionEnd: 2 }
    );
    expect(result).toBe(false);
    expect(clipboard.setData).not.toHaveBeenCalled();
  });

  it('clipboard uden setData → false', () => {
    const clipboard = makeClipboard({}, false);
    const result = copyWholeValueFromReadOnlyField(
      { clipboardData: clipboard },
      { isReadOnly: true, value: 'abc' }
    );
    expect(result).toBe(false);
  });
});

describe('copyTextToClipboard', () => {
  it('skriver værdien til clipboard og kalder preventDefault', () => {
    const clipboard = makeClipboard();
    const preventDefault = vi.fn();
    const result = copyTextToClipboard({ clipboardData: clipboard, preventDefault }, { value: 'hej' });
    expect(result).toBe(true);
    expect(clipboard.setData).toHaveBeenCalledWith('text/plain', 'hej');
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('uden tilgængeligt clipboard → false', () => {
    expect(copyTextToClipboard({}, { value: 'hej' })).toBe(false);
  });
});
