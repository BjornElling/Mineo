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
- `< skadedato` (ikke-erhvervssygdom)
- `< anmeldedato − 5 år` (erhvervssygdom)
- `> til-dato i samme række`

**TAF til-dato:**
- `< fra-dato i samme række`
- `>= differencekravDato`
- `>= beregnet endelig EET-virkningsdato` (når EET-afgørelse ikke er påklaget)
- `>= beregnet midlertidig EET-virkningsdato` (når EET-afgørelse ikke er påklaget **og** skadedato < 2011-06-16)

**Svie/smerte fra-dato:**
- `< 2005-01-01`
- `< skadedato` (ikke-erhvervssygdom)
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
   skadedato/anmeldedato-grænse, fra > til, til < fra, til >= differencekravDato,
   til >= EET-virkningsdato (ikke påklaget), overlap mellem rækker.

   Validering sker på de committede rækker som sådanne — ikke først efter en
   relevansvurdering mod de autoritative, clampede ranges. En ugyldig TAF-række bliver
   derfor ikke "reddet" af, at den senere ville være uden betydning for det autoritative
   beregningsinterval.

3. **Clamping mod fejlgivende øvre grænser:** Til-dato clampes mod strengeste af:
   `differencekravDato − 1`, `endelig EET-virkningsdato − 1`, og (ved skadedato < 2011-06-16)
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
   skadedato/anmeldedato-grænse, fra > til, til < fra, til >= ménafgørelsesdato
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

## 8. Fejlrapportering og PDF-output

1. `BugReportButton` i EO-scope styres normativt af `src/contracts/error-debug-contract.md`.
2. PDF-download-gating, toggle-guards og semantisk fravalg styres normativt af `src/contracts/pdf-contract.md`.

---

## 9. Ændringer af kontrakten

Ændringer skal være:
- Eksplicitte
- Begrundede
- Versionsstyrede

**Kode må aldrig stiltiende afvige fra kontrakten.**

---

## 10. TAF tvær-output konsistens (EO vs. TAF fordelt på år)

Dette afsnit er normativt for visning af tabt arbejdsfortjeneste i flere outputs.

1. Autoritativ total:
- Den autoritative TAF-total er EO-modellens `tabtArbejdsfortjenesteOre`.
- Afledte visninger (herunder "TAF fordelt på år") må ikke beregne en alternativ total.

2. Invariant:
- Summen af årsbeløb plus eventuel afrundingslinje skal være identisk med den autoritative total.

3. Acceptabel afrundingsafvigelse:
- Den samlede forskel mellem årssum og autoritativ total må højst være 1 kr. (100 øre).
- Overskrides 1 kr., skal systemet være fail-closed: årsfordelingen må ikke vises som gyldig beregning.

4. Clamp-scenarie:
- Hvis EO-netto clamped til 0, fordi fradrag overstiger lønudvikling, må der ikke vises en misvisende årsfordeling med stor "Afrunding".
- Systemet skal i dette tilfælde fail-close årsfordelingen.

## 11. TAF-beregningsperiode og SFGG-referenceperiode er adskilte domæner

`tafBeregningsperiodeFra` / `tafBeregningsperiodeTil` tilhører TAF-beregningsgrundlaget.
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

Bagudinkompatibilitet:
- TAF's persisted felter hedder nu `tafBeregningsperiodeFra`/`tafBeregningsperiodeTil` (tidligere `periodeTilBeregningFra`/`periodeTilBeregningTil`). Ældre `.eo`-filer med de tidligere feltnavne er ikke bagudkompatible på dette punkt.
- SFGG-rækkens persisted felter er eksplicit omlagt til `sfgg`-præfiks, herunder `sfggBeregningskilde`. Ældre `.eo`-filer med de tidligere SFGG-feltnavne er ikke bagudkompatible på dette punkt.
- Begge bagudinkompatibiliteter er fail-closed: manglende felter behandles som `undefined`/`Ingen` frem for parse-fejl.

## 12. EO-feltklassificering og bounds-model

EO-specifik feltklassificering, fejlgivende bounds og stille clamping er normativt defineret i §2.
