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

export const readClipboardText = (event: ClipboardEventLike): string => {
  const nativeClipboard = event.nativeEvent?.clipboardData ?? event.nativeEvent?.dataTransfer ?? null;
  const text = readFromClipboardData(event.clipboardData ?? nativeClipboard);
  if (text) return text;

  if (typeof event.data === 'string') return event.data;
  if (typeof event.nativeEvent?.data === 'string') return event.nativeEvent.data;
  return '';
};
