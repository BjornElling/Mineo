# Auditspor – TD-AUDIT-2026-09-10-01

Dette er auditsporets versionsbundne indeks. Genererede rapporter ligger i de ignorerede mapper under
projektroden og må ikke indeholde rigtige person- eller sagsdata. Rapportstierne er historiske lokale
outputstier og garanterer ikke, at rapporten stadig findes efter en senere kørsel.

## Status

- Evidensrevision: `decec96a` for seneste samlede releasegate; seneste målrettede test-only batch er `decec96a`, og seneste fulde E2E er `decec96a`
- Branch: `main`
- Startdato: 2026-09-10 Europe/Copenhagen
- Fase: Auditstart og baseline afsluttet; makroinventar oprettet; `INPUT-001`, `PERSIST-001`, `PERSIST-002`, `DATA-001`, `CALC-001`–`CALC-007`, `DOC-001`–`DOC-003` samt shell-/standalone-flader foreløbigt gennemgået. Mutationsrunneren er kvalificeret på `DATE-001`-moneyfladen, `dateCommit.ts`, `CALC-001`-ASL-maksimum og reguleringsmotorer, `CALC-002`-årsløn, `CALC-003`-procesrente, `CALC-004`-varige mén og `CALC-005`-forsørgertab; historiske `.eo`-fixtures, byteintegriteten for de rekonstruerede fixtures, uafhængige reference-/EO-orakler, dokumentlifecycle-bevis for alle registrerede outputs, reel session-reload, produktionsbundet form/grid-paritet, bootstrap-sideeffektbevis, mobil-hard-stop i browser, EET-tabelparitet og Word-indhold, EETs fire faktiske PDF-artefakter, uafhængige satsfacitter, uafhængige sats-, procesrente-, KRL- og KL-downstream-facitter, standalone valid-PDF-forløb, browserbaseret namespace-isolation, uafhængige totalsager for varige mén/forsørgertab, uafhængige EO-række-/periodefacitter, nested row-schema-partitioner, faktiske `ZodError.issues`, File API-/IndexedDB-fejlveje, validator-literalfixtures og obligatoriske top-level-, lønregulerings-, løntrin-, løngruppe-, manuelle procentsats-, indtægtsoplysnings- og SFGG-schema-/validatorfacitter, levende GitHub Actions-/architecture-runtimeværn, statisk CI-artefaktkobling, Varige méns faktiske PDF-artefakt/Word-tekstparitet, fysisk tekst-/billedartefaktkontrol for alle 18 hovedapp-outputs, faktisk route-chunk recovery og native LaunchQueue-kapabilitet er tilføjet og retestet. Den seneste batch har desuden uafhængige procent-/uge-/dagfacitter for årsløn, månedlig/ugentlig engine-dækning for procesrente, et præcist KRL-validatorfacit, en offentlig-løn-validatorcase, et løbende EET-definition → Word-facit, et svie/smerte-downstream-facit og et uafhængigt ISO-ugefacit. Den samlede `verify:release:core` er senest bestået på `28cdcb2b` med 737 testfiler / 8.824 beståede tests, coverage 90,23 / 81,38 / 93,97 / 93,05 og begge builds. Den valgte E2E-suite er senest bestået på `e0f9d340` med 201 beståede tests og 2 forventede skips ud af 203; siden da er kun test- og auditdokumentation ændret. Åbne produkt-/proveniensbeslutninger, TD-025's ikke-årsagsforklarede flagerisiko og højere-niveau-outputparitet forhindrer fortsat afslutning.
- Hoveddokument: `docs/testing/testdaekningsgennemgang.md`
- Beslutningsark til udvikleren: `docs/testing/testdaekningsgennemgang-audit/AFVENTER-BESLUTNINGER.md`
- Seneste samlede retest: `verify:release:core` på revision `decec96a` er grøn med 774 testfiler og 8.868 beståede tests uden tilbageværende forventede `it.fails`; coverage er 90,26 / 81,41 / 94,03 / 93,06, og begge builds bestod. Den fulde E2E-suite på revision `decec96a` bestod med 213 tests og 2 forventede skips ud af 215 på 10 projektbaner, med 3 workers på 5,3 minutter. TD-003, TD-017 og den konkrete TD-043-afrundingsforskel er lukket; åbne produkt-, proveniens-, outputparitets-, TD-025-stabilitets- og TD-088-modalefund forhindrer fortsat afslutning.
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
| Aktuel fuld Vitest-retest | `npm run test:coverage` | Bestået | 774 filer, 8.868 tests bestået og ingen forventede `it.fails`; coverage 90,26 / 81,41 / 94,03 / 93,06 på `decec96a` |
| E2E-baner | `npm run test:e2e` | Bestået | 213 beståede tests og 2 forventede skips ud af 215, 5,3 min, 3 workers og 10 projektbaner på `decec96a`; den udvidede kørsel omfatter de fire dedikerede browserprojekter |
| Aktuel samlet release-gate | `npm run verify:release:core` | Bestået | Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-, ledger-, coverage- og begge build-gates bestået på `decec96a`; coverage 774 filer / 8.868 beståede tests / ingen forventede `it.fails` |
| Coverage (historisk releasekørsel) | `npm run verify:release:core` | Bestået | 661 testfiler / 8.603 tests bestået samt 6 forventede `it.fails`; 89,23 % statements, 80,48 % branches, 92,35 % functions, 92,02 % lines; 18.369 / 20.584, 12.950 / 16.090, 2.972 / 3.218 og 16.776 / 18.230 målte enheder; `coverage/index.html`, `coverage/clover.xml` og `coverage/coverage-final.json` |
| Aktuel coverage-retest | `npm run test:coverage` | Bestået | 393 instrumenterede filer; 90,26 % statements, 81,41 % branches, 94,03 % functions, 93,06 % lines; 18.582/20.587 statements, 13.103/16.094 branches, 3.027/3.219 funktioner og 16.968/18.232 linjer; `coverage/index.html`, `coverage/clover.xml` og `coverage/coverage-final.json`; `decec96a`, Node `v24.18.0`/Windows |
| Persistensmålrettet suite | `npx vitest run ...` (se hoveddokumentet) | Bestået | 24 filer, 233 tests, 10,19 s |
| Historiske `.eo`-fixtures | `npx vitest run src/__tests__/utils/historicalEoFixtures.test.ts` | Bestået | 5 tests; fixtures for legacy uden version samt 1.0.4, 3.10, 3.12 og 3.13 |
| Persistenssuite efter fixturetilføjelse | `npx vitest run ...` (se hoveddokumentet) | Bestået | 26 filer, 252 tests; byteintegritet 5/5 SHA-256-facitter |
| Dokumentlifecycle | `npx vitest run src/__tests__/document/documentLifecycleMatrix.test.ts src/__tests__/document/documentLifecycleCoordinatorIntegration.test.tsx` | Bestået | 2 filer, 23 tests; alle registrerede stale-/fejltrin og reel editor/coordinator-integration |
| Platform-/storagefejlveje | Målrettet Vitest-kørsel (se hoveddokumentet) | Bestået | 8 filer og 89/89 tests, herunder callable picker-detektion, unavailable-/exception-/request-/transaction-fejl; `safeLocalStorage.test.ts` bestod desuden med 11/11 direkte Node-fallback-isolationsassertions; `fileHandleVerification.test.ts` bestod separat med 22/22 direkte fil- og mappehandle-verifikationer; `fileHandleKvStore.test.ts` bestod med 2/2 statiske/client-scopede write/read/delete-tests |
| Validatorer og dataendepunkter | Målrettet Vitest-kørsel (se hoveddokumentet) | Bestået | Uafhængige validator-literals, 13 håndskrevne typed schema-runtime-cases inklusive negativ fritvalg-procent, obligatorisk top-level schema-facit, direkte Beregningsperiode-, TAF-feriedags-, KRL-, offentlig-løn-, overenskomst-, manuel-løn-, manuel-procentsats- og SFGG-facitter, statiske data-/endpointfacitter, 2 folkepensions-downstreamfacitter, 2 pensionsalder-downstreamfacitter, 1 forsørgertabs-downstreamfacit, 1 KRL-downstreamfacit, 1 Statistik/ILON12-downstreamfacit, 1 ILON12-dokumentfacit, 1 procesrente-downstreamfacit, 1 svie/smerte-downstreamfacit samt offentlig-løn-facitter 3/3, overenskomst-facit 1/1, manuel-løn-facit 1/1 og manuel-procentsats-facit 1/1 |
| Dokumentkanalparitet | Målrettet Vitest-kørsel (se hoveddokumentet) | Bestået | 19/19 EET-tabelparitet; `documentPdfArtifactTextParity.test.ts` 1/1; `documentDefinitionFixtureRegistry.test.ts` 67/67 med 18 hovedapp-tekst-, ét hovedapp-billed- og 3 standalone-tekstartefaktforløb samt TAF-grafens konkrete PDF/Word-billedfacit; parseren er snæver og fysisk rendering er fortsat åben |
| DATE-001 mutation | `npx --no-install stryker run .tmp-date-commit-stryker.json --logLevel info` | Bestået med triagerede ækvivalente mutationer | `dateCommit.ts`: 6 mutationer, 4 dræbt, 2 ækvivalente, 0 timeout/fejl |
| CALC-001 mutation – ASL-maksimum | `node node_modules/@stryker-mutator/core/bin/stryker.js run coverage/.tmp-calc001-stryker.config.json` | Bestået med triagerede ækvivalente mutationer | `aslAarsloensmaksimum.ts`: 28 mutationer, 26 dræbt, 2 ækvivalente, 0 timeout/tekniske fejl |
| CALC-001 mutation – reguleringsmotorer | `node node_modules/@stryker-mutator/core/bin/stryker.js run coverage/.tmp-calc001-opreguleringsmotorer.config.json` | Bestået med triagerede overlevere og timeout-mutanter | `opreguleringsmotorer.ts`: 113 mutationer, 104 dræbt, 6 triagerede overlevere, 3 timeouts, 0 tekniske fejl; score 94,69 % |
| CALC-002 mutation | `npx --no-install stryker run .tmp-aarsloen-stryker.json --logLevel info` | Bestået med triagerede mutationer | `aarsloenCalculations.ts`: 113 mutationer, 108 dræbt, 5 rapporterede overlevere; én blev dræbt i isoleret kontrolkørsel, 4 er ækvivalente, 0 timeout/fejl |
| CALC-004 mutation | `npx --no-install stryker run .tmp-varigemen-mutation.json --logLevel info` | Bestået med triagerede ækvivalente mutationer | `varigeMenCalculations.ts`: 114 mutationer, 94 dræbt, 20 ækvivalente, 0 timeout/fejl |
| CALC-003 mutation | Selektiv StrykerJS command-runner mod `procesrenteCalculator.ts` | Bestået med triagerede mutationer og dokumenterede timeout-mutanter | 136 mutationer, 104 dræbt, 23 triagerede survivors, 9 timeouts, 0 fejl |
| CALC-005 mutation | Selektiv StrykerJS command-runner mod `forsoergertabCalculation.ts` | Bestået | 21 mutationer, 21 dræbt, 0 timeout/fejl |
| GitHub Actions-runtime | `npm run check:github-actions-runtime` og quality-suite | Bestået | 2 workflows og 8 quality-tests; den tidligere vakuøse `- uses:`-form, deployets push-til-main-gate samt alle fire dedikerede browserprojekter kontrolleres nu |

## Baselineobservationer til triage

- Coverage er afgrænset til `src/domain/**`, `src/utils/**`, `src/hooks/**`, `src/rowDrafts/**` og
  `src/contexts/**`; resten af produktionskildetræet skal dækkes via inventar og andre testniveauer eller
  registreres som et konkret coveragehul.
- Ved auditstart fandtes ingen mutationsrunner i projektets scripts. Værktøjskvalificeringen er nu gennemført
  med Stryker command-runneren, og `strykerCommandRunnerConfig.test.ts` beskytter den valgte konfiguration
  mod drift.
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
- En tidsafgrænset forundersøgelse af `eetEalCalculation.ts` bestod dry-run med 434 mutationer, men en
  seriel kørsel nåede kun 32/434 efter cirka ét minut (27 dræbte, 5 overlevere, 0 tekniske fejl) og blev
  stoppet, fordi den estimerede fulde kørsel oversteg 20 minutter. Der findes derfor ingen afsluttende
  EET-mutationsscore; delresultatet er ikke brugt som auditbevis.
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
- `td019ValidatorRequiredField.test.ts` dækker det obligatoriske top-level-felt
  `loenindkomstAnsaettelsesforhold` med et uafhængigt `ZodError.issues`-facit på 1/1.
  Den målrettede validator-/schema-suite bestod med 4 filer / 105 tests.
- `td020ProcesrenteDownstreamIndependent.test.ts` fører statiske 2024-renter gennem
  `computeRenteberegning` og fastholder halvårsskift, 366-dagesår og den synlige samlede
  rente på `94,94 kr.` med 1/1 grøn test. Facittet bruger ikke procesrente-helperen som
  forventning.
- `persistence-reload-session.spec.ts` bevæger afsluttet input og aktiv fane gennem reel browser-reload
  med 1/1 grøn test. `minprocesrente-valid-download.spec.ts` dækker valid beregning, gates, faktisk PDF
  og `beforeunload`-exit-guard med 1/1 grøn test. `bootstrapUnsupportedDeviceSideEffects.test.tsx`
  dækker de tidlige unsupported-device-sideeffekter med 1/1 grøn test. `unsupported-device-hard-stop.spec.ts`
  dækker den synlige mobil-hard-stoprejse med 1/1 grøn test, og `eetPageAudit.spec.ts` validerer nu
  semantisk Word-indhold for løbende ydelser, kapitalisering, EET efter EAL og Differencekrav fra den
  faktiske hovedapp-download. Differencekravets samlede PDF→Word-test kontrollerer nu samme synlige
  beløb og fælles labels i begge kanaler med 1/1 målrettet E2E på `1e02e24b`.
- `documentLifecycleCoordinatorIntegration.test.tsx` kobler en reel `useFieldEditor`-settle-revision og
  `CriticalActionCoordinator` til dokumentgaten og blokerer rejected input før projection og renderer-load.
- `fileSystemAccess.test.ts`, `fileHandleStorage.failurePaths.test.ts` og den udvidede
  `indexedDbStore.test.ts` dækker unavailable-/exception-/transaction-fejl. De tidligere ni
  ikke-callable picker-prober er nu almindelige grønne tests efter callable capability-detektion.
  `utcDayMath` har desuden otte grønne negative modcases for `Invalid Date` under `TD-003`.
