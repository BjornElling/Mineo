# Brugerfund

Arbejdslisten bruges til konstaterede fejl og konkrete forbedringsønsker fra brugertest. Ét fund pr. ID.
Beskriv den oplevede adfærd; agenten ejer teknisk analyse, implementeringsplan og statusopdatering.

## Nye fund

Næste ID: **BF-067**. Kopiér denne blok pr. fund:

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

## Udestående beslutninger — kortlagt 2026-08-15

Fundene nedenfor blev kortlagt under den systematiske gennemgang af programmets standardiserede
input-elementer (commit `93b21494`, som lukkede selve felterne). De er **ikke** rettet, fordi hver af dem
enten ændrer noget, du ser, eller kræver en ny brugervendt tekst.

Hvert fund angiver både, hvad der skal gøres hvis du vil have det ændret, og hvad der skal gøres hvis du
vil **fastholde** den nuværende tilstand — så den ikke bliver påtalt igen ved næste gennemgang.

De blev opsummeret som syv forhold. «Dialoger og overlays» rummede to reelt forskellige fund (BF-062 og
BF-063), og listens regel er ét fund pr. ID. BF-061 er trukket tilbage efter brugerens indsigelse
2026-08-15, og BF-065 er afgjort samme dag. Der står derfor seks åbne poster.

## BF-059 — Grå knapper forklarer ikke, hvorfor de er grå

- Type: Fejl
- Sted: Erstatningsopgørelse → Offentlige ydelser → knappen `Indsæt` ved sygedagpenge-hjælperen.
  Samme mønster i fejlrapport-dialogens tre knapper.
- Sådan fremprovokeres det:
  1. Gå til Erstatningsopgørelse → Offentlige ydelser.
  2. Lad hjælpeperiodens `Fra-dato` og `Til-dato` stå tomme.
  3. Se på knappen `Indsæt` til højre for datoerne, og hold musen over den.
- Det sker: Knappen er grå og kan ikke aktiveres, men der kommer ingen tooltip og ingen besked
  nogen steder om, hvad der mangler. Du kan endda Tab'e hen til knappen og trykke Enter — der sker
  bare ingenting, uden forklaring.
- Det bør ske: Samme regel som for de deaktiverede downloadknapper (BF-055-familien): knappen er tavs
  ved klik, men en tooltip fortæller hvorfor — fx «Udfyld både fra- og til-dato».
- Påvirkning: Ingen på tal, gemte data eller dokumenter. Rent vejledning.
- **Udestående beslutning:** teksten er brugervendt, så ordlyden skal godkendes, før den skrives.
- **Hvis den nuværende tilstand fastholdes:** undtagelsen skal skrives ind i
  `page-component-contract.md` ved siden af den eksisterende regel om deaktiverede downloadknapper, så
  det står som et bevidst valg og ikke som en manglende tooltip.
- Prioritet: Mellem
- Status: Afventer beslutning

## BF-060 — Knappen til at tilføje ansættelsesforhold ryster i stedet for at være tydeligt inaktiv

- Type: Fejl
- Sted: Erstatningsopgørelse → Lønindkomst → den runde `+`-knap nederst til højre på et
  ansættelsesforholdskort.
- Sådan fremprovokeres det:
  1. Opret ansættelsesforhold, indtil der er 10.
  2. Klik på `+`-knappen igen.
- Det sker: Knappen ryster i et halvt sekund og gør ellers ingenting. Tooltippen siger «Maksimalt 10
  ansættelsesforhold», men knappen fremstår stadig som en aktiv knap — den er ikke slået fra i
  programmet, kun visuelt dæmpet. En skærmlæser vil derfor oplyse den som en almindelig, brugbar knap.
- Det bør ske: Enten er knappen reelt slået fra (så der ikke sker noget ved klik, og tooltippen
  forklarer hvorfor), eller også ryster den — men ikke begge dele på én gang.
- Påvirkning: Ingen på tal, gemte data eller dokumenter.
- Bemærk: De fire runde knapper på kortet (`Tilføj`, `Flyt op`, `Flyt ned`, `Slet ansættelsesforhold`)
  henter deres navn udelukkende fra tooltippen. Programmets egen regel siger, at det ikke er nok til at
  give en knap et varigt navn.
