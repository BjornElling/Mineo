# Implementeringsplan: MinProcesrente mobiloptimering

**Dato:** 2026-05-25  
**Review:** 2026-05-25  
**Status:** Revideret efter review — ikke implementeret  
**Formål:** Gøre MinProcesrente brugbar på mobilskærme uden at ændre desktopvisningen og uden at indføre parallellogik eller rod i kodebasen.

---

## Problemdiagnose

Tre separate problemkategorier kræver tre separate løsningsstrategier:

### A. Layoutproblemer (ren CSS/responsiv styling)
- `Beregningsdato`-boksen: teksten i labelen er for bred og ombrydes på xs-skærme
- Hover-baggrunden på tabelrækker aktiveres ved klik på touch-enheder (ingen hover-support), hvilket giver et forvirret visuelt udslag

### B. Tabelpladsproblem (datadrevet konditionel rendering)
- `BeregnetRenteTable` har fast bredde på 1130 px og 7 kolonner — kan ikke passe på en mobilskærm (~375 px) uden horisontal scroll
- Scroll i tabellen er uacceptabelt. Løsningen er at skjule kolonner der ikke er nødvendige for den primære brugerværdi på mobil (Evt. tillægstid + Rentedato + Specifikation)

### C. Interaktionsproblemer (hook-adfærd, kun mobilrelevant)
- Table-inputs bruger grid-editing-systemet (`useGridCoreController` → `GridCore`). "Redigering" aktiveres normalt ved første Enter/klik åbner fokus, andet åbner editor. På touch er der ingen cursor-focus-fase — brugeren forventer at tastaturet dukker op ved første tryk
- Download-knappen pr. række i tabellen forsvinder på mobil, da kolonnen skjules. Brugeren har brug for et alternativ

---

## Kernebeslutning: Én `isMobile`-prop, ingen global kontekst

`isMobile` beregnes ét sted:

```ts
// MinProcesrenteCalculatorPage.tsx
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
```

Flyder ned som prop i tre led: `MinProcesrenteCalculatorPage` → `RenteberegningTab` → `BeregnetRenteTable`. Det er acceptabel prop-drilling for dette antal led. Ingen global React context, ingen spredte `useMediaQuery`-kald.

`RenteberegningTab` er delt mellem Mineo og MinProcesrente. `isMobile` tilføjes som optional prop med `default: false`. Mineo sender den aldrig, og Mineos adfærd ændres ikke.

`BeregnetRenteTable` modtager ligeledes `isMobile?: boolean` med `default: false`.

---

## Stadie 1 — CSS-rettelser (ingen funktionel risiko)

**Scope:** `MinProcesrenteCalculatorPage.tsx`, `BeregnetRenteTable.tsx`

### 1a. Hover-suppression på touch-enheder

I `BeregnetRenteTable`'s `StandardLooseTable`-kald tilføjes til `sx`:

```ts
'& .MuiTableRow-root:hover': {
  '@media (hover: hover)': {
    backgroundColor: 'var(--color-row-hover)',
  },
  '@media (hover: none)': {
    backgroundColor: 'transparent',
  },
},
```

`@media (hover: none)` matcher præcist touch-enheder. Desktopvisning er uændret.

> **Review-note:** `var(--color-row-hover)` eksisterer ikke i kodebasen (verificeret: `getMuiTableStyles` i [src/config/tableTheme.ts](src/config/tableTheme.ts) definerer ingen hover-variabel). Brug i stedet `theme.palette.action.hover` via MUI's `sx`-callback-form:
> ```ts
> '& .MuiTableRow-root': {
>   '@media (hover: hover)': {
>     '&:hover': { backgroundColor: (theme) => theme.palette.action.hover },
>   },
>   '@media (hover: none)': {
>     '&:hover': { backgroundColor: 'transparent' },
>   },
> },
> ```
> Alternativt: undersøg om `getMuiTableStyles` bør tilføje hover-CSS-variablen, så mønstret holdes centralt.

### 1b. Beregningsdato-label på mobil

I `MinProcesrenteCalculatorPage`'s `sx`-blok tilføjes til `& .row--text`:

```ts
'& .row--text': {
  fontSize: { xs: '13px', sm: 'inherit' },
},
```