- `tableChannelParity.golden.test.ts` sammenholder EET-løbende-ydelsers resolved PDF-tabelceller med Word-
  `document.xml`; de målrettede dokumenttests bestod med 29/29. Det lukker ikke generel PDF-parse/render.
- `dateCommit.ts` blev mutationstestet med 6 mutationer, hvor 4 blev dræbt og 2 blev triageret som
  ækvivalente. `check-github-actions-runtime.mjs` matchede tidligere ikke den levende YAML-form `- uses:`;
  6 quality-tests reproducerer nu både den grønne baseline og de relevante negative cases.
- `aslAarsloensmaksimum.ts` blev mutationstestet med 28 mutationer, hvor 26 blev dræbt og 2 blev triageret
  som ækvivalente (`typeof`-betingelsen er redundant med `Number.isFinite`, og singleton-branchens
  `join(', ')` giver samme tekst). Der var ingen timeout eller teknisk fejl; den målrettede suite bestod
  med 9/9 efter tre diskriminerende assertions for ikke-heltal, `Infinity` og tomt indeks-map.
- `lazy-chunk-recovery.spec.ts` fremkalder en faktisk 404 på en route-chunk og beviser synlig recovery
  uden automatisk reload og med klikudløst reload i alle fire browsermotorer. Browsernes console- og
  requestlogik er ikke ens, så native `launchQueue` og fuld platformsparitet står fortsat åbne.

## Foreløbig fladegennemgang

| Inventar-ID | Gennemført | Evidens | Åbne punkter | Status |
| --- | --- | --- | --- | --- |
| `INPUT-001` | Kontrakt- og testinventar gennemgået; målrettet suite kørt separat; kontrolleret no-op-modprøve og uafhængig referencekontrol udført | Baseline 5 filer / 176 tests bestået; svækket no-op-gate gav 51 fejl / 146 tests; gendannet kontrol 2 filer / 103 tests bestået; separat referencekontrol 1/1 test bestået; se hoveddokumentets detaljerække | Kvalificeret mutationsrunner, fuld testkvalitetsrevision og browser-/adapterparitet | `I gang` |
| `PERSIST-001` | Kontrakt-, consumer- og testinventar gennemgået; målrettet save/load-suite, historiske fixturetests, byteintegritet og uafhængig referencekontrol kørt separat | Den reproducerbare målrettede suite: 26 filer / 252 tests bestået; `historicalEoFixtureIntegrity.test.ts`: 5/5 SHA-256-facitter; `fileRoundTrip.independentReference.test.ts`: 1/1 bestået | Releaseproveniens eller accepteret fixture-erstatning, mutation og fuld testkvalitetsrevision | `I gang` |
| `PERSIST-002` | Storage/settings, filhåndtag, PWA-filflows og reel session-reload gennemgået | 15 filer / 180 målrettede unit-/hook-tests; PWA-/filkørsel 4/4; reel input + aktiv fane + reload 1/1; supplerende 8-filers platformssuite med 89/89 beståede tests efter callable picker-detektion; `safeLocalStorage.test.ts` bestod med 11/11 direkte Node-fallback-isolationsassertions; `fileHandleVerification.test.ts` bestod med 22/22; `fileHandleKvStore.test.ts` bestod med 2/2; ugyldige `Date`-inputs har 8/8 grønne negative modcases | Fuld browser-/platformssammenhæng, herunder installeret PWA-filaflevering; `TD-022` | `I gang` |
| `INPUT-002` / `VALID-001` | Form/grid-overflader, produktions-ChoiceField og schema-/validatorhuller gennemgået | 68 filer / 1.526 tests; produktionsbundet form/grid-paritet, 12 nested row-schemas, faktiske `ZodError.issues`, 11 uafhængige validator-literaltests, 13 håndskrevne typed runtime-cases inklusive negativ fritvalg-procent, et obligatorisk top-level schema-facit, direkte Beregningsperiode-lønreguleringsfacit samt selvstændige KRL-, offentlig-løn-, overenskomst-, manuel-løn-, manuel-procentsats- og SFGG-facitter er dækket. `td019TafLoseFeriedageValidatorIndependent.test.ts` tilføjer et uafhængigt TAF-facit for for mange løse feriedage, `td019ForligAnsvarsgradBroekValidatorIndependent.test.ts` dækker nu både en forligsbrøk over 1 og nul som tæller med præcise stier, beskeder og severity, `td019SfggReferenceperiodeOrderValidatorIndependent.test.ts` dækker en weekend-only SFGG-referenceperiode med præcis issue-evidens, og `td019TafDatoordenValidatorIndependent.test.ts` dækker omvendt TAF-datoorden med præcis issue-evidens. `td019SvieSmerteMenafoerelseCutoffValidatorIndependent.test.ts` dækker desuden cutoff ved ménafgørelsesdatoen med præcis issue-evidens | Yderligere validator-fixture-uafhængighed og downstream-partitioner; `TD-019` | `I gang` |
| `DATA-001` | Data-/satskatalog, integritet og udvalgte uafhængige endpointfacit gennemgået | Den målrettede data-/sats-/endpoint-suite havde baseline på 34 filer / 532 tests og er suppleret med uafhængige downstream-facitter for RLTN-komponent, Læreroverenskomst, Læreroverenskomst-TAF, ledighedsydelse gennem kalenderdagsconsumeren og ILON12 gennem det faktiske reguleringsdokument. Dertil kommer literal-facit for udvalgte perioder, 25 statiske endpoint-/partitionfacitter, 2/2 statiske folkepensions-downstreamfacitter, 2/2 statiske pensionsalder-downstreamfacitter, 1/1 statisk forsørgertabs-downstreamfacit, 1/1 KRL-downstreamfacit, 1/1 Statistik/ILON12-downstreamfacit og 16/16 offentlig KL-løn-tests med konkret komponent-/dagstotalfacit samt sats → beregning → dokument-kæde. `loenudviklingBeregning.test.ts` har desuden et statisk SBLON2-downstream-facit med 48/48 beståede tests, procesrente-downstreamfacittet bestod 1/1, og sygedagpengebanen har statiske facitter for 2025 samt 2019/2020-satsgrænsen; samme fil har desuden et RLTN-facit for 2024-04-01–2024-10-01 og et svie/smerte-facit for 2024 med 230 kr. fuld og 115 kr. delvis sats | Resterende kilder, validatorpartitioner og komplet downstream-paritet; `TD-020` | `I gang` |
| `CALC-001` | Satser og fælles reguleringsdata gennemgået som målrettet domænebaseline | Den samlede data-/satssuite bestod med 27 filer / 489 tests; uafhængige literal-facit, statiske downstream-kæder, 1/1 Statistik/ILON12-facit og 16/16 konkrete offentlig KL-løn-tests i EO-inspektionen er tilføjet. `aslAarsloensmaksimum.ts` bestod målrettet mutation med 26/28 dræbte og 2 triagerede ækvivalente overlevere uden timeout/tekniske fejl. `opreguleringsmotorer.ts` bestod med 104/113 dræbte, 6 triagerede overlevere og 3 loop-timeouts uden tekniske fejl efter 30/30 målrettede tests | Integration/E2E, resterende dataregistrenes endepunkter, validatorpartitioner og komplet downstream-konsumentparitet | `I gang` |
| `ARCH-002` | Registry-completeness, rule-factory-liveness og udvalgte negative modcases tilføjet til arkitekturharnessets dedikerede tests | `architectureRules.test.ts`: 1 fil / 190 tests bestået; separat forventningsliste med 88 regel-ID'er, AST-opslag af eksporterede definitions/aggregater samt re-export- og liveness-modcases; `TD-015` lukket for de konkrete huller | De enkelte reglers negative modcases, importgrænser og øvrige livenessværn mangler | `I gang` |
| `DATE-001` | Pengefladen er mutationstestet modulvist med den kvalificerede command-runner; datoassertions er styrket | 58 money-mutationer: 56 dræbt, 2 triageret som ækvivalente; `fromKroner`-mutationen ved `> 1e-4` → `>= 1e-4` er konkret triageret som matematisk ækvivalent, fordi grænsen ikke kan rammes eksakt af et gyldigt repræsenterbart ikke-nul heltalsbeløb med den krævede decimalopløsning. 13 money-tests grønne. Dato-/SH-suiten: 6 filer / 109 tests grønne efter præcise grænseassertions, eksakt 2024-facit, håndberegnet skudårsinterval og uafhængigt ISO-ugefacit for årsskifte og uge 53; ugyldig `Date` afvises nu i `utcDayMath`; `periodeBeregningKalendermaanederIndependentOracle.test.ts` fastholder fire unikke hele måneder ved årsskifte og overlap, og `periodeBeregningKalendermaanederAfvisningIndependentOracle.test.ts` afviser 28. februar 2024 som falsk månedsslutning; `coverage/mutation/mutation.json` | Uafhængig håndregning og resten af dato-/periodiseringsfladen mangler. `TD-003` er lukket for den interne ugyldig-dato-invariant. | `I gang` |
| `CALC-002` | Method C dag gennemgået med den tidligere utestede hele-kalendermåned-branch og uafhængig mutationstest | Seks uafhængige/branchestyrkende testfiler bestod med 39/39 tests for Metode A/B/C, nul, feriegrænse, procentbaserede tillæg, månedsløn, ugeløn og dag-fallback; `aarsloenDocumentIndependent.test.ts` tilføjer et håndberegnet downstream-facit på 1/1 gennem dokumentgeneratoren; `periodeBeregningKalendermaanederIndependentOracle.test.ts` og den negative skudårsvariant supplerer periodiseringsgrenene; `aarsloenDocumentPdfWordArtifactIndependent.test.ts` og `aarsloenDocumentMethodAIndependent.test.ts` fører håndberegnede cases gennem faktiske PDF- og Word-artefakter; facitfixtures bruger nu eksplicitte typed værdier uden produktionsdefaults; command-runner: 108/113 mutationer dræbt, 5 rapporterede overlevere, hvoraf én blev dræbt i isoleret kontrolkørsel og fire er triageret som ækvivalente | Resterende årslønsbranches, integration/downstream-paritet og fuld brugerrejse | `I gang` |
| `CALC-003` | Procesrente-oracle og selektiv mutation gennemgået med intervalgrænser og daglig kontinuitet | `procesrenteCalculator`-fladen: 32 målrettede tests bestået; renteberegningsmappen 12 filer / 147 tests; nye engine-facitspor dækker månedlig kalender-clamp og ugentlig tillægstid gennem PDF-context; mutation 104/136 dræbt, 23 triagerede survivors og 9 ikke-terminerende timeouts uden tekniske fejl; separat statisk 2024-downstreamfacit 1/1 gennem `computeRenteberegning`; række-id-testen kræver nu en ikke-blank streng; `TD-009` lukket for den konkrete invariant | Standalone-deling, øvrige rente-/inputbranches, outputparitet og uafhængig efterregning | `I gang` |
| `CALC-004` | Varige mén-fladen gennemgået som målrettet unit-/integrationstestbaseline, uafhængig totalsag og mutationstest | 10 filer / 83 tests bestået; méngrad-, satsår-, alder-, 39-årsgrænse-, dato-, afrundings- og gatecases samt håndberegnet engine → projection → gate-facit er registreret; command-runner: 94/114 mutationer dræbt, 20 triageret; browserrejse 1/1 med `91.800 kr.` og faktisk PDF-header/EOF | Generel PDF/Word-paritet og overlaprevision | `I gang` |
| `CALC-005` | Forsørgertabsfladen gennemgået som målrettet unit-/integrationstestbaseline, uafhængig totalsag og mutationstest | 8 filer / 83 tests bestået; snapshot-/reader-gates, kønsgrene, perioder, minimum/maksimum, EAL/ASL-afhængigheder og håndberegnet totalsag er registreret; command-runner dræbte 21/21 mutationer uden timeout/fejl; browserrejse 1/1 med `82.741 kr.` og faktisk PDF-header/EOF; kønsneutralt tabelvalg hævdes nu med konkret `'F'` | Generel PDF/Word-paritet og overlaprevision | `I gang` |
| `CALC-006` | EO-snapshot, canonical totals, dokumentprojektion, inspektionsdage og sidevisning stikprøvet med fem uafhængige orakler samt række-/periodefacitter | Den målrettede `CALC-006`-kørsel bestod med 162 filer / 2.176 tests, heraf 9 nye uafhængige række-/periodecases; de fem EO-/inspection-orakler består samlet af 11 tests. Det nye ugeperiode-facit fordeler 900 kr. i Beløb-tilstand over fem hverdage med 180 kr. pr. dag og ingen integrity issues. Midlertidig EET-konsistens er nu prøvet i begge retninger med konkrete advarselsrækker, og `eoRowTafEndeligEetIndependent.test.ts` fastholder et uafhængigt facit for endelig EET som TAF-ophørsårsag. En weekendydelse i arbejdsdagsbaseret TAF gav observeret `control:sammentaelling_mismatch`; `TD-016` er åbent | Øvrige rækkegrene, dokumentparitet, mutation og fuld E2E; udviklerens beslutning om TD-016 | `I gang` |
| `DOC-001` | Katalog, definitioner, gate/lifecycle og renderer-wiring gennemgået som evidensbaseline for alle registrerede outputs | Fokuseret fixture-/lifecyclekontrol: fixture-registret 67/67 og 31 dokumentfiler / 283 tests efter faktisk PDF-/Word-artefaktkontrol. `standaloneRenteAlleDocumentDefinition.test.ts` tilføjer 1/1 semantisk renderer-facit, `aarsloenDocumentIndependent.test.ts` tilføjer 1/1 uafhængigt årslønfacit gennem dokumentgeneratoren, `aarsloenDocumentPdfWordArtifactIndependent.test.ts` og `aarsloenDocumentMethodAIndependent.test.ts` tilføjer to faktiske Årsløn-PDF/Word-facitter, og `eetDocumentDefinitionIndependent.test.ts` består med 2/2 EET-definition-facitter, hvor efter-EAL-sagen kontrolleres i faktisk PDF og Word. Kataloget dækker 18 Mineo- og 3 standalone-outputs; TD-012 er lukket og TD-013 retestet med udvidet fasebevis | TD-014: manglende generel fysisk rendering og uafhængig PDF/Word-paritet | `I gang` |
| `SHELL-001` / `SHELL-002` | Auth, routes, desktop-/unsupported-device-gate, 404, PWA, service worker, preload og browsermotorer gennemgået | 26 fokuserede filer / 125 tests; bootstrap-sideeffekter 1/1, synlig mobil-hard-stop 1/1, shell/404 4/4, minimumsviewporter 12/12, PWA-installation 8/8, lazy-chunk recovery 4/4, native LaunchQueue-form 2/2 i Chrome/Edge, manifestets `.eo`-filhandler til `/open` 8/8 i Chrome, øvrige målrettede browserflows grønne; seneste fulde E2E 201/203 på `e0f9d340` efter fælles helper-konvergens | Fuld OS-/installeret-PWA-filaflevering og øvrig PWA-/platformsparitet; `TD-022` | `I gang` |
| `MIN-001` | Standalone isolation, reset/fokus, error boundary, valid beregning, PDF, exit-guard og browserbaseret namespace-isolation gennemgået | `minprocesrente-valid-download.spec.ts`: 1/1, `minprocesrente-namespace-isolation.spec.ts`: 1/1 samt 201/203 i seneste fulde E2E på `e0f9d340` | Fuld outputparitet og mutation | `I gang` |
| `BUILD-001` | Asset-eksistenskontrol, release-graf og PWA-manifestets faktiske filudvalg gennemgået | Syntetisk `verifyBuildArtifacts.test.ts`: 2/2; `releaseGateBuildLiveness.test.ts`: 2/2 med positiv/negativ scriptgraf; begge produktionsbuilds bestået; E2E-matrixen downloader det uploadede artefakt; lokal E2E på 10 projektbaner bestod med 201/203; statisk artefakt-flow-værn og lokal preview-smoke bestod | Faktisk GitHub Actions-kørsel og øvrige chunk-/Vite-advarsler mangler; B-002 er delvist dækket | `I gang` |
| `ARCH-003` | Lane-tag-vagten parser nu syntaksbevidst tags i E2E-specs | `e2eSuiteConventions.test.ts`: 20/20 bestået; `check:e2e-lanes`: 2 gyldige tags; `githubActionsRuntimeCheck.test.ts`: 8/8 med statisk CI-artefaktkobling, deployets push-til-main-gate og de fire dedikerede browserprojekter; `githubActionsReleaseStepLiveness.test.ts`: 2/2 med aktiv `verify:release:core`-step og negativt kommentarfacit; TD-006 lukket | Øvrige release-/CI-værn og fuld kobling til releaseforløbet mangler | `I gang` |
| `ARCH-001` | Bare test-only basenames er fjernet fra kontrakt-referenceopslag | `contractReferenceLiveness.test.ts`: 12/12 bestået efter triage; eksakte teststier accepteres fortsat; TD-007 lukket | Semantisk gennemgang af alle kontraktparagraffer og øvrige ARCH-001-værn mangler | `I gang` |

