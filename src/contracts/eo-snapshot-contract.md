# Mineo – EO Snapshot-kontrakt

**Version:** 1.0
**Status:** Normativ og gældende
**Type:** Domænekontrakt
**Formål:** At fastlægge bindende regler for `computeEoSnapshot`, clampingmodel,
invariant-klassificering, snapshot-livscyklus og projektionsgarantier i EO-domænet.

**Prioritet:** Underordnet samtlige tværgående kontrakter jf. `contract-topology.json` (herunder `form-contract.md`, `domain-boundary-contract.md`, `persistence-contract.md` og `snapshot-contract.md`), som alle går forud ved konflikt.
**Senest verificeret mod kode:** 2026-11-27

---

Dette dokument er **normativt**.
Kode, der afviger fra denne kontrakt, betragtes som **arkitektonisk fejl**.

---

## 1. Én autoritativ entry

`computeEoSnapshot` er den eneste beregnings-exit for EO. Den kaldes af `buildErstatningsopgoerelseReaderProjection`
med værdier læst gennem én `InputReader`-revision og grenenes dependency-projektion. Inputgrænsen og forbuddet mod
parallelle beregninger i UI, kontrol og dokumentlag følger `snapshot-contract.md` §2–§3.

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
- Engines arbejder altid på de clampede værdier som snapshot-orchestreringen leverer.
- Afsluttet canonical input ændres aldrig af clamping.

### 1.1. Beregnet og vist regulering er samme resultat

- TAF-afhængighedsinput og EO's visningsinput skal gennem samme autoritative satsprojektion.
  Separat dependency-tracking må ændre, hvilke feltissues der spærrer en gren, men aldrig hvilke satser
  grenen beregner med. Den beregningsklare inputport er nominal og kan ikke erstattes af rå persisted input.
- Alle reguleringsformer emitterer et schema-valideret reguleringsbevis sammen med hvert anvendt segment:
  referencegrundlag, periodegrundlag, præcis faktor, anvendt procent efter formens afrunding og relevante
  formelkomponenter. KL-lønaftaler bevarer trinvis afrunding på lønnen og periodens egen procent.
- Reguleringsværdier, beregnet regulering, kontrolvisning, PDF og Word formatterer motorens grundlag og
  resultat. De må ikke vælge alternative referencesatser, genopbygge lønpakker eller beregne et nyt indeks.
  En sammensat lønpakke dateres tidligst ved den seneste ikrafttræden af dens komponenter, fx 1. januar
  2024 når Store Bededagstillægget indgår sammen med en grundløn fra 2023. Den må ikke vise tillægget som
  gældende allerede i 2023 eller erstatte satsdatoen med en vilkårlig senere reguleringsdato.
- Canonical-output-grænsen kontrollerer forbindelsen mellem grundlag, faktor, anvendt procent og
  segmentbeløb. Manglende eller modstridende motorgrundlag må ikke blive et gyldigt dokument.
- Grafens indtægtskilder, perioder og niveauer læses gennem samme indkomstmotor med
  `data.tafCalculationInput`, som nettoberegningen bruger. Grundlaget inkluderer satsprojektion,
  relevans og transient midlertidigt EET; `snapshot.input` er det oprindelige brugerinput og må
  ikke bruges til at genopbygge grafens indkomstgrundlag. Årsfordelingen bruger også dette
  effektive TAF-input og nettomotorens resultater; opreguleringen bygger videre på årsresultatet.
- Hovedopgørelsens og årsfordelingens faktiske indkomstfradrag dannes begge af
  `buildTafIndtaegterBeregning`. Periodiseringsmotoren leverer alle ansættelser og ydelsestyper;
  den fælles fradragsprojektion ejer navngivning, rækkefølge, beløbsafrunding og koblingen til
  EET-bilagets periodeafrundede beløb. Årsfordelingen må ikke have sin egen parallelle
  konvertering fra rå indkomst til fradrag. Sygeferiegodtgørelse tilføjes fra samme selvstændige
  SFGG-motorresultat som i hovedopgørelsen.
- Grafen viser faktiske indtægtsniveauer pr. måned eller arbejdsdag, ikke størrelsen af
  TAF-kravet. Den deler effektivt input og periodiseringsmotor med indkomstfradraget, men
  dens samples, omregning til niveau og visuelle brobygning er en særskilt præsentation.
  De må aldrig bruges til at beregne eller afstemme opgørelsernes kronebeløb.
- Grafen viser hvert ansættelsesforhold som en selvstændig serie, også ved ens arbejdsstednavne
  (udviklerens afgørelse). Serieidentiteten følger ansættelsesforholdets id; ydelsesserier følger
  ydelsestypen. Visningsnavnet må ikke sammenlægge forskellige kilder.
- Har et graf-sample ingen arbejdsdage efter feriefradrag, fordeles en eventuel indkomst over periodens
  hverdage eksklusive SH, før feriefradrag (udviklerens afgørelse). Eksempel: 6.000 kr. i februar 2024 med
  ferie hele måneden fordeles over 21 hverdage i grafen. Hver kildes niveau afrundes til øre. Dette ændrer
  ikke indkomstfradrag, TAF-arbejdsdage eller krav i opgørelserne.
- Grafens visuelle normalisering er udtømmende: huller uden arbejdsdage brobygges, ferie uden indkomst på
  mindst tre arbejdsdage vises som et bånd, og et SH-dyk i sygedagpengeserien udjævnes. Ethvert andet udsving
  i et positivt indtægtsniveau vises. En negativ måned vises som intet indtægtsniveau; et negativt bånd ville
  kræve et nyt grafdesign og er fravalgt (årsfordelingen viser negative år, jf. §10).
- Grafens farver, størrelser og placeringer ændres ikke som smagssag – kun dokumenterede tegnefejl, efter
  forelæggelse for udvikleren.
- En uafhængig kontrol må efterregne resultatet, men aldrig levere alternative reguleringstal til den normale
  visning. Uden canonical segmenter må kontrollen ikke fremstille et syntetisk beregnet reguleringsforløb.
- Save og load ændres ikke af dette runtime-resultat. Afledte basisprocenter genskabes gennem den fælles
  satsprojektion uden at ændre tidligere gyldige filers brugerinput eller indføre ny preflight.

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
canonical værdier. Ligger alle TAF-perioder uden for EO-perioden, giver «Fejl og advarsler» den gule linje
«Der er indtastet TAF-perioder, men ingen af perioderne ligger inden for EO-perioden. TAF beregnes derfor til
0 kr.»; er der slet ingen TAF-periode i EO-perioden, «Der er ikke angivet nogen TAF-periode i EO-perioden».

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
`TafPeriodeTable`/`SvieSmerteTable` og gengives på EOberegningTab. De blokerer de dokumentdefinitioner, der afhænger af
felterne, også når snapshot fortsat kan beregnes på clampede værdier.
Adfærden er identisk for alle fejlgivende bounds uanset årsag (differencekrav, EET, mén).

**Afskæringsdatoerne** (`resolveTafCutoffDates`, `validation/tafPeriodConstraints.ts`):
- differencekravets dato («Evt. differencekrav opgjort per»);
- den endelige EET-dato: virkningsdatoen, ellers afgørelsesdatoen – når EET ikke er påklaget
  (`verserendeKlageEet !== 'Ja'`);
- den midlertidige EET-dato: virkningsdatoen, ellers afgørelsesdatoen – når EET ikke er påklaget **og**
  skade-/anmeldelsesdatoen ligger før 16-06-2011 (`TAF_MIDLERTIDIG_EET_SKAERINGSDATO`). Grænsen læser
  `stamdata.skadedato`, som ved erhvervssygdom er anmeldelsesdatoen; reglen gælder også erhvervssygdomme;
- for svie/smerte: datoen for ménafgørelsen, når `varigeMenAfgorelse = 'Ja'` og `verserendeKlageMen = 'Nej'`.

**TAF fra-dato:**
- `< 2005-01-01`
- `< skadedato` (ikke-erhvervssygdom)
- `< anmeldelsesdato − 5 år` (erhvervssygdom; dog aldrig før 2005-01-01)
- `> til-dato i samme række`
- `>=` en afskæringsdato (hele perioden ligger efter afskæringen)

**TAF til-dato:**
- `< fra-dato i samme række`
- `> dags dato`
- `>=` en afskæringsdato

**Svie/smerte fra-dato:**
- `< 2005-01-01`
- `< skadedato` (ikke-erhvervssygdom)
- `< anmeldelsesdato − 5 år` (erhvervssygdom)
- `> til-dato i samme række`
- `> dags dato`
- `>=` ménafgørelsens dato

**Svie/smerte til-dato:**
- `< fra-dato i samme række`
- `> dags dato`
- `>=` ménafgørelsens dato

