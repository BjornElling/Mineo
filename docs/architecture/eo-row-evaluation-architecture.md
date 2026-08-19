# Række-evaluerings- & kontrol-arkitektur

**Status:** Arkitekturforklarende reference, ikke selvstændig kontrakt
**Primært scope:** `src/domain/eoRowEvaluation/*` (række-evaluerings-motoren), `src/domain/eoInspektion/*` (kontrollag, DEV-synligt), `src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView.ts`, `src/components/pages/erstatningsopgoerelse/EOInspektion.tsx`

Dette dokument er et arbejdsredskab for ændringer i EO-række-evaluering og EO-kontrol. Bindende fejl-/diagnostikregler ligger i `src/contracts/error-contract.md` og EO-regler i `src/contracts/eo-snapshot-contract.md`.

> **Inputgrænsen er omlagt og gennemført (senest verificeret 2026-07-29).** Række-evalueringen modtager ÉN
> revisionskonsistent, ready reader-projektion med afledte strukturelle issues (`FieldIssueSet`) –
> `fieldErrors`-stores, rå canonical sektioner og fallback til skjulte recovery-værdier findes ikke, og de er
> forbudte som inputporte. Settingsafhængigheden er indsnævret til `EoRowPolicy` (de to
> regulerings-toggles), som samtidig er dokumentgatens gate-settings, så beregning og gate deler præcis
> samme politik. Bindende regler: `src/contracts/eo-snapshot-contract.md` og `src/contracts/error-contract.md`.

> **Lagfordeling – læs dette først.** Række-evaluerings-motoren (builder-registry + alle `buildEo…Rows` + aggregator + delte typer/helpers) ligger i den autoritative placering **`src/domain/eoRowEvaluation/`**, fordi den driver den trust-kritiske download-gate og derfor ikke må ligge i et nominelt "DEV"-lag. Dette er resultatet af arkitektur-kandidat B9 (2026-06-25), der flyttede motoren ud af det tidligere `src/domain/debug/`-lag og omdøbte symbolerne `eoDebug…`→`eoRow…` (fx `collectAllDebugRows`→`collectAllEoRows`, `DebugRowModel`→`EoRowModel`, `EO_DEBUG_BUILDERS`→`EO_ROW_BUILDERS`). I **`src/domain/eoInspektion/`** ligger det rene kontrollag (page-/regulerings-viewmodel, CSV, integritet, parity, sammentælling) – det importerer motoren, aldrig omvendt. Den sproglige oprydning (2026-07-02) omdøbte dette lag fra `debug` til `eoInspektion` og dets brugervendte faner til "EO-kontrol" og "Kontroltabel", fordi de er inspektions-/kontrolvisninger, ikke fejlsøgningsværktøjer. Generiske række-format-helpere i motoren bærer ikke længere et `Debug`-suffiks (fx `RowDay`, `RowCellValue`, `parseDanishToIso`); den private exception-isolerings-helper hedder `executeEoRowBuilderEntry`, og fallback-rækkens id er `eo.rowBuilder.<section>.exception`.

---

## 1. Formål

EO-kontrol skal vise afsluttede, revisionskonsistente, auditérbare og forklarlige oplysninger om sagen.

EO-kontrol er et visnings- og forklaringslag. Det er ikke den autoritative beregningspipeline.

Konsekvens:
- kontrollaget må gerne projektere, forklare og strukturere motorens resultater
- kontrollaget må ikke indføre alternative beregningsforudsætninger i strid med motoren
- kontrollaget må ikke gøre lovlige afsluttede input "forkerte" ved at kalde delmotorer på et for bredt eller forkert grundlag
- kontrollaget må gerne have fallback-visning uden `canonicalOutput`, men fallback må være tydeligt begrænset til forklaring og ikke udgive sig for at være autoritativ beregning

---

## 2. Faktisk systemstruktur

Den nuværende EO-kontrol består af to parallelle outputspor:

1. Builder-baserede `EoRowModel[]`
2. Reguleringssektioner (`RegulationInspektionSection[]`)

Det er vigtigt, fordi registry kun dækker spor 1.

### Dataflow for EO-kontrol-siden

