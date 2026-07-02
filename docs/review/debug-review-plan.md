# Debug — sproglig oprydning af betegnelsen "debug" i hele programmet

Dette er arbejdsgrundlaget for en **rent sproglig oprydning** af, hvor og hvordan
ordet `debug` bruges i Mineo. Formålet er at kortlægge — og derefter rette — hvor
`debug` er brugt **korrekt** (ægte fejlsøgning/diagnostik) kontra hvor det er lækket
ind som navn på ting, der reelt er **almindelig visning, præsentation, view-model,
beregning eller parity-kontrol**.

Dette er **ikke** en adfærdsændring. Ingen beregning, gate, invariant eller UI-flow
må ændre semantik. Ændringerne er symbol-/fil-/kommentar-omdøbninger og de
kontrakt-/test-opdateringer, en omdøbning tvinger frem. `AGENTS.md` fastlægger
mandat: en kontraktændring der **ikke** berører UI/UX eller beregningslogik træffes
selv; en brugervendt label-ændring (fanenavne, indstillinger) berører UX og
**forelægges**. Ved konflikt gælder `src/contracts/*.md` over denne plan.

## Hvorfor dette review — hvad mistanken bygger på

Erstatningsopgørelse-siden har to sidefaner, der i UI hedder **"EO debug"** og
**"Debug tabel"**. Brugerens beskrivelse: det er **rene visnings-sider**, hvis eneste
formål er visuelt at hjælpe med at identificere årsagen til fejl samt at periodisere
indkomster til samme formål. Den eneste tilnærmede beregningslogik knyttet til dem er,
at tabelvisningens egne værdier **sammenholdes med motorens** for at kontrollere, at de
er identiske (parity/kontrol).

Kortlægningen (se katalog nedenfor) bekræfter mistanken og skærper den på ét punkt:

- Ordet `debug` er **systematisk lækket** fra disse to visnings-faner ud i domæne-,
  util-, snapshot-, settings- og test-navngivning, hvor det reelt betegner
  **præsentation/visning/view-model** — ikke fejlsøgning.
- Kodebasen er allerede **selv bevidst** om spændingen. `eoRowAggregator.ts` kalder
  sig "debug-frit" og "ikke bare debug", mens den samtidig navngiver alt `Debug`, fordi
  det føder visnings-fanen. `EODebugRegulationSections.tsx` dokumenterer sig selv som
  "render-only, ingen beregninger" — og hedder alligevel `…Debug…`.
- En **præcedens findes allerede**: arkitektur-kandidat **B9 (2026-06-25)** flyttede den
  trust-kritiske række-evalueringsmotor UD af `src/domain/debug/` til
  `src/domain/eoRowEvaluation/` og omdøbte `eoDebug…`→`eoRow…`, `EO_DEBUG_BUILDERS`→
  `EO_ROW_BUILDERS`, `collectAllDebugRows`→`collectAllEoRows`, netop fordi noget
  trust-kritisk ikke må ligge i et nominelt "DEV"-lag. Denne plan fører den samme
  logik til ende for det, B9 bevidst lod ligge.

**Én vigtig nuance til brugerens præmis.** Fanerne er ikke *rene* spejlinger uden
beregning. `eoDebugLoenCoreModel`, `eoDebugRegulationCore`, `eoDebugLoenColumns` og
`eoDebugOffentligeYdelserColumns` **periodiserer og beregner værdier dag-for-dag** —
hvorefter de parity-kontrolleres mod motoren. Formålet er fortsat diagnostik/kontrol,
men det er selvstændig beregning, ikke ren visning. Det påvirker hvilket *erstatningsnavn*
der er passende (se §"Navngivningsprincipper").

## Ikke-forhandlingsbare review-principper

- **Ingen adfærdsændring.** Ingen beregning, gate, blokering, invariant, projektion
  eller UI-flow må skifte semantik. Kun navne, filplaceringer, kommentarer og de
  kontrakter/tests der beskriver dem.
