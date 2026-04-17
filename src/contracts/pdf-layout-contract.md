# Mineo – PDF-layout-kontrakt

**Status:** Gældende arkitektur (normativ)

Denne kontrakt fastlægger den visuelle og strukturelle standard for Mineos PDF-output.

`pdf-contract.md` fastlægger hvilke data og guards PDF-output må bygge på.
Denne kontrakt fastlægger hvordan PDF-output skal komponeres, så dokumenterne fremstår ensartede og uden utilsigtede lokale layoutafvigelser.

Ved konflikt gælder:

1. `pdf-contract.md` for data-/gate-/guard-regler
2. `pdf-layout-contract.md` for visuel struktur, teksttyper, tabeller og spacing
3. domænespecifikke PDF-regler kun hvor denne kontrakt udtrykkeligt giver plads til dem

---

## 1. Grundregel

1. PDF-layout skal være standardiseret på tværs af dokumenttyper.
2. Lokale generatorer må ikke indføre egne spacing- eller tekstmønstre, hvis concernet allerede er dækket af `pdfWriter.ts`, `pdfHelpers.ts`, `pdfTableRenderer.ts` eller `pdfConfig.ts`.
3. Ensartethed vægtes højere end lokal finjustering.
4. Afvigelser er kun acceptable, når de er nødvendige for korrekt sidebrydning, reel tabelgeometri eller eksplicit dokumenteret domænekrav.

---

## 2. Kanoniske teksttyper

Følgende teksttyper er de eneste kanoniske bloktyper i Mineo-PDF'er:

1. Dokumenttitel
2. Sektionsoverskrift
3. Fed underoverskrift
4. Understreget label
5. Brødtekst (ren tekst / mixed normal+fed)
6. Venstre/højre-oplysningslinje
7. Tabel

Generatorer må ikke opfinde ekstra lokale tekstkategorier for de samme formål.

> **Bemærkning:** `writeNormalThenBoldLine()` er en variant af brødtekst (type 5) der skriver normal tekst efterfulgt af fed tekst på samme linje. Den er kanonisk og hører under brødtekst-kategorien — ikke en selvstændig type.

---

## 3. Kanoniske writer-/helper-API'er

Hver teksttype har én primær, gyldig renderingsvej:

| Formål | Kanonisk API | Bemærkning |
|--------|---------------|------------|
| Dokumenttitel | `writer.writeTitle()` | Eneste gyldige titel-API |
| Sektionsoverskrift | `writer.writeSectionHeader()` | Bruges ved egentlige sektionsskift |
| Fed underoverskrift | `writer.writeSubheader()` | Eneste gyldige API til fed underoverskrift |
| Fed underoverskrift (betinget) | `writer.writeSubheaderIfContent()` | Undertrykker overskrift og indhold hvis `hasContent = false` |
| Fed underoverskrift + tekst | `writer.writeSubheaderWithWrappedText()` | Når overskrift og efterfølgende tekst skal holdes samlet |
| Understreget label | `writer.writeUnderlinedLabel()` | Eneste gyldige API til understreget label |
| Brødtekst | `writer.writeWrappedText()` | Standard for almindelig fritekst |
| Fortsat brødtekst uden trailing spacing | `writer.writeWrappedTextContinued()` | Kun ved bevidst fortsættelse af samme logiske blok |
| Mixed normal+fed på én linje | `writer.writeNormalThenBoldLine()` | Til formler og linjer med blandet vægt; ikke en selvstændig teksttype |
| Venstre/højre-oplysningslinje | `writer.writeLeftRightText()` | Standard for key/value-, formel- og beløbslinjer |
| Tabel | `renderEoStylePdfTable()` | Eneste gyldige API til egentlige tabeller |

Det er ikke tilladt at:

- sætte font manuelt og skrive tekst direkte som erstatning for `writeTitle`, `writeSectionHeader`, `writeSubheader` eller `writeUnderlinedLabel`
- implementere lokale pseudo-overskrifter via `doc.text(...)` + egen spacing
- bruge tabelrendereren til indhold som semantisk er almindelig tekst

---

## 4. Font og semantik

