# Brugerblik – Satser

- Rute/placering: `/satser`
- Gennemgået: 2026-08-18 · commit `a8d2b13c`
- Afprøvet i: Chrome (headless), 1536×864 – plus kildegennemgang af PDF-/Word-generatoren og de
  fire årsfelter i hele programmet. Se dækningshuller for Gem/Hent.

## Fladen kort

Én ContentBox med ét indtastningsfelt (`Vis satser for år:`) og én downloadknap, efterfulgt af fire
rene visningssektioner: Erstatningsansvarsloven, Arbejdsskadesikringsloven, Diverse og Referencer.
Året er sidens eneste input og styrer **alt** det viste. Sidetitlen bærer året
(«Arbejdsskadesatser 2026»). Er året tomt eller uden for det dækkede interval, forsvinder alle fire
sektioner og erstattes af sætningen «Vælg et gyldigt år for at se satserne.»; downloaden blokeres
samtidig fra samme projektion.

Det dækkede interval er **2005–2026** (udledt af datadækningen, ikke skrevet nogen steder i
brugerfladen). Året gemmes i `.eo` som sagsdata, men driver **ingen** beregning nogen steder i
programmet: det er kun denne sides visning og denne sides eget PDF-/Word-dokument. EO's
svie/smerte-satsår er et helt andet felt (`svieSmerteSatserAar`).

## Fund

### BB-030 – Satsspecifikationen udelader en sats, skærmen viser

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Høj
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Gå til Satser og skriv `2024` i «Vis satser for år».
  2. Læs afsnittet Arbejdsskadesikringsloven på skærmen. Nederst står to reguleringsprocenter:
     «Reguleringsprocent for erhvervsevnetab (før 2024): 65,7 %» og
     «Reguleringsprocent for erhvervsevnetab (fra 2024): **0 %**».
  3. Klik «Download specifikation» og åbn dokumentet.
- **Det sker:** Dokumentet indeholder 21 rækker, skærmen 22. Den række, der mangler, er præcis
  «Reguleringsprocent for erhvervsevnetab (fra 2024): 0 %». Alle øvrige 21 rækker er identiske.
  Der gives ingen besked om, at noget blev udeladt. Det gælder både PDF og Word, fordi begge
  formater bruger samme generator.
- **Det er uhensigtsmæssigt fordi:** Brugeren downloader specifikationen netop for at have
  satsgrundlaget på papir i sagen. At en sats forsvinder mellem skærm og dokument uden et ord er
  det værste udfald på listen i §5: et forkert (her: ufuldstændigt) grundlag, brugeren ikke har
  nogen anledning til at betvivle – han har lige set rækken stå på skærmen. Og netop **0 %** er en
  oplysning, ikke et fravær: den siger, at der ikke er reguleret siden 2024-grundlaget. Læser
  modparten dokumentet, kan fraværet af rækken lige så godt betyde «satsen er ukendt» som
  «satsen er nul».
  Årsagen er, at skærmen skjuler en række på «ingen værdi» (tom streng), mens dokumentet skjuler
  den på «ikke større end nul». `0` formateres til «0 %» og passerer skærmens prøve, men falder på
  dokumentets. Der er i dag præcis ét nul i hele satsdatasættet – `2024` – så fundet rammer ét år,
  men det er et meget brugt år.
- **Bedre ville være:** Dokumentet skal bruge samme prøve som skærmen: en række vises, når der
  **findes** en sats, og skjules kun, når satsen mangler. Altså «findes værdien?» frem for «er
  værdien større end nul?». Så er skærm og dokument den samme oplysning, og en sats på 0 % står
  begge steder.
- **Andre steder det kan gælde:** `src/document/generators/eo/reguleringDocument.ts` bruger samme
  prøve (`sats > 0`) til at afgøre, om en **hel kolonne** vises i reguleringsbilaget – otte
  tillægssatser plus grundlønnen. En overenskomstsats, der lovligt er 0, ville dermed fjerne
  kolonnen fra dokumentet. Ikke efterprøvet; hører til Erstatningsopgørelse-fladen.
  Samme klasse, men ikke udløst i dag: fri proces-rækken i satsdokumentet kræver, at **alle tre**
  beløb (enlig, samlevende, barn) findes, mens skærmen filtrerer hver linje for sig. Får et
  fremtidigt år kun to af de tre, viser skærmen to linjer og dokumentet ingen.

**Tilbagemelding**
Jeg accepterer din præmis om, at siden og dokumentet bør vise det samme. Du må gerne ændre til, at rækker, hvor værdien er indtastet, men er 0, vises begge steder.

