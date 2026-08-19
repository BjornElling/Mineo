# Brugerblik — MinProcesrente

- Rute/placering: selvstændig app (`minprocesrente.html`, i drift `minprocesrente.dk`)
- Gennemgået: 2026-08-19 · commit `5859007f`
- Afprøvet i: Chromium headless — 1536×864, 1244×620, 800×900, 650×900, 599×900 samt
  mobilemulering (Pixel, `pointer: coarse`). Dev-server `vite.minprocesrente.config.ts`.

## Fladen kort

MinProcesrente er Mineos eneste offentlige, login-frie flade: én side, der beregner procesrente
efter renteloven. Brugeren angiver én beregningsdato («Rente beregnes til og med»), fylder en tabel
med rentekrav (beløb, «Renter fra», evt. tillægstid med enhed) og henter enten en specifikation pr.
række eller en samlet oversigt som PDF. Der er ingen sidemenu, ingen Gem/Hent, ingen stamdata og
intet brevhoved. Fanen med tabellen er den samme komponent som Mineos Renteberegning-side
(`RenteberegningTab`), men miljøet er et andet: fast PDF-format, egen sessionStorage, egen
fejl-sink — og fladen er den eneste i familien, der bevidst også må vises på telefon.

Fordi tabellen deles med flade nr. 8 (Renteberegning), er gennemgangen her lagt an på **den
offentlige brugers** møde med værktøjet: det, standalone-miljøet gør anderledes, og det, en
førstegangsbruger uden kendskab til Mineo møder. Fund, der stammer fra den delte fane, er markeret,
så flade nr. 8 kan nøjes med det, der er specifikt for Mineo-udgaven.

## Fund

### BB-037 — Tillægstiden kan skubbe rentedatoen forbi beregningsdatoen; så holder rækken tavst op med at regne

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-16--en-komplet-række-programmet-ikke-vil-regne-på`
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Sæt Beregningsdato til dags dato (19-08-2026).
  2. Udfyld en række: Beløb `100.000`, Renter fra `01-01-2020`. Rækken viser Rentedato
     `01-01-2020` og Beregnet rente `59.926,45 kr.`
  3. Skriv `99` i Tillægstid og vælg enheden `Måneder`.
- **Det sker:** Rentedato skifter til `01-04-2028`. Beregnet rente skifter fra et tal til `-`,
  download-ikonet for rækken forsvinder helt, og «Download samlet oversigt» bliver grå. **Intet felt
  er markeret rødt, og der står ingen besked nogen steder** — hverken ved rækken, ved
  beregningsdatoen eller i fejlpanelet. Målt: 0 felter med fejlmarkering på skærmen.
- **Det er uhensigtsmæssigt fordi:** Brugeren har fire udfyldte felter, som hver for sig er
  lovlige, og et resultat, der forsvandt i samme øjeblik han valgte en enhed. Han får ingen
  anvisning på, hvilket af de fire felter der skal ændres — og den eneste rigtige rettelse
  (beregningsdatoen skal frem, eller tillægstiden ned) står to bokse længere oppe på siden. Samtidig
  spærrer den ene række for hele sidens download, så et fuldt udfyldt arbejde ikke kan hentes.
  Programmet ved præcis, hvad der er galt: rentedatoen ligger efter beregningsdatoen. Det siger det
  bare ikke.
- **Bedre ville være:** At den umulige kombination behandles som en almindelig feltfejl på linje med
  «Renter fra»-datoens egen grænse: rød markering på Tillægstid (det felt, der flyttede datoen) med
  tooltippen *«Rentedatoen (01-04-2028) ligger efter beregningsdatoen (19-08-2026)»* — og samme
  besked som blokeringsårsag på de grå downloadknapper. Rentedato-kolonnen kan samtidig vise datoen
  i fejlfarve, så det er tydeligt, hvilken afledt værdi der er problemet.
- **Andre steder det kan gælde:** Samme fane i Mineo (flade nr. 8) har præcis samme adfærd.
  Motorreglen ligger i `validateInterestCalculation`, som har fem afvisningsgrunde, hvoraf ingen
  når brugeren.

### BB-038 — Et beløb på 0 kr. accepteres af feltet, men afvises af beregningen

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-16--en-komplet-række-programmet-ikke-vil-regne-på`
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Sæt Beregningsdato til dags dato og udfyld en gyldig række (`25.000` / `01-01-2024`).
     «Download samlet oversigt» er aktiv.
  2. Udfyld række 2 med Beløb `0` og Renter fra `01-02-2024`.
