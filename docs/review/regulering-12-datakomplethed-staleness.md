# Regulering punkt 12 — Datakomplethed og staleness

**Dato:** 2026-07-03
**Status:** ✅ Gennemgået
**Reguleringsform(er):** tværgående — ALLE satskilder (ikke en enkelt form). Familie 1 (lønudvikling) og familie 2 (år-til-år opregulering) samt de øvrige satstabeller.
**Primært scope:**
- `data/statistiskeRates.ts`, `data/krlRates.ts`, `data/klLoenaftaler.ts`, `data/overenskomstRates.ts`, `data/offentligLoenLookup.ts` (+ KL/RLTN genererede filer)
- `data/sygedagpengeRates.ts`, `data/lovbestemteRates.ts`, `config/indskudteLoentillaeg.ts`, `config/regulatoryRates.ts`
- Delte helpers: `findLatestByDateInSortedList` (`loenudviklingBeregning.ts`), `getInclusivePeriodEndByMonths` + ny `getInclusivePeriodEndDanishDate` (`utils/dateUtils.ts`), `getSatserForYear` (`lovbestemteRates.ts`)
**Afhængigheder læst:**
- `AGENTS.md`; `regulering-review-plan.md` (punkt 12-scope + S6/S7); `regulering-0-baseline.md` (interval-familie-korrektion); skabelon `regulering-10-form-kl-loenaftaler.md`, `regulering-11-familie2-motorer.md`
- `utils/isoDateHelpers.ts` (`getDayAfterIso`), `types/branded.ts` (`parseDanishDate`), `utils/dateFormatting.ts` (`formatDanishDate`)
- Opslags-/gate-stier: `getSatserForDatoFromList`/`getOffentligLoenForDato`/`getReguleringsDatoIntervalFor…`-familien; sygedagpenge-opslaget `sygedagpengeInsertRows.ts` (`splitSygedagpengeRateSegments`, `assertSygedagpengeRangeFullyCovered`) — delegeret trace
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run` (data + dateUtils): `klLoenaftaler statistiskeRates KRLrates overenskomstRates offentligLoenLookup sygedagpengeRates dateUtils` → ✅ 7 filer / 267 tests (heraf 32 nye)
- `npx vitest run loenudviklingBeregning reguleringsPresentation erstatningsopgoerelseValidator eoRowIndkomstRows reguleringSilentPathAlignment reguleringSection sygedagpengeInsertRows klLoenaftalerReguleretLoen loenudviklingOffentligFailClosed` → ✅ 11 filer / 267 tests

## Formål

Sikre at ingen reguleringsform stille kan videreføre en forældet sats (carry-forward-staleness, S6), at
`getSatserForYear` (fail-open, S7) aldrig lækker ind i en reguleringsberegning, at
`getReguleringsDatoIntervalFor…`-familiens duplikerede aritmetik er konsolideret, og at hver Excel-/
inline-genereret satstabel har en fail-closed integritets-guard ved modul-load.

## Udtømmende dæknings-audit-tabel (kernen i punkt 12)

For hver satskilde: dækningsgrænser, opslagsmekanisme, øvre/nedre gate mod carry-forward, og
modul-load integritets-guard. "Øvre gate" = eksplicit blokerende fejl når en TAF-/beregnings-periode
rækker ud over `max` (ikke bare carry-forward). "Load-guard" = throw ved modul-load på korrupt/hullet/
mis-sorteret data.

### Familie 1 — Lønudviklings-regulering (carry-forward-baserede satskilder)

| Kilde (fil) | Min-dato | Max-dato | Opslag | Nedre gate | Øvre gate | Load-guard |
|---|---|---|---|---|---|---|
| **Statistik ILON12/SBLON2** (`statistiskeRates.ts`) | ILON 2005K1 / SBLON 2016K1 | ILON 2025K4 / SBLON 2026K1 | carry-forward `findLatestByDateInSortedList` (kvartal) | base-clamp (S1) → `reguleringsvaerdi`-row (punkt 3) | interval `…ForStatistikModel` (**+12 mdr**) → row `slutvaerdi` + validator (punkt 3) | ✅ `assertStatistikAarKontinuitet` (år-kontinuitet) + dup-ID (punkt 3) |
| **Statistik ASL-årslønsmaksimum** (`lovbestemteRates.ts:aarsloenAslMax`) | 2005 | 2026 | **eksakt pr. år** (ingen carry-forward) | motor kaster ved manglende basis-år (punkt 4) | motor kaster ved manglende segment-år; validator endepunkts | ✅ `assertAarsloenAslMaxKontinuitet` (år-kontinuitet, punkt 4) |
| **Overenskomst — privat** (`overenskomstRates.ts`) | pr. overenskomst (ældste sats) | pr. overenskomst (nyeste sats) | carry-forward `getSatserForDatoFromList` (**nyeste-først orden**) | før-dækning → `reguleringsvaerdi`-row (punkt 5) | interval `…ForOverenskomst` (**+12 mdr**) → row `slutvaerdi` + validator (punkt 5) | ✅ **NY** `assertOverenskomstSatserNyesteFoerst` + eksisterende dup-/SFGG-guards |
| **Overenskomst — offentlig KL/RLTN** (`offentligLoenLookup.ts`) | 01-01-2012 (`OFFENTLIG_REGULERING_MIN_DATO`) | KL 01-10-2026 → **31-03-2027**; RLTN 01-04-2026 → **30-09-2026** | carry-forward binærsøgning `findNewestReguleringOnOrBefore`; manglende løntrin → **throw** | base-fallback + min-dato-gate (punkt 6) | interval `…ForOffentligLoen` (**+6 mdr**) → row `slutvaerdi` + validator (punkt 6) | ✅ dup-datoer + nyeste-først + dup/manglende løntrin (55+) + **NY tom-tabel-guard** |
| **KRL satstabel** (`krlRates.ts`) | 01-04-2001 (KTO kom.) | 01-04-2026 → **30-09-2026** | carry-forward `findLatestByDateInSortedList` | base-clamp (S1) → `reguleringsvaerdi`-row (punkt 9) | interval `…ForKRL` (**+6 mdr**) → row `slutvaerdi` + validator (punkt 9) | ✅ `assertKRLCombinedDataIntegritet` (nyeste-først + ingen interiort null, punkt 9) |
| **KL-lønaftaler** (`klLoenaftaler.ts`) | 01-04-2005 (0,00 %-basis) | 01-10-2026 → **31-03-2027** | trinvis kæde (carry-forward mellem trin ER modellen); kæde-resolver fail-closer ved korrupt data (punkt 10) | `reguleringsvaerdi`-row (min 01-04-2005) | interval `…ForKlLoenaftaler` (**+6 mdr**) → row `slutvaerdi` + validator (punkt 10) | ✅ **NY** `assertKlLoenaftalerDataIntegritet` (ikke-tom, strengt ældste-først, unikke, finit pct) |
| **Manuelt angivet / Manuel procentsats** (bruger-rækker) | n/a (bruger-indtastet) | n/a | daterede bruger-rækker; ingen ekstern tabel | før-basis/aktiv-række-gate (punkt 7, 8) | row + validator (punkt 7, 8, 13) | n/a (ingen datatabel; Zod dækker input) |
| **Indskudte løntillæg** (`config/indskudteLoentillaeg.ts`) | Store Bededag 01-01-2024 | — (permanent) | `resolveIndskudtLoentillaegPct` carry-forward sidste trin, 0 før første | 0 før virkningsdato (korrekt) | ingen — **bevidst** (0,45 %-tillægget er en permanent strukturel tilføjelse, ikke en sats der forældes) | n/a (to konstanter; ingen staleness-risiko) |

### Familie 2 — År-til-år opregulering (per-år-satskilder)

| Kilde (fil) | Min | Max | Opslag | Fail-closed | Load-guard |
|---|---|---|---|---|---|
| **reguleringssats** (`lovbestemteRates.ts`) | 2005 | 2026 | delt `resolveReguleringssatsForAar` (punkt 11); akkumuleret motor kræver **hvert** mellemår | `manglendeAar` → synlig blokering (interiort hul + efter-sidste + før-første) | ikke nødvendig: motoren fail-closer per manglende år ved compute (punkt 11) |
| **reguleringsprocentErhvervsevnetab / …Fra2024 / …Foer2024** (`lovbestemteRates.ts`) | ≤2023 / 2024–2026 / 2024 | — | `resolveAslReguleringRateForAar` (punkt 11) | manglende/ikke-finit → `EetIssue` + `null` (blokerende) | ikke nødvendig: fail-closer ved compute (punkt 11) |

### Øvrige satstabeller (ikke reguleringskilder — noteret for komplethed)

- `lovbestemteRates.ts` EAL/ASL-satser (`svieSmertePrDag`, `svieSmerteMax`, `erhvervsevnetabEalMax`,
  `foersoergertabEalMin`, `vejledendeUdtalelseEet`, `varigeMenPrGrad`, `aarsloenAslMin`, `overgangsbeloeb`,
  `friProces*`) er **eksakt pr. år** (ingen carry-forward). Dæknings-år håndhæves fail-closed via
  `getYearBoundsForCompleteCoverage`/`…AnyCoverage` + `satserCompleteYearBounds`/`eetYearBounds`/
  `foersoergertabYearBounds` (kaster ved manglende fælles dækning), og `svieSmerteMaxYearBounds`/
  `varigeMenPrGradYearBounds` kaster ved tom tabel. Ingen carry-forward-staleness.
- `sygedagpengeRates.ts` er **ikke** en reguleringskilde (indkomst-/periodiserings-satskilde til sygedagpenge-
  indtægt). Opslag = eksplicit `[fraDato;tilDato]`-interval-match (ikke carry-forward); hele perioden gates
  fail-closed mod ydergrænserne af `assertSygedagpengeRangeFullyCovered` (før 03-01-2005 / efter 03-01-2027
  → `SygedagpengeCoverageError`). Ingen staleness-risiko. Restrisiko (interiort hul → tavs under-dækning)
  var kun test-håndhævet → **NY** `assertSygedagpengeRatesIntegritet` (kontinuitet/overlap ved load).
- `config/regulatoryRates.ts` indeholder kun konstanten `TIMER_TIL_MAANED_FAKTOR` — ingen tabel.

## Kæde fra input til færdigt produkt (S6-eksempel: offentlig KL ud over dækning)

Eksempel: KL-overenskomst, løntrin, TAF-periode der slutter **efter** KL's sidste regulering (01-10-2026).

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Datakilde-opslag | `getOffentligLoenForDato` binærsøger nyeste regulering ≤ dato → carry-forwarder 01-10-2026-satsen for datoer derefter | Carry-forward af forældet sats uden fejl (S6) | ✔ (carry-forward er bevidst inden for 6-mdr-vinduet) |
| Reguleringsdato-forankring | interval `getReguleringsDatoIntervalForOffentligLoen` = ældste (01-01-2012) → nyeste + 6 mdr − 1 dag (**31-03-2027**) via delt `getInclusivePeriodEndDanishDate` | Forkert interval-slutdato → forkert gate | ✔ (tal-identisk med tidligere inline-aritmetik, testet) |
| Segment/carry-forward | segment efter 31-03-2027 ligger uden for den periode sidste sats dækker | interiort hul umuligt (carry-forward) | ✔ (punkt 6) |
| Validator/gate | `slutvaerdi`-row → `error` når TAF-slut > tilDato + udløbsvindue; validator "kan ikke beregnes efter 31-03-2027" | Usynlig blokering | ✔ (synlig blokerende fejl; punkt 6/13) |
| Skærm/PDF/Word | Ved blokerende gate produceres ingen forældet TAF-værdi | Tabt/forvansket værdi | ✔ (gate før produkt) |

Konklusion: carry-forward ud over `max` er for **alle** familie-1-carry-forward-kilder gated af et interval-
baseret `slutvaerdi`-row-error + coverage-validator (afgjort i punkt 3/5/6/9/10). Øvre-gaten dækker altså
ikke kun statistik/KRL, men også offentlig overenskomst, privat overenskomst og KL-lønaftaler. ASL og
familie-2 fail-closer i selve motoren (eksakt pr-år / `manglendeAar`).

## Dækningsanalyse (led 2 — tavs under-regulering)

### S6 — carry-forward-staleness pr. kilde (kernen)
- **Sti:** `findLatestByDateInSortedList` / `getSatserForDatoFromList` / `getOffentligLoenForDato` /
  KL-kæden viderefører sidste entry for datoer efter `max` (ingen øvre-grænse **i motoren**).
- **Kan valid input ramme den?** Ja — en TAF-/beregnings-periode der rækker ud over sidste kendte sats.
- **Bevidst korrekt eller fejl? → BEKRÆFTET GATED for hver kilde.** For hver carry-forward-kilde findes et
  interval-baseret øvre-gate (`getReguleringsDatoIntervalFor…` → `slutvaerdi`-row-`error` + coverage-
  validator), afgjort i de respektive form-punkter (3/5/6/9/10) og bekræftet her mod den faktiske kode:
  hver form har sin interval-funktion, og de tre `+6 mdr`-varianter er nu konsolideret uden taländring.
  Interiort hul er umuligt for carry-forward-kilder (og eksplicit lukket for statistik/KRL med kontinuitets-
  guards). ASL slår eksakt pr. år op → interiort hul OG efter-sidste-år fail-closer i motoren.
- **Udfald: uændret adfærd; hærdet ved load** (nye guards fanger korrupt/hullet/mis-sorteret data der
  ellers kunne underminere carry-forward-antagelsen eller interval-udledningen — se Fund).

### S7 — `getSatserForYear` er fail-open, må ikke lække ind i beregning
- **Sti:** `getSatserForYear` returnerer `null`/`''` ved manglende år (fail-open).
- **Repo-bred søgning (verificeret):** forbrugere er **udelukkende** display/dokument:
  `components/pages/Satser.tsx`, `document/generators/satser/satserDocument.ts`,
  `document/service/documentService.ts` (+ `lovbestemteRates.test.ts`, `satserWordContent.test.ts`).
  **Ingen** reguleringsberegnings-sti (`loenudviklingBeregning`, `opreguleringsmotorer`,
  `offentligeYdelserUdviklingBeregning`, `eetReguleringRater`, `tafPerYear*`) rører den.
- **Udfald: BEKRÆFTET korrekt.** S7 kan lukkes endeligt i silent-path-kataloget (var "verificér-kun" for punkt 12).

## Fund og rettelser

1. **[Medium → rettet direkte] Konsolidering af `getReguleringsDatoIntervalFor…`-familiens `+6 mdr`-aritmetik.**
   - Lokation: `krlRates.ts`, `klLoenaftaler.ts`, `offentligLoenLookup.ts` (tre identiske inline-kopier af
     `parseDanishDate` → `getInclusivePeriodEndByMonths(…, 6)` → `formatDanishDate`).
   - Handling: ny kanonisk helper `getInclusivePeriodEndDanishDate(fraDato, months)` i `utils/dateUtils.ts`
     (ét sted for parse → +N mdr − 1 dag → format, fail-closed `undefined` ved uparsbar dato). De tre
     `+6`-kopier kalder den nu. De **bevidst forskellige** varianter er urørt: `…ForStatistikModel`
     (+12 mdr / år-grænser) og `…ForOverenskomst` privat-gren (+12 mdr) beholder deres egen aritmetik.
   - Resultat: **Tal-neutralt** (bevist: `getInclusivePeriodEndDanishDate` matcher den tidligere inline-
     aritmetik for de tre kilders nyeste datoer, og KRL/KL-interval-testene bekræfter byte-identiske
     slutdatoer 30-09-2026 / 31-03-2027). Mindre duplikering, ét afrundings-/clamp-sted.

2. **[Høj → rettet direkte] KL-lønaftaler manglede en modul-load integritets-guard.**
   - Lokation: `data/klLoenaftaler.ts` (`klLoenaftalerRaekker`).
   - Problem/Risiko: Formen regulerer trinvist på lønnen, og `getReguleringsDatoIntervalForKlLoenaftaler`
     udleder row-gatens dæknings-interval **positionelt** (`[0]` = ældste, `[length-1]` = nyeste). En tom,
     mis-sorteret, duplikeret eller ikke-finit serie ville give et forkert interval (row-gatens `min`/`max`,
     der gater S1/S6) eller en tavs under-regulering — uden en synlig fejl.
   - Handling: **NY** `assertKlLoenaftalerDataIntegritet` (ikke-tom, strengt ældste-først, unikke, parsbare
     datoer, finit periodesats), kaldt ved modul-load — analog til `assertKRLCombinedDataIntegritet`.
   - Resultat: **Tal-neutralt** (serien er hul-fri, sorteret og finit i dag). Fanger udelukkende en faktisk
     datafejl. Selv-test beviser fangst (tom/mis-sort/dup/ikke-finit/ugyldig-dato).

3. **[Medium → rettet direkte] Overenskomst (privat) manglede en nyeste-først load-guard.**
   - Lokation: `data/overenskomstRates.ts` (`overenskomster[].satser`, `offentligeOverenskomstSatser[].satser`).
   - Problem/Risiko: `getSatserForDatoFromList` returnerer den **første** sats i array-rækkefølge hvor
     `fraDato ≤ dato` — dvs. den forudsætter strengt nyeste-først orden for at carry-forwarde den korrekte
     (nyeste gældende) sats. En mis-sorteret serie ville returnere en **ældre** sats for en dato hvor en nyere
     gælder → tavs forkert regulering. `getReguleringsDatoIntervalForOverenskomst` udleder desuden intervallet
     positionelt.
   - Handling: **NY** `assertOverenskomstSatserNyesteFoerst` (ikke-tom, strengt nyeste-først, unikke, parsbare
     datoer), kaldt for alle private + offentlige tillægs-serier ved modul-load.
   - Resultat: **Tal-neutralt** (alle serier er nyeste-først i dag; alle faktiske serier passerer guarden i
     test). Fanger kun en faktisk datafejl. Selv-test beviser fangst.

4. **[Lav → rettet direkte] Offentlig løn (KL/RLTN) manglede en tom-tabel-guard ved load.**
   - Lokation: `data/offentligLoenLookup.ts` (`buildReguleringLookups`).
   - Problem/Risiko: `buildReguleringLookups` håndhævede allerede dup-datoer, nyeste-først-sortering og
     dup/manglende løntrin (55+), men **ikke** tom tabel: en tom genereret tabel ville få alle opslag til at
     returnere `undefined` (ingen regulering) og et udefineret interval — tavs under-regulering.
   - Handling: **NY** eksporteret `assertOffentligLoenTabelIkkeTom(satser, label)` kaldt først i
     `buildReguleringLookups`. Eksporteret for at kunne selv-testes (guard-selvtest-princip).
   - Resultat: **Tal-neutralt** (de genererede tabeller er ikke-tomme). Selv-test beviser fangst.

5. **[Lav → rettet direkte] Sygedagpenge-kontinuitet flyttet fra test-tid til load-tid.**
   - Lokation: `data/sygedagpengeRates.ts` (`sygedagpengeRates`).
   - Problem/Risiko: Sygedagpenge er **ikke** en reguleringskilde og har ingen carry-forward-staleness
     (interval-match + fail-closed ydergrænse-gate). Men kontinuitet/ikke-overlap mellem satsår var **kun**
     håndhævet af en unit-test; et fremtidigt interiort hul ville lade dage i hullet falde ud af
     segmenteringen uden fejl (tavs under-dækning), og et overlap ville dobbelttælle en dag.
   - Handling: **NY** `assertSygedagpengeRatesIntegritet` (hvert satsår starter dagen efter forrige `tilDato`,
     `fraDato ≤ tilDato`, ikke-tom) kaldt ved modul-load.
   - Resultat: **Tal-neutralt** (tabellen er kontinuert i dag). Defense-in-depth; selv-test beviser fangst.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring — intet at forelægge.** Alle fem rettelser er tal-neutrale: interval-
konsolideringen er bevist byte-identisk, og de fire nye load-guards kaster **kun** ved korrupt/hullet/mis-
sorteret data der ellers ville give tavs under-regulering/-dækning. Ingen ny brugervendt blokerende fejl for
valide input (de eksisterende dæknings-gates for efter-sidste-sats fandtes allerede pr. form).

## Testdækning (led 3)

**Nye/udvidede tests (32), alle grønne:**
- `dateUtils.test.ts` (**+4**, `getInclusivePeriodEndDanishDate`): tal-identitet mod tidligere inline-
  aritmetik for de tre `+6`-kilders nyeste datoer; kendte slutdatoer (KRL 30-09-2026, KL 31-03-2027);
  månedsslut-clamp (31-08 + 6 mdr − 1 dag = 27-02-2027); uparsbar dato → `undefined`.
- `klLoenaftaler.test.ts` (**+7**, `assertKlLoenaftalerDataIntegritet`): faktiske data passerer; gyldig serie
  passerer; tom / mis-sorteret / duplikeret dato / ikke-finit pct / ugyldig fraDato fail-closer.
- `overenskomstRates.test.ts` (**+5**, `assertOverenskomstSatserNyesteFoerst`): alle faktiske serier passerer;
  nyeste-først passerer; tom / mis-sorteret / duplikeret dato fail-closer.
- `sygedagpengeRates.test.ts` (**+6**, `assertSygedagpengeRatesIntegritet`): faktiske data passerer;
  kontinuert serie passerer; tom / hul / overlap / `fraDato > tilDato` fail-closer.
- `offentligLoenLookup.test.ts` (**+2**, `assertOffentligLoenTabelIkkeTom`): faktiske KL/RLTN passerer; tom
  tabel fail-closer.
- `offentligLoenLookup.missingEntry.test.ts` (opdateret ved integration): dens RLTN-mock var tom
  (`rltnLoenSatser: []`) af bekvemmelighed — den nye tom-tabel-guard fangede det. Mock'en fik én valid
  regulering (inkl. det påkrævede `55+`-løntrin), så testen fortsat kun hævder KL's manglende-løntrin-sti;
  guardens fangst er selvstændigt dækket ovenfor.
- Bekræftet stærk eksisterende dækning: `KRLrates.test.ts` (`assertKRLCombinedDataIntegritet` + interval
  30-09-2026), `statistiskeRates.test.ts` (`assertStatistikAarKontinuitet`), `loenudviklingBeregning`/
  `reguleringSilentPathAlignment`/`erstatningsopgoerelseValidator`/`eoRowIndkomstRows` (efter-sidste-sats
  gates), `sygedagpengeInsertRows` (interval-match + ydergrænse-gate).

Hver ny load-guard har en selv-test der beviser at guarden faktisk fanger overtrædelsen (vacuous-pass-værn,
jf. projektets guard-selvtest-princip) **og** en test der beviser at de faktiske produktionsdata passerer
(tal-neutralitet).

## Tilfældighedsfund

- **[Lav — konvergens, punkt 15]** `getReguleringsDatoIntervalForStatistikModel` (ILON/SBLON-grenen,
  `statistiskeRates.ts`) og `getReguleringsDatoIntervalForOverenskomst` (privat-grenen,
  `overenskomstRates.ts`) beregner deres `+12 mdr − 1 dag`-slutdato med inline
  `formatDanishDate(addDays(addMonths(nyesteDate, 12), -1))`. Dette er den **bevidst forskellige** variant
  (+12, ikke +6) og er derfor urørt her per punkt 12-scope, men aritmetikken er identisk med
  `getInclusivePeriodEndDanishDate(dato, 12)` og kunne tal-neutralt adoptere den delte helper i punkt 15
  (rendyrket konvergens; rører ikke tal).
- **[Info — bekræftet]** `findLatestByDateInSortedList` (`loenudviklingBeregning.ts`) har bevidst ingen
  øvre-grænse — øvre-gaten bor i interval-funktionerne + row-lag/validator, ikke i den generiske carry-
  forward-helper. Korrekt separation (helperen er kilde-agnostisk).
- **[Info — bekræftet]** `config/regulatoryRates.ts` indeholder kun `TIMER_TIL_MAANED_FAKTOR`; kommentaren
  om at indskudte løntillæg bor i `indskudteLoentillaeg.ts` er korrekt (ingen drift).
- Ingen død kode eller fejlplacerede filer fundet i satskilde-laget efter konsolideringen (de tre
  `formatDanishDate`/`getInclusivePeriodEndByMonths`-imports er fjernet fra de tre `+6`-kilder).

## Sammenfatning

Alle satskilder er auditeret for carry-forward-staleness (S6) og datakomplethed. Resultatet er en
udtømmende pr.-kilde dæknings-tabel: hver carry-forward-baseret familie-1-form (statistik, privat/offentlig
overenskomst, KRL, KL-lønaftaler) har et interval-baseret øvre-gate (`slutvaerdi`-row-`error` +
coverage-validator) mod carry-forward ud over `max` — øvre-gaten dækker altså **alle** former, ikke kun
statistik/KRL. ASL og familie-2 fail-closer i motoren (eksakt pr-år / `manglendeAar`). **S7 er endeligt
bekræftet:** `getSatserForYear` (fail-open) er kun i display/dokument, aldrig i en reguleringsberegning.

`getReguleringsDatoIntervalFor…`-familiens tre `+6 mdr`-kopier er konsolideret mod den nye kanoniske
`getInclusivePeriodEndDanishDate` (bevist tal-identisk); de bevidst forskellige +12/år-grænse-varianter er
urørt. Fire manglende modul-load integritets-guards er tilføjet fail-closed og tal-neutralt
(KL-lønaftaler, overenskomst privat/offentlig nyeste-først, offentlig løn tom-tabel, sygedagpenge
kontinuitet) — analoge til de eksisterende KRL/statistik/ASL-guards, hver med en selv-test der beviser
fangst og en test der beviser produktionsdata passerer. Ingen beregningsændring, intet at forelægge. Gate
grøn: typecheck, typecheck:test, lint, 267 data/dateUtils-tests (32 nye) + 267 downstream-tests.
