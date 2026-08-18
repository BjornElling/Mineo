# Overdragelse — E2E-suitens vægt (2026-08-18)

Midlertidig fil. Slettes når arbejdet er afsluttet.

## Opgaven

Brugerfund: E2E-suiten timeoutede «næsten hver gang» og gav store mængder problemer, der ikke
skyldtes fejl i koden, men alene kørslens vægt. Mandat: gør suiten lettere at køre (eller tag den ud
af den almindelige gate) — frit valg — og kontrollér derefter, at den kører uproblematisk.

## Diagnose (målt, ikke gættet)

1. **Matrixeksplosion.** Alle 28 spec-filer (77 tests) kørte i alle 16 projekter — fire browsere ×
   fire viewporter = **1232 tests**. Basisbanen alene (chrome, 1536×864) blev målt til **3m01s** for
   de 77; hele matrixen svarer dermed til ca. tre kvarter. CI kørte i forvejen kun de fire
   baseline-viewport-projekter, så lokalt var suiten 4× tungere end CI uden ekstra dækning.
2. **En hængende capture-test.** `content-scale.spec.ts` › «skærmprint neutraliserer kun
   arbejdsfladeskaleringen under capture» var bundet til otte projektnavne (4 browsere × 2
   minimumsviewporter) og har `test.setTimeout(180_000)`. Alene tager den ~2,6 s; kører flere kopier
   samtidigt på en hukommelsesbegrænset maskine, bliver `html2canvas` med `scale: 2` aldrig færdig,
   og hver kopi æder sit fulde 180-sekunders loft. Op mod tyve minutter rene, indholdsløse timeouts
   pr. kørsel. **Dette var sandsynligvis brugerens hovedgene.**
3. **Efterladt buildserver.** Afbrydes en kørsel (værktøjstimeout, Ctrl+C), bliver
   `serve-e2e-builds.mjs` siddende på port 4173, og ENHVER senere kørsel fejler øjeblikkeligt med
   «port already used». Set konkret i denne session: en server fra kl. 13:30 blokerede første måling.
4. **Videooptagelse.** `video: 'retain-on-failure'` optager i praksis alle tests og kasserer dem der
   består — fast CPU- og hukommelsesudgift pr. test på netop den maskine, der er presset.

## Hvad er gjort

- **Banemodel** i `playwright.config.ts` + `e2e/support/lanes.ts`:
  - intet tag → basisbanen (chrome 1536×864), kører alle specs
  - `@browsere` → desuden Edge, Firefox, WebKit ved basisviewporten
  - `@viewporter` → desuden chrome ved 1536×730 og 1366×620
  - `PLAYWRIGHT_FULL_MATRIX=1` (`npm run test:e2e:full`) kører hele den gamle 4×4-matrix.
  - Resultat: **151 tests** i standardkørslen mod 1232 før. Projektnavnene er uændrede, så
    `--project=...` og CI-matrixen peger på det samme som før.
- **Tags sat** (med begrundelse ved hvert `describe`): `@browsere` på overlay-behaviour,
  popup-focus-restore, page-tabs-keyboard-boundary, web-link-policy, input-digit-limits,
  attention-blink-repeat, dropdown-focus-and-loenindkomst-intro, tooltip-wrapping,
  file-load-validation, audit-firefox-fallback-verification. `@viewporter` på
  minimum-viewport-shell.
- **Capture-testen** er nu utagget (kører ét sted), har fået `test.setTimeout(90_000)` og er løsnet
  fra den håndskrevne liste af projektnavne. Bemærk: den må IKKE sætte sin egen viewport med
  `setViewportSize` — så åbner rapportdialogen slet ikke i Chromium/Firefox (verificeret ved
  kontrolforsøg). Kommentaren i filen forklarer begge dele.
- **`scripts/run-e2e.mjs`** er nu ét indgangspunkt for `test:e2e`, `test:e2e:headed`,
  `test:e2e:full`: kører lane-vagten, rydder porten, starter Playwright med Node direkte (npx.cmd
  kan ikke spawnes uden shell på Windows) og videresender argumenter.
- **`scripts/free-e2e-port.mjs`** + `scripts/e2e-server-identity.mjs` + identitetsendpoint i
  `serve-e2e-builds.mjs`: lukker en efterladt Mineo-buildserver, men KUN en der selv svarer at den
  er vores. Verificeret virksom på en levende server.
- **`scripts/check-e2e-lane-tags.mjs`** (også i `verify:release:core`): fanger et fejlstavet
  bane-tag, som ellers tavst ville betyde «kører ingen steder ekstra».
- **Video slået fra** (`PLAYWRIGHT_VIDEO=1` slår den til igen). Trace er beholdt.
- **CI** kører nu de samme seks baneprojekter, så CI og lokal kørsel har identisk dækning.
- **AGENTS.md** opdateret med banemodellen, `test:e2e:full`, portoprydningen og videopolitikken.

## Status

Grønt/rødt: **ukendt for den samlede suite efter sidste rettelse.**

- Kørsel 2 (før capture-rettelsen): 137 passed, 17 skipped, **2 failed** — begge var capture-testen
  ved 1536×730 og 1366×620. Wall clock 5m41s.
- Capture-testen er derefter rettet og verificeret grøn isoleret (2,6 s ved både 864 og 730).
- Kørsel 3 blev startet, men **dens resultat er ugyldigt**: jeg lukkede buildserveren på port 4173,
  mens kørslen stadig var i gang, hvilket væltede 21 tests i kaskade. Tallet «21 failed» i loggen
  skal derfor IKKE læses som et reelt fund.
- Grønt og verificeret: `check:e2e-lanes`, `npm run typecheck:e2e`, `npm run lint`.

## Næste konkrete skridt

1. Kør `npm run test:e2e` uforstyrret og forvent grøn på ~3½–4 minutter (151 tests, 3 workers).
   Rør ikke port 4173 undervejs.
2. Er den grøn: opgaven er færdig — slet denne fil.
3. Er der enkelte røde: kontrollér først om de er ressourcerelaterede (kør den enkelte test solo med
   `npm run test:e2e -- --project=<projekt> -g "<titel>"`). Består den solo, er det parallelitet, og
   samme mønster som capture-testen — overvej samme behandling (færre projekter, strammere loft).
4. `npm run typecheck` og `npm run test` (Vitest) er IKKE kørt, fordi ingen `src/`-kode er ændret.
   Køres kun hvis noget alligevel har rørt produktionskode.

## Tilfældighedsfund (ikke rettet — rapportér til bruger)

- **Duplikeret login i e2e.** `e2e/support/mineoTest.ts` findes netop for at samle det, men ~20
  spec-filer har stadig hver sin kopi af `TEST_PASSWORD` og `login()`. Konvergensbrud; oplagt
  oprydning, men bevidst holdt uden for denne ændring for ikke at blande en 20-fils-refaktorering
  ind i verifikationen af suitens vægt.
- **`setViewportSize` før interaktion.** At rapportdialogen ikke åbner i Chromium/Firefox efter et
  `setViewportSize`-kald er uforklaret. De øvrige tests i `content-scale.spec.ts` resizer midt i
  forløbet og åbner dialoger uden problem, så det er sandsynligvis et testartefakt — men det er
  ikke bevist, og det bør undersøges, hvis en bruger nogensinde rapporterer, at «Rapportér fejl»
  ikke reagerer efter en vinduesændring.
