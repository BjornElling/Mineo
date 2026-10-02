# Brugerblik – Erstatningsopgørelse → Beregningsgrundlaget for TAF (12f)

- Rute/placering: `/erstatningsopgoerelse` → fanen «EO oplysninger», sektionen **Indtægt før skadedatoen**
  (`data-section-id="taf-beregningsgrundlag"`): «Beregnes ud fra» og dens tre grene – **Beregningsperiode** (periode,
  «Ferie i beregningsperioden», «Uspecificerede ferie-/feriefridage», «Øvrigt fravær uden løn» med antal og årsag),
  **Angivet månedsløn** og **Angivet dagsløn** (beløb, «- baseret på», datoen for det angivne beløb, «Løn på
  helligdage», Store Bededagstillæg) – samt underafsnittet «Beregningsgrundlag» i opgørelsens TAF-afsnit og de
  tilhørende linjer i «Fejl og advarsler».
- Gennemgået: 2026-10-02 · commit `0bfec2b8` · **afgjort og gennemført 2026-10-02** (15 rettet – BB-261 kun del 2 –
  og ét afvist, BB-273; BB-260, BB-261 del 2 og BB-272 afgjort efter modsvar)
- Afprøvet i: Chrome headless, lyst tema, 1536×864 (M-09 desuden 1244×620). Dokumenter hentet som `.pdf` og læst med
  `pdftotext -raw`. Sag: skadedato `01-06-2018`, «Vedrører perioden» `01-01-2024` – `31-12-2024`, «Opgørelse lavet
  den» `01-02-2025`, TAF-periode hele 2024. Beregningsperiode `01-06-2017` – `31-05-2018` med ét ansættelsesforhold,
  12 lønrækker à `30.000 kr.` (juni 2017 – maj 2018), lønudvikling og sygeferiegodtgørelse «Ingen». Måneder med «Fuld
  løn under ferie» slået til; arbejdsdage med den slået fra.

## Fladen kort

Sektionen bestemmer, hvad én måned eller én arbejdsdag er værd før skaden. Det sker enten ud fra en
**beregningsperiode**, hvor lønnen fra Lønindkomst deles med periodens måneder eller arbejdsdage, eller ud fra en
**angivet** måneds- eller dagsløn. Enheden (måneder/arbejdsdage) udledes af programmet: angivet månedsløn giver
måneder, angivet dagsløn arbejdsdage, og beregningsperioden giver måneder, medmindre et ansættelsesforhold under
Lønindkomst har andet end almindelig løn på helligdage og fuld løn under ferie (`computeTafBeregningsenhed`).

I måneder fradrages kun «Øvrigt fravær uden løn» (4,8 % af en måned pr. dag); i arbejdsdage fradrages SH-dage, ferie,
uspecificerede ferie-/feriefridage og øvrigt fravær. Resultatet – månedsløn eller dagsindkomst – vises ikke på
skærmen (afgjort ved BB-226), kun i papirets «Beregningsgrundlag».

**Fladens gennemgående træk er, at grundlaget kan blive nul eller næsten nul, uden at nogen regel siger det.** Tre
lovlige indtastninger fører beregningen ud i en «intern beregningsfejl» (BB-258), og én dag under grænsen giver en
dagsindkomst på 360.000 kr. uden et ord (BB-259). Dertil gentager fladen 12e's billede: reglerne om ferie,
uspecificerede dage og øvrigt fravær når ikke cellen (BB-264), og i måneder står ferie og uspecificerede dage åbne
uden at gøre noget (BB-263, M-35). Og to af fladens felter mangler M-32's relevans, så en skjult værdi spærrer (BB-266).

**Afgrænsning.** Lønudviklingen, anciennitetstillægget og løntrin-finderen hører i 12i. Lønrækkerne og
«Fuld løn under ferie»/«Løn på helligdage» pr. ansættelsesforhold hører i 12g–12h. Togglen «Skjul beregning efter
første opgørelse» er gennemgået i 12a (BB-203). Offentlige ydelser i beregningsperioden hører i 12k.

## Fund

### BB-258 – Tre lovlige indtastninger giver «intern beregningsfejl»

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-36--en-lovlig-indtastning-fører-beregningen-ud-i-en-intern-undtagelse`
  og `#m-24--feltets-grænse-er-sat-af-feltets-art-ikke-af-det-tal-det-trækkes-fra`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02 i form (a): rød ring «Månedslønnen skal være større end
  0 kr.», og lignende tilfælde skal også rettes. **GENNEMFØRT** 2026-10-02: alt, der kan efterlade en nævner på 0,
  er nu en rød feltfejl, der standser beregningen før motoren (`beregningsgrundlagCellIssues.ts`,
  `beregningsgrundlagFradragRules.ts`). Grænsen regnes med motorens egne funktioner: i måneder «Fraværet overstiger
  beregningsperioden (højst 249 fraværsdage)», i arbejdsdage «Der skal være mindst én arbejdsdag tilbage i
  beregningsperioden (højst 250 løse ferie-/feriefridage)» / «(højst … fraværsdage)» – løse dage og fravær, der
  tilsammen æder perioden, får hver sin grænse, og kun det fradrag, der selv kan rettes, markeres. Ferie over hele
  perioden farver ferien, og en periode uden arbejdsdage farver periodens datoer. Månedsløn og dagsløn på 0 kr. er
  røde. De lignende tilfælde, en probe fandt: angivet dagsløn 0 kr. (rettet som månedsløn), en beregningsperiode uden
  indtægt over 0 kr. med en anden lønudvikling end «Ingen» (nu en valideringsfejl, der standser motoren; linjen er
  den eksisterende «Ingen indkomst i beregningsperioden»), og offentlige ydelser med 0 måneder tilbage (dækket af
  fraværsgrænsen). Sygeferiegodtgørelsen og anciennitetstillægget kunne ikke bringes til en undtagelse.
- **Sådan fremprovokeres det:**
  1. Måneder. «Øvrigt fravær uden løn» slået til, «Antal fraværsdage (mandag-fredag)» `300`.
  2. Arbejdsdage. «Uspecificerede ferie-/feriefridage» `251`. (Med `252` skriver boksen «… overstiger mulige
     arbejdsdage i beregningsperioden (**maksimalt 251**)».)
  3. «Angivet månedsløn», «Månedslønnen udgør» `0`.
