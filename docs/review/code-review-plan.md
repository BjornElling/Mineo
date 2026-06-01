# Review- og refaktoreringsplan — Mineo

> **Formål:** Gennemarbejde hele Mineos kodebase systematisk, **rette alle fund undervejs**, og efterlade en kodebase bygget på ensartede, velstrukturerede principper med en klar rød tråd. Planen er ikke kun et review — den er en arbejdsplan for at hæve hele programmet til den ønskede arkitektur- og kvalitetsstandard (jf. `CLAUDE.md`).

## Arbejdsprincip: indefra og ud

Planen følger **afhængighedsorden nedefra og op** — det fundamentale først, det konkrete sidst. Hvert hovedpunkt **færdiggøres og rettes fuldt ud**, før det næste påbegyndes, så senere lag altid bygger på et allerede konsolideret fundament:

1. **Kortlæg fundamentet** — kontrakter og arkitektur-dokumentation (gruppe 1). Her fastlægges de principper, resten håndhæves imod. Fejl rettes i kontrakterne selv, hvis de står i vejen for det bedste slutprodukt.
2. **De bærende lag** — persistence (2), schemas (3), domænelogik (4), hjælpefunktioner (5), data (6). Programmets korrekthed afgøres her.
3. **De konkrete udmøntninger** — UI-inputs (7), pages (8), hooks (9), PDF (10), config (11) og app-shell (12).
4. **Verifikation og helhed** — testkvalitet (13) og tværgående oprydning (14).

**Disciplin:** Et hovedpunkt regnes først som færdigt, når (a) alle fund er rettet eller eksplicit forelagt/parkeret med begrundelse, og (b) relevante tests er kørt grønt. UI/UX- og beregningslogik-ændringer forelægges til godkendelse undervejs, men resten af punktet kan færdiggøres i mellemtiden.

---

## Status

