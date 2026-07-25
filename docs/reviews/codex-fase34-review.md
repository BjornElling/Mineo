# Codex-review: greenfield Fase 3+4 + undo/redo

## Samlet vurdering

Implementationen er ikke en sand greenfield-implementering ved det reviewede HEAD. Den nye inputkerne er reel, og save-, session- og history-transaktionerne har flere korrekte invarianter, men den lever stadig sammen med en omfattende gammel store-, editor-, fejl- og command-klynge uden et aktivt persisteret ansvar. Fase 3 er strukturelt uafsluttet: fire centrale slices adapterer readeren tilbage til gamle snapshot-/fejlmodeller, og beregningsmotorer kaldes med fejlende felter maskeret til tomværdier i stedet for kun fra en `ready` projektion. Fase 4 har desuden konkrete brud på tokenfriskhed, præcis save-fejlfokus og bindingens runtime-isolation. Undo/redo er korrekt for almindelige feltcommits, men ikke komplet for strukturelle tabelhandlinger. Dokumenternes statusangivelser overvurderer derfor både gennemførelsen og værnenes beviskraft.

## Fund

### F1 — Den gamle inputarkitektur er stadig en levende parallel struktur  [BLOKERENDE]

**Sted:** `src/hooks/useDraftField.ts:6-7`, `src/hooks/useDraftField.ts:176-203`, `src/components/tables/useGridCoreController.ts:7-8`, `src/components/tables/useGridCoreController.ts:204-229`, `src/stores/inputRuntimeStore.ts:220-221`, `src/input/inputTransactionRunner.ts:419-420`, `work-items/WI-002-fase4-case-porte.md:55-66`

**Observation:** Aktive transiente `Styled*`-felter abonnerer stadig på den gamle `formPersistenceStore`-epoch og den gamle history-restore-flagmekanik via `useDraftField`. Alle grids registrerer samtidig en deltager i den gamle `CriticalActionContext`, selv om `MainLayout` har fjernet provideren, så registreringen er en produktions-no-op. Den gamle `inputRuntimeStore` opretholder fortsat `sections`, legacy-`invalidDrafts`, history og compatibility-konvertering, og `inputTransactionRunner` eksponerer fortsat en separat `executeLegacyInputTransaction`. Repo-bred reachability viser ingen produktionscallsites til de gamle `Table*Input`-komponenter, `useTableInputCore`, `useRowDrafts` eller den gamle runner; de fire nævnte `Styled*`-flader bruger lokal/transient state, og `LoentrinFinderOverlay` erklærer selv, at den aldrig skriver persisteret sagsdata (`src/components/pages/erstatningsopgoerelse/shared/LoentrinFinderOverlay.tsx:55-59`). WI-002's “standalone-grid”-begrundelse modsiges desuden af dens egen audit på linje 149.

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** §3.1 kræver én autoritativ inputtilstand, §3.5 kræver én editor, §3.6 kræver én runner, og §5.1 tillader kun legacy, hvis et ansvar faktisk ikke er overført. Den tilbageværende klynge er ikke en nødvendig overgangsbro; den er død eller no-op produktionsarkitektur, som fortsat skaber to stores, to editorlivscykler, to invalid-input-repræsentationer og to critical-action-systemer. Fase 4 trin 13 og slettelisten i §4.3 er derfor ikke forsvarligt udskudt.

**Anbefalet rettelse:** Frikobl de få transiente `Styled*`-controls til en ren lokal editorfacade, og bind grid-core direkte til greenfield-editorregistret i stedet for den gamle coordinator. Slet derefter `inputRuntimeStore`, `formPersistenceStore`/read-model/selectors, `FormPersistenceContext*`, `inputTransactionRunner`, `legacyInputCompatibility`, `legacyGridTransactionBridge`, den gamle invalidDraft-cellekanal, gamle `Table*Input`/tableInput-hooks, rowDrafts og deres implementeringstests. Flyt den generiske history-retry-løkke ud af legacy-adapteren før denne slettes.

### F2 — Fase 3-projektionerne adapterer tilbage til gamle snapshots og kalder motorer før `ready`  [BLOKERENDE]

