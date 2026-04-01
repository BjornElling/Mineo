# Arkitekturoprydning — Plan og Status

Oprettet: 2026-04-01  
Baseret på eksternt arkitekturreview af Mineo-kodebasen.

---

## Min vurdering af reviewets fund

| Fund | Severity | Min holdning | Handling |
|------|----------|-------------|---------|
| F1: EO flad struktur (65 filer) | Kritisk | **Enig** — men 65 filer, ikke 67. Submappeforslag er fornuftigt. | Stadie 3 |
| F2: eoPdfReguleringEngine/Loenudvikling misnavngivet | Kritisk | **Delvist enig** — filerne indeholder reel beregningslogik, ikke kun PDF. Navnene er misvisende. Brugeren ønsker fuld split. | Stadie 3 |
| F3: eoLoenindkomstInputErrorStore parallelt fejlsystem | Høj | **Enig** — udvid kanonisk system til dynamiske rækkenøgler. | Stadie 4 |
| F4: Side-effect import cleanup-registrering | Høj | **Enig** — gør registreringen eksplicit. | Stadie 4 |
| F5: usePersistedSection i 9 komponenter | Høj | **Allerede løst** — kun testfilen importerer den. Slet hook + test. | Stadie 1 |
| F6: Tre persistens-adgangslag | Medium | **Delvist enig** — dokumentér i AGENTS.md, men ESLint-regel er overkill. | Stadie 1 |
| F7: MainLayout gudkomponent | Høj | **Enig** — udtræk hooks. | Stadie 2 |
| F8: Devtools i produktionsbundtet | Medium | **Delvist enig** — lazy-load BatchReviewPanel/debug-tab. devtoolsMonitor forbliver. | Stadie 5 |
| F9: PDF-lag spredt | Medium | **Enig** — konsolidér i ny `src/pdf/` top-level mappe. | Stadie 5 |
| F10: GridCore over-fragmenteret | Medium | **Uenig** — 12 filer med klare ansvarsområder er passende. **Springes over.** | — |
| F11: Utils 120+ filer | Medium | **Delvist enig** — 58 filer (ikke 120+). Tilføj subdirs for date/, number/, file/. | Stadie 5 |

---

## Stadie 1: Slet død kode + dokumentér mønstre ✅ FÆRDIG

### 1.1 Slet usePersistedSection ✅
- Slet `src/hooks/usePersistedSection.ts`
- Slet `src/__tests__/hooks/usePersistedSection.test.tsx`
- Verificér med grep at ingen andre filer importerer den

### 1.2 Dokumentér persistens-adgangsniveauer i AGENTS.md ✅
Tilføj sektion der beskriver:
- **Læs (al kode):** `usePersistedSectionSelector` fra `hooks/useFormPersistenceSelectors`
- **Rediger (sidekomponenter):** `usePersistedForm` — formular-binding med commitOnBlur
- **System-operationer (kun MainLayout/persistence-lag):** `useFormPersistence()` context direkte

### 1.3 Undersøg FormPersistenceContext.shared.ts ✅
- Check om `.shared.ts`-splittet er nødvendigt i nuværende TypeScript/Vite-konfiguration
- **Konklusion:** Splittet er legitimt — testfiler importerer context-typen direkte. Bevares.

### 1.4 Opdatér form-contract.md ✅
- Tilføjet afsnit §6.4 der klart beskriver hvornår man bruger `useDraftField` vs `useRowDrafts`

**Verifikation:** `npm test` — 287 testfiler, 3744 tests passerer.

---

## Stadie 2: Udtræk MainLayout-ansvar til hooks ✅ FÆRDIG

### 2.1 Udtræk commitFlush utilities ✅
**Fra:** Top-level funktioner i MainLayout (linjer ~87–216)  
**Til:** `src/utils/commitFlush.ts`

Indeholder: `commitActiveGridEditors`, `commitPendingInputBeforeSave`, `prepareForCriticalDataReplacement`, `waitForCommitFlush`, `waitForAnimationFrame`, `focusElementWithoutScroll`, `restoreFocusIfPossible`, `isOpenTextEditorElement`

### 2.2 Udtræk `useUnsavedChangesGuard()` ✅
**Til:** `src/hooks/useUnsavedChangesGuard.ts`

Indkapsler: revision tracking, `savedRevisionBaseline`, `hasUnsavedChanges`, `beforeunload` event handler, `allowExitWithoutWarning()`

### 2.3 Udtræk `useDevtoolsMonitoring()` ✅
**Til:** `src/hooks/useDevtoolsMonitoring.ts`

Indkapsler: devtools snapshot state, timer management, `startDevtoolsMonitor()` lifecycle, `setDevtoolsRoute()` sync, `buildDevtoolsReportExtras()`

### 2.4 Udtræk `useFileSaveLoad()` ✅
**Til:** `src/hooks/useFileSaveLoad.ts`

Indkapsler:
- `handleGem`, `handleHent`, `handleSletAlt`
- `handleLoadDespiteIssues`, `handleConfirmOverwriteApply`
- `handleHentFromPwaRequest`
- `pendingLoadResult`, `pendingOverwriteApply`, preflight-bugreport-data