## Synkroniseret fundstatus

| Status | Fund |
| --- | --- |
| Lukket | `TD-003`, `TD-005`, `TD-006`, `TD-007`, `TD-008`, `TD-009`, `TD-010`, `TD-011`, `TD-012`, `TD-013`, `TD-015`, `TD-017`, `TD-021`, `TD-023`, `TD-024`, `TD-035`, `TD-036`, `TD-037`, `TD-038`, `TD-039`, `TD-040`, `TD-041`, `TD-043`, `TD-044`, `TD-045`, `TD-046`, `TD-047`, `TD-048`, `TD-049`, `TD-050`, `TD-051`, `TD-052`, `TD-053`, `TD-054`, `TD-055`, `TD-056`, `TD-057`, `TD-058`, `TD-059`, `TD-060`, `TD-061`, `TD-062`, `TD-063`, `TD-064`, `TD-065`, `TD-066`, `TD-067`, `TD-068`, `TD-069`, `TD-070`, `TD-071`, `TD-072`, `TD-073`, `TD-074`, `TD-075`, `TD-076`, `TD-077`, `TD-078`, `TD-079`, `TD-080`, `TD-081`, `TD-082`, `TD-083`, `TD-084`, `TD-085`, `TD-086`, `TD-087`, `TD-089`, `TD-090`, `TD-091`, `TD-092`, `TD-093`, `TD-094`, `TD-095`, `TD-096`, `TD-097`, `TD-098`, `TD-099`, `TD-100`, `TD-101`, `TD-102`, `TD-104`, `TD-105`, `TD-106`, `TD-107`, `TD-108`, `TD-109`, `TD-110`, `TD-111`, `TD-112`, `TD-113`, `TD-114`, `TD-115`, `TD-116`, `TD-117`, `TD-118`, `TD-119`, `TD-120`, `TD-121`, `TD-122`, `TD-123`, `TD-124`, `TD-125`, `TD-129`, `TD-130`, `TD-131` |
| Delvist lukket | `B-002`, `TD-002`, `TD-014`, `TD-018`, `TD-019`, `TD-020`, `TD-022`, `TD-025`, `TD-027`, `TD-028`, `TD-029`, `TD-031`, `TD-032`, `TD-033`, `TD-034`, `TD-042` |
| Åbent – kræver udviklerbeslutning eller ekstern evidens | `TD-001`, `TD-004`, `TD-016` |

## Seneste beslutningsretest – revision `4557a98e`

- `npm run verify:release:core` bestod med 729 testfiler og 8.813 beståede tests uden
  tilbageværende forventede `it.fails`; coverage var 90,22 / 81,37 / 93,97 / 93,05, og begge
  produktionsbuilds bestod.
- `npm run test:e2e` bestod med 201 tests og 2 forventede skips ud af 203 på 10 projektbaner.
  De kendte Vite-config- og chunk-størrelsesmeddelelser var ikke fejl.
- `TD-003`: `utcDayMath` afviser nu ugyldige `Date`-instanser ved den fælles dagstællergrænse.
  `npx vitest run src/__tests__/utils/utcDayMath.test.ts` bestod med 19/19.
- `TD-017`: File System Access API kræver nu callable picker-funktioner, og Hent-/Gem-fallbacken
  vælges ellers. `fileSystemAccess.test.ts` og `fileLoadSource.capabilityIntegration.test.ts`
  bestod med 34/34.
- `TD-043`: Rentemotorens synlige total summerer per-periode-afrundede beløb. Den uafhængige
  PDF/Word-kontrol og `td-043-renteberegning-dokumentafrunding.spec.ts` forventer nu `94,94 kr.`
  på tværs af skærm og dokument.
- De seneste test-only styrkelser er målrettet retestet: EET-definitionen kontrollerer nu
  efter-EAL-facittet i faktisk PDF og Word med 2/2, og PWA-manifestets `.eo`-filhandler til
  `/open` kontrolleres med 8/8 i Chrome.
- `TD-014`: `renteOversigtDocumentIndependent.test.ts` fører to håndskrevne rentelinjer gennem
  faktiske PDF- og Word-artefakter og kræver samme titel, dato, tabelindhold, principper og total
  `414,75 kr.` i begge kanaler. Den generelle rendering-, sideskifts- og outputparitetskontrol er
  fortsat åben.
- `TD-020`: `td020KrlDocumentIndependent.test.ts` fører to håndskrevne KRL-rækker gennem den
  faktiske Word-generator og kræver alle fire tabeller samt de konkrete 2026- og 2018-værdier;
  målrettet kontrol af KRL-sporet bestod med 27/27.
- `TD-022`: `pwa-already-installed.spec.ts` kræver nu den leverede `.eo`-filhandler til `/open`
  med de tre deklarerede MIME-typer; målrettet Chrome-kørsel bestod med 8/8. Den faktiske
  OS-/installerede-PWA-filaflevering kan fortsat kun kontrolleres manuelt.
- `B-002`: Den bindende releasekontrol er valgt som automatisk GitHub Actions-gate. CI-matrixen
  omfatter nu de fire dedikerede browserprojekter og er dækket af et statisk quality-værn, som
  også fastholder, at deploy kun kører ved push til main. En
  faktisk GitHub Actions-kørsel er fortsat engangsbeviset for rutinen og ikke en tilbagevendende
  manuel releasekontrol.
- `TD-001` afventer faktiske gamle `.eo`-filer. `TD-016` afventer stadig brugerobservation og
  domænevalg, fordi udviklerens svar korrigerede reproduktionstrinnene, men ikke afgjorde den
  observerede advarsel og dokumentblokering. `TD-014`/`TD-018` fortsætter med automatiseret
  dokumentkontrol før eventuelle afgrænsede manuelle restkontroller. `TD-022` er delvist dokumenteret
  på baggrund af den rapporterede dobbeltklikskontrol.

## Seneste komplette baseline-retest på revision `e8faa7ce`

- `DATE-001`: `dateCommit.ts` har 6 mutationer, 4 dræbte og 2 ækvivalente overlevere uden timeout eller tekniske fejl.
- `CALC-002`/`CALC-004`: command-runner-mutationer bestod uden timeout/fejl; årsløn dræbte 108/113,
  og varige mén dræbte 94/114. De resterende overlevere er triageret som ækvivalente eller redundante guards.
- `DOC-001`/`DOC-002`: de målrettede dokumenttests bestod med 29/29; EET-løbende-ydelsernes PDF-resolved table cells
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
- `td019ValidatorSchemaIndependence.test.ts` bestod isoleret med 4/4, `fileHandleVerification.test.ts`
  bestod med 22/22, og den uafhængige validatorprøve omfatter nu 14 cases. `npm run check:github-actions-runtime`, testtypecheck,
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
- `eetPageAudit.spec.ts` bestod isoleret med 8/8 på Chrome-basisbanen. Den samlede EET-specsuite
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
  ikke ændret. TD-020 er styrket med folkepensions-, KRL-, KL- og SBLON2-downstream-facitter, men
  validatorpartitioner og komplet downstream-paritet står åbne.

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

## Seneste samlede retest på revision `90c4870f`

- `npm run verify:release:core` bestod med 669 testfiler, 8.690 beståede tests og 17 forventede
  `it.fails`. Coverage var 90,13 % statements, 81,20 % branches, 93,97 % functions og 92,95 %
  lines – henholdsvis 18.554/20.584, 13.066/16.090, 3.024/3.218 og 16.946/18.230 målte enheder.
  Begge applikationsbuilds og deres assetkontroller bestod.
- `npm run test:e2e` bestod med 191/193 tests og 2 forventede skips på 3 workers. Skippene er den
  Chromium-specifikke native `LaunchQueue`-måling i Firefox og WebKit; ingen ukontrollerede browser-
  eller page-fejl blev rapporteret.
- Retesten kørte efter test-only-committene `0ea8270e` og `d83b8038`. De kendte Vite
  `configLoader: 'native'`- og store chunk-advarsler består og er fortsat registreret som restpunkter;
  ingen ny regressionsfejl blev fundet. Port 4173 var fri efter E2E-oprydningen.

## Seneste målrettede test efter revision `d83b8038`

- `td019ValidatorSchemaIndependence.test.ts` bestod med 4/4 tests efter en ny håndskrevet,
  typed svie-/smerte-case; den samlede uafhængige validatorprøve omfatter nu 14 cases.
- `npm run test:e2e -- e2e/eetPageAudit.spec.ts --project=chrome-desktop` bestod med 8/8.
  Den nye rejse vælger Word i hovedappen, åbner EET efter EAL, kontrollerer synlig specifikation,
  downloader den faktiske `.docx` og kontrollerer samme labels, dato, procent og beløb i
  `word/document.xml`.
- `npm run typecheck:test`, E2E-typecheck og målrettet ESLint bestod. Ændringerne er test-only;
  ingen produktkode, beregningslogik, UI/UX eller persistensformat er ændret. Port 4173 var fri
  efter den målrettede E2E-kørsel.

## Seneste samlede release-gate på revision `0baaec17`

- `npm run verify:release:core` bestod med 670 testfiler, 8.693 beståede tests og 17 forventede
  `it.fails`. Coverage var uændret: 90,13 % statements, 81,20 % branches, 93,97 % functions og
  92,95 % lines – 18.554/20.584, 13.066/16.090, 3.024/3.218 og 16.946/18.230 målte enheder.
  Begge applikationsbuilds og deres assetkontroller bestod.
- E2E blev ikke gentaget på denne revision, fordi ændringen kun er et statisk quality-værn uden
  produktartefakt- eller brugeradfærdsændring. Den seneste fulde E2E-suite på den uændrede
  produktrevision `90c4870f` bestod med 191/193 tests og 2 forventede skips.
- De kendte Vite `configLoader: 'native'`- og store chunk-advarsler består og er fortsat registreret
  som restpunkter. Port 4173 var fri efter de tidligere E2E-kørsler.

## Seneste fulde E2E-retest på testrevision `9c965ec5`

- `npm run test:e2e` bestod med 191 tests og 2 forventede skips ud af 193 på 3 workers.
  `eetPageAudit.spec.ts` inspicerede i denne kørsel den faktiske tekst i alle fire EET-PDF-downloads;
  den målrettede spec bestod med 8/8 uden runtimefejl.
- Ændringen var test-only. Produktkode og brugeradfærd er uændret siden produktrevision
  `90c4870f`. Port 4173 var fri efter kørslen.

## Seneste målrettede CALC-001-mutationstest – ASL-maksimum – efter revision `5bd202bd`

- `npx vitest run src/__tests__/domain/satser/aslAarsloensmaksimum.test.ts --reporter=dot`
  bestod med 9/9 tests. De nye assertions bruger et faktisk computed ikke-heltal-key, `Infinity`
  og et tomt indeks-map, så mutationstesten ikke bliver grøn af et tilfældigt manglende opslag.
- `node node_modules/@stryker-mutator/core/bin/stryker.js run coverage/.tmp-calc001-stryker.config.json`
  muterede `aslAarsloensmaksimum.ts` med 28 mutationer: 26 dræbt, 2 ækvivalente overlevere og 0
  timeout/tekniske fejl. De to overlevere er triageret: `typeof value === 'number'` er redundant,
  fordi `Number.isFinite` allerede afviser ikke-tal, og singleton-branchens `join(', ')` giver samme
  tekst som den særskilte interpolation.
- Resultatet er test-only og blev verificeret igen gennem `verify:release:core` på samme revision med
  670 testfiler, 8.695 beståede tests, 17 forventede `it.fails`, coverage 90,13 / 81,21 / 93,97 /
  92,96 og begge builds. Mutationens JSON-rapport var en ignoreret lokal artefakt og er ikke arkiveret.

## Seneste TD-025-stresstest efter revision `ab289aae`

- `npx vitest run src/__tests__/components/pages/erstatningsopgoerelse/Loenindkomst.nestedLoentabel.integration.test.tsx --reporter=dot`
  blev gentaget 10 gange i samme arbejdsproces. Alle 10 kørsler bestod med 9/9, altså 90/90 tests,
  uden assertionfejl eller ukontrollerede runtimefejl. Første kolde opstart tog 92,71 sekunder; de
  efterfølgende ni tog 22,02–23,25 sekunder.
