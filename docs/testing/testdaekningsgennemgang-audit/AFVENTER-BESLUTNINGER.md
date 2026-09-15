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

**Spørgsmål:** Kan du give mig en eller flere gamle `.eo`-filer, så jeg kan kontrollere,
at Mineo stadig viser de samme sagsoplysninger, når filerne åbnes, eller skal jeg bruge
de genskabte eksempler som erstatning?

**Dit svar:**

> Jeg har en række gamle .eo filer liggende. Kan du selv indlæse dem? Bemærk dog, at du under ingen omstændigheder må ændre i dem. De ligger her:
C:\Users\BEL\OneDrive - FH\Verserende sager\Mineo

**Opfølgende spørgsmål:** Ved gennemgangen kunne 10 af de 11 filer åbnes direkte. Én ældre
sag kunne også åbnes, men Mineo viste en advarsel om, at nogle gamle oplysninger blev sat til
standardværdier. Det drejede sig blandt andet om skadesdatoen, som programmet i dag kalder
**skadedato**, samt tre gamle oplysninger om sygeferiegodtgørelse, som ikke længere findes
som selvstændige oplysninger i Mineo. De gamle oplysninger kom ikke fra en brugerændring i
den aktuelle version, men fra den tidligere udgave af Mineo.

Skal denne ene sag fremover åbne direkte uden advarsel, hvor skadesdatoen bevares, og de tre
gamle, forældede oplysninger ikke længere vises som tabte? Eller skal Mineo fortsat vise
advarslen, når en så gammel fil åbnes?

> Der er tale om en enkeltstående sag, der blevet lavet mens programmet stadig var i en intern udviklingsudgave. Ingen eksterne brugere har benyttet programmet på et tidspunkt, som ville gøre denne preflight meddelelse aktuel for dem. Der er ikke behov for kompatibilitet af dette forhold.

## 2. Ydelse i en weekend i en arbejdsdagsbaseret sag (TD-016)

**Det brugeren oplevede før rettelsen:** Mineo viste en advarsel og blokerede dokumentet, selv om
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

**Spørgsmål:** Når en bruger har indtastet en offentlig ydelse, der dækker en lørdag eller
søndag, skal Mineo så vise en tydelig advarsel og forhindre brugeren i at hente opgørelsen,
eller skal brugeren kunne hente opgørelsen, hvor ydelsen indgår i oversigten?

**Dit svar:**

> Jeg mener, at vi havde en lignende problemstilling, når brugeren indtastede lønindkomst i en periode, hvor samtlige af dagene var angivet som feriedage. Vil du undersøge og beskrive, hvad vi gjorde der, så jeg kan vurdere, om samme fremgangsmåde skal bruges her.

**Opfølgende spørgsmål:** Jeg har undersøgt den tilsvarende situation. Når en lønperiode
udelukkende består af feriedage, bevarer Mineo beløbet i opgørelsen, men dagene tæller ikke
som arbejdsdage. Den samme behandling findes allerede for en offentlig ydelse, der kun
dækker en weekend.

Skal brugeren derfor kunne se ydelsen i oversigten og hente dokumentet uden en advarsel
eller blokering, selv om ydelsen kun dækker lørdag og søndag?

> Følg den øvrige praksis fra programmet. Hvis den indebærer, at beløbet medregnes og indgår i beregningen tavst og uden særskilt advarsel eller meddelelse, så gør det samme her. Det eneste, som ikke må ske - hverken her eller nogen af de andre steder, hvor lignende problemer er aktuelle - er at beløbet blot forsvinder tavst.

## 3. Ugyldig dato, der når beregningen (TD-003)

**Det brugeren kan opleve:** Ved almindelig indtastning af en forkert dato bliver feltet
afvist. Fundet handler om en særlig intern situation, hvor en ugyldig dato alligevel
kommer videre. I så fald kan resultatet blive tomt eller ubrugeligt i stedet for en klar
fejl.

