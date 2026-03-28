# Mineo – EO Snapshot-kontrakt

**Version:** 1.0
**Status:** Gældende arkitektur (normativ)
**Formål:** At fastlægge bindende regler for `computeEoSnapshot`, clampingmodel,
invariant-klassificering, snapshot-livscyklus og projektionsgarantier i EO-domænet.

**Prioritet:** `src/contracts/form-contract.md` > denne kontrakt

---

Dette dokument er **normativt**.
Kode, der afviger fra denne kontrakt, betragtes som **arkitektonisk fejl**.

---

## 1. Én autoritativ entry

`computeEoSnapshot(committedInput) → EoSnapshot` er den eneste beregnings-exit for EO.

Alle visninger er projektioner af snapshot:
- `eoSnapshotToBeregningView`
- `eoSnapshotToDebugView`
- `eoSnapshotToEoPdfDocument`
- `eoSnapshotToTafPerYearPdfDocument`

**Ufravigelige regler:**
- Ingen EO-total må beregnes parallelt i UI-komponenter, PDF-writers eller debug-lag.
- Engines arbejder altid på de clampede værdier som snapshot-orchestreringen leverer.
- Committed form-state ændres aldrig af clamping.

---

## 2. Clampingmodel (todelt og udtømmende)

Alle committede TAF- og svie/smerte-perioder gennemgår clamping i `buildTafRanges` /
`computeSvieSmerteEngine` inden engines kører. Clamping ændrer aldrig committed form-state.

Clamping kan resultere i, at en periode reduceres til ingenting (tom range). Dette er
**normal og forventelig adfærd** — ikke en fejl. Det sker fx når brugeren har indtastet en
TAF-periode der slet ikke falder inden for EO-perioden. I dette tilfælde er der ingen
TAF-perioder at vise, og både erstatningsopgørelse-PDF og TAF fordelt på år-PDF skal stadig
kunne dannes. Den relevante PDF-sektion viser i stedet teksten 'Ingen' — præcis som når
brugeren via toggleswitch har angivet, at der ikke beregnes TAF. Samme princip gælder
svie/smerte i erstatningsopgørelse-PDF: hvis der ikke er nogen perioder at vise, dannes
PDF'en stadig, og sektionen viser 'Ingen'.

### 2.1 Stille clamping (ingen fejlindikation — udtømmende liste)

Stille clamping er en **eksplicit og udtømmende undtagelse** fra det generelle princip om at
out-of-range værdier giver fejlmeddelelse.

Stille clamping sker **kun** mod EO-periodens grænser:
- TAF fra-dato `< vedroererPeriodeFra` → clampes til `vedroererPeriodeFra`
- TAF til-dato `> vedroererPeriodeTil` → clampes til `vedroererPeriodeTil`
- Svie/smerte fra-dato `< vedroererPeriodeFra` → clampes til `vedroererPeriodeFra`
- Svie/smerte til-dato `> vedroererPeriodeTil` → clampes til `vedroererPeriodeTil`

Disse clampings giver **ingen fejlindikation** i felt, EOBeregningTab eller snapshot-invariants.
Snapshot og EODebug bruger de clampede værdier som om de var de committede værdier.

**Der er ingen andre bounds der clampes stille.** Enhver ny clamping-regel kræver en eksplicit
kontraktændring med begrundelse.

Rationale: EO-perioden (`vedroererPeriodeFra`/`vedroererPeriodeTil`) er den primære
afgrænsning for hvad der overhovedet er relevant for den konkrete erstatningsopgørelse.
At perioder stikker ud over denne grænse er et normalt og forventeligt editerings-artefakt
uden diagnostisk betydning.

### 2.2 Fejlgivende bounds (fejl i felt + EOBeregningTab + blokerer download)

Følgende bounds-violations giver fejlindikation og blokerer download.
Snapshot beregnes stadig på de clampede værdier — clamping sker altid, også for fejlgivende bounds.

Mekanismen er: feltfejl (rød kant + tooltip) i TAFPeriodeTable/SvieSmerteTable vises fra
commit-tidspunktet, og fejlen gengives på EOBeregningTab, der blokerer download-funktionaliteten.
Adfærden er identisk for alle fejlgivende bounds uanset årsag (differencekrav, EET, mén).

**TAF fra-dato:**
- `< 2005-01-01`
- `< skadesdato` (ikke-erhvervssygdom)
- `< anmeldedato − 5 år` (erhvervssygdom)
- `> til-dato i samme række`

