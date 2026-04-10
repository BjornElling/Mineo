# Mineo – Pre-production hovedrengøring

**Dato:** 2026-04-10  
**Formål:** Én samlet, prioriteret plan for den afsluttende strukturelle oprydning, der med fuldt bagudkompatibilitetsbrud tager kodebasen til produktionsklar tilstand.  
**Bagudkompatibilitet:** Brydes bevidst og fuldt ud, der hvor det giver arkitektonisk gevinst.  
**Scope:** Alle punkter er handlingsorienterede. Vurderinger og graden af over-engineering er angivet eksplicit.

---

## Om reviews og denne plan

Planen samler og supplerer to ekspertreviews (review A og B). Ingen fund fra disse er slettet. Punkter der adresserer det samme problem er konsolideret. Nye supplerende vurderinger er markeret **[Supplerende]**.

Hvert punkt indeholder:
- Problemet og dets risiko
- Anbefaling
- Vurdering af kompleksitet og over-engineering-risiko
- Referencer til eksisterende kontrakter hvor relevant

---

## Samlet vurdering efter kodegennemgang

Planens grundretning er rigtig, men flere punkter var oprindeligt formuleret som om fundamentet manglede helt. Det passer ikke længere med den faktiske kodebase.

Det aktuelle billede er:
- Persistenslaget er allerede delvist transaktionelt: `loadFromFile()` bygger et valideret snapshot, `useFileSaveLoad` gatekeeper apply-flowet, og `replaceAllPersistedData()` laver atomisk replace med rollback.
- Der findes allerede målrettede quality-guards, bl.a. `eetDomainIsolation.test.ts` og `noDirectSessionStorageAccess.test.ts`. Derfor skal flere punkter forstås som udvidelse af eksisterende håndhævelse, ikke som ny infrastruktur.
- EO er klart den mest modne snapshot-baserede referenceimplementation. De øvrige domæner bruger stadig direkte beregningskald i page/tab-laget og er derfor ikke på samme robusthedsniveau.
- Den største reelle arkitektoniske restfejl er stadig schema-/versionshåndtering ved load/hydrering: gammel `sessionStorage` ryddes stadig hårdt ved versionsmismatch, og `.eo`-load dropper stadig hele sektioner ved parse-fejl.

Konsekvensen er, at denne hovedrengøring bør være mere kirurgisk end revolutionær:
- Bevar og stram eksisterende patterns, hvor de allerede er gode.
- Luk de få trust-kritiske huller helt.
- Undlad brede framework-agtige omskrivninger, som ikke giver proportional risikoreduktion før produktion.

---

## Prioritering – principper

Rækkefølgen styres af:
1. **Korrekthed og dataintegritet** – hvad der kan producere forkerte tal eller datatab
2. **Arkitektonisk robusthed** – hvad der fjerner fremtidige regressionsveje
3. **Vedligeholdbarhed** – hvad der reducerer kognitiv belastning og dublering

Over-engineering-risikoen stiger markant, jo længere ned ad listen man kommer. Punkterne 1–5 er substantielle og bør gennemføres. Punkterne 6–10 kræver konkret vurdering af nuværende tilstand i koden, før man beslutter omfang. Punkterne 11+ er strukturelle forbedringer med lavere risikoprofil.

---

## 1. Transaktionel persistence-motor (fælles pipeline)

**Severity:** Kritisk  
**Kilde:** Review A punkt 4, Review B punkt 5, `persistence-contract.md` §6

**Problem:**  
Load-flowet er specificeret i `persistence-contract.md` §6 med en kanonisk 7-trins rækkefølge (læs → strip → migrér → validér → preflight → apply → cleanup). Kontrakten er normativ, men intet i arkitekturen tvinger overholdelse. Implementeringen er spredt over `fileLoad.ts`, `fileSave.ts`, `fileSaveInternals.ts`, `persistenceLoadSanitization.ts` og hooks, og det er ikke teknisk umuligt at omgå rækkefølgen.

**Risiko:**  
En page-hook eller fremtidig feature kan lave en partial apply, springe preflight over, eller mutere in-memory state før apply-beslutningen er truffet. Det bryder persistensgarantierne og kan give stille datatab.

**Anbefaling:**  
Saml load-flowet i én funktion (`executePersistenceLoad`) der implementerer de 7 trin sekventielt og returnerer et resultat-objekt. Funktionen er den eneste lovlige vej til autoritative state-replacements. Al eksisterende load-kode refaktoreres til at kalde denne. Ingen page-hook eller komponent må omgå den.

Save-flowet er tilsvarende: saml det i `executePersistenceSave`. Fjern `fileSaveInternals.ts` som separat fil, hvis indholdet blot er en intern detalje.

**Status i den aktuelle kodebase:**  
Dette område er allerede delvist løst:
- `src/utils/fileLoad.ts` har en tydelig parse/sanitize/validate-pipeline i `processDecryptedContainer(...)`.
- `src/hooks/useFileSaveLoad.ts` gatekeeper preflight, overwrite-confirmation og apply.
- `src/contexts/FormPersistenceContext.tsx` har atomisk `replaceAllPersistedData(...)` med rollback.

