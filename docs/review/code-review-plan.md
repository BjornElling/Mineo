# Review- og refaktoreringsplan — Mineo

> Arbejdsværktøj for det systematiske review af hele Mineos kodebase. Hvert punkt **retter fundene** undervejs og bringer koden på linje med kontrakterne. `AGENTS.md` er den autoritative kilde til roller, mandat og constraints.

## Faste principper (gælder hvert punkt — må ikke glemmes)

- **Trust-kritisk, 100 % client-side.** Forkerte beregninger, datatab eller uforudsigelig adfærd er uacceptabelt.
- **Feature-fladen er låst.** Ingen nye beregningstyper. Favorisér **forenkling og konsolidering** frem for hypotetiske extension points.
- **Fail-closed.** Manglende reguleringssatser/år/tabeller skal fejle eksplicit — aldrig et stille gæt (jf. `manglendeAar`).
- **Én sandhedskilde.** Zod-schemas er eneste kilde til runtime-validering og afledte typer. Ingen dobbelt-sandhed for dato/rente/sats. Beregningslag og dækningsvalidering skal kalde *samme* motor.
- **Ingen live preview.** Beregn/validér/vis aldrig afledt feedback fra `onChange`-draft. Commit på `onBlur` (forms) / `onPersist` (table). Eneste immediate-commit-undtagelser: delete/backspace på ikke-redigerende celle, valg af dropdown-menupunkt, toggle/radio-aktivering.
- **Runtime data-integritet.** Committed input må ikke forsvinde/nulstilles/muteres pga. navigation, re-render, tab-skift eller sync.
- **Save/load (.eo).** Atomisk load (medmindre bruger accepterer delvis i preflight); forward/backward-tolerant; streng round-trip for brugerinput; afledte værdier genberegnes efter load.
- **Tal-identitet ved delegering.** Når lokal logik omlægges til en fælles motor, *bevis* tal-identitet med ækvivalens-test — ikke "ser rigtigt ud".
- **Sprogpolitik:** dansk uden undtagelse.
- **Godkendelse:** UI/UX- og beregningslogik-ændringer forelægges; resten gennemføres direkte. Resten af punktet kan færdiggøres mens et fund afventer.

**Dobbeltkanal dokument-output:** PDF (jsPDF) og Word (`.docx`) kører gennem *samme* format-agnostiske generatorer mod `DocumentWriter`-grænsefladen (`createDocxWriter` routes via `documentGenerationContext`). Gruppe 10 dækker begge kanaler + paritet.

**Multi-app:** Mineo (fuld) + standalone MinProcesrente deler bootstrap/storage, men er namespace-isolerede. Gruppe 12 dækker isolationen.

---

## Status og fremdrift

Arbejdet følger afhængighedsorden nedefra og op (se rationale-tabel sidst). **Hele reviewet (gruppe 1–14) er gennemført.** Alle fire forelagte 14.2-fund er brugergodkendt og gennemført. Tilbage står kun bevidst parkeret lav-værdi-/DEV-only-polish (se Gruppe 14 nedenfor).

**Færdige grupper** (fund rettet + tests grønne; detaljer i de enkelte `docs/review/[punkt]-*.md`):

