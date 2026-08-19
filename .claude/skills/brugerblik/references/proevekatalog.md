# Prøvekatalog

De to blikke, Brugerblik gennemgår en flade med. Katalogene er huskelister, ikke afkrydsningsskemaer:
et spørgsmål, der åbenlyst ikke kan finde noget på den konkrete flade, springes over uden omtale.

---

# A. Fornuftsblikket

Præmis: **koden virker.** Spørgsmålet er, om det, den gør, er klogt.

Stil spørgsmålene som en person, der skal bruge programmet til at afgøre en rigtig sag, ikke som en
person, der har bygget det. Den, der spørger, kender arbejdsskadeområdet, men kender ikke Mineos
indre logik, husker ikke hvad han lavede i sidste uge, og har ikke læst nogen vejledning.

## A1 – Forstår brugeren, hvad der forventes af ham?

- Siger labelen entydigt, hvad feltet skal indeholde? Kan den forveksles med et nabofelt eller med
  et lignende felt på en anden side?
- Ville to fagfolk udfylde feltet ens? Hvis ikke, mangler der en oplysning, ikke en validering.
- Er formatet gættet rigtigt af brugeren første gang – eller skal han opdage det ved at fejle?
- Er der felter, hvor brugeren skal kende programmets interne opdeling for at vælge rigtigt?
- Er enheden (kr., %, dage, år) synlig **før** indtastningen, ikke først bagefter?

## A2 – Ved brugeren, hvor han er, og hvad der mangler?

- Kan brugeren se, hvad der er udfyldt, og hvad der mangler, uden at scrolle hele siden igennem?
- Er der en tilstand, hvor brugeren med rimelighed tror, han er færdig, men ikke er det?
- Er der en tilstand, hvor han tror, han er blokeret, men faktisk ikke er?
- Er der tomme felter, der ikke betyder «mangler», men «ikke relevant»? Kan de to skelnes?
- Hvis noget er inaktivt (knap, felt, fane): fremgår **hvorfor**, og hvad brugeren skal gøre?

## A3 – Rækkefølge og flow

- Er sidens rækkefølge den rækkefølge, brugeren rent faktisk arbejder i, med sagens papirer foran
  sig? Eller er den programmets interne rækkefølge?
- Kræver et felt en oplysning, der først kan tastes længere nede eller på en anden side? Hvad
  oplever brugeren så, hvis han tager dem i den forkerte rækkefølge?
- Er der spring frem og tilbage mellem sider, som en anden gruppering kunne have sparet?
- Skal brugeren skrive den samme oplysning to gange?
- Er det næste skridt tydeligt, når fladen er udfyldt?

## A4 – Programmets tavshed

Det hyppigste fornuftsfund. Gennemgå hvert sted, hvor programmet **ved noget, brugeren ikke får at
vide**:

- Værdier, der ryddes, neutraliseres, ignoreres eller erstattes, uden at brugeren orienteres.
- Felter eller sektioner, der skjules eller vises som følge af et valg – forstår brugeren, hvorfor
  noget forsvandt, og hvad der skete med det, han havde skrevet i det?
- Beregninger, der ikke opdaterer sig, fordi en forudsætning mangler. Ser brugeren det?
- Input, der accepteres, men ikke bruges til noget.
- Advarsler, der kun findes i et samlet fejlpanel, mens brugeren står ved det pågældende felt.
- Handlinger, der lykkes uden bekræftelse – og handlinger, der ikke lykkes uden besked.

## A5 – Når noget går galt

- Siger fejlbeskeden, **hvad** der er galt, **hvorfor**, og **hvad der forventes** – eller kun at
  noget er forkert?
- Nævner beskeden feltets navn med de ord, brugeren ser på skærmen?
- Ved en grænse: nævnes den konkrete grænse, og hvor den kommer fra?
- Ved en umulig kombination (min > max): forklares det som en kombination, og navngives begge
  ansvarlige felter?
- Kan brugeren komme videre efter fejlen uden at starte forfra?
- Er alvorsgraden rigtig? Blokeres noget, der burde være en advarsel – eller omvendt?
- Er der en fejl, brugeren ikke selv kan rette?
- **Får to felter, der hører sammen, den samme besked for det samme problem?** Sammenlign parrede
  felter direkte: fra og til i samme række, min og maks, styrende og afhængigt felt. To forskellige
  formuleringer for én og samme brudte regel får brugeren til at lede efter to forskellige fejl.

## A6 – Fortrydelse og tryghed

- Er en destruktiv handling genkendelig som destruktiv, **inden** den udføres?
- Kan alt fortrydes? Hvis ikke, ved brugeren det på forhånd?
- Sletter en handling mere, end navnet lover?
- Hvad sker der, hvis brugeren rammer forkert (klikker ved siden af, taster Escape, lukker en
  dialog)? Er «ingenting» det, der sker?
- Hvad ser en bruger, der kommer tilbage til fladen dagen efter? Kan han rekonstruere, hvorfor han
  skrev det, han skrev?

