# Systematisk kode-review og refaktorering — Mineo

Dette er arbejdsgrundlaget for et gennemgribende review af hele Mineos kodebase.
Planen er ikke en passiv audit-liste: hvert punkt skal gennemgå, rette, teste og
dokumentere den relevante del af systemet, så kode, kontrakter og tests konvergerer
mod et produktionsklart slutprodukt.

`AGENTS.md` fastlægger mandat, godkendelsesgrænser og kvalitetsgate. Ved konflikt
gælder `src/contracts/*.md` over denne plan.

## Ikke-forhandlingsbare review-principper

- Mineo er trust-kritisk og 100 % client-side. Ingen serverkommunikation,
  telemetri, ekstern logging eller dataveje ud af browseren.
- Feature-fladen er låst. Reviewet skal forenkle og konsolidere det eksisterende,
  ikke forberede hypotetiske fremtidige beregningstyper.
- UI/UX med egentlig synlig betydning og al beregningslogik forelægges brugeren,
  før den ændres. Ren struktur, typekvalitet, filplacering og testdækning afgøres
  og udføres direkte.
- Zod-schemas er eneste runtime-sandhed for persisteret input og afledte typer.
  Ingen parallel TS/Zod-sandhed og ingen persisteret brugerdata uden schema-dækning.
- Draft og committed state holdes strengt adskilt. Ingen beregning, validering
  eller afledt feedback fra `onChange`-draft.
- Save/load er atomisk, forward/backward-tolerant og må ikke give stille datatab.
  Afledte værdier gemmes ikke som brugerinput.
- Beregningsrefaktorering skal bevise tal-identitet med tests. Ændrer tallene sig,
  er det beregningslogik og kræver forelæggelse.
- Normal drift er console-tavs. Logs skal følge `error-contract.md`.
- Brugervendt tekst, kontrakter, kommentarer og docs følger sprogpolitikken i
  `AGENTS.md`.

## Arbejdsmodel

### Reviewets faser

1. **Kortlæg** scope, primære filer, direkte afhængigheder og relevante kontrakter.
2. **Læs** de relevante kontrakter før kodeændringer. Hvis en kontrakt er forkert
   eller står i vejen for bedre arkitektur, opdateres kontrakten først.
3. **Ret** fund med lavest mulig ny kompleksitet. Konsolider eksisterende mønstre
   før nye helpers eller abstraktioner oprettes.
4. **Test** efter den mindste gate der realistisk fanger fejl i ændringen.
5. **Dokumentér** fund, rettelser, testresultater og eventuelle parkerede fund i
   punktets review-fil.
6. **Opdatér** denne plan: status, udskudte fund og afsluttede godkendelsespunkter.

### Fildækning

Alle produktionsfiler i `src/`, relevante scripts/configs og normative docs skal
være dækket af mindst ét primært review-punkt. En fil må gerne inspiceres som
afhængighed flere gange, men den skal have præcis ét primært punkt hvor den tæller
som gennemgået. Punkt 14 lukker eventuelle huller.

Planen er kalibreret mod den faktiske kodebase pr. 2026-07-01: `src/` har
produktionsmapperne `apps`, `assets`, `auth`, `components`, `config`, `contexts`,
`contracts`, `data`, `document`, `docx`, `domain`, `hooks`, `pdf`, `rowDrafts`,
`schemas`, `settings`, `stores`, `styles`, `test`, `types`, `utils` og
`validators`. Root-config, `public/`, `scripts/`, `.github/`, `.husky/`,
`docs/architecture/`, `docs/domain/` og øvrige docs er også eksplicit placeret i
punkterne nedenfor. `node_modules/`, `build/` og `dist/` er genererede/eksterne
artefakter og reviewes kun som oprydnings- eller build-output-fund.

For hvert punkt dokumenteres:

- filer gennemgået som primært scope;
- filer kun læst som afhængigheder;
- filer der bevidst flyttes til et andet punkt;
- filer der er ændret, slettet, flyttet eller oprettet.

### Faste kontrolspørgsmål

Hvert punkt skal aktivt lede efter:

- korrekthedsrisici: forkerte tal, ikke-determinisme, implicitte defaults,
  render-timing, mutation og ufuldstændige state-opdateringer;
- robusthedsrisici: `undefined`, `null`, `NaN`, tomme arrays, division med 0,
  datoer udenfor interval og felter der kun er ugyldige i kombination;
- grænsebrud: UI der ejer beregningslogik, domæne der importerer UI/persistence,
  direkte storage-adgang og kontrakter der ikke matcher kode;
