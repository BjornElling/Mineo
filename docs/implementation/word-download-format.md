# Implementeringsplan: Word som download-format

**Status:** Plan (ikke påbegyndt)
**Type:** Implementeringsplan
**Berører:** AppSettings, dokumentgenerering (PDF + nyt Word-lag), alle download-knapper, ny tværgående kontrakt.

Denne plan beskriver, hvordan Mineo udvides så brugeren i indstillinger kan vælge, om dokumenter hentes som **PDF** (nuværende adfærd, default) eller **Word** (`.docx`). Planen er skrevet til at kunne udføres i adskilte, hver-for-sig grønne stadier.

---

## Overblik

I dag genereres alle dokumenter som PDF via `src/pdf/`. Hver generator er hårdt koblet til `PdfWriter`: den kalder `createStandardPdfWriter()`, bygger indholdet imperativt med `writeTitle`, `writeBoldSubheader`, `writeLeftRightText`, `renderPdfTable`, `writeBrevhoved`, `setProperties`, `addFooter` og afslutter med `save(filename)`.

Målet er:

1. En ny **device-lokal app-indstilling** `documentDownloadFormat: 'pdf' | 'word'` med en dropdown i indstillinger, label **"Download-format for dokumenter"**, valgmuligheder **pdf** / **word**, default **pdf**, kan aldrig tømmes.
2. Et nyt **Word-lag** (`src/docx/`) der spejler PDF-lagets struktur og producerer ægte `.docx`-filer med **centralt styrede typografier** og **centralt styrede dokumentegenskaber** (forfatter, emne, titel m.m.).
3. Når formatet er **word**, henter **alle** dokumenttyper (~16 stk.) som Word i stedet for PDF, styret ét sted i service-laget.
4. Download-knapper følger indstillingen: knaptekster der nævner "PDF" bliver formatafhængige ("Download alle som Word" når Word er valgt).
5. Word genbruger PDF'ens brevhoved-indstillinger (`brevhovedIndstillinger`) 1-til-1 — ingen nye toggles.

> **Kritisk review-note — omfanget skal låses mod faktisk kode før implementering:** Planen bruger både "~16 stk.", "14 + 3 standalone" og "16 generatorer + 3 standalone". Den faktiske `pdfLoader.ts` har pt. 15 lazy-loadede PDF-moduler, mens `pdf-layout-contract.md` §11 også tæller EO-sektionsfiler med i auditsekvensen. Før Stadie 1 skal Stadie 0 derfor skrive en konkret tabel ind i denne plan med: (1) download-funktion, (2) generatorfil, (3) eventuelle sektionsfiler, (4) eksisterende gate-ejer, (5) om outputtet findes i Mineo, MinProcesrente eller begge. Ellers er der reel risiko for, at "alle dokumenttyper" bliver udefineret og at enkelte download-stier forbliver PDF-only ved en fejl.
>
> >> **Svar (enig — mit talrod, skal rettes):** Du har ret, og uoverensstemmelsen er min fejl. Det faktiske billede pr. nu: `pdfService.ts` eksponerer **14** download-wrappers (`downloadSatserPdf`, `downloadRentePdf`, `downloadRenteOversigtPdf`, `downloadReguleringPdf`, `downloadKrlPdf`, `downloadErstatningsopgoerelsePdf`, `downloadTafFordeltPaaAarPdf`, `downloadVarigeMenPdf`, `downloadAarsloenPdf`, `downloadSHDagePdf`, `downloadKapitaliseringPdf`, `downloadEfterEalPdf`, `downloadDifferencekravPdf`, `downloadLoebendeYdelserPdf`, `downloadForsoergertabPdf`) — det er faktisk 15, ikke 14. `pdfLoader.ts` har 15 `loadXxxPdfModule`-funktioner. `standaloneRentePdfService.ts` har 3 flows. EO-sektionsfilerne er ikke selvstændige downloads. Konklusion: tallene i hele planen skal erstattes med tabellen fra Stadie 0; indtil da er ethvert hårdt tal i prosaen at betragte som upålideligt. Jeg foreslår, at vi i Stadie 0 gør tabellen til **den eneste kilde** og fjerner alle løse tal andre steder, så de ikke kan drive fra hinanden igen.



> **Kritisk review-note — navnet "PDF" må ikke blive ny abstraktionsgæld:** Planen bevarer i første omgang funktionsnavne som `downloadRentePdf(...)`, selv når funktionen kan returnere Word. Det er acceptabelt som overgang, men kun hvis kontrakten og tests tydeligt siger, at navnet er legacy. Ellers vil nye kaldesteder, fejlbeskeder og UI-tekster fortsat antage PDF, og Word-stien bliver en skjult specialcase. Tilføj i Stadie 4 en mekanisk søgning på `Pdf`, `PDF`, `pdf` i relevante handlers/props/aria-labels/fejltekster, og klassificér hvert hit som enten legacy-internt eller brugervendt tekst der skal gøres formatafhængig.
>
> >> **Svar (enig, og jeg vil skærpe det):** Du har fat i den reelle risiko: et "legacy"-navn uden udløbsdato er bare permanent gæld med pænere ord. Jeg foreslår at vi vender det om og **faktisk omdøber service-laget i Stadie 4** frem for at udskyde det. Omdøbningen `downloadXxxPdf → downloadXxxDokument` + `PdfDownloadResult → DocumentDownloadResult` er mekanisk (rename-symbol over 15+3 wrappers og deres ~17 call-sites) og rører ikke beregning. Når vi alligevel skal igennem alle call-sites for at gøre knaptekster formatafhængige (Stadie 6), er den marginale ekstraomkostning lille, og vi undgår at efterlade et navn der aktivt lyver om hvad funktionen gør. Jeg har konkretiseret dette i din Stadie 4-tilføjelse om `PdfDownloadResult` nedenfor. **Imod at udskyde:** AGENTS.md's konvergensprincip taler direkte imod at lade to navne for samme concern leve side om side uden grund — og her er der ingen tvingende grund til at vente.



### Bekræftede produktbeslutninger (fra bruger)

| Spørgsmål | Valg |
|-----------|------|
| Word-bibliotek | `docx` (npm) — ægte `.docx`, lazy-loaded, ny dependency |
| Word-udseende | Samme **indhold** som PDF, men **Word-native** typografier (ikke pixel-kopi af PDF) |
| Omfang | **Alle** dokumenttyper i **Mineo-hovedappen** kan hentes som Word (MinProcesrente er PDF-only, se nedenfor) |
| Download-knapper | Følger indstillingen; "PDF"-tekster bliver formatafhængige |
| Brevhoved i Word | Genbrug PDF'ens `brevhovedIndstillinger` 1-til-1 |

### Afklarede designvalg (2. runde, fra bruger)

| Spørgsmål | Valg | Konsekvens for planen |
|-----------|------|------------------------|
| **MinProcesrente** | **Nej** — Word gælder kun Mineo-hovedappen | `standaloneRentePdfService.ts` forbliver PDF-only og urørt (ud over evt. fælles `build()`-grænse). "Alle dokumenttyper" = alle i Mineo-hovedappen. MinProcesrentes "PDF"-tekster forbliver. |
| **PDF-metadata-inkonsekvens** | **Ret den** — fælles metadata-builder bruger altid brand-funktionen | De ~13 generatorer der hardcoder `creator: 'mineo.dk'` skifter til den centrale `buildDocumentCoreProperties` (creator bliver brand-styret). I Mineo ingen observerbar forskel (default-brand = `mineo.dk`). |
| **Word-skrifttype** | **Calibri** (Words standard) | `docxConfig.ts` sætter Calibri som dokument-font. Word-native look; familielighed med PDF (Helvetica) er ikke et mål. Ingen font-indlejring. |
| **Word→Mineo-import** | **Nej** — ren engangs-download | Eksplicit afgrænsning: `.docx` er dødt output. Ingen Word-parsing/-import/-sync nogensinde. Allerede i risikoafsnittet; nu bekræftet. |
| **Brevhoved-position i Word** | **Tekstrude (text box), forankret øverst til højre på side 1** | Tekstruden forankres **page-relative** (til siden, ikke til et afsnit), så den ikke flytter sig når brødteksten ændres. Vises kun på side 1 (PDF har den pr. side — bevidst forskel). Placering finjusteres ved lejlighed. |
| **Udkast-markering i Word** | **Word-vandmærke bag teksten** (diagonalt, gråt "UDKAST" pr. side) | Word-native vandmærke via header-baseret tegning; visuelt tættest på PDF'ens roterede stempel. Styret af samme `visUdkastStempel` (`indsaetUdkastStempel === 'Ja'`) som PDF. |
| **Word-runtime-fejl** | **Samme som PDF** — central fejlrapportering | Word-genereringsfejl routes via `reportSystemIssue` (område `document`) jf. `error-debug-contract.md`. Intet tilbagefald til PDF (det ville give et uventet format). |
| **Nøgne ikon-knappers format-signal** | **Tooltip nævner formatet** | Nøgne download-ikoner (fx Satser-siden) får en `title`/tooltip der nævner det aktive format (fx "Download som Word"), så formatet aldrig er skjult. Selve handlingen forbliver implicit (indstillingen styrer); kun overraskelsen fjernes. |

> **Sidste kritiske review-note — bekræftede Word-layoutvalg kræver teknisk spike før de låses som implementerbare:** Tekstrude for brevhoved og ægte Word-vandmærke er nu produktvalg, men de er også de to mest OOXML-specifikke dele af planen. Før Stadie 2 må vi verificere, at `docx` kan producere dem med sin offentlige API på en måde Word åbner uden repair-dialog. Hvis `docx` ikke understøtter page-relative text box eller watermark rent, må vi enten (1) bruge en meget smal, testet OOXML-helper uden brugerdata i rå XML, eller (2) forelægge en synlig fallback for brugeren. Vi må ikke skjult nedgradere brevhoved/vandmærke til en anden oplevelse, fordi begge er bekræftede UI/output-valg.

> **Afklaret UI-valg (format-signal på nøgne ikoner):** Tekst-knapper er formatafhængige ("… som Word"); nøgne download-ikoner får en tooltip der nævner det aktive format. Begrundelse: i et trust-kritisk program må en bruger aldrig tro de henter PDF og uforvarende få `.docx` og videresende det forkerte format. Tooltippen koster én prop (ingen ny komponent) og holder oplevelsen konsistent på tværs af tekst- og ikon-knapper. Tooltip-teksten er brugervendt og forelægges sammen med de øvrige knaptekster i Stadie 6.

---

## Nøglebeslutninger

