# Mineo robustheds- og adfærdsaudit — adfærds- og øvrige fund

Registrér ikke-crashende afvigelser, datatabsmistanke, kontraktdrift, parallel eller afvigende logik, mistænkelig beregningsadfærd og manglende eller uforudsigelig feedback. Registrér ikke en klar, forventet valideringsreaktion som fund.

## Indeks

| ID | Kort titel | Kategori | Flade | Browser/viewport | Alvor | Status | Først set |
|---|---|---|---|---|---|---|---|
| OBS-001 | Formular-blink kan måles for svagt i Safari ved stor viewport | Browserforskel / UX | SURF-001 / BASELINE-001 | Safari/WebKit 2560×1440 | Mellem | Løst 2026-08-09 | 2026-08-08 15:48 Europe/Copenhagen |
| OBS-002 | Sidemenuets toggle mangler tilgængeligt navn | UX / Andet | SURF-001 / SHELL-002 | Chrome/Edge/Firefox/WebKit 1920×1080 | Lav | Bekræftet | 2026-08-08 15:52 Europe/Copenhagen |
| OBS-003 | Datoissue navngiver ikke den synlige kontekstuelle label | Inkonsistens / UX | SURF-002 / STAM-003 | Chrome 1920×1080 | Mellem | Bekræftet | 2026-08-08 16:03 Europe/Copenhagen |
| OBS-004 | Gem er visuelt aktiv ved rejected input, men blokeres først ved klik | Falsk positiv (audit) | SURF-001/SURF-002 / STAM-004 | Chrome 1920×1080 | — | Bortfaldet 2026-08-09 (falsk positiv) | 2026-08-08 16:07 Europe/Copenhagen |
| OBS-005 | Firefox-fallback giver en synlig teknisk advarsel ved normal Gem/Hent | UX / Console-politik | SURF-001 / SHELL-003 | Firefox 1920×1080 | Mellem | Bekræftet | 2026-08-08 16:19 Europe/Copenhagen |
| OBS-006 | Differencekrav viser samme manglende beregningsdato to gange | Parallel logik / UX | SURF-004 / EET-002 | Firefox 1920×1080 | Lav | Løst 2026-08-09 | 2026-08-08 16:23 Europe/Copenhagen |
| OBS-007 | Gem giver ingen feedback ved canonical tværgående datofejl | Falsk positiv (audit) | SURF-001/SURF-002 / STAM-005 | Chrome/Edge 1920×1080 | — | Bortfaldet 2026-08-09 (falsk positiv) | 2026-08-08 16:56 Europe/Copenhagen |
| OBS-008 | Ugyldig fil ved Hent behandles som teknisk runtimefejl | Kontraktdrift / UX | SURF-003 / EO-OPLYS-005 | WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-08 17:59 Europe/Copenhagen |
| OBS-009 | Trecifret tillægstid trunkeres til to cifre uden range-issue | Dataintegritet / Kontraktdrift | SURF-008 / RENTE-002 | Chrome/Edge/Firefox/WebKit 1920×1080 | Høj | Bortfaldet 2026-08-09 (kontraktændring); afgrænsning håndhævet 2026-08-09 | 2026-08-08 18:47 Europe/Copenhagen |
| OBS-010 | Syv Indstillinger-kontroller mangler tilgængeligt navn | UX / Tilgængelighed | SURF-010 / SETTINGS-002 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-08 19:06 Europe/Copenhagen |
| OBS-011 | Om-sidens startside-toggle mangler tilgængeligt navn | UX / Tilgængelighed | SURF-011 / MINEO-002 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-08 19:15 Europe/Copenhagen |
| OBS-012 | Fire EET-valgkontroller mangler tilgængeligt navn | UX / Tilgængelighed | SURF-004 / EET-002 | Chrome/Edge/Firefox/WebKit 1920×1080; WebKit også 2560×1440 | Mellem | Bekræftet | 2026-08-08 19:23 Europe/Copenhagen |
| OBS-013 | PWA-filåbning registrerer ikke launchQueue-consumer | Kontraktdrift / Dataintegritet | SURF-012 / OPEN-002 | Chrome/Edge/Firefox/WebKit 1920×1080 | Høj | Bekræftet | 2026-08-08 20:14 Europe/Copenhagen |
| OBS-014 | Årsløn skjuler beregning og download ved stamdatafejl | Dataintegritet / Kontraktdrift / UX | SURF-007 / AAR-003 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-08 20:28 Europe/Copenhagen |
| OBS-015 | EET skjuler dokumentdownload ved stamdatafejl | Dataintegritet / Kontraktdrift / UX | SURF-004 / EET-003 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-08 20:48 Europe/Copenhagen |
| OBS-016 | EET lader dokumentdownload være aktiv ved fejl i en senere afgørelse | Falsk positiv (audit) | EDGE-003 / EET-005 | Chrome/Edge/Firefox/WebKit 1920×1080 | — | Bortfaldet 2026-08-09 (falsk positiv) | 2026-08-08 21:55 Europe/Copenhagen |
| OBS-017 | Nulstillingsdialog overtager ikke keyboardfokus | UX / Tilgængelighed / Kontraktdrift | SURF-001 / PAR-003 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-08 23:15 Europe/Copenhagen |
| OBS-018 | Nedre Fødselsdato-grænse vises som generisk indtastningsfejl | Kontraktdrift / UX | CUT-001 / STAM-008 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-09 02:19 Europe/Copenhagen |
| OBS-019 | Forsørgertabs blokerede dato-gate viser generisk downloadårsag | Kontraktdrift / UX | CUT-001 / FORS-007 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-09 02:19 Europe/Copenhagen |
| OBS-020 | Renteberegningens dato-bounds skjules af generisk download-tooltip | Kontraktdrift / UX | CUT-001 / RENTE-005 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-09 02:32 Europe/Copenhagen |
| OBS-021 | Årsløns dato-bounds skjules af generisk beregnings-tooltip | Kontraktdrift / UX | CUT-001 / AAR-011 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-09 02:32 Europe/Copenhagen |
| OBS-022 | Erstatningsopgørelsens deklarerede datogrænser håndhæves ikke | Kontraktdrift / Dataintegritet | CUT-001 / EO-007 | Chrome/Edge/Firefox/WebKit 1920×1080 | Høj | Løst 2026-08-09 | 2026-08-09 02:47 Europe/Copenhagen |
| OBS-023 | EO's AES-datofelter accepterer datoer før skadedagen | Kontraktdrift / Dataintegritet | CUT-001 / EO-008 | Chrome/Edge/Firefox/WebKit 1920×1080 | Høj | Løst 2026-08-09 | 2026-08-09 02:56 Europe/Copenhagen |
| OBS-024 | EO-tabellernes deklarerede datogrænser håndhæves ikke | Kontraktdrift / Dataintegritet | CUT-001 / EO-009 | Chrome/Edge/Firefox/WebKit 1920×1080 | Høj | Løst 2026-08-09 | 2026-08-09 02:56 Europe/Copenhagen |
| OBS-025 | Beløb over binary64-grænsen reduceres stille ved indsættelse | Dataintegritet / Kontraktdrift / Runtimefejl | CUT-003 / RENTE-006 / Årsløn-tabel / EO-Øvrige krav / EO-Lønindkomst / EO-Svie-smerte / EO-TAF | Chrome/Edge/Firefox 1920×1080; WebKit paste-gap | Høj | Løst 2026-08-09 | 2026-08-09 03:36 Europe/Copenhagen |
| OBS-026 | Fælles årsløn over binary64-grænsen udløser teknisk fejladvarsel | Dataintegritet / Kontraktdrift / Runtimefejl | CUT-003 / EET- og Forsørgertab-årsløn | Chrome/Edge/Firefox 1920×1080; WebKit paste-gap | Høj | Løst 2026-08-09 | 2026-08-09 03:53 Europe/Copenhagen |
| OBS-027 | Tab-navigation afslutter ikke draft på Satser-feltet | UX / Tilgængelighed / Kontraktdrift | SURF-009 / CUT-003 / Satser | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Løst 2026-08-09 | 2026-08-09 06:16 Europe/Copenhagen |
| OBS-028 | Firefox-teknisk advarsel blokerer Løntrin-finderens datofelt | Browserforskel / UX / Kontraktdrift | SURF-003 / PAR-003 / Løntrin-finder | Firefox 1920×1080 | Mellem | Bekræftet | 2026-08-09 06:29 Europe/Copenhagen |

