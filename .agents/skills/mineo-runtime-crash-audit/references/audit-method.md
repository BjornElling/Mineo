# Auditmetode

## Indhold

1. Forventningsgrundlag og spørgsmål
2. Dækningsmodel
3. Inputpartitioner
4. Sekvens- og afhængighedstest
5. Parallel logik, skæringer og downstream-forbrug
6. Orakler og klassifikation
7. Reproduktion og evidens
8. Fremdrift og genoptagelse

## 1. Forventningsgrundlag og spørgsmål

Brug følgende rækkefølge, når korrekt adfærd skal fastlægges:

1. `src/contracts/contract-topology.json` fastlægger hvilke kontrakter der er bindende.
2. Den relevante kontrakt og dens hierarki beskriver den normative brugeradfærd.
3. Koden, field descriptors, schemas, validators og eksisterende brugerflows viser den konkrete implementering og kan beskrive en entydig hensigt, hvor kontrakten ikke siger noget.
4. Hvis kontrakt og kode strider mod hinanden, registrér afvigelsen i `OBSERVATIONS.md`. Afgør ikke selv, om kontrakten eller koden skal ændres.
5. Hvis korrekt adfærd ikke kan udledes sikkert, opret `Q-NNN` i `QUESTIONS.md`. Beskriv de konkrete alternativer, den observerede forskel, kilderne og hvilke rækker der afventer svar.

Et spørgsmål må kun handle om den manglende beslutning om korrekt adfærd. Et allerede observeret brud på en klar kontrakt skal registreres som observation eller crashfund, også hvis brugeren senere skal tage stilling til den ønskede løsning.

Ved mistanke om juridisk eller beregningsteknisk fejl:

- kontrollér om samme handling giver forskellige resultater på forskellige flader eller gennem forskellige sekvenser;
- registrér den konkrete forskel, den anvendte inputværdi og alle relevante kilder;
- skriv ikke, at en domæneregel er forkert;
- registrér en `Beregningsobservation` og et spørgsmål, hvis den ønskede regel ikke kan udledes.

## 2. Dækningsmodel

Brug kildekoden som white-box-kort og browseren som sandhed om observerbar runtimeadfærd. Dækningsenheden er:

`browser × viewport × flade × felt/handling × inputpartition × settle-handling × forudgående tilstand × branch × downstream-forbruger`

Byg et praktisk, endeligt inventar i disse lag:

1. **Browsere og viewports:** Chrome, Edge og Firefox; minimum 1920×1080 samt mindst én større desktop-viewport. Manglende browser eller viewport er et eksplicit dækningshul.
2. **Flader:** login, global shell, route, side, fane, dialog, overlay, tabel, hjælp, indstillinger, fejl-/stoptilstand og dokumenthandling.
3. **Editorer:** tekst, tal, beløb, procent, år, uge, dato, dropdown, autocomplete, toggle, radio og tabelcelle.
4. **Branches:** modevalg, optionalitet, presence-checks, schema-unions, featurebetingelser, skæringsregler og fejl-/fallbackgrene.
5. **Afhængighedskanter:** input A ændrer grænse, muligheder, synlighed eller fortolkning for B; B forbruges af validator, opslag, beregning, selector, persistence eller dokument.
6. **Tilstandsovergange:** tom → udfyldt → ugyldig → rettet → ryddet; mode A → B → A; åben draft → navigation/re-render/handling; gemt → ændret → genindlæst.
7. **Parallelle concerns:** flere implementationssteder eller brugerflader, som tilsyneladende løser samme opgave.

Afstem inventaret begge veje: enhver synlig editor skal have en kildeidentitet, og enhver registreret feltdefinition, branch eller handler skal findes i en brugerflade eller markeres som mulig død/afvigende kode i `OBSERVATIONS.md`.

En række er ikke dækket, fordi én happy path virker. Alle relevante partitioner, branches, sekvenser, downstream-forbrugere og understøttede browsere skal være håndteret.

## 3. Inputpartitioner

Vælg kun relevante partitioner pr. editortype, men spring aldrig en aktiv grænse eller settle-måde over.

### Fælles tekstadfærd

- tom streng, kun mellemrum, leading/trailing whitespace og gentagne mellemrum;
- ét tegn, delvis token og meget lang tekst;
- dansk tegnsæt, kombinerende Unicode, emoji, linjeskift og højre-mod-venstre-tegn;
- typing ét tegn ad gangen, hurtig typing, paste og select-all/replace;
- blur, Enter, Tab/Shift+Tab, Escape, klik udenfor og navigation mens draft er åben;
- Delete/Backspace i fokuseret ikke-redigerende tilstand og efter tidligere ugyldig/gældende værdi.

