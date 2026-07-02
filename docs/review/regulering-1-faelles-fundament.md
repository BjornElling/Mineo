# Regulering punkt 1 — Fælles fundament

**Dato:** 2026-07-02
**Status:** ✅ Gennemgået
**Reguleringsform(er):** alle (det maskineri formerne deler)
**Primært scope:**
- `helpers/eoSharedUtils.ts` (`resolveAnvendtReguleringsdato`, `resolveStatistikModelId`, `isAslStatistikModel`)
- `engines/reguleringCoverage.ts` (`resolveOverenskomstEffectiveStartIso`, `resolveOverenskomstCoverageStartIso`)
- `engines/loenudviklingBeregning.ts:296–366` (`buildSegmentsFromStartDates`, `findLatestByDateInSortedList`, `resolveEffectiveBaseEntry`, `buildZeroDeltaSegment`)
- `engines/reguleringFormulaUtils.ts`, `engines/overenskomstReguleringShared.ts`
- afrundings-/dato-helpers i reguleringsstien

**Afhængigheder læst:** `AGENTS.md`; `regulering-review-plan.md`; `regulering-0-baseline.md`; `validators/erstatningsopgoerelseValidator.ts` (`validateLoenudviklingDataCoverage`); `domain/eoRowEvaluation/eoRowIndkomstRows.ts` (coverage-rows); `snapshot/eoDocumentDownloadGate.ts`; `components/.../eoBeregning/useEoBeregningViewModel.ts` (blocking-rows-gate); `reguleringsPresentation.ts` (`tidligsteSatsGaelderFra`); `data/statistiskeRates.ts`, `data/krlRates.ts`, `data/overenskomstRates.ts` (interval-funktioner).

