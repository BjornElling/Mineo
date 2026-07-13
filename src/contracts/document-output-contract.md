# Dokument-output-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Tværgående kontrakt. Begrænser øvrige kontrakter for sit emne (dokument-output). Domænespecifikke snapshot-/projektionskontrakter må specificere egne projektioner, men må ikke svække reglerne her. Underordnet `domain-boundary-contract.md` for domænegrænser; formatvalg mellem PDF og Word reguleres normativt af `document-format-contract.md`. `page-component-contract.md` er underordnet denne kontrakt.
**Senest verificeret mod kode:** 2026-07-13

## 1. Scope

Denne kontrakt fastlægger de tværgående regler for alt dokument-output i Mineo: de genererede tillidskritiske dokumenter, der downloades til brugeren.

Output dækker **to kanaler**:

1. **PDF** (jsPDF), bygget via PDF-kanalen i `src/pdf/` (`createPdfChannelWriter`).
2. **Word** (.docx), bygget via Word-kanalen i `src/docx/` (`createDocxWriter`).

Begge kanaler forbruger den samme immutable `DocumentModel` fra
`src/document/model/documentModel.ts`. Generatorerne bygger modellen gennem
`DocumentComposer` og har ingen adgang til kanal, sidecursor, dokumentbredde eller råt
kanalobjekt. En eksplicit `DocumentGenerationSession` ejer renderingen uden modul-global
state; formatvalget reguleres af `document-format-contract.md`.

Kontrakten er opdelt i:

- **Afsnit A — Data, gate og guards (kanal-neutral):** hvilke data og guards output må bygge på. Gælder fuldt for begge kanaler.
- **Afsnit B — Komposition og render-target-API:** hvordan generatorer komponerer via `DocumentComposer`, og hvordan den centrale modelrenderer afspiller blokke mod det interne writer-target. Layoutreglerne er dobbeltkanal, fordi både PDF- og Word-targetet opfylder samme interne grænseflade.

Domænespecifikke snapshot-kontrakter må gerne specificere egne projektioner, men de må ikke afvige fra reglerne her.

---

# Afsnit A — Data, gate og guards (kanal-neutral)

Reglerne i dette afsnit er uafhængige af outputkanal. De gælder uændret for både PDF (jsPDF) og Word (docx), fordi begge kanaler forsynes med den samme autoritative model og afvikles gennem den samme download-sti.

## A1. Grundregel

1. Dokument-output er trust-kritisk output.
2. Renderere og generatorer må kun bygge på committed, autoritativt input eller autoritative projektioner.
3. Renderere må ikke læse draft-state, UI-state eller uautoriserede persisted sektioner.

## A2. Download-gate-definition

Download er blokeret hvis og kun hvis mindst én af følgende er sand:

1. Der findes blokerende feltfejl på de relevante committed inputfelter.
2. Den autoritative beregning kan ikke dannes. For snapshot-first-domæner betyder det en typed status/projektion fra `snapshot-contract.md` og den relevante domænekontrakt. For ikke-snapshot-domæner skal domænet levere et eksplicit preflight-/gate-resultat med samme semantik.
3. Det konkrete output er blokeret af output-specifikke invariants eller guards.

Konsekvens:

- Feltfejl, snapshot-status og output-specifikke blokeringer skal aggregeres eksplicit.
- Ingen download-knap må nøjes med kun én af disse tre kilder.
- Aggregeringen ejes af domæne-/snapshot-/preflight-laget eller et centralt dokument-gate-lag, ikke af den enkelte renderer.
- Download-knapper skal modtage et samlet gate-resultat med `canDownload` og auditerbare årsager.
- Generatorer afgør ikke selv, om domænet er `fail_closed`; de modtager en allerede godkendt model eller returnerer runtime-fejl.

Gate-definitionen er kanal-neutral: et dokument der er blokeret for PDF, er også blokeret for Word, og omvendt. Formatvalget ændrer ikke gaten.

`documentService.ts` (`src/document/service/documentService.ts`) er i den nuværende arkitektur service boundary for download-afvikling, lazy-load og runtime-fejl. Langsigtet skal domænepolitik og gates flyttes ud i domænesnapshots/projektioner, så service-laget bliver mekanisk adapter.

## A3. Toggle-guards for betingede felter

