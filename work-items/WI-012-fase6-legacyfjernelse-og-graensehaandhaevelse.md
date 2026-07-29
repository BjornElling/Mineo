# WI-012: Fase 6 — bekræft legacyfjernelse og håndhæv grænserne

- **Status:** `gennemført` 2026-07-26 — **GENÅBNET og lukket igen 2026-07-26** efter eksternt review.
  Se §11 for genåbningens fund og udfald; §10 beskriver den FØRSTE lukning, hvis konklusioner §11 delvist
  omgør. Læs §11 først.

  **Målinger og fil:linje-henvisninger i dette dokument er fra 2026-07-26** og er ikke ført frem. Flere af de
  citerede filer er siden slettet (fx `cellFocusPaths.ts` med draft/commit-reviewets GM-F10). Tabellernes
  VERDIKTER står ved magt; deres line numbers gør ikke. Slå den aktuelle form op i koden.
- **Oprettet:** 2026-07-26
- **Slice/scope:** greenfield-planens Fase 6
  (`docs/architecture/draft-commit-greenfield-design.md` linje 1583-1628)
- **Kilde:** brugerønske ("detaljeret implementeringsplan for fase 6 … fokus på at det er et
  greenfield-design, der bygger op fra bunden, uden at fastholde gammel legacy kode unødvendigt")
- **Afhængighed:** Fase 1–5 (alle leveret; Fase 5 lukket 2026-07-26 med WI-008).
- **Risikoklasse:** **M** — fasen tilføjer og retter VÆRN, ikke produktionsadfærd. Ingen beregning,
  intet dokumentindhold og ingen UI-flade ændres. Risikoen er ikke regression i produktet, men
  **falsk tryghed**: et værn der ikke kan fejle, er værre end intet værn, fordi det fremstår som
  dækning. Slutreview på `sol/medium` er tilstrækkeligt; klasse H-routing er ikke påkrævet, da
  ingen trust-kritisk outputsti ændres.
- **Baseline:** HEAD `26d9859b` ("Færdiggør fase 5s dokumentlivscyklus"), rent working tree.

---

## 0. Kortlægning (gennemført 2026-07-26, opus/high)

Fasens fire arbejdstrin i planen er skrevet FØR fase 1–5 blev bygget. Kortlægningen viser, at to af
dem er delvist forældede, og at fasens vigtigste arbejde er et hul, planen ikke nævner. Denne WI
implementerer planens INTENTION, ikke dens bogstav — og dokumenterer hver afvigelse.

### 0.1 Det centrale fund: harnessets selvtest kan ikke se døde regler

`architectureRules.test.ts` håndhæver tre ting (linje 15-89):

1. ingen overtrædelser i kilde-grafen,
2. **hver regel flager sine egne syntetiske fixtures** (vacuous-pass-værnet),
3. anti-rot: hver allowlist-post udløser stadig sin regel.

Punkt 2 beviser, at reglens regex/AST-walk VIRKER. Det beviser **ikke**, at reglens mål stadig
findes i produktionen. En regel, hvis mål er slettet, bliver derfor grøn for evigt — dens fixtures
matcher stadig, men grafen indeholder intet, den kan udtale sig om.

**To regler er allerede i den tilstand — verificeret, ikke formodet:**

| Regel | Mål | Faktisk tilstand |
|---|---|---|
| `pdf/download-committed-state` (`architectureRules.ts:561`) | Filer der kalder `download*Dokument` / `download*Pdf` | **INERT.** Fase 5 slettede alle 18 `download*Dokument`. Eneste forekomst i `src/` er ét ord i en kommentar (`aarsloenDocumentDefinitions.ts:30`). Ingen fil kan længere udløse reglens forudsætning. |
| `form/persisted-styled-field-error-reporter` (`architectureRules.ts:497`) | JSX-brug af `Styled*Field` på produktionssider | **INERT.** Trin 13 slettede hele `Styled*Field`-vejen. `grep -rln '<Styled[A-Za-z]*Field' src/components/` rammer kun de tre `Transient*Input`-filer (som ikke er de forbudte navne). Nul JSX-brug i `src/components/pages/`. |

Dertil peger `COMMIT_SENSITIVE_PREFIXES` (`architectureRules.ts:860`) på `src/rowDrafts/` og
`src/criticalActions/` — **mapper der ikke findes** (`ls` fejler på begge). Reglerne
`form/no-queue-microtask-in-commit-sensitive` og `form/no-promise-tick-in-commit-sensitive` scanner
altså to tomme rødder. Deres øvrige rødder er levende, så reglerne er ikke inerte — men
konfigurationen er død og udvider stille grænsen, hvis en fil med samme sti nogensinde opstår.

Dette er **præcis samme fejlklasse som WI-007's inerte AST-værn og WI-008's B6-brand-fejl**:
et værn hvis eneste bevis er, at det består sin egen test. Memoryen har det som et princip
([[project_guard_selftest_principle]] og [[project_typed_write_boundary_over_ast_guard]]).
Fase 6 er det rigtige sted at gøre princippet til en **maskinel, universel** kontrol frem for en
vane, jeg skal huske pr. regel.

### 0.2 Forbudt-symbol-listen kan ikke bruges som skrevet

Planens liste (linje 1608-1621) er skrevet før fase 1–5. Målt mod `src/` i dag:

| Symbol | Prod-forekomster | Klassifikation |
|---|---|---|
| `executeLegacyInputTransaction` | 0 | ✅ væk |
| `useDraftLifecycle` | 0 | ✅ væk |
| `legacyGridTransactionBridge` | 0 (kun i værn + kontrakt-matrix) | ✅ væk |
| `useDraftField` | 0 identifiers; kun kontrakt-prosa + `types/fieldEvents.ts`-kommentar | ✅ væk som symbol |
| `useTableInputCore` | 0 identifiers; kun kommentar i `useGridCellSurface.ts:26` + prosa | ✅ væk som symbol |
| `useRowDrafts` | 0 identifiers; kun prosa/værn | ✅ væk som symbol |
| `invalidDrafts` | 0 identifiers. **Alle 11 prod-hits er kommentarer/JSDoc**, heraf flere load-bearing historik (`storageManifest.ts:22,61`, `cellFocusPaths.ts:14`, `safeSessionStorage.ts:9`) | ✅ væk som symbol |
| `FormPersistenceContext` | 0 identifiers; kommentarer i `inputRuntimeContext.tsx:44` m.fl. + prosa | ✅ væk som symbol |
| `useSliceRowDrafts` | 1 prod-fil: `BeregnetRenteTable.tsx` — **skal verificeres**: identifier eller kommentar? | ⚠️ afklares i pass 1 |
| `usePersistedForm` | **19 filer, ingen definition** (`grep 'export .*usePersistedForm'` = tom). Bruges i AST-reglers fixtures, kontrakt-prosa og page-filer | ⚠️ **navnet er tvetydigt** |
| `fieldErrors` | **31 filer, heraf ~12 levende produktionsmoduler** (`forsoergertabSnapshot.ts`, `eetSnapshot.ts`, `erhvervsevnetabDownloadGate.ts`, alle reader-projektioner …) | ❌ **IKKE legacy** — nuværende feltnavn i snapshot-/projektionskontrakterne |
| `blocksSave` | 5 filer; i `inputCore/inputIssue.ts:6` er det en kommentar der siger *"INGEN `blocksSave`-booleans"* | ❌ **IKKE legacy** — bruges i EO's `eoInputIssues.ts` som levende navn |

**Tre konklusioner, der former planen:**

1. **En naiv `grep`-baseret forbudt-symbol-gate ville fejre falskt** på `fieldErrors` og `blocksSave`
   (levende vokabular) og på al historik-prosa. Gaten SKAL arbejde på **identifiers fra AST**, ikke
   på tekst. Harnesset kan det allerede (`astQueries.ts`); ingen ny dependency kræves.
2. **En AST-gate, der kun ser identifiers, må til gengæld ikke bruges som argument for at rydde
   prosaen.** De 11 `invalidDrafts`-kommentarer er bevidst historik, der forklarer HVORFOR en nøgle
   ikke findes. De skal blive. Det er allerede en kendt fælde
   ([[project_dansk_prosa_guard_markers]]).
3. `fieldErrors` og `blocksSave` **fjernes fra den forbudte liste** og erstattes af de reelt døde
   navne. Dette er en bevidst afvigelse fra planens bogstav og begrundes i §4.1. At forbyde et navn,
   produktionen retmæssigt bruger, ville tvinge en kosmetisk omdøbning igennem uden gevinst — stik
   imod [[feedback_prefer_structural_unification]].

### 0.3 `usePersistedForm` — navnet uden ejer

`usePersistedForm` har **ingen definition** i `src/`, men optræder i 19 filer: som fixture-kode i
`domain/page-section-access-boundary`, i kontrakt-prosa, og — vigtigst — i page-filer og
domænemoduler (`Aarsloen.tsx`, `Stamdata.tsx`, `aarsloenProjection.ts`,
`forsoergertabReaderProjection.ts`, `satserCalculations.ts` …).

Det skal afklares i pass 1, om hits i page-filerne er identifiers (kalder de et hook, der er
re-eksporteret under et andet modul?) eller kommentarer. Udfaldet afgør to ting:

- er `usePersistedForm` et **levende greenfield-navn** (så skal det ud af den forbudte liste), eller
- er det et **legacy-navn, der kun lever i fixtures og prosa** (så skal det på listen, og
  `page-section-access-boundary`s fixtures skal skrives om til det nuværende adgangs-hook).

Dette er den ENESTE reelle uafklarethed i planen, og den er lokal: én `grep -n` pr. fil i pass 1
afgør den. Jeg låser derfor ikke svaret her.

### 0.4 Trin 2's præmis er vendt om

Planen siger: *"Fjern fase-0-migrationsinventaret, når slutkatalogerne selv giver udtømmende
coverage."*

`docs/architecture/greenfield-phase-0-persisted-input-inventory.json` er **ikke længere et
migrationsinventar**. `consumerInventory.test.ts:31-42` genererer det med `toMatchFileSnapshot` fra
`collectSectionSchemaPaths(section)` over `PERSISTED_SECTION_KEYS` — altså maskinelt fra de levende
Zod-schemas ved hver testkørsel. Det er en **schema-drift-detektor**, ikke et frosset inventar:
tilføjer nogen et persisteret felt uden at ville det, ændrer snapshottet sig og testen fejler.

At slette den ville derfor **fjerne levende coverage** i navnet af at rydde legacy op. Trin 2
implementeres i stedet som: *behold filen, men flyt den ud af `docs/architecture/` (hvor den ligner
et migrationsartefakt) og omdøb den, så navnet siger hvad den ER.* Se pass 4.

### 0.5 Hvad der IKKE mangler

Tre af planens seks regel-krav er allerede dækket, og skal ikke bygges igen:

| Krav (linje 1599-1604) | Dækket af |
|---|---|
| "domæne-/dokumentkode importerer ikke raw store/sections" | `domain/page-section-access-boundary` (:425) + `persistence/committed-section-mirror` (:836) + `domainBoundaryIsolation.test.ts` |
| "dokumententrypoints omgår ikke prepare" | `document/lifecycle-single-entrypoint` (:1285) — mutationstestet mod ægte kode (WI-008 B9) |
| "legacy-symboler genindføres ikke" (import-siden) | `input/deleted-legacy-architecture-import` (:157) — forbyder MODULERNE med tom allowlist |

**Tre mangler reelt:**

| Krav | Status |
|---|---|
| "kun runneren skriver input" | **Ingen regel.** `grep` for `runner`/`writeBoundary` i manifestet = tom. Skrivningen går gennem `dispatchInput.ts` og `slimInputStore.setState`; intet AST-værn hindrer et nyt modul i at kalde `slimInputStore.getState().…` og skrive direkte. |
| "persisted controls kræver konkrete refs" | Var dækket af `form/persisted-styled-field-error-reporter` — nu INERT (§0.1). Kravet skal genoptages mod den NUVÆRENDE feltvej (`inputCore/react/fields/`), ikke mod den slettede. |
| "transient UI-controls kan ikke skrive sagsinput" | **Ingen regel.** `src/components/inputs/transient/` (3 filer + `useTransientDraft.ts`) er den eneste bevidste ikke-sagsdata-flade ([[project_transient_input_family]]). Intet hindrer en af dem i at importere `dispatchInput`. |

---

## 1. Scope

**Inde:**

1. **Universel dødt-værn-detektor** i harnesset: hver regel skal bevise, at den stadig har et
   MÅL i den levende kilde-graf — ikke kun i sine fixtures (§0.1).
2. Reparation eller sletning af de to inerte regler + de to døde scan-rødder (§0.1).
3. **Tre nye AST-regler**, der lukker de tre reelle huller (§0.5): write-boundary,
   persisted-control-refs, transient-isolation.
4. **Forbudt-identifier-gate** som AST-regel over reelt døde navne, med den korrigerede liste (§4.1).
5. Verifikation af fase 1–5's slettelister (planens trin 1) — som en maskinel kontrol, ikke en
   manuel gennemlæsning.
6. Fase-0-inventarets omklassificering (§0.4, planens trin 2).
7. Port/sletning af implementeringsspecifikke tests for afløste mekanismer (planens trin 3).
8. Kontrakt-/dokumentationsjustering, så kontrakter, kode, tests og værn beskriver samme model
   (exitkriterie 4 + acceptkriterie 30).

**Bevidst uden for scope:**

- **Fase 7's samlede accept** (`build:all`, manuel browsermatrix, endelig afleveringsgate). Fase 6
  gør træet klar til den; den udfører den ikke.
- **Al produktionsadfærd.** Ingen ændring i beregning, dokumentindhold, layout, tekst eller
  gate-udfald. Ændrer et værn sig til at flage ægte produktionskode, er det et FUND, der rettes i
  produktionen — ikke en adfærdsændring, jeg må vælge.
- **Omdøbning af levende vokabular** (`fieldErrors`, `blocksSave`, evt. `usePersistedForm`). Se
  §4.1.
- **Sletning af historik-prosa** om slettede mekanismer. Den er bevidst dokumentation (§0.2 pkt. 2).
- WI-009, WI-010, WI-011 (egne WI'er; uafhængige af Fase 6).

---

## 2. Autoritativt grundlag

- `docs/architecture/draft-commit-greenfield-design.md` Fase 6 (linje 1583-1628), §10
  acceptkriterier 28-30 (linje 1723-1725), §11 ikke-mål (ingen nye dependencies, linje 1735).
- `docs/architecture/draft-commit-greenfield-design.md` §12 arbejdsaftale: alle proces- og
  kodebeslutninger i denne WI er mine; **ingen af dem forelægges**, fordi ingen af dem er
  UI/UX eller beregning. Fasen har derfor **ingen godkendelsesgate** — se §7.
- `src/__tests__/quality/architecture/ruleKit.ts` — `ArchitectureRule`-kontrakten, herunder
  `findInFile` (rå fund UDEN allow/scope), som den nye detektor i pass 2 bygger på.
- `src/__tests__/quality/architecture/architectureRules.test.ts:69-89` — den eksisterende anti-rot-
  kontrol; den nye detektor er dens spejlbillede (allowlist-rot vs. regel-rot).
- [[project_ast_architecture_harness]] — regler tilføjes i manifestet, ikke som nye per-guard
  walkere.
- [[project_guard_selftest_principle]] — en scanner-guard skal bevise, at den fanger en overtrædelse.
- [[project_typed_write_boundary_over_ast_guard]] — kan grænsen udtrykkes som en TYPE, så gør det;
  AST-reglen er andenvalget. Gælder direkte for pass 3's write-boundary.

---

## 3. Rod frem for symptom

De inerte regler, de døde scan-rødder og den forældede symbol-liste er **ikke tre separate fejl**.
De er ét strukturelt problem:

> **Et værn og dets mål er koblet ved konvention, ikke ved konstruktion.** Når målet slettes,
> forsvinder koblingen tavst, og værnet bliver grønt af tomhed.

Alle tre eksisterende værn-forfald i projektet har samme signatur:

- WI-007: AST-reglen mod genindført legacy var inert (så kun literaler).
- WI-008 B6: `PreparedDocument`s brand var en ren typeerklæring — typecheck grøn, runtime `ReferenceError`.
- Her: to regler + to scan-rødder, hvis mål er slettet.

**Rettelsen er derfor ikke at lappe de to regler.** Det ville efterlade præcis samme fælde til
næste sletning. Rettelsen er at gøre koblingen **maskinel og universel**: harnesset skal for HVER
regel kunne svare på *"har du stadig noget at holde øje med?"* — og fejle, når svaret er nej.
Det er pass 2, og det er fasens vigtigste leverance. De to konkrete inerte regler bliver derefter
de første fund, detektoren rapporterer — beviset på at den ikke selv er inert.

---

## 4. Beslutninger truffet i planlægningen

### 4.1 Forbudt-listen korrigeres frem for at følges bogstaveligt

**Fravalgt:** at implementere planens 12 navne som skrevet. Det ville flage `fieldErrors` i ~12
levende produktionsmoduler (snapshots, reader-projektioner, download-gates) og `blocksSave` i EO's
`eoInputIssues.ts` — navne greenfield-arkitekturen selv bruger.

**Valgt:** listen indeholder kun navne, der er **beviseligt døde som identifiers**, og gaten måler
identifiers via AST. Den korrigerede liste (endelig efter pass 1's afklaring af to poster):

```text
executeLegacyInputTransaction   useDraftLifecycle       legacyGridTransactionBridge
useDraftField                   useTableInputCore       useRowDrafts
useSliceRowDrafts               invalidDrafts           FormPersistenceContext
fieldErrors  → FJERNET (levende: snapshot-/projektionsvokabular)
blocksSave   → FJERNET (levende: eoInputIssues.ts)
usePersistedForm → afklares i pass 1 (§0.3)
```

**Konsekvens for planen:** `docs/architecture/draft-commit-greenfield-design.md` linje 1606-1621
skal opdateres til den faktiske liste med en note om hvorfor de to navne udgår. Ellers driver plan
og værn fra hinanden — netop det exitkriterie 4 forbyder.

### 4.2 Write-boundary: type først, AST bagefter

Per [[project_typed_write_boundary_over_ast_guard]] undersøges i pass 3 FØRST, om "kun runneren
skriver input" kan gøres til en compilerfejl (fx ved at `SlimInputStoreState`s mutatorer får en
nominal witness-type, som kun `dispatchInput`/`initializeInputRuntime` kan konstruere — samme
mønster som `ManifestStorageKey` og `PreparedDocument`).

Kan det, er AST-reglen unødvendig, og typen er beviset. Kan det ikke uden at forvride runtime-koden,
skrives AST-reglen — og begrundelsen for at typen ikke rakte skrives ind i reglens `description`.
Beslutningen træffes i pass 3 med koden i hånden, ikke her.

### 4.3 De inerte regler: reparér, slet ikke

`pdf/download-committed-state`s INTENTION er stadig gyldig — "render-from-argument": en fil, der
udløser en download, må ikke læse committed state undervejs. Målet har blot skiftet navn fra
`download*Dokument` til livscyklussens `triggerDocumentDownload`/`executeDocumentDownload`. Reglen
**omskrives til det nuværende mål** og mutationstestes mod ægte kode.

`form/persisted-styled-field-error-reporter`s intention — "et persisteret parse-felt må ikke fejle
åbent" — er derimod muligvis nu strukturelt sikret: greenfield-feltvejen
(`inputCore/react/fields/`) rapporterer gennem editoren, ikke gennem en valgfri `onFieldError`-prop.
Pass 2 afgør: er invarianten strukturel, **slettes reglen** (og sletningen begrundes i commit-
beskeden); er der stadig en valgfri prop, der kan udelades, **omskrives reglen** mod den.
At beholde en inert regel er ikke et alternativ.

---

## 5. Implementeringsplan (passes)

Rækkefølgen er valgt, så detektoren (pass 2) står FØR de nye regler (pass 3-4) skrives. Så bliver
hver ny regel født under den kontrol, i stedet for at skulle eftervises.

### Pass 1 — maskinel verifikation af fase 1–5's slettelister (planens trin 1)

Formål: erstatte "gennemlæs slettelisterne" med en kontrol, der kan køres igen.

1. Afklar de to åbne poster fra §0.2/§0.3 med `grep -n` pr. fil:
   - `useSliceRowDrafts` i `src/components/tables/BeregnetRenteTable.tsx` — identifier eller kommentar?
   - `usePersistedForm` i de 6 page-filer + 6 domænemoduler — identifier eller kommentar? Findes
     hooket under et andet modulnavn?
   Resultatet skrives ind i §4.1's liste og i denne WI's beslutningsafsnit.
2. Bekræft at de moduler, `input/deleted-legacy-architecture-import` forbyder, faktisk **ikke
   findes** (reglen forbyder import; den beviser ikke fravær). Én test: for hvert forbudt
   modulmønster, assertér at ingen fil i grafen MATCHER stien.
   Dette er den præcise omvendte kontrol af reglen, og den er hvad planens trin 1 reelt beder om.
3. Kontrollér, at ingen fil under `src/` er en "compatibility-facade": søg efter
   `@deprecated`, `Legacy`/`legacy` i EXPORTEREDE symbolnavne, og `*Compat`/`*Adapter`-navne uden
   konsument. Fund klassificeres som (a) ægte rest → slettes, (b) levende adapter med legitimt navn
   → dokumenteres. Resultatet er exitkriterie 1's bevis.

**Leverance:** `src/__tests__/quality/architecture/deletedLegacyAbsence.test.ts` (eller som regel i
manifestet, hvis den kan udtrykkes som en graf-kontrol) + afklaringen af de to navne.

### Pass 2 — universel dødt-værn-detektor + reparation af de fire forfald

**Dette er fasens kerne.** Rækkefølge inden for passet er vigtig: detektoren skrives først og skal
FEJLE på de kendte forfald, før de rettes. Det er detektorens egen mutationstest.

1. Udvid `ArchitectureRule` med et **målbevis**. Skitse — den endelige form vælges i
   implementeringen:
   ```ts
   /**
    * Bevis for at reglen stadig har et mål i den LEVENDE kilde-graf.
    * `findInFile`-fixtures beviser at walkeren virker; dette beviser at der er noget at gå efter.
    */
   liveTarget:
     | { kind: 'matches'; }                      // reglens forudsætning rammer ≥1 rigtig fil
     | { kind: 'guardsAbsence'; }                // reglen håndhæver fravær (0 hits er korrekt)
   ```
   Reglerne deler sig reelt i to klasser, og det er den forskel, en naiv "≥1 hit"-kontrol ville
   ramme forkert:
   - **Forudsætningsregler** (`pdf/download-committed-state`,
     `form/persisted-styled-field-error-reporter`, `domain/page-section-access-boundary` …): de
     kigger kun på filer, der gør noget bestemt. Har ingen fil den egenskab, er reglen inert.
     Detektoren kræver, at reglens forudsætning rammer **mindst én rigtig fil**.
   - **Fraværsregler** (`input/deleted-legacy-architecture-import`, forbudt-identifier-gaten): nul
     hits er den ønskede tilstand. For dem kræver detektoren i stedet, at hvert forbudt
     mønster/navn er **beviseligt fraværende** (pass 1's kontrol) — så reglen ikke stille skifter
     fra "forbyder noget der findes" til "forbyder noget der ikke findes, med et forkert navn".
   Klassifikationen er **eksplicit pr. regel** — ikke inferet. En ny regel skal vælge side, og
   valget er dokumentationen.
2. Kør detektoren. Den SKAL rapportere `pdf/download-committed-state` og
   `form/persisted-styled-field-error-reporter` som døde. Sker det ikke, er detektoren selv inert →
   omskriv den før du fortsætter.
3. Tilføj samme kontrol for **scan-rødder**: enhver sti-præfiks i en regels `appliesTo`/scope-liste
   skal svare til en eksisterende mappe i grafen. Fjern `src/rowDrafts/` og `src/criticalActions/`
   fra `COMMIT_SENSITIVE_PREFIXES`. Kontrollen fanger fremtidige mappeflytninger, som ellers
   tavst indsnævrer et scope.
4. Reparér de to døde regler efter §4.3.
5. Gennemgå ALLE resterende ~32 regler mod detektoren og luk hvert fund. Forventning ud fra
   kortlægningen: `domain/eet-cross-domain-persisted-lookup`, `form/restore-target-attributes` og
   `input/row-command-destination` er sandsynlige kandidater, fordi de blev skrevet mod fase 3-4's
   mellemtilstand. Bekræftes af detektoren, ikke af mig.

**Leverance:** udvidet `ruleKit.ts` + `architectureRules.test.ts` + rettede regler. Ingen ny
dependency (§11).

### Pass 3 — de tre manglende grænseregler (planens trin 4, kravene der reelt mangler)

Hver regel bærer violating/clean fixtures (harnessets krav) OG mutationstestes mod ægte kode: læg
en probe-overtrædelse i en rigtig fil, se reglen fejle, fjern proben. Det er WI-008 B9's metode og
den eneste, der har fanget ægte inerthed før.

1. **`input/write-boundary`** — "kun runneren skriver input".
   Først: forsøg den typede lukning (§4.2). Lykkes det ikke, forbyd at andre moduler end
   `src/inputCore/runtime/{dispatchInput,initializeInputRuntime,slimInputStore}.ts` kalder
   `slimInputStore.setState` eller muterer store-state. Allowlist tom — en undtagelse ville være en
   anden samtidig sandhed (samme begrundelse som `deleted-legacy-architecture-import`).
2. **`form/persisted-control-refs`** — "persisted controls kræver konkrete refs".
   Mod den NUVÆRENDE feltvej (`src/inputCore/react/fields/` + grid-cellefladen). Kravets indhold
   afklares mod `mineo-field-pattern.md`s aktuelle ordlyd: hvilken ref/adresse er obligatorisk, og
   hvad går i stykker, hvis den mangler? Er invarianten allerede strukturel (feltadressen er et
   påkrævet argument, ikke en valgfri prop), er den korrekte leverance en **note i kontrakten om at
   ingen regel er nødvendig** — ikke en pro forma-regel. Fase 6's formål er dækning, ikke
   regel-antal.
3. **`input/transient-cannot-write-case-data`** — transiente controls kan ikke skrive sagsinput.
   Forbyd `src/components/inputs/transient/**` at importere `dispatchInput`, `slimInputStore`,
   `useFieldEditor` eller persistens-porte. Dette er den præcise invariant bag
   [[project_transient_input_family]] ("genindfør ALDRIG en Styled*Field-familie"), og den er i dag
   kun en aftale i memory — ikke håndhævet.

### Pass 4 — forbudt-identifier-gate + fase-0-inventaret

1. **`legacy/forbidden-identifier`** som AST-regel over den korrigerede liste (§4.1). Krav:
   - måler **identifiers** (`astQueries`), ikke tekst → historik-prosa flages ikke (§0.2);
   - klassificeres som **fraværsregel** i pass 2's detektor, så hvert navn skal kunne bevises dødt;
   - fixtures dækker BEGGE retninger: et identifier-hit flages, en kommentar med samme ord flages
     ikke. Den negative fixture er den vigtige — den er beviset for at gaten ikke kolliderer med
     [[project_dansk_prosa_guard_markers]].
   - regelens `allow` skal kunne rumme `architectureRules.ts` selv (den NÆVNER navnene som data) og
     kontrakt-`.md`-filer scannes ikke. Bemærk: harnessets anti-rot kræver, at hver allow-post
     stadig udløser reglen — det holder her, fordi manifestet indeholder navnene som strenge.
2. **Fase-0-inventaret** (§0.4): flyt
   `docs/architecture/greenfield-phase-0-persisted-input-inventory.json` til
   `src/__tests__/quality/__snapshots__/persistedInputSchemaPaths.json` (eller tilsvarende sted, der
   siger "genereret snapshot"), omdøb testen fra "greenfield fase-0-inventar" til noget, der
   beskriver dens FUNKTION (schema-drift), og opdatér planens trin 2 til at afspejle, at inventaret
   blev omklassificeret frem for slettet. Verificér at snapshottet genereres identisk efter flytning
   (byte-lighed), så flytningen ikke skjuler en drift.

### Pass 5 — port/slet implementeringsspecifikke tests (planens trin 3)

Kandidater fundet i kortlægningen — hver afgøres ved at spørge *"beviser denne test en INVARIANT
eller en implementering, der ikke findes længere?"*:

- `src/__tests__/quality/invalidDraftRowReconcileGuard.test.ts` — navnet peger på den slettede
  `invalidDrafts`-model. Beviser den fortsat en levende invariant (row-id-uniqueness ved reconcile,
  jf. [[project_reconcile_rowid_dup]])? Så **omdøb** til det nuværende begreb. Beviser den den
  slettede kanal? **Slet.**
- `src/__tests__/quality/fieldIdentityGuard.test.ts` — indeholder `invalidDrafts`/`useTableInputCore`;
  afklar om det er levende dækning eller pinning af slettede navne.
- `src/__tests__/quality/erstatningsopgoerelseSurfaceGuard.test.ts` — pinner `useRowDrafts`,
  `useSliceRowDrafts`, `usePersistedForm`. Skal pinne det NUVÆRENDE overfladenavn, ellers beviser
  den ingenting.
- `src/__tests__/quality/contractCoverageMatrix.test.ts` — nævner `useDraftField`,
  `legacyGridTransactionBridge`, `FormPersistenceContext`. Hvis matrixen kræver, at kontrakterne
  DÆKKER de navne, holder den kontrakt-prosaen kunstigt i live. Afklar og justér.

Regel for passet: **omdøbning frem for sletning, når invarianten lever** — men et navn, der pinner
en slettet mekanisme, er dødt værn og skal væk (samme dom som pass 2's inerte regler).

### Pass 6 — kontrakt- og plankonsistens (exitkriterie 4, acceptkriterie 30)

1. Opdatér `docs/architecture/draft-commit-greenfield-design.md` Fase 6: den korrigerede
   forbudt-liste (§4.1), trin 2's omklassificering (§0.4), og hvilke af de seks regel-krav der var
   dækket på forhånd (§0.5). Sæt status til gennemført med dato.
2. Gennemgå `form-contract.md`, `mineo-field-pattern.md`, `persistence-contract.md` for de tre hits
   hver af slettede navne. Historik-afsnit BEVARES (markeret som historik); normative afsnit, der
   stadig foreskriver en slettet mekanisme, rettes. Skelnen: står navnet i en "sådan gør du"-sætning
   (ret det) eller i en "sådan var det før"-sætning (bevar)?
3. Kør `contractCoverageMatrix` + `contract-topology.json`-kontrollen, så kontrakt-topologien
   stemmer efter ændringerne.
4. Opdatér `MEMORY.md`-pointere: [[project_greenfield_draft_commit_progress]] (Fase 6 lukket),
   [[project_ast_architecture_harness]] (detektoren er nu en del af motoren) og
   [[project_guard_selftest_principle]] (princippet er nu maskinelt håndhævet, ikke kun en vane).

---

## 6. Acceptance criteria

- [ ] **Dødt-værn-detektoren findes** og er mutationstestet: den rapporterede de to kendte inerte
      regler FØR de blev rettet (dokumenteret i commit-beskeden/WI'en, ikke kun påstået).
- [ ] Hver regel i manifestet klassificerer sig eksplicit som forudsætnings- eller fraværsregel og
      består detektoren.
- [ ] Ingen regels scan-rod peger på en mappe, der ikke findes. `src/rowDrafts/` og
      `src/criticalActions/` er væk fra `COMMIT_SENSITIVE_PREFIXES`.
- [ ] `pdf/download-committed-state` er omskrevet mod livscyklussens faktiske entrypoint ELLER
      slettet med begrundelse. Ikke efterladt inert.
- [ ] `form/persisted-styled-field-error-reporter` er omskrevet mod den nuværende feltvej ELLER
      slettet, fordi invarianten er strukturel. Ikke efterladt inert.
- [ ] `input/write-boundary` er lukket — som TYPE hvis muligt, ellers som AST-regel med tom
      allowlist og en `description`, der forklarer hvorfor typen ikke rakte.
- [ ] Transiente controls kan ikke importere en sagsinput-skrivevej (regel + mutationstest).
- [ ] "Persisted controls kræver konkrete refs" er enten håndhævet eller dokumenteret som
      strukturelt umuligt at bryde. Ikke pro forma.
- [ ] Forbudt-identifier-gaten måler identifiers, flager IKKE historik-prosa (negativ fixture
      beviser det), og hvert navn på listen er beviseligt dødt.
- [ ] `fieldErrors` og `blocksSave` er IKKE på listen, og planens §Fase 6 er opdateret med
      begrundelsen.
- [ ] Ingen `@deprecated`, compatibility-facade, dual-read eller fallback under `src/`
      (exitkriterie 1) — maskinelt kontrolleret, ikke gennemlæst.
- [ ] Fase-0-inventaret er omklassificeret som schema-drift-snapshot; snapshottet er byte-identisk
      efter flytningen.
- [ ] Ingen test pinner længere et slettet mekanismenavn; levende invarianter er omdøbt, ikke slettet.
- [ ] Kontrakter, plan, kode, tests og værn beskriver samme model (acceptkriterie 30).
- [ ] `npm run typecheck`, `typecheck:test`, `lint`, `test` og `verify:ledgers` grønne.
      `scripts/generate-build-info.mjs` kørt FØR fuld suite ([[project_stale_build_info_shifts_date_gates]]).

---

## 7. Godkendelsesgate

**Ingen.** Fasen ændrer ikke UI, UX, tekst, tal, afrunding eller dokumentindhold — den tilføjer og
retter værn. Per planens §12 pkt. 2 er alt i denne WI derfor mit ansvar og forelægges ikke.

**Undtagelsen, der ville udløse en gate:** flager et nyt værn ægte produktionskode, og er den
korrekte rettelse at ændre synlig adfærd, stopper jeg og forelægger DET som et konkret
brugereksempel (§5.4's hårde stop). Jeg forventer det ikke — men det er den ene vej, hvor Fase 6
kan blive et brugerspørgsmål, og den skal være italesat på forhånd.

---

## 8. Risici og modtræk

| Risiko | Modtræk |
|---|---|
| **Detektoren bliver selv inert** — den vigtigste risiko, da alt andet hviler på den. | Den skal FEJLE på de to kendte forfald før rettelsen. Det er en observeret fejl, ikke en fixture. |
| Detektoren giver falske positiver på legitime fraværsregler og presser mig til at svække den. | Tvedelingen forudsætning/fravær (pass 2 pkt. 1) er indbygget fra starten, netop for ikke at skulle svække noget bagefter. |
| Forbudt-gaten kolliderer med historik-prosa og presser en prosa-oprydning igennem. | Identifier-måling + negativ fixture. Prosaen er bevidst dokumentation. |
| Et nyt værn flager ægte kode → uplanlagt produktionsarbejde midt i fasen. | Behandles som FUND: rettes i produktionen, hvis rettelsen er usynlig; forelægges, hvis den er synlig (§7). Fasen stopper ikke ved første fund. |
| Regel-gennemgangen i pass 2 pkt. 5 vokser til alle 32 regler og æder budgettet. | Passene er uafhængige og kan lukkes hver for sig. Pass 2 pkt. 1-4 er minimumsleverancen; pkt. 5 kan afsluttes med en dokumenteret restliste, hvis budgettet slipper op — det er stadig en gevinst, fordi detektoren derefter blokerer nye forfald. |
| Flytning af fase-0-snapshottet skjuler en schema-drift. | Byte-lighed verificeres eksplicit før/efter. |

---

## 9. Verifikation

Rækkefølge (jf. planens Fase 6 + de kendte fælder):

1. `node scripts/generate-build-info.mjs` — FØR fuld suite.
2. `npx tsc -p tsconfig.json --noEmit`
3. `npx tsc -p tsconfig.test.json --noEmit`
4. `npx eslint src --ext .ts,.tsx`
5. `npx vitest run src/__tests__/quality/` — harnesset og de øvrige guards først; de er fasens
   leverance og fejler hurtigst.
6. `npx vitest run` — fuld suite. Baseline til sammenligning: **486 filer / 6081 tests** (WI-008's
   slutmåling). Et FALD i filtal skal kunne forklares af en bevidst sletning i pass 5.
7. `npm run verify:ledgers`
8. Slutreview: codex `sol/medium` (klasse M). Scope prompten til en **diff**, ikke en filliste
   ([[project_codex_orchestration_setup]] + WI-008's erfaring med budget-nedbrud).

`npm run build:all` og browsermatrixen hører til Fase 7 og køres ikke her.

---

## 10. Status og genoptagelse

**Gennemført 2026-07-26.** Alle acceptkriterier i §6 er opfyldt. Verifikation: typecheck,
typecheck:test, lint, fuld suite (**487 filer / 6097 tests**) og `verify:ledgers` grønne, efter
`generate-build-info.mjs`.

### Afklaringen fra pass 1 (§0.3's åbne spørgsmål)

**Begge navne er døde som identifiers** — udfaldet var renere end §0.3 forudsatte:

- `useSliceRowDrafts`: kun en kommentar i `BeregnetRenteTable.tsx:50`, kontrakt-prosa og to
  guard-tests' strengliteraler.
- `usePersistedForm`: **ingen definition og nul kald**. Alle ~12 produktionshits er kommentarer, der
  siger at mekanismen er VÆK. De eneste eksekverbare forekomster var fixture-STRENGE i
  `architectureRules.ts` — og fordi gaten måler identifiers, flager de ikke. Den forudsete omskrivning
  af `page-section-access-boundary`s fixtures var derfor unødvendig.

Begge er på den endelige forbudt-liste (§4.1).

### Væsentlig afvigelse: fem inerte regler, ikke to

Kortlægningen fandt to. Detektoren fandt **seks** forfald — de fire ekstra kunne kun findes maskinelt,
hvilket er selve argumentet for pass 2:

| Regel | Kortlagt? | Udfald |
|---|---|---|
| `pdf/download-committed-state` | ja | Omskrevet → `document/download-committed-state` |
| `form/persisted-styled-field-error-reporter` | ja | **Slettet** — invarianten er strukturel |
| `criticalAction/no-dom-scan-or-frame-wait` | nej | Retargetet til `criticalActionCoordinator.ts` |
| `domain/page-section-access-boundary` | nej — §0.5 kaldte den "dækket" | **Omskrevet** til descriptor-katalog-imports |
| `persistence/committed-section-mirror` | nej — §0.5 kaldte den "dækket" | Retargetet til `useInputEvaluation` |
| `domain/eet-cross-domain-persisted-lookup` | nej | **Slettet** — dækkes bredere af page-grænsen |

§0.5's påstand om at tre krav var "dækket på forhånd" holdt altså ikke for to af dem: reglerne fandtes,
men var tomme. Kun `document/lifecycle-single-entrypoint` og
`input/deleted-legacy-architecture-import` var reelt dækkende.

### Detektorens mutationstest (acceptkriterie 1)

Ikke påstået — **observeret**. Med de historiske forfald genindsat (download-reglen pegende på
`download*Dokument`, `src/criticalActions/` tilbage i `COMMIT_SENSITIVE_PREFIXES`) rapporterede
detektoren:

```text
document/download-committed-state: INERT — ingen fil i grafen opfylder reglens forudsætning …
form/no-queue-microtask-in-commit-sensitive: scan-roden findes ikke i grafen: src/criticalActions/
form/no-promise-tick-in-commit-sensitive: scan-roden findes ikke i grafen: src/criticalActions/
```

— mens reglernes egne fixtures fortsat bestod. Det er præcis forskellen, detektoren blev bygget for.
`deletedLegacyAbsence.test.ts` er mutationstestet på samme måde (genopstået `src/rowDrafts/`-fil +
en `@deprecated`/`legacy*`-facade → begge flaget).

### Write-boundary: type + smal regel (§4.2's afgørelse)

Typen valgt først: `applyCommit`/`hydrate` kræver `InputWriteAuthority` (unique-symbol-brand, kun
udstedt af `slimInputStore`). Verificeret at compileren afviser et write uden vidnet, OG at en
objektliteral ikke kan forfalske det. **Men `{} as InputWriteAuthority` slipper igennem** — brandede
typers kendte loft. Derfor bærer `input/write-boundary` de to rester: assertion-forfalskning og
uautoriserede kaldere af udstederen. Begrundelsen står i reglens `description`, som acceptkriteriet kræver.

Tests er legitime skrivere; de bruger `__testInputWriteAuthority` (eget navn, så en søgning viser
præcis hvilke tests der hydrerer direkte). 21 testfiler tilpasset.

### "Persisted controls kræver konkrete refs" — ingen regel, og det er svaret

Invarianten er strukturel: `field`/`location` er påkrævede props, og fejlvisningen kommer fra det
tokenbundne snapshot. Der er ingen valgfri `onFieldError` at udelade. En pro forma-regel oven på en
compiler-håndhævet invariant ville selv være det næste døde værn. Dokumenteret i manifestet.

### Uventet fund under pass 5

Den omskrevne (positive) `erstatningsopgoerelseSurfaceGuard` flagede straks
`LoentrinFinderOverlay.tsx`. Undersøgt: **ikke en violation** — det er den bevidste transiente
overlay-flade. Undtagelsen er indsnævret til filer der er RENT transiente (ingen `field={…}`), så en
violation ikke kan gemme sig bag ét transient input. Modstykket håndhæves af den nye
`input/transient-cannot-write-case-data`.

### Berørte filer

- `ruleKit.ts` — `LiveTarget`-typen; `liveTarget` gennem alle seks factories.
- `architectureRules.test.ts` — to nye detektor-cases (forudsætning + scan-rod).
- `architectureRules.ts` — 31 → 32 regler: 2 slettet, 4 omskrevet/retargetet, 3 nye
  (`input/write-boundary`, `input/transient-cannot-write-case-data`, `legacy/forbidden-identifier`),
  alle 32 klassificeret.
- `deletedLegacyAbsence.test.ts` (ny) — fraværsreglernes modstykke + exitkriterie 1 + katalog-completeness.
- `slimInputStore.ts` / `dispatchInput.ts` / `initializeInputRuntime.ts` / `runtime/index.ts` — typet skrivegrænse.
- `consumerInventory.test.ts` + snapshot flyttet til
  `src/__tests__/quality/__snapshots__/persistedInputSchemaPaths.json` (byte-identisk, git-registreret rename).
- `collectionRowOwnershipGuard.test.ts` (omdøbt fra `invalidDraftRowReconcileGuard`),
  `erstatningsopgoerelseSurfaceGuard.test.ts` (negativ → positiv).
- `draft-commit-greenfield-design.md` Fase 6 + `critical-action-contract.md` §6 + `verify-input-ledgers.mjs`-label.

### Bevidst ikke gjort

- **`fieldErrors`/`blocksSave` er ikke forbudt.** Levende greenfield-vokabular; begrundelsen står i
  både manifestet og planen (§4.1).
- **Historik-prosa er ikke ryddet.** Den forklarer hvorfor mekanismer ikke findes; gaten måler
  identifiers netop for ikke at presse den ud.
- **Ingen godkendelsesgate udløst.** Intet nyt værn krævede en synlig adfærdsændring (§7's undtagelse
  indtraf ikke).
- **Fase 7's samlede accept** (`build:all`, browsermatrix) — uden for scope som planlagt.

### Næste skridt

Fase 7 (samlet accept). Slutreview af denne fase mangler: codex `sol/medium` scopet til diffen.

---

## 11. Genåbning 2026-07-26 (eksternt review)

Reviewet konkluderede, at fasen ikke opfyldte exitkriteriet om reelt lukkede grænser. Diagnosen var
strukturel og korrekt: **brede capabilities var fortsat offentlige, mens syntaktiske værn forsøgte at
holde dem sikre.** Alle fund er behandlet; ingen blev afvist.

### Rodårsagen, som binder fundene sammen

Fasens første runde behandlede to slags problemer med samme forkerte greb:

1. **En åben capability blev bevogtet frem for fjernet.** `InputWriteAuthority` var et brandet vidne oven
   på en fortsat offentlig `StoreApi`. Vidnet var uforfalskeligt *som type*, men `setState` blev ved med at
   findes — og et AST-værn oven på en åben capability kan altid omgås (alias, aliaseret assertion, direkte
   kald). Samme mønster gjaldt `useInputRuntime()`: den normative opdeling læs/redigér/system fandtes som
   KOMMENTARER på ét fladt objekt.
2. **Legacy blev klassificeret efter tekstsøgning frem for efter den normative model.** Derfor blev
   `blocksSave` udeladt fra forbudslisten ("levende navn") på et faktuelt forkert grundlag, og EO's
   source-register blev læst som "legacy navne" frem for som en fejlalgebra, kontrakten forbyder.

Den generelle lære er skrevet ind i planen: *kan capabilityen fjernes, så fjern den; et vidne oven på en
åben capability er en aftale, ikke en grænse.* Og: *klassificér mod den normative model, ikke mod grep.*

### Fund og udfald

| Fund (review) | Udfald |
|---|---|
| **Høj** — skrivegrænsen kan omgås (`StoreApi`/`setState` offentlig; AST-reglen omgås af alias/assertion) | `SlimInputStore` er nu en HANDLE med navngivne transaktioner (`applyCommit`/`hydrate`/`restore`/`bumpSettingsRevision`). Zustands `StoreApi` forlader aldrig `slimInputStore.ts`. `InputWriteAuthority`, udstederen og testvidnet er SLETTET — der er intet vidne at forfalske. Tests bruger `__createSlimInputTestStore` (isoleret runtime). |
| **Høj** — read/edit/system er én samlet capability; råt sektionsopslag i `MainLayout` | Bindingen er nu `{ read, edit, system }` med `useInputReadPort`/`useInputEditPort`/`useInputSystemPort`. Dokumentlaget får en navngiven `DocumentInputAccess`. Shellens diagnostik læser gennem `inputDiagnosticsProjection`. Nye regler: `domain/raw-section-access-boundary`, `input/system-port-composition-root`. |
| **Høj** — EO har fortsat en parallel legacy-fejlmodel | `EoInputIssueSource`, source-mappet, prioritetslisten, `reasonToSource` og `'invalid-draft'` er slettet. Modellen er ét issue pr. feltnøgle; rækker der kombinerer felter siger det eksplicit (`presentIssuesForRow`). Testene er PORTET, ikke slettet — de fastholdt en ægte invariant i en legacy form. **2.016 EO-domænetests består uændret.** |
| **Høj** — `blocksSave` fjernet fra forbudslisten på forkert grundlag | Tilbage på listen, sammen med `EoInputIssueSource`, `EoFieldIssuesBySource`, `collectPresentFieldErrors`, `InputWriteAuthority`, `claimInputWriteAuthority`. `fieldErrors` er fortsat udeladt — her holdt begrundelsen. |
| **Høj** — page-grænsen måler ikke den faktiske afhængighed | `domain/page-section-access-boundary` følger nu den transitive importgraf gennem domæne-/inputlaget og viser KÆDEN i diagnostikken. Den fandt straks en ægte, hidtil usynlig kobling (EO-fanerne → EET's reader-projektion via midlertidigt-EET), som nu er autoriseret eksplicit. |
| **Middel** — reelle compat-facader består navnekontrollen | Ny STRUKTUREL kontrol: en fil hvis hele flade er ét `export … from`. De tre navngivne facader er slettet, og kontrollen fandt en FJERDE (`eoRowContextBuilders.ts`), reviewet ikke havde. Også `eoRowCommon`s re-eksport af tekst-helpers er væk. |
| **Middel** — dødt-værn-detektoren kan selv bestå vakuøst | `requiredPaths` + `minimumMatches` på forudsætningsregler (sammensatte mål); generisk, obligatorisk `verifyAbsent` på fraværsregler, kørt i BEGGE retninger (navnet skal også kunne FINDES i en fil der bruger det, ellers er fraværet vakuøst); alle scan-rødder skal findes. Manifestet er opdelt i `rules/` efter koncern. |
| **Middel** — `verify:ledgers` består fejlagtigt (1 fil / 13 tests) | Stien rettet (`greenfieldPhase0Inventory` → `consumerInventory`), og scriptet verificerer nu, at kørslen faktisk dækkede hver navngiven testfil OG et minimumsantal tests. Kører nu 2 filer / 16 tests. |
| **Middel** — normative kontrakter ikke i sync | `document-output-contract.md`, `document-format-contract.md`, `app-settings.md`, `domain-boundary-contract.md`, `error-contract.md` og `document-output-architecture.md` rettet. Formatrouting ejes af miljøets `resolveFormat`; servicelaget er slettet; `AppSettings`-gælden er indfriet; EET's forlig-læsning ER migreret. |

### Tilfældighedsfund rettet undervejs

- **`eoRowContextBuilders.ts`** — en fjerde compat-facade, fundet af den nye strukturelle kontrol.
- **`useFieldEditor.test.tsx`** — testens `dispatch`-override lå som et top-level felt på bindingen og blev
  aldrig læst (spread-typer laver ikke excess-property-check). Testen kunne derfor ikke fejle af den grund,
  den hed. Rettet til at override på `edit`-porten; testen fejlede korrekt før rettelsen.
- **`getFieldErrorsBySource`** i devtools-fladen bar legacy-vokabular for det, der nu er strukturelle
  `FieldIssue`s → `getSectionFieldIssues`.
- **`rowIssuesHaveError`** — en hjælper jeg tilføjede og ikke brugte. Slettet frem for efterladt som død API.

### Berørte filer (ud over §10's)

- `slimInputStore.ts`, `dispatchInput.ts`, `initializeInputRuntime.ts`, `runtime/index.ts` — indkapslet store.
- `inputRuntimeContext.tsx`, `react/index.ts`, `inputDiagnosticsProjection.ts` (ny) — capability-opdelingen.
- `useFieldEditor.ts`, `useCollectionRows.ts`, `useInputEvaluation.ts`, `useCaseOperations.ts`,
  `useUndoRedoShortcuts.ts`, `MainLayout.tsx`, `RenteberegningTab.tsx`, `OffentligeYdelserTab.tsx`,
  `useLoenindkomstViewModel.ts`, `useMineoDocumentEnvironment.ts`, `useStandaloneDocumentOutput.ts`,
  `mineoDocumentEnvironment.ts`, `standaloneDocumentEnvironment.ts` — portede consumers.
- `eoInputIssues.ts`, `eoRowCommon.ts`, `erstatningsopgoerelseReaderProjection.ts`,
  `eoSnapshotInvariants.ts`, `eoRow*Rows.ts`, `eoRowExecutionContext.ts`, `eoRowShared.ts`,
  `eoRowStamdataModel.ts` — EO's issue-model.
- `astQueries.ts` (`collectIdentifiers`/`hasIdentifier`), `ruleKit.ts` (`LiveTarget`, graf i `find`),
  `architectureRules.test.ts` (to skærpede detektor-cases), `architectureRules.ts` → registry +
  `rules/{storage,domain,document,form,inputBoundary}Rules.ts`, `deletedLegacyAbsence.test.ts`.
- `scripts/architecture/verify-input-ledgers.mjs`.
- Kontrakter: `document-output-contract.md`, `document-format-contract.md`, `app-settings.md`,
  `domain-boundary-contract.md`, `error-contract.md`; `docs/architecture/document-output-architecture.md`,
  `draft-commit-greenfield-design.md`.
- Slettet: `indkomstRowValidationReexport.ts`, `eoRowContextBuilders.ts`.
