# Programindstillinger (App Settings) — Mineo

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Senest verificeret mod kode:** 2026-07-16

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
- **Dokumentlaget læser aldrig AppSettingsContext/localStorage direkte**. `documentDownloadFormat`, `brevhovedIndstillinger` og andre dokumentpræferencer skal mappes ved service-/callsite-grænsen. Den nuværende kobling er dog dybere end ren callsite-parameterisering: `src/document/layout/documentBrevhoved.ts` type-binder direkte til `AppSettings` (`DocumentBrevhovedType = keyof AppSettings['brevhovedIndstillinger']`, `getVisBrevhoved(settings: AppSettings)`), og `documentService.ts` (`src/document/service/documentService.ts`) tager hele `AppSettings`-typen som parameter i en række download-wrappers. Dette er erkendt teknisk gæld. Slutretning (re-evaluering ved næste dokument-audit): map dokumentindstillinger til selvstændige options-DTO'er, så hverken `src/document/layout/`- eller service-laget importerer `AppSettings`-typen.
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
