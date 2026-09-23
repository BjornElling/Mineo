# Brugerblik – Erstatningsopgørelse → Svie- og smertegodtgørelse (12b)

- Rute/placering: `/erstatningsopgoerelse` → fanen «EO oplysninger», sektionen **Svie- og
  smertegodtgørelse** (kravvalget, «Tidligere beregnet S/S til max.», periodetabellen, satsåret,
  satsen ved delvis sygemelding, «Svie/smerte-krav i tidligere erstatningsopgørelser» og «Evt.
  allerede modtaget svie/smerte for nuværende erstatningsperiode») – samt opgørelsesdokumentets
  afsnit «Svie- og smertegodtgørelse» med underafsnittene Status, Sygeperiode(r), Beregningsgrundlag
  og Beregnet krav.
- Gennemgået: 2026-09-22 · commit `545c3c4d`
- Afprøvet i: Chrome, lyst tema, 1536×864 (M-09 desuden 1244×620). Dokumenter hentet som `.pdf` og
  læst med `pdftotext -layout`.

## Fladen kort

12b er det første af opgørelsens tre erstatningskrav og det eneste, der opgøres af rene datoer og en
takst. Brugeren svarer Ja/Nej/Skjul på, om der er krav, angiver eventuelt at maksimum allerede er
nået, taster sygeperioderne med en tilstand (sygemeldt/delvist sygemeldt) pr. række, vælger hvilket
års satser der lægges til grund og hvilken sats delvis sygemelding regnes med, og kan fradrage dels
det, der er opgjort i tidligere erstatningsopgørelser, dels det, skadelidte allerede har modtaget for
den nuværende periode.

Sektionen regner selv, men **viser intet tal**: både dagsantallet, satserne, det effektive loft og
selve beløbet findes kun i det hentede dokument og på kontrolfanen «EO-kontrol», som er slået fra
som standard. Kravet afhænger af 12a's «Vedrører perioden» og «Forlig» og af 12d's ménafgørelsesdato;
det indgår i 12l's sammentælling.

**Afgrænsning.** Rækken «Helbredsforhold» styrer sektionens Status-linjer i dokumentet, men står i
sektionen «Erstatningsopgørelse» og er gennemgået i 12a (BB-211). «Forlig» og «Vedrører perioden» er
kun brugt som forudsætninger; deres egne felter hører i 12a. Bilagsnummerfeltet «Bilagsnr.
svie/smerte-dokumentation» hører i 12a (BB-206, BB-207) og er her alene efterprøvet som
konsistensregel, se «Overvejet uden fund».

## Fund

### BB-217 – Tabellens «Antal dage» tæller dage, opgørelsen ikke betaler for – og programmet har det rigtige tal

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` og
  `#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-22 i en skærpet form: kolonnen skal vise antallet af
  dage i EO-perioden, men reduktionen må ikke ske tavst. Kolonneoverskriften skal kort bære årsagen –
  «Antal dage (i EO-perioden)» eller tilsvarende – så brugeren, der taster to datoer med 90 dages
  mellemrum og ser 59, kan se hvorfor. Sumlinje-alternativet er ikke valgt.
  **GENNEMFØRT** 2026-09-22: `useEoOplysningerViewModel` clamper hver række mod EO-perioden med
  `clampSvieSmerteRange` + `resolveSvieSmerteEoPeriodeBounds`, og kolonnen hedder nu «Antal dage
  (i EO-perioden)». Der clampes mod EO-perioden ALENE – ménafgørelsens cutoff er en fejlgivende
  grænse med rød celle og egen besked og skal ikke også tælle dage ned bag om ryggen. Engineens
  `constrainedPeriods` kunne ikke bruges: den fletter og sorterer perioderne, så rækkeidentiteten
  går tabt. Dækket af `SvieSmerteTable.antalDage.test.tsx` (59 og 0 som målt i fundet).
- **Sådan fremprovokeres det:**
  1. Stamdata: skadedato `01-06-2018`. EO oplysninger: «Vedrører perioden» `01-01-2024` – `31-12-2024`,
     «Nummer» `1`, satsår `2024`.
  2. Tast en svie/smerte-række `01-12-2023` – `28-02-2024`, Sygemeldt.
  3. Hent opgørelsen på Beregning-fanen.
- **Det sker:** Tabellens kolonne «Antal dage» skriver **90**. Dokumentet skriver «**59** sygedage á
  230 kr. =» og «7.590,00 kr.» → målt `13.570,00 kr.` mod de 90 dages `20.700 kr.` Perioden er stille
  klippet til opgørelsesperiodens start (`01-01-2024`), som `svieSmerteEngine`s trin 3 er skrevet til
  («stille clamping mod EO-perioden (ingen fejlindikation)»). Ingen celle er rød (målt
  `aria-invalid = "false"` på alle seks celler), ingen advarsel, og intet på fladen nævner klipningen.
  **Den rene form er værre:** en række, der ligger helt uden for opgørelsesperioden – `01-01-2023` –
  `31-12-2023` – står i tabellen med **365** i «Antal dage» og optræder hverken i dokumentets
  periodeliste eller i beløbet. Målt: 6.440,00 kr. for den ene resterende række; den 365 dages række
  bidrager med nul og er umarkeret.
  **Og netop den tilstand er den, programmet beder om.** Informationsikonet ved «Periode:» siger
  ordret: «Indsæt alle perioder. **Tidligere indtastede perioder skal ikke slettes ved senere
  opgørelse.**» Rækker uden for perioden er altså normaltilstanden fra og med 2. opgørelse.
  **Programmet kender det rigtige tal og har formuleret det:** rækken «Antal svie/smerte-dage i
  erstatningsperioden» → «28 sygedage» findes i `buildEoSvieSmerteRows` og vises udelukkende på
  kontrolfanen «EO-kontrol», som er slået fra som standard.
- **Det er uhensigtsmæssigt fordi:** «Antal dage» er det eneste tal, brugeren ser, mens han taster.
  Han kontrollerer sit arbejde mod det, og det er ikke det tal, kravet regnes af. Den, der efterregner
  dokumentet mod skærmen, finder 90 det ene sted og 59 det andet og har intet at forklare forskellen
  med – mens en hel række på 365 dage står i tabellen uden at være med i noget. Fejlen rammer ikke en
  sjælden tastefejl, men præcis den arbejdsgang, tooltippet foreskriver.
- **Bedre ville være:** Lad kolonnen vise det antal dage, opgørelsen betaler for – altså rækkens bidrag
  efter afgrænsningen til opgørelsesperioden – og markér en række, der ligger helt uden for perioden,
  som medregnet med 0 (nedtonet tekst eller «0 (uden for perioden)»). Rækkens egen længde er ikke en
  oplysning, brugeren har brug for; bidraget er. Alternativt behold rækkens egen længde og tilføj en
  sumlinje under tabellen med «Heraf i erstatningsperioden: N dage», som er det tal, kontrolfanen
  allerede har.
  **Efter udviklerens afgørelse:** bidraget vises, og kolonneoverskriften bærer årsagen kort, så det
  lavere tal ikke fremstår som en tavs reduktion.
- **Andre steder det kan gælde:** Enhver periodetabel, hvis rækker afgrænses af en anden flades
  periode, og som viser en afledt størrelse pr. række. Konkret: TAF-periodetabellen (12e) har samme
  afskæring mod «Vedrører perioden» og mod AES-afgørelsesdatoerne; ferieperiodetabellen (12e/12f) og
  lønindkomstens perioder (12h) har samme struktur. Prøven er billig:
  `rg "stille clamping|ingen fejlindikation" src/domain` og for hvert træf, hvad tabellen viser pr.
  række.

**Tilbagemelding**
Enig i, at det må være antal dage i perioden, der vises - men med en kort(!) formulering som tydeliggør for brugeren, at dette er årsagen til, at brugeren ser et væsentlig lavere antal dage end forventet. Det vil blot være forkert på en anden måde, hvis brugeren indtaster to datoer med 90 dage imellem, men får vist 57 dage - altså at antallet tavst reduceres uden forklaring. Optimalt vil være, hvis beskrivelsen blot kort indføjer 'i EO-perioden' eller '(i EO-perioden)' eller lignende, så brugeren er orienteret om årsagen.

### BB-218 – Overlappende perioder spærrer hele opgørelsen uden en eneste rød celle, mens de tre andre regler på samme celler farver dem

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
  (i den spejlvendte form: advarslen er slet ikke hængt på feltet)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-22, med en tilføjelse ud over fundet: overlappet
  skal give rød ring og fortsat blokere, og «Fejl og advarsler» skal kun vise **én** linje, når det er
  samme fejlmeddelelse om overlappende perioder. De to ordret ens linjer skal altså ikke gøres
  entydige ved at navngive hver sin modpart, men foldes til én.
  **GENNEMFØRT** 2026-09-22: nyt `svieSmerteOverlapIssues.ts` projekterer overlappet som
  `FieldIssue` pr. celle – samme vej som cutoffen – og begge celler i BEGGE rækker markeres.
  Tooltippen navngiver modparten («Perioden overlapper perioden 15-02-2024 - 10-03-2024»), hvilket
  netop er dét, der gør den ene boks-linje tilstrækkelig. Foldningen sker i `EOberegningTab`s
  `renderEoRows` på den viste tekst, ikke på rækkerne: rækkerne gater download hver for sig, og kun
  visningen var dublet. Fordi foldningen ligger i den fælles renderer, gælder den alle boksens
  linjer, ikke kun overlap. Dækket af `svieSmerteOverlapIssues.test.ts`.
