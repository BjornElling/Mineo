# Programindstillinger (App Settings) – Mineo

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Senest verificeret mod kode:** 2026-08-27

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
- være en del af nogen Zod-skemaer som repræsenterer persisteret brugerinput

Konsekvens:
- Hvis en `.eo`-fil deles med en kollega eller flyttes til en anden maskine, må programindstillinger ikke “smugles med”.

**Udviklerens afgørelse 2026-08-18 (bindende, genåbnes ikke).** Forbuddet gælder også som svar på det
modsatrettede hensyn: indstillinger kan gå tabt, hvis browserens lagring ryddes, og de kan hverken
gemmes eller hentes. Det er efterprøvet og accepteret. Forslaget om at lade dem følge `.eo`-filen –
også som et separat, valgfrit afsnit – er **afvist**. Tabet er sjældent nok til at bæres, og
brugeren opdager det selv; det vejer ikke op mod at gøre `.eo` til andet end sagsdata.
Der skal heller ikke vises nogen besked, når indstillinger er faldet tilbage til deres standarder:
tilstanden er så sjælden, at meddelelsen i praksis aldrig ville blive vist.
Baggrund: `docs/testing/brugerblik/indstillinger.md` BB-025.

**Historisk load-undtagelse, godkendt 2026-08-26.** Filer fra den interne udviklingsfase kan indeholde de tidligere
felter `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` og `allowReguleringMedUdloebMedMaaneder` i
sagsdata-sektionen. De to felter skal ikke bevares eller påvirke den aktuelle computers indstillinger. Load-migratoren
fjerner dem eksplicit uden preflight, før schema-sanitization. Det er en afgrænset behandling af kendte historiske
udviklingsrester og ændrer ikke reglen om, at nye eller ukendte device-lokale settings aldrig må lægges i `.eo`.

## Normativ regel: indstillinger er uden for undo/redo
Ændringer på Indstillinger-siden må **aldrig** indgå i sagens fortrydelseshistorik.

**Udviklerens afgørelse 2026-08-18 (bindende):** valgene må kun kunne ændres ved brugerens aktive
handling. Var de en del af undo/redo, kunne ét tryk for meget på Fortryd ændre en indstilling, som
brugeren ikke havde rørt – og virkningen ville ramme et helt andet sted end dér, fortrydelsen skete.
Fraværet af fortrydelse er altså et værn, ikke en mangel; det skal ikke «rettes», og der skal ikke
vises nogen oplysning om det. Baggrund: `docs/testing/brugerblik/indstillinger.md` BB-027.

## Kontrakter (normative, ikke-forklarende)
- **AppSettings må aldrig være skjult sagsdata.** Defaults til ny sagsdata må kun materialiseres ved oprettelse af ny sag eller ny brugerhandling, ikke under load for at gøre en gammel sag komplet.
- **Defaults til ny sagsdata SKAL materialiseres ved oprettelsen – ikke først når brugeren rører feltet.** Kategori 2 har præcis to veje ind i en sag, og begge er eksplicitte:
  - **Ny sag:** ny-sags-seeden (`src/domain/newCaseSeed.ts` → `src/inputCore/newCaseSections.ts`), som anvendes ved bootstrap af en frisk session OG ved `Slet alt`. Se `docs/architecture/input-architecture.md` §2.11.
  - **Ny række:** rækkefabrikkerne, fx `createDefaultLoenindkomstAnsaettelsesforhold`.

  En indstilling i kategori 2 skal stå i `NEW_CASE_DEFAULT_SETTINGS_KEYS` (`appSettingsSchema.ts`) og skal beviseligt ændre den ene eller den anden. `newCaseSettingsDefaults.test.ts` håndhæver både beviset og listens fuldstændighed. Baggrunden er en tavs fejlklasse: koblingen fandtes kun i `create<Sektion>InitialValues`-fabrikkerne, som ingen produktionssti kalder, så indstillingssiden lovede en standardværdi, sagen aldrig fik. En indstilling uden virkning er værre end ingen indstilling.
