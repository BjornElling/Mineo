---
name: jette-interaktionsaudit
description: Brug kun efter brugerens udtrykkelige anmodning om netop en Mineo-interaktionsaudit. Udfør og genoptag derefter en autonom, vedvarende og systematisk robustheds- og adfærdsaudit af Mineo uden brugerinput mellem arbejdsenheder; fortsæt principielt uden slutpunkt og afslut eller pausér kun efter en entydig brugerbesked om stop eller pause. Gennemgå hele brugerens interaktion med alle sider, felter, tabeller, valg, overlays, navigationer, undo/redo-, save/load- og dokumentforløb på tværs af understøttede browsere; afprøv happy paths, ugyldige, delvise, ekstreme og grænserelaterede input samt kombinationer og tilstandsskift; find og registrér runtimefejl, datatab, inkonsistent eller kontraktstridig brugeradfærd, mistænkelig parallel logik og uafklaret forventet adfærd uden at rette produktet.
---

# Jette interaktionsaudit

## Aktivering og autonom kørsel

Skillen har to adskilte betingelser:

1. **Aktivering:** Brug kun skillen, når brugeren udtrykkeligt beder om at få udført eller genoptaget netop en Mineo-interaktionsaudit. Aktivér den aldrig af egen drift, og brug den aldrig til andre formål — heller ikke fordi en anden opgave involverer browseradfærd, test, robusthed, fejlsøgning, review eller gennemgang af Mineo. En generel anmodning om test, review eller browserkontrol er ikke tilstrækkelig; anmodningen skal tydeligt omfatte denne specifikke, systematiske interaktionsaudit.
2. **Kørsel efter aktivering:** Når brugeren har aktiveret skillen som beskrevet ovenfor, skal auditten køre autonomt og vedvarende uden løbende bekræftelser fra brugeren. Reglerne om at fortsætte uden nyt brugerinput gælder kun for den allerede aktiverede audit og må aldrig fortolkes som tilladelse til selv at starte en ny audit i en senere eller anden opgave.

Arbejd autonomt, reproducerbart og checkpointet. Målet er den bedst mulige systematiske dækning af hele den brugerobserverbare adfærd og dens afhængigheder — ikke en påstand om, at en endelig kørsel kan bevise fravær af enhver fremtidig fejl.

Auditten har tre ligeværdige produkter:

1. **Runtime- og systemfund:** uventede exceptions, promise-fejl, console-signaler, blanke sider, frys, fallback-tilstande eller brudte runtime-invarianter.
2. **Adfærdsfund:** synlige afvigelser, datatab, inkonsistens, kontraktdrift, parallel eller afvigende logik, mistænkelig beregningsadfærd og manglende eller uforudsigelig feedback.
3. **Dæknings- og afklaringsspor:** løbende checkpoint for hvad der er gennemgået, hvad der mangler, og konkrete spørgsmål om forventet adfærd, som ikke kan udledes sikkert.

Derudover fører auditworkerens egen kørsel en separat, append-only driftslog i
`docs/testing/runtime-input-audit/AUDIT-WORKER-ERRORS.md`. Den log må kun indeholde fejl
i auditten, browser-/serverstyringen eller de lokale auditværktøjer — ikke Mineo-fund.
Opret den ved opstart via `init-audit-workspace.mjs`, og registrér enhver fejl i selve
arbejdskørslen løbende med:

```powershell
node .agents/skills/jette-interaktionsaudit/scripts/record-audit-error.mjs --repo . `
  --type 'tool-fejl' --phase 'browserarbejde' --command 'Konkret kommando eller handling' `
  --scenario 'SCENARIO-ID' --browser 'chrome' --viewport '1536x864' `
  --recoverable 'ja/nej' --message 'Kort konkret fejl' --details 'Kort nødvendig kontekst'
