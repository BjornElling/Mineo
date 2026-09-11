# Auditspor – TD-AUDIT-2026-09-10-01

Dette er auditsporets versionsbundne indeks. Genererede rapporter ligger i de ignorerede mapper under
projektroden og må ikke indeholde rigtige person- eller sagsdata.

## Status

- Evidensrevision: `817a55e9`
- Branch: `main`
- Startdato: 2026-09-10 Europe/Copenhagen
- Fase: Auditstart og baseline afsluttet; makroinventar oprettet; `INPUT-001`, `PERSIST-001`, `PERSIST-002`, `DATA-001`, `CALC-001`–`CALC-007`, `DOC-001`–`DOC-003` samt shell-/standalone-flader foreløbigt gennemgået. Mutationsrunneren er kvalificeret på `DATE-001`-moneyfladen, `dateCommit.ts`, `CALC-002`-årsløn, `CALC-003`-procesrente, `CALC-004`-varige mén og `CALC-005`-forsørgertab; historiske `.eo`-fixtures, uafhængige reference-/EO-orakler, dokumentlifecycle-bevis for alle registrerede outputs, reel session-reload, produktionsbundet form/grid-paritet, bootstrap-sideeffektbevis, mobil-hard-stop i browser, EET-tabelparitet og Word-indhold, uafhængige satsfacitter, uafhængige sats-, KRL- og KL-downstream-facitter, standalone valid-PDF-forløb, browserbaseret namespace-isolation, uafhængige totalsager for varige mén/forsørgertab, uafhængige EO-række-/periodefacitter, nested row-schema-partitioner, faktiske `ZodError.issues`, File API-/IndexedDB-fejlveje, validator-literalfixtures, levende GitHub Actions-/architecture-runtimeværn, statisk CI-artefaktkobling, Varige méns faktiske PDF-artefakt/Word-tekstparitet, fysisk tekst-/billedartefaktkontrol for alle 18 hovedapp-outputs, faktisk route-chunk recovery og native LaunchQueue-kapabilitet er tilføjet og retestet. Den samlede `verify:release:core` og den valgte E2E-suite er senest bestået på `817a55e9`; åbne produkt-/proveniensbeslutninger, TD-025's ikke-årsagsforklarede flagerisiko og højere-niveau-outputparitet forhindrer fortsat afslutning.
- Hoveddokument: `docs/testing/testdaekningsgennemgang.md`
- Seneste samlede retest: revision `817a55e9`; `verify:release:core` er grøn med 669 testfiler, 8.689 beståede tests plus 17 forventede `it.fails`, og den valgte E2E-suite er grøn med 190 beståede tests og 2 forventede skips ud af 192. Åbne produkt-, proveniens-, outputparitets- og TD-025-stabilitetsfund forhindrer fortsat afslutning.
- Den lange fasebeskrivelse ovenfor er auditens oprindelige makrostatus; den gældende reteststatus er den aktuelle linje og de detaljerede retestsektioner nedenfor.

## Arbejdsrytme og commitregel

Efter hver gennemført, afgrænset arbejdsenhed – når Codex har meldt det konkrete punkt gennemført til
udvikleren – committes alle ændringer i working tree efter verifikation og før næste arbejdsenhed begynder.
Det gælder også test-, fixture- og dokumentationsændringer. Der pushes aldrig fra auditten.

## Kørte baselines