- **En ny sag er ikke en tom sag.** Dermed må "har sagen brugerdata?" (overwrite-gaten ved `Hent`) ikke måles som "findes der en udfyldt værdi?", men som "afviger sagen fra en ny sag?". Ellers ville programmets egne standardværdier optræde som brugerens data.
- **EO-data er altid fuldt udfyldt** (ingen implicitte defaults ved load/merge).
- **Dokumentlaget læser aldrig AppSettingsContext/localStorage direkte**, og det kender ikke `AppSettings`-typen. Afhængighedspilen peger UI → dokument: `src/document/layout/documentBrevhoved.ts` erklærer brevhoved-typernes udtømmende sæt (`DocumentBrevhovedType`) og deres flagstruktur, og `appSettingsSchema.ts` typecheckes imod DET – ikke omvendt. Projektorerne `projectSourceSettings`, `projectEoRowPolicy` og `projectDocumentRenderSettings` bor samlet i `src/settings/sourceSettings.ts`, mens `projectMineoDocumentGateSettings` samler hovedappens gate-flade i dokumentdefinitionens lag. Hovedappens binding anvender dem i `src/document/runtime/mineoDocumentEnvironment.ts`: `projectSourceSettings` skærer `AppSettings` ned til `SourceSettings`, hvorefter gate- og render-projektorerne deler snapshottet i de to roller.
- **Gate- og render-settings er adskilte med en bevidst brevhoved-overlapning**. Et dokumentoutputs `project` ser i hovedappen EO-rækkepolitikken og brevhoved-flagene; flaget afgør, om stamdata overhovedet er en gate-relevant dokumentafhængighed. Miljøet bruger samme flag fra `renderSettings`, når brevhovedet tegnes efter gaten. Det valgte format ligger kun i `renderSettings` og anvendes først efter gaten. Reglen er, at **formatet vælger writer, ikke dækning**: samme sag skal have samme `ready`/`blocked` for PDF og Word. Kravet kan ikke bæres af et værn, fordi §A2a's paritet mellem reaktiv gate og click-preflight ville se den samme skæve gate i begge kanaler – derfor er en formatlæsning i en gate en compilerfejl. Begge halvdele projiceres fra ét `captureSource`-læs, så de ikke kan stamme fra to revisioner.
- **`SourceSettings`, `EoRowPolicy`, `DocumentRenderSettings` og `MineoDocumentGateSettings` er NOMINELLE, og deres projektorer er de eneste konstruktører**. Alt, der kan ændre en inputevaluering, en rækkegate eller et dokumentoutput, skal komme fra `projectSourceSettings(appSettings)` – rækkepolitikken fra `projectEoRowPolicy(sourceSettings)`, hovedappens gate-settings fra `projectMineoDocumentGateSettings(sourceSettings)` og render-settings fra `projectDocumentRenderSettings(sourceSettings)`, så alle er dokumenterede DELMÆNGDER af det, der driver settingsrevisionen. Konsekvenser:
  - Evaluering, revisions-fingerprint og dokumentcapture læser garanteret samme værdi og kan ikke drive fra hinanden.
  - En indstilling uden for `SOURCE_SETTINGS_KEYS` kan ikke længere nå evalueringen. Det er ikke kosmetik: en sådan læsning ville indføre en source-afhængighed, der IKKE gør et optaget `EvaluationSourceToken` stale, så en download godkendt under den gamle regel kunne overleve et regelskift – tavst.
  - `createInputEvaluation` tager derfor **ingen** `settings`-parameter. En settingsafhængig feltissue hører i en descriptor-/consumer-validator, hvis kilde er det projekterede snapshot, ikke i en fri typeparameter på inputkernen.
  - Kode, der legitimt har brug for hele `AppSettings` (ny-sags-seeds som `createDefaultLoenindkomstAnsaettelsesforhold`, DEV-inspektionens tomheds-prædikat), ligger uden for evalueringens sti og beholder den brede type.
  - Kode, der legitimt har brug for hele `AppSettings`, må aldrig aflevere den til et af de fire snapshots som struktur-supersæt. Mærkerne udelukker det; den smalle dokument-DTO, der tidligere bar samme ansvar strukturelt, er slettet, fordi en strukturel indsnævring er en aftale og ikke en grænse.
