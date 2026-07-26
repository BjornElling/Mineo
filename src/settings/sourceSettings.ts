/**
 * Det kanoniske snapshot af indstillinger, der kan ændre en inputevaluering eller et dokumentoutput.
 *
 * Denne grænse ligger i settings-laget, fordi både inputruntime, EO-domænet og dokumentruntime
 * afhænger af den. Ingen af de tre må eje de andres politik eller revisionsfingerprint.
 */
import { DEFAULT_APP_SETTINGS, type AppSettings } from './appSettingsSchema';
import type { DocumentDownloadFormat } from '../document/documentFormat';
import type { DocumentBrevhovedFlags } from '../document/layout/documentBrevhoved';

export type DocumentRenderSettings = Readonly<{
  documentDownloadFormat: DocumentDownloadFormat;
  brevhovedIndstillinger: DocumentBrevhovedFlags;
}>;

/** EO-rækkeevalueringens eneste settingsafhængighed. */
type EoRowPolicyPayload = Readonly<{
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: boolean;
  allowReguleringMedUdloebMedMaaneder: number;
}>;

/**
 * Nominelt mærke på rækkepolitikken. Samme begrundelse som `sourceSettingsBrand` nedenfor, men
 * denne er den GATE-KRITISKE: de to toggles afgør validerings-severity for
 * overenskomst-/reguleringsdækning og kan flytte en EO-download fra tilladt til blokeret. Uden
 * mærket var hele `AppSettings` assignable til `EoRowPolicy`, og row-builderne kunne læse en
 * vilkårlig indstilling, som ikke bumper settingsrevisionen.
 *
 * Runtime-symbol af samme grund som `sourceSettingsBrand` nedenfor.
 */
const eoRowPolicyBrand: unique symbol = Symbol('mineo.eoRowPolicy');

/** Konstrueres KUN af `projectEoRowPolicy`. */
export type EoRowPolicy = EoRowPolicyPayload & {
  readonly [eoRowPolicyBrand]: 'eo-row-policy';
};

/**
 * Nominelt mærke på source-settings-snapshottet.
 *
 * Uden mærket var `SourceSettings` en ren STRUKTUREL type, og fordi `AppSettings` indeholder alle
 * sættets nøgler, var hele `AppSettings` assignable til den overalt. Hver `SourceSettings`-parameter
 * var derfor en dokumentationsgrænse, ikke en håndhævet grænse: evaluering, rækkepolitik og
 * dokumentcapture kunne alle modtage det brede objekt og læse en nøgle UDEN FOR sættet — altså
 * indføre en source-afhængighed, der ikke gør et `EvaluationSourceToken` stale. Fejlklassen var
 * tavs, og et regelskift kunne dermed overleves af en download, der blev godkendt under den gamle
 * regel.
 *
 * Mærket gør `projectSourceSettings` den eneste vej til værdien, så den brede type ikke kan flyde
 * ind. Det er samme lære som Fase 6's skrivegrænse: kan capabilityen fjernes, så fjern den frem for
 * at bevogte den syntaktisk.
 *
 * **Symbolet er et RUNTIME-symbol, ikke `declare const`.** Et `declare const x: unique symbol`
 * emitterer intet, så projektoren ville være nødt til at stemple mærket med et `as` — og et cast
 * omgår netop den completeness-kontrol, mærket skal beskytte: tilføjes en ny payload-nøgle, som
 * projektoren glemmer at kopiere, skjuler castet fejlen, og fingerprintet læser `undefined`. Med et
 * ægte symbol kan projektoren sætte egenskaben, så objektet opfylder typen UDEN cast, og hver nøgle
 * typecheckes. (Samme fejlklasse som WI-008's B6, hvor et `declare const`-brand gav `ReferenceError`
 * i runtime, mens typechecken var grøn.)
 */
const sourceSettingsBrand: unique symbol = Symbol('mineo.sourceSettings');

/**
 * Snapshottets DATAFLADE uden mærker. Completeness-checket nedenfor måler denne type og ikke
 * `SourceSettings`, fordi mærket ellers selv ville tælle som en udækket nøgle — og et check, der
 * skal have en undtagelse for sit eget mærke, kan lige så godt komme til at undtage en rigtig nøgle.
 */
type SourceSettingsPayload = DocumentRenderSettings & EoRowPolicyPayload;

/**
 * Alt, der indgår i `EvaluationSourceToken`'ets settingsrevision. Den samme projektion bruges af
 * inputevaluering, fingerprint og dokumentcapture, så de ikke kan drive fra hinanden.
 *
 * Konstrueres KUN af `projectSourceSettings`.
 */
export type SourceSettings = SourceSettingsPayload & {
  readonly [sourceSettingsBrand]: 'source-settings';
};

export const SOURCE_SETTINGS_KEYS = [
  'documentDownloadFormat',
  'brevhovedIndstillinger',
  'allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden',
  'allowReguleringMedUdloebMedMaaneder',
] as const satisfies readonly (keyof SourceSettingsPayload)[];

type MissingSourceSettingsKeys = Exclude<
  keyof SourceSettingsPayload,
  (typeof SOURCE_SETTINGS_KEYS)[number]
