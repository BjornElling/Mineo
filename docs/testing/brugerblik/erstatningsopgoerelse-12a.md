# Brugerblik – Erstatningsopgørelse → Opgørelsens ramme (12a)

- Rute/placering: `/erstatningsopgoerelse` → fanen «EO oplysninger», sektionerne **Erstatningsopgørelse**,
  **Forlig**, **Eventuelle særlige bemærkninger** (hed «Eventuelle særlige kommentarer» ved gennemgangen,
  omdøbt af BB-212) og **Bilagsnumre** – samt de dele af opgørelsesdokumentet,
  de frembringer: brevhoved, dokumenttitel, udkast-stempel, periodelinjen, «Særlige bemærkninger»,
  bilagsreferencerne og afslutningsformlen «Godkendelse».
- Gennemgået: 2026-09-15 · commit `f594668b`
- Afprøvet i: Chrome, lyst tema, 1536×864 (M-09 desuden 1244×620). Dokumenter hentet som `.docx`
  og læst i udpakket form.

## Fladen kort

12a er sagens ramme: opgørelsens nummer og eventuelle ledsagetekst, om den er en revision, hvilken periode
den vedrører, hvornår den er lavet, om den skal bære udkast-stempel, skadelidtes status ved periodens
udløb, hvordan den afsluttes, et eventuelt ansvarsforlig, fri tekst til særlige bemærkninger og de syv
bilagsnumre. Fladen regner intet selv, men den navngiver dokumentet, sætter dets dato, afgør hvilken
afslutningsformel modparten læser – og, gennem feltet «Nummer», hvilke regler resten af opgørelsen
beregnes efter.

Alt på fladen er forudsætning for de tolv øvrige bidder: «Vedrører perioden» afgrænser samtlige krav,
forligsgraden skalerer alle beløb, og bilagsnumrene knytter dokumentationen til hvert afsnit i papiret.

**Afgrænsning.** Rækkerne «Helbredsforhold» og «Arbejdssituation» står i sektionen «Erstatningsopgørelse»
og er derfor gennemgået her, selv om deres indhold hører til svie/smerte (12b) og TAF (12e). De optræder
ikke på nogen anden bids liste. Selve kravvalget «Ja/Nej/Skjul» er kun brugt som opsætning, ikke
gennemgået – det hører i 12b/12c/12e.

## Fund

### BB-202 – Feltet «Nummer» styrer beregningen, og reglen for hvad der tæller som «første» er usynlig

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-01--kontekstuelle-feltnavne` (i den skærpede form: et
  input ændrer hvad programmet *regner* og *tillader*) og `#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** **Høj**
- **Beslutning:** **AFVIST** af udvikleren 2026-09-17. Feltet skal kunne tage hvad brugeren vil; i praksis skrives tal, og en tekstlinje kan alligevel ikke gennemskue en fritekst. Presset igen på beregningskonsekvensen (`2` vs. `Nr. 2` giver forskellige beløb) – udvikleren fastholdt afvisningen.
- **Sådan fremprovokeres det:**
  1. Udfyld Stamdata (skadedato `01-06-2018`) og gå til «EO oplysninger».
  2. Skriv `2` i feltet «Nummer» øverst på fladen. Tab ud.
  3. Skriv derefter `Nr. 2` i samme felt. Tab ud.
- **Det sker:** Ved `2` dukker et nyt beløbsfelt op, «Svie/smerte-krav i tidligere erstatningsopgørelser»,
  og hele blokken «Beregnes ud fra», «Periode til beregning af før-løn», ferietabellen, «Uspecificerede
  ferie-/feriefridage» og «Øvrigt fravær i beregningsperioden» forsvinder fra «Indtægt før skadedatoen».
  Ved `Nr. 2` sker det modsatte: fradragsfeltet forsvinder igen (målt med `45.000,00 kr.` stående i det),
  og beregningsgrundlaget kommer tilbage.
  Målt for fem skrivemåder – **behandles som FØRSTE opgørelse:** tom, `1`, `1A`, `A2`, `Nr. 2`.
  **Behandles som ikke-første:** `2`, `12`, `2A`.
  Reglen er, at det første bogstav-eller-ciffer skal være et ciffer forskelligt fra `1` (eller `1`
  efterfulgt af endnu et ciffer). Et foranstillet ord eller bogstav slår den fra.
  Ud over de to synlige virkninger styrer svaret også sygeferiegodtgørelsen: ved første opgørelse
  udelades TAF-periodens første dag af optjeningen for skader fra 1. januar 2015
  (`sfggEngine.ts:37-42`), og ved ikke-første fradrages «Svie/smerte-krav i tidligere
  erstatningsopgørelser» i svie/smerte-loftet. I alt læser ni moduler feltet.
- **Det er uhensigtsmæssigt fordi:** Brugeren udfylder et felt, der hedder «Nummer», og tror han
  navngiver dokumentet. I virkeligheden vælger han et regelsæt. To fagfolk, der skriver henholdsvis `2`
  og `Nr. 2` om præcis samme sag, får forskellige beløb – uden at nogen af dem kan se hvorfor, og uden at
  noget på skærmen nævner skellet. Den, der retter nummeret fra `2` til `Nr. 2` sent i forløbet, mister
  tavst et fradrag, han allerede har indtastet.
  Programmet **kender** svaret og har formuleret det: rækken «Første erstatningsopgørelse? Nej» findes i
  `buildEoErstatningsopgoerelseRows`. Den vises bare kun på kontrolfanen «EO-kontrol», som er slået fra
  som standard i Indstillinger. Det er M-28 i sin reneste form: oplysningen er beregnet, navngivet og
  uden en eneste kaldsside i brugerens synsfelt.
- **Bedre ville være:** Vis programmets eget svar direkte under Nummer-feltet som en læselinje –
  «Dette regnes som sagens første erstatningsopgørelse» / «Dette regnes ikke som sagens første
  erstatningsopgørelse» – så brugeren kan se skellet i det øjeblik han taster. Alternativt, og bedre,
  hvis udvikleren vil af med gætteriet: gør det til et eksplicit Ja/Nej-valg med nummeret som forvalg,
  så reglen ikke længere skal udledes af en tekststreng.
