# Auditspor – TD-AUDIT-2026-09-10-01

Dette er auditsporets versionsbundne indeks. Genererede rapporter ligger i de ignorerede mapper under
projektroden og må ikke indeholde rigtige person- eller sagsdata.

## Status

- Revision: `1389d93c1e8d78f6381cd1cec83bedc40b4f6a48`
- Branch: `main`
- Startdato: 2026-09-10 Europe/Copenhagen
- Fase: Auditstart og baseline afsluttet; makroinventar oprettet; `INPUT-001` og `PERSIST-001` foreløbigt gennemgået; kontrolleret no-op-modprøve og uafhængig referencekontrol udført for `INPUT-001`; genskabte historiske `.eo`-fixtures tilføjet og retestet
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

## Foreløbig fladegennemgang

| Inventar-ID | Gennemført | Evidens | Åbne punkter | Status |
| --- | --- | --- | --- | --- |
| `INPUT-001` | Kontrakt- og testinventar gennemgået; målrettet suite kørt separat; kontrolleret no-op-modprøve og uafhængig referencekontrol udført | Baseline 5 filer / 176 tests bestået; svækket no-op-gate gav 51 fejl / 146 tests; gendannet kontrol 2 filer / 103 tests bestået; separat referencekontrol 1/1 test bestået; se hoveddokumentets detaljerække | Kvalificeret mutationsrunner, fuld testkvalitetsrevision og browser-/adapterparitet | `I gang` |
| `PERSIST-001` | Kontrakt-, consumer- og testinventar gennemgået; målrettet save/load-suite og historiske fixturetests kørt separat | Baseline 24 filer / 233 tests; efter fixturetilføjelse 25 filer / 238 tests bestået; se hoveddokumentets detaljerække | Releaseproveniens eller accepteret fixture-erstatning, uafhængig struktursammenligning, mutation og fuld testkvalitetsrevision | `I gang` |

## Næste arbejdsenhed

Færdiggør `INPUT-001` med kvalificeret mutationsrunner, testkvalitetsrevision og browser-/adapterparitet. Afslut derefter `TD-001` under
`PERSIST-001` med afklaret fixtureproveniens eller accepteret erstatning og struktursammenligning. Gå derefter videre til `CALC-006` og
`DOC-001`, fordi de bærer store trust-risici og mange downstream-forbrugere. Hver række skal kobles til
konkret test- og uafhængig evidens, før status sættes til andet end `I gang`.