- **Det sker:** Rækken står med `0,00` og en rentedato, men Beregnet rente viser `-`. Feltet er ikke
  rødt. Den hidtil aktive «Download samlet oversigt» bliver grå med tooltippen «Indtastning
  mangler» — også for den anden, fuldt gyldige række. Målt før/efter: aktiv → deaktiveret.
- **Det er uhensigtsmæssigt fordi:** Beløbsfeltets erklærede grænse er «mindst 0», mens motoren
  kræver «større end 0». De to er uenige, og uenigheden rammer brugeren som en tavs blokering af
  hele siden. En bruger, der taster 0 for at markere en post, han vil regne på senere, mister
  adgangen til sin egen oversigt uden at få at vide hvorfor.
- **Bedre ville være:** At feltets nedre grænse strammes til det, beregningen faktisk kan bruge
  (mindste beløb over nul), så `0` afvises på stedet med rød ramme og tooltippen «Beløbet skal være
  større end 0 kr.». Så er de to regler ét sted, og en tastefejl fanges dér hvor den sker, i stedet
  for at slå ud som en grå knap et andet sted på siden.
- **Andre steder det kan gælde:** Enhver beløbsgrænse erklæret som `0` og senere brugt af en motor,
  der kræver et positivt tal.

### BB-039 — Blokeringen siger «Indtastning mangler», selv om intet mangler

- **Type:** Fejl
- **Rækkevidde:** Lokal (men slægtning til BF-070)
- **Prioritet:** Høj
- **Beslutning:** Agent afgør
- **Sådan fremprovokeres det:** Som BB-037 eller BB-038. Peg på den grå «Download samlet oversigt».
- **Det sker:** Tooltippen siger **«Indtastning mangler»**. Alle felter i rækken er udfyldt, intet er
  tomt, og intet er rødt.
- **Det er uhensigtsmæssigt fordi:** Beskeden sender brugeren ud at lede efter et tomt felt, der
  ikke findes. Det er den samme fejlform, BF-070 rettede andre steder i programmet: klassen skal
  UDLEDES af årsagen. Her er årsagen fastlåst i koden med begrundelsen, at grenen «pr. konstruktion
  kun kan være en ufuldstændig række» — og den præmis er nu målt forkert to gange (BB-037 og
  BB-038). Grenen dækker mindst tre forskellige tilstande, hvoraf kun én er en mangel.
- **Bedre ville være:** At grenen får sin egen årsag pr. tilstand — «En rentelinje kan ikke
  beregnes» ved umulig datorækkefølge, «Et beløb er 0 kr.» ved nulbeløb, og den nuværende ordlyd
  kun ved en reelt ufuldstændig række. Klassen (mangel kontra fejl) skal følge af årsagen, ikke
  vælges på forhånd.
- **Andre steder det kan gælde:** Samme gate bruges af Mineos Renteberegning og af mobilboksen
  «Download som PDF».