- Prøven viser stabilitet i testfilens isolerede execution, men reproducerer ikke den oprindelige
  parallelle coverage-flage med to timeouts og en efterfølgende `act`-fejl. `TD-025` forbliver derfor
  delvist lukket; der er ikke ændret produktkode eller testadfærd.

## Seneste målrettede CALC-001-mutationstest efter revision `aff8dd80`

- `npx vitest run src/__tests__/domain/satser/opreguleringsmotorer.test.ts --reporter=dot` bestod med
  30/30 tests. De nye assertions bruger et faktisk computed decimal-key-modcase og et interval,
  hvor målårets sats mangler i sidste år.
- `node node_modules/@stryker-mutator/core/bin/stryker.js run coverage/.tmp-calc001-opreguleringsmotorer.config.json`
  muterede `opreguleringsmotorer.ts` med 113 mutationer: 104 dræbt, 6 overlevere, 3 timeouts og 0
  tekniske fejl; mutationsscore 94,69 %. De seks overlevere er triageret som den redundante
  `typeof`-/finiteness-guard, to redundante endpointguards efter intervaldækningen og tre
  observerbart ækvivalente same-year no-op-varianter. Timeout-mutanterne ændrede loopets
  årsfremdrift og terminerede ikke inden for timeoutgrænsen.
- Kørsel og den efterfølgende `verify:release:core` er test-only på revision `aff8dd80`. Den
  samlede gate bestod med 670 testfiler, 8.697 beståede tests, 17 forventede `it.fails`, coverage
  90,13 / 81,21 / 93,97 / 92,95 og begge builds. Mutationens JSON-rapport var en ignoreret lokal
  artefakt og er ikke arkiveret.

## Seneste TD-019-validatorretest efter revision `017f9230`

- Den målrettede Vitest-kørsel af `erstatningsopgoerelseValidator.test.ts`,
  `erstatningsopgoerelseValidator.independent.test.ts`,
  `td019ValidatorSchemaIndependence.test.ts` og `nestedRowSchemas.test.ts` bestod
  med 4/4 filer og 152/152 tests.
- `td019ValidatorSchemaIndependence.test.ts` har nu 6/6 håndskrevne typed runtime-cases.
  Den nye case dækker aktiv TAF med angivet månedsløn og manglende statistikmodel og
  kræver den konkrete fejlsti `eoAngivetLoenLoenudvikling.loenudviklingStatistikModel`,
  den konkrete danske fejltekst og `error`-severity. Sammen med de 10 literalbaserede
  cases er den uafhængige validatorprøve nu 15/15.
- Ændringen er test-only. Den efterfølgende `verify:release:core` bestod på `017f9230`
  med 670 testfiler, 8.698 beståede tests, 17 forventede `it.fails`, uændrede
  coverageprocenter og begge builds. E2E blev ikke gentaget, fordi produktkode og
  brugeradfærd er uændret.

## Seneste TD-019-required-field-retest efter revision `deec535e`

- `npx vitest run src/__tests__/validators src/__tests__/domain/data/td020ProcesrenteDownstreamIndependent.test.ts src/__tests__/domain/data/td020KrlDownstreamIndependent.test.ts --reporter=dot`
  bestod med 6 filer / 107 tests. Den nye `td019ValidatorRequiredField.test.ts`
  bestod separat med 1/1 og fastholder det konkrete Zod-facit for manglende
  `loenindkomstAnsaettelsesforhold`.
- `npm run typecheck:test` og målrettet ESLint bestod. Ændringen er test-only;
  produktkode, beregningslogik, brugeradfærd og persistensformat er uændret.

## Seneste TD-020-SBLON2-retest efter revision `cb7f977a`

- `npx vitest run src/__tests__/domain/erstatningsopgoerelse/loenudviklingBeregning.test.ts --reporter=dot`
  bestod med 1 fil og 48/48 tests. Det nye statiske facit gennemfører SBLON2's
  2016K1-indeks 98,9, 2017K1-indeks 100,8 og 2018K1-indeks 102,8 og kræver
  henholdsvis 0 %, 1,92 % og 3,94 % i downstream-regulering.
- Ændringen er test-only og bruger ikke `buildStatistikForloeb` som facit. Den
  efterfølgende `verify:release:core` bestod på `cb7f977a` med 670 testfiler,
  8.699 beståede tests, 17 forventede `it.fails`, coverage 90,13 / 81,20 /
  93,97 / 92,95 og begge builds. E2E blev ikke gentaget, fordi produktkode og
  brugeradfærd er uændret.

## Seneste TD-020-procesrente-retest efter revision `5c395772`

- `npx vitest run src/__tests__/domain/data/td020ProcesrenteDownstreamIndependent.test.ts --reporter=dot`
  bestod med 1/1. Testen fører de faktiske 2024-reference- og tillægssatser
  gennem `computeRenteberegning` og kontrollerer halvårsskift, 366-dagesår,
  per-periode rente og samlet `94,95 kr.` med statiske forventninger.
- `npm run typecheck:test` og målrettet ESLint bestod. Facittet er test-only og
  genbruger ikke procesrente-helperen som forventningsgrundlag; produktkode,
  beregningslogik, brugeradfærd og persistensformat er uændret. Den seneste
  fulde `verify:release:core` står fortsat på `cb7f977a`.

## Seneste EET Differencekrav-retest efter revision `1e02e24b`

- `npm run test:e2e -- e2e/eetPageAudit.spec.ts --project=chrome-desktop --grep "kan hente Differencekrav som PDF og Word med synlig beregning"`
  bestod med 1/1. Testen åbner Differencekrav med `setupValidSag`, aflæser det
  synlige `Beregnet differencekrav`, downloader først PDF og derefter Word og
  kræver samme beløb samt `Differencekrav (EET)`, `EAL-krav` og
  `Beregnet differencekrav` i begge artefakter.
- `runtimeErrors` var tom. `npm run typecheck:e2e` og målrettet E2E bestod.
  Testen er test-only; den seneste fulde valgte E2E-suite står fortsat på
  `9c965ec5` med 191/193, og fysisk generel PDF-/Word-rendering samt fuld
  semantisk paritet er fortsat åben under `TD-014`/`TD-018`.

## Seneste CALC-002/CALC-003/TD-019-retest efter revision `4f4caf24`

- De fire uafhængige/branchestyrkende årsløn-testfiler bestod med 37/37 tests; den samlede
  `src/__tests__/domain/aarsloen`-mappe bestod med 15 filer / 242 tests. Facitterne dækker nu
  procentbaserede tillæg og ugeløn gennem `computeAarsloenBeregning` sammen med den tidligere
  Metode A/B/C-, nul- og feriegrænsedækning.
- Den samlede `src/__tests__/domain/renteberegning`-mappe bestod med 12 filer / 147 tests.
  De nye engine-facitspor dækker månedlig kalender-clamp og ugentlig tillægstid med seks rentedage,
  afrundet rente og `pdfContext`; eksisterende kontinuitets-, sats- og mutationsbevis er uændret.
- `td019KrlValidatorIndependent.test.ts` bestod med 1/1 og kræver en præcis fejlsti og besked for
  manglende KRL-satstabel i en håndskrevet typed aktiv-TAF-fixture. Den fælles retest af de nye og
  nærmeste eksisterende facitter bestod med 7 filer / 11 tests; `npm run typecheck:test`, målrettet
  ESLint og `git diff --check` bestod. Ændringerne er test-only; produktkode, beregningslogik,
  brugeradfærd og persistensformat er uændret. Den samlede `verify:release:core` står fortsat på
  `cb7f977a`, og E2E står fortsat på `9c965ec5`.

## Seneste CALC-002/TD-019-retest efter revision `6aa78b27`

- `aarsloenDailyFallbackIndependentOracle.test.ts` tilføjer et uafhængigt dag-fallback-facit gennem
  `computeAarsloenBeregning`: 1.–30. august 2024 giver 22 hverdage og `130.500 kr.` ved
  `11.000 / 22 × 261`. Hele årslønsmappen bestod med 16 filer / 243 tests.
- `td019PublicSalaryValidatorIndependent.test.ts` tilføjer en håndskrevet typed KL-overenskomst-case,
  der kræver præcis path, besked og `error`-severity for manglende `offentligLoenType`; testen bestod
  med 1/1. De fire direkte KRL-/offentlig-løn-validatorfacitter bestod samlet med 8/8.
- `npm run typecheck:test`, målrettet ESLint og `git diff --check` bestod gennem commit-gaten.
  Ændringerne er test-only; produktkode, beregningslogik, brugeradfærd og persistensformat er uændret.
  Den samlede `verify:release:core` står fortsat på `cb7f977a`, og E2E står fortsat på `9c965ec5`.

## Seneste DATA-001/CALC-001/CALC-002/TD-020-retest efter revision `b98fb10c`

- `td020StatistikDownstreamIndependent.test.ts` fører statiske ILON12-værdier gennem den offentlige
  `statistikForm`: 2025K1 = 161,5, 2025K4 = 165,2 og en beregnet regulering på 2,29 %. Testen
  bestod med 1/1.
- De tre årslønsfacitter bruger nu eksplicitte typed værdier i stedet for
  `createAarsloenInitialValues()`. Sammen med den danske oprydning af rentemotorens testnavne bestod
  den målrettede kontrol med 5 filer / 28 tests.
- Typechecks, fuld ESLint, encoding-/filnavnscasing- og kontraktværn bestod gennem commit-gaten.
  Ændringerne er test-only; produktkode, beregningslogik, brugeradfærd og persistensformat er uændret.
  Den samlede `verify:release:core` står fortsat på `cb7f977a`, og E2E står fortsat på `9c965ec5`.

## Seneste TD-019-retest efter revision `c66e09c7`

- `td019PublicSalaryValidatorIndependent.test.ts` dækker nu manglende `offentligLoenType`,
  `offentligLoenTrin` og `offentligLoenGruppe` med præcis feltsti, dansk besked og `error`-severity.
  `td019ValidatorSchemaIndependence.test.ts` dækker desuden manglende
  `loenudviklingBeregningsgrundlag` i Beregningsperiode-grenen. De to filer bestod samlet med 9/9.
- Den målrettede VALID-001/TD-019-kontrol består nu af 5 filer / 21 tests. Typechecks, fuld ESLint,
  encoding-/filnavnscasing- og kontraktværn bestod gennem commit-gaten. Ændringerne er test-only;
  produktkode, beregningslogik, brugeradfærd og persistensformat er uændret.
  Den samlede `verify:release:core` står fortsat på `cb7f977a`, og E2E står fortsat på `9c965ec5`.

## Seneste DOC-001/TD-019/TD-020-retest efter revisioner `902034ca`, `69d0b53d`, `61b138c8`, `010b44d9`, `890fa37e`, `682b0ba3`, `c41f8391`, `14ce800f`, `1b372144`, `b61ff7b1`, `2c5dc621`, `8028b5ee`, `9517459f`, `9a2bdf45` og `ed3e7ecd`

- `standaloneRenteAlleDocumentDefinition.test.ts` kalder den reelle standalone-renderer med to
  eksplicitte rækker og fastholder to titler/tabeller, én pageBreak mellem sektionerne, én footer
  som sidste blok, begge hovedstole/periodetekster og filnavnet `Procesrente, 1.000,00 kr.
  (01-01-2024 - 31-01-2024) +1.pdf`. Testen bestod med 1/1.
- `aarsloenDocumentIndependent.test.ts` kalder den reelle årsløns-dokumentgenerator med
  eksplicitte månedslønsrækker og fastholder 34.650,00 kr. i tabeltotal, 207.900,00 kr. i
  omregnet årsløn, sektioner, tabelstruktur og filnavn. Testen bestod med 1/1.
- Den målrettede direkte kontrol af de ti validatorfacitfiler bestod med 10 filer / 34 tests.
  `td019OverenskomstValidatorIndependent.test.ts` fastholder manglende `overenskomstId` med
  path `eoAngivetLoenLoenudvikling.overenskomstId`, beskeden `Overenskomst skal vælges` og
  severity `error`.
- `td019ManuelLoenValidatorIndependent.test.ts` fastholder den manuelle reguleringsbranches
  manglende række med path `eoAngivetLoenLoenudvikling.loenudviklingManuelTableData`, beskeden
  `Mindst én manuel reguleringsrække skal udfyldes` og severity `error`.
- Samme testfil fastholder desuden manglende grundløn, grundløn på nul og manglende dato i en
  manuel reguleringsrække med samme præcise path, de konkrete validatorbeskeder og severity
  `error`.
- `td019OverenskomstValidatorIndependent.test.ts` fastholder desuden modstridende overenskomstvalg
  med path `loenindkomstAnsaettelsesforhold[0].harOverenskomst`, beskeden `Overenskomst skal slås
  til, når lønudviklingen beregnes ud fra overenskomst` og severity `error`.
- `td019ValidatorSchemaIndependence.test.ts` fastholder manglende manuel dagssats for
  sygeferiegodtgørelse ved aktiv TAF med path `sfggAnsaettelsesforhold[0].sfggManuelDagssats`,
  beskeden `Dagssats for sygeferiegodtgørelse mangler` og severity `error`.
- Samme testfil fastholder desuden manglende SFGG-beregningskilde med path
  `sfggAnsaettelsesforhold[0].sfggBeregningskilde`, beskeden `Beregningsgrundlag for SFGG ikke
  valgt` og severity `error`.
- Samme testfil fastholder desuden manglende referenceperiodes slutdato for Ferieloven med path
  `sfggAnsaettelsesforhold[0].sfggReferenceperiodeTil`, beskeden `Referenceperiode til-dato
  mangler` og severity `error`.
- Samme testfil fastholder desuden en valgt SFGG-kilde `Overenskomst` uden aktiv overenskomst
  med path `sfggAnsaettelsesforhold[0].sfggBeregningskilde`, den konkrete besked om at der skal
  være valgt en overenskomst på ansættelsesforholdet og severity `error`.
- `td019ManuelProcentsatsValidatorIndependent.test.ts` fastholder den manuelle procentsatsbranches
  manglende dato med path `eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData`,
  beskeden `Dato skal udfyldes på alle manuelle procentsatsrækker` og severity `error`.
- `td019ManuelProcentsatsProcentValidatorIndependent.test.ts` fastholder samme branchens
  manglende procent med path `eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData`,
  beskeden `Procent skal udfyldes på alle manuelle procentsatsrækker` og severity `error`.
