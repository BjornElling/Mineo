# Review-opfølgning: Prioriteret implementeringsplan

## Formål

Denne plan omsætter fund fra det arkitekturelle code review til en prioriteret, gennemførbar implementeringsbacklog med fokus på korrekthed, robusthed og auditbarhed.

**Kilde:** Planen er baseret på brugerleveret reviewtekst i denne tråd (27-02-2026). Der findes ikke en separat reviewfil i repoet på nuværende tidspunkt. Alle fund-numre (Fund 1–11, T1–T8, Opfølgning 1–2) refererer til denne reviewtekst.

**Normative kontrakter:** `src/contracts/*.md` og `docs/architecture/calculation-architecture.md` er bindende. Afvigelser fra kontrakter behandles som arkitekturfejl (jf. `CLAUDE.md`).

---

## Fundoversigt

### Hovedfund (Fund 1–11)

| # | Problem | Severity | Opgave |
|---|---------|----------|--------|
| 1 | Dobbelttilstand i persistence-laget: React-cache og Zustand som parallelle SoT | Høj | C1 |
| 2 | Manuelle revisions-token-mekanismer skaber latent divergence-risiko | Høj | C1 |
| 3 | `replaceAllPersistedData` har uafklaret rollback-/atomicitetsadfærd | Høj | C1 |
| 4 | PDF-laget (`src/utils/pdf/erstatningsopgoerelsePdf.ts`) indeholder selvstændig beregningslogik parallelt med engines | Høj | C2 |
| 5 | Debug-model med blandet ansvar og duplikeret beregningslogik; potentiale for drift fra canonical engines | Høj | C3 |
| 6 | Auth-gate er teknisk omgåelig via localStorage/DevTools; mangler konsistent dokumentation af formål | Medium | M0 |
| 7 | Overlap og uklare ansvarslinjer mellem dato-utility-filer (`dateUtils`, `isoDateHelpers`, `branded`, `domain/dates/*`) | Medium | D1 |
| 8 | ~~Forbudt datomønster i `addOneDayIso`~~ | ~~Høj~~ | ✅ Implementeret |
| 9 | Eksporterede sub-schema-typer + robustgørelse af `loenindkomstAnsaettelsesforholdSchema` | Medium | ⚠️ Delvist impl. — resterende scope afklares i M0 |
| 10 | `formSchemas.ts` (845 linjer): monolitisk fil blander primitive helpers, enums og sektionsschemas | Medium | B3 |
| 11 | `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` og `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts` har tværlagsforbrug men ligger i domænemappe med PDF-navngivning | Medium | B1 |

### Tilfældighedsfund (T1–T8)

| # | Problem | Opgave |
|---|---------|--------|
| T1 | Dato-utilities: `datePrimitives.ts` overlapper med `branded.ts`/`dateUtils.ts` | D1 |
| T2 | `src/contexts/FormPersistenceContext.shared.ts` — mulig unødvendig split | B4 |
| T3 | `src/contexts/FormPersistenceContext.types.ts` — mulig unødvendig split | B4 |
| T4 | `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts` placering uhensigtsmæssig ift. laggrænser | B1 |
| T5 | ~~Ghost-kommentarer i schema fjernet~~ | ✅ Implementeret |
| T6 | `src/__tests__/quality/*` potentielt ude af sync med aktuelle kontrakter | B2 |
| T7 | Debug-moduler splittet mellem `domain/debug/` og EO-undermappe | C3 |
| T8 | `src/utils/numberUtils.ts` (4 linjer): mikro-helper uden canonical placering | B1 |

### Opfølgningsfund

| # | Problem | Status |
|---|---------|--------|
| Opf. 1 | ~~Parallel statistikmodel-mapping reduceret~~ | ✅ Implementeret |
| Opf. 2 | PDF blander stadig model og dataopslag | Åben → C2 |

---

## Overordnet prioritering

1. **M0 (forudsætninger):** Dokumentationslukning og administrative opgaver uden kodeændring.
2. **Spor B:** Medium-risiko opgaver med høj konsistensgevinst.
3. **Spor C:** Store refaktorer (state-arkitektur + EO pipeline/PDF/debug). Høj risiko, høj værdi.
4. **Spor D:** Strukturel oprydning med lav direkte korrekthedseffekt.

---

## M0: Forudsætninger (ingen kodeændring)

### M0-1. Fund 6: Auth-intention dokumenteres fuldt

**Status:** ✅ Implementeret 2026-02-27 (`docs/architecture/auth-gate-architecture.md`)

