# R2 — Inputkerne, felteditor og afsluttet input

**Status:** Delvist gennemgået  
**Dato:** 2026-07-28  
**Dækket:** aggregate/reducer, editor/codec, form-/grid-adaptere, runtime-dispatch, history,
placeholder-rækker, relevansrydning og centrale R2-tests  
**Angreb udført:** maskeret værdi; fjerde kanal; parallel inputvej; Escape→blur; to commands/history-trin;
styrende valg; placeholder-promotion; bred editor-capability  
**Evidens:** AST-kaldskort for dispatch/editor/settle/codec; 10 målrettede testfiler/247 tests grønne;
direkte reducerreproduktion af R2-F01  
**Fund:** 3 (R2-F01, R2-F02, R2-F03) — R2-F01 rettet 2026-07-28  
**Hypoteser:** Ingen  
**Handling:** R2-F01 rettet (etape 2); R2-F02 og R2-F03 parkeret til deres etaper (4 og 10)  
**Næste skridt:** afgør kontraktdriften (R2-F02, etape 4) og etabler de manglende statekæder (R2-F03, etape 10)

### R2-F01 — Indsæt dags dato fejler på fem sider

**Lokation:** `Forsoergertab.tsx:121`, `RenteberegningTab.tsx:204`, `MenberegningTab.tsx:275`,
`EetOplysningerTab.tsx:98`, `EoSagsinfoSection.tsx:110`; `fieldEditorEngine.ts:125-130`;
`inputReducer.ts:294-299`  
**Problem:** Alle fem datoknapper kalder `commitImmediate(today)`. Editor-controlleren bygger
`setImmediateField`, men reduceren tillader commanden kun for choice/toggle; datofelter er text-controls.  
**Evidens:** Direkte kald af `reduceInputCommand(...setImmediateField(forsoergertabBeregningsdatoField...))`
returnerede `InputReducer: setImmediateField er kun tilladt for choice/toggle`.  
**Angrebet der fandt det:** Den brede capability og parallelle inputvej.  
**Konsekvens:** Klik på “Indsæt dags dato” kaster i stedet for at indsætte datoen på fem flader.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** `FieldEditorController<T>` eksponerer en command, som ikke er lovlig for alle `T`.  
**Overvejelse:** Immediate-undtagelsen skal forblive snæver; knappen er en eksplicit afslutningshandling.  
**Anbefaling:** Send knapværdien gennem editorens canonical settle-vej.  
**Forslag til løsning:** Tilføj en typed settle-handling til handlingsknapper og en fælles kontrakttest for
alle fem callsites.  
**Kræver godkendelse:** Nej — det genskaber knappens dokumenterede hensigt.  
**Status:** **Rettet 2026-07-28** (etape 2, sammen med UT-F05 — samme fund fra to vinkler).
`FieldEditorController.settleValue()` er den ene programmatiske afslutningskommando; den går gennem
editorens normale settle-vej med feltets eget codec. Alle fem callsites migreret samlet; reducerens
fail-fast-guard bevaret. Dækning: fælles tabeldrevet kontrakttest over alle fem flader + 7 controllertests +
AST-reglen `input/programmatic-commit-uses-settle`. Fuld løsningsbeskrivelse og mutationsbevis står under
UT-F05 i [draft-commit-brugertestfund](../draft-commit-brugertestfund.md#ut-f05--dags-dato-knappen-sender-en-ulovlig-immediate-kommando).

### R2-F02 — Kontrakt og kode er uenige om skjulte canonical fejl

**Lokation:** `src/contracts/form-contract.md:207-208`; design §1.9/§3.6;
`src/inputCore/inputReducer.ts:286-320`; `inputCore.test.ts:242-294`;
`dispatchInput.test.ts:542-559`  
**Problem:** Den højere prioriterede kontrakt siger, at canonical skjulte værdier aldrig ryddes implicit.
Design, reducer og tests rydder derimod en canonical bounds-/range-fejl, når et styrende valg gør feltet
irrelevant.  
**Evidens:** De modsatte normative sætninger og tests, der pinner den implementerede rydning.  
**Angrebet der fandt det:** Normativ regel mod faktisk command-sekvens.  
**Konsekvens:** Systemet har to autoritative svar på, om en fejlende skjult værdi slettes og kan vises igen.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Kontraktdrift, ikke et lokalt reducerproblem.  
**Overvejelse:** Design og implementering er indbyrdes konsistente; kontraktteksten fremstår stale.  
**Anbefaling:** Bring kontrakten i sync med den allerede implementerede §1.9-regel.  
**Forslag til løsning:** Opdatér form-kontrakten og dens coverage-test; ændr kun runtime efter særskilt
UI/UX-godkendelse.  
**Kræver godkendelse:** Nej ved ren kontraktsynkronisering.  
**Status:** Parkeret

### R2-F03 — Obligatoriske statekæder er ufuldstændigt dækket

**Lokation:** `draft-commit-greenfield-design.md:812-823`; repræsentativt
`src/__tests__/inputCore/inputCore.test.ts:391-421`  
**Problem:** De obligatoriske kæder `ugyldig X → ugyldig Y → undo → redo`, `gyldig A → tom → undo → redo`,
`gyldig A → bounds-fejl B → undo → redo` og `skjult gyldig A → vis igen` findes ikke med alle krævede
assertions. Eksisterende tests dækker dele af kæderne i adskilte lag.  
**Evidens:** Repo-/AST-søgning fandt `ugyldig X → ugyldig Y` uden undo/redo og enkelte andre kæder,
men ingen samlet assertion pr. trin af canonical, rejected, visning, issue, consumer, `.eo`-gate,
dokumentgate, revision og history.  
**Angrebet der fandt det:** Værnet skal kunne fejle på hele invarianten.  
**Konsekvens:** En tværlagsregression kan bestå, selv om alle lokale tests er grønne.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Trust-kritisk acceptdækningshul.  
**Overvejelse:** Flere små tests erstatter ikke det obligatoriske state-transition-bevis.  
**Anbefaling:** Én tabeldrevet end-to-end statekædesuite mod rigtig runner/editor/evaluering.  
**Forslag til løsning:** Hævd alle dimensioner ved hvert trin for samtlige §7.2-kæder.  
**Kræver godkendelse:** Nej  
**Status:** Parkeret

## Efterprøvet uden fund

- Produktions-dispatch går kun gennem `inputRuntimeContext.tsx`; rå settle-parsing er infrastrukturlokal.
- Form og grid bruger samme editor; placeholder-promotion er den eneste grid-specifikke command-variant.
- XOR håndhæves ved reducerwrite og envelopevalidering.
- Escape lukker synkront før blur; samme-task Escape→blur er testet.
- Placeholder-promotion er én `settleFieldInNewRow`-command og overlever reload.
- Ingen værdibærende lukket felt-/cellekopi blev fundet; `useCollectionRows` cacher kun immutable række-id’er.
- `components/inputs/transient/` er ikke persisteret sagsinput.

## Fasekonklusion

Kernemodellen, XOR og de primære form/grid-veje er efterprøvet, men fasens exitkriterier er ikke opfyldt,
før de tre fund er håndteret.