- **Beregnings-/regel-toggles** må som hovedregel ikke ændre beregning, validering, gating eller audit for en eksisterende sag som skjult device-lokal tilstand. Slutretningen er schema-valideret sagsdata eller eksplicit brugerobserverbar runtime-beslutning.
  - **Dokumenteret undtagelse (udviklergodkendt 2026-06-19):** De to "Beregningsteknisk"-valg på Indstillinger-siden – `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` og `allowReguleringMedUdloebMedMaaneder` – er bevidst device-lokale. De ændrer ikke de producerede tal, men kun validerings-*severity* for overenskomst-/reguleringsdækning (en manglende/udløbet dækning vises som `warning` i stedet for `error`, og en udløbsperiode under grænsen accepteres). Konsekvens: samme `.eo`-sag kan validere forskelligt på to maskiner. Dette er accepteret, fordi valgene udtrykker den enkelte sagsbehandlers faste arbejdsmetode (ikke et sags-faktum), og fordi de ikke ændrer beregningsresultatet. **Re-evaluering:** flyt til schema-valideret sagsdata (`.eo`) hvis (a) der opstår behov for at to brugere skal se ens validering på samme sag, eller (b) et af valgene nogensinde kommer til at ændre de producerede tal frem for kun severity. Eneste produktions-callsite: `buildEoIndkomstRows` i `src/domain/eoRowEvaluation/eoRowIndkomstRows.ts`.
- **En valgindstillings værditype skal INFERERES på fladen, ikke annoteres væk og repareres bagefter.** `StyledDropdown` og `StyledRadioButton` er generiske i optionernes værditype, og `TValue` inferes fra `value`-proppen. Annoterer et kaldsted sin handler bredt (`StyledDropdownChangeEvent<string>`, `CommitEvent<string>`), vinder den brede type over literal-unionen, og kaldstedet må derefter bevise med et run-time-tjek, hvad compileren lige kunne have sagt. Det var oprindelsen til Indstillinger-sidens fem håndskrevne `is…Option`-typeguards, hver med kroppen `(OPTIONS as readonly string[]).includes(value)` – hvor `as readonly string[]` igen kaster netop den type væk, guarden bagefter påstår at etablere. Håndhæves af `form/choice-field-value-type-inferred`.
  - **Typens loft er målt og skal dækkes af en test.** `TValue` inferes fra `value`-proppen ALENE, ikke fra de rendrede `MenuItem`-børn (MUI typer `value` bredt). Compileren sikrer derfor, at det COMMITTEDE er en gyldig værdi, men ikke at kontrollen tilbyder præcis unionens værdier: både en overskydende og en manglende option typechecker grønt. Hver valgkontrols faktisk rendrede valgmuligheder skal derfor måles mod sit schema-univers i BEGGE retninger – `src/__tests__/components/pages/Indstillinger.optionCoverage.test.tsx`.
- **KRL satstabeller har ingen separat brevhoved-toggle**:
  KRL skal altid arve `regulering`-indstillingen 1-til-1 for visning af brevhoved.
- **Normal åbning af app/PWA**: startsiden bestemmes af den device-lokale toggle på Mineo-siden.
- **Alle hent-forløb**: "hent-forløb" betyder indlæsning af en eksisterende `.eo`-fil. Når filen er indlæst og anvendt, skal brugerens visning gå til `Stamdata`,
  uanset hvilken startside-toggle der ellers er valgt.
- **Schema-evolution i nested settings**:
  Nye top-level settings håndteres af den eksisterende merge-logik i `parseStoredSettings()`.
  Nye felter i nested objekter kræver eksplicit merge-logik i `src/settings/appSettingsParse.ts`.
  Nye nested objekter kræver også eksplicit merge-logik parallelt med `brevhovedIndstillinger`-mønsteret.
