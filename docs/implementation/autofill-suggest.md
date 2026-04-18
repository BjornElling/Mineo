# Implementeringsplan: Autofill-suggest i StandardGridTable

## Overblik

Autofill-suggest er en inline ghost-text-funktion i StandardGridTable. Når en kolonne indeholder et genkendeligt mønster i mindst to udfyldte rækker, vises en nedtonet suggest-værdi i næste tomme celle i kolonnen — eller oven i det brugeren skriver, hvis cellen ikke er tom. Brugeren accepterer med Enter; al anden navigation forbliver uændret.

Funktionen implementeres udelukkende i StandardGridTable. LooseGridTable-kompatibilitet designes ind fra starten, men aktiveres ikke.

---

## Nøglebeslutninger

| Spørgsmål | Beslutning |
|---|---|
| Scope | Kun StandardGridTable i første omgang |
| Understøttede input-typer | TableDateInput, TableDateIsoInput, TableIntegerInput, TableAmountInput, TableYearInput, TableWeekInput, TablePercentInput, TableTextInput |
| Minimum rækker for aktivering | 2 udfyldte rækker i samme kolonne |
| Aktiveringstidspunkt | Straks ved fokus, opdateres dynamisk mens brugeren skriver |
| Ghost-tekst placering | Inline efter det brugeren har skrevet (ghost input-overlay) |
| Aktivering | Opt-out per default — alle understøttede felttyper får suggest |
| Kolonnekoblinger | Deklareres eksplicit per tabel via `columnLinks`-prop |
| Enter-adfærd | Accepter suggest hvis aktiv; ellers naviger ned (eksisterende adfærd) |
| Fokus efter accept | Cellen beholder fokus (ingen navigation videre) |
| LooseGridTable | Ikke aktiveret nu; arkitektur designes til fremtidig integration |

---

## Mønstergenkendelse

### Generelt princip

Mønstergenkendelse sker altid ud fra de **to seneste udfyldte rækker** i kolonnen (ikke nødvendigvis de øverste). Det giver det mest relevante mønster og undgår at gamle data dominerer.

### Dato (`TableDateInput`, `TableDateIsoInput`)

Understøttede mønstre (alle målt på den parsede dato):

| Mønster | Betingelse | Suggest |
|---|---|---|
| Første i måneden, +1 måned | Begge datoer er d. 1 i måneden, og måned(rad2) = måned(rad1) + 1 | Næste 1. i måneden |
| Sidste i måneden, +1 måned | Begge datoer er den sidste i måneden, måned(rad2) = måned(rad1) + 1 | Sidste dag i næste måned |
| Fast dag i måneden, +1 måned | Dag er ens i begge rækker, måned stiger med 1 | Samme dag, næste måned |
| Konstant interval (dage) | Forskel i dage er identisk mellem rad1→rad2 og rad2→rad3 (kræver 3 rækker) | Næste dato i samme interval |
| Ens dato | Begge datoer er identiske | Samme dato |

Hvis intet mønster genkendes: ingen suggest.

### Integer (`TableIntegerInput`) — selvstændig kolonne

| Mønster | Betingelse | Suggest |
|---|---|---|
| Konstant stigning | rad2 − rad1 = positiv konstant | rad2 + konstant |
| Konstant fald | rad1 − rad2 = positiv konstant | rad2 − konstant |
| Ens værdier | rad1 = rad2 | Samme værdi |

### Måned-kolonne (integer med `role: 'month'` via kolonnekoblinger)

Månedskolonner behandles anderledes end almindelige integers:

- Værdier er altid 1–12.
- Suggest er altid `(forrige + 1)`, med wrap fra 12 → 1.
- Når måneden wrapper til 1, signaleres dette til en koblet årstalskolonne.

### År-kolonne koblet til månedskolonne

- Behold samme årstal, så længe måneden ikke er wrappet.
- Når måneden wrapper (12 → 1): årstal + 1.

### `TableYearInput` — selvstændig (ingen månedskoblet kolonne)

Samme logik som integer, men begrænset til fornuftige årstal (1900–2100).

