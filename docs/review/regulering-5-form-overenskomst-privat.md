# Regulering punkt 5 — Form: Overenskomst — privat

**Dato:** 2026-07-02
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Overenskomst — **privat** gren (pakke-indeks fra daterede overenskomst-satser). Offentlig gren (KL/RLTN) ejes af **punkt 6** og er *ikke* rørt her.
**Primært scope:**
- `engines/loenudviklingBeregning.ts:1121–1249` (privat-grenen i `buildLoenudviklingFromOverenskomst`)
- `engines/overenskomstReguleringShared.ts` (`resolvePrivateOverenskomstBaseContext`, `buildPrivateOverenskomstFormulaComponents`)
- `engines/reguleringCoverage.ts` (`resolveOverenskomstEffectiveStartIso`)
- `data/overenskomstRates.ts:1606–1753` (`getSatserForDatoFromList`/`…ForPeriode`, `getReguleringsDatoIntervalForOverenskomst`, `getEffektiveSatserForDato/Periode`)
- `engines/reguleringFormulaUtils.ts` (`computeFormulaValue`)
**Afhængigheder læst:** `AGENTS.md`; `regulering-review-plan.md`; `regulering-0/1`-review; `domain/eoRowEvaluation/eoRowIndkomstRows.ts:417–508` (row-gate); `docs/domain/taf/`; `project_tillaeg_angives_som`, `project_regulering_audit_2026_07`.
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npx vitest run reguleringSilentPathAlignment loenudviklingBeregning reguleringCoverage` → ✅ 3 filer / 46 tests

## Kæde fra input til færdigt produkt

Eksempel: Bygge-/anlægsoverenskomst, `Angivet månedsløn`, reguleringsdato inden for dækning,
TAF-interval hen over en satsændring. Forventet: base-pakke = `computeFormulaValue` på basis-satsen;
per-segment `deltaPct = (pakke[segment]/pakke[base] − 1)×100`. Verificeret via de eksisterende
Bygge-/anlæg-paritetstests (overenskomst ≡ manuelt angivet med samme satser).

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `overenskomst`; `assertUniform` på overenskomstId/loenPaaHelligdage/ancienn./feriepct | Uvalgt/blandet → `throw` | ✔ |
| Datakilde-opslag | `getEffektiveSatserForDato/Periode` (privat); `!overenskomstRef` → `throw` (`:903`) | Model-mismatch → stille nul | ✔ |
| Reguleringsdato-forankring | `resolveOverenskomstEffectiveStartIso` = `max(reguleringsdato, dækningsstart)`; manglende dato → `throw` (`:894`) | Ingen dato → stille nul-base | ✔ (throw) |
| Segment/indeks/akkumulering | `getEffektiveSatserForPeriode` → brudpunkter; `getSatserForDatoFromList` per segment (**carry-forward**); pakke-formel `computeFormulaValue` | Interiort hul → carry-forward; før dækning → zero-delta | ✔ **carry-forward ⇒ intet interiort hul; før-dækning gated** |
| Afrunding | `roundByMethod(deltaPct, 2, 'halfAwayFromZero')` (`:1241`) | Ad hoc/dobbelt-afrunding | ✔ |
| Aggregering (af/år) | segmenter → beløb; multi-af summeres | Én af maskerer andens fejl (compute) | ✔ (compute); row-lag = punkt 13 |
| Snapshot | motor-`throw` → `fail_closed` / `runtime_exception` | Throw sluges | ✔ (men se Fund 1: ingen realistisk throw) |
| Validator/gate | row-gate: `reguleringsvaerdi.min = interval.fraDato` (dækningsstart), `endDate.max = sidste sats + 12 mdr − 1 dag` | Se Dækningsanalyse | ✔ |
| Skærm/PDF/Word | fælles overenskomst-visning (nedstrøms) | Punkt 14 | (punkt 14) |

## Dækningsanalyse (led 2 — tavs under-regulering)

Nøgleobservation om **carry-forward**: `getSatserForDatoFromList` (`overenskomstRates.ts:1606`) itererer
den (nyeste-først-sorterede) satsliste og returnerer **første sats med `fraDato ≤ dato`** — dvs. den
seneste sats ≤ dato. `undefined` returneres **kun** når datoen ligger før den **ældste** sats. Derfor:

- **Et interiort hul er umuligt.** For enhver dato ≥ ældste sats findes altid en carry-forward-sats;
  der er ingen "gap"-dato inde i den dækkede periode, hvor opslaget kan give `undefined`.
- **`!sats` ⟺ segment.fra < ældste overenskomst-sats** (før dækning). Det er den eneste `!sats`-sti.

### S2 — segment uden sats / før dækning → BEKRÆFTET KORREKT (gated)

- **Sti:** `!sats && !useStoreBededagOnlyBeforeCoverage` → `buildZeroDeltaSegment` (`:1209–1211`); og
  `segment.fra < effectiveBase.startIso && !useStoreBededagOnlyBeforeCoverage` → zero-delta (`:1214–1217`).
- **Led:** beregningsmotoren (før-dækning) / row-lag (gate).
- **Kan valid input ramme den?** Ja — reguleringsdato (fx nær en gammel stamdatadato) før overenskomstens
  første sats. `effectiveReguleringsdato = max(reguleringsdato, dækningsstart)` = dækningsstart, og
  TAF-segmenter før dækningsstart → zero-delta.
- **Bevidst korrekt eller fejl? → BEKRÆFTET KORREKT (gated).** Præcis analog til S1 (punkt 1):
  row-gatens nedre grænse `reguleringsRange.min = parseDanishToIso(interval.fraDato)`
  (`eoRowIndkomstRows.ts:419–424`), og `interval.fraDato = aeldste overenskomst-sats`
  (`getReguleringsDatoIntervalForOverenskomst:1701–1709` → `satser[satser.length-1].fraDato`) er
  **identisk** med motorens `effectiveBase.startIso` (dækningsstart). Row-error (`:472`) fyrer derfor
  aligned med motorens zero-delta-før-dækning; ingen ugated mellemzone. Under escape-hatchen
  (`allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden`, punkt 13) nedgraderes error → warning,
  og zero-delta-før-dækning er da den tilsigtede semantik. **Nu bundet ende-til-ende** af en ny test
  (`reguleringSilentPathAlignment.test.ts`, S2-blok).
- **Udfald: uændret (bekræftet korrekt).** Ingen beregningsændring.

### S6-endepunkt — efter sidste sats → carry-forward inden for dæknings-vindue (ejes af punkt 12/13)

- **Sti:** for datoer efter nyeste sats videreføres nyeste sats (carry-forward). deltaPct er da den
  sidst kendte regulering, ikke nul.
- **Bevidst korrekt eller fejl?** Bevidst inden for dæknings-vinduet: row-gatens øvre grænse
  `reguleringsRange.max = nyeste sats + 12 mdr − 1 dag`. Rækker TAF-perioden ud over `max`, fail-closer
  `endDate`-row-gaten. Ejes af punkt 12/13; her bekræftet + test-dokumenteret på compute-niveau (motoren
  kaster aldrig, den carry-forwarder).
- **Udfald: uændret** (ejerskab i punkt 12/13).

### Øvrige exit-stier (alle fail-closed eller bevidst gated zero-delta)

- `!overenskomstRef` → `throw` (`:903`); manglende/ugyldig reguleringsdato → `throw` (`:894/:907`).
- `resolvePrivateOverenskomstBaseContext` null ELLER base-grundløn ikke et tal → `throw`
  "basissats mangler" (`:1133–1135`); ikke-positiv basisgrundløn → `throw` (`:1136`); basispakke ≤ 0
  → `throw` (`:1150`).
- Per segment: ugyldigt interval/dato → `throw` (`:1162/:1196`); `effectiveSats.grundloen` ikke et tal
  → `throw` (`:1219`); ikke-positiv segmentgrundløn → `throw` (`:1221`); pakkeværdi ≤ 0 → `throw` (`:1236`).
- Store Bededag-før-dækning: `useStoreBededagOnlyBeforeCoverage` bruger `effectiveBase.sats` som proxy
  (`pctBasisRole: 'reference'`) for **kun** at materialisere Store Bededag-reguleringen fra 01-01-2024 —
  bevidst og afgrænset (`:1205–1233`).

## Fund og rettelser

1. **[Info / afkræftet plan-antagelse] Privat overenskomst har INGEN realistisk `runtime_exception`-sti**
   - Lokation: `loenudviklingBeregning.ts:1121–1249` + `overenskomstReguleringShared.ts:57–80`.
   - Observation: Planens testhul #5 antog "manglende overenskomst-sats → `computeEoSnapshot`
     `runtime_exception`". Kæde-gennemgangen viser at det **ikke** kan ske for privat overenskomst med
     valid input: basen opløses altid (fallback til overenskomstens **første** sats, hvis
     reguleringsdatoen ligger før dækning), og `getSatserForDatoFromList` carry-forwarder — så alle
     throw-stier kræver en **datafejl** (tom overenskomst / `grundloen: null`), som ikke findes i
     produktionsdata (bekræftet: intet `grundloen: null` i `src/data`). Privat overenskomst producerer
     dermed **altid** et resultat; den eneste "ingen regulering"-sti (før dækning) er gated zero-delta
     (S2), ikke en throw. **Den forventede `runtime_exception`-sti tilhører den OFFENTLIGE gren (punkt 6),
     hvor `getOffentligLoenForDato` kaster ved manglende løntrin.**
   - Handling: **Testhul #5 omdefineret** (ikke lukket med en kunstig throw). Den reelle trust-binding
     for privat overenskomst er **før-dækning → synlig blokerende row-error**, som nu er dækket
     ende-til-ende (motor-zero-delta ⟺ row-error) i `reguleringSilentPathAlignment.test.ts` (S2-blok).
     Den generiske `runtime_exception`-indpakning er fortsat dækket af `eoSnapshotRuntimeException.test.ts`.
     Planens testhul-liste og silent-path-katalog opdateret.
   - Resultat: Robusthedsegenskaben er dokumenteret og testet; ingen kunstig/fladtrykt test tilføjet.

2. **[Bekræftet korrekt] S2 før-dækning zero-delta er gated (analog til S1)** — se Dækningsanalyse.
   Ingen beregningsændring; ny alignment-test binder motoren til row-gaten.

## Testdækning (led 3)

**Anvendt (grønne):**
- `reguleringSilentPathAlignment.test.ts` (+1, ny S2-blok): privat overenskomst (Bygge-/anlæg),
  reguleringsdato **før dækning** → motoren producerer stille **kun** zero-delta-segmenter (ingen throw)
  OG `reguleringsvaerdi`-row-gaten fyrer `error`. Binder den to-stedede "før dækning"-beregning, så
  fremtidig drift mellem motorens `effectiveBase.startIso` og row-gatens `interval.fraDato` fanges.
- `loenudviklingBeregning.test.ts` (+1, robusthed): privat overenskomst, TAF-periode **ud over sidste
  sats** → carry-forward uden throw (ingen tavs `runtime_exception`); reguleringen er reel (`deltaPct > 0`
  inden for dækning) og videreføres. Dokumenterer Fund 1.
- Bekræftet stærk eksisterende dækning: Bygge-/anlæg-paritetstests (`loenudviklingBeregning.test.ts:679–745`,
  overenskomst ≡ manuelt angivet med samme satser, både `Beregningsperiode`/`Angivet månedsløn` og
  procent/beløb) dækker normalsti + multi-segment + tillæg. `reguleringCoverage.test.ts` dækker
  `resolveOverenskomstEffectiveStartIso` (`max`-clamp, streng `>`, intet off-by-one).

## Tilfældighedsfund

- **[Punkt 6]** Den forventede overenskomst-`runtime_exception`-sti (manglende løntrin/basissats) ligger i
  den **offentlige** gren (`getOffentligLoenForDato`, `resolveOffentligEffectiveBase:963–985`). Bør bindes
  ende-til-ende dér.
- **[Punkt 12/13]** Overenskomstens øvre dæknings-grænse (`endDate`-gate, `nyeste sats + 12 mdr − 1 dag`)
  og escape-hatchens semantik verificeres i deres punkter; her kun bekræftet på compute-niveau (motoren
  carry-forwarder, kaster ikke).
- Ingen død kode, fejlplacerede filer eller kontraktdrift i privat-overenskomst-stien.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring.** S2 er afgjort **bekræftet korrekt (gated)** — den stille zero-delta-før-dækning
fyrer aligned med en synlig, blokerende row-error (analog til S1), og et interiort hul er strukturelt umuligt
(carry-forward). Der er intet at forelægge brugeren fra punkt 5. Fund 1 er en dokumenteret afkræftelse af en
plan-antagelse (ingen kode-/tal-effekt).

## Sammenfatning

Privat-overenskomst-grenen er korrekt, ensartet (deler segment-/base-maskineriet fra punkt 1 og
`computeFormulaValue`/`buildPrivateOverenskomstFormulaComponents`) og deterministisk (`halfAwayFromZero`).
Den centrale konklusion: fordi `getSatserForDatoFromList` **carry-forwarder** (seneste sats ≤ dato) og basen
altid falder tilbage til overenskomstens første sats, er **et interiort hul umuligt** og der findes **ingen
realistisk throw-/`runtime_exception`-sti** for valid input — grenen producerer altid et resultat. Den eneste
"ingen regulering"-sti er **zero-delta før dækning (S2)**, som er **bekræftet korrekt og gated**: row-gatens
`reguleringsvaerdi.min` = overenskomstens ældste sats = motorens `effectiveBase.startIso`, så den stille
zero-delta fyrer altid aligned med en synlig blokerende fejl (nu bundet ende-til-ende af en ny alignment-test).
Efter-sidste-sats carry-forward er gated af `endDate`-row (punkt 12/13). Planens testhul #5 (manglende
overenskomst-sats → `runtime_exception`) er **omdefineret**: den antagelse holder ikke for privat overenskomst
(robust by design) og hører hjemme i den offentlige gren (punkt 6). Gate grøn: typecheck, typecheck:test, 46
målrettede tests (heraf 2 nye).
</content>