| Punkt | Navn | Status | Fil |
|---|---|---|---|
| **1 — Kontrakter & arkitektur (kortlægning af fundamentet)** | | | |
| 1.1 | Kontrakt-topologi: `contract-topology.json`, `contract-template.md`, topology-procedure + coverage-matrix-test | ✅ Gennemgået | [1.1-kontrakt-topologi.md](1.1-kontrakt-topologi.md) |
| 1.2 | Tværgående kontrakter A: domain-boundary, form, persistence, schema-evolution | ✅ Gennemgået | [1.2-tvaergaaende-kontrakter-a.md](1.2-tvaergaaende-kontrakter-a.md) |
| 1.3 | Tværgående kontrakter B: date, mineo-field-pattern, amount, undo-redo, app-settings | ✅ Gennemgået | [1.3-tvaergaaende-kontrakter-b.md](1.3-tvaergaaende-kontrakter-b.md) |
| 1.4 | Tværgående kontrakter C: periodisering, error-debug, keyboard-navigation, pdf, pdf-layout | ✅ Gennemgået | [1.4-tvaergaaende-kontrakter-c.md](1.4-tvaergaaende-kontrakter-c.md) |
| 1.5 | Domæne-kontrakter: snapshot, eo-snapshot, eet-snapshot, forsoergertab-snapshot, aarsloen, renteberegning, varigemen, satser | ✅ Gennemgået | [1.5-domaene-kontrakter.md](1.5-domaene-kontrakter.md) |
| 1.6 | Page-component-kontrakten + arkitektur-docs: calculation, pdf, debug-builder, undo-redo, auth-gate | ✅ Gennemgået | [1.6-page-component-og-arkitektur-docs.md](1.6-page-component-og-arkitektur-docs.md) |
| 1.7 | Helhedsvurdering af kontraktlandskabet og de arkitektoniske grundprincipper | ✅ Gennemgået | [1.7-helhedsvurdering-kontraktlandskab.md](1.7-helhedsvurdering-kontraktlandskab.md) |
| **2 — Persistence** | | | |
| 2.1 | Persistence-arkitektur: store, read-model, registry, storageManifest | ✅ Gennemgået | [2.1-persistence-arkitektur.md](2.1-persistence-arkitektur.md) |
| 2.2 | Undo/redo-store og fokus-restore | ✅ Gennemgået | [2.2-undo-redo-store-og-fokus-restore.md](2.2-undo-redo-store-og-fokus-restore.md) |
| 2.3 | FormPersistenceContext (public/internal/shared) og useFormPersistence | ✅ Gennemgået | [2.3-formpersistencecontext.md](2.3-formpersistencecontext.md) |
| 2.4 | Persistence: load, apply, sanitering, session-hydration, snapshot-storage | ✅ Gennemgået | [2.4-persistence-load-apply-sanitering-hydration.md](2.4-persistence-load-apply-sanitering-hydration.md) |
| 2.5 | Schema-evolution, migrations og versionering (persistenceVersion, fingerprint) | ✅ Gennemgået | [2.5-schema-evolution-migrations-versionering.md](2.5-schema-evolution-migrations-versionering.md) |<br>↳ _Fra 1.2: ✅ konsolideret — schema-evolution §3.1a ejer migrator-rækkefølgen, persistence-contract §6 henviser._ |
| 2.6 | Fil-I/O: save/load, encryption, file-system-access, file-handle-storage | ✅ Gennemgået | [2.6-fil-io-encryption-fs-access.md](2.6-fil-io-encryption-fs-access.md) |
| **3 — Schemas** | | | |
| 3.1 | Schema-fundament: formSchemas-entry, baseSchemas, enumSchemas, amountExpressionSchema | ✅ Gennemgået | [3.1-schema-fundament.md](3.1-schema-fundament.md) |
| 3.2 | Section-schemas A: stamdata, satser, aarsloen, faellesAarsloen | ✅ Gennemgået | [3.2-section-schemas-a.md](3.2-section-schemas-a.md) |<br>↳ _Åbent til 4.2: aarsloenSchema har required felter uden default — vurder load-semantik sammen med beregningsrollen._ |
| 3.3 | Section-schemas B: erstatningsopgoerelse, erhvervsevnetab, forsoergertab | ✅ Gennemgået | [3.3-section-schemas-b.md](3.3-section-schemas-b.md) |
| 3.4 | Section-schemas C: renteberegning, varigeMen + eoFileSchema (download/upload) | ✅ Gennemgået | [3.4-section-schemas-c-og-eofile.md](3.4-section-schemas-c-og-eofile.md) |
| 3.5 | Schema-fingerprint og save-order-registry | ✅ Gennemgået | [3.5-schema-fingerprint-og-save-order-registry.md](3.5-schema-fingerprint-og-save-order-registry.md) |
| **4 — Domænelogik (beregningskernen)** | | | |
| 4.1 | Stamdata, satser og policies (stamdataCalculations, satserCalculations, aarsloenPolicy) | ✅ Gennemgået | [4.1-stamdata-satser-policies.md](4.1-stamdata-satser-policies.md) |
| 4.2 | Årsløn: aarsloen + aslEalAarsloen (beregning, validering, periodevisning) | ✅ Gennemgået | [4.2-aarsloen.md](4.2-aarsloen.md) |<br>↳ _Fra 3.2: ✅ afgjort — aarsloenSchemas required felter er v1.0-originaler; fail-closed er korrekt, ingen default-injektion._ |
| 4.3 | EET: kernemotor, ASL/EAL, differencekrav, skæringsdatoer, typer | ✅ Gennemgået | [4.3-eet-kerne-asl-eal-differencekrav.md](4.3-eet-kerne-asl-eal-differencekrav.md) |
| 4.4 | EET: kapitalisering, løbende ydelser, mer-erstatning ved forhøjet pensionsalder, regulering | ✅ Gennemgået | [4.4-eet-kapitalisering-loebende-mer-regulering.md](4.4-eet-kapitalisering-loebende-mer-regulering.md) |
| 4.5 | Forsørgertab: beregning, ASL-ydelser, EAL-krav, snapshot | ✅ Gennemgået | [4.5-forsoergertab.md](4.5-forsoergertab.md) |
| 4.6 | Varige Mén: motor og beregninger | ✅ Gennemgået | [4.6-varige-men.md](4.6-varige-men.md) |
| 4.7 | Renteberegning: motor, procesrente, principper, validering, tabelmodel | ✅ Gennemgået | [4.7-renteberegning.md](4.7-renteberegning.md) |
| 4.8 | EO-engines I: periodiseringsmotor, period-merging/overlap/range-groups, ferie, arbejdsdage | ✅ Gennemgået | [4.8-eo-engines-i-periodisering.md](4.8-eo-engines-i-periodisering.md) |
| 4.9 | EO-engines II: TAF (calculations, engine, netto, per-year, day-sets), forligsgrad, svie/smerte | ✅ Gennemgået | [4.9-eo-engines-ii-taf-forligsgrad-svie-smerte.md](4.9-eo-engines-ii-taf-forligsgrad-svie-smerte.md) |
| 4.10 | EO-engines III: løn-/ydelsesudvikling og regulering (loenudvikling, offentligeYdelser, regulerings*) | ✅ Gennemgået | [4.10-eo-engines-iii-loenudvikling-regulering.md](4.10-eo-engines-iii-loenudvikling-regulering.md) |
| 4.11 | EO: helpers, initial values, row-derived og tabel-modeller | ✅ Gennemgået | [4.11-eo-helpers-initial-values-tabeller.md](4.11-eo-helpers-initial-values-tabeller.md) |
| 4.12 | EO: validation-lag og erstatningsopgoerelseValidator | ✅ Gennemgået | [4.12-eo-validation-lag.md](4.12-eo-validation-lag.md) |
| 4.13 | EO: snapshot, presentation-model, canonical output og invarianter | ✅ Gennemgået | [4.13-eo-snapshot-presentation-canonical.md](4.13-eo-snapshot-presentation-canonical.md) |<br>↳ _Fra 1.5: ✅ løst — detaljeret TAF-/svie-behandlingsrækkefølge flyttet til `docs/architecture/eo-clamping-pipeline-architecture.md`; kontrakt §2.3 beholder de bindende invarianter._ |
| 4.14 | EO-debug: view-model, regulation/loen/indkomst-modeller, parity, severity, navigation | ✅ Gennemgået | [4.14-eo-debug-viewmodels-parity-severity-navigation.md](4.14-eo-debug-viewmodels-parity-severity-navigation.md) |
| **5 — Hjælpefunktioner** | | | |
| 5.1 | Datohåndtering: isoDate, dateCommit, dateUtils, dateFormatting, isoDateHelpers, draft-normalisering | ✅ Gennemgået | [5.1-datohaandtering-kerne.md](5.1-datohaandtering-kerne.md) |
| 5.2 | Datohåndtering: input-validering, range-errors, dato-ordens-validering, utcDayMath | ✅ Gennemgået | [5.2-datohaandtering-validering.md](5.2-datohaandtering-validering.md) |
| 5.3 | SH-dage: beregning og oversigt (shDageBeregning, shDageOversigt) | ✅ Gennemgået | [5.3-sh-dage.md](5.3-sh-dage.md) |
| 5.4 | Talbehandling: parsing, expression-amount, afrunding, percent, fraction, sammenligning | ✅ Gennemgået | [5.4-talbehandling.md](5.4-talbehandling.md) |
| 5.5 | Øvrige utils: serialization, typeGuards, zod-issue-formatting, safeComputation, tabel-/row-helpers | ✅ Gennemgået | [5.5-oevrige-utils.md](5.5-oevrige-utils.md) |
| **6 — Data** | | | |
| 6.1 | Renter og lovbestemte/statistiske rater: interestRates, lovbestemteRates, statistiskeRates | ✅ Gennemgået | [6.1-renter-lovbestemte-statistiske-rater.md](6.1-renter-lovbestemte-statistiske-rater.md) |<br>↳ _✅ Afklaret: `vejledendeUdtalelseEet`-diskontinuitet bekræftet korrekt af bruger; dokumenteret i kode._ |
| 6.2 | Folkepension, sygedagpenge, overenskomst, KRL, ydelsestyper, retsinfo-links | ✅ Gennemgået | [6.2-folkepension-sygedagpenge-overenskomst-krl-ydelsestyper-retsinfo.md](6.2-folkepension-sygedagpenge-overenskomst-krl-ydelsestyper-retsinfo.md) |
| 6.3 | Offentlig løn: KL- og RLTN-satser, lookup, typer, import-script | ✅ Gennemgået | [6.3-offentlig-loen.md](6.3-offentlig-loen.md) |<br>↳ _⏭ Parkeret: `import:loen`-script fejler på de ældste `.xls`-filer (legacy-layout) — forelagt; data er korrekt og valideret._ |
| 6.4 | Kapitaliseringstabeller, bekendtgørelser og forhøjet-pensionsalder-events | ✅ Gennemgået | [6.4-kapitalisering-bekendtgoerelser-pensionsalder.md](6.4-kapitalisering-bekendtgoerelser-pensionsalder.md) |
| **7 — UI-inputs & grid** | | | |
| 7.1 | StyledField-familien: amount, date, integer, percent, fraction, week, year, text(area), dropdown, checkbox, radio, toggle | ⬜ Ikke startet | — |
| 7.2 | Table-inputs og adaptere (inputs/table + hooks/tableInput/adapters) + inputKeyFilters | ⬜ Ikke startet | — |
| 7.3 | Grid-infrastruktur: gridCore (registry, context, navigation, focus, types, ux-spec) | ⬜ Ikke startet | — |
| 7.4 | Tabel-komponenter: standard-tabeller (display/grid/loose/virtualized) og domæne-tabeller | ⬜ Ikke startet | — |
| **8 — Pages** | | | |
| 8.1 | Page-komponenter: Stamdata, Årsløn, Satser, Mineo (forside), Indstillinger | ⬜ Ikke startet | — |
| 8.2 | Page-komponenter: Erhvervsevnetab og underkomponenter | ⬜ Ikke startet | — |
| 8.3 | Page-komponenter: Erstatningsopgørelse (Loenindkomst, OffentligeYdelser, EOberegning, EOOplysninger) | ⬜ Ikke startet | — |
| 8.4 | Page-komponenter: EO-debug-komponenter | ⬜ Ikke startet | — |
| 8.5 | Page-komponenter: Forsørgertab, Varige Mén, Renteberegning, MinProcesrente | ⬜ Ikke startet | — |
| 8.6 | Layout & UI-skal: MainLayout, StandaloneCalculatorLayout, SideMenu, Container, ContentBox, ui/, errors/ | ⬜ Ikke startet | — |
| **9 — Hooks** | | | |
| 9.1 | Form-/draft-hooks: usePersistedForm, useDraftField, useFieldBehavior, useTwoStageInputActivation, rowDrafts | ⬜ Ikke startet | — |
| 9.2 | Undo/redo- og persisterings-hooks: useUndoRedo, useTableInputHistoryRestore, usePersistedActiveTab | ⬜ Ikke startet | — |
| 9.3 | Fil-/PWA-/guard-hooks: useFileSaveLoad, usePwaLaunchQueue, useUnsavedChangesGuard, useDevtoolsMonitoring | ⬜ Ikke startet | — |
| 9.4 | Domæne-hooks: useAarsloenBeregning, useAslAarsloenRuleReporter, useAarsloenPdfGates, useOmregningToggle, useMidlertidigtEetInsertSource | ⬜ Ikke startet | — |
| **10 — PDF** | | | |
| 10.1 | PDF-infrastruktur: pdfService, jsPdfAdapter, pdfWriter/loader, brevhoved, config | ⬜ Ikke startet | — |
| 10.2 | PDF-shared: tekst, tabel-renderer, format-utils, options, helpers | ⬜ Ikke startet | — |
| 10.3 | PDF-domæner I: eo (+ sections), differencekrav, eet, kapitalisering, loebendeYdelser | ⬜ Ikke startet | — |
| 10.4 | PDF-domæner II: aarsloen, satser, varigemen, forsoergertab, renteberegning, tafFordelt, krl | ⬜ Ikke startet | — |
| 10.5 | Legacy-PDF-konsolidering: `src/domain/erstatningsopgoerelse/pdf/*` vs. `src/pdf/*` — afklar og afvikl duplikering | ⬜ Ikke startet | — |
| **11 — Config & settings** | | | |
| 11.1 | Config: persistenceRegistry, storageManifest, persistenceVersion, dateRanges, version, scrollToTop | ⬜ Ikke startet | — |
| 11.2 | Config: regulatoryRates, appTheme, tableTheme | ⬜ Ikke startet | — |
| 11.3 | Settings & auth: appSettings (schema/parse/storage), AuthGate, auth, authConfig | ⬜ Ikke startet | — |<br>↳ _Fra 1.6/1.7: beslut auth-kontraktstatus — enten nedgradér `auth-gate-architecture.md`'s bydende regler til ren informativ, eller opret `auth-gate-contract.md` (normativ) + registrér i topologi + coverage-matrix. MEMORY behandler reglen de facto som bindende, hvilket taler for kontrakt-eleveringen._ |
| **12 — App-shell & multi-app** | | | |
| 12.1 | App-entry & bootstrap: main.tsx, App.tsx, apps/shared/bootstrapClientApp, mineo/serviceWorkerBootstrap | ⬜ Ikke startet | — |<br>↳ _Fra 1.6/1.7: opret en `app-shell-contract.md` (tværgående) der ejer entry-points, device-gate-placering (`bootstrapClientApp.tsx`) og multi-app-isolation; lad `page-component-contract.md` referere til den. App-shell-laget mangler i dag en ejer-kontrakt._ |
| 12.2 | Standalone MinProcesrente-app: MinProcesrenteApp, minprocesrenteMain, StandaloneErrorBoundary, isolation | ⬜ Ikke startet | — |
| **13 — Testkvalitet** | | | |
| 13.1 | Testkvalitet: domæneberegninger (årsløn, EET, forsørgertab, varige mén, renteberegning) | ⬜ Ikke startet | — |
| 13.2 | Testkvalitet: EO-motor, EO-snapshot og EO-debug | ⬜ Ikke startet | — |
| 13.3 | Testkvalitet: persistence, schema-evolution og fil-round-trip | ⬜ Ikke startet | — |
| 13.4 | Testkvalitet: quality-/contract-guard-tests og integrationsdækning | ⬜ Ikke startet | — |
| **14 — Tværgående helhed** | | | |
| 14.1 | Kontrakt-alignment: `src/contracts/` vs. faktisk implementering (efter alle rettelser) | ⬜ Ikke startet | — |
| 14.2 | Tværgående: duplikering, inkonsistente mønstre og dødkode på tværs af hele kodebasen | ⬜ Ikke startet | — |