**Sted:** `src/domain/aarsloen/aarsloenProjection.ts:47-54`, `src/domain/aarsloen/aarsloenProjection.ts:83-86`, `src/domain/aarsloen/aarsloenProjection.ts:276-300`, `src/domain/forsoergertab/forsoergertabReaderProjection.ts:29-47`, `src/domain/forsoergertab/forsoergertabSnapshot.ts:19-31`, `src/domain/forsoergertab/forsoergertabSnapshot.ts:161-177`, `src/domain/erhvervsevnetab/erhvervsevnetabReaderProjection.ts:60-83`, `src/domain/erhvervsevnetab/eetSnapshot.ts:54-65`, `src/domain/erhvervsevnetab/eetSnapshot.ts:127-145`, `src/domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection.ts:522-560`, `src/domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection.ts:636-678`

**Observation:** Kun Satser, Stamdata, Varige mén og Renteberegning bruger den fælles `runProjection`/`ProjectionResult`-form. Årsløn omsætter hvert reader-error til descriptorens tomværdi og kalder `computeAarsloenBeregning` før dens efterfølgende `fieldIssues`-gate. Forsørgertab og EET erklærer eksplicit projektionen “altid ready”, oversætter reader-fejl til gamle `fieldErrors`-maps og lader snapshots eje gates; begge snapshots kalder beregningsmotorer før de sammenholder disse maps med resultaterne. EO rekonstruerer tilsvarende legacy-lignende `source`/`blocksSave`-maps og syntetiske `:loenindkomst`-fejl før det gamle snapshot kaldes. Det er fire forskellige overgangsmønstre, ikke otte ensartede rene projektioner. ASL-årslønsreglen er endda allerede kanonisk i descriptoren (`src/inputCore/catalog/faellesAarsloenDescriptors.ts:41-50`), men genberegnes igen i Forsørgertab (`:93-98`) og EET (`:226-231`).

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** §3.4 siger, at almindelige rene domæneprojektioner returnerer `ready | blocked`; §3.9 siger, at beregningsmotorer kun modtager data fra en `ready` projektion. Fase 3 trin 3 og exitkriteriet på `docs/architecture/draft-commit-greenfield-design.md:1137-1161` siger det samme. Maskering til tomværdi forhindrer det fejlende tal i at nå motoren, men opfylder ikke den arkitektoniske invariant og bevarer gamle fejl-/gate-sandheder inde i snapshots.

**Anbefalet rettelse:** Definér typed, consumer-specifikke `ProjectionResult`s pr. panel, række, tab og dokumentdependency med den fælles collector. Kald kun den relevante motor i `ready`-grenen; behold dependency-specifik isolation ved små underprojektioner frem for globale gates. Fjern `fieldErrors`/`blocksSave` fra beregningssnapshots, lad UI læse `FieldIssueSnapshot`, og brug descriptorens ene ASL-validator uden slice-lokal genberegning.

### F3 — `.eo`-save skriver et tokenforældet snapshot efter async-grænsen  [VÆSENTLIG]

**Sted:** `src/hooks/useFileSaveLoad.ts:229-269`, `src/inputCore/runtime/criticalActionCoordinator.ts:44-50`, `src/contracts/critical-action-contract.md:77-83`

**Observation:** `handleGem` settler editoren og evaluerer et frisk save-snapshot, men gemmer derefter snapshot/token lokalt, afventer `resolveDefaultDirectoryHandle(settings)` og kalder `saveToFile` uden at genlæse eller sammenligne hele `EvaluationSourceToken`. `preparation.token` bruges heller ikke. Brugeren kan ændre input eller dokumentrelevante settings, mens directory/file-picker-flowet er åbent, hvorefter den ældre sag skrives til fil.

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** Den normative critical-action-kontrakt kræver sammenligning af input- og settingsrevision efter enhver async-grænse og umiddelbart før irreversibel I/O. Fase 4 trin 3 og §3.9 kræver et frisk snapshot efter settle; et snapshot, der var frisk før en picker, er ikke frisk ved skrivningen.

