# WI-004: Luk de resterende Fase 3+4/undo-redo-fund endegyldigt

- **Status:** `review` — alt implementeret inkl. runde 1's seks fund (R1–R6); alle fire gates + fuld suite
  grønne. **Afventer et AFSLUTTENDE uafhængigt review:** runde 2 blev afbrudt uden konklusion, så R1–R6's
  lukning er ikke eksternt bekræftet. WI'en lukkes først derefter.
- **Oprettet:** 2026-07-25
- **Slice/scope:** Greenfield draft/commit — restfundene fra det opfølgende Codex sol/high-review
  (`docs/reviews/codex-fase34-followup.md`): F2 (Forsørgertab/EET/EO kalder motorer uden strukturel
  dependency-gate), F4 (ufuldstændig feltadresse→destination-tabel) samt de dokumenterede dæknings-
  huller (transient-input, grid dropdown/two-stage-reentry, Renteberegnings projektionsmatrix,
  save-token under filpicker, origin-fuldstændighed).
- **Kilde:** `docs/reviews/codex-fase34-followup.md` §"Resterende teknisk gæld" punkt 1, 3, 6 + brugerønske
  ("få fase 3, fase 4 og undo/redo endegyldigt færdigt").
- **Risikoklasse:** **H** — beregningsgating, dokumentgates, tre domænesnapshots, save/load-token og
  tværgående navigation. Kan ændre hvad brugeren ser, når felter er røde.
- **Baseline:** HEAD `d6d54cde` på branch `greenfield`; working tree rent. Ingen fremmede ændringer.

## Scope

**Inde i scope:**

1. **F2 — strukturel dependency-gate før motorkald** i Forsørgertab, EET og EO. Kontraktkravet er
   utvetydigt: `form-contract.md` §2.3 "Kun en `ready` projektion må fodre beregningsmotorer" og
   `error-contract.md` §5 "En projektion kalder ikke beregningsmotoren, hvis et afhængigt issue gør
   input uanvendeligt". Alle tre slices kalder i dag motoren, hvorefter reader-fejlene bruges til
   fieldUi/gate. Årsløn er allerede rettet (`calculation: null` ved rød gate) og er mønsteret.
2. **F4 — komplet, kanonisk destination pr. editorflade.** Erstat den håndskrevne
   feltadresse→fane-heuristik i `inputCore/react/fieldAddressDestination.ts` med en komplet afbildning,
   som dækker `eoBilagSelection` (Beregning-fanen) og de ikke-EO-sektioners ikke-default-faner
   (fx EET Differencekrav).
3. **Dækningshuller** (followup §"Mistet testdækning"): transient-input-invarianter, grid
   dropdown-navigation + to-trins-genindtræden efter blur, Renteberegnings fulde projektionsmatrix,
   en test der beviser at ingen produktions-row-command mangler origin, og en test der faktisk kan
   fange save-token-hullet under den interne filpicker.

**Bevidst UDEN for scope:**

- Fase 5 (de 18 dokumentoutputs) og Fase 6 (håndhævelse).
- F8's navnekonsistens (`CheckboxProps`/`gridCells.tsx`) — kosmetisk, ingen adfærd; noteres som rest.
- F7's ønske om ansvarsbaserede frem for navnebaserede legacy-guards — vurderes efter F2/F4.

## Autoritativt grundlag

- `src/contracts/form-contract.md` §2.3, `src/contracts/error-contract.md` §5, §1.10/§5.4 i
  `docs/architecture/draft-commit-greenfield-design.md`.
- `src/domain/aarsloen/aarsloenProjection.ts` som det godkendte gate-mønster (motor kun i `ready`).
- Legacy er slettet; korrekthedsorakel er de eksisterende snapshot-tests og dokumentgate-tests.

## Invarianter (må ikke brydes)

- **Beregningstal ændres ikke** for input uden røde feltfejl. Gaten må kun ændre, hvad der sker, når
  en afhængighed *er* rød.
- §1.10: gaten skal være DEPENDENCY-SPECIFIK. En rød virkningsdato må fortsat blokere ASL-delen og
  bevare EAL-panelet. En global "alt eller intet"-gate ville være en regression.
