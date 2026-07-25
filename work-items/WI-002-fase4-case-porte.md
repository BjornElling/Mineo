# WI-002: Fase 4 — `.eo`/session/caseporte og greenfield-shell-cutover

- **Status:** `lukket` — Fase 4 er fuldt gennemført, inklusive trin 13.

  **LÆS DETTE FØRST (2026-07-25).** Dokumentets brødtekst nedenfor er historik fra planlægnings- og
  udførelsesforløbet og indeholder derfor udsagn, der IKKE længere er sande — især påstande om, at
  trin-13-sletningerne er udskudt til Fase 5, og om "resterende Fase-4-arbejde". Den autoritative slutstatus er:

  - Arbejdstrin 1–13 er gennemført. Hele den parallelle legacy-inputklynge er SLETTET (ikke udskudt):
    `FormPersistenceContext*`, `inputRuntimeStore`/`formPersistenceStore`/read-model, den gamle
    `inputTransactionRunner`, `criticalActions/`, `rowDrafts/`, `hooks/tableInput/`, `components/inputs/table/`,
    `hooks/fieldState/`, `useDraftField`/`useStyledFieldAdapter`/`useTwoStageInputActivation`,
    `useFormFieldErrors`, `types/fieldErrors`, `utils/saveBlockedFocus` og de otte `Styled*Field`-komponenter.
  - Den reachability-begrundelse, der tidligere udskød sletningen, holdt ikke: de resterende callsites var en
    DEV-only showcase-fane (`StamdataTestTab`, nu slettet) plus tre transiente flader, som nu kører på
    `components/inputs/transient/` uden for den autoritative inputtilstand.
  - Fund #3 (§3.10 global-store vs. binding) er LUKKET her, ikke udskudt til Fase 6: bindingen eksponerer sin
    `store`, og `useCaseOperations` læser gennem den.
  - Et opfølgende Codex sol/high-review (2026-07-25) fandt yderligere 9 strukturelle fund (F1–F9); alle er
    implementeret. Se `docs/reviews/codex-fase34-review.md` og `docs/reviews/codex-fase34-followup.md`.
  - **Alle fire gates grønne**; fuld produktsuite grøn (488 filer / 5991 tests — færre end de tidligere
    533/6440, fordi ~40 implementeringstestfiler er slettet sammen med den legacy, de testede).
- **Oprettet:** 2026-07-24
- **Slice/scope:** Greenfield draft/commit, Fase 4 (§8): `.eo`-save/load/apply/preflight, reset/`Slet alt`,
  session-/startupstatus, kritiske sagsoperationer og app-shell-cutover væk fra `FormPersistenceContext`.
- **Kilde:** Brugerønske ("gennemfør fase 4") + verificeret kortlægning (Explore-agent + egen kodelæsning).
- **Risikoklasse:** **H** — save/load/session, delt state/runtime, dokumentgate-tilstødende, hel-sags-replacement.
- **Baseline:** HEAD `d1d0ef97` på branch `greenfield`; working tree rent. Ingen fremmede ændringer.

## Scope

Kortlægningen bekræfter: greenfield-inputruntime er allerede monteret i produktion (`main.tsx` →
`bootstrapProductionInputRuntime` → `ProductionInputRuntimeProvider`), `slimInputStore`/`initializeInputRuntime`/
`CriticalActionCoordinator` (greenfield) findes, og `projectEoSave` er implementeret men **ikke wired**. Shellen er
"bevidst brudt": `MainLayout` kalder stadig `useFormPersistence()` (kaster uden provider) og den **legacy**
`criticalActions/*`-coordinator + `useFileSaveLoad` (bygger save-snapshot via `getPersistedData`, apply via
`replaceAllPersistedData`).

**Inde i scope (denne tranche — én ikke-deploybar cutover, §5.1):**