### OBS-002 — Sidemenuets toggle mangler tilgængeligt navn

- Status: Bekræftet
- Kategori: UX / Andet
- Alvor: Lav
- Først set: 2026-08-08 15:52 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: ren ved start af shell-sekvensen
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: SURF-001 / SHELL-002
- Relaterede fund/spørgsmål: —

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og stå på `/mineo`.
2. Inspicér det første knap-element i sidemenuen, som folder menuen ind/ud.
3. Aktivér knappen; menuen skifter visuelt tilstand.

**Observeret adfærd**

Toggle-knappen er en synlig, fungerende `<button type="button">`, men har hverken `aria-label`, `title` eller tekstindhold. Den fremstår derfor som en navnløs knap i accessibility-træet, selv om klikhandlingen virker.

**Sammenligningsgrundlag**

Alle øvrige globale sidemenuhandlinger har synlige eller accessibility-navne (`Stamdata`, `Gem`, `Hent`, `Slet alt`, `Indstillinger`, `Om`).

**Forventningsgrundlag**

`keyboard-navigation.md` kræver forudsigelige og auditérbare tastaturkontroller, og `page-component-contract.md` kræver fælles, brugerobserverbar shell-adfærd. Kontrakterne angiver ikke den konkrete tekst, men en interaktiv knap uden navn kan ikke identificeres af en skærmlæser eller et accessibility-værktøj.

**Hvorfor det bør undersøges**

Brugere, der navigerer uden visuel ikonforståelse, kan ikke se hvad kontrollen gør. Fundet ændrer ikke den visuelle klikadfærd, men gør en global navigationskontrol uforudsigelig for en del af brugergruppen.

**Evidens**

- Kildereference: `src/components/layout/SideMenu.tsx` — første knap i sidemenuens DOM.
- Browserkontrol: accessibility snapshot viste `button` uden navn; DOM-inspektion gav `ariaLabel: null`, `title: null`, `text: ""`.
- Reproducerbarhed: 1/1 i hver af Chrome, Edge, Firefox og WebKit; handlingen kunne aktiveres og ændrede menuens tilstand.
- Andre browsere/viewports: Samme resultat i alle fire understøttede browsere ved minimumsviewporten.

### OBS-003 — Datoissue navngiver ikke den synlige kontekstuelle label

- Status: Bekræftet
- Kategori: Inkonsistens / UX
- Alvor: Mellem
- Først set: 2026-08-08 16:03 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: syntetisk session; ingen øvrige sagsdata
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: SURF-002 / STAM-003
- Relaterede fund/spørgsmål: —

**Starttilstand og reproduktion**

1. Log ind og åbn Stamdata fra en ren sag.
2. Vælg `Arbejdsulykke` i `Skadestype`.
3. Åbn `Skadedato`, skriv `31-02-2020`, og settle med Tab.
4. Skift `Skadestype` til `Erhvervssygdom`.

**Observeret adfærd**

Feltet skifter synlig label fra `Skadedato` til `Anmeldelsesdato`, men den aktive fejlvisning beholder teksten `Der er udfyldt en ugyldig værdi i feltet 'Skadedato'`. Den røde markering og rejected tekst bliver stående.

**Sammenligningsgrundlag**

På samme side viser feltet efter valget `Erhvervssygdom` den synlige label `Anmeldelsesdato`, mens fejlteksten bruger den tidligere kontekst. Ved ugyldig `Fødselsdato` navngiver feedbacken i stedet det felt, brugeren faktisk ser (`Fødselsdato`).

**Forventningsgrundlag**

`error-contract.md` kræver, at kontroltype og label kommer fra feltdescriptoren, og at felt-/datofeedback navngiver det konkrete input. `form-contract.md` kræver én feltidentitet og rent afledte issues; den afgør ikke, hvordan en kontekstuelt ændret præsentationslabel skal afspejles i den danske besked.

**Hvorfor det bør undersøges**

Brugeren får en rød fejl på et felt, der hedder `Anmeldelsesdato`, men bliver bedt om at rette `Skadedato`. Det kan gøre det uklart, hvilket input der skal rettes, især fordi beskeden ikke bruger den synlige label.

**Evidens**

- Kildereference: Stamdata-feltet med feltadressen for `stamdata.skadedato`; den synlige label brancher på skadestype.
- Browserkontrol: accessibility snapshot viste `Anmeldelsesdato` og samtidig `Fejl i indtastning` med fuld besked `... 'Skadedato'`.
- Reproducerbarhed: 5/5 sessioner (2/2 Chrome, 1/1 Edge, 1/1 Firefox og 1/1 WebKit); ingen console.error eller console.warn.
- Andre browsere/viewports: Ikke gentaget ved stor viewport.

### OBS-005 — Firefox-fallback giver en synlig teknisk advarsel ved normal Gem/Hent

- Status: Bekræftet
- Kategori: UX / Console-politik
- Alvor: Mellem
- Først set: 2026-08-08 16:19 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: syntetisk session med journalnummer `SAVE1`
- Browser/viewport: Firefox 1920×1080
- Flade/scenarie: SURF-001 / SHELL-003
- Relaterede fund/spørgsmål: —

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular i Firefox.
2. Åbn Stamdata, indtast `SAVE1` i `Journalnr.` og settle med Tab.
3. Aktivér `Gem` og lad fallback-downloadet gennemføre.
4. Aktivér `Hent`, vælg den netop downloadede `Mineo.eo`, og vælg `Overskriv`.

**Observeret adfærd**

Gem og Hent gennemføres, og `SAVE1` står fortsat i feltet efter load. Samtidig registrerer appen en synlig alert med overskriften `Teknisk advarsel registreret` og teksten om, at der er fundet en fejl i den underliggende kode. Den udløsende console-advarsel er `File System Access API ikke tilgængelig - bruger fallback download`, altså den normale Firefox-fallback for filhåndtering.

**Sammenligningsgrundlag**

Firefox er en understøttet browser i matrixen, og save/load-flowet er funktionelt gennemført uden console.error eller ekstern trafik. Advarslen optræder derfor i en normal, fungerende brugerrejse og fremstilles som en underliggende kodefejl.

**Forventningsgrundlag**

`persistence-contract.md` beskriver fallback som en legitim filhandling, og console-politikken reserverer `console.warn` til exceptionelle ikke-fatale tilstande. Det er uklart, om den synlige tekniske alert skal vises ved en forventet API-fallback.

