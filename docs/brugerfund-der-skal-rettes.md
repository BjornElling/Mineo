# Brugerfund

Arbejdslisten bruges til konstaterede fejl og konkrete forbedringsønsker fra brugertest. Ét fund pr. ID.
Beskriv den oplevede adfærd; agenten ejer teknisk analyse, implementeringsplan og statusopdatering.

## Nye fund

Næste ID: **BF-052**. Kopiér denne blok pr. fund:

```md
## BF-028 — Kort titel

- Type: Fejl | Forbedring
- Sted: Side, fane og felt/tabel/knap
- Sådan fremprovokeres det:
  1. …
  2. …
- Det sker: …
- Det bør ske: …
- Eksempel/data: …
- Prioritet: Kritisk | Høj | Mellem | Lav
- Status: Ny
```

Udelad punkter, der ikke er relevante. Medtag gerne præcis synlig tekst og screenshot. Skriv altid, hvis fundet
kan påvirke beregnede tal, gemte data eller dokumenter. Agenten flytter rettede fund til den korte log nedenfor.

## Afventer reproduktion

Ingen fund afventer reproduktion.

## Rettet — kort log

| ID | Kort resultat |
|---|---|
| BF-001 | Manuel lønregulering bruger og låser den korrekte basisdato. |
| BF-002 | Manglende sidste arbejdsdag giver en linket, ikke-blokerende advarsel. |
| BF-003 | Felt- og tabeltypografi har entydige kontrolfarver og korrekt justering. |
| BF-004 | Offentlige ydelser bruger lønindkomsttabellens 13 px-typografi. |
| BF-005 | Placeholder-rækkens identitet er nu en ren funktion af de committede rækker, så undo/redo altid genfinder fokusfeltet. |
| BF-006 | Valg af tillægstidsenhed opretter ikke en ekstra rentekravsrække. |
| BF-007 | Offentlige ydelser-dropdown kan ryddes uden systemfejl. |
| BF-008 | Licensmodalen ombryder teksten og holder scroll i tekstområdet. |
| BF-009 | Manglende beløb i en udfyldt årslønsperiode markeres og blokerer korrekt. |
| BF-010 | SH-perioder sammenlægges, pluraliseres og listeformateres korrekt. |
| BF-011 | Forsørgertab klassificerer manglende forudsætninger korrekt og linker til Stamdata. |
| BF-012 | Varige mén kræver beregningsdato på eller efter skadesdato. |
| BF-013 | Bounds-/regelfejl viser konkret tekst; format-/schemafejl bruger generisk tekst. |
| BF-014 | Tooltips har fælles bredde, venstrestilling og naturlig ordombrydning. |
| BF-015 | Forsørgertabs dokumentgate og feltadvarsler følger de aftalte regler. |
| BF-016 | Gule feltadvarsler har altid tooltip og blokerer aldrig. |
| BF-017 | Méngrad på 5 % giver den aftalte gule feltadvarsel. |
| BF-018 | Tillægstid accepterer højst to cifre ved tastning og markerer øvrigt input korrekt. |
| BF-019 | EET-procenter under 15 % giver den aftalte gule feltadvarsel. |
| BF-020 | Den røde blinkmarkering er løftet ud af Årslønssidens løntabel til én delt mekanisme, enhver flade arver. |
| BF-021 | Interne fejl-/advarselslinks fører nu til feltet OG blinkmarkerer det; samme markering bruges af et blokeret Gem. |
| BF-022 | "Offentlige ydelser i beregningsperioden reguleres" er flyttet til Offentlige ydelser-fanen, under Midlertidigt EET-togglen. |
| BF-023 | Ydelsestype-dropdownen sorteres alfabetisk inden for hver af de to grupper; rækkefølgen ejes af registeret. |
| BF-024 | PDF-dokumenterede tabeller, der kun vedrører skader før 2005, er fjernet; blandede tabeller med dækning fra 2005 er bevaret. |
| BF-025 | Angivet måneds-/timeløn på en ny sag udløser ikke længere en systemfejl; "en ny sags default" har fået ét sandt sted, og tre værn dækker klassen. |
| BF-026 | Den bare bindestreg på linjen med "Tilgængelige reguleringssatser" er væk — et ukendt interval viser nu ingenting. |
| BF-027 | Standardværdier fra Indstillinger slår nu igennem på en ny sag med det samme — ikke først når brugeren rører feltet. |

