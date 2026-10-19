# Brugerblik – Erstatningsopgørelse → Ansættelsesforholdets indtægtsoplysninger (12h)

- Rute/placering: `/erstatningsopgoerelse` → fanen «Lønindkomst» → kortets underafsnit «Indtægtsoplysninger»
  (`StandardLoenTable`: «Måned»/«År», «Uge fra»/«Uge til» eller «Dato fra»/«Dato til», «Løn», «Løn (2)»,
  «Ikke-pensionsgivende løn», «ATP og anden løn u. tillæg» og de afledte «FP/FV/SH/SO/St.B.», «Arb.g. Pension» og
  «Samlet løn») – samt opgørelsens bilag «Lønindkomst» (`loenindkomstSection`), de linjer i «Fejl og advarsler», tabellen
  udløser, og tabellens spor i beregningsgrundlaget («Løn i beregningsperioden», «Indtægter i erstatningsperioden»).
- Gennemgået: 2026-10-19 · commit `2f9a22eb` · **afgjort og gennemført 2026-10-19 for BB-289–BB-292, BB-294–BB-296, BB-298 og BB-299; BB-293 afvist; BB-297 og dele af BB-290, BB-294 og BB-299 afventer udviklerens svar på modsvar**
- Afprøvet i: Chrome headless, lyst tema, 1536×864 (M-09 desuden 1244×620). Sager indlæst gennem «Hent» (krypteret
  `.eo` bygget til formålet), dokumenter hentet som `.pdf` og læst som tekst. Feltfejl aflæst gennem automatiseringsbroen,
  blink gennem `animationstart`. Grundsag som 12g: skadedato `01-06-2018` (arbejdsulykke), TAF-periode og «Vedrører
  perioden» `01-01-2024` – `31-12-2024`, «Opgørelse lavet den» `01-02-2025`, «Beregnes ud fra» Beregningsperiode
  `01-06-2017` – `31-05-2018`, ét ansættelsesforhold «Firma A» med 12 månedsrækker à `30.000 kr.` (juni 2017 – maj 2018),
  «Feriegodtgørelse/-tillæg» `12,5`, uden overenskomst, lønudvikling og sygeferiegodtgørelse «Ingen». Grundsagens krav:
  `405.000,00 kr.`

## Fladen kort

Tabellen er kortets lønsedler. Brugeren taster én række pr. lønperiode og behøver ikke dele op før og efter skaden –
programmet sorterer selv rækkerne i beregningsperioden (grundlaget), i erstatningsperioden («Indtægter i
erstatningsperioden», som fradrages) og resten (ignoreres). Tillæg og pension regnes pr. række med den enkelte måneds
satser (BB-276) og vises i de tre afledte kolonner. Skærmen viser ikke kravet (BB-226); tabellens tal når kun papiret
gennem beregningsgrundlaget og bilaget «Lønindkomst».

**Fladens bærende iagttagelse er, at tabellen ikke kender sine egne fejl.** Der er ingen rækkeregel i tabellen: en
identisk dublet fordobler en måned uden et ord, selv om udvikleren 2026-08-26 bad om dublet-kontrollen netop her
(BB-289); en negativ række standser opgørelsen med en «kontroluoverensstemmelse», hvis link ikke fører nogen steder hen
(BB-290); og en mangel i én af tolv rækker meldes som «Måned er ikke angivet» uden at sige hvilken, mens linket blinker
hele kortet (BB-291). **Papiret kan dertil ikke afstemmes med grundlaget** (BB-292, BB-293).

**Gennemgangen afdækkede også, at fire af Årsløns afgørelser fra 2026-08-26, som revisionssporet kalder gennemført,
ikke findes i koden** – hverken på Årsløn eller her (BB-289's EO-halvdel, BB-295/BB-107, BB-296/BB-114, BB-298/BB-115,
BB-299/BB-100). Det er et nyt tværgående mønster, M-38.

**Afgrænsning.** Satsafsnittet over tabellen er 12g's, lønudvikling og regulering 12i's, sygeferiegodtgørelsen 12j's.
Sammendraget og bilagsvalgene på Beregning hører i 12l, kontroltabellen i 12m.

## Fund

### BB-289 – To identiske lønrækker fordobler måneden uden et ord – dublet-kontrollen fra Årsløn nåede ikke hertil

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-23--aggregatet-af-dublerer-tiden-men-ikke-pengene` og
  `#m-38--en-afgørelse-står-som-gennemført-men-koden-bærer-den-ikke`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-19 med ændret form: identiske rækker må ingen steder give rød ring eller spærre – dobbelt løn for samme periode kan i sjældne tilfælde være reel – men skal give gul ring og en advarsel, også på Offentlige ydelser og Årsløn. **GENNEMFØRT** 2026-10-19 som én fælles regel (`findDuplicateRows` + `standardLoenRowWarnings.ts`/`eoIncomeRowWarnings.ts`): den 2., 3., … forekomst får gul ring på de sammenlignede celler med tooltippen «Rækken er identisk med en tidligere række – kontrollér, at den ikke er indtastet to gange». Lønindkomst: vurderet inden for det enkelte ansættelsesforhold; linjen «Lønrækken 06-2017 er identisk med en tidligere række» i «Fejl og advarsler» med link til rækken. Offentlige ydelser: samme regel og linje («Ydelsen Dagpenge 01-07-2017 - 31-07-2017 er identisk …»); dropdown-cellen «Ydelsestype» indgår i sammenligningen, men kan ikke bære en gul ring, så ringen sidder på dato- og beløbscellerne. Årsløn: den røde ring og spærringen fra BB-096 er erstattet af den gule ring og en linje øverst i sidens «Advarsler»-boks (Årsløn har ingen Beregning-side). Beregningen tæller fortsat begge rækker med.
- **Sådan fremprovokeres det:**
  1. Grundsagen. Tilføj en 13. række nederst, der er en ordret kopi af juni 2017: Måned `6`, År `2017`, Løn `30000`.
  2. Gå til Beregning, og hent opgørelsen.
- **Det sker:** Ingen celle er rød, ingen linje i «Fejl og advarsler», download er aktiv. Papiret: «Løn i
  beregningsperioden **390.000,00 kr.** … I perioden var der 12 måneder. Månedsløn: 438.750,00 kr. / 12 måneder =
  36.562,50 kr.» og **Beregnet krav 438.750,00 kr.** – mod 405.000,00 kr. uden kopien. Bilaget trykker juni 2017 to gange,
  den ene nederst efter maj 2018. På Årsløn giver samme to rækker efter koden rød ring på den anden («Rækken er
  identisk med en tidligere række. Ret den, eller slet den ene af de to.») og spærrer (ikke målt i browseren).
