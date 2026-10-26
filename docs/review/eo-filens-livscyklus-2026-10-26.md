# Gennemgang af ændringer af en åben .eo-fil

Dato: 2026-10-26. Afgrænsning: manuel Hent/Gem, PWA-filåbning, direkte overskrivning,
filvælger og browserdownload. Beregninger og `.eo`-format er uændrede.

## Scenarier og forventet udfald

| Hændelse | Håndtering | Verifikation |
| --- | --- | --- |
| Fil slettet, flyttet, omdøbt eller mappe/drev utilgængelig før Gem | Hvis browserens handle bliver ugyldigt, kasseres koblingen, og filvælgeren åbnes; ingen teknisk alarm for forventelig adgangsfejl | Handle-/target-tests og E2E med ægte slettet browserfil |
| Ny fil oprettet på gammel placering | Indholdskontrol opdager afvigelse, hvis browseren lader håndtaget pege på den nye fil | Fingerprint- og konflikttests |
| Samme fil ændret fra andet vindue/program | Tre valg: Overskriv, Gem i en anden fil, Annuller | Target-, hook-, dialogtests og E2E for alle tre valg |
| Samme indhold, men ændret tidsstempel | Indholdet afgør konflikten; tidsstempel bruges ikke som bevis | SHA-256-reference og frisk læsning af indhold |
| Fil ændres igen mens dialog/stream åbner | Den accepterede filrevision kontrolleres igen under skrivestreamen; mismatch aborterer uden write/close | Stream-racetests |
| Sagen redigeres mens filvalg/dialog/stream åbner | Friskhedskontrol før sink og igen efter stream-open; ingen falsk gem-markering | Eksisterende stale-save-tests og ny stream-test |
| Bruger afviser/annullerer tilladelse, filvalg eller konfliktdialog | Ingen write eller ændring af sagsinput; låsen frigives | Target-, hook- og E2E-tests |
| Gem i en anden fil annulleres | Tidligere kobling bevares | Target-test |
| Gem i en anden fil vælges, men ny handle kan ikke lagres | Den gamle handle er fjernet før write; nyt filnavn kan ikke kobles til gammel fil | Target-oprydningsværn og eksisterende save-persistenstests |
| Tilladelse tilbagekaldes, fil bliver skrivebeskyttet/låst, plads slipper op | Handlingsanvisende fejl, ingen succesmarkering eller teknisk alarm for kendte filsystemfejl | Parameteriserede create/write/close-tests |
| Write/close fejler, og abort fejler også | Abort forsøges; oprindelig fejl bevares | Stream-tests |
| Fil forsvinder eller ændres under read-back | Ingen succesmarkering; adgangsfejl føres videre; ulæseligt/afvigende indhold afvises af integritetskontrollen | Save-verifikation og læsefejltests |
| Fil forsvinder/adgang ændres under manuel Hent eller PWA-Hent | Samme danske filadgangsfejl; load når ikke apply | Picker-, load- og PWA-tests |
| Ekstern fil bliver vilkårligt stor | Størrelsesgrænse kontrolleres før indhold læses til fingerprint; sikker afvisning | Fingerprint-test med ulæst oversized fil |
| Hent af fil B efter fil A, men metadata/IndexedDB/PWA-ack fejler | A's kobling invalideres før B anvendes; identiske navne/stamdata kan ikke legitimere gammel handle | Load-apply-tests inklusive rollback og storage-no-op |
| Gammel kobling kan ikke fjernes før Hent | Indlæsning afbrydes før sagsændring; udtrykkeligt godkendt af udvikleren | Load-apply-tests |
| F5 eller allerede åben session fra ældre programversion | Fingerprint bevares ved F5; manglende baseline kræver eksplicit valg før direkte overskrivning | Browsermetadata-/target-tests |
| Flere faner eller PWA-vinduer | Klientscopede handles bevares; åbnes samme fil i flere vinduer, kontrolleres indholdet uafhængigt før Gem | Klientisolations-tests og konfliktdækning |
| Duplikeret fane med kopieret sessionStorage og to identiske filer i hver sin mappe | Kopieret klient-ID kan ikke overtage en anden aktiv klients ejerskab; fanernes egne filer forbliver adskilt, selv når navn og indhold matcher | Reproduceret fejlagtig overskrivning før rettelse; E2E med window.open og to ægte handles består efter rettelse |
| Navigation væk og tilbage under fil-I/O | Scope-ejerskab beholdes indtil startet I/O er afsluttet; næste dokumentresume får nyt scope og genbinder kun egne kendte handles/requests | Identitets- og storage-livscyklustests |
| Gammel udgivelse uden ejerskabslås er stadig åben | Nye klienter bruger særskilt markerede scope-ID'er; gamle direkte-gem-handles genbruges ikke. Første Gem kræver filvalg | Godkendt af udvikleren; identitetstests |
| Ventende filåbning fra gammel udgivelse | Eksakt legacy-request bevares via en afgrænset load-alias, kopieres valideret og tilbydes med Indlæs fil/Annuller. Det gamle scope ændres aldrig | PWA-migrations- og bekræftelsestests |
| Browser uden filoverskrivnings-API | Hver Gem er fortsat ny download med eksisterende forklaring; ingen direkte overskrivning | Eksisterende fallback- og E2E-tests |
| Korrupt/ukendt .eo, afvist preflight eller apply-fejl | Eksisterende validering og atomisk apply bevarer aktiv sag; ingen formatændring | Eksisterende load-/round-trip-tests og preflight-E2E |

