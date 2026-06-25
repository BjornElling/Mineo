# Række-evaluerings- & debug-builder arkitektur

**Status:** Arkitekturforklarende reference, ikke selvstændig kontrakt
**Primært scope:** `src/domain/eoRowEvaluation/*` (række-evaluerings-motoren), `src/domain/debug/*` (DEV-visning), `src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToDebugView.ts`, `src/components/pages/erstatningsopgoerelse/EODebug.tsx`

Dette dokument er et arbejdsredskab for ændringer i EO-række-evaluering og EO-debug. Bindende fejl-/debug-regler ligger i `src/contracts/error-debug-contract.md` og EO-regler i `src/contracts/eo-snapshot-contract.md`.

> **B9-relocation (2026-06-25) — læs dette først.** Række-evaluerings-motoren (builder-registry + alle `buildEo…Rows` + aggregator + delte typer/helpers) er flyttet UD af `src/domain/debug/` til den autoritative, debug-frie placering **`src/domain/eoRowEvaluation/`**, fordi den driver den trust-kritiske download-gate og derfor ikke må ligge i et nominelt "DEV"-lag. Symbolerne er omdøbt `eoDebug…`→`eoRow…` / `…Debug…`→`…EoRow…` (fx `collectAllDebugRows`→`collectAllEoRows`, `DebugRowModel`→`EoRowModel`, `EODebugExecutionContext`→`EoRowEvaluationContext`, `EO_DEBUG_BUILDERS`→`EO_ROW_BUILDERS`, `buildEODebug…Rows`→`buildEo…Rows`). I `src/domain/debug/` bliver kun den rene DEV-visning (page-/regulerings-viewmodel, CSV, integritet, parity, sammentælling) — den importerer nu motoren, aldrig omvendt. Symboler der navngiver et ÆGTE DEV-inspektions-underbegreb (`DebugDay`, `IntegrityInvariant`, `DebugCellValue`, `parseDanishToIsoDebug`) samt den private exception-isolerings-helper `executeEODebugBuilderEntry` og fallback-rækkens id (`debug.builder.<section>.exception`) er bevidst beholdt. Hvor prosaen nedenfor siger "EO-debug" / "debug-builder" om selve række-produktionen, læs "række-evaluering".

---

## 1. Formål

EO-debug skal vise committed, auditérbare og forklarlige oplysninger om sagen.

EO-debug er et visnings- og forklaringslag. Det er ikke den autoritative beregningspipeline.

Konsekvens:
- debug må gerne projektere, forklare og strukturere motorens resultater
- debug må ikke indføre alternative beregningsforudsætninger i strid med motoren
- debug må ikke gøre lovlige committed input "forkerte" ved at kalde delmotorer på et for bredt eller forkert grundlag
- debug må gerne have fallback-visning uden `canonicalOutput`, men fallback må være tydeligt begrænset til forklaring og ikke udgive sig for at være autoritativ beregning

---

## 2. Faktisk systemstruktur

Den nuværende EO-debug består af to parallelle outputspor:

1. Builder-baserede `EoRowModel[]`
2. Reguleringssektioner (`RegulationDebugSection[]`)

Det er vigtigt, fordi registry kun dækker spor 1.

### Dataflow for EO-debug siden

```text
EoSnapshot
  ↓
eoSnapshotToDebugView(...)
  ↓
bygger EoRowEvaluationContext
  ↓
executeEoRowBuilderEntriesBySection(EO_ROW_BUILDERS, ctx)
  ↓
rowsBySection: Map<SectionId, EoRowModel[]>

samtidig:

debugSnapshot.debugDays + committed values + canonicalOutput?
  ↓
buildRegulationTimeline(...)
  ↓
buildRegulationDebugSections(...)
  ↓
regulationSections: RegulationDebugSection[]

til sidst:

buildEODebugPageViewModel(view, appSettings)
  ↓
EODebugPageViewModel (filtreret + grupperet)
  ↓
EODebug.tsx (ren renderer)
```

### Dataflow for Beregning-fanen

```text
collectAllEoRows(...)
  ↓
EoRowEvaluationContext
  ↓
executeAllEoRowBuilders(...)
  ↓
EoRowModel[]
  ↓
navigation + relevance filtering + dependency suppression
  ↓
errors / warnings / allRows / relevantRows
```

### Konsekvens

`EO_ROW_BUILDERS` er single source of truth for række-rækkerne, men ikke for hele EO-debug-visningen.