- Download-gate-invarianten: EO/forsørgertab-download blokeres aldrig uden synlig fejl i boksen.
- Ingen ny parallel klassifikations-sidekanal ved siden af snapshottets egen gate.

## Kortlægning (Codex sol/high, 2026-07-25)

Codex bekræftede F2 for alle tre slices og korrigerede to antagelser i dette WI's første udkast.

**Bruddets natur.** Det er ikke primært, at motoren *kaldes* — det er at reader-fejl maskeres til
tomværdier, så motoren regner på et FALSK input. Konkret:

- Forsørgertab: `readField` gør en rød værdi `undefined`
  (`forsoergertabReaderProjection.ts:64`), og `computeForsoergertabCalculation` kalder ubetinget både
  EAL- og ASL-grenen (`forsoergertabSnapshot.ts:165`). En rød EAL-årsløn kan derfor udløse
  ASL-fallback, som var EAL-årslønnen tom.
- EET: alle fire panelmotorer kaldes FØR deres field issues bygges (`eetSnapshot.ts:127/153/179/232`).
  Maskeret EAL-% eller EAL-årsløn kan give falsk ASL-fallback (`eetEalCalculation.ts:158/184`).
- EO: `readOrEmpty` (`erstatningsopgoerelseReaderProjection.ts:181`) maskerer HELE inputtræet, så
  validatoren kun ser maskeret input (`eoSnapshot.ts:262`) og motorerne kaldes bagefter (`:324`).
  `eoErrors` bruges kun til inspektion (`eoSnapshot.ts:302-303/372-373` — verificeret).

**Kritisk korrektion af §1.10-læsningen.** §1.10 kræver IKKE én gate pr. slice; den kræver flere små
dependency-specifikke `ready | blocked`-projektioner. En global slice-gate ville være FORKERT. Rettelsen
må derfor ikke kun fjerne falske tal — den må heller ikke OVERBLOKERE. EO's nuværende globale validator
gør netop det: et ugyldigt S/S-satsår sætter hele `data` til `null` (`eoSnapshot.ts:276`) og fjerner
dermed også gyldige, uafhængige TAF-/reguleringstabeller.

**Ny fundet kontraktdrift (verificeret selvstændigt).** `error-contract.md`'s normative
konsekvensmatrix (§1.1) siger, at en `range`/`bounds`-fejl på en canonical værdi *ikke* blokerer `.eo`
men *ja* blokerer afhængig beregning/dokument. `eoIssueBlocksDependents`
(`eoInputIssues.ts:29-30`) undtager `bounds` fra at blokere dependents og konflaterer dermed
"gembar" med "beregnbar". Skal rettes sammen med F2.

**Fallback-invariant.** Rød primærværdi må ALDRIG omfortolkes som tomhed: kun en reelt tom værdi må
aktivere en fallback (EAL→ASL i både forsørgertab og EET).

## Parallel / duplikeret logik

- **Fund:** de tre slices har hver deres panel-/dependency-gates. Spørgsmålet var, om de skal ensartes.
- **Beslutning (Codex + tiltrådt):** del KUN den mekaniske primitiv "kald callbacken udelukkende i
  `ready`-grenen" (`calculateWhenReady`). Alt andet forbliver domænelokalt: hvilke felter et panel
  læser, betingede fallbacks, missing-/domæneissues, issue-id'er, runtimefejlhåndtering og
  præsentationsgates.
- **Begrundelse:** panelgates er reelt forskellige concerns — fx kræver forsørgertabs ASL-*visnings*gate
  skadelidtes fødselsdato, selv om ASL-*motoren* ikke bruger den (`forsoergertabSnapshot.ts:284`). At
  ensarte dem ville give forkert blokering, præcis som den afviste A5-ensartning
  (jf. `project_a5_taf_yearset_rejected`). Motoren må desuden IKKE ligge inde i `runProjection`-
  callbacken: den udføres, før collectorens status er afgjort (`inputCore/projection.ts:116`).