- `td019IndtaegtsoplysningerValidatorIndependent.test.ts` fastholder en aktiv TAF-branches
  manglende lønoplysninger med path `loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData`,
  beskeden `Lønoplysninger skal udfyldes, når lønudviklingen reguleres` og severity `error`.
- `loenudviklingBeregning.test.ts` fastholder desuden 2025-sygedagpengernes statiske satsinput,
  genererede række og første uges indkomst på `5.058 kr.`; den målrettede kombinerede kontrol af
  lønudviklings- og sygedagpengefilen bestod med 72/72 tests. Samme fil fastholder nu også
  2019/2020-satsgrænsen med to perioder og samlet indkomst på `8.009 kr.`; testen dokumenterer
  transformationen og ikke juridisk kildekorrekthed. RLTN-facittet fastholder desuden
  2024-04-01–2024-10-01 med 0 % og 1,39 % segmentregulering samt uændret grundløn;
  RLTN-kildens eksterne proveniens er ikke afgjort.
- Den målrettede direkte kontrol af de ti validatorfacitfiler bestod med 10 filer / 34 tests.
- Den samlede dokumentmappe bestod med 28 filer / 275 tests. Typechecks, fuld ESLint,
  encoding-/filnavnscasing- og kontraktværn bestod gennem commit-gaterne. Ændringerne er
  test-only; produktkode, beregningslogik, brugeradfærd og persistensformat er uændret.
  Den samlede `verify:release:core` står på `2a88410a`, og E2E står fortsat på `9c965ec5`.

## Seneste CALC-002-retest efter revision `1cd38209`

- `aarsloenMonthlyIndependentOracle.test.ts` fører tre eksplicitte månedsløn-rækker på 10.000 kr.
  gennem `computeAarsloenBeregning`: 30.000 kr. i periode, 65 hverdage og håndfacit
  `30.000 / 3 × 12 = 120.000 kr.`. Testen bestod med 1/1.
- Den samlede seks-filers CALC-002-facit-/brancheretest bestod med 39/39, og hele
  `src/__tests__/domain/aarsloen`-mappen bestod med 17 filer / 244 tests. Testen er test-only;
  produktkode, beregningslogik, brugeradfærd og persistensformat er uændret.
  Den samlede `verify:release:core` står fortsat på `cb7f977a`, og E2E står fortsat på `9c965ec5`.

## Seneste test-only facitbatch efter revision `4790b649`

- `utcDayMathIndependentOracle.test.ts` tilføjer to uafhængige århundredesfacitter: 1900 er ikke
  skudår, mens 2000 er skudår. Den målrettede test bestod med 2/2 på `5bc0d087`.
- `td019SvieSmerteValidatorIndependent.test.ts` tilføjer et typed, produktionsdefault-uafhængigt
  facit for manglende `svieSmerteSatserAar` i en aktiv svie/smerte-periode. Den målrettede test
  bestod med 1/1 på `5bc0d087`.
- `td016SygedagpengeFoerShCutoffIndependent.test.ts` tilføjer et håndberegnet sygedagpengefacit
  før SH-cutoff med påskemandag, fem konkrete dagværdier, samlet 900 kr. og tom integrity issue.
  Den målrettede test bestod med 1/1; den supplerende EO-inspektionssuite bestod med 17 filer / 186
  tests på `c34b8885`.
- `indexedDbStore.atomicity.test.ts` beviser med en staging-stub, der også har en reel positiv
  commitsti, at ingen af to writes bliver synlige efter transaction-abort. Den målrettede test
  bestod med 1/1. Teststubben blev efter review styrket på `4790b649`, så assertionen ikke længere
  kunne være grøn uden en observerbar forskel mellem commit og abort.
- Den kombinerede kontrol af de fire nye tests bestod med 4 filer / 5 tests. `npm run typecheck:test`
  og `npm run lint` bestod; den kendte Vite `configLoader: 'native'`-advarsel blev fortsat observeret.
  Ændringerne er test-only; ingen produktkode, beregningslogik, brugeradfærd, schema eller
  persistensformat er ændret.
- `TD-003` står fortsat åben for ugyldige `Date`-instanser, `TD-016` for den observerede
  weekendydelse-/TAF-mismatch, `TD-017` for ikke-callable File API-detektion og fuld
  browser-/IndexedDB-sammenhæng, og `TD-019` er fortsat delvist lukket for de øvrige
  validatorfixtures.

## Seneste facit- og browserbatch efter revision `564d38db`

- `td020RltnLoenCoreIndependent.test.ts` tilføjer et statisk RLTN-komponentfacit gennem den
  offentlige lønforbruger med 1/1 bestået. `td020LaererOverenskomstLoenConsumerIndependent.test.ts`
  tilføjer tilsvarende et 2024-facit for fritvalg og pension med 1/1 bestået.
- `eetKapitaliseringSnapshotIndependent.test.ts` og `eetKapitaliseringDocumentIndependent.test.ts`
  tilføjer to særskilte kapitaliseringsfacitter med samlet 2/2: et historisk køns-/alder-/månedsspor
  med faktor 8,764 og et før/efter-2024-spor med 65,7 % opregulering og faktor 5,479, hvor beløbet
  følges til Word-artefaktet.
- Tre nye browserrejser bestod målrettet: Stamdata synlig Gem → Hent med alle felter i Firefox 1/1,
  Renteberegning med synligt 805 kr. og faktisk PDF 1/1 samt Indstillinger med settings- og
  sagsinput-bevaring efter reload 1/1. UI-001 bruger et dedikeret Firefox-projekt, fordi filvælgerens
  observerbare adfærd er browserafhængig. `typecheck:e2e`, lint og `check:e2e-lanes` bestod.
- `releaseGateBuildLiveness.test.ts` bestod med 2/2 og værner om, at release-scriptgrafen når
  `build:all`, `build:mineo` og `build:minprocesrente`, inklusive en negativ grafcase. Det er et
  statisk lokalt værn; B-002's faktiske GitHub Actions-kørsel er fortsat ikke udført.
- `ui-002-erstatningsopgoerelse-browserrejse.spec.ts` gennemførte en offentlig ydelsesrække fra
  synligt række-/resultatspor til faktisk EO-PDF med 1/1. `file-load-validation.spec.ts` bestod
  med 3/3 i WebKit efter den nye synlige “Stop og gør intet”-case, der bevarer aktiv sag og URL.
- `ui-006-aarsloen-browserrejse.spec.ts` bestod med 1/1 for månedsløn, sammentælling og Årsløn-PDF.
  `ui-008-satser-browserrejse.spec.ts` bestod med 1/1 for 2024-satser og PDF-tekst, og den
  relaterede svie/smerte-test bestod med 1/1 efter ren retest.
- Den oprindelige 564d38db-batchs målrettede Vitest-kontrol bestod med 5 filer / 6 tests og
  E2E-kontrollen med 3/3. Hele ændringsblokken er test-/E2E-konfiguration alene. Ingen produktkode, beregningslogik, brugeradfærd,
  schema eller persistensformat er ændret.

## Seneste quality-/validator-/data-/dokumentbatch efter revision `af11e602`

- `td019SvieSmerteValidatorIndependent.test.ts` fik et nyt typed facit for manglende `tilstand`
  med præcis path, besked og severity; filen bestod med 2/2.
- `td020LaererOverenskomstTafIndependent.test.ts` tilføjer et statisk facit gennem tre
  Læreroverenskomst-TAF-segmenter, inklusive 2025-tillægsændringen, 1/1 bestået.
- `documentDefinitionFixtureRegistry.test.ts` kræver nu litteralt Satser-indhold i både PDF og
  Word, herunder titel, 227.000 kr., 257.000 kr. og 0 %; registry-kontrollen bestod med 66/66.
- `contractReferences.ts` tæller ikke længere symboler i almindelige stringliterals som levende
  kontraktreferencer. Det nye modcase og den relevante quality-/architecture-/schema-kontrol bestod
  med 4 filer / 230 tests.
- Hele batchen var test-only og ændrede hverken produktkode, beregningslogik, brugeradfærd, schema
  eller persistensformat. Proveniens, komplet downstream-paritet og øvrig semantisk kontraktgennemgang
  er fortsat åbne.

## Seneste dokument-/validator-/browserbatch efter revision `c7d64cc5`

- `varigeMenDocumentIndependent.test.ts` og `forsoergertabDocumentIndependent.test.ts` tilføjer
  hver et håndskrevet engine → Word-facit. De målrettede dokumenttests bestod med 2/2 og følger
  henholdsvis 303.896 kr. samt et nettokrav på 2.158.185 kr. til det faktiske Word-XML.
- `td019SvieSmerteOverlapValidatorIndependent.test.ts` tilføjer en fuldt håndskrevet typed fixture
  med to overlappende perioder og kræver begge fejl med præcis path, besked og severity; den
  målrettede test bestod med 1/1.
- `ui-005-forsoergertab-word-browserrejse.spec.ts` gennemfører den synlige Forsørgertab-rejse,
  kontrollerer 82.741 kr., vælger Word og inspicerer det faktiske `word/document.xml`; målrettet
  Chrome-kørsel bestod med 1/1 uden runtimefejl eller ukontrollerede eksterne requests.
- Den samlede målrettede kontrol bestod med 3 filer / 3 Vitest-tests og den nye E2E-test med 1/1;
  typechecks, lint, mojibake- og filnavnschecks bestod i commit-hooken. Hele batchen er test-only:
  ingen produktkode, beregningslogik, brugeradfærd, schema eller persistensformat er ændret.
- TD-019 er fortsat delvist lukket for øvrige fixturehuller, og TD-014, TD-016, TD-017, TD-022,
  TD-025, B-002 samt øvrig downstream-, output- og releaseparitet står fortsat åbne.

## Seneste afrundingsbatch efter revision `1d813c5f`

- `renteberegningEngineDocumentIndependent.test.ts` tilføjer et uafhængigt flerperiodesfacit over
  halvårsskiftet. Motorens rå sum er `94,95 kr.`, mens PDF- og Word-generatoren viser `94,94 kr.`
  efter afrunding af de enkelte perioder; begge dokumentkanaler er kontrolleret med 1/1.
- `td-043-renteberegning-dokumentafrunding.spec.ts` beviser den samme forskel i den synlige Mineo-
  brugerrejse: UI'et viser `94,95 kr.`, mens den hentede PDF viser `94,94 kr.`. Målrettet Chrome-
  kontrol bestod med 1/1 uden runtimefejl eller ukontrollerede eksterne requests.
- `ui-004-varige-men-word-browserrejse.spec.ts` tilføjer en samlet Varige mén → Word-rejse med
  synligt beløb, faktisk `.docx`-download og centrale Word-værdier; målrettet Chrome-kørsel bestod
  med 1/1 uden runtimefejl eller ukontrollerede eksterne requests.
- Den samlede batch er test-only. Ingen produktkode, beregningslogik, brugeradfærd, schema eller
  persistensformat er ændret. TD-043 kræver udviklerens beslutning om den autoritative afrunding,
  før en eventuel produktrettelse kan overvejes.

## Seneste CALC-006/DATA-001-facitbatch efter revision `db829436`

- `eoInspektionOffentligYdelseTillaegIndependent.test.ts` tilføjer et håndskrevet facit for
  800 kr. offentlig ydelse plus 200 kr. tillæg: 200 kr. på hver af fem hverdage, samlet 1.000 kr.
  og ingen integritetsissue. Målrettet kontrol bestod med 1/1.
- `td020EoInspektionOffentligKlIndependent.test.ts` tilføjer et statisk KL-lønfacit gennem
  EO-inspektionens reguleringstidslinje med grundløn, feriepenge, Store Bededag, pakkeværdi og indeks.
  Målrettet kontrol bestod med 1/1.
- Den samlede målrettede kontrol bestod med 2 filer / 2 tests. `npm run typecheck:test`, lint og
  diff-kontrol bestod. Ændringerne er test-only; produktkode, data, beregningslogik, brugeradfærd,
  schema og persistensformat er uændret.

## Seneste validator-/EO-rækkebatch efter revision `8302dfd6`

- `td019TafValidatorIndependent.test.ts` tilføjer et håndskrevet typed validatorfacit for
  manglende TAF-fra-dato og kræver præcis feltsti, dansk fejltekst og `error`-severity; 1/1 bestået.
- `eoRowMidlertidigtEetKonsistensIndependent.test.ts` tilføjer et typed EO-rækkefacit for advarslen,
  når TAF fortsætter efter midlertidig EET-virkning uden ydelse; 1/1 bestået.
- Samlet målrettet kontrol bestod med 2 filer / 2 tests. Typechecks, lint og diff-kontrol bestod.
  Ændringerne er test-only; produktkode, beregningslogik, brugeradfærd, schema og persistensformat
  er uændret.

## Seneste samlede release-gate efter revision `8899263d`

- `npm run verify:release:core` bestod samlet. Dependency-, runtime-, type-, lint-, data-, kontrakt-,
  lane-, ledger-, coverage- og begge produktionsbuild-gates bestod.
- Vitest gennemførte 711 testfiler med 8.774 beståede tests og 17 forventede `it.fails`.
  Coverage var 90,15 % statements, 81,28 % branches, 93,97 % functions og 92,96 % lines.
- Mineo- og MinProcesrente-builds blev genereret og artefakterne verificeret. Produktkode,
  beregningslogik, brugeradfærd, schema og persistensformat er uændret; revisionen indeholder
  test- og auditdokumentation.
- B-002's faktiske GitHub Actions-kørsel, historisk `.eo`-proveniens, fysisk dokumentinspektion
  og de øvrige åbne beslutningspunkter er fortsat ikke afsluttet.

## Seneste samlede release-gate efter revision `cb4282d9`

- `npm run verify:release:core` bestod samlet. Dependency-, runtime-, type-, lint-, data-, kontrakt-,
  lane-, ledger-, coverage- og begge produktionsbuild-gates bestod.
- Vitest gennemførte 715 testfiler med 8.778 beståede tests og 17 forventede `it.fails`.
  Coverage var 90,21 % statements, 81,34 % branches, 93,97 % functions og 93,03 % lines.
- Mineo- og MinProcesrente-builds blev genereret og artefakterne verificeret. De seneste ændringer
  er test- og auditdokumentation; produktkode, beregningslogik, brugeradfærd, schema og
  persistensformat er uændret.
- B-002's faktiske GitHub Actions-kørsel, historisk `.eo`-proveniens, fysisk dokumentinspektion
  og de øvrige åbne beslutningspunkter er fortsat ikke afsluttet.

## Seneste DATE-001/DATA-001-facitbatch efter revision `cb4282d9`

- `utcDayMath2100IndependentOracle.test.ts` tilføjer et uafhængigt håndfacit for årsskiftet
  2099/2100, inklusive eksklusiv og inklusiv dagtælling; målrettet test bestod med 1/1.
