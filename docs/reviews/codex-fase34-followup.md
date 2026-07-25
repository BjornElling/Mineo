# Opfølgende review: Fase 3+4-rettelser

## Samlet vurdering

Nej. Slutproduktet er stadig ikke en sand greenfield-implementering. Den store aktive legacy-runtime er slettet, Årsløn har fået en reel projektionsgate, fuld feltadresse bruges nu ved fokusering, og collection-wrapperens dobbeltread er væk. Men kun F9 er helt lukket.

Det blokerende F2-princip består i Forsørgertab, EET og EO: de relevante snapshot-/beregningsmotorer kaldes fortsat med reader-fejl maskeret til tomværdier, før eller uden en strukturel dependency-gate. F1 er heller ikke konvergeret helt, fordi en anden komplet inputmodel fortsat ligger i `src/input/` ved siden af `src/inputCore/`. F3–F8 har hver fået reelle forbedringer, men også dokumenterede resthuller.

Vurderingen gælder de to commits til `HEAD` (`907323e`). En separat, uncommitted tilføjelse i `src/__tests__/inputCore/editor/fieldEditor.test.ts` er ikke regnet som en del af rettelsen.

## Fund-for-fund status

| Fund | Status | Begrundelse |
|---|---|---|
| F1 | DELVIST | Den aktive store/editor/runner-klynge er slettet, og `components/inputs/transient/` bruges kun til ikke-persisteret dialog-/overlay-state (`OffentligeYdelserTab.tsx:308-335`, `LoentrinFinderOverlay.tsx:188-215`, `ContentBoxReportDialog.tsx:193-201`). Men en separat inputtilstand, rejected-model, katalog/projektion og envelope består i `src/input/` (`inputState.ts:18-35`, `inputEnvelope.ts:14-25`) parallelt med `src/inputCore/settledInput.ts:26-38`; dens eneste produktionsbro er selv uden produktionscallsite (`document/layout/inputProjectionDocumentGate.ts:17-18`). Arkitekturen er ikke reelt væk, kun gjort runtime-død. |
| F2 | DELVIST | Årsløn blokerer nu korrekt før motoren (`aarsloenProjection.ts:292-298`), og EO's duplikerbare `blocksSave` er erstattet af årsag (`eoInputIssues.ts:15-30`). Forsørgertab erklæres stadig “altid ready” (`forsoergertabReaderProjection.ts:32-36`) og kalder motoren før `fieldErrors` bruges (`forsoergertabSnapshot.ts:165-177`, `:223-225`); EET gør det samme (`eetSnapshot.ts:127-145`, `:153-170`, `:179-195`). EO masker reader-fejl (`erstatningsopgoerelseReaderProjection.ts:183-191`), sender dem til snapshot (`:648-680`), men snapshot-gaten bygger kun validator-invarianter (`snapshot/eoSnapshot.ts:262-276`) og kalder motorerne bagefter (`:324-345`); `eoErrors` bruges dér kun til inspektion. Det strider direkte mod `form-contract.md:63` og `error-contract.md:126`. |
| F3 | DELVIST | Tokenet kontrolleres efter directory-resolution (`useFileSaveLoad.ts:257-275`), men `saveToFile` krypterer og resolver først derefter gemmemålet (`fileSave.ts:142-161`), og den faktiske filpicker ligger inde i denne senere async-sti (`fileSaveTarget.ts:144-158`). Input/settings kan derfor ændres, mens filpickeren er åben, hvorefter det gamle snapshot skrives uden ny tokenkontrol. |
| F4 | DELVIST | Den fulde adresse bruges nu til eksakt DOM-opslag (`inputCore/react/saveBlockedFocus.ts:22-27`, `:43-79`), men destinationstabellen er ufuldstændig: EO resolver kun to collections, to properties og fire topfelter og falder ellers til standardfanen (`fieldAddressDestination.ts:40-54`). `eoBilagSelection` ligger eksempelvis på Beregning-fanen (`EOberegningTab.tsx:263-274`) men routes til EO-oplysninger; alle ikke-EO-sektioner får desuden kun defaultfanen (`fieldAddressDestination.ts:80-90`), selv om EET har redigerbare felter på Differencekrav (`EetDifferencekravTab.tsx:82-85`, `:466-575`). |
| F5 | DELVIST | Global-singleton-bypasset er fjernet: portene læser nu samme binding (`useCaseOperations.ts:30-45`). Til gengæld eksponerer den offentligt tilgængelige `InputRuntimeBinding` hele den mutable Zustand-`StoreApi` som `store` (`inputRuntimeContext.tsx:34-42`, `slimInputStore.ts:50`), så enhver felt-/sideadapter kan bruge `getState`/`setState` uden `dispatch`; grænsen håndhæves kun af en kommentar. Se N1. |
| F6 | DELVIST | Row-origin kan nu bære route/fane, og `useCollectionTable` leverer den (`useCollectionTable.ts:37-45`). Men både origin-argumentet og `HistoryOrigin.field` er valgfrit (`useCollectionRows.ts:111-123`, `inputHistory.ts:9-23`), og `useCollectionRows` kalder command-hooken uden origin (`useCollectionRows.ts:72-75`). Fem aktive callsites bruger fortsat denne vej, fx `EetAslAfgoerelserTable.tsx:191`, `BeregnetRenteTable.tsx:230` og `useLoenindkomstViewModel.ts:42`; deres row-commits kan stadig få history-frame uden lokation. Se N2. |
| F7 | DELVIST | AST-indsamlingen dækker statisk import, `export ... from`, dynamisk import og `require` (`astQueries.ts:96-150`), og universel allowlist-anti-rot er reelt indført (`architectureRules.test.ts:67-88`). Legacy-reglen matcher dog kun de historiske fil-/mappenavne med regex (`architectureRules.ts:114-155`); samme parallelle ansvar under et nyt navn passerer, ligesom den tilbageværende `src/input/`-kerne gør. Restore-værnet er fortsat udtrykkeligt et teksttokenværn (`architectureRules.ts:1282-1301`), og Renteberegningens projektionssuite har stadig kun tre nominale/tomme cases (`renteberegningReaderProjection.test.ts:45-85`). |
| F8 | DELVIST | De fleste permanente fil-/symbolpræfikser er omdøbt, men migrationssproget består bredt i levende produktionskode, bl.a. det aktive inventory (`config/consumerInventory.ts:2`) og app-entry (`minprocesrenteMain.tsx:15-16`). Navngivningen er også inkonsistent: `CheckboxField.tsx` eksporterer stadig typen `CheckboxProps`, komponenten `Checkbox` og barrel-navnet `Checkbox` (`CheckboxField.tsx:14-49`, `fields/index.ts:33-34`), mens søskende hedder `ChoiceField`/`RadioField`; `gridCells.tsx` afviger tilsvarende fra `GridTextCell.tsx`/`GridChoiceCell.tsx`. |
| F9 | LUKKET | `useCollectionTable` henter nu kun `useCollectionRowCommands` og bruger `committedRows` som eneste reaktive rækkekilde (`useCollectionTable.ts:37-46`, `:58-63`). Det overflødige aggregate-id-read er væk. |