## BF-028 — Til-dato før fra-dato giver ingen feltfejl

- Type: Fejl
- Sted: Erstatningsopgørelse → Offentlige ydelser, til-dato i en tabelrække
- Sådan fremprovokeres det:
  1. Indtast en fra-dato i en række.
  2. Indtast en til-dato, der ligger før fra-datoen.
- Det sker: Værdien kan afsluttes uden rød ring og tooltip-fejlmeddelelse i til-dato-feltet.
- Det bør ske: Både til-dato- og fra-dato-feltet skal markeres med rød ring og hver vise en konkret tooltip med den modgående dato, når til-datoen ligger før fra-datoen.
- Påvirkning: Den ugyldige periode kan påvirke validering, beregning og dokumentgrundlag.
- Prioritet: Høj
- Status: Ny

## BF-048 — Manglende gul advarsel ved manglende midlertidig EET-dato

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → `Dato for første midlertidige erhvervsevnetabsafgørelse` og `Virkningsdato (hvis forskellig fra afgørelsesdatoen)`
- Sådan fremprovokeres det:
  1. Sæt `Midlertidigt EET-afgørelse` til `Ja`.
  2. Lad både afgørelsesdatoen og virkningsdatoen stå tomme.
  3. Gå til Beregning-siden.
- Det sker: Der vises ikke den forventede samlede advarsel om, at der mangler en dato.
- Det bør ske: Der skal vises en ikke-blokerende gul advarsel på Beregning-siden, når begge datoer mangler. Ingen af de to felter skal få rød ring alene på grund af den manglende værdi.
- Påvirkning: Brugeren mangler en tydelig påmindelse om den ufuldstændige midlertidige EET-oplysning, uden at forholdet skal blokere beregningen.
- Prioritet: Mellem
- Status: Ny

## BF-029 — Datoindtastning begrænser ikke datoens dele korrekt

- Type: Fejl
- Sted: Alle dato-inputfelter, herunder datoceller i tabeller
- Sådan fremprovokeres det:
  1. Åbn et dato-felt.
  2. Indtast eksempelvis `12-2----------`.
- Det sker: Feltet kan acceptere gentagne bindestreger og for mange cifre i dag, måned og år, eksempelvis `12-2----------` og `111-111-2026`.
- Det bør ske: Indtastningen skal behandles tegn for tegn. Punktum, mellemrum, skråstreg og tilsvarende separatorer skal først omdannes til bindestreg. Derefter må der højst være én bindestreg mellem datoens dele, højst to cifre i dag og måned samt højst fire cifre i år. Tegn, der overskrider disse grænser, skal springes over, mens resten af indtastningen fortsætter. `12-2----------2026` skal derfor behandles som `12-2-2026`.
- Prioritet: Mellem
- Status: Ny

## BF-030 — Tomme tabelrækker ryddes ikke automatisk

- Type: Fejl
- Sted: Erstatningsopgørelse → Offentlige ydelser, tabelrækker
- Sådan fremprovokeres det:
  1. Udfyld første række med fra-dato `12-01-2026`, til-dato `25-01-2026`, beløb `12345` og ydelsen `Efterløn`.
  2. Udfyld anden række med fra-dato `26-01-2026` og den fejlbehæftede til-dato `06-02`.
  3. Udfyld tredje række med fra-dato `07-02-2026` og til-dato `13-02-2026`.
  4. Slet først til-datoen og derefter fra-datoen i anden række.
  5. Slet derefter indholdet i tredje række.
