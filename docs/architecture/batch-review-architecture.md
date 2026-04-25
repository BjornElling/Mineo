# Batch-review arkitektur

> **Formål:** Dette dokument beskriver den ønskede arkitektur og implementeringsplan for `batch-review`, et internt udviklerværktøj der kan generere meget lange PDF-dokumenter til systematisk gennemgang af MinEOs output på tværs af mange fiktive scenarier. Dokumentet er en arbejds- og beslutningsreference for implementeringen. Det er ikke en runtime-kontrakt.

---

## Indholdsfortegnelse

1. [Baggrund og intention](#1-baggrund-og-intention)
2. [Hvad værktøjet skal kunne](#2-hvad-værktøjet-skal-kunne)
3. [Hvad værktøjet ikke skal være](#3-hvad-værktøjet-ikke-skal-være)
4. [Arkitektoniske bindinger fra den eksisterende kodebase](#4-arkitektoniske-bindinger-fra-den-eksisterende-kodebase)
5. [Overordnet løsningsvalg](#5-overordnet-løsningsvalg)
6. [Foreslået systemarkitektur](#6-foreslået-systemarkitektur)
7. [Scenariemodellen](#7-scenariemodellen)
8. [Batch-review for produktionsoutput](#8-batch-review-for-produktionsoutput)
9. [Batch-review for fejl og advarsler](#9-batch-review-for-fejl-og-advarsler)
10. [Ydelse, chunking og browserhensyn](#10-ydelse-chunking-og-browserhensyn)
11. [Placering i UI](#11-placering-i-ui)
12. [Faseopdelt implementeringsplan](#12-faseopdelt-implementeringsplan)
13. [Teststrategi](#13-teststrategi)
14. [Risici og bevidste fravalg](#14-risici-og-bevidste-fravalg)
15. [Anbefalet første leverance](#15-anbefalet-første-leverance)
16. [Åbne afklaringer før kodning](#16-åbne-afklaringer-før-kodning)

---

## 1. Baggrund og intention

Der er et behov for et internt udviklerværktøj, som kan bruges til systematisk kvalitetsgennemgang af MinEOs brugerrettede output på tværs af meget mange scenarier uden manuel indtastning.

Behovet dækker to beslægtede, men teknisk forskellige anvendelser:

1. Gennemgang af PDF-output for en afgrænset funktionalitet.
2. Gennemgang af de fejl- og advarselsmeddelelser, brugeren kan blive præsenteret for.

Den centrale intention er ikke at bygge et brugerværktøj, men et udviklerredskab, som kan:

- generere et meget stort antal scenarier hurtigt
- samle output i ét langt PDF-dokument
- vise præcis hvilke testforudsætninger der ligger bag hver side
- genbruge den eksisterende autoritative logik 1:1
- gøre det muligt at gennemlæse mange hundrede eller tusinde scenarier i et samlet dokument

`Batch-review` skal forstås meget snævert som en simulering af brugerens oplevelse på downloadtidspunktet:

- enten det PDF-dokument brugeren faktisk ville kunne downloade
- eller den fejl-/advarselsboks brugeren faktisk ville se på downloadsiden i samme situation

Alt hvad der vises på indtastningssider, hjælpesider eller debug-sider er uden betydning for `batch-review`, medmindre det direkte materialiseres i en af disse to brugeroplevelser.

Det ønskede værktøj skal derfor vurderes som en tværgående udviklerinfrastruktur, ikke som en lokal EO-feature.

---

## 2. Hvad værktøjet skal kunne

Værktøjet skal bestå af to nært beslægtede spor.

### 2.1 Batch-review for produktionsoutput

Dette spor skal kunne:

- generere mange fiktive committed datasæt
- køre dem gennem samme snapshot-, projektion- og PDF-logik som produktionsflowet bruger
- danne ét samlet PDF-dokument, hvor hvert scenarie får sin egen side eller sine egne sider
- begrænse output til den eller de relevante delsektioner, der ønskes gennemgået
- skrive scenarieparametre og testforudsætninger synligt på hver side
- afspejle nøjagtig det PDF-dokument brugeren ville have fået ved download af samme data

Eksempel:

- gennemgå SFGG i EO
- generere et stort antal variationer
- få ét samlet PDF-dokument, hvor hver side viser SFGG-output for ét scenarie

### 2.2 Batch-review for fejl og advarsler

Dette spor skal kunne:

- generere mange fiktive committed datasæt, som bevidst er mangelfulde, inkonsistente eller regelstridige
- materialisere den samme autoritative fejl-/advarselslogik, som bruges i den relevante side
- samle fejl- og advarselsoutput i ét langt PDF-dokument
- gøre det muligt at gennemgå mange forskellige fejlmeddelelser og advarsler i sammenhæng
- vise scenarieparametre og den præcise fejlopsætning på hver side
- afspejle nøjagtig den fejl-/advarselsboks brugeren ville se på downloadsiden i samme situation

### 2.3 Fælles krav for begge spor

Begge spor skal:

- være client-side og må ikke sende data ud af browseren
- være tydeligt markeret som udviklerværktøj
- kunne udvides til flere domæner over tid
- være hurtige nok til reelt at være brugbare ved store kørsler
- bruge samme autoritative runtime-logik som produktionen
- ikke være afhængige af manuel UI-manipulation felt for felt
- være gensidigt adskilte funktionaliteter, hvor brugeren vælger den ene eller den anden visning

---

## 3. Hvad værktøjet ikke skal være

Følgende er eksplicit fravalgt:

### 3.1 Ikke UI-automation

Værktøjet skal ikke simulere brugerindtastning i felter ét ad gangen og derefter trykke på download én PDF ad gangen.

Det fravælges fordi:

- det vil være for langsomt
- det vil være for skrøbeligt
- det vil koble værktøjet til DOM- og fokusadfærd i stedet for committed domænedata
- det vil være et ringere match til MinEOs arkitektur, hvor committed state og snapshot-lag er de autoritative lag

### 3.2 Ikke screenshots af UI-bokse

Fejl- og advarselsoutput skal ikke dannes som screenshots eller browser-print af DOM.

Det fravælges fordi:

- det ville koble værktøjet til præsentationsdetaljer i React-komponenter
- det ville være vanskeligere at holde 1:1 med den autoritative fejlmodel
- det ville være langsommere og mindre robust

### 3.3 Ikke et separat parallelunivers af beregningslogik

Værktøjet må ikke implementere sine egne "testversioner" af PDF-logik eller fejlberegning.

Det skal i stedet genbruge:

- snapshot-logik
- projections
- debug-/fejlaggregatorer
- render-logik

### 3.4 Ikke en gengivelse af input- eller debug-sider

`Batch-review` må ikke have som formål at vise:

- indtastningssider
- inputfelter
- debug-sider
- tekniske mellemresultater, som brugeren ikke ser i downloadoplevelsen

Hvis en oplysning ikke indgår i det faktiske downloadede PDF-dokument eller i fejl-/advarselsboksen på downloadsiden, er den uden for scope for `batch-review`.

---

## 4. Arkitektoniske bindinger fra den eksisterende kodebase

Værktøjet skal tilpasses eksisterende arkitektur og må ikke bygges som et uafhængigt sideprojekt inde i repoet.

### 4.1 PDF-sporet

MinEO har allerede et tydeligt PDF-lag beskrevet i [pdf-architecture.md](./pdf-architecture.md).

Særligt relevante eksisterende byggesten er:

- [pdfWriter.ts](c:/Users/bjell/MinEO/src/utils/pdf/pdfWriter.ts)
- [pdfService.ts](c:/Users/bjell/MinEO/src/utils/pdf/pdfService.ts)
- [erstatningsopgoerelsePdf.ts](c:/Users/bjell/MinEO/src/utils/pdf/erstatningsopgoerelsePdf.ts)
- [tafFordeltPaaAarPdf.ts](c:/Users/bjell/MinEO/src/utils/pdf/tafFordeltPaaAarPdf.ts)
- [eoSnapshot.ts](c:/Users/bjell/MinEO/src/domain/erstatningsopgoerelse/eoSnapshot.ts)
- [eoSnapshotToEoPdfDocument.ts](c:/Users/bjell/MinEO/src/domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument.ts)
- [eoSnapshotToTafPerYearPdfDocument.ts](c:/Users/bjell/MinEO/src/domain/erstatningsopgoerelse/eoSnapshotToTafPerYearPdfDocument.ts)

Den eksisterende arkitektur har allerede den rigtige grundidé:

- committed input
- snapshot
- projektion
- renderer

Det nye værktøj skal lægge sig oven på denne struktur.

### 4.2 Debug- og fejllogik

MinEO har også et tydeligt debug-/fejlspor beskrevet i:

- [error-debug-contract.md](c:/Users/bjell/MinEO/src/contracts/error-debug-contract.md)
- [debug-builder-architecture.md](./debug-builder-architecture.md)

Særligt relevante eksisterende byggesten er:

- [eoDebugBuilderRegistry.ts](c:/Users/bjell/MinEO/src/domain/debug/eoDebugBuilderRegistry.ts)
- [eoDebugRowAggregator.ts](c:/Users/bjell/MinEO/src/domain/debug/eoDebugRowAggregator.ts)
- [eoSnapshotToDebugView.ts](c:/Users/bjell/MinEO/src/domain/erstatningsopgoerelse/eoSnapshotToDebugView.ts)
- [EOberegningTab.tsx](c:/Users/bjell/MinEO/src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx)
- [EODebug.tsx](c:/Users/bjell/MinEO/src/components/pages/erstatningsopgoerelse/EODebug.tsx)

Det betyder:

- fejl og advarsler findes allerede som data
- de er ikke kun et UI-fænomen
- der findes allerede central aggregering for "Fejl og advarsler"-boksen

Det nye værktøj skal genbruge denne model i det omfang den materialiserer den faktiske fejl-/advarselsboks på downloadsiden. Debug-siden som selvstændig udviklervisning er ikke et outputmål for `batch-review`.

### 4.3 Placering i UI

Den foreslåede placering på test-fanen under Stamdata er arkitektonisk rimelig, fordi:

- værktøjet er udviklerorienteret
- det er ikke et selvstændigt fagdomæne
- der findes allerede en skjult udviklerflade via [src/components/pages/Stamdata.tsx](c:/Users/bjell/MinEO/src/components/pages/Stamdata.tsx) og [src/components/pages/Test.tsx](c:/Users/bjell/MinEO/src/components/pages/Test.tsx)

Værktøjet bør dog stadig have sin egen strukturerede delsektion og ikke blandes sammen med de eksisterende små testknapper.

---

## 5. Overordnet løsningsvalg

Den anbefalede løsning er:

- ét fælles batch-scenariesystem
- ét fælles batch-review-orchestrator-lag
- domænespecifikke adapters for hver funktionalitet
- to adskilte outputfunktionaliteter oven på samme batch-review-infrastruktur

Det giver denne struktur:

```text
Scenarie-definitioner
  ↓
Scenarie-expansion / combinatorik
  ↓
Domæne-adapter
  ↓
Autoritativ produktionlogik
  ↓
Batch-renderer
  ↓
Ét samlet PDF-dokument
```

Dette er bedre end at bygge to helt separate værktøjer, fordi de to spor deler:

- orchestrering
- batch-review-pdf-rendering
- chunking/progress
- UI til valg og start af eksport

De to spor skal derimod ikke tvinges til at dele samme fiktive datasæt. De må og bør have hver deres scenariesæt, fordi de tester to forskellige brugeroplevelser og to forskellige former for output.

---

## 6. Foreslået systemarkitektur

Den anbefalede placering er et nyt udviklerorienteret modul, fx:

```text
src/devtools/batchReview/
  adapters/
  scenarios/
  renderers/
  types/
  ui/
```

Navngivningen kan justeres, men pointen er:

- det er udviklerinfrastruktur
- det er tværgående
- det skal ikke bo inde i ét specifikt domænemodul
- mappenavnet bør være neutralt nok til at dække både produktions-PDF og issues-sporet

### 6.1 Lagdeling

#### Lag 1: Scenario definition

Ansvar:

- definere base cases pr. emne
- definere variationsdimensioner pr. emne
- definere filtreringsregler for ugyldige eller irrelevante kombinationer
- definere metadata til visning
- holde scenariesæt adskilt pr. funktionalitet

#### Lag 2: Scenario expansion

Ansvar:

- tage base case + dimensioner
- generere konkrete scenarier
- sikre stabile scenarie-id'er
- begrænse eller sortere scenario-mængden

#### Lag 3: Domain adapter

Ansvar:

- oversætte et generisk scenarie til committed input for et konkret domæne
- kalde autoritativ snapshot-/projection-/debug-logik
- returnere et render-klar resultat

#### Lag 4: Batch renderer

Ansvar:

- oprette ét samlet PDF-dokument
- tilføje forside og indholdssektioner efter behov
- renderere scenariehoved på hver side
- kalde domænespecifik render-funktion for selve indholdet

#### Lag 5: Dev UI

Ansvar:

- valg mellem de to batch-review-funktionaliteter
- valg af domæne/funktionalitet
- valg af scenariesæt/profil
- evt. valg af maks. antal scenarier
- visning af progress og stopstatus

---

## 7. Scenariemodellen

En central designbeslutning er, at scenarier ikke skal skrives fra bunden som fulde store objekter for hver variant.

Det vil være for tungt at vedligeholde og for svært at udvide.

I stedet skal scenarier bygges af:

- et eller flere base cases
- et sæt dimensionsvariationer
- filtreringsregler
- en deterministisk combine-funktion

Scenarier skal organiseres pr.:

- funktionalitet i programmet
- outputtype i `batch-review`

Det betyder konkret, at PDF-review-scenarier og issues-review-scenarier ikke skal ligge blandet sammen som ét fælles stort datasæt.

### 7.1 Foreslået struktur

Hvert konkret scenarie bør mindst have:

```ts
type BatchScenario<TInput> = {
  id: string;
  title: string;
  description?: string;
  tags: readonly string[];
  input: TInput;
  parameterSummary: readonly { label: string; value: string }[];
};
```

Den konkrete struktur må gerne udvides med emnespecifik metadata, men id, titel og parameteroversigt er minimumskrav.

### 7.2 Base cases

En base case er en relativt normal og komplet standardsituation, fx:

- typisk SFGG med overenskomst
- typisk manuel SFGG
- typisk ugyldig referenceperiode

### 7.3 Variationsdimensioner

En dimensionsvariation er en afgrænset ændring, fx:

- skadetype
- første/ikke første EO
- beregningskilde
- overenskomsttype
- referenceperiodeform
- allerede betalt beløb
- TAF-opsætning

### 7.4 Filtrering

Efter kombinering skal der være et eksplicit filterlag, som:

- fjerner kombinationer der er meningsløse
- fjerner kombinationer der er rene dubletter
- begrænser eksplosion i antal scenarier

Dette er afgørende. Ufiltreret cartesisk produkt vil hurtigt blive ubrugeligt stort.

### 7.5 Datasæt skal holdes adskilt

Fiktive datasæt bør ikke samles i én stor fælles fil.

De bør i stedet organiseres i særskilte filer eller mapper pr.:

- emne i programmet
- outputtype

Eksempler på ønsket struktur:

```text
src/devtools/batchReview/scenarios/
  eo/
    sfgg/
      pdf/
      issues/
    taf/
      pdf/
      issues/
  eet/
    loebendeYdelser/
      pdf/
      issues/
```

Inden for hvert emne bør filer navngives grundigt og beskrive, hvilke edge cases eller problemtyper de dækker.

### 7.6 Scenariehoved på hver side

Hver side i batch-dokumentet skal som minimum vise:

- scenarie-id
- titel
- tags
- kort parameterliste

Det er et hårdt krav, fordi dokumentet ellers ikke er praktisk anvendeligt som gennemgangsværktøj.

---

## 8. Batch-review for produktionsoutput

Dette spor skal genbruge den normale produktionspipeline så langt som muligt og må kun vise det dokument, brugeren faktisk ville kunne downloade.

### 8.1 Autoritativ kæde

For EO skal kæden være:

```text
Committed input
  ↓
computeEoSnapshot(...)
  ↓
eoSnapshotToEoPdfDocument(...)
  ↓
PDF-renderer
```

Snapshot-laget er allerede det rigtige batch-punkt i den eksisterende arkitektur, fordi `computeEoSnapshot(...)` allerede bruges i rene datakontekster uden UI-afhængighed. Batchværktøjet skal derfor bruge det eksisterende snapshot som batch-enhed og ikke opfinde et særskilt "batch snapshot".

For deldokumenter gælder samme princip:

- brug den samme projection som produktionen bruger
- brug den samme sektionsrenderer eller samme underliggende render-logik

### 8.2 Behov for mindre PDF-refaktorering

De nuværende generatorer er primært skrevet som "render og gem"-funktioner.

For at kunne bygge ét samlet batch-dokument bør de vigtigste generatorer deles i to:

1. en render-funktion, som skriver ind i en eksisterende `PdfWriter`
2. en wrapper, som opretter writer og kalder `save()`

Eksempel på ønsket mønster:

```ts
renderErstatningsopgoerelsePdfDocument(writer, document, options)
generateErstatningsopgoerelsePdf(...)
```

Det gør det muligt at:

- bevare produktions-API'en
- genbruge den samme render-logik i batch-review

Det skal præciseres eksplicit, at `writer.save()` er batchforløbets afsluttende sideeffekt og kun må kaldes én gang pr. batch-dokument.

Det ønskede mønster er derfor:

```text
opret én writer
for hvert scenarie:
  skriv scenariehoved
  render sektion eller dokument ind i samme writer
til sidst:
  kald writer.save(...) én gang
```

Det er ikke tilstrækkeligt at kalde de eksisterende `generate*Pdf(...)`-funktioner i en løkke, fordi de i deres nuværende form opretter deres egen writer og afslutter med selvstændig download.

### 8.3 Afgrænsning til delsektioner

Værktøjet skal ikke nødvendigvis altid generere hele PDF'en.

Det skal kunne begrænses til:

- en bestemt underside i PDF'en
- en bestemt funktionalitet
- et bestemt bilag eller delafsnit

Det betyder, at batchsporet skal bygges omkring renderbare sektioner eller delprojektioner og ikke kun omkring hele dokumenter.

---

## 9. Batch-review for fejl og advarsler

Dette spor skal ikke gengive "hele debug-siden". Det skal gengive den fejl-/advarselsboks, som brugeren faktisk ville se på downloadsiden, i en samlet, læsbar form.

### 9.1 Autoritativ kilde

For EO er den naturlige autoritative kilde til boksen "Fejl og advarsler":

- `collectAllDebugRows(...)`
- snapshot-baserede blokeringer/projections, som [EOberegningTab](c:/Users/bjell/MinEO/src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx) allerede sammensætter

Derfor bør batch-værktøjet for EO have en ren domain-funktion, som returnerer:

- systemfejl-rækker
- error-rækker
- warning-rækker
- evt. downloadblokeringstekster

samlet som en viewmodel, der kan bruges både af:

- React-boksen i `EOberegningTab`
- batch-review-rendereren

Denne viewmodel findes ikke som selvstændig, kanonisk domain-funktion i dag. Den nuværende sammensætning af den brugervendte fejl- og advarselsboks ligger i praksis i React-komponenten. Derfor er dette punkt en reel refaktorering, ikke blot en mekanisk udtrækning.

### 9.2 Hvorfor en fælles viewmodel er vigtig

Hvis batch-review bygger sine egne fejltekster, opstår der risiko for divergens.

Det skal undgås ved at gøre den eksisterende fejlboks mere eksplicit som data:

- samme input
- samme sortering
- samme suppression-regler
- samme beskeder

Hvis denne refaktorering endnu ikke er gennemført, kan første version midlertidigt bygges oven på `collectAllDebugRows(...)` og de eksisterende snapshot-projections, men dette skal i så fald betragtes som en bevidst approksimation og ikke som den endelige parity-løsning.

### 9.3 Outputformat

Hver scenarieside i issues-PDF’en bør vise:

- scenariehoved
- om scenariet var tænkt som error/warning/blokering
- alle relevante fejl og advarsler grupperet
- evt. supplerende noter om hvorfor scenariet findes

Det er ikke nødvendigt at efterligne React-boksens layout pixel for pixel. Det afgørende er indholdsmæssig og logisk parity.

---

## 10. Ydelse, chunking og browserhensyn

Værktøjet er 100 % client-side og må derfor designes med browserens begrænsninger for øje.

### 10.1 Mål

Målet er ikke reel parallel beregning i browseren på tværs af mange workers fra dag 1.

Målet er først:

- at undgå UI-automation
- at holde hele flowet i data- og renderlaget
- at behandle scenarier i kontrollerede batches

### 10.2 Chunking

Scenarier bør behandles i chunks, fx:

- generér 10-50 scenarier
- render dem
- yield tilbage til event loop
- fortsæt næste chunk

Det giver:

- bedre responsivitet
- mulighed for progress-indikator
- mulighed for afbrydelse

Chunking skal ske omkring scenariegenerering og scenariebehandling, ikke omkring selvstændige dokumentdownloads. Den eksisterende writer-instans skal leve på tværs af alle chunks frem til det afsluttende `save()`-kald.

### 10.3 Én writer, mange sider

Ydelsesgevinsten kommer primært fra:

- én writer
- ét samlet dokument
- ét samlet save-kald

ikke fra pseudo-parallel DOM-automation.

Det korrekte mønster er derfor:

```text
opret writer
for hver chunk:
  generér scenarier i data-laget
  render dem ind i samme writer
  yield til event loop
til sidst:
  save det samlede dokument
```

### 10.4 Hårde grænser

Der bør være værn mod ekstreme kørsler:

- estimeret antal scenarier
- estimeret sidetal
- advarsel ved meget store kørsler
- mulighed for at stoppe processen

Et 1000+-siders dokument er acceptabelt som mål. Ukontrolleret hukommelsesvækst er det ikke.

---

## 11. Placering i UI

Den anbefalede placering er fortsat test-fanen under Stamdata.

### 11.1 Hvorfor denne placering er god

- den er tydeligt udviklerorienteret
- den ligger uden for de almindelige brugerflows
- den kræver ikke ny route eller ny top-level side

### 11.2 Hvordan den bør struktureres

Der bør oprettes en særskilt sektion i [src/components/pages/Test.tsx](c:/Users/bjell/MinEO/src/components/pages/Test.tsx), fx:

- "Batch-review"

med mindst følgende kontroller:

- outputtype
  - PDF-dokument
  - Fejl og advarsler
- domæne/funktion
  - fx EO / SFGG
- scenariesæt
  - basis
  - udvidet
  - alle
- maks. scenarier
- start-knap

sekundært:

- progress
- stop-knap
- resume er ikke nødvendigt i første version

Der skal kun kunne vælges én outputtype ad gangen. Det vil ikke være relevant at vise PDF-output og fejl/advarsler samtidigt.

---

## 12. Faseopdelt implementeringsplan

### Fase 1: Dokumentation og afgrænsning

Formål:

- fastlægge arkitekturen
- undgå at første implementation bliver et ad hoc-værktøj

Leverancer:

- dette dokument
- navngivning og mappeplacering fastlagt
- scope for første domæne fastlagt

### Fase 2: Grundlæggende batch-infrastruktur

Formål:

- etablere det generiske batchspor

Leverancer:

- fælles scenarietyper
- scenario-expander
- chunked batch-runner
- fælles `batch-review-pdf`-writer wrapper
- metadata-rendering til scenariehoved
- struktur for separate scenariesæt pr. emne og pr. outputtype

Teknisk note:

Det er i denne fase, de generiske typer og interfaces bør fastlægges, før konkrete domæneimplementeringer bygges.

### Fase 3: EO som første adapter for produktionsoutput

Formål:

- implementere den første rigtige anvendelse på EO

Leverancer:

- EO batch-adapter for produktionsoutput
- første scenariesæt med fokus på SFGG

Scenarierne bør i første omgang organiseres i særskilte filer, fx:

- base cases
- dimensioner
- kombinationsregler
- adskilt fra issues-scenarier for samme emne

### Fase 4: PDF-render refaktorering

Formål:

- muliggøre genbrug af eksisterende PDF-rendering i et fælles batch-dokument

Leverancer:

- rendermetoder udskilt fra `save()`-wrappers
- EO-delsektioner gjort batch-egnede
- ingen ændring i brugerflow eller produktionsoutput
- én writer-instans kan genbruges på tværs af mange scenarier uden at nogen sektionsrenderer selv kalder `save()`

Denne fase er central, fordi batch-review ellers ender med at få sin egen parallelle renderkode.

### Fase 5: Fælles issues-viewmodel for EO

Formål:

- sikre parity mellem den eksisterende fejlboks og batch issues-PDF

Leverancer:

- ren domain-funktion for EO's fejl/advarselsboks
- React-komponenten og batch-review-renderingen læser fra samme viewmodel
- parity-tests som viser, at udtrækningen ikke ændrer den eksisterende brugeroplevelse

Teknisk note:

Dette er en reel refaktorering af `EOberegningTab`-logikken og ikke en simpel udtrækning. Først når denne fase er gennemført, findes der en fuldt kanonisk issues-viewmodel, som batch-review issues-renderingen kan bruge 1:1.

Denne fase bør ske, før issues-PDF’en færdiggøres.

### Fase 6: EO issues-adapter

Formål:

- færdiggøre EO-sporet for fejl og advarsler på basis af den fælles viewmodel

Leverancer:

- EO batch-adapter for fejl og advarsler
- issues-PDF-rendering for EO
- scenariesæt med bevidst fremprovokerede fejl og advarsler
- særskilt scenariestruktur for EO issues, uafhængigt af EO PDF-scenarier

### Fase 7: UI på test-fanen

Formål:

- gøre værktøjet tilgængeligt for udviklingsbrug

Leverancer:

- ny sektion i `Test.tsx`
- valgfelter
- start-/stop-flow
- enkel progress-visning

### Fase 8: Test og hardening

Formål:

- sikre at værktøjet er robust og reelt kan bruges

Leverancer:

- unit tests for scenario-expansion
- parity tests mellem normal PDF-render og batch-render
- parity tests mellem fejlboks-viewmodel og issues-PDF-viewmodel
- typecheck

### Fase 9: Udvidelse til flere domæner

Formål:

- gøre infrastrukturen bredt anvendelig

Mulige næste domæner:

- EO øvrige delsektioner
- EET-PDF’er
- andre sider med "Fejl og advarsler"-bokse

---

## 13. Teststrategi

Da dette er et tillidskritisk værktøj for gennemgang af output, skal det testes som infrastruktur, ikke som pynt.

### 13.1 Scenariesystem

Der skal testes:

- at expansion er deterministisk
- at id'er er stabile
- at filtrering virker
- at parameteroversigter svarer til det konkrete input

### 13.2 PDF-parity

Der skal testes:

- at batch-render og normal render bruger samme underliggende render-logik
- at delsektioner ikke ændrer indhold ved batch-kørsel
- at scenariehoved kun tilføjer metadata og ikke ændrer det egentlige output

### 13.3 Issues-parity

Der skal testes:

- at batch issues-sporet giver samme fejl/advarsler som den almindelige fejlboks
- at sortering og suppression er ens
- at blokerende og ikke-blokerende tilstande gengives ens
- at issues-scenarier ikke utilsigtet afhænger af PDF-scenarier eller omvendt

### 13.4 Ydelses- og regressionsniveau

Der skal mindst være tests for:

- moderate batchstørrelser
- meget store scenariesæt med begrænsning
- stop-/afbryd-flow, hvis dette implementeres

---

## 14. Risici og bevidste fravalg

### 14.1 Risiko: scenarieeksplosion

Hvis combinatorik ikke begrænses, kan antal scenarier eksplodere.

Afværgning:

- base cases + dimensionsfiltre
- profiler som "basis", "udvidet", "alle"
- hård grænse eller advarsel ved meget store kørsler

### 14.2 Risiko: render-divergens

Hvis batchsporet får sin egen renderkode, opstår divergens.

Afværgning:

- del eksisterende renderfunktioner op
- genbrug samme render-entrypoints

### 14.3 Risiko: fejlboksdivergens

Hvis batch issues-sporet bygger egne fejltekster, opstår divergens.

Afværgning:

- udtræk fælles viewmodel
- brug samme viewmodel i UI og PDF

### 14.4 Risiko: browserfrys og memoryforbrug

Store dokumenter kan belaste browseren.

Afværgning:

- chunking
- progress
- afbrydelse
- estimeret størrelsescheck før start

### 14.5 Bevidst fravalg: web workers i første fase

Web workers kan blive relevante senere, men bør ikke være et krav i første version.

Først skal den rigtige data- og renderarkitektur være på plads.

---

## 15. Anbefalet første leverance

Den anbefalede første leverance er smal, men reel:

### Scope

- placering på test-fanen under Stamdata
- første domæne: EO
- første fokusområde: SFGG
- to outputs:
  - SFGG batch-review-PDF
  - EO fejl/advarsler batch-review-PDF

### Hvorfor dette er den rigtige første leverance

- SFGG har nok variation til at retfærdiggøre værktøjet
- EO har allerede både moden PDF-pipeline og moden debug-/fejlstruktur
- det giver maksimal læring om den tværgående arkitektur
- det begrænser første implementering til et overskueligt og testbart scope

### Konkret forventet resultat

Efter første leverance skal det være muligt at:

- vælge et SFGG-scenariesæt
- generere ét langt PDF-dokument med mange SFGG-sider
- generere ét langt PDF-dokument med mange EO-fejl/advarselssider
- se scenarieparametrene direkte på hver side

---

## 16. Åbne afklaringer før kodning

Følgende bør afklares eksplicit, før implementeringen går i gang:

### 16.1 Hvilke første delsektioner skal understøttes

Anbefaling:

- start med SFGG som første delsektion

### 16.2 Hvor mange scenarieprofiler der skal være i første version

Anbefaling:

- `Basis`
- `Udvidet`
- `Alle`

Profilerne bør kunne variere pr. emne og pr. outputtype. Det er ikke et krav, at PDF-sporet og issues-sporet bruger samme profiler eller samme scenario-mængder.

### 16.3 Om batch issues-PDF skal følge fejlboksen eller debug-siden

Anbefaling:

- følg fejlboksen, ikke debug-siden

Begrundelse:

- det er fejlboksen, som repræsenterer den brugerrettede advarsels-/fejloplevelse
- debug-siden er uden betydning for `batch-review`

### 16.4 Hvor detaljeret scenariehovedet skal være

Anbefaling:

- vis kun de parametre, der faktisk varierer eller er afgørende for scenariet

Dette gør siderne mere læsbare end hvis hele inputobjekter dumpes.

### 16.5 Om der skal være én samlet batchinfrastruktur fra dag 1

Anbefaling:

- ja

Der må gerne implementeres én adapter først, men infrastrukturen bør fra start navngives og struktureres som tværgående.

### 16.6 Hvad scenariehovedet skal vise ud over testparametre

Anbefaling:

- brug et kort, fast scenariehoved som standard
- vis kun scenarie-id, titel, tags og de afgørende varierende parametre
- medtag ikke fuld mini-forside med stamdata som standard, medmindre en konkret delsektion kræver det for at være læsbar

Denne beslutning bør fastholdes tidligt, fordi den påvirker både scenariemodellen og renderer-kontrakten.

---

## Samlet anbefaling

Det rigtige design er `batch-review`, et fælles udviklerværktøj til systematisk scenariegennemgang, som:

- ligger på test-fanen under Stamdata
- genbruger MinEOs eksisterende autoritative snapshot-, download- og fejlbokslogik
- producerer meget lange, samlede PDF-dokumenter
- viser scenarieparametre på hver side
- undgår UI-automation
- lader brugeren vælge mellem præcis to adskilte outputtyper: downloadbart PDF-output eller fejl/advarsler
- holder fiktive datasæt adskilt pr. emne og pr. outputtype
- bygges først for EO/SFGG og derefter udvides

Hvis denne retning følges, bliver værktøjet både hurtigt, auditérbart, udvideligt og praktisk anvendeligt som egentlig udviklerinfrastruktur.