Teksttyperne har fast semantik:

1. `writeSectionHeader()`
   Bruges til hovedafsnit eller markante sektionsskift i dokumentet.

2. `writeSubheader()`
   Bruges til normale underafsnit med fed skrift.
   Må ikke bruges som ren spacing-mekanisme.

3. `writeUnderlinedLabel()`
   Bruges til fremhævet label eller mellemoverskrift, hvor semantikken er en markeret label og ikke en almindelig fed underoverskrift.

4. `writeWrappedText()`
   Bruges til forklarende tekst og almindelige linjer uden højre kolonne.

5. `writeLeftRightText()`
   Bruges til oplysningslinjer, formler og beløbslinjer, der ikke skal i tabel.

Hvis indholdets semantik er uklar, skal generatoren vælge den eksisterende teksttype, der bedst matcher brugerens læseoplevelse, frem for at opfinde et lokalt layoutmønster.

---

## 5. Spacing-regler

### 5.1 Over underoverskrifter

1. Afstand over fed underoverskrift styres centralt af `writer.writeSubheader()`.
2. En generator må ikke lægge ekstra manuel topafstand oven over en underoverskrift for at "få det til at se rigtigt ud".
3. Hvis der allerede er opnået spacing via forudgående `addSpacer`, `advanceY` eller `setY(...)` efter sektion/tabel, skal underoverskriften stadig ende med den centrale standardafstand og ikke mere.
4. `options.addTopSpacing = false` må kun bruges når underoverskriften bevidst skal stå direkte efter en sektionsoverskrift eller tilsvarende canonical header-kontekst.

### 5.2 Under understreget label

1. Afstand over understreget label styres centralt af `writer.writeUnderlinedLabel()`.
2. Eksisterende manuel spacing før label skal kollapses til standarden og må ikke ophobes.

### 5.3 Mellem almindelige tekstblokke

1. Brødtekst og venstre/højre-oplysningslinjer bruger writerens indbyggede line-height og trailing spacing.
2. Generatorer må ikke kompensere for standard line-height med lokale negative `advanceY(...)`, medmindre det er en veldokumenteret teknisk undtagelse.

### 5.4 Mellem sektioner

1. Mellemrum mellem sektioner styres af writerens header-metoder eller — hvor der er behov for eksplicit spacing — af `writer.addSpacer()` med en veldefineret konstant.
2. Lokale sektioner må ikke vælge egne frie sektionsafstande uden eksplicit begrundelse.
3. `SECTION_SPACER` (10 mm) er **udelukkende** beregnet til Y-overgang efter `renderEoStylePdfTable()` (via `resolvePdfSectionEndY()`) og til tilsvarende autotable-kontekster. Den må ikke bruges som sektionsseparator i rent writer-baserede dokumenter, fordi `writeSubheader()`s topSpacing-logik er kalibreret til `PDF_BASE_LINE_HEIGHT_MM` (4 mm) — ikke til 10 mm. Brug af `SECTION_SPACER` foran `writeSubheader()` i writer-baserede dokumenter producerer korrekt nul ekstra topSpacing, men selve 10 mm-afstanden er visuelt for stor og inkonsistent med EO-dokumenternes udtryk.
4. Den kanoniske sektionsseparator i rent writer-baserede dokumenter (uden autotable) er `writer.addSpacer(PDF_BASE_LINE_HEIGHT_MM)`.

### 5.5 Efter tabeller

1. Tabellen afsluttes med en kanonisk overgang til næste blok.
2. Efter `renderEoStylePdfTable()` skal næste Y-position afledes via `resolvePdfSectionEndY(...)` eller tilsvarende central helper.
3. Generatoren må ikke lægge ad hoc ekstra topafstand ind foran næste underoverskrift for at kompensere for tabelafslutningen.

---

## 6. Manuel spacing: tilladt og forbudt

### Tilladt

Manuel spacing via `writer.addSpacer(...)` eller `writer.advanceY(...)` er kun tilladt når:

1. der bevidst indsættes afstand mellem to indholdsblokke, som ikke allerede har en canonical overgang
2. en tabel eller anden kompleks blok kræver en tydelig afslutning før næste sektion
3. en teknisk layoutjustering er nødvendig for korrekt sidebrydning eller tabelgeometri

### Forbudt

Manuel spacing må ikke bruges til:

1. at emulere lokale overskriftsregler
2. at indføre ekstra afstand over `writeSubheader()`
3. at indføre ekstra afstand over `writeUnderlinedLabel()`
4. at kompensere for uklare eller inkonsistente lokale Y-forløb i stedet for at rette den centrale writer/helper-adfærd
5. at bruge `SECTION_SPACER` (10 mm) som generel sektionsseparator i rent writer-baserede dokumenter — se §5.4

Hvis en generator oplever behov for gentagne lokale spacing-korrektioner, er det et arkitekturproblem i writer/helper-laget og skal løses dér.

---

## 7. Tabeller vs. ikke-tabeller

1. Egentlige tabeller skal renderes via `renderEoStylePdfTable()`.
2. Headerløse 2-kolonne-opstillinger, formler, specifikationer og simple label/værdi-linjer er ikke tabeller og skal skrives via writeren.
3. En generator må ikke vælge tabelrenderer alene for at få “nem alignment”, hvis indholdet semantisk ikke er en tabel.

---

## 8. Direkte jsPDF-brug

Direkte skrivning via `doc.text(...)` eller lignende er kun acceptabel når:

1. tabelbibliotekets callbacks kræver direkte jsPDF-adgang
2. lavniveau-tegneprimitiver er nødvendige for streger eller lignende
3. concernet endnu ikke er dækket af writer/helper-laget, og udvidelse af det centrale lag er uforholdsmæssig i den konkrete ændring

Direkte jsPDF-brug til almindelige tekstblokke er en afvigelse og skal som udgangspunkt fjernes.

---

## 9. Undtagelser

Hvis en bevidst afvigelse er nødvendig, skal den dokumenteres kort ved callsite i koden med:

1. hvorfor canonical API ikke kan bruges sikkert
2. hvilken konkret layout-risiko afvigelsen håndterer
3. hvad der skal være sandt før afvigelsen kan fjernes igen

Undtagelser må ikke bruges som stilvalg.

---

## 10. Audit-regler for eksisterende generatorer

Ved audit af en PDF-generator skal mindst følgende kontrolleres:

1. at alle overskrifter bruger canonical writer-metoder
2. at der ikke findes lokal manuel topafstand over `writeSubheader()` eller `writeUnderlinedLabel()`
3. at tabeller afsluttes via canonical section-end-regel
4. at headerløse pseudo-tabeller er erstattet med writer-baseret tekstlayout
5. at lokale `setFont`/`setFontSize`-forløb ikke emulerer eksisterende teksttyper
6. at line-height og sektionafstand alene kommer fra centrale konstanter — og at den rigtige konstant er valgt til konteksten (autotable vs. writer, jf. §5.4)

---

## 11. Anbefalet audit-sekvens

For at fjerne eksisterende utilsigtede forskelle bør PDF-generatorerne gennemgås i denne rækkefølge:

1. `satserPdf.ts`
2. `rentePdf.ts`
3. `aarsloenPdf.ts`
4. `shDagePdf.ts`
5. `varigeMenPdf.ts`
6. `krlPdf.ts`
7. `reguleringPdf.ts`
8. `loebendeYdelserPdf.ts`
9. `kapitaliseringPdf.ts`
10. `differencekravPdf.ts`
11. `forsoergertabPdf.ts`
12. EO-sektionerne under `src/pdf/domains/eo/sections/*`

Formålet med sekvensen er først at rydde de simple og mellemkomplekse generatorer og derefter de mere domænetunge dokumenter.

---

## 12. Enforce­ment

Denne kontrakt skal understøttes af:

1. central adfærd i `pdfWriter.ts`
2. fælles konstanter i `pdfConfig.ts`
3. målrettede writer-tests for spacing-invariants
4. løbende audit af generatorer, der stadig har lokale layoutafvigelser

Hvis kode og kontrakt divergerer, er det en arkitekturfejl, ikke en stilforskel.
