# Regulering punkt 4 — Form: Statistik ASL-årslønsmaksimum

**Dato:** 2026-07-02
**Status:** ✅ Gennemgået
**Reguleringsform(er):** Statistik — ASL-årslønsmaksimum-grenen (§ 24). DST-kvartalsindeks (ILON12/SBLON2) ejes af **punkt 3** og er *ikke* rørt her.
**Primært scope:**
- `engines/loenudviklingBeregning.ts:649–676` (ASL-grenen i `buildLoenudviklingFromStatistik`) + `buildAslReguleringsSegments` (`:1634`)
- `satser/opreguleringsmotorer.ts` (`opregulerMedAslAarsloensmaksimum`)
- `satser/aslAarsloensmaksimum.ts` (`resolveAslAarsloensmaksimumForAar`, kanonisk gateway)
- `data/lovbestemteRates.ts` (`aarsloenAslMax`, ny `assertAarsloenAslMaxKontinuitet`)
**Afhængigheder læst:** `AGENTS.md`; `regulering-review-plan.md`; `regulering-0/1/3`-review; `validators/erstatningsopgoerelseValidator.ts:930–991` (`validateLoenudviklingDataCoverage`, ASL-grenen); `domain/eoRowEvaluation/eoRowIndkomstRows.ts:417–508` (row-gate, statistik-interval + endDate-grace); `data/statistiskeRates.ts:200–270` (`assertStatistikAarKontinuitet` + ASL-interval); `project_asl_maks_gateway`, `project_opreguleringsmotorer`.
**Tests kørt:**
- `npm run typecheck` → ✅ exit 0
- `npm run typecheck:test` → ✅ exit 0
- `npx vitest run lovbestemteRates opreguleringsmotorer aslAarsloensmaksimum loenudviklingBeregning erstatningsopgoerelseValidator` → ✅ 5 filer / 199 tests

## Kæde fra input til færdigt produkt

Eksempel: `ASL-årslønsmaksimum`, `Angivet månedsløn`, reguleringsdato `2020-06-01` (basisår 2020),
ét TAF-interval `2020-06-01 … 2022-12-31`. Base = `aarsloenAslMax[2020]`. Forventet per-år `deltaPct`:
`2020→0`, `2021→(564000/551000−1)×100 = +2,36 %`, `2022→(570000/551000−1)×100 = +3,45 %` (verificeret numerisk mod tabellen).

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | `resolveReguleringsStrategi` → `statistik`; `assertUniform` på `statistikmodel` (`:418`); `isAslStatistikModel`-dispatch (`:649`) | Uvalgt/blandet model → `throw` | ✔ |
| Datakilde-opslag | `resolveAslAarsloensmaksimumForAar(år)` (kanonisk gateway) — basisår `:651`, per-år `:664` | Rå `aarsloenAslMax[år]` uden for gateway | ✔ (single-source-guard) |
| Reguleringsdato-forankring | basisår = `reguleringsdato.slice(0,4)`; manglende dato → `throw` (`:646`) | Ingen dato → stille nul-base | ✔ (throw) |
| Segment/indeks/akkumulering | `buildAslReguleringsSegments` (kalenderårs-split, kanonisk `splitIsoRangeByCalendarYearsInclusive`); indeksforhold via `opregulerMedAslAarsloensmaksimum` per år | Interiort hul / efter sidste år → carry-forward | ✔ **eksakt år-opslag → throw ved manglende år, ingen carry-forward** |
| Afrunding | `roundByMethod(deltaPct, 2, 'halfAwayFromZero')` (`:673`) | Ad hoc/dobbelt-afrunding | ✔ |
| Aggregering (af/år) | segmenter → beløb; multi-af summeres, én af-fejl → hele modellen fail-closer | Én af maskerer andens fejl (compute) | ✔ (compute); row-lag = punkt 13 |
| Snapshot | motor-`throw` → `fail_closed` / `runtime_exception` | Throw sluges | ✔ (eoSnapshotRuntimeException.test.ts) |
| Validator/gate | `validateLoenudviklingDataCoverage` ASL-gren (`:956`) — endepunkts-baseret via motoren + row-gate (statistik-interval, min=01-01-minYear, max=31-12-maxYear) | Se Dækningsanalyse (F3) | ✔ (med F3-note) |
| Skærm/PDF/Word | fælles statistik-visning (nedstrøms) | Punkt 14 | (punkt 14) |

