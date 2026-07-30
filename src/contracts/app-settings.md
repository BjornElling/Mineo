# Programindstillinger (App Settings) — Mineo

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Senest verificeret mod kode:** 2026-07-26

## Formål
Mineo har enkelte **programindstillinger**, som er **device-lokale** (bundet til brugerens computer/browser), og som **ikke** er en del af sagen.

AppSettings består af fire kategorier med forskellig semantik:

1. rene UI-præferencer,
2. defaults til ny sagsdata,
3. dokument-output-præferencer,
4. beregnings-/regel-toggles.

## Normativ regel: må aldrig gemmes i `.eo`
`.eo`-filer er **trust-critical** og må kun indeholde **schema-valideret brugerinput** (sagsdata).

Programindstillinger er **ikke** sagsdata og **må derfor aldrig**:
- ligge i sagens inputaggregate eller `sessionStorage`-inputenvelope
- indgå i `.eo` save/load
- være en del af nogen Zod-skemaer som repræsenterer persisted user input

Konsekvens:
- Hvis en `.eo`-fil deles med en kollega eller flyttes til en anden maskine, må programindstillinger ikke “smugles med”.

## Kontrakter (normative, ikke-forklarende)
- **AppSettings må aldrig være skjult sagsdata.** Defaults til ny sagsdata må kun materialiseres ved oprettelse af ny sag eller ny brugerhandling, ikke under load for at gøre en gammel sag komplet.
- **EO-data er altid fuldt udfyldt** (ingen implicitte defaults ved load/merge).
- **Dokumentlaget læser aldrig AppSettingsContext/localStorage direkte**, og det kender ikke `AppSettings`-typen. Afhængighedspilen peger UI → dokument: `src/document/layout/documentBrevhoved.ts` erklærer brevhoved-typernes udtømmende sæt (`DocumentBrevhovedType`) og deres flagstruktur, og `appSettingsSchema.ts` typecheckes imod DET — ikke omvendt. Hovedappens binding sker i `src/document/runtime/mineoDocumentEnvironment.ts` gennem `projectSourceSettings`, som skærer `AppSettings` ned til `SourceSettings`, og derefter gennem `projectEoRowPolicy`/`projectDocumentRenderSettings`, som deler snapshottet i gate- og render-halvdelen.
- **Gate- og render-settings er DISJUNKTE, og adskillelsen er en typegrænse**. Et dokumentoutputs `project` ser KUN `gateSettings` (i hovedappen EO-rækkepolitikken); det valgte format og brevhoved-flagene ligger i `renderSettings` og anvendes først efter gaten. Reglen er, at **formatet vælger writer, ikke dækning**: samme sag skal have samme `ready`/`blocked` for PDF og Word. Kravet kan ikke bæres af et værn, fordi §A2a's paritet mellem reaktiv gate og click-preflight ville se den samme skæve gate i begge kanaler — derfor er en formatlæsning i en gate en compilerfejl. Begge halvdele projiceres fra ét `captureSource`-læs, så de ikke kan stamme fra to revisioner.
- **`SourceSettings`, `EoRowPolicy` og `DocumentRenderSettings` er NOMINELLE, og deres projektorer er de eneste konstruktører**. Alt, der kan ændre en inputevaluering, en rækkegate eller et dokumentoutput, skal komme fra `projectSourceSettings(appSettings)` — rækkepolitikken fra `projectEoRowPolicy(sourceSettings)` og render-settings fra `projectDocumentRenderSettings(sourceSettings)`, så begge er dokumenterede DELMÆNGDER af det, der driver settingsrevisionen. Konsekvenser:
  - Evaluering, revisions-fingerprint og dokumentcapture læser garanteret samme værdi og kan ikke drive fra hinanden.
  - En indstilling uden for `SOURCE_SETTINGS_KEYS` kan ikke længere nå evalueringen. Det er ikke kosmetik: en sådan læsning ville indføre en source-afhængighed, der IKKE gør et optaget `EvaluationSourceToken` stale, så en download godkendt under den gamle regel kunne overleve et regelskift — tavst.
  - `createInputEvaluation` tager derfor **ingen** `settings`-parameter. En settingsafhængig feltissue hører i en descriptor-/consumer-validator, hvis kilde er det projekterede snapshot, ikke i en fri typeparameter på inputkernen.
  - Kode, der legitimt har brug for hele `AppSettings` (ny-sags-seeds som `createDefaultLoenindkomstAnsaettelsesforhold`, DEV-inspektionens tomheds-prædikat), ligger uden for evalueringens sti og beholder den brede type.
  - Kode, der legitimt har brug for hele `AppSettings`, må aldrig aflevere den til et af de tre snapshots som struktur-supersæt. Mærkerne udelukker det; den smalle dokument-DTO, der tidligere bar samme ansvar strukturelt, er slettet, fordi en strukturel indsnævring er en aftale og ikke en grænse.