- **Andre steder det kan gælde:** `erDetteFoersteErstatningsopgoerelse` kaldes fra
  `useEoOplysningerViewModel`, `shDageSection`, `eoRowSvieSmerteRows`, `eoRowTaftRows`,
  `periodRangeGroups`, `sfggEngine`, `eoInputRelevance` og `eoPresentationSectionBuilders`. Generelt:
  ethvert **fritekstfelt**, hvis indhold parses til en beregningsbeslutning – prøven er
  `rg "values\.[a-zA-Z]+\)" src/domain/**/validation` over prædikater med en tekstværdi som eneste
  argument.

**Tilbagemelding**
Jeg afviser fundet. Det er ikke et reelt problem. Brugeren skal kunne indtaste hvadend brugeren føler for i nummer-feltet, men vil stort set uden undtagelser bruge tal. Den primære konsekvens af at bruge tal er, at programmet kan genkende, når der i givet fald ikke er tale om første opgørelser, og da skjuler overflødige værdier, hvis brugeren har slået denne valgmulighed til. Hvis brugeren indtaster noget andet end tal, vil en tekstlinje alligevel ikke kunne gennemskue, hvad det indebærer, og dermed heller ikke bidrage med noget. Den nuværende løsning er uskadelig og fin.

### BB-203 – Ét tastetryk skjuler beregningsgrundlaget bag en toggle, brugeren aldrig så, og som kommer frem afkrydset

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-12--et-valg-hvis-virkning-hverken-kan-ses-nu-eller-findes-senere`
  (B6a's omvendte vej: en knap, der reagerer på noget, brugeren ikke opfatter som data)
- **Prioritet:** Mellem
- **Beslutning:** **AFVIST** af udvikleren 2026-09-17. Beregningsgrundlaget fastsættes én gang og skal ikke ændres; at det skjules ved efterfølgende opgørelser er den forventede og ønskede adfærd, og en uafkrydset toggle ville give unødig støj.
- **Sådan fremprovokeres det:**
  1. Stå på en sag, hvor «Nummer» er tom, og rul ned til «Indtægt før skadedatoen».
  2. Skriv `2` i «Nummer» og Tab ud.
- **Det sker:** Der dukker en toggle op, «Skjul beregning efter første opgørelse», **allerede afkrydset**,
  og i samme øjeblik forsvinder seks felter og to tabeller under den. Togglen fandtes ikke på skærmen
  før tastetrykket, så brugeren har hverken set eller valgt den. Dens standardværdi er `'Ja'`
  (`erstatningsopgoerelseSchemas.ts:163`).
  Felterne er stadig **aktive input**: tabt arbejdsfortjeneste genberegnes fra dem, og PDF'en skriver
  resuméet «Månedsløn er i tidligere erstatningsopgørelse beregnet til X» (dokumenteret i
  `eoInputRelevance.ts`, «BEVIDST UNDTAGELSE»). Brugeren kan altså ikke længere se eller rette det
  grundlag, hans TAF beregnes af.
- **Det er uhensigtsmæssigt fordi:** Sammenfaldet af de to ting er det skadelige: et valg, brugeren ikke
  har truffet, skjuler tal, han stadig hæfter for. Den, der skriver nummeret først og lønoplysningerne
  bagefter, møder en flade uden det afsnit, han skulle udfylde, og har ingen anledning til at lede efter
  en toggle, der ikke var der for et sekund siden.
- **Bedre ville være:** Lad togglen komme frem **uafkrydset**, så komprimeringen er brugerens valg –
  eller vis den fra starten (inaktiv, med årsagen «kan først vælges fra 2. opgørelse»), så den ikke
  dukker op af sig selv. Hvis standarden skal blive `'Ja'`, bør sektionen i komprimeret tilstand vise
  én linje om, hvad der er skjult, og hvordan det foldes ud igen.
- **Andre steder det kan gælde:** Enhver toggle med `requiredJaNejField(..., 'Ja')`, som kun renderes
  betinget. Prøven: `rg "requiredJaNejField\([^)]*'Ja'\)" src/inputCore/catalog` og for hvert træf, om
  kontrollen altid er synlig.

**Tilbagemelding**
Jeg afviser fundet. Dette er netop den forventelige og korrekte adfærd, som brugeren regner med. Beregningsgrundlaget skal kun fastsættes én gang, og skal derefter ikke ændres. Det er forventeligt, at det skjules ved efterfølgende opgørelser, og vil skabe unødvendig støj, hvis ikke. Brugeren skal ikke aktivt tilvælge den forventelige og ønskelige handling på togglen.

### BB-204 – Dokumentets titel får dobbelt mellemrum, som hverken skærmen eller filnavnet afslører

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
  (uenighed mellem skærm og dokument om samme streng)
- **Prioritet:** Mellem
- **Beslutning:** **IMPLEMENTERET** 2026-09-17. Titlen samles på de udfyldte led i `eoPresentationModel.ts`; dækket af `eoPresentationModel.titel.test.ts`.
- **Sådan fremprovokeres det:**
  1. Lad «Nummer» stå tom.
  2. Skriv `revideret efter møde` i «+ evt. ledsagetekst».
  3. Hent opgørelsen på Beregning-fanen.
- **Det sker:** Dokumentets første linje er `Erstatningsopgørelse  (revideret efter møde)` med **to**
  mellemrum (målt i `word/document.xml`). Skærmens forhåndsvisning i «Beregning»-boksen viser ét
  mellemrum, fordi HTML kollapser blanktegn; filnavnet viser også ét, fordi `sanitizeFilenamePart`
  kører `.replace(/\s+/g, ' ')`. Brugeren kan altså ikke se fejlen nogen steder, før dokumentet er
  åbnet i Word.
  Årsagen er `` `${revideretPrefix}${erstatningsord} ${nummer}${ledsagetekst}`.trim() `` i
  `eoPresentationModel.ts:68`: `.trim()` fjerner kun mellemrum i enderne, ikke det i midten.
- **Det er uhensigtsmæssigt fordi:** Overskriften er det første, modparten ser, og et dobbelt mellemrum
  midt i den ser ud som sjusk i et dokument, der skal bære tillid. Og den ene kanal, hvor brugeren kunne
  have opdaget det, er netop den, der skjuler det.
- **Bedre ville være:** Sammensæt titlen af de udfyldte led:
  `[revideretPrefix + erstatningsord, nummer, ledsagetekst].filter((x) => x !== '').join(' ')`.
- **Andre steder det kan gælde:** Enhver titel eller overskrift bygget med skabelon-interpolation af
  valgfrie led. Prøven er mekanisk: `rg "\}\s\$\{" src/domain src/document` – hvert træf, hvor det
  første udtryk kan være tomt, giver et dobbelt mellemrum. Kandidat i samme fil:
  `skadestypeLinje` (`${skadestype} ${...'anmeldt '}den ${skadedato}`) er uden hul, fordi
  `skadestype` allerede er gatet af en `&&`.

**Tilbagemelding**
Enig.

### BB-205 – «'Vedrører perioden' er ikke angivet» om en periode, hvis fra-dato står på skærmen – og linket markerer netop den udfyldte halvdel

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-07--parvise-grænser-begge-felter-markeres-hver-med-sin-egen-udvej`
  og `#m-19--rødt-læses-som-tomt-af-den-flade-der-låner-værdien`