- ✅ **Gruppe 1 — Kontrakter & arkitektur** (2026-06-10). Kontraktlandskab konsolideret: `pdf-contract`+`pdf-layout-contract` → `document-output-contract`; `pdf-architecture.md` → `document-output-architecture.md`; felt-identitets-API i `mineo-field-pattern.md`; 18 → 17 tværgående kontrakter.
- ✅ **Gruppe 2 — Persistence** (2026-06-11). Atomisk fieldErrors-clear; selvinvaliderende error-cache; undo/redo-restore ruller store+historik fail-closed tilbage; død debug-overflade fjernet; korrupt-data-guards. **Bevidst ikke gjort:** `.eo`-dataversion + migrator-dispatch (hypotetisk extension point — anbefaling i 2.5).
- ✅ **Gruppe 3 — Schemas** (2026-06-11). Fjernet `validateISODateFormat`-wrapper; defaults udledt af `parse({})` (format-neutralt); delt `eoFileMetadataSchema`; key-alignment registry↔manifest↔eoFile fuldt type-håndhævet.
- ✅ **Gruppe 4 — Domænelogik** (4.0–4.14). Opreguleringsmotorer som fundament; EO-engines (periodisering, TAF, regulering), EET, forsørgertab, varige mén, renteberegning, snapshot/canonical, debug-viewmodels.
- ✅ **Gruppe 5 — Hjælpefunktioner** (2026-06-14). Én sand dato-parse-kilde; SH-helligdagssæt konsolideret; percent-parsing samlet til én dansk locale-politik (brugergodkendt); forklarende min>max-datofejlbesked.
- ✅ **Gruppe 6 — Data** (2026-06-14). Fail-closed guards i year-bounds/§24-max/kapitalisering; `sygedagpengeRates.ts` konsolideret til én satstabel (sats+ATP+OP). **Åbent godkendelsespunkt lukket:** sygedagpenge tre-leds-model bekræftet.
- ✅ **Gruppe 7 — UI-inputs & grid** (2026-06-16). Felt-identitets-hul i StyledCheckbox/EetDifferencekrav lukket; dobbelt-undo-frame rettet; grid-scroll-hop rettet; `gridUxSpec` Tab-kontrakt synket med ny navigation.
- ✅ **Gruppe 9 — Hooks** (9.1–9.4, 2026-06-17). Fire udskudte fund lukket: revoked PWA-handle får nu handlingsanvisende dansk fejl (permission-gate + DOMException-mapping, brugergodkendt); den pre-eksisterende `pwaConcurrency`-flake root-caused (auto-retry-timer↔event-race) + rettet via delt `lastAttemptedRequestIdRef`; navigations-commit-flush bragt på linje med save/load (`prepareForCriticalDataReplacement`); manglende `historyTargetRestore`-tests skrevet. Brugergodkendt: ASL maks-validering fail-closed ved manglende sats; omregning-toggle vejledning via kanonisk celle-hint. Konvergens: `useScrollToSectionWithRetry` konsolideret onto `scrollWithRetry` (+ delt cancel); dynamisk fejl-reporter-cache lækker ikke. **Parkeret (14.2):** ubrugt `replaceValues`-export; `StyledToggleSwitch` imperativ shake.
- ✅ **Gruppe 12 — App-shell & multi-app** (12.1–12.2, 2026-06-19). Verifikationspunkt: app-shell-laget overholder alle 7 normative regler i `app-shell-contract.md` (kontrakt re-verificeret mod kode, dato opdateret). Påstået kritisk SW-reload-fejl undersøgt og afvist — adfærden er kontraktens bevidste konservative valg (styret af `controllerExistedAtLoad`, ikke `{once:true}`); tilføjet forklarende kommentar + regressionstest mod fremtidig fejllæsning. Begge udskudte 12.2-fund lukket: namespace-isolation (mineo_* vs. minprocesrente_*) bekræftet korrekt + testdækket (ingen ændring); standalone-`@media`-undtagelsen nu eksplicit begrundet i callsite-kommentar + `app-shell-contract.md` §5.3 + præciserende parentes i `AGENTS.md`. **Nyt udskudt fund (14.2):** pass-through `setDocumentFooterBrand`.
- ✅ **Gruppe 8 — Pages** (8.1–8.6, 2026-06-16). LoginPage flyttet til `src/auth/`; Satser nedtoner satser ved ugyldigt år (brugergodkendt); to debug-indstillinger (test-fane + font-style-farvemarkering) DEV-gated UI+adfærd (brugergodkendt). Delt forligs-validering (`useForligAnsvarsgradValidation` + `forligAnsvarsgradRules`) håndhæves nu ens fra både Erstatningsopgørelse og Erhvervsevnetab→Differencekrav (brugergodkendt korrekthedsfix). Insert-today `fieldPath`-bug rettet; kanonisk `useShakeFlag` (to inline timer-leaks fjernet); kanonisk `formatKr`/`dateRanges_varigemen`; MenberegningTab flyttet til central fejl-model; `SKAERING_2015_03_01`/`SKAERING_2024_01_01` konsolideret; dødkode fjernet (`EODebugLoenSections`+`eoDebugLoenViewModel`, `ComputationErrorAlert`, dead `isUserFeedbackRef`); Overlay auto-close timer-fix. **De to største komponenter dekomponeret:** `LoenindkomstTab` 3079→2204 og `EOOplysningerTab` 2748→2017 linjer (ren strukturel, adfærdsbevarende; nye `loenindkomst/`+`eoOplysninger/`-mapper).