| Område | Kommando | Resultat | Artefakt / note |
| --- | --- | --- | --- |
| Typechecks | `npm run check:types` | Bestået | Alle fire TypeScript-projekter bestået |
| Lint | `npm run lint` | Bestået | 0 warnings/errors |
| Vitest (historisk releasekørsel) | `npm run test:coverage` | Bestået | 661 filer, 8.603 tests bestået samt 6 forventede `it.fails`; samlet kørsel 396,36 s |
| Aktuel fuld Vitest-retest | `npm run test:coverage` | Bestået | 669 filer, 8.689 tests bestået samt 17 forventede `it.fails`; coverage-fase 365,88 s på `817a55e9` |
| E2E-baner | `npm run test:e2e` | Bestået | 190 beståede tests og 2 forventede skips ud af 192, 4,0 min, 3 workers; `playwright-report/` og `test-results/` på `817a55e9` |
| Aktuel samlet release-gate | `npm run verify:release:core` | Bestået | Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-, ledger-, coverage- og begge build-gates bestået på `817a55e9`; coverage 669 filer / 8.689 beståede tests / 17 forventede `it.fails` |
| Coverage (historisk releasekørsel) | `npm run verify:release:core` | Bestået | 661 testfiler / 8.603 tests bestået samt 6 forventede `it.fails`; 89,23 % statements, 80,48 % branches, 92,35 % functions, 92,02 % lines; 18.369 / 20.584, 12.950 / 16.090, 2.972 / 3.218 og 16.776 / 18.230 målte enheder; `coverage/index.html`, `coverage/clover.xml` og `coverage/coverage-final.json` |
| Aktuel coverage-retest | `npm run test:coverage` | Bestået | 393 instrumenterede filer; 90,14 % statements, 81,21 % branches, 93,97 % functions, 92,96 % lines; 18.555 / 20.584, 13.067 / 16.090, 3.024 / 3.218 og 16.947 / 18.230 målte enheder; `coverage/index.html`, `coverage/clover.xml` og `coverage/coverage-final.json`; Node `v24.18.0`/Windows |
| Persistensmålrettet suite | `npx vitest run ...` (se hoveddokumentet) | Bestået | 24 filer, 233 tests, 10,19 s |
| Historiske `.eo`-fixtures | `npx vitest run src/__tests__/utils/historicalEoFixtures.test.ts` | Bestået | 5 tests; fixtures for legacy uden version samt 1.0.4, 3.10, 3.12 og 3.13 |
| Persistenssuite efter fixturetilføjelse | `npx vitest run ...` (se hoveddokumentet) | Bestået | 25 filer, 238 tests, 13,92 s |
| Dokumentlifecycle | `npx vitest run src/__tests__/document/documentLifecycleMatrix.test.ts src/__tests__/document/documentLifecycleCoordinatorIntegration.test.tsx` | Bestået | 2 filer, 23 tests; alle registrerede stale-/fejltrin og reel editor/coordinator-integration |
| Platform-/storagefejlveje | Målrettet Vitest-kørsel (se hoveddokumentet) | Bestået med forventede negative modcases | 8 filer, 80 beståede tests og 9 `it.fails` for den fortsat åbne ikke-callable picker-adfærd; `fileHandleVerification.test.ts` bestod separat med 22/22 direkte fil- og mappehandle-verifikationer; `fileHandleKvStore.test.ts` bestod med 2/2 statiske/client-scopede write/read/delete-tests; utilitytests dækker nu direkte I/O-fejl og capability-afvigelser |
| Validatorer og dataendepunkter | Målrettet Vitest-kørsel (se hoveddokumentet) | Bestået | 5 nye filer, 41 tests; uafhængige validator-literals, 3 håndskrevne typed validator-cases, statiske data-/endpointfacitter, 2 folkepensions-downstreamfacitter og 1 KRL-downstreamfacit |
| Dokumentkanalparitet | Målrettet Vitest-kørsel (se hoveddokumentet) | Bestået | 19/19 EET-tabelparitet; `documentPdfArtifactTextParity.test.ts` 1/1; `documentDefinitionFixtureRegistry.test.ts` 62/62 med 17 tekst- og ét billedartefaktforløb; parseren er snæver og fysisk rendering er fortsat åben |
| DATE-001 mutation | `npx --no-install stryker run .tmp-date-commit-stryker.json --logLevel info` | Bestået med triagerede ækvivalente mutationer | `dateCommit.ts`: 6 mutationer, 4 dræbt, 2 ækvivalente, 0 timeout/fejl |
| CALC-002 mutation | `npx --no-install stryker run .tmp-aarsloen-stryker.json --logLevel info` | Bestået med triagerede mutationer | `aarsloenCalculations.ts`: 113 mutationer, 108 dræbt, 5 rapporterede overlevere; én blev dræbt i isoleret kontrolkørsel, 4 er ækvivalente, 0 timeout/fejl |
| CALC-004 mutation | `npx --no-install stryker run .tmp-varigemen-mutation.json --logLevel info` | Bestået med triagerede ækvivalente mutationer | `varigeMenCalculations.ts`: 114 mutationer, 94 dræbt, 20 ækvivalente, 0 timeout/fejl |
| CALC-003 mutation | Selektiv StrykerJS command-runner mod `procesrenteCalculator.ts` | Bestået med triagerede mutationer og dokumenterede timeout-mutanter | 136 mutationer, 104 dræbt, 23 triagerede survivors, 9 timeouts, 0 fejl |
| CALC-005 mutation | Selektiv StrykerJS command-runner mod `forsoergertabCalculation.ts` | Bestået | 21 mutationer, 21 dræbt, 0 timeout/fejl |
| GitHub Actions-runtime | `npm run check:github-actions-runtime` og quality-suite | Bestået | 2 workflows og 5 quality-tests; den tidligere vakuøse `- uses:`-form kontrolleres nu |

## Baselineobservationer til triage

- Coverage er afgrænset til `src/domain/**`, `src/utils/**`, `src/hooks/**`, `src/rowDrafts/**` og
  `src/contexts/**`; resten af produktionskildetræet skal dækkes via inventar og andre testniveauer eller
  registreres som et konkret coveragehul.
- Der findes ingen mutationsrunner i projektets scripts. Værktøjskvalificering er derfor en særskilt
  auditopgave og ikke gennemført evidens.
- Vite udsender ved test og E2E en fremadrettet `configLoader: 'native'`-advarsel. E2E-builden udsender
  også en chunk-advarsel over den konfigurerede 750 kB-grænse.
- Den lokale Playwright CLI `0.1.18` rapporterede, at skill-versionen ikke matcher værktøjet, og
  kommandoen afsluttede med en Node assertion-fejl. Projektets `@playwright/test`-baseline er uafhængigt
  grøn; CLI-forholdet skal afklares før CLI-baseret audit anvendes som evidens.
- Der er tilføjet fem genskabte, krypterede `.eo`-fixtures, som går gennem den faktiske dekryptering,
  versionsadapter og sektionsschemas. De er afledt af historiske inline-payloads og den dokumenterede
  AES-GCM-protokol, ikke udtrukket fra faktiske offentliggjorte filer; `TD-001` forbliver derfor åbent.
- `INPUT-001` har nu en separat reference-model, der ikke genbruger reducer- eller history-helperne, og
  som kontrollerer settle, semantisk no-op, undo, redo og ny gren efter undo.
- StrykerJS 10.0.0 med den officielle Vitest-runner bestod dry-run, men gav 0/58 dræbte mutationer på
  `money.ts`; den blev derfor fravalgt som auditbevis. StrykerJS command-runner med eksplicit Vitest-
  kommando dræbte 56/58 efter styrkelse af den dedikerede suite, uden timeout eller runnerfejl.
- Den nye dev-transitive `qs@6.15.1`-advisory via `typed-rest-client@2.3.1` blev afhjulpet med
  `overrides.qs = "6.16.0"`; `npm run check:vulnerabilities` er grøn efter ren `npm ci`. Override'et
  skal fjernes, når parentens range selv tillader den rettede version.
