# Brugerfund der skal rettes

Dette dokument bruges til løbende at registrere brugerfund fra testforløb. Hvert punkt er skrevet som en selvstændig problembeskrivelse, så det kan læses uden yderligere kontekst.

## Punktstruktur

Hvert punkt skal som minimum indeholde:

- Punkt-ID
- Kort titel
- Problem
- Ønsket ændring
- Eventuelle tekniske noter
- Prioritet / status

## Aktuel status pr. 1. august 2026

| Fund | Status | Primært berørte områder |
|---|---|---|
| BF-001 | Implementeret, automatiseret verificeret | EO-input, manuel procentsats, `eo-snapshot-contract.md` |
| BF-002 | Implementeret, automatiseret verificeret | EO-række-evaluering og feltlink |
| BF-003 | Implementeringsplan klar | Fælles input-enheder og tabelafledninger |
| BF-004 | Implementeringsplan klar | Offentlige ydelser-typografi |
| BF-005 | Afventer præcis reproduktion; fundet er fortsat aktuelt | Undo/redo og tabel-placeholderfokus |
| BF-006 | Implementeret, automatiseret verificeret | Rentekravs-rækkemodel, `renteberegning-contract.md` |
| BF-007 | Implementeret, automatiseret verificeret | `StyledDropdown` og offentlige ydelser |
| BF-008 | Implementeringsplan klar | Licensmodalens scroll-container |
| BF-009 | Implementeret, automatiseret verificeret | Årslønsvalidering, `aarsloen-contract.md` |
| BF-010 | Implementeret, automatiseret verificeret | SH-dage-dokument og fælles dansk listeformattering |
| BF-011 | Implementeret, automatiseret verificeret | Forsørgertab-projektion og Stamdata-link |
| BF-012 | Implementeret, automatiseret verificeret | Varige mén-datobounds, `varigemen-contract.md` |
| BF-013 | Fælles klassifikation rettet; afventer præcis reproduktion af eventuelt resterende sted | Feltissues og dokumentgates, `error-contract.md` |
| BF-014 | Implementeringsplan klar | Fælles tooltip-præsentation |
| BF-015 | Implementeret, automatiseret verificeret | Forsørgertab-gate og feltadvarsel |
| BF-016 | Implementeret, automatiseret verificeret | `FieldWarning`, form-/gridskaller og kontrakter |
| BF-017 | Implementeret, automatiseret verificeret | Varige mén-feltadvarsel |
| BF-018 | Implementeringsplan klar | Renteberegningens tillægstidsfelt |
| BF-019 | Implementeret, automatiseret verificeret | EET-feltadvarsler og `eet-snapshot-contract.md` |

Interaktiv browserverifikation kunne ikke udføres, fordi ingen styrbar browser var registreret. De markerede
implementeringer er derfor verificeret med typecheck og automatiserede tests; den afsluttende visuelle gennemgang
skal køres fra ChatGPT-desktopappen.

## Punkt-ID: BF-001

### Kort titel
Regulering af lønindkomst: manuel regulering skal låse dato i samme måde som anvendt regulering

### Problem
Ved regulering af lønindkomst findes der i dag to manuelle reguleringsformer:

1. Manuelt angivet
2. Manuel procentsats

For "Manuelt angivet" er første kolonnerække i den tilhørende tabel låst til datoen for `anvendtRegulering` og er dermed ikke frie at redigere. Det samme mønster skal gælde for "Manuel procentsats".

Derudover skal reglen også finde anvendelse, hvis der ikke benyttes en beregningsperiode, men i stedet en angivet dags-/månedssats. I så fald skal reguleringen blive sat i fanen `eooplysninger` på samme måde.

### Ønsket ændring
Systemet skal sikre, at følgende adfærd er konsistent:

- For "Manuel procentsats" skal første række i den relevante tabel også være låst til `anvendtRegulering`-datoen, ligesom for "Manuelt angivet".
- Den samme låsning / samme datoafhængighed skal gælde i de tilfælde, hvor reguleringen ikke er baseret på en beregningsperiode, men på en angivet dags- eller månedssats.
- I disse tilfælde skal reguleringen registreres i `eooplysninger`-fanen, så den bliver behandlet som en gyldig og synlig regulering i samme sammenhæng som den øvrige lønindkomstregulering.

### Tekniske noter
- Kravet er ikke blot at ændre visning, men at sikre den samme datamodel- og stateflow-semantik som for eksisterende manuel regulering.
- Det bør verificeres, at låsningen af den første kolonnerække og placeringen af reguleringen i `eooplysninger` sker via samme logik/kontrakt som den eksisterende "Manuelt angivet"-støtte.
- Husk at gælde samme regel for begge reguleringstyper, samt for den variant hvor en dags-/månedssats anvendes uden beregningsperiode.

### Status
Korrigeret og implementeret. Begge manuelle reguleringsformer opretter deres programstyrede basisrække
atomisk sammen med valget. Første dato er altid read-only og afledes af `anvendtRegulering`; mangler datoen,
vises en rød ramme med en konkret tooltip. Ved en ny beregning falder `anvendtRegulering` tilbage til
skadedatoen, indtil en mere specifik beregningsperiodeslutdato eventuelt er udfyldt. Samme invariant gælder
under Lønindkomst og ved angivet dags-/månedsløn på EO-oplysninger.
Alle efterfølgende datoer skal nu være strengt senere end den låste dato i første række. En dato før eller lig
basisdatoen markeres rødt med en konkret tooltip og blokerer de afhængige beregninger og dokumenter. Reglen er
fælles for `Manuelt angivet` og `Manuel procentsats`; bevaret input i en inaktiv reguleringsform blokerer ikke.

### Prioritet
Høj

## Punkt-ID: BF-003

### Kort titel
Farveformatering af tekst i tabeller er forkert for placeholder-værdier og beregnede celler

### Problem
I tabellerne vises tekstformateringen ikke konsistent, når brugeren benytter funktionen til at farve-markere tekst.

Eksempler:

- I Indtægtsoplysninger-tabellen er de fleste beløb korrekt lilla, men `kr.` vises orange i kolonner, hvor der bruges placeholder-værdier, mens selve beløbet er lilla.
- I den sidste tomme række, der kun indeholder placeholder-værdier, er `kr.` orange i alle celler.
- I de tre beregnede celler:
  - FP/FV/SH/SO/St.B.
  - Arb.g. Pension
  - Samlet løn
  er beløbet også orange.
- I reguleringstabellen vises mange orange værdier, selv når værdierne ellers bør være formateret som standard-løntabelværdi. Eksempel: når `Lønudvikling beregnes ud fra` er sat til `Manuelt angivet`, er mange værdier i første kolonne orange, og procenttegnet på celler med placeholder-indhold er orange.
- I felterne med:
  - `Satser ved beregningsperiodens udløb (28-02-2025)`
  - `Feriegodtgørelse/-tillæg:`
  - `Fritvalg:`
  - `SH/SO-sats:`
  - `Store Bededagstillæg:`
  - `Arbejdsgivers pensionsbidrag:`
  er placeholder-værdierne også orange, mens `Store Bededagstillæg` ses som grønt.
- Derudover er beløbet for `Store Bededagstillæg` venstre-aligned i stedet for højre-aligned, som det skal være.

### Ønsket ændring
Tekst og værdier i tabellerne skal få en ensartet og korrekt farveformatering:

- Placeholder-værdier skal ikke fremstå med en forkert farvekode i forhold til den øvrige tabelværdi.
- `kr.`-markeringen skal være konsistent med resten af værdien i den pågældende celle.
- De beregnede celler skal følge samme farveformateringsprincipper som øvrige værdier i tabellen.
- Procenttegnet på placeholder-celler skal ikke være orange, hvis den tilhørende værdi ellers er formateret som standard indtastning.
- `Store Bededagstillæg` skal følge samme højrejusteringsmønster som de øvrige beløbskolonner.

### Tekniske noter
- Fejlen ser ud til at være et formaterings-/renderingsproblem i tabelcellernes teksttokens, ikke et beregningsproblem.
- Det er sandsynligt, at placeholder- og beregnede celler bliver behandlet gennem forskellige formateringsstier, hvilket giver uensartet farvekodning.
- `Store Bededagstillæg` bør verificeres både i celleformatteringen og i den generiske højrejustering for beløbskolonner.

### Status
Ikke implementeret; klassificeret som en enkel, tværgående præsentationsrettelse.

### Implementeringsplan
1. Kortlæg farvekilden i `InputUnitAdornment`, de låste reguleringsceller og Standardløntabellens afledte celler.
2. Lad placeholder, enhedssuffiks og afledt værdi arve én semantisk farve fra den fælles felt-/cellestatus i
   stedet for at farves hver for sig.
3. Ret Store Bededagstillæg til samme højrejusterede numeriske layout som de øvrige satsfelter.
4. Tilføj render-tests for placeholder, låst basisrække, afledte beløb og tekstfarveindstillinger.

### Prioritet
Høj

## Punkt-ID: BF-002

### Kort titel
Opsagt fra stillingen uden udfyldt sidste arbejdsdag skal give ikke-blokerende advarsel i beregning med link til Lønindkomst

### Problem
På erstatningsopgørelse-siden kan brugeren vælge "Opsagt fra stillingen". Når denne værdi er sat til `TRUE`, vises en række nedenunder med feltet "Sidste dag i ansættelsesforholdet".

Hvis brugeren har sat "Opsagt fra stillingen" til `true`, men ikke har udfyldt "Sidste dag i ansættelsesforholdet", skal brugeren få en ikke-blokerende advarsel i beregningsfanen.

Advarslen skal være i denne form:

"Det angives, at skadelidte er opsagt, men sidste arbejdsdag er ikke indtastet"

Samtidig skal advarslen indeholde et link, der peger til det relevante felt på Lønindkomst-siden.

### Ønsket ændring
Systemet skal i beregningsfanen vise en ikke-blokerende advarsel, når følgende er opfyldt:

- "Opsagt fra stillingen" er sat til `true`
- "Sidste dag i ansættelsesforholdet" er ikke udfyldt

Advarslen skal fremstå klart og brugervenlig, og linket skal føre brugeren til det relevante felt på Lønindkomst-siden, så den manglende indtastning kan rettet direkte.

### Tekniske noter
- Kravet er ikke en blokering af beregning, men en tydelig ikke-blokerende warning i Beregning-fanen.
- Linket skal navigere til det tilhørende felt på Lønindkomst-siden og ikke kun til den overordnede faneboks.
- Den samme advarsel skal være konsistent med den øvrige EO-warning-struktur, så den bliver vist og linket bliver håndteret gennem den eksisterende navigation-/issue-model.

### Status
Implementeret. Advarslen dannes i EO-række-evalueringen med den aftalte tekst og et strukturelt fokusmål til
`Sidste dag i ansættelsesforholdet` på Lønindkomstfanen.

### Prioritet
Høj

## Punkt-ID: BF-004

### Kort titel
Mistanke om lidt større skriftstørrelse i tabellen med offentlige ydelser

### Problem
Jeg er ikke sikker, men jeg har en mistanke om, at skriftstørrelsen i tabellen med offentlige ydelser er lidt for stor.

Det kan være, at jeg tager fejl, men visuelt ser det ud som om teksten er cirka 1 px større end teksten i tabellen på lønindkomst-fanen. Hvis jeg er i tvivl, så er teksten i lønindkomst-tabellen korrekt.

### Ønsket ændring
Det bør verificeres visuelt, om teksten i tabellen med offentlige ydelser faktisk er lidt større end den korrekte standardstørrelse. Hvis den er det, skal skriftstørrelsen justeres så den matcher den tilsvarende tabel på lønindkomst-fanen.