Det betyder, at en fuld ny “persistence-motor” ikke er førsteprioritetsbehov. Det reelle hul er, at pipeline-ansvaret stadig er delt på tværs af fil-load, hook og context, så den normative rækkefølge ikke er samlet i ét autoritativt entrypoint.

**Justeret beslutning:**  
Gennemfør dette punkt som en konsolidering af eksisterende flow, ikke som en ny arkitektur:
- Ekstrahér den nuværende load-sekvens til ét kanonisk modul/funktion.
- Lad `useFileSaveLoad` blive orchestration/UI-lag, men ikke sted for domæneregler om preflight/apply.
- Bevar `replaceAllPersistedData(...)` som den autoritative apply-mekanisme, medmindre en ekstraktion kan ske uden regressionsrisiko.

**Over-engineering-vurdering:** Ikke over-engineering som konsolidering. Det *ville* være over-engineering at omskrive hele persistence-laget fra bunden, fordi store dele af adfærden allerede er korrekt og testet.

**Status: Gennemført – 2026-04-10**

Implementeret som en ren intern arkitekturændring uden brugerobserverbar adfærdsændring og uden ændringer i beregningslogik.

Konkrete ændringer:
- `src/utils/persistenceLoadApply.ts` — nyt kanonisk entrypoint `executePersistenceLoadApply` bygger det fulde autoritative snapshot, kalder `replaceAllPersistedData` atomisk og håndterer metadata/PWA-sideeffekter på ét sted. Den interne snapshot-builder er ikke eksporteret. Fejl i `replaceAllPersistedData` og fejl i efterfølgende sideeffekter er adskilt i to separate fejlkontekster med eksplicitte beskeder.
- `src/hooks/useFileSaveLoad.ts` — `applyLoadedSnapshot` delegerer nu fuldt til `executePersistenceLoadApply`; hook-laget er orchestration/UI-lag uden domæneregler om apply.
- `src/utils/filePersistenceMetadata.ts` — `saveFilenameMetadata`/`syncLoadedFilenameMetadata` er omdøbt til `persistSavedFilenameMetadata`/`persistLoadedFilenameMetadata` med kommentarer der dokumenterer den bevidste asymmetri mellem save- og load-flow. `fileSave.ts` bruger det fælles helperpunkt.
- `src/__tests__/utils/persistenceLoadApply.test.ts` — fire målrettede regressionstests: fuldt replace-snapshot (registry-drevet assertion, ikke hardkodede nøgler), metadata/PWA-sideeffekter, fail-closed ved manglende snapshot, og eksplicit fejlkontekst ved sideeffektfejl efter apply.
- Forældet JSDoc-kommentarblok i `fileSave.ts` fjernet.

Åbne delopgaver fra dette punkt: ingen. Save-flowet (`executePersistenceSave` / fjernelse af `fileSaveInternals.ts`) er ikke gennemført — vurderes som lavere prioritet og behandles separat.

---

## 2. Unified Calculation Kernel – snapshot-first for alle domæner

**Severity:** Kritisk  
**Kilde:** Review A punkt 3, Review B punkt 3, `eo-snapshot-contract.md` §1

**Problem:**  
EO-domænet har allerede den rigtige model: `computeEoSnapshot(committedInput) → EoSnapshot` som eneste beregnings-exit, med projektioner som eneste forbrugere. De øvrige domæner (årsløn, varige mén, erhvervsevnetab, renteberegning, forsørgertab) har beregningsmotorer i `src/domain/`, men det er ikke garanteret, at UI-komponenter, PDF-skrivere eller debug-lag ikke laver parallelle beregninger. Der er 24 engine-filer under EO alene – for øvrige domæner kendes det konkrete billede ikke fra reviews.

**Risiko:**  
Parallel beregningslogik i komponenter eller PDF-lag giver uoverensstemmende resultater mellem visning, PDF og debug. I et trust-kritisk system er det en korrekthedsfejl.

**Anbefaling:**  
For hvert domæne: Verificér at der eksisterer én autoritativ `computeXSnapshot(committedInput)` som eneste exit, og at alle forbrugere (UI, PDF, debug) er projektioner af snapshot. Ret eventuelle afvigelser. Introducer ingen ny abstraktion ud over det, der allerede er mønsteret i EO – generaliser blot mønsteret.

Konkret: Lav en kort audit af `Aarsloen`, `VarigeMen`, `Erhvervsevnetab`, `Renteberegning`, `Forsoergertab` – find om der er beregningslogik i page-komponenter eller PDF-skrivere der ikke er en projektion af et snapshot.

**Status i den aktuelle kodebase:**  
Dette punkt er reelt og ikke kun hypotetisk:
- EO er klart snapshot-first via `computeEoSnapshot(...)` og projektioner til debug/PDF/view.
- `Forsoergertab.tsx` kalder derimod `computeForsoergertabCalculation(...)` direkte i page-komponenten.
- `Erhvervsevnetab`-tabs kalder direkte beregningsfunktioner som `computeEetLoebendeYdelser(...)`, `computeEetKapitaliseringCalculation(...)`, `computeEetEalCalculation(...)` og `computeEetDifferencekravCalculation(...)`.
- `Renteberegning` bruger stadig tab-/table-orienteret beregningsflow frem for et samlet snapshot.

