# Regulering — dybdegående review af samtlige reguleringsformer

Dette er arbejdsgrundlaget for et gennemgribende, trust-kritisk review af **hele
reguleringsdomænet** i Mineo: al kode der bestemmer, om og hvor meget TAF-beløb
(og afledte krav) reguleres over tid, for hver enkelt reguleringsform.

Planen er ikke en passiv audit-liste. Hvert punkt skal **gennemgå, rette, teste og
dokumentere** den relevante del, så kode, kontrakter og tests konvergerer mod et
produktionsklart slutprodukt.

`AGENTS.md` fastlægger mandat, godkendelsesgrænser og kvalitetsgate. Ved konflikt
gælder `src/contracts/*.md` over denne plan. Denne plan er et **fokuseret, dybere**
supplement til det brede `docs/review/code-review-plan.md` (punkt 6 dér, domæne-
beregninger) — hvor det brede review rører regulering én gang som del af domænet,
går denne plan til bunds i hver enkelt reguleringsform.

## Hvorfor dette review — det trust-kritiske omdrejningspunkt

Beregningen skal aldrig kunne producere et TAF-beløb, hvor brugeren har indtastet
**valide værdier**, men hvor koden — pga. en fejl, en manglende foregribelse af
adfærd eller et hul i datadækningen — **undlader at anvende regulering, eller
anvender forkert/forældet regulering**, i en periode hvor de korrekte regulerede
satser burde have været lagt til grund.

Den centrale fejlklasse er derfor **tavs under-regulering**: at koden fortsætter med
`deltaPct = 0` eller en forældet sats i stedet for enten at anvende den korrekte sats
eller fail-close med en synlig, blokerende fejl. Grundreglen fra `AGENTS.md` gælder
uden undtagelse: **fail-closed på usikre/ugyldige kritiske data — gæt ikke i
stilhed.** Enhver sti, hvor manglende eller uforudset data resulterer i "ingen
regulering" frem for en synlig fejl, er som udgangspunkt en kritisk fejl, indtil det
modsatte er bevist.

De tre led i reviewet — for **hver** reguleringsform:

1. **Kodekvalitet.** Beror formerne på velstrukturerede, ensartede principper?
   Deler de den kanoniske maskineri (reguleringsdato-opløsning, segment-byggeri,
   effective-base, afrunding) frem for parallelle varianter? Er afvigelser bevidste
   og begrundede (jf. KL-lønaftaler-dok), eller er de utilsigtet drift?
2. **Dækning / tavs under-regulering (det væsentligste).** Findes der nogen sti,
   hvor valid brugerinput fører til manglende eller forkert regulering uden en
   synlig, blokerende fejl? Dette gennemgås systematisk mod det katalog af
   kendte silent-paths, der er samlet nedenfor.
3. **Testdækning.** Er hvert led — hver form, hver fail-closed-sti, hver
   grænse (før første sats, efter sidste sats, huller midt i en serie) — dækket
   af meningsfulde invariant-tests?

## Ikke-forhandlingsbare review-principper

- **Fail-closed frem for tavs regulering-nul.** Manglende/ugyldig sats i en periode
  med et beløb, der skulle reguleres, skal give en synlig blokerende fejl (row-
  status `error`, validator-fejl eller `fail_closed`/`runtime_exception`), aldrig et
  stiltiende `deltaPct = 0` eller en carry-forward af en forældet sats.
- **Reguleringsdatoen er fundamentet.** Basisindekset (indeks 100 / basispakke)
  afhænger fuldstændigt af den anvendte reguleringsdato. Enhver form skal anvende
  **samme** reguleringsdato-opløsning, og enhver afvigelse er en fejl.
- **Data-komplethed er en runtime-invariant, ikke en antagelse.** Satstabellernes
  dækningsgrænser (første/sidste år eller dato) skal håndhæves fail-closed, og en
  TAF-periode der rækker ud over dækningen må aldrig blot fortsætte på den sidst
  kendte sats uden en fejl.
- **Beregningslogik forelægges før ændring.** Alt, der kan ændre de tal
  programmet producerer, eller reglerne beregningerne følger, forelægges brugeren
  som konkret brugeroplevelse, før det ændres (jf. `AGENTS.md`). Rene struktur-,
  type-, placerings- og testforbedringer udføres direkte.
- **Bevis tal-identitet ved refaktorering.** Enhver omstrukturering af en
  reguleringsform skal bevise med tests, at tallene er uændrede. Ændrer tallene sig,
  er det beregningslogik og kræver forelæggelse.
