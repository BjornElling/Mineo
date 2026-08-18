# App-shell & multi-app — Mineo

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Selvstændig tværgående kontrakt for det øverste runtime-lag (app-entry, bootstrap, multi-app-isolation). Ligger *over* sidekomponent-laget: `page-component-contract.md §3.1` er underordnet denne kontrakt for alt der angår app-entry, device-gate-placering og shell-ansvar. Berører ikke beregnings-, form- eller persistence-*indhold* og overlapper derfor ikke de øvrige tværgående kontrakter — men den ejer den *namespace-isolation*, der holder to app-varianters persistence adskilt (jf. `persistence-contract.md`).
**Senest verificeret mod kode:** 2026-08-18

## 1. Scope

Det øverste runtime-lag, der binder programmet sammen, og isolationen mellem de to app-varianter:

- App-entries: `src/main.tsx` (Mineo) og `src/apps/minprocesrente/minprocesrenteMain.tsx` (standalone MinProcesrente).
- Delt app-shell: `src/apps/shared/bootstrapClientApp.tsx` (device-gate, render-beslutning, install-prompt-politik og installation af den fælles Vite-recovery).
- Delt PWA-display-mode-aflæsning: `src/utils/pwaDisplayMode.ts` (fælles standalone-signal for install-flowet).
- Vite lazy-load-recovery: `src/apps/shared/vitePreloadRecovery.ts` (sidste sikkerhedsnet for et manglende lazy asset; den normale deploybeskyttelse ligger i service-workerens versionscache).
- Service-worker-kilde: `sw/mineoServiceWorker.js` (skabelon; buildet substituerer versionen og emitterer `sw.js`).
- Delt device-aflæsning: `src/utils/clientDevice.ts` (rene browser-/skærmcapabilities og orienteringsstabile touch-klassifikationer, uden app-shell-render-beslutninger).
- Mineo-specifik opstart: `src/apps/mineo/serviceWorkerBootstrap.ts` (service-worker-registrering, versionsprobe og opstartens ene opdateringsbarriere — der findes hverken opdateringsstatus eller brugerbekræftet reload, jf. §2.8).
- Lazy-recoverylinje: `src/components/system/LazyChunkRecoveryNotice.tsx` (sidste værn for en manglende lazy chunk; **ikke** en opdateringslinje).
- PWA-filåbning: `src/utils/pwaLaunchQueue.ts` (launchQueue-consumer og versionssikker pending request).
- PWA-cachepolitik: `public/_headers` (revalidering af HTML, SPA-ruter, manifest, service worker og assetmanifest; immutable hashed assets).
- Standalone-specifik opstart og isolation: `src/apps/minprocesrente/standaloneStorageNamespace.ts`, `MinProcesrenteApp.tsx`, `StandaloneErrorBoundary.tsx`.
- Storage-namespace-maskineriet i `src/config/storageManifest.ts` (for så vidt det adskiller varianterne).

Den informative uddybning af device-gatens motivation ligger i `AGENTS.md` ("Desktop-only gate"). Dette dokument ejer de bindende regler for shell-laget.

## 2. Normative Regler

1. **Tynde app-entries; ét sted ejer opstart.** Hver entry (`main.tsx`, `minprocesrenteMain.tsx`) skal være tynd: den vælger app-roden og leverer variant-specifik opstart som callbacks, men delegerer al fælles runtime-opstart (device-gate, render-beslutning, install-prompt) til `bootstrapClientApp`. Device-gate-logik må aldrig duplikeres i en entry.

   Efter device-gaten og før app-roden returneres fra `renderApp`, initialiseres variantens ene aktive inputruntime
   præcis én gang gennem `bootstrapProductionInputRuntime()`; en entry/provider-remount må aldrig rehydrere.
   **Entries kalder ikke `initializeInputRuntime` direkte** — den ligger bag `bootstrapProductionInputRuntime`,
   som ejer idempotens-guarden (`src/inputCore/react/productionInputRuntime.tsx`); et direkte kald ville omgå
   netop den guard, reglen findes for. **Hver variant har præcis ÉN inputruntime** — der findes ikke og må ikke
   indføres en anden persistence-provider ved siden af den.
   Standalone-entryen binder tilsvarende sin egen runtime atomisk med surface og consumers.
   Standalone-entryens namespace-side-effect skal være etableret før enhver
   runtimeinitialisering. Unsupported-device hard-stop må ikke initialisere sagsstate.

2. **Device-gaten ejes af app-shellen.** `isUnsupportedDevice` og `UNSUPPORTED_MAX_SHORTEST_SIDE_PX` lever kun i `bootstrapClientApp.tsx`. Rene browser-/skærmcapabilities og orienteringsstabile touch-klassifikationer (`isTouchLikeDevice`, fysisk skærmkortside, viewport-kortside, `isTouchLikeDeviceWithShortestSideAtMost`) lever i `src/utils/clientDevice.ts`, så samme aflæsninger kan genbruges uden at duplikere device-logik i sidekomponenter. Ved uunderstøttet enhed renderes `UnsupportedDevicePage` som hård stop, og App-roden monteres ikke. Gaten bruger touch-enhedens stabile kortside, så rotation ikke kan åbne en ellers blokeret tablet. Gaten er **fail-closed**: kan hverken fysisk skærm eller viewport aflæses på en touch-lignende enhed, behandles enheden som uunderstøttet. En app-variant kan eksplicit fravælge gaten via `enforceUnsupportedDeviceGate: false` (kun standalone-beregneren, der bevidst skal virke på mobil).

