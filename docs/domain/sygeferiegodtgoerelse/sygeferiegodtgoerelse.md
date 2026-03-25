# Sygeferiegodtgørelse

Denne fil samler den foreløbigt fastlagte forretningslogik for sygeferiegodtgørelse (`SFGG`).

Dokumentet er opdelt i tre dele:
- en pædagogisk og overskuelig forretningsbeskrivelse
- et særskilt IDG-afsnit med implementeringsrelevante bindinger
- et afsnit med afklaringsspørgsmål skrevet ud fra konkrete brugersituationer

---

## Pædagogisk forretningsbeskrivelse

### 1. Grundidé

SFGG er udtryk for den forskel, der opstår i feriepengeoptjening efter en skade.

Den overordnede grundpræmis er derfor:
- at se på, hvad der blev optjent af feriepenge før skaden
- at se på, hvad der optjenes af feriepenge efter skaden
- at beregne forskellen mellem de to

I denne sammenhæng bruges `feriepenge` som fællesbetegnelse for:
- feriegodtgørelse
- ferietillæg

Det er kun lønindkomst, der indgår i beregningen af SFGG.
Der beregnes ikke SFGG af offentlige ydelser.

Hvis der er flere ansættelsesforhold, beregnes SFGG særskilt for hvert ansættelsesforhold.
Der er ingen beregningsmæssig sammenhæng mellem de enkelte ansættelsesforhold.

### 2. Referencesats

Den grundlæggende præmis er, at der skal beregnes en referencesats.

Referencesatsen svarer til den daglige feriepenge-indbetaling før skaden.

Hvis der ikke gælder særlige overenskomstregler, eller hvis brugeren vælger at angive satsen manuelt, er udgangspunktet ferielovens model.

#### 2.1. Ferielovens udgangspunkt

Efter ferieloven tages der som udgangspunkt afsæt i en referenceperiode på 4 uger.

Udgangspunktet er:
- den seneste 4-ugers lønperiode
- som ikke var påvirket af sygefravær på grund af arbejdsskaden

Brugeren angiver referenceperioden manuelt med:
- fra-dato
- til-dato

Systemet skal ikke kontrollere, om perioden er præcis 4 uger.
Referenceperioden må også gerne ligge efter skadesdatoen.
Forklaringsteksten bør derfor ikke låses til "inden skaden", men beskrive referenceperioden mere retvisende som 4 uger før sygefraværet.

#### 2.2. Beregning af referencesatsen

Referencesatsen beregnes sådan:

```text
referencesats = beregnede feriepenge i referenceperioden / arbejdsdage i referenceperioden
```

Det betyder:
- at der tages de beregnede feriepenge fra ansættelsesforholdet i referenceperioden
- at der tælles arbejdsdage i referenceperioden
- at feriepengene divideres med arbejdsdagene

Referencesatsen er dermed feriepenge pr. arbejdsdag.

#### 2.3. Arbejdsdage og korrektion af arbejdsdage

Arbejdsdage i referenceperioden skal beregnes ved at genbruge programmets eksisterende centrale funktionalitet til at finde arbejdsdage som mandag-fredag.

Programmet har allerede central funktionalitet til at beregne arbejdsdage efter fradrag af:
- daterede feriedage
- SH-dage

Denne funktionalitet skal genbruges.

Antallet af arbejdsdage i referenceperioden skal reduceres med:
- fraværsdage uden løn
- feriedage
- SH-dage

Brugeren indtaster ikke SH-dage særskilt i SFGG-delen.
SH-dage skal komme fra den eksisterende centrale funktionalitet.

Brugeren indtaster heller ikke feriedage som et særskilt antal i SFGG-delen.
Feriedage kommer fra de daterede ferieperioder, som allerede indgår i programmet.

Ferieperioderne behandles som fælles for alle ansættelsesforhold i SFGG-beregningen.

Det maksimale antal, brugeren kan indtaste som `Evt. ferie- og fraværsdage i perioden uden løn`, er derfor det antal arbejdsdage, der er tilbage, når de daterede feriedage og SH-dage allerede er trukket ud.

Hvis referenceperioden efter disse fradrag ikke indeholder nogen arbejdsdage, skal referenceperiodens datofelter markeres med fejl, og brugeren skal have besked om, at perioden ikke indeholder nogen arbejdsdage.

### 3. Overenskomster

Visse overenskomster fraviger ferielovens regler om SFGG.

Når en overenskomst finder anvendelse, går dens regler forud for ferieloven.
Det betyder ikke nødvendigvis, at ferieloven tilsidesættes fuldt ud.
En overenskomst kan:
- erstatte ferielovens model
- supplere ferielovens model
- ændre enkelte dele af ferielovens model

Det afgørende triggerpunkt er, om brugeren på lønindkomst-siden har angivet, at ansættelsesforholdet var overenskomstdækket.

Hvis ansættelsesforholdet er overenskomstdækket, skal programmet automatisk slå op i overenskomstdata og afgøre, om overenskomsten fraviger ferielovens regler om SFGG.

#### 3.1. Eksplicit boolean på alle overenskomster

Alle overenskomster skal have en fast, eksplicit boolean:
- `true`, hvis overenskomsten fraviger ferielovens regler om SFGG
- `false`, hvis overenskomsten ikke fraviger ferielovens regler om SFGG

Det må ikke udledes via en dynamisk formel.

Hvis en overenskomst ikke har denne oplysning, er det en systemteknisk fejl.

Hvis en overenskomst i data indeholder angivne SFGG-satser, betyder det, at den fraviger ferieloven.