- `verify-build-artifacts.mjs` kontrollerer nu, at hver PWA-assetsti faktisk findes i `outDir`; den
  syntetiske positive/negative regressionstest bestod 2/2. Det tidligere B-001 er lukket. En lokal
  preview-smoke mod det eksakte produktionsbuild bestod 1/1, og CI-workflowen har nu en særskilt
  smoke-job mod det uploadede produktionsartefakt med fast port, proceskontrol, timeout og cleanup i samme
  jobtrin; E2E-matrixen er nu også koblet til det uploadede artefakt, mens faktisk workflowkørsel fortsat er åben under B-002.
- Lane-vagten er gjort tokenizer-baseret, så double-quoted og array-baserede tags samt kommentarer og
  strengindhold behandles korrekt. `e2eSuiteConventions.test.ts` bestod 20/20, og `check:e2e-lanes` er grøn.
- Kontrakt-referenceværnet ignorerer nu bare basenames fra `src/__tests__`, mens eksakte teststier stadig
  valideres. `wordContentHarness.ts` er triageret som en bevidst test-only reference, og liveness-suiten
  er grøn efter regressionstesten.
- `uafhaengigSatsFacitmatrix.test.ts` har uafhængige literal-facit-tests for EAL/ASL, EET,
  Nationalbanken, Danmarks Statistik, KRL, offentlig løn og overenskomstperioder. `satserDownstreamIndependentOracle.test.ts`
  følger desuden en statisk reguleringssats gennem beregning og dokumenttabel. Sygedagpengeregistret er bevidst udeladt, fordi den fundne
  officielle 2005-kilde angiver 88,30 kr./time, mens produktdata angiver 88,51 kr./time; det er et
  afklaringspunkt og ikke et facit, auditten må gætte.
- `persistence-reload-session.spec.ts` bevæger afsluttet input og aktiv fane gennem reel browser-reload
  med 1/1 grøn test. `minprocesrente-valid-download.spec.ts` dækker valid beregning, gates, faktisk PDF
  og `beforeunload`-exit-guard med 1/1 grøn test. `bootstrapUnsupportedDeviceSideEffects.test.tsx`
  dækker de tidlige unsupported-device-sideeffekter med 1/1 grøn test. `unsupported-device-hard-stop.spec.ts`
  dækker den synlige mobil-hard-stoprejse med 1/1 grøn test, og `eetPageAudit.spec.ts` validerer nu
  semantisk Word-indhold for både løbende ydelser og kapitalisering fra den faktiske hovedapp-download.
- `documentLifecycleCoordinatorIntegration.test.tsx` kobler en reel `useFieldEditor`-settle-revision og
  `CriticalActionCoordinator` til dokumentgaten og blokerer rejected input før projection og renderer-load.
- `fileSystemAccess.test.ts`, `fileHandleStorage.failurePaths.test.ts` og den udvidede
  `indexedDbStore.test.ts` dækker unavailable-/exception-/transaction-fejl. De seks `it.fails` er bevidste
  diskriminerende prober for det åbne produktfund `TD-017`; de er ikke produktrettelser. `utcDayMath`
  har desuden otte forventede negative modcases for `Invalid Date` under `TD-003`.
- `tableChannelParity.golden.test.ts` sammenholder EET-løbende-ydelsers resolved PDF-tabelceller med Word-
  `document.xml`; dokumentgruppen bestod med 29/29 tests. Det lukker ikke generel PDF-parse/render.
- `dateCommit.ts` blev mutationstestet med 6 mutationer, hvor 4 blev dræbt og 2 blev triageret som
  ækvivalente. `check-github-actions-runtime.mjs` matchede tidligere ikke den levende YAML-form `- uses:`;
  5 quality-tests reproducerer nu både den grønne baseline og de relevante negative cases.
- `lazy-chunk-recovery.spec.ts` fremkalder en faktisk 404 på en route-chunk og beviser synlig recovery
  uden automatisk reload og med klikudløst reload i alle fire browsermotorer. Browsernes console- og
  requestlogik er ikke ens, så native `launchQueue` og fuld platformsparitet står fortsat åbne.

## Foreløbig fladegennemgang

