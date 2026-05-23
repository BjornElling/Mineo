# PDF-arkitektur i Mineo

> **Status:** Arkitekturforklarende reference, ikke selvstændig kontrakt.
>
> **Formål:** Denne fil beskriver arkitekturen bag Mineos PDF-generatorer. Den forklarer lag, filstruktur og rationale.

> **Normativ afgrænsning:** Denne fil er arkitekturforklarende. De bindende regler for PDF ligger i `src/contracts/pdf-contract.md` og `src/contracts/pdf-layout-contract.md`.

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

**Kerneprincipper (forklarende):**

- **jsPDF-isolation:** se `pdf-layout-contract.md`.
- **Konfiguration ét sted:** `pdfConfig.ts` ejer aktuelle numeriske layoutværdier. Dette dokument må ikke kopiere tal som autoritativ sandhed.
- **Writer er primær API:** se `pdf-layout-contract.md` for de bindende writer-/helper-regler.

---

## 2. Filstruktur

```
src/pdf/
├── index.ts
├── infrastructure/
│   ├── pdfConfig.ts              # Farver, margener, fontstørrelser, spacing-konstanter
│   ├── pdfDocumentAdapter.ts     # Interface: PdfDocumentAdapter
│   ├── jsPdfAdapter.ts           # Eneste sted jsPDF bruges direkte
│   ├── pdfWriter.ts              # Cursor-baseret layout-abstraktion
│   ├── pdfLoader.ts              # Lazy loader for alle generatorer
│   └── pdfService.ts             # UI-lagets download-wrappers
├── shared/
│   ├── pdfHelpers.ts             # Brevhoved, footer, section headings, spacing-hjælpere
│   ├── pdfTableRenderer.ts       # Tabelrendering via jspdf-autotable
│   ├── pdfTextUtils.ts           # Tekstnormalisering og non-breaking spaces
│   ├── pdfFormatUtils.ts         # Filnavne, formatering, sanitering
│   ├── pdfOptions.ts             # PdfCommonOptions og PdfStamdata
│   └── pdfBrevhoved.ts           # PdfType → visBrevhoved-mapping fra settings
└── domains/
    ├── satser/satserPdf.ts
    ├── renteberegning/rentePdf.ts
    ├── aarsloen/aarsloenPdf.ts
    ├── aarsloen/shDagePdf.ts
    ├── varigemen/varigeMenPdf.ts
    ├── krl/krlPdf.ts
    ├── eo/reguleringPdf.ts
    ├── eo/erstatningsopgoerelsePdf.ts
    ├── eo/sections/*.ts
    ├── loebendeYdelser/loebendeYdelserPdf.ts
    ├── kapitalisering/kapitaliseringPdf.ts
    ├── eet/eetEfterEalPdf.ts
    ├── differencekrav/differencekravPdf.ts
    ├── forsoergertab/forsoergertabPdf.ts
    └── tafFordelt/tafFordeltPaaAarPdf.ts

src/domain/erstatningsopgoerelse/
├── snapshot/                     # Snapshot- og projection-lag til EO/TAF-PDF'er
│   ├── eoSnapshot.ts
│   ├── eoSnapshotToEoPdfDocument.ts
│   └── eoSnapshotToTafPerYearPdfDocument.ts
├── pdf/                          # EO-PDF-model, money-typer og formattering
│   ├── eoPdfModelTypes.ts
│   ├── eoPdfMoneyUtils.ts
│   ├── eoPdfLoenudvikling.ts
│   ├── eoPdfRegulering.ts
│   └── sharedPdfUtils.ts
└── engines/ og helpers/          # Domæneberegning og shared regler
```

---

## 3. Konfigurationslaget – `pdfConfig.ts`

**Alle** visuelle konstanter skal hentes herfra. Brug aldrig hardkodede tal i generatorer.

Aktuelle farver, margener, fontstørrelser, tabelværdier og spacing-tal ejes af `src/pdf/infrastructure/pdfConfig.ts` og de relevante renderer-moduler. Dette dokument beskriver relationerne mellem lagene, men gengiver ikke konkrete millimetermål eller fontstørrelser som autoritative værdier.

Hvis en konstant findes men ikke bruges af runtime-rendereren, skal koden ryddes eller navngivningen tydeliggøres i en separat kodeændring. Dokumentation må ikke legitimere ubrugt konfiguration som "referenceværdi".

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