Foreløbigt lægges følgende til grund:
- KL-overenskomsten fraviger ikke ferielovens regler om SFGG
- læreroverenskomsten fraviger ikke ferielovens regler om SFGG
- fremtidige overenskomster, der er koblet op på KL-overenskomsten, behandles foreløbigt også som ikke-fravigende

#### 3.2. To typer fravigelse

En overenskomst kan fravige ferieloven på to kendte måder.

##### Type 1: Samme beregningsprincip, men anden referenceperiode

I denne type følger referencesatsens beregningsprincip fortsat ferieloven.
Fravigelsen består kun i, at referenceperioden er en anden end 4 uger.

Den alternative referenceperiode er ofte 3 måneder, men skal defineres konkret pr. relevant overenskomst.

I denne type gælder fortsat:
- referencesatsen beregnes af feriepenge i referenceperioden
- referencesatsen beregnes af arbejdsdage i referenceperioden
- referencesatsen findes ved at dividere feriepengene med arbejdsdagene

##### Type 2: Direkte referencesats

I denne type bruges der slet ikke referenceperiode.
Overenskomsten angiver i stedet referencesatsen direkte.

Nogle overenskomster har kun én sats.
Andre har flere satser afhængigt af:
- faglært eller ufaglært
- København eller provinsen

I de tilfælde skal brugeren vælge mellem:
- `Faglært-København`
- `Faglært-Provinsen`
- `Ufaglært-København`
- `Ufaglært-Provinsen`

#### 3.3. Sygelønsvilkår i overenskomst

Der skal være en yderligere boolean på hver overenskomst for, om der ikke er ret til SFGG, så længe arbejdsgiver betaler sygeløn.

Hvis denne boolean er `true`, skal programmet automatisk udlede fra lønindkomstindtastningerne på det konkrete ansættelsesforhold, i hvilke perioder den pågældende arbejdsgiver har betalt løn.

Hvis brugeren har indtastet løn i en lønperiode i tabellen med indtægtsoplysninger for ansættelsesforholdet, skal denne lønperiode behandles som en periode med arbejdsgiverbetalt sygeløn.

Hvis der ikke er indtastet løn i en lønperiode, skal den periode ikke behandles som arbejdsgiverbetalt sygeløn.

Der skal ikke beregnes SFGG i disse perioder.

Hvis der er huller mellem sådanne perioder, skal der beregnes SFGG i hullerne, forudsat:
- at der er arbejdsdage i hullerne
- og at hullerne ikke alene består af daterede ferieperioder eller andre dage, som allerede er undtaget

### 4. Udvikling i satsen over tid

Referencesatsen kan i visse tilfælde ændre sig over tid.

#### 4.1. Direkte overenskomstsats

Hvis referencesatsen fremgår direkte af overenskomsten, anvendes den relevante sats frem til den dato, hvor overenskomstdata angiver en forhøjelse.

Fra denne dato bruges den nye sats.

#### 4.2. Overenskomstdækket ansættelsesforhold, men ferielovsberegnet sats

Hvis ansættelsesforholdet er overenskomstdækket, men referencesatsen beregnes efter ferieloven, forhøjes SFGG-satsen på samme tidspunkt og med samme procentsats, som tabt arbejdsfortjeneste (`TAF`) forhøjes efter overenskomsten.

Det gælder både:
- almindelig ferielovsmodel
- ferielovsmodel med ændret referenceperiode efter overenskomsten

#### 4.3. Øvrige tilfælde

I andre tilfælde ændrer SFGG-satsen sig ikke over tid.
Her bruges samme referencesats hele vejen igennem.

### 4.4. Beregning af SFGG-kravet

Selve beregningen af SFGG skal foretages i følgende hovedtrin:

```text
referencesats = beregningsgrundlag / antal arbejdsdage i referenceperioden
```

Derefter beregnes kravet sådan:

```text
(antal arbejdsdage i SFGG-perioden x referencesats)
- feriepenge af sygeløn i SFGG-perioden
- allerede betalt SFGG i perioden
= beregnet SFGG-krav
```

Feriepenge af sygeløn i SFGG-perioden skal beregnes automatisk som feriepenge-satsen af lønnen i perioden, baseret på lønindtastningerne på ansættelsesforholdet.

`Allerede betalt SFGG i perioden` er et samlet manuelt indtastet beløb pr. ansættelsesforhold i den pågældende EO-periode.
Ved en senere EO for en efterfølgende periode må brugeren selv ændre indtastningen til det beløb, der allerede er betalt i den nye EO-periode.

Hertil lægges arbejdsgivers pensionsbidrag, beregnet af det resterende beløb efter disse fradrag.
Pensionsprocenten følger ansættelsesforholdets almindelige pensionssats.

SFGG-perioden vil typisk svare til TAF-perioden, men kan være afkortet som følge af:
- at SFGG først beregnes fra anden sygedag
- at SFGG først beregnes efter ophør af arbejdsgiverbetalt sygeløn
- at retten ophører ved ansættelsesophør
- at retten ved skader før `1. januar 2015` ophører, når 4-månedersgrænsen er nået

### 5. Tidsmæssige regler

#### 5.1. Skæringsdato 1. januar 2015

Der gælder en særlig skæringsdato: `1. januar 2015`.

##### Skadesdato før 1. januar 2015

Hvis skadesdatoen er før `1. januar 2015`:
- beregnes SFGG fra første sygedag
- er udbetalingen begrænset til maksimalt 4 måneder

Hver sygedag beregnes som:

```text
1 / x måned
```

hvor `x` er antallet af hverdage (mandag-fredag) i den pågældende måned.

##### Skadesdato fra og med 1. januar 2015

Hvis skadesdatoen er fra og med `1. januar 2015`:
- beregnes SFGG først fra anden sygedag
- er udbetalingen tidsubegrænset