- **Ensartet mønster.** Samme problem løses med samme mønster. Parallelle
  lookup-stier, duplikerede interval-helpers og konkurrerende implementeringer for
  samme concern konsolideres, medmindre domænet reelt adskiller sig (og så begrundes
  afvigelsen eksplicit ved callsite).
- 100 % client-side, dansk brugervendt tekst, deterministisk numerik og
  console-tavs normal drift gælder som i det brede review.

## Domæne-landkort (kalibreret pr. 2026-07-02)

Reguleringen falder i **to familier**:

**Familie 1 — Lønudviklings-regulering** (per-segment `deltaPct` på en basisløn, som
driver TAF). Master-switch pr. ansættelsesforhold:
`loenudviklingBeregningsgrundlag` ∈ `{ Ingen, Statistik, Overenskomst, Manuelt
angivet, Manuel procentsats, KRL satstabel, KL-lønaftaler }`
(`src/schemas/formSchemas/enumSchemas.ts:62`). Strategivalg og cross-ansættelse-
ensartethed i `resolveReguleringsStrategi`
(`src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts:368`);
dispatch i `buildLoenudviklingModel` (samme fil, ~`:1385`).

**Familie 2 — År-til-år opregulering** (beløb i ét prisniveau → et andet).
To kanoniske motorer i `src/domain/satser/opreguleringsmotorer.ts`, plus EET-
rateopslag i `src/domain/erhvervsevnetab/eetReguleringRater.ts`.

**Fælles fundament (deles på tværs af formerne):**
- Reguleringsdato: `resolveAnvendtReguleringsdato`
  (`src/domain/erstatningsopgoerelse/helpers/eoSharedUtils.ts:142`).
- Overenskomst-dækningsstart / effektiv reguleringsdato:
  `src/domain/erstatningsopgoerelse/engines/reguleringCoverage.ts`.
- Segment-byggeri fra brudpunkter: `buildSegmentsFromStartDates`, base-opslag
  `resolveEffectiveBaseEntry` / `findLatestByDateInSortedList`
  (`loenudviklingBeregning.ts:296–366`).
- Løn-pakke-formel: `reguleringFormulaUtils.ts`; privat-overenskomst-kontekst
  `overenskomstReguleringShared.ts`.
- Præsentation: `reguleringsPresentation.ts` (+ debug `eoDebugRegulation*`).
- Output: `document/generators/eo/sections/reguleringSection.ts`,
  `reguleringDocument.ts`, `tafFordelt/tafOpreguleretPaaAarDocument.ts`.

### Kendt katalog af silent-paths (reviewets primære jagtliste)

Disse er identificeret ved kortlægningen og skal hver især verificeres: er de
**bevidste og korrekte** (basis repræsenterer allerede niveauet), eller er de en
**tavs under-regulering** der skal fail-close? Hvert punkt der ejer stien skal
afgøre dette eksplicit og teste udfaldet.

| # | Sti | Lokation | Foreløbig vurdering |
|---|---|---|---|
| S1 | `resolveEffectiveBaseEntry` beregner `usedFallback` (reguleringsdato før første sats → anker til ældste sats), men compute-motoren **handler ikke** på flaget; kun præsentationen viser `tidligsteSatsGaelderFra`-note | `loenudviklingBeregning.ts:353–366`; statistik `:692`, KRL `:757` | Muligt tavst base-skift |
| S2 | Overenskomst (privat) segment uden sats / før dækning → stille `deltaPct 0` | `loenudviklingBeregning.ts:~1204`, `~1209` | Bevidst for før-dækning; interior-hul skal verificeres |
| S3 | Overenskomst (offentlig) segment uden lønrække → stille `deltaPct 0` | `loenudviklingBeregning.ts:~1075` | Samme som S2 |
| S4 | KL-lønaftaler-kæden `continue`-springer et trin hvis en KL-dato mangler pct | `klLoenaftalerReguleretLoen.ts:63–64` | Muligt tavst spring af reguleringstrin |
| S5 | Manuel procentsats dropper stille rækker med uparsbar pct | `manuelProcentsatsRegulering.ts:56–59` | Kan reducere akkumuleret regulering uden hård fejl |
| S6 | Data carry-forward: TAF-periode der rækker ud over sidste kendte sats bruger `findLatest…` → sidste sats videreføres uden fejl | statistik/KRL/KL/overenskomst-lookups | Staleness-risiko; skal fail-close ved manglende nyere sats |
| S7 | `getSatserForYear` er fail-open (`null`/`''`) — kun display, må ikke lække ind i beregningssti | `data/lovbestemteRates.ts:858` | Verificér at reguleringssti ikke bruger den |