- Det sker: Den tomme anden række bliver stående mellem udfyldte rækker, og den tredje række slettes heller ikke, når den tømmes. Den obligatoriske tomme trailing-række står efterfølgende også i tabellen.
- Det bør ske: En række uden indhold skal automatisk fjernes, mens rækkefølgen på de øvrige rækker bevares, og der kun står den obligatoriske tomme trailing-række tilbage til ny indtastning.
- Påvirkning: Tomme eller resterende rækker kan påvirke brugerens overblik, rækkeidentitet og eventuelt validering, beregning eller dokumentgrundlag.
- Prioritet: Høj
- Status: Ny

## BF-031 — Kronologifejl vises ikke stabilt i dato-par

- Type: Fejl
- Sted: Dato-par med fra-dato og til-dato, herunder almindelige dato-felter og datoceller
- Sådan fremprovokeres det:
  1. Indtast en fra-dato.
  2. Indtast en til-dato, der ligger før fra-datoen.
  3. Afslut begge felter.
- Det sker: Der vises ikke pålideligt rød ring og fejl-tooltip i de berørte felter. I nogle tilfælde vises ingen fejlmeddelelse overhovedet.
- Det bør ske: Den fælles kronologivalidering skal altid markere både fra-dato og til-dato rødt og vise den konkrete modgående dato i hver tooltip.
- Påvirkning: En ugyldig periode kan blive stående uden synlig feedback og dermed påvirke validering, beregning og dokumentgrundlag.
- Prioritet: Høj
- Status: Ny

## BF-032 — Ydelse-feltet tillader eller fortolker forbudte tegn

- Type: Fejl
- Sted: Erstatningsopgørelse → Offentlige ydelser, `Ydelse` og `Tillæg`
- Sådan fremprovokeres det:
  1. Åbn `Ydelse`-feltet.
  2. Indtast et mellemrum eller indsæt et beløb med punktum som separator.
- Det sker: Den almindelige indtastningsfilter tillader mellemrum i feltet, og paste-normaliseringen fortolker punktum som en beløbsseparator i stedet for at behandle punktum som et ikke-tilladt tegn.
- Det bør ske: Feltet må kun acceptere cifre, komma, matematiske operatorer og parenteser. Mellemrum, punktum og øvrige tegn må ikke kunne indtastes. Ved paste skal sådanne tegn springes over tegn for tegn og aldrig omdannes eller fortolkes som beløbsformat.
- Påvirkning: Den faktiske indtastningsbegrænsning og paste-adfærden afviger fra den ønskede brugerregel.
- Prioritet: Høj
- Status: Ny

## BF-033 — Valg-dropdowns kræver forkert præcision ved paste

- Type: Fejl
- Sted: Dropdown-felter, herunder Erstatningsopgørelse → Offentlige ydelser, `Ydelsestype`, og EO oplysninger, `Helbredsforhold`
- Sådan fremprovokeres det:
  1. Markér eller kopier en valgmulighed, eksempelvis `Efterløn` eller `Sygemeldt`.
  2. Paste teksten som `efterløn`/`sygemeldt` eller med indledende/afsluttende mellemrum.
- Det sker: Paste-matchningen kræver aktuelt præcis samme store/små bogstaver og samme mellemrum som den viste label.
- Det bør ske: Paste skal vælge ved fuldt label-match efter trimning og uden forskel på store og små bogstaver. Delvise eller ukendte labels skal fortsat give no-op uden at ændre det eksisterende valg.
- Påvirkning: En gyldig valgmulighed fra eksempelvis en tekstkilde kan ignoreres, selv om den semantisk matcher den viste valgmulighed.
- Prioritet: Mellem
- Status: Ny

## BF-034 — Hjælpe-datoer til sygedagpenge følger ikke datofeltets regler