## Begrænsninger

Browser-E2E bruger ægte File System-handles i browserens private filsystem og erstatter kun filvælgerne.
Det kontrollerer IndexedDB-serialisering, sletning, skrivning og read-back reproducerbart. Det er ikke en
fysisk afbrydelse af et USB-drev eller en end-to-end-test af alle cloudsync-programmer. De tilsvarende
browserfejl injiceres ved I/O-grænserne i enhedstests.

Eksklusiv skrivning beskytter mod samtidige browserstreams i browsere, der understøtter denne option.
Eksterne programmer kan ændre filer efter en kontrol; web-API'et giver ingen universel atomisk
sammenlign-og-skriv-garanti mod operativsystemet. Read-back og næste Gem giver yderligere kontrol.
En senere ekstern ændring kan ikke opdages løbende uden en ny filoperation. Filens placering kan heller
ikke aflæses som en fuld sti; flytning/omdøbning følger den enkelte browsers handle-adfærd.

Grundlag: [File System Standard](https://fs.spec.whatwg.org/), især fil-låse, getFile og createWritable.

## Verifikation

- `npm run check:types`: kildekode, enhedstests, E2E og build-konfiguration.
- `npm run lint`, `npm run check:line-endings`, `npm run check:mojibake` og `git diff --check`.
- Browserforløb: 16 tests bestået på den færdige kode, inklusive Firefoxs Gem/Hent-fallback og
  native Chromium/Edge-kapabilitet. To eksisterende kapabilitetstests springes over i Firefox/WebKit,
  fordi de specifikt undersøger Chromiums native LaunchQueue. Gem-rejsen testes særskilt i Firefox.
- Desktop-screenshots af både filkonflikt og tilbud om tidligere ventende fil er visuelt inspiceret.
- Fuld Vitest-kørsel: 1.022 testfiler og 10.880 tests. 10.879 bestod; ét navnebaseret
  arkitekturværn afviste eksportnavnene på PWA-kildehenvisningen. Navnene beskrev fejlagtigt
  kun gamle requests, selv om henvisningen også bruges ved manglende Web Locks. De er omdøbt
  til deres aktuelle ansvar uden ændring af lagrede nøgler eller adfærd. Efterkontrollen af
  arkitekturværnet og de berørte moduler bestod: fem filer og 79 tests. Typekontrol og lint
  er genkørt efter omdøbningen; den fulde suite er ikke gentaget efter denne mekaniske ændring.

Hele 4×4-browsermatrixen og den samlede releasegate er ikke kørt. Kontrollen er afgrænset til de
ændrede filrejser og deres regressioner. Afhængighedsaudit er ikke kørt, da manifests og dependencies
er uændrede. E2E-kørslerne bygger selv applikationerne; der er ikke kørt et separat releasebuild.