Eksisterende sx-blok i `MinProcesrenteCalculatorPage` håndterer allerede responsiv styling via samme mønster (`flexDirection`, `alignItems` osv.). Tilføjelsen følger det etablerede mønster.

> **Review-note:** `& .row--text` er en global klasseafhentning fra `sx`-blokken på root-`Box`. Den vil påvirke **alle** `row--text`-elementer i hele `MinProcesrenteCalculatorPage`, ikke kun `Beregningsdato`-boksen. Overvej om det er intentionelt, at beregnet rente-talværdierne i tabellen også reduceres til 13px på mobil. Hvis ikke, kræves en mere specifik selektor, f.eks. `'& .content-box--beregningsdato .row--text'` med en målrettet `className` på den boks.

---

## Stadie 2 — Mobilkolonner i `BeregnetRenteTable`

**Scope:** `BeregnetRenteTable.tsx`, `RenteberegningTab.tsx`, `MinProcesrenteCalculatorPage.tsx`

### Kolonner der fjernes på mobil

| Kolonne | Årsag til fjernelse |
|---|---|
| Evt. tillægstid (2 cols) | Sjælden brug, kan angives/redigeres via desktop-version |
| Rentedato | Afledt outputkolonne, ikke brugerinput |
| Specifikation (download-knap) | Erstattes af ny samlet download-boks (Stadie 4) |

### Tilbageværende kolonner og bredder

| Kolonne | Desktop-bredde | Mobil-bredde |
|---|---|---|
| Beløb | 176 px | 130 px |
| Renter fra | 163 px | 120 px |
| Beregnet rente | 151 px | 120 px |
| **Total** | — | **370 px** |

370 px passer til 375 px telefon med standard MUI-padding.

### Implementeringsstrategi

Kolonnekonfigurationen centraliseres som data øverst i `BeregnetRenteTable.tsx`:

```ts
const DESKTOP_COLUMNS = ['belob', 'renterFra', 'tillaegstid', 'enhed', 'rentedato', 'beregnetRente', 'specifikation'] as const;
const MOBILE_COLUMNS  = ['belob', 'renterFra', 'beregnetRente'] as const;
```

`BeregnetRenteTable` og `BeregnetRenteRow` modtager `isMobile: boolean` og renderer konditionelt `<TableCell>`-indhold og `<col>`-bredder baseret på dette.

**CSS-baseret skjul via `display: none` frarådes.** Det er skrøbeligt med `tableLayout: fixed` og eksplicitte `<col>`-bredder: `<col>`, `<th>` og alle `<td>` i kolonnen skal synkroniseres manuelt. Betinget render er renere.

> **Review-note (header-struktur):** Desktop-headeren har `<TableCell colSpan={2}>Evt. tillægstid</TableCell>` for kolonne 3+4 (tillaegstid + enhed). På mobil fjernes begge disse `<td>`. Header-raden skal tilsvarende have `colSpan`-cellen og enhed-cellen fjernet betinget — ellers stemmer antal `<th>` ikke overens med antal `<td>` i body-rækkerne. Beskriv eksplicit at `<TableCell colSpan={2}>` fjernes og erstattes af ingenting (ikke af to tomme celler) på mobil.

> **Review-note (sortering):** `BeregnetRenteTable` har `StandardLooseHeaderCell` med `onClick={() => handleHeaderClick('belob')}` og `handleHeaderClick('renterFra')`. Disse sort-handlers er koblet til kolonne-id'er, ikke colIndex. De forbliver funktionelle på mobil uden ændringer — dette bør bekræftes eksplicit i planen, da `useTableSort` er data-drevet og ikke afhænger af den rendererede DOM-struktur.

### Bredde på mobilbord

```ts
sx={{
  tableLayout: 'fixed',
  width: isMobile ? '370px' : '1130px',
  ...
}}
```

`overflowX: 'auto'` i `RenteberegningTab`'s wrapper fjernes/justeres på mobil, da tabellen nu passer i viewporten. Konkret: wrapperen beholder `overflowX: 'auto'` som fallback, men den udløses ikke ved korrekte mobilbredder.

### colIndex-invariant (VIGTIGT)

