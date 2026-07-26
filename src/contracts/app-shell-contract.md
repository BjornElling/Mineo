# App-shell & multi-app — Mineo

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Selvstændig tværgående kontrakt for det øverste runtime-lag (app-entry, bootstrap, multi-app-isolation). Ligger *over* sidekomponent-laget: `page-component-contract.md §3.1` er underordnet denne kontrakt for alt der angår app-entry, device-gate-placering og shell-ansvar. Berører ikke beregnings-, form- eller persistence-*indhold* og overlapper derfor ikke de øvrige tværgående kontrakter — men den ejer den *namespace-isolation*, der holder to app-varianters persistence adskilt (jf. `persistence-contract.md`).
**Senest verificeret mod kode:** 2026-07-17

## 1. Scope

Det øverste runtime-lag, der binder programmet sammen, og isolationen mellem de to app-varianter:

- App-entries: `src/main.tsx` (Mineo) og `src/apps/minprocesrente/minprocesrenteMain.tsx` (standalone MinProcesrente).
- Delt app-shell: `src/apps/shared/bootstrapClientApp.tsx` (device-gate, render-beslutning, install-prompt-politik).
- Delt device-aflæsning: `src/utils/clientDevice.ts` (rene browser-/skærmcapabilities og orienteringsstabile touch-klassifikationer, uden app-shell-render-beslutninger).
- Mineo-specifik opstart: `src/apps/mineo/serviceWorkerBootstrap.ts` (service-worker-registrering og opdaterings-/reload-disciplin).
- PWA-cachepolitik: `public/_headers` (revalidering af HTML, SPA-ruter, manifest og service worker; immutable hashed assets).
- Standalone-specifik opstart og isolation: `src/apps/minprocesrente/standaloneStorageNamespace.ts`, `MinProcesrenteApp.tsx`, `StandaloneErrorBoundary.tsx`.
- Storage-namespace-maskineriet i `src/config/storageManifest.ts` (for så vidt det adskiller varianterne).

Den informative uddybning af device-gatens motivation ligger i `AGENTS.md` ("Desktop-only gate"). Dette dokument ejer de bindende regler for shell-laget.

## 2. Normative Regler

1. **Tynde app-entries; ét sted ejer opstart.** Hver entry (`main.tsx`, `minprocesrenteMain.tsx`) skal være tynd: den vælger app-roden og leverer variant-specifik opstart som callbacks, men delegerer al fælles runtime-opstart (device-gate, render-beslutning, install-prompt) til `bootstrapClientApp`. Device-gate-logik må aldrig duplikeres i en entry.

   Efter device-gaten og før app-roden returneres fra `renderApp`, initialiseres variantens ene aktive inputruntime
   præcis én gang. Mineo bruger greenfield-`initializeInputRuntime`; en entry/provider-remount må aldrig rehydrere.
   Under den ikke-deploybare cutover må en variant aldrig montere både `FormPersistenceProvider` og greenfield-
   runtime. Standalone-entryen binder tilsvarende sin egen greenfield-runtime atomisk med surface og consumers.
   Standalone-entryens namespace-side-effect skal være etableret før enhver
   runtimeinitialisering. Unsupported-device hard-stop må ikke initialisere sagsstate.

2. **Device-gaten ejes af app-shellen.** `isUnsupportedDevice` og `UNSUPPORTED_MAX_SCREEN_WIDTH_PX` lever kun i `bootstrapClientApp.tsx`. Rene browser-/skærmcapabilities og orienteringsstabile touch-klassifikationer (`isTouchLikeDevice`, fysisk skærmbredde/kortside, viewport-kortside, `isTouchLikeDeviceWithShortestSideAtMost`) lever i `src/utils/clientDevice.ts`, så samme aflæsninger kan genbruges uden at duplikere device-logik i sidekomponenter. Ved uunderstøttet enhed renderes `UnsupportedDevicePage` som hård stop, og App-roden monteres ikke. Gaten er **fail-closed**: kan den fysiske skærmbredde ikke aflæses på en touch-lignende enhed, behandles enheden som uunderstøttet. En app-variant kan eksplicit fravælge gaten via `enforceUnsupportedDeviceGate: false` (kun standalone-beregneren, der bevidst skal virke på mobil).

3. **Multi-app-isolation — ingen krydsimport.** Standalone-laget (`src/apps/minprocesrente/**`, `src/components/pages/minprocesrente/**` og dedikerede standalone-services) må ikke importere Mineos auth-, route-, PWA-, service-worker- eller diagnose-flow (`AuthGate`, `BrowserRouter`/`App`, `pwaLaunchQueue`, `serviceWorker*`, `systemIssueReporter`/`reportSystemIssue`). De to varianter deler kun rene, tilstandsløse moduler (beregning, schemas, formatering, PDF-rendering).

4. **Storage-namespace sættes før al storage-adgang.** Hver variant kører i sit eget sessionStorage-namespace (`mineo` som default, `minprocesrente` for standalone). `setStorageNamespace(...)` skal kaldes **én** gang ved bootstrap, *før* noget modul kan nå at røre sessionStorage. For standalone håndhæves rækkefølgen ved at sætte namespacet i en **bivirknings-import** (`standaloneStorageNamespace.ts`), der står som **første** import i entrypointet — før App-træets import — så ES-import-hoisting ikke kan flytte App-evalueringen foran namespace-sætningen. Namespacet må aldrig sættes inline i et entrypoint efter en App-import.

