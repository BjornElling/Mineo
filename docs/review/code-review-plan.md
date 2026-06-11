# Review- og refaktoreringsplan — Mineo

> **Formål:** Gennemarbejde hele Mineos kodebase systematisk, **rette alle fund undervejs**, og efterlade en kodebase bygget på ensartede, velstrukturerede principper med en klar rød tråd. Planen er ikke kun et review — den er en arbejdsplan for at hæve hele programmet til den ønskede arkitektur- og kvalitetsstandard (jf. `AGENTS.md`, som er den autoritative kilde til roller, mandat og constraints).

> **Programmets karakter (jf. `AGENTS.md`):** Mineo er en trust-kritisk, 100 % client-side erstatningsberegner. Forkerte beregninger, datatab eller uforudsigelig adfærd er uacceptabelt. Feature-fladen er **låst** — der kommer ingen nye beregningstyper. Reviewet skal derfor favorisere **forenkling og konsolidering** af det eksisterende frem for udvidelsespunkter til hypotetiske features. Stack: TypeScript (strict) · React 19 · Vite 7 · MUI 7 · Zustand 5 · Zod 4 · jsPDF + `docx`.

## Arbejdsprincip: indefra og ud

Planen følger **afhængighedsorden nedefra og op** — det fundamentale først, det konkrete sidst. Hvert hovedpunkt **færdiggøres og rettes fuldt ud**, før det næste påbegyndes, så senere lag altid bygger på et allerede konsolideret fundament:

1. **Kortlæg fundamentet** — kontrakter og arkitektur-dokumentation (gruppe 1). Her fastlægges de principper, resten håndhæves imod. Fejl rettes i kontrakterne selv, hvis de står i vejen for det bedste slutprodukt.
2. **De bærende lag** — persistence (2), schemas (3), domænelogik (4), hjælpefunktioner (5), data (6). Programmets korrekthed afgøres her.
3. **De konkrete udmøntninger** — UI-inputs & grid (7), pages (8), hooks (9), dokument-output PDF+Word (10), config & settings (11) og app-shell & multi-app (12).
4. **Verifikation og helhed** — testkvalitet (13) og tværgående oprydning (14).

**Disciplin:** Et hovedpunkt regnes først som færdigt, når (a) alle fund er rettet eller eksplicit forelagt/parkeret med begrundelse, og (b) relevante tests er kørt grønt. UI/UX- og beregningslogik-ændringer forelægges til godkendelse undervejs (jf. `AGENTS.md`), men resten af punktet kan færdiggøres i mellemtiden.

**To tværgående realiteter planen håndhæver eksplicit, fordi de tidligere blev overset:**
- **Dokument-output er dobbeltkanal.** Programmet genererer både PDF (jsPDF) og Word (`.docx`). Begge kanaler kører gennem **samme format-agnostiske generatorer**, der skriver mod den fælles `PdfWriter`-grænseflade; `createDocxWriter` opfylder samme type og routes via en global generations-kontekst (`documentGenerationContext`). Gruppe 10 dækker **begge** kanaler og deres paritet — ikke kun PDF.
- **Multi-app.** Kodebasen leverer to apps: Mineo (fuld) og standalone MinProcesrente. De deler bootstrap og storage-infrastruktur, men er namespace-isolerede. Gruppe 12 dækker isolationen eksplicit.

---

## Status

✅ **Gruppe 1 (Kontrakter & arkitektur) er færdig** (2026-06-10). Punkterne 1.1–1.7 er gennemgået, fund rettet, og kontraktlandskabet konsolideret: `pdf-contract` + `pdf-layout-contract` er flettet til `document-output-contract` (kanal-neutral data/gate/guards + komposition/writer-API for både PDF og Word), `pdf-architecture.md` omdøbt+udvidet til `document-output-architecture.md`, felt-identitets-API'et har fået normativt hjem i `mineo-field-pattern.md`, `LoginPage` klassificeret i page-component-kontrakten, og `contract-topology.json` + coverage-matrix-test + AGENTS.md synkroniseret (18 → 17 tværgående kontrakter).

✅ **Gruppe 2 (Persistence) er færdig** (2026-06-11). Punkterne 2.1–2.6 er gennemgået og fund rettet: hydrate rydder nu fieldErrors atomisk (§6.3); resolved-error-cache selvinvaliderer på revision; undo/redo-restore ruller nu BÅDE store + historik fail-closed tilbage ved fejl (delt `persistenceStoreRollback.ts`); `undo`/`redo` hærdet mod uncaught exceptions; død debug-/verifikations-/API-overflade fjernet; preflight skelner nu ægte fejl fra harmløs feltoprydning og loader stille (brugergodkendt); session-hydration kasserer ikke længere cleanup ved storage-læsefejl; korrupt-data-guards (arrays) + klar `.eo`-versionsfejl; `any` elimineret i fs-access. Nye tests: invalidDrafts-schema, Zod-unwrap-strip-guard pr. sektion, hydrate-rydder-fejl. **Bevidst ikke implementeret:** `.eo`-dataversion + migrator-dispatch (hypotetisk extension point, jf. §Konvergens — anbefaling dokumenteret i 2.5). **Pre-eksisterende fejl rapporteret:** `MainLayout.pwaConcurrency`-test fejler på ren main (ikke forårsaget af dette arbejde; henvist til 9.3/12). Næste ikke-startede punkt er **3.1**.

**Test-baseline ved start:** Fuld suite grøn — **5020 tests / 421 filer** (seneste kørsel 2026-06-10). Pre-eksisterende `act(...)`-warning i `TableDropdown.gridCore.test.tsx` er kendt og ikke en fejl (testen passerer). Hvert punkt skal efterlade suiten mindst lige så grøn.

### Åbne godkendelsespunkter overført fra tidligere review-arbejde