**Problem:** Auth-gaten er teknisk omgåelig via localStorage/DevTools. Acceptabelt som UX-barriere, men kræver tydelig dokumentation for at undgå falsk sikkerhedsforståelse.

**Scope:**
1. Dokumentér i `docs/architecture/`, at auth er en UX-gate og ikke sikkerhed.
2. Angiv trusselsmodel: beskytter mod utilsigtet adgang, ikke mod teknisk bruger.
3. Angiv trigger for fremtidig migration til server/infrastruktur-auth.

**Ikke i scope:** Serverbaseret auth, kryptering/algoritmeskift.

**Test:** Ingen adfærdsændring. Kør `npm run typecheck` + røgtest af login-flow.

**Exit-kriterier:**
1. Ét kanonisk dokument i `docs/architecture/` beskriver auth-formål og begrænsning.
2. Ingen modstridende formuleringer i kode eller docs.

---

## Spor B: Medium prioritet, lav/middel risiko

### B1. Fund 11 + T4 + T8: Klassificering af cross-layer helpers

**Status:** ✅ Implementeret 2026-02-27 (`docs/implementation/review-opfoelgning-b1-klassificering.md`)

**Problem:** `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` (274 linjer) og `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts` har tværlagsforbrug men ligger i domænemappe med PDF-navngivning. `src/utils/numberUtils.ts` (4 linjer) mangler canonical placering.

**Scope:**
1. Klassificér hver helper i `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` som:
   - **domænelogik/beregning** (fx `resolvePctPointFromSatsOrInput`, `resolveReguleringsdato`),
   - **formattering/presentation** (fx `formatAmount2`, `formatDateShort`),
   - **generel utility** (fx `numOrZero`, `detectDecimalPlaces`).
2. Klassificér `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`-helpers tilsvarende.
3. Vurdér om `src/utils/numberUtils.ts` (`toNonNegativeInt`) hører under eksisterende canonical number-modul.
4. Dokumentér klassificeringen som forberedelse til C2-flytning.

**Vigtigt: Denne opgave flytter ikke kode.** Selve flytningen sker i C2/C3, som har paritetsmatrix og paritetstests som forudsætning. Flytning uden C2's klassificering risikerer dobbeltarbejde.

**Test:** Ingen kodeændring → ingen tests påkrævet. Output er et klassificeringsdokument.

**Exit-kriterier:**
1. Hver helper i `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` har én klassificering (beregning / formattering / utility).
2. For beregnings-helpers: angivet hvilken canonical engine/pipeline de hører til.
3. For formaterings-helpers: angivet om de er PDF-specifikke eller generelle.

---

### B2. T6: Quality-tests alignment med kontrakter

**Status:** ✅ Implementeret 2026-02-27 (quality-guards + kontrakt-matrix for `src/contracts/*.md`)

**Problem:** `src/__tests__/quality/*` kan være ude af sync med aktuelle kontrakter.

**Scope:**
1. Gennemgå hvert kontraktkrav i `src/contracts/*.md` og verificér at der findes mindst én korresponderende assertion i quality-tests.
2. Identificér quality-tests der asserter noget som modsiger en kontrakt.
3. Opdater tests ved mismatch (kontrakt er normativ kilde).

**Test:** `npm run test` for quality-suiten + `npm run typecheck`.

**Exit-kriterier:**
1. Hvert kontraktkrav i `src/contracts/*.md` har mindst én korresponderende assertion i quality-tests.
2. Ingen quality-test asserter noget der modsiger en kontrakt.

---

### B3. Fund 10: Schema-filstruktur (`formSchemas.ts`)

**Status:** ✅ Implementeret 2026-02-27 (split i `baseSchemas`, `enumSchemas`, sektionsfiler + `formSchemas.ts` facade)

**Problem:** `formSchemas.ts` (845 linjer) er en monolitisk fil med blanding af primitive helpers, enums og sektionsschemas.

**Scope:**
1. Split i logiske moduler uden at ændre runtime-adfærd:
   - `schemas/baseSchemas.ts` — primitive validerings-helpers og base-schemas.
   - `schemas/enumSchemas.ts` — alle enum-definitioner.
   - Evt. sektionsopdelte schemafiler.
2. Bevar `formSchemas.ts` som re-export facade for at minimere callsite-churn.

**Afhængigheder:** Bør udføres efter B1 (klassificering) og før større schemaarbejde.

**Test:** `formSchemas.test.ts` + `eoFileSchema.test.ts` + `npm run typecheck`.

