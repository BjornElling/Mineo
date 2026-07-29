# WI-007: Luk Fase 0–4 endegyldigt — restinfrastruktur og statussandhed

- **Status:** `afsluttet` (2026-07-25) — alle fund fra det interne review (I1–I8) og Codex sol/medium
  (X1–X5) er disponeret; fire gates + fuld suite grønne. **Fase 0–4 kan hermed erklæres endeligt lukket.**

  **LÆS DETTE FØRST.** Brødteksten er historik fra udførelsestidspunktet. Dens D4-beslutning siger, at
  `buildCellFocusFieldPath`/`CELL_TABLE_IDS` "stadig er kanoniske tabel-id'er" i modulet `cellFocusPaths.ts`.
  Det er ikke længere sandt: hele modulet er SLETTET med draft/commit-reviewets GM-F10, fordi målene var
  uopnåelige i DOM. Fokusmålet er nu den kanoniske feltadresse (`data-mineo-field-address`).
- **Oprettet:** 2026-07-25
- **Slice/scope:** Fase 0–4's exitkriterier: den efterladte legacy-infrastruktur (storage-nøgler,
  celle-scope-modulet), begrebsnavngivningen (WI-006) og designdokumentets statussandhed.
- **Kilde:** Brugerønske ("alle udestående forhold før Fase 0–4 kan erklæres endegyldigt lukkede") +
  `WI-006` (obligatorisk før lukning) + egen kortlægning 2026-07-25.
- **Risikoklasse:** **H** — en persisteret sessionStorage-nøgle og save/load-sektionslisten er i scope.
  Klassen er IKKE hævet af kompleksitet, men af at datatab er den mulige fejlmåde.
- **Baseline:** HEAD `5bf685a6` på branch `greenfield`; working tree **rent**. Ingen fremmede ændringer.

## Kortlægning (Claude, high, 2026-07-25)

Kortlægningen fandt otte tilsyneladende adskilte restpunkter. **De er ikke otte problemer.** Syv af
dem deler én rod:

> **Rodårsag: trin 13 slettede den parallelle legacy-inputklynges KONSUMENTER, men lod den
> infrastruktur stå, som udelukkende eksisterede for at betjene dem.** Modulerne er stadig
> syntaktisk gyldige og typechecker, så intet værn fangede dem. Tilbage står eksporter uden
> kaldere, en persisteret nøgle uden læser/skriver, og kommentarer der beskriver den slettede
> model i nutid.

Det er præcis den fejlklasse, `AGENTS.md`s regel om overflødige/ubrugte exports findes for, og
grunden til at symptombehandling (omdøb navnene) ville være forkert: **et dødt modul skal ikke
omdøbes, det skal slettes.** WI-006's præmis — "vælg ét kanonisk begreb pr. betydning" — er derfor
kun rigtig for den lille levende rest.

### Verificeret evidens pr. punkt

