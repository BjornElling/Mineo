# Brugerblik – Årslønsberegning

- Rute/placering: `/aarsloen` (flade 9, ingen faner)
- Gennemgået: 2026-08-25 · commit `45f7fb3b`
- Afprøvet i: Chrome, 1536×864, lyst tema. Dokumenter hentet som `.docx` og læst linje for linje.
  Konsollen overvåget hele kørslen: 197 beskeder, **0 fejl, 0 advarsler**.

## Fladen kort

Årslønsberegning er programmets første flade med en **større indtastningstabel**. Siden består af fire
bokse: **Satser** (lønperiode, tillægsform og fem procentsatser), **Indtægtsoplysninger** (løntabellen
med ni kolonner), **Beregningsprincipper** (omregning til fuldt år og de fem felter, den låser op) og
**Beregning** (sammentælling og mellemregninger). Dertil to meddelelsesbokse, der kun vises når de har
indhold: **Advarsler** og **Dokument-fejl**.

Fladen producerer **to** dokumenter: årslønsdokumentet og et SH-dage-bilag. Den viser **ingen**
stamdataoplysninger, men årslønsdokumentet afhænger af Stamdata gennem brevhovedet.

Løntabellen (`StandardLoenTable`) deles med Erstatningsopgørelsens lønindkomst-fane, så alt, der
handler om tabellen selv, hører sammen med flade 12.

---

## Fund

### BB-096 – Den samme måned to gange fordobler årslønnen uden et ord

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-23**
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger (beregning)
- **Sådan fremprovokeres det:**
  1. Løn indtastes som **Måned**. Feriegodtgørelse `12,5`, SH/SO `2,5`, Løn på helligdage
     «SH-udbetaling».
  2. Række 1: Måned `1`, År `2025`, Løn `30000`.
  3. Række 2: **nøjagtig det samme** – Måned `1`, År `2025`, Løn `30000`.
  4. Slå «Omregning til fuldt år» til.
- **Det sker:** Sammentællingen bliver `69.000,00 kr.` (begge rækker), mens tidslinjen kun tæller
  måneden **én** gang: «Arbejdsdage i beregningsperioden (23 hverdage - 1 SH-dag): 22 arbejdsdage».
  Resultatet bliver **`793.500,00 kr.`** – præcis det dobbelte af de `396.750,00 kr.`, én række giver.
  Ingen celle er rød, der er ingen advarsel, og begge dokumenter kan hentes.
- **Det er uhensigtsmæssigt fordi:** Programmet **ved**, at de to rækker beskriver samme tidsrum – det
  er netop derfor, det kun tæller 23 hverdage. Alligevel lægger det pengene sammen som om de var to
  forskellige perioder. Fejlen giver et tal, der er 100 % forkert, og som brugeren ikke har nogen
  anledning til at betvivle: begge rækker står synligt i tabellen og ser rigtige ud hver for sig. Det
  er den næstøverste kategori i prioriteringen (et forkert tal uden anledning til mistanke), og det er
  en let fejl at lave – to ens rækker opstår ved en gentaget indtastning, en kopieret linje eller to
  ansættelsesforhold i samme måned.
- **Bedre ville være:** At fladen markerer rækker, hvis perioder overlapper hinanden, og siger det med
  ord – fx en linje i «Advarsler»: «To eller flere lønrækker dækker samme periode (januar 2025).
  Perioden tælles én gang i dagene, men beløbene lægges sammen.» Om overlappet skal blokere eller kun
  advare er brugerens valg: der findes et lovligt tilfælde (to ansættelsesforhold i samme måned), hvor
  sammenlægningen af beløb er den rigtige adfærd – men så er *dagene* det, der er talt forkert, ikke
  pengene.
- **Andre steder det kan gælde:** Samme mekanisme i **Dato**-tilstand (`beregnDagPeriode` bygger et
  `datoSet`, altså en union) og i **Uge**-tilstand. Uverificerede kandidater: EO's lønindkomst-fane
  (samme tabelkomponent, egen aggregering), forsørgertabs og EET's periodetabeller.

**Tilbagemelding**
Jeg afviser delvist dit fund. Ved årslønsberegning vil det ofte ske, at der er to lønbilag for samme periode, herunder fx ved løn fra to ansættelsesforhold. Behovet for at kunne lave en sådan beregning uden at få fejl, overstiger den potentielle risiko for, at der ved en fejl indtastes to lønbeløb for samme periode.

jeg vil dog gerne have, at der generelt - det vil sige ikke kun her - laves en kontrol af indtastninger i tabeller, hvor hvis der indtastes to rækker med nøjagtig samme indhold, altså samme fra- og til-dato, og samme beregnede beløb (dvs. det beregnede slutresultat, ikke nødvendigvs det nøjagtig indtastning) i alle indtastnings-felterne i rækken, så skal det flages som en fejl. Umiddelbart kan jeg komme i tanke om årsløn-tabellen, lønindkomst-tabeller (her skal det vurderes inden for hvert individuelt ansættelsesforhold, ikke på tværs af ansættelsesforhold), og på fanen med offentlige ydelser.

### BB-097 – «Antal feriedage» kan overstige periodens egne hverdage: -76 arbejdsdage og en årsløn på 0,00 kr.

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-24**
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger (beregning)
- **Sådan fremprovokeres det:**
  1. Én lønrække: Måned `1`, År `2025`, Løn `30000`. Feriegodtgørelse `12,5`.
  2. Slå «Omregning til fuldt år» til og «Fuld løn under ferie» **fra**.
  3. Skriv `99` i «Antal feriedage (mandag-fredag) i de indtastede perioder».
- **Det sker:** Beregningsprincipper-boksen skriver «Antal hverdage i den indtastede periode:
  **-76 hverdage**». Beregning-boksen skriver «Hverdage i beregningsperioden (23 hverdage -
  99 feriedage): **-76 hverdage**» og «Beregnet årsløn (33.750,00 / **-76** × 231): **0,00 kr.**».
  Feltet er ikke rødt, der er ingen advarsel, og **«Download som Word» er aktiv** – dokumentet kan
  hentes med årslønnen 0,00 kr.
- **Det er uhensigtsmæssigt fordi:** En periode kan ikke indeholde et negativt antal hverdage, og
  programmet ved præcis, hvor mange hverdage perioden har – det er tallet, det selv skriver i samme
  linje. Feltets erklærede grænse (0–99) er valgt efter feltets *art* (et antal dage), ikke efter det
  tal, det bliver trukket fra. Resultatet `0,00 kr.` er ikke en fejlmeddelelse, men et beløb: det
  ligner et svar, det står i fed, og det kan trykkes i et dokument.
  Bemærk desuden, at feltets bounds-besked («Antal feriedage skal være mellem 0 og 99.») **aldrig kan
  vises**: cifferloftet er to cifre, så 100 kan ikke tastes. Grænsen afværger derfor intet i praksis.
- **Bedre ville være:** At feltets maksimum udledes af periodens egne hverdage – «Antal feriedage kan
  højst være 23 (hverdage i de indtastede perioder)» som rød feltfejl, på samme måde som Tillægstid på
  MinProcesrente fik sin afledte grænse med BB-037. Alternativt, hvis en overskridelse skal være
  lovlig: at et ikke-positivt antal arbejdsdage giver en rød feltfejl frem for beløbet 0,00 kr.
