/**
 * Type definitions for file save/load operations
 * Bruges til at undgå 'any' types i MainLayout og andre steder
 */

import type { StorageKey } from '../config/storageManifest';

/**
 * Resultat fra saveToFile() operation
 */
export interface SaveFileResult {
  /** Om operationen blev gennemført succesfuldt */
  success: boolean;
  /** Om brugeren annullerede file picker dialog */
  cancelled?: boolean;
  /** Filnavn der blev gemt til */
  filename?: string;
  /** Antal felter der blev gemt */
  fieldCount?: number;
  /** Antal data-sektioner */
  sections?: number;
  /** Om filen blev verificeret korrekt */
  verified?: boolean;
  /** Advarsel fra verifikation (hvis nogen) */
  warning?: string;
  /** Detaljer om verifikation */
  verificationDetails?: {
    expected?: number;
    actual?: number;
    difference?: number;
    missingSections?: string[];
  };
}

/**
 * Resultat fra loadFromFile() operation
 */
export interface LoadFileResult {
  /** Om operationen blev gennemført succesfuldt */
  success: boolean;
  /** Om brugeren annullerede file picker dialog */
  cancelled?: boolean;
  /** Hvilken entrypoint der startede indlæsningen (til deterministisk UI-flow). */
  source?: 'manual' | 'pwa';
  /** PWA request-id (hvis kilden er PWA). */
  requestId?: string;
  /** Filnavn der blev indlæst fra */
  filename?: string;
  /** File System Access handle (hvis tilgængeligt) */
  fileHandle?: FileSystemFileHandle;
  /** Antal felter der blev indlæst */
  fieldCount?: number;
  /** Forventet antal felter (fra fil-metadata) */
  expectedFieldCount?: number;
  /** Antal data-sektioner */
  sections?: number;
  /** Fil-version */
  version?: string;
  /**
   * Preflight advarsel hvis filen ikke kan indlæses 1:1.
   *
   * Bruges til at give brugeren et aktivt valg før data anvendes:
   * - Indlæs trods fejl
   * - Send fejloplysninger
   * - Stop og gør intet
   */
  preflightWarning?: {
    expectedCount?: number;
    loadedCount: number;
    failedCount?: number;
    issues: Array<{
      /** Felt/sektion sti i filen (forståelig, men ikke teknisk perfekt). */
      path: string;
      /** Kort, brugerrettet årsag. */
      reason: string;
    }>;
  };
  /**
   * Schema-valideret snapshot af indlæst data pr. side (anvendes atomisk via persistence-laget).
   */
  snapshot?: Partial<Record<StorageKey, unknown>>;
}
