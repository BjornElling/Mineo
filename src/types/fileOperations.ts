/**
 * Typedefinitioner for file save/load-operationer
 * Bruges til at undgå 'any' types i MainLayout og andre steder
 */

import type { PersistedSectionKey } from '../config/persistenceRegistry';

export type LoadIssueKind =
  | 'migratedField'
  | 'strippedUnknownField'
  | 'sectionDropped'
  | 'unknownSection';

export type LoadIssue = Readonly<{
  /** Maskinlæsbar kategori til preflight/audit uden at parse dansk tekst. */
  kind: LoadIssueKind;
  /** Felt/sektion sti i filen (forståelig, men ikke teknisk perfekt). */
  path: string;
  /** Kort, brugerrettet årsag. */
  reason: string;
}>;

/**
 * Preflight-advarsel når filen ikke kan indlæses 1:1.
 *
 * Bruges til at give brugeren et aktivt valg før data anvendes:
 * - Indlæs trods fejl
 * - Send fejloplysninger
 * - Stop og gør intet
 */
export type LoadPreflightWarning = Readonly<{
  expectedCount?: number;
  loadedCount: number;
  failedCount?: number;
  issues: LoadIssue[];
}>;

/**
 * Resultat fra `saveToFile()`.
 *
 * Diskrimineret på `status`: et gem ender som `saved` (ét verificeret artefakt nåede en sink),
 * `cancelled` (brugeren lukkede file-pickeren) eller `stale` (sagen blev ændret, mens pickeren var åben —
 * fail-closed før nogen skrivning, critical-action-kontrakten §5). Alle egentlige fejl kastes som exceptions og
 * indgår derfor ikke i unionen — der findes ingen "success:false uden grund"-tilstand.
 */
export type SaveFileResult =
  | {
      status: 'saved';
      /** Filnavn der blev gemt til. */
      filename: string;
      /** Advarsel fra verifikation eller handle-fallback (hvis nogen). */
      warning?: string;
      // Informative metadata (ikke aflæst af gem-orkestreringen; bæres til logning/debug).
      /** Antal felter der blev gemt (til preflight-rapportering ved hent). */
      fieldCount?: number;
      /** Antal data-sektioner. */
      sections?: number;
      /** Om artefaktet bestod verifikation (read-back for File System Access, in-memory før download). */
      verified?: boolean;
    }
  | { status: 'cancelled' }
  /** Kilden var ikke længere frisk ved skrivetidspunktet; intet blev skrevet. */
  | { status: 'stale' };

/**
 * Fælles data for et gennemført load (uanset om det udløste en preflight-advarsel).
 * Selve anvendelsen sker atomisk via persistence-laget; dette er kun det validerede snapshot + metadata.
 */
type LoadedFileData = {
  /** Hvilken entrypoint der startede indlæsningen (til deterministisk UI-flow). */
  source: 'manual' | 'pwa';
  /** Filnavn der blev indlæst fra. */
  filename: string;
  /** Schema-valideret snapshot af indlæst data pr. side (anvendes atomisk via persistence-laget). */
  snapshot: Partial<Record<PersistedSectionKey, unknown>>;
  /** PWA request-id (hvis kilden er PWA). */
  requestId?: string;
  /** File System Access handle (hvis tilgængeligt). */
  fileHandle?: FileSystemFileHandle;
  // Informative metadata (ikke aflæst af apply-/UI-laget; bæres til logning/debug og fremtidig brug).
  /** Antal felter der faktisk blev indlæst i denne version. */
  fieldCount?: number;
  /** Forventet antal felter (fra fil-metadata). */
  expectedFieldCount?: number;
  /** Antal data-sektioner til stede i filen. */
  sections?: number;
  /** Fil-version. */
  version?: string;
};

/** Load der kan indlæses 1:1 uden datatab. */
export type LoadedFileResult = { status: 'loaded' } & LoadedFileData;

/** Load der er brugbart, men hvor noget brugerdata ikke kunne indlæses → brugeren skal tage stilling. */
export type PreflightFileResult = {
  status: 'preflight';
  preflightWarning: LoadPreflightWarning;
} & LoadedFileData;

/**
 * De load-resultater der bærer et snapshot og derfor kan anvendes (efter evt. preflight-/overwrite-bekræftelse).
 * `cancelled` er bevidst ekskluderet — det har intet snapshot og kan aldrig anvendes.
 */
export type ApplicableLoadFileResult = LoadedFileResult | PreflightFileResult;

/**
 * Resultat fra `loadFromFile()` / `loadFromFileHandle()`.
 *
 * Diskrimineret på `status`: `loaded` (klar til atomisk apply), `preflight` (brugbart, men kræver et
 * brugervalg pga. datatab) eller `cancelled` (bruger lukkede pickeren). Egentlige fejl kastes som
 * exceptions og indgår ikke i unionen.
 */
export type LoadFileResult =
  | LoadedFileResult
  | PreflightFileResult
  | { status: 'cancelled'; source: 'manual' | 'pwa' };