- **Det er uhensigtsmæssigt fordi:** Udvikleren bad ved BB-096 (2026-08-26) udtrykkeligt om kontrollen «generelt – det vil
  sige ikke kun her», og nævnte lønindkomst-tabellerne (inden for hvert ansættelsesforhold) og offentlige ydelser.
  Commit `447905ca` skriver «så Årsløn og EO deler den», og `aarsloen.md` skriver, at kontrollen «deles af Årsløn,
  lønindkomst-tabellerne … og offentlige ydelser». Men `resolveStandardLoenDuplicateRowIssues` kaldes kun af
  `aarsloenProjection.ts`; EO's tabel får ingen `ruleIssues`. En kopieret linje koster her 33.750 kr. pr. år i kravet, og
  rækken ser rigtig ud.
- **Bedre ville være:** Som på Årsløn: den 2., 3., … forekomst af en række, der er identisk i alle indtastningsfelter
  (beløb sammenlignet på den beregnede værdi), får rød ring med samme tekst og spærrer – vurderet inden for det enkelte
  ansættelsesforhold, ikke på tværs. Spærringen meldes i «Fejl og advarsler» med link til den røde række.
- **Andre steder det kan gælde:** Offentlige ydelser (12k) – samme afgørelse, heller ikke koblet på (kun læst i koden).

**Tilbagemelding**
Enig, herunder i at det skal udbredes til alle steder, hvor det kunne være aktuelt, dvs. også på Offentlige ydelser. Overvej gerne, om der bør laves én samlet løsning. Dog én vigtig korrektion: Det må ingen af stederne give rød ring eller blokerende fejl, at der er tale om ens indtastninger. Der vil i særlige undtagelsesvise tilfælde kunne opstå situationer, hvor en lønmodtager fx. får dobbelt løn for samme måned. Men der skal komme gul ring samt advarsel på beregning-siden, hvis det sker, og det samme hvis det sker på siden med offentlige ydelser. På årsløn-siden skal det også kun være gul ring og advarsel.