**Hvorfor det bør undersøges**

Brugeren kan tro, at Gem eller Hent er fejlbehæftet, selv om dataflowet lykkes. På en trust-kritisk filhandling kan den misvisende fejlrammesætning skabe unødig tvivl om, hvorvidt sagen er gemt eller indlæst.

**Evidens**

- Browserkontrol: download `Mineo.eo` på 3300 bytes; Hent viste `Overskriv eksisterende data?`; efter `Overskriv` viste siden `Hentet` og bevarede `SAVE1`.
- Systemsignal: 0 console.error; den kontrollerede warning var `File System Access API ikke tilgængelig - bruger fallback download`; ingen ekstern trafik.
- Reproducerbarhed: 1/1 Firefox-session; gentagelse i øvrige browsere mangler.
- Screenshot/trace: ikke bevaret; CLI-snapshot og console-log fra sessionen er den aktuelle evidens.

### OBS-008 — Ugyldig fil ved Hent behandles som teknisk runtimefejl

- Status: Bekræftet
- Kategori: Kontraktdrift / UX
- Alvor: Mellem
- Først set: 2026-08-08 17:59 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: syntetisk sag med `eoNummer = BEFORE-INVALID-FILE`
- Browser/viewport: WebKit 1920×1080
- Flade/scenarie: SURF-003 / EO-OPLYS-005
- Relaterede fund/spørgsmål: CRASH-001

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og åbn Erstatningsopgørelse → EO oplysninger.
2. Sæt `eoNummer` til `BEFORE-INVALID-FILE` og settle feltet.
3. Aktivér `Hent` og vælg en fil med endelsen `.yml` i den synlige fallback-filvælger.

**Observeret adfærd**

Den eksisterende sag bevares, og siden viser den konkrete besked `Kunne ikke indlæse fil: Valgt fil er ikke en .eo fil`. Samtidig vises `Teknisk fejl registreret` med to fejl. Browserkonsollen indeholder både `Hent-operation fejlede` og `Hent fejlede` som `console.error`. Der blev ikke observeret datatab eller navigering væk fra sagen.

**Sammenligningsgrundlag**

Filtypen kontrolleres eksplicit i `assertLoadableEoFile`, og ugyldig filtype er derfor en forventelig brugerhandling. `persistence-contract.md` kræver en eksplicit fejl og uændret aktiv sag ved fejl, mens `error-contract.md` reserverer tekniske runtimefejl og `console.error` til uventede fejl efter en godkendt projektion. Chrome og Edge viste ved annullering af deres native filvælger ingen fejl; ugyldig fil kunne ikke uploades gennem CLI’en i de browsere.

**Forventningsgrundlag**

Den konkrete brugerbesked og uændrede sag er korrekt observeret, men den ekstra tekniske fejlregistrering og `console.error` fremstår som kontraktdrift, fordi fejlen kommer fra en forventelig filtypevalidering og ikke fra en uventet runtimefejl.

**Hvorfor det bør undersøges**

Brugeren kan tro, at Mineo eller sagen er teknisk beskadiget, selv om Hent blot afviste en fil med forkert endelse. Det gør en almindelig fejlhandling sværere at skelne fra reelle dataintegritets- eller runtimeproblemer.

**Evidens**

- Browserkontrol: WebKit viste den konkrete filfejl, teknisk fejlramme og bevarede `BEFORE-INVALID-FILE`.
- Systemsignal: to `console.error`; den ene kommer fra `loadFromFile`, den anden fra `useFileSaveLoad`.
- Reproducerbarhed: 1/1 WebKit-fallback-upload; Firefox har samme fallbackvej, men ugyldig fil er ikke gentaget efter CRASH-001.
- Andre browsere/viewports: Chrome og Edge annullerede native filvælger uden fejl; invalid-upload kunne ikke automatiseres via CLI.
- Screenshot/trace: ikke bevaret; CLI-snapshot og console-log fra sessionen er den aktuelle evidens.

### OBS-010 — Syv Indstillinger-kontroller mangler tilgængeligt navn

- Status: Bekræftet
- Kategori: UX / Tilgængelighed
- Alvor: Mellem
- Først set: 2026-08-08 19:06 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: ny sag med synligt login
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: SURF-010 / SETTINGS-002
- Relaterede fund/spørgsmål: OBS-002

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og åbn Indstillinger.
2. Inspicér de visuelt tekstmærkede afkrydsningskontroller under Standardværdier, Erstatningsopgørelse, Beregningsteknisk og Kontrol.
3. Inspicér kontrollerne semantisk eller forsøg at finde dem ved deres synlige tekst som kontrolnavn.

**Observeret adfærd**

Disse syv synlige kontroller renderes som `role=checkbox`, men uden `aria-label`, `aria-labelledby` eller andet tilgængeligt navn: `Fuld løn under ferie`, `Udkast-stempel på nye dokumenter`, `Bilagsnumre i erstatningsopgørelser`, `Tillad regulering med overenskomst, der ikke dækker hele perioden`, `Vis knap til at rapportere fejl og forbedringsønsker på indholdsbokse`, `Vis kontrolfaner på Erstatningsopgørelse-side` og `Farvemarkering af font-styles`. De kan derfor ikke findes med deres synlige label som kontrolnavn. De separat rendrede brevhoved-checkboxes på samme side har derimod tilgængelige navne.

**Sammenligningsgrundlag**

De visuelle labels står i samme række som kontrollerne, men de er ikke semantisk forbundet med de syv switches. Både side-menuens navngivne knapper og brevhoved-checkboxes kan findes med deres synlige tekst, så afvigelsen er lokal for disse Indstillinger-kontroller.

**Forventningsgrundlag**

`page-component-contract.md` og den fælles felt-/kontrolmodel kræver, at brugervendte kontroller har en entydig label og kontrolidentitet. Den synlige label alene giver ikke et tilgængeligt kontrolnavn, når den ikke er knyttet til switchen.

**Hvorfor det bør undersøges**

En bruger, der navigerer med skærmlæser eller anden semantisk tastaturstøtte, kan se eller fokusere en anonym checkbox uden at få at vide, hvilken indstilling der ændres. Det øger risikoen for utilsigtede device-lokale ændringer og gør Indstillinger mindre forudsigelig end de øvrige navngivne valgkontroller.

**Evidens**

- Browserkontrol: syv navnløse switches med de ovenstående nærliggende visuelle labels blev registreret i Chrome, Edge, Firefox og WebKit.
- Reproducerbarhed: 4/4 browsere; ingen console.error eller console.warn i de målrettede kontroller.
- Andre browsere/viewports: alle fire browsere ved 1920×1080; større viewport mangler.
- Screenshot/trace: ikke bevaret; accessibility-snapshots og DOM-attributter fra SETTINGS-002 er den aktuelle evidens.

### OBS-011 — Om-sidens startside-toggle mangler tilgængeligt navn

- Status: Bekræftet
- Kategori: UX / Tilgængelighed
- Alvor: Mellem
- Først set: 2026-08-08 19:15 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: ny sag med synligt login
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: SURF-011 / MINEO-002
- Relaterede fund/spørgsmål: OBS-002, OBS-010

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og åbn Om.
2. Find kontrollen ved den synlige tekst `Gør stamdata-siden til startside fremover`.
3. Inspicér den semantiske checkbox-kontrol.