**Afgørelse og gennemførelse 2026-08-18 – accepteret, gennemført.**
Dokumentets prøve er ændret fra «er værdien større end nul?» til «findes værdien?»
(`isPositiveFiniteNumber` → `hasRateValue` i `satserDocument.ts`, alle 18 kaldssteder). `Number.isFinite`
er bevaret, så en beskadiget datapost (`NaN`/`Infinity`) fortsat ikke bliver en række, og en manglende sats
(`null` fra det fail-open `getSatserForYear`) udgår som før.

Målt i browser: 2024-dokumentet indeholder nu «Reguleringsprocent for erhvervsevnetab (fra 2024): 0 %», og
en diff mod det gamle dokument viser præcis de to tilføjede linjer og intet andet. 2026-dokumentet er
byte-identisk med før – rettelsen tilføjer kun den række, der reelt er nul. Skærm og dokument har nu
samme 22 rækker for 2024.

**Fri proces-rækken er rettet i samme omgang** (den latente del af fundet). Dokumentet krævede, at alle
tre beløb fandtes, ellers udgik hele rækken; skærmen filtrerer pr. linje. Dokumentet gør nu det samme.
Uenigheden var ikke udløst af de nuværende data, men var samme fejlklasse.

To regressionsværn i `satserWordContent.test.ts`: ét der kræver 0 %-rækken i det færdige Word-dokument, og
ét der kræver, at en sats uden værdi fortsat udgår – så rettelsen ikke kan skride den anden vej og gøre
`null` til «0 kr.». Det første værn er mutations-efterprøvet: det bliver rødt, hvis `> 0` sættes tilbage.
Værnet asserterer desuden, at 2024-satsen faktisk ER nul, så testen ikke stille bliver grøn, hvis
datagrundlaget ændrer sig.

