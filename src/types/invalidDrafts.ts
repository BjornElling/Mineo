import type { StorageKey } from '../config/storageManifest';

/** Adresse på ét persisteret, afsluttet ugyldigt input der skal ryddes. */
export type InvalidDraftClear = Readonly<{ pageKey: StorageKey; fieldPath: string }>;