### Tekniske noter
- Det er en visuel afvigelse, som kan være meget lille og derfor svær at skelne ved første blik.
- Uanset om fejlen er reel eller ej, bør den være tydeligt valideret mod lønindkomst-tabellen som reference.
- Hvis forskellen skyldes tabelspecifik styling, bør den rettes i den konkrete tabelkomponent eller dens shared styling i stedet for via en lokal ad hoc-justering.

### Status
Ikke implementeret; klassificeret som en enkel typografirettelse, der kræver visuel efterprøvning.

### Implementeringsplan
1. Sammenlign den beregnede typografi i `OffentligeYdelserTab` og `OffentligeYdelserTable` med den fælles
   `row--text`-/tabeltypografi.
2. Fjern den lokale 1 px-afvigelse ved at genbruge den fælles token/klasse frem for et side-lokalt tal.
3. Verificér visuelt ved normal zoom og med tekstfarveindstillinger slået til.

### Prioritet
Mellem

## Punkt-ID: BF-005

### Kort titel
Undo af tabelindtastning skal beholde fokus på den påvirkede celle

### Problem
Når jeg undo'er, sådan at den sidste indtastning i en tabel slettes, er der ingen celle, der har fokus længere.

Det er en fejl. Den placering i tabellen, som undo påvirkede, skal fortsat have fokus efter undo-handlingen.

### Ønsket ændring
Efter en undo, der sletter den seneste indtastning i en tabel, skal fokus flyttes tilbage til den relevante celle i den tilsvarende tabelplacering, så brugeren kan fortsætte redigeringen uden at miste konteksten.

### Tekniske noter
- Fejlen er knyttet til fokusforvaltning efter undo, ikke til selve værdiregningen.
- Kravet er, at den samme tabelcelle eller den samme redigeringsposition skal være aktiv efter operationen.
- Det bør verificeres, at fokusgenoprettelsen sker på den præcist relevante celle i stedet for blot at genindstille til en standardplacering.

### Status
Fortsat aktuelt og ikke afvist. Den eksisterende placeholder-/history-infrastruktur og dens integrationstests
bevarer allerede feltadresse og række-id ved promotion → undo, så det konkrete svigt kan ikke lokaliseres sikkert
uden den præcise tabel, celletype og undo-handling. Der skal følges op med en konkret reproduktion, før koden
ændres, så en forkert fokusregel ikke indføres.

### Prioritet
Høj

## Punkt-ID: BF-006

### Kort titel
Renteberegning: dropdown-ændring skaber ekstra tabelrække uden egentlig indtastning

### Problem
På renteberegning-siden tilføjes der lige for nu en ekstra linje i tabellen, hvis blot jeg ændrer dropdown-valget fra defaultværdien (`dage`) til en anden værdi, fx `Uger`.

Det er en fejl. Det skal ikke ske. Kun indtastninger i et af indtastningsfelterne skal medføre, at første række anses for udfyldt.

### Ønsket ændring
Systemet skal kun opfatte den første række som udfyldt, når brugeren faktisk har indtastet en værdi i et af de relevante indtastningsfelter.

En ren ændring af dropdown-valget fra defaultværdi til en anden værdi må ikke skabe en ekstra tabelrække eller blive tolket som en egentlig udfyldning af den første række.

### Tekniske noter
- Fejlen er knyttet til triggerlogikken for, hvornår en ny row anses for etableret.
- Det må verificeres, at det ikke er dropdown-selectionen selv, men kun faktiske feltindtastninger, der lægger grundlaget for første-række-udfyldning.
- Når dette er rettet, bør den samme kontrakt anvendes konsekvent i renteberegningstabellen, så dropdown-værdier ikke kan udløse sideeffekter i form-/table-stateflowet.

### Status
Implementeret. En committed række med kun valgt enhed er fortsat semantisk tom og fungerer selv som tabellens ene
trailing indtastningsrække; enhedsvalget skaber derfor ikke en ekstra synlig række.

### Prioritet
Høj

## Punkt-ID: BF-007

### Kort titel
Offentlige ydelser: dropdown tilbage til `Vælg` kan fremprovokere system-teknisk fejl i tabelkomponenten

### Problem
På offentlige ydelser-siden kan jeg fremprovokere en system-teknisk fejl ved at have udfyldt værdier for en offentlig ydelse og derefter ændre dropdown-valget tilbage til `Vælg`, altså placeholder-værdien.

Fejlen er kritisk og alvorlig. Programmet krash'er med følgende fejl:

`StyledDropdown: option label must be a string/number or provide getOptionLabel(value)`

### Ønsket ændring
Fejlen skal undersøges rodfæst og rettes ved kilden, ikke med en lappeløsning.

Det skal verificeres, hvilken del af data-/state-modellen eller komponentarkitekturen der gør, at en placeholder-værdi (`Vælg`) kan blive en ugyldig dropdown-option i render-træet. Fejlen bør rettes gennem en strukturel og arkitektonisk løsning, så denne fejltype ikke kan opstå igen.

### Tekniske noter
- Fejlen er ikke blot et UIproblem; den er kendt fra en renderer på komponentniveau og peger på et data-/type-/modelproblem omkring dropdown-option-labels.
- Det er vigtigt at undersøge, om dette er et lokalt problem i offentlige ydelser-tabellen eller om fejlen kan opstå andre steder, hvor en dropdown-værdi kan gå tilbage til en placeholder/ikke-godkendt værdi efter at have haft en gyldig værdi.
- Jeg mistænker, at fejlen kan opstå allerede hvis der blot foretages indtastninger i Offentlige Ydelser uden at der er valgt en værdi i dropdown-feltet med Ydelsestype.
- Løsningen bør være en generel retningslinje for dropdown-options og null/placeholder-behandling, så `Vælg`/placeholder værdisæt ikke kan blive en ugyldig option i en komponent, der forudsætter string/number-labels.
- Fejlen bør vurderes som et arkitektonisk gennemstrømningsproblem snarere end som en komponentlokal bug.

### Status
Implementeret i den fælles dropdown. En valgfri canonical værdi, som ikke matcher en aktuel option, vises tomt og
kan ryddes til placeholder uden DEV-crash; kravet om eksplicit label gælder fortsat options, der faktisk findes.

