# Implementeringsplan: Offentlige ydelser som hypotetisk indkomst i erstatningsperioden

**Dato:** 2026-05-18  
**Status:** Plan – ikke implementeret  
**Forfatter:** Code review + analyse

---

## Kontekst og rootårsag

`buildPerAnsaettelseModel()` i `loenudviklingBeregning.ts` itererer kun over `income.employers` og ignorerer `income.benefits` fuldstændigt. Alle offentlige ydelser i beregningsperioden projiceres derfor aldrig fremad som hypotetisk indkomst. TAF-formlen bliver strukturelt skæv: fradraget (`tafIndtaegter`) indeholder ydelserne, mens hypotetisk indkomst (`loenudvikling`) ikke gør det.

TAF-formlen som den *burde* se ud:

```text
TAF = (loenudvikling.total + offentligeYdelserUdvikling.total) − tafIndtaegter.total − sfgg.total
```

---

## Designprincipper

- Offentlige ydelser i beregningsperioden behandles som én indkomstkomponent per ydelsestype.
- Regulering sker med den årlige reguleringsprocent per 1. januar — den samme procent der anvendes på tværs af området, herunder i EAL § 15 og ASL § 25. For offentlige ydelser specifikt svarer procenten til tilpasningsprocenten + 2 %, svarende til den almene statslige regulering af offentlige ydelser. Det er forkert at omtale reguleringen som "lovbestemt EAL-regulering" — hjemlen for offentlige ydelsers regulering er ikke EAL. Kode og UI-tekster skal undgå EAL-reference for offentlige ydelsers vedkommende. Kode må ikke oprette en ny rates-tabel — genbrug `reguleringssats` fra `src/data/lovbestemteRates.ts`.
- `LoenudviklingSegment` genbruges uændret for benefit-segmenter. Al eksisterende segment-rendering i PDF og debug er herved direkte genanvendelig.
- Base-dato, divisor og beregningsenhed er præcis de samme parametre som for løn — ingen divergens.
- `offentligeYdelserUdvikling === null` er en gyldig tilstand (ingen ydelser, angivet-løn-sti, mv.).
- Eksisterende `.eo`-filer loader uændret via Zod-defaults på nye skema-felter: `regulerOffentligeYdelser` bruger `.default('Ja')` og `eoBilagSelection.offentligeYdelserRegulering` bruger `.default(true)`.
- Aggregation i `buildIncomeForRanges()` bruger `typeKey` som nøgle. Motoren skal gruppere på `typeKey`, ikke label. For `typeKey === 'andet'` bruger motoren det kanoniske label fra `ydelsestyper.andet.label` — ikke første fritekst-label. To rækker med samme `typeKey` men forskellig fritekst-label aggregeres til én entry, så output er rækkefølge-uafhængigt. Fritekst-labels bevares evt. i et separat detail-/auditfelt, men aldrig som den aggregerede entry-label.
- Alle render-helpers der tager `LoenudviklingSegment` skal have eksplicit kontekst: `sourceKind: 'loen' | 'offentligYdelse'`, label for enhed ("Ydelse pr. måned"/"Ydelse pr. arbejdsdag"), og total-label ("I alt [ydelsestype]", "Samlet offentlige ydelser (hypotetisk)"). User-facing tekst må aldrig kalde dagpenge for løn.

---

## Afhængighedsgraf

```text
Stadium 1 (typer + schema)
  └─ Blokkerer alt andet

Stadium 2 (beregningsmotor)
  └─ Kræver stadium 1
  └─ Blokkerer 3, 4, 6, 7, 8

Stadium 3 (tafPerYear)            — kræver 1, 2
Stadium 4 (snapshot + output)     — kræver 1, 2
Stadium 5 (UI-toggle)             — kræver kun 1, kan paralleliseres med 2
Stadium 6 (debug)                 — kræver 2, 4
Stadium 7 (PDF hoveds-TAF)        — kræver 2, 4
Stadium 8 (PDF regulerings-bilag) — kræver 2, 4, 7
```

---

## Stadium 0 — Test-sikring (skal udføres FØR kodeændringer)

Skriv eller verificér følgende tests i `src/__tests__/` inden ændringerne i stadium 2+ påbegyndes.

### 0.1 Basis-regression: beregningsperiode uden ydelser

Scenarie: `beregnesUdFra === 'Beregningsperiode'`, ingen `offentligeYdelserRows`. TAF-totalen skal give samme resultat som i dag. Testen skal bestå uændret efter fix.

### 0.2 Nuværende fejltilstand

Scenarie: beregningsperiode med én ydelsestype (f.eks. dagpenge). Dokumentér at `offentligeYdelserUdvikling` er `null` i dag og at TAF derfor er for lav.

