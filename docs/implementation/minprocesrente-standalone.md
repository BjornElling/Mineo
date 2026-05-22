# Implementeringsplan: MinProcesrente som selvstændig beregner

**Dato:** 2026-05-19  
**Status:** Plan - ikke implementeret  
**Formål:** Etablere `minprocesrente.dk` som en selvstændig, klientbaseret procesrente-beregner baseret på samme kildekode som Mineos renteberegning.

---

## Overblik

`minprocesrente.dk` skal være en separat side uden Mineos auth-gate og uden de øvrige Mineo-fagsider. Siden skal genbruge Mineos eksisterende renteberegningsdomæne, tabelkomponenter, inputadfærd, CSS, typografi og valideringsmønstre.

Målet er ikke at klone Mineo og slette resten, men at gøre Mineo-repoet til én kildekodebase med to app-varianter:

| Variant | Domæne | Indhold | Auth-gate | Deploy |
|---|---|---|---|---|
| Mineo | `mineo.dk` | Hele Mineo | Ja | Cloudflare worker/assets for Mineo |
| MinProcesrente | `minprocesrente.dk` | Kun procesrente-beregneren, uden rentesats-tab | Nej | Cloudflare worker/assets for MinProcesrente |

Begge builds skal kunne udløses fra samme GitHub push, så fejlrettelser i renteberegneren automatisk følger med begge steder.

---

## Designprincipper

- Renteberegningens beregningsmotor og validering forbliver i `src/domain/renteberegning/*`.
- UI'en genbruger de eksisterende Mineo-komponenter der er relevante for selve beregneren: `RenteberegningTab`, `BeregnetRenteTable`, inputkomponenter og tabeller.
- Rentesatser-tabben skal ikke være tilgængelig på MinProcesrente. Rentesatsdata genbruges fortsat internt af beregningen.
- MinProcesrente må kun bero på brugerindtastninger fra procesrente-siden selv. Brugerindtastede oplysninger fra `stamdata`, `indstillinger` eller andre Mineo-sektioner må ikke indgå.
- Ingen separat kopi af procesrente-logikken må oprettes.
- MinProcesrente må ikke importere Mineos auth-lag.
- MinProcesrente må ikke importere Mineos fulde route-konfiguration, hvis det trækker alle øvrige fagsider ind i standalone-bundlet.
- Begge apps forbliver 100 % client-side.
- Ingen serverkommunikation, eksterne API'er, telemetry eller ekstern logging må introduceres.
- Visuelt udtryk skal komme fra Mineos eksisterende CSS/theme. `C:\Users\bjell\Paradigmesamling` bruges som reference for den korrekte Mineo-lignende offentlige stil, ikke som teknisk platform.
- Standalone-siden skal ikke have topbar, branding-header, Mineo-navigation eller andet chrome omkring beregneren.

---

## Foreslået arkitektur

### App-varianter

Opret et lille variant-lag under `src/apps/`:

```text
src/apps/
  mineo/
    MineoApp.tsx
    mineoMain.tsx
  minprocesrente/
    MinProcesrenteApp.tsx
    minprocesrenteMain.tsx
  shared/
    bootstrapClientApp.tsx
```

`src/main.tsx` kan enten bevares som Mineos entrypoint eller gøres til en tynd re-export/import af `src/apps/mineo/mineoMain.tsx`. Første implementering bør vælge den mindst risikable model:

1. Flyt kun fælles bootstrap-logik ud, når det er nødvendigt.
2. Bevar Mineos eksisterende runtime-adfærd uændret.
3. Tilføj MinProcesrente som et nyt entrypoint ved siden af.

### Fælles bootstrap

Fælles bootstrap bør dække:

- desktop-only gate via `UnsupportedDevicePage`
- font- og CSS-loading
- React root setup

Bootstrap skal parameteriseres med:

```typescript
type ClientAppBootstrapOptions = Readonly<{
  renderApp: () => React.ReactNode;
  useAuthGate: boolean;
  enablePwaFileOpenHandling: boolean;
  enableServiceWorker: boolean;
  serviceWorkerVersionScope?: string;
}>;
```

Mineo bruger `useAuthGate: true`, `enablePwaFileOpenHandling: true` og `enableServiceWorker: true`.

MinProcesrente bruger `useAuthGate: false`, `enablePwaFileOpenHandling: false` og `enableServiceWorker: false`, fordi `.eo`-filåbning og PWA/offline-adfærd er Mineo-specifik i denne løsning.

### MinProcesrenteApp

Standalone-appen bør ikke bruge `App.tsx`, fordi `App.tsx` importerer alle Mineos routes. I stedet oprettes en lille app-komposition:

```text
ThemeProvider
  BrowserRouter eller ingen router
    FormPersistenceProvider
      Standalone layout
        ErrorBoundary
          MinProcesrenteCalculatorPage
```

Der findes kun én side, så routing er ikke nødvendig i første version. Hvis routing senere tilføjes, skal det ske i variant-laget uden at importere Mineos fulde route-array.

### Layout

Der bør oprettes et smalt standalone-layout, ikke en kopi af `MainLayout`.

Forslag:

```text
src/components/layout/StandaloneCalculatorLayout.tsx
```

Ansvar:

- centrere/placere indhold med samme bredde og luft som Mineo
- bruge samme baggrund, skrifter og `ContentBox`-familie
- ingen Mineo-sidemenu
- ingen global Mineo-navigation
- ingen topbar eller branding-header
- ingen auth-gate
- ingen `.eo`-load/save-flow

`MainLayout` bør ikke genbruges direkte, fordi det trækker Mineos globale navigation, gem/hent/slet alt, `.eo`-flows og sidekoblinger med ind på `minprocesrente.dk`. Det ville være i direkte konflikt med beslutningen om ingen gem/hent-funktionalitet og ingen topbar/branding.

### Renteberegningens afhængigheder

`Renteberegning` læser i dag:

- `renteberegning` via `usePersistedForm`
- `stamdata` read-only via `usePersistedSectionSelector('stamdata')`
- app settings via `useAppSettings`
- renteberegningens rates via `src/data/interestRates`
- PDF-service via `downloadRentePdf`

For MinProcesrente må afhængighederne reduceres til det, der er nødvendigt for procesrente-siden selv:

| Afhængighed | Plan |
|---|---|
| `renteberegning` | Genbrug samme schema, persisted form og sessionStorage-baserede commit/persist-flow |
| `stamdata` | Må ikke bruges i MinProcesrente. Ingen brugerindtastede stamdata er relevante for beregningen. |
| `AppSettingsProvider` / `indstillinger` | Må ikke bruges til brugerdata i MinProcesrente. Eventuelle tekniske PDF/default-konstanter skal være hardcodede standalone defaults eller et teknisk config-objekt uden brugerinput. |
| PDF | Genbrug rente-PDF-beregning/output hvor muligt, men kald den via en standalone-adapter der ikke kræver `stamdata` eller brugerindtastede indstillinger. |
| Tabelrækkefølge | Genbrug `saveOrderPath="renteberegning.rentekravRows"` |

Hvis eksisterende `downloadRentePdf` kræver `settings` eller `persistedStamdata`, skal PDF-laget deles op, så den fælles kerne kan kaldes med en minimal standalone-kontekst. Standalone-konteksten må kun indeholde:

- beregnerens egne committed input
- beregnede renteperioder/resultater
- tekniske PDF-defaults, der ikke kan ændres af brugeren på MinProcesrente

---

## UX-beslutninger

Følgende brugeroplevelse er besluttet for første version:

| Spørgsmål | Beslutning | Praktisk konsekvens |
|---|---|
| Skal siden have gem/hent/slet-knapper? | Nej | Brugeren får ingen filbaseret gem/hent/slet-funktionalitet på `minprocesrente.dk`. |
| Skal PDF'en have brevhoved/journalnr.? | Nej | PDF-download skal være neutral og må ikke kræve stamdata, journalnr., brevhovedindstillinger eller andre brugerindtastede oplysninger uden for procesrente-siden. |
| Skal der være en topbar/branding? | Nej | Første viewport skal bestå af selve beregneren med sidetitel og indhold, uden separat header/chrome. |
| Skal `Rentesatser`-tabben være synlig? | Nej | Brugeren kan kun bruge beregningsfladen. Rentesatsdata anvendes stadig i beregningen, men vises ikke som tab. |
| Skal siden være PWA/offline? | Nej | Ingen PWA-installation, file-open handling eller separat service worker i første version. |

Konsekvens for komponentdesign:

- `Renteberegning` bør enten parameteriseres, så tabs/rentesatser/PDF-kontekst kan styres pr. variant, eller der oprettes en smal `MinProcesrenteCalculatorPage`, som genbruger `RenteberegningTab` direkte.
- Den smalle sidekomponent er sandsynligvis mest præcis, fordi standalone kun skal bruge beregningstabben og ikke Mineos page-chrome, `stamdata` eller brugerindtastede `indstillinger`.
- Eventuelle nye props på fælles komponenter må ikke ændre Mineos standardadfærd.

---

## Build- og deploy-struktur

### Vite

Tilføj separate HTML-entrypoints:

```text
mineo.html
minprocesrente.html
```

