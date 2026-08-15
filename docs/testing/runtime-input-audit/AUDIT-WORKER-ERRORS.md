# Fejl ved auditworkerens egen kørsel

Denne fil indeholder kun fejl i selve auditkørslen og dens lokale værktøjer.
Produktfund hører hjemme i `CRASHES.md`, `OBSERVATIONS.md` eller `QUESTIONS.md`.

Format: én append-only post pr. fejl. En fejl må ikke slettes eller overskrives
under en senere auditpass.

> **2026-08-14 — løst i skillen.** En gennemgang af posterne nedenfor viste seks
> gennemgående årsager, som tilsammen dækker langt de fleste poster: locator-fejl
> (rå CSS med accessible name, strict-mode, stale snapshot-refs), `beforeunload`-modal
> ved navigation, read-only-felter der kræver `dblclick` før `fill`, ikke-eksisterende
> CLI-kommandoer/-optioner, PowerShell-quoting i inline `run-code` og fejlslagen
> skjult serverstart. Alle seks er nu adresseret i `jette-interaktionsaudit`-skillen
> med et nyt bindende afsnit «Browsermekanik: de faste greb» — herunder en fast
> locator-rækkefølge med `data-mineo-field-address` som primær identitet. Samtidig er
> registreringsreglen strammet, så kendt og dokumenteret mekanik ikke længere
> registreres som driftsfejl. Posterne nedenfor bevares som append-only historik.


## 2026-08-14T18:21:14.616Z
- Type: tool-fejl
- Fase: verifikation
- Kommando/handling: Parallel shell-verifikation via Codex-værktøj
- Scenarie: SKILL-CHANGE
- Browser/viewport: ingen / ingen
- Kan genoptages: ja
- Fejl: Den samlede Promise.all-verifikation returnerede exit code 1 uden at eksponere hvilken delkørsel der fejlede.
- Detaljer: Kontrollerne gentages sekventielt.

## 2026-08-14T18:21:28.734Z
- Type: afbrudt-lease
- Fase: session-genoptagelse
- Kommando/handling: audit-session status
- Scenarie: SURF-005-MEN-REENTRY
- Browser/viewport: alle / 1920x1080
- Kan genoptages: ja
- Fejl: Eksisterende active lease havde intet heartbeat i cirka 12 timer og krævede recovery.
- Detaljer: Arbejdsenheden gentages fra ren tilstand efter recover/resume.

## 2026-08-14T18:23:16.169Z
- Type: værktøjspolitik
- Fase: audit-opstart
- Kommando/handling: Remove-Item keep-awake-worker.pid
- Scenarie: SURF-005-MEN-REENTRY
- Browser/viewport: ingen / ingen
- Kan genoptages: ja
- Fejl: Værktøjspolitikken afviste oprydning af en lokalt oprettet ekstra PID-fil.
- Detaljer: Keep-awake-processen og den autoritative keep-awake.pid er upåvirket; ekstra fil er ufarlig lokal state.

## 2026-08-14T18:31:59.906Z
- Type: headless-browser-crash
- Fase: automatisk smoke
- Kommando/handling: npm run test:e2e
- Scenarie: SURF-005-MEN-REENTRY
- Browser/viewport: chrome-desktop / 1536x864/1920x1080
- Kan genoptages: ja
- Fejl: Playwright-suite fejlede efter 8,3 minutter: browserContext.newPage: Target crashed i 8 Chromium-tests under 8 workers.
- Detaljer: 352 bestået, 40 skippet; målrettet reproduktion med lavere parallelitet skal afgøre om det er ressource-/parallelitetsbelastning eller stabil browserfejl.

## 2026-08-14T18:36:19.022Z
- Type: audit-handling
- Fase: manuelt feltflow
- Kommando/handling: playwright-cli fill e258
- Scenarie: SURF-005-MEN-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: Direkte fill på Fødselsdato fejlede, fordi Mineo-feltet er readonly før editorens dobbeltklik-åbning.
- Detaljer: Ingen produktændring; gentaget med dblclick → fill → Tab.

## 2026-08-14T18:38:36.021Z
- Type: audit-handling
- Fase: orakel-kontrol
- Kommando/handling: playwright-cli eval med CSS-selector
- Scenarie: SURF-005-MEN-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: Første eval-kommando blev forkert escaped i PowerShell og fejlede med CSS-selector-parsning.
- Detaljer: Ingen browser-/produktfejl; oraklet gentages med en enklere selector.

