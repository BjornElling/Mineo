# Beslutningsark – udviklerens svar og videre håndtering

Udviklerens svar står direkte under hvert spørgsmål. Koderelaterede forhold, som ikke kan
genskabes gennem Mineos skærmbilleder, afgøres strukturelt ud fra den eksisterende arkitektur.
Punkter, der kræver faktiske filer, en konkret brugerobservation eller et domænevalg, bliver
ikke afgjort ved gæt.

## 1. Genskabelse af gamle sagsfiler (TD-001)

**Det brugeren kan opleve:** En bruger åbner en gammel, tidligere gemt `.eo`-fil. Vi skal
kunne vide, at alle oplysninger stadig er der, og at Mineo ikke pludselig viser en ny
advarsel eller beder om en anden handling.

**Sådan genskaber du det:**

1. Find en `.eo`-fil, som er gemt fra en tidligere offentlig version af Mineo.
2. Åbn Mineo, gå til **Stamdata**, og vælg **Hent**.
3. Vælg filen, gennemgå forhåndsvisningen, og vælg at indlæse den.
4. Kontrollér, at sagens oplysninger og de vigtigste beregningsfelter er uændrede.

**Spørgsmål:** Kan du give mig en eller flere faktiske gamle `.eo`-filer til kontrollen,
eller accepterer du, at de genskabte eksempler i auditten bruges som erstatning?

**Dit svar:**

> Jeg har en række gamle .eo filer liggende. Sig til, når jeg skal give dig dem.

## 2. Ydelse i en weekend i en arbejdsdagsbaseret sag (TD-016)

**Det brugeren kan opleve:** Mineo viser en advarsel og blokerer dokumentet, selv om
brugeren har indtastet en ydelse, der dækker en weekend. Der vises ikke en tilsvarende
ydelseskolonne i kontroltabellen.

**Sådan genskaber du det i Mineo:**

1. Log ind, og gå til **Stamdata**. Udfyld de nødvendige felter med gyldige værdier.
2. Udfyld **Stamdata** sådan:
   - **Journalnr.**: `TD-016`
   - **Skadelidtes navn**: `Fiktiv skadelidt`
   - **Skadestype**: `Arbejdsulykke`
   - **Fødselsdato**: `01-01-1980`
   - **Skadedato**: `01-01-2022`
3. Gå til **Erstatningsopgørelse** og fanen **EO-oplysninger**. Udfyld:
   - **Opgørelse lavet den**: `01-02-2022`
   - **Krav på svie- og smertegodtgørelse**: `Nej`
   - **Er der krav på tabt arbejdsfortjeneste i erstatningsperioden**: `Ja`
   - **Krav på øvrige erstatningskrav**: `Nej`
   - **Vedrører periode fra**: `01-07-2024`
   - **til og med**: `31-07-2024`
4. Find afsnittet **Indtægt før skaden**. Vælg **Angivet dagsløn** ved
   **Beregnes ud fra**, og skriv `1.000` ved **Dagslønnen udgør**. Udfyld ikke en
   beregningsperiode – de felter skal være skjult i dette valg.
5. Find tabellen **Tabt arbejdsfortjeneste**. Skriv `01-07-2024` i **Fra o.m.**
   og `07-07-2024` i **Til o.m.** i den første række. Lad **Løse feriedage** stå tomt.
6. Gå til fanen **Offentlige ydelser**. Udfyld den første række sådan:
   - **Fra dato**: `06-07-2024`
   - **Til dato**: `07-07-2024`
   - **Ydelse**: `2.000`
   - **Ydelsestype**: `Sygedagpenge`
7. Gå til fanen **Beregning**, og se på kontroltabellen og knappen til at hente
   opgørelsen.

**Spørgsmål:** Er det korrekt, at Mineo viser advarslen og blokerer dokumentet i denne
situation, eller skal ydelsen vises og behandles på en anden måde?

**Dit svar:**

> Dit eksempel giver ingen mening. Dels mangler du at give mig specifikke anvisninger om, hvad jeg skal indtaste i flere felter - og derudover beder du mig indtaste en beregningsperiode, efter jeg har valgt, at beregningsgrundlaget er angivet dagsløn, hvilket ikke er muligt, siden rækken med beregningsperiode bliver skjult i det tilfælde. Giv mig bedre instruktioner.

## 3. Ugyldig dato, der når beregningen (TD-003)

**Det brugeren kan opleve:** Ved almindelig indtastning af en forkert dato bliver feltet
afvist. Fundet handler om en særlig intern situation, hvor en ugyldig dato alligevel
kommer videre. I så fald kan resultatet blive tomt eller ubrugeligt i stedet for en klar
fejl.

