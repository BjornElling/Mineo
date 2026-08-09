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
| BF-028 | Kronologien i EO's dato-par er flyttet til descriptoren som strukturel feltfejl; begge felter markeres nu rødt med den modgående dato i hver tooltip. |
| BF-031 | Ustabiliteten er væk: rækkefølgereglen var før et biprodukt af bounds-clampingen og afhang af rækkens øvrige fejl. Den er nu en selvstændig regel ét sted. |

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
- Status: **Løst** (se «BF-028 og BF-031 — analyse og løsning» nedenfor)

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
- Status: **Løst** (se «BF-028 og BF-031 — analyse og løsning» nedenfor)

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

> **Bortfaldet 2026-08-09 ved kontraktændring.** Særreglen om indtastningsblokering over 100 % er ophævet.
> `Forlig om ansvarsgrad → Procent` bruger nu samme hovedregel som de øvrige procentfelter: blokeringen
> omfatter tegnsæt og længde (højst 3 heltalscifre og 2 decimaler), ikke talværdi. `101` skal derfor kunne
> indtastes og skal give rød ring, konkret tooltip og blokere download, hvor ansvarsgraden har betydning —
> altså præcis den adfærd, dette fund beskrev som forkert. Se `input-field-behavior-contract.md` §2.3 og §4.10.
> Længdedelen er dog fortsat et udestående: et 4. heltalsciffer skal blokeres ved både tastning og paste.

- Type: Fejl
- Sted: Erstatningsopgørelse → EO oplysninger → Forlig om ansvarsgrad → `Procent`
- Sådan fremprovokeres det:
  1. Åbn feltet `Procent`.
  2. Indtast eller indsæt `101`.
  3. Afslut feltet.
- Det sker: Feltet tillader værdien over 100 % og viser først en range-fejl efterfølgende.
- Det bør ske: *(bortfaldet)* Den oprindelige beskrivelse krævede blokering allerede ved tastning og paste. Efter kontraktændringen er det modsatte det rigtige: `101` skal accepteres som canonical værdi med rød ring, konkret tooltip om det tilladte interval og blokeret download. Det, der skal blokeres, er alene det 4. heltalsciffer og den 3. decimal.
- Påvirkning: Ingen — den observerede adfærd er nu den ønskede for talværdien.
- Prioritet: Bortfaldet (længdeblokeringen føres videre som en del af den generelle tegn-/længderegel)
- Status: Bortfaldet 2026-08-09

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

## BF-050 — Tømt svie-/smerterække fjernes ikke automatisk

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

## BF-051 — Blinkmarkering mangler eller dækker ikke hele mål-feltet

- Type: Fejl
- Sted: Boksen `Fejl og advarsler` og alle sider/felter, som nås via dens genererede links, herunder dropdown-felter og `Grundlæggende oplysninger`
- Sådan fremprovokeres det:
  1. Opret en fejl eller advarsel, der vises i boksen `Fejl og advarsler`.
  2. Klik på et link, der fører til en dropdown-menu. Eksempelvis skal menuen blinke rødt, når linket åbner eller fokuserer dropdown-feltet.
  3. Klik på andre links, der fører til et felt på en anden side. Eksempler: Klik på en fejl under `Differencekrav`, der peger på `Skadelidtes fødselsdato` på Stamdata-siden, eller klik på `Beregningsdato er ikke udfyldt` under `EET oplysninger` → `Grundlæggende oplysninger`.
- Det sker: Ved dropdown-links blinker menuens baggrund rødt, men området bag pilen ned til højre blinker ikke. Ved mange links på tværs af sider navigeres der korrekt til siden og feltet, men mål-feltet blinker slet ikke.
- Det bør ske: Blinkmarkeringen skal altid udløses på det felt, som linket fører til. Ved dropdown-felter skal hele feltets synlige baggrund, inklusive området bag pilen ned til højre, blinke rødt. Det skal også virke, når linket fører til et felt på en anden side.
- Påvirkning: Brugeren får ikke entydig visuel bekræftelse af, hvilket felt der kræver opmærksomhed, selv om linket navigerer til den rigtige placering.
- Prioritet: Høj
- Status: Ny

