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

**Reviewet må aldrig stoppe ved ét led i kæden.** Hvert punkt følger den korrekte
reguleringsværdi **hele vejen** — fra brugerens valide input, gennem strategivalg,
datakilde-opslag, reguleringsdato-forankring, segment-/indeks-beregning, akkumulering,
afrunding, aggregering på tværs af ansættelsesforhold/år, snapshot, validator/gate,
og helt frem til det **færdige produkt, brugeren ser** (skærm-visning, PDF og Word).
Formålet er ikke at inspicere ét led isoleret, men aktivt at lede efter **hvert sted i
kæden hvor den korrekte reguleringsværdi kan gå tabt, blive erstattet, afrundet væk,
maskeret eller stille falde tilbage til nul/forældet** — så en værdi der var rigtig ét
sted alligevel ikke ender rigtigt i sidste ende. Et led der isoleret er korrekt, men
hvis output nedstrøms tabes, forvanskes eller ikke vises, er stadig en fejl i kæden.

## Ikke-forhandlingsbare review-principper

- **Fail-closed frem for tavs regulering-nul.** Manglende/ugyldig sats i en periode
  med et beløb, der skulle reguleres, skal give en synlig blokerende fejl (row-
  status `error`, validator-fejl eller `fail_closed`/`runtime_exception`), aldrig et
  stiltiende `deltaPct = 0` eller en carry-forward af en forældet sats.