- **Prioritet:** **Høj**
- **Beslutning:** **IMPLEMENTERET** 2026-09-17. Rækken navngiver den manglende halvdel og sætter `focusFieldHint`, så linket markerer det tomme felt; dækket af `eoRowOverviewRows.test.ts`.
- **Sådan fremprovokeres det:**
  1. Skriv `01-07-2018` i «Vedrører perioden» (fra-feltet). Lad «til og med» stå tom.
  2. Gå til fanen «Beregning».
  3. Klik linket «EO oplysninger → Erstatningsopgørelse» ud for fejllinjen.
- **Det sker:** Boksen «Fejl og advarsler» skriver **«'Vedrører perioden' er ikke angivet»** og blokerer
  download («Opgørelse kan ikke hentes, når der er fejl ovenfor»). Ingen af de to datofelter er røde
  (målt `aria-invalid = "false"`, neutral kant `rgba(0, 0, 0, 0.87)`, ingen tooltip på nogen af dem).
  Klikkes linket, fyrer præcis én `mineoFieldAttentionBlink` – og den rammer **fra**-feltet, altså det
  der står `01-07-2018` i. Det tomme til-felt markeres ikke.
- **Det er uhensigtsmæssigt fordi:** Beskeden benægter det, brugeren kan se på skærmen. Han har angivet
  perioden – halvt – og programmet svarer, at han ikke har. Og den eneste anvisning, han får, peger på
  den halvdel, der er i orden. Den, der følger linket, kigger på en dato, der er rigtig, og finder ikke
  ud af, at det er nabofeltet, der mangler. Det er BB-135's form: linket fører til et felt, fejlen ikke
  handler om.
- **Bedre ville være:** Beskeden skal navngive den manglende halvdel, som de øvrige par på fladen gør:
  **«'Vedrører perioden' mangler til-datoen»** (og omvendt), og markeringen skal ramme det tomme felt.
  Er begge tomme, er den nuværende tekst korrekt.
- **Andre steder det kan gælde:** Alle aggregerede par-rækker i `eoRowEvaluation`, hvor to felter
  kollapses til én række med ét fokusmål. Prøven: `rg "bothPeriodsFilled|hasAnyFilled|&& has" src/domain/eoRowEvaluation`
  og for hver række med to kilder: navngiver beskeden den, der mangler, og peger fokusmålet på den?
  Konkrete kandidater: `forlig.ansvarsgrad` (procent/brøk), `aes.midlertidigEETAfgoerelseDato`
  («Afgørelsesdato eller virkningsdato mangler» – samme form, men her *navngiver* teksten dog begge).

**Tilbagemelding**
Det er ikke et stort problem. Brugeren forstår budskabet af den aktuelle fejlmeddelelse. Hvis det kan løses ved en simpel velstruktureret forbedring, så fint - men jeg vil ikke have en kompleks løsning, der risikerer at introducere flere fejl, for at løse en så lille detalje som denne.

### BB-206 – Bilagsnumre tager 60 tegn i et 130 px bredt, centreret felt uden tooltip

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-04--feltets-længdegrænse-skal-blokere-og-værdien-skal-kunne-læses`
  (mønsterets **navngivne** kandidat, nu bekræftet)
- **Prioritet:** Mellem
- **Beslutning:** **IMPLEMENTERET** 2026-09-17. De syv felter har fået `BILAGSNUMMER_MAX_LENGTH` (12 tegn); dækket af `fieldCharLengthPolicy.test.ts`. Gamle `.eo`-filer er upåvirkede: grænsen er et indtastningsloft, ikke en schema-regel.
- **Sådan fremprovokeres det:**
  1. Slå «Indsæt bilagsnumre i erstatningsopgørelsen» til nederst på «EO oplysninger».
  2. Skriv 60 tegn i «Ménafgørelse → Bilagsnr.»
- **Det sker:** Alle 60 tegn accepteres. Målt: `clientWidth` = **130 px**, `scrollWidth` = **515 px**,
  `text-align: center`, `title = null`. Brugeren ser altså cirka en fjerdedel af sin egen indtastning,
  taget fra midten, og har ingen tooltip at læse resten i. Det samme gælder alle syv bilagsnummerfelter;
  grænsen er `SHORT_TEXT_MAX_LENGTH` (60), arvet fra en kategori.
- **Det er uhensigtsmæssigt fordi:** Et bilagsnummer er i praksis ét til ti tegn («3», «3-7»,
  «Bilag 12»). En grænse på 60, som feltet kun kan vise seks af, afværger intet og gør en fejlagtig
  indsættelse fra et andet dokument umulig at opdage – værdien ser rigtig ud, fordi man kun kan se
  midten af den. Sammenlign nabofeltet «Nummer» i samme sektion, som har fået sine 7 tegn valgt til
  formålet (BF-036). Udviklerens målestok af 2026-08-16 – antallet af tilladte tegn skal svare til det
  synlige indhold – er her ikke anvendt.
- **Bedre ville være:** Giv de syv bilagsnummerfelter deres egen længdekategori på **12 tegn**, som er
  rundeligt til «Bilag 12-14» og stadig læsbart i 130 px.
- **Andre steder det kan gælde:** `rg "SHORT_TEXT_MAX_LENGTH" src/inputCore/catalog` – de øvrige træf på
  EO er `oevrigeFravaersdageBeskrivelse`, `angivetMaanedsloenBaseretPaa` og
  `angivetDagsloenBaseretPaa`, som alle er bredere felter og hører til 12f. Generelt: ethvert felt, hvis
  `width`-prop er under 200 px og hvis længdegrænse er en delt konstant.

**Tilbagemelding**
Enig

### BB-207 – Et bilagsnummer, programmet finder inkonsistent, udgår tavst af papiret, mens feltet står neutralt

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
  (den spejlvendte form) og `#m-25--gaten-spørger-findes-der-noget-ikke-findes-det-brugeren-bad-om`
