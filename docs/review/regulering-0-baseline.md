# Regulering punkt 0 — Baseline og reguleringskort

**Dato:** 2026-07-02
**Status:** ✅ Gennemgået
**Reguleringsform(er):** alle (kortlægning, ingen enkelt form)
**Primært scope:** `enumSchemas.ts` (form-enum), trigger-kæden (`resolveReguleringsStrategi` → dispatch i `buildLoenudviklingModel`), samt komplet inventar over regulerings-relevante filer i `domain/`, `data/`, `config/`, `document/`, `validators/`, `schemas/` og tests.
**Afhængigheder læst:** `AGENTS.md`, `regulering-review-plan.md`, `loenudviklingBeregning.ts` (nøgleafsnit), `klLoenaftalerReguleretLoen.ts`, `manuelProcentsatsRegulering.ts`, `offentligeYdelserUdviklingBeregning.ts`, `reguleringCoverage.ts`, `lovbestemteRates.ts` (`getSatserForYear`).
**Tests kørt:** se Baseline nedenfor.

Formål (jf. plan): kendt udgangspunkt og komplet overblik før ændringer. Punkt 0 ændrer **ikke** beregningslogik og lukker ingen silent-path — det etablerer den verificerede baseline og det kort, de øvrige punkter arbejder ud fra. Rene doc-drift-rettelser i selve planen er udført (se Tilfældighedsfund).

## Baseline (arbejdstræ + gate)

| Tjek | Kommando | Resultat |
|---|---|---|
| Arbejdstræ | `git status --short` | Kun review-doc-ændringer: `D docs/review/debug-review-plan.md`, `M docs/review/regulering-review-plan.md`. Ingen uncommittede kildeændringer. |
| Typecheck (kilde) | `npm run typecheck` | ✅ exit 0 |
| Typecheck (tests) | `npm run typecheck:test` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 |
| Målrettet regulering-test | `npx vitest run` over 24 regulering-testfiler | ✅ 24 filer / 434 tests pass (4,0 s) |

Regulering-testfiler i baseline (24): `loenudviklingBeregning`, `manuelProcentsatsRegulering`, `reguleringFormulaUtils`, `reguleringsPresentation`, `tafPerYearOpreguleretDerived`, `loenudviklingManuelBaseRowValidation`, `eoPdfLoenudvikling`, `opreguleringsmotorer`, `aslAarsloensmaksimum`, `eetReguleringRater`, `eoRowIndkomstRows.reguleringsCoverage`, `eoRowIndkomstRows.reguleringVisibility`, `data/klLoenaftaler`, `data/KRLrates`, `data/overenskomstRates`, `eoInspektionRegulationCore`, `eoInspektionRegulationViewModel`, `docx/reguleringWordContent`, `docx/klLoenaftalerWordContent`, `docx/krlWordContent`, `docx/tafOpreguleretPaaAarWordContent`, `pdf/reguleringSection`, `pdf/klLoenaftalerPdf.tableLayout`, `pdf/tafOpreguleretPaaAarPdf.wiring`.

## Reguleringskort — enum → punkt (dækning verificeret)

`loenudviklingBeregningsgrundlagEnum` (`enumSchemas.ts:63`) har 7 værdier. Hver værdi har mindst ét primært punkt; de to former med en reel sub-dimension er delt langs den (ikke duplikeret ejerskab). Ingen enum-værdi er udækket, og intet punkt er forældreløst.

| Enum-værdi | Strategi-nøgle | Primært punkt | Split-akse |
|---|---|---|---|
| `Ingen` | `ingen` | 2 | — |
| `Statistik` | `statistik` | 3 (ILON12/SBLON2) + 4 (ASL) | `loenudviklingStatistikModelEnum` (ASL vs. DST-kvartalsindeks) |
| `Overenskomst` | `overenskomst` | 5 (privat) + 6 (offentlig KL/RLTN) | privat- vs. offentlig-gren (`getOffentligOverenskomstTypeById`) |
| `Manuelt angivet` | `manual` | 7 | — |
| `Manuel procentsats` | `manualProcentsats` | 8 | — |
| `KRL satstabel` | `krl` | 9 | — |
| `KL-lønaftaler` | `klLoenaftaler` | 10 | — |

Familie 2 (år-til-år opregulering) → punkt 11. Tværgående: datakomplethed 12, coverage-gate/validator 13, præsentation/output 14, testkonvergens 15.

## Trigger-kæde (brugerinput → valgt strategi → dispatch)

Alle linjer er de **faktiske** aktuelle linjer (planens `~`-referencer var stedvis drevet, se Tilfældighedsfund).