Afskæringsteksterne siger «på eller efter» (fx «Der er angivet svie/smerte på eller efter datoen for en
ménafgørelse (DD-MM-ÅÅÅÅ)»). Rækkelinjen nævner hver afskæring én gang, eller «Hele perioden ligger på eller
efter …», når fra-datoen også rammer den. En ufuldstændig række med en afskæringsfejl viser både manglen og
afskæringsbeskeden, og linket peger på den udfyldte røde dato.

**Overlap:** Overlap mellem rækker (TAF, svie/smerte og ferieperioder): fejl i felt + EOberegningTab.

**Manglende datoer:** Manglende fra- eller til-dato på ikke-tom række: fejl kun på
EOberegningTab (ikke i felt), blokerer download.

**Dækningsadvarsler venter på afviste datoer.** Advarslerne om, at TAF- eller svie/smerte-krav ikke er rejst for
hele perioden, vises ikke, mens en relevant dato (periodedato, differencekravets dato, en EET- eller
ménafgørelsesdato) er afvist tekst (`kanDaekningIkkeVurderesPgaAfvistInput`); dækningen kan da ikke vurderes.

**Ferieperioder i TAF-afsnittet:** Ferieperioder clampes ikke. Når TAF-kravet er «Ja» – også uden TAF-rækker –
er hver ferie-dato en rød, blokerende celle (`collectFerieperiodeBoundIssues` i `tafRowCellIssues.ts`), når
den ligger før skade-/anmeldelsesdatoen (ved erhvervssygdom: mere end 5 år før anmeldelsesdatoen), før
01-01-2005, efter dags dato eller på/efter en TAF-afskæringsdato. Teksterne navngiver grænsen, fx «Ferien ligger
før skadedatoen (DD-MM-ÅÅÅÅ)», «Ferien ligger efter dags dato (DD-MM-ÅÅÅÅ)» og «Ferien ligger på eller efter den
dato, differencekravet er opgjort pr. (DD-MM-ÅÅÅÅ)». Rækkens egen datologik (`fra-dato > til-dato`) og overlap
mellem ferieperioder er fejl på samme niveau som for TAF- og svie/smerte-rækker. En ferierække med kun
fra-dato giver uden TAF-rækker en gul, ikke-blokerende linje («Ferieperioden fra DD-MM-ÅÅÅÅ: Til-dato er ikke
angivet»); med TAF-rækker er samme mangel en blokerende fejl.

### 2.2a TAF efter kapitaliseringen af en delvist endelig EET-afgørelse (gul advarsel, ingen clamping)

Udviklerens afgørelse:

- **Udgangspunktet** er, at en delvist endelig EET-afgørelse i forhold til TAF behandles som en endelig
  erhvervsevnetabsafgørelse: retten til TAF ophører på kapitaliseringstidspunktet.
- Der kan dog hypotetisk opstå sager, hvor TAF alligevel fortsætter efter kapitaliseringen. Reglen er derfor
  **ikke** en fejlgivende bound efter §2.2 og ikke en clamping efter §2.1: beregningen er uændret.
