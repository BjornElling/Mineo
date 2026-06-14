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

✅ **Gruppe 2 (Persistence) er færdig** (2026-06-11). Punkterne 2.1–2.6 er gennemgået og fund rettet: hydrate rydder nu fieldErrors atomisk (§6.3); resolved-error-cache selvinvaliderer på revision; undo/redo-restore ruller nu BÅDE store + historik fail-closed tilbage ved fejl (delt `persistenceStoreRollback.ts`); `undo`/`redo` hærdet mod uncaught exceptions; død debug-/verifikations-/API-overflade fjernet; preflight skelner nu ægte fejl fra harmløs feltoprydning og loader stille (brugergodkendt); session-hydration kasserer ikke længere cleanup ved storage-læsefejl; korrupt-data-guards (arrays) + klar `.eo`-versionsfejl; `any` elimineret i fs-access. Nye tests: invalidDrafts-schema, Zod-unwrap-strip-guard pr. sektion, hydrate-rydder-fejl. **Bevidst ikke implementeret:** `.eo`-dataversion + migrator-dispatch (hypotetisk extension point, jf. §Konvergens — anbefaling dokumenteret i 2.5). **Pre-eksisterende fejl rapporteret:** `MainLayout.pwaConcurrency`-test fejler på ren main (ikke forårsaget af dette arbejde; henvist til 9.3/12).

✅ **Gruppe 3 (Schemas) er færdig** (2026-06-11). Punkterne 3.1–3.5 er gennemgået og fund rettet: fjernet overflødig `validateISODateFormat`-wrapper (inlinet `isISODateString`); rettet forældede `isOk()`-JSDoc-referencer i `result.ts`/`safeComputation.ts`; elimineret dual source of truth i `eoBilagSelection`-default og fjernet overflødig `createDefaultEoAngivetLoenLoenudvikling`-helper (begge omlagt til `parse({})`-udledte defaults — format-neutralt, fingerprint uændret, intet versionsbump); ny regressionstest mod Zod-4 `.default()`-footgun; delt `eoFileMetadataSchema` på tværs af save/load-containere. Verificeret: load-/strip-pipeline håndterer `.strict().superRefine()`-schemas korrekt; key-alignment registry↔manifest↔eoFile er fuldt type-håndhævet (drift umuligt uden typecheck-fejl). **Krydsref:** dobbelt-registrerings-edge-case i `tableSaveOrderRegistry` → 7.3; `branded.ts` dato-kerne placering → 5.1. Næste ikke-startede punkt er **4.0**.

✅ **Gruppe 5 (Hjælpefunktioner) er færdig** (2026-06-14). Punkterne 5.1–5.5 er gennemgået og fund rettet. **Datohåndtering:** `isoDateToDate` omlagt til tynd wrapper over `parseISODate` (én sand parse-kilde); dag-i-måned-validering konsolideret til `isValidDate` (fjernet ad hoc `Date.UTC`); ubrugte barrels `utils/date/index.ts` + `utils/number/index.ts` slettet; død `validateDateRange` fjernet; `interpretYear` og `beregnUgePeriode` hærdet fail-closed; 3.1-flaget om `branded.ts`-dato-kerne-placering lukket (bevidst ikke flyttet — tæt koblet brand+parser, ~250 importsteder, ingen reel gevinst). **SH-dage:** dobbelt kilde til helligdagssættet fjernet (`beregnHelligdage` projicerer nu `beregnHelligdageMedNavn`); navngiven konstant for Store bededag-grænse; misvisende `erSHDag`-alias fjernet; påskedag-facit-test tilføjet. **Talbehandling:** percent-parsing konsolideret til én dansk locale-politik (`parsePercentPointString` kanonisk) + lossy `/100*100`-round-trips fjernet. **Øvrige utils:** scroll-`prefers-reduced-motion` konsolideret til ét sted (rettet `scrollToSection`s tilsidesættelse); nye tests for `clipboardUtils`/`schemaRowEmpty`; dokumenteret latente faldgruber (serialisering af Date/Map/Set, id-nøgle-invariant). **Brugergodkendt 2026-06-14:** (a) percent-parsing samlet til dansk regel; (b) forklarende min>max-datofejlbesked implementeret (jf. AGENTS.md §Validering og fejl-UI); (c) Store bededag udeladt fra 2024 uanset skadesår bekræftet. **Adfærds-neutralitet:** fuld suite uændret efter percent-konsolideringen (ingen snapshot-/beregningsændringer). Næste ikke-startede punkt er **6.1**.

