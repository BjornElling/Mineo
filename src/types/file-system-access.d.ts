/**
 * Type definitions for File System Access API
 *
 * Baseret på WICG specifikationen:
 * https://wicg.github.io/file-system-access/
 */

export {};

/**
 * Well-known directory identifiers
 */
type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';

/**
 * StartIn kan enten være en well-known directory eller et FileSystemHandle
 */
type StartInOption = WellKnownDirectory | FileSystemHandle;

/**
 * File picker accept options
 */
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

/**
 * Options for showOpenFilePicker
 */
interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  startIn?: StartInOption;
}

/**
 * Options for showSaveFilePicker
 */
interface SaveFilePickerOptions {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  startIn?: StartInOption;
}

/**
 * Options for showDirectoryPicker
 */
interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: StartInOption;
}

/**
 * Permission mode for file system handles
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