- `td020OvergangsbeloebSatserDocumentIndependent.test.ts` tilføjer et statisk facit for
  overgangsbeløbet i 2025 på 198.500 kr. og kontrollerer det i faktisk Word-XML; 1/1 bestået.
- Begge ændringer er test-only. De berører ikke TD-003's åbne ugyldige-dato-beslutning og ændrer
  ikke produktkode, data, beregningslogik, brugeradfærd, schema eller persistensformat.

## Seneste samlede release-gate efter revision `497da326`

- `npm run verify:release:core` bestod samlet. Dependency-, runtime-, type-, lint-, data-, kontrakt-,
  lane-, ledger-, coverage- og begge produktionsbuild-gates bestod.
- Vitest gennemførte 717 testfiler med 8.780 beståede tests og 17 forventede `it.fails`.
  Coverage var 90,21 % statements, 81,34 % branches, 93,97 % functions og 93,03 % lines.
- Mineo- og MinProcesrente-builds blev genereret og artefakterne verificeret. De seneste ændringer
  er test- og auditdokumentation; produktkode, beregningslogik, brugeradfærd, schema og
  persistensformat er uændret.
- B-002's faktiske GitHub Actions-kørsel, historisk `.eo`-proveniens, fysisk dokumentinspektion
  og de øvrige åbne beslutningspunkter er fortsat ikke afsluttet.

## Seneste test-only validator-/EO-rækkebatch efter revision `d8a334d7`

- `td019BeregningsperiodeFerieValidatorIndependent.test.ts` tilføjer et fuldt håndskrevet typed
  validatorfacit for seks uspecificerede feriedage mod fem mulige arbejdsdage. Den kræver præcis
  feltsti, dansk fejltekst og `error`-severity; den nye test bestod med 1/1.
- `eoRowMidlertidigtEetKonsistensIndependent.test.ts` dækker nu begge retninger i den midlertidige
  EET-konsistenskontrol. Den nye case med 800 kr. ydelse og 200 kr. tillæg uden afgørelse kræver den
  konkrete ydelsesrække og advarselsrække; filen bestod med 2/2.
- Samlet direkte kontrol af de to nye facitspor bestod med 3/3. `npm run verify:release:core` bestod
  med 718 testfiler / 8.782 tests / 17 forventede `it.fails`, coverage 90,23 / 81,37 / 93,97 / 93,04
  og begge builds. Ændringerne er test-only; produktkode, beregningslogik, brugeradfærd, schema og
  persistensformat er uændret. TD-019 og CALC-006 er fortsat delvist åbne for øvrige huller, og
  TD-016 kræver stadig udviklerens beslutning.

## Seneste testfacitter efter revision `b5c1cd96`

- `td019TafLoseFeriedageValidatorIndependent.test.ts` bruger en fuldt håndskrevet typed
  TAF-fixture med seks løse feriedage mod fem mulige arbejdsdage og kræver præcis feltsti,
  dansk besked og `error`-severity. Testen bestod med 1/1.
- `td020StatistikDocumentIndependent.test.ts` fører det håndskrevne ILON12-facit for 2025K1
  og 2025K4 gennem den faktiske Word-generator og kræver begge kvartaler, startdatoer og
  indeksværdier i `document.xml`. Testen bestod med 1/1. Facittet er et transformationsfacit
  gennem den interne datakilde, ikke ekstern kildeproveniens.
- `TD-054`: `td019ForligAnsvarsgradBroekValidatorIndependent.test.ts` bruger en fuldt håndskrevet typed
  fixture med `forligAnsvarsgradBroek: '5/3'` og kræver præcis feltsti, dansk besked og
  `error`-severity. Testen bestod med 1/1.
- `TD-055`: `eoRowTafDifferencekravIndependent.test.ts` bruger en fuldt håndskrevet typed fixture med
  TAF-ophør 05-01-2024 og differencekrav 06-01-2024 og kræver den konkrete ophørsrække
  `Differencekrav opgjort (06-01-2024)`. Testen bestod med 1/1.
- `TD-056`: `td019ForligAnsvarsgradBroekZeroDenominatorIndependent.test.ts` bruger en fuldt
  håndskrevet typed fixture med `forligAnsvarsgradBroek: '1/0'` og kræver præcis feltsti,
  besked og `error`-severity. Testen bestod med 1/1.
- `TD-057`: `eoRowTafFerieperiodeIndependent.test.ts` bruger en fuldt håndskrevet typed fixture
  med ferieperioden 02.–03.01.2024 og kræver den konkrete `Ferieperiode`-række i TAF-oversigten.
  Testen bestod med 1/1.
- `TD-058`: `td019OevrigeKravValidatorIndependent.test.ts` bruger en fuldt håndskrevet typed
  fixture med et øvrigt krav på `-1` kr. og kræver præcis feltsti, besked og `error`-severity.
  Testen bestod med 1/1.
- `TD-059`: `eoRowTafFolkepensionsalderIndependent.test.ts` bruger en fuldt håndskrevet typed
  fixture med TAF efter folkepensionsdatoen og kræver den konkrete advarselsrække. Testen bestod
  med 1/1.
- `TD-060`: `td020FriProcesSatserDocumentIndependent.test.ts` fører statiske 2025-grænser for
  fri proces gennem den faktiske Satser-Word-generator. Testen bestod med 1/1.
- `npm run verify:release:core` bestod med 727 testfiler, 8.792 beståede tests og 17 forventede
  `it.fails`; coverage var 90,22 / 81,36 / 93,97 / 93,04, og begge builds bestod. De kendte
  Vite-config- og chunk-størrelsesmeddelelser var ikke fejl.

## Seneste dokumentfacit efter revision `a04e1d7e`

- `documentDefinitionFixtureRegistry.test.ts` sammenholder nu TAF-kravgrafens kendte 1×1-PNG
  mellem det faktiske Word-medie og PDF'ens FlateDecode-billedstream. Den konkrete test bestod
  med 1/1, og hele fixture-registret bestod med 67/67.
- Den samlede dokumentmappe er målrettet retestet med 29 filer / 281 tests; typecheck, ESLint og
  `git diff --check` bestod. Facittet lukker kun den konkrete TAF-grafpartition. TD-014/TD-018
  står fortsat åbne for fysisk rendering, sideskift og generel PDF/Word-paritet.

## Seneste målrettede batch – revision `152ca00c`

- `td019SfggReferenceperiodeOrderValidatorIndependent.test.ts` bestod med 1/1 og fastholder et
  uafhængigt SFGG-facit for en referenceperiode, der kun indeholder weekenddage.
- `eoRowTafEndeligEetIndependent.test.ts` bestod med 1/1 og fastholder ophørsårsagen ved endelig
  EET-virkning dagen efter TAF-perioden.
- `githubActionsReleaseStepLiveness.test.ts` bestod med 2/2 og skelner en aktiv release-step fra
  den samme kommando i en kommentar.
- Firefox-fallbackens filstiassertion blev gjort konkret; den dedikerede E2E-test bestod med 3/3.
  `eetPageAudit.spec.ts` bestod med 8/8 og genererede de fire Word-artefakter, men fysisk DOCX-
  rendering kunne ikke udføres, fordi auditmiljøet mangler `pdf2image` og LibreOffice. TD-014/TD-018
  forbliver åbne for fysisk rendering og generel dokumentparitet.
- Den samlede målrettede retest af de tre nye testfiler bestod med 3 filer / 4 tests. Der er ikke
  ændret produktkode, beregningslogik, UI/UX eller persistensformat.
- Den efterfølgende batch tilføjede `td019SfggReferenceperiodeFravaersdageValidatorIndependent.test.ts`
  med 1/1 SFGG-fraværsdagefacit, `aarsloenShDagIndependentOracle.test.ts` med 1/1 SH-dagefacit
  for Metode A og `githubActionsTriggerLiveness.test.ts` med 2/2 CI-triggerfacitter. Der er fortsat
  ikke ændret produktkode, beregningslogik, UI/UX eller persistensformat.
- Den samlede `verify:release:core` bestod efter batchen på `4e56872d` med 735 testfiler / 8.821
  beståede tests, coverage 90,23 / 81,38 / 93,97 / 93,06 og begge builds. Vite rapporterede kun
  de kendte native-config- og chunk-størrelsesadvarsler.
- Den efterfølgende reviewbatch på `9c375a07` tilføjede et uafhængigt månedsbrøksfacit med 1/1
  og en konkret licenstekstassertion i 12/12 UI-tests. Ingen produktkode, beregningslogik, UI/UX
  eller persistensformat blev ændret.
- Den efterfølgende assertion-reviewbatch på `f054ce0c` bestod med 4 filer / 63 tests. Den
  erstattede generiske truthy/falsy-assertioner med eksplicitte booleans, gatekategori, kanonisk
  brugerbesked og konkrete ILON12-/KTO-datointervaller. Ingen produktkode, beregningslogik, UI/UX
  eller persistensformat blev ændret.
- Den efterfølgende målrettede batch på `28cdcb2b` bestod med 3 filer / 8 tests. Den tilføjede et
  uafhængigt svie/smerte-facit for manglende fra-dato, et KL-lønaftale → Word-facit og en konkret
  tooltip-linjeassertion. Den samlede `verify:release:core` bestod efter batchen med 737 testfiler /
  8.824 tests, coverage 90,23 / 81,38 / 93,97 / 93,05 og begge builds. Ingen produktkode,
  beregningslogik, UI/UX eller persistensformat blev ændret.
- Den efterfølgende målrettede browserbatch på `e67baccd` bestod med 4 målrettede tests: `ui-001`
  bestod med 2/2 i Firefox, mens den historiske Satser-rejse og helårsomregningsrejsen bestod med
  1/1 hver i Chrome. En parallel 2020 → Word-prøve udløste én ikke-deterministisk
  `document:download_failure` uden download; en sekventiel gentagelse lykkedes. Observationen er
  registreret under `TD-025`; ingen produktkode, beregningslogik, UI/UX eller persistensformat blev
  ændret.
- Den fulde valgte E2E-suite blev derefter kørt på `c8187c6d` og bestod med 204 tests og 2 forventede
  skips ud af 206 på 10 projektbaner, med 3 workers på 4,2 minutter. De nye browserrejser bestod,
  og den tidligere parallelle 2020 → Word-observation gentog sig ikke.
- Den efterfølgende målrettede test-only batch på `e94609fc` bestod med 3 målrettede tests:
  `td019SvieSmerteDatoordenValidatorIndependent.test.ts` bestod med 1/1, feriepenge-
  downstreamfacittet bestod med 1/1, og `td-042-forsoergertab-pdf-indhold.spec.ts` bestod med 1/1
  i Chrome. Ingen produktkode, beregningslogik, UI/UX eller persistensformat blev ændret.
- Den efterfølgende målrettede test-only batch på `0535c82d` bestod med 3 målrettede tests:
  `td019SvieSmerteSatserAarValidatorIndependent.test.ts` bestod med 1/1, `td020SatserReferencerDocumentIndependent.test.ts`
  bestod med 1/1 gennem Word-generatoren, og `ui-002-erstatningsopgoerelse-negativ-browsergren.spec.ts`
  bestod med 1/1 i Chrome for en afvist kalenderdato i en offentlig ydelsesrække. Ingen produktkode,
  beregningslogik, UI/UX eller persistensformat blev ændret.
- Den fulde valgte E2E-suite blev derefter kørt på `0535c82d` og bestod med 206 tests og 2 forventede
  skips ud af 208 på 10 projektbaner, med 3 workers på 4,3 minutter. Den samlede
  `verify:release:core` bestod på samme revision med 741 testfiler / 8.828 tests, ingen forventede
  `it.fails`, coverage 90,23 / 81,38 / 93,97 / 93,05 og begge produktionsbuilds.
- Den historisk følsomme `Loenindkomst.nestedLoentabel.integration.test.tsx` blev efterfølgende
  kørt fem gange serielt uden coverage og bestod med 45/45 tests. Det styrker stabilitetsevidensen
  for `TD-025`, men forklarer ikke den oprindelige parallelle async-/Tooltip-følsomhed; fundet er
  derfor fortsat delvist lukket.
- Den efterfølgende test-only-runde tilføjede `td020SatserEalAslDocumentIndependent.test.ts` med
  1/1, `td019SvieSmerteVedroererPeriodeValidatorIndependent.test.ts` med 1/1 og
  `td-034-file-load-preflight-report.spec.ts` med 1/1 i Chrome. Den sidste browserrejse gav
  desuden den åbne modalobservation, der er registreret som `TD-088`; ingen produktkode,
  beregningslogik, UI/UX eller persistensformat er ændret.
- Den efterfølgende test-only-batch på `92dd437f` tilføjede tre ikke-overlappende facitter:
  `td019TafTilDatoValidatorIndependent.test.ts` bestod med 1/1, `td020SatserErhvervsevnetabReguleringDocumentIndependent.test.ts`
  bestod med 1/1 gennem Satser-Word, og `td-029-kontrolfaner-toggle-browsergren.spec.ts` bestod
  med 1/1 i Chrome. Ingen produktkode, beregningslogik, UI/UX eller persistensformat blev ændret.
- Den fulde valgte E2E-suite blev derefter kørt på `92dd437f` og bestod med 208 tests og 2 forventede
  skips ud af 210 på 10 projektbaner, med 3 workers på 4,6 minutter. Den samlede
  `verify:release:core` bestod på samme revision med 745 testfiler / 8.832 tests, ingen forventede
  `it.fails`, coverage 90,23 / 81,38 / 93,97 / 93,05 og begge produktionsbuilds. E2E-kørslen gav
  ingen ukontrollerede runtimefejl eller eksterne requests.
## Seneste browserbatch efter revision `a6d439a9`

- `ui-007-renteberegning-browserrejse.spec.ts` udvider Renteberegning med den faktiske samlede
  oversigt i både PDF og Word. To rentelinjer giver `1.207,50 kr.`, og testen kræver filsignatur,
  titel, datoer, beløb, beregningsprincipper og samme tekstsekvens i begge kanaler.
- `npm run typecheck:e2e` bestod, og den målrettede Chrome-kørsel bestod med 2/2 ved én worker
  uden runtimefejl, runtime-signaler eller eksterne requests. Ændringen er test-only; produktkode,
  beregningslogik, brugeradfærd, schema og persistensformat er uændret.

## Seneste validator- og datafacitbatch efter revision `a6d439a9`

- `td019TafOverlapValidatorIndependent.test.ts` tilføjer et håndskrevet typed facit for den
  inklusive overlapgrænse mellem to TAF-perioder og kræver begge konkrete fejlstier; målrettet
  kontrol bestod med 1/1.