**Observeret adfærd**

Om-sidens ene checkbox har ingen `aria-label`, `aria-labelledby` eller andet tilgængeligt navn, selv om den står direkte ved den synlige tekst. Den kan derfor ikke findes som checkbox ved den synlige label i semantisk kontrolnavigation.

**Sammenligningsgrundlag**

Kontrollen har samme lokale struktur som de syv navnløse switches i `OBS-010`; side-menuens knapper og licensknappen på samme side har derimod navne. Når togglen aktiveres, virker den observerbare startsidefunktion fortsat: efter tilstrækkelig opstartstid blev `/` routet til `/stamdata`.

**Forventningsgrundlag**

`page-component-contract.md` og den fælles kontrolmodel kræver en entydig brugerlabel og kontrolidentitet. Synlig tekst uden semantisk forbindelse til checkboxen er ikke et tilgængeligt kontrolnavn.

**Hvorfor det bør undersøges**

En bruger, der navigerer med skærmlæser eller anden semantisk tastaturstøtte, kan fokusere en anonym checkbox uden at vide, at den ændrer programmets startside. Det er særligt kritisk her, fordi ændringen først bliver tydelig ved næste normale åbning af appen.

**Evidens**

- Browserkontrol: én checkbox med `aria-label=null` blev registreret på Om i Chrome, Edge, Firefox og WebKit; den visuelle label var til stede i alle fire.
- Reproducerbarhed: 4/4 browsere; ingen console.error eller console.warn i passet.
- Andre browsere/viewports: alle fire browsere ved 1920×1080; større viewport mangler.
- Screenshot/trace: ikke bevaret; accessibility-snapshots og DOM-attributter fra MINEO-002 er den aktuelle evidens.

### OBS-012 — Fire EET-valgkontroller mangler tilgængeligt navn

- Status: Bekræftet
- Kategori: UX / Tilgængelighed
- Alvor: Mellem
- Først set: 2026-08-08 19:23 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: ny syntetisk sag med synligt login
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080; WebKit også 2560×1440
- Flade/scenarie: SURF-004 / EET-002
- Relaterede fund/spørgsmål: OBS-010, OBS-011

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og åbn Erhvervsevnetab.
2. Opret en beregningsklar afgørelse med beregningsdato, årsløn, afgørelsesdato, virkningsdato, EET-procent, afgørelsestype, kapitaliseringsdato og kapitaliseringsprocent.
3. Åbn `Løbende ydelser` og inspicér kontrollen `Medtag udvidet specifikation i PDF`.
4. Åbn `Differencekrav` og inspicér de tre kontroller `Medtag udvidet specifikation på løbende ydelser`, `Endelig EET-afgørelse kan gøre tidligere udbetalt midl. EET til endeligt med tilbagevirkende kraft` og `Indregn mer-erstatning ved forhøjet pensionsalder`.

**Observeret adfærd**

Alle fire kontroller renderes som `role=checkbox`, men uden `aria-label`, `aria-labelledby` eller andet tilgængeligt navn. De synlige tekster står separat ved siden af kontrollerne, men bliver ikke kontrolnavn i accessibility-træet. På samme Differencekrav-side har de fire bilags-checkboxes derimod kontrolnavne, og de fungerer som forventet.

**Sammenligningsgrundlag**

De fire EET-kontroller har samme navnløse struktur som kontrollerne i `OBS-010` og `OBS-011`. De navngivne bilags-checkboxes på Differencekrav viser, at navngivning ikke er en generel begrænsning for siden.

**Forventningsgrundlag**

`page-component-contract.md` og den fælles kontrolmodel kræver en entydig label og kontrolidentitet for brugervendte kontroller. Synlig tekst uden semantisk forbindelse til checkboxen er ikke et tilgængeligt kontrolnavn.

**Hvorfor det bør undersøges**

En bruger, der navigerer med skærmlæser eller anden semantisk tastaturstøtte, kan fokusere en anonym checkbox uden at vide, hvilken beregnings- eller dokumentindstilling der ændres. Det gør EET’s dokumentvalg mindre forudsigelige end de navngivne bilagsvalg på samme side.

**Evidens**

- Browserkontrol: samme fire navnløse checkbox-kontroller blev registreret i Chrome, Edge, Firefox og WebKit; WebKit blev gentaget ved både 1920×1080 og 2560×1440.
- Reproducerbarhed: 4/4 browsere; ingen console.error eller console.warn i de målrettede EET-pass.
- Andre browsere/viewports: minimumsviewport er dækket i alle fire; WebKit er desuden dækket ved stor desktop-viewport.
- Screenshot/trace: ikke bevaret; accessibility-snapshots og DOM-attributter fra EET-002 er den aktuelle evidens.

### OBS-013 — PWA-filåbning registrerer ikke launchQueue-consumer

- Status: Bekræftet
- Kategori: Kontraktdrift / Dataintegritet
- Alvor: Høj
- Først set: 2026-08-08 20:14 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: dirty ved genoptagelse; kun auditdokumenter og midlertidige audit-artefakter ændret
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: SURF-012 / OPEN-002
- Relaterede fund/spørgsmål: —

**Starttilstand og reproduktion**

1. Start en ny browserkontekst ved 1920×1080.
2. Injicér før appens første script et `window.launchQueue`-objekt med den standardiserede `setConsumer`-metode; dette simulerer kun browserens PWA-launch-surface og omgår ikke login eller browser-storage.
3. Log ind gennem den synlige loginformular.
4. Kontrollér, om Mineo registrerer en consumer, og åbn derefter `/open`.

**Observeret adfærd**

Mineo kaldte ikke `setConsumer` i nogen af de fire browsere (`consumerReady=false`). `/open` viste kun fallback-fladen. `Færdiggør indlæsningen` gav den forventede eksplicitte besked om, at filen ikke kunne findes, fordi ingen pending request var oprettet. En simuleret queued `.eo`-fil kunne derfor ikke afleveres til Mineos load-flow.

**Sammenligningsgrundlag**

`src/utils/pwaLaunchQueue.ts` eksporterer `setupPwaLaunchQueueConsumer`, og `usePwaLaunchQueue`/`OpenEo` indeholder den efterfølgende behandling. Men runtime-søgning viste kun setup-funktionen i selve utility-modulet og testfilerne; den kaldes ikke fra `src/main.tsx`, `bootstrapClientApp` eller en anden runtime-entry. `page-component-contract.md` beskriver samtidig, at app-entryen leverer PWA-opstart.

**Forventningsgrundlag**

`app-shell-contract.md` og `page-component-contract.md` beskriver PWA-filåbning som en del af Mineos app-shell-opstart, mens `persistence-contract.md` har særskilte krav til PWA-initieret load. `/open`-fallbacken forudsætter tilsvarende, at en pending request kan være produceret af launch queue.

**Hvorfor det bør undersøges**

Hvis brugeren åbner en `.eo`-fil gennem en installeret PWA eller operativsystemets filassociation, kan appen starte uden at indlæse filen. Den synlige `/open`-side kan derefter kun fortælle, at filen ikke blev fundet, selv om filåbningen var den handling, der startede appen. Det gør den primære PWA-filåbningsrejse utilgængelig og kan efterlade brugeren i tvivl om, hvorvidt sagen blev indlæst.

**Evidens**