```text
EoSnapshot
  ↓
eoSnapshotToInspektionView(...)
  ↓
bygger EoRowEvaluationContext
  ↓
executeEoRowBuilderEntriesBySection(EO_ROW_BUILDERS, ctx)
  ↓
rowsBySection: Map<SectionId, EoRowModel[]>

samtidig:

inspektionSnapshot.inspektionDays + ready kontrolprojektion + canonicalOutput?
  ↓
buildRegulationTimeline(...)
  ↓
buildRegulationInspektionSections(...)
  ↓
regulationSections: RegulationInspektionSection[]

til sidst:

buildEOInspektionPageViewModel(view, appSettings)
  ↓
EOInspektionPageViewModel (filtreret + grupperet)
  ↓
EOInspektion.tsx (ren renderer)
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

`EO_ROW_BUILDERS` er single source of truth for række-rækkerne, men ikke for hele EO-kontrolvisningen.

Det er derfor forkert at antage:
- at alt kontrol-output går gennem registry
- at en ny kontrol-sektion altid kun kræver én ændring i registry
- at EO-kontrol og Beregning-fanen er identiske consumers af række-output

De deler samme builder-kilde, men har forskellig efterbehandling.

---

## 3. Blokeringstilstande i `eoSnapshotToInspektionView`

`eoSnapshotToInspektionView` returnerer `kind: 'blocked'` i tre tilfælde:

1. Intet snapshot
2. `snapshot.status === 'fail_closed'`
3. Snapshot findes, men `inspektionSnapshot` mangler

Kun når `inspektionSnapshot` findes, returneres `kind: 'ready'`.

Ved `ready` bruger viewet altid værdierne fra `inspektionSnapshot` som revisionskonsistent kontrolgrundlag:
- `inspektionSnapshot.stamdataValues`
- `inspektionSnapshot.eoValues`
- `inspektionSnapshot.fieldErrors`
- `inspektionSnapshot.inspektionDays`

Det er korrekt og vigtigt, fordi kontrollaget ikke må læse rå eller stale input direkte fra `snapshot.input`, hvis
snapshot allerede indeholder et konsistent kontrolgrundlag. Et eventuelt audit-input må ikke eksponeres som en
consumer-bypass.

Der findes test for dette i `src/__tests__/domain/erstatningsopgoerelse/eoSnapshotToInspektionView.test.ts`.

---

## 4. EoRowEvaluationContext er canonical for builders

```ts
type EoRowEvaluationContext = {
  stamdataValues: StamdataValues;
  stamdataErrors: StamdataFieldIssues;          // = FieldIssueSet
  eoValues: ErstatningsopgoerelseValues;
  eoErrors: ErstatningsopgoerelseFieldIssues;   // = FieldIssueSet
  loenindkomstManuelReguleringInputErrors: LoenindkomstManuelReguleringInputErrors;
  rowPolicy: EoRowPolicy;                       // IKKE AppSettings – se noten under tabellen
  canonicalOutput?: EoCanonicalOutput;
  pdfModel?: EoModel;
};
```

Tre ting er værd at bemærke ved signaturen, fordi de hver især er en lukket fejlklasse:

1. **Fejlene er STRUKTURELLE `FieldIssueSet`s**, ikke en flad `issues`-liste og ikke et feltnavn→tekst-map.
   Et map med kun top-level feltnavne var blindt for røde RÆKKECELLER, så motoren regnede på readerens
   maskerede tomværdi (lukket med WI-004).
2. **`rowPolicy: EoRowPolicy` og ikke `appSettings: AppSettings`.** Række-evaluering er beregningslogik og må
   hverken kende UI-indstillinger eller dokument-layoutlaget. Typen er nominel med `projectEoRowPolicy` som
   eneste konstruktør, så hele `AppSettings` ikke kan flyde ind som struktur-supersæt.
3. **Ingen `revision` i konteksten.** Friskhed bæres af det `EvaluationSourceToken`, projektionen er bundet
   til, ikke af et felt buildere kunne læse.

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
- per-builder exception-isolation via den private `executeEoRowBuilderEntry`

Registryet eksponerer to udførelsesfunktioner:
- `executeEoRowBuilderEntries` – flat `EoRowModel[]`, bruges af Beregning-fanen
- `executeEoRowBuilderEntriesBySection` – `Map<SectionId, EoRowModel[]>`, bruges af EO-kontrol-siden

Registryet ejer ikke:
- reguleringssektioner
- viewmodel-sammensætning og filtrering pr. ansættelsesforhold (ejes af `eoInspektionPageViewModel.ts`)
- filtrering af irrelevante rækker i Beregning-fanen
- præsentationsspecifik rendering i `EOInspektion.tsx`

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

Fejl i en enkelt builder isoleres via `executeEoRowBuilderEntry` (privat helper i registry), som bruges af:
- `executeEoRowBuilderEntries` (flat output til Beregning-fanen)
- `executeEoRowBuilderEntriesBySection` (sektioneret output til EO-kontrol-siden)

`eoSnapshotToInspektionView` bruger `executeEoRowBuilderEntriesBySection(EO_ROW_BUILDERS, ctx)` og har ikke sin egen kopi af exception-isolationen.

Fallback-rækken er:
- id: `eo.rowBuilder.<section>.exception`
- label: `Fejl i række-builder (<section>)`
- status: `error`

Forventelige brugerinputtilstande må ikke kaste. Uventede builder-exceptions skal både isoleres som kontrol-række og rapporteres via central systemfejlrapportering med sanitiseret payload efter `error-contract.md`.

---

## 7. Hovedregel for `canonicalOutput`

Hvis en oplysning allerede findes i `canonicalOutput`, skal kontrollaget læse den derfra frem for at genberegne.

Rationale:
- reducerer divergens mellem kontrol og motor
- reducerer sandsynligheden for, at kontrollaget kalder delmotorer med forkert gating
- gør koblingen mellem autoritativ beregning og kontrol-forklaring eksplicit

### Nuværende builders med canonical-output-kobling

| Builder / modul | Læser fra canonical output | Når canonical mangler |
|---|---|---|
| `buildEoSvieSmerteRows` | `totals.svieSmerteOre`, `svieSmerte.maxApplied` | viser `'-'` for beregnet beløb |
| `buildEoTaftRows` | `taf.tidligereModtagetTafOre` | viser sikker ikke-beregnet værdi; ingen fallback til rå input |
| `buildEoSygeferiegodtgoerelseRows` | `periodiseringer.tafPerioder` | bruger kun en særskilt sikker kontrolprojektion, hvis snapshottet udtrykkeligt leverer den |
| `buildEoOevrigeKravRows` | `periodiseringer.tafPerioder` | bruger kun en særskilt sikker kontrolprojektion, hvis snapshottet udtrykkeligt leverer den |
| `buildRegulationInspektionSections` | `regulering.perAnsaettelse[*].loenudviklingSegmenter`, `periodiseringer.tafPerioder` | viser placeholders; ingen re-derivation fra rå data |

### Vigtig præcisering

Ikke alle kontrol-oplysninger findes i `canonicalOutput`, og ikke alle builders skal have `canonicalOutput`.

Reglen er:
- "når den autoritative værdi allerede findes i canonical output, skal kontrollaget bruge den"

---

## 8. Hvornår kontrollaget må kalde en motor direkte

Direkte motorkald i kontrollaget er kun forsvarligt når alle disse betingelser er opfyldt:

1. Den nødvendige information findes ikke allerede i `canonicalOutput`.
2. Builderen kan afgøre samme domæneforudsætninger som motoren kræver.
3. Gatingen sker på konkret domænesemantik, ikke på løse korrelationer.
4. Der findes regressionstest for lovlige edge cases, hvor motoren ikke må kaldes.

### Konkrete nuværende motorkald/faglige helpers i kontrollaget

- `buildEoOevrigeKravRows`
  - bruger `buildIncomeForRanges(...)`
- `buildEoTafBeregningsgrundlagRows`
  - bruger `buildBeregningsperiodeRange(...)` og `buildIncomeForRanges(...)`
- `buildRegulationInspektionSections`
  - kalder `buildReguleringIndexRows(...)`

At kontrollaget bruger disse helpers er ikke i sig selv et problem. Problemet opstår først, hvis kontrollaget bruger dem med bredere eller andre forudsætninger end de autoritative flows.

### Regulerings-kontrol projicerer motorens kanoniske forløb

`buildRegulationInspektionSections` (`src/domain/eoInspektion/eoInspektionRegulationViewModel.ts`)
bruger den delte rækkeprojektor `buildReguleringIndexRows(...)`. For former med en selvstændig
kildeserie modtager både denne projektor og `buildRegulationTimeline` motorens
`ReguleringForloeb` via EO-snapshotprojektionen; de må ikke genindlæse serien fra rå satsdata.

Kontrollaget beregner fortsat indeksforholdet uafhængigt ud fra den kanoniske serie. Det bevarer
krydskontrollens evne til at opdage fejl i motorens aritmetik uden at vedligeholde en parallel
kilderegel. Grænsen håndhæves af AST-reglen `domain/regulering-canonical-forloeb-boundary`.

---

## 9. Forbudt gating-mønster

Builders må ikke beslutte motorkald ud fra indirekte metadata, hvis metadataen også dækker lovlige undtagelser.

Forkert mønster:
- "overenskomsten har reguleringsdata"
- derfor: "kontrollaget må bygge lønudviklingsmodel"

Det er forkert, hvis en delmængde af disse overenskomster i virkeligheden bruger direkte sats og derfor ikke skal gennem lønudviklingsmodellen.

---

## 10. SFGG-builderen: læs det autoritative output frem for at kalde motoren

`buildEoSygeferiegodtgoerelseRows` er det bedste eksempel på §7-reglen – den bedste gating er den, der slet
ikke er nødvendig.

Builderen kalder **ikke** `buildLoenudviklingModel(...)` eller `computeSygeferiegodtgoerelse(...)`. Den tager
`(values, stamdata, canonicalOutput?, pdfModel?)` og læser resultatet dér, hvor det allerede er beregnet:
`pdfModel.tabtArbejdsfortjeneste.sygeferiegodtgoerelse`. De to motorer kaldes i dag kun ét sted –
`src/domain/erstatningsopgoerelse/engines/tafNettoBeregning.ts` – altså i den autoritative beregning, ikke i
kontrollaget.

Det er stærkere end en korrekt gating, fordi hele klassen af fejl forsvinder: en builder, der ikke kalder en
motor, kan hverken kalde den på et ugyldigt grundlag, kalde den med andre forudsætninger end beregningen, eller
komme til at producere et andet tal end det, dokumentet viser.

Mønstret at kopiere ved nye rækkebuildere er derfor: **find først ud af, om tallet allerede findes i
`canonicalOutput`/`pdfModel`.** Kun hvis det beviseligt ikke gør, kommer §9's fire betingelser for et motorkald
i kontrollaget i spil.

---

## 11. `EoRowModel`, stabile id'er og dependency-spec

```ts
type EoRowModel = {
  id: string;
  label: string;
  displayValue: string;
  status: EoRowStatus;
  message?: string;
  summaryText?: string;
  summaryDisplay?: 'default' | 'messageOnly';
  group?: EoRowGroup;
  dependsOn?: ReadonlyArray<DependencySpec>;
  focusTarget?: EoIssueFocusTarget;
  focusFieldHint?: EoIssueFieldHint;
};
```

`focusTarget` og `focusFieldHint` er rækkens fokus-kontrakt mod fejlboksen: de udpeger, hvor brugeren skal
sendes hen for at rette rækkens fejl.

### Regler

- `id` skal være semantisk stabilt og må ikke være positionsbaseret
- `dependsOn` er en domain-kontrakt, ikke kun UI-metadata
- child-rækker må kun dependsOn-reference eksisterende semantiske årsagsrækker
- prefix-baserede afhængigheder må kun bruges, når hele prefix-familien faktisk er en årsagsmængde

### Hvor bruges dette i dag

- `eoInspektionPageViewModel.ts` udleder ansættelsesforhold-id via regex på `id` (fx `loenindkomst.<id>.`, `sfgg.<felt>.<id>`)
- `eoRowNavigationMap.ts` bruger `id` til navigation
- `collectAllEoRows` bruger `dependsOn` til suppression i Beregning-fanen
- duplicate-id og dependency-cycle kaster fail-closed i `collectAllEoRows`

Arkitektonisk vurdering:
- dette er en god og relativt stringent kontrakt
- `dependsOn` er nu aktiv suppression-logik og ikke blot fremtidig metadata
- regex-baseret id-parsing i `eoInspektionPageViewModel.ts` er en skjult string-kontrakt: rename af et id-mønster kan bryde grupperingen uden typefejl

---

## 12. Post-processing-lag efter builders

Builder-output renderes ikke råt 1:1.

### I `eoInspektionPageViewModel.ts`

Domænelaget beregner en render-klar viewmodel:
- filtrerer svie/smerte-rækker baseret på `tidligereSsMax`
- filtrerer AES-rækker baseret på aktiv midlertidig/endelig EET
- filtrerer tomme/skjulte lønansættelser væk
- grupperer lønindkomst-rækker pr. ansættelsesforhold
- splitter løn-rækker og regulerings-rækker pr. ansættelsesforhold
- grupperer SFGG-rækker og parser tabeller ud af `displayValue`
- kobler `regulationSections` på ansættelsesforhold via id-konventioner
- returnerer `EOInspektionPageViewModel` med navngivne felter pr. sektion

`EOInspektion.tsx` er herefter en ren renderer uden domænelogik.

### I `collectAllEoRows`

Beregning-fanens domænelag gør følgende:
- tilføjer navigation-metadata
- filtrerer rækker væk som er irrelevante for den aktuelle EO-konfiguration
- finder duplicate ids og dependency-cycles (fail-closed)
- undertrykker afledte fejl/warnings via `dependsOn`

### Konsekvens

Builders producerer rå række-data. Hver consumer laver sin relevante post-processing. Det er to distinkte lag med forskellig semantik – de bør ikke forveksles.

---

## 13. Konsistensvurdering af nuværende opbygning

### Det der er konsistent og korrekt

- builder-rækker går konsekvent gennem `EO_ROW_BUILDERS`
- `EoRowEvaluationContext` bruges konsekvent som builder-input
- `canonicalOutput` prioriteres de steder, hvor autoritative værdier allerede findes
- exception-isolation er samlet i `executeEoRowBuilderEntry` og genbruges begge steder
- `EoRowModel.id` bruges konsekvent som stabil, semantisk nøgle
- `collectAllEoRows` kaster (fail-closed) ved duplicate ids og dependency-cycles
- duplicate-id-checket kører før relevans-filtrering: et globalt duplikat opdages selv om rækkerne ville være filtreret væk som irrelevante; dette er bevidst byggefejl-detektion
- SFGG-builderen har domænekorrekt gating for lønudviklingsmodellen
- domænenær gruppering og filtrering er rykket ud af `EOInspektion.tsx` til `eoInspektionPageViewModel.ts`

### Det der ikke er fuldt konsistent

- regulerings-kontrol ligger uden for builder-registryet og er ikke en `EoRowModel`-sektion
- `eoInspektionPageViewModel.ts` parser ansættelsesforhold-id via regex på row-ids – det er en skjult string-kontrakt uden typesikring
- registry er single source of truth for selve række-rækkerne, men ikke for hele EO-kontrolvisningen (regulerings-sektioner, viewmodel-sammensætning og navigation ligger udenfor); en ny builder-sektion kræver derfor typisk ændringer flere steder (jf. §14–§15)

---

## 14. Praktisk tjekliste ved ændringer

Før du ændrer eller tilføjer kontrol-output:

1. Find ud af, om ændringen er en `EoRowModel`-sektion eller en `RegulationInspektionSection`-agtig særstruktur.
2. Hvis værdien allerede findes i `canonicalOutput`, brug den derfra.
3. Hvis ikke: undersøg om der findes en eksisterende ren helper før du kalder en tung motor.
4. Hvis kontrollaget skal kalde en motor, dokumentér den konkrete gating og skriv regressionstest.
5. Vurder om `dependsOn` skal sættes for at undgå dobbeltfejl i Beregning-fanen.
6. Kontroller at `id` er semantisk stabilt og navigerbart eller bevidst `unsupported`.
7. Kontroller begge consumers:
   - `eoSnapshotToInspektionView` → `buildEOInspektionPageViewModel` → `EOInspektion.tsx`
   - `collectAllEoRows` → Beregning-fanen
8. Hvis du tilføjer en ny section-id, opdater også `SectionId` i `eoRowNavigationMap.ts`.
9. Hvis `eoInspektionPageViewModel.ts` henter rækker fra den nye sektion, opdater `buildEOInspektionPageViewModel`.
10. Hvis id-mønstret for den nye sektion bruges til at udlede ansættelsesforhold-id, opdater regex-parserne i `eoInspektionPageViewModel.ts` eksplicit.

---

## 15. Når du tilføjer en ny builder

Følg §14's tjekliste. Registry er single source of truth for builder execution order/wiring, men det er ikke hele ændringsscopet.

En ny builder kræver typisk også vurdering af `SectionId`, navigation, viewmodel, rendering og tests. Det konkrete scope afhænger af, om outputtet er en almindelig `EoRowModel`-sektion eller en særstruktur.

---

## 16. Udestående teknisk gæld

### A. Regex-baseret id-parsing i `eoInspektionPageViewModel.ts`

Se afsnit 11 og 13. En mere robust løsning ville være eksplicit metadata på `EoRowModel` (fx `employmentId?: string`). Udestår som forbedring.

### B. `EOInspektionPageViewModel` eksponerer både rows og synlighedsflag

Viewmodellen returnerer i dag både:
- sektionernes rækker
- eksplicitte synlighedsflag som `showSvieSmerteSection` og `showTabtArbejdsfortjenesteSections`

Separate boolean flags er accepteret som permanent mønster for brede tværgående domænegates, hvor fravær ikke kan udtrykkes sikkert af sektionens dataform alene.

Almindelige nye sektioner skal som udgangspunkt være strukturelt til stede/fraværende i viewmodellen eller have tomme arrays. De må ikke kopiere flagmønsteret uden begrundelse.