Workflow:
1. Tilføj testen som `test.fails()` eller `it.todo()` med eksplicit kommentar om at den beskriver den aktuelle fejltilstand. Test-suiten forbliver grøn under arbejdet.
2. Under implementering: konverter testen til en almindelig `it(...)` og opdater forventningen til den korrekte nye adfærd.
3. Ved handoff: der må ikke stå en `test.fails()` tilbage for den implementerede feature — ellers accepteres den gamle fejltilstand som forventet adfærd.

### 0.3 Schema-backward-kompatibilitet

Verificér at eksisterende snapshot uden `regulerOffentligeYdelser` loader med `'Ja'` som default via Zod. Test også eksisterende snapshot med `eoBilagSelection` til stede men uden `offentligeYdelserRegulering` — dette er den mest sandsynlige gamle `.eo`-form, og den skal parses uden advarsel.

### 0.4 TafPerYear afrundingsinvariant

`sumYearTafOre` vs. `samletTafKravOre` må maks afvige 100 øre. Test scenarier med benefit-segmenter. Dæk både måneds- og arbejdsdage-sporet. Arbejdsdage-sporet er ikke blot en afrundingsrisiko — det er en potentiel korrekthedsfejl (se SP-3).

---

## Stadium 1 — Typer og schema

### 1.1 Nye model-typer i `src/domain/erstatningsopgoerelse/shared/eoTypes.ts`

Tilføj umiddelbart efter `LoenudviklingModel`:

```typescript
export type OffentligeYdelserUdviklingEntry = Readonly<{
  typeKey: string;
  label: string;
  beregnedeSegmenter: readonly LoenudviklingSegment[];
  total: Calculable<MoneyOre>;
}>;

export type OffentligeYdelserUdviklingModel = Readonly<{
  reguleringsLabel: string;
  reguleringsBaseIso: ISODateString | undefined;
  beregningsenhed: TafBeregningsenhed;
  entries: readonly OffentligeYdelserUdviklingEntry[];
  total: Calculable<MoneyOre>;
}>;
```

`total` er `Calculable<MoneyOre>` — samme mønster som `LoenudviklingModel.loenudviklingTotal`. TAF-formlen i 2.3 skal unwrappe via `.value` med status-check, ikke bruge `?.total ?? 0` direkte. `beregningsenhed` er eksplicit i modellen, så PDF/debug/TAF-per-år ikke behøver inferere den fra segmentindhold. `LoenudviklingSegment` genbruges uændret — der oprettes ingen parallelle segment-typer.

### 1.2 Udvid `TabtArbejdsfortjenesteModel` i `eoTypes.ts`

Tilføj feltet direkte efter `loenudvikling`:

```typescript
offentligeYdelserUdvikling: OffentligeYdelserUdviklingModel | null;
```

### 1.3 Udvid `TafNettoBeregningResult` i `engines/tafNettoBeregning.ts`

Tilføj til result-typen:

```typescript
offentligeYdelserUdvikling: OffentligeYdelserUdviklingModel | null;
```

### 1.4 Nyt schema-felt i `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts`

Tilføj til `erstatningsopgoerelseBaseSchema`:

```typescript
regulerOffentligeYdelser: jaNejEnum.default('Ja'),
```

Konventionen følger `midlertidigtEetFraEetSiden` (jaNejEnum med default). Eksplicit initial value i `erstatningsopgoerelseInitialValues.ts` er nødvendig for auditérbarhed og matcher eksisterende mønster (se 5.2).

### 1.5 Nyt bilag-flag i `eoBilagSelectionSchema`

Tilføj til `eoBilagSelectionSchema`:

```typescript
offentligeYdelserRegulering: z.boolean().default(true),
```

Tilføj `'offentligeYdelserRegulering'` til `EO_BILAG_DYNAMIC_SELECTION_KEYS` i `helpers/eoBilagRules.ts`. Opdater også: default-objektet i `eoBilagSelectionSchema.default(...)`, initial values i `erstatningsopgoerelseInitialValues.ts`, fallbacken i `EOberegningTab.tsx`, PDF selected-elements typen i `src/pdf/domains/eo/types.ts`, samt relevante test fixtures der konstruerer `eoBilagSelection` manuelt. Ellers opstår typefejl eller skjult fallback-adfærd.

### 1.6 Nyt felt i `TafPerYearSource` i `engines/tafPerYearDerived.ts`

```typescript
offentligeYdelserUdvikling: OffentligeYdelserUdviklingModel | null;
```

---

## Stadium 2 — Beregningsmotor

### 2.1 Ny fil: `src/domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning.ts`

Filen er strukturelt parallel med den lovbestemte regulerings-sti i `loenudviklingBeregning.ts`.

**Input-parametre:**