1. **`CaseFileOperations`-port** (`src/persistence/caseFileOperations.ts`): ejer `.eo`-save (via `projectEoSave` +
   `encodeEoFile`), preflight/load/apply og `hasAnyData` over reader-/replacement-grænserne. Save følger §3.9:
   settle → frisk `EvaluationSourceToken` → `projectEoSave` (blokér på rejected) → skriv fil. Load/apply routes
   gennem én replacement-command på `slimInputStore` (ikke legacy `replaceAllPersistedData`). Tolerant `.eo`-preflight
   og codec bevares uændret (§4.1).
2. **`CaseResetOperations`-port** (`src/persistence/caseResetOperations.ts`): reset + `Slet alt` gennem
   `criticalActions.applyReplacement`/`applyDestructive` (no-settle, kassér draft kun ved succes, §1.4/§7) og recovery
   fra `writesBlocked` current-session.
3. **Startup-/systemnotice-wiring**: `bootstrapProductionInputRuntime().startup.notice` føres til den eksisterende
   Overlay-/notice-overflade i shellen; brugerrettede operationsfejl (save/load) vises samme sted.
4. **Shell-cutover**: `MainLayout` + `useFileSaveLoad` + `usePwaLaunchQueue` + undo/redo-shortcuts + unsaved-guard
   rewires til greenfield-runtime (binding + greenfield `CriticalActionCoordinator` + de nye porte). Legacy
   `CriticalActionProvider` fjernes fra shellen; greenfield-coordinatoren fra bindingen bruges.
5. **Slet dead-by-cutover legacy.** REVIDERET efter reachability-audit: sletbarhed er GATET på MainLayout-rewiren
   (trin 4). Fordi `App.tsx` monterer `MainLayout`, som value-importerer hele legacy-stakken, bliver et sæt filer
   først uåelige NÅR MainLayout ikke længere importerer dem. Efter trin 4 er følgende bevist uden tilbageværende
   produktionsforbrugere (Mineo-shell ELLER standalone) og slettes:
   - `hooks/useFileSaveLoad.ts` (legacy — erstattet af greenfield-rewrite),
   - `hooks/useUndoRedoShortcuts.ts` + `hooks/useUndoRedo.ts` (erstattet af `useGreenfieldUndoRedoShortcuts` + fokus),
   - `stores/undoRedoStore.ts` (død read-facade; prod-undo gik via `inputRuntimeStore` direkte),
   - `contexts/FormPersistenceContext.tsx` (Provideren — nul prod-mounter),
   - `persistence/persistenceRuntime.ts`, `persistence/inputSessionMigration.ts`, `utils/persistenceSessionHydration.ts`
     (legacy bootstrap/browser-session-migration, §4.3 — kun reachable via Provideren),
   - den døde klynge `components/tables/useRentekravRows.ts`, `rowDrafts/useSliceRowDrafts.ts`,
     `components/tables/gridCore/useGridRowPersistenceCore.ts` + `hooks/usePersistedForm.ts` (samlet — nul value-callsites),
   - de rene implementeringstests, der kun beskytter de afløste mekanismer (§4.3).

**Bevidst UDEN for scope (Fase 5) — MÅ IKKE slettes i Fase 4 (bevist stadig reachable):**

- **Standalone grid-flade** (`minprocesrenteMain` → `useGridCoreController` → `useTableInputCore`) holder følgende live:
  `criticalActions/*` (CriticalActionContext/coordinator/focusTarget), `hooks/tableInput/useTableInputCore.ts`,
  `useFormPersistenceSelectors.ts`, `stores/formPersistenceStore.ts`, `stores/formPersistenceReadModel.ts`,
  `stores/inputRuntimeStore.ts`, `useCellInvalidDraftChannel.ts`, `FormPersistenceContext.internal.ts`.