**Exit-kriterier:**
1. Ingen runtime-adfærdsændring (alle eksisterende tests grønne).
2. Hvert modul har ét klart ansvar (primitiver, enums, eller sektionsschema).
3. Ingen modul blander mere end én kategori (fx enums og sektionsschemas i samme fil).

---

### B4. T2 + T3: Kontekstfiler (`src/contexts/FormPersistenceContext.shared.ts` og `src/contexts/FormPersistenceContext.types.ts`)

**Status:** ✅ Implementeret 2026-02-27 (fuldt konsolideret til `src/contexts/FormPersistenceContext.tsx`; facade-filer fjernet)

**Problem:** Split mellem `.shared` og `.types` kan skyldes cirkulær import-risiko eller være et artefakt.

**Scope:**
1. Verificér om split skyldes reel cirkulær import-risiko (inspicér import-grafen).
2. Konsolidér kun hvis import-grafen forbliver acyklisk.

**Test:** `npm run typecheck` + persistence-relaterede tests.

**Exit-kriterier:**
1. Import-graf er acyklisk.
2. Enten: konsolideret til én fil, ELLER split bevaret med dokumenteret cirkulær import-bevis i koden.

---

## Spor C: Store programmer, høj risiko/høj værdi

### C1. Fund 1–3: Konsolidér state-arkitektur i persistence-laget

**Problem:** Dobbelttilstand (React-cache + Zustand) og manuelle revisions-token-mekanismer skaber kompleksitet og latent divergence-risiko. `replaceAllPersistedData` har uafklaret atomicitetsadfærd.

**Strategi:** Faseopdelt refaktor med characterization-tests før kodeændringer. Hver fase skal kunne stå alene — systemet skal være korrekt efter enhver fase, uanset om næste fase gennemføres.

**Faseplan:**

#### Fase 0: Baseline characterization-tests
- Karakterisér aktuel adfærd med tests for:
  - `hasUnsavedChanges` (før/efter commit, efter save, efter load).
  - Debug snapshot-refresh timing.
  - `replaceAllPersistedData` rollback og atomicitet.
  - Clear/reset flows.
- **Kan stå alene:** Ja. Tilføjer kun tests.
- **Rollback:** Ikke relevant (ingen kodeændring).

#### Fase 1: Én Source of Truth
- Gør Zustand til eneste persisted SoT.
- Fjern React-cache/state duplikat.
- **Kan stå alene:** Ja, men kun hvis alle Fase 0-tests er grønne efter ændring.
- **Rollback:** Revert hele Fase 1-commit. Fase 0-tests fungerer som regressionsnet.

#### Fase 2: Revisionsmekanisme
- Erstat manuelle revisionstokens med stabile subscription/selector-mønstre.
- **Kan stå alene:** Ja.
- **Rollback:** Revert til post-Fase 1-tilstand. Fase 0-tests bekræfter korrekthed.

#### Fase 3: Domænespecifik fejlstate
- Flyt EO-specifik fejltracking ud af generisk persistence-facade.
- **Kan stå alene:** Ja.
- **Rollback:** Revert til post-Fase 2-tilstand.

**Testkrav:**
1. Fuld test suite (`npm run test`) skal bestå efter hver fase.
2. Fase 0-characterization-tests grønne i alle efterfølgende faser.
3. Save/load rollback-tests grønne.
4. `npm run typecheck`.

**Go/no-go pr. fase:**
1. No-go ved regression i `hasUnsavedChanges` eller debug refresh.
2. No-go ved mulig implicit dataoverskrivning i aktive sessioner.
3. Ved no-go: revert fasen; log årsag som ny opgave.

**Exit-kriterier:**
1. Kun én canonical persisted tilstand (Zustand).
2. Ingen skjult adfærdsafhængighed til `cacheRef`/revision-counter.
3. Alle Fase 0-characterization-tests grønne.

---

### C2. Fund 4 + Opfølgning 2: EO-PDF skal være renderer, ikke beregningsmotor

**Problem:** PDF-laget (`src/utils/pdf/erstatningsopgoerelsePdf.ts`) indeholder selvstændig beregningslogik og direkte dataopslag parallelt med engines/pipeline. Bryder `calculation-architecture.md`-kontrakten.

**Strategi:** Paritet først, flytning bagefter.

**Faseplan:**

#### Fase 0: Paritetsmatrix
- Materialisér canonical output-felter som en TypeScript `EoCanonicalOutput`-type med tilhørende Zod-schema (jf. `calculation-architecture.md` pipeline-krav: `Engine → OutputSchema`).
- Felter: TAF-beløb, svie/smerte, totaler, periodiseringer, reguleringsbeløb.
- **Output-artefakt:** `src/domain/erstatningsopgoerelse/eoCanonicalOutput.ts` med type + schema. Placering i EO-domænemappen (frem for `src/domain/calculations/`) fordi outputtet er EO-specifikt, ikke cross-cutting (jf. `calculation-architecture.md`: "Section-local in `src/domain/calculations/`; cross-cutting engines in dedicated domain modules").

