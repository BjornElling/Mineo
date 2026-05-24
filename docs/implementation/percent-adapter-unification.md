# Implementeringsplan: Procentadapter-unificering

**Status:** Kernen implementeret — persistens-bro udestående  
**Scope:** `StyledPercentField`, `TablePercentInput`, `percentAdapter.ts`, fælles percent-kerne  
**Prioritet:** Korrekthed og konvergens over minimalisme

---

## Formål

Procentparsing og -formatering levede i to parallelle, ikke-koordinerede implementeringer:

- `StyledPercentField.tsx` — `parsePercent`/`formatPercent` inlined i komponenten, model = `number | undefined`
- `percentAdapter.ts` (tabeladapter) — selvstændig `parsePercentOnCommit`, model = `string` (committed display-string)

Disse to implementeringer kunne divergere stille. Målet var:
1. Én kanonisk procentparser/formatter der bruges af begge felter.
2. Tabeladapterens committed model ændres fra `string` til `number | undefined`.
3. `StyledPercentField` tager parserlogikken fra den fælles kerne, ikke omvendt.

---

## Implementeringsstatus

### Gennemført

**`src/utils/percentDraftCore.ts`** — oprettet med:
- `parsePercentDraftForCommit` — kanonisk parser, delt af begge felter
- `formatPercentDisplay` — display-formatter (committed → display-string)
- `formatPercentDraft` — draft-formatter med variabel decimalpræcision (bruges kun i `StyledPercentField`)
- `buildPercentRangeErrorMessage` — fælles range-fejlbeskeder
- `getPercentPrecision` — fælles præcisionshelper
- `PercentParseConfig` / `PercentParseResult` — fælles typekontrakt

**`src/hooks/tableInput/adapters/percentAdapter.ts`** — omskrevet:
- `TModel` ændret fra `string` til `number | undefined`
- `TablePercentAdapterConfig = PercentParseConfig` (ingen separat type)
- Parser delegerer til `parsePercentDraftForCommit`
- `format` delegerer til `formatPercentDisplay`
- Fingerprint beregnes direkte fra `number` via `formatRoundedCanonical` — ingen re-parsing af display-string
- `toClipboardString` tilføjet: returnerer `"12,50 %"` (med suffix) for kopiering
- `percentNumericCanonicalFromDisplay` og `toPercentDisplayString` slettet
- `TablePercentInputValue` ændret fra `string | number | undefined` til `number | undefined`

**`src/components/inputs/StyledPercentField.tsx`** — omskrevet:
- `parsePercent`-callback bruger nu `parsePercentDraftForCommit` fra `percentDraftCore.ts`
- `formatPercent` bruger `formatPercentDraft` fra `percentDraftCore.ts`
- `lastCommittedDisplayRef` / `pendingCommitDecimalsRef` (bruger-præcisionshukommelse) bevaret uændret
- `useTwoStageInputActivation`-flowet uændret
- Inlined `parsePercent`-logik og `formatPercentMinimal` slettet

**`src/components/inputs/table/TablePercentInput.tsx`** — opdateret:
- `onBlur` emitter nu `TablePercentInputCommitEvent = { target: { value: number | undefined } }`
- `onChange` emitter fortsat `{ target: { value: string } }` (display-string, uændret)
- Internt: `committedValue` udledes fra prop `value` via `parsePercentDraftForCommit` — string-input (fra persisted state) oversættes til `number | undefined` lokalt i komponenten
- Lokal `handleCopy` fjernet — `core.handleCopy` bruges nu, som kalder `adapter.toClipboardString`
- `outline: none` på `cellFocused` tilføjet (var manglende)

**`src/hooks/tableInput/tableInputAdapter.ts`** — udvidet:
- `toClipboardString?: (value: TModel) => string` tilføjet til interfacet

**`src/hooks/tableInput/useTableInputCore.ts`** — opdateret:
- `handleCopy` bruger `adapter.toClipboardString?.(value) ?? adapter.format(value)` som kopikilde

**`src/components/inputs/table/TableWeekInput.tsx`** og **`TableYearInput.tsx`** — opdateret:
- `outline: none` på `cellFocused` tilføjet (var manglende i begge)

**`src/utils/percentInputUtils.ts`** — committet (var untracked)