### BB-290 – En negativ lønrække standser opgørelsen med «kontroluoverensstemmelser», og linket fører ingen steder hen

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-36--en-lovlig-indtastning-fører-beregningen-ud-i-en-intern-undtagelse`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT (a)** af udvikleren 2026-10-19: en negativ række regnes med og modregnes – også på Offentlige ydelser – med gul ring og ikke-blokerende advarsel. **GENNEMFØRT** 2026-10-19: `indtaegtPerioder.ts` springer ikke længere en negativ række over (lønindkomst og offentlige ydelser), så grundlag og kontroltabel tæller det samme; en række på 0 kr. er uændret. Målt i test: juli 2017 `-2000` giver kravet 402.750,00 kr. (før: «kontroluoverensstemmelser»), og marts/april 2024 `10000`/`-3000` giver et fradrag på 7.875,00 kr. Rækken får gul ring på den negative celle («Rækkens samlede løn er negativ (-2.250,00 kr.) – beløbet modregnes i den øvrige indkomst») og linjen «Lønrækken 07-2017 har negativ samlet løn (-2.250,00 kr.) – beløbet modregnes i den øvrige indkomst». Linket «Kontroltabel» vises kun, når kontrolfanerne er slået til. **Afventer udviklerens svar** på modsvaret nedenfor: et ansættelsesforhold eller en ydelsestype, der SAMLET er negativ i en periode, spærrer indtil videre med en navngiven linje.
- **Sådan fremprovokeres det:** Grundsagen. Hver for sig:
  1. En ekstra række Måned `7`, År `2017`, Løn `-2000` (en efterregulering på sin egen linje).
  2. I juni 2017: «Løn (2)» `-40000`.
  3. To rækker i TAF-perioden: marts 2024 `10000` og april 2024 `-3000`.
- **Det sker:** Cellen tager imod beløbet uden ring. «Fejl og advarsler» siger «Der er konstateret
  kontroluoverensstemmelser i EO-beregningen.» med linket **«Kontroltabel»**, downloadknappen er grå, og konsollen
  skriver «[EOberegningTab] Systemfejl registreret». Klikkes linket, sker intet (målt: samme fane, ingen blink, fokus
  bliver på knappen) – kontroltabellen er en fane, der er slået fra som standard. Mekanikken: beregningsgrundlaget
  springer en række med negativ «Samlet løn» over (`indtaegtPerioder.ts:418-428`, `samletContrib <= 0`), mens
  kontroltabellens sammentælling tæller den med; uoverensstemmelsen fanges af `control:sammentaelling_mismatch`.
  Er rækken netto positiv (Løn `30000`, Løn (2) `-5000`), regnes den med (28.125,00 kr.) uden problemer.
- **Det er uhensigtsmæssigt fordi:** Feltet tager imod negative beløb, og en negativ linje på en lønseddel (træk,
  tilbagebetaling, efterregulering) er almindelig. Brugeren får at vide, at programmet har fejlet, ikke at hans tal er
  problemet; han får ikke at vide hvilken række, og linket er en blindgyde. Uden kontrollen ville rækken blot være
  sprunget tavst over.
- **Bedre ville være:** Udvikleren vælger:
  (a) En negativ række regnes med – den modregnes i periodens øvrige løn, så grundlaget og bilaget stemmer; eller
  (b) en række med negativ «Samlet løn» er en rød feltfejl på beløbet: «Samlet løn for rækken kan ikke være negativ –
  modregn beløbet i den måned, det vedrører», og opgørelsen spærres med en navngiven linje og link til cellen.
  Uanset valget: et link til en fane, der ikke vises, bør ikke tilbydes.
- **Andre steder det kan gælde:** Offentlige ydelser (12k) har tilsvarende `amount <= 0`-filtre
  (`indtaegtPerioder.ts:474, 495, 509`) – uafprøvet. Alle systeminvarianter, der linker til «Kontroltabel» (12m).

**Tilbagemelding**
En negativ række regnes med. Også hvis det sker på siden med Offentlige ydelser. Det vil kunne ske, at der fx. er udbetalt for meget løn på én lønseddel, og senere udstedes ny lønseddel med tilbagebetalingskrav. Det skal programmet kunne håndtere. Men jeg vil have, at det skal give gul ring og ikke-blokerende advarsel på beregning-siden i begge tilfælde.

**Modsvar (afventer udviklerens svar)**

Dit eksempel – for meget løn på én lønseddel og et tilbagebetalingskrav på en senere – virker nu: de to sedler hører til
samme ansættelsesforhold, og tilbagebetalingen trækkes fra den øvrige løn. Men svaret dækker ikke to tilfælde, hvor der
ikke er nogen positiv løn at trække fra. Jeg har indtil videre ladet dem spærre med en navngiven, rød linje frem for at
gætte, for begge ændrer kravet i en retning, du bør tage stilling til:

1. **Et ansættelsesforhold eller en ydelsestype er SAMLET negativ i en periode.** Eksempel: skadelidte har fået for meget
   løn fra Firma B i maj 2017, men har ellers ingen løn derfra i beregningsperioden; tilbagebetalingen på 2.000 kr. ligger
   i juli 2017. Firma B bidrager så med -2.250 kr. (inkl. feriegodtgørelse) til grundlaget.
   - *I dag (efter rettelsen):* linjen «Lønnen fra Firma B er samlet negativ i beregningsperioden (-2.250,00 kr.). En samlet
     negativ løn kan ikke indgå i beregningen – kontrollér lønrækkerne» spærrer opgørelsen. Det samme gælder en
     ydelsestype, og det samme i erstatningsperioden.
   - *Valg A – behold spærringen:* brugeren må modregne beløbet i en anden række (fx skrive lønsedlen for maj netto).
   - *Valg B – modregn på tværs af kilder:* de -2.250 kr. trækkes fra den samlede indkomst. I beregningsperioden sænker
     det månedslønnen og dermed kravet. I erstatningsperioden *forhøjer* det kravet: hvis skadelidte i 2024 betaler 2.000 kr.
     tilbage til en tidligere arbejdsgiver og ellers ingen indtægt har, bliver fradraget negativt, og kravet bliver større
     end hele det tabte. Programmets lønudvikling regulerer desuden hvert ansættelsesforhold for sig og kan ikke regulere en
     negativ løn, så B kræver en regel for, hvordan et negativt ansættelsesforhold reguleres (fx slet ikke).

   Jeg anbefaler **A** for beregningsperioden og **A** for erstatningsperioden, medmindre du kender sager, hvor en negativ
   indtægt i erstatningsperioden skal forhøje kravet. Hvad vælger du?
2. **Sygeferiegodtgørelsen.** Den har sin egen udregning af lønnen pr. dag og springer fortsat negative rækker over (den så
   kun positive rækker også før). Eksempel: juni 2017 30.000 kr. og en efterregulering i juli 2017 på -2.000 kr. –
   tabt arbejdsfortjeneste regner med 58.000 kr. for de to måneder, sygeferiegodtgørelsen med 60.000 kr. Skal den
   negative række også trækkes fra i sygeferiegodtgørelsens grundlag? Jeg anbefaler ja, så de to grundlag er ens.

### BB-291 – En mangel eller fejl i én lønrække meldes som «Måned er ikke angivet» – uden række, én ad gangen, og linket blinker hele kortet

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-19--rødt-læses-som-tomt-af-den-flade-der-låner-værdien` og
  `#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-19, som fælles løsning og også for Offentlige ydelser. **GENNEMFØRT**
  2026-10-19 (`eoRowLoenindkomstTableLines.ts`, `buildOffentligeYdelserStatusRows`): én linje pr. række med en fejl eller
  advarsel, alle på én gang, med rækkens periode som navn («Lønrækken 06-2017», «Ydelsen Dagpenge 01-01-2024 - 31-01-2024»)
  eller – når perioden selv er rød eller mangler – rækkens plads («Række 13»), cellens egen tekst og et link, der blinker
  netop cellen. Eksempler: «Række 1: Måned – Værdi skal være mellem 1 og 12», «Række 3: Måned er ikke angivet», «Lønrækken
  06-2018 er udfyldt uden beløb», «Ydelsen Dagpenge 01-01-2024 - 31-01-2024: Beløb er ikke angivet». En rød værdi kaldes
  aldrig «ikke angivet». Har en løn- eller ydelsesrække en fejl, meldes huller i beregningsperioden ikke, før den er rettet.
  Den manuelle regulerings linje genbruger ikke længere en rød celle fra indtægtstabellen (12i's forekomst af samme
  dobbeltlinje). Målt i browser (E2E): linket fra «Række 4: Måned – Værdi skal være mellem 1 og 12» skifter til Lønindkomst
  og blinker kun månedscellen. Årsløn har ingen «Fejl og advarsler»-liste; dens celler viser allerede egen tooltip.
- **Sådan fremprovokeres det:** Grundsagen. Hver for sig:
  1. Juni 2017's Måned `13` (også `0`); År `1990` eller `2030`.
  2. En ekstra række med kun Løn `30000` (ingen periode).
  3. Dato-tilstand: «Dato fra» `01-03-2018`, «Dato til» `31-01-2018`. Uge-tilstand: `53/2017`.
  4. To fejlbehæftede rækker på én gang: én uden måned, én uden år.
  5. Klik linket i «Fejl og advarsler».
- **Det sker:**
  - Den røde celle har den rigtige tooltip («Værdi skal være mellem 1 og 12», «Årstallet skal være mellem 2005 og 2026»,
    «Til-dato skal være efter fra-dato (01-03-2018)»), men boksen siger «**Måned er ikke angivet**», «**År er ikke
    angivet**», «**Dato fra er ikke angivet**», «**Uge fra er ikke angivet**» – om værdier, der står på skærmen.
  - Linjen siger aldrig hvilken række. I 1 kommer desuden «Der er hverken angivet løn eller offentlige ydelser for
    01-06-2017 - 30-06-2017 i beregningsperioden» – følgen af samme ene fejl som en linje mere.
  - I 4 står kun «Måned er ikke angivet»; den manglende år kommer først frem, når den første er rettet.
  - Linket «Lønindkomst» skifter fane og blinker **hele kortet** (målt: `mineoFieldAttentionBlink` på kortets
    `content-box` og samtlige felter i det), ikke rækken eller cellen. Fokus havner på `body`.
  - Den gule pendant er af samme form: en række med periode, men uden beløb, giver «Lønperiode er udfyldt uden beløb i
    lønfelterne» uden at nævne perioden.
- **Det er uhensigtsmæssigt fordi:** En rigtig sag har 12–24 rækker pr. kort. Brugeren får at vide, at «Måned» mangler,
  ser tolv udfyldte måneder og et blinkende kort, og skal selv finde den ene celle – og for en rød værdi siger boksen
  det modsatte af tooltippen. BB-277 rettede samme form for kortets egne felter og navngav netop denne tabel som
  kandidat.
- **Bedre ville være:** Én linje pr. fejlbehæftet række, med rækkens periode eller placering og cellens egen tekst, og
  et link, der blinker cellen: «Række 13: Måned er ikke angivet» / «06-2017: Måned – Værdi skal være mellem 1 og 12» /
  «Lønperioden 06-2018 er udfyldt uden beløb». Hullet i beregningsperioden meldes ikke for en måned, hvis række er rød.
- **Andre steder det kan gælde:** Årslønsberegningens tabel (samme `getStandardLoenTableValidation`) – uafprøvet.

**Tilbagemelding**
Enig, og overvej gerne en fælles, samlet løsning, og om der også bør tages højde for Offentlige ydelser.

### BB-292 – Rækker, som beregningen medregner, står med 0,00 kr. eller mangler helt i bilaget

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (skærm og dokument mod beregning)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-19 med krav om at gennemtænke de afledte følger. **GENNEMFØRT**
  2026-10-19. (1) Tabellens og bilagets «Samlet løn» bruger nu samme fald-tilbage-dage som beregningen, når rækken ingen
  arbejdsdage har (`loenindkomstRowDerived.ts`) – weekendrækken viser 2.250,00 kr. (2) En række med kun tillæg eller
  pension i Beløb-tilstand kommer med i bilaget (`shouldIncludeLoenRowInEoBilag`). Gennemtænkte følger: rettelsen (1)
  ændrer kun VISNINGEN – funktionen bruges alene af tabellen og bilaget, ikke af beregningen, så intet kan tælles dobbelt;
  beregningen, kontroltabellen og sygeferiegodtgørelsen brugte i forvejen netop denne fald-tilbage (periodisering-contract
  §3A), så de fire steder er nu enige; dagtællingen (arbejdsdage, måneder) er uændret, fordi fald-tilbage-dagene kun fordeler
  beløbet. En række, der kun delvist ligger i perioden, vises fortsat med hele rækkens beløb (BB-293). Rettelsen (2) ændrer
  ingen tal: beregningen og kontroltabellen talte i forvejen rækken med; følgen er, at bilagsvalget «Lønindkomst» også kan
  vælges, når perioden kun har sådanne rækker. Linjen «udfyldt uden beløb» vises ikke for rækken – den har et beløb.
- **Sådan fremprovokeres det:**
  1. «Løn indtastes som» Dato, «Fuld løn under ferie» fra. Rækkerne `01-06-2017` – `04-05-2018` `340000` og `05-05-2018`
     – `06-05-2018` (lørdag–søndag) `2000`. Hent opgørelsen.
  2. «Tillæg angives som» Beløb, 12 rækker med Løn `30000` og FP/FV/SH/SO/St.B. `3750`, plus en række maj 2018 med kun
     FP/FV/SH/SO/St.B. `10000` (en særskilt feriepengeudbetaling). Hent opgørelsen.
- **Det sker:**
  1. Tabellen og bilaget viser weekendrækken som «2.000,00 · 0,00 · 0,00 · **0,00**» – Samlet løn 0,00 kr. Grundlaget
     regner den med: «Løn i beregningsperioden 342.000,00 kr. / Feriegodtgørelse/-tillæg (12,5 %) 42.750,00 kr.», og
     boksen siger selv «Lønnen medregnes i indkomsten, men perioden forøger ikke antallet af arbejdsdage».
     Visningen nuller rækken, fordi den fordeler beløbet på rækkens arbejdsdage (`loenindkomstRowDerived.ts:98-106`),
     mens beregningen bruger reservedage.
  2. Grundlaget: «Feriepenge m.v. **55.000,00 kr.**» (12 × 3.750 + 10.000). Bilaget har kun de 12 rækker – en række med
     alene tillæg udelades (`eoBilagRules.ts:333-352` kræver beløb i Løn-kolonnerne), så bilagets tillæg summerer til
     45.000,00 kr.
- **Det er uhensigtsmæssigt fordi:** Modparten afstemmer grundlaget mod bilaget og finder en række, der står til 0,00 kr.,
  men er regnet med, eller et beløb på 10.000 kr., der ikke står nogen steder. Brugeren kan ikke se på skærmen, at
  rækken tæller.
- **Bedre ville være:** Rækkens «Samlet løn» og tillæg viser det beløb, beregningen bruger, også når perioden ikke har
  arbejdsdage; og en række, der bidrager til grundlaget, kommer med i bilaget, også når den kun har tillæg.
- **Andre steder det kan gælde:** Offentlige ydelsers bilag (12k) – uafprøvet.

**Tilbagemelding**
Enig, men det er en situation, hvor jeg let forudser, at der kunne opstå fejl i koden, så beløbet fx regnes med dbbbelt, eller at det får andre afledte konsekvenser, herunder i særdeleshed på kontrol-fanen og i andre mellemliggende beregninger og kontrolregninger, eller hvis perioden deles op, og så videre. Sørg for at tænke alle realistiske afledte problemstillinger grundigt igennem, når du fixer det.

### BB-293 – Bilaget kan ikke afstemmes med beregningsgrundlaget: ingen sum, perioderne blandet, og delvise rækker med fuldt beløb

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** Mellem
- **Beslutning:** **AFVIST** af udvikleren 2026-10-19: en sum, der svarer til grundlaget, kræver, at delvise lønperioder
  deles op, og så stemmer bilaget ikke længere med lønsedlerne. Intet ændret. Modsvar nedenfor (afventer udviklerens svar).
- **Sådan fremprovokeres det:**
  1. Grundsagen plus en række marts 2024 `10000` (indtægt i erstatningsperioden). Hent opgørelsen.
  2. Dato-tilstand: `01-06-2017` – `30-04-2018` `330000` og `01-05-2018` – `30-06-2018` `60000`. Hent opgørelsen.
- **Det sker:**
  1. Bilaget har 13 rækker i én tabel uden overskrift, skel eller sum. Grundlaget skriver «Løn i beregningsperioden
     360.000,00 kr.» og «Indtægter i erstatningsperioden Firma A 11.250,00 kr.» – læseren skal selv lægge 12 rækker sammen
     og vide, at den 13. hører til fradraget.
  2. Bilaget trykker anden række med hele «60.000,00»; grundlaget har «Løn i beregningsperioden **360.491,80 kr.**»,
     fordi kun 31 af rækkens 61 dage ligger i perioden (30.491,80 kr.). Bilagets rækker summerer til 390.000,00 kr.
     Brøken står ingen steder. Programmet kender opdelingen – bilagets filter bygger på samme periodegrupper
     (`periodRangeGroups.ts`).
- **Det er uhensigtsmæssigt fordi:** Bilaget findes for at dokumentere grundlaget, og modparten kan ikke komme fra det ene
  tal til det andet uden at gætte på reglen.
- **Bedre ville være:** Bilaget deler rækkerne under «Beregningsperioden (01-06-2017 – 31-05-2018)» og
  «Erstatningsperioden (01-01-2024 – 31-12-2024)», hver med en «I alt»-linje, der svarer til grundlagets tal; en række,
  der kun delvist ligger i perioden, får linjen «heraf medregnet 30.491,80 kr. (31 af 61 dage)».
- **Andre steder det kan gælde:** Offentlige ydelsers bilag (12k).

**Tilbagemelding**
Jeg er ikke enig. Din pointe er valid, men du har ikke tænkt den til ende, særlig i forhold til, når en beregnings- eller erstatningsperiode starter eller slutter midt i en lønperiode. I de situationer vil man ikke bare uden videre kunne få en korrekt I alt sum ved kun at vise perioderne i beregnings- eller erstatningsperioden, for i start/slut medregnes kun delvise lønperioder. Da ville det være nødvendigt i oversigten at dele perioden op og kun vise den del af lønnen i perioden, som hører til erstatnings-/beregningsperioden, og så stemmer oversigten pludselig ikke længere med lønsedlerne. Og det skaber da blot et andet problem, som er lige så stort og forvirrende, som det oprindelige problem, der blev forsøgt løst.

**Modsvar (afventer udviklerens svar)**

Jeg er enig i, at bilagets rækker skal stemme med lønsedlerne. Men forslaget delte ikke rækkerne op: den delvise række
skulle stå uændret med lønsedlens fulde beløb og blot have en ekstra linje under sig. I sag 2 ville bilaget se sådan ud:

| Dato fra | Dato til | Løn | … | Samlet løn |
|---|---|---|---|---|
| 01-06-2017 | 30-04-2018 | 330.000,00 | … | 371.250,00 |
| 01-05-2018 | 30-06-2018 | 60.000,00 | … | 67.500,00 |
| | heraf i beregningsperioden (31 af 61 dage) | 30.491,80 | … | 34.303,28 |
| **I alt i beregningsperioden** | | **360.491,80** | … | **405.553,28** |

Begge lønsedler står præcis som på papiret, og modparten kan se, hvordan programmet er nået fra 390.000 kr. til grundlagets
360.491,80 kr. Det er altså ikke det problem, du beskriver – men det er en tredje linjetype i en tabel, der i dag er enkel.

Desuden er de to bilag ikke ens i dag: **Offentlige ydelser-bilaget deler allerede rækkerne under hver periode** (med
overskrift, men uden sum), mens Lønindkomst-bilaget blander dem i én tabel.

Hvad foretrækker du?

1. **Som nu** – ingen ændring.
2. **Kun overskrifter:** Lønindkomst-bilaget deler rækkerne under «Beregningsperioden» og «Erstatningsperioden» som
   ydelsesbilaget, uden sum og uden ekstra linjer. Rækkerne står som lønsedlerne.
3. **Overskrifter, «heraf»-linje og sum** som i tabellen ovenfor, i begge bilag.

### BB-294 – Klik på «Måned» sorterer efter månedsnummer uden år – rækkefølgen gemmes, papiret følger med, og Ctrl+Z fortryder ikke

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **DELVIST GODKENDT** af udvikleren 2026-10-19: skærmens sortering er en ren visningsdetalje, som programmet
  ikke fortolker; bilagene trykker altid kronologisk. **GENNEMFØRT** 2026-10-19: Lønindkomst-bilaget sorterer efter
  periodens start og slut (`sortStandardLoenRowsChronologically`), ydelsesbilaget efter fra- og til-dato; rækker med samme
  periode beholder tabellens rækkefølge. Skærmens sortering er uændret. Modsvar om Årsløns dokument nedenfor.
- **Sådan fremprovokeres det:** Grundsagen. Klik kolonneoverskriften «Måned», tryk Ctrl+Z, hent opgørelsen.
- **Det sker:** Rækkerne bliver «1/2018 2/2018 3/2018 4/2018 5/2018 6/2017 … 12/2017»; andet klik giver «12/2017 …
  6/2017 5/2018 … 1/2018». Ctrl+Z ændrer intet (målt; sletning af en række fortrydes derimod). Rækkefølgen er gemt, og
  bilaget trykker den: «12 2017 · 11 2017 · … · 6 2017 · 5 2018 · … · 1 2018». Kronologisk orden nås kun ved først at
  sortere på «Måned» og derefter på «År». Uden sortering trykker bilaget indtastningsrækkefølgen, så en glemt måned,
  der tilføjes nederst, står efter maj 2018 (målt i BB-289).
- **Det er uhensigtsmæssigt fordi:** «Måned» er for brugeren en periode, ikke et tal fra 1 til 12, og den, der klikker for
  at få orden på tabellen, får et papir i blandet rækkefølge, han ikke kan fortryde.
- **Bedre ville være:** «Måned» og «År» sorterer begge efter perioden (år, måned), og bilaget trykker altid rækkerne
  kronologisk, uanset skærmens rækkefølge.
- **Andre steder det kan gælde:** Årslønsberegningens tabel (samme komponent). Uge- og dato-kolonnerne sorterer allerede
  kronologisk (`yyyy-ww`, ISO-dato).

**Tilbagemelding**
Delvist enig. Du må gerne være medspiller på at vurdere hensigtsmæssigheden af denne løsning: Jeg tænker, at bilaget altid bør vise rækkerne i korrekt kronologisk sorteringsrækkefølge, og dermed være fuldstændig løsrevet af den sortering, som brugeren har valgt på skærmen. Sorteringen på skærmen er dermed en ren visningsdetalje. Til gengæld skal brugeren ikke tvinges ind i en ramme, hvor vedkommende klikker på sortering efter måned, hvorefter programmet også indfortolker en sortering efter år for at gøre det kronologisk. På skærmen får brugeren præcis, hvad brugeren vælger af sortering, uden hjælp fra programmet, men i bilagene sker sortering automatisk i kronologisk rækkefølge, uden relation til hvilken sortering brugeren har valgt at få vist på skærmen.

**Modsvar (afventer udviklerens svar)**

Enig, og gennemført for opgørelsens to bilag. Jeg er enig i ikke at lade «Måned» sortere efter år: det ville være en skjult
regel, og med bilaget løsrevet er skærmens orden uden betydning for papiret. To ting står tilbage:

1. **Årslønsberegningens dokument** trykker også løntabellens rækker i skærmens rækkefølge. Skal princippet gælde dér også,
   så et klik på «Måned» på Årsløn heller ikke ændrer rækkefølgen i det hentede dokument? Jeg anbefaler ja.
2. **Ctrl+Z fortryder ikke en sortering**, og rækkefølgen gemmes i `.eo`-filen. Med bilagene løsrevet er det uskadeligt, så
   jeg foreslår ingen ændring – sig til, hvis du vil have, at en sortering kan fortrydes.

### BB-295 – En omvendt uge-periode bliver ikke rød, og boksen siger «Ugyldig værdi i Uge fra»

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-07--parvise-grænser-begge-felter-markeres-hver-med-sin-egen-udvej` og
  `#m-38--en-afgørelse-står-som-gennemført-men-koden-bærer-den-ikke`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-19. **GENNEMFØRT** 2026-10-19 som én fælles feltregel
  (`weekOrderValidator` ved siden af datoparrets `dateOrderValidator`), brugt af både EO og Årsløn: begge celler er røde
  med hver sin udvej – «Uge fra skal ligge før eller i uge til (05/2018)» / «Uge til skal ligge efter eller i uge fra
  (10/2018)»; feltnavnene er kolonnernes egne. Årsløns datokolonner bruger nu samme datoregel som EO («Fra-dato skal være
  før til-dato (01-01-2025)» / «Til-dato skal være efter fra-dato (01-06-2025)»), så BB-107 er gennemført på begge flader.