## Nye fund

### N1 — Runtimebindingen eksponerer en rå, mutérbar store [VÆSENTLIG]

**Sted:** `src/inputCore/react/inputRuntimeContext.tsx:34-42`, `:126-135`; `src/inputCore/runtime/slimInputStore.ts:50`; `src/inputCore/react/useCaseOperations.ts:37-40`.

**Observation:** For at lukke F5 blev hele `SlimInputStore` lagt på den binding, som alle `useInputRuntime()`-consumers modtager. Typen er Zustand `StoreApi`, ikke en read-only snapshotport. Den giver derfor både rå aggregate-reads og `setState`; der findes ingen type- eller arkitekturguard, som begrænser den til systemporte.

**Hvorfor:** F5's konkrete singleton-split er væk, men løsningen har skabt en generel bypass af typed commands, transaction/history, schema- og storage-grænsen. En fremtidig adapter kan nu mutere input uden at TypeScript protesterer.

**Anbefalet rettelse:** Hold `store` privat i provider/runtime-infrastrukturen. Eksponér en smal systemport til stabil `{input, token}`-capture, og lad React-bindingens offentlige kontrakt fortsat bestå af `getSettled`, evaluering og typed `dispatch`.

### N2 — Origin-typen kan ikke bevise felt- kontra rækkecommit [VÆSENTLIG]

**Sted:** `src/inputCore/inputHistory.ts:9-23`; `src/inputCore/react/useCollectionRows.ts:72-75`, `:111-140`; `src/components/tables/EetAslAfgoerelserTable.tsx:191`; `src/components/pages/erstatningsopgoerelse/loenindkomst/useLoenindkomstViewModel.ts:42`.

**Observation:** `HistoryOrigin.field` og `useCollectionRowCommands(..., origin)` er begge valgfrie. Modellen skelner ikke type-sikkert mellem et feltcommit, som altid skal have adresse, og et row-commit, som skal have typed tabeldestination. Den eksisterende `useCollectionRows`-facade udelader destinationen, og fem produktionsflader bruger den.