**Call-sites opdateret:**
- `EetAslAfgoerelserTable.tsx` — `onBlur` håndterer nu `number | undefined`; broer til string via `formatPercentDisplay(e.target.value, false) || undefined`
- `LoenudviklingManuelTable.tsx` — samme mønster via lokal helper `formatCommittedPercentCell`

**`TableAmountInput.tsx`** — lokal `handleCopy` fjernet; delegerer nu til `core.handleCopy`

---

### Udestående

#### 1. Persistens-bro er ikke elimineret — den er blot rykket til call-sites

**Hvad der skete:** `onBlur`-callbacket emitter nu `number | undefined` som planlagt. Men da det persisted schema for procentceller stadig er `string`, konverterer call-sitene i `EetAslAfgoerelserTable` og `LoenudviklingManuelTable` tilbage til display-string via `formatPercentDisplay(e.target.value, false)` på commit.

Dette er bevidst valgt som et midlertidigt kompromis — det er eksplicit og lokalt — men det er ikke den endelige løsning. Der er stadig en impedance-mismatch: adapteren arbejder med `number`, domæneskemaet persisterer `string`. Konsekvensen:
- Skemaerne for `AslAfgoerelseRow.eetPct`, `AslAfgoerelseRow.kapPct` og de tilsvarende felter i `LoenudviklingManuelTable` er fortsat `string | undefined`.
- Round-trip er: `number → formatPercentDisplay → string (persist) → parsePercentDraftForCommit → number (intern)`.

**Hvad der mangler:** Skemaerne skal migreres til `number | undefined`, og persistens-kontrakten (schema-evolution) skal opdateres. Det kræver:
1. Analyse af alle steder der læser procentfelter fra persisted state og derefter bruger dem i beregninger — de kan allerede forvente `number`-typen.
2. En schema-migration der konverterer eksisterende `string`-værdier til `number` ved load.
3. Fjernelse af `formatPercentDisplay`-brokaldene i call-sites, som derefter kan forenkles til `onBlur={(e) => commitRowUpdate(row.id, { eetPct: e.target.value })}`.

Dette er en separat opgave der kræver koordinering med `src/contracts/schema-evolution.md` og `src/contracts/persistence-contract.md`. Det er udskudt, ikke afvist.

#### 2. `TableAmountInput` — lokal `handleCopy` bevaret som `onDoubleClick`-koordinering

`TableAmountInput` havde tidligere en lokal `handleCopy` der brugte `core.renderedValue` som kopikilde. Den er fjernet, og `core.handleCopy` bruges nu. `core.handleCopy` bruger nu `adapter.toClipboardString?.(value) ?? adapter.format(value)` — for beløb returnerer det `amountValueToDisplayString`, som ikke inkluderer expression-tekst i display-string-form.

Det er uklart om expression-teksten (`"100+50"`) burde kopieres som udtryk eller som resultat (`"150,00"`). Den nuværende implementering kopierer resultatet. Hvis udtryk-kopiering er ønsket, bør `amountAdapter` implementere `toClipboardString` der returnerer expression-strengen. Det er ikke implementeret og ikke afvist — det mangler en beslutning.

#### 3. Fund B fra tværgående analyse — `isLooseTable`-boilerplate — ikke implementeret

`isLooseTable`, `inputBorderRadius` og `inputBorderColor` er stadig gentaget i alle Table*Input-komponenter. Det er udskudt, ikke afvist.

#### 4. Fund C — `<span>` vs `<Box>` som Tooltip-child i `TableDateInput` — ikke dokumenteret

Inkonsistensen er stadig udokumenteret. Udskudt.

#### 5. Fund F — `onErrorChange`/`onLocalErrorChange` i `StyledAmountField` — ikke ryddet

De to ældre fejl-reporting-kanaler i `StyledAmountField` er stadig aktive ved siden af `onFieldError`. Udskudt — kræver call-site-analyse.

#### 6. Fund G — `Backspace`/`Delete`-undtagelse i `mineo-field-pattern.md` — ikke dokumenteret

Undtagelsen er ikke forankret i kontrakten. Udskudt.

---

### Afviste ændringer

#### Persistens-schema ændret som del af denne PR