- **Kæden ejes fra input til færdigt produkt.** Ansvaret for en reguleringsform
  slutter først, når den korrekte værdi er verificeret hele vejen frem til det
  brugeren ser (skærm, PDF, Word) — ikke når beregningsmotoren returnerer det rette
  tal. Hvert led nedstrøms (snapshot, aggregering, præsentation, output-generatorer)
  skal bekræftes for ikke at tabe, overskrive, dobbelt-afrunde, filtrere eller
  undlade at vise værdien. En korrekt værdi der ikke når frem til produktet er lige
  så alvorlig som en forkert beregning.
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
dispatch i `buildLoenudviklingModel` (samme fil, `:1347`; strategi-switch `:1385–1391`).

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
| S1 | `resolveEffectiveBaseEntry` beregner `usedFallback` (reguleringsdato før første sats → anker til ældste sats), men compute-motoren **handler ikke** på flaget; kun præsentationen viser `tidligsteSatsGaelderFra`-note | `loenudviklingBeregning.ts:353–366`; statistik `:692`, KRL `:762` | **✅ BEKRÆFTET KORREKT (punkt 1):** gated af synlig, blokerende `reguleringsvaerdi`-error i række-laget (`eoRowIndkomstRows.ts:472`), der fyrer aligned med `usedFallback`. `usedFallback` er dead code (F1); to-stedet beregning bør robusthedssikres (F2). Ingen beregningsændring. **KRL bekræftet (punkt 9):** row-gatens `min` = `getReguleringsDatoIntervalForKRL.fraDato` = ældste sats = motorens `effectiveBaseStartIso` ved clamp; aligned og allerede ende-til-ende-testet (KRL i `FORMER`-arrayet, `reguleringSilentPathAlignment.test.ts`). |
| S2 | Overenskomst (privat) segment uden sats / før dækning → stille `deltaPct 0` | `loenudviklingBeregning.ts:~1209`, `~1214` | **✅ BEKRÆFTET KORREKT (punkt 5):** `getSatserForDatoFromList` carry-forwarder (seneste sats ≤ dato) → `!sats` kan **kun** ramme før-dækning, aldrig et interiort segment (interiort hul umuligt). Før-dækning zero-delta er gated af `reguleringsvaerdi`-row-error (`interval.fraDato` = ældste sats = motorens `effectiveBase.startIso`), aligned og nu ende-til-ende-testet. Ingen beregningsændring. |
| S3 | Overenskomst (offentlig) segment uden lønrække → stille `deltaPct 0` | `loenudviklingBeregning.ts:1080` | **✅ BEKRÆFTET KORREKT (punkt 6):** `getOffentligLoenForDato` carry-forwarder (nyeste regulering ≤ dato) og **kaster** ved manglende løntrin → interiort hul umuligt, manglende trin degraderer ikke til zero-delta. `undefined`/zero-delta rammer **kun** før basen (før-dækning eller før reguleringsdato). Før-dækning zero-delta gated af `reguleringsvaerdi`-row-error: `min = getReguleringsDatoIntervalForOffentligLoen.fraDato = ældste KL/RLTN-sats = 01-01-2012 = OFFENTLIG_REGULERING_MIN_DATO = motorens fallback-base-start` — aligned, nu ende-til-ende-testet. Base-fallback fail-closer (`:969/:973/:982`). Ingen beregningsændring. |
| S4 | KL-lønaftaler-kæden `continue`-springer et trin hvis en KL-dato mangler pct | `klLoenaftalerReguleretLoen.ts:63–64` | **✅ AFGJORT — FAIL-CLOSED-HÆRDET (punkt 10):** Springet var **unåeligt for valide data** — dato-listen OG pct-opslaget udledtes af samme array (`klLoenaftalerRaekker`), så `getKlLoenaftalerReguleringPctForDato` returnerede altid en finit sats for en kilde-dato (én entydig række pr. dato, jf. `klLoenaftaler.test.ts`). Men det var den latente tavse-under-regulerings-fejlklasse ved fremtidig datafejl. **Rettet direkte (tal-neutralt):** kæden bygges nu **direkte fra kilde-rækkerne** (dato + `reguleringPct` fra samme række → ingen desync-kanal), og de to stille drop (manglende/ikke-finit pct; uparsbar dato) er konverteret til **defensive `throw`** (→ `runtime_exception`). Bevist tal-identisk for valide data; kaster kun ved korrupt data. Ny dedikeret resolver-test + fail-closed-test (mocket datamodul). |
| S5 | Manuel procentsats dropper stille rækker med uparsbar pct | `manuelProcentsatsRegulering.ts:56–59` | **✅ BEKRÆFTET KORREKT / GATED OPSTRØMS (punkt 8):** Zod (`percentageDecimal`) garanterer committed `procent` ∈ {finit tal i [0;100], `undefined`} — uparsbar/ikke-finit/out-of-range pct fejler valideringen og kan aldrig nå motoren. Det stille drop rammer derfor kun TOMME celler. En helt tom række taber ingen regulering (ikke "aktiv"); en betydningsbærende ufuldstændig række (dato uden procent, eller omvendt) gates blokerende `error` i BÅDE validator (`erstatningsopgoerelseValidator.ts:892–909`) OG row-lag (`eoRowIndkomstRows.ts:295–308`, `alleVaerdier`-row) med identisk aktiv-række-logik — parallel til punkt 7's `datoOk`/`grundloenOk`. Nu bundet ende-til-ende (5 nye tests i `reguleringSilentPathAlignment.test.ts`). Ingen beregningsændring, ingen ny blokerende fejl. |
| S6 | Data carry-forward: TAF-periode der rækker ud over sidste kendte sats bruger `findLatest…` → sidste sats videreføres uden fejl | statistik/KRL/KL/overenskomst-lookups | Staleness-risiko; skal fail-close ved manglende nyere sats. **Statistik-interiort hul lukket (punkt 3):** `assertStatistikAarKontinuitet` (tal-neutral). **ASL lukket (punkt 4):** ASL slår indeks op **eksakt pr. år** (ingen carry-forward) → interiort hul OG efter-sidste-år fail-closer i motoren; validator/motor-endepunkts-asymmetri lukket med `assertAarsloenAslMaxKontinuitet` (tal-neutral). **Overenskomst (privat) lukket (punkt 5):** carry-forward ⇒ interiort hul umuligt; endepunkt = bevidst carry-forward gated af `endDate`-row. Endepunkt (efter sidste kvartal, DST) = bevidst carry-forward inden for 12-mdr-vindue, gated af `endDate`-row (punkt 12/13). **Overenskomst (offentlig) lukket (punkt 6):** `getOffentligLoenForDato/ForPeriode` carry-forwarder ⇒ interiort hul umuligt; efter-sidste-sats = bevidst carry-forward gated af `endDate`-row (`nyeste + 6 mdr − 1 dag`; KL → 31-03-2027, RLTN → 30-09-2026), punkt 12/13. **KRL lukket (punkt 9):** interiort hul var **ugated** (`buildSatstabelFromCombined` frafiltrerede null lydløst; `getReguleringsDatoIntervalForKRL` trustede nyeste-først-rækkefølgen uhåndhævet) → **rettet** med tal-neutral data-load-guard `assertKRLCombinedDataIntegritet` (strengt nyeste-først + ingen interiort null pr. kolonne), analog til `assertStatistikAarKontinuitet`; interiort hul + mis-sortering nu umulige. Efter-sidste-dato = bevidst carry-forward gated af `endDate`-row (nyeste + 6 mdr − 1 dag = 30-09-2026), punkt 12/13. **KL-lønaftaler lukket (punkt 10):** kæde-resolverens `loenAt` carry-forwarder den sidst regulerede løn efter sidste KL-dato (01-10-2026) ⇒ interiort hul umuligt (carry-forward mellem trin ER modellen). Efter-sidste-sats = bevidst carry-forward gated af `slutvaerdi`-row-error (`tilDato` = nyeste + 6 mdr − 1 dag = **31-03-2027**) OG af `validateLoenudviklingDataCoverage` (reguleringsdato efter tilDato → error). Motor↔gate alignet, nu ende-til-ende-testet (`reguleringSilentPathAlignment.test.ts`, S6-blok). **Datakomplethed verificeret på tværs (punkt 12):** udtømmende pr.-kilde audit bekræfter at øvre-gaten (interval-funktion → row + validator) dækker ALLE carry-forward-former (ikke kun statistik/KRL); ingen kilde viderefører en forældet sats uden synlig blokerende fejl for valide input. Manglende load-integritets-guards tilføjet (tal-neutrale, kaster kun ved korrupt data): KL-lønaftaler (`assertKlLoenaftalerDataIntegritet`), offentlig løn tom-tabel (`assertOffentligLoenTabelIkkeTom`), overenskomst nyeste-først (`assertOverenskomstSatserNyesteFoerst`), sygedagpenge kontinuitet flyttet til load-tid (`assertSygedagpengeRatesIntegritet`). |
| S7 | `getSatserForYear` er fail-open (`null`/`''`) — kun display, må ikke lække ind i beregningssti | `data/lovbestemteRates.ts:898` | **✅ BEKRÆFTET ENDELIGT (punkt 12):** repo-bred søgning over ALLE callsites viser `getSatserForYear` kun i display/dokument-stier (`documentService`, `Satser.tsx`, `satserDocument`); ingen reguleringsberegningssti rører den. (Første-bekræftet punkt 9 for KRL.) |

