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

/**
 * Brevhoved-indstillinger for PDF-dokumenter
 *
 * Bestemmer hvilke PDF-typer der skal have brevhoved med skadelidtes navn,
 * skadestype, skadesdato og sagsnr.
 */
export const brevhovedIndstillingerSchema = z.object({
  erstatningsopgoerelse: z.boolean(),
  shDage: z.boolean(),
  renteberegning: z.boolean(),
  // KRL har ingen separat toggle og arver altid denne 1-til-1 i pdfService.
  regulering: z.boolean(),
  varigeMen: z.boolean(),
  satser: z.boolean(),
  aarsloensberegning: z.boolean(),
  erhvervsevnetab: z.boolean(),
  forsoergertab: z.boolean(),
});

export type BrevhovedIndstillinger = z.infer<typeof brevhovedIndstillingerSchema>;

// Standard er at vise brevhoved på alle hoved-PDF'er; hjælpe-/tekniske bilag forbliver skjult som default.
export const DEFAULT_BREVHOVED_INDSTILLINGER: BrevhovedIndstillinger = {
  erstatningsopgoerelse: true,
  shDage: false,
  renteberegning: true,
  regulering: false,
  varigeMen: true,
  satser: false,
  aarsloensberegning: true,
  erhvervsevnetab: true,
  forsoergertab: true,
};

export const APP_SETTINGS_AFSLUTTES_MED_OPTIONS = ['Bekræftet godkendt', 'Underskrift-linje'] as const;
export const APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS = ['Almindelig løn', 'SH-udbetaling', 'Ingen'] as const;
export const APP_SETTINGS_SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_OPTIONS = ['fuld', 'halv'] as const;

export type AppSettingsAfsluttesMedOption = (typeof APP_SETTINGS_AFSLUTTES_MED_OPTIONS)[number];
export type AppSettingsLoenPaaHelligdageOption = (typeof APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS)[number];
export type AppSettingsSvieSmerteDelvisSygemeldingSatsOption =
  (typeof APP_SETTINGS_SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_OPTIONS)[number];

export const appSettingsSchema = z
  .object({
    showContentBoxReportButton: z.boolean(),
    showEODebugMenu: z.boolean(),
    fontStyleColorDebug: z.boolean(),
    showStamdataTestTab: z.boolean(),
    erstatningsopgoerelseAfsluttesMed: z.enum(APP_SETTINGS_AFSLUTTES_MED_OPTIONS),
    // Standardværdier for nye ansættelsesforhold
    defaultFuldLoenUnderFerie: z.boolean(),
    defaultLoenPaaHelligdage: z.enum(APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS),
    defaultOverenskomstLoenmodtager: z.string(),
    defaultOverenskomstArbejdsgiver: z.string(),
    defaultSvieSmerteDelvisSygemeldingSats: z.enum(APP_SETTINGS_SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_OPTIONS),
    defaultIndsaetUdkastStempel: z.boolean(),
    defaultVisBilagsnumre: z.boolean(),
    allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: z.boolean(),
    allowReguleringMedUdloebMedMaaneder: z.number().int().min(0).max(12),
    // Fil-placering (IndexedDB handle ID - validering sker runtime, ikke i schema)
    defaultDirectoryHandleId: z.string().optional(),
    // Brevhoved-indstillinger for PDF-dokumenter
    brevhovedIndstillinger: brevhovedIndstillingerSchema,
  })
  .strict();

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  showContentBoxReportButton: false,
  showEODebugMenu: false,
  fontStyleColorDebug: false,
  showStamdataTestTab: false,
  erstatningsopgoerelseAfsluttesMed: 'Bekræftet godkendt',
  // Standardværdier for nye ansættelsesforhold
  defaultFuldLoenUnderFerie: true,
  defaultLoenPaaHelligdage: 'Almindelig løn',
  defaultOverenskomstLoenmodtager: 'ALLE',
  defaultOverenskomstArbejdsgiver: 'ALLE',
  defaultSvieSmerteDelvisSygemeldingSats: 'halv',
  defaultIndsaetUdkastStempel: true,
  defaultVisBilagsnumre: false,
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
  allowReguleringMedUdloebMedMaaneder: 6,
  // Fil-placering (undefined = brug desktop som fallback)
  defaultDirectoryHandleId: undefined,
  // Brevhoved-indstillinger
  brevhovedIndstillinger: DEFAULT_BREVHOVED_INDSTILLINGER,
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
 * Normalisering:
 * - 'ALLE' (UI-værdi) → undefined (domæne-værdi)
 * - Alle andre værdier bevares
 *
 * @param settings Valideret AppSettings med standardværdier
 * @returns OverenskomstFilter med domæne-værdier
 */
export const resolveDefaultOverenskomstFilter = (settings: AppSettings): OverenskomstFilter => {
  return {
    loenmodtager: settings.defaultOverenskomstLoenmodtager === 'ALLE' ? undefined : settings.defaultOverenskomstLoenmodtager,
    arbejdsgiver: settings.defaultOverenskomstArbejdsgiver === 'ALLE' ? undefined : settings.defaultOverenskomstArbejdsgiver,
  };
};