Det er derfor forkert at antage:
- at al debug-output går gennem registry
- at en ny debug-sektion altid kun kræver én ændring i registry
- at EO-debug og Beregning-fanen er identiske consumers af række-output

De deler samme builder-kilde, men har forskellig efterbehandling.

---

## 3. Blokeringstilstande i `eoSnapshotToDebugView`

`eoSnapshotToDebugView` returnerer `kind: 'blocked'` i tre tilfælde:

1. Intet snapshot
2. `snapshot.status === 'fail_closed'`
3. Snapshot findes, men `debugSnapshot` mangler

Kun når `debugSnapshot` findes, returneres `kind: 'ready'`.

Ved `ready` bruger viewet altid værdierne fra `debugSnapshot` som committed debug-grundlag:
- `debugSnapshot.stamdataValues`
- `debugSnapshot.eoValues`
- `debugSnapshot.fieldErrors`
- `debugSnapshot.debugDays`

Det er korrekt og vigtigt, fordi debug ikke må læse "stale" input direkte fra `snapshot.input`, hvis snapshot allerede indeholder et konsistent committed debug-grundlag.

Der findes test for dette i `src/__tests__/domain/erstatningsopgoerelse/eoSnapshotToDebugView.test.ts`.

---

## 4. EoRowEvaluationContext er canonical for builders

```ts
type EoRowEvaluationContext = {
  stamdataValues: StamdataValues;
  stamdataErrors: StamdataFieldErrorsBySource;
  eoValues: ErstatningsopgoerelseValues;
  eoErrors: ErstatningsopgoerelseFieldErrorsBySource;
  loenindkomstManuelReguleringInputErrors: Readonly<Record<string, true>>;
  appSettings: AppSettings;
  canonicalOutput?: EoCanonicalOutput;
  pdfModel?: EoModel;
};
```

Regel:
- alle builder-entrypoints skal kunne drives af dette context-objekt alene
- builders må ikke læse global state, React state eller UI state
- nye builder-afhængigheder skal som udgangspunkt tilføjes til execution context, ikke smugles ind via særskilte imports fra UI-laget

Dette følges konsekvent i registry og i Beregning-fanen.

---

## 5. Registryets faktiske ansvar

`src/domain/eoRowEvaluation/eoRowBuilderRegistry.ts` ejer:
- listen over builder-sektioner og deres rækkefølge
- wiring fra `EoRowEvaluationContext` til de konkrete builder-funktioner
- per-builder exception-isolation via den private `executeEODebugBuilderEntry`

Registryet eksponerer to udførelsesfunktioner:
- `executeEoRowBuilderEntries` — flat `EoRowModel[]`, bruges af Beregning-fanen
- `executeEoRowBuilderEntriesBySection` — `Map<SectionId, EoRowModel[]>`, bruges af EO-debug siden

Registryet ejer ikke:
- reguleringssektioner
- viewmodel-sammensætning og filtrering pr. ansættelsesforhold (ejes af `eoDebugPageViewModel.ts`)
- filtrering af irrelevante rækker i Beregning-fanen
- præsentationsspecifik rendering i `EODebug.tsx`

### Nuværende builder-sektioner

- `stamdata`
- `erstatningsopgoerelse`
- `forlig`
- `aes`
- `loenindkomst`
- `offentlige-ydelser`
- `sygeferiegodtgoerelse`
- `sviesmerte`
- `taf-beregningsgrundlag`
- `taf`
- `oevrige-krav`
- `saerlige-kommentarer`
- `bilagsnumre`

---

## 6. Fejlisolation: ét kanonisk sted

Fejl i en enkelt builder isoleres via `executeEODebugBuilderEntry` (privat helper i registry), som bruges af:
- `executeEoRowBuilderEntries` (flat output til Beregning-fanen)
- `executeEoRowBuilderEntriesBySection` (sektioneret output til EO-debug siden)

`eoSnapshotToDebugView` bruger `executeEoRowBuilderEntriesBySection(EO_ROW_BUILDERS, ctx)` og har ikke sin egen kopi af exception-isolationen.

Fallback-rækken er:
- id: `debug.builder.<section>.exception`
- label: `Fejl i debug-builder (<section>)`
- status: `error`

Forventelige brugerinputtilstande må ikke kaste. Uventede builder-exceptions skal både isoleres som debug-række og rapporteres via central systemfejlrapportering med sanitiseret payload efter `error-debug-contract.md`.

---