Bemærk: `loenudviklingBeregning.ts:63–70` dokumenterer, at **alle `throw` i filen er
defensive invarianter**, som fanges af `computeEoSnapshot` → `fail_closed`
(`failClosedReason: 'runtime_exception'`, jf. eo-snapshot-kontrakten). Reviewet skal
bekræfte, at hver silent-path enten er bevidst korrekt eller konverteret til en
sådan throw/blokerende gate.

## Arbejdsmodel

### Reviewets faser (pr. punkt)

1. **Kortlæg hele kæden** for formen: trigger og strategivalg, datakilde,
   reguleringsdato-brug, segment-/indeks-logik, akkumulering, afrunding, aggregering
   (tværs af ansættelsesforhold/år), snapshot, validator/gate, og **hvordan værdien
   ender i det færdige produkt** (skærm-visning, PDF, Word). Notér alle exit-stier
   (throw, warning, zero-delta, carry-forward, drop) *ved hvert led*, ikke kun i
   beregningsmotoren. Følg konkret ét gyldigt input-eksempel gennem alle led og
   bekræft, at den korrekte reguleringsværdi overlever hele vejen ud.
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
- **Hele kæden (obligatorisk):** følg den korrekte reguleringsværdi fra input til
  færdigt produkt. Ved *hvert* led nedstrøms for beregningen — aggregering på tværs
  af ansættelsesforhold/år, snapshot, validator/gate, skærm-præsentation, PDF- og
  Word-generatorer — kan værdien da tabes, overskrives, dobbelt-afrundes, filtreres
  bort, maskeres af et andet ansættelsesforhold, eller stille falde tilbage til
  nul/forældet? Ender det tal brugeren faktisk ser identisk med det beregningen
  producerede? Hvis værdien ikke vises, hvorfor — bevidst udeladelse eller tabt led?
