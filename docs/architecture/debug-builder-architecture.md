# Debug-builder arkitektur

**Status:** Gældende arkitektur pr. 28. marts 2026
**Primært scope:** `src/domain/debug/*`, `src/domain/erstatningsopgoerelse/eoSnapshotToDebugView.ts`, `src/components/pages/erstatningsopgoerelse/EODebug.tsx`

Dette dokument er et arbejdsredskab for ændringer i EO-debug. Det beskriver den aktuelle arkitektur, hvad der er canonical, hvor systemet i dag er konsistent, og hvor der fortsat findes bevidste eller ubevidste særveje.

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

Den nuværende EO-debug består af to parallelle debug-outputspor:

1. Builder-baserede `DebugRowModel[]`
2. Reguleringssektioner (`RegulationDebugSection[]`)

Det er vigtigt, fordi registry kun dækker spor 1.

### Dataflow for EO-debug siden

```text
EoSnapshot
  ↓
eoSnapshotToDebugView(...)
  ↓
bygger EODebugExecutionContext
  ↓
for hver entry i EO_DEBUG_BUILDERS
  ↓
rowsBySection: Map<SectionId, DebugRowModel[]>

samtidig:

debugSnapshot.debugDays + committed values + canonicalOutput?
  ↓
buildRegulationTimeline(...)
  ↓
buildRegulationDebugSections(...)
  ↓
regulationSections: RegulationDebugSection[]

til sidst:

EODebug.tsx
  ↓
render + UI-specifik filtrering/gruppering
```

### Dataflow for Beregning-fanen

```text
collectAllDebugRows(...)
  ↓
EODebugExecutionContext
  ↓
executeAllEODebugBuilders(...)
  ↓
DebugRowModel[]
  ↓
navigation + relevance filtering + dependency suppression
  ↓
errors / warnings / allRows / relevantRows
```

### Konsekvens

`EO_DEBUG_BUILDERS` er single source of truth for debug-rækkerne, men ikke for hele EO-debug-visningen.

Det er derfor forkert at antage:
- at al debug-output går gennem registry
- at en ny debug-sektion altid kun kræver én ændring i registry
- at EO-debug og Beregning-fanen er identiske consumers af debug-output

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

## 4. EODebugExecutionContext er canonical for builders

```ts
type EODebugExecutionContext = {
  stamdataValues: StamdataValues;
  stamdataErrors: StamdataFieldErrorsBySource;
  eoValues: ErstatningsopgoerelseValues;
  eoErrors: ErstatningsopgoerelseFieldErrorsBySource;
  loenindkomstManuelReguleringInputErrors: Readonly<Record<string, true>>;
  appSettings: AppSettings;
  canonicalOutput?: EoCanonicalOutput;
};
```

Regel:
- alle builder-entrypoints skal kunne drives af dette context-objekt alene
- builders må ikke læse global state, React state eller UI state
- nye builder-afhængigheder skal som udgangspunkt tilføjes til execution context, ikke smugles ind via særskilte imports fra UI-laget

Dette følges konsekvent i registry og i Beregning-fanen.

---

## 5. Registryets faktiske ansvar

`src/domain/debug/eoDebugBuilderRegistry.ts` ejer:
- listen over builder-sektioner og deres rækkefølge
- wiring fra `EODebugExecutionContext` til de konkrete builder-funktioner
- per-builder exception-isolation via `executeEODebugBuilderEntries`

Registryet ejer ikke:
- reguleringssektioner
- UI-gruppering pr. ansættelsesforhold
- filtrering af irrelevante rækker i Beregning-fanen
- præsentationsspecifik hiding af rækker i `EODebug.tsx`

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

### Vigtig præcisering

Rækkefølgen i registry bruges begge steder:
- `eoSnapshotToDebugView` itererer selv `EO_DEBUG_BUILDERS` og bygger `rowsBySection`
- `collectAllDebugRows` bruger `executeAllEODebugBuilders`

Det er derfor korrekt, at registryet er canonical for rækkernes rå output. Men der er stadig duplikeret udførelseslogik, jf. afsnit 13.

---

## 6. Fejlisolation: korrekt princip, men duplikeret implementering

Fejl i en enkelt builder isoleres i dag to steder:

1. `executeEODebugBuilderEntries`
2. `eoSnapshotToDebugView.buildRowsBySection`

Begge producerer samme fallback-række:
- id: `debug.builder.<section>.exception`
- label: `Fejl i debug-builder (<section>)`
- status: `error`