- **Prioritet:** Mellem
- **Beslutning:** **IMPLEMENTERET** 2026-09-17. Advarslen vises nu som gul ring ved feltet med boksens egen ordlyd; dækket af `BilagsnumreSection.advarsel.test.tsx`.
- **Sådan fremprovokeres det:**
  1. Slå bilagsnumre til. Skriv `3` i «Ménafgørelse → Bilagsnr.» med «Truffet afgørelse om varige mén
     på 5 % eller derover» slået **fra**.
  2. Skriv `7` i «Øvrige erstatningskrav → Bilagsnr.», sæt kravet til «Ja», men lad kravtabellen være tom.
  3. Hent opgørelsen.
- **Det sker:** Begge felter står **neutrale** – målt `aria-invalid = "false"`, kant
  `rgba(0, 0, 0, 0.87)`, `title = null`, ingen gul ring. Advarslerne findes, men kun i boksen «Fejl og
  advarsler» på fanen **Beregning**: «Der er angivet bilagsnummer for ménafgørelse, men angivet at der
  ikke er truffet afgørelse» og «Der er angivet bilagsnummer for øvrige erstatningskrav, men der er ikke
  indtastet øvrige krav». Det hentede dokument indeholder **ingen** «Dokumentation vedlægges som
  bilag …»-linje.
  Modprøve: udfyldes én øvrig-krav-række (`01-09-2018`, `Medicin`, `1.500`), forsvinder advarslen og
  linjen «Dokumentation vedlægges som bilag 7.» kommer med i papiret. Mekanismen er `getBilag` i
  `opgoerelseSection.ts:149-154`, som returnerer `undefined`, så snart `resolveBilagWarning` giver et
  svar.
- **Det er uhensigtsmæssigt fordi:** Advarslen afhænger af ét felts egen værdi plus ét andet valg – præcis
  den slags oplysning, der efter BB-142's og BB-159's afgørelse hører som gul ring **ved feltet**, ikke
  som tekst i en boks på en anden fane. Brugeren, der står i Bilagsnumre-sektionen og har skrevet syv
  numre, har ingen anledning til at gå til Beregning-fanen for at se, om nogen af dem blev brugt.
  Og virkningen er dobbelt: nummeret bliver ikke bare uoplyst, det bliver **udeladt af dokumentet** – et
  filtreret issue er også en filtreret bilagslinje.
- **Bedre ville være:** Giv bilagsnummerfeltet en **gul ring** med nøjagtig den sætning, boksen allerede
  bruger. Så ser brugeren det, hvor han står, og de to kanaler kan ikke drifte.
- **Andre steder det kan gælde:** `resolveBilagWarning` dækker alle syv numre – alle syv har samme
  tavse felt. Generelt hører prøven på hver `warn-*`, der er en ren funktion af ét felt plus ét valg:
  `rg "summaryDisplay: 'messageOnly'" src/domain/eoRowEvaluation` giver de rækker, hvis hele indhold er
  en besked, og de er kandidater til en feltnær visning.

**Tilbagemelding**
Enig

### BB-208 – «Opgørelse lavet den» i fremtiden afvises med to bare datoer, mens samme felts anden grænse navngiver sin kilde

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
  (skærpelsen af 2026-08-19: en besked, der genkender en grænse på dens værdi i stedet for på dens ophav)
- **Prioritet:** Lav
- **Beslutning:** **IMPLEMENTERET** 2026-09-17 i udviklerens formulering: «… og dags dato (15-09-2026)», rullet ud overalt hvor loftet er dagen i dag. Grenen genkendes nu på en eksplicit `maxBoundKind: 'dagsDato'` frem for på `origin.kind` – det var dét, der slukkede teksten, når min-grænsen var skærpet af skadedatoen.
- **Sådan fremprovokeres det:**
  1. Med skadedato `01-06-2018` i Stamdata: skriv `01-01-2018` i «Opgørelse lavet den». Hold musen over feltet.
  2. Skriv derefter `01-01-2030` i samme felt. Hold musen over feltet igen.
- **Det sker:** Den første giver **«Datoen kan ikke være før skadedatoen (01-06-2018)»** – grænsen har en
  afsender. Den anden giver **«Dato skal være mellem 01-06-2018 og 15-09-2026»** – to bare datoer, hvor
  `15-09-2026` er dags dato, uden at det siges nogen steder.
- **Det er uhensigtsmæssigt fordi:** Reglen er «en opgørelse kan ikke være lavet i fremtiden», og det er
  en regel, brugeren straks ville forstå. I stedet får han et tal, han skal genkende som i dag. Og de to
  halvdele af samme felts grænse taler i to forskellige stilarter: den ene navngiver sin kilde, den anden
  ikke. Grunden er, at dags dato-grenen kræver en statisk grænse (`bounds.kind === 'static'`), og
  `dateRanges_erstatningsopgoerelse.opgoerelse.max` er en `get max() { return getToday(); }` – en dynamisk
  getter, der beskriver kalenderen, men ikke erklærer det.
- **Bedre ville være:** «En opgørelse kan ikke være lavet i fremtiden – senest i dag (15-09-2026).»
- **Andre steder det kan gælde:** `rg "get max\(\) \{ return getToday\(\)" src/config/dateRanges.ts` –
  samme konstruktion bruges af `forligDato`, `menAfgoerelseDato` og EET-datoerne. Prøven er den samme:
  overskrid loftet og læs, om teksten siger «i dag».

**Tilbagemelding**
Delvist enig, men dit forslag bliver for kluntet.
Kunne man ikke i stedet helt konsekvent skrive "dags dato" i samtlige tooltips, som omhandler en afgrænsning som omhandler denne dato, efterfulgt af datoen i parentes, dvs. fx. ændre
Dato skal være mellem 01-06-2018 og 15-09-2026
til
Dato skal være mellem 01-06-2018 og dags dato (15-09-2026)

