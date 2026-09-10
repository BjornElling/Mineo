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
| ARCH-001 | Kontrakt-topologi og kontraktdækningsmatrix – `src/contracts/contract-topology.json`, `src/__tests__/quality/contractCoverageMatrix.test.ts` | En aktiv kontrakt kan ændres uden koblet testspor eller blive glemt i topologien. | `contract-topology.json`, de enkelte contracts | statisk/unit | `quality/contractCoverageMatrix.test.ts`, `quality/contractReferenceLiveness.test.ts` | Referenceværnet ignorerer nu bare filnavne, der kun findes under `src/__tests__`, mens eksakte teststier fortsat accepteres. Liveness-suiten er grøn efter eksplicit undtagelse for den test-only `wordContentHarness.ts`; semantisk gennemgang af hver paragraf mangler. | I gang |
| ARCH-002 | Arkitekturharness og domæne-/sidegrænser – `src/__tests__/quality/architecture/**`, `src/__tests__/quality/domainBoundaryIsolation.test.ts` | En parallel write-model, ulovlig import eller død regel kan give skjult datadrift. | `domain-boundary-contract.md`, `page-component-contract.md`, arkitekturdokumenter | statisk/unit | `architectureRules.test.ts`, `deletedLegacyAbsence.test.ts`, `domainBoundaryIsolation.test.ts`, `eetDomainIsolation.test.ts`, `consumerInventory.test.ts` | Registry-completeness er tilføjet med en separat forventningsliste på 88 regel-ID'er. Suiten bestod med 189 tests efter eksplicitte modcases for autoriseret transitiv re-export, uautoriseret re-export og ikke-vakuøse livenessmål. Øvrige reglers modfejl og importgrænser er ikke fuldt triageret. | I gang |
| ARCH-003 | Kvalitets-, sprog-, dependency- og releaseværn – `src/__tests__/quality/**`, `scripts/**`, `.github/workflows/**` | Et grønt værn kan være dødt, omgåeligt eller ikke kørt i releaseforløbet. | `AGENTS.md`, release-scripts og de relevante contracts | statisk/unit/CI | `acceptanceMatrix.test.ts`, `testNamingConvention.test.ts`, `packageManifestCheck.test.ts`, `toolIsolationCheck.test.ts`, `vulnerabilityCheckRetry.test.ts` | Lane-vagten er styrket til syntaksbevidst parsing af single-/double-quoted tags og arrays; `e2eSuiteConventions.test.ts` har 20 grønne tests, og `check:e2e-lanes` er grøn. Øvrige releaseværn og CI-kobling er ikke fuldt revideret. | I gang |
| SHELL-001 | Auth, bootstrap, routing og hovedapp-shell – `src/main.tsx`, `src/App.tsx`, `src/config/pageNavigation.ts`, `src/components/layout/**` | Brugeren kan blive afvist forkert, lande på forkert side, miste shell-state eller navigere før lazy mount. | `auth-gate-contract.md`, `app-shell-contract.md`, `page-component-contract.md` | unit/integration/E2E | `auth/**`, `App.appShell.test.tsx`, `App.defaultLandingRoute.test.tsx`, `components/layout/**`, `e2e/mineo-smoke.spec.ts`, `e2e/shell-shortcuts-and-not-found.spec.ts` | Auth, 11 app-routes, default landing, 404 med bevaret sag, minimumsviewporter og alle målte desktop-gate-sideeffekter er gennemgået; E2E-baseline er grøn. Ægte mobil-hard-stop mangler fortsat under `TD-021`. | I gang |
| SHELL-002 | System- og browsergates – `UnsupportedDevicePage`, `PageNotFound`, `OpenEo`, PWA/service worker og preload-recovery | Mobil/tablet kan få adgang til appen, 404 kan ændre sagen, eller PWA-/lazy-load-flow kan fejle. | `app-shell-contract.md`, PWA-/auth-dokumentation | unit/integration/E2E | `apps/shared/**`, `apps/mineo/**`, `components/system/**`, `schemas/pwaFileOpenRequestSchema.test.ts`, `e2e/pwa-*.spec.ts`, `e2e/shell-shortcuts-and-not-found.spec.ts` | Unsupported-device-isolation, 404, service worker, PWA-installation, `/open` og browserfaldgruber er gennemgået med grønne målrettede tests. Faktisk manglende lazy chunk → synlig recovery og ægte mobil-hard-stop i browseren mangler; `TD-021` og `TD-022` står åbne. | I gang |
| INPUT-001 | Input-aggregate, feltadresser, catalog og editor/settle-engine – `src/inputCore/**` | Draft kan nå beregning/save, rejected tekst kan sameksistere med canonical, eller input kan forsvinde ved sync. | `form-contract.md`, `input-field-behavior-contract.md`, `amount-contract.md` | unit/integration | `inputCore/inputCore.test.ts`, `inputCore/editor/fieldEditor.test.ts`, `inputCore/runtime/dispatchInput.test.ts`, `inputCore/runtime/commandInvariants.test.ts`, `inputCore/runtime/inputReferenceControl.test.ts`, `inputCore/stateChains.test.ts` | Acceptance-registret kobler kerneinvarianter til leaf-tests. En kontrolleret mutation af no-op-gaten gav 51 fejl i 146 runtime-tests; den gendannede kode bestod 103/103 i kontrolkørslen. En separat reference-model bestod settle/no-op/undo/redo/ny-gren-forløbet med 1/1 test. En fokuseret revision af 63 filer / 1.469 tests fandt fortsat et form/grid-paritets- og fixture-uafhængighedshul. | I gang |
| INPUT-002 | Form-, grid-, tabel- og keyboard-adaptere – `src/inputCore/react/**`, `src/components/tables/**` | Form og tabel kan få forskellig settle-, fokus-, undo- eller issue-adfærd. | `form-contract.md`, `keyboard-navigation.md`, `mineo-field-pattern.md`, `undo-redo-contract.md` | integration/E2E | `inputCore/react/fieldContract.surfaces.test.tsx`, `useFormFieldSurface.test.tsx`, `gridAdapter.test.tsx`, `historyRestoreTarget.test.tsx`, `components/tables/tableKeyboardNavigation.*`, `e2e/satser-tab-settle.spec.ts` | Den målrettede flade er bred og dækker samme settle-/Escape-/immediate-commit-motor på form og grid, men den bruger delvist et håndskrevet testkatalog. En faktisk produktions-ChoiceField på begge surfaces mangler som symmetrisk paritetstest. | I gang |
| VALID-001 | Zod-schemas, parsing, normalisering og domænevalidering – `src/schemas/**`, `src/validators/**`, `src/utils/*Validation*` | Ugyldige data accepteres, fejlstrukturen peger forkert, eller schema/type og runtime adskilles. | `schema-evolution.md`, `error-contract.md`, input-/date-/amount-contracts | unit/integration | `schemas/**`, `utils/inputValidation.test.ts`, `utils/zodIssueFormatting.test.ts`, `validators/erstatningsopgoerelseValidator.test.ts` | Baseline er grøn, men nested row-schemaernes unknown/missing/invalid-partitioner og fixture-uafhængighed er ikke systematisk bevist. `zodIssueFormatting.test.ts` bruger desuden syntetiske issues i stedet for faktiske `ZodError.issues`. | I gang |
| PERSIST-001 | `.eo`-schema, codec, save/load, migrering, preflight og atomisk apply – `src/persistence/**`, `src/utils/file*.ts` | Sagsdata kan gå tabt, gammel fil kan blive ulæselig, eller afvisning kan mutere aktiv sag. | `persistence-contract.md`, `schema-evolution.md` | unit/integration/E2E | `persistence/**`, `utils/eoFileCodec.test.ts`, `fileRoundTrip.fullState.test.ts`, `persistenceMigrations.test.ts`, `fileLoad.normalLoad.test.ts`, `utils/historicalEoFixtures.test.ts`, `e2e/file-load-validation.spec.ts` | Den eksisterende persistence-suite står på 25 filer / 238 tests, og `fileRoundTrip.independentReference.test.ts` tilføjer en fuld save → ægte codec → load-sammenligning mod et håndskrevet facit. Der findes fortsat ingen `.eo`-artefakter fra faktiske tidligere udgivelser; TD-001 står derfor åbent for proveniens. | I gang |
| PERSIST-002 | Browserlagre, settings, filhåndtag og sessionbevaring – `src/settings/**`, `src/utils/*Storage*`, `src/hooks/useFileSaveLoad.ts` | Reload, storage-fejl eller filkapabilitetsmangel kan nulstille input eller skjule fejl. | `persistence-contract.md`, `app-settings.md`, `app-shell-contract.md` | unit/integration/E2E | `settings/**`, `utils/safe*Storage.test.ts`, `fileHandleStorage.test.ts`, `hooks/useFileSaveLoad.test.tsx`, `hooks/usePersistedActiveTab.test.tsx`, `persistence-reload-session.spec.ts`, PWA-E2E | 15 fokuserede filer / 180 unit- og hook-tests samt 5/5 målrettede PWA-/reload-E2E-tests er grønne. Reel input + aktiv fane + browser-reload er nu bevist; File API-capability, IndexedDB-sammenhæng og flere storage-fejlveje står fortsat åbne i `TD-017`. | I gang |
| DATE-001 | Dato-, periode-, afrundings- og pengebasis – `src/domain/dates/**`, `src/domain/money/**`, `src/utils/{date*,rounding*,fraction*}` | Off-by-one, forkert tidszone, enhed eller afrunding ændrer beløb, perioder eller gate. | `date-contract.md`, `periodisering-contract.md`, `amount-contract.md` | unit/integration | `domain/dates/**`, `domain/money/**`, `utils/date*.test.ts`, `utils/rounding*.test.ts`, `utils/fraction.test.ts`, `utils/utcDayMath.test.ts` | Money-fladen er mutationstestet med 56/58 dræbte mutationer. Dato-/SH-suiten er styrket til 106 grønne tests med præcise range-fejl, eksakt 2024-facit og et håndberegnet skudårsinterval. `TD-003` står åbent for ugyldige `Date`-instanser i `utcDayMath`, og `TD-010` dokumenterer et rettet misvisende testnavn. | I gang |
| DATA-001 | Satser, reguleringer og data-/coverage-kataloger – `src/data/**`, `src/data/catalog/**` | Manglende, overlappende eller forkert gyldighedsdata giver forkert opslag eller skjult beregningshul. | `calculation-data-contract.md`, domænecontracts | unit/statisk/integration | `data/**`, `data/calculationDataCatalog.test.ts`, `data/rateSeriesIntegrity.test.ts`, `data/uafhaengigSatsFacitmatrix.test.ts`, `quality/consumerInventory.test.ts` | 23 data-/satserfiler med 476 tests er grønne og dækker katalog, fingerprints, huller, overlap, sortering, bounds, udvalgte historiske særtilfælde samt en håndskrevet facitmatrix for lovbestemte satser, referencesats og ILON12/SBLON2. Alle kilderegistrenes endepunkter, validatorpartitioner og komplet downstream-paritet mangler fortsat. Sygedagpengeregistret er bevidst ikke føjet til facitmatricen, fordi den fundne officielle 2005-kilde og produktdata afviger. | I gang |
| CALC-001 | Satser og fælles beregningsdata – `src/domain/satser/**` | Forkert satsår eller kildedata giver forkert visning og downstream-resultat. | `satser-contract.md`, `calculation-data-contract.md` | unit/integration/E2E | `domain/satser/**`, `domain/calculations/satserCalculations.test.ts`, `components/pages/Satser.downloadGate.integration.test.tsx`, `e2e/satser-tab-settle.spec.ts` | De 4 domænefiler / 47 tests dækker satsernes projektion, seed, ASL-maksimum og reguleringsmotorer med historiske bounds. Assertions genbruger dog flere produktionsdata/-helpers som forventning, og en samlet sats → beregning → dokument-projektion mangler. | I gang |
| CALC-002 | Årslønsberegning – `src/domain/aarsloen/**`, `src/components/pages/Aarsloen.tsx` | Forkert periodisering, tillæg, ferie/fravær eller rækkesum ændrer årsløn og dokument. | `aarsloen-contract.md`, `periodisering-contract.md`, `amount-contract.md` | unit/integration/E2E | `domain/aarsloen/**`, `components/pages/Aarsloen.integration.test.tsx`, `e2e/download-tooltip-classes.spec.ts` | Method C dag har en eksplicit hel-kalendermånedstest, og `aarsloenIndependentOracle.test.ts` tilføjer håndberegnet Metode A/B/C, nul- og feriegrænser. De to filer bestod samlet med 34 tests. Procentbaserede tillæg, dag-fallback, ugeløn, downstream-paritet og fuld brugerrejse mangler. | I gang |
| CALC-003 | Renteberegning – `src/domain/renteberegning/**`, `src/components/pages/Renteberegning.tsx` | Forkert renteperiode, sats, enhed eller rækkegate ændrer krav og renteoversigt. | `renteberegning-contract.md`, `date-contract.md`, `amount-contract.md` | unit/integration/E2E | `domain/renteberegning/**`, `components/pages/Renteberegning.integration.test.tsx`, `components/pages/renteberegning/SpecifikationDownloadBox.test.tsx`, `pdf/renteberegning/**` | Oracle-sporet kontrollerer første startdato, sidste slutdato, daglig kontinuitet, inklusive dagtal og nu også håndberegnede 30. juni/1. juli-, årsskifte- og 2013-skudårsnære perioder med satser og rente. De to oracle-filer bestod samlet med 11 tests. Standalone-delingen, øvrige branches og uafhængig UI-/PDF-/Word-kontrol mangler. | I gang |
| CALC-004 | Varige mén – `src/domain/varigemen/**`, `src/components/pages/VarigeMen.tsx` | Forkert méngrad, satsår, datoafgrænsning eller gate giver forkert erstatning eller dokument. | `varigemen-contract.md`, `date-contract.md`, `amount-contract.md` | unit/integration/E2E | `domain/varigemen/**`, `components/pages/varigemen/**`, `e2e/download-tooltip-classes.spec.ts` | Målrettet varige mén-flade bestod med 9 filer / 81 tests. Den dækker bl.a. méngrad 1/120/121, satsår, alderstrin 39–70, datoorden, afrunding og gate/projektion. Uafhængig mutationsprøve, fuld E2E-rejse og outputparitet mangler. | I gang |
| CALC-005 | Forsørgertab – `src/domain/forsoergertab/**`, `src/components/pages/Forsoergertab.tsx` | Forkert kønsgren, periode, fælles årsløn eller difference ændrer resultatet. | `forsoergertab-snapshot-contract.md`, `date-contract.md` | unit/integration/E2E | `domain/forsoergertab/**`, `components/pages/Forsoergertab.integration.test.tsx`, `e2e/forsoergertabResterendePeriode.spec.ts` | Målrettet flade bestod med 7 filer / 81 tests. Den dækker snapshot-/reader-gates, kønsafhængige tabeller, perioder, minimumssats, maksimum, restperiode og EAL/ASL-afhængigheder. Uafhængig efterregning, fuld E2E-rejse og dokumentparitet mangler. | I gang |
| CALC-006 | Erstatningsopgørelse, rækkeevaluering og EO-inspektion – `src/domain/erstatningsopgoerelse/**`, `src/domain/eoRowEvaluation/**`, `src/domain/eoInspektion/**` | Forkert rækkeprioritet, TAF-/svie-/lønperiode, issue eller downstream-projektion ændrer opgørelse/dokument. | `eo-snapshot-contract.md`, `periodisering-contract.md`, `domain-boundary-contract.md`, relevante EO-contracts | unit/integration/E2E | `domain/erstatningsopgoerelse/**`, `domain/eoRowEvaluation/**`, `domain/eoInspektion/**`, `components/pages/erstatningsopgoerelse/**`, EO-E2E-specs | To uafhængige EO-orakler bestod med samlet 8 tests: snapshot-oraklet kontrollerer totals, dokumentprojektion, inspektionsdage og dependency-/clampadfærd, mens inspection-oraklet kontrollerer page-view-model, orphan-sektioner, dagsfordeling og kontroltabeller. Weekendydelsesscenariet viser samtidig en eksisterende `control:sammentaelling_mismatch`, som blokerer dokumentet; TD-016 kræver domæne-/produktbeslutning. Den øvrige delrækkevise audit er åben. | I gang |
| CALC-007 | Erhvervsevnetab – `src/domain/erhvervsevnetab/**`, `src/components/pages/Erhvervsevnetab.tsx` | Forkert ASL/EAL-grundlag, kapitalisering, løbende ydelse, difference eller aldersreduktion ændrer resultatet. | `eet-snapshot-contract.md`, `snapshot-contract.md`, `domain-boundary-contract.md` | unit/integration/E2E | `domain/erhvervsevnetab/**`, `components/pages/Erhvervsevnetab.integration.test.tsx`, EET-E2E-specs | Den målrettede flade bestod med 23 filer / 420 tests, og `eetIndependentOracle.test.ts` tilføjer en håndberegnet samlet totalsag med 1/1 grøn test. Seks EET-E2E-specs bestod med 23/23 tests, men dokumentindhold og en samlet fem-fane-/Word-rejse mangler fortsat. | I gang |
| DOC-001 | Dokumentkatalog, definitioner, gates og lifecycle – `src/document/definition/**`, domænenes `*DocumentDefinition*` | Et output kan bruge forkert input, forkert gate eller forkert format-/fejlpolitik. | `document-output-contract.md`, `document-format-contract.md` | unit/integration/E2E | `document/documentCatalogCompleteness.test.ts`, `document/documentGate*.test.ts`, `document/documentGateDownloadLifecycleIndependent.test.ts`, `document/documentLifecycleMatrix.test.ts`, `document/documentRendererWiring.test.ts` | Katalog- og lifecycle-suiterne er grønne: 8 fokuserede filer / 96 tests og 22 dokumentfiler / 232 tests i den bredere kontrol. Det nye selvstændige spor beviser generisk reel gate-vs-download-separation og tidlig blokering; per-output standalone-lifecycle, fuld lifecycle-matrix og generel PDF/Word-paritet er fortsat åbne som TD-012–TD-014. | I gang |
| DOC-002 | PDF-generator, layout og rendered output – `src/pdf/**`, `src/document/generators/**`, `src/document/layout/**` | PDF kan indeholde forkert tekst/tal, manglende afsnit, overlap eller forkert sideskift. | `document-format-contract.md`, `document-output-contract.md` | unit/golden/integration/E2E | `pdf/**`, `document/*golden*`, `document/layout/**`, `utils/pdf/**`, E2E-downloads | 24 dokument-/PDF-filer med 161 tests er grønne for generatorgrene, tekst/tal, valgfri sektioner, writer-layout og form-routing. Faktisk PDF-parse/render, uafhængig semantisk paritet og fysisk sideskiftskontrol mangler. | I gang |
| DOC-003 | Word-generator og fælles writer-paritet – `src/docx/**` | Word kan afvige fra PDF i input, tal, gates eller layoutrelateret indhold. | `document-format-contract.md`, `document-output-contract.md` | unit/integration/E2E | `docx/**`, `document/documentGateFormatInvariance.test.ts`, relevante PDF/Word-E2E | Word-blobs pakkes ud og kontrolleres som ZIP/XML, men åbnes ikke i Word/LibreOffice og sammenlignes ikke semantisk med PDF. Goldens er implementation-koblede. | I gang |
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
| MIN-001 | Standalone MinProcesrente – `src/apps/minprocesrente/**`, shared renteberegning | Standalone kan blande hovedappens auth/settings/persistens ind eller vise et andet resultat end den delte engine. | `app-shell-contract.md`, `renteberegning-contract.md` | unit/integration/E2E | `apps/minprocesrente/**`, `quality/minprocesrenteStandaloneIsolation.test.ts`, `apps/minprocesrente/standaloneCalculatorPage.test.tsx`, `e2e/minprocesrente-recovery-and-focus.spec.ts`, `e2e/minprocesrente-valid-download.spec.ts` | Isolation, namespace, error boundary, reset/fokus, valid beregning, aktive gates, faktisk PDF-download og exit-guard er gennemgået; E2E-baseline er grøn. Browserbaseret namespace-/runtime-isolation mangler fortsat under `TD-023`. | I gang |
| BUILD-001 | Build, entry points, lazy chunks, PWA-assets og scripts – `vite.*.config.ts`, `scripts/**`, `public/**`, `sw/**` | En release kan bygge grønt men levere forkert app, manglende asset, forkert chunk eller ikke-startbar PWA. | `app-shell-contract.md`, build-/release-scripts | statisk/build/E2E | `scripts/**`, `quality/pwaHeaders.test.ts`, `quality/architecture/rules/**`, `apps/shared/vitePreloadRecovery.test.ts`, E2E-buildserveren | `verify-build-artifacts.mjs` verificerer nu, at alle PWA-assetstier findes i `outDir`, og PWA-pluginet udelader Vites nul-byte CSS-facade-chunks, som ikke skrives til buildet. Syntetisk positiv/negativ test bestod 2/2, almindeligt Mineo-build bestod, og E2E-buildserveren startede igen med EET-browserrejsen 4/4 grøn. B-001 er lukket. Chunk-advarslen, Vite native-advarslen og CI’s separate deploy-artifact-test står åbne til triage. | I gang |

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
| Inventar-ID / gennemgået revision | `PERSIST-001` / `32c6caa9` |
| Funktion og bruger-/systemkonsekvens ved fejl | `.eo` skal gemme alt canonical sagsinput, afvise rejected input, bevare historiske værdier ved load og anvende et godkendt snapshot atomisk. En fejl kan give datatab, forkert beregning efter load, tavs ændring af en gammel sag eller overskrivning af forkert fil. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/persistence-contract.md` §§1.1–6, `src/contracts/schema-evolution.md`, `src/config/persistenceRegistry.ts`, `src/config/persistenceVersion.ts` og `src/utils/schemaFingerprint.ts`. `persistenceCompatibility.test.ts` og `persistenceVersionDrift.test.ts` er versionsværn, ikke alene bevis for semantisk kompatibilitet. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | InputReader/save-projektion, Zod-schemas, sektionsmigratorer og sanitization, `EoFileCodec`, krypteret filkilde/-mål, preflight-tællinger, pending load, atomisk apply/replace, sessionStorage, IndexedDB-filhandles, PWA-request og metadata-synkronisering. |
| Eksisterende testfiler og testnavne | 25 filer blev kørt samlet. Centrale spor er `persistence/caseFileOperations.test.ts`, `persistence/caseResetOperations.test.ts`, `persistence/eoSaveProjection.test.ts`, `persistence/persistedLoadAdapter.test.ts`, `utils/fileRoundTrip.fullState.test.ts`, `utils/fileLoad.normalLoad.test.ts`, `utils/persistenceMigrations.test.ts`, `utils/persistenceLoadSanitization.test.ts`, `utils/persistenceLoadApply.test.ts`, `utils/fileSave.test.ts`, `utils/fileSaveTarget.test.ts`, `utils/eoFileCodec.test.ts`, `utils/historicalEoFixtures.test.ts`, `schemas/eoFileSchema.test.ts` og `hooks/useFileSaveLoad.test.tsx`. Derudover dækker `e2e/file-load-validation.spec.ts` filfejl samt legacy-load gennem preflight og overskrivningsbekræftelse. |
| Manglende test, svage assertioner eller dubletter | Repository-søgning og git-objekter indeholder ingen `.eo`-artefakter fra faktiske tidligere udgivelser. Der er tilføjet fem versionsmærkede, krypterede testfixtures – legacy uden version samt 1.0.4, 3.10, 3.12 og 3.13 – genskabt ud fra de historiske inline-payloads og den dokumenterede AES-GCM-protokol. `historicalEoFixtures.test.ts` sender de faktiske bytes gennem dekryptering, versionsadapter og sektionsschemas. Den nye `fileRoundTrip.independentReference.test.ts` sammenligner hele save → codec → load-strukturen mod et statisk håndskrevet facit. TD-001 står fortsat åbent for proveniens fra faktiske offentliggjorte filer. Fuld assertion-, overlap- og dubletrevision samt mutationsprøve er ikke afsluttet. |
| Valgt testniveau og begrundelse | Unit for schemas, migrering, sanitization, codec og filkilder/-mål. Integration for save-/load-projektion, atomisk apply, session- og metadataflow. Den nye referencekontrol bruger den faktiske save-/codec-/load-kæde, men holder forventningen uden for schemas og factories. E2E dækker den synlige preflight-/overskrivningsrejse og browserens filvælger. |
| Mutation/modprøve og resultat | Ikke gennemført på persistence-fladen. Den kvalificerede command-runner er foreløbig kun afprøvet på `src/domain/money/money.ts`; der er heller ikke kørt en kontrolleret svækket assertion eller en uafhængig referenceimplementering for denne række. |
| Kørte kommandoer, miljø og artefaktlink | Den eksisterende målrettede persistence-kørsel: 25 filer / 238 tests bestået på 13,92 s. Ny kontrol: `npx vitest run src/__tests__/utils/fileRoundTrip.independentReference.test.ts --reporter=dot` – 1/1 test bestået på Node `v24.18.0`/Windows. Vite udsendte den kendte `configLoader: 'native'`-advarsel. |
| Fund-ID'er, beslutninger og opfølgning | `TD-001` er et åbent test-evidensfund, ikke et konstateret produktdatatab. Den uafhængige struktursammenligning er nu tilføjet; de fem genskabte fixtures skal stadig suppleres med proveniens fra faktiske offentliggjorte filer eller en udtrykkeligt accepteret erstatning. Gentag derefter alle relevante migreringsgrene og kør persistence-fladens mutationsprøve. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `PERSIST-002` – browserstorage og filhandles

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `PERSIST-002` / arbejdsrevision efter `c5064a87` |
| Funktion og bruger-/systemkonsekvens ved fejl | Sessionstorage, device-local settings og gemte filhandles skal være best-effort uden at forveksles med sagsdata. En fejl kan nulstille aktiv fane eller indstilling, vælge forkert filkilde eller skjule, at browserens storage/File API ikke kan bruges. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/persistence-contract.md`, `src/contracts/app-settings.md`, `src/contracts/app-shell-contract.md`, `src/utils/fileSystemAccess.ts`, `src/utils/fileLoadSource.ts` og `src/utils/fileSaveTarget.ts`. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | `safeLocalStorage`, `safeSessionStorage`, settings-parser/-storage, persisted active tab, IndexedDB-filhandle-store, File System Access API, manuel filvælger, PWA-filåbning, bootstrap/device-gate og `useFileSaveLoad`. |
| Eksisterende testfiler og testnavne | Målrettet storage/settings-kontrol: 15 filer / 180 tests, bl.a. `safeLocalStorage.test.ts`, `safeSessionStorage.test.ts`, `fileHandleStorage.test.ts`, `useFileSaveLoad.test.tsx`, `usePersistedActiveTab.test.tsx`, settings-schemas/parser og storage-isolation. E2E-kontrollen omfattede filvalidering, PWA-filåbning og service worker med 4/4 i den lokale kørsel; den nye `persistence-reload-session.spec.ts` bevæger en afsluttet værdi og aktiv fane gennem en reel browser-reload med 1/1; den bredere agentkontrol bestod med 6/6 relevante specs. |
| Manglende test, svage assertioner eller dubletter | `fileSystemAccess.ts` tester kun property-eksistens, så `undefined` eller ikke-funktionelle picker-properties kan vælge FSA-grenen og fejle i stedet for fallback. `usePersistedActiveTab.test.tsx` tester kun jsdom-mount, ikke reel browser-reload med både input og aktiv fane. `useFileSaveLoad.test.tsx` og `fileHandleStorage.test.ts` mocker grænserne, så hook, IndexedDB og File API ikke er bevist sammen. `safeLocalStorage.test.ts` har desuden en historisk isolationstitel, der kun hævder et brugbart storage og ikke faktisk isolation. |
| Valgt testniveau og begrundelse | Unit/integration beviser fejlretur, schema og orchestration; E2E er nødvendig for page reload, login/session og de reelle browserkapabiliteter. Platformscases skal holdes adskilt fra hook-tests, så mocks ikke bliver falsk platformbevis. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på storage-/File API-fladen. De eksisterende tests er grønne, men adskillelsen mellem platform og orkestrering er et dokumenteret evidenshul. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/settings src/__tests__/utils/safeLocalStorage.test.ts src/__tests__/utils/safeSessionStorage.test.ts src/__tests__/utils/fileHandleStorage.test.ts src/__tests__/hooks/useFileSaveLoad.test.tsx src/__tests__/hooks/usePersistedActiveTab.test.tsx src/__tests__/contexts/AppSettingsContext.test.tsx src/__tests__/quality/appSettingsContractIsolation.test.ts src/__tests__/quality/newCaseSettingsDefaults.test.ts src/__tests__/quality/noDirectLocalStorageAccess.test.ts src/__tests__/config/storageManifest.test.ts --reporter=dot` – 15 filer / 180 tests. `npm run test:e2e -- e2e/file-load-validation.spec.ts e2e/pwa-file-open.spec.ts e2e/pwa-service-worker.spec.ts` – 4/4 tests. `npm run test:e2e -- e2e/persistence-reload-session.spec.ts` – 1/1 test; første kørsel ramte en forbigående manglende `dist/mineo/index.html`, anden kørsel byggede artefakten og bestod. Node `v24.18.0`/Windows; E2E-buildserveren blev lukket af testscriptet. |
| Fund-ID'er, beslutninger og opfølgning | `TD-017` registrerer File API-detektion, IndexedDB-/hook-sammenhæng og de resterende storagefejlveje som åbne evidenshuller. Den nye test lukker den konkrete browser-reload/session-del for afsluttet input og aktiv fane. En rettelse af capability-detektionen kan ændre brugerens fallback-/fejloplevelse og forelægges udvikleren før produktændring. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `INPUT-001` / `INPUT-002` / `VALID-001`

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `INPUT-001`, `INPUT-002`, `VALID-001` / arbejdsrevision efter `1cb0b07b` |
| Funktion og bruger-/systemkonsekvens ved fejl | Inputkernen skal holde draft, afsluttet canonical værdi og rejected råtekst adskilt, mens formularer og tabeller bruger samme settle-/historymotor. Schemas og validering skal afvise ukendt eller strukturelt ugyldigt input uden at miste gyldige værdier. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/form-contract.md`, `src/contracts/input-field-behavior-contract.md`, `src/contracts/keyboard-navigation.md`, `src/contracts/undo-redo-contract.md`, `src/contracts/schema-evolution.md` og `src/contracts/error-contract.md`. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Input-aggregate, FieldRef/editorfacade, form/grid-adaptere, row identity/history, InputReader, Zod-schemaer, normalisering, issues og save-/load-projektion. |
| Eksisterende testfiler og testnavne | Den fokuserede kontrol omfattede 63 filer / 1.469 tests under `src/__tests__/inputCore`, `src/__tests__/schemas`, `src/__tests__/validators` og udvalgte quality-tests. Centrale spor er `inputCore.test.ts`, `fieldEditor.test.ts`, `fieldContract.surfaces.test.tsx`, `gridAdapter.test.tsx`, `commandInvariants.test.ts`, `inputReferenceControl.test.ts`, `formSchemas.test.ts` og `erstatningsopgoerelseValidator.test.ts`. |
| Manglende test, svage assertioner eller dubletter | XOR, settle/Escape/immediate commit, no-op, undo/redo og rækkeidentitet er solidt dækket. Form/grid-paritetstesten bruger dog delvist et håndskrevet testkatalog, og der mangler en symmetrisk dropdown-test med samme produktionsfelt på begge surfaces. Nested row-schemaernes unknown/missing/invalid-partitioner er heller ikke systematisk bevist, og validatorfixtures genbruger ofte produktionsdefaults. `zodIssueFormatting.test.ts` bruger syntetiske issue-objekter frem for faktiske `ZodError.issues`. |
| Valgt testniveau og begrundelse | Unit-/runtime-tests er den rigtige grænse for state- og XOR-invarianter; form/grid-integration skal bevise surfaceparitet, og schemas/validators skal prøve den konkrete Zod-struktur. Den eksisterende uafhængige reference-model og den kontrollerede no-op-modprøve er bevaret som særskilt modbevis. |
| Mutation/modprøve og resultat | Den kontrollerede no-op-modprøve gav 51 fejl i 146 tests, mens gendannet kode bestod 103/103. Der er ikke kørt en fuld mutation på hele input-/schemafladen. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/inputCore src/__tests__/quality/acceptanceMatrix.test.ts src/__tests__/quality/contractCoverageMatrix.test.ts src/__tests__/quality/errorContractIsolation.test.ts src/__tests__/quality/eoFieldVisibilitySingleSource.test.ts src/__tests__/quality/eoRowGateUniqueContribution.test.ts src/__tests__/quality/freshSectionDefaults.test.ts src/__tests__/quality/freshCaseChoiceSweep.test.ts src/__tests__/schemas src/__tests__/validators --reporter=dot` – 63 filer / 1.469 tests bestået på Node `v24.18.0`/Windows. En separat review af de centrale seks filer bestod med 438/438. |
| Fund-ID'er, beslutninger og opfølgning | `TD-019` registrerer form/grid-paritet, nested Zod-partitioner og fixture-uafhængighed. Test-only styrkelser kan tilføjes uden ændring af runtime; ingen beregnings- eller loadadfærd må ændres som del af dette spor. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `DATE-001` – money-fladen

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `DATE-001` / `1389d93c1e8d78f6381cd1cec83bedc40b4f6a48` |
| Funktion og bruger-/systemkonsekvens ved fejl | Money-typerne er grundlaget for enheder, fortegn, overflow, faktorberegning og afrunding. En fejl kan ændre beløb eller få en ugyldig numerisk værdi ind i beregningen. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/amount-contract.md`, `src/domain/money/money.ts` og de tilhørende Zod-schemas. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | `moneyOre`, `fromKroner`, `toKroner`, addition/subtraktion, skalering, nul-clamp og `roundHeleKroner`. |
| Eksisterende testfiler og testnavne | `src/__tests__/domain/money/money.test.ts` – 13 målrettede tests for gyldige værdier, ugyldige heltal, overflow, aritmetik, skalering, nul-clamp, konvertering og half-away-from-zero-afrunding. |
| Manglende test, svage assertioner eller dubletter | Mutationstesten fandt først manglende direkte test af `roundHeleKroner` og en for svag assertion af `moneyOre`'s fejltekst. Begge er styrket. Den uafhængige dato-krydskontrol dækker nu et håndberegnet skudårsinterval. Ét misvisende testnavn (`9` i stedet for `8` SH-dage i 2024) er rettet som `TD-010`. Én numerisk boundary-mutation i `fromKroner` mangler fortsat en repræsentabel diskriminerende case, og den øvrige dato-/periodiseringsflade er ikke fuldt revideret. |
| Valgt testniveau og begrundelse | Unit- og mutationstest af den rene TypeScript-flade. React-/browserbevis er ikke nødvendigt for disse funktioner, men forbrugernes uafhængige beregningskontrol mangler stadig på DATE-001 som helhed. |
| Mutation/modprøve og resultat | StrykerJS 10.0 command-runner med eksplicit Vitest-kommando: 58 mutationer, 56 dræbt, 0 timeout, 0 tekniske fejl. To overlevere er triageret: `< 0` → `<= 0` i nul-clamp vurderes ækvivalent, mens `> 1e-4` → `>= 1e-4` står som åben numerisk triage. |
| Kørte kommandoer, miljø og artefaktlink | `npm run test:mutation` – Node `v24.18.0`/Windows, én worker, omkring 2 minutter. Rapport: `coverage/mutation/mutation.json` og `coverage/mutation/mutation.html` (ignorerede lokale artefakter). |
| Fund-ID'er, beslutninger og opfølgning | `TD-002` dokumenterer den fravalgte officielle Vitest-runner. Gennemgå den åbne numeriske boundary, udfør uafhængig håndregning og fortsæt med dato-/periodefladen. Turing har desuden identificeret en mulig kontraktafvigelse for ugyldige `Date`-instanser; en produktændring skal forelægges udvikleren først. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `DATA-001` / `CALC-001` – data og satser

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `DATA-001`, `CALC-001` / arbejdsrevision efter `c5064a87` |
| Funktion og bruger-/systemkonsekvens ved fejl | De registrerede satser, tabeller og reguleringsserier er fælles kildedata for flere beregninger. Et indre hul, overlap, forkert historisk endpoint eller forkert downstream-felt kan give samme slags forkerte beløb i flere sager. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/calculation-data-contract.md`, `src/contracts/satser-contract.md`, de autoritative registre under `src/data/**` og forbrugergrænserne i domænecontracts. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Data-katalog, payload-fingerprints, årlige og halvårlige rate-serier, offentlig løn, KRL/statistik, overenskomster, kapitaliseringstabeller, satsernes projection/seed og downstream-engine-forbrugere. |
| Eksisterende testfiler og testnavne | 23 filer / 476 tests under `src/__tests__/data`, `src/__tests__/domain/satser` og `quality/consumerInventory.test.ts`. De dækker katalogets 14 registrerede kilder, fingerprints, huller, overlap, sortering, bounds, missing-entry og udvalgte historiske særtilfælde. `uafhaengigSatsFacitmatrix.test.ts` tilføjer fire tests med literal-facit for lovbestemte satser i 2005/2015/2026, EET-reguleringsprocent, referencesats i 2005/2015/2026 og ILON12/SBLON2-kvartaler. |
| Manglende test, svage assertioner eller dubletter | Den nye matrix lukker det konkrete endpoint-/payloadhul for de udvalgte registre, men ikke alle 14 kilder. Sygedagpengeregistret er bevidst udeladt, fordi den fundne officielle 2005-kilde (`https://www.retsinformation.dk/eli/mt/2004/102`) angiver 88,30 kr./time, mens produktdata angiver 88,51 kr./time; facit må ikke gættes. Flere eksisterende facitassertions genbruger fortsat produktionsdata eller helpers: `satserProjection.test.ts`, `aslAarsloensmaksimum.test.ts`, `opreguleringsmotorer.test.ts` og `satserNewCaseSeed.test.ts`. Der mangler en repræsentativ sats → beregning → dokument-projektion samt validatorpartitioner for offentlig løn/statistik/overenskomst. |
| Valgt testniveau og begrundelse | Statisk/unit for komplette registreringer, sortering og payload-form; unit/integration for rate-motorer, seed og projection. En separat uafhængig facitmatrix er nødvendig, fordi et fingerprint kun viser ændring fra baseline, ikke at baseline er domænemæssigt korrekt. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på data-/satsfladen. De eksisterende syntetiske missing/overlap/bounds-modcases bestod, men de dokumenterer ikke alle numeriske historiske værdier. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/data/uafhaengigSatsFacitmatrix.test.ts --reporter=dot` – 4/4. `npx vitest run src/__tests__/data src/__tests__/domain/satser src/__tests__/quality/consumerInventory.test.ts --reporter=dot` – 23 filer / 476 tests bestået på Node `v24.18.0`/Windows. |
| Fund-ID'er, beslutninger og opfølgning | `TD-020` er lukket for de udvalgte literal-endpoints, men står åbent for alle øvrige kilder, validatorpartitioner og downstream-kæde. Test-only matrix- og fixturestyrkelser kan tilføjes; runtime-data eller beregningsændringer forelægges udvikleren. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `CALC-001` – satser og fælles reguleringsdata

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `CALC-001` / `d0bc0672` |
| Funktion og bruger-/systemkonsekvens ved fejl | Satsår, ASL-maksimum og reguleringsindeks bruges af flere beregninger og vises på satser-siden. Et forkert opslag eller en faktor med manglende mellemår kan forplante sig til flere erstatningsberegninger. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/satser-contract.md`, `src/contracts/calculation-data-contract.md`, `src/domain/satser/opreguleringsmotorer.ts` og de kanoniske dataregistre. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Satsårsprojektion, nye sagers default-år, ASL-maksimum, akkumuleret reguleringssats, ASL-indeks, manglende-år og downstream-forbrugere. |
| Eksisterende testfiler og testnavne | `aslAarsloensmaksimum.test.ts`, `opreguleringsmotorer.test.ts`, `satserNewCaseSeed.test.ts` og `satserProjection.test.ts`. |
| Manglende test, svage assertioner eller dubletter | Den målrettede domænesuite har konkrete facit for begge reguleringsmetoder, ikke-heltal/NaN, manglende endepunkter og mellemår, samt projektionens missing/format/bounds. Integration, E2E, data-kildeparitet og fuld downstream-konsumentmatrix mangler. |
| Valgt testniveau og begrundelse | Unit for rene opslag/faktorer og integration for reader-/seedadfærd. Data- og consumerkontrol skal fortsat ligge som separat statisk/integrationsevidens, fordi et unit-facit kan genbruge samme tabel som produktionen. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på satsfladen. Eksisterende tests indeholder uafhængige numeriske faktorer og eksplicitte fail-closed-modcases. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/domain/satser --reporter=dot` – 4 filer / 47 tests bestået på Node `v24.18.0`/Windows. Vite udsendte den kendte `configLoader: 'native'`-advarsel. |
| Fund-ID'er, beslutninger og opfølgning | Ingen nyt fund fra denne baseline. Fortsæt med komponent-/E2E-rejse, dataregistrenes endepunkter og downstream-paritet. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `CALC-002` – Method C dag og hele kalendermåneder

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `CALC-002` / arbejdsrevision efter `faccd49a` |
| Funktion og bruger-/systemkonsekvens ved fejl | `beregnOmregnetAarsloen` skal vælge månedsomregning for dagløn, når de indtastede perioder dækker hele kalendermåneder. En fejl kan give en forkert omregnet årsløn, selv om de øvrige daglønsdata ser gyldige ud. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/aarsloen-contract.md`, `src/contracts/periodisering-contract.md` og `src/domain/aarsloen/aarsloenCalculations.ts`. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | `periodeData.perioder`, `loenperiode`, metode C, `erHeleKalendermaaneder`, `beregnetAarsloen` samt resultatfelterne `omregnetAarsloen` og `antalHeleKalendermaaneder`. |
| Eksisterende testfiler og testnavne | `src/__tests__/domain/aarsloen/aarsloenCalculations.test.ts`: `Metode C dag: hele kalendermåneder bruger månedsomregning` samt fallback-testen for ikke-hele måneder. `aarsloenIndependentOracle.test.ts` dækker håndberegnet Metode A/B/C, eksplicit nul og feriegrænsen. |
| Manglende test, svage assertioner eller dubletter | Den tidligere Method C dag-test havde altid `perioder: []` og dækkede derfor kun hverdagsfallbacken. Den nye test sender januar og februar 2024 som komplette perioder. Det uafhængige orakel tilføjer fem konkrete totalsager, men bruger fortsat engine-outputtet som sammenligningsflade og dækker ikke procentbaserede tillæg, dag-fallback, ugeløn eller UI-/dokumentparitet. |
| Valgt testniveau og begrundelse | Unit-test af den rene beregningsfunktion med konkret input. Den eksisterende branch-test isolerer periodiseringsvalget, mens oraklet holder håndberegnede kroner og periodetal uden at genbruge beregningshelpers til forventningen. Det gør både `60.000 / 2 × 12 = 360.000` og de øvrige metodevalg synlige uden UI eller dokumentgenerator. |
| Mutation/modprøve og resultat | Der er endnu ikke kørt mutation på `aarsloen`-fladen. Den nye test er en målrettet branch-regression med håndberegnet forventning. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/domain/aarsloen/aarsloenCalculations.test.ts src/__tests__/domain/aarsloen/aarsloenIndependentOracle.test.ts --reporter=dot` – 2 filer / 34 tests bestået på Node `v24.18.0`/Windows. Vite udsendte den kendte `configLoader: 'native'`-advarsel. |
| Fund-ID'er, beslutninger og opfølgning | `TD-008` er lukket for den konkrete hele-kalendermåned-branch, og det uafhængige oracle-spor er tilføjet som modprøve. Gennemgå de resterende Method C-/A-/B-branches, procenttillæg, dag-fallback, ugeløn, integration/downstream-paritet og den fulde brugerrejse. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `CALC-003` – procesrente-oraclets periodegrænser

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `CALC-003` / arbejdsrevision efter `faccd49a` |
| Funktion og bruger-/systemkonsekvens ved fejl | Procesrentemotoren skal opdele rentedato-intervallet i sammenhængende halvårsperioder med korrekt sats og dagtal. En manglende første/ sidste dag eller et hul mellem perioderne kan ændre både rente og den synlige specifikation. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/renteberegning-contract.md`, `src/contracts/date-contract.md` og `src/domain/renteberegning/procesrenteCalculator.ts`. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Hovedstol, rentedato, beregningsdato, referencesatser, tillægssatser, halvårsopdeling, skudårsdagtal og `ProcessInterestBreakdown.periods`. |
| Eksisterende testfiler og testnavne | `procesrenteCalculatorOracle.test.ts`: skift ved 1. juli, flerårig periode, skudår, satsbestemmelse og negative referencesatser. `procesrenteBoundaryIndependentOracle.test.ts`: 30. juni/1. juli, 31. december/1. januar og 28. februar/1. marts 2013 med statiske dagtal, satser og rente. |
| Manglende test, svage assertioner eller dubletter | Oracle-testene hævdede tidligere kun, at perioder lå i rækkefølge. Det tillod både et hul før første periode, efter sidste periode eller mellem perioder. Det nye boundary-oracle lukker den konkrete kalendergrænse og kontrollerer samtidig per-periode rente, men standalone-deling, øvrige inputbranches og downstream-output er fortsat åbne. |
| Valgt testniveau og begrundelse | Unit-test på breakdown-outputtet med håndberegnede rente- og dagtal. Begge kontrolspor bruger ikke motorens egne datohelpers til forventningerne, så en fælles fejl i opdeling og forventningsberegning ikke skjules. |
| Mutation/modprøve og resultat | Der er endnu ikke kørt mutation på rentefladen. Den nye kontrol er en uafhængig invariantprøve af outputdækningen. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/domain/renteberegning/procesrenteCalculatorOracle.test.ts src/__tests__/domain/renteberegning/procesrenteBoundaryIndependentOracle.test.ts --reporter=dot` – 2 filer / 11 tests bestået på Node `v24.18.0`/Windows. Vite udsendte den kendte `configLoader: 'native'`-advarsel. |
| Fund-ID'er, beslutninger og opfølgning | `TD-009` er lukket for breakdownets dækningsinvariant og de konkrete kalendergrænser. Gennemgå standalone-delingen, øvrige sats-/inputbranches, UI-/dokumentparitet og uafhængig efterregning af repræsentative output. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `CALC-004` – varige mén

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `CALC-004` / `101f65bc` |
| Funktion og bruger-/systemkonsekvens ved fejl | Varige mén beregner godtgørelse ud fra méngrad, beregningsårets sats og alder ved skadestidspunktet. En fejl kan give forkert erstatning eller en gate, der tillader et dokument uden et gyldigt resultat. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/varigemen-contract.md` §§1–4, `src/contracts/date-contract.md`, `src/contracts/amount-contract.md` samt `computeVarigeMenEngine` som autoritativ engine. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Reader-projektion, engine, `beregnVarigeMenGodtgoerelseWithRates`, satsopslag på beregningsdato, alder ved skade, aldersreduktion, ceil-afrunding, gate og dokumentprojektion. |
| Eksisterende testfiler og testnavne | 9 filer i `src/__tests__/domain/varigemen` og `src/__tests__/components/pages/varigemen`, herunder `varigeMenCalculations.test.ts`, `varigeMenEngine.test.ts`, `varigeMenReaderProjection.test.ts`, `varigeMenDownloadGate.test.ts` og `MenberegningTab.integration.test.tsx`. |
| Manglende test, svage assertioner eller dubletter | Den målrettede stikprøve fandt ingen konkret svag assertion, der bør ændres nu. Unit-fladen hævder de normative méngrad- og aldergrænser samt den viste beløbsafstemning. Den samlede gennemgang skal stadig vurdere mulig overlapning mellem calculations- og engine-testene samt PDF-/Word-paritet og browserrejse. |
| Valgt testniveau og begrundelse | Unit for den rene beregning og aldersgrænser, integration for reader/gate/UI og eksisterende E2E for den synlige downloadrejse. Det følger kontraktens engine-ejerskab og holder UI-bevis adskilt fra talbevis. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på CALC-004. Der foreligger heller ikke en særskilt håndberegnet oracle-fil; flere enhedstests hævder dog konkrete numeriske konstanter uafhængigt af engine-kaldet. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/domain/varigemen src/__tests__/components/pages/varigemen --reporter=dot` – 9 filer / 81 tests bestået på Node `v24.18.0`/Windows. Vite udsendte den kendte `configLoader: 'native'`-advarsel. |
| Fund-ID'er, beslutninger og opfølgning | Ingen nyt fund fra denne stikprøve. Fortsæt med uafhængig talprøve eller mutation, visningsparitet for PDF/Word og samlet browserrejse før rækken kan afsluttes. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `CALC-005` – forsørgertab

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `CALC-005` / `d0bc0672` |
| Funktion og bruger-/systemkonsekvens ved fejl | Forsørgertab samler EAL-krav, ASL-kapitalbeløb, løbende ASL-ydelser og nettokrav. En fejl i tabellen, perioden, kønsgrenen eller dependency-gaten kan ændre en trust-kritisk erstatning eller skjule en gyldig delberegning. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/forsoergertab-snapshot-contract.md` §§1–5, `src/contracts/date-contract.md`, `src/contracts/amount-contract.md` og `computeForsoergertabSnapshot` som autoritativ side-/dokumentprojektion. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | `stamdata`, `forsoergertab`, `faellesAarsloen`, EAL-/ASL-motorer, køn før/efter 1. marts 2015, tilkendt periode, ASL-maksimum, kapitalisering, fælles gate og PDF-projektion. |
| Eksisterende testfiler og testnavne | 7 filer i `src/__tests__/domain/forsoergertab` og `src/__tests__/components/pages/Forsoergertab.integration.test.tsx`, bl.a. `forsoergertabCalculation.test.ts`, `forsoergertabSnapshot.test.ts`, `forsoergertabReaderProjection.test.ts` og `forsoergertabEngineGate.test.ts`. |
| Manglende test, svage assertioner eller dubletter | Stikprøven fandt ingen enkeltstående assertion, der kræver rettelse nu. Der er bred dækning af fail-closed, dependency-grupper og numeriske grænser. Assertions er dog overvejende pipeline- og snapshotinterne; en uafhængig håndberegnet totalsag samt samlet PDF-/Word-/E2E-paritet mangler. |
| Valgt testniveau og begrundelse | Unit for tabeller, periodisering og EAL/ASL-formler, snapshot/reader for dependency- og gateadfærd og integration for den synlige side. Denne opdeling følger snapshot-kontrakten og holder dokumentgaten tæt på den autoritative projektion. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation eller separat uafhængig oracle på CALC-005. Den eksisterende suite bestod, men pipeline-paritet kan ikke alene bevise, at begge halvdele har korrekt fælles facit. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/domain/forsoergertab src/__tests__/components/pages/Forsoergertab.integration.test.tsx --reporter=dot` – 7 filer / 81 tests bestået på Node `v24.18.0`/Windows. Vite udsendte den kendte `configLoader: 'native'`-advarsel. |
| Fund-ID'er, beslutninger og opfølgning | Ingen nyt fund fra denne baseline. Fortsæt med en uafhængig totalsag, stale-/dokumentflow, PDF/Word-paritet og fuld E2E-rejse før rækken kan afsluttes. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `CALC-006` – uafhængigt EO-facit

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `CALC-006` / `03e464fe` |
| Funktion og bruger-/systemkonsekvens ved fejl | Erstatningsopgørelsen samler de afsluttede input i canonical totals, rækkeevalueringer, inspektionsdata, sidevisning og dokumentprojektion. En fejl i rækkeprioritet, periode, issue eller downstream-projektion kan give brugeren et forkert beløb, en misvisende kontroltabel eller et dokument med forkert grundlag. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/eo-snapshot-contract.md`, `src/contracts/snapshot-contract.md`, `src/contracts/periodisering-contract.md`, `src/contracts/domain-boundary-contract.md` og de relevante EO-/inspection-contracts. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Snapshot-input, canonical EO-data, rækkeprioritet, TAF-/svie-/lønperioder, dependency-issues, document gate, `eoInspektion`-kolonner, kontroltabel og `eoInspektionPageViewModel`. |
| Eksisterende testfiler og testnavne | `src/__tests__/domain/erstatningsopgoerelse/**`, `src/__tests__/domain/eoRowEvaluation/**`, `src/__tests__/domain/eoInspektion/**`, `src/__tests__/components/pages/erstatningsopgoerelse/**` og `eoSnapshotIndependentOracle.test.ts`. |
| Manglende test, svage assertioner eller dubletter | Det nye orakel kontrollerer tre håndvalgte snapshotforløb på tværs af canonical totals, dokumentprojektion, inspektionsdage og sidevisning. Den øvrige delrækkevise audit mangler stadig. Weekendydelsesscenariet viser desuden en eksisterende `control:sammentaelling_mismatch`, hvor dokumentet blokeres, selv om snapshot indeholder canonical TAF-værdier. Det kan være bevidst fail-closed, men fallback og brugerens forventede visning er ikke afklaret. |
| Valgt testniveau og begrundelse | Unit- og integrationstest for de enkelte EO-delprojektioner. Det nye oracle holder centrale input, forventede totals og observerede downstream-værdier som statiske konstanter uden at bygge forventningen gennem produktionsfactory eller schema. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på CALC-006. De to orakler er uafhængige modprøver af otte konkrete snapshot-/projektion-sammenhænge; de må ikke læses som bevis for alle rækkegrene. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/domain/erstatningsopgoerelse/eoSnapshotIndependentOracle.test.ts --reporter=dot` – 3/3 tests, og `npx vitest run src/__tests__/domain/eoInspektion/eoInspektionIndependentOracle.test.ts --reporter=dot` – 5/5 tests bestået på Node `v24.18.0`/Windows. Den samlede EO-/inspection-/gate-kørsel bestod med 14 filer / 187 tests. Vite udsendte den kendte `configLoader: 'native'`-advarsel. |
| Fund-ID'er, beslutninger og opfølgning | `TD-016` registrerer den observerede weekendydelse-/TAF-mismatch. Udvikleren skal beslutte, om adfærden er den tilsigtede fail-closed-regel, eller om der kræves ændring af beregning, issue, fallback eller visning. Fortsæt derefter med row-priority, øvrige perioder, inspection-kolonner, sidevisningsgrene, dokumentparitet og E2E. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `CALC-007` – erhvervsevnetab

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `CALC-007` / arbejdsrevision efter `03c8b532` |
| Funktion og bruger-/systemkonsekvens ved fejl | Erhvervsevnetab samler EAL- og ASL-grundlag, kapitalisering, løbende ydelser, differencekrav og aldersreduktion i fem beregningsfaner. En fejl kan både ændre et trust-kritisk beløb og give en fane eller et dokument adgang til et resultat, som en afhængig fane burde blokere for. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/eet-snapshot-contract.md`, `src/contracts/snapshot-contract.md`, `src/contracts/domain-boundary-contract.md`, relevante EET-faner og deres document definitions. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Stamdata, fælles årsløn, EET-input, ASL-afgørelser, EAL-regulering, kapitaliseringsfaktorer, løbende perioder, differencekrav, snapshot-/reader-projektion, download-gates og de fire EET-dokumenter. |
| Eksisterende testfiler og testnavne | 23 filer i `src/__tests__/domain/erhvervsevnetab` og `src/__tests__/components/pages/Erhvervsevnetab.integration.test.tsx`, bl.a. `eetSnapshot.test.ts`, `eetEngineGate.test.ts`, `eetEalCalculation.test.ts`, `eetLoebendeYdelserCalculation.test.ts`, `eetCanonicalOutput.test.ts`, `erhvervsevnetabDownloadGate.test.ts` og `Erhvervsevnetab.integration.test.tsx`. `eetIndependentOracle.test.ts` tilføjer samlet håndfacit. Browserfladen omfatter `eetEfterEalSpecifikation.spec.ts`, `eetForligAnsvarsgrad.spec.ts`, `eetIssueDeduplication.spec.ts`, `eetLoebendeYdelserSpecifikation.spec.ts`, `eetPageAudit.spec.ts` og `eetStamdataDependency.spec.ts`. |
| Manglende test, svage assertioner eller dubletter | Den målrettede suite har bred branch-, issue-, dependency- og gate-dækning, og det nye orakel hævder EAL, ASL-/løbende ydelse, differencekrav og alle fire gates med konkrete beløb. De eksisterende engine-/integrationstests følger dog ikke hele vejen til dokumentets bytes eller tekst: `Erhvervsevnetab.integration.test.tsx` mocker downloadhandlingen, og `eetPageAudit.spec.ts` hævder primært enabled-status/filnavn. Kapitalisering og differencekrav mangler derfor fortsat en samlet indholdsrejse, og EET-specifik Word-dækning mangler. |
| Valgt testniveau og begrundelse | Unit-testene beskytter rene formler, tabeller og perioder; engine-/snapshot-/reader-tests beskytter dependency-rækkefølge og fælles output; integration og E2E dækker synlig navigation og gate. Den næste styrkelse bør være test-only og uafhængig af engine-interne helpers, så pipeline-paritet ikke forveksles med korrekt totalsum. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på CALC-007. Det nye oracle er en uafhængig modprøve af en samlet totalsag, mens den eksisterende suite fortsat primært beviser delbranches og pipeline-status. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/domain/erhvervsevnetab src/__tests__/components/pages/Erhvervsevnetab.integration.test.tsx --reporter=dot` – 23 filer / 420 tests bestået på Node `v24.18.0`/Windows. `npx vitest run src/__tests__/domain/erhvervsevnetab/eetIndependentOracle.test.ts --reporter=dot` – 1/1. De seks EET-specs `eetEfterEalSpecifikation`, `eetForligAnsvarsgrad`, `eetIssueDeduplication`, `eetLoebendeYdelserSpecifikation`, `eetPageAudit` og `eetStamdataDependency` bestod med 23/23; `eetPageAudit.spec.ts` indgik med 4/4. Vite udsendte den kendte `configLoader: 'native'`-advarsel. |
| Fund-ID'er, beslutninger og opfølgning | Den uafhængige totalsag lukker det konkrete facit-hul. `TD-018` registrerer fortsat den manglende engine → snapshot → UI → dokumentindholdsrejse og den asymmetriske fane-/Word-dækning. Tilføj kun test-only dokumentassertions næste gang; eventuelle ændringer af EET-tal eller gateadfærd forelægges udvikleren før implementering. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `DOC-001` – katalog, gates og lifecycle

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `DOC-001` / `ddddd6d9` |
| Funktion og bruger-/systemkonsekvens ved fejl | Hvert dokumentoutput skal bruge den rigtige inputprojektion, gate, renderer og fil-lifecycle. En fejl kan give en download, der ser gyldig ud, men bygger på forkert eller forældet input, eller blokere et dokument på en forkert måde. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/document-output-contract.md`, `src/contracts/document-format-contract.md`, `src/document/definition/documentCatalog.ts`, `documentLifecycle.ts` og de enkelte domænecontracts. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | 18 Mineo-outputs, 3 standalone-outputs, reader-/snapshot-projektioner, gate-reasons, formatvalg, lazy renderer-load, writer-session, render, fil-I/O og source-revisioner. |
| Eksisterende testfiler og testnavne | Den fokuserede kontrol omfattede `documentCatalogCompleteness.test.ts`, `documentDefinitionFixtureRegistry.test.ts`, `documentGateMatrix.test.ts`, `documentGatePreflightParity.test.ts`, `documentGateFormatInvariance.test.ts`, `documentGateDownloadLifecycleIndependent.test.ts`, `documentLifecycleMatrix.test.ts` og `documentRendererWiring.test.ts`. Den bredere dokumentkontrol omfatter 22 filer. |
| Manglende test, svage assertioner eller dubletter | Det nye selvstændige spor lukker TD-011 for den generiske lifecycle-mekanisme: reaktiv `evaluateGate` og reel `executeDocumentDownload` observeres separat, og et friskt blocked-snapshot stopper før renderer, session, render og fil-I/O. TD-012–TD-014 står åbne for per-output/standalone-bevis, flere lifecycle-faser og generel semantisk PDF/Word-paritet. |
| Valgt testniveau og begrundelse | Statisk/unit for katalog og typed wiring, definitionsuafhængig unit for lifecycle-kernen, per-output fixtures for gate/projektion og integration/E2E for de faktiske sider og filflows. Testniveauerne skal holdes adskilt, så en fælles wrapper ikke kan maskere en divergens mellem reaktiv gate og aktivering. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på dokumentfladen. Den eksisterende lifecycle-matrix og katalogsuite bestod, men de selvrefererende parity- og fixtureveje er registreret som utilstrækkeligt uafhængige kontrolspor. |
| Kørte kommandoer, miljø og artefaktlink | Fokuseret kontrol: 8 filer / 96 tests bestået, herunder `documentGateDownloadLifecycleIndependent.test.ts` med 3/3. Bred kontrol rapporteret med 22 filer / 232 tests på Node `v24.18.0`/Windows. Den nye E2E-buildserver startede, og `eetPageAudit.spec.ts` bestod med 4/4 tests. |
| Fund-ID'er, beslutninger og opfølgning | TD-011 er lukket for den generiske gate-vs-download-mekanisme. TD-012–TD-014 er åbne: standalone per-output fixtures, udvidet lifecycle-fejlmatrix og tværgående PDF/Word-paritet. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `DOC-002` / `DOC-003` – fysisk dokumentbevis

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `DOC-002`, `DOC-003` / arbejdsrevision efter `03c8b532` |
| Funktion og bruger-/systemkonsekvens ved fejl | PDF og Word er brugerens dokumenterede resultat. Generatoren skal bevare dansk tekst, tal, datoer, valgfrie sektioner, tabelrækkefølge, sideskift og samme gategrundlag på tværs af formater. En grøn unit-suite kan ellers stadig levere en tom, korrupt eller visuelt ødelagt fil. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/document-format-contract.md`, `src/contracts/document-output-contract.md`, PDF-/Word-generatorerne, layoutmodellerne og de enkelte outputdefinitioner. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | PDF-writer, jsPDF/autoTable, dokumentgeneratorer, layout-/pagebreak-model, Word writer/Packer, OOXML/XML, formatvalg, fil-download og PDF/Word-channel-goldens. |
| Eksisterende testfiler og testnavne | 24 filer / 161 tests dækker PDF-/Word-generatorgrene, tekst/tal, valgfri sektioner, filnavne, PDF-writerens cursor/spacing/tabel/pagebreak og Word-blobs pakket ud som ZIP/XML. `documentGateFormatInvariance.test.ts` dækker gate/routing-invarians. |
| Manglende test, svage assertioner eller dubletter | PDF-goldens bruger mocked jsPDF/autoTable og syntetisk cellegeometri, Word-goldens snapshotter rå XML, og EO-goldens bygger forventningsgrundlag via produktionsprojektion. PDF-testharnessets build kan erstattes med en tom Blob; E2E kontrollerer primært filendelse/filnavn. Der mangler reel PDF-parse/render, Word-åbning/OOXML-validering og en uafhængig semantisk PDF↔Word-paritet for tekst, tal, sektioner, headers/footers og rækkefølge. |
| Valgt testniveau og begrundelse | Unit/golden er velegnet til generator- og layoutinvarianter, men fysisk artefaktkvalitet kræver parsing og rendering af de faktiske bytes. Tværgående semantic parity skal bruge et fælles, uafhængigt facit, ikke to snapshots af hver sin writer. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på dokumentfladen. De eksisterende 161 tests er grønne, men den fysiske PDF-/Word-grænse og semantiske parity er højere-niveau-beviser. |
| Kørte kommandoer, miljø og artefaktlink | Fokuseret dokumentkontrol: 24 filer / 161 tests bestået på Node `v24.18.0`/Windows. Fysisk PDF-parse/render og generel PDF↔Word-paritet er ikke kørt. |
| Fund-ID'er, beslutninger og opfølgning | `TD-012`–`TD-014` dækker per-output lifecycle, lifecycle-matrix og semantisk parity; den fysiske PDF-/Word-parse/render-risiko er fortsat åben. En ny parser-/renderer-dependency skal begrundes særskilt, men kræver ikke ændring af produktkode i sig selv. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `SHELL-001` / `SHELL-002` – shell, browsergates og recovery

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `SHELL-001`, `SHELL-002` / arbejdsrevision efter `50f30cd9` |
| Funktion og bruger-/systemkonsekvens ved fejl | Auth, routing, desktop-gate, 404, PWA og lazy-load-recovery bestemmer, om brugeren overhovedet får en gyldig Mineo-session, og om en fejl stopper sikkert. En fejl kan give adgang på en ikke-understøttet enhed, ændre aktiv sag ved 404 eller efterlade en ufuldstændig side efter en chunk-/preload-fejl. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/auth-gate-contract.md`, `src/contracts/app-shell-contract.md`, `src/contracts/page-component-contract.md`, `src/apps/shared/bootstrapClientApp.tsx`, PWA-/preload-modulerne og routekataloget. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Loginformular og auth-storage, bootstrap-sideeffekter, app-stylesheet/MUI, PWA-installation og service worker, lazy route chunks, preload-recovery, `UnsupportedDevicePage`, `PageNotFound`, OpenEO-queue og MinProcesrente-entry. |
| Eksisterende testfiler og testnavne | 26 fokuserede unit-/integrationstests / 125 tests bestod. Browserkontrollen bestod isoleret for smoke 2/2, shell/404 4/4, minimumsviewporter 12/12, PWA-filåbning 1/1, service worker 1/1, PWA-installation 8/8 og Firefox-fallback 3/3. Centrale spor er `bootstrapClientApp.test.tsx`, `App.appShell.test.tsx`, `App.defaultLandingRoute.test.tsx`, `vitePreloadRecovery.test.ts`, `LazyChunkRecoveryNotice.test.tsx`, `UnsupportedDevicePage.test.tsx`, `shell-shortcuts-and-not-found.spec.ts`, `pwa-*.spec.ts` og `mineo-smoke.spec.ts`. |
| Manglende test, svage assertioner eller dubletter | Den nye bootstrap-test observerer nu, at stylesheet, PWA-filåbning, install-capture, `beforeDesktopRender`, `afterDesktopRenderSetup` og `renderApp` ikke kaldes på en unsupported device, samtidig med at preload-recovery, install-prompt-suppression og hard-stop-rendering sker. Der mangler fortsat ægte browser-hard-stop for mobil. Lazy/PWA-recovery er jsdom-/mockbaseret, ikke en faktisk manglende chunk → synlig recovery → kritisk reload-rejse. Native `launchQueue` kan ikke fuldt fremkaldes i Playwright. `pwa-file-open.spec.ts` bruger desuden egen console-opsamling i stedet for den fælles `runtimeErrors`-fixture. |
| Valgt testniveau og begrundelse | Unit-/integrationstest er nødvendig for bootstrap-sideeffekter og isolerede recovery-branches; E2E er nødvendig for routing, browsermotorer, service worker, install-dialoger og synlig 404-/PWA-adfærd. Browserbegrænsninger skal stå som eksplicit rest-evidens og ikke dækkes af en test, der springer sig selv over. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på shell-/PWA-fladen. Den isolerede E2E-kontrol er grøn, men en samlet parallelkørsel mistede buildserveren efter seks tests med `ERR_CONNECTION_REFUSED`; alle berørte specs bestod ved isoleret genkørsel. Det behandles som harness-/parallelitetsafvigelse, ikke som produktfund. |
| Kørte kommandoer, miljø og artefaktlink | `bootstrapUnsupportedDeviceSideEffects.test.tsx` samt de eksisterende shared-tests bestod med 3 filer / 9 tests. Isolerede E2E-kørsler for shell/404, smoke, minimumsviewporter, PWA, Firefox-fallback og MinProcesrente bestod som angivet ovenfor på Node `v24.18.0`/Windows. |
| Fund-ID'er, beslutninger og opfølgning | `TD-021` er lukket for bootstrap-sideeffekterne, men står åbent for ægte browser-hard-stop på mobil. `TD-022` dækker manglende end-to-end lazy/PWA-recovery og fælles runtime-fejlopsamling. Test-only styrkelse kan tilføjes; ændringer af gate-, recovery- eller PWA-adfærd forelægges udvikleren. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `MIN-001` – standalone MinProcesrente

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `MIN-001` / arbejdsrevision efter `dcded905` |
| Funktion og bruger-/systemkonsekvens ved fejl | Standalone-appen skal bruge den delte procesrente-engine uden at blande hovedappens auth, settings, persistens eller styles ind. En fejl kan give et andet resultat end hovedappen, lække sagsdata mellem appvarianter eller gøre en PDF-download mulig på et ugyldigt grundlag. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/app-shell-contract.md`, `src/contracts/renteberegning-contract.md`, standalone-isolationstests og MinProcesrente-entry-/page-modulerne. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Egen entry, namespace, importgrænser, error boundary, layout, dato-/beløbsinput, beregningsgate, reset/fokus, PDF-output og exit-guard. |
| Eksisterende testfiler og testnavne | `quality/minprocesrenteStandaloneIsolation.test.ts`, `apps/minprocesrente/standaloneCalculatorPage.test.tsx`, `MinProcesrenteApp.fullRender.test.tsx`, `e2e/minprocesrente-recovery-and-focus.spec.ts` og `e2e/minprocesrente-valid-download.spec.ts`. Den nye samlede E2E-test bestod med 1/1. |
| Manglende test, svage assertioner eller dubletter | Den nye browsertest dækker valid dato og beløb, synligt beregnet rente, aktive række-/oversigtsgates, faktisk PDF-download og afvist navigation via `beforeunload`. Isolationstestene er fortsat primært statiske/unitbaserede; browserbaseret namespace-/runtime-isolation mangler. |
| Valgt testniveau og begrundelse | Unit-/integrationstest dækker entry/isolation og komponentens synlige fejl-/resetadfærd; E2E skal bevise den faktiske standalone-brugerrejse og filoutputtet. |
| Mutation/modprøve og resultat | Der er ikke kørt mutation på standalone-fladen. Eksisterende isolationstest og den grønne recovery/fokus-E2E er ikke tilstrækkelige til at bevise en gyldig dokumentrejse. |
| Kørte kommandoer, miljø og artefaktlink | `npm run test:e2e -- e2e/minprocesrente-valid-download.spec.ts --project=chrome-desktop` bestod med 1/1; `e2e/minprocesrente-recovery-and-focus.spec.ts` bestod med 1/1 i isoleret browserkørsel. Den øvrige shell-/standalonekontrol bestod med 26 filer / 125 unit-/integrationstests samt de øvrige angivne E2E-kørsler. |
| Fund-ID'er, beslutninger og opfølgning | `TD-023` er nu lukket for valid input → beregning → gate → PDF og exit-guard, men står åbent for browserbaseret namespace-/runtime-isolation. Test-only styrkelse kan tilføjes; ændringer af procesrente, gate eller synlig outputadfærd forelægges udvikleren. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `ARCH-001` – kontrakt-reference-liveness

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `ARCH-001` / `f53cff61` |
| Funktion og bruger-/systemkonsekvens ved fejl | Kontrakternes navngivne filer og symboler skal afspejle levende kode. Et falsk positivt basename-opslag kan ellers bekræfte en manglende produktionsfil alene fordi et testværn eller en testhelper har samme navn. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/contract-topology.json`, de normative kontrakter og `src/__tests__/quality/contractReferenceLiveness.test.ts`/`contractReferences.ts`. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Kontrakttekst-parser, repo-stier, produktionskildetekst, `present`-/`absent`-undtagelser og referenceprædikater. |
| Eksisterende testfiler og testnavne | `src/__tests__/quality/contractReferenceLiveness.test.ts` med parsergulv, fil-/symbol-liveness, fraværsværn, undtagelser og predicate-modcases. |
| Manglende test, svage assertioner eller dubletter | `sourceBasenames()` medtog tidligere `src/__tests__`, så et bart testfilnavn kunne se levende ud som produktionsreference. Der er tilføjet en regressionstest; eksakte teststier valideres fortsat separat. `wordContentHarness.ts` er registreret som bevidst test-only reference, fordi kontrakten omtaler den som harness. |
| Valgt testniveau og begrundelse | Unit-test af referenceprædikaterne og den fulde kontraktliveness-suite. Det er den laveste grænse, der kan bevise forskellen mellem en repo-sti og et produktionsemne. |
| Mutation/modprøve og resultat | Test-only basename giver nu `false`, mens den eksakte teststi giver `true`; den fulde liveness-suite bestod efter triage. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/quality/contractReferenceLiveness.test.ts --reporter=dot` – 12/12 tests bestået efter undtagelsen, på Node `v24.18.0`/Windows. |
| Fund-ID'er, beslutninger og opfølgning | Den konkrete false-positive-risiko er lukket som `TD-007`. Den semantiske gennemgang af alle kontraktparagraffer og øvrige ARCH-001-værn mangler fortsat. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `ARCH-002` – registry-completeness

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `ARCH-002` / `b13ebf42` |
| Funktion og bruger-/systemkonsekvens ved fejl | Arkitekturharnesset skal håndhæve alle registrerede regler. En regel, der fjernes fra registryet eller aldrig registreres, kan ellers efterlade en ulovlig import eller parallel write-model ubeskyttet, selv om quality-suiten er grøn. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | De relevante arkitekturregler i `src/__tests__/quality/architecture/rules/**`, registryet `ARCHITECTURE_RULES` og `domain-boundary-contract.md`/øvrige arkitekturcontracts. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | Rule-registry, AST/source-graph-kørsel, rule fixtures og den samlede architecture quality-suite. |
| Eksisterende testfiler og testnavne | `src/__tests__/quality/architecture/architectureRules.test.ts` med registry-, manifest-, fixture-, violations- og source-graph-tests. |
| Manglende test, svage assertioner eller dubletter | Den tidligere suite itererede kun over `ARCHITECTURE_RULES` og kunne derfor ikke opdage en regel, der blev glemt i registryet. Der er nu en separat forventningsliste med 88 regel-ID'er og assertion for både manglende og uventede registry-poster. Derudover manglede konkrete modcases for transitiv re-export og vakuøse livenessmål; de er nu tilføjet. |
| Valgt testniveau og begrundelse | Statisk/unit-test af quality-infrastrukturen. En fast forventningsliste er nødvendig, fordi registryet ikke må være sin egen eneste sandhedskilde for completeness. |
| Mutation/modprøve og resultat | Registry-completeness- og modcase-suiten bestod med 189 tests. En fjernet registry-post giver en konkret manglende ID, en uautoriseret re-export giver en konkret finding, og et vakuøst livenessmål afvises; testen ændrer ikke produktkode. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/quality/architecture/architectureRules.test.ts --reporter=dot` – 1 fil / 189 tests bestået på Node `v24.18.0`/Windows. |
| Fund-ID'er, beslutninger og opfølgning | TD-015 lukker de konkrete registry-, re-export- og livenesshuller. Rækken forbliver `I gang`, indtil de øvrige arkitekturmønstre, negative modcases og livenessværn er revideret. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `ARCH-003` – E2E-lane-tag-vagt

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `ARCH-003` / `81b459c1` |
| Funktion og bruger-/systemkonsekvens ved fejl | Lane-vagten skal opdage fejlstavede eller forkert formaterede tags, så browser- og viewportafhængige tests ikke tavst falder tilbage til basisbanen. En grøn, men for snæver suite kan ellers give falsk testdækning. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `AGENTS.md`'s browser-testregler, `e2e/support/lanes.ts`, `scripts/check-e2e-lane-tags.mjs` og `e2eSuiteConventions.test.ts`. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | `run-e2e.mjs`'s preflight, lane-konstanter, `tag:`-optioner i E2E-specs og den separate AST-kontrol af motorafhængige tests. |
| Eksisterende testfiler og testnavne | `src/__tests__/quality/e2eSuiteConventions.test.ts` med syntetiske lane-tag-fixtures samt `npm run check:e2e-lanes`. |
| Manglende test, svage assertioner eller dubletter | Den tidligere regex læste kun single-quoted tags og kunne ikke skelne sikkert mellem kode, kommentarer og strengindhold. Parseren er nu tokenizer-baseret og tester begge citationstyper, arrays og negative tag-/konstantfejl. Den fulde releaseværnsrevision mangler fortsat. |
| Valgt testniveau og begrundelse | En billig, dependency-fri Node-preflight for alle E2E-filer plus målrettede quality-tests for parserens syntaksgrænser. Browserkørsel er ikke nødvendig for selve tag-parseinvarianten. |
| Mutation/modprøve og resultat | En gyldig double-quoted array-fixture bestod, mens ukendt tag og konstant gav de forventede fejl. `check:e2e-lanes` bestod med 2 gyldige tags. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/quality/e2eSuiteConventions.test.ts --reporter=dot` – 20/20 tests bestået; `npm run check:e2e-lanes` – bestået på Node `v24.18.0`/Windows. |
| Fund-ID'er, beslutninger og opfølgning | `TD-006` er lukket for den konkrete parserfejl. Gennemgå de øvrige release-/CI-værn og verificér, at lanesuiten er koblet korrekt til alle relevante E2E-specs. |
| Reviewer / dato / slutstatus | Codex / 2026-09-10 / `I gang` |

### Foreløbig detaljeret gennemgang: `BUILD-001` – PWA-assetreferencer

| Felt | Udfyldes |
| --- | --- |
| Inventar-ID / gennemgået revision | `BUILD-001` / `d9a889ed` |
| Funktion og bruger-/systemkonsekvens ved fejl | Build-verifikatoren skal stoppe et deploybart build, hvis PWA-manifestet peger på en manglende asset. Ellers kan installation eller service-worker-cache først fejle efter release, og en åben session kan mangle lazy chunks. |
| Kontrakt, specifikation, domænedokument eller kilde til forventet adfærd | `src/contracts/app-shell-contract.md`, `scripts/verify-build-artifacts.mjs`, PWA-assetmanifestet og service-workerens asset-path-kontrakt. |
| Relevante indgange, udgange, afhængigheder og sideeffekter | `build:mineo`, `pwa-assets.json`, `sw.js`, `.vite/manifest.json`, `index.html` og `verify-build-artifacts.mjs`'s variantkontroller. |
| Eksisterende testfiler og testnavne | `src/__tests__/quality/verifyBuildArtifacts.test.ts` med syntetisk Mineo-build, komplet asset og manglende asset. |
| Manglende test, svage assertioner eller dubletter | Før ændringen kontrollerede scriptet assetmanifestets format og sti-regex, men ikke at stierne fandtes i buildet. Den negative regressionstest beviser nu den manglende asset-vej. Den integrerede E2E-build afslørede desuden fem nul-byte CSS-facade-chunks, som Vite havde i `bundle`, men ikke skrev til `dist`; de bliver nu filtreret fra PWA-manifestet. CI's separate deploy-artifact og øvrige lazy chunk-referencer er fortsat ikke fuldt dækket. |
| Valgt testniveau og begrundelse | Script-/fixturetest med en ekstern Node-kørsel, fordi verifikatoren arbejder på det færdige `dist` og ikke på React-komponenter. |
| Mutation/modprøve og resultat | Positiv fixture bestod, og negativ fixture fejlede med den konkrete manglende-asset-fejl. `node --check` bestod. |
| Kørte kommandoer, miljø og artefaktlink | `npx vitest run src/__tests__/quality/verifyBuildArtifacts.test.ts --reporter=dot` – 2/2 tests bestået; `npm run build:mineo` bestået; `npm run test:e2e -- e2e/eetPageAudit.spec.ts` bestået med 4/4 tests på Node `v24.18.0`/Windows. |
| Fund-ID'er, beslutninger og opfølgning | B-001 er lukket som `TD-005`. B-002 om at E2E bygger et separat `--mode e2e`-artefakt er fortsat åben og kræver særskilt CI-/releaseafklaring. |
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
| `PERSIST-001` | Unit-/integrationstest af save/load og migrering | Versionsbundne `.eo`-fixtures fra tidligere udgivelser samt uafhængig struktursammenligning | Alle historiske versioner og registrerede migreringsgrene | Fem genskabte fixtures går gennem den faktiske loadgrænse, og en aktuel save → codec → load-sag sammenlignes nu med et statisk håndskrevet facit. Ingen fixture er dokumenteret som en faktisk offentliggjort fil | I gang |
| `PERSIST-002` | Browserstorage, settings, filhandles og sessionbevaring | Unit-/hook-tests mocker fortsat flere platforme; File API-checken accepterer property-navne uden at kræve funktioner | Styrk browser-/platformsgrænsen og fasthold åbne produktbeslutninger særskilt | E2E med input + aktiv fane + reload er nu tilføjet. Test-only integration af File API/IndexedDB kan tilføjes; capability-detektionen må ikke ændres uden forelæggelse | I gang – `TD-017` |
| `CALC-002` | Årsløn, periodisering og metodevalg | Eksisterende tests dækkede ikke Method C dag med hele måneder; flere branches og procenttillæg har fortsat kun pipeline-bevis | Behold eksisterende branch-tests, styrk med uafhængigt oracle | `aarsloenIndependentOracle.test.ts` dækker håndberegnet Metode A/B/C, nul og feriegrænse; 34/34 målrettede tests er grønne | I gang |
| `CALC-003` | Procesrente-perioder, dagtal og rente | Rækkefølgeassertions kunne acceptere udeladte dage og manglede konkrete kalendergrænser | Styrk med to uafhængige oracle-spor | `procesrenteCalculatorOracle.test.ts` og `procesrenteBoundaryIndependentOracle.test.ts` sammenligner nu kontinuitet, dagtal, satser og rente; 11/11 tests er grønne | I gang |
| `CALC-007` | EET-totaler, dependencies og fire dokumentgates | Engine-/snapshot-/UI-tests havde ingen samlet håndfacit og fulgte ikke dokumentindholdet hele vejen | Styrk med uafhængigt totalspor; behold gate-/E2E-bevis | `eetIndependentOracle.test.ts` hævder EAL, ASL/løbende ydelse, differencekrav og alle fire gates med konkrete beløb; 1/1 grøn. `TD-018` står åbent for UI → dokumentindhold og fane-/Word-paritet | I gang |

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
| Samlet Vitest-flade på `1cb0b07b` med audit-testene | Ja | 88,88 % / 80,20 % / 91,71 % / 91,68 % – 20.594 / 16.092 / 3.222 / 18.239 målte enheder | 644 testfiler / 8.461 tests bestod. Coverage viste især lave tal i platform-/storagehelpers; det er ikke behandlet som en grund til at hæve eller sænke tærskler. | relevant / højere niveau | Rapport: `coverage/index.html`, `coverage/coverage-final.json` og `coverage/clover.xml` (lokale, ignorerede artefakter). Fortsæt rækkevis med `PERSIST-002`, `SHELL-002` og `DOC-002`. |
| Højrisiko-domæner | Ja | `aarsloen` 91,48 / 85,62 / 90,58 / 94,80; `renteberegning` 94,36 / 87,85 / 100 / 94,56; `satser` 97,02 / 94,02 / 100 / 97,67; `erhvervsevnetab` 90,79 / 86,77 / 95,76 / 92,84; `varigemen` 91,50 / 86,11 / 100 / 97,87; `forsoergertab` 93,45 / 87,74 / 100 / 94,67; `erstatningsopgoerelse` 88,15 / 79,45 / 80,43 / 90,48 | De centrale beregningsmapper er instrumenteret og over de samlede gates, men procenten beviser ikke uafhængigt facit eller outputparitet. | relevant / højere niveau | Brug de nye oracle-tests og de åbne CALC-/DOC-fund; ingen tærskelændring. |
| Platform-/persistens- og dokumentgrænser | Ja | `fileSystemAccess.ts` 32,30 / 28,57 / 37,50 / 33,33; `fileHandleKvStore.ts` 30,30 / 0 / 0 / 31,25; `fileHandleStorage.ts` 35,55 / 20,83 / 8,33 / 37,20; `fileHelpers.ts` 44,73 / 10,44 / 41,17 / 45,94 | De lave tal svarer til browser-/IndexedDB-/File API-grene, som primært er mockede eller kun rammes af E2E-fallbacks. Det er et reelt højere-niveau-hul, ikke automatisk død kode. | relevant / højere niveau | Tilføj platformsevidens under `PERSIST-002`; tilføj fysisk PDF-/Word-parse/render og semantisk paritet under `DOC-002`/`DOC-003`. |
| Statisk/type-/utilityflade med 0 % statements | Delvist | `sfggConstants.ts`, `tableDraftRows.ts`, `numberFormatting.ts`, `tableInputContracts.ts` og `utils/mui/isFocusVisible.ts` stod med 0 % statements i V8-rapporten | Fladerne er primært typer/konstanter eller bundt-/frameworkadaptere; de bør ikke dækkes kunstigt, før det er afgjort, om de er levende produktkode, genereret kode eller højere-niveau-integration. | død / genereret / højere niveau – skal triageres | Afklar med source-/consumer-inventaret og behold kun relevante testopgaver; ingen kunstig coverage-test er tilføjet i denne iteration. |

- [x] `npm run test:coverage` er kørt på `1cb0b07b` med auditens testfiler og rapporteret med instrumenteret filmængde.
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
| StrykerJS 10.0.0 command-runner med Vitest 5 | Muterer TypeScript gennem Stryker og kører den eksplicit valgte Vitest-suite som en ekstern kommando. | Ingen React-/browsermutation; det er tilsigtet for rene TypeScript-flader. | Modulvist via `commandRunner.command`; `coverageAnalysis: off`, fordi command-runneren ikke leverer per-test coverage. `coverage/mutation/mutation.json` og `.html` er versionsbundne, ignorerede artefakter. | Kvalificeret lokalt på Windows/Node 24 med én worker; CI-integration er endnu ikke gennemført. | Én dev-dependency (`@stryker-mutator/core`) og et målt ekstra testtrin. Den transitive `qs`-advisory er afhjulpet med en eksplicit override til `6.16.0`, fordi `typed-rest-client@2.3.1` kræver `6.15.1`. | Valgt til auditten. På `src/domain/money/money.ts` blev først 50/58 mutationer dræbt; efter en manglende direkte test af `roundHeleKroner` og den konkrete `moneyOre`-fejltekst blev 56/58 dræbt på 1:50 uden timeout eller runnerfejl. |

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
| TD-001 | 2026-09-10 | `PERSIST-001` | Høj | Der fandtes ingen versionsbundne `.eo`-fixtures med dokumenteret oprindelse i tidligere offentliggjorte Mineo-filer. Auditten kan derfor endnu ikke bevise, at hver tidligere udgivet container indlæses uden ændret sagsdata eller ny preflight. | `rg --files -g '*.eo'` og git-objektsøgning fandt ingen releaseartefakter. Der er nu fem genskabte, krypterede fixtures for legacy uden version samt 1.0.4, 3.10, 3.12 og 3.13, baseret på historiske inline-payloads. `historicalEoFixtures.test.ts` bestod med 5/5 tests. `fileRoundTrip.independentReference.test.ts` bestod med 1/1 og sammenligner en fuld aktuel save → codec → load-kæde med et statisk håndskrevet facit. | Den genskabte fixturekontrol og referencekontrol er tilføjet som test-only auditmateriale; ingen produktændring foretaget. Fundet forbliver åbent, indtil proveniens fra faktiske releasefiler eller en udtrykkeligt accepteret erstatning er fastlagt. | Ikke påkrævet for test-/dokumentationsændringen; eventuel godkendelse af fixture-erstatning og afslutning af fundet forelægges særskilt. | Retest bestået: 5 fixturetests alene, 1/1 uafhængig referencekontrol og 25 filer / 238 tests i persistenssuiten. Åben – releaseproveniens mangler |
| TD-002 | 2026-09-10 | `MUT-TOOL` | Høj | Den officielle Stryker Vitest-runner kunne bestå dry-run, men rapporterede 0/58 dræbte mutationer på `money.ts`, også når mutationerne åbenlyst ændrede observerbare resultater. Hvis rapporten blev accepteret, ville auditten dokumentere falsk teststyrke. | `npm run test:mutation -- --dryRunOnly` bestod med 1 fil og 58 mutationer. `npm run test:mutation` med Vitest-runner gav 0/58. En separat command-runner med samme 58 mutationer dræbte 50/58 og efter teststyrkelse 56/58 på 1:50. | Vitest-pluginsporet er fravalgt og fjernet fra package-manifestet. Stryker core command-runneren er valgt med eksplicit Vitest-kommando og `coverageAnalysis: off`. Fundet forbliver åbent som kompatibilitetsforhold, men blokerer ikke den valgte runner. | Ikke påkrævet; ændringen er testinfrastruktur. | Command-runnerens dry-run og fulde kontrolkørsel bestået. Åben – revurderes ved ny Stryker-/Vitest-kombination. |
| TD-003 | 2026-09-10 | `DATE-001` | Høj | Datokontrakten kræver, at ugyldige `Date`-/NaN-inputs valideres eller afvises fail-fast. `diffUtcDays` normaliserer en ugyldig `Date` til `NaN`, og de afledte `count*`-/`diffUtcDaysAbs`-helpers kan derfor returnere `NaN` i stedet for at afvise. Hvis en valideringsgrænse mangler hos en caller, kan det forplante en ikke-beregnelig værdi til en gate eller beregning. | `src/contracts/date-contract.md` kræver eksplicit validering/fail-fast, mens `src/utils/utcDayMath.ts` kalder UTC-gettere direkte uden gyldighedstjek. En isoleret testprobe for ugyldig start/slutdato fejlede på det forventede throw for `diffUtcDays`; `beregnSHDage` afviser allerede ugyldig dato via `formatToISO`. | Ingen produktkode ændret. Testene for `beregnSHDage` og øvrige dato-grænser er committet; de fejlslagne `utcDayMath`-fail-fast-prober er ikke en del af den grønne suite. En ændring af helper-adfærden kan påvirke fejl-/beregningsadfærd og forelægges udvikleren før implementering. | Ja – udviklerens godkendelse kræves før produktlogikken ændres. | Åben. Kræver beslutning om valideringsgrænse og derefter en grøn, diskriminerende regressionstest. |
| TD-004 | 2026-09-10 | `ARCH-003` | Mellem | Den nye mutationsrunner trak `qs@6.15.1` ind via `typed-rest-client@2.3.1`, og dependency-gaten fandt to moderate advisories. Pakken er kun en dev-transitiv dependency og indgår ikke i Mineos klientbundle, men en rød release-gate skal ikke accepteres. | `npm ls qs typed-rest-client --all` viste `@stryker-mutator/core@10.0.0 → typed-rest-client@2.3.1 → qs@6.15.1`; parenten kræver præcist `6.15.1`, mens den rettede version er `6.16.0`. `npm run check:vulnerabilities` var rød før override og grøn efter ren `npm ci`. | `package.json` har en eksplicit `overrides.qs = "6.16.0"`, og lockfilen er regenereret. Override’et er en varig manuel afvigelse, indtil `typed-rest-client` frigiver en kompatibel range. | Ikke påkrævet; det er et dev-only dependency-værn uden ændring af klientbundle eller brugerflow. | Retest bestået: `npm run check:vulnerabilities` er grøn. Åben vedligeholdelsespost – fjernes, når forældrens range selv tillader en rettet `qs`. |
| TD-005 | 2026-09-10 | `BUILD-001` | Høj | `verify-build-artifacts.mjs` kontrollerede tidligere PWA-assetmanifestets format, men ikke om hver asset faktisk fandtes i buildet. Et build kunne derfor passere og først fejle ved service-worker-installation eller ved indlæsning af en lazy asset. | Syntetisk Mineo-build med eksisterende `assets/app.js` bestod, mens samme fixture med `assets/mangler.js` fejler med den konkrete missing-asset-fejl. Den integrerede E2E-build afslørede fem nul-byte dynamiske CSS-facade-chunks i Rollup-bundlelisten, som ikke fandtes i `dist`; almindeligt Mineo-build og E2E-build bestod efter filtreringen. | Verifikatoren kontrollerer nu hver `pwa-assets.json`-sti mod samme `outDir`, og PWA-pluginet medtager kun faktiske assets samt ikke-tomme JS-chunks. Ingen app- eller brugeradfærd er ændret. | Ikke påkrævet; ændringen styrker release-/buildværnet. | Lukket efter syntetisk 2/2, almindeligt build og E2E-buildserver med 4/4 EET-tests. B-002 om separat CI-deploy-artifact forbliver åben som et andet fund. |
| TD-006 | 2026-09-10 | `ARCH-003` | Mellem | Lane-vagten læste tidligere kun single-quoted tags. Et double-quoted eller array-baseret tag kunne derfor undgå preflight, så en test tavst kun kørte i basisbanen. | Syntetisk parserfixture med kommentarer, strengindhold, double quotes og arrays. Den gyldige fixture bestod, og `@browser`/`UNKNOWN_LANE` gav de forventede fejl. `npm run check:e2e-lanes` bestod på de aktuelle specs. | Parseren er tokenizer-baseret, læser begge citationstyper og arrays og ignorerer kommentarer/template literals. Ingen test-runner-dependency er tilføjet. | Ikke påkrævet; ændringen styrker testinfrastrukturen. | Lukket efter 20/20 målrettede tests og grøn lane-preflight. |
| TD-007 | 2026-09-10 | `ARCH-001` | Mellem | Kontrakt-referenceværnet kunne tidligere lade et bart filnavn fra `src/__tests__` bekræfte en produktionsreference. En omdøbt eller manglende produktionsfil kunne derfor blive skjult af en testhelper med samme basename. | Regressionstest viser, at `contractReferenceLiveness.test.ts` ikke længere indgår i `sourceBasenames()`, mens den eksakte teststi fortsat findes. Den tidligere kontraktreference til `wordContentHarness.ts` er triageret som bevidst test-only harness. | `sourceBasenames()` afskærmer testtræet; eksakte teststier valideres fortsat med `pathReferenceExists`. | Ikke påkrævet; ændringen styrker kontraktværnet. | Lukket efter fuld contract-reference-liveness-suite. |
| TD-008 | 2026-09-10 | `CALC-002` | Høj | Method C dag havde kun en test, hvor `periodeData.perioder` var tom. Den særlige månedsomregning for hele kalendermåneder kunne derfor være brudt, uden at den eksisterende suite opdagede det. | Den nye test sender januar og februar 2024 som komplette `DateInterval`-perioder og kræver både 2 hele måneder og den håndberegnede årsløn `60.000 / 2 × 12 = 360.000`. `aarsloenIndependentOracle.test.ts` tilføjer desuden håndberegnet Metode A/B/C, nul- og feriegrænser med 5/5 grønne tests. | Testhullet er lukket i `aarsloenCalculations.test.ts`, og et uafhængigt oracle er tilføjet; ingen produktkode er ændret. Resten af CALC-002 skal fortsat gennemgås med branches, grænser, integration og downstream-paritet. | Ikke påkrævet; ændringen styrker testbeviset uden at ændre brugeradfærd eller beregningslogik. | Lukket for den konkrete branch og den nye oracle-stikprøve efter 34/34 målrettede årslønstests. Den samlede CALC-002-række er fortsat `I gang`. |
| TD-009 | 2026-09-10 | `CALC-003` | Høj | Oracle-testen kontrollerede tidligere kun, at de beregnede perioder lå i rækkefølge. En fejl, der udelod en dag ved intervallets start/slut eller mellem perioder, kunne derfor overleve uden at den uafhængige kontrol opdagede det. | Den nye oracle-helper kræver første startdato, sidste slutdato, næste kalenderdag som næste periodes start og korrekt inklusivt dagtal. `procesrenteBoundaryIndependentOracle.test.ts` supplerer med 30. juni/1. juli, årsskifte og 2013-grænsen samt håndberegnet rente; de to oracle-filer bestod samlet med 11/11 tests. | Testhullet er lukket i testkoden; ingen beregningslogik er ændret. Resterende CALC-003-audit fortsætter med branches, standalone- og outputparitet. | Ikke påkrævet; ændringen styrker testbeviset uden at ændre brugeradfærd eller beregningslogik. | Lukket for de konkrete breakdown- og kalendergrænseinvarianter efter 11/11 målrettede oracle-tests. Den samlede CALC-003-række er fortsat `I gang`. |
| TD-010 | 2026-09-10 | `DATE-001` | Mellem | Et testnavn hævdede 9 SH-dage i 2024, mens både assertionen og kommentarens facit var 8. Den modstrid kunne vildlede en senere auditlæser, selv om den kørende assertion var korrekt. | `shDageBeregning.test.ts` er rettet til `2024 har 8 SH-dage (ingen store bededag)`. Den uafhængige `utcDayMath`-test udvides samtidig med håndfacit for 28. februar–1. marts 2024. Dato-/SH-suiten bestod med 106/106 tests. | Testnavnet er rettet, og skudårsgrænsen er gjort eksplicit. Ingen produktkode eller beregningsregel er ændret. | Ikke påkrævet; ændringen korrigerer testbevisets beskrivelse. | Lukket efter 106/106 målrettede dato-/SH-tests. |
| TD-015 | 2026-09-10 | `ARCH-002` | Mellem | Architecture-harnessets tidligere modcases dækkede ikke autoriseret transitiv re-export, uautoriseret re-export eller om livenessmål var vakuøse. En fejl i disse forhold kunne gøre et grønt værn mindre troværdigt. | `architectureRules.test.ts` har nu særskilte syntetiske cases for begge re-exportretninger og validerer positive `minimumMatches`/ikke-tomme scoped-rødder. Suiten bestod med 189/189 tests. | De konkrete testhuller er lukket i quality-harnesset. Ingen produktkode, kontrakt eller beregningslogik er ændret. | Ikke påkrævet; ændringen styrker testinfrastrukturen. | Lukket efter 189/189 målrettede architecture-tests. Den samlede ARCH-002-række er fortsat `I gang`. |
| TD-016 | 2026-09-10 | `CALC-006` | Høj | En uafhængig EO-stikprøve med en ren weekendydelse i en arbejdsdagsbaseret TAF-sag giver `control:sammentaelling_mismatch`. Snapshot har canonical TAF-værdier, men kontroltabellen opretter ikke en ydelseskolonne, viser en advarsel, og dokumentgaten blokerer. Det kan være tilsigtet fail-closed, men den forventede fallback og brugeroplevelse er uafklaret. | `eoSnapshotIndependentOracle.test.ts` bestod med 3/3 tests, og `eoInspektionIndependentOracle.test.ts` med 5/5 tests. Den konkrete sag kontrollerer 2.000 kr. weekend-sygedagpenge i den canonical beregning, hvorefter snapshot bliver `status: 'error'` med `control:sammentaelling_mismatch`; inspection-oraklet viser den manglende ydelseskolonne/advarsel i kontroltabellen. | Åbent fund. Ingen produktkode ændret. Forelæg udvikleren, om den observerede fail-closed-adfærd er korrekt, eller om beregning, issue, fallback eller visning skal ændres. | Ja – enhver ønsket ændring af beregning eller synlig adfærd kræver udviklerens godkendelse. | Retest bestået: 8/8 uafhængige EO-/inspection-tests. Åben – kræver udviklerens beslutning. |
| TD-011 | 2026-09-10 | `DOC-001` | Høj | Gate-parity-testen kaldte samme `documentActionFromDefinition(...).resolve(...)` for både reaktiv gate og click-preflight. En divergence i den faktiske download-lifecycle kunne derfor overleve en grøn parity-test. | `documentGateDownloadLifecycleIndependent.test.ts` kalder nu reel `DocumentOutput.evaluateGate` og reel `executeDocumentDownload` separat. 3/3 tests viser både en stale-ready/blocked-situation og tidlig blokering før renderer, session, render og fil-I/O. | Den generiske gate-vs-download-mekanisme er nu dækket i et selvstændigt testspor. Per-output og standalone-bevis behandles fortsat af TD-012. Ingen produktkode eller synlig adfærd ændret. | Ikke påkrævet for testændringen; hvis en konkret outputdefinition viser divergens, forelægges den særskilt. | Lukket for den generiske lifecycle-mekanisme efter 3/3 uafhængige tests. |
| TD-012 | 2026-09-10 | `DOC-001` | Høj | Standalone-outputs er katalogiseret, men mangler tilsvarende per-output gate- og lifecycle-bevis. Fixture-registret instrumenterer heller ikke selve `loadRenderer`-kaldet for at bevise, at blokering stopper lazy-load. | Katalogsuiten viser 3 standalone-definitioner, mens gate-/fixturekontrollen primært dækker 18 hovedoutputs og direkte `project()`-kald. | Åbent. Udvid fixture-registret med standalone, separat invalid/bounds og en tæller på `loadRenderer`, session, render og fil-I/O. | Ikke påkrævet for testændringen. | Ikke retestet – åben |
| TD-013 | 2026-09-10 | `DOC-001` | Mellem | Lifecycle-matricen dækker ikke alle revisions- og fejltrin, bl.a. settingsrevision, DEV-preflight, writer-load-fejl og alle stale-faser. En sådan afvigelse kan give forældet eller fejlagtigt leveret dokument. | `documentLifecycleMatrix.test.ts` har 11 cases for central lifecycle, men den faktiske `documentLifecycle.ts` har flere observerbare faser og fejludgange. | Åbent. Udvid matricen med de manglende faser og med en rigtig editor-/coordinatorintegration, hvor den kan observeres sikkert. | Ikke påkrævet for testændringen. | Ikke retestet – åben |
| TD-014 | 2026-09-10 | `DOC-001` | Mellem | Der findes ingen generel semantisk PDF↔Word-paritetstest for alle 21 outputs. Udvalgte goldens og isolerede Word-tests kan derfor ikke bevise, at samme sag giver samme labels, tal, sektioner og rækkefølge i begge kanaler. | `documentGateFormatInvariance.test.ts` håndhæver primært struktur og gate-formatadskillelse; eksisterende channel-goldens dækker kun udvalgte tabeller/sektioner. | Åbent. Tilføj normaliseret tværgående paritet med repræsentative fixtures og mindst én faktisk hovedapp-Word-download gennem formatvalget. | Ikke påkrævet for testændringen. | Ikke retestet – åben |
| TD-017 | 2026-09-10 | `PERSIST-002` | Høj | File System Access-checken ser kun efter properties og kan derfor vælge picker-grenen, selv om picker-værdien er `undefined` eller ikke-callable. Der mangler desuden reel browser-reload med aktiv sag/fane, og hook-/storage-/File API-lagene er primært adskilt af mocks. | Agentens målrettede storage-/File API-review fandt de svage capability-cases og mockgrænserne. Den lokale PWA-/filvalideringskørsel bestod med 4/4, og de målrettede unit-tests med 15/15 filer / 180 tests; det grønne resultat beviser ikke de manglende platformssammenhænge. | Åbent. Tilføj test-only cases for ikke-callable pickers, reel input + fane + reload og IndexedDB-operationer med fejl/unavailable. Ændring af capability-detektion eller fallback forelægges udvikleren, fordi brugerens filvalg-/fejloplevelse ændres. | Ja – produktændring i File API/fallback kræver udviklerens godkendelse; test-only browserbevis gør ikke. | Ikke retestet – åben |
| TD-018 | 2026-09-10 | `CALC-007` | Høj | EET har bred unit-/snapshot-/gate-dækning, men ingen samlet uafhængig kontrol af engine → snapshot → UI → dokumentindhold. Kapitaliserings- og differencekravsfaner har heller ikke en asymmetrisk dokumentrejse, og EET-specifik Word-paritet mangler. | `eetIndependentOracle.test.ts` lukker den samlede håndfacitprøve for EAL, ASL/løbende ydelse, differencekrav og fire gates med 1/1 grøn test. De seks EET-E2E-specs bestod med 23/23, men `eetPageAudit.spec.ts` hævder hovedsageligt enabled-status og filnavn. | Åbent. Tilføj test-only dokumentindholdsassertions og en samlet fane-/formatrejse. Eventuel ændring af EET-tal, gate eller synlig fejlpolitik forelægges udvikleren. | Ikke påkrævet for testændringen; ingen produktkode er ændret. | Ikke retestet – åben |
| TD-019 | 2026-09-10 | `INPUT-001` / `INPUT-002` / `VALID-001` | Mellem | Form/grid-pariteten er kun delvist produktionsbundet, nested row-schemaernes unknown/missing/invalid-partitioner er ikke systematisk dækket, og flere validatorfixtures genbruger produktionsdefaults. | Den målrettede input-/schema-/validator-kørsel bestod med 63 filer / 1.469 tests; en separat review af seks centrale filer bestod med 438/438. De grønne tests beviser ikke de manglende matrixkombinationer. | Åbent. Tilføj test-only dropdown-paritet med et produktionsfelt, faktiske `ZodError.issues` og små literalbaserede row-fixtures. | Ikke påkrævet for testændringen, så længe runtime-/loadadfærd ikke ændres. | Ikke retestet – åben |
| TD-020 | 2026-09-10 | `DATA-001` / `CALC-001` | Mellem | Data-/sats-suiterne har stærke katalog-, fingerprint- og integritetsguards, men flere facitassertions læser produktionsdata som forventning. Alle historiske endpoints, validatorpartitioner og sats → beregning → dokument-kæden er derfor ikke uafhængigt bevist. | `uafhaengigSatsFacitmatrix.test.ts` tilføjer fire tests med statiske facit for udvalgte lovbestemte satser, referencesats og ILON12/SBLON2. Den målrettede suite bestod med 23 filer / 476 tests. Reviewet identificerede fortsat genbrug af produktionsdata i `satserProjection.test.ts`, `aslAarsloensmaksimum.test.ts`, `opreguleringsmotorer.test.ts` og `satserNewCaseSeed.test.ts` samt manglende komplet validatorfacit for offentlig løn/statistik/overenskomst. | Delvist lukket for de udvalgte endpoints. Åbent for alle øvrige kilder, validatorpartitioner og en uafhængig downstream-kædetest; runtime-data/validatorer ændres ikke som del af auditten. | Ikke påkrævet for test-only styrkelse. | Delvist lukket – øvrige kilder og downstream mangler |
| TD-021 | 2026-09-10 | `SHELL-001` / `SHELL-002` | Mellem | Desktop-gate-testen hævdede oprindeligt kun, at `renderApp` ikke kaldes. Der manglede også ægte browser-hard-stop for mobil. | `bootstrapUnsupportedDeviceSideEffects.test.tsx` beviser nu, at stylesheet, PWA-filåbning, install-capture, `beforeDesktopRender`, `afterDesktopRenderSetup` og `renderApp` ikke kaldes på unsupported device, mens preload-recovery, install-prompt-suppression og hard-stop-rendering sker. Shared-tests bestod med 3 filer / 9 tests. | Den konkrete bootstrap-sideeffektmangel er lukket i testlaget. Fundet står åbent alene for et ægte browser-hard-stop-forløb på mobil; ingen ændring af desktop-gate eller synlig stopside uden udviklerens godkendelse. | Ja ved produktændring; ikke ved rent testbevis. | Delvist lukket – browser-hard-stop mangler |
| TD-022 | 2026-09-10 | `SHELL-002` | Mellem | Lazy/PWA-recovery er kun bevist med jsdom/mocks, ikke som faktisk manglende chunk → synlig recovery → kritisk reload. `pwa-file-open.spec.ts` bruger desuden egen console-opsamling i stedet for den fælles `runtimeErrors`-fixture. Native `launchQueue` kan ikke fuldt fremkaldes i Playwright. | Isolerede E2E-kørsler bestod for PWA-filåbning 1/1, service worker 1/1 og installation 8/8. En samlet parallelkørsel mistede buildserveren med `ERR_CONNECTION_REFUSED`, men alle berørte specs bestod isoleret; det er registreret som harnessafvigelse. | Åbent. Tilføj en observerbar recovery-E2E med kontrolleret manglende asset eller dokumentér præcist, hvorfor den ikke kan gøres reproducerbar. Flyt egen console-opsamling til fælles fixture, hvis specens scope tillader det. | Ikke påkrævet for test-only styrkelse. | Ikke retestet – åben |
| TD-023 | 2026-09-10 | `MIN-001` | Mellem | Standalone MinProcesrente havde isolation-, reset-, fokus- og afvist-dato-bevis, men ikke en samlet valid input → beregning → gate → PDF-download-rejse eller browserbaseret namespace-/runtime-isolation. | `minprocesrente-valid-download.spec.ts` bestod med 1/1 og kontrollerer gyldig beregning, aktive gates, faktisk PDF-download og afvist navigation via `beforeunload`; `minprocesrente-recovery-and-focus.spec.ts` bestod med 1/1. | Delvist lukket for den komplette observerbare brugerrejse. Åbent alene for browserbaseret namespace-/runtime-isolation. Eventuelle ændringer af procesrente, gate eller dokumentadfærd forelægges udvikleren. | Ikke påkrævet for test-only styrkelse. | Delvist lukket – browser-isolation mangler |

**Alvor:** `Kritisk` omfatter mulig forkert beregning, datatab, forkert load eller dokument med forkert
resultat. `Høj` omfatter brud på en trust-kritisk kontrakt eller en sandsynlig regressionsvej. Lavere
alvor må aldrig bruges til at skjule en uafklaret brudt invariant.

| Beslutnings-ID | Emne | Muligheder og konkret brugeroplevelse | Valgt af / dato | Afgrænsning og revurderingstrigger |
| --- | --- | --- | --- | --- |
| TD-D01 | Mutationsrunner for rene TypeScript-flader | Vitest-pluginpen kan give en pæn rapport, men den målte brugeroplevelse for auditten er et falsk grønt signal: en forkert `toKroner`-implementering bliver ikke fanget. Command-runneren tager længere tid, men den samme suite dræber 56/58 mutationer og kan bruges modulvist. | Codex / 2026-09-10 | Brug command-runneren med eksplicit testkommando og én worker. Revurder ved opgradering af Vitest eller Stryker, hvis en pluginrunner igen kan bevise dræbte kontrolmutationer. |
| TD-D02 | Transitiv qs-advisory fra mutationsrunneren | Opdatér parenten, hvis en ny version åbner en rettet `qs`-range; ellers kan en eksplicit override holde release-gaten grøn uden at ændre klientbundle. En forkert eller manglende override lader udviklerens dependency-kontrol fejle, men påvirker ikke en ekstern bruger direkte. | Codex / 2026-09-10 | Behold `qs@6.16.0`-override’et, og revurder det ved næste Stryker-/typed-rest-client-opdatering. Fjern override’et, når parentens range dækker rettelsen. |

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
