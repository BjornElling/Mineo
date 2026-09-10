# Auditspor – TD-AUDIT-2026-09-10-01

Dette er auditsporets versionsbundne indeks. Genererede rapporter ligger i de ignorerede mapper under
projektroden og må ikke indeholde rigtige person- eller sagsdata.

## Status

- Revision: `1929c94f`
- Branch: `main`
- Startdato: 2026-09-10 Europe/Copenhagen
- Fase: Auditstart og baseline afsluttet; makroinventar oprettet; `INPUT-001`, `PERSIST-001`, `PERSIST-002`, `DATA-001`, `CALC-001`–`CALC-007`, `DOC-001`–`DOC-003` samt shell-/standalone-flader foreløbigt gennemgået. Mutationsrunneren er kvalificeret på `DATE-001`-moneyfladen; historiske `.eo`-fixtures, uafhængige reference-/EO-orakler, dokumentlifecycle-bevis, reel session-reload, produktionsbundet form/grid-paritet, bootstrap-sideeffektbevis, uafhængige satsfacitter, standalone valid-PDF-forløb og uafhængige totalsager for varige mén/forsørgertab er tilføjet og retestet. Alle tidligere underopgaver er afsluttet eller eksplicit stoppet; ingen subagent er aktiv.
- Hoveddokument: `docs/testing/testdaekningsgennemgang.md`

## Arbejdsrytme og commitregel

Efter hver gennemført, afgrænset arbejdsenhed – når Codex har meldt det konkrete punkt gennemført til
udvikleren – committes alle ændringer i working tree efter verifikation og før næste arbejdsenhed begynder.
Det gælder også test-, fixture- og dokumentationsændringer. Der pushes aldrig fra auditten.

## Kørte baselines

| Område | Kommando | Resultat | Artefakt / note |
| --- | --- | --- | --- |
| Typechecks | `npm run check:types` | Bestået | Alle fire TypeScript-projekter bestået |
| Lint | `npm run lint` | Bestået | 0 warnings/errors |
| Vitest | `npm run test` | Bestået | 635 filer, 8.421 tests, 278,06 s |
| E2E-baner | `npm run test:e2e` | Bestået | 174 tests, 4,1 min, 3 workers; `playwright-report/` og `test-results/` |
| Coverage | `npm run test:coverage` | Bestået | 644 testfiler / 8.461 tests; 88,88 % statements, 80,20 % branches, 91,71 % functions, 91,68 % lines; `coverage/index.html`, `coverage/clover.xml` og `coverage/coverage-final.json` |
| Persistensmålrettet suite | `npx vitest run ...` (se hoveddokumentet) | Bestået | 24 filer, 233 tests, 10,19 s |
| Historiske `.eo`-fixtures | `npx vitest run src/__tests__/utils/historicalEoFixtures.test.ts` | Bestået | 5 tests; fixtures for legacy uden version samt 1.0.4, 3.10, 3.12 og 3.13 |
| Persistenssuite efter fixturetilføjelse | `npx vitest run ...` (se hoveddokumentet) | Bestået | 25 filer, 238 tests, 13,92 s |

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
  syntetiske positive/negative regressionstest bestod 2/2. Det tidligere B-001 er lukket, mens CI's
  separate E2E/deploy-artefakt (B-002) fortsat er åbent.
- Lane-vagten er gjort tokenizer-baseret, så double-quoted og array-baserede tags samt kommentarer og
  strengindhold behandles korrekt. `e2eSuiteConventions.test.ts` bestod 20/20, og `check:e2e-lanes` er grøn.
- Kontrakt-referenceværnet ignorerer nu bare basenames fra `src/__tests__`, mens eksakte teststier stadig
  valideres. `wordContentHarness.ts` er triageret som en bevidst test-only reference, og liveness-suiten
  er grøn efter regressionstesten.
- `uafhaengigSatsFacitmatrix.test.ts` har fire uafhængige literal-facit-tests for EAL/ASL, EET,
  Nationalbanken og Danmarks Statistik. Sygedagpengeregistret er bevidst udeladt, fordi den fundne
  officielle 2005-kilde angiver 88,30 kr./time, mens produktdata angiver 88,51 kr./time; det er et
  afklaringspunkt og ikke et facit, auditten må gætte.
- `persistence-reload-session.spec.ts` bevæger afsluttet input og aktiv fane gennem reel browser-reload
  med 1/1 grøn test. `minprocesrente-valid-download.spec.ts` dækker valid beregning, gates, faktisk PDF
  og `beforeunload`-exit-guard med 1/1 grøn test. `bootstrapUnsupportedDeviceSideEffects.test.tsx`
  dækker de tidlige unsupported-device-sideeffekter med 1/1 grøn test.

## Foreløbig fladegennemgang