Det betyder, at planen her rammer et faktisk robusthedsgab.

**Justeret beslutning:**  
Gennemfør punktet selektivt:
- EO skal bruges som reference, ikke som skabelon for et generisk framework.
- Start med `Forsoergertab` og `Erhvervsevnetab`, fordi de allerede har mange view-/PDF-afledninger og derfor størst regressionsrisiko ved parallel logik.
- `Renteberegning` og `Varige mén` bør kun snapshot-ficeres, hvis audit viser mere end ét beregningsforbrug eller faktisk divergerende logik.
- `Årsløn` bør kun inkluderes, hvis der findes parallelle beregningsveje; ikke bare fordi siden har mange afledte værdier.

**Over-engineering-vurdering:** Ikke over-engineering, hvis man holder sig til audit + konsolidering af eksisterende mønstre. Det *bliver* over-engineering, hvis man indfører nye snapshot-typer, generiske interface-abstraktioner eller "calculation graph"-infrastruktur på tværs af domæner. EO-mønsteret er specifikt og veldefineret; kopiér det domæne for domæne, indfør ikke en meta-abstraktion.

---

## 3. Struktureret migrationsmotor – drop "total wipe ved version-mismatch"

**Severity:** Høj  
**Kilde:** Review A punkt 5

**Problem:**  
Ved versionsmismatch ryddes al state hårdt (`clear`-strategi). Det er en robust failsafe, men for slutbrugeren er det uacceptabelt: alle indtastninger går tabt ved en softwareopdatering. `persistence-contract.md` §7 specificerer allerede den rigtige tilgang: bevar brugerdata hvis den gamle betydning sikkert kan mappes, strip ellers, rapportér tab via preflight.

**Risiko:**  
Datatab ved softwareopdatering. Direkte brugerimpact.

**Anbefaling:**  
Erstat "total wipe" med en eksplicit migrationsmotor med følgende interface:
```ts
type MigrationResult = {
  migratedSections: Record<string, unknown>;
  strippedFields: string[];
  unmappableFields: string[];
};
migrate(rawSnapshot: unknown, fromVersion: number, toVersion: number): MigrationResult
```
Migrationsfunktionen kædes som trin 3 i den transaktionelle load-pipeline (punkt 1). Preflight viser strippede og ukonvertible felter. Ingen implicit wipe.

**Status i den aktuelle kodebase:**  
Dette er et dokumenteret og faktisk hul:
- `FormPersistenceContext.tsx` rydder fortsat al persisted state ved `parsed.version !== CURRENT_VERSION`.
- Der findes allerede en snæver legacy-migration for `faellesPersondata -> stamdata`, men den er håndbygget og ikke en generel strategi.
- `schema-evolution.md` beskriver korrekt, at hele sektioner droppes ved parse-fejl under `.eo`-load.

**Justeret beslutning:**  
Dette punkt skal gennemføres før produktion, men i minimal version:
- Første trin er ikke en fuld migrationsmotor for alle historiske versioner.
- Første trin er at erstatte global wipe med sektion-for-sektion bevaring, strip og målrettede migratorer for de faktiske kendte brud.
- Hvis der kun findes få historiske spring, så implementér disse konkret i kode og test dem direkte.

**Over-engineering-vurdering:** Risiko for over-engineering hvis man designer en generisk "migration DSL" eller "version graph". Holds simpelt: ét array af `[fromVersion, toVersion, migratorFn]`-tupler er tilstrækkeligt. Start med at kortlægge de faktiske versionsspring der allerede eksisterer.

---

## 4. Håndhævede domænegrænser – compile-time eller build-time checks

**Severity:** Høj  
**Kilde:** Review A punkt 6, Review B punkt 4, `domain-boundary-contract.md` §10

**Problem:**  
Domænegrænsekon trakten specificerer præcist hvem der må læse/skrive hvad. Men håndhævelsen er udelukkende review-afhængig. Der er intet der teknisk forhindrer, at en page-hook importerer en anden sides persisted sektion direkte.

**Risiko:**  
Skjulte tværdomæne-afhængigheder opstår og opdages kun ved review. I et system der vokser, er review-afhængig arkitekturhåndhævelse utilstrækkelig.

**Anbefaling:**  
Vurder om en simpel løsning er tilstrækkelig frem for en "capability matrix" med fuld compile-time håndhævelse (det er over-engineering for denne kodebase):

**Simpel løsning:** Skriv et build-time check (fx et lint-script eller en Jest-test der kører som del af CI) der verificerer, at ingen fil under `src/components/pages/X/` importerer fra `src/domain/Y/` eller `src/stores/formPersistenceStore` med en selector der omhandler en anden sides sektion. Dette er 50 linjer kode og giver 80 % af gevinsten.

**Status i den aktuelle kodebase:**  
Dette er delvist allerede implementeret:
- `src/__tests__/quality/eetDomainIsolation.test.ts` håndhæver specifikke EO/EET-domænegrænser.
- Der findes dermed allerede et accepteret mønster i kodebasen for build-/test-time arkitekturhåndhævelse.

Det rigtige næste skridt er derfor ikke at opfinde en ny mekanisme, men at udvide den eksisterende tilgang til generel domænegrænsebeskyttelse.

