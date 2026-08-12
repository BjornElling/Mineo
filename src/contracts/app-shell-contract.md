# App-shell & multi-app — Mineo

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Selvstændig tværgående kontrakt for det øverste runtime-lag (app-entry, bootstrap, multi-app-isolation). Ligger *over* sidekomponent-laget: `page-component-contract.md §3.1` er underordnet denne kontrakt for alt der angår app-entry, device-gate-placering og shell-ansvar. Berører ikke beregnings-, form- eller persistence-*indhold* og overlapper derfor ikke de øvrige tværgående kontrakter — men den ejer den *namespace-isolation*, der holder to app-varianters persistence adskilt (jf. `persistence-contract.md`).
**Senest verificeret mod kode:** 2026-08-12

## 1. Scope

Det øverste runtime-lag, der binder programmet sammen, og isolationen mellem de to app-varianter:

- App-entries: `src/main.tsx` (Mineo) og `src/apps/minprocesrente/minprocesrenteMain.tsx` (standalone MinProcesrente).
- Delt app-shell: `src/apps/shared/bootstrapClientApp.tsx` (device-gate, render-beslutning, install-prompt-politik og installation af den fælles Vite-recovery).
- Vite lazy-load-recovery: `src/apps/shared/vitePreloadRecovery.ts` (sidste sikkerhedsnet for et manglende lazy asset; den normale deploybeskyttelse ligger i service-workerens versionscache).
- Delt device-aflæsning: `src/utils/clientDevice.ts` (rene browser-/skærmcapabilities og orienteringsstabile touch-klassifikationer, uden app-shell-render-beslutninger).
- Mineo-specifik opstart: `src/apps/mineo/serviceWorkerBootstrap.ts` (service-worker-registrering, opdateringsstatus og brugerbekræftet reload).
- Genindlæsningslinje: `src/components/system/ApplicationReloadNotice.tsx` (synlig opdaterings-/lazy-recoverytilstand og sikker genindlæsning).
- PWA-filåbning: `src/utils/pwaLaunchQueue.ts` (launchQueue-consumer og versionssikker pending request).
- PWA-cachepolitik: `public/_headers` (revalidering af HTML, SPA-ruter, manifest og service worker; immutable hashed assets).
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

6. **PWA-filåbning registreres før service-worker og React.** Mineos entry leverer `setupPwaFileOpenHandling` til den fælles shell. På en understøttet desktop-enhed kalder shellen den før `beforeDesktopRender` og før app-roden renderes. Callbacken registrerer først launchQueue-consumeren og hydrerer derefter den persisterede pending request. Rækkefølgen bevarer en `.eo`-fil, der blev åbnet lige før en PWA-opdatering, så den nye app-version kan fortsætte samme load-flow efter login. Ankommer en ny launchQueue-fil under hydrering, vinder den nye brugerhandling over den ældre persisterede request. Standalone leverer aldrig callbacken.