- typebrud: `any`, usikre assertions, `!`, Zod/TS-mismatch og persisteret input
  uden schema;
- testbrud: manglende invariant-tests, over-mocking, flakiness og tests der kun
  hævder implementeringsdetaljer;
- konvergensbrud: parallelle helpers, overlappende filer, dødkode, forældede
  kommentarer og uens mønstre for samme problem.

### Delegation

Ved brede punkter skal subagents overvejes, når den aktuelle runtime og brugerens
mandat tillader det. Delegation bruges til afgrænsede sideopgaver med klart scope,
ikke til at afgive ejerskab. Hovedtråden integrerer resultaterne, kontrollerer
kontrakt-/testkonsekvenser og opdaterer review-filen.

### Godkendelsesflow

Når et fund kræver brugerens godkendelse:

- beskriv den konkrete brugeroplevelse før og efter;
- vis hvilke tal, tekster eller flows der kan ændre sig;
- parkér fundet i "Åbne godkendelsespunkter" med punktnummer;
- fortsæt med de dele af punktet der ikke afhænger af beslutningen.

Tekniske beskrivelser må ikke være grundlaget for brugerens valg.

### Review-fil pr. punkt

Hvert punkt opretter eller opdaterer `docs/review/[punkt]-[slug].md`:

```md
# Punkt [nummer] — [navn]

**Dato:** YYYY-MM-DD
**Status:** I gang | Gennemgået | Afventer godkendelse
**Primært scope:** [filer/mapper]
**Afhængigheder læst:** [filer/mapper]
**Ikke gennemgået her:** [hvad og hvorfor]
**Tests kørt:** [kommando + resultat]

## Fund og rettelser

1. **[Severity] [Kort titel]**
   - Lokation: [fil:linje eller modul]
   - Problem: [konkret]
   - Risiko: [forkerte tal, datatab, crash, drift, vedligehold]
   - Handling: Rettet | Afventer godkendelse | Parkeret | Ikke rettet
   - Resultat: [hvad blev ændret eller hvorfor ikke]

## Tilfældighedsfund

[Samme format. Fund der hører til senere punkter registreres også i denne plan.]

## Sammenfatning

- [2-5 korte punkter]
```

Severity:

- **Kritisk:** kan give forkerte beregninger, datatab, brudte trust-invarianter
  eller data ud af browseren.
- **Høj:** type-/schema-usikkerhed, manglende validering, kontraktbrud eller
  arkitekturfejl med reel risiko.
- **Medium:** duplikering, kompleksitet, utilstrækkelige tests eller uklart ejerskab.
- **Lav:** mindre inkonsistens, navngivning, placering eller oprydning.

## Status

Statusværdier:

- `⬜ Ikke startet`
- `🟡 I gang`
- `⏸ Afventer godkendelse`
- `✅ Gennemgået`

Før reviewet begynder, etableres baseline med:

- `git status --short`
- `npm run typecheck`
- `npm run typecheck:test`
- `npm run lint`
- `npm run test`

Baseline noteres i punkt 0. Senere punkter kører den gate der er relevant efter
`AGENTS.md`; fuld suite køres ved ændringer i beregning, persistence, save/load,
delt infrastruktur eller før commit.

| Punkt | Navn | Primært formål | Status |
|---|---|---|---|
| 0 | Baseline og review-inventar | Arbejdstræ, test-baseline, filinventar, review-log-skabelon | ⬜ |
| 1 | Kontrakter og topologi | Normative kontrakter, coverage-matrix, arkitektur-docs | ⬜ |
| 2 | Kanoniske helpers og grundtyper | Dato, tal, afrunding, parser, result-typer, storage wrappers | ⬜ |
| 3 | Data og satser | Reguleringsdata, renter, løn, kapitalisering, retskilder | ⬜ |
| 4 | Schemas og persisted input | Zod-schemas, `.eo`-schema, schema-fingerprint, save-order | ⬜ |
| 5 | Persistence, load og undo | Stores, context-facader, migrations, load/apply, invalid drafts, undo/redo | ⬜ |
| 6 | Domæneberegninger | Årsløn, EET, EO, forsørgertab, varige mén, rente, snapshots | ⬜ |
| 7 | UI-inputs, tabeller og grid | StyledField, table inputs, adapters, keyboard, validation UI | ⬜ |
| 8 | Hooks og UI-state | Draft-, navigation-, PWA-, devtools- og domæne-hooks | ⬜ |
| 9 | Pages og viewmodels | Sidekomponenter, tabs, page-state, debug-viewmodels | ⬜ |
| 10 | Dokument-output | Format-neutral generator, PDF, Word, paritet, filnavne | ⬜ |
| 11 | Settings, auth og config | App settings, auth gate, config, themes, build/version | ⬜ |
| 12 | App-shell, build og multi-app | Bootstrap, public assets, build-config, device gate, MinProcesrente-isolation | ⬜ |
| 13 | Testkvalitet og quality-infra | Teststruktur, quality guards, CI/Husky, flakiness, manglende dækning | ⬜ |
| 14 | Tværgående konvergens | Filplacering, dødkode, duplikering, kontrakt-alignment, fildækningshuller | ⬜ |