## 7. Hovedregel for `canonicalOutput`

Hvis en oplysning allerede findes i `canonicalOutput`, skal debug læse den derfra frem for at genberegne.

Rationale:
- reducerer divergens mellem debug og motor
- reducerer sandsynligheden for, at debug kalder delmotorer med forkert gating
- gør koblingen mellem autoritativ beregning og debug forklaring eksplicit

### Nuværende builders med canonical-output-kobling

| Builder / modul | Læser fra canonical output | Fallback når canonical mangler |
|---|---|---|
| `buildEoSvieSmerteRows` | `totals.svieSmerteOre`, `svieSmerte.maxApplied` | viser `'-'` for beregnet beløb |
| `buildEoTaftRows` | `taf.tidligereModtagetTafOre` | falder tilbage til committed input |
| `buildEoSygeferiegodtgoerelseRows` | `periodiseringer.tafPerioder` | falder tilbage til `buildTafRanges(values)` |
| `buildEoOevrigeKravRows` | `periodiseringer.tafPerioder` | falder tilbage til `buildTafRanges(values)` |
| `buildRegulationDebugSections` | `regulering.perAnsaettelse[*].loenudviklingSegmenter`, `periodiseringer.tafPerioder` | falder tilbage til tidslinje/TAF-ranges |

### Vigtig præcisering

Ikke alle debug-oplysninger findes i `canonicalOutput`, og ikke alle builders skal have `canonicalOutput`.

Reglen er:
- "når den autoritative værdi allerede findes i canonical output, skal debug bruge den"

---

## 8. Hvornår debug må kalde en motor direkte

Direkte motorkald i debug er kun forsvarligt når alle disse betingelser er opfyldt:

1. Den nødvendige information findes ikke allerede i `canonicalOutput`.
2. Builderen kan afgøre samme domæneforudsætninger som motoren kræver.
3. Gatingen sker på konkret domænesemantik, ikke på løse korrelationer.
4. Der findes regressionstest for lovlige edge cases, hvor motoren ikke må kaldes.

### Konkrete nuværende motorkald/faglige helpers i debug

- `buildEoSygeferiegodtgoerelseRows`
  - kalder `buildLoenudviklingModel(...)` og `computeSygeferiegodtgoerelse(...)`
- `buildEoOevrigeKravRows`
  - bruger `buildIncomeForRanges(...)`
- `buildEoTafBeregningsgrundlagRows`
  - bruger `buildBeregningsperiodeRange(...)` og `buildIncomeForRanges(...)`
- `buildRegulationDebugSections`
  - kalder `buildReguleringIndexRows(...)`

At debug bruger disse helpers er ikke i sig selv et problem. Problemet opstår først, hvis debug bruger dem med bredere eller andre forudsætninger end de autoritative flows.

### Særlig undtagelse: regulerings-debug genbruger regulerings-præsentationens rækkebygger

`buildRegulationDebugSections` (`src/domain/debug/eoDebugRegulationViewModel.ts`) importerer `buildReguleringIndexRows(...)` fra regulerings-præsentationslaget `src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts`. (Dette modul hed tidligere `pdf/eoPdfRegulering.ts`, men er konsolideret ind i `engines/` ved review 10.5 — det er domæne-præsentationslogik der bygger tabel-data, ikke jsPDF-rendering.)

Det er et andet mønster end SFGG-builderen:
- her genbruges regulerings-præsentationslogikken direkte i debug
- der er ikke tilsvarende dokumenteret, domænespecifik gating foran kaldet

Aktuel vurdering:
- dette er ikke nødvendigvis forkert, fordi debug her forsøger at forklare samme reguleringssegmenter som resten af systemet
- men det er en arkitektonisk undtagelse, som bør behandles eksplicit
- på sigt bør det enten formaliseres som accepteret delt domain-helper eller flyttes ud af PDF-engine-modulet til et neutralt domænemodul

---

## 9. Forbudt gating-mønster

Builders må ikke beslutte motorkald ud fra indirekte metadata, hvis metadataen også dækker lovlige undtagelser.

Forkert mønster:
- "overenskomsten har reguleringsdata"
- derfor: "debug må bygge lønudviklingsmodel"

Det er forkert, hvis en delmængde af disse overenskomster i virkeligheden bruger direkte sats og derfor ikke skal gennem lønudviklingsmodellen.

---

## 10. Eksempel på korrekt domænespecifik gating

