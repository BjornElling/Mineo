# Brugerblik – Renteberegning (fane 1: Beregning)

- Rute/placering: `/renteberegning`, fane 1 af 2 («Beregning»). Fane 2 («Rentesatser») er nr. 8b.
- Gennemgået: 2026-08-21 · commit `c75e25ec`
- Afprøvet i: Chromium headless – 1536×864, 1366×620, 1244×620, lyst tema. Dev-server
  `vite.mineo.config.ts`. Konsollen gennem hele kørslen: 189 beskeder, **0 fejl, 0 advarsler**.
  Begge dokumenter er hentet som `.docx` og læst linje for linje.

## Fladen kort

Fanen beregner procesrente efter renteloven: én beregningsdato («Rente beregnes til og med»), en
tabel med rentekrav (beløb, «Renter fra», evt. tillægstid med enhed) og to udgange – en
specifikation pr. række og et samlet oversigtsdokument. Nederst et kommentarfelt og fire faste
beregningstekniske forudsætninger.

**Komponenten er den samme som MinProcesrentes** (`RenteberegningTab`), og flade 5 er gennemgået
2026-08-19 med tolv fund. Denne gennemgang er derfor lagt an på **det, Mineo-udgaven gør anderledes**
– «Download samlet oversigt», «Slet alle indtastninger» med sit `.eo`-forbehold, valgbart
dokumentformat (PDF/Word), brevhoved fra Indstillinger, og først og fremmest **koblingen til
Stamdata**, som standalone slet ikke har – samt de prøver, flade 5 udtrykkeligt efterlod som
dækningshuller (dokumenternes faktiske indhold, mange rækker).

Fanen er den eneste beregningsflade i Mineo, der **ikke viser en eneste stamdataoplysning**. Netop
det er kernen i fladens tungeste fund.

## Fund