Hvis der er tale om første erstatningsopgørelse, skal den første TAF-dag udgå af beregningen af SFGG, og dette skal forklares i teksten.

Hvis der er flere adskilte TAF-perioder, er det kun den kronologisk første sygedag i hele forløbet, der skal udgå.

Hvis der ikke er tale om første erstatningsopgørelse, beregnes SFGG på alle TAF-dage.

#### 5.2. Kobling til TAF-perioden

SFGG beregnes i samme periode som den indtastede TAF-periode.

Der skal derfor ikke angives en særskilt SFGG-periode.

#### 5.3. Ophør ved ansættelsesophør

Retten til SFGG ophører, hvis ansættelsesforholdet ophører.

Dette ophør skal ske automatisk:
- uden fejlmeddelelse til brugeren
- men med oplysning i PDF'en om ophørsdatoen og årsagen

Ophørsdatoen er sidste dag med ret til SFGG.

SFGG må aldrig ophøre automatisk alene som følge af manglende lønindkomst i en længere periode.
I den situation må programmet kun vise advarsel om muligt stiltiende ophør.

### 6. Særlig 4-månederslogik før 2015

Når skaden er før `1. januar 2015`, skal der være en toggle med teksten:

`Er alle sygeperioder efter skaden indtastet som TAF-periode ovenfor?`

Default skal være `true`.

Hvis togglen er `false`, skal der vises en loose grid, hvor brugeren indtaster samtlige sygeperioder siden skaden.

Beregningslogikken er:
- hvis togglen er `true`, bruges de indtastede TAF-perioder
- hvis togglen er `false`, bruges de særskilt indtastede sygeperioder

Der skal tælles unikke datoer efter den relevante optællingsmetode.
Overlappende perioder må derfor aldrig medføre, at samme dato tælles dobbelt.

Optællingsmetoden afhænger her af feltet `TAF beregnes som`.

Hvis `TAF beregnes som` er arbejdsdage, skal 4-månedersgrænsen beregnes ud fra rene hverdage (mandag-fredag) og ikke arbejdsdage efter fradrag af ferie og SH-dage.

Hvis `TAF beregnes som` er måneder, skal 4-månedersgrænsen i stedet beregnes ud fra kalenderdage (mandag-søndag) uden fradrag for ferie- eller SH-dage.

Resultatet af denne beregning skal være én konkret dato:
- den dato, hvor summen bliver `>= 4` måneder

Denne dato er sidste dag med ret til SFGG.
Efter denne dato beregnes der ikke længere SFGG.
PDF'en skal oplyse, at SFGG ophørte, fordi 4-månedersgrænsen blev nået på denne dato.

Hvis togglen står på `true`, og der ikke er indtastet nogen TAF-perioder, accepteres det, at resultatet bliver tomt.

Hvis togglen står på `true`, skal systemet blot bruge de indtastede TAF-perioder.
Det skal ikke behandles som fejl eller give advarsel, at TAF-perioderne ikke nødvendigvis dækker et sammenhængende sygdomsforløb.

### 7. UI-flow i contentboxen

Brugeren skal indledningsvist kun mødes af en dropdown med labelen:

`Sygeferiegodtgørelse beregnes ud fra`

Dropdownen skal have fire valgmuligheder:
- `Overenskomst`
- `Manuelt angivet`
- `Ferieloven`
- `Ingen`

#### 7.1. Valg: Overenskomst

Hvis brugeren vælger `Overenskomst`, afhænger de efterfølgende felter af overenskomstens SFGG-regler.

Hvis overenskomsten ikke fraviger ferieloven, skal visningen være den samme som ved `Ferieloven`.

Hvis overenskomsten kun fraviger ved en anden referenceperiode, skal indholdet også være det samme som ved `Ferieloven`, bortset fra at forklaringsteksten skal oplyse, at overenskomstens referenceperiode er `x` uger eller måneder.

Hvis overenskomsten bruger direkte referencesatser og samtidig er markeret med differentierede satser, skal der vises en dropdown med:
- `Faglært-København`
- `Faglært-Provinsen`
- `Ufaglært-København`
- `Ufaglært-Provinsen`

Hvis overenskomsten bruger direkte referencesatser, men ikke er markeret med differentierede satser, skal denne dropdown ikke vises.

#### 7.2. Valg: Ferieloven

Hvis brugeren vælger `Ferieloven`, skal der vises:
- en forklarende tekst om, at SFGG beregnes ud fra en referenceperiode på 4 uger før sygefraværet
- en linje `Referenceperiode` med `Fra`- og `Til`-dato
- en linje `Evt. ferie- og fraværsdage i perioden uden løn` med et integerfelt

For integerfeltet gælder:
- minimum = `0`
- maksimum = det samlede antal arbejdsdage i den indtastede referenceperiode efter fradrag af ferie- og SH-dage

#### 7.3. Valg: Manuelt angivet

Hvis brugeren vælger `Manuelt angivet`, skal der vises:
- en linje `Dagssats for sygeferiegodtgørelse (mandag-fredag)` med et ikke-negativt beløbsfelt
- en linje `Beløbet er i henhold til` med et tekstfelt
- en linje `Først sygeferiegodtgørelse efter ophør af sygeløn` med en toggle

Togglens default er `nej`.

Hvis togglen sættes til `ja`, skal den bruge samme logik som overenskomstvilkåret om, at der først er ret til SFGG efter ophør af arbejdsgiverbetalt sygeløn.

#### 7.4. Valg: Ingen

Hvis brugeren vælger `Ingen`:
- beregnes der ikke SFGG
- genereres der ikke nogen SFGG-side i PDF'en

### 8. Output, PDF og advarsler

#### 8.1. Tabelvisning