| # | Fund | Evidens (egen verifikation) | Klasse |
|---|---|---|---|
| **P1** | **Hele den per-sektion `sessionStorage`-nøglefamilie er død.** `getStorageKey`, `getInvalidDraftsStorageKey`, `getInputEnvelopeStorageKey`, `getKnownStorageKeys`, `getKnownStaticStorageKeys`, `isValidStorageKey` har **nul** produktionscallsites uden for `storageManifest.ts` selv. Greenfield-runtime skriver og læser KUN `input_v2` (`initializeInputRuntime.ts:56`, `dispatchInput.ts:179`). | `grep` over hele `src/` ekskl. `__tests__`: eneste træf er definitionerne + de tre `input_v2`-callsites | A (død kode) |
| **P2** | **`STORAGE_KEYS`' eneste levende brug er som SEKTIONSNAVNE-liste, ikke som storage-nøgler.** `fileLoad.ts:87` bruger `Object.keys(STORAGE_KEYS)`, mens `:100` tretten linjer nede bruger `Object.keys(persistenceSchemas)` til samme sektionsmængde. `persistenceInvariants.ts:12` bruger `keyof typeof STORAGE_KEYS` som compile-time-invariant. | `fileLoad.ts:87` vs `:100`; `persistenceRegistry.ts:27` eksporterer allerede `PERSISTED_SECTION_KEYS` | A (dupliceret sandhed) |
| **P3** | **`invalidDrafts`-storagenøglen (`mineo_invalidDrafts`) er død**, men dokumenteres i nutid som en levende recovery-kanal (`storageManifest.ts:60-62`: "så ikke-committbart input overlever F5"). `persistence-contract.md:9` siger det modsatte: kanalen ER slettet. | `storageManifest.ts:64/98/111/120`; ingen læser/skriver | A + B |
| **P4** | **`cellInvalidDraftScopes.ts` er 4/6 dødt.** Kun `buildCellInvalidDraftFieldPath` (`:40`) og transitivt `extractCellTableId` (`:47`) har en produktionskalder (`eoRowIssueCatalog.ts:1,85`). `resolveTabForCellFieldPath` (`:75`), `isCellInvalidDraftFieldPath` (`:79`), `extractCellRowIdForScope` (`:97`), `extractCellRowScope` (`:110`), `isCellInvalidDraftRowOrphan` (`:123`), `isCellInvalidDraftScopeOrphan` (`:139`) har **nul**. `:120-122` refererer `useReconcileInvalidDraftsToLiveRows`, som ikke findes i repoet. | `grep` pr. eksportnavn | A + C |
| **P5** | **Den ene levende funktion er misnavngivet.** `buildCellInvalidDraftFieldPath` bygger ikke en draft-nøgle; den bygger et **fokusmål** (`EoIssueFocusTarget.kind: 'fieldPath'`, `eoRowIssueCatalog.ts:83-86`). | `eoRowIssueCatalog.ts:78-86` | C (WI-006) |
| **P6** | **Design-doc §1.10's "KENDT AFGRÆNSNING (EO, udestående)" (`:1243-1250`) er forældet.** Den siger at leaf-opdelingen "er en selvstændig work item" — men WI-004 runde 4 implementerede den: `blockedDependencies` (5 grene, `eoDependencyGroups.ts:210-232`), `readyBranches` (`eoSnapshot.ts:129`), fald-tilbage i Beregning-fanen (`eoSnapshotToBeregningView.ts:28-30`). | Verificeret i alle tre filer | B |
| **P7** | **Futurum-drift om lukkede faser.** `design.md:1102-1106` ("slettes i fase 4"), `:1122` ("afventer fase 3–4"), `:1116`, `:980`, `:858`; `main.tsx:12` ("Startup-notice wires i Fase 4"); `gridModel.ts:136` ("`invalidDrafts` bruger fortsat …"). | Læst | B |
| **P8** | **`Greenfield*Field` findes ikke.** `Stamdata.tsx:23` navngiver en komponentfamilie, som doc'et selv (`:1353-1357`) erklærer fjernet. `StyledCheckbox.tsx:15` / `StyledToggleSwitch.tsx:62` siger "Greenfield-wrapperen/-wrappere". | `grep Greenfield`: 129 træf / 108 filer, 0 identifikatorer | C |

### Hvad der IKKE er i scope, og hvorfor

- **EO's krydsgående aggregat** (`totals.samletTotalOre`/`canonicalOutput`/`pdfModel` alt-eller-intet).
  Det er ikke en rest: det er den VALGTE model A fra WI-004 runde 3, som Codex bekræftede opfylder
  brugerbeslutning 2. §1.10's tekst skal rettes til at sige dét (P6) — modellen skal ikke ændres.
- **De ~190 legitime "Greenfield"-prosaforekomster.** Doc'et tillader dem eksplicit (`:1357`) som
  korrekt historisk reference. Kun de tre direkte forkerte symbolreferencer rettes (P8).
- **`gridCells.tsx`' filopdeling** (6 komponenter i én fil). Det er et strukturvalg, ikke en
  navnefejl, og filen er 171 linjer trivielle skaller. Ingen adfærd, ingen kontraktbrud.
  **Beslutning: henlægges** — noteres som rest, ikke rettes.
- **Ledger-inventaret** (`src/inputCore/ledger/`, `consumerInventory.ts`). Markeringerne peger
  konsistent på Fase 6, og doc'ets `:1487` matcher. Korrekt henlagt.