- **Tests:** findes en meningsfuld invariant-test for både normalsti og fail-closed?
  Findes der mindst én test der binder formen **ende-til-ende** — fra input helt frem
  til produkt-output (snapshot/model → PDF/Word-render) — så et tabt eller forvansket
  led i kæden fanges, ikke kun beregningsmotoren isoleret?

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

## Kæde fra input til færdigt produkt

Ét gyldigt input-eksempel fulgt gennem alle led (angiv forventet reguleringsværdi
og bekræft den er intakt ved hvert trin):

| Led | Hvad sker med værdien | Risiko for tab/forvanskning | Bekræftet intakt? |
|---|---|---|---|
| Input + strategivalg | | | |
| Datakilde-opslag | | | |
| Reguleringsdato-forankring | | | |
| Segment/indeks/akkumulering | | | |
| Afrunding | | | |
| Aggregering (af/år) | | | |
| Snapshot | | | |
| Validator/gate | | | |
| Skærm-præsentation | | | |
| PDF-output | | | |
| Word-output | | | |

## Dækningsanalyse (led 2 — tavs under-regulering)

For hver exit-sti i formen (i **alle** led, ikke kun beregningsmotoren):
- Sti: [throw | warning | zero-delta | carry-forward | drop | tabt/ikke-vist nedstrøms]
- Led i kæden: [hvor i input→produkt-kæden ligger stien]
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
| 0 | Baseline og reguleringskort | — | Arbejdstræ, testbaseline, komplet form-/fil-inventar, trigger-kæde | ✅ ([review](regulering-0-baseline.md)) |
| 1 | Fælles fundament | begge | Reguleringsdato, coverage, segment-byggeri, effective-base (S1), afrunding | ✅ ([review](regulering-1-faelles-fundament.md)) |
| 2 | Form: Ingen | 1 | Bekræft ægte nul-regulering og at "Ingen" ikke maskerer manglende valg | ✅ ([review](regulering-2-form-ingen.md)) |
| 3 | Form: Statistik (ILON12/SBLON2) | 1 | Kvartalsindeks, base-clamp (S1), hul-i-serie (S6) | ✅ ([review](regulering-3-form-statistik.md)) |
| 4 | Form: Statistik ASL-årslønsmaksimum | 1+2 | ASL-indeksmotor, per-år-split, manglende indeks fail-closed | ✅ ([review](regulering-4-form-statistik-asl.md)) |
| 5 | Form: Overenskomst — privat | 1 | Pakke-indeks, dækningsstart, segment-zero-delta (S2) | ✅ ([review](regulering-5-form-overenskomst-privat.md)) |
| 6 | Form: Overenskomst — offentlig (KL/RLTN) | 1 | Løntrin-tabeller, base-fallback, segment-zero-delta (S3) | ✅ ([review](regulering-6-form-overenskomst-offentlig.md)) |
| 7 | Form: Manuelt angivet | 1 | Daterede lønrækker, før-basis-drop, base-forankring | ✅ ([review](regulering-7-form-manuelt-angivet.md)) |
| 8 | Form: Manuel procentsats | 1 | Akkumuleret indeks, uparsbar-pct-drop (S5), før-basis | ✅ ([review](regulering-8-form-manuel-procentsats.md)) |
| 9 | Form: KRL satstabel | 1 | Reguleringsprocent-indeks, 4 delserier, base-clamp (S1) | ✅ ([review](regulering-9-form-krl-satstabel.md)) |
| 10 | Form: KL-lønaftaler | 1 | Trinvis kæde-opregulering, trin-spring (S4), særvisninger | ✅ ([review](regulering-10-form-kl-loenaftaler.md)) |
| 11 | Familie 2: opregulerings-motorer | 2 | `opreguleringsmotorer`, TAF-opreguleret, offentlige ydelser, EET-rater | ✅ ([review](regulering-11-familie2-motorer.md)) |
| 12 | Datakomplethed og staleness | — | Alle satskilders dækningsgrænser, carry-forward (S6), Excel-generering | ✅ ([review](regulering-12-datakomplethed-staleness.md)) |
| 13 | Coverage-gate, validator og escape-hatch | — | Row-evaluation, validator, `allowReguleringMedOverenskomst…`, multi-af | ✅ ([review](regulering-13-coverage-gate-validator.md)) |
| 14 | Præsentation og output-paritet | — | Reguleringsværdier/-tabeller, PDF/Word, `tidligsteSatsGaelderFra`-note | ✅ ([review](regulering-14-praesentation-output-paritet.md)) |
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
- `getReguleringsDatoIntervalFor…`-familien (5 funktioner): tre kopierer
  "+6 måneder − 1 dag"-aritmetikken via `getInclusivePeriodEndByMonths(…,6)`
  (`krlRates.ts:197`, `klLoenaftaler.ts:139`, `offentligLoenLookup.ts:289`) og skal
  konsolideres mod den kanoniske helper. `…ForStatistikModel` (`statistiskeRates.ts:221`)
  bruger "+12 måneder − 1 dag" (ILON/SBLON) hhv. år-grænser (ASL) og er en egen sats;
  `…ForOverenskomst` (`overenskomstRates.ts:1686`) delegerer allerede til offentlig-varianten.
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