At migrere skemaerne for procentfelter (`eetPct`, `kapPct`, løntabellens procentfelter) fra `string` til `number` i samme omgang som adapter-ændringen ville have været en "big bang"-ændring der blandede to separate ansvarsområder: adapter-arkitektur og schema-evolution. Det blev bevidst afvist for denne PR. Brokaldene i call-sites er den eksplicitte markering af at dette genstår.

---

## Arkitektur efter ændringen

```
src/utils/percentDraftCore.ts          ← NY: kanonisk parser og formatter
src/hooks/tableInput/adapters/
  percentAdapter.ts                    ← OPDATERET: bruger percentDraftCore, TModel = number | undefined
src/components/inputs/
  StyledPercentField.tsx               ← OPDATERET: bruger percentDraftCore
src/utils/percentInputUtils.ts         ← Committet (var untracked)
src/hooks/tableInput/tableInputAdapter.ts ← toClipboardString tilføjet
src/hooks/tableInput/useTableInputCore.ts ← handleCopy bruger toClipboardString
```

### `percentDraftCore.ts` — faktisk interface

```typescript
export type PercentParseConfig = Readonly<{
  allowNegative: boolean;
  allowDecimals: boolean;
  minValue?: number;
  maxValue?: number;
}>;

export type PercentParseResult =
  | Readonly<{ ok: true; value: number | undefined }>
  | Readonly<{ ok: false; errorMessage: string }>;

export const getPercentPrecision = (allowDecimals: boolean): 0 | 2
export const formatPercentDisplay = (value: number | undefined, allowDecimals: boolean): string
export const formatPercentDraft = (value: number | undefined, decimals: 0 | 1 | 2): string
export const buildPercentRangeErrorMessage = (value: number, config: Pick<PercentParseConfig, ...>): string | null
export const parsePercentDraftForCommit = (rawValue: string, config: PercentParseConfig): PercentParseResult
```

Fingerprint-produktion forbliver i `percentAdapter.ts` — det er adapterens ansvar.

---

## Testplan

### Enhedstests

`percentDraftCore.test.ts` mangler stadig (er ikke oprettet som del af implementeringen). Bør oprettes med:

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

**Round-trip test:**
```
for value in [0, 1, 50, 99.99, 100, -10]:
  formatted = formatPercentDisplay(value, true)
  parsed = parsePercentDraftForCommit(formatted, { allowNegative: true, allowDecimals: true })
  assert parsed.ok && parsed.value === value
```

### Integrationstests

Eksisterende `tableCommitContract.test.tsx` og `useTableInputCore.test.tsx` dækker commit-flow og er opdateret.

---

## Næste trin (prioriteret)

| Prioritet | Opgave | Omfang | Forudsætning |
|---|---|---|---|
| 1 | Opret `percentDraftCore.test.ts` med ovenstående cases | Lille | Ingen |
| 2 | Skema-migration: `eetPct`/`kapPct` og løntabelprocentfelter til `number \| undefined` | Medium | `schema-evolution.md`-analyse |
| 3 | Fjern `formatPercentDisplay`-brokald i call-sites efter skema-migration | Trivielt | Opgave 2 |
| 4 | `isLooseTable`-boilerplate → `getTableInputRootStyles` (Fund B) | Lille | Ingen |
| 5 | Dokumentér `<span>` vs `<Box>` i `TableDateInput` (Fund C) | Trivielt | Ingen |
| 6 | `toClipboardString` i `amountAdapter` for expression-kopiering — afklar beslutning | Lille | Beslutning |
| 7 | Deprecated `onErrorChange`/`onLocalErrorChange` i `StyledAmountField` (Fund F) | Medium | Call-site-analyse |
| 8 | Dokumentér Backspace/Delete-undtagelse i `mineo-field-pattern.md` (Fund G) | Trivielt | Ingen |

---

## Supplement: Tværgående arkitekturanalyse af alle inputfamilier

Dette afsnit gentænker arkitekturen fra bunden med udgangspunkt i den fulde inputfamilie: Styled*-felter, TableInput-celler i StandardGrid og LooseGrid. Målet er ikke at tilføje lag, men at identificere det mindste sæt af abstraktion der giver reel ensartethed — og hvad der i dag forhindrer det.

---

### 1. Hvad der faktisk er to separate arkitekturer i dag