7. **Service-worker bevarer hver åbne builds immutable lazy assets.** `vite.mineo.config.ts` emitterer det genererede PWA-assetmanifest med alle buildets hash-navngivne `/assets/*`. `public/sw.js` må kun installeres, når hele manifestet er precachet i en cache navngivet med workerens build-version; en mislykket eller ufuldstændig cache afviser installationen. Fetch-interception må KUN besvare præcise, same-origin `/assets/<hash>`-requests fra disse versionscacher og må falde tilbage til netværket ved cache-miss. HTML, SPA-ruter, manifest, service worker, data og vilkårlige assets må aldrig besvares fra cache. Dermed får en åben version fortsat adgang til sin PDF-/Word-writer og øvrige lazy chunks efter en deploy, mens en ny navigation altid henter den aktuelle app-shell og dens beregningslogik.

   Tidligere versionscacher slettes ikke automatisk: når en ny worker aktiveres, kan den også tage kontrol over andre åbne klienter, som stadig kører gammel JavaScript. Hash-navne er indholdsadresserede og immutable, så det er sikkert at svare på netop en gammel hash-request, men ikke på HTML eller ruter. Retention er den bevidste pris for at gøre deployment midt i aktive og natlange sessioner sikker; browseren eller brugeren kan fortsat rydde website-data eksplicit. `scripts/verify-build-artifacts.mjs` skal afvise et Mineo-build uden et gyldigt assetmanifest.

   En ny worker kalder heller ikke `skipWaiting()` under installation: første installation aktiveres af klienten før React-render, mens en senere worker forbliver ventende. HTML, SPA-ruter, manifest og service worker skal samtidig have no-cache/no-store headers i `public/_headers`, så browser/host-fallbacks ikke fastholder en gammel app-shell; hashed Vite-assets skal fortsat være immutable.

   En ventende service-worker-opdatering aktiveres **aldrig automatisk** — heller ikke ved timer-, online- eller synlighedstjek. Shellen viser i stedet den vedvarende linje “En ny version er klar” med handlingen “Genindlæs nu”. Ved brugerens aktivering afslutter `CriticalActionCoordinator` først en åben editor efter reload-policyen; lykkes det, beder klienten den ventende worker om aktivering og genindlæser først på den efterfølgende `controllerchange`. Fejler afslutningen teknisk, fokuseres feltet, og brugeren bliver på den aktuelle version. En `controllerchange`, som ikke stammer fra denne udtrykkelige brugerhandling — herunder første installs `clients.claim()` — må aldrig reloade.

   Vites `vite:preloadError` er alene sidste sikkerhedsnet for fejl, der ikke burde være mulige efter en komplet versionscache. Det må aldrig kalde `location.reload()` selv. Signalet undertrykkes, og `ApplicationReloadNotice` tilbyder den samme brugerudløste reload gennem `CriticalActionCoordinator`; dermed bliver også en åben draft enten afsluttet eller eksplicit blokeret før navigation.

   Klientsiden må desuden genindlæse ved Vites dokumenterede `vite:preloadError`-signal for et lazy-loadet asset, som den åbne app-version ikke længere kan hente efter en deploy. Vite-recoveryen er den akutte, begrænsede fallback; den almindelige opdateringsvej er altid den brugerbekræftede service-worker-aktivering ovenfor.

   Vite-recovery installeres centralt af `bootstrapClientApp` før enhver dynamisk style-, route-, renderer- eller writer-import. Den gemmer den fejlede asset-signatur i en manifest-ejet, device-scoped sessionnøgle før reload. Genopstår samme fejl efter reload, må den ikke genindlæse igen; den almindelige fejlhåndtering skal overtage. Kan markøren ikke skrives, må der heller ikke reloades. Dermed er der ingen reload-løkke ved netværks- eller storagefejl, mens en ny hash-signatur fra en senere deploy fortsat får ét recovery-forsøg.