Når et felt i UI vises betinget af et toggle, et valg eller en anden brugerbeslutning, skal den renderer der kan udskrive feltet have en tilsvarende guard.

Acceptable mønstre:

1. Sektionsniveau:
   - engine/projection returnerer autoritativt `beregnes = false`
   - rendereren undertrykker hele sektionen
2. Feltniveau:
   - rendereren har en eksplicit `if`-guard før værdien skrives

Det er ikke acceptabelt at indføre parallel masking eller skjult data-mutation i entry-pointet kun for dokument-output.

Manglende guard er en kritisk fejl, fordi stale værdier ellers kan udskrives i et tillidskritisk dokument — uanset kanal.

## A4. Semantisk fravalg

Hvis en delberegning er semantisk fravalgt i det autoritative beregningslag, må dokument-laget ikke genindføre den via visningsvalg.

Det gælder både:

- sektioner
- fradragslinjer
- mellemregninger
- bilag
- andre afledte visninger

Et visningsvalg er et visningsønske, ikke en ret til at overstyre semantisk fravalg.

## A5. Runtime-fejl under download

1. Hvis download var korrekt gated, men selve dokument-genereringen fejler ved runtime, er det en systemteknisk fejl.
2. Brugeren må ikke mødes af en `BugReportButton` inline i sideflowet eller i en download-dialog.
3. Fejlen routes via den centrale fejlrapportering jf. `error-contract.md`.

Lokale fejlbeskeder må kun bruges til forventelige brugerrettelige gate-/preflight-tilstande eller DEV-specifik dev-server-nedetid. Uventede runtime-fejl under en godkendt download er systemfejl.

## A6. Domænespecifikke projektioner

EO- og TAF-fordelt-på-år-projektioner er specificeret i `eo-snapshot-contract.md`. Øvrige domæner skal pege på deres minimale domænekontrakt, fx:

- `aarsloen-contract.md`
- `renteberegning-contract.md`
- `varigemen-contract.md`
- `forsoergertab-snapshot-contract.md`
- `satser-contract.md`

Domænespecifikke projektioner må supplere denne kontrakt, men må ikke svække A1–A5.

## A7. Autoritative kilder og lag-topologi

1. `src/document/` er den **kanoniske**, format-agnostiske dokument-kerne og opdelt i:
   - `src/document/model/` — blokalgebra, `DocumentComposer` og central modelrenderer.
   - `src/document/writer/` — intern render-target-grænse; må ikke importeres af generatorer.
   - `src/document/layout/` — kanalneutral tabelmodel (`tableSpec.ts`), tekst-/format-utils, fælles layoutværdier, helpers, brevhoved-mapping, gate-typer og dokument-options. Mappen må ikke indeholde en Word↔PDF-bro eller importere en konkret tabelkanal.
   - `src/document/generators/` — én generator (+ evt. `sections/`) pr. domæne (`*Document.ts`).
   - `src/document/service/` — service-boundary/download-afvikling (`documentService.ts`) og lazy-loader (`documentLoader.ts`).
2. De **to kanaler** er rene infrastruktur-implementeringer af `DocumentWriter` og ligger uden for kernen:
   - **PDF-kanalen** i `src/pdf/` (jsPDF): adapter, writer-fabrik, brevhoved-renderer, den direkte `TableSpec`-renderer (`pdfTableRenderer.ts` + `pdfDocumentTableRenderer.ts`), render-helpers og standalone-rente-service.
   - **Word-kanalen** i `src/docx/` (writer + understøttende infrastruktur). Begge kanaler indeholder ingen domænegeneratorer: PDF og Word genbruger den samme `DocumentModel`, som generatorerne bygger gennem `DocumentComposer` (jf. afsnit B).
3. Der findes **ikke** længere et selvstændigt EO-PDF-lag under `src/domain/erstatningsopgoerelse/pdf/`. Det tidligere lag var ikke reel renderingskode (ingen jsPDF), men EO-præsentations- og regulerings-logik, der byggede tabel-*data*. Den er konsolideret ind i domænelaget (review-planens punkt 10.5):
   - Regulerings-/lønudviklings-tabeldata: `src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts`.
   - Pengeenhed og -algebra: `src/domain/money/money.ts`.
   - EO-model-typer: `src/domain/erstatningsopgoerelse/shared/eoTypes.ts`.
   - Delte EO-helpers (dato-/sats-/pct-utils): `src/domain/erstatningsopgoerelse/helpers/eoSharedUtils.ts`.
   - Lønudviklings-segmentering: `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts`.
