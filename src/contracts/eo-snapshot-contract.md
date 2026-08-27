# Mineo – EO Snapshot-kontrakt

**Version:** 1.0
**Status:** Normativ og gældende
**Type:** Domænekontrakt
**Formål:** At fastlægge bindende regler for `computeEoSnapshot`, clampingmodel,
invariant-klassificering, snapshot-livscyklus og projektionsgarantier i EO-domænet.

**Prioritet:** Underordnet samtlige tværgående kontrakter jf. `contract-topology.json` (herunder `form-contract.md`, `domain-boundary-contract.md`, `persistence-contract.md` og `snapshot-contract.md`), som alle går forud ved konflikt.
**Senest verificeret mod kode:** 2026-08-27

---

Dette dokument er **normativt**.
Kode, der afviger fra denne kontrakt, betragtes som **arkitektonisk fejl**.

---

## 1. Én autoritativ entry

`computeEoSnapshot(readyInputProjection) → EoSnapshot` er den eneste beregnings-exit for EO. Projektionen bygges fra
én `InputReader`-revision og skal være `ready`; rå canonical sektioner må ikke gives som bypass til rejected input.

Alle visninger er projektioner af snapshot:
- `eoSnapshotToBeregningView`
- `eoSnapshotToInspektionView`
- `eoSnapshotToEoDocument`
- `eoSnapshotToTafPerYearDocument`
- `eoSnapshotToTafPerYearOpreguleretDocument` (projektion for beregningsformen "TAF opreguleret til beregningsår"; forwarder både per-år-resultatet og det opregulerede resultat uden ny domæneberegning)
- `eoSnapshotToTafKravGrafDocument` (jf. §3.2)

For projektionsfelter, der fødes videre til kontrol/PDF uden ny domæneberegning, er feltsemantikken bindende.
Dette gælder blandt andet `sygeferiegodtgoerelse.perAnsaettelsesforhold[].sfggVisningsperiode`, som normativt er
de autoritative arbejdsforløbs-ranges efter fradrag af første undtagne TAF-dag (når den faktisk gælder for det
konkrete ansættelsesforhold), 4-månedersgrænse, ansættelsesophør og eventuelt bortfald under
arbejdsgiverbetalt sygeløn, men før feriesubtraktion til SFGG-segmentering.

**Ufravigelige regler:**
- Ingen EO-total må beregnes parallelt i UI-komponenter, PDF-writers eller kontrollag.
- Engines arbejder altid på de clampede værdier som snapshot-orchestreringen leverer.
- Afsluttet canonical input ændres aldrig af clamping.

---

## 2. Clampingmodel (todelt og udtømmende)

Alle afsluttede, canonical TAF- og svie/smerte-perioder gennemgår clamping i `buildTafRanges` /
`computeSvieSmerteEngine` inden engines kører. Clamping ændrer aldrig inputaggregatet.

Clamping kan resultere i, at en periode reduceres til ingenting (tom range). Dette er
**normal og forventelig adfærd** – ikke en fejl. Det sker fx når brugeren har indtastet en
TAF-periode der slet ikke falder inden for EO-perioden. I dette tilfælde er der ingen
TAF-perioder at vise, og både erstatningsopgørelse-PDF og TAF fordelt på år-PDF skal stadig
kunne dannes. Den relevante PDF-sektion viser i stedet teksten 'Ingen' – præcis som når
brugeren via toggleswitch har angivet, at der ikke beregnes TAF. Samme princip gælder
svie/smerte i erstatningsopgørelse-PDF: hvis der ikke er nogen perioder at vise, dannes
PDF'en stadig, og sektionen viser 'Ingen'.

### 2.1 Stille clamping (ingen fejlindikation – udtømmende liste)

Stille clamping er en **eksplicit og udtømmende undtagelse** fra det generelle princip om at
out-of-range værdier giver fejlmeddelelse.

Stille clamping sker **kun** mod EO-periodens grænser:
- TAF fra-dato `< vedroererPeriodeFra` → clampes til `vedroererPeriodeFra`
- TAF til-dato `> vedroererPeriodeTil` → clampes til `vedroererPeriodeTil`
- Svie/smerte fra-dato `< vedroererPeriodeFra` → clampes til `vedroererPeriodeFra`
- Svie/smerte til-dato `> vedroererPeriodeTil` → clampes til `vedroererPeriodeTil`

Disse clampings giver **ingen fejlindikation** i felt, EOberegningTab eller snapshot-invariants.
Snapshot og EOInspektion bruger de clampede værdier som effektivt beregningsinput uden at ændre de afsluttede
canonical værdier.

**Der er ingen andre bounds der clampes stille.** Enhver ny clamping-regel kræver en eksplicit
kontraktændring med begrundelse.

Rationale: EO-perioden (`vedroererPeriodeFra`/`vedroererPeriodeTil`) er den primære
afgrænsning for hvad der overhovedet er relevant for den konkrete erstatningsopgørelse.
At perioder stikker ud over denne grænse er et normalt og forventeligt editerings-artefakt
uden diagnostisk betydning.

### 2.2 Fejlgivende bounds (fejl i felt + EOberegningTab + blokerer download)

Følgende bounds-violations giver fejlindikation og blokerer download.
Snapshot beregnes stadig på de clampede værdier – clamping sker altid, også for fejlgivende bounds.

Mekanismen er: bounds-issues afledes fra den afsluttede inputprojektion, vises som rød kant + tooltip i
TAFPeriodeTable/SvieSmerteTable og gengives på EOberegningTab. De blokerer de dokumentdefinitioner, der afhænger af
felterne, også når snapshot fortsat kan beregnes på clampede værdier.
Adfærden er identisk for alle fejlgivende bounds uanset årsag (differencekrav, EET, mén).

