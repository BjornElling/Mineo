# Tabt arbejdsfortjeneste (TAF)

Denne fil beskriver beregningslogikken for tabt arbejdsfortjeneste i erstatningsopgørelsen.

---

## Del 1 — For dig

### Hvad beregner dette modul?

Tabt arbejdsfortjeneste (TAF) er kompensation for den indtægtsnedgang skadelidte har lidt i den periode vedkommende var helt eller delvist uarbejdsdygtig som følge af skaden. Resultatet er et nettokrav i kroner: den tabte lønindkomst minus de offentlige ydelser og eventuel tidligere modtaget TAF skadelidte allerede har fået.

### Beregningsenheden

Inden alt andet fastlægges det, om TAF skal beregnes i **måneder** eller **arbejdsdage**. Valget bestemmer ikke blot kolonneoverskriften i tabellen — det styrer alle efterfølgende beregninger: periodisering af løn, fradrag af ferie og SH-dage, og opgørelse af TAF-perioden.

**Prioriteret beslutningstræ:**

1. Hvis `beregnesUdFra = "Angivet månedsløn"` → **Måneder**
2. Hvis `beregnesUdFra = "Angivet dagsløn"` → **Arbejdsdage**
3. Hvis `beregnesUdFra = "Beregningsperiode"` → kig på lønindkomst-ansættelsesforhold:
   - Hvis mindst ét ansættelsesforhold har **løn** i en række der overlapper beregningsperioden, **og** ansættelsesforholdet ikke opfylder begge betingelser (`løn på helligdage = "Almindelig løn"` **og** `fuld løn under ferie = "Ja"`): → **Arbejdsdage**
   - Ellers: → **Måneder**

**Domæneprincip:** Beregningsgrundlaget (referenceperioden) og TAF-kravet følger altid samme enhed.

### Måneder vs. arbejdsdage — hvad det betyder

| Aspekt | Måneder | Arbejdsdage |
|---|---|---|
| Opgørelsesmetode | Kalenderdage, inkl. ferie og SH-dage | Hverdage (man-fre) ekskl. daterede feriedage og SH-dage |
| Løse feriedage | Fratrækkes **ikke** | Placeres på de første ledige hverdage og fratrækkes |
| Øvrigt fravær uden løn | Reducerer **kun** beregningsgrundlaget (4,8 % af måned pr. dag) | Reducerer **kun** beregningsgrundlaget |
| TAF-kravet selv | Påvirkes ikke af fravær (brugeren afgrænser perioderne manuelt) | Påvirkes ikke af "øvrigt fravær" (brugeren afgrænser perioderne manuelt) |

Faktor: 1 arbejdsdag = 0,048 måneder (4,8 %).

### Periodeafgrænsning

TAF-perioderne, som brugeren angiver, clampes automatisk til gældende grænser:

- **Stille clamping** (ingen fejlindikation): perioden klemmes til EO's vedørende periode (`vedroererPeriodeFra`–`vedroererPeriodeTil`).
- **Fejlgivende clamping** (rød kant + tooltip): perioden må ikke nå op til eller forbi `differencekravDato − 1 dag`, endelig EET-virkningsdato − 1 dag, eller (ved skadedato < 16. juni 2011) midlertidig EET-virkningsdato − 1 dag. Differencekrav-grænsen gælder altid. EET-grænserne (endelig og midlertidig) ophæves hvis der er verserende klage over EET-afgørelsen.

For skader opstået **før 16. juni 2011** (`TAF_MIDLERTIDIG_EET_SKAERINGSDATO` i `periodiseringsMotor.ts`) afgrænser en upåklaget midlertidig EET-afgørelse retten til tabt arbejdsfortjeneste på præcis samme måde som en endelig afgørelse. Betingelserne er identiske: `midlertidigtEetAfgorelse = 'Ja'`, dato angivet, og `verserendeKlageEet ≠ 'Ja'`. Beregnet dato: `midlertidigEETVirkningsdato ?? midlertidigEETAfgoerelseDato`. Logikken er indkapslet i `resolveMidlertidigEetDatoHvisAktiv` i `tafPeriodConstraints.ts`.