- **De 4 Styled*Field-flader** (Mineo EO/Stamdata: `OffentligeYdelserTab`, `ContentBoxReportDialog`, `StamdataTestTab`,
  `LoentrinFinderOverlay`) holder desuden live: `useDraftField.ts`, `useDraftLifecycle`, `useStyledFieldAdapter.ts`,
  `Styled*Field.tsx`, `useFormFieldErrors.ts` (via context-fri `useFieldInvalidDraftChannel`), `useFormPersistence.ts`
  (importeret af det overlevende `useFormFieldErrors`), `fieldErrors.ts`, `input/inputTransactionRunner.ts`,
  `input/legacyInputCompatibility.ts`, `input/legacyGridTransactionBridge.ts`.
- Codex-H bekræftede: fjernelse af `FormPersistenceProvider` giver INGEN crash/datatab på de 4 flader (allerede ubundne).
- De 18 dokumentoutputs (Fase 5).

## Autoritativt grundlag

- `docs/architecture/draft-commit-greenfield-design.md` §1.4/§1.12, §3.7, §3.9, §3.10, §4.1–4.3, §5.1–5.4, §8 Fase 4.
- `src/contracts/critical-action-contract.md` §5 (tokenfriskhed), §6 (grænser), §7 (reset/Slet alt/load uden settle).
- `src/contracts/app-shell-contract.md` §2.1 (én aktiv runtime; ingen dual-provider).
- Byggesten: `eoSaveProjection.ts` (`projectEoSave`), `criticalActionCoordinator.ts` (greenfield),
  `slimInputStore.ts`, `initializeInputRuntime.ts`, `inputRuntimeContext.tsx` (`InputRuntimeBinding`).
- Adfærdsorakel (bevar uændret adfærd, §4.1): legacy `useFileSaveLoad.ts`, `fileSave.ts`/`fileLoad.ts`,
  `persistenceLoadApply.ts`, `eoFileCodec.ts`, preflight-dialogerne i `MainLayout`.

## Invarianter (må ikke brydes)

- **§5.4:** ingen ændring i beregningstal, dokumentindhold eller synlig adfærd ud over §1/eksisterende kontrakter.
- **§3.9/§1.6:** `.eo`-save blokeres KUN af aktivt relevant rejected råinput; canonical bounds/rule-fejl kan gemmes.
- **§1.4/§7:** load/reset/`Slet alt` gennemføres uden settle; draft kasseres kun ved succes; annullering bevarer alt.
- **§5:** save/download evaluerer mod et FRISK `EvaluationSourceToken`; genlæs efter async-grænse, fail-closed.
- **§3.10:** ingen port eksponerer både reads, raw writes, notices og persistence; ingen dual-runtime.
- **§1.12:** current-session-korruption bevarer rå envelope, blokerer normale writes, kun `Slet alt` rydder.
- Strøm save→load round-trip for schema-gyldigt brugerinput bevares byte-verificeret.

## Parallel / duplikeret logik

- **Fund:** to komplette input-runtimes (legacy `inputRuntimeStore`+`FormPersistenceContext` vs. greenfield
  `slimInputStore`+binding) og to `CriticalActionCoordinator`-implementeringer.
- **Beslutning:** greenfield er målarkitekturen; legacy-runtime slettes i denne tranche (den er ikke længere en
  sammenlignings-/ansvarsbærer efter portene er bygget). Legacy-coordinatoren slettes; shellen bruger greenfield-
  coordinatoren fra bindingen.
- **Begrundelse:** §5.1 forbyder dual-runtime; legacy-runtime har ingen tilbageværende ansvar efter porte + wiring.

## Acceptance criteria

- [x] `.eo`-save går gennem `projectEoSave` (via `ops.file.evaluateSave()`); blokeres kun af rejected input; canonical
      bounds-fejl kan gemmes. (`useFileSaveLoad.handleGem`.)
- [x] Load/reset/`Slet alt` routes gennem greenfield-coordinator + replacement-command; no-settle; draft kun kasseret
      ved succes; annullering/apply-fejl bevarer afsluttet input + draft. (`applyReplacement`/`clearAll` + `force`-write.)
