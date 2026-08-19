# Brugerfund

Arbejdslisten bruges til konstaterede fejl og konkrete forbedringsønsker fra brugertest. Ét fund pr. ID.
Beskriv den oplevede adfærd; agenten ejer teknisk analyse, implementeringsplan og statusopdatering.

## Nye fund

Næste ID: **BF-071**. Kopiér denne blok pr. fund:

```md
## BF-028 – Kort titel

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

## Udestående beslutninger

Ingen fund afventer beslutning. De seks poster, der stod her, blev afgjort og rettet 2026-08-15 og er
flyttet til den korte log nedenfor.

## Afventer reproduktion

Ingen fund afventer reproduktion.

## Rettet – kort log

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
| BF-012 | Varige mén kræver beregningsdato på eller efter skadedato. |
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
| BF-026 | Den bare bindestreg på linjen med "Tilgængelige reguleringssatser" er væk – et ukendt interval viser nu ingenting. |
| BF-027 | Standardværdier fra Indstillinger slår nu igennem på en ny sag med det samme – ikke først når brugeren rører feltet. |
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
| BF-065 | Afgjort 2026-08-15: adfærden er en BEVIDST designbeslutning. Hvert tastetryk, der ændrer det valgte i en dropdown ELLER en radiogruppe, er sin egen handling i undo/redo – en bogstav-cykling eller en pil-vandring er en række selvstændige valg, ikke én sammensat handling. Skrevet ind i `input-field-behavior-contract.md` §2.6 og §2.7 og målt af `keyboardChoiceUndoSteps.test.tsx`, så den ikke senere kan fremstilles som en fejl. |
| BF-061 | Trukket tilbage 2026-08-15 efter brugerens indsigelse: agenten havde ikke efterprøvet, at `SpecifikationDownloadBox` kun renderes når `isMobile` er sand, hvilket kun standalone MinProcesrente sætter. Boksen findes derfor slet ikke i Mineo, og dens større knap med beskrivende tekst er en bevidst og korrekt mobil-designbeslutning (større trykfelt, ingen hover-tooltip på mobil). |
| BF-033 | Bortfaldet ved efterprøvning 2026-08-15: paste-matchningen i dropdowns var allerede trimmet og case-insensitiv (`dropdownInteractionCore.ts`, dækket af `StyledDropdown.test.tsx`). Fundet beskrev en tilstand, koden ikke længere var i. |
| BF-059 | Grå knapper forklarer sig nu – med programmets EGNE generiske tekster, ikke en ny ordlyd pr. knap (brugerbeslutning 2026-08-15). Reglen for deaktiverede downloadknapper er generaliseret til enhver deaktiveret handling og bor i `components/inputs/actionGate.ts`, som re-eksporterer downloadgatens to konstanter frem for at kopiere dem. «Indsæt» skelner nu «Indtastning mangler» fra «Fejl i indtastning». Knappen er tavs ved klik, forbliver fokusérbar (`aria-disabled` + `aria-describedby`), og forrangen ejes af gaten, ikke af kaldsstedet. |
| BF-060 | Rystelsen er fjernet i HELE programmet (brugerbeslutning 2026-08-15) – alle fem steder, ikke kun `+`-knappen. Der er nu ÉN afvisningsmåde: knappen er synligt og reelt inaktiv med årsagen i tooltippet. Fokusspringet og celle-flashet er bevaret, fordi de peger et sted hen. Hele mekanikken er slettet (`useShakeFlag`, `StyledToggleSwitchHandle` og alle `shake`-props), og fraværet er håndhævet. De runde knapper har fået et stabilt `aria-label`, der følger handlingen og ikke skifter med blokeringen. |
| BF-062 | Den røde fejlboks kan nu lukkes med Escape og med en synlig, navngivet lukkeknap; den oplyses som `role="alert"`. Museklikket på boksen er bevaret som genvej. De auto-lukkende beskeder er bevidst uændrede og lytter IKKE på Escape – de har intet at annullere og ville ellers stjæle tasten fra en åben dialog. |
| BF-063 | Licensvinduet holder nu tastaturet inde via MUI's egen `FocusTrap` – samme primitiv som `Dialog` bruger, ikke en fjerde håndrullet fokusmekanisme. De tre dialogers «konkurrerende fokus-retur» viste sig at være noget andet end antaget: de manglede alle `disableRestoreFocus`, så MUI's egen restore kørte sidst og overskrev den fælles hook. Rettet, og hullet er lukket af en ny AST-regel – den eksisterende regel skar på `focus()`-kald og var blind for netop denne form. |
| BF-064 | Beløbsfeltet i «Find løntrin» er nu totrins som alle andre felter, så de to felter i samme vindue åbnes ens. Det retter samtidig Escape-konsekvensen: et ettrins-felt var altid «åbent» og slugte derfor Escape, så overlayet ikke kunne lukkes derfra. Åbningstegnene udledes af feltets eget tegnsæt frem for en håndskrevet liste. |
| BF-069 | Andet klik på «Omregning til fuldt år» markerede ikke længere den celle, der mangler. Målt med `animationstart`: tre klik gav 1, 1, 1 – efter rettelsen 1, 2, 3. Årsagen var strukturel: løntabellen var den ENESTE flade, der satte blink-klassen DEKLARATIVT ud fra React-state, så andet klik skrev samme værdi, React bailede ud af re-renderen, og der skete intet synligt. Alle øvrige peg-veje brugte i forvejen den delte `blinkFieldAttention`, som genstarter animationen. Undersøgelsen viste desuden, at kodens begrundelse for den deklarative vej – at markeringen skulle «blive stående, indtil værdien er indtastet» – ikke holdt: animationen løber ud efter 1,5 s og efterlader en helt gennemsigtig celle. Den deklarative vej købte altså intet og kostede kun genstarten. Markeringen er nu ét mønster i hele programmet, håndhævet af en AST-regel og målt i fire browsere. |
| BF-067 | Licensvinduet holdt ikke tab-rækkefølgen inde – bekræftet i chrome-desktop, hvor otte Tab i træk alle landede uden for dialogen. `FocusTrap` var monteret og virkede ikke: `Container` ejer Tab for hele siden og gav kun slip på hændelser fra uden for sit DOM-subtræ, så et PORTALERET overlay slap igennem, mens et INLINE monteret ikke gjorde. Sidens navigation kørte derfor forbi trap'ens vagtposter. Åbenhed er nu noget overlayet SIGER (`data-mineo-overlay-root`), ikke noget der udledes af monteringsform. Min forrige jsdom-test var grøn af utilstrækkelighed – JSDOM har ingen tab-traversering – så dækningen ligger nu i e2e. |
| BF-068 | Overlays lukker nu også på musens/browserens tilbage-knap. Før navigerede tilbage SIDEN væk under det åbne vindue (målt: `/mineo` → `/mineo/stamdata`), så brugeren mistede både vinduet og sin plads. Et åbent overlay skubber ét historik-trin, som tilbage forbruger; lukkes overlayet ad anden vej, ryddes trinnet op igen. Samtidig er ALLE overlays samlet om ét fælles regelsæt (`useOverlayBehavior`): cirkulær tab-fangst, de fire lukkeveje (Escape, backdrop, lukkeknap, tilbage) og stak-disciplin ved lag-på-lag. Seks flader havde før tre forskellige Escape-implementeringer og ingen kendte tilbage-knappen. |
| BF-066 | Faneskift settler nu selv den åbne editor gennem den samme `navigate`-handling som sidenavigation, i den delte `PageTabs` – det byggede før på, at museklikket tilfældigvis blur'ede feltet først. Rækkefølgen (settle FØR skift) er målt, og `critical-action-contract.md` har fået faneskift som egen række. |
| BF-070 | «Fejl i indtastning» på en lønrække med komplet periode og intet beløb var symptom på, at gate-klassen blev HARDKODET frem for udledt. Årslønssidens gate kollapsede hele `tableValidation.errors` til én klasse, selv om `TableError.issue` allerede skelnede `invalid` fra `partial_period`/`missing_amount`; Renteberegning svarede «Fejl i indtastning» for en gren, der pr. konstruktion kun kan være en ufuldstændig række; og den delte `classifyBlockingCauses` kunne slet ikke give `invalid-input` for en `row`-årsag, mens et `aggregat` altid blev til «Indtastning mangler» – også dér hvor koden selv skrev, at det ville være forkert. Klassen udledes nu ét sted af en udtømmende `classifyBlockingCause`, aggregat-årsager SKAL bære deres klasse, den døde `blockedProjectionForInvalidInput` er slettet, feltets og knappens «Fejl i indtastning» er nu samme konstant, og `document/gate-class-hardcoded-invalid-input` holder nye hardkodninger ude på nær to auditerede undtagelser. Målt i fire browsere. |