#### Fase 1: Paritetstests
- Faste snapshot-tests: engine-output === PDF-model-output for alle felter i paritetsmatrix.
- Brug B1-klassificeringen til at identificere hvilke `sharedPdfUtils`-helpers der er beregning vs. formattering.

#### Fase 2: Flytning
- Flyt beregningsdele fra `erstatningsopgoerelsePdf.ts` og `sharedPdfUtils.ts` til model/pipeline.
- Beregnings-helpers fra B1-klassificeringen flyttes til deres canonical engine.

#### Fase 3: Rensning
- PDF-filen må kun formatere/rendere.
- Fjern data-lagsimports fra renderer.
- Formaterings-helpers fra B1-klassificeringen bevares i præsentationslag (evt. `utils/formatting/`).

**Testkrav:**
1. Fuld test suite (`npm run test`) efter hver fase.
2. Paritetstests fra Fase 1 grønne i alle efterfølgende faser.
3. `npm run typecheck`.

**Exit-kriterier:**
1. Renderer har ingen domæneberegning — kun formattering og layout.
2. Alle beregningsresultater stammer fra canonical engines via `EoCanonicalOutput`.
3. Paritetstests dokumenterer lighed mellem engine-output og PDF.

---

### C3. Fund 5 + T7: Debug-lag konsolideres omkring canonical engines

**Problem:** Debug-model (23+ filer i `src/domain/debug/` + 6 filer i `src/domain/erstatningsopgoerelse/`) har blandet ansvar, duplikeret beregningslogik og potentiale for drift fra canonical engines.

**Scope:**
1. Definér debug som visning af canonical output (fra engines) + forklaringsmetadata.
2. Reducér duplikeret beregningslogik — debug skal konsumere engine-output, ikke genberegne.
3. Konsolidér placering: flyt de 6 EO-debug-filer til `src/domain/debug/`.

**Afhængigheder:** Tæt koblet til C2 — bruger samme `EoCanonicalOutput` og dataflow. C2 Fase 0–1 bør gennemføres først, så debug kan konsumere canonical output.

**Testkrav:**
1. Fuld test suite (`npm run test`).
2. Paritetstests: debug-visning === engine-output for alle centrale beregningsfelter.
3. `npm run typecheck`.

**Exit-kriterier:**
1. Debug afspejler canonical beregninger — ingen parallel beregningslogik.
2. Alle debug-filer samlet i `src/domain/debug/`.

---

## Spor D: Lavere prioritet, kontraktstyret

### D1. Fund 7 + T1: Dato-utilities struktur

**Problem:** Overlap og uklare ansvarslinjer mellem:
- `src/types/branded.ts` (branded parsing, typeguards),
- `src/utils/dateUtils.ts` (low-level helpers),
- `src/utils/dateFormatting.ts` (præsentationsformattering),
- `src/utils/isoDateHelpers.ts` (ISO range-operationer),
- `src/domain/dates/*` (`isoDate.ts`, `dateCommit.ts`),
- `src/utils/datePrimitives.ts` (`createDate`).

**Kontraktforhold:**
`date-contract.md` kræver:
- "All calendar day counts MUST use `src/utils/utcDayMath.ts`."
- `utcDayMath.ts` skal bevares som canonical dagtællingsmodul medmindre kontrakten ændres først.

**Scope:**
1. Kortlæg overlap mellem ovenstående filer.
2. Definér ansvarsfordeling:
   - **Branded types + parsing:** `types/branded.ts`
   - **Datoaritmetik (dagtælling):** `utils/utcDayMath.ts` (kontraktbundet)
   - **Præsentationsformattering:** `utils/dateFormatting.ts`
   - **ISO range-operationer:** `utils/isoDateHelpers.ts`
   - **Domain commit-logik:** `domain/dates/dateCommit.ts`
   - **`dateUtils.ts`:** Vurder om resterende helpers (fx `parseDanishDate`) hører under `branded.ts` (parsing) eller `dateFormatting.ts` (formattering). Målet er at `dateUtils.ts` enten tømmes og fjernes, eller får ét afgrænset restansvar.
3. Konsolidér `datePrimitives.ts` ind i `branded.ts` eller `dateUtils.ts` hvis `createDate` ikke udgør et selvstændigt kontraktpunkt.
4. Bryd ikke `date-contract.md`.