Bemærk: `loenudviklingBeregning.ts:63–70` dokumenterer, at **alle `throw` i filen er
defensive invarianter**, som fanges af `computeEoSnapshot` → `fail_closed`
(`failClosedReason: 'runtime_exception'`, jf. eo-snapshot-kontrakten). Reviewet skal
bekræfte, at hver silent-path enten er bevidst korrekt eller konverteret til en
sådan throw/blokerende gate.

## Arbejdsmodel

### Reviewets faser (pr. punkt)

1. **Kortlæg** formens trigger, datakilde, reguleringsdato-brug, segment-/indeks-
   logik og alle exit-stier (throw, warning, zero-delta, carry-forward).
2. **Læs** relevante kontrakter og domænedocs før kodeændring
   (`docs/domain/taf/`, eo-snapshot-, periodiserings-, amount-, date-kontrakter).
   Er en kontrakt forkert eller i vejen, opdateres den først.
3. **Dækningsanalyse (led 2).** Gennemgå formen mod silent-path-kataloget. For
   hver exit-sti: er "ingen regulering / uændret sats" muligt med valid input, og
   er det i så fald bevidst korrekt eller en fejl? Afgør eksplicit; fail-close hvor
   nødvendigt (kræver forelæggelse hvis tal ændres).
4. **Ret** med lavest mulig ny kompleksitet; konsolider mod det fælles fundament
   før nye helpers oprettes.
5. **Test (led 3).** Tilføj/opdatér invariant-tests for formen: normal beregning,
   fail-closed ved manglende sats, samt grænserne før-første-sats, efter-sidste-sats
   og hul-midt-i-serie.
6. **Dokumentér** fund, rettelser og tests i punktets review-fil, og opdatér
   status + silent-path-kataloget (bekræftet korrekt / rettet / parkeret).

### Faste kontrolspørgsmål (pr. punkt)

- **Reguleringsdato:** bruger formen den kanoniske `resolveAnvendtReguleringsdato`,
  og er basisindekset korrekt forankret på den?
- **Grænser:** hvad sker der når reguleringsdatoen ligger *før* første sats?
  *efter* sidste sats? når TAF-perioden rækker *ud over* datadækningen? når der er
  et *hul* midt i satsserien? Er hver af disse fail-closed eller bevidst zero-delta?
- **Ensartethed:** deler formen segment-byggeri, base-opslag, afrunding og
  formattering med de øvrige, eller er der en parallel/duplikeret variant?
- **Numerik:** korrekt afrundingsmetode (`halfAwayFromZero`, `round2`), ingen
  inline/ad hoc-afrunding, deterministisk, ingen `NaN`/`Infinity`/division-med-0.
- **Grænsebrud:** ingen UI/persistence-import i beregningslaget; debug/presentation
  er nedstrøms og bliver aldrig domænesandhed.
- **Multi-ansættelse:** kan ét ansættelsesforholds manglende dækning maskeres af et
  andets succes i den aggregerede status?
- **Tests:** findes en meningsfuld invariant-test for både normalsti og fail-closed?

### Delegation

Brede punkter (fx datakomplethed på tværs af alle tabeller, eller test-
konsolidering) delegeres gerne til subagents med klart scope; hovedtråden
integrerer resultater, kontrollerer kontrakt-/testkonsekvenser og opdaterer review-
filen. Delegation afgiver ikke ejerskab.

### Godkendelsesflow

Når et fund kræver en beregningsændring (tallene kan ændre sig):

- beskriv den konkrete brugeroplevelse før/efter i konkrete tal-eksempler;
- parkér fundet i "Åbne godkendelsespunkter" med punktnummer;
- fortsæt med de dele der ikke afhænger af beslutningen (struktur, tests af
  nuværende adfærd, dokumentation af fundet).

Tekniske beskrivelser må aldrig være grundlaget for brugerens valg.

### Review-fil pr. punkt

Hvert punkt opretter/opdaterer `docs/review/regulering-[punkt]-[slug].md`:

```md
# Regulering punkt [nummer] — [navn]

**Dato:** YYYY-MM-DD
**Status:** I gang | Gennemgået | Afventer godkendelse
**Reguleringsform(er):** [hvilke]
**Primært scope:** [filer]
**Afhængigheder læst:** [filer]
**Tests kørt:** [kommando + resultat]

## Dækningsanalyse (led 2 — tavs under-regulering)

For hver exit-sti i formen:
- Sti: [throw | warning | zero-delta | carry-forward | drop]
- Kan valid input ramme den? [ja/nej + hvordan]
- Bevidst korrekt eller fejl? [begrundelse]
- Udfald: [uændret / fail-closed indført / parkeret til godkendelse]

## Fund og rettelser

1. **[Severity] [Kort titel]**
   - Lokation: [fil:linje]
   - Problem / Risiko / Handling / Resultat

## Testdækning (led 3)

- [ny/opdateret test → hvad den hævder]

## Tilfældighedsfund

## Sammenfatning
```

