# WI-004: Luk de resterende Fase 3+4/undo-redo-fund endegyldigt

- **Status:** `afsluttet` (2026-07-25) — alle fund fra **fire** eksterne reviewrunder er implementeret og
  dokumenteret: runde 1's R1–R6, slutreviewets S1–S6 (hvoraf R1 og R4 viste sig IKKE lukket), samt
  re-reviewenes T1–T3 og U1–U3. Fire gates + fuld suite grønne (484 filer / 6094 tests).
  **Udskilt som selvstændige WI'er:** `WI-005` (ansvarsbaserede arkitekturværn, Fase 6) og `WI-006`
  (`invalidDraft`-navneoprydning — **obligatorisk før Fase 0–4 erklæres endeligt lukket**).
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

- [x] Forsørgertab, EET og EO kalder aldrig deres beregningsmotor, når en afhængighed er rød —
      bevist med test pr. slice, ikke kun ved kodelæsning.
- [x] Dependency-specifik opdeling bevaret: test viser at ét rødt felt blokerer sin egen del og
      bevarer de uafhængige dele. **Skærpet i runde 4:** testen asserterer det FAKTISKE output (byte-identisk
      periodisering, der faktisk når view-modellen), ikke kun en boolean — en boolean-assertion bestod med
      den globale gate. Mutationstestet.
- [x] `resolveFieldAddressDestination` returnerer korrekt fane for `eoBilagSelection` og for EET's
      Differencekrav-felter; en completeness-test dækker alle aktive editorlokationer.
- [x] Dækningshullerne fra followup §"Mistet testdækning" er lukket eller eksplicit afvist med evidens.
- [x] Alle fire gates grønne + fuld suite grøn (484 filer / 6109 tests).

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

## Runde 3 (2026-07-25) — genoptagelse: "luk Fase 0–4 + undo/redo endegyldigt"

Brugeren bad om, at ALLE udestående forhold for Fase 0–4 og undo/redo lukkes. `/greenfield` er samtidig
opdateret: Codex sol/high afgør nu alle processuelle/designmæssige valg, Claude retter rent kosmetiske
afvigelser selv, og brugeren involveres kun ved synlig UI/UX eller beregningstal.

### Claudes egne fund før Codex' kortlægning (verificeret mod koden)

| # | Fund | Evidens | Alvor | Disposition |
|---|---|---|---|---|
| C1 | **`calculateWhenReady` er død kode.** Eksporteret primitiv med NUL callsites — hverken i produktion eller tests. Den blev indført som svar på R5 og derefter afløst af `mapReadyProjection`, som er den der faktisk bruges (Renteberegning). R5's rettelse omskrev primitivens kommentar i stedet for at give den et formål. | `src/inputCore/projection.ts:161` (definition); `grep calculateWhenReady` giver kun definitionen + tre kommentar-omtaler | Væsentlig (død kode i kernen; AGENTS.md "overflødige/ubrugte exports") | forelagt Codex |
| C2 | **Kontraktdrift: fire bindende kontrakter beskriver slettet kode som "eksisterende migrationskode".** Trin 13 slettede `useDraftField`, `useTableInputCore`, `useRowDrafts`, `FormPersistenceContext`, `invalidDrafts`/`fieldErrors` 2026-07-25, men migrationsklausulerne står stadig som normativ tekst. | `form-contract.md:95,273-279` (§12 Migrationsregel, inkl. "Fase-3-gridbroen"), `mineo-field-pattern.md:194` (§10), `error-contract.md:82`, `persistence-contract.md:9,94,219` | Væsentlig (AGENTS.md: kode↔kontrakt ude af sync = arkitekturfejl) | forelagt Codex |
| C3 | **Kosmetisk: `CheckboxField.tsx` eksporterede `Checkbox`/`CheckboxProps`** mod søskendefamiliens `<Navn>Field`/`<Navn>FieldProps`. Callsites importerede allerede default'en som `CheckboxField`. | `fields/CheckboxField.tsx`, `fields/index.ts:33-34` | Kosmetisk | **RETTET af Claude uden forelæggelse** (ny §0-regel); `typecheck` ren |
| C4 | **Prosa-drift: "Greenfield" står stadig i 129 kommentarer i 108 produktionsfiler**, selv om F8 fjernede præfikset fra alle identifikatorer. Nogle er direkte forkerte (`Greenfield-wrapperen`, `Greenfield-wrappere` peger på komponenter, der ikke længere hedder det). | `grep -rn Greenfield src --include=*.ts* \| grep -v __tests__` → 129 træf, 0 identifikatorer | Kosmetisk, men stort omfang | forelagt Codex (omfanget gør det til et scope-valg, ikke en ren nit) |

### Verifikation af R1 (Claudes egen, uafhængigt af Codex)

- **Under-blokeringen er lukket:** S/S-motoren gates nu på sine EGNE felter før kaldet i fejl-grenen
  (`eoSnapshot.ts:332` → `hasBlockingSvieSmerteDependency`, `:160-181`).