5. **Install-prompt-politik er eksplicit pr. variant.** Kun den variant der reelt er en installerbar PWA (Mineo, `capturePwaInstallPrompt: true`) capturer browserens `beforeinstallprompt`. Alle øvrige tilfælde (standalone, eller uunderstøttet enhed) suppresser prompten. Capture/suppress bruger den **kanoniske** implementering i `src/utils/pwaInstallPrompt.ts` — der må ikke findes en parallel install-prompt-håndtering i shell-laget.

6. **Service-worker er cache-fri og reload-disciplineret.** `public/sw.js` precacher ikke, runtime-cacher ikke og intercepter ikke `fetch` (for aldrig at servere forældet beregningslogik). HTML, SPA-ruter, manifest og service worker skal samtidig have no-cache/no-store headers i `public/_headers`, så browser/host-fallbacks ikke fastholder en gammel app-shell; hashed Vite-assets må fortsat være immutable. Klientsiden må kun udløse `window.location.reload()` ved en **reel opdatering** — dvs. når en *ventende* worker aktiveres og der allerede fandtes en controller, da dokumentet loadede. En `controllerchange` udløst af første installs `clients.claim()` (ingen controller ved load) må **aldrig** reloade, da det ville give en uønsket hard-reload midt i første åbning og kunne tabe ikke-gemt indtastning. Reload sker højst én gang pr. dokument, og hele update-lifecyclen wires gennem én fælles, idempotent funktion (ikke divergerende kopier på boot- og på de periodiske tjek).

7. **Top-level fejl fanges pr. variant.** Hver app-variant skal have en top-level error boundary mellem shell-render og forretnings-UI. Mineo bruger `src/components/errors/ErrorBoundary` (med diagnose-rapportering via `systemIssueReporter`). Standalone bruger `StandaloneErrorBoundary` (bevidst **uden** diagnose-rapportering, jf. regel 3's isolationskrav — se Kendte Undtagelser).

## 3. Autoritative Kilder

- Device-gate-tærskel og -logik: `src/apps/shared/bootstrapClientApp.tsx` (eneste sandhed).
- Device-capability-aflæsning og orienteringsstabil touch-klassifikation: `src/utils/clientDevice.ts` (delt, render-agnostisk browserdata).
- Storage-namespace-resolution: `src/config/storageManifest.ts` (dovne getters; namespace sat ved bootstrap).
- Install-prompt capture/suppress: `src/utils/pwaInstallPrompt.ts` (kanonisk).
- Service-worker-adfærd: `public/sw.js` (worker) + `src/apps/mineo/serviceWorkerBootstrap.ts` (klient-lifecycle/reload-gate).
- PWA-cachepolitik: `public/_headers`.

## 4. Testkobling

- `src/__tests__/quality/minprocesrenteStandaloneIsolation.test.ts` (ingen krydsimport; storage-namespace sat via bivirknings-import før App-import).
- `src/__tests__/apps/shared/bootstrapClientApp.test.tsx` (device-gate hård stop som default; standalone kan fravælge gaten).
- `src/__tests__/apps/mineo/serviceWorkerBootstrap.test.ts` (reload kun ved reel opdatering, aldrig ved første install; højst én reload; ingen registrering uden for produktion eller på `/open`).
- `src/__tests__/quality/pwaHeaders.test.ts` (HTML, SPA-ruter, manifest og service worker revalideres; hashed assets er immutable).

## 5. Kendte Undtagelser

1. **Standalone har ingen diagnose-rapportering.** `StandaloneErrorBoundary` rapporterer ikke til `systemIssueReporter` (kun `console.error`). Det er en **bevidst** konsekvens af isolationskravet (regel 3): standalone-laget må ikke importere Mineos diagnoseflow. Risiko: standalone-fejl er ikke synlige i Mineos diagnostik. Re-evaluering hvis standalone-beregneren får et selvstændigt, isoleret diagnose-behov.

2. **`enforceUnsupportedDeviceGate: false` for standalone.** Bevidst fravalg, fordi procesrenteberegneren skal kunne bruges på mobil/tablet (med egen mobil-scroll-håndtering). Re-evaluering hvis standalone en dag skal være desktop-only.

3. **Standalone har variant-lokal `@media`-styling.** `AGENTS.md` ("Desktop-only gate") begrænser mobil/tablet-styling til `UnsupportedDevicePage.tsx`, fordi Mineo er desktop-only. Standalone MinProcesrente er en bevidst mobil-tilladt variant (jf. undtagelse 2) og har derfor `@media`-responsiv styling i sine **egne** filer: `src/components/pages/minprocesrente/MinProcesrenteCalculatorPage.tsx` (sx-lokal) og `src/apps/minprocesrente/minprocesrente.css` (kun importeret af standalone-buildet). Denne styling er variant-lokal — ikke delt/global — og rammer aldrig Mineos desktop-only-flade. Risiko: ingen for Mineo; reglen i `AGENTS.md` gælder fortsat for det desktop-only hovedbuild. Re-evaluering hvis standalone gøres desktop-only, eller hvis nogen mobil-styling flyttes til delte/globale styles.