- **Sådan fremprovokeres det:**
  1. Tast to svie/smerte-rækker: `01-02-2024` – `28-02-2024` Sygemeldt og `15-02-2024` – `10-03-2024`
     Delvist Sygemeldt.
  2. Gå til Beregning-fanen.
- **Det sker:** «Fejl og advarsler» viser to gange «Der er overlappende perioder», download er spærret
  («Opgørelse kan ikke hentes, når der er fejl ovenfor»), og **ingen af de seks celler er røde** (målt
  `aria-invalid = "false"` på alle). Beregning-fanens sammendrag skriver «Svie/smerte-periode: Fejl».
  Til sammenligning, på nøjagtig de samme to celler:
  - **til før fra** → begge celler røde, med hinandens spejlbilleder: «Fra-dato skal være før til-dato
    (01-01-2024)» og «Til-dato skal være efter fra-dato (01-03-2024)».
  - **dato efter ménafgørelsen** → tre celler røde med tooltippet «Der er angivet svie/smerte efter
    datoen for en ménafgørelse (01-02-2024)».
  Fladen har altså fire periode-regler, hvoraf tre farver cellen og den fjerde ikke gør.
  Boksens link virker – målt ét `mineoFieldAttentionBlink` på den rigtige rækkes `fra`-celle pr. linje
  – men to ordret ens linjer siger ikke, hvilke to rækker der overlapper, før man har klikket på hver
  af dem.
- **Det er uhensigtsmæssigt fordi:** Fraværet af en rød kant er programmets måde at sige «denne celle
  er kontrolleret og i orden». Her er cellen ikke i orden – den spærrer hele opgørelsen – og ser
  alligevel ud som de øvrige. Brugeren, der står i tabellen, har ingen anledning til at gå til
  Beregning-fanen for at få at vide, at netop de rækker, han kigger på, er problemet. Udviklerens
  afgørelse ved BB-142 er den modsatte: en indtastningsfane skal vise fejl i faktisk foretagne
  indtastninger som rød eller gul ring med tooltip.
- **Bedre ville være:** Giv overlappet den samme behandling som ménafgørelses-cutoffen, som allerede er
  bygget: projektér overlappet som et `FieldIssue` pr. deltagende celle og send det ind i tabellen som
  `collectionRuleIssue` – samme vej, `svieSmerteCutoffDateIssues` går. Tooltippen bør navngive
  modparten, som dato-orden-teksten gør: «Perioden overlapper perioden 15-02-2024 - 10-03-2024».
  **Efter udviklerens afgørelse** foldes boksens ens linjer til én. Det er den røde ring, der derefter
  bærer udpegningen af hvilke rækker der er tale om – så tooltippens navngivning af modparten er ikke
  længere en forbedring, men forudsætningen for at den ene boks-linje er nok.
- **Andre steder det kan gælde:** `detectOverlappingPeriods` bruges også af TAF-perioderne (12e),
  ferieperioderne (12e/12f) og lønindkomstens perioder (12h). Prøven:
  `rg "detectOverlappingPeriods|overlappende perioder" src/domain` og for hvert træf, om resultatet
  når en celle eller kun en boks.

**Tilbagemelding**
Enig. Overlappende perioder skal give rød ring og blokere - og meddelelsen i fejl og advarsler skal kun vises én gang, hvis der er tale om samme fejlmeddelelse om overlappende perioder.

### BB-219 – «(reduceret til max)» står ved siden af 0,00 kr., og det loft, reduktionen faktisk skete til, står intet sted i papiret

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv` (SAGEN-formen)
  og `#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT i substansen, omlagt i løsningen** af udvikleren 2026-09-22, i tre dele:
  1. **Opbrugt maksimum behandles som togglen.** Når et indtastet «tidligere opgjort»-beløb indebærer,
     at der ikke længere er et krav, skal dokumentet skrive det samme som når «Tidligere beregnet S/S
     til max.» er sat – altså de to tilstande helt ens. Den detaljerede regnestykke-linje
     («… nedsat til restbeløbet under maksimum …») er dermed **ikke** valgt. Bemærk, at den fælles
     formulering først findes, når BB-221 er gennemført: i dag skriver togglen «Ingen».
  2. **Gul ring og advarsel**, når det indtastede tidligere beløb overstiger maksimum. Nyt krav ud over
     fundet; i dag tages `100.000` imod uden nogen markering.
  3. **Loftet ved forlig: delvist godkendt.** Den nuværende parentes-form anses for at kunne læses, men
     en formulering i stil med «50 %, svarende til 115 kr. pr. sygedag, dog højst 44.250 kr.» er at
     foretrække – altså det forligsreducerede tal trykt frem for udledt.
  **GENNEMFØRT** 2026-09-22, alle tre dele. Engineen fik `maksimumOpbrugtFoerPerioden` (adskilt fra
  `maxApplied`, som også er sand ved en ren nedskæring til restpladsen), og præsentationsmodellen
  fører begge veje til en udtømt ramme sammen i ét `ingenBeloebAarsag: 'maksimumOpbrugt'`.
  Dokumentet skriver samme sætning i begge tilfælde fra én konstant, så de ikke kan drive fra
  hinanden. Takstlinjen ved forlig skriver nu både de ureducerede tal og «svarende til …, dog højst
  44.250 kr.» Udviklerens svar på modsvaret: de to tilstande er samme virkelighed og skal sige
  ordret det samme – det indtastede beløb nævnes derfor ikke i den beregnede variant.
  Den gule ring ligger på selve feltet OG som linje i boksen, med teksten hentet fra ét sted
  (`svieSmerteMaksimum.ts`), så de to kanaler ikke kan drive fra hinanden – BB-207's lære. Grænsen
  er det FORLIGSREDUCEREDE maksimum, altså det beregningen bruger. Advarslen er ikke-blokerende:
  beløbet kan være rigtigt, hvis rammen reelt er opbrugt.
  Dækket af `svieSmerteEngine.test.ts`, tre nye sager i
  `erstatningsopgoerelsePdf.indkomstBreakdownVisibility.test.ts` og tre i
  `eoRowSvieSmerteTidligereTotalWarning.test.ts`.
- **Sådan fremprovokeres det:**
  1. «Nummer» `2` (så fradragsfeltet vises), én periode `01-02-2024` – `28-02-2024` Sygemeldt,
     satsår `2024`.
  2. «Svie/smerte-krav i tidligere erstatningsopgørelser» = `100.000`.
  3. Hent opgørelsen.
- **Det sker:** Dokumentet skriver «Svie- og smertegodtgørelse **0,00 kr.**» og under «Beregnet krav»
  linjen «28 sygedage á 230 kr. **(reduceret til max)** =». Kravet er ikke reduceret til maksimum – det
  er reduceret til ingenting, fordi maksimum var brugt op i forvejen. Samme suffiks bruges i den
  tilstand, hvor det er sandt: med `85.000` bliver linjen «28 sygedage á 230 kr. (reduceret til max) =»
  og beløbet `3.500,00 kr.`, altså `88.500 − 85.000`.
  **Dertil mangler selve loftet, når der er forlig.** Med forlig på `50 %` skriver papiret «Taksten
  udgør 50 % af (230 kr. pr. sygedag, dog højst **88.500** kr.)». Det loft, beregningen bruger, er
  `44.250 kr.`, og det tal trykkes ingen steder. Programmet har det færdigformuleret: kontrolfanens
  række «Satser per dag/max (forlig på 50 %)» → «115,00 kr. / **44.250,00 kr.**».
  Feltet accepterer `100.000` uden rød kant, gul ring eller besked, selv om beløbet er højere end det
  maksimum, dokumentet trykker to linjer længere oppe.
- **Det er uhensigtsmæssigt fordi:** Modparten læser et regnestykke, der ikke går op: `28 × 230` giver
  6.440, papiret giver 0, og den eneste forklaring – «reduceret til max» – siger noget, der ikke er
  sket. Fradraget af de tidligere opgørelsers beløb i loftet optræder aldrig som et led i
  regnestykket, kun som en løs sætning i afsnittet ovenfor. Ved forlig skal læseren selv gange loftet
  med forligsgraden for at kunne følge med.
- **Bedre ville være:** Skriv, hvad der faktisk skete, og med de tal, der faktisk gjaldt:
  «28 sygedage á 230 kr. = 6.440 kr., nedsat til restbeløbet under maksimum (44.250 kr. − 100.000 kr.)
  = 0 kr.» Som minimum: brug «(maksimum er opbrugt)» i den tilstand, hvor restpladsen er nul, og lad
  «dog højst …» vise det loft, beregningen bruger, altså det forligsreducerede.
- **Andre steder det kan gælde:** Ethvert sted, hvor en forligsgrad reducerer en lovbestemt grænse, og
  hvor papiret trykker den ureducerede. Prøven: `rg "FoerForlig" src/domain src/document` – hvert par
  af «før forlig»/«efter forlig» er et sted, hvor de to tal kan komme til at stå hver for sig.
  Den generelle form – et suffiks, der forklarer én af to tilstande – findes også i
  `opgoerelseSection.ts`' øvrige fradragslinjer.

**Tilbagemelding**
Enig i selve fundet, men ikke nødvendigvis i løsningen.
Hvis der som nævnt i dit eksempel indtastes et allerede-betalt beløb, der indebærer, at der ikke længere er krav, kan vi da ikke genbruge formuleringen fra når brugeren krydser af i togglen med, at der er udbetalt fuldt svie-smerte i tidligere erstatningsopgørelse. Altså behandle de to situationer helt ens?

