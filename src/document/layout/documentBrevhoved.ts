/**
 * PDF Brevhoved (letterhead) utilities
 *
 * Ansvar:
 * - Kanonisk sæt af dokument-typer der kan have brevhoved (dokument-lagets EGEN sandhedskilde)
 * - Brevhoved-flagenes struktur, uafhængigt af UI-indstillingstypen
 *
 * VIGTIGT:
 * - Dette er rene typer (IKKE et React hook)
 * - PDF-generatorer skal forblive deterministiske og React-uafhængige
 * - Dokument-laget kender IKKE UI-indstillingstypen (AppSettings). Afhængigheds-pilen
 *   peger UI → dokument: `appSettingsSchema` verificerer sit brevhoved-nøglesæt mod
 *   `DocumentBrevhovedType` (jf. `satisfies` dér), ikke omvendt.
 * - Beslutningen om visBrevhoved tages af dokumentmiljøets `resolveVisBrevhoved`, som slår
 *   `DocumentBrevhovedPolicy` op i det tokenbundne `renderSettings` — altså EFTER gaten.
 *
 * Brevhovedopslaget bor i `mineoDocumentEnvironment`. Det tager mærkede render-settings, så hele
 * `AppSettings` ikke strukturelt kan passere som en smallere dokumentindstilling.
 */
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
