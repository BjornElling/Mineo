import { z } from 'zod';
import {
  afsluttesMedEnum,
  loenPaaHelligdageEnum,
  loenperiodeEnum,
  svieSmerteDelvisSygemeldingSatsEnum,
} from '../schemas/formSchemas';
import {
  DEFAULT_DOCUMENT_DOWNLOAD_FORMAT,
  documentDownloadFormatSchema,
  type DocumentDownloadFormat,
} from '../document/documentFormat';
import type { DocumentBrevhovedType } from '../document/layout/documentBrevhoved';

/**
 * Programindstillinger (app settings) – IKKE en del af `.eo`-persistence.
 *
 * VIGTIGT (trust-kritisk + adskillelse af persistence):
 * - Disse indstillinger gemmes i `localStorage` og er ment som "enhedslokale".
 * - De MÅ IKKE gemmes i FormPersistenceContext / sessionStorage `STORAGE_KEYS`,
 *   og MÅ derfor IKKE indgå i `.eo` save/load-operationer.
 *
 * Referencer:
 * - `src/config/storageManifest.ts` (kun sessionStorage-keys i manifestet gemmes til `.eo`)
 * - `src/utils/fileSave.ts` / `src/utils/fileLoad.ts` (opererer på manifest-bundne data)
 * - `src/contracts/app-settings.md` (normativ dokumentation for denne adskillelse)
 */

/**
 * Brevhoved-indstillinger for PDF-dokumenter
 *
 * Bestemmer hvilke PDF-typer der skal have brevhoved med skadelidtes navn,
 * skadestype, skadedato og sagsnr.
 */
// Compile-time værn: nøglesættet SKAL matche dokument-lagets kanoniske `DocumentBrevhovedType`
// 1-til-1. `satisfies Record<DocumentBrevhovedType, …>` fejler både ved en ukendt nøgle og ved
// en manglende type, så de to sider ikke kan drifte (afhængigheds-pil: settings → dokument).
const brevhovedIndstillingerShape = {
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
} satisfies Record<DocumentBrevhovedType, z.ZodBoolean>;

export const brevhovedIndstillingerSchema = z.object(brevhovedIndstillingerShape);

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

// Option-listerne udledes fra de kanoniske domæne-enums (enumSchemas.ts), så AppSettings
// og .eo-sektionsfelterne aldrig kan komme ud af sync. Enum-værdierne er den eneste
// sandhed; en ny enum-værdi dukker automatisk op her. Jf. app-settings.md.
export const APP_SETTINGS_AFSLUTTES_MED_OPTIONS = afsluttesMedEnum.options;
export const APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS = loenPaaHelligdageEnum.options;
export const APP_SETTINGS_LOEN_INDTASTES_SOM_OPTIONS = loenperiodeEnum.options;
export const APP_SETTINGS_SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_OPTIONS = svieSmerteDelvisSygemeldingSatsEnum.options;

export type AppSettingsAfsluttesMedOption = (typeof APP_SETTINGS_AFSLUTTES_MED_OPTIONS)[number];
export type AppSettingsLoenPaaHelligdageOption = (typeof APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS)[number];
export type AppSettingsLoenIndtastesSomOption = (typeof APP_SETTINGS_LOEN_INDTASTES_SOM_OPTIONS)[number];
export type AppSettingsSvieSmerteDelvisSygemeldingSatsOption =
  (typeof APP_SETTINGS_SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_OPTIONS)[number];
export type AppSettingsDocumentDownloadFormatOption = DocumentDownloadFormat;

/**
 * Kanonisk kilde for app-temaets tilstandsværdier. Zod-enum'et er sandhedskilden;
 * `AppThemeMode` udledes herfra, så tema-byggeren (`src/config/appTheme.ts`) ikke
 * vedligeholder en parallel `'light' | 'dark'`-union der kan drifte fra schemaet.
 */
export const themeModeEnum = z.enum(['light', 'dark']);
export type AppThemeMode = z.infer<typeof themeModeEnum>;

export const appSettingsSchema = z
  .object({
    themeMode: themeModeEnum,
    defaultStartsideErStamdata: z.boolean(),
    showContentBoxReportButton: z.boolean(),
    showEOInspektionMenu: z.boolean(),
    fontStyleColorDebug: z.boolean(),
    erstatningsopgoerelseAfsluttesMed: z.enum(APP_SETTINGS_AFSLUTTES_MED_OPTIONS),
    // Standardværdier for nye ansættelsesforhold
    defaultLoenIndtastesSom: z.enum(APP_SETTINGS_LOEN_INDTASTES_SOM_OPTIONS),
    defaultFuldLoenUnderFerie: z.boolean(),
    defaultLoenPaaHelligdage: z.enum(APP_SETTINGS_LOEN_PAA_HELLIGDAGE_OPTIONS),
    defaultOverenskomstLoenmodtager: z.string(),
    defaultOverenskomstArbejdsgiver: z.string(),
    defaultSvieSmerteDelvisSygemeldingSats: z.enum(APP_SETTINGS_SVIE_SMERTE_DELVIS_SYGEMELDING_SATS_OPTIONS),
    defaultIndsaetUdkastStempel: z.boolean(),
    defaultVisBilagsnumre: z.boolean(),
    // Beregningstekniske regel-toggles. Bevidst device-lokale (brugergodkendt 2026-06-19):
    // de ændrer IKKE de producerede tal, kun validerings-severity for overenskomst-/regulerings-
    // dækning (warning vs. error). Dokumenteret undtagelse fra app-settings.md §"Beregnings-/regel-
    // toggles"; eneste produktions-callsite er buildEoIndkomstRows. Skal flyttes til .eo-sagsdata
    // hvis to brugere skal se ens validering på samme sag, eller hvis et valg begynder at ændre tal.
    allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: z.boolean(),
    allowReguleringMedUdloebMedMaaneder: z.number().int().min(0).max(12),
    // Fil-placering (IndexedDB handle ID - validering sker runtime, ikke i schema)
    defaultDirectoryHandleId: z.string().optional(),
    documentDownloadFormat: documentDownloadFormatSchema,
    // Brevhoved-indstillinger for PDF-dokumenter
    brevhovedIndstillinger: brevhovedIndstillingerSchema,
  })
  .strict();

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeMode: 'light',
  defaultStartsideErStamdata: false,
  showContentBoxReportButton: false,
  showEOInspektionMenu: false,
  fontStyleColorDebug: false,
  erstatningsopgoerelseAfsluttesMed: 'Bekræftet godkendt',
  // Standardværdier for nye ansættelsesforhold
  defaultLoenIndtastesSom: 'maaned',
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
  documentDownloadFormat: DEFAULT_DOCUMENT_DOWNLOAD_FORMAT,
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
 * - createDefaultLoenindkomstAnsaettelsesforhold() – oprettelse af nyt ansættelsesforhold
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
