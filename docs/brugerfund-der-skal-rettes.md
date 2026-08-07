# Brugerfund

Arbejdslisten bruges til konstaterede fejl og konkrete forbedringsønsker fra brugertest. Ét fund pr. ID.
Beskriv den oplevede adfærd; agenten ejer teknisk analyse, implementeringsplan og statusopdatering.

## Nye fund

Næste ID: **BF-028**. Kopiér denne blok pr. fund:

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

## BF-026 — Inline-bindestreg på linjen med en deaktiveret download-knap

- Type: Fejl
- Sted: Alle steder med en download-knap, der kan være deaktiveret (set bl.a. under "Tilgængelige reguleringssatser"
  i "Indtægt før skadedatoen" på EO oplysninger-fanen)
- Sådan fremprovokeres det:
  1. Bring en side i en tilstand, hvor en download-knap er deaktiveret.
  2. Se linjen, hvor knappen står.
- Det sker: Der indsættes en inline-bindestreg (`-`) på linjen i stedet for knappen.
- Det bør ske: Der skal hverken være inline-tekst eller bindestreg. Bindestregen stammer efter alt at dømme fra
  den tidligere fjernelse af en inline-tekst, brugeren aldrig havde bedt om; erstatningen skulle have været
  ingenting.
- Eksempel/data: Under "Vælg overenskomst" vises overskriften "Tilgængelige reguleringssatser" efterfulgt af
  en linje med kun `-`.
- Prioritet: Mellem
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
| BF-025 | Angivet måneds-/timeløn på en ny sag udløser ikke længere en systemfejl; "en ny sags default" har fået ét sandt sted, og tre værn dækker klassen. |
| BF-027 | Standardværdier fra Indstillinger slår nu igennem på en ny sag med det samme — ikke først når brugeren rører feltet. |

### BF-025 — analyse og løsning

**Fundet.** På en nyåbnet sag uden indtastninger gav valget "Angivet månedsløn" eller "Angivet timeløn" under
"Beregnes ud fra" en runtime-fejl: `eo_snapshot:hidden_angivet_loen_state_invalid` — "EO-snapshot afvist pga.
intern datainkonsistens i angivet løn". Fejlen ramte deterministisk ved allerførste valg.

**Kernen.** Feltet `eoAngivetLoenLoenudvikling.loenPaaHelligdage` ("Løn på helligdage" for angivet løn) var
erklæret tre steder med tre forskellige krav:

- **Schemaet** gjorde det valgfrit — begrundet i, at ældre `.eo`-filer skulle kunne loades uden feltet. Det
  fælles lønudviklings-schema var ligefrem gjort generisk netop for at kunne have to udgaver af dette ene felt.
- **Inputdescriptoren** gjorde det til et valgfrit felt med tomværdien `undefined`, mens dets tvilling under et
  ansættelsesforhold var et required-choice med tomværdien "Almindelig løn".
- **Domænet** krævede en konkret sats: `resolveLoenudviklingKilde` kastede på alt andet, og `computeEoSnapshot`
  havde en forudgående invariant, som fail-closede og rapporterede en systemfejl.

Dertil kom, at feltet **ikke har nogen editor** noget sted i programmet. Værdien kunne altså aldrig blive andet
end tomværdien, og tomværdien var netop den tilstand, motoren erklærede umulig. Enhver ny sag startede dermed
inde i den forbudte tilstand, og valget af angivet løn var blot det, der fik motoren til at kigge efter.

**Hvorfor ingen test så det.** Sektionerne er `null`, indtil brugeren rører sit første felt; først dér oprettes
sektionen fra `createEmptyErstatningsopgoerelseSection` + schemaets defaults. Men suitens fixtures — herunder det
eksisterende værn `eoReguleringInvariantReachability` mod præcis denne klasse af fejl — bygger på
`createErstatningsopgoerelseInitialValues`, en fabrik ingen produktionssti kalder, og som netop udfylder feltet.
Testene målte altså en rigere sag, end produktionen nogensinde er i.

