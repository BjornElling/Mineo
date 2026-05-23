# Mineo – PDF-layout-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Gælder for:** Alle Mineo PDF-renderere, writer/helpers og generatorer.

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
3. Underoverskriftsfamilie
4. Brødtekst (ren tekst / mixed normal+fed)
5. Venstre/højre-oplysningslinje
6. Tabel

Underoverskriftsfamilien har præcis to kanoniske typer:

1. Fed underoverskrift
2. Understreget underoverskrift

De to typer er ligestillede i layoutmæssig forstand. Deres fælles adfærdsregler er defineret i §4.

De adskiller sig kun ved deres visuelle markering:

1. Fed underoverskrift renderes med fed skrift
2. Understreget underoverskrift renderes med understregning

Generatorer må ikke indføre lokale mellemformer eller pseudo-underoverskrifter for de samme formål.

Generatorer må ikke opfinde ekstra lokale tekstkategorier for de samme formål.

> **Bemærkning:** `writeNormalThenBoldLine()` er en variant af brødtekst (type 4) der skriver normal tekst efterfulgt af fed tekst på samme linje. Den er kanonisk og hører under brødtekst-kategorien — ikke en selvstændig type.

---

## 3. Kanoniske writer-/helper-API'er

Hver teksttype har én primær, gyldig renderingsvej:

| Formål | Kanonisk API | Bemærkning |
|--------|---------------|------------|
| Dokumenttitel | `writer.writeTitle()` | Eneste gyldige titel-API |
| Sektionsoverskrift | `writer.writeSectionHeader()` | Bruges ved egentlige sektionsskift |
| Fed underoverskrift | `writer.writeBoldSubheader()` | Kanonisk basis-API; standard-followup er writerens observerbare keep-together garanti |
| Fed underoverskrift + ét tekstafsnit | `writer.writeBoldSubheaderWithWrappedText()` | Foretrækkes når underoverskrift og ét efterfølgende tekstafsnit skal holdes atomisk samlet |
| Understreget underoverskrift | `writer.writeUnderlinedSubheader()` | Kanonisk basis-API; standard-X er centralt defineret |
| Brødtekst | `writer.writeWrappedText()` | Standard for almindelig fritekst |
| Fed brødtekst | `writer.writeBoldWrappedText()` | Variant af brødtekst til hele tekstblokke med fed vægt |
| Fortsat brødtekst uden trailing spacing | `writer.writeWrappedTextContinued()` | Kun ved bevidst fortsættelse af samme logiske blok |
| Mixed normal+fed på én linje | `writer.writeNormalThenBoldLine()` | Til formler og linjer med blandet vægt; ikke en selvstændig teksttype |
| Venstre/højre-oplysningslinje | `writer.writeLeftRightText()` | Standard for key/value-, formel- og beløbslinjer |
| Tabel | `renderPdfTable()` | Eneste gyldige API til egentlige tabeller |
| Tabelstart efter `addSectionHeading(...)` | `resolvePdfTableStartYAfterSectionHeading()` | Kanonisk helper til `headingY - PDF_SECTION_HEADING_GAP` |

Hvis underoverskrifter kræver conditional rendering eller atomisk sammenkædning med efterfølgende indhold, skal dette løses centralt i writer/helper-laget. Generatorer må ikke reimplementere disse regler lokalt.

`standard-followup-height` er ikke én offentlig konstant. Det er writerens observerbare garanti for, at underoverskrift og første meningsbærende indholdsblok ikke adskilles af sideskift. De konkrete minimumshøjder ejes af writer-laget og dets tests.

`writeBoldSubheader()` skal som udgangspunkt kaldes uden `nextLineHeight`-argument. Generatorer må kun sende eksplicit `nextLineHeight`, når den første efterfølgende indholdsblok reelt kræver en anden atomisk højde end writerens standard-followup-height.

`writeSectionHeader()` skal som udgangspunkt kaldes uden `nextLineHeight`-argument. Generatorer må kun sende eksplicit `nextLineHeight`, når den første efterfølgende indholdsblok reelt kræver en anden atomisk højde end writerens standard-followup-height.

`writeUnderlinedSubheader()` skal som udgangspunkt bruge writerens centralt definerede standard-X-position. Generatorer må kun sende eksplicit X-koordinat, hvis en konkret layoutafvigelse kræver det.