**TAF til-dato:**
- `< fra-dato i samme række`
- `>= differencekravDato`
- `>= beregnet endelig EET-virkningsdato` (når EET-afgørelse ikke er påklaget)
- `>= beregnet midlertidig EET-virkningsdato` (når EET-afgørelse ikke er påklaget **og** skadesdato < 2011-06-16)

**Svie/smerte fra-dato:**
- `< 2005-01-01`
- `< skadesdato` (ikke-erhvervssygdom)
- `< anmeldedato − 5 år` (erhvervssygdom)
- `> til-dato i samme række`

**Svie/smerte til-dato:**
- `< fra-dato i samme række`
- `>= afgørelsesdato for varige mén` (når ménafgørelse ikke er påklaget)

**Overlap:** Overlap mellem rækker (TAF og svie/smerte): fejl i felt + EOBeregningTab.

**Manglende datoer:** Manglende fra- eller til-dato på ikke-tom række: fejl kun på
EOBeregningTab (ikke i felt), blokerer download.

**Ferieperioder i EO-oplysninger:** Ferieperioder clampes ikke og begrænses ikke af andre
indtastninger. De lægges ukritisk til grund som indtastet. Den eneste undtagelse er
rækkens egen datologik: `fra-dato > til-dato` eller `til-dato < fra-dato` er fejl på samme
niveau som tilsvarende rækkefejl for TAF- og svie/smerte-perioder.

### 2.3 Fuld behandlingsrækkefølge for TAF-perioder

1. **Syntaksvalidering:** Ufuldstændige datoer (fx `dd-mm`) afvises i inputfeltet og
   committes ikke. Kun gyldige ISO-datoer committes.

2. **Semantisk validering (fejlgivende bounds):** Efter commit undersøges de committede
   datoer mod fejlgivende bounds (§2.2). Violation giver feltfejl (rød kant + tooltip) og
   blokerer download via EOBeregningTab. Disse checks inkluderer: fra-dato mod 2005-grænse,
   skadesdato/anmeldedato-grænse, fra > til, til < fra, til >= differencekravDato,
   til >= EET-virkningsdato (ikke påklaget), overlap mellem rækker.

   Validering sker på de committede rækker som sådanne — ikke først efter en
   relevansvurdering mod de autoritative, clampede ranges. En ugyldig TAF-række bliver
   derfor ikke "reddet" af, at den senere ville være uden betydning for det autoritative
   beregningsinterval.

3. **Clamping mod fejlgivende øvre grænser:** Til-dato clampes mod strengeste af:
   `differencekravDato − 1`, `endelig EET-virkningsdato − 1`, og (ved skadesdato < 2011-06-16)
   `midlertidig EET-virkningsdato − 1`. Alle tre EET-grænser ophæves hvis `verserendeKlageEet = 'Ja'`.
   Validator rapporterer violation som feltfejl der blokerer download. Rækkefølge: FØR
   EO-periode-clamping, så feltfejlen ikke skjules af at EO-perioden forinden har afkortet perioden.

4. **Løse feriedage er række-bundne før merge:** Hvis brugeren har indtastet
   `loseFeriedage` på en TAF-række, knyttes disse dage til den oprindelige indtastede række
   og placeres fra periodens start i netop denne række. Hvis flere TAF-rækker efterfølgende
   merges, ændrer merge ikke den logiske placering af løse feriedage; placeringen sker
   dermed pre-merge, ikke på baggrund af den samlede merged periode.

5. **Merge:** Overlappende og tilstødende ranges slås sammen til sammenhængende perioder
   (`mergeAdjacent: true`).

6. **Stille clamping mod EO-perioden:** Fra-dato `< vedroererPeriodeFra` clampes til
   `vedroererPeriodeFra`. Til-dato `> vedroererPeriodeTil` clampes til `vedroererPeriodeTil`.
   Ingen fejlindikation. Sker EFTER fejlgivende clamping.

7. De resulterende ranges lægges til grund for beregning i EODebug, EODebugTabel og
   EOBeregning. Download er blokeret hvis der er fejl fra trin 2.

Bemærk om projektioner: EO-domænet kan have flere tekniske TAF-forbrugere, fx en
per-række/merged-output-sti og en snapshot-baseret aggregationssti. Det er ikke i sig selv
et kontraktbrud, så længe de følger samme autoritative domænesemantik: clampede ranges som
beregningsgrundlag, pre-merge placering af løse feriedage og ingen parallelle fallback-totaler.