Primært scope: `reguleringsPresentation.ts`; regulerings-inspektionslaget
(`domain/eoInspektion/eoInspektionRegulation*` — nedstrøms DEV-kontrollag, tidl. `debug/eoDebugRegulation*`);
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
2. ~~Hul-midt-i-serie for statistik og KRL (punkt 3, 9).~~ **LUKKET:** statistik via
   `assertStatistikAarKontinuitet` (punkt 3); KRL via `assertKRLCombinedDataIntegritet`
   (punkt 9, strengt nyeste-først + ingen interiort null pr. kolonne). Begge tal-neutrale.
3. ~~KL-lønaftaler missing-rate / efter-sidste-sats fail-closed (punkt 10).~~ **LUKKET (punkt 10):**
   S4 (missing-rate) hærdet fail-closed i kæde-resolveren (dato + sats fra samme kilde-række; korrupt
   data → `throw`), dækket af dedikeret resolver-test + fail-closed-test (mocket datamodul,
   `klLoenaftalerFailClosed.test.ts`). S6 (efter-sidste-sats) bekræftet gated af `slutvaerdi`-row +
   coverage-validator, bundet ende-til-ende (`reguleringSilentPathAlignment.test.ts`, S6-blok). §5-invarianterne
   (deltaPct fuld præcision → trinvist afrundet løn; `reguleretLoenOre` autoritativ; SFGG-reproduktion)
   dækket af `klLoenaftalerReguleretLoen.test.ts`.
4. ~~Nær-nul og negativt beløb i TAF-opreguleret med manglende sats (punkt 11).~~ **LUKKET (punkt 11):**
   0-beløbs-undtagelsen er strikt `=== 0` → nær-nul (1 øre) og negative beløbsår kræver fuld satsdækning
   og fail-closer ved manglende sats (fanget af 4 nye tests i `tafPerYearOpreguleretDerived.test.ts`).
5. ~~Ende-til-ende: manglende overenskomst-sats → `computeEoSnapshot`
   `runtime_exception`~~ **(punkt 5 — OMDEFINERET/LUKKET):** privat overenskomst har
   ingen realistisk `runtime_exception`-sti (basen falder altid tilbage til første sats;
   `getSatserForDatoFromList` carry-forwarder). Den reelle trust-binding — før-dækning →
   synlig blokerende `reguleringsvaerdi`-row-error — er nu dækket ende-til-ende
   (`reguleringSilentPathAlignment.test.ts`, S2-blok). Den forventede `runtime_exception`
   (manglende løntrin/basissats) hører til den **offentlige** gren (punkt 6).
   **(punkt 6 — LUKKET):** offentlig gren har samme robusthed som privat — `getOffentligLoenForDato`
   carry-forwarder og **kaster** ved manglende løntrin (degraderer ikke til zero-delta). Med komplette
   data (alle 56 løntrin i alle 60 KL/RLTN-reguleringer) er `runtime_exception` en defensiv
   data-integritets-invariant, ikke en sti valid input rammer. Nu bundet ende-til-ende af tre nye tests:
   S3-alignment (før-dækning → row-error), normalsti/invariant, og manglende-løntrin (mocket) →
   motor-throw (`loenudviklingOffentligFailClosed.test.ts`).