**Sådan genskaber du det:** Du kan ikke genskabe dette med almindelige klik eller
indtastninger i Mineo. Du skal derfor ikke prøve at indtaste noget særligt. Punktet er
en intern sikkerhedskontrol, som Codex kan afprøve automatisk, men som ikke er synlig
for en almindelig bruger.

**Spørgsmål:** Skal vi også beskytte denne usynlige situation særskilt, eller er det
tilstrækkeligt, at Mineo allerede afviser forkerte datoer i den almindelige formular?

**Dit svar:**

> Dit spørgsmål giver ingen mening. Du beder mig forholde mig til en situation, du hverken specificerer, og som jeg ikke kan fremkalde.

## 4. Gem og Hent, når browserens filvalg ikke virker (TD-017)

**Det brugeren kan opleve:** Når browseren ikke kan bruge sit normale filvalg, skal
Mineo falde tilbage til den almindelige filvælger. Fundet undersøger en sjælden
browsertilstand, hvor browseren ser ud til at kunne bruge det nye filvalg, men ikke
faktisk kan gennemføre det.

**Sådan kontrollerer du det:** Du kan ikke fremkalde denne sjældne situation fra Mineos
normale skærmbilleder. Du skal ikke ændre noget på din computer eller forsøge at gøre
filvalget defekt. Codex har en automatisk kontrol, der efterligner situationen.

**Spørgsmål:** Er det acceptabelt, at den automatiske kontrol er den eneste kontrol af
denne sjældne situation, eller skal punktet stå åbent, indtil det kan prøves på en
konkret computer?

**Dit svar:**

> Det har jeg ingen forudsætninger for at besvare. Du kan ikke give mig en måde at fremprovokere situationen på, så jeg ved rent ud sagt ikke, hvad det er, jeg skal forholde mig til.

## 5. Åbning af en fil i den installerede Mineo-app (TD-022)

**Det brugeren kan opleve:** En bruger installerer Mineo som en app på computeren og
forventer, at en `.eo`-fil kan åbnes i den installerede app. Denne del er endnu ikke
kontrolleret på en rigtig desktopinstallation.

**Sådan kontrollerer du det:**

1. Åbn Mineo i Chrome eller Edge på en computer.
2. Installér Mineo som app fra browserens menu.
3. Gem en lille test-sag som `.eo`-fil, og luk den installerede app.
4. Åbn `.eo`-filen fra computerens filhåndtering med Mineo-appen.
5. Kontrollér, at Mineo åbner filen, viser forhåndsvisningen, og indlæser sagen uden
   at oplysninger mangler.

**Spørgsmål:** Kan du udføre denne kontrol og skrive operativsystem, browser og resultat
her, eller skal denne del accepteres som en resterende manuel kontrol?

**Dit svar:**

> Indlæsning i app'en ved at dobbeltklikke på en .eo-fil fungerer som det skal.

## 6. Fysisk kontrol af PDF- og Word-dokumenter (TD-014 og TD-018)

**Det brugeren kan opleve:** Et dokument kan godt indeholde de rigtige ord og tal, men
stadig se forkert ud på skærmen – for eksempel med tekst, der ligger oven i hinanden,
bliver klippet, eller skifter uhensigtsmæssigt mellem sider.

**Sådan kontrollerer du det:**

1. Opret gyldige testsager for **Satser**, **Årsløn**, **Renteberegning**,
   **Erstatningsopgørelse**, **EET**, **Varige mén** og **Forsørgertab**.
2. Hent både PDF og Word for hver sag.
3. Åbn filerne i de programmer, brugerne normalt anvender.
4. Kontrollér overskrifter, tabeller, tal, sideskift og at ingen tekst mangler eller
   overlapper.

**Spørgsmål:** Vil du udføre denne manuelle kontrol, eller accepterer du den nuværende
automatiske kontrol af dokumenternes indhold som tilstrækkelig for denne gennemgang?

**Dit svar:**

> Jeg vil have, at så meget kontrol som muligt foretages af automatiske kontroller fra programmets test-funktionaliteter. Hvis jeg skal kontrollere noget manuelt, skal det være helt specifikke enkeltdele, og jeg skal i så fald have helt nøjagtige anvisninger om hvad, og hvordan jeg fremprovokerer de forhold, der skal afprøves manuelt.

## 7. Den faktiske releasekontrol i GitHub Actions (B-002)

**Det brugeren kan opleve:** Den version, der faktisk lægges online, kan i værste fald
opføre sig anderledes end den version, der er testet lokalt. Den lokale kontrol og
workflowets kobling er testet, men en rigtig GitHub Actions-kørsel mangler.

**Sådan kontrollerer du det:**

1. Start releasekontrollen for den aktuelle `main`-revision i GitHub Actions.
2. Kontrollér, at den bruger det samme produktionsbuild, som skal lægges online.
3. Kontrollér, at login, navigation og mindst én dokumentdownload gennemføres.
4. Skriv resultatet og linket til workflowkørslen her.

