/**
 * Det kanoniske snapshot af indstillinger, der kan ændre en inputevaluering eller et dokumentoutput.
 *
 * Denne grænse ligger i settings-laget, fordi både inputruntime, EO-domænet og dokumentruntime
 * afhænger af den. Ingen af de tre må eje de andres politik eller revisionsfingerprint.
 */
import type { DocumentDownloadFormat } from '../document/documentFormat';
import type { DocumentBrevhovedFlags } from '../document/layout/documentBrevhoved';

export type DocumentRenderSettings = Readonly<{
  documentDownloadFormat: DocumentDownloadFormat;
  brevhovedIndstillinger: DocumentBrevhovedFlags;
}>;

/** EO-rækkeevalueringens eneste settingsafhængighed. */
export type EoRowPolicy = Readonly<{
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: boolean;
  allowReguleringMedUdloebMedMaaneder: number;
}>;

/**
 * Alt, der indgår i `EvaluationSourceToken`'ets settingsrevision. Den samme projektion bruges af
 * inputevaluering, fingerprint og dokumentcapture, så de ikke kan drive fra hinanden.
 */
export type SourceSettings = DocumentRenderSettings & EoRowPolicy;

export const SOURCE_SETTINGS_KEYS = [
  'documentDownloadFormat',
  'brevhovedIndstillinger',
  'allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden',
  'allowReguleringMedUdloebMedMaaneder',
] as const satisfies readonly (keyof SourceSettings)[];

type MissingSourceSettingsKeys = Exclude<keyof SourceSettings, (typeof SOURCE_SETTINGS_KEYS)[number]>;
const allSourceSettingsKeysDeclared: MissingSourceSettingsKeys extends never ? true : false = true;
void allSourceSettingsKeysDeclared;

/** Indsnævrer en bred app-settings-værdi til den autoritative source-settings-form. */
export const projectSourceSettings = (settings: SourceSettings): SourceSettings => Object.freeze({
  documentDownloadFormat: settings.documentDownloadFormat,
  brevhovedIndstillinger: settings.brevhovedIndstillinger,
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden:
    settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden,
  allowReguleringMedUdloebMedMaaneder: settings.allowReguleringMedUdloebMedMaaneder,
});