3. **Multi-app-isolation — ingen krydsimport.** Standalone-laget (`src/apps/minprocesrente/**`, `src/components/pages/minprocesrente/**` og dedikerede standalone-services) må ikke importere Mineos auth-, route-, PWA-, service-worker- eller diagnose-flow (`AuthGate`, `BrowserRouter`/`App`, `pwaLaunchQueue`, `serviceWorker*`, `systemIssueReporter`/`reportSystemIssue`). Forbuddet håndhæves strukturelt af AST-reglen `layer/minprocesrente-standalone-import-boundary`.

   Det delte flademateriale er derimod **ikke** begrænset til tilstandsløse moduler. Ud over de rene moduler (beregning, schemas, formatering, PDF-rendering) deler de to varianter også konkrete UI-komponenter med egen state — `RenteberegningTab.tsx`, `SiblingSitesFooter.tsx` og `StandaloneCalculatorLayout.tsx`. Det er bevidst (brugerbeslutning 2026-08-06, jf. §5.3): en split i to varianter ville give to kopier af samme flade uden synlig gevinst. Reglen er derfor et forbud mod at dele **shell-, auth-, route-, PWA- og diagnose-flow**, ikke et krav om tilstandsløshed i det delte.

4. **Storage-namespace sættes før al storage-adgang og kan ikke skifte.** Hver variant kører i sit eget sessionStorage-namespace (`mineo` eller `minprocesrente`). `setStorageNamespace(...)` kaldes præcis én gang ved bootstrap, *før* noget modul kan nå at røre sessionStorage; gentagelse med samme værdi er idempotent, mens et skift fejler hårdt. Begge entries håndhæver rækkefølgen med en **bivirknings-import** som første import (`mineoStorageNamespace.ts` henholdsvis `standaloneStorageNamespace.ts`) — før App-træets import — så ES-import-hoisting ikke kan flytte App-evalueringen foran namespace-sætningen. Namespacet må aldrig sættes inline i et entrypoint efter en App-import.

5. **Install-prompt-politik er eksplicit pr. variant.** Kun den variant der reelt er en installerbar PWA (Mineo, `capturePwaInstallPrompt: true`) capturer browserens `beforeinstallprompt`. Alle øvrige tilfælde (standalone, eller uunderstøttet enhed) suppresser prompten. Capture/suppress bruger den **kanoniske** implementering i `src/utils/pwaInstallPrompt.ts` — der må ikke findes en parallel install-prompt-håndtering i shell-laget.

6. **PWA-filåbning registreres før service-worker og React.** Mineos entry leverer `setupPwaFileOpenHandling` til den fælles shell. På en understøttet desktop-enhed kalder shellen den før `beforeDesktopRender` og før app-roden renderes. Callbacken registrerer først launchQueue-consumeren og hydrerer derefter den persisterede pending request. Den persisterede record valideres med `pwaFileOpenRequestSchema`; en ukendt eller fejlet IndexedDB-læsning behandles aldrig som «ingen request». Rækkefølgen bevarer en `.eo`-fil, der blev åbnet lige før en PWA-opdatering, så den nye app-version kan fortsætte samme load-flow efter login. Ankommer en ny launchQueue-fil under hydrering eller sidste durable kontrol, vinder den nye brugerhandling over den ældre persisterede request, og reload frigives først efter en stabil generation/persistence-match. Standalone leverer aldrig callbacken.