## Punktdetaljer

### 0 — Baseline og review-inventar

Formål: sikre et kendt udgangspunkt og et dækkende overblik før ændringer.

Primært scope:

- `docs/review/code-review-plan.md`
- `package.json`
- `package-lock.json`
- `.nvmrc`
- test- og lint-scripts
- filinventar for `src/`, `scripts/`, `docs/`, `public/`, root-config og
  genererede artefakter

Underpunkter:

- **0.1 Arbejdstræ og baseline:** `git status --short`, eksisterende ændringer,
  baseline for typecheck/lint/test.
- **0.2 Toolchain-inventar:** `package*.json`, Node/npm-version, scripts,
  dependency-overblik uden dependency-ændringer.
- **0.3 Repo-inventar:** alle primære mapper, root-filer, generated artefacts
  (`build/`, `dist/`, `vitest-results.json`) og eventuelle uplacerede filer.
- **0.4 Review-logistik:** review-filskabelon, statusdisciplin og navngivning for
  punktfiler.

Kontroller:

- arbejdstræets tilstand uden at revert'e andres ændringer;
- baseline for typecheck, lint og tests;
- at review-output kan oprettes uden at blande sig med produktionskode;
- at alle åbenlyse review-delområder har et primært punkt.

### 1 — Kontrakter og topologi

Formål: gøre de normative kilder pålidelige, komplette og testkoblet.

Primært scope:

- `src/contracts/*.md`
- `src/contracts/contract-topology.json`
- `src/__tests__/quality/contractCoverageMatrix.test.ts`
- `docs/architecture/*.md`

Underpunkter:

- **1.1 Topologi-maskineri:** `contract-topology.json`,
  `contractCoverageMatrix.test.ts`, template og procedure.
- **1.2 Tværgående kontrakter:** form, persistence, schema-evolution, keyboard,
  error/debug, date, amount, app settings, app shell, undo/redo og dokument-output.
- **1.3 Domænekontrakter:** EO/EET/forsørgertab snapshots, årsløn, rente,
  varige mén, satser og indskudte løntillæg.
- **1.4 Page- og boundary-kontrakter:** `page-component-contract.md` og
  `domain-boundary-contract.md`.
- **1.5 Arkitektur-docs:** informative docs i `docs/architecture/` og deres
  eventuelle normative forankring.

Kontroller:

- hver kontrakt er klassificeret præcist ét sted i topologien;
- `Senest verificeret mod kode` er sandt og ikke bare opdateret;
- kontrakter beskriver ønsket arkitektur, ikke tilfældig legacy;
- kontrakthierarkiet er tydeligt ved overlap;
- informative arkitektur-docs er ikke i praksis normative uden kontraktforankring.

### 2 — Kanoniske helpers og grundtyper

Formål: sikre at fundamentale operationer har én korrekt, genbrugt implementering.

Primært scope:

- `src/utils/`
- `src/types/`
- `src/domain/dates/`

Undtaget fra primært scope her:

- persistence-/file-utils reviewes primært i punkt 5;
- table-/grid-utils reviewes primært i punkt 7;
- domænespecifik validering i `src/validators/` reviewes primært i punkt 6.

Underpunkter:

- **2.1 Dato og tid:** `src/domain/dates/`, `date*`, `isoDate*`,
  `utcDayMath`, interval- og commit-normalisering.
- **2.2 Tal og formattering:** `rounding*`, `formatUtils`, `number*`,
  `amount*`, `percent*`, `integer*`, `fraction`, parser specs.
- **2.3 Generiske typer og guards:** `result`, branded types, readonly,
  validation-/field-typer, `assertNever`, type guards og Zod-hjælpere.
- **2.4 Browser- og miljøhelpers:** `clientDevice`, clipboard, logger/debug
  wrappers, safe storage wrappers og system issue helpers.
- **2.5 Konsolidering:** overlap mellem helpers, utils og domænenære helpers.