- **Sådan fremprovokeres det:** «Løn indtastes som» Uge. Tast «Uge fra» `10/2018` og «Uge til» `05/2018`.
- **Det sker:** Ingen af cellerne er røde (`aria-invalid = "false"`). Boksen: «Ugyldig værdi i Uge fra» og «Ingen
  indkomst i beregningsperioden», fordi rækken falder ud. I Dato-tilstand giver samme fejl to røde celler med hver sin
  tekst og modpartens dato. Ugerækkefølgen kontrolleres kun af den gamle rækkeregel (`indkomstRowValidation.ts`), ikke
  af en feltregel. På Årsløn er begge celler røde, men med den fælles tekst «Til-dato skal være efter fra-dato» – den
  form, BB-107 (2026-08-26) bad om at rette, og som revisionssporet kalder gennemført.
- **Det er uhensigtsmæssigt fordi:** Brugeren får at vide, at «Uge fra» er ugyldig, ser en gyldig uge og ingen rød celle,
  og kan ikke se, at det er kombinationen, der er galt.
- **Bedre ville være:** Som Dato-tilstanden: begge celler røde, hver med sin egen udvej – «Uge fra skal ligge før eller i
  uge til (05/2018)» / «Uge til skal ligge efter eller i uge fra (10/2018)» – og samme tekster på Årsløn.