- **Andre steder det kan gælde:** «Antal SH-dage» er beregnet og kan ikke rammes. Uverificerede
  kandidater: ethvert felt, hvis værdi trækkes fra et tal, programmet selv har beregnet – EET's og
  forsørgertabs fradragsfelter.

**Tilbagemelding**
Jeg tænker, at det bliver uhensigtsmæssigt med en egentlig begrænsning i brugerens mulighed for at indtaste - men jeg er enig i, at det vil vøre hensigtsmæssigt og korrekt, at der kom rød ring og tooltip i feltet med antal feriedage, som forklarede fejlen. undersøg gerne om lignende fejl ville kunne opstå andre steder, navnlig på eo-oplysninger fanen, og sørg for, at fejl i indtastningen i givet fald blokerer download og vises på eo-beregning-fanen.

### BB-098 – En lønrække med beløbet 0,00 kr. spærrer dokumentet med «Indtastning mangler», og intet er rødt

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-16** (skærpet)
- **Prioritet:** Høj
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Én lønrække: Måned `1`, År `2025`, Løn `0`.
- **Det sker:** Alle tre celler er udfyldt, ingen af dem er rød. «Sammentælling af løn fra tabellen»
  viser `0,00 kr.`. Slås omregning til, skriver Beregning-boksen «Antal måneder i indtastede perioder:
  1 måned» og «Beregnet årsløn (0,00 / 1 × 12): **0,00 kr.**» med fed skrift. Downloadknappen er grå
  med teksten **«Indtastning mangler»**.
- **Det er uhensigtsmæssigt fordi:** Der mangler ingen indtastning. Brugeren har skrevet et beløb, kan
  se det i tabellen, og siden viser et færdigt resultat – men programmet nægter at trykke det og
  påstår, at noget mangler. Der er intet rødt felt at gå efter og ingen anden anvisning. Årsagen er, at
  fladen har **to forskellige svar** på «er der noget her?»: tabelvalideringen regner et eksplicit 0 som
  udfyldt (og giver derfor ikke `missing_amount`), mens dokumentgatens `hasAtLeastOneValidRow` kræver, at
  rækkens samlede løn er **forskellig fra nul**. De to prædikater er enige om alt andet end netop nullet.
