---
name: mineo-interaction-audit
description: Udfør og genoptag en autonom, vedvarende og systematisk robustheds- og adfærdsaudit af Mineo. Gennemgå hele brugerens interaktion med alle sider, felter, tabeller, valg, overlays, navigationer, undo/redo-, save/load- og dokumentforløb på tværs af understøttede browsere; afprøv happy paths, ugyldige, delvise, ekstreme og grænserelaterede input samt kombinationer og tilstandsskift; find og registrér runtimefejl, datatab, inkonsistent eller kontraktstridig brugeradfærd, mistænkelig parallel logik og uafklaret forventet adfærd uden at rette produktet.
---

# Mineo interaktionsaudit

Arbejd autonomt, reproducerbart og checkpointet. Målet er den bedst mulige systematiske dækning af hele den brugerobserverbare adfærd og dens afhængigheder — ikke en påstand om, at en endelig kørsel kan bevise fravær af enhver fremtidig fejl.

Auditten har tre ligeværdige produkter:

1. **Runtime- og systemfund:** uventede exceptions, promise-fejl, console-signaler, blanke sider, frys, fallback-tilstande eller brudte runtime-invarianter.
2. **Adfærdsfund:** synlige afvigelser, datatab, inkonsistens, kontraktdrift, parallel eller afvigende logik, mistænkelig beregningsadfærd og manglende eller uforudsigelig feedback.
3. **Dæknings- og afklaringsspor:** løbende checkpoint for hvad der er gennemgået, hvad der mangler, og konkrete spørgsmål om forventet adfærd, som ikke kan udledes sikkert.

Skillen finder og dokumenterer problemer. Den retter ikke produktionskode, tests, kontrakter, data eller konfiguration.

## Grundprincipper

- Gå ud fra, at også den mest almindelige happy path kan være forkert. Giv den samme systematiske kontrol som fejl- og grænsetilstande.
- Gennemgå hele Mineo: login, global shell, alle sider, faner, felter, tabeller, valg, overlays, hjælp, indstillinger, fejl- og stoptilstande, save/load, nulstilling, navigation og dokumenthandlinger.
- Brug kontrakterne som normativt grundlag efter `src/contracts/contract-topology.json`. Brug den direkte kode som implementerings- og adfærdskilde. Når en kontrakt er klar, er en afvigende implementering et fund; kode alene må kun bruges som forventningsgrundlag, når hensigten er entydig.
- Hvis korrekt adfærd ikke kan udledes af kontrakterne eller koden, skriv et konkret spørgsmål i `QUESTIONS.md`. Gæt aldrig, og lad ikke et uafklaret spørgsmål standse uafhængige arbejdsenheder.
- Vurder ikke, om juridiske eller beregningstekniske regler er rigtige. Registrér observerbare forskelle, mistanker om fejl og forskellige fremgangsmåder for samme handling som fund, og forelæg dem som bruger-/domæneafklaringer uden selv at afgøre reglen.
- Søg aktivt efter to forskellige løsninger på samme brugerproblem, især ved parsing, settle, validering, datoer, navigation, undo/redo, persistence og fejlvisning. Afprøv dem mod samme eller tilsvarende brugerhandling og registrér forskelle.
- Brug kun syntetiske data. Send intet eksternt, og blokér eller registrér ekstern trafik som foreskrevet af projektet.
- Under selve auditten må kun auditdokumenterne under `docs/testing/runtime-input-audit/` og eventuelle screenshots/traces under `test-results/runtime-input-audit/` ændres.
- Al rækkefølge og systematik er fastlagt af inventaret og scenariomatricen. Fundets alvor må gerne registreres, men må ikke bruges til at springe lavere alvorlige flader over eller ændre gennemgangens rækkefølge.

## Vedvarende arbejdssløjfe

Auditten fortsætter straks efter hvert checkpoint, fund, afsluttet arbejdsenhed og afsluttet auditpass. Stop eller pause kun efter udtrykkelig besked fra brugeren. Når alle aktuelle rækker er dækket, begynd næste auditpass med en ny kildeafstemt matrix, nye kombinationer og gentagelser af tidligere ustabile eller højrisiko-sekvenser.