### Prioritet
Kritisk

## Punkt-ID: BF-008

### Kort titel
Om-siden: MIT-licens-overlay viser unødvendig scrollbar

### Problem
På Om-siden, når man trykker på linket med MIT-licensen, og den viser overlayet med teksten, kommer der en scrollbar til højre.

Det er en fejl. Der skal ikke være nogen scrollbar i overlayet. Indholdet skal automatisk ombryde inde i overlayet.

### Ønsket ændring
Overlayet med MIT-licens-teksten skal kunne vise hele teksten uden at genere en lodret scrollbar.

Teksten skal i stedet ombryde automatisk inden for overlayets bredde, så den vises fuldt og korrekt uden behov for horizontal eller vertikal scrolling.

### Tekniske noter
- Fejlen ser ud til at være et layout-/containerproblem i overlayet eller i den måde teksten renderes i det.
- Det bør verificeres, om tekstområdet har en fast bredde eller en container, der forhindrer naturlig wrapping.
- Løsningen bør være konsekvent med den generelle overlay-/dialogpraksis i appen, så dette ikke bliver en one-off i licensvisningen.

### Status
Ikke implementeret; klassificeret som en enkel modal-layoutrettelse.

### Implementeringsplan
1. Flyt vertikal scrolling til licenstekstens indre content-container i `LicenseModal`.
2. Hold modalramme, titel og lukknap faste, og giv kun tekstområdet den beregnede resterende højde.
3. Tilføj en layouttest for, at scrollbarens scroll-ejer er tekstcontaineren, og verificér visuelt ved lav højde.

### Prioritet
Mellem
## Punkt-ID: BF-015

### Kort titel
Forsørgertab: download-blokering skal følge klare, målrettede regler og ikke vise inline-fejl som generiske blocker

### Problem
Download-blokeringen af forsørgertab skal ændres.

Det skal være følgende blokeringer:

1. Hvis der hverken er indtastet en værdi i et felt under ASL-ydelse eller EAL-ydelse, skal download være blokeret. Meddelelsen skal være generisk: `Indtastning mangler`.
2. Hvis brugeren har indtastet en værdi i blot ét af felterne under ASL-ydelse, skal de alle være udfyldt. Ellers skal download være blokeret.
3. Hvis brugeren har indtastet en fejlbehæftet værdi i en hvilken som helst boks på siden, skal download være blokeret. Det gælder fx også, hvis der er indtastet en fejlbehæftet værdi i EAL-ydelse, selv om alle værdier under ASL-ydelse er indtastet korrekt, så ASL-ydelsen ville kunne beregnes korrekt.
4. Forudsat at beregningsdato og skadelidtes fødselsdato er nødvendige for at lave beregningen, skal begge være udfyldt, ellers skal download være blokeret.

Derudover skal advarsler ikke vises som inline-meddelelser i den konkrete contentbox. Et eksempel er teksten `Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.`

Det skal i stedet vises som en gul ring på det relevante felt, og selve teksten skal vises i en tooltip i samme felt.

Inline-adfærd for advarsler er uønsket og skal erstattes af denne struktur. Eventuelle inline-fejlbeskeder skal derimod give en rød ring på feltet og vises som tooltip.

Der skal derfor ske en generel revisitation af, hvordan advarsler og fejl skal vises i programmet: advarsler bruges som informerende, aldrig blokerende, og vises altid med gul ring på feltet og tooltip; fejl vises med rød ring på feltet og tooltip og kan have blokeringseffekt.

Under EAL-ydelse skal teksten `Skadelidtes årsløn (efter EAL)` ændres til `Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)`.

### Ønsket ændring
Systemet skal implementere en tydelig og konsistent download-blokering for forsørgertab med disse fire regler:

- mangel på input i begge ydelsesområder => blokering med `Indtastning mangler`
- delvis udfyldning under ASL-ydelse => blokering
- fejlbehæftet værdi i et hvilket som helst felt på siden => blokering
- manglende nødvendige fælles input som beregningsdato og skadelidtes fødselsdato => blokering

Der skal samtidig indføres en tydelig adskillelse mellem:

- inline-fejl/advarsler i dedikerede contentboxe
- tooltip-fejl/advarsler i individuelle felter

Det vil sige, at indholdsspecifikke advarsler ikke længere skal vises inline, men i stedet i feltet via gul ring og tooltip, mens fejl i stedet får rød ring og tooltip.

### Tekniske noter
- Kravet er både en logisk blokering og en UX-konvergensregel.
- Det er vigtigt at sikre, at de fire blokeringer håndteres i fælles gating/logik, så de ikke bliver implementeret som separate lokalt inkonsistente regler.
- Den beskrevne tekstændring under EAL-ydelse skal ske som en normal UI-tekstkorrektion i samme område.
- Den generelle visningsmodel for advarsler og fejl bør etableres i shared UI-/field-architecture, så den kan anvendes på tværs af programmet og garantere, at en gul eller rød ring altid har en tilhørende relevant tooltip-meddelelse.
- Sikringen skal være strukturel, så ikke blot enkelte felter, men hele felt- og issue-flows overholder dette mønster.

### Status
Implementeret. Dokumentgaten skelner nu mellem manglende input, delvis ASL-udfyldning og faktiske
feltfejl. Beregningsdato, skadedato og skadelidtes fødselsdato behandles som nødvendige fælles input.
ASL-maksimumadvarslen vises på årslønsfeltet med gul ring og tooltip, og EAL-labelen er rettet.

### Prioritet
Kritisk
## Punkt-ID: BF-009

### Kort titel
Årslønsberegning: tomme efterfølgende kolonner skal ikke accepteres, når dato/interval er angivet i de to første kolonner

### Problem
På årslønsberegning-siden skal det også betragtes som en fejl, hvis der er angivet dato/interval i de to første kolonner, men intet beløb i nogen af de efterfølgende kolonner.

Det betyder, at systemet ikke må tillade en tilstand, hvor de første to kolonner er udfyldt med tidsinformation, mens resten af rækkeindholdet er helt tomt.