### 2.5 Udtræk `usePwaLaunchQueue()` ✅
**Til:** `src/hooks/usePwaLaunchQueue.ts`

Indkapsler:
- PWA launch queue state via refs
- event-listener for `MINEO_PWA_FILE_OPEN_EVENT`
- retry-logik på `/open`
- gating når overwrite-/preflight-dialog er åben

### 2.6 Resultat
MainLayout reduceret fra **1085 → 550 linjer** uden adfærdsændring i save/load-, PWA- og beforeunload-flow.

**Nye filer:**
- `src/utils/commitFlush.ts`
- `src/hooks/useUnsavedChangesGuard.ts`
- `src/hooks/useDevtoolsMonitoring.ts`
- `src/hooks/useFileSaveLoad.ts`
- `src/hooks/usePwaLaunchQueue.ts`

**Verifikation:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` ✅

---

## Stadie 3: Reorganisér EO-domænet ✅ FÆRDIG

### 3.1 Opret submappestruktur ✅
```
src/domain/erstatningsopgoerelse/
  engines/    ✅ 17 filer
  snapshot/   ✅  7 filer
  pdf/        ✅  9 filer
  tables/     ✅  7 filer
  validation/ ✅  6 filer
  helpers/    ✅ 16 filer
```

### 3.2 Flyt filer ✅ (fysisk flytning + import-rettelse)
- **Batch A (engines):** 17 filer flyttet, imports opdateret, TS OK ✅
- **Batch B (snapshot):** 7 filer flyttet, imports opdateret, TS OK ✅
- **Batch C (pdf):** 9 filer flyttet, imports rettede manuelt, TS OK ✅
- **Batch D (tables):** 7 filer flyttet, imports opdateret, tests OK ✅
- **Batch E (validation):** 6 filer flyttet, imports opdateret, tests OK ✅
- **Batch F (helpers):** 16 filer flyttet, imports opdateret, tests OK ✅

### 3.3 Split eoPdfReguleringEngine.ts ✅
- Implementeret kanonisk split som:
  - `src/domain/erstatningsopgoerelse/pdf/eoPdfRegulering.ts`
  - `src/domain/erstatningsopgoerelse/engines/reguleringsBeregning.ts`
- Runtime-imports er flyttet til de nye entrypoints.
- Den gamle rod-fil er bevaret som tynd kompatibilitetsfacade for lav risiko.

### 3.4 Split eoPdfLoenudvikling.ts ✅
- Implementeret kanonisk split som:
  - `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts`
  - `src/domain/erstatningsopgoerelse/pdf/eoPdfLoenudvikling.ts`
- `tafNettoBeregning` og PDF-modeller importerer nu de nye kanoniske filer.
- Den gamle rod-fil er bevaret som tynd kompatibilitetsfacade for lav risiko.

### 3.5 Tilføj index.ts per submappe ✅
- `engines/index.ts`
- `snapshot/index.ts`
- `pdf/index.ts`
- `tables/index.ts`
- `validation/index.ts`
- `helpers/index.ts`

**Bemærkning:** Barrel-filerne eksporterer som modul-navnerum (`export * as ...`) for at undgå eksportkollisioner i et domæne med mange overlappende typenavne.

---

## Stadie 4: Konsolidér fejlsystemet ✅ FÆRDIG I MINIMAL KANONISK FORM

### 4.1 Udvid FieldErrorCache-modellen ✅
**Fil:** `src/stores/formPersistenceStore.ts`

Field error-modellen accepterer nu generiske strengnøgler i sektionen, så dynamiske rækkenøgler som `${rowId}:loenindkomst` kan leve i det kanoniske system uden særstore.

### 4.2 Migrer eoLoenindkomstInputErrorStore-konsumenter ✅
- `useSetEOLoenindkomstInputError()` skriver nu til `setFieldError('erstatningsopgoerelse', \`${id}:loenindkomst\`, 'input', ...)`
- `useEOLoenindkomstInputErrors()` er bevaret som kompatibilitetsadapter, men læser nu fra det kanoniske field-error-cache
- `MainLayout.hasBlockingInputErrors()` læser ikke længere særskilt fra en parallel EO-input-error-store

### 4.3 Fjern cleanup-registrering og side-effect import ✅
- Side-effect importen af `eoCleanupRegistration.ts` er fjernet fra `App.tsx`
- `domainCleanupRegistry` havde ingen resterende legitime brugere efter migreringen og er derfor fjernet helt
- `FormPersistenceContext` bruger nu kun sit eget autoritative rollback/clear-flow

### 4.4 Slet obsolet kode ✅ / adapter bevidst bevaret
- `src/stores/eoLoenindkomstInputErrorStore.ts` er slettet ✅
- `src/domain/erstatningsopgoerelse/eoCleanupRegistration.ts` er slettet ✅
- `src/stores/domainCleanupRegistry.ts` er slettet ✅
- Den gamle dedicated store-test er slettet ✅
- `src/hooks/useEOLoenindkomstInputErrors.ts` er **ikke** slettet:
  den fungerer nu som bevidst kompatibilitetsadapter oven på det kanoniske field-error-system, så ændringsfladen i UI-laget holdes minimal og auditérbar.

### 4.5 Konvergér testlag ✅
- Rollback-tests er omskrevet til at verificere kanoniske field-errors i stedet for den gamle EO-specialstore
- Relevante kvalitets- og importtests er opdateret til den nye mappe-/filstruktur

---

## Stadie 5: Reorganisér utilities og PDF-lag ✅ FÆRDIG

### 5.1 Opret `src/pdf/` top-level mappe ✅
```
src/pdf/
  infrastructure/   # jsPdfAdapter, pdfService, pdfLoader, pdfWriter, pdfConfig, pdfDocumentAdapter
  shared/           # pdfHelpers, pdfTextUtils, pdfFormatUtils, pdfTableRenderer, pdfBrevhoved, pdfOptions
  domains/
    eo/             # EO PDF (fra domain/erstatningsopgoerelse/pdf/ efter Stadie 3)
    eet/
    renteberegning/
    varigemen/
    forsoergertab/
    aarsloen/
    satser/
    kapitalisering/
    krl/
    loebendeYdelser/
    differencekrav/
    tafFordelt/
```

Implementeret som kanonisk top-level API med kompatibilitetsshims tilbage til eksisterende `src/utils/pdf/*`, så vi kunne flytte runtime-imports gradvist og sikkert.

### 5.2 Tilføj subdirectories i `src/utils/` ✅
```
src/utils/
  date/       # dateFormatting, dateInputValidation, dateRangeErrorMessages, dateUtils, insertTodayDate, isoDateHelpers
  number/     # amountInputUtils, expressionAmount, numberParsing, rounding, roundingShortcuts
  file/       # fileHandleStorage, fileHelpers, fileLoad, fileSave, fileSaveInternals, fileSaveTypes, fileSystemAccess
```

Implementeret som kanoniske `index.ts`-entrypoints:
- `src/utils/date/index.ts`
- `src/utils/number/index.ts`
- `src/utils/file/index.ts`

### 5.3 Lazy-load devtools ✅
- `React.lazy()` på `BatchReviewPanel` i `StamdataDebugTab.tsx`
- `React.lazy()` på `StamdataDebugTab` selv
- Wrap i `<Suspense fallback={<CircularProgress />}>`
- `devtoolsMonitor.ts` forbliver eager (den fanger runtime-fejl intentionelt)

### 5.4 Opdatér index.ts-eksporter ✅
- `src/pdf/index.ts`
- `src/pdf/infrastructure/index.ts`
- `src/pdf/shared/index.ts`
- `src/pdf/domains/index.ts`
- `src/pdf/domains/*/index.ts`

---

## Kritisk Review af Implementeringen ✅ LUKKET

### Fund jeg rettede i allerede-påbegyndt arbejde
- **Stage 2 var markeret færdig for tidligt.** MainLayout ejede stadig save/load- og PWA-flow. Det er nu udtrukket til `useFileSaveLoad` og `usePwaLaunchQueue`.
- **EO-splittet var kun halvvejs.** De to misvisende rod-filer var stadig kanoniske. De er nu splittet og flyttet til de nye domænemapper med kompatibilitetsfacader.
- **Manglende barrel-exports.** Alle EO-submapper har nu `index.ts`.
- **Devtools var stadig eager i debug-siden.** `StamdataDebugTab` og `BatchReviewPanel` er nu lazy-loadede.
- **PDF-konsolideringen manglede et sikkert migrationsspor.** `src/pdf/` er nu etableret som kanonisk API, og centrale runtime-imports er flyttet.
- **Testerne dækkede ikke de nye kanoniske entrypoints korrekt.** Spies/mocks på EO-beregning og PDF-download blev opdateret til de faktiske produktionsimports.

### Bevidste afslutningsvalg
- Gamle rod-/legacy-stier for EO og `utils/pdf` er bevaret som tynde kompatibilitetslag for at minimere risiko i en trust-kritisk app.
- `useEOLoenindkomstInputErrors.ts` er bevaret som adapter i stedet for at blive fjernet brutalt; den læser nu udelukkende fra det kanoniske field-error-system.
- `src/pdf` og `src/utils/{date,number,file}` er etableret som kanoniske entrypoints før en eventuel fremtidig fysisk udfasning af alle gamle stier.

## Opsummering

```
Stadie 1 ✅ Færdig
Stadie 2 ✅ Færdig
Stadie 3 ✅ Færdig
Stadie 4 ✅ Færdig i minimal kanonisk form
Stadie 5 ✅ Færdig
```

## Verificeret status pr. 2026-04-01

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅
- Fuld test-suite: **286 testfiler / 3741 tests passerer**
- Build advarer fortsat om stor hoved-chunk, men builden er grøn og debug-tab er nu separat chunket.