- **Absolut krav:** ligger en TAF-rækkes beregnede periode (efter §2.1/§2.2's grænser) på eller efter
  kapitaliseringsdatoen for en delvist endelig afgørelse på Erhvervsevnetab-siden, SKAL brugeren have besked –
  som en **gul, ikke-blokerende** advarsel: gul ring på rækkens til-dato (og fra-datoen, når hele perioden ligger
  efter) og en linje i «Fejl og advarsler» med link til rækken. Advarslen må aldrig blive blokerende og må aldrig
  tie af andre grunde end, at TAF ikke når kapitaliseringen: hverken togglen for midlertidigt EET eller en
  verserende EET-klage tavser den.
- Datoen er inklusiv som §2.2's datoer. Har flere delvist endelige afgørelser en kapitaliseringsdato, er den
  tidligste afgørende.
- Datoerne læses gennem EET-portens `resolveDelvistEndeligeKapitaliseringsdatoer` efter
  `domain-boundary-contract.md` §9 pkt. 11; reglen er `resolveTafEfterKapitaliseringAdvarsler`
  (`validation/tafEfterKapitaliseringAdvarsel.ts`), og snapshottet modtager dens issues som
  `tafEfterKapitaliseringIssues`. Gælder også tidligere gemte `.eo`-filer: de får advarslen ved load, uden
  preflight og uden ændret sagsdata.

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
   EET-dato − 1` og – ved skade-/anmeldelsesdato før 2011-06-16 – `midlertidig EET-dato − 1`,
   EET-datoerne ophævet ved `verserendeKlageEet = 'Ja'`; svie/smerte: `menAfgoerelseDato − 1` når
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

5a. **Alle overlap er ugyldige, og indtastede perioder omfortolkes ikke** (udviklerens afgørelse).
   Programmet må ikke ændre eller fortolke de perioder, brugeren indtaster, for at få
   dem til at passe – heller ikke når overlappet kun er én delt dag. Intervallerne er LUKKEDE, så to
   perioder, der blot deler en endedato (`til = 01-03` og `fra = 01-03`), overlapper og er ugyldige.

   Reglen gælder ENHVER periodesammenligning: svie/smerte-, TAF- og ferie/fraværsrækker indbyrdes
   (`periodOverlapDetection`) og beregningsperiode mod TAF-periode (`beregningsperiodeTafOverlap`).
   Begge skal derfor bruge den kanoniske intervalalgebra i `utils/closedDateRange` – en lokal kopi af
   uligheden er en arkitekturfejl, fordi en senere rettelse ét sted ville gøre nogle overlap ugyldige
   og andre ikke, uden at noget blev rødt.

   Bevidst undtaget er lønindkomstens og offentlige ydelsers rækker: de må overlappe (efterbetalinger, to
   lønsedler for samme periode), og kun ordrette dubletter giver en gul advarsel (`eoIncomeRowWarnings.ts`).

   Reglen gælder GYLDIGHED, ikke beregningsgrundlaget: den stille clamping i §2.1 og den
   centraliserede merge i punkt 4 ovenfor er uændrede og berører ikke, hvilke perioder brugeren har
   indtastet.

6. **Sygeferiegodtgørelsens 4-månedersgrænse tæller før den stille EO-periode-clamping**
   (udviklerens afgørelse). Ved skader før 2015 er retten sammenlagt 4 måneder
   fra tilskadekomsten, uanset hvor mange opgørelser forløbet er delt på. Grænsen tælles derfor over
   TAF-rækkerne efter fejlgivende clamping og merge (punkt 2 og 4), men FØR den stille clamping mod
   EO-perioden – `buildTafRangesUdenEoPeriode` – og motoren modtager dem som et særskilt input
   (`tafRangesSidenSkaden`). Selve kravet regnes uændret kun over de clampede ranges. Ingen anden
   beregning må læse de uclampede ranges.

7. **Ingen parallelle fallback-totaler.** EO-domænet kan have flere tekniske TAF-forbrugere
   (per-række/merged-output og snapshot-aggregation), men de skal følge samme autoritative
   domænesemantik: clampede ranges som beregningsgrundlag og ingen parallelle fallback-totaler.

### 2.4 Clampinggaranti

Clamping sker pre-snapshot i `computeEoSnapshot`. Engines arbejder **altid** på clampede
værdier – også når der vises fejl for fejlgivende bounds (§2.2).

`inspektionSnapshot` bygges eksplicit med de clampede ranges efter `buildTafRanges` er kaldt i
`computeEoSnapshot`, så EOInspektion aldrig viser TAF-dage der ikke indgik i beregningen.

I validerings-fejl-stien (autoritative totaler/PDF'er bygges ikke) bygges `inspektionSnapshot`
stadig med de **sektions-uafhængige** engine-data der kan beregnes sikkert: svie/smerte-engine, når
ingen af dens egne afhængigheder er røde (forligsafhængige felter neutraliseres efter §3.3), samt clampede
TAF-ranges for de rækker der stadig kan parses. Det giver EOInspektion samme clamping-billede for gyldige
rækker, uden at vise dagtal der ikke indgik i en autoritativ beregning. Er alle rækker ugyldige eller clampes
bort, er `[]` den forventede fail-closed kontrol-basis. I `fail_closed`-stien (uventet runtime-exception) er
`inspektionSnapshot` derimod `null`.
Kontrollaget må ikke lave nye fallback-enginekald for sektions-**afhængige** delresultater
(TAF-totaler, løn-afledte beløb). Når autoritativt engine-output mangler, skal kontrollaget vise
tom/ikke-beregnet tilstand i stedet for semi-autoritative beløb eller dagtal.

**Reguleringsforløbet er sektions-afhængigt og fail-closes derfor i validerings-fejl-stien**
(udviklerens afgørelse): det viste reguleringsforløb er udelukkende
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
- Out-of-range ferie/fridage (`loseFeriedage`, `uspecificeredeFerieFridage`) og fradrag, der ikke efterlader
  noget af beregningsperioden (løse dage, øvrigt fravær, ferie). Beregningsgrundlagets regler er røde
  feltissues (`beregningsgrundlagCellIssues.ts`, `validation/beregningsgrundlagFradragRules.ts`; en angivet
  månedsløn eller dagsløn på 0 kr. er rød via descriptorens grænse) og bliver invariants ad samme vej som enhver
  rød feltfejl. En nævner på 0 når derfor aldrig motoren.
- Manglende nødvendige inputfelter (validator-fejl)

**Bounds-violations (§2.2)** (differencekravDato, EET-datoer, ménafgørelsesdato)
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

Princippet – en rød feltfejl blokerer kun den gren, der læser feltet – står i `snapshot-contract.md` §2 pkt. 4 og
`form-contract.md` §2.3. I EO bygger hver gren sit input gennem en egen typed projektion med
`createTrackedInputReader`. `blockedDependencies` afledes direkte af disse projektioners issue-sæt for
`svieSmerte`, `forlig`, `taf`, `oevrigeKrav` og aggregatnoden `aggregate`.

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
forligsprocent neutraliserer kun de forligsafhængige felter (`withForligGate` i `eoSnapshot.ts`: dagssats og
maksimum efter forlig, forligsfaktor og -etiketter, total og maksimumsflagene), mens før-forlig-grundlaget
består (udviklerens afgørelse: før-forlig-resultater bevares). Motorens egen operationsrækkefølge er uændret;
kun hvilke af dens beregnede felter der eksponeres, ændres.

Reglen har to lige alvorlige fejlretninger:

- **For smal gruppe → falske tal.** Readeren maskerer en rød værdi til `undefined`. Kaldes motoren alligevel,
  regner den videre på et falsk input – fx en forligsprocent på 150 læst som "intet forlig" (100 %), eller
  et "Beregnet svie/smerte" udregnet som om tidligere udbetalt var 0.
- **For bred gruppe → overblokering.** Et ugyldigt svie/smerte-satsår må **ikke** fjerne den gyldige
  TAF-visning. Overblokering er ikke en "sikker" fejl. (Reguleringsforløbet følger §2.4.)

**Aggregatet er alt-eller-intet.** `totals.samletTotalOre`, `canonicalOutput` og `pdfModel` er krydsgående:
de summerer eller sammenstiller flere grene. De bygges derfor kun, når INGEN gren er blokeret – en sum af et
ukendt led er ukendt, og et dokument med et manglende afsnit er ikke autoritativt. `data` er `null` i den
situation, og det autoritative output har ingen halv-tilstand.

**De gyldige grene eksponeres gennem `readyBranches`, ikke kun `inspektionSnapshot`.** Snapshottet bærer på den
blokerede sti de grene, der stadig kunne beregnes sikkert (`svieSmerte`, `tafPerioder`; `undefined` =
"blokeret af sin egen røde afhængighed"). `eoSnapshotToBeregningView` falder tilbage til `tafPerioder`, så
Beregning-fanen fortsat viser den GYLDIGE TAF-periodisering, når et svie/smerte-felt er rødt (udviklerens
afgørelse). Fanen læser kun snapshottet og ser ikke `inspektionSnapshot`, så et krav om, at den delvise visning
"lever i inspektionSnapshot", ville i praksis fjerne gyldige data fra brugeren.
`canonicalOutput` har bevidst **intet** fald-tilbage: det ER det krydsgående aggregat.

Fail-closed-backstoppet er aggregatnoden `blockedDependencies.aggregate`: ENHVER rød feltfejl gør aggregatet
ikke-autoritativt – også en, ingen gren genkender. En ukendt fejl må hverken forsvinde lydløst ud af gatingen
eller gættes ind i en vilkårlig gren.

### 3.4 Engine-throws er forbudt som primær fejlmåde

Engine-throws på forventelige brugerinputfejl er huller i preflight-dækningen.

Regler:
- Engines skal returnere nul-output for kendte fejltilstande (fx `buildZeroOutput` i svie/smerte-motoren).
- Udviklerens afgørelse: Når en positiv indtastet løn giver en enhedsløn, som afrundes til
  0 kr., beregner KL-lønaftaler nulbasis som 0 kr. De eksisterende beløbsformler og afrundinger bevares.
  Reguleringsbeviset registrerer faktisk basis- og periodeløn 0 med neutral faktor 1 og regulering 0 %;
  nulværdier må ikke accepteres som generel erstatning for et manglende eller inkonsistent grundlag.
- Uventede engine-throws routes til `fail_closed` med `failClosedReason: 'runtime_exception'`.
  Det gælder HELE afledningen efter schema-gaten – også validatoren, valideringsfejl-grenens
  kontrolberegning og reader-projektionens feltissue- og dependency-led, som kører før
  `computeEoSnapshot`. Ingen undtagelse fra EO-afledningen må nå React-træet og vælte siden; den
  fælles fail-closed-tilstand bygges af `buildEoRuntimeExceptionSnapshot`.
- Alle forventelige brugerinputfejl skal opdages og rapporteres i validator eller som
  snapshot-invariants – ikke via engine-throws. Backstoppet ovenfor er et sikkerhedsnet, ikke en
  erstatning: fuzz-shardene (`src/__tests__/domain/erstatningsopgoerelse/helpers/eoRuntimeFuzzShard.ts`) kører genererede sager gennem hele siden og fejler på
  enhver `runtime_exception`.

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

Friskhedsreglerne i `snapshot-contract.md` §10 gælder. EO-snapshottet bygges af reader-projektionen, hvis
`sourceToken` (`EvaluationSourceToken`) også giver snapshottets `revision`. For EO gælder desuden:

- Et stale snapshot må ikke bruges til at konstatere kontroluoverensstemmelse eller anden blokering, der
  forudsætter et friskt snapshot – ellers kan systemet blokere på forældede mellemresultater.
- Ved visning af Beregning, EOInspektion og EOKontrolTabel skal et stale snapshot erstattes af en ny
  snapshot-build før normal visning fortsætter.

---

## 6. EOInspektion og EOKontrolTabel – altid-kan-dannes garanti

**Besluttet afvikling (ikke gennemført).** Udvikleren har besluttet, at begge kontrolfaner afvikles helt. De er
ikke en uafhængig kontrol: EO-kontrol viser motorens egne tal og validering, og sammentællingen fanger kun
rørføringsfejl. Sikkerheden varetages i stedet af (1) bevarelseslove som snapshot-invarianter – det eksisterende
indeksforholds-check i `eoCanonicalOutput.ts` bevares, og SFGG-total = summen pr. ansættelsesforhold tilføjes; (2) en
særskilt CSV-download af dagsgrundlaget på Beregning med et kort navn, hvor CSV indgår, bygget som ren
snapshotprojektion og sikret af en test, der kræver, at kolonnesummerne er lig opgørelsens tal (afklar restøre ved
summering, og om CSV må hentes ved fejl i en anden gren); (3) egenskabstests i runtime-fuzzen (ombytning af
uafhængige rækker, input uden for alle perioder). Derefter fjernes `control:sammentaelling_mismatch`, fanerne,
`inspektionSnapshot`, target `'inspektion'`, linket «Kontroltabel» og værnet `inspektionLayerIsolation.test.ts`; `showEOInspektionMenu`
udgår og ignoreres stille i gamle indstillinger, og en bruger med en kontrolfane som sidst valgte fane lander på en
gyldig fane. Beløbsregressionerne for negative rækker og weekendydelse-testen skal overleve. Der indgår ingen
facitsager og ingen uafhængig referenceberegning. Når afviklingen er gennemført, omskrives §6–§6.3. Indtil da
beskriver resten af §6 fanerne, som de er; fanernes egne skønhedsfejl (fx markøren ved to afskæringer samme dag)
rettes ikke.

Kontrolfanerne «EO-kontrol» og «Kontroltabel» vises kun, når indstillingen «Vis kontrolfaner på
Erstatningsopgørelse-side» (`showEOInspektionMenu`, standard fra) er slået til. Slås den fra, mens en kontrolfane
er aktiv, skifter visningen til «EO oplysninger» (`e2e/kontrolfaner-toggle-browsergren.spec.ts`). Linket
«Kontroltabel» i «Fejl og advarsler» tilbydes kun, når fanerne vises.

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

### 6.1 Sammentællingskontrollens to sider deler inputgate (normativ)

En sammentællingsrække sammenligner en BEREGNET værdi med en TABEL-aflæst værdi. De to sider skal
hvile på **samme** krav til inputtet. Kan den ene side ikke dannes, fordi inputtet ikke er et gyldigt,
færdigt grundlag, må den anden side heller ikke danne et tal.

Reglen er ikke kosmetisk. `control:sammentaelling_mismatch` er klassificeret `source: 'system'` og
routes til `reportSystemIssue`, så den åbner notitsen «Teknisk fejl registreret». Et «beregnet=-,
tabel=263» er ikke to opgørelser, der er uenige – det er én opgørelse, der mangler – og at melde det
som systemfejl sender brugeren efter en kodefejl i stedet for efter sin egen indtastning.

Reglen er STRUKTUREL, ikke en konvention: `SammentaellingControl` er nominal, og
`buildSammentaellingControl` er dens eneste konstruktør. Den beregnede side erklæres som enten
`vaerdi` eller `grundlag-mangler`, og ved `grundlag-mangler` tømmer konstruktøren BEGGE sider. En
håndskrevet objektliteral er en compile-fejl.

Tre indgange til asymmetrien er målt af
`src/__tests__/domain/eoInspektion/eoInspektionSammentaellingInputGate.test.ts`:

1. **Overlap.** En beregningsperiode, der deler en dag med en TAF-periode, overlapper i den lukkede
   intervalalgebra. Overlappet blokerer kun TAF-grenen; beregningsperioden kan stadig læses, så begge sider af
   dens række danner et tal (fx `22` / `22`), mens den røde TAF-gren viser `-` / `-`. Fejlen meldes alene som den
   røde række «Der er overlap mellem beregningsperioden (…) og en TAF-periode (…)», som blokerer downloaden.
2. **Uafsluttet påkrævet felt.** «Øvrigt fravær uden løn» sat til Ja, mens antalsfeltet endnu er tomt.
   Begge sider melder `grundlag-mangler`.
3. **Gemt label i stedet for nøgle.** En `ydelsestype` kan i en tidligere gemt `.eo`-fil bære den viste
   label («Sygedagpenge») frem for nøglen.

Den sidste peger på en generalisering af reglen: **de to sider skal også forstå de samme data ens.**
Enhver normalisering af en gemt værdi (label→nøgle, versalisering, alias) skal ligge ét sted, som
begge sider bruger – ellers kan de se forskellige ydelser og melde en uoverensstemmelse, der kun er en
opslagsforskel. En ydelsestype gemt som label forstås derfor som nøglen alle steder – celle, dagkolonner,
dubletkontrol, sortering, bilag og kontrol – gennem `resolveYdelsestype` i `data/ydelsestyper`; filens værdi
ændres først, når brugeren vælger igen.

Fradrag i tabelsiden skal afspejle motorens normalisering og placering af dagene. Løse
feriedage tælles gennem `buildTafFerieFravaerSummary`, så et negativt antal ikke øger
dagstallet, og et for stort antal i én TAF-periode ikke trækkes fra en anden periode.
Øvrige fraværsdage normaliseres med `toNonNegativeInt` som i den eksisterende dagmotor.
Kontrollen må fortsat melde faktiske afvigelser mellem to dannede opgørelser.

**En rød kontekstdato bevarer de afledte visninger**, også i tidligere gemte filer: satsreferencen følger
beregningsperiodens røde slutdato, en fraværsrække med rød dato beholder sine «Feriedage», og en TAF-række med rød
slutdato beholder sine TAF-arbejdsdage, mens Kontroltabellens sammentælling viser `-` / `-` for den røde gren.
Download er spærret af den røde dato. Dækket af `e2e/erstatningsopgoerelse-tidligere-filer.spec.ts`; satsreferencen af
`ansaettelsesforholdSatserOgDatoer.test.ts`.

Regressionerne dækkes af `eoInspektionDayInputParity.test.ts` og
`eoInspektionIncomeInputParity.test.ts`. Runtime-fuzzingen kontrollerer desuden samtlige
sammentællingsrækker gennem readeren, også når andre inputfejl blokerer opgørelsen.
`eoInspektionRejectedInputParity.test.ts` afslutter indtastninger gennem feltmotoren og
kontrollerer eksplicit tal/bindestreg-pariteten ved rejected tekst og røde canonical felter.

### 6.2 Kontroltabellen er en selvstændig kontrolberegning (normativ)

Kontroltabellens formål er at være en **særskilt, parallel opgørelse** af skadelidtes krav: en dag-for-dag-tabel
med sammentælling, som holdes op mod den tekniske beregning bag erstatningsopgørelsen. De to skal stemme
nøjagtigt; en uoverensstemmelse er altid et ægte fund (§6.1), aldrig en visningsforskel (udviklerens afgørelse).

Heraf følger:

1. **Samme regler, egen anvendelse.** Tabellen anvender selv de regler, der afgrænser kravet – den overtager ikke
   blot motorens resultat. Reglerne hentes fra samme kilde som motoren og valideringen, så de ikke kan drive fra
   hinanden, men tabellen håndhæver dem uafhængigt. Slipper en dag igennem motoren i strid med en regel, tæller
   tabellen den ikke, og sammentællingen melder det.
2. **TAF's afskæring ved EET.** TAF ophører fra og med (afskæringsdagen er ikke en TAF-dag) den tidligste af
   afskæringsdatoerne i §2.2: differencekravets dato, den endelige EET-dato og – **kun for skader (ved
   erhvervssygdom: anmeldelser) før 16-06-2011** (`TAF_MIDLERTIDIG_EET_SKAERINGSDATO`) – den midlertidige
   EET-dato. Fra den dato fortsætter TAF uanset en midlertidig EET-afgørelse og afgrænses af det endelige EET.
   Under en verserende klage over EET afslutter ingen EET-dato TAF.

   Kilden er `resolveTafCutoffDates` (motorens clamping, valideringens feltfejl og EO-kontrollens rækker).
   Kontroltabellen anvender den i TAF-dagskolonnen (`buildTafDayStatusValues`), markerer afskæringsdagen med
   kildens navn («Midlertidigt EET», «Endeligt EET», «Differencekrav») og viser under perioderne, hvilke datoer der
   afslutter TAF – og hvilke EET-datoer der IKKE gør, med grunden (skade fra 16-06-2011, verserende klage).
   EO-kontrols «TAF-ophør skyldes» nævner samme grund som dokumentet (`vaelgTafOphoersgrund`), også når to
   afskæringer falder på samme dag.
3. **Synligt grundlag.** Det, sammentællingen tæller, står i tabellen: TAF-dagskolonnen vises, når der er TAF-krav,
   også uden et ansættelsesforhold. Rækken «TAF-perioder» viser første og sidste dato.
4. **Ménafskæringen af svie/smerte** hentes ligeledes fra motorens opslag (`resolveSvieSmerteCutoffDate`) og
   anvendes af tabellen selv; den har ingen egen kopi af betingelsen om afgørelse og verserende klage.
5. **Kontrolfanerne er et passivt kontrolmiddel** (udviklerens afgørelse). Forudsætningen for deres
   eksistens er, at brugeren kun ser dem, når der er opstået en advarsel om en uoverensstemmelse. Deres opgave er
   derfor at beregne forholdene effektivt og efter princippet om **dobbelte beregninger, der sammenholdes**
   (sammentællingen, §6.1). Beskrivende tekst på fanerne må alene have til formål at tydeliggøre en fejl, som
   brugeren i forvejen er advaret om – fanerne må ikke selv rejse fejl, advarsler eller selvtjek, som ikke allerede
   står i «Fejl og advarsler».

Dækket af `eoInspektionTafAfskaering.test.ts` (inkl. tabellens egen afgrænsning af uafgrænsede TAF-perioder),
`eoInspektionKontrolModelMenStopIndependent.test.ts` (ménafskæringen mod motorens opslag) og
`e2e/kontroltabel-browseradfaerd.spec.ts`.

### 6.3 Kontrolfanernes visning

- Afsnittene hedder som sektionerne på «EO oplysninger»; afsnit, der gengiver en anden side eller fane
  (Stamdata, Lønindkomst, Offentlige ydelser, Sygeferiegodtgørelse), hedder som den.
- Statusværdier skrives «Ja» eller «Ingen», aldrig det interne «ok»; en ok-række med værdien `-` får intet flueben.
- Sammentællingens tomme side vises som `-` uden mærke. «Tom» har én definition (`erSammentaellingVaerdiTom` i
  `control/eoControlMismatch.ts`), som både sammenligningen og visningen læser. Grupper uden rækker udelades.
- Uden TAF-krav har Kontroltabellen hverken ansættelsesforholdskolonner eller TAF-dagskolonne.
- Kun en hel, ordnet erstatningsperiode (fra og til udfyldt, fra ≤ til) afgrænser dagtabellen og CSV-filen;
  sagens øvrige perioder udvider tabellen til hele måneder.
- Uden perioder står forklaringen over downloadknappen. Er beregningen stoppet, står der «Kontroltabellen kan ikke
  vises, fordi beregningen er stoppet» hhv. «EO-kontrol kan ikke vises, fordi beregningen er stoppet» og
  «Se «Fejl og advarsler» under Beregning.».
- «Ugedag» og «Dato» står fast ved vandret rul.
- Knappen «Download tabel (CSV-format)» giver filen `{journalnr} - Kontroltabel.csv` med kolonnenavnene
  «<ansættelsesforhold> – <kolonne>».
- Ansættelsesforhold navngives overalt – kontrolfaner, CSV, dokumenter, bilag og graf – med
  `resolveAnsaettelsesforholdNavn`: ved ens navne, eller et navn der rammer et andet korts standardnavn, bruges
  Lønindkomsts kortoverskrift; et unavngivet kort hedder «Ansættelsesforhold N».

---

## 7. `tidligereModtagetTaf`-isometri

Tom afsluttet canonical værdi (`undefined`) for `tidligereModtagetTaf` repræsenterer semantisk `0 kr`.

**Regel:** Totals (`EoComputedTotals.tidligereModtagetTafOre`) normaliserer et tomt felt til numerisk `0`
(MoneyOre). Motorens og canonical-outputtets felt er «ikke angivet»/`null`, og dokumentet udelader da afsnittet
«Allerede modtaget tabt arbejdsfortjeneste»; et tomt felt må aldrig blive til et manglende eller
ikke-beregnet krav.

Rationale: Tomt felt er et tilladt og neutralt brugervalg – brugeren har ikke modtaget
tidligere TAF-udbetalinger, eller beløbet er ikke oplyst. Begge tolkes som `0 kr.` fradrag.
Der er ingen semantisk forskel på "0" og "tomt" for dette felt.

Beløbet fradrages efter forligsreduktionen. Er det større end kravet, bliver kravet 0 kr. uden advarsel og uden
note i dokumentet (udviklerens afgørelse): det er normalt, at selskabet har betalt mere.

---

## 8. Fejlrapportering og PDF-output

1. `BugReportButton` i EO-scope styres normativt af `src/contracts/error-contract.md`.
2. Dokumentgating, toggle-guards og semantisk fravalg styres normativt af `src/contracts/document-output-contract.md` (afsnit A).
3. En opgørelse, hvor ingen af de tre krav (svie/smerte, TAF, øvrige krav) står på «Ja», giver den gule,
   ikke-blokerende linje «Der er ikke rejst krav under nogen af de tre emner – opgørelsen vil vise 0 kr.» og kan
   hentes: en bevidst nulopgørelse er et legitimt produkt (`eoRowOverviewRows.ts`).
4. EO-fladerne viser ingen beregnede beløb, kun hvilke ydelser der indgår og for hvilken periode. Beregning og
   resultat står i dokumentet og på EO-kontrol (udviklerens afgørelse).

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
- "TAF opreguleret til beregningsåret" viderefører samme afrundingsbeløb uændret, uden opregulering
  (udviklerens afgørelse). Et beløb forskelligt fra 0 vises som en særskilt "Afrunding"-linje efter de
  opregulerede beløb pr. år og før den samlede total i både PDF og Word.
  Totalen inkluderer afrundingen; når der ikke sker opregulering, er den derfor identisk med
  "Samlet TAF-krav" i "TAF fordelt på år". Ved 0 udelades afrundingslinjen som i årsopgørelsen.

4. Intet indtægtstab giver intet TAF-krav:
- TAF erstatter den indtægt, der mangler efter skaden (udviklerens afgørelse). Er indtægten
  efter skaden mindst lige så stor som den beregnede indtægt uden skaden, er TAF-kravet 0 kr.
  En lønfremgang efter skaden er et almindeligt og gyldigt eksempel på dette.
- Når den samlede TAF-total er 0 kr., viser årsfordelingen også TAF-kravet som 0 kr. for hvert år.
  De beregnede indtægter og fradrag bevares og vises fortsat. En linje med 1.000 kr. i beregnet
  indtægt uden skaden og 1.500 kr. i faktisk indtægt efter skaden viser derfor korrekt et
  TAF-krav på 0 kr., ikke et negativt krav på -500 kr.
- Skyldes nullet allerede betalt TAF, og dækker årets andel af det betalte årets krav efter forlig, vises
  årets regnestykke helt, og «Allerede betalt TAF» vises med den del, der modregnes i året: «I alt (50 % af
  23.000,00 kr.) 11.500,00 kr. / Allerede betalt TAF - 11.500,00 kr. / I alt 0,00 kr.». Ellers vises årets
  krav før forlig som 0, og ved forlig udelades det betalte i året, så «50 % af 0,00 kr.» aldrig står over et
  beløb (udviklerens afgørelse).
- Et år kan have et negativt fradrag, når en indtægtskilde er positiv over hele erstatningsperioden, men
  negativ i netop det år. Fradraget vises da som et tillæg («+ 1.000,00 kr.»), så årene summer til
  opgørelsen (udviklerens afgørelse).
- Dette er tilsigtet domæneadfærd, ikke en afrundingsfejl eller et ugyldigt dokument.
  Årsdokumenterne må ikke blokeres alene af denne grund, og forskellen må ikke vises som "Afrunding".

5. En importeret midlertidigt EET-linje på 0 kr. står i hovedopgørelsen, men udelades i "TAF fordelt på år"
   (`tafPerYearDerived.ts`). Det er en bevidst præsentationsforskel; beløbet dannes samme sted.

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

Load-kompatibilitet (`persistedLoadAdapter.ts`):
- TAF's aktuelle persisted felter hedder `tafBeregningsperiodeFra`/`tafBeregningsperiodeTil`. Ældre `.eo`-filer med
  `periodeTilBeregningFra`/`periodeTilBeregningTil` oversættes af den eksakte load-migrator, før schema-sanitization.
- SFGG-rækkens aktuelle persisted felter har `sfgg`-præfiks. Ældre rækkefelter uden præfiks oversættes tilsvarende
  til `sfggBeregningskilde`, `sfggReferenceperiodeFra`, `sfggReferenceperiodeTil`,
  `sfggReferenceperiodeFravaersdageUdenLoen`, `sfggManuelDagssats`, `sfggManuelBeloebIHenholdTil`,
  `sfggManuelFoerstEfterSygeloen`, `sfggSatsvalg` og `sfggAlleredeBetaltBeloeb`.
- De ældre EET-feltnavne med `Eet` og de ældre Ja/Nej-feltnavne for svie/smerte og TAF er registrerede
  load-aliaser (`EO_ROOT_FIELD_ALIASES`, `SFGG_ROW_FIELD_ALIASES`). De aktuelle runtime-navne er de eneste
  canonical navne. Aliaserne er eksakte, typede og testede, men ikke versionsbundne, fordi omdøbningerne ikke har
  et entydigt versionsskel.
- Udgåede udviklingsfelter, der ikke er sagsdata (`opsagtFraStilling`, `sfggSygeperioderFoer2015`,
  `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden`, `allowReguleringMedUdloebMedMaaneder`), fjernes
  eksplicit uden preflight under load (`HISTORICAL_IGNORED_EO_ROOT_KEYS`).
- Hvis en historisk værdi ikke kan oversættes entydigt, må en ny load-fejl eller preflight ikke indføres uden
  udviklerens forudgående godkendelse.

## 12. EO-feltklassificering og bounds-model

EO-specifik feltklassificering, fejlgivende bounds og stille clamping er normativt defineret i §2.

## 13. Typed EET-importport og transient injection

Når togglen `midlertidigtEetFraEetSiden` på *Offentlige ydelser*-fanen er aktiveret (`'Ja'`),
injiceres rækker fra EET-siden transient i EO-beregningen – uden at de skrives til inputaggregatet. Dette afsnit er
normativt for, hvordan injectionen indvirker på snapshot-modellen. Portens egne egenskaber – `MoneyOre` gennem
porten, og at en manglende eller schema-ugyldig import-context er en anden tilstand end en gyldig import uden
relevante afgørelser og giver et blokerende issue – står i `src/contracts/eet-snapshot-contract.md` §5; ændringer i
EET-issues eller EET-importprojektion skal vurderes mod begge kontrakter.

**Inputkilder:**
- Når togglen er `'Ja'`, modtager `computeEoSnapshot` en typed EET-import-context som
  førsteklasses snapshot-input. Contexten bygges og Zod-valideres af EET-domænets importport
  før EO-snapshotkaldet og indeholder canonical importgrupper, issues og revisionsidentitet;
  EO må ikke modtage rå EET-values eller selv orkestrere EET-engines.
- Snapshot-revisionen skal derfor inkludere både `erhvervsevnetab`- og
  `faellesAarsloen`-sektionernes revisioner, så cachen invalideres korrekt ved EET-ændringer.
  Revisionen skal inkludere EO, stamdata, EET og `faellesAarsloen` deterministisk, uanset om togglen aktuelt er `'Ja'` eller `'Nej'`; togglen ændrer semantik, ikke cache-invalideringsgrundlag.
- Mangler import-contexten eller er den ugyldig, selv om togglen er `'Ja'`, fail-closer importen med tomme grupper.
  EO må ikke gætte, skrive defaults eller maskere tilstanden som en gyldig tom import.
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
- **Præmis: løbende EET indtil kapitalisering.** Et indtastet erhvervsevnetab lægges til grund som
  fortløbende frem til dagen før folkepensionsdatoen, medmindre brugeren har angivet en
  kapitalisering (eller en senere afgørelse afløser det). Importen afgrænses derfor alene af
  TAF-periodens seneste clampede slutdato (capped af EO-periodens slutdato, `vedroererPeriodeTil`);
  ophør inden da følger udelukkende af folkepensionsdatoen, en kapitalisering eller en senere
  afgørelse på Erhvervsevnetab-siden.
- **EET-sidens beregningsdato indgår ikke i importen.** Den er en opgørelsesdato for EET-sidens egne
  beregninger (løbende ydelser, EET efter EAL og differencekrav, jf. `docs/domain/eet/`) og læses
  hverken af importkilden eller af `eo_import`-contexten, der bruger TAF-slutdatoen som
  opgørelsesdato. En tom, rød eller afvigende EET-beregningsdato må derfor hverken spærre importen,
  ændre de importerede perioder eller udløse en advarsel i Erstatningsopgørelsen. På
  Erhvervsevnetab-siden forbliver datoen påkrævet for de beregninger, der bruger den.
- Findes der ingen clampet TAF-periode – fx fordi alle TAF-perioder ligger uden for EO-perioden –
  er der intet at fradrage i. Importen giver da en tom context uden issue og spærrer intet
  (udviklerens afgørelse). Det er ikke en tilstand, der skal meldes fra importen: TAF-sektionens
  egne gule advarsler (§2.1) siger det allerede, og ufuldstændige TAF-perioder giver deres egne fejl.
- Hver beregnet EET-løbende-ydelsesrække fra midlertidige og delvist endelige afgørelser splittes
  internt pr. kalendermåned til virtuelle EO-rækker (`buildMidlertidigtEetCalculationRows`), så den
  eksisterende kalenderdags-periodisering inden for rækken svarer til x/dage-i-måneden og ikke et
  gennemsnit over hele EET-perioden. Periodernes samlede beløb bevares.

**Autoritativt midlertidigt EET-fradrag (kanonisk kilde):**
- Det beløb der faktisk trækkes fra i TAF-beregningen for `midlertidigt_eet` afledes af den
  KANONISKE, pr.-periode-afrundede bilagskilde
  `sumMidlertidigtEetBeregnetEetKronerForTafRanges` (bygget på
  `buildMidlertidigtEetPdfGroupsForTafRanges`), IKKE af den urundede totalsum rundet én gang – afrunding
  pr. periode giver ikke altid samme beløb som afrunding af totalen. Hovedopgørelsens "Indtægter i
  erstatningsperioden"-linje og årsfordelingen (`buildTafPerYearBuildOutcome` i `tafPerYearDerived.ts`) får
  beløbet gennem `buildTafIndtaegterBeregning`, så det fradragne beløb er identisk med
  "Midlertidigt EET"-bilagets sammentælling bit for bit.
- De virtuelle rækker (`buildEoValuesWithTransientMidlertidigtEet`) bevares og fødes fortsat RÅT
  (urundet) til EO-inspektionens sammentælling/kontroltabel og til beregningsperiode-projektionen
  (`buildOffentligeYdelserUdviklingModel`). Disse rå stier er bevidst uafhængige af den kanoniske
  fradragsrunding: sammentællingen verificerer periodiseringen (rå = rå), og
  beregningsperiode-projektionen er en anden størrelse (hypotetisk fremskrevet indkomst lagt TIL
  TAF, ikke et fradrag). De må ikke kanoniseres til bilagssummen.

**PDF-bilag:**
- Ydelsen, bilaget og bilagsvalget hedder «Midlertidigt EET» (med t) overalt; «Midlertidig EET-afgørelse» bøjes
  efter «afgørelse». Bilaget slutter med «I alt» ved mere end én række.
- "Midlertidigt EET"-bilaget renderes kun når togglen er `'Ja'` *og* der findes afgørelser fra EET-siden.
  Når togglen er `'Nej'`, sendes en tom `midlertidigtEetGroups`-array til PDF-renderen, uanset om
  EET-siden har afgørelser. Hentes der intet, er bilagsvalget inaktivt med grunden «Der hentes ingen midlertidige
  EET-ydelser fra Erhvervsevnetab-siden».
- Dokumentprojektionen for "Offentlige ydelser" modtager de oprindelige manuelle rækker fra den godkendte
  audit-/dokumentprojektion (ikke fra effektive rækker), så bilaget aldrig viser virtuelle rækker. Generatoren læser
  ikke direkte fra inputaggregatet.

**Afgørelsesdatoerne på to sider (gul advarsel alene):**
- Mens togglen er `'Ja'`, sammenholdes datoerne for den midlertidige og den endelige EET-afgørelse på
  EO oplysninger med Erhvervsevnetab-sidens afgørelser (`resolveEetAfgoerelseDatoAdvarsler`, udviklerens
  afgørelse). Hver udfyldt dato – virkningsdato og afgørelsesdato – skal genfindes på SAMME afgørelse af samme
  slags; en delvist endelig afgørelse tæller som midlertidig, fordi den hentes som løbende ydelse. Ellers vises en
  gul linje, der navngiver datoen og fører til feltet på EO oplysninger. Har Erhvervsevnetab-siden ingen afgørelse
  af den slags, tier advarslen. Beregningen er uændret: EO-datoerne afskærer fortsat TAF og står i dokumentets
  tekst, mens fradraget bygger på Erhvervsevnetab-siden.
- Er togglen `'Ja'`, men «Midlertidigt EET-afgørelse» på EO oplysninger ikke «Ja», følger fradraget fortsat
  togglen (udviklerens afgørelse), og «Fejl og advarsler» viser en gul linje
  (`resolveMidlertidigtEetUdenAfgoerelseIssue`): «Erhvervsevnetab-siden har en midlertidig afgørelse, men der er
  ikke angivet en midlertidig EET-afgørelse på EO oplysninger», eller – når intet hentes – «Midlertidigt EET hentes
  fra Erhvervsevnetab-siden, men der er ikke angivet en midlertidig EET-afgørelse – der fradrages intet
  midlertidigt EET».
- Manuelle `midlertidigt_eet`-rækker, der står i tabellen, mens togglen er `'Ja'` (fx fra en indlæst fil),
  medregnes ikke. De får en gul rækkeadvarsel, der siger det (`midlertidigtEetMedregnesIkke` i
  `eoIncomeRowWarnings.ts`), og rækkens øvrige rækkeadvarsler udelades.

**Issues fra EET-løbende-ydelser:**
- Kun errors stopper importen; warnings bevares sammen med de beregnede perioder. En advarsel må
  ikke fjerne et ellers gyldigt midlertidigt EET-fradrag (udviklerens afgørelse).
- Blokerende importfejl skal forklare følgen først: "Midlertidigt EET kan ikke hentes fra
  Erhvervsevnetab-siden: <årsag>". En besked, der allerede begynder med "Midlertidigt EET",
  bevares. Issue-id, severity og fokusmål ændres ikke.
- Årsagerne er de konkrete: hver rød celle i ASL-afgørelsestabellen (feltfejl og tabellens samlede regler) giver
  sin egen linje med række, kolonne og feltets besked og peger på cellen; ASL-årslønnen og Stamdata giver feltets
  navn og konkrete besked. En generisk «ikke gyldigt udfyldt» er ikke tilladt, og importen må ikke nøjes med den
  første årsag. EET-fanerne og importen bygger linjerne med samme funktion (`buildAslAfgoerelserSummaryIssues`).
- Når importen er slået til uden errors, men ingen positiv importeret ydelse overlapper TAF-perioderne,
  vises den ikke-blokerende advarsel «Erhvervsevnetab-siden har ingen midlertidig afgørelse med ydelser i
  TAF-perioden – der fradrages intet midlertidigt EET», hvis mindst én TAF-periode når den midlertidige afgørelses
  aktive dato på EO oplysninger. Den aktive dato er virkningsdatoen, ellers afgørelsesdatoen. Uden denne dato
  eller med alle TAF-perioder før datoen vises denne advarsel ikke.
- Når togglen er `'Ja'`, bruger EOberegningTab samme canonical import-context/projektion
  som snapshot-laget og viser EET-issues (errors og warnings) i "Fejl og advarsler" med link
  til Erhvervsevnetab-siden. Errors blokerer download af **alle fire** Beregning-fane-dokumenter
  (erstatningsopgørelse, TAF fordelt på år, TAF opreguleret til beregningsåret og Visuel graf over
  indtægtsniveau) via gatens `hasBlockingRows`. Det øvrige `errors`-array fra rækkeevalueringen blokerer
  opgørelsen fuldt, mens de tre TAF-dokumenter ser bort fra fejl i svie/smerte, øvrige krav, særlige
  kommentarer og bilagsnumre, som de ikke bruger (`erTafUafhaengigEoFejl`, udviklerens afgørelse). Blokeringen
  får klassen `page-errors`, fordi fejlen allerede står i "Fejl og advarsler" (`document-output-contract.md` §A5.1).
- Når togglen er `'Nej'`, vises EET-issues ikke (de er irrelevante for EO-beregningen, fordi
  koblingen er deaktiveret).
- EET-issues overføres som udgangspunkt ukritisk. Det betyder, at en EET-fejl kan blokere
  EO/TAF-output, selv om den konkrete importregel ikke bruger det pågældende EET-input som
  beregningsafgrænsning. Eksempel: en ugyldig EET-procent blokerer importen, selv om den ikke
  i sig selv handler om TAF-afgrænsningen. Dette er et bevidst designvalg for at undgå manuel
  klassificering af hver enkelt EET-issue.
- **To bevidste undtagelser fra den ukritiske propagation:**
  1. *EET-beregningsdatoen* – tom eller rød – blokerer ikke, fordi importen slet ikke læser den
     (se præmissen om løbende EET indtil kapitalisering ovenfor). Det gælder også datoens
     EAL-regel om manglende reguleringssats.
  2. *De beregningsdato-relative advarsler* – afgørelsesdato/virkningsdato/kapitaliseringsdato
     efter beregningsdatoen – undertrykkes i EO-konteksten. På EO-siden er opgørelsesdatoen
     TAF-slutdatoen, og en EET-afgørelse med virkning efter erstatningsperiodens udløb er
     helt normal (fx en opgørelse lavet før EET-afgørelsen). Filtreringen sker ved
     EO-importgrænsens adapter via den eksporterede konstant
     `EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS`; erhvervsevnetab-sidens egen visning
     er upåvirket. Øvrige EET-advarsler (under 15 %, ugyldig EET-procent efter 1.7.2024,
     midlertidig/delvist endelig efter endelig) er kontekst-uafhængige og vises fortsat begge steder.
- Hver ny eller ændret EET-issue-type skal revurdere denne EO-konsekvens og opdatere
  `eet-snapshot-contract.md` og dette afsnit, hvis propagation ikke længere er sikker.

**Single source of truth:**
- Når togglen er `'Ja'`, er EET-siden den eneste kilde til midlertidigt EET-data.
  Manuelle `midlertidigt_eet`-rækker er hverken mulige (ydelsestype-option deaktiveres i
  dropdown'en) eller persisterede (filtreres væk ved toggle-aktivering).
- Invarianten "ingen manuelle midlertidigt_eet-rækker når toggle er TRUE" håndhæves både
  i UI'et og defensivt i beregningen (filter i `buildEoValuesWithTransientMidlertidigtEet`). Findes der manuelle
  rækker ved aktivering, beder dialogen «Slet manuelle indtastninger af Midlertidigt EET» om bekræftelse
  («Ja, slet og aktivér»/«Annuller»). Henter Erhvervsevnetab-siden intet i TAF-perioden, siger dialogen også
  «Erhvervsevnetab-siden har intet midlertidigt EET i TAF-perioden – der fradrages derefter intet.»

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
- «Tidligere beregnet S/S til max.» vises ved både «Ja» og «Nej» til krav på svie- og
  smertegodtgørelse, men skjules ved «Skjul». Er togglen slået til, viser opgørelsen i begge
  synlige tilfælde teksten om opbrugt maksimum (§17). «Nej» aktiverer ikke periodeinput
  eller beregning; «Skjul» udelader fortsat hele afsnittet fra opgørelsen.
- `svieSmerteTidligereTotal` er kun relevant fra og med 2. opgørelse. Ved første opgørelse er
  feltet skjult og neutraliseres, så et evt. indtastet beløb ikke fradrages svie/smerte-loftet.
- Svie/smerte-periodeinput (`svieSmertePerioder`, `svieSmerteSatserAar`, `svieSmerteAktuelPeriode`)
  neutraliseres når sektionen ikke er aktiv (`kravPaaSvieSmerteGodtgoerelse !== 'Ja'`) eller
  "tidligere beregnet S/S til max" er slået til.
- TAF-periodernes løse feriedage (`tafPerioder[].loseFeriedage`) neutraliseres, når TAF opgøres i
  måneder (`erTafLoseFeriedageRelevant`): de fradrages kun i arbejdsdage. Ligeledes skjules «Ferie i
  beregningsperioden» og løse ferie-/feriefridage i beregningsgrundlaget i måneder
  (`erBeregningsperiodeFerieRelevant`). Enheden kan skifte ved en indtastning under Lønindkomst, ikke kun ved
  et valg; se `form-contract.md` §7 pkt. 5.
- TAF- og ferieperioder (`tafPerioder`, `ferieperioder`), `tidligereModtagetTaf` og øvrige-krav-rækker
  (`oevrigeKravPerioder`) neutraliseres når den respektive sektion ikke er aktiv.
- Ved TAF «Nej»/«Skjul» er Lønindkomst og Offentlige ydelser ikke relevante: felterne spærrer ikke og trykkes ikke
  (heller ikke med bilagsvalget «Alle»), fanerne viser kun en forklaring, og alle TAF-afhængige bilagsvalg er
  inaktive med grunden «Der er ikke krav på tabt arbejdsfortjeneste i EO-perioden». «Periode til beregning af
  før-løn» bruges heller ikke.
- Beregningsgrundlagets mode-felter er kun relevante i deres egen gren af «Beregnes ud fra». Angivet månedsløn og
  angivet dagsløn har hver sit sæt «baseret på»- og datofelter; et skift starter forfra, fordi det er en anden
  metode (udviklerens afgørelse). «Fuld løn under ferie» skjules ved angivet løn (`erFuldLoenUnderFerieRelevant`),
  og «Løn på helligdage» under angivet løn er kun relevant ved Overenskomst og Manuelt angivet.
- Ved «Tillæg angives som: Beløb» indgår de skjulte procentsatser (feriepenge, fritvalg, SH/SO, pension) hverken i
  overenskomstreguleringen eller i SFGG-pensionen (`empSatsRelevance`).
- Et ansættelsesforholds `ansaettelsesforholdOphoert` neutraliseres til `false`, når
  `ansatPaaSkadestidspunktet` er `false`. `sidsteArbejdsdag` neutraliseres desuden, når
  ansættelsesforholdet ikke er opsagt. Dermed kan en bevaret, skjult opsigelse aldrig forkorte SFGG
  eller frembringe en afledt advarsel. Når feltet er relevant, er en «Sidste dag i ansættelsesforholdet» før
  skadedatoen en rød fejl.
- Kun rækker med faktisk indhold blankes; tomme placeholder-rækker bevares (de påvirker
  ikke beregning).

**Læsegrænsen går forud for neutraliseringen.** EO-felterne bag et valg bærer prædikaterne som
descriptorens `relevance` (`erstatningsopgoerelseDescriptors.ts`). Readeren giver et irrelevant felt dets
tomværdi til ALLE læsere – validatoren, række-evalueringen, dependency-projektionen og motorerne – og
danner intet feltissue for det; et valg, der skjuler et rødt felt, rydder det i samme transaktion
(`form-contract.md` §7 pkt. 5). Et skjult felt kan derfor hverken blokere download eller påvirke et tal. Det gælder
også de rene visningsfelter (mén-/EET-afgørelsesdatoer og klagefelter, bilagsnumre), som
`neutralizeIrrelevantEoInputs` ikke dækker. Neutraliseringen ovenfor står tilbage som forsvar i dybden for
beregningskald uden reader. Descriptor-relevansen er IKKE en persistensregel: `.eo`-save og -load læser
sektionerne direkte, så en skjult værdi gemmes og indlæses uændret.

**Bevidst undtagelse – komprimering ved EO 2+:** Togglen «Skjul beregning efter første opgørelse»
(`komprimerBeregningEfterFoersteOpgoerelse`) står i «Indtægt før skadedatoen», når TAF er aktiv, og er som
standard «Ja»: grundlaget fastsættes én gang og skal ikke ændres (udviklerens afgørelse). Den virker først fra
og med 2. opgørelse (`skalKomprimereIndkomstBeregning`). Da skjules
løn-/beregningsgrundlags-felterne (`beregnesUdFra`, beregningsperiode, fravær, angivet løn,
lønindkomst, lønudvikling, anciennitet) i UI'en, men de forbliver **aktive** input: tabt
arbejdsfortjeneste genberegnes fra dem. Disse felter neutraliseres derfor ikke. Mode-gating
af det aktive løn-felt (afhængigt af `beregnesUdFra`) ejes fortsat af indkomst-motoren.

UI'en skjuler dog kun et **gyldigt** grundlag (udviklerens afgørelse, `kanIndkomstBeregningenSkjules`): har
beregningsgrundlagets rækker i «Fejl og advarsler» en fejl, eller har et
af de skjulte felter en rød værdi, vises felterne trods togglen. Et skjult grundlag giver heller ingen gule
advarsler (`udeladAdvarslerForSkjultGrundlag`): «skjult» og «advarer ikke» dækker samme rækker. Et grundlag, der
bliver gyldigt, mens brugeren er på EO-oplysninger, skjules først ved næste besøg på fanen, eller når brugeren
selv slår komprimeringen til (`useIndtaegtFoerSkadenSkjult`). Dokumentet og bilaget følger fortsat
`skalKomprimereIndkomstBeregning` alene: et ugyldigt grundlag spærrer downloaden, så papiret komprimerer kun et
gyldigt grundlag.

## 15. Anvendt reguleringsdato og manuel lønudvikling

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

**Manuel lønudvikling.** De to manuelle former deler regler (`manualRegulationIssues.ts`):
- Samme dato to gange er en rød, blokerende fejl på den senere række («Der er allerede en række pr. DD-MM-ÅÅÅÅ») –
  bevidst modsat indtægtstabellerne: en løn kan ikke reguleres til to værdier samme dag.
- `Manuel procentsats` uden rækker efter basisrækken spærrer: «Manuel procentsats mangler: angiv mindst én sats –
  eller vælg «Ingen»». `Manuelt angivet` med kun basisrækken spærrer bevidst ikke, når basisrækkens grundløn er
  udfyldt: basisrækken er brugerens løn, og formen kan være vejen til Store Bededagstillæg på uændret løn
  (udviklerens afgørelse). Mangler grundlønnen, spærrer den.
- Programmet udfylder aldrig de efterfølgende reguleringsrækker – heller ikke feriegodtgørelsen; brugeren taster
  hver regulering selv (udviklerens afgørelse). Tomme celler viser pladsholderen «0,00 %»/«0,00 kr.»
  (`input-field-behavior-contract.md` om pladsholderens form). Kun den programstyrede basisrække spejler
  ansættelsesforholdets satser.
- Angivet løn har intet feriesatsfelt. Den persisterede `eoAngivetLoenLoenudvikling.feriePct` læses ikke af nogen
  beregning (`angivetLoenHelpers.ts`), så en værdi i filen aldrig kan indgå usynligt: under «Manuelt angivet» er en
  tom feriesatscelle 0 %, og under «Overenskomst» indgår ingen feriesats i pakken.
- Har den manuelle lønudvikling ingen ændring i mere end 12 måneder efter sidste række plus Indstillingernes
  tolerance inden TAF-periodens slut, giver det en gul, ikke-blokerende advarsel: ring på sidste rækkes dato
  («Ingen ændringer efter denne række – lønnen er regnet uændret frem til DD-MM-ÅÅÅÅ») og linjen «Den manuelle
  lønudvikling har ingen ændringer efter DD-MM-ÅÅÅÅ – lønnen er regnet uændret frem til DD-MM-ÅÅÅÅ». Beregningen
  bruger sidste rækkes løn.

**Reguleringsforløb pr. ansættelsesforhold.** Har sagen flere reguleringskilder, får hvert ansættelsesforhold sit
eget forløb (`resolveForloebForAnsaettelse` i `engines/reguleringForloeb.ts`); det globale forløb bruges kun, når
listen pr. ansættelsesforhold er tom (én kilde), og arves aldrig af et ansættelsesforhold uden match.

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
- Dokumentets lønsætning beskriver reguleringens retning (`buildLoenGrundlagSaetning`): «Opgøres på baggrund af …»
  uden regulering, «Beregnes som … reguleret efter lønudviklingen før og efter denne dato», når dele af perioden
  ligger før reguleringsdatoen, og ellers «… tillagt efterfølgende lønstigninger».

Den kanoniske tekstafledning ligger i
`src/domain/erstatningsopgoerelse/helpers/eoDateReferenceText.ts` og skal genbruges frem for lokale
strengsammenligninger i UI, kontrol- eller dokumentlag.

## 16. Svie/smerte-satsår

Afsnittet er normativt (udviklerens afgørelser).

- **Satsåret har ingen sammenhæng med sygeperiodernes placering.** Det er lovbestemt, at der – uanset hvornår
  selve sygeperioden ligger – kan rejses krav med den sats, der var gældende én måned efter, kravet blev rejst.
  En sag med sygeperioder udelukkende i 2019 kan derfor retmæssigt opgøres med 2026-satser. Programmet må
  hverken advare om, blokere på eller udlede noget af forskellen mellem periodernes år og satsåret.
- **Kravet anses for rejst én måned efter «Opgørelse lavet den».** Det gælder både opgørelsen og de
  underliggende beregninger. Kalenderåret findes med den fælles clamp-semantik for månedsslut
  (`getYearOneMonthAfter`).
- **Brugeren vælger selv satsåret** i «Hvilket års svie/smerte-satser lægges til grund?». Programmet indsætter
  eller ændrer det aldrig uden en brugerhandling (knappen `Indsæt årstal`, `input-field-behavior-contract.md`
  §4.6a).
- **Programmet advarer alene, ikke-blokerende, når et senere års HØJERE sats kunne være anvendt:** når det
  nyeste fuldt dækkede satsår, der ikke ligger efter kravets tidspunkt
  (`resolveSvieSmerteSatsAarForReferenceDate`), er senere end det valgte år, der findes satser for det, og dets
  dagssats eller maksimum er højere (`erSvieSmerteSatserHoejere`). Advarslen tier ved en revideret opgørelse, ved
  et skjult satsårsfelt og når «Opgørelse lavet den» mangler. Den står i `eoRowSvieSmerteRows.ts`
  (`sviesmerte.satserAar`).

## 17. Svie/smerte-maksimum og tidligere opgørelser

Afsnittet er normativt (udviklerens afgørelser).

- **Ordbrug.** For tidligere perioder indtastes det opgjorte beløb («Svie/smerte opgjort i tidligere
  erstatningsopgørelser»), og det fradrages i maksimum. For den aktuelle periode tæller kun det udbetalte, og det
  fradrages i beløbet. Ordene «opgjort», «udbetalt» og «krav» må ikke ensrettes på tværs. Underoverskriften er
  «Tidligere svie/smerte-beløb».
- **0 er tomt.** Et opgjort tidligere beløb på 0 behandles som tomt: advarslen «Der er ikke angivet svie/smerte
  opgjort i tidligere erstatningsopgørelser» står fortsat, og dokumentet tier som ved tomt – brugeren taster ofte 0 i
  tvivl. Et modtaget beløb på 0 for den aktuelle periode er heller intet fradrag og trykkes hverken som «- 0 kr.»
  eller som «Der er tidligere modtaget 0 kr. for denne periode.».
- **Maksimum nået er én tilstand.** Har brugeren angivet, at maksimum er nået («Tidligere beregnet S/S til max.»),
  eller udtømmer det tidligere opgjorte beløb maksimum, skriver dokumentet i begge tilfælde ordret «Maksimum for
  svie- og smertegodtgørelse er nået i tidligere erstatningsopgørelse.» uden beløb (`SVIE_SMERTE_MAKSIMUM_OPBRUGT_TEKST`,
  `erSvieSmerteMaksimumOpbrugt`). «Nej» skriver «Ingen».
- **Over maksimum er gult.** Overstiger det tidligere opgjorte beløb det forligsreducerede maksimum, giver det en
  gul, ikke-blokerende ring og linjen «Svie/smerte opgjort i tidligere erstatningsopgørelser overstiger maksimum
  (X kr.)» (`resolveSvieSmerteTidligereTotalOverMaxWarning`), fordi beløbet kan være korrekt. Ingen advarsel ved
  lighed, i satsår uden maksimum eller når feltet er skjult.
- «(reduceret til max)» trykkes kun, når beløbet faktisk er skåret ned (sammenligning i hele øre).