```

Det er obligatorisk at registrere alle ikke-nul exitkoder, exceptions/rejections i
auditworkerens egne scripts, browser- eller serverstartfejl, mistede browserkontekster,
afbrudte checkpoints, timeouts og andre fejl, som forhindrer eller forvrider auditens
egen kørsel. Registrér fejlen før genoptagelse, recovery eller skift til næste uafhængige
arbejdsenhed.

Loggen er derimod ikke et sted for **kendt og dokumenteret mekanik**. Følgende registreres
IKKE, fordi den korrekte fremgangsmåde står i afsnittet «Browsermekanik: de faste greb» og
et forkert greb derfor er en instruktion, der ikke blev fulgt — ikke et driftsforhold:

- read-only-felt der kræver `dblclick` før `fill`;
- forventet `beforeunload`-timeout i det foreskrevne `reload` → `dialog-accept` → `snapshot`-forløb;
- en CLI-kommando, -option eller et niveau der ikke findes, når `--help` ikke blev kontrolleret først;
- en locator-fejl (manglende citationstegn, strict-mode, stale ref), hvor locator-rækkefølgen ikke blev fulgt;
- en PowerShell-quoting-fejl i inline `run-code`, hvor `--filename` skulle have været brugt.

Bliver det samme greb alligevel en fejl to gange, er det et tegn på, at instruktionen er
utilstrækkelig: registrér da ÉN post om selve instruktionen frem for en post pr. gentagelse. Produktets `console.error`, `pageerror` og synlige fejl registreres fortsat
i `CRASHES.md` efter de almindelige auditregler og kopieres kun til workerloggen, hvis
selve auditværktøjet også fejler.

Skillen finder og dokumenterer problemer. Den retter ikke produktionskode, audit-tests, kontrakter, brugerdata eller produktkonfiguration. Den må dog selv vedligeholde sit lokale auditværktøj, sine lokale browserbinærer og den projektlokale browser-skill efter reglerne nedenfor.

## Selvvedligeholdelse af auditmiljøet

Før første browserarbejdsenhed, efter `recover`/`resume`, og før en ny browserbatch køres miljøkontrollen:

```powershell
node .agents/skills/jette-interaktionsaudit/scripts/ensure-audit-environment.mjs --repo .
```

Helperen reparerer kun auditinfrastrukturen og skriver et maskinlæsbart checkpoint til `test-results/runtime-input-audit/environment.json`. Den må hente lokale udviklingspakker fra npm, men Mineo må fortsat ikke få serverkommunikation, telemetri eller eksterne runtimekald.

Versionsreglen er eksplicit:

- Sammenlign først en pakke med dens egen `package.json`/`package-lock.json`-kilde. Mangler pakken eller er den bagud i forhold til lockfilen, opdateres/installeres den.
- En allerede installeret højere version beholdes. Brug aldrig `npm ci`, en eksplicit ældre versionsspecifikation eller anden handling, der nedgraderer en forudgående version for at få et andet værktøj til at ligne den.
- `@playwright/test` er Mineos E2E-familie og bor i projektets eget `node_modules`. `@playwright/cli` og `@playwright/mcp` er CLI/MCP-familien og bor i deres eget træ under `.agents/tools`, fordi de pinner en anden Playwright-runtime. De to træer må aldrig slås sammen: begge familier deklarerer kommandoen `playwright`, og deler de node_modules, kan npm kun give den ene kommandoen — så kører `npx playwright test` e2e-filerne med en anden runner-instans, end filerne importerer, og hver fil fejler med «did not expect test.describe() to be called here». `npm run check:tool-isolation` håndhæver adskillelsen.
- CLI/MCP-familien skal afstemmes indbyrdes, men må ikke afstemmes ved at nedgradere E2E-familien. Hvis CLI/MCP-familien er splittet, opdateres den bagudstående pakke til den seneste kompatible udgave; hvis den ikke kan afstemmes uden nedgradering, registreres den konkrete blokering.
- Browserbinærer fjernes aldrig som led i reparationen. Hvis den aktuelle Playwright-runtime mangler sin krævede revision, installeres revisionen side om side; en nyere eksisterende revision beholdes.
- En reparerbar versionsforskel er en miljøhandling, ikke et auditfund. Kun en forskel, der består efter helperens reparation eller konkret påvirker auditdækningen, registreres som dækningshul.

Hvis helperen ikke kan reparere en nødvendig komponent, gemmes checkpointet, den konkrete fejl registreres som dækningshul, og uafhængige arbejdsenheder fortsættes med de komponenter, der er verificeret.

## Langvarig kørsel, lease og afbrydelser

En audit må ikke afhænge af, at én Codex-turn, ét tool-kald eller én browser-/serverproces lever i dagevis. En netværksafbrydelse, en suspenderet computer eller en genstart af browseren er en normal driftsforstyrrelse, ikke et signal om at afslutte auditten. Auditten skal derfor køres som korte, selvstændige arbejdsenheder med en lokal, durable lease under `.agents/skills/jette-interaktionsaudit/state/session.json`. Lease-state ligger uden for `test-results`, fordi Playwright normalt rydder den mappe ved suite-start og ellers kan slette auditens genoptagelsespunkt.

Brug skillens session-helper fra repo-roden:

```powershell
$lease = '.agents/skills/jette-interaktionsaudit/scripts/audit-session.mjs'
node $lease begin --repo . --scenario SHELL-MIN-002 --start-state 'Ren login i hver browser' --browser alle --viewport 1536x864
node $lease heartbeat --repo . --stage 'Baseline-smoke kører'
node $lease complete --repo . --next-scenario SHELL-MIN-003 --next-start-state 'Ren login i hver browser'
node $lease status --repo .
```

Reglerne for lease-kørslen er:

- En arbejdsenhed skal være lille nok til normalt at afsluttes på højst cirka 15 minutter og må højst være én synlig flade eller én tæt afhængighedsklynge.
- Start lease før browserarbejde, skriv heartbeat mindst hvert andet minut ved længere arbejdsenheder, og skriv `complete` umiddelbart efter auditdokumenterne er checkpointet.
- En åben `active` lease er ikke deldækning. Efter ukontrolleret afbrydelse skal hele den aktive arbejdsenhed gentages fra ren tilstand.
- Ved genoptagelse fra en ny turn køres først `status`. Hvis den aktive lease ikke har haft heartbeat i mindst 15 minutter, køres `recover` og derefter `resume`; den viste arbejdsenhed gentages fra ren tilstand. Et wall-clock-gap på mindst fem minutter registreres som mulig sleep-/systemafbrydelse, men må ikke uden Windows-/proces-evidens erklæres som sleep.
- `ready` betyder, at den forrige arbejdsenhed er checkpointet, og at `nextScenario`/`nextStartState` skal startes med en ny `begin`. En `recovery-required` lease må ikke overskrives med en ny arbejdsenhed.
- Lease-helperens heartbeat er kun audit-infrastruktur. En keep-awake-proces må aldrig skrive audit-heartbeat, for så kan en mistet Codex-forbindelse se levende ud.
- Ved resume lukkes gamle CLI-sessioner og stale browser-/serverprocesser, der kan identificeres sikkert, og der etableres frisk browser- og servertilstand. Brug ikke en in-memory browser-session som den eneste bærer af auditens fremskridt.

Ved fler-dages kørsel kan Windows' normale idle-sleep forebygges med den lokale helper. Start den efter `begin` i en skjult proces:

```powershell
$keepAwake = (Resolve-Path '.agents/skills/jette-interaktionsaudit/scripts/keep-awake.ps1').Path
$keepAwakeProcess = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList @('-NoLogo', '-NoProfile', '-File', $keepAwake, '-RepoRoot', (Get-Location).Path)
```

Alle andre lokale hjælpeprocesser skal startes med `Start-Process -WindowStyle Hidden`
og `-NoNewWindow`/redirected output, hvor det er relevant. Brug aldrig Vites almindelige
`dev`-script under auditten, fordi det indeholder `--open`; start i stedet serveren med
`npm run generate:build-info` efterfulgt af `npx vite --config vite.mineo.config.ts
--host 127.0.0.1` eller brug Playwright-konfigurationens skjulte `webServer`.
Hvis en proces alligevel åbner et vindue, stop den sikkert, registrér det i
`AUDIT-WORKER-ERRORS.md`, og genstart med den skjulte variant. En synlig browser eller
operativsystemsdialog må ikke åbnes som workaround.

Gem `$keepAwakeProcess.Id` eller PID-filen `.agents/skills/jette-interaktionsaudit/state/keep-awake.pid`, og stop processen ved en entydig brugerbesked om pause/stop. Helperen forhindrer kun normal Windows idle-sleep; den løser ikke strømudfald, genstart, tvungen sleep, netværksfejl eller en mistet Codex-forbindelse. Hvis den ikke kan starte, registreres det som et dæknings-/driftsforhold, og checkpoint-/resume-protokollen fortsætter stadig.

## Grundprincipper

- Gå ud fra, at også den mest almindelige happy path kan være forkert. Giv den samme systematiske kontrol som fejl- og grænsetilstande.
- Gennemgå hele Mineo: login, global shell, alle sider, faner, felter, tabeller, valg, overlays, hjælp, indstillinger, fejl- og stoptilstande, save/load, nulstilling, navigation og dokumenthandlinger.
- Brug kontrakterne som normativt grundlag efter `src/contracts/contract-topology.json`. Brug den direkte kode som implementerings- og adfærdskilde. Når en kontrakt er klar, er en afvigende implementering et fund; kode alene må kun bruges som forventningsgrundlag, når hensigten er entydig.
- Hvis korrekt adfærd ikke kan udledes af kontrakterne eller koden, skriv et konkret spørgsmål i `QUESTIONS.md`. Gæt aldrig, og lad ikke et uafklaret spørgsmål standse uafhængige arbejdsenheder.
- Vurder ikke, om juridiske eller beregningstekniske regler er rigtige. Registrér observerbare forskelle, mistanker om fejl og forskellige fremgangsmåder for samme handling som fund, og forelæg dem som bruger-/domæneafklaringer uden selv at afgøre reglen.
- Søg aktivt efter to forskellige løsninger på samme brugerproblem, især ved parsing, settle, validering, datoer, navigation, undo/redo, persistence og fejlvisning. Afprøv dem mod samme eller tilsvarende brugerhandling og registrér forskelle.
- Brug kun syntetiske data. Send intet eksternt, og blokér eller registrér ekstern trafik som foreskrevet af projektet.
- Under selve auditten må auditdokumenterne under `docs/testing/runtime-input-audit/`, eventuelle screenshots/traces under `test-results/runtime-input-audit/`, miljøcheckpointet og den lokale auditværktøjsskill ændres. Selvvedligeholdelse må ikke ændre produktkode, audit-scenarier, kontrakter eller brugerdata.
- Al rækkefølge og systematik er fastlagt af inventaret og scenariomatricen. Fundets alvor må gerne registreres, men må ikke bruges til at springe lavere alvorlige flader over eller ændre gennemgangens rækkefølge.

## Vedvarende arbejdssløjfe

Auditten fortsætter straks efter hvert checkpoint, fund, afsluttet arbejdsenhed og afsluttet auditpass. Stop eller pause kun efter udtrykkelig besked fra brugeren. Når alle aktuelle rækker er dækket, begynd næste auditpass med en ny kildeafstemt matrix, nye kombinationer og gentagelser af tidligere ustabile eller højrisiko-sekvenser.

En endelig auditpass er ikke en garanti om, at alle fremtidige sekvenser er afprøvet. Beskriv altid den resterende modelrisiko, og fortsæt med næste pass, indtil brugeren stopper.

## Ufravigelig autonom fortsættelse

Auditten er en åben, langvarig arbejdsopgave — ikke en enkelt leverance med et selvvalgt slutpunkt. Følg disse regler uden undtagelse:

- Afslut aldrig arbejdet på eget initiativ efter en batch, et checkpoint, en testkørsel, en fundregistrering, en grøn smoke, en afsluttet auditpass, en tom fundbatch, en delvis dækning eller en statusopsummering.
- En normal turn-grænse, værktøjsgrænse, timeout, browser-/servergenstart, midlertidig fejl eller behov for oprydning er ikke en tilladelse til at stoppe. Bevar checkpointet og fortsæt straks med næste sikre arbejdsenhed gennem den tilgængelige fortsættelsesmekanisme.
- Send ikke en afsluttende handoff-besked, mens auditten er aktiv. En statusbesked skal være kort, ikke-blokerende og efterfølges af fortsat audit — den må ikke overlade næste skridt til brugeren.
- Spørg aldrig brugeren, om du skal fortsætte, og vent ikke på bekræftelse af næste scenarie. Vælg næste række i den faste rækkefølge og fortsæt autonomt.
- En brugerbesked om status, fund eller fremdrift er ikke en stopbesked. Besvar den kort med den aktuelle status og genoptag derefter straks auditten.
- Kun en entydig, udtrykkelig brugerbesked om at stoppe eller pause auditten må afslutte den vedvarende sløjfe. Formuleringer som `stop audit`, `pause audit`, `afslut audit` eller tilsvarende tæller; almindelig stilhed, turnslut eller manglende nye fund tæller ikke.
- Når et auditpass opfylder afslutningskriterierne, markér det som afsluttet i statusdokumentet og start næste auditpass i samme arbejdssløjfe. Den samlede auditstatus forbliver `I gang`, indtil brugeren specifikt stopper eller pauser.
- Luk kun browser- eller serverprocesser som led i at etablere ren tilstand eller skifte batch. Hvis der er mere audit tilbage, genstart dem og fortsæt; afslut ikke kontrolinfrastrukturen som tegn på, at arbejdet er færdigt.
- Hvis én arbejdsenhed er blokeret, dokumentér blokeringen, vælg næste uafhængige arbejdsenhed og fortsæt. En blokering i én gren må aldrig blive en selvvalgt afslutning af hele auditten.

## Start eller genoptag

1. Fastlæg repo-roden med `git rev-parse --show-toplevel`, og arbejd derfra.
2. Læs repoets `AGENTS.md`, hele `src/contracts/contract-topology.json`, alle relevante kontrakter og den komplette projektlokale `playwright-cli`-skill før browserstyring.
3. Kør `node .agents/skills/jette-interaktionsaudit/scripts/init-audit-workspace.mjs .` ved opstart eller genoptagelse. Scriptet overskriver aldrig eksisterende auditdokumenter og opretter manglende `QUESTIONS.md`.
4. Læs [references/audit-method.md](references/audit-method.md) helt før første auditkørsel og igen, når inventaret eller en ny afhængighedsklynge planlægges.
5. Læs altid `STATUS.md`, `CRASHES.md`, `OBSERVATIONS.md` og `QUESTIONS.md` helt eller målrettet med `rg`, hvis de er lange. Åbne fund og ubesvarede spørgsmål skal forstås, før nye scenarier vælges.
6. Kontrollér `git status --short`, aktuel commit og buildversion. Behandl eksisterende ændringer som brugerens og rør dem ikke.
7. Kør `node .agents/skills/jette-interaktionsaudit/scripts/audit-session.mjs status --repo .`. Hvis der ikke findes en lease, oprettes den med `STATUS.md`'s registrerede næste scenarie og starttilstand. Ved en frisk opstart med `ready` lease startes den registrerede næste arbejdsenhed; ved `active` lease fortsættes kun, hvis heartbeat stadig er aktuelt og der ikke findes en anden levende audit-worker. Ellers køres `recover` og `resume`, hvorefter hele den aktive arbejdsenhed gentages fra ren tilstand.
8. Hvis en række står `I gang`, gentag hele dens senest beskrevne arbejdsenhed fra en kendt ren tilstand. Tag ellers næste række i fast rækkefølge: global shell, sider i navigationens rækkefølge, faner og felter i synlig rækkefølge, derefter tværgående flows.
9. Dæk browserne Chrome, Edge, Firefox og Safari/WebKit med både den almindelige Full-HD-CSS-viewport 1920×1080 og den bindende minimums-CSS-viewport 1536×864. Sidstnævnte svarer til en fysisk 1920×1080-skærm ved 125 % Windows-visningsskalering, når browserens zoom står på 100 %. Playwright styrer CSS-viewporten og simulerer ikke selve operativsystemets fysiske skalering; registrér derfor altid både CSS-viewport og `window.devicePixelRatio`, og registrér et eventuelt hul i ægte OS-/headed-verifikation særskilt. Brug mindst én større repræsentativ desktop-viewport. Hvis en browser eller viewport ikke kan køres, registrér det som et dækningshul og fortsæt med de øvrige — spring den ikke stiltiende over.
   - Før browserstyring: kør `ensure-audit-environment.mjs` som beskrevet ovenfor. Kontrollér derefter `node .agents/tools/playwright-cli.mjs --version`, `npx playwright --version` og `npx playwright install --list`. De to kommandoer rammer hver sin familie, fordi CLI/MCP-familien bor i `.agents/tools` og `npx playwright` derfor entydigt er Mineos E2E-motor. Helperen installerer manglende Firefox/WebKit/Chromium-revisioner, bevarer nyere revisioner og registrerer manglende Chrome-/Edge-channel eksplicit som dækningshul.
   - Kør alle browserkørsler headless. `playwright-cli` er headless som standard, så brug aldrig `--headed`, `npm run test:e2e:headed`, `show --annotate`, `--open` eller en synlig browser-attach under auditten. Snapshots, screenshots, traces og video kan stadig optages headless. Det holder browseren fra skærmen og fra operativsystemets input-/dvaleinteraktion.
   - Brug de navngivne sessioner `chrome`, `edge`, `firefox` og `webkit`, og luk dem med `node .agents/tools/playwright-cli.mjs close-all` efter batchen. En session må ikke genbruges, før dens browser, viewport og rene starttilstand er verificeret. E2E-smoke og andre testkørsler køres via `npm run test:e2e` eller `npx playwright test` — de to CLI-familier har hver sit træ og må ikke blandes sammen.
   - Platformdialoger, der kun kan åbnes af en synlig browser eller operativsystemet, kan ikke afprøves i den headless audit. Registrér dem som et konkret dækningshul og fortsæt med uafhængige arbejdsenheder; skift ikke automatisk til headed. En synlig kørsel kræver en udtrykkelig brugerbesked.
   - Kør den automatiske browser-smoke med `npm run test:e2e` før den brede udforskning. Den lokale Playwright-konfiguration skal køre de fire motorer ved både 1536×864 og 1920×1080; til den større viewport sættes `PLAYWRIGHT_INCLUDE_LARGE_VIEWPORT=1` før samme kommando (i PowerShell: `$env:PLAYWRIGHT_INCLUDE_LARGE_VIEWPORT='1'; npm run test:e2e`).
   - Almindelige flows køres mod Vite-devserveren. Service-worker-, PWA- og launch-queue-flows køres separat mod et produktions-preview: `npm run build:mineo`, derefter `npm run preview:e2e` på port 4174. Brug ikke devserverens manglende service-worker som evidens for et PWA-resultat. Ved automatiseret kontrol mod preview sættes i PowerShell `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4174'; $env:PLAYWRIGHT_SKIP_WEBSERVER='1'; $env:PLAYWRIGHT_ALLOW_SERVICE_WORKERS='1'` før `npm run test:e2e`. PWA-rækkerne gentages ved 1536×864 og 1920×1080; kontrollér også at installeret/standalone-vinduets shell, navigation og dokumentflows ikke mister indhold.