Kontroller:

- dato-, tidszone- og intervalhåndtering følger `date-contract.md`;
- beløb, procenter, afrunding og formattering følger `amount-contract.md`;
- parsing og draft-normalisering er deterministisk og uden live preview-brud;
- storage wrappers er eneste adgang til local/session storage;
- ingen helpers overlapper eller laver smallere parallelvarianter.

### 3 — Data og satser

Formål: sikre at statiske og importerede data er komplette, auditerbare og fail-closed.

Primært scope:

- `src/data/`
- `src/config/regulatoryRates.ts`
- `src/data/indskudteLoentillaeg.ts`
- relevante import-scripts i `scripts/`
- `docs/tilfoej-overenskomst.md`
- `docs/tilfoej-kapitaliseringsbekendtgoerelse.md`

Underpunkter:

- **3.1 Renter og reguleringsrater:** `interestRates`,
  `lovbestemteRates`, `statistiskeRates`, `regulatoryRates`.
- **3.2 Ydelser og løndata:** folkepension, sygedagpenge, overenskomst, KRL,
  KL/RLTN-data, offentlig løn og importflow.
- **3.3 Kapitalisering:** bekendtgørelser, tabeller, pensionsalder-events og
  original-PDF'er som kildeartefakter.
- **3.4 Retskilder og data-docs:** `retsinfoLinks`, tilføjelsesdocs og
  sporbarhed mellem data, kilder og tests.
- **3.5 Data-tests:** grænseår, manglende data, fail-closed og casing/filstruktur.

Kontroller:

- manglende år, satser eller tabeller giver eksplicit fejl;
- retskilde-/datafiler har klart ejerskab og ingen skjulte transformationer;
- dataopslag bruger kanoniske dato- og talhelpers;
- importerede Excel/PDF-kilder er kun kildeartefakter og ikke runtime-risiko;
- tests dækker grænseår og manglende data.

### 4 — Schemas og persisted input

Formål: sikre at al gemt brugerdata har én schema-sandhed og tåler versionsskift.

Primært scope:

- `src/schemas/`
- `src/utils/schemaFingerprint.ts`
- `src/utils/tableSaveOrderRegistry.ts`
- schema-relaterede quality/tests

Underpunkter:

- **4.1 Schema-fundament:** base schemas, enum schemas, amount expression og
  shared section schemas.
- **4.2 Section-schemas:** stamdata, årsløn, satser, rente, forsørgertab,
  varige mén, erhvervsevnetab og erstatningsopgørelse.
- **4.3 `.eo`-format:** `eoFileSchema`, forward/backward tolerance,
  strictness-guards og pre-save/pre-load alignment.
- **4.4 Invalid drafts:** `invalidDraftsSchema`, recovery og schema-dækning.
- **4.5 Fingerprint og save-order:** determinisme, row order og kobling til
  persistence/tests.

Kontroller:

- Zod-schemas og afledte typer er aligned;
- gamle `.eo`-filer kan loades med så meget gyldigt input som muligt;
- nye manglende felter i gamle filer blokerer ikke load;
- ukendte/fjernede felter håndteres tolerant uden at blive runtime-state;
- `invalidDrafts` er schema-dækket og recovery-testet.

### 5 — Persistence, load og undo

Formål: fjerne datatabsrisici og sikre atomisk, auditerbar state-håndtering.

Primært scope:

- `src/stores/formPersistenceStore.ts`
- `src/stores/formPersistenceReadModel.ts`
- `src/stores/undoRedoStore.ts`
- `src/contexts/FormPersistenceContext*`
- `src/hooks/usePersistedForm.ts`
- `src/hooks/useFormPersistenceSelectors.ts`
- `src/hooks/useFileSaveLoad.ts`
- `src/hooks/useUndoRedo*.ts`
- `src/utils/file*.ts`
- `src/utils/persistence*.ts`
- `src/utils/invalidDraftsStorage.ts`
- `src/utils/encryption.ts`
- `src/types/persistence*.ts`
- `src/types/file*.ts`

Underpunkter:

- **5.1 Persistence-store og read model:** source of truth, selectors,
  immutable updates og committed-state invariants.
- **5.2 Context-facade:** `FormPersistenceContext*` og tilladte importveje.
- **5.3 Save/load og file access:** file helpers, metadata, handles,
  kryptering, preflight, apply, rollback og round-trip.
- **5.4 Hydration og migrations:** session hydration, migrations,
  load-sanitization, null/undefined-håndtering og schema-evolution-grænser.