6. ~~Multi-af partiel dækning i coverage-gate (punkt 13).~~ **LUKKET (punkt 13):** maskering er strukturelt umulig (ingen aggregeret regulerings-status; per-af fail-closed), bundet af ende-til-ende-test (af A fuld dækning skjuler ikke af B's hul).

Konvergens: ~~konsolidér de tre `+6 mdr`-kopier af `getReguleringsDatoIntervalFor…` og det
duplikerede `reguleringssats`-opslag~~ **DELVIS LUKKET:** de tre `+6 mdr`-kopier er konsolideret mod
den kanoniske `getInclusivePeriodEndDanishDate(fraDato, months)` (`utils/dateUtils.ts`, bevist byte-
identisk, punkt 12); det duplikerede `reguleringssats`-opslag er konsolideret mod `resolveReguleringssatsForAar`
(punkt 11, U1). **Rest til punkt 15:** de to bevidst forskellige `+12 mdr`-inline-varianter
(`…ForStatistikModel` ILON/SBLON + privat `…ForOverenskomst`) kan tal-neutralt adoptere den samme delte
helper med `months = 12`. Fjern død kode/forældede kommentarer; bekræft at hver form deler det fælles fundament.

Endelig gate: relevant fuld kvalitetsgate, åbne godkendelser afklaret, silent-path-
kataloget fuldt afgjort (hver post: bekræftet korrekt / rettet / godkendelsesparkeret).

## Åbne godkendelsespunkter

Nye punkter registreres her, når reviewet finder en beregningsændring eller
gate-strengheds-ændring der kræver brugerens beslutning. De lukkes ikke teknisk uden
brugerens beslutning.

Ingen åbne godkendelsespunkter pt.

**✅ AFGJORT — G13-1 (punkt 13) — Supplement-konsistens: row-laget strengere end validator + motor.**
Row-laget (`eoRowIndkomstRows.ts`, `supplementsOk`) markerer `alleVaerdier` = rød (Nej), hvis et
tillægsfelt (feriepenge / SH-SO / fritvalg / AG-pension) er udfyldt på nogle aktive
manuel-angivet-rækker, men blankt på andre — bevidst strengere end motoren (blankt tillæg = 0 /
base-fallback) og validatoren. **Brugerbeslutning 2026-07-04: BEHOLD den røde markering** — et tomt
tillæg må ikke falde stille tilbage til basissatsen uden synlig markering. Ingen tal berørt.
Asymmetrien er nu dokumenteret ved callsite (kommentar) så den ikke fjernes som apparent drift.

## Udskudte fund

| ID | Fundet i punkt | Behandles i punkt | Fund | Status |
|---|---|---|---|---|
| U1 | 0 | 11 | `offentligeYdelserUdviklingBeregning.ts` har to per-år-satsopslag: motoren (`:32`, `:38–41`) og et råt `reguleringssats[year]`-loop (`:99–103`). Begge kaster ved manglende sats (adfærd i dag ens), men opslaget bør konsolideres til motoren. **LUKKET (punkt 11):** udtrukket delt gateway `resolveReguleringssatsForAar` (`opreguleringsmotorer.ts`, parallel til `resolveAslAarsloensmaksimumForAar`); både motorens dæknings-check OG display-loopet slår nu op via den (display bevarer sit legitime rå-per-år-sats-concern, men deler fail-closed-opslaget). Tal-neutralt, bevist ved uændrede tests. | Lukket |
| U2 | 0 | 13 | Multi-ansættelse-asymmetri: `Beregningsperiode`-grenen (`:1478`) kalder `resolveReguleringsStrategi` pr. af med ét-element-array, så `assertUniform` er inaktiv; cross-af-uniformitet håndhæves kun i angivet-løn-grenen (`:1604`). Aggregeret status-masking skal testes i row-laget. **LUKKET (punkt 13):** maskering er **strukturelt umulig** — der er ingen aggregeret regulerings-status; row-laget og compute er per-af fail-closed, og `assertUniform` er bevidst inaktiv i `Beregningsperiode`-grenen netop fordi hvert af beregnes selvstændigt (ét af's hul kan aldrig skjules af et andets dækning). Bekræftet med ende-til-ende-test (af A fuld dækning skjuler ikke af B's hul). | Lukket |
| U3 | 6 | 14/15 | `resolveOffentligLoenSelection` findes i tre varianter: compute (`loenudviklingBeregning.ts:234`, kaster) + to inspektions-/visnings-varianter (`eoInspektion/eoInspektionRegulationCore.ts:88`, `eoInspektionLoenCoreModel.ts:76`, returnerer `null`). Throw-vs-null-semantikken er bevidst, men den rene input-parsing bør udtrækkes til én delt helper med tynde wrappers. **LUKKET (punkt 14):** rén parsing udtrukket til `helpers/offentligLoenSelection.ts` (`parseOffentligLoenSelection` → diskrimineret `{ok, reason}`-resultat). Compute mapper `reason` → uændrede feltspecifikke throw-beskeder i bevaret rækkefølge (fail-closed); begge inspektions-varianter returnerer `null` ved enhver `reason`. Tal-/adfærds-neutralt, dækket af `offentligLoenSelection.test.ts`. | Lukket |
| U4 | 6 | 15 | `effectiveReguleringsdatoIso` (`loenudviklingBeregning.ts:897`) beregnes ubetinget men bruges kun i privat-grenen; offentlig gren clamper via `resolveOffentligEffectiveBase`-fallback. To clamp-mekanismer for samme concern — kandidat til konsolidering. Harmløs. | Åben |
| U5 | 7 | 15 | `computePackageValuePct` (`loenudviklingBeregning.ts:199–209`, brugt af manuel + offentlig overenskomst) duplikerer den kanoniske `computeFormulaValue` (`reguleringFormulaUtils.ts:83`, brugt af privat overenskomst + præsentation) — samme matematik, to funktioner. Afrunding deles reelt; formel-funktionerne bør konsolideres. **Nuance:** ikke trivielt ombyttelige — `computeFormulaValue` coercer ikke-finite input → 0, mens `computePackageValuePct` propagerer `NaN`/`Infinity` (→ callsite-throw). Konsolidering skal afstemme finite-guards for at bevare fail-closed. Tal-identiske for valid input. Rører offentlig-grenen (6) + præsentation (14). **Bekræftet uændret i punkt 14** (ikke et paritet-problem; ikke forceret under præsentations-review). Anbefalet fix (punkt 15): gør `computePackageValuePct` til en tynd wrapper der finite-guarder (throw ved ikke-finit) og delegerer til `computeFormulaValue`. | Åben |
| U6 | 8 | 13/15 | "Aktiv-række + begge-felter-krævet"-prædikatet for manuel regulering findes i tre parallelle kopier: compute-drop (`manuelProcentsatsRegulering.ts:56–59` / `buildLoenudviklingFromManual`), validator (`erstatningsopgoerelseValidator.ts:894–908`) og row-lag (`eoRowIndkomstRows.ts:297–302`). Validator + row-lag deler bogstaveligt identisk kode. Gælder både manuel procentsats og manuel angivet (punkt 7). Alle alignet i dag, men drift-risiko (gate/motor ude af sync). Konsolidér til én delt helper. Desuden: `alleVaerdier`-row giver `ok` ved nul aktive rækker for procentsats men `error` for angivet — bekræft bevidst domæneforskel; og en før-basis-række uden procent dobbelt-signalerer (error + warning). **LUKKET (punkt 13):** de tre kopier konsolideret til `helpers/manuelReguleringRowPredicates.ts` (`isManuelProcentsatsRowAktiv/Komplet`, `isManuelAngivetRowAktiv`, `isManuelAngivetRowDatoUdfyldt`, `hasFinitePct`); compute-drop + validator + row-lag kalder nu helperen, bevist byte-ækvivalent (`row.dato !== undefined` = de tidligere `trim`/`isISODateString`-varianter på det committed domæne). `alleVaerdier`-domæneforskellen bekræftet bevidst; før-basis-dobbeltsignaleringen dokumenteret som fail-closed (ikke fejl). | Lukket |
| U7 | 9 | — | ~~Pre-eksisterende testfejl på `main` (`loenudviklingOffentligFailClosed.test.ts`, 43 fejl på 9 filer)~~ **KUNNE IKKE REPRODUCERES / FALSK ALARM (verificeret af hovedtråden):** ren baseline (`git stash -u`) → `npx vitest run loenudviklingOffentligFailClosed` = 1/1 grøn; fuld suite med alle punkt-9/10-ændringer = **496 filer / 5859 tests, alle grønne**. Punkt-9-subagentens "43 fejl"-observation skyldtes formentlig en transient mid-run-tilstand (samtidig kørende punkt-10-subagent, der redigerede working tree). Intet fund. | Lukket |
| U8 | 10 | 14 | KL-lønaftaler-præsentationen (`reguleringsPresentation.ts:1072`, `buildReguleringIndexRows`) **genberegner** den viste regulerede løn fra `deltaPct` i stedet for at bruge segmentets autoritative `reguleretLoenOre` (som PDF/Word-indkomstlinjerne gør). Tal-identisk i dag pga. §5.2, men en unødig anden kilde til samme værdi — bør læse `segment.reguleretLoenOre` direkte (single source of truth). Harmløs. **LUKKET (punkt 14):** KL "Beregnet regulering"-tabellen læser nu segmentets autoritative `reguleretLoenOre` direkte (defensiv `deltaPct`-fallback bevaret, tal-identisk pr. KL-doc §2). Single source of truth med indkomst-linjerne; visnings-neutralt, pinnet af `reguleringsPresentation.test.ts` + KL ende-til-ende Word-test. | Lukket |
| U9 | 11 | 14 | Offentlige ydelsers reguleringstabel (`offentligeYdelserUdviklingBeregning.ts:113`, `buildOffentligeYdelserReguleringTableData`) bygger "Akkumuleret regulering"-kolonnen fra den rå u-afrundede akkumulerede pct, ikke fra den 2-decimal-afrundede `segment.deltaPct` der driver selve beløbet. Bevidst (visning af akkumuleret sats), beløb upåvirket — men samme klasse som U8 (vist tal ≠ tal-der-driver-beløb). Bør bekræftes/afstemmes i præsentations-paritet. Harmløs. **LUKKET (punkt 14):** bekræftet uden synlig forskel — `formatPercent` afrunder selv til 2 decimaler ved visning, så den viste "Akkumuleret regulering" = den værdi beløbet drives af. Ingen ændring. | Lukket |
| U10 | 12 | 15 | To bevidst forskellige `+12 mdr − 1 dag`-inline-varianter af `getReguleringsDatoIntervalFor…` (`statistiskeRates.ts` ILON/SBLON + privat `overenskomstRates.ts`) kan tal-neutralt adoptere den nye kanoniske `getInclusivePeriodEndDanishDate(fraDato, 12)` (`utils/dateUtils.ts`) — samme konsolidering som de tre `+6 mdr`-kopier (punkt 12). Kun de forskellige `months`-argumenter adskiller dem. Harmløs. | Åben |

## Afslutningskrav for hvert punkt

Et punkt markeres kun `✅ Gennemgået`, når:

- reguleringsformens exit-stier alle er afgjort (bevidst korrekt eller fail-closed);
- den korrekte reguleringsværdi er fulgt **hele vejen fra input til det færdige
  produkt** (skærm, PDF, Word), og hvert nedstrøms-led er bekræftet for ikke at tabe,
  overskrive, dobbelt-afrunde, filtrere eller undlade at vise værdien;
- alle silent-path-poster under punktet er lukket eller parkeret i denne plan;
- relevante kontrakter/domænedocs er opdateret eller bekræftet;
- normalsti **og** fail-closed-sti er dækket af meningsfulde tests, og resultatet er
  noteret;
- ingen kendt beregningsændring venter uden at stå i "Åbne godkendelsespunkter";
- statustabellen i denne plan er opdateret.