Tilsvarende proces gælder for svie/smerte-perioder:

1. **Syntaksvalidering:** Ufuldstændige datoer (fx `dd-mm`) afvises i inputfeltet og
   committes ikke. Kun gyldige ISO-datoer committes.

2. **Semantisk validering (fejlgivende bounds):** Efter commit undersøges de committede
   datoer mod fejlgivende bounds (§2.2). Violation giver feltfejl (rød kant + tooltip) og
   blokerer download via EOBeregningTab. Disse checks inkluderer: fra-dato mod 2005-grænse,
   skadesdato/anmeldedato-grænse, fra > til, til < fra, til >= ménafgørelsesdato
   (ikke påklaget), overlap mellem rækker.

3. **Clamping mod fejlgivende øvre grænse:** Til-dato clampes mod
   `menAfgoerelseDato − 1`, når ménafgørelsen er endelig
   (`varigeMenAfgorelse = 'Ja'` og `verserendeKlageMen = 'Nej'`).
   Validator rapporterer violation som feltfejl der blokerer download. Rækkefølge: FØR
   EO-periode-clamping, så feltfejlen ikke skjules af at EO-perioden forinden har afkortet
   perioden.

4. **Merge:** Overlappende og tilstødende ranges slås sammen til sammenhængende perioder
   (`mergeAdjacent: true`).

5. **Stille clamping mod EO-perioden:** Fra-dato `< vedroererPeriodeFra` clampes til
   `vedroererPeriodeFra`. Til-dato `> vedroererPeriodeTil` clampes til `vedroererPeriodeTil`.
   Ingen fejlindikation. Sker EFTER fejlgivende clamping.

6. De resulterende ranges lægges til grund for beregning i EODebug, EODebugTabel og
   EOBeregning. Download er blokeret hvis der er fejl fra trin 2.

Implementeringen bruger parallelle constraint-typer (`SvieSmerteConstraintBounds`,
`resolveSvieSmerteFejlgivendeBounds`, `resolveSvieSmerteEoPeriodeBounds`) i
`svieSmerteConstraints.ts`.

### 2.4 Clampinggaranti

Clamping sker pre-snapshot i `computeEoSnapshot`. Engines arbejder **altid** på clampede
værdier — også når der vises fejl for fejlgivende bounds (§2.2).

`debugSnapshot` bygges eksplicit med de clampede ranges efter `buildTafRanges` er kaldt i
`computeEoSnapshot`, så EODebug aldrig viser TAF-dage der ikke indgik i beregningen.

I validerings-fejl-stien (engines ikke kørt) bygges `debugSnapshot` uden ranges — dette er
korrekt, da ingen beregning har fundet sted.
Debug-laget må i denne sti ikke lave nye fallback-enginekald for at udfylde svie/smerte-tal,
TAF-tal eller andre delresultater. Når autoritativt engine-output mangler, skal debug vise
tom/ikke-beregnet tilstand i stedet for semi-autoritative beløb eller dagtal.

---

## 3. Invariant-klassificering

### 3.1 `blocksAuthoritativeComputation`

Invariants med `blocksAuthoritativeComputation: true` stopper engine-kaldene og sætter
snapshot til `status: 'error'` med `data: null`.

Bruges til:
- Schema-violations
- Overlap i TAF-perioder
- Out-of-range ferie/fridage (`loseFeriedage`, `uspecificeredeFerieFridage`)
- Manglende nødvendige inputfelter (validator-fejl)

**Bounds-violations (§2.2)** (differencekravDato, EET-virkningsdato, ménafgørelsesdato)
håndteres ikke som snapshot-invariants. De eksponeres som feltfejl i UI-komponenterne
(TAFPeriodeTable/SvieSmerteTable) og gengives på EOBeregningTab, der blokerer download.
Snapshot beregnes stadig på de clampede værdier og `data` er tilgængeligt.

### 3.2 `blocksOutputs`

Invariants kan blokere specifikke outputs uden at stoppe beregningen:
- Kontroluoverensstemmelse blokerer: `['eo_pdf', 'taf_per_year_pdf']`
- TAF per år-afstemningsfejl over 100 øre blokerer: `['taf_per_year_pdf']`