| Inventar-ID | Gennemført | Evidens | Åbne punkter | Status |
| --- | --- | --- | --- | --- |
| `INPUT-001` | Kontrakt- og testinventar gennemgået; målrettet suite kørt separat; kontrolleret no-op-modprøve og uafhængig referencekontrol udført | Baseline 5 filer / 176 tests bestået; svækket no-op-gate gav 51 fejl / 146 tests; gendannet kontrol 2 filer / 103 tests bestået; separat referencekontrol 1/1 test bestået; se hoveddokumentets detaljerække | Kvalificeret mutationsrunner, fuld testkvalitetsrevision og browser-/adapterparitet | `I gang` |
| `PERSIST-001` | Kontrakt-, consumer- og testinventar gennemgået; målrettet save/load-suite, historiske fixturetests og uafhængig referencekontrol kørt separat | Baseline 24 filer / 233 tests; efter fixturetilføjelse 25 filer / 238 tests bestået; `fileRoundTrip.independentReference.test.ts`: 1/1 bestået | Releaseproveniens eller accepteret fixture-erstatning, mutation og fuld testkvalitetsrevision | `I gang` |
| `PERSIST-002` | Storage/settings, filhåndtag, PWA-filflows og reel session-reload gennemgået | 15 filer / 180 målrettede unit-/hook-tests; PWA-/filkørsel 4/4; reel input + aktiv fane + reload 1/1; supplerende 8-filers platformssuite med 80 beståede tests og 9 forventede negative modcases; `fileHandleVerification.test.ts` bestod med 22/22; `fileHandleKvStore.test.ts` bestod med 2/2; ugyldige `Date`-inputs har 8 forventede negative modcases | Ikke-callable File API-capability og fuld browser-/platformssammenhæng; `TD-017` og `TD-003` | `I gang` |
| `INPUT-002` / `VALID-001` | Form/grid-overflader, produktions-ChoiceField og schema-/validatorhuller gennemgået | 65 filer / 1.518 tests; produktionsbundet form/grid-paritet, 12 nested row-schemas, faktiske `ZodError.issues`, 10 uafhængige validator-literaltests og 3 håndskrevne typed runtime-cases er dækket | Yderligere validator-fixture-uafhængighed og downstream-partitioner; `TD-019` | `I gang` |
| `DATA-001` | Data-/satskatalog, integritet og udvalgte uafhængige endpointfacit gennemgået | 25 filer / 487 målrettede tests; literal-facit for udvalgte perioder, 25 statiske endpoint-/partitionfacitter, 2/2 statiske folkepensions-downstreamfacitter, 1/1 KRL-downstreamfacit og 16/16 offentlig KL-løn-tests med konkret komponent-/dagstotalfacit samt sats → beregning → dokument-kæde er grønne | Resterende kilder, validatorpartitioner og komplet downstream-paritet; `TD-020` | `I gang` |
| `CALC-001` | Satser og fælles reguleringsdata gennemgået som målrettet domænebaseline | Den samlede data-/satssuite bestod med 25 filer / 487 tests; uafhængige literal-facit, en statisk downstream-kæde og 16/16 konkrete offentlig KL-løn-tests i EO-inspektionen er tilføjet | Integration/E2E, resterende dataregistrenes endepunkter, validatorpartitioner og komplet downstream-konsumentparitet | `I gang` |
| `ARCH-002` | Registry-completeness, rule-factory-liveness og udvalgte negative modcases tilføjet til arkitekturharnessets dedikerede tests | `architectureRules.test.ts`: 1 fil / 190 tests bestået; separat forventningsliste med 88 regel-ID'er, AST-opslag af eksporterede definitions/aggregater samt re-export- og liveness-modcases; `TD-015` lukket for de konkrete huller | De enkelte reglers negative modcases, importgrænser og øvrige livenessværn mangler | `I gang` |
| `DATE-001` | Pengefladen er mutationstestet modulvist med den kvalificerede command-runner; datoassertions er styrket | 58 money-mutationer: 56 dræbt, 2 triageret som ækvivalent/åben numerisk grænse; 13 money-tests grønne. Dato-/SH-suiten: 3 filer / 106 tests grønne efter præcise grænseassertions, eksakt 2024-facit og håndberegnet skudårsinterval; `coverage/mutation/mutation.json` | Uafhængig håndregning og resten af dato-/periodiseringsfladen mangler. `TD-003` dokumenterer, at `utcDayMath` stadig returnerer `NaN` for ugyldige `Date`-instanser; produktændring skal forelægges. | `I gang` |
| `CALC-002` | Method C dag gennemgået med den tidligere utestede hele-kalendermåned-branch og uafhængig mutationstest | `aarsloenCalculations.test.ts`: 30/30 tests bestået, herunder januar + februar 2024 som komplette perioder og håndberegnet `360000`; command-runner: 108/113 mutationer dræbt, 5 rapporterede overlevere, hvoraf én blev dræbt i isoleret kontrolkørsel og fire er triageret som ækvivalente | Resterende årslønsbranches, grænser, integration/downstream-paritet og fuld brugerrejse | `I gang` |
| `CALC-003` | Procesrente-oracle og selektiv mutation gennemgået med intervalgrænser og daglig kontinuitet | `procesrenteCalculator`-fladen: 32 målrettede tests bestået; folderen 10 filer / 145 tests; mutation 104/136 dræbt, 23 triagerede survivors og 9 ikke-terminerende timeouts uden tekniske fejl; `TD-009` lukket for den konkrete invariant | Standalone-deling, øvrige rente-/inputbranches, outputparitet og uafhængig efterregning | `I gang` |
| `CALC-004` | Varige mén-fladen gennemgået som målrettet unit-/integrationstestbaseline, uafhængig totalsag og mutationstest | 10 filer / 82 tests bestået; méngrad-, satsår-, alder-, dato-, afrundings- og gatecases samt håndberegnet engine → projection → gate-facit er registreret; command-runner: 94/114 mutationer dræbt, 20 triageret; browserrejse 1/1 med `91.800 kr.` og faktisk PDF-header/EOF | Generel PDF/Word-paritet og overlaprevision | `I gang` |
| `CALC-005` | Forsørgertabsfladen gennemgået som målrettet unit-/integrationstestbaseline, uafhængig totalsag og mutationstest | 8 filer / 83 tests bestået; snapshot-/reader-gates, kønsgrene, perioder, minimum/maksimum, EAL/ASL-afhængigheder og håndberegnet totalsag er registreret; command-runner dræbte 21/21 mutationer uden timeout/fejl; browserrejse 1/1 med `82.741 kr.` og faktisk PDF-header/EOF | Generel PDF/Word-paritet og overlaprevision | `I gang` |
| `CALC-006` | EO-snapshot, canonical totals, dokumentprojektion, inspektionsdage og sidevisning stikprøvet med to uafhængige orakler samt række-/periodefacitter | `CALC-006`-kørslen bestod med 159 filer / 2.169 tests, heraf 7 nye uafhængige række-/periodecases; en weekendydelse i arbejdsdagsbaseret TAF gav observeret `control:sammentaelling_mismatch`; `TD-016` er åbent | Øvrige rækkegrene, dokumentparitet, mutation og fuld E2E; udviklerens beslutning om TD-016 | `I gang` |
| `DOC-001` | Katalog, definitioner, gate/lifecycle og renderer-wiring gennemgået som evidensbaseline for alle registrerede outputs | Fokuseret fixture-/lifecyclekontrol: fixture-registret 62/62 og 2 filer / 23 lifecycle-/coordinator-tests. Samlet dokumentmappe: 26 filer / 273 tests efter faktisk PDF-/Word-artefaktkontrol. Kataloget dækker 18 Mineo- og 3 standalone-outputs; TD-012 er lukket og TD-013 retestet med udvidet fasebevis | TD-014: manglende generel fysisk rendering og uafhængig PDF/Word-paritet | `I gang` |
| `SHELL-001` / `SHELL-002` | Auth, routes, desktop-/unsupported-device-gate, 404, PWA, service worker, preload og browsermotorer gennemgået | 26 fokuserede filer / 125 tests; bootstrap-sideeffekter 1/1, synlig mobil-hard-stop 1/1, shell/404 4/4, minimumsviewporter 12/12, PWA-installation 8/8, lazy-chunk recovery 4/4, native LaunchQueue-form 2/2 i Chrome/Edge, øvrige målrettede browserflows grønne; fuld valgt E2E 186/186 efter fælles helper-konvergens | Fuld OS-/installeret-PWA-filaflevering og øvrig PWA-/platformsparitet; `TD-022` | `I gang` |
| `MIN-001` | Standalone isolation, reset/fokus, error boundary, valid beregning, PDF, exit-guard og browserbaseret namespace-isolation gennemgået | `minprocesrente-valid-download.spec.ts`: 1/1, `minprocesrente-namespace-isolation.spec.ts`: 1/1 samt 186/186 i fuld valgt E2E | Fuld outputparitet og mutation | `I gang` |
| `BUILD-001` | Asset-eksistenskontrol og PWA-manifestets faktiske filudvalg gennemgået | Syntetisk `verifyBuildArtifacts.test.ts`: 2/2; `npm run build:mineo` bestået; E2E-buildserver og `eetPageAudit.spec.ts`: 7/7; eksakt produktionsbuilds lokale preview-smoke: 1/1; CI-jobsektionen starter det uploadede produktionsartefakt med fast port, proceskontrol, timeout og cleanup, E2E-matrixen downloader nu det samme artefakt, og statisk artefakt-flow-værn bestod med 6/6; TD-005 lukket | Faktisk GitHub Actions-kørsel og øvrige chunk-/Vite-advarsler mangler; B-002 er delvist dækket | `I gang` |
| `ARCH-003` | Lane-tag-vagten parser nu syntaksbevidst tags i E2E-specs | `e2eSuiteConventions.test.ts`: 20/20 bestået; `check:e2e-lanes`: 2 gyldige tags; `githubActionsRuntimeCheck.test.ts`: 6/6 med statisk CI-artefaktkobling; TD-006 lukket | Øvrige release-/CI-værn og fuld kobling til releaseforløbet mangler | `I gang` |
| `ARCH-001` | Bare test-only basenames er fjernet fra kontrakt-referenceopslag | `contractReferenceLiveness.test.ts`: 12/12 bestået efter triage; eksakte teststier accepteres fortsat; TD-007 lukket | Semantisk gennemgang af alle kontraktparagraffer og øvrige ARCH-001-værn mangler | `I gang` |