SFGG-beregningen skal vises i en tabel:
- nederst på EODebug
- som særskilt side i erstatningsopgørelse-PDF'en, hvis brugeren har valgt det som bilag på EOBeregningTab

Valgmuligheden på EOBeregningTab er aktuelt deaktiveret, men skal aktiveres, når funktionaliteten er færdig.

Tabellen skal have følgende kolonner:
- `Fra-dato`
- `Til-dato`
- `Sats`
- `Antal dage`
- `Beregnet SFGG`

Under rækkerne skal der være en `I alt`-række.

Ved skader før `1. januar 2015` skal der altid vises en særskilt tabel, som forklarer opgørelsen af det hidtidige antal måneder frem mod 4-månedersgrænsen.
Dette gælder både når `TAF beregnes som` er arbejdsdage, og når `TAF beregnes som` er måneder.
Denne tabel skal vise, hvordan perioderne er omsat til måneder efter den relevante optællingsmetode.

#### 8.2. PDF-oplysninger

PDF'en skal kunne oplyse:
- at SFGG ophørte på en bestemt dato på grund af ansættelsesophør
- at SFGG ophørte på en bestemt dato, fordi 4-månedersgrænsen blev nået
- at bestemte perioder er undtaget, fordi overenskomsten udelukker SFGG under arbejdsgiverbetalt sygeløn

Hvis både perioder uden ret under arbejdsgiverbetalt sygeløn og senere ansættelsesophør er relevante, skal begge forklaringer vises.
Rækkefølgen skal være:
- først forklaringen om perioder uden ret under arbejdsgiverbetalt sygeløn
- derefter forklaringen om ophør ved ansættelsesophør

Ved skader før `1. januar 2015` skal der desuden stå en forklarende tekst over tabellen om, at retten til SFGG er begrænset til fire måneder.
I selve tabellen bruges 4-månedersdatoen som sidste til-dato.

Teksten ved ophør af ansættelsesforhold skal være:

`Retten til sygeferiegodtgørelse bortfaldt den dd-mm-åååå som følge af ansættelsesforholdets ophør.`

Ved overenskomstbestemt bortfald under arbejdsgiverbetalt sygeløn er det tilstrækkeligt at vise en linje om, at der først er ret til SFGG efter ophør af sygeløn, og derefter den almindelige linje om eventuelt senere ophør ved ansættelsesophør.

Ved skader før `1. januar 2015` skal forklaringsteksten over tabellen være:

`Da skaden er sket/anmeldt, afhængigt af om det er en arbejdsulykke eller erhvervssygdom, før 1. januar 2015, er retten til sygeferiegodtgørelse tidsbegrænset til 4 måneder.`

Ordvalget `sket` eller `anmeldt` skal styres deterministisk af skadestype-feltet på stamdata-siden.
Programmet skal her genbruge den eksisterende formuleringstilgang, som allerede anvendes andre steder i systemet ved sondringen mellem arbejdsulykke og erhvervssygdom.

#### 8.3. Advarsel om muligt stiltiende ophør

Hvis der fortsat beregnes SFGG for et ansættelsesforhold 6 måneder efter, at der sidst blev indtastet lønindkomst for ansættelsesforholdet, skal der vises en advarsel i EOBeregningTab.

Advarslen skal vises én gang samlet pr. ansættelsesforhold.

Advarselsteksten skal være:

`Der beregnes fortsat sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.`

Hvis brugeren vælger `Ingen`, skal der stadig vises et felt om SFGG i EODebug.
I dette tilfælde skal EODebug kun vise én linje med teksten fra dropdownen og den valgte værdi `Ingen`.
Der skal ikke vises yderligere SFGG-indhold i EODebug.

---

## IDG: Implementeringsrelevante bindinger

### Normative bindinger

- SFGG skal beregnes separat pr. ansættelsesforhold.
- Kun lønindkomst må indgå i referencesatsberegningen.
- Offentlige ydelser må ikke indgå i SFGG-beregningen.
- Referenceperioden angives manuelt via fra-/til-dato.
- Systemet må ikke håndhæve, at referenceperioden er præcis 4 uger.
- Referenceperioden må gerne ligge efter skadesdatoen.
- Referencesatsen skal beregnes som `feriepenge / arbejdsdage`.
- Arbejdsdage i referenceperioden skal reduceres med fraværsdage uden løn.
- Arbejdsdage i referenceperioden skal reduceres med feriedage.
- Arbejdsdage i referenceperioden skal reduceres med SH-dage.
- Arbejdsdage i referenceperioden skal findes ved at genbruge programmets eksisterende centrale funktionalitet for arbejdsdage som mandag-fredag.
- Eksisterende central funktionalitet til fradrag af daterede feriedage og SH-dage skal genbruges.
- Brugeren skal ikke indtaste SH-dage særskilt i SFGG-delen.
- Brugeren skal ikke indtaste feriedage som særskilt antal i SFGG-delen; ferie skal komme fra de daterede ferieperioder i programmet.
- De daterede ferieperioder skal behandles som fælles for alle ansættelsesforhold i SFGG-beregningen.
- Maksimum i feltet `Evt. ferie- og fraværsdage i perioden uden løn` skal være de resterende arbejdsdage efter fradrag af daterede feriedage og SH-dage.
- Hvis referenceperioden efter disse fradrag indeholder `0` arbejdsdage, skal referenceperiodens datofelter markeres med fejl, og brugeren skal have besked om, at perioden ikke indeholder nogen arbejdsdage.
- Overenskomstregler går forud for ferielovens standardregler, når ansættelsesforholdet er overenskomstdækket, og overenskomsten er markeret som fravigende.
- Alle overenskomster skal have en eksplicit konstant boolean for, om de fraviger ferielovens regler om SFGG.
- Denne boolean må ikke beregnes via en dynamisk formel.
- Alle overenskomster skal også kunne have en separat konstant boolean for, om SFGG bortfalder under arbejdsgiverbetalt sygeløn.
- Manglende SFGG-markering på en overenskomst er en systemteknisk fejl.
- Der skal senere være tests, som håndhæver, at alle overenskomster indeholder de nødvendige SFGG-oplysninger, også når nye overenskomster tilføjes.
- Hvis en overenskomst indeholder angivne SFGG-satser, skal den markeres som fravigende.
- KL-overenskomsten skal foreløbigt have `false` for SFGG-fravigelse.
- Læreroverenskomsten skal foreløbigt have `false` for SFGG-fravigelse.
- Fremtidige overenskomster koblet op på KL-overenskomsten skal foreløbigt have `false` for SFGG-fravigelse, indtil andet fastlægges.
- Overenskomster kan fravige på to måder: alternativ referenceperiode eller direkte referencesats.
- Ved alternativ referenceperiode skal referencesatsen stadig beregnes som `feriepenge / arbejdsdage`.
- Den alternative referenceperiode skal defineres konkret pr. overenskomst.
- Den alternative referenceperiode er ofte 3 måneder, men må ikke hardcodes som generel regel.
- Ved direkte referencesats må der ikke anvendes referenceperiode i beregningen.
- Hvis en overenskomst har flere direkte referencesatser afhængigt af faglært/ufaglært og København/provinsen, skal brugeren vælge mellem præcis fire muligheder:
  `Faglært-København`, `Faglært-Provinsen`, `Ufaglært-København`, `Ufaglært-Provinsen`.