- ✅ **Gruppe 14 — Tværgående helhed** (14.1–14.2, 2026-06-19). **14.1:** topologi-/dækningsmatrix bekræftet allerede selv-håndhævet (`contractCoverageMatrix.test.ts`); `page-component-contract.md` §6.5 omskrevet så mount-strategi er et frit render-/UX-valg (committed-integritet + persisterede feltfejl er centralt garanteret, ikke mount-afhængige) — fjerner kontraktafvigelse på 3 fagsider uden adfærdsændring; to kontrakt-konsolideringskandidater afvist med begrundelse (skarpe snit). **14.2:** dødkode slettet (`periodiserBeloebForMaaneder`/`-Arbejdsdage` + hjælpere, `computeTafEngine` + typer, `ValidationErrorMap`); ubrugt `usePersistedForm.replaceValues` fjernet (latent no-op-bug); pass-through re-eksporter afviklet (`formatOverenskomst*`, `setDocumentFooterBrand`) / flyttet til kanonisk hjem (`formatPercentTrimmedFromRounded4` → `formatUtils`); inline-konstanter konvergeret (`SKAERING_2015_03_01`, `isoYear`); `aarsloenRowInterval.ts` flyttet til `aarsloen/`; toggle-shake → kanonisk `useShakeFlag`; løbende-ydelsers show-rest-visningsflag samlet i delt domæne-helper (lukker UI↔PDF-divergensrisiko); løntrin-finder-overlay ekstraheret til delt komponent + ren kerne. **Forelagt + gennemført (brugergodkendt):** celle-fejl-gate-hul lukket + gate ensrettet (3 grid-tabeller); renteberegning download-gate beregnes nu fra committed input (§2.4); SFGG-6-måneders-advarsel vist som inline-note; køn-fejl afklaret (allerede ensartet, ingen ændring). **Parkeret:** EODebug regulerings-række-ordering (DEV-only), Word-test `as never`-fixtures (lav drift-risiko).
- ✅ **Gruppe 13 — Testkvalitet** (13.1–13.4, 2026-06-19). Verifikation af de foregående punkters testkvalitet + lukning af alle udskudte gruppe-13-fund. **13.1:** opregulerings-delegations-coverage gennemgået for alle seks callsites (solid); forsørgertabs `opreguleringsfaktor` låst mod motorens faktiske output (delegations-identitet). **13.2:** canonical-outputtets fail-closed throw-path låst (drift-guard på `.strict()`/`.int()`); JSON-round-trip-determinisme for canonical output; ni falsk-grønne `if (typeof cell === 'object')`-guards i debug-viewmodel-testen rettet; Skjul-fjernelse (H1) + totals-clamp (H2) verificeret allerede dækket på dokument-/pdfModel-laget. **13.3:** derived-not-persisted asserteret (afledt felt i sektion afvises fail-closed); forward-tolerance "gammel fil mangler nyere felt → ingen advarsel"; falsk-grøn `null → success`-test rettet; streng round-trip + atomisk apply/rollback verificeret dækket. **13.4 (fire udskudte fund lukket):** fem computation-model-fixtures TypeScript-låst med `satisfies` (afslørede + rettede reel drift i differencekrav-fixturen); konkrete beløb + mellemregninger i fem generatorers Word-tests; multi-sektions-EO-Word-fixture (Lønindkomst + SH-dage); `tafKravGrafChart`-helpers dækket (15 tests via smal test-only-eksport). **Residualer til 14.2:** resterende partial-fixture `as never`-casts (lav drift-risiko); fuldt afstemmende Word-multi-sektions-fixture for offentligeYdelser/regulering.

