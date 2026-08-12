# Plan: ny opdateringsmodel — «ny session = ny version, åben session = urørt»

Status: **IMPLEMENTERET** 2026-08-12, efter review af Codex 5.6 luna (xhigh).

Reviewet fandt seks reelle defekter, som alle er rettet og dækket af tests:

| # | Fund | Rettelse |
|---|---|---|
| 1 | `installed` er ikke en sikker reload-barriere — det nye dokument ville køre under den **gamle** worker, se «samme version» og aldrig fuldføre skiftet | Rækkefølgen er nu install → aktivér → **bekræft `activated`** → reload (`activateNewBuildWorker`) |
| 2 | Løkkeværn med kun «sidst sete version» kunne reloade i ring ved en flappende, delvis udrullet origin | Markøren holder nu **alle mål forsøgt fra denne kildeversion** |
| 3 | En `.eo`-fil kunne gå tabt: `launchQueue`-callbacken persisterer asynkront, og reloaden kunne ramme midt i skrivningen | Ny `awaitDurablePendingPwaFileOpenHandoff()`; kan handoff ikke bekræftes, reloades der ikke |
| 4 | `App.tsx` genindlæste ubetinget ved bfcache-restore — et build-skift midt i en åben sag | `pageshow`-lytteren er fjernet |
| 5 | En IndexedDB-læsefejl blev behandlet som «ingen pending request» og kunne derfor tillade en reload, der tabte en `.eo`-request | Persistencegrænsen returnerer nu læsestatus og blokerer reload ved ukendt eller fejlet storage |
| 6 | En ny launchQueue-fil eller en worker-reference kunne ændre sig under den sidste kontrol | Durable handoff stabiliserer launch-generationen, og `SKIP_WAITING` sendes til den konkrete worker, der blev verificeret |

Codex bekræftede desuden de to rettelser, jeg havde lavet forinden (behold `SKIP_WAITING`, fjern
`clients.claim()`), og gav medhold i §1.3-beslutningen om at beholde lazy dokument-vendorer.

## 0. Vurdering af brugerens tre punkter

| Punkt | Vurdering |
|---|---|
| **a)** Programmet opdaterer altid sig selv ved opstart — også ved `.eo`-opstart | **Enig.** Det er den eneste model uden brugerhandling. Skal dog være *fail-safe*, ikke *fail-fast*: kan den nye version ikke klargøres komplet, startes den nuværende. |
| **b)** Indlæs hele programmet ved opstart | **Delvis uenig.** Målet (aldrig en manglende chunk) er rigtigt, men midlet skal ikke være ivrige imports i entry-grafen. Se §1.3. |
| **c)** Åben session kører videre på nuværende version; opdateres først næste opstart | **Enig, og det er den vigtigste ændring.** Fjerner opdateringslinjen helt. |

### 0.1 Kernediagnose af den nuværende model

Den nuværende kode er *ikke* «ny session = ny version». Den er «prøv i op til 5 s, ellers vis den gamle og tilbyd en linje»:

- `ensureLatestServiceWorkerBeforeRender` (serviceWorkerBootstrap.ts:213) kapper opdateringen efter
  `SW_UPDATE_CHECK_TIMEOUT_MS = 5000` og renderer så den **gamle** version.
- Efter render kan `checkForServiceWorkerUpdate` publicere `'ready'`, hvorefter
  `ApplicationReloadNotice` beder brugeren om at handle («En ny version er klar» / «Genindlæs nu»).

Det giver præcis de to ting, brugeren vil væk fra: **en handling** og **en mulig fejltilstand** (brugeren
kan blive på en halv-gammel version vilkårligt længe, og en reload midt i arbejdet kan blokeres af en
åben editor).

Desuden er der en **reel race** i dagens boot: `runBootUpdatePass` (linje 207) kører
`registerServiceWorker()` og `probeDeployedVersion()` i `Promise.all` og reloader, hvis den udrullede
version afviger. Men reloaden sker uden nogen garanti for, at den nye workers precache er **færdig**.
Reloader vi ind i en ny build, hvis worker endnu ikke har `install`-et sin cache færdig, står vi med
netop den situation cachen skulle forhindre. I dag maskeres det af, at HTML/asset-hentning alligevel
går til netværket — men det er held, ikke design.

## 0.2 Overvejet og forkastet: forskellig model for browser og PWA