Hvis en venstre/højre-oplysningslinje kræver eksplicitte linjeskift i højrekolonnen, skal også dette håndteres centralt i writer-laget. Generatorer må ikke splitte værdien lokalt og derefter reparere spacing eller Y-forløb med `advanceY(...)`, tom venstre kolonne eller anden ad hoc layoutlogik.

Hvis en generator har behov for en hel tekstblok i fed som advarsel, note eller anden fremhævet brødtekst, skal dette løses via en central brødtekst-variant i writer-laget. Generatorer må ikke omkring et enkelt `writeWrappedText()`-kald sætte font manuelt og derefter nulstille den igen.

Det er ikke tilladt at:

- sætte font manuelt og skrive tekst direkte som erstatning for `writeTitle`, `writeSectionHeader`, `writeBoldSubheader` eller `writeUnderlinedSubheader`
- implementere lokale pseudo-overskrifter via `doc.text(...)` + egen spacing
- bruge tabelrendereren til indhold som semantisk er almindelig tekst

---

## 4. Font og semantik

Teksttyperne har fast semantik:

1. `writeSectionHeader()`
   Bruges til hovedafsnit eller markante sektionsskift i dokumentet.

2. Underoverskriftsfamilien
   Bruges til underafsnit og markerede delafsnit under en sektion.
   Må ikke bruges som ren spacing-mekanisme.
   De to typer er layoutmæssigt ligestillede og følger samme centrale invariants for:
   - afstand over underoverskriften
   - afstand under underoverskriften
   - sidebrydningsregler
   - undertrykkelse ved tomt afsnit
   - central styring af spacing og layoutinvariants
   Begge underoverskriftstyper følger disse fælles regler:
   - de må kun renderes, hvis der følger mindst én meningsbærende indholdsblok
   - de skal holdes samlet med den første meningsbærende indholdsblok efter underoverskriften
   - de må ikke stå alene nederst på en side uden efterfølgende indhold i samme afsnit

3. Meningsbærende indholdsblok
   Omfatter mindst brødtekst, venstre/højre-oplysningslinjer, mixed normal+fed-linjer, tabeller og andre kanoniske tekstblokke, der reelt udgør afsnittets indhold.
   Tom spacing, tomme labels eller tekniske placeholders er ikke meningsbærende indhold.

4. `writeWrappedText()`
   Bruges til forklarende tekst og almindelige linjer uden højre kolonne.

5. `writeLeftRightText()`
   Bruges til oplysningslinjer, formler og beløbslinjer, der ikke skal i tabel.

### 4.1 Brødtekst som typografisk baseline

Brødtekst er den kanoniske typografiske baseline for almindeligt PDF-indhold.

Det indebærer, at følgende writer-API'er skal bygge på samme grundtypografi som brødtekst og kun afvige med det minimum, der er nødvendigt for deres formål:

1. `writeWrappedText()`
2. `writeBoldWrappedText()`
3. `writeWrappedTextContinued()`
4. `writeNormalThenBoldLine()`
5. `writeLeftRightText()`

Den fælles baseline omfatter mindst:

1. samme font family
2. samme fontstørrelse
3. samme standardtekstfarve
4. samme normale line-height
5. samme grundlæggende tekstflow/wrapping-princip, hvor layouttypen tillader det

Tilladte variationer over brødtekst-baselinen er kun:

1. fjernelse af trailing spacing ved bevidst fortsættelse af samme logiske blok
2. lokal vægtændring i hele tekstblokke eller dele af en linje
3. venstre/højre-kolonneopsætning, alignment og anden minimal layoutlogik, der er nødvendig for oplysningslinjer, formler eller beløbslinjer

Det er ikke tilladt at lade disse writer-API'er udvikle egne lokale typografiske systemer med særskilt fontstørrelse, særskilt linjehøjde eller andre frie visuelle regler, hvis concernet kan bæres af brødtekst-baselinen.

Hvis indholdets semantik er uklar, skal generatoren vælge den eksisterende teksttype, der bedst matcher brugerens læseoplevelse, frem for at opfinde et lokalt layoutmønster.

---

## 5. Spacing-regler

### 5.1 Omkring underoverskriftsfamilien