**Test-baseline:** 5020 (2026-06-10) → 5172/429 (g.5) → 5185/430 (g.6) → 5310/445 (g.7) → 5318/446 (g.8) → 5328/449 (g.9) → 5354/450 (2026-06-17, g.10). G.11 (11.1–11.3) tilføjede ingen nye tests (kun en adfærdsbevarende type-konsolidering + dokumentation), så baseline var uændret. G.12 (12.1–12.2) tilføjede én regressionstest (SW-reload-disciplin) → 5355 tests / 450 filer grøn. G.13 (13.1–13.4) tilføjede 24 nye tests + 1 ny testfil (`tafKravGrafChart.helpers.test.ts`) → **5384 tests / 452 filer grøn**. G.14 (14.1–14.2) fjernede dødkode-tests (periodiser×6, computeTafEngine×~12, ValidationErrorMap×1, replaceValues-merge×1) og tilføjede `resolveLoebendeAfgoerelseRestVisning`-test (×4) → 5368 tests / 452 filer. De fire brugergodkendte forelagte fund (renteberegning download-gate, SFGG-advarsel) tilføjede 7 tests + 1 ny testfil (`Renteberegning.downloadGate.test.tsx`) → **5375 tests / 453 filer grøn** (bekræftet ved fuld suite). Hvert punkt skal efterlade suiten mindst lige så grøn. Kendt (ikke fejl): `act(...)`-warning i `TableDropdown.gridCore.test.tsx`. (Den pre-eksisterende `MainLayout.pwaConcurrency.test.tsx`-flake blev root-caused og rettet i 9.3.)

### Statustabel

