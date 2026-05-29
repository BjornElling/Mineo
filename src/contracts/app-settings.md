# Programindstillinger (App Settings) — Mineo

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt

## Formål
Mineo har enkelte **programindstillinger**, som er **device-lokale** (bundet til brugerens computer/browser), og som **ikke** er en del af sagen.

AppSettings består af fire kategorier med forskellig semantik:

1. rene UI-præferencer,
2. defaults til ny sagsdata,
3. PDF-output-præferencer,
4. beregnings-/regel-toggles.

## Normativ regel: må aldrig gemmes i `.eo`
`.eo`-filer er **trust-critical** og må kun indeholde **schema-valideret brugerinput** (sagsdata).

Programindstillinger er **ikke** sagsdata og **må derfor aldrig**:
- ligge i `FormPersistenceContext` / sessionStorage `STORAGE_KEYS`
- indgå i `.eo` save/load
- være en del af nogen Zod-skemaer som repræsenterer persisted user input

Konsekvens:
- Hvis en `.eo`-fil deles med en kollega eller flyttes til en anden maskine, må programindstillinger ikke “smugles med”.

## Kontrakter (normative, ikke-forklarende)
- **AppSettings må aldrig være skjult sagsdata.** Defaults til ny sagsdata må kun materialiseres ved oprettelse af ny sag eller ny brugerhandling, ikke under load for at gøre en gammel sag komplet.
- **EO-data er altid fuldt udfyldt** (ingen implicitte defaults ved load/merge).
- **PDF-laget læser aldrig AppSettingsContext/localStorage direkte**. `brevhovedIndstillinger` og andre PDF-præferencer skal mappes til små validerede PDF-options DTO'er eller eksplicitte options ved kaldet. Nuværende direkte AppSettings-parameterisering i service/callsite er midlertidig teknisk gæld, ikke en renderer-afhængighed.
- **Beregnings-/regel-toggles** må som hovedregel ikke ændre beregning, validering, gating eller audit for en eksisterende sag som skjult device-lokal tilstand. Slutretningen er schema-valideret sagsdata eller eksplicit brugerobserverbar runtime-beslutning.
  - **Bevidst undtagelse — `endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft`:** Denne ene toggle er et bevidst designvalg: den er device-lokal og styrer en beregningsregel i differencekravet (fane 5). Når den er `true`, gør en endelig afgørelse med tilbagevirkende kraft en tidligere udbetalt midlertidig EET-ydelse fradragsberettiget i differencekravet fra den endelige afgørelses virkningsdato og frem. Konsekvens, som er accepteret: **samme `.eo`-sag kan give forskelligt differencekrav på maskiner med forskellig toggle-værdi**, og en tidligere opgørelse kan ændre beregningsteknisk resultat, hvis brugeren åbner `.eo`-filen efter at have ændret indstillingen. Toggle-værdien er ikke en del af sagen og følger aldrig med `.eo`. Reglen er beskrevet normativt i `docs/domain/eet/differencekrav.md`. Injektionen sker som eksplicit parameter til beregningslaget (`computeEetSnapshot` → `computeEetDifferencekravCalculation`); domænelaget læser aldrig settings-context direkte.
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
- Programindstillinger persisteres i **`localStorage`** under en dedikeret nøgle: `mineo_app_settings_v1`
- Skema og defaults: `src/settings/appSettingsSchema.ts`
- Læs/skriv + sideeffekter (fx CSS toggles): `src/contexts/AppSettingsContext.tsx`

`.eo` persistence opererer på sessionStorage keys fra manifestet:
- Manifest: `src/config/storageManifest.ts`
- Save/Load: `src/utils/fileSave.ts` og `src/utils/fileLoad.ts`

## Designkrav (sikkerhed og forudsigelighed)
- **Fail-safe**: hvis `localStorage` er blokeret/fejler, må app’en stadig fungere (fallback til in-memory state).
- **Schema-alignment**: settings skal valideres via Zod; invalid/ukendt data skal falde tilbage til defaults.
- **Ingen netværk/telemetri**: settings må ikke forårsage data-overførsel ud af browseren.
- **Versionering af localStorage-nøgle**: breaking settings-schema kræver ny nøgle (`_v2` osv.) eller eksplicit one-way migration. Non-breaking tilføjelser håndteres via merge-logikken uden nøgleskift.
- `defaultDirectoryHandleId` er device-lokal og ikke portabel; den må aldrig betragtes som sagsdata eller sendes med `.eo`.