**Justeret beslutning:**  
- Udvid quality-testlaget fra EO/EET-specialregel til et lille sæt generelle domænegrænsetests.
- Hold testen deklarativ og let at vedligeholde.
- Undgå AST-tunge eller generator-baserede løsninger før der er et konkret vedligeholdelsesproblem.

**Over-engineering-vurdering:** En "deklarativ capability matrix med genererede selectors/commands" (review A) er over-engineering for denne kodebase. Det er et framework-mønster egnet til systemer med mange teams og domæner. Her er et simpelt build-test tilstrækkeligt. Gå ikke længere end det.

**Status: Gennemført – 2026-04-10**

Implementeret som en intern arkitektur-/quality-guard uden brugerobserverbar adfærdsændring og uden ændringer i beregningslogik.

Konkrete ændringer:
- `src/__tests__/quality/domainBoundaryIsolation.test.ts` — generel domænegrænse-test for page-laget. Sektionsnøgler og regex drives af `persistenceSchemas` (ikke hardkodede), med et eksplicit strukturelt testcase der verificerer at `PAGE_BOUNDARY_RULES` dækker alle kendte `StorageKey`s. Forbyder direkte `formPersistenceStore`-imports i pages, verificerer at hver page/subtree kun bruger kontraktligt autoriserede persisted sektioner, og holder EO's særlige read-only EET-import snæver og auditérbar. Manglende stier giver meningsfulde fejlbeskeder via `assertPathExists`.
- `src/__tests__/quality/persistenceAccessIsolation.test.ts` — håndhæver de kanoniske persistence-adgangsniveauer inkl. direkte `formPersistenceStore`-import (lukker åben flanke fra tidligere review).
- `src/__tests__/quality/testUtils.ts` — fælles infrastruktur for quality-tests: `collectSourceFiles`, `assertPathExists`, `toRepoRelativePath`. Erstatter tidligere duplikeret implementering på tværs af testfiler.
- `src/__tests__/quality/eetDomainIsolation.test.ts` — eksisterende, domænespecifik EO/EET-vagt bevaret som særskilt regressionstest.
- `src/__tests__/quality/contractCoverageMatrix.test.ts` — `domain-boundary-contract.md` og `persistence-contract.md` er koblet eksplicit til de tilsvarende quality-tests.

Åbne delopgaver fra dette punkt:
- Quality-laget håndhæver page-lagets persisted adgangsmønstre og direkte store-imports, men ikke bredere importgrænser mellem `src/domain/*`-moduler indbyrdes. Eventuel udvidelse bør ske som små deklarative tests, ikke som ny framework-infrastruktur.

---

## 5. Rydning af beregningsduplikering og konvergens mod kanoniske helpers

**Severity:** Høj  
**Kilde:** Review A (tilfældighedsfund), CLAUDE.md §Korrekthed

**Problem:**  
Med 24+ engine-filer under EO og separate beregningsmotorer i 6 andre domæner er risikoen for duplikerede hjælpefunktioner til datoer, afrunding, formattering og valuta reel. Review nævner specifikt dette som et fund. Der kendes ikke det præcise omfang fra reviews.

**Risiko:**  
To steder der beregner "det samme" på forskellig måde giver uoverensstemmende resultater. I en trust-kritisk beregner er dette en korrekthedsfejl.

**Anbefaling:**  
Lav en explicit audit af `src/utils/`, `src/validators/`, `src/domain/*/` for duplikerede funktioner med overlappende semantik – særligt:
- Datoaritmetic og ISODate-hjælpere
- Afrunding og monetær præcision
- Formattering af beløb og datoer

Konsolidér til én kanonisk kilde per hjælpefunktionstype. Fjern duplikater. Tilføj tests for de kanoniske versioner hvis de mangler.

**Status i den aktuelle kodebase:**  
Denne risiko er plausibel, men auditten har endnu ikke vist et tilsvarende “rødt flag” som ved persistence-versionering eller snapshot-gabet i de øvrige domæner. Kodebasen har allerede tydelige fælles hjælpepunkter som `formatUtils`, branded date-helpers og shared validators.

**Justeret beslutning:**  
Behandl dette som målrettet audit, ikke som bred refaktor:
- Søg efter konkrete dubletter inden for dato-bounds, afrunding og beløbsformattering.
- Gennemfør kun konsolideringer hvor semantisk overlap er bevist.
- Hvis to helpers ligner hinanden men tjener forskellige domæneregler, så bevar adskillelsen.

**Over-engineering-vurdering:** Lav til medium. Selve auditten er nødvendig; brede sammensmeltninger uden dokumenteret semantisk ækvivalens er over-engineering og kan skabe skjulte beregningsregressioner.

---

## 6. Draft → Committed → Persisted som teknisk håndhævet flow

**Severity:** Høj  
**Kilde:** Review B punkt 2, `form-contract.md` §2

**Problem:**  
Form-kontrakten specificerer præcist draft/committed-semantik og `onBlur` som eneste commit-mekanisme. Det er allerede mønsteret med `useDraftField` og `useRowDrafts`. Spørgsmålet er om alle formular-commits i alle pages faktisk overholder dette, eller om der er afvigelser (fx commits i `onChange`, `useEffect`-commits, implicit commit via ref).