### Ønsket ændring
Systemet skal valideres og håndteres så, at en række ikke kan være delvist udfyldt på denne måde.

Hvis der er angivet dato/interval i de to første kolonner, skal det kræves, at der også er en meningsfuld værdi i de relevante efterfølgende kolonner. Ellers skal dette betragtes som en fejl, og det skal blokere "Omregning til fuldt år".

### Tekniske noter
- Fejlen er et dataintegritets-/valideringsproblem, ikke et rent visningsproblem.
- Det bør verificeres, om denne regel allerede eksisterer i en mere generel tabel-/rows-valideringslogik, eller om den skal etableres eksplicit for årslønsberegning.
- Hvis dette er et generisk mønster, bør løsningen findes i shared validation/row semantics i stedet for som en lokal special-case i årslønsberegning.
- Den relevante konsekvens er en blokering af handlingsflowet ved "Omregning til fuldt år".

### Status
Implementeret. En periode med både start- og slutdato, men uden beløb, får en målrettet fejl på beløbscellen
og blokerer `Omregning til fuldt år` samt dokumentflowet.

### Prioritet
Høj

## Punkt-ID: BF-010

### Kort titel
SH-dokument: periodetekst skal være pluraliseret og sammenskrevet med 'og' på de endelige sammenlagte perioder

### Problem
I SH-dokumentet skal teksten ændres fra `Periode` til `Perioder`, hvis der er mere end én periode.

Det er de endelige, sammenlagte perioder der skal vurderes ud fra. Hvis to perioder støder op til hinanden og derfor bliver lagt sammen, tælles det kun som én.

Derudover skal der, både her og universelt i programmet, være en fremgangsmåde, der når der skrives flere perioder efter hinanden, sørger for, at der mellem næstsidste og sidste periode skrives `og` i stedet for at adskille med komma.

En sådan metode findes muligvis allerede. Hvis den gør, skal den også anvendes på SH-dokumentet, og det skal undersøges, om den mangler at blive anvendt andre steder også.

### Ønsket ændring
Systemet skal ved visning af SH-dokumentet:

- bruge teksten `Perioder` i stedet for `Periode`, når der er mere end én endelig sammenlagt periode
- identificere og tælle de endelige, sammenlagte perioder korrekt, så perioder der ligger direkte op ad hinanden kun tælles som én
- anvende en fælles og konsistent metode til at skrive flere perioder i serie med `og` mellem næstsidste og sidste periode, i stedet for komma-separation

Derudover skal den samme metode verificeres og bruges konsekvent andre steder i programmet, hvor flere perioder udskrives i tekst.

### Tekniske noter
- Kravet er både tekst- og logikrelateret: det gælder ikke kun den visuelle tekst, men også den måde, perioderne bliver samlet og analyseret før de udskrives.
- Den vigtigste forskel er, at vurderingen skal ske på de endelige sammenlagte perioder, ikke på de rå perioder før sammenlægning.
- Hvis der findes en eksisterende helper eller formatteringsmekanisme til liste-/serieformatering, bør den genbruges og anvendes også i SH-dokumentet.
- Hvis den ikke findes, bør den etableres som en fælles, genanvendelig metode i stedet for at løse det lokalt i SH-dokumentet.

### Status
Implementeret. SH-dokumentet sammenlægger først tilstødende/overlappende perioder, pluraliserer derefter
`Periode`/`Perioder` og bruger en fælles dansk listeformatterer med `og` før sidste element. Den fælles
formatterer er samtidig taget i brug på øvrige identificerede periodetekster.

### Prioritet
Høj

## Punkt-ID: BF-011

### Kort titel
Forsørgertab: download-knap viser forkert tooltip ved manglende input fra stamdata

### Problem
På forsørgertab-siden får jeg tooltip om `fejl i indtastning`, når download-knappen er deaktiveret, selvom der ikke er nogen af felterne, som der er faktiske fejl i.

Jeg mistænker, at problemet kan være relateret til, at `skadestype` og/eller `skadesdato` ikke er udfyldt. Det skal undersøges nøje, fordi forsørgertab ikke nødvendigvis bør være afhængig af disse oplysninger i praksis.

Det er en kritisk fejl, fordi download af forsørgertab-dokumentet bliver blokeret konstant, selv når alle relevante input er udfyldt korrekt i den konkrete side.

### Ønsket ændring
Systemet skal sikre, at download af forsørgertab-dokument kun bliver blokeret af oplysninger, der faktisk har betydning for dokumentet.

Hvis blokeringen skyldes manglende input, skal det være en korrekt og tydelig tilstand som `Indtastning mangler`, og ikke en generisk `fejl i indtastning`.

Det skal undersøges, om den overbærenede blokering skyldes `skadestype`/`skadesdato` eller andre flerbrugte gating-felter, og om samme problem går igen andre steder i programmet.

Hvis `skadesdato` faktisk har betydning for forsørgertab, bør den fremgå af en tydelig linje på forsørgertab-siden, så brugeren kan se, hvis den mangler — ligesom `skadelidtes fødselsdato` er synlig som en tydelig linje på siden.

### Tekniske noter
- Den centrale fejl er, at en ikke-faktisk-fejlklasse bliver brugt til en blokering, der kan være opstået af manglende input i forudsatte felter, som ikke nødvendigvis er relevante for forsørgertab.
- Det er vigtigt at fastslå, om `skadestype` og/eller `skadesdato` faktisk er input, som dokument- eller download-gaten kræver for forsørgertab, eller om den overbærende blokering er for omfattende og derfor bør rettes i shared-gate-laget.
- Hvis `skadesdato` er relevant, bør den både være en faktisk inputværdi i gate-flowet og en eksplicit visuel linje på forsørgertab-siden, så brugeren kan opdage den direkte.
- Hvis årsagen er generisk, skal den rettes på det fælles niveau og derefter verificeres på andre sider, der bruger samme download-/document-gate flow.
- Under alle omstændigheder må tooltip-meddelelsen ikke betegne en egentlig indtastningsfejl, når den reelt skyldes manglende input eller en for bred blokering.

