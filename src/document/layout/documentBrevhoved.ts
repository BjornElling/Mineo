/**
 * PDF Brevhoved (letterhead) utilities
 *
 * Ansvar:
 * - Kanonisk sæt af dokument-typer der kan have brevhoved (dokument-lagets EGEN sandhedskilde)
 * - Smal DocumentSettings-DTO som dokument-service-laget forbruger i stedet for hele AppSettings
 * - Ren mapper-funktion fra DTO til PDF-generator visBrevhoved-beslutning
 *
 * VIGTIGT:
 * - Dette er rene mapper-funktioner/typer (IKKE et React hook)
 * - PDF-generatorer skal forblive deterministiske og React-uafhængige
 * - Dokument-laget kender IKKE UI-indstillingstypen (AppSettings). Afhængigheds-pilen
 *   peger UI → dokument: `appSettingsSchema` verificerer sit brevhoved-nøglesæt mod
 *   `DocumentBrevhovedType` (jf. `satisfies` dér), ikke omvendt.
 * - Beslutningen om visBrevhoved tages eksplicit på call sites
 */

import type { DocumentDownloadFormat } from '../documentFormat';

/**
 * Kanonisk sæt af dokument-typer der kan have brevhoved.
 *
 * Dette er dokument-lagets EGEN sandhedskilde. `brevhovedIndstillingerSchema` i
 * `appSettingsSchema.ts` verificerer sin nøglemængde mod dette sæt via `satisfies`,
 * så en ny/fjernet type giver compile-fejl ét sted, og UI-laget afhænger af
 * dokument-laget — ikke omvendt.
 */
export const DOCUMENT_BREVHOVED_TYPES = [
  'erstatningsopgoerelse',
  'shDage',
  'renteberegning',
  'regulering',
  'varigeMen',
  'satser',
  'aarsloensberegning',
  'erhvervsevnetab',
  'forsoergertab',
] as const;

/**
 * PDF-type nøgler – dokument-lagets kanoniske sæt.
 *
 * VIGTIGT: Denne type er exhaustive over de mulige brevhoved-dokumenttyper.
 * Hvis en ny PDF-type tilføjes, fejler TypeScript i `appSettingsSchema.ts`.
 */
export type DocumentBrevhovedType = (typeof DOCUMENT_BREVHOVED_TYPES)[number];

/** Brevhoved-flag pr. dokument-type. Struktur-uafhængig af AppSettings. */
export type DocumentBrevhovedFlags = Readonly<Record<DocumentBrevhovedType, boolean>>;

/**
 * Smal options-DTO som dokumentlaget forbruger i stedet for hele AppSettings.
 *
 * Dokument-laget har præcis to behov fra settings: hvilke typer der viser brevhoved,
 * og hvilket output-format der er valgt. Dokument-laget kender kun denne smalle kontrakt.
 *
 * UI-laget leverede tidligere sin `AppSettings` direkte som struktur-supersæt. Det gør det ikke
 * længere: `SourceSettings` er nominel (WI-009), så indsnævringen sker eksplicit gennem
 * `projectSourceSettings`. En struktur-supersæt-levering var netop den tavse vej, ad hvilken en
 * indstilling uden for `SOURCE_SETTINGS_KEYS` kunne nå dokumentcapturen.
 *
 * Ud over brevhoved og format erklærer kontrakten de to beregningstekniske regel-toggles, som
 * EO-dokumenternes download-gate faktisk læser (`buildEoIndkomstRows`,
 * `src/domain/eoRowEvaluation/eoRowIndkomstRows.ts:124-125`). De hører her, fordi de er
 * DOKUMENTGATE-input: de afgør validerings-severity for overenskomst-/reguleringsdækning og kan
 * derfor flytte en EO-download fra tilladt til blokeret. Begge er samtidig med i
 * `evaluationSettingsFingerprint` (`productionInputRuntime.tsx`), så en ændring bumper
 * settingsrevisionen og gør et optaget `EvaluationSourceToken` stale — ellers kunne en gate,
 * godkendt under den gamle regel, overleve et regelskift.
 *
 * Bemærk at det fortsat er VÆRDIERNE og ikke UI-typen, dokument-laget kender: afhængighedspilen
 * peger UI → dokument, og `appSettingsSchema` opfylder denne kontrakt strukturelt.
 */
export type DocumentSettings = Readonly<{
  brevhovedIndstillinger: DocumentBrevhovedFlags;
  documentDownloadFormat: DocumentDownloadFormat;
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: boolean;
  allowReguleringMedUdloebMedMaaneder: number;
}>;

/**
 * Ren mapper-funktion: afgør om en given PDF-type skal vise brevhoved
 *
 * EXHAUSTIVENESS-GARANTI:
 * - DocumentBrevhovedType er dokument-lagets kanoniske sæt
 * - Nye PDF-typer kræver compile-time opdatering af schema + call sites
 * - Ingen silent failures mulige
 *
 * @param settings Smal dokument-settings-DTO (AppSettings opfylder denne strukturelt)
 * @param pdfType Den PDF-type der skal genereres (type-sikret mod det kanoniske sæt)
 * @returns true hvis brevhoved skal vises for denne PDF-type
 *
 * @example
 * ```typescript
 * const settings = getAppSettings();
 * const visBrevhoved = getVisBrevhoved(settings, 'renteberegning');
 * generateRenteDocument(beloeb, actualInterestDate, beregningsdato, {
 *   visBrevhoved,
 *   stamdata: validatedStamdata
 * });
 * ```
 */
export const getVisBrevhoved = <T extends DocumentBrevhovedType>(
  settings: DocumentSettings,
  pdfType: T
): boolean => {
  return settings.brevhovedIndstillinger[pdfType];
};