10. Markér arbejdsenheden `I gang`, opret eller genoptag lease-helperens arbejdsenhed, og skriv det konkrete næste scenarie og den nødvendige starttilstand, før browserarbejdet begynder.

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

#### Minimumshøjde, sidemenu og scroll

Ved 1536×864 skal alle globale handlinger og alle sidemenuens punkter kunne nås med tastatur og pointer. Auditér både udvidet og sammenfoldet sidemenu, login efter fuld opstart, alle routede sider, åbne dialoger og PWA-preview. Kontroller for hvert relevant viewport/browser-par:

- at sidemenuens sidste synlige punkt og alle globale handlinger har en faktisk tilgængelig fokus-/klikgeometri;
- at ingen side-menu-wrapper, sidemenu-scrollregion eller skjult `overflow` gør et punkt utilgængeligt;
- at sidemenuen ikke får en egen intern lodret scrollfunktion. Hvis hele siden kræver lodret plads, skal den almindelige app-/dokument-scroll eller en anden eksplicit, brugerforståelig shell-adfærd bære det — ikke en separat scrollbar i sidemenuen;
- at fokus på sidste menupunkt, `Tab`/`Shift+Tab`, `Enter` og navigation til sidste route fungerer, og at fokus ikke flyttes til et clipped element;
- at eventuel tættere spacing, mindre typografi eller anden komprimering ved lav højde registreres som synlig UI-/adfærdsændring og forelægges før produktimplementering, hvis den ikke allerede er en entydig genskabelse af dokumenteret adfærd.