- **`WI-005`** (ansvarsbaserede arkitekturværn) — eksplicit Fase 6, ikke et Fase-0–4-exitkrav.

## Designbeslutninger (§0, Claude high)

| # | Valg | Beslutning og begrundelse |
|---|---|---|
| **D1** | Omdøbe vs. slette den døde infrastruktur | **SLET.** WI-006 forudsatte omdøbning, men et modul uden kaldere skal ikke bære et bedre navn — det skal væk. At omdøbe ville cementere død kode og gøre den sværere at få øje på næste gang. |
| **D2** | Hvad gør vi ved den persisterede `mineo_invalidDrafts`-nøgle? | **KORRIGERET efter verifikation — nøglerne SLETTES uden erstatningsliste.** Første udkast ville beholde en `LEGACY_CLEANUP_STORAGE_KEYS`-liste, så clear/backup fortsat kunne rydde en gammel sessions rest. **Den præmis holder ikke:** `getKnownStorageKeys` har nul kaldere, og `clearCase` går gennem `dispatchInput`, som udelukkende rører `input_v2` (`dispatchInput.ts:179-198`). Der findes altså ALLEREDE ingen oprydningsvej — en "bevar oprydningen"-liste ville bevare noget, der ikke eksisterer, og give indtryk af en garanti, koden ikke leverer. Nøglerne er desuden sessionStorage: de dør med fanen, og programmet er ikke i brug under greenfield-udviklingen ([[feedback_no_legacy_for_usability]]). **Konsekvens:** `INVALID_DRAFTS_SUFFIX`, `INPUT_ENVELOPE_SUFFIX` og hele den døde nøglefamilie slettes. Beholdes: `UI_STORAGE_KEYS` + `createActiveTabStorageKey` (levende, 11 filer) og `CURRENT_INPUT_ENVELOPE_SUFFIX`. |
| **D3** | Én sandhed for "hvilke sektioner findes" | **`persistenceRegistry.PERSISTED_SECTION_KEYS` er den ene kilde.** `fileLoad.ts:87` skifter til den, så filen ikke længere har to kilder til samme mængde tretten linjer fra hinanden. `StorageKey`-TYPEN bevares — den er levende og korrekt — men afledes fra registry'et, ikke fra en nøglemapping der ikke længere mapper til noget. |
| **D4** | Navnet på den levende celle-fokus-funktion | **`buildCellFocusFieldPath`** i et modul der hedder efter sit ansvar (`cellFocusPaths.ts`), ikke efter den slettede model. `CELL_TABLE_IDS` følger med — de er stadig kanoniske tabel-id'er. |
| **D5** | `gridUxSpec.allowLeavingInvalidDraft` | **Bevares uændret.** Navnet er semantisk KORREKT: det betyder "en åben celleeditor med afvist råtekst må forlades", altså draft-tilstanden i editoren — ikke den slettede storage-kanal. At omdøbe det ville være den globale søg/erstat, WI-006 selv advarede imod. |
| **D6** | Rækkefølge | Slet først (P1–P4), omdøb derefter resten (P5), ret dokumentationen sidst (P6–P8) — så statusteksten skrives mod den kode, der faktisk står tilbage. |

## Autoritativt grundlag

- `docs/architecture/draft-commit-greenfield-design.md` §8 (Fase 0–4), §1.10.
- `src/contracts/persistence-contract.md` §9 (`:9` — `invalidDrafts` er slettet), §6.3 (datatabsrapportering).
- `AGENTS.md` — overflødige/ubrugte exports; kode↔kontrakt-sync.
- `src/config/persistenceRegistry.ts` som den kanoniske sektionsmængde.

## Invarianter (må ikke brydes)

- **Ingen adfærdsændring.** Ingen beregningstal, intet UI, ingen persisteret payload flytter sig.
- **Intet datatab ved load.** `fileLoad`s sektionsiteration skal dække PRÆCIS samme sektionsmængde
  som før — bevises med en test, ikke ved øjemål.
