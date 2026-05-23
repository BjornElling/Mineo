# Implementeringsplan: Procentadapter-unificering

**Status:** Klar til implementering  
**Scope:** `StyledPercentField`, `TablePercentInput`, `percentAdapter.ts`, ny fælles percent-kerne  
**Prioritet:** Korrekthed og konvergens over minimalisme

---

## Formål

Procentparsing og -formatering lever i dag i to parallelle, ikke-koordinerede implementeringer:

- `StyledPercentField.tsx` — `parsePercent`/`formatPercent` inlined i komponenten, model = `number | undefined`
- `percentAdapter.ts` (tabeladapter) — selvstændig `parsePercentOnCommit`, model = `string` (committed display-string)

Disse to implementeringer kan og vil divergere. Ændres den ene, glemmes den anden. Det er den egentlige risiko.

Målet er:
1. Én kanonisk procentparser/formatter der bruges af begge felter.
2. Tabeladapterens committed model ændres fra `string` til `number | undefined`, i overensstemmelse med domænemodellen og det brede felt.
3. `StyledPercentField` tager parserlogikken fra den fælles kerne, ikke omvendt.

---

## Kontekst og constraints

### Hvad der er stærkt i dag

- `useTableInputCore` + adapter-arkitekturen er korrekt og følger `form-contract.md` § 6.4 og `mineo-field-pattern.md`.
- `percentAdapter.ts`'s opdeling i parse/format/fingerprint/paste/keyFilter er den rigtige struktur.
- `StyledPercentField`'s to-trins aktiveringsmodel (`useTwoStageInputActivation`) er korrekt og må ikke ændres.

### Hvad der er svagt i dag

1. **Dobbelt parser.** `parsePercentOnCommit` i `percentAdapter.ts` og `parsePercent` i `StyledPercentField.tsx` løser det samme problem forskelligt. Konkret divergens:
   - Tabeladapteren bruger `parseDanishNumberString` + regex-splitting. StyledPercentField bruger direkte aritmetik på `integerPart`/`decimalPart`. Logikken er ikke ækvivalent.
   - Fejlbeskeder er ens tekstmæssigt, men produceres via to separate stier.
   - `DEFAULT_PERCENT_TYPING_MAX_INTEGER_DIGITS` bruges kun i StyledPercentField; adapteren har ingen tilsvarende.

2. **Tabeladapterens model er `string`.** Den committed value i `TablePercentInput` er en display-string som `"12,50"`. Domænet er et tal. `number | undefined` er den korrekte type. En string-model betyder:
   - `toPercentDisplayString` kaldes for at normalisere `number | undefined` → `string` ved mount/update, men det er en formateringsfunktion, ikke et domæneobjekt.
   - Fingerprinting sker fra display-string via `percentNumericCanonicalFromDisplay`, som er en re-parse af en allerede formateret streng. Det er én unødvendig serialiseringsrunde.
   - Hvis en consumer skriver en string direkte ind som `value` (prop-typen tillader det), kan adapteren modtage en ikke-normaliseret streng og kan give forkerte fingerprints.

3. **`StyledPercentField` har displayformatering med hukommelse** (`lastCommittedDisplayRef`, `pendingCommitDecimalsRef`) der bevarer brugerens præcision (1 vs 2 decimaler). Tabeladapteren har ikke denne logik. Om dette skal genimplementeres i tabeladapteren afhænger af om tabelceller skal bevare brugerpræcision — det bør afklares og ekspliciteres.

4. **`percentInputUtils.ts` er untracked** (ny fil i git status). Dens indhold er allerede i brug. Den skal committes som en del af dette arbejde.

---

## Nøglebeslutning: Canonical model = `number | undefined`

Tabeladapterens `TModel` ændres fra `string` til `number | undefined`.