- Type: Fejl
- Sted: Erstatningsopgørelse → Offentlige ydelser → Indsæt maksimal sygedagpengesats for perioden, Fra-dato og Til-dato
- Sådan fremprovokeres det:
  1. Åbn et af hjælpe-datofelterne.
  2. Indtast eller indsæt en værdi med for mange cifre, gentagne separatorer eller andre ugyldige tegn.
  3. Indtast eventuelt en korrekt formateret dato uden for feltets aktive grænse.
- Det sker: Hjælpe-datofelterne har ikke samme tegnfilter eller paste-normalisering som de almindelige datofelter. Bounds behandles desuden som en afvisning ved commit i stedet for som en bevaret værdi med afledt rød feltfejl.
- Det bør ske: Begge hjælpe-datofelter skal følge den almindelige datofeltmotor tegn for tegn ved tastning og paste. En korrekt formateret dato uden for range skal bevares, markeres rødt med konkret tooltip og holde `Indsæt` disabled.
- Påvirkning: Den samme datoindtastning kan opføre sig forskelligt afhængigt af, om den bruges i tabellen eller i hjælpefunktionen, og brugeren kan få en anden værdi-/fejltilstand end forventet.
- Prioritet: Høj
- Status: Ny

## BF-035 — Kommentar-feltet mangler maksimumslængde

- Type: Fejl
- Sted: Erstatningsopgørelse → Offentlige ydelser → Kommentarer
- Sådan fremprovokeres det:
  1. Åbn feltet `Kommentarer`.
  2. Indtast eller indsæt mere end 512 tegn.
- Det sker: Feltet har aktuelt ingen maksimumslængde og kan derfor modtage flere end 512 tegn.
- Det bør ske: Feltet skal højst kunne indeholde 512 tegn. Ved almindelig indtastning skal tegn efter grænsen afvises. Ved paste skal teksten behandles tegn for tegn som almindelig indtastning, så de første 512 tegn indsættes, og efterfølgende tegn springes over.
- Påvirkning: Kommentarindhold kan få ubegrænset længde og dermed afvige fra den ønskede inputbegrænsning.
- Prioritet: Mellem
- Status: Ny

## BF-036 — EO-nummer mangler maksimumslængde

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Erstatningsopgørelse → Nummer
- Sådan fremprovokeres det:
  1. Åbn feltet `Nummer`.
  2. Indtast eller indsæt mere end 7 tegn.
- Det sker: Feltet har aktuelt ingen maksimumslængde og kan derfor modtage flere end 7 tegn.
- Det bør ske: Feltet skal acceptere alle tegn, men højst 7 tegn samlet. Ved almindelig indtastning skal tegn efter grænsen afvises. Ved paste skal teksten behandles tegn for tegn som almindelig indtastning, så kun de første 7 tegn indsættes.
- Påvirkning: EO-nummeret kan få en længde, der afviger fra den ønskede inputbegrænsning.
- Prioritet: Mellem
- Status: Ny

## BF-037 — Ledsagetekst mangler maksimumslængde

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Erstatningsopgørelse → `+ evt. ledsagetekst`
- Sådan fremprovokeres det:
  1. Åbn feltet `+ evt. ledsagetekst`.
  2. Indtast eller indsæt mere end 64 tegn.
- Det sker: Feltet har aktuelt ingen maksimumslængde og kan derfor modtage flere end 64 tegn.
- Det bør ske: Feltet skal acceptere alle tegn, men højst 64 tegn samlet. Ved almindelig indtastning skal tegn efter grænsen afvises. Ved paste skal teksten behandles tegn for tegn som almindelig indtastning, så kun de første 64 tegn indsættes.
- Påvirkning: Ledsageteksten kan få en længde, der afviger fra den ønskede inputbegrænsning.
- Prioritet: Mellem
- Status: Ny

