# Auditspor – TD-AUDIT-2026-09-10-01

Dette er auditsporets versionsbundne indeks. Genererede rapporter ligger i de ignorerede mapper under
projektroden og må ikke indeholde rigtige person- eller sagsdata.

## Status

- Revision: `1389d93c1e8d78f6381cd1cec83bedc40b4f6a48`
- Branch: `main`
- Startdato: 2026-09-10 Europe/Copenhagen
- Fase: Auditstart og baseline afsluttet; makroinventar oprettet; `INPUT-001` og `PERSIST-001` foreløbigt gennemgået; mutationsrunner kvalificeret på `DATE-001`-moneyfladen; genskabte historiske `.eo`-fixtures tilføjet og retestet
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
| Coverage | `npm run test:coverage` | Bestået | 396 instrumenterede filer; `coverage/index.html`, `coverage/clover.xml` og `coverage/coverage-final.json` |
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

## Foreløbig fladegennemgang

| Inventar-ID | Gennemført | Evidens | Åbne punkter | Status |
| --- | --- | --- | --- | --- |
| `INPUT-001` | Kontrakt- og testinventar gennemgået; målrettet suite kørt separat; kontrolleret no-op-modprøve og uafhængig referencekontrol udført | Baseline 5 filer / 176 tests bestået; svækket no-op-gate gav 51 fejl / 146 tests; gendannet kontrol 2 filer / 103 tests bestået; separat referencekontrol 1/1 test bestået; se hoveddokumentets detaljerække | Kvalificeret mutationsrunner, fuld testkvalitetsrevision og browser-/adapterparitet | `I gang` |
| `PERSIST-001` | Kontrakt-, consumer- og testinventar gennemgået; målrettet save/load-suite og historiske fixturetests kørt separat | Baseline 24 filer / 233 tests; efter fixturetilføjelse 25 filer / 238 tests bestået; se hoveddokumentets detaljerække | Releaseproveniens eller accepteret fixture-erstatning, uafhængig struktursammenligning, mutation og fuld testkvalitetsrevision | `I gang` |
| `ARCH-002` | Registry-completeness tilføjet til arkitekturharnessets dedikerede tests | `architectureRules.test.ts`: 1 fil / 186 tests bestået; separat forventningsliste med 88 regel-ID'er fanger manglende og uventede registry-poster | De enkelte reglers negative modcases, importgrænser og øvrige livenessværn mangler | `I gang` |
| `DATE-001` | Pengefladen er mutationstestet modulvist med den kvalificerede command-runner; datoassertions er styrket | 58 money-mutationer: 56 dræbt, 2 triageret som ækvivalent/åben numerisk grænse; 13 money-tests grønne. Dato-/SH-suiten: 3 filer / 106 tests grønne efter præcise grænseassertions, eksakt 2024-facit og håndberegnet skudårsinterval; `coverage/mutation/mutation.json` | Uafhængig håndregning og resten af dato-/periodiseringsfladen mangler. `TD-003` dokumenterer, at `utcDayMath` stadig returnerer `NaN` for ugyldige `Date`-instanser; produktændring skal forelægges. | `I gang` |
| `CALC-002` | Method C dag gennemgået med den tidligere utestede hele-kalendermåned-branch | `aarsloenCalculations.test.ts`: 29/29 tests bestået, herunder januar + februar 2024 som komplette perioder og håndberegnet `360000`; `TD-008` lukket for den konkrete branch | Resterende årslønsbranches, grænser, integration/downstream-paritet, mutation og uafhængig efterregning | `I gang` |
| `CALC-003` | Procesrente-oracle gennemgået med intervalgrænser og daglig kontinuitet | `procesrenteCalculatorOracle.test.ts`: 8/8 tests bestået; breakdowns kontrolleres nu mod første start, sidste slut, næste kalenderdag og inklusivt dagtal; `TD-009` lukket for den konkrete invariant | Standalone-deling, øvrige rente-/inputbranches, outputparitet, mutation og uafhængig efterregning | `I gang` |
| `CALC-004` | Varige mén-fladen gennemgået som målrettet unit-/integrationstestbaseline | 9 filer / 81 tests bestået; méngrad-, satsår-, alder-, dato-, afrundings- og gatecases er registreret | Uafhængig talprøve eller mutation, PDF/Word-paritet, fuld browserrejse og overlaprevision | `I gang` |
| `BUILD-001` | Asset-eksistenskontrol tilføjet til buildverifikatoren | Syntetisk `verifyBuildArtifacts.test.ts`: 2/2 bestået; `node --check` bestået; TD-005 lukket | CI's E2E bygger fortsat et separat `--mode e2e`-artefakt i forhold til deploy-artefaktet; B-002 mangler | `I gang` |
| `ARCH-003` | Lane-tag-vagten parser nu syntaksbevidst tags i E2E-specs | `e2eSuiteConventions.test.ts`: 20/20 bestået; `check:e2e-lanes`: 2 gyldige tags; TD-006 lukket | Øvrige release-/CI-værn og fuld kobling til releaseforløbet mangler | `I gang` |
| `ARCH-001` | Bare test-only basenames er fjernet fra kontrakt-referenceopslag | `contractReferenceLiveness.test.ts`: 12/12 bestået efter triage; eksakte teststier accepteres fortsat; TD-007 lukket | Semantisk gennemgang af alle kontraktparagraffer og øvrige ARCH-001-værn mangler | `I gang` |

## Næste arbejdsenhed

Fortsæt `CALC-002` og `CALC-003` med de resterende branches, grænser, integration/downstream-paritet og uafhængig efterregning.
Fortsæt samtidig `DATE-001` med uafhængig håndregning og afklaring af `TD-003`. Gennemgå derefter `ARCH-002` med
negative modcases, importgrænser og øvrig liveness samt `INPUT-001` med testkvalitetsrevision og browser-/adapterparitet.
Afslut `TD-001` under `PERSIST-001` med afklaret fixtureproveniens eller accepteret erstatning og struktursammenligning.
Gå derefter videre til `CALC-006`/`DOC-001`, fordi de bærer store trust-risici og mange downstream-forbrugere. Hver række skal
kobles til konkret test- og uafhængig evidens, før status sættes til andet end `I gang`.
