# Regulering — arkitektonisk redesign set fra bunden

**Dato:** 2026-07-04
**Status:** Analyse / migrationsnotat (R3/R5/R6/R7 + R1 implementeret; R4 delvist; R2 konsolideret — forløbet foldet ind i form-kontrakten (ét dispatch, ét builder-kald); 4 af 6 former bærer motor-forløb (manuel procentsats, KRL, statistik non-ASL, KL — KL nu fuldt inkl. indeksrækker); overenskomst-formel single-sourcet via delt builder frem for forløb; manuelt angivet forenet mod de kanoniske parsere; inspektionens parsing-primitiver ruter nu gennem de delte buildere; R9 implementeret (strukturelt værn); R8 proportionalt implementeret (mekanisme 1 som navngivet politik; fuld branded-type-vision bevidst fravalgt). Se "Efterbehandling 2026-07-08".)
**Baggrund:** Syntese efter det fulde regulering-review (`regulering-review-plan.md`, punkt 0–15, alle ✅).
**Formål:** Vurdere hvilke arkitektoniske og strukturelle valg jeg ville træffe anderledes,
hvis reguleringsdomænet skulle designes helt fra bunden med den viden reviewet har givet os —
uden at være bundet af den nuværende kode. Breaking ændringer er tilladt og overvejet.

> Dette er et **beslutningsoplæg og migrationsnotat**, ikke en fuld implementeringsplan. Hvert forslag angiver
> potentiel gevinst, arbejde ved at ændre fra nuværende, og risiko ved at ændre.
> De statusmarkerede deltrin i R1/R3/R5/R6/R7 er allerede udført tal-neutralt, R4 delvist og R2
> påbegyndt (fundament/pilot); R8/R9 er fortsat fremadrettede forslag. Forslag der kan ændre
> producerede tal er eksplicit markeret og kræver forelæggelse jf. `AGENTS.md`.

---

## 1. Hovedkonklusion først

Reviewet rettede stort set alt **tal-neutralt**: næsten hver rettelse var en load-guard der kun
kaster ved korrupt data, eller en konsolidering bevist byte-identisk. Det fortæller os noget vigtigt
om domænets tilstand: **friktionen er latent, ikke aktiv.** Der er få egentlige bugs tilbage — men
en betydelig mængde *drift-risiko*, *duplikering* og *spredt ejerskab*, som reviewet måtte beskytte
med tests i stedet for at eliminere ved konstruktion.

Den centrale diagnose er ét struktur-problem, der forgrener sig til alt andet:

> **Strategi-dispatch × lag = duplikering i anden potens.**
> De 7 værdier i reguleringsgrundlaget (6 aktive former + "Ingen") dispatches uafhængigt i
> **mindst 4–5 lag** (motor, validator, row-evaluering,
> præsentation, inspektion), og hvert lag har sin **egen kopi** af base-opslag, interval-udledning og
> segment-byggeri. At ændre én eksisterende form kræver koordinerede ændringer på tværs af ~4.500
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
| **To opreguleringsmotorer med samme dæknings-tjek, forskellig matematik** | ~~ASL-ratio kræver kun 2 endepunktsår~~ **Ensrettet 2026-07-07:** begge motorer tjekker nu HVERT år i intervallet for dækning; kun matematikken adskiller sig (endepunkts-ratio vs. akkumuleret kæde) | punkt 11; se afsnit 4b, E1 |
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
| **R1** | **Reguleringsform som selvindeholdt strategi-modul** (låst form-register; dispatch ét sted) | **Stor** — ændret eksisterende form rører ét modul i stedet for 5 lag; fjerner rod-årsagen til al parallel-dispatch | **Stor** — definér `ReguleringForm`-kontrakt; flyt de 6 aktive formers grene + "Ingen"-no-op ud af motor+validator+præsentation+inspektion | **Middel** — rører alle lag, men kan gøres tal-neutralt (flyt, ikke omregn); byte-identitet testbar |
| **R2** | **Ét autoritativt segment-resultat; præsentation/inspektion formatterer kun** (ingen re-derivation) | **Stor** — eliminerer ~2.900 linjers parallel genberegning; dræber "vist tal ≠ tal-der-driver-beløb"-klassen (U8/U9) ved konstruktion | **Stor** — segment skal bære alle visnings-felter; omskriv præsentation til ren formattering | **Middel** — præsentations-tal er allerede test-pinnet; KL/ASL-særvisninger skal bevares nøje |
| **R3** | **Ét tidsserie-opslag med deklareret carry-forward-politik** (`TimeSeries<T>`) | **Stor** — erstatter 5 parallelle lookups + 2 afvigere; interiort-hul-bevis ét sted; ASL's "ingen carry-forward" bliver en politik | **Middel-stor** — abstraktion + refactor af data-lags opslag | **Middel** — kræver byte-identitet pr. kilde; sygedagpenge (lukkede intervaller) + lovbestemte (år-bounds) er afvigende modeller |
| **R4** | **Coverage-status som ét autoritativt objekt** som motor, gate, validator og note alle *læser* | **Stor (trust)** — "før første/efter sidste sats" beregnes ét sted; drift bliver strukturelt umulig frem for test-fanget (S1) | **Middel** — udbyg `resolveKildeReguleringsIntervalIso` til fuld `CoverageStatus`; refactor row-lag/validator | **Lav-middel** — tal-neutralt; alignment er allerede bevist, dette gør den strukturel |
| **R5** | **Datakomplethed som deklarativ, ensartet load-kontrakt** (hver kilde deklarerer sine invarianter) | **Middel-stor (trust)** — ingen kilde kan "mangle" et værn; ensartet load-guard + obligatorisk selvtest | **Middel** — generalisér de 7 kilde-guards til én ramme | **Lav** — rent boundary/load; kaster kun ved korrupt data; ingen tal-ændring |
| **R6** | **Adskil Familie A/B med eksplicit krydsnings-adapter; split overenskomst i to former** | **Middel** — fjerner den længste gren (~370 linjer, offentlig+privat i én funktion); gør ASL-krydsningen eksplicit | **Middel** — del `buildLoenudviklingFromOverenskomst`; wrap ASL-motorkald i adapter | **Lav-middel** — tal-neutralt flyt |
| **R7** | **Delte primitiver: prædikat-/formel-/interval-bibliotek** (færdiggør påbegyndt konsolidering) | **Middel** — fjerner sidste drift-flader | **Lille-middel** — meget er allerede gjort (`manuelReguleringRowPredicates`, `getInclusivePeriodEndByMonths`, `computePackageValuePct`-adapter) | **Lav** |
| **R8** | **Afrunding som typet politik på ét arkitektonisk punkt** (unit-typed money + decimal-politik) | **Middel** — de 5 afrundingsmekanismer bliver eksplicitte politikker; forhindrer dobbelt-afrunding/konventionsbrud | **Middel** — `MoneyOre` findes; formalisér decimal-politik pr. visning | **Middel** — rører afrundingssti → kan ændre tal ved fejl; kræver omhyggelig byte-identitet |
| **R9** | **Fail-open display-opslag typ-adskilt fra beregningslaget** | **Lille-middel (trust)** — `getSatserForYear` (fail-open) kan i dag i princippet kaldes fra beregning | **Lille** | **Lav** |