Severity:

- **Kritisk:** kan give forkerte/manglende regulering, forkerte TAF-tal, datatab
  eller brudte trust-invarianter.
- **Høj:** type-/schema-usikkerhed, manglende validering/gate, kontraktbrud eller
  arkitekturfejl med reel risiko for regulering.
- **Medium:** duplikering, kompleksitet, utilstrækkelige tests, uklart ejerskab.
- **Lav:** mindre inkonsistens, navngivning, placering, oprydning.

## Status

Statusværdier: `⬜ Ikke startet` · `🟡 I gang` · `⏸ Afventer godkendelse` ·
`✅ Gennemgået`.

Baseline etableres i punkt 0 med `git status --short`, `npm run typecheck`,
`npm run typecheck:test`, `npm run lint` og en målrettet regulering-testkørsel.
Senere punkter kører den relevante gate; fuld `npm run test` ved beregnings-,
persistence- eller bredt-påvirkende ændringer og før commit.

| Punkt | Navn | Familie | Primært formål | Status |
|---|---|---|---|---|
| 0 | Baseline og reguleringskort | — | Arbejdstræ, testbaseline, komplet form-/fil-inventar, trigger-kæde | ⬜ |
| 1 | Fælles fundament | begge | Reguleringsdato, coverage, segment-byggeri, effective-base (S1), afrunding | ⬜ |
| 2 | Form: Ingen | 1 | Bekræft ægte nul-regulering og at "Ingen" ikke maskerer manglende valg | ⬜ |
| 3 | Form: Statistik (ILON12/SBLON2) | 1 | Kvartalsindeks, base-clamp (S1), hul-i-serie (S6) | ⬜ |
| 4 | Form: Statistik ASL-årslønsmaksimum | 1+2 | ASL-indeksmotor, per-år-split, manglende indeks fail-closed | ⬜ |
| 5 | Form: Overenskomst — privat | 1 | Pakke-indeks, dækningsstart, segment-zero-delta (S2) | ⬜ |
| 6 | Form: Overenskomst — offentlig (KL/RLTN) | 1 | Løntrin-tabeller, base-fallback, segment-zero-delta (S3) | ⬜ |
| 7 | Form: Manuelt angivet | 1 | Daterede lønrækker, før-basis-drop, base-forankring | ⬜ |
| 8 | Form: Manuel procentsats | 1 | Akkumuleret indeks, uparsbar-pct-drop (S5), før-basis | ⬜ |
| 9 | Form: KRL satstabel | 1 | Reguleringsprocent-indeks, 4 delserier, base-clamp (S1) | ⬜ |
| 10 | Form: KL-lønaftaler | 1 | Trinvis kæde-opregulering, trin-spring (S4), særvisninger | ⬜ |
| 11 | Familie 2: opregulerings-motorer | 2 | `opreguleringsmotorer`, TAF-opreguleret, offentlige ydelser, EET-rater | ⬜ |
| 12 | Datakomplethed og staleness | — | Alle satskilders dækningsgrænser, carry-forward (S6), Excel-generering | ⬜ |
| 13 | Coverage-gate, validator og escape-hatch | — | Row-evaluation, validator, `allowReguleringMedOverenskomst…`, multi-af | ⬜ |
| 14 | Præsentation og output-paritet | — | Reguleringsværdier/-tabeller, PDF/Word, `tidligsteSatsGaelderFra`-note | ⬜ |
| 15 | Testdækning og konvergens | — | Luk testhuller, konsolidér duplikering, endelig gate | ⬜ |

## Punktdetaljer

### 0 — Baseline og reguleringskort

Formål: kendt udgangspunkt og komplet overblik før ændringer.

Primært scope: denne plan, `enumSchemas.ts` (form-enum), trigger-kæden
(`resolveReguleringsStrategi` → dispatch), samt et inventar over alle
regulerings-relevante filer i `domain/`, `data/`, `config/`, `document/` og tests.

Kontroller: arbejdstræets tilstand; testbaseline (målrettet
`npx vitest run` over regulering-testfilerne); at hver form i enum-listen har
præcis ét primært punkt i denne plan; at trigger-kæden fra brugerinput til valgt
strategi er fuldt kortlagt (inkl. `assertUniform`-invarianterne for multi-
ansættelse); bekræft silent-path-kataloget mod koden og notér evt. yderligere fund.

### 1 — Fælles fundament

Formål: sikre at det maskineri, alle former deler, er korrekt, ensartet og fail-
closed — så en fejl her ikke forplanter sig til hver form.