## 2026-08-14T18:40:39.893Z
- Type: browser-timeout
- Fase: F5/session-preservering
- Kommando/handling: playwright-cli reload
- Scenarie: SURF-005-MEN-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: Reload hangede og overskred playwright-cli-værktøjets cirka 34 sekunders timeout.
- Detaljer: Side/kontekst inspiceres med snapshot; hvis den er ubrugelig gentages fra ren login.

## 2026-08-14T18:45:52.591Z
- Type: audit-handling
- Fase: rentetabel
- Kommando/handling: playwright-cli dblclick Renter fra
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: Locator for Renter fra blev tvetydig, efter at beløbssettle korrekt oprettede en trailing-række.
- Detaljer: Bruger præcis første tabelrække med Slet rækken; trailing-rækken skal ikke målrettes ved denne handling.

## 2026-08-14T18:46:26.951Z
- Type: audit-handling
- Fase: nulstillingsflow
- Kommando/handling: playwright-cli click Slet alle indtastninger
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: Første locator-kald til Slet alle indtastninger blev afvist af CLI-værktøjets parser.
- Detaljer: Gentages med snapshot-ref e261; ingen browserhandling blev udført.

## 2026-08-14T18:47:18.477Z
- Type: audit-handling
- Fase: rentetabel-reset-orakel
- Kommando/handling: playwright-cli eval querySelectorAll
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: Reset-oraklets første CSS-selector for Enhed for tillægstid manglede citationstegn og fejlede.
- Detaljer: Reset-handlingen var udført; oraklet gentages med simpler selektorer.

## 2026-08-14T18:47:42.123Z
- Type: audit-handling
- Fase: rentetabel-enhed
- Kommando/handling: playwright-cli select e528 Måneder
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: MUI-comboboxen Enhed for tillægstid er ikke en native select, så CLI-select fejlede.
- Detaljer: Bruger klik og synlig listbox i stedet; ingen produktfejl.

## 2026-08-14T18:49:52.704Z
- Type: audit-handling
- Fase: rentefejl-orakel
- Kommando/handling: playwright-cli eval querySelector
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: Første invalid-date-orakel brugte en CSS-attributselector uden citationstegn og fejlede.
- Detaljer: Feltsettle var gennemført; oraklet gentages uden den selector.

## 2026-08-14T18:51:19.465Z
- Type: audit-handling
- Fase: rentetabel-range-orakel
- Kommando/handling: playwright-cli eval querySelectorAll
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: Renter-fra-oraklets CSS-selector med label mellemrum manglede citationstegn og fejlede.
- Detaljer: Feltsettle var gennemført; oraklet gentages via input-listens aria-label-filter.

## 2026-08-14T18:51:51.344Z
- Type: audit-handling
- Fase: rentefejl-genoprettelse
- Kommando/handling: playwright-cli dblclick præcis række-locator
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: ja
- Fejl: CLI-kald med regex-locator blev igen afvist af værktøjsparseren før browserhandlingen.
- Detaljer: Henter frisk snapshot-ref og fortsætter uden at ændre brugerdata.

## 2026-08-14T18:54:04.970Z
- Type: tool
- Fase: SURF-008
- Kommando/handling: playwright-cli press e768 Tab
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: CLI-kommandoen fejlede, fordi press-argumentet blev fortolket som to argumenter; fill lykkedes, og handlingen blev gentaget med separat korrekt syntaks.
- Detaljer: —

## 2026-08-14T18:55:24.132Z
- Type: tool
- Fase: SURF-008
- Kommando/handling: pdftotext -layout .playwright-cli\\Procesrente-10-000-00-kr-11-01-2021---31-12-2030-.pdf -
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: pdftotext er ikke installeret i auditmiljøet; PDF-downloaden lykkedes, og filen kontrolleres med den tilgængelige Python PDF-læser.
- Detaljer: —

## 2026-08-14T18:56:09.828Z
- Type: tool
- Fase: SURF-008
- Kommando/handling: playwright-cli console warn
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: CLI-kommandoen brugte det ugyldige niveau 'warn'; korrekt niveau er 'warning'. Den efterfølgende kontrol blev kørt med den korrekte syntaks.
- Detaljer: —

## 2026-08-14T18:56:18.213Z
- Type: tool
- Fase: SURF-008
- Kommando/handling: playwright-cli pageerrors
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: Denne playwright-cli-version har ingen pageerrors-kommando; console.error og console warning blev kontrolleret, og browserens tilgængelige CLI-output viste ingen registrerede fejl eller advarsler.
- Detaljer: —

