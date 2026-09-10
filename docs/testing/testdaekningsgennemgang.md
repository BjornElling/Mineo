# Testdækningsgennemgang – køreplan og auditspor

Denne køreplan bruges til en afgrænset, fuld gennemgang af Mineos testdækning. Den er et arbejdsdokument:
udfyld felterne løbende, knyt al evidens til den konkrete revision, og luk ikke en række med et skøn.

Målet er den stærkest mulige dokumenterede sikkerhed for, at den gennemgåede revision har meningsfulde,
effektive og vedligeholdbare tests for al relevant observerbar adfærd og alle trust-kritiske invarianter.
Ingen endelig testgennemgang kan give en bogstavelig garanti mod ukendte fejl, nye browserversioner eller
senere kodeændringer. Den kan derimod give en auditerbar konklusion: *alle identificerede forpligtelser,
flader og fejlmåder i den fastlåste revision er kortlagt, prøvet med passende uafhængige metoder, og alle
bevidste rester er accepteret og registreret.* En ændring efter auditten gør de berørte rækker åbne igen.

Denne plan er en test-audit, ikke en produktændring. Fund, der ændrer brugeroplevelse, beregningslogik eller
persistensadfærd, forelægges udvikleren efter reglerne i `AGENTS.md`, før de implementeres.

## Sådan bruges dokumentet