Konsekvenser:
- `toPercentDisplayString` og `createPercentCommittedPayload` skal opdateres.
- `onChange`-callbacket i `useTableInputCore` emitter fortsat `{ target: { value: string } }` som display-string (det er tableInputCore's kontrakt, ikke adapterens).
- `onBlur`-callbacket emitter `{ target: { value: number | undefined } }` — dette er et brud på den nuværende `TablePercentInputChangeEvent = { target: { value: string } }`.
- Alle call-sites der bruger `onBlur` fra `TablePercentInput` skal opdateres.

Dette er det vigtigste ændringspunkt og kræver afklaring af call-sites **inden** implementering starter (se Stadie 0).

---

## Arkitektur efter ændringen

```
src/utils/percentDraftCore.ts          ← NY: kanonisk parser og formatter
src/hooks/tableInput/adapters/
  percentAdapter.ts                    ← OPDATERET: bruger percentDraftCore, TModel = number | undefined
src/components/inputs/
  StyledPercentField.tsx               ← OPDATERET: bruger percentDraftCore for parsePercent/formatPercent
src/utils/percentInputUtils.ts         ← EKSISTERENDE (untracked): commites uændret
```

### `percentDraftCore.ts`

Indeholder de rene funktioner der deles af begge felter:

```typescript
export type PercentParseConfig = Readonly<{
  allowNegative: boolean;
  allowDecimals: boolean;
  minValue?: number;
  maxValue?: number;
}>;

// Bruges ved commit i begge felter:
export const parsePercentDraftForCommit = (
  raw: string,
  config: PercentParseConfig
): { ok: true; value: number | undefined } | { ok: false; errorMessage: string }

// Bruges til display-formatering (committed → display-string):
export const formatPercentDisplay = (
  value: number | undefined,
  allowDecimals: boolean
): string

// Bruges til draft-string der bevarer brugerens indskrevne præcision:
// (svarer til nuværende formatPercentMinimal / lastCommittedDisplayRef-logikken i StyledPercentField)
// NB: Tabeladapteren har ikke behov for denne — den bruges kun i StyledPercentField.
export const formatPercentDraft = (
  value: number | undefined,
  decimals: 0 | 1 | 2
): string

// Fejlbesked for range-violations:
export const buildPercentRangeErrorMessage = (
  value: number,
  config: Pick<PercentParseConfig, 'minValue' | 'maxValue' | 'allowDecimals'>
): string | null
```

Fingerprint-produktion forbliver i `percentAdapter.ts` (via `makePercentFingerprintFromCanonical`) — det er adapterens ansvar, ikke en del af parseren.

---

## Stadie 0 — Kortlæg call-sites (ingen kodeændringer)

**Mål:** Forstå den fulde konsekvens af `TModel`-ændringen fra `string` til `number | undefined` for `onBlur`.

**Opgaver:**
1. Søg alle steder der kalder `onBlur` på `TablePercentInput` i komponenterne.
2. For hvert call-site: notér hvad der gøres med `e.target.value` (string). Vurdér om ændringen til `number | undefined` kræver en omskrivning af call-siten, eller om den blot skal type-narrowes.
3. Notér om der er call-sites der bruger `onBlur`-værdien direkte som string i persisted state — i det tilfælde skal stringkonverteringen flyttes til call-siten.
4. Afklar om tabelcellers `onChange` (display-string) skal holdes uændret (formentlig ja — det er `useTableInputCore`'s kontrakt).

**Forudsætning:** Ingen.  
**Output:** Kortlægningstabel over call-sites.

Hvis call-site-analysen viser at `onBlur` med `number | undefined` bryder 5+ steder og kræver ikke-trivielle omskrivninger, bør det overvejes om `TModel = number | undefined` implementeres i to trin: (a) adapter internt bruger `number`, men emitter stadig string i onBlur, (b) onBlur konverteres i et separat trin. Beslutningen om dette fastlægges efter Stadie 0.

---

## Stadie 1 — Opret `percentDraftCore.ts` (ingen ændringer i eksisterende filer)

**Mål:** Den kanoniske parser og formatter eksisterer som en ren utility-fil. Ingen eksisterende filer ændres.

**Opgaver:**
1. Opret `src/utils/percentDraftCore.ts` med de fire funktioner beskrevet ovenfor.
2. Parser-implementeringen baseres på `parsePercentOnCommit` fra `percentAdapter.ts` — den er mere robust (håndterer tusindtalsseparatorer via `parseDanishNumberString`) end `StyledPercentField`'s direkte aritmetik.
3. `buildPercentRangeErrorMessage` samler fejlbeskederne fra begge nuværende implementeringer.
4. `formatPercentDisplay` = `toPercentDisplayString` fra adapteren, flyttet hertil.
5. `formatPercentDraft` = den minimale formatter fra `StyledPercentField` (`formatPercentMinimal`).

**Tests:**
- Opret `src/__tests__/utils/percentDraftCore.test.ts`
- Dæk: tom input, negativ (tilladt/forbudt), decimaler (tilladt/forbudt), tusindtalsseparatorer, range-violations (min, max, begge), randbetingelser (nul, maxValue nøjagtigt).
- Matcher output mod nuværende `parsePercentOnCommit`-adfærd for alle tilfælde.

**Forudsætning:** Ingen.  
**Risiko:** Lav — ny fil, ingen side-effects.

---

## Stadie 2 — Migrer `percentAdapter.ts` til `percentDraftCore.ts` og `TModel = number | undefined`

**Mål:** Tabeladapteren bruger den fælles parser og har korrekt domænemodel.

**Opgaver:**
1. Erstat `parsePercentOnCommit` i adapteren med `parsePercentDraftForCommit` fra `percentDraftCore.ts`.
2. Erstat `toPercentDisplayString` med `formatPercentDisplay` fra `percentDraftCore.ts`.
3. Ændr `TablePercentInputModel` fra `string` til `number | undefined`.
4. Opdater `adapter.format`: `formatPercentDisplay(value, allowDecimals)`.
5. Opdater `adapter.parse`: returnerer `{ ok: true, value: number | undefined }`.
6. Opdater `createPercentCommittedPayload` og fingerprint-logikken til at arbejde med `number | undefined`.
7. Opdater `TablePercentInput`-komponenten: `committedValue` er nu `number | undefined` direkte (ikke den mellomliggende `toPercentDisplayString`-konvertering).
8. Opdater `TablePercentInputChangeEvent` for `onBlur` til `{ target: { value: number | undefined } }`.
9. Opdater alle call-sites identificeret i Stadie 0.

**Invarianter der skal bevares:**
- `adapter.format(value)` og `adapter.format(adapter.parse(adapter.format(value)).value)` er stable (round-trip).
- Fingerprint er stabilt: to numerisk ens værdier giver samme fingerprint uanset om de kom fra `number` eller `string`-input.
- `useSaveError` opfører sig uændret.

**Tests:**
- Tilpas eksisterende `tableCommitContract.test.tsx` og eventuelle percent-specifikke tests.
- Verificer round-trip: format → parse → format giver samme streng.
- Verificer no-op detection: to ens `number`-værdier giver samme fingerprint.

**Forudsætning:** Stadie 0 og 1 færdigt.  
**Risiko:** Medium — `TModel`-ændringen er breaking på `onBlur`. Sikkerheden afhænger af fuldstændighed af Stadie 0-kortlægningen.

---

## Stadie 3 — Migrer `StyledPercentField.tsx` til `percentDraftCore.ts`

**Mål:** Det brede felt bruger den fælles parser. Den inlinede `parsePercent`-logik fjernes.

**Opgaver:**
1. Erstat `parsePercent`-callback i `useDraftField`-opkaldet med en wrapper over `parsePercentDraftForCommit` fra `percentDraftCore.ts`.
2. `formatPercent` bevarer `lastCommittedDisplayRef`-logikken (bruger-præcision) men delegerer selve formateringen til `formatPercentDraft` og `formatPercentDisplay` fra kernen.
3. Slet `parsePercent`-funktionen og evt. `formatPercentMinimal` fra komponenten.
4. Verificer at `useTwoStageInputActivation`-flowet er uændret.
5. Verificer at `commitOnBlur: false`-logikken og `skipNextBlurCommitRef` er uændret.

**Hvad der IKKE ændres:**
- `useTwoStageInputActivation` og to-trins aktiveringsmodellen.
- `lastCommittedDisplayRef` / `pendingCommitDecimalsRef` (bruger-præcisionshukommelse).
- `useDraftField`-integrationen.
- Feltets `value: number | undefined` / `onCommit: CommitHandler<number | undefined>` API.

**Tests:**
- Eksisterende tests for `StyledPercentField` skal stadig passere uændret.
- Verificer at `parsePercent` og `parsePercentDraftForCommit` giver identiske resultater for alle testtilfælde.

**Forudsætning:** Stadie 1 færdigt (Stadie 2 kan køre parallelt, men kræver ikke Stadie 2).  
**Risiko:** Lav-medium — isoleret til `StyledPercentField`. Test-coverage begrænser risikoen.

---

## Stadie 4 — Oprydning og commit af `percentInputUtils.ts`

**Mål:** Ingen død kode, alle filer i git.

**Opgaver:**
1. Commit den untracked `percentInputUtils.ts` (den er allerede i brug og skal med).
2. Slet `parsePercentOnCommit` og `toPercentDisplayString` fra `percentAdapter.ts` — de er nu i `percentDraftCore.ts`.
3. Slet `formatPercentMinimal` fra `StyledPercentField.tsx` hvis den ikke bruges andre steder.
4. Verificer at `percentNumericCanonicalFromDisplay` i adapteren er elimineret (erstattet af direkte `number`-fingerprint).
5. Verificer at der ikke er resterende `parsePercentOnCommit`-referencer.

**Forudsætning:** Stadie 2 og 3 færdigt.  
**Risiko:** Lav — ren oprydning, alle adfærdsændringer er sket i Stadie 1–3.

---

## Testplan

### Enhedstests — Prioritet 1

**`src/__tests__/utils/percentDraftCore.test.ts`** (oprettet i Stadie 1)

| Testtilfælde | Forventet resultat |
|---|---|
| Tom streng | `{ ok: true, value: undefined }` |
| `"-"` alene | `{ ok: false }` |
| `"50"` med `allowDecimals: true` | `{ ok: true, value: 50 }` |
| `"50,25"` med `allowDecimals: true` | `{ ok: true, value: 50.25 }` |
| `"50,25"` med `allowDecimals: false` | `{ ok: false }` |
| `"-10"` med `allowNegative: false` | `{ ok: false }` |
| `"-10"` med `allowNegative: true` | `{ ok: true, value: -10 }` |
| `"101"` med `maxValue: 100` | `{ ok: false }` med range-besked |
| `"0"` med `minValue: 0` | `{ ok: true, value: 0 }` |
| `"1.000"` (tusindtalsseparator) | parses korrekt til `1000` |
| Streng over `MAX_PERCENT_RAW_LENGTH` | `{ ok: false }` |
| `"50,"` (afkortet decimal) | `{ ok: false }` |

**Round-trip test** (oprettet i Stadie 2):
```
for value in [0, 1, 50, 99.99, 100, -10]:
  formatted = formatPercentDisplay(value, true)
  parsed = parsePercentDraftForCommit(formatted, { allowNegative: true, allowDecimals: true })
  assert parsed.ok && parsed.value === value
```

### Integrationstests — Prioritet 2

Eksisterende `tableCommitContract.test.tsx` og `useTableInputCore.test.tsx` dækker commit-flow. Disse skal passere uden ændring efter Stadie 2.

Hvis `onBlur` ændrer type til `number | undefined`, skal tests der verificerer call-site-adfærd opdateres.

### Regressionstests — Prioritet 3

Kør fuld test-suite (`npx vitest run`) efter hvert stadie og verificer ingen ny fejl.

---

## Risici og modforanstaltninger

| Risiko | Modforanstaltning |
|---|---|
| Call-sites bruger `onBlur`-string direkte i persisted state | Kortlæg i Stadie 0. Ændr call-sites til at håndtere `number | undefined`. |
| `parsePercentDraftForCommit` har subtilt anderledes adfærd end `parsePercent` | Skriv direkte sammenlignende tests i Stadie 1 inden migration. |
| Bruger-præcisionshukommelse (`lastCommittedDisplayRef`) går tabt i tabelfeltet | Eksplicit beslutning: tabelfeltet bevarer IKKE bruger-præcision (display er altid kanonisk fra `formatPercentDisplay`). Hvis dette ønskes, tilføjes det eksplicit. |
| `percentInputUtils.ts` untracked skaber merge-konflikter | Commit den i Stadie 4 (eller separat inden Stadie 1). |

---

## Afgrænsninger

- Ingen ændring i `useTwoStageInputActivation`.
- Ingen ændring i `useTableInputCore`.
- Ingen ændring i `useDraftField`.
- `percentInputUtils.ts` ændres ikke — den commites som-er.
- Autofill-suggest-implementeringen (se `docs/implementation/autofill-suggest.md`) er uafhængig af denne plan og kan køre parallelt.
- Ingen nye dependencies.

---

## Rækkefølge og afhængigheder

```
Stadie 0 (kortlægning)
    ↓
Stadie 1 (percentDraftCore.ts)
    ↓           ↓
Stadie 2     Stadie 3
(adapter)  (StyledPercentField)
    ↓           ↓
       Stadie 4 (oprydning)
```

Stadie 2 og 3 er uafhængige af hinanden og kan køre parallelt. Begge kræver Stadie 1. Stadie 4 kræver begge.

---

## Supplement: Tværgående arkitekturanalyse af alle inputfamilier

Dette afsnit gentænker arkitekturen fra bunden med udgangspunkt i den fulde inputfamilie: Styled*-felter, TableInput-celler i StandardGrid og LooseGrid. Målet er ikke at tilføje lag, men at identificere det mindste sæt af abstraktion der giver reel ensartethed — og hvad der i dag forhindrer det.

---

### 1. Hvad der faktisk er to separate arkitekturer i dag

Inputfamilien er i dag opdelt i to vertikale stakke der ikke deler noget:

**Stak A — Styled*Fields (formsider)**

```
StyledTextFieldBase          ← Layer A: render/styling
useDraftField                ← Layer B: draft/commit lifecycle
StyledAmountField            ← Layer C: domænespecifik adapter
StyledDateField
StyledPercentField
```

**Stak B — Table*Inputs (GridCore-celler)**

```
InputBase (MUI)              ← render
useTableInputCore            ← commit lifecycle + GridCore-binding
TableInputAdapter<T>         ← domænespecifik adapter
TableAmountInput
TableDateInput
TablePercentInput
...
```

De to stakke har samme semantiske mål (draft → commit, parse-on-commit, two-stage activation, error-display), men ingen fælles kode og ingen fælles kontrakt for, hvad en "inputadapter" er. Det betyder at nye korrekthedskrav — fx et nyt paste-mønster, ny range-fejladfærd eller en ændring i fingerprint-logik — skal implementeres to gange, og kan divergere stille.

`TableDateIsoInput` er et symptom: det er en tredje lag der indkapsler en tabelinput og oversætter model-typen. Det er ikke forkert — men det peger på at model-typen burde have levet i adapteren fra starten, ikke i en wrapper.

---

### 2. Kernespændingen: to-trins aktivering vs GridCore-editing

Den fundamentale forskel mellem de to stakke er ikke parserlogikken, men **hvem der ejer skiftet mellem "læs" og "skriv"**:

- `useTwoStageInputActivation` ejer det i Styled*-felter: feltet er `readOnly` indtil klik eller tastestart, og activation-hook styrer hvornår editor åbner og lukker.
- GridCore ejer det i tabelceller: `isEditing` kommer fra grid-registeret via `useGridCellEditing(gridCell)`. En tabelcelle ved ikke selv hvornår den er i edit-mode.

Dette er en reel arkitektonisk forskel, ikke blot en implementeringsforskel. Den kan ikke fjernes ved at dele mere kode. Den kan håndteres ved at gøre den eksplicit: en fælles adapter bør eje parser/formatter/fingerprint, og de to kerne-hooks (useDraftField + useTableInputCore) bør bruge den fælles adapter, men forblive separate i lifecycle-styringen.

---

### 3. Hvad der faktisk er duplikeret og burde konvergere

#### 3.1 Parser- og formateringslogik

Hvert felt har sin egen parser. Mange af disse er næsten identiske:

| Domæne | Styled* parser | Tabel-adapter parser | Deler kerne? |
|---|---|---|---|
| Dato | `parseDateDraftForCommit` (via `dateDraftCommit.ts`) | `parseDateDraftForCommit` (via `dateDraftCommit.ts`) | **Ja** — allerede delt |
| Beløb | `parseAmountInput` (via `expressionAmount.ts`) | `parseAmountInput` (via `expressionAmount.ts`) | **Ja** — allerede delt |
| Procent | `parsePercent` (inline i `StyledPercentField`) | `parsePercentOnCommit` (inline i `percentAdapter.ts`) | **Nej** — duplikeret |
| År | ingen Styled*-felt | `yearAdapter.ts` | — |
| Uge | ingen Styled*-felt | `weekAdapter.ts` | — |

Dato og beløb er allerede konvergeret på en fælles parser. Procent er det eneste tilbageværende divergenstilfælde i den nuværende kodebase (adresseret af Stadie 1–3 i denne plan).

#### 3.2 Config-validering

Hvert felt implementerer sin egen config-validering. Mønstret er identisk, men koden er ikke delt:

```
StyledPercentField:    useMemo → configErrorMessage → throw (DEV) / display (PROD)
TablePercentInput:     useMemo → configErrorMessage → throw
TableWeekInput:        useMemo → configErrorMessage → throw
TableYearInput:        useMemo → configErrorMessage → throw
TableDateInput:        useMemo → boundsStatus → throw (hard) / configErrorMessage (soft)
```

`TableDateInput` er det eneste felt der skelner mellem "hard config error" (kast) og "soft config error" (vis fejl uden at kaste). Det er en bevidst designbeslutning der ikke nødvendigvis bør generaliseres — datointervallet kan have dynamiske bounds der legitimt kan producere `min > max` i runtime, mens de fleste andre bounds er statiske.

#### 3.3 Loose vs standard grid

Alle Table*Inputs har dette mønster:

```typescript
const isLooseTable = gridApi.tableKind === 'loose';
const inputBorderRadius = isLooseTable ? '10px' : '0px';
const inputBorderColor = isLooseTable ? 'var(--color-input-border)' : 'transparent';
```

Og derefter gentages `isLooseTable`, `inputBorderRadius`, `inputBorderColor` i `getTableInputRootStyles(...)`. Disse tre linjer er identiske i alle 6+ tabelinputs. Det er oplagt at flytte dem ind i `getTableInputRootStyles` som en enkelt funktion der tager `tableKind` og ikke `isLooseTable`+separate strenge. Det eliminerer et lille men friktionsskabende mønster der kan divergere.

#### 3.4 Tooltip/fejl-shell

Alle tabelinputs har en næsten identisk render-struktur:

```tsx
<Tooltip title={...} arrow placement="top">
  <Box sx={{ width: '100%', height: '100%' }}>
    <InputBase ... />
    {showError ? <span id={a11yErrorId} style={visuallyHiddenStyle}>{errorMessage}</span> : null}
  </Box>
</Tooltip>
```

Men med tre variationer:
1. `TableDateInput` bruger `<span style={{ display: 'block' }}>` i stedet for `<Box>` som tooltip-child (fordi `Tooltip` kræver et element der kan modtage en `ref`, og `InputBase` ikke altid gør det direkte i alle MUI-versioner).
2. `TableAmountInput` og `TablePercentInput` bruger `<Box sx={{ position: 'relative' }}>` som yderste container for at kunne positionere `fx`-indikatoren og fremtidige overlays.
3. `TableWeekInput` og `TableYearInput` mangler `...(core.cellFocused ? { outline: 'none' } : {})` i `sx` som `TableDateInput` og `TableAmountInput` har.

Disse variationer er ikke alle bevidste designbeslutninger — de er sandsynligvis opstået ved kopiering med subtile forskelle. `outline: none` på `cellFocused` er et korrekthedsspørgsmål (visuel browser-outline på fokuserede celler).

#### 3.5 `onCopy`-implementering

`useTableInputCore` eksponerer `handleCopy` der kalder `copyWholeValueFromReadOnlyField`. De fleste tabelinputs bruger `core.handleCopy` direkte. Men:
- `TableAmountInput` implementerer en lokal `handleCopy` der ignorerer `core.handleCopy` og kalder `copyWholeValueFromReadOnlyField` igen med `core.renderedValue`.
- `TablePercentInput` implementerer en lokal `handleCopy` der bruger `renderedValue` (inklusive ` %`-suffixet).

Disse lokale implementeringer er ikke nødvendigvis forkerte, men de er usynlige overfor `useTableInputCore` — kernen tror handleCopy er håndteret standardmæssigt. Det skaber en skjult adfærdsforskel.

---

### 4. Den fundamentale arkitekturforskel: model-typer

Den største kilde til inkonsekvens er ikke kode-duplikering men uensstemmende model-typer i tabeladapterne:

| Adapter | TModel | Reelt domæne |
|---|---|---|
| `amountAdapter` | `AmountValue \| undefined` | Korrekt |
| `dateAdapter` | `string` (dansk display) | Display-string, ikke domænemodel |
| `percentAdapter` | `string` (display-string) | Display-string, ikke domænemodel |
| `weekAdapter` | `string` (display-string) | Display-string, ikke domænemodel |
| `yearAdapter` | `string` (display-string) | Display-string, ikke domænemodel |
| `integerAdapter` | `string` (display-string) | Display-string, ikke domænemodel |

Beløbsadapteren er den eneste der bruger en reel domænemodel. Alle andre bruger display-strings som committed model.

Dette er et bevidst valg i den nuværende arkitektur: tabelrækker persisterer værdier som strings, og adapterne er designet til at arbejde med den persisterede repræsentation direkte. Det eliminerer konverteringer ved persist/load, men koster:

1. Fingerprint-logikken for string-modeller kræver re-parsing af den allerede formaterede streng for at producere en kanonisk hash. For dato og procent sker der en roundtrip: parse → format → re-parse i `toCommittedPayload`.
2. `onBlur`-callbacket emitter display-strings, og call-sites skal manuelt konvertere til domænetyper (fx `TableDateIsoInput` gør dette).
3. Null/undefined-semantikken er skjult: en tom string `""` og `undefined` er to repræsentationer af "ingen værdi", og de behandles forskelligt i fingerprinting.

`TableAmountInput`'s approach er arkitektonisk sundere. At `onBlur` emitter `AmountValue | undefined` og adapteren arbejder med domænemodellen er det mønster der burde gælde alle felter. Men at generalisere det til dato, procent, uge og år kræver at:
- Persistensformatet enten ændres til at gemme domænemodellen (ikke display-string)
- Eller at adapteren kender til begge repræsentationer og konverterer ved load/save

Dette er et større arkitekturmæssigt valg der ikke bør foretages som en del af denne plan — det kræver analyse af persistens-kontrakten og schema-evolution.

---

### 5. Hvad en ensartet arkitektur ville se ud som fra bunden

Hvis man gentænker inputsystemet uden historisk bagage, ser den konvergerede arkitektur sådan ud:

#### 5.1 Ét adapter-interface bruges af alle felter

```typescript
// Nuværende: to separate interfaces
TableInputAdapter<TModel, TCanonical, TFingerprint>   // kun tabelceller
// + inline parse/format i hvert Styled*-felt

// Konvergeret: ét fælles interface
FieldAdapter<TModel, TDraft extends string> = {
  // Formatering: domænemodel → display-string (altid deterministisk)
  format: (value: TModel) => TDraft;

  // Draft-string til redigering (kan afvige fra format, fx beløb der bevarer udtryk)
  toDraftString?: (value: TModel) => TDraft;

  // Parser: draft → domænemodel eller fejl
  parse: (draft: TDraft, mode: 'typing' | 'commit') => ParseResult<TModel>;

  // Fingerprint: til no-op detection
  toFingerprint: (value: TModel) => string;

  // Tastatur/paste-grammatik
  isValidStartKey: (key: string) => boolean;
  applyPaste?: (raw: string, context: PasteContext<TDraft>) => PasteResult<TDraft> | null;
  filterKeyDown?: (e: KeyboardEvent, context: EditContext) => boolean;

  // Adfærdsflags
  clearErrorOnChange?: boolean;
  preserveInvalidDraft?: boolean;
}
```

De nuværende `TableInputAdapter` og de inline parsere i Styled*-felter er specialiseringer af dette interface. Foreningen eliminerer duplikat parser-implementeringer og giver begge feldfamilier adgang til de samme grammatik-regler.

#### 5.2 To lifecycle-hooks der begge bruger adapter-interfacet

```
useDraftField(adapter, value, options)    ← til Styled*-felter (ejer two-stage activation)
useTableInputCore(adapter, gridCell, ...) ← til tabelceller (GridCore ejer activation)
```

Begge hooks bruger det samme adapter-interface. Parse, format og fingerprint er adapterens ansvar. Commit-semantik, error-display og resync er hookens ansvar.

#### 5.3 Ét komponent-shell pr. kontekst, ikke pr. type

I stedet for 6+ næsten-identiske tabelinput-komponenter:

```
TableInputShell               ← håndterer render, Tooltip, a11y, isLooseTable-styling
  ↑ bruges af alle typer
TableAmountInput              ← kun adapter-konfiguration + type-specifikke UI-extensions (fx-indikator)
TableDateInput                ← kun adapter-konfiguration + sanitize-callback
TablePercentInput             ← kun adapter-konfiguration + % suffix
TableWeekInput                ← kun adapter-konfiguration
TableYearInput                ← kun adapter-konfiguration
```

`TableInputShell` ejer: `Tooltip`, `InputBase`, a11y-span, `isLooseTable`-logik, `outline: none` på `cellFocused`, `inputProps` (readOnly, tabIndex, data-attributter). Det eliminerer de ~50 linjer boilerplate der i dag er identiske i hvert tabelinput.

---

### 6. Konkrete inkonsekvenser der bør rettes uafhængigt

Uanset om man vælger den store arkitektur-konvergens i afsnit 5, er disse fund konkrete og afgrænsede:

#### Fund A — `outline: none` mangler i `TableWeekInput` og `TableYearInput`
**Severity:** Lav  
**Sted:** [TableWeekInput.tsx](src/components/inputs/table/TableWeekInput.tsx), [TableYearInput.tsx](src/components/inputs/table/TableYearInput.tsx)  
`TableDateInput` og `TableAmountInput` har `...(core.cellFocused ? { outline: 'none' } : {})` i deres sx-prop for at undertrykke browser-outline på fokuserede grid-celler. Week og Year mangler dette. Resulterer i synlig browser-fokusring i visse browsere.  
**Anbefaling:** Tilføj til begge.

#### Fund B — `isLooseTable`-boilerplate bør flyttes til `getTableInputRootStyles`
**Severity:** Lav  
**Sted:** Alle 6+ Table*Input-komponenter  
`isLooseTable`, `inputBorderRadius` og `inputBorderColor` er identiske i alle komponenter og bruges kun i `getTableInputRootStyles(...)`. Funktionen bør acceptere `tableKind: 'standard' | 'loose'` og beregne de to strenge internt.  
**Anbefaling:** Opdater `getTableInputRootStyles` og `tableInputStyles.ts`. Eliminerer 3 linjer × 6+ komponenter.

#### Fund C — `TableDateInput` bruger `<span>` som Tooltip-child, øvrige bruger `<Box>`
**Severity:** Lav  
**Sted:** [TableDateInput.tsx:174](src/components/inputs/table/TableDateInput.tsx)  
Inkonsistensen er sandsynligvis nødvendig (MUI Tooltip-refkrav), men er ikke kommenteret. Bør dokumenteres eksplicit så fremtidige komponenter ved hvilken variant de skal følge.  
**Anbefaling:** Tilføj en enkelt kommentar der forklarer valget.

#### Fund D — `TableAmountInput.onCopy` og `TablePercentInput.onCopy` overskriver `core.handleCopy` uden synlig grund
**Severity:** Medium  
**Sted:** [TableAmountInput.tsx:106](src/components/inputs/table/TableAmountInput.tsx), [TablePercentInput.tsx:127](src/components/inputs/table/TablePercentInput.tsx)  
Begge felter implementerer lokal `handleCopy` der kalder `copyWholeValueFromReadOnlyField` direkte. `useTableInputCore` eksponerer `handleCopy` der gør det samme. Forskellen: `TableAmountInput` bruger `core.renderedValue` (inkl. expression-tekst) som kopikilde, og `TablePercentInput` bruger `renderedValue` (inkl. ` %`). `core.handleCopy` bruger `adapter.format(value)` eller draft — ikke den visuelle suffix.  
Problemet er at `core.handleCopy` ikke kender til type-specifikke display-suffixer. Det er et reelt behov, men det bør løses ved at give adapteren en `toClipboardString?: (value: TModel) => string`-metode, ikke ved at overskrive handleCopy i komponenten.  
**Anbefaling:** Tilføj `toClipboardString` til `TableInputAdapter`-interfacet. Lad `useTableInputCore.handleCopy` bruge den hvis til stede.

#### Fund E — `TableDateIsoInput` er en component-wrapper om en model-konvertering der burde ligge i adapteren
**Severity:** Medium  
**Sted:** [TableDateIsoInput.tsx](src/components/inputs/table/TableDateIsoInput.tsx)  
`TableDateIsoInput` eksisterer udelukkende for at oversætte `ISODateString` ↔ `string` (dansk display). Dette er præcis hvad et adapter-lag bør gøre. En `createDateIsoTableInputAdapter` der arbejder med `ISODateString | undefined` som TModel ville eliminere wrapper-komponenten og give en renere type-kontrakt.  
**Anbefaling:** Overvej at oprette `createDateIsoTableInputAdapter` og lade `TableDateInput` acceptere den direkte. `TableDateIsoInput` kan derefter reduceres til en tynd prop-oversætter eller fjernes.

#### Fund F — `StyledAmountField` har `onErrorChange` og `onLocalErrorChange` ved siden af `onFieldError`
**Severity:** Medium  
**Sted:** [StyledAmountField.tsx:65](src/components/inputs/StyledAmountField.tsx)  
`StyledDateField` og `StyledPercentField` bruger kun `onFieldError`. `StyledAmountField` har alle tre: `onErrorChange(hasError: boolean)`, `onLocalErrorChange(hasLocalError: boolean)` og `onFieldError`. Det er tre overlappende fejl-reporting-kanaler for det samme felt. `onErrorChange` og `onLocalErrorChange` er ældre API'er der sandsynligvis kan fjernes til fordel for `onFieldError`.  
**Anbefaling:** Kortlæg call-sites. Hvis `onErrorChange`/`onLocalErrorChange` kan erstattes af `onFieldError` overalt, deprecated dem og fjern dem i et efterfølgende trin.

#### Fund G — `StyledAmountField` og `StyledDateField` har `Backspace`/`Delete`-commit som eksplicit undtagelse, men undtagelsen er ikke kontraktmæssigt forankret
**Severity:** Lav  
**Sted:** [StyledAmountField.tsx](src/components/inputs/StyledAmountField.tsx), [StyledDateField.tsx](src/components/inputs/StyledDateField.tsx), [StyledPercentField.tsx](src/components/inputs/StyledPercentField.tsx)  
Alle tre Styled*-felter har en kommentar "UNDTAGELSE TIL INGEN LIVE PREVIEW" ved `Backspace`/`Delete`-håndteringen. Men `mineo-field-pattern.md` nævner ikke denne undtagelse — den er ikke kontraktmæssigt forankret. Undtagelsen er legitim (se `form-contract.md` § 3.4), men burde beskrives eksplicit i `mineo-field-pattern.md` som en del af to-trins aktiveringsmodellen.  
**Anbefaling:** Tilføj et afsnit i `mineo-field-pattern.md` om `Backspace`/`Delete` i lukket editor.

---

### 7. Prioriteret implementeringsrækkefølge for tværgående work

Rangeret efter risiko/gevinst:

| Prioritet | Fund | Omfang | Forudsætning |
|---|---|---|---|
| 1 | Procentadapter-unificering (Stadie 0–4 i denne plan) | Medium | — |
| 2 | Fund B: `isLooseTable` → `getTableInputRootStyles` | Lille | Ingen |
| 3 | Fund A: `outline: none` i Week/Year | Lille | Ingen |
| 4 | Fund D: `toClipboardString` i adapter + fjern lokal `handleCopy` | Lille | Ingen |
| 5 | Fund C: Dokumentér `<span>` vs `<Box>` i DateInput | Trivielt | Ingen |
| 6 | Fund F: Deprecated `onErrorChange`/`onLocalErrorChange` i Amount | Medium | Call-site-analyse |
| 7 | Fund G: Dokumentér Backspace/Delete-undtagelse i mineo-field-pattern.md | Trivielt | Ingen |
| 8 | Fund E: `createDateIsoTableInputAdapter` / eliminer TableDateIsoInput-wrapper | Medium | Afhænger af TModel-beslutning |
| 9 | Fælles `TableInputShell`-komponent (afsnit 5.3) | Stort | Fund B+A+D+C løst |
| 10 | Fælles `FieldAdapter`-interface (afsnit 5.1–5.2) | Meget stort | Alt ovenstående |

Fund 1–7 er afgrænsede korrektions- og konvergensopgaver uden arkitektonisk risiko. Fund 8–10 er strukturelle og bør kun påbegyndes når de foregående er stabile.

Den store konvergens (afsnit 5) er ikke en forudsætning for korrekthed — den er en forudsætning for at undgå fremtidig divergens. Den bør sekvenseres i separate PRs med tests imellem, ikke som ét "big bang".