### `TableWeekInput`

Format: `WW/ÅÅÅÅ`. Suggest: næste uge. Uge 52/53 → uge 1 næste år.

### Beløb (`TableAmountInput`)

Beløbsmønstre er tilsigtet mere forsigtige:

| Mønster | Betingelse | Suggest |
|---|---|---|
| Ens beløb | rad1 = rad2 | Samme beløb |
| Stigning ved årsskifte | Beløb stiger fra rad1 til rad2, og en koblet dato/måned-kolonne har krydset et årsskifte | Suggest det nye (højere) beløb i resten af det år |
| Ellers | — | Ingen suggest (vent på klarere mønster) |

Udtryksværdier (`expression`): Suggest viser den **numeriske** værdi, ikke det originale udtryk.

### Procent (`TablePercentInput`)

Samme logik som beløb (ens = gentag; stigning = vent, medmindre årsskifte via kobling).

### Tekst (`TableTextInput`)

Kun ét mønster: rad1 = rad2 → suggest samme tekst. Ingen anden genkendelse.

---

## Kolonnekoblinger

Koblinger defineres som en ny prop på StandardGridTable og (fremtidigt) StandardLooseTable:

```typescript
type ColumnLink =
  | { kind: 'month-year'; monthColIndex: number; yearColIndex: number }
  | { kind: 'amount-date'; amountColIndex: number; dateColIndex: number }
  | { kind: 'amount-month-year'; amountColIndex: number; monthColIndex: number; yearColIndex: number };
```

```typescript
type StandardGridTableProps = {
  // ... eksisterende props
  columnLinks?: readonly ColumnLink[];
};
```

Koblinger bruges udelukkende af mønstergenkendelseslogikken — de påvirker ikke rendering, navigation eller validering.

---

## Visuel udformning: ghost input-overlay

### Teknisk løsning

Hver celle med suggest renderes med en container med `position: relative`. Oven i `<input>`-elementet placeres et `<span>` med `position: absolute`, som viser:

```
[det brugeren har skrevet][ghost-del][ENTER]
```

Ghost-delen er den del af suggest-værdien, der **ikke** allerede er dækket af brugerens input.

Eksempel: Suggest er `01-06-2025`, brugeren har skrevet `01-`. Ghost-span'et viser: `06-2025 [ENTER]`.

### Styling

```
ghost-tekst:  color: rgba(0, 0, 0, 0.35)   font, size, weight identisk med input
ENTER-badge:  inline-block, border: 1px solid rgba(0,0,0,0.25), border-radius: 3px,
              font-size: 0.65em, padding: 0 3px, margin-left: 4px,
              color: rgba(0,0,0,0.35), vertical-align: middle
```

Input-feltet renderes med `color: transparent` og `caret-color: <normal>`, så brugerens egne tegn er usynlige i selve inputtet — men carettet forbliver synligt. Ghost-span'et viser både brugerens tegn og ghost-teksten i samme font. Dette er det klassiske "ghost input"-mønster og undgår problemer med z-index, pointer-events og selektion.

Input-feltet forbliver ovenpå ghost-span'et i DOM-rækkefølge og fanger alle pointer-events normalt.

---

## Arkitektur og filstruktur

### Nye filer

```
src/components/tables/autofillSuggest/
  autofillSuggestTypes.ts       — typer: ColumnLink, SuggestResult, FieldRole
  autofillSuggestEngine.ts      — ren mønstergenkendelse (ingen React, ingen side-effects)
  useAutofillSuggest.ts         — React-hook: beregner suggest for én celle
  AutofillGhostOverlay.tsx      — ghost-span + ENTER-badge (præsentationskomponent)
```

### Ændrede filer