Der må gerne komme gul ring og advarsel i fejl og advarsler-boksen, hvis der er indtastet et tidligere betalt svie-smerte beløb, der overstiger max.

Jeg er delvist enig i behovet for at ændre formuleringen omkring max svie-smerte ved forlig. Den nuværende formulering addresserer på sin vis problemet ved at sætte dem i parentes, så brugeren kan udlede, at det både er 50 % af dags-satsen og max-beløbet: "50 % af (230 kr. pr. sygedag, dog højst **88.500** kr.)" men måske man kan lave en formulering i stil med "50 %, svarende til 115 kr. pr. sygedag, dog højst 44.250 kr." eller noget i den stil?

**Modsvar (afventer udviklerens svar)**
Din løsning er bedre end min, og den er indarbejdet. Men den har en rækkefølge-binding, du bør kende,
før den sættes i værk: **den formulering, du vil genbruge, findes ikke endnu.** Togglen «Tidligere
beregnet S/S til max.» skriver i dag ordret «Ingen» – det er præcis dét, BB-221 er skrevet om, og som du
har godkendt skal laves om. Genbruger vi togglens nuværende ordlyd, arver det opbrugte maksimum altså
den fejl, BB-221 skal rette.

Rækkefølgen er derfor: **BB-221 først** (togglen får sin rigtige sætning, fx «Maksimum for svie- og
smertegodtgørelse er nået i tidligere erstatningsopgørelse»), **BB-219 bagefter** (samme sætning bruges,
når et indtastet beløb udtømmer maksimum). Jeg foreslår, at de to gennemføres som én ændring med den
fælles sætning som ét sted i koden.

**Ét spørgsmål, som ordlyden afhænger af.** De to tilstande er ikke helt den samme virkelighed: togglen
er brugerens *påstand* om, at maksimum er nået, mens det opbrugte maksimum er programmets *beregning*
ud fra et indtastet beløb. Skal papiret sige nøjagtig det samme i begge – altså uden at nævne det
indtastede beløb – eller skal den beregnede variant nævne, hvad maksimum blev opbrugt af? Jeg hælder
til det første, fordi det er dét, «behandle de to situationer helt ens» betyder, og fordi beløbet
allerede står i afsnittet ovenfor. Men det er din afgørelse, og den bestemmer, om sætningen kan være
én streng eller skal have en variant.

**Tilbagemelding**
Det er både beregningsteknisk og ud fra brugerens forventninger den samme tilstand, om brugeren selv angiver, at maksimum er nået, eller om programmet beregner, at maksimum er nået. De skal behandles ens.

### BB-220 – Et indtastet `0` meldes som «ikke angivet», mens dokumentet i samme sag trykker «0 kr.»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Mellem
- **Beslutning:** **DELVIST AFVIST** af udvikleren 2026-09-22: netop for svie/smerte er det korrekt og
  ønsket, at `0` og tomt behandles ens, fordi brugeren i 2. opgørelse er i tvivl, når 1. opgørelse ikke
  rummede et svie/smerte-krav, og derfor ved en fejl kan taste `0`. Advarslen skal altså blive stående
  ved `0`. **Den anden halvdel af fundet er ikke afgjort hermed:** dokumentets «Der er opgjort svie- og
  smertegodtgørelse med 0 kr. for tidligere perioder.» siger fortsat det modsatte af advarslen i samme
  sag. Presset på uenigheden skærm/papir – se «Åbne spørgsmål».
  **AFGJORT OG GENNEMFØRT** 2026-09-22 efter modsvaret: udvikleren er enig i, at dokumentet ikke
  skal skrive «med 0 kr.» – teksten er selvmodsigende. Advarslens `> 0`-prøve står derfor
  uændret (et indtastet 0 behandles bevidst som tomt), og præsentationsmodellen spejler nu samme
  prøve, så papiret tier ved 0 præcis som ved et tomt felt. Ingen beløb ændres: 0 fradrages ikke i
  maksimum. Dækket af en ny sag i `erstatningsopgoerelsePdf.indkomstBreakdownVisibility.test.ts`.
- **Sådan fremprovokeres det:**
  1. «Nummer» `2`, én svie/smerte-periode, satsår udfyldt.
  2. Skriv `0` i «Svie/smerte-krav i tidligere erstatningsopgørelser». Tab ud.
  3. Gå til Beregning-fanen og hent derefter opgørelsen.
- **Det sker:** Feltet viser `0,00`. «Fejl og advarsler» skriver alligevel «Der er ikke angivet et
  svie-/smertebeløb for tidligere erstatningsopgørelser» – og dokumentet, hentet i samme tilstand,
  skriver «Der er opgjort svie- og smertegodtgørelse med **0 kr.** for tidligere perioder.»
  Årsagen er prøven `!(typeof tidligereTotalAmount === 'number' && tidligereTotalAmount > 0)` i
  `eoRowSvieSmerteRows.ts`: nul regnes som fravær i advarslen og som en værdi i dokumentet.
- **Det er uhensigtsmæssigt fordi:** `0` er det rigtige svar i en almindelig sag – 2. opgørelse i et
  forløb, hvor den første kun rummede tabt arbejdsfortjeneste. Brugeren har svaret på spørgsmålet, og
  programmet bliver ved med at bede om et svar, han ikke kan give på nogen anden måde. Advarslen kan
  altså ikke ryddes, og den står tilbage i boksen resten af sagen, hvor den lærer brugeren, at boksens
  advarsler ikke behøver at være rigtige. Samtidig modsiger papiret skærmen om den samme oplysning.
- **Bedre ville være:** Lad advarslen hvile på, om feltet er tomt (`=== undefined`), ikke på om værdien
  er større end nul – samme prøve, mønsteret er afgjort på ved BB-030. Et indtastet `0` er et svar.
- **Andre steder det kan gælde:** `rg "> 0" src/domain/eoRowEvaluation` over de prædikater, der afgør
  en advarsels synlighed. Nabofeltet «Evt. allerede modtaget svie/smerte …» har ingen tilsvarende
  advarsel og er derfor ikke ramt; TAF's «Tidligere modtaget TAF» (12e) og «Øvrige erstatningskrav»
  (12c) er uafprøvede kandidater med samme struktur.

**Tilbagemelding**
Hvad svie/smerte angår må det forventes, at brugere vil være i tvivl om, hvad de skal indtaste i anden opgørelse i den situation, hvor der ikke er et svie-smerte krav i første opgørelse, og at brugere ved en fejl vil udfylde feltet med 0. Det er derfor korrekt og ønskelig adfærd, at det netop i denne situation behandles ens om brugeren indtaster 0 eller lader feltet være tomt.

**Modsvar (afventer udviklerens svar)**
Din begrundelse er god, og jeg presser ikke på indtastningssiden: `0` og tomt skal behandles ens, og
advarslen bliver stående. Det er indarbejdet.

**Men fundet havde to halvdele, og dit svar afgør kun den ene.** Uenigheden mellem skærm og papir
består uændret – den er bare vendt om. Før din afgørelse kunne man læse `0` som et svar fra den, der
taster, og så var advarslen fejlen. Efter din afgørelse er `0` **ikke** et svar – og så er det dokumentet, der tager
fejl:

> «Der er opgjort svie- og smertegodtgørelse med **0 kr.** for tidligere perioder.»
> (`opgoerelseSection.ts:278`, grenen `tidligere.status === 'ok'`)

Papiret oplyser altså modparten om et beløb, som programmet i samme sag siger mangler at blive angivet.
Og det rammer præcis den bruger, din begrundelse handler om: den, der i tvivl taster `0`, får en
advarsel, han ikke kan rydde, **og** en sætning i det dokument, han sender ud, som bekræfter det tal,
programmet ikke vil anerkende.

Den konsekvente følge af din egen afgørelse er, at dokumentet tier ved `0`, nøjagtig som det tier ved
tomt – altså at prøven i `opgoerelseSection.ts` bruger samme skel som advarslen. Bemærk, at det ikke
ændrer noget beløb: `0` fradrages ikke i noget som helst, hverken før eller efter.

**Spørgsmålet, jeg beder om svar på:** skal dokumentet fortsat trykke «med 0 kr.», når brugeren har
tastet `0`? Jeg mener nej – ét felt bør ikke have to modsatte betydninger på skærmen og i papiret. Er
du uenig, står fundet lukket som det er, og den anden halvdel bortfalder.

**Tilbagemelding**
Jeg er enig med dig i din afsluttende vurdering. Dokumentet skal ikke angive "med 0 kr." - det er en selvmodsigende tekst.

### BB-221 – To forskellige virkeligheder giver samme ene ord i dokumentet: «Ingen»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-22. Dokumentet skal skrive grunden, programmet
  allerede har, i stedet for «Ingen», når «Tidligere beregnet S/S til max.» er sat; «Nej» beholder
  «Ingen».
  **GENNEMFØRT** 2026-09-22: modellen bærer `ingenBeloebAarsag` (`'ikkeRejst' | 'maksimumOpbrugt'`),
  og dokumentet skriver «Maksimum for svie- og smertegodtgørelse er nået i tidligere
  erstatningsopgørelse.» ved en udtømt ramme. Sætningen deles med BB-219's beregnede tilstand.
  «Nej» beholder «Ingen». Dækket af den opdaterede sag i
  `erstatningsopgoerelsePdf.indkomstBreakdownVisibility.test.ts`.
- **Sådan fremprovokeres det:**
  1. Tast en fuld svie/smerte-sektion (periode `01-01-2023` – `31-12-2024` Sygemeldt, satsår `2024`) og
     hent opgørelsen – den viser `88.500,00 kr.`
  2. Sæt «Tidligere beregnet S/S til max.» til Ja. Hent igen.
