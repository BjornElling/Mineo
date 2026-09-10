# Auditspor – TD-AUDIT-2026-09-10-01

Dette er auditsporets versionsbundne indeks. Genererede rapporter ligger i de ignorerede mapper under
projektroden og må ikke indeholde rigtige person- eller sagsdata.

## Status

- Revision: `1389d93c1e8d78f6381cd1cec83bedc40b4f6a48`
- Branch: `main`
- Startdato: 2026-09-10 Europe/Copenhagen
- Fase: Auditstart og baseline afsluttet; makroinventar oprettet; `INPUT-001` og `PERSIST-001` foreløbigt gennemgået
- Hoveddokument: `docs/testing/testdaekningsgennemgang.md`

## Kørte baselines

| Område | Kommando | Resultat | Artefakt / note |
| --- | --- | --- | --- |
| Typechecks | `npm run check:types` | Bestået | Alle fire TypeScript-projekter bestået |
| Lint | `npm run lint` | Bestået | 0 warnings/errors |
| Vitest | `npm run test` | Bestået | 635 filer, 8.421 tests, 278,06 s |
| E2E-baner | `npm run test:e2e` | Bestået | 174 tests, 4,1 min, 3 workers; `playwright-report/` og `test-results/` |
| Coverage | `npm run test:coverage` | Bestået | 396 instrumenterede filer; `coverage/index.html`, `coverage/clover.xml` og `coverage/coverage-final.json` |
| Persistensmålrettet suite | `npx vitest run ...` (se hoveddokumentet) | Bestået | 24 filer, 233 tests, 10,19 s |

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

## Foreløbig fladegennemgang

| Inventar-ID | Gennemført | Evidens | Åbne punkter | Status |
| --- | --- | --- | --- | --- |
| `INPUT-001` | Kontrakt- og testinventar gennemgået; målrettet suite kørt separat | 5 filer, 176 tests bestået; se hoveddokumentets detaljerække | Mutation/modprøve, uafhængig reference, fuld testkvalitetsrevision og browser-/adapterparitet | `I gang` |
| `PERSIST-001` | Kontrakt-, consumer- og testinventar gennemgået; målrettet save/load-suite kørt separat | 24 filer, 233 tests bestået; se hoveddokumentets detaljerække | Versionsbundne `.eo`-fixtures, uafhængig struktursammenligning, mutation og fuld testkvalitetsrevision | `I gang` |

## Næste arbejdsenhed

Færdiggør `INPUT-001` med mutation/modprøve og uafhængig referencekontrol. Luk først `TD-001` under
`PERSIST-001` med versionsbundne fixtures og struktursammenligning. Gå derefter videre til `CALC-006` og
`DOC-001`, fordi de bærer store trust-risici og mange downstream-forbrugere. Hver række skal kobles til
konkret test- og uafhængig evidens, før status sættes til andet end `I gang`.