### BB-040 — Renten regnes fem år ud over de fastsatte satser; kun PDF'en advarer

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-15--skærmen-tier-hvor-dokumentet-taler`
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Sæt Beregningsdato til `31-12-2031` (accepteres uden bemærkning — det er feltets øvre grænse).
  2. Udfyld en række: Beløb `100.000`, Renter fra `01-01-2020`.
- **Det sker:** Tabellen viser `115.775,14 kr.` uden noget forbehold. Nationalbankens udlånsrente er
  kun fastsat til og med 01-07-2026, altså er alt efter 31-12-2026 regnet med den sidst kendte sats
  ført videre. Henter brugeren derimod PDF'en, står der med fed skrift: *«Der er kun fastsat
  procesrente frem til 31-12-2026. Beregning derefter er hypotetisk!»*
- **Det er uhensigtsmæssigt fordi:** Skærmen er det, brugeren regner efter, og det tal, han skriver
  ind i sit påstandsdokument. Han har ingen anledning til at betvivle det — programmet har jo
  accepteret datoen uden indvending. Forbeholdet findes, er formuleret, og vises kun til den, der
  også henter dokumentet. Fem års hypotetisk rente på 100.000 kr. er et stort beløb at få
  uannonceret.
- **Bedre ville være:** At samme sætning vises på skærmen, så snart beregningsdatoen ligger efter
  den sidst fastsatte sats — som en linje øverst i «Beregnet rente»-boksen med den ordlyd, PDF'en
  allerede bruger. Ét sandt sted for teksten, to visningskanaler.
- **Andre steder det kan gælde:** Enhver generator, der skriver et forbehold, en note eller en
  fodnote, som ikke også står på den flade, tallet kommer fra. Konkret kandidat: oversigts-PDF'ens
  samme advarsel, som heller ikke har nogen skærmpendant.

### BB-041 — Et klik på en kolonneoverskrift låser tabellen i en sortering, der ikke kan slås fra

- **Type:** Fornuft
- **Rækkevidde:** Lokal (gælder alle sorterbare tabeller)
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Skriv tre rækker i den rækkefølge, sagens bilag har: `5.000` / `01-01-2024`, derefter
     `9.000` / `01-02-2024`, derefter `1.000` / `01-03-2024`.
  2. Klik én gang på overskriften «Beløb».
  3. Prøv at komme tilbage til din egen rækkefølge: klik igen, og tryk Ctrl+Z.
- **Det sker:** Rækkerne sorteres efter beløb. Andet klik vender retningen om; der findes **ingen
  tredje tilstand**, der giver den oprindelige rækkefølge tilbage. Ctrl+Z gør ingenting (målt: to
  tryk, ingen ændring). Den nye rækkefølge er samtidig skrevet ind som sidens faktiske rækkefølge —
  efter F5 står rækkerne stadig sorteret, nu uden pilen der forklarer hvorfor. Så længe sorteringen
  er aktiv, hopper en række desuden til en ny plads i samme øjeblik dens beløb afsluttes, mens man
  er ved at udfylde den. I målingen fortsatte sorteringsretningen endda hen over «Slet alle
  indtastninger» (første klik efter rydningen gav faldende, ikke stigende).
- **Det er uhensigtsmæssigt fordi:** Rækkefølgen er brugerens egen — den følger typisk bilagene og
  går igen i den oversigt, han henter som PDF. Et enkelt klik på en overskrift, der ikke ligner en
  knap, ombytter den permanent, og programmets egen fortrydelsesfunktion kan ikke tage den tilbage.
  Det er den værste af de syv prioriteter: noget brugeren har lavet, ændrer sig og kan ikke laves om.
- **Bedre ville være:** At overskriftsklikket får en tredje tilstand, så cyklussen er
  stigende → faldende → **brugerens egen rækkefølge**, og at den oprindelige rækkefølge bevares
  imens. Alternativt at sorteringen kun ændrer visningen og aldrig skrives som sidens rækkefølge,
  så «ingen sortering» altid er ét klik væk.
- **Andre steder det kan gælde:** Alle tabeller, der bruger den fælles sorteringshook — Årsløn,
  Lønindkomst, Offentlige ydelser, Svie og smerte.

### BB-042 — Samme indsatte dato giver to forskellige resultater, alt efter om feltet var tomt

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-14--en-anden-fortolkningsvej-ved-siden-af-tastningen`
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Kopiér teksten `010623` fra et andet dokument.
  2. Indsæt den i et **tomt** «Renter fra»-felt og tryk Tab.
  3. Indsæt derefter den samme tekst i et felt, der **allerede har en dato**: åbn feltet, markér alt
     (Ctrl+A) og indsæt.
- **Det sker:** I det tomme felt bliver værdien `01-06-2023`. I det udfyldte felt bliver den `01` —
  markeret rødt med teksten «Der er udfyldt en ugyldig værdi i feltet 'Renter fra'». Samme
  udklipsholder, samme håndbevægelse, to udfald.