Overlappende TAF-perioder merges til sammenhængende intervaller inden beregning for at undgå dobbeltoptælling. Mergede grupper bærer det første kilderækkes ID som repræsentativt ID.

### Måneds-optælling

For hvert kalenderår inden for perioden:
```
måneder_i_måned = antal_dage_i_perioden_den_måned / dage_i_måneden
måneder_i_alt = Σ måneder_i_måned
```
Øvrigt fravær fratrækkes herefter: `fravær_i_måneder = antal_fraværsdage × 0,048`.

Resultatet afrundes til 2 decimaler (halvAwayFromZero) til visning.

### Arbejdsdage-optælling

```
hverdage = alle man-fre i perioden
SH-dage = helligdage der falder på hverdage (beregnes algoritmisk)
feriedage = daterede ferieperioder skåret til periodens hverdage
løse_feriedage = placeres på de første ledige hverdage (ikke allerede SH eller ferie)
TAF-dage = hverdage − SH-dage − feriedage − løse_feriedage
```

SH-dage beregnes algoritmisk (påskerelaterede helligdage + faste datoer) via `beregnHelligdage`.

### Netto-TAF-beregningen

```
tabt_arbejdsfortjeneste = max(0, lønudvikling_total − taf_indtægter_total − tidligere_modtaget_taf)
```

Alle beløb intern i beregningen håndteres i **øre** (integer) for at undgå floating-point-fejl. Slutresultatet vises i kroner.

Komponenterne:
- **Lønudvikling** (`buildLoenudviklingModel`): beregner hvad skadelidte ville have tjent i TAF-perioden baseret på indkomsten på skadestidspunktet, fremskrevet med lønudviklingsindeks.
- **TAF-indtægter** (`buildIncomeForRanges`): summerer offentlige ydelser (sygedagpenge, dagpenge, kontanthjælp m.fl.) og eventuel lønindkomst i TAF-perioden.
- **Tidligere modtaget TAF**: trækkes fra som allerede afholdt.

Offentlige ydelser periodiseres forskelligt:
- De fleste ydelser: hverdage (ekskl. SH-dage). Undtagelse: sygedagpenge **før 2012-07-02** periodiseres på hverdage uden SH-fradrag.
- Visse ydelser (fx kontanthjælp, ressourceforløbsydelse): kalenderdage.

### TAF fordelt på kalenderår

Til PDF-bilag beregnes TAF fordelt pr. kalenderår. Segmenter splittes ved kalenderårsskift, fradrag prorateres via overlap med TAF-ranges, og individuelle årsbeløb afrundes. Summen af årsbeløb må maksimalt afvige 1 kr. (100 øre) fra det samlede TAF-krav — overskrides dette, returneres fejl (`afrunding_over_100`) og fordeling vises ikke.

### PDF-visning af afgrænsningskilde

I PDF-afsnittet om tabt arbejdsfortjeneste vises **kun den tidligste afgrænsningskilde** (midlertidig EET, endelig EET eller differencekrav). Prioritet: kilder der faktisk bringer TAF til ophør (TAF-periode slutter dagen før kildens dato) over informative kilder; dernæst kronologisk på referencedato. De øvrige undertykkes.

Ophørstekst for midlertidig EET (skadedato < 16. juni 2011): *"Da skaden er sket før 16. juni 2011, bringer afgørelsen retten til tabt arbejdsfortjeneste til ophør."*

### TAF-status per dag

Dagen efter TAF-periodens slut beskrives med en arbejdsstatus-linje der inkluderes i PDF. Eksempler:
- `Uarbejdsdygtig` → "Den [dato] var skadelidte fortsat uarbejdsdygtig."
- `Fleksjob` → "Den [dato] var skadelidte bevilget fleksjob og således fortsat delvist uarbejdsdygtig."
- `Fuldt arbejdsdygtig` (opgjort frem til periodeTil) → "Den [dato] blev skadelidte raskmeldt."

---

## Del 2 — AI-agent: teknisk reference

### Primære filer