- **Farvetemaet har TRE valg, men kun TO udfald – og de to begreber er adskilte typer.**
  `themeMode` (brugerens valg) er `'light' | 'dark' | 'system'`, mens det tema, der faktisk males,
  er `ResolvedThemeMode` = `'light' | 'dark'`. `resolveThemeMode(themeMode, systemPrefersDark)` i
  `appSettingsSchema.ts` er den **eneste** oversættelse, og alt, der tegner – `buildTheme`,
  `data-mineo-theme`, `THEME_COLOR_BY_MODE` – tager `ResolvedThemeMode`, så et `'system'` ikke kan
  nå frem til dem. Uden typegrænsen ville en `'system'`-værdi give et lyst tema uden fejlmeddelelse,
  fordi ingen palet matcher.
  - **`'system'` er standarden og et ægte, gemt valg.** Tidligere blev systempræferencen kun læst
    som en startværdi og skrevet ind som et konkret `'light'`/`'dark'`; første settings-skrivning
    frøs dermed automatikken permanent, uden vej tilbage. Parse-laget må derfor **ikke** længere
    læse systempræferencen ind i defaults – det ville genindføre netop den fejl.
  - **Systempræferencen skal følges live.** `'system'` betyder «følg computeren», også når den
    skifter, mens Mineo er åben; contexten abonnerer på `matchMedia` og eksponerer
    `resolvedThemeMode`. Et enkelt opslag ved mount er ikke tilstrækkeligt.
  - **Head-scriptet gentager reglen i ES5** og kan ikke dele kode med `resolveThemeMode`.
    `themeBootstrapParity.test.ts` måler de to mod hinanden over krydsproduktet af alle gemte valg
    (inkl. ugyldige) og begge systempræferencer, så første paint og runtime ikke kan divergere.
  - Baggrund: udviklerens afgørelse 2026-08-18, `docs/testing/brugerblik/indstillinger.md` BB-024.
- **Miljøafhængige defaults** er kun tilladt for rene visuelle UI-præferencer. De må ikke bruges til sags-, PDF- eller beregningsrelevante settings.
- **Farvemarkering af font-styles er en DEV-kontrol, ikke en semantisk indholdsfarve.** En markørfarve skal
  svare til én komplet, kanonisk typografisignatur. Tabelsignaturer skelner mindst mellem 13 px og 14 px og
  omfatter fontfamilie, vægt, linjehøjde og tabular-nums. Placeholder- og afledte markører er tilsvarende
  størrelsesbundne. Enhedssuffikser (`kr.`/`%`) er del af feltindholdets signatur og må ikke få
  placeholderens markør alene, når feltet er tomt. Dermed kan en MUI-fallback eller en størrelsesafvigelse
  ikke få samme kontrolfarve som den korrekte felt-/tabeltypografi.

## Teknisk implementering
- Programindstillinger persisteres i **`localStorage`** under en dedikeret nøgle: `mineo_app_settings_v1`. Nøglen og browser-chromens theme-farver ejes kanonisk af `src/settings/themeBootstrap.ts`; `appSettingsStorage.ts` og runtime-contexten importerer dem herfra.
- Første paint bruger et synkront head-script genereret af `createThemeBootstrapScript`. Manglende, ugyldig eller ulæselig settings-storage følger systemtemaet præcis som runtime-parsingen; bootstrap må ikke vælge en særskilt light-fallback.
- Skema og defaults: `src/settings/appSettingsSchema.ts`
- Tolerant parsing/merge mod defaults: `src/settings/appSettingsParse.ts` (`parseStoredSettings`, `mergeAppSettings`, `loadInitialSettings`)
- localStorage-I/O (fail-safe): `src/settings/appSettingsStorage.ts` (`readLocalStorage`/`writeLocalStorage`)
- Context, runtime-state og sideeffekter (fx CSS toggles): `src/contexts/AppSettingsContext.tsx`