### BB-209 – «Vedrører perioden» er den eneste dato på fladen uden bund i sagens egen skadedato

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **IMPLEMENTERET** 2026-09-17. Begge periodefelter bruger nu `skadedatoBoundedSpec` som fladens øvrige otte datoer, hvilket efter udviklerens korrektion også giver dem erhvervssygdoms-reglen (anmeldelsesdato minus 5 år); dækket af `eoVedroererPeriodeBounds.test.ts`.
- **Sådan fremprovokeres det:**
  1. Sæt skadedato `01-06-2018` i Stamdata.
  2. Skriv `01-01-2010` i «Vedrører perioden» (fra-feltet).
- **Det sker:** Datoen accepteres med neutral kant og **ingen** besked – otte år før sagens skade. Først
  ved `01-01-2003` kommer der en afvisning: «Dato skal være mellem 01-01-2005 og 31-12-2027». De to
  grænser har intet med sagen at gøre: `01-01-2005` er datasættets dækning, `31-12-2027` er «31-12 ét år
  frem».
  Til sammenligning har **alle** fladens øvrige datoer skadedatoen som gulv og siger det:
  «Opgørelse lavet den», «Evt. dato for forlig» og samtlige seks AES-datoer.
- **Det er uhensigtsmæssigt fordi:** En erstatningsopgørelse kan ikke vedrøre en periode, der ligger før
  den skade, den opgør. Programmet kender skadedatoen og bruger den som gulv seks felter længere nede på
  samme skærm. Den, der taster et forkert årstal – den hyppigste datofejl – får ingen reaktion, og
  perioden går videre som afgrænsning af samtlige krav, af dokumentets overskriftslinje og af
  sammentællingens «Det samlede krav for perioden …».
- **Bedre ville være:** Sæt gulvet til skadedatoen på linje med fladens øvrige datoer, med samme
  besked: «Datoen kan ikke være før skadedatoen (01-06-2018)».
- **Andre steder det kan gælde:** `rg "STATIC_DATE_BOUNDS" src/inputCore/catalog` – hvert datofelt med
  statiske grænser i en sagsnær kontekst er en kandidat. På EO er `vedroererPeriodeFra`/`-Til` de eneste.

**Tilbagemelding**
Enig, dog med den korrektion, at når skadestypen er erhvervssygdomme skal bunden følge det tilsvarende mønster for andre steder, hvor bunden gerne må være en dato før anmeldelsesdatoen - jeg mener det er et år før eller noget i den stil.

### BB-210 – «Status ved erstatningsperiodens udløb» bliver til «Status den 1. januar 2019» – dagen EFTER udløbet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv` (SAGEN-formen)
- **Prioritet:** Lav
- **Beslutning:** **AFVIST** af udvikleren 2026-09-17. Datoen er den korrekte og ønskede angivelse; «erstatningsperiodens» er kun en midlertidig pladsholder, indtil faktiske datoer er indtastet.
- **Sådan fremprovokeres det:**
  1. Lad «Vedrører perioden til og med» stå tom og læs underoverskriften over «Helbredsforhold».
  2. Skriv `31-12-2018` i «til og med» og læs den igen.
- **Det sker:** Overskriften skifter fra **«Status ved erstatningsperiodens udløb»** til
  **«Status den 1. januar 2019»**. De to ordlyde beskriver to forskellige dage: udløbet er 31-12-2018,
  den viste dato er dagen efter. Dokumentet følger den dynamiske udgave: «Den 1. januar 2019 blev
  skadelidte raskmeldt.»
- **Det er uhensigtsmæssigt fordi:** Den bruger, der udfylder sagen uden en til-dato, læser at han skal
  angive status **ved** periodens udløb; den bruger, der har en til-dato, læser at det er dagen efter.
  De to svar kan være forskellige – den 31. december kan man være sygemeldt og den 1. januar raskmeldt –
  og det er dagen efter, der trykkes i papiret. Standardoverskriften er altså den forkerte af de to.
- **Bedre ville være:** Lad standardoverskriften sige det samme som den dynamiske:
  «Status dagen efter erstatningsperiodens udløb».
- **Andre steder det kan gælde:** `formatLabelDayAfterIsoDate` kaldes ét sted. Generelt: enhver
  overskrift med både en statisk og en datoudfyldt form – prøven er at læse dem op ad hinanden og spørge,
  om de udpeger samme tidspunkt.

**Tilbagemelding**
Jeg afviser fundet. Angivelse af datoen er det korrekte og ønskelige. Angivelsen af 'erstatningsperiodens' er kun en midlertidig placeholder, der af nødvendighed må benyttes, indtil der er indtastet faktiske datoer.

### BB-211 – Seks felter på fladen hedder noget andet, end skærmen siger

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne` og
  `#m-26--et-delt-felt-med-to-hjem`
- **Prioritet:** Mellem
- **Beslutning:** **IMPLEMENTERET** 2026-09-17 (udvikleren overlod beslutningen til agenten). Alle seks descriptor-labels følger nu den synlige etiket; feltets navn kommer fra `useFieldLabel`, så rækkemekanikken var uberørt.
- **Sådan fremprovokeres det:** Læs fladens tilgængelige navne op mod de synlige etiketter (målt fra
  accessibility-træet).
- **Det sker:**

  | Synligt på skærmen | Feltets eget navn (oplæsning + fejltekster) |
  |---|---|
  | Nummer | `EO-nummer` |
  | + evt. ledsagetekst | `Ledsagetekst` |
  | Helbredsforhold | `Helbredsstatus` |
  | Arbejdssituation | `Arbejdsstatus` |
  | Erstatningsopgørelse afsluttes med | `Afsluttes med` |
  | Forlig om ansvarsgrad → Procent | `Forlig ansvarsgrad (%)` |

  Til sammenligning bærer fladens **toggles** deres synlige rækketekst korrekt – «Indsæt bilagsnumre i
  erstatningsopgørelsen», «Indsæt udkast-stempel», «Revideret opgørelse» – fordi de tegnes af
  `LabeledControlRow`, mens tekstfelter og dropdowns i `row--label-right-hover`-rækker ikke får
  rækketeksten med.