### 3.3 Engine-throws er forbudt som primær fejlmåde

Engine-throws på forventelige brugerinputfejl er huller i preflight-dækningen.

Regler:
- Engines skal returnere nul-output via `buildZeroOutput` for kendte fejltilstande.
- Uventede engine-throws routes til `fail_closed` med `failClosedReason: 'runtime_exception'`.
- Alle forventelige brugerinputfejl skal opdages og rapporteres i validator eller som
  snapshot-invariants — ikke via engine-throws.

---

## 4. Snapshot-status

Snapshot-status sættes deterministisk:

| Status | Betingelse |
|---|---|
| `fail_closed` | Schema-guard fejler, runtime-undtagelse i snapshot-build, eller `blocksAuthoritativeComputation`-invariant er brudt |
| `error` | Output-specifikke fejl der ikke stopper beregningen, men blokerer relevante outputs (fx kontroluoverensstemmelse, TAF-per-år-afstemningsfejl over 100 øre). Bounds-violations (§2.2) sætter ikke snapshot til `error` — de eksponeres som feltfejl der blokerer download via EOBeregningTab. |
| `warning` | Ingen errors, men mindst én warning-invariant er brudt |
| `ok` | Ingen brudte invariants |

Projektioner pattern-matcher altid på status først. Ved `fail_closed` er totals og
mellemregninger utilgængelige og må ikke vises som gyldige.

---

## 5. Snapshot-livscyklus og friskhed

Snapshot er bundet til en committed revision.

**Regler:**
- `snapshot.revision` skal altid svare til den committed inputrevision der blev brugt til
  den autoritative beregning.
- Hvis `snapshot.revision !== currentCommittedRevision`, er snapshot stale og må ikke bruges
  som grundlag for at konstatere kontroluoverensstemmelse eller anden blokering, der
  forudsætter et friskt snapshot.
- Ved visning af Beregning, EODebug og EODebugTabel skal et stale snapshot erstattes af en ny
  snapshot-build før normal visning fortsætter.
- Stale state er et refresh-behov, ikke en systemfejl.

Rationale: Kontroluoverensstemmelse og output-gating må kun vurderes på samme committed
input, ellers risikerer systemet at blokere på baggrund af forældede mellemresultater.

---

## 6. EODebug og EODebugTabel — altid-kan-dannes garanti

EODebug og EODebugTabel **kan altid dannes** fra snapshot-data.

**Manglende datoer er forventelig adfærd:** Manglende fra- eller til-datoer på
TAF/svie-smerte-rækker betyder blot, at brugeren endnu ikke har udfyldt dem. Det er
ikke en systemfejl. EODebug viser de clampede værdier korrekt. Ingen `BugReportButton`
vises i EODebug eller EODebugTabel.

Validator og snapshot-invariants klassificerer manglende datoer som fejl — det sker
i EOBeregningTab, ikke i EODebug-visningen.

Hvis `debugSnapshot` er `null` (ved `fail_closed` før engines kørte), vises en passende
tom-/fejltilstand uden at forsøge at rendere beregningsindhold.

---

## 7. `tidligereModtagetTaf`-isometri

Tom committed værdi (`undefined`) for `tidligereModtagetTaf` repræsenterer semantisk `0 kr`.

**Regel:** I snapshot/totals og alle projektioner (Beregning-tab, EODebug, PDF) skal dette
normaliseres til numerisk `0` (MoneyOre). `null` eller `undefined` må ikke propagere som
resultat af at feltet er tomt.

Rationale: Tomt felt er et tilladt og neutralt brugervalg — brugeren har ikke modtaget
tidligere TAF-udbetalinger, eller beløbet er ikke oplyst. Begge tolkes som `0 kr.` fradrag.
Der er ingen semantisk forskel på "0" og "tomt" for dette felt.

---

## 8. `BugReportButton` i EO-kontekst

`BugReportButton` er en fejlrapporteringskomponent til systemtekniske runtime-fejl.
Den hører ikke hjemme i normale beregningstabs eller resultatvisninger som del af sideflowet.

**Tilladte placeringer i EO-scope:**
- `ErrorFallback` (ErrorBoundary-flow ved uventede komponent-crashes)
- `DevtoolsIssueNotice` (devtools-monitor-flow)

