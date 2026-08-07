# Brugerfund

Arbejdslisten bruges til konstaterede fejl og konkrete forbedringsønsker fra brugertest. Ét fund pr. ID.
Beskriv den oplevede adfærd; agenten ejer teknisk analyse, implementeringsplan og statusopdatering.

## Nye fund

Næste ID: **BF-028**. Kopiér denne blok pr. fund:

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
| BF-020 | Den røde blinkmarkering er løftet ud af Årslønssidens løntabel til én delt mekanisme, enhver flade arver. |
| BF-021 | Interne fejl-/advarselslinks fører nu til feltet OG blinkmarkerer det; samme markering bruges af et blokeret Gem. |
| BF-022 | "Offentlige ydelser i beregningsperioden reguleres" er flyttet til Offentlige ydelser-fanen, under Midlertidigt EET-togglen. |
| BF-023 | Ydelsestype-dropdownen sorteres alfabetisk inden for hver af de to grupper; rækkefølgen ejes af registeret. |
| BF-025 | Angivet måneds-/timeløn på en ny sag udløser ikke længere en systemfejl; "en ny sags default" har fået ét sandt sted, og tre værn dækker klassen. |
| BF-026 | Den bare bindestreg på linjen med "Tilgængelige reguleringssatser" er væk — et ukendt interval viser nu ingenting. |
| BF-027 | Standardværdier fra Indstillinger slår nu igennem på en ny sag med det samme — ikke først når brugeren rører feltet. |

### BF-020 og BF-021 — analyse og løsning

**Fundet.** Årslønssidens løntabel kunne få en celle til at blinke rødt, men ingen anden flade kunne. Samtidig
førte de interne fejl-/advarselslinks brugeren hen til feltet uden at markere det, så brugeren selv skulle finde
det blandt de øvrige felter på siden — især efter et side- eller faneskift.

**Kernen.** De to fund er det samme fund set fra hver sin side. Programmet havde allerede ÉN feltidentitet i DOM
(`data-mineo-field-address`) og tre veje, der bruger den til at lokalisere et felt: undo/redo-fokusrestoren,
save-blokeringens fokus og fejllinkene. Navigationen var altså løst; det var kun det visuelle svar, der manglede
— og det ene sted, det fandtes, var indelukket. Blinket i løntabellen var React-state (`flashCell`) nøglet på et
cellekoordinat (`rowId` + `colIdx`) med sin egen `@keyframes errorFlash` i en `<style>`-tag i tabellen. Hverken
koordinatet eller animationen kunne bruges af en anden flade, og en formularfelt-flade har slet ikke et
cellekoordinat.

**Løsningen.** Markeringen er løftet ud til `src/inputCore/react/fieldAttentionBlink.ts` og gjort til en ren
DOM-effekt frem for React-state. Det er dét valg, der gør den generelt tilgængelig: en CSS-klasse kan lægges på
ethvert element, en feltadresse peger på, uden at feltkomponenten kender til markeringen, holder state eller
opter ind. Et nyt felt eller en ny tabel arver blinket alene ved at bære feltadressen, som surfacen allerede
sætter. Animationen bor nu ét sted (`sharedApp.css`) og respekterer `prefers-reduced-motion`.

Alle tre fokusveje afslutter nu med samme markering: fejllinkene (`scrollToEoRow`) blinker det element, de
scrollede til, og save-blokeringen blinker det felt, den fokuserede. `scrollWithRetry.onSuccess` giver det fundne
element med, så kalderen ikke skal gentage opslaget og risikere at ramme et andet element end det, der blev
scrollet til. Løntabellens private flash er væk; dens vedvarende «indtastning mangler»-markering bruger nu den
delte klasse, men beholder sin egen semantik — den BLIVER stående, indtil cellen er udfyldt, hvor et blink er
kortvarigt. `StandardGridTable.beforeTable`, som kun fandtes for at injicere de gamle keyframes, er fjernet.

Markeringen er rent visuel: den ændrer ingen værdi, sætter ingen feltfejl og blokerer intet. Har en fejl intet
enkelt ansvarligt felt (fx et overlap mellem to rækker), markeres rækkeankeret — det grovere, men stadig sande
mål. Arkitekturen er beskrevet i `docs/architecture/input-architecture.md` §1.8.