**TAF fra-dato:**
- `< 2005-01-01`
- `< skadedato` (ikke-erhvervssygdom)
- `< anmeldelsesdato − 5 år` (erhvervssygdom)
- `> til-dato i samme række`

**TAF til-dato:**
- `< fra-dato i samme række`
- `>= differencekravDato`
- `>= beregnet endelig EET-virkningsdato` (når EET-afgørelse ikke er påklaget)
- `>= beregnet midlertidig EET-virkningsdato` (når EET-afgørelse ikke er påklaget **og** skadedato < 2011-06-16)

**Svie/smerte fra-dato:**
- `< 2005-01-01`
- `< skadedato` (ikke-erhvervssygdom)
- `< anmeldelsesdato − 5 år` (erhvervssygdom)
- `> til-dato i samme række`

**Svie/smerte til-dato:**
- `< fra-dato i samme række`
- `>= afgørelsesdato for varige mén` (når ménafgørelse ikke er påklaget)

**Overlap:** Overlap mellem rækker (TAF og svie/smerte): fejl i felt + EOberegningTab.

**Manglende datoer:** Manglende fra- eller til-dato på ikke-tom række: fejl kun på
EOberegningTab (ikke i felt), blokerer download.

**Ferieperioder i EO-oplysninger:** Ferieperioder clampes ikke og begrænses ikke af andre
indtastninger. De lægges ukritisk til grund som indtastet. Den eneste undtagelse er
rækkens egen datologik: `fra-dato > til-dato` eller `til-dato < fra-dato` er fejl på samme
niveau som tilsvarende rækkefejl for TAF- og svie/smerte-perioder.

### 2.3 Behandlingsrækkefølge for TAF- og svie/smerte-perioder (bindende invarianter)

Den fulde, trinvise behandlingsrækkefølge er udfoldet informativt i
`docs/architecture/eo-clamping-pipeline-architecture.md`. Kontrakten ejer følgende **bindende
invarianter** for rækkefølgen; pipeline-doc'en må aldrig modsige dem:

1. **Validering før relevansvurdering.** Semantisk validering (fejlgivende bounds, §2.2) sker
   på de afsluttede canonical rækker som sådanne – ikke først efter en relevansvurdering mod de
   clampede ranges. En ugyldig periode bliver ikke "reddet" af, at den senere ville være uden
   betydning for beregningsintervallet.

2. **Fejlgivende clamping FØR stille EO-periode-clamping.** Til-dato clampes mod de
   fejlgivende øvre grænser (TAF: strengeste af `differencekravDato − 1`, `endelig
   EET-virkningsdato − 1` og – ved skadedato < 2011-06-16 – `midlertidig EET-virkningsdato − 1`,
   alle ophævet ved `verserendeKlageEet = 'Ja'`; svie/smerte: `menAfgoerelseDato − 1` når
   ménafgørelsen er endelig) **før** den stille clamping mod EO-perioden. Rækkefølgen sikrer,
   at et bounds-issue ikke skjules af, at EO-perioden forinden har afkortet perioden.

3. **Løse feriedage er række-bundne pre-merge.** `loseFeriedage` på en TAF-række knyttes til
   den oprindelige indtastede række og placeres pre-merge – merge ændrer ikke placeringen.

4. **Merge er centraliseret.** Overlappende og tilstødende ranges slås sammen via den
   kanoniske `mergeIsoDateRanges(...)` / `mergeDateRanges(...)` i
   `src/domain/erstatningsopgoerelse/engines/isoRangeAlgebra.ts` (`mergeAdjacent: true`). Lokale,
   ad hoc merge-implementeringer i TAF-, svie/smerte-, ferie- eller SFGG-flow er arkitektonisk
   fejl, medmindre en kontrakt udtrykkeligt kræver afvigende merge-semantik.

5. **Ethvert svie/smerte-overlap afvises** – også overlap mellem perioder med samme tilstand.
   Validator og `svieSmerteEngine` afviser ethvert overlap, og tabel-/kontrollaget markerer det
   synligt før gem. Der findes ingen "samme tilstand er tilladt"-undtagelse.

6. **Ingen parallelle fallback-totaler.** EO-domænet kan have flere tekniske TAF-forbrugere
   (per-række/merged-output og snapshot-aggregation), men de skal følge samme autoritative
   domænesemantik: clampede ranges som beregningsgrundlag og ingen parallelle fallback-totaler.

### 2.4 Clampinggaranti

Clamping sker pre-snapshot i `computeEoSnapshot`. Engines arbejder **altid** på clampede
værdier – også når der vises fejl for fejlgivende bounds (§2.2).

`inspektionSnapshot` bygges eksplicit med de clampede ranges efter `buildTafRanges` er kaldt i
`computeEoSnapshot`, så EOInspektion aldrig viser TAF-dage der ikke indgik i beregningen.

