# R1 — Kontrakter, dokumentation og sluttilstandssprog

**Status:** Delvist gennemgået  
**Dato:** 2026-07-28  
**Dækket:** hele designet; `contract-topology.json`; alle kontraktfiler; informative arkitekturdocs;
`docs/domain/`, `docs/implementation/`, README; AST-scan af identifiers og testdeklarationer  
**Angreb udført:** normativ sætning mod kode; statuspåstand mod kildetilstand; migrationssprog i prosa,
identifiers og aktive testnavne; topologi mod erklæret hierarki  
**Evidens:** topologi-diff 0 uregistrerede/0 manglende/0 dubletter; 2 målrettede filer/8 tests grønne;
AST fandt 29 utvetydigt migrationsbundne testnavne og to levende greenfield-identifiers; tekstsweep fandt
320 `greenfield`-matchlinjer i 198 `src`-filer  
**Fund:** 7 (R1-F01–R1-F07)  
**Hypoteser:** 2 (R1-H01, R1-H02)  
**Handling:** Parkeret; ingen filer ændret  
**Næste skridt:** systematisk omskrivning efter klassifikationen slet/omskriv/bevar, efterfulgt af nyt sweep

### R1-F01 — Designdokumentets status er indbyrdes modstridende

**Lokation:** `docs/architecture/draft-commit-greenfield-design.md:5-7,92-98,1448-1449,1529-1538,1770-1772`  
**Problem:** Toppen siger, at implementeringen skal rebaseres og senere, at kun fase 5 udestår. Fase 5 siger
16/21 definitioner og ingen skiftede callsites, mens samme område markerer callsite-cutover gennemført og
fase 7 afsluttet 2026-07-28.  
**Evidens:** De samtidige statusudsagn i samme dokument kan ikke alle beskrive nutiden.  
**Angrebet der fandt det:** Statusmarkeringer er påstande.  
**Konsekvens:** Dokumentet kan ikke afgøre norm, historik og faktisk sluttilstand entydigt.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Målarkitektur, migrationsjournal og statusflade er blandet sammen.  
**Overvejelse:** Historikken kan bevares uden at stå som nutidsnorm.  
**Anbefaling:** Gør den normative slutarkitektur entydig og flyt historisk gennemførelsesjournal ud.  
**Forslag til løsning:** Konsolidér status til én aktuel sektion og markér eller flyt historiske faseafsnit.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)** — se etapenoten i `fund-oversigt.md`

### R1-F02 — Arkitekturdocs beskriver afløste grænser som aktuelle

**Lokation:** `docs/architecture/eo-row-evaluation-architecture.md:8-12,128-138,432`;
`document-output-architecture.md:78`; `undo-redo-architecture.md:86`  
**Problem:** EO-doc’en beskriver en fremadrettet migration og `EoInputIssue[]`, hvor koden bruger
`FieldIssueSet` og `EoRowPolicy`. Dokumentoutput-doc’en beskriver færre friskhedschecks end kontrakt/kode.
Undo-doc’en lægger fokusmetadata på `FieldRef`, mens current history-origin bærer editorlokation, route og fane.  
**Evidens:** `eoRowExecutionContext.ts:25`, `document-output-contract.md:107-108`,
`documentLifecycle.ts:27-28` og `inputHistory.ts:23-59`.  
**Angrebet der fandt det:** Den forældede beskrivelse.  
**Konsekvens:** Trust-kritisk arbejde kan implementeres efter afløste mekanismer.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Flere informative docs er ikke konvergeret efter cutover.  
**Overvejelse:** Informative docs er stadig aktive beslutningskilder for næste udvikler.  
**Anbefaling:** Omskriv dem mod current typer, ejerskab og async-grænser.  
**Forslag til løsning:** Concern-for-concern diff mod kontrakt og kode, ikke lokale tekstpatches.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)** — se etapenoten i `fund-oversigt.md`

### R1-F03 — Normative kontrakter bruger fortsat migrationssprog

**Lokation:** `form-contract.md:9-10,271-278`; `app-shell-contract.md:27-29`;
`critical-action-contract.md:96,107`; `app-settings.md:32,37`; `document-output-contract.md:543`  
**Problem:** Bindende tekst omtaler greenfield-runtime, en ikke-deploybar cutover, WI-/fasehistorik og
overgangs-API’er som del af den aktuelle norm.  
**Evidens:** De nævnte kontraktsteder sammenholdt med slettet migrationslag og afsluttet cutover.  
**Angrebet der fandt det:** Den forældede beskrivelse.  
**Konsekvens:** Normativ tekst bliver tidsafhængig og kan legitimere parallelle overgangsløsninger.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Systematisk kontraktsweep mangler.  
**Overvejelse:** Historisk begrundelse kan bevares særskilt, men må ikke forklædes som gældende mekanisme.  
**Anbefaling:** Omskriv kontrakterne til sluttilstandssprog.  
**Forslag til løsning:** Klassificér alle forekomster og tilføj eventuelt et præcist regressionsværn.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)** — se etapenoten i `fund-oversigt.md`