**Risiko:**  
Én formular der committer i `onChange` eller via `useEffect` giver beregningsresultater baseret på draft-state. Det er en korrekthedsfejl jf. form-kontrakten §2.

**Anbefaling:**  
Lav en audit af alle page-komponenter og hooks for forbudte patterns fra form-kontrakten §3.3:
- commit i onChange
- commit i useEffect
- queueMicrotask/setTimeout i commit-flow
- setState inde i setState

Ret overtrædelser. Dokumentér som en CI-tjekliste eller lint-regel.

**Status i den aktuelle kodebase:**  
Der er mange tegn på, at den kanoniske retning allerede er stærkt implementeret:
- `useDraftField` og `useRowDrafts` er etablerede patterns.
- Tabeller og inputs er gennemgående bygget omkring `onBlur`/commit-semantik.
- Dropdowns og toggles bruger allerede immediate commit, hvilket er kontraktligt korrekt.

Der findes dog stadig mange `useEffect(...)` og enkelte specialflows i tabeller/inputs, så punktet bør forstås som regressionsjagt efter konkrete kontraktbrud, ikke som mistanke om systemisk kollaps.

**Justeret beslutning:**  
- Auditér kun flows hvor der er reel risiko: specialtabeller, keyboard-navigation, auto-sync mellem tabs og felter med hjælpelogik.
- Prioritér søgning efter implicit commit eller derived feedback fra draft-state.
- Undlad at omskrive stabile input-komponenter alene for at “ensrette” implementation details.

**Over-engineering-vurdering:** En "formel state machine med lukkede transitions-API'er" (review B) er over-engineering. `useDraftField` + `useRowDrafts` med `onBlur`-commit er allerede det rigtige pattern. Opgaven er at verificere og rette overtrædelser, ikke at bygge ny infrastruktur.

---

## 7. Persistence-hooks: fjern parallelle lokale kopier af committed state

**Severity:** Høj  
**Kilde:** `persistence-contract.md` §9.3, review A

**Problem:**  
Persistence-kontrakten §9.3 forbyder eksplicit at persistence-hooks holder en separat lokal committed kopi af en persisted sektion. AGENTS.md definerer tre kanoniske adgangsniveauer (`usePersistedSectionSelector`, `usePersistedForm`, `useFormPersistence()`). Det er uklart fra reviews om der er overtrædelser i praksis.

**Risiko:**  
To committed kopier af samme data kan divergere. Beregninger på den forkerte kopi giver forkerte resultater.

**Anbefaling:**  
Audit af alle hooks der anvender persisted sektionsdata. Verificér at ingen hook holder en `useState`-kopi af en committed persisted sektion. Ret overtrædelser ved at skifte til de kanoniske read-model hooks.

**Status i den aktuelle kodebase:**  
Fundene peger på, at hovedretningen allerede er god:
- `usePersistedSectionSelector` og store-snapshot-hooks bruges bredt.
- `usePersistedForm` læser committed state via selector-hook og respekterer authoritative epoch.
- `FormPersistenceContext` er allerede eksplicit beskrevet som facade og ikke source of truth.

Det gør dette punkt til en verifikationsopgave, ikke et sandsynligt stort refaktorpunkt.

**Justeret beslutning:**  
Begræns arbejdet til at finde faktiske parallelle committed kopier. Hvis auditten ikke finder sådanne, lukkes punktet som “verificeret OK” uden kodeændringer.

**Over-engineering-vurdering:** Ikke over-engineering. Det er direkte håndhævelse af en eksisterende kontrakt.

**Status: Delvist gennemført – 2026-04-10**

Implementeret som en intern arkitektur-/quality-guard uden brugerobserverbar adfærdsændring og uden ændringer i beregningslogik.

Konkrete ændringer:
- `src/__tests__/quality/persistenceAccessIsolation.test.ts` — ny quality-test der håndhæver de kanoniske persistence-adgangsniveauer:
  - `useFormPersistence` er begrænset til `MainLayout` samt de to kanoniske imperative hooks `usePersistedForm` og `useFormFieldErrors`.
  - Direkte import af `FormPersistenceContext` er begrænset til top-level/provider-infrastruktur (`App.tsx` + `src/contexts/*`).
- `src/__tests__/quality/contractCoverageMatrix.test.ts` — `persistence-contract.md` er nu eksplicit koblet til denne nye adgangstest samt den eksisterende load/apply-test for persistence.

Statusmæssig betydning:
- Punktet er ikke fuldt “verificeret OK” endnu; der er nu et konkret regressionsværn mod, at almindelige pages/hooks begynder at bruge context/store som parallel adgangsvej uden om selector- og form-hookene.
- En bredere audit af faktiske parallelle committed kopier kan stadig gennemføres senere, men det nuværende værn lukker den vigtigste regressionsvej med lav ændringsrisiko.

---

## 8. UI-arkitektur: thin pages, thick domain adapters

**Severity:** Medium  
**Kilde:** Review A punkt 8, Review B punkt 6, `page-component-contract.md`