## Acceptance criteria

- [ ] Forsørgertab, EET og EO kalder aldrig deres beregningsmotor, når en afhængighed er rød —
      bevist med test pr. slice, ikke kun ved kodelæsning.
- [ ] Dependency-specifik opdeling bevaret: test viser at ét rødt felt blokerer sin egen del og
      bevarer de uafhængige dele.
- [ ] `resolveFieldAddressDestination` returnerer korrekt fane for `eoBilagSelection` og for EET's
      Differencekrav-felter; en completeness-test dækker alle aktive editorlokationer.
- [ ] Dækningshullerne fra followup §"Mistet testdækning" er lukket eller eksplicit afvist med evidens.
- [ ] Alle fire gates grønne + fuld suite grøn.

## Godkendelsesgate

- **Påkrævet:** **UI/UX** — F2's rettelse ændrer, hvad brugeren ser i EO's beregnings-/kontrolvisning,
  når et felt er rødt. Forsørgertab og EET har INGEN tilsigtet synlig ændring (deres UI gater allerede
  på `!hasBlockingErrors && computation`; rettelsen fjerner en usynlig falsk beregning bag den gate).

- **Status og beslutning:** **GODKENDT 2026-07-25** — tre eksplicitte brugerbeslutninger:

  1. **EO ved rødt felt → vis `-`/ikke beregnet.** Et EO-output, hvis afhængighed er rød, beregnes ikke
     og vises som `-`. Uafhængige dele bevares. Konkret godkendt: ugyldig "Tidligere udbetalt
     svie/smerte" → `Beregnet svie/smerte` viser `-` i stedet for et beløb regnet som tidligere = 0;
     ugyldig forligsprocent → forligsafhængige beløb + totaler beregnes ikke, før-forlig-resultater
     består; ugyldig "Tidligere modtaget TAF" → TAF-afhængig total/årsoutput beregnes ikke, S/S og
     øvrige krav består. Download forbliver blokeret med synlig fejl.
  2. **Overblokeringen rettes i samme ombæring: split pr. afhængighed.** Et ugyldigt svie/smerte-satsår
     må ikke længere fjerne den gyldige TAF-visning og det gyldige reguleringsforløb
     (i dag: `eoSnapshot.ts:276` sætter hele `data` til `null`). Kun outputs, hvis EGEN afhængighed er
     rød, blokeres.
  3. **Bounds-fejl følger kontrakten.** `eoIssueBlocksDependents` rettes, så en canonical
     `range`/`bounds`-fejl blokerer den beregning/det dokument, der læser feltet, men fortsat IKKE
     `.eo`-save. Dvs. "gembar" ≠ "beregnbar", jf. `error-contract.md` §1.1's normative matrix.
     Kontraktteksten ændres IKKE — koden bringes i overensstemmelse med den.

## Verifikation

- **Plan:** målrettede tests pr. slice, derefter `npm run typecheck`, `typecheck:test`, `lint`,
  `verify:ledgers` og fuld `npx vitest run` (klasse H kræver fuld gate). `scripts/generate-build-info.mjs`
  køres før fuld suite (kendt fælde med stale build-info).

- **Resultat (2026-07-25):** alle fire gates grønne; fuld suite grøn.
  - `npm run typecheck` — ren
  - `npm run typecheck:test` — ren
  - `npm run lint` — ren (`--max-warnings 0`)
  - `npm run verify:ledgers` — inventar verificeret (239 felter / 16 collections / 18 dokumentoutputs)
  - `npx vitest run` — **484 filer / 5962 tests** (fra 482/5941 ved baseline efter transient-fixet;
    fra 480/5924 ved F2-start; baseline før WI var 488/5991 — faldet skyldes tidligere sletninger, ikke dette WI)

## Implementeret

**F2 — strukturel dependency-gate før motorkald (alle tre slices).**