- **Bedre ville være:** At de to svar bliver ét. Enten skal 0 kr. være en lovlig lønrække (dokumentet
  dannes, og nul er en oplysning, jf. M-13's afgørelse), eller også skal 0 kr. være en rød feltfejl på
  beløbscellen med teksten «Beløbet skal være større end 0 kr.» – ordret den rettelse, BB-038 gav
  MinProcesrente. Den anden vej er den, der stemmer med M-16: årsagen skal kunne ses **ved rækken**.
- **Andre steder det kan gælde:** Samme prædikatpar bruges af EO's lønindkomst-tabel
  (`isStandardLoenTableCellEffectivelyEmpty` mod
  `isStandardLoenTableValueEffectivelyEmptyForValidation`). Uverificeret.

**Tilbagemelding**
For renteberegning skal 0 kr. være en forkert indtastning, der skal give fejlmeddelelse. Det giver ikke mening at beregne renter af 0 kr.

Når det kommer til løn, årslønsberegning, offentlige ydelser med videre, vil det til gengæld være fuldt ud acceptabel adfærd, at der angives 0 kr. Brugeren kan fx have behov for at tydeliggøre, at der i en måned ikke har været nogen lønindkomst - så er det væsentlig mere tydeligt, hvis der er indtastet perioden og 0 kr., end hvis perioden blot manglede i oversigten og kunne se ud som om, den var glemt.

### BB-099 – Tabellens «Samlet løn» regner videre på en rød sats, som om den var tom

- **Type:** Fejl
- **Rækkevidde:** Lokal (men se M-19)
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør (teknisk konvergens), beregningsvisning forelægges
- **Sådan fremprovokeres det:**
  1. Én lønrække: Måned `1`, År `2025`, Løn `30000`.
  2. Skriv `150` i «Feriegodtgørelse/-tillæg» (feltet bliver rødt: «Procent skal være mellem 0,00 og
     100,00»).
- **Det sker:** «Sammentælling af løn fra tabellen» viser korrekt `—`, fordi beregningen ikke må hvile
  på en skjult tomværdi. Men **tabellens egen række** viser samtidig «FP/FV/SH/SO/St.B. **0,00 kr.**»
  og «Samlet løn **30.000,00 kr.**» – altså et tal beregnet med satsen sat til nul. Med en gyldig sats
  på 12,5 % viser samme række `3.750,00` / `33.750,00`.
- **Det er uhensigtsmæssigt fordi:** Skærmen siger to ting om det samme: nederst «det kan ikke
  beregnes», i tabellen «30.000,00 kr.». Tallet i tabellen er ikke et fravær, men et **forkert
  resultat** – præcis den misvisning, `—` er indført for at undgå (`aarsloenProjection.ts` §3.9).
  Tabelrækken er dertil det tal, brugeren læser først, fordi den står ved siden af det, han netop har
  tastet.
- **Bedre ville være:** At de tre afledte kolonner (FP/FV/SH/SO/St.B., Arb.g. Pension, Samlet løn)
  viser `—` på samme betingelse som sammentællingen, når en sats, de afhænger af, er rød.
- **Andre steder det kan gælde:** EO's lønindkomst-tabel bruger samme afledte kolonner med satser fra
  en anden flade. Uverificeret.

**Tilbagemelding**
Jeg er enig. Overvej gerne om løsningen for visning er konsekvens med resten af programmets adfærd. Hvis ikke, så overvej gerne, om der bør være én eller flere standardiserede måder at vise dette.

### BB-100 – Tillæggenes beregningsgrundlag er usynligt, og de to kolonner følger modsatte regler

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Feriegodtgørelse `12,5`, SH/SO `2,5`, Arbejdsgivers pensionsbidrag `12`.
  2. Én lønrække: Løn `30000`, **Ikke-pensionsgivende løn** `1000`.
- **Det sker:** Rækken viser «FP/FV/SH/SO/St.B. **4.650,00 kr.**» og «Arb.g. Pension **4.140,00 kr.**».
  Målt betyder det:
  - tillægget regnes af `(30.000 + 1.000) × 15 %` – **«Ikke-pensionsgivende løn» tæller MED**;
  - pensionen regnes af `30.000 × (1 + 15 %) × 12 %` – **«Ikke-pensionsgivende løn» tæller IKKE med**,
    og grundlaget er opskrevet med de samlede tillægsprocenter.
  Ingen af de to regler står nogen steder – hverken på skærmen, i en tooltip eller i dokumentet.
- **Det er uhensigtsmæssigt fordi:** Fladen viser ellers hver eneste mellemregning i detaljer:
  «Hverdage i beregningsperioden (23 hverdage - 2 feriedage)», «Beregnet årsløn (33.750,00 / 21 ×
  231)». Netop dér hvor pengene skabes – rækkens to tillægskolonner – er der ingen mellemregning.
  Brugeren kan ikke efterprøve 4.140,00 kr., og han kan ikke gætte reglen: kolonnen hedder
  **Ikke-pensionsgivende** løn og indgår alligevel i tillægget, mens pensionsgrundlaget er et beløb,
  der ikke står nogen steder på skærmen.
- **Bedre ville være:** Et informationsikon på hver af de to kolonneoverskrifter, i samme form som det,
  «Løn (2)» allerede har: «Beregnes af Løn + Løn (2) + Ikke-pensionsgivende løn» henholdsvis «Beregnes
  af Løn + Løn (2) opskrevet med de samlede tillægsprocenter». Eventuelt også som en linje i
  dokumentets Satser-afsnit.
- **Andre steder det kan gælde:** Samme to kolonner i EO's lønindkomst-tabel.

**Tilbagemelding**
Jeg kan se, hvorfor du har flaget dette, og dine betragninger er overordnet set valide. Der er dog tale om professionelle brugere, der langt hen ad vejen må forventes at kende og forstå beregningsprincipperne. Så det vil være forkert med meget lange forklaringer, der fylder meget. Hvis du mener, at forklaringer kan indsættes diskret og uden at fylde for meget gennem fx. tooltips, så gør gerne det.

### BB-101 – For et helt kalenderår nævner hverken skærmen eller dokumentet en «Beregnet årsløn»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Løn indtastes som Måned. Tolv rækker: måned `1`–`12`, år `2025`, Løn `30000` i hver.
  2. Slå «Omregning til fuldt år» til.
- **Det sker:** Beregningsprincipper viser «Antal måneder i de indtastede perioder: 12 måneder», «Fuld
  løn under ferie» og «Løn på helligdage». Beregning-boksen indeholder **én linje**: «Sammentælling af
  løn fra tabellen: 360.000,00 kr.» med downloadikonet. Ordet «årsløn» står ikke i resultatet.
  Dokumentet – der hedder «Årslønsberegning» – ender tilsvarende med tabellens «I alt 360.000,00» og
  et Beregningsprincipper-afsnit, uden nogen linje om en årsløn.
  **Og i samme tilstand er fire af Beregningsprincippers felter uden virkning.** Med tolv måneder
  udfyldt vises «Fuld løn under ferie», «Ret til 6. ferieuge», «Antal feriedage» og hverdagstallet
  fortsat, og de kan alle ændres – men ingen af dem flytter et eneste tal, fordi der ikke sker nogen
  omregning. Målt: med «Fuld løn under ferie» fra og «Ret til 6. ferieuge» fra viser boksen «Antal
  hverdage i de indtastede perioder: 261 hverdage» og et tomt feriedage-felt, mens resultatet er
  uændret. (Kun «Løn på helligdage» har fortsat en virkning – den styrer SH-dage-bilaget.)
- **Det er uhensigtsmæssigt fordi:** Sidens hele formål er at producere ét tal med ét navn. Netop i det
  tilfælde, hvor grundlaget er mest fuldstændigt (et helt år), forsvinder navnet. Brugeren har
  udtrykkeligt slået «Omregning til fuldt år» til og får ingen omregning at se – han skal selv slutte,
  at sammentællingen *er* årslønnen. Modparten, der læser dokumentet, har samme opgave.
  Dertil sidder han med fire betjenbare felter, der ikke gør noget: han kan sætte antal feriedage til
  40 og se resultatet stå bomstille. Koden begrunder fraværet af mellemregningen med, at «brugeren selv
  har valgt at indtaste data for et fuldt år og forventes at genkende dette»
  (`aarsloenCalculations.ts`) – det er en truffet beslutning om *mellemregningen*, men den forklarer
  hverken, hvorfor **navnet** også forsvinder, eller hvorfor felterne bliver stående aktive.
- **Bedre ville være:** At Beregning-boksen og dokumentet i dette tilfælde tilføjer en afsluttende
  linje «Beregnet årsløn: 360.000,00 kr.» (uden formel, fordi der ingen omregning er), så navnet på
  resultatet er det samme uanset grundlaget – og at de felter, der ikke længere har nogen virkning,
  enten skjules eller siger det (fx «Perioden er præcis et år, så der omregnes ikke»).
- **Andre steder det kan gælde:** Ingen; `erEtAar` findes kun her.

**Tilbagemelding**
Jeg anerkender og er enig i dit fund og dit forslag til rettelse.

### BB-102 – «Omregning til fuldt år» ser aktiv ud, afviser klikket og svarer kun med et blink i tabellen

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. En lønrække med et beløb, men uden periode (eller en helt tom tabel).
  2. Klik på «Omregning til fuldt år».
- **Det sker:** Togglen bliver stående i «fra». Der kommer ingen tekst, ingen tooltip og ingen
  besked. Én tabelcelle får klassen `mineo-field-attention-blink` i ca. 1,5 sekund og er derefter helt
  gennemsigtig igen. Fokus bliver på togglen.
- **Det er uhensigtsmæssigt fordi:** Programmet har allerede afgjort, hvordan en handling, der ikke kan
  udføres, skal svare: **synligt og reelt inaktiv med årsagen i tooltippen** (BF-059/BF-060, gjort
  generel for «enhver deaktiveret handling» i `page-component-contract.md` §11.1a). Omregnings-togglen
  er den eneste kontrol på siden, der bryder reglen: den ser trykbar ud, tager imod klikket og gør
  ingenting. Blinker cellen uden for skærmbilledet – hvad den gør, når tabellen har mange rækker –
  får brugeren slet intet svar. Det svarer til rystelsen, der netop blev fjernet fra hele programmet,
  blot uden rystelsen.
- **Bedre ville være:** At togglen er inaktiv, når den ikke kan slås til, med den konkrete årsag i
  tooltippen: «Kræver mindst én lønrække med både periode og beløb». Cellemarkeringen kan bevares som
  vejvisning ved klik på den inaktive kontrol (den peger et sted hen, og det er den del af den gamle
  feedback, der havde værdi).
- **Andre steder det kan gælde:** Enhver toggle med en `commit`-override. `rg "commit=\{"` over
  `ToggleField`-kaldssteder – uverificeret.

**Tilbagemelding**
Jeg anerkender problemet og din løsning.

### BB-103 – I Beløb-tilstand ignoreres satserne uden besked, men advarslen om dem bliver stående

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Feriegodtgørelse `12,5`. Én lønrække: Måned `1`, År `2025`, Løn `30000`. Omregning til.
     Resultatet er `405.000,00 kr.`
  2. Skift «Tillæg angives som» fra Procent til **Beløb**.
- **Det sker:** De fem procentfelter forsvinder fra Satser-boksen, rækkens FP/FV-kolonne bliver et tomt
  indtastningsfelt, og resultatet falder til `360.000,00 kr.` – 45.000 kr. mindre – uden en eneste
  besked. Samtidig står «Advarsler» uændret med sætningen **«En feriepengesats på 12,5 % gør det højst
  usandsynligt, at der er ret til løn under ferie.»** – om en sats, programmet lige har holdt op med at
  bruge, og et felt, brugeren ikke længere kan se.
- **Det er uhensigtsmæssigt fordi:** Advarslen er den eneste tekst på siden, der nævner satsen, og den
  er nu usand: der er ingen feriepengesats i beregningen. Brugeren, der leder efter det felt,
  advarslen taler om, finder det ikke. Dertil er faldet på 45.000 kr. den slags ændring, der bør
  bemærkes – værdierne bevares korrekt og kommer tilbage ved skift tilbage til Procent, men mens
  Beløb-tilstanden er valgt, findes de kun i en usynlig tilstand.
  Boksen hedder desuden fortsat **«Satser»**, selv om den i Beløb-tilstand ikke indeholder en eneste
  sats.
- **Bedre ville være:** At `beregnFejlmeddelelser` kun kører i Procent-tilstand, så advarslerne følger
  de felter, der faktisk er i brug – samme relevans-prædikat, som styrer feltsynligheden
  (`aarsloen-contract.md` §2-regel 5). Om der derudover skal stå en linje om, at satserne bevares og
  ignoreres, er brugerens valg.
- **Andre steder det kan gælde:** Enhver advarselstekst, der læser et felt, hvis relevans er
  tilstandsstyret. EO's lønindkomst har samme tilstandsskift.

**Tilbagemelding**
Jeg anerkender problemet. Hvis løsningen er i tråd med programmets generelle fremgangsmåder, eller i øvrigt er udtryk for en god, velstruktureret løsning, så accepterer jeg også den. Jeg vil så vidt muligt gerne undgå parallel logik.

### BB-104 – De to downloadknapper på siden hedder det samme

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Sæt «Løn på helligdage» til «SH-udbetaling» med en gyldig lønrække og omregning slået til.
- **Det sker:** Siden viser to downloadikoner: ét ved «Antal SH-dage i de indtastede perioder» og ét
  ved «Beregnet årsløn». Begge har det tilgængelige navn og tooltippet **«Download som Word»** (målt:
  `getByRole('button', { name: 'Download som Word' })` giver 2 træffere). De henter to helt
  forskellige dokumenter: `Årslønsberegning.docx` og `SH-dage (01-01-2025 - 31-01-2025).docx`.
- **Det er uhensigtsmæssigt fordi:** Tooltippen er det eneste, der forklarer et ikon uden tekst, og her
  forklarer den ingenting: den siger formatet, ikke indholdet. Placeringen er den eneste ledetråd, og
  den forsvinder for den, der navigerer med tastatur (begge knapper er i Tab-rækkefølgen efter BF-038)
  eller med skærmlæser. Er den ene knap dertil blokeret af Stamdata og den anden ikke – hvad der er
  den normale tilstand, fordi SH-dage-bilagets brevhoved er slået fra som standard – står to knapper
  med samme navn i to forskellige tilstande.
- **Bedre ville være:** At de to knappers navn/tooltip navngiver dokumentet: «Download årsløn som Word»
  og «Download SH-dage som Word». Formatet kan blive stående, fordi det skifter med indstillingen.
- **Andre steder det kan gælde:** Alle flader med mere end ét dokument – Renteberegning (rækkens
  specifikation + samlet oversigt, hvor navnene allerede er forskellige), EO's fire outputs.
  Uverificeret.

**Tilbagemelding**

Jeg er ikke enig i, at det er et stort problem. Men hvis det kan løses på en simpel, velstruktureret fælles løsning, som ikke bliver visuelt grim eller tilføjer mere tekst på selv programmets brugerflade, så ok.

### BB-105 – Skift af «Løn indtastes som» tømmer perioden, slukker omregningen og spærrer dokumentet, uden at noget peger på hvorfor

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-16** (den rene mangel-form)
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Løn indtastes som Måned. Én række: Måned `1`, År `2025`, Løn `30000`. Omregning til.
     Resultatet er `405.000,00 kr.`, og «Download som Word» er aktiv.
  2. Klik på radioknappen **Dato**.
- **Det sker:** Kolonneoverskrifterne bliver «Dato fra»/«Dato til», og de to periodeceller står
  **tomme**, mens beløbene bliver stående. Beregningsprincipper-boksen kollapser til kun togglen,
  omregnings-togglen slår sig selv **fra**, Beregning-boksen falder tilbage til «Sammentælling af løn
  fra tabellen: 33.750,00 kr.», og downloadknappen bliver grå med **«Indtastning mangler»**. Ingen
  celle er rød. Klik tilbage på **Måned** genskaber alt uændret – ingen data går tabt.
- **Det er uhensigtsmæssigt fordi:** Ét klik på en radioknap slukker hele sidens resultat, og intet på
  skærmen forbinder de to ting. Rækken er nu «beløb uden periode», hvilket programmet internt kender
  som `partial_period` – men den fejl er efter kontrakten bevidst ikke et rødt felt (en halvfærdig
  række må ikke være rød under indtastningen), så der er ingen synlig anvisning overhovedet. Brugeren
  ser en tabel, hvor tallene står, og en knap, der siger at der mangler indtastning.
  Bemærk skellet til BB-083 på Renteberegning: dér var det brugeren, der efterlod rækken halvfærdig.
  Her er det **programmet**, der tømmer to celler som følge af et valg et andet sted.
- **Bedre ville være:** At skiftet siger, hvad det gør – enten en linje i «Advarsler» («Perioderne skal
  indtastes på ny, når lønperioden ændres. De hidtidige måneder er bevaret og kommer tilbage, hvis du
  vælger Måned igen.»), eller at cellemarkeringen fra M-16's rene mangel-form peger på den nu tomme
  periodecelle.
- **Andre steder det kan gælde:** Samme radiogruppe findes i EO's lønindkomst pr. ansættelsesforhold.
  Generelt: ethvert valg, der skifter hvilke kolonner en tabel viser.

**Tilbagemelding**
Dette er ikke en fejl og jeg afviser dit fund. Brugeren vil vide og forvente, at nå lønperioden ændres til et andet format, forsvinder de tidligere indtastninger. De slettes desuden ikke, men vil blive vist igen, hvis der skiftes tilbage til det oprindelige format for indtastning. Det er forventelig og korrekt adfærd.

### BB-106 – To af Indstillingers tre standardværdier for de samme tre felter slår ikke igennem på Årsløn

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Indstillinger → Standardværdier → **Tabt arbejdsfortjeneste**: sæt «Løn indtastes som» til **Uge**,
     slå «Fuld løn under ferie» **fra**, og sæt «Løn på helligdage» til **Ingen**.
  2. «Slet alt» → «Ja, slet» (ny sag).
  3. Gå til Årslønsberegning, udfyld en lønrække og slå omregning til.
- **Det sker:** Tabellen viser «Uge fra»/«Uge til» – **den ene** indstilling er slået igennem. Men
  «Fuld løn under ferie» står **til**, og «Løn på helligdage» står på **«Almindelig løn»** (målt:
  togglen er `true`, og SH-dage-rækken vises ikke). De to sidste indstillinger går kun til
  Erstatningsopgørelsens lønindkomst.
- **Det er uhensigtsmæssigt fordi:** De tre felter på Årslønssiden hedder **ordret** det samme som de
  tre indstillinger: «Løn indtastes som», «Fuld løn under ferie», «Løn på helligdage». Brugeren, der
  har sat sine standardværdier, har ingen måde at vide, at kun én af dem gælder her – og han opdager
  det først, hvis han bemærker, at de to andre står på noget andet. Det er værre end hvis ingen af dem
  virkede: at den første virker, er selve beviset for, at boksen gælder denne side.
  Overskriften «Tabt arbejdsfortjeneste» er den eneste ledetråd, og den peger et andet sted hen end
  det felt, der faktisk virker.
- **Bedre ville være:** At alle tre standardværdier gælder en ny sags Årsløn, som «Løn indtastes som»
  allerede gør (`resolveAarsloenNewCaseDefaults` udvides med de to felter). Alternativt – hvis de
  bevidst kun skal gælde EO – at det er den **første** indstilling, der laves om, så boksen er
  entydig, og at Årsløn får sine egne standardværdier eller ingen.
- **Andre steder det kan gælde:** Enhver indstilling under «Standardværdier», hvis label går igen på
  en flade, den ikke virker på.

**Tilbagemelding**
Dette er en utilsigtet fejl. Når brugeren har sat standardværdier i indstillinger, skal de slå igennem på nye sager og ved Slet alt alle steder i programmet, hvor de pågældende felter anvendes. Jeg tror kun, at det er i erstatningsopgørelse og årsløn, og det skal rettes, hvis det ikke gælder fuldt ud i årsløn.

### BB-107 – Samme fejltekst på begge periodeceller, og den siger «dato» om et ugefelt

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-07** og **M-02**
- **Prioritet:** Mellem
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Løn indtastes som **Uge**. Skriv «Uge fra» `10/2025` og «Uge til» `05/2025`.
  2. Samme prøve i **Dato**-tilstand med `01-06-2025` og `01-01-2025`.
- **Det sker:** Begge celler bliver røde, og **begge** viser ordret den samme tooltip: **«Til-dato skal
  være efter fra-dato»**. I ugetilstand står ordet «dato» i en fejl om to ugenumre; felterne hedder
  «Uge fra» og «Uge til».
- **Det er uhensigtsmæssigt fordi:** Det er præcis M-07's navngivne kandidat: den fælles
  `DATE_ORDER_ERROR_MESSAGE` på begge parter i et fra/til-par. Teksten er skrevet fra **til**-feltets
  synsvinkel; står brugeren i «Uge fra», beder den ham rette noget, han ikke kan rette dér. Brugerens
  regel af 2026-08-16 er, at hver tekst skal afspejle den udvej, feltet selv har. EO's dato-par fik den
  rettelse med BF-028 («begge felter markeres nu rødt med den modgående dato i hver tooltip»); Årsløns
  tabel står med den gamle form.
- **Bedre ville være:** Hver celle får sin egen tekst med modpartens værdi:
  «Uge fra kan tidligst være 05/2025 (Uge til)» / «Uge til kan tidligst være 10/2025 (Uge fra)» –
  og i datotilstand tilsvarende med dd-mm-åååå. Ordet «dato» må ikke stå i en ugefejl.
- **Andre steder det kan gælde:** `DATE_ORDER_ERROR_MESSAGE` og
  `aarsloen.tableData.uge.<role>.order`. Alle periodetabeller med fra/til-kolonner.

**Tilbagemelding**
Jeg anerkender fundet og rettelsen. Overvej meget gerne om det kan og bør løses gennem en central, velstruktureret løsning, der er arkitektonisk sund og passer ind i programmets generelle arkitektur.

### BB-108 – Skærmen og dokumentet skriver samme procent og samme formel forskelligt

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-13**
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Feriegodtgørelse `12,5`, SH/SO `2,5`. Én lønrække, Måned `1`, År `2025`, Løn `30000`. Omregning
     til, «Fuld løn under ferie» til.
  2. Hent årslønsdokumentet.
- **Det sker:** To uenigheder om samme tal:
  - **Procenten:** skærmen viser `12,50 %` og `2,50 %` (feltets værdi plus enheds-adornment),
    dokumentet `12,5 %` og `2,5 %`.
  - **Formlen:** skærmen skriver «Beregnet årsløn (33.750,00 **/ 1** × 12)», dokumentet «Beregnet
    årsløn (33.750,00 × 12)». Dokumentet har en særregel for én enhed; skærmen har ikke.
- **Det er uhensigtsmæssigt fordi:** Dokumentet er det, modparten regner efter. To former for samme
  sats får den, der sammenholder skærm og bilag, til at lede efter en forskel, der ikke findes – og
  skærmens «/ 1» er en division uden indhold, som gør formlen sværere at læse end den behøver.
- **Bedre ville være:** Ét kald til den kanoniske procentformattering begge steder, og dokumentets
  særregel for «én enhed» flyttet op i den delte formeltekst, så skærmen også skriver «(33.750,00 ×
  12)».
- **Andre steder det kan gælde:** Alle procenter, der vises både i felt og i dokument. Prøven fra
  BB-078: sammenlign precision-argumentet i de to kald.

**Tilbagemelding**
Jeg er ikke sikker på, om jeg er enig. På siden er der tale om en indtastning, hvor det har visuel værdi at vise for brugeren, at værdierne kan indtastes med op til to cifre, men ikke flere. På dokumenterne er der imidlertid tale om en ren visning af det indtastede, hvor det virker visuelt kluntet at præsentere resultatet med et tvungent antal decimaler, hvis et eller flere af disse er nul.

### BB-109 – En sats på 0 % står på skærmen og mangler i dokumentet

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-13**
- **Prioritet:** Lav
- **Beslutning:** Agent afgør (mønsteret er afgjort bindende 2026-08-18)
- **Sådan fremprovokeres det:**
  1. Skriv `0` i «Fritvalg» og `12,5` i «Feriegodtgørelse/-tillæg».
  2. Hent årslønsdokumentet.
- **Det sker:** Skærmen viser «Fritvalg: 0,00 %». Dokumentets Satser-afsnit indeholder kun
  «Feriegodtgørelse/-tillæg 12,5 %» – Fritvalg-linjen er væk. Årsagen er `isEmptyOrZero` i
  `aarsloenDocument.ts`, som behandler `0`, `0,00` og `0,00 %` som fravær.
- **Det er uhensigtsmæssigt fordi:** Det er ordret BB-030's fejl på en ny flade. En fritvalgssats på
  0 % er en oplysning – den siger, at der ikke er fritvalg – og det er ikke det samme som «ukendt».
  Brugerens afgørelse af 2026-08-18 er bindende: «Rækker, hvor værdien er indtastet, men er 0, vises
  begge steder.»
- **Bedre ville være:** At dokumentets prøve bliver «findes værdien?» (`!== undefined`) i stedet for
  «er den forskellig fra nul?». Bemærk at `isEmptyOrZero` samme sted også afgør, om en **tabelrække**
  kommer med i dokumentet – prøv begge veje i samme rettelse.
- **Andre steder det kan gælde:** `isEmptyOrZero` bruges kun i denne generator. Den navngivne kandidat
  fra BB-030 – `eo/reguleringDocument.ts`' `sats > 0` – står stadig åben og hører til flade 12.

**Tilbagemelding**
Jeg er ikke enig i dit fund. At indtaste 0 i en tillægssats er for brugeren det samme som at angive, at satsen ikke findes i det pågældende ansættelsesforhold. Brugere må forventes fra tid til at anden at indtaste 0 fordi de tror, at det er sådan man skal gøre, hvis det pågældende tillæg ikke findes i ansættelsesforholdet. Programmet skal da i den efterfølgende visning korrigere en sådan misforståelse ved at udelade værdier for tillægssatser, der er nul. Dette er ønskværdig og korrekt adfærd. Bemærk blot til info, at det forholder sig anderledes med beløb i tabeller - da vil brugeren ofte indtaste et nul for bevidst at tydeliggøre, at der i en given periode fx ikke har været nogen indtægt. Der er det vigtigt, at 0 bevares som en bevidst indtastning, der også gengives i dokumentet..

### BB-110 – Dokumentet skriver «0» for et felt, brugeren har ladet stå tomt

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-19**
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Omregning til, «Fuld løn under ferie» fra, **lad «Antal feriedage» stå tomt**.
  2. Hent årslønsdokumentet.
- **Det sker:** Dokumentet skriver «Antal feriedage (mandag-fredag) i de indtastede perioder **0**»,
  hvor skærmen viser et tomt felt. Samme form for «Antal SH-dage», hvor `null` (kunne ikke beregnes)
  skrives som `0` både på skærmen og i dokumentet.
- **Det er uhensigtsmæssigt fordi:** «0 feriedage» er en påstand, ikke et fravær – og det er en
  påstand, der ændrer resultatet: den fulde årsløn regnes med 0 fradragne feriedage i perioden, mens
  årssiden trækker 30 fra. Dokumentet dokumenterer altså et valg, brugeren aldrig traf, over for
  modparten. Skærmen siger ingenting om det samme forhold.
- **Bedre ville være:** At dokumentet skriver det samme som skærmen – ingenting eller «Ikke oplyst» –
  og at skærmen omvendt siger, at et tomt felt regnes som 0 (fx placeholder eller en linje i
  «Advarsler», når feltet er tomt og fradraget derfor er nul).
- **Andre steder det kan gælde:** Alle `String(x ?? 0)` i dokumentgeneratorer.
  `rg "\?\? 0\)" src/document/generators` – uverificeret.

**Tilbagemelding**
Jeg afviser fundet. Antal feriedage og SH-dage i perioden er en værdi, der skal fremgå af dokumentet. Brugeren vil forvente, at et tomt felt fortolkes som om der var indtastet 0, altså at de to indtastninger er det samme - men i dokumentet, der sendes videre til andre kilder, skal det fremgå, at antallet var nu.

### BB-111 – To kolonner hedder noget andet i dokumentet end på skærmen

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-13**
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Hent årslønsdokumentet med mindst én lønrække.
- **Det sker:** Tre kolonnenavne er ikke ens:

  | Skærm | Dokument |
  |---|---|
  | Ikke-pensionsgivende løn | Ikke-pens. giv. løn |
  | ATP og anden løn u. tillæg | ATP mv. u. tillæg |
  | Arb.g. Pension | Arb.g.Pension (uden mellemrum) |

- **Det er uhensigtsmæssigt fordi:** Kolonnenavnene har ét sandt sted
  (`STANDARD_LOEN_COLUMN_LABELS`), og modulets egen kommentar begrunder det med, at «samme kolonne
  ellers kunne hedde to ting afhængigt af hvilken side, brugeren stod på». Dokumentgeneratoren har sine
  egne forkortelser skrevet ind ved siden af og gør præcis det, reglen skulle forhindre – blot mellem
  skærm og papir i stedet for mellem to sider. En feltfejl på cellen navngiver den «Ikke-pensionsgivende
  løn»; bilaget kalder den noget andet.
- **Bedre ville være:** At forkortelserne bliver en erklæret **dokument-form** af det samme ene navn –
  på samme måde som `HEADER_LINE_BREAKS` er en erklæret overskrifts-form – med et værn, der beviser,
  at forkortelsen er afledt af navnet. Eller at dokumentet bruger de fulde navne, hvis pladsen tillader
  det.
- **Andre steder det kan gælde:** Samme generator bruges ikke af EO, som har sin egen. Prøven er
  generel: sammenlign hver kolonneoverskrift i en generator med descriptorens label.

**Tilbagemelding**
Teksten er alene forkortet for at kunne holde den inden for den plads, der er til den pågældende tekst. Hvordan det rent teknisk sættes op 'bag kulisen' er underordnet for mig, så hvis dit forslag er en mere hensigtsmæssig løsning, må du gerne implementere. Så længe det viste resultat for brugeren og i dokumentet er uændret.

### BB-112 – Samme antal står to gange på siden med hver sin ordlyd, og linjen kan blive en tautologi

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Én lønrække, omregning til.
  2. Læs Beregningsprincipper og Beregning umiddelbart efter hinanden.
- **Det sker:** Det samme tal står to gange med to formuleringer:
  «Antal måneder i **den indtastede periode**: 1 måned» (Beregningsprincipper) og «Antal måneder i
  **indtastede perioder**: 1 måned» (Beregning) – den anden mangler dertil «de», som resten af siden
  bruger («Antal feriedage … i **de** indtastede perioder», «Antal SH-dage i **de** indtastede
  perioder»). Dokumentet gentager begge former, én linje fra hinanden.
  Med «Fuld løn under ferie» fra og et tomt feriedage-felt bliver Beregning-linjen dertil ordret:
  «Hverdage i beregningsperioden (**23 hverdage**): **23 hverdage**» – samme tal på begge sider af
  kolonet, fordi parentesen er tænkt som et fradragsregnestykke og der intet er at trække fra.
- **Det er uhensigtsmæssigt fordi:** Fladen er bygget på, at brugeren skal kunne efterprøve tallet ved
  at læse mellemregningerne. To navne for samme størrelse og en linje, der siger `23 = 23`, får ham til
  at lede efter en forskel. Beregningsprincipper-linjen er desuden ikke længere et referat af det
  indtastede: efter fradrag af feriedage skifter den til nettotallet (målt: «Antal hverdage i den
  indtastede periode: 21 hverdage» ved 23 hverdage og 2 feriedage) under en overskrift, der lover
  det indtastede.
- **Bedre ville være:** Én ordlyd, hentet fra `aarsloenPeriodDisplay.ts` begge steder (og i
  dokumentet), og at parentesen udelades, når der ikke er noget at trække fra.
- **Andre steder det kan gælde:** Alle mellemregningslinjer med et fradrag i parentes –
  Renteberegnings og forsørgertabs beregningsafsnit. Uverificeret.

**Tilbagemelding**
Jeg accepterer din rettelse.

### BB-113 – Advarslerne kalder «Feriegodtgørelse/-tillæg» for to andre ting

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md` **M-02**
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Feriegodtgørelse `12,5`, omregning til, «Fuld løn under ferie» til.
  2. Slå «Fuld løn under ferie» fra og «Ret til 6. ferieuge» fra, og sæt satsen til `16`.
- **Det sker:** Feltet hedder **«Feriegodtgørelse/-tillæg»**. Advarslerne kalder det
  **«feriepengesats»** («En feriepengesats på 12,5 % gør det højst usandsynligt …») og
  **«feriegodtgørelsessats»** («En feriegodtgørelsessats på 16 % skaber en klar formodning …»).
  Tre navne for ét felt på én skærm.
- **Det er uhensigtsmæssigt fordi:** Advarslen skal føre brugeren til det felt, den handler om. Ingen
  af de to ord står på skærmen. Programmet har en mekanisme til, at et felt ejer sit eget navn; begge
  tekster omgår den med navnet skrevet ind i prosaen.
- **Bedre ville være:** At begge tekster bruger feltets eget navn: «En sats for
  Feriegodtgørelse/-tillæg på 12,5 % …» – eller kortere, hvis brugeren foretrækker det, men **ét** ord
  begge steder og det samme som labelen.
- **Andre steder det kan gælde:** «SH/SO-sats» er korrekt gennemført i alle fire tekster. Prøven hører
  på hver flade med prosa-advarsler.

**Tilbagemelding**
Jeg vil gerne have en ensartet sprogbrug. Den skal dog være baseret på følgende kanoniske principper, som skal fremgå af kontrakter og eventuel anden relevant dokumentation:

- En lønmodtagers løn, kan enten tillægges a) feriegodtgørelse eller b) ferietillæg. Aldrig begge.

- Hvis lønmodtageren får løn under ferie, vil vedkommende få ferietillæg. Hvis ikke, vil lønmodtageren få feriegodtgørelse. Til tider vil reglerne dog være sådan, at selvom lønmodtageren modtog ferietillæg, skal det beregningsteknisk opgøres som feriegodtgørelse. I så fald omregnes 1 % ferietillæg til 12,5 % feriegodtgørelse, hvis brugeren ikke havde ret til 6. ferieuge, og til 15 %, hvis brugeren havde ret til 6. ferieuge. Hvis brugeren havde forhøjet ferietillæg, altså ferietillæg med mere end 1 %, lægges forhøjelsen oven i. Kommunalt ansatte vil typisk have forhøjet ferietillæg med 1,95 %, svarende til at ferietillæg omregnes til 16,95 % feriegodtgørelse. Andre satser kan også være forekommende.

- Begrebet 'feriepenge' er en sproglig fællesnævner, der sprogligt anvendes, når der er tale om selve den formelle ret til de to ydelser. Når der er tale om selve procentsatsen for en ydelse, anvendes det korrekte navn for den specifikke ydelse, men når lønmodtagerens generelle ret til ferieydelse omtales, og det potentielt kan være enten den ene eller anden, anvendes 'feriepenge' ofte som en sikker fællesbetegnelse.

### BB-114 – Et ugenummer, der ikke findes i det valgte år, får den generiske «ugyldig værdi»-tekst

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Løn indtastes som Uge. Skriv `53/2025` i «Uge fra». (2025 har 52 ISO-uger.)
  2. Prøv derefter `23/2004`.
- **Det sker:** `53/2025` giver «Der er udfyldt en ugyldig værdi i feltet 'Uge fra'». `23/2004` giver
  derimod den konkrete «Årstallet skal være mellem 2005 og 2026». Samme felt svarer altså præcist om
  året og upræcist om ugen.
- **Det er uhensigtsmæssigt fordi:** Formen `uu/åååå` **er** overholdt, så teksten «ugyldig værdi»
  fortæller brugeren, at han har skrevet noget forkert, uden at sige hvad. At 2025 har 52 uger og 2026
  har 53, er ikke noget, man har i hovedet. Brugeren kan ikke gætte grænsen og kan ikke se den nogen
  steder.
- **Bedre ville være:** En konkret besked på samme form som årets: «Uge skal være mellem 1 og 52 i
  2025.» Grænsen kendes allerede – `isoWeeksInYear` beregner den.
- **Andre steder det kan gælde:** Alle ugefelter (`createWeekFieldCodec`), fx MinProcesrentes og EO's.

**Tilbagemelding**

Jeg er enig.

### BB-115 – Lønperioder i fremtiden accepteres uden signal

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Løn indtastes som Dato. Skriv `01-12-2026` og `31-12-2026` (dags dato er 25-08-2026).
  2. Samme i Måned-tilstand: `12` / `2026`.
- **Det sker:** Begge accepteres. Feltets tooltip siger «Dato skal være mellem 01-01-2005 og
  31-12-2026» – den øvre grænse er 31. december i **indeværende** år, altså godt fire måneder ude i
  fremtiden. En løn, der endnu ikke er udbetalt, kan indgå i grundlaget.
- **Det er uhensigtsmæssigt fordi:** En lønperiode beskriver noget, der er sket. En dato efter dags
  dato er derfor næsten sikkert en tastefejl (`2026` for `2025` er den nærliggende), og programmet
  kender begge tal. Grænsen er ensartet i alle tre lønperiodetilstande, så det er et bevidst valg –
  men det er valgt efter kalenderåret, ikke efter, hvad der kan være udbetalt.
- **Bedre ville være:** At den øvre grænse er dags dato i alle tre tilstande (i månedstilstand: den
  igangværende måned). Vil brugeren bevare kalenderåret som grænse – fx fordi en fremskrevet årsløn
  kan være relevant – bør en fremtidig periode i det mindste give en ikke-blokerende gul advarsel.
- **Andre steder det kan gælde:** `dateRanges_aarsloen` bruges kun her, men `dateCurrentYearEnd()`
  bruges bredere. Uverificeret.

**Tilbagemelding**
Jeg afviser delvist fundet. Det er ikke en egentlig fejl. Lønsedler udstedes ofte månedsvist forud, og i visse særlige tilfælde kan det være relevant at angive et lønbeløb som udtryk for den samlede løn i året, fx. for pædagogisk at vise, at der er tale om den samlede lønydelse i et år, selvom året ikke er udløbet, for derved at tydeliggøre, at der ikke kommer flere ydelser i året.

Jeg har dog forståelse for dit synspunkt om at sætte en gul ring på feltet med en tooltip om, at den indtastede dato er efter dags dato. Gør det.

### BB-116 – «Løn» og «Løn (2)» siger ikke, hvad forskellen er

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer bruger
- **Sådan fremprovokeres det:**
  1. Se løntabellens to første beløbskolonner.
- **Det sker:** De hedder «Løn» og «Løn (2)». Kun den anden har et informationsikon, og det siger
  «Opdelingen af løn er rent visuel - værdierne lægges sammen i beregningen».
- **Det er uhensigtsmæssigt fordi:** To fagfolk vil ikke udfylde de to kolonner ens, og der er ikke
  noget at gå efter. Tooltippen siger, at det ikke betyder noget – men den sidder på den *anden*
  kolonne, så brugeren skal først have undret sig for at finde svaret, og en kolonne, hvis navn er
  «(2)», inviterer til at gætte på en betydning, der ikke findes. Bemærk desuden, at BB-100 viser, at
  opdelingen **ikke** er helt uden betydning i nabokolonnen: «Ikke-pensionsgivende løn» behandles
  anderledes end de to.
  Tooltippens tankestreg er dertil skrevet som bindestreg (` - `) og ikke som en-dash (` – `), jf.
  beslutningen af 2026-08-19.
- **Bedre ville være:** At de to kolonner enten får navne, der siger hvad de er tænkt til (fx «Grundløn»
  og «Løntillæg»), eller at informationsikonet flyttes til den **første** af de to, så forklaringen
  findes, før brugeren begynder at gætte.
- **Andre steder det kan gælde:** Samme to kolonner i EO's lønindkomst-tabel – en rettelse skal tages
  begge steder på én gang (kolonnenavnene har ét sandt sted).

**Tilbagemelding**

Jeg afviser en ændring af label på felterne. Det gør det kun endnu mere forvirrende, at de har forskellige navne. Når de har samme navn, giver det et billede af, at der er tale om samme ydelse. Og det er evident for brugeren, hvad 'Løn' udgør - så det er 'Løn 2' som brugeren vil blive forvirret over, så derfor det mest relevante sted at placere info-ikon og tooltip.

---

## Overvejet uden fund

**Beregningen er kontrolregnet og er i orden.** Alle tre metoder er efterregnet i browseren:
- **Metode C (måned):** 33.750,00 / 1 × 12 = 405.000,00 ✔; (uge) 10.000,00 / 11 × 52,14 = 47.400,00 ✔
- **Metode B (hverdage):** 33.750,00 / 21 × 231 = 371.250,00 ✔, med 261 - 30 ferie- og feriefridage ✔
- **Metode A (arbejdsdage):** 34.500,00 / 22 × 253 = 396.750,00 ✔, med 261 - 8 SH-dage ✔
- Rækkens tillæg: (30.000 + 1.000) × 15 % = 4.650,00 ✔ og 30.000 × 1,15 × 12 % = 4.140,00 ✔
- SH-dage for januar 2025 = 1 (nytårsdag, en onsdag) ✔
Ingen af de 21 fund handler om et forkert regnestykke; BB-096 og BB-097 handler om et forkert
**grundlag**, ikke om en forkert formel.

- **M-22 (usynlig dokumentafhængighed) er efterprøvet og BB-080's rettelse virker.** En fødselsdato på
  `99-99-9999` i Stamdata gør årslønsdokumentets knap grå med **«Ret fejlen i Stamdata»** – fladen
  navngives, selv om Årsløn ikke viser en eneste stamdataoplysning. SH-dage-bilagets knap forbliver
  aktiv, og det er korrekt: dets brevhoved er slået fra som standard, så det har ingen
  stamdataafhængighed. To knapper i to tilstande ved siden af hinanden er forvirrende af en anden
  grund – se BB-104.
- **Datofelternes grænser er konkrete:** «Dato skal være mellem 01-01-2005 og 31-12-2026». Ugefeltets
  årsgrænse ligeså. Kun ugenummeret mangler sin (BB-114).
- **Ugyldige kalenderdatoer** (`31-02-2025`, `29-02-2025`, `01-13-2025`) afvises som format-/schemafejl
  med den generiske tekst – dokumenteret adfærd efter BF-013.
- **Procentfelternes tegnfilter** følger paste = tastning-reglen: `12.5` → `125,00` (rødt), `1e3` →
  `13,00`, `12,,5` → `12,50`, tredje decimal afvises. Alt sammen truffet adfærd (BF-040/BF-046, M-14).
  Én asymmetri er noteret uden fund: `,5` bevares som afvist råtekst og bliver rød, mens `.5` bliver
  til `5,00` uden signal – begge er forsøg på at skrive «en halv procent», men kun det ene svarer.
  Det følger af den bindende paste=tastning-regel og rejses ikke som fund.
- **Skift frem og tilbage bevarer alt.** Måned → Dato → Måned og Procent → Beløb → Procent genskaber
  hver eneste værdi uændret, inklusive de afledte kolonner. Ingen datatab målt nogen steder på fladen.
- **Røde celler isoleres pr. række:** en ugyldig celle i række 2 lader række 1 stå og regne.
- **Mange rækker:** tolv månedsrækker (36 celler) blev bygget uden træghed, uden layoutbrud og uden
  konsolstøj; tabellen holder sig inden for indholdsboksen ved 1536×864 (M-09 gav intet).
- **Rul-til-toppen-knappen (M-10)** dækker intet betjenbart på fladen: nederste højre hjørne rummer
  downloadikonet ~80 px højere oppe.
- **Konsollen var tavs gennem hele kørslen:** 197 beskeder, 0 fejl, 0 advarsler.
- **Slet alt** rydder fladen fuldstændigt og lander på Stamdata; en ny sag starter med to synlige,
  tomme rækker og «Sammentælling af løn fra tabellen: 0,00 kr.» – en sum af ingenting, som er
  konsistent med resten af programmet og ikke rejses.
- **Tomme beløbsceller** viser pladsholderen `0,00` plus enheden `kr.`, altså «0,00 kr.» i nedtonet
  farve. Det er visuelt tæt på en indtastet nul, men farveforskellen er målbar, og pladsholderbrugen er
  en truffet beslutning (BB-074). Rejses ikke – men det er baggrunden for, at BB-098 er svær at få øje
  på.
- **Lukkede spor respekteret:** der er ikke foreslået tastaturadgang til sidemenu/faner (globalshell
  spor 1), ingen gemt/ugemt-markering (spor 2), ingen markering af «sagens egen række» i en satsvisning
  (varigemen spor 1), ingen dækningsgrænse-tekst på skærmen (M-15, lukket), og ingen forklarende linje
  om hvornår en indstilling virker (indstillinger, lukket spor) – BB-106 handler om, at indstillingen
  ikke *virker*, ikke om at den ikke er forklaret.

## Dækningshuller

- **Kun Chrome, lyst tema, 1536×864.** Ingen kontrastkørsel i Edge/Firefox/WebKit og ingen smallere
  viewport.
- **PDF-kanalen er ikke læst.** Begge dokumenter er hentet som `.docx` (formatet skiftet i
  Indstillinger) og læst linje for linje. De to kanaler deler generator, men PDF'ens tabellayout og
  linjeskift i overskrifterne er ikke set.
- **`Gem`/`Hent` af sagen er ikke afprøvet** – filvælgeren kan ikke betjenes headless (samme hul som
  BB-049). Rejected råtekst i en lønrække er derfor ikke ført gennem et gem.
- **Undo/redo er ikke afprøvet på fladen.** Særligt interessant ville være Ctrl+Z efter et
  lønperiodeskift (BB-105) og efter en afvist omregnings-aktivering (BB-102).
- **Sortering af tabellens ni kolonner er ikke afprøvet.** Sortering som sådan er afgjort (BB-041), men
  sorteringens samspil med `saveOrderPath` og med en igangværende redigering er ikke set.
- **Beløb-tilstandens dokument er ikke hentet** – kun skærmen er målt. Generatoren udelader
  Satser-afsnittet i den tilstand (kodelæst).
- **Indsat regnearkskolonne i en lønbeløbscelle** er ikke gentaget her; mekanismen er målt på
  Renteberegning (BB-088) og er den samme.
- **BB-097's grænse er målt ved 99 feriedage i én måned.** Det er ikke efterprøvet, om der findes et
  lovligt tilfælde (mange måneder), hvor 99 feriedage er rigtigt – kun at grænsen ikke ser på perioden.

## Åbne spørgsmål

1. **Skal to lønrækker med samme periode kunne stå?** (BB-096) Der findes et lovligt tilfælde – to
   ansættelsesforhold i samme måned – hvor beløbene rigtigt lægges sammen. Men så er det *dagene*, der
   tælles forkert, ikke pengene: perioden bidrager kun én måneds arbejdsdage til nævneren. Skal
   overlappende perioder (a) blokere, (b) give en advarsel, eller (c) tælles med i nævneren én gang pr.
   række? Valget ændrer tal.
2. **Skal en lønrække med 0,00 kr. kunne indgå?** (BB-098) Enten er 0 kr. en lovlig periode uden løn
   (dokumentet dannes), eller også er 0 kr. en fejl (rødt felt). I dag er den ingen af delene.
3. **Skal en lønperiode kunne ligge i fremtiden?** (BB-115) Grænsen er i dag 31. december i
   indeværende år i alle tre tilstande.
4. **Skal «Fuld løn under ferie» og «Løn på helligdage» fra Indstillinger gælde Årsløn?** (BB-106)
   I dag gør kun «Løn indtastes som» det, selv om alle tre felter hedder det samme begge steder.