- **5.5 Invalid drafts:** storage, reconcile og bevaring uden at blive
  beregningsinput.
- **5.6 Undo/redo og fokus:** store, shortcuts, focus restore, editor guards og
  navigation guards.

Kontroller:

- kun de kanoniske persistence-hooks bruges på rette niveau;
- load preflight muterer ikke in-memory state før brugerbeslutning;
- apply-fejl bevarer eksisterende state;
- save indeholder kun schema-valideret brugerinput;
- undo/redo gendanner fokus uden at mutere input implicit;
- filhåndtering og kryptering holder data i browseren.

### 6 — Domæneberegninger

Formål: sikre korrekte, deterministiske beregninger uden UI- eller persistence-læk.

Primært scope:

- `src/domain/`
- domænenære beregningshooks hvor de reelt ejer domæneflow
- snapshot-/canonical-/presentation-lag
- `src/validators/erstatningsopgoerelseValidator.ts`
- `docs/domain/`

Underpunkter:

- **6.1 Fælles domænefundament:** policies, stamdata, satser,
  ASL/EAL-årsløn og domænedatoer hvor de er beregningsregler.
- **6.2 Årsløn og SH-dage:** `aarsloen`, `aslEalAarsloen`,
  fravær/SH-regler, gates og dokumenterede domæneregler.
- **6.3 Erhvervsevnetab:** EAL/ASL, kapitalisering, løbende ydelser,
  differencekrav, regulering og issue-navigation.
- **6.4 Erstatningsopgørelse:** engines, helpers, tables, validation,
  control-lag, snapshot, canonical output og presentation.
- **6.5 EO row evaluation og debug:** row builders, severity, navigation,
  parity og debug-viewmodels uden at debug bliver domænesandhed.
- **6.6 Øvrige domæner:** forsørgertab, varige mén og renteberegning.
- **6.7 Domænedocs:** `docs/domain/` skal matche kontrakter og implementering
  uden at ændre beregningsregler uden godkendelse.

Kontroller:

- beregningslag importerer ikke UI eller persistence;
- samme beregningsmotor bruges af beregning, validering og output;
- fail-closed-stier er testet;
- afrunding og formattering er ikke inline;
- snapshots er stabile, komplette og kontraktstyrede;
- refaktoreringer beviser tal-identitet.

### 7 — UI-inputs, tabeller og grid

Formål: sikre ensartet inputadfærd, valideringsvisning og keyboard-navigation.

Primært scope:

- `src/components/inputs/`
- `src/components/tables/`
- `src/hooks/tableInput/`
- `src/utils/table*.ts`
- `src/rowDrafts/`

Underpunkter:

- **7.1 StyledField-familien:** tekst, dato, beløb, procent, brøk, integer,
  år, uge, dropdown og toggle.
- **7.2 Table-inputs og adapters:** table input core, adapters, commit,
  escape/cancel, delete/backspace og invalid draft channel.
- **7.3 Grid core:** grid controller, keyboard-navigation, row ids,
  focus/selection og virtualization.
- **7.4 Tabelkomponenter:** TAF, offentlige ydelser, øvrige krav, løn,
  rentekrav, sortering, delete og save-order registration.
- **7.5 Row drafts og validerings-UI:** draft lifecycle, tooltip-fejl,
  range/dato-fejl og ingen inline-fejltekst.

Kontroller:

- commit sker kun på de godkendte grænser;
- ugyldigt input vises med rød kant og tooltip, ikke inline tekst;
- dropdown/toggle/delete-undtagelser følger formkontrakten;
- keyboard-navigation følger `keyboard-navigation.md`;
- table adapters deler parsing/validering med schemas/helpers.

### 8 — Hooks og UI-state

Formål: sikre at hooks har klart ejerskab og ikke skjuler state-mutation.

Primært scope:

- `src/hooks/` undtagen table-inputs og persistence/file/undo-hooks der
  primært dækkes i punkt 5
- `src/contexts/` der ikke allerede er dækket af persistence/settings

Underpunkter:

- **8.1 Form- og draft-hooks:** `useDraftField`, `useFormFieldErrors`,
  `useTwoStageInputActivation`, `useStyledFieldAdapter`.
- **8.2 Navigation- og interaktionshooks:** persisted active tab,
  unsaved-changes guard, scroll/shake helpers og route/scroll contexts.
- **8.3 PWA/devtools-hooks:** launch queue, installed display mode og
  devtools monitoring.
- **8.4 Domæne-hooks:** årsløn, ASL-årsløn reporter, document gates,
  omregning toggle, forligsansvarsgrad og midlertidigt EET insert source.