**Anbefalet rettelse:** Eksponér en binding-ren `captureSaveSource`/tokenkontrol gennem caseporten. Efter directory-resolution og umiddelbart før `saveToFile` sammenlignes hele tokenet; ved ændring køres save-evalueringen igen eller operationen stoppes fail-closed. Tilføj en test, der ændrer henholdsvis input- og settingsrevision, mens directory-resolution er pending.

### F4 — Save-fejlfokus kasserer den strukturelle adresse og kan vælge forkert felt/fane  [VÆSENTLIG]

**Sted:** `src/inputCore/react/greenfieldSaveBlockedFocus.ts:8-34`, `src/utils/saveBlockedFocus.ts:89-143`, `src/utils/saveBlockedFocus.ts:183-203`, `src/__tests__/inputCore/react/greenfieldSaveBlockedFocus.test.ts:17-25`, `src/__tests__/inputCore/react/greenfieldSaveBlockedFocus.test.ts:70-84`

**Observation:** Adapteren deserialiserer den korrekte strukturelle adresse, men reducerer den til `{pageKey, fieldName: parsed.field, message: ''}`. Entity-path og collection-identitet går tabt. Den gamle router forventer derimod legacy-fieldPaths som `offentligeYdelserRows...` eller `loenindkomstAnsaettelsesforhold...`; et greenfield-cellefelt som blot ender i `belob`, `fra` eller `til` rammer derfor EO-defaultfanen og fokuserer siden det første synlige `.Mui-error`-felt, ikke den afviste celle. Testen karakteriserer og godkender netop denne lossy mapping og “første røde felt”-fallback.

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** §3.2/§3.5 gør strukturel feltadresse plus konkret editorlokation til identiteten. Phase 4-statusprosaen hævder bevaret save-blocked-fokus-UX, men implementeringen kan fokusere en anden række, et andet felt eller en anden fane. Det er også unødig parallelitet mellem `greenfieldSaveBlockedFocus` og en legacy-router, hvis identitetsmodel ikke kan repræsentere greenfield-målet.

**Anbefalet rettelse:** Slå direkte op på den fulde `data-mineo-field-address` og en kanonisk editor-destination for adressen. Destinationen skal levere route/fane før mount og derefter fokusere det eksakte adresse-/lokationsmatch. Behold kun en generisk, neutral retry-/scroll-helper; slet legacy fieldPath-routing og tilføj tests for nested EO-rækker, to fejl på samme fane og samme felt på to flader.

### F5 — Fase 4-systemportene omgås og ejer ikke det ansvar planen tillægger dem  [VÆSENTLIG]

**Sted:** `src/inputCore/react/useCaseOperations.ts:30-53`, `src/persistence/caseFileOperations.ts:63-90`, `src/persistence/caseResetOperations.ts:24-41`, `src/components/pages/renteberegning/RenteberegningTab.tsx:288-293`, `work-items/WI-002-fase4-case-porte.md:28-35`

**Observation:** `useCaseOperations` henter katalog, writes og coordinator fra den injicerede binding, men læser og optager save-snapshot direkte fra den globale `slimInputStore`. En alternativ/testbinding kan derfor vise og mutere én sag, mens save/`hasAnyData` læser en anden. `CaseFileOperations` ejer i praksis kun `evaluateSave`, `applyLoadedSnapshot` og `hasAnyData`, ikke encode, preflight eller load-flow som WI/design påstår. `CaseResetOperations` ejer kun hel-sags-clear; den eneste sektionsreset kaldes direkte fra Renteberegning-siden gennem runtimebindingen. De genudstillede `loadReplaceCaseCommand` (`caseFileOperations.ts:102-104`) og `clearCaseCommand` (`caseResetOperations.ts:40-41`) har ingen produktionscallsites.

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** §3.10 kræver små, eksplicitte porte uden globale bypasses og tillægger `CaseFileOperations` save/preflight/load/apply samt `CaseResetOperations` reset/`Slet alt`. Den kendte globale-store/binding-split er ikke blot en hypotetisk Fase 6-guard; den er et uafsluttet Fase 4-ansvar og gør porten uisolerbar nu.