- **Bevar ægte debug.** Standard log-niveau `debug`/`console.debug`, DEV-logging bag
  `debugRuntime`-flag, devtools-monitor, bug-report, systemfejl-rapportering,
  parity- og integritetskontrol er **korrekt** navngivet og røres ikke (undtagen hvor
  et prefiks arver visnings-navnet — se `debug:control_mismatch`).
- **Sproglig søgning før og efter.** En case-insensitiv søgning på `debug` er både
  udgangspunktet (dette katalog) og den afsluttende kvalitetssikring: hver
  tilbageværende forekomst skal være **bevidst**, ikke glemt.
- **Guards først.** Enhver hård string-/sti-invariant (isolations-test, invariant-id,
  projektions-enum, coverage-matrix) opdateres i **samme** ændring som symbolet den
  beskytter, ellers bryder testene.
- **Persisterede nøgler kræver migration.** Omdøbes en persisteret settings-nøgle
  (`showEODebugMenu`, `fontStyleColorDebug`), er det en `schema-evolution`-ændring med
  migration — ikke en fri omdøbning.

## Navngivningsprincipper (hvad "debug" skal erstattes med)

Oprydningen skal konvergere mod et lille, konsekvent vokabular. Foreslåede
retningslinjer (endelige navne besluttes pr. cluster, se faserne):

- **Visnings-/inspektionsfanen** (i dag "EO debug"): et navn der siger *inspektion/
  gennemsyn*, fx `EOInspektion` / "Gennemsyn" / "Kontrolvisning". Den er et
  forklarings- og kontrol-panel, ikke et fejlsøgningsværktøj.
- **Tabelfanen** (i dag "Debug tabel"): tilsvarende, fx "Periodiseringstabel" /
  "Kontroltabel" — den periodiserer indkomster og parity-kontrollerer dem.
- **View-model / præsentation** (`eoDebugPageViewModel`, `eoDebugFormat`,
  `eoSnapshotToDebugView`, `RegulationDebugSection`, `EODebug*`-komponenter): navngives
  efter deres reelle rolle (`…ViewModel`, `…Presentation`, `…Inspection…`).
- **Beregnings-/periodiseringsmodel** (`eoDebugLoenCoreModel`,
  `eoDebugRegulationCore`, `eoDebug*Columns`): navngives efter at det er
  periodisering/beregning til kontrol (fx `…PeriodisertModel` / `…ControlModel`).
- **Ægte diagnostik** (`eoDebugParity`, `eoDebugIntegrity`, `hashDebugValue`,
  `validateDebugModel`): behold semantikken; overvej `parity`/`integrity`-navne der
  ikke arver "debug", men dette er lav prioritet og valgfrit.
- **Generisk kode fanget af mappenavnet** (`scrollToDebugRow`, `eoDebugCsv`,
  `eoDebugDateUtils`, `eoDebugMathUtils`, `ydelsestyper.debugLabel`): navngives efter
  hvad de faktisk gør (`scrollToEoRow`, `csv`, `dateUtils`, `mathUtils`, `tabelLabel`).

## Katalog: hvor står "debug" i dag — og er det korrekt?

Kortlagt via case-insensitiv søgning på `debug` på tværs af hele repoet (174 filer).
Grupperet efter **vurdering**, ikke efter mappe.

### A. KORREKT — ægte diagnostik/logging (bevar navnet)