- **Det er uhensigtsmæssigt fordi:** BF-057 fastslog, at formularfelter og dropdowns skal have stabile
  tilgængelige navne, der følger feltets synlige label. Det holder for den ene halvdel af fladens
  kontroller og ikke for den anden. Konsekvensen rækker ud over oplæsningen: feltets `label` er også det
  navn, fejl- og advarselstekster bruger, så en bruger kan få en besked om «Helbredsstatus» om et felt,
  der hedder «Helbredsforhold» – og det er præcis det, boksen på Beregning-fanen undgår ved at skrive
  «Helbredsforhold er ikke angivet» fra sin egen hardkodede rækketekst. Samme oplysning har dermed tre
  navne: skærmens, feltets og rækkens.
- **Bedre ville være:** Lad `row--label-right-hover`-rækkerne give feltet sit synlige navn med samme
  mekanik, `LabeledControlRow` allerede bruger. Hvor det synlige navn er delt over to tekster
  («Erstatningsopgørelse» + «Nummer»), er det sammensatte navn det rigtige.
- **Andre steder det kan gælde:** Hele programmet. Prøven er mekanisk og billig:
  `rg 'className="row--label-right-hover"' src/components` og sammenlign hver rækkes `row--text` med
  descriptorens `label`. Bemærk en kandidat lige uden for 12a: togglen «Skjul beregning efter første
  opgørelse» har descriptor-label «Komprimér beregning efter første opgørelse» (12f).

**Tilbagemelding**
Dette lyder som noget koderelateret og teknisk. Det er dit domæne. Du ejer denne beslutning.

### BB-212 – «Eventuelle særlige kommentarer» hedder «Særlige bemærkninger» i dokumentet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (BB-111's form:
  generatoren har sit eget navn for en kolonne/sektion)
- **Prioritet:** Lav
- **Beslutning:** **IMPLEMENTERET** 2026-09-17 i udviklerens variant: sagen hedder «Særlige bemærkninger» i felt og dokument, mens sektionen på indtastningsfladen beholder «Eventuelle» som valgfrihedssignal.
- **Sådan fremprovokeres det:** Skriv noget i «Eventuelle særlige kommentarer» og hent opgørelsen.
- **Det sker:** Tre navne for én ting: sektionsoverskriften «Eventuelle særlige kommentarer», feltets eget
  navn «Særlige kommentarer» og dokumentets overskrift «Særlige bemærkninger».
- **Det er uhensigtsmæssigt fordi:** Brugeren, der skal finde sin tekst igen i papiret, leder efter
  «kommentarer» og finder «bemærkninger». Det er den samme uenighed, BB-111 fandt mellem
  årslønsgeneratorens kolonnenavne og descriptorernes – og løsningen er den samme: kolonne- og
  sektionsnavne har ét sandt sted.
- **Bedre ville være:** Ét navn de tre steder. «Særlige bemærkninger» er det bedste i papiret; så skal
  sektionen på skærmen hedde det samme.
- **Andre steder det kan gælde:** `rg "renderSectionHeader\('" src/document/generators/eo` og sammenlign
  hver overskrift med sektionsoverskriften på skærmen. Kandidater i samme dokument: «Erstatningsniveau»
  (skærm: «Forlig»), «Øvrige krav» (skærm: «Øvrige erstatningskrav»), «Godkendelse» (skærm:
  «Bekræftelse»).

**Tilbagemelding**
Jeg vil gerne bibeholde "Eventuelle" i den brugerflade, hvor indtastningen sker. Brugeren skal vide, at det er valgfrit. Hvis brugeren indtaster noget, skal det i dokumentet til gengæld fremstå som en konstatering uden 'Eventuelle'. Men derudover ok til at ensartet teksten.

### BB-213 – «Erstatningsopgørelse afsluttes med» vælger mellem to lange juridiske afsnit, der ikke kan ses før dokumentet er hentet

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **AFVIST** af udvikleren 2026-09-17. Valgmulighedernes udmøntning i dokumentet er velkendt og forudsigelig for brugeren.
- **Sådan fremprovokeres det:** Åbn dropdownen «Erstatningsopgørelse afsluttes med».
- **Det sker:** Tre valg – «Bekræftet godkendt», «Underskrift-linje», «Ingen» – uden nogen angivelse af,
  hvad de producerer. De to første indsætter hver sit 3-4 linjer lange afsnit under overskriften
  «Godkendelse», og de er ordret forskellige: «… som har bekræftet, at oplysningerne er korrekte …» mod
  «… som ved sin underskrift nedenfor bekræfter, at oplysningerne er korrekte …» plus en dato- og
  underskriftsblok. «Ingen» fjerner hele afsnittet.
- **Det er uhensigtsmæssigt fordi:** Det er et juridisk valg om, hvad skadelidte erklærer, og brugeren
  kan kun se, hvad han har valgt, ved at hente dokumentet og læse det. Valget har desuden en
  standardværdi i Indstillinger, så en bruger kan have arvet det uden nogensinde at have læst ordlyden.
- **Bedre ville være:** Et informationsikon ved rækken, der viser det afsnit, det valgte punkt
  indsætter – samme greb som fladen allerede bruger andre steder.
- **Andre steder det kan gælde:** Enhver valgmulighed, hvis eneste virkning er en tekst i dokumentet.
  Prøven er den fire-vejs-sammenligning, BB-191 gav: afkrydsningsfelt · skærmoverskrift ·
  dokumentsektion · bilagstitel.

**Tilbagemelding**
Jeg afviser fundet. Det vil være velkendt og forudsigeligt for brugeren, hvad de pågældende valgmuligheder udmønter sig i i selve dokumentet.