Primært scope:
- `helpers/eoSharedUtils.ts` (`resolveAnvendtReguleringsdato`, `resolveStatistikModelId`, `isAslStatistikModel`)
- `engines/reguleringCoverage.ts`
- `engines/loenudviklingBeregning.ts:296–366` (segment-byggeri, `resolveEffectiveBaseEntry`, `findLatestByDateInSortedList`, `buildSegmentsFromStartDates`, `buildZeroDeltaSegment`)
- `engines/reguleringFormulaUtils.ts`
- `engines/overenskomstReguleringShared.ts`
- afrundings-/dato-helpers hvor de bruges i reguleringssti (`rounding`, `roundingShortcuts`, `isoDateHelpers`)

Særligt fokus (led 2):
- **S1:** afgør om `usedFallback` (reguleringsdato før første sats) skal give en
  synlig fejl/advarsel i selve beregningen, ikke kun i præsentationen. Er stille
  anker til ældste sats en korrekt beregningspræmis, eller skjuler den, at
  basisniveauet ikke faktisk er dækket?
- `resolveAnvendtReguleringsdato`: alle grene (`Beregningsperiode` vs. angivet løn)
  giver en veldefineret dato; `undefined` fail-closer nedstrøms konsekvent.
- `reguleringCoverage.ts` har i dag **ingen dedikeret unit-test** — tilføj den
  (`>`-sammenligning, interval-parsing, `undefined`-håndtering).

Kontroller: at hver form kalder samme fundament frem for egen kopi; at effective-
base-clamp opfører sig ens på tværs af statistik/KRL; at segment-brudpunkter er
komplette og sorterede.

### 2 — Form: Ingen

Formål: bekræfte at "Ingen" er ægte nul-regulering, og at den ikke kan forveksles
med "ikke valgt" (som skal fail-close).

Primært scope: `loenudviklingBeregning.ts:378–381`, `:1377–1380`;
`resolveLoenudviklingRows`; row-visibility for `Ingen`.

Kontroller: `alleIngen` kun sandt når alle aktive ansættelser er `Ingen`; en
tom/uvalgt strategi giver fejl (`:384`), ikke stiltiende nul; blandet `Ingen` + andet
håndteres via `active`-filteret uden at tabe regulering på de aktive.

### 3 — Form: Statistik (ILON12 / SBLON2)

Primært scope: `buildLoenudviklingFromStatistik`
(`loenudviklingBeregning.ts:630–727`); `data/statistiskeRates.ts`; præsentation
`reguleringsPresentation.ts` (statistik-grene).

Særligt fokus (led 2):
- **S1/S6:** base-clamp til ældste kvartal (`resolveEffectiveBaseEntry:692`) og —
  vigtigst — et **hul midt i kvartalsserien**. I dag testes kun endepunkterne
  (validator før-første-år / efter-sidste-dato). Verificér at et manglende interiort
  kvartal fail-closer og ikke stiltiende viderefører sidste indeks.
- ILON12-udgåethed / model-skift-noter er korrekte og ikke beregnings-påvirkende.

Kontroller: `deltaPct = (idx[segment]/idx[base] − 1)×100`; ikke-positivt indeks →
throw; segment før effektiv base → bevidst zero-delta; ukendt model → throw.

Tests: tilføj hul-i-serie-test (interiort manglende kvartal → fail-closed).

### 4 — Form: Statistik ASL-årslønsmaksimum

Primært scope: ASL-grenen i `buildLoenudviklingFromStatistik` (`:644–671`),
`buildAslReguleringsSegments`; `satser/aslAarsloensmaksimum.ts`;
`opregulerMedAslAarsloensmaksimum` (`opreguleringsmotorer.ts:85`);
`data/lovbestemteRates.ts` (`aarsloenAslMax`).

Kontroller: per-år-split og indeksforhold via den fælles motor; manglende ASL-indeks
for basis- eller segment-år → throw (`:660`, `:666`); `resolveAslAarsloensmaksimumForAar`
er eneste kanoniske gateway (ingen rå `aarsloenAslMax[year]`-opslag i reguleringssti);
`manglendeAar` fra motoren fail-closer altid.

Tests: allerede stærkt dækket i `opreguleringsmotorer.test.ts` og
`loenudviklingBeregning.test.ts:366` — bekræft og udfyld evt. per-år-split-huller.

### 5 — Form: Overenskomst — privat

Primært scope: privat-grenen i `buildLoenudviklingFromOverenskomst`
(`loenudviklingBeregning.ts:~1116–1244`); `overenskomstReguleringShared.ts`;
`reguleringCoverage.ts`; `data/overenskomstRates.ts`; præsentation privat-grene.