**Hvorfor:** History-data gendannes, men navigation/fokus kan fortsat forsvinde lydløst. Den valgfrie struktur gør det samtidig muligt at sende et feltcommit uden feltadresse; en enkelt positiv editor-test kan ikke etablere en tværgående invariant.

**Anbefalet rettelse:** Brug en discriminated union for `field`- og `collection`-origin. Gør row-destination obligatorisk for alle muterende collection-hooks, og giv hvert aktivt callsite sin route/fane samt et deterministisk fokusanker, hvor UX-kontrakten kræver fokus.

### N3 — Slettet restore-arkitektur har efterladt en inert focus-tracker [MINDRE]

**Sted:** `src/utils/undoFocusTracker.ts:1-43`; `src/components/layout/MainLayout.tsx:20`; `src/components/inputs/StyledCheckbox.tsx:77-86`; `src/inputCore/react/historyTargetRestoreLoop.ts:10`.

**Observation:** `installUndoFocusTracker` og `readLastUndoFocus` har ingen produktionscallsite; `MainLayout` importerer kun `clearLastUndoFocus`. Modulet kan derfor aldrig optage den fokusstate, som det hævder at eje. Samtidig fortæller bevarede primitive-kommentarer stadig, at history-restore bruger `data-mineo-undo-field-path`, mens den nye restore-loop siger, at denne adapter er slettet.

**Hvorfor:** Det er død runtimekode og direkte modstridende dokumentation efter F1/F6-oprydningen. At attributten fortsat bruges separat af EO-issue-navigation gør restens faktiske ansvar endnu mere uklart.

**Anbefalet rettelse:** Slet den inerte tracker og `MainLayout`-kaldet. Behold kun de legacy-navngivne DOM-attributter, der faktisk kræves af levende issue-navigation, og omdøb/dokumentér dem efter dette ene ansvar.

## Mistet testdækning

- De nye `useTransientDraft`/`TransientAmountInput`/`TransientDateInput` har ingen dedikerede tests for blur/Enter, Escape uden efterfølgende blur-commit, rejected draft, ekstern resync eller beløbsparsing. De to Container-suiter bruger kun transient tekst/dato som fokus-fixtures (`Container.test.tsx:539-569`, `Container.checklistGaps.test.tsx:256-282`); `TransientAmountInput` testes slet ikke. De slettede felt-/escape-tests dækkede disse levende UX-invarianter på den gamle vej, men dækningen er ikke genetableret på den nye undtagelse.
- Fire slettede tabelintegrationssuiter dækkede dropdown-navigation, `immediateEditing`, loose-table-navigation og to-trins-genindtræden efter blur. De gamle cellekomponenter er væk, men adfærden lever i `useGridCoreController` og de nye Grid-celler. Kun `tableKeyboardNavigation.arrowWrap.test.tsx` og `tableKeyboardNavigation.lockedSkip.test.tsx` er tilbage; især reentry- og dropdown-integrationen er ikke erstattet.
- Save-token-tests beviser kun `isSaveSourceStillCurrent` isoleret (`caseFileOperations.test.ts:160-202`). `useFileSaveLoad.test.tsx:22-30` mocker hele `saveToFile`, så ingen test kan ændre input/settings under den interne filpicker og fange F3-hullet.
- Ingen test håndhæver, at alle produktions-row-commands leverer origin. Runtime-testen konstruerer selv en korrekt `rowOrigin` (`dispatchInput.test.ts:300-312`) og opdager derfor ikke de fem originløse hooks.

## Resterende teknisk gæld

1. Gør Forsørgertab, EET og EO til dependency-specifikke `ready | blocked`-projektioner, og bevis at en afhængig motor aldrig kaldes i `blocked`.
2. Flyt save-tokenkontrollen til efter al target-/picker-resolution og umiddelbart før write.
3. Erstat den håndskrevne feltadresse→fane-heuristik med en komplet, kanonisk destination pr. editorflade.
4. Luk de rå/valgfrie write-bypasses (`runtime.store`, originløse row-hooks) type-sikkert.
5. Slet den døde `src/input/`-kerne, den inerte focus-tracker og resterende migrations-/legacy-prosa; stram guards til ansvar frem for historiske filnavne.
6. Genetablér de mistede transient- og grid-interaktionstests samt den fulde projektionsmatrix.

## Verifikation

Alle ønskede gates er grønne ved det reviewede working tree:

- `npm run typecheck`
- `npm run typecheck:test`
- `npm run lint`
- `npm run verify:ledgers` — 13 tests bestod, inventory verificeret
- `npx vitest run` — 488 testfiler, 5.991 tests bestod

Grønne gates ændrer ikke ovenstående strukturelle vurdering; flere af hullerne ligger netop uden for den nuværende testdækning.