| Punkt | Navn | Status |
|---|---|---|
| **1 — Kontrakter & arkitektur** | | ✅ |
| 1.1–1.7 | Topologi-maskineri, tværgående/domæne/page-kontrakter, arkitektur-docs, helhedsvurdering | ✅ (filer `1.1`–`1.7`) |
| **2 — Persistence** | | ✅ |
| 2.1–2.6 | Arkitektur, undo/redo+fokus, FormPersistenceContext, load/apply/hydration, schema-evolution, fil-I/O | ✅ (filer `2.1`–`2.6`) |
| **3 — Schemas** | | ✅ |
| 3.1–3.5 | Fundament, section-schemas A/B/C+eoFile, fingerprint+save-order-registry | ✅ (filer `3.1`–`3.5`) |
| **4 — Domænelogik** | | ✅ |
| 4.0–4.14 | Opreguleringsmotorer, stamdata/satser, årsløn, EET, forsørgertab, varige mén, rente, EO-engines, snapshot, debug | ✅ (filer `4.0`–`4.14`) |
| **5 — Hjælpefunktioner** | | ✅ |
| 5.1–5.5 | Dato-kerne/-validering, SH-dage, talbehandling, øvrige utils+typer | ✅ (filer `5.1`–`5.5`) |
| **6 — Data** | | ✅ |
| 6.1–6.4 | Renter/rater, folkepension/sygedagpenge/overenskomst, offentlig løn, kapitalisering | ✅ (filer `6.1`–`6.4`) |
| **7 — UI-inputs & grid** | | ✅ |
| 7.1–7.4 | StyledField-familien, table-inputs+adaptere, grid-infrastruktur, tabel-komponenter | ✅ (filer `7.1`–`7.4`) |
| **8 — Pages** | | ✅ |
| 8.1 | Stamdata (+DebugTab), Årsløn, Satser, Mineo (forside), Indstillinger, LoginPage | ✅ (fil `8.1-pages-stamdata-aarsloen-satser-mineo-indstillinger-loginpage`) |
| 8.2 | Erhvervsevnetab + tab-underkomponenter (Oplysninger, EfterEal, Kapitalisering, LoebendeYdelser, Differencekrav, IssuesBox) | ✅ (fil `8.2-erhvervsevnetab`) |
| 8.3 | Erstatningsopgørelse-tabs (Loenindkomst, OffentligeYdelser, EOberegning, EOOplysninger) — de to største komponenter | ✅ (fil `8.3-erstatningsopgoerelse-tabs`) |
| 8.4 | EO-debug-komponenter (EODebug, Tabel, EmploymentSections, LoenSections, RegulationSections, GroupedRows, Rows) | ✅ (fil `8.4-eo-debug-komponenter`) |
| 8.5 | Forsørgertab, Varige Mén, Renteberegning, MinProcesrente-calculator | ✅ (fil `8.5-forsoergertab-varigemen-renteberegning-minprocesrente`) |
| 8.6 | Layout & UI-skal: MainLayout, StandaloneCalculatorLayout, SideMenu, Container, ContentBox(Frame), ui/, errors/, system/, reports/, common/, shared/ | ✅ (fil `8.6-layout-ui-skal`) |
| **9 — Hooks** | | ✅ |
| 9.1 | Form-/draft-hooks: usePersistedForm, useDraftField, useFormFieldErrors, useTwoStageInputActivation, selectors, rowDrafts | ✅ (fil `9.1-9.4-hooks`) |
| 9.2 | Undo/redo- og persisterings-hooks: useUndoRedo, usePersistedActiveTab, useUnsavedChangesGuard, useScrollToSectionWithRetry, useShakeFlag | ✅ (fil `9.1-9.4-hooks`) |
| 9.3 | Fil-/PWA-/devtools-hooks: useFileSaveLoad (krydsref 2.6), usePwaLaunchQueue, useDevtoolsMonitoring | ✅ (fil `9.1-9.4-hooks`) |
| 9.4 | Domæne-hooks: useAarsloenBeregning, useAslAarsloenRuleReporter, useAarsloenPdfGates, useOmregningToggle, useMidlertidigtEetInsertSource | ✅ (fil `9.1-9.4-hooks`) |
| **10 — Dokument-output (PDF + Word)** | | |
| 10.1 | Orkestrering & format-routing: `src/document/*`, pdfService, `runSelectedDocumentFormat`, `createStandardPdfWriter`, standaloneRentePdfService | ✅ (fil `10.1-orkestrering-format-routing`) |
| 10.2 | PDF-infrastruktur: jsPdfAdapter, pdfWriter, pdfLoader, pdfConfig, pdfBrevhovedRenderer, pdfDocumentAdapter | ✅ (fil `10.2-pdf-infrastruktur`) |
| 10.3 | Word/docx-infrastruktur: docxWriter, docxStyles, docxWatermark, docxTableBridge — `PdfWriter`-paritet | ✅ (fil `10.3-word-docx-infrastruktur`) |
| 10.4 | Output-shared (begge kanaler): pdfTableRenderer, pdfHelpers, pdfFormatUtils, pdfTextUtils, pdfBrevhoved, pdfOptions | ✅ (fil `10.4-output-shared`) |
| 10.5 | Generatorer I (EO-familien): eo (+sections), reguleringPdf, differencekrav, eet, kapitalisering, loebendeYdelser | ✅ (fil `10.5-generatorer-eo-familien`) |
| 10.6 | Generatorer II: aarsloen, shDage, satser, varigemen, forsoergertab, renteberegning (+oversigt), tafFordelt (+opreguleret +kravGraf +chart), krl | ✅ (fil `10.6-generatorer-ii`) |
| 10.7 | Word-paritet & duplikerings-afvikling: `src/__tests__/docx/` + `wordContentHarness`; afvikl evt. legacy/dublerede PDF-stier | ✅ (fil `10.7-word-paritet-duplikering`) |
| **11 — Config & settings** | | ✅ |
| 11.1 | Config A: persistenceVersion, dateRanges, version, buildInfo, pageNavigation, scrollToTopConfig, cellInvalidDraftScopes | ✅ (fil `11.1-config-a`) |
| 11.2 | Config B: regulatoryRates, indskudteLoentillaeg (krydsref 6.2), appTheme, tableTheme | ✅ (fil `11.2-config-b`) |
| 11.3 | Settings & auth: appSettings (schema/parse/storage), AppSettingsContext, AuthGate, auth, authConfig | ✅ (fil `11.3-settings-auth`) |
| **12 — App-shell & multi-app** | | ✅ |
| 12.1 | App-entry & bootstrap: main.tsx, App.tsx, bootstrapClientApp, serviceWorkerBootstrap, capability-gate, UnsupportedDevicePage | ✅ (fil `12.1-12.2-app-shell-multi-app`) |
| 12.2 | Standalone MinProcesrente: MinProcesrenteApp, minprocesrenteMain, StandaloneErrorBoundary, namespace-isolation | ✅ (fil `12.1-12.2-app-shell-multi-app`) |
| **13 — Testkvalitet** | | ✅ |
| 13.1 | Domæneberegninger (årsløn, EET, forsørgertab, varige mén, renteberegning, opreguleringsmotorer) | ✅ (fil `13.1-testkvalitet-domaeneberegninger`) |
| 13.2 | EO-motor, EO-snapshot, EO-debug | ✅ (fil `13.2-testkvalitet-eo-motor-snapshot-debug`) |
| 13.3 | Persistence, schema-evolution, fil-round-trip, invalidDrafts-recovery | ✅ (fil `13.3-testkvalitet-persistence-schema-roundtrip`) |
| 13.4 | Quality-/contract-guard-tests, dokument-output (PDF+Word-paritet), grid/keyboard, integration | ✅ (fil `13.4-testkvalitet-quality-dokument-output-grid`) |
| **14 — Tværgående helhed** | | ✅ |
| 14.1 | Kontrakt-alignment: `src/contracts/` vs. implementering + topology-coverage-matrix | ✅ (fil `14.1-kontrakt-alignment`) |
| 14.2 | Tværgående: duplikering, inkonsistente mønstre, dødkode, fil-placering | ✅ (fil `14.2-tvaergaaende-duplikering-doedkode`) |