4. Ingen ny generator må oprettes uden for `src/document/generators/`.
5. `DocumentWriter` er den interne semantiske render-target-grænse mellem den centrale
   modelrenderer og kanal-infrastrukturen. Den eksponerer ikke kanalobjekt, cursor eller
   kanalspecifikke koordinater. Semantiske fysiske mål som afstand og stregbredde angives i
   millimeter og oversættes af hver kanal. Generatorer må aldrig importere eller modtage den.

## A8. Datoformat i output (kanal-neutralt)

1. Alle brugersynlige datoer i dokument-output SKAL vises i dansk format: enten kort
   `DD-MM-ÅÅÅÅ` eller langt `d. mmmm åååå`. En rå ISO-dato (`ÅÅÅÅ-MM-DD`) må aldrig nå
   et brugersynligt dokument — i nogen kanal.
2. Datoer formateres ved kilden via de kanoniske formattere (`formatDateShort`/`formatDateLong`,
   dvs. `formatISOToDanish`/`formatIsoDateLong` i `src/utils/dateFormatting.ts`). En generator
   må aldrig skrive en `ISODateString` eller en uformateret dato-streng direkte til en celle
   eller en tekstlinje.
3. Periode-kolonner for standard-løn-tabeller (måned/uge/dag) resolves via den delte
   `resolveStandardLoenPeriodColumns` (`src/domain/aarsloen/standardLoenTableColumns.ts`),
   så `dag`-perioden altid formateres til dansk. Generatorer må ikke duplikere denne
   periode-resolvering lokalt.
4. **Sidste forsvarslinje (kanal-neutral):** Begge kanalers tekst- og tabel-stier router
   gennem det centrale dato-værn `guardDocumentDateText` (`src/document/layout/documentDateGuard.ts`).
   Værnet er IKKE et alternativ til formatering ved kilden; det er et sikkerhedsnet, der
   fanger en stray ISO-dato (valideret token), logger høj-lydt i udvikling (brudt invariant,
   jf. console-politik) og deterministisk omformaterer til dansk `DD-MM-ÅÅÅÅ` i produktion,
   så en utestet lækage-sti aldrig viser brugeren en ISO-dato. Værnet er en ren
   string→string-ombytning uden `Date`/tidszone (samme kalenderdag).

---

# Afsnit B — Komposition og render-target-API

Dette afsnit fastlægger den visuelle og strukturelle standard for Mineos dokument-output, så dokumenterne fremstår ensartede og uden utilsigtede lokale layoutafvigelser.

**Blokmodellen er dobbeltkanal.** `DocumentComposer` bygger én `DocumentModel`; sessionens
renderer afspiller modellen mod én af to interne kanal-targets:

- `createPdfChannelWriter` (`src/pdf/infrastructure/pdfWriter.ts`) — PDF via jsPDF.
- `createDocxWriter` (`src/docx/infrastructure/docxWriter.ts`) — Word via docx.

`defineDocument(...)` bygger hele modellen før sessionen opretter kanal-targetet. Reglerne
gælder derfor begge kanaler, og en kompositionsfejl kan ikke efterlade et delvist renderet
dokument. Generator-entrypointet returnerer et `DocumentArtifact`; kun service-laget starter
browser-downloaden.

Alle generator-entrypoints defineres med `defineDocument(...)` i
`src/document/generators/documentGeneratorSetup.ts`. Factoryen ejer den faste lifecycle:
komposition af eventuelt vandmærke → eventuelt brevhoved → eventuel titel →
domæneindhold → footer → én samlet rendering med metadata/writer-options → formatkorrekt filnavn.
Generatoren ejer kun sin deklarative opsætning og sin synkrone, kanal-neutrale
`body(document, input)`-callback. En generator må ikke gentage
eller springe dele af denne ydre lifecycle over; reelle variationer angives i definitionen
(fx ingen synlig titel på TAF-grafen).

Ved konflikt internt i kontrakten gælder:

1. Afsnit A for data-/gate-/guard-regler
2. Afsnit B for visuel struktur, teksttyper, tabeller og spacing
3. domænespecifikke regler kun hvor dette afsnit udtrykkeligt giver plads til dem