> 11.3-punktet om auth var tidligere markeret som "fjernet". **Auth findes stadig** (`src/auth/`, `docs/architecture/auth-gate-architecture.md`, wired via `AuthGate` i app-bootstrap) og er nu genindført i scope.

---

## Reviewinstruktion

### Formål

Hvert punkt gennemgår den relevante del af Mineo, **retter fundene**, og kontrollerer fire dimensioner:

1. **Kodekvalitet og korrekthed** — Er koden fri for fejl, der kan producere forkerte beregninger, datatab eller inkonsistent tilstand?
2. **Struktur og arkitektur** — Følger koden de etablerede kontrakter og mønstre? Er grænser mellem lag klare og konsistente? Er der én rød tråd, eller løses samme problem på flere måder?
3. **Robusthed over for inputkombinationer** — Crasher eller fejler programmet ved manglende, ugyldige eller usædvanlige kombinationer af brugerinput?
4. **Konvergens** — Er dette punkt bragt på linje med de principper, der blev fastlagt i de tidligere (mere fundamentale) punkter?

Punktet afsluttes med rettelser gennemført og tests kørt. Fund der berører UI/UX eller beregningslogik forelægges til godkendelse, jf. `CLAUDE.md`.

---

### Hvad arbejdet skal afdække og rette