```
src/components/tables/StandardGridTable.tsx
  — tilføj columnLinks-prop
  — send columnLinks ned via ny AutofillSuggestContext

src/components/tables/gridCore/tableKeyboardNavigation.ts
  — modificér Enter-handling: tjek autofill-suggest-callback før nedadnavigation

src/components/inputs/table/TableDateInput.tsx      — integrer AutofillGhostOverlay
src/components/inputs/table/TableDateIsoInput.tsx   — integrer AutofillGhostOverlay
src/components/inputs/table/TableIntegerInput.tsx   — integrer AutofillGhostOverlay
src/components/inputs/table/TableAmountInput.tsx    — integrer AutofillGhostOverlay
src/components/inputs/table/TableYearInput.tsx      — integrer AutofillGhostOverlay
src/components/inputs/table/TableWeekInput.tsx      — integrer AutofillGhostOverlay
src/components/inputs/table/TablePercentInput.tsx   — integrer AutofillGhostOverlay
src/components/inputs/table/TableTextInput.tsx      — integrer AutofillGhostOverlay
```

### Ny context til suggest-data

```typescript
// AutofillSuggestContext leverer tabeldata + columnLinks til input-komponenterne
// uden at de behøver kende til tabelstrukturen.
type AutofillSuggestContextValue = {
  getColumnValues: (colIndex: number) => readonly string[];  // Alle committed værdier i kolonnen, top-down
  columnLinks: readonly ColumnLink[];
};
```

Input-komponenterne læser context via `useAutofillSuggest(gridCell)` og modtager en `SuggestResult | null`.

---

## Dataflow

```
StandardGridTable
  → modtager tableData (som children) + columnLinks
  → AutofillSuggestContext.Provider leverer getColumnValues + columnLinks

Input-komponent (fx TableDateInput)
  → kalder useAutofillSuggest({ rowId, colIndex })
  → hook kalder autofillSuggestEngine med kolonneværdier + links
  → modtager SuggestResult | null
  → renderer AutofillGhostOverlay hvis suggest != null
  → lytter på Enter: hvis suggest aktiv → commit suggest-værdi, behold fokus
```

---

## Enter-interceptering

Enter-tasten håndteres i dag i `tableKeyboardNavigation.ts`. Intercepteringen skal ske **tættere på input-komponenten** for at undgå at forurene det generelle navigationssystem med suggest-viden.

**Løsning:** Hver input-komponent tilføjer en `onKeyDown`-handler der tjekker for Enter, når en suggest er aktiv. Hvis aktiv: commit suggest-værdien og kald `event.stopPropagation()`. Det forhindrer `tableKeyboardNavigation` i at modtage eventet og navigere ned.

Fokus forbliver i cellen (ingen `requestFocusPlan` kaldes).

Eksisterende Enter-navigation (ingen suggest) er upåvirket.

---

## Stadier

### Stadie 1 — Fundament og engine (ingen UI-ændringer)

**Mål:** Mønstergenkendelseslogikken er implementeret og testet isoleret.

1. Opret `autofillSuggestTypes.ts` med `ColumnLink`, `SuggestResult`, `FieldRole`.
2. Opret `autofillSuggestEngine.ts` med rene funktioner for hvert mønster.
3. Skriv unit tests for alle mønstre og edge cases (se testplan).

**Ingen React-kode i dette stadie. Ingen UI-ændringer.**

Forudsætning: ingen.
Risiko: lav — ren logik, ingen side-effects.

---

### Stadie 2 — Context og hook

**Mål:** Suggest-data er tilgængeligt fra input-komponenterne via context.

1. Opret `AutofillSuggestContext` og `useAutofillSuggest`-hook.
2. Tilføj `columnLinks`-prop til `StandardGridTable`.
3. Tilpas StandardGridTable til at levere `AutofillSuggestContext.Provider`.
4. `useAutofillSuggest` returnerer `null` for alle celler (endnu ikke koblet til engine).

**Ingen synlig UI-ændring.**

Forudsætning: Stadie 1 færdigt.
Risiko: lav — context er passiv, ingen adfærdsændring.

---

### Stadie 3 — Kobling af engine til hook

**Mål:** Hook returnerer korrekte suggest-værdier baseret på tabeldata.

1. `useAutofillSuggest` læser `getColumnValues` fra context og kalder engine.
2. Testes manuelt i én tabel med simple integer-kolonner.