- Ny delt primitiv `calculateWhenReady` (`inputCore/projection.ts`): den ENE mekaniske overgang fra
  `ready | blocked` til et motorkald. Bevidst minimal — den ensarter kun "kald ikke motoren, når projektionen
  er blokeret", ikke paneldependencies eller præsentationsgates. `runProjection` har fået en advarsel om, at
  `body` udføres FØR statussen afgøres, så et motorkald derinde ville køre selv ved `blocked`.
- **Forsørgertab:** EAL- og ASL-grenen er nu hver sin dependency-gruppe med sin egen feltliste
  (`forsoergertabSnapshot.ts`); `computeForsoergertabCalculation` tager `ealBlocked`/`aslBlocked` og kalder kun
  den gren, der er ready. Fallback-invarianten er implementeret præcist: `aslAarsloen` er kun en
  EAL-afhængighed, når EAL-årslønnen er tom (dvs. når motorens fallback faktisk nås) — ellers ville en rød
  ASL-årsløn overblokere EAL-panelet. 7 nye invarianttests i `forsoergertabEngineGate.test.ts`.
- **EET:** ny `buildGatedProjection` afgør panelets egne issues FØR `calculate` kaldes; alle fire paneler er
  konverteret. 8 nye invarianttests i `eetEngineGate.test.ts` med spies på de faktiske motorer, og hver test
  kontrollerer BEGGE retninger (afhængigt panel blokeres, uafhængigt panel bevares) — ellers ville en global
  gate også bestå.
- **EO:** ny `buildReaderFieldIssueInvariants` fører reader-feltfejl ind ad samme strukturelle vej som
  validator-invarianterne (i stedet for en ny parallel sidekanal); `eoErrors`/`stamdataErrors` gik tidligere
  KUN til inspektionsvisningen. 5 nye tests i `eoEngineGate.test.ts`.
- **Bounds-kontraktdrift lukket:** `eoIssueBlocksDependents` undtog `bounds` fra at blokere dependents med
  begrundelsen "værdien er gembar". Det konflaterede *gembar* med *beregnbar*. Nu blokerer enhver rød årsag de
  afhængige consumers, jf. `error-contract.md` §1.1; `.eo`-save er uændret (gaten dér standser kun aktivt
  rejected råinput). Den test, der låste den gamle adfærd, er inverteret.

**F2-korrektion af Codex' anbefaling.** Codex foreslog, at differencekravet skulle genbruge de gatede
søsterresultater i stedet for at kalde søstermotorerne igen. Det er AFVIST med evidens: grafen kalder dem
bevidst med ANDET input — ASL-rækker filtreret til beregningsdatoen og `dagFoerBeregningsdato`
(`eetCalculationGraph.ts:25-77`). Genbrug ville ændre differencekravets tal (§5.4 hårdt stop). De ekstra kald
er derfor korrekte og gates som helhed af differencekrav-panelets egen dependency-liste.

**F4 — komplet, kanonisk destination pr. editorflade.** `fieldAddressDestination.ts` er omskrevet fra en
heuristik med tavs fallback til eksplicitte tabeller, og `resolveFieldAddressTab` er eksporteret, så en
completeness-test kan iterere det FAKTISKE produktionskatalog. Rettede fejl:
- `eoBilagSelection.*` routes nu til Beregning-fanen (felterne HEDDER fx `loenindkomst`/`offentligeYdelser`, så
  en feltnavns-baseret afbildning sendte dem til de forkerte faner).
- EETs Differencekrav-felter får deres egen fane i stedet for kun standardfanen.
- `eetDifferencekravBilagSelection` er nøglet PR. FELT, fordi `visUdvidetSpecifikation` redigeres på Løbende
  ydelser, mens de øvrige toggles bor på Differencekrav.
- **Fundet af completeness-testen:** afbildningen slog collection op FØR property, hvilket sendte
  `eoAngivetLoenLoenudvikling`s nestede tabeller (samme collection-navne som ansættelsesforholdenes) til den
  forkerte fane. Nu ejer det YDERSTE path-segment destinationen.