| Parameter | Type | Kilde |
|---|---|---|
| `incomeForBeregningsperiode` | `IncomePeriodResult` | Fra `computeTafNettoBeregning` — efter transient EET-injection (se 2.3) |
| `divisor` | `number` | `indkomstSkadestidspunkt.maaneder` eller `.arbejdsdage` |
| `tafBeregningsenhed` | `TafBeregningsenhed` | Fra `computeTafNettoBeregning` |
| `tafRanges` | `readonly IsoRange[]` | Fra `computeTafNettoBeregning` |
| `tafArbejdsdageSet` | `ReadonlySet<ISODateString> \| null` | Kun ved arbejdsdage-spor |
| `reguler` | `boolean` | `values.regulerOffentligeYdelser === 'Ja'` |
| `reguleringsBaseIso` | `ISODateString \| undefined` | Se 2.2 |

**Reguleringslogik:**

Reguleringen bruger den årlige reguleringsprocent per 1. januar fra `src/data/lovbestemteRates.ts` (`reguleringssats`). Kumulativt indeks fra base-dato:

```text
index(base-år)  = 100
index(år n)     = index(år n-1) × (1 + reguleringssats[år n] / 100)
deltaPct(segment) = (index(segment.år) / 100 − 1) × 100
```

Breakpoints i TAF-ranges: 1. januar hvert kalenderår som falder inden for TAF-rangene og er efter base-dato.

**Årskonvention — off-by-one:** Verificér årskonventionen konkret med en test inden motoren skrives: base-dato i 2023 → segmenter i 2023 har 0 %, segmenter i 2024 har 2024-satsen, segmenter i 2025 har 2024 × 2025 kumulativt.

**Manglende fremtidige satser:** Hvis TAF-perioden rækker ud over seneste år i `reguleringssats`-tabellen, må motoren ikke returnere 0 % eller genbruge seneste kendte sats. Kast invariant-fejl — snapshot-orchestreringen omsætter det til `runtime_exception`. Validator/preflight skal dog checke dette inden motoren kaldes, betinget af toggle-state: når `regulerOffentligeYdelser === 'Ja'` og der faktisk er benefits, skal validator blokere hvis TAF-periodens slutår overskrider seneste satsår. Når `regulerOffentligeYdelser === 'Nej'`, er 0 % regulering intentionel og manglende fremtidige satser blokerer ikke. Engine-throw er altid det fail-closed forsvar, men `eo-snapshot-contract.md` §3.3 siger, at engine-throws på forventelige inputfejl er huller i preflight-dækningen. Tests skal primært forvente en validation-/invariant-fejl, ikke `runtime_exception`.

**Per ydelsestype:**

For hvert `typeKey` i `incomeForBeregningsperiode.benefits`:

```text
baseSatsPerUnit = benefit.amount / divisor
```

Motorens første handling efter divisionen er `roundIncomeBenefitAmountKroner()` — præcis som fradragssiden. `midlertidigt_eet` fra EET-injection er allerede heltal-afrundet ved injektion; rå division kan give floating-point-rester der producerer øre-/kroneafvigelser. Byg derefter segmenter med `segmentAmountOre(baseSatsPerUnit, quantity, deltaPct)` — præcis samme helper som løn.

**Divisor <= 0:** Returnér ikke `null` når benefits findes men divisor er ugyldig — det er et brudt beregningsgrundlag. Kast invariant-fejl analogt med lønudviklingens "mangler beregningsgrundlag". `null` reserveres til "ingen relevant benefit-data" eller "stien beregner ikke ydelsesudvikling".

Returtype: `OffentligeYdelserUdviklingModel | null`. Returnerer `null` hvis `benefits` er tom.

**Invariant-note:** Alle throw-stier dokumenteres analogt med invariant-noten i `loenudviklingBeregning.ts` (linjerne ~61-67).

Når `reguler === false`: `deltaPct = 0` for alle segmenter, `reguleringsLabel = 'Ingen'`.

### 2.2 Regulerings-base-dato

Base-dato bestemmes via `resolveAnvendtReguleringsdato` med samme parametre som løn. For `beregnesUdFra === 'Beregningsperiode'` er dette typisk `tafBeregningsperiodeTil`. Dette sikrer at løn og offentlige ydelser reguleres fra præcis samme dato.

`resolveAnvendtReguleringsdato` er ikke eksporteret direkte fra `eoSharedUtils.ts` med EO-værdi-signatur — lønmotoren har en lokal wrapper der kalder `resolveAnvendtReguleringsdatoShared` + `getAngivetLoenOpreguleresFraDato()`. Den nye motor må ikke importere fra `loenudviklingBeregning.ts` — det skaber motor-til-motor-afhængighed. Flyt en fælles EO-specifik wrapper til `eoSharedUtils.ts` eller `engines/reguleringsBaseUtils.ts`.

