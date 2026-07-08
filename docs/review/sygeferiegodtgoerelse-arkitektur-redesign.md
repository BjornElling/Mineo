# Sygeferiegodtgørelse — arkitektonisk redesign set fra bunden

**Dato:** 2026-07-08
**Status:** Under implementering. **Skridt 1 (S2 delvist)** og **skridt 2 (S1)** er gennemført.

> **Implementeringsstatus (opdateres pr. skridt):**
> - ✅ **Skridt 1 — S2 (delvist):** tekst-round-trippen for 4-måneders-cap'et dræbt; kontrol læser
>   `sfggAfkortninger`, `sfggDayBasis`, `foerstEfterSygeloen` og feriepenge-total fra motoren;
>   præsentationsmodellen er nu et alias af motorens resultat.
> - ✅ **Skridt 2 — S1:** SFGG-kilden samlet i `engines/sygeferiegodtgoerelseKilde.ts` (låst,
>   exhaustivt `SFGG_KILDE_REGISTRY` + `resolveSfggSource`/`resolveSfggDayBasis`/predicates). Motorens
>   ~8 spredte kilde-grene ruter nu gennem registeret, og validatoren dispatcher på
>   `resolveSfggSource(...).kind` frem for at genudlede kilde-splittet på rå literaler. Tal- og
>   UI-neutralt bortset fra én bevidst rettelse: valideringen behandler nu et hængende privat
>   direkte-sats-overenskomst-ID som ferielov-sporet (i overensstemmelse med motoren) når
>   `harOverenskomst` er slået fra — tidligere gav den selvmodsigende beskeder i den (altid
>   blokerede) tilstand. Pinnet af ny `sygeferiegodtgoerelseKilde.test.ts` + validator-regression.
> - ⬜ **Skridt 3 — S3** (periode-pipeline + fuldførelse af S2's strukturerede afkortninger), **S4/S5** (oprydning): endnu ikke påbegyndt.
**Baggrund:** Efter det gennemførte regulering-redesign (`regulering-arkitektur-redesign.md`) er
mistanken, at samme rod-problem — *parallel logik holdt sammen af tests i stedet for af struktur* —
også gør sig gældende for sygeferiegodtgørelse (SFGG).
**Formål:** Vurdere om diagnosen holder for SFGG, og hvis ja, beskrive det design jeg ville have bygget
fra bunden med den nuværende viden om formål og funktionalitet — uden at være bundet af den nuværende
kode. Breaking ændringer er tilladt og overvejet.

> Dette er et **beslutningsoplæg**, ikke en implementeringsplan i detaljer. Hvert forslag angiver
> gevinst, arbejde ved at ændre, og risiko. Forslag der kan ændre **producerede tal** er eksplicit
> markeret og kræver forelæggelse jf. `AGENTS.md`. Målbilledet er tal- og UI-neutralt: samme facit,
> anden struktur.

---

## 1. Hovedkonklusion først

**Ja — den samme rod-årsag gør sig gældende, men i en langt mere inddæmmet form end reguleringen var i
før sit redesign.** Det er vigtigt at sige præcist, for det ændrer, hvor stort indgrebet bør være.

Hvor reguleringen led af *strategi-dispatch × lag = duplikering i anden potens* (den samme form udsmurt
som parallelle grene i fem lag fordelt på tre 1000+-linjers filer), er SFGG allerede betydeligt sundere:

- **Der er kun én motor.** Al beregning bor i
  [sygeferiegodtgoerelse.ts](../../src/domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse.ts)
  (1595 linjer). Der findes **ikke** — modsat reguleringens `eoInspektionRegulationCore.ts` — en tredje
  uafhængig timeline i inspektionslaget. Inspektionen læser motorens resultat (og krydstjekker
  `canonicalOutput.taf.sygeferiegodtgoerelseOre` mod summen af `perAnsaettelsesforhold[].totalOre` —
  et ægte forsonings-tjek, ikke en parallel motor).
- **Segmentet er allerede rigt og autoritativt.** `SygeferiegodtgoerelseSegment` bærer `satsOre`,
  `antalDage`, `feriepengekravOre`, `beregnetSfggoereOre`, `loenPlusLoen2PlusIkkePensLoenKroner`,
  `feriepengeAfSygeloenOre`, `alleredeBetaltOre` og `reguleringsindeks`. PDF/Word-laget
  ([eoBilagSections.ts](../../src/document/generators/eo/sections/eoBilagSections.ts)) og
  præsentations-snapshottet er stort set ren formattering af motor-output.
- **UI-afledningerne er tynde adaptere**, der *kalder* motorens primitiver
  (`resolveSfggReferenceperiodeDayCount`, `resolveSfggReferenceperiodeMaxDate`), ikke genimplementerer dem.

Men rod-årsagen findes stadig, koncentreret to steder:

> **1. Kilde-dispatch er udsmurt.** De 5 `SfggSourceKind` (`ingen` · `manuel` · `ferielov` ·
> `overenskomst_direkte` · `overenskomst_ferielov`) dispatches uafhængigt i **~8 funktioner inde i
> motoren** (`resolveSfggBaseRate`, `resolveSfggSegmentRateForDate`, `resolveAdjustedRate`,
> `resolveSfggDayBasis`, `resolveSfggAfterEmployerSickPayProjection`, `resolveSfggSegmentBoundaryStarts`,
> tekst-helpere) — **og genudledes parallelt i validatoren og i kontrol-/row-laget.** En SFGG-kilde
> "er" ikke defineret ét sted; den er en gren i hver funktion. Det er nøjagtig reguleringens R1-problem,
> bare inden for én fil plus to konsumenter.

> **2. Læse-siden genudleder fakta motoren allerede kender.** Seks konkrete steder re-derivér i stedet
> for at læse — værst: **kontrol-laget genskaber "er retten 4-måneders-begrænset?" ved at *parse
> motorens egen PDF-tekst** (`parseSfggExplanatoryLine`), selv om motoren allerede bærer den
> strukturerede `capReachedDate`. Det er præcis reguleringens U8/U9-klasse ("vist ≠ beregnet"), her i
> en tekst-round-trip-variant.

**Anbefaling:** ikke en big-bang-omskrivning. SFGG er tættere på målbilledet end reguleringen var —
motoren og PDF-laget er i vid udstrækning allerede rigtige. Indgrebet bør være **proportionalt**:
saml kilde-dispatchen i ét register (S1), gør motor-resultatet til den eneste sandhed for læse-siden og
erstat tekst-round-trippen med strukturerede data (S2), og gør periode-afkortningen til en eksplicit,
navngiven pipeline med deklarerede årsager (S3). S4/S5 er lav-værdi oprydning. Alt tal- og UI-neutralt.

---

## 2. Hvad der SKAL overleve et redesign (guardrails)

Disse er domænesandheder fra det normative dokument
([sygeferiegodtgoerelse.md](../domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md)) og bevidste
beslutninger i koden. Ethvert forslag herunder er formuleret, så de overlever — et redesign der
"forener dem væk" ville genindføre fejl.

| # | Bevidst regel / afvigelse | Hvorfor korrekt | Kilde |
|---|---|---|---|
| **G1** | **FP-sats er altid de lovbestemte 12,5 %** i procent-af-løn-sporene — aldrig `employment.feriePct` | Den indtastede sats er ofte overenskomstforhøjet (fx 14,5 %) og dækker tillæg der ikke indgår i SFGG | dok. §2.0; motor L64, L1006 |
| **G2** | **Dagbasis = kalenderdage KUN** når referenceperiode-sporet (`ferielov`/`overenskomst_ferielov`) OG TAF = måneder; ellers arbejdsdage | Bevidst afvigelse dokumenteret i §afvigelse 1 | motor `resolveSfggDayBasis` L116 |
| **G3** | **Før/efter 1.1.2015-tvedeling**: før = fra første sygedag + 4-måneders-loft; fra/med = fra anden sygedag (første TAF-dag i hele forløbet udgår på 1. EO), tidsubegrænset | Lovændring; §6.1/6.2 | motor L1218-1225, `buildCapComputation` L450 |
| **G4** | **Arbejdsgiverbetalt sygeløn**: perioden udgår fra SFGG-**kravet**, men tæller stadig med i 4-måneders-loftet; første-sygedag-reglen opfyldes af første sygedag i hele forløbet — også inde i en sygeløns-periode | §6.2, §7 | motor L1240-1248, L1306-1314 |
| **G5** | **Ansættelsesophør stopper SFGG uden fejl**, men med PDF-note; verbum `bortfaldt`/`bortfalder` afhænger af om datoen er passeret | §6.4, §9.2 | motor `resolveSfggOphoerVerb` L421, L1293 |
| **G6** | **Ferieperioder er fælles** for alle ansættelsesforhold; ellers beregnes SFGG **fuldstændigt separat pr. ansættelsesforhold** uden sammenblanding | §1, §2.2 | motor L1263, L1317 |
| **G7** | **"Feriepenge modtaget i perioden"** (fradraget) medregner indkomst fra **samtlige** arbejdsgivere — ikke kun dem skadelidte var ansat hos på skadestidspunktet | Bevidst note i koden | motor L1255-1261 |
| **G8** | **Overenskomstens SFGG-fravigelse er en eksplicit boolean**, aldrig en dynamisk formel; manglende policy = systemteknisk fejl (runtime-assert) | §3.1 | `getOverenskomstSfggPolicy` + policy-dæknings-assert |
| **G9** | **Referencesatsen forhøjes på samme tidspunkt og med samme pct som TAF** (via loenudvikling-segmenter) i referenceperiode-sporene | §4.2 | motor `resolveAdjustedRate` L1057 |
| **G10** | **Referencesatsen beregnes af den AFRUNDEDE løn (2 dec.)** så brugeren kan efterregne fra det viste tal; feriepenge-fradraget cap'es (`Math.min`) så `sum(feriepenge)+sum(SFGG)=sum(gross)` holder præcist | Efterregnelighed + øre-invariant | motor L1000-1003, L1471-1474 |
| **G11** | **Nul-vægt-fordeling**: når alle segment-vægte er 0, lægges hele beløbet deterministisk på første segment (fail ikke lukket) | Bevidst beslutningsnote | motor `allocateOreByWeights` L878-890 |
| **G12** | **Direkte overenskomstsats er pr.-periode** (ikke én referencesats); et forældet `sfggSatsvalg` må ikke gøre en ikke-differentieret sats uberegnelig | §4.1; robusthed ved kildeskift | motor L793-804, `per_period_rate` |
| **G13** | **Inspektionslaget er et krydstjek, ikke en motor** — det summerer motor-resultatet og sammenligner med canonical-output; det må aldrig blive selvstændig domænesandhed (B9-grænsen) | Trust-arkitektur | `eoInspektionSammentaelling.ts` L564-566 |

---

## 3. Redesign-forslag — oversigt

Rangeret efter gevinst/risiko.

| # | Forslag | Gevinst | Arbejde | Risiko |
|---|---|---|---|---|
| **S1** | **SFGG-kilde som selvindeholdt strategi-modul** (låst kilde-register; dispatch ét sted; validator + row-lag konsumerer registeret) | **Stor** — fjerner rod-årsagen: de 5 kilders grene samles fra ~8 motor-funktioner + validator + row-lag til ét modul pr. kilde | **Middel** — definér `SfggKilde`-kontrakt; flyt grenene ud af motor, validator og row-lag | **Middel** — tal-neutralt *flyt*; byte-identitet testbar |
| **S2** | **Ét autoritativt SFGG-resultat; kontrol/PDF formatterer kun** (fjern læse-sidens re-derivation; strukturér forklaringer i stedet for at parse tekst) | **Stor (trust)** — dræber tekst-round-trippen (cap via `parseSfggExplanatoryLine`) og 5 andre re-derivationer; "vist = beregnet" ved konstruktion | **Middel** — bær `foerstEfterSygeloen`, struktureret afkortnings-årsag, feriepenge-total på resultatet; omskriv row-laget til ren formattering | **Lav-middel** — læse-side allerede test-pinnet; PDF-tekst-ordlyd skal bevares |
| **S3** | **SFGG-periode som eksplicit pipeline med deklarerede afkortningsårsager** (`{visningsperiode, eligibleRanges, afkortninger[]}`) | **Middel-stor** — den 360-linjers orkestrator-løkkes vigtigste logik (rækkefølge: første-dag → cap → ophør → sygeløn → ferie) bliver ét auditerbart sted; fodrer S2's strukturerede forklaringer | **Middel** — udtræk pipeline af `computeSygeferiegodtgoerelse` | **Lav-middel** — tal-neutralt; rækkefølgen skal bevares nøje |
| **S4** | **Delt IsoRange-algebra** (subtraktion/split/clip/range-fra-datoer samlet med `mergeIsoDateRanges`) | **Lille-middel** — range-primitiverne bor i ét kanonisk hjem frem for privat i motoren | **Lille** | **Lav** — tal-neutralt |
| **S5** | **Overenskomstens SFGG-policy som deklarativ load-kontrakt** (bekræft/hærd den eksisterende dæknings-assert) | **Lille (trust)** — ingen overenskomst kan mangle SFGG-policy | **Lille** — meget findes allerede | **Lav** — rent load |

---

## 4. Forslagene i detaljer

### S1 — SFGG-kilde som selvindeholdt strategi-modul

**Nuværende tilstand.** `resolveSfggSource` (motor
[L509](../../src/domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse.ts#L509)) normaliserer
`sfggBeregningskilde`-literalen til en `SfggSourceKind` og indkapsler den vigtige finesse, at
`'Overenskomst'` splittes til `overenskomst_direkte` vs. `overenskomst_ferielov` afhængigt af offentlig
type + `getOverenskomstSfggPolicy(...).model`. Men **selve adfærden pr. kilde er spredt** over:
`resolveSfggDayBasis` (L116), `resolveSfggBaseRate` (L951, if-kæde på kind),
`resolveSfggSegmentRateForDate` (L1157), `resolveAdjustedRate` (L1057),
`resolveSfggAfterEmployerSickPayProjection` (L546, switch), `resolveSfggSegmentBoundaryStarts` (L1112)
og tekst-helperne. Og dispatchen er **genudledt parallelt** i to konsumenter:

- **Validatoren** (`validateSygeferiegodtgoerelse`, [erstatningsopgoerelseValidator.ts:454](../../src/validators/erstatningsopgoerelseValidator.ts#L454))
  genimplementerer selv "er dette direkte-sats eller ferielov?"-splittet som en `requiresReferenceperiode`-
  boolean (L483-485) via egne opslag af `getOffentligOverenskomstTypeById` + `getOverenskomstSfggPolicy`
  — præcis samme forgrening som `resolveSfggSource` L517-523, men udtrykt på rå streng-literaler.
- **Kontrol-/row-laget** ([eoRowSygeferiegodtgoerelseRows.ts:37-61](../../src/domain/eoRowEvaluation/eoRowSygeferiegodtgoerelseRows.ts#L37))
  genudleder overenskomst-policy, "ukendt overenskomst-ID" og re-deriverer dagbasis (L28, L121).

**Greenfield-design.** Én kontrakt og ét register — den direkte parallel til reguleringens R1:

```ts
interface SfggKilde {
  readonly kind: SfggSourceKind;
  dayBasis(tafEnhed: TafBeregningsenhed): SfggDayBasis;                      // i dag resolveSfggDayBasis
  resolveBaseRate(ctx): SfggBaseRateResult;                                  // i dag resolveSfggBaseRate-gren
  resolveSegmentRate(iso, ctx): SfggSegmentRate | null;                      // i dag resolveSfggSegmentRateForDate-gren
  segmentBoundaryStarts(ranges, ctx): readonly ISODateString[];             // i dag resolveSfggSegmentBoundaryStarts
  afterEmployerSickPay(ctx): { hasExplanation: boolean; text: string | null }; // i dag resolveSfgg...Projection
  presentation: SfggKildePresentationMeta;                                   // intro/authority/label-tekster
}
const SFGG_KILDE_REGISTRY: Readonly<Record<SfggSourceKind, SfggKilde>>;      // exhaustivt — compile-fejl at glemme en kilde
```

Dispatch sker **ét sted** (`SFGG_KILDE_REGISTRY[kind]`). Validatoren og row-laget dispatcher på
`resolveSfggSource(...).kind` i stedet for at genudlede referenceperiode-krav og policy-model selv.

**Vigtig afgrænsning (jf. `AGENTS.md` Konvergens).** Registeret er **ikke** et udvidelsespunkt for nye
SFGG-typer. Feature-fladen er låst; formålet er at samle de eksisterende 5 kilder i ét statisk,
exhaustivt register, så en kilde ikke længere kan glemmes i et lag. Fordi SFGG allerede er én fil, er
gevinsten mindre end reguleringens (ingen 3-fil-konsolidering) — den reelle værdi er at fjerne
validatorens og row-lagets **parallelle** genudledning af kilde-splittet.

| Kolonne | Vurdering |
|---|---|
| **Gevinst** | Stor. Én kilde "er" ét modul; validator og row-lag kan ikke længere drive fra motorens kildeforståelse. |
| **Arbejde** | Middel. Kontrakt + flyt af grenene fra ~8 motor-funktioner og 2 konsumenter. |
| **Risiko** | Middel. Rent flyt (samme matematik, ny placering); byte-identitet pinnet af beregnings-, validator- og render-suiten. |

### S2 — Ét autoritativt SFGG-resultat; kontrol/PDF formatterer kun

**Nuværende tilstand.** PDF-laget er allerede næsten ren formattering, men kontrol-/row-laget
re-deriverer seks fakta motoren allerede kender:

1. **Cap-fakta via tekst-parsing (værst).** `hasFourMonthCap` udledes ved at scanne
   `result.pdfExplanatoryLines` og `parseSfggExplanatoryLine`
   ([eoRowSygeferiegodtgoerelseRows.ts:146,358-367](../../src/domain/eoRowEvaluation/eoRowSygeferiegodtgoerelseRows.ts#L146))
   — selv om motoren allerede bærer den strukturerede `capReachedDate` (L1395/L1557). En struktureret
   kendsgerning genskabes ved at parse motorens egen prosa.
2. **Dagbasis** re-derives (L28, L121) selv om motoren eksponerer `entry.sfggDayBasis` (læst af PDF på
   [eoBilagSections.ts:241](../../src/document/generators/eo/sections/eoBilagSections.ts#L241)).
3. **"Først efter sygeløn"** genberegnes via `resolveSfggFoerstEfterSygeloen` (L123-128).
4. **"Feriepenge modtaget i perioden"-total** re-summeres fra `result.segments` (L322-328), skønt
   motoren allerede har `feriepengeModtagetFormula.totalOre` (L1523).
5. **Kilde/policy/ukendt-ID-dispatch** (L37-61) — hører sammen med S1.
6. **PDF-display-flag** (`hasRegulatedSfggRate`, referenceperiode-ranges, SH-fradrag-fodnote,
   [eoBilagSections.ts:244,514-523](../../src/document/generators/eo/sections/eoBilagSections.ts#L244))
   — præsentations-flag afledt ved at scanne segmenter; acceptabelt, men kunne motor-bæres.

**Greenfield-design.** Motoren producerer alt læse-siden skal bruge; kontrol og PDF **læser og
formatterer kun**. Konkret:

- Erstat `pdfExplanatoryLines: string[]` + `parseSfggExplanatoryLine` med et **struktureret**
  `sfggAfkortninger: readonly { årsag: 'cap4mdr' | 'ansaettelsesophoer' | 'sygeloen'; dato?: ISODateString; verbum?: 'bortfaldt' | 'bortfalder' }[]`.
  Både PDF og kontrol *formatterer* dette til prosa — ingen parser tekst tilbage til struktur.
  (Ordlyden bevares byte-identisk; kun repræsentationen skifter fra streng til struktur + formatter.)
- Læs `entry.sfggDayBasis`, `entry.foerstEfterSygeloen` (nyt felt) og
  `entry.feriepengeModtagetFormula.totalOre` frem for at genberegne dem.

Dette gør "vist = beregnet" til en invariant ved konstruktion for SFGG, ligesom R2 gjorde for regulering.

| Kolonne | Vurdering |
|---|---|
| **Gevinst** | Stor (trust). Fjerner tekst-round-trippen (den mest skrøbelige klasse) og 5 øvrige re-derivationer. |
| **Arbejde** | Middel. Udvid resultat-typen; omskriv row-laget til formattering; deling af formatteringen mellem PDF og kontrol. |
| **Risiko** | Lav-middel. Læse-siden er PDF/Word-render-test-pinnet; den strukturerede forklaring skal producere byte-identisk prosa. |

### S3 — SFGG-periode som eksplicit pipeline med deklarerede afkortningsårsager

**Nuværende tilstand.** `computeSygeferiegodtgoerelse` (L1207-1569) er én ~360-linjers løkke, der bl.a.
bygger SFGG-perioden ved en **sekvens af range-operationer i en bestemt, betydningsbærende rækkefølge**:
første-udelukkede-dag (L1285) → cap-clip (L1288) → ansættelsesophør-clip (L1289) → sygeløns-subtraktion
(L1312) → ferie-subtraktion (L1318). Rækkefølgen bærer domæneregler (G3/G4/G5), men er implicit i
løkkens forløb, og de resulterende PDF-forklaringslinjer bygges inline (L1291-1295).

**Greenfield-design.** Udtræk en navngiven pipeline, der returnerer et autoritativt periode-objekt:

```ts
type SfggAfkortning = { årsag: 'foersteSygedag' | 'cap4mdr' | 'ansaettelsesophoer' | 'sygeloen'; dato: ISODateString };
interface SfggPeriode {
  visningsperiode: readonly IsoRange[];
  eligibleRanges: readonly IsoRange[];
  afkortninger: readonly SfggAfkortning[];   // deklareret årsag + dato — fodrer S2
}
```

Analog til reguleringens R4 (coverage-status som ét objekt): afkortnings-**årsagerne** beregnes ét sted
og *læses* af forklaringslaget, frem for at prosa-linjerne bygges midt i beregningsløkken. Rækkefølgen
(cap før ophør osv.) bliver ét auditerbart sted med eksplicit begrundelse.

| Kolonne | Vurdering |
|---|---|
| **Gevinst** | Middel-stor. Orkestratorens mest regeltunge del bliver eksplicit og testbar isoleret; fodrer S2. |
| **Arbejde** | Middel. Udtræk pipeline; motoren orkestrerer den. |
| **Risiko** | Lav-middel. Tal-neutralt; den nøjagtige rækkefølge af afkortninger skal bevares (byte-identitet). |

### S4 — Delt IsoRange-algebra

**Nuværende tilstand.** Motoren har sine **private** range-primitiver: `subtractIsoDateRanges` (L343),
`splitRangesAtBoundaryStarts` (L388), `buildRangesFromSortedDates` (L304),
`clipRangesToInclusiveUpperBound` (L329), `buildDateSetFromRanges` (L290), `buildSingleDateRange` (L327).
Range-**merging** bor derimod i [periodMerging.ts](../../src/domain/erstatningsopgoerelse/engines/periodMerging.ts)
(`mergeIsoDateRanges`). Range-algebraen er altså splittet: merge ét sted, subtraktion/split/clip et andet.

**Greenfield-design.** Saml al IsoRange-algebra (merge · subtract · split · clip · fra-sorterede-datoer)
i ét kanonisk modul, som SFGG (og fremtidige periodiserings-konsumenter) trækker fra. Analog til R7.

**Afgrænsning (Konvergens).** Primitiverne bruges i dag **kun** af SFGG, så dette er en *placerings-/
kohæsions-forbedring* (range-algebra i ét hjem), ikke fjernelse af aktiv duplikering. Lav prioritet;
tag det kun hvis S1-S3 alligevel rører filerne, så det ikke bliver churn for churns skyld.

| Kolonne | Vurdering |
|---|---|
| **Gevinst** | Lille-middel. Ét hjem for range-algebra. |
| **Arbejde** | Lille. |
| **Risiko** | Lav. Tal-neutralt flyt. |

### S5 — Overenskomstens SFGG-policy som deklarativ load-kontrakt

**Nuværende tilstand.** Der findes allerede en eksplicit SFGG-policy pr. overenskomst (fravigelse,
model, differentierede satser, bortfald under sygeløn, referenceperiode-label) + en runtime-assert for
fuld policy-dækning (dok. §5). G8 er dermed i vid udstrækning allerede opfyldt.

**Greenfield-design.** Bekræft, at assert'en er selvtestet (vacuous-pass-værn, som reguleringens R5),
og at den kanoniske liste over overenskomster tvinger hver til at deklarere sin SFGG-policy. Dette er
overvejende *fastholdelse*, ikke ny struktur.

| Kolonne | Vurdering |
|---|---|
| **Gevinst** | Lille (trust). Ingen overenskomst kan mangle SFGG-policy. |
| **Arbejde** | Lille. Meget findes. |
| **Risiko** | Lav. Rent load; kaster kun ved manglende policy. |

---

## 5. Læring fra regulering-implementeringen (anvendt her)

Erfaringerne fra R1-R9 er indarbejdet direkte i forslagene ovenfor:

1. **Byg ikke til hypotetisk genbrug.** Reguleringen fravalgte gentagne gange den "fulde vision", når
   der ikke var en konsument (R3's `RateSeries`-klasse, R5's type-strukturelle håndhævelse, R8's
   branded-typer). For SFGG betyder det: S4/S5 er bevidst lav-ambitiøse, og S1's register er **låst,
   ikke** et plugin-punkt. Feature-fladen er fastlagt (`AGENTS.md`).

2. **Fold fakta ind i kontrakten, så "form = gren" ikke genopstår.** Reguleringens største efter-fund
   var, at R2 havde *genindført* "form = gren" i orkestratoren; løsningen var at folde forløbet ind i
   form-kontrakten (`byggSegmenter` → `byggResultat`), så hver form bygger sit output ét sted. S1+S2 er
   skåret sådan fra start: kilde-modulet bærer både beregning og præsentations-meta, og motoren
   emitterer strukturerede forklaringer (S2) frem for prosa der skal parses tilbage.

3. **Bevar inspektionslaget som ægte krydstjek (B9).** SFGG har den *rigtige* grænse allerede
   (G13): inspektionen summerer og forsoner, den beregner ikke. Et redesign må **ikke** gøre
   inspektionen til en ren spejling af motoren, hvis det fjerner krydstjekket — kun *parsing*/formattering
   må deles, aldrig selve forsoningen.

4. **Tal- og UI-neutralt, byte-identisk, skridt for skridt.** Hvert skridt bevises byte-identisk med de
   eksisterende beregnings-, validator-, PDF/Word-render- og canonical-parity-tests, før det næste
   påbegyndes. Alt der kan ændre et produceret tal forelægges (jf. `AGENTS.md`) — ingen af S1-S5 bør
   ændre tal; hvis et skridt viser sig at ville det, stoppes der og forelægges.

5. **Skel domænesandhed fra drift.** Reguleringens afsnit 2 (guardrails) var afgørende for ikke at
   "rydde op" i bevidste afvigelser. SFGG's tilsvarende liste er afsnit 2 ovenfor (G1-G13) — særligt
   G1 (12,5 %), G2 (kalenderdage-betingelsen), G4 (sygeløn tæller til cap men ikke til krav) og G7
   (feriepenge på tværs af alle arbejdsgivere) ser ud som inkonsistens, men er domæneregler.

---

## 6. Migrations-anbefaling

Ikke big-bang. Rækkefølge der maksimerer tidlig trust-gevinst og holder hvert skridt tal-neutralt:

1. **S2 (delvist) — dræb tekst-round-trippen først.** Erstat cap-fakta-parsingen med læsning af den
   eksisterende `capReachedDate`, og læs `entry.sfggDayBasis`/feriepenge-total frem for at genberegne.
   Lav risiko, høj trust-gevinst, rører kun kontrol-laget. Kan gøres før S1.
2. **S1 — kilde-register.** Den strukturelle kerne; saml grenene og rut validator + row-lag gennem
   registeret. Fjerner den parallelle kilde-dispatch.
3. **S3 — periode-pipeline** oven på S1, og **fuldfør S2** ved at emittere strukturerede
   `sfggAfkortninger` fra pipelinen, som både PDF og kontrol formatterer.
4. **S4 / S5** — oprydning til sidst; tag S4 kun hvis de foregående skridt alligevel rører range-koden.

Hvert skridt pinnes af beregnings-, validator-, kontrol-, PDF/Word- og canonical-parity-suiten
(bl.a. `sygeferiegodtgoerelse.test.ts`, `eoRowSygeferiegodtgoerelseRows.test.ts`,
`erstatningsopgoerelseValidator.test.ts`, `eoBilagSections`/PDF-render-tests) før det næste påbegyndes.

---

## 7. Sammenfatning

Diagnosen holder: SFGG bæres flere steder af tests og konventioner, hvor struktur burde bære det. Men
**inddæmningen er større end reguleringens** — der er én motor, ingen tredje inspektions-timeline, et
allerede rigt segment, og et PDF-lag der overvejende formatterer. Rod-årsagen er koncentreret i (1) den
udsmurte kilde-dispatch (motor + validator + row-lag) og (2) læse-sidens re-derivation, hvor
tekst-round-trippen for 4-måneders-cap'et er den mest skrøbelige.

De to højeste-værdi-forslag — **S1** (kilde som selvindeholdt modul) og **S2** (autoritativt resultat,
læse-siden formatterer kun) — angriber roden direkte og gør "vist = beregnet" til en invariant ved
konstruktion, uden at ændre et eneste produceret tal. **S3** løfter periode-logikken op i en eksplicit,
auditerbar pipeline. **S4/S5** er lav-ambitiøs oprydning, bevidst holdt proportional efter erfaringen
fra reguleringen om ikke at bygge til hypotetisk brug.

Alle forslag respekterer domænesandhederne i afsnit 2 — de er regler, ikke drift, og et redesign der
forener dem væk ville genindføre fejl.
