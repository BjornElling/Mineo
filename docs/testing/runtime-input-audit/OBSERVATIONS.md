# Mineo robustheds- og adfærdsaudit — adfærds- og øvrige fund

Registrér ikke-crashende afvigelser, datatabsmistanke, kontraktdrift, parallel eller afvigende logik, mistænkelig beregningsadfærd og manglende eller uforudsigelig feedback. Registrér ikke en klar, forventet valideringsreaktion som fund.

**Rettede fund slettes.** Når et fund er rettet, fjernes både dets indeksrække og dets post fra denne fil — registeret viser
altså kun åbne fund. Huller i ID-rækken er derfor forventede og ikke et tegn på manglende poster. Et rettet fund må heller
ikke stå som reference andre steder i auditdokumenterne; henvisninger til det omskrives til «rettet og lukket», når posten
slettes, så intet dokument peger på et ID, der ikke længere findes.

## Indeks

| ID | Kort titel | Kategori | Flade | Browser/viewport | Alvor | Status | Først set |
|---|---|---|---|---|---|---|---|
| OBS-005 | Firefox-fallback giver en synlig teknisk advarsel ved normal Gem/Hent | UX / Console-politik | SURF-001 / SHELL-003 | Firefox 1920×1080 | Mellem | Bekræftet | 2026-08-08 16:19 Europe/Copenhagen |
| OBS-018 | Nedre Fødselsdato-grænse vises som generisk indtastningsfejl | Kontraktdrift / UX | CUT-001 / STAM-008 | Chrome/Edge/Firefox/WebKit 1920×1080 | Mellem | Bekræftet | 2026-08-09 02:19 Europe/Copenhagen |
| OBS-028 | Firefox-teknisk advarsel blokerer Løntrin-finderens datofelt | Browserforskel / UX / Kontraktdrift | SURF-003 / PAR-003 / Løntrin-finder | Firefox 1920×1080 | Mellem | Bekræftet | 2026-08-09 06:29 Europe/Copenhagen |

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

### OBS-018 — Nedre Fødselsdato-grænse vises som generisk indtastningsfejl

> **Ikke løst 2026-08-09 — anden årsag end de dengang samtidige EO-boundsfund (nu rettet og slettet).** Undersøgt i forbindelse med datogrænse-rettelsen og
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