## 2026-08-14T18:56:41.988Z
- Type: tool
- Fase: SURF-008
- Kommando/handling: playwright-cli screenshot .playwright-cli/renteberegning-1920x1080.png
- Scenarie: SURF-008-RENTE-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: CLI-versionen fortolkede filstien som en locator og fejlede på tom CSS-selector; screenshot blev gentaget med CLI'ens standard-output.
- Detaljer: —

## 2026-08-14T18:58:30.257Z
- Type: server
- Fase: SURF-009
- Kommando/handling: Start-Process node.exe vite.mineo.config.ts --host 127.0.0.1
- Scenarie: SURF-009-SATSER-REENTRY
- Browser/viewport: alle / 1920x1080
- Kan genoptages: --message
- Fejl: Skjult Vite-server var ikke synlig på port 4173 efter 2 sekunder (start-PID 17516); processen og den valgte startmåde kontrolleres, før auditpasset fortsætter.
- Detaljer: —

## 2026-08-14T18:59:10.060Z
- Type: server
- Fase: SURF-009
- Kommando/handling: Start-Process node.exe -WorkingDirectory C:\\Users\\bjell\\Mineo vite.js --config vite.mineo.config.ts
- Scenarie: SURF-009-SATSER-REENTRY
- Browser/viewport: alle / 1920x1080
- Kan genoptages: --message
- Fejl: Gentaget skjult Vite-start med eksplicit arbejdsmappe åbnede heller ikke port 4173 efter 5 sekunder (start-PID 23636); startkommandoen inspiceres og skiftes til projektets dokumenterede dev:e2e-kommando uden --open.
- Detaljer: —

## 2026-08-14T19:00:38.479Z
- Type: tool
- Fase: SURF-009
- Kommando/handling: playwright-cli dblclick/fill/press/snapshot uden -s=chrome
- Scenarie: SURF-009-SATSER-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: En samlet CLI-kæde manglede den aktive sessions -s=chrome-option og fejlede med 'browser default is not open'; samme handling blev gentaget i chrome-sessionen.
- Detaljer: —

## 2026-08-14T19:02:30.026Z
- Type: browser
- Fase: SURF-009
- Kommando/handling: playwright-cli reload
- Scenarie: SURF-009-SATSER-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: Headless reload ventede 60 sekunder på navigation, fordi beforeunload-dialogen holdt reload-kaldet åbent; dialogen accepteres og tilstanden kontrolleres efterfølgende.
- Detaljer: —

## 2026-08-14T19:04:08.222Z
- Type: tool
- Fase: SURF-010
- Kommando/handling: Get-Content src/contracts/app-settings-contract.md
- Scenarie: SURF-010-INDSTILLINGER-REENTRY
- Browser/viewport: alle / 1920x1080
- Kan genoptages: --message
- Fejl: Kontraktnavnet blev slået op med forkert suffiks; filen findes som app-settings.md og blev læst efterfølgende.
- Detaljer: —

## 2026-08-14T19:05:59.457Z
- Type: tool
- Fase: SURF-010
- Kommando/handling: playwright-cli click e569
- Scenarie: SURF-010-INDSTILLINGER-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: Efter valg af SH-udbetaling ændrede re-renderen alle refs; stale ref e569 kunne ikke bruges. Den næste dropdown blev åbnet med navngiven rolle-locator.
- Detaljer: —

## 2026-08-14T19:07:30.259Z
- Type: tool
- Fase: SURF-010
- Kommando/handling: playwright-cli click e1e908 uden -s=chrome
- Scenarie: SURF-010-INDSTILLINGER-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: En CLI-handling manglede session-optionen og ramte ikke browserens aktive snapshot; handlingen blev gentaget med navngiven locator i chrome-sessionen.
- Detaljer: —

## 2026-08-14T19:07:46.795Z
- Type: tool
- Fase: SURF-010
- Kommando/handling: playwright-cli click e1e941 uden -s=chrome
- Scenarie: SURF-010-INDSTILLINGER-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: En dialoghandling manglede session-optionen; den aktive bekræftelsesdialog blev håndteret med navngiven locator i chrome-sessionen.
- Detaljer: —

## 2026-08-14T19:10:28.051Z
- Type: tool
- Fase: SURF-011
- Kommando/handling: forkert orchestrator-kald tools.exec
- Scenarie: SURF-011-OM-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: Et internt værktøjskald brugte et ikke-eksisterende nested-tools.exec-navn; ingen browserhandling blev udført, og auditten fortsatte med den korrekte shell/browser-kæde.
- Detaljer: —