Et bestået resultat kræver ikke, at alle sidemenuens punkter står permanent synlige på enhver højde; det kræver, at de er tilgængelige uden en skjult eller uforudsigelig vej. Hvis den nuværende shell ikke kan opfylde dette uden en markant ændring af udseende eller adfærd, registrér først det konkrete fund og spørgsmålet om ønsket løsning.

### Browsermekanik: de faste greb

Driftsloggen viser, at langt de fleste afbrudte arbejdsenheder ikke skyldtes Mineo, men gentagne fejlgreb
i selve browserstyringen. Følgende regler er derfor bindende og skal følges, før en handling gentages
eller registreres i `AUDIT-WORKER-ERRORS.md`.

**Locator-rækkefølgen er fast.** Brug den første mulighed, der kan bruges, og gå aldrig direkte til en
rå CSS-selector:

1. `data-mineo-field-address` er Mineos ENESTE feltidentitet i DOM (`keyboard-navigation.md` §Feltidentitet)
   og sidder på selve det fokuserbare element. Den er entydig også når to felter deler synligt navn, og den
   skelner tabelrækker via `entityId`. Find adressen med `eval` og målret den derefter:
   ```powershell
   node .agents/tools/playwright-cli.mjs -s=chrome --raw eval "JSON.stringify([...document.querySelectorAll('[data-mineo-field-address]')].map(el => el.getAttribute('data-mineo-field-address')))"
   node .agents/tools/playwright-cli.mjs -s=chrome click "[data-mineo-field-address='<den ordrette adresse>']"
   ```