| Fil | Ansvar |
|---|---|
| `src/domain/erstatningsopgoerelse/tafBeregningsenhed.ts` | Bestemmer beregningsenhed (Måneder/Arbejdsdage); eksporterer `computeTafBeregningsenhed`, `TAF_BEREGNES_SOM`, `TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR` |
| `src/domain/erstatningsopgoerelse/periodiseringsMotor.ts` | Central periodiseringsmotor; optælling af måneder og arbejdsdage; periodisering af løn og offentlige ydelser |
| `src/domain/erstatningsopgoerelse/tafBeregningsEngine.ts` | Aggregeret TAF-engine; merger overlappende perioder; eksporterer `computeTafEngine`, `buildMergedTafGroups`, `computeTafArbejdsdageAggregation` |
| `src/domain/erstatningsopgoerelse/tafNettoBeregning.ts` | Netto-TAF-beregning; orkestrerer lønudvikling, TAF-indtægter og tidligere modtaget TAF; eksporterer `computeTafNettoBeregning` |
| `src/domain/erstatningsopgoerelse/tafPeriodConstraints.ts` | Grænser og clamping for TAF-perioder; `resolveTafConstraintBounds`, `resolveTafFejlgivendeBounds`, `resolveTafEoPeriodeBounds`, `clampTafRange` |
| `src/domain/erstatningsopgoerelse/tafDaySets.ts` | Datosæt-bygning: ferie, SH, løse feriedage; `buildTafArbejdsdageSetFromRows`, `buildShDageSet`, `buildFerieDageSet`, `placeLoseFeriedage` |
| `src/domain/erstatningsopgoerelse/tafRowDerived.ts` | Per-række UI-afledninger (merger IKKE); `buildTafDerived` |
| `src/domain/erstatningsopgoerelse/tafCalculations.ts` | Tynde wrapper-funktioner over `periodiseringsMotor` |
| `src/domain/erstatningsopgoerelse/tafPerYearDerived.ts` | TAF fordelt på kalenderår til PDF-bilag |
| `src/domain/erstatningsopgoerelse/tafArbejdsstatusConfig.ts` | Status-tekst per `Arbejdsstatus`; `buildTafArbejdsstatusLinje` |

### Indgangspunkter

```typescript
// Beregningsenhed
computeTafBeregningsenhed(values: TafBeregningsenhedInput): TafBeregningsenhed

// Aggregeret engine (merged perioder)
computeTafEngine(input: TafEngineInputSnapshot): TafEngineOutput

// Netto-TAF
computeTafNettoBeregning(
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  options: { tafRanges: readonly IsoRange[] }
): TafNettoBeregningResult

// TAF per kalenderår
buildTafPerYearBuildOutcome(
  source: TafPerYearSource,
  eoValues: ErstatningsopgoerelseValues,
  options: { tafRanges: readonly IsoRange[] }
): TafPerYearBuildOutcome
```

### Nøgletyper

```typescript
TafBeregningsenhed = 'Måneder' | 'Arbejdsdage'

TafEngineInputSnapshot = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  tafPerioder: ReadonlyArray<TafPeriodeRow>;
  ferieperioder: ReadonlyArray<FerieperiodeRow>;
}>

TafEngineOutput = Readonly<{
  beregningsenhed: TafBeregningsenhed;
  rows: ReadonlyArray<{ id: string; value: number | null }>;
}>

TafNettoBeregningResult = Readonly<{
  harTafPerioder: boolean;
  tafBeregningsenhed: TafBeregningsenhed;
  indkomstSkadestidspunkt: IndkomstSkadestidspunktPdfModel | null;
  loenudvikling: LoenudviklingPdfModel | null;
  tafIndtaegter: TafIndtaegterPdfModel | null;
  tidligereModtagetTaf: Calculable<MoneyOre>;
  tabtArbejdsfortjenesteOre: MoneyOre;
}>

TafPerYearBuildOutcome =
  | { kind: 'ok'; result: TafPerYearResult }
  | { kind: 'not_applicable'; reason: 'missing_loenudvikling' | 'missing_taf_indtaegter' }
  | { kind: 'error'; reason: 'afrunding_over_100'; afrundingOre: MoneyOre; sumYearTafOre: MoneyOre; samletTafKravOre: MoneyOre }

MergedTafGroup = Readonly<{
  id: string;
  fra: TafPeriodeRow['fra'];
  til: TafPeriodeRow['til'];
  loseFeriedage: number;
}>

TafConstraintBounds = Readonly<{ minStart?: ISODateString; maxEnd?: ISODateString }>
```