- **Clear/backup skal fortsat kunne rydde en gammel sessions legacy-nøgler.** En sletning må ikke
  efterlade `mineo_invalidDrafts`/`mineo_input` uoprydelige.
- Den slettede `invalidDrafts`-model må ikke genopstå — det navnebaserede AST-værn bevares.
- Design-doc'ets statusafsnit må ikke overdrive: hvor noget reelt er henlagt til Fase 5/6, skal det
  stå som henlagt, ikke som lukket.

## Parallel / duplikeret logik

- **Fund:** `fileLoad.ts` udleder sektionsmængden to gange på tretten linjer (`:87` fra
  `STORAGE_KEYS`, `:100` fra `persistenceSchemas`).
- **Beslutning:** konsolidér til `PERSISTED_SECTION_KEYS`.
- **Begrundelse:** det er samme concern (hvilke sektioner findes i en `.eo`-fil), ikke to. De to
  kilder kan drifte fra hinanden, og præcis dét ville give tavst datatab.

## Acceptance criteria

- [x] Nul produktionseksporter uden kaldere — og kravet følger AFHÆNGIGHEDSKANTEN, ikke filgrænsen:
      sletningen af en konsument skal også fjerne det, der alene betjente den. Bevist med `grep`.
- [x] `fileLoad` iterererer samme sektionsmængde som før; test hævder mængden eksplicit mod en
      uafhængig literal (ikke mod kilden selv).
- [x] ~~Clear/backup rydder fortsat `mineo_invalidDrafts` og `mineo_input`~~ — **UDGÅET.** Kriteriet
      hvilede på D2's oprindelige præmis, som blev afkræftet: der fandtes ALLEREDE ingen oprydningsvej
      (`getKnownStorageKeys` var kaldeløs, og `clearCase` rører kun `input_v2`). Et krav om at "bevare"
      en oprydning, der ikke eksisterer, ville være uopfyldeligt og vildledende.
- [x] Ingen `invalidDraft`-navne tilbage i produktionskode undtagen `allowLeavingInvalidDraft` (D5)
      og de negative historiske referencer, der siger at modellen ER slettet.
- [x] Design-doc §1.10 beskriver den FAKTISKE EO-tilstand (`blockedDependencies`/`readyBranches` +
      det bevidst atomiske aggregat), uden ordet "udestående".
- [x] Ingen futurum-formuleringer om Fase 0–4 i doc eller produktionskommentarer.
- [x] Ingen reference til `Greenfield*Field`/`Greenfield-wrapper` i produktionskode.
- [x] **Tilføjet efter reviewene:** skrivegrænsen er compiler-håndhævet, ikke kun AST-håndhævet
      (`ManifestStorageKey`), og sektionslisten er frosset. Begge mutationstestede.
- [x] Alle fire gates + fuld suite grøn.

## Godkendelsesgate

- **Påkrævet:** **nej** — `godkendelse ikke påkrævet`. Rent teknisk: sletning af kaldeløs kode,
  omdøbning, konsolidering af én sektionsliste og dokumentationsretning. Ingen synlig UI/UX og
  ingen beregningsregel berøres. (Havde `.eo`-loadets sektionsmængde ændret sig, ville det have
  været en godkendelsessag — derfor er "uændret mængde" et acceptance criterion med test.)

## Verifikation

- **Plan:** målrettede tests efter hver delændring; derefter `npm run typecheck`,
  `typecheck:test`, `lint`, `verify:ledgers` og fuld `npx vitest run` (klasse H).
  `scripts/generate-build-info.mjs` køres før fuld suite (kendt fælde med stale build-info).

- **Resultat (2026-07-25, efter både internt og eksternt review):** alle fire gates grønne + fuld suite grøn.
  - `npm run typecheck` — ren
  - `npm run typecheck:test` — ren (de tre `@ts-expect-error`-guards holder)
  - `npm run lint` — ren (`--max-warnings 0`)
  - `npm run verify:ledgers` — 239 felter / 16 collections / 18 dokumentoutputs
  - `npx vitest run` — **483 filer / 6090 tests** (fra 484/6094 ved baseline; netto −1 fil / −4 tests, fordi
    `cellInvalidDraftScopes.test.ts` er slettet sammen med sit modul, mens nye tests er kommet til)