Idé (brugeren, under review): lad **browser-udgaven** altid køre nyeste version, mens **PWA'en**
indlæser alt ved opstart og først opdaterer ved næste opstart.

**Forkastet — tre grunde:**

1. **Sondringen er ikke pålideligt detekterbar og måler det forkerte.** `display-mode: standalone`
   fortæller, hvordan vinduet blev *åbnet*, ikke om der er arbejde i gang. Samme bruger og samme data
   kan optræde i begge tilstande, og et browserfaneblad kan sagtens rumme en tre timer gammel,
   halvfærdig erstatningsopgørelse. En datasikkerhedsregel, der hænger på et *visnings*-signal, er
   kun rigtig ved et tilfælde.
2. **«Altid nyeste» i browseren betyder enten intet eller et tvunget reload.** Lander en deploy midt i
   en browsersession, må man enten afbryde brugerens arbejde — præcis det, modellen fjerner — eller
   lade være, og så var løftet tomt. Det genindfører opdateringslinjen ad bagdøren for én launch-mode.
3. **To modeller fordobler edge-case-matricen** (§3 ville gå fra 14 til ~28 rækker) for at betjene en
   sondring, der ikke følger det, vi faktisk beskytter.

**Det, idéen reelt er ude efter, leverer §1.1 allerede.** HTML er `no-store`, så ethvert nyt faneblad,
enhver navigation og enhver genindlæsning henter nyeste HTML. En browserbruger, der åbner et faneblad,
**er** på nyeste version — ikke via en særregel, men fordi «åbne et faneblad» *er* en ny session.
Ét invariant dækker begge tilstande, fordi grænsen er **sessionsstart** (detekterbar og ærlig) og ikke
**launch-mode** (hverken det ene eller det andet).

## 1. Målmodel

### 1.1 Ét invariant

> **En ny session starter altid på den nyeste version, der kan klargøres komplet.
> En åben session skifter aldrig version.**

Konsekvenser, der følger direkte:

1. Opdateringslinjen (`ApplicationReloadNotice`s update-halvdel) **udgår**. Der er ingen tilstand, hvor
   brugeren skal tage stilling til en version.
2. `skipWaiting`-beskeden fra klienten **udgår**. En ny worker må aldrig overtage en levende klient.
3. Periodiske update-tjek (`SW_PERIODIC_UPDATE_CHECK_MS`, `visibilitychange`, `online`) **udgår**.
   De findes kun for at fodre linjen.
4. `.eo`-opstart er ikke et særtilfælde: er det en **ny** session, gælder regel 1; er det
   `focus-existing` mod en **kørende** session, gælder regel 2 (og der sker ingen boot overhovedet).

### 1.2 Hvorfor «komplet klargjort» er hele pointen

En opdatering må først bruges, når den nye build er **fuldt precachet**. Ellers har vi byttet
«brugeren skal klikke» ud med «brugeren kan lande i en halv version» — en dårligere handel.

Derfor bliver boot-sekvensen en **barriere**, ikke en timeout-væddeløb:

```
boot
 ├─ registrér worker
 ├─ probe /pwa-assets.json  → deployedVersion
 ├─ deployedVersion === VERSION ?  → render nu (den normale, hurtige vej)
 └─ ellers: vent på at den nye worker er INSTALLED (precache komplet)
      ├─ lykkes  → reload én gang (løkkeværn) → næste boot rammer grenen ovenfor
      └─ fejler/timeout/offline → render NUVÆRENDE version uændret (fail-safe)
```

Det afgørende skift fra i dag: vi venter på **`installed`-tilstanden**, ikke på en vilkårlig
5-sekunders-timer, og vi reloader **kun** når den nye version beviseligt ligger komplet i cache.

### 1.3 Om punkt (b) — hvorfor ikke ivrige imports

Målt på det faktiske build (`npm run build:mineo`, 2026-08-12):

- I alt **4,6 MiB / 143 assets**; JS alene **4,27 MB** ukomprimeret.
- Dokument-vendorerne, som er lazy i dag: `vendor-jspdf` 400 kB, `vendor-docx` 373 kB,
  `vendor-html2canvas` 200 kB, `index.es` 151 kB → **ca. 1,12 MB** ukomprimeret.

To ting er allerede på plads og løser målet bag (b):

1. **Alle route-moduler preloades** kort efter render — `preloadRouteModules` i App.tsx:68, kørt via
   `requestIdleCallback(…, {timeout: 2000})` med `setTimeout(…, 500)`-fallback.