- [x] Startup-notice (korruption/utilgængeligt lager) vises i shellens notice-overflade via
      `bootstrapProductionInputRuntime().startup.notice`; `writesBlocked` recovery via `Slet alt` bevist i port-test.
- [x] `MainLayout` render'er uden `FormPersistenceContext`; ingen `useFormPersistence()`-callsite tilbage i produktion.
      **Bevist:** `App.defaultLandingRoute.test` mounter hele App'en uden crash (mellemtilstands-crash ophævet).
- [x] Legacy-stakken i sletteliste-punkt 5 er slettet (11 prod-filer + den dead-by-cutover `getFirstBlockingInputError-
      Target`); app-`tsc` clean, ingen dinglende produktionsimport.
- [x] De 4 `Styled*Field`-flader fungerer fortsat (tabel-/tableInput-suiter 144/144; standalone 3/3 grønne).
- [x] Fase-4-testmatrix: alle 8 shell-tests konverteret fra legacy-provider til greenfield-runtime (86 tests grønne;
      ny delt `OpenGreenfieldEditor`-helm i det greenfield `activeEditorRegistry`). §1.4-semantik-ændringer bekræftet:
      load blokeres ALDRIG af åben editor (replace-policy) og hævder nu at load GENNEMFØRES. Nye enheds-/port-tests
      grønne: `greenfieldSaveBlockedFocus` (5), `caseFileOperations`/`caseResetOperations` (10), `persistenceLoadApply`
      (migreret til `applySnapshot`), `saveBlockedFocus` (11).
- [x] `/verify`-skill-flade kørt: hele App'en mounter og router uden shell-crash; migrerede slices kører gennem
      produktions-runtime (integration-suiter 9/9). **Fuld produktsuite: 529/529 filer, 6416/6416 tests grønne.**

## Godkendelsesgate

- **Påkrævet:** nej. Rent teknisk cutover; ingen ændring i synlig UI/UX (samme knapper, dialoger, overlays) eller
  beregningstal/-regler (§5.4 håndhæves; adfærd spejler legacy-orakel). Store, ikke-deploybare klasse-H-cutovers
  kræver ikke godkendelse (jf. `/greenfield` §2 og [[feedback_user_decides_only_uiux_calc]]).
- **Status og beslutning:** godkendelse ikke påkrævet → `klar` → `under-implementering`.

## Verifikation

- **Plan:** målrettede persistence-/save-load-/startup-suiter + fase-4-matrix for de nye porte; `npm run typecheck`
  + `typecheck:test` + `lint` for callsite-cutover; `/verify`-skill; Codex-H slutreview.