## Synkroniseret fundstatus

| Status | Fund |
| --- | --- |
| Lukket | `TD-005`, `TD-006`, `TD-007`, `TD-008`, `TD-009`, `TD-010`, `TD-011`, `TD-012`, `TD-013`, `TD-015`, `TD-021`, `TD-023`, `TD-024` |
| Delvist lukket | `B-002`, `TD-014`, `TD-018`, `TD-019`, `TD-020`, `TD-022`, `TD-025` |
| Åbent – kræver udviklerbeslutning eller ekstern evidens | `TD-001`, `TD-002`, `TD-003`, `TD-004`, `TD-016`, `TD-017` |

## Seneste komplette baseline-retest på revision `e8faa7ce`

- `DATE-001`: `dateCommit.ts` har 6 mutationer, 4 dræbte og 2 ækvivalente overlevere uden timeout eller tekniske fejl.
- `CALC-002`/`CALC-004`: command-runner-mutationer bestod uden timeout/fejl; årsløn dræbte 108/113,
  og varige mén dræbte 94/114. De resterende overlevere er triageret som ækvivalente eller redundante guards.
- `DOC-001`/`DOC-002`: dokumentgruppen bestod med 29/29; EET-løbende-ydelsernes PDF-resolved table cells
  matcher Word `document.xml` for den fælles tabelcase.
- `ARCH-003`: `check:github-actions-runtime` og 6 quality-tests er grønne. Kontrollen matcher nu den
  levende YAML-form `- uses:`, og den nye test værner om den samme `dist`-artefaktkobling i verify-,
  E2E- og deploy-jobbene; B-002 mangler fortsat en faktisk workflowkørsel.
- `npm run verify:release:core` bestod på `e8faa7ce` med dependency-, runtime-, type-, lint-, data-,
  kontrakt-, ledger-, coverage- og build-gates; begge applikationsbuilds blev verificeret.
- Fuld Vitest-coverage bestod med 660 filer, 8.593 beståede tests og 6 forventede `it.fails`; 89,22 %
  statements, 80,47 % branches, 92,35 % functions og 92,01 % lines. Ubrugte runtimefiler er triageret og
  fjernet i `d43d4837`; de resterende lave platform-/frameworkflader er ikke dækket kunstigt.