## B1. Grundregel

1. Layout skal være standardiseret på tværs af dokumenttyper og kanaler.
2. Lokale generatorer må ikke indføre egne spacing- eller tekstmønstre, hvis concernet allerede er dækket af composer-/layoutlaget (`documentModel.ts`, `documentLayoutHelpers.ts`, `tableSpec.ts`, `pdfConfig.ts`).
3. Ensartethed vægtes højere end lokal finjustering.
4. Afvigelser er kun acceptable, når de er nødvendige for korrekt sidebrydning, reel tabelgeometri eller eksplicit dokumenteret domænekrav.

## B2. Kanoniske teksttyper

Følgende teksttyper er de eneste kanoniske bloktyper i Mineo-dokumenter:

1. Dokumenttitel
2. Sektionsoverskrift
3. Underoverskriftsfamilie
4. Brødtekst (ren tekst / mixed normal+fed)
5. Venstre/højre-oplysningslinje
6. Tabel

Underoverskriftsfamilien har præcis to kanoniske typer:

1. Fed underoverskrift
2. Understreget underoverskrift

De to typer er ligestillede i layoutmæssig forstand. Deres fælles adfærdsregler er defineret i B4.

De adskiller sig kun ved deres visuelle markering:

1. Fed underoverskrift renderes med fed skrift
2. Understreget underoverskrift renderes med understregning

Generatorer må ikke indføre lokale mellemformer eller pseudo-underoverskrifter for de samme formål.

Generatorer må ikke opfinde ekstra lokale tekstkategorier for de samme formål.

> **Bemærkning:** `writeNormalThenBoldLine()` er en variant af brødtekst (type 4), der skriver normal tekst efterfulgt af fed tekst på samme linje. Den er kanonisk og hører under brødtekst-kategorien — ikke en selvstændig type.

## B3. Kanoniske composer-/render-target-API'er

Hver teksttype har én primær, gyldig kompositionsvej via `DocumentComposer`. Den centrale
modelrenderer mapper derefter hver bloktype til den tilsvarende interne `DocumentWriter`-metode:

| Formål | Kanonisk API | Bemærkning |
|--------|---------------|------------|
| Dokumenttitel | `document.writeTitle()` | Eneste gyldige titel-API |
| Sektionsoverskrift | `document.writeSectionHeader()` | Bruges ved egentlige sektionsskift |
| Fed underoverskrift | `document.writeBoldSubheader()` | Kanonisk basis-API; standard-followup er targetets observerbare keep-together garanti |
| Fed underoverskrift + ét tekstafsnit | `document.writeBoldSubheaderWithWrappedText()` | Foretrækkes når underoverskrift og ét efterfølgende tekstafsnit skal holdes atomisk samlet |
| Understreget underoverskrift | `document.writeUnderlinedSubheader()` | Kanonisk basis-API; standard-X er centralt renderer-ejet |
| Brødtekst | `document.writeWrappedText()` | Standard for almindelig fritekst |
| Fed brødtekst | `document.writeBoldWrappedText()` | Variant af brødtekst til hele tekstblokke med fed vægt |
| Fortsat brødtekst uden trailing spacing | `document.writeWrappedTextContinued()` | Kun ved bevidst fortsættelse af samme logiske blok |
| Mixed normal+fed på én linje | `document.writeNormalThenBoldLine()` | Til formler og linjer med blandet vægt; ikke en selvstændig teksttype |
| Venstre/højre-oplysningslinje | `document.writeLeftRightText()` | Standard for key/value-, formel- og beløbslinjer |
| Tabel | `document.addTable(spec)` | Eneste gyldige generator-API til egentlige tabeller; hvert kanal-target ejer `renderTable(spec)` |

Hvis underoverskrifter kræver conditional rendering eller atomisk sammenkædning med efterfølgende indhold, skal dette løses centralt i writer/helper-laget. Generatorer må ikke reimplementere disse regler lokalt.

`standard-followup-height` er ikke én offentlig konstant. Det er writerens observerbare garanti for, at underoverskrift og første meningsbærende indholdsblok ikke adskilles af sideskift. De konkrete minimumshøjder ejes af writer-laget og dets tests.

