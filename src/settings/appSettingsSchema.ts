import { z } from 'zod';

/**
 * App settings (programindstillinger) – NOT part of `.eo` persistence.
 *
 * IMPORTANT (trust-critical + persistence separation):
 * - These settings are stored in `localStorage` and are meant to be "device local".
 * - They MUST NOT be stored in FormPersistenceContext / sessionStorage `STORAGE_KEYS`,
 *   and therefore MUST NOT be included in `.eo` save/load operations.
 *
 * Refs:
 * - `src/config/storageManifest.ts` (only sessionStorage keys in manifest are saved to `.eo`)
 * - `src/utils/fileSave.ts` / `src/utils/fileLoad.ts` (operate on manifest-bound data)
 * - `src/contracts/app-settings.md` (normative documentation for this separation)
 */

export const appSettingsSchema = z
  .object({
    showContentBoxReportButton: z.boolean(),
    showEODebugMenu: z.boolean(),
    fontStyleColorDebug: z.boolean(),
    showStamdataTestTab: z.boolean(),
    erstatningsopgoerelseAfsluttesMed: z.enum(['Bekræftet godkendt', 'Underskrift-linje']),
    // Standardværdier for nye ansættelsesforhold
    defaultFuldLoenUnderFerie: z.boolean(),
    defaultLoenPaaHelligdage: z.enum(['Almindelig løn', 'SH-udbetaling', 'Ingen']),
    defaultOverenskomstLoenmodtager: z.string(),
    defaultOverenskomstArbejdsgiver: z.string(),
    // Fil-placering (IndexedDB handle ID - validering sker runtime, ikke i schema)
    defaultDirectoryHandleId: z.string().optional(),
  })
  .strict();

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  showContentBoxReportButton: true,
  showEODebugMenu: false,
  fontStyleColorDebug: false,
  showStamdataTestTab: false,
  erstatningsopgoerelseAfsluttesMed: 'Bekræftet godkendt',
  // Standardværdier for nye ansættelsesforhold
  defaultFuldLoenUnderFerie: true,
  defaultLoenPaaHelligdage: 'Almindelig løn',
  defaultOverenskomstLoenmodtager: 'ALLE',
  defaultOverenskomstArbejdsgiver: 'ALLE',
  // Fil-placering (undefined = brug desktop som fallback)
  defaultDirectoryHandleId: undefined,
};

/**
 * Overenskomst-filter type (domæne-værdi, ikke UI-værdi)
 *
 * I domænet bruger vi `undefined` for "alle" – ALDRIG strengen 'ALLE'.
 * 'ALLE' eksisterer kun i UI-laget som dropdown-værdi.
 */
export type OverenskomstFilter = Readonly<{
  loenmodtager: string | undefined;
  arbejdsgiver: string | undefined;
}>;

/**
 * Centraliseret mapping fra AppSettings til overenskomstFilter (domæne-værdi)
 *
 * KRITISK KONTRAKT:
 * - Denne funktion må KUN anvendes ved oprettelse af NYE sagsdata
 * - Den må ALDRIG anvendes på eksisterende ansættelsesforhold
 * - Misbrug ville lade settings-ændringer overskrive brugerens valg i eksisterende sager
 *
 * Godkendte anvendelser:
 * - createErstatningsopgoerelseInitialValues() – første ansættelsesforhold i ny sag
 * - createBlankAnsaettelsesforhold() – tilføjelse af nyt ansættelsesforhold
 *
 * Validering:
 * - AppSettings valideres via safeParse ved grænsefladen til sagsdata
 * - Ved invalid settings bruges DEFAULT_APP_SETTINGS som fallback
 *
 * Normalisering:
 * - 'ALLE' (UI-værdi) → undefined (domæne-værdi)
 * - Alle andre værdier bevares
 *
 * @param settings AppSettings med standardværdier (optional)
 * @returns OverenskomstFilter med domæne-værdier
 */
export const resolveDefaultOverenskomstFilter = (settings?: AppSettings): OverenskomstFilter => {
  const parsed = settings ? appSettingsSchema.safeParse(settings) : { success: false as const };
  const safeSettings = parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;

  return {
    loenmodtager: safeSettings.defaultOverenskomstLoenmodtager === 'ALLE' ? undefined : safeSettings.defaultOverenskomstLoenmodtager,
    arbejdsgiver: safeSettings.defaultOverenskomstArbejdsgiver === 'ALLE' ? undefined : safeSettings.defaultOverenskomstArbejdsgiver,
  };
};