- `td020KlOffentligLoenReguleringDocumentIndependent.test.ts` fører håndskrevne KL-facitter
  for tre reguleringsperioder gennem den faktiske Word-generator og kræver konkrete månedslønninger
  og timelønninger; målrettet kontrol bestod med 1/1.
- Ændringerne er test-only; produktkode, data, beregningslogik, brugeradfærd, schema og
  persistensformat er uændret. Den seneste samlede releasegate og fulde E2E-retest er fortsat
  de grønne kørsler på `92dd437f`.

## Seneste test-only batch efter revision `1c2e28ba`

- `td-031-erstatningsopgoerelse-datoorden-browsergren.spec.ts` tilføjer en synlig Chrome-
  brugerrejse for en omvendt, men kalendergyldig offentlig ydelsesperiode. Den kræver begge
  konkrete datoissues, tooltiptekster og en disabled EO-download; målrettet kontrol bestod med
  1/1 uden runtimefejl, runtime-signaler eller eksterne requests.
- `td020OffentligLoenReguleringDocumentIndependent.test.ts` fører håndskrevne RLTN-facitter
  for tre reguleringsperioder gennem den faktiske Word-generator og kræver konkrete månedslønninger
  og timelønninger; målrettet kontrol bestod med 1/1.
- `td019PublicSalaryRangeValidatorIndependent.test.ts` tilføjer et håndskrevet facit for negativ
  ekstra grundløn i en aktiv KL-sag med præcis feltsti, besked og severity; målrettet kontrol bestod
  med 1/1.
- Den lokale HEAD-verifikation bestod med 2 Vitest-tests og 1 Chrome-E2E-test. Ændringerne er
  test-only; produktkode, beregningslogik, brugeradfærd, schema og persistensformat er uændret.
  Den seneste samlede releasegate og fulde E2E-retest er fortsat de grønne kørsler på `92dd437f`.

## Seneste validator- og datafacitbatch efter revision `2fd73455`

- `td019TafDatoordenValidatorIndependent.test.ts` tilføjer et håndskrevet typed facit for en
  omvendt, kalendergyldig TAF-periode og kræver præcis feltsti, dansk besked og `error`-severity;
  målrettet kontrol bestod med 1/1.
- `td020LedighedsydelseDownstreamIndependent.test.ts` fører `1.200 kr.` gennem den faktiske
  kalenderdagsconsumer over fredag, weekend og mandag og kræver `300 kr.` pr. kalenderdag samt
  samlet `1.200 kr.`; målrettet kontrol bestod med 1/1.
- Den fulde Vitest-kørsel bestod med 751 testfiler / 8.838 tests. Hookens typechecks, ESLint,
  encoding-, filnavns- og kontraktkontrol bestod. Turing-sporet fandt ingen repræsenterbar input,
  der kan skelne `fromKroner`-survivoren; den er derfor triageret som matematisk ækvivalent.
  Ændringerne er test- og auditdokumentation; produktkode, beregningslogik, brugeradfærd, schema
  og persistensformat er uændret.

## Seneste validator-, data- og dokumentfacitbatch efter revision `209bb436`

- `td019TafBeregningsperiodeTilValidatorIndependent.test.ts` tilføjer et håndskrevet typed
  facit for manglende slutdato i en aktiv TAF-beregningsperiode og kræver præcis feltsti,
  dansk besked og `error`-severity; målrettet kontrol bestod med 1/1.
- `td020SygedagpengeDownstreamIndependent.test.ts` fører `3.000 kr.` gennem den faktiske
  sygedagpengekolonne over 23.–27.12.2024 og kræver tre hverdagsbeløb på `1.000 kr.`, tomme
  julehelligdage og korrekt periodisering; målrettet kontrol bestod med 1/1.
- `shDageDocumentIndependent.test.ts` bruger et håndskrevet marts/april-facit og kræver den
  faktiske SH-dage-dokumentmodels titel, tabel, weekenddæmpning, total og filnavn; målrettet
  kontrol bestod med 1/1.
- Den fulde Vitest-kørsel bestod med 754 testfiler / 8.841 tests. Hookens typechecks, ESLint,
  encoding-, filnavns- og kontraktkontrol bestod. Ændringerne er test- og auditdokumentation;
  produktkode, beregningslogik, brugeradfærd, schema og persistensformat er uændret.

## Seneste input-, dato-, build- og værktøjsbatch efter revision `5c6054de`

- `gridAdapter.test.tsx` tilføjer et Escape-facit for en redigeret placeholder og kræver ingen
  rækkepromotion, ingen canonical/rejected værdi, uændret revision, tom historik og ryddet
  editorregistrering; målrettet kontrol bestod med 14/14.
- `dateUtils.test.ts` tilføjer det håndberegnede negative månedsfacit `31-01-2024` →
  `31-12-2023`; den målrettede datofil bestod med 48/48.
- `verifyBuildArtifacts.test.ts` afviser nu en eksisterende nested PWA-asset, som service-workerens
  matching ikke kan håndtere; quality-filen bestod med 3/3, og `check:tool-isolation` bestod.
- Den lokale Playwright-CLI kan åbne/lukke `about:blank`, men mismatch-advarslen og Windows-
  assertionen består og er registreret som `TD-103`. Den separate `@playwright/test`-runner er
  fortsat den bindende Mineo-E2E-kontrol.
- Den fulde Vitest-kørsel bestod med 754 testfiler / 8.844 tests. Hookens typechecks, ESLint,
  encoding-, filnavns- og kontraktkontrol bestod. Ændringerne er test- og auditdokumentation;
  produktkode, beregningslogik, brugeradfærd, schema og persistensformat er uændret.

## Seneste validator-, data- og dokumentfacitbatch efter revision `5f6f0cd9`

- `td020EfterloenDownstreamIndependent.test.ts` fører efterløn gennem den faktiske
  kalenderdagsconsumer over skuddag og weekend og kræver 300 kr. pr. dag; målrettet kontrol
  bestod med 1/1.
- `td019TafBeregnesUdFraValidatorIndependent.test.ts` bruger en håndskrevet typed fixture med
  `Angivet månedsløn` og manglende månedsløn og kræver den præcise issue-evidens; målrettet
  kontrol bestod med 1/1.
- `krlDocumentPdfArtifactIndependent.test.ts` fører statiske KRL-rækker gennem den faktiske
  PDF-generator og kræver titel, tabel, kilde, metadata og filnavn; målrettet kontrol bestod med
  1/1.
- Den fulde Vitest-kørsel bestod med 759 testfiler / 8.849 tests. Ændringerne er test-only;
  produktkode, beregningslogik, brugeradfærd, schema og persistensformat er uændret. Den
  samlede `verify:release:core` bestod derefter på revision `0b4647e2` med 759 testfiler / 8.849
  tests, coverage 90,24 / 81,39 / 93,97 / 93,06 og begge builds. Den fulde E2E-suite står fortsat
  grønt på `72a6d44f` med 211 tests og 2 forventede skips ud af 213.

## Seneste dato- og dokumentfacitbatch efter revision `9b3e2719`

- `periodeBeregningKalendermaanederIndependentOracle.test.ts` fastholder et håndskrevet facit på
  fire unikke hele måneder ved årsskifte og overlappende perioder; målrettet kontrol bestod med
  1/1.
- `aarsloenDocumentPdfWordArtifactIndependent.test.ts` fører håndskrevne årslønsdata gennem de
  faktiske PDF- og Word-generatorer og kræver titel, labels, beløb, total, filnavn og MIME-type i
  begge kanaler; målrettet kontrol bestod med 1/1.
- Den fulde Vitest-kørsel bestod med 761 testfiler / 8.851 tests. Typechecks, ESLint, encoding-,
  filnavns- og kontraktkontrol bestod ved committen. Ændringerne er test-only; produktkode,
  beregningslogik, brugeradfærd, schema og persistensformat er uændret. Den samlede releasegate
  skal genkøres efter denne statusopdatering.

## Seneste dato-, beregnings- og validatorbatch efter revision `2479fff0`

- `periodeBeregningKalendermaanederAfvisningIndependentOracle.test.ts` fastholder et uafhængigt
  negativt facit for 28. februar 2024 som falsk månedsslutning i et skudår; målrettet kontrol
  bestod med 1/1.
- `aarsloenDocumentMethodAIndependent.test.ts` fører et håndberegnet Metode A-facit med tre
  SH-dage og to feriedage gennem faktisk PDF og Word og kræver `175.560,00 kr.` samt de konkrete
  beregningsprincipper; målrettet kontrol bestod med 1/1.
- `td019SvieSmerteMenafoerelseCutoffValidatorIndependent.test.ts` fastholder cutoff ved
  ménafgørelsesdatoen med præcis feltsti, dansk besked og `error`-severity; målrettet kontrol
  bestod med 1/1.
- Den fulde Vitest-kørsel bestod med 764 testfiler / 8.854 tests. De tre nye testfacitter er
  test-only; den samlede releasegate bestod efterfølgende på `60fe110f` med samme testtal,
  coverage 90,26 / 81,39 / 94,03 / 93,07 og begge builds.

## Seneste samlede releasegate efter revision `60fe110f`

- `npm run verify:release:core` bestod med 764 testfiler / 8.854 beståede Vitest-tests uden
  forventede `it.fails`, coverage 90,26 / 81,39 / 94,03 / 93,07 og begge produktionsbuilds.
- Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-, ledger- og artefaktkontroller
  bestod. Vite rapporterede kun de kendte native-config- og chunk-størrelsesadvarsler.
- Den fulde valgte E2E-suite står fortsat på `72a6d44f` med 211 beståede tests og 2 forventede
  skips ud af 213, fordi de seneste ændringer er test- og auditdokumentation.

## Seneste dokument-, data- og validatorbatch efter revision `881d285b`

- `loebendeYdelserDocumentPdfWordArtifactIndependent.test.ts` fører håndskrevne løbende
  EET-ydelser gennem faktiske PDF- og Word-artefakter og kræver titel, tabelindhold, beløb,
  filnavn og MIME-type i begge kanaler; målrettet kontrol bestod med 1/1.
- `td020KlLoenaftalerHistoriskDownstreamIndependent.test.ts` fastholder ni håndberegnede
  KL-lønaftalesegmenter fra 2005–2010 gennem den faktiske TAF-consumer med samlet
  629.621,34 kr.; målrettet kontrol bestod med 1/1.
- `td019CanonicalAmountValidatorIndependent.test.ts` fastholder negativ tidligere svie/smerte-
  total med præcis feltsti, dansk besked og `error`-severity; målrettet kontrol bestod med 1/1.
- Den fulde Vitest-kørsel bestod med 767 testfiler / 8.857 tests. Ændringerne er test-only;
  næste samlede releasegate skal køres på denne revision.

## Seneste test-only historisk løn-, dokument- og validatorbatch

- `td020KlOffentligLoenHistoriskDownstreamIndependent.test.ts` fastholder et håndskrevet
  2012-facit gennem EO-inspektionens offentlige lønsti og 1. oktober-reguleringen; målrettet
  kontrol bestod med 1/1.
- `differencekravDocumentPdfWordArtifactIndependent.test.ts` fører et håndberegnet
  Differencekrav-hovedsidefacit gennem faktiske PDF- og Word-artefakter med konkrete labels,
  metadata, filnavne og MIME-typer; målrettet kontrol bestod med 1/1.
- `td019OevrigeKravDatoValidatorIndependent.test.ts` fastholder manglende dato på et øvrigt krav
  med præcis feltsti, dansk besked og `error`-severity; målrettet kontrol bestod med 1/1.
- Den fulde Vitest-kørsel bestod med 770 testfiler / 8.860 tests. Ændringerne er test-only;
  næste samlede releasegate skal køres på denne revision.

## Seneste samlede releasegate efter revision `797f1809`

- `npm run verify:release:core` bestod med 770 testfiler / 8.860 beståede Vitest-tests uden
  forventede `it.fails`, coverage 90,26 / 81,41 / 94,03 / 93,07 og begge produktionsbuilds.
- Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-, ledger- og artefaktkontroller
  bestod. Coverage målte 18.582/20.587 statements, 13.103/16.094 branches, 3.027/3.219
  funktioner og 16.969/18.232 linjer. Vite rapporterede kun de kendte native-config- og
  chunk-størrelsesadvarsler.
- Den fulde valgte E2E-suite står fortsat på `72a6d44f` med 211 beståede tests og 2 forventede
  skips ud af 213.

## Seneste samlede releasegate efter revision `b1a0b3e6`

- `npm run verify:release:core` bestod med 767 testfiler / 8.857 beståede Vitest-tests uden
  forventede `it.fails`, coverage 90,26 / 81,39 / 94,03 / 93,06 og begge produktionsbuilds.
- Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-, ledger- og artefaktkontroller
  bestod. Vite rapporterede kun de kendte native-config- og chunk-størrelsesadvarsler.
- Den fulde valgte E2E-suite står fortsat på `72a6d44f` med 211 beståede tests og 2 forventede
  skips ud af 213.

## Seneste test-only uge-, svie/smerte- og browserbatch

- `td020SvieSmerteMaxDownstreamIndependent.test.ts` fastholder et håndskrevet 2024-facit med
  386 dage × 230 kr., maksimum 88.500 kr., tidligere 20.000 kr. og aktuelt 3.500 kr., altså
  65.000 kr.; målrettet kontrol bestod med 1/1.
- `calc-002-ugeloen-browserrejse.spec.ts` gennemfører ugeløn fra tabelindtastning til
  helårsomregning på 521.400,00 kr. og aktiv Årsløn-PDF-download; Chrome-basisbanen bestod med
  1/1 uden runtimefejl, runtime-signaler eller eksterne requests.
- Den fulde Vitest-kørsel bestod med 771 testfiler / 8.861 tests. En redundant, ny validatorfil
  blev fjernet efter review, fordi den var funktionelt identisk med en eksisterende TAF-case.
  Ændringerne er test-only; releasegaten og den fulde E2E-suite er nu genkørt på denne revision.

## Seneste test-only UI-, validator- og datafacitbatch efter revision `6133aa27`

- `EOInspektionRegulationSections.test.tsx` styrker konkrete synlighedsassertions for
  overskrifter, tabeller og viste dato-/faktorværdier; den målrettede kontrol bestod med 8/8.
- `td019OevrigeKravUdgiftTilValidatorIndependent.test.ts` tilføjer et håndskrevet typed
  facit for manglende `udgiftTil`; målrettet kontrol bestod med 1/1, og validatorgruppen
  bestod med 35 filer / 154 tests.