---

## 4. Forslagene i detaljer

### R1 — Reguleringsform som selvindeholdt strategi-modul

> **Status (2026-07-07): IMPLEMENTERET (fundament / migrations-skridt 4).** `ReguleringForm`-
> kontrakten + `FORM_REGISTRY` (keyet på enum-værdien, exhaustivt `Record` — compile-fejl at
> glemme en form) er indført i `src/domain/erstatningsopgoerelse/engines/regulering/`. Hvert af de
> 7 grundlag (6 aktive + "Ingen") har nu ét modul (`forms/*Form.ts`), der **samler** de tre steder
> en form tidligere var defineret: `konsolider` (uniformitet + `KonsolideretLoenudvikling`-
> konstruktion, før spredt i `resolveReguleringsStrategi`), `byggSegmenter` (før de frie
> `buildLoenudviklingFrom*`) og `coverageInterval` (før `resolveKildeReguleringsIntervalIso`s egen
> switch). Motoren er nu en tynd orkestrator: den udregner de fælles, form-agnostiske værdier én
> gang og dispatcher til `FORM_REGISTRY[basis].konsolider(ctx)`; segment-byggeriet dispatches via
> `byggReguleringsSegmenter(konsolideret)`. `loenudviklingBeregning.ts` faldt fra 1676 til ~430
> linjer. `resolveKildeReguleringsIntervalIso` delegerer nu til `FORM_REGISTRY[grundlag].
> coverageInterval`, så **validator og row-gate forbruger registeret transitivt** — den reelle
> cross-lag-duplikering (de to divergerende per-form allow-lists + coverage-switchen) er dermed
> single-sourcet, ikke bare flyttet. Delte primitiver (`buildSegmentsFromStartDates`,
> `resolveEffectiveBaseEntry`, `assertUniform`, `resolveOffentligLoenSelection`,
> `buildZeroDeltaSegment`, `ensurePositiveFiniteNumber`, `toKildeReguleringsIntervalIso`) ligger i
> `reguleringFormPrimitives.ts`. Tal-neutralt (byte-identitet pinnet af beregnings-,
> validator-, inspektions- og PDF/Word-render-suiten; fuld suite grøn på nær én ikke-relateret
> MinProcesrente-render-timeout, der består isoleret). **Bevidste afgrænsninger fra greenfield-
> visionen nedenfor:** (1) `praesentation: FormPresentationMeta` og `aktivRaekkePraedikat?` blev
> IKKE lagt på kontrakten — de har endnu ingen konsument (jf. `AGENTS.md` Konvergens: ingen felter
> til hypotetisk brug); at fjerne præsentations-/inspektions-*re-derivationen* er **R2**, ikke R1.
> (2) `coverageInterval` returnerer det eksisterende `KildeReguleringsInterval`, ikke en fuld
> `CoverageStatus` — det er fortsat R4, gated på R3's entry-returnerende opslag. (3) Validatorens
> *felt-tilstedeværelses*-dispatch og row-gatens *ledsagefelt*-dispatch (de per-form `if`-kæder,
> ikke coverage) er endnu ikke routet gennem registeret; det er en opfølgende skive. Registeret
> ejer i dag konsolider/byggSegmenter/coverageInterval. (4) "Ingen"-formens konsolider/byggSegmenter
> er defensive: orkestratoren kortslutter alle-ingen og bygger zero-delta direkte fra tafRanges.

