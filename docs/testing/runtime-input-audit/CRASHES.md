# Mineo robustheds- og adfærdsaudit — runtime- og systemfund

Kun uventede systemsignaler registreres her. Forventet feltvalidering uden systemsignal hører ikke til. Usynlige systemsignaler registreres også, selv om appen tilsyneladende fortsætter.

## Indeks

| ID | Kort titel | Flade | Browser/viewport | Signal | Reproduktion | Alvor | Status | Først set |
|---|---|---|---|---|---|---|---|---|
| CRASH-001 | Firefox-Hent kaster ved oprydning af filvælger | SURF-001 / SURF-003 / SURF-009 / SURF-012 | Firefox 1920×1080 | `NotFoundError: Node.removeChild` i `selectFile` | 6/6 | Høj | Bekræftet i Playwright CLI; real brugerfilvælger uafklaret | 2026-08-08 17:51 Europe/Copenhagen |

## Postskabelon

### CRASH-NNN — Kort, observerbar titel

- Status: Ny / Bekræftet / Ustabil / Dublet
- Alvor: Blokerende / Høj / Mellem / Lav
- Først set: YYYY-MM-DD HH:mm Europe/Copenhagen
- Commit/build: —
- Dirty-state: —
- Browser/viewport: —
- Flade/scenarie: SURF-/EDGE-/CUT-id
- Relaterede fund/spørgsmål: —

**Starttilstand**

Beskriv ren sag eller alle nødvendige syntetiske værdier.

**Minimal reproduktion**

1. Log ind gennem den synlige loginformular.
2. …

**Udløsende input og settle**

- Felt/handling: —
- Præcis værdi: —
- Metode: typing / paste / dropdown / toggle / tastatur / navigation
- Settle: blur / Enter / Tab / navigation / straks

**Observeret systemsignal**

- Første signal: —
- Synlig adfærd: —
- Fejltekst: —
- Relevant stacktop: —
- Console/pageerror/rejection: —

**Reproducerbarhed og kontrast**

- Rate: 0/0
- Gentaget fra ren tilstand: —
- Nærmeste ikke-fejlende kontrast: —
- Andre browsere/viewports: —

**Påvirkning og rækkevidde**

Beskriv konkret brugerens tabte funktion eller datarisiko uden løsningsforslag.

**Evidens**

- Screenshot/trace: —
- Supplerende noter: —

### CRASH-001 — Firefox-Hent kaster ved oprydning af filvælger

- Status: Bekræftet i Playwright CLI; real brugerfilvælger uafklaret
- Alvor: Høj
- Først set: 2026-08-08 17:51 Europe/Copenhagen
- Commit/build: `b3f5e279adf8` / `2026.08.1237.b3f5e27`
- Dirty-state: ren efter eksplicit `Slet alt` ved anden gentagelse
- Browser/viewport: Firefox 1920×1080
- Flade/scenarie: SURF-001 / SURF-003 / SURF-009 / SURF-012 / EO-OPLYS-004 / EO-OPLYS-007 / SATSER-002
- Relaterede fund/spørgsmål: OBS-005

**Starttilstand**

En Firefox-session med synligt login. Der blev først gemt en gyldig sag med `eoNummer = ROUNDTRIP-EO-001` og ledsagetekst `Roundtrip`, så der fandtes en reel `.eo`-fil til Hent-flowet. Ved den tredje gentagelse blev en gyldig `.eo`-fil gemt fra Satser med `aargang = 2005`, hvorefter den aktive værdi blev ændret til 2026 før Hent. I en senere gentagelse blev en audit-genereret, krypteret `.eo`-fil med delvis preflight valgt tre gange.

**Minimal reproduktion**

1. Log ind gennem den synlige loginformular.
2. Aktivér `Hent`.
3. Vælg en gyldig eller preflight-udløsende `.eo`-fil gennem den synlige filvælger; i Playwright CLI blev den synlige file chooser fuldført med `upload`.
4. Gentag fra en ren sag efter `Slet alt`, eller gentag med samme preflight-fil.

**Udløsende input og settle**

- Felt/handling: global `Hent` → filvælger → valg af `Mineo.eo`
- Præcis værdi: gyldig lokalt genereret `.eo`-fil med to EO-oplysninger; ved tredje gentagelse samme filtype med `satser.aargang = 2005`; senest krypteret audit-fixture med 4 af 7 loadbare felter, ét ukendt felt, én ugyldig sektion og én ukendt sektion
- Metode: filvælger/upload gennem den synlige Hent-handling
- Settle: straks ved file-input `change`

**Observeret systemsignal**

- Første signal: `NotFoundError: Node.removeChild: The node to be removed is not a child of this node`
- Synlig adfærd: Sagen indlæses og værdierne kan efterfølgende ses, men appen viser `Teknisk fejl registreret` med registreret fejl. Ved preflight-flowet vises desuden den korrekte preflight-dialog med tællingen `Indlæst fra filen: 4 af 7 felter · Sat til standardværdi: 3`; teknisk fejlramme og preflight-dialog eksisterer samtidig. Første gentagelse viste også en kortvarig Vite WebSocket-forbindelsesfejl; den er ikke registreret som produktfund.
- Fejltekst: `Teknisk fejl registreret` og senest `Registrerede hændelser: 3 fejl · 3 advarsler`; preflight-dialogen viste `Indlæs trods fejl`, `Send fejloplysninger` og `Stop og gør intet`.
- Relevant stacktop: `selectFile/</input.onchange` → `src/utils/fileHelpers.ts:198` (`document.body.removeChild(input)`); den parallelle `oncancel`-sti ligger på linje 203–205.
- Console/pageerror/rejection: Firefox havde én produkt-`console.error` med ovenstående stack ved hver filvalgsgentagelse; ingen pageerror eller ukontrolleret rejection blev registreret.

**Reproducerbarhed og kontrast**

- Rate: 6/6 Firefox-filvalg (tre tidligere gyldige `.eo`-valg og tre preflight-fixture-valg)
- Gentaget fra ren tilstand: Ja, anden EO-gentagelse efter eksplicit `Slet alt`; tredje gentagelse fra en ændret Satser-sag; tre nyere gentagelser med samme preflight-fixture
- Nærmeste ikke-fejlende kontrast: Firefox `Gem`-fallback downloadede filen uden `console.error`; selve load/apply gennemførtes trods fejlen.
- Andre browsere/viewports: WebKit 1920×1080 gennemførte samme `upload`-baserede Hent-flow uden exception (0/1); Edge/Chrome og real musestyret filvælger er uafklaret.

**Påvirkning og rækkevidde**

En understøttet Firefox-brugerrejse på den trust-kritiske Hent-flade registrerer en intern fejl og viser en teknisk fejlramme, selv om den valgte sag i de to observerede tilfælde blev indlæst. Fejlen kan skjule, om load er gennemført korrekt, og signalerer et brud i filvælgerens livscyklus; datatab blev ikke observeret i denne reproduktion.

**Evidens**

- Screenshot/trace: Ingen bevaret audit-artefakt; stack og synlig fejl blev inspiceret direkte i browseren.
- Supplerende noter: Den observerede exception opstår i filvælgerens `change`-oprydning, hvor samme dynamiske input også har en `cancel`-oprydning. Om Firefox’ virkelige museflow udløser begge callbacks, er ikke afgjort af CLI-gentagelsen.