- Overenskomster med direkte referencesatser skal have en separat boolean for, om satserne er differentieret efter faglært/ufaglært og København/provinsen.
- Dropdownen med de fire differentierede satsvalg må kun vises, når den konkrete overenskomst er markeret som differentieret.
- Hvis referencesatsen fremgår direkte af overenskomsten, skal satsen skifte på den dato, hvor overenskomstdata angiver en forhøjelse.
- Hvis ansættelsesforholdet er overenskomstdækket, men referencesatsen beregnes efter ferieloven, skal SFGG-satsen forhøjes på samme tidspunkt og med samme procentsats som TAF efter overenskomsten.
- Hvis overenskomstens sygelønsboolean er `true`, må der ikke beregnes SFGG i perioder, hvor lønindkomstindtastningerne viser, at arbejdsgiver betaler sygeløn.
- Perioder med arbejdsgiverbetalt sygeløn skal vurderes pr. ansættelsesforhold.
- En lønperiode skal behandles som arbejdsgiverbetalt sygeløn, hvis brugeren har indtastet løn i lønperioden i tabellen med indtægtsoplysninger for ansættelsesforholdet.
- Hvis der ikke er indtastet løn i en lønperiode, må perioden ikke behandles som arbejdsgiverbetalt sygeløn.
- Hvis der er huller mellem perioder med arbejdsgiverbetalt sygeløn, skal der beregnes SFGG i hullerne, forudsat at hullerne indeholder arbejdsdage, som ikke allerede er undtaget.
- I øvrige tilfælde skal referencesatsen være konstant gennem hele beregningsforløbet.
- Referencesatsen skal beregnes som `beregningsgrundlag / antal arbejdsdage i referenceperioden`.
- SFGG-kravet skal beregnes som arbejdsdage i SFGG-perioden ganget med referencesatsen.
- Feriepenge af sygeløn i SFGG-perioden skal beregnes automatisk som feriepenge-satsen af lønnen i perioden, baseret på lønindtastningerne på ansættelsesforholdet.
- Fra dette beløb skal feriepenge af sygeløn i SFGG-perioden fratrækkes.
- Allerede betalt SFGG i perioden skal være ét samlet manuelt indtastet beløb pr. ansættelsesforhold i den pågældende EO-periode.
- Fra dette beløb skal allerede betalt SFGG i perioden fratrækkes.
- Arbejdsgivers pensionsbidrag skal beregnes af det resterende beløb efter disse fradrag.
- Til det beregnede SFGG-krav skal arbejdsgivers pensionsbidrag lægges.
- Pensionsprocenten skal følge ansættelsesforholdets almindelige pensionssats.
- Hvis skadesdatoen er før `1. januar 2015`, skal SFGG beregnes fra første sygedag.
- Hvis skadesdatoen er før `1. januar 2015`, skal udbetalingen begrænses til højst 4 måneder.
- Hvis skadesdatoen er før `1. januar 2015`, skal hver sygedag beregnes som `1/x` måned, hvor `x` er antallet af hverdage i måneden.
- Hvis skadesdatoen er før `1. januar 2015`, skal der vises en toggle med teksten `Er alle sygeperioder efter skaden indtastet som TAF-periode ovenfor?`
- Denne toggle skal default være `true`.
- Hvis togglen er `false`, skal der vises en loose grid til indtastning af samtlige sygeperioder siden skaden.
- Hvis togglen er `true`, skal 4-månedersberegningen baseres på de indtastede TAF-perioder.
- Hvis togglen er `false`, skal 4-månedersberegningen baseres på de særskilt indtastede sygeperioder.
- 4-månedersberegningen skal resultere i én konkret dato, hvor summen bliver `>= 4` måneder.
- Der skal tælles unikke datoer i 4-månedersberegningen efter den relevante optællingsmetode, og overlappende perioder må ikke tælles dobbelt.
- Hvis `TAF beregnes som` er arbejdsdage, skal 4-månedersgrænsen før `1. januar 2015` beregnes ud fra rene hverdage og ikke arbejdsdage efter fradrag af ferie og SH-dage.
- Hvis `TAF beregnes som` er måneder, skal 4-månedersgrænsen før `1. januar 2015` beregnes ud fra kalenderdage uden fradrag for ferie- eller SH-dage.
- Datoen, hvor summen bliver `>= 4` måneder, er sidste dag med ret til SFGG.
- Efter denne dato må der ikke længere beregnes SFGG.
- Hvis togglen står på `true`, og der ikke findes TAF-perioder, må resultatet gerne være tomt.
- Hvis togglen står på `true`, skal systemet bruge de indtastede TAF-perioder uden advarsel om, at der eventuelt mangler andre sygeperioder.
- Hvis skadesdatoen er fra og med `1. januar 2015`, skal SFGG beregnes fra anden sygedag.
- Hvis skadesdatoen er fra og med `1. januar 2015`, skal udbetalingen være tidsubegrænset.
- Ved første erstatningsopgørelse efter skader fra og med `1. januar 2015` skal den første TAF-dag udgå af SFGG-beregningen.
- Hvis der er flere adskilte TAF-perioder ved første erstatningsopgørelse efter skader fra og med `1. januar 2015`, er det kun den kronologisk første sygedag i hele forløbet, der skal udgå.
- Ved senere erstatningsopgørelser efter skader fra og med `1. januar 2015` skal SFGG beregnes på alle TAF-dage.
- SFGG-perioden skal være identisk med den indtastede TAF-periode og må ikke have selvstændig periodeindtastning.
- SFGG skal i alle tilfælde ophøre automatisk ved ansættelsesophør.
- Automatisk ophør ved ansættelsesophør må ikke udløse fejlmeddelelse til brugeren.
- Ophørsdato ved ansættelsesophør er sidste dag med ret til SFGG.
- Manglende lønindkomst i længere tid må ikke i sig selv stoppe SFGG automatisk.
- Hvis SFGG fortsætter 6 måneder efter den sidst indtastede lønindkomst for et ansættelsesforhold, skal EOBeregningTab vise en advarsel om muligt stiltiende ansættelsesophør.
- Denne advarsel skal vises én gang samlet pr. ansættelsesforhold.
- Advarselsteksten skal være `Der beregnes fortsat sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.`
- Contentboxen for SFGG skal indledningsvist kun vise en dropdown med labelen `Sygeferiegodtgørelse beregnes ud fra`.
- Dropdownen skal have præcis fire valgmuligheder: `Overenskomst`, `Manuelt angivet`, `Ferieloven`, `Ingen`.
- Hvis brugeren vælger `Overenskomst`, skal de efterfølgende felter bestemmes af overenskomstens SFGG-regler.
- Hvis den valgte overenskomst ikke fraviger ferieloven, skal visningen være den samme som ved `Ferieloven`.
- Hvis overenskomsten kun fraviger ved en anden referenceperiode, skal indholdet være det samme som ved `Ferieloven`, men med tilpasset forklaringstekst om `x` uger eller måneder.
- Hvis brugeren vælger `Overenskomst`, skal valget fortsat være muligt, også når overenskomsten i praksis følger ferieloven.
- Hvis brugeren vælger `Ferieloven`, skal der vises en forklarende tekst om referenceperiode på 4 uger før sygefraværet.
- Hvis brugeren vælger `Ferieloven`, skal der vises en linje `Referenceperiode` med `Fra`- og `Til`-dato.
- Hvis brugeren vælger `Ferieloven`, skal der vises en linje `Evt. ferie- og fraværsdage i perioden uden løn` med et integerfelt.
- Integerfeltets minimum skal være `0`.
- Integerfeltets maksimum skal være det samlede antal arbejdsdage i den indtastede referenceperiode efter fradrag af ferie- og SH-dage.
- Hvis brugeren vælger `Manuelt angivet`, skal der vises en linje `Dagssats for sygeferiegodtgørelse (mandag-fredag)` med et ikke-negativt beløbsfelt.
- Hvis brugeren vælger `Manuelt angivet`, skal der vises en linje `Beløbet er i henhold til` med et tekstfelt.
- Hvis brugeren vælger `Manuelt angivet`, skal der vises en linje `Først sygeferiegodtgørelse efter ophør af sygeløn` med en toggle.
- Togglens default skal være `nej`.
- Hvis togglen `Først sygeferiegodtgørelse efter ophør af sygeløn` sættes til `ja`, skal samme logik anvendes som ved overenskomstbestemt bortfald under arbejdsgiverbetalt sygeløn.
- Hvis brugeren vælger `Ingen`, må der ikke beregnes SFGG.
- Hvis brugeren vælger `Ingen`, må der ikke genereres nogen SFGG-side i PDF'en.
- SFGG-beregningen skal kunne vises i en tabel nederst på EODebug.
- SFGG-beregningen skal kunne vises som særskilt side i erstatningsopgørelse-PDF'en, når brugeren har valgt bilaget på EOBeregningTab.
- Valgmuligheden for SFGG-bilag på EOBeregningTab er foreløbigt deaktiveret og skal først aktiveres, når funktionaliteten er færdig.
- Tabellen skal have kolonnerne `Fra-dato`, `Til-dato`, `Sats`, `Antal dage` og `Beregnet SFGG`.
- Tabellen skal afsluttes med en `I alt`-række.
- Ved skader før `1. januar 2015` skal der altid vises en særskilt tabel, som forklarer opgørelsen af det hidtidige antal måneder frem mod 4-månedersgrænsen, uanset om `TAF beregnes som` er arbejdsdage eller måneder.
- PDF'en skal kunne vise, at SFGG ophørte på grund af ansættelsesophør.
- PDF'en skal kunne vise, at SFGG ophørte, fordi 4-månedersgrænsen blev nået.
- PDF'en skal kunne vise, at bestemte perioder er undtaget på grund af arbejdsgiverbetalt sygeløn efter overenskomsten.
- Hvis både arbejdsgiverbetalt sygeløn og ansættelsesophør er relevante, skal PDF'en vise begge forklaringer i den fastlagte rækkefølge.
- Ved skader før `1. januar 2015` skal PDF'en have forklarende tekst over tabellen om 4-månedersbegrænsningen.
- Ved valg af `Ingen` skal EODebug stadig vise en enkelt linje med den valgte værdi, men ikke yderligere SFGG-indhold.
- Teksten ved ansættelsesophør skal være `Retten til sygeferiegodtgørelse bortfaldt den dd-mm-åååå som følge af ansættelsesforholdets ophør.`
- Ved overenskomstbestemt bortfald under arbejdsgiverbetalt sygeløn er det tilstrækkeligt at vise linjen om ret først efter ophør af sygeløn og derefter den almindelige linje om eventuelt senere ansættelsesophør.
- Ved skader før `1. januar 2015` skal forklaringsteksten over tabellen være `Da skaden er sket/anmeldt, afhængigt af om det er en arbejdsulykke eller erhvervssygdom, før 1. januar 2015, er retten til sygeferiegodtgørelse tidsbegrænset til 4 måneder.`
- Ordvalget `sket` eller `anmeldt` i denne tekst skal styres af skadestype-feltet på stamdata-siden.
- Programmet skal genbruge den eksisterende formuleringstilgang, som allerede anvendes andre steder i systemet ved sondringen mellem arbejdsulykke og erhvervssygdom.

