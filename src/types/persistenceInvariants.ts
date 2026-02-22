import type { EoFileData } from '../schemas/eoFileSchema';
import { STORAGE_KEYS } from '../config/storageManifest';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Assert<T extends true> = T;

type StorageSections = keyof typeof STORAGE_KEYS;
type FileSections = keyof EoFileData;

// Compile-time invariant: alle persisterede sider (manifestet) skal være dækket af .eo fil-strukturen og omvendt.
export type _AssertStorageAndFileSectionsMatch = Assert<Equal<StorageSections, FileSections>>;

