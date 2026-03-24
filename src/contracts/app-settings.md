# Programindstillinger (App Settings) — Mineo

## Formål
Mineo har enkelte **programindstillinger**, som er **device-lokale** (bundet til brugerens computer/browser), og som **ikke** er en del af sagen.

Disse indstillinger er typisk:
- UI/debug-visning
- udvikler-/diagnostik-flags

## Normativ regel: må aldrig gemmes i `.eo`
`.eo`-filer er **trust-critical** og må kun indeholde **schema-valideret brugerinput** (sagsdata).

Programindstillinger er **ikke** sagsdata og **må derfor aldrig**:
- ligge i `FormPersistenceContext` / sessionStorage `STORAGE_KEYS`
- indgå i `.eo` save/load
- være en del af nogen Zod-skemaer som repræsenterer persisted user input

Konsekvens:
- Hvis en `.eo`-fil deles med en kollega eller flyttes til en anden maskine, må programindstillinger ikke “smugles med”.

## Kontrakter (normative, ikke-forklarende)
- **AppSettings er kun defaults** og må kun bruges ved oprettelse af NY sagsdata.
- **EO-data er altid fuldt udfyldt** (ingen implicitte defaults ved load/merge).
- **PDF-laget læser aldrig fra AppSettings**; PDF bygger udelukkende på EO-data (og eksplicitte options).
- **KRL satstabeller har ingen separat brevhoved-toggle**:
  KRL skal altid arve `regulering`-indstillingen 1-til-1 for visning af brevhoved.
- **Normal åbning af app/PWA**: startsiden bestemmes af den device-lokale toggle på Mineo-siden.
- **Alle hent-forløb**: når en `.eo`-fil er indlæst og anvendt, skal brugerens visning gå til `Stamdata`,
  uanset hvilken startside-toggle der ellers er valgt.

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