### R1-F04 — Topologien mangler to underordnelsesrelationer

**Lokation:** `AGENTS.md:153`; `src/contracts/contract-topology.json:26-51`  
**Problem:** Det erklærede hierarki gør page-component-kontrakten underordnet alle 19 tværgående kontrakter,
men topologien udelader `snapshot-contract.md` og `auth-gate-contract.md`.  
**Evidens:** Maskinel slash-normaliseret topologi-diff viser korrekt filregistrering, men manuel
relationsdiff viser de to manglende entries. Coverage-testen måler ikke denne semantiske completeness.  
**Angrebet der fandt det:** Normativ sætning mod maskinlæsbar autoritet.  
**Konsekvens:** To autoritative beskrivelser giver forskellig kontraktprioritet.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Topologi-schema/test mangler en relationel completeness-invariant.  
**Overvejelse:** Fil-completeness er ikke det samme som hierarki-completeness.  
**Anbefaling:** Tilføj relationerne og en test mod den komplette tværgående liste.  
**Forslag til løsning:** Afled underordnelseslisten fra `crossCuttingContracts` eller hævd lighed.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)** — se etapenoten i `fund-oversigt.md`

### R1-F05 — Kode og testnavne beskriver stadig en migration

**Lokation:** Repræsentativt `AnsaettelsesforholdCard.tsx:99`,
`forsoergertabReaderProjection.ts:40`, `erstatningsopgoerelseSurfaceGuard.test.ts:22,62-69,93-96`,
`productionCatalogCompleteness.test.ts:39` og `acceptanceMatrix.test.ts:353,475`  
**Problem:** Kommentarer hævder bl.a., at EO/EET endnu ikke er migreret; aktive testnavne og identifiers
navngiver greenfield-forløbet frem for den beskyttede invariant.  
**Evidens:** 320 matchlinjer i 198 `src`-filer; AST-klassifikation fandt 29 utvetydigt migrationsbundne
testnavne samt `GREENFIELD_INPUT_PATHS` og `onGreenfieldPath`.  
**Angrebet der fandt det:** Den forældede beskrivelse.  
**Konsekvens:** Sluttilstanden beskrives som overgang, og værnenes hensigt bliver uklar.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Systemisk kode-/testsweep kræves.  
**Overvejelse:** Legitime `.eo`-migrationer og absence-værn skal bevares.  
**Anbefaling:** Omskriv efter funktion og invariant, ikke efter migrationsfase.  
**Forslag til løsning:** Maskinel kortlægning efterfulgt af én klassificeret sweep.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)** — se etapenoten i `fund-oversigt.md`

### R1-F06 — Levende ledgers beskrives som midlertidige

**Lokation:** `src/config/consumerInventory.ts:1-7`; `src/inputCore/ledger/ledgerTypes.ts:3-7`;
`package.json:62,73`; `scripts/architecture/verify-input-ledgers.mjs:42-43`  
**Problem:** Ledgers beskrives som migrationsinventarer, der slettes efter faserne, men de er samtidig en
levende release-gate og completeness-backstop.  
**Evidens:** `verify:ledgers` kørte 2 filer/16 tests og verificerede 239/16/8/4/18 registrerede enheder.  
**Angrebet der fandt det:** Den forældede beskrivelse og grønne af tomhed.  
**Konsekvens:** Et load-bearing værn kan senere slettes som “midlertidigt”.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Ansvar og livstid er ikke omklassificeret efter migrationen.  
**Overvejelse:** Det levende formål er schema-/consumer-drift, ikke migrationsstatus.  
**Anbefaling:** Omdøb og dokumentér registrene efter deres current coverage-funktion.  
**Forslag til løsning:** Fjern fase-/migrationssprog og bevar den maskinelle gate.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)** — se etapenoten i `fund-oversigt.md`

### R1-F07 — Error-kontrakten prioriterer en slettet source-dimension