### 2.3 Opdater `computeTafNettoBeregning` i `engines/tafNettoBeregning.ts`

Den nye motor skal modtage effektive EO-værdier efter `buildEoValuesWithTransientMidlertidigtEet(...)` — samme effektive input som de øvrige snapshot-engines. Derved er fradragssiden og den nye positive benefit-udvikling konsistent. `snapshot.input.erstatningsopgoerelse` forbliver den oprindelige committed state. Hvis SP-2 ender med at `midlertidigt_eet` skal udelukkes fra positiv ydelsesudvikling, skal udelukkelsen ske som et eksplicit filter i den nye motor — ikke ved at omgå transient injection globalt.

**Kald ny motor** umiddelbart efter `buildLoenudviklingModel`. Beregningsrækkefølgen er:
1. byg `loenudvikling`
2. byg `offentligeYdelserUdvikling`
3. byg `tafIndtaegter`
4. byg `sygeferiegodtgoerelse`
5. beregn TAF-totalen

```typescript
const offentligeYdelserUdvikling = harTafPerioder && incomeForBeregningsperiode
  ? buildOffentligeYdelserUdviklingModel({
      incomeForBeregningsperiode,
      divisor: /* maaneder eller arbejdsdage fra indkomstSkadestidspunkt */,
      tafBeregningsenhed,
      tafRanges,
      tafArbejdsdageSet: /* kun ved arbejdsdage-spor */,
      reguler: values.regulerOffentligeYdelser === 'Ja',
      reguleringsBaseIso: /* fra resolveAnvendtReguleringsdato */,
    })
  : null;
```

**Opdater TAF-formlen** med eksplicit status-check og `.value`-unwrapping:

```typescript
const offentligeYdelserTotal = offentligeYdelserUdvikling?.total;
if (loenTotal.status !== 'ok' || indtaegterTotal.status !== 'ok') {
  // eksisterende defensive guard-retur
}
// offentligeYdelserTotal.status !== 'ok' behandles analogt:
// returnér early med tabtArbejdsfortjenesteOre = 0 (fail-closed)
tabtArbejdsfortjenesteOre = clampMoneyOreToZero(
  ensureMoneyOre(
    loenTotal.value
    + (offentligeYdelserTotal?.status === 'ok' ? offentligeYdelserTotal.value : 0)
    - indtaegterTotal.value
    - sygeferiegodtgoerelse.totalOre
  )
);
```

Hvis `offentligeYdelserTotal?.status !== 'ok'`, skal beregningen ikke implicit behandle det som 0 kr. — det er et beregningsfejl-scenario der bør returnere early analogt med de øvrige guards. Implicitly 0 tolereres kun hvis der ingen benefits er (dvs. modellen er `null`).

Tilføj `offentligeYdelserUdvikling` til return-objektet. Opdater alle defensive early returns i `computeTafNettoBeregning()`, så `offentligeYdelserUdvikling` altid returneres i alle grene.

SFGG må fortsat kun bruge løn-/ansættelsesbaserede segmenter via `buildSfggLoenudviklingMap()`. Benefit-segmenter må ikke utilsigtet blive del af SFGG-referencegrundlaget.

---

## Stadium 3 — TafPerYear integration

### 3.1 Opdater `TafPerYearSource` (`engines/tafPerYearDerived.ts`)

Tilføj `offentligeYdelserUdvikling: OffentligeYdelserUdviklingModel | null`.

### 3.2 Opdater `buildTafPerYearSourceFromComputed`

```typescript
offentligeYdelserUdvikling: args.tafNetto.offentligeYdelserUdvikling,
```

### 3.3 Opdater `buildTafPerYearBuildOutcome` — `TafYearSegment` og benefit-segmenter

`TafYearSegment` mangler et `sourceLabel`-felt. Tilføj det, og sæt lønsegmenters label til ansættelsesforholdets navn (eksisterende adfærd bevares). Dette er en **breaking type-ændring** der rammer al kode der konstruerer eller læser år-segmenter, herunder tests — det skal fremgå eksplicit af fillisten.

For hvert kalenderår tilføjes benefit-segmenter til `segments`-arrayet, analogt med løn-segmenterne. `buildSubSegment` modtager en `LoenudviklingSegment` — da benefit-segmenter er af præcis samme type, genbruges funktionen direkte.

Iterationsrækkefølge: løn-segmenter først, benefit-segmenter per type derefter. Label på benefit-segmenter: ydelsens `label`-felt fra `OffentligeYdelserUdviklingEntry`.

Fradragssiden ændres ikke — `tafIndtaegter` fradrager fortsat faktisk modtagne ydelser.

Når `offentligeYdelserUdvikling` er null, skal eksisterende `missing_loenudvikling`-semantik ikke ændres. Hvis løn mangler men der kun findes offentlige ydelser, er det en domæneafklaring der ikke stilles skarpt inden SP-1/SP-3 er afklaret.