- **Udestående beslutning:** rystelsen ER en synlig adfærd, du kan have valgt bevidst — derfor spørges.
- **Hvis den nuværende tilstand fastholdes:** rystelsen skal beskrives i `page-component-contract.md`
  som den valgte afvisningsmåde ved maksimumgrænser, og knapperne skal alligevel have et fast navn
  (usynligt for dig, kun for skærmlæsere), så programmets eget tilgængelighedsværn ikke bliver rødt.
- Prioritet: Mellem
- Status: Afventer beslutning

## BF-062 — Fejlbeskeden efter et mislykket Gem eller Hent kan kun lukkes med musen

- Type: Fejl
- Sted: Hele programmet — den røde boks, der dukker op øverst til højre efter en mislykket filhandling.
- Sådan fremprovokeres det:
  1. Klik `Hent` i sidemenuen.
  2. Vælg en fil, der ikke er en gyldig `.eo`-fil (fx et billede).
  3. Prøv at lukke den røde boks med Escape eller med tastaturet alene.
- Det sker: Boksen bliver stående, indtil du klikker på den med musen. Den lukker ikke af sig selv, har
  ingen synlig lukkeknap, og hverken Escape eller Tab kan nå den. Musetippen siger «Klik for at lukke»,
  hvilket er en ren museinstruktion.
- Det bør ske: Beskeden kan lukkes med Escape, og den har en synlig lukkeknap.
- Påvirkning: Ingen på tal eller gemte data — men beskeden dækker en del af skærmen, indtil den lukkes.
- **Udestående beslutning:** en synlig lukkeknap ændrer boksens udseende.
- **Hvis den nuværende tilstand fastholdes:** «kun mus» skal skrives ind i `keyboard-navigation.md` ved
  siden af de øvrige erklærede muse-kun-undtagelser, så den ikke bliver påtalt som et hul igen.
- Prioritet: Mellem
- Status: Afventer beslutning

## BF-063 — Licensvinduet slipper tastaturet ud, og tre dialoger har konkurrerende fokus-retur

- Type: Fejl
- Sted: Om-siden → `MIT-licensen`. Samt fejlrapport-dialogen (indholdsboksenes rapportknap) og
  fejlrapport-knappen i preflight ved filindlæsning.
- Sådan fremprovokeres det:
  1. Gå til Om-siden og åbn `MIT-licensen`.
  2. Tryk Tab gentagne gange.
  3. Luk vinduet, og tryk Tab igen.
- Det sker: Tab-fokus forlader licensvinduet og vandrer ud i siden bagved, selv om vinduet dækker
  skærmen. De øvrige dialoger i programmet holder tastaturet inde i sig.
  For fejlrapport-dialogen er problemet et andet: to mekanismer forsøger begge at føre fokus tilbage,
  når dialogen lukkes, så det ikke er entydigt, hvor du lander bagefter.
- Det bør ske: Så længe et vindue er åbent, bliver tastaturet i det. Ved lukning føres fokus tilbage til
  knappen, der åbnede det — ét sted, ikke to.
- Påvirkning: Ingen på tal, gemte data eller dokumenter.
- Bemærk: Rapportknappen på indholdsbokse vises kun, hvis `Vis knap til at rapportere fejl og
  forbedringsønsker på indholdsbokse` er slået til på Indstillinger. Dialogen bag `ErrorFallback` vises
  kun ved et egentligt programnedbrud og kan ikke fremprovokeres i normal brug. Ingen af de tre dialoger
  har tests i dag.
- **Udestående beslutning:** rettelsen ændrer ikke noget, du ser, men den ændrer hvor tastaturet lander.
  Det er den slags, der skal være besluttet, før den laves.
- **Hvis den nuværende tilstand fastholdes:** licensvinduets manglende tastaturfangst skal erklæres i
  `keyboard-navigation.md`, og de tre dialoger skal alligevel have tests, så adfærden er fastholdt —
  ellers kan den skride uden at nogen opdager det.
- Prioritet: Mellem
- Status: Afventer beslutning

## BF-064 — Beløb og dato i «Find løntrin» åbnes på hver sin måde

- Type: Fejl
- Sted: Erstatningsopgørelse → Lønindkomst (eller EO oplysninger → Indtægt før skaden) → knappen
  `Find løntrin` → vinduet med felterne `Ansættelse`, beløb og `Dato`.