2. **Service-workerens precache dækker hele manifestet**, altså også writer- og dokument-chunks
   (`sw/mineoServiceWorker.js:57`). Cachen er komplet, før workeren overhovedet installeres.

Gør vi dokument-vendorerne til almindelige statiske imports, flytter vi ~1,1 MB parse/eval ind i
opstartens kritiske vej for **alle** sessioner — også dem, der aldrig laver et dokument. Det gør
opstarten mærkbart langsommere uden at fjerne en eneste fejltilstand, fordi fejltilstanden allerede er
lukket af precachen.

**Beslutning:** behold `import()` som *leveringsform*, men gør *tilgængeligheden* garanteret.
Konkret ændring i denne plan: udvid baggrunds-preloaden fra kun route-moduler til også at omfatte
dokument-/writer-vendorerne, så en åben session har alt i hukommelsen, ikke blot i cache. Det er
punkt (b)'s reelle formål, opnået uden opstartsstraffen.

## 2. Ændringer, fil for fil

### 2.1 `src/apps/mineo/serviceWorkerBootstrap.ts` — omskrives

Fjernes:
- `ServiceWorkerUpdateStatus`, `getServiceWorkerUpdateStatus`, `subscribeServiceWorkerUpdateStatus`,
  `activateAvailableServiceWorkerUpdate`, `announceOutdatedDocument`, `updateStatusListeners`.
- `setupServiceWorkerUpdateChecks` og hele det periodiske tjek.
- `wireControllerChange` / `reloadAfterAcceptedControllerChange` (ingen brugeraccepteret reload findes mere).
- `SW_UPDATE_CHECK_TIMEOUT_MS` som *afkortning af opdateringen*.

Nyt hovedforløb (eneste eksport mod shellen):

```ts
export const ensureLatestVersionBeforeRender = async (): Promise<void>
```

1. Ikke-PROD / ingen `serviceWorker` → returnér straks.
2. Notér om der er en controller ved opstart (`navigator.serviceWorker.controller`).
3. `register('/sw.js?v=<VERSION>', { scope: '/', updateViaCache: 'none' })` + `update()`.
4. `probeDeployedVersion()` mod `/pwa-assets.json` med `cache: 'no-store'`.
5. `deployedVersion === null` (offline/fejl) → returnér; kør videre på nuværende version.
6. `deployedVersion === VERSION` → returnér; **den normale vej, ingen ventetid**.
7. Ingen controller ved opstart → returnér. Der er ingen gammel worker at fortrænge; dokumentet kører
   allerede den HTML, origin lige leverede, og cachen er på plads fra næste opstart.
8. Ellers `activateNewBuildWorker(registration)` — **tre trin, i denne rækkefølge**:
   1. afvent `installed` (komplet precache),
   2. `postMessage({type:'SKIP_WAITING'})` til den konkrete installerede worker,
   3. **afvent `activated`** — bekræftelsen, ikke installationen, er reload-barrieren.

   Hele forløbet deler ét `UPDATE_INSTALL_TIMEOUT_MS`-loft (15 s) som værn mod at hænge.
   Timeout/`redundant`/manglende aktivering → returnér uændret (fail-safe render).
9. `awaitDurablePendingPwaFileOpenHandoff()` → kan en pending `.eo`-request ikke bekræftes
   persisteret, returnér **uden** reload.
10. `reloadOnceForDeployedVersion(deployedVersion)`.

**Hvorfor trin 8.3 er ufravigelig:** en installeret worker står i `waiting`, og et dokument beholder
sin controller hele sin levetid. Genindlæstes der efter `installed`, ville den nye HTML køre under den
**gamle** worker; det nye dokument ville se «samme version», returnere med det samme, og den nye
worker kunne blive stående ventende i det uendelige.

Løkkeværnet (`getBootReloadVersionStorageKey`, sessionStorage) holder nu **alle mål forsøgt fra denne
kildeversion** — ikke blot «sidst sete version», som kunne reloade i ring ved en flappende origin.
Reload sker fortsat kun, hvis markøren kan skrives.

### 2.2 `sw/mineoServiceWorker.js` — RETTET efter spec-verifikation