---

## Stadium 4 — Snapshot og canonical output

### 4.1 `snapshot/eoPresentationSectionBuilders.ts`

Tilføj `offentligeYdelserUdvikling` fra `tafNetto` til `TabtArbejdsfortjenesteModel`. Opdater fallback/default-modellen i samme fil — `offentligeYdelserUdvikling` skal være eksplicit `null` i fallback, så renderere ikke behøver håndtere `undefined`.

### 4.2 `snapshot/eoCanonicalOutput.ts`

Udvid med `offentligeYdelserUdviklingOre`. Dette er ikke blot nyttigt — det er nødvendigt for at parity-tests kan auditere det nye positive TAF-led. Opdater `collectSammentaellingControlMismatchMessages()` og de debug-sammentællingsrækker der bruges til kontrolmismatch i samme ændring. Ellers kan snapshot-invarianten enten blive falsk positiv (debug total mangler det nye positive led) eller falsk negativ.

Tilføj målrettede parity-tests:
- EO-totalen inkluderer lønudvikling + offentlige ydelser-udvikling − fradrag − SFGG.
- Debug-sammentælling, canonical output og PDF-model bruger samme positive ydelsesled.
- En test med `regulerOffentligeYdelser === 'Nej'` viser at ydelsen stadig indgår positivt, men uden delta.

### 4.3 `snapshot/eoSnapshotToEoPdfDocument.ts`

Nyt bilag i output-listen betinget af `eoBilagSelection.offentligeYdelserRegulering && offentligeYdelserUdvikling !== null && entries.length > 0`.

### 4.4 `snapshot/eoSnapshotToTafPerYearPdfDocument.ts`

Benefit-segmenter vises i TAF-fordelt-PDF analogt med løn.

---

## Stadium 5 — UI: Toggle

### 5.1 Placering: `EOOplysningerTab.tsx`

Togglen placeres i `EOOplysningerTab.tsx` — **ikke** på `OffentligeYdelserTab.tsx`. Togglen styrer **udelukkende** `regulerOffentligeYdelser` og har ingen relation til lønudviklingen under nogen omstændigheder.

**Case A: `beregnesUdFra === 'Beregningsperiode'`**

Indsættes som en ny `Box className="row--label-right-hover"` direkte efter blokken der afslutter dato-felterne for "Periode til beregning af før-løn" (efter linje ~1712 i nuværende fil), og før `<Typography className="row--subheading">Ferie i beregningsperioden:</Typography>`:

```tsx
{values.beregnesUdFra === 'Beregningsperiode' && (
  <>
    {/* ... dato-felter for beregningsperiode ... */}

    <Box className="row--label-right-hover">
      <Typography className="row--text">
        Regulering af offentlige ydelser i EO
      </Typography>
      <Box className="row--label-right-hover__content">
        {/* StyledToggleSwitch med onCommit */}
      </Box>
    </Box>

    <Typography className="row--subheading">Ferie i beregningsperioden:</Typography>
    {/* ... */}
  </>
)}
```

**Case B: `beregnesUdFra === 'Angivet månedsløn'` eller `'Angivet dagsløn'`**

Togglen vises ikke. Der er ingen `incomeForBeregningsperiode.benefits` at projicere på disse stier, og en synlig kontrol uden beregningseffekt er vildledende i et trust-kritisk værktøj. Se SP-1 for evt. fremtidig udvidelse.

**Fælles specifikation (kun Case A):**

- Label til venstre: **"Regulering af offentlige ydelser i EO"**
- Default: `true` (`'Ja'`)
- Komponent: `StyledToggleSwitch` med `onCommit` — samme immediate-commit-undtagelse som øvrige ja/nej-felter i `EOOplysningerTab.tsx`
- `InfoTooltipIcon` med tekst: *"Når feltet er slået til, fremskrives offentlige ydelser fra beregningsperioden med tilpasningsprocenten + 2 % per 1. januar, svarende til den almene statslige regulering af offentlige ydelser. Slå fra, hvis ydelserne skal medtages uden regulering."*

### 5.2 `helpers/erstatningsopgoerelseInitialValues.ts`

Tilføj eksplicit:

```typescript
regulerOffentligeYdelser: 'Ja',
```

### 5.3 Atomisk commit

Toggle-ændring committes atomisk i `setEOValues` — ingen afhængigheder af andre felter ved skift.

---

## Stadium 6 — EODebug integration

### 6.1 Ny fil: `src/domain/debug/eoDebugOffentligeYdelserRegulationCore.ts`

Parallel med `eoDebugRegulationViewModel.ts`. Bygger en `RegulationIndexTimeline`-lignende struktur for benefit-typer: for hvert år i TAF-perioden: reguleringsats, akkumuleret indeks.