#### Korrekthed og determinisme
- Beregninger der afhænger af render-timing, sideeffekter, implicit typecasting, locale, tidszoner eller floating-point-afrunding.
- Invarianter der ikke er håndhævet af typer, Zod-schemas eller tests.
- Stier der kan producere inkonsistente afledte værdier eller partielle state-opdateringer.
- Numerisk logik der afviger fra projektets kanoniske helpers for afrunding, formatering og valuta. Konvergér mod én kanonisk løsning.

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

#### Type-sikkerhed
- Zod ↔ TypeScript-mismatches ("type lies").
- Usikre assertions (`as`, `!`), `any`, implicit narrowing.
- Manglende validering ved domænegrænser.

#### Tests
- Manglende dækning af beregninger, validering, save/load round-trip og edge cases.
- Tests der tester implementeringsdetaljer frem for invarianter. Flakiness og over-mocking.

#### Kompleksitet og vedligeholdbarhed
- Unødvendig indirektion og accidental complexity.
- Duplikeret logik, dødkode og ubrugte exports.
- Filer der er for store eller har for mange ansvarsområder (split), eller overlapper i ansvar (konsolidér).

---

### Særlig instruktion til gruppe 1 — kontrakter og arkitektur-dokumentation

Punkterne 1.1–1.7 arbejder ikke med almindelig kode, men med de normative dokumenter i `src/contracts/*.md` (incl. den maskinlæsbare `contract-topology.json`) og de informative `docs/architecture/*.md`. Disse dokumenter er fundamentet, resten håndhæves imod. Derfor kortlægges de **først** — og med bredere optik end den øvrige kode.