**Test:** `npm run test` for dato-relaterede suites + `npm run typecheck`.

**Exit-kriterier:**
1. Ingen dato-utility-fil importerer fra en anden dato-utility-fil med overlappende ansvar.
2. Hver dato-operation har præcis én canonical kilde.
3. `utcDayMath.ts` uændret (eller kontrakt opdateret først).

---

## Samlet leveranceplan (milepæle)

| Milepæl | Indhold | Forudsætning |
|---------|---------|--------------|
| **M0** | Auth-dokumentation (M0-1) + afklaring af Fund 9 restscope | Ingen |
| **M1** | Spor B: B1 klassificering, B2 quality-tests, B4 kontekstfiler | Ingen (kan køre parallelt med M0) |
| **M2** | C1 Fase 0–1 (state characterization + én SoT) | M1 (B1 klassificering bruges af C2) |
| **M2b** | C1 Fase 2–3 (revisionsmekanisme + domænespecifik fejlstate) | M2 (Fase 0–1 grøn) |
| **M3** | C2 Fase 0–1 (paritetsmatrix + paritetstests) | M2b (state-arkitektur fuldt stabil) + M1 (B1 klassificering) |
| **M4** | C2 Fase 2–3 + C3 (renderer/debug afkobling) | M3 (paritetstests på plads) |
| **M5** | B3 (schema-split) + D1 (dato-oprydning) | M4 (store refaktorer afsluttet) |

**Sekvenseringsbegrundelse:**
- M0 og M1 er uafhængige og kan køre parallelt. M0 er ren dokumentation; M1 er klassificering og testarbejde.
- M2 → M2b: C1's fire faser er sekventielle. M2 og M2b er splittet for at give et naturligt checkpoint efter den mest risikofyldte ændring (Fase 1: fjernelse af React-cache-duplikat).
- M2b før M3: State-arkitekturen (C1) skal være fuldt stabil før PDF/debug-refaktorering, da PDF og debug tilgår persisted state.
- M3 før M4: Paritetstests (Fase 0–1) skal dokumentere korrekthed *før* kode flyttes (Fase 2–3). Flytning uden paritet er blind refaktorering.
- M5 sidst: Strukturel oprydning (schema-split, dato-utilities) er lavrisiko og bør ikke blokere eller komplicere de store refaktorer i C1/C2/C3.

---

## Testgate pr. PR

Differentieret efter risiko:

### Spor B + D (lav/middel risiko)
1. `npm run typecheck`
2. Målrettede vitest-suites for berørte filer og deres direkte dependents.
3. Ingen regression i save/load-atomicitet.
4. Ingen ændring i brugerobserverbar adfærd uden eksplicit godkendelse.

### Spor C (høj risiko)
1. `npm run typecheck`
2. **Fuld test suite (`npm run test`) skal bestå.** Ingen undtagelser.
3. Ingen regression i save/load-atomicitet.
4. Characterization-tests (C1 Fase 0) og paritetstests (C2 Fase 1) skal bestå.
5. Ingen ændring i brugerobserverbar adfærd uden eksplicit godkendelse.

---

## Risikostyring

### Generelle principper
1. Brug dual-run/paritetstests før flytning af beregningslogik.
2. Undgå store "all-at-once"-refaktorer i trust-kritiske flows.
3. Introducér rollback-venlige trin med små, verificerbare commits.

### Scope creep i Spor C
Spor C-opgaver har tendens til at afsløre yderligere problemer under implementering.

- **Scope-lock pr. fase:** Fasens scope defineres ved start og ændres ikke undervejs. Nye fund der opdages under implementering logges som separate opgaver — de inkluderes ikke i den igangværende fase.
- **Fasepause ved overraskelser:** Hvis en fase afslører at den kræver ændringer uden for sit scope, stoppes fasen. Nye afhængigheder vurderes og planlægges som separate opgaver inden fasen genoptages.

### Kontraktopdateringer
Hvis en opgave afslører at en kontrakt (`src/contracts/*.md`) er ufuldstændig, forkert eller mangler specifikationer:
1. Kontraktopdatering oprettes som separat opgave og godkendes *før* koden ændres.
2. Kode må ikke implementere adfærd der afviger fra gældende kontrakt uden forudgående kontraktopdatering.
3. Undtagelse: Hvis en kontrakt er åbenlyst forkert og blokerer kritisk korrekthed, dokumenteres afvigelsen som inline-kommentar med reference til planlagt kontraktopdatering.
