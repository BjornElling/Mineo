type ClipboardEventLike = Readonly<{
  clipboardData?: DataTransfer | null;
  nativeEvent?: Readonly<{
    clipboardData?: DataTransfer | null;
    dataTransfer?: DataTransfer | null;
    data?: unknown;
  }>;
  data?: unknown;
}>;

const readFromClipboardData = (clipboard: DataTransfer | null | undefined): string => {
  if (!clipboard) return '';
  if (typeof clipboard.getData === 'function') {
    const text = clipboard.getData('text');
    if (text) return text;
    const plain = clipboard.getData('text/plain');
    if (plain) return plain;
  }
  return '';
};

type ClipboardWriteEventLike = Readonly<{
  clipboardData?: DataTransfer | null;
  nativeEvent?: Readonly<{
    clipboardData?: DataTransfer | null;
    dataTransfer?: DataTransfer | null;
  }>;
  preventDefault?: () => void;
}>;

type CopyTextOptions = Readonly<{
  value: string;
}>;

type CopyWholeValueOptions = Readonly<{
  isReadOnly: boolean;
  value: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}>;

export const copyWholeValueFromReadOnlyField = (
  event: ClipboardWriteEventLike,
  options: CopyWholeValueOptions
): boolean => {
  if (!options.isReadOnly) return false;

  const selectionStart = typeof options.selectionStart === 'number' ? options.selectionStart : null;
  const selectionEnd = typeof options.selectionEnd === 'number' ? options.selectionEnd : null;
  if (selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd) {
    return false;
  }

  const clipboard = event.clipboardData ?? event.nativeEvent?.clipboardData ?? event.nativeEvent?.dataTransfer ?? null;
  if (!clipboard || typeof clipboard.setData !== 'function') {
    return false;
  }

  clipboard.setData('text/plain', options.value);
  event.preventDefault?.();
  return true;
};

export const copyTextToClipboard = (
  event: ClipboardWriteEventLike,
  options: CopyTextOptions
): boolean => {
  const clipboard = event.clipboardData ?? event.nativeEvent?.clipboardData ?? event.nativeEvent?.dataTransfer ?? null;
  if (!clipboard || typeof clipboard.setData !== 'function') {
    return false;
  }

  clipboard.setData('text/plain', options.value);
  event.preventDefault?.();
  return true;
};

export const readClipboardText = (event: ClipboardEventLike): string => {
  const nativeClipboard = event.nativeEvent?.clipboardData ?? event.nativeEvent?.dataTransfer ?? null;
  const text = readFromClipboardData(event.clipboardData ?? nativeClipboard);
  if (text) return text;

  if (typeof event.data === 'string') return event.data;
  if (typeof event.nativeEvent?.data === 'string') return event.nativeEvent.data;
  return '';
};
