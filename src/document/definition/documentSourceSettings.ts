/**
 * Det neutrale source-settings-snapshot (Fase 5, pass 0 — lukker C4).
 *
 * **Problemet, dette løser.** `DocumentSettings` er dokumenteret som en smal brevhoved-/format-DTO,
 * men den fik i pass 3 tilføjet to EO-regel-toggles, fordi EO's download-gate havde brug for dem.
 * Det gav tre uheldige følger:
 *
 *   1. EO's row-evaluering — ren beregningslogik — kom til at afhænge af dokument-LAYOUT-laget.
 *   2. Row-evalueringen modtog samtidig `documentDownloadFormat` og `brevhovedIndstillinger`, som er
 *      fuldstændig irrelevante for, om en række er gyldig.
 *   3. Begrundelsen for at samle dem var, at de to toggles "er med i `evaluationSettingsFingerprint`,
 *      så et regelskift gør et optaget token stale". Det er sandt i dag, men intet HÅNDHÆVER det:
 *      fingerprintet er en håndskrevet liste et helt andet sted. Den smalle type gjorde altså kun
 *      dagens to læsninger smallere — den gjorde ikke fejlklassen urepræsenterbar, som jeg hævdede.
 *
 * **Løsningen.** Tre adskilte begreber frem for én sammenblandet DTO:
 *
 *   - `DocumentRenderSettings` — format + brevhoved. Det afvikleren og brevhoved-policyen bruger.
 *   - `EoRowPolicy` — de to regel-toggles. Det EO's beregning bruger. Kender intet om dokumenter.
 *   - `DocumentSourceSettings` — foreningen, og den ENE værdi hele friskheds-kæden hviler på.
 *
 * `SOURCE_RELEVANT_SETTINGS_KEYS` er den eksplicitte erklæring af, hvad der gør et token stale, og
 * `evaluationSettingsFingerprint` udleder sig nu af DEN liste frem for at gentage nøglerne. En ny
 * source-relevant indstilling tilføjes derfor ét sted, og `satisfies`-checket nedenfor fejler ved
 * compile-tid, hvis listen og typen kommer fra hinanden.
 *
 * Den fulde håndhævelse — at INGEN evalueringsafhængig kodesti kan læse en settings-nøgle uden for
 * sættet — kræver et AST-/type-værn i input-runtime og ligger uden for Fase 5 (egen WI).
 */
import type { DocumentDownloadFormat } from '../documentFormat';
import type { DocumentBrevhovedFlags } from '../layout/documentBrevhoved';

/** Hvad afviklingen og brevhoved-opslaget bruger. Ingen beregningsregler her. */
export type DocumentRenderSettings = Readonly<{
  documentDownloadFormat: DocumentDownloadFormat;
  brevhovedIndstillinger: DocumentBrevhovedFlags;
}>;

/**
 * De to beregningsregler, EO's rækkeevaluering faktisk læser
 * (`eoRowIndkomstRows.ts`: overenskomst-/reguleringsdækning). De afgør validerings-severity og kan
 * flytte en EO-download fra tilladt til blokeret, og de er derfor source-relevante — men de er
 * BEREGNINGSPOLITIK, ikke dokumentindstillinger.
 */
export type EoRowPolicy = Readonly<{
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: boolean;
  allowReguleringMedUdloebMedMaaneder: number;
}>;

/**
 * Ét snapshot af alt, der gør et `EvaluationSourceToken` stale. Præcis denne værdi skal drive
 * evaluering, settingsrevision/fingerprint OG dokumentcapture — ellers kan de tre komme fra hinanden.
 */
export type DocumentSourceSettings = DocumentRenderSettings & EoRowPolicy;

/**
 * De source-relevante nøgler, eksplicit erklæret. `evaluationSettingsFingerprint` udleder sig af
 * denne liste; `satisfies` sikrer, at listen præcis dækker `DocumentSourceSettings` — hverken mere
 * eller mindre.
 */
export const SOURCE_RELEVANT_SETTINGS_KEYS = [
  'documentDownloadFormat',
  'brevhovedIndstillinger',
  'allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden',
  'allowReguleringMedUdloebMedMaaneder',
] as const satisfies readonly (keyof DocumentSourceSettings)[];

/**
 * Completeness-check ved compile-tid: hvis en nøgle tilføjes til `DocumentSourceSettings` uden at
 * komme med i listen ovenfor, er `MissingKeys` ikke længere `never`, og denne erklæring fejler.
 */
type MissingKeys = Exclude<keyof DocumentSourceSettings, (typeof SOURCE_RELEVANT_SETTINGS_KEYS)[number]>;
const _allSourceKeysDeclared: MissingKeys extends never ? true : false = true;
void _allSourceKeysDeclared;

/** Projicerer et source-settings-snapshot ud af en bredere settings-værdi (fx `AppSettings`). */
export const projectDocumentSourceSettings = (settings: DocumentSourceSettings): DocumentSourceSettings => ({
  documentDownloadFormat: settings.documentDownloadFormat,
  brevhovedIndstillinger: settings.brevhovedIndstillinger,
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden:
    settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden,
  allowReguleringMedUdloebMedMaaneder: settings.allowReguleringMedUdloebMedMaaneder,
});