**Topologien er autoritativ for rækkefølgen.** `contract-topology.json` klassificerer kontrakterne i fire lag (`domain-specific` → `cross-cutting` → `page-component` → `architecture-document`) med en eksplicit prioritetsorden. Gruppe 1 følger denne klassifikation frem for alfabetisk batching:

- **1.1** etablerer selve topologi-maskineriet: er `contract-topology.json`, `contract-template.md`, `contract-topology-procedure.md` og `contractCoverageMatrix.test.ts` indbyrdes konsistente, og dækker de faktisk alle kontraktfiler i `src/contracts/`?
- **1.2–1.4** dækker de 14 tværgående kontrakter, grupperet tematisk (state/persistence · felt-/dato-/beløbsmønstre · periodisering/fejl/PDF/keyboard).
- **1.5** dækker de 8 domæne-kontrakter.
- **1.6** dækker page-component-kontrakten (der er subordinat til alle tværgående) plus de 5 arkitektur-docs.
- **1.7** er helhedsvurderingen.

For hvert kontraktdokument besvares to dimensioner:

**Dimension A — Korrekthed og fyldestgørelse (intern konsistens):**
- Er kontraktens regler entydige, modsigelsesfri og operationaliserbare?
- Mangler der dækning af kendte cases (edge cases, fejlhåndtering, tværgående scenarier)?
- Er implementeringen drevet ud over kontraktens dækning (kontrakten "halter bagud")?
- Er kontrakten stadig sand i forhold til den nuværende kode (kontraktdrift)?
- Er ansvar og ejerskab klart afgrænset mod tilstødende kontrakter? Overlap eller huller?
- Er terminologien konsistent på tværs af kontrakter (samme begreb = samme ord)?