Særligt fokus (led 2):
- **S2:** segment uden sats eller før dækning → stille `deltaPct 0` (`:~1204`,
  `:~1209`). Afgør: er dette kun før-dækning (korrekt), eller kan et **interiort
  hul** i overenskomst-satsserien ramme den? `getEffektiveSatserForDato` viderefører
  normalt sidste sats — verificér at der ikke findes en gap-sti der giver zero-delta
  midt i en dækket periode.
- Effektiv reguleringsdato = `max(reguleringsdato, dækningsstart)` — bekræft at et
  krav om regulering *før* overenskomstens dækning enten fail-closer eller er
  eksplicit gated (kobling til punkt 13's escape-hatch).
- **Ingen ende-til-ende-test** binder i dag en manglende overenskomst-sats til
  `computeEoSnapshot` → `runtime_exception`. Tilføj den.

Kontroller: base-pakke og segment-pakke via `computePackageValuePct`; Store Bededag-,
anciennitets- og sats-brudpunkter komplette; ferie/fritvalg/SH/pension-satser
opløst korrekt.

### 6 — Form: Overenskomst — offentlig (KL/RLTN)

Primært scope: offentlig-grenen i `buildLoenudviklingFromOverenskomst`
(`loenudviklingBeregning.ts:942–1114`); `resolveOffentligLoenSelection`;
`data/offentligLoenLookup.ts`, `data/offentligLoenTypes.ts`, KL/RLTN-satsfiler;
`assertOffentligReguleringsDatoGyldig`; præsentation offentlig-grene.

Særligt fokus (led 2):
- **S3:** segment uden lønrække → stille `deltaPct 0` (`:~1075`). Samme afgørelse
  som S2.
- Base-fallback til overenskomstens første interval (`resolveOffentligEffectiveBase:958`)
  — bekræft at manglende basissats efter fallback fail-closer (`:964/:968/:977`).
- Manglende løntrin *inden for* dækning → throw (`getOffentligLoenForDato`) — bekræft
  at dette ikke kan degradere til zero-delta.

Kontroller: `OFFENTLIG_REGULERING_MIN_DATO`-gate (01-01-2012) håndhæves; løntype/
trin/gruppe-validering fail-closer; Store Bededag-håndtering korrekt.

### 7 — Form: Manuelt angivet

Primært scope: `buildLoenudviklingFromManual` (`loenudviklingBeregning.ts:~1246–1345`);
`helpers/angivetLoenHelpers.ts`; præsentation manuel-grene.

Særligt fokus (led 2): rækker dateret før reguleringsdatoen droppes fra beregningen
(`:~1286`) men rapporteres som ikke-blokerende advarsel — bekræft at basis-rækken
korrekt repræsenterer niveauet, så droppet ikke er en tabt regulering. Base-række
mangler → throw; ugyldig pakkeværdi → throw.

Kontroller: segment bruger seneste daterede række ≤ segmentstart; afrunding og
pakke-formel deles med overenskomst-formen.

### 8 — Form: Manuel procentsats

Primært scope: `manuelProcentsatsRegulering.ts` (hele filen);
`buildLoenudviklingFromManualProcentsats` (`loenudviklingBeregning.ts:799–838`);
præsentation manuel-procentsats-grene.

Særligt fokus (led 2):
- **S5:** rækker med uparsbar/ikke-finit pct filtreres **stille** (`:56–59`). En
  bruger der taster en ugyldig procent kan dermed miste et reguleringstrin uden
  hård fejl. Afgør: skal ugyldig pct fail-close (row-error) frem for stille drop?
  Kobling til row-evaluation i punkt 13.
- Rækker før basis ignoreres (rapporteres via `resolveManuelProcentsatsRowsFoerBasis`)
  — bekræft konsistens med de øvrige formers før-basis-håndtering.

Kontroller: multiplikativ akkumulering `runningIndex *= 1 + procent/100`; base = indeks
100 på reguleringsdato; række præcis på reguleringsdato gælder fra dag ét; segment-
opslag = seneste entry ≤ dato.

### 9 — Form: KRL satstabel

Primært scope: `buildLoenudviklingFromKRL` (`loenudviklingBeregning.ts:729–797`);
`data/krlRates.ts` (4 delserier, `buildSatstabelFromCombined`); præsentation
KRL-grene.

Særligt fokus (led 2): **S1/S6** som statistik — base-clamp (`:757`) og interiort
hul i reguleringsprocent-serien. Bekræft at delserie-null-filtrering ikke skaber et
utilsigtet hul, og at en TAF-periode ud over sidste KRL-dato fail-closer.

Kontroller: `deltaPct = ((100+segmentPct)/(100+basePct) − 1)×100`; `100+pct ≤ 0` →
throw; Store Bededag bevidst *ikke* brudpunkt her (parity med
`eoDebugRegulationCore`); tom/manglende tabel → throw.

Tests: tilføj hul-i-serie- og efter-sidste-dato-test.

### 10 — Form: KL-lønaftaler

Læs `docs/domain/taf/kl-loenaftaler-regulering.md` **først** — formen har bevidst
alternativ beregningsmetode (trinvis kæde med afrunding på hvert trin) og alternative
visninger. Særtilfældene er tilsigtede og må ikke "forenes" med de øvrige.

Primært scope: `klLoenaftalerReguleretLoen.ts` (hele filen);
`buildLoenudviklingFromKlLoenaftaler` (`loenudviklingBeregning.ts:840–880`);
deltaPct-override + `reguleretLoenOre` (`:~1404–1419`); `data/klLoenaftaler.ts`;
KL-særvisninger i `reguleringsPresentation.ts` og download-dokument.

Særligt fokus (led 2):
- **S4:** kæden `continue`-springer et trin hvis en KL-dato mangler pct
  (`klLoenaftalerReguleretLoen.ts:63–64`). Afgør om dette kan ske med valid data, og
  om det skal fail-close.
- **S6:** ingen missing-rate/fail-closed-test findes for KL i dag. Hvis en TAF-
  periode rækker ud over sidste KL-sats: sker der carry-forward uden fejl? Tilføj
  analog til EET's "manglende sats → blokerende issue".

Kontroller: invarianterne i §5 i KL-dok (aldrig akkumuleret visning; `deltaPct` i
fuld præcision reproducerer trinvist afrundet løn; `reguleretLoenOre` autoritativ
enhedsløn); SFGG-sporet (`sygeferiegodtgoerelse`) reproducerer `reguleretLoenOre`.

### 11 — Familie 2: opregulerings-motorer

Primært scope:
- `satser/opreguleringsmotorer.ts` (`opregulerMedAslAarsloensmaksimum`,
  `opregulerMedAkkumuleretReguleringssats`)
- `engines/tafPerYearOpreguleretDerived.ts` (TAF opreguleret til beregningsår, G1)
- `engines/offentligeYdelserUdviklingBeregning.ts`
- `erhvervsevnetab/eetReguleringRater.ts`
- `data/lovbestemteRates.ts` (`reguleringssats`, `reguleringsprocentErhvervsevnetab*`)

Særligt fokus (led 2):
- Bekræft at begge motorer fail-closer via `manglendeAar` (kræver dækning for
  **hvert** mellemliggende år i den akkumulerede metode) — stærkt testet, verificér.
- **Duplikering:** `offentligeYdelserUdviklingBeregning.ts` har både et motor-kald
  (`:~38`) og et **råt** `reguleringssats[year]`-loop (`:~100`). Konsolidér til
  motoren, så fail-closed-adfærden er ens.
- 0-beløb-år undtages fra dæknings-kravet i TAF-opreguleret (`:99`, `:122–132`) —
  verificér mod nær-nul og negative beløb (utestet i dag).
- `resolveAslReguleringRateForAar` 2024-særtilfælde (før/fra 2024-07-01) og
  tabel-split (≤2023 vs Fra2024); manglende rate → blokerende `EetIssue` + `null`.

### 12 — Datakomplethed og staleness

Formål: sikre at ingen reguleringsform stille kan videreføre en forældet sats, og at
alle dækningsgrænser er auditerbare og fail-closed.

Primært scope: alle satskilder — `overenskomstRates`, `offentligLoenLookup` (+ KL/RLTN
Excel-generering via `scripts/import-offentlig-loen.mjs`), `statistiskeRates`,
`krlRates`, `klLoenaftaler`, `lovbestemteRates`, `sygedagpengeRates`,
`indskudteLoentillaeg`, `config/regulatoryRates.ts`.

Særligt fokus (led 2 — **S6, kernen i det trust-kritiske**):
- For hver kilde: hvad er min/max-dækning, og hvad sker der når TAF-perioden rækker
  **ud over** max? `findLatestByDateInSortedList` viderefører sidste entry. Er der en
  eksplicit øvre-grænse-gate (som validatorens "kan ikke beregnes efter 30-09-2026"),
  og dækker den **alle** former, ikke kun statistik/KRL?
- **S7:** bekræft at den fail-open `getSatserForYear` kun bruges til display, aldrig i
  en reguleringsberegning.
- De fire separate `getReguleringsDatoIntervalFor…`-implementeringer med kopieret
  "+6 måneder − 1 dag"-aritmetik: konsolidér til én kanonisk helper.
- Excel-genererede tabeller er kun kildeartefakter; runtime læser kun de genererede
  `.ts`-filer; integritets-guards (duplikat-trin, rækkefølge) fail-closer ved load.

Kontroller: tom tabel → throw ved modul-load; manglende år/dato → eksplicit fejl;
dataopslag bruger kanoniske dato-/tal-helpers.

### 13 — Coverage-gate, validator og escape-hatch

Formål: sikre at den brugervendte gate og pre-compute-valideringen fanger hver
dæknings-mangel, uden at ét ansættelsesforhold maskerer et andet.

Primært scope:
- `domain/eoRowEvaluation/eoRowIndkomstRows.ts` (coverage-/visibility-rows)
- `validators/erstatningsopgoerelseValidator.ts`
- app-setting `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` (escape-hatch)

Særligt fokus (led 2):
- Bekræft at "manglende reguleringsværdi på reguleringsdatoen", "manglende
  slut-dækning" og "efter sidste sats" alle giver row-`error` (eller `warning` kun når
  escape-hatch eksplicit er slået til).