`buildEoSygeferiegodtgoerelseRows` er i dag det tydeligste eksempel på korrekt, domænespecifik gating.

Builderen skelner mellem:
- om der overhovedet er aktiv SFGG-kilde
- om den konkrete SFGG-kilde faktisk kræver lønudviklingsmodellen

Kernen er:

```ts
const hasActiveSfggSource = ...
const requiresLoenudviklingModel = ...
  if (row?.beregnesUdFra !== 'Overenskomst') return false;
  if (!employment.overenskomstId || isOffentligOverenskomstId(employment.overenskomstId)) return false;
  const sfggPolicy = getOverenskomstSfggPolicy(employment.overenskomstId);
  if (sfggPolicy?.model === 'direkte_sats') return false;
  return getReguleringsDatoIntervalForOverenskomst(employment.overenskomstId) !== undefined;
```

`buildLoenudviklingModel(...)` kaldes kun når begge gates er opfyldt.

Arkitektonisk vurdering:
- dette matcher dokumentets oprindelige hensigt
- dette er et godt mønster at kopiere ved fremtidige motorkald i debug
- der findes regressionstest, som specifikt beskytter mod at kalde lønudviklingsmodellen for direkte sats-sporet

---

## 11. `EoRowModel`, stabile id'er og dependency-spec

```ts
type EoRowModel = {
  id: string;
  label: string;
  displayValue: string;
  status: EoRowStatus;
  message?: string;
  summaryDisplay?: 'default' | 'messageOnly';
  group?: EoRowGroup;
  dependsOn?: ReadonlyArray<DependencySpec>;
};
```

### Regler

- `id` skal være semantisk stabilt og må ikke være positionsbaseret
- `dependsOn` er en domain-kontrakt, ikke kun UI-metadata
- child-rækker må kun dependsOn-reference eksisterende semantiske årsagsrækker
- prefix-baserede afhængigheder må kun bruges, når hele prefix-familien faktisk er en årsagsmængde

### Hvor bruges dette i dag

- `eoDebugPageViewModel.ts` udleder ansættelsesforhold-id via regex på `id` (fx `loenindkomst.<id>.`, `sfgg.<felt>.<id>`)
- `eoRowNavigationMap.ts` bruger `id` til navigation
- `collectAllEoRows` bruger `dependsOn` til suppression i Beregning-fanen
- duplicate-id og dependency-cycle kaster fail-closed i `collectAllEoRows`

Arkitektonisk vurdering:
- dette er en god og relativt stringent kontrakt
- `dependsOn` er nu aktiv suppression-logik og ikke blot fremtidig metadata
- regex-baseret id-parsing i `eoDebugPageViewModel.ts` er en skjult string-kontrakt: rename af et id-mønster kan bryde grupperingen uden typefejl

---

## 12. Post-processing-lag efter builders

Builder-output renderes ikke råt 1:1.

### I `eoDebugPageViewModel.ts`

Domænelaget beregner en render-klar viewmodel:
- filtrerer svie/smerte-rækker baseret på `tidligereSsMax`
- filtrerer AES-rækker baseret på aktiv midlertidig/endelig EET
- filtrerer tomme/skjulte lønansættelser væk
- grupperer lønindkomst-rækker pr. ansættelsesforhold
- splitter løn-rækker og regulerings-rækker pr. ansættelsesforhold
- grupperer SFGG-rækker og parser tabeller ud af `displayValue`
- kobler `regulationSections` på ansættelsesforhold via id-konventioner
- returnerer `EODebugPageViewModel` med navngivne felter pr. sektion

`EODebug.tsx` er herefter en ren renderer uden domænelogik.

### I `collectAllEoRows`

Beregning-fanens domænelag gør følgende:
- tilføjer navigation-metadata
- filtrerer rækker væk som er irrelevante for den aktuelle EO-konfiguration
- finder duplicate ids og dependency-cycles (fail-closed)
- undertrykker afledte fejl/warnings via `dependsOn`

### Konsekvens

Builders producerer rå række-data. Hver consumer laver sin relevante post-processing. Det er to distinkte lag med forskellig semantik — de bør ikke forveksles.

---

## 13. Konsistensvurdering af nuværende opbygning

### Det der er konsistent og korrekt