- Kildereference: `src/utils/pwaLaunchQueue.ts:125-158` definerer producer-setup; `rg` fandt ingen runtime-callsite; `src/main.tsx` leverer kun service-worker-/install-prompt-setup til `bootstrapClientApp`.
- Browserkontrol: `setConsumer` blev ikke kaldt i Chrome, Edge, Firefox eller WebKit; alle fire viste `/open`-fallback og samme eksplicitte no-file-besked; ingen console.error, console.warn eller requestfailed.
- Reproducerbarhed: 4/4 browsere.
- Andre browsere/viewports: Minimumsviewport dækket; større viewport mangler for dette flow.
- Screenshot: `.playwright-cli/pwa-open-chrome.png` viser fallback-fladen efter login og retry-beskeden.

### OBS-014 — Årsløn skjuler beregning og download ved stamdatafejl

- Status: Bekræftet
- Kategori: Dataintegritet / Kontraktdrift / UX
- Alvor: Mellem
- Først set: 2026-08-08 20:28 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: dirty ved genoptagelse; kun auditdokumenter og midlertidige audit-artefakter ændret
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: SURF-007 / AAR-003
- Relaterede fund/spørgsmål: OBS-004, OBS-007

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og udfyld Stamdata med `skadedato=01-01-2020`.
2. Åbn Årslønsberegning, udfyld en gyldig månedstabel med måned `01`, år `2025` og løn `30.000 kr.`.
3. Kontrollér den aktive beregning og downloadknap.
4. Gå tilbage til Stamdata, skriv den ugyldige dato `31-02-2020`, og settle med Tab.
5. Gå tilbage til Årslønsberegning.

**Observeret adfærd**

Den ugyldige skadedato står som afsluttet rejected input med `aria-invalid=true` på Stamdata. På Årslønsberegning forsvinder beregningsresultatet og alle dokument-downloadknapper helt fra DOM'en; der står ingen disabled downloadknap, tooltip eller lokal forklaring på siden. Løntabellen og den indtastede løn står fortsat synligt. Når skadedatoen gendannes til `01-01-2020`, kommer beregning og aktiv downloadknap tilbage.

**Sammenligningsgrundlag**

Varige mén og Forsørgertab viser ved tilsvarende upstream-mangler fortsat deres beregningsflade med et synligt disabled dokumentikon og konkret gateårsag. Årsløns downloadgate returnerer på kodeniveau en stamdata-blokering, men den synlige Årsløn-side renderer ingen disabled affordance, når den samlede projektion ikke længere kan danne resultatet.

**Forventningsgrundlag**

`document-output-contract.md` §A2 kræver, at blokeret download er både visuelt og funktionelt disabled, og at gateårsagen er auditerbar. `page-component-contract.md`/`error-contract.md` kræver brugerrettet fejlfeedback ved en downstream-blokering. Årslønskontrakten kræver samtidig, at stamdata er en autoriseret dokumentdependency.

**Hvorfor det bør undersøges**

Brugeren kan se en udfyldt løntabel, men mister både resultat og dokumenthandling uden en forklaring på Årslønsiden. Det gør det uklart, om indtastningen er gået tabt, om beregningen er midlertidig, eller hvilket Stamdatafelt der skal rettes. Fail-closed er opfyldt for selve downloadet, men feedbacken og den synlige gate er ikke auditérbar på den side, hvor brugeren forventer handlingen.

**Evidens**

- Kildereference: `src/domain/aarsloen/aarsloenDownloadGate.ts:29-72` returnerer en stamdata-blokering; `src/components/pages/aarsloen/AarsloenBeregningSection.tsx` renderer kun downloadknappen i beregningsgrene, der ikke nås ved den blokerede projektion.
- Browserkontrol: gyldig tilstand havde 1 aktiv `Download som …`-knap; efter `31-02-2020` havde alle fire browsere 0 downloadknapper, mens tabellen stadig viste `30.000,00 kr.`; Stamdatafeltet havde `aria-invalid=true`.
- Reproducerbarhed: 4/4 browsere; ingen console.error, console.warn eller requestfailed.
- Screenshot: `.playwright-cli/edge-001-aarsloen-invalid-chrome.png` viser tabellen og den manglende beregnings-/downloadflade.

### OBS-015 — EET skjuler dokumentdownload ved stamdatafejl

- Status: Bekræftet
- Kategori: Dataintegritet / Kontraktdrift / UX
- Alvor: Mellem
- Først set: 2026-08-08 20:48 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: dirty ved genoptagelse; kun auditdokumenter og midlertidige audit-artefakter ændret
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: SURF-004 / EET-003
- Relaterede fund/spørgsmål: OBS-014

**Starttilstand og reproduktion**

1. Indlæs den syntetiske `.eo`-sag gennem den synlige Hent-handling og log ind gennem loginformularen.
2. Fjern den efterfølgende ikke-beregningsklare ASL-række, så sagen har én endelig afgørelse og en beregningsklar EET-kontrast.
3. Kontrollér EET-fanerne og en faktisk PDF-download.
4. Gå til Stamdata, skriv den ugyldige dato `31-02-2020`, og settle med Tab.
5. Gå til EET-fanerne igen; gentag med Delete/rydning af skadedatoen og gendan derefter `01-01-2020`.

**Observeret adfærd**

Ved beregningsklar Stamdata viste EET resultater og downloadhandlinger. Efter den afsluttede rejected skadedato viste fanerne den konkrete blokering `Der er udfyldt en ugyldig værdi i feltet 'Skadedato'`, men beregningsfladen og alle EET-dokumentknapper var fjernet fra DOM'en. Ved rydning stod `Skadedato er ikke udfyldt`, fortsat uden downloadknap. Gendannelse af skadedatoen gendannede resultat og downloadknap. Samme synlige forløb blev gentaget i Chrome, Edge, Firefox og WebKit.

**Sammenligningsgrundlag**

Renteberegning viser ved den samme rejected upstream-skadedato den beregnede rente og en synlig disabled række-/oversigtsknap. Varige mén og Forsørgertab viser tilsvarende en synlig disabled dokumenthandling ved downstream-blokering. EET-komponenterne renderer derimod hver deres `DocumentDownloadButton` inde i en `!hasBlockingErrors`-gren (`EetLoebendeYdelserTab`, `EetKapitaliseringTab`, `EetEfterEalTab` og `EetDifferencekravTab`), så knappen ikke eksisterer, når `EetIssuesBox` viser blokeringen.

**Forventningsgrundlag**

`document-output-contract.md` §A2 kræver, at en blokeret downloadknap er både visuelt og funktionelt disabled, og at gateårsagen er auditerbar. `eet-snapshot-contract.md` §3 kræver en eksplicit blokerende issue og `computation: null`; det forklarer, at resultatet skal lukkes, men ikke at den brugerrettede dokumenthandling skal forsvinde.

**Hvorfor det bør undersøges**

Fail-closed er opfyldt for selve PDF-outputtet, men brugeren kan ikke se den dokumenthandling, der er blokeret, eller holde markøren over dens årsag. På EET-siden bliver det derfor uklart, om dokumentet er midlertidigt utilgængeligt, om det er en fejl i sagen, eller hvor gate-statussen kan kontrolleres. Det er samme brugerrettede afvigelse som `OBS-014`, men på fire EET-outputflader.

**Evidens**