### 6.2 Udvid `eoDebugRegulationViewModel.ts`

Tilføj `buildOffentligeYdelserRegulationSections()` der producerer `RegulationDebugSection[]` for benefit-typer. Sektionerne viser — analogt med løn:

- Basis-dato for regulering
- Per ydelsestype: tabel med kolonnerne Fra | Til | Basissats | Regulering% | Akkumuleret | Beløb

Den nye core-fil må kun eje benefit-specifik timeline-beregning. `buildOffentligeYdelserRegulationSections()` producerer output i eksisterende `RegulationDebugSection[]`-format, så `EODebugRegulationSections` kan rendere det uden ændringer.

### 6.3 `domain/debug/eoDebugBuilderRegistry.ts`

Registrér ny builder under sektionen `'offentligeYdelserRegulering'`.

### 6.4 `components/pages/erstatningsopgoerelse/EODebug.tsx`

Tilføj ny `EODebugRegulationSections`-sektion med titlen *"Regulering af offentlige ydelser"*. Renderes betinget når `offentligeYdelserUdvikling !== null && entries.length > 0`. Opdater `eoDebugNavigationMap.ts`, `eoDebugPageViewModel.ts` og relevante debug-row aggregation tests, så sektionen er fuldt integreret i debug-navigationen.

---

## Stadium 7 — PDF: Hoveds-TAF-sektion (opgørelses-PDF)

### 7.1 `src/pdf/domains/eo/sections/opgoerelseSection.ts`

I sektionen *"Indkomst, hvis skaden ikke var indtrådt"* tilføjes benefit-posterne direkte efter løn-posterne med `sourceKind: 'offentligYdelse'`. Struktureksempel:

```text
Løn (Arbejdsstedsnavn):
  [segmenter for løn]
  I alt løn: XX.XXX kr.

Dagpenge:
  [segmenter for dagpenge]
  I alt dagpenge: X.XXX kr.

Sygedagpenge:
  [segmenter]
  I alt sygedagpenge: X.XXX kr.

Samlet indkomst, hvis skaden ikke var sket: XX.XXX kr.
```

Hvis `renderLoenudviklingSegments` hardcoder lønterminologi, parameteriseres den med unit-labels ("Ydelse pr. måned"/"Ydelse pr. arbejdsdag") eller suppleres med en benefit-specifik wrapper.

### 7.2 Opdater intro-tekst

Ændres fra:

> *"Beregnes som [loenSkadedatoText] tillagt efterfølgende lønstigninger"*

til (konditionelt):

> *"Beregnes som [loenSkadedatoText] tillagt efterfølgende lønstigninger samt offentlige ydelser [med/uden] statslig regulering per 1. januar"*

Opret hjælpefunktion `resolveIndkomstBeregningsText` i stedet for at udvide `resolveLoenSkadedatoText` — adskil ansvaret. Brug konsekvent "offentlige ydelser" — ikke "sociale ydelser" — i alle PDF-tekster.

---

## Stadium 8 — PDF: Ny reguleringsvedhæftning for offentlige ydelser

### 8.1 Ny fil: `src/pdf/domains/eo/offentligeYdelserReguleringPdf.ts`

Placering følger det moderne `src/pdf/domains/eo/`-mønster. Opdater `pdf/infrastructure/pdfLoader.ts` og `pdfService.ts` hvis bilaget skal lazy-loades eller downloades separat.

**Struktur:**

```text
Side-hoved: "Regulering af offentlige ydelser"
Periode: [tafRanges]
Skadelidtens navn

For hver ydelsestype:
  Overskrift: "[Ydelsestype-label] – regulering fra [base-dato]"

  Tabel 1: Reguleringsindeks
  | Fra        | Til        | Sats    | Akkumuleret indeks |
  | 01-01-2024 | 31-12-2024 | +3,5 %  | 103,50             |
  | 01-01-2025 | 31-12-2025 | +3,9 %  | 107,54             |
  | 01-01-2026 | –          | +4,8 %  | 112,70             |

  Tabel 2: Beregningsresultat per segment
  [Samme format som lønsegmenter: Fra – Til: N måneder á X kr. × (100% + Y%) = Z kr.]

  I alt [Ydelsestype-label]: Z.ZZZ kr.

[Ny side per ydelsestype ved mange rækker]
Samlet offentlige ydelser (hypotetisk): XX.XXX kr.

[Footer-tekst — altid til stede når bilaget renderes:]
"Offentlige ydelser fremskrives årligt per 1. januar med tilpasningsprocenten + 2 %,
svarende til den almene statslige regulering af offentlige ydelser."
```