- Fuld valgt E2E-suite bestod med 179/179 på Chrome, Edge, Firefox, WebKit og de markerede viewport-/fallbackbaner.
  Den nye mobil-hard-stop-, EET-Word- og namespace-isolationkontrol bestod i samme kørsel; namespace-testen
  bestod også isoleret med 1/1 uden storage- eller login-genvej.
- ARCH-002-harnesset bestod med 190/190 efter AST-værn mod eksporterede, men uregistrerede rule-factories/-aggregater.

## Seneste samlede retest på revision `5c88267f`

- `npm run verify:release:core` bestod med 661 testfiler, 8.601 beståede tests og 6 forventede `it.fails`.
  Coverage var 89,23 % statements, 80,48 % branches, 92,35 % functions og 92,02 % lines –
  henholdsvis 18.369/20.584, 12.950/16.090, 2.972/3.218 og 16.777/18.230 målte enheder. Begge
  applikationsbuilds og deres assetkontroller bestod.
- Fuld valgt E2E-suite bestod med 179/179 på Chrome, Edge, Firefox, WebKit, markerede viewporter og
  fallback-/service-worker-baner. Den fælles login-/navigation-/runtime-error-fixture er nu brugt af alle
  gennemgåede E2E-specs.
- `CALC-003`-mutation gav 104/136 dræbte mutationer, 23 triagerede survivors, 9 dokumenterede timeout-
  mutationer og 0 fejl. `CALC-005` gav 21/21 dræbte mutationer uden timeout eller fejl.
- `TD-020` fik et separat folkepensions-downstream-facit med 2/2 tests for fem statiske perioder og
  manglende opslagsdækning.

## Seneste samlede retest på revision `1956eb8d`

- Fuld Vitest-suite via `npm test -- --reporter=dot` bestod med 663 testfiler, 8.604 beståede
  tests og 17 forventede `it.fails`. Kørselstiden var 348,90 sekunder på Node `v24.18.0`/Windows.
- Fuld valgt E2E-suite via `npm run test:e2e` bestod med 185/185 på 3 workers og 6,2 minutter.
  Den indeholder production-artifact-smoke mod E2E-buildet og lazy-chunk recovery i alle fire
  browsermotorer. En separat lokal `vite preview`-smoke mod det eksakte produktionsbuild bestod 1/1.
- `npx vitest run src/__tests__/domain/data/td020KrlDownstreamIndependent.test.ts --reporter=dot`
  bestod med 1/1. Den udvidede CALC-006-kørsel bestod med 159 filer / 2.169 tests.
- `npm run check:e2e-lanes`, `npm run typecheck:e2e` og målrettet ESLint bestod. Testændringerne
  blev committet i `1956eb8d`; produktionskode, beregningslogik, UI/UX og persistensformat er ikke ændret.

## Aktuel samlet release-retest på revision `64085759`

- `npm run verify:release:core` bestod med 667 testfiler, 8.667 beståede tests og 17 forventede
  `it.fails`. Coverage var 89,87 % statements, 81,18 % branches, 92,79 % functions og 92,72 % lines –
  henholdsvis 18.499/20.584, 13.062/16.090, 2.986/3.218 og 16.903/18.230 målte enheder.
  Coverage-fasen tog 317,38 sekunder på Node `v24.18.0`/Windows; begge applikationsbuilds og deres
  assetkontroller bestod. Rapporterne ligger i de ignorerede `coverage/`-artefakter.
- `npm run test:e2e` bestod med 186/186 på 3 workers og 4,0 minutter på samme kode-revision.
  Kørselens browserrejser omfattede også den aktuelle production-artifact-smoke mod E2E-artefaktet.
- `td019ValidatorSchemaIndependence.test.ts` bestod isoleret med 3/3, `fileHandleVerification.test.ts`
  bestod med 22/22, og den uafhængige validatorprøve omfatter nu 13 cases. `npm run check:github-actions-runtime`, testtypecheck,
  målrettet ESLint og `git diff --check` bestod.
- `64085759` indeholder kun test-/CI-værn og auditdokumentation; produktionskode, beregningslogik,
  UI/UX og persistensformat er ikke ændret. Den efterfølgende CI-ændring i `2b234dd0` kobler også
  E2E-matrixen til det uploadede produktionsartefakt, men en faktisk GitHub Actions-kørsel er fortsat
  åben under `B-002`.
- Den tidligere samlede coverage-fejl på `1ec7b01e` blev ikke reproduceret i denne release-gate.
  `TD-025` står derfor delvist lukket, mens årsagen til den oprindelige async-/Tooltip-følsomhed
  fortsat ikke er bevist.

## Seneste målrettede test efter revision `6549e20c`

- `npm run test:e2e -- e2e/pwa-file-open.spec.ts e2e/lazy-chunk-recovery.spec.ts e2e/pwa-service-worker.spec.ts`
  bestod med 8 tests og 2 forventede skips på 3 workers. Den nye native-kapabilitetstest bestod i
  Chrome og Edge og observerede `[object LaunchQueue]` med callable `setConsumer`; Firefox og WebKit
  skipper kun denne Chromium-specifikke måling. Lazy-chunk recovery bestod i alle fire browsermotorer,
  og service-worker-sporet bestod i det dedikerede Chromium-projekt.
- `npm run typecheck:e2e`, `npm run check:e2e-lanes` og målrettet ESLint bestod. Testen er tagget til
  browserbanen og bruger fælles `runtimeErrors`/`runtimeSignals`; ingen produktionskode,
  beregningslogik, UI/UX eller persistensformat er ændret.