### BB-080 – En rød dato i Stamdata slukker alle downloadknapper på Renteberegning, og intet på siden peger derhen

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-22--en-usynlig-dokumentafhængighed-på-en-anden-flade-slukker-knappen`
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Renteberegning: beregningsdato `19-08-2026`, én række med `100.000` og «Renter fra» `31-01-2024`.
     Rækken regner `27.111,89 kr.`, og både rækkens downloadikon og «Download samlet oversigt» er aktive.
  2. Gå til Stamdata og skriv `99-99-9999` i Fødselsdato (afvist råtekst, rød ramme).
     – eller giv Fødselsdato og Skadedato en umulig rækkefølge (`01-01-2021` / `01-01-2020`), som gør
     **begge** felter røde.
  3. Gå tilbage til Renteberegning.
- **Det sker:** Begge downloadknapper er nu grå med tooltippen «Fejl i indtastning». Rækken viser
  fortsat `27.111,89 kr.`, der er **nul** røde felter på siden (målt: `main .Mui-error` = 0), og ordet
  «Stamdata» står ikke nogen steder på fanen. Blokeringen består, selv om **brevhovedet for
  Renteberegning slås fra** i Indstillinger – altså også når stamdata slet ikke skal trykkes i
  dokumentet (målt begge veje).
- **Det er uhensigtsmæssigt fordi:** Brugeren står med en side, der viser et færdigt tal, ingen
  fejl – og to døde knapper. Den ene af programmets fire universelle blokeringstekster siger, at der
  ER indtastet noget forkert, men det forkerte findes på en anden side, som denne side ikke nævner.
  Det er en blindgyde (prioritet 3) oven på tavshed (prioritet 4): der er ingen måde at gætte, at
  vejen frem går gennem Stamdata. **Sammenlign med Varige mén, hvor samme fejl er umiddelbart
  synlig:** dens spejlede stamdata-rækker skriver «Fødselsdato – Fejl i indtastning» (BB-064's
  rettelse). Renteberegning har ingen sådan række at skrive i, og fik derfor ingen del i rettelsen.
- **Bedre ville være:** at blokeringen navngiver sin kilde. Konkret: når blokeringen skyldes en fejl
  uden for fanen, skal tooltippen sige det – fx «Ret fejlen i Stamdata» – frem for «Fejl i
  indtastning», som peger på fanen selv.
  **Alternativ, hvis du hellere vil fjerne blokeringen:** stamdatafelterne er alle valgfrie, og et
  tomt felt blokerer ikke – et brevhoved uden fødselsdato trykkes fint i dag. En **afvist** valgfri
  brevhovedoplysning kunne derfor behandles som fraværende frem for som en spærring. Prisen er, at
  dokumentet så tavst udelader en oplysning, brugeren har forsøgt at skrive; det er derfor et valg,
  ikke en oplagt rettelse.
- **Andre steder det kan gælde:** **Målt og bekræftet på to flader mere.** **Satser** – et rent
  opslagsværk, hvis brevhoved som standard er SLÅET FRA – får sin eneste downloadknap grå med «Fejl i
  indtastning» af den samme fødselsdato, uden et ord om hvorfor. **Varige mén** blokerer også, men
  viser årsagen. Uverificerede kandidater med samme konstruktion: Årsløn (`document.aarsloen`),
  Erhvervsevnetab (`document.eet`), Forsørgertab og Erstatningsopgørelsens reguleringsbilag – alle
  kalder `projectStamdataForDocument` ubetinget. Kun Fødselsdato og Skadedato kan gå røde i Stamdata;
  de fire tekstfelter og skadestypen kan ikke.

### BB-081 – Oversigtsdokumentets kolonne «Rente fra» viser rentedatoen, ikke den dato skærmen kalder «Renter fra»

- **Type:** Fejl
- **Rækkevidde:** Lokal (men se BB-087 om samme dokuments datoformat)
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Beregningsdato `19-08-2026`. Én række: `200.000`, «Renter fra» `31-12-2018`, tillægstid `30`, enhed Dage.
  2. Skærmen viser nu: «Renter fra» = `31-12-2018`, «Rentedato» = `30-01-2019`,
     «Beregnet rente» = `139.028,63 kr.`
  3. Hent «Download samlet oversigt».
- **Det sker:** Dokumentets tabel har tre kolonner – «Beløb», **«Rente fra»**, «Beregnet rente» – og
  under «Rente fra» står **30. januar 2019**. Altså rentedatoen, ikke den dato brugeren skrev i
  kolonnen «Renter fra». Tillægstiden findes ikke i dokumentet, hverken som kolonne eller som note.
  (Målt i den hentede `.docx`; kildekommentaren i generatoren siger selv «beløb, rentedato (Rente
  fra)», så navnevalget er bevidst.)
- **Det er uhensigtsmæssigt fordi:** Dokumentet er det, der går ud af huset. En modpart – og
  brugeren selv en uge senere – læser «Rente fra 30. januar 2019» som kravets dato og kan hverken se,
  at kravet forfaldt 31-12-2018, eller at der er givet 30 dages tillægstid. Skærmen og dokumentet
  bruger næsten samme ord om to forskellige datoer, så en kontrol mod skærmen ser ud som en
  uoverensstemmelse i beregningen. Det er et misvisende tal i et dokument, brugeren ikke har nogen
  anledning til at betvivle (prioritet 2). Bemærk, at **rækkens egen specifikation gør det rigtigt**:
  den skriver «Periode: 30-01-2019 - 19-08-2026 (begge dage inkl.)», hvor ordet «Periode» ikke
  påstår at være kravets dato.
- **Bedre ville være:** at kolonnen hedder det, skærmen kalder værdien – **«Rentedato»**. Vil du
  hellere have kravets dato med, kan oversigten få fire kolonner (Beløb, Renter fra, Rentedato,
  Beregnet rente); men det er en indholdsudvidelse, og den mindste rettelse er navnet.
- **Andre steder det kan gælde:** ingen – kolonnen findes kun i `renteOversigtDocument.ts`. Men prøven
  («bærer en dokumentkolonne en ANDEN kolonnes værdi under en tredje kolonnes navn?») hører på
  Årsløn, EET og EO, hvor dokumenttabellerne har flere afledte kolonner end skærmen.

### BB-082 – Skærmen lægger ikke rentebeløbene sammen; kun dokumentet gør

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Udfyld fire rentekrav (målt: `139.028,63` + `62.103,91` + `21.541,06` + `5.336,49`).
  2. Læs kolonnen «Beregnet rente» på skærmen.
  3. Hent «Download samlet oversigt».
- **Det sker:** Skærmen viser fire beløb og ingen sum. Dokumentet slutter tabellen med **«Samlet
  rentebeløb 228.010,09 kr.»**
- **Det er uhensigtsmæssigt fordi:** Summen er det tal, sagen handler om – det, der skal ind i
  påkravsskrivelsen. Brugeren skal enten regne det i hovedet eller hente en PDF for at læse et tal,
  programmet allerede har. Det gælder også omvendt: han kan ikke kontrollere sit eget arbejde på
  skærmen, kun i dokumentet. **Programmet har mønsteret i forvejen:** EET's «Løbende ydelser»-tabel
  viser en «I alt»-række direkte på skærmen.
- **Bedre ville være:** en afsluttende «Samlet rentebeløb»-linje i tabellen på skærmen, med samme
  ordlyd og samme værdi som dokumentets – og kun når der er mere end én linje med et resultat.
- **Andre steder det kan gælde:** samme forhold findes pr. konstruktion i MinProcesrente (delt
  komponent), og prøven («summerer dokumentet noget, skærmen ikke summerer?») hører på Årsløn og EO.

### BB-083 – Én ufuldstændig rentelinje spærrer hele oversigten, og intet peger på linjen

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-16--en-komplet-række-programmet-ikke-vil-regne-på`
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Beregningsdato `19-08-2026`. Tre komplette rækker (`200.000/31-12-2018`, `100.000/01-01-2020`,
     `50.000/01-06-2022`).
  2. Skriv `7000` i en fjerde rækkes beløb, og lad «Renter fra» stå tom.
