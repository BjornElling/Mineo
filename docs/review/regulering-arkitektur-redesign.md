# Regulering — arkitektonisk redesign set fra bunden

**Dato:** 2026-07-04
**Status:** Analyse / oplæg (ingen kodeændringer foretaget)
**Baggrund:** Syntese efter det fulde regulering-review (`regulering-review-plan.md`, punkt 0–15, alle ✅).
**Formål:** Vurdere hvilke arkitektoniske og strukturelle valg jeg ville træffe anderledes,
hvis reguleringsdomænet skulle designes helt fra bunden med den viden reviewet har givet os —
uden at være bundet af den nuværende kode. Breaking ændringer er tilladt og overvejet.

> Dette er et **beslutningsoplæg**, ikke en implementeringsplan. Hvert forslag angiver
> potentiel gevinst, arbejde ved at ændre fra nuværende, og risiko ved at ændre.
> Ingen af forslagene er igangsat. Forslag der kan ændre producerede tal er eksplicit markeret
> og kræver forelæggelse jf. `AGENTS.md`.

---

## 1. Hovedkonklusion først

Reviewet rettede stort set alt **tal-neutralt**: næsten hver rettelse var en load-guard der kun
kaster ved korrupt data, eller en konsolidering bevist byte-identisk. Det fortæller os noget vigtigt
om domænets tilstand: **friktionen er latent, ikke aktiv.** Der er få egentlige bugs tilbage — men
en betydelig mængde *drift-risiko*, *duplikering* og *spredt ejerskab*, som reviewet måtte beskytte
med tests i stedet for at eliminere ved konstruktion.

Den centrale diagnose er ét struktur-problem, der forgrener sig til alt andet:

> **Strategi-dispatch × lag = duplikering i anden potens.**
> De 7 reguleringsformer dispatches uafhængigt i **mindst 4–5 lag** (motor, validator, row-evaluering,
> præsentation, inspektion), og hvert lag har sin **egen kopi** af base-opslag, interval-udledning og
> segment-byggeri. At tilføje eller ændre én form kræver koordinerede ændringer på tværs af ~4.500
> linjer i tre store filer ([loenudviklingBeregning.ts](../../src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts) 1676,
> [reguleringsPresentation.ts](../../src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts) 1848,
> [eoInspektionRegulationCore.ts](../../src/domain/eoInspektion/eoInspektionRegulationCore.ts) 1023).

Alt det reviewet kaldte "align-by-test" (S1-alignment, coverage-gate spredt over tre lag, tre kopier
af aktiv-række-prædikatet, fem `+N mdr`-kopier, to formel-funktioner, tre `resolveOffentligLoenSelection`)
er symptomer på **den samme rod**: der findes ikke ét sted hvor en reguleringsform *er* defineret.
Formen er i stedet smurt ud som parallelle grene i hvert lag.

**Min anbefaling er ikke en big-bang-omskrivning.** Reviewet beviste, at inkrementel, tal-neutral
hærdning virker (og B9 forkastede eksplicit en fuld omskrivning). De højeste-værdi-forslag herunder
kan indføres ét ad gangen, hver bevist byte-identisk. Men målbilledet — det jeg *ville* have bygget fra
bunden — er værd at have eksplicit, så hver inkrementel ændring trækker mod samme struktur.

---

## 2. Hvad der SKAL overleve et redesign (guardrails)

Før forslagene: reviewet identificerede en række afvigelser, der ser ud som inkonsistens, men er
**bevidste domænekrav**. Et greenfield-design må gøre dem til førsteklasses, beskyttede varianter —
ikke abstrahere dem væk. Ethvert forslag herunder er formuleret så disse overlever:

| Bevidst afvigelse | Hvorfor den er korrekt | Kilde |
|---|---|---|
| **ASL slår eksakt op pr. år, carry-forwarder aldrig** | Hvert år kræver sit eget indeks; intet dæknings-vindue | punkt 4, S6 |
| **KL-lønaftaler: trinvis kæde med afrunding pr. trin** | Bevidst parallel til Erstatningsnævnets (unøjagtige) satser; ingen akkumuleret visning | `docs/domain/taf/kl-loenaftaler-regulering.md` |
| **To opreguleringsmotorer med forskellige dæknings-krav** | ASL-ratio kræver kun 2 endepunktsår; akkumuleret kræver hvert mellemår | punkt 11 |
| **`computeFormulaValue` coercer ikke-finit→0; `computePackageValuePct` propagerer NaN→throw** | Den ene er tolerant visning, den anden fail-closed beregning | U5, punkt 15 |
| **`resolveOffentligLoenSelection`: motor kaster, inspektion returnerer null** | Beregning skal fail-close; visning skal degradere pænt | U3, punkt 14 |
| **Escape-hatch sænker kun severity (rød→gul), ændrer aldrig tal** | Beregningsmotoren modtager ikke app-settings | punkt 13 |
| **Manuelt angivet fail-closer ikke på manglende reguleringsdato** | Basisrækken repræsenterer niveauet | punkt 1/7 |
| **Per-ansættelsesforhold uniformitet håndhæves kun i angivet-løn-grenen** | Per-arbejdsgiver-regulering med hver sin overenskomst er meningsfuld | U2, punkt 13 |
| **Zero-delta før basis/dækning; "Ingen" = nul-*regulering*, ikke nul-*beløb*** | "Ingen regulering før reguleringsdatoen" er ægte domæneregel | punkt 2 |
| **Supplement-konsistens: row-laget strengere end motor/validator** | Produktbeslutning 2026-07-04: tomt tillæg må ikke stille falde til base | punkt 13, G13-1 |