1. **Rækker:** `resolveLoenudviklingRows` → `resolveLoenudviklingKilde(values)` giver de aktive ansættelsesforhold (`loenudviklingBeregning.ts:72`).
2. **Alle-`Ingen`-genvej:** `resolveReguleringsStrategi` (`:368`) → `alleIngen` (`:380`) returnerer `strategi: 'ingen'`. Tom/uvalgt (`active.length === 0`) → `throw 'Loenudviklingsstrategi er ikke valgt'` (`:385`) — fail-closed, ikke stiltiende nul (ejes af punkt 2).
3. **Uniformitet (multi-ansættelse):** `assertUniform` (`:271`) kaster `InkonsistenteLoenudviklingsIndstillingerError` (`:281`, invariant dækket af validator). Kaldsteder i `resolveReguleringsStrategi`: `beregningsgrundlag` `:390`, `statistikmodel` `:413`, overenskomst-felter `:415–453`, `manuelle reguleringsraekker` `:456`, `feriepct` `:459`, `manuelle procentsatsraekker` `:467`, `KRL satstabel` `:469`.
4. **Strategi-mapping:** `:396–403` mapper enum → `LoenudviklingStrategi`.
5. **Reguleringsdato:** `resolveAnvendtReguleringsdato` (`loenudviklingBeregning.ts:1632`, delegerer til `eoSharedUtils.ts:142`).
6. **Dispatch:** `buildLoenudviklingModel` (`:1347`) → `buildFromStrategiAndBase` → switch `:1385–1391`: `statistik→buildLoenudviklingFromStatistik(:630)`, `overenskomst→…FromOverenskomst(:882)`, `manual→…FromManual(:1246)`, `manualProcentsats→…FromManualProcentsats(:799)`, `krl→…FromKRL(:729)`, `klLoenaftaler→…FromKlLoenaftaler(:840)`. KL-override af `deltaPct`/`reguleretLoenOre` `:1404–1419`.

**Multi-ansættelse — kritisk observation for punkt 13:** trigger-kæden har **to indgange** til dispatch:
- `beregnesUdFra === 'Beregningsperiode'` → `buildPerAnsaettelseModel` (`:1478`). Her kaldes `resolveReguleringsStrategi` **pr. ansættelsesforhold** med et **ét-element** array (`:1484–1487`), så `assertUniform` returnerer tidligt (`active.length <= 1`) — **cross-ansættelse-uniformitet håndhæves ikke i denne gren**. Hver af beregnes uafhængigt; totalen summeres (`:1580`), og hvis én afs `loenudviklingTotal.status !== 'ok'` kaster reduce (`:1582`) → hele modellen fail-closer. Dvs. på **compute-niveau** maskerer én afs succes ikke en andens hårde fejl. Masking-spørgsmålet lever i stedet i row-/validator-laget (punkt 13).
- Angivet løn (`:1604`) → `resolveReguleringsStrategi` med **alle** aktive ansættelser → `assertUniform` håndhæves fuldt (fælles basisløn kræver ensartet strategi).

Denne asymmetri er ikke i sig selv en fejl (per-employer-regulering med hver sin overenskomst er meningsfuld), men den er en forudsætning punkt 13 skal teste eksplicit imod (aggregeret status-masking i row-laget).

## Dækningsanalyse (led 2 — silent-path-kataloget bekræftet mod kode)

Alle syv poster er verificeret mod den faktiske kode. **Punkt 0 afgør dem ikke** (bevidst korrekt vs. fail-close er den enkelte forms punkt); her bekræftes blot at stien findes som beskrevet, med korrigerede linjer.

| # | Bekræftet lokation | Verifikation | Ejes af |
|---|---|---|---|
| S1 | `resolveEffectiveBaseEntry:353–366`; statistik-brug `:692`, KRL-brug `:757` | ✔ Bekræftet: `usedFallback` returneres men **læses aldrig** i compute (kun `.entry` bruges). Segmenter før `effectiveBaseStartIso` → `buildZeroDeltaSegment` (`:708–710`, `:777–779`). Kun præsentationen viser `tidligsteSatsGaelderFra`. | 1 (+3, 9) |
| S2 | Privat overenskomst `:1204–1206`, `:1209–1211` | ✔ Bekræftet: `!sats && !useStoreBededagOnlyBeforeCoverage` → zero-delta; `segment.fra < effectiveBase.startIso` → zero-delta. `getEffektiveSatserForDato` viderefører normalt sidste sats. | 5 |
| S3 | Offentlig overenskomst `:1075–1077` | ✔ Bekræftet: `!effectiveSegmentResult || (før base && !fallback)` → zero-delta. Manglende løntrin *inden for* dækning → throw i `getOffentligLoenForDato`. | 6 |
| S4 | `klLoenaftalerReguleretLoen.ts:64` | ✔ Bekræftet: `if (pct === undefined) continue;` springer trin. (Planens `:63–64` peger reelt på to `continue`: `:62` = før-reguleringsdato, `:64` = manglende pct.) | 10 |
| S5 | `manuelProcentsatsRegulering.ts:57–59` | ✔ Bekræftet: `.filter(... isFinitePct(entry.row.procent))` dropper uparsbar/ikke-finit pct stille. (Planens `:56–59` er tæt på; faktisk 54–59.) | 8 (+13) |
| S6 | `findLatestByDateInSortedList:326` (ingen øvre grænse) | ✔ Bekræftet strukturelt: funktionen returnerer seneste entry ≤ dato uden øvre-grænse-gate; carry-forward er iboende for alle kilder der bruger den. Øvre-grænse-gate ligger i validatoren, ikke i motoren. | 12 (+3, 9, 10) |
| S7 | `lovbestemteRates.ts:858` | ✔ Bekræftet fail-open (`null`/`''`). Forbrugere: `Satser.tsx`, `satserDocument.ts`, `documentService.ts`, tests — **ingen** i reguleringsberegningsstien. Ren display. | 12 (verificér-kun) |