- **Mutationstestet, ikke kun grønt.** To værn er bevist load-bearing ved at genindføre den fejl, de skal fange:
  1. AST-reglens helper-gren: injicerede `writeOptionalSessionStorageValue('mineo_invalidDrafts', …)` i
     `filePersistenceMetadata.ts` → arkitekturtesten fejler (før udvidelsen ville den have passeret).
  2. Den brandede skrivegrænse: blødte `writeSessionStorageValue`s parameter op til `string`
     → `typecheck:test` fejler med "Unused '@ts-expect-error' directive".

## Review-fund (udfyldes i review-fasen)

Reviewplan efter brugerens justering: **først et internt subagent-review** (Claude, uafhængig
kontekst), derefter **præcis ét** Codex-review med **sol 5.6 / medium** — ikke high, selv om klassen
er H. Brugerens tokenbegrænsning er en eksplicit beslutning, der går forud for skillens routingtabel;
det noteres her som en bevidst afvigelse, og det interne review kompenserer ved at køre først, så
Codex' ene kald møder et allerede renset diff.

### Internt review (Claude-subagent, uafhængig kontekst) — 8 fund

Alle verificeret selvstændigt mod koden før rettelse. Reviewet fandt, at min egen lukning på to punkter
**genintroducerede præcis den fejlklasse, WI'en er skrevet for at lukke** (et værn, der ikke kan fejle).

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
| I1 | **`persistenceInvariants.ts` blev en tautologi.** Før var `Equal<keyof typeof STORAGE_KEYS, keyof EoFileData>` en kontrol mellem to UAFHÆNGIGE kilder (håndskrevet nøglemapping vs. `persistenceSchemas`). Da jeg flyttede `StorageKey` til registry'et, blev begge sider udledt af `persistenceSchemas` (`eoFileSchema.ts:23-31` bygger sin shape derfra) — invarianten kunne aldrig fejle igen. **Samme rodårsag som hele WI'en: et værn der typechecker, men ikke værner.** | **Alvorlig, strukturel** | bekræftet — rettet ved at genindføre den uafhængige side: en eksplicit `ExpectedSection`-literal, som BEGGE sider nu måles mod (to assertions) | rettet |
| I2 | **`storage/session-storage-manifest-key` var inert.** Reglen matchede kun rå `sessionStorage.setItem`, men `storage/session-storage-boundary` forbyder allerede den vej overalt undtagen i `safeSessionStorage.ts`. Al produktionsskrivning går gennem `writeSessionStorageValue`/`writeOptionalSessionStorageValue`, som reglen ikke så. En genindført `writeOptionalSessionStorageValue('mineo_invalidDrafts', …)` ville passere BEGGE regler. Min doc-påstand ("en AST-regel afviser nu skrivning til de slettede nøgler") var dermed overdrevet. | **Moderat, strukturel** | bekræftet — reglen dækker nu begge skriveveje; fire nye fixtures. **Mutationstestet:** injicerede `writeOptionalSessionStorageValue('mineo_invalidDrafts', …)` i `filePersistenceMetadata.ts` og bekræftede, at værnet fejler. Doc-teksten er nedtonet til hvad reglen faktisk gør | rettet |
| I3 | **`listSessionStorageKeys` blev kaldeløs.** Den eksisterede alene for at fodre det slettede `getKnownStorageKeys`. WI'ens AC var fil-afgrænset ("i `storageManifest.ts` og celle-fokusmodulet") og fangede derfor ikke, at sletningen af konsumenten efterlod infrastruktur ét modul længere ude — ordret samme fejl som WI'ens egen rodårsag. | Moderat | bekræftet — slettet; AC omformuleret til at følge AFHÆNGIGHEDSKANTEN frem for filgrænsen | rettet |
| I4 | **`CellTableId` er en kaldeløs eksport i det NYE modul.** Den var også død før, men jeg skrev filen fra bunden under beslutningen "kun det, der har en kalder". | Lav | bekræftet — slettet | rettet |
| I5 | **`main.tsx:12` opfandt en "systemnotice-port", der ikke findes** (`grep -i systemnotice` → nul træf uden for min egen nye kommentar). Substansen var rigtig (noticen ER wiret), men mekanismen er, at `MainLayout` gen-kalder den idempotente bootstrap og læser `startup.notice` — netop den værdi, `main.tsx` selv kasserer. | Lav, men faktuelt forkert | bekræftet — omskrevet til den faktiske vej | rettet |
| I6 | **Vakuøs test:** `har præcis ét schema per sektionsnøgle` sammenlignede `Object.keys(persistenceSchemas).length` med `PERSISTED_SECTION_KEYS.length` — som ER `Object.keys(persistenceSchemas)`. | Lav | bekræftet — slettet (samme tautologi-mønster som I1) | rettet |
| I7 | **Mistet namespace-dækning:** den slettede `getKnownStorageKeys`-test var den eneste, der dækkede `activeTab`-grenens namespace-isolation. | Lav | bekræftet — ny test `activeTab-præfikset er også namespace-isoleret` | rettet |
| I8 | **Tre oversete kommentarer beskriver den slettede model i nutid:** `appSettingsSchema.ts:20` (`FormPersistenceContext` / `STORAGE_KEYS`), `AppSettingsContext.tsx:19` (".eo payload bygges ud fra sessionStorage keys" — nu faktuelt forkert), `Indstillinger.tsx:122` (`FormPersistenceContext`). | Lav | bekræftet — alle tre rettet | rettet |
| — | Datatab ved `.eo`-load (sektionsmængde + iterationsorden) | — | **ingen fund** — verificeret: samme ni nøgler i samme insertion-orden; `sectionsPresent` er et filter, løkken skriver keyed | lukket |
| — | Forældreløse sessionStorage-data efter sletningen | — | **ingen fund** — der fandtes ALLEREDE ingen oprydningsvej; D2's korrektion bekræftet uafhængigt | lukket |

