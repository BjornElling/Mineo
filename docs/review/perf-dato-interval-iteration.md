# Målrettet indsats: dato-/interval-bygning og per-dag-beregning (performance)

**Dato:** 2026-06-01
**Anledning:** Fund i [5.3-sh-dage.md](5.3-sh-dage.md) (materialiser-så-filtrer) + brugerens tidligere
sygeferiegodtgørelse-problem (genberegning af hele datasættet pr. dag). Mål: finde ALLE steder der
bygger datoer/datointervaller eller beregner per-dag unødigt stort/dyrt, og rette dem adfærdsbevarende.

**Mandat (bekræftet af bruger):** Ret alt der er bevisbart byte-identisk (også beregnings-nære
hotspots, låst med ækvivalens-tests). Konsolidér de mange håndskrevne dag-løkker til én kanonisk
primitiv. Brugeren committer til sidst.

## Opfølgende subagent-review og rettelser

To read-only subagents gennemgik indsatsen efterfølgende:

- **A (kvalitet/regressionsrisiko):** pegede især på, at rå månedsfraktioner ikke måtte ændres uden
  fuld bevisførelse. Fuld test bekræftede, at den nuværende kanoniske gruppering pr. måned er det
  forventede resultatgrundlag, så den er bevaret. `sumMaanedsbroekForInterval` er fortsat fælles
  helper, men kommentaren er strammet, og den overflødige `};;` er fjernet.
- **B (omfang):** fandt tre reelle udvidelser af indsatsen, som nu er rettet:
  `buildShDageSetFromIsoRange` delegerer direkte til den O(år)-baserede SH-helper; offentlige
  ydelser bygger periodiseringsgrundlaget én gang pr. række og genbruger det for alle ranges; SFGG
  repræsenterer sygelønsudelukkelser som ranges i stedet for først at materialisere alle datoer.

Derudover er debug-lagets parallelle månedslogik erstattet med den kanoniske månedshelper, og
håndskrevne dag-for-dag-løkker i debug/TAF-hjælpere er flyttet til `iterateDatesInclusive` med
tidlig stop-understøttelse. Kontrakten præciserer nu, at perioder der springer år/halvår/satsperioder
ikke er dag-for-dag-iteration.

**Filer ændret:**
- `src/utils/isoDateHelpers.ts` — nye kanoniske primitiver
- `src/contracts/date-contract.md` — ny sektion "Kanonisk dag-iteration og materialisering"
- `src/domain/erstatningsopgoerelse/engines/periodiseringsMotor.ts`
- `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts`
- `src/domain/erstatningsopgoerelse/engines/tafDaySets.ts`
- `src/domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning.ts`
- `src/domain/erstatningsopgoerelse/engines/ferieCalculations.ts`
- `src/domain/erstatningsopgoerelse/engines/arbejdsdageMaaneder.ts`
- `src/domain/debug/eoDebugDateUtils.ts`, `src/domain/debug/eoDebugIntegrity.ts`
- `src/utils/periodeBeregning.ts`
- Tests: `src/__tests__/utils/isoDateHelpers.test.ts`, `src/__tests__/domain/erstatningsopgoerelse/periodiseringsMotor.test.ts`

## Kortlægning (fan-out)

Fire parallelle Explore-agenter kortlagde alle dag-for-dag-løkker, interval-materialiseringer og
per-dag-beregninger i: dato-utils, EO-motoren, regulering/løn-udvikling, renteberegning, varige mén,
forsørgertab, sygeferiegodtgørelse og debug-laget. Konklusionerne nedenfor er mine egne efter at have
læst den faktiske kode (agenternes linjenumre var stedvis forældede).

## Fund og rettelser