- **Det er uhensigtsmæssigt fordi:** «Markér alt og indsæt» er den naturlige måde at rette en dato
  på. Brugeren har ingen mulighed for at vide, at feltets tidligere indhold afgør, hvordan hans
  indsatte tekst læses — og resultatet i det udfyldte felt er ikke bare anderledes, det er
  ubrugeligt. Det er den anden fortolkningsvej, M-14 blev skrevet om: datofelternes segmentbaserede
  paste kaldes kun, når feltet er tomt.
- **Bedre ville være:** At paste giver samme resultat i begge tilstande. Da datoformens
  segmentfortolkning er en truffet beslutning (BB-003, 2026-08-16: indsættelse må gerne være mere
  tolerant end tastning), er den rigtige retning at lade **det udfyldte felt følge det tomme**: en
  paste, der erstatter hele indholdet, skal behandles som en paste i et tomt felt.
- **Andre steder det kan gælde:** Alle datofelter i programmet — det er ét delt codec. Det var
  M-14's navngivne åbne kandidat, og den er hermed bekræftet levende.

### BB-043 — Fejlen på «Renter fra» navngiver «dags dato» i stedet for Beregningsdato

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør
- **Sådan fremprovokeres det:**
  1. Klik «Indsæt dags dato», så Beregningsdato bliver 19-08-2026.
  2. Skriv `01-01-2027` i «Renter fra».
- **Det sker:** Feltet bliver rødt med tooltippen **«Datoen er efter dags dato (19-08-2026)»**.
  Sættes Beregningsdato i stedet til `30-06-2026` og «Renter fra» til `15-07-2026`, lyder samme
  fejl: «Dato skal være mellem 01-01-2005 og 30-06-2026».
- **Det er uhensigtsmæssigt fordi:** Grænsen kommer fra **Beregningsdato**, ikke fra kalenderen. I
  det klart hyppigste tilfælde — hvor beregningsdatoen netop er dags dato, fordi der er en knap til
  det — genkender beskeden grænsen på dens *værdi* og tilskriver den det forkerte ophav. Brugeren
  får at vide, at datoen ligger i fremtiden, mens problemet i virkeligheden er, at han skal flytte
  beregningsdatoen. I det andet tilfælde er tallet rigtigt, men det står uden afsender, så brugeren
  selv skal gætte, hvor 30-06-2026 kommer fra.
- **Bedre ville være:** At begge udgaver navngiver kilden: *«Datoen er efter Beregningsdato
  (19-08-2026)»*. Feltet erklærer allerede sin grænse som udledt af Beregningsdato; beskeden skal
  bruge den oplysning i stedet for at genkende grænsen på dens værdi.
- **Andre steder det kan gælde:** Reglen «max er lig dags dato → skriv *dags dato*» er fælles for
  hele programmet og rammer ethvert felt, hvis udledte grænse tilfældigvis lander på i dag.

### BB-044 — Bekræftelsen taler om `.eo`-filer, som ikke findes i minProcesrente

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:** Klik «Slet alle indtastninger» på minprocesrente.dk.
- **Det sker:** Dialogen «Slet indtastningerne på denne side» siger: *«Dette sletter alle de værdier,
  du har indtastet på denne side. Indholdet i gemte .eo-filer ændres ikke. Handlingen kan
  fortrydes.»*
- **Det er uhensigtsmæssigt fordi:** MinProcesrente har hverken Gem, Hent eller filformat. En
  offentlig besøgende har aldrig set en `.eo`-fil og kan kun forstå sætningen som, at han måske har
  nogle filer, der kan tage skade. Beroligelsen skaber den bekymring, den skulle fjerne. Dertil
  kommer, at «Handlingen kan fortrydes» kun er sandt via Ctrl+Z — der er ingen synlig
  fortryd-knap på fladen, og på telefon findes muligheden slet ikke.
- **Bedre ville være:** At sætningen om `.eo`-filer udgår i standalone-udgaven, og at teksten der
  lyder: *«Dette sletter alle de værdier, du har indtastet. Du kan fortryde med Ctrl+Z.»* Mineos
  egen udgave beholder sin nuværende ordlyd.