Følgende ændringer er **allerede committet** af brugeren (behandlet som tilsigtede), men rører beregningslogik eller brugervendt output og blev tidligere forelagt uden endelig bekræftelse. De skal **gen-forelægges og lukkes**, når reviewet når det relevante punkt — ikke glemmes:

1. **Obligatorisk pension (OP) i sygedagpenge-tillæg** → genbesøges i **6.2**. NY beregningsadfærd for indsatte sygedagpenge-rækker fra 2020-01-06. Formlen er verificeret korrekt indvævet; satstal + ikrafttrædelsesdatoer i `sygedagpengeRates.ts` kan kun brugeren bekræfte mod juridisk kilde.
2. **PDF/Word "TAF opreguleret til beregningsår"** → genbesøges i **10.6**. Nyt download-dokument; bekræft indhold/metode/afrunding.
3. **EO-output tre-tilstand (Ja/Nej/Skjul) og afslutningsvalg** → genbesøges i **10.5**. "Skjul" fjerner emnet helt (også fra samlet krav); "Nej" beholder overskrift + "Ingen" + 0 kr.; "Ingen" som afslutningsvalg udelader "Godkendelse"-afsnittet; "én samlet I alt" i forventet indkomst; kommentarfelt i offentlige-ydelser-bilaget.
4. **Indstillinger-siden: "Beregningsteknisk"-boks** → genbesøges i **11.3**. Toggle + dropdown for to device-lokale regulerings-flag flyttet fra EO-schema til `appSettings`.