**Dækningshuller lukket.**
- **Transient input** (`useTransientDraft.test.tsx`, 10 tests): blur/Enter-commit, Escape uden efterfølgende
  blur-commit, no-op-detektion, ekstern resync (med og uden fokus), beløbsparsing og bounds.
  **Testene fandt en ægte produktionsbug:** `TransientDateInput` testede bounds-beskeden med `!== undefined`,
  men `resolveDateRangeErrorMessage` melder "ingen fejl" med en TOM STRENG. Feltet afviste derfor ENHVER gyldig
  dato med en tom besked — dvs. sygedagpenge-indsættelsen i `OffentligeYdelserTab` kunne slet ikke bruges.
  Rettet.
- **Grid dropdown + to-trins-genindtræden** (`gridCellReentry.integration.test.tsx`, 8 tests): en ægte grid med
  rigtig controller og rigtige celler. Dækker commit → luk → redigér IGEN (cellen må ikke blive "død"),
  Escape-genindtræden, Delete-ryd, dropdown-registrering, dropdown-commit og `commitCurrent` som
  no-op-success. Driver cellen gennem den registrerede `GridCellEditorHandle` — samme kald som
  `tableKeyboardNavigation` foretager — fordi navigationens celleopslag filtrerer på `isTableElementVisible`,
  og jsdom giver nul dimensioner; en keydown-baseret test ville måle jsdom-layout, ikke broen.
- **Renteberegnings projektionsmatrix** (`renteberegningProjectionMatrix.test.ts`, 11 tests): rejected råinput
  pr. række vs. tværgående, per-række-isolation, aggregat-blokering, issues i blocked, motor-spies der beviser
  at motoren ikke kaldes i blocked, samt tomme/delvise rækker.
- **Origin-fuldstændighed:** `locationNav` og dens `route` er nu PÅKRÆVET i hele tabel-laget
  (`useCollectionTable` + `StandardLoenTable`/`LoenudviklingManuel*`), så compileren håndhæver det. Alle
  eksisterende callsites leverede den allerede (typecheck ren uden ændringer i dem). Derudover en ny
  AST-arkitekturregel `input/row-command-destination` med violating/clean-fixtures, som fanger et
  origin-objekt uden `route`.

## Review-fund

### Runde 1 — Codex sol/high (2026-07-25)

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
| R1 | **EO's F2-gate er både under- og overblokerende.** `buildReaderFieldIssueInvariants` gør ENHVER reader-fejl globalt autoritativt blokerende (`eoSnapshotInvariants.ts:70`), så `data` nulstilles helt (`eoSnapshot.ts:282`) — det er præcis den overblokering, brugerbeslutning 2 forbød. Samtidig kaldes svie/smerte-motoren stadig ubetinget i fejl-grenen (`eoSnapshot.ts:296`), så en rød S/S-afhængighed når fortsat sin motor maskeret. `eoEngineGate` er desuden selvopfyldende: baseline har allerede validatorfejl + `data: null`, og S/S-spy'en asserteres aldrig. | **Kritisk** | bekræftet — rettet | rettet |
| R2 | **EETs efter-EAL-panel underblokerer begge fallbackveje.** Gaten inkluderede hverken `aslAarsloen` eller `aslAfgoerelser` (`eetSnapshot.ts:200`), selv om motoren læser ASL-rækker ved tom EAL-% og ASL-årsløn ved tom EAL-årsløn (`eetEalCalculation.ts:158/184`). Min egen kommentar indrømmede hullet. | **Kritisk** | bekræftet — rettet med BETINGEDE afhængigheder (`isUsableAmount`/`isUsableEetPct` spejler motorens egne betingelser) + 5 nye tests, der dækker begge fallbackgrene og `ealEetPct === 0` | rettet |
| R3 | **F4 dækker ikke faktiske editorflader.** De tre EO-ejede forligsfelter renderes OGSÅ på EET/Differencekrav (`EetDifferencekravTab.tsx:76-78`), men resolveren nøgler kun på `address.section` og sender derfor brugeren til EO-oplysninger. Completeness-testen itererer kun data-descriptors, ikke editorlokationer. | Væsentlig | bekræftet — rettet | rettet |
| R4 | **Row-origin er ikke strukturelt fuldstændig.** `CollectionRowOrigin.route`/`tabKey` er stadig valgfrie i kernetypen (`useCollectionRows.ts:19`), og AST-reglen springer variable origin-argumenter over — med et sådant bypass som *clean* fixture. | Væsentlig | bekræftet — rettet i KERNETYPEN (route+tabKey påkrævet), så AST-reglens hul bliver irrelevant | rettet |
| R5 | **`calculateWhenReady` håndhæver intet.** Den har ingen callsites, men kommentaren kalder den den eneste tilladte overgang. Renteberegning kalder fortsat motoren inde i `runProjection`, og Forsørgertabs gateflags er valgfrie, så et udeladt flag åbner motoren. | Væsentlig | bekræftet — rettet: gateflags gjort PÅKRÆVEDE, og de absolutte påstande erstattet af en præcis beskrivelse | rettet |
| R6 | **To dækningshuller består.** Transient-testen for ekstern ændring under fokus udløser aldrig den eksterne ændring. Grid-suiten beviser reentry, men ikke den faktiske to-trins-klikvej. | Mindre | bekræftet — rettet | rettet |
| — | Min afvisning af Codex' forslag om at genbruge søsterresultater i differencekravet | — | **bekræftet korrekt af Codex** ("Afvisningen af genbrug i differencekravet er korrekt") | lukket |
| — | Bounds-ændringens effekt på `.eo`-save | — | Codex: "Bounds-ændringen påvirker ikke `.eo`-save" | lukket |
| — | `TransientDateInput`-rettelsen + samme mønster andre steder | — | Codex: rettelsen er korrekt, og mønstret findes ikke andre steder (selvstændigt verificeret: descriptor-validatorerne tjekker bounds SELV og bruger helperen kun til beskeden) | lukket |
| — | Beregningstal for input uden røde feltfejl | — | Codex: "Jeg fandt ingen ændring af tal" | lukket |