`writeBoldSubheader()` skal som udgangspunkt kaldes uden `nextLineHeight`-argument. Generatorer må kun sende eksplicit `nextLineHeight`, når den første efterfølgende indholdsblok reelt kræver en anden atomisk højde end writerens standard-followup-height.

`writeSectionHeader()` skal som udgangspunkt kaldes uden `nextLineHeight`-argument. Generatorer må kun sende eksplicit `nextLineHeight`, når den første efterfølgende indholdsblok reelt kræver en anden atomisk højde end writerens standard-followup-height.

`writeUnderlinedSubheader()` bruger altid rendererens centralt definerede standard-X-position.
Generator-API'et modtager ikke en X-koordinat; en reel afvigelse kræver derfor en navngiven
blokintention frem for et råt mål.

Hvis en venstre/højre-oplysningslinje kræver eksplicitte linjeskift i højrekolonnen, skal også dette håndteres centralt i writer-laget. Generatorer må ikke splitte værdien lokalt og derefter reparere spacing eller Y-forløb med `advanceY(...)`, tom venstre kolonne eller anden ad hoc layoutlogik.

Hvis en generator har behov for en hel tekstblok i fed som advarsel, note eller anden fremhævet brødtekst, skal dette løses via en central brødtekst-variant i writer-laget. Generatorer må ikke omkring et enkelt `writeWrappedText()`-kald sætte font manuelt og derefter nulstille den igen.

Det er ikke tilladt at:

- sætte font manuelt og skrive tekst direkte som erstatning for `writeTitle`, `writeSectionHeader`, `writeBoldSubheader` eller `writeUnderlinedSubheader`
- implementere lokale pseudo-overskrifter via `doc.text(...)` + egen spacing
- bruge tabelrendereren til indhold som semantisk er almindelig tekst

## B4. Font og semantik

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

### B4.1 Brødtekst som typografisk baseline

Brødtekst er den kanoniske typografiske baseline for almindeligt dokument-indhold.

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

## B5. Spacing-regler

### B5.1 Omkring underoverskriftsfamilien

1. Afstand over fed og understreget underoverskrift styres centralt og skal være identisk.
2. Afstand under fed og understreget underoverskrift styres centralt og skal være identisk.
3. En generator må ikke lægge ekstra manuel topafstand eller bundafstand omkring en underoverskrift for at "få det til at se rigtigt ud".
4. Hvis der allerede er opnået spacing via forudgående `addSpacer`, `advanceY` eller `setY(...)` efter sektion/tabel, skal underoverskriften stadig ende med den centrale standardafstand og ikke mere.
5. Hvis spacing eller sidebrydningsadfærd ændres for den ene underoverskriftstype, skal den anden automatisk følge med via samme centrale invariant.
6. Hvis der opleves behov for lokal kompensation omkring én af underoverskriftstyperne, er det et arkitekturproblem i writer/helper-laget og skal løses centralt dér.
7. Eventuelle options til at undertrykke topspacing må kun bruges, når underoverskriften bevidst skal stå direkte efter en sektionsoverskrift eller tilsvarende kanonisk header-kontekst.

### B5.2 Mellem almindelige tekstblokke

1. Brødtekst og venstre/højre-oplysningslinjer bruger writerens indbyggede line-height og trailing spacing.
2. Generatorer må ikke kompensere for standard line-height med lokale negative `advanceY(...)`, medmindre det er en veldokumenteret teknisk undtagelse.
3. Et tilbagevendende anti-mønster i venstre/højre-oplysningslinjer er lokal `value.split('\n')` efterfulgt af manuel Y-korrektion for at få fortsættelseslinjer til at "sidde rigtigt". Det skal betragtes som en afvigelse og erstattes af central writer-adfærd.
4. Et tilbagevendende anti-mønster omkring underoverskrifter er kunstigt oppustet `nextLineHeight` for at simulere ekstra sektionsafstand eller holde større lokale blokke samlet. Det skal betragtes som en afvigelse og erstattes af central writer-adfærd eller reelle kanoniske overgange.

### B5.3 Mellem sektioner