1. Afstand over fed og understreget underoverskrift styres centralt og skal være identisk.
2. Afstand under fed og understreget underoverskrift styres centralt og skal være identisk.
3. En generator må ikke lægge ekstra manuel topafstand eller bundafstand omkring en underoverskrift for at "få det til at se rigtigt ud".
4. Hvis der allerede er opnået spacing via forudgående `addSpacer`, `advanceY` eller `setY(...)` efter sektion/tabel, skal underoverskriften stadig ende med den centrale standardafstand og ikke mere.
5. Hvis spacing eller sidebrydningsadfærd ændres for den ene underoverskriftstype, skal den anden automatisk følge med via samme centrale invariant.
6. Hvis der opleves behov for lokal kompensation omkring én af underoverskriftstyperne, er det et arkitekturproblem i writer/helper-laget og skal løses centralt dér.
7. Eventuelle options til at undertrykke topspacing må kun bruges, når underoverskriften bevidst skal stå direkte efter en sektionsoverskrift eller tilsvarende kanonisk header-kontekst.

### 5.2 Mellem almindelige tekstblokke

1. Brødtekst og venstre/højre-oplysningslinjer bruger writerens indbyggede line-height og trailing spacing.
2. Generatorer må ikke kompensere for standard line-height med lokale negative `advanceY(...)`, medmindre det er en veldokumenteret teknisk undtagelse.
3. Et tilbagevendende anti-mønster i venstre/højre-oplysningslinjer er lokal `value.split('\n')` efterfulgt af manuel Y-korrektion for at få fortsættelseslinjer til at "sidde rigtigt". Det skal betragtes som en afvigelse og erstattes af central writer-adfærd.
4. Et tilbagevendende anti-mønster omkring underoverskrifter er kunstigt oppustet `nextLineHeight` for at simulere ekstra sektionsafstand eller holde større lokale blokke samlet. Det skal betragtes som en afvigelse og erstattes af central writer-adfærd eller reelle canonical overgange.

### 5.3 Mellem sektioner

1. Mellemrum mellem sektioner styres af writerens header-metoder eller — hvor der er behov for eksplicit spacing — af `writer.addSpacer()` med en veldefineret konstant.
2. Lokale sektioner må ikke vælge egne frie sektionsafstande uden eksplicit begrundelse.
3. `SECTION_SPACER` (10 mm) er udelukkende beregnet til Y-overgang efter `renderPdfTable()` via `resolvePdfSectionEndY()` og til tilsvarende autotable-kontekster. Brug `writer.addSectionSpacer()` i rent writer-baserede dokumenter.
4. Den kanoniske sektionsseparator i rent writer-baserede dokumenter (uden autotable) er `writer.addSectionSpacer()`.
5. `writer.addSectionSpacer()` er den navngivne writer-standard for den centrale writer-baserede sektionsafstand. Generatorer må ikke sende `PDF_BASE_LINE_HEIGHT_MM` direkte til `writer.addSpacer()` blot for at gentage denne standard.
6. Et tilbagevendende anti-mønster i simple writer-baserede dokumenter er `writer.addSpacer(SECTION_SPACER)` umiddelbart efter grupper af `writeLeftRightText()`- eller `writeWrappedText()`-linjer. Det skal betragtes som en afvigelse og erstattes med writer-baseret standardafstand, medmindre der faktisk afsluttes en tabel- eller autotable-lignende blok.
7. Når en tabelsektion bruger `addSectionHeading(...)`, skal beregningen af tabelens faktiske `startY` ske via en central helper. Generatorer må ikke lokalt genimplementere offset-reglen som `headingY - PDF_SECTION_HEADING_GAP`.

### 5.4 Efter tabeller

1. Tabellen afsluttes med en kanonisk overgang til næste blok.
2. Efter `renderPdfTable()` skal næste Y-position afledes via `resolvePdfSectionEndY(...)` eller tilsvarende central helper.
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
2. at indføre ekstra afstand over `writeBoldSubheader()`
3. at indføre ekstra afstand over `writeUnderlinedSubheader()`
4. at kompensere for uklare eller inkonsistente lokale Y-forløb i stedet for at rette den centrale writer/helper-adfærd
5. at bruge `SECTION_SPACER` (10 mm) som generel sektionsseparator i rent writer-baserede dokumenter — se §5.3
6. at sende `PDF_BASE_LINE_HEIGHT_MM` direkte til `writer.addSpacer()` som erstatning for den navngivne standard `writer.addSectionSpacer()` — se §5.3 punkt 5

Hvis en generator oplever behov for gentagne lokale spacing-korrektioner, er det et arkitekturproblem i writer/helper-laget og skal løses dér.

---

## 7. Tabeller vs. ikke-tabeller

1. Egentlige tabeller skal renderes via `renderPdfTable()`.
2. Headerløse 2-kolonne-opstillinger, formler, specifikationer og simple label/værdi-linjer er ikke tabeller og skal skrives via writeren.
3. En generator må ikke vælge tabelrenderer alene for at få “nem alignment”, hvis indholdet semantisk ikke er en tabel.