En endelig auditpass er ikke en garanti om, at alle fremtidige sekvenser er afprøvet. Beskriv altid den resterende modelrisiko, og fortsæt med næste pass, indtil brugeren stopper.

## Start eller genoptag

1. Fastlæg repo-roden med `git rev-parse --show-toplevel`, og arbejd derfra.
2. Læs repoets `AGENTS.md`, hele `src/contracts/contract-topology.json`, alle relevante kontrakter og den komplette projektlokale `playwright-cli`-skill før browserstyring.
3. Kør `node .agents/skills/mineo-interaction-audit/scripts/init-audit-workspace.mjs .` ved opstart eller genoptagelse. Scriptet overskriver aldrig eksisterende auditdokumenter og opretter manglende `QUESTIONS.md`.
4. Læs [references/audit-method.md](references/audit-method.md) helt før første auditkørsel og igen, når inventaret eller en ny afhængighedsklynge planlægges.
5. Læs altid `STATUS.md`, `CRASHES.md`, `OBSERVATIONS.md` og `QUESTIONS.md` helt eller målrettet med `rg`, hvis de er lange. Åbne fund og ubesvarede spørgsmål skal forstås, før nye scenarier vælges.
6. Kontrollér `git status --short`, aktuel commit og buildversion. Behandl eksisterende ændringer som brugerens og rør dem ikke.
7. Hvis en række står `I gang`, gentag hele dens senest beskrevne arbejdsenhed fra en kendt ren tilstand. Tag ellers næste række i fast rækkefølge: global shell, sider i navigationens rækkefølge, faner og felter i synlig rækkefølge, derefter tværgående flows.
8. Dæk browserne Chrome, Edge, Firefox og Safari/WebKit med minimum 1920×1080. Brug mindst den definerede minimumsviewport og en større repræsentativ desktop-viewport. Hvis en browser eller viewport ikke kan køres, registrér det som et dækningshul og fortsæt med de øvrige — spring den ikke stiltiende over.
   - Før browserstyring: kontrollér `npx --no-install playwright-cli --version` (eller den lokale fallback `npx --no-install playwright --version`) og `npx playwright install --list`. Mangler Firefox eller WebKit, installér den konkrete motor med `npx playwright install firefox webkit`; manglende Chrome-/Edge-channel registreres eksplicit som dækningshul.
   - Brug de navngivne sessioner `chrome`, `edge`, `firefox` og `webkit`, og luk dem med `npx playwright cli close-all` efter batchen. En session må ikke genbruges, før dens browser, viewport og rene starttilstand er verificeret.
   - Kør den automatiske browser-smoke med `npm run test:e2e` før den brede udforskning. Den lokale Playwright-konfiguration kører de fire motorer ved 1920×1080; til den større viewport sættes `PLAYWRIGHT_INCLUDE_LARGE_VIEWPORT=1` før samme kommando (i PowerShell: `$env:PLAYWRIGHT_INCLUDE_LARGE_VIEWPORT='1'; npm run test:e2e`).
   - Almindelige flows køres mod Vite-devserveren. Service-worker-, PWA- og launch-queue-flows køres separat mod et produktions-preview: `npm run build:mineo`, derefter `npm run preview:e2e` på port 4174. Brug ikke devserverens manglende service-worker som evidens for et PWA-resultat. Ved automatiseret kontrol mod preview sættes i PowerShell `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4174'; $env:PLAYWRIGHT_SKIP_WEBSERVER='1'; $env:PLAYWRIGHT_ALLOW_SERVICE_WORKERS='1'` før `npm run test:e2e`.
9. Markér arbejdsenheden `I gang`, og skriv det konkrete næste scenarie og den nødvendige starttilstand, før browserarbejdet begynder.

## Arbejdscyklus

### 1. Afstem forventet adfærd og inventar

Læs den valgte overflades relevante kontrakter før testen. Kortlæg derefter fra både brugerfladen og koden:

- route, side, fane, dialog, overlay, tabel og global handling;
- alle editorer, valg, toggles, radioer, links, knapper og tastaturhandlinger;
- schema-/feltdefinition, canonical tomværdi, formatdomæne og aktive brugergrænser;
- afhængige felter, selectors/projektioner, opslag, beregnings- og dokumentforbrugere;
- persistence, nulstilling, genindlæsning og alle eksplicitte skæringsdatoer/-tal;
- parallelle implementationssteder for samme brugerrettede concern.

