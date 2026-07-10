# Dokument-output-arkitektur i Mineo

> **Status:** Arkitekturforklarende reference, ikke selvstændig kontrakt.
>
> **Formål:** Denne fil beskriver arkitekturen bag Mineos dokument-output. Mineo kan downloade det samme dokument i **to kanaler** — PDF (jsPDF) og Word (.docx) — bygget af de samme generatorer via det samme writer-API. Filen forklarer lag, filstruktur, dobbeltkanal-mekanikken og rationale.

> **Normativ afgrænsning:** Denne fil er arkitekturforklarende. De bindende regler for dokument-output (begge kanaler) ligger i `src/contracts/document-output-contract.md`. Selve formatvalget mellem PDF og Word reguleres af `src/contracts/document-format-contract.md`.

---

## Indholdsfortegnelse

1. [Overblik og lagdeling](#1-overblik-og-lagdeling)
1a. [Dobbeltkanal: PDF og Word](#1a-dobbeltkanal-pdf-og-word)
2. [Filstruktur](#2-filstruktur)
3. [Konfigurationslaget – `pdfConfig.ts`](#3-konfigurationslaget--pdfconfigts)
4. [Adapterlaget – `pdfDocumentAdapter.ts` og `jsPdfAdapter.ts`](#4-adapterlaget--pdfdocumentadapterts-og-jspdfadapterts)
5. [Writer-abstraktionen – `documentWriter.ts`](#5-writer-abstraktionen--documentwriterts)
6. [Hjælpefunktioner – `documentLayoutHelpers.ts`](#6-hjælpefunktioner--pdfhelpersts)
7. [Tabelrenderer – `tableSpec.ts` + `documentTableRenderer.ts`](#7-tabelrenderer--tablespects--documenttablerendererts)
8. [Teksthjælpere – `pdfTextUtils.ts` og `documentFormatUtils.ts`](#8-teksthjælpere--pdftextutilsts-og-pdfformautilsts)
9. [Domænespecifikke hjælpere](#9-domænespecifikke-hjælpere)
10. [Brevhoved og options-kontrakt](#10-brevhoved-og-options-kontrakt)
11. [Lazy loading – `documentLoader.ts`](#11-lazy-loading--documentloaderts)
12. [Standardmønster for en ny generator](#12-standardmønster-for-en-ny-generator)
13. [Skrifttyper, farver og mål – den visuelle kontrakt](#13-skrifttyper-farver-og-mål--den-visuelle-kontrakt)
14. [Pengehåndtering og afrunding](#14-pengehåndtering-og-afrunding)
15. [Eksisterende generatorer – overblik](#15-eksisterende-generatorer--overblik)
16. [Udeståender](#16-udeståender)

---

## 1. Overblik og lagdeling

Dokument-systemet er opdelt i en **format-agnostisk kerne** (`src/document/`) og **to kanaler** (`src/pdf/` = jsPDF, `src/docx/` = Word). Kernen er lagdelt, fra lavniveau til brugerniveau:

```
┌─────────────────────────────────────────────────────────┐
│  KERNE: src/document/
│
│  GENERATORER  src/document/generators/
│  (satserDocument, renteDocument, erstatningsopgoerelseDocument, …)
│  Domænelogik, sektionsopbygning, dataformatering
├─────────────────────────────────────────────────────────┤
│  WRITER-ABSTRAKTION  src/document/writer/
│  documentWriter.ts (DocumentWriter-grænseflade)
│  documentWriterRouter.ts (createStandardPdfWriter, kanal-agnostisk)
│  + src/document/layout/documentLayoutHelpers.ts
│  Cursor-baseret layout, sidebrydning, overskrifter,
│  brevhoved, footer, spacere
├─────────────────────────────────────────────────────────┤
│  LAYOUT-PRIMITIVER  src/document/layout/
│  (documentTableRenderer.ts, pdfTextUtils.ts, documentFormatUtils.ts,
│   pdfConfig.ts, documentTableBridge.ts, …)
│  Tabelrendering, celle-builders, teksthjælpere, konstanter
└─────────────────────────────────────────────────────────┘
        │                                   │
        ▼ (writer-fabrik injiceret via      ▼
          documentGenerationContext)
┌───────────────────────────┐   ┌───────────────────────────┐
│  PDF-KANAL  src/pdf/        │   │  WORD-KANAL  src/docx/      │
│  jsPdfAdapter, pdfWriter    │   │  docxWriter, docxStyles,    │
│  (createPdfChannelWriter),  │   │  docxWatermark              │
│  pdfDocumentAdapter,        │   │  (createDocxWriter)         │
│  pdfBrevhovedRenderer,      │   │                             │
│  pdfRenderHelpers           │   │                             │
│  Al direkte jsPDF-kald      │   │  OOXML via docx-biblioteket │
└───────────────────────────┘   └───────────────────────────┘
```

**Kerneprincipper (forklarende):**

- **jsPDF-isolation:** se `document-output-contract.md` afsnit B. Al direkte jsPDF-adgang ligger i PDF-kanalen (`src/pdf/`); kernen i `src/document/` importerer aldrig en kanal statisk.
- **Konfiguration ét sted:** `pdfConfig.ts` (i `src/document/layout/`) ejer aktuelle numeriske layoutværdier. Dette dokument må ikke kopiere tal som autoritativ sandhed.
- **Writer er primær API:** se `document-output-contract.md` afsnit B for de bindende writer-/helper-regler.

---

## 1a. Dobbeltkanal: PDF og Word

Mineo genererer ikke to forskellige sæt dokumenter. Det genererer **ét** dokument gennem **ét** sæt generatorer og vælger først til sidst, om resultatet bliver PDF eller Word. Dette er hele rationalet bag dobbeltkanal-designet: generatorerne forbliver kanal-uagtige, og Word kommer "gratis" med, fordi Word-writeren opfylder den samme grænseflade som PDF-writeren.

### Den fælles grænseflade: `DocumentWriter`

`DocumentWriter` (`src/document/writer/documentWriter.ts`) er den fælles kontrakt for al dokument-komposition (`writeTitle`, `writeSectionHeader`, `writeBoldSubheader`, `writeWrappedText`, `writeLeftRightText`, `renderDocumentTable`-integration via `getDoc()`, brevhoved, footer, spacing osv.). Grænsefladen er **kanal-neutral** og ligger i kernen — den importerer ikke en konkret kanal.

`getDoc()` returnerer den honest union `jsPDF | DocumentTableBridgeDocument`: PDF-kanalen returnerer den rå jsPDF-instans (kun til tabel-callbacks/lavniveau-tegning), Word-kanalen returnerer tabel-broen. (Den tidligere kanal-lækage, hvor `getDoc()` var typet `jsPDF` og Word-writeren returnerede en attrap via `as never`, er fjernet — review-fund F2 lukket.)

To kanal-fabrikker opfylder `DocumentWriter`:

| Fabrik | Fil | Kanal | Underliggende motor |
|--------|-----|-------|---------------------|
| `createPdfChannelWriter` | `src/pdf/infrastructure/pdfWriter.ts` | PDF | jsPDF |
| `createDocxWriter` | `src/docx/infrastructure/docxWriter.ts` | Word | `docx` (OOXML) |

### Routing via `documentGenerationContext`

Generatorerne kalder altid den kanal-agnostiske router `createStandardPdfWriter()` (`src/document/writer/documentWriterRouter.ts`). Routeren importerer **aldrig** en kanal statisk; den henter writer-fabrikken fra den globale generations-kontekst:

- `src/document/documentGenerationContext.ts` holder den aktive kontekst med `format` (`'pdf'` | `'word'`), en injiceret `createWriter`-fabrik og en liste af `pendingDownloads`.
- `withDocumentGenerationContext(format, run, { createWriter })` sætter konteksten omkring et download-kald og venter på alle registrerede `pendingDownloads`, før den rydder konteksten igen. `runSelectedDocumentFormat(...)` i `documentService.ts` injicerer den korrekte fabrik: `createPdfChannelWriter` for `'pdf'`, `createDocxWriter` for `'word'`.
- I `createStandardPdfWriter()` delegeres til `getActiveDocumentWriterFactory()` — den fabrik, konteksten har injiceret. Mangler fabrikken i konteksten, kastes en eksplicit fejl.

Konsekvens: der findes ét fælles `DocumentWriter`-interface i kernen, og ingen kanal-specifikke generatorer. Både `createPdfChannelWriter` og `createDocxWriter` opfylder `DocumentWriter`-typen, kanalvalget routes gennem den globale kontekst, og generatorerne i `src/document/generators/` står urørte uanset kanal.

### Word-writerens oversættelse

`createDocxWriter` oversætter de samme writer-kald til Words afsnitsmodel:

- **Navngivne typografier:** Al Word-tekst arver en navngiven Word-typografi (Normal, Title, Heading1, fed/understreget underoverskrift osv.) defineret i `src/docx/infrastructure/docxStyles.ts` via `DOCX_STYLE`. `docxWriter.ts` sætter **aldrig** inline font/størrelse/spacing på afsnit eller runs; de eneste per-instans-egenskaber er strukturelle (alignment i tabelceller, frame til brevhovedet, `pageBreakBefore`) eller indholds-bestemt fed tekst. Det betyder, at Word-dokumentets udseende kan justeres centralt ét sted (eller i Words egne typografi-definitioner).
- **Tabeller:** `getDoc()` returnerer en bridge (`DocumentTableBridgeDocument` fra den kanal-neutrale `src/document/layout/documentTableBridge.ts`), så `renderDocumentTable()`-kald fanges og omsættes til docx-tabeller i stedet for jsPDF-autotable.
- **Cursor-/Y-styring er no-op:** `getY`/`setY`/`advanceY`/`ensureSpace`/`addFooter` er tomme i Word-writeren, fordi Word selv håndterer sideflow og footer (footer sættes på sektionen ved build). `addSpacer`/`addSectionSpacer` indsætter et tomt afstands-afsnit.
- **Vandmærke (UDKAST) og brevhoved-paritet:** Word-output har samme UDKAST-vandmærke og samme brevhoved-indhold som PDF. Vandmærket bygges af `src/docx/infrastructure/docxWatermark.ts` (diagonalt VML-fragment; se note nedenfor). Brevhovedet (`writeBrevhoved`) bygger samme linjer som PDF-brevhovedet — "J.nr. \<nr\> \<advokat\>/\<sagsbehandler\>" plus den lange danske dato — i en side-forankret tekstrude øverst til højre, og aktiverer Words "anden første side" (titlePage), så første side får et højere topområde.
- **Download:** `save()` bygger dokumentet asynkront (`Packer.toBlob`), trigger download via `triggerDocumentDownload`, og registrerer det afventende load i konteksten via `registerPendingDocumentDownload`, så `withDocumentGenerationContext` kan vente på det.

> **docx ImportedXmlComponent-note:** `ImportedXmlComponent.fromXmlString` pakker et XML-fragment i en navnløs rod, som docx serialiserer som `<undefined>…</undefined>` — ugyldig WordprocessingML, som Word afviser. `docxWatermark.ts` pakker derfor det reelle navngivne barn ud (`.root[0]`), så fragmentet indsættes direkte. En værn-test i `docxWriter.test.ts` fanger, hvis fremtidige docx-versioner ændrer denne struktur.

### Test

Word-kanalen testes via `src/__tests__/docx/` (bl.a. `docxWriter.test.ts` og per-generator Word-tests under `src/__tests__/docx/generators/` via `wordContentHarness.ts`). PDF-kanalen testes via `src/__tests__/utils/pdf/` og `src/__tests__/pdf/` samt quality-guards. De kanal-neutrale data-/gate-regler dækkes af de gate- og service-tests, der er koblet i `contractCoverageMatrix.test.ts`. (Test-mapperne under `src/__tests__/` er bevidst ikke flyttet i forbindelse med kerne-/kanal-omstruktureringen.)

---

## 2. Filstruktur

```
src/document/                            # Format-agnostisk kerne
├── documentGenerationContext.ts         # Aktiv kontekst: format + injiceret writer-fabrik + pendingDownloads
├── documentFormat.ts                    # documentDownloadFormatSchema, DEFAULT_DOCUMENT_DOWNLOAD_FORMAT
├── documentFileName.ts                  # Fælles filnavnsregel (resolveDocumentArtifactFileName)
├── documentBrand.ts / downloadArtifact.ts
├── writer/
│   ├── documentWriter.ts                # DocumentWriter-grænsefladen (kanal-neutral)
│   ├── documentWriterRouter.ts          # createStandardPdfWriter (kanal-agnostisk router)
│   └── index.ts
├── layout/
│   ├── pdfConfig.ts                     # Farver, margener, fontstørrelser, spacing-konstanter (PDF_*)
│   ├── documentLayoutHelpers.ts                    # Section headings, section-end-Y, spacing-hjælpere (format-agnostiske dele)
│   ├── documentTableRenderer.ts              # Tabelrendering (renderDocumentTable + celle-builders)
│   ├── pdfTextUtils.ts                  # Tekstnormalisering og non-breaking spaces
│   ├── documentFormatUtils.ts                # Filnavne, formatering, sanitering
│   ├── documentOptions.ts                    # DocumentCommonOptions og DocumentStamdata
│   ├── documentBrevhoved.ts                  # DocumentBrevhovedType → visBrevhoved-mapping fra settings
│   ├── documentGateTypes.ts                  # DocumentDownloadGateReason/-Result, allow/blockDocumentDownload
│   ├── documentTableBridge.ts           # DocumentTableBridgeDocument (broes til Word-tabeller)
│   └── jsPdfGeometry.ts                 # getJsPdfPageSize m.m.
├── generators/                          # Én generator (+ evt. sections/) pr. domæne — alle *Document.ts
│   ├── satser/satserDocument.ts
│   ├── renteberegning/renteDocument.ts
│   ├── renteberegning/renteOversigtDocument.ts   # Samlet oversigt over alle renteberegninger
│   ├── aarsloen/aarsloenDocument.ts
│   ├── aarsloen/shDageDocument.ts
│   ├── varigemen/varigeMenDocument.ts
│   ├── krl/krlDocument.ts
│   ├── eo/reguleringDocument.ts
│   ├── eo/erstatningsopgoerelseDocument.ts
│   ├── eo/types.ts
│   ├── eo/sections/*.ts
│   ├── loebendeYdelser/loebendeYdelserDocument.ts
│   ├── kapitalisering/kapitaliseringDocument.ts
│   ├── eet/eetEfterEalDocument.ts
│   ├── eet/eetDocumentUtils.ts
│   ├── differencekrav/differencekravDocument.ts
│   ├── forsoergertab/forsoergertabDocument.ts
│   └── tafFordelt/
│       ├── tafFordeltPaaAarDocument.ts       # TAF fordelt på kalenderår
│       ├── tafOpreguleretPaaAarDocument.ts   # TAF opreguleret til beregningsåret
│       ├── tafKravGrafDocument.ts            # Graf over TAF-krav pr. år
│       └── tafKravGrafChart.ts               # Chart-byggesten til kravgrafen
└── service/
    ├── documentService.ts               # UI-lagets download-wrappers + runSelectedDocumentFormat
    └── documentLoader.ts                # Lazy loader for alle generatorer

src/pdf/                                 # PDF-kanal (ægte jsPDF)
├── index.ts
├── pdfRenderHelpers.ts                  # Adapter-afhængige helpers (addFooter, addSectionHeading, ensurePdfPageSpace, …)
└── infrastructure/
    ├── jsPdfAdapter.ts                  # Eneste sted jsPDF bruges direkte
    ├── pdfDocumentAdapter.ts            # Interface: PdfDocumentAdapter
    ├── pdfWriter.ts                     # createPdfWriter/createPdfChannelWriter + cursor + watermark
    ├── pdfBrevhovedRenderer.ts          # Renderer der tegner brevhovedet via writer
    └── standaloneRentePdfService.ts     # Download-wrappers for standalone MinProcesrente-app

src/docx/                                # Word-kanal (ægte .docx)
└── infrastructure/
    ├── docxWriter.ts                    # createDocxWriter (opfylder DocumentWriter)
    ├── docxStyles.ts                    # Navngivne Word-typografier (DOCX_STYLE)
    └── docxWatermark.ts                 # UDKAST-vandmærke (VML)

src/domain/erstatningsopgoerelse/
├── snapshot/                     # Snapshot- og projection-lag til EO/TAF-dokumenter
│   ├── eoSnapshot.ts
│   ├── eoSnapshotToEoDocument.ts
│   ├── eoSnapshotToTafPerYearDocument.ts
│   ├── eoSnapshotToTafPerYearOpreguleretDocument.ts
│   ├── eoSnapshotToTafKravGrafDocument.ts
│   └── eoPresentationModel.ts    # Præsentationsmodel forbrugt af projektionen
├── shared/
│   ├── eoTypes.ts                # EO-model-typer (tidligere eoPdfModelTypes)
│   └── eoMoney.ts                # MoneyOre/MoneyKroner-typer og -afrunding (tidligere eoPdfMoneyUtils)
├── helpers/
│   └── eoSharedUtils.ts          # Delte EO-dato-/sats-/pct-helpers (tidligere sharedPdfUtils)
└── engines/                      # Domæneberegning og -præsentation
    ├── loenudviklingBeregning.ts # Segmentering (tidligere eoPdfLoenudvikling re-eksporterede herfra)
    └── reguleringsPresentation.ts # Regulerings-/lønudviklings-tabeldata (tidligere eoPdfRegulering)
```

> **Konsolidering (review 10.5):** Det tidligere `src/domain/erstatningsopgoerelse/pdf/`-lag er afviklet. Det indeholdt ingen jsPDF-kode — kun EO-præsentations- og reguleringslogik der byggede tabel-*data* — og er flyttet ind i `engines/`, `shared/` og `helpers/` som vist ovenfor. Selve dokument-renderingen lever i den format-agnostiske kerne (`src/document/generators/`), mens al direkte jsPDF-kode er isoleret i PDF-kanalen `src/pdf/`.

---

## 3. Konfigurationslaget – `pdfConfig.ts`

**Alle** visuelle konstanter skal hentes herfra. Brug aldrig hardkodede tal i generatorer.

Aktuelle farver, margener, fontstørrelser, tabelværdier og spacing-tal ejes af `src/document/layout/pdfConfig.ts` og de relevante renderer-moduler. Dette dokument beskriver relationerne mellem lagene, men gengiver ikke konkrete millimetermål eller fontstørrelser som autoritative værdier.

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

**Regel:** Generatorer modtager altid `PdfDocumentAdapter`, aldrig `jsPDF` direkte — undtagen ved kald til `renderDocumentTable()`, der forventer den underliggende `getDoc()`-handle (jspdf-autotable-limitation; se [afsnit 7](#7-tabelrenderer--pdftablerendererts)).

---

## 5. Writer-abstraktionen – `documentWriter.ts`

Den fælles `DocumentWriter`-grænseflade (`src/document/writer/documentWriter.ts`) er den primære API for alle generatorer; de konkrete PDF-/Word-implementeringer ligger i hver sin kanal. Writeren håndterer:

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

Kaldsmønstre for writer-API'er er bindende i `document-output-contract.md` afsnit B; dette afsnit forklarer kun writerens rolle.

### Vigtige `DocumentWriter`-metoder

```typescript
// Metadata
writer.setProperties({ title, subject, author, creator });
writer.setDisplayMode('fullheight');  // Kald dette på alle generatorer

// Brevhoved (øverst på første side, overlay - påvirker ikke Y)
writer.writeBrevhoved(brevhovedData);

// Indhold
writer.writeTitle(text);             // 16 pt bold, øverst i indholdsblokken
writer.writeBoldSubheader(text, nextLineHeight);  // sikrer plads til efterfølgende indhold
// Konkrete spacing-invariants ejes af document-output-contract.md afsnit B og writer-tests.
// (fx første underoverskrift direkte under en sektionsoverskrift).
writer.writeWrappedText(text);       // brødtekst, linjebrydes automatisk
writer.writeSectionHeader(text, nextLineHeight);  // markerer sektionsskift
// nextLineHeight er valgfri og skal normalt udelades.

// Layout-primitiver
writer.addSpacer(mm);               // Tilføj vertikal spacing
writer.addSectionSpacer();          // Standardafstand mellem writer-baserede sektioner
writer.getY() / writer.setY(y);     // Læs/sæt cursor-position
writer.getDoc();                    // Hent underliggende doc-handle (jsPDF | DocumentTableBridgeDocument; kun til tabel-kald)
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

## 6. Hjælpefunktioner – `documentLayoutHelpers.ts`

De format-agnostiske Y-/spacing-helpers ligger i kernen (`src/document/layout/documentLayoutHelpers.ts`). De adapter-afhængige tegne-helpers (`addSectionHeading`, `ensurePdfPageSpace`, `addFooter`, `applyNormalTextStyle`/`applyBoldTextStyle`) ligger derimod i PDF-kanalen (`src/pdf/pdfRenderHelpers.ts`), fordi de arbejder direkte mod en `PdfDocumentAdapter`.

### `addSectionHeading(adapter, text, startY): number` (PDF-kanal)

Tegner en fed sektionsoverskrift og returnerer Y-position efter overskriften. Brug denne funktion, ikke inline font-sætning, for at sikre ensartet afstand.

```typescript
const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Min sektion', currentY);
const tableStartY = resolveDocumentTableStartYAfterSectionHeading(headingY);
// Brug altid helperen i stedet for lokal headingY - PDF_SECTION_HEADING_GAP.
```

> Alternativt kan `writer.writeBoldSubheader()` bruges, når man arbejder med writer-API'en og ikke behøver den eksakte Y-returværdi for efterfølgende tabelpositionering.

### `resolveDocumentSectionEndY(finalY, startY, options?): number` (kerne)

Beregner afslutnings-Y efter en sektion med fallback og valgfri ekstra spacing:

```typescript
return resolveDocumentSectionEndY(finalY, startY);
// Returnerer: (Number.isFinite(finalY) ? finalY : startY + PDF_FINAL_Y_FALLBACK_HEIGHT) + SECTION_SPACER
```

Brug dette **altid** efter en tabel for at få korrekt spacing til næste sektion.
I rent writer-baserede sektioner bruges derimod `writer.addSectionSpacer()`.

### `ensurePdfPageSpace(adapter, y, neededMm): number` (PDF-kanal)

Tilføjer ny side hvis der ikke er plads. Returnerer ny Y (enten uændret eller `MARGINS.top`).

### Format- og spacinghelpers

Dansk lokalformat og spacing skal gå gennem canonical document-/domænehelpers. Konkrete spacingkonstanter ejes af `pdfConfig.ts` og writer-tests, ikke af dette dokument.

### Brevhoved-helper

Den offentlige brevhoved-adgang for generatorer er `writer.writeBrevhoved(brevhovedData)`. Hvis lavniveau-helperen stadig er eksporteret, er det teknisk gæld der bør lukkes i kode.

---

## 7. Tabelrenderer – `tableSpec.ts` + `documentTableRenderer.ts`

Tabeller beskrives som **data** via en `TableSpec`-værditype (`src/document/layout/tableSpec.ts`) og renders via **`renderTableSpec()`** — aldrig ved direkte kald til `jsPDF.autoTable()`, og som hovedregel heller ikke ved direkte kald til `renderDocumentTable()`.

**Vigtig afgrænsning:** en tabel må kun bruges til faktisk tabelstruktur med kolonneoverskrifter og/eller reelle rækker. Almindelige oplysningslinjer, key/value-par, regnestykker og specifikationer uden tabelheader skal renderes som tekst via writeren (`writeWrappedText()`, `writeBoldWrappedText()`, `writeLeftRightText()`).

### `TableSpec` — den kanoniske, kanal-neutrale tabel-model (#15)

En generator beskriver en tabel deklarativt: per-kolonne-intent (`width`: `flex`/`grow`/`fixed`/`min`/`auto`, `align`, valgfrit visuelt PDF-`rightInset`) + rækker af celler (`{ text, align?, bold?, colSpan?, valign?, fontSize? }`) + evt. total-rækker. `TableSpec` har **ingen render-viden** og ingen `jsPDF`-reference, så justering defineres ét sted (`ColumnSpec.align`, celle-override via `CellSpec.align`) og **begge kanaler** (PDF + Word) læser samme felt.

```typescript
const columns: readonly ColumnSpec[] = [
  { width: { kind: 'flex' }, align: 'left' },
  { width: { kind: 'fixed', mm: 25 }, align: 'center' },
];
const rows: RowSpec[] = [
  { kind: 'header', cells: [{ text: 'Navn' }, { text: 'Antal' }] },
  { cells: [{ text: 'Ferie' }, { text: '5' }] },
];
const total = buildSummedTotalRowSpec('I alt', [5], { columnCount: 2, valueColumnIndex: 1, /* … */ });
if (total) rows.push(total);

const { endY } = renderTableSpec(writer.getDoc(), writer.getY(), { columns, hasHeaderRow: true, rows });
writer.setY(endY);  // resolveDocumentSectionEndY er absorberet i renderTableSpec's retur
```

`renderTableSpec` kompilerer (`compileTableSpecToLegacyParams`) `TableSpec` ned til præcis de params `renderDocumentTable` allerede modtager — outputtet er byte-identisk med den tidligere håndbyggede kaldeform (bevist af tabel-kanal-paritet-golden-nettene: `tableChannelParity.golden.test.ts` for standalone-generatorer, `eoSectionTableParity.golden.test.ts` for EO-dokumentets bilag-sektioner). Total-rækker ryddes **altid** ensartet (aldrig stribe-baggrund, ingen cellekant), uafhængigt af rækkeantal. Værditypen kan overtages uændret som `Table`-node af det kommende dokument-IR (#24).

### `renderDocumentTable(options)` (intern renderer)

`renderDocumentTable` er nu primært den underliggende renderer, som `renderTableSpec`-compileren og `documentTableBridge` (Word-kanalen) targeterer. De lavniveau-celle-builders (`createDocumentTableCell`, `createDocumentTableHeaderCell`, `createDocumentTableSummedTotalRow`/`createDocumentTableFormattedTotalRow`) og kolonnestil-fabrikkerne bruges internt af compileren og af renderer-testene; nye generatorer bør beskrive tabeller via `TableSpec`.

```typescript
renderDocumentTable({
  doc,          // doc-handle fra writer.getDoc() (jsPDF i PDF-kanalen)
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

### `createDocumentFixedColumnStyles(columnCount, cellWidth, halign?)`

Opretter ens kolonnebredder for alle kolonner. Bruges typisk til tabeller med mange ensartede kolonner. (`createDocumentDistributedColumnStyles(...)` fordeler i stedet bredden ligeligt.)

### Kolonnestile

Brug `columnStyles` til at styre bredder. Typisk mønster:

```typescript
columnStyles: {
  0: { cellWidth: 'auto' },  // Tekst-kolonne: fylder resten
  1: { cellWidth: 60 },      // Beløbs-kolonne: fast bredde
}
```

---

## 8. Teksthjælpere – `pdfTextUtils.ts` og `documentFormatUtils.ts`

### `pdfTextUtils.ts`

```typescript
normalizeTextForDocument(text)               // CRLF → LF, indsætter non-breaking space efter beløb
normalizeRightAlignedTextForDocument(text)   // Som ovenfor, til højrestillet indhold
ensureNonBreakingKr(text)                     // Forhindrer linjebrud midt i "50.000 kr."
```

### `documentFormatUtils.ts`

```typescript
resolveDocumentArtifactFileName(title, isDraft, journalnr?): string
// → "{journalnr} - {title}[ (udkast)]" (endelse .pdf/.docx tilføjes af kanalen)
// Eksempel: "J-2024-001 - Årslønsberegning"

sanitizeFilenamePart(text): string   // (i src/document/documentFileName.ts)
// Fjerner ulovlige Windows-filnavnstegn og kontroltegn

formatMaanederTrimmed(value): string
// Dansk lokalformat med EO-dokumentets fælles månedspræcision; fjerner unødvendige nuller

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

Brug altid `resolveDocumentArtifactFileName()` til filnavnsgenerering. Definer typisk en navngiven builder-funktion i generatoren:

```typescript
export const buildMinDocumentFilename = (journalnr?: string): string =>
  resolveDocumentArtifactFileName('Min dokument-titel', false, journalnr);
```

---

## 9. Domænespecifikke hjælpere

### `eoSharedUtils.ts` (`src/domain/erstatningsopgoerelse/helpers/`)

Deduplerede funktioner brugt af EO-systemets model-builders og sektionsrenderere (tidligere `sharedPdfUtils.ts` i det afviklede `pdf/`-lag). Relevante også uden for EO-kontekst:

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

### `eoMoney.ts` (`src/domain/erstatningsopgoerelse/shared/`)

Bruges kun i EO-systemet (tidligere `eoPdfMoneyUtils.ts` i det afviklede `pdf/`-lag). Definerer `MoneyOre` (branded integer) og `MoneyKroner` (branded decimal) for korrekt pengehåndtering. Se [afsnit 14](#14-pengehåndtering-og-afrunding).

---

## 10. Brevhoved og options-kontrakt

### `DocumentCommonOptions` og `DocumentStamdata` (`src/document/layout/documentOptions.ts`)

Alle generatorer skal acceptere `DocumentCommonOptions`:

```typescript
interface DocumentCommonOptions {
  visBrevhoved?: boolean;
  stamdata?: DocumentStamdata | null;
}

interface DocumentStamdata {
  journalnr?: string;
  dagsDatoISO?: ISODateString;
  advokat?: string;
  sagsbehandler?: string;
}
```

**Kontrakt:** Generatorer må **ikke** læse indstillinger (`AppSettings`) direkte. De modtager kun hvad der sendes via `DocumentCommonOptions`. Hvem der skal vise brevhoved, bestemmes af `documentBrevhoved.ts` (`src/document/layout/`, `DocumentBrevhovedType`) ved service-/UI-grænsen.

### `BrevhovedData` (`src/document/layout/documentLayoutHelpers.ts`)

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

**EO og TAF bruger `StamdataValues` direkte** i stedet for `resolvePdfStamdata()` i `documentService.ts` — brevhoved-data hentes fra modellen (`model.brevhoved`). De øvrige generatorer bruger `resolvePdfStamdata()` via `buildCommonPdfContext()` i `src/document/service/documentService.ts`.

---

## 11. Lazy loading – `documentLoader.ts`

jsPDF (og docx) er tunge biblioteker. Alle generatorer loader dynamisk via `src/document/service/documentLoader.ts`:

```typescript
const { generateMinNyDocument } = await loadMinNyDocumentModule();
```

Tilføj en ny generator til `documentLoader.ts`-mappingen (`DocumentModuleMap` + `moduleLoaders`). Brug `import()` med en moduleKey for caching. Importfejl rydder cachen, så næste forsøg prøver igen.

---

## 12. Standardmønster for en ny generator

Følgende mønster viser den typiske struktur. En generator ligger i `src/document/generators/<domæne>/<navn>Document.ts` og importerer **kun** fra kernen (`../../writer`, `../../layout/*`) — aldrig fra en kanal (`src/pdf/`/`src/docx/`). Bindende regler for gate, writer-brug og layout ligger i dokument-kontrakterne.

```typescript
// src/document/generators/minNy/minNyDocument.ts

import { resolveDocumentSectionEndY, type BrevhovedData } from '../../layout/documentLayoutHelpers';
import { createStandardPdfWriter } from '../../writer';
import { cellLeft, cellRight, createDocumentTableHeaderCell, renderDocumentTable } from '../../layout/documentTableRenderer';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import type { DocumentCommonOptions, DocumentStamdata } from '../../layout/documentOptions';
import { TODAY } from '../../../config/dateRanges';

type MinNyDocumentOptions = DocumentCommonOptions & Readonly<{
  stamdata?: DocumentStamdata | null;
  // ... domænespecifikke parametre
}>;

export const buildMinNyDocumentFilename = (journalnr?: string): string =>
  resolveDocumentArtifactFileName('Min dokument-titel', false, journalnr);

export const generateMinNyDocument = (options: MinNyDocumentOptions): void => {
  const { visBrevhoved = false, stamdata = null } = options;

  // 1. Opret writer via den kanal-agnostiske router (PDF eller Word afgøres af konteksten)
  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  // 2. Metadata
  writer.setProperties({
    title: 'Min dokument-titel',
    subject: 'Erstatningsberegning',
    author: 'mineo.dk',
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
  writer.writeTitle('Min dokument-titel');

  // 5. Sektioner
  const doc = writer.getDoc();

  // Almindelige oplysningslinjer skrives som tekst
  writer.writeBoldSubheader('Stamdata');
  writer.writeLeftRightText('Beregningsdato', '17. marts 2026', { rightFontStyle: 'normal' });
  writer.writeLeftRightText('Årsløn', '500.000 kr.', { rightFontStyle: 'normal' });
  writer.addSectionSpacer();

  // Kun faktiske tabeller bruger tabelrendereren. Tabelstart afledes fra writerens cursor.
  writer.writeBoldSubheader('Sektion 1');
  const tableStartY = writer.getY();

  const finalY = renderDocumentTable({
    doc,
    startY: tableStartY,
    body: [
      [createDocumentTableHeaderCell('Beskrivelse', 'left'), createDocumentTableHeaderCell('Værdi', 'right')],
      [cellLeft('Række 1'), cellRight('1.234,00 kr.')],
    ],
    hasHeaderRow: true,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });

  writer.setY(resolveDocumentSectionEndY(finalY, tableStartY));

  // 6. Footer og gem
  writer.addFooter();
  writer.save(buildMinNyDocumentFilename(stamdata?.journalnr));
};
```

### Tilmelding til loader

Tilføj til `documentLoader.ts` (`src/document/service/`) — udvid `DocumentModuleMap`-typen og `moduleLoaders`-objektet:

```typescript
// I DocumentModuleMap:
minNy: typeof import('../generators/minNy/minNyDocument');

// I moduleLoaders:
minNy: () => import('../generators/minNy/minNyDocument'),

// Eksportér en navngiven loader-funktion:
export const loadMinNyDocumentModule = () => loadModule('minNy');
```

---

## 13. Skrifttyper, farver og mål

Aktuelle skrifttyper, farver, mål og spacingtal ejes af `pdfConfig.ts`, `pdfWriter.ts` og de relevante renderer-moduler. Denne arkitekturfil må ikke være kilde til konkrete millimetermål, RGB-værdier eller fontstørrelser.

Den bindende visuelle kontrakt er `src/contracts/document-output-contract.md` afsnit B.

---

## 14. Pengehåndtering og afrunding

Normative numeriske regler ejes af `src/contracts/amount-contract.md` og EO-specifikke money-regler af `src/contracts/eo-snapshot-contract.md`.

Dokument-laget skal modtage autoritative beløb/projektioner og formatere dem med canonical document-/domænehelpers. Det må ikke indføre lokal beregningsafrunding.

---

## 15. Eksisterende generatorer – overblik

| Generator                  | Fil                                | Formål                                           | Anvender model-lag? | DocumentCommonOptions? |
|----------------------------|------------------------------------|--------------------------------------------------|---------------------|-------------------|
| Erstatningsopgørelse       | `erstatningsopgoerelseDocument.ts` | Hoveddokument med TAF, svie/smerte, øvrige krav  | Ja (`eoSnapshotToEoDocument`) | Ja  |
| TAF fordelt på år          | `tafFordeltPaaAarDocument.ts`      | TAF-beregning brudt ned per kalenderår           | Ja (`eoSnapshotToTafPerYearDocument`) | Ja |
| TAF opreguleret til beregningsår | `tafOpreguleretPaaAarDocument.ts` | Per-år TAF opreguleret til beregningsåret   | Ja (`eoSnapshotToTafPerYearOpreguleretDocument`) | Ja |
| TAF kravgraf               | `tafKravGrafDocument.ts`           | Graf over TAF-krav pr. år                        | Ja (`eoSnapshotToTafKravGrafDocument`) | Ja |
| Arbejdsskadesatser         | `satserDocument.ts`                | Årsspecifikke satser (EAL, ASL, diverse)         | Nej                 | Ja               |
| Procesrente                | `renteDocument.ts`                 | Halvårlige renteperioder med referencerenter     | Nej                 | Ja               |
| Renteoversigt (samlet)     | `renteOversigtDocument.ts`         | Samlet oversigt over alle renteberegninger       | Nej                 | Ja               |
| Årslønsberegning           | `aarsloenDocument.ts`              | Årsløn med periodedata, satser og beregning      | Nej                 | Ja               |
| SH-dage                    | `shDageDocument.ts`                | Søgnehelligdage i perioder                       | Nej                 | Ja               |
| Méngodtgørelse             | `varigeMenDocument.ts`             | Varige mén med aldersreduktion                   | Nej                 | Ja               |
| KRL-satstabeller           | `krlDocument.ts`                   | KTO/SHK × kommuner/regioner                     | Nej                 | Ja               |
| Reguleringsgrundlag        | `reguleringDocument.ts`            | Overenskomst/statistikmodeller og offentlige satser | Nej             | Ja               |
| EET løbende ydelser        | `loebendeYdelserDocument.ts`       | Erhvervsevnetab: løbende ydelser                 | Nej                 | Ja               |
| EET kapitalisering         | `kapitaliseringDocument.ts`        | Erhvervsevnetab: kapitaliseret engangserstatning | Nej                 | Ja               |
| EET efter EAL              | `eetEfterEalDocument.ts`           | Erhvervsevnetab beregnet efter EAL               | Nej                 | Ja               |
| EET differencekrav         | `differencekravDocument.ts`        | Erhvervsevnetab: differencekrav                  | Nej                 | Ja               |
| Forsørgertab               | `forsoergertabDocument.ts`         | Forsørgertabserstatning                          | Nej                 | Ja               |

### Pseudo-tabeller

Reglen om pseudo-tabeller ejes af `document-output-contract.md` afsnit B. Dette overblik nævner kun, at simple label/værdi-opstillinger normalt bør være writer-baseret tekstlayout, ikke egentlige tabeller.

### Filnavngivning og journalnr

`satserDocument.ts` inkluderer bevidst ikke journalnr i filnavnet — satser er årsspecifikke og sagsagnostiske. Alle øvrige generatorer prefixer filnavnet med journalnr via `resolveDocumentArtifactFileName(title, isDraft, journalnr)`.

### Erstatningsopgørelse: model-renderer-split

Det komplekse EO-dokument bruger et tre-lags design:

1. **Snapshot-lag** (`eoSnapshot.ts`): Beregner `EoSnapshot` fra form-state.
2. **Projection-lag** (`eoSnapshotToEoDocument.ts`): Omsætter snapshot til `EoDocumentProjection` med alle beløb som `MoneyOre`. Dette er den faktiske entry point som rendereren kalder. Bygger på snapshot-/presentationslaget (`eoPresentationModel.ts`, `eoPresentationSectionBuilders.ts`) og de delte EO-domænemoduler, bl.a. `engines/loenudviklingBeregning.ts`, `engines/reguleringsPresentation.ts` og `helpers/eoSharedUtils.ts`. Afhænger ikke af jsPDF.
3. **Renderer-lag** (`erstatningsopgoerelseDocument.ts` + `sections/` i `src/document/generators/eo/`): Modtager `EoDocumentProjection`, renderer kanal-uagtigt via writeren.

TAF-fordelt-på-år bruger et tilsvarende mønster via `eoSnapshotToTafPerYearDocument.ts`.

Dette mønster er **ikke påkrævet** for simple generatorer, men bør anvendes, når domænelogikken er kompleks nok til at fortjene selvstændig testning.

### Stående regel: delt UI↔dokument-domænelogik ejes af domænelaget

Enhver afledning — visnings-betingelse, format eller beløbs-/dato-udledning — der konsumeres af
**både** en UI-fane og en dokument-generator, ejes af domænelaget. Hverken fanen eller generatoren
må holde sin egen kopi; begge importerer den samme domæne-helper.

Etablerede eksempler: `resolveLoebendeAfgoerelseRestVisning()`, `loentrinFinderCore.ts`,
`visGrundydelseNiveauSkift()` (2003→2024-niveauskift-betingelsen) og de delte EET-formatere i
`eetFormatUtils.ts` (`formatPct`, `formatJaNej`, `formatFaktor`). PDF-lagets `eetDocumentUtils.ts`
re-eksporterer disse under sine etablerede aliasser frem for at gendefinere dem.

Når en ny fælles afledning opdages: flyt den til domænelaget i samme ændring, og rut begge sider
til den. En lokal kopi i en `*Tab.tsx` *og* en `*Document.ts` er et symptom på, at reglen ikke er
fulgt.

---

## 16. Udeståender

### Anbefalet audit-plan for layout-standardisering

For layout-audit følges `src/contracts/document-output-contract.md` afsnit B (B10-B11). Auditsekvensen skal kun ejes ét sted; dette arkitekturdokument dublerer den ikke.
Se `src/contracts/document-output-contract.md` B11 for den kanoniske audit-rækkefølge.

Auditten skal fortsat kontrollere headerløse 2-kolonne-layouts, understregede labels med lokal spacing og writer-tests for regler der gøres centrale.

*(ingen øvrige kendte udeståender — senest gennemgået 2026-04-17)*