8. **Top-level fejl fanges pr. variant.** Hver app-variant skal have en top-level error boundary mellem shell-render og hele variantroden. Mineo bruger `src/components/errors/ErrorBoundary` (med diagnose-rapportering via `systemIssueReporter`). Standalone bruger `StandaloneErrorBoundary` (bevidst **uden** diagnose-rapportering, jf. regel 3's isolationskrav — se Kendte Undtagelser). Boundarien skal ligge over providers, router og layout. Fejl før React-render (style-/bootstrap-fejl) fanges separat af shellen og giver en deterministisk dansk hard-stop frem for en blank side.

9. **Styles og build-output er variant-ejede.** Shellens fontindlæsning er fælles, mens hver entry leverer sin egen style-entry. Fælles designregler kan deles, men Mineos `body/#root`-shell må ikke indlæses i standalone. Mineo bygges fra repoets ene `index.html`; theme-bootstrap injiceres fra den kanoniske generator i `src/settings/themeBootstrap.ts`. Hvert build afsluttes med `verify-build-artifacts.mjs`, der kontrollerer entry, manifest og variantfiler, før output kan godkendes.

## 3. Autoritative Kilder

- Device-gate-tærskel og -logik: `src/apps/shared/bootstrapClientApp.tsx` (eneste sandhed).
- Device-capability-aflæsning og orienteringsstabil touch-klassifikation: `src/utils/clientDevice.ts` (delt, render-agnostisk browserdata).
- Storage-namespace-resolution: `src/config/storageManifest.ts` (dovne getters; namespace sat ved bootstrap).
- Install-prompt capture/suppress: `src/utils/pwaInstallPrompt.ts` (kanonisk).
- PWA-filåbnings- og versionsskiftehåndtering: `src/utils/pwaLaunchQueue.ts`.
- Service-worker-adfærd: `public/sw.js` (worker) + `src/apps/mineo/serviceWorkerBootstrap.ts` (klient-lifecycle/reload-gate).
- PWA-cachepolitik: `public/_headers`.

## 4. Testkobling

- `src/__tests__/quality/minprocesrenteStandaloneIsolation.test.ts` (storage-namespace sat via bivirknings-import før App-import). **Bemærk:** selve importforbuddet i §2.3 testes IKKE længere her — det er flyttet til AST-reglen nedenfor, og filen siger det selv.
- `src/__tests__/quality/architecture/rules/documentRules.ts` (`layer/minprocesrente-standalone-import-boundary`: den strukturelle håndhævelse af §2.3's krydsimport-forbud).
- `src/__tests__/apps/shared/bootstrapClientApp.test.tsx` (device-gate hård stop som default; standalone kan fravælge gaten).
- `src/__tests__/apps/shared/vitePreloadRecovery.test.ts` (Vite-signal er kun sidste sikkerhedsnet og må ikke genindlæse en aktiv sag uvarslet).
- `src/__tests__/main.pwaLaunchQueue.test.ts` (Mineo-entryen leverer consumer-registrering og rehydrering til shellen i rækkefølge).
- `src/__tests__/utils/pwaLaunchQueue.test.ts` (pending request overlever versionsskift; ny launch vinder over gammel persisted request; utilgængelig IndexedDB stopper ikke opstarten).
- `src/__tests__/apps/mineo/serviceWorkerBootstrap.test.ts` (ventende opdatering annonceres uden automatisk reload; brugeraccept aktiverer worker og reloader én gang på `controllerchange`; ingen registrering uden for produktion eller på `/open`).
- `src/__tests__/apps/mineo/serviceWorkerProtocol.test.ts` (workeren kræver en komplet versionscache, serverer kun immutable hashed assets og springer ikke selv ventetiden over).
- `src/__tests__/components/system/ApplicationReloadNotice.test.tsx` (genindlæsningslinjen bruger reload-barrieren for både opdatering og lazy-recovery).
- `e2e/pwa-file-open.spec.ts` (launchQueue-consumer registreres i den fulde loginrejse i Chrome, Edge, Firefox og WebKit).
- `src/__tests__/quality/pwaHeaders.test.ts` (HTML, SPA-ruter, manifest og service worker revalideres; hashed assets er immutable).
- `src/__tests__/settings/indexThemeBootstrap.test.ts` (kanonisk theme-bootstrap og systemfallback ved manglende, ugyldig eller ulæselig settings-storage).
- `scripts/verify-build-artifacts.mjs` (postbuild-værn for entries, manifest og variantfiler).
- `src/__tests__/quality/architecture/rules/responsiveStylingRules.ts` (`shell/viewport-responsive-styling-allowlist`: pinner fillisten i §5.3, så desktop-only-undtagelsen ikke kan brede sig stiltiende).

## 5. Kendte Undtagelser

1. **Standalone har ingen diagnose-rapportering.** `StandaloneErrorBoundary` rapporterer ikke til `systemIssueReporter` (kun `console.error`). Det er en **bevidst** konsekvens af isolationskravet (regel 3): standalone-laget må ikke importere Mineos diagnoseflow. Risiko: standalone-fejl er ikke synlige i Mineos diagnostik. Re-evaluering hvis standalone-beregneren får et selvstændigt, isoleret diagnose-behov.

2. **`enforceUnsupportedDeviceGate: false` for standalone.** Bevidst fravalg, fordi procesrenteberegneren skal kunne bruges på mobil/tablet (med egen mobil-scroll-håndtering). Re-evaluering hvis standalone en dag skal være desktop-only.

3. **Viewport-responsiv styling er tilladt i en pinnet filliste — inkl. to filer delt med Mineo.** `AGENTS.md` ("Desktop-only gate") begrænser mobil/tablet-styling, fordi Mineo er desktop-only. Standalone MinProcesrente er en bevidst mobil-tilladt variant (jf. undtagelse 2), og undtagelsen dækker derfor:

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