### BF-028 og BF-031 — analyse og løsning

**Fundet.** På Erstatningsopgørelse-siden gav en til-dato før fra-dato hverken rød ring eller tooltip. Fejlen
ramte bredt: alle fem rækkekollektioner med dato-par (TAF-, ferie-, fraværs-, svie/smerte- og offentlige
ydelser-rækker) plus det skalare par «Vedrører perioden». BF-031's iagttagelse — at fejlen optrådte
*ustabilt* — var et selvstændigt spor, ikke støj.

**Kernen: reglen kunne ikke nå feltet.** Rød ring og tooltip kan KUN tegnes af ét `FieldIssue`, og det bærer
en strukturel `FieldRef`, altså en feltadresse. EO havde tre parallelle fejlveje, og kun én af dem talte det
sprog:

1. **Kernens `FieldIssue`** (`descriptor.validators` → `deriveFieldIssueSet`) — bærer feltadresse, tegner ring.
2. **Legacy `ValidationError`** (`erstatningsopgoerelseValidator`) — bærer et TEKST-path
   (`"svieSmertePerioder[0].fra"`) og bliver til en `EoInvariant`, dvs. ren tekst i "Fejl og advarsler".
3. **Række-evalueringen** (`validation/tafPeriodeValidation.ts` m.fl.) — returnerer
   `{ message, field: 'fra' | 'til' }`, altså et KOLONNE-HINT.

Vej 1 var koblet ind i vej 2 (`buildStructuralFieldIssueInvariants`), så en descriptor-fejl også nåede
tekstboksen. Den modsatte retning fandtes ikke: hverken et tekst-path eller et kolonne-hint er en feltadresse,
og intet oversatte mellem dem. Kronologireglen lå udelukkende i vej 2 og 3.

Konsekvensen var mærkelig at observere, og det er præcis derfor fundet var svært at stille: fejlen KUNNE
vises i "Fejl og advarsler", den kunne endda klikkes, og klikket scrollede hen til det rigtige felt og blinkede
det (`eoRowIssueCatalog` omsætter hintet til en adresse — men først på navigationstidspunktet). Kun selve
ringen udeblev.

**Hvorfor EO og ikke Årsløn.** EO's to datofabrikker (`dateField`, `rowDate`) var erklæret HELT uden
`validators`, mens `amountField`/`integerField` i samme fil havde bounds-validators. Derfor markerede
EO-siden beløb og heltal korrekt, mens datoreglerne var tavse. Årslønstabellen gør det modsatte
(`dateBoundsValidator`, `weekOrderValidator` på descriptoren) og udleder endda den SAMME
`DATE_ORDER_ERROR_MESSAGE` — som rød ring. Mekanismen fandtes altså; EO brugte den bare ikke.

**BF-031's ustabilitet forklaret.** I `tafPeriodeValidation.evaluateOne` beregnes `fraFoerTilError` kun INDE i
`if (hasOverlap || cutoff || range)` og bruges derefter kun som `??`-fallback efter cutoff-beskederne.
Samtidig clamper `computeRowDateBounds` `til.min` mod `fra`, så range-tjekket normalt fanger tilfældet først.
Rækkefølgereglen var dermed i praksis et biprodukt af bounds-clampingen frem for en selvstændig regel — og
hvilken besked brugeren så, afhang af hvilke andre fejl rækken tilfældigvis havde.