✅ **Gruppe 6 (Data) er færdig** (2026-06-14). Punkterne 6.1–6.4 er gennemgået og fund rettet. **Reelle rettelser (alle værdi-neutrale):** fail-closed guard i `getYearBoundsForCompleteCoverage` (ét tomt dict → null i stedet for {Infinity,-Infinity}); elimineret dobbelt sandhedskilde for §24-maksimum 2024 (`ASL_MAX_AARSLOEN_2024` udledes nu af `aarsloenAslMax[2024]` med fail-closed guard, beviseligt 608000→608000); `kapitaliseringsbekendtgoerelser.test` kalder nu den kanoniske produktions-resolver (slettet ~50 liniers divergerende kopi med latent tom-array-crash). **Ny testdækning:** dedikeret `sygedagpengeRates.test.ts` (kontinuitet for sats/ATP/OP-segmenter, fail-closed OP-resolver); fail-closed grænse-tests for kapitaliserings-resolveren; invariant- og guard-tests i `lovbestemteRates.test.ts`. **Tre subagent-flag verificeret som false alarms og afvist:** OP-tabel "rækker ud over rater → kast" (forward-provisioneret data, ingen kast-sti); `getOffentligLoenTabelForDato` "dødkode" (i aktiv brug i to Tab-komponenter); forhøjet-pensionsalder "feature ikke-funktionel" (resolveren er "nyeste på/før dato", præcis som datafilen dokumenterer). **Bevidst ikke gjort:** flytning af `kapitaliseringOriginalPdf/` (~44 MB bevidst kilde-provenans, ikke bundlet); `toLoengruppe`-validator (spekulativ, jf. §Konvergens); import-script unit-tests (accepteret gap → 13.x). **Åbent godkendelsespunkt LUKKET (6.2):** Brugeren har bekræftet sygedagpenge-tre-leds-modellen (sats/ATP/OP) og satstallene. `sygedagpengeRates.ts` konsolideret til ÉN samlet satstabel (sats+ATP+OP som kolonner pr. satsår; de separate ATP-/OP-tabeller fjernet, ATP var dobbeltkilde); ATP-leddet rettet til at videreføres fremad (fejler kun hvis ingen ATP-sats); OP inline (0 før 6-1-2020), nu kun kendt til 2027 (forud-indtastede 2028-2030 fjernet efter brugervalg). Brugervendt insert-gating (disabled knap + rød ring + tooltip + runtime fail-safe) uændret; alt beviseligt værdi-neutralt (fuld suite uændret). Næste ikke-startede punkt er **7.1**.

