# Brugerfund

Arbejdslisten bruges til konstaterede fejl og konkrete forbedringsønsker fra brugertest. Ét fund pr. ID.
Beskriv den oplevede adfærd; agenten ejer teknisk analyse, implementeringsplan og statusopdatering.

## Nye fund

Næste ID: **BF-025**. Kopiér denne blok pr. fund:

```md
## BF-020 — Kort titel

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

## BF-020 — Gør rød celleblinkning generelt tilgængelig

- Type: Forbedring
- Sted: Alle sider og inputfelter/celler
- Det sker: På årslønberegning-siden findes der allerede funktionalitet, som kan få baggrunden i en celle til at blinke rødt.
- Det bør ske: Funktionaliteten gøres generelt tilgængelig, så den kan bruges på relevante inputfelter og celler på alle sider.
- Prioritet: Mellem
- Status: Ny

## BF-021 — Link til fejl blinkmarkerer det relevante inputfelt

- Type: Forbedring
- Sted: Contentbokse med fejl og advarsler samt andre interne links, der peger på manglende eller fejlbehæftede indtastninger
- Sådan fremprovokeres det:
  1. Åbn en contentboks med en fejl eller advarsel, eller et andet sted med et internt link til en indtastning.
  2. Klik på linket.
- Det sker: Der er ikke en generel funktionalitet, som fører brugeren til den relevante side og det inputfelt, der kræver opmærksomhed, med en tydelig visuel markering.
- Det bør ske: Brugeren føres til den side, hvor den pågældende indtastning findes, og siden scrolles ned til inputfeltet. Baggrunden i det relevante inputfelt blinker derefter rødt, så brugeren tydeligt kan se, hvor indtastningen skal foretages eller rettes.
- Prioritet: Mellem
- Status: Ny

## BF-022 — Flyt regulering af offentlige ydelser til korrekt fane

- Type: Forbedring
- Sted: EO oplysninger-fanen og Offentlige ydelser-fanen i erstatningsopgørelsen
- Det sker: Valgmuligheden "Offentlige ydelser i beregningsperioden reguleres" findes på EO oplysninger-fanen.
- Det bør ske: Valgmuligheden flyttes til Offentlige ydelser-fanen og placeres umiddelbart under "Midlertidigt EET indsættes fra Erhvervsevnetab-siden".
- Prioritet: Mellem
- Status: Ny

## BF-023 — Sortér ydelsestyper alfabetisk i hver sin gruppe

- Type: Forbedring
- Sted: Offentlige ydelser-fanen, dropdown-menuen under "Ydelsestype"
- Det sker: Valgmulighederne i dropdown-menuen er ikke nødvendigvis sorteret alfabetisk inden for grupperne over og under stregen.
- Det bør ske: Valgmulighederne over stregen sorteres alfabetisk indbyrdes, og valgmulighederne under stregen sorteres alfabetisk indbyrdes. Stregen og opdelingen mellem de to grupper bevares; valgmulighederne må ikke blandes på tværs af stregen.
- Prioritet: Mellem
- Status: Ny

## BF-024 — Begræns kapitaliseringstabeller til skader fra 1. januar 2005

- Type: Forbedring
- Sted: Kapitaliseringsbekendtgørelser, kapitaliseringstabeller, importværktøjer og tilhørende kontrakter/dokumentation
- Det sker: Kapitaliseringsmaterialet og dokumentationen afgrænser ikke konsekvent kapitaliseringsfaktorerne til programmets understøttede sagsområde. Dokumentationen beskriver desuden princippet med afløsningsbeløb som et forsørgertabsforhold i stedet for som et fælles princip.
- Det bør ske: Kapitaliseringsbekendtgørelserne gennemgås grundigt ved opslag i den tilhørende PDF-fil, så det dokumenteres, hvilke skader de enkelte tabeller vedrører. Kapitaliseringstabeller, der kun omhandler skader før 1. januar 2005, udgår. Kontrakter, anden dokumentation og de særlige hjælpeværktøjer til import af kapitaliseringsbekendtgørelser skal tydeligt fastslå, at der kun må indgå kapitaliseringsfaktorer for skader fra og med 1. januar 2005. Dette gælder både kapitalisering af erhvervsevnetab og omsætning af forsørgertab. Det skal samtidig præciseres, at afgrænsningen er et generelt princip for begge områder uden forskel. Det bør desuden fremgå som kommentarer i programfilerne ved de gengivne tabeller, hvilke skader tabellerne vedrører — programmet skal aldrig behandle skader før 1. januar 2005.
- Prioritet: Høj
- Status: Ny

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

Senest opdateret: 7. august 2026. De rettede fund er automatiseret verificeret. Visuel browserverifikation
af BF-003, BF-004, BF-008 og BF-014 udestår, fordi ingen styrbar browser var registreret.

BF-005's andet symptom (rækken slettes ikke, når alle dens indtastninger fortrydes) er IKKE reproduceret
selvstændigt. Det blev efterprøvet på tre måder — history-algebraen, en integrationstest med beløbscelle og en
med datocelle — og rækken blev slettet hver gang. Rækkeoprettelsen ER promoveringen, og undo er LIFO, så det
sidste undo i en række fjerner altid rækken; invarianten er nu pinnet af en test på en række med flere
indtastninger efter en fuld undo/redo-rundtur. Symptomet var af brugeren beskrevet som betinget af den
fejlagtige fokustilstand, rettelsen fjerner. Optræder det igen, er den mest lovende hypotese en spuriøs
history-frame fra en blur-commit, når den fokuserede celle unmountes uden fokusrestore (jf. `restoreFocusFlag`).