## 2026-08-14T19:12:23.213Z
- Type: browser
- Fase: SURF-011
- Kommando/handling: playwright-cli run-code waitForEvent(download) på Download hjælpeprogram
- Scenarie: SURF-011-OM-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: Klik på Download hjælpeprogram gav ingen Playwright-download-event inden for 30 sekunder; siden og netværkslisten kontrolleres, og der konkluderes ikke produktfejl uden en reproducerbar filhandling.
- Detaljer: —

## 2026-08-14T19:14:09.575Z
- Type: server
- Fase: SURF-011
- Kommando/handling: stop exact Vite PID 40348
- Scenarie: SURF-011-OM-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: Cleanup-checkens forudkendte PID var forkert; port 4173 ejedes i stedet af PID 10564. Processens commandline verificeres før præcis stop, så ingen urelateret proces rammes.
- Detaljer: —

## 2026-08-14T19:15:03.864Z
- Type: tool
- Fase: SURF-012
- Kommando/handling: playwright-cli fill/click e17/e18 before login snapshot
- Scenarie: SURF-012-OPEN-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: Login-handlingen blev sendt før første snapshot og brugte refs fra en tidligere browserkontekst; begge handlinger fejlede uden at ændre state og blev gentaget efter det aktuelle snapshot.
- Detaljer: —

## 2026-08-14T19:15:17.316Z
- Type: tool
- Fase: SURF-012
- Kommando/handling: playwright-cli fill/click e1e17/e1e18
- Scenarie: SURF-012-OPEN-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: Det aktuelle snapshot brugte refs med f2-prefix, så e1e17/e1e18 var også stale refs. Login fortsættes med navngivne locators.
- Detaljer: —

## 2026-08-14T19:22:14.515Z
- Type: tool
- Fase: EDGE-001
- Kommando/handling: playwright-cli click Stamdata
- Scenarie: EDGE-001-STAM-REENTRY
- Browser/viewport: chrome / 1920x1080
- Kan genoptages: --message
- Fejl: CLI-korttargeten 'Stamdata' kunne ikke matches; den aktive navigation blev gentaget med navngiven rolle-locator.
- Detaljer: —

## 2026-08-14T19:28:39.262Z
- Type: tool
- Fase: EDGE-002-browser-start
- Kommando/handling: npx --no-install playwright-cli -s=chrome open http://127.0.0.1:4173/erstatningsopgoerelse --browser=chromium --viewport-size=1920,1080
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: playwright-cli afviste en ukendt --viewport-size-option ved headless browserstart; browseren blev ikke startet med denne kommando.
- Detaljer: —

## 2026-08-14T19:29:01.374Z
- Type: tool
- Fase: EDGE-002-login
- Kommando/handling: playwright-cli fill input[aria-label=Adgangskode]
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Den første adgangskode-selector matchede ikke loginfeltet; snapshot viste textbox med accessible name Adgangskode.
- Detaljer: —

## 2026-08-14T19:29:21.563Z
- Type: tool
- Fase: EDGE-002-inspection
- Kommando/handling: playwright-cli run-code await page.locator(...)
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: run-code blev kaldt med forkert CLI-syntaks og gav SyntaxError; ingen produktkode blev kørt.
- Detaljer: —

## 2026-08-14T19:30:37.185Z
- Type: tool
- Fase: EDGE-002-period-input
- Kommando/handling: playwright-cli run-code table input fill
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Periodefeltet var read-only for direkte fill; locator.fill timeoutede. Feltmotoren kræver den eksisterende editor-interaktion via klik/dobbeltklik, så passet skal genoptages med samme UI-flow.
- Detaljer: Locator table[0] input[0]

## 2026-08-14T19:30:47.450Z
- Type: tool
- Fase: EDGE-002-period-input
- Kommando/handling: playwright-cli click table:nth-of-type(1) input[aria-label=Fra o.m.]
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Den generiske CSS-selector til Fra o.m. matchede tre periodefelter og gav strict-mode violation; bruger en tabelafgrænset locator i næste forsøg.
- Detaljer: —

## 2026-08-14T19:33:31.362Z
- Type: tool
- Fase: EDGE-002-beregning-gate
- Kommando/handling: playwright-cli click tab:has-text(Beregning)
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Tab-selectorens syntaks var forkert og matchede ikke Beregning-fanen; den efterfølgende statekontrol viste fortsat EO oplysninger uden produktfejl.
- Detaljer: —

