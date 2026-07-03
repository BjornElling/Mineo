# Regulering punkt 6 — Form: Overenskomst — offentlig (KL/RLTN)

**Dato:** 2026-07-03
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Overenskomst — **offentlig** gren (KL/RLTN løntrin-tabeller). Privat gren ejes af **punkt 5** og er *ikke* rørt her.
**Primært scope:**
- `engines/loenudviklingBeregning.ts:947–1119` (offentlig-grenen i `buildLoenudviklingFromOverenskomst`)
- `engines/loenudviklingBeregning.ts:234–269` (`resolveOffentligLoenSelection` — compute-varianten)
- `data/offentligLoenLookup.ts` (`getOffentligLoenForDato`, `getOffentligLoenForPeriode`, `getReguleringsDatoIntervalForOffentligLoen`)
- `data/offentligLoenTypes.ts` (`toLoentrin`, `resolveOffentligLoenTypeFromLabel`, `Loentrin`/`Loengruppe`)
- `data/KL/klLoenSatser.ts`, `data/RLTN/rltnLoenSatser.ts` (satsdata)
- `data/overenskomstRates.ts:132–151` (`OFFENTLIG_REGULERING_MIN_DATO`, `assertOffentligReguleringsDatoGyldig`), `:1570–1599` (offentlig tillægssatser), `:1686–1710` (`getReguleringsDatoIntervalForOverenskomst`-delegation)
- `engines/reguleringCoverage.ts` (`resolveOverenskomstCoverageStartIso`/`…EffectiveStartIso`)
**Afhængigheder læst:** `AGENTS.md`; `regulering-review-plan.md`; `regulering-5-form-overenskomst-privat.md` (skabelon); `domain/eoRowEvaluation/eoRowIndkomstRows.ts:408–508` (row-gate); `offentligLoenLookup.missingEntry.test.ts`; `eoSnapshotRuntimeException.test.ts`; invariant-noten `loenudviklingBeregning.ts:63–70`.
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run loenudviklingOffentligFailClosed loenudviklingBeregning reguleringSilentPathAlignment` → ✅ 3 filer / 42 tests

## Kæde fra input til færdigt produkt

Eksempel: `kl-overenskomst`, `Angivet månedsløn` 30.000 kr, løntrin 1, gruppe 0, reguleringsdato
01-04-2024 (dækket), TAF 01-04-2024→2026-03-31. Basis-månedsløn (KL trin 1, gr. 0, 01-04-2024) =
19.351,75; segment 01-10-2024 = 19.603,25 ⇒ `deltaPct = (19603,25/19351,75 − 1)×100 = 1,30`.
Verificeret via ny normalsti-test + invariant-test.

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `overenskomst`; offentlig-gren via `getOffentligOverenskomstTypeById`; `resolveOffentligLoenSelection` validerer løntype/trin/gruppe; `assertUniform` på løntype/trin/gruppe/ekstra-grundløn | Uvalgt/ugyldig løntype/trin/gruppe → stille nul | ✔ (throw, se Dækningsanalyse) |
| Datakilde-opslag | `getOffentligLoenForDato/ForPeriode` (KL/RLTN, binærsøgt carry-forward); `getOffentligTillaegsSatserForDato/Periode` (KL/RLTN har ingen → bruger-input) | Manglende løntrin → stille nul | ✔ (throw ved manglende trin; se S3) |
| Reguleringsdato-forankring | base = `getOffentligLoenForDato(reguleringsdato)`; ellers fallback til ældste interval (`resolveOffentligEffectiveBase`) | Ingen base → stille nul-base | ✔ (3 fail-closed throws :969/:973/:982) |
| Segment/indeks/akkumulering | `getOffentligLoenForPeriode`→brudpunkter; per-segment `getOffentligLoenForDato`; pakke `computePackageValuePct` | Interiort hul → carry-forward; før base → zero-delta | ✔ **carry-forward ⇒ intet interiort hul; før-base zero-delta** |
| Afrunding | `roundByMethod((pkg/basePkg−1)×100, 2, 'halfAwayFromZero')` (`:1111`) | Ad hoc/dobbelt-afrunding | ✔ (delt kanonisk helper) |
| Aggregering (af/år) | segmenter → beløb; multi-af summeres | Én af maskerer andens fejl (compute) | ✔ (compute); row-lag = punkt 13 |
| Snapshot | motor-`throw` → `fail_closed` / `runtime_exception` | Throw sluges → zero-delta | ✔ (ny fail-closed-test: throw sluges IKKE) |
| Validator/gate | row-gate: `reguleringsvaerdi.min = interval.fraDato` (= ældste KL/RLTN-sats = 01-01-2012 = motorens fallback-base) | ugated mellemzone | ✔ (aligned; ny S3-test) |
| Skærm/PDF/Word | fælles overenskomst-visning + `assertOffentligReguleringsDatoGyldig`-gate i præsentation | Punkt 14 | (punkt 14) |

## Dækningsanalyse (led 2 — tavs under-regulering)

Nøgleobservation (**parallel til punkt 5's carry-forward-analyse**): `getOffentligLoenForDato`
(`offentligLoenLookup.ts:147`) bruger `findNewestReguleringOnOrBefore` (binærsøgning efter nyeste
regulering med `effectiveDate ≤ dato`). Den returnerer `undefined` **kun** når datoen ligger før den
**ældste** regulering. Ved en fundet regulering hvor det valgte løntrin mangler, **kaster** den
(`:161`) — den degraderer aldrig til `undefined`/zero-delta. Derfor:

- **Et interiort hul er umuligt.** For enhver dato ≥ ældste regulering findes altid en carry-forward-
  regulering; `undefined` kan kun ramme før-dækning.
- **Manglende løntrin ⇒ throw**, ikke zero-delta. (Med de faktiske data er alle 56 løntrin (1–55, «55+»)
  komplette i hver af de 30 KL- og 30 RLTN-reguleringer — verificeret. Kastet er dermed en defensiv
  data-integritets-invariant, ikke en sti valid input rammer med komplette data.)

### S3 — segment uden lønrække → BEKRÆFTET KORREKT (gated)

- **Sti:** `!effectiveSegmentResult || (segment.fra < effectiveBase.startIso && !useFallbackBaseBeforeCoverage)`
  → `buildZeroDeltaSegment` (`:1080–1083`).
- **Led:** beregningsmotoren (før-base) / row-lag (gate).
- **Kan valid input ramme den?** Ja — to gatede undertyper: (a) reguleringsdato **før dækning**
  (< 01-01-2012): base falder tilbage til ældste sats (`startIso = 01-01-2012`), og TAF-segmenter før
  01-01-2012 → zero-delta; (b) TAF-segmenter **før reguleringsdatoen** inden for dækning: index 100 på
  reguleringsdatoen, tidligere segmenter = zero-delta (samme domæneregel som privat/statistik — basen
  er reference).
- **Bevidst korrekt eller fejl? → BEKRÆFTET KORREKT (gated).** Præcis analog til S2/S1. Row-gatens nedre
  grænse `reguleringsRange.min = parseDanishToIso(getReguleringsDatoIntervalForOverenskomst(id).fraDato)`
  (`eoRowIndkomstRows.ts:419–424`), og for offentlig delegerer den til
  `getReguleringsDatoIntervalForOffentligLoen` (`overenskomstRates.ts:1690–1693`) → `fraDato = ældste
  KL/RLTN-regulering = 01-01-2012` — **identisk** med motorens fallback-base-start
  (`resolveOffentligEffectiveBase` → `interval.fraDato`). Row-error (`:472`) fyrer derfor aligned med
  motorens zero-delta-før-dækning; ingen ugated mellemzone. **Nu bundet ende-til-ende** (ny S3-blok i
  `reguleringSilentPathAlignment.test.ts`).
- **Udfald: uændret (bekræftet korrekt).** Ingen beregningsændring.

### Base-fallback (`resolveOffentligEffectiveBase:963–985`) — fail-closer korrekt

- Manglende base ved reguleringsdato → fallback til overenskomstens første interval. Hvis intervallet,
  dets `fraDato`-parse, eller opslaget på `fraDato` mangler → **throw** "basissats mangler"
  (`:969/:973/:982`). Ikke-positiv/ikke-finit basisgrundløn → `ensurePositiveFiniteNumber`-throw
  (`:1000`); basispakke ≤ 0 → throw (`:1010`). Ingen degradering til zero-delta.

### Manglende løntrin *inden for* dækning → BEKRÆFTET fail-closed (ikke zero-delta)

- `getOffentligLoenForDato` kaster ved manglende løntrin (`:161`); dette sluges **ikke** af motoren til
  et zero-delta-segment. Bundet ende-til-ende af ny fail-closed-test (`loenudviklingOffentligFailClosed.test.ts`):
  et mocket manglende løntrin på et dækket segments dato får `buildLoenudviklingModel` til at **kaste**
  (som i `computeEoSnapshot` bliver til `fail_closed` / `runtime_exception`, jf. invariant-noten og
  `eoSnapshotRuntimeException.test.ts`).

### `OFFENTLIG_REGULERING_MIN_DATO` (01-01-2012) — subsumeret af dæknings-gaten

- Konstanten er **identisk** med den ældste faktiske KL/RLTN-satsdato (`01-01-2012`). En reguleringsdato
  før 2012 gates derfor allerede af `reguleringsvaerdi`-row-error (min = 01-01-2012 = coverage-start), og
  motorens base falder tilbage til samme dato → zero-delta før 2012 (gated). `assertOffentligReguleringsDatoGyldig`
  bruges kun i **præsentationen** (`reguleringsPresentation.ts:519/1205/1230`) som defensiv redundans; den
  er ikke håndhævet i compute-motoren, men er heller ikke nødvendig dér, fordi coverage-gaten dækker
  præcis samme grænse. Ingen tavs under-regulering.

### Store Bededag — korrekt håndteret

- Base: `applyShRegel && reguleringsdatoIso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0` (`:1007`).
  Segment: samme på `segment.fra` (`:1104`). Intervallet `[STORE_BEDEDAG_START, effectiveBase.startIso)`
  håndteres via `useFallbackBaseBeforeCoverage` (`:1075–1079`) — bevidst proxy, spejler privat-grenen.

### S6-endepunkt — efter sidste sats → carry-forward (ejes af punkt 12/13)

- Datoer efter nyeste regulering → carry-forward af nyeste sats (ikke throw). Gated af `endDate`-row-gaten
  (`reguleringsRange.max = nyeste + 6 mdr − 1 dag`; KL → 31-03-2027, RLTN → 30-09-2026). Bekræftet på
  compute-niveau (motoren carry-forwarder, kaster ikke). Ejerskab punkt 12/13.

## Fund og rettelser

1. **[Info / bekræftet plan-antagelse] Den forventede offentlige `runtime_exception`-sti er en defensiv
   data-integritets-invariant, ikke en sti valid input rammer med komplette data.**
   - Lokation: `loenudviklingBeregning.ts:947–1119` + `offentligLoenLookup.ts:147–174`.
   - Observation: Punkt 5's tilfældighedsfund forudsagde, at den offentlige gren rummer den realistiske
     `runtime_exception` (manglende løntrin/basissats via `getOffentligLoenForDato`). Kortlægningen
     bekræfter, at *stien findes og fail-closer korrekt* (throw, ikke zero-delta), men at den **kun** kan
     nås med **ufuldstændige data**: alle 56 løntrin er komplette i hver af de 60 KL/RLTN-reguleringer, og
     basen falder altid tilbage til ældste sats. Med komplette data + valid input producerer den
     offentlige gren derfor **altid** et resultat; den eneste "ingen regulering"-sti er gated zero-delta
     (S3). Dette spejler præcis punkt 5's konklusion for privat overenskomst.
   - Handling: Trust-bindingen er nu dækket to steder: (a) S3 før-dækning → synlig blokerende row-error
     (ny alignment-test), og (b) manglende løntrin (mocket ufuldstændig tabel) → motor-throw → snapshot
     `runtime_exception` (ny fail-closed-test + eksisterende generisk wrapping-test). Ingen kunstig throw
     tilføjet i produktionskoden.
   - Resultat: Robusthedsegenskaben er dokumenteret og testet; ingen beregningsændring.

2. **[Bekræftet korrekt] S3 før-base zero-delta er gated (analog til S1/S2)** — se Dækningsanalyse.
   Ingen beregningsændring; ny alignment-test binder motoren til row-gaten for offentlig.

3. **[Medium — testhul, lukket] Ingen compute-tests for den offentlige gren.**
   - Lokation: `src/__tests__/domain/erstatningsopgoerelse/loenudviklingBeregning.test.ts`.
   - Problem: Den offentlige overenskomst-gren havde **nul** direkte compute-tests (KL-lønaftaler,
     privat, statistik, KRL var dækket — offentlig KL/RLTN ikke). En regression i løntrin-opslag,
     pakke-formel eller before-base-håndteringen ville ikke være fanget.
   - Handling: Tilføjet normalsti-, invariant- og før-dækning-test (se Testdækning). Ingen kodeændring.
   - Resultat: Grenen er nu dækket på compute-niveau.

## Testdækning (led 3)

**Anvendt (grønne):**
- `loenudviklingBeregning.test.ts` (+3, ny describe-blok "Overenskomst offentlig (KL) (review-punkt 6)"):
  1. **normalsti** — KL Månedsløn trin 1/gr. 0, TAF over satsændring → basis `deltaPct 0`,
     segment 01-10-2024 `deltaPct 1,30` (og reguleret månedsløn 30.390 kr), regulering reelt anvendt.
  2. **invariant** — for hvert segment: `deltaPct === roundByMethod((opslået segment-mdrløn /
     basis-mdrløn − 1)×100, 2, 'halfAwayFromZero')` (robust mod datastigninger; låser pakke-formlen).
  3. **S3 før dækning** — reguleringsdato + TAF før 01-01-2012 → kun zero-delta-segmenter, ingen throw.
- `reguleringSilentPathAlignment.test.ts` (+1, ny S3-blok): offentlig (KL), reguleringsdato **før
  dækning** → motoren producerer stille **kun** zero-delta-segmenter (ingen throw) OG
  `reguleringsvaerdi`-row-gaten fyrer `error`. Binder motorens fallback-base-start til row-gatens
  `interval.fraDato` for den offentlige gren, så fremtidig drift fanges.
- `loenudviklingOffentligFailClosed.test.ts` (ny fil): mocket ufuldstændig KL-tabel (manglende løntrin
  på ét dækket segments dato) → `buildLoenudviklingModel` **kaster** (`/Mangler løntrin/`) i stedet for
  at degradere til zero-delta. Binder throw-propagationen (→ `computeEoSnapshot` `runtime_exception`).
- Bekræftet stærk eksisterende dækning: `offentligLoenLookup.missingEntry.test.ts` (data-lag: manglende
  løntrin → throw), `offentligLoenLookup.test.ts`, `reguleringCoverage.test.ts` (`max`-clamp, streng `>`).

## Tilfældighedsfund

- **[Punkt 14/15 — konvergens]** `resolveOffentligLoenSelection` findes i **tre** varianter:
  compute-motoren (`loenudviklingBeregning.ts:234`, **kaster** fail-closed), samt inspektions-/visnings-
  laget (`eoInspektion/eoInspektionRegulationCore.ts:88` og `eoInspektionLoenCoreModel.ts:76`, begge
  returnerer **`null`** for graceful display-degradering). Den bevidste return-semantik-forskel
  (throw vs. null) gør en naiv sammenlægning uegnet, men den rene input-parsing (løntype/trin/gruppe →
  `OffentligLoenSelection`) kunne udtrækkes til én delt helper med to tynde wrappers. Ejes af
  inspektions-/præsentationslaget (punkt 14) — ikke rørt her.
- **[Lav]** `effectiveReguleringsdatoIso` (`loenudviklingBeregning.ts:897`, fra
  `resolveOverenskomstEffectiveStartIso`) beregnes ubetinget før gren-splittet, men bruges **kun** i
  privat-grenen (`:1127`); den offentlige gren opnår coverage-clampet via `resolveOffentligEffectiveBase`
  (baseResult-fallback). Harmløs, men to forskellige clamp-mekanismer for samme concern. Notér til
  eventuel konsolidering (punkt 15).
- **[Punkt 12]** KL/RLTN's øvre dæknings-grænse (`getReguleringsDatoIntervalForOffentligLoen`:
  `nyeste + 6 mdr − 1 dag`) er én af de tre `+6 mdr`-kopier planen (linje 553) vil konsolidere. Bekræftet
  på compute-niveau; konsolidering ejes af punkt 12.
- Ingen død kode, fejlplacerede filer eller kontraktdrift i offentlig-overenskomst-compute-stien.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring.** S3 er afgjort **bekræftet korrekt (gated)** — den stille zero-delta-før-base
fyrer aligned med en synlig, blokerende row-error (min = ældste KL/RLTN-sats = motorens fallback-base), og
et interiort hul er strukturelt umuligt (carry-forward). Manglende løntrin fail-closer (throw), degraderer
ikke til zero-delta. Der er intet at forelægge brugeren fra punkt 6.

## Sammenfatning

Den offentlige overenskomst-gren (KL/RLTN) er korrekt, ensartet (deler `computePackageValuePct`,
`buildSegmentsFromStartDates`, `roundByMethod`/`halfAwayFromZero` og row-gatens `interval.fraDato`-kilde
med de øvrige former) og deterministisk. Central konklusion — parallel til punkt 5: fordi
`getOffentligLoenForDato` **carry-forwarder** på datoen (nyeste regulering ≤ dato) og **kaster** ved
manglende løntrin, er **et interiort hul umuligt** og der findes **ingen realistisk `runtime_exception`-sti**
for valid input med komplette data (alle 56 løntrin komplette i alle 60 reguleringer). Den eneste "ingen
regulering"-sti er **zero-delta før basen (S3)**, som er **bekræftet korrekt og gated**: row-gatens
`reguleringsvaerdi.min = 01-01-2012 = ældste KL/RLTN-sats = motorens fallback-base-start` — sammenfaldende
med `OFFENTLIG_REGULERING_MIN_DATO`. Base-fallback og manglende løntrin fail-closer (throw), ikke zero-delta.
Efter-sidste-sats carry-forward er gated af `endDate`-row (punkt 12/13). Punkt 5's forudsigelse om en
offentlig `runtime_exception`-sti er bekræftet i struktur (throw ved ufuldstændig data) men afkræftet som
realistisk sti (data er komplette) — nu bundet ende-til-ende af tre nye tests. Gate grøn: typecheck,
typecheck:test, lint, 42 målrettede tests (heraf 5 nye).