**Spørgsmål:** Kan du køre denne releasekontrol, eller accepterer du den lokale kontrol
og den statiske gennemgang af workflowet som tilstrækkelig dokumentation?

**Dit svar:**

> Jeg vil ikke være afhængig af at skulle lave manuel releasekontrol efter at have pushet en ny version til github, som derefter bliver deployet. Det skal sikres gennem programmets funktionaliteter og rutiner, at alt virker, som det skal.

## 8. Én øre forskel mellem renteberegning og PDF (TD-043)

**Det brugeren oplevede før rettelsen:** Mineo viste `94,95 kr.` i renteberegningen, men
den hentede PDF viste `94,94 kr.` for den samme sag. Det kunne give tvivl om, hvilket
beløb brugeren skulle stole på.

**Sådan genskaber du det i Mineo:**

1. Log ind, og gå til **Renteberegning**.
2. Sæt **Beregningsdato** til **02-07-2024**.
3. Sæt beløbet i den første række til `100.000` kr.
4. Sæt **Forfaldsdato** til **30-06-2024**.
5. Notér beløbet, som Mineo viser i rækken.
6. Hent rækkens PDF-specifikation, og sammenlign det samlede rentebeløb i PDF'en med
   beløbet i Mineo.

**Spørgsmål:** Skal begge steder vise samme beløb? Hvis ja, skal skærmen følge den samme
afrunding pr. beregnet række som PDF'en, eller skal begge steder bruge en anden fælles
afrunding?

**Dit svar:**

> Du kan ikke bare bede mig forholde mig til magic numbers på den måde. Du må forklare, hvad der er årsagen til de forskellige beløb, og bede mig forholde mig til hvilken af de to forskellige fremgangsmåder, jeg vil have. Der skal dog altid (!!) være samme værdi vist på skærmen, som i pdf'en. jeg formoder, at forskellen her skyldes, at pdf'en afrunder til to decimaler for hver beregnet række. det er den korrekte fremgangsmåde, som også skal anvendes i visningen på skærmen. De viste værdier skal altid være identiske med værdierne i pdf'en.

## Gennemgang af svarene

Svarene er gennemgået 2026-09-12. De følgende punkter er den bindende videre håndtering i
auditten:

| Punkt | Videre håndtering | Status |
| --- | --- | --- |
| TD-001 | De gamle `.eo`-filer skal leveres som lokale kopier, når provenienskontrollen gennemføres. Auditten gætter ikke på filernes historik. | Afventer faktiske filer |
| TD-016 | Reproduktionstrinnene ovenfor er rettet, så de følger den valgte dagsløn og ikke beder om skjulte felter. Dit svar tager stilling til instruktionerne, men ikke til om advarslen og blokeringen er korrekt. Punktet afventer derfor selve observationen og det efterfølgende domænevalg. | Afventer brugerobservation og domænevalg |
| TD-003 | Den kanoniske `utcDayMath`-grænse skal afvise ugyldige `Date`-instanser straks. Det er et internt fail-closed-værn, som ikke kræver manuel genskabelse og ikke ændrer gyldige datoer. | Gennemført automatisk |
| TD-017 | File System Access API må kun vælges, når begge picker-funktioner faktisk kan kaldes. Ellers bruges den eksisterende almindelige Hent-/Gem-fallback. Det er et internt browserværn uden behov for manuel genskabelse. | Gennemført automatisk |
| TD-022 | Din kontrol accepteres som manuel observation af, at dobbeltklik på en `.eo`-fil virker. OS, browser og uafhængigt artefaktbevis mangler fortsat, så den bredere platformskontrol står delvist åben. | Delvist dokumenteret |
| TD-014 / TD-018 | Dokumentkontrol automatiseres så langt programmets testfunktioner kan observere den. Der kræves kun en konkret, afgrænset manuel kontrol, hvis der efter den automatiske gennemgang stadig er et bestemt layoutforhold, som ikke kan måles pålideligt. | Automatiseret først |
| B-002 | Den bindende releasekontrol skal ligge i GitHub Actions og blokere deploy automatisk. De browserprojekter, der ellers kun kører lokalt, kobles derfor også på CI. En enkelt ekstern workflowkørsel bruges kun til at kvalificere rutinen – ikke som en tilbagevendende manuel releasehandling. | Automatisk kontrol udvidet |
| TD-043 | Hver synlig renteberegningsrække afrundes til to decimaler, og de afrundede rækkebeløb summeres. Skærm, PDF og Word skal derfor vise samme beløb – i det dokumenterede eksempel `94,94 kr.` | Gennemført automatisk |

## Notat

Andre åbne auditposter er ikke medtaget her, fordi de enten er løbende testarbejde,
vedligeholdelse eller kræver teknisk opfølgning uden et valg fra dig.