## 2026-08-14T19:35:12.881Z
- Type: browser
- Fase: EDGE-002-navigation-reentry
- Kommando/handling: playwright-cli goto /stamdata; goto /erstatningsopgoerelse
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Navigation fra Erstatningsopgørelse til Stamdata og retur timeoutede uden CLI-output; browser/session skal kontrolleres med snapshot før genoptagelse.
- Detaljer: —

## 2026-08-14T19:35:23.090Z
- Type: browser
- Fase: EDGE-002-navigation-reentry
- Kommando/handling: playwright-cli snapshot
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Navigation ramte den forventede beforeunload-dialog med tom besked; snapshot kunne ikke læses før dialogen blev håndteret.
- Detaljer: Modal state: beforeunload dialog with message empty

## 2026-08-14T19:35:41.466Z
- Type: tool
- Fase: EDGE-002-navigation-reentry
- Kommando/handling: playwright-cli wait-for-time 1000
- Scenarie: EDGE-002-EO-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: playwright-cli har ingen wait-for-time-kommando; forsøget returnerede CLI-hjælp, mens efterfølgende snapshot fortsatte normalt.
- Detaljer: —

## 2026-08-14T19:37:46.119Z
- Type: server
- Fase: EDGE-002-EET-server-start
- Kommando/handling: npm run generate:build-info; Start-Process npm.cmd run dev:e2e -- --port 4173
- Scenarie: EDGE-002-EET-CHOICES-REENTRY
- Browser/viewport: ukendt / ukendt
- Kan genoptages: true
- Fejl: Skjult serverstart med kombineret PowerShell-kommando blev afvist af shell-policy før kommandoen kørte; ingen produktproces blev startet.
- Detaljer: —

## 2026-08-14T19:39:09.908Z
- Type: tool
- Fase: EDGE-002-EET-stamdata
- Kommando/handling: playwright-cli fill Stamdata-felter uden først at åbne editor
- Scenarie: EDGE-002-EET-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Stamdatafelterne startede i read-only-fokusmode; direkte fill timeoutede for Journalnr., Advokat, Sagsbehandler og Skadelidtes navn, og kommandoen sluttede med timeout. Efterfølgende datoeditorer blev åbnet med dblclick.
- Detaljer: —

## 2026-08-14T19:39:56.174Z
- Type: tool
- Fase: EDGE-002-EET-baseline
- Kommando/handling: playwright-cli run-code baseline fields
- Scenarie: EDGE-002-EET-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Baseline-scriptet ramte strict-mode violation, fordi accessible name Årsløn også findes for EAL-feltet; Beregningsdato var allerede behandlet, resten blev ikke kørt.
- Detaljer: —

## 2026-08-14T19:40:20.356Z
- Type: tool
- Fase: EDGE-002-EET-choice
- Kommando/handling: playwright-cli click input[aria-label=Afgørelsestype]
- Scenarie: EDGE-002-EET-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Afgørelsestype-selectoren matchede begge tabelrækker og gav strict-mode violation; første række afgrænses eksplicit i næste forsøg.
- Detaljer: —

## 2026-08-14T19:41:04.873Z
- Type: tool
- Fase: EDGE-002-EET-choice
- Kommando/handling: playwright-cli run-code row filter Afgørelsestype
- Scenarie: EDGE-002-EET-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Row-filteret fandt ikke første afgørelsestype inden timeout; næste forsøg bruger tabellocatorens første række direkte.
- Detaljer: —

## 2026-08-14T19:41:57.369Z
- Type: tool
- Fase: EDGE-002-EET-choice
- Kommando/handling: playwright-cli click [role=option]:has-text(Endelig) and readback
- Scenarie: EDGE-002-EET-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Valgscriptet for Endelig timeoutede uden output efter option-locator; browserens modal/snapshot-state kontrolleres før genoptagelse.
- Detaljer: —

## 2026-08-14T19:42:48.364Z
- Type: tool
- Fase: EDGE-002-EET-choice
- Kommando/handling: playwright-cli click text=Endelig; readback
- Scenarie: EDGE-002-EET-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Eftervalg-scriptet timeoutede; den efterfølgende snapshot skal afgøre om valget faktisk blev committet eller om readback-locator var forkert.
- Detaljer: —