### Periodiseringsmotor — eksporterede funktioner

```typescript
// Måneds-optælling
optaelMaanederPraecis(args: { fra, til, oevrigeFravaersdage? }): number | null
optaelMaanederAfrundet(args: { fra, til, oevrigeFravaersdage? }): number | null  // round2

// Arbejdsdags-optælling med breakdown
optaelArbejdsdageBreakdown(args: { fra, til, ferieperioder, loseFeriedage, context }): ArbejdsdageBreakdown | null
optaelArbejdsdage(args): number | null  // returnerer breakdown.tafDage

// Periodisering af beløb
periodiserBeloebForMaaneder(args: { totalBeloeb, interval, ranges }): number
periodiserBeloebForArbejdsdage(args: { totalBeloeb, interval, ranges, arbejdsdageSet }): number
periodiserBeloebForOffentligYdelse(args: { totalBeloeb, interval, range, periodisering, ydelsestypeKey, shDays }): number
```

```typescript
ArbejdsdageBreakdown = Readonly<{
  arbejdsdage: number;       // hverdage (man-fre), ingen fradrag
  shDage: number;            // SH-dage på hverdage (ekskl. dem der falder i ferie)
  arbejdsdageMinusSH: number;
  feriedage: number;         // daterede feriedage
  loseFeriedage: number;     // placerede løse feriedage
  oevrigeFravaersdage: number; // kun beregningsgrundlag-kontekst
  tafDage: number;           // det autoritative TAF-arbejdsdagsantal
}>

ArbejdsdageBeregningskontekst =
  | { kind: 'beregningsgrundlag'; oevrigeFravaersdage: number }
  | { kind: 'taf' }  // ingen øvrigt-fravær-fradrag
```

### Grænse-konstanter

```typescript
TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR = 0.048      // 1 arbejdsdag = 4,8% af måned
SYGEDAGPENGE_SH_CUTOFF = '2012-07-02'         // sygedagpenge før denne dato: ingen SH-fradrag
TAF_MIDLERTIDIG_EET_SKAERINGSDATO = '2011-06-16' // skader før denne dato: midlertidig EET afgrænser TAF
```

### Afrunding

`roundTafValue` (lokalt i `tafBeregningsEngine.ts`): `roundByMethod(value, 2, 'halfAwayFromZero')`.

Intern øre-aritmetik i netto-beregning og per-år-fordeling: `MoneyOre = number` (branded integer). Slutresultat `tabtArbejdsfortjenesteOre` er altid ≥ 0 via `clampMoneyOreToZero`.

Per-år-fordeling: Largest-remainder-metoden (`allocateOreByWeight`) sikrer at summen af årsbeløb præcis svarer til samlet TAF. Tolerance: max 1 kr. (100 øre) — ved overskridelse returneres `kind: 'error'`.

### TAF per-år-fordeling — dataflow

```
samletTafKravOre (fra PdfModel)
  ↓
splitRangeByCalendarYearsInclusive → sub-segmenter per år
  ↓
buildSubSegment → TafYearSegment (quantity × unitAmount × deltaPct)
  ↓
buildIncomeForRanges per klippet år → fradrag (løn + ydelser)
  ↓
allocateOreByWeight → tidligere modtaget TAF fordeles proportionalt
  ↓
yearTafOre = yearIncomeOre − yearDeductionsOre  [× forligFactor hvis sat]
  ↓
afrundingOre = samletTafKravOre − Σ yearTafOre  (skal ≤ 100 øre)
```

### Constraints — to typer clamping

