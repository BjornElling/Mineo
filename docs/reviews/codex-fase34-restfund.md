# Review-forløb: lukning af Fase 3+4-restfundene (WI-004)

Fortsættelse af `codex-fase34-review.md` og `codex-fase34-followup.md`. Arbejdsgangen er den samme: Codex
(sol, high, read-only) reviewer, Claude Code implementerer, Codex re-reviewer — indtil ingen handlingskrævende
fund står tilbage.

Denne fil dokumenterer de to runder, der lukkede de fund, `-followup.md` efterlod åbne: **F2** (Forsørgertab,
EET og EO kaldte motorer med maskerede reader-fejl), **F4** (ufuldstændig feltadresse→destination-tabel) samt
dækningshullerne (transient input, grid dropdown/to-trins-genindtræden, Renteberegnings projektionsmatrix,
origin-fuldstændighed).

---

## Kortlægning før implementering (Codex sol/high)

F2 blev bekræftet for alle tre slices, og kortlægningen korrigerede to antagelser i work item'ens første udkast:

1. **Bruddets natur.** Det afgørende er ikke, at motoren *kaldes*, men at reader-fejl maskeres til tomværdier,
   så motoren regner på et **falsk input**. Konkret: en rød `ealAarsloen` falder tilbage til `aslAarsloen`
   (`eetEalCalculation.ts:184-193`) og rapporterer `source: 'asl'`, som om brugeren havde ladet feltet tomt.

2. **§1.10-læsningen.** §1.10 kræver IKKE én gate pr. slice, men flere små dependency-specifikke
   `ready | blocked`-projektioner. Rettelsen må derfor ikke kun fjerne falske tal — den må heller ikke
   **overblokere**. EO's globale validator gjorde netop det: et ugyldigt svie/smerte-satsår nulstillede hele
   snapshottet og fjernede dermed også gyldige, uafhængige TAF-/reguleringstabeller.

Kortlægningen fandt desuden en **kontraktdrift**, som ikke var med i det oprindelige fundsæt:
`eoIssueBlocksDependents` undtog `bounds` fra at blokere afhængige consumers med begrundelsen "værdien er
gembar". Det konflaterede *gembar* med *beregnbar*; `error-contract.md` §1.1's normative matrix siger, at en
`range`/`bounds`-fejl på en canonical værdi ikke blokerer `.eo`-save, men **ja** blokerer den afhængige
beregning og det afhængige dokument.

### Brugergodkendelse (2026-07-25)

F2's rettelse ændrer, hvad brugeren ser i EO. Tre valg blev forelagt og godkendt:

1. **EO ved rødt felt → vis `-`/ikke beregnet.** Et output, hvis afhængighed er rød, beregnes ikke.
   Uafhængige dele bevares. Download forbliver blokeret med synlig fejl.
2. **Overblokeringen rettes samtidig: split pr. afhængighed.** Et ugyldigt svie/smerte-satsår må ikke længere
   fjerne den gyldige TAF-visning.
3. **Bounds følger kontrakten.** Koden bringes i overensstemmelse med matricen; kontraktteksten ændres ikke.

Forsørgertab og EET har **ingen tilsigtet synlig ændring** — deres UI gater allerede på
`!hasBlockingErrors && computation`, så rettelsen fjerner en usynlig falsk beregning bag den gate.

---

## Runde 1 (6 fund, alle bekræftet og rettet)