- **8.5 Context-afgrænsning:** AppSettings/FormPersistence-contexts kun hvor
  punkt 5/11 ikke allerede ejer det primære review.

Kontroller:

- hooks returnerer stabile, forståelige kontrakter;
- effekter er idempotente og overskriver ikke brugerinput;
- domæne-hooks lækker ikke UI-beslutninger ind i beregningslaget;
- file/PWA/devtools-hooks følger client-side og console-politikken.

### 9 — Pages og viewmodels

Formål: sikre at sidekomponenter er tynde, stabile og ensartede.

Primært scope:

- `src/components/pages/`
- page-lokale viewmodels, contexts og sections
- `src/components/pages/minprocesrente/`

Underpunkter:

- **9.1 Hovedsider:** Stamdata, Årsløn, Satser, Mineo, Indstillinger,
  og tværgående sideflow.
- **9.2 Erhvervsevnetab:** Oplysninger, Efter EAL, kapitalisering,
  løbende ydelser, differencekrav, issues og hover rows.
- **9.3 Erstatningsopgørelse input:** lønindkomst, offentlige ydelser,
  EO-oplysninger, sections, field commit handlers og løntrinsfinder.
- **9.4 Erstatningsopgørelse beregning/debug:** EOberegning, EO-debug,
  rows/grouped rows, employment/loen/regulation sections og debug refresh.
- **9.5 Øvrige beregningssider:** forsørgertab, varige mén, renteberegning
  og MinProcesrente calculator page.

Kontroller:

- pages bruger `usePersistedForm` eller selectors efter kontrakten;
- ingen afledt feedback fra draft-state;
- sync-effekter overskriver ikke committed input;
- store komponenter opdeles kun når det reducerer faktisk kompleksitet;
- debug-visninger må ikke blive domænesandhed.

Særligt fokus:

- `LoenindkomstTab.tsx`
- `EOOplysningerTab.tsx`
- EO-debug-komponenter
- Erhvervsevnetab-tabs

### 10 — Dokument-output

Formål: sikre at PDF og Word er to outputs fra samme format-neutrale indhold.

Primært scope:

- `src/document/`
- `src/pdf/`
- `src/docx/`
- `src/components/reports/`
- dokumentrelaterede tests i `src/__tests__/document/` og `src/__tests__/docx/`

Underpunkter:

- **10.1 Format-neutral kerne:** `documentFormat`,
  `documentGenerationContext`, writer-router, service og loader.
- **10.2 Layout og writer-infrastruktur:** layout helpers, table bridge,
  brevhoved, footer image, date guard, PDF writer/adapter og DOCX writer/styles.
- **10.3 EO-generatorer:** erstatningsopgørelse, regulering, bilag/sections
  og paritet med canonical output.
- **10.4 EET- og differencekrav-generatorer:** EET, efter EAL,
  kapitalisering, løbende ydelser og differencekrav.
- **10.5 Øvrige generatorer:** årsløn, SH-dage, satser, varige mén,
  forsørgertab, rente, KRL, KL-lønaftaler og TAF-fordelt/graf/opreguleret.
- **10.6 Download-/rapport-UI:** report dialog, artifact download,
  committed-state gates og filnavne.
- **10.7 Paritetstests:** Word/PDF content harness, document tests og
  legacy-stier der skal afvikles.

Kontroller:

- generatorer skriver mod `DocumentWriter`-grænsefladen;
- PDF og Word har paritet for indhold, rækkefølge, tal og udeladelser;
- dokumenter bruger committed state og domænesnapshots;
- filnavne og datoformater følger kontrakter;
- legacy- eller duplikerede PDF/Word-stier fjernes når de ikke længere er autoritative.

### 11 — Settings, auth og config

Formål: sikre at lokale indstillinger, adgangsgate og config er isolerede og testbare.

Primært scope:

- `src/settings/`
- `src/auth/`
- `src/config/`
- `src/contexts/AppSettingsContext*`

Underpunkter:

- **11.1 App settings:** schema, parse, storage, context og device-lokal
  isolation fra `.eo`.
- **11.2 Auth gate:** auth, auth config, AuthGate/LoginPage og contract guards.
- **11.3 Beregnings-/app-config:** date ranges, page navigation,
  persistence registry/version, storage manifest, invalid draft scopes og
  scroll config.
- **11.4 Tema og build-info:** app theme, table theme, generated build info og
  version.
- **11.5 Config-tests:** drift-tests og guards for settings/auth/config.