1. **Kritisk (kvadratisk genberegning) — `loenudviklingBeregning.ts` byggede hele arbejdsdage-sættet pr. range.**
   I "Ingen"-grenen (`buildPerAnsaettelseModel`) blev `countTafArbejdsdageInRange(buildTafArbejdsdageSet(values, tafRanges), …)`
   kaldt **inde i** `tafRanges.map(...)`. `buildTafArbejdsdageSet` itererer selv alle ranges og
   materialiserer hele arbejdsdage-sættet → samlet O(ranges² × dage). Argumenterne er loop-invariante.
   Dette er præcis samme klasse af "genberegn hele datasættet pr. iteration" som brugerens gamle
   sygeferiegodtgørelse-problem.
   **✅ Rettet** — sættet bygges ÉN gang før `.map` (kun når enhed = arbejdsdage; ellers `null`).
   Adfærdsbevarende (samme tal, samme rækkefølge). Verificeret via eksisterende loenudvikling-suite.

2. **Lav (materialiser-for-at-tælle) — `eoDebugIntegrity.ts` byggede dag-array kun for `.length`.**
   To steder (`checkTafDaysMismatch`, svie/smerte-tjek) kaldte `getIsoRange(fra, til).length` for at
   få forventet dag-antal — O(dage) array-allokering for et tal der fås O(1).
   **✅ Rettet** — ny lokal `countDagesInclusive` via `countInclusiveUtcDays`. (Det tredje `getIsoRange`-kald
   i `checkDateHoles` itererer faktisk arrayet og er bevaret.)

3. **Lav (parallel implementering + spildt materialisering) — indkomst-på-skadestidspunkt-mellemregning.**
   `indkomstSkadestidspunktBeregning.ts` byggede et `Set` af alle dage og summerede `1/dage-i-måned`
   pr. dag i en lokal `beregnMaanederForDage` — en tredje kopi af "antal måneder ud fra dage", parallelt
   med `optaelMaanederPraecis`.
   **✅ Rettet** — ny kanonisk `sumMaanedsbroekForInterval` i periodiseringsmotoren; både
   `optaelMaanederPraecis` og indkomst-mellemregningen kalder den. Ingen materialiseret dag-Set mere.
   Adfærdsbevarende: den kanoniske helper grupperer pr. måned (Σ count/x) mens den gamle inline-form
   summerede 1/x pr. dag; summerne kan afvige i sidste ULP, men er **byte-identiske efter den
   2-decimal-afrunding begge kaldere anvender** — bevist empirisk (26.598 intervaller, 0 afvigelser) og
   låst med en ækvivalens-test i `periodiseringsMotor.test.ts`.

4. **Konvergens — én kanonisk dag-iterations-primitiv.**
   Domænet havde ~8 håndskrevne `while (current <= end) { …; setUTCDate/addDays }`-løkker plus tre
   konkurrerende materialiserere (`buildDatoSetInclusiveFromDates`, `getIsoRange`, inline-løkker).
   **✅ Rettet** — `iterateDatesInclusive` er nu den eneste dag-løkke. Tilføjet afledte helpers
   `iterateIsoDatesInclusive`, `collectIsoDatesInclusive`, `buildIsoDateSetInclusive` (alle udtrykt via
   primitiven). Følgende er omskrevet til at bruge dem, uden adfærdsændring:
   - `periodiseringsMotor`: `periodiserBeloebForArbejdsdage`, `periodiserBeloebForOffentligYdelse`
     (begge løkker), `buildSygedagpengeArbejdsdagePrKalenderuge`, `optaelMaanederPraecis` (via
     `sumMaanedsbroekForInterval`). Fjernede samtidig per-iteration `new Date()`-allokeringer.
   - `tafDaySets`: `buildDatoSetInclusiveFromDates`, `buildFerieDageSet`.
   - `ferieCalculations`, `arbejdsdageMaaneder`, `periodeBeregning` (3 løkker).
   - `eoDebugDateUtils.getIsoRange` delegerer nu til `collectIsoDatesInclusive`.