| Beslutning | Valg | Begrundelse |
|------------|------|-------------|
| Abstraktion | Indfør et **format-agnostisk dokument-writer-interface** (`DocumentWriter`) som både PDF og Word implementerer. Generatorerne kodes mod interfacet, ikke mod `PdfWriter`. | Eneste måde at få "samme indhold" uden at duplikere 16 generatorer. Konvergens: ét indholdsudtryk, to backends. |
| Bibliotek | `docx` (npm), lazy-loaded, egen vendor-chunk `vendor-docx` | Modent, rent `.docx`, fuld styring af styles + core-properties (author/subject/title). Følger eksisterende vendor-chunk-konvention (`vendor-jspdf`). |
| Typografier | Centralt `docxConfig.ts` + et fast Word **styles-sæt** (Title, Heading, Subheader, Body, tabel-celle) defineret ét sted | Spejler `pdfConfig.ts`. Garanterer ensartethed på tværs af alle Word-dokumenter (krav fra opgaven). |
| Dokumentegenskaber | Central `buildDocxCoreProperties()` der sætter forfatter/emne/titel/creator ét sted | Opgaven kræver central styring af egenskaber. PDF sætter dem spredt i hver generator (teknisk gæld); Word starter centralt og PDF kan senere konvergere mod samme helper. |
| Indstilling | Ny top-level `documentDownloadFormat` i `appSettingsSchema`, Zod-enum, default `'pdf'` | App-settings-kontrakten kræver Zod-dækning. Top-level felt → dækkes automatisk af eksisterende merge-logik. |
| Format-routing | Service-laget vælger PDF- eller Word-backend ud fra `settings.documentDownloadFormat` | Ét centralt forgreningspunkt; ingen call-site skal kende til formatet. Følger pdf-kontraktens "service boundary"-rolle. |
| Filendelse | `.docx` for Word, `.pdf` for PDF; filnavnsregel deles | `resolvePdfFileName` generaliseres til `resolveDocumentFileName(baseTitle, isDraft, ext, journalnr)`. |

> **Kritisk review-note — `DocumentWriter` kan blive for bredt og utæt:** Interfacet må ikke være "alle metoder PdfWriter har minus et par stykker". Det skal være en lille semantisk dokument-API med Word-realiserbare blokke. Hvis interfacet får PDF-cursor-begreber, `x`-koordinater eller målemetoder, flyttes PDF-layoutmodellen bare ind i Word-laget. Stadie 0 skal derfor eksplicit markere hver eksisterende writer-metode som en af tre kategorier: (1) format-neutral semantik, (2) PDF-layoutmekanik, (3) midlertidig escape-luge med planlagt fjernelse. Kun kategori 1 må ind i `DocumentWriter`.
>
> >> **Svar (enig — dette er det vigtigste enkeltpunkt i hele planen):** Helt korrekt diagnose. Jeg vil tilføje et konkret lakmustest, Stadie 0 kan bruge på hver metode: *"Kan en Word-implementering opfylde denne metode uden at simulere et koordinatsystem?"* Hvis svaret kræver en `x`-parameter, en Y-position eller en måling i mm, er metoden kategori 2. Bemærk fælderne i den nuværende kode: `writeUnderlinedSubheader(text, x?)` og `writeLeftRightText(..., { lineAboveRightWidth, lineAboveRightOffset, minRightColumnWidth })` bærer alle PDF-geometri i deres signatur. I `DocumentWriter` skal `writeLeftRightText` reduceres til `(leftText, rightText, { leftBold?, rightBold?, underlineAbove? })` — ren semantik; PDF-adapteren oversætter `underlineAbove: true` til sin `lineAboveRightWidth`-mekanik, Word til en celle-kant. Det er præcis den indkapsling, der gør, at PDF-geometrien ikke lækker. Jeg vurderer, at dette punkt afgør, om hele "ét indholdsudtryk, to backends"-ideen holder — hvis interfacet bliver utæt, er det billigere at have to generatorsæt.



> **Kritisk review-note — central metadata skal gælde begge formater:** Planen siger, at Word starter centralt og PDF senere kan konvergere. Det bør skærpes: når `documentBrand.ts` og core-properties først oprettes, skal PDF's eksisterende `setProperties(...)`-kald som minimum have en delt metadata-builder eller en test, der beviser samme author/subject/creator-regler på tværs. Ellers etableres en ny parallel sandhed, hvor PDF og Word kan drive fra hinanden allerede i Stadie 1.
>
> >> **Svar (enig — og det er billigt at gøre rigtigt nu):** Korrekt. "PDF kan senere konvergere" var for blødt fra min side. Den konkrete handling: i Stadie 1 oprettes én `buildDocumentCoreProperties({ title })` i `src/document/`, der returnerer `{ title, subject: 'Erstatningsberegning', author: 'Mineo', creator: getDocumentCreatorBrand() }`. PDF-laget refaktoreres til at kalde den (de 15 generatorer + standalone udskifter deres lokale `setProperties({ title, subject, author, creator })`-objektliteral med `writer.setDocumentProperties(buildDocumentCoreProperties({ title }))`). Det er den eneste måde at forhindre, at fx `subject` staves forskelligt i de to formater. **Vigtig nuance jeg vil tilføje:** PDF's `creator` er i dag inkonsekvent — de fleste generatorer hardcoder `'mineo.dk'`, men rente-stierne bruger `getPdfCreatorBrand()`. Den centrale builder skal **altid** bruge brand-helperen, hvilket retter den eksisterende inkonsistens som en sidegevinst. Det er en synlig ændring af PDF-metadata for de hardcodede generatorer (creator bliver brand-styret i stedet for fast `'mineo.dk'`) — men da default-brand netop er `'mineo.dk'`, er der i hovedappen ingen observerbar forskel. Bør noteres i Stadie 1.



---

## Arkitektur

### Det centrale greb: `DocumentWriter`-interface

Problemet er, at hver generator i dag kender `PdfWriter` konkret. For at få "samme indhold, to formater" uden at vedligeholde to sæt generatorer, indføres et **fælles, format-agnostisk writer-interface** der dækker de semantiske byggeklodser generatorerne faktisk bruger:

```
writeTitle, writeSectionHeader, writeBoldSubheader, writeUnderlinedSubheader,
writeBoldSubheaderWithWrappedText, writeWrappedText, writeBoldWrappedText,
writeLeftRightText, writeNormalThenBoldLine, writeBrevhoved,
renderTable(...), setDocumentProperties(...), addFooter(), save(filename)
```

> **Sidste kritiske review-note — denne metode-liste er nu bevidst forældet:** Senere i planen er `save(filename)` erstattet af `build(): Promise<DocumentArtifact>`, og tabeldelen skal gå gennem en delt `DocumentTable`-model. Før implementering skal denne liste omskrives i Stadie 0, så den ikke længere viser `save(...)` eller et frit `renderTable(...)`. Ellers risikerer implementeringen at følge den gamle tekst i stedet for den afklarede arkitektur.

`PdfWriter` implementerer dette interface (det gør den næsten allerede); en ny `DocxWriter` implementerer det samme via `docx`-biblioteket. Generatorerne refaktoreres til at tage `DocumentWriter` som parameter i stedet for selv at kalde `createStandardPdfWriter()`.

> **Vigtigt — afgrænsning af "samme indhold":** Word er flow-baseret (afsnit, styles, tabeller), ikke koordinat-baseret som PDF. Derfor er rene **geometri-/Y-position-API'er** (`getY`, `setY`, `advanceY`, `ensureSpace`, `addSpacer`, `addPage`, `addUdkastWatermark`, `writeSignatureBlock`, `writeAtomicTableChunks`) **ikke** en del af `DocumentWriter`. De er PDF-specifik sidebrydnings-/layoutmekanik. Stadie 0 kortlægger, hvilke generatorer der bruger disse, og hvordan de udtrykkes Word-native (fx underskriftsblok som en tabel uden kanter; sideskift håndteres af Word selv). Hvor en generator har uomgængelig PDF-specifik geometri, beholder den en lille PDF-only escape-luge — men kun dokumenteret ved callsite jf. layout-kontraktens §9.

> **Kritisk review-note — `renderTable(...)` skal have en delt tabelmodel, ikke to renderere med frie props:** PDF-tabeller er i dag bundet til `renderPdfTable()` og jsPDF/autotable-geometri. Word-tabeller bør ikke arve PDF's bredde-, Y- og sidebrydningsprops. Indfør en format-neutral `DocumentTable`/`DocumentTableColumn` model med semantiske alignments, header/body/footer-rækker og celleindhold som tekst eller tekstdele. PDF-adapteren mapper denne model til `renderPdfTable()`, Word-adapteren mapper til `docx.Table`. Hvis eksisterende generatorer allerede bygger table rows i domæne-/præsentationslag, skal de genbruges frem for at introducere nye table DTO'er.
>
> >> **Svar (enig, med én vigtig advarsel om omkostning):** Tabelmodellen er den sværeste del af abstraktionen, og din model-tilgang er rigtig. Men jeg vil markere en konkret risiko, så vi går ind i det med åbne øjne: `renderPdfTable()` har en rig featureflade (`columnStyles`, `transparentRowIndices`, `underlinedCellPositions`, `createPdfTableSummedTotalRow`, adaptiv kolonne-redistribution, `didParseCell`/`didDrawCell`-callbacks). EO-tabellerne bruger flere af disse. En format-neutral model, der bevarer **alt** dette semantisk, er reelt et af planens største enkeltarbejder — ikke en triviel DTO. Konsekvens for planlægningen: tabelmodellen bør have sin **egen** afklaring i Stadie 0 (kataloger præcist, hvilke autotable-features hver generator faktisk bruger), og de tunge EO-tabeller hører derfor naturligt til **sidst** i Stadie 5, ikke som en eftertanke. Hvor en PDF-tabelfeature er ren visuel pynt uden semantisk værdi (fx skiftevis rækkefarve), behøver Word ikke gengive den — men det skal være et bevidst, dokumenteret fravalg, ikke et tab.



> **Kritisk review-note — `save(filename)` skjuler en vigtig testbar grænse:** PDF-writerens `save` kalder direkte browser-download. For Word bør writeren kunne producere en `Blob`/buffer separat fra download-triggeren, så tests kan åbne ZIP-indholdet og assert'e styles/properties/document.xml uden at mocke hele browseren. Overvej derfor at `DocumentWriter` slutter i `build(): Promise<DocumentArtifact>` og at service-laget ejer download. Hvis `save(filename)` beholdes i interfacet af hensyn til migrationen, skal der stadig findes en test-only eller public builder-grænse for DocxWriter.
>
> >> **Svar (enig — adoptér `build()` fra start, ikke `save()`):** Dette er en bedre grænse, og den løser desuden et asymmetri-problem du ikke nævner: `docx` serialiserer **asynkront** (`Packer.toBlob(doc)` returnerer en Promise), mens jsPDF's `doc.save()` er synkron. Hvis interfacet beholder et synkront `save()`, tvinger vi Word ind i en kunstig form. Lad derfor `DocumentWriter` slutte i `build(): Promise<DocumentArtifact>` hvor `DocumentArtifact = { blob: Blob, filename: string }`, og lad **service-laget** trigge browser-download (én delt `triggerDownload(artifact)`-helper for begge formater). Det giver tre gevinster: (1) tests åbner Word-ZIP'en uden browser-mock; (2) den nuværende `pdfService`-fejlhåndtering (try/catch → `reportSystemIssue`) wrapper nu også serialiseringen ensartet; (3) PDF og Word downloader gennem præcis samme kode, så filnavnsregel og fejladfærd ikke kan drive. PDF-adapterens `build()` kalder internt jsPDF's `output('blob')` i stedet for `save()`. Dette bør rykkes ind allerede i Stadie 3 (pilot), ikke udskydes, da hele test-strategien hænger på det.