**Anbefalet rettelse:** Lad bindingen eksponere en systemintern, samlet snapshot/token-capture, som `useCaseOperations` injicerer; ingen port må importere produktions-singletonen indirekte. Afklar og implementér den planlagte portgrænse: enten flyttes preflight/load/encode og sektionsreset ind i portene, eller den autoritative plan ændres, så portene udtrykkeligt kun er runtime-adaptere. Fjern de ubrugte command-aliaser.

### F6 — Lokationsrestore er ikke komplet for strukturelle tabelhandlinger  [VÆSENTLIG]

**Sted:** `src/inputCore/inputHistory.ts:9-24`, `src/inputCore/react/useCollectionRows.ts:68-81`, `src/components/tables/GreenfieldFerieperiodeTable.tsx:65`, `src/components/tables/GreenfieldFerieperiodeTable.tsx:112`, `src/utils/historyTargetRestore.ts:1-16`, `src/utils/historyTargetRestore.ts:115-160`

**Observation:** Feltsettle og immediate commits sender en strukturel `HistoryOrigin`, men `useCollectionRows` dispatcher `insertRow`, `deleteRow` og `reorderRows` uden origin. Slet-knapper og sortering skaber derfor korrekte history-frames uden lokation; undo/redo kan gendanne data, men `dispatchInput` kan ikke returnere `restoredOrigin`, så brugerens route/fane/fokus gendannes ikke. `HistoryOrigin` kan kun beskrive et felt, ikke et strukturelt row-action-fokusmål. Samtidig ligger den nye restore-loop stadig i `utils/historyTargetRestore.ts`, som importerer den gamle `HistoryFrame` og bevarer den gamle stringbaserede restore-adapter.

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** Fase 4-status påstår “fuld lokationsbaseret undo/redo-fokusrestore”. §3.6 inkluderer row-commands i samme `dispatchInput(command, origin)`-model, og undo-kontrakten kræver navigation/fokus efter succes. Dynamiske rækker er dermed et konkret hul, ikke blot en fremtidig variant.

**Anbefalet rettelse:** Udvid origin-modellen med en typed editor-/row-destination, eller giv hver row-action et deterministisk eksisterende/placeholder-feltanker. Send origin ved delete/reorder og test undo/redo af promotion, delete og sortering på umounted faner. Flyt den runtime-neutrale retry-loop til et neutralt greenfield-modul og slet den gamle frame-/fieldPath-adapter.

### F7 — Test- og arkitekturværn beviser overgangsimplementeringen, ikke målarkitekturen  [VÆSENTLIG]

**Sted:** `src/__tests__/domain/renteberegning/renteberegningReaderProjection.test.ts:45-84`, `src/__tests__/domain/aarsloen/aarsloenProjection.greenfield.test.ts:101-138`, `src/__tests__/domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection.test.ts:149-200`, `src/__tests__/quality/architecture/architectureRules.ts:56-78`, `src/__tests__/quality/architecture/architectureRules.ts:314-340`, `src/__tests__/quality/architecture/architectureRules.ts:1298-1349`, `src/__tests__/quality/architecture/architectureRules.test.ts:67-86`

**Observation:** Renteberegningens projektionssuite tester kun nominale/tomme rækker og mangler format, bounds, missing, warning, row-isolation ved én fejl og stale-result removal. Årsløn- og EO-tests låser maskér-til-tomværdi og legacy-fejlmap-adapterne som forventet adfærd. Save-fokustesten låser tilsvarende den lossy fallback fra F4. Arkitekturharnessets page-regel kender kun gamle hooknavne og anser rå `sections.erhvervsevnetab` for rent; restore-værnet er et teksttokencheck, som godkender en fil blot ordet `restoreTargetAttributes` findes, uden at bevise at attributterne rammer det fokuserbare element. Session-storage-allowlisten indeholder slettede filer, men reglen har ikke `antiRot`, og harnesset springer derfor dens stale poster over trods kommentarens påstand om universel allowlist-anti-rot.

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** Fase 3 trin 4-8 kræver den samme matrix for hver slice; §7 kræver invarianttests frem for karakterisering af overgangsmekanik. Guards skal håndhæve én reader-, runner-, store- og restore-grænse. De nuværende grønne suites kan ikke opdage de vigtigste fund i dette review.