- **Andre steder det kan gælde:** Årslønsberegningens ugekolonner (målt med den gamle tekst).

**Tilbagemelding**
Enig

### BB-296 – En uge, der ikke findes i året, giver «Der er udfyldt en ugyldig værdi i feltet 'Uge fra'»

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-38--en-afgørelse-står-som-gennemført-men-koden-bærer-den-ikke`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-19. **GENNEMFØRT** 2026-10-19: «Uge skal være mellem 1 og 52 i 2017» i både tooltip og «Fejl og advarsler» – for alle ugefelter (`weekDraftCore.ts`; readeren bruger nu en codec-leveret konkret tekst som issuets besked, som den gør for datoer, BB-128). Tooltippen havde i forvejen «Uge skal være mellem 1 og 52» uden år; det var boksen, der sagde «ugyldig værdi».
- **Sådan fremprovokeres det:** Uge-tilstand. Tast `53/2017` (2017 har 52 ISO-uger).
- **Det sker:** Rød celle med «Der er udfyldt en ugyldig værdi i feltet 'Uge fra'»; boksen siger «Uge fra er ikke
  angivet» (BB-291). Ordret det samme på Årsløn, hvor BB-114 (2026-08-26) afgjorde en konkret tekst og står som
  gennemført.
- **Det er uhensigtsmæssigt fordi:** Formen `uu/åååå` er overholdt; brugeren kan ikke gætte, at 2017 kun har 52 uger.
- **Bedre ville være:** BB-114's tekst: «Uge skal være mellem 1 og 52 i 2017» – på begge flader.
- **Andre steder det kan gælde:** Alle ugefelter (`createWeekFieldCodec`).

**Tilbagemelding**
Enig

### BB-297 – En måned med 100 gange så meget løn som de øvrige tages imod uden bemærkning

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Lav
- **Beslutning:** **DELVIST GODKENDT** af udvikleren 2026-10-19 – betinget af en løsning uden falske positiver. Ikke
  gennemført; forslag i modsvaret nedenfor afventer udviklerens svar.
- **Sådan fremprovokeres det:** Grundsagen; juni 2017's Løn `3000000` (et tastet nul for meget to gange).
- **Det sker:** Ingen ring, ingen linje. Papiret: «Løn i beregningsperioden 3.330.000,00 kr. … Månedsløn: 312.187,50 kr.»
  og **Beregnet krav 3.746.250,00 kr.** – mod 405.000,00 kr. Skærmen viser ikke kravet (BB-226).
- **Det er uhensigtsmæssigt fordi:** Beløbet er usandsynligt *i sagens egen sammenhæng*: de elleve andre rækker på samme
  kort er 30.000 kr. Fejlen ses først, hvis brugeren læser papiret.
- **Bedre ville være:** Gul, ikke-blokerende ring på en løncelle, der er mere end ti gange højere end kortets øvrige
  rækker i samme periode: «Lønnen er over ti gange højere end ansættelsesforholdets øvrige måneder – kontrollér beløbet».
  Grænsen er udviklerens.
- **Andre steder det kan gælde:** Årslønsberegningens tabel; offentlige ydelser (12k).

**Tilbagemelding**
Delvist enig, men jeg foregriber, at det vil skabe en betydelig risiko for falske positive. Hvis den skadelidte fx har et job med fast løn, men på et tidspunkt får en lønseddel med en mindre regulering af lønnen på grund af efterregulering med overenskomstmæssige stigninger, hvilket er meget almindeligt, og derfor får fx. 1000 kr. udbetalt på én lønseddel, vil mange af disse tilfælde blive flaget som falsk positive. Tilsvarende hvis skadelidtes ansættelsesforhold fx. ophører den 2. i en måned, og der dermed reelt blot er tale om en meget kort lønperiode. Hvis du kan finde en god, gennemtænkt løsning, der tager højde for alle sådanne situationer, så er jeg enig i, at perioder med en løn, der fx. er ti gange større eller mindre end normen, bør flages med en gul ring og ikke-blokerende advarsel.

**Modsvar (afventer udviklerens svar)**

Jeg kan ikke finde en løsning for **«ti gange mindre»**, der undgår de falske positiver, du nævner. En efterregulering på
1.000 kr., en løn for to dage, en måned med orlov, en deltidsmåned og en lønseddel med en ren tilbagebetaling ligner alle
præcis en tastefejl med et nul for lidt. Jeg foreslår derfor at droppe den retning helt.

**«Ti gange større»** kan derimod gøres næsten uden falske positiver, fordi de almindelige undtagelser er små beløb, ikke
store. Forslag:

- Rækken sammenlignes med **medianen af ansættelsesforholdets øvrige rækker i samme periode** (beregningsperioden for sig,
  erstatningsperioden for sig), så en lav løn efter skaden ikke får lønnen før skaden til at se høj ud.
- **Måned:** rækkens «Samlet løn» mod de øvrige månedsrækkers. **Uge og dato:** beløb pr. kalenderdag, så en række for et
  helt kvartal ikke ligner en tastefejl ved siden af månedsrækker.
- Der vurderes kun, når der er **mindst tre andre rækker** at sammenligne med, og en dato-række **kortere end en uge**
  vurderes ikke (en slutløn for to dage med feriepenge ville ellers se ud som 15 gange dagslønnen).
- Grænsen er **ti gange**. Tooltip og linje: «Lønnen er over ti gange højere end ansættelsesforholdets øvrige lønrækker i
  perioden – kontrollér beløbet». Gul ring på beløbscellen, intet spærres. Gælder også Årsløn og Offentlige ydelser.

Eksempler: grundsagens juni 2017 på 3.000.000 kr. flages (100 gange medianen 30.000 kr.); en bonus på 60.000 kr. flages
ikke (2 gange); en fratrædelsesgodtgørelse på 400.000 kr. i en månedsrække flages (13 gange) – den er sjælden og fortjener
et blik. Skal jeg gennemføre det sådan?

### BB-298 – En lønperiode efter dags dato tages imod uden den gule ring, Årsløn skulle have fået

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-38--en-afgørelse-står-som-gennemført-men-koden-bærer-den-ikke`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-19. **GENNEMFØRT** 2026-10-19 på EO og Årsløn (BB-115):
  periodecellen får gul ring med «Perioden ligger efter dags dato (19-10-2026)», og siden får linjen «Lønrækken 12-2026
  ligger efter dags dato (19-10-2026)» (EO: «Fejl og advarsler»; Årsløn: «Advarsler»). Måned: begge celler, når hele
  måneden ligger efter dags dato – den igangværende måned markeres ikke, fordi lønsedler ofte udstedes forud (BB-115's
  begrundelse). Uge og dato: den celle, hvis uge eller dato ligger efter dags dato. Spærrer intet.