| Sted | Rolle |
|---|---|
| `src/utils/debugRuntime.ts` (`isInteractiveDevLoggingEnabled`, `debugLog`) | DEV-logging-gate; kun DEV, ingen prod-effekt |
| `src/utils/logger.ts`, `logStorage.ts` | `debug` som log-**niveau** (universel konvention) |
| `src/utils/devtoolsMonitor.ts`, `bugReport.ts`, `systemIssueReporter.ts`, `errorMessages.ts` | console-overvågning, fejlrapport, systemfejl-payload |
| `src/hooks/useFormFieldErrors.ts` (`debugFieldErrorReporter`), `src/stores/formPersistenceStore.ts` (`debugFormPersistenceStore`), `src/hooks/tableInput/useTableInputCore.ts` | `debugRuntime`-gated `console.debug`-loggere |
| `src/components/inputs/StyledTextFieldBase.tsx`, `StyledTextField.tsx`, `StyledDateField.tsx` | dev-logging / render-loop-diagnostik |
| `src/contexts/AppSettingsContext.tsx` + settings `fontStyleColorDebug` | DEV CSS-diagnostik (farvelægger font-styles) — **ægte** visuel debugging |
| `AGENTS.md` console-politik (`console.debug`) | log-niveau-politik |
| `src/domain/debug/eoDebugParity.ts`, `eoDebugHash.ts`, `eoDebugIntegrity.ts` | parity-/integritetskontrol — kernen i ægte "debug" |
| `src/__tests__/quality/debugLayerIsolation.test.ts` (**formålet**) | arkitektonisk isolations-guard (kun stier/segmentkonstant skal justeres, ikke formålet) |

> Note om `fontStyleColorDebug`: navnet er korrekt i ånd, men er en **persisteret
> settings-nøgle**. Selv en frivillig omdøbning kræver `schema-evolution`-migration —
> lades derfor urørt medmindre det aktivt besluttes.

### B. FEJLAGTIG — visning/præsentation kaldt "debug" (kernen i oprydningen)

**Brugervendte labels (forelægges — de er UX):**

| Sted | I dag | Vurdering |
|---|---|---|
| `Erstatningsopgoerelse.tsx` (fane-labels) | "EO debug", "Debug tabel" | fejlagtig — visnings-/kontrolfaner |
| `EODebugTabel.tsx` (header + fejltekster) | "Debug tabel", "Debug-tabellen er ikke opdateret…", "Kan ikke oprette debug-tabel" | fejlagtig/tvivlsom |
| `Indstillinger.tsx` | section "Debug"; toggle "Vis debug-fane på Erstatningsopgørelse-side" | fejlagtig — viderefører navnet |
| `eoSnapshotToDebugView.ts` UI-tekster | "EO debug kræver et friskt snapshot", "Åbn debug-fanen igen" | fejlagtig |

> **Terminologisk inversion værd at bemærke:** Stamdatas faktiske udviklerværktøj
> (`StamdataDebugTab.tsx`) hedder i UI **"Test"** / "test-fane" (`showStamdataTestTab`),
> mens de rene visnings-faner hedder **"debug"**. Terminologien er nærmest byttet om.

**Komponenter (ren visning):**