- builder-rækker går konsekvent gennem `EO_ROW_BUILDERS`
- `EoRowEvaluationContext` bruges konsekvent som builder-input
- `canonicalOutput` prioriteres de steder, hvor autoritative værdier allerede findes
- exception-isolation er samlet i `executeEODebugBuilderEntry` og genbruges begge steder
- `EoRowModel.id` bruges konsekvent som stabil, semantisk nøgle
- `collectAllEoRows` kaster (fail-closed) ved duplicate ids og dependency-cycles
- duplicate-id-checket kører før relevans-filtrering: et globalt duplikat opdages selv om rækkerne ville være filtreret væk som irrelevante; dette er bevidst byggefejl-detektion
- SFGG-builderen har domænekorrekt gating for lønudviklingsmodellen
- domænenær gruppering og filtrering er rykket ud af `EODebug.tsx` til `eoDebugPageViewModel.ts`

### Det der ikke er fuldt konsistent

- regulerings-debug ligger uden for builder-registryet og er ikke en `EoRowModel`-sektion
- `eoDebugPageViewModel.ts` parser ansættelsesforhold-id via regex på row-ids — det er en skjult string-kontrakt uden typesikring
- registry er single source of truth for selve række-rækkerne, men ikke for hele EO-debug-visningen (regulerings-sektioner, viewmodel-sammensætning og navigation ligger udenfor); en ny builder-sektion kræver derfor typisk ændringer flere steder (jf. §14–§15)

---

## 14. Praktisk tjekliste ved ændringer

Før du ændrer eller tilføjer debug-output:

1. Find ud af, om ændringen er en `EoRowModel`-sektion eller en `RegulationDebugSection`-agtig særstruktur.
2. Hvis værdien allerede findes i `canonicalOutput`, brug den derfra.
3. Hvis ikke: undersøg om der findes en eksisterende ren helper før du kalder en tung motor.
4. Hvis debug skal kalde en motor, dokumentér den konkrete gating og skriv regressionstest.
5. Vurder om `dependsOn` skal sættes for at undgå dobbeltfejl i Beregning-fanen.
6. Kontroller at `id` er semantisk stabilt og navigerbart eller bevidst `unsupported`.
7. Kontroller begge consumers:
   - `eoSnapshotToDebugView` → `buildEODebugPageViewModel` → `EODebug.tsx`
   - `collectAllEoRows` → Beregning-fanen
8. Hvis du tilføjer en ny section-id, opdater også `SectionId` i `eoRowNavigationMap.ts`.
9. Hvis `eoDebugPageViewModel.ts` henter rækker fra den nye sektion, opdater `buildEODebugPageViewModel`.
10. Hvis id-mønstret for den nye sektion bruges til at udlede ansættelsesforhold-id, opdater regex-parserne i `eoDebugPageViewModel.ts` eksplicit.

---

## 15. Når du tilføjer en ny builder

Følg §14's tjekliste. Registry er single source of truth for builder execution order/wiring, men det er ikke hele ændringsscopet.

En ny builder kræver typisk også vurdering af `SectionId`, navigation, viewmodel, rendering og tests. Det konkrete scope afhænger af, om outputtet er en almindelig `EoRowModel`-sektion eller en særstruktur.

---

## 16. Udestående teknisk gæld

### A. `buildReguleringIndexRows` deles mellem PDF og debug

Se afsnit 8: `buildRegulationDebugSections` genbruger `buildReguleringIndexRows` fra `src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts`. Ved review 10.5 blev dette modul flyttet ud af det tidligere `pdf/`-lag og ind i `engines/`, hvilket afklarer ejerskabet: det er domæne-præsentationslogik (tabel-data), der bevidst deles af både EO-PDF-projektionen og regulerings-debug. Det er dermed ikke længere en uafklaret afhængighed til "PDF-laget".

### B. Regex-baseret id-parsing i `eoDebugPageViewModel.ts`

Se afsnit 11 og 13. En mere robust løsning ville være eksplicit metadata på `EoRowModel` (fx `employmentId?: string`). Udestår som forbedring.

### C. `EODebugPageViewModel` eksponerer både rows og synlighedsflag

Viewmodellen returnerer i dag både:
- sektionernes rækker
- eksplicitte synlighedsflag som `showSvieSmerteSection` og `showTabtArbejdsfortjenesteSections`

Separate boolean flags er accepteret som permanent mønster for brede tværgående domænegates, hvor fravær ikke kan udtrykkes sikkert af sektionens dataform alene.

Almindelige nye sektioner skal som udgangspunkt være strukturelt til stede/fraværende i viewmodellen eller have tomme arrays. De må ikke kopiere flagmønsteret uden begrundelse.