- **Andre steder det kan gælde:** Enhver tekst i den delte fane, der forudsætter Mineos begreber.
  Gennemgangen fandt ikke flere: `.eo` er den eneste.

### BB-045 — Telefonlayoutet tændes i et smalt vindue, men indholdet bliver ved med at være 1200 px bredt

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-09--fast-indholdsbredde`
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør
- **Sådan fremprovokeres det:** Åbn minprocesrente.dk i et almindeligt browservindue (mus, ikke
  touch), og gør vinduet smallere end 600 px — eller zoom til 250 % på en 1366 px skærm, hvilket
  giver den samme CSS-bredde.
- **Det sker:** Siden skifter til telefonudgaven med tre kolonner (Beløb, Renter fra, Beregnet
  rente), men indholdsboksen bliver stående på sine 1200 px. Målt ved 599 px vindue: tabellen er
  1174 px bred i et 567 px synligt felt. Beregningsdato-feltet, «Renter fra» og «Beregnet rente»
  ligger uden for skærmen og kan kun nås ved at rulle godt 600 px sidelæns.
- **Det er uhensigtsmæssigt fordi:** Det er dårligere end begge de layouts, der findes: den
  almindelige desktopudgave ville vise mere, og telefonudgaven er netop lavet for at undgå sidelæns
  rul. Årsagen er, at de to beslutninger er truffet på hver sit grundlag — layoutet skifter på
  **vinduets bredde**, mens den bredde-rettelse, der hører til, kun gælder **touch-enheder**.
  En zoomende bruger på en almindelig computer falder ned mellem dem.
- **Bedre ville være:** At indholdsboksens breddeoverstyring gælder de samme tilfælde som
  telefonlayoutet — altså også et smalt musevindue — så tabellen fylder vinduet i stedet for at
  hænge ud over det.
- **Andre steder det kan gælde:** Kun standalone; Mineo er desktop-only og blokerer på touch.

### BB-046 — Tillægstiden regner videre, men er usynlig i telefonlayoutet

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Udfyld på en almindelig skærm: Beløb `100.000`, Renter fra `01-01-2024`, Tillægstid `30` dage.
     Rækken viser Rentedato `31-01-2024` og `27.111,89 kr.`
  2. Gør vinduet smallere end 600 px (eller zoom ind), så telefonlayoutet tændes.
- **Det sker:** Rækken viser nu `100.000,00` · `01-01-2024` · `27.111,89 kr.` Både tillægstiden,
  enheden og den afledte rentedato er væk fra skærmen — men renten er stadig beregnet fra 31-01-2024.
  De to synlige oplysninger kan ikke give det viste tal, og der er ingen måde at se eller fjerne
  tillægstiden på: telefonudgaven har kun knapperne «Indsæt dags dato» og «Download som PDF».
- **Det er uhensigtsmæssigt fordi:** Et skjult felt, der stadig tæller med, er præcis det, resten af
  programmet undgår — ellers står brugeren med et tal, han hverken kan forklare eller rette.
  Renteperioden i den PDF, han henter, starter samtidig et andet sted end den dato, skærmen viser.
- **Bedre ville være:** At telefonudgaven viser den afledte rentedato, når den afviger fra «Renter
  fra» — fx som en lille linje under datoen: *«rentedato 31-01-2024»*. Alternativt at tillægstiden
  neutraliseres i beregningen, når den ikke kan ses; men det ændrer et tal og er dermed brugerens
  valg.
- **Andre steder det kan gælde:** Ingen andre — MinProcesrente er den eneste flade med to
  kolonnesæt.

### BB-047 — «Slet alle indtastninger» kan ikke nås med tastaturet

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Agent afgør
- **Sådan fremprovokeres det:** Sæt fokus i Beregningsdato og tryk Tab gentagne gange.
- **Det sker:** Tab-ringen er: Beregningsdato → Indsæt dags dato → rækkens fire felter → rækkens
  downloadknap → næste række → Download samlet oversigt → Kommentarer → forfra. **«Slet alle
  indtastninger» indgår aldrig.** Knappen står i en række, der ser ud præcis som «Download samlet
  oversigt» lige over den — og dén er med.
- **Det er uhensigtsmæssigt fordi:** To knapper, der er tegnet ens og står under hinanden, opfører
  sig forskelligt over for tastaturet, uden at noget forklarer forskellen. BF-038 tog netop
  «Indsæt dags dato» og de synlige downloadknapper ind i ringen; denne blev ikke med.
- **Bedre ville være:** At knappen markeres som fokusérbar på samme måde som sin nabo. Bemærk, at
  det ikke gælder «Slet rækken», som bevidst er uden for tastaturnavigationen.
- **Andre steder det kan gælde:** Samme række findes i Mineos Renteberegning. Bemærk desuden, at
  telefonudgaven slet ikke har rækken: dér kan alle indtastninger kun ryddes felt for felt.

### BB-048 — Arbejdet kan lukkes væk uden varsel

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:** Udfyld beregningsdato og et antal rentekrav. Luk fanen.
- **Det sker:** Fanen lukker uden spørgsmål, og alt er væk. F5 og genindlæsning er derimod sikre —
  indtastningerne ligger i fanens egen sessionslagring og kommer tilbage (målt). Der er ingen Gem,
  ingen fil og ingen advarsel; det eneste varige spor er den PDF, brugeren måtte have hentet.
  Mineo viser i samme situation browserens «vil du forlade siden?».
- **Det er uhensigtsmæssigt fordi:** En sag med tyve rentekrav er en halv times arbejde, og
  værktøjet er offentligt — brugeren har ingen grund til at forvente, at der ikke er noget net
  under. Forskellen til søskendefladen er ikke synlig for ham.
- **Bedre ville være:** Den samme advarsel som i Mineo, men kun når der er indtastninger, som ikke
  er hentet som PDF siden sidste ændring. Så generer den ikke den, der lige har hentet sit dokument.
- **Andre steder det kan gælde:** Ingen — Mineo har allerede advarslen.

## Overvejet uden fund

- **Førstegangsindtrykket.** Siden åbner med tom beregningsdato, én tom tabelrække og alle
  resultatfelter som `-`. Det er forståeligt: det manglende felt er sidens øverste boks. (Se dog
  åbent spørgsmål 1.)
- **Grænse-eftersynet, felt for felt.** Beregningsdato og «Renter fra»: 01-01-2005 til 31-12 fem år
  frem — nedre grænse er den tidligste kendte referencesats, øvre er bevidst vid. Tillægstid: 0–99,
  to cifre, ikke-negativ, håndhævet ved tastning (BF-018). Beløb: ikke-negativt med decimaler.
  Kommentarer: 512 tegn (BF-035). Enhed: tre valg, aldrig tom. Alle felter har erklærede grænser,
  der passer til feltet — undtagelsen er beløbets nul (BB-038).
- **Nedre datogrænse på 01-01-2005 annonceres ikke.** Efter Satsers afgørelse (lukket spor 1) er det
  ikke et fund: procesrentekrav ældre end 20 år rammer i praksis ingen.
- **Ugyldig og umulig dato.** `99-99-9999`, `31-02-2024` og en dato uden for intervallet bevares som
  afvist råtekst med rød ramme og konkret tooltip. Indsat `01-01-2045` (uden for grænsen) blev
  **ikke** afkortet til noget gyldigt — den blev stående som skrevet. Det er den rigtige adfærd og
  bekræfter, at datoernes paste ikke har den fejl, årsfelterne havde (BB-031).
- **Ændret forudsætning bagefter.** Sættes beregningsdatoen tilbage, efter at rækkerne er udfyldt,
  bliver de nu ugyldige «Renter fra»-felter røde med det samme. Rækkerne beholder deres værdier.
- **Tom række-begrebet.** En række, hvor kun enheden er valgt, tæller som tom og bliver ikke gemt.
  Tømmes en udfyldt række, forsvinder den helt — også på telefon, hvor der ikke er nogen
  slet-knap. Det er den rigtige adfærd og gør slet-knappens fravær på telefon acceptabelt.
- **Undo/redo.** Ctrl+Z gendanner både «Slet alle indtastninger» og enkeltrettelser korrekt.
  Undtagelsen er sortering (BB-041).
- **Genindlæsning.** F5 bevarer alt. Sorteringspilen forsvinder, men rækkefølgen er den sorterede —
  hvilket netop er, hvad BB-041 handler om.
- **Downloads.** Både rækkens specifikation og den samlede oversigt hentes uden fejl; filnavnene er
  sigende (`Procesrente, 100.000,00 kr. (31-01-2024 - 19-08-2026).pdf`). Konsollen var tavs gennem
  hele gennemgangen: 0 fejl, 0 advarsler.
- **Deaktiveret downloadknap er tavs ved klik** og forklarer sig kun i tooltip — som besluttet.
- **Links.** Titel-linket (`minProcesrente.dk`) og søskendelinkene i bunden er uden for
  Tab-rækkefølgen, jf. brugerens afgørelse i M-08. Titel-linket peger på sidens egen rod og er
  dermed en genindlæsning af samme side.
- **Rul-til-toppen-knappen findes ikke i standalone**, så M-10 giver intet her.
- **Bredde ved de understøttede mål.** 1536×864 og 1244×620 viser hele tabellen (1131 px) uden
  vandret rul af siden. Mellem 600 og ca. 1200 px kræves vandret rul inde i tabelboksen — den
  accepterede M-09-fallback. Problemet ligger under 600 px (BB-045).
- **Telefonudgaven på en rigtig telefonbredde** (412 px, touch) er korrekt: indholdsboksen følger
  viewporten, felterne åbnes med ét tryk, og hover-baggrunde er slået fra.
- **Beregningstekniske forudsætninger** står som fire linjer nederst og svarer til det, motoren
  faktisk gør (365/366 dage, udlånsrente + 8 %/7 %, ingen renters rente). De nævner ikke, hvor langt
  satserne er fastsat — det er BB-040.
- **Kommentarfeltet** følger med i både rækkens specifikation og det samlede dokument. At samme
  kommentar gentages på hver side i samledokumentet er en konsekvens af, at kommentaren hører til
  siden og ikke til rækken; det er ikke misvisende.
- **Sagsdata slipper ikke ud.** Fladen sender intet; PDF'en bygges lokalt, og de tunge
  PDF-biblioteker hentes først ved download.

## Dækningshuller

- **PDF'ens faktiske indhold er ikke læst.** Advarslen «Beregning derefter er hypotetisk!» er
  verificeret i generatoren og i to enhedstests, ikke ved at åbne den hentede fil.
- **Rigtig telefon og tablet.** Kun Chromiums enhedsemulering er brugt. Tryk-mål, tastaturets
  fremkomst og iOS-Safaris zoom ved fokus er ikke set.
- **Produktionens rod-URL.** Titel-linket peger på `/`. I udviklingsserveren serverer `/` Mineos
  egen indgang, så linkets virkning i drift (hvor `/` er samme side) er udledt af buildet, ikke målt.
- **Print (Ctrl+P) og offline/service worker** er ikke gennemgået.
- **Meget store datamængder** (fx 100 rentekrav) er ikke afprøvet.

## Åbne spørgsmål

1. **Skal Beregningsdato være udfyldt med dags dato, når siden åbnes tom?** I dag er feltet tomt, og
   intet regnes, før brugeren enten taster datoen eller trykker «Indsæt dags dato». Langt de fleste
   besøgende vil beregne rente frem til i dag. Fordelen ved en forudfyldt dato er, at værktøjet
   virker med det samme; prisen er, at siden ikke længere er helt tom ved start — «Slet alle
   indtastninger» ville være aktiv fra begyndelsen, fordi der står en værdi, brugeren ikke selv har
   skrevet.
2. **Skal tillægstid kunne bruges på telefon?** I dag findes kolonnerne «Evt. tillægstid», «Enhed»
   og «Rentedato» kun på den store skærm. Er det en bevidst forenkling af telefonudgaven — eller
   skal telefonen kunne det samme, blot i en anden opstilling? Svaret afgør, om BB-046 skal løses
   ved at *vise* rentedatoen eller ved at *give adgang til* tillægstiden.
