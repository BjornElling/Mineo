/**
 * Typedefinitioner for File System Access API
 *
 * Baseret på WICG specifikationen:
 * https://wicg.github.io/file-system-access/
 */

export {};

/**
 * Identifikatorer for well-known directories
 */
type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';

/**
 * StartIn kan enten være en well-known directory eller et FileSystemHandle
 */
type StartInOption = WellKnownDirectory | FileSystemHandle;

/**
 * Accept-indstillinger for file picker
 */
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

/**
 * Indstillinger til showOpenFilePicker
 */
interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  startIn?: StartInOption;
}

/**
 * Indstillinger til showSaveFilePicker
 */
interface SaveFilePickerOptions {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  startIn?: StartInOption;
}

/**
 * Indstillinger til showDirectoryPicker
 */
interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: StartInOption;
}

/**
 * Permission-tilstand for file system handles
 */
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

declare global {
  /**
   * Udvider Window interface med File System Access API metoder
   */
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  }

  /**
   * Udvider FileSystemDirectoryHandle med permission metoder
   */
  interface FileSystemDirectoryHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }
}