- **Det sker:** Hele sektionen forsvinder fra skærmen bortset fra de to første rækker – periodetabel,
  satsår, delvis-sats og begge beløbsfelter er væk uden et ord om, at indtastningerne stadig findes.
  Dokumentet skriver:

  > Svie- og smertegodtgørelse
  >
  > Ingen

  Ordret det samme som når brugeren svarer «Nej» til, om der overhovedet er krav. De to er ikke det
  samme: «Nej» betyder, at der ikke rejses krav; «Tidligere beregnet til max» betyder, at kravet findes
  og er udtømt. Modparten kan ikke se forskel.
  **Programmet har sætningen:** rækken «Svie/smerte-ophør skyldes» → «Tidligere beregnet til max»
  findes i `buildEoSvieSmerteRows` og vises udelukkende på kontrolfanen «EO-kontrol».
- **Det er uhensigtsmæssigt fordi:** Opgørelsen er det dokument, modparten betaler efter. At et krav
  ikke rejses, og at et krav er opbrugt, er to forskellige juridiske udsagn, og papiret gengiver dem
  som ét. Den, der senere åbner sagen igen, kan heller ikke se af dokumentet, hvorfor der ikke står et
  beløb.
- **Bedre ville være:** Lad dokumentet skrive den grund, programmet allerede har: «Maksimum for svie-
  og smertegodtgørelse er nået i tidligere erstatningsopgørelse.» i stedet for «Ingen», når
  «Tidligere beregnet S/S til max.» er sat. «Nej» beholder «Ingen».
- **Andre steder det kan gælde:** Samme struktur i TAF (12e) og øvrige krav (12c), hvor
  `beregnes === false` også kollapser flere årsager til ét «Ingen». Prøven:
  `rg "safeAddWrappedText\('Ingen'\)" src/document/generators/eo` og for hvert træf, hvor mange
  tilstande der fører dertil.

**Tilbagemelding**
Enig

### BB-222 – En advarsel bliver stående om et felt, der ikke længere findes, og dens link markerer ingenting

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-32--et-skjult-felt-er-ikke-udfyldt--men-kun-nogle-af-dets-læsere-ved-det`
  (registreret som Lokal ved gennemgangen; opgraderet af udviklerens afgørelse 2026-09-22)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-22, med et mandat ud over fundet: et skjult felt
  skal overalt i programmet betragtes som ikke udfyldt og må aldrig påvirke beregninger eller
  fejlmeddelelser. At denne fejl overhovedet har kunnet opstå er efter udviklerens vurdering en
  arkitekturfejl, ikke en lokal forglemmelse. Rettelsen er derfor todelt: den lokale advarsel her, og
  en systematisk gennemgang af, om samme svigt findes andre steder – med den strukturelle sikring som
  mål. **Rækkevidden er hermed opgraderet fra Lokal til Mønster** (nyt mønster i `TVAERGAAENDE.md`).
  **GENNEMFØRT** 2026-09-22, lokalt OG som gennemgang. Lokalt: `shouldShowSatsYearSuggestionWarning`
  kalder nu `erSvieSmertePeriodeInputRelevant`. Gennemgangen fandt **tre yderligere forekomster,
  som alle er rettet** – se «Efterprøvet efter BB-222's mandat» nedenfor – og **to, som IKKE er
  rettet**, fordi de kræver en arkitekturbeslutning, udvikleren skal træffe (se «Åbne spørgsmål»).
  Dækket af `eoRowSvieSmerteSatsAarSkjultFelt.test.ts`.
- **Sådan fremprovokeres det:**
  1. Sæt «Opgørelse lavet den» til `01-02-2025` og satsår til `2024`, så advarslen «Svie/smerte-satsen
     for 2025 kan anvendes.» står i «Fejl og advarsler».
  2. Sæt «Tidligere beregnet S/S til max.» til Ja.
  3. Klik advarslens link «EO oplysninger → Svie- og smertegodtgørelse».
- **Det sker:** Advarslen bliver stående, selv om satsårsfeltet er fjernet fra fladen, og selv om der
  slet ikke beregnes svie/smerte i denne tilstand. Linket skifter til EO oplysninger-fanen og
  **markerer intet** – målt: nul `mineoFieldAttentionBlink`-hændelser, og nul elementer med
  satsårsfeltets adresse i DOM'en. Brugeren står på en fane, hvor det, advarslen handler om, ikke
  eksisterer.
- **Det er uhensigtsmæssigt fordi:** Det er en blindgyde: en opfordring til at gøre noget, der ikke kan
  gøres, med en anvisning, der ikke fører nogen steder hen. Boksen er det sted, brugeren tjekker, før
  han henter, og en linje, der ikke kan ryddes og ikke kan følges, gør hele boksen mindre troværdig.
- **Bedre ville være:** Lad `shouldShowSatsYearSuggestionWarning` dele synlighedsprædikat med feltet
  selv – `erSvieSmertePeriodeInputRelevant` – præcis som sektionens øvrige felter allerede gør
  (`SvieSmerteSection.tsx` kalder prædikatet for både periodetabel og satsår). Advarslen hører kun
  hjemme, når det felt, den handler om, er synligt.
- **Andre steder det kan gælde:** Enhver advarsel om et felt bag en synlighedsbetingelse. Prøven er
  billig: `rg "erSvieSmerte|er[A-Z]\w*Relevant" src/domain/erstatningsopgoerelse/helpers/eoInputRelevance.ts`
  giver prædikaterne; for hvert, om alle de issues, der navngiver de skjulte felter, bruger samme
  prædikat. `sviesmerte.tidligereTotal` gør det korrekt allerede (den kalder
  `erSvieSmerteTidligereTotalRelevant` med netop den begrundelse) – satsårsadvarslen er undtagelsen.

**Tilbagemelding**
Enig. Og undersøg meget gerne om samme fejl måtte optræder andre steder i andre, lignende sammenhænge i programmet. Det er en generel og universiel regel i programmet, at et felt, der er skjult skal betragtes som ikke udfyldt og aldrig må kunne påvirke beregninger eller fejlmeddelelser. Denne adfærd burde allerede var inarbejdet strukturelt, så det er udtryk for en fejl ved arkitekturen, at denne konkrete fejl alligevel har kunnet opstå.

**Modsvar (afventer udviklerens svar)**
Din diagnose er rigtig, og jeg presser ikke imod den – jeg presser på, at den er **større**, end den
lyder, og at der er én ting i din formulering, jeg ikke kan gennemføre uden dit svar.

**Hvorfor det er en arkitekturfejl og ikke en forglemmelse – helt konkret.** Reglen ER bygget, og den
er bygget godt. `eoInputRelevance.ts` er skrevet netop til dette problem: prædikaterne er den eneste
autoritative kilde til synlighed, UI'en og `neutralizeIrrelevantEoInputs` læser samme prædikat, og
modulet erklærer selv garantien fail-closed – «glemmer en motor at spejle en synligheds-betingelse, er
værdien allerede neutraliseret her». Men modulet afgrænser sig selv lige så udtrykkeligt i næste
åndedrag: prædikater, der kun gater visnings- og dokumentfelter, «neutraliseres ikke her, fordi de ikke
indgår i noget beregnet tal – neutralisering forbeholdes talfødende input».

**Det er dér, hullet er.** En advarsel er hverken et tal eller et visningsfelt. Den er en tredje slags
læser, som garantien aldrig blev strakt til – og som intet i koden markerer som udækket. Derfor kan
fejlen genopstå vilkårligt mange gange, uden at nogen overtræder en regel: hver ny advarsel, hvert nyt
forslag og hver ny statusrække skrives pr. automatik uden for garantiens rækkevidde. Det er præcis din
pointe, nu med fingeren på stedet. Formen er skrevet op som **M-32** i `TVAERGAAENDE.md`.

**Det, jeg beder om svar på, er sikringens form.** «Undersøg om samme fejl findes andre steder» kan jeg
gøre, og det giver en liste. Men en liste lukker ikke arkitekturfejlen – den lukker kun de forekomster,
der findes i dag. Tre mulige niveauer, med stigende pris:

1. **Kun oprydning.** Jeg finder og retter forekomsterne. Billigst, men fejlen kan komme igen i morgen.
2. **Oprydning + AST-regel.** En regel, der kræver, at et issue, som navngiver et felt bag et
   `er*Relevant`/`er*Aktiv`-prædikat, selv kalder samme prædikat. Fanger fremtidige tilfælde i EO, hvor
   prædikaterne er samlet ét sted.
3. **Oprydning + struktur.** Garantien flyttes, så synlighed filtreres ÉT sted for alle læsere – ikke
   kun for talfødende input. Dyrest, og det er den eneste, der faktisk gør din regel universel; de
   øvrige flader (Erhvervsevnetab, Forsørgertab, Årsløn) har ikke et samlet relevans-modul, så deres
   synlighed ligger spredt som inline-betingelser.

Jeg anbefaler **2 nu og 3 som en selvstændig opgave**, fordi 3 rører ved flere flader end 12b og ikke
bør skjules inde i en brugerbliks-rettelse.

**Og én ting skal du bekræfte, fordi din regel som formuleret rammer den.** Du skriver, at et skjult
felt aldrig må påvirke beregninger. Der findes i dag en **bevidst undtagelse**, som du selv har
godkendt ved BB-203: ved komprimering fra 2. opgørelse (`komprimerBeregningEfterFoersteOpgoerelse`)
skjules løn- og beregningsgrundlagsfelterne, men de forbliver aktive input – tabt arbejdsfortjeneste
genberegnes fra dem, og PDF'en skriver «Månedsløn er i tidligere erstatningsopgørelse beregnet til X».
Her er «skjult» netop ikke «ikke udfyldt». Jeg går ud fra, at undtagelsen består, og at din regel skal
læses som «medmindre det er erklæret og begrundet» – men siger du ja til reglen uden forbehold, skal
den undtagelse rulles tilbage, og det ville ændre TAF-beregningen ved alle 2.-opgørelser. Bekræft
venligst, at undtagelsen består.

**Tilbagemelding**
Godt fanget! Denne særlige undtagelse skal fortsat bevares.
Herudover følger jeg din anbefaling.

### BB-223 – Satsårets «én måned efter»-regel er usynlig: knappen indsætter 2025 i 2026, og advarslen skjuler det valgte år

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
  og `#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** **AFVIST** af udvikleren 2026-09-22. Præmissen anerkendes, men det er ikke et reelt
  problem: brugeren må forventes at kende den juridiske regel om, at satsen én måned efter kan
  anvendes, så advarslen orienterer om et forhold, brugeren allerede kender.