**Dimension B — Arkitektonisk kritik (de bagvedliggende valg):**
- Er de grundprincipper kontrakten hviler på de rigtige? Ville Mineo være bedre bygget på andre principper?
- Er ansvarsfordelingen mellem lag (app-shell · UI · hooks · domæne · persistence · PDF) optimal, eller ligger grænser forkert?
- Er der kontrakter der bør slås sammen, splittes, omfordeles eller afskaffes?
- Mangler der kontrakter for områder der i dag styres af konvention eller implicit aftale (fx multi-app-isolation, app-shell/bootstrap)?
- Er der invarianter der håndhæves runtime, men burde løftes ind i typer/schemas — eller omvendt?
- Er kontrakten på det rigtige abstraktionsniveau? For abstrakt = svag styring; for konkret = bremser udvikling.

Output for gruppe 1 skal — udover det normale fund-format — indeholde en sektion **"Arkitektoniske grundprincipper"**, der eksplicit tager stilling til, om kontraktens fundament er sundt, og hvis ikke, hvilke alternative principper der ville give et bedre system. Forslag skal være konkrete, begrundede og knyttet til faktiske smertepunkter.

**Kontrakter er kun bindende, så længe de understøtter det bedste slutprodukt** (jf. `CLAUDE.md`). Hvis en kontrakt står i vejen, forbedres/optimeres kontrakten — i samme commit som topology-JSON og coverage-matrix-test opdateres (jf. `contract-topology-procedure.md`). Kontraktændringer behandles som arkitekturbeslutninger: berører de ikke UI/UX eller beregningslogik, gennemføres de direkte; ellers forelægges de.