**Anbefalet rettelse:** Erstat snapshot-/map-karakterisering med kontrakttests for `ready | blocked`, dependency-isolation, format=bounds-status, missing/warning, stale-result removal og “motor aldrig kaldt ved blocked”. Tilføj AST/importguards mod gamle stores/runners/hooks og rå aggregate-reads uden for runtime, gør alle allowlists anti-rot, og verificér restore-attributter på det faktisk renderede fokusmål. Test caseportene med en ikke-global binding og save-tokenændring over async-grænser.

### F8 — `Greenfield*` og Fase 0-navne er blevet varige migrationsnavne  [MINDRE]

**Sted:** `src/inputCore/react/fields/GreenfieldTextField.tsx:1`, `src/components/tables/useGreenfieldCollectionTable.ts:7-14`, `src/inputCore/react/useGreenfieldUndoRedoShortcuts.ts:6-14`, `src/config/greenfieldPhase0Inventory.ts:18-18`, `src/inputCore/ledger/consumerLedger.ts:1-8`

**Observation:** Produktionsarkitekturen indeholder 33 filer med `Greenfield/greenfield` i navnet og hundredvis af referencer. `greenfieldPhase0Inventory` er ikke længere en historisk reviewfil; den føder den aktive consumer-ledger. Præfikset skelner fortsat den nye vej fra en gammel vej, selv hvor den nye vej nu er den eneste tilsigtede.

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** §5.1 beskriver en ikke-deploybar cutover, ikke to permanente produktfamilier. Når den gamle vej er slettet, udtrykker `Greenfield*` ingen domæne- eller arkitekturgrænse og normaliserer migrationstilstanden som slutdesign.

**Anbefalet rettelse:** Efter F1 omdøbes de kanoniske fields, tables, history/save helpers og inventory/ledger-kilder uden `Greenfield`/`Phase0`. Behold kun greenfield som historisk dokument-/branchbegreb.

### F9 — Collection-table-wrapperen foretager et ekstra autoritativt read, som den ikke bruger  [MINDRE]

**Sted:** `src/components/tables/useGreenfieldCollectionTable.ts:14-38`, `src/components/tables/useGreenfieldCollectionTable.ts:49-89`, `src/inputCore/react/useCollectionRows.ts:44-66`

**Observation:** Tabellen modtager `committedRows` fra slice-projektionen, men kalder også `useCollectionRows`, som abonnerer på samme runtime og læser collectionens `rowIds`. Wrapperen bruger aldrig `rows.rowIds`; kun commandcallbacks bruges. Den samme tabel har derfor både et projection-read og et overflødigt aggregate-read for samme collection.

**Hvorfor det er et problem (plan-/arkitekturhenvisning):** §3.4 og §3.8 skal give én tydelig read-grænse og én rækkeidentitet. Dette er ikke en anden sandhed om celleværdier, men det er unødvendig parallel læsning og gør wrapperens ansvar uklart.

**Anbefalet rettelse:** Split row-command-porten fra den reaktive row-id-selector, og lad wrapperen kun hente commands, når `committedRows` allerede er den kanoniske projektion. Alternativt skal hooken selv eje readet og ikke modtage en konkurrerende rækkeliste.

## Ikke-fund / bevidst godkendt