**Forbudte placeringer:**
- Inline i `EOberegningTab`s normale fejl-og-advarsler-sektion som del af sideflowet
- I `EODebug` eller `EODebugTabel`
- I download-fejl-dialog eller enhver anden dialog
- Som del af nogen visning der vises som fast element ved normale brugerscenarier

Præcisering:
- `EOberegningTab` må vise systemfejl-rækker for snapshot-invarianterne
  `debug:control_mismatch` og `taf_per_year:afrunding_over_100`, fordi de er interne
  beregningsinkonsistenser.
- Disse rækker må ikke indeholde `BugReportButton`.
- De skal samtidig logges via `console.error`/system issue-flowet, så det eksisterende
  `DevtoolsIssueNotice`-flow åbner og giver brugeren mulighed for at sende fejloplysninger.

**`fail_closed`-snapshot:** `schema_guard`-fejl (schema/parsing) og `invariant_guard`
(afledt intern datainkonsistens efter vellykket parsing) vises som en neutral
fejlbesked i `EOberegningTab` uden `BugReportButton`. `runtime_exception`
logges via `console.error`/system issue-flowet og vises kun som neutral inline-række
uden rapportknap.

**PDF-download-gating og download-fejl:** Download-knappen er aktiv hvis og kun hvis
`errors`-listen er tom (ingen feltfejl fra EO-oplysninger eller stamdata). Kan PDF'en
alligevel ikke genereres (runtime-undtagelse i jsPDF), logges fejlen via `console.error`
til devtools-monitor-flowet — ingen dialog, ingen `BugReportButton` vises til brugeren.
Brugeren orienteres udelukkende via feltfejl i EOBeregningTab om hvad der skal rettes.

---

## 9. Ændringer af kontrakten

Ændringer skal være:
- Eksplicitte
- Begrundede
- Versionsstyrede

**Kode må aldrig stiltiende afvige fra kontrakten.**

---

## 10. Betingede felter i PDF-renderere (toggle-guard-krav)

### Baggrund

Committed form-state indeholder altid alle felters værdier — også felter der aktuelt er
skjult i UI'et af en toggle, et valg eller en anden betingelse. Et felt der er skjult kan
indeholde en stale værdi fra en tidligere aktiveret tilstand.

PDF-renderere læser direkte fra `eoValues` uden forudgående rensning. Det betyder at en
renderer, der ikke aktivt tjekker den betingelse der styrer feltets synlighed i UI'et, kan
komme til at udskrive stale data i en PDF, selv om feltet ikke er aktivt for den konkrete sag.

### Regel

Når et felt i UI'et vises betinget af et toggle-switch, et valg eller andet brugerinput,
**skal** PDF-rendereren der udskriver feltets værdi have en tilsvarende guard, der afspejler
samme betingelse.

Tommelfingerregel: find den variabel i UI-komponenten der styrer feltets synlighed
(fx `const showFelt = af.harToggle && af.harBetingelse`). PDF-rendereren skal kontrollere
identisk logik med `if`-guard inden den udskriver feltets værdi.

### Mønstre

To eksisterende mønstre er acceptable:

**Mønster A — sektionsniveau:** Engine returnerer nul-output når toggle er slukket.
PDF-renderer tjekker `model.beregnes`-flaget inden sektionen tegnes.
Eksempel: `beregnesSvieSmerteGodtgoerelse` i `eoPdfBuilders.ts`.

**Mønster B — feltniveau:** Inline `if`-guard direkte i renderer-funktionen.
Foretrukket mønster for enkeltfelter og felter med overlappende afhængigheder.
Eksempel: `if (overenskomstId && ansaettelsesforhold.harOverenskomst)` i `loenindkomstSection.ts`.

Undgå at indføre et tredje mønster (fx pre-computation masking, normalisering eller
datastruktur-mutationer i PDF-entry-punktet) — det skaber inkonsistens og gør
ansvarsfordelingen uklar.

### Tjekliste ved tilføjelse af nye felter

Når du tilføjer et nyt felt eller gør et eksisterende felt betinget:

1. Find eller opret den betingelse der styrer synlighed i UI-komponenten.
2. Find den PDF-renderer-funktion der udskriver feltets værdi.
3. Tilsæt en `if`-guard (Mønster B) eller opdater engine-output + `beregnes`-flag (Mønster A).
4. Tilsvarende: hvis et toggle fjernes og et felt altid vises, fjern da den tilhørende guard.