## A7 – Ensartethed

- Løses samme opgave ens på denne flade og på de øvrige? Samme ord, samme placering, samme
  tastaturadfærd, samme feedback?
- Hedder samme begreb det samme overalt – også i tooltips, fejlbeskeder, dokumenter og PDF?
- Følger tal og datoer danske konventioner overalt på fladen, også i sammensatte tekster?
- Findes der to veje til samme resultat, som opfører sig forskelligt?

## A8 – Fladen som helhed

- Hvis en ny bruger blev sat foran denne flade uden forklaring: hvad ville han gøre først, og
  hvordan går det ham?
- Hvad er det mest sandsynlige, brugeren gør forkert her? Hvad koster det ham?
- Hvad er det værste, der kan ske på denne flade, uden at brugeren opdager det?
- Er der noget her, der kun giver mening, fordi man kender programmets historie?

---

# B. Edge case-blikket

Præmis fra SKILL.md: **brugeren indtaster et meget stort antal forkerte, ufuldstændige og
uforudsete oplysninger.** Opgaven er ikke at bevise, at valideringen findes, men at se, hvad
brugeren *oplever*, når den slår til – og at finde de kombinationer, ingen har tænkt på.

For hvert punkt: hvad sker der, ser brugeren det, forstår han det, kan han komme videre?

## B0 – Grænse-eftersynet

Gøres **før** de øvrige batterier, felt for felt. Erfaringen er, at den hyppigste årsag til en dårlig
oplevelse ikke er en forkert grænse, men en **manglende eller tilfældig** grænse: feltet tager imod
noget, det aldrig skulle kunne komme til at indeholde, og fejlen viser sig først langt nede i en
beregning.

For hvert felt, tre spørgsmål:

1. **Har feltet overhovedet en erklæret grænse?** Tegn- og cifferloft, tal-min/maks, dato-min/maks.
   «Ingen erklæret grænse» betyder i praksis «ingen grænse overhovedet».
2. **Passer grænsen til feltet?** Et årstal kan aldrig have mere end fire cifre; et antal dage kan
   ikke være negativt; en procentsats af en helhed kan ikke være 400. Et loft, der er sat så vidt,
   at det aldrig kan rammes, er reelt intet loft.
3. **Kunne en skarpere grænse udledes af konteksten?** Mange felter har en oplagt grænse, som følger
   af noget, brugeren allerede har indtastet – en anden dato i sagen, en periode, et valg, et beløb
   feltet er en andel af. Er den ikke sat, kan brugeren indtaste noget, programmet allerede ved er
   forkert.

Vær opmærksom på den bevidst vide grænse: den er det rigtige valg, når der ikke findes en regel, men
den skal så efterfølges af en advarsel i det bånd, hvor værdien er tilladt og næsten sikkert forkert
(se B5).

## B1 – Det enkelte felt

- tomt · kun mellemrum · kun et minus/komma/punktum · et enkelt tegn
- forkert format · næsten rigtigt format · rigtigt format med støj (mellemrum, tusindseparator,
  enhed skrevet med, «ca.», «kr.», «%»)
- indsat tekst fra Word/Excel/PDF: hårde mellemrum, linjeskift, tabulator, tankestreg i stedet for
  minus, decimalpunktum i stedet for komma
- for langt · meget for langt · Unicode, emoji, andre alfabeter
- nul · negativ · decimal hvor heltal forventes · ekstremt stort tal · et tal med flere decimaler,
  end feltet viser
- præcis på grænsen · lige under · lige over
- værdien slettet igen efter at have været gyldig
- feltet forladt midt i en indtastning (klik væk, faneskift, navigation, F5, luk fanen)
- Escape efter ændring · Escape uden ændring · Enter i et tomt felt · Delete på et fokuseret felt

## B2 – Datoer

Datoer er den hyppigste kilde til edge cases i Mineo:

- ugyldig kalenderdato (31-02) · skudårsdag i et ikke-skudår · 00 i dag eller måned
- tocifret år (fortolkes det som brugeren tror?) · årstal langt ude i fortiden eller fremtiden
- dato præcis på en skæringsdato i lovgivningen · dagen før · dagen efter
- slutdato før startdato · startdato = slutdato · interval på nul dage
- dato før en anden dato, den logisk skal ligge efter (fødsel/skade/anmeldelse/opgørelse)
- en dato, der gør et andet felts grænser umulige (min > max)
- dato ændret, **efter** at afhængige felter er udfyldt

## B3 – Perioder og tabeller

- ingen rækker · én tom række · en delvist udfyldt række · rækker udfyldt nedefra og op
- overlappende perioder · huller mellem perioder · perioder i omvendt rækkefølge
- dublerede rækker · rækker med samme nøgle, forskellige tal
- meget mange rækker
- sletning af en række, andre rækker eller beregninger afhænger af
- en periode, der krydser et årsskifte, en satsændring eller en reguleringsdato
- række tilføjet, mens en anden række er under redigering