- `EODebug.tsx`, `EODebugRowsSection.tsx`, `eoDebugRowRendering.tsx`
  (`DEBUG_ROW_LABEL_WIDTH`, `DEBUG_REGULATION_ROW_LABEL_WIDTH`),
  `EODebugEmploymentSections.tsx` (inkl. diskriminator `kind: 'debug'` = "almindelig
  række vs. regulerings-række", ikke diagnostik), `EODebugGroupedRowsSection.tsx`
  (`renderDebugRow`), `EODebugRegulationSections.tsx` (selv-dokumenteret "render-only").

**View-model / snapshot-projektion (produktionskode-symboler):**

- `src/domain/debug/eoDebugPageViewModel.ts` (`EODebugPageViewModel`,
  `EODebugDisplayTable`, `EODebug*SectionViewModel`, `buildEODebugPageViewModel`)
- `eoDebugViewModel.ts`, `eoDebugRegulationViewModel.ts` (`RegulationDebugSection`,
  `RegulationDebugRow/Table`, `buildRegulationDebugSections`), `eoDebugFormat.ts`
  (rene formattere), `eoDebugCoreModel.ts` (`buildDebugCoreModel`, kalender-`DebugDay`)
- `src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToDebugView.ts`
  (`EoDebugView*`, hele modulet), felt **`debugSnapshot`** i `eoSnapshot.ts` +
  `EODebugSnapshot`/`buildEODebugSnapshot`/`buildDebugSnapshotForComputed`/
  `svieSmerteForDebug`/`tafRangesForDebug`, `eoPresentationModel.ts`, `shared/eoTypes.ts`
- Projektions-target-enum **`'debug'`** i `EoProjectionTarget`
  (`eoSnapshotInvariants.ts`, `eoSnapshot.ts`) — sidestillet med `eo_pdf`; det gater en
  **visning**, ikke fejlsøgning.
- Tab-key `DEBUG: 'debug'` / `DEBUG_TABEL: 'debug_tabel'` + `TabKey`-union
  (`useEoBeregningViewModel.ts`)

**Generisk kode / labels fanget af navnet:**

- `src/utils/scrollToDebugRow.ts` (`scrollToDebugRow`, `debugRowId`,
  `resolveAnchorIdFromDebugRowId`) — scroller til vilkårlige **domænerækker** i den
  normale UI (bl.a. fra Beregning-fanens fejl-links). Intet med fejlsøgning at gøre.
- `src/domain/debug/eoDebugCsv.ts`, `eoDebugDateUtils.ts`, `eoDebugMathUtils.ts`,
  `eoDebugRowValidation.ts` (ren re-eksport), `eoDebugLoenTypes.ts`
  (`DebugTabel*`-kolonne-grammatik) — generiske utils/typer, "debug" er kun mappe-arv.
- `src/data/ydelsestyper.ts` `debugLabel?` — alternativ **visnings-label** (med
  linjeskift til kolonnevisning); burde hedde `tabelLabel`/`kortLabel`.
- `settings.showEODebugMenu` — toggle for visnings-fanen (**persisteret nøgle →
  migration**).

**Beregnings-/periodiseringsmodel fejlnavngivet "debug"** (ikke ren visning, ikke
diagnostik — se nuancen ovenfor):

- `src/domain/debug/eoDebugLoenCoreModel.ts`, `eoDebugRegulationCore.ts`,
  `eoDebugLoenColumns.ts`, `eoDebugOffentligeYdelserColumns.ts`, `eoDebugModel.ts`
  (`buildEODebugModel`, `DebugTabel*`-typer). Periodiserer dag-for-dag og
  parity-kontrollerer mod motoren.

### C. TVIVLSOM — parity-kontrol med arvet visnings-prefiks (kontraktnær)

- **Invariant-id `debug:control_mismatch`** (`eoControlMismatch.ts`,
  `eoSnapshotInvariants.ts`; **defineret i `error-contract.md` §8.4**). Selve
  kontrollen er ægte parity (motor ↔ committed tabel-projektion) og er en
  **produktions-invariant** der kan fail-close. Men `debug:`-prefikset binder et
  produktionskritisk sikkerhedstjek til ordet "debug". Kandidat til fx
  `control:sammentaelling_mismatch`. **Hardcodet string med runtime-/kontrakt-/
  test-konsekvens** — behandles med guards.
- `src/domain/debug/eoDebugSammentaelling.ts` (`buildEODebugSammentaellingModel`) —
  bygger "beregnet vs. tabel"-rækkerne; ægte kontrol-formål, arvet visnings-navn.
  Bemærk: selve kontrol-kontrakten er **bevidst allerede flyttet ud** til
  `erstatningsopgoerelse/control/eoControlMismatch.ts`.
- `src/utils/systemIssueReporter.ts` `SystemIssueArea = '…' | 'debug' | '…'` — verificér
  call-sites: hvis `area: 'debug'` sættes på visnings-fanen, er det arvet visnings-navn.

### D. TVIVLSOM — "debug"-rester midt i den trust-kritiske motor (medium)

- `src/domain/eoRowEvaluation/eoRowBuilderRegistry.ts`: privat
  `executeEODebugBuilderEntry` og fallback-række-id **`debug.builder.<section>.exception`**
  (+ label "Fejl i debug-builder (<section>)"). Arkitektur-doc kalder dem "bevidst
  beholdt", men de er inkonsistente med B9-omdøbningen (motoren er netop *ikke* debug).
- `src/domain/eoRowEvaluation/` formatterings-/model-symboler der stadig bærer "Debug":
  `DebugCellValue`, `DebugDay` (`eoRowTypes.ts`); `formatDebugCount`, `formatDebugMonths`,
  `parseDanishToIsoDebug`, `getRangeForManualReguleringDebug`,
  `calculateElapsedWholeMonthsDebug` (`eoRowShared.ts` m.fl.);
  `OffentligeYdelserDebugRow`, `buildOffentligeYdelserDebugRows`
  (`eoRowIndkomstModel/Rows.ts`). Disse er rene formatterings-/præsentationshjælpere,
  der lever i den "debug-frie" motor.

### E. LAV PRIORITET — kun kommentar-/kontekst-arv

Rene kommentar-referencer, hvor koden selv er korrekt navngivet, men prosaen sidestiller
"debug" med "visning/render/præsentation/gate":

- `src/utils/scrollWithRetry.ts`, `saveBlockedFocus.ts`
- `src/domain/erstatningsopgoerelse/validation/*` ("React-/debug-fri", "debug-visninger"),
  `helpers/*` (`eoInputRelevance` "debug/præsentation", `tafRowDerived` "UI/debug",
  `tafBeregningsenhed` "debug/audit"), `engines/*` (`loenudviklingBeregning` "debug-motoren
  … til visning", `offentligeYdelserUdviklingBeregning` "render-/debug-lag",
  `reguleringsPresentation` "EODebug")
- `src/hooks/useScrollToSectionWithRetry.ts`, `src/domain/eoRowEvaluation/*` doc-kommentarer
- `src/components/tables/VirtualizedDisplayTable.tsx` (data-attribut "til diagnostik" —
  legitim), `erhvervsevnetab/HoverRow.tsx` ("debug-visninger" i JSDoc)

### F. Kontrakter / arkitektur / guards der CEMENTERER navnet

Skal opdateres i takt med omdøbningen (jf. `AGENTS.md` §133 og
`docs/architecture/contract-topology-procedure.md`):

| Fil | Binding |
|---|---|
| `src/contracts/error-contract.md` | **Titel** + invariant-id `debug:control_mismatch` (§8.4) + EODebug-regler (§7, §8.2, §8.2a). Filnavn i topology-JSON + coverage-matrix. |
| `docs/architecture/debug-builder-architecture.md` | **Filnavn** (i topology-JSON) + gennemgående "EO-debug"-prosa + fallback-id + bevarede DEV-symboler. |
| `src/contracts/eo-snapshot-contract.md` | `eoSnapshotToDebugView`, `debugSnapshot`-felt, projektions-target `'debug'`, "EODebug altid-kan-dannes"-garanti (§6). |
| `src/contracts/domain-boundary-contract.md`, `snapshot-contract.md` | "UI, PDF og debug"-projektionssprog. |
| `src/contracts/contract-topology.json` | Filstier til de to debug-dokumenter. |
| `src/__tests__/quality/contractCoverageMatrix.test.ts` | Kontrakt↔test-stier (`errorDebugContractIsolation.test.ts`, `eoSnapshotToDebugView.test.ts`). |
| `src/__tests__/quality/debugLayerIsolation.test.ts` | Sti-konstanter (`DEBUG_ROOT`, `DEBUG_SPECIFIER_SEGMENT = 'domain/debug'`), `SANCTIONED_BRIDGE_FILES`-allowlist, hardcodede selvtest-import-strenge. |
| `AGENTS.md` | Kontrakthierarki-liste (`error-debug`). Console-politik (`console.debug`) er korrekt — røres ikke. |
| `src/__tests__/domain/debug/*`, `EODebug*.test.tsx`, `scrollToDebugRow.test.ts` | Følger produktionssymbolerne automatisk ved omdøbning. |

## Fasede leverancer

Hvert punkt skal **gennemgå, rette, teste og verificere** sit område. Rækkefølgen går
fra lavrisiko/isoleret mod kontraktnært/brugervendt.

1. **Fastlæg vokabular.** Beslut de endelige erstatningsnavne (inspektion/gennemsyn/
   kontrol vs. visning vs. periodisering) pr. cluster. Brugervendte fane-/settings-navne
   **forelægges** her, før noget UI ændres.
2. **Generisk kode fanget af mappenavnet (C-lav-risiko).** `scrollToDebugRow`→
   `scrollToEoRow` (+ `debugRowId`→`rowId`), `eoDebugCsv/DateUtils/MathUtils`→neutrale
   navne, `ydelsestyper.debugLabel`→`tabelLabel`. Ingen kontrakt-binding.
3. **"Debug"-rester i motoren (D).** `executeEODebugBuilderEntry`→`executeEoRowBuilderEntry`,
   fallback-id `debug.builder.*`→`eoRow.builder.*` (guard: `debugLayerIsolation`,
   evt. navigations-/snapshot-tests), motorens `formatDebug*`/`DebugDay`/`DebugCellValue`/
   `OffentligeYdelserDebugRow`→række-/format-navne. Opdatér `debug-builder-architecture.md`s
   "bevidst beholdt"-note.
4. **View-model & præsentation (B).** `eoDebugPageViewModel`, `eoDebugFormat`,
   `eoDebug*ViewModel`, `RegulationDebugSection`, `EODebug*`-komponenter,
   `eoSnapshotToDebugView`→inspektions-/visnings-navne. Følg begge consumers og
   testfilerne.
5. **Periodiserings-/beregningsmodel (B-beregning).** `eoDebugLoenCoreModel`,
   `eoDebugRegulationCore`, `eoDebug*Columns`, `eoDebugModel`→periodiserings-/
   kontrol-navne.
6. **Snapshot-projektion & kontrakter (F).** Felt `debugSnapshot`, `EODebugSnapshot`,
   projektions-enum `'debug'`, invariant-id `debug:control_mismatch`. Opdatér
   `error-contract.md`, `eo-snapshot-contract.md`, `domain-boundary`/`snapshot`,
   `contract-topology.json`, coverage-matrix og `debugLayerIsolation` **samtidig**.
   Filomdøbning af de to debug-dokumenter følger `contract-topology-procedure.md`.
7. **Persisterede settings (migration).** `showEODebugMenu` (+ evt. `fontStyleColorDebug`)
   → nyt navn med `schema-evolution`-migration. Forelægges (brugervendt + persisteret).
8. **Brugervendte labels (UX).** Fane-labels "EO debug"/"Debug tabel",
   Indstillinger-section "Debug"/toggle-tekst, `EODebugTabel`-header/fejltekster,
   `eoSnapshotToDebugView`-UI-tekster. Overvej samtidig at afklare Stamdata "Test"-fanens
   navngivning, så terminologien ikke længere er byttet om.
9. **Lav-prioritets kommentar-arv (E).** Ryd kommentarer der sidestiller "debug" med
   "visning/render/præsentation".

## Afsluttende kvalitetssikring (rent sproglig)

Før tilbagemelding om at oprydningen er gennemført:

1. Kør case-insensitiv søgning på `debug` over hele repoet igen.
2. For **hver** tilbageværende forekomst: bekræft, at den falder i kategori **A**
   (ægte diagnostik/logging, bevaret bevidst) eller er en bevidst besluttet undtagelse
   (fx `fontStyleColorDebug` uden migration). Ingen forekomst må være glemt visnings-/
   præsentations-/beregnings-arv.
3. Kør fuld test-suite; bekræft særligt `debugLayerIsolation`, `contractCoverageMatrix`,
   `errorDebugContractIsolation` og EODebug-/snapshot-tests grønne.
4. Bekræft **ingen adfærdsændring**: ingen ændret gate, invariant-udløsning,
   projektion eller UI-flow — kun navne/tekst.