`BeregnetRenteRow` sætter `gridCell={{ rowId: row.id, colIndex: N }}` på hvert input. Disse colIndex-værdier bruges af `GridCore` og `tableKeyboardNavigation` til at identificere celler på tværs af naviger og fokusplaner. Når mobilkolonner fjernes, **ændres den fysiske `<td>`-placering**, men colIndex-værdierne i `gridCell`-props **skal forblive stabile** og identiske med desktop-værdierne.

Konkret: `BeregnetRenteRow` bruger i dag colIndex 0 (belob), 1 (renterFra), 2 (tillaegstid), 3 (enhed). På mobil renderes kun colIndex 0 og 1. De to resterende `<td>` forsvinder. `tableKeyboardNavigation.buildGrid()` scanner `cell.cellIndex` på faktiske `<td>`-elementer i DOM'en og matcher dem mod de registrerede colIndex-værdier. Da færre `<td>` renderes, vil `cellIndex` for "beregnet rente"-cellen på mobil være 2 — men den har ingen inputs og GridCore bruger den ikke. Kolonnerne 0 og 1 er de eneste med registrerede editors og vil fungere korrekt. Ingen ændring er nødvendig for denne invariant.

> **Review-note (colIndex-analyse er korrekt men ukomplet):** `buildGrid()` i `tableKeyboardNavigation.ts` bruger `cell.cellIndex` (den fysiske DOM-`<td>`-position) og ikke colIndex-prop'en direkte. Analysen i planen er korrekt: belob (colIndex 0) er `cellIndex` 0, renterFra (colIndex 1) er `cellIndex` 1 på mobil — de stemmer stadig overens. Men planen nævner ikke `Tab`-navigation: `handleTableKeyDownCapture` bygger gitternavigation over alle registrerede `gridCell`-inputs i tabellen. Siden colIndex 2+3 slet ikke er registrerede på mobil, hopper Tab direkte fra renterFra til næste række. Det er acceptabelt adfærd, men det bør beskrives eksplicit i planen som forventet adfærd, ikke som en uafklaret konsekvens.

---

## Stadie 3 — Øjeblikkelig aktivering af table-inputs på mobil

**Scope:** `useGridCoreController.ts`, `StandardLooseTable.tsx`, `BeregnetRenteTable.tsx`, `RenteberegningTab.tsx`, `MinProcesrenteCalculatorPage.tsx`

### Analyse af nuværende aktiveringsflow (opdateret efter kildekode-gennemgang)

Det eksisterende to-trins-system er implementeret i `tableKeyboardNavigation.ts` via `handleTablePointerDownCapture`:

```ts
// tableKeyboardNavigation.ts linje 636
const editing = core.getEditingCell();
if (isSameCell(activeCell, cell) && !isSameCell(editing, cell)) {
  core.openEditing(cell, 'pointer');
}
```

Logikken er: **kun** hvis `activeCell === cell` OG `editingCell !== cell` kalder den `openEditing`. Det vil sige: første tryk sætter focus (via `handleTableFocusCapture`), andet tryk på samme celle åbner editor.

På touch er der ingen "hover/focus"-fase før tryk. Første fingertryk genererer `focus` + `pointerdown` i ét flow. Betingelsen `activeCell === cell` er falsk ved første tryk fordi `setFocusedCell` (kaldt fra `handleTableFocusCapture`) opdaterer state asynkront via `notifyStoreChange(false)` + `bumpStoreVersion()`. Fokus-state er derfor ikke garanteret opdateret inden `handleTablePointerDownCapture` evaluerer `activeCell`.

### Løsning: `immediateEditing`-prop i `useGridCoreController` og `StandardLooseTable`

`immediateEditing: boolean` tilføjes som option til `useGridCoreController`:

```ts
// useGridCoreController.ts
type UseGridCoreControllerOptions = Readonly<{
  tableKind?: GridCoreTableKind;
  immediateEditing?: boolean;
}>;
```

Effekten er at `handleTablePointerDownCapture` hopper direkte til `openEditing` uden at tjekke om cellen allerede er fokuseret. Den enkleste implementering: `immediateEditing`-flaget gemmes på controller-objektet og `tableKeyboardNavigation.handleTablePointerDownCapture` læser det via `core`:

```ts
// Alternativ: sæt flag direkte på table-elementet som data-attribut
// data-mineo-immediate-editing="true"
// handleTablePointerDownCapture læser table.dataset.mineoImmediateEditing
```

**Data-attribut-tilgangen anbefales** frem for at udvide `GridCoreController`-typerne, fordi `tableKeyboardNavigation.ts` allerede bruger `getGridCoreForTable(table)` — den har adgang til `table`-elementet og kan læse attributten direkte uden at ændre `GridCorePublicAPI`-kontrakten eller `gridCoreTypes.ts`.

`StandardLooseTable` tilføjer `immediateEditing?: boolean` til sine props og sætter `data-mineo-immediate-editing={immediateEditing ? 'true' : undefined}` på `<Table>`-elementet. `useGridCoreController` behøver ikke ændres.

`BeregnetRenteTable` sender `immediateEditing={isMobile}` til `StandardLooseTable`.

**Keyboard-navigation er uberørt.** `handleTableKeyDownCapture` påvirkes ikke. `handleTableFocusCapture` påvirkes ikke. Kun den del af `handleTablePointerDownCapture` der evaluerer "er cellen allerede fokuseret?" justeres.

**Desktop-test:** `isMobile` er `false` → `immediateEditing` er `false` → `data-mineo-immediate-editing` sættes ikke → al eksisterende pointer-down-logik er uændret.

> **Review-note (immediateEditing præcisering):** I `handleTablePointerDownCapture` (linje 636) er betingelsen `isSameCell(activeCell, cell) && !isSameCell(editing, cell)`. Med `immediateEditing` skal betingelsen ændres til: **åbn editing straks, uanset om `activeCell === cell`**. Den korrekte implementering er:
> ```ts
> const immediateEditing = table.dataset.mineoImmediateEditing === 'true';
> if (immediateEditing || (isSameCell(activeCell, cell) && !isSameCell(editing, cell))) {
>   if (!isSameCell(editing, cell)) {
>     core.openEditing(cell, 'pointer');
>   }
> }
> ```
> Tjek at `!isSameCell(editing, cell)`-guard bevares også i immediateEditing-stien — ellers vil et allerede åbent editor-input få `openEditing` kaldt igen ved hvert touch, hvilket kan nulstille editorens interne state.
>
> **Review-note (touch vs. pointer events):** `handleTablePointerDownCapture` håndterer `PointerEvent`, som på touch udløses *før* `focus`-eventet. `setFocusedCell` er asynkron (via `notifyStoreChange`). Med `immediateEditing` åbner vi editing ved `pointerdown`, men fokus er endnu ikke sat på inputfeltet. `openEditing` skal sætte `editingCell` via `setEditingCell` og `requestFocusPlan`. Verificér at `requestFocusPlan` ikke kræver at `focusedCell` allerede er sat, eller at der ikke opstår en race-condition hvor `handleTableFocusCapture` (der kører umiddelbart efter) overskriver editing-state.

---

## Stadie 4 — Samlet download-boks til mobilvisning

**Scope:** Ny `SpecifikationDownloadBox.tsx`, `RenteberegningTab.tsx`, `MinProcesrenteCalculatorPage.tsx`, `standaloneRentePdfService.ts`, `rentePdf.ts`

### Valgt løsning: Én "Download alle" knap

Valgmulighed A er valgt: én boks med én knap der genererer ét samlet PDF-dokument med alle rente-specifikationer.

### PDF-lag: `generateRentePdf` returnerer `jsPDF`-dokument

`rentePdf.ts`'s `generateRentePdf` ændres til at returnere det oprettede `jsPDF`-dokument i stedet for at kalde `.save()` direkte. `.save()`-kaldet flyttes op til `standaloneRentePdfService.ts`. Ændringen er intern og bryder ikke den eksternt synlige signatur ud over return-typen.

**Konkret:** `writer.save(filename)` i `generateRentePdf` fjernes. Funktionen returnerer `{ doc: writer.getDoc(), filename }`. `downloadStandaloneRentePdf` kalder `.save()` på det returnerede dokument.