### Eksisterende funktionalitet til genbrug

Ud fra den nuværende kodebase er der allerede omfattende central logik, som SFGG bør genbruge direkte eller lægge sig meget tæt op ad.

#### 1. Hverdage

Til optælling af rene hverdage (mandag-fredag) findes allerede:
- `beregnAntalHverdage` i `src/utils/periodeBeregning.ts`
- `isWeekdayUtc` i `src/domain/erstatningsopgoerelse/tafDaySets.ts`

Disse er især relevante for:
- `1/x`-reglen før 1. januar 2015, hvor `x` nu er afklaret til at være antal hverdage i måneden
- eventuelle afledte kontroller og forklaringer, hvor SFGG skal bruge hverdagsoptælling uden ferie-/SH-fradrag, når `TAF beregnes som` arbejdsdage

#### 2. Arbejdsdage med fradrag af SH-dage og daterede ferieperioder

Til optælling af arbejdsdage baseret på:
- mandag-fredag
- minus SH-dage
- minus daterede ferieperioder

findes allerede:
- `buildLoenArbejdsdageSet` i `src/domain/erstatningsopgoerelse/periodiseringsMotor.ts`
- `beregnArbejdsdageOgMaaneder` i `src/domain/erstatningsopgoerelse/arbejdsdageMaaneder.ts`
- `optaelArbejdsdageBreakdown` og `optaelArbejdsdage` i `src/domain/erstatningsopgoerelse/periodiseringsMotor.ts`
- wrapperne `calculateTafArbejdsdageBreakdown` og `calculateTafAntalArbejdsdage` i `src/domain/erstatningsopgoerelse/tafCalculations.ts`