✅ **Gruppe 7 (UI-inputs & grid) er færdig** (2026-06-14). Punkterne 7.1–7.4 er gennemgået og fund rettet. **7.1 StyledField-familien:** to felt-identitets-huller lukket (radio tom-option + multiline-textarea bar ikke `data-mineo-undo-field-path` → undo/redo-fokus-restore + save-gate-lokalisering virkede ikke); ensartet clear-commit-guard på ALLE 8 blur-commit-felter (clear committer kun ved reel ændring → ingen overflødige undo-frames); stale UI-range-fejl ved integer-clear fjernet; draft-canonicalisering-under-tastning fjernet fra fraction (+ død `sanitizePastedFraction` slettet); død dato-indirektion fjernet; ny test for procent-format-determinisme ved ekstern værdi. **7.2 Table-inputs:** død `clearErrorOnChange`-flag fjernet; `TableDateInput`s dobbelt-skriver på `onErrorChange` elimineret (én reporter feeder aggregat-/PDF-gates); `useRowDrafts.commitAll` bærer nu undo-origin; no-op-resync-huller i `useRowDrafts` lukket (add/remove/reorder; nye tests); redundant `assignRef`-shim fjernet. **7.3 Grid-infrastruktur:** `setEditingCell` type/impl aligned; delt type-sikker `mineoTableBoundaryExit`-helper; usikker `activeCell!`-assertion fjernet; scroll-hop-fix på horisontal nav (dokumenteret adfærd); robust sort-tie-break; ubrugt `useGridCore`-footgun-klynge slettet. Vertikal-lock-nav-asymmetrien blev en **brugergodkendt UI/UX-rettelse** (vertikal nav springer nu låste celler over som horisontal; ny regressionstest); dobbelt-fokus-autoritet-flaget verificeret som ikke-fejl og parkeret. **7.4 Tabel-komponenter:** `SvieSmerteTable` Zod-parser ikke længere `tilstand` i view; `LoenudviklingManuelTable` parser ikke længere ISO i view (forælder leverer `baseDateISO`); `useFerieRows` afhænger nu af smal slice. **Krydsref:** systemisk inline dato-bounds-§5.1-overtrædelse i 5 tabeller → gruppe 8 (forælder-side er rette destination); `useGridTablePersistence` + `useEoRowDrafts`-konsolidering → 13.4/14.2. **Brugergodkendt UI/UX-ændring (2026-06-14):** vertikal tabel-nav springer nu låste read-only celler over (som horisontal nav allerede gjorde) — brugeren valgte "spring altid låste celler over". Ingen beregningsændringer; ingen åbne godkendelsespunkter. Næste ikke-startede punkt er **8.1**.

**Test-baseline ved start:** Fuld suite grøn — **5020 tests / 421 filer** (seneste kørsel 2026-06-10). Efter gruppe 5: **5172 tests / 429 filer** grøn (2026-06-14). Efter gruppe 6: **5185 tests / 430 filer** grøn (2026-06-14). Pre-eksisterende `act(...)`-warning i `TableDropdown.gridCore.test.tsx` er kendt og ikke en fejl (testen passerer). Hvert punkt skal efterlade suiten mindst lige så grøn.

### Åbne godkendelsespunkter overført fra tidligere review-arbejde

Følgende ændringer er **allerede committet** af brugeren (behandlet som tilsigtede), men rører beregningslogik eller brugervendt output og blev tidligere forelagt uden endelig bekræftelse. De skal **gen-forelægges og lukkes**, når reviewet når det relevante punkt — ikke glemmes:

1. ~~**Obligatorisk pension (OP) i sygedagpenge-tillæg** → genbesøges i **6.2**.~~ **LUKKET 2026-06-14:** brugeren har bekræftet hele tre-leds-modellen (sats/ATP/OP). `sygedagpengeRates.ts` konsolideret til én samlet satstabel (sats+ATP+OP som kolonner pr. satsår); ATP videreføres fremad; OP inline (0 før 6-1-2020). Brugervendt insert-gating (disabled knap + rød ring + tooltip) uændret. Beviseligt værdi-neutral.
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
| 3.1 | Schema-fundament: formSchemas-entry, baseSchemas, enumSchemas, amountExpressionSchema, invalidDraftsSchema + `src/types/` (branded, parserSpec, validation, result) | ✅ Gennemgået | [3.1-schema-fundament.md](3.1-schema-fundament.md) |
| 3.2 | Section-schemas A: stamdata, satser, aarsloen, faellesAarsloen | ✅ Gennemgået | [3.2-section-schemas-a.md](3.2-section-schemas-a.md) |
| 3.3 | Section-schemas B: erstatningsopgoerelse (største), erhvervsevnetab | ✅ Gennemgået | [3.3-section-schemas-b.md](3.3-section-schemas-b.md) |
| 3.4 | Section-schemas C: forsoergertab, renteberegning, varigeMen + eoFileSchema (container/save/load, preflight, forward/backward-tolerance) | ✅ Gennemgået | [3.4-section-schemas-c-og-eofile.md](3.4-section-schemas-c-og-eofile.md) |
| 3.5 | Schema-fingerprint, persistenceRegistry-alignment og save-order-registry (tableSaveOrderRegistry, useRegisterTableSaveOrder) | ✅ Gennemgået | [3.5-schema-fingerprint-og-save-order-registry.md](3.5-schema-fingerprint-og-save-order-registry.md) |
| **4 — Domænelogik (beregningskernen)** | | | |
| 4.0 | Opreguleringsmotorer (fundament): `opregulerMedAslAarsloensmaksimum`, `opregulerMedAkkumuleretReguleringssats` (fail-closed `manglendeAar`) | ✅ Gennemgået | [4.0-opreguleringsmotorer-fundament.md](4.0-opreguleringsmotorer-fundament.md) |
| 4.1 | Stamdata, satser og policies (stamdataCalculations, satserCalculations, aarsloenPolicy) | ✅ Gennemgået | [4.1-stamdata-satser-policies.md](4.1-stamdata-satser-policies.md) |
| 4.2 | Årsløn: aarsloen + aslEalAarsloen (beregning, validering, periodevisning) | ✅ Gennemgået | [4.2-aarsloen.md](4.2-aarsloen.md) |
| 4.3 | EET: EAL, ASL-afgørelser, skæringsdatoer, aldersreduktionsformel, differencekrav, typer | ✅ Gennemgået | [4.3-eet-kerne-asl-eal-differencekrav.md](4.3-eet-kerne-asl-eal-differencekrav.md) |
| 4.4 | EET: kapitalisering (calc/opslag/presentation), løbende ydelser, mer-erstatning ved forhøjet pensionsalder, regulering-rater, snapshot | ✅ Gennemgået | [4.4-eet-kapitalisering-loebende-mer-regulering.md](4.4-eet-kapitalisering-loebende-mer-regulering.md) |
| 4.5 | Forsørgertab: beregning, ASL-ydelser, EAL-krav, snapshot | ✅ Gennemgået | [4.5-forsoergertab.md](4.5-forsoergertab.md) |
| 4.6 | Varige Mén: motor og beregninger | ✅ Gennemgået | [4.6-varige-men.md](4.6-varige-men.md) |
| 4.7 | Renteberegning: motor, procesrente, principper, validering, tabelmodel | ✅ Gennemgået | [4.7-renteberegning.md](4.7-renteberegning.md) |
| 4.8 | EO-engines I: periodiseringsmotor, period-merging/overlap/range-groups, beregningsperiode-TAF-overlap, ferie, arbejdsdage/måneder | ✅ Gennemgået | [4.8-eo-engines-i-periodisering.md](4.8-eo-engines-i-periodisering.md) |
| 4.9 | EO-engines II: TAF (calculations, engine, netto, per-year, per-year-opreguleret, day-sets, beregningsenhed), forligsgrad, svie/smerte, sygeferiegodtgørelse | ✅ Gennemgået | [4.9-eo-engines-ii-taf-forligsgrad-svie-smerte.md](4.9-eo-engines-ii-taf-forligsgrad-svie-smerte.md) |
| 4.10 | EO-engines III: løn-/ydelsesudvikling og regulering (loenudvikling, offentligeYdelserUdvikling, reguleringCoverage/FormulaUtils/Presentation, overenskomstReguleringShared, indkomstSkadestidspunkt) | ✅ Gennemgået | [4.10-eo-engines-iii-loenudvikling-regulering.md](4.10-eo-engines-iii-loenudvikling-regulering.md) |
| 4.11 | EO: helpers, initial values, row-derived, tabel-modeller, indtaegtPerioder, sygedagpengeInsertRows, midlertidigtEet-injektion | ✅ Gennemgået | [4.11-eo-helpers-initial-values-tabeller.md](4.11-eo-helpers-initial-values-tabeller.md) |
| 4.12 | EO: validation-lag og `erstatningsopgoerelseValidator` (incl. reguleringssats-dækningsvalidering) | ✅ Gennemgået | [4.12-eo-validation-lag.md](4.12-eo-validation-lag.md) |
| 4.13 | EO: snapshot, presentation-model, canonical output, invarianter + snapshot→pdf/beregning/debug-projektioner | ✅ Gennemgået | [4.13-eo-snapshot-presentation-canonical.md](4.13-eo-snapshot-presentation-canonical.md) |
| 4.14 | EO-debug: view-models (core/loen/indkomst/regulation), parity, severity, integrity, navigation, csv, builder-registry | ✅ Gennemgået | [4.14-eo-debug-viewmodels-parity-severity-navigation.md](4.14-eo-debug-viewmodels-parity-severity-navigation.md) |
| **5 — Hjælpefunktioner** | | | |
| 5.1 | Datohåndtering kerne: isoDate, dateCommit, dateUtils, dateFormatting, isoDateHelpers, dateDraftNormalization/-Commit, date/index | ✅ Gennemgået | [5.1-datohaandtering-kerne.md](5.1-datohaandtering-kerne.md) |
| 5.2 | Datohåndtering validering: dateInputValidation, dateRangeErrorMessages, dateOrderValidation, utcDayMath, periodeBeregning (kanonisk dag-iteration) | ✅ Gennemgået | [5.2-datohaandtering-validering.md](5.2-datohaandtering-validering.md) |
| 5.3 | SH-dage: beregning og oversigt (shDageBeregning, shDageOversigt) | ✅ Gennemgået | [5.3-sh-dage.md](5.3-sh-dage.md) |
| 5.4 | Talbehandling: numberParsing, numberComparison, rounding(+shortcuts), amount-/percentInputUtils, percentDraftCore, expressionAmount, fraction, safeComputation, integerRange, formatUtils | ✅ Gennemgået | [5.4-talbehandling.md](5.4-talbehandling.md) |
| 5.5 | Øvrige utils + foundational typer: serialization, typeGuards, zodTypeGuards, nullToUndefinedDeep, zodIssueFormatting, validationFlagMap, tableRows, schemaRowEmpty, tableValidationCommon, rowId, input/clipboard, scroll-helpers, `src/types/` (deepReadonly, calculation, loen, table) | ✅ Gennemgået | [5.5-oevrige-utils.md](5.5-oevrige-utils.md) |
| **6 — Data** | | | |
| 6.1 | Renter og lovbestemte/statistiske rater: interestRates, lovbestemteRates, statistiskeRates, regulatoryRates | ✅ Gennemgået | [6.1-renter-lovbestemte-statistiske-rater.md](6.1-renter-lovbestemte-statistiske-rater.md) |
| 6.2 | Folkepension, sygedagpenge (+OP), overenskomst, KRL, ydelsestyper, retsinfo-links, indskudteLoentillaeg | ✅ Gennemgået | [6.2-folkepension-sygedagpenge-overenskomst-krl-ydelsestyper-retsinfo.md](6.2-folkepension-sygedagpenge-overenskomst-krl-ydelsestyper-retsinfo.md) |
| 6.3 | Offentlig løn: KL- og RLTN-satser, lookup, typer, import-script | ✅ Gennemgået | [6.3-offentlig-loen.md](6.3-offentlig-loen.md) |
| 6.4 | Kapitalisering: bekendtgørelses-tabeller, kapitaliseringsbekendtgoerelser, forhoejetPensionsalderEvents, table-registry | ✅ Gennemgået | [6.4-kapitalisering-bekendtgoerelser-pensionsalder.md](6.4-kapitalisering-bekendtgoerelser-pensionsalder.md) |
| **7 — UI-inputs & grid** | | | |
| 7.1 | StyledField-familien: base, amount, date, integer, percent, fraction, week, year, text(area), dropdown, checkbox, radio, toggle + inputKeyFilters + input-knapper | ✅ Gennemgået | [7.1-styledfield-familien.md](7.1-styledfield-familien.md) |
| 7.2 | Table-inputs og adaptere (inputs/table + hooks/tableInput/adapters), rowDrafts, cell-invalid-draft-channel | ✅ Gennemgået | [7.2-table-inputs-og-adaptere.md](7.2-table-inputs-og-adaptere.md) |
| 7.3 | Grid-infrastruktur: gridCore (registry, context, navigation, focus, model, ux-spec, styles, utils) + grid-controller-hooks | ✅ Gennemgået | [7.3-grid-infrastruktur.md](7.3-grid-infrastruktur.md) |
| 7.4 | Tabel-komponenter: standard (display/grid/loose/virtualized) + domæne-tabeller + per-tabel row-hooks | ✅ Gennemgået | [7.4-tabel-komponenter.md](7.4-tabel-komponenter.md) |
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