**Problem:**  
Page-kontrakten siger allerede at pages orkestrerer og ikke er logiktunge. Spørgsmålet er om der i praksis er domænelogik i page-komponenter (beregninger, validering, parsing).

**Risiko:**  
Domænelogik i page-komponenter er svær at teste, skaber skjult coupling, og giver risiko for inkonsistent domæneadfærd på tværs af pages.

**Anbefaling:**  
Audit af page-komponenter for:
- Inline beregningslogik der burde ligge i `src/domain/`
- Inline validering der burde ligge i `src/validators/`
- Ad hoc parsing af input-værdier der burde ligge i domain-hooks

Flyt logik til korrekt lag. Pages bør udelukkende orkestrere: wiring af hooks, layout, event-delegation.

**Status i den aktuelle kodebase:**  
Her viser auditten en blandet tilstand:
- `VarigeMen.tsx` og `Renteberegning.tsx` er relativt tynde pages.
- `Forsoergertab.tsx` er markant mere logiktung og blander beregning, gating, visningsafledninger og PDF-inputs i samme fil.
- `Erhvervsevnetab.tsx` er page-tynd, men meget af domænearbejdet ligger i tabs, hvilket kan være korrekt eller forkert afhængigt af om tabbene kun projekterer eller også beregner.

**Justeret beslutning:**  
Dette punkt bør ikke være en generel “tynd alle pages ud”-øvelse. Gennemfør det kun dér, hvor tungt UI-lag skaber konkrete problemer:
- `Forsoergertab` er en oplagt kandidat.
- `Erhvervsevnetab` bør vurderes sammen med punkt 2.
- `Varige mén` og `Renteberegning` bør kun ændres ved klare grunde.

**Over-engineering-vurdering:** Lav risiko for over-engineering. Flyt kun logik der klart er fejlplaceret. Indfør ikke nye abstrakte lag ("domain adapters", "read model adapters") medmindre der er aktuel duplikering der motiverer det.

---

## 9. SessionStorage: fail-closed ved skrivefejl + ingen skjult parallel state

**Severity:** Medium  
**Kilde:** `persistence-contract.md` §8.4

**Problem:**  
Kontrakten kræver at fejl ved skrivning til `sessionStorage` behandles fail-closed og ikke skjules som om persist lykkedes. Det er ikke verificeret om implementeringen overholder dette.

**Risiko:**  
Bruger tror data er gemt i sessionen, men sessionStorage-skrivningen fejlede stille. Næste interaktion ser tom state.

**Anbefaling:**  
Find alle `sessionStorage.setItem()`-kald. Verificér at fejl fanges og eksponeres (minimum: fejllog, ideelt brugernotifikation). Verificér at `sessionStorage` ikke bruges som et parallelt aktivt state-lag ved siden af `formPersistenceStore`.

**Status i den aktuelle kodebase:**  
Dette område er stærkere end planen først antog:
- Der findes allerede `noDirectSessionStorageAccess.test.ts`, som forhindrer vilkårlige literal-keys.
- Domænedata går gennem `FormPersistenceContext`/store.
- Flere `sessionStorage`-kald er rene UI-state nøgler og er derfor ikke i sig selv et kontraktbrud.

Det reelle hul er mere snævert:
- Fejl ved visse UI-state writes håndteres ikke konsekvent.
- Der bør sondres tydeligere mellem trust-kritisk domænepersistens og ikke-kritisk UI-hjælpestate.

**Justeret beslutning:**  
- Behandl domænepersistens og UI-state hver for sig.
- Trust-kritiske writes skal fortsat være fail-closed.
- UI-state writes må godt fejle mere lempeligt, så længe de ikke giver indtryk af, at sagsdata er sikkert bevaret.

**Over-engineering-vurdering:** Ikke over-engineering som præcisering. Det ville være over-engineering at bygge et generelt storage-framework for al UI-state.

---

## 10. Test-dækning: kontrakt-tests for kritiske paths

**Severity:** Medium  
**Kilde:** Review A (test-plan), Review B punkt 8

**Problem:**  
Reviews nævner manglende test-dækning som et fund, særligt for: beregningsinvarianter, save/load round-trip, og partial-load policy. Omfanget af eksisterende dækning kendes ikke præcist.

**Anbefaling:**  
Prioriteret test-plan:

**Niveau 1 – Skal eksistere som regressionsværn:**
- Save → load round-trip for alle persisted sektioner (ingen datatab, korrekt strip af ukendte felter)
- Migrationsmotor-tests for hvert versionsspring (når punkt 3 er implementeret)
- `computeEoSnapshot` invariant-tests: korrekte status-transitions, fail_closed ved skemaviolation, korrekt clamping

**Niveau 2 – Bør eksistere:**
- Draft/committed round-trip tests for alle `useDraftField` og `useRowDrafts`-forbrugere
- Preflight-beslutninger (alle tre valg: indlæs, stop, send)
- Domænegrænse-tests: verificér at forbudte imports ikke eksisterer (jf. punkt 4)

**Niveau 3 – Ønskeligt:**
- Property-tests / invariant-tests for beregninger med tilfældige, men valide inputs