```typescript
// Stille clamping (ingen fejlindikation til bruger):
resolveTafEoPeriodeBounds(values): TafConstraintBounds
// → minStart: vedroererPeriodeFra, maxEnd: vedroererPeriodeTil

// Fejlgivende clamping (rød kant + tooltip):
resolveTafFejlgivendeBounds(values): TafConstraintBounds
// → maxEnd: min(
//     differencekravDato−1,
//     endeligEetVirkningsdato−1,                       // kun hvis verserendeKlageEet ≠ 'Ja'
//     midlertidigEetVirkningsdato−1                    // kun hvis skadedato < 2011-06-16 OG verserendeKlageEet ≠ 'Ja'
//   )

// Intern helper — ikke eksporteret:
resolveMidlertidigEetDatoHvisAktiv(values): ISODateString | undefined
// → returnerer midlertidigEETVirkningsdato ?? midlertidigEETAfgoerelseDato
//   når midlertidigtEetAfgorelse = 'Ja' OG skadedato < 2011-06-16
//   Checker IKKE verserendeKlageEet — det gøres af kalderne.

// Kombineret (bruges af debug og UI):
resolveTafConstraintBounds(values): TafConstraintBounds
// → strengeste af alle grænser
```

`TafConstraintSource` inkluderer nu `skadedatoISO` (fra stamdata) for at kunne evaluere midlertidig EET-betingelsen. `buildTafRanges` accepterer et optional `options`-objekt med `skadedatoISO`.

### Afhængigheder

| Import | Kilde |
|---|---|
| `beregnHelligdage` | `src/utils/shDageBeregning.ts` |
| `mergeIsoDateRanges` | `src/domain/erstatningsopgoerelse/engines/periodMerging.ts` |
| `buildIncomeForRanges`, `buildIncomeCalculationContext` | `src/domain/erstatningsopgoerelse/indtaegtPerioder.ts` |
| `buildIndkomstSkadestidspunkt` | `src/domain/erstatningsopgoerelse/eoPdfIndkomstSkadestidspunkt.ts` |
| `buildLoenudviklingModel` | `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts` |
| `roundByMethod` | `src/utils/rounding.ts` |
| `countInclusiveUtcDays` | `src/utils/utcDayMath.ts` |

### Tests

| Testfil | Dækker |
|---|---|
| `src/__tests__/domain/erstatningsopgoerelse/tafBeregningsenhed.test.ts` | Beregningsenhed-beslutningstræ |
| `src/__tests__/domain/erstatningsopgoerelse/tafCalculations.test.ts` | Måneds- og arbejdsdagsoptælling |
| `src/__tests__/domain/erstatningsopgoerelse/tafCalculations.kalenderdage.test.ts` | Periodisering på kalenderdage |
| `src/__tests__/domain/erstatningsopgoerelse/tafDaySets.test.ts` | Datosæt-bygning (ferie, SH, løse feriedage) |
| `src/__tests__/domain/erstatningsopgoerelse/tafBeregningsEngine.test.ts` | Aggregeret engine, overlap-merging |
| `src/__tests__/domain/erstatningsopgoerelse/tafRowDerived.test.ts` | Per-række UI-afledninger |
| `src/__tests__/domain/erstatningsopgoerelse/tafPeriodConstraints.test.ts` | Clamping-logik |
| `src/__tests__/domain/erstatningsopgoerelse/tafPerYearDerived.test.ts` | TAF fordelt på kalenderår |
| `src/__tests__/domain/erstatningsopgoerelse/tafArbejdsstatusConfig.test.ts` | Status-tekst per arbejdsstatus |
| `src/__tests__/utils/pdf/tafFordeltPaaAarPdf.wiring.test.ts` | PDF-wiring for per-år-fordeling |

### Kanonisk periodemerge i EO

EO-domænet bruger den fælles merge-helper i `src/domain/erstatningsopgoerelse/engines/periodMerging.ts`.

- `mergeIsoDateRanges(...)` bruges når perioderne allerede er på ISO-form.
- `mergeDateRanges(...)` bruges når en engine arbejder på `Date`-intervaller internt.
- Nye EO-flow må ikke indføre lokale merge-varianter for TAF-, svie/smerte-, ferie- eller SFGG-perioder uden eksplicit kontraktbegrundelse.

---

## Kendte udeståender

*Ingen kendte udeståender pr. dags dato. Filen er synkroniseret med koden.*