2. Ellers en frisk snapshot-`ref` fra samme kommando-kæde.
3. Ellers en Playwright-rolle-locator (`getByRole('button', { name: 'Slet rækken' })`), afgrænset til
   en række med `.filter()`/`.nth()`, når navnet går igen.

Rå CSS med accessible name (`input[aria-label=Årsløn]`) er den hyppigste enkeltfejl i loggen: den fejler
både på manglende citationstegn, på mellemrum i labels, på felter der slet ikke har `aria-label`, og på
strict-mode når navnet går igen. Brug den ikke.

**Snapshot-refs er kun gyldige indtil næste re-render.** Refs som `e569` invalideres af ethvert valg,
enhver commit og enhver navigation, og præfikser (`e1e17`, `f2…`) hører til én bestemt browserkontekst.
Sammensæt aldrig refs på tværs af kommandoer, og genbrug aldrig en ref fra en tidligere turn eller session.
Skal flere handlinger udføres i træk efter en re-render, brug feltadresse eller rolle-locator i stedet.

**Mineo-felter er read-only, indtil editoren er åbnet.** Direkte `fill` timeouter på både formular- og
tabelfelter. Den korrekte sekvens er altid `dblclick` → `fill` → `Tab`/`Enter` (settle). Det er dokumenteret
produktadfærd, ikke et fund, og skal ikke registreres i driftsloggen.