### BB-031 – Samme indsatte tekst giver to forskellige årstal, alt efter om feltet var tomt

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-14--indsat-tekst-samles-af-cifre-uden-hensyn-til-formens-positioner`
- **Prioritet:** Høj
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Sæt året til `2015`, så feltet har en værdi. Marker værdien (Ctrl+A) og indsæt teksten
     `01-02-2026` (en almindelig dansk dato, fx kopieret fra sagens papirer).
  2. Ryd derefter feltet helt, klik på det, og indsæt **samme** tekst igen.
- **Det sker:**
  - Feltet havde en værdi → draften bliver `0102`, og den gemte værdi bliver **102**. Rød ring og
    «Årstallet skal være mellem 2005 og 2026».
  - Feltet var tomt → draften bliver `01`, og den gemte værdi bliver **2001**. Også rød, samme
    besked.

  To forskellige tal ud af den samme indsatte tekst. Ingen af dem er 2026, som stod i teksten.
  Samme mønster med andre virkelige tekster:

  | Indsat | Feltet var tomt | Feltet havde en værdi |
  |---|---|---|
  | `01-02-2026` | 2001 | 102 |
  | `2.026` | **2002** | 2026 |
  | `Skadedato 15-03-2019` | 2001 | 1503 |
  | `2026`⏎`2025` | 2026 | 2026 (den anden linje forsvinder tavst) |
  | `Satsår 2026 (gældende)` | 2026 | 2026 |
- **Det er uhensigtsmæssigt fordi:** Feltet **opfinder** et årstal, der ikke stod i den indsatte
  tekst. Ved beløb og procenter er det harmløst at springe et mellemrum eller et punktum over –
  cifrenes rækkefølge er den samme. Et årstal er derimod en form med fire faste positioner, så
  sammenstykning af cifre på tværs af separatorer flytter cifrene til de forkerte pladser: `1`,
  `0`, `2`, `6` bliver `1026`, ikke 2026. I dag redder årsgrænsen 2005–2026 de fleste af udfaldene
  som en rød fejl, men det er held: `2.026` i et tomt felt giver **2002**, som er et fuldt gyldigt,
  accepteret og forkert satsår – uden ét ord til brugeren. Dertil er det svært at forklare
  brugeren, at samme indsætning giver to svar, alt efter om han huskede at rydde feltet først.
- **Bedre ville være:** Et årsfelt bør behandle indsat tekst efter én regel, uanset om feltet var
  tomt: find det **entydige** firecifrede årstal i teksten og brug det (`01-02-2026` → 2026,
  `Skadedato 15-03-2019` → 2019, `Satsår 2026 (gældende)` → 2026). Kan teksten ikke opløses til
  præcis ét årstal – fordi den indeholder to (`2026` og `2025`) eller ingen – skal den bevares som
  afvist tekst med en konkret melding om, hvorfor den ikke kunne læses, frem for at der stykkes et
  tal sammen af de første fire cifre. Det er samme princip, som allerede er afgjort for de øvrige
  familier (`docs/brugerfund-der-skal-rettes.md` BF-032, BF-040, BF-041: paste springer forbudte
  tegn over frem for at fortolke dem) – årsfamilien er den ene, der ikke er blevet rettet ind,
  og for netop den er «spring tegnet over» den skadelige regel.
- **Andre steder det kan gælde:** Alle fire årsfelter i programmet bruger samme codec og har derfor
  samme adfærd: Satsår (`satser.aargang`), EO's svie/smerte-satsår (`eo.svieSmerteSatserAar`),
  Årslønssidens årsfelt (`aarsloenDescriptors.ts:332`) og Lønindkomst-tabellens
  `col1_maaned` (`erstatningsopgoerelseLoenDescriptors.ts:296`). De to sidste er tabelceller, hvor
  et indsat regneark er den sandsynlige kilde.

**Tilbagemelding**
Det er udtryk for en fejl i selve den generelle paste-adfærden for hele programmet, hvis indsætning af 2.026 i et datofelt kan blive til 2 (som da omformes til 2002). 
Paste skal alle steder opføre sig på samme måde, som hvis brugeren havde indtastet den pastede værdi ét tegn ad gangen startende med det første. Koden skal ikke nødvendigevis behandle paste som en serie af enkeltvise indtastninger, men resultatet skal blive som var det sket - og alle kontrakter eller koder som fører til et andet resultat, er forkerte og skal ændres.
Paste af '2.026' i et årstalfelt vil dermed blive håndteret som 
1) indtastning af 2 (indsættes)
2) indtastning af punktum (datofelter ignorerer tavst)
3) indtastning af 0 (indsættes)
4) indtastning af 2 (indsættes)
5) indtastning af 6 (indsættes)

Altså sådan, at den pastede værdi var '2026'.
Var der rent hypotetisk blevet pastet 2.026.4 ville derefter være sket
6) indtastning af punktum (datofelter ignorerer tavst)
7) indtastning af 4 (feltet er fyldt med det maksimale antal tilladte cifre, så ignoreres tavst)

**Afgørelse og gennemførelse 2026-08-18 – accepteret; mit eget forslag forkastet.**

Udvikleren har ret, og fundets «Bedre ville være» var forkert. Mit forslag – «find det entydige firecifrede
årstal i teksten» – ville have indført en NY fortolkningsregel oven på tastningen, altså præcis den slags
konkurrerende vej, fundet selv klagede over. Reglen er i stedet den, brugeren beskriver: paste giver samme
resultat, som hvis tegnene var tastet ét ad gangen. Den var i forvejen kontrakt (§1.2a) og var ikke
opfyldt.

**Det, der var i vejen, var to paste-only fortolkere.** `normalizeYearPaste` og `normalizeWeekPaste` læste
hele teksten på én gang, tog den første ciffergruppe og forkortede den derefter, indtil resultatet lå inden
for årsgrænserne. Begge er slettet og erstattet af det delte tegn-for-tegn-filter, som beløb, procent og
brøk allerede brugte (`filterPasteCharacters`, hvis egen dokumentation ordret er udviklerens regel). Dermed er
der ikke længere nogen anden fortolkningsvej i programmet.

To fejl faldt væk med dem:

| Indsat | Før (tomt felt) | Før (udfyldt) | Nu (begge) |
|---|---|---|---|
| `2.026` | 2002 | 2026 | **2026** ✓ udviklerens eksempel |
| `2035` (maks 2030) | 2020 tavst | 2035 rødt | **2035 rødt** |
| `01-02-2026` | 2001 | 102 | **102 rødt** |

Den anden linje er den vigtigste: årsgrænsen forkortede før `2035` til `2020` – en tavs ændring til en
anden gyldig værdi, som §1.2a punkt 5 udtrykkeligt forbyder. Årsgrænser er bounds og ejes af
feltvalidatoren; de må ikke røre teksten.

**Bekræftet i browser** på alle tre tekster: identisk resultat i tomt og udfyldt felt.

**Sideeffekter, der blev rettet i samme omgang, fordi de var samme fejlklasse:**
- Ugefeltets separatorsæt var erklæret **to gange med forskelligt indhold**: tegnværnet tillod `,` og `\`,
  som settle-parseren ikke normaliserede (`23,2025` kunne tastes, men blev afvist), og parseren
  normaliserede `:`, som aldrig kunne tastes. Nu én erklæring, som begge læser.
- **Mellemrum er ikke længere ugeseparator** (udviklerbeslutning, spørgsmål stillet undervejs). Med
  tegn-for-tegn-reglen gjorde mellemrummet `uge 23/2025` ubrugelig – det optog separator-pladsen, så det
  ægte `/` blev ulovligt, og ` 2320` blev afvist. Nu bliver teksten `23/2025`. Prisen er, at `23 2025` og
  `Uge 7 2019` ikke længere kan indsættes; de kræver en af de fem separatorer.
- Hjælperne bag de slettede fortolkere (`extractContiguousDigits`, `findNextDigitIndex`, `isWithinBounds`)
  er fjernet, ikke efterladt: de er byggeklodserne til præcis den slags fortolker, der ikke må opstå igen.

**Kontrakten er opdateret**, fordi reglen er normativ og var uopfyldt: §1.2a har fået **punkt 7**
(modalitets- OG tilstandsuafhængighed, med udviklerens sætning om at enhver kode eller kontrakt, der giver et
andet resultat, er forkert), og der er kommet en **§2.9 om års- og ugefelter**, som var udtrykkeligt
uafklarede indtil nu. De tre tilsigtede konsekvenser er skrevet ind, så de ikke senere «rettes» tilbage.

**Bemærk den ene konsekvens, jeg gjorde udvikleren opmærksom på undervejs:** `01-02-2026` giver `102` med rød
ring – ikke en afvisning. Fire cifre parser fint som årstal, så værdien committes canonical med et
bounds-issue. Udvikleren så udfaldet og fastholdt reglen; en «det ligner en dato»-undtagelse ville genskabe
den anden fortolkningsvej.

Tests: de gamle prøver pinnede den forkerte adfærd og er skrevet om. Ny test måler ligheden mellem tomt og
udfyldt felt direkte – det er den invariant, hele fundet handler om.

### BB-032 – Det dækkede årsinterval er kun synligt, når man har gættet forkert

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Gå til Satser med et gyldigt år udfyldt. Kig på siden, og hold musen over årsfeltet.
  2. Skriv `2004` (fx fordi sagen er fra 2004) og forlad feltet.
- **Det sker:** Intetsteds på siden – hverken i etiketten «Vis satser for år:», i pladsholderen
  `åååå`, i en tooltip på det gyldige felt eller i nogen brødtekst – står det, at satser findes for
  2005–2026. Først når brugeren har skrevet et år uden for intervallet, får han beskeden
  «Årstallet skal være mellem 2005 og 2026» – som tooltip på det røde felt og som knappens
  tooltip. Skærmens egen tekst siger på det tidspunkt kun «Vælg et gyldigt år for at se satserne.»
  uden at nævne hvilke år, der er gyldige.
- **Det er uhensigtsmæssigt fordi:** Siden er én lukket, kendt liste på 22 år, og feltet er et
  frit tekstfelt. Brugeren kan altså kun finde grænsen ved at fejle – og præcis den bruger, der
  har en gammel sag, er den, der rammer den. Beskeden findes i programmet hele tiden; den holdes
  bare tilbage, til brugeren har taget fejl. Det er A1's prøve: formatet skal gættes rigtigt første
  gang, ikke opdages ved at fejle.
- **Bedre ville være:** Skriv intervallet, hvor brugeren kigger, før han taster – enten i etiketten
  («Vis satser for år (2005–2026):») eller som tooltip på det **gyldige** felt. Intervallet skal
  hentes fra datadækningen, ikke skrives i hånden, så det følger med, når et nyt år tilføjes.
  Vejledningsteksten, der erstatter sektionerne, bør samtidig nævne intervallet:
  «Vælg et år mellem 2005 og 2026 for at se satserne.»
- **Andre steder det kan gælde:** EO's svie/smerte-satsår har samme form (frit årsfelt med et
  afledt interval); ikke efterprøvet. Bemærk at de to intervaller udledes forskelligt – Satser
  bruger datadækningen (til 2026), EO bruger `getCurrentYear()`. De er ens i dag, men vil skille
  sig, den dag satsdata rækker længere frem end kalenderåret.

**Tilbagemelding**
Der er ikke reelt tale om en fejl. Brugere vil i praksis aldrig søge på så gamle satser, som programmet understøtter - så det er kun et udtryk for overdreven akademisk indhu, at de indgår.

**Afgjort 2026-08-18 – afvist. Ingen ændring.**
Præmissen bag fundet var, at brugeren rammer den nedre grænse, fordi han har en gammel sag. Brugeren
oplyser, at det i praksis ikke sker: de understøttede år rækker længere tilbage, end nogen slår op i, så
2005-grænsen er ikke en grænse, brugere støder på. Et interval, ingen rammer, behøver ikke annonceres.

Konsekvens for de øvrige flader: **«skriv det tilladte interval ved feltet» er ikke et generelt fund.**
Foreslå det kun, hvor grænsen er en, brugeren realistisk rammer under almindeligt arbejde – ikke blot fordi
den findes og kunne skrives. Bemærk at grænsen fortsat ER oplyst, når den faktisk rammes: feltets tooltip
og downloadknappens tooltip siger begge «Årstallet skal være mellem 2005 og 2026».

### BB-033 – Tre steder hedder «Satser», og de tre viser satser på tre måder

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Åbn Satser i sidemenuen: ét årsfelt, og satserne for det ene valgte år.
  2. Åbn Varige mén → fanen «Satser»: en tabel med **alle** år på én gang («Opgørelsesår» /
     «Sats pr. méngrad»).
  3. Åbn Renteberegning → fanen «Rentesatser»: to tabeller med alle datoer på én gang.
  4. Åbn Årslønsberegning: en sektion, der også heder «Satser», men som er
     **indtastningsfelter** (lønperiode, tillægsform, fem procentsatser).
- **Det sker:** Ordet «Satser» dækker fire forskellige ting: én-år-ad-gangen-opslag, alle-år-tabel,
  alle-datoer-tabel og et sæt indtastningsfelter. Godtgørelsen for varige mén står både på Satser
  (for det valgte år) og i Varige méns tabel (for alle år) – samme tal, to former, og årsvalget på
  Satser har ingen virkning på tabellen.
- **Det er uhensigtsmæssigt fordi:** Brugeren, der har set alle år i én tabel på Varige mén, har
  ingen grund til at forstå, hvorfor Satser kun kan vise ét år, eller om de to kan være uenige.
  Og «Satser» på Årsløn er en indtastning, ikke et opslag – samme ord, modsat betydning. Det er
  A7's prøve: samme begreb bør hedde det samme, og forskellige ting bør ikke hedde ens.
- **Bedre ville være:** Behold de tre visningsformer – de tjener hver sit formål – men gør navnene
  forskellige, dér hvor tingene er forskellige. Årslønssidens sektion er ikke satser, men
  forudsætninger for lønberegningen, og bør have et navn, der siger det. De to alle-år-tabeller
  kan hedde noget, der siger at de er historiske oversigter, så det er tydeligt, at de ikke er
  bundet til sagens satsår.
- **Andre steder det kan gælde:** Ingen ud over de fire nævnte.

**Tilbagemelding**
Ikke en reel fejl. Det er forskelligt fra emne-type til emne-type, hvilke supplerende informationer, brugere har behov for at se for de respektive satser, så det er programmets forskelle udtryk for.

**Afgjort 2026-08-18 – afvist. Ingen ændring.**
Fundets præmis var, at de forskellige visningsformer er en inkonsistens. Udvikleren afgør, at de er et
udtryk for et reelt fagligt behov: hvilke supplerende oplysninger en bruger har brug for, afhænger af
satstypen, og formen følger behovet. Én-år-ad-gangen, alle-år-tabel og indtastningsfelter er derfor tre
rigtige svar på tre forskellige spørgsmål – ikke tre inkonsistente svar på ét.

Konsekvens for de øvrige flader: **et fælles navn er ikke i sig selv et fund.** A7-prøven skal stilles
skarpere – kun hvor to flader løser *samme* opgave forskelligt, ikke hvor de deler et ord, fordi emnet er
det samme. Rejs det ikke igen for «Satser» som overskrift.

### BB-034 – «Reguleringsprocent for erhvervsevnetab (fra 2024)» står alene og forklarer ikke sig selv

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Vælg år `2005`: rækken heder «Reguleringsprocent for erhvervsevnetab: 5,5 %».
  2. Vælg år `2024`: nu er der **to** rækker – «(før 2024): 65,7 %» og «(fra 2024): 0 %».
  3. Vælg år `2026`: nu er der **én** række igen – «(fra 2024): 8,9 %» – og ingen uden parentes.
- **Det sker:** Samme begreb optræder under tre forskellige etiketter, afhængigt af året, og
  parentesen «(fra 2024)» står alene på de nyeste år, hvor der ikke er nogen «(før 2024)» at
  skelne fra. En bruger, der kun ser 2026-siden, møder et forbehold, som intet forbeholder.
  Omvendt er det på 2024-siden ikke til at læse ud af etiketterne, at de to procenter regnes fra
  to forskellige grundlag – 65,7 % er akkumuleret fra det gamle grundlag, 0 % er begyndelsen af en
  ny serie. To tal, der ser ud som samme størrelse, målt på hver sin nulpunkt.
- **Det er uhensigtsmæssigt fordi:** Brugeren skal kunne læse på siden, hvilken af de to
  reguleringsserier hans sag hører til, og hvad tallet er en procent **af**. Etiketten siger kun,
  hvornår serien starter. Det er samme forhold som fri proces-rækken, hvor grundlaget står i en
  tooltip – bortset fra at reguleringsprocenten ikke har nogen tooltip.
- **Bedre ville være:** Giv de to reguleringsrækker samme behandling som fri proces: en
  informationsikon-tooltip, der siger, hvilken skadedato serien gælder for, og hvad procenten
  regnes af. Overvej at lade den uparentiserede etikette («Reguleringsprocent for
  erhvervsevnetab») være den, der bruges, når der kun er én række – så et forbehold kun står der,
  hvor der er noget at skelne.
- **Andre steder det kan gælde:** «Minimum årsløn» har samme form: uparentiseret på 2005–2023 og
  2025–2026, men delt i «(skader før 1.7.2024)» / «(skader fra 1.7.2024)» på 2024 alene. Her er
  parentesen dog konkret (en dato, ikke et årstal), og den optræder kun, hvor der faktisk er to
  rækker – så den er ikke et fund, men den bør følge samme afgørelse.

**Tilbagemelding**
Der er tale om en juridisk teknikalitet, som alle brugere vil kende baggrunden bag. Der blev lavet en markant ændring i beregningsprincipperne i år 2024, som også førte til nogle særlige overgangsbestemmelser det pågældende år.

**Afgjort 2026-08-18 – afvist. Ingen ændring.**
Fundet hvilede på, at brugeren skal kunne læse på siden, hvilken reguleringsserie hans sag hører til.
Udvikleren oplyser, at 2024-ændringen af beregningsprincipperne og dens overgangsbestemmelser er almindeligt
fagkendskab i målgruppen: parentesen «(fra 2024)» er ikke et forbehold, der skal forklares, men en
henvisning til en velkendt lovændring. Etiketten er dermed tilstrækkelig, og der skal ikke tilføjes
tooltips til reguleringsrækkerne.

Det samme gælder «Minimum årsløn (skader før/fra 1.7.2024)», som fundet nævnte som følgesag – den følger
denne afgørelse og skal ikke ændres.

Konsekvens for de øvrige flader: **en fagligt velkendt lovhenvisning behøver ingen forklaring i
brugerfladen.** Målgruppen er erfarne arbejdsskadepraktikere. Rejs kun etiket-fund, hvor betegnelsen er
programmets EGEN konstruktion, ikke hvor den refererer til en kendt regel eller lovændring.


### BB-035 – Specifikationen på papir mangler grundlaget for fri proces-beløbene

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. På Satser: hold musen over informationsikonet ved «Beløbsgrænse for fri proces
     (enlig/samlevende)». Tooltippen siger «Personlig indkomst + positiv kapitalindkomst».
  2. Download specifikationen og læs samme række i dokumentet.
- **Det sker:** Dokumentet skriver «Beløbsgrænse for fri proces: 404.000 kr. (enlig) / 513.000 kr.
  (samlevende) / + 70.000 kr. per barn under 18 år», men **ikke** hvad beløbsgrænsen måles på.
  Den oplysning findes kun som en tooltip på skærmen.
- **Det er uhensigtsmæssigt fordi:** Et beløbsloft uden angivelse af, hvilket indkomstbegreb det
  gælder for, kan ikke bruges til at afgøre noget. Dokumentet er den udgave, der lægges i sagen og
  læses af andre end den, der stod ved skærmen – og netop dér er oplysningen væk. Alt andet på
  siden er ordret ens i de to udgaver; dette er det ene sted, hvor skærmen ved mere end papiret.
- **Bedre ville være:** Skriv grundlaget med i dokumentets række, fx som en parentes efter
  etiketten: «Beløbsgrænse for fri proces (personlig indkomst + positiv kapitalindkomst)».
  Teksten skal komme fra samme sted som skærmens tooltip, så de to ikke kan komme til at sige hver
  sit.
- **Andre steder det kan gælde:** Alle informationsikoner, hvis indhold ikke også står i det
  dokument, rækken ender i. Ikke kortlagt; er en generel prøve for de dokumentførende flader.

**Tilbagemelding**
Ikke væsentligt. Det er grundlæggende en overflødig information til brugerne at fortælle, hvad der står i tooltip-meddelelsen. Den er der til ren akademisk interesse.

**Afgjort 2026-08-18 – afvist. Ingen ændring.**
Fundet antog, at tooltippens indhold er nødvendigt for at bruge beløbsgrænsen, og at fraværet i dokumentet
derfor er et tab. Udvikleren afgør det modsatte: indkomstgrundlaget er overflødig oplysning for målgruppen,
og tooltippen står der af akademisk interesse – ikke som en forudsætning for at læse tallet. Så er der
intet tab i, at dokumentet undlader den.

Konsekvens for de øvrige flader: **et informationsikons indhold er ikke automatisk noget, dokumentet
mangler.** Den generelle prøve, fundet foreslog («alle tooltips bør findes i dokumentet»), er dermed
afvist. Rejs det kun, hvor oplysningen er nødvendig for at kunne bruge tallet – ikke hvor den er
uddybende baggrund.

## Overvejet uden fund

- **Tomt år.** Sektionerne forsvinder, titlen mister årstallet, teksten «Vælg et gyldigt år for at
  se satserne.» vises, og downloadknappen bliver grå med «Indtastning mangler». Klassen er korrekt
  udledt (tomt ⇒ mangler, ikke fejl) og følger den afgjorte regel.
- **År uden for intervallet (`2030`, `4`, `99`, `9999`).** Værdien bevares i feltet, feltet får rød
  ring, og både feltets tooltip og knappens tooltip siger den konkrete grænse «Årstallet skal være
  mellem 2005 og 2026». Sektionerne skjules, så der aldrig vises satser for et fallback-år. Ingen
  usynlig blokering.
- **Ikke-læsbart år (`200`).** Feltet bliver rødt, knappen siger «Fejl i indtastning», og feltets
  hover-tekst siger det samme generiske. Den fulde forklaring («Der er udfyldt en ugyldig værdi i
  feltet 'Satsår'») findes som skærmlæsertekst. Det er den afgjorte regel for `format`-issues
  (2026-07-30: generisk tooltip), og fladen har kun ét felt, så der er ikke noget at forveksle –
  derfor ikke registreret som fund.
- **Tocifret år ved tastning** (`25`→2025, `05`→2005, `99`→1999 rødt, `4`→2004 rødt). Følger den
  afgjorte gennemgående regel for tocifrede årstal (BB-009, afvist 2026-08-16). Fungerer godt her,
  hvor et år er hele indholdet.
- **Arabisk-indiske cifre** (`٢٠٢٦`) afvises af feltets tegnfilter; værdien står uændret.
- **Undo/redo.** Ctrl+Z efter et årsskift fører tilbage til den forrige værdi – også når den forrige
  var ugyldig – og Ctrl+Y frem igen. Titel og sektioner følger med i begge retninger.
- **«Slet alt» fra Satser.** Bekræftelsesdialogen navngiver handlingen og nævner, at gemte
  `.eo`-filer ikke berøres. Efter bekræftelse landes på Stamdata; går man tilbage til Satser, er
  satsåret genudsået til 2026 (indeværende år), og siden er straks brugbar. Ingen tom blindgyde.
- **Den rullende sides nederste højre hjørne (M-10).** Ved 1536×864 og fuldt udrullet side ender
  det sidste retsinfo-link ved x≤1435 / y≤747, mens «Scroll til toppen»-knappen står på
  x 1451–1505 / y 779–833. Ingen overlapning, hverken lodret eller vandret. Fladen udløser altså
  ikke M-10.
- **Vandret plads (M-09).** Ingen vandret rul ved 1536×864; sidens indhold er en enkelt tekstsøjle
  uden egen minimumsbredde.
- **Tastaturrækkefølgen.** Feltet, downloadknappen og fri proces-informationsikonet er i
  rækkefølgen; alle retsinfo-links står med `tabindex="-1"`. Det er præcis den afgjorte
  `ExternalLink`-regel (M-08), og der er ingen interne links på fladen – så intet at registrere.
- **Rækker uden data skjules.** Skærmens `DataRow` skjuler hele rækken, når året ikke har en sats.
  Det er efterprøvet for hvert år 2005–2026: 14–16 af 18 talrækker og 5–6 af 9 referencerækker
  vises, og fordelingen er den samme gennem hele perioden. Der er altså ikke noget år, hvor siden
  uventet er næsten tom. (Selve skjulningen er rigtig – det er kun **dokumentets** afvigende prøve,
  der er et fund, se BB-030.)
- **PDF mod skærm, år for år.** For 2026 er de 21 rækker ordret ens på skærm og i dokument. For
  2024 er 21 af 22 ens; den 22. er BB-030. Fri proces-rækken er formuleret bedre i dokumentet
  («404.000 kr. (enlig) / 513.000 kr. (samlevende)») end på skærmen («404.000 / 513.000 kr.») –
  ikke et fund, men dokumentets ordlyd er den, skærmen kunne lære af.
- **Downloadens uafhængighed af Stamdata.** Specifikationen kan hentes på en helt tom sag, uden
  Stamdata og uden brevhoved. Det er rigtigt: satserne er lovbestemte og hører ikke til én
  bestemt skadelidt.
- **Filnavnet** bærer året («Arbejdsskadesatser 2026.pdf»), så to downloads for forskellige år ikke
  kan forveksles.
- **Word-formatet.** Word og PDF deler generatorens brødtekst og adskiller sig kun i skriveren, så
  BB-030 og BB-035 gælder begge formater. Verificeret i koden, ikke kørt som download.
- **Satsårets rækkevidde nedstrøms.** Året læses ikke af nogen beregning: det er kun denne sides
  visning og dette dokument. EO's svie/smerte-satsår er et selvstændigt felt med sin egen grænse.
  Der findes altså ikke det tavse nedstrøms-fund, man kunne frygte – men se det åbne spørgsmål
  nedenfor om, hvorvidt brugeren kan gennemskue det.

## Dækningshuller

- **Gem/Hent-rundturen med et ugyldigt satsår** kunne ikke afprøves: «Gem» bruger browserens
  filgemmedialog (`showSaveFilePicker`), som er utilgængelig headless – klikket giver hverken fil,
  dialog eller besked, også når året er gyldigt. Kontrakten siger, at et velformet år uden for
  intervallet **kan** gemmes i `.eo` og bæres tilbage som et rødt feltissue; at det faktisk sker,
  og hvad brugeren møder, når han åbner en sådan fil, er derfor ikke set. Bør efterprøves som
  E2E-test eller på Global shell-fladen (nr. 6), hvor Gem/Hent hører hjemme.
- **Retsinfo-linkene er ikke fulgt.** Der er ni referencerækker med hver sin bekendtgørelse eller
  vejledning; at hvert link fører til det rigtige dokument er en dataspørgsmål, ikke en
  UI-adfærd, og er ikke kontrolleret.
- **Om de viste satser er juridisk rigtige** er bevidst uden for skillens omfang (§6).

## Åbne spørgsmål

- **Skal siden sige, at satsåret ikke påvirker beregningerne?** Satsåret gemmes i `.eo` som
  sagsdata, sidetitlen hedder «Arbejdsskadesatser 2026», og feltet ser ud som ethvert andet
  indtastningsfelt i programmet. Alt det peger på et sagsvalg med konsekvenser. I virkeligheden er
  det udelukkende et opslag: det ændrer ingen erstatningsberegning nogen steder, og EO's
  svie/smerte-sats har sit eget, uafhængige årsfelt. En bruger, der har sat satsåret til 2019 for
  at slå noget op i en gammel sag, kan tro, at han dermed har fortalt programmet, hvilke satser
  sagen skal regnes med. Valget står mellem to svar: (a) skriv på siden, at året kun styrer denne
  visning og dette dokument – fx som underrubrik under Årstal; eller (b) lad det stå, fordi ordet
  «Vis» i etiketten er nok. Spørgsmålet er brugerens, fordi det handler om, hvilken forventning
  siden skal skabe.

**Tilbagemelding**
Nej, det vil være åbenlyst og velkendt for brugerne. Programmet indeholder mange individuelle værktøjer, som en erfaren praktisør vil vide, ikke har indbyrdes sammenhæng. Satser-siden er en ren informationsside, hvor brugere kan blive mindet om de gældende satser.

**Afgjort 2026-08-18 – lukket. Ingen ændring.**
Satser-siden er et **opslagsværk**, ikke en del af sagsbehandlingen. At programmet består af individuelle
værktøjer uden indbyrdes sammenhæng er åbenlyst for en erfaren praktiker, og siden behøver derfor ikke
oplyse, at satsåret ikke påvirker beregninger.

**Dette er en generel afgørelse, ikke kun et svar om denne side.** Den slår fast, at Mineo er en samling
selvstændige værktøjer, og at brugeren forventes at vide det. Konsekvens for de resterende flader: rejs
ikke fund af formen «brugeren kan tro, at denne side hænger sammen med den anden» alene ud fra, at to
flader deler et begreb. Et sådant fund kræver, at der faktisk ER en kobling, som virker anderledes end den
ser ud – ikke at koblingen mangler.

- **Bør et årstal langt fra sagens øvrige datoer give en advarsel?** Sagen har en skadedato på
  Stamdata. Vælges satsåret 2007 i en sag med skadedato 2024, er begge tal lovlige, men
  kombinationen er næsten sikkert en tastefejl eller et bevidst opslag – og programmet ved hvilke
  to tal, der er tale om. M-05's skærpede form siger, at en advarsel kan foreslås, hvor værdien er
  usandsynlig **i sagens egen sammenhæng**. Om det gælder her, afhænger af svaret på spørgsmålet
  ovenfor: er satsåret et rent opslag, er der intet at advare om, og siden må gerne kunne bruges
  til at kigge på 2007 midt i en 2024-sag. Er det et sagsvalg, er afstanden et signal.

**Tilbagemelding**
Nej. Samme begrundelse som umiddelbart ovenfor. Satser-siden har ingen relation til hvad brugeren i øvrigt har indtastet andre steder i programmet. Den handler om ren information om genelle satser. Den pågældende side er et opslagsværk - ikke en del af den egentlige sagsbehandling.

**Afgjort 2026-08-18 – lukket. Ingen ændring.**
Ingen advarsel. Siden har ingen relation til sagens øvrige indtastninger, så der findes ingen «sagens egen
sammenhæng» at måle satsåret imod. En bruger skal frit kunne slå 2007-satser op midt i en 2024-sag – det er
netop opslagsværkets formål.

Konsekvens for M-05 (`TVAERGAAENDE.md`): mønsterets skærpede form – «en advarsel kan foreslås, hvor værdien
er usandsynlig i sagens egen sammenhæng» – gælder kun felter, der ER sagsdata i beregningsmæssig forstand.
Et opslagsfelt har ingen sagssammenhæng at være usandsynlig i.