### Tal, beløb, procent, år og uge

- `0`, negativt fortegn, plusfortegn, heltal og decimal;
- dansk/engelsk separator, tusindtalsseparator, gentagne separatorer, whitespace og delvise værdier som `-`, `,` og `1,`;
- eksponentnotation, `NaN`, `Infinity`, ekstrem længde, leading zeros og Unicode-cifre;
- schemaets repræsentationsgrænser samt alle aktive domænegrænser ved under/præcis/over;
- værdi der er format- og schema-gyldig, men domænemæssigt out-of-bounds;
- gentagen redigering af samme værdi, rydning, undo/redo og genindtastning efter rejected input.

### Datoer

- tom og delvis dag/måned/år; ugyldig kalenderdato; skuddag i skudår og ikke-skudår;
- månedsskifte, årsskifte, meget tidlig/sen schema-repræsenterbar dato;
- aktiv minimum/maksimum ved dagen før, præcis dato og dagen efter;
- enhver hardcoded eller dataafledt skæringsdato ved dagen før, på dagen og dagen efter;
- kronologiske relationer i begge retninger samt situationen `min > max`;
- ændring af den dato, som andre felters grænser, opslag eller beregninger allerede bygger på.

### Valg og sammensatte flader

- hvert menupunkt og hver toggle-/radiokombination;
- åbne/lukke uden valg, tastaturvalg, genvalg af samme værdi og hurtigt skift;
- udfyld detaljer i mode A, skift til B, brug downstream-funktion, skift tilbage til A;
- tabel: tom række, delvis række, flere rækker, dubletter, slet aktiv/første/sidste række, ændr styrende celle efter afhængige celler og navigér med åben editor;
- overlays/dialoger: åbne/lukke/annullere/bekræfte med tom, delvis, ugyldig og grænseværdi;
- gentagne klik, dobbeltklik, gentagne Enter-tryk, hurtig tabsnavigation og afbrudte handlinger.

## 4. Sekvens- og afhængighedstest

For hver kant `A → B → C`, hvor A styrer B og C forbruger resultatet, test mindst:

1. A først, derefter B, derefter C.
2. B først, derefter A, derefter C.
3. Gyldig A+B, ændr A så B bliver out-of-bounds, brug C.
4. Gyldig A+B, ryd A, brug C, genindsæt A.
5. A-mode 1 + detaljer i B, skift A til mode 2, brug C, skift tilbage.
6. Hold B som åben draft, ændr fokus, navigér eller udløs C efter formkontraktens settle-regler.
7. Gentag efter faneskift, re-render, F5, relevant save/load, nulstilling og undo/redo.
8. Gentag med ændringer foretaget i Chrome, Edge og Firefox ved begge minimums- og større viewports.

Brug pairwise-dækning mellem almindelige partitioner. Brug 3-vejs dækning, når en styrende værdi, et afhængigt felt og en downstream-forbruger mødes. Enumerér alle kombinationer for små mode-/boolean-sæt, især når branches er nested. Brug lange og nye sekvenser i senere auditpasses; de må ikke erstatte de deterministiske matrixrækker.

## 5. Parallel logik, skæringer og downstream-forbrug

Find parallelle implementationssteder ved at sammenholde:

- samme felt- eller handlingstype på flere sider;
- fælles problemer som parsing, formatting, settle, datoer, bounds, fejlfeedback, navigation, undo/redo og persistence;
- samme data, der læses af flere selectors, opslag, beregninger eller dokumenter;
- samme brugerhandling udført via formular, tabel, dialog, tastatur og global handling.

Hvis to tilgange ser ud til at løse samme problem, afprøv identiske og nærliggende input på begge flader. Registrér både ensartethed og afvigelse; en afvigelse er et fund, medmindre den er tydeligt dokumenteret og ønskelig.

Find skæringer via schemas, constants/datafiler, validators, selectors, beregningsengines og kontrakter. Søg både dato-literals og semantiske navne som `fra`, `til`, `before`, `after`, `cutoff`, `effective`, `regel`, `version` og `grænse`.

For hver skæring:

- dokumentér kilden og hvilken regelgren den vælger;
- test før/på/efter med ellers minimale gyldige data;
- varier alle felter, der kun findes eller fortolkes i én side af skæringen;
- udfyld først under én side og flyt derefter den styrende værdi over skæringen;
- kør hver faktisk forbruger: synlig afledning, opslag, beregning, dokumentgate/generering og persistence, hvis relevant;
- registrér mærkelig eller forskellig taladfærd som observation uden at erklære den juridisk forkert.

## 6. Orakler og klassifikation

### Crash- og systemfund

Brug `CRASHES.md`, når brugerhandlingen medfører mindst ét af følgende:

- uncaught exception/rejection, `pageerror` eller uventet `console.error`/`console.warn`;
- ErrorBoundary, fallback, fejlrapportmenu eller systemfejlnotifikation uden dokumenteret forventning;
- page/browser-crash, blank side, permanent spinner, frys eller UI der ikke længere kan bruges;
- brudt invariant med konkret risiko for datatab eller uforudsigelig runtimeadfærd;
- usynligt systemsignal, der viser en fejltilstand selv om appen tilsyneladende fortsætter.

Forventet rød kant/tooltip ved ugyldigt input er ikke et crashfund, når kontrakten og brugerfladen viser, at det er den tilsigtede reaktion.

### Adfærds- og øvrige fund

Brug `OBSERVATIONS.md` ved:

- inkonsistent håndtering af samme input eller handling på to flader;
- afsluttet input der forsvinder eller ændres uden tilsigtet handling;
- afvigelse mellem kontrakt, schema, kode og UI uden observeret runtimefejl;
- mistænkelig beregning/opslag, død eller parallel logik, utilgængeligt felt eller manglende feedback;
- forskellig settle-, undo/redo-, navigation-, save/load- eller dokumentadfærd;
- flakiness eller et mønster, der kræver juridisk, beregningsteknisk eller UX-mæssig afklaring.

### Uafklaret forventet adfærd

Brug `QUESTIONS.md`, når auditten ikke kan udlede den korrekte brugeradfærd. Et spørgsmål skal vise:

- den konkrete brugerhandling og starttilstand;
- de observerede eller tænkelige alternativer;
- kontrakt-/kodegrundlaget, der ikke afgør valget;
- hvad der skal besluttes;
- hvilke dækningsrækker der afventer beslutningen.

## 7. Reproduktion og evidens

Reproducer fra en kendt baseline mindst to gange. Minimér med delta-metoden: fjern én forudgående handling eller værdi ad gangen, indtil den korteste stabile sekvens er fundet. Kontrollér derefter én nærliggende ikke-fejlende kontrast, når det kan gøres sikkert.

En post skal indeholde de oplysninger, der er nødvendige for at finde den igen:

- build/commit, dirty-state, browser og viewport;
- route, side, fane og starttilstand;
- nummererede UI-handlinger med nøjagtige syntetiske værdier;
- settle-måde, fokus-/navigationstrin og rækkefølge;
- første synlige eller systemtekniske signal, præcis fejltekst og relevant stacktop ved systemfund;
- observeret adfærd, sammenligningsgrundlag og berørte downstream-forbrugere;
- reproduktionsrate, minimal kontrast og relaterede dæknings-/fund-/spørgsmåls-id'er;
- screenshot/trace kun når det er nødvendigt for synlig, timing-, fokus- eller sekvensafhængig adfærd.

Kopiér den nødvendige tekst til posten, fordi `test-results` kan blive ryddet. Medtag aldrig persondata eller store logs.

## 8. Fremdrift og genoptagelse

Brug statusserne `Ikke startet`, `I gang`, `Dækket`, `Afventer afklaring` og `Blokeret`. En række er kun `Dækket`, når dens matrix, forventningsgrundlag, branches, afhængighedsovergange, relevante downstream-forbrugere og browser-/viewportvariationer er kørt, eller et dokumenteret identisk forhold er dækket som en del af samme arbejdsenhed.

Hold én aktiv arbejdsenhed. Skriv efter hver batch:

- senest afsluttede scenario-id;
- præcist næste scenario-id og nødvendige starttilstand;
- hvilke partitioner, branches, browsere og viewports der mangler;
- fund-id'er, spørgsmål-id'er og eventuel blokering.

Ved ukontrolleret afbrydelse behandles `I gang` som ikke-pålidelig deldækning: genkør hele den lille arbejdsenhed. En blokering eller et uafklaret spørgsmål må ikke standse andre uafhængige rækker.