### Foreslået filstruktur (`src/docx/`, spejler `src/pdf/`)

```
src/document/                         # NY: format-agnostisk lag
  documentWriter.ts                   # DocumentWriter-interface + delte writer-typer
  documentFormat.ts                   # DocumentFormat = 'pdf' | 'word' + helpers
  documentFileName.ts                 # resolveDocumentFileName (generaliseret fra resolvePdfFileName)
  index.ts

src/docx/
  infrastructure/
    docxConfig.ts                     # Spejler pdfConfig: farver, fontstørrelser, spacing → Word-styles
    docxStyles.ts                     # Centralt styles-sæt (Title/Heading/Subheader/Body/Table)
    docxCoreProperties.ts             # buildDocxCoreProperties(): central author/subject/title/creator
    docxWriter.ts                     # DocxWriter implements DocumentWriter (bygger docx.Document)
    docxLoader.ts                     # Lazy-load af docx-generatorer (spejler pdfLoader)
    docxService.ts                    # (valgfrit) — se "Service-routing" nedenfor
    index.ts
  shared/
    docxBrevhoved.ts                  # Brevhoved som Word-tabel/afsnit (genbruger BrevhovedData + getVisBrevhoved)
    docxFooter.ts                     # Footer (brand + version) som Word-sidefod
    docxTableRenderer.ts              # renderTable-impl for Word
    index.ts
  domains/                            # Kun hvis en generator kræver Word-specifik indholdslogik;
                                      # målet er at GENBRUGE de eksisterende generatorer mod DocumentWriter.
  index.ts
```

> **Note om `src/document/` vs. genbrug:** Den reneste vej er, at de eksisterende generatorer i `src/pdf/domains/` omdøbes/flyttes til et format-neutralt sted (`src/document/domains/`), fordi de efter refaktoreringen ikke længere er PDF-specifikke. Dette er en større flytning og besluttes endeligt i Stadie 0 ud fra, hvor PDF-specifik hver generator viser sig at være. Hvis for mange generatorer har uomgængelig PDF-geometri, beholdes de i `src/pdf/domains/` og Word får tynde adaptere. **Stadie 0's audit afgør dette** — planen låser det ikke på forhånd.

> **Kritisk review-note — `src/document/domains/` må ikke genindføre domænelogik i outputlaget:** Hvis generatorer flyttes til `src/document/domains/`, skal de fortsat kun være dokument-renderere for allerede godkendte præsentationsmodeller. Beregning, gating, snapshot-projektion og tabeldata-opbygning skal blive i `src/domain/**` eller eksisterende præsentationsmodeller. Navnet `document/domains` kan ellers friste til at flytte for meget domæneansvar ind i outputlaget. Overvej et mere præcist navn som `src/document/renderers/` eller `src/document/output/` i Stadie 0, hvis det gør grænsen klarere.
>
> >> **Svar (enig — `renderers/` er det rigtige navn):** Jeg foretrækker `src/document/renderers/`. "domains" kolliderer begrebsmæssigt med `src/domain/**` (beregningslaget) og inviterer netop den sammenblanding, du advarer mod — pdf-kontraktens §7 har allerede måttet rydde op efter et tidligere "EO-PDF-lag", der i virkeligheden indeholdt regulerings-/præsentationslogik frem for ren rendering. Navnet `renderers/` siger eksplicit "her bor kun gengivelse". Lad Stadie 0 låse navnet. Bemærk dog, at flytningen `src/pdf/domains/ → src/document/renderers/` er stor (15 filer + EO-sektioner + alle imports + spejlede testmapper) og bør være sit **eget** commit-trin adskilt fra interface-arbejdet, så diffen forbliver læsbar.



### Service-routing (det centrale forgreningspunkt)

`src/pdf/infrastructure/pdfService.ts` indeholder i dag 14 `downloadXxxPdf`-funktioner + 3 standalone i `standaloneRentePdfService.ts`. Disse er service-boundary jf. `pdf-contract.md` §2.

Routing-strategi: hver `downloadXxx`-funktion tager allerede `settings: AppSettings`. Den læser `settings.documentDownloadFormat` og vælger backend:

```
download...(params)                  // uændret signatur for alle 14+3 call-sites
  → byg den fælles, godkendte model (uændret: gates, snapshot, preflight)
  → hvis format === 'pdf':  load PDF-generator,  generér, .pdf
  → hvis format === 'word': load Word-generator, generér, .docx
```

Dette holder **alle call-sites uændrede** (de kalder stadig `downloadErstatningsopgoerelsePdf(...)` osv.) og samler formatvalget ét sted. Funktionsnavnene kan i en senere oprydning generaliseres (`downloadErstatningsopgoerelseDokument`), men det er ikke nødvendigt for korrekthed og holdes ude af denne plan for at minimere blast-radius.

> **Sidste kritiske review-note — dette routing-afsnit er overhalet af senere beslutninger:** De senere afklaringer siger, at service-laget omdøbes i Stadie 4 (`downloadXxxPdf` → `downloadXxxDokument`), og at MinProcesrente forbliver PDF-only. Derfor må implementeringen ikke følge linjerne om "uændret signatur for alle 14+3" eller "senere oprydning". Før kodearbejde skal afsnittet konsolideres til: Mineo-hovedappens document-service routes efter `documentDownloadFormat`; standalone-service routes ikke til Word og beholder PDF-only ansvar.

> **Gate-invariant (kritisk):** Format-valget sker **efter** download-gaten. Word-stien arver præcis samme gate-/preflight-/snapshot-resultat som PDF-stien — Word må aldrig kunne hente et dokument, PDF ville have blokeret (`pdf-contract.md` §2). Word-generatorer afgør ikke selv domæne-status; de modtager den allerede godkendte model, præcis som PDF-generatorerne.

> **Kritisk review-note — service-fejlområdet hedder i dag `pdf`:** `reportSystemIssue` har pt. `SystemIssueArea = 'pdf' | ...`, og `pdfService.ts` rapporterer `pdf:download_failure`. Hvis service-laget bliver format-agnostisk, skal fejlområdet og fejlkoder enten udvides til `document` eller bevidst beholdes som legacy med dokumenteret overgang. Ellers vil Word-runtime-fejl blive logget som PDF-fejl, hvilket gør fejlrapportering og support misvisende. Dette er ikke kun navngivning: `error-debug-contract.md` og testmatricen skal afspejle valget.
>
> >> **Svar (enig — `document` area, ikke legacy):** Da vi (jf. mit svar ovenfor) alligevel omdøber service-laget i Stadie 4, hænger fejlområdet naturligt med: `SystemIssueArea` udvides med `'document'`, og koderne bliver `document:download_failure` / `document:dev_server_unavailable`. Da Mineo er i intern testfase uden eksterne brugere (jf. AGENTS.md), er der ingen historik af `pdf:`-koder ude i marken at bevare kompatibilitet med — så det rene navn er gratis. Dette krydser ind i `error-debug-contract.md`, som er en normativ kontrakt: ændringen af area-enum berører ikke UI/UX eller beregning, så det er en koderelateret beslutning jeg selv kan træffe, men kontrakten + dens coverage-test skal opdateres i samme ændring (Stadie 6).



> **Kritisk review-note — dev-server preflight må ikke være PDF-specifik:** `ensureDevServerAvailableForPdfDownload(...)` beskytter i dag dynamic import-fejl for PDF-moduler i DEV. Word-moduler får samme lazy-load-risiko. Generalisér denne mekanisme til dokument-downloads i Stadie 4, eller lav en bevidst Word-parallel med samme tests. Hvis kun PDF-stien har preflight, kan Word give dårligere fejladfærd i intern test og skjule reelle module-load-problemer.
>
> >> **Svar (enig — generalisér, lav ikke en parallel):** Korrekt fanget, og det er faktisk gratis at gøre rigtigt. Hele dev-server-preflight-apparatet (`ensureDevServerAvailableForPdfDownload`, `isDevServerReachable`, `resolvePdfDownloadFailureKind`, dynamic-import-fejlmarkørerne) er allerede helt indholdsuafhængigt — det aner intet om PDF, det reagerer kun på "dynamic import af et lazy-loadet modul fejlede i DEV". Det skal derfor blot **omdøbes** (`ensureDevServerAvailableForDocumentDownload`) og genbruges af Word-stien, ikke kopieres. En Word-parallel ville være præcis den duplikering AGENTS.md forbyder. De eksisterende tests i `pdfService.downloadFunctions.test.ts` flytter med og udvides med en Word-load-fejl-case.



> **Kritisk review-note — standalone MinProcesrente er ikke bare “3 standalone”:** `standaloneRentePdfService.ts` har tre flows, men ingen `AppSettings`. Hvis Word-formatet også skal gælde MinProcesrente, skal der besluttes en separat formatkilde for standalone-app'en. Hvis Word-formatet kun gælder Mineo-hovedappen, skal planen sige det eksplicit, fordi "alle dokumenttyper" ellers lyder globalt. En device-lokal Mineo-setting må ikke utilsigtet koble de to apps sammen, jf. multi-app-isolation.
>
> >> **Svar (enig — og jeg har verificeret det, det er værre/renere end antaget):** Bekræftet ved kode: `standaloneRentePdfService.ts` tager **ingen** `AppSettings`, hardcoder `visBrevhoved: false`, og hele `src/apps/minprocesrente/**` har **intet** AppSettings-lag overhovedet (ingen `useAppSettings`, intet schema). MinProcesrente kan altså slet ikke læse `documentDownloadFormat` — og det *skal* den heller ikke, for `mineo_app_settings_v1` er device-lokal til Mineo-appen og må ikke smitte over på en separat app (multi-app-isolation). **Min anbefaling:** afgræns Word eksplicit til **Mineo-hovedappen** i denne plan. MinProcesrente forbliver PDF-only, dens knaptekster forbliver "PDF", og standalone-servicen rører vi ikke (ud over evt. den fælles `build()`-grænse, hvis vi vælger den). Det betyder, at "alle dokumenttyper" i planen skal læses som "alle dokumenttyper **i Mineo-hovedappen**" — jeg retter formuleringen i målbeskrivelsen, så det ikke lyder globalt. Hvis brugeren senere vil have Word i MinProcesrente, er det en selvstændig beslutning (kræver en standalone formatkilde) og uden for denne plan. Dette er et **brugervendt afgrænsningsvalg** og bør bekræftes af brugeren, før vi låser det.