---

## 8. Direkte jsPDF-brug

Direkte skrivning via `doc.text(...)` eller lignende er kun acceptabel efter formålskategori:

1. Tabel-callbacks og `renderPdfTable()`-integration må bruge direkte jsPDF-adgang uden ekstra note.
2. Lavniveau-tegneprimitiver for streger og geometri må bruge direkte jsPDF-adgang uden ekstra note.
3. Almindelig tekst, spacing eller domænetekst må kun bruge direkte jsPDF-adgang, hvis writer/helper-laget mangler en nødvendig evne, og callsite dokumenterer undtagelsen efter §9.

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
2. at der ikke findes lokal manuel topafstand eller bundafstand omkring `writeBoldSubheader()` eller `writeUnderlinedSubheader()`
3. at begge underoverskriftstyper følger samme centrale spacing- og sidebrydningsregler
4. at underoverskrifter uden efterfølgende meningsbærende indhold undertrykkes
5. at tabeller afsluttes via canonical section-end-regel
6. at headerløse pseudo-tabeller er erstattet med writer-baseret tekstlayout
7. at lokale `setFont`/`setFontSize`-forløb ikke emulerer eksisterende teksttyper
8. at line-height og sektionafstand alene kommer fra centrale konstanter — og at den rigtige konstant er valgt til konteksten (autotable vs. writer, jf. §5.3)
9. at simple writer-baserede dokumenter ikke bruger `writer.addSpacer(SECTION_SPACER)` som tommelfingerregel efter blokke med `writeLeftRightText()` eller `writeWrappedText()`
10. at simple writer-baserede dokumenter bruger `writer.addSectionSpacer()` i stedet for rå `writer.addSpacer(PDF_BASE_LINE_HEIGHT_MM)` når intentionen blot er standard-sektionsafstand, jf. §5.3 punkt 5
11. at multiline højrekolonner i `writeLeftRightText()` ikke implementeres via lokal `split('\n')`, tom venstre kolonne og manuel `advanceY(...)`-korrektion
12. at generatorer ikke laver lokal `setFont(...)` / `setFontSize(...)` omkring enkelte brødtekstblokke som advarsler eller noter, når en central writer-variant kan bære behovet
13. at `nextLineHeight` til `writeBoldSubheader()` afspejler den første reelle efterfølgende indholdsblok og ikke bruges som skjult spacing- eller keep-together-mekanisme
14. at generatorer udelader `nextLineHeight`, standard-X, `PDF_BASE_LINE_HEIGHT_MM`, `MARGINS.left` og tilsvarende standardargumenter, medmindre værdien semantisk afviger fra writerens default eller callsite dokumenterer en eksplicit layout-undtagelse efter §9
15. at generatorer ikke lokalt genimplementerer tabelstart efter `addSectionHeading(...)` via `headingY - PDF_SECTION_HEADING_GAP`, men bruger en central helper

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
10. `eetEfterEalPdf.ts`
11. `differencekravPdf.ts`
12. `forsoergertabPdf.ts`
13. `tafFordeltPaaAarPdf.ts`
14. `erstatningsopgoerelsePdf.ts`
15. `opgoerelseSection.ts`
16. `shDageSection.ts`
17. `loenindkomstSection.ts`
18. `offentligeYdelserSection.ts`
19. `reguleringSection.ts`

Formålet med sekvensen er først at rydde de simple og mellemkomplekse generatorer og derefter de mere domænetunge dokumenter.

En generator fjernes fra denne liste, når den har bestået fuld audit mod §10, og der findes relevante writer-/generator-tests for dens centrale spacing-, sidebrydnings- eller gate-invariants. Når første audit-runde er afsluttet, bør listen flyttes til et trackingdokument.

---

## 12. Enforce­ment

Denne kontrakt skal understøttes af:

1. central adfærd i `pdfWriter.ts`
2. fælles konstanter i `pdfConfig.ts`
3. writer unit-tests for spacing- og sidebrydningsinvariants
4. quality guards for kendte generator-anti-mønstre
5. generator-/domænetests for trust-kritiske gates og output-specifikke blokeringer

Tekstbaserede quality guards er sekundære sikkerhedsnet. De må ikke erstatte egentlige writer- og domænetests.

Hvis kode og kontrakt divergerer, er det en arkitekturfejl, ikke en stilforskel.