- Sådan fremprovokeres det:
  1. Åbn `Find løntrin`.
  2. Klik én gang i beløbsfeltet og skriv et tal.
  3. Klik derefter én gang i `Dato`-feltet og prøv at skrive.
- Det sker: Beløbsfeltet tager imod med det samme ved første klik. `Dato`-feltet gør ikke — det skal
  klikkes to gange, ligesom alle andre felter i programmet. To felter side om side i samme lille vindue
  opfører sig altså forskelligt.
- Det bør ske: De to felter åbnes på samme måde.
- Påvirkning: Ingen på tal, gemte data eller dokumenter.
- Bemærk: Forskellen har også en konsekvens for Escape. Fordi beløbsfeltet altid er «åbent», annullerer
  Escape derfra altid indtastningen i stedet for at lukke vinduet; fra `Dato`-feltet lukker Escape
  vinduet, når feltet ikke er åbnet.
- **Udestående beslutning:** at gøre beløbsfeltet totrins betyder ét klik mere, hver gang du bruger
  finderen. Det er en reel forskel i det daglige.
- **Hvis den nuværende tilstand fastholdes:** ettrins-beløbsfeltet skal beskrives som en bevidst
  undtagelse i `input-field-behavior-contract.md`, sammen med den Escape-konsekvens, det har.
- Prioritet: Lav
- Status: Afventer beslutning

## BF-066 — Faneskift bygger på museklikket for at gemme det, du var i gang med

- Type: Fejl (latent — kan ikke fremprovokeres i dag)
- Sted: Alle sider med faner, fx Varige mén → `Beregning`/`Satser`.
- Sådan fremprovokeres det: **Det kan det ikke i dag.** Når du klikker på en fane med musen, forlader
  musen først feltet, og det, du havde skrevet, bliver gemt af den grund — ikke fordi faneskiftet selv
  sørger for det. Da fanerne bevidst ikke kan nås med tastaturet (se `keyboard-navigation.md`), findes
  der ingen vej til et faneskift uden et forudgående museklik.
- Det sker: Intet observerbart. Fundet er noteret, fordi sikringen mangler, ikke fordi den svigter.
- Det bør ske: Et faneskift gemmer selv det åbne felt, uanset hvordan skiftet blev udløst — sådan som
  sidemenuens navigation allerede gør.
- Påvirkning: Ingen i dag. Men hvis fanerne en dag gøres tastaturtilgængelige, eller et faneskift
  udløses af programmet selv, kan en igangværende indtastning gå tabt uden varsel.
- **Udestående beslutning:** ingen synlig ændring, men det er en ændring i, hvornår data gemmes, og
  derfor forelægges den.
- **Hvis den nuværende tilstand fastholdes:** afhængigheden af museklikket skal skrives eksplicit ind i
  `critical-action-contract.md`, så den fremstår som et kendt vilkår — og så beslutningen bliver taget
  op igen, hvis fanerne senere kommer i Tab-rækkefølgen.