## 2026-08-14T19:46:23.859Z
- Type: tool
- Fase: EDGE-002-AAR-login
- Kommando/handling: playwright-cli fill input[type=password]
- Scenarie: EDGE-002-AAR-CHOICES-REENTRY
- Browser/viewport: Chrome / ukendt
- Kan genoptages: true
- Fejl: Loginselectoren input[type=password] matchede ikke i denne session; snapshot viste textbox med accessible name Adgangskode, som nu bruges eksplicit.
- Detaljer: —

## 2026-08-14T19:46:37.373Z
- Type: tool
- Fase: EDGE-002-AAR-login
- Kommando/handling: playwright-cli fill input[aria-label=Adgangskode]
- Scenarie: EDGE-002-AAR-CHOICES-REENTRY
- Browser/viewport: Chrome / ukendt
- Kan genoptages: true
- Fejl: Loginfeltet havde ikke aria-label-attribut i DOM'en selv om accessible name er Adgangskode; første fallback-selector matchede derfor ikke.
- Detaljer: —

## 2026-08-14T19:47:12.215Z
- Type: tool
- Fase: EDGE-002-AAR-choices
- Kommando/handling: playwright-cli click input[type=checkbox]
- Scenarie: EDGE-002-AAR-CHOICES-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Generisk checkbox-selector matchede omregningskontrollen og to disabled afhængige kontroller; omregning kontrolleres nu med accessible name.
- Detaljer: —

## 2026-08-14T19:48:46.747Z
- Type: tool
- Fase: EDGE-002-AAR-heartbeat
- Kommando/handling: audit-session heartbeat
- Scenarie: EDGE-002-AAR-CHOICES-REENTRY
- Browser/viewport: ukendt / ukendt
- Kan genoptages: true
- Fejl: Heartbeat-kaldets orkestrering havde en syntaksfejl i værktøjskaldet før audit-session-scriptet blev startet; korrekt heartbeat køres straks efter.
- Detaljer: —

## 2026-08-14T19:52:32.200Z
- Type: tool
- Fase: EDGE-003-tab-reentry
- Kommando/handling: playwright-cli click tab:has-text(Rentesatser); click tab:has-text(Beregning)
- Scenarie: EDGE-003-RENTE-ROWS-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Generiske tab-CSS-selectorer matchede ikke MUI-fanerne; direkte statekontrol viste dog, at begge rækker og beregningsdato fortsat var bevaret.
- Detaljer: —

## 2026-08-14T19:55:06.317Z
- Type: tool
- Fase: EDGE-003-EET-row-fill
- Kommando/handling: playwright-cli run-code EET two-row baseline
- Scenarie: EDGE-003-EET-ROWS-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Baseline-scriptet stoppede ved Kap.dato, fordi accessible-name-locator matchede både Kap.dato og Hvis genopt. - tidl. kap.dato; tidligere felter i række 1 var allerede committed.
- Detaljer: —

## 2026-08-14T19:56:15.876Z
- Type: browser
- Fase: EDGE-003-EET-row-delete
- Kommando/handling: playwright-cli click Slet rækken nth(1)
- Scenarie: EDGE-003-EET-ROWS-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Række 2's Slet rækken-knap var synlig men blev dækket af en tabelcelle ved pointer-click; passet genoptages med samme knap efter eksplicit scroll/force-click.
- Detaljer: —

## 2026-08-14T20:05:26.816Z
- Type: tool
- Fase: EDGE-004-settings
- Kommando/handling: playwright-cli run-code settings toggles
- Scenarie: EDGE-004-SETTINGS-MULTI-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Settings-scriptet stoppede ved Regulering, fordi accessible name også matchede den beregningstekniske kontrol Tillad regulering; Mørkt, Satser og SH-dage var allerede sat.
- Detaljer: —

## 2026-08-14T20:05:52.728Z
- Type: tool
- Fase: EDGE-004-settings
- Kommando/handling: playwright-cli run-code settings readback
- Scenarie: EDGE-004-SETTINGS-MULTI-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Settings-readback matchede tre checked radiofelter (tema, lønperiode, svie/smerte); Word-valget var allerede foretaget, men readback-scriptet stoppede ved den tvetydige selector.
- Detaljer: —

## 2026-08-14T20:07:46.750Z
- Type: tool
- Fase: EDGE-004-settings-satser
- Kommando/handling: playwright-cli snapshot -s=chrome
- Scenarie: EDGE-004-SETTINGS-MULTI-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Snapshot-kommandoet blev kaldt med -s=chrome to gange, så CLI'en forsøgte at åbne sessionen chrome,chrome; ingen produktændring.
- Detaljer: —