7. **Service-worker bevarer hver åbne builds immutable lazy assets.** `vite.mineo.config.ts` emitterer buildets to PWA-artefakter som ét par: `sw.js` med versionen indbagt, og `pwa-assets.json` med samme version og alle buildets hash-navngivne `/assets/*`. Workeren må kun installeres, når hele manifestet er precachet i en cache navngivet med workerens build-version; en mislykket eller ufuldstændig cache afviser installationen. Fetch-interception må KUN besvare præcise, same-origin `/assets/<hash>`-requests fra disse versionscacher og må falde tilbage til netværket ved cache-miss. HTML, SPA-ruter, manifest, service worker, data og vilkårlige assets må aldrig besvares fra cache. Dermed får en åben version fortsat adgang til sin PDF-/Word-writer og øvrige lazy chunks efter en deploy, mens en ny navigation altid henter den aktuelle app-shell og dens beregningslogik.

   Tidligere versionscacher slettes ikke automatisk: når en ny worker aktiveres, kan den også tage kontrol over andre åbne klienter, som stadig kører gammel JavaScript. Hash-navne er indholdsadresserede og immutable, så det er sikkert at svare på netop en gammel hash-request, men ikke på HTML eller ruter. Retention er den bevidste pris for at gøre deployment midt i aktive og natlange sessioner sikker; browseren eller brugeren kan fortsat rydde website-data eksplicit. `scripts/verify-build-artifacts.mjs` skal afvise et Mineo-build uden et gyldigt assetmanifest, uden indbagt worker-version, med asset-stier workeren ikke kan matche, eller hvor worker og manifest bærer hver sin version.

   **Beskyttelsen er stærk, men ikke absolut** (se Kendte Undtagelser 4): rydder browseren Cache Storage under lagerpres, eller fejler første installation offline, kan en gammel chunk stadig 404'e. Med kun den aktuelle build på origin kan det ikke garanteres væk klientside — dér er `vite:preloadError`-linjen sidste værn. Det er et accepteret, sjældent manuelt fallback; automatisk opdatering er fortsat standarden, når klienten kan klargøre den nye version.

   En ny worker kalder ikke selv `skipWaiting()` under installation, og den kalder aldrig `clients.claim()`: aktiveringen sker udelukkende, når klienten beder om den før render (§8). HTML, SPA-ruter, manifest, service worker og assetmanifest skal samtidig have no-cache/no-store headers i `public/_headers`, så browser/host-fallbacks ikke fastholder en gammel app-shell eller et gammelt versionssvar; hashed Vite-assets skal fortsat være immutable.

   Workerens build-version ligger **i dens bytes**, ikke kun i registrerings-URL'ens query. Kilden er `sw/mineoServiceWorker.js` (bevidst uden for `public/`, så publicDir-kopieringen ikke overskriver det emitterede output), og `vite.mineo.config.ts` substituerer versionen ved build. Uden indbagt version ville `registration.update()` aldrig kunne opdage en deploy: query'en er den samme, så længe klienten kører den samme build, og filens bytes ville være identiske på tværs af deploys. `pwa-assets.json` bærer samme version, og workeren **afviser at installere** mod et manifest fra en anden build — ellers kunne en cache navngivet én build blive fyldt med en anden builds assets, og den kørende builds egne lazy chunks aldrig blive cachet.