**`beforeunload` skal håndteres FØR navigation, ikke bagefter.** Når sagen har afsluttede ændringer, åbner
`reload`, `goto` og browser tilbage/frem produktets beforeunload-dialog. Dialogen holder kaldet åbent, til
CLI'ens 60-sekunders timeout rammer, og derefter afvises `snapshot`, `run-code` og `reload` med modal state.
`page.on('dialog')` inde i `run-code` fanger den ikke. Kør derfor altid navigation som:

```powershell
node .agents/tools/playwright-cli.mjs -s=chrome reload      # rammer dialogen og timeouter — forventet
node .agents/tools/playwright-cli.mjs -s=chrome dialog-accept
node .agents/tools/playwright-cli.mjs -s=chrome snapshot
```

Timeout i dette forløb er forventet mekanik og registreres ikke som fejl. `dialog-accept` uden aktiv dialog
giver exit 1 — kontrollér med `snapshot`, om dialogen allerede er væk, før accept gentages.

**Kommandofladen er den, `--help` viser — ikke den forventede.** Kontrollér `node .agents/tools/playwright-cli.mjs
--help <kommando>` før en ukendt kommando bruges. Konkret fra loggen:

- Der findes ingen `wait-for-time` og ingen `pageerrors`. Brug `snapshot` (som venter selv) og `console`.
- `console` tager niveauet `warning`, ikke `warn`.
- `screenshot` tager en target-locator, ikke en filsti; filnavn sættes med `--filename=…`.
- `open` har ingen `--viewport-size`; brug `resize <w> <h>` efter `open`.
- Viewporten er 1280×720 som standard. Sæt den eksplicit med `resize` efter hver `open`, og verificér den,
  før et screenshot bruges som viewport-evidens.