**Nuværende tilstand.** Enum'en `loenudviklingBeregningsgrundlag` (7 værdier: 6 aktive former + "Ingen")
dispatches uafhængigt i mindst fire lag: motor ([loenudviklingBeregning.ts:396](../../src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts#L396) + `:1391`),
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
const FORM_REGISTRY: Readonly<Record<LoenudviklingGrundlag, ReguleringForm<unknown>>>;
```

Dispatch sker **ét sted** (`FORM_REGISTRY[grundlag]`); validator, row-lag og præsentation kalder samme
registers metoder i stedet for at gentage switch'en. KL-lønaftaler forbliver et modul med sin egen
`byggSegmenter` (trinvis kæde) og `praesentation` (ingen akkumuleret kolonne) — særlogikken er *indkapslet*
i modulet frem for spredt over ~13 filer.

**Vigtig afgrænsning.** Registeret er **ikke** et plugin- eller udvidelsespunkt til nye beregningstyper.
Feature-fladen er låst; formålet er at samle de eksisterende former i ét statisk, exhaustivt register,
så R1 reducerer drift og switch-duplikering uden at optimere for hypotetiske fremtidige former.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Stor. Fjerner rod-årsagen til hele "align-by-test"-familien. En ændring i en eksisterende form sker i dens modul; det er umuligt at glemme et lag, fordi kontrakten kræver alle metoder. Monster-filen falder fra 1676 til en tynd orkestrator + 6 aktive formmoduler + ét no-op-modul for "Ingen". |
| **Arbejde** | Stor. Kontrakt-design + flyt af de 6 aktive formers logik (og "Ingen"-no-op) ud af 4 store filer. Realistisk et fler-ugers arbejde delt i ét modul ad gangen. |
| **Risiko** | Middel. Rører alle lag, men hvert træk er et *flyt* (samme matematik, ny placering), bevist byte-identisk med eksisterende beregnings- og render-tests. Højeste risiko er præsentations-særvisninger (KL/ASL) — mitigeres af R2's autoritative segment. |

### R2 — Ét autoritativt segment-resultat; præsentation formatterer kun

> **Status (2026-07-07): fire former migreret (migrations-skridt 6–9); to bevidst udskudt.**
> **Skridt 8 ('Statistik', non-ASL):** migreret end-to-end. Motorens `statistikForm.byggSegmenter`
> og præsentationens TRE re-derivationer (kilde-satstabel, base-indeks, periode-indeks) bygger nu
> alle den delte `buildStatistikIndexEntries` (`engines/statistikRegulering.ts`) — kvartal→ISO-
> parsing + stigende sortering ét sted; motoren emitterer `{kind:'statistik', entries}` og
> præsentationen læser det. **ASL-statistik-grenen** er bevidst ved fravær (`forloeb: undefined`):
> den bruger et per-år-opslag (`resolveAslAarsloensmaksimumForAar`), ikke en kvartals-periodeserie,
> så der er ingen re-deriveret serie at single-source (jf. `AGENTS.md` Konvergens).
> **Skridt 9 ('KL-lønaftaler'):** migreret via den delte `buildKlLoenaftalerIndexEntries`
> (`engines/klLoenaftalerRegulering.ts`) — periode-satsserien parse+sort, som motorens
> `byggSegmenter` (brudpunkter) og reguleringsværdi-tabellen (vist reguleringssats) før byggede
> uafhængigt af `klLoenaftalerRaekker`. Motoren emitterer `{kind:'klLoenaftaler', entries}`, og
> reguleringsværdi-tabellen viser nu satsen fra forløbets entry (byte-identisk med det tidligere
> `getKlLoenaftalerReguleringPctForDato`-opslag, fordi hver relevant dato er præcis en periode-
> startdato). "Beregnet regulering"-tabellen læser fortsat segmentets autoritative
> `reguleretLoenOre` (U8) og er uændret. Begge skridt tal- og UI-neutrale (pinnet af beregnings-,
> præsentations-, reguleringSection-render-, inspektions- og canonical-parity-suiten + nye
> fallback-paritetstests med/uden forløb og motor-emissionstests; fuld regulering/inspektion/PDF-
> suite grøn: 1701 tests).
> **Bevidst udskudt — 'Manuelt angivet':** value-tabellen læser de RÅ manuelle rækker
> (`loenudviklingManuelTableData`) direkte — ingen re-deriveret serie, ingen drift. Index-rækkerne
> re-deriverer lønpakke-komponenterne via display-parsere (`parsePercentInput`, `parseAmount`,
> `resolveFeriePctForFormula`), der er ANDRE funktioner end motorens
> (`parseManualPercentToPct`, `amountValueToNumber`, `resolveManualFeriePctPct`). Et forløb ville
> enten kun bære de rå rækker (ingen gevinst) eller kræve forening af de to parser-sæt — ikke
> byte-identitets-trivielt og beregnings-berørende. Udskudt; parser-divergensen noteret som
> selvstændigt oprydnings-fund.
> **Bevidst udskudt — 'Overenskomst' (offentlig+privat), fortsat den største/mest følsomme:**
> privat-grenen deler allerede `buildPrivateOverenskomstFormulaComponents` +
> `resolvePrivateOverenskomstBaseContext` mellem motor og præsentation (R6/R7 lukkede driften ved
> konstruktion). Offentlig-grenen bygger komponenterne inline i BEGGE lag, men fra identiske delte
> data-opslag (`getOffentligLoenForDato`/`getOffentligTillaegsSatserForDato`/
> `resolvePctPointFromSatsOrInput`) — samme resultat, parallel kode, ikke aktiv drift. Et
> autoritativt forløb ville bære per-segment `FormulaComponents` + base, men kræver at
> præsentationen mapper sine videre-splittede segmenter (anciennitet/Store Bededag) til motorens
> forløbs-entries og fortsat selv udleder `visibility` + formel-tekst; det er en stor, skrøbelig
> byte-identitets-flade i den mest brugte, trust-kritiske form (mange fallback-grene). Anbefales
> som ét dedikeret skridt med parity-test + fuld render-suite som værn — ikke bundtet med
> entries-swap-formerne.
>
> **Ophævet og rettet igen (2026-07-08): anciennitetstillæg er ikke i basis.** Den midlertidige
> 2026-07-07-regel byggede på en forkert UI-bound: anciennitetsdatoen var afgrænset af stamdatadatoen
> i stedet for anvendt reguleringsdato. Den korrekte regel er nu, at dato for anciennitetstillæg skal
> ligge **efter anvendt reguleringsdato**. Dermed kan tillægget aldrig være en del af referenceniveauet
> (indeks 100), og basis-gaten/rå-dato-gaten er fjernet fra motor, præsentation og kontrol. Tillægget
> fungerer kun som et segment-brudpunkt efter anvendt regulering.
>
> **Status (2026-07-07): PÅBEGYNDT — fundament/pilot + anden form migreret (migrations-skridt 6+7).**
> **Skridt 7-tilføjelse:** **'KRL satstabel'** er nu migreret end-to-end efter samme opskrift.
> Det autoritative KRL-forløb er kildens periodeserie `{startIso, reguleringsPct}` — præcis det
> motorens `krlForm.byggSegmenter` afleder `deltaPct` fra — samlet i den delte `buildKrlIndexEntries`
> (`engines/krlRegulering.ts`), som BÅDE motoren (der emitterer `{kind:'krl', entries}`) OG
> præsentationens tre KRL-steder (kilde-satstabel, base-indeks, periode-indeks) forbruger; motorens
> sidste inline-kopi af periodeserien er dermed fjernet, og byte-identitet er garanteret ved
> konstruktion. `ReguleringForloeb`-unionen er samtidig flyttet fra det manuel-procentsats-specifikke
> modul til et neutralt `engines/reguleringForloeb.ts`, da den nu spænder flere former. Tal- og
> UI-neutralt (pinnet af de eksisterende KRL-præsentations-/coverage-tests + ny fallback-paritetstest
> og motor-emissionstest). Inspektionslaget re-deriverer fortsat via `buildKrlIndexEntries` (samme
> byte-identiske builder), da det ikke har motor-modellen — jf. samme afgrænsning som piloten.
>
> **Status (2026-07-07): PÅBEGYNDT — fundament/pilot (migrations-skridt 6).** Kortlægningen
> bekræftede at den rige visnings-data (indeks, brudpunkter, satser, formel-komponenter) beregnes
> TRE gange uafhængigt: i motorens `byggSegmenter` (kasseres — kun `{fra,til,deltaPct}` + KL's
> `reguleretLoenOre` overlever), i `reguleringsPresentation.ts` (EO-PDF/bilag, re-derivation fra rå
> `eoValues`), og i `eoInspektionRegulationCore.ts` (en tredje, uafhængig timeline). **Bærende
> designbeslutning:** det autoritative visnings-artefakt udspringer af MOTORENS model
> (`LoenudviklingModel.forloeb` + `perAnsaettelse[].forloeb`, ny valgfri `ReguleringForloeb`) og
> bæres via motor-kanalen (`tafNetto` → PDF-presentation-model → `reguleringSection`) til
> formatterne — det lægges bevidst IKKE i den auditerede `.strict()` canonical-output-schema, som
> forbliver minimal beløb-kerne (B8/B9-grænse; canonical parity + strict-schema pinner at forløbet
> ikke lækker ind). Dette skridt migrerer ÉN form — **'Manuel procentsats'** — end-to-end: motoren
> emitterer `{kind:'manuelProcentsats', entries}` (byte-identisk med den delte
> `buildManuelProcentsatsEntries`), og præsentationens `buildReguleringsvaerdierTableData` (Del 1C) +
> `buildReguleringIndexRows` (Del 2E) LÆSER forløbet når det er til stede, ellers re-deriverer de
> byte-identisk (valgfri parameter). Manuel procentsats blev valgt som pilot, fordi alle tre lag
> allerede kalder samme builder — byte-identitet er garanteret ved konstruktion, så den risikable
> plumbing bygges mod en sikker form. Tal- og UI-neutralt (pinnet af beregnings-, præsentations-,
> reguleringSection-render-, inspektions- og canonical-parity-suiten + ny fallback-paritetstest
> `buildReguleringsvaerdierTableData`/`buildReguleringIndexRows` med/uden forløb, og ny motor-test af
> `model.forloeb`). **Bevidste afgrænsninger fra greenfield-visionen nedenfor / opfølgende skiver:**
> (1) De øvrige 5 former (overenskomst offentlig/privat, statistik/ASL, KL, manuelt angivet)
> re-deriverer fortsat uændret og repræsenteres ved fravær (`forloeb: undefined`); de migreres
> skridtvis, med overenskomst (den reelle U8/U9-drift-flade) som det højeste-værdi men mest byte-
> identitets-følsomme skridt. (2) Inspektionslaget forbruger IKKE endnu motor-forløbet — det har
> ikke motor-modellen i `buildRegulationTimeline`/`buildRegulationInspektionSections` og kalder
> fortsat `buildManuelProcentsatsEntries` direkte (byte-identisk); at føre motor-forløbet gennem
> snapshot-bro-filerne til inspektionen er en senere skive. (3) `manuelProcentsatsForm.byggSegmenter`
> kalder fortsat builderen for segmenterne, så motoren kalder den 2× (segmenter + forløb) med
> identisk output — foldning (fx `ReguleringForm.byggSegmenter` returnerer entries) rører interfacet
> for alle 7 former og er bevidst udskudt. Fuld suite grøn på nær kendte, urelaterede 5000ms
> render-/hook-timeouts under fuld-suite-belastning (grønne isoleret, ikke-deterministiske).

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
> `assertStrictlyMonotonicByDanishDate` (afløser kopier i KRL/KL/overenskomst/offentlig løn) og
> `assertNoInteriorYearGap` (afløser de to kopier i statistik/ASL). De fem berørte guards
> komponerer nu primitiverne; offentlig løn har én samlet `assertOffentligLoenDataIntegritet`
> (ikke-tom + strengt nyeste-først/unik effectiveDate), mens
> `assertSygedagpengeRatesIntegritet` (lukket-interval-kontinuitet, ét brugssted) bevidst
> IKKE er trukket ind — ingen duplikering at fjerne. Completeness + vacuous-pass-værn ligger i
> `rateSeriesIntegrity.test.ts` (kanonisk liste over alle 7 kilder + selvtest af primitiverne).
> **Bevidst afvigelse fra greenfield-visionen nedenfor:** den fulde `RateSeries`-baserede,
> type-strukturelle håndhævelse ("en kilde *kan ikke* stå uden deklareret
> dæknings-model") afventer R3 — den kræver `RateSeries<T>`-abstraktionen. Uden R3 håndhæves
> komplethed på test-niveau (den kanoniske liste), ikke af typesystemet. Et produktions-registry,
> der kun tjener testen, blev fravalgt (jf. `AGENTS.md` Konvergens). Tal-neutralt, fuld suite grøn.

**Nuværende tilstand.** Load-guards blev tilføjet **ad hoc pr. kilde**: `assertStatistikAarKontinuitet`,
`assertAarsloenAslMaxKontinuitet`, `assertKRLCombinedDataIntegritet`, `assertKlLoenaftalerDataIntegritet`,
`assertOverenskomstSatserNyesteFoerst`, `assertOffentligLoenDataIntegritet`, `assertSygedagpengeRatesIntegritet`.
Nogle kilder havde dem tidligt (statistik), andre manglede dem helt indtil punkt 12. Der var intet
*krav* om at hver satskilde skal have en load-guard — og flere invarianter (sortering, kontinuitet) var
kun test-håndhævet, så et fremtidigt datahul ville passere typecheck/lint og give tavs under-dækning.

**Greenfield-design.** Datakomplethed er en systematisk kontrakt, ikke noget hver kilde genopfinder.
Hver `RateSeries` (R3) deklarerer sine invarianter (`sorteret: 'nyeste-først'`, `ingenInteriortHul: true`,
`ikkeTom: true`, `finit: true`), og en fælles ramme håndhæver load-guard + **obligatorisk selvtest**
(vacuous-pass-værn, jf. guard-selvtest-princippet, punkt 12). Hver satskilde skal have en deklareret
dæknings-model.

| Kolonne | Vurdering |
|---|---|
| **Potentiel gevinst** | Middel-stor (trust). Ensartet, udtømmende håndhævelse: ingen kilde kan mangle et værn, og invarianter flyttes fra "test håber det holder" til "load kaster hvis det brydes". |
| **Arbejde** | Middel. Generalisér de 7 kilde-guards til én ramme; det meste logik findes allerede og skal blot samles + deklareres. |
| **Risiko** | Lav. Rent boundary/load; guards kaster kun ved korrupt data. Ingen tal-ændring for valide data. |

### R6 — Adskil Familie A/B; split overenskomst i to former

> **Status (2026-07-07): IMPLEMENTERET (migrations-skridt 5).** Begge dele af R6 er udført,
> tal- og UI-neutralt. (1) **Overenskomst-split:** den 368-linjers `byggSegmenter` — der rummede
> privat pakke-indeks og offentlig løntrin i én funktionskrop delt langs `konsolideret.offentlig` —
> er delt i to selvindeholdte segment-byggere: `forms/overenskomstOffentligSegmenter.ts` og
> `forms/overenskomstPrivatSegmenter.ts`. Det de *faktisk* deler ligger nu i
> `forms/overenskomstSegmentContext.ts` (fælles preamble: reference-opslag + anciennitetstillæg) —
> plus pakke-formlen (`reguleringFormulaUtils`/`overenskomstReguleringShared`) og primitiverne, der
> allerede var delte. `overenskomstForm.ts` er nu en facade (fra 537 → 159 linjer): `konsolider` og
> `coverageInterval` forbliver dér, fordi de er *ægte* delte (samme uniformitetskontrakt, samme
> dæknings-interval), og `byggSegmenter` dispatcher til hver sin bygger. De to bevidst forskellige
> U4-clamps (offentlig base-fallback vs. privat `max(regdato, dækningsstart)`) bor nu hver i sin
> bygger med bevaret "foren dem ikke"-kommentar. (2) **ASL-adapter:** det inline Familie-B-motorkald
> i `statistikForm.byggSegmenter` er wrappet i en navngivet adapter `aslIndeksTilSegmentDelta`, så
> Familie A→B-krydsningen er ét synligt, fail-closed sømpunkt frem for et inline kald. **Bevidst
> afgrænsning fra greenfield-visionen nedenfor:** splittet er på *modul*-niveau bag den ene
> `'Overenskomst'`-enumværdi — IKKE to enum-værdier. To enum-værdier ville ændre brugerens dropdown
> og bryde `.eo`-load (feature-flade + save/load), hvilket kræver forelæggelse; modul-splittet er
> tal- og UI-neutralt og fjerner den længste funktion uden at røre feature-fladen. Byte-identitet
> pinnet af beregnings-, præsentations-, inspektions-, PDF/Word- og canonical-parity-suiten (fuld
> suite grøn på nær den kendte urelaterede `generateBuildInfo`-subproces-timeout).

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

> **Status (2026-07-08): PROPORTIONALT IMPLEMENTERET — fuld branded-type-vision bevidst fravalgt.**
> Udtømmende kortlægning af hele afrundingsfladen (regulering + TAF + offentlige ydelser + svie/
> smerte + sygeferiegodtgørelse) bekræftede, at afrundings-KERNEN allerede er solid: én central
> `roundByMethod` (deterministisk, fail-closed → 0 på ikke-finit, aldrig −0, udtømmende test-pinnet),
> og `toOre`/`ensureMoneyOre`-runtime-guards på kroner→øre-grænsen (kaster ved >2 decimaler / ikke-
> heltal). Der blev fundet **ingen aktive afrundingsbugs** — hver "flade" er latent og konventions-
> holdt, og de grænser der betyder noget (kroner→øre) er allerede runtime-værnet. **Fravalgt (over-
> engineering):** den fulde greenfield-vision (branded `MoneyOre`/`RawKroner`/`RoundedKroner` +
> `RoundingPolicy`-type tråd gennem ~60 pengefelter) er en stor, invasiv NY numerisk strategi, som
> `AGENTS.md` (Numerik: "Indfør ikke nye numeriske strategier"; Konvergens: ingen lag til hypotetisk
> brug) fraråder; den retter sig mod hypotetisk fremtidig misbrug og bærer reel "kan ændre tal"-risiko
> på den mest trust-kritiske sti — dårligt værdi/risiko-forhold når kernen allerede er værnet og
> test-pinnet. **Implementeret (tal-neutralt):** mekanisme 1 (regulerings-`deltaPct` = 2 decimaler,
> halfAwayFromZero) er gjort til en NAVNGIVEN, single-sourced politik `roundReguleringDeltaPct`
> (`reguleringFormulaUtils.ts`), som alle reguleringsformer (statistik inkl. ASL-krydsningen, KRL,
> manuel, manuel procentsats, overenskomst offentlig/privat), motorens re-runding OG offentlige
> ydelser nu bruger — så decimalantallet ikke kan drive til en forkert konvention ved en fremtidig
> ændring. De bevidst afvigende kontekster bevarer deres egen politik: KL-lønaftaler (trinvis kæde,
> fuld præcision), TAF-opreguleret (4 decimaler). Pinnet af den fulde beregnings-/render-suite +
> ny politik-test (`reguleringFormulaUtils.test.ts`).
>
> **Genbekræftet 2026-07-08 (uafhængig kortlægning):** den fulde branded-type-vision forbliver
> over-engineering — afrundings-kernen er central (`roundByMethod`), den ene korrektheds-grænse
> (kroner→øre) er runtime-værnet (`toOre`/`ensureMoneyOre`), der er nul aktive bugs, og branding
> ville røre ~80 filer/hundredvis af felter på den mest trust-kritiske sti med reel tal-ændrings-
> risiko. Eneste resterende un-navngivne decimal-politik (KRL-visningens `4`) er nu en navngivet
> konstant (`KRL_REGULERING_PCT_DECIMALS`, `reguleringsPresentation.ts`), på linje med
> `roundReguleringDeltaPct` og `TAF_OPREGULERET_DELTA_PCT_DECIMALS`.

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

> **Status (2026-07-08): IMPLEMENTERET (strukturelt værn).** Adskillelsen er gjort strukturel via en
> arkitektur-boundary-test (`src/__tests__/quality/failOpenDisplayLookupIsolation.test.ts`) efter samme
> mønster som B9's `inspektionLayerIsolation.test.ts`: kun de tre display-/dokument-moduler
> (`components/pages/Satser.tsx`, `document/generators/satser/satserDocument.ts`,
> `document/service/documentService.ts`) må importere det fail-open `getSatserForYear`. Importeres
> symbolet fra en fil uden for allowlisten (fx en beregningssti), fejler værnet — med anti-rot- og
> selvtest-værn mod vacuous pass. `getSatserForYear`s JSDoc er samtidig markeret DISPLAY-ONLY/FAIL-OPEN
> med henvisning til værnet. **Bevidst afgrænsning:** branded return-typer / flytning af de ~30 data-
> dicts til et display-modul blev fravalgt — boundary-testen giver den samme strukturelle garanti med
> langt lavere churn og matcher repoets etablerede lag-isolations-idiom (jf. `AGENTS.md` Konvergens).
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

## 4b. Ensretninger — afvigende fremgangsmåder foldet ind under den fælles norm

> Hvor migrations-skridtene (R3/R4/R5/R7) samlede *duplikeret* logik, handler dette afsnit om
> afvigelser der ikke var duplikering, men **en anden fremgangsmåde til samme mål**. De er ensrettet
> til den fælles norm for at fjerne særskilt logik — bevidst, tal-neutralt, og dokumenteret her så en
> senere refactor ikke "optimerer" dem tilbage. Skelnen fra afsnit 2: en afvigelse hører kun til her,
> hvis unifikationen er tal-neutral for ethvert *produceret* tal; ægte domænesandheder (afsnit 2) bliver.

### E1 — ASL-ratioens dæknings-tjek ensrettet med den akkumulerede motor (2026-07-07)

**Før.** `opregulerMedAslAarsloensmaksimum` tjekkede KUN de to endepunktsår for dækning (matematisk
korrekt, fordi ratioen `idx[målår]/idx[kildeår]` kun afhænger af endepunkterne), mens den akkumulerede
motor tjekker hvert mellemliggende år. ASL-statistik-grenen i motoren fodrede endda et injiceret
to-års-map ind for at understøtte endepunkts-kun-stien.

**Efter.** ASL-ratioen tjekker nu HVERT år i `[min(kildeår,målår); max(...)]` for dækning — præcis
samme fremgangsmåde som den akkumulerede motor. Selve ratio-matematikken er uændret (bruger fortsat
kun endepunkterne). Motorens ASL-gren kalder nu den fælles motor med den fulde `aarsloenAslMax`-tabel
frem for et to-års-map, og den redundante per-segment-opslags-gren er fjernet.

**Hvorfor tal-neutralt.** `aarsloenAslMax` har en interiort-hul-load-guard
(`assertAarsloenAslMaxKontinuitet`), så et interiort år aldrig kan mangle mellem to gyldige endepunkter.
Derfor er det interval-brede tjek identisk med endepunkts-tjekket for al data, der passerer load. Eneste
observerbare forskel: for et endepunkt *uden for* tabellen kan `manglendeAar` (og den fail-closede
fejltekst) nu liste de mellemliggende år op til grænsen — en fail-closed-detalje, ikke et produceret tal.

**Begrundelse.** Bruger-beslutning 2026-07-07: processuel forenkling frem for matematisk nødvendighed —
de to motorer deler nu én dæknings-fremgangsmåde, og der findes ingen særskilt endepunkts-kun-gren at
vedligeholde. Guardrail-række "To opreguleringsmotorer …" i afsnit 2 er opdateret tilsvarende.
Berørt: `opreguleringsmotorer.ts`, `loenudviklingBeregning.ts` (ASL-grenen), doc i `lovbestemteRates.ts`.
**Må ikke rulles tilbage til endepunkts-kun-opslag.**

### E2 — Offentlig-løn-tabellens sorterings-/unikheds-tjek ensrettet med det fælles primitiv (2026-07-07)

**Før.** `buildReguleringLookups` (offentlig løn, KL/RLTN) håndhævede "strengt nyeste-først + unikke
datoer" med sin **egen inline-løkke** over `effectiveDateNum` + et separat `Set`-unikheds-tjek — en
fjerde kopi af invariant-tjekket, som R5's `assertStrictlyMonotonicByDanishDate` allerede dækker for
KRL/KL/overenskomst. R5-status-noten (afsnit 4, R5) regnede kun `assertOffentligLoenTabelIkkeTom`
(ikke-tom) som offentlig-løns integritets-tjek og overså denne inline-kopi.

**Efter.** Inline-løkken er erstattet af `assertStrictlyMonotonicByDanishDate(..., order: 'descending')`
og pakket sammen med ikke-tom-værnet i `assertOffentligLoenDataIntegritet`. Tal-neutralt:
`danishDateToNumber` bruger samme `parseDanishDate`, så ordningen er identisk, og strengt monotont
faldende afviser duplikerede datoer præcis som det tidligere `Set`-tjek. Den kanoniske R5-liste peger
nu på den samlede guard, så completeness-testen dækker offentlig løns faktiske integritet i stedet for
kun ikke-tomhed. Berørt: `offentligLoenLookup.ts`.

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

## 5b. Efterbehandling 2026-07-08 — læse-sidens konvergens

To parallelle reviews (kode + arkitektur) af R1/R2/R6 identificerede, at motor-siden levede op til
greenfield-visionen, men **læse-siden** (præsentation + inspektion) fortsat rummede parallel logik.
Følgende blev konsolideret, alt **tal- og UI-neutralt** (byte-identitet pinnet af beregnings-,
præsentations-, inspektions-, PDF/Word-, canonical-parity- og validator-suiten — 1869+ tests grønne):

1. **Forløbet foldet ind i form-kontrakten (R1×R2).** `ReguleringForm.byggSegmenter` → `byggResultat`,
   der returnerer `{ segmenter, forloeb? }`. Motorens parallelle `switch(strategi)`-IIFE (der byggede
   forløbet separat) og det deraf følgende **dobbeltkald** af index-builderne er fjernet: hver form
   bygger nu sine kilde-entries ÉN gang og bærer dem både som segment-basis og som autoritativt
   forløb. Dette lukkede arkitektur-reviewets vigtigste fund (R2 havde genindført "form = gren" i
   orkestratoren).
2. **Offentlig overenskomst — delt formel-samling.** `buildOffentligOverenskomstFormulaComponents`
   (`overenskomstReguleringShared.ts`, spejl af den private) deles nu af motoren
   (`overenskomstOffentligSegmenter`) og præsentationens reguleringsindeks-tabel — de tre parallelle
   `FormulaComponents`-samlinger er reduceret til én. **Bevidst afgrænsning:** kun selve samlingen
   deles; base-/sats-UDVÆLGELSEN forbliver pr. lag (motorens U4-clamp + interval-fallback vs.
   præsentationens effective-base + deltaPct-fallback — to bevidst forskellige mekanismer, jf. U4).
   Et motor-emitteret overenskomst-**forløb** (R2's oprindelige idé) blev bevidst **ikke** forfulgt:
   den delte builder lukker allerede formel-driften, og et forløb ville kræve, at motoren bar
   per-segment-komponenter i præsentationens finere (anciennitet/Store Bededag-splittede) granularitet
   — en stor, skrøbelig byte-identitets-flade uden gevinst oven på den delte builder.
3. **KL-lønaftaler fuldt migreret.** Indeksrækkernes "Lønudvikling"-kolonne læser nu periodesatsen fra
   forløbets entries (eksakt-key på `startIso`) frem for det separate `getKlLoenaftalerReguleringPct-
   ForDato`-map-opslag; værdi-tabellen læste allerede forløbet. Beløbet (`reguleretLoenOre`, U8)
   uændret autoritativt.
4. **Manuelt angivet — forenet mod de kanoniske parsere.** De motor-lokale `parseManualPercentToPct`
   og `resolveManualFeriePctPct` er erstattet af de kanoniske `parsePercentInput` /
   `resolveFeriePctForFormula` (`reguleringFormulaUtils.ts`), som præsentationens manuelle indeks-tabel
   også bruger — så motor og visning ikke kan drive fra hinanden. De tidligere divergerende grene
   (streng tom efter `%`-strip; ikke-finit tal) er **beviseligt schema-uopnåelige**: `feriepenge`/
   satsfelterne er `percentageDecimal` (= finit tal ∈ [0,100] eller `undefined`), og begge parser-sæt
   giver identisk resultat for netop de input. Forenet ved delt primitiv frem for forløb, da formen
   ikke bærer en periodeserie.
5. **Inspektionens parsing-primitiver ruter gennem de delte buildere.** Statistik (kvartal→ISO), KRL
   og KL byggede før hver sin periodeserie inline (statistik med egen regex; KRL/KL med manuel
   `.filter(<=).sort(desc)[0]` **uden** R3-sorterings-invarianten). De læser nu de delte
   `buildStatistikIndexEntries`/`buildKrlIndexEntries`/`buildKlLoenaftalerIndexEntries` +
   `findLatestByDateInSortedList`. **Bevidst grænse (B9):** kun *parsingen* deles — index-
   *beregningen* (base-udvælgelse, ratio) forbliver uafhængig, så kontrol-laget stadig er et ægte
   krydstjek af motoren og ikke en tautologi. Parsing er ikke stedet et motorbug gemmer sig; en
   divergens dér ville kun være et falsk `control:sammentaelling_mismatch`.

Efterfølgende blev også de to sidste fremadrettede forslag behandlet (se status-noterne under R8 og
R9 i afsnit 4): **R9** implementeret som strukturelt boundary-værn; **R8** proportionalt implementeret
(regulerings-`deltaPct`-politikken som navngivet, single-sourced helper `roundReguleringDeltaPct`),
mens den fulde branded-type-vision bevidst blev fravalgt som over-engineering, da afrundings-kernen
allerede er runtime-værnet og test-pinnet.

**Opdateret 2026-07-08 — anciennitetstillæg som rent segment-brudpunkt.** Den delte resolver
`resolveAnciennitetForIndex` (`overenskomstReguleringShared.ts`) bærer fortsat kroneværdien og
aktiveringsdatoen på tværs af motor, præsentation og kontrol, men der findes ikke længere en
basis-gate. Validator og UI kræver nu dato **efter anvendt reguleringsdato**, og indeks 100 bygges
altid uden anciennitetstillæg. Kontrol-laget medtager kun tillægget i per-dato-entries fra
aktiveringsdatoen; index-*beregningen* forbliver uafhængig (B9).

## 6. Migrations-anbefaling

Ikke big-bang. Rækkefølge der maksimerer tidlig værdi og holder hvert skridt tal-neutralt:

1. **R5** (load-kontrakt) og **R7** (færdiggør primitiver) først — lav risiko, ren gevinst, ingen tal-ændring. **✅ Udført 2026-07-07** (R7 fuldt; R5's delte primitiver + completeness-test, med fuld type-strukturel håndhævelse udskudt til R3 — se status-noterne i afsnit 4).
2. **R4** (coverage-status) — konverterer den vigtigste trust-alignment fra test til struktur. **◑ Delvist udført 2026-07-07** (validatorens dispatch routet gennem den delte resolver; den strukturelle motor↔gate-forening + fuld `CoverageStatus` afventer R3 — se status-noten i afsnit 4).
3. **R3** (tidsserie-opslag) — samler data-lagets opslag; forudsætning for R1's rene kontrakt. **✅ Udført 2026-07-07** (det duplikerede `ISODateString`-carry-forward-opslag samlet i ét delt primitiv på tværs af motor/præsentation/inspektion; datalagets `DanishDateString`-opslag og de carry-forward-frie modeller bevidst udenfor — se status-noten i afsnit 4).
4. **R1** (form-moduler) — den store strukturelle gevinst; nu med R3/R4 som fundament. **✅ Fundament udført 2026-07-07** (kontrakt + `FORM_REGISTRY`; motorens dispatch + coverage routet gennem registeret, tal-neutralt; validatorens/row-gatens felt-dispatch + R2's præsentations-re-derivation er opfølgende skiver — se status-noten i afsnit 4).
5. **R6** (familie-split) og **R2** (autoritativt segment) — oven på R1's kontrakt. **R6 ✅ udført 2026-07-07** (overenskomst delt i offentlig/privat segment-byggere bag facaden; ASL-krydsningen wrappet i den navngivne `aslIndeksTilSegmentDelta`-adapter; tal- og UI-neutralt, modul-split uden enum-ændring — se status-noten i afsnit 4). **R2 (autoritativt segment) ◑ påbegyndt 2026-07-07** (fundament/pilot: motor-emitteret `ReguleringForloeb` via motor-kanalen, IKKE i den auditerede canonical-kerne; **fire former migreret end-to-end i PDF-præsentationen, byte-identisk:** 'Manuel procentsats' (skridt 6), 'KRL satstabel' (skridt 7), 'Statistik' non-ASL (skridt 8), 'KL-lønaftaler' (skridt 9). 'Manuelt angivet' + ASL bevidst udskudt (ingen motor-emitteret periodeserie / parser-divergens); inspektions-konsolidering er en opfølgende skive — se status-noten i afsnit 4). Det højeste-værdi/mest følsomme skridt (**overenskomst**) er fortsat fremadrettet og anbefales som ét dedikeret skridt.
6. **R8** (afrunding) — sidst og forsigtigst, da det er det eneste der kan ændre tal. **◑ Proportionalt udført 2026-07-08** (mekanisme 1 som navngivet single-sourced politik `roundReguleringDeltaPct`, tal-neutralt; fuld branded-type-vision bevidst fravalgt som over-engineering — se status-noten i afsnit 4). **R9 ✅ udført 2026-07-08** (strukturelt boundary-værn for det fail-open `getSatserForYear`).

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