- **Beregnings-/regel-toggles** må som hovedregel ikke ændre beregning, validering, gating eller audit for en eksisterende sag som skjult device-lokal tilstand. Slutretningen er schema-valideret sagsdata eller eksplicit brugerobserverbar runtime-beslutning.
  - **Dokumenteret undtagelse (brugergodkendt 2026-06-19):** De to "Beregningsteknisk"-valg på Indstillinger-siden — `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` og `allowReguleringMedUdloebMedMaaneder` — er bevidst device-lokale. De ændrer ikke de producerede tal, men kun validerings-*severity* for overenskomst-/reguleringsdækning (en manglende/udløbet dækning vises som `warning` i stedet for `error`, og en udløbsperiode under grænsen accepteres). Konsekvens: samme `.eo`-sag kan validere forskelligt på to maskiner. Dette er accepteret, fordi valgene udtrykker den enkelte sagsbehandlers faste arbejdsmetode (ikke et sags-faktum), og fordi de ikke ændrer beregningsresultatet. **Re-evaluering:** flyt til schema-valideret sagsdata (`.eo`) hvis (a) der opstår behov for at to brugere skal se ens validering på samme sag, eller (b) et af valgene nogensinde kommer til at ændre de producerede tal frem for kun severity. Eneste produktions-callsite: `buildEoIndkomstRows` i `src/domain/eoRowEvaluation/eoRowIndkomstRows.ts`.
- **KRL satstabeller har ingen separat brevhoved-toggle**:
  KRL skal altid arve `regulering`-indstillingen 1-til-1 for visning af brevhoved.
- **Normal åbning af app/PWA**: startsiden bestemmes af den device-lokale toggle på Mineo-siden.
- **Alle hent-forløb**: "hent-forløb" betyder indlæsning af en eksisterende `.eo`-fil. Når filen er indlæst og anvendt, skal brugerens visning gå til `Stamdata`,
  uanset hvilken startside-toggle der ellers er valgt.
- **Schema-evolution i nested settings**:
  Nye top-level settings håndteres af den eksisterende merge-logik i `parseStoredSettings()`.
  Nye felter i nested objekter kræver eksplicit merge-logik i `src/settings/appSettingsParse.ts`.
  Nye nested objekter kræver også eksplicit merge-logik parallelt med `brevhovedIndstillinger`-mønsteret.
- **Miljøafhængige defaults** er kun tilladt for rene visuelle UI-præferencer. De må ikke bruges til sags-, PDF- eller beregningsrelevante settings.

## Teknisk implementering
- Programindstillinger persisteres i **`localStorage`** under en dedikeret nøgle: `mineo_app_settings_v1` (`LOCAL_STORAGE_KEY` i `src/settings/appSettingsStorage.ts`)
- Skema og defaults: `src/settings/appSettingsSchema.ts`
- Tolerant parsing/merge mod defaults: `src/settings/appSettingsParse.ts` (`parseStoredSettings`, `mergeAppSettings`, `loadInitialSettings`)
- localStorage-I/O (fail-safe): `src/settings/appSettingsStorage.ts` (`readLocalStorage`/`writeLocalStorage`)
- Context, runtime-state og sideeffekter (fx CSS toggles): `src/contexts/AppSettingsContext.tsx`

`.eo` persistence opererer på sessionStorage keys fra manifestet:
- Manifest: `src/config/storageManifest.ts`
- Save/Load: `src/utils/fileSave.ts` og `src/utils/fileLoad.ts`

## Designkrav (sikkerhed og forudsigelighed)
- **Monoton settingsrevision**: runtime ejer én ikke-persisteret settingsrevision. Den stiger præcis én gang ved en reel
  ændring af de settings, som kan påvirke validering, beregning eller dokumentoutput, og ikke ved no-op. Snapshot og
  revision læses atomisk og indgår sammen med inputrevisionen i `EvaluationSourceToken`; async-gates sammenligner altid
  hele tokenet.
- **Fail-safe**: hvis `localStorage` er blokeret/fejler, må app’en stadig fungere (fallback til in-memory state).
- **Schema-alignment**: settings skal valideres via Zod; invalid/ukendt data skal falde tilbage til defaults.
- **Ingen netværk/telemetri**: settings må ikke forårsage data-overførsel ud af browseren.
- **Versionering af localStorage-nøgle**: breaking settings-schema kræver ny nøgle (`_v2` osv.) eller eksplicit one-way migration. Non-breaking tilføjelser håndteres via merge-logikken uden nøgleskift.
- `defaultDirectoryHandleId` er device-lokal og ikke portabel; den må aldrig betragtes som sagsdata eller sendes med `.eo`.
- `documentDownloadFormat` er device-lokal og ikke portabel; den må aldrig betragtes som sagsdata eller sendes med `.eo`.