Værnet er efterprøvet ved at fjerne blinket fra linkstien: begge de nye integrationstests bliver da røde.

### BF-022, BF-023 og BF-026 — kort

**BF-022.** Togglen er flyttet til Offentlige ydelser-fanen under Midlertidigt EET-togglen. Feltet selv er
uændret; det er editorlokationen, der er flyttet, og dermed den fane fokusnavigationen fører brugeren til.
Synligheden var før en JSX-condition (`beregnesUdFra === 'Beregningsperiode'`) på den gamle fane. Den betingelse
matcher præcis beregningsrelevansen — motoren danner kun reguleringsmodellen, når der findes en beregningsperiode
— så den er bevaret og samtidig givet et navn i det delte relevans-modul
(`erOffentligeYdelserReguleringRelevant`), så synlighed og calc-relevans har ét sandt sted. Et flyttet felt måtte
ikke få en bredere synlighed end den, beregningen faktisk har.

**BF-023.** Dropdownens to grupper og deres indbyrdes alfabetiske rækkefølge udledes nu i registeret
(`primaereYdelsestypeKeys`/`supplerendeYdelsestypeKeys`) frem for at være en håndholdt liste i tabellen.
Objektliteralens nøglerækkefølge kunne ikke bære reglen: den sorterer efter NØGLE (`su` før `uddannelseshjaelp`,
`ressourceforloebsydelse` før `revalideringsydelse`), mens brugeren ser LABELS — 'SU' skal stå efter 'Ress.
forløbsydelse' — og æ/ø/å falder forkert uden dansk kollation. Stregen og gruppernes indhold er uændret.
Kontrakten er noteret i `src/contracts/periodisering-contract.md` §4.

**BF-026.** Bindestregen var fallback-værdien (`|| '-'`), når reguleringsdato-intervallet er ukendt. Linjen viser
nu ingenting i det tilfælde. De øvrige bindestreger i programmet står i datatabellers talkolonner som
pladsholder for en tom celle og er en anden — og gyldig — brug.

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

Senest opdateret: 7. august 2026. De rettede fund er automatiseret verificeret.

**Blinkmarkeringen er nu set i en browser.** Forbeholdet om BF-020/BF-021 er indfriet: `e2e/field-attention-blink.spec.ts`
kører markeringen i Chromium gennem projektets Playwright-opsætning og måler den BEREGNEDE baggrund over tid —
altså det, der faktisk males, ikke den erklærede regel. Målingen bekræfter fejlrød (`#ef4444`, 20 % blanding),
en puls der når sin top og er nede igen, og samme adfærd på begge flader: MUI-formularfeltet på Stamdata og
grid-cellen i Årslønstabellen. Under `prefers-reduced-motion: reduce` bliver markeringen et roligt statisk felt —
den forsvinder ikke, så brugeren stadig kan se hvilket felt der peges på. Testene er mutationsprøvet i tre trin:
fjernes `!important` (MUI's baggrundsregler vinder da), ændres farven, eller fjernes den statiske tone under
reduceret bevægelse, bliver præcis de relevante cases røde — og kun dem.

Visuel browserverifikation af BF-003, BF-004, BF-008 og BF-014 udestår fortsat. Det samme gælder BF-022 og
BF-026, hvor mekanismen er dækket af tests (togglen står på den rigtige fane, bindestregen er væk), men det
visuelle indtryk ikke er efterset.

BF-005's andet symptom (rækken slettes ikke, når alle dens indtastninger fortrydes) er IKKE reproduceret
selvstændigt. Det blev efterprøvet på tre måder — history-algebraen, en integrationstest med beløbscelle og en
med datocelle — og rækken blev slettet hver gang. Rækkeoprettelsen ER promoveringen, og undo er LIFO, så det
sidste undo i en række fjerner altid rækken; invarianten er nu pinnet af en test på en række med flere
indtastninger efter en fuld undo/redo-rundtur. Symptomet var af brugeren beskrevet som betinget af den
fejlagtige fokustilstand, rettelsen fjerner. Optræder det igen, er den mest lovende hypotese en spuriøs
history-frame fra en blur-commit, når den fokuserede celle unmountes uden fokusrestore (jf. `restoreFocusFlag`).