>;
const allSourceSettingsKeysDeclared: MissingSourceSettingsKeys extends never ? true : false = true;
void allSourceSettingsKeysDeclared;

/**
 * Hver source-relevant nøgle skal også findes i `AppSettings` — ellers ville fingerprintet i
 * `productionInputRuntime` slå en nøgle op, der ikke findes, og altid læse `undefined`.
 */
type SourceSettingsKeysNotInAppSettings = Exclude<keyof SourceSettingsPayload, keyof AppSettings>;
const allSourceSettingsKeysExistInAppSettings:
  SourceSettingsKeysNotInAppSettings extends never ? true : false = true;
void allSourceSettingsKeysExistInAppSettings;

/**
 * Den ENESTE konstruktør for `SourceSettings`. Tager den brede `AppSettings` og skærer den ned til
 * netop de nøgler, der indgår i settingsrevisionen.
 *
 * Parameteren er `AppSettings` og ikke `SourceSettings`: tidligere tog projektoren den smalle type,
 * hvilket gjorde den ubrugelig som indsnævringsgrænse — den modtog en værdi, der (strukturelt) lige
 * så godt kunne være hele `AppSettings`, og kunne ikke afvise en bredere værdi. Nu er retningen
 * entydig: bredt ind, smalt ud, og det smalle resultat kan ikke fremstilles ad andre veje.
 *
 * Nøglerne er nævnt eksplicit frem for at blive kopieret fra `SOURCE_SETTINGS_KEYS` i en løkke, så
 * compileren kan tjekke hver enkelt mod typen. Completeness i den anden retning er
 * `MissingSourceSettingsKeys` ovenfor.
 *
 * **Ingen `as`.** Mærket sættes som en ægte egenskab, så returværdien opfylder `SourceSettings`
 * strukturelt og compileren kontrollerer HVER nøgle. Med et cast ville en glemt nøgle i denne
 * funktion være usynlig — listen og `AppSettings`-checket kunne være opdateret, mens projektionen
 * tabte værdien, og fingerprintet ville læse `undefined`.
 */
export const projectSourceSettings = (settings: AppSettings): SourceSettings => Object.freeze({
  [sourceSettingsBrand]: 'source-settings' as const,
  documentDownloadFormat: settings.documentDownloadFormat,
  brevhovedIndstillinger: settings.brevhovedIndstillinger,
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden:
    settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden,
  allowReguleringMedUdloebMedMaaneder: settings.allowReguleringMedUdloebMedMaaneder,
});

/**
 * Den ENESTE konstruktør for `EoRowPolicy`. Rækkeevalueringen er beregningslogik og må hverken kende
 * UI-indstillinger eller dokument-layoutlaget; mærket gør nu den afgrænsning håndhævet frem for
 * blot dokumenteret.
 *
 * Tager `SourceSettings` og ikke `AppSettings`: rækkepolitikken er en DELMÆNGDE af det snapshot, der
 * driver settingsrevisionen. Ved at udlede den herfra kan der ikke opstå en rækkepolitik, hvis
 * nøgler ikke også er med i fingerprintet — netop den divergens, WI-009 blev skrevet for at lukke.
 */
export const projectEoRowPolicy = (settings: SourceSettings): EoRowPolicy => Object.freeze({
  [eoRowPolicyBrand]: 'eo-row-policy' as const,
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden:
    settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden,
  allowReguleringMedUdloebMedMaaneder: settings.allowReguleringMedUdloebMedMaaneder,
});

/**
 * Rækkepolitikkens defaults, udledt af app-defaultene gennem de samme to projektorer. Erstatter
 * row-evalueringens tidligere `DEFAULT_APP_SETTINGS`-defaultparametre, som trak hele den brede type
 * ind i beregningslaget alene for at have en fallback.
 */
export const DEFAULT_EO_ROW_POLICY: EoRowPolicy =
  projectEoRowPolicy(projectSourceSettings(DEFAULT_APP_SETTINGS));

/**
 * Test-support: bygger et source-settings-snapshot fra en DELVIS override af de source-relevante
 * nøgler. Navnet bærer `__test`, så en søgning viser præcis hvilke steder der fremstiller et
 * snapshot uden om produktionsbroen — samme konvention som Fase 6's `__createSlimInputTestStore`.
 *
 * Overriden er typet `Partial<SourceSettingsPayload>` og ikke `Partial<AppSettings>`: en test må
 * gerne vælge en anden dokumentformat- eller reguleringspolitik, men ikke ad den vej indføre en
 * nøgle uden for sættet. Bygningen går gennem `projectSourceSettings`, så mærket ikke kan
 * fremstilles ved en objektliteral, og et nyt felt i typen fejler stadig ved compile-tid frem for at
 * blive skjult bag et `as`.
 */
export const __createTestSourceSettings = (
  override: Partial<SourceSettingsPayload> = {}
): SourceSettings => projectSourceSettings({ ...DEFAULT_APP_SETTINGS, ...override });

/** Test-support: rækkepolitik fra en delvis override. Samme begrundelse som ovenfor. */
export const __createTestEoRowPolicy = (
  override: Partial<EoRowPolicyPayload> = {}
): EoRowPolicy => projectEoRowPolicy(__createTestSourceSettings(override));