1. Mellemrum mellem sektioner styres af composerens header-blokke eller — hvor der er behov for eksplicit spacing — af `document.addSpacer()` med en veldefineret konstant.
2. Lokale sektioner må ikke vælge egne frie sektionsafstande uden eksplicit begrundelse.
3. `SECTION_SPACER` (10 mm) og `resolveDocumentSectionEndY()` er interne render-target-detaljer. Generatorer bruger `document.addSectionSpacer()` og må ikke importere disse mål/Y-helpers.
4. Den kanoniske eksplicitte sektionsseparator i en generator er `document.addSectionSpacer()`.
5. Generatorer må ikke sende `PDF_BASE_LINE_HEIGHT_MM` direkte til `document.addSpacer()` blot for at gentage den centrale sektionsstandard.
6. Et tilbagevendende anti-mønster er `document.addSpacer(SECTION_SPACER)` umiddelbart efter grupper af `writeLeftRightText()`- eller `writeWrappedText()`-linjer. Det skal erstattes med `document.addSectionSpacer()`, medmindre en dokumenteret afvigelse reelt kræver en anden afstand.

### B5.4 Efter tabeller

1. Tabellen afsluttes med en kanonisk overgang til næste blok.
2. Modelrendereren videresender hele `TableSpec` til kanal-targetet; generatoren modtager ingen cursor og må ikke kompensere for tabelafslutningen.
3. Generatoren må ikke lægge ad hoc ekstra topafstand ind foran næste underoverskrift.

## B6. Manuel spacing: tilladt og forbudt

### Tilladt

Manuel spacing via `document.addSpacer(...)` er kun tilladt når:

1. der bevidst indsættes afstand mellem to indholdsblokke, som ikke allerede har en kanonisk overgang
2. en tabel eller anden kompleks blok kræver en tydelig afslutning før næste sektion
3. en teknisk layoutjustering er nødvendig for korrekt sidebrydning eller tabelgeometri

### Forbudt

Manuel spacing må ikke bruges til:

1. at emulere lokale overskriftsregler
2. at indføre ekstra afstand over `writeBoldSubheader()`
3. at indføre ekstra afstand over `writeUnderlinedSubheader()`
4. at kompensere for uklare eller inkonsistente lokale flow-forløb i stedet for at rette den centrale renderer-/composer-adfærd
5. at bruge `SECTION_SPACER` (10 mm) som generel sektionsseparator — se B5.3
6. at sende `PDF_BASE_LINE_HEIGHT_MM` direkte til `document.addSpacer()` som erstatning for den navngivne standard `document.addSectionSpacer()` — se B5.3 punkt 5

Hvis en generator oplever behov for gentagne lokale spacing-korrektioner, er det et arkitekturproblem i composer-/renderer-laget og skal løses dér.

## B7. Tabeller vs. ikke-tabeller

1. Egentlige tabeller skal beskrives som `TableSpec` og tilføjes via `DocumentComposer.addTable()`.
2. Headerløse 2-kolonne-opstillinger, formler, specifikationer og simple label/værdi-linjer er ikke tabeller og skal komponeres via `DocumentComposer`.
3. En generator må ikke vælge tabelrenderer alene for at få "nem alignment", hvis indholdet semantisk ikke er en tabel.

## B8. Direkte jsPDF-brug

Direkte skrivning via `doc.text(...)` eller lignende er kun acceptabel efter formålskategori:

1. Den interne tabelrenderer og dens kanal-integration må bruge direkte jsPDF-adgang uden ekstra note.
2. Lavniveau-tegneprimitiver for streger og geometri må bruge direkte jsPDF-adgang uden ekstra note.
3. Almindelig tekst, spacing eller domænetekst må kun bruge direkte jsPDF-adgang, hvis writer/helper-laget mangler en nødvendig evne, og callsite dokumenterer undtagelsen efter B9.

Direkte jsPDF-brug til almindelige tekstblokke er en afvigelse og skal som udgangspunkt fjernes. Direkte jsPDF-adgang giver kun mening inde i PDF-kanalen. Word renderer den samme semantiske `TableSpec` direkte til OOXML; der findes ingen tabelbro. Generatorer skal bygge via `DocumentComposer` frem for at antage en konkret kanal eller importere `DocumentWriter`.

## B9. Undtagelser

Hvis en bevidst afvigelse er nødvendig, skal den dokumenteres kort ved callsite i koden med:

1. hvorfor kanonisk API ikke kan bruges sikkert
2. hvilken konkret layout-risiko afvigelsen håndterer
3. hvad der skal være sandt før afvigelsen kan fjernes igen