- **Det sker:** De tre komplette rækkers downloadikoner er aktive og virker. **«Download samlet
  oversigt» er grå med «Indtastning mangler».** Der er nul røde felter, og den ufuldstændige række er
  ikke markeret – den skiller sig kun ud ved, at tre af dens kolonner viser `-`, ligesom tabellens
  tomme indtastningsrække gør.
- **Det er uhensigtsmæssigt fordi:** Blokeringen er rigtig (en oversigt, der tavst udelod et krav,
  ville være værre), men den er hængt op på hele fladen, mens årsagen bor i én række. Med tre rækker
  finder brugeren den; med tredive skal han scanne. Det er præcis M-16's kerne: motoren afviser af en
  grund, feltmodellen ikke kender, så afvisningen kommer ud som et fravær. BB-037 og BB-038 lukkede
  fanens to *motorafvisninger* ad denne vej; **den rene mangel blev ikke omfattet.**
- **Bedre ville være:** at følge M-16's egen ordination og lægge reglen i feltmodellen: har en række
  et beløb, skal «Renter fra» være udfyldt – og omvendt. Så bliver det tomme felt rødt i netop den
  række, brugeren skal rette, og fladens blokering får en synlig afsender.
- **Andre steder det kan gælde:** samme form i alle tabeller, hvor et aggregat spærres af en
  ufuldstændig række: Årsløns lønrækker, EO's Lønindkomst og Offentlige ydelser.

### BB-084 – En række, hvis eneste indhold er en afvist værdi, regnes for tom: ingen slet-knap og ingen ny indtastningsrække