### BB-214 – Med tom «Skadelidte» trykker underskriftsafsnittet `*skadelidtes navn*`

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-19--rødt-læses-som-tomt-af-den-flade-der-låner-værdien`
  (den spejlvendte form, jf. BB-110: dokumentet påstår noget om et tomt felt)
- **Prioritet:** Mellem
- **Beslutning:** **IMPLEMENTERET** 2026-09-17. Et tomt «Skadelidte» blokerer nu download, når «Underskrift-linje» er valgt, med en besked der navngiver årsagen; dækket af `eoRowStamdataModel.test.ts`.
- **Sådan fremprovokeres det:**
  1. Lad «Skadelidte» stå tom i Stamdata.
  2. Sæt «Erstatningsopgørelse afsluttes med» til «Underskrift-linje».
  3. Hent opgørelsen.
- **Det sker:** Downloadknappen er **aktiv** (målt: «Download som Word», `disabled = false`). Boksen på
  Beregning-fanen indeholder én linje, «'Skadelidtes navn' er ikke angivet» med link til Stamdata – en
  ikke-blokerende advarsel. Det hentede dokument har underskriftsblokken

  ```
  ____ / ____ - ____________
  Dato
  ________________________________________
  *skadelidtes navn*
  ```

  Stjernerne står ordret i papiret.
- **Det er uhensigtsmæssigt fordi:** Pladsholderen ser ud som en note til den, der byggede dokumentet,
  ikke som noget der skulle sendes. Den, der henter opgørelsen for at få den underskrevet, har ingen
  advarsel om, at netop underskriftslinjen er tom – advarslen taler om brevhovedet, ikke om
  underskriften. Og et dokument med `*skadelidtes navn*` under underskriftslinjen kan ikke bruges.
- **Bedre ville være:** Enten skal «Skadelidte» blokere download, når «Underskrift-linje» er valgt (det
  er kun i den tilstand, navnet er uundværligt) – eller underskriftsblokken skal efterlade en blank
  linje i stedet for en pladsholder. Det første er det rigtige: programmet ved, at valget kræver navnet.
- **Andre steder det kan gælde:** `rg "\*[a-zæøå ]+\*" src/document/generators` – enhver
  stjerne-pladsholder i en generator er en kandidat. Generelt: hver `?? '<pladsholder>'` i en
  dokumentgenerator, jf. BB-110's prøve `rg "\?\? 0" src/document/generators` i sin tekstform.

**Tilbagemelding**
Enig

### BB-215 – En opgørelse uden et eneste krav kan hentes uden en advarsel

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-25--gaten-spørger-findes-der-noget-ikke-findes-det-brugeren-bad-om`
- **Prioritet:** Lav
- **Beslutning:** **IMPLEMENTERET** 2026-09-17 som ikke-blokerende advarsel; en bevidst nulopgørelse kan fortsat hentes. Dækket af `eoRowOverviewRows.test.ts`.
- **Sådan fremprovokeres det:**
  1. Udfyld ramme og periode.
  2. Sæt alle tre kravvalg – svie/smerte, tabt arbejdsfortjeneste, øvrige erstatningskrav – til «Nej».
- **Det sker:** Boksen «Fejl og advarsler» **forsvinder helt**, downloadknappen er aktiv, og det hentede
  dokument er en komplet, underskriftsklar erstatningsopgørelse, der skriver «Ingen» tre gange og
  slutter med «Erstatningskrav i alt **0,00 kr.**» efterfulgt af godkendelsesafsnittet.
- **Det er uhensigtsmæssigt fordi:** Fraværet af boksen er programmets måde at sige «alt er i orden».
  Her betyder det «du har ikke rejst noget krav». De to ser ens ud. Den bruger, der har glemt at sætte
  et kravvalg til «Ja», får ingen anledning til at opdage det – opgørelsen ser færdig ud og kan sendes.
  Bemærk skellet mod BB-119's afvisning: dette er ikke et klampet nul, der udtrykker ydelsens egen regel,
  men et nul, der udtrykker, at der ikke er spurgt om noget.
- **Bedre ville være:** En ikke-blokerende advarsel, «Der er ikke rejst krav under nogen af de tre
  emner – opgørelsen vil vise 0 kr.», så nullet er et valg og ikke et fravær.
- **Andre steder det kan gælde:** Tilsvarende flader med flere valgfri krav. Prøven er M-25's egen, kørt
  på den tomme ende: slå alt fra og se, om gaten stadig slipper igennem.

**Tilbagemelding**
Enig