### Status
Implementeret. Gaten klassificerer manglende forudsætninger som `Indtastning mangler` og reserverer
`Fejl i indtastning` til faktiske feltfejl. Skadedato er en reel beregningsforudsætning og vises nu på siden med
link til Stamdata; skadestype er ikke gjort til en afhængighed, fordi den ikke indgår i projektionen.

### Prioritet
Kritisk

## Punkt-ID: BF-012

### Kort titel
Varige mén: beregningsdato skal være større end eller lig med skadesdato, når skadesdato er indtastet

### Problem
På varige mén-siden skal beregningsdatoen være større end eller lig med skadesdatoen, hvis den er indtastet.

Det er en dato-/kvantitetsrelateret regel, som bør håndhæves tydeligt i den relevante validering og i den relevante user-flow.

### Ønsket ændring
Systemet skal sikre, at når `skadesdato` er indtastet, så er `beregningsdato` på varige mén-siden ikke mindre end denne værdi.

Det betyder, at en beregningsdato skal være `>=` skadesdatoen i den relevante sammenhæng.

### Tekniske noter
- Kravet er en konkret domænerelation mellem to dato-felter, ikke blot en visuel regel.
- Det bør verificeres, om den samme kronologiske kontrakt allerede findes i en fælles date-/validation-helper eller om den skal etableres eksplicit for varige mén.
- Hvis den findes i en shared validator, skal den også bekræftes på andre sider, der bruger samme dato-model og samme beslægtede flow.

### Status
Implementeret. Varige mén-feltdefinitionen afleder beregningsdatoens minimum som den seneste af den statiske
minimumsdato og skadedatoen. En tidligere dato giver derfor en konkret bounds-fejl med den aktuelle grænse.

### Prioritet
Høj

## Punkt-ID: BF-013

### Kort titel
Generisk fejlmeddelelse skal kun bruges for ugyldigt format, ikke for out-of-bounds

### Problem
Den generiske fejlmeddelelse `Fejl i indtastning` skal kun bruges, hvis der er tale om en indtastning i ugyldigt format.

Den skal ikke bruges, når værdien er `out-of-bounds`, altså ligger uden for det tillatte eller gyldige område.

### Ønsket ændring
Systemet skal skelne korrekt mellem:

- en ugyldig inputformat-fejl, hvor `Fejl i indtastning` er passende
- en out-of-bounds-fejl, hvor den relevante og mere præcise fejlklassifikation skal bruges i stedet

Det betyder, at fejlkategorien skal være semantisk korrekt forskellig, så brugeren får den rigtige oplevelse afhængigt af årsagen til problemet.

### Tekniske noter
- Dette er et kategoriserings-/message-semantikproblem i den fælles fejlhåndteringsmodel.
- Fejlen bør undersøges i den del af systemet, der mapper fra den underliggende validator-tilstand til bruger-visible fejlmeddelelse.
- Hvis mønsteret findes flere steder, bør den rettes generisk i shared validation- eller issue-classification-laget i stedet for lokalt på enkelte sider eller komponenter.

### Status
Rettet i den fælles klassifikation og i dokumentgaten: format-/schemafejl bruger den generiske meddelelse,
mens bounds- og regelissues bevarer deres konkrete tekst. Fundet er fortsat aktuelt som opfølgningspunkt,
indtil det præcise resterende felt eller flow er identificeret og reproduceret.

### Prioritet
Høj

## Punkt-ID: BF-014

### Kort titel
Tooltip-formatering skal være ensartet og automatisk ombrydende, uden manuel special-ombrydning

### Problem
Der er forskellige formateringer for tooltip-meddelelser.

Nogle har bredden tilpasset indholdt og centreret tekst, mens andre har en fast bredde og venstrestillet tekst.

I visse tilfælde er der også sat manuel ombrydning for indholdet.

Det er en fejl, at disse formateringer er forskellige. De skal være konsistente.

### Ønsket ændring
Alle tooltip-meddelelser skal bruge samme formatering:

- venstre-aligned tekst
- tooltip-boks, der er tilpasset indholdet
- ingen manuel ombrydning i specialtilfælde

Der skal være en generel visning, så hvis tooltip-meddelelsen er over et vist antal tegn, ombrydes den automatisk.

Ombrydning skal ske, så hvis midten af en sætning ligger midt i et ord, fremgår ordet på den nedre linje. Det vil sige, at linjebruddet skal være naturligt og ikke manuelt bestemt.

### Tekniske noter
- Fejlen er et UI-/layout-konvergensproblem, ikke et beregningsproblem.
- Det bør undersøges, om der findes en eksisterende shared tooltip- eller popover-styling, som kan standardiseres, så alle tooltips får den samme `box`-bredde og tekstjustering.
- Manual line breaks og hardcoded widths bør fjernes og erstattes af en generel wrapping-strategi.
- Hvis denne adfærd allerede er implementeret i en shared komponent, skal den også anvendes på de steder, hvor tooltip-formatet i dag afviger.

### Status
Ikke implementeret; klassificeret som en enkel, tværgående tooltip-stylingrettelse.

### Implementeringsplan
1. Saml tooltipens tekstjustering, indholdsbaserede bredde og maksimale bredde i det fælles MUI-theme eller
   den eksisterende fælles tooltip-wrapper.
2. Fjern lokale faste bredder og manuelle linjeskift fra de konkrete tooltip-call-sites.
3. Brug normal ordombrydning, så hele ord flyttes til næste linje ved den fælles maksimumsbredde.
4. Tilføj render-tests for kort og lang tekst og gennemfør en visuel stikprøve af felt-, tabel- og knaptooltips.

### Prioritet
Mellem

## Punkt-ID: BF-015

### Kort titel
Forsørgertab: download-blokering skal følge klare, målrettede regler og ikke vise inline-fejl som generiske blocker

### Problem
Download-blokeringen af forsørgertab skal ændres.

Det skal være følgende blokeringer:

1. Hvis der hverken er indtastet en værdi i et felt under ASL-ydelse eller EAL-ydelse, skal download være blokeret. Meddelelsen skal være generisk: `Indtastning mangler`.
2. Hvis brugeren har indtastet en værdi i blot ét af felterne under ASL-ydelse, skal de alle være udfyldt. Ellers skal download være blokeret.
3. Hvis brugeren har indtastet en fejlbehæftet værdi i en hvilken som helst boks på siden, skal download være blokeret. Det gælder fx også, hvis der er indtastet en fejlbehæftet værdi i EAL-ydelse, selv om alle værdier under ASL-ydelse er indtastet korrekt, så ASL-ydelsen ville kunne beregnes korrekt.
4. Forudsat at beregningsdato og skadelidtes fødselsdato er nødvendige for at lave beregningen, skal begge være udfyldt, ellers skal download være blokeret.

Derudover skal advarsler ikke vises som inline-meddelelser i den konkrete contentbox. Et eksempel er teksten `Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.`

Det skal i stedet vises som en gul ring på det relevante felt, og selve teksten skal vises i en tooltip i samme felt.

Inline-adfærd for advarsler er uønsket og skal erstattes af denne struktur. Eventuelle inline-fejlbeskeder skal derimod give en rød ring på feltet og vises som tooltip.

Der skal derfor ske en generel revisitation af, hvordan advarsler og fejl skal vises i programmet: advarsler bruges som informerende, aldrig blokerende, og vises altid med gul ring på feltet og tooltip; fejl vises med rød ring på feltet og tooltip og kan have blokeringseffekt.

Under EAL-ydelse skal teksten `Skadelidtes årsløn (efter EAL)` ændres til `Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)`.

### Ønsket ændring
Systemet skal implementere en tydelig og konsistent download-blokering for forsørgertab med disse fire regler:

- mangel på input i begge ydelsesområder => blokering med `Indtastning mangler`
- delvis udfyldning under ASL-ydelse => blokering
- fejlbehæftet værdi i et hvilket som helst felt på siden => blokering
- manglende nødvendige fælles input som beregningsdato og skadelidtes fødselsdato => blokering

Der skal samtidig indføres en tydelig adskillelse mellem:

- inline-fejl/advarsler i dedikerede contentboxe
- tooltip-fejl/advarsler i individuelle felter

Det vil sige, at indholdsspecifikke advarsler ikke længere skal vises inline, men i stedet i feltet via gul ring og tooltip, mens fejl i stedet får rød ring og tooltip.

### Tekniske noter
- Kravet er både en logisk blokering og en UX-konvergensregel.
- Det er vigtigt at sikre, at de fire blokeringer håndteres i fælles gating/logik, så de ikke bliver implementeret som separate lokalt inkonsistente regler.
- Den beskrevne tekstændring under EAL-ydelse skal ske som en normal UI-tekstkorrektion i samme område.
- Den generelle visningsmodel for advarsler og fejl bør etableres i shared UI-/field-architecture, så den kan anvendes på tværs af programmet og garantere, at en gul eller rød ring altid har en tilhørende relevant tooltip-meddelelse.
- Sikringen skal være strukturel, så ikke blot enkelte felter, men hele felt- og issue-flows overholder dette mønster.

### Status
Implementeret. Dokumentgaten skelner nu mellem manglende input, delvis ASL-udfyldning og faktiske
feltfejl. Beregningsdato, skadedato og skadelidtes fødselsdato behandles som nødvendige fælles input.
ASL-maksimumadvarslen vises på årslønsfeltet med gul ring og tooltip, og EAL-labelen er rettet.

### Prioritet
Kritisk

## Punkt-ID: BF-016

### Kort titel
Feltstatus: introducer gul ring på felter med advarsler, med garanteret tooltip-meddelelse

### Problem
Jeg vil gerne have introduceret muligheden for, at felter får en gul ring, når der er advarsler relaterende til indholdet, ligesom de får en rød ring, når der er fejl relaterende til feltet.

Det er et større og væsentligt arkitektur-relateret skridt.

Der skal laves en effektiv sikring, som garanterer, at der altid vises en relevant tooltip-meddelelse på felter med gul ring.

Gul ring er en advarsel, der blot er informerende - aldrig blokerende.

### Ønsket ændring
Systemet skal kunne repræsentere to tydelige feltstatusser:

- `gul ring` = informerende advarsel, ikke-blokerende, med tilhørende tooltip-meddelelse
- `rød ring` = faktisk feltfejl, med tilhørende tooltip-meddelelse

Den nye struktur skal sikre, at hver gang et felt får gul ring, så er der en tilsvarende og relevant tooltip-meddelelse knyttet til feltet.

Det skal være en generel, vedvarende løsning i shared field-/issue-architecture, så denne advarselstype ikke kan blive repræsenteret uden en korrekt tooltip.

### Tekniske noter
- Dette er et principielt arkitekturkrav om statusmodellering på feltniveau, ikke blot en UI-justering.
- Det bør etableres som en shared konstruktion, der samler feltstatus, tooltipmeddelelse og blokeringsevne i samme mønster.
- Den relevante sikkerhed bør være strukturel: en gul ring uden tooltip skal være en ulovlig tilstand, og samme princip bør gælde for rød ring med fejlmeddelelse.
- Det nye mønster bør også anvendes til at konsolidere nuværende advarsels-/fejlflow i forsørgertab og andre lignende sider.

### Status
Implementeret i den fælles feltarkitektur. `FieldWarning` kan kun oprettes med en ikke-tom tooltiptekst,
er aldrig blokerende og vises med gul ring i formular- og tabelinput. En samtidig feltfejl har altid prioritet.

### Prioritet
Høj

## Punkt-ID: BF-017

### Kort titel
Varige mén: gul ring og tooltip ved 5 %-mængrad som advarsel om ikke-tilkendelse

### Problem
Hvis der på siden med varige mén er indtastet en méngrad på 5 %, skal systemet angive det som et oplagt emne for gul ring og tooltip.