---

## Indstillingen

### Schema (`src/settings/appSettingsSchema.ts`)

```ts
export const documentDownloadFormatEnum = z.enum(['pdf', 'word']);
export type DocumentDownloadFormat = z.infer<typeof documentDownloadFormatEnum>;
export const APP_SETTINGS_DOCUMENT_DOWNLOAD_FORMAT_OPTIONS = documentDownloadFormatEnum.options;
```

Tilføjes til `appSettingsSchema` (top-level) og `DEFAULT_APP_SETTINGS`:

```ts
documentDownloadFormat: documentDownloadFormatEnum,   // i schema
documentDownloadFormat: 'pdf',                          // i DEFAULT_APP_SETTINGS
```

Da det er et **top-level** felt, dækkes load/merge automatisk af eksisterende `parseStoredSettings()` (`{ ...createDefaultAppSettings(), ...currentRaw }`) — ingen ny nested-merge-logik nødvendig (jf. `app-settings.md` "Schema-evolution i nested settings"). Ingen nøgleskift (`_v2`) nødvendig, da det er en non-breaking tilføjelse.

> **Kritisk review-note — non-breaking kræver invalid-value fallback-test:** Top-level merge er kun halvdelen. Fordi `appSettingsSchema` er `.strict()`, skal `parseStoredSettings()`-testen bevise både (1) manglende `documentDownloadFormat` i gammel localStorage giver `'pdf'`, (2) ukendt værdi som `'doc'`/`'wordx'` falder tilbage uden at ødelægge øvrige settings, og (3) feltet aldrig optræder i `.eo` save/load. Hvis den nuværende parser falder tilbage til alle defaults ved ét invalid felt, skal det vurderes som eksisterende settings-semantik, ikke ændres skjult i denne feature.
>
> >> **Svar (enig — og punkt (2) afslører noget jeg skal undersøge i Stadie 4):** Dine tre test-krav er præcis de rigtige. Den vigtige nuance er din sidste sætning: Mineos `parseStoredSettings` bruger i dag `resolveAppSettings(merged)`, og jeg ved **ikke uden at læse den** om en enkelt invalid værdi giver per-felt-fallback (kun det dårlige felt → default) eller hele-objekt-fallback (alt → defaults). Det skal afdækkes i Stadie 4 **før** jeg skriver test (2), for testens forventede resultat afhænger af den eksisterende semantik. Jeg må ikke skjult ændre den semantik for at få Word-feltet til at opføre sig pænt — hvis hele-objekt-fallback er den eksisterende adfærd, dokumenterer testen den adfærd, og en evt. forbedring til per-felt-fallback er en separat, bredere beslutning (rører alle settings). Godt fanget; dette er en fælde, der ellers ville have givet en test, der "beviste" noget forkert.



> **Kritisk review-note — kategorien er PDF-output-præference, men bliver dokument-output-præference:** `app-settings.md` beskriver i dag kategorien "PDF-output-præferencer". Når Word tilføjes, skal kontrakten opdateres til "dokument-output-præferencer" uden at svække reglen om, at settings ikke er sagsdata. Samtidig bør brevhoved-kommentaren i `appSettingsSchema.ts` ændres fra "PDF-dokumenter" til "dokumenter", ellers bliver dokumentationen misvisende.
>
> >> **Svar (enig — og det rækker bredere end du nævner):** Ja. `app-settings.md` har faktisk to steder der skal opdateres: selve kategori-listen ("3. PDF-output-præferencer" → "dokument-output-præferencer") **og** den lange regel "**PDF-laget læser aldrig AppSettingsContext/localStorage direkte**" — den regel skal nu gælde **begge** outputlag (Word må heller ikke læse AppSettings dybt; jf. din senere note om `BrevhovedData`). Og `brevhovedIndstillinger`-feltet selv: dets navn og JSDoc siger "PDF-dokumenter", men det styrer nu brevhoved for begge formater. Jeg **omdøber ikke** feltet (`brevhovedIndstillinger` → noget andet ville være en breaking settings-schema-ændring med nøgleskift, og navnet er formatneutralt nok), men JSDoc-kommentaren rettes til "dokumenter". Disse er rene doc-/kommentar-rettelser uden UI/UX- eller beregningsbetydning — koderelaterede, klares i Stadie 6 sammen med den øvrige kontraktopdatering.



### UI (`src/components/pages/Indstillinger.tsx`)

Følg det eksisterende dropdown-mønster (samme som `erstatningsopgoerelseAfsluttesMed` / `defaultLoenPaaHelligdage`):

```tsx
<Box className="row--label-right-hover">
  <Typography className="row--text">Download-format for dokumenter</Typography>
  <Box className="row--label-right-hover__content">
    <StyledDropdown
      allowEmpty={false}
      value={settings.documentDownloadFormat}
      onChange={(e) => {
        if (isDocumentDownloadFormatOption(e.target.value)) {
          updateSettings({ documentDownloadFormat: e.target.value });
        }
      }}
      width={185}
    >
      {APP_SETTINGS_DOCUMENT_DOWNLOAD_FORMAT_OPTIONS.map((option) => (
        <MenuItem key={option} value={option}>
          {DOCUMENT_DOWNLOAD_FORMAT_LABELS[option]}
        </MenuItem>
      ))}
    </StyledDropdown>
  </Box>
</Box>
```

- `allowEmpty={false}` sikrer, at dropdownen aldrig kan tømmes (samme garanti som de øvrige settings-dropdowns).
- Vis-labels: dropdownen viser brugervendt tekst. Opgaven angiver valgmulighederne som "pdf" og "word". Vises som `pdf` / `word` (små bogstaver, som angivet) via et `DOCUMENT_DOWNLOAD_FORMAT_LABELS`-map. **Forelægges:** om brugeren foretrækker "PDF" / "Word" (versaler) som visningstekst — afklares ved implementering, da det er ren UI-tekst.
- `isDocumentDownloadFormatOption` er en type-guard (mønster som `isAfsluttesMedOption`).

> **Kritisk review-note — UI-placering og tekster kræver godkendelse:** Selve indstillingen og synlige labels er en UI/UX-ændring. Før implementering skal brugeren godkende den konkrete oplevelse: hvor på Indstillinger-siden rækken står, hvad labelen hedder, og om valgene vises som `pdf`/`word`, `PDF`/`Word` eller mere beskrivende tekst. Kodeplanen må ikke behandle dette som ren teknik.
>
> >> **Svar (enig — fuldt ud):** Korrekt, og det er i tråd med AGENTS.md's regel om at forelægge synlig UI/UX. Til afklaringen hører tre konkrete valg, jeg vil samle og forelægge før Stadie 4: (1) **placeringen** af rækken på Indstillinger-siden (forslag: i samme gruppe som de øvrige output-/PDF-relaterede settings, fx nær brevhoved-toggles, så beslægtede valg står samlet); (2) **labelen** — opgaven angav "Download-format for dokumenter", som jeg bruger medmindre du ændrer den; (3) **visningsteksten** for valgene. Bemærk at brugeren i opgaven skrev valgmulighederne med små bogstaver ("pdf eller word"), men dansk UI-konvention og resten af Mineo ville pege på "PDF"/"Word" — det er præcis sådan et lille valg, der skal bekræftes frem for gættes.



---

## Word-lagets centrale dele

### 1. Dokumentegenskaber (centralt — krav fra opgaven)

`src/docx/infrastructure/docxCoreProperties.ts`:

```ts
// Centralt styrede core-properties for ALLE Word-dokumenter.
export const buildDocxCoreProperties = (params: { title: string }): IPropertiesOptions['...'] => ({
  title: params.title,
  subject: 'Erstatningsberegning',     // ens for alle, som PDF i dag
  creator: getDocumentCreatorBrand(),   // 'Mineo' / brand
  description: ...,                      // valgfrit
  // ingen per-generator afvigelse: kun titel varierer
});
```

Kun **titlen** varierer pr. dokument; alt andet er centralt. Dette spejler PDF'ens faktiske data (author 'Mineo', subject 'Erstatningsberegning'), men samlet ét sted i stedet for spredt. `getDocumentCreatorBrand()` deles med PDF-lagets `getPdfCreatorBrand()` (flyttes til en fælles `documentBrand.ts`, så brand-override for standalone-builds gælder begge formater).

> **Kritisk review-note — metadatafelt-typer skal verificeres mod `docx` API'et:** Pseudotypen `IPropertiesOptions['...']` er ikke tilstrækkelig som plan. `docx`-bibliotekets faktiske property-navne og niveau (`creator`, `lastModifiedBy`, `title`, `subject`, `description`, evt. `keywords`) skal verificeres ved installation, og der skal skrives en test der åbner `.docx` som ZIP og læser `docProps/core.xml`. Ellers kan vi tro, at properties er sat, uden at Word faktisk modtager dem.
>
> >> **Svar (enig — pseudotypen var en pladsholder, ikke en plan):** Helt rigtigt, `IPropertiesOptions['...']` var bevidst håndviftende og må erstattes af de faktiske `docx`-typer ved installation i Stadie 1. To konkrete ting at være opmærksom på, som jeg vil skrive ind: (1) `docx` skelner mellem **core properties** (`docProps/core.xml`: `title`, `subject`, `creator`, `description`, `keywords`, `lastModifiedBy`) og **app/custom properties** — vi rammer core properties, og de sættes via `new Document({ title, subject, creator, ... })`-options, ikke en separat metoder. (2) `creator` i Word er den semantiske pendant til PDF's `author` **og** `creator` samtidig — Word har ikke et separat "author"-felt på core-niveau på samme måde, så mapping fra vores `{ author, creator }` til Words felter skal afklares konkret. ZIP-test mod `docProps/core.xml` (jf. din Stadie 2-tilføjelse) er den eneste måde at bevise det faktisk virker. Indtil biblioteket er installeret og typerne læst, er alt her udkast.

### 2. Typografier (centralt — krav fra opgaven)

`src/docx/infrastructure/docxStyles.ts` definerer ét styles-sæt, der mappes fra `docxConfig`-konstanter, så Word-dokumenter er visuelt ensartede:

| Semantisk type (DocumentWriter) | Word-style |
|---------------------------------|------------|
| `writeTitle` | `MineoTitle` (16pt, fed) |
| `writeSectionHeader` | `MineoSectionHeader` (12pt, fed, luft over) |
| `writeBoldSubheader` | `MineoSubheaderBold` (10pt, fed) |
| `writeUnderlinedSubheader` | `MineoSubheaderUnderlined` (10pt, understreget) |
| `writeWrappedText` / `writeBoldWrappedText` | `MineoBody` (10pt) / fed variant |
| `writeLeftRightText` | tabel uden kanter med højre-justeret højrekolonne, `MineoBody` |
| Tabeller (`renderTable`) | `MineoTable` celle-/header-styles |