**Klassen bagved.** Tre mekanismer lod en domæne-umulig tilstand blive produktionens default, og hver af dem kan
ramme andre felter:

1. To rivaliserende konstruktioner af "en ny sektion" — den levende (schema-defaults) og den døde
   (`create*InitialValues`) — hvor kun den døde bruges af tests.
2. Samme logiske felt erklæret med forskellige krav i schema, descriptor og domænetype, uden noget der tvinger
   dem til at være enige.
3. Katalogfelter uden editor, hvis værdi derfor altid er tomværdien, mens en invariant kræver mere.

**Løsningen.** Feltet er gjort required-with-default ("Almindelig løn") i både schema og descriptor — samme
behandling årslønssektionen fik i persist-version 3.4. Load-tolerancen består (en ældre `.eo` uden feltet får
defaulten), men `undefined` kan ikke længere repræsenteres. Både invarianten i `computeEoSnapshot`, motorens
defensive kast og validatorreglen "Løn på helligdage skal vælges" er derfor fjernet: de vogtede en tilstand,
typen nu udelukker. `PERSISTED_DATA_VERSION` er bumpet til 3.12.

Derudover er klassen lukket med tre værn, beskrevet i `docs/architecture/input-architecture.md` §2.11:

- `freshCaseChoiceSweep.test.ts` — fejer hvert statisk valg-/kontaktfelt gennem hver af sine valgmuligheder fra
  præcis den tilstand, `initializeInputRuntime` giver en ny sag, og kører hele domænets læsesti. Ingen systemfejl
  og ingen exception må forekomme. Fejningen er katalogdrevet, så nye felter og nye enum-værdier dækkes
  automatisk. Valgmængden er gjort opregnelig ved at eksponere den på feltets codec (`FieldCodec.options`).
  Værnet er efterprøvet ved at genindføre fejlen: det bliver rødt og navngiver både feltet og de to valg.
- `freshSectionDefaults.test.ts` — kræver, at descriptorens tomværdi og den friske sektions faktiske værdi er
  enige for hvert statisk felt i hver sektion, så et felt ikke kan have to defaults.
- `newCaseFixtureParity.test.ts` — kræver, at den gamle new-case-fabrik kun afviger fra den levende sektion på
  erklærede punkter, så en testfixture ikke igen kan være rigere end produktionens sag.

**Åbne forhold, der ikke blev rettet her.** Fejningen afdækkede, at AppSettings-afledte standardvalg ikke slog
igennem på en ny sag. Det er nu rettet som **BF-027** nedenfor. Tilbage står, at
`eoAngivetLoenLoenudvikling`-feltene `loenPaaHelligdage`, `feriePct` og `saerligFraDatoRegulering` fortsat ingen
editor har; efter rettelsen er de harmløse, men de er uindtastelige felter i kataloget.

### BF-027 — analyse og løsning

**Fundet.** Indstillinger → Standardværdier lovede værdier, en ny sag aldrig fik. Slog brugeren "Udkast-stempel
på nye dokumenter" til, stod "Indsæt udkast-stempel" på EO oplysninger stadig på "Nej" i hver ny sag, og den
hentede erstatningsopgørelse kom uden UDKAST-vandmærke. Ingen fejl, ingen advarsel — kun et program, der gjorde
noget andet end det, indstillingen sagde. Samme mønster ramte "Bilagsnumre i erstatningsopgørelser",
"Opgørelse afsluttes med", "Svie/smerte-sats ved delvis sygemelding" og — på Årsløn-siden — "Løn indtastes som".