Arkitektonisk vurdering:
- princippet er korrekt
- den konkrete implementering er duplikeret

Det er en reel vedligeholdelsesrisiko, fordi de to lag kan drive fra hinanden ved senere ændringer i fejlformat eller metadata.

Præcist er det dette der er duplikeret:
- `eoSnapshotToDebugView` har sin egen private `buildRowsBySection`
- den kalder hverken `executeEODebugBuilderEntries` eller `executeAllEODebugBuilders`
- den itererer `EO_DEBUG_BUILDERS` direkte og producerer fallback-rækken manuelt

Forbedringsforslag A i afsnit 16 er derfor konkret og ikke kun principielt:
- `eoSnapshotToDebugView` bør genbruge `executeEODebugBuilderEntries(EO_DEBUG_BUILDERS, ctx)`
- og derfra mappe rækkerne tilbage til `Map<SectionId, DebugRowModel[]>`

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
| `buildEODebugSvieSmerteRows` | `totals.svieSmerteOre`, `svieSmerte.maxApplied` | viser `'-'` for beregnet beløb |
| `buildEODebugTaftRows` | `taf.tidligereModtagetTafOre` | falder tilbage til committed input |
| `buildEODebugSygeferiegodtgoerelseRows` | `periodiseringer.tafPerioder` | falder tilbage til `buildTafRanges(values)` |
| `buildEODebugOevrigeKravRows` | `periodiseringer.tafPerioder` | falder tilbage til `buildTafRanges(values)` |
| `buildRegulationDebugSections` | `regulering.perAnsaettelse[*].loenudviklingSegmenter`, `periodiseringer.tafPerioder` | falder tilbage til tidslinje/TAF-ranges |

### Vigtig præcisering

Ikke alle debug-oplysninger findes i `canonicalOutput`, og ikke alle builders skal have `canonicalOutput`.

Reglen er derfor ikke:
- "alt i debug skal komme fra canonical output"

Reglen er:
- "når den autoritative værdi allerede findes i canonical output, skal debug bruge den"

Dette er i dag anvendt konsekvent for de felter, der allerede er dækket af canonical output. Testdækningen er særlig tydelig for svie/smerte, TAF og regulering.

---

## 8. Hvornår debug må kalde en motor direkte

Direkte motorkald i debug er kun forsvarligt når alle disse betingelser er opfyldt:

1. Den nødvendige information findes ikke allerede i `canonicalOutput`.
2. Builderen kan afgøre samme domæneforudsætninger som motoren kræver.
3. Gatingen sker på konkret domænesemantik, ikke på løse korrelationer.
4. Der findes regressionstest for lovlige edge cases, hvor motoren ikke må kaldes.

### Konkrete nuværende motorkald/faglige helpers i debug

- `buildEODebugSygeferiegodtgoerelseRows`
  - kalder bl.a. `buildLoenudviklingModel(...)` og `computeSygeferiegodtgoerelse(...)`
- `buildEODebugOevrigeKravRows`
  - bruger `buildIncomeForRanges(...)`
- `buildEODebugTafBeregningsgrundlagRows`
  - bruger bl.a. `buildBeregningsperiodeRange(...)` og `buildIncomeForRanges(...)`
- `buildRegulationDebugSections`
  - kalder `buildReguleringIndexRows(...)`

At debug bruger disse helpers er ikke i sig selv et problem. Problemet opstår først, hvis debug bruger dem med bredere eller andre forudsætninger end de autoritative flows.

### Særlig undtagelse: regulerings-debug genbruger PDF-engine logik

`buildRegulationDebugSections` importerer `buildReguleringIndexRows(...)` fra `src/domain/erstatningsopgoerelse/eoPdfReguleringEngine.ts`.

Det er et andet mønster end SFGG-builderen:
- her genbruges PDF-engine logik direkte i debug
- der er ikke tilsvarende dokumenteret, domænespecifik gating foran kaldet

Aktuel vurdering:
- dette er ikke nødvendigvis forkert, fordi debug her i praksis forsøger at forklare samme reguleringssegmenter som resten af systemet
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

`buildEODebugSygeferiegodtgoerelseRows` er i dag det tydeligste eksempel på korrekt, domænespecifik gating.

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

## 11. `DebugRowModel`, stabile id'er og dependency-spec

```ts
type DebugRowModel = {
  id: string;
  label: string;
  displayValue: string;
  status: DebugStatus;
  message?: string;
  summaryDisplay?: 'default' | 'messageOnly';
  group?: DebugRowGroup;
  dependsOn?: ReadonlyArray<DependencySpec>;
};
```