Inputfamilien er opdelt i to vertikale stakke der ikke deler noget:

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

`TableDateIsoInput` er et symptom: det er et tredje lag der indkapsler en tabelinput og oversætter model-typen. Det er ikke forkert — men det peger på at model-typen burde have levet i adapteren fra starten, ikke i en wrapper.

---

### 2. Kernespændingen: to-trins aktivering vs GridCore-editing

Den fundamentale forskel mellem de to stakke er ikke parserlogikken, men **hvem der ejer skiftet mellem "læs" og "skriv"**:

- `useTwoStageInputActivation` ejer det i Styled*-felter: feltet er `readOnly` indtil klik eller tastestart, og activation-hook styrer hvornår editor åbner og lukker.
- GridCore ejer det i tabelceller: `isEditing` kommer fra grid-registeret via `useGridCellEditing(gridCell)`. En tabelcelle ved ikke selv hvornår den er i edit-mode.

Dette er en reel arkitektonisk forskel, ikke blot en implementeringsforskel. Den kan ikke fjernes ved at dele mere kode. Den kan håndteres ved at gøre den eksplicit: en fælles adapter bør eje parser/formatter/fingerprint, og de to kerne-hooks (`useDraftField` + `useTableInputCore`) bør bruge den fælles adapter, men forblive separate i lifecycle-styringen.

---

### 3. Hvad der faktisk er duplikeret og burde konvergere

#### 3.1 Parser- og formateringslogik

| Domæne | Styled* parser | Tabel-adapter parser | Deler kerne? |
|---|---|---|---|
| Dato | `parseDateDraftForCommit` (via `dateDraftCommit.ts`) | `parseDateDraftForCommit` (via `dateDraftCommit.ts`) | **Ja** — allerede delt |
| Beløb | `parseAmountInput` (via `expressionAmount.ts`) | `parseAmountInput` (via `expressionAmount.ts`) | **Ja** — allerede delt |
| Procent | `parsePercentDraftForCommit` (via `percentDraftCore.ts`) | `parsePercentDraftForCommit` (via `percentDraftCore.ts`) | **Ja** — implementeret i denne plan |
| År | ingen Styled*-felt | `yearAdapter.ts` | — |
| Uge | ingen Styled*-felt | `weekAdapter.ts` | — |

Alle tre nuværende Styled*/Table-paroveringer er nu konvergeret.

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

Disse tre linjer er identiske i alle 6+ tabelinputs. Det er oplagt at flytte dem ind i `getTableInputRootStyles` som en enkelt funktion der tager `tableKind` og ikke `isLooseTable` + separate strenge. Det eliminerer et lille men friktionsskabende mønster der kan divergere.

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
1. `TableDateInput` bruger `<span style={{ display: 'block' }}>` i stedet for `<Box>` som tooltip-child.
2. `TableAmountInput` og `TablePercentInput` bruger `<Box sx={{ position: 'relative' }}>` som yderste container for at kunne positionere `fx`-indikatoren og fremtidige overlays.
3. `TableWeekInput` og `TableYearInput` manglede `outline: none` på `cellFocused` — **rettet i denne plan**.

#### 3.5 `onCopy`-implementering

`useTableInputCore` eksponerer nu `handleCopy` der bruger `adapter.toClipboardString?.(value) ?? adapter.format(value)`. `TableAmountInput` og `TablePercentInput` bruger nu begge `core.handleCopy` direkte. `toClipboardString` er implementeret i `percentAdapter` (tilføjer ` %`-suffix). `amountAdapter` mangler stadig `toClipboardString` — expression-tekst kopieres ikke som udtryk (se Udestående, punkt 2).

---

### 4. Den fundamentale arkitekturforskel: model-typer

Den største kilde til inkonsekvens er uensstemmende model-typer i tabeladapterne:

| Adapter | TModel | Reelt domæne | Status |
|---|---|---|---|
| `amountAdapter` | `AmountValue \| undefined` | Korrekt | — |
| `percentAdapter` | `number \| undefined` | Korrekt | **Rettet i denne plan** |
| `dateAdapter` | `string` (dansk display) | Display-string, ikke domænemodel | Udestående |
| `weekAdapter` | `string` (display-string) | Display-string, ikke domænemodel | Udestående |
| `yearAdapter` | `string` (display-string) | Display-string, ikke domænemodel | Udestående |
| `integerAdapter` | `string` (display-string) | Display-string, ikke domænemodel | Udestående |