**Hvorfor return `{ doc, filename }` frem for bare `jsPDF`?** Filnavnet beregnes inde i `generateRentePdf` (baseret på `buildRentePdfBaseTitle` + `buildRentePdfFilename`). Hvis vi returnerer bare `jsPDF`, duplikeres filnavnslogikken i `downloadAllStandaloneRentePdf`. Ved at returnere `{ doc, filename }` bevares single authority over filnavnet.

`PdfWriter`-typen (`pdfWriter.ts`) eksponerer allerede `getDoc(): jsPDF` og `save(filename: string): void`. Ingen ændringer i `pdfWriter.ts` er nødvendige.

> **Review-note (return-type ændring er faktisk et breaking change):** Planens "Hvad der ikke ændres"-tabel angiver at `generateRentePdf` PDF-output er "Uændret for Mineo; return-type ændres (void → { doc, filename })". Mineo's `Renteberegning.tsx` bruger `generateRentePdf` via `downloadStandaloneRentePdf`, men `generateRentePdf` er eksporteret og _kan_ bruges direkte. Verificér med `grep` at `generateRentePdf` ikke bruges direkte uden om service-laget. Planens "Hvad der ikke ændres"-tabel er delvist inkonsistent med sig selv: den siger `downloadStandaloneRentePdf` er "eksternt uændret" men returnerer nu `{ success, error }` _og_ kalder `.save()` internt — det er korrekt og uændret for kaldsiden. Præcisér dette i tabellen.
>
> **Review-note (brevhoved-understøttelse):** Nuværende `generateRentePdf` accepterer `visBrevhoved` og `stamdata` via `RentePdfOptions`. Den nye `writeRentePdfContent`-hjælpefunktion skal bevare disse parametre — ellers mister Mineo-versionen (med brevhoved-support) funktionalitet. Verificér at `visBrevhoved`/`stamdata`-håndteringen inkluderes i `writeRentePdfContent`, ikke kun i `generateRentePdf`-wrapperen.

### Ny PDF-funktion: `downloadAllStandaloneRentePdf`

Tilføjes til `standaloneRentePdfService.ts` som ny exported funktion — ikke som ændring af `downloadStandaloneRentePdf`.

```ts
export const downloadAllStandaloneRentePdf = async (params: Readonly<{
  rows: ReadonlyArray<Readonly<{
    beloeb: number;
    actualInterestDate: string;
    beregningsdato: string;
    periods: ReadonlyArray<ProcessInterestPeriod>;
    latestReferenceRateDate: string | null;
  }>>;
  kommentarer?: string;
}>): Promise<PdfDownloadResult>
```

Implementeringen:
1. Henter `generateRentePdf` via dynamisk import (samme mønster som `downloadStandaloneRentePdf`)
2. Kalder `generateRentePdf` for hver række — det returnerer nu `{ doc, filename }`
3. Appender siderne fra dokument 2..N til dokument 1 via `jsPDF`'s `addPage` + side-kopiering
4. Kalder `.save(filename)` på det samlede dokument

**Bemærk om side-kopiering:** `jsPDF` understøtter ikke native merge af to `jsPDF`-instanser. Den anbefalede tilgang er at bruge `jsPDF`'s interne `pdf`-objekt og kopiering af sider via `doc.internal.pages`, men dette er en udokumenteret intern API der kan ændres.

**Anbefalet alternativ:** I stedet for at forsøge at merge dokumenter, ændres `generateRentePdf` til at acceptere et optional eksisterende `jsPDF`-dokument der appendes til:

```ts
export const generateRentePdf = (
  amount: number,
  interestStartDate: string,
  calculationDate: string,
  periods: ReadonlyArray<ProcessInterestPeriod>,
  options: RentePdfOptions = {},
  appendToDoc?: jsPDF  // ny optional parameter
): jsPDF => { ... }
```

Når `appendToDoc` er givet, kalder `createStandardPdfWriter` en variant der appender til det eksisterende dokument i stedet for at oprette et nyt. `pdfWriter.ts` eksponerer allerede `addPage()` og `setY()` — men `createStandardPdfWriter` tager ikke et eksisterende `jsPDF`-dokument som input.

**Enkleste korrekte implementering uden at udvide `pdfWriter.ts`:**