- `td020IndustriOgVvsLoenConsumerIndependent.test.ts` fører et håndskrevet typed facit for
  grundløn, fritvalg, feriepenge, Store Bededag og pension gennem EO-lønconsumeren; målrettet
  kontrol bestod med 1/1.
- Den fulde `npm run test` bestod med 773 testfiler / 8.863 tests. En forældet fasehenvisning
  i testkommentaren blev fjernet efter quality-værnets kontrol. Ændringerne er test-only.

## Seneste samlede releasegate efter revision `6133aa27`

- `npm run verify:release:core` bestod med 773 testfiler / 8.863 beståede Vitest-tests uden
  forventede `it.fails`, coverage 90,26 / 81,41 / 94,03 / 93,07 og begge produktionsbuilds.
  Coverage målte 18.582/20.587 statements, 13.103/16.094 branches, 3.027/3.219 funktioner
  og 16.969/18.232 linjer. Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-,
  ledger- og artefaktkontroller bestod; Vite rapporterede kun de kendte native-config- og
  chunk-størrelsesadvarsler.
- Den fulde valgte E2E-suite er fortsat grøn på `b8bc911d` med 212 beståede tests og 2
  forventede skips ud af 214 på 10 projektbaner. Den efterfølgende ændring var kun test-
  assertions og testkommentar.

## Seneste samlede releasegate og E2E efter revision `b8bc911d`

- `npm run verify:release:core` bestod med 771 testfiler / 8.861 beståede Vitest-tests uden
  forventede `it.fails`, coverage 90,26 / 81,41 / 94,03 / 93,06 og begge produktionsbuilds.
  Coverage målte 18.582/20.587 statements, 13.103/16.094 branches, 3.027/3.219 funktioner
  og 16.968/18.232 linjer. Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-,
  ledger- og artefaktkontroller bestod; Vite rapporterede kun de kendte native-config- og
  chunk-størrelsesadvarsler.
- `npm run test:e2e` bestod med 212 beståede tests og 2 forventede skips ud af 214 på 10
  projektbaner, med 3 workers på 4,9 minutter. Der blev ikke registreret ukontrollerede
  runtimefejl, runtime-signaler eller eksterne requests.

## Seneste browser-, validator- og datafacitbatch efter revision `02a45d31`

- `td-107-file-load-overwrite-cancel.spec.ts` dækker den hidtil manglende Chrome-rejse, hvor en
  syntetisk delvis `.eo`-fil først godkendes i preflight og derefter annulleres ved overskrivning.
  Den aktive sag forbliver uændret; målrettet Chrome-kørsel bestod med 1/1 uden runtimefejl,
  runtime-signaler eller eksterne requests.
- `td019TafBeregningsperiodeFraValidatorIndependent.test.ts` dækker den uafhængige symmetriske
  TAF-gren med udfyldt beregningsperiode-til-dato og manglende fra-dato; målrettet kontrol bestod
  med 1/1.
- `td020KontanthjaelpDownstreamIndependent.test.ts` fører kontanthjælp over 28.02.–02.03.2024
  gennem kalenderdagsconsumeren med 250 kr. pr. dag, også på skuddag og weekend; målrettet kontrol
  bestod med 1/1.
- `npm run test` bestod med 756 testfiler / 8.846 tests. Typechecks, ESLint, encoding-, filnavns- og
  kontraktkontrol bestod. Den samlede `verify:release:core` bestod derefter på revision `70351d3c`
  med samme 756 testfiler / 8.846 tests, coverage 90,23 / 81,38 / 93,97 / 93,05 og begge builds.
  Ændringerne er test-only; produktkode, beregningslogik, brugeradfærd, schema og persistensformat
  er uændret. Den fulde E2E-suite bestod derefter på revision `72a6d44f` med 211 tests og 2
  forventede skips ud af 213 på 10 projektbaner, med 3 workers på 4,9 minutter.

## Seneste test-only arkitektur-, dato- og inputbatch efter revision `a1e83f7c`

- `consumerInventory.test.ts` bruger nu TypeScript-AST til syntaktiske exports og direkte
  callsites og afviser symboler, der kun findes i kommentarer eller string literals; målrettet
  kontrol bestod med 4/4, og quality-suiten bestod med 55 filer / 639 tests.
- `dateUtils.test.ts` fastholder med native UTC-datoer, at alderen skifter fra 39 til 40 år på
  selve fødselsdagen og ikke dagen før; målrettet kontrol bestod med 50/50.
- `dispatchInput.test.ts` fastholder ugyldig → gyldig → undo → redo med rejected-XOR og identisk
  session-state efter hvert trin; målrettet kontrol bestod med 64/64.
- Den fulde `npm run test` bestod med 773 testfiler / 8.866 tests. Ændringerne er test-only;
  produktkode, beregningslogik, brugeradfærd, schema og persistensformat er uændret.

## Seneste samlede releasegate efter revision `a1e83f7c`

- `npm run verify:release:core` bestod med 773 testfiler / 8.866 beståede Vitest-tests uden
  forventede `it.fails`, coverage 90,25 / 81,40 / 94,03 / 93,06 og begge produktionsbuilds.
  Coverage målte 18.581/20.587 statements, 13.102/16.094 branches, 3.027/3.219 funktioner
  og 16.968/18.232 linjer. Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-,
  ledger- og artefaktkontroller bestod; Vite rapporterede kun de kendte native-config- og
  chunk-størrelsesadvarsler.
- Den fulde valgte E2E-suite er fortsat grøn på `b8bc911d` med 212 beståede tests og 2
  forventede skips ud af 214 på 10 projektbaner. Den efterfølgende ændring på `a1e83f7c`
  var kun testkode.

## Seneste test-only arkitektur-, data- og UI-batch efter revision `decec96a`

- `contractReferenceLiveness.test.ts` afviser nu et symbol, der kun findes i kommentarer, som
  kunstigt liveness-signal; målrettet kontrol bestod med 14/14.
- `td020ByggeAnlaegLoenConsumerIndependent.test.ts` fører et håndskrevet Bygge-/anlægsfacit
  gennem det faktiske EO-lønconsumerforløb med satsbrud, SH/SO-reduktion, Store Bededag,
  pension og dagstotaler; målrettet kontrol bestod med 1/1.
- `ui-004-varige-men-word-browserrejse.spec.ts` kontrollerer Varige méns Satser-fane,
  beregning, aktiv download-gate og faktisk PDF; målrettet E2E bestod med 2/2 i basisbanen.
- Den fulde `npm run test` bestod med 774 testfiler / 8.868 tests, og den fulde valgte E2E-suite
  bestod med 213 tests og 2 forventede skips ud af 215. Ændringerne er test-only.

## Seneste samlede releasegate efter revision `decec96a`

- `npm run verify:release:core` bestod med 774 testfiler / 8.868 beståede Vitest-tests uden
  forventede `it.fails`, coverage 90,26 / 81,41 / 94,03 / 93,06 og begge produktionsbuilds.
  Coverage målte 18.582/20.587 statements, 13.103/16.094 branches, 3.027/3.219 funktioner
  og 16.968/18.232 linjer. Dependency-, runtime-, type-, lint-, data-, kontrakt-, lane-,
  ledger- og artefaktkontroller bestod; Vite rapporterede kun de kendte native-config- og
  chunk-størrelsesadvarsler.
- E2E-kørslen er grøn på samme revision med 213 beståede tests og 2 forventede skips ud af
  215 på 10 projektbaner. Der blev ikke registreret ukontrollerede runtimefejl, runtime-signaler
  eller eksterne requests.

## Næste arbejdsenhed

Den seneste målrettede batch og samlede releasegate på `decec96a` er retestet grønt; den fulde
E2E-suite er ligeledes grøn på `decec96a`. Næste arbejdsenhed er en af de åbne,
test-only dækningshuller, indtil et punkt kræver udviklerens
beslutning eller faktiske eksterne artefakter. De kendte blokeringer er `TD-001`, `TD-016`, `TD-014`,
`TD-018`, `TD-022`, `B-002`, `TD-088` og den uforklarede rest-risiko i `TD-025`.

## Historisk arbejdsenhedskontekst

 De seneste test-only styrkelser er målrettet retestet: standalone-dokumentparitet med 3/3 på `75d1a956`, pensionsalderens downstream-hændelser med 2/2 på `16ad2251`, validatorens negative fritvalg-procent med 13/13 og forsørgertabets EAL-mindstesats med 1/1 på `4418f502`. Assertion-kvalitetsbatchen på `7281c4cd` bestod med 2 filer / 46 tests og erstattede to generelle truthy/falsy-assertioner med konkrete resultater. Den efterfølgende procesrente-assertion på `f6a61a6a` bestod med 15/15 målrettede tests og kræver nu en ikke-blank række-id. EO-række-id-facittet på `93021dfa` bestod med 14/14 målrettede tests og kræver nu et ikke-blankt id i roundtrip-modellen. Datafacitterne på `37a1954d` bestod med 2 filer / 148 tests og styrkede konkrete dato-, metadata- og fallback-forventninger. Den seneste batch på `564d38db` tilføjede to data-downstream-facitter, to EET-kapitaliseringsfacitter, tre browserrejser og et release-grafværn, alle målrettet retestet. Den samlede releasegate er senest genkørt grønt på `8899263d` med 711 testfiler / 8.774 beståede tests, 17 forventede `it.fails` og coverage 90,15 / 81,28 / 93,97 / 92,96. Næste arbejdsenhed skal fortsat vælges blandt de åbne, test-only dækningshuller.

`CALC-001`, `CALC-004` og `CALC-005` har nu uafhængige facitter eller totalsager og afgrænsede mutationstests med triagerede overlevere, mens `CALC-002`/`CALC-003` har samme type mutationsevidens og nu også procent-, uge-, dag- og månedlige engine-facitspor. `CALC-004` har desuden en særskilt typed 39-årsgrænsecase. `CALC-006` har fået række-/periodefacitter samt direkte Beløb-facitter for lønkolonner og en ugentlig lønperiode; fortsæt med afklaring af `TD-016` og øvrige EO-grene. `CALC-007` har fået to uafhængige EET-definition-facitter; efter-EAL-sagen kontrolleres nu i faktisk PDF og Word, mens løbende ydelse fortsat kontrolleres i Word, og der findes to særskilte kapitaliseringsfacitter. `TD-019` og `TD-020` er delvist lukket med henholdsvis schema-/issuefacitter og udvalgte sats-/downstream-facitter, herunder konkrete KL-, ILON12-, SBLON2-, procesrente-, RLTN-, Læreroverenskomst-, svie/smerte- og 2025- samt 2019/2020-sygedagpenge-facitter gennem de relevante downstream-motorer. TD-019 har nu også uafhængige facitter for modstridende overenskomstvalg, manuel lønbranches manglende eller nul grundløn og manglende dato, manuel procentsatsdato, manuel procentsats, manglende indtægtsoplysninger, manglende manuel SFGG-dagssats, manglende SFGG-beregningskilde, manglende SFGG-række og manglende referenceperiodes slut- og startdato i aktiv TAF. `safeLocalStorage.test.ts` har desuden fået et test-only Node-fallback-isolationsfacit. ARCH-002 har desuden fået et dynamisk `import()`-modcase, og VALID-001 et forkert top-level-typefacit; begge ændringer er test-only og målrettet retestet på `ca0b7617`. EET-definitionen, Beløb-facitterne, svie/smerte-facittet og ISO-ugefacittet er målrettet retestet på `c1f7c364`, `4836f1eb`, `01afcc38`, `2c4f9f82` og `ceb14c0b`; de efterfølgende storage- og validatorpartitioner er målrettet retestet på `5a952aec` og `8b845383`. Senest er CALC-004 retestet på `8d5c7a46`, og persistens-fixturebytes er låst med 5/5 facitter på `a5bd7685`.
`DOC-001` har standalone/per-output-lifecycle, standalone-alle-rendererens 1/1 semantiske facit og EET-tabelparitet. `DOC-002`/`DOC-003` har nu faktisk PDF-artefaktbevis for alle 18 hovedapp-outputs, men den snævre parser kan ikke lukke fysisk PDF-/Word-rendering, sideskift eller uafhængig semantisk paritet; fortsæt med `TD-014` og en afgrænsning af, om de 18 Word-kompatible outputs eller alle 21 katalogoutputs skal omfattes.
`DATE-001` kræver fortsat uafhængig håndregning, `PERSIST-001` kræver releaseproveniens eller accepteret fixture-erstatning under `TD-001`, og `PERSIST-002` kræver fortsat platform-/IndexedDB-bevis under `TD-022`. Afslut løbende de resterende `INPUT`-/`VALID`-, `DATA`-, shell- og releaseværnshuller, og gennemfør en samlet rest-risikorevision. Route-chunk recovery er nu browserretestet 4/4, native `LaunchQueue`-objektets form er målt 2/2 i Chrome/Edge, men OS-filaflevering, fuld outputparitet, releaseproveniens og de øvrige åbne fund står fortsat. Den statiske CI-artefaktkobling er nu dækket i quality-test, og TD-002 har fået et statisk værn for den valgte command-runner, men B-002 mangler fortsat faktisk CI-kørsel mod deploy-artefaktet. Den samlede `verify:release:core` er senest kørt rent på `4557a98e` med 729 testfiler / 8.813 beståede tests uden forventede `it.fails`, coverage 90,22 / 81,37 / 93,97 / 93,05 og begge builds; den fulde E2E-suite er senest kørt rent på `7e52716c` med 201 beståede tests og 2 forventede skips ud af 203 på 10 projektbaner. De efterfølgende test-only TD-019- og TD-020-styrkelser er målrettet retestet på `deec535e`, `5c395772`, `4f4caf24`, `6aa78b27`, `b98fb10c`, `39df52d5`, `c66e09c7`, `1cd38209`, `61b138c8`, `010b44d9`, `890fa37e`, `682b0ba3`, `69d0b53d`, `c41f8391`, `14ce800f`, `1b372144`, `b61ff7b1`, `2c5dc621`, `8028b5ee`, `9517459f`, `9a2bdf45`, `ed3e7ecd`, `ca0b7617`, `c1f7c364`, `4836f1eb`, `01afcc38`, `2c4f9f82`, `ceb14c0b`, `79313191`, `5a952aec`, `8b845383`, `8d5c7a46` og `a5bd7685`; produktkoden er ændret siden `90c4870f` i forbindelse med TD-003, TD-017 og TD-043. `TD-025` står delvist lukket efter den tidligere ikke-reproducerede flage.
Hver række skal kobles til
konkret test- og uafhængig evidens, før status
sættes til andet end `I gang`.