- **Resultat (Fase 4 afsluttet og slutverificeret 2026-07-24):**
  - `npm run typecheck` → **0 fejl** (hele appen kompilerer OG mounter nu; mellemtilstands-shell-crash ophævet).
  - `npm run typecheck:test` → **0 fejl** (den tidligere `caseFileOperations.test.ts` `FieldDescriptor`-klash er rettet
    ved at type `settle`-helperen med `RuntimeInputCommand` fra runtime-modulet — se fund #1; ingen prod-kode rørt).
  - `npm run lint` → **0 warnings**. `npm run verify:ledgers` → **OK** (239/16/8/4/18 uændret).
  - **Fuld produktsuite `npx vitest run` → 533/533 filer, 6440/6440 tests grønne** (inkl. de 8 konverterede shell-
    tests, port-suiter 10/10, kontrakt-dæknings-matrix retargetet til greenfield-suiter, korruptionsflow-suiter).
  - `App.defaultLandingRoute.test` mounter hele App'en og router på begge start-settings uden `FormPersistenceContext`-
    crash — det stærkeste bevis for at shell-cutoveren er komplet.
  - Current-session-korruptionsflowet (trin 12 / §1.12) er bevist end-to-end i `dispatchInput.test.ts` (fail-closed
    hydration + `writesBlocked` + `Slet alt`-recovery) og `caseResetOperations.test.ts` (writesBlocked-recovery).

## Review-fund (udfyldes i review-fasen)

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
| 0 | Er fjernelse af `FormPersistenceProvider` tabsfrit for de 4 `Styled*Field`-flader? **Codex-H bekræftede:** INGEN crash, INTET nyt sagsdatatab. Alle 4 flader er allerede ubundne (lokal `useState` + context-fri `useFieldInvalidDraftChannel`/`useInvalidDraftSlot`-fallback). Manglende legacy `CriticalActionProvider` er også no-op. Fejlende råtekst bevares lokalt indtil unmount/F5 = eksisterende adfærd. | H | bekræftet: tabsfrit | afsluttet |
| 0c | **Codex-H korrektion (Q3b):** min port læste rå `.sections` via `countFilledFields` → MISSER rejected-only input → load kunne overskrive afsluttet fejlende input uden overwrite-bekræftelse. **Rettet:** `settledInputHasAnyData` = canonical-meningsfuld ELLER `rejectedInputs` ikke-tom; ny test dækker rejected-only=true. | H | rettet i caseFileOperations.ts | afsluttet |
| 0d | **Codex-H korrektion (delete-list):** `criticalActions/*` er reachable fra STANDALONE via `useGridCoreController`→`StandardLooseTable`→`BeregnetRenteTable`→`RenteberegningTab` → MÅ IKKE slettes i Fase 4 (Fase 5). `formPersistenceStore`/`formPersistenceReadModel`/`inputRuntimeStore` er reachable fra de 4 Styled*Field-flader via `useDraftField`→`useFormPersistenceSelectors` → BEVARES til Fase 5. Reporter-hooks (`useFormFieldErrorReporter` m.fl.) og `usePersistedForm`-HOOKEN har nul produktions-value-callsites → sletbare. | H | delete-list revideret; reachability-audit gennemført; dead-by-cutover slettet, reachable rest udskudt til Fase 5 | afsluttet |
| 0b | Q5 standalone-imports af sletteliste: **afklaret selv** — `minprocesrenteMain.tsx` + `MinProcesrenteCalculatorPage` bruger ALLEREDE greenfield (`bootstrapProductionInputRuntime`, `useGreenfieldUndoRedoShortcuts`); nul imports af `undoRedoStore`/`criticalActions/*`/`inputRuntimeStore`/`FormPersistence*`. App-shell-kontrakt §2.1's "standalone beholder legacy" er STALE. Sletteliste blokeres ikke af standalone. | H | afvist som blokering med evidens | afsluttet |
| 1 | **Codex sol/high slutreview:** `caseFileOperations.test.ts` nominal `FieldDescriptor`-klash rettet (generisk `settle`-helper typet med `RuntimeInputCommand` fra runtime-modulet; ingen prod-kode rørt) → `typecheck:test` grøn. | Lav | rettet af Codex sol/high | afsluttet |
| 2 | **Codex sol/high slutreview (Høj):** `useGreenfieldUndoRedoShortcuts` mangler legacy'ens lokationsbaserede undo/redo-restore (navigér til origin-side + fane + fokusér ændret felt) → §5.4-regression. **Disposition:** Codex sol/high besluttede fuld parity (option B); spundet ud som selvstændigt WI-003 (fundament bygget i denne omgang, long tail dokumenteret). | H | spundet ud til [[WI-003-undo-redo-lokationsrestore]] | overført |
| 3 | **Codex sol/high slutreview (Middel):** `useCaseOperations` læser global `slimInputStore` mens writes/coordinator kommer fra bindingen — ingen aktiv bug (samme singleton i prod), men latent §3.10-inkonsistens hvis en anden binding introduceres. | M | noteret; strammes i Fase 6 (grænsehåndhævelse) | åben |

## Resterende / risici

**Resterende Fase-4-arbejde (næste omgang — genoptag med `/greenfield work-items/WI-002-fase4-case-porte.md`):**

1. **Greenfield save-blocking focus-targeter**: udled `BlockingInputErrorTarget` fra rejected `SerializedFieldAddress`
   (`address.section` = pageKey). Genbrug DOM-/tab-routingen i `saveBlockedFocus.ts` — men greenfield-felter sætter
   IKKE `data-mineo-field-path`, så brug `.Mui-error`/besked-fallbacket (`findFirstVisibleErrorElement`) + tab-routing
   fra sektionen. Mål: bevar den eksisterende save-blocked-fokus-UX uændret (§5.4), ikke ny adfærd.
2. **Skriv `useFileSaveLoad` om** mod greenfield-portene (`useCaseOperations`) + greenfield-coordinatoren. Behold det
   PUBLIC interface (så `MainLayout`/`usePwaLaunchQueue`/dialoger er uændrede). Håndtér coordinator-kontraktforskellen:
   greenfield `prepare` returnerer `committed{token}|noop|blocked{settle-failed}` UDEN `focusTargetBeforeAction` og
   UDEN block-policy (load/navigate settler nu i stedet for at blokere, rebased §1.4). Fang fokus-før-handling i
   use-casen selv (`document.activeElement`). Save = `prepare('save')` → `ops.file.evaluateSave()` (blocked ⇒ vis fejl
   + fokusér blokerende felt) → `saveToFile(snapshot, dir)` → `markSaved(saveToken.inputRevision)`. Load-apply =
   `ops.file.applyLoadedSnapshot` inde i `coordinator.applyReplacement` + genbrug `executePersistenceLoadApply`s
   metadata/handle/PWA-synk (generaliser dens `replaceAllPersistedData`-param til `applySnapshot`).
3. **Rewire `MainLayout`**: fjern `useFormPersistence`/`useFormPersistenceSelectors`/legacy `CriticalActionProvider`;
   brug greenfield-coordinatoren fra bindingen, `useGreenfieldUndoRedoShortcuts` (udvid med lokationsbaseret
   fokusrestore for multi-side-hovedappen — history bærer fokus-origin, §3.7), startup-notice fra
   `bootstrapProductionInputRuntime().startup` ind i Overlay-overfladen, og revision-remap til unsaved-guard
   (`combinedSectionRevision→slimInputStore.revision`, `authoritativeSnapshotEpoch→replacementGeneration`,
   `markSaved→saveToken.inputRevision`; `settingsRevision` UDEN for baselinen — Codex Q4).
4. **Slet dead-by-cutover-legacy** (scope §5) + migrér/slet de rene implementeringstests. Compilerfejl = migrationsliste.
5. **Gates**: fase-4-testmatrix, `/verify`, fuld typecheck/lint (så vidt muligt i mellemtilstanden), Codex-H slutreview.

**Bevares bevidst til Fase 5** (reachability-bevist, se Scope): store-laget (`inputRuntimeStore`,
`formPersistenceStore`, `formPersistenceReadModel`, `useFormPersistenceSelectors`), `criticalActions/*`,
`useTableInputCore`, `FormPersistenceContext.internal`, `useCellInvalidDraftChannel`, hele Styled*Field-vejen
(`useDraftField`/`useStyledFieldAdapter`/`Styled*Field`/`useFormFieldErrors`/`useFormPersistence`/`fieldErrors.ts`),
`inputTransactionRunner` + `input/legacy*`, plus de 4 ikke-migrerede flader + 18 dokumentoutputs.

**Risici:** suiten forbliver bevidst rød i mellemtilstanden efter shell-cutoveren (§5.1); kun modulgrænse-rene suiter
køres grønt. Ved genoptag: kontrollér `/verify`s kendte mellemtilstand mod den aktuelle plan/kode først.