8. **Ny session = ny version. Åben session = urørt.** Programmet har **ingen** synlig opdaterings-UI og kræver **ingen** brugerhandling for at komme på nyeste version. Én regel styrer det hele:

   > En ny session starter altid på den nyeste version, der kan klargøres **komplet**. En åben session skifter **aldrig** version.

   **Før render** er intet brugerarbejde i fare, og hele opdateringen sker dér — som en barriere, ikke et væddeløb mod uret. `ensureLatestVersionBeforeRender` sammenligner `pwa-assets.json`'s `version` med dokumentets `VERSION`. Er de ens (langt det almindeligste), ventes der **slet ikke**. Er de forskellige, føres den nye build hele vejen frem, i denne rækkefølge: komplet precache (`installed`) → aktivering af præcis den worker (`SKIP_WAITING`) → **bekræftet `activated`** → genindlæsning.

   Rækkefølgen er ufravigelig. `installed` alene er **ikke** en tilstrækkelig barriere: en installeret worker står i `waiting`, og et dokument beholder sin controller hele sin levetid. Genindlæstes der dér, ville den nye HTML køre under den **gamle** worker, det nye dokument ville se «samme version» og returnere med det samme — og den nye worker kunne blive stående ventende i det uendelige.

   **Efter render sker der intet.** Der er hverken periodiske tjek, `visibilitychange`-tjek, opdateringslinje eller nogen vej til at aktivere en ny worker. En åben sag kan derfor aldrig blive afbrudt af en deploy. Prisen — at en bruger kan sidde på en ældre version, indtil programmet startes igen — er **valgt**: en sag, der er åben i dagevis, må ikke skifte beregningskode under hænderne på brugeren.

   **Fail-safe, ikke fail-fast.** Kan den nye version ikke klargøres komplet — offline, uopløseligt manifest, mislykket precache (`redundant`), manglende aktivering, eller et loft på ventetiden — startes den **nuværende** version uændret, uden reload og uden besked. En halv opdatering er værre end en hel, lidt ældre version.

   **Løkkeværnet** er en manifest-ejet sessionnøgle, der holder **alle mål forsøgt fra denne kildeversion** (`kilde|mål|mål…`) — ikke blot «sidst sete version». En markør med kun ét mål ville blive overskrevet ved en flappende, delvis udrullet origin (V1 ser V2 → reload → stadig V1, ser V3 → reload → ser V2 igen …), så hvert svar så nyt ud og programmet reloadede i ring. Med hele forsøgsmængden forsøges hvert spring præcis én gang. Kan markøren ikke skrives, genindlæses der **ikke**.

   **`clients.claim()` er forbudt; `SKIP_WAITING` er nødvendig.** De to trækker hver sin vej og skal begge være, som de er: uden `SKIP_WAITING` aktiverer en ventende worker først, når den gamle kontrollerer **nul** klienter — og en genindlæsning når aldrig nul, fordi det gamle dokument lever, indtil svarets headere er modtaget. En installeret PWA, brugeren sjældent lukker helt, ville da i praksis aldrig opdatere. Omvendt ville `clients.claim()` lade en nyaktiveret worker overtage et **andet** fanebladss levende sag. Beskeden sendes derfor kun før render, hvor der ikke findes brugerarbejde.

   Før `SKIP_WAITING` spørger bootstrap den konkrete installerede worker om dens indbagte build-version. Den må
   matche manifestets version, der udløste opdateringen; ellers aktiveres workeren ikke. Det lukker race-vinduet
   ved delvise deploys, hvor HTML, assetmanifest og en allerede ventende worker kan komme fra forskellige origin-
   noder. Manglende eller tidsudløbet versionssvar er fail-safe.

   **En `.eo`-request må aldrig gå tabt i en opdatering.** Browseren kan aflevere en fil gennem `launchQueue`, mens opstartens barriere kører; requesten lever da kun i hukommelsen, indtil IndexedDB-skrivningen er færdig. Før enhver genindlæsning afventer opstarten derfor `awaitDurablePendingPwaFileOpenHandoff()`, og kan den durable handoff **ikke** bekræftes — herunder fordi storage ikke svarer inden for loftet — genindlæses der ikke; opdateringen sker i stedet ved næste opstart. Brugerens fil vejer tungere end at komme på nyeste version med det samme.

   Registreringen springes **ikke** over på nogen rute, heller ikke `/open`. En session startet ved dobbeltklik på en `.eo`-fil skal have sin egen versionscache; ellers kan netop den langlivede fil-session (manifestets `launch_handler: "focus-existing"` tilskynder dem) miste sine PDF-/Word-chunks ved næste deploy.

   **Ingen bfcache-genindlæsning.** En gendannelse fra browserens back/forward-cache er **ikke** en ny session: brugeren vender tilbage til sit eget, igangværende arbejde. En `pageshow`-lytter, der genindlæste ved `event.persisted`, ville kunne skifte build midt i en sag og kaste en åben editors draft væk uden om `CriticalActionCoordinator`.

   **Bevidst forkastet: én model for browser, en anden for PWA.** Idéen — lad browserfanen altid køre nyeste version, og lad kun den installerede PWA vente til næste opstart — blev vurderet og afvist (brugerbeslutning 2026-08-12). Tre grunde: (1) `display-mode: standalone` fortæller, hvordan vinduet blev *åbnet*, ikke om der er arbejde i gang; et browserfaneblad kan sagtens rumme en timegammel, halvfærdig erstatningsopgørelse, så en datasikkerhedsregel hængt på et *visnings*-signal er kun rigtig ved et tilfælde. (2) «Altid nyeste» i browseren betyder enten intet eller et tvunget reload midt i brugerens arbejde — altså opdateringslinjen ad bagdøren for én launch-mode. (3) To modeller fordobler edge-case-matricen for en sondring, der ikke følger det, invariantet beskytter. Det, idéen var ude efter, leverer no-store-HTML'en allerede: enhver ny fane, navigation eller genindlæsning henter nyeste HTML, så «åbne et faneblad» *er* en ny session. Grænsen er **sessionsstart**, ikke **launch-mode**.

   Vites `vite:preloadError` er alene sidste sikkerhedsnet for fejl, der ikke burde være mulige efter en komplet versionscache. Det må aldrig kalde `location.reload()` selv. Signalet undertrykkes, og `LazyChunkRecoveryNotice` tilbyder en brugerudløst reload gennem `CriticalActionCoordinator`; dermed bliver også en åben draft enten afsluttet eller eksplicit blokeret før navigation. Linjen er **ikke** en opdateringslinje — den dækker kun manglende chunks (se Kendte Undtagelser 4). Vite-recovery installeres centralt af `bootstrapClientApp` før enhver dynamisk style-, route-, renderer- eller writer-import.