### Eksternt review (Codex sol 5.6 / medium)

Brugerens tokenbegrænsning: ét kald, medium (ikke high, trods klasse H). Det interne review kørte først,
så Codex mødte et allerede renset diff. **Kørt som `codex exec -s read-only`**, fordi
`codex review --uncommitted` afviser at modtage en prompt (kendt fra WI-004 runde 3).

Fem fund, alle bekræftet mod koden. To af dem **forbedrede løsningen ud over det interne reviews niveau**
ved at flytte et værn fra syntaktisk til strukturelt — præcis den slags rodårsagsanalyse, det ene tilladte
kald skulle bruges på.

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
| X1 | **Værnet kontrollerer syntaks, ikke nøglens proveniens.** Det interne reviews I2-rettelse udvidede AST-reglen til helper-vejen, men reglen ser kun `firstArgStringLiteral`. `const k = 'mineo_invalidDrafts'; writeSessionStorageValue(k, v)` passerer — og en ikke-literal nøgle er udtrykkeligt en *clean* fixture. Codex kaldte det korrekt "samme underliggende problem som I2". | **Strukturelt** | **bekræftet — anbefaling FULGT.** Codex' primæranbefaling (brandet nøgletype, kun skabelig af manifest-facaden; AST-reglen degraderet til sekundær diagnostik) er implementeret: `ManifestStorageKey` i `storageManifest.ts`, og begge skrivefunktioner tager den. **Produktions-typecheck var ren UDEN ændringer i callsites** — hver eneste write brugte allerede en manifest-produceret nøgle, så branden koder eksisterende praksis frem for at pålægge en ny. Læsning/sletning tager fortsat `string` (oprydning efter ukendt nøgle skal være lovlig). **Mutationstestet:** blødte branden op til `string` og bekræftede, at `typecheck:test` fejler | rettet |
| X2 | **Den nye autoritative sektionsliste var mutérbar.** `PERSISTED_SECTION_KEYS` blev eksporteret som `PersistedSectionKey[]`, og `fileLoad` bruger SAMME array til både optælling (`:86`) og behandling (`:99`) — en `push`/`splice` fra en vilkårlig consumer ville ændre begge på én gang. Roden: den nye ene sandhedskilde blev ikke samtidig gjort immutable. | **Strukturelt** | bekræftet — `Object.freeze` + `readonly PersistedSectionKey[]` | rettet |
| X3 | **`StorageKey` betød nu to ting.** I registry'et en logisk `.eo`-sektion, i manifestet en konkret browserlager-nøgle. Det bevarede navn fastholdt netop den storage/sektion-sammenblanding, WI'en fjerner. | **Strukturelt** | bekræftet — omdøbt til `PersistedSectionKey` i hele repoet; `ManifestStorageKey` er nu det eneste "storage key"-begreb | rettet |
| X4 | **Testen beviste registry-mængden, ikke load-invarianten.** `persistenceRegistry.test.ts` kalder aldrig load-koden. | Lokalt testhul | **DELVIST AFVIST med evidens.** Codex' forudsætning holder ikke: `fileRoundTrip.fullState.test.ts` kører ALLEREDE alle ni sektioner gennem den rigtige `loadFromFile` med per-sektion deep-equality mod den kanoniske save. Den anbefalede nye test ville duplikere den. Den REELLE rest var, at dens løkke itererer `PERSISTED_SECTION_KEYS` og derfor ville skrumpe lydløst med kilden — lukket med en uafhængig `length === 9`-assertion før løkken | rettet (anden løsning) |
| X5 | **Doc'et foregreb sin egen konklusion.** (a) "Fase 0–4 er endeligt lukket", mens WI'en stod `under-implementering` med tomt verifikationsafsnit og udisponerede reviewfund. (b) "`fileLoad` itererer den ét sted i stedet for to" — forbedringen er én KILDE, ikke ét iterationssted; koden har fortsat to gennemløb. | Lokalt dokumentationsfund | bekræftet — (b) omformuleret til "to gennemløb læser nu samme kilde"; (a) lukket ved at status først sættes `afsluttet` EFTER at fundene er disponeret og gates er grønne | rettet |

