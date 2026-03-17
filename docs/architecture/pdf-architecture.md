# PDF-arkitektur i Mineo

> **Formål:** Denne fil beskriver den fulde arkitektur bag Mineos PDF-generatorer. Den er primær referencekilde for alle, der skal implementere ny PDF-funktionalitet. Læs den inden du skriver en linje PDF-kode.

---

## Indholdsfortegnelse

1. [Overblik og lagdeling](#1-overblik-og-lagdeling)
2. [Filstruktur](#2-filstruktur)
3. [Konfigurationslaget – `pdfConfig.ts`](#3-konfigurationslaget--pdfconfigts)
4. [Adapterlaget – `pdfDocumentAdapter.ts` og `jsPdfAdapter.ts`](#4-adapterlaget--pdfdocumentadapterts-og-jspdfadapterts)
5. [Writer-abstraktionen – `pdfWriter.ts`](#5-writer-abstraktionen--pdfwriterts)
6. [Hjælpefunktioner – `pdfHelpers.ts`](#6-hjælpefunktioner--pdfhelpersts)
7. [Tabelrenderer – `pdfTableRenderer.ts`](#7-tabelrenderer--pdftablerendererts)
8. [Teksthjælpere – `pdfTextUtils.ts` og `pdfFormatUtils.ts`](#8-teksthjælpere--pdftextutilsts-og-pdfformautilsts)
9. [Domænespecifikke hjælpere](#9-domænespecifikke-hjælpere)
10. [Brevhoved og options-kontrakt](#10-brevhoved-og-options-kontrakt)
11. [Lazy loading – `pdfLoader.ts`](#11-lazy-loading--pdfloaderts)
12. [Standardmønster for en ny generator](#12-standardmønster-for-en-ny-generator)
13. [Skrifttyper, farver og mål – den visuelle kontrakt](#13-skrifttyper-farver-og-mål--den-visuelle-kontrakt)
14. [Pengehåndtering og afrunding](#14-pengehåndtering-og-afrunding)
15. [Eksisterende generatorer – overblik](#15-eksisterende-generatorer--overblik)
16. [Udeståender](#16-udeståender)

---

## 1. Overblik og lagdeling

PDF-systemet er opdelt i fire lag, fra lavniveau til brugerniveau:

```
┌─────────────────────────────────────────────────────────┐
│  GENERATORER  (satserPdf, rentePdf, erstatningsopgoerelsePdf, …)
│  Domænelogik, sektionsopbygning, dataformatering
├─────────────────────────────────────────────────────────┤
│  WRITER-ABSTRAKTION  (pdfWriter.ts + pdfHelpers.ts)
│  Cursor-baseret layout, sidebrydning, overskrifter,
│  brevhoved, footer, spacere
├─────────────────────────────────────────────────────────┤
│  PRIMITIVER  (pdfTableRenderer.ts, pdfTextUtils.ts, …)
│  Tabelrendering, celle-builders, teksthjælpere
├─────────────────────────────────────────────────────────┤
│  ADAPTER + KONFIGURATION  (jsPdfAdapter.ts, pdfConfig.ts)
│  Al direkte jsPDF-kald, fælles konstanter og farver
└─────────────────────────────────────────────────────────┘
```

**Kerneprincipper:**

- **jsPDF-isolation:** jsPDF importeres kun i `jsPdfAdapter.ts` og i `pdfLoader.ts` (lazy load). Ingen generator må importere jsPDF direkte, undtagen via adapteren eller writeren.
- **Konfiguration ét sted:** Alle mål, farver, fontstørrelser og margener defineres i `pdfConfig.ts`. Brug altid konstanter herfra — hardkodede tal i generatorer er ikke tilladt.
- **Writer er primær API:** Generatorer bruger `PdfWriter`-objektet til al layout. Direkte Y-koordinatstyring via `MARGINS.top` e.l. er kun tilladt, hvis writer-API'en er utilstrækkelig (og det er en afvigelse, der skal rettes).

---

## 2. Filstruktur

```
src/utils/pdf/
├── pdfConfig.ts                  # Farver, margener, fontstørrelser, spacing-konstanter
├── pdfDocumentAdapter.ts         # Interface: PdfDocumentAdapter
├── jsPdfAdapter.ts               # Eneste sted jsPDF bruges direkte
├── pdfWriter.ts                  # Cursor-baseret layout-abstraktion (PdfWriter og createPdfWriter/createStandardPdfWriter)
├── pdfHelpers.ts                 # Brevhoved, footer, section headings, spacing-hjælpere
├── pdfTableRenderer.ts           # Tabelrendering via jspdf-autotable
├── pdfTextUtils.ts               # Tekstnormalisering, non-breaking spaces
├── pdfFormatUtils.ts             # Filnavne, formatering, sanitering
├── pdfOptions.ts                 # PdfCommonOptions og PdfStamdata (options-kontrakt)
├── pdfBrevhoved.ts               # PdfType → visBrevhoved-mapping fra settings
├── pdfLoader.ts                  # Lazy loader for alle generatorer
│
├── satserPdf.ts                  # Generator: Arbejdsskadesatser
├── rentePdf.ts                   # Generator: Procesrente
├── aarsloenPdf.ts                # Generator: Årslønsberegning
├── shDagePdf.ts                  # Generator: SH-dage
├── varigeMenPdf.ts               # Generator: Méngodtgørelse
├── krlPdf.ts                     # Generator: KRL-satstabeller
├── reguleringPdf.ts              # Generator: Reguleringsgrundlag
├── erstatningsopgoerelsePdf.ts   # Generator: Erstatningsopgørelse (hoved-PDF)
│   └── erstatningsopgoerelse/
│       ├── types.ts              # SHDageTableRow og SelectedElements (domain-typer til sektionsrenderere)
│       └── sections/             # Sektionsrenderere til erstatningsopgoerelsePdf
│           ├── opgoerelseSection.ts
│           ├── loenindkomstSection.ts
│           ├── offentligeYdelserSection.ts
│           ├── reguleringSection.ts
│           └── shDageSection.ts
└── tafFordeltPaaAarPdf.ts        # Generator: TAF fordelt på år

src/domain/erstatningsopgoerelse/
├── eoPdfModel.ts                 # Model-builder for erstatningsopgørelse
├── eoPdfModelTypes.ts            # Typer for PDF-modellen
├── eoPdfMoneyUtils.ts            # MoneyOre/MoneyKroner branded types, afrunding
└── sharedPdfUtils.ts             # Fælles dato/format/validering til EO-systemet
```

---

## 3. Konfigurationslaget – `pdfConfig.ts`

**Alle** visuelle konstanter skal hentes herfra. Brug aldrig hardkodede tal i generatorer.

### Farver (`COLORS`)

```typescript
COLORS.lightBackground  // [248, 248, 248]  — tabelstribning og header-baggrunde
COLORS.white            // [255, 255, 255]
COLORS.black            // [0, 0, 0]
COLORS.text             // [51, 51, 51]     — standardtekst

PDF_MUTED_TEXT_COLOR    // [150, 150, 150]  — sekundær/dæmpet tekst
PDF_FOOTER_TEXT_COLOR   // [200, 200, 200]  — footertekst
```

### Margener og sideformat (`MARGINS`, `A4_PAGE_WIDTH_MM`)

```typescript
MARGINS.left    // 20 mm
MARGINS.right   // 20 mm
MARGINS.top     // 40 mm  (ekstra plads til brevhoved)
MARGINS.bottom  // 20 mm

A4_PAGE_WIDTH_MM        // 210 mm
PDF_CONTENT_WIDTH_MM    // 170 mm  (= 210 - 20 - 20)
```

### Fontstørrelser (`FONT_SIZES`)

```typescript
FONT_SIZES.title    // 16 pt
FONT_SIZES.header   // 12 pt
FONT_SIZES.normal   // 10 pt
// Tabelindhold bruger TABLE_FONT_SIZE = 8 pt (defineret i pdfTableRenderer.ts)
// TABLE_STYLES.fontSize = 10 pt bruges ikke af tabelrenderen — kun til reference
// Footer bruger PDF_FOOTER_FONT_SIZE = 6 pt
// Brevhoved bruger PDF_BREVHOVED_FONT_SIZE = 9 pt
```

### Tabelstilarter (`TABLE_STYLES`)

```typescript
TABLE_STYLES.fontSize                   // 10 pt — bruges ikke af tabelrenderen (se TABLE_FONT_SIZE = 8 pt i pdfTableRenderer.ts)
TABLE_STYLES.cellPadding                // 1.5 mm
TABLE_STYLES.headerBackgroundColor      // COLORS.lightBackground
TABLE_STYLES.alternateRowBackgroundColor // COLORS.lightBackground
```

> **Bemærk:** `pdfTableRenderer.ts`'s `EO_TABLE_CELL_PADDING` peger på `TABLE_STYLES.cellPadding` (begge 1.5 mm).

### Spacing-konstanter

```typescript
SECTION_SPACER              // 10 mm — mellemrum mellem sektioner
PDF_SECTION_HEADING_GAP     // 3 mm — justeringsafstand under sektionsoverskrift
PDF_TABLE_NARROW_COLUMN_WIDTH // 25 mm — standardbredde for smalle kolonner
PDF_FINAL_Y_FALLBACK_HEIGHT // 50 mm — fallback-Y hvis autotable ikke returnerer finalY
```

### Brevhoved-konstanter

```typescript
PDF_BREVHOVED_START_Y       // 15 mm fra øverste kant
PDF_BREVHOVED_LINE_HEIGHT   // 5 mm pr. linje
PDF_BREVHOVED_FONT_SIZE     // 9 pt
```

---

## 4. Adapterlaget – `pdfDocumentAdapter.ts` og `jsPdfAdapter.ts`

### Formål

jsPDF indeholder ustabile interne API'er (f.eks. `jsPDF.internal.pageSize`). Adapterlaget isolerer al afhængighed af jsPDF til **ét sted**, så resten af kodebasen ikke kobles direkte til jsPDF.

### `PdfDocumentAdapter` (interface)

Eksponerer kun hvad Mineo bruger:

```typescript
interface PdfDocumentAdapter {
  text(text: string, x: number, y: number, options?: PdfTextOptions): void;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number, compression?: PdfImageCompression): void;
  setFont(fontFamily: string, fontStyle: string): void;
  setFontSize(size: number): void;
  setTextColor(...rgb: PdfColor): void;
  addPage(): void;
  setPage(pageNumber: number): void;
  getNumberOfPages(): number;
  getPageWidth(): number;
  getPageHeight(): number;
}
```

### `createJsPdfAdapter(doc: jsPDF): PdfDocumentAdapter`

Eneste implementation. `getPageWidth()` og `getPageHeight()` kaldes per-use (ikke cached), fordi `jsPDF.internal.pageSize` er mutable.

**Regel:** Generatorer modtager altid `PdfDocumentAdapter`, aldrig `jsPDF` direkte — undtagen ved kald til `renderEoStylePdfTable()`, der forventer `jsPDF` (jspdf-autotable-limitation; se [afsnit 7](#7-tabelrenderer--pdftablerendererts)).

---

## 5. Writer-abstraktionen – `pdfWriter.ts`

Writeren er den primære API for alle generatorer. Den håndterer:

- **Cursor-baseret Y-koordinat** – al positionsstyring
- **Automatiske sidebrydninger** – `ensureSpace()` checker, om der er plads, og tilføjer side hvis nødvendigt
- **Fonttilstand** – husker aktiv font+stilart+størrelse
- **Smart spacing** – tracker om forrige blok var en sektionsheader, og justerer top-spacing derefter
- **Vandmærke** – Canvas → PNG med dimension-baseret caching

### Opret en writer

```typescript
const writer = createStandardPdfWriter();
// Opretter writer med lineHeight=5mm, standard A4

// Valgfrie parametre:
const writer = createStandardPdfWriter({
  visUdkastStempel: true,           // Tilføj UDKAST-vandmærke på alle sider
  onLayoutFallback: (msg) => { … }, // Callback ved layout-overflow (f.eks. til logning)
});
```

Kald altid `createStandardPdfWriter()`. Brug ikke `createPdfWriter()` eller den interne `createPdfCursor()` direkte — `createPdfWriter` er eksponeret til intern genbrug men er ikke en del af den offentlige API.

### Vigtige `PdfWriter`-metoder

```typescript
// Metadata
writer.setProperties({ title, subject, author, creator });
writer.setDisplayMode('fullheight');  // Kald dette på alle generatorer

// Brevhoved (øverst på første side, overlay – påvirker ikke Y)
writer.writeBrevhoved(brevhovedData);

// Indhold
writer.writeTitle(text);             // 16 pt bold, øverst i indholdsbeskeden
writer.writeSubheader(text, nextLineHeight);  // 10 pt bold, sikrer plads til efterfølgende indhold
// INVARIANT: writeSubheader garanterer præcis 1× lineHeight (5 mm) over sig selv,
// uanset hvad der gik forud. Allerede akkumuleret spacing fra addSpacer()/advanceY()
// modregnes automatisk, så det samlede mellemrum aldrig overstiger 1× lineHeight.
// Brug options.addTopSpacing = false for at undertrykke spacing eksplicit
// (fx første underoverskrift direkte under en sektionsoverskrift).
writer.writeWrappedText(text);       // 10 pt normal, linjebrydes automatisk
writer.writeSectionHeader(text, nextLineHeight);  // 12 pt bold, markerer sektionsskift

// Layout-primitiver
writer.addSpacer(mm);               // Tilføj vertikal spacing
writer.getY() / writer.setY(y);     // Læs/sæt cursor-position
writer.getDoc();                    // Hent underliggende jsPDF-instans (kun til tabel-kald)

// Skrifttype
writer.setFont('helvetica', 'bold');
writer.setFontSize(10);
writer.setNormalTextStyle();        // Reset til 10pt normal

// Footer og gem
writer.addFooter();                 // Tilføj versionsnummer-footer på alle sider
writer.save(filename);              // Gem og download PDF

// Avancerede metoder
writer.writeLeftRightText(leftText, rightText, options?);
// Standard for almindelige oplysningslinjer, formler og beløb
// der ikke hører til i en egentlig tabel.
// options: { rightFontStyle, lineAboveRightWidth, lineAboveRightOffset, leftNoWrap, minRightColumnWidth }

writer.writeLeftRightTextSingleLine(leftText, rightText, options?);
// Som writeLeftRightText, men venstresiden brydes aldrig over flere linjer.

writer.writeAtomicTableChunks({ rows, renderHeader, renderRow, estimateRowHeight, headerHeight });
// Holder header + første datarække atomisk (ingen sidebrydning midt i første chunk).

writer.writeSignatureBlock(dateLine, sigLine, dateX, sigX, skadelidteNavn);
// Tegner underskriftblok med centret 'Dato'-label og skadelidtes navn.

writer.addUdkastWatermark();        // Tilføj udkast-vandmærke på aktuel side
writer.getPageWidth();              // Samlet sidebredde i mm (inklusive margener)
writer.ensureSpace(height);         // Reservér plads; tilføjer ny side hvis nødvendigt

// Yderligere metoder
writer.writeSubheaderWithWrappedText(subheaderText, bodyText);
// Atomisk: skriver subheader + brødtekst (sikrer at de ikke splittes over sider)

writer.advanceY(delta);             // Flyt Y-cursor med delta mm (positiv = ned)
writer.writeUnderlinedLabel(text, x);  // Tegner tekst med understregning
writer.getPageWidth();              // Samlet sidebredde i mm (inklusive margener)
```

### Rækkefølge i en generator

```
1. createStandardPdfWriter()
2. writer.setDisplayMode('fullheight')
3. writer.setProperties({ … })
4. Betinget: writer.writeBrevhoved(…)
5. writer.writeTitle(…)
6. [sektioner]
7. writer.addFooter()
8. writer.save(filename)
```

---

## 6. Hjælpefunktioner – `pdfHelpers.ts`

### `addSectionHeading(adapter, text, startY): number`

Tegner en **fed sektionsoverskrift** (10 pt bold) og returnerer Y-position **efter** overskriften. Brug denne funktion, ikke inline font-sætning, for at sikre ensartet afstand.

```typescript
const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Min sektion', currentY);
const tableStartY = headingY - PDF_SECTION_HEADING_GAP;
// Tabeller starter typisk headingY - PDF_SECTION_HEADING_GAP (3mm)
```

> Alternativt kan `writer.writeSubheader()` bruges, når man arbejder med writer-API'en og ikke behøver den eksakte Y-returværdi for efterfølgende tabelpositionering.

### `resolvePdfSectionEndY(finalY, startY, options?): number`

Beregner afslutnings-Y efter en sektion med fallback og valgfri ekstra spacing:

```typescript
return resolvePdfSectionEndY(finalY, startY);
// Returnerer: (Number.isFinite(finalY) ? finalY : startY + PDF_FINAL_Y_FALLBACK_HEIGHT) + SECTION_SPACER
```

Brug dette **altid** efter en tabel for at få korrekt spacing til næste sektion.

### `ensurePdfPageSpace(adapter, y, neededMm): number`

Tilføjer ny side hvis der ikke er plads. Returnerer ny Y (enten uændret eller `MARGINS.top`).

### `formatAmount(value): string` og `formatPercent(value): string`

Danske lokalformat-hjælpere i `pdfHelpers.ts`. Sørg for at bruge disse (og ikke separate `Intl`-kald i generatorer).

### `PDF_BASE_LINE_HEIGHT_MM`

Eksporteret konstant (5 mm) for standardlinjehøjde. Bruges til spacing-beregninger.

### `PDF_TITLE_BOTTOM_SPACING_MM`

Eksporteret konstant (15 mm) for afstand under dokumenttitel. Bruges af generatorer der manuelt justerer Y efter `writer.writeTitle()`.

### `addBrevhoved` — intern funktion

`addBrevhoved` er eksporteret fra `pdfHelpers.ts` men bruges **kun** internt i `pdfWriter.ts` via `writer.writeBrevhoved()`. Generatorer skal aldrig kalde `addBrevhoved` direkte — brug altid `writer.writeBrevhoved(brevhovedData)`.

---

## 7. Tabelrenderer – `pdfTableRenderer.ts`

Alle egentlige tabeller renders via **`renderEoStylePdfTable()`** — aldrig ved direkte kald til `jsPDF.autoTable()`.

**Vigtig afgrænsning:** `renderEoStylePdfTable()` må kun bruges til faktiske tabeller med kolonneoverskrifter og/eller reel tabelstruktur. Almindelige oplysningslinjer, key/value-par, regnestykker og specifikationer uden tabelheader skal renderes som tekst via writeren (`writeWrappedText()`, `writeLeftRightText()`, `writeLeftRightTextSingleLine()`).

### Celle-builders

```typescript
// Convenience-funktioner (brug disse i stedet for rå objekter):
cellLeft(content)           // venstrestillet tekst
cellRight(content)          // højrestillet tekst
cellCenter(content)         // centreret tekst
cellRightBold(content)      // højrestillet, fed tekst

// Generisk celle med fuld kontrol:
createPdfTableCell(content, { halign, valign, bold, transparent, fontSize })

// Header-celle (fed, med halign-override):
createPdfTableHeaderCell(content, halign)

// Tom transparent række (spacer i tabellen):
createPdfTableTransparentRow(columnCount)
```

### `renderEoStylePdfTable(options)`

```typescript
renderEoStylePdfTable({
  doc,          // jsPDF-instans (hent via writer.getDoc())
  startY,       // Y-start i mm
  body,         // RowInput[] — alle rækker inkl. evt. header-række
  hasHeaderRow, // true: første række behandles som header med lys baggrund (default: true)
  columnStyles, // Record<number, Styles> — kolonnebredder og alignment
  transparentRowIndices,  // number[] — rækker uden baggrund (spacere, totaler)
  didParseCell, // Callback til avanceret celle-styling
  didDrawCell,  // Callback til custom tegning (streger, o.l.) — direkte jsPDF-kald
                // er tilladt her: PdfDocumentAdapter dækker ikke tegneprimitiverne
                // (setLineWidth, setDrawColor, line), og autotable eksponerer
                // jsPDF-instansen direkte via data.doc.
  tableWidth,   // default: PDF_CONTENT_WIDTH_MM (170mm)
});
// Returnerer: number (finalY)
```

**Automatisk sidebrydning:** Hvis tabellen ikke passer på siden, flyttes den automatisk til næste side.

**Stribning:** Lige rækker (index 0, 2, 4, …) får `COLORS.lightBackground` som baggrund.

### `createPdfFixedColumnStyles(columnCount, cellWidth, halign?)`

Opretter ens kolonnebredder for alle kolonner. Bruges typisk til tabeller med mange ensartede kolonner.

### Kolonnestile

Brug `columnStyles` til at styre bredder. Typisk mønster:

```typescript
columnStyles: {
  0: { cellWidth: 'auto' },  // Tekst-kolonne: fylder resten
  1: { cellWidth: 60 },      // Beløbs-kolonne: fast bredde
}
```

---

## 8. Teksthjælpere – `pdfTextUtils.ts` og `pdfFormatUtils.ts`

### `pdfTextUtils.ts`

```typescript
normalizeTextForPdf(text)    // CRLF → LF, indsætter non-breaking space efter beløb
ensureNonBreakingKr(text)    // Forhindrer linjebrud midt i "50.000 kr."
```

### `pdfFormatUtils.ts`

```typescript
resolvePdfFileName(title, isDraft, journalnr?): string
// → "{journalnr} - {title}[ (udkast)].pdf"
// Eksempel: "J-2024-001 - Årslønsberegning.pdf"

sanitizeFilenamePart(text): string
// Fjerner ulovlige Windows-filnavnstegn og kontroltegn

formatMaanederTrimmed(value): string
// Dansk lokalformat med op til 4 decimaler; fjerner unødvendige nuller

formatCurrencyFromOre(ore): string
// Konverterer øre til kroner og formaterer som dansk beløb (ingen kr.-suffiks)

formatMoneyOreWithKr(ore): string
// Som formatCurrencyFromOre + non-breaking " kr." suffiks

formatPercentDelta(value): string
// Dansk lokalformat med op til 2 decimaler; fjerner fortegn (bruges til delta-visning)

formatCurrencyFromOreTrimmed(ore): string
// Som formatCurrencyFromOre, men fjerner ",00" decimaler

formatMoneyOreWithKrTrimmed(ore): string
// Som formatMoneyOreWithKr, men med trimmed decimaler

formatCurrencyPerUnit(amount, unit): string
// Formaterer beløb pr. enhed: "1.234,56 kr./dag"

isSingularCount(value): boolean    // Re-eksport fra formatUtils
formatCountWithUnit(n, singular, plural): string  // Re-eksport fra formatUtils
```

Brug altid `resolvePdfFileName()` til filnavnsgenerering. Definer typisk en navngiven builder-funktion i generatoren:

```typescript
export const buildMinPdfFilename = (journalnr?: string): string =>
  resolvePdfFileName('Min PDF-titel', false, journalnr);
```

---

## 9. Domænespecifikke hjælpere

### `sharedPdfUtils.ts` (`src/domain/erstatningsopgoerelse/`)

Deduplerede funktioner brugt af EO-systemets model-builders og sektionsrenderere. Relevante også uden for EO-kontekst:

```typescript
// Datoformatering
formatDateShort(date)       // dd-mm-yyyy
formatDateLong(date)        // d. [månednavn] yyyy (dansk)

// Talformatering
formatPercentFixed2(v)      // Altid 2 decimaler + "%"-suffiks
formatAmount2(v)            // Dansk lokalformat med tusindtalsseparator
formatAmountWithoutTrailingDecimals(v)  // Fjerner ".00"

// Periodehjælpere
resolveReguleringsdato(...)  // Bestem reguleringsstartdato ud fra metode
perioderCoverDate(perioder, dato)  // Tjek om dato falder i en periode
```

### `eoPdfMoneyUtils.ts` (`src/domain/erstatningsopgoerelse/`)

Bruges kun i EO-systemet. Definerer `MoneyOre` (branded integer) og `MoneyKroner` (branded decimal) for korrekt pengehåndtering. Se [afsnit 14](#14-pengehåndtering-og-afrunding).

---

## 10. Brevhoved og options-kontrakt

### `PdfCommonOptions` og `PdfStamdata` (`pdfOptions.ts`)

Alle PDF-generatorer skal acceptere `PdfCommonOptions`:

```typescript
interface PdfCommonOptions {
  visBrevhoved?: boolean;
  stamdata?: PdfStamdata | null;
}

interface PdfStamdata {
  journalnr?: string;
  dagsDatoISO?: ISODateString;
  advokat?: string;
  sagsbehandler?: string;
}
```

**Kontrakt:** PDF-generatorer må **ikke** læse indstillinger (`AppSettings`) direkte. De modtager kun hvad der sendes via `PdfCommonOptions`. Hvem der skal vise brevhoved, bestemmes af `pdfBrevhoved.ts` i UI-laget.

### `BrevhovedData` (`pdfHelpers.ts`)

Intern type til `writer.writeBrevhoved()`. Konstrueres typisk sådan:

```typescript
if (visBrevhoved) {
  const brevhovedData: BrevhovedData = {
    journalnr: stamdata?.journalnr,
    advokat: stamdata?.advokat,
    sagsbehandler: stamdata?.sagsbehandler,
    dagsDatoISO: TODAY,
  };
  writer.writeBrevhoved(brevhovedData);
}
```

Brevhovedet placeres som overlay øverst til højre. Det påvirker **ikke** Y-cursoren.

**`dagsDatoISO` er required i `BrevhovedData`** og sættes til `TODAY` af generatoren. Dette er forskelligt fra `PdfStamdata.dagsDatoISO`, som er optional og kun bruges af EO-generatoren til at vise "Opgørelse lavet den" (ikke dags dato).

**EO og TAF bruger `StamdataValues` direkte** i stedet for `resolvePdfStamdata()` i `pdfService.ts` — brevhoved-data hentes fra modellen (`model.brevhoved`). De øvrige generatorer bruger `resolvePdfStamdata()` via `buildCommonPdfContext()` i `pdfService.ts`.

---

## 11. Lazy loading – `pdfLoader.ts`

jsPDF er et tungt bibliotek. Alle generatorer loader dynamisk:

```typescript
const { generateMinPdf } = await loadPdfModule('minPdf');
```

Tilføj en ny generator til `pdfLoader.ts`-mappingen. Brug `import()` med en moduleKey for caching. Importfejl rydder cachen, så næste forsøg prøver igen.

---

## 12. Standardmønster for en ny generator

Følgende mønster skal følges konsekvent. Afvigelser fra dette er arkitekturfejl.

```typescript
// minNyPdf.ts

import { MARGINS, SECTION_SPACER, PDF_SECTION_HEADING_GAP } from './pdfConfig';
import { addSectionHeading, PDF_BASE_LINE_HEIGHT_MM, resolvePdfSectionEndY, type BrevhovedData } from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import { createJsPdfAdapter } from './jsPdfAdapter';
import { cellLeft, cellRight, createPdfTableHeaderCell, renderEoStylePdfTable } from './pdfTableRenderer';
import { resolvePdfFileName } from './pdfFormatUtils';
import type { PdfCommonOptions, PdfStamdata } from './pdfOptions';
import { TODAY } from '../../config/dateRanges';

type MinNyPdfOptions = PdfCommonOptions & Readonly<{
  stamdata?: PdfStamdata | null;
  // ... domænespecifikke parametre
}>;

export const buildMinNyPdfFilename = (journalnr?: string): string =>
  resolvePdfFileName('Min PDF-titel', false, journalnr);

export const generateMinNyPdf = (options: MinNyPdfOptions): void => {
  const { visBrevhoved = false, stamdata = null } = options;

  // 1. Opret writer
  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  // 2. Metadata
  writer.setProperties({
    title: 'Min PDF-titel',
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });

  // 3. Brevhoved (betinget)
  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // 4. Titel
  writer.writeTitle('Min PDF-titel');

  // 5. Sektioner
  const doc = writer.getDoc();

  // Almindelige oplysningslinjer skrives som tekst
  writer.writeSubheader('Stamdata', PDF_BASE_LINE_HEIGHT_MM);
  writer.writeLeftRightTextSingleLine('Beregningsdato', '17. marts 2026', { rightFontStyle: 'normal' });
  writer.writeLeftRightText('Årsløn', '500.000 kr.', { rightFontStyle: 'normal' });
  writer.addSpacer(SECTION_SPACER);

  // Kun faktiske tabeller bruger tabelrendereren
  const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Sektion 1', writer.getY());
  const tableStartY = headingY - PDF_SECTION_HEADING_GAP;

  const finalY = renderEoStylePdfTable({
    doc,
    startY: tableStartY,
    body: [
      [createPdfTableHeaderCell('Beskrivelse', 'left'), createPdfTableHeaderCell('Værdi', 'right')],
      [cellLeft('Række 1'), cellRight('1.234,00 kr.')],
    ],
    hasHeaderRow: true,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });

  writer.setY(resolvePdfSectionEndY(finalY, tableStartY));

  // 6. Footer og gem
  writer.addFooter();
  writer.save(buildMinNyPdfFilename(stamdata?.journalnr));
};
```

### Tilmelding til loader

Tilføj til `pdfLoader.ts` — udvid `PdfModuleMap`-typen og `moduleLoaders`-objektet:

```typescript
// I PdfModuleMap:
minNyPdf: typeof import('./minNyPdf');

// I moduleLoaders:
minNyPdf: () => import('./minNyPdf'),

// Eksportér en navngiven loader-funktion:
export const loadMinNyPdfModule = () => loadModule('minNyPdf');
```

---

## 13. Skrifttyper, farver og mål – den visuelle kontrakt

Alle generatorer **skal** bruge disse værdier. Det er den visuelle kontrakt, der sikrer ensartet udseende.

### Skrifttype

| Kontekst           | Familie     | Stil   | Størrelse       |
|--------------------|-------------|--------|-----------------|
| Dokumenttitel      | helvetica   | bold   | 16 pt           |
| Sektionsoverskrift | helvetica   | bold   | 12 pt (`writeSectionHeader`) eller 10 pt (`writeSubheader` / `addSectionHeading`) |
| Brødtekst          | helvetica   | normal | 10 pt           |
| Tabelindhold       | helvetica   | normal | 8 pt (`TABLE_FONT_SIZE`) |
| Tabelheader        | helvetica   | bold   | 8 pt (`TABLE_FONT_SIZE`) |
| Brevhoved          | helvetica   | normal | 9 pt            |
| Footer             | helvetica   | normal | 6 pt            |

> Der er **ingen** custom-fontindlejring. Helvetica er en standard-PDF-font og kræver ikke embedding.

### Farvepalette

| Brug                            | RGB-værdi          | Konstant                      |
|---------------------------------|--------------------|-------------------------------|
| Al brødtekst                    | `[51, 51, 51]`     | `COLORS.text`                 |
| Tabelstribning og header-baggrund | `[248, 248, 248]` | `COLORS.lightBackground`      |
| Sekundær/dæmpet tekst           | `[150, 150, 150]`  | `PDF_MUTED_TEXT_COLOR`        |
| Footertekst                     | `[200, 200, 200]`  | `PDF_FOOTER_TEXT_COLOR`       |
| Hvid baggrund                   | `[255, 255, 255]`  | `COLORS.white`                |
| Sort (streger, o.l.)            | `[0, 0, 0]`        | `COLORS.black`                |

### Mål og spacing

| Element                             | Værdi            | Konstant                         |
|-------------------------------------|------------------|----------------------------------|
| Venstre/højre margen                | 20 mm            | `MARGINS.left` / `.right`        |
| Top-margen (første side)            | 40 mm            | `MARGINS.top`                    |
| Bund-margen                         | 20 mm            | `MARGINS.bottom`                 |
| Indholdssbredde                     | 170 mm           | `PDF_CONTENT_WIDTH_MM`           |
| Mellemrum mellem sektioner          | 10 mm            | `SECTION_SPACER`                 |
| Standard linjehøjde                 | 5 mm             | `PDF_BASE_LINE_HEIGHT_MM`        |
| Sektionsoverskrift → tabel-juster.  | 3 mm             | `PDF_SECTION_HEADING_GAP`        |
| Smal kolonne (standardbredde)       | 25 mm            | `PDF_TABLE_NARROW_COLUMN_WIDTH`  |
| Cellepadding (standard)             | 1,5 mm           | `TABLE_STYLES.cellPadding`       |
| Footer fra sidens kant              | 5 mm             | `PDF_FOOTER_MARGIN_MM`           |

---

## 14. Pengehåndtering og afrunding

Gælder primært EO-systemet, men principperne er normative for alle generatorer.

### Grundregel

**Alle beregninger foregår i heltal (øre).** Brug `MoneyOre` (branded integer) til mellemregninger. Konverter kun til kroner ved visning.

```typescript
type MoneyOre = number & { readonly __brand: 'MoneyOre' };
type MoneyKroner = number & { readonly __brand: 'MoneyKroner' };
```

### Afrunding

Brug altid `roundByMethod(value, 2, 'halfAwayFromZero')`. Aldrig `Math.round()`, `toFixed()` eller andre metoder.

```typescript
roundKroner(value)  // Kanonisk 2-decimal-afrunding med 'halfAwayFromZero'
```

### Clamping

Totallinjer må aldrig vise negative beløb:

```typescript
clampMoneyOreToZero(value)  // Sikrer >= 0
```

### Visning

Brug `formatAmount2()` fra `sharedPdfUtils.ts` eller `formatAmount()` fra `pdfHelpers.ts`. Aldrig `Intl.NumberFormat` inline i generatorer.

---

## 15. Eksisterende generatorer – overblik

| Generator                  | Fil                            | Formål                                           | Anvender model-lag? | PdfCommonOptions? |
|----------------------------|--------------------------------|--------------------------------------------------|---------------------|-------------------|
| Erstatningsopgørelse       | `erstatningsopgoerelsePdf.ts`  | Hoved-PDF med TAF, svie/smerte, øvrige krav      | Ja (`eoPdfModel.ts`) | Ja               |
| TAF fordelt på år          | `tafFordeltPaaAarPdf.ts`       | TAF-beregning brudt ned per kalenderår           | Ja (via snapshot)   | Ja               |
| Arbejdsskadesatser         | `satserPdf.ts`                 | Årsspecifikke satser (EAL, ASL, diverse)         | Nej                 | Ja               |
| Procesrente                | `rentePdf.ts`                  | Halvårlige renteperioder med referencerenter     | Nej                 | Ja               |
| Årslønsberegning           | `aarsloenPdf.ts`               | Årsløn med periodedata, satser og beregning      | Nej                 | Ja               |
| SH-dage                    | `shDagePdf.ts`                 | Søgnehelligdage i perioder                       | Nej                 | Ja               |
| Méngodtgørelse             | `varigeMenPdf.ts`              | Varige mén med aldersreduktion                   | Nej                 | Ja               |
| KRL-satstabeller           | `krlPdf.ts`                    | KTO/SHK × kommuner/regioner                     | Nej                 | Ja               |
| Reguleringsgrundlag        | `reguleringPdf.ts`             | Overenskomst/statistikmodeller og offentlige satser | Nej             | Ja               |

### Pseudo-tabeller er forbudt

Headerløse 2-kolonne-layouts må ikke implementeres via `renderEoStylePdfTable()`. Hvis indholdet semantisk er almindelig tekst og ikke en tabel, skal det skrives via writeren. Eksempler:

- Ménberegningens stamdata- og resultatlinjer
- Årsløns-PDF'ens satser, beregningsprincipper og mellemregninger
- Satser-PDF'ens lovspecifikationer og referencer

### Filnavngivning og journalnr

`satserPdf.ts` inkluderer bevidst ikke journalnr i filnavnet — satser er årsspecifikke og sagsagnostiske. Alle øvrige generatorer prefixer filnavnet med journalnr via `resolvePdfFileName(title, isDraft, journalnr)`.

### Erstatningsopgørelse: model-renderer-split

Den komplekse EO-PDF bruger et to-lags design:

1. **Model-lag** (`eoPdfModel.ts`): Ren datastruktur. Bygger `PdfModel` med alle beløb som `MoneyOre`. Afhænger ikke af jsPDF.
2. **Renderer-lag** (`erstatningsopgoerelsePdf.ts` + `sections/`): Modtager `PdfModel`, renderer til PDF via writeren.

Dette mønster er **ikke påkrævet** for simple generatorer, men bør anvendes, når domænelogikken er kompleks nok til at fortjene selvstændig testning.

---

## 16. Udeståender

*(ingen kendte udeståender)*