Afstem inventaret begge veje: enhver synlig kontrol skal have et kildegrundlag, og enhver registreret feltdefinition, branch eller handler skal kunne findes i en brugerflade eller registreres som mulig død/afvigende kode.

For hver arbejdsenhed skal auditten kunne svare på:

- Hvad forventes brugeren at se og kunne gøre?
- Hvilken kontrakt eller entydig kodeadfærd begrunder forventningen?
- Hvilke handlinger, inputpartitioner, tilstandsskift og downstream-forbrugere skal afprøves?
- Er forventningen uafklaret? Skriv i så fald `Q-NNN` i `QUESTIONS.md` og markér kun de afhængige rækker som afventende afklaring.

### 2. Byg og gennemfør scenariomatricen

Brug partitioner og grænseanalyse fra [references/audit-method.md](references/audit-method.md). Hver relevant kombination skal afprøves på Chrome, Edge, Firefox og Safari/WebKit ved de definerede viewports. En browser må kun stå som ikke-kørt, hvis den konkret er utilgængelig; det registreres som et dækningshul.

Dæk mindst:

- ren tom sag, gyldig minimumssag, delvis sag og fuld realistisk happy path;
- tom, kun whitespace, delvist format, forkert format, Unicode, linjeskift, paste og ekstremt lange værdier;
- `typing` tegn for tegn, hurtig typing, select-all/replace, paste, blur, Enter, Tab/Shift+Tab, klik udenfor, Escape og Delete/Backspace;
- tal-, beløbs-, procent-, år-, uge- og dato-grænser ved under, præcis og over grænsen;
- ugyldige kalenderdatoer, skudår, måned-/årsskifte, kronologi i begge retninger og `min > max`;
- hvert dropdownvalg, toggle- og radioresultat, genvalg, lukning uden valg og hurtigt skift;
- afhængig først kontra forudsætning først, ændring af styrende valg, rydning, genudfyldning og mode A → B → A;
- tabeller med tomme, delvise, gyldige, ugyldige, duplikerede og mange rækker samt oprettelse, sletning, promotion og genoprettelse;
- åbne drafts under re-render, faneskift, navigation, downstream-handling, save/load, nulstilling, F5 og browser tilbage/frem;
- undo/redo for alle relevante ændringer, herunder ugyldige edits, rydning, valg, tabelrækker, afhængigheder, gentagelser og grænseovergange;
- dokumentgate, beregningsvisning, opslag, PDF-generering, download, save/load-roundtrip og eksplicitte fejltilstande;
- hurtige, gentagne, afbrudte og lange realistiske sekvenser, herunder flere skift mellem input, fejl, rettelser, navigation og undo/redo.

Brug fuld kombination for små, endelige valg- og booleansæt. Brug systematisk parvis dækning for almindelige partitioner og 3-vejs dækning ved styrende input → afhængigt input → downstream-forbruger. Gentag og udvid matricen ved enhver parallel adfærd, tidligere fejl, uafklaret kontrakt eller uventet tilstandsændring.

### 3. Kør med aktive orakler

Følg browserinstruktionerne, og log ind gennem den synlige formular. Etabler en ren baseline før hver isoleret reproduktion. Overvåg fra før login:

- `pageerror`, uncaught exceptions/rejections og nye `console.error`-/`console.warn`-signaler;
- browser-/page-crash, blank side, permanent spinner, fastlåst UI eller tabt interaktion;
- ErrorBoundary/fallback, fejlrapportmenu, tekniske fejlvisninger og eksplicitte systemnotifikationer;
- uventet navigation, fokus-/scrollhop, tabt afsluttet input, ændrede værdier uden handling og andre brudte runtime-invarianter;
- relevant ekstern netværkstrafik.

Efter `goto` eller navigation er URL'en alene ikke et færdigthedsorakel. Vent på den route-specifikke synlige sidekontrol eller tekst, før scenariet fortsætter. Mineos lazy-loadede sider kan kortvarigt vise shellen med et tomt `main`; det er først et fund, hvis den forventede side stadig mangler efter Playwrights 30 sekunders element-timeout. Brug samme readiness-orakel i kontrastkørsler, så langsom første transform ikke forveksles med browserafhængig adfærd.

