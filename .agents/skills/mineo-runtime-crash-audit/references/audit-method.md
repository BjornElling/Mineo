# Auditmetode

## Indhold

1. Dækningsmodel
2. Inputpartitioner
3. Sekvens- og afhængighedstest
4. Skæringspunkter og downstream-forbrug
5. Orakler og klassifikation
6. Reproduktion og evidens
7. Fremdrift og genoptagelse

## 1. Dækningsmodel

Brug kildekoden som white-box-kort og browseren som sandhed om observerbar runtimeadfærd. Dækningsenheden er ikke blot et felt, men en tuple:

`flade × felt/handling × inputpartition × settle-handling × forudgående tilstand × branch × downstream-forbruger`

Byg et praktisk, endeligt inventar i disse lag:

1. **Flader:** global shell, route, side, fane, dialog, overlay, tabel og dokumenthandling.
2. **Editorer:** tekst, tal, beløb, procent, år, uge, dato, dropdown, autocomplete, toggle, radio og tabelcelle.
3. **Branches:** modevalg, optionalitet, presence-checks, schema-unions, featurebetingelser og skæringsregler.
4. **Afhængighedskanter:** input A ændrer grænse, muligheder, synlighed eller fortolkning for B; B forbruges af validator, opslag, beregning, selector, persistence eller dokument.
5. **Tilstandsovergange:** tom → udfyldt → ugyldig → rettet → ryddet; mode A → B → A; åben draft → navigation/re-render/handling.

Afstem inventaret begge veje: enhver synlig editor skal have en kildeidentitet, og enhver registreret feltdefinition/branch skal findes i en brugerflade eller markeres som mulig død/afvigende kode i observationer.

## 2. Inputpartitioner

Vælg kun relevante partitioner pr. editortype, men spring aldrig en aktiv grænse over.

### Fælles tekstadfærd

- tom streng, kun mellemrum, leading/trailing whitespace og gentagne mellemrum;
- ét tegn, delvis token og meget lang tekst;
- dansk tegnsæt, kombinerende Unicode, emoji, linjeskift og højre-mod-venstre-tegn;
- typing ét tegn ad gangen, hurtig typing, paste og select-all/replace;
- blur, Enter, Tab/Shift+Tab, Escape, klik udenfor og navigation mens draft er åben;
- Delete/Backspace i fokuseret ikke-redigerende tilstand.

### Tal, beløb, procent, år og uge

- `0`, negativt fortegn, plusfortegn, heltal og decimal;
- dansk/engelsk separator, tusindtalsseparator, gentagne separatorer, whitespace og delvise værdier som `-`, `,` og `1,`;
- eksponentnotation, `NaN`, `Infinity`, ekstrem længde, leading zeros og Unicode-cifre;
- schemaets repræsentationsgrænser samt alle aktive domænegrænser ved under/præcis/over;
- værdi der er format- og schema-gyldig, men domænemæssigt out-of-bounds.

### Datoer

- tom og delvis dag/måned/år; ugyldig kalenderdato; skuddag i skudår og ikke-skudår;
- månedsskifte, årsskifte, meget tidlig/sen schema-repræsenterbar dato;
- aktiv minimum/maksimum ved dagen før, præcis dato og dagen efter;
- enhver hardcoded eller dataafledt skæringsdato ved dagen før, på dagen og dagen efter;
- kronologiske relationer i begge retninger samt situationen `min > max`;
- ændring af den dato, som andre felters grænser, opslag eller beregninger allerede bygger på.

### Valg og sammensatte flader

- hvert menupunkt og hver toggle/radiokombination;
- åbne/lukke uden valg, tastaturvalg, genvalg af samme værdi og hurtigt skift;
- udfyld detaljer i mode A, skift til B, brug downstream-funktion, skift tilbage til A;
- tabel: tom række, delvis række, flere rækker, dubletter, slet aktiv/første/sidste række, ændr styrende celle efter afhængige celler og navigér med åben editor;
- overlays/dialoger: åbne/lukke/annullere/bekræfte med tom, delvis, ugyldig og grænseværdi.

## 3. Sekvens- og afhængighedstest

For hver kant `A → B → C`, hvor A styrer B og C forbruger resultatet, test mindst:

1. A først, derefter B, derefter C.
2. B først, derefter A, derefter C.
3. Gyldig A+B, ændr A så B bliver out-of-bounds, brug C.
4. Gyldig A+B, ryd A, brug C, genindsæt A.
5. A-mode 1 + detaljer i B, skift A til mode 2, brug C, skift tilbage.
6. Hold B som åben draft, ændr fokus/navigér/udløs C efter formkontraktens settle-regler.
7. Gentag efter faneskift, re-render og relevant save/load eller undo/redo.