- **Type:** Edge case
- **Rækkevidde:** Lokal (men prøven er B6a's og gælder alle samlingstabeller)
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør (teknisk konvergens mod en løsning, der allerede findes i samme fil)
- **Sådan fremprovokeres det:**
  1. Stil markøren i tabellens nederste, tomme beløbscelle.
  2. Indsæt tre beløb fra et regneark (`1.000,00` / `2.000,00` / `3.000,00` – tre linjer). Se BB-088
     om selve værdien.
  3. Tryk Enter.
- **Det sker:** Cellen står med den afviste tekst `1000,00,` og tooltippen «Fejl i indtastning».
  Rækken har **ingen «Slet rækken»-knap** (målt: 5 rækker, 4 slet-knapper), og **der er ikke kommet
  en ny tom indtastningsrække**. Tabellen er dermed uden ledig række, indtil brugeren selv tømmer
  cellen. Til gengæld ER sidens «Slet alle indtastninger» aktiv – den ser godt nok indholdet.
- **Det er uhensigtsmæssigt fordi:** Brugeren kan se, at der står noget i rækken, og programmet
  svarer «her er ingenting». Han kan hverken slette rækken eller gå videre til den næste uden først
  at gøre noget ved en celle, han måske ikke ved er gal. Det er B6a's tredje prøve ordret, og
  **svaret findes i samme fil:** `hasAnyRentekravInput` blev netop skrevet, fordi en afvist værdi
  ellers gjorde «Slet alle indtastninger» uopnåelig – med kommentaren om, at en beregningsprojektion
  ikke må afgøre, om der er noget at rydde. Rækkens slet-knap og rækkepromoveringen læser stadig
  projektionen.
- **Bedre ville være:** at rækkens «Slet rækken» og promoveringen af den trailende række bruger samme
  prøve som «Slet alle indtastninger» – afsluttet input, ikke beregningsklart input. En række med en
  afvist værdi er en række, brugeren kan slette, og den udløser en ny tom række som enhver anden
  udfyldt række.
- **Andre steder det kan gælde:** alle tabeller på `useCollectionTable` med `countsAsEmptyEntryRow`,
  dvs. Årsløn, EO's Lønindkomst og Offentlige ydelser, EET's afgørelsestabeller.

### BB-085 – Rækkens downloadikon forsvinder i stedet for at blive inaktivt med en årsag

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Udfyld en række helt (`100.000` / `31-01-2024`), men lad Beregningsdato være tom.
- **Det sker:** Rækken viser sin Rentedato, men «Beregnet rente» og «Specifikation» er begge `-`.
  Der er ingen knap at trykke på og intet at holde musen over. Samtidig står «Download samlet
  oversigt» lige nedenfor som en **grå knap med tooltippen «Indtastning mangler»**.
- **Det er uhensigtsmæssigt fordi:** Den samme blokering udtrykkes to steder på én skærm på to
  måder – som en forsvundet kontrol og som en inaktiv kontrol med en forklaring. Den forsvundne er
  den dårligste af de to: en knap, der ikke er der, kan ikke spørges om hvorfor, og brugeren kan ikke
  se, om rækken mangler noget eller om funktionen slet ikke findes for den. Fanen udregner allerede
  årsagen (`resolveRowDownloadGate`) – den bliver blot ikke vist, når der ikke er et resultat.
- **Bedre ville være:** at ikonet altid tegnes for en række med indhold, inaktivt og med gatens
  årsag i tooltippen – præcis som «Download samlet oversigt». Tabellens tomme indtastningsrække skal
  fortsat vise `-`; komponenten kender i forvejen forskellen (`rowIsSemanticallyEmpty`).
- **Andre steder det kan gælde:** enhver tabel med en downloadknap pr. række. Konkret
  `regulering`-outputtet pr. ansættelsesforhold på Erstatningsopgørelse (flade 12).

### BB-086 – «Slet alt»-bekræftelsens overskrift er ordret navnet på sidens egen, fortrydelige slet-knap

- **Type:** Fornuft
- **Rækkevidde:** Lokal (shell + fane, men opdaget her fordi de to står på samme skærm)
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. På Renteberegning: tryk rækken «Slet alle indtastninger» (papirkurvsikonet).
  2. Annullér, og tryk i stedet sidemenuens «Slet alt».
- **Det sker (målt ordret):**
  - Fanens knap heder **«Slet alle indtastninger»**; dens dialog heder **«Slet indtastningerne på
    denne side»** og siger «… Handlingen kan fortrydes.»
  - Sidemenuens knap heder **«Slet alt»**; dens dialog heder **«Slet alle indtastninger»** og siger
    «ADVARSEL: Dette sletter alle ikke-gemte indtastninger i Mineo!»
- **Det er uhensigtsmæssigt fordi:** Navnene er byttet om. Den præcise ordlyd «Slet alle
  indtastninger» er både **navnet på den lokale, fortrydelige handling** og **overskriften på den
  globale, uigenkaldelige**. Ingen af de to dialoger bærer sin egen knaps navn. En bruger, der har
  lært knappen på fanen, læser den globale dialogs overskrift som den handling, han kender – og skal
  altså finde forskellen i brødteksten, i det ene tilfælde hvor et fejltryk koster hele sagen
  (prioritet 1). Det er ikke et hypotetisk sammenfald: de to knapper står på samme skærm, cirka 300 px
  fra hinanden.
- **Bedre ville være:** at hver dialog gentager sin egen knaps navn. «Slet alt» → overskrift «Slet
  alt»; fanens «Slet alle indtastninger» → overskrift «Slet alle indtastninger». Vil du hellere
  skærpe forskellen, kan de hedde «Slet alt i Mineo» og «Slet alle indtastninger på denne side»; det
  afgørende er, at den samme ordlyd ikke betyder to ting.
- **Andre steder det kan gælde:** de øvrige bekræftelsesdialoger i shellen (Hent-overskrivning) og
  EO's «Slet ansættelsesforhold». Prøven er: **siger dialogens overskrift det samme som den knap, der
  åbnede den?**

### BB-087 – De to dokumenter fra samme fane skriver de samme datoer i to formater

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Én række (`200.000`, `31-12-2018`, tillægstid 30 dage), beregningsdato `19-08-2026`.
  2. Hent både rækkens specifikation og den samlede oversigt.
- **Det sker (målt i de to `.docx`):**
  - Specifikationen: «Periode: **30-01-2019 - 19-08-2026** (begge dage inkl.)» og periodetabellens
    rækker i samme form. Filnavnet ligeså.
  - Oversigten: «Rente beregnes til og med **19. august 2026**.» og kolonnen «Rente fra» =
    **30. januar 2019**.
  - Skærmen: `31-12-2018`, `30-01-2019`, `19-08-2026` – altså dd-mm-åååå overalt.
- **Det er uhensigtsmæssigt fordi:** De to dokumenter beskriver samme sag på samme dag ud fra samme
  felter, og de er uenige om formen. Ligges de i samme sagsmappe, ser de ud som to forskellige
  opgørelser. Begge former er tilladte (`documentDateGuard` accepterer dd-mm-åååå og «d. mmmm åååå»),
  så det er et valg, ikke en fejl – men valget er truffet forskelligt to steder i samme domæne, og
  **oversigten er den eneste af de tre flader, der afviger.**
- **Bedre ville være:** at oversigten bruger dd-mm-åååå som skærmen og som rækkens specifikation.
  Vil du derimod have den lange form, hører den også i specifikationen.
- **Andre steder det kan gælde:** prøven er billig og hører på hver flade med mere end ét dokument:
  Erhvervsevnetab (fem generatorer), Erstatningsopgørelse (bilagene) og Forsørgertab.

### BB-088 – En indsat regnearkskolonne af beløb smelter sammen til én afvist værdi

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-14--en-anden-fortolkningsvej-ved-siden-af-tastningen`
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Kopiér tre beløb fra et regneark – tre linjer: `1.000,00`, `2.000,00`, `3.000,00`.
  2. Indsæt dem i tabellens tomme beløbscelle og tryk Enter.
- **Det sker:** Cellen indeholder `1000,00,` – rød, med tooltippen «Fejl i indtastning». Ingen af de
  tre beløb blev læst, og resultatet ligner det første. (Linjeskiftene bliver mellemrum i
  `normalizeClipboardText`, og tegnfilteret samler resten til én draft.)
- **Det er uhensigtsmæssigt fordi:** Fanens hele formål er en liste af krav, og listen findes
  næsten altid allerede i et regneark eller en kravopgørelse. Den mest oplagte arbejdsgang giver
  derfor én rød celle med en værdi, der er hverken det ene eller det andet beløb. **Adfærden følger
  din egen bindende regel** (paste = tastning, M-14), så den er ikke et regelbrud – men reglen tager
  ikke stilling til linjeskiftet, og netop linjeskiftet er det, et regneark leverer.
- **Bedre ville være:** at et linjeskift i indsat tekst behandles som det, et linjeskift ER ved
  tastning – en afslutning af værdien. Så bliver cellen `1.000,00` (gyldig), og resten kasseres.
  Det udvider ikke paste-reglen; det anvender den på ét tegn, den ikke nævner. **Vil du hellere have
  hele kolonnen ind**, skal indsættelse kunne fordele linjer over rækker – det er en større
  beslutning og bør i så fald gælde alle tabeller, ikke kun denne.
- **Andre steder det kan gælde:** samtlige tabelceller i programmet. Kandidaterne fra M-14's egen
  liste er stadig uafprøvede: Årslønssidens årsfelt og EO's `col1_maaned` (begge tabelceller, hvor et
  indsat regneark er den sandsynlige kilde).

### BB-089 – «Rentedato» betyder to forskellige ting på sidens to faner

- **Type:** Fornuft
- **Rækkevidde:** Lokal (fane 1 + fane 2)
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Fane «Beregning»: læs kolonnen **«Rentedato»** – den viser rækkens «Renter fra» plus tillægstid,
     altså den dato renten løber fra for netop dette krav (målt: `30-01-2019`).
  2. Fane «Rentesatser»: læs kolonnen **«Rentedato»** – den viser den dato, en referencesats trådte i
     kraft (målt: `01-07-2026 / 2 %`).
- **Det sker:** Samme ord står som kolonneoverskrift på begge faner om to forskellige slags datoer:
  den ene hører til sagens krav, den anden til lovens satstabel.
- **Det er uhensigtsmæssigt fordi:** De to faner ligger et klik fra hinanden på samme side, og
  brugeren skifter mellem dem netop for at kontrollere, hvilken sats der gælder hans rentedato. Når
  begge kolonner heder «Rentedato», er det ikke til at se, at den ene skal *slås op* i den anden.
- **Bedre ville være:** at satsfanens kolonne heder det, den er – **«Gælder fra»** – og at
  «Rentedato» bliver forbeholdt sagens egen dato. Beslutningen hører sammen med fane 8b og bør
  træffes én gang for begge faner.
- **Andre steder det kan gælde:** Satser-siden og Varige méns satsfane har tilsvarende
  ikrafttrædelseskolonner; ordvalget dér er ikke sammenlignet.

### BB-090 – De to «beregning + satser»-sider navngiver deres faner spejlvendt

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Åbn Varige mén: fanerne heder **«Ménberegning»** og **«Satser»**.
  2. Åbn Renteberegning: fanerne heder **«Beregning»** og **«Rentesatser»**.
- **Det sker:** De to sider har præcis samme opbygning – en beregningsfane og en satsfane – og de
  navngiver den modsatte halvdel præcist: Varige mén kvalificerer beregningen og lader satserne stå
  generisk, Renteberegning gør det omvendte.
- **Det er uhensigtsmæssigt fordi:** Sidens navn står allerede over fanerne, så kvalifikationen er
  overflødig præcis ét af de to steder – og de to sider har valgt hvert sit. Det er ikke
  misforståeligt, men det er en vane, der er blevet til to vaner, og den næste side med samme
  opbygning har ingen regel at følge.
- **Bedre ville være:** ét mønster for alle sider med en satsfane – fx generisk beregningsfane og
  generisk satsfane («Beregning» + «Satser»), fordi sidens titel bærer emnet. Afgørelsen er en
  navneregel, ikke en enkeltrettelse.
- **Andre steder det kan gælde:** ingen andre sider har i dag et beregning/sats-fanepar, men EET's
  og EO's fanenavne (fx «EET oplysninger», «EO oplysninger») bør læses med samme regel i hånden.

## Overvejet uden fund

- **Grænse-eftersynet (B0).** Uændret fra flade 5, og målt igen: Beregningsdato og «Renter fra»
  01-01-2005 – 31-12-2031 (nedre grænse = tidligste referencesats; øvre = 31-12 fem år frem).
  `01-01-2032` giver rød ramme og tooltippen «Dato skal være mellem 01-01-2005 og 31-12-2031»;
  `31-12-2031` accepteres. Tillægstid 0–99, to cifre. Beløb ikke-negativt, nul afvist med egen besked.
  Kommentarer 512 tegn. Enhed: tre valg, aldrig tom.
- **Stamdata blokerer kun, når et felt er RØDT.** Med hele Stamdata tomt virker begge downloads.
  Det er den rigtige halvdel af BB-080: fraværet er tilladt, afvisningen er det ikke.
- **Tillægstid, der skubber rentedatoen forbi beregningsdatoen** (99 måneder fra 31-01-2024 mod
  beregningsdato 19-08-2026): tillægstidsfeltet bliver rødt med «Beregnet rentedato kan senest være
  19-08-2026». BB-037's rettelse virker også i Mineo-udgaven.
- **Månedstillæg klamper korrekt:** 31-01-2024 + 1 måned → `29-02-2024` (skudår).
- **M-20's prøve er bestået.** «Rentedato» er en feltnær afledning af to felter i rækken selv, og den
  vises, så snart de to er udfyldt – også når Beregningsdato er tom (målt: `01-03-2024` uden
  beregningsdato). Den forsvinder kun, når et af de tre felter er RØDT, og så er der en rød ramme med
  tooltip at forklare sig med.
- **M-13's formprøve på beløb er bestået.** Skærmens `formatKr(x, 2)` og dokumenternes
  `formatAmount(x)` giver begge to decimaler; `27.111,89 kr.` er ordret det samme i tabellen, i
  specifikationen og i oversigten. Varige méns nuldecimalregel er korrekt IKKE bredt hertil.
- **Procentkolonnen i specifikationen** viser `8,05 %`, `9,9 %`, `10 %` – altså varierende
  decimalantal. Det er programmets gennemgående satsform (samme trimning på Rentesatser-fanen og på
  Satser-siden) og dermed konsistent, ikke ragged.
- **Sortering** (BB-041 er afgjort som tilsigtet): en ufuldstændig række sorteres sidst blandt
  rækker med indhold, og tabellens tomme indtastningsrække forbliver nederst. Målt op og ned.
- **Undo efter «Slet alle indtastninger».** Dialogen lover «Handlingen kan fortrydes», og Ctrl+Z
  gendanner alt – beregningsdato, alle fire rækker og deres værdier. Løftet holder.
- **Åben draft ved faneskift.** `9999` skrevet i en beløbscelle og derefter klik på «Rentesatser»:
  værdien committes (`9.999,00`) og står der ved tilbagevenden. Intet tab, ingen tavs kassering.
- **Dokumentformat.** Word/PDF-valget slår rent igennem: knapternes navne og tooltips skifter til
  «Download som Word» / «Download Word-specifikation for række N», og begge dokumenter hentes uden
  fejl. Gaterne er identiske i de to formater.
- **Talkolonnernes justering.** Både beløbsfeltet og de to afledte kolonner er højrejusterede;
  Rentedato er centreret. Konsistent, målt på computed style.
- **Bredde (M-09).** Ingen vandret rul ved 1536×864, 1366×620 eller 1244×620 – arbejdsfladens
  skalering trækker tabellen fra 1097 til 894 CSS-px. Sidemenuen tager ikke plads fra tabellen.
- **Mange rækker.** ~50 rækker blev bygget uden mærkbar træghed, uden konsolfejl og uden at tabellen
  sprang ud af indholdsboksen. Flade 5's dækningshul om «100 rentekrav» er dermed delvist lukket.
- **Skærmens tre datokolonner læst sammen** («Renter fra» + «Evt. tillægstid» → «Rentedato») er
  entydige og forklarer hinanden. Labelen «Renter fra» er derfor ikke i sig selv et fund – problemet
  opstår først, når dokumentet fjerner de to sidste kolonner (BB-081).
- **BB-040 / M-15 er ikke genforelagt.** Renten regnes fortsat fem år ud over de fastsatte satser
  (målt: beregningsdato 31-12-2031 → `79.820,01 kr.` uden et ord på skærmen; kun dokumentet advarer).
  M-15's betingelse for at rejse sagen igen er, at tallet læses og genbruges **på skærmen** gennem et
  længere forløb. Det gør det ikke her: der findes ikke ét felt i Mineo, der modtager et rentebeløb,
  så fanens output er dokumentet – præcis den præmis, afvisningen 2026-08-19 hvilede på.
- **Konsollen var tavs** gennem hele gennemgangen: 0 `console.error`, 0 `console.warn`, ingen
  page-fejl – på tværs af stamdatafejl, afviste værdier, ~50 rækker og fire dokumenthentninger.

## Dækningshuller

- **`Gem`/`Hent` af rentekrav-tabellen er ikke målt.** Filvælgeren kan ikke betjenes headless (samme
  hul som `globalshell.md` BB-049). Round-trip af rækkefølgen efter en sortering
  (`saveOrderPath="renteberegning.rentekravRows"`) er derfor uverificeret i drift.
- **PDF-kanalens indhold er ikke læst.** Begge dokumenter er hentet og læst som `.docx`; PDF-udgaven
  bruger samme generator og samme `pdfContext`, men er ikke åbnet. BB-081 og BB-087 er derfor målt i
  Word-kanalen.
- **`PageMessageRow`ens fejlbesked er ikke set i drift.** En fejlende dokumentgenerering kunne ikke
  fremprovokeres; beskeden vises øverst i «Beregnet rente»-boksen, altså langt fra den rækkeknap, der
  udløste den. Om afstanden er et problem, kan ikke afgøres uden at se den.
- **Kun Chrome og lyst tema.** Mørkt tema, Firefox, WebKit og Edge er ikke set.
- **BB-080's øvrige kandidatflader** (Årsløn, EET, Forsørgertab, EO's reguleringsbilag) er læst i
  koden, ikke målt. Satser og Varige mén ER målt.
- **Brevhovedets indhold** er ikke kontrolleret med udfyldt Stamdata; oversigten blev hentet med tom
  Stamdata, så brevhovedet var uden navn og journalnr.

## Åbne spørgsmål

1. **Skal Beregningsdato være udfyldt med dags dato, når fanen åbnes tom?** Ordret det samme
   spørgsmål som MinProcesrentes åbne spørgsmål 1, og svaret bør gælde begge udgaver – men afvejningen
   er en anden i Mineo: her er der ikke tale om en offentlig førstegangsbesøgende, men om en
   sagsbehandler, der åbner fanen midt i en sag, og som i forvejen har «Indsæt dags dato» ved feltet.
   Prisen er også større i Mineo: en forudfyldt dato betyder, at en helt urørt sag har en værdi i
   `renteberegning`-sektionen, så «Slet alle indtastninger» er aktiv fra begyndelsen, og `Gem` har
   noget at gemme, som brugeren ikke selv har skrevet.
2. **Skal en rentelinje kunne bære sit eget kommentarfelt?** Kommentarfeltet hører til fanen, så den
   samme kommentar trykkes på hver enkelt rækkespecifikation. Med tre krav mod tre forskellige
   skyldnere er det den samme sætning i tre dokumenter, der skal hver sin vej. Flade 5 vurderede det
   som «ikke misvisende», og det står ved magt – men i Mineo hentes rækkespecifikationerne enkeltvis
   til hver sin modpart, og spørgsmålet er derfor, om fanens kommentar hører i dem alle.