- **Over-blokeringen er IKKE strukturelt lukket** — men det er præcis den pre-eksisterende atomiske
  `data: null` (`eoSnapshot.ts:355`), som dette WI selv har udskilt som punkt A nedenfor. R1's egen
  rettelse er dermed korrekt afgrænset; restproblemet er det separate.

### Codex sol/high's kortlægning og beslutninger (runde 3, 2026-07-25)

Codex verificerede R1–R6 mod HEAD `88a15220` og fandt **to, der IKKE var lukket**:

- **R1 — IKKE LUKKET.** S/S-motoren er korrekt dependency-gatet (`eoSnapshot.ts:326-340`), men enhver
  blokerende invariant giver stadig samlet `data: null` (`:312-361`), og reader-invarianterne blokerer ALLE
  outputs (`eoSnapshotInvariants.ts:70-88`). Den godkendte leaf-opdeling mangler. *(Sammenfaldende med min
  egen verifikation ovenfor.)*
- **R4 — IKKE LUKKET.** Surface-hooken kræver route/fane (`useCollectionRows.ts:23-46`), men KERNENS
  `CollectionHistoryOrigin` arver fortsat valgfrie `route`/`tabKey` (`inputHistory.ts:14-18,35-41`). En
  direkte dispatch kan derfor stadig lave en række-origin uden destination.
- R2, R3, R5, R6 — **LUKKET** med evidens.

**Beslutninger (Codex, jf. `/greenfield` §0 — kriteriet er bedste slutprodukt):**

| Forhold | Beslutning |
|---|---|
| EO's atomiske autoritative `data` (punkt A) | **LØSES NU.** Codex omgør WI'ens "egen work item"-anbefaling: det er et uopfyldt Fase-3-exitkriterium og en allerede godkendt brugerbeslutning; størrelsen berettiger ikke udskillelse. |
| Collection-origin typehul (R4) | **LØSES NU** i kernetypen. |
| Kontraktdrift om slettet migrationskode (mit fund C2) | **LØSES NU** — bekræftet af Codex, som desuden fandt at Fase-1-status stadig siger "udestår". |
| `calculateWhenReady` død kode (mit fund C1) | **LØSES NU** — slettes; `mapReadyProjection` er den ene overgang. |
| F7 ansvarsbaserede arkitekturværn | **NY WI under Fase 6.** Ikke et Fase-0–4-exitkrav; det præcise deleted-symbol-værn beholdes indtil da. |
| Dobbelt `computeRentekravRow` (punkt D) | **AFVIST.** Intet kontraktbrud eller forkert resultat; konsolidering kræver nyt byte-identitetsbevis uden nødvendig gevinst. *(Min egen læsning bekræfter: de to kald har forskellig gating-semantik — pr. række vs. alle-rækker — så en sammenlægning ville ændre hvilke rækker der giver resultat.)* |
| C4 "Greenfield"-prosa i 129 kommentarer | Ikke rejst af Codex som fund; behandles som kosmetisk oprydning, hvor den er direkte forkert. |

**Designbeslutning om DAG-granularitet (Codex sol/high, forelagt med tre alternativer + evidens).**
Spørgsmålet var, hvor snittet går mellem "node" og "krydsgående aggregat", eftersom `totals.samletTotalOre`
summerer S/S + TAF + øvrige krav, `canonicalOutput` bygges af dem alle, og `pdfModel` er ét dokument.

- **VALGT — A: noder kun for de uafhængige grene; aggregater er alt-eller-intet.** `data` får selvstændige
  noder for S/S, TAF, øvrige krav og regulering, som overlever hinandens fejl. Aggregatnoden
  (`samletTotalOre` + `canonicalOutput` + `pdfModel`) er `blocked`, hvis bare ÉN summand er blocked —
  *"en samlet sum eller et fuldt dokument kan ikke være autoritativt uden alle led"* (Codex).