1. Fastlås først scope og revisions-ID i [auditstart](#0-auditstart-og-ramme). En audit uden et fastlåst
   grundlag kan ikke afsluttes.
2. Byg inventaret før der vurderes tests. Hver kodeflade, kontraktforpligtelse og brugerrejse skal have et
   stabilt ID og en ejer-række i registeret.
3. Gennemgå én flade ad gangen efter tjekskemaet. Et grønt testresultat er kun evidens, når det fremgår,
   hvilken risiko og hvilken konkret modfejl testen ville opdage.
4. Registrér ethvert hul, svagt værn, flakiness-fund og produktfund i fundregisteret. Ret og genprøv, eller
   markér det eksplicit som accepteret rest-risiko med begrundelse og ansvarlig afgørelse.
5. Udfør tværgående kontrol, mutationsprøver og slutreproduktion. Først når samtlige obligatoriske rækker
   er lukket, kan auditten konkluderes.

### Arbejdsrytme og commitregel

Efter hver gennemført, afgrænset arbejdsenhed – det vil sige, når Codex giver udvikleren besked om, at et
konkret punkt er gennemført – verificeres resultatet, og alle ændringer i working tree committes. Committen
skal ske, før næste arbejdsenhed påbegyndes. Reglen gælder også test-, fixture- og dokumentationsændringer.
Der pushes aldrig fra auditten.

**Statusværdier:** `Ikke startet` · `I gang` · `Blokeret` · `Bestået` · `Bestået med rest-risiko` · `Ikke
relevant`. Brug kun `Ikke relevant`, når begrundelsen og den undersøgte flade står i rækken. Brug aldrig
`Bestået med rest-risiko` for en kritisk sti uden udviklerens udtrykkelige accept.

## 0. Auditstart og ramme

| Felt | Udfyldes ved start |
| --- | --- |
| Audit-ID og ansvarlig | `TD-AUDIT-2026-09-10-01` – Codex udfører gennemgangen; Bjørn er udvikler og godkender ændringer inden for UI/UX, beregning og persistens. |
| Startdato / slutdato | Start: 2026-09-10 Europe/Copenhagen. Slutdato: ikke fastlagt. |
| Git-commit, branch og `git status --short` | `1389d93c1e8d78f6381cd1cec83bedc40b4f6a48`, `main`. Ved start: `?? docs/testing/testdaekningsgennemgang.md`. |
| Node-, npm-, OS- og browserversioner | Node `v24.18.0`, npm `11.16.0`, Windows NT `10.0.26200.0`. Playwright-browsere: Chrome for Testing `153.0.8010.12`, Firefox `155.0`, WebKit `26.6`. |
| Installerede testværktøjer og versioner | Vitest `5.0.0`, `@vitest/coverage-v8` `5.0.0`, `@playwright/test` `1.63.0`, Playwright CLI `0.1.18`, Playwright MCP `0.0.79`. CLI'en rapporterede versionsuoverensstemmelse med projektets lokale skill og afsluttede desuden med en Node assertion-fejl; værktøjsforholdet er ikke triageret endnu. |
| Aktive contracts fra `src/contracts/contract-topology.json` | `page-component-contract` samt 21 cross-cutting contracts og 8 domain contracts. De 8 informative arkitekturdokumenter registreres som forventningsgrundlag, ikke som contracts. |
| Produktflade i scope, herunder Mineo og MinProcesrente | Hele den offentliggjorte Mineo-flade, standalone MinProcesrente, delt input-/state-/persistence-/history-infrastruktur, dokumenter, dataregistre, bootstrap-/browsergates, kvalitetstests, release-/buildscripts og relevante browser-/viewportrejser. |
| Uden for scope og begrundelse | Ingen identificeret produktflade er udeladt. Auditten vurderer ikke, om juridiske/domænemæssige regler er korrekte; den vurderer, om implementeringen er dækket af de angivne regler og kontrakter. Nye features er ikke i scope. |
| Baseline: antal kildefiler, testfiler, tests, E2E-specs og mutationsscore | 923 produktionsfiler (`.ts/.tsx`), 638 testfiler i alt (635 Vitest-filer og 3 type-testfiler), 8.421 Vitest-tests, 36 E2E-specs, 174 E2E-tests. Mutationsscore: ikke tilgængelig – ingen mutationsrunner er registreret i `package.json`. |
| Baseline: `test:coverage`-rapport og de dækkede/udeladte mapper | `coverage/` fra committen: 396 instrumenterede filer i `src/domain`, `src/utils`, `src/hooks` og `src/contexts`; 88,71 % statements, 79,92 % branches, 91,65 % functions, 91,52 % lines. Coverage-konfigurationen omfatter ikke de øvrige 527 produktionsfiler; de skal klassificeres i inventaret. |
| Kendte åbne test- eller kvalitetsfund ved start | Baselinekørslerne er grønne. Observationer til senere triage: Vite-advarslen om `configLoader: 'native'`, build-advarslen om chunks over 750 kB, svagere maskine med 3 workers, Playwright CLI/skill-uoverensstemmelsen og manglende mutationsrunner. Ingen af observationerne er endnu klassificeret som produktfund. |

### Indgangskrav

- [ ] Arbejdstræet er dokumenteret. Urelaterede lokale ændringer er enten uden for audit-scope eller
  indgår tydeligt i den revision, der undersøges.
- [ ] Alle genererede build-oplysninger er friske, og afhængighedstræet er reproducerbart fra lockfilen.
- [ ] Den normale Vitest-suite, typechecks og lint er kørt én gang som baseline. Fejl er registreret som
  fund, ikke skjult ved at springe tests over.
- [ ] E2E-banesuiten er kørt som baseline. En fuld browser-/viewportmatrix planlægges kun for flader, hvor
  motor eller viewport er en observerbar risiko, og igen ved afslutning.
- [ ] Der er oprettet et separat auditspor for kommandooutput, coverage-rapporter, mutationer, screenshots,
  traces og fixtures. Artefakter må ikke indeholde rigtige person- eller sagsdata.

## 1. Principper for bevis

En test tæller kun som dækning, når alle punkter er opfyldt:

- Den beskytter en konkret kontrakt, domæneregel, brugerhandling, fejltilstand eller arkitekturgrænse.
- Den ville blive rød ved mindst én realistisk fejl i den beskyttede mekanisme. Vis dette med automatiseret
  mutation, en kontrolleret manuel modprøve eller et andet direkte modbevis.
- Dens fixture kan skelne den forventede regel fra nærliggende, men forkerte regler. Et taleksempel, hvor to
  formler tilfældigvis giver samme resultat, er ikke bevis.
- Assertionen kontrollerer det observerbare resultat eller en nødvendig invariant, ikke en privat
  implementeringsdetalje, mock-kald eller tilfældig markup.
- Den er deterministisk, isoleret og reproducerbar. Tid, tidszone, netværk, rækkefølge, browser, storage og
  tilfældighed er enten kontrolleret eller udtrykkeligt prøvet som en variabel.
- Det fremgår, hvorfor testniveauet er det rigtige: unit for ren regel, integration for samspil og grænser,
  E2E for reel brugerrejse/browseradfærd og statisk værn for arkitektur.

V8-procenter bruges til at finde ikke-udført kode og døde grene. De må hverken lukke en række alene eller
bruges som mål for en test af kvalitet. Den nuværende coverage-konfiguration omfatter kun udvalgte mapper;
auditten skal derfor registrere både hele kildefladen og den instrumenterede del, så en udelukkelse ikke
forveksles med dækket kode.

## 2. Inventar – ingen flade uden ejer

Opret én række per meningsfuld testbar flade. En flade kan være en beregningsengine, et schema, en
persistensoperation, en side/rejse, en dokumentgenerator, en arkitekturgrænse eller et build-/runtimeværn.
En fil kan have flere rækker, hvis den rummer uafhængige regler. Lav ikke én række per triviel funktion.

Nedenstående er auditens første makroinventar. Det er med vilje opdelt efter risiko og observerbar
adfærd, ikke efter hver enkelt fil. Rækkerne er oprettet ud fra de levende route-, persistence-,
consumer-, dokument- og arkitekturregistre samt testfilernes placering. `I gang` betyder, at fladen er
fundet og afgrænset, ikke at dens tests endnu er kvalitetsrevideret.

| ID | Flade / kilde | Risiko og hvis-fejl-sker | Autoritativ kilde | Testniveau(er) | Eksisterende tests | Evidens | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH-001 | Kontrakt-topologi og kontraktdækningsmatrix – `src/contracts/contract-topology.json`, `src/__tests__/quality/contractCoverageMatrix.test.ts` | En aktiv kontrakt kan ændres uden koblet testspor eller blive glemt i topologien. | `contract-topology.json`, de enkelte contracts | statisk/unit | `quality/contractCoverageMatrix.test.ts`, `quality/contractReferenceLiveness.test.ts` | Baseline grøn; semantisk gennemgang af hver paragraf mangler. | I gang |
| ARCH-002 | Arkitekturharness og domæne-/sidegrænser – `src/__tests__/quality/architecture/**`, `src/__tests__/quality/domainBoundaryIsolation.test.ts` | En parallel write-model, ulovlig import eller død regel kan give skjult datadrift. | `domain-boundary-contract.md`, `page-component-contract.md`, arkitekturdokumenter | statisk/unit | `architectureRules.test.ts`, `deletedLegacyAbsence.test.ts`, `domainBoundaryIsolation.test.ts`, `eetDomainIsolation.test.ts`, `consumerInventory.test.ts` | Registry-completeness er tilføjet med en separat forventningsliste på 88 regel-ID'er; `architectureRules.test.ts` bestod med 186 tests. De enkelte reglers modfejl, importgrænser og øvrige liveness er ikke fuldt triageret. | I gang |
| ARCH-003 | Kvalitets-, sprog-, dependency- og releaseværn – `src/__tests__/quality/**`, `scripts/**`, `.github/workflows/**` | Et grønt værn kan være dødt, omgåeligt eller ikke kørt i releaseforløbet. | `AGENTS.md`, release-scripts og de relevante contracts | statisk/unit/CI | `acceptanceMatrix.test.ts`, `testNamingConvention.test.ts`, `packageManifestCheck.test.ts`, `toolIsolationCheck.test.ts`, `vulnerabilityCheckRetry.test.ts` | `check:mojibake` bestået; øvrige releaseværn er ikke baselinekørt samlet. | I gang |
| SHELL-001 | Auth, bootstrap, routing og hovedapp-shell – `src/main.tsx`, `src/App.tsx`, `src/config/pageNavigation.ts`, `src/components/layout/**` | Brugeren kan blive afvist forkert, lande på forkert side, miste shell-state eller navigere før lazy mount. | `auth-gate-contract.md`, `app-shell-contract.md`, `page-component-contract.md` | unit/integration/E2E | `auth/**`, `App.appShell.test.tsx`, `App.defaultLandingRoute.test.tsx`, `components/layout/**`, `e2e/mineo-smoke.spec.ts`, `e2e/shell-shortcuts-and-not-found.spec.ts` | 11 app-routes er fundet i det autoritative katalog; E2E-baseline grøn. | I gang |
| SHELL-002 | System- og browsergates – `UnsupportedDevicePage`, `PageNotFound`, `OpenEo`, PWA/service worker og preload-recovery | Mobil/tablet kan få adgang til appen, 404 kan ændre sagen, eller PWA-/lazy-load-flow kan fejle. | `app-shell-contract.md`, PWA-/auth-dokumentation | unit/integration/E2E | `apps/shared/**`, `apps/mineo/**`, `components/system/**`, `schemas/pwaFileOpenRequestSchema.test.ts`, `e2e/pwa-*.spec.ts`, `e2e/shell-shortcuts-and-not-found.spec.ts` | E2E-baseline grøn med dedikeret service-worker-, WebKit- og Firefox-fallback-projekt. | I gang |
| INPUT-001 | Input-aggregate, feltadresser, catalog og editor/settle-engine – `src/inputCore/**` | Draft kan nå beregning/save, rejected tekst kan sameksistere med canonical, eller input kan forsvinde ved sync. | `form-contract.md`, `input-field-behavior-contract.md`, `amount-contract.md` | unit/integration | `inputCore/inputCore.test.ts`, `inputCore/editor/fieldEditor.test.ts`, `inputCore/runtime/dispatchInput.test.ts`, `inputCore/runtime/commandInvariants.test.ts`, `inputCore/runtime/inputReferenceControl.test.ts`, `inputCore/stateChains.test.ts` | Acceptance-registret kobler kerneinvarianter til leaf-tests. En kontrolleret mutation af no-op-gaten gav 51 fejl i 146 runtime-tests; den gendannede kode bestod 103/103 i kontrolkørslen. En separat reference-model bestod settle/no-op/undo/redo/ny-gren-forløbet med 1/1 test. Fuld testkvalitetsrevision mangler. | I gang |
| INPUT-002 | Form-, grid-, tabel- og keyboard-adaptere – `src/inputCore/react/**`, `src/components/tables/**` | Form og tabel kan få forskellig settle-, fokus-, undo- eller issue-adfærd. | `form-contract.md`, `keyboard-navigation.md`, `mineo-field-pattern.md`, `undo-redo-contract.md` | integration/E2E | `inputCore/react/fieldContract.surfaces.test.tsx`, `useFormFieldSurface.test.tsx`, `gridAdapter.test.tsx`, `historyRestoreTarget.test.tsx`, `components/tables/tableKeyboardNavigation.*`, `e2e/satser-tab-settle.spec.ts` | E2E-baseline grøn; browserafhængige keyboardflader er tagget. | I gang |
| VALID-001 | Zod-schemas, parsing, normalisering og domænevalidering – `src/schemas/**`, `src/validators/**`, `src/utils/*Validation*` | Ugyldige data accepteres, fejlstrukturen peger forkert, eller schema/type og runtime adskilles. | `schema-evolution.md`, `error-contract.md`, input-/date-/amount-contracts | unit/integration | `schemas/**`, `utils/inputValidation.test.ts`, `utils/zodIssueFormatting.test.ts`, `validators/erstatningsopgoerelseValidator.test.ts` | Baseline grøn; partitioner og uafhængige modcases skal gennemgås. | I gang |
| PERSIST-001 | `.eo`-schema, codec, save/load, migrering, preflight og atomisk apply – `src/persistence/**`, `src/utils/file*.ts` | Sagsdata kan gå tabt, gammel fil kan blive ulæselig, eller afvisning kan mutere aktiv sag. | `persistence-contract.md`, `schema-evolution.md` | unit/integration/E2E | `persistence/**`, `utils/eoFileCodec.test.ts`, `fileRoundTrip.fullState.test.ts`, `persistenceMigrations.test.ts`, `fileLoad.normalLoad.test.ts`, `utils/historicalEoFixtures.test.ts`, `e2e/file-load-validation.spec.ts` | 25 filer og 238 tests bestået, heraf 5 tests med krypterede, genskabte `.eo`-bytes gennem den faktiske loadgrænse. Der findes fortsat ingen `.eo`-artefakter fra faktiske tidligere udgivelser; den uafhængige struktursammenligning mangler. | I gang |
| PERSIST-002 | Browserlagre, settings, filhåndtag og sessionbevaring – `src/settings/**`, `src/utils/*Storage*`, `src/hooks/useFileSaveLoad.ts` | Reload, storage-fejl eller filkapabilitetsmangel kan nulstille input eller skjule fejl. | `persistence-contract.md`, `app-settings.md`, `app-shell-contract.md` | unit/integration/E2E | `settings/**`, `utils/safe*Storage.test.ts`, `fileHandleStorage.test.ts`, `hooks/useFileSaveLoad.test.tsx`, `hooks/usePersistedActiveTab.test.tsx`, PWA-E2E | Baseline grøn; browserens storage-/filfejlveje mangler fuld audit. | I gang |
| DATE-001 | Dato-, periode-, afrundings- og pengebasis – `src/domain/dates/**`, `src/domain/money/**`, `src/utils/{date*,rounding*,fraction*}` | Off-by-one, forkert tidszone, enhed eller afrunding ændrer beløb, perioder eller gate. | `date-contract.md`, `periodisering-contract.md`, `amount-contract.md` | unit/integration | `domain/dates/**`, `domain/money/**`, `utils/date*.test.ts`, `utils/rounding*.test.ts`, `utils/fraction.test.ts`, `utils/utcDayMath.test.ts` | Money-fladen er mutationstestet med 56/58 dræbte mutationer. Dato-/SH-suiten er styrket til 105 grønne tests med præcise range-fejl og eksakt 2024-facit. Uafhængig håndregning mangler, og `TD-003` står åbent for ugyldige `Date`-instanser i `utcDayMath`. | I gang |
| DATA-001 | Satser, reguleringer og data-/coverage-kataloger – `src/data/**`, `src/data/catalog/**` | Manglende, overlappende eller forkert gyldighedsdata giver forkert opslag eller skjult beregningshul. | `calculation-data-contract.md`, domænecontracts | unit/statisk/integration | `data/**`, `data/calculationDataCatalog.test.ts`, `data/rateSeriesIntegrity.test.ts`, `quality/consumerInventory.test.ts` | Coverage-baseline med 396 filer; komplethed og historiske endepunkter skal gennemgås rækkevis. | I gang |
| CALC-001 | Satser og fælles beregningsdata – `src/domain/satser/**` | Forkert satsår eller kildedata giver forkert visning og downstream-resultat. | `satser-contract.md`, `calculation-data-contract.md` | unit/integration/E2E | `domain/satser/**`, `domain/calculations/satserCalculations.test.ts`, `components/pages/Satser.downloadGate.integration.test.tsx`, `e2e/satser-tab-settle.spec.ts` | 1 calculation-entrypoint og 1 dokumentdefinition er registreret; semantisk audit mangler. | I gang |
| CALC-002 | Årslønsberegning – `src/domain/aarsloen/**`, `src/components/pages/Aarsloen.tsx` | Forkert periodisering, tillæg, ferie/fravær eller rækkesum ændrer årsløn og dokument. | `aarsloen-contract.md`, `periodisering-contract.md`, `amount-contract.md` | unit/integration/E2E | `domain/aarsloen/**`, `components/pages/Aarsloen.integration.test.tsx`, `e2e/download-tooltip-classes.spec.ts` | Calculation-entrypoint og to dokumentoutputs er registreret; grænser og uafhængig efterregning mangler. | I gang |
| CALC-003 | Renteberegning – `src/domain/renteberegning/**`, `src/components/pages/Renteberegning.tsx` | Forkert renteperiode, sats, enhed eller rækkegate ændrer krav og renteoversigt. | `renteberegning-contract.md`, `date-contract.md`, `amount-contract.md` | unit/integration/E2E | `domain/renteberegning/**`, `components/pages/Renteberegning.integration.test.tsx`, `components/pages/renteberegning/SpecifikationDownloadBox.test.tsx`, `pdf/renteberegning/**` | 1 calculation-entrypoint og 2 hovedapp-outputs er registreret; standalone-delingen skal efterprøves særskilt. | I gang |
| CALC-004 | Varige mén – `src/domain/varigemen/**`, `src/components/pages/VarigeMen.tsx` | Forkert méngrad, satsår, datoafgrænsning eller gate giver forkert erstatning eller dokument. | `varigemen-contract.md`, `date-contract.md`, `amount-contract.md` | unit/integration/E2E | `domain/varigemen/**`, `components/pages/varigemen/**`, `e2e/download-tooltip-classes.spec.ts` | Calculation-entrypoint og dokumentdefinition er registreret; uafhængig talprøve mangler. | I gang |
| CALC-005 | Forsørgertab – `src/domain/forsoergertab/**`, `src/components/pages/Forsoergertab.tsx` | Forkert kønsgren, periode, fælles årsløn eller difference ændrer resultatet. | `forsoergertab-snapshot-contract.md`, `date-contract.md` | unit/integration/E2E | `domain/forsoergertab/**`, `components/pages/Forsoergertab.integration.test.tsx`, `e2e/forsoergertabResterendePeriode.spec.ts` | Snapshot, reader-projection, integration og E2E er registreret; uafhængig efterregning mangler. | I gang |
| CALC-006 | Erstatningsopgørelse, rækkeevaluering og EO-inspektion – `src/domain/erstatningsopgoerelse/**`, `src/domain/eoRowEvaluation/**`, `src/domain/eoInspektion/**` | Forkert rækkeprioritet, TAF-/svie-/lønperiode, issue eller downstream-projektion ændrer opgørelse/dokument. | `eo-snapshot-contract.md`, `periodisering-contract.md`, `domain-boundary-contract.md`, relevante EO-contracts | unit/integration/E2E | `domain/erstatningsopgoerelse/**`, `domain/eoRowEvaluation/**`, `domain/eoInspektion/**`, `components/pages/erstatningsopgoerelse/**`, EO-E2E-specs | 1 calculation-entrypoint og 7 dokumentoutputs er registreret; stor flade kræver delrækkevis audit. | I gang |
| CALC-007 | Erhvervsevnetab – `src/domain/erhvervsevnetab/**`, `src/components/pages/Erhvervsevnetab.tsx` | Forkert ASL/EAL-grundlag, kapitalisering, løbende ydelse, difference eller aldersreduktion ændrer resultatet. | `eet-snapshot-contract.md`, `snapshot-contract.md`, `domain-boundary-contract.md` | unit/integration/E2E | `domain/erhvervsevnetab/**`, `components/pages/Erhvervsevnetab.integration.test.tsx`, EET-E2E-specs | Snapshot/projection, engine- og gate-tests findes; fem faner og fire dokumenter skal gennemgås som sammenhængende rejser. | I gang |
| DOC-001 | Dokumentkatalog, definitioner, gates og lifecycle – `src/document/definition/**`, domænenes `*DocumentDefinition*` | Et output kan bruge forkert input, forkert gate eller forkert format-/fejlpolitik. | `document-output-contract.md`, `document-format-contract.md` | unit/integration/E2E | `document/documentCatalogCompleteness.test.ts`, `document/documentGate*.test.ts`, `document/documentLifecycleMatrix.test.ts`, `document/documentRendererWiring.test.ts` | 18 Mineo-outputs og 3 standalone-outputs er registreret; hver definition og downstream parity mangler audit. | I gang |
| DOC-002 | PDF-generator, layout og rendered output – `src/pdf/**`, `src/document/generators/**`, `src/document/layout/**` | PDF kan indeholde forkert tekst/tal, manglende afsnit, overlap eller forkert sideskift. | `document-format-contract.md`, `document-output-contract.md` | unit/golden/integration/E2E | `pdf/**`, `document/*golden*`, `document/layout/**`, `utils/pdf/**`, E2E-downloads | Coverage- og baselinekørsler er grønne; parsed/rendered uafhængig kontrol er ikke gennemført. | I gang |
| DOC-003 | Word-generator og fælles writer-paritet – `src/docx/**` | Word kan afvige fra PDF i input, tal, gates eller layoutrelateret indhold. | `document-format-contract.md`, `document-output-contract.md` | unit/integration/E2E | `docx/**`, `document/documentGateFormatInvariance.test.ts`, relevante PDF/Word-E2E | Format-invariance er registreret; faktisk åbning/parsing og visuel kontrol mangler. | I gang |
| UI-001 | `/stamdata` – `src/components/pages/Stamdata.tsx` | Stamdatafejl eller ikke-bevaret canonical input forplanter sig til alle beregninger og save. | `form-contract.md`, `date-contract.md`, `error-contract.md` | integration/E2E | `components/pages/Stamdata.dateOrder.integration.test.tsx`, `insertTodayDateButton.contract.integration.test.tsx`, `e2e/eetStamdataDependency.spec.ts`, `e2e/mineo-smoke.spec.ts` | E2E-baseline grøn; fuld indtast-/save-/load-rejse og alle felter mangler audit. | I gang |
| UI-002 | `/erstatningsopgoerelse` – `src/components/pages/Erstatningsopgoerelse.tsx` og tabs | En synlig oplysning, række eller fejl kan afvige fra snapshot, beregning eller dokumentgate. | `eo-snapshot-contract.md`, `page-component-contract.md`, input-/document-contracts | integration/E2E | `components/pages/erstatningsopgoerelse/**`, `e2e/eet*`, `e2e/download-tooltip-classes.spec.ts`, `e2e/field-attention-blink.spec.ts` | Stor flade med flere eksisterende integrationstests; delvis audit af tabs og dokumenter mangler. | I gang |
| UI-003 | `/erhvervsevnetab` – fem beregningsfaner og fælles input | Faneskift, import eller afhængighed kan ændre input, gate eller fokus uden brugerhandling. | `eet-snapshot-contract.md`, `keyboard-navigation.md` | integration/E2E | `components/pages/Erhvervsevnetab.integration.test.tsx`, EET-E2E-specs, `e2e/field-attention-blink.spec.ts` | E2E-baseline grøn; fanernes samlede brugerrejse skal kobles til de fem underflader. | I gang |
| UI-004 | `/varigemen` – ménberegning og satser | Fejlfeedback, satsår eller downloadstatus kan være synligt inkonsistent med beregningen. | `varigemen-contract.md`, `document-output-contract.md` | integration/E2E | `components/pages/varigemen/**`, `e2e/download-tooltip-classes.spec.ts`, `e2e/svie-smerte-satsaar-button.spec.ts` | Baseline grøn; fuld route-/tab-/downloadrejse mangler audit. | I gang |
| UI-005 | `/forsoergertab` – oplysninger, ASL/EAL og resultat | Køn, datoer eller afhængig årsløn kan blive ændret eller vist forkert i resultatet. | `forsoergertab-snapshot-contract.md` | integration/E2E | `components/pages/Forsoergertab.integration.test.tsx`, `e2e/forsoergertabResterendePeriode.spec.ts`, `e2e/download-tooltip-classes.spec.ts` | Baseline grøn; save/load og dokumentparitet mangler audit. | I gang |
| UI-006 | `/aarsloen` – indtægtstabel, principper og beregning | Tabelredigering, perioder eller principvalg kan give forkert årsløn eller inaktiv dokumentgate. | `aarsloen-contract.md`, `periodisering-contract.md` | integration/E2E | `components/pages/Aarsloen.integration.test.tsx`, `e2e/download-tooltip-classes.spec.ts`, `e2e/input-digit-limits.spec.ts` | Baseline grøn; alle tabelfelter og kontrolgrupper skal gennemgås. | I gang |
| UI-007 | `/renteberegning` – kravtabel, rentesatser og downloads | Brugerens enhed, række eller dato kan give forkert rente og forkert række-/oversigtsgate. | `renteberegning-contract.md` | integration/E2E | `components/pages/Renteberegning.integration.test.tsx`, `SpecifikationDownloadBox.test.tsx`, `pdf/renteberegning/**`, `e2e/minprocesrente-recovery-and-focus.spec.ts` | Mineo- og shared-fladen er fundet; Mineo-specifik brugerrejse mangler audit. | I gang |
| UI-008 | `/satser` – årsvalg, tabeller og download | Årsvalg kan vise data uden for dækning eller give dokument med forkert år. | `satser-contract.md`, `calculation-data-contract.md` | integration/E2E | `components/pages/Satser.downloadGate.integration.test.tsx`, `e2e/satser-tab-settle.spec.ts`, `e2e/svie-smerte-satsaar-button.spec.ts` | Baseline grøn; alle årsgrænser og dokumentparitet skal efterprøves. | I gang |
| UI-009 | `/indstillinger` og `/mineo` – settings og informationsside | Device-lokal indstilling kan blandes med sagsdata, eller informations-/licenseflows kan bryde keyboard/links. | `app-settings.md`, `app-shell-contract.md` | unit/integration/E2E | `components/pages/Indstillinger.optionCoverage.test.tsx`, `indstillinger/defaultDirectoryRow.test.tsx`, `components/pages/Mineo.test.tsx`, `e2e/control-accessible-names.spec.ts`, `e2e/web-link-policy.spec.ts`, `e2e/overlay-behaviour.spec.ts` | Baseline grøn; settings-persistens og alle kritiske overlays mangler samlet gennemgang. | I gang |
| UI-010 | `/open`, 404 og fejl-/loadforløb | Filåbning eller ukendt route kan ændre sagen, skjule en loadfejl eller miste fokus. | `persistence-contract.md`, `app-shell-contract.md`, `error-contract.md` | integration/E2E | `components/pages/OpenEo.test.tsx`, `components/system/PageNotFound.test.tsx`, `e2e/file-load-validation.spec.ts`, `e2e/shell-shortcuts-and-not-found.spec.ts` | Baseline grøn; preflight- og applyfejl skal knyttes til atomisk state-evidens. | I gang |
| MIN-001 | Standalone MinProcesrente – `src/apps/minprocesrente/**`, shared renteberegning | Standalone kan blande hovedappens auth/settings/persistens ind eller vise et andet resultat end den delte engine. | `app-shell-contract.md`, `renteberegning-contract.md` | unit/integration/E2E | `apps/minprocesrente/**`, `quality/minprocesrenteStandaloneIsolation.test.ts`, `apps/minprocesrente/standaloneCalculatorPage.test.tsx`, `e2e/minprocesrente-recovery-and-focus.spec.ts` | E2E-baseline grøn; isolation, exit-guard og dokumentrejse skal gennemgås samlet. | I gang |
| BUILD-001 | Build, entry points, lazy chunks, PWA-assets og scripts – `vite.*.config.ts`, `scripts/**`, `public/**`, `sw/**` | En release kan bygge grønt men levere forkert app, manglende asset, forkert chunk eller ikke-startbar PWA. | `app-shell-contract.md`, build-/release-scripts | statisk/build/E2E | `scripts/**`, `quality/pwaHeaders.test.ts`, `quality/architecture/rules/**`, `apps/shared/vitePreloadRecovery.test.ts`, E2E-buildserveren | E2E-build grøn; chunk-advarsel over 750 kB og Vite native-advarsel står åbne til triage. | I gang |

### Obligatoriske inventarlister

- [ ] Alle exports og indgangspunkter under `src/` er kategoriseret: domæne, input, validering, persistens,
  dokument, UI, data, runtime/bootstrap, utils eller build-/testinfrastruktur.
- [ ] Alle aktive kontraktparagraffer er mappet til mindst én inventarrække og deres test(er), eller til en
  begrundet `Ikke relevant`-række.
- [ ] Alle brugerflader, menupunkter, tabs, dialoger, kritiske handlinger, fejltilstande og dokumentdownloads
  er mappet til en brugerrejse eller en eksplicit begrundet undtagelse.
- [ ] Alle persisted schemas, migrationer, load-aliasser, filversioner, browserlagre og reset-/historyveje
  er mappet.
- [ ] Alle beregningsengines, reguleringer, satstabeller, dato-/periodiseringsregler, afrundinger og
  domænevalidatorer er mappet.
- [ ] Alle automatisk udledte registre, code generators, AST-regler, CI-/release-scripts, PWA-/service
  worker- og browser-gates er mappet som testobjekter. Et testværn er selv produktionskritisk infrastruktur.
- [ ] Alle filer uden direkte test er klassificeret: dækket gennem højere niveau, bevidst ren/triviel,
  genereret, død eller manglende dækning. Henvisningen skal være konkret.

## 3. Gennemgang pr. inventarrække

Kopiér skemaet for hver række fra inventaret. Gem links til tests, rapporter, test-ID'er og reproducerbare
kommandoer; skriv ikke blot «testet».

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | |
| Funktion og bruger-/systemkonsekvens ved fejl | |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | |
| Relevante indgange, udgange, afhængigheder og sideeffekter | |
| Eksisterende testfiler og testnavne | |
| Manglende test, svage assertioner eller dubletter | |
| Valgt testniveau og begrundelse | |
| Mutation/modprøve og resultat | |
| Kørte kommandoer, miljø og artefaktlink | |
| Fund-ID'er, beslutninger og opfølgning | |
| Reviewer / dato / slutstatus | |

### Foreløbig detaljeret gennemgang: `INPUT-001`

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `INPUT-001` / `1389d93c1e8d78f6381cd1cec83bedc40b4f6a48` |
| Funktion og bruger-/systemkonsekvens ved fejl | Input-aggregatet skal bevare XOR mellem canonical og rejected input, skrive atomisk, øge revision/history korrekt og holde åben draft ude af beregning, save og dokumentgate. En fejl kan give forkert beregning, skjult save-blokering eller datatab ved undo/load. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/form-contract.md` §§2–7, `src/contracts/input-field-behavior-contract.md`, `src/contracts/error-contract.md`, `src/contracts/undo-redo-contract.md`, `src/inputCore/settledInput.ts` og `src/inputCore/runtime/slimInputStore.ts`. Acceptance-registret i `src/__tests__/quality/acceptanceMatrix.test.ts` er sporbarhedsregister, ikke selvstændig semantisk evidens. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Editorens draft- og settlekommandoer, immediate clear/choice, transaktionsrunner, Zod-validerede feltrefs, rejected-input-map, history, session envelope, storage-write/rollback, `InputReader`, issues og `EvaluationSourceToken`. |
| Eksisterende testfiler og testnavne | `inputCore/inputCore.test.ts`: XOR-, atomisk transaktion-, tomheds-, immediate-, dynamisk tabel-, reader- og statekæder. `inputCore/editor/fieldEditor.test.ts`: draft, settle, Escape, issue-visning, immediate commit, replacement og placeholder. `inputCore/runtime/dispatchInput.test.ts`: writes/rollback, undo/redo, origin, session-hydration og token. `inputCore/runtime/commandInvariants.test.ts`, `inputCore/stateChains.test.ts`, `inputCore/inputHistory.test.ts` samt `quality/acceptanceMatrix.test.ts`. |
| Manglende test, svage assertioner eller dubletter | Ingen konkret svag assertion er registreret i denne første stikprøve. Den semantiske gennemgang af alle tests, mulig overlap mellem kernetestene og browserbevis for form/grid-paritet er ikke afsluttet. |
| Valgt testniveau og begrundelse | Unit for state-/codec-/transaktionsinvarianter, integration for React-form/grid-adaptere og E2E for reel keyboard-/navigation-/browseradfærd. Det følger inputgrænsens placering og undgår at bruge DOM som bevis for runtime-tilstand. |
| Mutation/modprøve og resultat | Kontrolleret modprøve: `if (!force && deepEqual(persisted, before.input))` blev midlertidigt svækket til `if (!force)`. Den målrettede kørsel af `dispatchInput.test.ts`, `commandInvariants.test.ts` og `inputCore.test.ts` gav 51 fejl / 146 tests, herunder manglende canonical commits, revisioner, history, undo/redo og rollback. Efter præcis gendannelse bestod kontrolkørslen `dispatchInput.test.ts` + `commandInvariants.test.ts` med 103/103 tests. Ingen produktændring er efterladt. Den kvalificerede command-runner er nu gennemført på money-fladen; fuld mutationsplan og øvrig testkvalitetsrevision mangler. |
| Kørte kommandoer, miljø og artefaktlink | Baseline: `npx vitest run src/__tests__/inputCore/inputCore.test.ts src/__tests__/inputCore/editor/fieldEditor.test.ts src/__tests__/inputCore/runtime/dispatchInput.test.ts src/__tests__/inputCore/runtime/commandInvariants.test.ts src/__tests__/inputCore/stateChains.test.ts` – 5 filer, 176 tests bestået. Modprøve: samme runtimeflade med den midlertidigt svækkede no-op-gate – 51 fejl / 146 tests. Kontrol efter gendannelse: `npx vitest run src/__tests__/inputCore/runtime/dispatchInput.test.ts src/__tests__/inputCore/runtime/commandInvariants.test.ts` – 2 filer, 103 tests bestået. Uafhængig reference: `npx vitest run src/__tests__/inputCore/runtime/inputReferenceControl.test.ts` – 1 fil, 1 test bestået. Node `v24.18.0`/Windows. Fuld baseline står i [auditsporet](testdaekningsgennemgang-audit/STATUS.md). |
| Fund-ID'er, beslutninger og opfølgning | Ingen produktfund registreret. Den kontrollerede no-op-modprøve og den uafhængige referencekontrol er bestået som liveness- og krydskontrol-evidens. Åbne auditpunkter: mutationsprøve af de prioriterede flader, komplet testkvalitetsrevision og browser-/adapterparitet. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `PERSIST-001`

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `PERSIST-001` / `1389d93c1e8d78f6381cd1cec83bedc40b4f6a48` |
| Funktion og bruger-/systemkonsekvens ved fejl | `.eo` skal gemme alt canonical sagsinput, afvise rejected input, bevare historiske værdier ved load og anvende et godkendt snapshot atomisk. En fejl kan give datatab, forkert beregning efter load, tavs ændring af en gammel sag eller overskrivning af forkert fil. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/persistence-contract.md` §§1.1–6, `src/contracts/schema-evolution.md`, `src/config/persistenceRegistry.ts`, `src/config/persistenceVersion.ts` og `src/utils/schemaFingerprint.ts`. `persistenceCompatibility.test.ts` og `persistenceVersionDrift.test.ts` er versionsværn, ikke alene bevis for semantisk kompatibilitet. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | InputReader/save-projektion, Zod-schemas, sektionsmigratorer og sanitization, `EoFileCodec`, krypteret filkilde/-mål, preflight-tællinger, pending load, atomisk apply/replace, sessionStorage, IndexedDB-filhandles, PWA-request og metadata-synkronisering. |
| Eksisterende testfiler og testnavne | 25 filer blev kørt samlet. Centrale spor er `persistence/caseFileOperations.test.ts`, `persistence/caseResetOperations.test.ts`, `persistence/eoSaveProjection.test.ts`, `persistence/persistedLoadAdapter.test.ts`, `utils/fileRoundTrip.fullState.test.ts`, `utils/fileLoad.normalLoad.test.ts`, `utils/persistenceMigrations.test.ts`, `utils/persistenceLoadSanitization.test.ts`, `utils/persistenceLoadApply.test.ts`, `utils/fileSave.test.ts`, `utils/fileSaveTarget.test.ts`, `utils/eoFileCodec.test.ts`, `utils/historicalEoFixtures.test.ts`, `schemas/eoFileSchema.test.ts` og `hooks/useFileSaveLoad.test.tsx`. Derudover dækker `e2e/file-load-validation.spec.ts` filfejl samt legacy-load gennem preflight og overskrivningsbekræftelse. |
| Manglende test, svage assertioner eller dubletter | Repository-søgning og git-objekter indeholder ingen `.eo`-artefakter fra faktiske tidligere udgivelser. Der er tilføjet fem versionsmærkede, krypterede testfixtures – legacy uden version samt 1.0.4, 3.10, 3.12 og 3.13 – genskabt ud fra de historiske inline-payloads og den dokumenterede AES-GCM-protokol. `historicalEoFixtures.test.ts` sender de faktiske bytes gennem dekryptering, versionsadapter og sektionsschemas, men beviser ikke hver faktisk tidligere udgivet container eller en uafhængig save → load-struktursammenligning. Fundet er registreret som `TD-001`. Fuld assertion-, overlap- og dubletrevision samt mutationsprøve er ikke afsluttet. |
| Valgt testniveau og begrundelse | Unit for schemas, migrering, sanitization, codec og filkilder/-mål. Integration for save-/load-projektion, atomisk apply, session- og metadataflow. E2E for den synlige preflight-/overskrivningsrejse og browserens filvælger. Et rent grønt resultat lukker ikke rækken, fordi fixtureproveniens og uafhængig struktursammenligning stadig mangler. |
| Mutation/modprøve og resultat | Ikke gennemført på persistence-fladen. Den kvalificerede command-runner er foreløbig kun afprøvet på `src/domain/money/money.ts`; der er heller ikke kørt en kontrolleret svækket assertion eller en uafhængig referenceimplementering for denne række. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/persistence src/__tests__/config/storageManifest.test.ts src/__tests__/config/persistenceVersionDrift.test.ts src/__tests__/config/persistenceRegistry.test.ts src/__tests__/config/persistenceCompatibility.test.ts src/__tests__/hooks/useFileSaveLoad.test.tsx src/__tests__/utils/fileSaveTarget.test.ts src/__tests__/utils/fileSave.test.ts src/__tests__/utils/filePersistenceMetadata.test.ts src/__tests__/utils/fileLoadSource.test.ts src/__tests__/utils/fileLoad.decryptFailure.test.ts src/__tests__/utils/fileHelpers.test.ts src/__tests__/utils/fileHelpers.selectFile.test.ts src/__tests__/utils/fileHandleStorage.test.ts src/__tests__/utils/eoFileCodec.test.ts src/__tests__/utils/persistenceMigrations.test.ts src/__tests__/utils/persistenceLoadSanitization.test.ts src/__tests__/utils/persistenceLoadApply.test.ts src/__tests__/utils/safeSessionStorage.test.ts src/__tests__/schemas/eoFileSchema.test.ts src/__tests__/quality/eoFileSchemaStrictnessGuard.test.ts src/__tests__/utils/historicalEoFixtures.test.ts` – 25 filer, 238 tests bestået på 13,92 s i Node `v24.18.0`/Windows. Vite udsendte den kendte `configLoader: 'native'`-advarsel. Baselineartefakter står i [auditsporet](testdaekningsgennemgang-audit/STATUS.md). |
| Fund-ID'er, beslutninger og opfølgning | `TD-001` er et åbent test-evidensfund, ikke et konstateret produktdatatab. De fem genskabte fixtures skal suppleres med proveniens fra faktiske offentliggjorte filer eller en eksplicit accepteret erstatning, og loaded data skal sammenlignes strukturelt med en uafhængig reference. Gentag derefter alle relevante migreringsgrene og kør persistence-fladens mutationsprøve. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `DATE-001` – money-fladen

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `DATE-001` / `1389d93c1e8d78f6381cd1cec83bedc40b4f6a48` |
| Funktion og bruger-/systemkonsekvens ved fejl | Money-typerne er grundlaget for enheder, fortegn, overflow, faktorberegning og afrunding. En fejl kan ændre beløb eller få en ugyldig numerisk værdi ind i beregningen. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/amount-contract.md`, `src/domain/money/money.ts` og de tilhørende Zod-schemas. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | `moneyOre`, `fromKroner`, `toKroner`, addition/subtraktion, skalering, nul-clamp og `roundHeleKroner`. |
| Eksisterende testfiler og testnavne | `src/__tests__/domain/money/money.test.ts` – 13 målrettede tests for gyldige værdier, ugyldige heltal, overflow, aritmetik, skalering, nul-clamp, konvertering og half-away-from-zero-afrunding. |
| Manglende test, svage assertioner eller dubletter | Mutationstesten fandt først manglende direkte test af `roundHeleKroner` og en for svag assertion af `moneyOre`'s fejltekst. Begge er styrket. Én numerisk boundary-mutation i `fromKroner` mangler fortsat en repræsentabel diskriminerende case. Den øvrige dato-/periodiseringsflade er ikke fuldt revideret. |
| Valgt testniveau og begrundelse | Unit- og mutationstest af den rene TypeScript-flade. React-/browserbevis er ikke nødvendigt for disse funktioner, men forbrugernes uafhængige beregningskontrol mangler stadig på DATE-001 som helhed. |
| Mutation/modprøve og resultat | StrykerJS 10.0 command-runner med eksplicit Vitest-kommando: 58 mutationer, 56 dræbt, 0 timeout, 0 tekniske fejl. To overlevere er triageret: `< 0` → `<= 0` i nul-clamp vurderes ækvivalent, mens `> 1e-4` → `>= 1e-4` står som åben numerisk triage. |
| Kørte kommandoer, miljø og artefaktlink | `npm run test:mutation` – Node `v24.18.0`/Windows, én worker, omkring 2 minutter. Rapport: `coverage/mutation/mutation.json` og `coverage/mutation/mutation.html` (ignorerede lokale artefakter). |
| Fund-ID'er, beslutninger og opfølgning | `TD-002` dokumenterer den fravalgte officielle Vitest-runner. Gennemgå den åbne numeriske boundary, udfør uafhængig håndregning og fortsæt med dato-/periodefladen. Turing har desuden identificeret en mulig kontraktafvigelse for ugyldige `Date`-instanser; en produktændring skal forelægges udvikleren først. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `ARCH-002` – registry-completeness

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `ARCH-002` / `318d9115` |
| Funktion og bruger-/systemkonsekvens ved fejl | Arkitekturharnesset skal håndhæve alle registrerede regler. En regel, der fjernes fra registryet eller aldrig registreres, kan ellers efterlade en ulovlig import eller parallel write-model ubeskyttet, selv om quality-suiten er grøn. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | De relevante arkitekturregler i `src/__tests__/quality/architecture/rules/**`, registryet `ARCHITECTURE_RULES` og `domain-boundary-contract.md`/øvrige arkitekturcontracts. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Rule-registry, AST/source-graph-kørsel, rule fixtures og den samlede architecture quality-suite. |
| Eksisterende testfiler og testnavne | `src/__tests__/quality/architecture/architectureRules.test.ts` med registry-, manifest-, fixture-, violations- og source-graph-tests. |
| Manglende test, svage assertioner eller dubletter | Den tidligere suite itererede kun over `ARCHITECTURE_RULES` og kunne derfor ikke opdage en regel, der blev glemt i registryet. Der er nu en separat forventningsliste med 88 regel-ID'er og assertion for både manglende og uventede registry-poster. |
| Valgt testniveau og begrundelse | Statisk/unit-test af quality-infrastrukturen. En fast forventningsliste er nødvendig, fordi registryet ikke må være sin egen eneste sandhedskilde for completeness. |
| Mutation/modprøve og resultat | Registry-completeness-testen bestod med 186 tests. En fjernet registry-post vil give en konkret manglende ID; testen ændrer ikke produktkode. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/quality/architecture/architectureRules.test.ts --reporter=dot` – 1 fil / 186 tests bestået på Node `v24.18.0`/Windows. |
| Fund-ID'er, beslutninger og opfølgning | Det tidligere registry-livenessfund er lukket i testinfrastrukturen. Rækken forbliver `I gang`, indtil de øvrige arkitekturmønstre, negative modcases og livenessværn er revideret. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Universal tjekliste

- [ ] Har inventaret afgrænset hele fladen, herunder exports, kaldere og indirekte consumers?
- [ ] Er den forventede adfærd afledt af en autoritativ kilde frem for den nuværende implementering?
- [ ] Dækker tests både normalvej, fraværende input, ugyldigt input, grænser, overgang mellem tilstande og
  relevante fejlveje?
- [ ] Findes mindst én kontrolgruppe, når testen kan blive grøn ved at blokere, ignorere eller returnere en
  konstant værdi?
- [ ] Er testdata tilstrækkeligt forskellige til at afsløre forkert prioritet, fortegn, enhed, dato,
  afrunding, filtrering eller rækkevalg?
- [ ] Er mocks begrænset til systemgrænser? Hvis domænelogik er mock'et, er integrationstesten, der bruger
  den rigtige logik, tilføjet eller registreret som hul?
- [ ] Tester testen observerbar adfærd/invariant i stedet for egne implementation details?
- [ ] Er der en eksplicit negativ assertion, hvor et farligt falsk positivt resultat ellers er muligt?
- [ ] Er testens navn, fixture og kommentar sandfærdige og opdaterede?
- [ ] Er testen kørt selvstændigt og som del af relevant suite uden afhængighed af kørselsrækkefølge?

## 4. Dybdegående tjekskemaer efter risikotype

### 4.1 Beregninger, tal, satser og datoer – `CALC`, `DATE`, `DATA`

- [ ] Én eller flere uafhængigt efterregnede golden cases med konkrete danske beløb, procenter og datoer.
- [ ] Hver regelgren, regelprioritet og lov-/datogrænse er prøvet på begge sider samt præcist på grænsen.
- [ ] 0, negativt input hvor tilladt, store tal, decimaler, `-0`, `NaN`, `Infinity` og tom værdi er prøvet
  efter den relevante types og schemas kontrakt.
- [ ] Afrunding, enheder (kr./øre, dag/måned/år, procent/brøk), fortegn og visningsformat er afprøvet
  særskilt, så kompensation mellem fejl ikke skjuler en forkert slutværdi.
- [ ] Datooperationer er prøvet for samme dag, én dag, måned-/årsskifte, skuddag og DST-start/-slut, når
  datoen eller dagtællingen er relevant.
- [ ] Tabel-/kildedata har kontrol for komplethed, sortering, overlap/huller, gyldighedsinterval og de
  konkrete opslag, der styrer beregningen.
- [ ] Samme begreb beregnes ikke to gange med potentielt driftende regler. Hvis flere projektioner er
  nødvendige, sammenligner en test dem på forskellige cases.
- [ ] Resultat, mellemresultat og blokering/issue er testet sammen, når brugeren kan se eller downloade dem.

### 4.2 Schemas, parsing, input og validering – `SCHEMA`, `INPUT`, `VALID`

- [ ] Zod-schema og afledt TypeScript-type stemmer, og schemaet prøves med gyldige, ugyldige, manglende,
  ukendte og grænseværdier med verificeret fejlstruktur.
- [ ] Parsing/normalisering muterer ikke callerens input og giver canonical værdi eller rejected råtekst –
  aldrig begge dele for samme felt.
- [ ] Draft, settle ved blur/Enter, Escape, straks-commit-undtagelser og navigation/re-render bevarer den
  aftalte tilstand. Ingen beregning eller dokumentgate læser en åben draft.
- [ ] Feltissues angiver konkrete grænser og korrekt felt-/rækkereference; flere issues deduplikeres uden at
  skjule et selvstændigt problem.
- [ ] Rækkeoperationer, sortering, restore-ankre, ukendte feltreferencer, undo/redo og no-op-commands
  beskytter revision, history og input mod delvis eller implicit mutation.

### 4.3 Save/load, browserstorage og filformat – `PERSIST`

- [ ] Save → load → save giver samme schema-validerede brugerinput og ingen utilsigtet afledt/default-data.
- [ ] Hver tidligere udgivet `.eo`-fixture indlæses uden ny fejl, advarsel eller ændret sagsdata. Fixtures
  repræsenterer alle relevante historiske versioner og migreringsgrene.
- [ ] Manglende nye felter, kendte gamle adresser/enumværdier, ukendte data, korrupt container og delvist
  ugyldige data prøves mod den præcise preflight- og fail-closed-kontrakt.
- [ ] Preflight er atomisk: afvisning, annullering og apply-fejl efterlader aggregate, history og storage
  uændrede. «Indlæs trods fejl» er prøvet, når den eksisterende kontrakt tillader den.
- [ ] Rejected input overlever kun den foreskrevne sessionvej, blokerer save og kan aldrig ende i filen.
- [ ] Eksport/import, filnavn, MIME/File API, storage-kvoter og manglende browserkapabiliteter har
  kontrollerede fejlveje uden datatab.

### 4.4 Dokumenter og resultatformidling – `DOC`

- [ ] Hvert dokument kan spores til samme authoritative input/projektion som den viste beregning.
- [ ] En repræsentativ og mindst én grænse-/fejlsag bekræfter alle betingede afsnit, summer, fortegn, datoer,
  bilag, filtrering og dansk format.
- [ ] Dokumentgate blokerer på enhver dokumentrelevant fejl i senest afsluttede revision og finaliserer en
  åben editor før download.
- [ ] Den genererede fil åbnes eller parses efter formatet; visuel rendering gennemgås, når layout, sideskift,
  overlap, manglende tekst eller tabeller har betydning.
- [ ] Skærm, beregning og dokument sammenlignes i en case, hvor uens inputvalg ville give synligt forskellige
  tal. En ensartet «happy path» alene er ikke tilstrækkelig.

### 4.5 UI, brugerrejser, keyboard og browser – `UI`, `E2E`

- [ ] Hver side og kritiske dialog gennemgås via en reel brugerrejse: indtast, afslut input, navigér, gem/
  indlæs eller download, og verificér resultatet.
- [ ] Navigation anvender projektets fælles E2E-hjælpere, afventer lazy mount og har assertions på den nye,
  ikke den tidligere, flade.
- [ ] Tastatur: Tab/Shift+Tab, Enter, Escape, genveje, fokusretur, fokusfælde og fejl-fokus prøves, hvor
  kontrakten kræver det. Brug flere browsermotorer kun ved faktisk motorafhængig semantik.
- [ ] Tilgængelige navne, rolle, disabled-tilstand, fejltooltips og den synlige danske tekst er prøvet uden
  at låse unødvendig markup.
- [ ] Login-gate, unsupported-device-gate, 404, reload, flere faner, bfcache-/service-worker-forhold og
  browserstorage prøves efter deres konkrete kontrakter og observerbarhed.
- [ ] E2E-fixturer bruger fiktive data og kontrollerer runtime-fejl, `console.error` og uventede eksterne
  requests. En fejlfri konsol måles som en del af de kritiske rejser.
- [ ] Visuelle påstande, der ikke kan udtrykkes robust i DOM, kontrolleres med screenshot/rendering og en
  dokumenteret manuel acceptprøve. Pixelperfektion alene er ikke et generelt dækningsmål.

### 4.6 Arkitektur, sikkerhed og driftsværn – `ARCH`, `BUILD`

- [ ] Alle kvalitetstests er levende: de scanner et ikke-tomt mål, har et liveness-gulv og bliver røde af en
  kontrolleret overtrædelse i levende kode eller en repræsentativ fixture.
- [ ] Statisk kontrol kan ikke omgås ved aliasimport, omdøbning, flytning eller en ny parallel implementering
  af samme ansvar. Typesystemet bruges først, når grænsen kan udtrykkes der.
- [ ] Klientsidegrænsen er bevist: ingen netværkskald, telemetri eller ekstern logging kan indføres på en
  uovervåget vej. Tilladte browser-/fil-API'er er eksplicitte.
- [ ] Build, entry points, dynamiske imports, lazy chunks, PWA/service worker, assets og begge applikationer
  bygger og starter som forventet.
- [ ] Release-scripts, dependency-/tool-isolation, kontraktverifikation, dataimport-kontrol og E2E-lane-
  kontrol har egne positive og negative prøver, eller en dokumenteret anden evidensform.

## 5. Testkvalitetsrevision af eksisterende tests

Gennemgå også tests, der allerede består. Klassificér hver som `Behold`, `Styrk`, `Flyt niveau`, `Erstat`,
`Fjern` eller `Undersøg`. En høj testmængde kan skjule tests, der ikke beviser noget.

| Testfil / test-ID | Beskytter den | Svaghed eller modfejl | Beslutning | Erstatnings-/styrkende test | Status |
| --- | --- | --- | --- | --- | --- |
| `PERSIST-001` | Unit-/integrationstest af save/load og migrering | Versionsbundne `.eo`-fixtures fra tidligere udgivelser samt uafhængig struktursammenligning | Alle historiske versioner og registrerede migreringsgrene | Fem genskabte fixtures går gennem den faktiske loadgrænse, men ingen fixture er dokumenteret som en faktisk offentliggjort fil, og struktursammenligning mangler | I gang |

Kontrollér særligt:

- [ ] Assertions med kun sand/falsk, ikke-tomme værdier, brede partial matches, snapshots af beregningstal
  eller mock-kald i stedet for resultat.
- [ ] Fixtures, hvor flere mulige regler giver samme output; tilføj en diskriminerende case.
- [ ] Overlap: flere tests der beskytter samme detalje, mens en nærliggende gren er ubeskyttet.
- [ ] Tests der kun består på grund af mock, test-only produktkode, delt mutable state, vilkårlig ventetid,
  `skip`/`todo`, tilfældig kørselsorden eller maskinens lokale tid/zone.
- [ ] Ubrugte eller tavst ekskluderede testfiler, globs, lanes, coverage-mapper og scripts.
- [ ] Tester der ikke længere matcher kontrakt eller produktspecifikation, selv om implementeringen er rigtig.
- [ ] Regressionstests for tidligere fejl: reproducerer testen fejlen før rettelsen, og er dens præmis stadig
  gyldig?

## 6. Coverage-analyse – kort, ikke dom

For hver coverage-kørsel registreres kommando, commit, rapportsti og resultater. Sammenlign ikke alene
procenter på tværs af revisionsændringer uden at sammenligne instrumenteret filmængde.

| Område | Instrumenteret? | Statements / branches / functions / lines | Udførte huller | Klassifikation | Handling / inventar-ID |
| --- | --- | --- | --- | --- | --- |
| | Ja/Nej | | | kritisk / relevant / død / genereret / højere niveau | |

- [ ] `npm run test:coverage` er kørt på den fastlåste revision.
- [ ] Alle instrumenterede filer under tærskel og alle ikke-dækkede grene er triageret række for række.
- [ ] Ikke-instrumenterede kildemapper er inventariseret; deres dækning bevises med andre tests eller de
  indgår som et eksplicit forbedringsforslag til coverage-konfigurationen.
- [ ] Død kode og defensive grene undersøges før der tilføjes kunstige tests. En uopnåelig gren er ikke en
  testopgave, men muligvis en design-/vedligeholdelsesopgave.
- [ ] Coverage-tærskler er vurderet for deres egnethed og må ikke hæves eller sænkes blot for at få gaten
  grøn. Ændring kræver konkret fladeanalyse.

## 7. Mutationstest – kvalificering, gennemførelse og triage

Manuel «mutationstestet» i kommentarer er nyttig lokal evidens, men erstatter ikke en reproducerbar,
rapporteret mutationskørsel. Gennemgangen skal indføre eller kvalificere en automatiseret mutationsrunner
for de højst prioriterede rene TypeScript-flader. Der findes ved auditstart ingen sådan runner i projektets
testskripter; værktøjsvalg og eventuel ny dependency er derfor en særskilt beslutning, ikke noget der må
antages gennemført på forhånd.

### 7.1 Værktøjskvalificering – `MUT-TOOL`

| Kandidat / version | TypeScript/Vitest-egnethed | Vite/React-egnethed | Selektiv kørsel og rapport | Reproducerbar i CI | Bundle-/vedligeholdelsesrisiko | Beslutning / begrundelse |
| --- | --- | --- | --- | --- | --- | --- |
| StrykerJS 10.0.0 + `@stryker-mutator/vitest-runner` 10.0.0 | Dry-run bestået med Vitest 5, men faktisk kørsel gav 0/58 dræbte mutationer, herunder åbenlyse ændringer af `toKroner` og komplette funktionskroppe. | Kan starte den lokale Vitest-konfiguration, men resultatet er ikke gyldigt som mutationsevidens i denne revision. Browser mode indgår ikke. | `coverageAnalysis: perTest`; HTML/JSON blev skrevet, men rapporten er teknisk ugyldig på grund af den målte nulscore. | Ikke kvalificeret. | To dev-dependencies og deres transitive træ; pluginsporet beholdes ikke. | Fravalgt. En grøn dry-run er ikke nok, når en bevidst forkert implementering overlever. Fejlen registreres som `TD-002` og revurderes ved en kompatibel runner-/Vitest-opdatering. |
| StrykerJS 10.0.0 command-runner med Vitest 5 | Muterer TypeScript gennem Stryker og kører den eksplicit valgte Vitest-suite som en ekstern kommando. | Ingen React-/browsermutation; det er tilsigtet for rene TypeScript-flader. | Modulvist via `commandRunner.command`; `coverageAnalysis: off`, fordi command-runneren ikke leverer per-test coverage. `coverage/mutation/mutation.json` og `.html` er versionsbundne, ignorerede artefakter. | Kvalificeret lokalt på Windows/Node 24 med én worker; CI-integration er endnu ikke gennemført. | Én dev-dependency (`@stryker-mutator/core`) og et målt ekstra testtrin. Den langsommere fulde testsuite er en accepteret pris for et gyldigt signal. | Valgt til auditten. På `src/domain/money/money.ts` blev først 50/58 mutationer dræbt; efter en manglende direkte test af `roundHeleKroner` og den konkrete `moneyOre`-fejltekst blev 56/58 dræbt på 1:50 uden timeout eller runnerfejl. |

- [ ] Sammenlign mindst den valgte kandidat med én realistisk alternativ løsning eller dokumentér, hvorfor
  der kun findes én kompatibel mulighed.
- [ ] Verificér på en lille, repræsentativ flade, at runneren faktisk muterer TypeScript-kilde, kører de
  rigtige Vitest-tests og markerer en bevidst svækket assertion som overlevet.
- [ ] Beslut isolation, timeout, workerantal, cache og rapportformat med en målt prøvekørsel. Mutationskørsel
  må ikke gøre almindelige tests eller E2E-runneren ustabil.
- [ ] Før en dependency tilføjes, dokumentér begrundelse, lockfile-/vedligeholdelsesrisiko og den konkrete
  release-/CI-integration. Følg projektets dependency-regler.

### 7.2 Prioriteret mutationsplan – `MUT`

Kør mutationstests modulvist, ikke som én uigennemsigtig total. Start med rene og trust-kritiske regler:

1. Beregningsengines, afrunding, dato-/periodiseringshelpers og satse-/reguleringsopslag.
2. Zod-schemas, normalisering, validatorer og InputReader-projektioner.
3. Save/load, migrering, sanitering, history og atomiske mutationer.
4. Dokumentmodeller/-gates samt rene selectors, der afgør synlige beløb eller blokering.
5. Arkitekturværn og scripts, hvor runneren kan give signal; behold samtidig de manuelle levende
   modprøver, hvis AST-/miljøadfærd ikke kan muteres sikkert automatisk.

Browserkomponenter muteres kun selektivt. For dem er en stærk E2E-/integrationstest ofte mere informativ
end en stor score fra DOM- eller JSX-mutationer. Begrund både inklusion og undtagelse per flade.

| Inventar-ID / modul | Mutatorfamilier der er relevante | Dræbte | Overlevede | Timeout / no coverage | Triage og testændring | Rest-risiko / beslutning | Status |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| `DATE-001` / `src/domain/money/money.ts` | relation, aritmetik, boundary, conditional, string, return | 56 | 2 | 0 / 0 | Den dedikerede money-suite blev styrket med eksakt `moneyOre`-fejltekst og direkte half-away-from-zero-cases for `roundHeleKroner`. | `clampMoneyOreToZero` med `< 0` → `<= 0` giver samme observerbare værdi for 0 og vurderes som ækvivalent. `fromKroner` med `> 1e-4` → `>= 1e-4` mangler en repræsentabel diskriminerende case og står derfor som åben numerisk triage. | I gang |

### 7.3 Regler for mutationstriage

- [ ] Hver overlevet mutant får en konkret afgørelse: manglende test, ækvivalent mutant, utilgængelig vej,
  runnerfejl eller bevidst undtagelse. «Lav betydning» uden analyse er ikke en afgørelse.
- [ ] En påstået ækvivalent mutant dokumenterer den algebraiske/type-/kontraktmæssige grund. Bekræft med en
  modcase, når den ikke er indlysende.
- [ ] En manglende test rettes med den mindste test, som dræber mutanten ved korrekt observerbar adfærd –
  ikke en assertion på implementation detail.
- [ ] Timeout, compilerfejl eller test-runnerfejl tæller ikke som dræbt mutant. Stabiliser eller isolér før
  resultatet bruges som evidens.
- [ ] Mutationstest må ikke føre til produktionskode, der kun eksisterer for at tilfredsstille mutatoren.
- [ ] Der fastsættes ikke én global score uden fladeanalyse. Kritiske, rene flader kræver enten ingen
  uforklarede overlevere eller en eksplicit accepteret, dokumenteret undtagelse; lavrisiko-flader vurderes
  per række.

## 8. Uafhængig krydskontrol

En testpakke kan dele den samme misforståelse som implementeringen. De mest kritiske regler skal derfor
prøves med en anden evidensform end den primære test.

| Flade / ID | Primær evidens | Uafhængig modprøve | Case/fixture | Resultat / artefakt | Status |
| --- | --- | --- | --- | --- | --- |
| | unit/golden/E2E | håndregning, anden implementering, historisk `.eo`, rendered dokument, browsermatrix | | | |

- [ ] Beregningstal kontrolleres manuelt mod en dokumenteret håndregning eller en lille, separat
  referencespecifikation for repræsentative og grænsenære cases. Referencekoden må ikke genbruge den
  samme hjælpefunktion som produktionen.
- [ ] Persistens testes mod ægte historiske fixtures og struktursammenligning, ikke kun en fixture genereret
  af den samme aktuelle serializer.
- [ ] Dokumenter renderes/parses uafhængigt af generatorens unit-tests.
- [ ] Kritiske browserrejser køres på de browsermotorer og viewporter, hvor deres kontrakt kan variere.
- [ ] Et udvalg af kvalitetstests muteres eller modprøves i levende kode for at vise, at værnet ikke er
  grønt af tomhed.

## 9. Fundregister og beslutningslog

| Fund-ID | Dato | Inventar-ID | Alvor | Fund og bruger-/systemkonsekvens | Reproduktion/evidens | Løsning eller beslutning | Godkendelse hvis påkrævet | Retest og lukning |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-001 | 2026-09-10 | `PERSIST-001` | Høj | Der fandtes ingen versionsbundne `.eo`-fixtures med dokumenteret oprindelse i tidligere offentliggjorte Mineo-filer. Auditten kan derfor endnu ikke bevise, at hver tidligere udgivet container indlæses uden ændret sagsdata eller ny preflight. | `rg --files -g '*.eo'` og git-objektsøgning fandt ingen releaseartefakter. Der er nu fem genskabte, krypterede fixtures for legacy uden version samt 1.0.4, 3.10, 3.12 og 3.13, baseret på historiske inline-payloads. `npx vitest run src/__tests__/utils/historicalEoFixtures.test.ts` bestod med 5/5 tests. | Den genskabte fixturekontrol er tilføjet som test-only auditmateriale; ingen produktændring foretaget. Fundet forbliver åbent, indtil proveniens fra faktiske releasefiler eller en udtrykkeligt accepteret erstatning er fastlagt, og loaded data er sammenlignet med en uafhængig strukturel reference. | Ikke påkrævet for test-/dokumentationsændringen; eventuel godkendelse af fixture-erstatning og afslutning af fundet forelægges særskilt. | Retest bestået: 5 fixturetests alene og 25 filer / 238 tests i persistenssuiten. Åben – releaseproveniens og uafhængig struktursammenligning mangler |
| TD-002 | 2026-09-10 | `MUT-TOOL` | Høj | Den officielle Stryker Vitest-runner kunne bestå dry-run, men rapporterede 0/58 dræbte mutationer på `money.ts`, også når mutationerne åbenlyst ændrede observerbare resultater. Hvis rapporten blev accepteret, ville auditten dokumentere falsk teststyrke. | `npm run test:mutation -- --dryRunOnly` bestod med 1 fil og 58 mutationer. `npm run test:mutation` med Vitest-runner gav 0/58. En separat command-runner med samme 58 mutationer dræbte 50/58 og efter teststyrkelse 56/58 på 1:50. | Vitest-pluginsporet er fravalgt og fjernet fra package-manifestet. Stryker core command-runneren er valgt med eksplicit Vitest-kommando og `coverageAnalysis: off`. Fundet forbliver åbent som kompatibilitetsforhold, men blokerer ikke den valgte runner. | Ikke påkrævet; ændringen er testinfrastruktur. | Command-runnerens dry-run og fulde kontrolkørsel bestået. Åben – revurderes ved ny Stryker-/Vitest-kombination. |
| TD-003 | 2026-09-10 | `DATE-001` | Høj | Datokontrakten kræver, at ugyldige `Date`-/NaN-inputs valideres eller afvises fail-fast. `diffUtcDays` normaliserer en ugyldig `Date` til `NaN`, og de afledte `count*`-/`diffUtcDaysAbs`-helpers kan derfor returnere `NaN` i stedet for at afvise. Hvis en valideringsgrænse mangler hos en caller, kan det forplante en ikke-beregnelig værdi til en gate eller beregning. | `src/contracts/date-contract.md` kræver eksplicit validering/fail-fast, mens `src/utils/utcDayMath.ts` kalder UTC-gettere direkte uden gyldighedstjek. En isoleret testprobe for ugyldig start/slutdato fejlede på det forventede throw for `diffUtcDays`; `beregnSHDage` afviser allerede ugyldig dato via `formatToISO`. | Ingen produktkode ændret. Testene for `beregnSHDage` og øvrige dato-grænser er committet; de fejlslagne `utcDayMath`-fail-fast-prober er ikke en del af den grønne suite. En ændring af helper-adfærden kan påvirke fejl-/beregningsadfærd og forelægges udvikleren før implementering. | Ja – udviklerens godkendelse kræves før produktlogikken ændres. | Åben. Kræver beslutning om valideringsgrænse og derefter en grøn, diskriminerende regressionstest. |

**Alvor:** `Kritisk` omfatter mulig forkert beregning, datatab, forkert load eller dokument med forkert
resultat. `Høj` omfatter brud på en trust-kritisk kontrakt eller en sandsynlig regressionsvej. Lavere
alvor må aldrig bruges til at skjule en uafklaret brudt invariant.

| Beslutnings-ID | Emne | Muligheder og konkret brugeroplevelse | Valgt af / dato | Afgrænsning og revurderingstrigger |
| --- | --- | --- | --- | --- |
| TD-D01 | Mutationsrunner for rene TypeScript-flader | Vitest-pluginpen kan give en pæn rapport, men den målte brugeroplevelse for auditten er et falsk grønt signal: en forkert `toKroner`-implementering bliver ikke fanget. Command-runneren tager længere tid, men den samme suite dræber 56/58 mutationer og kan bruges modulvist. | Codex / 2026-09-10 | Brug command-runneren med eksplicit testkommando og én worker. Revurder ved opgradering af Vitest eller Stryker, hvis en pluginrunner igen kan bevise dræbte kontrolmutationer. |

## 10. Afslutningsgate

Auditten må først lukkes, når alle punkter er opfyldt på den fastlåste slutrevision:

- [ ] Inventaret er komplet, og hver række er `Bestået`, begrundet `Ikke relevant` eller dokumenteret
  `Bestået med rest-risiko`. Ingen kritisk række har rest-risiko uden en udtrykkelig afgørelse.
- [ ] Alle aktive kontraktforpligtelser, kritiske brugerrejser, beregningsregler, data-, input-,
  persistens- og dokumentflader kan spores til konkret evidens.
- [ ] Eksisterende tests er kvalitetsrevideret; svage, døde og overlappende tests er fjernet, erstattet eller
  har en åben fundrække.
- [ ] Coverage-huller og ekskluderede mapper er triageret; ingen procent eller tærskel bruges som eneste
  bevis.
- [ ] Mutationsværktøjet er kvalificeret, og alle prioriterede mutationer er triageret efter §7. Der findes
  ingen uforklaret overlevet mutant på en kritisk flade.
- [ ] Alle fund er rettet og retestet eller har en accepteret, dateret rest-risiko. Åbne kritiske eller høje
  fund forhindrer konklusionen.
- [ ] Relevante kommandoer er kørt rent i et reproducerbart miljø: typechecks, lint, Vitest/coverage,
  relevante målrettede tests, build, releaseværn og E2E. Fuld browsermatrix er kørt for de markerede
  motor-/viewportafhængige flader.
- [ ] Artefakter, fixtures, rapporter, mutationstriangulering og beslutningslog er tilgængelige fra dette
  dokument og indeholder ingen persondata.

### Slutattestation

| Felt | Udfyldes ved afslutning |
| --- | --- |
| Slutrevision og dato | |
| Antal inventarrækker: bestået / rest-risiko / ikke relevant | |
| Antal fund: fundet / rettet / accepteret / åbent | |
| Mutation: moduler, dræbte / overlevede / ækvivalente / tekniske fejl | |
| Coverage: rapport og triagerede huller | |
| Kørte gates og artefaktlinks | |
| Resterende risici og revurderingstriggere | |
| Konklusion | |
| Reviewer(e) / dato | |

**Konklusionsskabelon:**

> På revision `<commit>` er alle identificerede testforpligtelser i dette dokument gennemgået. De tilhørende
> tests og uafhængige modprøver beskytter de registrerede invarianter og brugerrejser, og alle
> mutationsresultater, coverage-huller og fund er triageret. De eneste rester er `<fund-ID'er eller ingen>`.
> Konklusionen gælder kun denne revision og skal genåbnes for hver ændring, der berører en inventarrække.

## 11. Vedligeholdelse efter afsluttet audit

- Hver ændring skal opdatere eller genåbne de berørte inventarrækker. Nye features, kontrakter,
  persisted felter, beregningsregler eller brugerrejser må ikke lande uden en række og tilsvarende testplan.
- Kør selektiv mutationstest for de ændrede rene, kritiske moduler og periodisk hele den prioriterede
  mutationsplan. Fastlæg frekvensen efter den kvalificerede runners målte pris.
- Gentag den fulde audit efter væsentlig arkitekturændring, ny persistensversion, ny beregningsfamilie,
  væsentlig browser-/toolchainopgradering eller et kritisk produktfund.
- Genåbn straks alle rækker, hvis en regression viser, at et bestående værn ikke fangede den fejl, det skulle
  beskytte imod. Opdatér også denne plan, hvis læringen ændrer auditmetoden.