- Prioritet: Lav
- Status: Afventer beslutning

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
| BF-029 | Gentagne separatorer afvises igen ved tastning. Ciffer-lofterne var aldrig væk; det var afvisningen af den ANDEN separator på stribe, som forsvandt i `5c864afe` (2026-04-23) uden at nogen test blev rød. |
| BF-030 | Fælles række-livscyklus fjerner igen helt tømte brugeroprettede tabelrækker og efterlader præcis én trailing-række; systemstyrede basisrækker bevares. |
| BF-032 | Beløbsfelter afviser mellemrum og punktum ens ved tastning og paste; paste springer forbudte tegn over i stedet for at fortolke dem. |
| BF-034 | Sygedagpenge-hjælperens to datoer bruger nu den almindelige datofeltmotor, inklusive tegnfilter, paste, bounds-fejl og Indsæt-gate. |
| BF-035 | `Kommentarer` har nu de erklærede 512 tegn, håndhævet ved både tastning og paste. |
| BF-036 | EO-`Nummer` har nu de erklærede 7 tegn, håndhævet ved både tastning og paste. |
| BF-037 | `+ evt. ledsagetekst` har nu de erklærede 64 tegn, håndhævet ved både tastning og paste. |
| BF-039 | Bortfaldet ved kontraktændringen 2026-08-09; længdedelen (4. heltalsciffer) er nu håndhævet som del af den generelle tegn-/længderegel. |
| BF-040 | Procent-paste følger nu samme tegn-for-tegn-regel som tastning og fortolker hverken punktum eller mellemrum. |
| BF-041 | Brøk-paste bevarer et lovligt afsluttende komma som rejected tekst og springer kun forbudte tegn over. |
| BF-042 | Brøkens indledende nuller normaliseres ved settle uden at reducere selve brøken. |
| BF-043 | Brøk med nævner 0 bevares som afvist tekst med konkret tooltip om, at nævneren ikke må være 0. |
| BF-045 | Sygedagpenge-hjælperens datoer er centrerede og følger den almindelige totrins fokus-/redigeringsmodel. |
| BF-046 | Procentfelter afviser punktum og andre forbudte tegn centralt på både formular- og tabeloverflader. |
| BF-050 | Svie-/smerte-tabellen arver den fælles livscyklus for helt tømte brugeroprettede rækker. |
| BF-053 | Et afsluttet rejected input kan ikke længere omgå et felts tegn- eller cifferloft. |
| BF-038 | Indsæt dags dato og synlige downloadknapper indgår nu i Tab-rækkefølgen og aktiveres med Enter eller mellemrum. |
| BF-044 | Manglende ménafgørelsesdato vises som en ikke-blokerende gul advarsel på Beregning. |
| BF-047 | Programinaktive afkrydsningsfelter vises uden hak og genviser den bevarede værdi ved reaktivering. |
| BF-048 | Manglende midlertidig EET-dato vises som en ikke-blokerende gul advarsel på Beregning. |
| BF-049 | Manglende endelig EET-dato vises som en ikke-blokerende gul advarsel på Beregning. |
| BF-052 | Slet alt rydder den sagsnære aktive fanehistorik, så sider åbner på deres standardfane. |
| BF-054 | En EET-afgørelse uden datoer oplyses nu som truffet i dokumentet i stedet for at blive påstået ikke-truffet; den bærer ingen referencedato og kan derfor fortsat ikke afgrænse TAF. |
| BF-055 | Slet alle indtastninger er også aktiv ved en afsluttet afvist beregningsdato, så brugeren altid kan rydde siden. |
| BF-056 | Indsæt dags dato bevarer fokus på den aktiverede knap på alle fem flader. |
| BF-057 | Formularfelter og dropdowns har stabile tilgængelige navne, der følger feltets synlige label. |
| BF-058 | To måleartefakter er fjernet: blinket aflæses nu fra en nedskrevet observation i stedet for et kapløb mod den 1,5 s transiente klasse, og animationens top/bund aflæses deterministisk frem for at afhænge af framerate. Felters totrins-indtastning er samlet i én tidsrobust helper (19 kopier i ni filer), og et AST-værn holder begge mønstre ude. |
| BF-065 | Afgjort 2026-08-15: adfærden er en BEVIDST designbeslutning. Hvert tastetryk, der ændrer det valgte i en dropdown ELLER en radiogruppe, er sin egen handling i undo/redo — en bogstav-cykling eller en pil-vandring er en række selvstændige valg, ikke én sammensat handling. Skrevet ind i `input-field-behavior-contract.md` §2.6 og §2.7 og målt af `keyboardChoiceUndoSteps.test.tsx`, så den ikke senere kan fremstilles som en fejl. |
| BF-061 | Trukket tilbage 2026-08-15 efter brugerens indsigelse: agenten havde ikke efterprøvet, at `SpecifikationDownloadBox` kun renderes når `isMobile` er sand, hvilket kun standalone MinProcesrente sætter. Boksen findes derfor slet ikke i Mineo, og dens større knap med beskrivende tekst er en bevidst og korrekt mobil-designbeslutning (større trykfelt, ingen hover-tooltip på mobil). |
| BF-033 | Bortfaldet ved efterprøvning 2026-08-15: paste-matchningen i dropdowns var allerede trimmet og case-insensitiv (`dropdownInteractionCore.ts`, dækket af `StyledDropdown.test.tsx`). Fundet beskrev en tilstand, koden ikke længere var i. |