---

## Åbne godkendelsespunkter (allerede committet — skal gen-forelægges og lukkes når reviewet rammer punktet)

2. **PDF/Word "TAF opreguleret til beregningsår"** → **10.6.** Nyt download-dokument; bekræft indhold/metode/afrunding. *(Reviewet i 10.6 — indhold/metode/afrunding dokumenteret; afventer brugerbekræftelse af indholdet. ✅ Brugergodkendt + rettet: `Fejl (reason)` kan ikke længere udskrives — snapshot-projektionen blokerer download fail-closed når den angivne måneds-/dagsløn mangler (`tafBeregningsgrundlagAngivetLoenMangler`), og generatoren kaster i stedet for at udskrive en teknisk kode.)*
3. **EO-output tre-tilstand (Ja/Nej/Skjul) + afslutningsvalg** → **10.5.** "Skjul" fjerner emnet helt (også fra samlet krav); "Nej" beholder overskrift + "Ingen" + 0 kr.; "Ingen" som afslutningsvalg udelader "Godkendelse"-afsnit; "én samlet I alt"; kommentarfelt i offentlige-ydelser-bilaget. *(Reviewet i 10.5 — A3/A4-guards (`skjul`/`beregnes`) bekræftet håndhævet i kode; afventer brugerbekræftelse af indholdet.)*
4. **Indstillinger-siden "Beregningsteknisk"-boks** → **11.3.** Toggle + dropdown for to device-lokale regulerings-flag flyttet fra EO-schema til `appSettings`. *(Lukket i 11.3 — forelagt og **brugergodkendt 2026-06-19**: behold device-lokalt. Bekræftet at flaggene kun ændrer validerings-severity (warning vs. error), ikke de producerede tal. Registreret som dokumenteret undtagelse i `app-settings.md` + callsite-kommentar i `appSettingsSchema.ts`; re-evaluerings-trigger noteret.)*

(Punkt 1, sygedagpenge-OP, blev lukket i 6.2.)

---

## Udskudte fund — skal udbedres ved det angivne punkt

Fund fra færdige grupper 1–7 som bevidst er parkeret til et senere punkt. **Læs den relevante blok ved start af hvert punkt nedenfor**, så de ikke glemmes. Kilde = review-doc fundet stammer fra.

### Gruppe 13 (testkvalitet) — ✅ lukket (2026-06-19)
Alle gruppe-13-fund er lukket i 13.1–13.4 (se de respektive review-docs). Tilbagestående accepteret gap (uændret):
- **13.x** — Import-script `scripts/import-offentlig-loen.mjs` uden unit-tests (accepteret gap; engangs-dataimport, ikke produktions-runtime). *(Kilde 6.3)*

### Gruppe 14 (tværgående helhed) — ✅ behandlet (2026-06-19; se `14.1-*.md` + `14.2-*.md`)