**Sådan genskaber du det:** Du kan ikke genskabe dette med almindelige klik eller
indtastninger i Mineo. Du skal derfor ikke prøve at indtaste noget særligt. Punktet er
en intern sikkerhedskontrol, som Codex kan afprøve automatisk, men som ikke er synlig
for en almindelig bruger.

**Spørgsmål:** Hvis en ugyldig dato alligevel skulle nå frem til beregningen, skal Mineo så
stoppe og vise brugeren en tydelig fejl i stedet for at vise et tomt eller ubrugeligt resultat?

**Dit svar:**

> Ja, ugyldige datoer skal afvises, men det er væsentligt, at brugeren får advarsler og fejl om disse på sædvanlig vis, dvs. fx. ved rød ring og tooltip i indtastningsfeltet, som har udløst fejlen, og visning i boksen med Fejl og advarsler med relevant beskrivelse og link til det felt, hvor indtastningen befinder sig, der har forårsaget problemet.

## 4. Gem og Hent, når browserens filvalg ikke virker (TD-017)

**Det brugeren kan opleve:** Når browseren ikke kan bruge sit normale filvalg, skal
Mineo falde tilbage til den almindelige filvælger. Fundet undersøger en sjælden
browsertilstand, hvor browseren ser ud til at kunne bruge det nye filvalg, men ikke
faktisk kan gennemføre det.

**Sådan kontrollerer du det:** Du kan ikke fremkalde denne sjældne situation fra Mineos
normale skærmbilleder. Du skal ikke ændre noget på din computer eller forsøge at gøre
filvalget defekt. Codex har en automatisk kontrol, der efterligner situationen.

**Spørgsmål:** Hvis Mineos normale filvalg ikke virker på brugerens computer, skal Mineo så
automatisk vise et andet filvalg, så brugeren stadig kan gemme eller hente sin sag uden at
møde en fejl?

**Dit svar:**

> Ja. Det er særligt væsenltig for mig, at brugeren ikke kan miste sine indtastninger på grund af en fejl i filvælgeren ved gem. Dette må ikke kunne ske - så rigtig fint, at programmet viser et andet filvalg. Der må også gerne på denne måde være en alternativ visning for hent. Sørg dog i første række for at sikre den ordinære gem/hent-funktionalitet bedst muligt, så den alternative løsning helst aldrig skal blive relevant.

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

**Spørgsmål:** Når en bruger dobbeltklikker på en `.eo`-fil, skal den installerede Mineo-app
så åbne filen, vise forhåndsvisningen og indlæse sagen med alle oplysninger, eller skal
brugeren først åbne Mineo og vælge filen derfra?

**Dit svar:**

> Indlæsning i app'en ved at dobbeltklikke på en .eo-fil fungerer som det skal. Jeg er dog stødt på en problemstilling, hvor brugeren efter installation fravælger i Windows, at .eo-filer fremover skal åbnes i Mineo. Da dukker programmet ikke op på forslagslisten i browseren, hvis brugeren efterfølgende dobbeltklikker på en .eo-fil. Det ved jeg ikke om kan løses i programmet, eller er en problemstilling med Windows' funktionalitet til at vælge standardprogrammer.

**Opfølgende spørgsmål:** Når brugeren aktivt har fjernet Mineo som program til åbning af
`.eo`-filer i Windows, kan Mineo ikke selv sørge for at komme tilbage på Windows’ liste over
foreslåede programmer, før brugeren vælger det igen.

Skal vi acceptere dette som en begrænsning i Windows og eventuelt skrive en kort vejledning
til, hvordan brugeren vælger Mineo igen, eller ønsker du, at vi undersøger en anden løsning?

> Det er en windows-begrænsning. Så du skal ikke gøre mere for at forsøge at løse det.

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

**Spørgsmål:** Når brugeren henter en PDF eller Word-fil, er det så tilstrækkeligt, at de
automatiske kontroller sikrer de rigtige tal og tekster, eller er der et bestemt synligt
forhold – for eksempel tekst, der overlapper, bliver klippet eller får et forkert sideskift
– som du ønsker kontrolleret særskilt?

**Dit svar:**