Alternativt kan der bruges separate Vite-configs:

```text
vite.mineo.config.ts
vite.minprocesrente.config.ts
```

Anbefalet model er én Vite-config med Rollup inputs, hvis den kan holdes enkel. Hvis Cloudflare-deploy kræver separate outputmapper, er separate configs tydeligere:

```text
dist/mineo
dist/minprocesrente
```

Package scripts:

```json
{
  "build:mineo": "vite build --config vite.mineo.config.ts",
  "build:minprocesrente": "vite build --config vite.minprocesrente.config.ts",
  "build:all": "npm run build:mineo && npm run build:minprocesrente"
}
```

Eksisterende `npm run build` bør enten fortsætte som alias for `build:mineo` eller fjernes, så nuværende deploy ikke ændrer adfærd utilsigtet.

### Cloudflare

Opret to wrangler-konfigurationer:

```text
wrangler.mineo.json
wrangler.minprocesrente.json
```

Eksempelstruktur:

```json
{
  "name": "minprocesrente",
  "compatibility_date": "2026-04-28",
  "assets": {
    "directory": "./dist/minprocesrente",
    "not_found_handling": "single-page-application"
  },
  "observability": {
    "enabled": false
  }
}
```

Mineos eksisterende `wrangler.json` omdøbes til `wrangler.mineo.json`, så begge configs følger samme navneskema.

### GitHub Actions

Pipeline:

```text
npm ci
npm run typecheck
npm test -- --runInBand eller eksisterende testkommando
npm run build:mineo
npm run build:minprocesrente
wrangler deploy --config wrangler.mineo.json
wrangler deploy --config wrangler.minprocesrente.json
```

Hvis begge deploys skal ske på samme push, bør de først deploye efter at begge builds og alle tests er grønne. Dermed undgås en situation hvor Mineo deployes, men MinProcesrente fejler på samme commit.

---

## Implementeringsstadier

### Stadium 0 - Beslutningslåst scope

Scope for første version er låst til:

- ingen gem/hent/slet
- ingen PDF-brevhoved eller journalnr.
- ingen topbar/branding
- ingen rentesatser-tab
- ingen PWA/offline
- ingen brugerindtastede oplysninger fra `stamdata`, `indstillinger` eller andre Mineo-sektioner

### Stadium 1 - Variant-entrypoints uden adfærdsændring i Mineo

- Udtræk kun den bootstrap-kode, der er nødvendig for at kunne starte to apps.
- Bevar Mineos eksisterende `AuthGate`-flow uændret.
- Opret `MinProcesrenteApp` uden auth-gate.
- Sørg for at standalone-entrypointet kun renderer beregningsfladen.
- Verificér at `AuthGate` ikke importeres i MinProcesrente-bundlet.
- Verificér at service worker/PWA-file-open kode ikke aktiveres for MinProcesrente.

### Stadium 2 - Standalone layout

- Opret et smalt standalone-layout med Mineo-styling.
- Genbrug `ContentBox`, `page-title`, `section-header` og tabelkomponenter.
- Undlad topbar, brandblok, sidemenu og global navigation.
- Undgå global responsive styling uden for eksisterende desktop gate-regler.
- Brug Paradigmesamling som visuel reference for spacing, Montserrat og Mineo-lignende offentligt udtryk.

### Stadium 3 - Renteberegning i standalone-kontekst

- Opret `MinProcesrenteCalculatorPage`, der genbruger `RenteberegningTab` direkte og dermed undgår `RentesatserTab`.
- Undgå at montere Mineos fulde `Renteberegning` page, medmindre den først parameteriseres, så standalone ikke får tabs, `stamdata`, brugerindtastede `indstillinger` eller Mineo-specifik PDF-kontekst.
- Standalone må kun læse/skrive `renteberegning`-sektionen.
- Verificér at commit-on-blur og tabel-`onPersist` fortsat fungerer.
- Verificér at rentesats-tabben ikke er tilgængelig i standalone.
- Verificér at beregninger kun sker fra committed state.

### Stadium 4 - PDF uden Mineo-sagsdata eller indstillinger

- Test PDF-download uden Mineo-sagsdata.
- Sikr at PDF'en ikke viser brevhoved.
- Sikr at PDF-metadata og filnavn er acceptable for `minprocesrente.dk` uden journalnr. og uden brugerindtastede `indstillinger`.
- Der må ikke indføres standalone PDF-oplysninger i første version.
- Ingen device-local settings må injiceres i brugerdata for at få en fil eller PDF til at se komplet ud.
- Hvis det eksisterende PDF-service-lag ikke kan kaldes uden `settings`/`stamdata`, skal der udtrækkes en fælles rente-PDF-kerne med to tynde adapters: Mineo-adapter og MinProcesrente-adapter.