Den mest oplagte genbrugsoverflade for SFGG ser ud til at være:
- `buildLoenArbejdsdageSet`, når vi skal kende de faktiske arbejdsdage i en referenceperiode for et ansættelsesforhold
- `optaelArbejdsdageBreakdown` eller `calculateTafArbejdsdageBreakdown`, når SFGG skal bruge samme arbejdsdagsdefinition som EO/TAF i debug og validering

#### 3. SH-dage og daterede ferieperioder

Til opbygning af de faktiske datomængder findes allerede:
- `buildShDageSet`
- `buildShDageSetFromIsoRange`
- `buildFerieDageSet`
- `buildDatoSetInclusiveFromDates`

alle i `src/domain/erstatningsopgoerelse/tafDaySets.ts`.

Det er præcis den type lavniveau-logik, som SFGG bør genbruge i stedet for at indføre nye dato- og kalenderfunktioner.

#### 4. TAF-logik for løse feriedage og fradrag

Til placering og fradrag af løse feriedage findes allerede:
- `placeLoseFeriedage` i `src/domain/erstatningsopgoerelse/tafDaySets.ts`
- `loseFeriedage` som felt på `tafPeriodeRowSchema`
- TAF's eksisterende beregningsflow i `src/domain/erstatningsopgoerelse/tafRowDerived.ts`, `src/domain/erstatningsopgoerelse/tafBeregningsEngine.ts` og `src/domain/erstatningsopgoerelse/tafCalculations.ts`

SFGG skal ikke genbruge TAF's `loseFeriedage`-felt direkte som domæneregel for referenceperioden, fordi SFGG har sin egen indtastning `Evt. ferie- og fraværsdage i perioden uden løn`.

SFGG bør derimod genbruge:
- samme arbejdsdagsdefinition
- samme SH-/dateret ferie-fradrag
- samme fail-closed tilgang ved `0` arbejdsdage

#### 5. Validering af perioder uden arbejdsdage

Der findes allerede EO-logik, som bruger arbejdsdagsberegning til at validere, om en lønperiode indeholder løn men ingen arbejdsdage:
- `buildStandardLoenZeroArbejdsdageIssues`
- `buildStandardLoenZeroArbejdsdageCellErrorMessages`

i `src/domain/erstatningsopgoerelse/indkomstRowValidation.ts`.

Disse er relevante som mønster for SFGG's regel om, at referenceperioden skal give fejl, hvis den efter fradrag ikke indeholder nogen arbejdsdage.