Disse er ikke tekniske detaljer — de er domænesandheder. Et redesign der "rydder op" i dem ville
genindføre bugs.

---

## 3. Redesign-forslag — oversigt

Rangeret efter forholdet gevinst/risiko. Detaljer i afsnit 4.

| # | Forslag | Potentiel gevinst | Arbejde ved ændring | Risiko ved ændring |
|---|---|---|---|---|
| **R1** | **Reguleringsform som selvindeholdt strategi-modul** (plugin-registry; dispatch ét sted) | **Stor** — ny/ændret form rører ét modul i stedet for 5 lag; fjerner rod-årsagen til al parallel-dispatch | **Stor** — definér `ReguleringForm`-kontrakt; flyt 7 formers grene ud af motor+validator+præsentation+inspektion | **Middel** — rører alle lag, men kan gøres tal-neutralt (flyt, ikke omregn); byte-identitet testbar |
| **R2** | **Ét autoritativt segment-resultat; præsentation/inspektion formatterer kun** (ingen re-derivation) | **Stor** — eliminerer ~2.900 linjers parallel genberegning; dræber "vist tal ≠ tal-der-driver-beløb"-klassen (U8/U9) ved konstruktion | **Stor** — segment skal bære alle visnings-felter; omskriv præsentation til ren formattering | **Middel** — præsentations-tal er allerede test-pinnet; KL/ASL-særvisninger skal bevares nøje |
| **R3** | **Ét tidsserie-opslag med deklareret carry-forward-politik** (`TimeSeries<T>`) | **Stor** — erstatter 5 parallelle lookups + 2 afvigere; interiort-hul-bevis ét sted; ASL's "ingen carry-forward" bliver en politik | **Middel-stor** — abstraktion + refactor af data-lags opslag | **Middel** — kræver byte-identitet pr. kilde; sygedagpenge (lukkede intervaller) + lovbestemte (år-bounds) er afvigende modeller |
| **R4** | **Coverage-status som ét autoritativt objekt** som motor, gate, validator og note alle *læser* | **Stor (trust)** — "før første/efter sidste sats" beregnes ét sted; drift bliver strukturelt umulig frem for test-fanget (S1) | **Middel** — udbyg `resolveKildeReguleringsIntervalIso` til fuld `CoverageStatus`; refactor row-lag/validator | **Lav-middel** — tal-neutralt; alignment er allerede bevist, dette gør den strukturel |
| **R5** | **Datakomplethed som deklarativ, ensartet load-kontrakt** (hver kilde deklarerer sine invarianter) | **Middel-stor (trust)** — ingen kilde kan "mangle" et værn; ensartet load-guard + obligatorisk selvtest | **Middel** — generalisér de 7 ad-hoc `assert…Integritet` til én ramme | **Lav** — rent boundary/load; kaster kun ved korrupt data; ingen tal-ændring |
| **R6** | **Adskil Familie A/B med eksplicit krydsnings-adapter; split overenskomst i to former** | **Middel** — fjerner den længste gren (~370 linjer, offentlig+privat i én funktion); gør ASL-krydsningen eksplicit | **Middel** — del `buildLoenudviklingFromOverenskomst`; wrap ASL-motorkald i adapter | **Lav-middel** — tal-neutralt flyt |
| **R7** | **Delte primitiver: prædikat-/formel-/interval-bibliotek** (færdiggør påbegyndt konsolidering) | **Middel** — fjerner sidste drift-flader | **Lille-middel** — meget er allerede gjort (`manuelReguleringRowPredicates`, `getInclusivePeriodEndByMonths`, `computePackageValuePct`-adapter) | **Lav** |
| **R8** | **Afrunding som typet politik på ét arkitektonisk punkt** (unit-typed money + decimal-politik) | **Middel** — de 5 afrundingsmekanismer bliver eksplicitte politikker; forhindrer dobbelt-afrunding/konventionsbrud | **Middel** — `MoneyOre` findes; formalisér decimal-politik pr. visning | **Middel** — rører afrundingssti → kan ændre tal ved fejl; kræver omhyggelig byte-identitet |
| **R9** | **Fail-open display-opslag typ-adskilt fra beregningslaget** | **Lille-middel (trust)** — `getSatserForYear` (fail-open) kan i dag i princippet kaldes fra beregning | **Lille** | **Lav** |