| Punkt | Navn | Status | Fil |
|---|---|---|---|
| **1 — Kontrakter & arkitektur (kortlægning af fundamentet)** | | | |
| 1.1 | Topologi-maskineri: `contract-topology.json`, `contract-template.md`, `contract-topology-procedure.md` + `contractCoverageMatrix.test.ts` — indbyrdes konsistens og fuld dækning af alle 27 kontraktfiler | ✅ Gennemgået | [1.1-kontrakt-topologi.md](1.1-kontrakt-topologi.md) |
| 1.2 | Tværgående kontrakter A (state/persistence/form): domain-boundary, form, persistence, schema-evolution, mineo-field-pattern, app-settings | ✅ Gennemgået | [1.2-tvaergaaende-kontrakter-a.md](1.2-tvaergaaende-kontrakter-a.md) |
| 1.3 | Tværgående kontrakter B (dato/beløb/periodisering/historik): date, amount, periodisering, undo-redo, snapshot | ✅ Gennemgået | [1.3-tvaergaaende-kontrakter-b.md](1.3-tvaergaaende-kontrakter-b.md) |
| 1.4 | Tværgående kontrakter C (output/fejl/keyboard/shell/auth): error-debug, keyboard-navigation, document-format, document-output (flettet fra pdf + pdf-layout), auth-gate, app-shell | ✅ Gennemgået | [1.4-tvaergaaende-kontrakter-c.md](1.4-tvaergaaende-kontrakter-c.md) |
| 1.5 | Domæne-kontrakter (8): eo-snapshot, eet-snapshot, forsoergertab-snapshot, aarsloen, renteberegning, varigemen, satser, indskudte-loentillaeg | ✅ Gennemgået | [1.5-domaene-kontrakter.md](1.5-domaene-kontrakter.md) |
| 1.6 | Page-component-kontrakten + 7 arkitektur-docs (auth-gate, calculation, date-interval-performance, debug-builder, eo-clamping-pipeline, document-output [omdøbt fra pdf], undo-redo) | ✅ Gennemgået | [1.6-page-component-og-arkitektur-docs.md](1.6-page-component-og-arkitektur-docs.md) |
| 1.7 | Helhedsvurdering af kontraktlandskabet og de arkitektoniske grundprincipper | ✅ Gennemgået | [1.7-helhedsvurdering-kontraktlandskab.md](1.7-helhedsvurdering-kontraktlandskab.md) |
| **2 — Persistence** | | | |
| 2.1 | Persistence-arkitektur: `src/stores/` (formPersistenceStore, undoRedoStore, formPersistenceReadModel), persistenceRegistry, storageManifest + `src/types/` (persistence, fieldErrors, persistenceInvariants) | ✅ Gennemgået | [2.1-persistence-arkitektur.md](2.1-persistence-arkitektur.md) |
| 2.2 | Undo/redo-store og fokus-restore (undoRedoStore, undoFocusTracker, historyTargetRestore, saveBlockedFocus) | ✅ Gennemgået | [2.2-undo-redo-store-og-fokus-restore.md](2.2-undo-redo-store-og-fokus-restore.md) |
| 2.3 | FormPersistenceContext (public/internal/shared), useFormPersistence, selectors + øvrige contexts (Route, Scroll, CellInvalidDraftScope) | ✅ Gennemgået | [2.3-formpersistencecontext.md](2.3-formpersistencecontext.md) |
| 2.4 | Load/apply/sanitering/session-hydration/snapshot-storage + invalidDrafts-recovery (persistenceLoadApply, -Sanitization, -SessionHydration, -SnapshotStorage, invalidDraftsStorage, commitFlush) | ✅ Gennemgået | [2.4-persistence-load-apply-sanitering-hydration.md](2.4-persistence-load-apply-sanitering-hydration.md) |
| 2.5 | Schema-evolution, migrations og versionering (persistenceVersion, schemaFingerprint, fnv1a32, persistenceMigrations, migratePersistedSectionValue) | ✅ Gennemgået | [2.5-schema-evolution-migrations-versionering.md](2.5-schema-evolution-migrations-versionering.md) |
| 2.6 | Fil-I/O: fileSave(+internals/types), fileLoad, encryption, fileSystemAccess, fileHandleStorage, fileHelpers, filePersistenceMetadata, `src/types/fileOperations` | ✅ Gennemgået | [2.6-fil-io-encryption-fs-access.md](2.6-fil-io-encryption-fs-access.md) |
| **3 — Schemas** | | | |
| 3.1 | Schema-fundament: formSchemas-entry, baseSchemas, enumSchemas, amountExpressionSchema, invalidDraftsSchema + `src/types/` (branded, parserSpec, validation, result) | ⬜ Ikke startet | _3.1-schema-fundament.md_ |
| 3.2 | Section-schemas A: stamdata, satser, aarsloen, faellesAarsloen | ⬜ Ikke startet | _3.2-section-schemas-a.md_ |
| 3.3 | Section-schemas B: erstatningsopgoerelse (største), erhvervsevnetab | ⬜ Ikke startet | _3.3-section-schemas-b.md_ |
| 3.4 | Section-schemas C: forsoergertab, renteberegning, varigeMen + eoFileSchema (container/save/load, preflight, forward/backward-tolerance) | ⬜ Ikke startet | _3.4-section-schemas-c-og-eofile.md_ |
| 3.5 | Schema-fingerprint, persistenceRegistry-alignment og save-order-registry (tableSaveOrderRegistry, useRegisterTableSaveOrder) | ⬜ Ikke startet | _3.5-schema-fingerprint-og-save-order-registry.md_ |
| **4 — Domænelogik (beregningskernen)** | | | |
| 4.0 | Opreguleringsmotorer (fundament): `opregulerMedAslAarsloensmaksimum`, `opregulerMedAkkumuleretReguleringssats` (fail-closed `manglendeAar`) | ⬜ Ikke startet | _4.0-opreguleringsmotorer-fundament.md_ |
| 4.1 | Stamdata, satser og policies (stamdataCalculations, satserCalculations, aarsloenPolicy) | ⬜ Ikke startet | _4.1-stamdata-satser-policies.md_ |
| 4.2 | Årsløn: aarsloen + aslEalAarsloen (beregning, validering, periodevisning) | ⬜ Ikke startet | _4.2-aarsloen.md_ |
| 4.3 | EET: EAL, ASL-afgørelser, skæringsdatoer, aldersreduktionsformel, differencekrav, typer | ⬜ Ikke startet | _4.3-eet-kerne-asl-eal-differencekrav.md_ |
| 4.4 | EET: kapitalisering (calc/opslag/presentation), løbende ydelser, mer-erstatning ved forhøjet pensionsalder, regulering-rater, snapshot | ⬜ Ikke startet | _4.4-eet-kapitalisering-loebende-mer-regulering.md_ |
| 4.5 | Forsørgertab: beregning, ASL-ydelser, EAL-krav, snapshot | ⬜ Ikke startet | _4.5-forsoergertab.md_ |
| 4.6 | Varige Mén: motor og beregninger | ⬜ Ikke startet | _4.6-varige-men.md_ |
| 4.7 | Renteberegning: motor, procesrente, principper, validering, tabelmodel | ⬜ Ikke startet | _4.7-renteberegning.md_ |
| 4.8 | EO-engines I: periodiseringsmotor, period-merging/overlap/range-groups, beregningsperiode-TAF-overlap, ferie, arbejdsdage/måneder | ⬜ Ikke startet | _4.8-eo-engines-i-periodisering.md_ |
| 4.9 | EO-engines II: TAF (calculations, engine, netto, per-year, per-year-opreguleret, day-sets, beregningsenhed), forligsgrad, svie/smerte, sygeferiegodtgørelse | ⬜ Ikke startet | _4.9-eo-engines-ii-taf-forligsgrad-svie-smerte.md_ |
| 4.10 | EO-engines III: løn-/ydelsesudvikling og regulering (loenudvikling, offentligeYdelserUdvikling, reguleringCoverage/FormulaUtils/Presentation, overenskomstReguleringShared, indkomstSkadestidspunkt) | ⬜ Ikke startet | _4.10-eo-engines-iii-loenudvikling-regulering.md_ |
| 4.11 | EO: helpers, initial values, row-derived, tabel-modeller, indtaegtPerioder, sygedagpengeInsertRows, midlertidigtEet-injektion | ⬜ Ikke startet | _4.11-eo-helpers-initial-values-tabeller.md_ |
| 4.12 | EO: validation-lag og `erstatningsopgoerelseValidator` (incl. reguleringssats-dækningsvalidering) | ⬜ Ikke startet | _4.12-eo-validation-lag.md_ |
| 4.13 | EO: snapshot, presentation-model, canonical output, invarianter + snapshot→pdf/beregning/debug-projektioner | ⬜ Ikke startet | _4.13-eo-snapshot-presentation-canonical.md_ |
| 4.14 | EO-debug: view-models (core/loen/indkomst/regulation), parity, severity, integrity, navigation, csv, builder-registry | ⬜ Ikke startet | _4.14-eo-debug-viewmodels-parity-severity-navigation.md_ |
| **5 — Hjælpefunktioner** | | | |
| 5.1 | Datohåndtering kerne: isoDate, dateCommit, dateUtils, dateFormatting, isoDateHelpers, dateDraftNormalization/-Commit, date/index | ⬜ Ikke startet | _5.1-datohaandtering-kerne.md_ |
| 5.2 | Datohåndtering validering: dateInputValidation, dateRangeErrorMessages, dateOrderValidation, utcDayMath, periodeBeregning (kanonisk dag-iteration) | ⬜ Ikke startet | _5.2-datohaandtering-validering.md_ |
| 5.3 | SH-dage: beregning og oversigt (shDageBeregning, shDageOversigt) | ⬜ Ikke startet | _5.3-sh-dage.md_ |
| 5.4 | Talbehandling: numberParsing, numberComparison, rounding(+shortcuts), amount-/percentInputUtils, percentDraftCore, expressionAmount, fraction, safeComputation, integerRange, formatUtils | ⬜ Ikke startet | _5.4-talbehandling.md_ |
| 5.5 | Øvrige utils + foundational typer: serialization, typeGuards, zodTypeGuards, nullToUndefinedDeep, zodIssueFormatting, validationFlagMap, tableRows, schemaRowEmpty, tableValidationCommon, rowId, input/clipboard, scroll-helpers, `src/types/` (deepReadonly, calculation, loen, table) | ⬜ Ikke startet | _5.5-oevrige-utils.md_ |
| **6 — Data** | | | |
| 6.1 | Renter og lovbestemte/statistiske rater: interestRates, lovbestemteRates, statistiskeRates, regulatoryRates | ⬜ Ikke startet | _6.1-renter-lovbestemte-statistiske-rater.md_ |
| 6.2 | Folkepension, sygedagpenge (+OP), overenskomst, KRL, ydelsestyper, retsinfo-links, indskudteLoentillaeg | ⬜ Ikke startet | _6.2-folkepension-sygedagpenge-overenskomst-krl-ydelsestyper-retsinfo.md_ |
| 6.3 | Offentlig løn: KL- og RLTN-satser, lookup, typer, import-script | ⬜ Ikke startet | _6.3-offentlig-loen.md_ |
| 6.4 | Kapitalisering: bekendtgørelses-tabeller, kapitaliseringsbekendtgoerelser, forhoejetPensionsalderEvents, table-registry | ⬜ Ikke startet | _6.4-kapitalisering-bekendtgoerelser-pensionsalder.md_ |
| **7 — UI-inputs & grid** | | | |
| 7.1 | StyledField-familien: base, amount, date, integer, percent, fraction, week, year, text(area), dropdown, checkbox, radio, toggle + inputKeyFilters + input-knapper | ⬜ Ikke startet | _7.1-styledfield-familien.md_ |
| 7.2 | Table-inputs og adaptere (inputs/table + hooks/tableInput/adapters), rowDrafts, cell-invalid-draft-channel | ⬜ Ikke startet | _7.2-table-inputs-og-adaptere.md_ |
| 7.3 | Grid-infrastruktur: gridCore (registry, context, navigation, focus, model, ux-spec, styles, utils) + grid-controller-hooks | ⬜ Ikke startet | _7.3-grid-infrastruktur.md_ |
| 7.4 | Tabel-komponenter: standard (display/grid/loose/virtualized) + domæne-tabeller + per-tabel row-hooks | ⬜ Ikke startet | _7.4-tabel-komponenter.md_ |
| **8 — Pages** | | | |
| 8.1 | Page-komponenter: Stamdata (+StamdataDebugTab), Årsløn, Satser, Mineo (forside), Indstillinger, LoginPage | ⬜ Ikke startet | _8.1-page-komponenter-stamdata-aarsloen-satser-mineo-indstillinger.md_ |
| 8.2 | Page-komponenter: Erhvervsevnetab og tab-underkomponenter (Oplysninger, EfterEal, Kapitalisering, LoebendeYdelser, Differencekrav, IssuesBox) | ⬜ Ikke startet | _8.2-page-komponenter-erhvervsevnetab.md_ |
| 8.3 | Page-komponenter: Erstatningsopgørelse-tabs (Loenindkomst, OffentligeYdelser, EOberegning, EOOplysninger) — de to største komponenter i programmet | ⬜ Ikke startet | _8.3-page-komponenter-erstatningsopgoerelse.md_ |
| 8.4 | Page-komponenter: EO-debug-komponenter (EODebug, Tabel, EmploymentSections, LoenSections, RegulationSections, GroupedRows, Rows) | ⬜ Ikke startet | _8.4-page-komponenter-eo-debug.md_ |
| 8.5 | Page-komponenter: Forsørgertab, Varige Mén, Renteberegning, MinProcesrente-calculator | ⬜ Ikke startet | _8.5-page-komponenter-forsoergertab-varigemen-renteberegning-minprocesrente.md_ |
| 8.6 | Layout & UI-skal: MainLayout, StandaloneCalculatorLayout, SideMenu, Container, ContentBox(Frame), ui/, errors/, system/, reports/, common/, shared/ | ⬜ Ikke startet | _8.6-layout-ui-skal.md_ |
| **9 — Hooks** | | | |
| 9.1 | Form-/draft-hooks: usePersistedForm, useDraftField, useFormFieldErrors, useTwoStageInputActivation, useFormPersistenceSelectors/usePersistedSectionSelector, rowDrafts | ⬜ Ikke startet | _9.1-form-draft-hooks.md_ |
| 9.2 | Undo/redo- og persisterings-hooks: useUndoRedo, usePersistedActiveTab, useUnsavedChangesGuard, useScrollToSectionWithRetry, useShakeFlag | ⬜ Ikke startet | _9.2-undo-redo-persisterings-hooks.md_ |
| 9.3 | Fil-/PWA-/devtools-hooks: useFileSaveLoad (krydsref. 2.6), usePwaLaunchQueue, useDevtoolsMonitoring | ⬜ Ikke startet | _9.3-fil-pwa-guard-hooks.md_ |
| 9.4 | Domæne-hooks: useAarsloenBeregning, useAslAarsloenRuleReporter, useAarsloenPdfGates, useOmregningToggle, useMidlertidigtEetInsertSource | ⬜ Ikke startet | _9.4-domaene-hooks.md_ |
| **10 — Dokument-output (PDF + Word)** | | | |
| 10.1 | Dokument-orkestrering & format-routing: `src/document/*` (documentGenerationContext, documentFormat, documentFileName, documentBrand, downloadArtifact), pdfService, `runSelectedDocumentFormat`, `createStandardPdfWriter`, standaloneRentePdfService | ⬜ Ikke startet | _10.1-dokument-orkestrering-format-routing.md_ |
| 10.2 | PDF-infrastruktur: jsPdfAdapter, pdfWriter, pdfLoader, pdfConfig, pdfBrevhovedRenderer, pdfDocumentAdapter | ⬜ Ikke startet | _10.2-pdf-infrastruktur.md_ |
| 10.3 | Word/docx-infrastruktur: docxWriter, docxStyles, docxWatermark, docxTableBridge — opfyldelse af `PdfWriter`-kontrakten, navngivne styles, vandmærke/brevhoved-paritet | ⬜ Ikke startet | _10.3-docx-infrastruktur.md_ |
| 10.4 | Output-shared (bruges af begge kanaler): pdfTableRenderer, pdfHelpers, pdfFormatUtils, pdfTextUtils, pdfBrevhoved, pdfOptions | ⬜ Ikke startet | _10.4-output-shared.md_ |
| 10.5 | Generatorer I (EO-familien): eo (erstatningsopgoerelsePdf + sections), reguleringPdf, differencekrav, eet, kapitalisering, loebendeYdelser | ⬜ Ikke startet | _10.5-generatorer-i-eo-eet.md_ |
| 10.6 | Generatorer II: aarsloen, shDage, satser, varigemen, forsoergertab, renteberegning (+oversigt), tafFordelt (+opreguleret +kravGraf +chart), krl | ⬜ Ikke startet | _10.6-generatorer-ii.md_ |
| 10.7 | Word-output-paritet & duplikerings-afvikling: `src/__tests__/docx/` + `wordContentHarness`; verificér evt. legacy/dublerede PDF-stier (fx `src/domain/erstatningsopgoerelse/pdf/` vs. `src/pdf/`) og afvikl dem | ⬜ Ikke startet | _10.7-word-paritet-og-konsolidering.md_ |
| **11 — Config & settings** | | | |
| 11.1 | Config A: persistenceVersion, dateRanges, version, buildInfo, pageNavigation, scrollToTopConfig, cellInvalidDraftScopes (persistenceRegistry/storageManifest krydsref. 2.1) | ⬜ Ikke startet | _11.1-config-a.md_ |
| 11.2 | Config B: regulatoryRates, indskudteLoentillaeg (krydsref. 6.2), appTheme, tableTheme | ⬜ Ikke startet | _11.2-config-b-rates-theme.md_ |
| 11.3 | Settings & auth: appSettings (schema/parse/storage), AppSettingsContext, AuthGate, auth, authConfig | ⬜ Ikke startet | _11.3-settings-auth.md_ |
| **12 — App-shell & multi-app** | | | |
| 12.1 | App-entry & bootstrap: main.tsx, App.tsx, apps/shared/bootstrapClientApp, apps/mineo/serviceWorkerBootstrap, desktop-only capability-gate, UnsupportedDevicePage | ⬜ Ikke startet | _12.1-app-entry-bootstrap.md_ |
| 12.2 | Standalone MinProcesrente-app: MinProcesrenteApp, minprocesrenteMain, StandaloneErrorBoundary, standaloneStorageNamespace, namespace-isolation | ⬜ Ikke startet | _12.2-standalone-minprocesrente.md_ |
| **13 — Testkvalitet** | | | |
| 13.1 | Testkvalitet: domæneberegninger (årsløn, EET, forsørgertab, varige mén, renteberegning, opreguleringsmotorer) | ⬜ Ikke startet | _13.1-testkvalitet-domaeneberegninger.md_ |
| 13.2 | Testkvalitet: EO-motor, EO-snapshot og EO-debug | ⬜ Ikke startet | _13.2-testkvalitet-eo-motor-snapshot-debug.md_ |
| 13.3 | Testkvalitet: persistence, schema-evolution, fil-round-trip og invalidDrafts-recovery | ⬜ Ikke startet | _13.3-testkvalitet-persistence-schema-evolution-roundtrip.md_ |
| 13.4 | Testkvalitet: quality-/contract-guard-tests, dokument-output (PDF+Word-paritet), grid/keyboard og integrationsdækning | ⬜ Ikke startet | _13.4-testkvalitet-guards-og-integration.md_ |
| **14 — Tværgående helhed** | | | |
| 14.1 | Kontrakt-alignment: `src/contracts/` vs. faktisk implementering (efter alle rettelser) + topology-coverage-matrix verificeret | ⬜ Ikke startet | _14.1-kontrakt-alignment.md_ |
| 14.2 | Tværgående: duplikering, inkonsistente mønstre, dødkode og fil-placering på tværs af hele kodebasen | ⬜ Ikke startet | _14.2-tvaergaaende-duplikering-doedkode.md_ |