De resterende string-modeller kræver persistens-schema-ændringer og er udskudt.

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
  format: (value: TModel) => TDraft;
  toDraftString?: (value: TModel) => TDraft;
  parse: (draft: TDraft, mode: 'typing' | 'commit') => ParseResult<TModel>;
  toFingerprint: (value: TModel) => string;
  isValidStartKey: (key: string) => boolean;
  applyPaste?: (raw: string, context: PasteContext<TDraft>) => PasteResult<TDraft> | null;
  filterKeyDown?: (e: KeyboardEvent, context: EditContext) => boolean;
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

### 6. Konkrete inkonsekvenser — status

#### Fund A — `outline: none` mangler i `TableWeekInput` og `TableYearInput`
**Status: Rettet** i denne plan.

#### Fund B — `isLooseTable`-boilerplate bør flyttes til `getTableInputRootStyles`
**Status: Udestående.** Alle 6+ komponenter gentager stadig de tre linjer. Se Næste trin, prioritet 4.

#### Fund C — `TableDateInput` bruger `<span>` som Tooltip-child, øvrige bruger `<Box>`
**Status: Udestående.** Inkonsistensen er stadig udokumenteret. Se Næste trin, prioritet 5.

#### Fund D — `TableAmountInput.onCopy` og `TablePercentInput.onCopy` overskrev `core.handleCopy`
**Status: Rettet** i denne plan. Begge komponenter bruger nu `core.handleCopy`. `toClipboardString` er tilføjet til adapter-interfacet og implementeret i `percentAdapter`. `amountAdapter` mangler stadig `toClipboardString` for expression-kopiering (se Udestående, punkt 2).

#### Fund E — `TableDateIsoInput` er en component-wrapper om en model-konvertering der burde ligge i adapteren
**Status: Udestående.** Afhænger af TModel-beslutning for `dateAdapter`. Ikke afvist.

#### Fund F — `StyledAmountField` har `onErrorChange` og `onLocalErrorChange` ved siden af `onFieldError`
**Status: Udestående.** Kræver call-site-analyse. Se Næste trin, prioritet 7.

#### Fund G — `Backspace`/`Delete`-undtagelse er ikke kontraktmæssigt forankret i `mineo-field-pattern.md`
**Status: Udestående.** Se Næste trin, prioritet 8.

---

### 7. Prioriteret rækkefølge for resterende tværgående work

| Prioritet | Opgave | Omfang | Forudsætning |
|---|---|---|---|
| 1 | `percentDraftCore.test.ts` — enhedstests for parser og formatter | Lille | Ingen |
| 2 | Skema-migration: procentfelter til `number \| undefined`, fjern brokald | Medium | `schema-evolution.md` |
| 3 | Fund B: `isLooseTable` → `getTableInputRootStyles` | Lille | Ingen |
| 4 | Fund C: Dokumentér `<span>` vs `<Box>` i `TableDateInput` | Trivielt | Ingen |
| 5 | `toClipboardString` i `amountAdapter` — beslut expression-kopiering | Lille | Beslutning |
| 6 | Fund F: Deprecated `onErrorChange`/`onLocalErrorChange` i `StyledAmountField` | Medium | Call-site-analyse |
| 7 | Fund G: Dokumentér Backspace/Delete-undtagelse i `mineo-field-pattern.md` | Trivielt | Ingen |
| 8 | Fund E: `createDateIsoTableInputAdapter` / eliminer `TableDateIsoInput`-wrapper | Medium | TModel-beslutning for date |
| 9 | Fælles `TableInputShell`-komponent (afsnit 5.3) | Stort | Fund B+C løst |
| 10 | Fælles `FieldAdapter`-interface (afsnit 5.1–5.2) | Meget stort | Alt ovenstående |

Fund 1–7 er afgrænsede opgaver uden arkitektonisk risiko. Fund 8–10 er strukturelle og bør kun påbegyndes når de foregående er stabile. Den store konvergens (afsnit 5) er ikke en forudsætning for korrekthed — den er en forudsætning for at undgå fremtidig divergens.