`generateRentePdf` eksponerer en ny variant `generateRentePdfSection` der returnerer `{ doc: jsPDF, filename: string }` uden at kalde `.save()`, og `downloadAllStandaloneRentePdf` kalder den for hver række, tilføjer `doc.addPage()` manuelt mellem afsnit og skriver alt til ét dokument.

Denne tilgang kræver en ny intern hjælpefunktion `generateRentePdfToDoc` i `rentePdf.ts` der bygger indholdet i et givet `PdfWriter`-objekt uden at save — den nuværende `generateRentePdf` er allerede struktureret som en sekventiel kald-kæde (`addDescription` → `addSpecificationTable` → `addCalculationPrinciples` → `addFooter`). Udtræk disse trin til en intern `writeRentePdfContent(writer, ...)`:

```ts
// rentePdf.ts — intern hjælpefunktion
const writeRentePdfContent = (
  writer: PdfWriter,
  amount: number,
  startDate: Date,
  endDate: Date,
  periods: ReadonlyArray<ProcessInterestPeriod>,
  options: RentePdfOptions
): void => {
  writer.writeTitle('Procesrente');
  addDescription(writer, amount, startDate, endDate);
  addSpecificationTable(writer, periods, endDate,
    options.latestReferenceRateDate ? parseDanishDate(options.latestReferenceRateDate) : null);
  addCalculationPrinciples(writer, options.kommentarer);
  writer.addFooter();
};

// Eksisterende generateRentePdf kalder writeRentePdfContent + writer.save()
// Ny generateRentePdfToWriter(writer, ...) kalder kun writeRentePdfContent
```

`downloadAllStandaloneRentePdf` opretter ét `PdfWriter`-objekt og kalder `generateRentePdfToWriter` for hver række, med `writer.addPage()` mellem rækkerne. Til sidst kalder den `writer.save(filename)`.

Dette er det eneste mønster der fuldt ud genbruger eksisterende writer-infrastruktur uden at berøre `pdfWriter.ts` og uden at stole på udokumenterede `jsPDF`-internals.

**Filnavn på det samlede dokument:** Brug det første rows' filnavn med en `+N`-suffix eller en generisk "Procesrente-specifikationer.pdf". Definér konkret adfærd i implementering.

> **Review-note (PdfWriter-cursor-state ved `addPage`):** `pdfWriter.ts`'s `addPage()` nulstiller Y-cursoren til `MARGINS.top` og tilføjer udkast-vandmærke hvis sat. `generateRentePdfToWriter` skal kalde `writer.addPage()` *mellem* sektioner, ikke efter. Verificér at den *første* sektion ikke får en unødvendig `addPage()` kaldt forud — ellers starter den første sektion på side 2. Den korrekte løkke-struktur er:
> ```ts
> rows.forEach((row, i) => {
>   if (i > 0) writer.addPage();
>   generateRentePdfToWriter(writer, row, ...);
> });
> ```
>
> **Review-note (footer på multi-sektion dokument):** Verificeret: `addFooter` i `pdfHelpers.ts` itererer over `for (let i = 1; i <= totalPages; i++)` og sætter footer på **alle** sider. Det betyder at `addFooter()` *skal* kaldes *én* gang til allersidst efter alle sektioner er skrevet — ikke inde i `generateRentePdfToWriter` per sektion. Planen skal eksplicit præcisere dette: `generateRentePdfToWriter` kalder IKKE `writer.addFooter()`; `downloadAllStandaloneRentePdf` kalder den én gang efter løkken.

### Ny komponent: `SpecifikationDownloadBox`

```ts
// src/components/pages/renteberegning/SpecifikationDownloadBox.tsx
interface Props {
  rows: ReadonlyArray<RentePdfContext>;
  kommentarer?: string;
  onDownloadAll: () => Promise<void>;
  errorMessage: string | null;
  isLoading?: boolean;
}
```

Komponenten er en `ContentBoxComponent`-styled boks med:
- Overskrift: "Download specifikationer"
- Én `Button` med ikon: "Download alle som PDF"
- `isLoading`-tilstand på knappen under generering
- Fejlbesked ved `errorMessage !== null`

Vises kun når `isMobile && rows.length > 0`. Placeres i `RenteberegningTab` mellem "Beregnet rente"-boksen og "Kommentarer"-boksen.

### Prop-flow