| # | Fund | Alvor | Rettelse |
|---|---|---|---|
| R1 | **EO's F2-gate både under- og overblokerende.** Enhver reader-fejl blev globalt blokerende, mens svie/smerte-motoren stadig kørte ubetinget i fejl-grenen. `eoEngineGate` var desuden selvopfyldende: baseline havde allerede validatorfejl + `data: null`, og S/S-spy'en blev aldrig asserted. | Kritisk | `hasBlockingSvieSmerteDependency` gater nu S/S-motoren på dens EGNE felter (udledt af de felter `computeSvieSmerteEngine` faktisk læser). Testen er omskrevet med en **beregningsklar** baseline (eksplicit BASELINE-test verificerer `data !== null`), og en test beviser, at en TAF-fejl IKKE stopper S/S. |
| R2 | **EETs efter-EAL underblokerede begge fallbackveje.** Gaten inkluderede hverken `aslAarsloen` eller `aslAfgoerelser`, selv om motoren læser dem ved tom EAL-% respektive tom EAL-årsløn. | Kritisk | Betingede afhængigheder via `isUsableAmount`/`isUsableEetPct`, som spejler motorens egne betingelser. 5 nye tests dækker begge fallbackgrene i begge retninger + `ealEetPct === 0`. |
| R3 | **F4 dækkede ikke faktiske editorflader.** De tre EO-ejede forligsfelter renderes også på EET/Differencekrav, men resolveren nøglede kun på `address.section`. | Væsentlig | `CONTEXT_SHARED_EO_FIELDS` + `resolveContextSharedDestination` holder felterne på EET-fanen, når brugeren står der — samme mønster som `faellesAarsloen`. |
| R4 | **Row-origin ikke strukturelt fuldstændig.** `route`/`tabKey` var stadig valgfrie i kernetypen, og AST-reglen sprang variable origins over. | Væsentlig | Rettet i **kernetypen**: begge felter er nu påkrævede, så compileren afviser et origin uden destination — også når det videreføres som variabel. AST-reglen er dokumenteret som sekundært værn for literal-argumenter. |
| R5 | **`calculateWhenReady` håndhævede intet.** Ingen callsites, men kommentaren kaldte den den eneste tilladte overgang. Renteberegning kaldte fortsat motoren inde i `runProjection`, og Forsørgertabs gate-flag var valgfrie. | Væsentlig | De absolutte påstande er erstattet af en præcis beskrivelse (inkl. hvorfor de tre domæneslices gater anderledes). Ny `mapReadyProjection` bruges faktisk i Renteberegning, så motoren ligger uden for projektionskroppen. Forsørgertabs gate-flag er nu påkrævede. |
| R6 | **To dækningshuller bestod.** Transient-testen udløste aldrig den eksterne ændring under fokus. Grid-suiten beviste reentry, men ikke den faktiske to-trins-klikvej. | Mindre | Transient-testen udløser nu ændringen med fokus intakt. Grid-suiten monterer focus-/pointerDown-/click-capture og har nye tests for både klikvejen og tast-åbning gennem navigationen. |

Codex bekræftede samtidig tre af mine egne vurderinger:

- **Afvisningen af at genbruge søsterresultater i differencekravet er korrekt.** Grafen kalder bevidst
  søstermotorerne med *andet* input (ASL-rækker filtreret til beregningsdatoen + `dagFoerBeregningsdato`), så
  genbrug ville ændre tal (§5.4 hårdt stop).
- **Bounds-ændringen påvirker ikke `.eo`-save.**
- **`TransientDateInput`-rettelsen er korrekt, og samme kaldemønster findes ikke andre steder.** Verificeret
  selvstændigt: descriptor-validatorerne tjekker bounds selv og bruger helperen kun til beskeden.
- **Ingen ændring af beregningstal for input uden røde feltfejl.**

---

## Runde 2 — ikke gennemført

Et andet re-review blev startet (samme model/effort, med en fund-for-fund-instruks om R1–R6 plus spørgsmålet
om, hvad der bør udskilles som selvstændig work item). **Det nåede aldrig at afgive en vurdering:** processen
blev afbrudt, da den foregående session sluttede, og outputtet stopper midt i gennemgangen uden konklusion.

Der findes derfor **ingen uafhængig bekræftelse af, at R1–R6 er lukket**. Verifikationen af runde 1's
rettelser hviler på:

- de fire gates (typecheck, typecheck:test, lint, verify:ledgers) — grønne,
- fuld produktsuite — grøn (484 filer / 5971 tests),
- de nye invarianttests, som er skrevet til at fejle, hvis gaten fjernes (motor-spies med
  `not.toHaveBeenCalled()` + eksplicitte BASELINE-cases, der beviser den ugatede vej producerer et resultat),
- min egen kodelæsning af hvert fund mod den citerede fil/linje.

Et afsluttende uafhængigt review bør køres, før Fase 3+4 erklæres endeligt lukket.

## Ægte fejl fundet af den nye dækning

Dækningsarbejdet var ikke kun formelt — det afdækkede to reelle fejl:

1. **`TransientDateInput` afviste ENHVER gyldig dato.** Komponenten testede bounds-resultatet med
   `!== undefined`, men `resolveDateRangeErrorMessage` melder "ingen fejl" med en **tom streng**. Hver gyldig
   dato blev derfor afvist — med en tom fejlbesked, så feltet blot aldrig committede. Det gjorde
   sygedagpenge-indsættelsen i `OffentligeYdelserTab` ubrugelig.
2. **Destinationsafbildningen slog collection op før property.** `eoAngivetLoenLoenudvikling`s nestede tabeller
   har samme collection-navne som ansættelsesforholdenes, men bor på en anden fane. Completeness-testen fangede
   det (8 felter), og reglen er nu, at det **yderste** path-segment ejer destinationen.