- Den faktiske OS-filaflevering til en installeret PWA, herunder fokus og `.eo`-filen i native
  `launchQueue`, kan ikke fremkaldes reproducerbart i Playwright. `TD-022` er derfor fortsat delvist
  lukket. Den seneste samlede release-gate og fulde valgte E2E-kørsel er stadig den dokumenterede
  kørsel på `64085759` – de blev ikke gentaget efter denne test-only ændring.
- `6549e20c` indeholder kun testændringen; næste tråd skal begynde med at opdatere/reteste den
  samlede audit efter denne revision. Den tidligere lokale `.tmp-td020-rg.txt` er ikke en del af
  auditsporet og er ikke staged.

## Seneste målrettede test efter revision `5ccdf38d`

- `npx vitest run src/__tests__/document --reporter=dot` bestod med 26 filer / 273 tests.
  `documentDefinitionFixtureRegistry.test.ts` bestod med 62/62, herunder 17 faktiske PDF-/Word-
  tekstparitetsforløb og ét fysisk billedartefaktforløb for TAF-grafen.
- `npx vitest run src/__tests__/document/documentDefinitionFixtureRegistry.test.ts src/__tests__/document/documentPdfArtifactTextParity.test.ts src/__tests__/document/documentTextChannelParity.test.ts src/__tests__/utils/fileHandleKvStore.test.ts --reporter=dot`
  bestod med 4 filer / 66 tests. Den faktiske PDF-kontrol læser Blob-bytes, kræver PDF-header og
  `%%EOF`, springer billedstreams over i den snævre jsPDF-parser og sammenholder normaliseret tekst
  med den udpakkede Word-XML. Word-beviset går gennem en reel ZIP/XML-pakke.
- `npm run typecheck:test`, målrettet ESLint og hele pre-commit-gaten `npm run check:commit` bestod.
  Committen `5ccdf38d` indeholder kun testværn; produktionskode, beregningslogik, UI/UX og
  persistensformat er ikke ændret. Den samlede `verify:release:core` og den fulde valgte E2E-suite
  er derfor fortsat kun dokumenteret på `64085759`.
- Den foregående afgrænsede browserkørsel `npm run test:e2e -- e2e/calc-004-005-browser-download.spec.ts --project=chrome-desktop`
  bestod med 2/2 og kontrollerede `91.800 kr.`, `82.741 kr.`, PDF-header/EOF samt fælles
  `runtimeErrors`. Den første kørsel havde kun en harness-startfejl; gentagelsen var grøn og blev
  accepteret som evidens.
- `TD-014` er fortsat delvist lukket: artefaktsporet er bredere, men PDF-parseren er ikke generel,
  og fysisk rendering, sideskift samt uafhængig semantisk paritet mangler. `TD-017` er fortsat åbent;
  `fileHandleKvStore.test.ts` lukker kun direkte mockede KV-forløb og ikke den samlede browser-/OS-
  File API-sammenhæng.

## Seneste samlede retest på revision `83abfdad`

- `npm run verify:release:core` bestod med 661 testfiler, 8.603 beståede tests og 6 forventede
  `it.fails`. Coverage var 89,23 % statements, 80,48 % branches, 92,35 % functions og 92,02 % lines –
  henholdsvis 18.369/20.584, 12.950/16.090, 2.972/3.218 og 16.776/18.230 målte enheder. Begge
  applikationsbuilds og deres assetkontroller bestod.
- Fuld valgt E2E-suite bestod med 180/180 på Chrome, Edge, Firefox, WebKit, markerede viewports og
  fallback-/service-worker-baner. Den nye EET-kapitaliseringstest bestod i samme kørsel; ingen
  ukontrollerede runtimefejl blev rapporteret af fælles-fixturen.
- En tidligere parallel gentagelse stoppede undervejs, da E2E-buildserveren døde efter den første
  timeout og gav kaskaderende forbindelsesfejl. Den blev ikke accepteret som evidens; en ren gentagelse
  med samme 3-worker-opsætning bestod 180/180.
- `eetPageAudit.spec.ts` bestod isoleret med 7/7 på Chrome-basisbanen. Den samlede EET-specsuite
  bestod med 24/24, og den uafhængige validator-kontrol bestod med 10/10.
- Test- og dokumentationssporet er nu committet i `83abfdad`; den efterfølgende dokumentationscommit
  gør denne status reproducerbar. Åbne fund og udviklerbeslutninger er uændrede.

## Målrettet retest på revision `a6d85e00`

- `CALC-005`: målrettet flade bestod med 8 filer / 83 tests. Command-runner-mutationen af
  `forsoergertabCalculation.ts` dræbte 21/21 mutationer uden timeout eller tekniske fejl; tre oprindelige
  overlevere blev lukket med en eksplicit blokeret EAL-sag for `null`, `null`, `false`-sentinelfelterne.
- `ARCH-003`/`SHELL-002`: den målrettede PWA-kontrol efter samling på fælles login-, navigation- og
  runtime-error-fixtures bestod med 9/9. `/open` lander korrekt via den fælles helper på `/stamdata`.

## Målrettet dokumentretest i den aktuelle arbejdsrevision

- `documentTextChannelParity.test.ts` kører Varige mén-generatoren gennem PDF-writerens faktiske
  tekstkald og Word-writerens faktiske `document.xml`; den normaliserede tekst er identisk i både
  labels, tal, sektioner og rækkefølge: 1/1 bestået.
- Den samlede målrettede dokumentkørsel med den nye test, Varige mén-Word-testen og tabel-
  kanalpariteten bestod med 3 filer / 23 tests. `npx tsc -p tsconfig.test.json --noEmit` og målrettet
  ESLint bestod.