Forventet rød kant, tooltip eller anden dokumenteret valideringsfeedback er bestået adfærd og ikke i sig selv et crashfund. Et systemsignal er stadig et kandidatfund, selv om appen tilsyneladende fortsætter.

### 4. Isolér og registrér straks

Stop kun den aktuelle matrixgren ved et signal. Gentag fra ren tilstand mindst to gange, minimér handlingerne, og find den første handling der udløser afvigelsen. Kontrollér en nærliggende kontrastværdi eller sekvens, som ikke udløser den, når det kan gøres sikkert.

- Skriv runtime- og systemfejl i `CRASHES.md`.
- Skriv synlige afvigelser, datatabsmistanke, kontrakt-/kodeafvigelser, parallel logik, mistænkelig beregningsadfærd og andre ikke-crashende fund i `OBSERVATIONS.md`.
- Skriv kun egentlige beslutningsspørgsmål om korrekt adfærd i `QUESTIONS.md`. Et spørgsmål må ikke bruges til at skjule et allerede observeret fund; link i så fald begge poster.
- Deduplikér efter fejltype, kausal handling og første afvigelse, men link browser-, flade- og kombinationsvarianter, så rækkevidden bevares.
- Medtag præcis nødvendig fejltekst, relevante kildehenvisninger og korte artefaktlinks. Medtag aldrig persondata eller store logs.
- Registrér browserafhængighed, reproduktionsrate og nærliggende ikke-fejlende kontrast. Markér ikke-reproducerbare signaler ærligt som `Ustabil`.
- Registrér fundets type og alvor som metadata, men ændr ikke auditrækkefølgen på grundlag heraf.

En post skal være så præcis, at en anden kørsel kan finde den igen alene ud fra posten. Lange fortællinger er ikke nødvendige.

### 5. Checkpoint og genoptagelse

Opdatér dokumenterne umiddelbart efter hvert fund og hver lille matrixbatch. En batch må højst være én synlig flade eller én tæt afhængighedsklynge. Opdatér:

- rækkens status og dækkede partitioner, branches, afhængighedsovergange og browsere;
- senest afsluttede scenarie og præcist næste scenarie med starttilstand;
- nye eller opdaterede fund-id'er, spørgsmål-id'er og dækningshuller;
- sessionens commit, build, dirty-state, browser, viewport og tidspunkt.

En række er kun `Dækket`, når den relevante brugeradfærd, kontrakt-/kodeafstemning, branches, afhængighedskanter, downstream-forbrugere og browser-/viewportvariationer er håndteret. En række, der kræver svar på et spørgsmål, står `Afventer afklaring` og tæller ikke som dækket.

Bevar beståede forhold kompakt som scenarie-, partitions- og evidensreferencer, så status kan genoptages. Brug detaljeret plads på reproducerbare fund, uafklarede spørgsmål og konkrete dækningshuller — ikke på gentagen historik om hver bestået handling.

Når brugeren beder om status, pause eller stop, skal alle åbne `QUESTIONS.md`-poster fremhæves og forelægges. Hvis brugeren senere besvarer et spørgsmål, registrér svaret i posten, opdatér de berørte rækker og genkør de arbejdsenheder, som svaret ændrer.

Ved ukontrolleret afbrydelse er en række `I gang` ikke pålidelig deldækning: genkør hele arbejdsenheden. En uafklaret række må ikke standse uafhængige rækker.

## Afslutningskriterium for en auditpass

Markér først den aktuelle auditpass afsluttet, når inventaret er afstemt mod både brugerflade, kontrakter og kildekode, ingen række står `Ikke startet`, `I gang` eller `Blokeret`, alle identificerede branches, skæringer, afhængighedskanter og browserdækninger har evidens, fund er reproduceret eller markeret som ustabile, og den fulde navigation-/stateful smoke er kørt uden nye systemfejl.

Åbne spørgsmål og resterende modelrisiko skal beskrives. En afsluttet auditpass afslutter kun den aktuelle pass — begynd næste pass efter den vedvarende arbejdssløjfe, indtil brugeren specifikt stopper eller pauser.