- Kildereference: `src/components/pages/erhvervsevnetab/EetLoebendeYdelserTab.tsx`, `EetKapitaliseringTab.tsx`, `EetEfterEalTab.tsx` og `EetDifferencekravTab.tsx` renderer downloadknappen kun i grene med `!hasBlockingErrors`.
- Browserkontrol: alle fire browsere viste EET-blokeringen og 0 downloadknapper efter rejected skadedato; rydning gav samme gate uden knapper; genoprettelse gav EAL-resultat og 1 downloadknap på den aktive fane. Chrome viste i kontrast alle fire aktive PDF-knapper og downloadede fire dokumenter.
- Reproducerbarhed: 4/4 browsere; ingen nye console.error, console.warn eller requestfailed ud over den allerede kendte fallback-warning i Firefox/WebKit.
- Screenshot: `.playwright-cli/edge-001-eet-invalid-chrome.png` viser EET-blokeringen uden dokumenthandling.

### OBS-017 — Nulstillingsdialog overtager ikke keyboardfokus

- Status: Bekræftet
- Kategori: UX / Tilgængelighed / Kontraktdrift
- Alvor: Mellem
- Først set: 2026-08-08 23:15 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: dirty ved genoptagelse; kun auditdokumenter og midlertidige audit-artefakter ændret
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: SURF-001 / PAR-003
- Relaterede fund/spørgsmål: —

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og åbn Renteberegning.
2. Indtast `10.000` i en beløbscelle og afslut feltet, så `Slet alle indtastninger` bliver aktiv.
3. Fokuser et underliggende felt og aktivér `Slet alle indtastninger`.
4. Tryk `Tab` og derefter `Escape` uden at klikke på dialogens knapper.

**Observeret adfærd**

Dialogen med `Annuller` og `Ja, slet` vises med `aria-modal="true"`, men fokus flyttes ikke fra feltet bag dialogen. `Tab` flytter fokus videre til endnu et underliggende felt; ingen af dialogens knapper bliver fokuseret. `Escape` lukker ikke dialogen. Klik på `Annuller` lukker dialogen og bevarer inputtet.

**Sammenligningsgrundlag**

Dialogens egen knaprække er synlig og klikbar, og klik på `Annuller` fungerer. Den genbrugelige `ConfirmationDialog` har samtidig en særlig `preserveExternalFocus`-gren for åbne felteditorer. Den aktuelle brugerrejse gør derfor den synlige annullering og bekræftelse utilgængelig gennem almindelig Tab/Enter-navigation, når fokus ligger i feltfladen.

**Forventningsgrundlag**

`keyboard-navigation.md` kræver forudsigelig tastaturnavigation og beskriver, at popup-/overlay-adfærd skal følge den konkrete widgets lukkeadfærd. Overlay-noten kræver desuden, at popupens interne focus-trap stopper fokuslæk til siden bagved. `page-component-contract.md` placerer globale og lokale dialoger i den fælles brugerobserverbare UI-adfærd. Det bør afklares, hvordan `preserveExternalFocus` skal forenes med dialogens keyboardadgang.

**Hvorfor det bør undersøges**

En bruger, der står i et felt og åbner den destruktive nulstilling, kan ikke nå `Annuller` eller `Ja, slet` med Tab/Enter og kan ikke afbryde med Escape. Det gør en kritisk handling uforudsigelig for tastaturbrugere og kan efterlade dialogen fastlåst, selv om musseklik virker.

**Evidens**

- Kildereference: `src/components/pages/renteberegning/RenteberegningTab.tsx:310-329` aktiverer `ConfirmationDialog` med `preserveExternalFocus`; `src/components/ui/ConfirmationDialog.tsx:50-57` deaktiverer auto-/enforce-/restore-focus i denne gren.
- Browserkontrol: Chrome, Edge, Firefox og WebKit viste `dialog=true` med aktivt underliggende `INPUT`; efter `Tab` var fokus fortsat i et underliggende input, dialogknapperne var ikke aktive; efter `Escape` var dialogen fortsat synlig.
- Reproducerbarhed: 4/4 browsere ved 1920×1080.
- Screenshot: `.playwright-cli/par-003-chrome-reset-dialog.png` viser dialogen med det fokuserede underliggende datofelt bag overlayet.

### OBS-018 — Nedre Fødselsdato-grænse vises som generisk indtastningsfejl

> **Ikke løst 2026-08-09 — anden årsag end OBS-022–024.** Undersøgt i forbindelse med datogrænse-rettelsen og
> afgrænset derfra: `31-12-1899` når ALDRIG frem til en bounds-validator. Året ligger uden for `ISODateString`
> selv (`isISODateString` afviser år uden for 1900..2100), så feltets codec afviser værdien som `format` —
> og `format` viser pr. kontrakt (§4) den generiske «Fejl i indtastning». Feltets nedre grænse ER håndhævet;
> den er blot uopnåelig, fordi det repræsenterbare domæne stopper samme sted. En rettelse skal ændre, hvordan
> ikke-repræsenterbare årstal præsenteres, ikke datogrænserne. Bevaret som selvstændigt fund.

- Status: Bekræftet
- Kategori: Kontraktdrift / UX
- Alvor: Mellem
- Først set: 2026-08-09 02:19 Europe/Copenhagen
- Commit/build: `bc503c06b31c9bb63e077eb3806baae92544892b` / `2026.08.1243.bc503c0`
- Dirty-state: dirty ved genoptagelse; kun auditdokumenter ændret
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: CUT-001 / STAM-008
- Relaterede fund/spørgsmål: —

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og åbn Stamdata.
2. Sæt Fødselsdato til den repræsenterbare værdi `31-12-1899`, som ligger én dag før den deklarerede nedre grænse `01-01-1900`.
3. Afslut feltet med Tab og hold markøren over feltet.

**Observeret adfærd**

Feltet beholder den indtastede tekst og markeres rødt i alle fire browsere, men tooltippen og den visuelt skjulte fejltekst er den generiske `Fejl i indtastning` / `Der er udfyldt en ugyldig værdi i feltet 'Fødselsdato'`. Den konkrete nedre grænse `01-01-1900` vises ikke.

**Sammenligningsgrundlag**

Stamdata-kronologifejl og øvre Skadedato-bounds viser konkrete modgående datoer eller `Datoen er efter dags dato (09-08-2026)`. Varige mén og Forsørgertab viser tilsvarende konkrete datointervaller for bounds-fejl.

**Forventningsgrundlag**

`date-contract.md` deklarerer Fødselsdatoens interval `01-01-1900` til dags dato. `error-contract.md` §4 kræver, at bounds-/range-tooltips viser den fulde konkrete besked, og `input-field-behavior-contract.md` §2.1 kræver konkret feedback for datogrænser.

**Hvorfor det bør undersøges**

Brugeren får ingen information om, hvilken dato der er tidligst tilladt, selv om fejlen skyldes en kendt grænse og kan rettes direkte ud fra den manglende information.

**Evidens**

- Browserkontrol: alle fire browsere viste `31-12-1899`, `aria-invalid=true` og generisk tooltip ved 1920×1080.
- Reproducerbarhed: 4/4 browsere; ingen produkt-console.error, console.warn eller requestfailed.
- Screenshot/trace: snapshots `.playwright-cli/page-2026-08-09T00-19-01-244Z.yml` og tilsvarende Edge/Firefox/WebKit snapshots.

### OBS-019 — Forsørgertabs blokerede dato-gate viser generisk downloadårsag