**Ingen synlig UI-ændring endnu (ingen overlay).**

Forudsætning: Stadie 2 færdigt.
Risiko: medium — her opdages fejl i engine eller data-mapping.

---

### Stadie 4 — Ghost overlay og visning

**Mål:** Suggest-værdien vises visuelt i understøttede input-typer.

1. Implementer `AutofillGhostOverlay`-komponenten.
2. Integrer overlay i alle 8 input-typer.
3. Tilføj `color: transparent` / `caret-color` logik til input-styling.
4. Verify: overlay vises/skjules korrekt ved fokus/blur.
5. Verify: ghost-tekst matcher brugerens input dynamisk.

**Første synlige UI-ændring.**

Forudsætning: Stadie 3 færdigt.
Risiko: medium — styling-koordination mellem input og overlay kan kræve justering.

---

### Stadie 5 — Enter-accept og fokushåndtering

**Mål:** Enter accepterer suggest og fokus forbliver i cellen.

1. Tilføj `onKeyDown` Enter-interceptering i alle 8 input-typer.
2. Commit suggest-værdien til den eksisterende commit-pipeline (samme som bruger-input).
3. Kald `event.stopPropagation()` for at forhindre nedadnavigation.
4. Test: Enter uden suggest → navigation ned (uændret).
5. Test: Enter med suggest → commit + fokus i cellen.
6. Test: Tab med suggest → navigation (suggest forkastes, uændret adfærd).

Forudsætning: Stadie 4 færdigt.
Risiko: lav — isoleret til onKeyDown-handler i input-komponenter.

---

## Testplan

### Unit tests (Stadie 1)

Placering: `src/__tests__/autofillSuggest/autofillSuggestEngine.test.ts`

**Datoer:**
- Første i måneden, to rækker → suggest første næste måned
- Første i måneden, kryds til næste år (december → januar)
- Sidste i måneden, variabel dagstælling
- Ens datoer
- Ingen match → null

**Integer:**
- Konstant stigning (+1, +7, +100)
- Konstant fald
- Ens værdier
- Uens stigning → null

**Måned/år-kobling:**
- Måned 11 → 12 → suggest 1 (næste år i årstalskolonne)
- Måned 12 → suggest 1, årstal+1
- Korrekt wrap: januar i det nye år

**Beløb:**
- Ens → gentag
- Stigning uden datokryds → null
- Stigning med kryds af nytår (via koblet kolonne) → suggest nyt beløb

**Uge:**
- Uge 51/2024 → 52/2024
- Uge 52/2024 → 1/2025 (uge 53 for år der har det)

**Tekst:**
- Ens → gentag
- Forskellige → null

### Integrations-/visuelle tests (Stadie 4–5)

Disse testes manuelt: ghost-tekst vises korrekt, ENTER-badge er synlig, Enter-accept fungerer, Tab navigerer forbi uden accept.

---

## Fremtidig udvidelse til LooseGridTable

Arkitekturen er designet til dette fra starten:

- `AutofillSuggestContext` er tabel-agnostisk — leveres også af `StandardLooseTable`.
- `AutofillGhostOverlay` er en ren præsentationskomponent uden binding til tabeltype.
- `useAutofillSuggest`-hook er uafhængig af tabeltype.
- Enter-interceptering i input-komponenterne virker uanset omgivende tabel.

Aktivering i LooseGridTable kræver: (1) tilføj `columnLinks`-prop til `StandardLooseTable`, (2) tilføj `AutofillSuggestContext.Provider` i `StandardLooseTable`. Ingen ændringer i engine, hook eller overlay.

---

## Afgrænsninger

- `TableDropdown` understøttes ikke.
- Suggest virker ikke på tværs af rækker der er sorterede/filtrerede anderledes end DOM-rækkefølge — rækkefølge bestemmes af DOM-order.
- Suggest tager ikke højde for låste celler (`getIsLocked`): overlay vises ikke i låste celler.
- Der gemmes ingen suggest-historik eller bruger-præferencer.
- Ingen server-side kald, ingen telemetri, ingen nye runtime-dependencies.