**Regel:** Generatorer modtager altid `PdfDocumentAdapter`, aldrig `jsPDF` direkte — undtagen ved kald til `renderPdfTable()`, der forventer `jsPDF` (jspdf-autotable-limitation; se [afsnit 7](#7-tabelrenderer--pdftablerendererts)).

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
// Opretter writer med lineHeight=4mm, standard A4

// Valgfrie parametre:
const writer = createStandardPdfWriter({
  visUdkastStempel: true,           // Tilføj UDKAST-vandmærke på alle sider
  onLayoutFallback: (msg) => { … }, // Callback ved layout-overflow (f.eks. til logning)
});
```

Kaldsmønstre for writer-API'er er bindende i `pdf-layout-contract.md`; dette afsnit forklarer kun writerens rolle.

### Vigtige `PdfWriter`-metoder

```typescript
// Metadata
writer.setProperties({ title, subject, author, creator });
writer.setDisplayMode('fullheight');  // Kald dette på alle generatorer

// Brevhoved (øverst på første side, overlay - påvirker ikke Y)
writer.writeBrevhoved(brevhovedData);

// Indhold
writer.writeTitle(text);             // 16 pt bold, øverst i indholdsblokken
writer.writeBoldSubheader(text, nextLineHeight);  // sikrer plads til efterfølgende indhold
// Konkrete spacing-invariants ejes af pdf-layout-contract.md og writer-tests.
// (fx første underoverskrift direkte under en sektionsoverskrift).
writer.writeWrappedText(text);       // brødtekst, linjebrydes automatisk
writer.writeSectionHeader(text, nextLineHeight);  // markerer sektionsskift
// nextLineHeight er valgfri og skal normalt udelades.

// Layout-primitiver
writer.addSpacer(mm);               // Tilføj vertikal spacing
writer.addSectionSpacer();          // Standardafstand mellem writer-baserede sektioner
writer.getY() / writer.setY(y);     // Læs/sæt cursor-position
writer.getDoc();                    // Hent underliggende jsPDF-instans (kun til tabel-kald)
writer.setNormalTextStyle();        // Reset til normal brødtekst

// Footer og gem
writer.addFooter();                 // Tilføj versionsnummer-footer på alle sider
writer.save(filename);              // Gem og download PDF

// Avancerede metoder
writer.writeLeftRightText(leftText, rightText, options?);
// Standard for almindelige oplysningslinjer, formler og beløb
// der ikke hører til i en egentlig tabel.
// options: { rightFontStyle, lineAboveRightWidth, lineAboveRightOffset, leftNoWrap, minRightColumnWidth }

writer.writeBoldWrappedText(text);
// Kanonisk variant til hele brødtekstblokke i fed vægt.

writer.writeAtomicTableChunks({ rows, renderHeader, renderRow, estimateRowHeight, headerHeight });
// Holder header + første datarække atomisk (ingen sidebrydning midt i første chunk).

writer.writeSignatureBlock(dateLine, sigLine, dateX, sigX, skadelidteNavn);
// Tegner underskriftblok med centret 'Dato'-label og skadelidtes navn.

writer.addUdkastWatermark();        // Tilføj udkast-vandmærke på aktuel side
writer.getPageWidth();              // Samlet sidebredde i mm (inklusive margener)
writer.ensureSpace(height);         // Reservér plads; tilføjer ny side hvis nødvendigt

// Yderligere metoder
writer.writeBoldSubheaderWithWrappedText(subheaderText, bodyText);
// Atomisk: skriver subheader + ét efterfølgende tekstafsnit samlet.

writer.writeBoldSubheaderIfContent({ text, hasContent, renderContent, nextLineHeight?, options? });
// Skriver kun underoverskriften hvis afsnittet reelt har indhold.

writer.advanceY(delta);             // Flyt Y-cursor med delta mm (positiv = ned)
writer.writeUnderlinedSubheader(text, x);  // Tegner understreget underoverskrift
// x er valgfri; standarden er venstremargen fra writeren.
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

Tegner en fed sektionsoverskrift og returnerer Y-position efter overskriften. Brug denne funktion, ikke inline font-sætning, for at sikre ensartet afstand.

```typescript
const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Min sektion', currentY);
const tableStartY = resolvePdfTableStartYAfterSectionHeading(headingY);
// Brug altid helperen i stedet for lokal headingY - PDF_SECTION_HEADING_GAP.
```

> Alternativt kan `writer.writeBoldSubheader()` bruges, når man arbejder med writer-API'en og ikke behøver den eksakte Y-returværdi for efterfølgende tabelpositionering.

### `resolvePdfSectionEndY(finalY, startY, options?): number`

Beregner afslutnings-Y efter en sektion med fallback og valgfri ekstra spacing:

```typescript
return resolvePdfSectionEndY(finalY, startY);
// Returnerer: (Number.isFinite(finalY) ? finalY : startY + PDF_FINAL_Y_FALLBACK_HEIGHT) + SECTION_SPACER
```

Brug dette **altid** efter en tabel for at få korrekt spacing til næste sektion.
I rent writer-baserede sektioner bruges derimod `writer.addSectionSpacer()`.

### `ensurePdfPageSpace(adapter, y, neededMm): number`

Tilføjer ny side hvis der ikke er plads. Returnerer ny Y (enten uændret eller `MARGINS.top`).

### Format- og spacinghelpers

Dansk lokalformat og spacing skal gå gennem canonical PDF-/domænehelpers. Konkrete spacingkonstanter ejes af `pdfConfig.ts` og writer-tests, ikke af dette dokument.

### Brevhoved-helper

Den offentlige brevhoved-adgang for generatorer er `writer.writeBrevhoved(brevhovedData)`. Hvis lavniveau-helperen stadig er eksporteret, er det teknisk gæld der bør lukkes i kode.

---

## 7. Tabelrenderer – `pdfTableRenderer.ts`

Alle egentlige tabeller renders via **`renderPdfTable()`** — aldrig ved direkte kald til `jsPDF.autoTable()`.

**Vigtig afgrænsning:** `renderPdfTable()` må kun bruges til faktiske tabeller med kolonneoverskrifter og/eller reel tabelstruktur. Almindelige oplysningslinjer, key/value-par, regnestykker og specifikationer uden tabelheader skal renderes som tekst via writeren (`writeWrappedText()`, `writeBoldWrappedText()`, `writeLeftRightText()`).

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

### `renderPdfTable(options)`

```typescript
renderPdfTable({
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

### `sharedPdfUtils.ts` (`src/domain/erstatningsopgoerelse/pdf/`)

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

**To-dato-model:** Brevhovedets dato er genereringsdatoen. Opgørelsesdatoen er dokumentets faglige opgørelsesdato og må ikke forveksles med brevhoveddatoen.

For almindelige generatorer sættes `BrevhovedData.dagsDatoISO` til genereringsdatoen. EO/TAF kan få brevhoveddato gennem model-laget, men semantikken er stadig genereringsdato. "Opgørelse lavet den" er et separat fagligt felt.

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

Følgende mønster viser den typiske struktur. Bindende regler for gate, writer-brug og layout ligger i PDF-kontrakterne.

```typescript
// minNyPdf.ts

import { MARGINS } from './pdfConfig';
import { addSectionHeading, resolvePdfSectionEndY, resolvePdfTableStartYAfterSectionHeading, type BrevhovedData } from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import { createJsPdfAdapter } from './jsPdfAdapter';
import { cellLeft, cellRight, createPdfTableHeaderCell, renderPdfTable } from './pdfTableRenderer';
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
  writer.writeBoldSubheader('Stamdata');
  writer.writeLeftRightText('Beregningsdato', '17. marts 2026', { rightFontStyle: 'normal' });
  writer.writeLeftRightText('Årsløn', '500.000 kr.', { rightFontStyle: 'normal' });
  writer.addSectionSpacer();

  // Kun faktiske tabeller bruger tabelrendereren
  const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Sektion 1', writer.getY());
  const tableStartY = resolvePdfTableStartYAfterSectionHeading(headingY);

  const finalY = renderPdfTable({
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

## 13. Skrifttyper, farver og mål

Aktuelle skrifttyper, farver, mål og spacingtal ejes af `pdfConfig.ts`, `pdfWriter.ts` og de relevante renderer-moduler. Denne arkitekturfil må ikke være kilde til konkrete millimetermål, RGB-værdier eller fontstørrelser.

Den bindende visuelle kontrakt er `src/contracts/pdf-layout-contract.md`.

---

## 14. Pengehåndtering og afrunding

Normative numeriske regler ejes af `src/contracts/amount-contract.md` og EO-specifikke money-regler af `src/contracts/eo-snapshot-contract.md`.

PDF-laget skal modtage autoritative beløb/projektioner og formatere dem med canonical PDF-/domænehelpers. Det må ikke indføre lokal beregningsafrunding.

---

## 15. Eksisterende generatorer – overblik

| Generator                  | Fil                            | Formål                                           | Anvender model-lag? | PdfCommonOptions? |
|----------------------------|--------------------------------|--------------------------------------------------|---------------------|-------------------|
| Erstatningsopgørelse       | `erstatningsopgoerelsePdf.ts`  | Hoved-PDF med TAF, svie/smerte, øvrige krav      | Ja (`eoSnapshotToEoPdfDocument`) | Ja  |
| TAF fordelt på år          | `tafFordeltPaaAarPdf.ts`       | TAF-beregning brudt ned per kalenderår           | Ja (`eoSnapshotToTafPerYearPdfDocument`) | Ja |
| Arbejdsskadesatser         | `satserPdf.ts`                 | Årsspecifikke satser (EAL, ASL, diverse)         | Nej                 | Ja               |
| Procesrente                | `rentePdf.ts`                  | Halvårlige renteperioder med referencerenter     | Nej                 | Ja               |
| Årslønsberegning           | `aarsloenPdf.ts`               | Årsløn med periodedata, satser og beregning      | Nej                 | Ja               |
| SH-dage                    | `shDagePdf.ts`                 | Søgnehelligdage i perioder                       | Nej                 | Ja               |
| Méngodtgørelse             | `varigeMenPdf.ts`              | Varige mén med aldersreduktion                   | Nej                 | Ja               |
| KRL-satstabeller           | `krlPdf.ts`                    | KTO/SHK × kommuner/regioner                     | Nej                 | Ja               |
| Reguleringsgrundlag        | `reguleringPdf.ts`             | Overenskomst/statistikmodeller og offentlige satser | Nej             | Ja               |
| EET løbende ydelser        | `loebendeYdelserPdf.ts`        | Erhvervsevnetab: løbende ydelser                 | Nej                 | Ja               |
| EET kapitalisering         | `kapitaliseringPdf.ts`         | Erhvervsevnetab: kapitaliseret engangserstatning | Nej                 | Ja               |
| EET efter EAL              | `eetEfterEalPdf.ts`            | Erhvervsevnetab beregnet efter EAL               | Nej                 | Ja               |
| EET differencekrav         | `differencekravPdf.ts`         | Erhvervsevnetab: differencekrav                  | Nej                 | Ja               |
| Forsørgertab               | `forsoergertabPdf.ts`          | Forsørgertabserstatning                          | Nej                 | Ja               |

### Pseudo-tabeller

Reglen om pseudo-tabeller ejes af `pdf-layout-contract.md`. Dette overblik nævner kun, at simple label/værdi-opstillinger normalt bør være writer-baseret tekstlayout, ikke egentlige tabeller.

### Filnavngivning og journalnr

`satserPdf.ts` inkluderer bevidst ikke journalnr i filnavnet — satser er årsspecifikke og sagsagnostiske. Alle øvrige generatorer prefixer filnavnet med journalnr via `resolvePdfFileName(title, isDraft, journalnr)`.

### Erstatningsopgørelse: model-renderer-split

Den komplekse EO-PDF bruger et tre-lags design:

1. **Snapshot-lag** (`eoSnapshot.ts`): Beregner `EoSnapshot` fra form-state.
2. **Projection-lag** (`eoSnapshotToEoPdfDocument.ts`): Omsætter snapshot til `EoPdfDocumentProjection` — en `PdfModel` med alle beløb som `MoneyOre`. Dette er den faktiske entry point som rendereren kalder. Bygger på snapshot-/presentationslaget (`eoPresentationModel.ts`, `eoPresentationSectionBuilders.ts`) og EO-PDF-hjælpere i `src/domain/erstatningsopgoerelse/pdf/`, bl.a. `eoPdfLoenudvikling.ts`, `eoPdfRegulering.ts` og `sharedPdfUtils.ts`. Afhænger ikke af jsPDF.
3. **Renderer-lag** (`erstatningsopgoerelsePdf.ts` + `sections/`): Modtager `PdfModel`, renderer til PDF via writeren.

TAF-fordelt-på-år bruger et tilsvarende mønster via `eoSnapshotToTafPerYearPdfDocument.ts`.

Dette mønster er **ikke påkrævet** for simple generatorer, men bør anvendes, når domænelogikken er kompleks nok til at fortjene selvstændig testning.

---

## 16. Udeståender

### Anbefalet audit-plan for layout-standardisering

For layout-audit følges `src/contracts/pdf-layout-contract.md` §10-§12. Auditsekvensen skal kun ejes ét sted; dette arkitekturdokument dublerer den ikke.
Se `src/contracts/pdf-layout-contract.md` §11 for den kanoniske audit-rækkefølge.

Auditten skal fortsat kontrollere headerløse 2-kolonne-layouts, understregede labels med lokal spacing og writer-tests for regler der gøres centrale.

*(ingen øvrige kendte udeståender — senest gennemgået 2026-04-17)*
