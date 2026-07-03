# Regulering punkt 10 — Form: KL-lønaftaler

**Dato:** 2026-07-03
**Status:** ✅ Gennemgået
**Reguleringsform(er):** KL-lønaftaler (trinvis kæde-opregulering af lønnen med afrunding på hvert trin; bevidst alternativ beregningsmetode og alternative visninger, jf. `docs/domain/taf/kl-loenaftaler-regulering.md`).
**Primært scope:**
- `engines/klLoenaftalerReguleretLoen.ts` (hele filen — kæde-resolveren `loenAt`/`deltaPctAt`)
- `engines/loenudviklingBeregning.ts:845–885` (`buildLoenudviklingFromKlLoenaftaler` — segmentbrudpunkter) og `:1403–1465` (deltaPct-override + `reguleretLoenOre`)
- `data/klLoenaftaler.ts` (periodesatser, `getReguleringsDatoIntervalForKlLoenaftaler`)
- KL-særvisninger i `engines/reguleringsPresentation.ts` (`buildReguleringsvaerdierTableData` :981–1023, `buildReguleringIndexRows` :1062–1095) og download-/EO-dokument (`document/generators/klLoenaftaler/klLoenaftalerDocument.ts`, `document/generators/eo/sections/opgoerelseSection.ts`, `tafFordelt/*`)
**Afhængigheder læst:**
- `AGENTS.md`; `regulering-review-plan.md` (punkt 10-scope + silent-path S4/S6); `docs/domain/taf/kl-loenaftaler-regulering.md` (§5-invarianter)
- Skabelon/kvalitetsbar: `regulering-8-form-manuel-procentsats.md`, `regulering-9-form-krl-satstabel.md`, `regulering-6-form-overenskomst-offentlig.md`
- Nedstrøms: `engines/tafPerYearDerived.ts` (bruger `reguleretLoenOre`), `engines/sygeferiegodtgoerelse.ts:1041–1072` (SFGG-reproduktionen), `eoRowEvaluation/eoRowIndkomstRows.ts:444–547` (row-gate slut/start/reguleringsvaerdi), `validators/erstatningsopgoerelseValidator.ts:930–991` (coverage-validator)
- Invariant-noten `loenudviklingBeregning.ts:63–70` (alle `throw` → `fail_closed`/`runtime_exception`)
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npm run lint` → ✅ exit 0 (`--max-warnings 0`)
- `npx vitest run klLoenaftalerReguleretLoen klLoenaftalerFailClosed reguleringSilentPathAlignment` → ✅ 3 filer / 23 tests (heraf 12 nye)
- `npx vitest run loenudviklingBeregning tafPerYearDerived klLoenaftaler reguleringsPresentation reguleringSection eoInspektionRegulationCore` → ✅ 10 filer / 231 tests
- `npx vitest run klLoenaftalerPdf klLoenaftalerWord indkomstBreakdownVisibility sygeferie` → ✅ 6 filer / 134 tests

## Kæde fra input til færdigt produkt

Eksempel: `KL-lønaftaler`, reguleringsdato 2024-04-01, basisløn 30.000,00 kr./md., TAF 2024-04-01 → 2026-12-31.
Forventet trinvis kæde (afrunding på hvert trin):
30.000,00 →(1,30 % pr. 01-10-2024) 30.390,00 →(0,30 % pr. 01-10-2025) 30.481,17 →(0,75 % pr. 01-11-2025)
30.709,78 →(2,40 % pr. 01-04-2026) 31.446,81 →(0,50 % pr. 01-10-2026) 31.604,04.
`reguleretLoenOre` pr. segment = den afrundede løn i øre; `deltaPct` = `(reguleret/basis − 1) × 100` i fuld
præcision (8 decimaler). Verificeret i `loenudviklingBeregning.test.ts:331–382` + ny `klLoenaftalerReguleretLoen.test.ts`.

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `klLoenaftaler` (`:407`); konsolideret bærer kun reguleringsdato + tafRanges (`:619–629`) | Uvalgt → `throw` opstrøms | ✔ |
| Datakilde-opslag | `klLoenaftalerRaekker` (én periodesatsserie, ældste-først) | Tom tabel → `throw` (`:854`) | ✔ |
| Reguleringsdato-forankring | kanonisk `resolveAnvendtReguleringsdato`; basisløn = løn pr. reguleringsdatoen (`løn_0`), IKKE en tabel-clamp | Manglende reguleringsdato → `throw` (`:851`) | ✔ |
| Segment/indeks/akkumulering | `buildLoenudviklingFromKlLoenaftaler`: brudpunkter fra KL-datoer i TAF-vinduet (`buildSegmentsFromStartDates` + `buildZeroDeltaSegment`); **selve reguleringen** sættes senere fra kæde-resolveren, ikke som indeksforhold | Uparsbar dato droppes i segment-byggeren (men resolveren **fail-closer**, se S4) | ✔ (kæde bevidst trinvis; ingen akkumuleret indeks) |
| Afrunding | Trinvis: `roundKroner(current × (1 + pct/100))` pr. trin (bevidst akkumulerende afrunding, §1.2); `deltaPct` afrundes til 8 decimaler (fuld præcision) | Dobbelt-/slut-afrunding ville bryde §5.2 | ✔ (delt `roundKroner`/`roundByMethod`; trinvis afrunding tilsigtet) |
| deltaPct-override + reguleretLoenOre | `:1410–1424` bygger resolver fra `baseLoenRounded`; `deltaPct = resolver.deltaPctAt(segment.fra)` (fuld præcision), `reguleretLoenOre = toOre(resolver.loenAt(segment.fra))` | Segmentets rå `deltaPct` (0) ville give tavs nul-regulering hvis override manglede | ✔ (override rammer alle KL-segmenter; `reguleretLoenOre` sat) |
| Aggregering (af/år) | `tafPerYearDerived.ts:161–192` bruger **`reguleretLoenOre`** autoritativt ved kalenderårssplit (`toOre(roundKroner((reguleretLoenOre/100) × antal))`) | År-split via `deltaPct` ville dobbelt-afrunde | ✔ (autoritativ enhedsløn; testet `tafPerYearDerived.test.ts:1231`) |
| Snapshot | `reguleretLoenOre` valgfrit i canonical-schema; motor-`throw` → `fail_closed`/`runtime_exception` | Throw sluges → zero-delta | ✔ (defensive invarianter `:63–70`) |
| Validator/gate | `validateLoenudviklingDataCoverage` (`:930–991`): reguleringsdato efter KL-tilDato (31-03-2027) → `error`; row-gate `reguleringsvaerdi`/`startvaerdi`/`slutvaerdi` (`eoRowIndkomstRows.ts:444–547`) | Se Dækningsanalyse (S6) | ✔ (KL indgår i coverage-validator + row-gate) |
| Skærm-præsentation | Reguleringsværdier-tabel: `Fra-dato \| Regulering` (periodesats, INGEN akkumuleret kolonne, `:1019`); Beregnet regulering-tabel: `Lønudvikling` gentager periodesatsen + `Reguleret løn` (`:1062–1095`) | Akkumuleret visning ville bryde §5.1 | ✔ (ingen akkumuleret kolonne; se F3-note om reproduktion) |
| PDF-output | Beregnet regulering-variant (`reguleringSection.ts`); indkomstlinje `antal á reguleret løn kr.` uden faktor (`opgoerelseSection.ts:523–538`, bruger `reguleretLoenOre`); download-dokument `Dato \| Regulering` (`klLoenaftalerDocument.ts`) | Faktor-tekst eller basisløn ville vise forkert | ✔ (`reguleretLoenOre ?? unitLoen`; testet `reguleringSection.test.ts:621`, `indkomstBreakdownVisibility`) |
| Word-output | Samme model som PDF (`klLoenaftalerWordContent.test.ts`) | Paritet med PDF | ✔ (testet grønt) |

## Dækningsanalyse (led 2 — tavs under-regulering)

### S4 — kæden `continue`-springer et trin ved manglende pct (`klLoenaftalerReguleretLoen.ts:63–64`, gammel form) — BEKRÆFTET UNÅELIG for valide data + FAIL-CLOSED-HÆRDET

- **Sti (før):** resolveren itererede KL-**datoerne** (`klLoenaftalerDatoerAsc`) og slog dernæst periodesatsen op via `getKlLoenaftalerReguleringPctForDato(da)`; ved `pct === undefined` → `continue` (stille sprunget trin).
- **Led:** beregningsmotoren (kæde-resolveren, kaldt fra deltaPct-override `:1410`).
- **Kan valid input ramme den? — NEJ.** Både dato-listen OG opslags-mappen (`klPeriodeReguleringPctByDato`) udledes af **samme** array `klLoenaftalerRaekker`. For hver `da` trukket fra det array findes der pr. konstruktion en entry i mappen (og `klLoenaftaler.test.ts` hævder én entydig række pr. dato). `getKlLoenaftalerReguleringPctForDato` returnerer derfor **altid** en defineret, finit `number` for en dato fra kilden. Det stille `continue` var **dead code** — uopnåeligt med den nuværende single-source-datamodel. Det samme gælder segment-byggerens og præsentationens stille frafiltrering af uparsbare datoer: alle 39 kilde-datoer er valide danske datoer (`klLoenaftaler.test.ts`), så `parseDanishToIso` fejler aldrig.
- **Bevidst korrekt eller fejl? → LATENT FEJLKLASSE, hærdet.** Springet ændrer ikke tal for valide komplette data i dag, men det var netop den fejlklasse reviewet jager: en fremtidig datafejl (en KL-række med en korrupt/ikke-finit sats eller en uparsbar dato) ville få kæden til at **springe et reguleringstrin over** og producere en for lav akkumuleret løn **uden synlig fejl** (tavs under-regulering). Fordi dato og sats i den gamle form blev udledt via to separate kanaler, var der desuden en reel drift-risiko.
- **Udfald: FAIL-CLOSED indført (tal-neutral direkte rettelse).** Kæde-resolveren er omstruktureret til at bygge kæden **direkte fra kilde-rækkerne** (dato OG `reguleringPct` fra samme række), så de to aldrig kan komme ud af sync via et separat opslag. De to tidligere stille drop er konverteret til **defensive `throw`** (fanges som `runtime_exception`, jf. `:63–70`):
  - uparsbar KL-dato → `throw` ("uparsbar KL-lønaftaler-dato");
  - ikke-finit periodesats → `throw` ("ikke-finit KL-lønaftaler-periodesats").
  Dette er **tal-neutralt for valide komplette data** (samme værdier i samme rækkefølge — bevist af de eksisterende KL-kæde-tests der stadig er grønne + nye) og kaster **kun** ved korrupt data der ellers ville give tavs under-regulering. Ingen brugervendt ændring. `getKlLoenaftalerReguleringPctForDato` bevares (bruges stadig af præsentationen og data-testen).

### S6 — TAF-periode ud over sidste KL-sats (`klLoenaftalerReguleretLoen.ts:loenAt` carry-forward) — BEKRÆFTET GATED (bevidst carry-forward, synligt blokeret)

- **Sti:** `loenAt(iso)` returnerer den sidste kæde-entrys løn for enhver dato efter sidste KL-dato (01-10-2026) — bevidst carry-forward af den sidst regulerede løn, **uden throw** i selve resolveren.
- **Led:** beregningsmotoren (carry-forward) / row-gate + validator (blokerende).
- **Kan valid input ramme den?** Ja — en TAF-periode der slutter efter KL-dækningen.
- **Bevidst korrekt eller fejl? → BEKRÆFTET GATED.** Carry-forward'en er bevidst (en 6-måneders periode-model som KRL/offentlig), men den er **ikke ugated**: row-gatens `reguleringsRange.max` for KL = `getReguleringsDatoIntervalForKlLoenaftaler().tilDato` = **31-03-2027** (nyeste 01-10-2026 + 6 mdr − 1 dag). `slutvaerdi`-row markeres blokerende `error`, når TAF-slutdatoen ligger mere end `allowReguleringMedUdloebMedMaaneder` (default 6) måneder efter dét — nøjagtig samme mekanisme som KRL (punkt 9) og offentlig overenskomst (punkt 6), ejet af punkt 12/13. Desuden gates en **reguleringsdato** efter tilDato blokerende i `validateLoenudviklingDataCoverage` (`:952/:974–990`, "Lønregulering kan ikke beregnes efter 31-03-2027…"). Inden for `tilDato` (og inden for udløbsvinduet) er carry-forward'en korrekt (perioden dækkes af sidste sats). Motor og gate er alignet: resolverens carry-forward starter efter 01-10-2026, og gaten behandler dækning frem til 31-03-2027 (= den 6-måneders periode sidste sats dækker), hvorefter den fyrer.
- **Udfald: uændret (bekræftet gated).** Ingen beregningsændring; ny ende-til-ende-test binder motorens stille carry-forward til den blokerende `slutvaerdi`-row (analog til S1/S2/S3, her for efter-sidste-sats).

### Grænser

- **Reguleringsdato før første KL-sats (01-04-2005):** KL clamper IKKE basen til ældste sats (modsat statistik/KRL) — basisløn er brugerens løn pr. reguleringsdatoen, og satser anvendes først fra første KL-dato > reguleringsdato. En reguleringsdato < 01-04-2005 gates blokerende af `reguleringsvaerdi`-row (`min` = 01-04-2005) og af coverage-validatoren; ikke en tavs under-regulering. (Mineo kan under alle omstændigheder ikke beregne før 2005-01-01, og 01-04-2005 er 0 %-basisdatoen.)
- **Reguleringsdato præcis på en KL-dato:** `iso <= reguleringsdatoIso` springes over — basislønnen afspejler niveauet dér; næste KL-dato > reguleringsdato starter reguleringen. Korrekt.
- **Efter sidste KL-sats:** carry-forward, gated (S6).
- **Hul mellem KL-datoer:** eksisterer ikke som begreb — kæden anvender hver KL-dato sekventielt; `loenAt` returnerer seneste kæde-entry ≤ dato (carry-forward mellem trin er selve modellen). Intet interiort hul kan give tavs under-regulering.
- **Basisløn ≤ 0:** `deltaPctAt` returnerer 0 (ingen division med nul); motoren afviser i øvrigt `baseLoen <= 0` opstrøms (`:1371`).

### Numerik

- Trinvis `roundKroner` (= `roundByMethod(·, 2, 'halfAwayFromZero')`) på hvert trin — bevidst akkumulerende afrunding (§1.2), delt kanonisk helper. `deltaPct` afrundes til 8 decimaler (`halfAwayFromZero`) for at fjerne flydende-komma-støj og bevare §5.2. Ingen ad hoc/inline-afrunding; ingen `NaN`/`Infinity` (nu fail-closed).

### Multi-ansættelse

- KL bærer kun reguleringsdato + tafRanges i konsolideret; per-af summeres i compute uden maskering. Aggregeret row-status-maskering er punkt 13's territorium.

## Fund og rettelser

1. **[Høj → rettet direkte] S4: kæden kunne stille springe et reguleringstrin (tavs under-regulering) ved korrupt data.**
   - Lokation: `klLoenaftalerReguleretLoen.ts:51–84`.
   - Problem/Risiko: To stille `continue`/frafiltreringer (manglende pct, uparsbar dato) kunne springe et reguleringstrin over og give for lav akkumuleret løn uden synlig fejl. Unåelige for valide data i dag (dato + sats udledtes af samme array), men latent drift-/data-fejlklasse.
   - Handling: Omstruktureret til at bygge kæden **direkte fra kilde-rækkerne** (dato + `reguleringPct` fra samme række — eliminerer det redundante `getKlLoenaftalerReguleringPctForDato`-opslag og desync-risikoen) og konverteret begge stille drop til **defensive `throw`** (→ `runtime_exception`). Fjernede ubrugt import (`DanishDateString`, `getKlLoenaftalerReguleringPctForDato`).
   - Resultat: **Tal-neutralt for valide komplette data** (bevist: alle eksisterende KL-kæde-tests grønne + nye invariant-tests). KL fail-closer nu ved korrupt data i stedet for at under-regulere i stilhed. Ingen brugervendt ændring.

2. **[Bekræftet gated] S6: carry-forward efter sidste KL-sats er bevidst og synligt blokeret** — se Dækningsanalyse. `slutvaerdi`-row-error + coverage-validator (tilDato 31-03-2027). Ingen beregningsændring. Ny ende-til-ende-test binder motor ↔ row-gate.

3. **[Bekræftet korrekt] §5-invarianterne holder ende-til-ende:**
   - §5.1 (aldrig akkumuleret visning): reguleringsværdier-tabellen viser periodesatsen uden akkumuleret kolonne (`:1019`); Beregnet regulering gentager periodesatsen. ✔
   - §5.2 (`basisløn × (1 + deltaPct/100)` reproducerer trinvist afrundet løn): bevist for alle KL-datoer i ny resolver-test. ✔
   - §5.3 (`reguleretLoenOre` autoritativ): brugt autoritativt i indkomstlinjer (`opgoerelseSection.ts`, `tafFordelt/*`) og år-split (`tafPerYearDerived.ts`). ✔
   - §5.4 (SFGG reproducerer `reguleretLoenOre`): `assertKlSegmentDeltaMatchesReguleretLoen` (`sygeferiegodtgoerelse.ts:1041`) håndhæver det med `throw` ved mismatch; ny resolver-test replikerer SFGG's øre-formel og bekræfter identitet. ✔
   - §5.5 (trinvis afrunding bevidst): bevaret uændret. ✔

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring — intet at forelægge.** S4-rettelsen er en tal-neutral fail-closed-hærdning + strukturel konsolidering (dato og sats fra samme kilde-række); den kaster kun ved korrupt data der ellers ville give tavs under-regulering, og er bevist tal-identisk for valide data. S6 er bekræftet gated uden ændring. Ingen ny brugervendt blokerende fejl for valide input (gaten fandtes allerede for efter-sidste-sats).

## Testdækning (led 3)

**Nye tests (12), alle grønne:**
- `klLoenaftalerReguleretLoen.test.ts` (**6**, ny fil — dedikeret resolver-enhedstest):
  1. trinvis opregulering + afrunding pr. trin (den fulde kæde 30.000 → 31.604,04).
  2. reguleringsdatoer ≤ reguleringsdato springes over (basisløn gælder indtil første KL-dato).
  3. **§5.2:** `basisløn × (1 + deltaPct/100)` reproducerer den trinvist afrundede løn på hver KL-dato (fuld-præcisions delta).
  4. **§5.4-forudsætning:** SFGG-sporets øre-reproduktion (`roundKroner((baseLoenOre/100) × (1 + delta/100))`) rammer nøjagtig `loenAt` (kilden til `reguleretLoenOre`).
  5. efter sidste KL-sats videreføres den sidst regulerede løn (carry-forward, ingen throw).
  6. basisløn ≤ 0 → `deltaPct` 0 (ingen division med nul).
- `klLoenaftalerFailClosed.test.ts` (**3**, ny fil — S4 fail-closed via mocket datamodul, mønster fra `loenudviklingOffentligFailClosed.test.ts`):
  1. ikke-finit periodesats → `buildLoenudviklingModel` **kaster** (degraderer ikke til sprunget trin).
  2. uparsbar reguleringsdato → **kaster** (springer ikke stille et trin over).
  3. gyldige (mockede) data → beregnes uden throw, `reguleretLoenOre` korrekt (guarden rammer kun korrupt data).
- `reguleringSilentPathAlignment.test.ts` (**+3**, S6-blok):
  1. motoren carry-forwarder efter sidste KL-sats uden at kaste (`reguleretLoenOre` = 3.160.404).
  2. `slutvaerdi`-row fyrer `error` når TAF-slut ligger efter dækning + udløbsvindue.
  3. `slutvaerdi`-row er `ok` når TAF-slut = dækningens tilDato (31-03-2027).
- Bekræftet stærk eksisterende dækning: `loenudviklingBeregning.test.ts:279–382` (KL-kæde, deltaPct, arbejdsdage-spring), `tafPerYearDerived.test.ts:1231` (år-split via `reguleretLoenOre`), `reguleringSection.test.ts:621`/`klLoenaftalerWordContent.test.ts` (Beregnet regulering PDF/Word), `indkomstBreakdownVisibility` (indkomstlinje), `klLoenaftaler.test.ts` (kildedata + interval).

## Tilfældighedsfund

- **[Lav — konvergens, punkt 14]** `buildReguleringIndexRows` KL-grenen (`reguleringsPresentation.ts:1072`) **genberegner** den viste regulerede løn fra `deltaPct` (`roundByMethod((unitLoenOre/100) × (1 + deltaPct/100), 2, …)`) i stedet for at bruge segmentets autoritative `reguleretLoenOre` direkte (som PDF/Word-indkomstlinjerne gør). Tal-identisk i dag pga. §5.2, men en unødig anden kilde til samme værdi. Kandidat til at læse `segment.reguleretLoenOre` direkte i visningen (single source of truth). Ejes af punkt 14 (præsentations-paritet).
- **[Lav — konvergens, punkt 12]** `getReguleringsDatoIntervalForKlLoenaftaler` (`klLoenaftaler.ts:139–154`) kopierer "+6 måneder − 1 dag"-aritmetikken via `getInclusivePeriodEndByMonths(…, 6)` — samme kopi som KRL og offentlig. Allerede noteret som konsolideringsmål i punkt 12/15.
- Ingen død kode, fejlplacerede filer eller kontraktdrift tilbage i KL-compute-stien efter S4-rettelsen (`DanishDateString`-import og det redundante pct-opslag fjernet fra resolveren). `klLoenaftalerReguleretLoen.ts` er nu velafgrænset, single-source og fail-closed.

## Sammenfatning

KL-lønaftaler-formen er korrekt, ensartet (deler `resolveAnvendtReguleringsdato`, `buildSegmentsFromStartDates`, `roundKroner`/`halfAwayFromZero`) og bevidst afvigende dér hvor domænet kræver det (trinvis kæde-opregulering med afrunding pr. trin; ingen akkumuleret visning) — afvigelserne er bevaret, ikke "forenet". Alle §5-invarianter er verificeret ende-til-ende: `deltaPct` i fuld præcision reproducerer den trinvist afrundede løn, `reguleretLoenOre` er den autoritative enhedsløn i indkomstlinjer og årssplit, og SFGG-sporet reproducerer den. **S4 er afgjort: det stille trin-spring var unåeligt for valide data (dato + sats fra samme kilde), men er nu fail-closed-hærdet** — kæden bygges direkte fra kilde-rækkerne, og korrupt data (ikke-finit sats / uparsbar dato) kaster (→ `runtime_exception`) i stedet for at under-regulere i stilhed; tal-neutralt for valide data. **S6 er afgjort: carry-forward efter sidste KL-sats er bevidst og gated** af `slutvaerdi`-row-error (tilDato 31-03-2027) + coverage-validator — samme mekanisme som KRL/offentlig, nu bundet ende-til-ende. Ingen beregningsændring, intet at forelægge. Gate grøn: typecheck, typecheck:test, lint, 23 målrettede + 231 + 134 tests (heraf 12 nye).