#### 6. TAF-perioder som autoritativ periodisering

Til TAF-perioderne findes allerede:
- `tafPeriodeRowSchema` i schemaet
- `TAFPeriodeTable`
- `useTafRows`
- `buildTafDerived`
- `eoSnapshotToBeregningView`, som eksponerer autoritative `tafPerioder`
- `eoCanonicalOutput.periodiseringer.tafPerioder`

Det betyder, at SFGG ikke skal opfinde en ny separat periodemodel for selve erstatningsforløbet.
SFGG kan og bør læse de committede TAF-perioder som sit primære periodiske beregningsgrundlag.

### Relevante eksisterende inputfelter fra EO/TAF

Ud fra schemaet og de eksisterende EO-komponenter er følgende persisted felter direkte relevante for SFGG.

#### 1. TAF-perioder

Fra `tafSchema` i `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts`:
- `tafPerioder`
- `ferieperioder`
- `sidsteDagAnsaettelsesforhold`

`tafPerioder` er relevante fordi:
- SFGG følger TAF-perioderne
- præ-2015-toggle på `true` skal bruge TAF-perioderne til 4-månedersberegningen
- post-2015-logikken bruger TAF-dage til at afgøre, om første TAF-dag skal udgå

`ferieperioder` er relevante fordi:
- daterede ferieperioder allerede indgår centralt i arbejdsdagsberegningen
- SFGG-referenceperioden skal reducere arbejdsdage med disse dage

`sidsteDagAnsaettelsesforhold` er relevant som allerede eksisterende EO-felt for ophør, men skal læses sammen med ansættelsesforholdenes egne ophørsfelter.

#### 2. Indtægt før skaden / beregningsgrundlag

Fra `indtaegtFoerSkadenSchema`:
- `periodeTilBeregningFra`
- `periodeTilBeregningTil`
- `fravaerPerioder`
- `uspecificeredeFerieFridage`
- `oevrigeFravaersdage`

Disse er ikke i sig selv SFGG-felter, men de er relevante som eksisterende mønstre og datakilder, fordi programmet allerede bruger dem til at beskrive:
- dateret fravær
- øvrigt fravær uden løn
- beregningsperioder

Særligt `fravaerPerioder` er relevant, fordi den samme eksisterende datatype som ferieperioder allerede bruges til fraværsperioder i EO.
Det gør den velegnet, hvis SFGG senere skal bruge en loose grid med særskilt indtastede sygeperioder før 2015.

#### 3. Ansættelsesforhold under lønindkomst

Fra `loenindkomstAnsaettelsesforholdSchema`:
- `id`
- `navnPaaArbejdssted`
- `harOverenskomst`
- `overenskomstId`
- `ansatPaaSkadestidspunktet`
- `ansaettelsesforholdOphoert`
- `sidsteArbejdsdag`
- `loenperiode`
- `indtaegtsoplysningerTableData`
- `fuldLoenUnderFerie`
- `loenPaaHelligdage`
- `loenudviklingBeregningsgrundlag`

Disse felter er centrale for SFGG, fordi de giver:
- identitet pr. ansættelsesforhold via `id`
- kobling mellem lønindkomst og overenskomst via `harOverenskomst` og `overenskomstId`
- ophørsoplysninger via `ansaettelsesforholdOphoert` og `sidsteArbejdsdag`
- faktisk lønindkomst pr. ansættelsesforhold via `indtaegtsoplysningerTableData`
- eksisterende grundlag for reguleringslogik via `loenudviklingBeregningsgrundlag`

Især `indtaegtsoplysningerTableData` er vigtigt for SFGG, fordi:
- referencesatsen skal tage udgangspunkt i beregnede feriepenge fra ansættelsesforholdets referenceperiode
- perioder med arbejdsgiverbetalt sygeløn skal findes ud fra lønindkomst på det konkrete ansættelsesforhold
- 6-månedersadvarslen om muligt stiltiende ophør skal måles pr. ansættelsesforhold på baggrund af sidste indtastede lønindkomst

#### 4. Eksisterende SFGG-felter i schemaet

Der findes allerede et lille `sygeferiegodtgoerelseSchema` i EO-schemaet med felterne:
- `ferieMedLon`
- `maanedsloennetMedFerielon`
- `forstSfgEfterSygelon`
- `andelSfggILoenen`

Disse matcher ikke den nu specificerede SFGG-model.

Den gamle struktur skal betragtes som en legacy-rest og skal slettes ved implementeringen af den nye SFGG-model.

Før sletning skal det kontrolleres, om felterne fortsat bruges noget sted i den eksisterende kode.
Hvis de gør, skal brugen kort identificeres og ryddes op som led i implementeringen.

Det er allerede observeret, at mindst feltet `andelSfggILoenen` aktuelt stadig er eksponeret i EO-oplysninger og i EODebug.
Det betyder, at oprydningen ikke kan behandles som en ren schema-intern detalje.

### Kendte åbne punkter for implementering

Dette afsnit er ikke beslutninger, men de punkter der skal afklares, før implementering kan anses som fuldt specificeret.

- Den præcise danske ordlyd i PDF-tekster og advarsler.
- Den præcise datamodel for de nye SFGG-felter i schemaet, herunder hvordan referenceperiode, eventuel manuel sats, sygelønslogik, allerede betalt SFGG og eventuelle særskilte sygeperioder før 2015 skal persisted.

---

## Afklaringsspørgsmål

Spørgsmålene nedenfor er skrevet som konkrete brugersituationer. Formålet er at lukke de huller, som stadig er åbne, før implementering.

### Resterende spørgsmål

Ingen yderligere åbne domænespørgsmål er registreret på nuværende tidspunkt.