> **Ikke løst 2026-08-09 — anden årsag end OBS-022–024.** Undersøgt sammen med datogrænse-rettelsen og
> afgrænset derfra: FELTET viser allerede den konkrete bounds-tekst, og gør det fortsat. Fundet handler om,
> at DOWNLOADKNAPPENS tooltip reducerer enhver rød feltfejl til gate-kindens generiske tekst («Fejl i
> indtastning»). Det er et spørgsmål om, hvad en blokeret handling skal fortælle, ikke om grænserne
> håndhæves. Samme mønster som OBS-020 og OBS-021. Bevaret som selvstændigt fund.

- Status: Bekræftet
- Kategori: Kontraktdrift / UX
- Alvor: Mellem
- Først set: 2026-08-09 02:19 Europe/Copenhagen
- Commit/build: `bc503c06b31c9bb63e077eb3806baae92544892b` / `2026.08.1243.bc503c0`
- Dirty-state: dirty ved genoptagelse; kun auditdokumenter ændret
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080; alle fire kontrolleret ved 2560×1440 i gyldig kontrast
- Flade/scenarie: CUT-001 / FORS-007
- Relaterede fund/spørgsmål: —

**Starttilstand og reproduktion**

1. Brug Stamdata med Skadedato `01-01-2020`.
2. Åbn Forsørgertab og sæt Startdato for ASL-ydelse til `01-01-2020`.
3. Sæt Beregningsdato til `31-12-2019`, så der ikke findes en gyldig dato mellem den afledte nedre og øvre grænse.
4. Hold markøren over Beregningsdato og den deaktiverede downloadkontrol.

**Observeret adfærd**

Beregningsdato viser den konkrete bounds-tekst `Dato skal være mellem 01-01-2020 og 31-12-2026`. Startdato-feltet viser korrekt, at der ingen gyldig dato findes, og navngiver `Skadedato og Beregningsdato`. Den deaktiverede `Download specifikation` viser derimod kun den generiske årsag `Fejl i indtastning`.

**Sammenligningsgrundlag**

Varige mén viser den konkrete bounds-tekst direkte på den deaktiverede dokumentknap ved ugyldig Beregningsdato. Forsørgertabs egen Beregningsdato viser også den fulde konkrete tekst, men downloadkontrollen reducerer den til generisk tekst.

**Forventningsgrundlag**

`error-contract.md` §4 og §5 kræver, at dokumentrelevante bounds-/rule-issues bevarer den konkrete besked i download-tooltippen, mens `document-output-contract.md` §A2 kræver en auditerbar gateårsag.

**Hvorfor det bør undersøges**

Når download er blokeret af et umuligt datointerval, kan brugeren ikke se den konkrete årsag fra den handling, der er blokeret. Det gør den ellers korrekte feltfeedback sværere at finde og skaber forskel mellem domænernes gates.

**Evidens**

- Browserkontrol: Chrome, Edge, Firefox og WebKit viste samme kombination af konkrete feltissues og generisk disabled downloadkontrol ved 1920×1080.
- Reproducerbarhed: 4/4 browsere; ingen produkt-console.error, console.warn eller requestfailed.
- Viewportkontrast: alle fire viste samme gyldige max-bound-kontrast ved 2560×1440 uden layoutbrud.
- Screenshot/trace: Chrome snapshot `.playwright-cli/page-2026-08-09T00-17-49-242Z.yml` viser begge konkrete felttekster og den generiske `Fejl i indtastning` på downloadkontrollen.

### OBS-020 — Renteberegningens dato-bounds skjules af generisk download-tooltip

> **Ikke løst 2026-08-09 — anden årsag end OBS-022–024.** Samme mønster som OBS-019: Renteberegningens
> datofelter håndhæver deres grænser og viser den konkrete tekst, også efter datogrænse-rettelsen. Fundet
> angår download-tooltippens generiske gate-tekst. Bevaret som selvstændigt fund.

- Status: Bekræftet
- Kategori: Kontraktdrift / UX
- Alvor: Mellem
- Først set: 2026-08-09 02:32 Europe/Copenhagen
- Commit/build: `bc503c06b31c9bb63e077eb3806baae92544892b` / `2026.08.1243.bc503c0`
- Dirty-state: dirty ved genoptagelse; kun auditdokumenter ændret
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: CUT-001 / RENTE-005
- Relaterede fund/spørgsmål: OBS-019

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular og åbn Renteberegning.
2. Sæt en række til `1.000,00 kr.` og `Renter fra=31-12-2031`.
3. Sæt Beregningsdato til `01-01-2032`, én dag efter den deklarerede øvre grænse `31-12-2031`.
4. Hold markøren over den deaktiverede `Download samlet oversigt`.

**Observeret adfærd**

Beregningsdato viser den konkrete bounds-tekst `Dato skal være mellem 01-01-2005 og 31-12-2031`. Den deaktiverede downloadkontrol viser kun `Indtastning mangler`. Samme generic gate-tekst blev observeret, når en gyldig Beregningsdato `01-01-2020` blev kombineret med en ugyldig `Renter fra=02-01-2020`.

**Sammenligningsgrundlag**

Renter fra-feltet viser selv den konkrete dynamiske grænse `Dato skal være mellem 01-01-2005 og 01-01-2020`, mens den samlede downloadkontrol ikke viderefører bounds-oplysningen. Den statiske gate-kode klassificerer dato-/række-fejlen som `invalid-input`, og Renteberegning-fladen anvender desuden den universelle download-tooltip.

**Forventningsgrundlag**

`error-contract.md` §5 kræver, at bounds-/rule-issues bevarer den fulde konkrete besked i download-tooltippen. `document-output-contract.md` §A5 fastslår, at den deaktiverede knaps tooltip er gate-blokeringens eneste brugerkanal og skal bære årsagen.

**Hvorfor det bør undersøges**

Når brugeren går direkte til den blokerede downloadhandling, mangler den konkrete øvre eller dynamiske grænse, selv om den allerede er kendt og vist på feltet. Det gør den samme datofejl mindre handlingsanvisende end feltet alene.

**Evidens**

- Browserkontrol: Chrome, Edge, Firefox og WebKit viste samme accept af `01-01-2005`/`31-12-2031` og samme afvisning/gate ved de ugyldige datoer.
- Reproducerbarhed: 4/4 browsere; ingen produkt-console.error, console.warn eller requestfailed.
- Screenshot/trace: Chrome snapshots `.playwright-cli/page-2026-08-09T00-26-28-370Z.yml` og `.playwright-cli/page-2026-08-09T00-26-53-820Z.yml`.

### OBS-021 — Årsløns dato-bounds skjules af generisk beregnings-tooltip

> **Ikke løst 2026-08-09 — anden årsag end OBS-022–024.** Samme mønster som OBS-019 og OBS-020: Årsløns
> datoceller håndhæver deres grænser og viser den konkrete tekst. Fundet angår beregnings-/download-
> tooltippens generiske gate-tekst. Bevaret som selvstændigt fund.

- Status: Bekræftet
- Kategori: Kontraktdrift / UX
- Alvor: Mellem
- Først set: 2026-08-09 02:32 Europe/Copenhagen
- Commit/build: `bc503c06b31c9bb63e077eb3806baae92544892b` / `2026.08.1243.bc503c0`
- Dirty-state: dirty ved genoptagelse; kun auditdokumenter ændret
- Browser/viewport: Chrome/Edge/Firefox/WebKit 1920×1080
- Flade/scenarie: CUT-001 / AAR-011
- Relaterede fund/spørgsmål: OBS-019

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular, åbn Årslønsberegning og vælg `Dato`.
2. Opret en række med `Dato fra=31-12-2026`, `Dato til=31-12-2026` og `30.000,00 kr.`.
3. Sæt `Dato til` til `01-01-2027`, én dag efter den deklarerede øvre grænse.
4. Hold markøren over den deaktiverede beregnings-/downloadkontrol.

