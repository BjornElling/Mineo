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

## Runde 4 — det afsluttende slutreview (2026-07-25)

Runde 2 blev afbrudt uden konklusion (se nedenfor), og runde 3's diff blev committet uden eksternt review.
Runde 4 lukkede begge huller: Codex sol/high reviewede commit `8d3946ed` og fandt **seks fund, tre kritiske**.
R1 og R4 var IKKE lukket, og C2 kun delvist. Derefter fulgte tre re-reviewrunder, som hver fandt nye fund i de
samme fejlklasser — mine rettelser var korrekte i retning, men gentagne gange **ufuldstændige**.

### Rodårsagen bag de tre kritiske fund var ÉN struktur

Gaten var bygget på `eoErrors` — et afledt map med kun 11 top-level feltnavne plus `${afId}:loenindkomst`.
Røde RÆKKECELLER (svie/smerte-perioder, TAF-perioder, ferie-/fraværsdatoer, lønudviklingsceller) maskeres af
readerens `readOrEmpty` til tomværdi og når **aldrig** `eoErrors`. Gruppernes rækkefragmenter kunne derfor
aldrig matche noget: de var død kode, og motorerne blev kaldt på maskerede rækkedata.

**Beslutning (Codex sol/high):** autoriteten flyttes til det STRUKTURELLE `FieldIssueSnapshot`, og matchningen
sker på descriptor-id + adressens collection-segment — ikke på nye syntetiske nøgler, som ville have tilføjet en
tredje nøglerepræsentation ved siden af adresse og feltnavn.

| # | Fund | Alvor | Rettelse |
|---|---|---|---|
| S1 | **EO fortsat globalt atomisk.** Beregning-fanen læser KUN `snapshot.data`, som er `null` på fejlstien — den ser aldrig `inspektionSnapshot`. Brugerbeslutning 2 var derfor ikke opfyldt: et rødt S/S-felt fjernede stadig den gyldige TAF-visning. Testen tjekkede kun en boolean og bestod med den globale gate. | Kritisk | `readyBranches` bærer de gyldige grene; `eoSnapshotToBeregningView` falder tilbage til dem. `canonicalOutput` har bevidst intet fald-tilbage. |
| S2 | **Forlig fejlklassificeret som uafhængig af S/S.** Motoren kalder selv `parseForligsgrad` og skalerer satser + total med faktoren, så en maskeret ugyldig forligsprocent blev regnet som 100 %. | Kritisk | Egen gren; `withForligGate` neutraliserer kun EFTER-forlig-felterne, så før-forlig-grundlaget består (brugerbeslutning 1). |
| S3 | **Gaten kunne ikke se de røde input, motorerne læser** (rodårsagen ovenfor). `stamdataErrors` havde samme hul. | Kritisk | Strukturel autoritet + `buildStructuralFieldIssueInvariants` (én invariant pr. adresse). |
| S4 | **Origin kunne udelades HELT på dispatch-porten**, så history gemte `undefined` og en undo kunne gendanne en række uden noget sted at navigere til. Tre konkrete callsites. | Væsentlig | Betinget type-tuple + runtime-værn før al mutation; `structuralInputTransaction` skiller de to transaktionsarter. |
| S5 | **`hasAnyBlockingEoIssue` var død kode**; den faktiske backstop var den globale reader-invariant — altså S1's overblokering. | Væsentlig | Slettet; erstattet af den levende aggregatnode `blockedDependencies.aggregate`. |
| S6 | **Kontraktdrift:** `mineo-field-pattern.md` og `AGENTS.md` beskrev stadig det slettede migrationslag som nuværende migrationskode. | Mindre | Teksten retter sig efter koden. Fem DØDE `invalidDraft`-moduler slettet; den levende omdøbning udskilt til WI-006. |

### Codex omgjorde min egen implementering af S4

Mit første forsøg krævede en `CollectionHistoryOrigin` for **alle** strukturelle commands. Det var for bredt og
brød 19 grønne tests: en række-PROMOVERING (første settle i en placeholder-celle) er teknisk en `insertRow`, men
kontraktligt et **felt-settle** (§3.8) — og et feltorigin er dér den *bedste* destination, fordi undo skal
fokusere den celle, brugeren skrev i, ikke blot navigere til tabellen.

**Beslutning:** kravet er *"origin skal være PRÆSENT"*, ikke *"origin skal være af arten collection"*. Skaden i
S4 var det fraværende anker, ikke ankerets art. De 19 tests blev grønne uden opdigtede collection-origins.

### Tre re-reviewrunder — samme fejlklasser, ufuldstændigt dækket