- **Sådan fremprovokeres det:**
  1. «Opgørelse lavet den» = `01-02-2025`, satsår = `2024`.
  2. Læs advarslen i «Fejl og advarsler».
  3. Klik knappen «Indsæt årstal» ved satsårsfeltet.
- **Det sker:** Advarslen lyder «Svie/smerte-satsen for 2025 kan anvendes.» Den siger ikke, hvilket år
  der er valgt, og ikke hvor 2025 kommer fra. Knappen «Indsæt årstal» indsætter `2025` – altså hverken
  indeværende år (`2026`) eller opgørelsesårets `2025`… men året **én måned efter** «Opgørelse lavet
  den», med fallback til seneste fuldt dækkede satsår (`resolveSvieSmerteSatsAarForReferenceDate`).
  Reglen står ingen steder på skærmen; knappens tooltip er det bare «Indsæt årstal», mens programmets
  øvrige tilsvarende knapper hedder «Indsæt dags dato» og gør nøjagtig det, de hedder.
  **Og advarslen erstatter værdien.** På kontrolfanen viser rækken «Hvilket års svie/smerte-satser
  lægges til grund?» teksten «Svie/smerte-satsen for 2025 kan anvendes.» **i stedet for** det valgte
  `2024` (`satserAarDisplay` returnerer advarselsteksten). Så længe forslaget står, findes det valgte
  år kun i selve indtastningsfeltet.
- **Det er uhensigtsmæssigt fordi:** Satsåret bestemmer både dagsatsen og loftet, altså hele kravets
  størrelse. Brugeren får at vide, at et andet år «kan anvendes», uden at få at vide hvad han har
  valgt, hvorfor det andet år foreslås, eller hvad forskellen er i kroner. Trykker han på knappen for
  at følge forslaget, får han et år, han ikke selv ville have gættet, og som i september 2026 er to år
  gammelt. Programmet ved alt dette og siger ingenting af det.
- **Bedre ville være:** Skriv forslaget med begge tal og med sin grund: «Satsår 2024 er valgt.
  Satserne for 2025 gælder en måned efter opgørelsens dato (01-02-2025) og kan anvendes.» Lad rækken
  beholde værdien og bære advarslen ved siden af i stedet for i stedet for. Og lad knappens tooltip
  sige, hvad den indsætter: «Indsæt satsåret, der gælder en måned efter opgørelsens dato».
- **Andre steder det kan gælde:** Hver «Indsæt …»-knap, hvis værdi udledes af et andet felt frem for af
  kalenderen. Prøven: `rg "InsertTodayDateButton" src/components` og for hvert kaldsted, om
  `onCommit`-callbacket bruger `today` eller en anden værdi – her bruges `values.opgørelseLavetDen`,
  og `today` er kun fallback.

**Tilbagemelding**
Jeg anerkender præmissen for din tilbagemelding, men er ikke enig i, at det er et reelt problem. Brugeren må forventes at kende den juridiske regel om, at satsen en måned efter kan anvendes - så det er en orientering om et forhold, som brugeren allerede kender til.

### BB-224 – Fem felter i sektionen hedder noget andet, end skærmen siger – og ét af dem hedder fire ting

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** **DELVIST GODKENDT** af udvikleren 2026-09-22, med en fagligt begrundet indsnævring.
  **Godkendt:** de fem felter skal have deres synlige navn som tilgængeligt navn, med samme mekanik som
  `LabeledControlRow`. Det er ren navnedublering og rører ikke ved fagsproget.
  **Ikke godkendt som formuleret:** ÉN fælles ordlyd for beløbet. *Opgjort*, *udbetalt* og *krav* er
  ikke synonymer i en erstatningssag: «opgjort» er det korrekte om tidligere **opgørelser**, det er det
  **udbetalte** beløb, der fradrages i den konkrete opgørelsesperiode, og selve opgørelsen af beløbet er
  et **krav**. Ensretning må derfor kun ske dér, hvor det er samme indhold under forskellige navne
  afhængigt af, om det vises på skærmen eller i dokumentet. Forudsætningen for at røre ved ordlyden er
  en afklaring af, hvad feltet faktisk indeholder – se «Åbne spørgsmål».
  **AFKLARET OG GENNEMFØRT** 2026-09-22 efter modsvaret: udvikleren fastslog, at brugeren for
  tidligere erstatningsperioder skal indtaste **det, der blev opgjort** – om det faktisk blev betalt
  er uden betydning. Den modsatte regel gælder den aktuelle periode, hvor kun det **udbetalte**
  tæller. Det svarer nøjagtigt til koden: `svieSmerteTidligereTotal` fradrages i maksimum,
  `svieSmerteAktuelPeriode` i selve beløbet. Feltets tre navne var altså ét indhold under tre ord,
  og betingelsen for ensretning var dermed opfyldt. Gennemført: alle fem descriptor-labels følger nu
  den synlige etiket, og beløbet hedder «Svie/smerte opgjort i tidligere erstatningsopgørelser» på
  skærmen, i oplæsning/fejltekster, i kontrolrækken og i advarslen. «Tidligere **udbetalt**
  svie/smerte» var en fejl og er væk. Dokumentets «Der er **opgjort** …» var allerede rigtigt og
  står uændret. Nabofeltet beholder sit «modtaget», fordi det ER det udbetalte.
- **Sådan fremprovokeres det:** Kør BB-211's mekaniske prøve på sektionen: læs de tilgængelige navne op
  mod de synlige etiketter (målt fra accessibility-træet).