- `.eo`-save-sondringen er korrekt implementeret i `src/persistence/eoSaveProjection.ts:17-40`: hele aggregatet valideres, kun `rejectedInputs` blokerer, og canonical bounds/rule-issues serialiseres schema-valideret.
- Current-session-korruption er reelt fail-closed: `initializeInputRuntime` bevarer den rå envelope og hydraterer en write-blokeret tom runtime (`src/inputCore/runtime/initializeInputRuntime.ts:44-78`); `dispatchInput` tillader derefter kun `clearCase` (`src/inputCore/runtime/dispatchInput.ts:150-153`), og startup-noticen wires i `MainLayout`.
- Hel-sags-replacement rydder history i samme commit som input/revision (`src/inputCore/runtime/dispatchInput.ts:174-181`), og storage skrives/verificeres før det ene store-write med rollback ved fejl (`:74-115`). Fase 4 trin 10 er dermed gennemført.
- `restoredOrigin` surfacer kun efter en vellykket undo/redo-commit (`src/inputCore/runtime/dispatchInput.ts:157-171`). For almindelige felt- og cellecommits er feltadresse + editorlokation en korrekt identitet, også når samme felt vises på to flader.
- `useFormFieldSurface` og `useGridCellSurface` er ikke i sig selv skadelig duplikering: førstnævnte ejer form-DOM-aktivering, sidstnævnte grid-navigation/registrering, mens begge delegerer draft/settle til samme editor-engine. Problemet er det gamle parallelle lag i F1, ikke denne nødvendige surface-forskel.
- Load-apply sker gennem `CriticalActionCoordinator.applyReplacement`; åben draft kasseres først efter en replacement-generation er observeret. Den atomiske inputdel er derfor korrekt, selv om portejerskabet i F5 skal strammes.
- De reviewede målrettede checks er grønne: `npm run typecheck` samt 14 relevante Vitest-filer med 155 tests. Det beviser compile/regressionsstatus, ikke de strukturelle exitkriterier.

## Dokumentationsafvigelser

- `docs/architecture/draft-commit-greenfield-design.md:1084-1109` erklærer otte “rene reader-projektioner”, men Årsløn, Forsørgertab, EET og EO bruger de adapter-/snapshotmønstre, der er beskrevet i F2.
- Samme dokument kræver på `:1137-1161`, at motorer kun kaldes ved `ready`; Årsløn-, Forsørgertab- og EET-koden kalder motorerne før deres fejl-/gateklassifikation.
- `docs/architecture/draft-commit-greenfield-design.md:1111-1115` siger, at `fieldErrors`/invalidDraft-cellekanalen udskydes til Fase 4. Fase 4-status på `:1175-1179` flytter samme oprydning videre til Fase 5 uden at opdatere den tidligere påstand.
- `docs/architecture/draft-commit-greenfield-design.md:1177-1179` og `:1220-1222` hævder reachability via standalone-grid. `work-items/WI-002-fase4-case-porte.md:149` fastslår selv, at standalone allerede er greenfield og ikke importerer den gamle runtime. Den tilbageværende grid-reference er en no-op legacy critical-action-deltager, ikke et nødvendigt persisteret ansvar.
- `work-items/WI-001-fase3-afslutning.md:14-20` reducerer Fase 3-restarbejdet til én Varige mén-test, selv om de obligatoriske trin 4-8 ikke er dækket pr. slice, og de fire adapterprojektioner ikke opfylder målformen.
- `work-items/WI-002-fase4-case-porte.md:28-35` siger, at `CaseFileOperations` ejer encode/preflight/load/apply, og `CaseResetOperations` ejer reset/clear. De faktiske porte har de smallere ansvar beskrevet i F5.
- `work-items/WI-002-fase4-case-porte.md:152` klassificerer global-store/binding-splittet som latent Fase 6-arbejde. Det strider mod Fase 4's §3.10-exit og gør allerede porten forkert ved enhver injiceret binding.
- WI-002 er internt usammenhængende: status på `:3-9` siger fuldt gennemført og fuld suite grøn, mens `:156-177` fortsat kalder allerede udførte trin “Resterende Fase-4-arbejde”, og `:185-186` siger, at suiten bevidst er rød.
- `work-items/WI-003-undo-redo-lokationsrestore.md:3-9` siger hele long tail er gennemført, mens `:38-41` siger shell-wiren ikke er aktiveret og `:71-100` fortsat mærker long tail som udestående. Desuden er row-action-hullet fra F6 ikke nævnt.
- `src/contracts/undo-redo-contract.md:20-23` siger, at hvert history-frame indtil Fase 5 bærer et midlertidigt `fieldErrors`-snapshot. Den aktuelle `InputHistoryFrame` indeholder kun `input` og valgfri `origin` (`src/inputCore/inputHistory.ts:21-24`); kontrakten er forældet.
- Arkitekturharnessets kommentar på `src/__tests__/quality/architecture/architectureRules.test.ts:8-12` lover anti-rot for hver allowlist, men implementeringen på `:72-74` kontrollerer kun regler med `antiRot: true`. Den stale session-storage-allowlist demonstrerer afvigelsen.