Manglende guard er en **Kritisk** fejl i review — den kan udskrive stale data i tillid-kritiske
PDF-dokumenter.

## 11. Semantisk fravalg skal undertrykke PDF-indhold og afledte visninger

Visse EO-valg har en stærkere betydning end rene visningsvalg i PDF-UI'et: når brugeren
semantisk har fravalgt en beregning, må senere outputvalg ikke genindføre indholdet.

### 11.1 Sygeferiegodtgørelse

Hvis sygeferiegodtgørelse for den konkrete sag er sat til `Ingen` for alle relevante
ansættelsesforhold, er sygeferiegodtgørelse semantisk fravalgt.

I dette tilfælde gælder følgende ufravigelige regler:
- EO-PDF må ikke vise sygeferiegodtgørelse nogen steder.
- EO-PDF må ikke medtage sygeferiegodtgørelse i mellemregninger, indtægtslinjer, bilag eller andre beregninger.
- Bilags-checkboxen for sygeferiegodtgørelse i EOBeregningTab er kun et visningsønske og må ikke overstyre det semantiske fravalg.
- TAF fordelt på år må ikke vise eller beregne fradragslinjer for sygeferiegodtgørelse.

### 11.1a TAF-beregningsperiode og SFGG-referenceperiode er adskilte domæner

`periodeTilBeregningFra` / `periodeTilBeregningTil` tilhører TAF-beregningsgrundlaget.
SFGG-referenceperioden tilhører udelukkende den konkrete SFGG-række
(`sfggAnsaettelsesforhold[].sfggReferenceperiodeFra/Til`).

Ufravigelige regler:
- EO's TAF-beregningsperiode må aldrig bruges som fallback, default, visningsgate eller beregningsinput for SFGG-referenceperioden.
- SFGG-referenceperioden må aldrig bruges som fallback, default, visningsgate eller beregningsinput for TAF-beregningsperioden.
- At perioderne i en konkret sag tilfældigvis er identiske giver ingen implicit kobling i kode eller projektioner.
- PDF-, debug- og view-lag må ikke betinge SFGG-referenceperiode-indhold på `values.beregnesUdFra === 'Beregningsperiode'`.

Tilladte relationer:
- SFGG må gerne forholde sig til TAF-forløbet som sygeforløb, fx ved kravet om at SFGG-referenceperioden skal ligge før første TAF-dag/periode.
- SFGG må gerne bruge TAF-beregningsenheden (`Måneder`/`Arbejdsdage`) dér hvor domænet eksplicit kræver det for kalenderdage vs. arbejdsdage.

Disse undtagelser ændrer ikke hovedreglen: TAF-beregningsperioden og SFGG-referenceperioden er
to forskellige inputdomæner og må ikke sammenblandes.

Interne navngivningsregler:
- Tvetydige interne symboler for TAF-beregningsperioden skal navngives med `taf`-præfiks, fx `tafBeregningsperiode`.
- Tvetydige interne symboler for SFGG-referenceperiode eller SFGG-afledte satser skal navngives med `sfgg`-præfiks, fx `sfggReferenceperiode`, `sfggReferencesats` og `sfggSource`.
- Persisted schemafelter er kun undtaget fra denne regel, når stabile load/save-kontrakter kræver eksisterende feltnavne.

Aktuel undtagelse:
- TAF's persisted felter `periodeTilBeregningFra/Til` og root-feltet `beregnesUdFra` er fortsat uændrede af hensyn til den eksisterende EO-kontrakt.
- SFGG-rækkens persisted felter er eksplicit omlagt til `sfgg`-præfiks, herunder `sfggBeregningskilde`. Ældre `.eo`-filer med de tidligere SFGG-feltnavne er derfor ikke bagudkompatible på dette punkt.
- Denne bagudinkompatibilitet er fail-closed, ikke fail-fast: ved load af gamle SFGG-feltnavne parses rækken fortsat, men manglende `sfggBeregningskilde` behandles efterfølgende som `Ingen`. Det giver semantisk fravalg af SFGG i stedet for parse-fejl eller gætteri.

### 11.2 Samme princip for andre semantisk fravalgte delberegninger

Samme regel gælder for andre delberegninger med tilsvarende semantisk fravalg. Hvis en
delberegning er autoritativt fravalgt i snapshot-/engine-laget, må hverken EO-PDF eller
TAF fordelt på år-PDF vise indhold, fradrag, bilag eller mellemregninger for den.