Brug pairwise-dækning mellem almindelige partitioner. Brug 3-vejs dækning, når en styrende værdi, et afhængigt felt og en downstream-forbruger mødes. Enumerér alle kombinationer for små mode-/boolean-sæt, især når branches er nested. Prioritér yderligere targeted kombinationer ved tidligere fejl, optional chaining, assertions, non-null assumptions, arrayindeks, opslag uden fallback, datoindeksering og divisions-/afrundingsgrænser.

## 4. Skæringspunkter og downstream-forbrug

Find skæringer via schemas, constants/datafiler, validators, selectors, beregningsengines og kontrakter. Søg både dato-literals og semantiske navne som `fra`, `til`, `before`, `after`, `cutoff`, `effective`, `regel`, `version` og `grænse`.

For hver skæring:

- dokumentér kilden og hvilken regelgren den vælger;
- test før/på/efter med ellers minimale gyldige data;
- varier alle felter, der kun findes eller fortolkes i én side af skæringen;
- udfyld først under én side og flyt derefter den styrende værdi over skæringen;
- kør hver faktisk forbruger: synlig afledning, opslag, beregning, dokumentgate/generering og persistence, hvis relevant;
- registrér mærkelig eller forskellig taladfærd som observation uden at erklære den juridisk forkert.

## 5. Orakler og klassifikation

### Crashfund

Brug `CRASHES.md`, når brugerhandlingen medfører mindst ét af følgende:

- uncaught exception/rejection, `pageerror` eller nyt `console.error`;
- ErrorBoundary, fallback, fejlrapportmenu eller systemfejlnotifikation;
- page/browser-crash, blank side, permanent spinner/frys eller UI der ikke længere kan bruges;
- brudt invariant med konkret risiko for datatab eller uforudsigelig runtimeadfærd.

Et fanget `console.error` er stadig et crashfund/kandidat, selv om boundary ikke vises. Klassificér først som forventet, hvis kildekode/kontrakt beviser, at signalet med vilje er en testet systemfejlreaktion på en ekstern fejl, som scenariet bevidst simulerer.

### Observation

Brug `OBSERVATIONS.md` ved:

- inkonsistent håndtering af samme input eller handling på to flader;
- afsluttet input der forsvinder eller ændres uden tilsigtet handling;
- afvigelse mellem kontrakt, schema og UI uden observeret runtimefejl;
- mistænkelig beregning/opslag, død/parallel logik, utilgængeligt felt eller manglende feedback;
- flakiness eller adfærd, der kræver domæne-/UX-afklaring.

Forventet rød kant/tooltip ved ugyldigt input er bestået scenarie, ikke et fund, medmindre feedbacken selv crasher eller adfærden varierer uden dokumenteret grund.

## 6. Reproduktion og evidens

Reproducer fra en kendt baseline mindst to gange. Minimer med delta-metoden: fjern én forudgående handling eller værdi ad gangen, indtil den korteste stabile sekvens er fundet. Kontrollér derefter én nærliggende kontrastværdi, som ikke udløser fejlen, når det kan gøres sikkert.

En crashpost skal indeholde:

- præcis build/commit og dirty-state;
- route, side, fane, browser og starttilstand;
- nummererede UI-handlinger med de nøjagtige syntetiske værdier;
- settle-måde og rækkefølge;
- første synlige/systemtekniske signal, præcis fejltekst og relevant stacktop;
- reproduktionsrate, minimal kontrast og berørte downstream-forbrugere;
- links til artefakter og relaterede coverage-/fund-id'er;
- påvirkning beskrevet uden løsningsforslag.

Tag screenshot ved synlig fejl. Bevar trace ved timing-, fokus- eller sekvensafhængige fejl. Kopiér den nødvendige tekst til posten, fordi `test-results` kan blive ryddet.

## 7. Fremdrift og genoptagelse

Brug statuserne `Ikke startet`, `I gang`, `Dækket` og `Blokeret`. En række er kun `Dækket`, når dens matrix, branches, afhængighedsovergange og relevante downstream-forbrugere er kørt, og evidensfeltet er udfyldt.

Hold én aktiv arbejdsenhed. Skriv efter hver batch:

- senest afsluttede scenario-id;
- præcist næste scenario-id og nødvendige starttilstand;
- hvilke partitioner/branches der mangler;
- fund-id'er og eventuel blokering.

Ved ukontrolleret afbrydelse behandles `I gang` som ikke-pålidelig deldækning: genkør hele den lille arbejdsenhed. En blokering må ikke standse andre uafhængige rækker.