- **Sådan fremprovokeres det:** Grundsagen plus en række Måned `12`, År `2026` (dags dato 19-10-2026, «Opgørelse lavet
  den» 01-02-2025).
- **Det sker:** Ingen ring, ingen linje. Rækken ligger uden for begge perioder og ignoreres; havde TAF-perioden dækket
  den, var den fradraget. Ved BB-115 (2026-08-26) bad udvikleren om en gul ring med tooltip på en fremtidig lønperiode
  på Årsløn – den findes heller ikke dér (målt, og ingen kode bærer den).
- **Det er uhensigtsmæssigt fordi:** En løn, der endnu ikke er udbetalt, er oftest en tastefejl i året, og her ligger den
  tilmed efter opgørelsens egen dato.
- **Bedre ville være:** Samme gule ring som besluttet for Årsløn, på begge flader: «Perioden ligger efter dags dato
  (19-10-2026)».
- **Andre steder det kan gælde:** Årslønsberegningens tabel.

**Tilbagemelding**
Enig

### BB-299 – De afledte kolonner forklarer ikke sig selv, og ATP-kolonnen hedder fire ting

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne` og
  `#m-38--en-afgørelse-står-som-gennemført-men-koden-bærer-den-ikke`
- **Prioritet:** Lav
- **Beslutning:** **AFVIST** af udvikleren 2026-10-19 (grundlæggende oplysninger, brugeren kender). Udviklerens tillægsønske er **GENNEMFØRT** 2026-10-19: linjen «Tillæg i tabellen er beregnet med de satser, der gjaldt i den enkelte måned.» er fjernet fra lønindkomst-bilaget. Modsvar om kolonnenavnene nedenfor (afventer udviklerens svar).
- **Sådan fremprovokeres det:** Hold musen over kolonneoverskrifterne; hent opgørelsen med en ATP-række; skift til
  «Tillæg angives som» Beløb.