Undtagelser må ikke bruges som stilvalg.

## B10. Audit-regler for eksisterende generatorer

Ved audit af en generator skal mindst følgende kontrolleres:

1. at alle overskrifter bruger kanoniske writer-metoder
2. at der ikke findes lokal manuel topafstand eller bundafstand omkring `writeBoldSubheader()` eller `writeUnderlinedSubheader()`
3. at begge underoverskriftstyper følger samme centrale spacing- og sidebrydningsregler
4. at underoverskrifter uden efterfølgende meningsbærende indhold undertrykkes
5. at tabeller afsluttes via kanonisk section-end-regel
6. at headerløse pseudo-tabeller er erstattet med composer-baseret tekstlayout
7. at lokale `setFont`/`setFontSize`-forløb ikke emulerer eksisterende teksttyper
8. at line-height og sektionafstand alene kommer fra centrale konstanter — og at den rigtige konstant er valgt til konteksten (autotable vs. writer, jf. B5.3)
9. at generatorer ikke bruger `document.addSpacer(SECTION_SPACER)` som tommelfingerregel efter blokke med `writeLeftRightText()` eller `writeWrappedText()`
10. at generatorer bruger `document.addSectionSpacer()` i stedet for rå `document.addSpacer(PDF_BASE_LINE_HEIGHT_MM)`, når intentionen blot er standard-sektionsafstand, jf. B5.3 punkt 5
11. at multiline højrekolonner i `writeLeftRightText()` ikke implementeres via lokal `split('\n')`, tom venstre kolonne og manuel `advanceY(...)`-korrektion
12. at generatorer ikke laver lokal `setFont(...)` / `setFontSize(...)` omkring enkelte brødtekstblokke som advarsler eller noter, når en central writer-variant kan bære behovet
13. at `nextLineHeight` til `writeBoldSubheader()` afspejler den første reelle efterfølgende indholdsblok og ikke bruges som skjult spacing- eller keep-together-mekanisme
14. at generatorer udelader `nextLineHeight`, `PDF_BASE_LINE_HEIGHT_MM` og tilsvarende standardargumenter, medmindre værdien semantisk afviger fra rendererens default eller callsite dokumenterer en eksplicit layout-undtagelse efter B9; rå koordinater som `MARGINS.left` hører ikke til i generator-API'et
15. at generatorer ikke importerer tabelrendererens Y-/cursor-helpers eller kompenserer lokalt for tabelstart/-afslutning

## B11. Anbefalet audit-sekvens

For at fjerne eksisterende utilsigtede forskelle bør generatorerne gennemgås i denne rækkefølge:

1. `satserDocument.ts`
2. `renteDocument.ts`
3. `renteOversigtDocument.ts`
4. `aarsloenDocument.ts`
5. `shDageDocument.ts`
6. `varigeMenDocument.ts`
7. `krlDocument.ts`
8. `reguleringDocument.ts`
9. `loebendeYdelserDocument.ts`
10. `kapitaliseringDocument.ts`
11. `eetEfterEalDocument.ts`
12. `differencekravDocument.ts`
13. `forsoergertabDocument.ts`
14. `tafFordeltPaaAarDocument.ts`
15. `erstatningsopgoerelseDocument.ts`
16. `opgoerelseSection.ts`
17. `shDageSection.ts`
18. `loenindkomstSection.ts`
19. `offentligeYdelserSection.ts`
20. `reguleringSection.ts`

Formålet med sekvensen er først at rydde de simple og mellemkomplekse generatorer og derefter de mere domænetunge dokumenter.

En generator fjernes fra denne liste, når den har bestået fuld audit mod B10, og der findes relevante writer-/generator-tests for dens centrale spacing-, sidebrydnings- eller gate-invariants. Når første audit-runde er afsluttet, bør listen flyttes til et trackingdokument.

Navngivning i denne sektion er bevidst ikke normativ ud over de konkrete filreferencer. Eventuel konsolidering af generator-/sektionsnavne skal ske som del af auditten, så dokumentation, runtime og tests ændres samlet.

---

## 2. Autoritative Kilder

