# Regulering punkt 7 — Form: Manuelt angivet

**Dato:** 2026-07-03
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Manuelt angivet (daterede lønrækker → pakke-indeks). Manuel procentsats (S5) ejes af **punkt 8** og er *ikke* rørt her.
**Primært scope:**
- `engines/loenudviklingBeregning.ts:1251–1350` (`buildLoenudviklingFromManual`)
- `engines/loenudviklingBeregning.ts:199–209` (`computePackageValuePct`), `:565–585` (manuel-konsolidering), `:1637–1647` (`resolveAnvendtReguleringsdato`)
- `engines/loenudviklingBeregning.ts:296–336` (`buildSegmentsFromStartDates`, `findLatestByDateInSortedList`)
- `helpers/angivetLoenHelpers.ts` (angivet-løn-kilde)
- `domain/eoRowEvaluation/eoRowIndkomstRows.ts:310–406, 452–521` (manuel row-gate + før-basis-warning)
- `domain/eoRowEvaluation/eoRowShared.ts:151–177` (`getRangeForManualRegulering`)
**Afhængigheder læst:** `AGENTS.md`; `regulering-review-plan.md`; `regulering-5/6`-review (skabelon); `reguleringFormulaUtils.ts` (`computeFormulaValue`); invariant-noten `loenudviklingBeregning.ts:63–70`.
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run loenudviklingBeregning reguleringSilentPathAlignment` → ✅ 2 filer / 46 tests (heraf 5 nye)

## Kæde fra input til færdigt produkt

Eksempel: `Manuelt angivet`, reguleringsdato 2023-01-01, basisrække (index 0) grundløn 1000 dateret
på reguleringsdatoen, dateret række 2023-06-01 grundløn 1100. TAF 2023-01-01→2024-09-30.
Forventet: basispakke = `computePackageValuePct(basisrække)`; segment 2023-06-01 `deltaPct =
(1100/1000 − 1)×100 = 10,00`. Verificeret via ny carry-forward-test + eksisterende
Bygge-/anlæg-paritetstests (overenskomst ≡ manuelt angivet med samme satser).

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `manual`; `assertUniform` på `normalizeManualRows` (multi-af) | Uvalgt/blandet → `throw` | ✔ |
| Datakilde-opslag | `konsolideret.manualRows = active[0].loenudviklingManuelTableData` (brugerens tabel) | — (brugerinput, ikke satstabel) | ✔ |
| Reguleringsdato-forankring | kanonisk `resolveAnvendtReguleringsdato`; basisrække (index 0) = niveau pr. reguleringsdato (UI-låst dato) | Ingen dato → row-error + undefined-drop | ✔ |
| Segment/indeks/akkumulering | `datedRows = slice(1)` filtreret (dato mangler / før reg.dato) + sorteret; `buildSegmentsFromStartDates`; per segment `findLatestByDateInSortedList` (**carry-forward**); pakke `computePackageValuePct` | Interiort hul → carry-forward; før basis → basePackage (delta 0) | ✔ **carry-forward ⇒ intet interiort hul; før-basis delta 0** |
| Afrunding | `roundByMethod((pkg/basePkg−1)×100, 2, 'halfAwayFromZero')` (`:1342`) | Ad hoc/dobbelt-afrunding | ✔ (delt kanonisk helper) |
| Aggregering (af/år) | segmenter → beløb; multi-af summeres | Én af maskerer andens fejl (compute) | ✔ (compute); row-lag = punkt 13 |
| Snapshot | motor-`throw` → `fail_closed` / `runtime_exception` | Throw sluges → zero-delta | ✔ (nye fail-closed-tests: throw sluges IKKE) |
| Validator/gate | row-gate: `getRangeForManualRegulering` (`min = tidligste dato inkl. reg.dato`, `max = seneste dato + 12 mdr − 1 dag`); dato-krav på slice(1); før-basis-warning | Se Dækningsanalyse | ✔ (før-basis-warning ende-til-ende-testet) |
| Skærm/PDF/Word | fælles manuel-visning (nedstrøms) + før-basis-warning-row | Punkt 14 | (punkt 14; warning-row bekræftet i row-model) |

## Dækningsanalyse (led 2 — tavs under-regulering)

Nøgleobservation (**parallel til punkt 5/6's carry-forward-analyse**): pr. TAF-segment slår motoren
op via `findLatestByDateInSortedList(datedRows, segment.fra)` (`:1330`) — seneste daterede række
≤ segmentstart. Den returnerer `undefined` **kun** når `segment.fra` ligger før den *tidligste*
daterede række (dvs. før første reguleringstrin efter reguleringsdatoen); da bruges `basePackage`
(delta 0). Derfor:

- **Et interiort hul er umuligt.** For enhver segmentstart ≥ tidligste daterede række findes altid
  en carry-forward-række; der er ingen "gap"-dato inde i den regulerede periode, der stille falder
  tilbage til basis.
- Alle "grundlags"-rækker er brugerens eksplicit indtastede datapunkter — der er ingen tabel med
  huller at slå op i. En manglende værdi på en aktiv række gates blokerende i row-laget (se nedenfor).

### Før-basis-drop (`:1291`) — BEKRÆFTET KORREKT (bevidst, ikke tavs under-regulering)

- **Sti:** rækker i `slice(1)` dateret FØR reguleringsdatoen → `return null` (droppes fra beregningen).
- **Led:** beregningsmotoren (drop) / row-lag (ikke-blokerende **warning**).
- **Kan valid input ramme den?** Ja — en bruger indtaster en reguleringsrække med en dato før
  reguleringsdatoen.
- **Bevidst korrekt eller fejl? → BEKRÆFTET KORREKT.** Basisrækken (index 0) har UI-låst dato =
  reguleringsdatoen (`eoRowIndkomstRows.ts:336`) og repræsenterer allerede lønniveauet dér.
  Reguleringen forankrer indeks 100 på reguleringsdatoen; en række dateret *før* den er et tidligere
  lønniveau, der pr. definition ikke deltager i den fremadrettede regulering (nøjagtig samme
  domæneregel som privat/offentlig/statistik, hvor TAF-segmenter før basen sættes til zero-delta).
  Droppet taber derfor **ingen** regulering: modellen er **tal-identisk** med og uden en før-basis-
  række (ny alignment-test beviser dette). I modsætning til S1/S2/S3 er dette bevidst en
  **ikke-blokerende** tilstand — men den vises synligt for brugeren som en `warning`-row
  (`raekkerFoerReguleringsdato`, `:396–405`), nu bundet ende-til-ende i row-modellen (ny test).
- **Udfald: uændret (bekræftet korrekt).** Ingen beregningsændring.

### Manglende dato / manglende grundløn på en aktiv række — BEKRÆFTET fail-closed

- **Manglende dato på slice(1)-række:** motoren dropper stille (`if (!startIso) return null`, `:1286`).
  Gatet blokerende: `datoOk` (`eoRowIndkomstRows.ts:339–342`) kræver dato på alle aktive slice(1)-rækker
  → `alleVaerdier`-row `error`, ellers vises regulerings-detaljerne slet ikke. Ikke en tavs under-regulering.
- **Manglende/0 grundløn:** `amountValueToNumber(...) ?? 0` → pakkeværdi 0 → `!Number.isFinite || ≤ 0`
  → **throw** (basis `:1279`, segment `:1305/:1338`). Row-laget gater desuden `grundloenOk`
  (`:334`). Fail-closed begge steder.

### Grænser

- **Reguleringsdato før første daterede række:** irrelevant — basis er altid `manualRows[0]`
  (ikke en tabel-clamp). Segmenter før tidligste daterede række → `basePackage` (delta 0), korrekt.
- **Efter sidste daterede række:** carry-forward af seneste række (ikke throw, ikke nulstilling).
  Gatet af `endDate`-row: `getRangeForManualRegulering.max = seneste dato + 12 mdr − 1 dag`
  (`eoRowShared.ts:175`) med 12-mdr-grace (samme som privat overenskomst). Ejes af punkt 12/13;
  her bekræftet + testet på compute-niveau (ny carry-forward-test viser at reguleringen efter sidste
  række videreføres, ikke nulstilles).
- **Hul mellem daterede rækker:** umuligt at give tavs under-regulering (carry-forward, se ovenfor).
- **Manglende reguleringsdato:** row-gate `reguleringsvaerdi` `error` (`:465`); før-basis-warning
  springes over (`anvendtReguleringsdato &&`-guard).

### Store Bededag — korrekt håndteret

- Basis: `resolveStoreBededagPctForManualDate(reguleringsdato)` (`:1276`). Segmenter: pr. faktisk
  TAF-segments `segment.fra` i `hasStoreBededagSegmenter`-grenen (`:1331–1335`), med et syntetisk
  brudpunkt på `STORE_BEDEDAG_START` (`:1327`). Dækket af eksisterende test (`:326` negativ
  Store Bededag-regulering før 2024, og `:732` +0,45 % fra 2024).

## Fund og rettelser

1. **[Info / bekræftet] Manuelt angivet er robust by design; ingen realistisk throw-/silent-sti for valid input.**
   - Lokation: `loenudviklingBeregning.ts:1251–1350`.
   - Observation: Som privat/offentlig overenskomst (punkt 5/6) producerer manuel-formen **altid**
     et resultat for valid input. `findLatestByDateInSortedList` carry-forwarder ⇒ intet interiort
     hul; basis er altid `manualRows[0]`. De eneste "ingen regulering"-stier er (a) før-basis-drop
     (tal-neutralt, gated af synlig warning) og (b) segmenter før første daterede række (delta 0 mod
     basis, korrekt). Alle throws (`:1260/:1279/:1305/:1338/:1347`) er defensive invarianter, der
     kræver enten manglende brugerinput (gated blokerende i row-laget) eller en 0-grundløn (throw).
   - Handling: Robustheden er nu testet (carry-forward, 2× fail-closed, før-basis-neutralitet +
     warning-surfacing). Ingen kodeændring.
   - Resultat: Ingen beregningsændring.

2. **[Bekræftet korrekt] Før-basis-drop er tal-neutralt OG synligt (warning-row)** — se Dækningsanalyse.
   Ingen beregningsændring; ny alignment-test binder motorens drop-neutralitet til den synlige
   warning-row i row-modellen.

3. **[Medium — testhul, lukket] Manglende compute-tests for fail-closed og carry-forward i manuel-formen.**
   - Lokation: `src/__tests__/domain/erstatningsopgoerelse/loenudviklingBeregning.test.ts`.
   - Problem: Manuel-formen havde stærk normalsti-dækning (Bygge-/anlæg-paritet, før-basis-drop,
     præcis-på-dato, Store Bededag), men **ingen** eksplicit fail-closed-test (ugyldig basis-/segment-
     pakke → throw) og **ingen** eksplicit carry-forward-/efter-sidste-række-test.
   - Handling: Tilføjet 3 tests (se Testdækning). Ingen kodeændring.
   - Resultat: Fail-closed- og carry-forward-adfærden er nu låst.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring.** Før-basis-drop er afgjort **bekræftet korrekt** — tal-neutralt (basen
repræsenterer reguleringsdato-niveauet) og synligt (ikke-blokerende warning-row). Interiort hul er
strukturelt umuligt (carry-forward). Manglende grundløn/dato fail-closer (throw + blokerende row-gate).
Der er intet at forelægge brugeren fra punkt 7.

## Testdækning (led 3)

**Anvendt (grønne):**
- `loenudviklingBeregning.test.ts` (+3, i "Manuelt angivet i Beløb-tilstand"-blokken):
  1. **carry-forward** — tre daterede rækker + `loenPaaHelligdage: 'Ingen'`; segmenterne bruger
     seneste række ≤ segmentstart: delta 0 (basis) → 10 (mellem to rækker) → 21 (videreført forbi
     sidste række). Beviser intet interiort hul og ingen efter-sidste-nulstilling.
  2. **fail-closed basis** — basisrække grundløn 0 → `buildLoenudviklingModel` kaster
     (`/ugyldig manuel basispakke/`).
  3. **fail-closed segment** — dateret række grundløn 0 → kaster (`/ugyldig manuel pakkevaerdi/`).
- `reguleringSilentPathAlignment.test.ts` (+2, ny "manuel før-basis"-blok):
  4. **drop-neutralitet** — motor-segmenterne er identiske med og uden en før-reguleringsdato-række
     (droppet taber ingen regulering).
  5. **synlig warning** — row-modellen (`buildEoIndkomstRows`) emitterer en ikke-blokerende
     `raekkerFoerReguleringsdato`-row med status `warning` for den droppede række (før-basis-signalet
     når frem til produktet).
- Bekræftet stærk eksisterende dækning: Bygge-/anlæg-paritetstests (`loenudviklingBeregning.test.ts:824–852`,
  overenskomst ≡ manuelt angivet med samme satser, `Beregningsperiode`/`Angivet månedsløn` × beløb/procent)
  binder manuel-formen **tal-mæssigt** til overenskomst-formen (samme pakke-formel-resultat + afrunding);
  før-basis-drop (`:760`), præcis-på-reguleringsdato (`:774`), Store Bededag (`:326`, `:732`).

## Tilfældighedsfund

- **[Medium — konvergens, udskudt til punkt 15 (U5)]** `computePackageValuePct`
  (`loenudviklingBeregning.ts:199–209`, brugt af manuel **og** offentlig overenskomst) er en
  parallel kopi af den kanoniske `computeFormulaValue` (`reguleringFormulaUtils.ts:83`, brugt af
  privat overenskomst + præsentation). Samme matematik. **Afrundingen deles reelt** (kanonisk
  `roundByMethod`/`halfAwayFromZero`), og manuel-formen deler *bogstaveligt* `computePackageValuePct`
  med den offentlige overenskomst-gren — men de to formel-funktioner burde konsolideres til én.
  **Vigtig nuance:** funktionerne er *ikke* trivielt ombyttelige — `computeFormulaValue` coercer
  ikke-finite input til 0, mens `computePackageValuePct` propagerer `NaN`/`Infinity` (fanges så af
  callsite-guarden `!Number.isFinite(pkg) || pkg ≤ 0` → throw). En naiv sammenlægning ville derfor
  svække en fail-closed-sti på ikke-finit `feriePct`. For **valid** input er de tal-identiske (alle
  pct-input er finite via `parseManualPercentToPct`/`resolvePctPointFromSatsOrInput`; grundløn er
  guardet). Konsolidering (fx `computePackageValuePct` som tynd wrapper om `computeFormulaValue`
  efter finite-guard-afstemning) ejes af **punkt 15** (rører offentlig-grenen fra punkt 6 og
  præsentationen fra punkt 14). Bevidst *ikke* rettet her for at holde punkt 7 tal-neutralt og undgå
  cross-punkt-indgreb.
- **[Lav — punkt 13]** `getRangeForManualRegulering` (`eoRowShared.ts:151`) beregner row-gatens
  `min` som den *tidligste* dato blandt {reguleringsdato, alle rækkedatoer} — dvs. en før-basis-række
  trækker `min` FØR reguleringsdatoen og gør `startvaerdi`/`reguleringsvaerdi`-checkene mere
  permissive. Harmløst for tavs under-regulering (pre-basis-segmenter er legitimt zero-delta for
  ALLE former, og manuel har ingen ekstern tabel-dækning at maskere), men semantisk skævt: `min`
  burde konceptuelt være reguleringsdatoen. Notér til punkt 13's row-gate-gennemgang.
- Ingen død kode, fejlplacerede filer eller kontraktdrift i manuel-compute-stien.

## Sammenfatning

Manuelt angivet er korrekt, ensartet og deterministisk. Den deler det fælles fundament: kanonisk
`resolveAnvendtReguleringsdato`, `buildSegmentsFromStartDates`, `findLatestByDateInSortedList`
(carry-forward) og `roundByMethod`/`halfAwayFromZero`. Central konklusion — parallel til punkt 5/6:
fordi segment-opslaget carry-forwarder (seneste daterede række ≤ segmentstart), er **et interiort hul
umuligt**, og fordi basen altid er `manualRows[0]`, findes der **ingen realistisk throw-/silent-sti**
for valid input. Den eneste "ingen regulering"-sti er **før-basis-drop** — **bekræftet korrekt**:
basisrækken (UI-låst til reguleringsdatoen) repræsenterer allerede niveauet, droppet er **tal-neutralt**
(bevist), og det vises synligt som en ikke-blokerende `warning`-row (bundet ende-til-ende). Manglende
grundløn/dato fail-closer (throw + blokerende row-gate). Efter-sidste-række carry-forward er gated af
`endDate`-row (12-mdr-grace, punkt 12/13). Pakke-formlen deles bogstaveligt med offentlig overenskomst
(`computePackageValuePct`) men duplikerer `computeFormulaValue` — konsolidering udskudt til punkt 15
(U5) pga. en fail-closed-nuance på ikke-finit input. Gate grøn: typecheck, typecheck:test, lint, 46
målrettede tests (heraf 5 nye).