- **Det sker:** Kun «Løn (2)» har et informationsikon. «FP/FV/SH/SO/St.B.» og «Arb.g. Pension» har ingen forklaring – og
  her regnes de tilmed med den enkelte måneds satser, ikke dem, satsafsnittet viser (BB-276). ATP-kolonnen hedder
  «ATP og anden løn u. tillæg» på skærmen, «ATP og løn u. till./pens.» i bilaget, «Arbejdsgivers ATP-bidrag og anden
  indkomst uden tillæg» i grundlaget og «ATP mv. u. tillæg» i Årsløns dokument. Tillægskolonnen hedder i grundlaget
  «Feriepenge m.v.» i Beløb-tilstand.
- **Det er uhensigtsmæssigt fordi:** BB-100 (2026-08-26) accepterede diskrete tooltips på netop de to kolonner; de findes
  ikke på nogen af de to flader. Og BB-111 gjorde dokumentets forkortelser til én erklæret form – EO's bilag har sin
  egen.
- **Bedre ville være:** Tooltips som BB-100's: «Beregnes af Løn + Løn (2) + Ikke-pensionsgivende løn» og «Beregnes af
  Løn + Løn (2) opskrevet med tillægsprocenterne». Bilaget bruger samme dokumentform som Årsløn for samme kolonne.