## Efterslæb ryddet ud over det planlagte

- **`hasInvalidDraft` → `hasRejectedInput`** (EET-forligsinputtet, 9 sites, ingen persisteret nøgle).
  Det var det SIDSTE levende `invalidDraft`-navn i produktionskoden — et internt felt, hvis betydning
  ("afvist råtekst i et ansvarsgradsfelt") allerede ER greenfield-begrebet `rejectedInputs`. WI-006's
  krav om ét kanonisk begreb pr. betydning er dermed opfyldt for de levende navne.
- Tilbage i koden står kun de tre sanktionerede kategorier: `allowLeavingInvalidDraft` (D5 —
  semantisk korrekt, beskriver editorens draft-tilstand), negative historiske referencer der siger at
  modellen ER slettet, og de navngivne AST-forbudslister.

## Resterende / risici

- `gridCells.tsx` (6 komponenter i én fil) — bevidst henlagt, se scope.
- ~190 legitime "Greenfield"-prosaforekomster — tilladt af doc'et (`:1357`).
- Fase 5 (18 dokumentoutputs), Fase 6 (håndhævelse + ledger-sletning), Fase 7 — ikke påbegyndt.
- `WI-005` (ansvarsbaserede arkitekturværn) forbliver Fase 6. **Bemærk:** X1's brandede nøgletype er
  et konkret eksempel på præcis det, WI-005 vil generalisere — et ansvarsbaseret værn (hvem må skrive
  til lageret) frem for et navnebaseret. Den erfaring bør bæres med derover: hvor en grænse kan
  udtrykkes i TYPESYSTEMET, er det stærkere end en AST-regel, fordi typen også fanger de indirekte veje.
- **`WI-006` er hermed dækket og kan lukkes:** dens scope (klassificér hvert `invalidDraft`-navn efter
  faktisk betydning, afgør storage-nøglen særskilt) er gennemført her — storage-nøglen blev slettet
  frem for omdøbt (D2), det levende fokus-navn blev omdøbt (D4), og det sidste levende felt-navn er
  ensrettet ovenfor. Beslutningen om at behandle dem samlet frem for i en separat WI: de tre delte én
  rodårsag, og en omdøbning af død kode ville have været forkert arbejde.