---

## Reviewinstruktion

### Formål

Hvert punkt gennemgår den relevante del af Mineo, **retter fundene**, og kontrollerer fire dimensioner:

1. **Kodekvalitet og korrekthed** — Er koden fri for fejl, der kan producere forkerte beregninger, datatab eller inkonsistent tilstand?
2. **Struktur og arkitektur** — Følger koden de etablerede kontrakter og mønstre? Er grænser mellem lag klare og konsistente? Er der én rød tråd, eller løses samme problem på flere måder?
3. **Robusthed over for inputkombinationer** — Crasher eller fejler programmet ved manglende, ugyldige eller usædvanlige kombinationer af brugerinput?
4. **Konvergens** — Er dette punkt bragt på linje med de principper, der blev fastlagt i de tidligere (mere fundamentale) punkter?

Punktet afsluttes med rettelser gennemført og tests kørt. Fund der berører UI/UX eller beregningslogik forelægges til godkendelse, jf. `AGENTS.md`.

---

### Hvad arbejdet skal afdække og rette

#### Korrekthed og determinisme
- Beregninger der afhænger af render-timing, sideeffekter, implicit typecasting, locale, tidszoner eller floating-point-afrunding.
- Invarianter der ikke er håndhævet af typer, Zod-schemas eller tests.
- Stier der kan producere inkonsistente afledte værdier eller partielle state-opdateringer.
- Numerisk logik der afviger fra projektets kanoniske helpers for afrunding, formatering og valuta. Konvergér mod én kanonisk løsning.
- **Fail-closed:** Usikre/ugyldige kritiske data må aldrig give et stille gæt. Verificér at manglende reguleringssatser, manglende kapitaliseringstabeller, manglende år o.l. fejler eksplicit (jf. `manglendeAar` i opreguleringsmotorerne).