- **Multi-af-maskering:** test at af A med fuld dækning ikke skjuler af B's hul i den
  aggregerede status.
- Kobling til S5/S8: skal uparsbar manuel pct give en row-error?
- Escape-hatchens semantik: den må kun sænke strenghed (rød → gul), aldrig ændre tal
  (jf. G3 i det brede review).

### 14 — Præsentation og output-paritet

Formål: sikre at det, brugeren *ser* om regulering (tabeller, indeks, noter) og det,
der *skrives* i PDF/Word, matcher beregningen — og at forkert visning ikke skjuler en
beregningsfejl.

Primært scope: `reguleringsPresentation.ts`; `debug/eoDebugRegulation*`;
`document/generators/eo/sections/reguleringSection.ts`, `reguleringDocument.ts`,
`reguleringNotes.ts`; `tafFordelt/tafOpreguleretPaaAarDocument.ts`;
`klLoenaftaler/klLoenaftalerDocument.ts`; relevante PDF/Word-tests.

Kontroller: PDF/Word-paritet for indhold, rækkefølge, tal og udeladelser;
`tidligsteSatsGaelderFra`-noten vises når dækningen starter sent (S1-signalet);
4-decimal-delta og forligsfaktor render korrekt; debug-visning er nedstrøms og bliver
aldrig domænesandhed.