I den konkrete situation skal der være en gul ring på feltet, og en advarsel i tooltipen skal tydeligt angive:

`Der kan ikke tilkendes varige mén under 5 %`

### Ønsket ændring
Systemet skal kunne skelne mellem en normal feltstatus og en advarsel, der er relevant for den viste værdi på siden med varige mén.

Når méngrad er 5 %, skal feltet vises med gul ring og en tilhørende tooltip, der præcist forklarer den relevante regel:

- `Der kan ikke tilkendes varige mén under 5 %`

Det skal være en del af det generelle mønster for gul ring + tooltip, så advarsler ikke bliver vist som inline-tekst, men som feltstatus og tilgængelig tooltip.

### Tekniske noter
- Dette er et konkret eksempel på den nye shared field-status-arkitektur for advarsler.
- Kravet er ikke bare tekst, men en tydelig model for, at en varig-mén-regel kan blive udtrykt som feltadvarsel med tooltip.
- Den samme struktur skal kunne genbruges på andre sider med lignende domæneadvarsler.

### Status
Implementeret. En afsluttet méngrad på præcis 5 % giver gul ring og tooltipteksten
`Der kan ikke tilkendes varige mén under 5 %`; advarslen ændrer ikke beregning eller dokumentgate.

### Prioritet
Høj

## Punkt-ID: BF-018

### Kort titel
Renteberegning: `Evt. tillægstid` skal tillade maksimalt to cifre i talfeltet

### Problem
På renteberegning-siden skal tal-feltet under `Evt. tillægstid` være begrænset til max to cifre.

Det er en konkret input-/UI-regel, som skal håndhæves tydeligt i feltet, så brugeren ikke kan indtaste en værdi med flere cifre end den tilladte grænse.

### Ønsket ændring
Systemet skal sikre, at feltet under `Evt. tillægstid` kun accepterer værdier med maksimalt to cifre.

Hvis brugeren forsøger at indtaste mere end to cifre, skal indtastningen enten:

- automatisk afvises af feltet, eller
- blive markeret som ugyldig på en måde, der er konsistent med øvrige feltregler i programmet.

### Tekniske noter
- Dette er et konkret feltbegrænsningskrav på renteberegning-siden.
- Reglen bør implementeres som en enhed af den eksisterende felt-/input-model, så den bliver konsistent med de øvrige inputgrænser i appen.
- Det skal verificeres, om den aktuelle input- og formatteringsflow allerede har et generisk maksimum for antallet af cifre, eller om renteberegning kræver en side-/felt-specifik begrænsning.

### Status
Ikke implementeret; klassificeret som en enkel feltbegrænsning i den eksisterende inputmotor.

### Implementeringsplan
1. Angiv en maksimal draftlængde på to cifre for `Evt. tillægstid` gennem den eksisterende
   `GridTextCell`-/feltdefinition frem for lokal tastaturfiltrering.
2. Bevar den canonical heltalsvalidering og den eksisterende 0–99-grænse ved settle, paste og programmatisk input.
3. Tilføj inputmotortests for normal indtastning, tredje ciffer, paste, blur og Enter.

### Prioritet
Høj

## Punkt-ID: BF-019

### Kort titel
Erhvervsevnetab: procentfelter under `EET %` får gul ring og tooltip ved under 15 %

### Problem
På erhvervsevnetab-siden bør procentfelterne under `EET %` få gul ring og tooltip-meddelelse, hvis der indtastes en værdi under 15 %.

Det samme bør være tilfældet for procent-boksen ud for `EET % (hvis afviger fra ASL)`, hvis den også indeholder en værdi under 15 %.

Der bliver allerede nu vist en advarsel på fanen med `EET efter EAL`, hvor teksten er:

`Der er angivet et EET efter EAL på mindre end 15 %`

Det bør generelt være gældende, at hvis der dannes en sådan advarselstekst, som vises i en boks med fejl og advarsler, så bør denne genbruges som tooltip sammen med den gule ring på siden.

Generelt bør det undersøges, hvilke andre steder i programmet der kan blive udløst en advarsel i en boks med fejl og advarsler, og som udgangspunkt bør alle disse tilfælde også medføre gul ring og tooltip-meddelelse.

Det er en konkret domæneadvarsel og skal håndteres som feltstatus med udtrykkelig tooltip, ikke som inline-tekst.

### Ønsket ændring
Når brugeren indtaster en værdi under 15 % i et procentfelt under `EET %`, eller i procent-boksen ud for `EET % (hvis afviger fra ASL)`, skal systemet tydeligt vise:

- en gul ring på feltet
- en tooltip-meddelelse med teksten:
  `Der kan ikke tilkendes erhvervsevnetab under 15 %`

Hvis en advarsel allerede bliver vist i en boks med fejl og advarsler, skal samme tekst også kunne genbruges som tooltip sammen med feltets gule ring på den relevante side.

Det skal være et generelt og konsistent mønster for advarsler på procentfelter og andre relevante inputfelter, så feltets status og tooltip-hjælp bliver brugervenlig og ensartet.

### Tekniske noter
- Dette er et konkret eksempel på den fælles gul-ring- og tooltip-arkitektur for domæneadvarsler.
- Kravet skal etableres som en feltstatusregel, ikke som en lokalt hardcodet inline-besked.
- Når en advarsel allerede er skabt i en fejl-/advarselsboks, bør teksten genbruges i den relevante tooltip, så der ikke skabes parallelle advarselsrepræsentationer.
- Den samme arkitektur bør kunne genbruges til andre grænseværdier og andre steder, hvor en advarsel i en fejl-/advarselsboks er knyttet til en konkret inputværdi.

### Status
Implementeret. Alle afsluttede EET-procentfelter under ASL-tabellen og feltet
`EET % (hvis afviger fra ASL)` får ved værdier over 0 og under 15 % den fælles gule advarsel med teksten
`Der kan ikke tilkendes erhvervsevnetab under 15 %`. Beregningsadvarslen genbruger samme kanoniske tekst.

### Prioritet
Høj