**Yderligere silent-path-observationer (nye, noteret her — ejes af det angivne punkt):**
- **S8 (kandidat, punkt 11):** `offentligeYdelserUdviklingBeregning.ts` har to per-år-satsopslag: motor-kaldet `resolveOffentligeYdelserAkkumuleretReguleringPct` (`:32`, delegerer til `opregulerMedAkkumuleretReguleringssats` `:38–41`) **og** et råt `reguleringssats[year]`-loop i `buildOffentligeYdelserReguleringTableData` (`:99–103`). Begge kaster ved manglende sats, så fail-closed-**adfærden** er i dag ens — men det er duplikeret satsopslag der bør konsolideres til motoren (planens punkt 11 nævner dette).
- **Uniformitets-asymmetri (punkt 13):** se trigger-kæde ovenfor — `Beregningsperiode`-grenen håndhæver ikke cross-af-uniformitet.

## Fund og rettelser

1. **[Lav] Planens dispatch-linjereference drevet**
   - Lokation: `regulering-review-plan.md` domæne-landkort (`buildLoenudviklingModel ~:1385`).
   - Problem: dispatch-funktionen starter på `:1347`; `:1385–1391` er selve switch-blokken. Rettet i planen.
   - Resultat: linjereference opdateret til `:1347` med switch-note.

2. **[Lav] Planens "fire getReguleringsDatoIntervalFor… med +6 måneder − 1 dag" er unøjagtig**
   - Lokation: `regulering-review-plan.md` punkt 12 (`:548`) og punkt 15 (`:607`).
   - Problem: der er **5** navngivne funktioner, ikke 4. Kun **3** kopierer `+6 mdr − 1 dag`-aritmetikken (`krlRates.ts:197`, `klLoenaftaler.ts:139`, `offentligLoenLookup.ts:289`, alle via `getInclusivePeriodEndByMonths(…,6)`); `getReguleringsDatoIntervalForStatistikModel` (`statistiskeRates.ts:221`) bruger `+12 mdr − 1 dag` for ILON/SBLON og år-grænser for ASL; `getReguleringsDatoIntervalForOverenskomst` (`overenskomstRates.ts:1686`) **delegerer** til offentlig-varianten. Rettet i planen, så konsolideringsmålet i punkt 12/15 er præcist (konsolidér de 3 `+6 mdr`-kopier mod `getInclusivePeriodEndByMonths`; behandl statistik-varianten som egen sats).
   - Resultat: begge plan-afsnit korrigeret.

Ingen kodeændringer i punkt 0.

## Testdækning (led 3)

Punkt 0 tilføjer ingen tests (baseline/kortlægning). Bekræftede testhuller, videreført til deres punkter:
- `reguleringCoverage.ts` (`resolveOverenskomstEffectiveStartIso`, `resolveOverenskomstCoverageStartIso`) har **ingen** dedikeret unit-test (bekræftet: intet testimport af symbolet) → punkt 1.
- Hul-midt-i-serie for statistik/KRL → punkt 3, 9.
- KL missing-rate/efter-sidste-sats fail-closed → punkt 10.
- Ende-til-ende manglende overenskomst-sats → `runtime_exception` → punkt 5.
- Multi-af partiel dækning i coverage-gate → punkt 13.

## Tilfældighedsfund

- **Plan-doc-drift (rettet):** de to fund ovenfor (dispatch-linje; `getReguleringsDatoIntervalFor`-antal/aritmetik). Rene doc-rettelser i planen, som jeg ejer.
- **Duplikeret satsopslag (noteret, ikke rettet):** `offentligeYdelserUdviklingBeregning.ts` motor vs. råt `reguleringssats[year]`-loop — ejes af punkt 11.
- Ingen død kode, fejlplacerede filer eller kontraktdrift fundet i reguleringsberegningsstien under kortlægningen.

## Sammenfatning

Baseline er grøn på alle fire gate-tjek + 434 målrettede regulering-tests. Trigger-kæden fra brugerinput til strategi-dispatch er fuldt kortlagt inkl. `assertUniform`-invarianterne og den vigtige multi-ansættelse-asymmetri mellem `Beregningsperiode`- og angivet-løn-grenene. Alle 7 enum-former er dækket af præcis ét primært punkt (to former delt langs en reel sub-akse). Silent-path-kataloget S1–S7 er bekræftet mod den faktiske kode med korrigerede linjer, plus to nye observationer (S8-kandidat i offentlige ydelser; uniformitets-asymmetri). To doc-drift-fund i selve planen er rettet. Punktet er klar; punkt 1 (Fælles fundament) kan begynde.