Footer-teksten skrives én gang nederst på bilaget — ikke per ydelsestype — via `writer.addSectionSpacer()` + `safeAddWrappedText(...)`, analogt med de eksisterende footer-blokke i `reguleringSection.ts` (linjerne ~486-506). Teksten er ikke betinget af regulerings-toggle-state: bilaget eksisterer kun når regulering er slået til, så footeren er altid relevant.

### 8.2 Integration i `pdf/domains/eo/erstatningsopgoerelsePdf.ts`

Tilføj bilag betinget af `eoBilagSelection.offentligeYdelserRegulering && offentligeYdelserUdvikling !== null && entries.length > 0`.

### 8.3 Bilag-tilgængelighed i `helpers/eoBilagRules.ts`

Tilføj availability-check for `'offentligeYdelserRegulering'` i `getEoBilagAvailability`. Baseres udelukkende på committed input — ikke på computed snapshot:

Enable kun bilaget når alle disse betingelser er opfyldt:
- `beregnesUdFra === 'Beregningsperiode'`
- gyldig beregningsperiode
- mindst én fejl-fri offentlig ydelsesrække med positivt beløb og overlap mod beregningsperioden
- mindst én TAF-periode efter clamping
- nødvendig divisor er beregnelig
- hvis regulering er slået til: nødvendige reguleringssatser findes for TAF-periodens slutår

Rendering gates stadig på `offentligeYdelserUdvikling !== null && entries.length > 0`. Disabled reason skal skelne: "ingen ydelsesrækker", "ingen TAF-perioder", "beregning ikke mulig".

```typescript
offentligeYdelserRegulering: hasOffentligeYdelserReguleringData
  ? { enabled: true }
  : {
      enabled: false,
      disabledReason: /* kontekstspecifik besked */,
    },
```

---

## Komplet filliste

| Fil | Ændring |
|---|---|
| `shared/eoTypes.ts` | Nye typer `OffentligeYdelserUdviklingEntry`, `OffentligeYdelserUdviklingModel`; udvid `TabtArbejdsfortjenesteModel` |
| `engines/tafNettoBeregning.ts` | Kald ny motor, opdater formel og result-type |
| `engines/tafPerYearDerived.ts` | Benefit-segmenter i år-opdeling; nyt felt i `TafPerYearSource`; `TafYearSegment` udvides med `sourceLabel` — breaking type-ændring der rammer alle konstruktører og tests af år-segmenter |
| `schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts` | `regulerOffentligeYdelser`, `eoBilagSelection.offentligeYdelserRegulering` |
| `helpers/erstatningsopgoerelseInitialValues.ts` | Initial values for nye felter |
| `helpers/eoBilagRules.ts` | `'offentligeYdelserRegulering'` i `EO_BILAG_DYNAMIC_SELECTION_KEYS`, availability-check |
| `snapshot/eoPresentationSectionBuilders.ts` | `offentligeYdelserUdvikling` i `TabtArbejdsfortjenesteModel` og fallback-model |
| `snapshot/eoSnapshot.ts` | Videresend `regulerOffentligeYdelser` fra `values` til beregningsmotor-kaldet |
| `snapshot/eoCanonicalOutput.ts` | `offentligeYdelserUdviklingOre`; opdater `collectSammentaellingControlMismatchMessages()` og debug-sammentællingsrækker i samme ændring |
| `snapshot/eoSnapshotToEoPdfDocument.ts` | Nyt bilag i output |
| `snapshot/eoSnapshotToTafPerYearPdfDocument.ts` | Benefit-segmenter |
| `pdf/domains/eo/sections/opgoerelseSection.ts` | Benefit-segmenter i hoveds-TAF-sektionen med `sourceKind` |
| `pdf/domains/eo/erstatningsopgoerelsePdf.ts` | Tilføj nyt bilag |
| `pdf/domains/eo/types.ts` | Udvid selected-elements/bilag-selection typen |
| `pdf/infrastructure/pdfLoader.ts` | Lazy-load nyt PDF-bilag hvis separat download/output kræves |
| `pdf/infrastructure/pdfService.ts` | Download/output-integration hvis bilaget skal genereres selvstændigt |
| `domain/debug/eoDebugRegulationViewModel.ts` | Tilføj benefit-sektioner |
| `domain/debug/eoDebugBuilderRegistry.ts` | Registrér ny sektion |
| `domain/debug/eoDebugNavigationMap.ts` | Debug-navigation for ny sektion |
| `domain/debug/eoDebugPageViewModel.ts` | Viewmodel-integration for ny sektion |
| `components/pages/erstatningsopgoerelse/EODebug.tsx` | Ny sektion |
| `components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx` | Toggle (kun Case A) |
| `components/pages/erstatningsopgoerelse/EOberegningTab.tsx` | Bilags-checkbox/fallback-selection |
| **NYE FILER** | |
| `engines/offentligeYdelserUdviklingBeregning.ts` | Beregningsmotor |
| `pdf/domains/eo/offentligeYdelserReguleringPdf.ts` | PDF-bilag |
| `domain/debug/eoDebugOffentligeYdelserRegulationCore.ts` | Debug-core |