- Prøven er semantisk og bruger en deterministisk jsPDF-spy. Den er ikke fysisk PDF-parse/render;
  `pdfinfo`, `pdftoppm`, `pdftotext` og Python-modulerne `pypdf`/`pdfplumber` er ikke tilgængelige.
  Arbejdsændringen er test-only, committet i `292dde0d` og kan ikke lukke TD-014.

## Seneste målrettede test efter revision `329c43cf`

- `npx vitest run src/__tests__/domain/eoInspektion/eoInspektionLoenCoreModel.test.ts --reporter=dot`
  bestod med 16/16. Den tidligere svage `> 0`-assertion er erstattet af konkrete KL-facitter:
  158,18 kr. grundløn, 19,7725 kr. feriepenge, 0,71181 kr. Store Bededagstillæg og 178,66431 kr.
  dagstotal. Den sidste procentberegning kontrolleres med en snæver numerisk tolerance for at undgå,
  at floating-point-repræsentationen skjuler en reel forskel.
- `npm run typecheck:test`, målrettet ESLint og hele pre-commit-gaten bestod. Committen `329c43cf`
  indeholder kun testændringen; produktionskode, brugeradfærd, beregningslogik og persistensformat er
  ikke ændret. TD-020 er styrket, men validatorpartitioner og komplet downstream-paritet står åbne.

## Seneste målrettede test efter revision `ae0945ce`

- `npx vitest run src/__tests__/quality/githubActionsRuntimeCheck.test.ts --reporter=dot` bestod med
  6/6, inklusive den statiske kontrol af verify-jobbets upload og E2E-/deploy-jobbenes download af
  `dist` med samme artefaktnavn. `npm run typecheck:test` og målrettet ESLint bestod.
- Hele pre-commit-gaten bestod, og committen `ae0945ce` indeholder kun testinfrastruktur. Der er
  ikke ændret produktkode, brugeradfærd, beregningslogik, UI/UX eller persistensformat. B-002 er
  styrket som statisk testværn, men en faktisk GitHub Actions-kørsel mod uploadet artefakt mangler.

## Seneste samlede retest på revision `817a55e9`

- `npm run verify:release:core` bestod med 669 testfiler, 8.689 beståede tests og 17 forventede
  `it.fails`. Coverage var 90,14 % statements, 81,21 % branches, 93,97 % functions og 92,96 %
  lines – henholdsvis 18.555/20.584, 13.067/16.090, 3.024/3.218 og 16.947/18.230 målte enheder.
  Begge applikationsbuilds og deres assetkontroller bestod.
- `npm run test:e2e` bestod med 190/192 tests og 2 forventede skips på 3 workers. Skippene er den
  Chromium-specifikke native `LaunchQueue`-måling i Firefox og WebKit; ingen ukontrollerede browser-
  eller page-fejl blev rapporteret.
- Retesten kørte efter test-only-committen `ae0945ce` og den efterfølgende statuscommit `817a55e9`.
  De kendte Vite `configLoader: 'native'`- og store chunk-advarsler består og er fortsat registreret
  som restpunkter; ingen ny regressionsfejl blev fundet. Port 4173 var fri efter E2E-oprydningen.

## Næste arbejdsenhed

`CALC-004` og `CALC-005` har nu uafhængige totalsager og browserrejser, og `CALC-002`/`CALC-003`/`CALC-004`/`CALC-005` har afgrænsede mutationstests med triagerede overlevere. `CALC-006` har fået række-/periodefacitter; fortsæt med afklaring af `TD-016` og øvrige EO-grene. `TD-019` og `TD-020` er delvist lukket med henholdsvis schema-/issuefacitter og udvalgte sats-/downstream-facitter, herunder et konkret KL-facit gennem EO-inspektionen.
`DOC-001` har standalone/per-output-lifecycle og EET-tabelparitet. `DOC-002`/`DOC-003` har nu faktisk PDF-artefaktbevis for alle 18 hovedapp-outputs, men den snævre parser kan ikke lukke fysisk PDF-/Word-rendering, sideskift eller uafhængig semantisk paritet; fortsæt med `TD-014` og en afgrænsning af, om de 18 Word-kompatible outputs eller alle 21 katalogoutputs skal omfattes.
`DATE-001` kræver fortsat uafhængig håndregning og afklaring af `TD-003`, `PERSIST-001` kræver releaseproveniens eller accepteret fixture-erstatning under `TD-001`, og `PERSIST-002` kræver fortsat platform-/IndexedDB-bevis under `TD-017`. Afslut løbende de resterende `INPUT`-/`VALID`-, `DATA`-, shell- og releaseværnshuller, og gennemfør en samlet rest-risikorevision. Route-chunk recovery er nu browserretestet 4/4, native `LaunchQueue`-objektets form er målt 2/2 i Chrome/Edge, men OS-filaflevering, fuld outputparitet, releaseproveniens og de øvrige åbne fund står fortsat. Den statiske CI-artefaktkobling er nu dækket i quality-test, men B-002 mangler fortsat faktisk CI-kørsel mod deploy-artefaktet. Den samlede `verify:release:core` er senest kørt rent på `817a55e9` med 669 testfiler / 8.689 beståede tests, 17 forventede `it.fails` og begge builds; den valgte E2E-gate er også kørt rent med 190 beståede tests og 2 forventede skips ud af 192. `TD-025` står delvist lukket efter den tidligere ikke-reproducerede flage.
Hver række skal kobles til
konkret test- og uafhængig evidens, før status
sættes til andet end `I gang`.