### 15 — Testdækning og konvergens

Formål: lukke reviewet — udfyld testhullerne og fjern resterende drift.

Primært scope: alle regulering-testfiler + de manglende tests identificeret undervejs.

Kendte testhuller at lukke (fra kortlægningen):
1. `reguleringCoverage.ts` — dedikeret unit-test (punkt 1).
2. Hul-midt-i-serie for statistik og KRL (punkt 3, 9).
3. KL-lønaftaler missing-rate / efter-sidste-sats fail-closed (punkt 10).
4. Nær-nul og negativt beløb i TAF-opreguleret med manglende sats (punkt 11).
5. Ende-til-ende: manglende overenskomst-sats → `computeEoSnapshot`
   `runtime_exception` (punkt 5).
6. Multi-af partiel dækning i coverage-gate (punkt 13).

Konvergens: konsolidér de fire `getReguleringsDatoIntervalFor…`-varianter og det
duplikerede `reguleringssats`-opslag; fjern død kode/forældede kommentarer; bekræft
at hver form deler det fælles fundament.

Endelig gate: relevant fuld kvalitetsgate, åbne godkendelser afklaret, silent-path-
kataloget fuldt afgjort (hver post: bekræftet korrekt / rettet / godkendelsesparkeret).

## Åbne godkendelsespunkter

Ingen åbne godkendelsespunkter pt. Nye punkter registreres her, når reviewet finder
en beregningsændring der kræver brugerens beslutning. De lukkes ikke teknisk uden
brugerens beslutning.

## Udskudte fund

| ID | Fundet i punkt | Behandles i punkt | Fund | Status |
|---|---|---|---|---|
| - | - | - | Ingen registreret endnu. | - |

## Afslutningskrav for hvert punkt

Et punkt markeres kun `✅ Gennemgået`, når:

- reguleringsformens exit-stier alle er afgjort (bevidst korrekt eller fail-closed);
- alle silent-path-poster under punktet er lukket eller parkeret i denne plan;
- relevante kontrakter/domænedocs er opdateret eller bekræftet;
- normalsti **og** fail-closed-sti er dækket af meningsfulde tests, og resultatet er
  noteret;
- ingen kendt beregningsændring venter uden at stå i "Åbne godkendelsespunkter";
- statustabellen i denne plan er opdateret.