---

## Kritiske invarianter der skal bevares

1. `snapshot.input.erstatningsopgoerelse` ændres aldrig af beregningslogik — `regulerOffentligeYdelser` læses transient og skrives aldrig tilbage.
2. TAF-totalen i `tafPerYear` skal stadig reconcile mod `tabtArbejdsfortjenesteOre` inden for 100 øre.
3. Benefit-segmenter bruger præcis samme `segmentAmountOre`-helper som løn — ingen parallelle afrundingsregler.
4. `offentligeYdelserUdvikling === null` er en gyldig tilstand — al downstream-kode håndterer null gracefully.
5. Eksisterende `.eo`-filer loader uden fejl: `regulerOffentligeYdelser` via `.default('Ja')`, `eoBilagSelection.offentligeYdelserRegulering` via `.default(true)`.
6. Hvis der findes offentlige ydelser i beregningsperioden, men reguleringsgrundlaget/divisor/rates mangler eller er ugyldigt, må systemet ikke returnere `null` som om ydelserne ikke findes. Det skal være en eksplicit fail-closed beregningsfejl.
7. Benefit-udvikling må aldrig påvirke SFGG-beregningen. SFGG bruger fortsat kun løn-/ansættelsesbaserede segmenter via `buildSfggLoenudviklingMap()`.
8. Validator/preflight skal blokere beregning hvis `regulerOffentligeYdelser === 'Ja'` og TAF-periodens slutår overskrider seneste år i `reguleringssats`-tabellen. Når `regulerOffentligeYdelser === 'Nej'`, blokerer manglende fremtidige satser ikke.

---

## Kritiske spørgsmål til afklaring før implementering

### SP-1: Stier der IKKE er Beregningsperiode

For stierne *Angivet månedsløn* og *Angivet dagsløn* er der ingen `incomeForBeregningsperiode` — og derfor ingen `benefits` at projicere. Første version implementeres kun for `Beregningsperiode`. `offentligeYdelserUdvikling` er altid `null` for angivet-løn-stierne. Togglen vises ikke på disse stier (se stadium 5.1).

### SP-2: Midlertidigt EET ved positiv ydelsesudvikling

Når virtuelle `midlertidigt_eet`-rækker injiceres via `buildEoValuesWithTransientMidlertidigtEet(...)`, indgår de i `incomeForBeregningsperiode.benefits`. Skal de projiceres fremad som hypotetisk indkomst, eller udelukkes eksplicit? EET-ydelsen dækker en fremtidig periode — ikke en historisk indkomst. Dette er den vigtigste domæneafklaring inden motoren skrives. Hvis `midlertidigt_eet` skal udelukkes, skal filteret ligge i den nye benefit-udviklingsmotor — ikke i `buildIncomeForRanges()`, fordi fradragssiden og eksisterende offentlige-ydelser-bilag fortsat skal medtage ydelsen.

### SP-3: Beregningsperiodedivisor ved arbejdsdage-spor (implementeringsblokker)

For arbejdsdage-sporet er divisoren antallet af arbejdsdage i beregningsperioden. Ydelser udbetales som regel per kalenderdag, ikke per arbejdsdag. Hvis domain-reglen er kalenderdage for ydelser, kan `LoenudviklingSegment` ikke genbruges uændret for arbejdsdage, og der kræves enten en separat ydelses-segmenttype eller en udvidelse af segmentunionen med `kalenderdage`.

Denne afklaring er en **implementeringsblokker** for arbejdsdage-sporet. Hvis domæneafklaringen ikke kan gives, er de eneste sikre implementerbare valg:
- blokér offentlig-ydelsesudvikling i arbejdsdage-sporet med eksplicit validator/invariant og dansk fejltekst, eller
- implementér kun måneds-sporet og returnér en forventelig "ikke understøttet endnu"-fejl for arbejdsdage.

At genbruge arbejdsdage-divisoren uden afklaring kan give systematisk forkert TAF og bør ikke implementeres som "bedste gæt".

### SP-4: Regulerings-PDF som bilag vs. separat download

Planen foreslår et separat PDF-bilag. Alternativet er at integrere reguleringstabellen direkte i hoveds-PDF'ens TAF-sektion. Hvis der vælges separat bilag, afklares om det er et bilag inde i EO-downloadpakken, en selvstændig downloadknap, eller begge. De tre UX'er kræver forskellige integrationer i `erstatningsopgoerelsePdf.ts`, `pdfService.ts` og bilags-checkbox-flowet.