> **Rettelse.** Et tidligere udkast af denne plan ville fjerne **både** `SKIP_WAITING` og
> `clients.claim()`. Det er **forkert**, og det ville have brudt hele modellen. Verificeret mod
> specifikationen (web.dev «The service worker lifecycle», MDN `ServiceWorkerRegistration.waiting`):
>
> - En ventende worker aktiverer **kun**, når den gamle worker kontrollerer **nul** klienter.
> - **En almindelig genindlæsning er IKKE nok.** Ved navigation forsvinder det gamle dokument først,
>   når svarets headere er modtaget, så den gamle worker kontrollerer *altid* en klient under en
>   refresh. Der er overlap pr. design.
>
> Konsekvens: uden `skipWaiting()` ville reloaden i §2.1 lande i den **gamle** worker, og en ny
> version ville aldrig kunne tages i brug, så længe brugeren har mindst ét vindue åbent. For en
> `display: standalone`-PWA, som brugeren sjældent lukker helt, ville programmet i praksis
> **aldrig opdatere**. Præcis det modsatte af planens formål.

Derfor:

- **`SKIP_WAITING`-handleren BEVARES** i workeren. Den er den eneste mekanik, der kan gøre en ny
  version aktiv, uden at brugeren skal lukke alle vinduer.
  Sikkerheden ligger i **hvornår klienten sender beskeden**, ikke i om workeren kan modtage den:
  klienten sender den **kun før render** (§2.1), hvor der pr. definition ikke findes brugerarbejde.
  Det er samme gate som i dag (`activateWaitingWorkerSilently`, `isBootPhase`) — nu som den
  *eneste* vej, uden linjen efter render.
- **`clients.claim()` FJERNES.** Det er den del af det oprindelige udkast, der var rigtig, og det er
  den, der beskytter invariantet «åben session skifter aldrig version»: uden `claim()` overtager en
  nyaktiveret worker aldrig et *andet* faneblads levende dokument.
  - *Følge:* førstegangsinstallationen styrer ikke det dokument, der installerede den. Acceptabelt:
    det dokument kører allerede nyeste version (HTML er `no-store`), og dets assets hentes fra
    netværket. Fra næste opstart er sessionen cache-dækket.
- `install`: `precacheBuildAssets()` uændret — «komplet eller intet»-barrieren modellen bygger på.
- Retention af tidligere versionscacher: uændret (stadig nødvendig, se §4.2).

**Hvorfor `skipWaiting()` er ufarligt her**, selv om web.dev advarer mod det ved code-splitting:
advarslen gælder en ny worker, der overtager en **allerede renderet** side med gammel JS i
hukommelsen. Vi kalder den kun **før render**, og reloader umiddelbart efter, så dokument og worker
altid er samme build. Dertil er `findCachedAsset` (sw:63) versionsuafhængig — den søger på tværs af
**alle** `mineo-build-assets:`-cacher — så selv en gammel controller kan servere en ny builds hashes,
og gamle hashes overlever i deres egen cache.

### 2.3 `src/components/system/ApplicationReloadNotice.tsx`

- Update-halvdelen fjernes (`updateStatus`, «En ny version er klar», «Genindlæs nu»).
- **Lazy-recovery-halvdelen bevares uændret.** Den dækker en anden fejlklasse (jf.
  app-shell-contract §Kendte Undtagelser 4: ryddet Cache Storage, eller første installation offline),
  og den er stadig sidste værn. Komponenten omdøbes til at afspejle det ene ansvar:
  `LazyChunkRecoveryNotice`.

### 2.4 `src/main.tsx`

- `beforeDesktopRender: ensureLatestVersionBeforeRender`.
- `afterDesktopRenderSetup` fjernes (intet at sætte op efter render).
- Rækkefølgen `setupPwaFileOpenHandling` → `beforeDesktopRender` **bevares**: en `.eo`-request skal
  være persisteret, før en eventuel opdaterings-reload sker, så den overlever ind i den nye version.
  Det er allerede kontraktens §6 og virker.

### 2.5 `src/App.tsx` — udvidet baggrunds-preload

`preloadRouteModules` udvides til `preloadDeferredModules`, som ud over route-modulerne også henter
dokument-/writer-indgangene. Fortsat via `requestIdleCallback`, fortsat `Promise.allSettled` (en
fejlet preload må aldrig kunne vælte noget), fortsat efter render.

## 3. Edge cases, der skal dækkes af tests