## BF-038 — Indsæt dags dato kan ikke bruges fra tastaturet

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → `Opgørelse lavet den` → knappen `Indsæt dags dato`
- Sådan fremprovokeres det:
  1. Navigér gennem siden med Tab.
  2. Forsøg at nå eller aktivere knappen `Indsæt dags dato` med tastaturet.
- Det sker: Knappen er udeladt af Tab-rækkefølgen (`tabIndex={-1}`) og har ingen tastaturaktivering.
- Det bør ske: Knappen skal indgå i den almindelige Tab-rækkefølge og kunne aktiveres med Enter eller mellemrumstast. Aktiveringen skal indsætte dags dato, følge datofeltets normale validering og kunne fortrydes med ét undo-trin. Alle øvrige steder i programmet, hvor der indgår en knap til at indsætte dags dato skal knappen også indgå i Tab-rækkefølgen.
- Påvirkning: Tastaturbrugere kan ikke udføre den samme dato-handling som musebrugere.
- Prioritet: Mellem
- Status: Ny

## BF-039 — Forligsprocenten blokerer ikke værdier over 100 %

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Forlig om ansvarsgrad → `Procent`
- Sådan fremprovokeres det:
  1. Åbn feltet `Procent`.
  2. Indtast eller indsæt `101`.
  3. Afslut feltet.
- Det sker: Feltet tillader værdien over 100 % og viser først en range-fejl efterfølgende.
- Det bør ske: Indtastninger over 100 % skal blokeres allerede ved tastning og paste. Paste skal fortsætte tegn for tegn, men cifre, der ville føre værdien over 100 %, skal springes over. Værdier fra 1 til og med 100 % skal accepteres; `0` skal fortsat kunne stå som en bevaret rød fejltilstand efter settle.
- Påvirkning: En værdi, der skal være umulig at indtaste, kan aktuelt gemmes som canonical værdi med efterfølgende fejlmarkering.
- Prioritet: Høj
- Status: Ny

## BF-040 — Forligsprocent-paste fortolker forbudte tegn

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Forlig om ansvarsgrad → `Procent`
- Sådan fremprovokeres det:
  1. Åbn feltet `Procent`.
  2. Paste eksempelvis `12.5` eller `12 5`.
- Det sker: Paste-normaliseringen behandler punktum og mellemrum som numerisk formatering i stedet for at springe tegnene over som ikke-tilladte tegn.
- Det bør ske: Kun cifre og komma skal indgå. Punktum, mellemrum, procenttegn og øvrige ikke-tilladte tegn skal springes over tegn for tegn, uden at blive omdannet eller fortolket.
- Påvirkning: Paste kan give en anden værdi end den, som tilsvarende almindelig indtastning ville have givet.
- Prioritet: Høj
- Status: Ny

## BF-041 — Brøk-paste fortolker forbudte tegn og fjerner afsluttende komma

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Forlig om ansvarsgrad → `Brøk`
- Sådan fremprovokeres det:
  1. Åbn feltet `Brøk`.
  2. Paste en værdi med punktum, mellemrum eller et afsluttende decimal-komma, eksempelvis `1,/2`.
- Det sker: Paste-normaliseringen kan omdanne eller fjerne tegnene, så en værdi som `1,/2` kan ende som `1/2` i stedet for at bevare den fejlbehæftede tekst.
- Det bør ske: Paste skal behandles tegn for tegn som almindelig indtastning. Punktum og mellemrum skal springes over, mens et tilladt afsluttende komma skal bevares, så `1,/2` afsluttes som formatfejl med rød ring og tooltip.
- Påvirkning: En paste-værdi kan blive gyldig ved en tavs omformning, som almindelig indtastning ikke ville have udført.
- Prioritet: Høj
- Status: Ny

## BF-042 — Brøkens indledende nuller normaliseres ikke

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Forlig om ansvarsgrad → `Brøk`
- Sådan fremprovokeres det:
  1. Indtast eller indsæt `02/04`.
  2. Afslut feltet.