#### Crashrisici og inputrobusthed
- Edge cases: tomme felter, `undefined`, `null`, `NaN`, 0, negative tal, fremtidige datoer, datoer udenfor lovlige intervaller.
- Kombinationer af felter der er gyldige hver for sig, men ugyldige sammen (fx dato A efter dato B).
- Manglende guards ved grænser: brugerinput der ikke valideres før beregning, persistence-data der ikke saniteres ved load.
- Array-operationer der antager mindst ét element. Division med 0.

#### Arkitektur og grænser
- Brud på `src/contracts/*.md` og `AGENTS.md`.
- Overcoupling: UI der indeholder beregningslogik; beregningslogik der importerer UI.
- Uklar ejerskab på tværs af moduler.
- Duplikerede sandheder (samme logik to steder, to sources of truth for samme dato eller rente).
- **Form-kerneregel — ingen live preview:** Beregn/validér/vis aldrig afledt feedback fra `onChange`-draft. Commit sker på `onBlur` (forms) og `onPersist` (table-grænse). Kun de tre dokumenterede immediate-commit-undtagelser (delete/backspace på ikke-redigerende celle, valg af dropdown-menupunkt, toggle/radio-aktivering).
- **Runtime data-integritet:** Committed brugerinput må ikke forsvinde, nulstilles eller muteres implicit pga. navigation, re-renders, tab-skift eller intern sync.