`MinProcesrenteCalculatorPage` tilføjer `onDownloadAllSpecifikationer` callback og sender det til `RenteberegningTab` som ny optional prop. Callback bygger parameter-arrays fra de committede rækker (med ISO→dansk dato-konvertering via `isoToDanish`) og kalder `downloadAllStandaloneRentePdf`.

**Dato-konvertering:** `pdfContext.actualInterestDate` er `ISODateString`. `downloadAllStandaloneRentePdf` forventer dansk datoformat (dd-mm-åååå) som eksisterende `downloadStandaloneRentePdf`. Konverteringen `isoToDanish` sker i `MinProcesrenteCalculatorPage`-callbacket — præcis samme mønster som `handleDownloadRentePdf`.

> **Review-note (datakilde til "Download alle"):** `MinProcesrenteCalculatorPage` har adgang til `rentekrav.committedById` (via `committedRentekravById`-prop'en til `RenteberegningTab`). Men `pdfContext`-objektet til brug for download-alle skal komme fra `pdfContext`-feltet i `RentekravRowResult`, ikke direkte fra committed rows — `pdfContext` indeholder allerede beregnet `actualInterestDate` og `periods`. Der er to mulige tilgange:
> 1. Send `onDownloadAllSpecifikationer` som callback til `RenteberegningTab`, og lad `RenteberegningTab` (eller `BeregnetRenteTable`) akkumulere `pdfContext`-objekterne fra rækkerne og sende dem op via callbacket.
> 2. Genberegn alle `pdfContext`-objekter i `MinProcesrenteCalculatorPage`-callbacket ved hjælp af `computeRentekravRow` for hver committed row.
>
> Tilgang 1 er korrekt — den genbruger den allerede beregnede `pdfContext` der eksisterer i `BeregnetRenteRow`. Tilgang 2 er duplikation af beregningslogik. Planen nævner "bygger parameter-arrays fra de committede rækker" men specificerer ikke præcist hvilke værdier der hentes hvor. Præcisér at datakilde er de eksisterende `pdfContext`-objekter akkumuleret fra `BeregnetRenteRow`, ikke en genberegning.
>
> **Review-note (`SpecifikationDownloadBox` Props-interface):** `onDownloadAll: () => Promise<void>` i Props-interfacet passer ikke med at callbacket returnerer `PdfDownloadResult`. Enten skal `onDownloadAll` returnere `PdfDownloadResult` og `SpecifikationDownloadBox` sætte `errorMessage` baseret på result, eller `errorMessage` og `isLoading` håndteres udelukkende i den parent der ejer callbacket. Vælg én model og beskriv den eksplicit.

---

## Stadie 5 — Tests

Tests følger eksisterende mønstre i `src/__tests__/`.

### Påkrævede tests

**`BeregnetRenteTable` med `isMobile`:**
- Test at mobilkolonner (`belob`, `renterFra`, `beregnetRente`) renderes
- Test at desktopkolonner (`tillaegstid`, `enhed`, `rentedato`, `specifikation`) ikke renderes på mobil
- Test at desktopkolonner renderes normalt når `isMobile: false`

**PDF (download-alle):**
- Test at `downloadAllStandaloneRentePdf` med 2 rækker genererer et dokument uden exception
- Test at `downloadAllStandaloneRentePdf` med 0 rækker returnerer en fejl (eller ignoreres — definér adfærden)
- Test at `downloadStandaloneRentePdf` (eksisterende) fortsat fungerer uændret
- Test at `writeRentePdfContent` kan kaldes to gange på samme `PdfWriter` uden at overskrive første sektion

**`SpecifikationDownloadBox`:**
- Test at boksen vises ved `isMobile: true` og rows.length > 0
- Test at boksen ikke vises ved `isMobile: false`
- Test at onDownloadAll-callbacket aktiveres ved klik

**GridCore `immediateEditing` (Stadie 3):**
- Test at `data-mineo-immediate-editing="true"` på table resulterer i at `openEditing` kaldes ved første pointerdown på en ikke-fokuseret celle
- Test at standard to-trins-flow bevares når attributten ikke er sat
- Test at `openEditing` **ikke** kaldes igen hvis cellen allerede er i editing-state (guard mod dobbeltkald)

---

## Hvad der ikke ændres

| Komponent/modul | Status |
|---|---|
| `Renteberegning.tsx` (Mineo page) | Uændret |
| `RenteberegningTab` — desktopvisning | Uændret (isMobile default: false) |
| `BeregnetRenteTable` — desktopvisning | Uændret |
| `useGridCoreController.ts` | Uændret — immediateEditing implementeres via data-attribut på table-elementet |
| `gridCoreContext.shared.ts` / `gridCoreTypes.ts` | Uændret |
| `pdfWriter.ts` | Uændret |
| `generateRentePdf` signatur (kaldsside) | Uændret for Mineo; internt: `writer.save()` fjernes, ny intern `writeRentePdfContent`-hjælpefunktion udtrækkes; return-type ændres til `{ doc: jsPDF, filename: string }` (brydende ændring — verificér at ingen kald til `generateRentePdf` sker uden om service-laget) |
| `downloadStandaloneRentePdf` | Tilpasses til ny `generateRentePdf`-return-type; kalder `.save()` internt; eksternt API `(params) => Promise<PdfDownloadResult>` er uændret |
| Beregningsmotor | Uændret |
| Persistens og commit-flow | Uændret |

---

## Implementeringsrækkefølge

```
Stadie 1 → Stadie 2 → Stadie 4 → Stadie 3 → Stadie 5
```

Stadie 3 (GridCore `immediateEditing`) placeres sidst fordi det kræver ændringer i `tableKeyboardNavigation.ts`. Stadie 1 og 2 er uafhængige og kan gennemføres med lav risiko. Stadie 4 er isoleret ny funktionalitet der ikke berører eksisterende flows. Stadie 5 følger løbende.

---

## Risici

| Risiko | Modforanstaltning |
|---|---|
| `data-mineo-immediate-editing` i `handleTablePointerDownCapture` introducerer uventet sideeffekt på keyboard-navigation | Test eksplicit at Tab/Enter-navigation er uændret når attributten ikke er sat. Isolér ændringen til pointer-down-fasen. |
| `openEditing` kaldes på allerede-editing celle ved hurtigt dobbelt-touch | Guard med `!isSameCell(editing, cell)` skal bevares også i immediateEditing-stien. Se review-note i Stadie 3. |
| `writeRentePdfContent` på tværs af to sektioner i ét dokument giver fejl pga. Y-cursor-state | Test eksplicit at en `PdfWriter` kan modtage to komplette sektioner efter hinanden. Kald `writer.addPage()` mellem sektioner (aldrig før første sektion). |
| `addFooter` kaldes for tidligt eller for mange gange | `addFooter` itererer over alle sider — kald den kun én gang til allersidst i `downloadAllStandaloneRentePdf`. Kald den IKKE inde i `generateRentePdfToWriter`. |
| `generateRentePdf` return-type ændring bryder en direkte bruger af funktionen | Verificér med grep at `generateRentePdf` kun bruges via `standaloneRentePdfService.ts`. Test `downloadStandaloneRentePdf` eksplicit efter ændringen. |
| Header-`colSpan` og body-`<td>`-antal stemmer ikke overens på mobil | Beskriv eksplicit at `<TableCell colSpan={2}>Evt. tillægstid</TableCell>` fjernes helt (ikke erstattes) på mobil. Test header/body-kolonnetalsparitet. |
| `isMobile` på `RenteberegningTab` ændrer Mineo-visning utilsigtet | Prop er optional med default `false`. Mineo sender den aldrig. |
| `& .row--text` font-size i `sx`-blok påvirker tabellens talvisning | Brug målrettet selektor. Se review-note i Stadie 1b. |
| Mobilkolonner fjernes men brugeren har alligevel brug for tillægstid på mobil | Tillægstid er sjælden brug. Brugeren kan angive det på desktop. Acceptabelt scope-valg. |
| colIndex-værdier i `gridCell`-props stemmer ikke overens med faktiske `<td>`-indeks på mobil | Se "colIndex-invariant"-afsnittet i Stadie 2. Inputs der renderes på mobil (belob, renterFra) bruger colIndex 0 og 1 og matcher fortsat de fysiske `<td>`-indeks. Tab hopper direkte fra renterFra til næste række — acceptabel adfærd. |