- **Andre steder det kan gælde:** Årslønsberegningens tabel.

**Tilbagemelding**
Jeg afviser fundet. Der er tale om grundlæggende informationer, som brugeren vil være bekendt med.

Herudover vil jeg i relation til dette, men i øvrigt uafhængigt af fundet, gerne have, at dette "Tillæg i tabellen er beregnet med de satser, der gjaldt i den enkelte måned." ikke længere angives i opgørelserne. Brugeren vil forvente den adfærd, som programmet har, og det behøver ikke blive forklaret.

**Modsvar (afventer udviklerens svar)**

Begrundelsen dækker tooltippene, men fundet havde en anden halvdel: **samme kolonne hedder fire forskellige ting.** Den, der
læser skærmen, bilaget og beregningsgrundlaget side om side, ser «ATP og anden løn u. tillæg» (skærm), «ATP og løn u.
till./pens.» (bilag), «Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg» (beregningsgrundlag) og «ATP mv. u. tillæg»
(Årsløns dokument) – og kan ikke vide, at det er samme beløb. Det handler ikke om forklaring, men om genkendelse.

1. Er navnene også afvist, eller må jeg samle dem til ét navn pr. kanal efter BB-111's dokumentform – skærmen
   «ATP og anden løn u. tillæg» og dokumenterne én fælles forkortelse, fx «ATP og anden løn u. tillæg» hvor der er plads og
   «ATP mv. u. tillæg» i smalle tabeller?
2. BB-100 (Årsløn, 2026-08-26) accepterede netop disse tooltips og står som gennemført, men de blev aldrig lavet. Jeg
   noterer BB-100 som afvist af samme grund, medmindre du siger andet.

## Overvejet uden fund

- **Tocifret år** `17` bliver `2017` (én fælles regel, BB-009).
- **0 kr. i en række** tages imod, regnes som en måned uden løn og trykkes med 0,00 (BB-098's afgørelse).
- **Samme periode to gange med forskellige beløb** (to lønsedler) og **overlappende datorækker** lægges sammen uden
  advarsel – BB-096 afgjorde, at det er lovligt; kun identiske rækker er en fejl (BB-289).
- **Rækker uden for begge perioder** (2016, 2020) ignoreres tavst og trykkes ikke med «Perioden»; med «Alle» kommer de
  med. Et forkert årstal fanges indirekte, fordi måneden så bliver et hul med navngiven gul linje.
- **Rækker i erstatningsperioden** fradrages som «Indtægter i erstatningsperioden Firma A 11.250,00 kr.» inkl. 12,5 %
  feriegodtgørelse. Reglen er beregningsteknisk og er ikke vurderet.
- **Netto positiv række med negativ Løn (2)** regnes rigtigt (28.125,00 kr.).
- **Skift af «Løn indtastes som»** bevarer værdierne og spærrer med «Uge fra er ikke angivet» og «Ingen indkomst i
  beregningsperioden» – BB-105 afviste samme forhold på Årsløn.
- **Udtryk** i ATP-kolonnen (`100+50` → 150,00 kr.) virker og trykkes som beløb.
- **Punktum ved tastning** (`30.000,00`) springes over og giver 30.000,00 kr. (BF-032).
- **Slet rækken** sker uden dialog, og Ctrl+Z bringer rækken tilbage.
- **To ansættelsesforhold** med samme mangel giver to linjer med «Lønindkomst -> Ansættelsesforhold 1/2» (BB-278 virker).
- **Alle rækker 0 kr.** giver «Ingen indkomst i beregningsperioden» med link; ingen intern undtagelse (BB-258's rettelse
  holder for lønudvikling «Ingen»).
- **«Lønperiode er udfyldt uden beløb»** er gul og spærrer ikke (målt: aktiv download) – kun ordlyden er med i BB-291.
- **Hul i beregningsperioden** («Der er hverken angivet løn eller offentlige ydelser for 01-07-2017 - 31-07-2017») er præcis
  og navngiver perioden.
- **«Løn (2)»s navn og ikon** er afgjort ved BB-116 og prøves ikke igen.
- **Afrundingen** «12 måneder á 33.796,11 kr. = 405.553,32 kr.» mod «I alt: 405.553,28 kr.» følger «vist = beregnet».
- **M-09 bestået:** ved 1244×620 er `scrollWidth = clientWidth = 1244`; tabellen er 893 px bred.
- **Konsollen** var tavs i alle forløb undtagen BB-290's systemfejl.

## Henvisninger til andre bidder

- **12i:** den manuelle regulerings linje, der genbruger røde celler fra denne tabel («Manuel regulering: <celle>»).
- **12k:** dublet-kontrollen og de negative beløb i offentlige ydelser (BB-289, BB-290), deres bilag (BB-292, BB-293).
- **12l/12m:** «Kontroltabel»-linket, når kontrolfanerne er slået fra (BB-290).
- **Årsløn (uden for 12h):** BB-107, BB-114 og BB-115 står som gennemført, men findes ikke i koden; BB-100's tooltip
  heller ikke (M-38).

## Dækningshuller

- Kun Chrome, lyst tema; kun pdf-kanalen er læst.
- Offentlige overenskomster, løntrin og satser, der skifter midt i beregningsperioden, er ikke afprøvet i tabellen
  (BB-276's form er 12g's).
- Indsættelse af flere celler fra et regneark (M-14/BB-088) og autofill-forslagene er ikke afprøvet.
- Tastaturrækkefølgen i tabellen og meget lange tabeller (ydelse) er ikke afprøvet.
- Komprimeret beregning efter første opgørelse og erhvervssygdom er ikke afprøvet.

## Åbne spørgsmål

Afgjort 2026-10-19: en negativ lønrække regnes med og modregnes (BB-290). Afventer udviklerens svar på modsvarene:

- **BB-290:** skal en kilde, der SAMLET er negativ i en periode, fortsat spærre (anbefalet), og skal
  sygeferiegodtgørelsen også modregne negative rækker (anbefalet ja)?
- **BB-293:** bilagets periodeskel og sum – som nu, kun overskrifter, eller overskrifter med «heraf»-linje og sum?
- **BB-294:** skal Årsløns dokument også trykke rækkerne kronologisk (anbefalet ja)?
- **BB-297:** gennemføres advarslen kun for «ti gange større» med de foreslåede værn?
- **BB-299:** er kolonnenavnenes uensartethed også afvist, og noteres BB-100 som afvist?
