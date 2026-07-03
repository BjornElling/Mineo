# Regulering punkt 9 — Form: KRL satstabel

**Dato:** 2026-07-03
**Status:** ✅ Gennemgået
**Reguleringsform(er):** KRL satstabel — reguleringsprocent-indeks fra Kommunernes og Regionernes Løndatakontor (4 delserier: KTO/SHK × kommuner/regioner).
**Primært scope:**
- `engines/loenudviklingBeregning.ts:734–802` (`buildLoenudviklingFromKRL`)
- `data/krlRates.ts` (samlet 4-kolonne-tabel, `buildSatstabelFromCombined`, `getReguleringsDatoIntervalForKRL`)
- `engines/reguleringsPresentation.ts` (KRL-grene: `:941–972`, `:1044–1103`, `:1533–1535`, `:1737–1740`)
**Afhængigheder læst:**
- `AGENTS.md`; `regulering-review-plan.md` (punkt 9-scope + silent-path-katalog S1/S6/S7)
- `regulering-3-form-statistik.md` (nærmeste parallel — S1 base-clamp + S6 hul-i-serie; `assertStatistikAarKontinuitet`-mønstret genbrugt) og `regulering-8-form-manuel-procentsats.md` (skabelon)
- Fælles fundament: `resolveEffectiveBaseEntry`, `findLatestByDateInSortedList`, `buildSegmentsFromStartDates`, `buildZeroDeltaSegment`, `resolveAnvendtReguleringsdato` (`loenudviklingBeregning.ts:296–371`)
- Row-gate: `domain/eoRowEvaluation/eoRowIndkomstRows.ts:417–518` (KRL-grenen `:434–443`)
- S1-alignment-testen `reguleringSilentPathAlignment.test.ts` (KRL er allerede i `FORMER`-arrayet)
- Inspektions-parity: `domain/eoInspektion/eoInspektionRegulationCore.ts` (`buildKrlEntries:359–408`)
- S7: `data/lovbestemteRates.ts:898` (`getSatserForYear`)
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run KRLrates loenudviklingBeregning reguleringSilentPathAlignment` → ✅ 3 filer / 78 tests (heraf 12 nye)

## Kæde fra input til færdigt produkt

Eksempel: `KRL satstabel` = `KTO (kommuner)`, `Angivet månedsløn` 30.000, reguleringsdato
2024-04-01, TAF 2024-04-01 … 2026-12-31. Base = sats pr. 01-04-2024 = 57,7650.
Forventet per-segment `deltaPct` (indeksforhold, verificeret numerisk):
`2024-04-01→0`, `2024-10-01→+1,30 %` (59,8159), `2025-10-01→+1,60 %` (60,2921),
`2025-11-01→+2,34 %` (61,4627), `2026-04-01→+4,80 %` (65,3378).

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `krl`; `assertUniform` på `loenudviklingKRLSatstabel` (`:474`) | Uvalgt/blandet satstabel → `throw` (`:604`) / fail-closed | ✔ |
| Datakilde-opslag | `getKRLSatstabel(krlSatstabelId)`; `!tabel \|\| vaerdier.length === 0` → `throw` (`:744–745`) | Tom/ukendt tabel → stille nul | ✔ (throw) |
| Reguleringsdato-forankring | kanonisk `resolveAnvendtReguleringsdato` (`:478`); `!reguleringsdato` → `throw` (`:740–741`) | Ingen dato → stille nul-base | ✔ (throw) |
| Segment/indeks/akkumulering | `periodStarts` (null-frafiltreret, sorteret asc); `resolveEffectiveBaseEntry` (base ≤ dato); `buildSegmentsFromStartDates`; `findLatestByDateInSortedList` per segment; `deltaPct=((100+segPct)/(100+basePct)−1)×100` | Interiort hul → carry-forward (S6); ikke-finit/`100+pct≤0` | ✔ (hul lukket af data-guard; pct-guard `:769/790`) |
| Afrunding | `roundByMethod(deltaPct, 2, 'halfAwayFromZero')` — kanonisk (`:794`) | Ad hoc/dobbelt-afrunding | ✔ |
| Aggregering (af/år) | segmenter → beløb; multi-af summeres; én af-fejl → hele modellen fail-closer (compute) | Én af maskerer andens fejl (compute) | ✔ (compute); row-lag = punkt 13 |
| Snapshot | motor-`throw` → `fail_closed` / `runtime_exception` (`:63–70`) | Throw sluges → zero-delta | ✔ |
| Validator/gate | row `reguleringsvaerdi` (nedre = `getReguleringsDatoIntervalForKRL.fraDato` = ældste sats), `endDate` (øvre = nyeste sats + 6 mdr − 1 dag) | Se Dækningsanalyse | ✔ |
| Skærm-præsentation | `reguleringsPresentation.ts` KRL-grene læser samme `getKRLSatstabel`/samme pct-serie | Note beregnes uafhængigt | ✔ (dyb output-paritet = punkt 14) |
| PDF/Word-output | `reguleringSection`/docx (`krkDocument`, `krlWordContent`) | Punkt 14 | (punkt 14) |

## Dækningsanalyse (led 2 — tavs under-regulering)

### S1 — base-clamp (reguleringsdato før første sats) → BEKRÆFTET KORREKT (gated)

- **Sti:** `resolveEffectiveBaseEntry` (`:762`) ankrer basen til ældste sats når
  `findLatestByDateInSortedList` ikke finder en sats ≤ reguleringsdato; segmenter før
  `effectiveBaseStartIso` → `buildZeroDeltaSegment` (`:782–784`).
- **Led:** beregningsmotoren.
- **Kan valid input ramme den?** Ja — reguleringsdato før satstabellens ældste sats
  (fx `KTO (kommuner)` før 01-04-2001, eller `KTO/SHK (regioner)` før 01-10-2018).
- **Bevidst korrekt eller fejl?** BEKRÆFTET KORREKT, gated — følger **præcis** punkt 1's
  og punkt 3's konklusion. Row-gatens nedre grænse
  `reguleringsRange.min = parseDanishToIso(getReguleringsDatoIntervalForKRL(id).fraDato)`
  (`eoRowIndkomstRows.ts:437–441`), og `interval.fraDato = aeldste.fraDato`
  (`krlRates.ts:214`) er **identisk** med motorens `effectiveBaseStartIso` når clampen
  aktiveres (motorens `firstEntry = periodStarts[0] = ældste sats`, samme dato). Row-error
  (`:472`) fyrer derfor aligned med clampen; ingen ugated mellemzone. Under escape-hatchen
  nedgraderes til warning (tilsigtet).
- **Udfald: uændret (bekræftet korrekt).** Ingen beregningsændring. **Allerede bundet
  ende-til-ende:** KRL indgår i `FORMER`-arrayet i `reguleringSilentPathAlignment.test.ts`
  (S1-blok), der pinner "motor falder stille tilbage OG row-gate fyrer error".

### S6 — interiort hul i reguleringsprocent-serien → RETTET (data-load fail-close)

- **Sti (før):** `buildSatstabelFromCombined` (`:157–169`) frafiltrerer null-felter fra
  hver kolonne. Et hul *midt* i en kolonneserie (en manglende procent mellem to definerede
  datoer) ville derfor forsvinde lydløst: motorens `findLatestByDateInSortedList` (`:786`)
  ville i det manglende trins segment videreføre den forrige — lavere — akkumulerede
  reguleringsprocent i stedet for at fejle → tavs under-regulering (S6). KRL-procenten er
  et *akkumuleret* indeks, så en for lav pct giver et for lavt `deltaPct`.
- **Led:** datakilde-opslag / segment-beregning.
- **Kan valid input ramme den?** Ja i princippet — men **ikke med de faktiske data**. Alle
  fire kolonner er i dag hul-frie: null optræder kun som en sammenhængende *prefiks* i de
  ældste datoer (før organisationens serie starter — SHK kom. fra 01-01-2008, begge
  regions-kolonner fra 01-10-2018). Kun en ægte **datafejl** (en tabt sats midt i en serie,
  eller en mis-sorteret tabel) kan skabe et interiort hul.
- **Var der en data-guard før?** **Nej.** `krlRates.ts` havde kun en duplikat-ID-guard på
  de *byggede* satstabeller (`:250–256`, tidl. `:176–182`). Der var **ingen** kontinuitets-
  /hul-guard på den samlede kildedata, og **ingen** håndhævelse af den nyeste-først-
  rækkefølge, som både `getReguleringsDatoIntervalForKRL` (ældste = sidste række, nyeste =
  første række) og null-prefiks-antagelsen hviler på. Motoren sorterer selv `periodStarts`,
  men `getReguleringsDatoIntervalForKRL` gør **ikke** — en mis-sorteret tabel ville give et
  forkert reguleringsdato-interval i row-gaten (der driver S1/S6-gatingen).
- **Afgørelse:** interiort hul er en **tavs under-regulering**, ikke en umulighed. **Rettet**
  med en fail-closed data-load-guard (`assertKRLCombinedDataIntegritet`, se Fund 1), der gør
  interiore huller **umulige** ved modul-load frem for at ændre et produceret tal ved compute.
  Guarden fyrer aldrig ved valid drift (nye satser tilføjes altid i forlængelse, nyeste
  først) og ændrer **intet** tal for eksisterende data (alle fire kolonner passerer). Den er
  derfor **ikke** en beregningsændring og er anvendt direkte (arbejdsregel 2). Præcis samme
  mønster som punkt 3's `assertStatistikAarKontinuitet`.
- **Udfald: fail-closed indført på data-boundary.** Ingen compute-path-throw parkeret (den
  ville være redundant og *ville* være en beregningsændring).

### S6-endepunkt — TAF ud over sidste KRL-dato → bevidst carry-forward inden for dæknings-vindue (ejes af punkt 12/13)

- **Sti:** for segmenter efter sidste KRL-sats videreføres sidste pct (fx 01-04-2026's
  65,3378 ind i 2027).
- **Bevidst korrekt eller fejl?** Bevidst inden for dæknings-vinduet: row-gatens øvre grænse
  `tilDato = nyeste sats + 6 mdr − 1 dag` (`krlRates.ts:210` via `getInclusivePeriodEndByMonths`),
  fx 30-09-2026 for alle fire kolonner. Rækker TAF-perioden **ud over** `tilDato`, fail-closer
  `endDate`-row-gaten (`eoRowIndkomstRows.ts:491–` ff.). Den øvre-grænse-gate ejes af punkt
  12/13; her blot bekræftet og test-dokumenteret på compute-niveau (carry-forward uden throw).
- **Udfald: uændret** (ejerskab ligger i punkt 12/13).

### S7 — `getSatserForYear` (fail-open) må ikke lække ind i KRL-stien → BEKRÆFTET IKKE BRUGT

- `getSatserForYear` (`data/lovbestemteRates.ts:898`) er fail-open. Repo-bred søgning viser
  den **kun** brugt i display/dokument-stier (`document/service/documentService.ts`,
  `components/pages/Satser.tsx`, `document/generators/satser/satserDocument.ts` + deres tests).
  KRL-reguleringsstien (`buildLoenudviklingFromKRL`, `krlRates.ts`, `reguleringsPresentation`
  KRL-grene) rører den **ikke**. ✔

### deltaPct-formel og øvrige exit-stier

- `deltaPct = ((100 + segPct) / (100 + basePct) − 1) × 100` — bekræftet (`:794`), verificeret
  numerisk (1,30/1,60/2,34/4,80 for eksemplet ovenfor).
- Ikke-finit pct eller `(100 + pct) ≤ 0` → `throw`: base (`:769`) og segment (`:790`). ✔
- Segment før effektiv base → bevidst `buildZeroDeltaSegment` (`:782–784`). ✔
- Manglende satstabel-valg → `throw` (`:604`); tom/ukendt tabel → `throw` (`:744–745`);
  manglende reguleringsdato → `throw` (`:740–741`); ingen segmenter → `throw` (`:798–799`);
  intern manglende indeks efter base → `throw` (`:787–788`). ✔
- **Store Bededag bevidst *ikke* brudpunkt** i KRL-strategien (parity med
  `eoInspektionRegulationCore` `buildKrlEntries:408` — "Statistik/KRL modellerer kun
  indeksserien"). Dokumenteret i kommentar `:747–749`. ✔
- Afrunding kun ét sted, kanonisk `roundByMethod(..., 2, 'halfAwayFromZero')`. Ingen ad hoc/
  inline-numerik. ✔

### Numerik

- `100 + pct` kan ikke give division-med-0 (guardet `≤ 0 → throw` både base og segment).
  `parseDanishToIso`-null-filtrering ved `:754–758` er nu defensivt redundant: data-guardens
  dato-tjek fejler allerede ved modul-load, hvis en dato er uparsbar.

### Multi-ansættelse

- Compute summerer per-af uden maskering (samme fælles dispatch som statistik/manuel).
  Aggregeret row-status-maskering er punkt 13's territorium.

## Fund og rettelser

1. **[Kritisk → rettet] Interiort hul i KRL-serien var ugated (S6) + rækkefølge uhåndhævet — integritets-guard tilføjet**
   - Lokation: `data/krlRates.ts` (ny `assertKRLCombinedDataIntegritet`, kaldt ved modul-load
     lige efter `KRL_IDS`).
   - Problem/Risiko: Intet fail-closed-værn forhindrede (a) et interiort hul (en tabt sats
     midt i en kolonneserie) i at ramme motoren, hvor `findLatestByDateInSortedList` ville
     videreføre en forældet, lavere akkumuleret procent stille → tavs under-regulering (S6),
     eller (b) en mis-sorteret kildetabel i at give et forkert reguleringsdato-interval i
     row-gaten (`getReguleringsDatoIntervalForKRL` truster nyeste-først-rækkefølgen uden at
     håndhæve den). Kun endepunkterne var før dækket (via row-gaten).
   - Handling: **Anvendt** — data-load-guard der (1) kræver strengt nyeste-først-rækkefølge
     med gyldige datoer, og (2) kræver at null pr. kolonne kun optræder som en sammenhængende
     prefiks i de ældste datoer (ingen defineret sats må ligge ældre end en null i samme
     kolonne). Fejler kun ved ægte datafejl; aldrig ved valid drift; ingen tal-ændring for
     eksisterende data (alle fire kolonner passerer). Selv-testet på syntetiske huller,
     mis-sortering og duplikat-datoer.
   - Resultat: Interiore huller og mis-sortering er nu **umulige** — motoren og row-gaten kan
     aldrig møde et hul eller en forkert-ordnet tabel. Tal-neutralt for eksisterende data.
     Direkte parallel til punkt 3's `assertStatistikAarKontinuitet`.

2. **[Info] Ingen dedikeret compute-test for KRL-indeksforholdet (kun "spring tomme segmenter")**
   - Lokation: `loenudviklingBeregning.test.ts`.
   - Handling: **Anvendt** — normal deltaPct, base-clamp (S1), efter-sidste-dato (S6-endepunkt)
     og fail-closed-uden-valgt-tabel tests tilføjet (se Testdækning).

## Testdækning (led 3)

**Anvendt (grønne):**
- `KRLrates.test.ts` (+6 tests, `assertKRLCombinedDataIntegritet`): gyldig tabel med null-prefiks
  OK; **interiort hul → throw**; **mis-sorteret → throw**; **duplikat-datoer → throw**; ugyldig
  fraDato → throw; faktiske data hul-frie (ingen duplikat-datoer pr. kolonne).
- `loenudviklingBeregning.test.ts` (+4 tests, KRL-grenen):
  - **Normal:** KTO (kommuner) base 01-04-2024 → `[0, +1,30 %, +1,60 %, +2,34 %, +4,80 %]`
    (indeksforhold-formlen numerisk verificeret).
  - **Base-clamp (S1):** reguleringsdato 2000-01-01 (før 01-04-2001) → zero-delta før basen,
    normal fra basen (`0/0/1,01/2,01`).
  - **Efter sidste dato (S6-endepunkt):** sidste sats 01-04-2026 videreført ubrudt til
    2027-12-31 (`+3,46 %` mod base 01-01-2025), med kommentar om dæknings-vinduet/endDate-gaten.
  - **Fail-closed:** KRL-strategi uden valgt satstabel → `throw` (`/KRL satstabel mangler/`).
- **Allerede dækket (bekræftet):** S1-alignment (motor-fallback ↔ blokerende row-error) for
  KRL i `reguleringSilentPathAlignment.test.ts` (`FORMER`-arrayet).

## Tilfældighedsfund

- **[Medium — pre-eksisterende testfejl, punkt 6/15]** `loenudviklingOffentligFailClosed.test.ts`
  (skrevet i punkt 6) **fejler i isolation på ren `main`** (uafhængigt af denne ændring —
  verificeret med `git stash`): `expect(...).toThrow()` fanger `undefined` i stedet for en
  throw ("manglende løntrin inden for dækning"). En bred sweep viser 43 fejl fordelt på 9
  filer på baseline. Dette er uden for punkt 9's scope (offentlig gren), men bør adresseres i
  punkt 6/15 — en rød fail-closed-test underminerer trust-garantien den skal bevise.
- **[Lav — punkt 12/15]** `getReguleringsDatoIntervalForKRL` (`krlRates.ts:197`) kopierer
  "+6 måneder − 1 dag"-aritmetikken (`getInclusivePeriodEndByMonths(…, 6)`) delt med
  `klLoenaftaler.ts` og `offentligLoenLookup.ts` — allerede noteret som konvergens-kandidat i
  planens punkt 12/15. Ingen adfærdsforskel; ren konsolidering.
- **[Lav — punkt 14]** `reguleringsPresentation.ts` har egne KRL-grene (`:941–972`, `:1533`,
  `:1737`) der genopbygger pct-serien til visning; læser samme `getKRLSatstabel`. Dyb PDF/Word-
  paritet ejes af punkt 14.
- Ingen død kode, fejlplacerede filer eller kontraktdrift i KRL-compute-stien.
  `buildLoenudviklingFromKRL` deler det fulde fælles fundament med statistik-grenen.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring parkeret — intet at forelægge.** S6-interiort-hul er lukket på
data-boundary med en tal-neutral integritets-guard (Fund 1), der ikke ændrer noget produceret
tal for eksisterende data. En alternativ compute-path-throw (konvertér carry-forward over et
hul til `throw` i motoren) er **bevidst ikke** anvendt: den ville være redundant (guarden gør
hullet umuligt) og *ville* være en beregningsændring i det hypotetiske hul-tilfælde. S1 er
bekræftet korrekt (gated) og allerede ende-til-ende-bundet; S7 bekræftet ikke brugt i
KRL-stien. Ingen ny blokerende fejl indført (row-gaten fandtes i forvejen), så ingen UI-ændring.

## Sammenfatning

KRL-satstabel-formen er korrekt, ensartet (deler det fulde fælles segment-/base-/afrundings-
maskineri fra punkt 1 med statistik-grenen) og deterministisk (`halfAwayFromZero`, ingen ad
hoc-numerik). Indeksforhold-formlen `deltaPct = ((100+segPct)/(100+basePct)−1)×100` er
verificeret numerisk; ikke-finit pct / `(100+pct)≤0`, ukendt/tom tabel, manglende dato og
tomme segmenter fail-closer alle. **S1/base-clamp** er bekræftet korrekt (gated), aligned med
punkt 1/3 og allerede ende-til-ende-bundet (KRL i `FORMER`-arrayet). **S6/interiort hul** var
den reelle risiko: der fandtes *ingen* kontinuitets- eller rækkefølge-guard, så et tabt trin
midt i en serie (eller en mis-sorteret tabel) ville have givet tavs under-regulering og/eller
et forkert row-gate-interval. Det er rettet med en tal-neutral data-load-guard
(`assertKRLCombinedDataIntegritet`), der gør interiore huller og mis-sortering umulige ved
modul-load og kun fejler ved ægte datafejl — anvendt direkte uden beregningsændring, i samme
mønster som punkt 3. **S6-endepunkt** (carry-forward efter sidste sats) er bevidst inden for
det 6-måneders dæknings-vindue og gated af `endDate`-row-gaten (ejes af punkt 12/13). **S7**
(`getSatserForYear` fail-open) er bekræftet **ikke** brugt i KRL-reguleringsstien. Gate grøn:
typecheck, typecheck:test, lint, 78 målrettede tests (heraf 12 nye). Tilfældighedsfund:
`loenudviklingOffentligFailClosed.test.ts` er rød på baseline (punkt 6/15).