- Kanalneutral blokmodel og generator-API: `src/document/model/documentModel.ts` (`DocumentModel`/`DocumentComposer`).
- Intern render-target-grænse: `src/document/writer/documentWriter.ts` (`DocumentWriter`).
- Fælles generator-lifecycle: `defineDocument` i `src/document/generators/documentGeneratorSetup.ts`.
- Eksplicit generationssession: `src/document/documentGenerationSession.ts`.
- PDF-writer-fabrik (kanal): `createPdfChannelWriter` (`src/pdf/infrastructure/pdfWriter.ts`).
- Word-writer-fabrik (kanal): `createDocxWriter` (`src/docx/infrastructure/docxWriter.ts`).
- Word-typografier (navngivne styles): `src/docx/infrastructure/docxStyles.ts`.
- Kanalneutral tabelmodel: `src/document/layout/tableSpec.ts`.
- PDF-tabelrenderer: `src/pdf/infrastructure/pdfTableRenderer.ts` og `pdfDocumentTableRenderer.ts`.
- Word-tabelrenderer: `createDocxTable` i `src/docx/infrastructure/docxWriter.ts`.
- Word-vandmærke: `src/docx/infrastructure/docxWatermark.ts`.
- Service boundary / download: `src/document/service/documentService.ts`.
- Layout-konstanter: `src/document/layout/pdfConfig.ts`.

## 3. Testkobling

Kontrakten er koblet i `contractCoverageMatrix.test.ts` til:

- `src/__tests__/quality/architecture/architectureRules.test.ts` (download-committed-state-grænsen, AST-regel `pdf/download-committed-state`)
- `src/__tests__/utils/pdf/pdfService.downloadFunctions.test.ts`
- `src/__tests__/quality/pdfPseudoTableGuard.test.ts`
- `src/__tests__/utils/pdf/pdfTableRenderer.layout.test.ts`
- `src/__tests__/utils/pdf/pdfWriter.test.ts`
- `src/__tests__/docx/docxWriter.test.ts` (Word-kanalens paritet mod det fælles writer-API)
- `src/__tests__/quality/documentDateFormatGuard.test.ts` (datoformat-værnet, A7a)

Word-kanalens indholds-paritet pr. generator er desuden dækket af `src/__tests__/docx/generators/*WordContent.test.ts` (én pr. dokument-generator, kørt gennem den rigtige generator via `wordContentHarness.ts`). Disse verificerer, at samme tekst og tal når `.docx`'en som PDF'en, og knyttes formatvalgsmæssigt til `document-format-contract.md`.

## 4. Enforcement

Denne kontrakt skal understøttes af:

1. central adfærd i writer-laget (`documentWriter.ts` + kanal-fabrikkerne)
2. fælles konstanter i `src/document/layout/pdfConfig.ts`
3. writer unit-tests for spacing- og sidebrydningsinvariants
4. quality guards for kendte generator-anti-mønstre
5. generator-/domænetests for trust-kritiske gates og output-specifikke blokeringer
6. det kanal-neutrale dato-værn `guardDocumentDateText` (`src/document/layout/documentDateGuard.ts`), kaldt fra både tabel-rendereren og begge kanalers tekst-normalisering (A7a)

Tekstbaserede quality guards er sekundære sikkerhedsnet. De må ikke erstatte egentlige writer- og domænetests.

Hvis kode og kontrakt divergerer, er det en arkitekturfejl, ikke en stilforskel.

## 5. Kendte Undtagelser

- Word-kanalens layout er en oversættelse af de samme blokintentioner til Words afsnitsmodel
  og navngivne typografier. Word ejer selv sideflow, mens overskrifters `keepNext`, atomiske
  tabelrækker og den samlede signaturblok udtrykker de fælles keep-intentioner uden cursor/Y.
  Vandmærke og footer er ikke options eller implicit build-adfærd: deres respektive
  `DocumentBlock` er eneste autoritet i begge kanaler.
- `TableSpec` er ren semantisk data. Kolonnebredde, alignment, dæmpet tone, totalrække og kort
  totalstreg fortolkes direkte af begge kanalrenderere. Fysiske millimetermål er fælles
  layoutintentioner, ikke PDF-only hints. EO-sektionernes store composer-/formatter-contexts
  ejes fortsat af fase-3 #32.
- `satserDocument.ts` inkluderer bevidst ikke journalnr i filnavnet — satser er årsspecifikke og sagsagnostiske.
