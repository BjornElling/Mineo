# Regulering punkt 3 — Form: Statistik (ILON12 / SBLON2)

**Dato:** 2026-07-02
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Statistik — DST-kvartalsindeks (`ILON12`, `SBLON2`). ASL-årslønsmaksimum-grenen ejes af **punkt 4** og er *ikke* rørt her.
**Primært scope:**
- `engines/loenudviklingBeregning.ts:630–727` (`buildLoenudviklingFromStatistik`) — kun ikke-ASL-grenen (`:673–727`)
- `data/statistiskeRates.ts` (kvartalsindeks-data + `getReguleringsDatoIntervalForStatistikModel`)
- `engines/reguleringsPresentation.ts` (statistik-grene)
**Afhængigheder læst:** `AGENTS.md`; `regulering-review-plan.md`; `regulering-0-baseline.md`; `regulering-1-faelles-fundament.md` (S1-afgørelsen bygges videre på, ikke genåbnet); `loenudviklingBeregning.ts:296–366` (fælles segment-/base-maskineri); `domain/eoRowEvaluation/eoRowIndkomstRows.ts:417–489` (row-gate for reguleringsvaerdi/start/slut).
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npx vitest run statistiskeRates.test.ts loenudviklingBeregning.test.ts` → ✅ 2 filer / 54 tests
- Bredere sweep: `statistiskeRates` + `loenudviklingBeregning` + `reguleringsPresentation` + `domain/eoRowEvaluation` → ✅ 24 filer / 344 tests

## Kæde fra input til færdigt produkt

Eksempel: ILON12, `Angivet månedsløn`, reguleringsdato `2020-06-01`, ét TAF-interval
`2020-06-01 … 2022-12-31`. Base = 2020K1 (140,1). Forventet per-segment `deltaPct`:
`2020-06-01→0`, `2021-01-01→+2,00 %`, `2022-01-01→+4,28 %` (verificeret numerisk).

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `statistik`; `assertUniform` på `statistikmodel` (`:413`) | Uvalgt/blandet model → `throw`/fail-closed | ✔ |
| Datakilde-opslag | `resolveStatistikModelIdFromLabel` + `getStatistiskLoenudvikling`; ukendt/undefined → `throw` (`:676`) | Model-mismatch → stille nul | ✔ (throw) |
| Reguleringsdato-forankring | `resolveAnvendtReguleringsdato`; `undefined` → `throw` (`:640/641`) | Ingen dato → stille nul-base | ✔ (throw) |
| Segment/indeks/akkumulering | `resolveEffectiveBaseEntry` (base ≤ dato); `buildSegmentsFromStartDates` deler ved kvartalsstart; `findLatestByDateInSortedList` per segment; `deltaPct=(idx/base−1)×100` | Interiort hul → carry-forward (S6); ikke-positivt indeks | ✔ (hul lukket af data-guard; indeks-guard `:698/716`) |
| Afrunding | `roundByMethod(deltaPct, 2, 'halfAwayFromZero')` — kanonisk (`:719`) | Ad hoc/dobbelt-afrunding | ✔ |
| Aggregering (af/år) | segmenter → beløb; multi-af summeres, én af-fejl → hele modellen fail-closer (baseline) | Én af maskerer andens fejl (compute) | ✔ (compute); row-lag = punkt 13 |
| Snapshot | motor-`throw` → `fail_closed` / `runtime_exception` | Throw sluges | ✔ |
| Validator/gate | row `reguleringsvaerdi` (nedre = første kvartal), `endDate` (øvre = sidste kvartal + 12 mdr − 1 dag) | Se Dækningsanalyse | ✔ |
| Skærm-præsentation | `reguleringsPresentation.ts` statistik-gren (`:871/896/1042/1479/1669`) læser samme model/deltaPct | Note beregnes uafhængigt | ✔ (dyb output-paritet = punkt 14) |
| PDF/Word-output | `reguleringSection`/docx | Punkt 14 | (punkt 14) |

## Dækningsanalyse (led 2 — tavs under-regulering)

### S1 — base-clamp (reguleringsdato før første kvartal) → BEKRÆFTET KORREKT (gated)

- **Sti:** `resolveEffectiveBaseEntry` (`:692`) ankrer basen til ældste kvartal når
  `findLatestByDateInSortedList` ikke finder en sats ≤ reguleringsdato; segmenter før
  `effectiveBaseStartIso` → `buildZeroDeltaSegment` (`:708–710`).
- **Led:** beregningsmotoren.
- **Kan valid input ramme den?** Ja — reguleringsdato før satstabellens første kvartal.
- **Bevidst korrekt eller fejl?** BEKRÆFTET KORREKT, gated — følger **præcis** punkt 1's
  konklusion. Statistik-grenen verificeret her: row-gatens nedre grænse
  `reguleringsRange.min = parseDanishToIso(interval.fraDato)`
  (`eoRowIndkomstRows.ts:426–432`), og `interval.fraDato = kvartalToStartDato(minKvartal)`
  (`statistiskeRates.ts:257`) er **identisk** med motorens første `periodStart`
  (samme kvartalsstart). Row-error (`:472`) fyrer derfor aligned med `usedFallback`;
  ingen ugated mellemzone. Under escape-hatchen nedgraderes til warning (tilsigtet).
- **Udfald: uændret (bekræftet korrekt).** Ingen beregningsændring. Testet på compute-niveau.

### S6 — hul midt i kvartalsserien (interiort manglende kvartal/år) → RETTET (data-load fail-close)

- **Sti (før):** `findLatestByDateInSortedList` (`:712`) returnerer seneste entry ≤
  segmentstart. Manglede et helt kalenderår midt i serien, ville et TAF-segment i det
  manglende år stiltiende videreføre **forrige** års indeks i stedet for at fejle →
  tavs under-regulering. Segmenterne dannes kun ved eksisterende `periodStarts`, så
  et hul giver ét bredt segment hen over det manglende år med for lavt delta.
- **Led:** datakilde-opslag / segment-beregning.
- **Kan valid input ramme den?** Ja i princippet — men **ikke med de faktiske data**.
  Serien er en *årlig trinfunktion* (K1 pr. år, plus ILON12's ekstra 2025K4). Kun en
  ægte **datafejl** (et tabt kalenderår) kan skabe et interiort hul.
- **Var der en data-guard før?** Nej. Ved modul-load fandtes kun en **duplikat-ID-guard**
  på modelniveau (`statistiskeRates.ts:192–198`). Der var **ingen** kontinuitets-/hul-guard
  på selve kvartalsserien. Et hul ville altså have passeret load og ramt motoren stille.
- **Afgørelse (i)/(ii)/(iii):** (iii) — et interiort hul er en **tavs under-regulering**,
  ikke en umulighed og ikke bevidst korrekt. Det er **rettet** med en fail-closed
  data-load-guard (se Fund 1), som gør interiore huller **umulige** ved modul-load
  frem for at ændre et produceret tal ved compute. Guarden fyrer aldrig ved valid drift
  (nye kvartaler tilføjes altid i forlængelse og bevarer års-kontinuiteten) og ændrer
  **intet** tal for eksisterende data (begge modeller er hul-frie). Den er derfor
  **ikke** en beregningsændring og er anvendt direkte (jf. arbejdsregel 2).
- **Udfald: fail-closed indført på data-boundary.** Ingen compute-path-throw parkeret
  (se FORSLAG — den ville være redundant og *ville* være en beregningsændring).

### S6-endepunkt — efter sidste kvartal → bevidst carry-forward inden for dæknings-vindue (ejes af punkt 12/13)

- **Sti:** for segmenter efter sidste kvartal videreføres sidste indeks (fx ILON12's
  2025K4-indeks ind i 2026).
- **Bevidst korrekt eller fejl?** Bevidst inden for dæknings-vinduet: row-gatens øvre
  grænse `tilDato = sidste kvartalsstart + 12 mdr − 1 dag` (`statistiskeRates.ts:262`),
  fx 30-09-2026 for ILON12. Rækker TAF-perioden **ud over** `tilDato`, fail-closer
  `endDate`-row-gaten (`eoRowIndkomstRows.ts:491–` ff.). Den øvre-grænse-gate ejes af
  punkt 12/13; her blot bekræftet og test-dokumenteret på compute-niveau.
- **Udfald: uændret** (ejerskab ligger i punkt 12/13).

### deltaPct-formel og øvrige exit-stier

- `deltaPct = (idx[segment] / idx[base] − 1) × 100` — bekræftet (`:719`), verificeret numerisk.
- Ikke-positivt indeks → `throw`: base (`:698`) og segment (`:716`) via
  `ensurePositiveFiniteNumber`. ✔
- Segment før effektiv base → bevidst `buildZeroDeltaSegment` (`:708–710`). ✔
- Ukendt model → `throw` (`:676`); tom modellabel → `throw` (`:637–638`);
  manglende reguleringsdato → `throw` (`:640–641`); ingen segmenter → `throw` (`:723–724`). ✔
- ILON12-udgåethed (ophørt efter 2025K4) er en **kommentar** i data (`:132–134`) og
  påvirker ikke beregningen: 2025K4 indgår som seneste kvartal, og carry-forward-vinduet
  gælder på lige fod med ethvert sidste kvartal. Ingen beregnings-påvirkning. ✔

## Fund og rettelser

1. **[Kritisk → rettet] Interiort hul i kvartalsserien var ugated (S6) — kontinuitets-guard tilføjet**
   - Lokation: `data/statistiskeRates.ts` (ny `assertStatistikAarKontinuitet` + modul-load-loop efter duplikat-ID-guarden).
   - Problem/Risiko: Intet fail-closed-værn forhindrede et interiort hul (tabt kalenderår)
     i at ramme motoren, hvor `findLatestByDateInSortedList` ville videreføre forrige års
     indeks stille → tavs under-regulering (S6). Kun endepunkterne var før dækket.
   - Handling: **Anvendt** — data-load-guard der kræver hvert kalenderår fra ældste til
     nyeste repræsenteret med mindst ét kvartal (flere kvartaler i samme år tilladt, fx
     2025K1+2025K4). Fejler kun ved ægte datafejl; aldrig ved valid drift; ingen
     tal-ændring for eksisterende data (begge modeller passerer). Selv-testet på syntetiske
     huller.
   - Resultat: Interiore huller er nu **umulige** — motoren kan aldrig møde et hul.
     Tal-neutralt for eksisterende data.

2. **[Info] Ingen dedikeret compute-test for DST-kvartalsindeks-grenen (kun ASL og "spring tomme segmenter")**
   - Lokation: `loenudviklingBeregning.test.ts`.
   - Handling: **Anvendt** — normal, base-clamp (S1) og efter-sidste-kvartal-tests tilføjet
     (se Testdækning).

## Testdækning (led 3)

**Anvendt (grønne):**
- `statistiskeRates.test.ts` (+6 tests, `assertStatistikAarKontinuitet`): faktiske modeller
  hul-frie; sammenhængende serie OK; K1+K4-samme-år OK; **fail-closed ved manglende år**
  (enkelt- og flerårigt hul); tom serie OK.
- `loenudviklingBeregning.test.ts` (+4 tests, statistik DST-kvartalsindeks):
  - **Normal:** ILON12 base 2020K1 → `[0, +2,00 %, +4,28 %]` (numerisk verificeret).
  - **Base-clamp (S1):** reguleringsdato før første kvartal → zero-delta før basen, normal efter.
  - **Efter sidste kvartal (S6-endepunkt):** 2025K4-indeks videreført ind i 2026 (`+5,83 %`),
    med kommentar om dæknings-vinduet/endDate-gaten.
  - **Hul-midt-i-serien (S6-interiort):** de faktiske modeller er hul-frie, så motoren aldrig
    møder et hul (guardens egne fail-closed-tests ligger i `statistiskeRates.test.ts`).

## Tilfældighedsfund

- **[Punkt 14]** `reguleringsPresentation.ts` har egne statistik-grene (`:871/896/1042/1479/1669`)
  der genberegner indeks-tabellen til visning. Læser samme model/deltaPct; dyb PDF/Word-paritet
  ejes af punkt 14 — ikke afveget her.
- **[Punkt 12]** Samme kontinuitets-hul-mønster (interiort hul uden data-guard) bør tjekkes for
  de øvrige satskilder (KRL i punkt 9; overenskomst/KL i deres punkter). Statistik er nu lukket;
  det brede staleness-/komplethedsansvar ligger i punkt 12.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring parkeret.** S6-interiort-hul er lukket på data-boundary med en
tal-neutral data-load-guard (Fund 1), der ikke ændrer noget produceret tal for eksisterende
data. En **alternativ** compute-path-throw (konvertér carry-forward over et hul til `throw` i
`buildLoenudviklingFromStatistik`) er **bevidst ikke** anvendt: den ville være redundant (guarden
gør hullet umuligt) og *ville* være en beregningsændring (ændrer output fra tal til fejl i det
hypotetiske hul-tilfælde), som kræver forelæggelse. Da guarden allerede fail-closer ved ægte
datafejl, er der intet at forelægge brugeren fra punkt 3.

S1 er **ikke** genåbnet: bekræftet korrekt (gated) per punkt 1, nu også verificeret specifikt for
statistik-grenen (row-gatens `min` = motorens første `periodStart`).

## Sammenfatning

DST-kvartalsindeks-grenen af statistik-formen er korrekt, ensartet (deler det fælles segment-/
base-maskineri fra punkt 1) og deterministisk (`halfAwayFromZero`, ingen ad hoc-afrunding).
`deltaPct = (idx[segment]/idx[base]−1)×100` er verificeret numerisk; ikke-positivt indeks, ukendt
model, manglende dato og tomme segmenter fail-closer alle. **S1/base-clamp** er bekræftet korrekt
(gated), aligned med punkt 1, nu specifikt eftervist for statistik. **S6/interiort hul** var den
reelle risiko: der fandtes *ingen* kontinuitets-guard, så et tabt kalenderår ville have givet tavs
under-regulering. Det er rettet med en tal-neutral data-load-guard (`assertStatistikAarKontinuitet`)
der gør interiore huller umulige ved modul-load og kun fejler ved ægte datafejl — anvendt direkte
inden for arbejdsreglerne, uden beregningsændring. **S6-endepunkt** (carry-forward efter sidste
kvartal) er bevidst inden for det 12-måneders dæknings-vindue og gated af `endDate`-row-gaten (ejes
af punkt 12/13). Gate grøn: typecheck, typecheck:test og 344 målrettede tests (heraf 10 nye).