Lukket i 14.1/14.2: §6.5-omskrivning; kontrakt-konsolideringsbeslutninger (ingen merge); løntrin-finder-overlay ekstraheret; show-rest-flag → delt domæne-helper; dødkode (`periodiserBeloeb*`, `computeTafEngine`, `ValidationErrorMap`); `replaceValues`; pass-through (`formatOverenskomst*`, `formatPercentTrimmedFromRounded4`, `setDocumentFooterBrand`); inline-konstanter (`SKAERING_2015_03_01`, `isoYear`); `aarsloenRowInterval`-flytning; toggle-shake; percent-parser-verifikation (ingen ændring); EODebug-label (var allerede konvergeret til "Arbejdssted N").

**Forelagt bruger — besluttet og gennemført (2026-06-19, brugergodkendt):**
- **14.2** — Celle-fejl-sporing (M3/H2): ✅ committed-gate i `OffentligeYdelserTable` fjernet (lukker H2-hul der kunne tabe celle-fejl → Gem ikke blokeret); alle tre tabeller nu ensartet gate-løse. Fuld delt hook fravalgt med begrundelse (tre forskellige validerings-builders → ingen reel forenkling). *(Kilde 7.4)*
- **14.2** — `RenteberegningTab` download-gate: ✅ beregnes nu direkte fra committed `committedRentekravById` (`computeRentekravRow`); child→parent-draft-callback fjernet. På linje med §2.4. *(Kilde 8.5)*
- **14.2** — SFGG-6-måneders-advarsel: ✅ vist som inline-note i Sygeferiegodtgørelse-sektionen (snapshot-afledt `sfggSixMonthWarningEmploymentIds`, brugergodkendt tekst). *(Kilde 4.9)*
- **14.2** — `EetDifferencekravTab` `koen`: ✅ afklaret — `koen` er kun læse-visning dér; køn-kravet vises som almindelig EET-beregningsbesked (issues-boks) og det redigerbare felt + central fejl-rapportering ligger kanonisk i EO Oplysninger. Allerede ensartet; ingen ændring. *(Kilde 8.2)*

**Parkeret (lav værdi / DEV-only / kræver dedikeret runde):**
- **14.2** — `EODebugEmploymentSections` regulerings-rækkers dedup/ordering label-matchet i render-laget → viewmodel keyed på row-id'er (DEV-only; reorder-risiko, planlagt). *(Kilde 8.4)*
- **14.2** — Skipede kort-/sektion-ekstraktioner i de to dekomponerede EO-tabs (kræver per-ansættelsesforhold view-model først). *(Kilde 8.3)*
- **14.2** — Word-test `as never`-fixtures (~12 steder) → typede partial-builders; fuldt afstemmende Word-multi-sektions-fixture for `offentligeYdelser`/`regulering` (lav drift-risiko; tests asserterer allerede konkrete værdier). *(Kilde 13.4)*

---

## Reviewinstruktion

Hvert punkt gennemgår den relevante del af Mineo, **retter fundene**, og kontrollerer fire dimensioner:

1. **Kodekvalitet og korrekthed** — fri for fejl der kan give forkerte beregninger, datatab eller inkonsistent tilstand?
2. **Struktur og arkitektur** — følger koden kontrakterne? Klare laggrænser? Én rød tråd, eller samme problem løst flere måder?
3. **Robusthed** — crasher/fejler ved manglende, ugyldige eller usædvanlige inputkombinationer?
4. **Konvergens** — bragt på linje med principperne fra de tidligere (mere fundamentale) punkter?

### Hvad arbejdet skal afdække og rette

- **Korrekthed/determinisme:** afhængighed af render-timing, sideeffekter, implicit cast, locale, tidszoner, floating-point. Uhåndhævede invarianter. Inkonsistente afledte værdier / partielle state-opdateringer. Afvigelser fra kanoniske helpers (afrunding/format/valuta). Fail-closed-stier der reelt fejler (ikke maskeret af nul-år-skip eller tom-liste-gren).
- **Crash/inputrobusthed:** tomme felter, `undefined`/`null`/`NaN`/0/negative/fremtidige datoer/datoer udenfor lovlige intervaller. Felter gyldige hver for sig men ugyldige sammen (dato A efter dato B). Manglende guards før beregning / ved load. Array-ops der antager ≥1 element. Division med 0.
- **Arkitektur/grænser:** brud på `src/contracts/*.md` + `AGENTS.md`. Overcoupling (UI med beregningslogik; beregning der importerer UI). Uklar ejerskab. Duplikerede sandheder.
- **Type-sikkerhed:** Zod↔TS-mismatches ("type lies"). Usikre `as`/`!`/`any`/implicit narrowing. Persisteret input fuldt Zod-dækket.
- **Tests:** manglende dækning af beregning/validering/round-trip/edge cases. Tests der tester implementeringsdetaljer frem for invarianter; flakiness; over-mocking. Mindst ét top-level `describe(...)` pr. fil.
- **Kompleksitet:** unødvendig indirektion, dødkode, ubrugte exports, for store/overlappende filer. Bemærk særligt `LoenindkomstTab.tsx` (~133 KB) og `EOOplysningerTab.tsx` (~124 KB) — kandidater til opdeling i gruppe 8.