| Runde | Fund | Hvad jeg havde overset |
|---|---|---|
| Re-review 1 | **T1/T2 (P1):** TAF- og S/S-grenen manglede ALLE deres klipningsgrænser. `buildTafRanges` læser 11 felter; ingen stod i gruppen. En rød EO-slutdato fjernede klipningen og viste en UKLAMPET periodisering som gyldig. **T3 (P2):** origin-guarden accepterede `{ kind: 'collection' }`, fordi `undefined !== ''` er sandt. | Jeg havde kun taget beløbs-/dagfelterne, ikke grænserne |
| Re-review 2 | **U1 (P1):** S/S manglede mén-klipningen (`menAfgoerelseDato` + to toggles). **U2 (P1):** `stamdata.skadedato` er en klipningsgrænse for BEGGE grene, men gaten så kun EO-sektionen — den midlertidige EET-grænse gælder kun skader før 2011-06-16, så en maskeret skadedato fjerner den lydløst. **U3 (P2):** en ukendt `kind` faldt ned i else-grenen og passerede. | Jeg havde rettet T1/T2 ved øjemål i stedet for at læse hver bounds-resolver til bunds |

**Lærdommen, som nu står i koden:** en dependency-liste skal udledes af hvad motoren FAKTISK læser — inklusive
scalar-grænser og felter i andre sektioner. En maskeret grænse er lige så farlig som et maskeret beløb, fordi
resultatet ser gyldigt ud. Grupperne bærer derfor eksplicitte referencer til den bounds-resolver, de er udledt af.

### Afsluttende afgrænsede verifikationsrunder

Fordi to brede re-reviews havde fundet samme fejlklasse *ufuldstændigt* dækket, skiftede jeg til afgrænsede
verifikationskald: ét spørgsmål ad gangen, med krav om et konkret modeksempel. Det konvergerede.

Dependency-listerne blev bekræftet **LUKKET** efter udtømmende gennemgang af hver bounds-resolver, og
`skadedato` blev bekræftet som det ENESTE stamdatafelt, der er en reel klipningsafhængighed.

Origin-værnet krævede **fire** iterationer — hver med et nyt konkret modeksempel, som mit forrige forsøg
havde efterladt:

1. `path: [{}]` passerede, fordi værnet kun tjekkede at `path` var et *array*. → Validerer nu mod det
   **kanoniske** `fieldAddressSchema`. En håndrullet tjek-liste kan drifte fra den form, restoren serialiserer.
2. `' '` passerede, fordi `' ' !== ''` er sandt. → `isUsableAnchorString` kræver ikke-tom **og trimmet**,
   samme standard som `addressPartSchema`.
3. Feltgrenen validerede slet ikke sin (valgfrie) destination. → Valideres nu for begge arter, mens en
   UDELADT destination fortsat er lovlig (standalone er dokumenteret ikke-navigerbar).
4. `tabKey` uden `route` var lydløst inert, fordi restoren kun aktiverer fanen inde i
   `route !== undefined`-grenen. → **Løst i kernetypen**: `OriginDestination` er en alt-eller-intet-union, så
   inkohærensen er urepræsenterbar. Compileren fandt selv `originFor`, som spredte felterne uafhængigt.

**Det femte modeksempel blev AFVIST med evidens — og afvisningen bekræftet af Codex.** Forslaget var et
krydstjek mellem `route` og feltets `section`. Det ville være forkert: section→route er BEVIDST ikke en
funktion. `getRouteForPageKey` returnerer eksplicit `null` for `faellesAarsloen` (*"delt sektion … kalderen
vælger kontekst-route"*), og den samme feltadresse `faellesAarsloen.aslAarsloen` bærer legitimt både
`/forsoergertab` og `/erhvervsevnetab`. Krydstjekket ville afvise præcis de kontekst-delte origins — altså
brække løsningen på Codex' eget tidligere fund R3.

**Det generelle princip:** skrivegrænsens ansvar er, at ankeret er STRUKTURELT brugbart (fuldstændigt,
trimmet, internt kohærent) — ikke at gætte hvilken side et delt felt "hører til". Det er routens opgave.

### Mutationstestet, ikke kun grønt

- Fjernede EO-perioden fra `TAF_GROUP` → **3 tests fejler**.
- Fjernede `readyBranches`-fald-tilbaget fra Beregning-visningen → brugerbeslutning-2-testen fejler.
- Completeness-testen fangede `eo.forligIndgaaet` — et felt-id jeg havde skrevet efter WI-prosaen, men som
  ikke findes i produktionen. Præcis den fejlklasse testen er bygget til.

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