9. **Top-level fejl fanges pr. variant.** Hver app-variant skal have en top-level error boundary mellem shell-render og hele variantroden. Mineo bruger `src/components/errors/ErrorBoundary` (med diagnose-rapportering via `systemIssueReporter`). Standalone bruger `StandaloneErrorBoundary` (bevidst **uden** diagnose-rapportering, jf. regel 3's isolationskrav — se Kendte Undtagelser). Boundarien skal ligge over providers, router og layout. Fejl før React-render (style-/bootstrap-fejl) fanges separat af shellen og giver en deterministisk dansk hard-stop frem for en blank side.

10. **Styles og build-output er variant-ejede.** Shellens fontindlæsning er fælles, mens hver entry leverer sin egen style-entry. Fælles designregler kan deles, men Mineos `body/#root`-shell må ikke indlæses i standalone. Mineo bygges fra repoets ene `index.html`; theme-bootstrap injiceres fra den kanoniske generator i `src/settings/themeBootstrap.ts`. Hvert build afsluttes med `verify-build-artifacts.mjs`, der kontrollerer entry, manifest og variantfiler, før output kan godkendes.

11. **Programfladen har ÉN skala.** `useContentUiScale` og den synkrone theme-bootstrap bruger samme
    serialiserbare policy fra `src/utils/uiScale.ts` og sætter kun `--mineo-content-scale` på
    `document.documentElement`. Alt, brugeren ser, følger den skala — arbejdsflade, sidemenu og
    popup-lag. Der findes ikke to konkurrerende tekststørrelser i samme billede.

    **Zoom-roden er `<main data-mineo-content-scale-root="true">`** i Mineos `Container`;
    `MainLayout`, `#root`, `html` og `body` må ikke zoome. Sidemenuen og popup-laget zoomer
    hver for sig (se nedenfor), fordi de ikke er efterkommere af roden.

    **Sidemenuen.** Menuen zoomer med `min(arbejdsfladens skala, menuens egen højdetilpasning)`.
    Højdetilpasningen (bund 0,78) skrumper menuen, når dens naturlige højde ellers ikke kan være i
    vinduet. Menuen må derfor gerne være **mindre** end arbejdsfladen (lavt vindue), men aldrig
    **større**: en menu med 14 px labels ved siden af en brødtekst på 10,5 px er den mest
    iøjnefaldende typografiske uensartethed, fladen kan have. Rammen skaleres proportionalt med sit
    indhold — 250 px × skala udfoldet, 70 px × skala sammenfoldet, og skillelinjen 1 px × skala — så
    menuens indbyrdes forhold (labelstørrelse, ikonakse, luft) er konstante ved enhver skala.
    `getSideMenuIconLayout()` er derfor skala-uafhængig og regner i menuens egne px.

    **Popup-laget følger arbejdsfladens skala gennem CSS-variablen, ikke gennem zoom-roden.**
    Reglen ligger ét sted pr. flade, og valget af *hvilket* element der zoomer er ikke frit:

    | Flade | Zoom sættes på | Hvorfor netop dér |
    |---|---|---|
    | Tooltip | `.MuiTooltip-tooltip` (tema) | Popper-roden bærer positionerings-`transform`, som zoom ville gange med |
    | Dialog | `.MuiDialog-paper` (tema) | Papiret centreres af flexbox uden egne offsets; backdroppen er søskende og dækker fortsat hele vinduet |
    | `StyledDropdown`-liste | `MenuList` | Popover-papiret bærer MUI's inline `left`/`top`-forankring; papiret måler listens zoomede størrelse |
    | Toast (`Overlay`), `DevtoolsIssueNotice`, `ScrollToTopButton` | elementet selv | `position: fixed` — zoom skalerer også afstanden til hjørnet, som ønsket |

    Sidemenuens tre tooltips overstyrer `--mineo-content-scale` på deres popper, fordi de hører til
    menuens skala. Håndrullede vinduer (`LicenseModal`, `LoentrinFinderOverlay`) ligger **inde i**
    zoom-roden og skalerer af sig selv; deres `vh`-lofter divideres med skalaen
    (`calc(80vh / var(--mineo-content-scale, 1))`), fordi `vh` ellers opløses mod det uskalerede
    vindue og derefter selv bliver skaleret — vinduet ville da kun kunne bruge 60 % af skærmhøjden i
    stedet for de 80 %, tallet lover.

    **Gutter og indrykning.** De fire `Container`-gutters er ens hele vejen rundt
    (`calc(24px * var(--mineo-content-scale, 1))`); de ligger uden for zoom-roden og ganges derfor
    med skalaen i CSS. Den lodrette luft er med i regnestykket: en fast luft foroven ville stå
    dobbelt så høj som luften i siderne ved mindste skala, og Kontroltabellens klæbende tabelhoved
    kompenserer for præcis denne værdi inde fra zoom-roden — kompensationen kan kun ramme, når de to
    følger samme skala. Den indre `<main>`-indrykning er 50 px **uskaleret**, fordi `main` selv ER
    zoom-roden. Skaleringen må ikke indføre reflow, skjule indhold eller ændre
    input-/persistence-state ved resize.

    **Pladsregnskabet er ét skaleret led** og udledes i `CONTENT_UI_SCALE_POLICY` af de navngivne
    layoutmål — ikke af hardkodede summer: `scaledShellWidthPx` = sidemenu 250 + venstre gutter 24 +
    indrykning 50 + indholdsboks 1200 + højre gutter 24, plus `scrollbarReservePx` (20).
    Indholdsboksens bredde er den bredeste geometri på hver eneste side og fane; TS-konstanten
    `CONTENT_BOX_WIDTH_PX` spejler `--content-box-max-width` i `src/styles/layout.css` og er
    testhåndhævet. Menubredden er værste tilfælde: en sammenfoldet eller højdeskaleret menu giver kun
    ekstra luft.

    **Kontrolfanernes udhæng er den ene bevidste undtagelse fra pladsregnskabet.**
    Erstatningsopgørelses to kontrolfaner (`SideTab`) roteres 90° og rager deres egen højde — 48 px,
    `SIDE_TAB_OVERHANG_PX` — ud til højre for deres `left`, som ER indholdsboksens kant. De 48 px
    indgår **ikke** i `scaledShellWidthPx`, og det er et valg, ikke en forglemmelse: fanerne er en
    valgfri kontrolflade (Indstillinger → «Vis kontrolfaner»), og hele arbejdsfladen må ikke skaleres
    ned for at gøre plads til dem. Konsekvensen er accepteret: er der plads i højregutteren, står
    fanerne der; er der ikke, går de **tavst** ud over arbejdsfladens synlige højrekant og bliver
    klippet væk. En delvist synlig eller helt skjult kontrolfane er det rigtige svar — en mindre
    brødtekst på hele fladen er det ikke.

    Klipningen er ikke overladt til held. `SideTabRail` er skinnen, fanerne hænger i: den måler
    arbejdsfladens synlige højrekant (scrollportens `clientWidth`, uden den lodrette scrollbar) og
    klipper vandret dér med `overflow-x: clip` — `overflow-y: visible`, fordi den roterede fane rager
    nedad og ikke må skæres over på tværs. Uden klipningen ville udhænget give `Container` vandret
    rul, for en absolut placeret efterkommer tæller med i scrollportens scrollområde, også når den er
    roteret. Bredden **måles** frem for at regnes ud, fordi kanten afhænger af sidemenuens aktuelle
    bredde, gutteren, skalaen og browserens faktiske scrollbarbredde på én gang; et gæt for højt er
    netop den scrollbar, skinnen skal forhindre. Skinnen er aldrig smallere end indholdsboksen, så
    under den dækkede minimumsbredde — hvor indholdet selv overflyder og den vandrette
    `Container`-scroll er fallbacken — lægger fanerne ikke en eneste pixel oveni.

    **Kontrolfanerne bærer de vandrette faners typografi.** Begge fanefamilier henter hele deres
    signatur fra den fælles `.tab-item`-regel i `src/styles/typography.css` — skrift, farve (også i
    mørkt tema), vægt, spatiering og hover/aktiv-tilstand — og den blå streg er `.side-tab::after`:
    samme 2 px malede kasse som `MuiTabs-indicator`, placeret på fanens bund, som efter rotationen
    vender ind mod indholdsboksen. `SideTab`s `sx` må derfor kun bære geometri; en typografi- eller
    `border`-værdi dér vinder over klassen og lader familierne drifte fra hinanden igen.

    Den dækkede smalle grænse er en **CSS-viewport** på mindst 1181×620 px ved 100 % browserzoom,
    ikke en fysisk skærmopløsning: en 1920×1200-skærm ved 150 % zoom giver 1280 CSS-px og er
    dermed dækket. Grænsen faldt fra 1244 til 1181, da sidemenuen kom med i det skalerede regnskab:
    en menu, der skrumper med fladen, behøver ikke fuld bredde reserveret.
    Under 1181 CSS-px fastholdes minimumsskalaen, og arbejdsfladen skal være nåbar med den
    eksisterende vandrette `Container`-scroll frem for mindre tekst, skjult indhold eller
    responsivt reflow.

    Skalaen er ren runtime-afledning fra `window.innerWidth`, aldrig brugerdata eller en indstilling;
    højden indgår ikke (kun menuens egen højdetilpasning kender vinduets højde).
    Den er den største skala, hele fladen kan være i — kvantiseret nedad
    til hele hundrededele og klemt mellem `1` og `0.75`. Udledningen er **historieløs**: samme
    vinduesbredde giver altid samme skala, uanset om vinduet kom dertil ved at vokse eller skrumpe.
    Der er bevidst ingen hysterese, fordi skalaen ikke kan påvirke `window.innerWidth` og derfor
    ikke kan svinge; kvantiseringen alene holder skiftene rolige og små. De konkrete grænser ligger
    ét sted i `CONTENT_UI_SCALE_POLICY`, som både bootstrap og runtime læser. `zoom` er valgt frem
    for `transform: scale`, fordi transform ændrer containing block for fixed-børn og efterlader
    layoutet i fuld størrelse.

    `measureContentUiScaleRoot` måler kun den faktiske browsergeometri på skaleringsroden og giver
    neutral skala ved jsdom eller ugyldig geometri. Virtualiseret ancestor-scroll må normalisere
    egne rect-afstande gennem denne helper; global scrolllogik må ikke specialbehandles uden en
    konkret browserregressionstest. Capture af en indholdsboks må, hvis browserverifikation viser
    en afvigelse, neutralisere netop denne skaleringsrod lokalt og gendanne den i `finally`.

    **Sidemenuen bevarer sin luftige desktopprofil og har aldrig intern scroll.** Knapper, grupper og
    separatorer har deres oprindelige indbyrdes afstande ved enhver skala. Hamburgeren og alle
    kollapsede menuikoner deler kvadratisk hoverflade og vandret midtpunkt; hvert ikon har samme
    vandrette anker i sammenfoldet og udfoldet tilstand. Hamburgeren står lodret midt mellem sidens
    top og den første separator og er altid synlig. Menuens egen højdetilpasning træder først i
    kraft, når den naturlige højde ellers ikke kan være i vinduet. Ved den dækkede højde på 620
    CSS-px skal alle punkter være synlige og nåbare uden intern menuscroll. Under denne højde
    fastholdes bunden 0,78, og eventuelt indhold fortsætter tavst uden for det synlige vindue frem
    for at komprimeres yderligere eller få en scrollbar.

    `StyledDropdown`-listen bevarer Popover'ens ankerposition og har altid en viewport-sikker
    maksimal højde; den scroller kun internt i popup'en, hvis dens valgmængde er længere.

## 3. Autoritative Kilder

- Device-gate-tærskel og -logik: `src/apps/shared/bootstrapClientApp.tsx` (eneste sandhed).
- Device-capability-aflæsning og orienteringsstabil touch-klassifikation: `src/utils/clientDevice.ts` (delt, render-agnostisk browserdata).
- Storage-namespace-resolution: `src/config/storageManifest.ts` (dovne getters; namespace sat ved bootstrap).
- Install-prompt capture/suppress: `src/utils/pwaInstallPrompt.ts` (kanonisk).
- PWA-display-mode: `src/utils/pwaDisplayMode.ts` (kanonisk fælles aflæsning af standalone-vinduet).
- PWA-filåbnings- og versionsskiftehåndtering: `src/utils/pwaLaunchQueue.ts`.
- Service-worker-adfærd: `sw/mineoServiceWorker.js` (worker) + `src/apps/mineo/serviceWorkerBootstrap.ts` (versionssignal, klient-lifecycle/reload-gate).
- PWA-cachepolitik: `public/_headers`.
- Skala-policy og sidemenuens layoutmål: `src/utils/uiScale.ts` (eneste sandhed; læses af både bootstrap og runtime).
- Popup-lagets skala: `src/config/appTheme.ts` (`MuiTooltip`/`MuiDialog`) — ét sted for hele programmet.

## 4. Testkobling

- `src/__tests__/quality/minprocesrenteStandaloneIsolation.test.ts` (storage-namespace sat via bivirknings-import før App-import). **Bemærk:** selve importforbuddet i §2.3 testes IKKE længere her — det er flyttet til AST-reglen nedenfor, og filen siger det selv.
- `src/__tests__/quality/architecture/rules/documentRules.ts` (`layer/minprocesrente-standalone-import-boundary`: den strukturelle håndhævelse af §2.3's krydsimport-forbud).
- `src/__tests__/apps/shared/bootstrapClientApp.test.tsx` (device-gate hård stop som default; standalone kan fravælge gaten).
- `src/__tests__/apps/shared/vitePreloadRecovery.test.ts` (Vite-signal er kun sidste sikkerhedsnet og må ikke genindlæse en aktiv sag uvarslet).
- `src/__tests__/main.pwaLaunchQueue.test.ts` (Mineo-entryen leverer consumer-registrering og rehydrering til shellen i rækkefølge).
- `src/__tests__/utils/pwaLaunchQueue.test.ts` (pending request overlever versionsskift; ny launch vinder over gammel persisted request; schema-validering, utilgængelig IndexedDB og ustabil handoff stopper ikke-sikkert reload).
- `src/__tests__/apps/mineo/serviceWorkerBootstrap.test.ts` (uændret version renderer straks uden ventetid; ny version genindlæses først efter komplet precache, matchende indbygget worker-version og bekræftet `activated`; installeret-men-aldrig-aktiv reloader ikke; `redundant`, timeout, offline, uskrivbar markør og fejlet registrering reloader ikke; flappende origin går i ro i stedet for at reloade i ring; ubekræftet `.eo`-handoff reloader ikke; ingen opdateringslinje-API eksporteres).
- `src/__tests__/apps/mineo/serviceWorkerProtocol.test.ts` (workeren kræver en komplet versionscache, navngiver den efter den indbagte version, afviser et manifest fra en anden build, serverer kun immutable hashed assets, springer ikke selv ventetiden over og overtager aldrig eksisterende klienter).
- `src/__tests__/components/system/LazyChunkRecoveryNotice.test.tsx` (lazy-recoverylinjen bruger reload-barrieren og viser ingen opdateringstekst).
- `e2e/pwa-file-open.spec.ts` (launchQueue-consumer registreres i den fulde loginrejse i Chrome, Edge, Firefox og WebKit).
- `e2e/pwa-service-worker.spec.ts` (ægte Chromium-service-workerforløb beviser waiting → active; bfcache-proben hævder kun resultatet, når browseren faktisk leverer en bfcache-gendannelse).
- `e2e/pwa-already-installed.spec.ts` (den leverede manifestkontrakt indeholder `launch_handler: "focus-existing"`; selve OS-fokus kan ikke fremkaldes i Playwright).
- `src/__tests__/quality/pwaHeaders.test.ts` (HTML, SPA-ruter, manifest og service worker revalideres; hashed assets er immutable).
- `src/__tests__/settings/indexThemeBootstrap.test.ts` (kanonisk theme-bootstrap og systemfallback ved manglende, ugyldig eller ulæselig settings-storage).
- `scripts/verify-build-artifacts.mjs` (postbuild-værn for entries, manifest og variantfiler).
- `src/__tests__/quality/architecture/rules/responsiveStylingRules.ts` (`shell/viewport-responsive-styling-allowlist`: pinner fillisten i §5.3, så desktop-only-undtagelsen ikke kan brede sig stiltiende).
- `src/__tests__/utils/uiScale.test.ts` (policygrænser, hysterese, menuens skala som minimum af de to, ikonaksen, bootstrap/runtime-paritet og DOM-måling).
- `e2e/minimum-viewport-shell.spec.ts` og `e2e/content-scale.spec.ts` (menuens minimumsgeometri og loft mod arbejdsfladens skala, ens gutter hele vejen rundt, popup-lagets skala, kontrolfanernes udhæng uden for indholdsboksen uden vandret rul, deres signatur mod de vandrette faners i begge temaer, den ubeskårne arbejdsflade ved 1280 CSS-px og resize-state).
- `src/__tests__/components/layout/SideTabRail.test.tsx` (skinnens klipning: vandret alene, målt kant, upåvirket af vandret rul, aldrig smallere end indholdsboksen).
- `src/__tests__/quality/contentBoxWidthSingleSource.test.ts` (indholdsboksens bredde i CSS og skaleringens pladsregnskab i TypeScript kan ikke falde ud af sync).

## 5. Kendte Undtagelser

1. **Standalone har ingen diagnose-rapportering.** `StandaloneErrorBoundary` rapporterer ikke til `systemIssueReporter` (kun `console.error`). Det er en **bevidst** konsekvens af isolationskravet (regel 3): standalone-laget må ikke importere Mineos diagnoseflow. Risiko: standalone-fejl er ikke synlige i Mineos diagnostik. Re-evaluering hvis standalone-beregneren får et selvstændigt, isoleret diagnose-behov.

2. **`enforceUnsupportedDeviceGate: false` for standalone.** Bevidst fravalg, fordi procesrenteberegneren skal kunne bruges på mobil/tablet (med egen mobil-scroll-håndtering). Re-evaluering hvis standalone en dag skal være desktop-only.

3. **Viewport-responsiv styling på begge akser er tilladt i en pinnet filliste — inkl. to filer delt med Mineo.** `AGENTS.md` ("Desktop-only gate") begrænser mobil/tablet-styling, fordi Mineo er desktop-only. Standalone MinProcesrente er en bevidst mobil-tilladt variant (jf. undtagelse 2), og undtagelsen dækker derfor:

   | Fil | Begrundelse |
   |---|---|
   | `src/apps/minprocesrente/minprocesrente.css` | Standalone-lokal; kun importeret af standalone-buildet. |
   | `src/components/pages/minprocesrente/MinProcesrenteCalculatorPage.tsx` | Standalone-lokal (sx). |
   | `src/components/layout/StandaloneCalculatorLayout.tsx` | Standalone-lokal; kun renderet af `MinProcesrenteApp`. |
   | `src/components/layout/SiblingSitesFooter.tsx` | **Delt** (Mineos `/mineo`-side + standalone). Breakpointet betjener standalone-mobilbrugeren; på desktop tænder det aldrig. |
   | `src/components/pages/renteberegning/RenteberegningTab.tsx` | **Delt** (`Renteberegning` + standalone). Den ene breakpointregel er `overflowX: { xs: 'hidden', sm: 'auto' }`; fanens øvrige mobiladfærd kører på en eksplicit `isMobile`-prop, ikke på breakpoints. |
   | `src/components/ui/ScrollToTopButton.tsx` | Mineo-lokal, men bevidst: device-gaten kræver **touch-lighed**, så et smalt ikke-touch desktopvindue slipper igennem. Reglen flytter kun knappen tættere på hjørnet. |

   Den tidligere formulering ("variant-lokal — ikke delt/global") var **ikke længere korrekt**: to af filerne er delt med Mineo. Præmissen er korrigeret frem for at splitte fladerne i to kopier, fordi breakpointsene aldrig tænder på Mineos desktop-flade.

   **Input-modalitet er ikke omfattet.** `@media (pointer: coarse)` og `@media (hover: hover|none)` er affordances efter inputenhed — de rammer touch-capable desktops, som gaten bevidst slipper igennem — og er derfor tilladt overalt.

   Fillisten er **håndhævet**, ikke kun beskrevet: `shell/viewport-responsive-styling-allowlist` i arkitektur-harnesset (`src/__tests__/quality/architecture/rules/responsiveStylingRules.ts`) gør en ny viewport-responsiv fil rød, og harnessets anti-rot-kontrol fjerner en post, der ikke længere udløser reglen. `.css`-filer ligger uden for kilde-grafen og er derfor kun auditeret her. Risiko: ingen for Mineo. Re-evaluering hvis standalone gøres desktop-only.

4. **Deploybeskyttelsen er stærk, men ikke absolut.** Versionscachen dækker det almindelige forløb: en åben build beholder sine egne hash-navngivne lazy chunks, også efter at origin kun har den nyeste build. To forhold ligger uden for klientens kontrol:

   | Forhold | Konsekvens |
   |---|---|
   | Browseren rydder Cache Storage under lagerpres (eviction) | Et gammelt vindues chunks kan forsvinde, og `fetch`-fallbacket rammer et 404. Retention af tidligere build-caches øger selv kvotetrykket — det er en bevidst afvejning mod at gøre deploy midt i lange sessioner sikkert. |
   | Første installation sker offline eller fejler | Der oprettes ingen versionscache for den build, og senere lazy imports må gå til netværket. |

   I begge tilfælde overtager `vite:preloadError`-linjen, som gør fejlen synlig og tilbyder en input-sikret genindlæsning frem for en runtime-fejl. Det er præcis den situation, hvor linjen ER bydende nødvendig. Re-evaluering ville kræve, at origin beholdt tidligere builds assets — en deploy-beslutning, ikke en klientside-beslutning.