Kontroller:

- app settings er device-lokale og ikke `.eo`-brugerinput;
- auth gate følger sin kontrakt uden at blande forretningslogik ind;
- config-filer har klart ansvar og ingen afledt runtime-state der bør beregnes;
- build/version-info genereres via eksisterende scripts.

### 12 — App-shell, build og multi-app

Formål: sikre korrekt bootstrap, device gate, build-output og namespace-isolation.

Primært scope:

- `src/main.tsx`
- `src/App.tsx`
- `src/apps/`
- `src/components/layout/`
- `src/components/system/`
- `src/components/ui/`
- `src/components/errors/`
- `src/components/common/`
- `src/components/shared/`
- `src/index.css`
- `src/styles/`
- `src/assets/`
- `src/vite-env.d.ts`
- `public/`
- HTML-entrypoints og Vite/Wrangler-config

Underpunkter:

- **12.1 App-entry og bootstrap:** `main.tsx`, `App.tsx`,
  `bootstrapClientApp`, service worker bootstrap og default routes.
- **12.2 Capability gate:** unsupported device page, client device detection,
  desktop-only-regel og MinProcesrente-undtagelse.
- **12.3 Layout og fælles UI-skal:** MainLayout, Container, SideMenu,
  ContentBox, standalone layout, footer, modals, overlays, tooltips og
  error boundaries.
- **12.4 Public assets og PWA:** `public/`, icons, manifest, `_headers`,
  `sw.js`, faviconer, robots og asset-licenser.
- **12.5 Build/deploy config:** `vite*.config.ts`, HTML-entrypoints,
  `wrangler*.json`, `tsconfig*.json`, `eslint.config.js`,
  `scripts/generate-build-info.mjs`, `scripts/ensure-build-index.mjs`,
  `scripts/cleanup-minprocesrente-public.mjs`, `scripts/generate-pwa-icons.js`
  og `scripts/dev-with-browser.mjs` hvor de påvirker app-shell/build.
- **12.6 Multi-app isolation:** Mineo vs. standalone MinProcesrente,
  namespace-isolation og shared app-infrastruktur.

Kontroller:

- desktop-only gate ligger øverst i `bootstrapClientApp`;
- Mineo og MinProcesrente deler kun bevidst infrastruktur;
- storage namespaces er isolerede;
- mobil/tablet-styling er kun i tilladte filer;
- service worker/PWA-bootstrap ændrer ikke persistence-invarianter.

### 13 — Testkvalitet og quality-infra

Formål: gøre tests til invariant-beskyttelse, ikke implementation snapshots.

Primært scope:

- `src/__tests__/`
- `src/test/`
- test-utils og setup
- `.github/workflows/`
- `.husky/`
- quality-/script-tests
- `scripts/check-mojibake.mjs`
- `scripts/check-filename-case.mjs`

Underpunkter:

- **13.1 Domænetests:** årsløn, EET, EO, EO row evaluation/debug,
  forsørgertab, varige mén, rente, data og calculations.
- **13.2 Persistence/schema/file-tests:** schemas, stores, contexts,
  invalid drafts, migrations, file round-trip og storage guards.
- **13.3 UI-tests:** inputs, table inputs, pages, layout, apps og auth/settings.
- **13.4 Dokument-output-tests:** document, PDF, DOCX og Word content harness.
- **13.5 Quality guards:** contract coverage, boundary isolation, storage
  isolation, rounding, date, document artifacts, mojibake og filename casing.
- **13.6 Test-infra og CI:** `src/test`, test utils, Vitest config via
  package scripts, GitHub Actions og Husky pre-commit.

Kontroller:

- kritiske beregninger, validering og save/load har meningsfulde tests;
- quality guards dækker kontrakter uden falsk tryghed;
- ingen flade top-level `it(...)`-testfiler;
- tests undgår over-mocking og kode der kun findes for testens skyld;
- manglende tests oprettes i de områder reviewet har berørt.

### 14 — Tværgående konvergens

Formål: lukke hele reviewet ved at fjerne resterende drift og dokumentere endelig tilstand.

Primært scope:

- hele repoet
- denne plan og alle punkt-review-filer
- root-dokumentation: `README.md`, `CLAUDE.md`, `AGENTS.md` som reference,
  `LICENSE`, `.editorconfig`, `.gitattributes`, `.gitignore`
- `docs/implementation/` og øvrige docs der ikke er primært dækket tidligere

Underpunkter:

- **14.1 Fuld fildækningsmatrix:** alle ikke-genererede filer har et primært
  review-punkt; ingen mappe er kun implicit dækket.