### Stadium 5 - Build/deploy

- Tilføj `build:mineo` og `build:minprocesrente` scripts samt `build:all`.
- Omdøb `wrangler.json` til `wrangler.mineo.json`; tilføj `wrangler.minprocesrente.json`.
- Opdater GitHub Actions til at bygge og deploye begge varianter.
- Sørg for at `observability.enabled` forbliver `false` i begge Cloudflare-configs.

### Stadium 6 - Test og kvalitet

Minimum:

- `npm run typecheck`
- eksisterende renteberegning domain tests
- eksisterende renteberegning UI/PDF tests
- ny smoke-test for `MinProcesrenteApp`
- guard-test eller build-inspektion der sikrer, at standalone ikke importerer `AuthGate`
- guard-test der sikrer, at standalone ikke læser `stamdata`, `indstillinger` eller andre Mineo-sektioner som brugerdata
- guard-test eller build-inspektion der sikrer, at standalone ikke aktiverer PWA/file-open flow
- test der sikrer, at `Rentesatser` ikke vises i standalone
- test for at Mineos root/auth-flow fortsat er uændret

Hvis deploy/build-scripts ændres:

- lokal `npm run build:mineo`
- lokal `npm run build:minprocesrente`

---

## Risici og modforanstaltninger

| Risiko | Modforanstaltning |
|---|---|
| Standalone importerer hele Mineo via `App.tsx` | Brug separat `MinProcesrenteApp`, ikke Mineos route-array |
| Auth-gate ender i offentlig bundle | Test/grep bundlet eller statisk import-guard |
| Renteberegneren divergerer mellem siderne | Ingen kopier; genbrug samme komponenter og domænemoduler |
| PDF afhænger skjult af `stamdata` eller brugerindtastede `indstillinger` | Udtræk fælles rente-PDF-kerne og brug standalone-adapter uden disse input |
| Service worker cache konflikter mellem domæner | Deaktiver service worker/PWA for MinProcesrente i første version |
| `.eo`-flows eksponeres i MinProcesrente utilsigtet | Deaktiver file-open/save/load i `MinProcesrenteApp`; bevar dem i `MineoApp` |
| Rentesats-tab bliver eksponeret i MinProcesrente ved genbrug af `Renteberegning` | Brug smal `MinProcesrenteCalculatorPage` eller variant-prop, og test at tabben ikke renderes |
| CSS ændres for MinProcesrente og påvirker Mineo | Brug fælles styles uændret; læg MinProcesrente-specifik layout-CSS i `StandaloneCalculatorLayout`, ikke globalt |

---

## Acceptkriterier

- `mineo.dk`-build opfører sig som før, inkl. auth-gate.
- `minprocesrente.dk`-build viser kun procesrente-beregneren uden auth-gate.
- `minprocesrente.dk` viser ikke `Rentesatser`-tab, topbar, branding-header, Mineo-sidemenu eller gem/hent/slet.
- Beregning, validering, tabeller og tabelnavigation er fælles med Mineo.
- PDF-download fungerer uden brevhoved, journalnr., stamdata og brugerindtastede indstillinger.
- MinProcesrente læser/skriver kun procesrente-sidens egne brugerindtastninger.
- PWA/offline/file-open flow er ikke aktiveret for MinProcesrente.
- Ingen procesrente-beregningslogik er kopieret.
- Begge builds typechecker og bygger fra samme repo.
- Begge Cloudflare deploys kan køres fra samme GitHub push.
- Standalone introducerer ingen serverkommunikation, eksterne API'er, telemetry eller ekstern logging.
- Brugerdata forlader ikke browseren, bortset fra brugerinitieret PDF-download.

---

## Anbefalet rækkefølge for første PR

1. Tilføj `MinProcesrenteApp` og separat entrypoint uden auth, PWA og file-open.
2. Bevar Mineos eksisterende entrypoint og auth-flow.
3. Tilføj `StandaloneCalculatorLayout` til MinProcesrente uden global CSS-ændring og uden topbar/branding; `MainLayout` forbliver uændret for Mineo.
4. Monter beregningsfladen uden `Rentesatser`-tab.
5. Tilføj Vite build for MinProcesrente.
6. Tilføj smoke-/guard-tests.
7. Først derefter tilføjes Cloudflare/GitHub Actions-deploy for det nye domæne.

Denne rækkefølge minimerer risikoen for at ændre Mineos eksisterende adfærd, mens den vigtigste arkitekturbeslutning - fælles kildekode uden kloning - valideres tidligt.