#### Type-sikkerhed
- Zod ↔ TypeScript-mismatches ("type lies"). Zod-schemas er **eneste** sandhedskilde for runtime-validering og afledte typer.
- Usikre assertions (`as`, `!`), `any`, implicit narrowing.
- Manglende validering ved domænegrænser. Persisteret brugerinput skal være fuldt dækket af Zod og må ikke kunne eksistere uden for schema-dækning.

#### Save/load (.eo) — trust-kritisk
- Stille datatab er uacceptabelt. Save inkluderer alt brugerindtastet input og kun schema-valideret brugerinput; afledte værdier genberegnes efter load.
- Load er atomisk medmindre brugeren eksplicit accepterer delvis load i preflight.
- Forward/backward-tolerant load: ukendte/fjernede felter må ikke fejle hele loadet; nye manglende felter må ikke blokere eller advare.
- Streng save→load round-trip for brugerinput ved vellykket fejlfrit load.

#### Tests
- Manglende dækning af beregninger, validering, save/load round-trip og edge cases.
- Tests der tester implementeringsdetaljer frem for invarianter. Flakiness og over-mocking.
- Mindst ét top-level `describe('<modul-eller-funktion>')` pr. testfil; ingen flade top-level `it(...)`-filer.

#### Kompleksitet og vedligeholdbarhed
- Unødvendig indirektion og accidental complexity.
- Duplikeret logik, dødkode og ubrugte exports.
- Filer der er for store eller har for mange ansvarsområder (split), eller overlapper i ansvar (konsolidér). **Bemærk særligt:** `LoenindkomstTab.tsx` (~133 KB) og `EOOplysningerTab.tsx` (~124 KB) er ekstremt store og er kandidater til opdeling — vurderes i gruppe 8.

---

### Særlig instruktion til arbejde oven på allerede committet kode

Dele af kodebasen er ændret efter forrige review-runde (bl.a. den samlede opreguleringsmotor, ny "TAF opreguleret til beregningsår"-beregningsform, tre-tilstands-valg Ja/Nej/Skjul, per-ansættelsesforhold lønudviklingsregulering, sygedagpenge-OP, dokument-output i Word). Når et punkt rører kode, hvor en delegering eller motor er indført, skal reviewet **ikke** bare læse koden, men aktivt verificere:

- **Tal-identitet ved delegering:** Når en beregning er omlagt til at kalde en fælles motor (fx EET-EAL, forsørgertab, lønudvikling og TAF-opregulering der alle skal kalde `opreguleringsmotorer.ts`), bevis at outputtet er tal-identisk med det, lokal-logikken producerede — ikke bare "ser rigtigt ud". Ingen dobbelt-sandhed: dækningsvalidering og beregningslag skal kalde samme motor.
- **Fail-closed-konsistens:** Verificér at alle nye fail-closed-stier (manglende satser/år/tabeller) reelt fejler og ikke kan maskeres af et nul-år-skip eller en tom-liste-gren.
- **Adfærds-neutralitet ved perf-/refaktor-løft:** Ændringer der hævder at være neutrale (fx period-iteration, skjul-model på compute-siden) skal have en ækvivalens-test.

De fire **åbne godkendelsespunkter** øverst i Status lukkes, når reviewet rammer 6.2, 10.5, 10.6 og 11.3.

---

### Særlig instruktion til gruppe 1 — kontrakter og arkitektur-dokumentation

Punkterne 1.1–1.7 arbejder ikke med almindelig kode, men med de normative dokumenter i `src/contracts/*.md` (incl. den maskinlæsbare `contract-topology.json`) og de informative `docs/architecture/*.md`. Disse dokumenter er fundamentet, resten håndhæves imod. Derfor kortlægges de **først** — og med bredere optik end den øvrige kode.