- **14.2 Kontrakt- og docs-alignment:** kontrakter, arkitektur-docs,
  domænedocs, README og implementeringsdocs stemmer med kode.
- **14.3 Kodekonvergens:** duplikering, parallelle helpers, filplacering,
  dødkode, ubrugte exports og stale kommentarer.
- **14.4 Build-/artefakt-oprydning:** generated files, resultater,
  dist/build-status og repo-hygiejne uden at slette ukendte brugerændringer.
- **14.5 Endelig gate:** relevant fuld kvalitetsgate, åbne godkendelser,
  udskudte fund og review-sammenfatning.

Kontroller:

- alle produktionsfiler er dækket af mindst ét primært punkt;
- kontrakter, arkitektur-docs og implementering er i sync;
- duplikerede helpers, død kode og forældede exports er fjernet;
- filplacering og navngivning følger repoets kanoniske struktur;
- alle udskudte fund er enten rettet, godkendelsesparkeret eller eksplicit lukket.

## Åbne godkendelsespunkter

Ingen åbne godkendelsespunkter pt.

Nye punkter registreres her, når reviewet finder en ændring der kræver brugerens
beslutning. De må ikke lukkes teknisk uden brugerens beslutning.

### Ratificerede godkendelsespunkter (besluttet + implementeret + verificeret)

Følgende punkter var overført fra tidligere arbejde. Ved review 2026-07-01 blev de
verificeret som fuldt implementeret og testdækket, forelagt som konkret
brugeroplevelse og ratificeret af brugeren. De er ikke længere udestående.

| ID | Punkt | Emne | Verificeret tilstand |
|---|---|---|---|
| G1 | 10 | PDF/Word: "TAF opreguleret til beregningsår" | Download-dokument implementeret; metode = akkumuleret reguleringssats til beregningsår (år fra *opgørelse lavet den*); delta vist med 4 decimaler, beløb i hele kr., sum-diff >1 kr. blokerer; fail-closed ved manglende sats. |
| G2 | 10 | EO-output med Ja/Nej/Skjul og afslutningsvalg | Ja = medregnes+vises; Nej = vises som "Ingen", ikke medregnet; Skjul = sektion fjernet, ikke medregnet (Nej/Skjul beregner identisk). Afslutningsvalg: Bekræftet godkendt / Underskrift-linje / Ingen. |
| G3 | 11 | Indstillinger: "Beregningsteknisk" | Device-lokale kontroller (localStorage, ikke .eo); ændrer kun valideringsstrenghed (rød fejl vs. gul advarsel), ikke tal. Brugergodkendt 2026-06-19 jf. `app-settings.md`. |
| G4 | 3 | Sygedagpenge OP/ATP-model | Tre-leds pr. satsår (sats + kommunal ATP + OP) i én samlet tabel; OP = 0 % før 6-1-2020; afrunding pr. uge. |

## Udskudte fund

Fund der hører til et senere punkt registreres her straks og fjernes først, når
punktets review-fil dokumenterer den endelige handling.

| ID | Fundet i punkt | Behandles i punkt | Fund | Status |
|---|---|---|---|---|
| - | - | - | Ingen registreret endnu. | - |

## Kvalitetsgate

Vælg det smalleste relevante tjek efter ændringens risikoflade:

- doc-only uden scripts/config: ingen tjek nødvendige;
- kontrakt/topologi: relevant quality-test, ofte `contractCoverageMatrix.test.ts`;
- kildekode i `src/`: `npm run typecheck`;
- tests ændret: `npm run typecheck:test`;
- kode/scripts/config/tests med lint-risiko: `npm run lint`;
- beregning, validering, save/load, persistence eller delt infrastruktur:
  målrettede tests plus `npm run test` når påvirkningen kan være bred;
- build/app-entry/Vite/assets/dependencies: relevant build-kommando.

Før commit gælder rækkefølgen fra `AGENTS.md`: typecheck, typecheck:test, lint,
relevant testniveau. Der committes kun på eksplicit besked.

## Afslutningskrav for hvert punkt

Et punkt kan kun markeres `✅ Gennemgået`, når:

- primært scope er dokumenteret;
- alle fund er rettet, parkeret i denne plan eller eksplicit lukket;
- relevante kontrakter er opdateret eller bekræftet;
- relevante tests er kørt og resultatet er noteret;
- ingen kendt ændring kræver brugerens godkendelse uden at stå i
  "Åbne godkendelsespunkter";
- statustabellen i denne plan er opdateret.