### Dokumentationsformat (én fil pr. punkt, `docs/review/[punkt]-[navn].md`)

```
# Punkt: [nummer] [navn]
**Dato:** ÅÅÅÅ-MM-DD
**Filer gennemgået:** [liste]   **Filer ikke gennemgået:** [hvis relevant]
**Tests kørt:** [kommando + resultat]

## Fund og rettelser
[Nummereret. Pr. fund: severity, lokation, problem, risiko, HANDLING:
 ✅ Rettet — beskrivelse | ⏸ Afventer godkendelse — forslag+konsekvens | ⏭ Ikke rettet — begrundelse]

## Tilfældighedsfund
[Alt udenfor punktets scope, samme handlingsmarkering. Peger fundet på et senere punkt → tilføj det også til "Udskudte fund" i denne plan.]

## Sammenfatning
[2–5 bullets: vigtigste rettelser, åbne godkendelsespunkter, konvergens.]
```

**Severity:** Kritisk (forkerte beregninger/datatab/brudte invarianter) · Høj (arkitekturfejl/type-usikkerhed/manglende validering med reel risiko) · Medium (kompleksitet/duplikering/manglende tests) · Lav (inkonsistens/oprydning).

---

## Proces

1. Vælg næste **ikke-startede** punkt (følg rækkefølgen).
2. **Læs blokken for punktet i "Udskudte fund" ovenfor.**
3. Gennemgå punktets filer + direkte afhængigheder; markér hvad der er/ikke er gennemgået. Uddelegér gerne brede gennemgange til subagents.
4. Ret fundene (kode direkte; UI/UX + beregningslogik forelægges). Nye fund der hører til et senere punkt → tilføj til "Udskudte fund".
5. Kør tests efter kvalitetsgaten i `AGENTS.md` (smalleste tjek der fanger fejl; udvid efter risikoflade). Rapportér ærligt.
6. Dokumentér i `docs/review/[punkt]-[navn].md`; opdatér statustabel til ✅ og fjern de afsluttede poster fra "Udskudte fund".

Et punkt behøver ikke dække hver fil i en mappe — scope = en sammenhængende arbejdsenhed. Filer der hører til et andet punkt krydsrefereres.

**Statusværdier:** ⬜ Ikke startet · 🟡 I gang (åbne fund/godkendelser) · ✅ Gennemgået (rettet/parkeret, tests grønne, dokumenteret).

### Rækkefølgerationale (nedefra og op)

| Gruppe | Begrundelse |
|---|---|
| 1 Kontrakter | Normative; styrer alt øvrigt. |
| 2 Persistence | Alt afhænger af korrekt gem/load. |
| 3 Schemas | Grænseflade til persistence + beregning. |
| 4 Domænelogik | Systemets hjerte; opreguleringsmotor (4.0) er fundament. |
| 5 Hjælpefunktioner | Utilities brugt af al domænelogik. |
| 6 Data | Statiske data forudsætning for korrekte beregninger. |
| 7 UI-inputs & grid | Grænseflade mod beregningslagene. |
| 8 Pages | Sammensætning af input + præsentation. |
| 9 Hooks | Lim mellem UI og domæne. |
| 10 Dokument-output | Outputkanal (PDF+Word) over domænedata. |
| 11 Config & settings | Rammeværk og opsætning. |
| 12 App-shell & multi-app | Sammenbinding + multi-app-isolation. |
| 13 Testkvalitet | Verificerer de foregående punkter. |
| 14 Tværgående helhed | Endelig kontrakt-alignment + duplikering. |