Punkt 1.7 er en helhedsvurdering, der bygger på fundene fra 1.1–1.6 og adresserer kontraktlandskabet samlet — herunder strukturelle huller, om hierarkiet `src/contracts/*.md > AGENTS.md > CLAUDE.md` er fornuftigt, og om kontrakternes samlede dækning matcher Mineos faktiske kompleksitet (nu inkl. multi-app-arkitekturen).

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
| **2 — Persistence** | Store, context, load/apply, schema-evolution, fil-I/O | Alt andet afhænger af, at data gemmes og loades korrekt. |
| **3 — Schemas** | Alle Zod-schemas | Schemas definerer grænsefladen til persistence og beregning. |
| **4 — Domænelogik** | Alle beregninger (kernen) | Hjertet i systemet — bringes i orden før UI. |
| **5 — Hjælpefunktioner** | Dato, tal, serialisering, tabel-helpers | Fundamentale utilities brugt af al domænelogik. |
| **6 — Data** | Ratetabeller og opslag | Statiske data der er forudsætning for korrekte beregninger. |
| **7 — UI-inputs & grid** | Input-komponenter og grid-infrastruktur | Grænsefladen mod beregningslagene. |
| **8 — Pages** | Sider og layout | Sammensætning af input og præsentation. |
| **9 — Hooks** | Custom React hooks | Lim mellem UI og domæne. |
| **10 — PDF** | PDF-generering (ny `src/pdf/` + legacy domæne-PDF) | Separat outputkanal; afhænger af domænedata. Inkluderer afvikling af gammel/ny PDF-duplikering. |
| **11 — Config & settings** | Konfiguration, settings, auth | Rammeværk og applikationsopsætning. |
| **12 — App-shell & multi-app** | Entry points, bootstrap, standalone-app | Sammenbindingen af det hele; multi-app-isolation. |
| **13 — Testkvalitet** | Tests for ovenstående | Verificerer, at de foregående punkter er testsikrede. |
| **14 — Tværgående helhed** | Kontrakt-alignment og duplikering | Endelig helhedsvurdering, når alle dele er bragt i orden. |

---

## Procesbeskrivelse

1. Vælg næste **ikke-startede** punkt (følg rækkefølgen — fundamentet før udmøntningerne).
2. Gennemgå punktets filer og deres direkte afhængigheder. Marker eksplicit, hvad der er gennemgået, og hvad der ikke er.
3. **Ret fundene:** koderelaterede rettelser gennemføres direkte; UI/UX- og beregningslogik-fund forelægges til godkendelse.
4. Kør relevante tests og rapportér resultatet ærligt.
5. Dokumentér i `docs/review/[punkt]-[navn].md` efter formatet ovenfor.
6. Opdater statustabellen til ✅ Gennemgået med link til filen.
7. Gå først videre til næste punkt, når dette er færdigt (rettet + testet, eller åbne punkter eksplicit parkeret).

Et punkt behøver ikke dække hver eneste fil i en mappe — scope er det, der giver mening som en sammenhængende arbejdsenhed.

### Statusværdier
- ⬜ **Ikke startet**
- 🟡 **I gang** — påbegyndt; har åbne fund eller godkendelsespunkter
- ✅ **Gennemgået** — alle fund rettet eller eksplicit parkeret, tests grønne, dokumenteret