- **Det sker:** I alle tre er feltet neutralt, og boksen har én linje uden link: «**EO-beregningen kan ikke gennemføres
  på grund af en intern beregningsfejl.**» Download er spærret. Konsollen logger `Loenudvikling kan ikke beregnes:
  mangler beregningsgrundlag` (`loenudviklingBeregning.ts:143`/`:321`). Årsagen er den samme: 300 × 4,8 % = 14,4
  måneder af 12, og 251 af 251 arbejdsdage, efterlader en nævner på 0; et beløb på 0 er et grundlag på 0. Ingen
  feltregel fanger det først – feltloftet er 366 dage for begge dagsfelter, og beløbet skal blot være ≥ 0.
  Nr. 2 er den skarpeste: boksen siger selv, at 251 er tilladt, og 251 er netop den værdi, der vælter beregningen.
- **Det er uhensigtsmæssigt fordi:** Brugeren får at vide, at programmet har en fejl, ikke at hans tal er umuligt, og
  intet peger på feltet. En bruger, der taster ét ciffer for meget i fraværsdagene, kan ikke selv finde årsagen.
- **Bedre ville være:** Dagfelterne får en rød ring, før grundlaget bliver 0: «Fraværet overstiger beregningsperioden
  (højst 249 fraværsdage)» og «Der skal være mindst én arbejdsdag tilbage i beregningsperioden (højst 250
  uspecificerede ferie-/feriefridage)» – samme form som BB-252. For 0 kr. skal udvikleren vælge: (a) rød ring «Månedslønnen
  skal være større end 0 kr.», eller (b) 0 kr. er en gyldig oplysning, og kravet opgøres til 0 kr. Uanset valget må
  en indtastning aldrig nå frem til en intern undtagelse.
- **Andre steder det kan gælde:** `throw new Error('… kan ikke beregnes …')` findes 75 gange i
  `src/domain/erstatningsopgoerelse/engines` (lønudvikling, offentlige ydelsers udvikling, de syv reguleringsformer,
  sygeferiegodtgørelsen). Uverificerede kandidater: offentlige ydelser i en beregningsperiode med 0 måneder tilbage
  (`offentligeYdelserUdviklingBeregning.ts:197`, 12k), «Angivet dagsløn» `0`, lønrækker med kun `0 kr.` (12h).

**Tilbagemelding**
Enig. Og for 0 kr. skal løsningen være: (a) rød ring «Månedslønnen skal være større end 0 kr.» Kontroller venligst gerne, om der er nogen andre lignende problemstillinger, fx. ved 'Angivet dagsløn' og ret også disse.

### BB-259 – Én arbejdsdag tilbage giver en dagsindkomst på 360.000 kr. uden et ord

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-24--feltets-grænse-er-sat-af-feltets-art-ikke-af-det-tal-det-trækkes-fra`
  og `#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02 med den foreslåede grænse (under en fjerdedel).
  **GENNEMFØRT** 2026-10-02: gul, ikke-blokerende ring på hvert indtastet fradrag og linjen «Fradragene efterlader
  kun 1 af 251 arbejdsdage i beregningsperioden» / i måneder «Fraværet efterlader kun 0,48 af 12 måneder i
  beregningsperioden». Er det kun ferien, der æder perioden, står advarslen i boksen med link til ferietabellen.
- **Sådan fremprovokeres det:** Arbejdsdage, beregningsperiode med 251 arbejdsdage. «Uspecificerede
  ferie-/feriefridage» `250`. Hent opgørelsen.
- **Det sker:** Boksen er væk, feltet er neutralt, og papiret skriver «I perioden var der 261 hverdage - 10 SH-dage - 250
  ferie-/feriefridage = 1 arbejdsdage» og «Dagsindkomst: 360.000,00 kr. / 1 arbejdsdag = **360.000,00 kr.**». Samme
  form med øvrigt fravær i måneder: 240 fraværsdage i 12 måneder efterlader 0,48 måned (regnet, ikke målt).
- **Det er uhensigtsmæssigt fordi:** Skærmen viser bevidst ikke resultatet (BB-226), så brugeren har ingen anledning
  til at tvivle, før papiret ligger hos modparten. Et grundlag, hvor fradragene æder næsten hele perioden, er næsten
  altid en tastefejl – fx 250 for 25.
- **Bedre ville være:** En gul, ikke-blokerende ring på det felt, der æder perioden, når fradragene tilsammen efterlader
  under en fjerdedel af periodens arbejdsdage (eller måneder): «Fradragene efterlader kun 1 af 251 arbejdsdage i
  beregningsperioden». Grænsen er udviklerens.
- **Andre steder det kan gælde:** TAF-periodernes «Løse ferie-/feriefridage» (12e, BB-252) har samme rand: én dag under
  maksimum giver 1 TAF-arbejdsdag, men der er det kravet og ikke grundlaget, der bliver lille.

**Tilbagemelding**
Enig.

### BB-260 – En beregningsperiode med huller i lønoplysningerne udtynder månedslønnen tavst

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** **Høj**
- **Beslutning:** Først **afvist** (huller kan være lovlige, fx dagpenge), derefter **GODKENDT efter modsvar**
  2026-10-02: dagpenge registreres under Offentlige ydelser og tæller som indkomst, så advarslen begrænses til helt
  tomme huller. **GENNEMFØRT** 2026-10-02: gul linje med link til Lønindkomst (første ansættelsesforhold) –
  «Der er hverken angivet løn eller offentlige ydelser for 01-06-2016 - 31-05-2017 i beregningsperioden». Et hul
  uden en eneste arbejdsdag (fx en weekend mellem to dagrækker) tæller ikke, og ved slet ingen indkomst siger
  «Ingen indkomst i beregningsperioden» det alene (`beregningsperiodeIndkomstHuller.ts`).
- **Sådan fremprovokeres det:** Måneder. Lønrækker for juni 2017 – maj 2018 (12 × 30.000 kr.). Beregningsperiode
  `01-06-2016` – `31-05-2018`. Hent opgørelsen.
- **Det sker:** Ingen boks, ingen ring. Papiret: «Løn i beregningsperioden 360.000,00 kr. / I perioden var der 24
  måneder. / Månedsløn: 360.000,00 kr. / 24 måneder = **15.000,00 kr.**» – halvdelen af den løn, der står i hver
  eneste lønrække. Programmet ved, hvilke måneder der har en lønrække (`buildIncomeForRanges`); kun tilfældet «slet ingen
  indkomst» meldes («Ingen indkomst i beregningsperioden»).
- **Det er uhensigtsmæssigt fordi:** En for tidlig fra-dato eller et glemt år lønsedler halverer kravet uden et spor på
  skærmen. Huller kan være rigtige (ulønnet orlov), men så er det brugerens valg, ikke programmets tavshed.
- **Bedre ville være:** En gul, ikke-blokerende advarsel med link til Lønindkomst: «Der er ikke angivet løn for
  01-06-2016 - 31-05-2017 i beregningsperioden». Ved flere ansættelsesforhold gælder den perioder, hvor ingen af dem
  har en lønrække.