Fontstørrelser og farver kommer fra `docxConfig.ts`, der genbruger værdierne fra `pdfConfig.ts` (16/12/10pt; tekstfarve `#333`) for visuel familielighed. Font-family er **Calibri** (Words standard, bekræftet brugervalg) — ikke indlejret, så filen er let og åbner ens på alle maskiner. PDF bruger fortsat Helvetica; familielighed er ikke et mål.

> **Kritisk review-note — Word-styles skal navngives stabilt og være dokumentets eneste typografikilde:** `DocxWriter` må ikke sætte fontstørrelse/farve inline ved hvert afsnit, medmindre det er en bevidst undtagelse. Styles skal ligge i dokumentets styles-del og refereres fra paragraphs/tables, så dokumentet kan efterredigeres i Word på en forudsigelig måde. Test bør derfor ikke kun assert'e synlig tekst, men også at style-id'er bruges konsekvent.
>
> >> **Svar (enig — dette er den direkte Word-pendant til pdf-layout-kontraktens kerneprincip):** Præcis rigtigt, og det er værd at gøre eksplicit: din note er Word-versionen af `pdf-layout-contract.md` §3/§8 ("brug kanoniske writer-API'er; sæt ikke font manuelt og skriv direkte"). Den nye `document-format-contract.md` bør optage præcis denne regel for Word: **styrede styles i `word/styles.xml`, refereret via `style: 'MineoBody'` på hvert afsnit — aldrig inline `size`/`color`/`bold` undtagen som dokumenteret undtagelse.** Det er både korrekt for efterredigering i Word (din pointe) og det, der gør "central, ensartet typografi" (brugerens oprindelige krav) reelt håndhævbart. Testen, der asserter konsekvent style-id-brug, bliver Word-pendanten til de eksisterende PDF quality-guards mod manuel `setFont`. Stærk note.



### 3. Brevhoved og footer

- `docxBrevhoved.ts` gengiver `BrevhovedData` (flyttet til `src/document/`, jf. note ovenfor) som en **page-relative forankret tekstrude (text box)** øverst til højre på **side 1**. Anker-invariant: ruden forankres til **siden**, ikke til et afsnit, så den ikke flytter sig når brødteksten ændres (bekræftet brugerkrav). Vises efter samme `getVisBrevhoved(settings, pdfType)` — **ingen** nye toggles (bekræftet beslutning). Placering (offset top-højre) finjusteres ved lejlighed. **Bevidst forskel fra PDF:** PDF reserverer 40 mm brevhoved-zone på *hver* side; Word viser brevhovedet kun på side 1.
- `docxFooter.ts` sætter `brand // version` som ægte Word-sidefod (gælder alle sider automatisk — simplere end PDF, der tegner pr. side).

> **Kritisk review-note — `BrevhovedData` bør flyttes ud af PDF-shared:** Hvis Word importerer `BrevhovedData` fra `pdfHelpers`, bliver Word-laget afhængigt af PDF-shared. Det strider mod målet om et format-neutralt dokumentlag. Flyt brevhoved-DTO og brand-helper til `src/document/` i Stadie 1, og lad PDF og Word begge importere derfra. `getVisBrevhoved(settings, pdfType)` er pt. AppSettings-koblet teknisk gæld; Word-planen bør ikke cementere den dybere end nødvendigt.
>
> >> **Svar (enig — retter en fejl i min oprindelige plan):** Du har ret, og det modsiger min egen formulering "genbruger `BrevhovedData` 1-til-1 fra `pdfHelpers`" — den ville cementere afhængigheden Word→PDF-shared, som er præcis det, abstraktionen skal undgå. Korrekt rækkefølge: i Stadie 1 flyttes `BrevhovedData` (og `getDocumentCreatorBrand`/brand-helperen) til `src/document/`, og **både** `pdfHelpers` og `docxBrevhoved` importerer derfra. Pilen vender da rigtigt: begge formatlag → fælles `document/`-lag, intet format→format. Til din skarpe bemærkning om `getVisBrevhoved(settings, pdfType)`: jeg cementerer den **ikke** dybere — Word kalder den ved **service-grænsen** (samme sted som PDF allerede gør, i `buildCommonPdfContext`) og modtager kun det resulterende `boolean visBrevhoved` + `BrevhovedData`. Word-writer/-shared rører aldrig `AppSettings`. Det respekterer app-settings-kontraktens "PDF-laget læser aldrig AppSettings direkte"-regel (som jo nu også skal gælde Word, jf. min note ovenfor) og lader være med at gøre den erkendte `PdfType = keyof AppSettings[...]`-gæld værre.



> **Kritisk review-note — footer-version skal være samme kilde som PDF:** Word-footeren må ikke kopiere version/brand-formatet. Brug samme centrale version-/brandkilde som PDF. Hvis `setPdfFooterBrand('minprocesrente.dk')` fortsat findes for standalone, skal den enten generaliseres eller eksplicit afgrænses, så Word i standalone ikke får forkert brand.
>
> >> **Svar (enig, og standalone-afgrænsningen gør det enklere):** Korrekt: Word-footeren skal læse samme `VERSION` (fra `src/config/version.ts`, som pre-commit-hooken regenererer) og samme brand-helper som PDF — footer-strengen `${brand} // ${VERSION}` bygges ét sted i `src/document/` og bruges af begge formatlag. Til `setPdfFooterBrand`-bekymringen: den løser sig delvist af min anbefaling om at afgrænse Word til Mineo-hovedappen — `setPdfFooterBrand('minprocesrente.dk')` kaldes kun i standalone-bootstrap, og hvis Word ikke findes i standalone, kan Word i praksis aldrig få minprocesrente-brandet. Men brand-helperen flyttes alligevel til `src/document/` (fælles for begge formater), så hvis Word **senere** kommer til standalone, arver den korrekt brand uden ekstra arbejde. Den eksisterende muterbare modul-state i `setPdfFooterBrand` (global `let`) er i sig selv et lille smell, men det er forudbestående og uden for denne plans scope at omskrive — noteres som tilfældighedsfund.



### 4. Tekstnormalisering

PDF normaliserer Unicode pga. Helvetica/Latin-1 (`normalizeTextForPdf`). Word/`.docx` er UTF-8 og kræver **ikke** samme normalisering — Word-laget bør **ikke** ASCII-erstatte ±, →, ≤ osv. Stadie 1 fastlægger en minimal Word-normalisering (kun CRLF→LF og NBSP-håndtering hvor relevant), så Word faktisk udnytter sin bedre tegnstøtte.

> **Kritisk review-note — tekstnormalisering må ikke ændre beregnings-/præsentationstekst:** Word må gerne bevare flere Unicode-tegn end PDF, men det betyder også, at Word og PDF ikke nødvendigvis er byte-/tegn-identiske. Test derfor "samme indhold" på semantisk tekstniveau: alle labels, beløb, datoer, satser og brugerkommentarer skal være til stede i samme rækkefølge, men format-specifik tegnnormalisering kan være forskellig. Brugerindtastede kommentarer skal desuden escap'es/indsættes som tekstnoder, aldrig som rå XML.
>
> >> **Svar (enig — og XML-escaping-pointen er sikkerhedskritisk):** To selvstændige pointer her, begge rigtige. (1) **Semantisk paritet, ikke tegn-paritet:** korrekt — format-paritet-testen (din Stadie 5 + Testplan-tilføjelse) skal sammenligne *normaliserede* tekstindekser, ikke rå strenge, ellers fejler den falsk, netop fordi Word med vilje bevarer `±`/`→`/`≤` som PDF erstatter. Det er et bevidst, ønsket format-forskel, ikke et indholdstab. (2) **XML-escaping er ikke valgfri og ikke kun et test-krav — det er en korrektheds-/robusthedsgaranti:** `docx`-biblioteket håndterer selv escaping når man giver det tekst via `new TextRun(userString)`, men *kun* hvis vi konsekvent går gennem dets tekst-API'er og **aldrig** injicerer rå XML-strenge. En brugerkommentar med `<`, `&` eller `"` (helt lovligt i et fritekstfelt) ville ellers kunne ødelægge dokumentet eller værre. Jeg vil hæve dette til en eksplicit **invariant** i `document-format-contract.md`: Word-laget konstruerer kun indhold via `docx`-objekt-API'er; rå-XML-strenginjektion er forbudt. Det er Word-pendanten til PDF'ens `normalizeTextForPdf`-disciplin og hører hjemme i kontrakten, ikke kun i en test.



---

## Stadier

Hvert stadie efterlader `typecheck` + `lint` + relevante tests grønne og kan committes selvstændigt.

### Stadie 0 — Audit og interface-design (ingen runtime-ændring)
- Læs alle 16 generatorer + 3 standalone og katalogisér præcist, hvilke writer-API'er hver bruger.
- Identificér PDF-specifik geometri (`getY`/`setY`/`advanceY`/`ensureSpace`/`addSpacer`/`addPage`/`writeSignatureBlock`/`writeAtomicTableChunks`/vandmærke) pr. generator.
- Fastlæg `DocumentWriter`-interfacets endelige flade og afgør placering (`src/document/domains/` flytning vs. PDF-only + adaptere).
- **Leverance:** opdateret afsnit i denne plan + udkast til `src/contracts/document-format-contract.md`. Ingen kode endnu.

> **Sidste kritiske review-note — Stadie 0 skal konsolidere, ikke kun auditere:** Dokumentet indeholder nu bevidst både oprindelig plan og senere svar. Før Stadie 1 må Stadie 0 derfor også skrive en kort "konsolideret beslutningsliste" ind øverst i planen med de endelige valg: Mineo-only, `build()` artifact-grænse, `DocumentDownloadResult`, `document` error-area, `src/document/renderers/`, fælles metadata-builder, og ingen hårde generator-tal uden audit-tabellen. Uden den liste bliver planen for let at mislæse.

> **Tilføjelse til Stadie 0:** Audit skal også katalogisere alle brugervendte PDF-ord i komponenter, hooks, props, aria-labels og fejlbeskeder. Brug `rg -n "PDF|Pdf|pdf"` og skriv resultatet ind som en handlingsliste i planen. Klassificér især `PdfDownloadButton`, `useAarsloenPdfGates`, EO-downloadknapper, Renteberegning/MinProcesrente og lokale fejlbeskeder.
>
> >> **Svar (enig):** Tilføjet til Stadie 0-omfanget. Vigtig skelnen, audit-listen skal kode hvert hit med: **brugervendt** (skal gøres formatafhængigt → kræver UI/UX-godkendelse) vs. **internt** (funktions-/type-/filnavn → koderelateret, jeg afgør). `PdfDownloadButton` er fx begge dele: komponentnavnet er internt (kan omdøbes til `DocumentDownloadButton`), men hvis den har en synlig tekst/aria-label med "PDF", er den brugervendt. MinProcesrente-hits forbliver "PDF" hvis vi (som anbefalet) afgrænser Word væk fra standalone — så de skal markeres "bevidst PDF-only" i listen, ikke "skal ændres".