## 2026-08-14T20:09:34.333Z
- Type: script
- Fase: EDGE-004-session-close
- Kommando/handling: node audit-session.mjs --help
- Scenarie: EDGE-004-SETTINGS-MULTI-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: audit-session-scriptet accepterer ikke --help; hjælpekommandoen returnerede exit 1 og angav at syntaksen fås med help.
- Detaljer: —

## 2026-08-14T20:10:53.056Z
- Type: browser
- Fase: EDGE-005-login
- Kommando/handling: playwright-cli fill/click stale snapshot refs
- Scenarie: EDGE-005-SAVELOAD-SETTINGS-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Login-scriptet brugte de sammensmeltede snapshot-referencer e3e17/e3e18 i stedet for de faktiske e17/e18; ingen produktændring, gentages med accessible locators.
- Detaljer: —

## 2026-08-14T20:11:01.358Z
- Type: browser
- Fase: EDGE-005-login
- Kommando/handling: playwright-cli fill/click accessible names
- Scenarie: EDGE-005-SAVELOAD-SETTINGS-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: CLI fill/click-kommandoet fortolkede den synlige accessible name som en selector og fandt ikke felterne; login gentages med run-code.
- Detaljer: —

## 2026-08-14T20:12:11.145Z
- Type: tool
- Fase: EDGE-005-stamdata
- Kommando/handling: playwright-cli wait-for-time 1000
- Scenarie: EDGE-005-SAVELOAD-SETTINGS-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: CLI'en har ingen wait-for-time-kommando; snapshot blev kørt umiddelbart efter navigation og viste siden korrekt.
- Detaljer: —

## 2026-08-14T20:12:39.823Z
- Type: tool
- Fase: EDGE-005-save-branch
- Kommando/handling: playwright-cli run-code hasSavePicker
- Scenarie: EDGE-005-SAVELOAD-SETTINGS-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Save-picker-readback brugte window i run-code-omgivelserne i stedet for page.evaluate og gav ReferenceError; ingen brugerrejse blev ændret.
- Detaljer: —

## 2026-08-14T20:14:30.235Z
- Type: browser
- Fase: EDGE-005-settings-f5
- Kommando/handling: playwright-cli goto/reload/run-code
- Scenarie: EDGE-005-SAVELOAD-SETTINGS-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Forsøg på navigation og F5 mens Stamdata havde afsluttet ændringer blev blokeret af produktets beforeunload-dialog; goto timede ud, reload og efterfølgende readback blev afvist i modal state. Dialogen accepteres og kontrollen gentages med eksplicit dialog-håndtering.
- Detaljer: Fejlene var: goto timeout 60000ms; browser_reload håndterer ikke modal state; browser_run_code håndterer ikke modal state.

## 2026-08-14T20:16:44.403Z
- Type: browser
- Fase: EDGE-005-load-apply
- Kommando/handling: playwright-cli click Erstat then settings
- Scenarie: EDGE-005-SAVELOAD-SETTINGS-REENTRY
- Browser/viewport: WebKit / 1920x1080
- Kan genoptages: true
- Fejl: CLI-click på overlay-knappen Erstat fandt ikke knappen via den korte tekstselector; efterfølgende settings-readback timede ud, fordi preflight-dialogen stadig var åben. Gentages med exact accessible locator.
- Detaljer: —

## 2026-08-14T20:22:35.249Z
- Type: browser
- Fase: EDGE-007-reset-repeat
- Kommando/handling: playwright-cli run-code cancel/reopen/Escape
- Scenarie: EDGE-007-RESET-KEYBOARD-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Repetitionsscriptet antog at dialogen stadig var åben efter første Escape-resultat; ved næste run-code var dialogen allerede lukket, så Annuller-locatoren timede ud. Kontrollens faktiske første måling viste dialogCount=1 umiddelbart efter Escape.
- Detaljer: —

## 2026-08-14T20:25:39.864Z
- Type: browser
- Fase: EDGE-008-navigation
- Kommando/handling: playwright-cli run-code navigation with page.on(dialog)
- Scenarie: EDGE-008-SAVE-REJECTED-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Navigationstestet nåede ikke readback: produktets beforeunload-dialog stod fortsat i modal state trods page.on('dialog')-handler. Dialogen accepteres via CLI og readback gentages.
- Detaljer: —