**Status i den aktuelle kodebase:**  
Der findes allerede mere testfundament end planen gav indtryk af:
- `fileLoad`- og `fileSave`-tests findes.
- rollback-tests for `replaceAllPersistedData(...)` findes.
- `computeEoSnapshot` og EO-PDF-projektioner har tests.
- flere quality-guards findes allerede.

Det betyder, at test-arbejdet skal målrettes de dokumenterede huller, ikke bredt “hæve dækningen”.

**Justeret beslutning:**  
Prioritér kun manglende regressionsværn for de ændringer denne plan faktisk medfører:
- migrations-/versionshåndtering
- generaliserede domænegrænsetests
- nye snapshot-forløb for domæner der løftes til snapshot-first
- round-trip tests for sektioner der i dag stadig kan droppes for hårdt ved load

**Over-engineering-vurdering:** Niveau 1 er ikke over-engineering og bør gennemføres. Niveau 3 (property-tests) kan være over-engineering afhængig af kompleksiteten i beregningsmotorerne. Start med Niveau 1 og 2.

---

## 11. Fjern død kode og ubrugte exports

**Severity:** Medium  
**Kilde:** CLAUDE.md §Kompleksitet

**Problem:**  
Med den historik kodebasen har (mange features, iterationer, schema-renaming) er der sandsynligvis ubrugte exports, kommenterede blokke og forældede helpers. Det kendes ikke præcist.

**Anbefaling:**  
Kør TypeScript's `noUnusedLocals` og `noUnusedParameters` (tjek om det allerede er aktivt i `tsconfig.json`). Brug en dead-code-detektor (fx `ts-prune` eller eslint-plugin-unused-imports). Fjern det der ikke bruges.

**Status i den aktuelle kodebase:**  
Dette er sandsynligvis nyttigt, men det er også det mest klassiske sted at bruge tid uden proportional produktionsgevinst. Dead-code-oprydning er kun værdifuld her, hvis den:
- reducerer risiko i centrale flows, eller
- tydeligt fjerner forældede konkurrerende implementationsspor.

**Justeret beslutning:**  
Gennemfør kun dette punkt selektivt:
- fjern død kode i områder, der røres af punkterne 1–10
- fjern åbenlyse forældede exports/helpers, hvis de skaber forvirring om den kanoniske vej
- undlad repository-bred oprydning alene for pænhed

**Over-engineering-vurdering:** Medium. Lokal oprydning er god; en repo-bred kosmetisk oprydning lige før produktion er let at oversælge og giver lille risikoreduktion.

---

## 12. Forklarlighed fra beregningsmotoren – lokale forklaringsobjekter

**Severity:** Lav  
**Kilde:** Review B punkt 7

**Problem:**  
For et trust-kritisk system er det værdifuldt at beregningsmotoren kan forklare "hvorfor resultat X". I dag producerer motorerne tal, men det er uklart om de eksponerer mellemregninger og årsager til specifikke resultater.

**Anbefaling:**  
Overvej om `EoSnapshot` (og tilsvarende snapshots for andre domæner) allerede indeholder tilstrækkelige mellemregninger til at understøtte en "vis beregningsgrundlag"-visning. Hvis ja, er arbejdet allerede gjort via EODebug. Hvis nej, overvej at tilføje et `trace`-felt til snapshot-typen med nøglebebregningsmellemresultater.

Dette er *ikke* ekstern telemetri. Det er lokale forklaringsobjekter i browseren.

**Over-engineering-vurdering:** Høj over-engineering-risiko. EODebug dækker sandsynligvis allerede behovet. Udfør kun dette punkt hvis EODebug-visningen er utilstrækkelig til at diagnosticere fejl i beregnede resultater. Prioritér ikke dette punkt over 1–5.

---

## 13. Lokal auditlog og replay (observability for trust)

**Severity:** Lav  
**Kilde:** Review A punkt 7

**Problem:**  
Uden en lokal audit-trail er det svært at reproducere fejl deterministisk. Brugeren kan ikke forklare "hvad jeg gjorde, der gav det forkerte resultat".

**Anbefaling:**  
Tilføj, efter brugerens eksplicitte valg, en eksportérbar command-log med tidsstempel og inputfingerprint pr. commit-event. Replay-funktionalitet i debug-tilstand.

**Over-engineering-vurdering:** Meget høj over-engineering-risiko for et V1-produkt. EODebug og EO-snapshot løser det diagnostiske behov for EO. En generisk audit-log er et framework-mønster der kræver significant implementeringsomfang. Udfør ikke dette punkt i pre-production-rengøringen; evaluer post-launch baseret på konkrete supportbehov.

---

## 14. Capability-baserede interfaces og compile-time domænegrænsehåndhævelse

**Severity:** Lav (som arkitekturmål; den simple version er dækket af punkt 4)  
**Kilde:** Review A punkt 6, Review B punkt 4

**Problem:**  
Et fuldt "capability-baseret interface"-system (deklarativ who-can-read-what matrix, genererede selectors/commands, build-time dependency-test der fejler ved ulovlige imports) giver en arkitektur der er "teknisk umulig at bryde" mht. domænegrænser.

**Vurdering:**  
Det er en stærk idé i store systemer med mange teams. I Mineo med én eller få udviklere og et veldefineret, stabilt domænemodel er det over-engineering. Den simple version (build-time test, punkt 4) giver 80 % af gevinsten til 10 % af indsatsen.