---

## 4. Forslagene i detaljer

### R1 — Reguleringsform som selvindeholdt strategi-modul

**Nuværende tilstand.** Enum'en `loenudviklingBeregningsgrundlag` (7 værdier) dispatches uafhængigt i
mindst fire lag: motor ([loenudviklingBeregning.ts:396](../../src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts#L396) + `:1391`),
validator ([erstatningsopgoerelseValidator.ts:812](../../src/validators/erstatningsopgoerelseValidator.ts#L812)),
præsentation ([reguleringsPresentation.ts:501](../../src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts#L501)),
row-evaluering ([eoRowIndkomstRows.ts:187](../../src/domain/eoRowEvaluation/eoRowIndkomstRows.ts#L187)) —
plus inspektionslaget har sin egen sti. En form "er" ikke ét sted; den er en gren i hver switch.

**Greenfield-design.** Definér én kontrakt og et register:

```ts
interface ReguleringForm<TKonsolideret> {
  readonly id: LoenudviklingGrundlag;               // enum-værdi
  konsolider(input): TKonsolideret | FormValidationError;   // trin 1 (i dag resolveReguleringsstrategi-gren)
  byggSegmenter(k: TKonsolideret, ctx): ReguleringSegment[]; // trin 2 (i dag buildLoenudviklingFrom*)
  coverageInterval(k): CoverageStatus;              // fodrer R4 (én kilde til grænserne)
  aktivRaekkePraedikat?(række): boolean;            // fodrer R7 (delt af gate+validator+motor)
  praesentation: FormPresentationMeta;              // fodrer R2 (kolonner, faktor-tekst, decimaler)
}
const FORM_REGISTRY: Record<LoenudviklingGrundlag, ReguleringForm<unknown>>;
```

Dispatch sker **ét sted** (`FORM_REGISTRY[grundlag]`); validator, row-lag og præsentation kalder samme
registers metoder i stedet for at gentage switch'en. KL-lønaftaler forbliver et modul med sin egen
`byggSegmenter` (trinvis kæde) og `praesentation` (ingen akkumuleret kolonne) — særlogikken er *indkapslet*
i modulet frem for spredt over ~13 filer.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Stor. Fjerner rod-årsagen til hele "align-by-test"-familien. Ny form = ét modul der implementerer kontrakten; det er umuligt at glemme et lag, fordi kontrakten kræver alle metoder. Monster-filen falder fra 1676 til en tynd orkestrator + 7 fokuserede moduler. |
| **Arbejde** | Stor. Kontrakt-design + flyt af 7 formers logik ud af 4 store filer. Realistisk et fler-ugers arbejde delt i ét modul ad gangen. |
| **Risiko** | Middel. Rører alle lag, men hvert træk er et *flyt* (samme matematik, ny placering), bevist byte-identisk med eksisterende beregnings- og render-tests. Højeste risiko er præsentations-særvisninger (KL/ASL) — mitigeres af R2's autoritative segment. |

### R2 — Ét autoritativt segment-resultat; præsentation formatterer kun

**Nuværende tilstand.** [reguleringsPresentation.ts](../../src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts) (1848 linjer)
**re-deriverer** visningstabellerne direkte fra kildedata — den importerer `getEffektiveSatserForDato`,
`getOffentligLoenForDato`, `resolvePrivateOverenskomstBaseContext` osv. og har sin egen kopi af
base-/interval-opslaget. [eoInspektionRegulationCore.ts](../../src/domain/eoInspektion/eoInspektionRegulationCore.ts) (1023 linjer)
gør det en **tredje** gang med sin egen indeks-timeline. U8 (KL genberegner reguleret løn fra `deltaPct`
i stedet for at læse `reguleretLoenOre`) og U9 (akkumuleret-kolonne fra rå pct) er direkte symptomer:
det viste tal er en *anden kilde* end tallet der driver beløbet.

**Greenfield-design.** Motoren producerer et fuldt beriget `ReguleringSegment`, der bærer *alt* hvad
visningen skal bruge: `deltaPct` (autoritativt afrundet), `reguleretLoenOre` (KL), `indexEntries`
(brudpunkter + indeks), `formulaText`/`formulaComponents`, og `displayMeta`. Præsentation og PDF/Word
**læser og formatterer kun** — de genberegner intet. Inspektionslaget bliver en ren visning af det
samme snapshot (som B9 allerede bevægede det mod: kontrol-laget må aldrig blive domænesandhed).

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Stor. Fjerner ~2.900 linjers parallel logik og gør "vist tal = beregnet tal" til en invariant *ved konstruktion* (U8/U9-klassen kan ikke opstå). Reducerer trust-overfladen dramatisk: der er ét sted regulering beregnes. |
| **Arbejde** | Stor. `ReguleringSegment`-typen udvides; motoren skal beregne visnings-felter den i dag lader præsentationen udlede; præsentation omskrives til ren formattering. Inspektionslaget genovervejes (måske helt afledt af snapshot). |
| **Risiko** | Middel. Alle præsentations-tal er allerede pinnet af PDF/Word-render-tests, så afvigelser fanges. Den reelle risiko er de bevidste særvisninger (KL: `Fra-dato \| Regulering` uden akkumuleret; ASL; forligsfaktor) — de skal bæres eksplicit på segmentets `displayMeta`, ikke tabes. |

### R3 — Ét tidsserie-opslag med deklareret carry-forward-politik

> **Status (2026-07-07): IMPLEMENTERET (migrations-skridt 3).** Kortlægningen viste, at det
> genuint duplikerede var ét enkelt opslag: carry-forward "seneste post med `startIso <= dato`"
> over en `ISODateString`-serie. Det fandtes i **~7 kopier over tre lag** — motorens
> `findLatestByDateInSortedList`, `findManuelProcentsatsEntryForDate`, tre `.filter(<=iso).at(-1)`
> i præsentationen (statistik/KRL/KL) og to `.filter(<=iso).sort(desc)[0]` i inspektionen — hvor
> **fire af re-derivationerne manglede sorterings-invarianten** (`.at(-1)`/`sort()[0]` gav kun
> korrekt svar hvis listen tilfældigvis var sorteret). De er nu ét delt primitiv,
> `engines/reguleringSeriesLookup.ts` (`findLatestByDateInSortedList` + `assertSortedByStartIso`),
> som alle tre lag kalder; opslaget kaster nu synligt på usorteret serie i stedet for at drive et
> tavst forkert svar. Tal-neutralt (byte-identitet pinnet af beregnings-, præsentations-/render-
> og inspektions-suiten; nyt fokuseret primitiv-testsæt). **Bevidste afvigelser fra greenfield-
> visionen nedenfor:** (1) ingen `RateSeries<T>`-klasse blev indført — et frit primitiv fjerner
> den reelle duplikering uden et lag til hypotetisk R1/R4-genbrug (jf. `AGENTS.md` Konvergens).
> (2) Datalagets `DanishDateString`-opslag (`getSatserForDatoFromList` i overenskomst,
> `findNewestReguleringOnOrBefore` — binærsøgning over en to-lags løntrin-`Map` i offentlig løn)
> blev **ikke** foldet ind: anden nøgletype (dansk dato/heltal), modsat sorteringsorden (nyeste
> først), andet søgealgoritme, og deres eneste fælles bekymring — sorterings-invarianten — er
> allerede single-sourcet i `rateSeriesIntegrity.ts` (R5). At tvinge dem sammen ville kræve en
> parametriseret komparator/nøgle-udtrækning for to kaldsteder uden at fjerne reel duplikering.
> (3) De carry-forward-FRIE modeller (ASL/lovbestemte pr.-år-eksakt, sygedagpenge lukkede
> intervaller, afsnit 2) blev heller ikke medtaget — en policy-enum der spænder over dem ville
> netop sløre den carry-forward-vs.-må-ikke-carry-forward-sikkerhedsskelnen, guardrails'ene
> bygger på. (4) R3's afledte R1/R4-gevinst — at forene motorens base-anker og row-gaten til ét
> *entry*-returnerende opslag — leveres ikke her: motoren slår op i lokalt materialiserede
> periode-lister, mens gaten læser `resolveKildeReguleringsIntervalIso`; at samle dem kræver at
> periode-liste-konstruktionen flytter ind i opslaget, hvilket er R1/R2-territorie (form-moduler /
> autoritativt segment) — konsistent med R4-status-noten. Fuld suite grøn.

**Nuværende tilstand.** "Find seneste sats ≤ dato" er implementeret i ~5 parallelle funktioner:
`findLatestByDateInSortedList` ([loenudviklingBeregning.ts:321](../../src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts#L321)),
`getSatserForDatoFromList` (overenskomst privat), `getOffentligLoenForDato`→`findNewestReguleringOnOrBefore`
(offentlig), `findManuelProcentsatsEntryForDate` (manuel procentsats), og ASL's bevidst *modsatte*
eksakt-år-opslag. Samme egenskab (interiort hul umuligt) måtte bevises separat i punkt 3, 5, 6, 7, 8.
Carry-forward-semantikken er kilde-agnostisk uden at kilderne garanterer deres forudsætninger
(sortering, kontinuitet) — kilden til S6-staleness-risikoen.

**Greenfield-design.** Én typet abstraktion med eksplicit politik:

```ts
type CarryForwardPolicy = 'carry-forward' | 'exact-key';   // ASL = 'exact-key'
class RateSeries<T> {
  lookup(date): T | undefined;      // respekterer policy
  coverageInterval(): IsoRange;     // fodrer R4
  // load-invarianter deklareret her (R5)
}
```

De 4 ensartede `getReguleringsDatoIntervalFor…`-varianter (+N mdr − 1 dag) bliver konfiguration
(`coverageWindowMonths`), ikke kopieret aritmetik. De to afvigere — `lovbestemteRates` (rene år-bounds)
og `sygedagpengeRates` (eksplicitte lukkede intervaller) — modelleres som `RateSeries`-varianter med
egen politik. ASL's "ingen carry-forward" er `policy: 'exact-key'`, ikke et særtilfælde spredt rundt.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Stor. Erstatter 5 lookups + 2 afvigende modeller med én; "interiort hul umuligt"-beviset bor ét sted; carry-forward-politik bliver eksplicit og synlig frem for en udokumenteret data-antagelse. |
| **Arbejde** | Middel-stor. Abstraktionen er ligetil, men hver af de 7 datakilder skal migreres og bevises byte-identisk, og lookup'et bruges i flere lag (delvis afhjulpet af R1/R2). |
| **Risiko** | Middel. Kræver stringent byte-identitets-bevis pr. kilde (nyeste-først-orden, grænse-clamp). Sygedagpenge og lovbestemte er strukturelt anderledes og skal ikke tvinges ind hvis det gør dem kunstige. |

### R4 — Coverage-status som ét autoritativt objekt

> **Status (2026-07-07): DELVIST IMPLEMENTERET (migrations-skridt 2).** Kortlægningen viste, at
> selve interval-*matematikken* allerede er single-sourcet: alle lag bunder i de fem
> `getReguleringsDatoIntervalFor*`-funktioner, som deler `getInclusivePeriodEndByMonths`
> (`months` er den eneste per-kilde-variabel). Row-gaten og overenskomst-noten forbruger allerede
> den delte `resolveKildeReguleringsIntervalIso`. Den reelle rest var **validatoren**
> (`validateLoenudviklingDataCoverage`), der havde sin **egen kopi** af `grundlag → interval-fn`-
> dispatch'en; den er nu routet gennem `resolveKildeReguleringsIntervalIso`, så validatorens
> "efter sidste sats"-grænse deler præcis samme autoritative kilde som row-gaten (og de tre
> data-fn-imports + `danishToISO`-konverteringen er fjernet). Tal-neutralt og tekst-identisk
> (byte-identitet pinnet af de eksisterende statistik/KRL-coverage-tests; ny KL-coverage-test
> tilføjet, `31-03-2027`). **Bevidst afvigelse fra greenfield-visionen nedenfor:** den fulde
> `CoverageStatus` (`hullerISerie`/`effektivBaseDato`/`årsag`) blev IKKE indført — der er endnu
> ingen konsument (jf. `AGENTS.md` Konvergens: ingen felter til hypotetisk fremtidig brug). Og
> **R4's hovedgevinst — at gøre motor↔gate-alignet strukturel og pensionere
> `reguleringSilentPathAlignment.test.ts` — er reelt gated på R3:** motorens
> `resolveEffectiveBaseEntry`-fallback behøver selve sats-*entry'en* (indeks-/løn-værdien), ikke
> kun grænse-datoen, så den kan ikke "læse coverage-objektet", før opslagene er samlet (R3). Note-
> laget for statistik/KRL/KL (`periodStarts[0].startIso`) og inspektions-consumeren
> (`isReferenceBeforeIntervalStart`) er R2/R3-territorie. Tal-neutralt, fuld suite grøn.

**Nuværende tilstand.** "Før første sats"-grænsen beregnes **uafhængigt** i motoren
(`resolveEffectiveBaseEntry` fallback, [loenudviklingBeregning.ts:353](../../src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts#L353))
og i row-gaten (`reguleringsvaerdi`-error, [eoRowIndkomstRows.ts:472](../../src/domain/eoRowEvaluation/eoRowIndkomstRows.ts#L472)),
og de aligner *kun* fordi begge tilfældigvis udleder grænsen fra samme datatabel. Reviewet kaldte det
eksplicit "to uafhængige beregninger uden invariant-værn" (punkt 1, Fund 1) og fiksede det med en
test-binding (`reguleringSilentPathAlignment.test.ts`), ikke en strukturel forening. Samme koncept
(dæknings-vindue) er fordelt over data-lag + motor + row-lag + validator + note, uden ét hjem.
`resolveKildeReguleringsIntervalIso` ([reguleringKildeCoverage.ts:38](../../src/domain/erstatningsopgoerelse/helpers/reguleringKildeCoverage.ts#L38))
er den positive model — én autoritativ interval-kilde — men den dækker kun interval, ikke fuld status.

**Greenfield-design.** Én `CoverageStatus` pr. kilde/ansættelsesforhold, produceret ét sted og
*læst* af alle: `{ fraDato, tilDato, dækketInterval, hullerISerie, effektivBaseDato, årsag }`.
Motoren, row-gaten, validatoren og noten konsumerer samme objekt. "Før første sats"-alignment bliver
strukturel — der er kun ét tal — frem for to der test-bevises ens.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Stor (trust). Den vigtigste trust-forbedring: tavs under-regulering kan ikke opstå fra drift mellem motorens og gatens grænseforståelse, fordi der kun er én. Fjerner behovet for `reguleringSilentPathAlignment`-testens forsvar mod noget der bør være umuligt. |
| **Arbejde** | Middel. Udbyg den eksisterende `resolveKildeReguleringsIntervalIso` til fuld status; refactor de tre konsumerende lag til at læse den frem for at genudlede. Fungerer bedst oven på R1/R3. |
| **Risiko** | Lav-middel. Tal-neutralt — grænserne er allerede bevist alignet, så et byte-identisk resultat er forventeligt. Risikoen ligger i at ramme alle konsumenter (validator har flere grene). |

### R5 — Datakomplethed som deklarativ load-kontrakt

> **Status (2026-07-07): DELVIST IMPLEMENTERET (migrations-skridt 1).** Den delte mekaniske
> logik er konsolideret i `src/data/rateSeriesIntegrity.ts` med to primitiver:
> `assertStrictlyMonotonicByDanishDate` (afløser de tre kopier i KRL/KL/overenskomst) og
> `assertNoInteriorYearGap` (afløser de to kopier i statistik/ASL). De fem berørte guards
> komponerer nu primitiverne; `assertOffentligLoenTabelIkkeTom` (kun ikke-tom) og
> `assertSygedagpengeRatesIntegritet` (lukket-interval-kontinuitet, ét brugssted) er bevidst
> IKKE trukket ind — ingen duplikering at fjerne. Completeness + vacuous-pass-værn ligger i
> `rateSeriesIntegrity.test.ts` (kanonisk liste over alle 7 kilder + selvtest af primitiverne).
> **Bevidst afvigelse fra greenfield-visionen nedenfor:** den fulde `RateSeries`-baserede,
> type-strukturelle håndhævelse ("en ny kilde *kan ikke* tilføjes uden at deklarere sin
> dæknings-model") afventer R3 — den kræver `RateSeries<T>`-abstraktionen. Uden R3 håndhæves
> komplethed på test-niveau (den kanoniske liste), ikke af typesystemet. Et produktions-registry,
> der kun tjener testen, blev fravalgt (jf. `AGENTS.md` Konvergens). Tal-neutralt, fuld suite grøn.

**Nuværende tilstand.** Load-guards blev tilføjet **ad hoc pr. form**: `assertStatistikAarKontinuitet`,
`assertAarsloenAslMaxKontinuitet`, `assertKRLCombinedDataIntegritet`, `assertKlLoenaftalerDataIntegritet`,
`assertOverenskomstSatserNyesteFoerst`, `assertOffentligLoenTabelIkkeTom`, `assertSygedagpengeRatesIntegritet`.
Nogle kilder havde dem tidligt (statistik), andre manglede dem helt indtil punkt 12. Der var intet
*krav* om at hver satskilde skal have en load-guard — og flere invarianter (sortering, kontinuitet) var
kun test-håndhævet, så et fremtidigt datahul ville passere typecheck/lint og give tavs under-dækning.

**Greenfield-design.** Datakomplethed er en systematisk kontrakt, ikke noget hver kilde genopfinder.
Hver `RateSeries` (R3) deklarerer sine invarianter (`sorteret: 'nyeste-først'`, `ingenInteriortHul: true`,
`ikkeTom: true`, `finit: true`), og en fælles ramme håndhæver load-guard + **obligatorisk selvtest**
(vacuous-pass-værn, jf. guard-selvtest-princippet, punkt 12). En ny satskilde *kan ikke* tilføjes uden
at deklarere sin dæknings-model.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Middel-stor (trust). Ensartet, udtømmende håndhævelse: ingen kilde kan mangle et værn, og invarianter flyttes fra "test håber det holder" til "load kaster hvis det brydes". |
| **Arbejde** | Middel. Generalisér de 7 eksisterende guards til én ramme; det meste logik findes allerede og skal blot samles + deklareres. |
| **Risiko** | Lav. Rent boundary/load; guards kaster kun ved korrupt data. Ingen tal-ændring for valide data. |

### R6 — Adskil Familie A/B; split overenskomst i to former

**Nuværende tilstand.** De to reguleringsfamilier (per-segment `deltaPct` vs. år-til-år opregulering)
er koblet netop ét sted: ASL-statistik-grenen i Familie A kalder Familie B's motor inline
([loenudviklingBeregning.ts:661](../../src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts#L661)).
Og `buildLoenudviklingFromOverenskomst` (~370 linjer) rummer to fundamentalt forskellige former —
privat pakke-indeks og offentlig løntrin — i én funktion delt langs en gren.

**Greenfield-design.** Gør ASL-krydsningen til en eksplicit navngiven adapter (`aslIndeksTilSegmentDelta`)
frem for et inline motorkald, så familie-grænsen er synlig. Split overenskomst i to selvstændige former
(R1-moduler): `overenskomst-privat` og `overenskomst-offentlig`. De deler kun det de faktisk deler
(pakke-formel), ikke en funktionskrop.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Middel. Fjerner den længste og mest forgrenede funktion; gør den ene familie-krydsning eksplicit og dokumenteret. Rydder op i den mest læse-tunge del af motoren. |
| **Arbejde** | Middel. Mekanisk split; de to overenskomst-grene er allerede ret separate internt. |
| **Risiko** | Lav-middel. Tal-neutralt flyt. Skal bevare de to bevidst forskellige clamp-mekanismer (U4: offentlig base-fallback vs. privat `max(regdato, dækningsstart)`) — de må ikke forenes. |

### R7 — Delte primitiver (færdiggør påbegyndt konsolidering)

> **Status (2026-07-07): IMPLEMENTERET (migrations-skridt 1).** Kortlægning viste, at 4 af 5
> primitiver allerede var korrekt placeret (`manuelReguleringRowPredicates`,
> `getInclusivePeriodEndByMonths`, `resolveReguleringssatsForAar`, `parseOffentligLoenSelection`).
> Den eneste reelle rest var `computePackageValuePct`, som lå strandet som en umarkeret
> module-lokal `const` inde i den 1676-linjers `loenudviklingBeregning.ts`. Den er nu flyttet
> (eksporteret) til `reguleringFormulaUtils.ts`, så de to indgange til lønpakke-formlen bor
> sammen med `computeFormulaValue` og ikke igen kan drive fra hinanden. **Bevidst afvigelse:**
> et separat `regulering/primitives`-lag/barrel blev IKKE oprettet — det ville flytte
> velplacerede primitiver (ren dato-matematik, sats-koblet opslag) væk fra deres rette hjem uden
> at fjerne duplikering, dvs. et lag til hypotetisk genbrug (jf. `AGENTS.md` Konvergens).
> Tal-neutralt; ny test dækker den nu-eksporterede adapter.

**Nuværende tilstand.** Reviewet konsoliderede allerede meget: `manuelReguleringRowPredicates`
(de tre aktiv-række-kopier), `getInclusivePeriodEndByMonths` (de fem `+N mdr`-kopier),
`computePackageValuePct` som tynd adapter over `computeFormulaValue`, `resolveReguleringssatsForAar`
(det duplikerede rå satsopslag), `parseOffentligLoenSelection` (de tre selection-parsere).
Dette forslag er at *fastholde* princippet: prædikater, formler og interval-aritmetik er delte primitiver.

**Greenfield-design.** Et lille, eksplicit `regulering/primitives`-lag som alle former og lag trækker
fra. Kombineret med R1's kontrakt bliver det umuligt at genindføre en fjerde kopi, fordi der ikke er en
gren at kopiere den ind i.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Middel. Fjerner de sidste drift-flader; låser gevinsten fra reviewets konsolideringer fast. |
| **Arbejde** | Lille-middel. Det meste er gjort; resten er at samle primitiverne ét sted og pege alle callsites derhen. |
| **Risiko** | Lav. Overvejende allerede bevist byte-identisk. |

### R8 — Afrunding som typet politik på ét punkt

**Nuværende tilstand.** Mindst 5 afrundingsmekanismer, holdt korrekte ved **konvention**:
`deltaPct` til 2 dec. (lønudvikling + offentlige ydelser), `deltaPct` til 4 dec. (TAF-opreguleret),
KRL-display til 4 dec., `roundKroner` på basisløn/beløb, og KL's trinvise afrunding pr. trin.
Familie B-motorerne returnerer bevidst u-afrundet og lader kalderen afrunde — korrekt, men en konvention
arkitekturen ikke håndhæver, så den kan brydes (dobbelt-afrunding, forkert metode).

**Greenfield-design.** Afrunding sker på ét arkitektonisk defineret punkt via en typet politik.
`MoneyOre` findes allerede; udvid med en eksplicit `RoundingPolicy` pr. visnings-/beregnings-kontekst,
så u-afrundede mellemværdier er typemæssigt adskilt fra afrundede slutværdier. KL's trinvise afrunding
er en eksplicit politik, ikke en special-case.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Middel. Gør de 5 mekanismer til synlige politikker; forhindrer dobbelt-afrunding og konventionsbrud ved konstruktion. |
| **Arbejde** | Middel. Typer og helpers findes; arbejdet er at formalisere politik pr. kontekst og tråde den igennem. |
| **Risiko** | **Middel — kan ændre tal.** Dette er det eneste forslag der rører selve afrundingsstien. Enhver fejl ændrer producerede beløb → kræver forelæggelse og udtømmende byte-identitets-bevis. Bør tages sidst og forsigtigst. |

### R9 — Fail-open display-opslag typ-adskilt fra beregning

**Nuværende tilstand.** `getSatserForYear` ([lovbestemteRates.ts:898](../../src/data/lovbestemteRates.ts#L898))
er fail-open (returnerer `null`/`''` ved manglende år). Reviewet bekræftede at den *i dag* kun bruges i
display/dokument (S7, punkt 12), men adskillelsen er ikke strukturelt håndhævet — en fremtidig fejl kunne
kalde den fra en beregningssti og få tavs under-regulering.

**Greenfield-design.** Typ-adskil fail-open display-opslag fra fail-closed beregnings-opslag, så en
beregningssti *ikke kan* kalde en fail-open funktion (fx forskellige branded return-typer, eller
placering i et `display/`-modul beregningslaget ikke importerer).

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Lille-middel (trust). Lukker en latent sti fremfor en aktiv bug. |
| **Arbejde** | Lille. |
| **Risiko** | Lav. |

---

## 5. Hvad jeg IKKE ville ændre

Reviewet viste også, hvad der allerede er godt designet — det bør et redesign bevare og *udvide fra*,
ikke rive ned:

- **De to opreguleringsmotorer** ([opreguleringsmotorer.ts](../../src/domain/satser/opreguleringsmotorer.ts))
  er forbilledlige: ét sted, klar `{faktor, deltaPct, manglendeAar}`-kontrakt, u-afrundet output med
  afrunding hos kalderen, fail-closed via `manglendeAar`. Dette er præcis den model R1–R4 skal generalisere.
- **Det fælles fundament i motoren** (`resolveEffectiveBaseEntry`, `findLatestByDateInSortedList`,
  `buildSegmentsFromStartDates`, `buildZeroDeltaSegment`, `resolveAnvendtReguleringsdato`) fungerer og
  deles allerede på tværs af former. Problemerne opstod i *grenene* ovenpå og i *data-laget* nedenunder.
- **`throw → runtime_exception/fail_closed`-invarianten** ([loenudviklingBeregning.ts:63–70](../../src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts#L63))
  er den bærende trust-garanti og skal bevares uændret.
- **B9's lag-isolation** (kontrol-/inspektionslaget må aldrig gate produktions-PDF) er den rigtige grænse
  og pinnes af `inspektionLayerIsolation.test.ts`.
- **`resolveKildeReguleringsIntervalIso`** som eneste autoritative interval-kilde er mønstret R4 skal
  udbygge, ikke erstatte.

---

## 6. Migrations-anbefaling

Ikke big-bang. Rækkefølge der maksimerer tidlig værdi og holder hvert skridt tal-neutralt:

1. **R5** (load-kontrakt) og **R7** (færdiggør primitiver) først — lav risiko, ren gevinst, ingen tal-ændring. **✅ Udført 2026-07-07** (R7 fuldt; R5's delte primitiver + completeness-test, med fuld type-strukturel håndhævelse udskudt til R3 — se status-noterne i afsnit 4).
2. **R4** (coverage-status) — konverterer den vigtigste trust-alignment fra test til struktur. **◑ Delvist udført 2026-07-07** (validatorens dispatch routet gennem den delte resolver; den strukturelle motor↔gate-forening + fuld `CoverageStatus` afventer R3 — se status-noten i afsnit 4).
3. **R3** (tidsserie-opslag) — samler data-lagets opslag; forudsætning for R1's rene kontrakt. **✅ Udført 2026-07-07** (det duplikerede `ISODateString`-carry-forward-opslag samlet i ét delt primitiv på tværs af motor/præsentation/inspektion; datalagets `DanishDateString`-opslag og de carry-forward-frie modeller bevidst udenfor — se status-noten i afsnit 4).
4. **R1** (form-moduler) — den store strukturelle gevinst; nu med R3/R4 som fundament.
5. **R2** (autoritativt segment) og **R6** (familie-split) — oven på R1's kontrakt.
6. **R8** (afrunding) — sidst og forsigtigst, da det er det eneste der kan ændre tal; kræver forelæggelse.

Hvert skridt bevises byte-identisk med de eksisterende beregnings- og render-tests (557+ beregningstests,
`reguleringSilentPathAlignment.test.ts`, PDF/Word-render-tests) før det næste påbegyndes.

---

## 7. Sammenfatning

Domænet er **korrekt** efter reviewet — men holdt sammen af tests og konventioner, hvor et greenfield-design
ville holde det sammen af *struktur*. Den ene rod-årsag er, at en reguleringsform ikke er defineret ét sted;
den er en parallel gren i motor, validator, row-lag, præsentation og inspektion. Alt det reviewet kaldte
duplikering, drift-risiko og "align-by-test" følger af det.

De to højeste-værdi-forslag — **R1** (form som selvindeholdt modul) og **R2** (autoritativt segment,
præsentation formatterer kun) — angriber roden direkte og ville fjerne ~2.900 linjers parallel logik og
gøre "vist tal = beregnet tal" til en invariant ved konstruktion. **R4** (coverage-status) er den vigtigste
rene trust-gevinst. Ingen af dem behøver ændre et eneste produceret tal; kun **R8** (afrunding) rører
beregningen og bør tages sidst med forelæggelse.

Alle ni forslag respekterer de bevidste domæne-afvigelser i afsnit 2 — de er domænesandheder, ikke drift,
og et redesign der forener dem væk ville genindføre fejl.