## B4 – Kombinationer og rækkefølge

Det er her, de uforudsete oplevelser bor. Systematisk:

- afhængigt felt udfyldt **før** sin forudsætning
- forudsætningen ændret **efter** at det afhængige felt er udfyldt – hvad sker der med det, og får
  brugeren det at vide?
- forudsætningen ryddet igen
- valg A → valg B → tilbage til A: er alt, som det var?
- to felter, der hver for sig er gyldige, men tilsammen beskriver noget umuligt
- et valg, der skjuler et felt, brugeren allerede havde udfyldt
- en oplysning, der findes både her og på en anden side – hvad hvis de er uenige?
- en flade udfyldt, mens en anden flade står med rejected input

## B5 – Lovligt, men usandsynligt

Værdier, der ikke kan afvises, men som næsten sikkert er en tastefejl. For hver: bør programmet sige
noget, og hvad koster det brugeren, hvis det tier?

- et beløb, der er en faktor 10 eller 1000 forkert
- en procent, der er indtastet som decimal eller omvendt
- en dato, der ligger årtier fra sagens øvrige datoer
- en alder, der giver et urealistisk forløb
- en værdi lige under en grænse, hvor grænsen sandsynligvis var det, brugeren mente

## B6 – Tilstandsskift under indtastning

- navigation væk fra fladen med en åben indtastning
- faneskift · sidemenu-klik · browserens tilbage-knap · F5 · luk fanen
- undo/redo umiddelbart efter en indtastning, en rydning, et valg, en rækkesletning
- gem/hent midt i et forløb
- «Slet alt» og derefter tilbage til fladen
- to hurtige handlinger efter hinanden (dobbeltklik, hurtig tabulering, Enter to gange)

## B6a – Tomhed: hvad regner programmet for «udfyldt»?

Et af de mest oversete steder, fordi koden næsten altid gør præcis det, den er skrevet til – og
alligevel noget andet, end brugeren forventer. Programmet har et internt begreb om, hvornår en række
eller en flade er tom, og det begreb styrer synlige ting: om en række overlever, om en knap er aktiv,
om noget tæller med i en beregning, om der advares om manglende oplysninger.

Find det begreb, og hold det op mod brugerens:

- **Tomme rækker, der bliver stående.** Opret en række, udfyld den, ryd den igen. Forsvinder den?
  Bliver den gemt? Tæller den med i en optælling eller i en beregning? En efterladt tom række, der
  ikke gør noget, er stadig noget, brugeren skal forholde sig til.
- **En række, der kun indeholder et formateringsvalg.** Ændr *kun* det valg i en ellers tom række,
  der ikke bidrager med data – en enhed, en tidsenhed, et visningsvalg. Tæller rækken nu som
  udfyldt? Den bør ikke: brugeren har ikke indtastet en oplysning, han har valgt en form.
- **En række, der kun indeholder ugyldige værdier.** Skriv noget forkert i en ellers tom række.
  Regner programmet nu rækken for tom? Hvis ja: hvad går i stå af det? Typisk en «ryd alt»-knap, en
  advarsel om manglende data eller en optælling. Brugeren, der kan **se** noget stå i tabellen,
  forventer, at programmet også kan se det – uanset om det er gyldigt.
- **Den omvendte vej:** en knap eller advarsel, der reagerer på noget, brugeren ikke opfatter som
  data – en default-værdi, et automatisk oprettet element, et valg han aldrig traf.
- **Grænsetilfældet «næsten tom».** En række med ét udfyldt felt ud af ti: udfyldt eller tom? Er
  svaret det samme, uanset hvilket af de ti felter det er?

Prøven er den samme hver gang: **stemmer programmets svar på «er der noget her?» overens med det,
brugeren kan se på skærmen?**

## B7 – Nedstrøms

For hvert felt på fladen: hvem bruger værdien?

- Bliver et beregnet tal påvirket, uden at brugeren ser sammenhængen?
- Bliver et dokument blokeret af noget på denne flade? Forstår brugeren, hvorfor og hvor han skal
  hen?
- Bliver værdien vist et andet sted i en anden form eller med et andet navn?
- Overlever værdien gem/hent uændret – og ser brugeren det samme før og efter?

---

# C. Fra observation til fund

En observation bliver først et fund, når disse fire kan skrives ned:

1. **Sådan fremprovokeres det** – konkrete trin med konkrete værdier.
2. **Det sker** – hvad brugeren ser, hører eller ikke ser.
3. **Det er uhensigtsmæssigt fordi** – konsekvensen for brugeren, ikke for koden.
4. **Bedre ville være** – ét konkret forslag, som brugeren kan sige ja eller nej til.

Mangler punkt 4, er fundet ikke færdigt. Kan punkt 3 kun formuleres med interne begreber, er det
sandsynligvis ikke et brugerfund, men et kodefund – og hører så et andet sted hen.