**Kernen.** Koblingen til AppSettings fandtes kun i `create<Sektion>InitialValues`-fabrikkerne, og dem kalder
ingen produktionssti. Den levende sag blev født ét af to steder: bootstrap-hydrationen (som kun havde en seed
for Satsers default-år) eller reducerens materialisering af en sektion, første gang brugeren rørte et felt på
siden — og den kender kun schemaet. Indstillingerne nåede derfor aldrig ind i en sag. Rækkeniveauet virkede,
fordi `createDefaultLoenindkomstAnsaettelsesforhold` faktisk kaldes, når brugeren tilføjer et ansættelsesforhold.

**Klassen bagved.** Tre forhold hang sammen med det samme:

1. **`Slet alt` gav et andet udgangspunkt end en frisk session.** Kommandoen ryddede til bar `null`, så selv
   Satsers default-år — det ene, der faktisk virkede — forsvandt permanent efter et `Slet alt`.
2. **Ny-sags-defaults havde ingen ejer.** Der var ét seed-hook, ét sæt fabrikker uden kaldere og ét schema, og
   ingen af dem var udpeget som svaret på "hvad indeholder en ny sag?".
3. **Overwrite-gaten forvekslede programmets standardværdier med brugerens data.** `hasAnyData` talte udfyldte
   felter, så et nyåbnet program med et seedet satsår allerede advarede om at overskrive "dine data" ved `Hent`.

**Løsningen.** "En ny sag" har fået ét sandt sted. `src/inputCore/newCaseSections.ts` ejer typen og
sammenfletningen af ny-sags-seeds, `createNewCaseInput` bygger den færdige sag, og `src/domain/newCaseSeed.ts`
komponerer domænets seeds pr. slice (satser, årsløn, erstatningsopgørelse). Samme konstruktion bruges nu tre
steder — bootstrap, `Slet alt` (kommandoen bærer seeden) og overwrite-gatens baseline — så en sags udgangspunkt
ikke længere afhænger af, hvordan den blev født. `composeNewCaseSeeds` kaster, hvis to slices vil eje samme
sektion. Fabrikkerne er skrevet om til at bygge på præcis de samme defaults, så en testfixture ikke igen kan
være en anden sag end brugerens. `hasAnyData` måler nu afvigelse fra en ny sag frem for "findes der en udfyldt
værdi?" — en urørt sektion tæller aldrig som brugerdata.

Klassen er lukket med et nyt værn, `newCaseSettingsDefaults.test.ts`, som måler VIRKNINGEN og ikke koblingen:
for hver nøgle i `NEW_CASE_DEFAULT_SETTINGS_KEYS` skal en ændret værdi ændre enten den nye sags indhold eller en
nytilføjet rækkes indhold. Listen er samtidig fuldstændighedstjekket, så en ny `default*`-indstilling ikke kan
tilføjes uden enten at blive koblet på eller eksplicit erklæret som ikke-sagsdata. Arkitekturen er beskrevet i
`docs/architecture/input-architecture.md` §2.11 og kontraktligt fastlagt i `src/contracts/app-settings.md`.

Senest opdateret: 7. august 2026. De rettede fund er automatiseret verificeret. Visuel browserverifikation
af BF-003, BF-004, BF-008 og BF-014 udestår, fordi ingen styrbar browser var registreret.

BF-005's andet symptom (rækken slettes ikke, når alle dens indtastninger fortrydes) er IKKE reproduceret
selvstændigt. Det blev efterprøvet på tre måder — history-algebraen, en integrationstest med beløbscelle og en
med datocelle — og rækken blev slettet hver gang. Rækkeoprettelsen ER promoveringen, og undo er LIFO, så det
sidste undo i en række fjerner altid rækken; invarianten er nu pinnet af en test på en række med flere
indtastninger efter en fuld undo/redo-rundtur. Symptomet var af brugeren beskrevet som betinget af den
fejlagtige fokustilstand, rettelsen fjerner. Optræder det igen, er den mest lovende hypotese en spuriøs
history-frame fra en blur-commit, når den fokuserede celle unmountes uden fokusrestore (jf. `restoreFocusFlag`).