- Det sker: Feltet viser fortsat `02/04`.
- Det bør ske: Indledende nuller skal normaliseres ved settle, så værdien vises som `2/4`, mens selve brøken fortsat ikke reduceres til `1/2`.
- Påvirkning: Samme brøk kan vises med unødvendigt forskellige tekstformer.
- Prioritet: Mellem
- Status: Ny

## BF-043 — Brøk med division med nul mangler konkret fejl-tooltip

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Forlig om ansvarsgrad → `Brøk`
- Sådan fremprovokeres det:
  1. Indtast `1/0`.
  2. Afslut feltet.
- Det sker: Værdien bliver en generisk formatfejl uden konkret besked om division med nul.
- Det bør ske: `1/0` skal bevares som fejltekst med rød ring og tooltip, der konkret forklarer, at nævneren ikke må være nul.
- Påvirkning: Brugeren får ikke en præcis forklaring på, hvorfor brøken er ugyldig.
- Prioritet: Mellem
- Status: Ny

## BF-044 — Manglende Beregning-advarsel ved manglende ménafgørelsesdato

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → `Dato for første ménafgørelse`
- Sådan fremprovokeres det:
  1. Sæt `Varige mén-afgørelse` til `Ja`.
  2. Lad `Dato for første ménafgørelse` stå tom, eller slet datoen igen.
  3. Gå til Beregning-siden.
- Det sker: Når togglen står på `Ja`, og datoen mangler, fremkommer der ikke den forventede samlede advarsel på Beregning-siden.
- Det bør ske: Manglende dato skal give en ikke-blokerende gul advarsel på Beregning-siden. Selve datofeltet skal forblive tomt uden rød ring.
- Påvirkning: Brugeren mangler en tydelig påmindelse om den ufuldstændige ménafgørelsesoplysning, selv om forholdet ikke skal blokere beregningen.
- Prioritet: Mellem
- Status: Ny

## BF-045 — Hjælpe-datofelter har afvigende opsætning

- Type: Fejl
- Sted: Erstatningsopgørelse → Offentlige ydelser → `Indsæt maksimal sygedagpengesats for perioden`, fra-dato og til-dato
- Sådan fremprovokeres det:
  1. Åbn `Indsæt maksimal sygedagpengesats for perioden`.
  2. Klik på et af hjælpe-datofelterne.
- Det sker: Datoindholdet er venstrestillet i stedet for centreret som i de fleste andre datofelter. Felterne er desuden ikke opsat som de øvrige datofelter, hvilket blandt andet viser sig ved, at et klik åbner editoren i stedet for at give feltet fokus.
- Det bør ske: Hjælpe-datofelterne skal være centrerede og følge den almindelige opsætning for datofelter. Et klik skal give feltet fokus uden at åbne editoren på den afvigende måde.
- Påvirkning: Datofelterne ser og opfører sig anderledes end tilsvarende datofelter i programmet.
- Prioritet: Mellem
- Status: Ny

## BF-046 — Procentfelter tillader punktum

- Type: Fejl
- Sted: Procentfelter generelt, observeret i Erstatningsopgørelse → EO oplysninger → Forlig om ansvarsgrad → `Procent`
- Sådan fremprovokeres det:
  1. Åbn et procentfelt.
  2. Indtast et punktum.
- Det sker: Punktum accepteres og vises som en del af indtastningen.
- Det bør ske: Procentfelter må kun acceptere cifre og komma. Procentfelter, der undtagelsesvist tillader negative værdier, skal desuden acceptere minus-tegn. Øvrige specialtegn skal afvises.
- Påvirkning: Procentfelter kan modtage tegn, der ikke er en del af det forventede inputformat. Fundet er observeret i forligsprocentfeltet, men kan være et centralt problem, der rammer flere felter.
- Prioritet: Høj
- Status: Ny