**Løsningen.** Kronologien er flyttet derhen, hvor den kan nå feltet: `src/inputCore/catalog/dateOrderValidators.ts`
ejer reglen ét sted, og `rowDatePair` danner fra/til-parret som ÉN enhed, så en kollektion ikke kan registreres
med kun den halve markering. Validatoren clamper bevidst IKKE mod modparten — clampingen bliver i motoren,
hvor den hører hjemme; ellers ville bounds-reglen spise kronologireglen igen, og BF-031 ville gentage sig.

Jf. BF-028 markeres BEGGE felter, og hver tooltip navngiver den MODGÅENDE dato ("Til-dato skal være efter
fra-dato (26-02-2026)"). En kronologifejl er én regel om to værdier; markeres kun det ene felt, udpeger
programmet vilkårligt den ene af to lovlige datoer som den forkerte. `reason` er `rule` — ikke `bounds` —
fordi `resolveFieldIssueTooltip` viser `rule` ORDRET, mens den generiske «Fejl i indtastning» ville skjule
netop den modpartsdato, der gør fejlen forståelig.

**«Vedrører perioden» var værre end rækkerne.** `buildEoErstatningsopgoerelseRows` læser udelukkende
core-feltissues og har ellers kun "begge felter udfyldt" som statuskilde. En omvendt periode fik derfor
`status: 'ok'` og blev vist med normal formatering i rækkeoversigten; fejlen nåede kun frem som en generel
invariant på Beregning-fanen. Feltet har nu samme descriptor-regel som rækkeparrene.

**Afgrænsning — hvad der IKKE blev flyttet, og hvorfor.** Kriteriet er, om fejlen entydigt tilhører ét felt
og kan afgøres af feltet plus dets kontekst:

- **Descriptor-validator (rød ring):** fra > til. Afgøres af feltet + søskendefeltet alene.
- **Forbliver rækkeissue (ingen ring):** overlap mellem rækker — fejlen tilhører ikke ét felt, og at farve
  den ene af to lovlige datoer ville udpege et vilkårligt offer. Manglende halvdel forbliver `missing`;
  tomhed er aldrig en rød feltfejl (§1.6), ellers ville enhver halvt indtastet periode blinke rødt undervejs.
- **Projekteret `FieldIssue` fra domænet (rød ring):** cutoff mod differencekravsdato og endeligt/midlertidigt
  EET. Grænsen udledes af domæneregler (klage-suspension, 2011-skæringsdatoen, virkningsdato-præcedens), som
  inputkernen ikke skal kende — en descriptor-validator måtte genskabe den udledning inde i kernen. Reglen bor
  derfor i `tafCutoffDateIssues.ts` og binder selv feltadressen, præcis som `manualRegulationDateIssues`.
  Se det selvstændige afsnit nedenfor.

**Vist to steder, bevidst.** Har en række både kronologifejl og overlap, står kronologien nu som rød ring på
felterne OG i "Fejl og advarsler", mens overlappet kun står i boksen. Boksen læses uden felterne foran sig og
skal blive ved med at vise den fulde tekst — samme begrundelse som at `bounds`/`rule` beholder deres fulde
besked dér (brugerbeslutning).

**Beviser.** Værnet er mutationstestet i fem trin, som hver gør testen rød: reglen deaktiveret, kun det ene
felt markeret (den gamle adfærd), modpartsdatoen fjernet fra beskeden, `<=` ændret til `<` (éndags-intervallet
gjort ulovligt) og `reason` ændret til `bounds`. Beregnings-ækvivalensen er målt særskilt frem for antaget:
2.044 beregnings-, PDF- og dokumenttests er kørt før og efter, og INGEN test skiftede udfald — kun de seks nye
kom til. Det var nødvendigt, fordi en descriptor-validator maskerer værdien for motoren og altså kunne have
blokeret en gren tidligere end før.

Testen `eoDateOrderFieldIssues.test.ts` måler hele brugerrejsen fra afsluttet input til den feltadresse, UI'et
tegner ringen på. Det var dét, der manglede: de eksisterende suiter målte hvert lag for sig og var derfor
grønne, mens sammenføjningen var brudt.

### TAF-cutoff og maskerings-dubletten — anden etape

Efter første etape (kronologien ovenfor) stod tre ting tilbage. De er nu lukket.

**1. Maskeringen skabte usande «mangler»-beskeder.** Readeren skjuler en værdi bag en rød feltfejl (§1.5).
Det er rigtigt over for MOTORERNE, men legacy-validatoren læser samme maskerede værdier og konkluderer da, at
feltet er TOMT. En bruger, der indtastede en til-dato før fra-datoen, fik derfor FIRE beskeder om én fejl: to
sande kronologifejl plus «Fra-dato mangler» og «Til-dato mangler» om datoer, der tydeligvis stod i felterne.
Den usande halvdel var værst, fordi den pegede mod en handling — udfyld feltet — der ikke kunne løse noget.

`suppressMaskedMissingInvariants` fjerner netop den halvdel. Undertrykkelsen ligger dér, hvor de to lister
mødes, fordi kriteriet er en egenskab ved PARRET: validatoren kan ikke selv vide, om en tom værdi er brugerens
tomhed eller readerens maskering. Den matcher derfor de to `mangler`-beskeder på den konkrete legacy-sti,
som den strukturelle rækkeadresse og rækkens stabile entity-id entydigt peger på. En ægte tom dato i en anden
række med samme feltnavn får fortsat sin besked.

**2. Tre dato-par manglede.** Kronologien dækkede ikke `tafBeregningsperiodeFra/Til`, SFGG-referenceperioden
eller indtægtstabellens `col0_dag`/`col1_dag`. Den sidste var værst: et literalt «Dato fra»/«Dato til»-par
HELT uden validators — hverken orden eller bounds — og nestet under et ansættelsesforhold, så modparten skal
bindes med begge entity-id'er. Alle tre har nu samme regel.

**3. Cutoff mod differencekrav og EET.** Reglen beregnes af `resolveTafCutoffDates`, som er SAMME kilde,
motorens clamping bruger. Det er hele pointen: en cutoff-fejl må aldrig kunne sige noget andet end den grænse,
beregningen faktisk anvender. De tre regler er testet eksplicit: cutoff er INKLUSIV (dato >= cutoff er fejl,
sidste lovlige dag er dagen før), midlertidigt EET gælder kun når klagen ikke suspenderer og skadedatoen ligger
før 16-06-2011, og virkningsdato har forrang for afgørelsesdato.

**Om hvilket felt cutoffen markerer.** Kontrakten beskrev den som en fejl på til-datoen, mens den gamle
evaluator i visse tilfælde placerede den på fra-datoen. Begge datoer prøves nu mod grænsen hver for sig: en
cutoff er en ØVRE grænse, og en fra-dato efter skæringsdatoen er lige så ulovlig som en til-dato — perioden
ligger da helt efter grænsen. Markeres kun til-datoen i det tilfælde, peger programmet på det felt, brugeren
ikke behøver at rette.

**Stadig bevidst uden for kernen.** Række-overlap, «mangler»-beskeder for ægte tomme felter, samt
lønudviklingens kilde-/konsistenskrav forbliver rækkeissues: de tilhører ikke ét felt. Ferieperiodernes brug af
TAF's kombinerede EET/differencekrav-grænse er en kontrakt-/kodeuoverensstemmelse, som IKKE er afgjort her —
den kræver en beregningsbeslutning og er derfor ikke rørt.

**Beviser.** Cutoff-reglerne har otte egne tests. Undertrykkelsen er mutationstestet med en kontrolgruppe: en
urelateret legacy-fejl i samme fixture, så en mutation, der swallower ENHVER legacy-besked, bliver rød —
uden den ville testen ikke kunne skelne en smal undertrykkelse fra en altædende. Beregnings-ækvivalensen er
målt igen: 2.044 beregnings-, PDF- og dokumenttests, nul ændrede udfald.