I validerings-fejl-stien (autoritative totaler/PDF'er bygges ikke) bygges `inspektionSnapshot`
stadig med de **sektions-uafhængige** engine-data der kan beregnes sikkert: svie/smerte-engine
(afhænger ikke af løn-/TAF-validering) samt clampede TAF-ranges for de rækker der stadig kan
parses. Det giver EOInspektion samme clamping-billede for gyldige rækker, uden at vise dagtal der
ikke indgik i en autoritativ beregning. Er alle rækker ugyldige eller clampes bort, er `[]`
den forventede fail-closed kontrol-basis. I `fail_closed`-stien (uventet runtime-exception) er
`inspektionSnapshot` derimod `null`.
Kontrollaget må ikke lave nye fallback-enginekald for sektions-**afhængige** delresultater
(TAF-totaler, løn-afledte beløb). Når autoritativt engine-output mangler, skal kontrollaget vise
tom/ikke-beregnet tilstand i stedet for semi-autoritative beløb eller dagtal.

**Reguleringsforløbet er sektions-afhængigt og fail-closes derfor i validerings-fejl-stien**
(udviklerbeslutning): det viste reguleringsforløb er udelukkende
den kanoniske serie fra det autoritative `pdfModel` (ingen re-derivation), som netop ikke bygges,
når autoritativ beregning er blokeret. EOInspektion viser derfor reguleringsafsnittet som
placeholders (ingen indeks-/værditabeller), indtil valideringsfejlen er løst. Der må IKKE
genindføres en separat fejl-tilstands-serie for regulering; det ville kunne vise en tabel, der
ikke svarer til nogen autoritativ beregning.

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
er strukturelle feltissues og bliver derfor også snapshot-invariants for de consumers, der læser feltet.
De må gerne gemmes som schema-gyldigt canonical input, men må ikke fodre en autoritativ motor eller et
afhængigt dokument. Snapshottes autoritative `data` er derfor `null` i den blokerede gren; uafhængige
inspektionsgrene må fortsat eksponere de data, der ikke læser det fejlramte felt. Der beregnes ikke stiltiende
videre på en clampet værdi.

### 3.2 `blocksOutputs`

Projektions-targets (`EoProjectionTarget` i `eoSnapshotInvariants.ts`) er:
`'beregning' | 'inspektion' | 'eo_pdf' | 'taf_per_year_pdf' | 'taf_per_year_opreguleret_pdf'`.
Det opregulerede target dækker beregningsformen "TAF opreguleret til beregningsår", der bygger
oven på per-år-resultatet.

Invariants kan blokere specifikke outputs uden at stoppe beregningen. Den bindende regel er, at
en blokering af per-år-grundlaget også blokerer den opregulerede afledning, og at en
opregulerings-specifik fejl kun blokerer den opregulerede PDF:
- Kontroluoverensstemmelse blokerer: `['eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf']`
- TAF per år-afstemningsfejl over 100 øre blokerer: `['taf_per_year_pdf', 'taf_per_year_opreguleret_pdf']`
- TAF per år utilgængelig (manglende lønudvikling/TAF-indtægter) blokerer:
  `['taf_per_year_pdf', 'taf_per_year_opreguleret_pdf']`
- Manglende reguleringssats for opregulering
  (`taf_per_year_opreguleret:manglende_reguleringssats`, bygget af
  `buildTafPerYearOpreguleretManglendeReguleringssatsInvariant`) blokerer **kun**:
  `['taf_per_year_opreguleret_pdf']` – den påvirker ikke EO-PDF eller den ikke-opregulerede
  TAF-per-år-PDF.

**Visuel graf over indtægtsniveau** har bevidst *ikke* et eget projektions-target. Grafen
visualiserer netop TAF-per-år-dataene, så `eoSnapshotToTafKravGrafDocument` deler blokerings-target
med `taf_per_year_pdf`: kan TAF ikke fordeles på år, kan grafen heller ikke genereres. Et særskilt
`taf_krav_graf_pdf`-target ville derfor kun duplikere den eksisterende per-år-gate.

### 3.3 Afhængighedsopdeling: hvilken gren blokerer en rød feltfejl?

En rød reader-feltfejl blokerer **kun den beregningsgren, der faktisk læser feltet** – dependency-præcis
blokering pr. `form-contract.md` §2.3, som er den normative kilde. Hver gren bygger sit input gennem en
egen typed projektion med `createTrackedInputReader`. `blockedDependencies` afledes direkte af disse
projektioners issue-sæt for `svieSmerte`, `forlig`, `taf`, `oevrigeKrav` og aggregatnoden `aggregate`.

Der findes ingen manuel liste over descriptor-id'er eller collection-navne. En collection-projektion
enumererer de aktuelle rækker og læser hver relevant celle gennem dens bundne `FieldRef`. Dermed bliver en
ny motorafhængighed først en blocker, når den samtidig indgår i motorinputprojektionen, og en fjernet læsning
kan ikke blive stående som død blokeringsmetadata. `eoErrors` er fortsat kun en præsentationsprojektion og
må ikke bruges som beregningsgate.

Der er bevidst ingen `regulering`-gren: reguleringsforløbet har ingen egne felter, og en ugyldig manuel
reguleringscelle bor i lønudviklingens rækkesamlinger og blokerer derfor TAF-grenen, som er den, der læser
den. `oevrigeKrav` blokerer aggregatet, men ingen motorgren – cellerne evalueres i `EO_ROW_BUILDERS` med deres
egen download-gate.

**Forliget er en delvis S/S-afhængighed.** `computeSvieSmerteEngine` læser selv forligsgraden og skalerer
dagssats, maksimum og total med faktoren. Forligsfelterne ligger derfor **ikke** i S/S-gruppen: en rød
forligsprocent neutraliserer kun EFTER-forlig-felterne (`satserPerDagOre`, `satserMaxOre`, `forligFactor`,
`totalOre`), mens før-forlig-grundlaget består – udviklerbeslutning 1 (2026-07-25) kræver udtrykkeligt, at
før-forlig-resultater bevares. Motorens egen operationsrækkefølge er uændret; kun hvilke af dens beregnede
felter der eksponeres, ændres.

Reglen har to lige alvorlige fejlretninger:

- **For smal gruppe → falske tal.** Readeren maskerer en rød værdi til `undefined`. Kaldes motoren alligevel,
  regner den videre på et falsk input – fx en forligsprocent på 150 læst som "intet forlig" (100 %), eller
  et "Beregnet svie/smerte" udregnet som om tidligere udbetalt var 0.
- **For bred gruppe → overblokering.** Et ugyldigt svie/smerte-satsår må **ikke** fjerne den gyldige
  TAF-visning eller reguleringsforløbet. Overblokering er ikke en "sikker" fejl.

**Aggregatet er alt-eller-intet.** `totals.samletTotalOre`, `canonicalOutput` og `pdfModel` er krydsgående:
de summerer eller sammenstiller flere grene. De bygges derfor kun, når INGEN gren er blokeret – en sum af et
ukendt led er ukendt, og et dokument med et manglende afsnit er ikke autoritativt. `data` er `null` i den
situation, og det autoritative output har ingen halv-tilstand.

**De gyldige grene eksponeres gennem `readyBranches`, ikke kun `inspektionSnapshot`.** Snapshottet bærer på den
blokerede sti de grene, der stadig kunne beregnes sikkert (`svieSmerte`, `tafPerioder`; `undefined` =
"blokeret af sin egen røde afhængighed"). `eoSnapshotToBeregningView` falder tilbage til dem, så
Beregning-fanen fortsat viser den GYLDIGE TAF-periodisering, når et svie/smerte-felt er rødt – netop
udviklerbeslutning 2 (2026-07-25). Fanen læser kun snapshottet og ser ikke `inspektionSnapshot`, så et krav om,
at den delvise visning "lever i inspektionSnapshot", ville i praksis fjerne gyldige data fra brugeren.
`canonicalOutput` har bevidst **intet** fald-tilbage: det ER det krydsgående aggregat.

Fail-closed-backstoppet er aggregatnoden `blockedDependencies.aggregate`: ENHVER rød feltfejl gør aggregatet
ikke-autoritativt – også en, ingen gren genkender. En ukendt fejl må hverken forsvinde lydløst ud af gatingen
eller gættes ind i en vilkårlig gren.

### 3.4 Engine-throws er forbudt som primær fejlmåde

Engine-throws på forventelige brugerinputfejl er huller i preflight-dækningen.

Regler:
- Engines skal returnere nul-output via `buildZeroOutput` for kendte fejltilstande.
- Uventede engine-throws routes til `fail_closed` med `failClosedReason: 'runtime_exception'`.
- Alle forventelige brugerinputfejl skal opdages og rapporteres i validator eller som
  snapshot-invariants – ikke via engine-throws.

---

## 4. Snapshot-status

Snapshot-status sættes deterministisk:

| Status | Betingelse |
|---|---|
| `fail_closed` | System-/schema-/runtime-tilstand hvor snapshot-build ikke må levere autoritativ beregning. `data: null`, `failClosedReason` skal være sat, og PDF/kontrol må ikke bruge totals. |
| `error` med `data: null` | Forventelig bruger-/validatorblokering før autoritativ beregning, herunder `blocksAuthoritativeComputation`. Kontrollaget må kun bruge sikre delprojektioner. |
| `error` med `data` | Output-specifikke fejl der ikke stopper beregningen, men blokerer relevante outputs (fx kontroluoverensstemmelse, TAF-per-år-afstemningsfejl over 100 øre). Bounds-violations (§2.2) sætter ikke snapshot til `error`; de er inputissues, som dokumentdefinitionen aggregerer. |
| `warning` | Ingen errors, men mindst én warning-invariant er brudt |
| `ok` | Ingen brudte invariants |

Projektioner må ikke gætte på statusnavn alene. De skal også respektere `data`, `inspektionSnapshot` og `failClosedReason`. Ved `fail_closed` er totals og mellemregninger utilgængelige og må ikke vises som gyldige.

---

## 5. Snapshot-livscyklus og friskhed

Snapshot er bundet til et afsluttet `EvaluationSourceToken` – dvs. både den afsluttede inputrevision OG den relevante
settingsrevision (jf. `form-contract.md` §3 og `snapshot-contract.md` §10). En ændring i AppSettings gør snapshottet
stale på samme måde som en ændring i input.

**Regler:**
- `snapshot.sourceToken` skal altid svare til det ready `EvaluationSourceToken`, der blev brugt til
  den autoritative beregning.
- Hvis `snapshot.sourceToken` ikke matcher det aktuelle samlede token, er snapshot stale og må ikke bruges
  som grundlag for at konstatere kontroluoverensstemmelse eller anden blokering, der
  forudsætter et friskt snapshot.
- Ved visning af Beregning, EOInspektion og EOKontrolTabel skal et stale snapshot erstattes af en ny
  snapshot-build før normal visning fortsætter.
- Stale state er et refresh-behov, ikke en systemfejl.

Rationale: Kontroluoverensstemmelse og output-gating må kun vurderes på samme afsluttede
input, ellers risikerer systemet at blokere på baggrund af forældede mellemresultater.

---

## 6. EOInspektion og EOKontrolTabel – altid-kan-dannes garanti

EOInspektion og EOKontrolTabel **kan altid dannes** fra snapshot-data.

**Manglende datoer er forventelig adfærd:** Manglende fra- eller til-datoer på
TAF/svie-smerte-rækker betyder blot, at brugeren endnu ikke har udfyldt dem. Det er
ikke en systemfejl. EOInspektion viser de clampede værdier korrekt. Ingen `BugReportButton`
vises i EOInspektion eller EOKontrolTabel.

Validator og snapshot-invariants klassificerer manglende datoer som fejl – det sker
i EOberegningTab, ikke i EOInspektion-visningen.

Hvis `inspektionSnapshot` er `null` (ved `fail_closed` før engines kørte), vises en passende
tom-/fejltilstand uden at forsøge at rendere beregningsindhold.

For reguleringsformer med en selvstændig kildeserie skal EOInspektion læse motorens
`ReguleringForloeb` fra snapshotets lønudviklingsmodel. Kontrol- og dokumentlag må ikke genindlæse
statistik-, KRL-, KL-lønaftale- eller manuel-procentsatsserier fra rå data. Kontrollaget må og skal
fortsat genberegne selve indeksforholdet ud fra serien som et uafhængigt aritmetisk krydstjek.

---

## 7. `tidligereModtagetTaf`-isometri

Tom afsluttet canonical værdi (`undefined`) for `tidligereModtagetTaf` repræsenterer semantisk `0 kr`.

**Regel:** I snapshot/totals og alle projektioner (Beregning-tab, EOInspektion, PDF) skal dette
normaliseres til numerisk `0` (MoneyOre). `null` eller `undefined` må ikke propagere som
resultat af at feltet er tomt.

Rationale: Tomt felt er et tilladt og neutralt brugervalg – brugeren har ikke modtaget
tidligere TAF-udbetalinger, eller beløbet er ikke oplyst. Begge tolkes som `0 kr.` fradrag.
Der er ingen semantisk forskel på "0" og "tomt" for dette felt.

---

## 8. Fejlrapportering og PDF-output

1. `BugReportButton` i EO-scope styres normativt af `src/contracts/error-contract.md`.
2. Dokumentgating, toggle-guards og semantisk fravalg styres normativt af `src/contracts/document-output-contract.md` (afsnit A).

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
- PDF-, kontrol- og view-lag må ikke betinge SFGG-referenceperiode-indhold på `values.beregnesUdFra === 'Beregningsperiode'`.

Tilladte relationer:
- SFGG må gerne forholde sig til TAF-forløbet som sygeforløb, fx ved kravet om at SFGG-referenceperioden skal ligge før første TAF-dag/periode.
- SFGG må gerne bruge TAF-beregningsenheden (`Måneder`/`Arbejdsdage`) dér hvor domænet eksplicit kræver det for kalenderdage vs. arbejdsdage.

Disse undtagelser ændrer ikke hovedreglen: TAF-beregningsperioden og SFGG-referenceperioden er
to forskellige inputdomæner og må ikke sammenblandes.

Interne navngivningsregler:
- Tvetydige interne symboler for TAF-beregningsperioden skal navngives med `taf`-præfiks, fx `tafBeregningsperiode`.
- Tvetydige interne symboler for SFGG-referenceperiode eller SFGG-afledte satser skal navngives med `sfgg`-præfiks, fx `sfggReferenceperiode`, `sfggReferencesats` og `sfggSource`.
- Persisted schemafelter er kun undtaget fra denne regel, når stabile load/save-kontrakter kræver eksisterende feltnavne.

Historisk load-kompatibilitet:
- TAF's aktuelle persisted felter hedder `tafBeregningsperiodeFra`/`tafBeregningsperiodeTil`. Ældre `.eo`-filer med
  `periodeTilBeregningFra`/`periodeTilBeregningTil` oversættes af den eksakte load-migrator, før schema-sanitization.
- SFGG-rækkens aktuelle persisted felter har `sfgg`-præfiks. Ældre rækkefelter uden præfiks oversættes tilsvarende
  til `sfggBeregningskilde`, `sfggReferenceperiodeFra`, `sfggReferenceperiodeTil`,
  `sfggReferenceperiodeFravaersdageUdenLoen`, `sfggManuelDagssats`, `sfggManuelBeloebIHenholdTil`,
  `sfggManuelFoerstEfterSygeloen`, `sfggSatsvalg` og `sfggAlleredeBetaltBeloeb`.
- De tidligere EET-feltnavne med `Eet` og de tidligere Ja/Nej-feltnavne for svie/smerte og TAF er registrerede
  load-aliaser. De aktuelle runtime-navne er fortsat de eneste canonical navne.
- De historiske udviklingsfelter `opsagtFraStilling` og `sfggSygeperioderFoer2015` er ikke længere aktuelle sagsdata
  og fjernes eksplicit uden preflight under load.
- Mappings er versionsstyrede, typed og testet. Hvis en historisk værdi ikke kan oversættes entydigt, må en ny
  load-fejl eller preflight ikke indføres uden udviklerens forudgående godkendelse.

## 12. EO-feltklassificering og bounds-model

EO-specifik feltklassificering, fejlgivende bounds og stille clamping er normativt defineret i §2.

## 13. Typed EET-importport og transient injection

Når togglen `midlertidigtEetFraEetSiden` på *Offentlige ydelser*-fanen er aktiveret (`'Ja'`),
injiceres rækker fra EET-siden transient i EO-beregningen – uden at de skrives til inputaggregatet. Dette afsnit er
normativt for, hvordan injectionen indvirker på snapshot-modellen.
EET-sidens tilsvarende kontrakt er `src/contracts/eet-snapshot-contract.md` §5; ændringer i
EET-issues eller EET-importprojektion skal vurderes mod begge kontrakter.

**Inputkilder:**
- Når togglen er `'Ja'`, modtager `computeEoSnapshot` en typed EET-import-context som
  førsteklasses snapshot-input. Contexten bygges og Zod-valideres af EET-domænets importport
  før EO-snapshotkaldet og indeholder canonical importgrupper, issues og revisionsidentitet;
  EO må ikke modtage rå EET-values eller selv orkestrere EET-engines.
- Snapshot-revisionen skal derfor inkludere både `erhvervsevnetab`- og
  `faellesAarsloen`-sektionernes revisioner, så cachen invalideres korrekt ved EET-ændringer.
  Revisionen skal inkludere EO, stamdata, EET og `faellesAarsloen` deterministisk, uanset om togglen aktuelt er `'Ja'` eller `'Nej'`; togglen ændrer semantik, ikke cache-invalideringsgrundlag.
- Hvis import-context mangler, er schema-ugyldig eller bærer en source-/runtimefejl, selv om
  togglen er `'Ja'`, skal importen fail-close med tomme grupper og en eksplicit blokerende
  issue. EO må ikke gætte, skrive defaults eller maskere tilstanden som en gyldig tom import.
- Når togglen er `'Nej'`, ignoreres EET-import-context fuldstændigt, og EO-beregningen
  påvirkes ikke af EET-data.
- En kanonisk EO-adapter omsætter import-contexten til virtuelle grupper og EET-issues i ét
  trin. Kaldere må ikke beregne grupper og issues via separate kald eller genberegne EET.

**Substitution af effektive rækker:**
- Når togglen er `'Ja'`, bygges en effektiv `offentligeYdelserRows` ved at:
  1. Filtrere eksisterende `midlertidigt_eet`-rækker væk fra den originale canonical inputprojektion – defensiv håndhævelse af §13's *Single source of truth*-invariant, så en importeret række aldrig kan optræde både canonical og virtuelt.
  2. Tilføje de virtuelle rækker, som den canonical EO-adapter bygger fra import-contextens grupper.
- Engines, inspektions-snapshot, presentation-model og PDF-model bygges på den effektive værdi.
- Snapshotets audit-projektion indeholder altid det oprindelige afsluttede canonical input (uden virtuelle rækker), så
  save/load round-trip og UI-visning er upåvirkede. Audit-projektionen er ikke en rå consumer-bypass.
- EO-importen bruger EET-løbende-ydelser-beregningen med TAF-periodens seneste clampede
  slutdato som slutdato for de virtuelle midlertidigt EET-rækker. EET-sidens egen
  løbende-ydelser-visning bruger fortsat EET-beregningsdatoen.
- **Beregningsdato-fallback (kun EO-import):** Når brugeren ikke har udfyldt en beregningsdato
  på erhvervsevnetab-siden, bruger EO-importen TAF-periodens clampede slutdato (capped af
  EO-periodens slutdato, `vedroererPeriodeTil`) *også* som beregningsdato, så manglende
  EET-beregningsdato ikke blokerer importen. Fallback'en leveres teknisk via
  EET-importportens eksplicitte `eo_import`-context og gælder udelukkende EO-importen –
  erhvervsevnetab-siden og differencekrav-grafen bruger side-contexten, så
  beregningsdatoen forbliver påkrævet dér. Findes der ingen TAF-periode (ingen fallback-slutdato),
  fail-closer importen fortsat på manglende beregningsdato.
- Hver beregnet EET-løbende-ydelsesrække fra midlertidige og delvist endelige afgørelser splittes
  internt pr. kalendermåned til virtuelle EO-rækker (`buildMidlertidigtEetCalculationRows`), så den
  eksisterende kalenderdags-periodisering inden for rækken svarer til x/dage-i-måneden og ikke et
  gennemsnit over hele EET-perioden. Periodernes samlede beløb bevares.
- Importportens beløb er `MoneyOre`. EO-adapteren konverterer først til kroner, når den
  konstruerer den eksisterende `AmountValue` til den virtuelle række; der må ikke være en
  tidligere krone-float-grænse mellem EET og EO.

**Autoritativt midlertidigt EET-fradrag (kanonisk kilde):**
- Det beløb der faktisk trækkes fra i TAF-beregningen for `midlertidigt_eet` afledes af den
  KANONISKE, pr.-periode-afrundede bilagskilde
  `sumMidlertidigtEetBeregnetEetKronerForTafRanges` (bygget på
  `buildMidlertidigtEetPdfGroupsForTafRanges`), IKKE af den urundede totalsum rundet én gang.
  Både hovedopgørelsens "Indtægter i erstatningsperioden"-linje (`buildTafIndtaegterModel`) og
  per-år-fordelingen (`tafPerYearDerived`) bruger denne kilde, så det fradragne beløb er identisk
  med "Midlertidig EET"-bilagets sammentælling bit for bit. (Runding pr. periode ≠ runding af
  totalen; forskellen var 42.790/42.791-fejlen.)
- De virtuelle rækker (`buildEoValuesWithTransientMidlertidigtEet`) bevares og fødes fortsat RÅT
  (urundet) til EO-inspektionens sammentælling/kontroltabel og til beregningsperiode-projektionen
  (`buildOffentligeYdelserUdviklingModel`). Disse rå stier er bevidst uafhængige af den kanoniske
  fradragsrunding: sammentællingen verificerer periodiseringen (rå = rå), og
  beregningsperiode-projektionen er en anden størrelse (hypotetisk fremskrevet indkomst lagt TIL
  TAF, ikke et fradrag). De må ikke kanoniseres til bilagssummen.

**PDF-bilag:**
- "Midlertidig EET"-bilaget renderes kun når togglen er `'Ja'` *og* der findes afgørelser fra EET-siden.
  Når togglen er `'Nej'`, sendes en tom `midlertidigtEetGroups`-array til PDF-renderen, uanset om
  EET-siden har afgørelser.
- Dokumentprojektionen for "Offentlige ydelser" modtager de oprindelige manuelle rækker fra den godkendte
  audit-/dokumentprojektion (ikke fra effektive rækker), så bilaget aldrig viser virtuelle rækker. Generatoren læser
  ikke direkte fra inputaggregatet.

**Issues fra EET-løbende-ydelser:**
- Når togglen er `'Ja'`, bruger EOberegningTab samme canonical import-context/projektion
  som snapshot-laget og viser EET-issues (errors og warnings) i "Fejl og advarsler" med link
  til Erhvervsevnetab-siden. Errors blokerer download af **alle fire** Beregning-fane-dokumenter
  (erstatningsopgørelse, TAF fordelt på år, TAF opreguleret til beregningsåret og Visuel graf over
  indtægtsniveau) via gatens `hasBlockingRows` – samme adfærd som det øvrige `errors`-array fra
  rækkeevalueringen. Blokeringen får klassen `page-errors`, fordi fejlen allerede står i "Fejl og
  advarsler" (`document-output-contract.md` §A5.1).
- Når togglen er `'Nej'`, vises EET-issues ikke (de er irrelevante for EO-beregningen, fordi
  koblingen er deaktiveret).
- EET-issues overføres som udgangspunkt ukritisk. Det betyder, at en EET-fejl kan blokere
  EO/TAF-output, selv om den konkrete importregel ikke bruger det pågældende EET-input som
  beregningsafgrænsning. Eksempel: en ugyldig EET-procent blokerer importen, selv om den ikke
  i sig selv handler om TAF-afgrænsningen. Dette er et bevidst designvalg for at undgå manuel
  klassificering af hver enkelt EET-issue.
- **To bevidste undtagelser fra den ukritiske propagation:**
  1. *Manglende EET-beregningsdato* blokerer ikke længere, fordi EO-importen falder tilbage på
     TAF-slutdatoen som beregningsdato (se beregningsdato-fallback ovenfor).
  2. *De beregningsdato-relative advarsler* – afgørelsesdato/virkningsdato/kapitaliseringsdato
     efter beregningsdatoen – undertrykkes i EO-konteksten. På EO-siden er "beregningsdatoen"
     blot TAF-slutdatoen, og en EET-afgørelse med virkning efter erstatningsperiodens udløb er
     helt normal (fx en opgørelse lavet før EET-afgørelsen). Filtreringen sker ved
     EO-importgrænsens adapter via den eksporterede konstant
     `EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS`; erhvervsevnetab-sidens egen visning
     er upåvirket. Øvrige EET-advarsler (under 15 %, ugyldig EET-procent efter 1.7.2024,
     midlertidig/delvist endelig efter endelig) er kontekst-uafhængige og vises fortsat begge steder.
- Hver ny eller ændret EET-issue-type skal revurdere denne EO-konsekvens og opdatere
  `eet-snapshot-contract.md` og dette afsnit, hvis propagation ikke længere er sikker.
- "Ingen relevante EET-rækker" og "EET-import-contexten mangler eller kunne ikke valideres"
  er forskellige tilstande. Førstnævnte kan være funktionelt tomt. Sidstnævnte skal altid
  materialiseres som en blokerende issue og må ikke maskeres som tom import.

**Single source of truth:**
- Når togglen er `'Ja'`, er EET-siden den eneste kilde til midlertidigt EET-data.
  Manuelle `midlertidigt_eet`-rækker er hverken mulige (ydelsestype-option deaktiveres i
  dropdown'en) eller persisterede (filtreres væk ved toggle-aktivering).
- Invarianten "ingen manuelle midlertidigt_eet-rækker når toggle er TRUE" håndhæves både
  i UI'et (popup ved aktivering hvis der findes manuelle rækker) og defensivt i beregningen
  (filter i `buildEoValuesWithTransientMidlertidigtEet`).

## 14. Neutralisering af irrelevante (skjulte) input

Efter den transiente EET-injection (§13) neutraliseres irrelevante input i `effectiveEoValues`
via `neutralizeIrrelevantEoInputs` (`helpers/eoInputRelevance.ts`), før engines, inspektions-snapshot,
presentation-model og PDF-model bygges. Afsnittet er normativt.

**Princip:** Et felt eller en række er *relevant*, hvis den er synlig i UI'en, fordi den
indgår i den konkrete opgørelse. Synlighed defineres af relevans-predikaterne i
`eoInputRelevance.ts`, som er den **eneste** autoritative kilde og deles med UI'ens
conditional rendering – "skjult i UI" og "ignoreret i beregning" må ikke kunne divergere.
Irrelevante inputs neutraliseres til deres tomme værdi (`undefined` / `[]`), så ingen motor
kan læse en forældet skjult værdi (fail-closed). Committed form-state mutateres ikke;
`snapshot.input.erstatningsopgoerelse` bevarer den oprindelige værdi (som §13).

**Aktuelle relevans-regler:**
- `svieSmerteTidligereTotal` er kun relevant fra og med 2. opgørelse. Ved første opgørelse er
  feltet skjult og neutraliseres, så et evt. indtastet beløb ikke fradrages svie/smerte-loftet.
- Svie/smerte-periodeinput (`svieSmertePerioder`, `svieSmerteSatserAar`, `svieSmerteAktuelPeriode`)
  neutraliseres når sektionen ikke er aktiv (`kravPaaSvieSmerteGodtgoerelse !== 'Ja'`) eller
  "tidligere beregnet S/S til max" er slået til.
- TAF- og ferieperioder (`tafPerioder`, `ferieperioder`) og øvrige-krav-rækker
  (`oevrigeKravPerioder`) neutraliseres når den respektive sektion ikke er aktiv.
- Kun rækker med faktisk indhold blankes; tomme placeholder-rækker bevares (de påvirker
  ikke beregning).

**Bevidst undtagelse – komprimering ved EO 2+:** Når
`komprimerBeregningEfterFoersteOpgoerelse === 'Ja'` fra og med 2. opgørelse, skjules
løn-/beregningsgrundlags-felterne (`beregnesUdFra`, beregningsperiode, fravær, angivet løn,
lønindkomst, lønudvikling, anciennitet) i UI'en, men de forbliver **aktive** input: tabt
arbejdsfortjeneste genberegnes fra dem. Disse felter neutraliseres derfor ikke. Mode-gating
af det aktive løn-felt (afhængigt af `beregnesUdFra`) ejes fortsat af indkomst-motoren.

## 15. Datoordlyd for anvendt reguleringsdato

EO bruger `resolveAnvendtReguleringsdato` som autoritativ dato for løn-/reguleringsbasis:

- Ved `Beregningsperiode`: `saerligFraDatoRegulering` hvis udfyldt, ellers
  `tafBeregningsperiodeTil`, og ellers stamdatadatoen mens beregningsperioden endnu ikke er udfyldt.
- Ved angivet månedsløn/dagsløn: den relevante angivne opreguleringsdato hvis udfyldt, ellers
  stamdatadatoen.
- Valg af `Manuelt angivet` eller `Manuel procentsats` opretter atomisk den valgte forms canonical basisrække
  sammen med valget, både under Lønindkomst og ved angivet dags-/månedsløn på EO-oplysninger.
- Første række er for begge former en programstyret basisrække. Datoen er altid read-only og viser datoen
  ovenfor; ved `Manuel procentsats` er basisprocenten altid 0 %. En manglende basisdato vises som rød ramme
  med en tooltip, der navngiver det faktisk manglende stamdatafelt.
- Tabellen skal også ved ældre eller ufuldstændig state uden canonical basisrække behandle første synlige række
  som programstyret og må aldrig degradere datocellen til en redigerbar placeholder.
- Alle efterfølgende rækker i den aktive manuelle reguleringsform skal have en dato, der er strengt senere end
  basisdatoen i den låste første række. En dato før eller lig basisdatoen er en rød feltplaceret regelfejl med
  den konkrete basisdato i tooltippet og blokerer afhængig beregning og dokument-output. Reglen gælder ens for
  `Manuelt angivet` og `Manuel procentsats`, både under Lønindkomst og ved angivet dags-/månedsløn.
- Bevarede rækker i en inaktiv reguleringsform udløser ikke denne fejl. Beregnings- og præsentationsmotorerne
  afviser desuden defensivt rækker på eller før basisdatoen, hvis en consumer kaldes uden om den normale gate.

Al brugervendt tekst i felter, tooltips, kontrolvisning og dokument-output skal beskrive datoens
faktiske kilde:

- Den generiske formulering `anvendt reguleringsdato` må ikke bruges brugervendt som label for
  selve datoen. Teksten skal i stedet navngive den dato, der faktisk genbruges.
- Når en brugervendt tekst omtaler datoen, skal selve datoen vises bagefter i parentes i formatet
  `DD-MM-ÅÅÅÅ`, medmindre datoen mangler.
- Hvis datoen er stamdatadatoen, skrives `skadedato(en)` kun ved `Arbejdsulykke`.
- Ved `Erhvervssygdom` skrives altid `anmeldelsesdato(en)` for stamdatadatoen; `Skadedato` må ikke bruges
  i den kontekst.
- Hvis skadestype mangler, bruges arbejdsulykke-ordlyd som fallback (`skadedato(en)`), fordi
  brugeren endnu ikke har valgt, om sagen er en erhvervssygdom.
- Hvis stamdatadatoen mangler, må datoafhængige overskrifter ikke opfinde eller vise en dato.
  Satsoverskrifter skal fx falde tilbage til den neutrale `Satser`, mens fejltekst fortsat må pege
  på det manglende stamdatafelt (`Skadedato er ikke udfyldt` / `Anmeldelsesdato er ikke udfyldt`).
- Hvis datoen er `tafBeregningsperiodeTil`, skal teksten beskrive den som beregningsperiodens
  slut/udløb.
- Hvis datoen er `saerligFraDatoRegulering`, skal teksten beskrive den som manuelt angivet/anvendt
  reguleringsdato.
- Indkomstgrundlagets sektionsoverskrift skal bruge den konkrete stamdatareference:
  `Indtægt før skadedatoen` ved arbejdsulykke og `Indtægt før anmeldelsesdatoen` ved
  erhvervssygdom. Kontekst uden adgang til skadestype skal bruge en neutral titel, fx
  `Indkomstgrundlag`, frem for at gætte.

Den kanoniske tekstafledning ligger i
`src/domain/erstatningsopgoerelse/helpers/eoDateReferenceText.ts` og skal genbruges frem for lokale
strengsammenligninger i UI, kontrol- eller dokumentlag.