- **Det sker:**

  | Synligt på skærmen | Feltets eget navn (oplæsning + fejltekster) |
  |---|---|
  | Er der krav på svie- og smertegodtgørelse i erstatningsperioden | `Krav på svie- og smertegodtgørelse` |
  | Hvilket års svie/smerte-satser lægges til grund? | `Svie/smerte satsår` |
  | Svie/smerte-sats ved delvis sygemelding | `Sats ved delvis sygemelding` |
  | Svie/smerte-krav i tidligere erstatningsopgørelser | `Tidligere udbetalt svie/smerte` |
  | Evt. allerede modtaget svie/smerte for nuværende erstatningsperiode | `Svie/smerte aktuel periode` |

  Togglen «Tidligere beregnet S/S til max.» bærer korrekt sin rækketekst, fordi den tegnes af
  `LabeledControlRow` – præcis den skillelinje, BB-211 fandt.
  **Den fjerde række er den skarpeste, fordi den skifter begreb undervejs.** Ét og samme beløb hedder:
  - på skærmen «Svie/smerte-**krav** i tidligere erstatningsopgørelser»,
  - i oplæsning og fejltekster «Tidligere **udbetalt** svie/smerte»,
  - i advarslen «et svie-/**smertebeløb** for tidligere erstatningsopgørelser»,
  - i dokumentet «Der er **opgjort** svie- og smertegodtgørelse med X for tidligere perioder.»

  *Krav*, *udbetalt* og *opgjort* er tre forskellige ting i en erstatningssag, og feltet trækkes fra
  maksimum, hvad end det hedder.
- **Det er uhensigtsmæssigt fordi:** BF-057 fastslog, at formularfelter og dropdowns skal have stabile
  tilgængelige navne, der følger den synlige label. Her holder det for én af seks kontroller.
  Konsekvensen er større end oplæsningen: to fagfolk, der læser henholdsvis «krav» og «udbetalt», vil
  udfylde feltet forskelligt – det ene er, hvad der blev krævet, det andet, hvad der blev betalt – og
  forskellen slår direkte igennem på restbeløbet under maksimum.
- **Bedre ville være:** Giv `row--label-right-hover`-rækkerne deres synlige navn med samme mekanik som
  `LabeledControlRow` (BB-211's rettelse, som blev gennemført for 12a's seks felter), og vælg ÉN
  ordlyd for beløbet – «Svie/smerte opgjort i tidligere erstatningsopgørelser» – og brug den på
  skærmen, i advarslen og i dokumentet.
- **Andre steder det kan gælde:** Hele programmet; BB-211's prøve er uændret:
  `rg 'className="row--label-right-hover"' src/components` og sammenlign hver rækkes `row--text` med
  descriptorens `label`. De øvrige EO-sektioner (12c–12k) er ikke gennemgået med den endnu.

**Tilbagemelding**
Grundlæggende enig. Når det kommer til svie-/smertegodtgørelse er 'opgjort' det korrekte udtryk, når vi har at gøre med opgørelser, som er lavet. Men når vi snakker om fradrag i den konkrete opgørelsesperiode, er det udbetalte beløb, der skal fratrækkes. Og selve opgørelsen af beløbet er et 'krav'.

Jeg er derfor lidt bekymret for, om du er ved at ensarte forskellige navne med forskellige betydninger. Hvis imidlertid der er tale om samme indhold, der blot har forskellige navne afhængig af, om det vises på skærmen eller i et dokument, er jeg enig i, at det vil være hensigtsmæssigt at ensarte.

**Modsvar (afventer udviklerens svar)**
Din bekymring er berettiget, og jeg har trukket ensretningen tilbage. *Opgjort*, *udbetalt* og *krav* er
ikke synonymer, og et brugerblik skal ikke plane fagsprog ud. Navnerettelsen (tilgængeligt navn = synlig
etiket) står tilbage som godkendt og er ren dublering.

**Men dit skel besvarer selv betingelsen, du stiller.** Du skriver: er der tale om samme indhold under
forskellige navne, skal det ensartes. Det er netop tilfældet her – og det er dét, jeg beder dig bekræfte.
Der er **ét** felt, `svieSmerteTidligereTotal`, med **ét** tal. Det bærer i dag tre forskellige ord:

| Hvor | Ordet |
|---|---|
| Skærmens etiket | Svie/smerte-**krav** i tidligere erstatningsopgørelser |
| Oplæsning + fejltekster | Tidligere **udbetalt** svie/smerte |
| Dokumentet | Der er **opgjort** svie- og smertegodtgørelse med X for tidligere perioder |

Samme tal, tre ord – og efter dit eget skel kan de ikke alle være rigtige.

**Koden peger på ét af dem.** Jeg har efterprøvet, hvad de to beløbsfelter faktisk gør i
`svieSmerteEngine.ts:297-304`, og de er ikke ens:

- `svieSmerteTidligereTotal` (det omtvistede felt) → `restPlads = maxKroner − tidligereValue`.
  Det fradrages i **maksimum**, altså i den samlede ramme for hele sagen.
- `svieSmerteAktuelPeriode` («Evt. allerede modtaget …») → `beloeb = beloebFoerFradrag − allerede`.
  Det fradrages i **selve beløbet** for denne opgørelse.

Det er lige præcis det skel, du beskriver: det **udbetalte** trækkes fra i den konkrete
opgørelsesperiode – og det er nabofeltet, der gør det. Feltet, der reducerer den samlede ramme, er
efter samme logik det, der **blev opgjort** i de tidligere opgørelser. Er det rigtigt, er
«Tidligere **udbetalt** svie/smerte» i oplæsning og fejltekster en fejl, der skal rettes – ikke et
fagligt skel, der skal bevares – og skærmens «krav» skal så også give plads til «opgjort».

**Spørgsmålet, jeg beder om svar på, er ét og konkret:** Det beløb, brugeren skal taste i
«Svie/smerte-krav i tidligere erstatningsopgørelser» – er det (a) det, der **blev opgjort** i de
tidligere opgørelser, eller (b) det, der **blev betalt**?

- Er svaret **(a)**, er der tale om samme indhold under tre navne, din betingelse er opfyldt, og
  ordlyden ensartes til «opgjort» de tre steder.
- Er svaret **(b)**, er skærmens «krav» og dokumentets «opgjort» forkerte, og de skal rettes til
  «udbetalt» i stedet – altså den modsatte ensretning.
- Er svaret, at det **afhænger af sagen** (brugeren taster nogle gange det ene, nogle gange det andet),
  er det et selvstændigt fund af en anden art: ét felt, der fradrages i maksimum, uden at programmet
  kan vide, hvad tallet er. Sig til, så registrerer jeg det som sådant.

Jeg rører ikke ved nogen ordlyd, før du har svaret, netop for ikke at gøre det, du advarer imod.

**Tilbagemelding**
Brugeren skal for tidligere erstatningsperioder indtaste det, der blev opgjort. Det har ikke relevans, om beløb for tidligere perioder faktisk blev betalt.

Til gengæld gælder den modsatte regel for den aktuelle erstatningsperiode. For den erstatningsperiode, som opgørelsen vedrører, har det ingen betydning, hvis der tidligere har været opgjort krav for denne periode. Det eneste som tæller, er hvis der tidligere har været betalt nogle penge for perioden - der er der en særlig tekst-blok og beregning, som fører til at det allerede betalte for nærværende periode, fratrækkes i det opgjorte krav for perioden.

### BB-225 – Underoverskriften «Tidligere svie- og smertegodtgørelse» står ved første opgørelse over ét felt, der handler om den nuværende periode

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-22 i en strammere formulering end den foreslåede:
  fundet er reelt, men lille – der vil kun yderst sjældent allerede være udbetalt svie/smerte for den
  periode, opgørelsen vedrører, så fokus er naturligt på det, der er opgjort i tidligere
  erstatningsperioder. Samles felterne under én overskrift, skal den være skarpere end «Tidligere
  modtaget og opgjort svie/smerte» – fx **«Tidligere svie/smerte-beløb»**.
  **GENNEMFØRT** 2026-09-22 med udviklerens egen ordlyd: underoverskriften hedder nu «Tidligere
  svie/smerte-beløb» og dækker begge felter uanset opgørelsesnummer.
- **Sådan fremprovokeres det:** Lad «Nummer» være tom eller `1` (første opgørelse) og rul til bunden af
  svie/smerte-sektionen.
- **Det sker:** Underoverskriften «Tidligere svie- og smertegodtgørelse» står med præcis ét felt under
  sig: «Evt. allerede modtaget svie/smerte for **nuværende** erstatningsperiode». Feltet, overskriften
  er skrevet til – «Svie/smerte-krav i tidligere erstatningsopgørelser» – findes kun fra og med 2.
  opgørelse.
- **Det er uhensigtsmæssigt fordi:** Overskriften og dens eneste indhold siger modsat. Den, der skal
  taste et beløb, skadelidte har fået a conto i den igangværende periode, læser først en overskrift,
  der fortæller ham, at han er det forkerte sted. Og de to felter trækkes fra hvert sit sted i
  beregningen – det ene fra maksimum, det andet fra det opgjorte beløb – så forveksling koster penge.
- **Bedre ville være:** Lad overskriften hedde «Tidligere modtaget og opgjort svie/smerte», så den
  dækker begge felter uanset opgørelsesnummer – eller udelad den helt ved første opgørelse, hvor der
  kun er ét felt.
- **Andre steder det kan gælde:** Enhver `row--subheading`, hvis felter er betinget synlige. Prøven:
  `rg 'className="row--subheading"' src/components/pages/erstatningsopgoerelse` og for hver, om alle
  dens felter kan forsvinde.

**Tilbagemelding**
Jeg tenderer til at være enig i din konklussion, omend det ikke umiddelbart fremstår som en stor eller væsentlig fejl.
Der vil kun yderst sjældent allerede være udbetalt svie/smerte for den periode, som opgørelsen vedrører - så det langt overvejende fokus vil naturligt være på, hvad der er opgjort i tidligere erstatningsperioder.
Hvis det skal samles under én overskrift, bør den være skarpere end dit forslag - måske "Tidligere svie/smerte-beløb" eller noget i den stil.

### BB-226 – Sektionens eneste resultat – beløbet – vises intet sted uden for PDF'en og en fane, der er slået fra

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** Mellem
- **Beslutning:** **AFVIST** af udvikleren 2026-09-22. Erstatningsopgørelser er lange og komplicerede,
  og det at vise slutresultatet fortæller i sig selv intet om, hvorvidt beregningen er korrekt. Fladen
  viser derfor bevidst kun, **hvilke ydelser** der indgår i opgørelsen og **for hvilken periode**; alle
  øvrige oplysninger – beregninger og resultat – vises først i dokumentet. Afvisningen gælder også den
  del af fundet, der pegede videre til 12l.
- **Sådan fremprovokeres det:**
  1. Tast en fuld svie/smerte-sektion (én periode, satsår, delvis-sats).
  2. Gå til Beregning-fanen og læs hele fanen igennem uden at hente dokumentet.
- **Det sker:** Beregning-fanen viser under overskriften «Beregning» kun sagens titel, skadedatoen og
  periodelinjerne «Svie/smerte-periode: 01-02-2024 - 28-02-2024». Der står **intet beløb** – hverken
  for svie/smerte eller i alt. Fire færdigberegnede og færdigformulerede rækker findes udelukkende på
  kontrolfanen «EO-kontrol», som er slået fra som standard i Indstillinger (målt med fanen slået til):

  | Række på «EO-kontrol» | Værdi i den målte sag |
  |---|---|
  | Satser per dag/max (forlig på 50 %) | `115,00 kr. / 44.250,00 kr.` |
  | Antal svie/smerte-dage i erstatningsperioden | `28 sygedage` |
  | Beregnet svie/smerte | `3.220,00 kr.` |
  | Svie/smerte-ophør skyldes | `Ikke rejst svie/smerte-krav for hele perioden` |

  Alle fire har `status: 'ok'` og er dermed – efter BB-202's lære om rækkebyggerne – usynlige uden for
  kontrolfanerne.
- **Det er uhensigtsmæssigt fordi:** Brugeren kan ikke kontrollere sit arbejde undervejs. For at se,
  hvad han har opgjort, skal han hente en PDF, åbne den, læse den, gå tilbage, rette og hente igen.
  Det er også dét, der gør BB-217 og BB-219 dyre: der findes intet sted på skærmen, hvor de tal, der
  faktisk regnes med, kan holdes op mod det, brugeren har tastet. Programmets øvrige beregningssider
  (Varige mén, Erhvervsevnetab, Forsørgertab) viser deres beløb på skærmen.
  **Efter afvisningen:** skellet er, at de øvrige sider opgør ÉT krav, mens erstatningsopgørelsen
  komponerer flere – og at et sluttal dér ville invitere til en kontrol, det ikke kan bære. Det gør
  BB-217 vigtigere, ikke mindre vigtig: når skærmen bevidst ikke viser resultatet, skal det ene tal,
  den faktisk viser – «Antal dage» – være det, opgørelsen regner med.
- **Bedre ville være:** Vis mindst «Beregnet svie/smerte» og «Antal svie/smerte-dage i
  erstatningsperioden» i Beregning-fanens boks ved siden af periodelinjerne – rækkerne findes
  færdigbyggede og behøver ingen ny beregning. Alternativt i selve sektionen, under
  periodetabellen, hvor tallene hører til.
- **Andre steder det kan gælde:** Hele Erstatningsopgørelsen – Beregning-fanens sammendrag viser heller
  ikke TAF-beløbet eller totalen. Det er derfor et fund, der hører sammen med **12l**, og rettelsen bør
  besluttes for alle tre krav på én gang. Indgang: `rg "label: '" src/domain/eoRowEvaluation` og for
  hver `status: 'ok'`-række, om dens værdi kan nås uden kontrolfanerne.

**Tilbagemelding**
Jeg afviser dit fund. Erstatningsopgørelser er lange og komplicerede, og selve det at vise brugeren slutresultatet, fortæller intet om, hvorvidt beregningen er korrekt. Derfor vises brugeren aktuelt kun på selve siden, hvilke ydelser, der indgår i opgørelsen og for hvilken periode. Alle andre oplysninger, herunder beregninger og resultat, vises først i dokumentet.

### BB-227 – Fire forskellige tilstande skriver det samme ord i Beregning-fanens sammendrag: «Nej»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-22. Rækken skal sige, hvad der er tilfældet, i
  stedet for at skrive «Nej» om fire forskellige tilstande. Afgørelsen er forenelig med BB-226's
  afvisning: rækken navngiver fortsat kun ydelsen og dens periode-status, ikke et beløb.
  **GENNEMFØRT** 2026-09-22: rækken skriver nu «Ikke rejst» / «Ikke rejst (skjult)» / «Maksimum nået
  i tidligere opgørelse» / «Ingen perioder angivet» efter tilstanden. Intet beløb vises, så
  BB-226's afvisning står uberørt.
- **Sådan fremprovokeres det:** Sæt sektionen i hver af fire tilstande og læs rækken
  «Svie/smerte-periode» på Beregning-fanen.
- **Det sker:**

  | Tilstand | Rækken viser |
  |---|---|
  | Krav = Nej | `Nej` |
  | Krav = Skjul | `Nej (skjult)` |
  | Krav = Ja, «Tidligere beregnet S/S til max.» = Ja | `Nej` |
  | Krav = Ja, ingen perioder tastet endnu | `Nej` |

  Etiketten er «Svie/smerte-periode», og «Nej» er ikke en periode. De tre «Nej» dækker over «der er
  ikke noget krav», «kravet er opbrugt» og «du mangler at taste perioderne». Kun den sidste ledsages af
  en advarsel («Der er ikke angivet nogen svie/smerte-periode i EO-perioden»); den mellemste er tavs.
- **Det er uhensigtsmæssigt fordi:** Sammendraget er det, brugeren skimmer, før han henter. Et «Nej» ud
  for «Svie/smerte-periode» læses som «det emne er afsluttet», også i den tilstand, hvor brugeren blot
  ikke er kommet i gang endnu.
- **Bedre ville være:** Lad rækken sige, hvad der er tilfældet: «Ingen perioder angivet» når kravet er
  rejst uden perioder, «Maksimum nået i tidligere opgørelse» når togglen er sat, og «Ikke rejst» når
  kravvalget er Nej/Skjul. Værdierne findes allerede i rækken «Svie/smerte-ophør skyldes».
- **Andre steder det kan gælde:** Den tilsvarende række «TAF-periode» (12e) bygges af samme mekanik i
  `useEoBeregningViewModel.ts` og har samme fire tilstande.

**Tilbagemelding**
Enig

## Efterprøvet efter BB-222's mandat: skjulte felter, der taler

Udvikleren fastslog 2026-09-22, at et skjult felt overalt i programmet skal betragtes som ikke
udfyldt og aldrig må påvirke beregninger eller fejlmeddelelser. Gennemgangen dækkede alle
prædikater i `eoInputRelevance.ts` og de rækkebyggere, dokumentbyggere og validatorer, der læser
felter bag dem. **Fem forekomster ud over BB-222 selv. Tre er rettet; to kræver en beslutning.**

**Rettet:**

- **Ménlinjen modsagde sig selv i opgørelsen.** `eoPresentationSectionBuilders` skrev «Der er den
  … **ikke** truffet afgørelse om varige mén. **Afgørelsen er påklaget.**» Klagefeltet vises kun,
  når der ER truffet en ménafgørelse, så i netop denne gren er feltet garanteret skjult – og en
  stale «Ja» talte alligevel. Sætningen gik til modparten. Nu skrives kun førstedelen.
- **EET-linjen havde nøjagtig samme fejl** samme sted: «Der er den … ikke truffet afgørelse om
  erhvervsevnetab … Afgørelsen er påklaget.» Rettet på samme måde.
- **Et skjult `verserendeKlageEet` slukkede en TAF-afgrænsning.** `eoPeriodeBlockingContext` læste
  feltet uden `erEETKlageRelevant`, så en stale «Ja» – efterladt da begge EET-afgørelser blev sat
  til «Nej» – suspenderede differencekravets cutoff. Virkningen var ikke kosmetisk: rækken
  `taf.ophoerSkyldes` skiftede fra en ok-række til en advarsel, og TAF-/ferieperiodernes
  grænsevalidering blev lempet. Samme gate er lagt på de to dokumentsteder, der læser feltet uden
  for en afgørelses-gren, og på oversigtsrækken `aes.verserendeKlageEet`, som kunne gå rød på et
  tomt felt, der ikke var på skærmen.

**Ikke rettet – kræver udviklerens beslutning, se «Åbne spørgsmål»:** validatoren læser bevidst
RÅ værdier (`eoSnapshot.ts` sender `parsedEo.data`, ikke de neutraliserede), og dens egen
dokumentation begrunder det udtrykkeligt. Det står i direkte modstrid med den nye regel, og
konsekvensen er, at blokerende fejl kan hænge på felter, brugeren hverken kan se eller rette.

## Overvejet uden fund

- **Beregningsformlerne er kontrolregnet i fem sagsformer og er i orden.** `28 × 230 + 10 × 115 = 7.590`;
  klippet periode `59 × 230 = 13.570`; loftet `731 × 230 = 168.130 → 88.500`; forlig 50 %
  `28 × round(230 × 0,5) = 28 × 115 = 3.220`; restplads `88.500 − 85.000 = 3.500` mod råkravet `6.440`.
  Ingen af de 11 fund handler om et forkert beløb.
- **Delvis-dagssatsens afrunding er konsistent mellem det viste og det beregnede.** `roundDelvisSatsOre`
  i præsentationslaget og `scaleMoneyOre(satserPerDagOre, delvisFaktor)` i motoren giver samme øre, og
  koden begrunder det ved kaldstedet. Totalen kan efterregnes af den viste «á»-sats.
- **Satsårets grænser passer til datasættet.** Feltet tillader 2005–2026 (`MIN_SVIESMERTE_YEAR` til
  indeværende år); `svieSmertePrDag` og `svieSmerteMax` dækker præcis 2005–2026. M-15's intervalprøve
  er dermed bestået: der findes ingen lovlig indtastning uden satsdækning. Beskeden ved overskridelse
  er «Årstallet skal være mellem 2005 og 2026» (målt som feltets status-tekst).
- **Tocifrede årstal i satsårsfeltet følger den fælles regel** (BB-009's afgørelse): `24` → `2024`,
  `99` → `1999` (afvist, under 2005), `0` → `2000` (afvist). Ingen egen årsfortolkning.
- **Dato-orden i periodetabellen er i orden og spejlvendt korrekt** (M-07): til `01-01-2024` før fra
  `01-03-2024` gør begge celler røde med «Fra-dato skal være før til-dato (01-01-2024)» og «Til-dato
  skal være efter fra-dato (01-03-2024)» – hver tekst set fra sit eget felts udvej. Det er BF-028's
  rettelse i drift.
- **Ménafgørelses-cutoffen markerer de rigtige celler** med tooltippen «Der er angivet svie/smerte
  efter datoen for en ménafgørelse (01-02-2024)» og spærrer download. Selve afgørelsesfeltet hører i
  12d.
- **En række, hvor kun «Tilstand» er valgt, spærrer opgørelsen med «Fra-dato og til-dato er ikke
  angivet» og uden rød celle – og det er korrekt.** BB-083's lære: den rene mangel bevares som
  gate-feedback, mens en rød ring på et endnu tomt partnerfelt ville gøre en naturligt halvfærdig
  række til en fejl under indtastningen. BB-147's princip gælder heller ikke her: `tilstand` er et
  *valgfrit* choice-felt med en tom «Vælg tilstand»-mulighed, så et valg ER data. Målt, at brugeren
  kan komme ud igen: vælges «Vælg tilstand» på ny, forsvinder rækken.
- **Boksens links markerer det rigtige felt i alle de afprøvede tilfælde.** Målt ét
  `mineoFieldAttentionBlink` pr. klik: overlapslinjerne rammer hver sin rækkes `fra`-celle, og «Ikke
  rejst svie/smerte-krav for hele perioden» rammer den sidste periodes `til`-celle.
- **BB-207's rettelse er efterprøvet i 12b og virker.** Et bilagsnummer i «Bilagsnr.
  svie/smerte-dokumentation» kombineret med kravvalget «Nej» giver nu en gul ring på feltet (målt
  `rgb(245, 158, 11)`) og linjen «Der er angivet bilagsnummer for svie/smerte dokumentation, men
  angivet at svie/smerte ikke beregnes».
- **M-27 er bekræftet på periodetabellens datoceller, men i BB-216's allerede registrerede,
  afbødede form.** Med Skadedato `99-99-9999` accepteres `01-01-2010` i «Fra o.m.» med neutral kant
  (`aria-invalid = "false"`), hvor samme værdi et minut før var rød. EO's egen boks navngiver dog
  årsagen («Skadedato: Der er udfyldt en ugyldig værdi i feltet 'Skadedato'» → Stamdata) og spærrer
  download, præcis som BB-216 beskrev. Registreret som en bekræftet forekomst, ikke som et nyt fund.
- **M-24 er efterprøvet og placeret på BB-119's afviste side.** «Evt. allerede modtaget svie/smerte»
  = `10.000` mod et råkrav på `6.440` giver linjen «28 sygedage á 230 kr. - 10.000 kr. = 0,00 kr.» Et
  svie/smerte-krav kan aldrig blive negativt, og nullet er ydelsens velkendte resultatform for
  målgruppen – altså «svaret», ikke «et plaster». Fradragets to led står på linjen, og det, der ikke
  går op, er netop den regel. Ikke et fund.
- **Kravvalget «Ja/Nej/Skjul» siger ikke, hvad «Skjul» gør, og forskellen kan først ses i det hentede
  dokument.** Det er BB-213's form, som udvikleren afviste 2026-09-17 med, at valgmulighedernes
  udmøntning er velkendt og forudsigelig. Ikke registreret som fund. Samme gælder, at «Svie/smerte-sats
  ved delvis sygemelding» har en standardværdi i Indstillinger, som brugeren kan have arvet uden at
  have læst informationsikonets «Juridisk omtvistet, men nyere retspraksis hælder mod fuld sats».
  Kravvalgets adfærd er ordret den samme som i 12c og 12e og noteres som efterprøvet dér.
- **M-23 er uden genstand.** To identiske rækker afvises af overlapsdetektionen, så beløbssiden kan
  ikke komme til at tælle en periode to gange, mens tidssiden af-dublerer den.
- **M-09 er efterprøvet og bestået:** ingen vandret scroll ved hverken 1536×864 eller 1244×620
  (`scrollWidth === clientWidth` begge steder).
- **M-10 er efterprøvet uden fund:** rul-op-knappen står ved (1451, 779) med 54×54 px; sektionens
  felter og knapper blev scannet mod det rektangel i 16 rullepositioner uden et eneste reelt overlap.
- **Konsollen var tavs** gennem hele gennemgangen: 197 beskeder, 0 fejl, 0 advarsler.

## Dækningshuller

- Kun Chrome, lyst tema, 1536×864 (M-09 desuden 1244×620).
- **Kun PDF-kanalen er læst.** Word-udgaven af opgørelsen deler generator, men BB-204 viste, at en
  strengfejl kan være synlig i den ene kanal og ikke i den anden. Word-udgaven bør læses, når 12l tages.
- **`Gem`/`Hent` er ikke afprøvet** – filvælgeren kan ikke betjenes headless. Det er værd at måle her,
  fordi tre af sektionens kontroller har en standardværdi, og fordi BB-220's `0` og BB-217's rækker
  uden for perioden er netop den slags, der skal overleve en `.eo`-rundtur uændret.
- **Undo/redo umiddelbart efter at «Tidligere beregnet S/S til max.» er sat** er ikke målt, selv om
  det er det tastetryk, der skjuler mest på én gang.
- Brevhovedet slået fra er ikke afprøvet.
- Sagen blev kørt uden tabt arbejdsfortjeneste og uden lønindkomst, så samspillet mellem
  svie/smerte-perioderne og TAF-perioderne (fx overlappende sygeperioder) er ikke set.
- Kontrolfanen «EO-kontrol» blev slået til for at bekræfte BB-217, BB-219, BB-221 og BB-226 og er
  ikke gennemgået (12m). Ét tilfældighedsfund derfra hørte til 12m: rækken «Svie/smerte-krav i
  tidligere erstatningsopgørelser» viste `0,00` **uden «kr.»**, mens naborækkerne «Satser per
  dag/max» og «Beregnet svie/smerte» viste `115,00 kr. / 44.250,00 kr.` og `3.220,00 kr.`
  **RETTET 2026-09-22** sammen med resten: begge beløbsrækker bruger nu `formatKr`, som er den
  kanoniske read-only-visning med enhed. Et tomt felt viser fortsat ingenting.

## Åbne spørgsmål

- **Skal satsåret vælges af brugeren, eller skal det følge en regel?** Feltet er i dag et frit årstal
  mellem 2005 og den aktuelle satsdækning, uden nogen sammenhæng med de perioder, kravet dækker: en
  sag med sygeperioder udelukkende i 2019 kan uden en eneste bemærkning opgøres med 2026-satser
  (`250 kr./dag` mod `205 kr./dag`, altså 22 % højere). Den eneste kontrol er forslaget om året én
  måned efter opgørelsens dato (BB-223). Spørgsmålet er, om det er den rigtige arbejdsdeling – eller
  om programmet bør advare, når satsåret ligger langt fra perioderne, sådan som det i dag advarer, når
  det ligger før opgørelsen. Det er en beregningsteknisk vurdering, ikke en teknisk, og er derfor ikke
  registreret som et fund.
  **AFGJORT** af udvikleren 2026-09-23: **nej.** Sygeperiodernes årstal har ingen sammenhæng med det
  satsår, der kræves. Det er lovbestemt, at der – uanset sygeperiodens placering – kan rejses krav med den
  sats, der var gældende én måned efter, kravet blev rejst, og kravet anses for rejst én måned efter
  «Opgørelse lavet den». Brugeren angiver selv satsåret; programmet giver alene en ikke-blokerende advarsel,
  hvis et senere års (højere) sats kunne være anvendt. **GENNEMFØRT** 2026-09-23: reglen er dokumenteret
  normativt i `eo-snapshot-contract.md` §16. Den eksisterende advarsel fulgte den i forvejen, men er skærpet
  på to punkter: den tier nu, når det senere år ikke har en højere sats, og den virker også ved årsskiftet,
  hvor næste års satser endnu ikke findes – så advarer den om det nyeste år med satser (fx en opgørelse
  lavet 15-12-2026 med satsår 2024 giver «Svie/smerte-satsen for 2026 kan anvendes.», hvor den før tav).
- **Skal validatoren læse de neutraliserede værdier i stedet for de rå?** Rejst af gennemgangen
  efter BB-222's mandat, og det er den eneste udestående del af mandatet. `computeEoSnapshot` giver
  rækkebyggerne de neutraliserede værdier (`effectiveEoValues`), men giver `validateParsed` de RÅ
  (`parsedEo.data`). `validateCanonicalRanges` begrunder det udtrykkeligt i koden: grænserne ligger
  der, «så snapshot- og dokumentgates også ser fejl i felter, som ikke aktuelt er mountet eller
  aktive». Den hensigt – «ikke mountet er ikke det samme som ikke valideret» – står i direkte
  modstrid med den nye regel.
  **Konsekvensen i dag:** et negativt beløb tastet i fx «Svie/smerte opgjort i tidligere
  erstatningsopgørelser» og derefter skjult (ved at sætte «Tidligere beregnet S/S til max.» til Ja)
  giver fortsat en **blokerende** fejl «Beløb kan ikke være negativt» på et felt, brugeren ikke kan
  se – download er spærret, og fejlen kan ikke findes. Beregningen er samtidig rigtig, fordi værdien
  ER neutraliseret for motorerne. Samme form rammer `regulerOffentligeYdelser`, hvis
  validator-guard kun tjekker `beregnesUdFra` og ikke også, om TAF-sektionen er aktiv.
  **Hvorfor jeg ikke har rettet det:** at skifte til `effectiveEoValues` ville fjerne begge
  forekomster på én gang, men det vender bevidst en dokumenteret arkitekturbeslutning og ændrer,
  hvad der blokerer download på tværs af hele fladen – også i tilfælde, ingen har målt. Det er
  udviklerens beslutning, ikke agentens. Alternativet er at lade validatoren beholde de rå værdier
  og i stedet gate de enkelte regler på deres egne prædikater; det er mere kirurgisk, men efterlader
  formen levende, så den kan opstå igen ved næste nye regel.
- **Hvilken form skal den strukturelle sikring have efter BB-222's mandat?** Reglen er afgjort, og
  de fem konkrete forekomster er rettet, men håndhævelsen er ikke afgjort. Udvikleren fulgte
  anbefalingen (oprydning nu, struktur som selvstændig opgave), så det udestående er, hvordan
  garantien gøres strukturel: en AST-regel, der kræver, at et issue om et felt bag et
  `er*Relevant`-prædikat selv kalder prædikatet, eller en samlet filtrering, der gælder ALLE læsere
  og ikke kun talfødende input. Så længe `eoInputRelevance.ts` kun håndhæver synlighed for tal, er
  hver ny advarsel en ny mulighed for samme fejl. Mønsteret er skrevet op som **M-32**.