- Afvist: B (delvise totals — flere dependency-lister at tage fejl i, og "I alt" blokeres alligevel) og
  C (node pr. canonicalOutput-felt — over-engineering mod AGENTS.md's konvergensregel).
- Codex bekræftede eksplicit, at A opfylder **brugerbeslutning 2 fuldt ud**: de uafhængige TAF- og
  reguleringsnoder forbliver `ready` og synlige ved en S/S-fejl.

**UI/UX:** Codex bekræfter, at **ingen ny brugergodkendelse kræves** — den eneste synlige ændring (et rødt
S/S-felt fjerner ikke længere gyldig TAF-/reguleringsvisning) er præcis brugerbeslutning 2 fra 2026-07-25.

### Implementeret i runde 3 (2026-07-25)

| Trin | Ændring | Filer |
|---|---|---|
| R4 | **Destinationen er nu påkrævet i KERNETYPEN.** `CollectionHistoryOrigin` bygger på en ny `RequiredOriginDestination` (`route: string`, `tabKey: string \| null`), mens felt-origin beholder den valgfrie destination — standalone MinProcesrente er en reelt ikke-navigerbar lokation, og et felt-origin har trods alt et felt at fokusere. En rækkehandling har ikke. To `@ts-expect-error`-cases fejler, hvis typen igen blødes op. Alle eksisterende callsites leverede allerede felterne (typecheck ren uden ændringer i dem). | `inputCore/inputHistory.ts`, `__tests__/inputCore/inputHistory.test.ts` |
| C1 | **`calculateWhenReady` slettet.** Nul callsites i både produktion og tests; `mapReadyProjection` er den faktiske og eneste overgang. Dens JSDoc har overtaget den præcise beskrivelse (inkl. hvorfor de tre domæneslices gater anderledes). | `inputCore/projection.ts`, `domain/renteberegning/renteberegningReaderProjection.ts` |
| R1 | **EO's afhængighedsopdeling (model A).** Nyt `eoDependencyGroups.ts` ejer de fem grene (`svieSmerte`, `taf`, `oevrigeKrav`, `regulering`, `forlig`) ét sted; snapshottet bærer resultatet som `blockedDependencies`. **TAF-periodiseringen er nu også gatet** — den læser TAF-grenens datofelter, så en rød dato gav før en periodisering udledt af en maskeret tomværdi. Aggregatet forbliver bevidst alt-eller-intet, og `hasAnyBlockingEoIssue` er fail-closed-backstoppet for en rød feltnøgle, ingen gruppe genkender. | `snapshot/eoDependencyGroups.ts` (ny), `snapshot/eoSnapshot.ts` |
| C2 | **Kontraktdrift lukket.** `form-contract.md` §12, `error-contract.md` §11 + §2, `mineo-field-pattern.md` §10 og `persistence-contract.md`s intro beskrev slettet kode som "eksisterende migrationskode". De beskriver nu, at koden ER slettet, og at den ikke må genindføres. Design-doc'ens Fase-1-status sagde stadig, at bounds-korrektionen "udestår", og at kernen har "nul produktionscallsites" — begge rettet. | 4 kontrakter + `draft-commit-greenfield-design.md` |
| C3 | **Kosmetisk (rettet uden forelæggelse, ny §0-regel):** `CheckboxField.tsx` eksporterede `Checkbox`/`CheckboxProps` mod søskendefamiliens `<Navn>Field`. | `fields/CheckboxField.tsx`, `fields/index.ts` |
| F7 | **Udskilt som `WI-005`** (Fase 6), efter Codex' beslutning. Det navnebaserede deleted-symbol-værn beholdes indtil da. | `work-items/WI-005-ansvarsbaserede-arkitekturvaern.md` (ny) |

**Dokumentation:** EO-DAG'en er nu normativ i `eo-snapshot-contract.md` **§3.3** (ny), med begge fejlretninger
(for smal gruppe → falske tal; for bred gruppe → overblokering) og reglen om det krydsgående aggregat.
Den gamle §3.3 er §3.4, og krydsreferencen i `loenudviklingBeregning.ts` er fulgt med.

**Egen-fundet fejl i første udgave af grupperne (rettet før slutreview).** Grupperne var skrevet efter
SCHEMA-feltnavne, men `eoErrors` bruger et andet og mindre nøglesæt (`EO_TOP_LEVEL_ERROR_FIELDS` +
`${afId}:loenindkomst`). Konsekvensen var reel: `forligsgrad`/`forligIndgaaet` findes ikke som nøgler, så en
rød ansvarsgrad blokerede **ingen** gren, og fire TAF-nøgler (`uspecificeredeFerieFridage`,
`oevrigeFravaersdage`, `maanedsloenenUdgoer`, `dagsloenenUdgoer`) ramte heller ingen. Rettet ved at skrive
grupperne mod det faktiske nøglesæt og eksportere `EO_TOP_LEVEL_ERROR_KEYS`, så en **completeness-test
itererer produktionskataloget** i stedet for en håndskrevet kopi, der ville have gentaget samme fejl.

Samtidig blev `regulering`- og `oevrigeKrav`-grenene FJERNET: ingen af dem kan udløses. Reguleringsfejl
rapporteres gennem lønindkomst-aggregatet (TAF), og øvrige krav-celler når slet ikke `eoErrors` — de
evalueres i `EO_ROW_BUILDERS` med deres egen download-gate. Grene, der aldrig kan fyre, foregøgler en
præcision, der ikke findes. Tilbage står de tre reelle: `svieSmerte`, `taf`, `forlig`.

**Testene er mutationstestede, ikke kun grønne.** Jeg ændrede `svieSmerte`-gaten til den globale
`hasAnyBlockingEoIssue` (dvs. genindførte overblokeringen) og bekræftede, at **4 tests fejler**. En suite, der
også ville bestå med en global gate, ville ikke bevise §1.10.

**Verifikation (2026-07-25, runde 3):** alle fire gates grønne (`typecheck`, `typecheck:test`,
`lint --max-warnings 0`, `verify:ledgers` — 239 felter / 16 collections / 18 dokumentoutputs) og fuld suite
grøn: **485 filer / 6008 tests** (fra 484/5973 ved rundens start; +35 nye tests, ingen regressioner).

**UDESTÅR FØR WI'EN KAN LUKKES:** det afsluttende uafhængige Codex-review af runde 3's diff er IKKE
gennemført. Første forsøg fejlede på en OpenAI-udfald (503 `biscuit_baker_service_me_circuit_open`), og
`codex review --uncommitted` afviser desuden at modtage en prompt (brug `codex exec -s read-only` med
diffens filer i stedet). Status forbliver derfor `review`.

## Runde 4 (2026-07-25) — det afsluttende slutreview blev endelig gennemført

Codex sol/high reviewede commit `8d3946ed` (read-only `codex exec` mod commitdiffen, fordi
`codex review --uncommitted` ikke kan se committet arbejde). **Seks fund, tre kritiske — alle verificeret
mod koden af mig og bekræftet.** R1 og R4 var IKKE lukket, og C2 kun delvist.

| # | Fund og evidens (egen verifikation i parentes) | Alvor | Disposition |
|---|---|---|---|
| S1 | **R1 ikke lukket — EO er fortsat globalt atomisk.** `data` kræver alle motorresultater samlet (`eoSnapshot.ts:50-79`), og fejl-grenen returnerer `data: null` (`:344`). Beregning-visningen læser KUN `snapshot.data` (`eoSnapshotToBeregningView.ts:16-17`) — den ser ALDRIG `inspektionSnapshot`. Brugerbeslutning 2 er derfor **ikke** opfyldt: et rødt S/S-felt fjerner stadig den gyldige TAF-visning på Beregning-fanen. Den nye test tjekker kun booleanen `blockedDependencies.taf === false`, ikke at TAF-outputtet bevares — den består med den globale gate. *(Verificeret: begge filreferencer er korrekte.)* | **Kritisk** | bekræftet |
| S2 | **Forlig er fejlklassificeret som uafhængig af S/S.** `svieSmerteEngine` kalder SELV `parseForligsgrad` (`svieSmerteEngine.ts:234`) og skalerer både dagssats, maksimum og total med faktoren (`:251-254`). `FORLIG_GROUP` antager uafhængighed, så fejl-grenen kalder S/S-motoren med en maskeret ugyldig forligsprocent — regnet som "intet forlig", dvs. 100 %. *(Verificeret: import på `:18`, brug på `:234-254`.)* | **Kritisk** | bekræftet |
| S3 | **Dependency-grupperne kan ikke se de røde input, motorerne læser.** `eoErrors` indeholder KUN 11 top-level-nøgler (`erstatningsopgoerelseReaderProjection.ts:599-611`) + `${afId}:loenindkomst` (`:663-675`). Røde RÆKKE-celler (`rebuildSvieSmerteRow`, `rebuildTafPeriodeRow`, ferie-/fraværsceller) maskeres af `readOrEmpty` og når ALDRIG `eoErrors`. Derfor er `keyFragments: ['svieSmertePerioder']` og `['tafPerioder']` **død kode** — de kan aldrig matche en produktionsnøgle. `stamdataErrors` har samme hul: de gør invarianten globalt rød, men indgår slet ikke i `resolveEoBlockedDependencies` (`eoSnapshot.ts:311`). *(Verificeret selvstændigt: kataloget har præcis 11 nøgler; ingen rækkecelle føjes til.)* | **Kritisk** | bekræftet |
| S4 | **R4 ikke strukturelt lukket.** `CollectionHistoryOrigin` kræver destination, men dispatch-PORTEN tillader at udelade origin helt (`inputRuntimeContext.tsx:56`, `dispatchInput.ts:33`), og history gemmer da `undefined` (`:177`). Tre konkrete strukturelle callsites uden origin: `OffentligeYdelserTab.tsx:192,243`, `useLoenindkomstViewModel.ts:121`. AST-værnet ser kun `useCollectionRows`/`useCollectionRowCommands`. | Væsentlig | bekræftet |
| S5 | **`hasAnyBlockingEoIssue` er død kode.** Nul produktionscallsites (`grep` bekræfter: kun definition + tests + kontrakten). Den faktiske backstop er den globale reader-invariant (`eoSnapshotInvariants.ts:70`) — som netop ER S1's overblokering. | Væsentlig | bekræftet |
| S6 | **C2 kun delvist lukket.** `mineo-field-pattern.md:8` siger stadig "eksisterende hooks/adaptere er migrationskode", mens §10 (`:194`) siger de er slettet. `AGENTS.md:123` beskriver ligeledes de slettede API'er som nuværende. | Mindre | bekræftet |

### Codex sol/high's designbeslutninger (runde 4, forelagt med alternativer + evidens)

| Spørgsmål | Beslutning |
|---|---|
| **S3 — hvordan kommer rækkecelle-fejl ind i gatingen?** | **B: dependency-resolveren læser det STRUKTURELLE `FieldIssueSnapshot` direkte**, ikke det afledte `eoErrors`-map. Matchning sker på descriptor-id + `issue.field.address.path`'s collection-segment — **aldrig** `includes`/suffix eller nye syntetiske `${rowId}:collection`-nøgler. Ingen ny reason-kode; `aggregate` må ikke bruges til disse collections. Afvist A (syntetiske aggregatnøgler): det ville tilføje en tredje nøglerepræsentation ved siden af adresse og feltnavn og kunne ændre inspektion-echoet. |
| **S2 — forlig vs. S/S** | **(ii) Adskil S/S-grundberegningen fra forligsskaleringen.** At føje forligsfelterne til hele `SVIE_SMERTE_GROUP` (i) ville fjerne også FØR-forlig-resultaterne og dermed bryde brugerbeslutning 1, der udtrykkeligt kræver at før-forlig-resultater består. Operationsrækkefølgen skal bevares NØJAGTIGT (skalér rå sats → afrund → delvis dagssats → maksimum → fratræk tidligere/aktuel → slutafrund); grundtotalen må ikke beregnes først og ganges bagefter. §5.4-bevis: deep-equality-golden-matrix på hele `SvieSmerteEngineOutput` + totals + canonicalOutput + pdfModel for grønne input. |
| **S1 — overblokeringen** | **(i) med diskriminerede `ready \| blocked`-grennoder** frem for løse nullable felter. `data: null` reserveres til reelle fail-closed-tilstande. `eoSnapshotToBeregningView` eksponerer de enkelte ready-grene og må IKKE gå gennem `inspektionSnapshot`. Kontraktens påstand om at den delvise visning "lever i inspektionSnapshot" er kontraktdrift og skal rettes. |
| **S4 — origin-hullet** | **Origin gøres påkrævet på selve dispatch-porten for STRUKTURELLE commands** (`insertRow`, `deleteRow`, `reorderRows`, `settleFieldInNewRow`), inkl. transaktioner der indeholder et strukturelt step. Callsite- + AST-rettelser alene er utilstrækkelige. AST-reglen beholdes som sekundær diagnostik, ikke som korrekthedsværn. |
| **S6 — kontraktdrift** | **Ren faktuel tekstoprydning**; intet normativt valg. `form-contract.md:271` har allerede truffet det normative valg. Retter selv. |

### Implementeret i runde 4 (2026-07-25)

| Fund | Ændring | Filer |
|---|---|---|
| **S3 (rodårsagen)** | **Dependency-gatingens autoritet er nu det STRUKTURELLE `FieldIssueSnapshot`.** `computeEoSnapshot` tager `eoFieldIssues` (readerens røde feltissues filtreret til EO-sektionen), og `resolveEoBlockedDependencies` matcher på descriptor-id + `address.path`'s collection-segment — ikke på `eoErrors`-nøgler. Dermed ser gaten de røde RÆKKECELLER, den før var blind for. Ny `buildStructuralFieldIssueInvariants` erstatter `eoErrors`-vejen for EO (stamdata beholder sin, fordi dens map ÉR det fulde sæt) og giver én invariant pr. adresse, så to røde celler i samme collection ikke kollapser. | `snapshot/eoDependencyGroups.ts`, `snapshot/eoSnapshot.ts`, `snapshot/eoSnapshotInvariants.ts`, `erstatningsopgoerelseReaderProjection.ts` |
| **S2** | **Forliget er udskilt som egen gren.** Motoren læser selv forligsgraden og skalerer satser + total; `withForligGate` neutraliserer derfor KUN efter-forlig-felterne (`satserPerDagOre`, `satserMaxOre`, `forligFactor`, `forligLabel`, `totalOre`), mens før-forlig-grundlaget består (brugerbeslutning 1). Motorens operationsrækkefølge er urørt — kun hvilke beregnede felter der surfaces. | `snapshot/eoSnapshot.ts`, `snapshot/eoDependencyGroups.ts` |
| **S1** | **`readyBranches` bringer de gyldige grene til Beregning-fanen.** Fanen læser kun snapshottet og ser ikke `inspektionSnapshot`, så brugerbeslutning 2 var i praksis ikke opfyldt: et rødt S/S-felt fjernede den gyldige TAF-periodisering. `eoSnapshotToBeregningView` falder nu tilbage til grenen. `canonicalOutput` har bevidst INTET fald-tilbage — det ER aggregatet. | `snapshot/eoSnapshot.ts`, `snapshot/eoSnapshotToBeregningView.ts` |
| **S5** | **Det døde `hasAnyBlockingEoIssue` er slettet** og erstattet af den LEVENDE aggregatnode `blockedDependencies.aggregate`, som fail-closer på enhver rød feltfejl — også en ingen gren genkender. | `snapshot/eoDependencyGroups.ts` |
| **S4** | **Origin er nu påkrævet på selve dispatch-porten** for strukturelle commands, både som betinget type-tuple (`OriginArgs`) og som runtime-guard før reducer/storage/store/history. `InputTransactionStep` bærer sin `structural`-klassifikation, og transaktionerne er delt i `inputTransaction` (rene felttrin) og `structuralInputTransaction` — begge kaster ved forkert brug. `buildRowHistoryOrigin` er eksporteret, så de tre direkte callsites bygger origin PÅ SAMME MÅDE. | `inputCore/inputReducer.ts`, `runtime/dispatchInput.ts`, `react/inputRuntimeContext.tsx`, `react/useCollectionRows.ts`, `editor/fieldEditorEngine.ts`, `OffentligeYdelserTab.tsx`, `useLoenindkomstViewModel.ts` |
| **S6** | **Kontraktdriften lukket:** `mineo-field-pattern.md`s intro og `AGENTS.md`s inputgrænse-afsnit sagde stadig, at det slettede migrationslag var "migrationskode". De siger nu, at det ER slettet og ikke må genindføres. `eo-snapshot-contract.md` §3.3 er omskrevet til den faktiske autoritet + `readyBranches`. | `mineo-field-pattern.md`, `AGENTS.md`, `eo-snapshot-contract.md` |
| **S6-følge** | **Fem DØDE `invalidDraft`-moduler slettet** (nul produktionsimportører): `CellInvalidDraftScopeContext.tsx`, `invalidDraftsSchema.ts`, `types/invalidDrafts.ts`, `invalidDraftsVersion.ts`, `entityInvalidDraftScopes.ts` + den test, der alene vedligeholdt én af dem. | 6 filer slettet |

**Codex sol/high's korrektion af MIN implementering (S4).** Mit første forsøg krævede en `CollectionHistoryOrigin`
for alle strukturelle commands. Det var **for bredt** og brød 19 grønne tests: en række-PROMOVERING (første
settle i en placeholder-celle) er teknisk en `insertRow`, men kontraktligt et FELT-settle (§3.8), og et
feltorigin er dér den BEDSTE destination — undo skal fokusere den celle, brugeren skrev i, ikke blot navigere
til tabellen. Codex' beslutning (alternativ C): kravet er *"origin skal være PRÆSENT"*, ikke *"origin skal
være af arten collection"*. `EditorDispatch.origin` er samtidig strammet til `FieldHistoryOrigin`, så
felteditorens vej er type-synligt feltbaseret. De 19 tests blev grønne uden opdigtede collection-origins.

**Egne fund undervejs.** Completeness-testen fangede `eo.forligIndgaaet` — et felt-id jeg havde skrevet efter
WI-prosaen, men som IKKE findes i produktionen. Præcis den fejlklasse testen er bygget til.

### Re-review (Codex sol/high, `--uncommitted`) — 3 fund, alle bekræftet og rettet

| # | Fund og evidens | Alvor | Rettelse |
|---|---|---|---|
| T1 | **TAF-grenen manglede alle sine CLAMPING-grænser.** `buildTafRanges` læser `vedroererPeriodeFra/Til`, `differencekravDato` og de fire EET-datoer + tre toggles (verificeret: 11 `values.*`-læsninger i `tafPeriodConstraints.ts`), men INGEN af dem stod i `TAF_GROUP`. En rød EO-slutdato blev maskeret til `undefined`, hvorved klipningen forsvandt og en UKLAMPET periodisering blev vist som gyldig gennem `readyBranches`. | **P1** | Alle 12 scalar-grænser tilføjet (inkl. `tafBeregningsperiodeFra/Til`) |
| T2 | **S/S-grenen manglede sine cutoff-felter.** `computeSvieSmerteEngine` klipper perioderne mod EO-perioden og læser `kravPaaSvieSmerteGodtgoerelse`/`tidligereSsMax` (verificeret: 9 `values.*`-læsninger). En rød `vedroererPeriodeTil` fjernede klipningen og gav et falsk dagantal. | **P1** | Fire felter tilføjet; EO-perioden er nu en eksplicit DELT afhængighed (`EO_PERIODE_FIELD_IDS`) i begge grupper — ikke overblokering, men en reelt fælles læsning |
| T3 | **Runtime-origin-guarden accepterede et DELVIST origin.** `{ kind: 'collection' }` passerede, fordi `undefined !== ''` er sandt — netop i det scenarie guarden findes for (omgåede typer). | **P2** | Guarden tjekker nu TYPEN (`isNonEmptyString`) og hver arts påkrævede felter: feltanker kræver `field.section`; rækkeanker kræver `collection` + `route` + eksplicit `tabKey` (`null` tælles, `undefined` ikke). 8 nye afvisningscases |

**Mutationstestet.** Jeg fjernede EO-perioden fra `TAF_GROUP` igen og bekræftede, at **3 tests fejler** —
listen er dermed load-bearing, ikke dekorativ. Tilsvarende fjernede jeg `readyBranches`-fald-tilbaget fra
Beregning-visningen og bekræftede, at brugerbeslutning-2-testen fejler.

### Andet re-review (Codex sol/high) — 3 fund, alle bekræftet og rettet

Samme fejlklasser som T1–T3, men mit første forsøg havde kun dækket dem **delvist**. Det bekræfter, at
"udled listen af hvad motoren FAKTISK læser" ikke kan gøres ved øjemål.

| # | Fund og evidens | Alvor | Rettelse |
|---|---|---|---|
| U1 | **S/S manglede mén-klipningen.** `resolveSvieSmerteFejlgivendeBounds` læser `menAfgoerelseDato`, `varigeMenAfgorelse` og `verserendeKlageMen` (verificeret: 5 `values.*`-læsninger; jeg havde kun taget de to periodefelter). En rød mén-dato fjernede klipningen, så dagantallet inkluderede dage EFTER afgørelsen. | **P1** | De tre felter tilføjet `SVIE_SMERTE_GROUP`; test hævder også at de IKKE blokerer TAF |
| U2 | **`stamdata.skadedato` er en KLIPNINGSGRÆNSE for begge grene — men gaten så kun EO-sektionen.** `tafPeriodConstraints.ts:57`: den midlertidige EET-grænse gælder kun skader FØR 2011-06-16, så en maskeret skadedato fjerner grænsen lydløst. `stamdataErrors` gjorde snapshottet globalt blokeret, men `blockedDependencies.taf` blev fortsat `false`, hvorefter `readyBranches` viste den uklampede periodisering. | **P1** | `resolveEoBlockedDependencies` tager nu et andet, valgfrit `stamdataIssues`-argument; `computeEoSnapshot` og reader-projektionen fører stamdata-issues igennem. Afhængigheden er BEVIDST smal: kun `skadedato` blokerer en gren — en test hævder, at fx `journalnr` kun fail-closer aggregatet |
| U3 | **Origin-guarden var stadig omgåelig.** En ukendt `kind: 'bogus'` med collection-lignende felter faldt ned i else-grenen og passerede, og et feltanker med halv adresse (`{ section: 'x' }`) passerede for at fejle senere ved serialisering i restoren. | **P2** | Begge diskriminatorer tjekkes nu EKSPLICIT, og `isUsableFieldAddress` kræver `section` + `path`-array + `field`. 11 afvisningscases i alt |

### Afsluttende verifikationsrunder (Codex sol/high, afgrænset punkt-for-punkt)

Fordi to re-reviews havde fundet, at mine rettelser var *ufuldstændige* i samme fejlklasse, kørte jeg til
sidst afgrænsede verifikationskald i stedet for endnu et bredt review — ét spørgsmål pr. runde, med krav om
et konkret modeksempel. Det konvergerede fundene:

**Dependency-listerne: LUKKET** efter udtømmende gennemgang af hver bounds-resolver. Codex bekræftede, at
`TAF_GROUP` og `SVIE_SMERTE_GROUP` nu dækker samtlige felter, motorerne faktisk læser, og at `skadedato` er
det ENESTE stamdatafelt, der er en reel beregnings-/klipningsafhængighed (`skadestype` sendes til
S/S-inputtet, men motoren læser kun `input.erstatningsopgoerelse`).

**Origin-værnet: fire iterationer, hver med et nyt konkret modeksempel.** Det er det mest lærerige forløb i
hele WI'en — hver runde afdækkede et hul, mit forrige forsøg havde efterladt:

| # | Modeksempel der passerede | Rettelse |
|---|---|---|
| 1 | `field: { section: 'x', path: [{}], field: 'x' }` — værnet tjekkede kun, at `path` var et ARRAY | Validerer nu mod det KANONISKE `fieldAddressSchema` (samme skema `serializeFieldAddress` bruger), ikke en håndrullet tjek-liste, der kan drifte |
| 2 | `{ kind: 'collection', editorLocationId: ' ', collection: ' ', route: ' ', tabKey: null }` — `' ' !== ''` er sandt | `isUsableAnchorString`: ikke-tom OG trimmet, samme standard som `addressPartSchema` |
| 3 | Feltanker med `route: ' '` — feltgrenen validerede slet ikke sin (valgfrie) destination | Destinationen valideres for BEGGE arter; en UDELADT destination er fortsat lovlig (standalone er dokumenteret ikke-navigerbar) |
| 4 | `{ kind: 'field', tabKey: 'calculation' }` UDEN `route` — lydløst inert, fordi restoren kun aktiverer fanen inde i `route !== undefined`-grenen (`MainLayout`) | **Løst i KERNETYPEN:** `OriginDestination` er nu en ALT-eller-INTET-union, så inkohærensen er urepræsenterbar. Compileren fandt selv `originFor`, som spredte `route`/`tabKey` uafhængigt. Runtime-værnet spejler unionen; fire nye `@ts-expect-error`-cases låser den |

**Femte modeksempel AFVIST med evidens** — og afvisningen bekræftet af Codex (*"AFVISNING KORREKT"*):
Codex foreslog et krydstjek mellem `route` og feltets `section` (fx `section: 'renteberegning'` +
`route: '/stamdata'`). Det ville være **forkert**, fordi section→route BEVIDST ikke er en funktion:
`getRouteForPageKey` returnerer eksplicit `null` for `faellesAarsloen` (*"delt sektion … kalderen vælger
kontekst-route"*), og den SAMME feltadresse `faellesAarsloen.aslAarsloen` bærer legitimt både
`/forsoergertab` (`Forsoergertab.tsx:64-65`) og `/erhvervsevnetab` (`EetOplysningerTab.tsx:44-45`). Et
krydstjek ville afvise præcis de kontekst-delte origins — altså brække Codex' eget tidligere fund R3's
løsning (`CONTEXT_SHARED_EO_FIELDS`). Skrivegrænsens ansvar er, at ankeret er STRUKTURELT brugbart, ikke at
gætte hvilken side et delt felt "hører til" — det er netop routens opgave at afgøre.

### Verifikation (2026-07-25, runde 4)

Alle fire gates grønne + fuld suite grøn:
- `npm run typecheck` / `typecheck:test` — rene
- `npm run lint` — ren (`--max-warnings 0`)
- `npm run verify:ledgers` — 239 felter / 16 collections / 18 dokumentoutputs
- `npx vitest run` — **484 filer / 6109 tests** (fra 485/6008 ved rundens start; netto +101 tests, seks filer slettet)

**Note om en falsk rød kørsel.** En suite-kørsel med tre samtidige Codex-processer gav 2 fejl + flere
`[vitest-pool]: Failed to start threads worker` og en varighed på **8276 s** mod normalt ~60 s. De to fejl var
timingfølsomme (`OpenEo` "efter 1 sekund", PDF-wiring); begge bestod på 2 s isoleret, og hele suiten var grøn
igen efter processerne blev afsluttet. Det var ressourceudsultning, ikke en regression — men den lignede en
rød suite. Kør ikke den fulde suite samtidig med tunge Codex-kald.

## Resterende / risici

- **F8-navnekonsistens:** `CheckboxField`-delen er RETTET (runde 3, C3). Tilbage står, at `gridCells.tsx`
  samler seks celle-komponenter i én fil, mens søskendefamilien er én komponent pr. fil opkaldt efter sin
  eksport. Det er en filopdeling, ikke en navnefejl — og dermed et strukturvalg, ikke ren kosmetik. Ikke
  påtrængende; noteres.
- **C4 — "Greenfield" i 129 kommentarer i 108 produktionsfiler.** F8 fjernede præfikset fra alle
  IDENTIFIKATORER (verificeret: nul kode-træf), men prosaen står. Nogle er direkte forkerte, fordi de
  refererer til komponentnavne, der ikke længere findes (`Greenfield-wrapperen`, `Greenfield-wrappere`).
  Resten er korrekt historisk reference til denne migration. Ikke rettet i runde 3: en samlet
  gennemskrivning af 108 filer hører hjemme i sin egen oprydning, ikke midt i en trust-kritisk gate-ændring.
- **EO's atomiske `data` — STATUS ÆNDRET.** Punktet er ikke længere udskudt: Codex sol/high omgjorde
  anbefalingen i runde 3 (*"Løs nu. Det er et uopfyldt Fase-3-exitkriterium og en allerede godkendt
  brugerbeslutning; størrelsen berettiger ikke udskillelse"*), og afhængighedsopdelingen er implementeret.
  **Det bevidst tilbageværende:** det krydsgående aggregat (`totals.samletTotalOre`, `canonicalOutput`,
  `pdfModel`) blokeres fortsat samlet, når bare ét led er blokeret. Det er ikke en rest — det er den VALGTE
  model A, som Codex eksplicit bekræftede opfylder brugerbeslutning 2: en sum eller et dokument kan ikke være
  autoritativt uden alle led, og den delvise visning lever i `inspektionSnapshot`.
- **Renteberegning kalder `computeRentekravRow` både pr. række og i aggregatet.** Det er PRE-EKSISTERENDE
  adfærd (uændret af dette WI) og ikke et kontraktbrud: efter rettelsen ligger BEGGE kald uden for
  `runProjection`-kroppen, inde i `mapReadyProjection`, og er derfor gatede. Aggregatet har sin egen
  tomheds-/pdfContext-logik, så en sammenlægning ville kræve en byte-identitetsbevisning (§5.4). Mulig
  oprydning senere, ikke et udestående fund.