### Regler

- `id` skal være semantisk stabilt og må ikke være positionsbaseret
- `dependsOn` er en domain-kontrakt, ikke kun UI-metadata
- child-rækker må kun dependsOn-reference eksisterende semantiske årsagsrækker
- prefix-baserede afhængigheder må kun bruges, når hele prefix-familien faktisk er en årsagsmængde

### Hvor bruges dette i dag

- `EODebug.tsx` bruger `id` til gruppering pr. ansættelsesforhold
- `eoDebugNavigationMap.ts` bruger `id` til navigation
- `collectAllDebugRows` bruger `dependsOn` til suppression i Beregning-fanen
- duplicate-id og dependency-cycle giver fail-closed fejl i Beregning-fanen

Arkitektonisk vurdering:
- dette er en god og relativt stringent kontrakt
- den er vigtigere nu end da dokumentet først blev skrevet, fordi `dependsOn` er blevet aktiv suppression-logik og ikke blot fremtidig metadata

---

## 12. Reelle post-processing-lag efter builders

Builder-output renderes ikke råt 1:1.

### I `EODebug.tsx`

UI-laget gør i dag blandt andet følgende:
- skjuler udvidede svie/smerte-rækker når `tidligereSsMax === 'Ja'`
- filtrerer AES-rækker efter aktiv midlertidig/endelig EET
- filtrerer tomme/skjulte lønansættelser væk
- grupperer lønindkomst-rækker pr. ansættelsesforhold
- splitter løn-rækker og regulerings-rækker pr. ansættelsesforhold
- grupperer SFGG-rækker og parser enkelte tabel-rækker ud af `displayValue`
- kobler `regulationSections` på ansættelsesforhold via id-konventioner

### I `collectAllDebugRows`

domænelaget gør følgende:
- tilføjer navigation-metadata
- filtrerer rækker væk som er irrelevante for den aktuelle EO-konfiguration
- finder duplicate ids og dependency-cycles
- undertrykker afledte fejl/warnings via `dependsOn`

### Konsekvens

Det er forkert at forstå builders som den fulde debug-visning.

Den aktuelle arkitektur er:
- builders producerer rå debug-rækker
- forskellige consumers laver hver sin relevante post-processing

Dette er funktionelt acceptabelt, men betyder også, at "debug-arkitekturen" i dag ligger spredt over flere lag.

---

## 13. Konsistensvurdering af nuværende opbygning

### Det der er konsistent og korrekt

- builder-rækker går konsekvent gennem `EO_DEBUG_BUILDERS`
- `EODebugExecutionContext` bruges konsekvent som builder-input
- `canonicalOutput` prioriteres de steder, hvor autoritative værdier allerede findes
- per-builder exception-isolation findes begge steder, hvor builder-kørsel udføres
- `DebugRowModel.id` bruges konsekvent som stabil, semantisk nøgle
- `collectAllDebugRows` kaster (fail-closed) ved duplicate ids og dependency-cycles — dette propageres til Beregning-fanen
- duplicate-id-checket kører før relevans-filtrering
  - et id der er duplikeret globalt giver derfor fejl, selv hvis rækkerne senere ville være filtreret væk som irrelevante
  - dette skal forstås som en bevidst byggefejl-detektion, ikke som brugerrettet relevanslogik
- SFGG-builderen har forbedret og domænekorrekt gating for lønudviklingsmodellen

### Det der ikke er fuldt konsistent

- regulerings-debug ligger uden for builder-registryet
- builder-execution og builder-exception-format er duplikeret mellem registry og `eoSnapshotToDebugView`
- EO-debug-UI har væsentlig domænenær gruppering/filtrering i komponentlaget
- dokumentets tidligere påstand om, at registry er hele systemets ene opdateringspunkt, er ikke korrekt
- kommentaren i `eoDebugRowAggregator.ts` om "ingen risiko for divergens mellem EODebug og EOberegningTab" er for stærk
  - builder-kilden er delt
  - men consumers og efterbehandling er forskellige
  - kommentaren forekommer to steder i `eoDebugRowAggregator.ts` og begge steder bør rettes

### Samlet vurdering

Den nuværende opbygning er overordnet forsvarlig, men ikke fuldt samlet.

Den stærkeste del af arkitekturen er:
- builder-registry + execution context + canonical-output-princippet

Den svageste del af arkitekturen er:
- at debug-output i praksis er delt i flere format- og renderingsspor, som ikke samles ét sted i domænelaget