**Anbefaling:**  
Gennemfør punkt 4 (simpel build-test). Hav dette punkt som et fremtidigt mål hvis kodebasen vokser med flere udviklere.

---

## Sekvensering og afhængigheder

```
Fase 1 (korrekthed – gør disse først):
  [1] Transaktionel persistence-motor
  [3] Migrationsmotor
  [2] Unified Calculation Kernel – audit + konsolidering for de domæner hvor der faktisk er parallel beregningslogik

Fase 2 (robusthed – gør disse inden launch):
  [4] Udvid eksisterende quality-tests til generel domænegrænse-check
  [6] Draft/committed flow – målrettet audit + rettelse
  [7] Persistence-hooks – verifikation, kun rettelse hvis konkrete parallelkopier findes
  [8] UI-arkitektur – fokuseret oprydning i tunge pages/tabs
  [10] Test-dækning for de ændringer denne plan faktisk indfører

Fase 3 (kvalitet – gør disse inden launch hvis tid):
  [5] Kanoniske helpers – audit + konsolidering hvor dubletter kan bevises
  [9] SessionStorage fail-closed for trust-kritiske writes + tydelig skelnen til UI-state
  [11] Selektiv fjernelse af død kode i berørte områder

Fase 4 (post-launch, evaluer behovet):
  [12] Forklarlighed fra beregningsmotoren
  [13] Lokal auditlog og replay
  [14] Compile-time capability-interfaces
```

---

## Hvad der IKKE bør gennemføres i denne rengøring

Følgende forslag fra de to reviews er vurderet som **over-engineering** for denne kodebase og bør **ikke** implementeres i pre-production-rengøringen:

| Forslag | Begrundelse |
|---|---|
| Generisk "case engine" med command-handler for alle mutationer | EO og de øvrige domæner har velspecificerede, stabile domæner. Et generisk command-framework tilføjer et abstraktionslag med ingen konkret gevinst. |
| "Calculation graph"-infrastruktur på tværs af domæner | EO-mønsteret er specifikt for EO's kompleksitet. De øvrige domæner er simplere og behøver ikke den samme infrastruktur. Kopiér mønsteret domæne for domæne – byg ikke et framework. |
| Deklarativ capability matrix med genererede selectors | Relevante for systemer med mange udviklere og flydende domæner. Her er en simpel build-test tilstrækkelig (punkt 4). |
| Generisk migrations-DSL eller version-graph | Et array af `[from, to, fn]`-tupler er tilstrækkeligt og langt mere vedligeholdelsesvenligt. |
| Ekstern auditlog / telemetry | Bryder GDPR-rammen. |
| Lokal command-log med replay | Meget høj implementeringsindsats, meget lav konkret brugergevinst for V1. |
| Server-side features af enhver art | Bryder 100 % client-side-kravet. |

---

## Kontraktdrift: punkter der kræver kontraktopdatering

Hvis følgende gennemføres, kræver de opdatering af de normative kontrakter:

| Punkt | Kontrakt der skal opdateres |
|---|---|
| [3] Migrationsmotor erstatter total wipe | `persistence-contract.md` §7 |
| [2] Snapshot-pattern udbredes til nye domæner | `domain-boundary-contract.md` + evt. ny snapshot-kontrakt pr. domæne |
| [4] Build-time domænegrænse-check | `domain-boundary-contract.md` §10 + AGENTS.md |

Kontrakterne er de autoritative kilder – opdatér dem *inden* implementering af de tilsvarende ændringer.

---

## Endelig beslutningsliste for hovedrengøringen

Følgende punkter vurderes som den rigtige, sidste store oprydning før produktion:

1. Konsolidér eksisterende load/apply-flow til ét kanonisk persistence-entrypoint uden at omskrive det fra bunden.
2. Fjern hard wipe ved versionsmismatch og indfør enkel, eksplicit schema-/versionsmigration med preflight-rapportering.
3. Løft de domæner der faktisk har parallel beregningslogik til snapshot-first eller tilsvarende én autoritativ beregningsvej.
4. Udvid eksisterende quality-tests til generel håndhævelse af domænegrænser.
5. Auditér draft/committed-regler og persistence-hooks for faktiske kontraktbrud; ret kun konkrete afvigelser.
6. Ryd tunge UI-filer op dér, hvor page/tab-laget i praksis ejer for meget domænelogik.
7. Tilføj regressions-tests præcis dér, hvor ovenstående ændringer åbner risiko.

Følgende punkter skal kun gennemføres, hvis auditten viser et konkret behov:

1. Konsolidering af helpers for datoer, afrunding og formattering.
2. Stramning af `sessionStorage`-håndtering uden for trust-kritisk domænepersistens.
3. Fjernelse af død kode uden for de berørte kerneområder.

Følgende punkter skal ikke være en del af pre-production-runden:

1. Generiske capability-systemer.
2. Cross-domain calculation frameworks.
3. Audit-log/replay-infrastruktur.
4. Nye abstraktionslag, der primært tjener arkitekturel “renhed” frem for konkret korrekthed eller robusthed.