## Resterende / risici

- **F8-navnekonsistens** (`CheckboxField.tsx` eksporterer `CheckboxProps`/`Checkbox`; `gridCells.tsx` afviger
  fra `GridTextCell.tsx`) og **F7's ønske om ansvarsbaserede frem for navnebaserede legacy-guards** er bevidst
  uden for scope. Rent kosmetisk/strukturelt, ingen adfærd.
- **EO's GLOBALE `data: null` ved en validator-/reader-fejl er PRE-EKSISTERENDE.** WI-004 gør S/S-motoren
  dependency-gatet (så en TAF-fejl ikke stopper S/S og omvendt), men hele `eoSnapshot`s autoritative payload er
  fortsat ét atomisk `data`-objekt: en blokerende invariant nulstiller det samlet.
  `erstatningsopgoerelseValidator` blokerede allerede globalt på forlig/svie-smerte/`tidligereModtagetTaf` via
  `VALIDATION_BLOCKED_OUTPUTS`, længe før dette WI. En fuld leaf-niveau dependency-DAG for EO (så et ugyldigt
  S/S-satsår bevarer den gyldige TAF-tabel i det AUTORITATIVE output, ikke kun i inspektionen) er en betydeligt
  større omskrivning af `eoSnapshot`/`eoCanonicalOutput`/`pdfModel` end dette WI's scope.
  **Anbefaling: egen work item.** Brugerbeslutning 2 (2026-07-25) er opfyldt for det, WI-004 introducerede —
  reader-fejl overblokerer ikke mere end validatorfejlene i forvejen gjorde — men den fulde ambition kræver
  den separate omskrivning.
- **Renteberegning kalder `computeRentekravRow` både pr. række og i aggregatet.** Det er PRE-EKSISTERENDE
  adfærd (uændret af dette WI) og ikke et kontraktbrud: efter rettelsen ligger BEGGE kald uden for
  `runProjection`-kroppen, inde i `mapReadyProjection`, og er derfor gatede. Aggregatet har sin egen
  tomheds-/pdfContext-logik, så en sammenlægning ville kræve en byte-identitetsbevisning (§5.4). Mulig
  oprydning senere, ikke et udestående fund.