---

## 14. Praktisk tjekliste ved ændringer

Før du ændrer eller tilføjer debug-output:

1. Find ud af, om ændringen er en `DebugRowModel`-sektion eller en `RegulationDebugSection`-agtig særstruktur.
2. Hvis værdien allerede findes i `canonicalOutput`, brug den derfra.
3. Hvis ikke: undersøg om der findes en eksisterende ren helper før du kalder en tung motor.
4. Hvis debug skal kalde en motor, dokumentér den konkrete gating og skriv regressionstest.
5. Vurder om `dependsOn` skal sættes for at undgå dobbeltfejl i Beregning-fanen.
6. Kontroller at `id` er semantisk stabilt og navigerbart eller bevidst `unsupported`.
7. Kontroller begge consumers:
   - `eoSnapshotToDebugView` / `EODebug.tsx`
   - `collectAllDebugRows` / Beregning-fanen
8. Hvis du tilføjer en ny section-id, opdater også `SectionId` og relevant rendering/navigation.
9. Hvis UI kobler debug-output til ansættelsesforhold via id-mønstre, bevar eller opdater de mønstre eksplicit.

---

## 15. Når du tilføjer en ny builder

Følgende er normalt nødvendigt:

1. Implementér builder-funktionen i passende debug-modul under `src/domain/debug/`.
2. Tilføj builder-entry i `EO_DEBUG_BUILDERS`.
3. Hvis det er en ny sektion: opdater `SectionId` i `eoDebugNavigationMap.ts`.
4. Opdater `EODebug.tsx`, hvis sektionen skal have egen visningstitel, særfiltrering eller gruppering.
5. Opdater navigationen, hvis rækkernes id'er skal kunne navigeres fra Beregning-fanen.
6. Hvis builderen bruger `canonicalOutput`, håndtér `undefined` eksplicit.
7. Hvis builderen kalder en motor direkte, tilføj regressionstest for lovlige edge cases.

Det er altså ikke korrekt, at registry altid er det eneste sted der skal opdateres.

---

## 16. Væsentlige arkitektoniske forbedringsforslag

Følgende forbedringer er oplagte, men er ikke nødvendige for at forstå eller ændre den aktuelle løsning.

### A. Saml builder-execution ét sted

`eoSnapshotToDebugView` bør genbruge `executeEODebugBuilderEntries(...)` i stedet for at have sin egen kopi af exception-isolationen.

Gevinst:
- ét canonical sted for builder-execution
- mindre risiko for divergerende fejlformat

### B. Indfør et samlet domain-viewmodel for hele EO-debug

I stedet for at `eoSnapshotToDebugView` returnerer både `rowsBySection` og `regulationSections`, kan domænelaget eje én samlet debug-viewmodel, fx:

- klassiske row-sektioner
- reguleringssektioner
- eventuelle fremtidige særtabeller

Gevinst:
- gør det tydeligt, at registry kun dækker en delmængde af debug-output i dag
- reducerer behovet for UI-specifik sammensyning af flere datastrømme

### C. Flyt ansættelsesbaseret debug-gruppering ud af React-komponenten

`EODebug.tsx` udfører i dag væsentlig domænenær gruppering:
- løn pr. ansættelsesforhold
- regulering pr. ansættelsesforhold
- SFGG pr. ansættelsesforhold

Denne sammensyning bør på sigt ligge i domænelaget som en render-klar viewmodel.

Gevinst:
- mindre domænelogik i React
- lettere testbarhed
- færre id-baserede implicitte koblinger i UI-laget

### D. Gør relationen mellem `DebugRowModel.id` og section/employment eksplicit

I dag udleder UI flere strukturer fra regex på `id`.

På sigt kan det være mere robust at tilføje eksplicit metadata, fx:
- `section`
- `employmentId?`
- `kind?`

Gevinst:
- færre skjulte string-kontrakter
- mindre risiko for utilsigtede brud ved rename af id-mønstre

### E. Revider påstanden om "single source of truth" i aggregator-kommentarer

Kommentaren i `eoDebugRowAggregator.ts` bør blødgøres, så den præcist siger:
- builder-rækkerne kommer fra samme registry
- men EO-debug og Beregning-fanen har forskellig post-processing

Gevinst:
- mere præcis arkitekturforståelse
- mindre risiko for falsk tryghed ved senere ændringer

Dette gælder begge nuværende kommentarsteder i `eoDebugRowAggregator.ts`:
- fil-headeren
- JSDoc for `collectAllDebugRows`