- **Andre steder det kan gælde:** Lønindkomstens rækker (12h) – samme hul set fra den anden side. Offentlige ydelser i
  beregningsperioden (12k).

**Tilbagemelding**
Jeg forstår hensynet, og er principielt enig - men jeg tror der vil være for mange særlige situationer, som er legitime og vil udhule beskyttelsen, fx. når huller i lønoplysningerne beror på at vedkommende i en periode har modtaget dagpenge, hvilket er en helt almindeligt forekommende omstændighed. Så jeg tror, jeg afviser fundet.

### BB-261 – Beregningsperioden kan ligge efter skadedatoen, og det angivne beløb kan dateres frem i tiden

- **Type:** Edge case
- **Rækkevidde:** Lokal (B0)
- **Prioritet:** Mellem
- **Beslutning:** Del 1 **afvist** af udvikleren 2026-10-02: en beregningsperiode efter skaden er lovlig, når der
  ikke er en før skaden, og lønnen efter sygeperioden nedreguleres. Del 2 **GODKENDT efter modsvar** 2026-10-02:
  loft ved dags dato. **GENNEMFØRT** 2026-10-02: «Det angivne beløb afspejler månedslønnen/dagslønnen per dato» har
  dags dato som loft med BB-208's ordlyd «Dato skal være mellem 01-01-2005 og dags dato (…)».
- **Sådan fremprovokeres det:**
  1. Beregningsperiode `01-01-2018` – `31-12-2018` (skadedato `01-06-2018`). Hent opgørelsen.
  2. «Angivet månedsløn», «Det angivne beløb afspejler månedslønnen per dato …» `31-12-2027`.
- **Det sker:** 1: Ingen ring, ingen advarsel. Papiret under overskriften «Indtægt før skadedatoen»: «Opgøres på
  baggrund af indkomsten i perioden 01-01-2018 - 31-12-2018. … Månedsløn: 150.000,00 kr. / 12 måneder = 12.500,00
  kr.» – syv måneder efter skaden tælles med som måneder uden løn. Begge periodefelter har kun systemrammen
  (`erstatningsopgoerelseDescriptors.ts:718-725`); den eneste regel er overlap med en TAF-periode (BB-262).
  2: Tages imod; grænsen er «Dato skal være mellem 01-01-2005 og 31-12-2027» – et beløb, der afspejler lønnen om et år.
- **Det er uhensigtsmæssigt fordi:** Sektionen hedder «Indtægt før skadedatoen», og programmet kender skadedatoen. En
  periode, der rækker ind over den, er en tastefejl i årstallet, og den koster lige så meget som BB-260.
