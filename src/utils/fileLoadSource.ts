import { MAX_FILE_SIZE } from '../config/version';
import { selectFile, readFile, type ResolvedDirectory, getStartInValue } from './fileHelpers';
import {
  ensureFileHandleReadPermission,
  isFileSystemAccessSupported,
  openFileWithPicker,
} from './fileSystemAccess';
import { formatAsAmount } from './formatUtils';

/**
 * Typet indlæsnings-port: hvor `.eo`-bytes kommer FRA.
 *
 * De tre historiske entrypoints (manuel File System Access-picker, manuel fallback-`<input>` og
 * PWA-fil-handle) gentog hver den samme kæde: hent en `File` (+ provenance) → tjek `.eo`-endelse →
 * tjek maksstørrelse → læs indhold. Porten kapsler kun det variable trin (hvor filen kommer fra og
 * hvordan dens bytes læses); selve validerings- og afkodnings-kæden ejes ét sted af `loadFromSource`
 * (fileLoad.ts), så samme rå bytes altid behandles ens uanset kilde.
 */
export type LoadSourceOutcome =
  | {
      status: 'selected';
      /** Hvilken entrypoint der startede indlæsningen (til deterministisk UI-flow). */
      source: 'manual' | 'pwa';
      /** Den valgte fil (bruges til filnavn, endelse- og størrelses-validering). */
      file: File;
      /** File System Access handle, hvis kilden har et (til senere overskrivning/PWA-metadata). */
      fileHandle?: FileSystemFileHandle;
      /** PWA request-id, hvis kilden er PWA. */
      requestId?: string;
      /** Læser den samme immutable `File`-snapshot, som blev valideret ved åbningen. */
      readContent: () => Promise<string>;
    }
  | { status: 'cancelled'; source: 'manual' | 'pwa' };

export interface LoadSource {
  open(): Promise<LoadSourceOutcome>;
}

/**
 * Forventelig afvisning af en fil, som brugeren har valgt.
 *
 * Filvælgerens endelses- og størrelsesregler er en del af den normale brugerrejse, ikke en
 * uventet systemfejl. Typen gør det muligt for både load-porten og UI-orchestratoren at bevare
 * den konkrete besked uden at sende afvisningen gennem den tekniske fejlkanal.
 */
export class FileSelectionError extends Error {
  readonly kind = 'file-selection' as const;

  constructor(message: string) {
    super(message);
    this.name = 'FileSelectionError';
  }
}

/**
 * Delt endelse- + størrelses-validering for en valgt fil. Tidligere verbatim-dupleret i alle tre
 * indlæsnings-grene; nu ét sted, så en `.eo`-fil valideres ens uanset hvordan den blev valgt.
 */
export const assertLoadableEoFile = (file: File): void => {
  if (!file.name.toLowerCase().endsWith('.eo')) {
    throw new FileSelectionError('Valgt fil er ikke en .eo fil');
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = formatAsAmount(file.size / (1024 * 1024), 1);
    const maxSizeMB = formatAsAmount(MAX_FILE_SIZE / (1024 * 1024), 0);
    throw new FileSelectionError(`Filen er for stor (${sizeMB} MB). Maksimum: ${maxSizeMB} MB`);
  }
};

/**
 * Manuel indlæsning: File System Access-picker hvis understøttet, ellers fallback-`<input>`.
 * Begge mapper brugerens annullering til `cancelled` (ingen fejl).
 */
export const createManualLoadSource = (resolvedDirectory?: ResolvedDirectory): LoadSource => ({
  async open(): Promise<LoadSourceOutcome> {
    if (isFileSystemAccessSupported()) {
      const startIn = resolvedDirectory ? getStartInValue(resolvedDirectory) : 'desktop';
      const result = await openFileWithPicker(startIn);
      if (!result) {
        return { status: 'cancelled', source: 'manual' };
      }
      return {
        status: 'selected',
        source: 'manual',
        file: result.file,
        fileHandle: result.handle,
        // Handle.getFile() må ikke kaldes igen her: filen kan være ændret mellem
        // endelses-/størrelseskontrollen og afkodningen. Den validerede File-instans
        // er den eneste bytes-snapshot, resten af load-kæden må behandle.
        readContent: () => readFile(result.file),
      };
    }

    const selected = await selectFile('.eo');
    if (!selected) {
      return { status: 'cancelled', source: 'manual' };
    }
    return {
      status: 'selected',
      source: 'manual',
      file: selected,
      readContent: () => readFile(selected),
    };
  },
});

/**
 * PWA-indlæsning fra en (muligvis persisteret) fil-handle. Læse-tilladelse gen-anmodes fail-closed
 * FØR filen åbnes, så en tilbagetrukket tilladelse giver en handlingsanvisende dansk besked frem for
 * en rå `DOMException` (fejlen mappes i `loadFromFileHandle`).
 */
export const createPwaLoadSource = (
  fileHandle: FileSystemFileHandle,
  requestId?: string
): LoadSource => ({
  async open(): Promise<LoadSourceOutcome> {
    await ensureFileHandleReadPermission(fileHandle);
    const file = await fileHandle.getFile();
    return {
      status: 'selected',
      source: 'pwa',
      file,
      fileHandle,
      requestId,
      // Samme TOCTOU-værn som ved manuel FSA-load: brug de bytes, der blev hentet
      // og valideret før handlen blev givet videre som metadata.
      readContent: () => readFile(file),
    };
  },
});