## BF-047 — Inaktive afkrydsningsfelter viser ikke ren visning

- Type: Fejl
- Sted: Afkrydsningsfelter, der gøres inaktive af programmet
- Sådan fremprovokeres det:
  1. Udfyld eller vælg et afkrydsningsfelt.
  2. Bring sagen i en tilstand, hvor programmet gør afkrydsningsfeltet inaktivt.
- Det sker: Det inaktive afkrydsningsfelt viser ikke nødvendigvis ren visning uden rettehak, samtidig med at den oprindelige værdi skal bevares.
- Det bør ske: Et afkrydsningsfelt, der er gjort inaktivt af programmet, skal vises uden rettehak som ren visning. Den oprindelige værdi skal bevares, så den vises igen, hvis programmet senere gør afkrydsningsfeltet aktivt.
- Påvirkning: Den visuelle visning kan afvige fra den ønskede inaktive tilstand, eller den oprindelige brugerindstilling kan gå tabt, når feltet midlertidigt gøres inaktivt.
- Prioritet: Mellem
- Status: Ny

## BF-049 — Manglende gul advarsel ved manglende endelig EET-dato

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → `Dato for endelig erhvervsevnetabsafgørelse` og `Virkningsdato (hvis forskellig fra afgørelsesdatoen)`
- Sådan fremprovokeres det:
  1. Sæt `Endeligt EET-afgørelse` til `Ja`.
  2. Lad både afgørelsesdatoen og virkningsdatoen stå tomme.
  3. Gå til Beregning-siden.
- Det sker: Der vises ikke den forventede samlede advarsel om, at der mangler en dato.
- Det bør ske: Der skal vises en ikke-blokerende gul advarsel på Beregning-siden, når begge datoer mangler. Ingen af de to felter skal få rød ring alene på grund af den manglende værdi.
- Påvirkning: Brugeren mangler en tydelig påmindelse om den ufuldstændige endelige EET-oplysning, uden at forholdet skal blokere beregningen.
- Prioritet: Mellem
- Status: Ny

## BF-050 — Helbredsforhold-feltet vises ikke

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Svie- og smertegodtgørelse → `Helbredsforhold`
- Sådan fremprovokeres det:
  1. Åbn EO-oplysninger-fanen.
  2. Se sektionen for svie- og smertegodtgørelse.
- Det sker: `Helbredsforhold` vises ikke som et inputfelt, selv om feltet findes i datamodellen med valgmulighederne `Sygemeldt`, `Delvist Sygemeldt` og `Raskmeldt`.
- Det bør ske: Feltet skal vises efter de tidligere afklarede regler: valgfrit uden direkte feltfejl, men med samlet Beregning-fejl hvis svie- og smertegodtgørelse er relevant og feltet mangler. Det skal understøtte de almindelige dropdown-regler.
- Påvirkning: Brugeren kan ikke indtaste helbredsforholdet, og den gemte/beregnede sag kan derfor mangle en oplysning, som er afklaret som relevant i bestemte tilfælde.
- Prioritet: Høj
- Status: Ny

## BF-051 — Tømt svie-/smerterække fjernes ikke automatisk

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Svie- og smertegodtgørelse → svie-/smerte-tabellen
- Sådan fremprovokeres det:
  1. Udfyld en svie-/smerterække.
  2. Slet Fra-dato, Til-dato og Tilstand, så rækken igen er helt tom.
  3. Se tabellen og Beregning-siden.
- Det sker: Den tidligere eksisterende række fjernes ikke automatisk, men kan blive stående som tom række.
- Det bør ske: En helt tom række skal ikke give fejl, heller ikke på Beregning-siden, og rækken skal fjernes
  automatisk, så der kun står én tom trailing-række tilbage.
- Påvirkning: Tabellen kan indeholde overflødige tomme rækker og afvige fra den aftalte række-livscyklus.
- Prioritet: Mellem
- Status: Ny
