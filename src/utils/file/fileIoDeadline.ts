// Fil-I/O afventer normalt browseren eller filsystemet. Dialoger og close har andre
// regler: dialogen afventer brugeren, og en startet close kan stadig erstatte filen.
export const FILE_IO_TIMEOUT_MS = 15_000;

type FileIoPhase = 'read' | 'write' | 'verify' | 'directory';

const timeoutMessage: Record<FileIoPhase, string> = {
  read: 'Filen svarede ikke under indlæsning.',
  write: 'Filen svarede ikke under gemning.',
  verify: 'Filen svarede ikke under kontrol efter gemning.',
  directory: 'Standardmappen svarede ikke.',
};

export const withinFileIoDeadline = <T>(
  operation: Promise<T>,
  phase: FileIoPhase,
  onTimeout?: () => void,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DOMException(timeoutMessage[phase], 'TimeoutError'));
      try { onTimeout?.(); } catch { /* Bevar timeout som årsag. */ }
    }, phase === 'directory' ? 750 : FILE_IO_TIMEOUT_MS);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
};

export const getFileSnapshot = (handle: FileSystemFileHandle, phase: FileIoPhase): Promise<File> =>
  withinFileIoDeadline(handle.getFile(), phase);

export const readFileText = (file: File, phase: FileIoPhase): Promise<string> =>
  withinFileIoDeadline(file.text(), phase);