| # | Situation | Krævet adfærd |
|---|---|---|
| 1 | Ingen ny version (`deployed === VERSION`) | Render straks. Ingen ventetid, ingen reload. |
| 2 | Ny version, precache lykkes | Præcis **én** reload, derefter kører den nye version. |
| 3 | Ny version, men offline midt i | Render nuværende version. Ingen reload, ingen fejl. |
| 4 | Ny version, precache fejler (`redundant`) | Render nuværende version. Ingen reload. |
| 5 | Ny version, install hænger | Timeout-loft → render nuværende version. |
| 6 | Reload-markør kan ikke skrives | **Ingen** reload (et uspærret reload er værre end gammel kode). |
| 7 | Samme version to gange (markør sat) | Ingen anden reload. Ingen løkke. |
| 8 | Deploy landet *under* boot (manifest ≠ worker) | Worker afviser install (findes allerede) → fail-safe render. |
| 9 | Åben session, ny deploy sker | **Intet sker.** Ingen linje, intet tjek, ingen versionsskift. |
| 10 | `.eo` dobbeltklik, app kører (`focus-existing`) | Eksisterende vindue fokuseres; ingen boot, ingen opdatering. |
| 11 | `.eo` dobbeltklik, app lukket, ny version findes | Request persisteres **før** reload; overlever ind i ny version. |
| 12 | Andet faneblad opdaterer | Denne session urørt (`clients.claim()` er væk). |
| 13 | Lazy chunk mangler alligevel | `vite:preloadError` → recovery-linjen (uændret). |
| 14 | Ikke-PROD / ingen SW-understøttelse | Ingen registrering, ingen probe, ingen reload. |
| 15 | Ny version installeret, men bliver **aldrig aktiv** | **Ingen** reload. (Ellers ville den nye HTML køre under den gamle worker.) |
| 16 | Første besøg, ingen controller | Ingen reload; cachen er på plads fra næste opstart. |
| 17 | Flappende/delvist udrullet origin (V2→V3→V2) | Hvert spring forsøges én gang; går i ro frem for at reloade i ring. |
| 18 | `.eo` afleveret midt i opstartens barriere | Reload afvises, indtil handoff er bekræftet i IndexedDB. |
| 19 | bfcache-restore af en åben session | **Ingen** reload; brugeren vender tilbage til sit eget arbejde. |
| 20 | Registrering afvist (fx private vindue) | Ingen reload; programmet starter normalt. |
| 21 | IndexedDB-læsning fejler eller hænger under handoff | Ingen reload; brugerens `.eo`-request prioriteres, og næste opstart prøver igen. |
| 22 | Ny `.eo`-request ankommer under sidste durable kontrol | Kontrollen gentages for den nye launch-generation; reload frigives først ved stabil match. |

**Bevidst uden for klientens rækkevidde** (dokumenteret, ikke løst i kode): Cache Storage-eviction
under lagerpres og en første installation, der aldrig fuldføres, kan stadig give en manglende chunk.
Dér — og kun dér — overtager `vite:preloadError`-linjen, som er den ene tilbageværende flade, der
kræver en brugerhandling. Det accepteres som et sjældent, fail-safe fallback: automatisk opdatering er
stadig standarden i alle forløb, hvor klienten kan klargøre den nye version. Se app-shell-kontraktens
«Kendte Undtagelser 4».

## 4. Bevidste konsekvenser

### 4.1 En bruger kan sidde på en gammel version i dagevis
Ja — og det er **valgt**. En sag, der er åben i tre dage, må ikke skifte beregningskode under hænderne
på brugeren. Prisen er, at en hasteret først slår igennem ved næste opstart. Alternativet (tvungen
reload) kan koste igangværende arbejde, hvilket er værre.

### 4.2 Versionscache-retention bevares
Stadig nødvendig, netop *fordi* en åben session kan leve længe efter, at origin kun har den nye build.
Uændret fra i dag.

### 4.3 Opstart kan tage længere ved en ny version
Kun ved faktisk versionsskift, og kun til precachen er færdig. Til gengæld er resultatet altid en hel
version. Ved uændret version (langt det almindeligste) er der **ingen** ekstra ventetid — bedre end i
dag, hvor der altid kan ventes op til 5 s.

## 5. Kontraktændringer (`src/contracts/app-shell-contract.md`)

§8 omskrives fra «versionssammenligning + linje efter render» til invariantet i §1.1.
§7 justeres: `skipWaiting`/`clients.claim()` udgår som mekanik.
Testreferencerne i kontraktens liveness-afsnit opdateres til de nye/omdøbte filer.