**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npx vitest run reguleringCoverage.test.ts loenudviklingBeregning.test.ts reguleringFormulaUtils.test.ts` → ✅ 3 filer / 96 tests pass (heraf 9 nye i `reguleringCoverage.test.ts`)

## Kæde fra input til færdigt produkt

Eksempel: statistik-form (ILON12), `Beregningsperiode`, `saerligFraDatoRegulering = 2018-05-01` (efter ILON12's første kvartal), ét TAF-interval `2018-05-01 … 2020-12-31`. Forventet: base = indeks ved seneste kvartalsstart ≤ 2018-05-01; per-segment `deltaPct = (idx[segment]/idx[base] − 1)×100`.

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `statistik`; `assertUniform` håndhæver ensartethed | Uvalgt strategi → `throw` (fail-closed), ikke stille nul | ✔ |
| Datakilde-opslag | `getStatistiskLoenudvikling('ILON12')`; ukendt model → `throw` | Fail-open ved model-mismatch | ✔ (throw) |
| Reguleringsdato-forankring | `resolveAnvendtReguleringsdato` = `saerligFraDatoRegulering ?? beregningsperiodeTil` = 2018-05-01; `undefined` → `throw` i motoren (`:640`) | Ingen dato → stille nul-base | ✔ (throw) |
| Segment/indeks/akkumulering | `resolveEffectiveBaseEntry` finder base ≤ dato; `buildSegmentsFromStartDates` deler ved kvartalsstart; `findLatestByDateInSortedList` per segment | Manglende indeks efter base → `throw` (`:714`) | ✔ |
| Afrunding | `roundByMethod(deltaPct, 2, 'halfAwayFromZero')` — kanonisk | Ad hoc/dobbelt-afrunding | ✔ |
| Aggregering (af/år) | segmenter → `segmentAmountOre`; multi-af summeres, én af-fejl → hele modellen fail-closer (baseline) | Én af maskerer andens fejl på compute-niveau | ✔ (compute); row-lag = punkt 13 |
| Snapshot | `computeEoSnapshot`; motor-`throw` → `fail_closed` / `runtime_exception` | Throw sluges | ✔ |
| Validator/gate | `validateLoenudviklingDataCoverage` (øvre grænse) + coverage-rows (`reguleringsvaerdi`, nedre grænse) | Se Dækningsanalyse | ✔ |
| Skærm-præsentation | `reguleringsPresentation` bygger indeks-tabel + `tidligsteSatsGaelderFra`-note | Note beregnes uafhængigt af compute | ✔ (se Fund 2) |
| PDF-output | `reguleringSection.ts` / `reguleringDocument.ts` | Punkt 14 | (punkt 14) |
| Word-output | docx-generatorer | Punkt 14 | (punkt 14) |

## Dækningsanalyse (led 2 — tavs under-regulering)

### S1 — `resolveEffectiveBaseEntry.usedFallback` (reguleringsdato før første sats)

- **Sti:** silent fallback — når `findLatestByDateInSortedList` ikke finder en sats ≤ reguleringsdato, ankres base til `sortedItems[0]` (ældste sats), `usedFallback = true`; segmenter før `effectiveBaseStartIso` → `buildZeroDeltaSegment`.
- **Led i kæden:** beregningsmotoren (statistik `:692`, KRL `:757`).
- **Kan valid input ramme den?** Ja — hvis reguleringsdatoen (fx nær en gammel skadedato) ligger før satstabellens første post. `usedFallback` fyrer ⟺ reguleringsdato < første sats.
- **Bevidst korrekt eller fejl? → BEKRÆFTET KORREKT (gated).** Den synlige fejl findes — men i **række-laget**, ikke i motoren:
  - `eoRowIndkomstRows.ts:472` sætter `reguleringsvaerdi`-rækken til `status: 'error'` når `anvendtReguleringsdato < reguleringsRange.min`.
  - `reguleringsRange.min = parseDanishToIso(interval.fraDato)`. For **statistik** er `interval.fraDato = kvartalToStartDato(minKvartal)` (`statistiskeRates.ts:257`) = motorens **første** `periodStart`. For **KRL** er `interval.fraDato = aeldste.fraDato` (`krlRates.ts:213`) = motorens **første** `periodStart`. Row-gatens `min` er altså **identisk** med den sats, motoren ellers falder tilbage til → row-error fyrer **præcis** når `usedFallback` ville fyre. Ingen ugated mellemzone.
  - Error-rækken er en `collectAllEoRows`-række; `hasBlockingEoRowErrors → hasBlockingRows → canDownload = false` (`eoDocumentDownloadGate.ts:67`, `useEoBeregningViewModel.ts:356`). Produktet blokeres altså med en **synlig** fejl, før fallbacken kan nå brugeren.
  - Under escape-hatchen (`allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden`, punkt 13) nedgraderes error → warning; download tillades, og motorens fallback (base = ældste sats, zero-delta før) er da den **tilsigtede** semantik ved brugerens eksplicit accepterede ufuldstændige dækning. En konvertering til `throw` her ville være **forkert** (bryder escape-hatch-funktionen). Derfor foreslås **ingen** beregningsændring.
- **Udfald: uændret (bekræftet korrekt).** Ingen beregningsændring parkeret. Residual robusthedsnote (Fund 1) og dead-code (Fund 2) håndteres uden tal-påvirkning.

### `resolveAnvendtReguleringsdato` — undefined fail-closer konsekvent

- **Sti:** returnerer `undefined` når begge kandidater i den valgte gren mangler (`Beregningsperiode`: `saerligFraDatoRegulering`/`beregningsperiodeTil`; angivet løn: `angivetLoenMetodeOpreguleresFraDato`/`skadedato`).
- **Kan valid input ramme den?** Nej ved komplet input; ved mangel fail-closer hver strategi-motor: statistik `:640`, KRL `:735`, manualProcentsats `:805`, klLoenaftaler `:846`, overenskomst `:888` → alle `throw 'reguleringsdato mangler'` → `runtime_exception`. Row-laget: `:465` `!anvendtReguleringsdato → status 'error'`.
- **Undtagelse (bevidst):** `buildLoenudviklingFromManual` (`:1286`) bruger basisrækken som niveau og kaster **ikke** på undefined reguleringsdato (drop-betingelsen bliver blot falsk). Manuel har egen basis-række-validering (dato = reguleringsdato). Ejes af **punkt 7** — noteret, ikke en fundament-fejl.
- **Udfald: bekræftet korrekt.**

### `resolveOverenskomstEffectiveStartIso` — `max(reguleringsdato, dækningsstart)`

- **Sti:** `minCoverageIso > reguleringTableStartIso ? minCoverageIso : reguleringTableStartIso` (streng `>`, lexikografisk = kronologisk på ISO). Ingen coverage → tabel-start uændret.
- **Kan valid input ramme tab?** Nej. Grænsen (coverage = tabel-start) beholder tabel-start (ingen off-by-one). Manglende overenskomst-dækning nedstrøms gated i row-laget (punkt 5/13).
- **Udfald: bekræftet korrekt** (nu test-dækket, se Testdækning).

## Fund og rettelser

1. **[Medium] `usedFallback`-gaten og motorens fallback er to uafhængige beregninger af "før første sats" — kobling uden invariant-værn**
   - Lokation: `loenudviklingBeregning.ts:353–366` (motor) vs. `eoRowIndkomstRows.ts:472` (row-gate).
   - Problem/Risiko: De to steder afgør uafhængigt "reguleringsdato < første sats". De aligner i dag udelukkende fordi begge udleder deres "første sats" fra samme underliggende datatabel (`interval.fraDato` = motorens første `periodStart`). Ændrer `getReguleringsDatoIntervalFor…`-familiens semantik sig (fx en fremtidig off-by-one i interval-fraDato), kan der åbne sig en **ugated** zone hvor row-gaten ikke fyrer, men motorens fallback stille ankrer til ældste sats → tavs under-regulering. Ikke en fejl i dag.
   - Handling: **Anvendt af hovedtråden** som en ren, tal-neutral test-binding (ingen beregningsændring, ingen throw i motoren). Ny `reguleringSilentPathAlignment.test.ts` binder motorens fallback (`buildLoenudviklingModel` producerer stille en model) til den blokerende row-error (`reguleringsvaerdi`-row `status === 'error'`) for **både** statistik (ILON12) og KRL — så en fremtidig drift mellem de to "før første sats"-beregninger fanges. Overenskomst-grenens alignment er desuden dækket af `reguleringCoverage.test.ts`.
   - Resultat: Robusthedsrisikoen er nu test-dækket; ingen tal ændret.

2. **[Lav] `resolveEffectiveBaseEntry.usedFallback` er dead code**
   - Lokation: `loenudviklingBeregning.ts:358–365`.
   - Problem: Feltet `usedFallback` beregnes men **læses aldrig** (begge kaldssteder `:692`, `:757` bruger kun `.entry`). Præsentationens `tidligsteSatsGaelderFra` beregnes helt uafhængigt (`reguleringsPresentation.ts` via `resolveTidligsteSatsGaelderFra`). Feltet giver et falsk indtryk af, at motoren reagerer på fallbacken.
   - Handling: **Anvendt af hovedtråden** (mulighed a) — `resolveEffectiveBaseEntry` returnerer nu `T` direkte; det ubrugte `usedFallback`-felt er fjernet, og begge kaldssteder (`:698/:699/:719`, `:763/:772`) læser entry'en direkte. En kort kommentar ved funktionen forklarer nu at "før første sats"-fallbacken bevidst gates i række-laget (ikke i motoren). Tal-neutralt; bevist grønt af `loenudviklingBeregning.test.ts` (uændret). Mulighed (b) — konsolidér med præsentationens signal — overlades til punkt 14.
   - Resultat: Dead code fjernet; ingen tal ændret.

3. **[Info] `reguleringCoverage.ts` havde ingen dedikeret unit-test**
   - Lokation: `engines/reguleringCoverage.ts`.
   - Handling: **Anvendt** — ny `src/__tests__/domain/erstatningsopgoerelse/reguleringCoverage.test.ts` (9 tests). Dækker `>`-clamp inkl. grænseligning, interval-parsing og `undefined`/ukendt-id-håndtering.

## Testdækning (led 3)

- **Ny:** `reguleringCoverage.test.ts` (9 tests):
  - `resolveOverenskomstCoverageStartIso`: undefined-id → undefined; ukendt-id → undefined; tom streng → undefined; kendt id → coverage-start parset fra `interval.fraDato` og på ISO-format.
  - `resolveOverenskomstEffectiveStartIso`: ingen coverage (undefined/ukendt id) → tabel-start uændret; coverage efter tabel-start → clamper frem; coverage før tabel-start → beholder tabel-start; **coverage = tabel-start → beholder tabel-start (streng `>`, intet off-by-one)**.
  - Coverage-start udledes dynamisk fra datakilden (robust mod satstabel-ændringer).
- **Ny:** `reguleringSilentPathAlignment.test.ts` (2 tests, statistik + KRL): binder S1-fallbacken ende-til-ende — motoren producerer stille en model når reguleringsdato < første sats, OG `reguleringsvaerdi`-row-gaten fyrer `error`. Fanger fremtidig drift mellem de to uafhængige "før første sats"-beregninger (Fund 1/F2).
- Bekræftet eksisterende dækning for de øvrige fundament-symboler: `resolveAnvendtReguleringsdato`, `resolveStatistikModelId`, `isAslStatistikModel` er testet i `eoSharedUtils.test.ts`; segment-/base-motor i `loenudviklingBeregning.test.ts` (96 tests grønne samlet).

## Tilfældighedsfund

- **[Punkt 7]** `buildLoenudviklingFromManual` fail-closer ikke på undefined reguleringsdato (bruger basisrækken som niveau). Bevidst afvigelse fra de øvrige strategier; egen validering. Noteret til punkt 7.
- **[Punkt 14]** `tidligsteSatsGaelderFra` beregnes selvstændigt i præsentationen (`resolveTidligsteSatsGaelderFra`) — kandidat til konsolidering med motorens (dead) `usedFallback`-signal, jf. Fund 2(b).
- Ingen død kode ud over Fund 2, ingen fejlplacerede filer, ingen kontraktdrift fundet i fundament-stien.

## FORSLAG TIL GODKENDELSE

Ingen beregningsændring anbefales. S1 er afgjort **bekræftet korrekt (gated)** — den synlige, blokerende fejl findes i række-laget og fyrer præcis når motorens fallback ville fyre; en `throw` i motoren ville desuden bryde escape-hatchen. Der er derfor **intet** at forelægge brugeren fra punkt 1.

To rent tekniske (tal-neutrale) forslag var parkeret for at undgå konflikt med parallelle punkter i den følsomme `loenudviklingBeregning.ts`. **Begge er nu anvendt af hovedtråden** efter at de parallelle punkter (2, 3) var integreret:

- **F1 (struktur, Fund 2) — ANVENDT:** Det ubrugte `usedFallback`-felt er fjernet; `resolveEffectiveBaseEntry` returnerer `T` direkte. Tal-neutralt (gate grøn).
- **F2 (robusthed, Fund 1) — ANVENDT:** Ren test-binding via ny `reguleringSilentPathAlignment.test.ts` (motor-fallback ⟺ blokerende row-error, statistik + KRL). Ingen `throw` indført, så ingen beregningsændring og intet at forelægge.

## Sammenfatning

Det fælles fundament er korrekt, ensartet og fail-closed. `resolveAnvendtReguleringsdato` giver en veldefineret dato i alle grene og fail-closer konsekvent nedstrøms (throw i hver strategi-motor undtagen manuel, som bevidst bruger basisrækken — punkt 7). `resolveOverenskomstEffectiveStartIso/…CoverageStartIso` er korrekte (`max`-clamp, streng `>`, ingen off-by-one) og nu dedikeret test-dækket. Segment-/base-maskineriet (`buildSegmentsFromStartDates`, `findLatestByDateInSortedList`, `resolveEffectiveBaseEntry`, `buildZeroDeltaSegment`) er ensartet delt af statistik og KRL med kanonisk `halfAwayFromZero`-afrunding. **S1 er afgjort bekræftet korrekt (gated):** motorens stille fallback til ældste sats er gated af en synlig, blokerende `reguleringsvaerdi`-error i række-laget, der fyrer præcis aligned med `usedFallback`; ingen beregningsændring nødvendig. Restpunkter: `usedFallback` er dead code (F1) og den to-stedede "før første sats"-beregning bør robusthedssikres (F2) — begge tal-neutrale og parkeret for hovedtråden. Gate grøn (typecheck, typecheck:test, 96 målrettede tests inkl. 9 nye).
