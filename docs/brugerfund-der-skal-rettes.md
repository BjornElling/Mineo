# Brugerfund

Arbejdslisten bruges til konstaterede fejl og konkrete forbedringsønsker fra brugertest. Ét fund pr. ID.
Beskriv den oplevede adfærd; agenten ejer teknisk analyse, implementeringsplan og statusopdatering.

## Nye fund

Næste ID: **BF-057**. Kopiér denne blok pr. fund:

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

## BF-057 — Formularfelter mangler tilgængelige navne

- Type: Fejl
- Sted: Formularfelter på beregningssiderne; konkret Stamdata → Sagsinfo → `Journalnr.` og tilsvarende tekst-, dato-, beløbs- og dropdownfelter.
- Sådan fremprovokeres det:
  1. Log ind gennem den synlige loginformular.
  2. Åbn Stamdata og gå til `Journalnr.` med Tab, eller inspicér feltet med en skærmlæser/rollebaseret værktøj.
  3. Forsøg at finde feltet på den synlige etiket `Journalnr.`.
- Det sker: Den synlige tekst står som et separat afsnit ved siden af inputfeltet og er ikke semantisk bundet til det. Inputfeltet har hverken tilgængeligt navn, `label`-binding eller `aria-labelledby`; `Journalnr.` kan derfor ikke findes som et textbox med dette navn. Det samme mønster rammer bl.a. `Skadelidtes navn`, `Fødselsdato` og `Skadedato`. I de aktive standardfaner blev alle viste tekstfelter navnløse: 6/6 på Stamdata, 6/6 på Erstatningsopgørelse, 25/25 på Erhvervsevnetab, 16/16 på Varige mén, 2/2 på Forsørgertab, 6/6 på Årslønsberegning, 17/17 på Renteberegning, 5/5 på Satser og 1/1 på Indstillinger. Flere viste comboboxes mangler også et navn.
- Det bør ske: Hvert interaktivt tekstfelt og hver dropdown skal have et stabilt tilgængeligt navn, der svarer til den synlige etiket. Navnet skal være tilgængeligt for skærmlæsere og rolle-/navnebaseret tastaturnavigation og må ikke afhænge af placeholdertekst. Den fælles løsning bør dække alle feltfamilier, så rettelsen ikke skal gentages enkeltvis på hver side.
- Påvirkning: Ingen direkte ændring af beregnede tal, gemte data eller dokumenter, men næsten alle sagsinput er vanskeligere eller umulige at identificere for brugere af skærmlæser og andre hjælpemidler.
- Prioritet: Høj
- Status: Løst
- Løsning: De fælles feltbaser kræver nu et tilgængeligt navn, og persisted feltskaller henter det automatisk fra felt-descriptorens synlige label. Direkte kontroller uden `FieldRef` skal angive en eksplicit label, så nye felter ikke kan introduceres uden navn.