**Lokation:** `src/contracts/error-contract.md:114,220`; `src/inputCore/inputIssue.ts:15,61-72`  
**Problem:** §4 siger prioritet efter “reason/source”, mens §11 forbyder source-registre, og koden
prioriterer reason, code og message uden source.  
**Evidens:** Kontraktens to udsagn og `compareFieldIssues`.  
**Angrebet der fandt det:** Intern kontraktmodsigelse.  
**Konsekvens:** Prioritetsreglen kan misforstås eller genindføre en slettet dimension.  
**Alvor:** Mindre  
**Strukturel vurdering:** Lokal kontraktdrift med klar current implementering.  
**Overvejelse:** §11 og koden peger samme vej.  
**Anbefaling:** Fjern `/source` fra §4 og beskriv den faktiske deterministiske prioritet.  
**Forslag til løsning:** Ren kontraktrettelse.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)** — se etapenoten i `fund-oversigt.md`

## Hypoteser

- **R1-H01:** Flere concerns kan have parallelle forklaringer med yderligere semantisk drift.
  Af-/bekræftes ved concern-for-concern diff mellem kontrakt, design, arkitekturdoc og kode.
- **R1-H02:** Flere `docs/domain/`-stier kan være stale. Ét eksempel er
  `docs/domain/taf/tabt-arbejdsfortjeneste.md:118`, som mangler `/engines/`; hele området er ikke inventeret.

## Bevarede migrationsord

Bevidst bevaret: designets og reviewplanens filnavne, topology-reference og branchnavn; absence-værn;
`.eo`-schema-/loadmigration og `LEGACY_PERSISTED_DATA_VERSION`; det juridiske domæneord “Midlertidig EET”;
runtime-typen `DocumentLifecyclePhase`; auth-kontraktens fremtidige re-evaluerings-trigger.

## Fasekonklusion

Exitkriterierne er ikke opfyldt. Kontrakter, docs og kode peger ikke samme vej, og sluttilstandssproget er
ikke gennemført. Fundene er dokumentations-/arkitekturarbejde og kræver ingen brugerbeslutning.

## Fasekonklusion efter rettelsen (2026-07-29, etape 11)

Alle syv fund er lukket. Exitkriterierne er nu opfyldt for det inventerede område: kontrakter, de tre navngivne
arkitekturdocs, designdokumentet, ledger-registrene og de aktive test-/kodenavne peger samme vej og beskriver
sluttilstanden.

**Det centrale strukturelle udfald: teksten var tidsafhængig af KONSTRUKTION, ikke ved forsømmelse.** Ingen af de
syv fund skyldtes en glemt sætning. I hvert tilfælde havde et dokument fået en struktur, der blandede norm,
historik og status i samme tekst — og en sådan struktur kan ikke holdes sand, uanset hvor omhyggeligt den
vedligeholdes. Designdokumentets hoved var en kronologisk journal, hvor hver ny statuslinje modsagde de
foregående; `Status:`-feltet lovede "målarkitektur" om noget, der var nået; ledgerne beskrev deres egen livstid ud
fra en fase, der var forbi. Rettelserne adskiller derfor lagene:

- **Journalen er udskilt** (`draft-commit-greenfield-journal.md`). Designdokumentet har ét statusafsnit og en
  læsevejledning, der pr. afsnit siger om det er norm, form eller historik. De fire historiske afsnit bærer hver
  sin markør — inklusive advarslen om, at deres tal og modulstier er fra deres eget tidspunkt og ikke er ført frem.
  Det er en vigtig del af rettelsen: en historisk faseteksts modulsti er en fælde, ikke en oplysning.
- **§10 er urørt ord for ord**, fordi acceptregistret læser den maskinelt. Læsevejledningen navngiver bindingen.
- **`Status:` er "Normativ og gældende"** i alle 17 kontrakter.
- **Ledgerne er omklassificeret** til den permanente release-gate, de faktisk er — og noten siger eksplicit, hvad
  en sletning ville koste: ikke en note, men completeness-KRAVET (R1-F06).
- **To fund fik en maskinel binding frem for kun en tekstrettelse**, fordi en ren tekstrettelse kan drifte igen:
  R1-F04's hierarki-completeness (LIGHED mellem underordnelseslisten og det tværgående sæt) og R1-F07's
  kontrakt↔kode-binding (prioritetsrækkefølgen læses ud af kontrakten og asserteres mod `compareFieldIssues`).
  Begge er mutationsbevist; R1-F04's mutation er værd at bemærke, fordi de fire EKSISTERENDE topologitests
  forblev grønne — de målte fil-completeness, og det var netop fundet.

**Restarbejde, som ikke er lukket og ikke er talt som lukket:** R1-H01 og R1-H02 forbliver hypoteser.
`docs/domain/`-området er ikke inventeret, og en concern-for-concern-diff af hver kontrakt mod hver arkitekturdoc
er ikke gennemført — etapen dækkede kontrakterne, de tre docs fundene navngav, og designdokumentet.