- **Bedre ville være:** «Periode til beregning af før-løn» får skadedatoen (anmeldelsesdatoen ved erhvervssygdom) som
  loft med rød ring: «Dato skal være før skadedatoen (01-06-2018)». Datoen for det angivne beløb får dags dato som loft
  («… og dags dato (DD-MM-ÅÅÅÅ)», BB-208's ordlyd). Ønsker udvikleren at tillade en periode ind over skadedatoen, så en
  gul advarsel i stedet.
- **Andre steder det kan gælde:** Lønindkomstens «Særlig fra-dato for regulering» (12g) – uafprøvet.

**Tilbagemelding**
Jeg tenderer mod at afvise fundet. Når det er lavet på denne måde, skyldes det, at der i en del tilfælde ikke vil være en beregningsperiode før skaden at tage afsæt i. Hvis den skadelidte bliver raskmeldt igen efter EO-perioden, vil man derfor i disse tilfælde ofte bruge lønnen efter sygeperioden til at beregne en referenceløn, og da nedregulere den til værdien i EO-perioden.

### BB-262 – Overlap mellem beregningsperioden og en TAF-periode spærrer uden rød celle og uden link til feltet

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
  (BB-218's form)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02 med ønsket om én samlet løsning for fra/til-overlap.
  **GENNEMFØRT** 2026-10-02: `periodOverlapIssues.ts` er nu programmets ene overlapsregel og tager vilkårligt mange
  kilder – en tabel eller et skalart datopar – så overlap inden for en tabel og mellem beregningsperioden og
  TAF-perioderne går samme vej. Begge beregningsperiodens datoer og den overlappende TAF-rækkes datoer er røde med
  «Perioden overlapper TAF-perioden 01-06-2018 - 30-06-2018» / «Perioden overlapper beregningsperioden 01-07-2017
  - 30-06-2018»; en TAF-celle, der overlapper både en anden TAF-række og beregningsperioden, får ét issue med begge.
  Linjen fører til beregningsperiodens fra-dato og siges én gang. En kortlægning af alle fra/til-par i programmet
  fandt ingen andre overlapsregler uden for den fælles form: lønindkomst og offentlige ydelser tillader overlap
  bevidst, og de øvrige sider har ingen overlapsregel. To ubrugte hjælpere (`detectOverlappingPeriodPartners`,
  `buildBeregningsperiodeTafOverlap`) er fjernet.
- **Sådan fremprovokeres det:** Beregningsperiode `01-07-2017` – `30-06-2018`, TAF-række `01-06-2018` – `30-06-2018`.
  Gå til Beregning.
- **Det sker:** Alle fire datoceller er neutrale. Boksen: «Der er overlap mellem beregningsperioden (01-07-2017 -
  30-06-2018) og en TAF-periode (01-06-2018 - 30-06-2018)» med kun sektionslinket «Indkomstgrundlag». Download er
  spærret. Overlappet findes pr. TAF-række (`overlapMessageByRowId`, `beregningsperiodeTafOverlap.ts:61-67`), men
  ingen celle får det.
- **Det er uhensigtsmæssigt fordi:** Beskeden nævner to perioder i to sektioner, og brugeren skal selv finde begge.
  12e gav TAF- og ferieoverlap rød celle med modpartens periode i tooltippen (BB-251); her er formen ikke fulgt med.
- **Bedre ville være:** BB-251's form: begge beregningsperiodens datoer og den overlappende TAF-rækkes datoer røde,
  hver med «Overlapper TAF-perioden 01-06-2018 - 30-06-2018» / «Overlapper beregningsperioden 01-07-2017 -
  30-06-2018», og linket fører til beregningsperiodens fra-dato.
- **Andre steder det kan gælde:** Ingen nye.

**Tilbagemelding**
Enig. Der er mange dato-felter i programmet, som er fra- og til-datoer. Hvis det giver mening at lave en samlet løsning til at håndtere overlap, så de alle håndteres ensartet og ud fra en gennemtænkt, stabil løsning, så overvej gerne at implementere en sådan.

### BB-263 – I måneder tager ferie og uspecificerede dage imod oplysninger, der intet gør – og de kan stadig spærre

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-35--et-synligt-felt-som-den-aktuelle-beregningsmåde-ikke-læser`
  (mønsterets navngivne 12f-kandidat, bekræftet)
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02 på betingelse af, at ferieoplysningerne ikke bruges andre
  steder. Kontrolleret 2026-10-02: i måneder ændrer de hverken et beløb, en nævner, papirets tekst, offentlige
  ydelser, lønudvikling, regulering eller sygeferiegodtgørelsen, som bruger TAF-afsnittets EGNE ferieperioder. De
  virkede kun som validering og som tekst i kontrollaget. **GENNEMFØRT** 2026-10-02: i måneder skjules «Ferie i
  beregningsperioden» og «Løse ferie-/feriefridage» uden forklarende linje; descriptorerne har relevansen
  «TAF aktiv, beregningsperiode og arbejdsdage» (`erBeregningsperiodeFerieRelevant`), så værdierne er tomme for alle
  læsere, bevares og kommer tilbage med enheden.
- **Sådan fremprovokeres det:** Måneder («Fuld løn under ferie» slået til). Ferie i beregningsperioden `03-07-2017` –
  `21-07-2017`, «Uspecificerede ferie-/feriefridage» `5`. Hent opgørelsen. Derefter `300` i uspecificerede, eller en
  ferierække `01-07-2016` – `14-07-2016`, eller to overlappende ferierækker.
- **Det sker:** Ferierækken viser «Feriedage **15**», og papiret er ordret det samme som uden ferie: «I perioden var der
  12 måneder. / Månedsløn: 360.000,00 kr. / 12 måneder = 30.000,00 kr.» Men felterne kan stadig spærre: `300` giver
  «Uspecificerede ferie-/feriefridage overstiger mulige arbejdsdage i beregningsperioden (maksimalt 236)», ferien uden
  for perioden «Ferieperioden ligger uden for beregningsperioden», overlap «Der er overlappende ferieperioder i
  beregningsperioden» – alle tre spærrer download i en sag, hvor ingen af værdierne indgår i noget tal.
  **Prøvens fjerde trin (M-35) er gået:** `fravaerPerioder` og `uspecificeredeFerieFridage` læses af beregningen kun i
  arbejdsdage (`indkomstSkadestidspunktBeregning.ts:304-339`, `indtaegtPerioder.ts:271-277`,
  `loenindkomstRowDerived.ts:53-60`, `indkomstRowValidation.ts:147-152`); sygeferiegodtgørelsen, som gjorde TAF-ferien
  virksom i måneder (BB-247), læser dem ikke. Kun kontrolfladerne (12m) og valideringen læser dem i måneder.
- **Det er uhensigtsmæssigt fordi:** Den, der udfylder ferien fra lønsedlerne, gør det forgæves i en ny sag – og får
  derefter en spærret opgørelse for en uvirksom indtastning. Enheden kan skifte ved én afkrydsning under Lønindkomst,
  så den samme ferie kan pludselig begynde at tælle.
- **Bedre ville være:** Som BB-247: i måneder skjules «Ferie i beregningsperioden» og «Uspecificerede
  ferie-/feriefridage» uden forklarende linje; descriptorerne får relevansen «beregningsperiode OG arbejdsdage», så de
  skjulte værdier er tomme for alle læsere, bevares og kommer tilbage, hvis enheden skifter.
- **Andre steder det kan gælde:** Ingen nye; mønsterets sidste kandidat («Løn på helligdage» under angivet månedsløn)
  er ikke uvirksom – den læses af reguleringen (12i).

**Tilbagemelding**
Kontroller venligst, at der ikke er nogen andre steder, som anvender ferieoplysninngerne, fx. ved beregning af sygeferiegodtgørelse. Hvis du kan forsikre, at de ikke anvendes andre steder, må du gerne ændre. Hvis de faktisk har et formål, skal de fortsætte med at blive vist som nu, og rød ring skal også fortsætte med at blokere downloads.

### BB-264 – Beregningsgrundlagets ferie- og dagsregler spærrer uden rød celle

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning` og
  `#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02. **GENNEMFØRT** 2026-10-02 efter 12e's skabelon: vinduet
  («Ferien ligger før beregningsperioden (01-06-2017)» / «… efter …») og overlappet projekteres på begge datoceller;
  linjen bærer rækkens navn og linker til cellen («Ferieperioden 01-07-2016 - 14-07-2016: …»), og overlap giver én
  linje for tabellen. Dagfelternes loft (366) bærer feltet selv med validatorens ordlyd, og periodens grænse (BB-258)
  er en projekteret feltfejl – ved 400 står én linje. Validatorens regler er fjernet. En omvendt række hed før
  «… uden datoer», fordi readeren giver røde datoer som tomme; navnet læses nu af kronologifejlen – også for
  TAF-afsnittets rækker.
- **Sådan fremprovokeres det:** Beregningsperiode `01-06-2017` – `31-05-2018`. Hver for sig:
  1. Ferierække `01-07-2016` – `14-07-2016` (uden for beregningsperioden).
  2. To ferierækker `03-07-2017` – `21-07-2017` og `10-07-2017` – `28-07-2017`.
  3. «Uspecificerede ferie-/feriefridage» `252` (arbejdsdage) eller `400`.
  4. «Antal fraværsdage (mandag-fredag)» `400`.
- **Det sker:** I alle fire er cellerne neutrale (målt `aria-invalid = "false"`, ingen tooltip), og download er spærret.
  1–2 giver «Ferieperioden ligger uden for beregningsperioden» / «Der er overlappende ferieperioder i
  beregningsperioden» uden rækkens navn og kun med sektionslinket. 3–4 giver «… overstiger mulige arbejdsdage i
  beregningsperioden (maksimalt 251)» og «Antal dage skal være mellem 0 og 366» – ved `400` begge to. De fire regler bor
  i rækkebyggeren (`eoRowTafBeregningsgrundlagRows.ts:274-293`) og i den gamle validator
  (`erstatningsopgoerelseValidator.ts:270-271`, `:822-848`), og dagfelternes descriptor har intet loft
  (`integerField`, `:264-278`). TAF-tvillingerne fik alle tre rød celle 2026-09-25.
- **Det er uhensigtsmæssigt fordi:** Det er 12e's oplevelse igen, i nabotabellen: en tabel, hvor dato-orden farver
  cellen, mens overlap og vindue ikke gør. Udvikleren krævede ved BB-248 netop rød ring, så brugeren har et incitament
  til at rette en ugyldig ferie.
- **Bedre ville være:** Skabelonen fra 12e: vinduet og overlappet projiceres som `FieldIssue` på begge datoceller
  («Ferien ligger før beregningsperioden (01-06-2017)» / «Overlapper ferieperioden 10-07-2017 - 28-07-2017»), dagfelternes
  maksimum flyttes til cellen med samme tekst som boksen, og boksens linje bærer rækkens navn («Ferieperioden
  01-07-2016 - 14-07-2016: …») og linker til cellen. Én regel, én tekst pr. felt – ikke to linjer for `400`.
- **Andre steder det kan gælde:** Lønindkomstens perioder (12h) bruger samme `detectOverlappingPeriods` – uafprøvet.

**Tilbagemelding**
Enig. Hvis problemstillingen er den samme, som vi før har stødt på andre steder og løst, så sørg også gerne for at rette den her. Og hvis problemet er aktuelt flere yderligere steder, så ret også gerne der.

### BB-265 – Beregningsgrundlagets egne fejl vises kun, når intet andet er galt

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
  (ny form: sikkerhedsnettet)
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02 med kravet om ingen dobbelte meddelelser om samme felt.
  **GENNEMFØRT** 2026-10-02: reglerne går nu gennem rækkekanalen (BB-264). Sikkerhedsnettet viser desuden en
  validatorregel om et navngivet EO-felt, også når boksen har andre fejl, medmindre en vist række peger på samme felt
  eller allerede siger beskeden (`selectEoSafetyNetInvariants`); rækkeformede regler og røde felter gentages ikke.
  Beregningsperiodens to «mangler»-regler er samlet i én linje med rækkens tekst. Downloadknappen henviser til boksen
  («Opgørelse kan ikke hentes, når der er fejl ovenfor») ved en blokerende invariant – som ved enhver rækkefejl –
  frem for «Indtastning mangler». React-nøglen for nettets linjer bærer også beskeden.
- **Sådan fremprovokeres det:**
  1. «Uspecificerede ferie-/feriefridage» `300` og en ferierække uden for beregningsperioden.
  2. En omvendt ferierække `21-07-2017` – `03-07-2017` alene; derefter også en TAF-ferierække med kun fra-dato.
- **Det sker:** 1: Boksen har kun ferielinjen; uspecificerede-linjen er væk. Rettes ferien, dukker den op. 2: Alene
  giver den omvendte række to linjer uden rækkens navn og uden link («Fra-dato skal være før til-dato (03-07-2017)» /
  «Til-dato skal være efter fra-dato (21-07-2017)»), og downloadknappens tooltip siger «**Indtastning mangler**» om en
  værdi, der er forkert, ikke mangler. Kommer TAF-ferien til, forsvinder begge linjer, mens cellerne stadig er røde.
  Mekanikken: validatorens og feltreglernes linjer vises kun af et sikkerhedsnet, der tier, så snart én rækkebygger-
  fejl findes (`useEoBeregningViewModel.ts:496-533`); knappens klasse udledes kun af rækkefejl
  (`erstatningsopgoerelseDownloadGate.ts:101-111`, `eoDocumentDownloadGate.ts:90-106`). Ved `999` rejser to regler
  samme invariant-id, og React logger «Encountered two children with the same key … blocking-invariant:
  beregningsperiode:uspecificerede_feriefridage».
- **Det er uhensigtsmæssigt fordi:** Brugeren retter det, boksen viser, og får en ny fejl, han ikke kunne se før.
  Nettet var tænkt som værn mod gentagelser, men skjuler fejl, ingen anden linje nævner.
- **Bedre ville være:** Alle blokerende fejl står i boksen samtidig, hver med rækkens eller feltets navn og link, og
  knappen siger «Fejl i indtastning», når en værdi er forkert. Rettes BB-264 efter 12e's skabelon, kommer reglerne ind
  gennem rækkekanalen, og nettet får intet tilbage at skjule.
- **Andre steder det kan gælde:** Enhver regel, der kun findes i `erstatningsopgoerelseValidator.ts` eller som rent
  feltissue uden rækkebygger: «Antal dage skal være mellem 0 og 366» for `sfggReferenceperiodeFravaersdageUdenLoen`
  (12j), satsreglerne for offentlige ydelser (`validateOffentligeYdelserReguleringssatser`, 12k).

**Tilbagemelding**
Enig. Men sørg for, at der fortsat ikke optræder dobbelte fejlmeddelelser, der begge skyldes og peger på det samme felt.

### BB-266 – En skjult værdi i beregningsgrundlaget spærrer opgørelsen

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-32--et-skjult-felt-er-ikke-udfyldt--men-kun-nogle-af-dets-læsere-ved-det`
  (mønsterets udestående «mode-felter», bekræftet)
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02. **GENNEMFØRT** 2026-10-02: mode-felterne bærer relevans
  efter deres gren (`eoInputRelevance.ts`): periodens datoer ved «Beregningsperiode», fraværet også ved togglen,
  den angivne løn efter sin mode, ferie og løse dage kun i arbejdsdage. Komprimeringsundtagelsen ved EO 2+ er
  bevaret – relevansen følger valget, ikke om sektionen er foldet sammen.
- **Sådan fremprovokeres det:**
  1. «Antal fraværsdage (mandag-fredag)» `400`, og slå «Øvrigt fravær uden løn» fra igen.
  2. «Uspecificerede ferie-/feriefridage» `999`, og vælg «Angivet månedsløn» med en fuldt udfyldt månedsløn.
- **Det sker:** I begge er feltet væk fra skærmen, og boksen skriver «Antal dage skal være mellem 0 og 366» med
  fanelinket «EO oplysninger». Download er spærret. Brugeren skal gætte, at han må slå togglen til igen eller vælge
  «Beregningsperiode» for at finde feltet. Ingen af beregningsgrundlagets mode-felter bærer descriptor-relevans
  (`erstatningsopgoerelseDescriptors.ts:709-739`, `:868-871`); M-32's «Tilbage»-note navngav dem.
- **Det er uhensigtsmæssigt fordi:** En blindgyde: fejlen handler om et felt, der ikke kan ses, og intet på skærmen kan
  rette den.
- **Bedre ville være:** Felterne får relevans efter den gren, de står i – beregningsperiodens felter når «Beregningsperiode»
  er valgt, fraværsfelterne når togglen også er slået til, de angivne felter efter deres mode (og ved BB-263 ferie og
  uspecificerede kun i arbejdsdage). Komprimeringsundtagelsen (EO 2+) skal bevares: relevansen følger valget, ikke om
  sektionen er foldet sammen.
- **Andre steder det kan gælde:** Ingen nye; Lønindkomstens betingede felter («Opsagt fra stillingen», sidste
  arbejdsdag) bærer allerede relevans.

**Tilbagemelding**
Enig

### BB-267 – «Angivet dagsløn» slår Store Bededagstillægget fra og advarer i samme øjeblik om, at det er fra

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02 i form (a). Præmissen blev korrigeret undervejs: krav på
  tillægget er der ved angivet månedsløn og ved en beregningsperiode med almindelig (fuld) løn på helligdage – lønnen
  er da den samme efter 1. januar 2024, selv om Store Bededag er blevet arbejdsdag. Ved angivet dagsløn er dagen
  kompenseret gennem antallet af arbejdsdage, og der er aldrig krav. **GENNEMFØRT** 2026-10-02: advarslen tier ved
  angivet dagsløn (`kanDerVaereKravPaaStoreBededagstillaeg`), og præmissen er dokumenteret i
  `indskudte-loentillaeg-contract.md` §2b med en henvisning fra `docs/domain/taf/tabt-arbejdsfortjeneste.md`.
- **Sådan fremprovokeres det:** TAF-periode i 2024. Vælg «Angivet dagsløn» og udfyld beløbet. Gå til Beregning.
- **Det sker:** Valget slår «Beregn Store Bededagstillæg fra 1. januar 2024» fra som en del af samme handling
  (`angivetLoenBeregningsgrundlagCommit.ts`, udviklerbeslutning 2026-09-14), og boksen skriver straks «Der vil
  sædvanligvis være krav på Store Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.»
  (udviklerbeslutning 2026-09-13). Ved «Angivet månedsløn» slås togglen til, og der er ingen advarsel.
- **Det er uhensigtsmæssigt fordi:** Brugeren får en advarsel om et valg, han aldrig har truffet – programmet har truffet
  det for ham og påtaler det bagefter. Enten er standardværdien rigtig, og så er advarslen støj, eller advarslen er
  rigtig, og så er standardværdien forkert.
- **Bedre ville være:** Udvikleren vælger: (a) advarslen tier ved «Angivet dagsløn», hvor fraværet af tillægget er
  standarden, eller (b) dagsløn åbner togglen med `true` som månedsløn, og advarslen bliver stående som en reaktion på
  brugerens eget fravalg.
- **Andre steder det kan gælde:** Et nyt ansættelsesforhold med andet end «Almindelig løn» får `false` (12g) –
  advarslen kræver almindelig løn, så formen opstår kun, hvis helligdagsvalget skiftes bagefter. Uafprøvet.

**Tilbagemelding**
Jeg vil have, at du forstår de bagvedliggende præmisser, og sørger for at dokumentere dem, så det kan afklare fremtidige problemstillniger om store bededagstillæg.

Når den skadelidtes løn beregnes som dagsløn, får vedkommende løn på de dage, hvor vedkommende arbejder. Så fra 1. januar 2024, da store bededag blev afskaffet, får vedkommende højere løn, fordi vedkommende da også arbejder på store bededag. Og ved erstatning kompenseres det med, at store bededag fra 2024 og frem indgår i de arbejdsdage, der beregnes erstatning for. Så personer, hvis løn beregnes som dagsløn, vil aldrig være berettiget til tillægget på 0,45 %.

Når den skadelidtes løn beregnes som måneder, får vedkommende samme løn uanset hvor mange arbejdsdage, der er i en måned. For at kompensere for, at der fra 2024 skal abrejdes på én dag mere end normalt, får alle lønmodtagere, der aflønnes månedsvist, et tillæg på 0,45 % for at kompensere for arbejdet på store bededag.

Så med det afsæt tænker jeg, at det korrekte svar er (a) advarslen tier ved «Angivet dagsløn», hvor fraværet af tillægget er standarden.

### BB-268 – En månedsløn tastet som dagsløn giver 7.620.000 kr. uden bemærkning

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02 med grænserne: en dagsløn over 10.000 kr. og en månedsløn
  under 2.500 kr. **GENNEMFØRT** 2026-10-02: gul ring og linje «Dagslønnen er usædvanlig høj – er det en månedsløn?» /
  «Månedslønnen er usædvanlig lav – er det en dagsløn?»; selve grænsen advares ikke, og 0 kr. er rødt (BB-258).
- **Sådan fremprovokeres det:** «Angivet dagsløn», «Dagslønnen udgør» `30000`. Hent opgørelsen. (Og «Angivet månedsløn»
  `3000000`.)
- **Det sker:** Ingen ring, ingen advarsel. Papiret: «Der lægges en dagsløn til grund på 30.000,00 kr. … 01-01-2024 -
  31-12-2024: 254 arbejdsdage á 30.000,00 kr. = **7.620.000,00 kr.**» Felterne har kun gulvet 0.
- **Det er uhensigtsmæssigt fordi:** De to beløbsfelter ser ens ud og står samme sted, og forvekslingen koster en faktor
  21. Skærmen viser ikke kravet (BB-226), så kun papiret afslører det.
- **Bedre ville være:** En gul, ikke-blokerende ring, når en dagsløn ligner en månedsløn (fx over 5.000 kr.: «Dagslønnen
  er usædvanlig høj – er det en månedsløn?») og omvendt (en månedsløn under fx 1.000 kr.). Grænserne er udviklerens.
- **Andre steder det kan gælde:** Lønindkomstens beløbskolonner ved «Løn indtastes som» (12g/12h).

**Tilbagemelding**
Enig, men lad os sætte øvrige grænsen for dagsløn ved 10.000 kr., og nedre grænsen for månedsløn ved 2.500 kr., hvorefter de giver gul ring og tooltip.

### BB-269 – «Øvrigt fravær uden løn» melder samme mangel to gange, og dens advarsler når ikke feltet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02. **GENNEMFØRT** 2026-10-02: én linje pr. mangel (rækken
  «Måneder» afhænger af fraværet og gentager det ikke). `0` og en tom årsag giver gul ring med linjens tekst
  («Antal fraværsdage er sat til 0», «Årsag til fravær er ikke udfyldt»). En TOM «Antal fraværsdage» spærrer og står i
  boksen, men får bevidst ingen ring – programmets øvrige manglende input har heller ingen (BB-083).
- **Sådan fremprovokeres det:** Måneder. Slå «Øvrigt fravær uden løn» til uden at udfylde noget; derefter `0`.
- **Det sker:** Tom: boksen har «Antal fraværsdage er ikke angivet» **og** «Måneder: Antal fraværsdage er ikke angivet» –
  to linjer for én mangel, fordi både fraværsrækken og månedsrækken melder den (`eoRowTafBeregningsgrundlagRows.ts:342`,
  `:461`). `0`: «Antal fraværsdage er sat til 0». Begge advarsler og «Beskrivelse af fravær er ikke udfyldt» er
  `messageOnly`-linjer uden ring på feltet, selv om hver af dem afhænger af ét felts egen værdi (STATUS §12a, prøve 2).
- **Det er uhensigtsmæssigt fordi:** Brugeren leder efter to fejl, og feltet, han skal rette, er umarkeret.
- **Bedre ville være:** Én linje pr. mangel, og en gul ring på «Antal fraværsdage» (tom / 0) og på «Årsag til fravær»
  med samme tekst som linjen.
- **Andre steder det kan gælde:** «Ingen ferie i beregningsperiode på > 6 måneder forekommer tvivlsomt» er også
  `messageOnly` uden ring; den afhænger af flere felter og hører med rette i boksen.

**Tilbagemelding**
Enig

### BB-270 – Fladens felter hedder noget andet i oplæsning, fejltekster og links

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne` (BB-211's mekaniske form)
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02; «løse ferie-/feriefridage» er det korrekte navn.
  **GENNEMFØRT** 2026-10-02: feltet hedder «Løse ferie-/feriefridage» på skærmen, i oplæsningen og i boksen; labels er
  skærmens tekst («Periode til beregning af før-løn, fra/til», «Antal fraværsdage (mandag-fredag)», «Årsag til
  fravær», «Baseret på», «Skjul beregning efter første opgørelse», «Det angivne beløb afspejler månedslønnen per
  dato»), og sektionslinket hedder «Indtægt før skadedatoen» / «… anmeldelsesdatoen» efter skadestypen.
- **Sådan fremprovokeres det:** Læs felternes tilgængelige navne og boksens linjer og links.
- **Det sker:**

  | Skærmen | Oplæst navn / fejltekst | Boks eller papir |
  |---|---|---|
  | Indtægt før skadedatoen (sektionen) | – | linket «**Indkomstgrundlag**» (`eoRowNavigationMap.ts:186`) |
  | Periode til beregning af før-løn: … til: | «Beregningsperiode fra» / «… til» | «Fra og med: …; Til og med: …» |
  | Uspecificerede ferie-/feriefridage | «Uspecificerede ferie-/**fridage**» | papiret: «ferie-/feriefridage» lagt sammen med ferien |
  | Antal fraværsdage (mandag-fredag) | «Øvrige fraværsdage» | «Antal fraværsdage er ikke angivet» |
  | Årsag til fravær | «Beskrivelse af øvrige fraværsdage» | «Beskrivelse af fravær er ikke udfyldt» · papiret «pga. …» |
  | - baseret på | «Angivet månedsløn baseret på» | «'- baseret på' er ikke angivet» |
  | Skjul beregning efter første opgørelse | fejltekster: «Komprimér beregning efter første opgørelse» | – |

  Alle andre sektionslinks i boksen bærer skærmens overskrift (Forlig, AES-afgørelser, Tabt arbejdsfortjeneste).
  Dertil hedder samme slags dage «Uspecificerede ferie-/feriefridage» her og «Løse ferie-/feriefridage» i TAF-tabellen
  (12e, BB-256).
- **Det er uhensigtsmæssigt fordi:** Linket «Indkomstgrundlag» fører til en overskrift, der ikke findes, og en skærmlæser
  oplæser feltnavne, brugeren ikke kan genfinde.
- **Bedre ville være:** Descriptor-labels og linket = skærmens tekst («Indtægt før skadedatoen»/«… anmeldelsesdatoen»),
  boksens citat uden tankestreg («'Baseret på' er ikke angivet»). Om dagene skal hedde «løse ferie-/feriefridage» begge
  steder, er udviklerens valg.
- **Andre steder det kan gælde:** Ingen nye.

**Tilbagemelding**
Enig. Og løse ferie-/feriefridage er den korrekte og ønskværdige formulering.

### BB-271 – «månedslønen», «dagslønen», «hvis forskellige» og «1 arbejdsdage»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02. **GENNEMFØRT** 2026-10-02: «Det angivne beløb afspejler
  månedslønnen per dato (hvis forskellig fra skadedatoen)» (også dagslønnen og anmeldelsesdatoen), kontrolrækkens
  «… afspejler månedslønnen den», og papiret og kontrolrækken bøjer «1 arbejdsdag». «per dato» er bevidst bevaret som
  fagsprog, i tråd med «Evt. differencekrav opgjort per».
- **Sådan fremprovokeres det:** Vælg «Angivet månedsløn» og «Angivet dagsløn»; hent BB-259's opgørelse.
- **Det sker:** Skærmen: «Det angivne beløb afspejler **månedslønen** per dato (hvis **forskellige** fra skadedato)» /
  «… **dagslønen** …» (`useEoOplysningerViewModel.ts:125` sætter `en` på «månedsløn»). Kontrolrækken har samme stavning
  («… afspejler månedslønen den», `eoRowTafBeregningsgrundlagRows.ts:573`). Papiret: «= 1 **arbejdsdage**»
  (`indkomstSkadestidspunktBeregning.ts:338` bøjer ikke), mens linjen under skriver «1 arbejdsdag».
- **Det er uhensigtsmæssigt fordi:** Stavefejl i en fast etiket underminerer tilliden til resten.
- **Bedre ville være:** «Det angivne beløb afspejler månedslønnen per dato (hvis forskellig fra skadedatoen)» og «= 1
  arbejdsdag».
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig. Stavefejl skal rettes. Vær dog altid gerne kritisk i forhold til, om formuleringer kan være udtryk for særligt juridisk sprog. Men fremhæv og spørg gerne.

### BB-272 – «- baseret på» indsættes ordret midt i en sætning i papiret

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (skærm og dokument om samme
  oplysning)
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-02; efter modsvar **uden** ændring af store bogstaver, fordi
  programmet ikke kan skelne et egennavn («Danske Banks lønsedler») fra et almindeligt ord. **GENNEMFØRT**
  2026-10-02: feltet har pladsholderen «fx lønsedler for 2017», og papiret fjerner et indledende «baseret på»
  («På baggrund af lønsedler for 2017 …»). «pga. Barsel» bevares som brugeren skrev det.
- **Sådan fremprovokeres det:** «Angivet månedsløn», «- baseret på» `baseret på lønsedler for 2017`. Og «Årsag til fravær»
  `Barsel`. Hent opgørelsen.
- **Det sker:** «**På baggrund af baseret på lønsedler for 2017** lægges en månedsløn til grund på 30.000,00 kr.» og «(30
  fraværsdage pga. **Barsel** uden løn x 4,8 % måned)». Skærmen siger ikke, at teksten indsættes i en sætning.
- **Det er uhensigtsmæssigt fordi:** Etiketten «- baseret på» lægger op til netop den gentagelse, og stort
  begyndelsesbogstav er det naturlige i et selvstændigt felt. Begge dele står i papiret, modparten læser.
- **Bedre ville være:** En pladsholder i feltet, der viser sætningen: «fx lønsedler for 2017» – og papiret fjerner et
  indledende «baseret på» og gør første bogstav småt, når teksten indsættes midt i en sætning.
- **Andre steder det kan gælde:** «+ evt. ledsagetekst» (12a, BB-204) er indsat i titlen efter samme princip.

**Tilbagemelding**
Enig

### BB-273 – Skift mellem angivet månedsløn og dagsløn tømmer «- baseret på» og datoen på skærmen

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **AFVIST** af udvikleren 2026-10-02: et skift mellem de to lønformer betyder typisk, at der skal
  bruges en helt anden beregningsmetode, og felterne skal da starte forfra.
- **Sådan fremprovokeres det:** «Angivet månedsløn», udfyld «- baseret på» og datoen. Vælg «Angivet dagsløn».
- **Det sker:** «- baseret på» og «Det angivne beløb afspejler dagslønen per dato …» står tomme; teksten og datoen kommer
  tilbage ved «Angivet månedsløn». De er to sæt felter med ordret samme etiket (`angivetMaanedsloenBaseretPaa` /
  `angivetDagsloenBaseretPaa`, `…OpreguleresFraDato`).
- **Det er uhensigtsmæssigt fordi:** Den, der vælger om, fordi han tog fejl af lønformen, ser sit arbejde forsvinde, og
  intet siger, at det er gemt. Kilden og datoen er de samme, uanset om beløbet er pr. måned eller pr. dag.
- **Bedre ville være:** Ét fælles «baseret på» og én fælles dato for begge angivne lønformer. Det kræver en
  persistensovergang (to gamle felter til ét), som skal forelægges med en gammel fil som eksempel; alternativt beholdes
  felterne, men det tomme felt får den anden forms værdi som forslag.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Jeg afviser fundet. Hvis brugeren veksler mellem de to, vil det typisk være fordi der er opstået behov for en helt anden beregningsmetode, der skal anvendes i stedet. Og så er det korrekt, at felterne 'starter forfra'.

## Overvejet uden fund

- **Beregningerne er kontrolregnet** i seks sagsformer: 360.000 / 12 = 30.000,00; 12 − 30 × 0,048 = 10,56 og 360.000 /
  10,56 = 34.090,91; 261 hverdage − 10 SH = 251 og 360.000 / 251 = 1.434,26; − 20 ferie-/feriefridage = 231 og
  1.558,44; 254 × 1.434,26 = 364.302,04; 12 × 30.000 og 254 × 30.000. Ferie fradrages kun i arbejdsdage.
- **Dato-orden i beregningsperioden og i en ferierække:** begge celler røde med hver sin spejlvendte tekst (M-07
  bestået). Boksens linje for perioden samler begge («Fra og med: …; Til og med: …») – forståelig.
- **Beregningsperiode med kun fra-dato:** «Der mangler indtastninger i perioden til beregning af før-løn», ingen rød
  ring (BB-083's princip). Linket fører til sektionen, ikke til det tomme felt – mildere end BB-205, fordi intet blinker
  forkert.
- **«Ingen ferie i beregningsperiode på > 6 måneder forekommer tvivlsomt»** kommer kun i arbejdsdage og kun uden ferie og
  uspecificerede dage – rimelig og ikke-blokerende.
- **«Antal fraværsdage er sat til 0»** som advarsel frem for fejl er M-13's afgjorte form.
- **Feriedage-kolonnen** tæller kun dage i beregningsperioden, og en række helt uden for viser `0`; info-ikonet «Kun dage
  i beregningsperioden fremgår» er BB-249's afgjorte løsning.
- **Angivet løn uden «- baseret på»** giver en gul advarsel, og papiret falder pænt tilbage til «Der lægges en månedsløn
  til grund på …».
- **«Løn på helligdage» under angivet løn** er ikke M-35: den læses af reguleringen (overenskomstsegmenter) og hører i 12i.
- **«Skjul beregning efter første opgørelse»** står tændt ved 1. opgørelse uden at skjule noget – gennemgået i 12a (BB-203).
- **M-09 bestået:** ingen vandret scroll ved 1244×620 i begge grene (`scrollWidth = clientWidth = 1244`). **M-10
  bestået:** rul-op-knappen ligger tæt på, men uden for «Årsag til fravær».
- **Konsollen** var tavs i alle almindelige forløb; fejl kun i BB-258's tre tilstande og ved BB-265's dublerede id.

## Henvisninger til andre bidder

- **12g:** «Fuld løn under ferie» og «Løn på helligdage» skifter enheden og dermed BB-263's synlighed – prøves fra
  Lønindkomst. BB-267's søskende for et nyt ansættelsesforhold.
- **12h:** BB-260's huller set fra lønrækkerne; lønrækker med kun 0 kr. som BB-258-kandidat; lønperiodernes overlap.
- **12i:** «Løn på helligdage» og Store Bededag under angivet løn som reguleringsinput.
- **12j:** sygeferiegodtgørelsens «Fraværsdage uden løn» har samme 366-regel kun i validatoren (BB-265).
- **12k:** offentlige ydelsers udvikling har samme «mangler beregningsgrundlag»-undtagelse (BB-258).

## Dækningshuller

- Kun Chrome, lyst tema; kun PDF-kanalen er læst.
- Erhvervssygdom («Indtægt før anmeldelsesdatoen») er ikke afprøvet.
- Komprimeringen ved 2. opgørelse og papirets «Månedsløn er i tidligere erstatningsopgørelse beregnet til …» er ikke
  afprøvet her.
- Flere ansættelsesforhold med hver sin enhed er ikke afprøvet (12g).
- Lønudvikling andet end «Ingen» er ikke afprøvet (12i).
- `Gem`/`Hent` er ikke afprøvet (filvælgeren kan ikke betjenes headless).
- Blinkmålet for validatorlinjernes «EO oplysninger»-link er ikke målt.

## Åbne spørgsmål

Alle 16 fund er afgjort 2026-10-02, og BB-267's to opfølgende spørgsmål er besvaret samme dag: knappen «Beregn
Store Bededagstillæg» skjules ved angivet dagsløn, og tillægget regnes da aldrig med (gennemført); angivet månedsløn
giver kun krav ved «Almindelig løn» på helligdage (som i dag).

Én observation om beregningslogikken blev godkendt og gennemført samme dag: i arbejdsdage blev lønnen i
beregningsperioden fordelt efter BÅDE beregningsperiodens og TAF-afsnittets ferie, mens dagene, den deles med, kun
fradrog beregningsperiodens – målt 1.607,14 kr. mod 1.569,21 kr. og 1.652,37 kr. med samme 252 arbejdsdage, og
programmets kontrol meldte uoverensstemmelse. Nu gælder hver ferietabel kun i sin egen periode
(`resolveIndkomstFerieperioder`) i motorens fordeling, lønindkomstens afledte kolonner, «ingen arbejdsdage»-advarslen
og kontrollaget. Kun sager med en beregningsperiode efter skaden ændrer tal.