**Observeret adfærd**

`Dato til` viser den konkrete bounds-tekst `Dato skal være mellem 31-12-2026 og 31-12-2026`. Ved omvendt kronologi (`Dato fra=02-01-2020`, `Dato til=01-01-2020`) viser begge felter den konkrete tekst `Til-dato skal være efter fra-dato`. Den deaktiverede beregnings-/downloadkontrol viser i begge tilfælde kun `Fejl i indtastning`.

**Sammenligningsgrundlag**

Årslønsfeltet og den fælles datodescriptor viser den konkrete bounds-/regelbesked, men dokumentgaten reducerer hele tabelvalideringsfejlen til den universelle `invalid-input`-tekst. Kodeinventaret viser, at `aarsloenDownloadGate` har den konkrete feltissue tilgængelig i projektionen, men returnerer en generisk tabelvalideringsårsag.

**Forventningsgrundlag**

`error-contract.md` §5 kræver, at bounds-/rule-issues bevarer den fulde konkrete besked i download-tooltippen. `document-output-contract.md` §A5 fastslår, at den deaktiverede knaps tooltip er gate-blokeringens eneste brugerkanal og skal bære årsagen.

**Hvorfor det bør undersøges**

Ved en ugyldig periode kan brugeren se den nødvendige forklaring ved felterne, men ikke fra den handling, der er blokeret. Det skaber en gentagen forskel mellem feltets kendte datogrænse og beregningsgaten.

**Evidens**

- Browserkontrol: Chrome viste detaljeret max-bound og omvendt kronologi; Edge, Firefox og WebKit gentog max-bound og omvendt kronologi med samme `aria-invalid=true` på begge felter.
- Reproducerbarhed: 4/4 browsere; ingen produkt-console.error, console.warn eller requestfailed.
- Screenshot/trace: Chrome snapshots `.playwright-cli/page-2026-08-09T00-30-03-247Z.yml` og `.playwright-cli/page-2026-08-09T00-30-27-670Z.yml`.

### OBS-028 — Firefox-teknisk advarsel blokerer Løntrin-finderens datofelt

- Status: Bekræftet
- Kategori: Browserforskel / UX / Kontraktdrift
- Alvor: Mellem
- Først set: 2026-08-09 06:29 Europe/Copenhagen
- Commit/build: `bc503c06b31c9bb63e077eb3806baae92544892b` / `2026.08.1243.bc503c0`
- Dirty-state: dirty under audit; kun auditdokumenter ændret
- Browser/viewport: Firefox 1920×1080
- Flade/scenarie: SURF-003 / PAR-003 / Lønindkomst → Find løntrin
- Relaterede fund/spørgsmål: OBS-005

**Starttilstand og reproduktion**

1. Log ind gennem den synlige loginformular i Firefox og behold den normale synlige `Teknisk advarsel registreret` fra fallback-flowet.
2. På Erstatningsopgørelse → Lønindkomst vælges `Overenskomst`, `KL-overenskomsten` og `Overenskomst` som beregningsgrundlag.
3. Åbn `Find løntrin`, afslut beløbsfeltet med `700000`, og forsøg at klikke i overlayets datofelt.

**Observeret adfærd**

Klikket på overlayets synlige datofelt kunne ikke gennemføres. Playwrights klikforsøg timeoutede efter 30 sekunder, fordi den synlige tekniske advarsel lå ovenpå og interceptede pointer events fra datofeltet. Beløbsfeltet var allerede udfyldt med `700.000,00`, men datoen kunne ikke indtastes, og overlayets `Beregn` kunne derfor ikke nås gennem den normale klikrejse.

Efter klik på advarslens `Skjul` forsvandt blokeringen. Datoen `01-01-2020` kunne indtastes, `Beregn` viste resultater i overlayet, og dialogen kunne lukkes normalt.

**Sammenligningsgrundlag**

`OBS-005` registrerer, at Firefox-fallbacken viser en teknisk advarsel under normal brug. Advarslens synlige tekst siger samtidig, at brugeren kan fortsætte med at bruge programmet som hidtil. I Løntrin-finder-overlayet overlapper advarslen imidlertid et nødvendigt input og gør den konkrete brugerrejse umulig, indtil advarslen skjules.

**Forventningsgrundlag**

En synlig teknisk advarsel må ikke forhindre interaktion med et åbent page-lokalt overlay, hvis den samtidig kommunikerer, at brugeren kan fortsætte. Hvis advarslen bevidst skal blokere, skal den observerbare adfærd og brugerbesked være konsistent med det.

**Hvorfor det bør undersøges**

En Firefox-bruger kan åbne Løntrin-finder, men kan ikke udfylde datoen eller beregne, før brugeren selv opdager og skjuler en separat teknisk advarsel. Det gør overlayet tilsyneladende defekt og kobler en allerede kendt fallback-advarsel til en ny, urelateret brugerrejse.

**Evidens**

- Firefox: klik på overlayets `dd-mm-åååå`-felt timeoutede med pointer-event-interception fra `Teknisk advarsel registreret`.
- Efter `Skjul`: `01-01-2020` og `Beregn` gennemførte, og overlayet viste `Nærmeste lønsatser`.
- Firefox-konsol: 0 `console.error` og 0 `console.warn`; problemet var synlig overlay-interception, ikke en ny runtimefejl.
- Kildereference: `src/components/pages/erstatningsopgoerelse/shared/LoentrinFinderOverlay.tsx`, `OBS-005`.

## Postskabelon

### OBS-NNN — Kort, observerbar titel

- Status: Ny / Bekræftet / Ustabil / Dublet / Kræver afklaring
- Kategori: Inkonsistens / Dataintegritet / Kontraktdrift / Parallel logik / UX / Beregningsobservation / Browserforskel / Andet
- Alvor: Blokerende / Høj / Mellem / Lav
- Først set: YYYY-MM-DD HH:mm Europe/Copenhagen
- Commit/build: —
- Dirty-state: —
- Browser/viewport: —
- Flade/scenarie: SURF-/EDGE-/CUT-id
- Relaterede fund/spørgsmål: —

**Starttilstand og reproduktion**

1. …

**Observeret adfærd**

Beskriv kun det konkrete, observerbare resultat og eventuelle usynlige, men registrerede systemssignaler.

**Sammenligningsgrundlag**

Angiv den anden flade, kontrakt, schema-/kodegren, implementationssted, browser eller nærliggende værdi, der opfører sig anderledes.

**Forventningsgrundlag**

Angiv den kontrakt eller entydige kodeadfærd, som scenariet sammenholdes med. Hvis korrekt adfærd ikke kan udledes, link et `Q-NNN` i `QUESTIONS.md`.

**Hvorfor det bør undersøges**

Beskriv risikoen eller det nødvendige bruger-/udviklervalg uden at foreslå en kodeændring eller afgøre en juridisk/beregningsteknisk regel.

**Evidens**

- Screenshot/trace/kildereference: —
- Reproducerbarhed: —
- Andre browsere/viewports: —