> **Tilføjelse til Stadie 0:** Audit skal afgøre, om formatvalget gælder MinProcesrente. Hvis ja, skal standalone-app'en have en device-lokal setting eller en eksplicit default. Hvis nej, skal planen afgrænse Word til Mineo-hovedappen, og UI-tekster i MinProcesrente må forblive PDF.
>
> >> **Svar (enig — og jeg har allerede en anbefaling, jf. ovenfor):** Min anbefaling er **nej**: afgræns Word til Mineo-hovedappen (MinProcesrente har intet AppSettings-lag, og en Mineo-device-setting må ikke smitte over). Men da det er et brugervendt afgrænsningsvalg, skal det **bekræftes af brugeren** før vi låser det i Stadie 0 — ikke afgøres af mig alene. Hvis brugeren vil have Word i MinProcesrente, bliver det betydeligt mere arbejde (egen formatkilde for standalone), og det bør i så fald være en separat plan.



> **Tilføjelse til Stadie 0:** Udkast til `document-format-contract.md` skal definere forholdet til `pdf-contract.md` og `pdf-layout-contract.md`: PDF-kontrakterne må ikke længere være eneste normative outputkontrakter, når Word findes. Den nye kontrakt bør eje formatvalg, artifact-download, fælles gates, metadata, filnavn og "samme godkendte model"; PDF-layout bør fortsat kun eje PDF-visuel geometri.
>
> >> **Svar (enig — dette er den rigtige kontrakt-topologi):** Præcis det rigtige snit. Den nye `document-format-contract.md` bliver den **tværgående output-paraply**, der ejer det format-neutrale: gate-aggregering (arver `pdf-contract.md` §2's regler), "samme godkendte model", metadata-builder, filnavnsregel, artifact/`build()`-grænse, XML-escaping-invarianten (jf. ovenfor), og selve formatvalget. `pdf-contract.md` reduceres til PDF-specifikke data-/guard-regler; `pdf-layout-contract.md` forbliver ren PDF-visuel geometri og får en Word-pendant for Word-styles (eller et afsnit i den nye kontrakt). Kontrakthierarkiet i AGENTS.md skal opdateres: den nye kontrakt indsættes i den tværgående liste, og `pdf`/`pdf-layout` bliver underordnet den for det format-neutrale. Dette er en kontraktstruktur-ændring uden UI/UX- eller beregningsbetydning → koderelateret, men den følger `contract-topology-procedure.md` (Stadie 6).



### Stadie 1 — Fundament: dependency, config, styles, properties, filnavn
- Tilføj `docx` til `package.json` + `vendor-docx`-chunk i `vite.config.ts`.
- Opret `src/document/` (interface, `DocumentFormat`, `resolveDocumentFileName`).
- Generalisér `resolvePdfFileName` → `resolveDocumentFileName(baseTitle, isDraft, ext, journalnr)`; lad `resolvePdfFileName` blive en tynd wrapper (`ext='pdf'`) indtil call-sites er flyttet.
- Opret `docxConfig.ts`, `docxStyles.ts`, `docxCoreProperties.ts`, fælles `documentBrand.ts`.
- **Tests:** filnavn (round-trip mod eksisterende `pdfFilenameBuilders.test.ts`), config-konstanter, core-properties.

> **Sidste kritiske review-note — `docxCoreProperties.ts` bør ikke være den centrale metadata-kilde:** Efter metadata-afklaringen skal den fælles sandhed være `src/document/buildDocumentCoreProperties` (eller tilsvarende navn). Word kan godt have en lille adapter der mapper fælles properties til `docx`'s faktiske Document-options, men filen må ikke genindføre `buildDocxCoreProperties()` som parallel kilde. Det samme gælder tests: fælles metadata-invarianter hører under `src/__tests__/document/...`, mens Word-testen kun beviser OOXML-serialiseringen.

> **Tilføjelse til Stadie 1:** Tilføj dependency med bevidst bundle-audit: noter faktisk installeret version, gzip/bundle-estimat hvis tilgængeligt, og bekræft at hovedbundle ikke får `docx` med før download. `vite.config.ts` bruger path-match på `/jspdf/`; `docx` kan have transitive moduler med andre paths, så chunk-reglen skal verificeres med build-output, ikke kun antages.
>
> >> **Svar (enig — og verificér det med `build`, ikke med tro):** Korrekt og vigtig. Dette er præcis et af de tilfælde, hvor AGENTS.md kræver `npm run build` (dependency- + vite-config-ændring). Den kritiske invariant at bevise: `docx` må **kun** optræde i `vendor-docx`-chunken, aldrig i hoved-/entry-chunken — ellers betaler alle brugere bundle-prisen ved opstart, selv om de aldrig downloader Word. `docx` er ikke en lille dependency, så dette er en reel bekymring, ikke pro forma. Hvis path-matchen ikke fanger transitive moduler rent, kan det kræve en eksplicit `manualChunks`-funktion frem for path-streng. Bekræftes mod faktisk `dist/`-output, og det installerede versionsnummer + bundle-tal skrives ind i planen (begrundelse for ny dependency, jf. AGENTS.md).



> **Tilføjelse til Stadie 1:** Generalisér ikke kun filnavns-helperen; generalisér også fejlkoder/tekstbyggere hvor de i dag siger `PDF`, men kun for interne koder hvis det kan gøres uden synlig UI-ændring. Synlige fejltekster der ændres fra "PDF" til "dokument"/"Word" skal forelægges som UI/UX.
>
> >> **Svar (enig — med én præcisering om timing):** Skellet intern-kode (fri) vs. synlig-tekst (forelægges) er korrekt og konsistent med resten. Én præcisering: de fleksible fejltekster — fx `'Kunne ikke generere satser-PDF'` — er **brugervendte** (de vises i fejl-UI), så de hører til UI/UX-godkendelse og bør håndteres samlet med knapteksterne i Stadie 6, ikke spredt ud i Stadie 1. I Stadie 1 generaliserer vi kun det rent interne (filnavns-helper, fejl**koder** som `pdf:download_failure` → `document:...`). Det holder de brugervendte ændringer samlet i ét godkendelsestrin frem for drysset over flere stadier.



### Stadie 2 — `DocxWriter` (DocumentWriter-impl) + brevhoved + footer + tabel
- Implementér `DocxWriter` mod `docx`-biblioteket: alle semantiske write-metoder, `renderTable`, `setDocumentProperties`, `addFooter`, `save` (download via Blob).
- Implementér `docxBrevhoved.ts` og `docxFooter.ts`.
- **Tests:** writer producerer et gyldigt `docx.Document` med korrekte styles/properties; brevhoved vises kun ved `visBrevhoved`; tabel-renderer mapper rækker korrekt. Mock-mønster som `pdfWriter.test.ts`.

> **Sidste kritiske review-note — Stadie 2-listen skal omskrives før kode:** Den endelige writer skal ikke have `save`, og `renderTable` må ikke være en fri writer-metode med format-specifikke props. Stadie 2 bør i stedet implementere `DocxWriter.build(): Promise<DocumentArtifact>`, `DocumentTable`-mapping, `buildDocxDocument(...)`/serialisering og en delt `triggerDocumentDownload(...)` i service-laget. "Mock-mønster som `pdfWriter.test.ts`" er utilstrækkeligt for Word; ZIP-/OOXML-tests er obligatoriske.

> **Sidste kritiske review-note — OOXML-feature-spike hører hjemme før fuld DocxWriter:** Før der bygges brevhoved/footer/vandmærke bredt, skal der laves en minimal spike/test der producerer ét `.docx` med Calibri-style, sidefod, page-relative brevhoved-tekstrude og UDKAST-vandmærke. Testen skal åbne ZIP'en og gerne verificere at Word-relevante relationer/header/footer XML-dele findes. Hvis denne spike fejler, skal planen stoppe og forelægge fallback-valg, ikke fortsætte med resten af generatorerne.

> **Tilføjelse til Stadie 2:** Test den producerede `.docx` som ZIP-indhold, ikke kun at `docx`-objektet findes. Minimum: `[Content_Types].xml`, `word/document.xml`, `word/styles.xml`, `docProps/core.xml` og footer-relationer findes; dokumentet indeholder forventede tekstnoder; styles og core-properties er faktisk serialiseret.
>
> >> **Svar (enig — dette er det, der gør "produktet virker" sandt frem for antaget):** Helt enig, og det er muliggjort af `build()`-grænsen (mit svar ovenfor): fordi writeren returnerer en `Blob`, kan testen unzippe den (Vitest kører i Node; en zip-læser som JSZip eller `docx`'s egen output kan åbne den) og assert'e mod den faktiske OOXML. Uden ZIP-test ville en grøn "objektet blev bygget"-test stadig kunne sende et dokument, Word ikke kan åbne, ud til brugeren — uacceptabelt i et trust-kritisk output. Dette er Word-pendanten til, at vi i dag stoler på, at jsPDF producerer en valid PDF. **Forbehold:** afhænger af, om en ZIP-aflæsning kan ske uden ny test-dependency; hvis `docx`/Node ikke rækker, kan en lille devDependency (fx `jszip`) være berettiget — vurderes i Stadie 2 og begrundes hvis nødvendigt.

> **Tilføjelse til Stadie 2:** `DocxWriter` skal fail-closed på tomme/ugyldige tabeller efter samme princip som PDF-tabelrendererens empty-body guard. Hvis et dokument lovligt skal vise "Ingen ..." som række, skal den række bygges eksplicit før writer-kaldet.
>
> >> **Svar (enig — og det er en faktisk OOXML-validitetsregel, ikke kun et princip):** Korrekt, og der er en hård teknisk grund ud over symmetrien: en Word-tabel med nul rækker er **ugyldig OOXML** — Word kan nægte at åbne dokumentet eller reparere det. Så fail-closed på tom tabel er ikke en stilbeslutning, det er et must for at producere et åbnbart dokument. Den delte `DocumentTable`-model (jf. min note om tabelmodellen) skal håndhæve "mindst én række, ellers eksplicit fejl" ét sted, så både PDF- og Word-adapteren arver guarden — frem for at hver adapter genopfinder den. Det knytter pænt an til empty-body-guarden, der allerede findes på PDF-siden.



### Stadie 3 — Lad `PdfWriter` opfylde `DocumentWriter` + refaktorér 1 pilot-generator
- Få `PdfWriter` til formelt at implementere `DocumentWriter` (mest navngivning/typer; metoderne findes).
- Refaktorér **én** simpel generator (anbefalet: `satserPdf.ts`) til at tage `DocumentWriter` ind i stedet for at kalde `createStandardPdfWriter()` selv. Writer-instansen oprettes nu i loader/service-laget.
- Verificér at PDF-output for satser er **uændret** (samme bytes/struktur) — ren refaktorering, ingen synlig ændring.
- **Tests:** eksisterende satser-PDF-tests grønne; ny satser-Word-test.

> **Tilføjelse til Stadie 3:** "PDF-output uændret" bør ikke baseres på byte-identitet alene, fordi jsPDF metadata/timestamps kan gøre snapshots skrøbelige. Brug eksisterende testmønstre hvis de allerede normaliserer output; ellers assert på kaldt writer-flow, filnavn, metadata og tekst-/tabelindhold. Byte-snapshot må kun bruges hvis nondeterministiske felter er stabiliseret.
>
> >> **Svar (enig — retter en upræcished i min plan):** Korrekt; min oprindelige formulering "samme bytes/struktur" var for naiv. jsPDF indlejrer bl.a. et `CreationDate` i PDF-metadata, så byte-snapshots ville flakke pr. kørsel. Den rigtige invariant er **adfærds-/flow-baseret**: ved refaktorering af satser fra `createStandardPdfWriter()`-internt-kald til at modtage en `DocumentWriter`, asserter vi at writeren modtager den samme sekvens af kald med samme argumenter (titel, sektioner, rækker, filnavn, metadata-objekt) som før. De eksisterende satser-tests viser det faktiske mønster — Stadie 3 starter med at læse dem og genbruge deres normalisering frem for at opfinde en ny. "Ren refaktorering, intet synligt skift" bevises på dét niveau, ikke på bytes.



### Stadie 4 — Service-routing + indstilling + UI
- Tilføj `documentDownloadFormat` til schema + defaults + UI-dropdown + type-guard.
- Indfør formatvalg i `pdfService.ts` (og standalone-service): for satser-stien routes til PDF- eller Word-backend ud fra `settings.documentDownloadFormat`.
- **Tests:** service vælger korrekt backend; gate-invariant bevares (Word blokeres når PDF ville blokere); settings-parse/merge med nyt felt; forward/backward-load af `.eo` upåvirket (settings er ikke `.eo`-data — bekræft at intet lækker).

> **Tilføjelse til Stadie 4:** Routing skal være exhaustiv på `documentDownloadFormat`. Brug en `switch` med `assertNever`/tilsvarende, så en fremtidig enum-ændring ikke falder tilbage til PDF eller Word i stilhed.
>
> >> **Svar (enig):** Ja — exhaustiv `switch` med `assertNever(format)` i default-grenen. Det giver en **compile-time** fejl, hvis enum'et udvides (fx med et fremtidigt 'odt'), så ingen ny dokumenttype kan glide igennem og stille defaulte til PDF. Det matcher AGENTS.md's fail-closed-holdning på kritiske stier. Bemærk at type-guarden `isDocumentDownloadFormatOption` i UI-laget og `assertNever` i service-laget tilsammen lukker både runtime-input (dropdown) og compile-time-udvidelse.



> **Tilføjelse til Stadie 4:** Service-resultattypen bør omdøbes fra `PdfDownloadResult` til `DocumentDownloadResult` eller wrappers bør indføres. Hvis navnet beholdes midlertidigt, skal der være en TODO-lignende kommentar med konkret fjernelsestrigger, ellers bliver legacy-navnet permanent.
>
> >> **Svar (enig — omdøb, ingen TODO):** I tråd med mit svar på din "navnet PDF må ikke blive abstraktionsgæld"-note vælger jeg **at omdøbe**, ikke at efterlade en TODO. `PdfDownloadResult` → `DocumentDownloadResult`, og `standaloneRentePdfService.ts` importerer den samme type derfra (den importerer i dag `PdfDownloadResult` fra `pdfService`). En "midlertidig" TODO uden tvingende grund er netop den slags, der bliver permanent — og da appen ikke har eksterne brugere, er der ingen pris ved at gøre det rent nu. Omdøbningen er mekanisk og fanges af typecheck.



> **Tilføjelse til Stadie 4:** Settings-UI skal implementeres først efter brugerens godkendelse af den konkrete synlige række og valgmuligheder. Denne plan er ikke i sig selv UI-godkendelse.
>
> >> **Svar (enig — fuldt ud):** Bekræftet. Selv om brugeren har specificeret label og valgmuligheder i den oprindelige opgave, er den endelige synlige række (placering, præcis tekst, versalisering af pdf/word) en UI/UX-ændring der forelægges separat før Stadie 4-UI-kode, jf. AGENTS.md. Schema-/type-/routing-delen af Stadie 4 (ikke-synlig) kan godt laves uden godkendelse; kun selve dropdown-rækken venter på den.



### Stadie 5 — Udrul til alle resterende generatorer
- Refaktorér de øvrige 15 generatorer + 3 standalone til `DocumentWriter`, i layout-kontraktens audit-rækkefølge (simple først: `rentePdf`, `aarsloenPdf`, `shDagePdf`, `varigeMenPdf`, … til sidst `erstatningsopgoerelsePdf` + EO-sektioner).
- Hver generator: PDF-output uændret + ny Word-sti dækket.
- Håndtér PDF-specifik geometri pr. generator (underskriftsblok, vandmærke) Word-native eller med dokumenteret PDF-only escape.
- **Tests:** pr. generator — PDF uændret, Word gyldig.

> **Tilføjelse til Stadie 5:** Migrér i den faktiske `pdf-layout-contract.md` §11-rækkefølge, men opdater listen i planen efter Stadie 0, så den matcher både loader-moduler og sektionsfiler. EO-sektionerne (`opgoerelseSection`, `shDageSection`, `loenindkomstSection`, `offentligeYdelserSection`, `reguleringSection`) er ikke selvstændige downloads, men de er centrale for EO-output og skal testes via EO-dokumentet.
>
> >> **Svar (enig):** Korrekt rækkefølge og korrekt om EO-sektionerne. Layout-kontraktens §11 lister bevidst de simple generatorer først (`satserPdf`, `rentePdf`, …) og de domænetunge sidst (`erstatningsopgoerelsePdf` + de fem sektioner). Det er præcis den rigtige migrationsorden, fordi EO er det dokument med flest PDF-geometri-/tabelfeatures (jf. min tabelmodel-note) — at tage det sidst betyder, at `DocumentWriter`-interfacet og `DocumentTable`-modellen allerede er hærdet på de simple dokumenter, før EO presser dem. EO-sektionerne deler writer med EO-dokumentet og testes gennem det samlede EO-output, ikke isoleret.



> **Tilføjelse til Stadie 5:** For hvert dokument skal Word-testen assert'e brugerinput med særlig risiko: journalnr/brevhoved, kommentarer/fritekst, udkast-status, bilagsvalg, udvidet specifikation og tomme/fravalgte sektioner. Det er her silent omissions i Word-output typisk vil opstå.
>
> >> **Svar (enig — dette er kerne-trust-risikoen):** Helt enig, og det rammer planens største fare (jf. "skjult indholdstab" i risikoafsnittet). Din liste er præcis de felter, hvor PDF har eksplicitte toggle-guards (`pdf-contract.md` §3: betingede felter som `visUdvidetSpecifikation`, `indsaetUdkastStempel`, bilagsvalg, fravalgte sektioner). Word-stien skal arve **nøjagtig samme** guards — et fravalgt felt må ikke dukke op i Word, og et tilvalgt må ikke mangle. Fordi Word ikke er pixel-paritet, fanger øjet ikke en manglende sektion, så assertionen *skal* være maskinel. Jeg vil tilføje: testen skal også dække den **omvendte** retning — at semantisk fravalgte delberegninger (`pdf-contract.md` §4) heller ikke genindføres i Word via et visningsvalg. Word arver "samme godkendte model", så fravalg skal være fravalg i begge formater.



### Stadie 6 — Knaptekster + kontrakt + slutgennemgang
- Gør formatnævnende knaptekster formatafhængige (fx `SpecifikationDownloadBox` "Download alle som PDF" → "… som Word"). Læs `settings.documentDownloadFormat` til at vælge ordet. Giv desuden de **nøgne download-ikoner** (fx Satser-siden) en `title`/tooltip der nævner det aktive format ("Download som Word"/"… som PDF"), så formatet aldrig er skjult (afklaret UI-valg). Forelæg de konkrete tekster (UI/UX).
- Registrér `src/contracts/document-format-contract.md` i `contract-topology.json` + `contractCoverageMatrix.test.ts` (jf. `contract-topology-procedure.md`), og opdatér `pdf-contract.md`/`pdf-layout-contract.md`/`app-settings.md` til at referere det nye lag.
- Fuld `test` + `build` (ny dependency + vite-config rører bundling).

> **Tilføjelse til Stadie 6:** Kontraktændringen skal følge `docs/architecture/contract-topology-procedure.md` fuldt: ny kontrakt med `Senest verificeret mod kode`, registrering i `contract-topology.json`, matrix-entry i `contractCoverageMatrix.test.ts`, og opdatering af relevante eksisterende kontrakter i samme ændring. Hvis dokument-format-kontrakten bliver tværgående, skal `page-component-contract.md` sandsynligvis også referere den for download-knapper/handlers.
>
> >> **Svar (enig):** Bekræftet, og kontrakten **er** tværgående (jf. min note om kontrakt-topologien ovenfor), så den indgår i den tværgående liste og opdateringen rammer i samme commit: `document-format-contract.md` (ny, med verificeret-dato) + `contract-topology.json` + `contractCoverageMatrix.test.ts` + de eksisterende der skal pege på den (`pdf-contract.md`, `pdf-layout-contract.md`, `app-settings.md`, `error-debug-contract.md`, og AGENTS.md's kontrakthierarki). `page-component-contract.md` skal referere den, fordi download-knapper/handlers nu har en formatafhængig kontrakt. Alt i ét samlet trin, så kontrakt og kode ikke kan drive — jf. proceduren.



> **Tilføjelse til Stadie 6:** Slutgennemgangen skal inkludere en `rg`-baseret nulstilling af brugervendte "PDF"-rester. Tilladte rester skal være eksplicit begrundet: fx teknisk legacy-funktionsnavn, PDF-specifik kontrakt, eller MinProcesrente hvis Word bevidst er afgrænset væk derfra.
>
> >> **Svar (enig):** God afslutningskontrol. Da jeg (jf. ovenfor) anbefaler faktisk at omdøbe det interne PDF-navngivning frem for at efterlade legacy, bør "tilladte rester" efter Stadie 6 være en kort, begrundet liste: (1) **PDF-specifik kode** der reelt kun angår PDF (fx jsPDF-adapteren, `normalizeTextForPdf`, PDF-layout-konstanter) — disse *skal* hedde PDF; (2) **MinProcesrente** hvis Word er afgrænset væk (bevidst PDF-only); (3) **`pdf-contract.md`/`pdf-layout-contract.md`** som forbliver PDF-specifikke kontrakter under den nye paraply. Alt brugervendt og alt format-neutralt skal være renset. Resultatet skrives ind som en kort whitelist, så en fremtidig læser ved, at de tilbageværende "PDF"-forekomster er bevidste, ikke oversete.



---

## Berørte og nye filer (oversigt)

### Nye filer
- `src/document/{documentWriter,documentFormat,documentFileName,index}.ts`
- `src/document/documentBrand.ts` (flyttet fra PDF-brand)
- `src/docx/infrastructure/{docxConfig,docxStyles,docxCoreProperties,docxWriter,docxLoader,index}.ts`
- `src/docx/shared/{docxBrevhoved,docxFooter,docxTableRenderer,index}.ts`
- `src/docx/index.ts`
- `src/contracts/document-format-contract.md`
- Tests under `src/__tests__/docx/...` (spejler `src/__tests__/pdf` + `utils/pdf`)

> **Kritisk review-note — testplacering bør spejle kildeplacering:** Hvis det format-neutrale lag hedder `src/document/`, bør tests ligge under `src/__tests__/document/...` for fælles filnavn/metadata/writer-contract tests, og `src/__tests__/docx/...` kun for Word-specifik serialisering. Ellers bliver fælles invarianter gemt i Word-testmappen.
>
> >> **Svar (enig — retter min filliste):** Korrekt; min oprindelige "tests under `src/__tests__/docx/...`" var for grovkornet. AGENTS.md kræver, at `src/__tests__/` spejler kildestrukturen. Så: fælles invarianter (`resolveDocumentFileName`, `buildDocumentCoreProperties`, `DocumentWriter`-kontrakt, format-routing, `documentDownloadFormat`-parsing) → `src/__tests__/document/...`; Word-specifik serialisering/ZIP/styles → `src/__tests__/docx/...`; PDF-specifikt bliver hvor det er. Hvis det neutrale lag ender med at hedde `renderers/` (jf. min navne-note), spejler testmappen det. Jeg opdaterer fillisten til at afspejle dette i Stadie 0.



### Ændrede filer
- `package.json` (+`docx`), `vite.config.ts` (+`vendor-docx`)
- `src/settings/appSettingsSchema.ts` (+`documentDownloadFormat`)
- `src/components/pages/Indstillinger.tsx` (+ dropdown)
- `src/pdf/infrastructure/pdfService.ts` + `standaloneRentePdfService.ts` (format-routing)
- `src/pdf/infrastructure/pdfWriter.ts` (implements `DocumentWriter`)
- `src/pdf/shared/pdfFormatUtils.ts` (`resolvePdfFileName` → wrapper om `resolveDocumentFileName`)
- `src/pdf/shared/pdfHelpers.ts` (brand flyttet til `documentBrand.ts`)
- Alle 16 generatorer + 3 standalone (tag `DocumentWriter` ind)
- Knap-komponenter med formatnævnende tekst (fx `SpecifikationDownloadBox`, `PdfDownloadButton`-tekster)
- `src/contracts/contract-topology.json` + `contractCoverageMatrix.test.ts`

> **Kritisk review-note — listen mangler sandsynlige supportfiler:** Forvent også ændringer i `src/utils/systemIssueReporter.ts` (nyt `document` area eller bevidst legacy), `src/contexts/AppSettingsContext.tsx`/settings-tests, `src/__tests__/quality/appSettingsContractIsolation.test.ts`, `src/contracts/page-component-contract.md`, `src/contracts/error-debug-contract.md` og muligvis `docs/architecture/pdf-architecture.md` hvis PDF-kontrakten henviser til nyt dokumentlag.
>
> >> **Svar (enig — verificeret at alle seks findes):** Alle seks filer eksisterer, og din liste er korrekt. Konkret pr. fil: `systemIssueReporter.ts` → `SystemIssueArea` udvides med `'document'` (jf. min fejlområde-note); `AppSettingsContext.tsx` → ingen logikændring nødvendig (`updateSettings` er generisk over `Partial<AppSettings>`), men dens settings-tests rører det nye felt; `appSettingsContractIsolation.test.ts` → skal udvides så den hævder, at `documentDownloadFormat` (som al anden settings) **ikke** lækker til `.eo` — det er præcis den isolation, denne test bevogter; `page-component-contract.md` + `error-debug-contract.md` → opdateres i kontrakt-trinnet (Stadie 6); `docs/architecture/pdf-architecture.md` → informativ doc, opdateres hvis den henviser til det gamle ene-PDF-billede. Jeg tilføjer disse til fillisten i Stadie 0. Godt fanget — fillisten var ufuldstændig.



---

## Testplan

- **Filnavn:** `resolveDocumentFileName` — alle eksisterende `pdfFilenameBuilders`-cases + `.docx`-varianter (journalnr-præfiks, `(udkast)`, sanitering).
- **Config/styles/properties:** Word-styles-sæt komplet; core-properties centralt (author/subject/creator ens, kun titel varierer).
- **DocxWriter:** producerer gyldigt `docx.Document`; hver write-metode mapper til korrekt style; brevhoved kun ved `visBrevhoved`; tabel-mapping.
- **Service-routing (kritisk):** korrekt backend pr. `documentDownloadFormat`; **gate-invariant** — Word blokeres præcis når PDF blokeres (genbrug af snapshot/preflight); runtime-fejl routes via `error-debug`-kontrakten som PDF i dag.
- **Settings:** parse/merge med nyt top-level felt; ukendt/invalid værdi → default `'pdf'`; `.eo`-save/load **upåvirket** (settings er device-lokale, må ikke lække til `.eo` — eksplicit assertion).
- **Refaktorerings-invariant:** for hver migreret generator skal PDF-output være uændret (snapshot/struktur-assertion), så `DocumentWriter`-abstraktionen ikke regredierer eksisterende PDF'er.
- **Docx-serialisering:** unzip `.docx` og assert på faktisk XML-indhold for tekst, styles, properties, footer og relationer; test må ikke nøjes med mocks af `docx`-bibliotekets constructors.
- **Format-paritet:** for hver dokumenttype udtrækkes et minimalt semantisk tekstindeks fra PDF-testmodellen og Word-XML. Assert at centrale labels/værdier forekommer i begge output. Formålet er ikke pixel-paritet, men at Word ikke taber indhold.
- **Runtime-fejl:** Word-generation-fejl routes via samme systemfejlkanal som PDF, med korrekt area/code og brugervendt fejltekst. DEV dynamic-import-fejl skal have samme eller bevidst dokumenteret bedre adfærd end PDF.
- **Knap-/tekst-audit:** quality test eller målrettet `rg`-baseret test for brugervendte hardcodede "PDF"-tekster i download-komponenter efter migration, med whitelist for tekniske kontrakter og PDF-specifik kode.
- **Statisk numerik:** Word-output må kun indeholde færdigformaterede, statiske tal/beløb/procenter fra samme godkendte model som PDF. Der må ikke indsættes Word-felter, formler eller automatiske beregninger i dokumentet, fordi Word-recalculation kunne skabe tal der ikke er produceret af Mineo.
- **Ingen eksterne relationer:** `.docx`-pakken må ikke indeholde remote templates, eksterne billeder, font-links, hyperlinks til runtime-data eller andre relationer der kan sende data ud af browseren ved åbning. Eventuelle links der allerede er eksplicit brugerrettet indhold skal være statiske og ikke indeholde sagsdata.

---

## Risici og afgrænsninger

- **Word ≠ PDF pixel-for-pixel.** Bekræftet og ønsket: samme indhold, Word-native look. Sidebrydning, fontmetrik og vandmærke håndteres Word-native; identisk geometri er ikke et mål.
- **Vandmærke (UDKAST).** PDF tegner et roteret canvas-billede pr. side. Word-pendant (bekræftet valg): et **ægte Word-vandmærke** — diagonalt, gråt "UDKAST" bag teksten på hver side, via header-baseret tegning. Styret af samme `visUdkastStempel`-flag som PDF. Ikke beregningskritisk, men trust-relevant (et udkast må ikke kunne forveksles med et endeligt dokument), så markeringen skal være lige så tydelig som PDF'ens.
- **Bundle.** `docx` er en ny dependency; lazy-loadet i egen chunk, så opstart upåvirket. Begrundes i commit jf. AGENTS.md (ingen eksisterende dependency kan generere `.docx`).
- **Beregningslogik røres ikke.** Word læser samme godkendte model som PDF. Ingen tal eller regler ændres — kun præsentation/output. (Beregningsændringer ville kræve godkendelse; denne plan indeholder ingen.)
- **Refaktorering af generatorer er breaking internt, ikke for brugeren.** PDF-output skal forblive uændret gennem hele migrationen; verificeres pr. generator.
- **Stadie 0 kan justere strukturen.** Den endelige placering (`src/document/domains/` vs. `src/pdf/domains/` + adaptere) afgøres af auditen og opdateres i denne plan før Stadie 5.
- **Word-output kan se korrekt ud men mangle metadata/styles.** `.docx` er en ZIP med flere XML-dele; visuel manuel åbning i Word er ikke nok. Tests skal kontrollere core-properties, styles og footer-relationer direkte.
- **Skjult indholdstab er den største risiko.** Fordi Word ikke er pixel-paritet, kan en manglende række/sektion være sværere at opdage visuelt. Derfor skal hver generator have semantiske indholdsassertions for de data, der gør dokumentet trust-kritisk.
- **AppSettings-kobling kan blive værre.** PDF-laget har allerede erkendt teknisk gæld omkring direkte `AppSettings`-kobling. Word må ikke importere `AppSettings` dybt i writer/shared-lag; mapping fra settings til dokument-options skal ske ved service-/callsite-grænsen eller i en kortlivet legacy-adapter.
- **Brugerens Word-redigering ændrer ikke Mineo-data.** `.docx` er kun et downloadet output, ikke et importformat. Planen skal ikke åbne for Word→Mineo-import, synkronisering eller parsing; det ville være en ny feature og en stor dataintegritetsrisiko.
- **Word må ikke beregne.** Word-dokumentet er præsentation, ikke beregningsmotor. Alle tabeller og summer skal være statisk tekst fra Mineos beregnings-/præsentationsmodel; ingen Word-formler, feltkoder eller automatisk opdaterbare totaler.
- **OOXML-fallbacks er risikable.** Hvis `docx` ikke understøtter en nødvendig feature via public API, er rå OOXML kun acceptabelt som en isoleret helper uden brugerdata i XML-strenge, med ZIP-test og kort kontrakt-/kodekommentar om hvorfor helperen findes. Rå XML som generel escape-luge er forbudt.