### BB-216 – M-27 bekræftet på 12a: en rød Skadedato slukker «Opgørelse lavet den»s egen regel

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-27--en-rød-værdi-på-en-anden-flade-slukker-en-regel-her`
- **Prioritet:** Lav
- **Beslutning:** Agent afgør (registreret som bekræftet forekomst; ingen selvstændig rettelse foreslås). Bekræftet af udvikleren 2026-09-17; ingen rettelse ud over M-27s generelle regel.
- **Sådan fremprovokeres det:**
  1. Med skadedato `01-06-2018`: skriv `01-01-2018` i «Opgørelse lavet den» – feltet bliver rødt med
     «Datoen kan ikke være før skadedatoen (01-06-2018)».
  2. Sæt Skadedato i Stamdata til `99-99-9999`.
  3. Skriv `01-01-2006` i «Opgørelse lavet den».
- **Det sker:** Datoen accepteres – tolv år før sagens egen skadedato – med neutral kant
  (målt `rgba(0, 0, 0, 0.25)`) og uden besked.
- **Det er uhensigtsmæssigt fordi:** Fraværet af en rød kant er programmets måde at sige «kontrolleret og
  i orden»; her betyder det «kontrollen kunne ikke køres».
  **Forekomsten er dog afbødet på netop denne flade**, i modsætning til BB-139's: EO har en «Fejl og
  advarsler»-boks, den navngiver den røde Skadedato («Skadedato: Der er udfyldt en ugyldig værdi i feltet
  'Skadedato'» med link til Stamdata → Skadelidte), og download er blokeret. Skaden er dermed synlig et
  andet sted og reversibel – felterne bliver røde, så snart skadedatoen rettes.
- **Bedre ville være:** Ingen selvstændig rettelse ud over M-27's generelle regel. Registreres, så
  mønsterets udbredelse er kendt.
- **Andre steder det kan gælde:** `skadedatoBoundedSpec` bruges af «Opgørelse lavet den», «Evt. dato for
  forlig», «Dato for første ménafgørelse» og de fire EET-datoer på denne fane – alle syv har samme
  slukning.

**Tilbagemelding**
Enig

## Overvejet uden fund

- **Længdegrænserne holder ved paste og tastning.** Målt: «Nummer» afkorter til 7 tegn, «+ evt.
  ledsagetekst» til 64, «Eventuelle særlige kommentarer» til 512 – ordret de kontraktlige tal (BF-035,
  BF-036, BF-037). Ingen tavs udvidelse.
- **Ulovlige filnavnstegn i «Nummer» er uskadelige.** `1/2` og `2😀` accepteres i feltet;
  `sanitizeFilenamePart` gør `/` til `_`, og filnavnet dannes uden fejl. Efter M-05's afgrænsning (en
  professionel målgruppe) er et emoji i et nummerfelt ikke et fund.
- **M-07 er efterprøvet på forligsparret og bestået.** Procent `50` + brøk `1/2` gør **begge** celler røde
  (målt `rgb(211, 47, 47)`) med samme tooltip «Kan ikke udfylde både procent og brøk». Teksten er
  symmetrisk, fordi udvejen er den samme i begge felter. Bemærkning uden fundstatus: teksten siger hvad
  der er forbudt, ikke hvad brugeren skal gøre («ryd det ene») – en skærpelse i M-29's ånd, hvis
  udvikleren senere vil gennemgå ordlyde.
- **Forligsdato uden ansvarsgrad markeres korrekt og med afsender.** Kun dato udfyldt → dato-feltet rødt
  med «Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk». Beskeden navngiver begge
  mulige udveje.
- **M-09 er efterprøvet og BESTÅET.** Ingen vandret scroll på «EO oplysninger» hverken ved 1536×864
  (`scrollWidth` = `clientWidth` = 1536) eller ved den kontraktlige smalle grænse 1244×620
  (`scrollWidth` = `clientWidth` = 1244).
- **M-10 er efterprøvet og BESTÅET.** Rul-til-toppen-knappen står ved (1451, 779) på en rullet
  EO-oplysningerside og overlapper **intet** af fladens felter, etiketter eller knapper (målt
  rektangelskæring mod samtlige `[data-mineo-field-address]`, `p`, `label` og `button`). Sektionerne er
  venstrestillede, så det nederste højre hjørne er tomt.
- **Udkast-stemplet er i BEGGE dokumentkanaler.** Word-filen bærer vandmærket i `word/header1.xml` og
  `header2.xml`, og filnavnet får « (udkast)». Ingen M-13-divergens mellem PDF og Word her.
- **Titlens forhåndsvisning på Beregning-fanen følger dokumentet.** «Revideret erstatningsopgørelse 3
  (revideret efter møde)» står ordret begge steder – bortset fra det dobbelte mellemrum, som skærmen
  ikke kan vise (BB-204).
- **«Revideret opgørelse» slår korrekt igennem.** Titlen bliver «Revideret erstatningsopgørelse N» med
  lille begyndelsesbogstav på det andet ord, som dansk retskrivning kræver.
- **«Opgørelse lavet den» styrer brevhovedets dato og en dokumentsætning.** Datoen bliver brevhovedets
  «1. marts 2026» og indgår i «Der er den 1. marts 2026 ikke truffet afgørelse om varige mén.». BB-122's
  bekymring (en forudsætning, der findes på skærmen og ikke i papiret) er dermed ikke aktuel her, så
  længe brevhovedet for Erstatningsopgørelse er slået til som standard.
- **Bilagsnumrene overlever, når togglen slås fra og til igen.** Værdierne bevares (de neutraliseres
  ikke i `neutralizeIrrelevantEoInputs`, som bevidst kun rører talfødende input). Skjulningen er
  programmets almindelige toggle-adfærd og ikke et nyt fund.
- **Fradraget «Svie/smerte-krav i tidligere erstatningsopgørelser» går ikke tabt.** Målt: `45.000,00 kr.`
  står der uændret, når «Nummer» ændres til en form, der skjuler feltet, og tilbage igen. Kun
  *anvendelsen* er tavs (BB-202), ikke værdien.
- **Konsollen var tavs.** 200 beskeder, 0 advarsler, 2 fejl – begge `ERR_CONNECTION_REFUSED` på
  `favicon-mineo.svg` fra en genstartet udviklingsserver, altså et miljøforhold og ikke produktets.

## Dækningshuller

- Kun Chrome, lyst tema, 1536×864 (M-09 desuden 1244×620).
- **PDF-kanalen er ikke læst.** Alle dokumenter er hentet som `.docx`. Dobbelt mellemrum (BB-204),
  `*skadelidtes navn*` (BB-214) og de manglende bilagsreferencer (BB-207) er verificeret i Word-XML;
  PDF-udgaven er kildelæst (samme generator, samme model) og ikke målt.
- **`Gem`/`Hent` er ikke afprøvet.** Værd at måle her, fordi «Indsæt udkast-stempel»,
  «Skjul beregning efter første opgørelse» og «Indsæt bilagsnumre» alle har en standardværdi, og fordi
  BB-203's toggle kan komme tilbage afkrydset efter en Hent.
- **Undo/redo umiddelbart efter en ændring af «Nummer»** er ikke målt – det er netop det tastetryk, der
  flytter mest (BB-202, BB-203).
- **Brevhovedet slået fra** for Erstatningsopgørelse er ikke afprøvet; i den tilstand står
  «Opgørelse lavet den» kun i papiret, når varige mén-afgørelsen er «Nej».
- **Meget lange kommentarer (512 tegn) i dokumentets ombrydning** er ikke set; kun længdegrænsen er målt.
- **Kontrolfanerne** blev slået til for at bekræfte, at «Første erstatningsopgørelse?» kun findes dér.
  Selve fanerne er 12m's emne og er ikke gennemgået.

## Åbne spørgsmål

1. **Skal «Nummer» overhovedet kunne afgøre, om sagen regnes som første opgørelse?** Reglen er i dag
   udledt af feltets tekst og fejler for enhver skrivemåde med et foranstillet ord eller bogstav
   («Nr. 2», «EO2», «A2» regnes alle som første). Spørgsmålet er, om udvikleren vil (a) beholde
   udledningen og blot vise dens resultat på skærmen, eller (b) gøre «Er dette sagens første
   erstatningsopgørelse?» til et eksplicit Ja/Nej-valg, hvor nummeret kun foreslår svaret. Valget
   afgør, om BB-202 er en visningsrettelse eller en ny kontrol.
2. **Skal en erstatningsopgørelse kunne vedrøre en periode, der begynder før skadedatoen?**
   Fladens øvrige otte datoer har skadedatoen som gulv; «Vedrører perioden» har 01-01-2005. Er der en
   sagstype, hvor perioden lovligt ligger før skaden – eller er gulvet blot aldrig sat (BB-209)?
3. **Skal en opgørelse uden et eneste krav kunne hentes tavst?** Den kan i dag (BB-215). Er en
   opgørelse på 0 kr. et legitimt produkt – fx en «nulopgørelse» til modparten – eller er det altid en
   glemt indstilling?