## Dækningsanalyse (led 2 — tavs under-regulering)

Nøgleobservation: **ASL-grenen carry-forwarder aldrig.** Hvor DST-kvartalsindeks bruger
`findLatestByDateInSortedList` ("seneste indeks ≤ dato"), slår ASL-grenen indekset op for **hvert
kalenderårs-segment eksakt** (`resolveAslAarsloensmaksimumForAar(segment.year)`, `:664`) og kaster
via `ensurePositiveFiniteNumber` (`:665`) ved et manglende år. Dermed er **både interiort hul (S6)
og efter-sidste-år strukturelt fail-closed i compute-motoren** — der findes ingen tavs
under-regulerings-sti i selve beregningen.

### S1/base-clamp — reguleringsdato før første ASL-år → fail-closed (stærkere end øvrige former)

- **Sti:** basisår < tabellens `minYear` (2005) → `resolveAslAarsloensmaksimumForAar(baseYear)`
  returnerer `undefined` → `ensurePositiveFiniteNumber(..., 'mangler ASL basisindeks')` **kaster** (`:652–655`).
- **Bevidst korrekt eller fejl?** BEKRÆFTET KORREKT. Modsat DST/KRL's stille anker-til-ældste-sats
  (S1, gated i row-laget) **kaster** ASL-grenen hårdt. Row-gaten fyrer desuden aligned
  (`reguleringsRange.min = 01-01-minYear`), og validatoren giver en ren feltfejl ("ASL-maks-sats
  mangler for 2004") — dækket af eksisterende validator-test + `loenudviklingBeregning.test.ts:366`.
- **Udfald: uændret.** Ingen S1-fallback i ASL-grenen.

### Segment før basisåret → bevidst zero-delta

- **Sti:** `segment.year < baseYear` → `buildZeroDeltaSegment` (`:661–663`).
- **Kan valid input ramme den?** Ja — en TAF-periode der rækker bagud før reguleringsdatoen.
- **Bevidst korrekt eller fejl?** BEKRÆFTET KORREKT — identisk semantik med alle øvrige former
  ("ingen regulering før reguleringsdatoen"; basisniveauet gælder). Ikke en tabt regulering.
- **Udfald: uændret** (nu test-dækket, se Testdækning).

### S6 interiort hul — RETTET (data-load kontinuitets-guard, tal-neutral)

- **Sti (compute):** allerede fail-closed — et interiort manglende år → `resolveAslAarsloensmaksimumForAar`
  → `undefined` → throw (`:665`). Så **ingen tavs under-regulering** i motoren.
- **Den reelle svaghed lå i validator/motor-asymmetrien:** dæknings-**valideringen**
  (`validateLoenudviklingDataCoverage:956–971`) er **endepunkts-baseret** — den kalder
  `opregulerMedAslAarsloensmaksimum({kildeAar: baseYear, maalAar: maxTafYear})`, og den motor er per
  kontrakt (og eksplicit test, `opreguleringsmotorer.test.ts:54`) et **rent forhold** idx[målår]/idx[kildeår]
  der KUN tjekker de to endepunktsår. Et interiort hul (fx et tabt 2015 mellem 2014 og 2016) ville
  derfor **passere valideringen** men **kaste i compute-motoren** for hul-årets segment →
  `fail_closed`/`runtime_exception` frem for den lovede, målrettede feltfejl.
- **Afgørelse:** dette er den præcise ASL-analog til statistik-S6 (punkt 3). Løst med en
  **fail-closed data-load-guard** `assertAarsloenAslMaxKontinuitet` (se Fund 1), der gør interiore
  huller **umulige** ved modul-load og dermed gør validatorens endepunkts-tjek beviseligt
  tilstrækkeligt (endepunkter dækket + kontinuitet ⇒ alle mellemår dækket). Guarden er tal-neutral
  (tabellen er sammenhængende 2005–2026), fyrer kun ved ægte datafejl, og er anvendt direkte
  (arbejdsregel 2) — ingen beregningsændring.
- **Udfald: fail-closed indført på data-boundary.**

### S6 efter sidste år → fail-closed (ingen carry-forward) — RETTET-test

- **Sti:** segment i `maxYear+1` → `resolveAslAarsloensmaksimumForAar` → `undefined` → throw (`:665`).
- **Bevidst korrekt eller fejl?** BEKRÆFTET KORREKT — ASL har intet dæknings-vindue (modsat DST's
  12-mdr-carry-forward), fordi hvert år kræver sit eget indeks. Validatoren fanger det med en ren
  feltfejl ("ASL-maks-sats mangler for 2027"); motoren fail-closer som sikkerhedsnet.
- **Udfald: uændret; nu test-dækket i både motor og validator (før manglede efter-sidste-år-testen).**

## Fund og rettelser

1. **[Høj → rettet] Validator/motor-asymmetri gjorde et interiort ASL-hul til en tavs `runtime_exception`**
   - Lokation: `data/lovbestemteRates.ts` (ny `assertAarsloenAslMaxKontinuitet` + modul-load-kald);
     baggrund: `validateLoenudviklingDataCoverage:956` (endepunkts-baseret) vs. motoren `:664` (per-år).
   - Problem/Risiko: Compute-motoren er per-år fail-closed, men dæknings-valideringen tjekker kun
     de to endepunktsår (motoren er per kontrakt ren endepunkts-ratio). Et interiort hul ville
     passere valideringen og først kaste i compute → generisk `fail_closed`/`runtime_exception` uden
     den lovede målrettede feltfejl. Ikke en tavs under-regulering (motoren kaster), men et brud på
     "synlig, målrettet fejl frem for generisk fail-close" og direkte parallel til statistik-S6.
   - Handling: **Anvendt** — data-load-guard der kræver hvert kalenderår fra `minYear` til `maxYear`
     repræsenteret (ser kun på år-nøglens tilstedeværelse; positiv-finit-værnet bor fortsat i
     `resolveAslAarsloensmaksimumForAar`). Kun `aarsloenAslMax` (maksimum) — `aarsloenAslMin`
     udelader bevidst 2024 og er eksplicit undtaget. Tal-neutralt (tabellen er sammenhængende).
   - Resultat: Interiore huller er nu umulige ved modul-load; validatorens endepunkts-tjek er
     beviseligt tilstrækkeligt. Selv-testet på syntetiske huller.

2. **[Info] Redundant `manglendeAar`-tjek i ASL-grenen (bevidst belt-and-suspenders)**
   - Lokation: `loenudviklingBeregning.ts:666–672`.
   - Observation: Motoren kaldes med et 2-element-map `{[baseYear]: baseIndex, [segment.year]: segmentIndex}`
     **efter** at begge indeks allerede er valideret positiv-finitte (`:652`, `:665`). `manglendeAar`
     kan derfor aldrig være ikke-tom her. Det er redundant defensiv kode, ikke en fejl. **Bevaret** —
     fjernelse ville være en ren mikro-oprydning uden værdi og øge risikoen for utilsigtet drift i
     trust-kritisk kode. Noteret, ikke ændret.

3. **[Lav → punkt 13/14] Row-gate endDate-grace vs. validator/motor for ASL — display-inkonsistens (ikke tavs under-reg)**
   - Lokation: `eoRowIndkomstRows.ts:491–508` (endDate-grace `allowReguleringMedUdloebMedMaaneder`).
   - Observation: endDate-row-gaten har et grace-vindue der viser "(< N måneder)" = status `ok` for en
     TAF-slutdato kort efter `reguleringsRange.max`. For DST er det aligned med motorens carry-forward.
     For **ASL** carry-forwarder motoren aldrig, og validatoren giver en **blokerende** fejl for samme
     efter-2026-scenarie. Nettoresultat er **sikkert** (download blokeres af validator-fejlen), men
     row-visningen "ok" og den blokerende validator-fejl er indbyrdes inkonsistente for ASL.
   - Handling: **Parkeret til punkt 13/14** (grace-vinduets ejerskab). Ingen tavs under-regulering;
     ingen beregningsændring. Noteret her som tilfældighedsfund fra kæde-gennemgangen.

## Testdækning (led 3)

**Anvendt (grønne):**
- `lovbestemteRates.test.ts` (+7, `assertAarsloenAslMaxKontinuitet`): faktisk tabel sammenhængende;
  syntetisk sammenhængende OK; enkelt-år/tom OK; **fail-closed ved enkelt + flerårigt interiort hul**;
  NaN-værdi = hul; 0-værdi = TILSTEDE (hul = manglende år-nøgle, ikke dårlig værdi).
- `loenudviklingBeregning.test.ts` (+3, ASL compute):
  - **Normal per-år-split:** base 2020 → `[0, +2,36 %, +3,45 %]` (indeksforhold verificeret dynamisk mod tabellen).
  - **Segment før basisår → zero-delta** (2021 zero når basisår=2022; 2023 regulerer normalt).
  - **Efter sidste år → throw** (`/ASL indeks/`; `maxYear+1` har intet indeks, ingen carry-forward).
- `erstatningsopgoerelseValidator.test.ts` (+1): **ASL efter sidste indeksår → blokerende feltfejl**
  ("ASL-maks-sats mangler for {maxYear+1}") — modstykke til den eksisterende før-første-år-test.
- Bekræftet stærk eksisterende dækning: `opreguleringsmotorer.test.ts` (motor-ratio, endepunkts-only,
  NaN/decimal, dedup), `aslAarsloensmaksimum.test.ts` (gateway), `loenudviklingBeregning.test.ts:366/396`
  (basisindeks-throw, kalenderårs-split).

## Tilfældighedsfund

- **[Punkt 13/14]** endDate-grace vs. ASL-throw display-inkonsistens (Fund 3).
- **[Punkt 12]** Samme kontinuitets-mønster bør bekræftes for øvrige år-baserede satskilder
  (`reguleringssats` bruges dog af den **akkumulerede** motor, der allerede loop-tjekker hvert
  mellemår — så den har ikke ASL's endepunkts-asymmetri). Statistik (punkt 3) og ASL (nu) er lukket.
- Ingen rå `aarsloenAslMax[år]`-opslag i reguleringsstien (bekræftet af eksisterende
  `aslAarsloensmaksimumSingleSource.test.ts`); ASL-grenen bruger kun den kanoniske gateway.

## FORSLAG TIL GODKENDELSE

**Ingen beregningsændring parkeret.** ASL-grenen er strukturelt fail-closed (eksakt år-opslag, ingen
carry-forward), så der er ingen tavs under-regulering at forelægge. Fund 1 (kontinuitets-guard) er
tal-neutralt (tabellen er sammenhængende) og anvendt direkte som modstykke til statistik-S6 (punkt 3).
Fund 3 (endDate-grace-display) er parkeret til punkt 13/14 og er sikkert (download blokeres).

## Sammenfatning

ASL-årslønsmaksimum-grenen er korrekt, ensartet (deler `buildAslReguleringsSegments` /
`splitIsoRangeByCalendarYearsInclusive` og den kanoniske `opregulerMedAslAarsloensmaksimum` +
`resolveAslAarsloensmaksimumForAar`-gateway) og deterministisk (`halfAwayFromZero`). Den er **stærkere
fail-closed end de øvrige former**: fordi indekset slås eksakt op pr. kalenderår (ingen carry-forward),
kaster både interiort hul og efter-sidste-år hårdt i motoren — der findes ingen S1/S6-tavs-sti i selve
beregningen. Reviewets reelle fund var **validator/motor-asymmetrien**: dæknings-valideringen er
endepunkts-baseret (motoren er per kontrakt ren ratio), så et interiort hul ville have passeret
valideringen og først kastet i compute → generisk `runtime_exception` frem for en målrettet feltfejl.
Det er lukket med en tal-neutral data-load-guard (`assertAarsloenAslMaxKontinuitet`), præcis analog til
punkt 3's statistik-fix, hvorefter validatorens endepunkts-tjek er beviseligt tilstrækkeligt. Nye tests
dækker per-år-split (numerisk), før-basis zero-delta, efter-sidste-år-throw (motor + validator) og
guardens fail-close. Gate grøn: typecheck, typecheck:test, 199 målrettede tests (heraf 11 nye).
</content>
</invoke>