`.eo`-persistens opererer på sektionerne i `src/config/persistenceRegistry.ts` og den fælles
current-session-envelope. Browserlagerets namespace og den ene sessionsnøgle ejes fortsat af
`src/config/storageManifest.ts`; de to concerns må ikke forveksles.
- Sektionsschemaer og sektionernes autoritative mængde: `src/config/persistenceRegistry.ts`
- Save/Load: `src/utils/fileSave.ts` og `src/utils/fileLoad.ts`
- Current-session-hydrering: `src/inputCore/runtime/currentSessionEnvelope.ts`

## Designkrav (sikkerhed og forudsigelighed)
- **Monoton settingsrevision**: runtime ejer én ikke-persisteret settingsrevision. Den stiger præcis én gang ved en reel
  ændring af de settings, som kan påvirke validering, beregning eller dokumentoutput, og ikke ved no-op. Snapshot og
  revision læses atomisk og indgår sammen med inputrevisionen i `EvaluationSourceToken`; async-gates sammenligner altid
  hele tokenet.
- **Fail-safe**: hvis `localStorage` er blokeret/fejler, må app’en stadig fungere (fallback til in-memory state).
- **Schema-alignment og tolerant feltredning**: settings skal valideres via Zod. En ikke-objektværdi falder tilbage til alle defaults. For et objekt valideres hvert kendt felt selvstændigt: et ugyldigt felt falder kun tilbage til sit eget default, ukendte felter ignoreres, og øvrige schema-gyldige felter bevares. Samme regel gælder pr. felt i nested settingsobjekter. Det samlede sanitiserede objekt slutvalideres altid mod `appSettingsSchema`, før det publiceres.
- **Ingen netværk/telemetri**: settings må ikke forårsage data-overførsel ud af browseren.
- **Versionering af localStorage-nøgle**: En schemaændring må ikke gøre tidligere gyldige settings ulæselige eller
  ændre dem tavst. Nye eller omdøbte felter håndteres med den eksisterende feltvise merge-logik eller en eksplicit,
  testet migration, der bevarer den gamle værdi. En ny nøgle (`_v2` osv.) må kun indføres sammen med en adapter fra
  alle tidligere nøgler; nøgleskift er ikke i sig selv en tilladelse til at nulstille settings. Hvis en ændring kan
  give brugeren en synlig load-afvigelse eller fejl, skal den forelægges til godkendelse før implementering.
  Tilføjelser, der ikke ændrer eksisterende værdier, håndteres via merge-logikken uden nøgleskift.
- `defaultDirectoryHandleId` er device-lokal og ikke portabel; den må aldrig betragtes som sagsdata eller sendes med `.eo`.
- `documentDownloadFormat` er device-lokal og ikke portabel; den må aldrig betragtes som sagsdata eller sendes med `.eo`.
- **Standardplaceringen har ét navn og én tilstand.** `defaultDirectoryHandleId` (localStorage) og mappens registrering
  (IndexedDB, `default_directory_meta`) ligger i hvert sit lager og kan ryddes uafhængigt af hinanden. En flade må derfor
  ikke udlede *navnet* af det ene og *«er der valgt en mappe»* af det andet: overlever id'et sin registrering, ville den
  vise standardens navn stylet som et intakt brugervalg, mens gem-vejen tavst falder tilbage til skrivebordet. Begge dele
  udledes af `resolveDefaultDirectoryLocation` (`src/utils/file/defaultDirectoryLocation.ts`), hvis tre tilstande –
  `standard`, `valgt`, `utilgaengelig` – er udledt af begge kilder samtidig. Navnet staves kun dér
  (`DEFAULT_DIRECTORY_FALLBACK_NAME`/`…_DISPLAY_NAME`); håndhævet af `storage/default-directory-name-single-source`.
  `resolveDefaultDirectoryHandle` (`fileHelpers.ts`) er den bevidst adskilte gem/hent-vej: den må requestere permissions
  og skal derfor kun kaldes fra en brugerhandling, aldrig fra en visning.