> Jeg vil have, at så meget kontrol som muligt foretages af automatiske kontroller fra programmets test-funktionaliteter. Hvis jeg skal kontrollere noget manuelt, skal det være helt specifikke enkeltdele, og jeg skal i så fald have helt nøjagtige anvisninger om hvad, og hvordan jeg fremprovokerer de forhold, der skal afprøves manuelt.

## 7. Den faktiske releasekontrol i GitHub Actions (B-002)

**Det brugeren kan opleve:** Den version, der faktisk lægges online, kan i værste fald
opføre sig anderledes end den version, der er testet lokalt. Den lokale kontrol og
workflowets kobling er testet. GitHub Actions-kørsel #284 bestod på `ed6bd4e` med releasegate,
alle 10 E2E-jobs, artefakt og deploy
([workflow](https://github.com/BjornElling/mineo/actions/runs/34855411327)). Kørslen er en
forfader til den lokale `b8a5ab32`, men siden kørslen er kun test- og auditdokumentation ændret;
workflowets og produktionsartefaktets relevante kode er derfor uændret.

**Sådan kontrollerer du det:**

1. Start releasekontrollen for den aktuelle `main`-revision i GitHub Actions.
2. Kontrollér, at den bruger det samme produktionsbuild, som skal lægges online.
3. Kontrollér, at login, navigation og mindst én dokumentdownload gennemføres.
4. Skriv resultatet og linket til workflowkørslen her.

**Spørgsmål:** Skal en ny version kun kunne blive lagt online, når de automatiske kontroller
har vist, at brugerne kan logge ind, navigere og hente dokumenter i netop den version, der
skal offentliggøres – uden at du bagefter skal kontrollere det manuelt?

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

**Spørgsmål:** Skal brugeren altid se præcis det samme rentebeløb på skærmen og i den hentede
PDF og Word-fil – også når beløbet består af flere beregnede rækker? Hvis ja, skal hver række
afrundes til to decimaler, før rækkernes beløb lægges sammen?

**Dit svar:**

> Brugeren skal altid se nøjagtig de samme rentebeløb på skærmen og i pdf'en. Det skal på santlige visninger og dokumenter - ikke bare i renteberegning - være sådan, at når flere beløb vises på skærmen eller i dokumentet med x decimaler, så er det den viste værdi afrundet til x decimaler, der skal indgå i den fremtidige beregning af i alt-beløbet. Jeg mener kun at vi har lavet én bevidst undtagelse i EO omkring regulering af ydelser, .

**Opfølgende spørgsmål:** Skal jeg forstå din beslutning sådan, at alle beløb, der vises
afrundet, også skal bruge den viste afrundede værdi i efterfølgende totaler – både på skærmen
og i PDF- og Word-dokumenter?

Hvad er den præcise undtagelse omkring regulering af ydelser i EO? Skal månedstal fortsat
beregnes med en mere præcis værdi end den, brugeren ser, eller skal månedstal også følge den
viste afrunding?

> Alle beløb, der vises afrundet, skal også bruge den viste afrundede værdi i de efterfølgende totaler. Både på skærmen og i PDF- og Word-dokumenter. Der er vist nok en enkelt undtagelse, som allerede er indarbejdet og som du skal lade stå. Jeg mener, at det er i forhold til beregning af den regulerede månedsløn i EO, hvor der ellers ville kunne opstå situationer, hvor lønnen på beregningstidspunktet fx er 20.000 kr., som derefter ændres til 21.000 kr. men idet regulering sker med procenter med et begrænset antal decimaler, ville der kunne opstå en situation, hvor afrunding medførte, at det opregulerede beløb ikke blev 21.000 kr. Det er dog muligt, at denne ene afvigelse handler om procenttallet for antal decimaler i opreguleringsprocenten og ikke i beregningen af selve beløbet. Find udtagelsen og bevar bare den.

## Opfølgende spørgsmål til TD-156 – manglende reguleringssats

**Det brugeren kan opleve:** Mineo kan opdage to forskellige problemer i de samme
oplysninger om regulering af offentlige ydelser. Brugeren kan derfor enten få vist to
fejlbeskeder eller én samlet forklaring.

**Spørgsmål:** Når Mineo mangler oplysninger om regulering af offentlige ydelser, hvad skal
brugeren så se?

- To separate fejlbeskeder, hvor hver besked forklarer sit eget problem.
- Én samlet fejlbesked, der forklarer, hvilke oplysninger der mangler, og hvad det betyder
  for beregningen.

> Det kommer an på hvad karakteren af fejlene er. Det er svært for mig at bedømme, når du ikke er kommet med konkrete eksempler.

**Konkret eksempel på TD-156:** Brugeren vælger **Ja** til regulering af offentlige
ydelser, indtaster en ydelse på `1.000 kr.` fra `01-01-2027` til `31-12-2027` og har en
erstatningsperiode, der også løber i 2027. Mineo mangler reguleringssatsen for 2027.

I denne situation viser Mineo i dag to fejl på samme valg:

1. `Regulering af offentlige ydelser kan ikke beregnes efter 2026, fordi reguleringssatsen mangler.`
2. `Regulering af offentlige ydelser kan ikke beregnes, fordi der mangler reguleringssats for 2027.`

De to fejl handler her om det samme konkrete problem – at satsen for 2027 mangler.

**Nyt spørgsmål:** Skal brugeren i dette konkrete tilfælde se begge fejl, eller skal de
vises som én samlet fejlbesked, for eksempel:

> Regulering af offentlige ydelser kan ikke beregnes, fordi reguleringssatsen for 2027 mangler. Beregningen kan ikke gennemføres efter 2026.

Hvis svaret afhænger af situationen, bedes du beskrive, hvornår to fejl skal vises hver for
sig, og hvornår de skal samles.

> Hvis der i det væsentligste er tale om fejl, der ligesom det ovenstående eksempel grundlæggende handler om samme problem, skal de samles til én fejlmeddelelse til brugeren.

## Gennemgang af svarene

Svarene er gennemgået 2026-09-15. De følgende punkter er den bindende videre håndtering i
auditten:

| Punkt | Videre håndtering | Status |
| --- | --- | --- |
| TD-001 | De 11 faktiske `.eo`-filer er gennemgået read-only gennem den synlige Hent-funktion. 10 blev indlæst direkte, og 1 viste den eksisterende preflight og blev indlæst efter den eksplicitte bekræftelse. Filerne blev ikke ændret. Den ene fil stammer fra en intern udviklingsudgave, og der indføres derfor ikke yderligere kompatibilitet for netop denne historiske struktur. | Gennemført – ingen produktændring |
| TD-016 | Den fælles fald-tilbage-fordeling bruges nu også i EO-inspektionens kontroltabel. En weekendydelse forsvinder derfor ikke, giver ikke et falsk kontrolbrud og fremgår af den relevante ydelseskolonne. | Implementeret og målrettet testet |
| TD-003 | Den kanoniske `utcDayMath`-grænse skal afvise ugyldige `Date`-instanser straks. Det er et internt fail-closed-værn, som ikke kræver manuel genskabelse og ikke ændrer gyldige datoer. | Gennemført automatisk |
| TD-017 | File System Access API må kun vælges, når begge picker-funktioner faktisk kan kaldes. Ellers bruges den eksisterende almindelige Hent-/Gem-fallback. Det er et internt browserværn uden behov for manuel genskabelse. | Gennemført automatisk |
| TD-022 | Din kontrol accepteres som manuel observation af, at dobbeltklik på en `.eo`-fil virker. Den manglende åbning, når Mineo ikke er valgt som Windows-standardapp, accepteres som en Windows-begrænsning, og der laves ikke yderligere produktændringer for at omgå den. | Accepteret Windows-begrænsning |
| TD-014 / TD-018 | Dokumentkontrol automatiseres så langt programmets testfunktioner kan observere den. Der kræves kun en konkret, afgrænset manuel kontrol, hvis der efter den automatiske gennemgang stadig er et bestemt layoutforhold, som ikke kan måles pålideligt. | Automatiseret først |
| B-002 | Den bindende releasekontrol skal ligge i GitHub Actions og blokere deploy automatisk. De browserprojekter, der ellers kun kører lokalt, kobles derfor også på CI. Kørsel #284 på `ed6bd4e` bestod med releasegate, alle 10 E2E-jobs, artefakt og deploy ([workflow](https://github.com/BjornElling/mineo/actions/runs/34855411327)). Den ene eksterne workflowkørsel kvalificerer rutinen – den er ikke en tilbagevendende manuel releasehandling. | Lukket for den konkrete CI-/artefaktkobling |
| TD-156 | Når flere fejl i samme situation grundlæggende skyldes den samme manglende reguleringssats, samles de til én fejlbesked. Fejl, der skyldes en anden årsag, forbliver særskilte. | Implementeret og målrettet testet |
| TD-043 | Alle afrundede beløb skal bruge den viste afrundede værdi i efterfølgende totaler på skærm, PDF og Word. Den eksisterende særregel for KL-lønaftalers trinvist afrundede, regulerede løn bevares, fordi den sikrer, at fx 20.000 kr. kan ende præcist på den trinvist beregnede 21.000 kr. | Bekræftet – eksisterende undtagelse bevaret |

## 9. Modal-lukning i fejlrapport-preview (TD-088)

**Det brugeren kan opleve:** Efter valg af **Send fejloplysninger** vises et lokalt preview
oven på load-preflighten. Når brugeren vælger **Luk** i previewet, lukkes både previewet og
den underliggende preflight-dialog.

**Observation før beslutningen:** Det blev set i Chrome under
`td-034-file-load-preflight-report.spec.ts`. E2E-testen fastlåser nu beslutningen nedenfor:
begge dialoger skal være lukkede efter **Luk**.

**Spørgsmål:** Når brugeren lukker forhåndsvisningen af fejlrapporten, skal brugeren så
komme tilbage til vinduet, hvor den valgte fil stadig kan godkendes eller afvises, eller
skal begge vinduer lukkes, så brugeren er tilbage ved den nuværende sag?

**Dit svar:**

> Luk skal lukke begge. Det er tilsigtet og korrekt adfærd.

| TD-088 | Fejlrapport-previewets **Luk** lukker både previewet og den underliggende preflight-dialog, som ønsket. E2E-testen fastlåser begge dialoger som skjulte bagefter. | Lukket med test |

## 10. Refererede chunks i standalone-buildets manifest (TD-292)

**Det mulige brugerproblem:** En standalone-build kan passere den isolerede artifact-verifier,
selv om en PDF-/Word-chunk, som manifestet refererer til gennem `file`, `imports` eller
`dynamicImports`, mangler i buildmappen. Fejlen vil først vise sig, når brugeren åbner det
berørte dokumentforløb.

**Read-only-observation før rettelsen:** `scripts/verify-build-artifacts.mjs` kontrollerede for
MinProcesrente manifestets nøgler og `src`, standalone-entryen og forbudte Mineo-kilder.
Det aktuelle `dist/minprocesrente/.vite/manifest.json` indeholder også `file`, `imports` og
`dynamicImports`. `verifyMinprocesrenteBuildArtifacts.test.ts` dækker i dag kun entry og
Mineo-entryforbud.

**Spørgsmål:** Skal en ny version af MinProcesrente kun kunne blive lagt online, hvis alle
funktioner til at hente PDF- og Word-filer faktisk er til stede og kan åbnes, så brugeren
ikke først opdager en manglende del, når netop den funktion vælges?

**Dit svar:**

> Ja

| TD-292 | Standalone-artifact-verifieren kontrollerer nu, at alle manifestentries har en eksisterende `file`, og at alle `imports`-/`dynamicImports`-referencer peger på eksisterende manifestentries. Der er også negative kvalitetstests for manglende filer og ukendte referencer. | Implementeret og målrettet testet |

## Notat

Andre åbne auditposter er ikke medtaget her, fordi de enten er løbende testarbejde,
vedligeholdelse eller kræver teknisk opfølgning uden et valg fra dig.
