# Mineo – kontrakt for inputfelters brugeradfærd

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Mere specifikke domænekontrakter kan supplere denne kontrakt. Den er underordnet `form-contract.md`, `mineo-field-pattern.md`, `date-contract.md`, `amount-contract.md`, `error-contract.md` og `keyboard-navigation.md` for deres arkitekturelle emner; ved konflikt ejer dette dokument den her beskrevne brugeradfærd for de navngivne felter.  
**Senest verificeret mod kode:** 2026-08-09 (§1.2, §1.2a, §2.1, §2.2, §2.3, §2.5 og §4.10's længdedel er
implementeret og verificeret; §2.4's brøkgrænser og de øvrige feltspecifikke afsnit er uændrede fra 2026-08-08)

Dette dokument er den autoritative arbejdsbeskrivelse af den ønskede brugeradfærd for de inputfelter og
kontroller, der er gennemgået i brugerens inputkrydsforhør. Det beskriver observerbar adfærd, ikke en bestemt
implementering. Felter, der ikke er nævnt her, er bevidst ikke afklaret endnu og må ikke antages at følge en
feltspecifik regel fra dette dokument.

De kendte afvigelser mellem denne kontrakt og den aktuelle implementering er registreret i
`docs/brugerfund-der-skal-rettes.md`.

**Ændring 2026-08-09 — tegn- og længdeblokering afløser det tidligere fulde-længde-princip.** Kontrakten
byggede tidligere på, at enhver værdi skulle kunne indtastes og indsættes i sin fulde længde, og at en
afkortning derfor var et datatab. Det princip er ophævet. Et felt skal nu effektivt blokere tegn og længde, der
ikke passer feltets grænser, og paste skal behandles præcis som tastning med identisk afgrænsning. Ændringen
har tre konkrete følger, som er indarbejdet nedenfor:

1. Beløbsfelter rummer højst 7 heltalscifre og 2 decimaler (`±9.999.999,99`), jf. §2.2.
2. Procentfelter rummer højst 3 heltalscifre og — hvor feltet tillader decimaler — 2 decimaler, jf. §2.3.
3. Særreglen om, at `Forlig om ansvarsgrad → Procent` blokerede indtastning over 100 %, er ophævet; feltet
   følger nu hovedreglen, jf. §4.10 og §8.

Blokeringen omfatter tegnsæt og længde — ikke talværdi. Range-, kronologi- og domænegrænser bevares fortsat som
canonical værdi med rød ring, konkret tooltip og blokeret download, præcis som hidtil.

Ciffergrænserne er **lofter, ikke tilladelser**: et felt med færre cifre, et lavere maksimum, forbud mod
negative beløb eller krav om fx delelighed med 1.000 beholder sin strengere regel uændret.

**Reglen gælder KUN felter, brugeren skriver i.** Den begrænser indtastning, ikke programmets efterfølgende
beregninger. Indtaster brugeren lønbeløb tæt på 7-ciffergrænsen i flere rækker, er den beregnede sum større end
ethvert enkeltbeløb — det er korrekt og accepteret. Beregnede, afledte og sammentalte værdier er ikke omfattet
af nogen ciffergrænse i denne kontrakt, jf. §1.2.

For procent gælder desuden en **formodningsregel**: et procent-inputfelt har maksimum 100 %, medmindre feltet
udtrykkeligt angiver andet. Formodningen kan fraviges i begge retninger — méngrad går til 120 % — men den
ændrer aldrig antallet af tilladte cifre, som altid er højst 3 før kommaet og 2 efter. Beregnede procenter, fx
indeksværdier ved regulering af TAF, kan lovligt overstige 100 % og er slet ikke omfattet.

## 1. Begreber og fælles livscyklus

### 1.1 Afsluttet input

- En åben editor kan indeholde en tom, delvis eller ugyldig draft. Draften må ikke drive beregning,
  validering, fejlvisning eller download-gate.
- Et felt afsluttes ved blur eller Enter. Tab og klik uden for feltet følger samme afslutning, når de forlader
  feltet. Escape annullerer hele den igangværende redigering og gendanner tilstanden fra editorens åbning.
- Et gyldigt resultat gemmes som canonical værdi. Et ugyldigt formatresultat gemmes som afsluttet rejected
  tekst uden en samtidig ikke-tom canonical værdi.
- En korrekt formateret værdi, der kun bryder en aktiv range-, kronologi- eller anden domænegrænse, bevares
  som canonical værdi og markeres med rød feltfejl og konkret tooltip.
- Manglende værdi er ikke automatisk en rød feltfejl. Om tomhed giver en samlet fejl, en gul advarsel eller ingen
  feedback, afgøres af det konkrete felt og den consumer, der kræver værdien.

### 1.2 Tegn- og længdeblokering – den universelle hovedregel

Et inputfelt skal have en effektiv blokering mod, at der overhovedet kommer tegn ind i feltet, som ikke stemmer
med feltets erklærede tegnsæt og maksimale længde:

1. Et tegn, som feltets tegnsæt ikke tillader, kommer ikke ind i feltet. Det gælder både tastning og paste.
2. Et tegn ud over feltets maksimale antal tegn, cifre eller decimaler kommer ikke ind i feltet. Det gælder
   både tastning og paste.
3. Blokeringen er tavs: den afviste tastning giver ingen rød ring, ingen fejltekst og ingen tooltip, fordi der
   ikke er opstået nogen fejltilstand — tegnet blev aldrig en del af værdien.
4. Reglen gælder **kun felter, brugeren skriver i**. Den er en grænse for indtastning, ikke for programmets
   efterfølgende beregninger.

Blokeringen omfatter **tegnsæt og længde**, ikke talværdi. En korrekt formateret værdi inden for feltets
længdegrænse, der bryder en aktiv range-, kronologi- eller anden domænegrænse, blokeres derfor **ikke** ved
indtastningen: den bevares som canonical værdi og markeres rødt med konkret tooltip efter §1.1. En méngrad på
`121` eller en dato uden for feltets grænser skal fortsat kunne indtastes og fortsat give en synlig rød fejl.

**Ciffergrænserne gælder brugerens indtastning — ikke programmets beregninger.** Det er den vigtigste
afgrænsning af hele reglen, og den skal læses med i hver enkelt ciffergrænse i §2. En beregnet, afledt,
sammenlagt eller opreguleret værdi må frit overskride den grænse, der gælder for det felt, den stammer fra:

- **Afledte og sammentalte værdier er ikke omfattet.** Indtaster brugeren lønbeløb tæt på 7-ciffergrænsen i
  flere rækker, er den samlede sum større end ethvert enkeltbeløb. Det er korrekt og accepteret adfærd.
  Rækkesummer, årstotaler, kapitaliserede beløb, renter og alle øvrige beregnede beløb må gerne have flere
  cifre end inputfeltet.
- **Visningsfelter og afledte celler er ikke inputfelter.** En read-only celle, en beregnet totalrække eller en
  resultatvisning skal vise det fulde beregnede tal og må hverken afkortes eller markeres rødt, fordi tallet
  ville have været for langt at taste.
- **Grænsen for beregnede værdier er en anden.** Den relevante øvre grænse for et beregnet beløb er
  beløbskontraktens interne repræsentationsværn (`amount-contract.md` §3), ikke feltets ciffergrænse.
- Kun dér, hvor brugeren selv skriver eller indsætter tegn, blokeres der. Programmatisk skrivning, `.eo`-load
  og motorernes output følger deres egne kontrakter og er ikke tastning.

### 1.2a Paste – samme afgrænsning som tastning

Paste er ikke en selvstændig indgang til feltet. Paste skal principielt behandles præcis, som hvis brugeren selv
havde tastet den indsatte tekst ét tegn ad gangen fra samme startposition, med identisk afgrænsning af de tegn,
der ikke er acceptable i feltet eller overstiger det maksimalt tilladte antal:

1. Tegnene behandles i rækkefølge fra det første tegn.
2. Et tegn, som feltet ville afvise ved almindelig tastning, springes over.
3. Paste fortsætter med næste tegn; et ulovligt tegn må ikke afbryde resten af paste-handlingen.
4. Præcisions-, ciffer-, tegn- og længdegrænser håndhæves undervejs efter §1.2. Tegn, der ikke længere kan
   rummes, springes over, mens efterfølgende input fortsat vurderes efter samme regel.
5. Hvis det filtrerede resultat stadig er formatmæssigt ugyldigt ved settle, bevares resultatet som afsluttet
   fejltekst og vises med rød ring og tooltip. Det må ikke tavst ændres til en anden gyldig værdi.
6. Hvis paste-resultatet bliver tomt, ryddes feltet uden rød fejl, medmindre feltet er en kontrol med særskilt
   no-op-regel, eksempelvis dropdowns og toggles.

Et paste, der bliver afkortet, fordi den indsatte tekst er længere end feltets maksimale længde, er derfor det
**forventede** resultat og ikke et datatab: præcis de samme tegn ville være blevet afvist ved tastning. Et
paste må derimod aldrig ændre en værdi, der ligger inden for feltets tegn- og længdegrænser, til en anden
værdi.

Paste i et fokuseret, lukket felt erstatter den markerede eller eksisterende værdi og committer straks. Paste i
en åben editor indsættes ved markørens position og følger den åbne editors almindelige settle ved blur/Enter.

### 1.3 Fejl og feedback

- Formatfejl, rejected input, rangefejl og domænefejl vises som rød ring/kant og tooltip ved hover. Der vises
  ikke inline-valideringstekst under feltet.
- Tooltips for bounds- og domænefejl skal være konkrete og vise relevante værdier eller grænser, fx den konkrete
  modgående dato. En ugyldig kalenderdato skal vise den konkrete fejltilstand uden at blive ændret til en anden dato.
- Ikke-blokerende mangler kan vises som gul advarsel på Beregning-siden. En sådan advarsel giver ikke rød ring på
  feltet og blokerer ikke beregning, dokument eller `.eo`-save.
- En åben draft giver ingen live-fejlfeedback. Ved lukket celle-paste kan feedback dog ses umiddelbart efter,
  fordi paste-handlingen afslutter feltet straks.

### 1.4 History, gentagelser og skjulte værdier

- Én brugerhandling giver højst ét undo-trin.
- En toggle-, radio- eller dropdownændring, der ændrer flere relaterede værdier, skal kunne fortrydes samlet,
  når feltets særlige regler kræver det.
- Hurtige gentagne klik eller tastetryk må ikke udføre samme gyldige overgang dobbelt.
- Et skjult felt bevarer en gyldig værdi og viser den igen, når feltet bliver synligt. En skjult værdi med rød
  feltfejl slettes, så en fejl ikke kan gemme sig og blokere en handling, brugeren ikke kan rette.

## 2. Universelle regler for feltfamilier

### 2.1 Datofelter

- Datoer redigeres med dag, måned og år. Dag og måned må have højst to cifre; år må have højst fire cifre.
- Punktum, mellemrum, skråstreg og tilsvarende separatorer omdannes til bindestreg. Gentagne bindestreger
  afvises efter den første; paste fortsætter derfor gennem dem.
- Separatorer før det første tal ignoreres.
- `12-2-2026` er gyldigt input og formateres først ved Enter, blur eller lukket-felt-paste til `12-02-2026`.
- Tocifrede år fortolkes efter den fælles tocifrede-årspolitik og vises som fire cifre ved settle.
- Tegn ud over dag-/måned-/årgrænserne blokeres ved tastning og springes over ved paste; paste stopper ikke.
  Et femte årsciffer eller et tredje dag-/månedsciffer kommer aldrig ind i feltet.
- En ugyldig kalenderdato som `31-02-2026`, `00-02-2026` eller `12-00-2026` bevares som fejltekst ved settle.
- Begge rangegrænser er inklusive, når det konkrete felt ikke angiver en anden regel.
- En dato uden for en aktiv domænegrænse bevares og markeres rødt. Den må ikke ændres til nærmeste gyldige dato.
- Paste af kun ugyldige tegn giver tomt felt uden rød fejl. Separatorer før første tal giver ikke i sig selv fejl.

**Hvert datofelt SKAL erklære sine grænser, og erklæringen SKAL være håndhævet.** Reglen ovenfor er ikke ny;
det var bindingen, der manglede. `src/config/dateRanges.ts` deklarerede grænser, mens hver validator blev
skrevet i hånden på sin egen descriptor — så et felt havde grænser præcis hvis nogen huskede dem. Målingen
2026-08-09 fandt 31 af 54 datofelter, der accepterede både år 1900 og år 2100 uden ét issue.

- Grænserne erklæres som `dateBounds(spec)` (`src/inputCore/catalog/dateBoundsValidators.ts`), der leverer
  erklæringen og dens validator samlet, så de to ikke kan komme fra hinanden.
- Et felt uden en skarpere domæneregel bruger systemrammen `dateRange_systemramme` (01-01-2005 til 31-12
  året efter indeværende). Rammen fanger et forkert århundrede uden at påstå en juridisk grænse.
- Et felt uden reelle grænser skal fravælges AKTIVT med `unconstrainedDateBounds('<begrundelse>')`.
- Håndhæves af `src/__tests__/inputCore/dateFieldsDeclareBounds.test.ts`, som måler ADFÆRD: hvert datofelt
  i produktionskataloget skal faktisk afvise en dato uden for sine egne erklærede grænser. En erklæring,
  ingen validator læser, er derfor rød — ikke grøn.

### 2.2 Beløbsfelter og beløbsudtryk

For de gennemgåede beløbsfelter er følgende regler bindende:

- Negative værdier er tilladt, når feltet er angivet som negativt tilladt.
- Et beløb må indeholde cifre, komma, matematiske operatorer (`+`, `-`, `*`, `/`, `x`) og parenteser.
- Punktum, mellemrum, tusindtalsseparatorer og andre tegn er ikke tilladt og må hverken tastes eller indsættes.
  Bogstaver, `kr.`, `kr` og `%` blokeres ved tastning og springes over ved paste.
- Minus i begyndelsen er negativt fortegn; minus mellem tal er subtraktion. Plus foran første tal er ugyldigt.
- Der må højst være to decimaler i hvert talled. Et afsluttende komma normaliseres ved settle, så `123,` bliver
  `123,00`.
- `123` vises som `123,00`, `123,4` som `123,40`, og indledende nuller normaliseres.
- Ufuldstændige eller syntaktisk ugyldige udtryk bevares som fejltekst ved settle. Det gælder fx `5000-`,
  `5000+`, `5000*`, `5000/`, `(5000` og `5000)`.
- Gentagne operatorer som `5000--200` og `5000+-200` giver rød formatfejl.
- Et alene stående minus giver rød formatfejl; `0` er et gyldigt beløb.
- Division med nul bevares som fejltekst og får konkret tooltip om division med nul.

**Beløbsgrænsen: højst 7 heltalscifre og 2 decimaler.**

- Et beløbsfelt kan rumme højst 7 heltalscifre og — hvor feltet tillader decimaler — derudover 2 decimaler.
  Største beløb er dermed `9.999.999,99`. Et negativt beløbsfelt skal have plads til den tilsvarende negative
  værdi, altså de samme 9 cifre plus et foranstillet minustegn: mindste beløb er `-9.999.999,99`.
- Grænsen håndhæves som en **længderegel pr. talled**: det 8. heltalsciffer og den 3. decimal i et talled
  kommer ikke ind i feltet, hverken ved tastning eller paste. Overskydende cifre springes over ved paste uden
  at forhindre senere operatorer og tal i at blive behandlet. Dette erstatter den tidligere regel om 20
  heltalscifre pr. talled.
- Et beløbsudtryk, der er syntaktisk gyldigt, men hvis **beregnede resultat** ligger uden for
  `-9.999.999,99` til `9.999.999,99`, kan ikke blokeres tegn for tegn. Resultatet bevares derfor som canonical
  værdi med rød ring og konkret tooltip om, at beløbet ikke kan overstige `9.999.999,99` (henholdsvis ikke kan
  være mindre end `-9.999.999,99`), og det blokerer de beregninger og dokumenter, hvor beløbet indgår.
- Den rå maksimumlængde for hele udtrykket er fortsat 512 tegn for de gennemgåede ydelsesfelter. Den begrænser
  udtrykkets samlede længde og træder til ud over ciffergrænsen pr. talled.

**De 7 cifre er et loft, ikke en tilladelse.** Reglen afgrænser alene det maksimale antal tegn, der kan
indtastes i et beløbsfelt. Den siger intet om, hvilke beløb det enkelte felt må indeholde, og den løsner
aldrig en grænse, feltet allerede har:

- Et felt kan tillade **færre cifre** eller en **lavere maksimumværdi** end de 7 cifre. Den strengeste grænse
  gælder. Et felt med maksimum `100.000` skal fortsat afvise `9.999.999`, selv om værdien ligger inden for de
  7 cifre.
- Et felt kan forbyde **negative beløb**. De 7 cifre giver ikke i sig selv adgang til det negative interval;
  fortegnspolitikken ejes fortsat af feltets codec (`form-contract.md` §8.2).
- Et felt kan stille **andre krav til værdien**, fx at beløbet skal være deleligt med 1.000, ligge over et
  minimum eller være et heltal. Sådanne krav er uberørte af ciffergrænsen.
- Den skarpere feltgrænse følger den almindelige arbejdsdeling: er den en **tegn- eller længdegrænse**
  (færre cifre, ingen decimaler), blokeres den ved indtastningen efter §1.2; er den en **talværdi- eller
  domæneregel** (maksimum, minimum, delelighed, fortegn på en beregnet værdi), bevares værdien canonical med
  rød ring og konkret tooltip.

### 2.3 Procentfelter

- Procentfelter accepterer cifre og dansk komma. Punktum, mellemrum, procenttegn og øvrige ikke-tilladte tegn
  blokeres ved tastning og springes over tegn for tegn ved paste.
- Et procentfelt kan rumme højst 3 heltalscifre og — hvor feltet tillader decimaler — derudover 2 decimaler.
  Det 4. heltalsciffer og den 3. decimal kommer ikke ind i feltet, hverken ved tastning eller paste.
- Et afsluttende komma færdiggøres ved settle med to decimaler; afsluttede procentværdier vises med to decimaler,
  når feltet bruger decimalrepræsentation.
- Indledende nuller normaliseres ved settle.
- En korrekt formateret værdi inden for de 3 cifre, der ligger uden for feltets aktive interval, bevares som
  canonical værdi med rød ring og konkret tooltip om det tilladte interval, og den blokerer download og
  beregning, hvor værdien har betydning for resultatet. Intervalgrænsen blokerer altså ikke selve
  indtastningen: `101` i et 0–100-felt skal kunne indtastes og skal give en synlig rød fejl.

**Formodningsreglen: et procentfelt har maksimum 100 %, medmindre andet er angivet.**

Et procent-INPUTFELT antages at have det tilladte interval 0–100 %. Formodningen gælder, indtil det konkrete
felt udtrykkeligt angiver noget andet, og den er feltets aktive grænse på præcis samme måde som en udtrykkeligt
erklæret grænse: en værdi over 100 bevares canonical med rød ring, konkret tooltip og blokeret download, hvor
den har betydning for resultatet.

- **Formodningen kan fraviges i begge retninger.** Hvert enkelt felt kan angive en HØJERE maksimumgrænse end
  100 % og kan angive en LAVERE. Et felt kan tilsvarende angive sit eget minimum. Angivelsen sker på feltet
  selv; den skal være udtrykkelig, så et interval aldrig opstår ved en forglemmelse.
- **Méngrad** er den kendte fravigelse opad: méngraden kan efter arbejdsskadereglerne fastsættes til op til
  120 %, og feltets interval er derfor 1–120. Méngrad er desuden et **heltalsfelt** uden decimaler, jf.
  `varigemen-contract.md` §5–6, som ejer reglen. `121` committes canonical med rød range-markering og blokerer
  engine og PDF.
- **Formodningen ændrer aldrig antallet af tilladte cifre.** Et procent-inputfelt rummer altid højst 3
  heltalscifre og — hvor decimaler er tilladt — 2 decimaler, uanset om feltets maksimum er 100, 120 eller
  lavere. Et lavere maksimum giver ikke færre cifre, og en fravigelse opad giver ikke flere. De to regler er
  uafhængige: cifrene er en længdeblokering ved indtastningen, maksimum er en talværdigrænse, der bliver til
  en canonical rød fejl.

**Der er ingen universel 100 %-grænse for procentsatser som sådan.** Formodningen ovenfor gælder kun felter,
brugeren skriver i, jf. §1.2:

- **Beregnede** procentsatser kan lovligt overstige 100 % og er slet ikke omfattet. Indeksværdier ved
  regulering af TAF er det typiske eksempel: en akkumuleret reguleringssats kan give en procentværdi langt
  over 100 uden at være en fejl. En afledt eller beregnet procent må derfor aldrig afvises eller markeres
  rødt, blot fordi den overstiger 100, og en beregnet procent er heller ikke bundet af de 3 cifre.
- Et procent-INPUTFELT, hvis domæne kræver værdier over 999, kan ikke rummes af de 3 cifre. Et sådant felt
  hører ikke til procentfamilien i denne kontrakt og skal have sin egen erklærede længde.

### 2.4 Brøkfelter

- Formatet er tæller/nævner. Tæller og nævner kan hver indeholde cifre og komma; der må være præcis højst én
  skråstreg.
- Punktum, mellemrum, fortegn og øvrige tegn blokeres ved tastning og springes over tegn for tegn ved paste.
- Negative tal er forbudt.
- Hver del må have højst 10 heltalscifre og højst 10 decimaler. Cifre ud over disse grænser kommer ikke ind i
  feltet, hverken ved tastning eller paste.
- Tæller 0 er ugyldig. Nævner 0 er ugyldig og skal have konkret division-med-nul-tooltip.
- En brøk større end 1 bevares som rød fejltekst. Brøken reduceres ikke automatisk: `2/4` forbliver `2/4`.
- Indledende nuller normaliseres, fx `02/04` til `2/4`.
- Ufuldstændige værdier som `1`, `1/` og `/3` bevares som rød fejltekst ved settle.
- Et afsluttende decimal-komma som `1,/2` giver formatfejl og færdiggøres ikke automatisk.

### 2.5 Frie tekstfelter

- Et tekstfelt accepterer de tegn, som det konkrete felt erklærer, herunder almindelig tekst, tal, tegn, danske
  specialtegn og emoji, når feltet er angivet som frit tekstfelt.
- Mellemrum inde i teksten bevares.
- Indledende og afsluttende mellemrum fjernes kun ved settle i de felter, hvor det er angivet særskilt nedenfor.
- En fastsat maksimumslængde håndhæves tegn for tegn ved både tastning og paste: tegn ud over længden kommer
  ikke ind i feltet. Et paste, der er længere end feltets maksimum, afkortes derfor til de tegn, der kan rummes.
- Felter, hvor al tekst er gyldig, giver ikke rød feltfejl på grund af tekstens indhold.

### 2.6 Dropdowns

- Paste vælger kun ved fuldt label-match mod en aktiv valgmulighed.
- Match er ufølsomt over for store/små bogstaver og ignorerer indledende/afsluttende mellemrum og linjeskift.
- Delvise labels, ukendt tekst, tom paste, paste med kun mellemrum og deaktiverede valgmuligheder giver no-op:
  det hidtidige valg bevares tavst.
- Almindelig tastning bruger typeahead: ét bogstav finder eller cykler mellem aktive valgmuligheder, der begynder
  med bogstavet.
- Valg af menupunkt committeres straks. Escape og klik uden for dropdownen lukker uden at ændre valget.
- Delete/Backspace rydder et fokuseret dropdownvalg straks, bortset fra dropdowns med en særskilt regel om, at
  de ikke må være tomme.
- Ét valg kan fortrydes med ét undo-trin.

### 2.7 Toggles og radio buttons

- En toggle har altid Ja eller Nej, aldrig tom værdi, og har ingen rød fejltilstand.
- Toggle skifter straks ved klik, Enter eller mellemrumstast. Paste, Delete og Backspace er no-op.
- Escape og klik uden for togglen ændrer ikke værdien. Ét skift giver ét undo-trin.
- Radio-knapper committer den valgte option straks. Enter vælger den fokuserede option; pilnavigation flytter
  fokus og selection inden for gruppen efter `keyboard-navigation.md`. Paste, Delete og Backspace ændrer ikke
  radiogruppen.
- En radiogruppe med et påkrævet valg giver samlet mangelfeedback ved manglende valg, ikke en formatfejl på en
  ikke-eksisterende tekstværdi.

## 3. Gennemgåede felter – Offentlige ydelser

### 3.1 `Til-dato` i ydelsestabellen

- En helt tom række giver ingen fejl, heller ikke på Beregning-siden.
- Hvis rækken er delvist udfyldt, men Fra-dato mangler, er Til-dato ikke i sig selv rød på grund af manglen;
  rækkens ufuldstændighed vises på Beregning-siden.
- Til-dato følger de universelle datoregler. Den skal følge den aktive skadedato-/rækkegrænse og være på eller
  efter Fra-dato. Samme dato som Fra-dato er tilladt.
- Hvis Til-dato ligger før Fra-dato, markeres både Fra-dato og Til-dato rødt. Til-datoens tooltip viser den
  konkrete Fra-dato, og Fra-datoens tooltip viser den konkrete Til-dato.
- En korrekt formateret, men range-ugyldig dato bevares som rød fejltekst.

### 3.2 `Ydelse` og `Tillæg`

`Tillæg` følger præcis samme regler og præmisser som `Ydelse`:

- Negative værdier og beløbsudtryk er tilladt. Eksempler er `5000-200`, `1000+250` og `500*2`.
- Et indledende minus er negativt fortegn; minus mellem tal er subtraktion. `x` er multiplikation på lige fod
  med `*`. Et indledende plus er ugyldigt.
- De universelle beløbsregler om tilladte tegn, to decimaler, normalisering, udtryksfejl, 512 rå tegn og højst
  7 heltalscifre pr. talled gælder, herunder feltgrænsen `±9.999.999,99` for et beregnet udtryksresultat.
- En korrekt formateret, men domænemæssigt ugyldig værdi bevares og markeres rødt. En formatfejl i selve
  udtrykket vises i beløbsfeltet; manglende eller utilstrækkelige øvrige rækkeværdier vises først samlet på
  Beregning-siden.
- Paste, der efter filtrering bliver tom, rydder feltet uden rød fejl, også når hele den gamle værdi var markeret.

### 3.3 `Ydelsestype`

- Paste vælger den aktive valgmulighed ved fuldt, trimmet og case-insensitivt label-match.
- Delvis, ukendt, tom eller deaktiveret paste ændrer ikke det hidtidige valg og viser ingen fejl.
- Almindelig typeahead, Delete/Backspace, Escape, klik uden for dropdownen, straks-commit og undo følger de
  universelle dropdownregler. Dropdownens særlige krav om ikke at være tom tilsidesætter kun Delete/Backspace,
  hvor det konkret er erklæret.

### 3.4 `Kommentarer`

- Feltet accepterer almindelig tekst, tal, tegn, danske specialtegn og emoji.
- Linjeskift er tilladt; Enter indsætter linjeskift og afslutter ikke feltet.
- Mellemrum inde i teksten bevares. Indledende og afsluttende mellemrum fjernes ved settle.
- Maksimumlængden er 512 tegn. Ved paste indsættes de første tegn, der kan rummes efter den universelle
  tegn-for-tegn-regel.
- Al accepteret tekst er gyldig og giver aldrig rød feltfejl.
- Delete/Backspace rydder straks. Escape gendanner teksten fra editorens åbning. Blur, Tab og klik uden for
  feltet gemmer teksten.

### 3.5 `Midlertidigt EET indsættes fra Erhvervsevnetab-siden`

- Kontrollen er en Ja/Nej-toggle med straks-commit ved klik, Enter og mellemrum. Paste er altid no-op.
- Aktivering med eksisterende manuelle rækker af ydelsestypen `Midlertidigt EET` kræver bekræftelsesdialog.
  Annullering holder toggle og rækker uændrede.
- Bekræftelse sletter alle manuelle Midlertidigt EET-rækker, bevarer øvrige rækker, markerer bilaget
  `Midlertidigt EET` som valgt og kan fortrydes samlet med ét undo-trin.
- Aktivering uden sådanne rækker skifter straks uden dialog. Deaktivering fravælger bilaget; slettede manuelle
  rækker gendannes ikke.
- Ved intern fejl bevares den tidligere toggle-værdi, og siden viser en tydelig fejlmeddelelse.

### 3.6 Sygedagpenge-hjælpeperiodens `Fra-dato` og `Til-dato`

- Begge felter følger de universelle datoregler og de samme paste-/separator-/format-/fejlregler som øvrige
  datofelter.
- En korrekt udfyldt enkelt dato kan stå uden direkte feltfejl, men `Indsæt` er disabled, indtil begge datoer er
  udfyldt korrekt, gyldigt og inden for deres aktive grænser.
- Ugyldige, ufuldstændige eller range-ugyldige værdier bevares med rød ring og konkret tooltip. `Indsæt` er
  disabled, hvis et af felterne har fejl.
- En tom Fra- eller Til-dato kan stå uden direkte feltfejl, når brugeren ikke forsøger at indsætte perioden.
- Ved gyldig indsættelse ryddes begge hjælpefelter. Paste i lukket felt erstatter værdien; paste i åben editor
  indsættes ved markøren.

## 4. Gennemgåede felter – EO oplysninger

### 4.1 `Erstatningsopgørelse → Nummer`

- Feltet er frivilligt og kan stå tomt uden feltfejl, men manglende nummer giver en samlet advarsel på Beregning-siden.
- Alle tegn er tilladt op til højst 7 tegn samlet. Bindestreg, bogstaver, mellemrum og øvrige tegn afvises ikke.
- Indledende og afsluttende mellemrum fjernes ved settle; mellemrum inde i værdien bevares.
- Paste følger tegn-for-tegn-reglen og begrænses til højst 7 tegn. Delete/Backspace rydder straks; Escape
  gendanner; Enter, blur, Tab og klik uden for feltet gemmer.
- En værdi, der består af de tilladte tegn, har ingen rød feltfejl.

### 4.2 `+ evt. ledsagetekst`

- Feltet er frivilligt og kan stå tomt uden fejl eller advarsel.
- Alle almindelige teksttegn, specialtegn og emoji er tilladt.
- Maksimumlængden er 64 tegn. Indledende og afsluttende mellemrum fjernes ved settle; interne mellemrum bevares.
- Paste følger tegn-for-tegn-reglen og begrænses til 64 tegn. Delete/Backspace, Escape og settle følger de
  universelle tekstregler.
- Feltet har ingen rød fejltilstand for accepteret tekst.

### 4.3 `Revideret opgørelse`

- Toggle har straks-commit ved klik, Enter og mellemrum. Standardværdien er Nej.
- Paste, Delete og Backspace er no-op. Feltet har altid Ja eller Nej og ingen rød fejltilstand.
- Toggleændringen ændrer kun selve feltet, kan fortrydes med ét undo-trin og har ingen yderligere effekt ved
  Escape eller klik uden for feltet.

### 4.4 `Vedrører perioden → Fra-dato`

- Feltet kan stå tomt uden direkte rød fejl. Hvis perioden er ufuldstændig, vises manglen på Beregning-siden.
- Samme Fra- og Til-dato er tilladt. Hvis Fra-dato ligger efter Til-dato, markeres begge rødt med hver sin
  konkrete modgående dato.
- Når Til-dato slettes, bliver Fra-dato stående, og kronologifejlen forsvinder. Det samme gælder omvendt.
- Datoen bevares og markeres rødt ved aktiv rangefejl. De universelle datoregler gælder uændret.

### 4.5 `Opgørelse lavet den`

- Feltet kan stå tomt uden direkte rød fejl, men tomhed giver samlet feedback på Beregning-siden.
- Tidligste tilladte dato er den højeste af skadedatoen og 01-01-2005, når skadedatoen er udfyldt; uden
  skadedato er tidligste dato 01-01-2005. Seneste tilladte dato er dags dato. Begge grænser er tilladte.
- Værdier uden for intervallet bevares med rød ring og konkret tooltip. Øvrige datoregler gælder uændret.

### 4.6 Knappen `Indsæt dags dato`

- Klik, Enter og mellemrum indsætter dags dato i `Opgørelse lavet den`, erstatter også ugyldig eller uafsluttet
  tekst og gemmer straks.
- Knappen får fokus efter indsættelsen, og datoen følger datofeltets normale formatering og validering.
- Knappen er med i den almindelige Tab-rækkefølge. Hvis dags dato ligger uden for feltets grænser, indsættes
  datoen alligevel og markeres rødt; knappen disabledes ikke af denne rangefejl.
- Én aktivering kan fortrydes med ét undo-trin. Gentagne aktiveringer med samme dags dato giver ikke overflødige
  undo-trin.

### 4.7 `Indsæt udkast-stempel`

- Toggleens standardværdi kommer fra den valgte standardindstilling på Indstillinger-siden, ikke fra en fast
  Nej-default.
- Toggle har straks-commit ved klik, Enter og mellemrum. Paste, Delete og Backspace er no-op.
- Feltet har altid Ja eller Nej, ingen rød fejltilstand, kun egen feltændring og ét undo-trin.
- Escape og klik uden for feltet har ingen yderligere effekt; hurtige gentagelser giver højst én overgang.

### 4.8 `Helbredsforhold`

- Valgmulighederne er `Sygemeldt`, `Delvist Sygemeldt` og `Raskmeldt`. Der er ingen standardværdi ved ny sag.
- Feltet kan stå tomt uden direkte rød fejl, når svie-/smertegodtgørelse ikke er relevant.
- Når godtgørelsen er relevant og feltet mangler, vises kun samlet fejl på Beregning-siden.
- Paste, typeahead, Delete/Backspace, Escape, straks-commit, no-op ved ukendt/ufuldstændig paste og undo følger
  dropdownreglerne.

### 4.9 `Arbejdssituation`

- Feltet er altid synligt og har ingen standardværdi ved ny sag.
- Valgmulighederne er `Uarbejdsdygtig`, `Delvist raskmeldt`, `Fuldt arbejdsdygtig`, `Efterløn`, `Fleksjob`,
  `Folkepension`, `Førtidspension`, `Kontanthjælp`, `Revalidering`, `Seniorpension` og `Uddannelse`.
- Når tabt arbejdsfortjeneste ikke er relevant, kan feltet stå tomt uden direkte rød fejl. Når det er relevant
  og tomt, vises kun samlet fejl på Beregning-siden.
- Øvrig adfærd følger dropdownreglerne.

### 4.10 `Forlig om ansvarsgrad → Procent`

- Feltet er frivilligt. Både Procent og Brøk må være tomme uden direkte fejl.
- Hvis begge udfyldes, markeres begge rødt med tooltip om, at kun én må udfyldes.
- Kun ikke-negative tal med komma og højst to decimaler kan indtastes. Punktum, mellemrum, procenttegn og
  andre tegn blokeres; paste filtreres tegn for tegn.
- Feltet følger den universelle procentregel i §2.3 uden særregel: højst 3 heltalscifre og 2 decimaler kan
  komme ind i feltet.
- Maksimum følger formodningsreglen i §2.3 og er dermed 100 %; feltet fraviger den ikke. Minimum er derimod
  udtrykkeligt sat til 1.
- `1` til `100` inklusive er gyldigt. `0` bevares som rød fejltekst, fordi minimum er 1.
- Værdier over 100 % blokeres **ikke** ved indtastningen. `101` skal kunne indtastes og bevares som canonical
  værdi med rød ring og konkret tooltip om det tilladte interval, og den blokerer download, hvor
  ansvarsgraden har betydning for resultatet. Den tidligere særregel om indtastningsblokering ved 100 % er
  ophævet, så feltet bruger samme hovedregel som de øvrige procentfelter.
- Beløbs-/procentnormalisering, Delete/Backspace, Escape og settle følger de universelle regler.

### 4.11 `Forlig om ansvarsgrad → Brøk`

- Feltet er frivilligt. Både Procent og Brøk må være tomme; begge udfyldte felter markeres rødt.
- Brøkformatet, herunder komma i begge dele, højst 10 heltalscifre og 10 decimaler pr. del, er bindende.
- Tæller 0, nævner 0, brøker over 1 og ufuldstændige værdier bevares som røde fejltekster efter reglerne i §2.4.
- `2/4` forbliver `2/4`; indledende nuller normaliseres, men brøken reduceres ikke.

### 4.12 `Varige mén-afgørelse` og `Verserende klagesag over ménafgørelse?`

- Begge er Ja/Nej-toggles med straks-commit ved klik, Enter og mellemrum. Paste, Delete og Backspace er no-op.
- Standardværdien er Nej. De har ingen rød fejltilstand og kan fortrydes med ét undo-trin.
- Når `Varige mén-afgørelse` er Ja, vises `Dato for første ménafgørelse` og `Verserende klagesag over
  ménafgørelse?` straks. Når den er Nej, skjules de.
- Gyldige skjulte værdier bevares. Skjulte værdier med rød fejl slettes. Ved ny aktivering vises bevarede gyldige
  værdier igen. Skjulte felter indgår ikke i beregning eller fejl.

### 4.13 `Dato for første ménafgørelse`

- Når `Varige mén-afgørelse` er Ja, er datoen indholdsmæssigt obligatorisk, men manglende dato giver kun en
  ikke-blokerende gul advarsel på Beregning-siden. Feltet er tomt uden rød ring.
- Tidligste tilladte dato er den højeste af skadedatoen og 01-01-2005; seneste er dags dato. Begge grænser er
  tilladte. Værdier uden for intervallet bevares rødt med konkret tooltip.
- Datoen er uafhængig af `Vedrører perioden` og `Opgørelse lavet den`. Hvis skadedatoen senere flyttes efter
  datoen, bevares datoen og markeres rødt.

### 4.14 Midlertidigt EET: toggle og datoer

#### `Midlertidigt EET-afgørelse`

- Ja/Nej-toggle med straks-commit, standard Nej, paste/Delete/Backspace no-op, ingen rød fejl og ét undo-trin.
- Ja viser afgørelsesdato, virkningsdato og klage-toggle. Nej skjuler dem.
- Gyldige skjulte datoer bevares; datoer med rød fejl slettes. Skjulte felter indgår ikke i beregning eller fejl.
- Ja er tilladt, selv om begge datoer mangler. Hvis både afgørelsesdato og virkningsdato mangler, vises kun en
  ikke-blokerende gul advarsel på Beregning-siden.

#### `Dato for første midlertidige erhvervsevnetabsafgørelse`

- Datoen er ikke obligatorisk i feltet. Hvis både denne dato og virkningsdatoen mangler, vises en ikke-blokerende
  gul Beregning-advarsel; der vises ingen rød ring på dato-felterne.
- Tidligste dato er den højeste af skadedatoen og 01-01-2005; seneste er dags dato. Begge grænser er tilladte.
- Range-ugyldige datoer bevares rødt. Datoen er uafhængig af `Vedrører perioden` og `Opgørelse lavet den`.
- Når toggle står på Nej, skjules datoen; gyldig værdi bevares, fejlbehæftet værdi slettes, og gyldig værdi
  kommer tilbage ved ny aktivering.

#### `Virkningsdato (hvis forskellig fra afgørelsesdatoen)` – midlertidig EET

- Feltet er frivilligt, når afgørelsesdatoen allerede er udfyldt. En udfyldt virkningsdato er alene tilstrækkelig
  til at fjerne den gule advarsel, selv om afgørelsesdatoen mangler.
- Tidligste dato er den højeste af skadedatoen og 01-01-2005; seneste er 31-12 i året efter indeværende år.
  Begge grænser er tilladte. Datoen må ligge før, lig med eller efter afgørelsesdatoen.
- Datoen er uafhængig af `Vedrører perioden` og `Opgørelse lavet den`; range-ugyldige værdier bevares rødt.
- Når toggle står på Nej, skjules feltet efter samme gyldig-bevar/fejl-slet-regel.
- Når den er udfyldt, afgrænser virkningsdatoen retten til TAF. Uden virkningsdato bruges afgørelsesdatoen.
  For skader før 16. juni 2011 kan midlertidig eller endelig EET-dato efter de øvrige regler være afgrænsende.

### 4.15 Endeligt EET: toggle, datoer og klage

#### `Endeligt EET-afgørelse`

- Ja/Nej-toggle med standard Nej, straks-commit, paste/Delete/Backspace no-op, ingen rød fejl og ét undo-trin.
- Ja viser afgørelsesdato, virkningsdato og `Verserende klagesag over EET-afgørelse?`. Nej skjuler dem.
- Gyldige skjulte værdier bevares; skjulte værdier med rød fejl slettes. Skjulte felter indgår ikke i beregning eller fejl.
- Ja er tilladt med begge datoer tomme. Hvis begge mangler, vises kun en ikke-blokerende gul Beregning-advarsel.

#### `Dato for endelig erhvervsevnetabsafgørelse`

- Følger samme dato-, interval-, skjulings- og advarselsregler som den midlertidige afgørelsesdato.
- Når endelig EET er aktiv, afgrænser en udfyldt endelig EET-dato TAF uanset skadesdato.

#### `Virkningsdato (hvis forskellig fra afgørelsesdatoen)` – endelig EET

- Følger samme frivillighed, interval, skjulings- og paste-regler som den midlertidige virkningsdato.
- En udfyldt virkningsdato er den aktive dato for TAF; ellers bruges afgørelsesdatoen.

#### `Verserende klagesag over EET-afgørelse?`

- Ja/Nej-toggle med straks-commit, standard Nej, paste/Delete/Backspace no-op, ingen rød fejl og ét undo-trin.
- Når den står på Ja, afgrænser EET-datoerne ikke TAF, før klagesagen ikke længere er verserende.
- Når både midlertidig og endelig EET ellers er relevante, bruges den tidligste relevante afgrænsende dato.
  Endelig EET er afgrænsende uanset skadesdato; midlertidig EET er kun afgrænsende for skader før 16. juni 2011.

### 4.16 `Evt. differencekrav opgjort per`

- Feltet er frivilligt og kan stå tomt uden direkte fejl eller advarsel.
- Tidligste dato er den højeste af skadedatoen og 01-01-2005; seneste er dags dato. Begge grænser er tilladte.
- Datoer uden for intervallet bevares med rød ring og konkret tooltip. Feltet er uafhængigt af `Vedrører perioden`
  og `Opgørelse lavet den`.
- En udfyldt dato afgrænser TAF ved dagen før datoen og supplerer andre afgrænsende datoer. Den erstatter ikke
  andre afgrænsninger; den tidligste relevante dato gælder, også når EET-klagesag ellers er verserende.

## 5. Gennemgåede felter – svie-/smerte-tabellen

### 5.1 Fælles rækkeadfærd

- En helt tom række er gyldig og giver ingen fejl, heller ikke på Beregning-siden.
- En delvist udfyldt række kræver Fra-dato, Til-dato og Tilstand. Manglende dele vises samlet på Beregning-siden;
  en dato, der blot står i en delvis række, bliver ikke rød alene på grund af den manglende nabo.
- Når hele rækken tømmes, fjernes rækken automatisk, så der kun er én tom trailing-række tilbage.
- En dato i en Erhvervssygdom-række må ligge før anmeldelsesdatoen efter den fælles særregel for sådanne sager;
  anmeldelsesdatoen er ikke i sig selv en nedre grænse. De øvrige aktive systemgrænser gælder fortsat.
- Overlap mellem perioder giver rød markering af de involverede datofelter og konkret overlap-tooltip.

### 5.2 `Fra-dato`

- Feltet kan stå tomt i den helt tomme række uden fejl. I en delvis række bliver manglen en Beregning-fejl uden
  at den tomme celle i sig selv får rød ring.
- Fra-dato markeres rødt ved aktiv nedre/øvre rangefejl, ved Fra-dato efter Til-dato og ved overlap.
- Hvis Fra-dato ligger efter Til-dato, markeres begge datofelter rødt med hver sin konkrete modgående dato.
- De universelle datoregler gælder uændret.

### 5.3 `Til-dato`

- Feltet følger samme tomheds-, kompletheds-, range-, kronologi-, overlap- og Erhvervssygdomsregler som Fra-dato.
- Til-dato skal for almindelige arbejdsskader ligge på eller efter den aktive nedre grænse og Fra-dato samt på
  eller før den aktive øvre grænse. Samme Fra- og Til-dato er tilladt.
- Ved Til-dato før Fra-dato markeres begge datofelter rødt. Til-datoens tooltip viser den konkrete Fra-dato.
- Paste og settle følger de universelle datoregler.

## 6. Felter, der bevidst ikke er med endnu

Denne kontrakt indeholder ikke feltspecifik adfærd for øvrige felter i Mineo eller for svie-/smerte-tabellens
`Tilstand`-dropdown ud over den fælles række-komplethedsregel. De skal krydsforhøres og tilføjes, før deres
adfærd kan betragtes som afklaret.

## 7. Autoritative kilder og testkobling

Feltfamiliernes fælles implementeringsgrænser ejes af `src/contracts/form-contract.md`,
`src/contracts/mineo-field-pattern.md`, `src/contracts/date-contract.md`, `src/contracts/amount-contract.md`,
`src/contracts/error-contract.md` og `src/contracts/keyboard-navigation.md`.

De konkrete feltdefinitioner og domæneprojektioner findes i `src/inputCore/catalog/`,
`src/domain/erstatningsopgoerelse/`, `src/domain/eoRowEvaluation/` og de relevante tabel-/sektionskomponenter.
`docs/brugerfund-der-skal-rettes.md` er backlog for kendte implementeringsafvigelser; det ændrer ikke denne
kontrakts normative regler.

Følgende eksisterende test-suiter er de første testkoblinger for kontrakten og skal udvides med konkrete cases,
når adfærden implementeres:

- `src/__tests__/inputCore/editor/fieldEditor.test.ts`
- `src/__tests__/inputCore/react/useFormFieldSurface.test.tsx`
- `src/__tests__/inputCore/runtime/dispatchInput.test.ts`
- `src/__tests__/schemas/amountExpressionSchema.test.ts`
- `src/__tests__/domain/erstatningsopgoerelse/eoSnapshot.test.ts`
- `src/__tests__/domain/erstatningsopgoerelse/periodiseringsMotor.test.ts`
- `src/__tests__/components/tables/tableKeyboardNavigation.arrowWrap.test.tsx`

## 8. Kendte undtagelser

- Dropdowns og toggles har no-op-regler for paste, fordi de ikke skal fortolke fri tekst som valg eller Ja/Nej.
- Sygedagpenge-hjælpefelter må stå tomme uden direkte feltfejl, men deres `Indsæt`-handling kræver en komplet,
  gyldig periode.
- Tegn- og længdeblokeringen i §1.2 er ikke en undtagelse fra fejlmodellen, men dens forudsætning: fordi et
  ulovligt eller overskydende tegn aldrig kommer ind i feltet, kan det heller ikke give en fejltilstand. Alle
  intervalgrænser — også procentfelters — bevares derimod som canonical værdi med rød fejl. Der er ingen
  felter med indtastningsblokering på talværdi; den tidligere særregel for `Forlig om ansvarsgrad → Procent`
  er ophævet.
- Beløbsudtryk er den ene nuance i §1.2: udtrykkets enkelte talled længdebegrænses tegn for tegn, mens et
  beregnet resultat uden for `±9.999.999,99` først kan fanges ved settle og derfor bliver en canonical rød fejl
  med konkret tooltip.
- Ciffergrænserne i §2.2 og §2.3 er lofter, ikke tilladelser. De løsner aldrig en strengere feltregel — færre
  cifre, lavere maksimum, forbud mod negative beløb, krav om delelighed.
- **Beregnede værdier er ikke omfattet af nogen ciffergrænse.** Rækkesummer, årstotaler, kapitaliserede beløb
  og opregulerede satser må frit overskride det inputfelt, de stammer fra. Grænsen for et beregnet beløb er
  `amount-contract.md` §3, ikke feltets ciffergrænse.
- **Procentfelters maksimum er 100 % som formodning**, ikke som fast regel. Hvert felt kan udtrykkeligt angive
  et højere eller lavere maksimum; méngrad går til 120 %. Fravigelsen ændrer aldrig ciffergrænsen på 3+2.
  Beregnede procentsatser, fx indeksværdier ved regulering af TAF, kan lovligt overstige 100 % og er slet ikke
  omfattet af inputreglerne.
- Svie-/smerte-rækkens Erhvervssygdom-regel tillader datoer før anmeldelsesdatoen; den præcise nedre grænse ejes
  af den fælles domæneafledning for skadestype og dato.