## 2026-08-14T20:25:45.711Z
- Type: tool
- Fase: EDGE-008-navigation
- Kommando/handling: playwright-cli dialog-accept after navigation
- Scenarie: EDGE-008-SAVE-REJECTED-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Efter den foregående navigation var modal state allerede væk, så dialog-accept returnerede exit 1; siden stod igen på Stamdata.
- Detaljer: —

## 2026-08-14T20:27:51.818Z
- Type: browser
- Fase: EDGE-009-f5
- Kommando/handling: playwright-cli run-code page.reload with dialog handler
- Scenarie: EDGE-009-REJECTED-UNDO-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: F5-readback blev afbrudt af beforeunload-dialogens modal state; page.on('dialog') håndterede den ikke i CLI-omgivelserne. Den browserbaserede gendannelse var allerede verificeret før reload.
- Detaljer: —

## 2026-08-14T20:30:30.448Z
- Type: browser
- Fase: EDGE-010-f5
- Kommando/handling: playwright-cli reload
- Scenarie: EDGE-010-REJECTED-F5-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Reload af rejected state timede ud efter 60 sekunder, selv om browseren fortsatte til reload-forløbet; der tages snapshot og readback efterfølgende for at verificere om state overlevede.
- Detaljer: —

## 2026-08-14T20:30:41.336Z
- Type: tool
- Fase: EDGE-010-f5
- Kommando/handling: playwright-cli snapshot during beforeunload modal
- Scenarie: EDGE-010-REJECTED-F5-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Snapshot blev kaldt mens beforeunload-dialogen stadig var aktiv og kunne derfor ikke udføres; dialogen accepteres før readback.
- Detaljer: —

## 2026-08-14T20:32:42.095Z
- Type: tool
- Fase: EDGE-011-restore
- Kommando/handling: playwright-cli run-code restore rejected date
- Scenarie: EDGE-011-REJECTED-DOWNSTREAM-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Restore-scriptet blev splittet af PowerShell, fordi run-code-koden indeholdt en forkert escaped indre double-quote; ingen sidehandling blev gennemført.
- Detaljer: —

## 2026-08-14T20:33:22.256Z
- Type: browser
- Fase: EDGE-011-viewport
- Kommando/handling: playwright-cli screenshot before explicit resize
- Scenarie: EDGE-011-REJECTED-DOWNSTREAM-REENTRY
- Browser/viewport: Chrome / 1280x720
- Kan genoptages: true
- Fejl: Den åbne CLI-session stod på standardviewport 1280x720, selv om arbejdsenheden er planlagt til 1920x1080; screenshot blev derfor ikke brugt som 1920-evidens. Viewporten sættes eksplicit til 1920x1080 og kontrollen gentages.
- Detaljer: —

## 2026-08-14T20:35:53.490Z
- Type: tool
- Fase: EDGE-012-rejected
- Kommando/handling: playwright-cli run-code valid-to-rejected downstream
- Scenarie: EDGE-012-EO-DOWNSTREAM-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Valid-til-rejected-scriptet blev splittet af PowerShell på grund af en forkert escaped indre double-quote; ingen sidehandling blev gennemført.
- Detaljer: —

## 2026-08-14T20:36:50.170Z
- Type: tool
- Fase: EDGE-012-restore
- Kommando/handling: playwright-cli run-code restore and read stale Stamdata locator
- Scenarie: EDGE-012-EO-DOWNSTREAM-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Restore-scriptet forsøgte at læse Stamdata-dato-locatoren efter navigation til EO, hvor elementet ikke længere var mounted; navigation og restore var udført, men readback-scriptet timede ud.
- Detaljer: —

## 2026-08-14T20:40:51.656Z
- Type: browser
- Fase: EDGE-014-setup
- Kommando/handling: playwright-cli run-code login/settings/EO baseline
- Scenarie: EDGE-014-EO-WORD-F5-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Samlet setup-script timede ud ved settings-format-locator efter login; sessionen stod fortsat på Stamdata, så setup gentages i mindre trin med friske locators.
- Detaljer: —

## 2026-08-14T20:42:06.407Z
- Type: browser
- Fase: EDGE-014-f5
- Kommando/handling: playwright-cli reload
- Scenarie: EDGE-014-EO-WORD-F5-REENTRY
- Browser/viewport: Chrome / 1920x1080
- Kan genoptages: true
- Fejl: Reload af valid EO/Word-state timede ud på 60 sekunder ved beforeunload-forløbet; dialogen håndteres og state aflæses bagefter.
- Detaljer: —