- Hver kommando skal bære `-s=<session>` præcis én gang. Manglende option rammer default-sessionen
  ("browser default is not open"); to gange giver sessionsnavnet `chrome,chrome`.

**PowerShell-quoting ved `run-code`.** Indre dobbelte anførselstegn splitter kommandoen, før CLI'en ser den,
og `window` findes ikke i `run-code`-omgivelserne (brug `page.evaluate`). Skriv derfor kode med mere end ét
udtryk til en fil og kør den med `--filename`, i stedet for at escape den inline:

```powershell
Set-Content -Path test-results/runtime-input-audit/step.js -Value $code -Encoding utf8
node .agents/tools/playwright-cli.mjs -s=chrome run-code --filename=test-results/runtime-input-audit/step.js
```

Hold desuden `run-code`-scripts korte. Et samlet setup-script, der fejler på locator nr. 7, efterlader en
halvt etableret tilstand, som ikke kan bruges som baseline; små trin med frisk locator pr. trin er hurtigere
i praksis.

**Serverstart.** Start aldrig Vite via `node vite.js` eller sammensatte `Start-Process`-kommandoer — begge
fejlede gentagne gange i loggen. Brug projektets egne scripts, som allerede er `--open`-fri, og vent på at
porten faktisk svarer, før browserarbejdet begynder:

```powershell
npm run generate:build-info
Start-Process npm.cmd -WindowStyle Hidden -ArgumentList @('run','dev:e2e','--','--port','4173')
```

Verificér med et HTTP-svar (ikke en fast ventetid), og find den PID, der reelt ejer porten, med
`Get-NetTCPConnection -LocalPort 4173`, før en proces stoppes. En forudkendt PID er ikke evidens.

### 3. Kør med aktive orakler

Følg browserinstruktionerne, og log ind gennem den synlige formular. Etabler en ren baseline før hver isoleret reproduktion. Overvåg fra før login:

- `pageerror`, uncaught exceptions/rejections og nye `console.error`-/`console.warn`-signaler;
- browser-/page-crash, blank side, permanent spinner, fastlåst UI eller tabt interaktion;
- ErrorBoundary/fallback, fejlrapportmenu, tekniske fejlvisninger og eksplicitte systemnotifikationer;
- uventet navigation, fokus-/scrollhop, tabt afsluttet input, ændrede værdier uden handling og andre brudte runtime-invarianter;
- relevant ekstern netværkstrafik.

Efter `goto` eller navigation er URL'en alene ikke et færdigthedsorakel. Vent på den route-specifikke synlige sidekontrol eller tekst, før scenariet fortsætter. Mineos lazy-loadede sider kan kortvarigt vise shellen med et tomt `main`; det er først et fund, hvis den forventede side stadig mangler efter Playwrights 30 sekunders element-timeout. Brug samme readiness-orakel i kontrastkørsler, så langsom første transform ikke forveksles med browserafhængig adfærd.

Forventet rød kant, tooltip eller anden dokumenteret valideringsfeedback er bestået adfærd og ikke i sig selv et crashfund. Et systemsignal er stadig et kandidatfund, selv om appen tilsyneladende fortsætter.

### Save-orakel: repræsentation før farve