| Inventar-ID | Gennemført | Evidens | Åbne punkter | Status |
| --- | --- | --- | --- | --- |
| `INPUT-001` | Kontrakt- og testinventar gennemgået; målrettet suite kørt separat; kontrolleret no-op-modprøve og uafhængig referencekontrol udført | Baseline 5 filer / 176 tests bestået; svækket no-op-gate gav 51 fejl / 146 tests; gendannet kontrol 2 filer / 103 tests bestået; separat referencekontrol 1/1 test bestået; se hoveddokumentets detaljerække | Kvalificeret mutationsrunner, fuld testkvalitetsrevision og browser-/adapterparitet | `I gang` |
| `PERSIST-001` | Kontrakt-, consumer- og testinventar gennemgået; målrettet save/load-suite, historiske fixturetests og uafhængig referencekontrol kørt separat | Baseline 24 filer / 233 tests; efter fixturetilføjelse 25 filer / 238 tests bestået; `fileRoundTrip.independentReference.test.ts`: 1/1 bestået | Releaseproveniens eller accepteret fixture-erstatning, mutation og fuld testkvalitetsrevision | `I gang` |
| `PERSIST-002` | Storage/settings, filhåndtag, PWA-filflows og reel session-reload gennemgået | 15 filer / 180 målrettede unit-/hook-tests; PWA-/filkørsel 4/4; reel input + aktiv fane + reload 1/1 | Ikke-callable File API-capability, IndexedDB-/hook-sammenhæng og flere storage-fejlveje; `TD-017` | `I gang` |
| `INPUT-002` / `VALID-001` | Form/grid-overflader, produktions-ChoiceField og schema-/validatorhuller gennemgået | 63 filer / 1.469 tests; produktionsbundet form/grid-paritet 1/1 | Nested row-partitioner, faktiske `ZodError.issues` og fixture-uafhængighed; `TD-019` | `I gang` |
| `DATA-001` | Data-/satskatalog, integritet og udvalgte uafhængige endpointfacit gennemgået | 23 filer / 476 målrettede tests; uafhængig facitmatrix 4/4 | Resterende kilder, validatorpartitioner og sats → beregning → dokument-kæde; `TD-020` | `I gang` |
| `CALC-001` | Satser og fælles reguleringsdata gennemgået som målrettet domænebaseline | `src/__tests__/domain/satser`: 4 filer / 47 tests bestået; satsårsprojektion, new-case seed, ASL-maksimum og begge reguleringsmetoder er dækket. Datafacitmatrix: 4/4 tests bestået for udvalgte lovbestemte satser, referencesats og ILON12/SBLON2 | Integration/E2E, resterende dataregistrenes endepunkter og komplet downstream-konsumentparitet | `I gang` |
| `ARCH-002` | Registry-completeness og udvalgte negative modcases tilføjet til arkitekturharnessets dedikerede tests | `architectureRules.test.ts`: 1 fil / 189 tests bestået; separat forventningsliste med 88 regel-ID'er samt re-export- og liveness-modcases; `TD-015` lukket for de konkrete huller | De enkelte reglers negative modcases, importgrænser og øvrige livenessværn mangler | `I gang` |
| `DATE-001` | Pengefladen er mutationstestet modulvist med den kvalificerede command-runner; datoassertions er styrket | 58 money-mutationer: 56 dræbt, 2 triageret som ækvivalent/åben numerisk grænse; 13 money-tests grønne. Dato-/SH-suiten: 3 filer / 106 tests grønne efter præcise grænseassertions, eksakt 2024-facit og håndberegnet skudårsinterval; `coverage/mutation/mutation.json` | Uafhængig håndregning og resten af dato-/periodiseringsfladen mangler. `TD-003` dokumenterer, at `utcDayMath` stadig returnerer `NaN` for ugyldige `Date`-instanser; produktændring skal forelægges. | `I gang` |
| `CALC-002` | Method C dag gennemgået med den tidligere utestede hele-kalendermåned-branch | `aarsloenCalculations.test.ts`: 29/29 tests bestået, herunder januar + februar 2024 som komplette perioder og håndberegnet `360000`; `TD-008` lukket for den konkrete branch | Resterende årslønsbranches, grænser, integration/downstream-paritet, mutation og uafhængig efterregning | `I gang` |
| `CALC-003` | Procesrente-oracle gennemgået med intervalgrænser og daglig kontinuitet | `procesrenteCalculatorOracle.test.ts`: 8/8 tests bestået; breakdowns kontrolleres nu mod første start, sidste slut, næste kalenderdag og inklusivt dagtal; `TD-009` lukket for den konkrete invariant | Standalone-deling, øvrige rente-/inputbranches, outputparitet, mutation og uafhængig efterregning | `I gang` |
| `CALC-004` | Varige mén-fladen gennemgået som målrettet unit-/integrationstestbaseline og uafhængig totalsag | 10 filer / 82 tests bestået; méngrad-, satsår-, alder-, dato-, afrundings- og gatecases samt håndberegnet engine → projection → gate-facit er registreret | Mutation, PDF/Word-paritet, fuld browserrejse og overlaprevision | `I gang` |
| `CALC-005` | Forsørgertabsfladen gennemgået som målrettet unit-/integrationstestbaseline og uafhængig totalsag | 8 filer / 82 tests bestået; snapshot-/reader-gates, kønsgrene, perioder, minimum/maksimum, EAL/ASL-afhængigheder og håndberegnet totalsag er registreret | Mutation, PDF/Word-paritet, fuld E2E-rejse og overlaprevision | `I gang` |
| `CALC-006` | EO-snapshot, canonical totals, dokumentprojektion, inspektionsdage og sidevisning stikprøvet med to uafhængige orakler | `eoSnapshotIndependentOracle.test.ts`: 3/3 og `eoInspektionIndependentOracle.test.ts`: 5/5 bestået; en weekendydelse i arbejdsdagsbaseret TAF gav observeret `control:sammentaelling_mismatch`; `TD-016` er åbent | Row-priority og øvrige rækkegrene, dokumentparitet, mutation og fuld E2E; udviklerens beslutning om TD-016 | `I gang` |
| `DOC-001` | Katalog, definitioner, gate/lifecycle og renderer-wiring gennemgået som evidensbaseline | Fokuseret kontrol: 8 filer / 96 tests. Bred dokumentkontrol: 22 filer / 232 tests. Separat gate-/downloadspor: 3/3. Kataloget dækker 18 Mineo- og 3 standalone-outputs | TD-012–TD-014: manglende standalone/per-output lifecycle, ufuldstændig lifecycle-fasekæde og manglende generel PDF/Word-paritet | `I gang` |
| `SHELL-001` / `SHELL-002` | Auth, routes, desktop-/unsupported-device-gate, 404, PWA, service worker, preload og browsermotorer gennemgået | 26 fokuserede filer / 125 tests; bootstrap-sideeffekter 1/1, shell/404 4/4, minimumsviewporter 12/12, PWA-installation 8/8, øvrige målrettede browserflows grønne | Mobil-hard-stop i ægte browser og manglende lazy-chunk recovery; `TD-021`/`TD-022` | `I gang` |
| `MIN-001` | Standalone isolation, reset/fokus, error boundary, valid beregning, PDF og exit-guard gennemgået | `minprocesrente-valid-download.spec.ts`: 1/1 samt 26-filers shell-/standalonekontrol | Browserbaseret namespace-/runtime-isolation; `TD-023` | `I gang` |
| `BUILD-001` | Asset-eksistenskontrol og PWA-manifestets faktiske filudvalg gennemgået | Syntetisk `verifyBuildArtifacts.test.ts`: 2/2; `npm run build:mineo` bestået; E2E-buildserver og `eetPageAudit.spec.ts`: 4/4; TD-005 lukket | CI's E2E bygger fortsat et separat `--mode e2e`-artefakt i forhold til deploy-artefaktet; B-002 og øvrige chunk-/Vite-advarsler mangler | `I gang` |
| `ARCH-003` | Lane-tag-vagten parser nu syntaksbevidst tags i E2E-specs | `e2eSuiteConventions.test.ts`: 20/20 bestået; `check:e2e-lanes`: 2 gyldige tags; TD-006 lukket | Øvrige release-/CI-værn og fuld kobling til releaseforløbet mangler | `I gang` |
| `ARCH-001` | Bare test-only basenames er fjernet fra kontrakt-referenceopslag | `contractReferenceLiveness.test.ts`: 12/12 bestået efter triage; eksakte teststier accepteres fortsat; TD-007 lukket | Semantisk gennemgang af alle kontraktparagraffer og øvrige ARCH-001-værn mangler | `I gang` |

## Næste arbejdsenhed

`CALC-004` og `CALC-005` har nu uafhængige totalsager. Fortsæt med `CALC-006` med row-priority, øvrige rækkegrene
og afklaring af `TD-016`, samt `DOC-001` med standalone/per-output-lifecycle. `DOC-002`/`DOC-003` mangler fysisk
PDF-/Word-parse/render og semantisk paritet. `DATE-001` kræver fortsat uafhængig håndregning og afklaring af `TD-003`,
`PERSIST-001` kræver releaseproveniens eller accepteret fixture-erstatning under `TD-001`, og `PERSIST-002` kræver
fortsat platform-/IndexedDB-bevis under `TD-017`. Afslut løbende de resterende `INPUT`-/`VALID`-, `DATA`-, shell- og
releaseværnshuller. Hver række skal kobles til konkret test- og uafhængig evidens, før status sættes til andet end `I gang`.