**Topologien er autoritativ for rækkefølgen.** `contract-topology.json` klassificerer kontrakterne i fire lag (`domain-specific-contract` → `cross-cutting-contract` → `page-component-contract` → `architecture-document`) med en eksplicit prioritetsorden. Gruppe 1 følger denne klassifikation frem for alfabetisk batching. **Faktisk indhold pr. 2026-06-10 (verificeret mod topology-JSON):**

- **18 tværgående (cross-cutting) kontrakter:** domain-boundary, form, persistence, schema-evolution, keyboard-navigation, error-debug, document-format, pdf, pdf-layout, periodisering, date, mineo-field-pattern, amount, undo-redo, app-settings, **snapshot** (bemærk: topology klassificerer `snapshot-contract.md` som tværgående, ikke domæne), auth-gate, app-shell.
- **8 domæne-kontrakter:** eo-snapshot, eet-snapshot, forsoergertab-snapshot, aarsloen, renteberegning, varigemen, satser, indskudte-loentillaeg.
- **1 page-component-kontrakt** (subordinat til 16 af de tværgående, jf. `subordinateContracts`).
- **7 informative arkitektur-docs:** auth-gate, calculation, date-interval-performance, debug-builder, eo-clamping-pipeline, pdf, undo-redo. Plus authoring-artefakterne `contract-template.md` og `docs/architecture/contract-topology-procedure.md`.

Gruppe 1's underpunkter mapper:
- **1.1** etablerer selve topologi-maskineriet: er `contract-topology.json`, `contract-template.md`, `contract-topology-procedure.md` og `contractCoverageMatrix.test.ts` indbyrdes konsistente, og dækker de faktisk **alle** kontraktfiler i `src/contracts/`? (Coverage-matrix-testen skal fejle, hvis en kontraktfil hverken er klassificeret eller eksplicit undtaget.)
- **1.2–1.4** dækker de 18 tværgående kontrakter, tematisk grupperet (state/persistence/form · dato/beløb/periodisering/historik · output/fejl/keyboard/shell/auth).
- **1.5** dækker de 8 domæne-kontrakter.
- **1.6** dækker page-component-kontrakten plus de 7 arkitektur-docs.
- **1.7** er helhedsvurderingen.

For hvert kontraktdokument besvares to dimensioner:

**Dimension A — Korrekthed og fyldestgørelse (intern konsistens):**
- Er kontraktens regler entydige, modsigelsesfri og operationaliserbare?
- Mangler der dækning af kendte cases (edge cases, fejlhåndtering, tværgående scenarier)?
- Er implementeringen drevet ud over kontraktens dækning (kontrakten "halter bagud")?
- Er kontrakten stadig sand i forhold til den nuværende kode (kontraktdrift)?
- Er ansvar og ejerskab klart afgrænset mod tilstødende kontrakter? Overlap eller huller?
- Er terminologien konsistent på tværs af kontrakter (samme begreb = samme ord)?
- **Sprogpolitik:** Kontrakter skal være på dansk uden undtagelse (jf. `AGENTS.md`). Kontroller at `date-contract.md` og `mineo-field-pattern.md` er oversat til dansk; ret hvis ikke.

**Dimension B — Arkitektonisk kritik (de bagvedliggende valg):**
- Er de grundprincipper kontrakten hviler på de rigtige? Ville Mineo være bedre bygget på andre principper?
- Er ansvarsfordelingen mellem lag (app-shell · UI · hooks · domæne · persistence · dokument-output) optimal, eller ligger grænser forkert?
- Er der kontrakter der bør slås sammen, splittes, omfordeles eller afskaffes? (Fx: bør `pdf-contract` + `pdf-layout-contract` + `document-format-contract` konsolideres til én dokument-output-kontrakt, nu hvor PDF og Word deler generatorer?)
- Mangler der kontrakter for områder der i dag styres af konvention (fx multi-app-isolation — er den dækket godt nok af `app-shell-contract`?).
- Er der invarianter der håndhæves runtime, men burde løftes ind i typer/schemas — eller omvendt?
- Er kontrakten på det rigtige abstraktionsniveau? For abstrakt = svag styring; for konkret = bremser udvikling.

Output for gruppe 1 skal — udover det normale fund-format — indeholde en sektion **"Arkitektoniske grundprincipper"**, der eksplicit tager stilling til, om kontraktens fundament er sundt, og hvis ikke, hvilke alternative principper der ville give et bedre system. Forslag skal være konkrete, begrundede og knyttet til faktiske smertepunkter.

**Kontrakter er kun bindende, så længe de understøtter det bedste slutprodukt** (jf. `AGENTS.md`). Hvis en kontrakt står i vejen, forbedres/optimeres kontrakten — i samme commit som topology-JSON og coverage-matrix-test opdateres (jf. `contract-topology-procedure.md`). Kontraktændringer behandles som arkitekturbeslutninger: berører de ikke UI/UX eller beregningslogik, gennemføres de direkte; ellers forelægges de.

Punkt 1.7 er en helhedsvurdering, der bygger på fundene fra 1.1–1.6 og adresserer kontraktlandskabet samlet — herunder strukturelle huller, om hierarkiet `src/contracts/*.md > AGENTS.md > CLAUDE.md` er fornuftigt, og om kontrakternes samlede dækning matcher Mineos faktiske kompleksitet (multi-app-arkitektur + dobbeltkanal dokument-output).

---

### Format for hvert enkelt punkt

Hvert punkt dokumenteres i en separat fil i `docs/review/`, navngivet efter punktnummeret, fx `2.1-persistence-arkitektur.md`. Filen følger dette format:

```
# Punkt: [punktnummer] [navn]

**Dato:** ÅÅÅÅ-MM-DD
**Filer gennemgået:** [liste]
**Filer ikke gennemgået:** [hvis relevant]
**Tests kørt:** [kommando + resultat]

## Fund og rettelser

[Nummereret liste. For hvert fund: severity, lokation, problem, risiko, og HANDLING:
 - ✅ Rettet — kort beskrivelse af ændringen
 - ⏸ Afventer godkendelse — UI/UX eller beregningslogik; beskriv forslag og konsekvens
 - ⏭ Ikke rettet — begrundelse]

## Tilfældighedsfund

[Alt bemærket undervejs der falder udenfor punktets primære scope, med samme handlingsmarkering]

## Sammenfatning

[2–5 bullets: vigtigste rettelser, åbne godkendelsespunkter, og om punktet er konvergeret med fundamentet]
```

Severity-skala:
- **Kritisk** — Kan producere forkerte beregninger, datatab eller bryde invarianter.
- **Høj** — Arkitekturfejl, type-usikkerhed eller manglende validering med reel risiko.
- **Medium** — Kompleksitet, duplikering eller manglende tests der hæmmer vedligeholdelse.
- **Lav** — Inkonsistens, mindre forbedringer eller oprydning.

---

### Rækkefølgerationale

Arbejdet følger afhængighedsorden nedefra og op. Hvert lag færdiggøres og rettes, før det næste bygges ovenpå:

| Gruppe | Indhold | Begrundelse |
|---|---|---|
| **1 — Kontrakter & arkitektur** | `src/contracts/*` (+ topology) og `docs/architecture/*` | Normative og styrer alt øvrigt. Forkerte eller ufuldstændige kontrakter ville få resten til at håndhæve fejlbehæftede regler. Kortlægges og forbedres først. |
| **2 — Persistence** | Stores, contexts, load/apply, schema-evolution, fil-I/O | Alt andet afhænger af, at data gemmes og loades korrekt. |
| **3 — Schemas** | Alle Zod-schemas + foundational typer | Schemas definerer grænsefladen til persistence og beregning. |
| **4 — Domænelogik** | Alle beregninger (kernen) | Hjertet i systemet — bringes i orden før UI. Opreguleringsmotoren (4.0) er fundament for de øvrige. |
| **5 — Hjælpefunktioner** | Dato, tal, serialisering, tabel-helpers | Fundamentale utilities brugt af al domænelogik. |
| **6 — Data** | Ratetabeller og opslag | Statiske data der er forudsætning for korrekte beregninger. |
| **7 — UI-inputs & grid** | Input-komponenter og grid-infrastruktur | Grænsefladen mod beregningslagene. |
| **8 — Pages** | Sider og layout | Sammensætning af input og præsentation. |
| **9 — Hooks** | Custom React hooks | Lim mellem UI og domæne. |
| **10 — Dokument-output (PDF + Word)** | `src/document/`, `src/pdf/`, `src/docx/` | Separat outputkanal; afhænger af domænedata. Dobbeltkanal (PDF+Word) gennem fælles generatorer; inkluderer Word-paritet og evt. afvikling af PDF-duplikering. |
| **11 — Config & settings** | Konfiguration, settings, auth | Rammeværk og applikationsopsætning. |
| **12 — App-shell & multi-app** | Entry points, bootstrap, standalone-app | Sammenbindingen af det hele; multi-app-isolation. |
| **13 — Testkvalitet** | Tests for ovenstående | Verificerer, at de foregående punkter er testsikrede. |
| **14 — Tværgående helhed** | Kontrakt-alignment og duplikering | Endelig helhedsvurdering, når alle dele er bragt i orden. |

---

## Procesbeskrivelse

1. Vælg næste **ikke-startede** punkt (følg rækkefølgen — fundamentet før udmøntningerne).
2. Gennemgå punktets filer og deres direkte afhængigheder. Marker eksplicit, hvad der er gennemgået, og hvad der ikke er. **Overvej at uddelegere brede gennemgange til subagents** (jf. `AGENTS.md` §Reviews og subagents) — er du i tvivl, så gør det; det holder hovedtråden ren.
3. **Ret fundene:** koderelaterede rettelser gennemføres direkte; UI/UX- og beregningslogik-fund forelægges til godkendelse.
4. Kør relevante tests efter kvalitetsgaten i `AGENTS.md` (vælg det smalleste tjek der realistisk fanger fejl i ændringen; udvid efter risikoflade) og rapportér resultatet ærligt.
5. Dokumentér i `docs/review/[punkt]-[navn].md` efter formatet ovenfor.
6. Opdater statustabellen til ✅ Gennemgået med link til filen.
7. Gå først videre til næste punkt, når dette er færdigt (rettet + testet, eller åbne punkter eksplicit parkeret).

Et punkt behøver ikke dække hver eneste fil i en mappe — scope er det, der giver mening som en sammenhængende arbejdsenhed. Filer der naturligt hører til et tidligere/senere punkt krydsrefereres frem for at blive dækket to gange.

### Statusværdier
- ⬜ **Ikke startet**
- 🟡 **I gang** — påbegyndt; har åbne fund eller godkendelsespunkter
- ✅ **Gennemgået** — alle fund rettet eller eksplicit parkeret, tests grønne, dokumenteret

---

## Afslutning

Planen er nulstillet. Ingen punkter er gennemgået endnu; arbejdet påbegyndes forfra ved punkt 1.1 efter afhængighedsorden indefra og ud. Hvert punkt færdiggøres (rettet + testet, eller åbne punkter eksplicit parkeret), dokumenteres i sin egen `docs/review/[punkt]-[navn].md`-fil, og statustabellen opdateres til ✅ Gennemgået, før det næste påbegyndes. Når alle 14 grupper er færdige, er kontraktlandskabet, beregningskernen, persistence, UI, dokument-output (PDF+Word) og multi-app-skallen bragt i en ensartet, testsikret, fail-closed tilstand med én rød tråd.