Før et Gem-forløb klassificeres, fastlæg feltets **afsluttede repræsentation** fra den relevante
feltmotor/projektion og kontroller `form-contract.md` §8, `error-contract.md` §5 og
`persistence-contract.md` §5:

- Rejected råtekst (format-/schemafejl) skal stoppe `.eo`-save i handleren, fokusere det relevante felt og
  give den dokumenterede afvisningsfeedback. En aktiv Gem-knap er ikke i sig selv et fund: krav om reaktivt
  disabled gælder dokument-output, ikke Gem.
- Schema-gyldigt canonical input med range-/bounds-/rule-issue skal fortsat kunne gemmes uændret. Den samme
  røde feltfarve må aldrig bruges som bevis for samme save-policy som rejected input.
- Dokument-download og `.eo`-save er separate gates. Overfør aldrig disabled-krav eller dokumentorakler til
  Gem uden en udtrykkelig save-kontrakt.

Vælg et sink-egnet success-orakel. Fravær af netværkstrafik, downloadrequest eller app-overlay beviser aldrig,
at Gem ikke fortsatte: Chrome/Edge kan åbne en lokal File System Access-dialog, som ikke er en request og som
headless-auditten ikke kan afslutte eller inspicere. Registrér i så fald det præcise dialogdækningshul og brug
den implementerede save-projektion samt en browser/sink, hvor resultatet kan verificeres. Opret ikke et fund om
blokeret Gem, før den valgte sinks resultat eller handlerens dokumenterede blokering er kontrolleret.

### Dokument-orakel: severity før tekst

Fastlæg et issues severity og den berørte dokumentprojektion, før en aktiv eller blokeret download vurderes.
Udled aldrig en fejl alene af teksten, overskriften `Fejl og advarsler`, antallet af issues eller den viste
beregning:

- En `warning` skal ikke blokere beregning, dokument eller `.eo`. Kontroller, at `hasBlockingErrors` er falsk,
  og at download kan være aktiv, når der ikke findes andre blokeringer.
- Kun et dokumentrelevant `error` skal udløse dokumentgaten. Kontroller både den reaktive knaptilstand og den
  klikbaserede gate med en kontrast, hvor samme flade har et egentligt `error`.
- Aflæs og registrér issue-id, severity og den synlige statusmarkør. Kald ikke et issue en fejl, før severity er
  bekræftet i projektionen eller den autoritative issue-kilde.

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

Skriv samtidig lease-checkpointet, så en ny turn kan skelne mellem en afsluttet arbejdsenhed og en afbrudt arbejdsenhed:

```powershell
$lease = '.agents/skills/jette-interaktionsaudit/scripts/audit-session.mjs'
node $lease heartbeat --repo . --stage 'STATUS.md, fundregistre og næste scenarie er opdateret'
node $lease complete --repo . --next-scenario NEXT-ID --next-start-state 'Konkret ren starttilstand'
```

`complete` må først køres, når dokumenterne er skrevet. Hvis forbindelsen falder før `complete`, skal den aktive arbejdsenhed gentages; hvis `complete` er skrevet, startes næste scenarie med `begin`.

En række er kun `Dækket`, når den relevante brugeradfærd, kontrakt-/kodeafstemning, branches, afhængighedskanter, downstream-forbrugere og browser-/viewportvariationer er håndteret. En række, der kræver svar på et spørgsmål, står `Afventer afklaring` og tæller ikke som dækket.

Bevar beståede forhold kompakt som scenarie-, partitions- og evidensreferencer, så status kan genoptages. Brug detaljeret plads på reproducerbare fund, uafklarede spørgsmål og konkrete dækningshuller — ikke på gentagen historik om hver bestået handling.

Når brugeren beder om status, pause eller stop, skal alle åbne `QUESTIONS.md`-poster fremhæves og forelægges. Hvis brugeren senere besvarer et spørgsmål, registrér svaret i posten, opdatér de berørte rækker og genkør de arbejdsenheder, som svaret ændrer.

Ved ukontrolleret afbrydelse er en række `I gang` ikke pålidelig deldækning: genkør hele arbejdsenheden. En uafklaret række må ikke standse uafhængige rækker.

## Afslutningskriterium for en auditpass

Markér først den aktuelle auditpass afsluttet, når inventaret er afstemt mod både brugerflade, kontrakter og kildekode, ingen række står `Ikke startet`, `I gang` eller `Blokeret`, alle identificerede branches, skæringer, afhængighedskanter og browserdækninger har evidens, fund er reproduceret eller markeret som ustabile, og den fulde navigation-/stateful smoke er kørt uden nye systemfejl.

Åbne spørgsmål og resterende modelrisiko skal beskrives. En afsluttet auditpass afslutter kun den aktuelle pass — begynd næste pass efter den vedvarende arbejdssløjfe, indtil brugeren specifikt stopper eller pauser.
