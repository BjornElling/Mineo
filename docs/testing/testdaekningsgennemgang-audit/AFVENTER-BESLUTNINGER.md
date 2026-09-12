# Beslutninger, der afventer dig

Skriv dit svar direkte under hvert spørgsmål. Punkterne er de fund, hvor næste skridt
kræver dit valg eller en konkret kontrol, som kun du kan udføre.

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

> Skriv her.

## 2. Ydelse i en weekend i en arbejdsdagsbaseret sag (TD-016)

**Det brugeren kan opleve:** Mineo viser en advarsel og blokerer dokumentet, selv om
brugeren har indtastet en ydelse, der dækker en weekend. Der vises ikke en tilsvarende
ydelseskolonne i kontroltabellen.

**Sådan genskaber du det i Mineo:**

1. Log ind, og gå til **Stamdata**. Udfyld de nødvendige felter med gyldige værdier.
2. Gå til **Erstatningsopgørelse**.
3. Vælg **Ja** til tabt arbejdsfortjeneste, og vælg **Angivet dagsløn**.
4. Skriv `1.000` i dagslønnen.
5. Sæt den relevante periode til **01-07-2024 – 31-07-2024** og
   beregningsperioden til **01-07-2024 – 07-07-2024**.
6. Opret en TAF-periode med samme uge.
7. Under **Offentlige ydelser** opretter du en **Sygedagpenge**-række fra
   **06-07-2024** til **07-07-2024** på `2.000` kr.
8. Gå til **Beregning**, og se på kontroltabellen og dokumentknappen.

**Spørgsmål:** Er det korrekt, at Mineo viser advarslen og blokerer dokumentet i denne
situation, eller skal ydelsen vises og behandles på en anden måde?

**Dit svar:**

> Skriv her.

## 3. Ugyldig dato, der når beregningen (TD-003)

**Det brugeren kan opleve:** Ved almindelig indtastning af en forkert dato bliver feltet
afvist. Fundet handler om en særlig intern situation, hvor en ugyldig dato alligevel
kommer videre. I så fald kan resultatet blive tomt eller ubrugeligt i stedet for en klar
fejl.

**Sådan genskaber du det:** Det kan ikke fremkaldes med almindelige klik i Mineo. Den
almindelige formular afviser datoen først. Det kræver en særlig testkørsel, hvor en
ugyldig dato sendes direkte ind i datoberegningen.

**Spørgsmål:** Skal Mineo også afvise datoen tydeligt i denne særlige situation, eller er
det tilstrækkeligt, at den almindelige formular allerede stopper den?

**Dit svar:**

> Skriv her.

## 4. Gem og Hent, når browserens filvalg ikke virker (TD-017)

**Det brugeren kan opleve:** Når browseren ikke kan bruge sit normale filvalg, skal
Mineo falde tilbage til den almindelige filvælger. Fundet undersøger en sjælden
browsertilstand, hvor browseren ser ud til at kunne bruge det nye filvalg, men ikke
faktisk kan gennemføre det.

**Sådan genskaber du det:** Det kan ikke fremkaldes med en almindelig browser alene.
Det kræver en særlig testopsætning, der gør browserens filvalg ubrugeligt. Klik derefter
på **Gem** eller **Hent**, og se om Mineo viser den almindelige filvælger eller en fejl.

**Spørgsmål:** Er den nuværende håndtering af denne sjældne browsertilstand acceptabel,
eller skal Mineo have en anden fallback eller fejlbesked?

**Dit svar:**

> Skriv her.

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

> Skriv her.

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

> Skriv her.

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

> Skriv her.

## Notat

Andre åbne auditposter er ikke medtaget her, fordi de enten er løbende testarbejde,
vedligeholdelse eller kræver teknisk opfølgning uden et valg fra dig.