5. **Kontrakt — date-contract udvidet.**
   Ny sektion "Kanonisk dag-iteration og materialisering" + review-tjekliste-punkter: forbyder nye
   håndskrevne dag-løkker, forbyder materialisering for at tælle, kræver at loop-invariant arbejde
   hejses ud. (Berører ikke UI/UX eller beregningslogik → koderelateret kontraktbeslutning, jf. AGENTS.)

## Tilfældighedsfund

6. **Undersøgt — `countTafArbejdsdageInRange` scanner hele sættet pr. segment (O(sæt × segmenter)).**
   Kaldt i segment-løkker i `loenudviklingBeregning`, `offentligeYdelserUdviklingBeregning` og
   `tafPerYearDerived`. Modsat fund 1 genberegnes sættet IKKE — det er præbygget og kun scannet.
   Segmenter stammer fra regulerings-brudpunkter (få pr. år), så realistisk størrelse er beskeden
   (~1.250 dage × ~10 segmenter). En amortiseret tæller (sorteret array + binær søgning) ville kræve
   at trådes gennem alle kaldsteder og give marginal gevinst.
   **⏭ Ikke ændret** — bevidst, jf. AGENTS "lav ikke ændringer for ændringernes skyld" og
   "favorisér forenkling". Noteret her så fremtidige reviewere ikke fejl-refaktorerer det.

7. **Bekræftet OK (allerede optimeret) — sygeferiegodtgørelse.**
   Brugerens gamle "genberegn alt pr. dag"-problem er løst via `buildEmploymentSfggCalculator`
   (præ-analyse + per-dato-memoisering). Ingen O(dage²)/O(dage × datasæt) tilbage. Ikke ændret.

8. **Bekræftet OK — renteberegning, forsørgertab, varige mén.**
   Renteberegning chunker pr. halvår/år (ikke pr. dag) og slår rente op pr. periode.
   Forsørgertab itererer pr. kalenderår med O(1) sats-opslag. Varige mén er O(1)-opslag. Ingen ændring.

## Verifikation

- `npm run typecheck`, `npm run typecheck:test`, `npm run lint` → rene.
- Fuld suite: 4624 tests grønne (369 filer).
- Ækvivalens-/karakteriserings-låse (så de adfærdsbevarende antagelser ikke kan drive):
  - `sumMaanedsbroekForInterval` mod den gamle "Σ 1/dage-i-måned"-form efter 2-decimal-afrunding
    (26k+ intervaller).
  - `buildSHDageSetForIsoRange` mod materialiser-reference for ALLE år 1900–2100 + helligdagsgrænser.
  - Kanoniske primitiver: `iterate/collect/buildSet` + tidlig-stop (`false` fra callback).
  - `periodiserBeloebForOffentligYdelseMedGrundlag` mod den direkte (iterende) form for både
    `arbejdsdage` og `kalenderdage`-hurtigstien; `countOffentligYdelsePeriodiseringsdage(kalenderdage)`
    mod inklusiv dag-tælling.
  - `mergeIsoDateRanges({mergeAdjacent:true})` ≡ materialisér-sortér-resegmentér (300-iterations
    property-test) — låser SFGG's `buildIncomeExcludedRanges`-refaktorering.

## Sammenfatning

- Den reelle "genberegn hele datasættet pr. iteration"-fejl (fund 1) er rettet — samme klasse som
  brugerens gamle sygeferiegodtgørelse-problem, nu elimineret i løn-udviklings-grenen.
- Alle dag-løkker er konvergeret til én kanonisk primitiv med afledte ISO-helpers; ~8 dublerede løkker
  og 3 konkurrerende materialiserere er væk.
- To spildte materialiseringer (debug `.length`, indkomst-dag-Set) fjernet; en tredje parallel
  måneds-implementering konsolideret og låst med ækvivalens-test.
- Alle ændringer er adfærdsbevarende (ingen ændrede tal); de beregnings-nære er bevist byte-identiske.
- date-contract opdateret så reglerne håndhæves fremover.
