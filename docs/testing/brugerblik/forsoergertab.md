# Brugerblik – Forsørgertab

- Rute/placering: `/forsoergertab`
- Gennemgået: 2026-08-27 · commit `10a817a6`
- **Afgjort og implementeret: 2026-08-28.** Af de atten fund er **femten rettet**, **to afvist** (BB-119,
  BB-131), og **ét delvist** (BB-123: koblingsdelen afvist, navnedelen forelagt). Hvert fund bærer sit
  udfald nedenfor.
- Afprøvet i: Chrome, 1536×864, lyst tema. Dokumentet hentet som `.docx` (fire udgaver, læst linje for linje).

## Fladen kort

Én side uden faner med **fem egne felter** (Beregningsdato, Startdato for ASL-ydelse, Tilkendt for periode,
Efterladte ægtefælle/samlevers fødselsdato, Køn) og **to felter, den deler med Erhvervsevnetab**
(`faellesAarsloen.aslAarsloen` og `faellesAarsloen.ealAarsloen`). Dertil to **spejlede** stamdata-rækker
(Skadelidtes fødselsdato, Skadedato/Anmeldelsesdato), som ikke kan rettes her.

Fladen regner to halvdele, der gates hver for sig: **EAL-kravet** (erstatningsansvarslovens § 13,
kapitaliseringsfaktor 10, 30 %, aldersreduktion) og **ASL-ydelserne** (løbende ydelser pr. år plus en
proformakapitalisering af resten). Nettokravet er EAL-kravet minus begge ASL-poster. Ét dokument, én
downloadknap.

Fladen er programmets første, hvor **hele resultatet er en difference mellem to selvstændige
beregninger** – og det er den forskel, de tungeste fund bor i.

## Fund

### BB-117 – En efterladt under 18 år lader hele ASL-halvdelen forsvinde tavst, og dokumentet kan stadig hentes

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-16--en-komplet-række-programmet-ikke-vil-regne-på` og
  `TVAERGAAENDE.md#m-25--gaten-spørger-findes-der-noget-ikke-findes-det-brugeren-bad-om`
- **Prioritet:** **Høj**
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `15-03-1975`, Skadedato `10-06-2020`.
  2. Forsørgertab: Beregningsdato `01-07-2025`, Skadelidtes årsløn (efter ASL) `400.000`,
     Startdato for ASL-ydelse `10-06-2020`, Tilkendt for periode `10`.
  3. Efterladte ægtefælle/samlevers fødselsdato: skriv `200808`, som feltet selv gør til **`20-08-2008`**
     (tocifret årstal er en af programmets egne indtastningsformer).
- **Det sker:** Hele sektionen **«ASL-ydelser» forsvinder**, og med den forsvinder sektionen «Beregnet
  forsørgertab». Ingen celle er rød, ingen advarsel vises, og **downloadknappen står uændret som
  «Download som Word» og er aktiv**. Det hentede dokument indeholder «Grundlæggende oplysninger» med
  **kun** Beregningsdato og Skadelidtes fødselsdato – de fire ASL-oplysninger, brugeren netop har
  indtastet, står ikke i dokumentet – og slutter med «Beregnet EAL-krav … **1.155.420 kr.**» med fed.
  De ASL-ydelser, der i den korrekte beregning trækker `1.065.384 kr.` fra, findes ikke i papiret.
  Grænsen er målt præcist: `01-06-2007` (18 år på beregningsdatoen) regner; `01-08-2007` (17 år) gør ikke.
  Årsagen er, at forsørgertabstabellerne kun har aldersrækker for **18–66 år**, mens feltets erklærede
  grænse er `01-01-1900` til dags dato. Programmet HAR beskeden – `forsoergertab-alder-missing`,
  «Der findes ingen aldersrække for 17 år i tabel H» – men ingen komponent læser den.
- **Det er uhensigtsmæssigt fordi:** Brugeren får et komplet, professionelt udseende dokument, hvor
  halvdelen af beregningen mangler, uden at noget som helst har sagt fra. Kravet fremstår tolv gange
  større end det er, og fejlen kan først opdages af modparten. Fladen ser desuden **præcis ud** som når
  brugeren med vilje kun regner EAL-delen, så der er ingen måde at skelne «du udfyldte ikke ASL» fra
  «dine ASL-tal blev kasseret».
- **Bedre ville være:** Feltet får en rød feltfejl med den besked, programmet allerede har formuleret:
  «Kapitaliseringstabellen dækker kun aldre fra 18 år» (samme mønster som BB-037/BB-038 flyttede
  motorafvisninger ind i feltmodellen). Dermed spærres downloaden af sig selv, og årsagen står ved det
  felt, brugeren skal rette. Uanset hvad må gaten ikke kunne godkende et dokument, hvor en halvdel,
  brugeren har udfyldt, er faldet ud – se M-25.
- **Andre steder det kan gælde:** Enhver flade, hvis dokument har betingede sektioner, som gaten
  godkender med et ELLER – EO's mange valgfri afsnit, EET's to faner. Generelt: hvert `rows.find(...)`
  eller tabelopslag i `forsoergertabAslYdelser.ts` / `eetKapitaliseringOpslag.ts`, hvor datasættets
  dækning er smallere end feltets erklærede grænse.

**Tilbagemelding**
Jeg er enig. Det er en alvorlig fejl. Sørg for også at undersøge grundigt om der er nogen andre lignende fejl/mangler andre steder i programmet, og sørg for at alle er rettet og sikret mod regression.

**Udfald: RETTET (2026-08-28).** Fundet havde tre uafhængige lag, og alle tre er lukket:

1. **Typen var forkert.** ASL-motoren producerede feltløse `EetIssue`s uden adresse – beskeden var
   strukturelt ude af stand til at nå brugeren. Nyt katalog `domain/forsoergertab/forsoergertabIssueFields.ts`
   binder hvert beregningsafvisende issue til den feltadresse, brugeren skal rette, og oversætter det til et
   ægte `FieldIssue` (`reason: 'rule'`).
2. **Vejen ind i UI'et fandtes ikke.** `DateField` manglede `crossFieldIssue`-proppen, som
   `IntegerField`/`NumericTextField`/`PercentField` alle havde. Tilføjet; hullet var uovervåget, fordi
   AST-værnet kun dækkede gridceller.
3. **Gaten var fail-open.** Allowlisten på fem issue-ID'er er erstattet af et fail-closed princip som på de
   tre øvrige flader: ethvert error-issue blokerer. Klassen skelnes stadig («Indtastning mangler» mod «Fejl
   i indtastning»), så en tom sag ikke melder en fejl. Dertil M-25-grenen: en KOMPLET udfyldt halvdel, som
   motoren har afvist, blokerer downloaden i stedet for at blive udeladt af dokumentet.

**Søskende-fundet, rapporten ikke havde målt:** `forsoergertab-faktor-unresolved` er samme fejl med et andet
felt som årsag – aldersrækkerne bliver kortere med alderen (alder 67 har én faktor), så en 64-årig efterladt
med 10 års tilkendt periode ramte samme tavse forsvinden. Den og fire andre søskende er dækket af samme
rettelse. Regression: `forsoergertabIssueFields.test.ts` (kataloget dækker alle beregningsafvisende
issue-ID'er) + en integrationstest i `forsoergertabSnapshot.test.ts` med rapportens egne værdier.

### BB-118 – «400.000,00» indsat i et årslønsfelt bliver til 4.000.000 kr. uden et ord

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-14--en-anden-fortolkningsvej-ved-siden-af-tastningen`
- **Prioritet:** **Høj**
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Kopiér beløbet `400.000,00` fra en afgørelse eller et regneark.
  2. Indsæt det i «Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)».
- **Det sker:** Feltet viser **`4.000.000`**. Ingen rød kant, ingen besked, og værdien driver hele
  EAL-kravet og dokumentet. Målt: `551.000,00` → `5.510.000`; `400.000,00` → `4.000.000`;
  `400.000 kr.` → `400.000` (enheden håndteres altså rigtigt – det er kun ørerne, der bliver til kroner).
  Årsagen er, at de to årslønsfelter er erklæret `allowDecimals: false`, så decimalkommaet springes over
  efter reglen «paste opfører sig som tastning», og de to nuller efter kommaet lægger sig i tallet.
- **Det er uhensigtsmæssigt fordi:** Det er en faktor-10-fejl i det tal, hele erstatningen udspringer af,
  frembragt af den mest almindelige handling i programmet: at kopiere et beløb, som det står skrevet på
  dansk. Feltet viser ingen decimaler, så brugeren har ingen anledning til at tro, at et decimalkomma
  betyder noget – og resultatet ser ud som et lovligt beløb. På ASL-feltet fanges fejlen tilfældigvis af
  skadesårets maksimum; på EAL-feltet findes intet loft (9.999.999), så den slipper hele vejen igennem.
  **`faellesAarsloen` er den ENESTE beløbsfamilie i programmet med `allowDecimals: false`** – alle andre
  beløbsfelter tager imod `400.000,00` korrekt. De to felter er altså også uenige med resten af programmet.
- **Bedre ville være:** Et decimalkomma i et beløbsfelt uden decimaler skal **afslutte** værdien, ikke
  springes over: `400.000,00` bliver `400.000`. Det er samme spørgsmål, BB-088 rejste om linjeskiftet, og
  samme svar: reglen «paste = tastning» tager ikke stilling til det tegn, der adskiller de to dele af tallet.
  Alternativt: lad de to felter tage imod decimaler som resten af programmet og afrund ved settle.
- **Andre steder det kan gælde:** `faellesAarsloen.aslAarsloen` og `.ealAarsloen` optræder på
  **Erhvervsevnetab** og Forsørgertab. Samme klasse findes i procentfelter med `allowDecimals: false`
  (`erhvervsevnetabDescriptors.ts:142` og `:422`): «15,00 %» indsat bliver `1500`, men fanges dér af
  procentens 0–100-grænse. Prøven er generel: **find hvert felt med `allowDecimals: false` og indsæt den
  form, tallet normalt skrives i.**

**Tilbagemelding**
Jeg er enig i dit fund og forslag til rettelse - og at det skal sikres generelt. Det tyder på en fejl i den centrale paste-håndtering. Sørg dog for, at hvis der pastes en decimal-værdi i et felt, som tillader decimalværdier, så bibeholdes decimaldelen. Generelt: gå frem efter det grundlæggende princip om, at feltet skal håndtere paste på samme måde som hvis brugeren havde indtastet nøjagtig det samme indhold, startende med det første tegn.

**Udfald: RETTET (2026-08-28) – men fundets diagnose var forkert på ét punkt, og det ændrede løsningen.**

Kortlægningen viste, at **paste og tastning ikke divergerer**: begge veje læser samme prædikat, og begge
gav `4.000.000`. Tastet man `400.000,00` tegn for tegn, blev kommaet sprunget over på nøjagtig samme måde.
Princippet «paste = tastning» var altså allerede opfyldt – fejlen lå i selve tegn-for-tegn-reglen «spring
det ulovlige tegn over», som er rigtig for et bogstav, men forkert for det tegn, der ADSKILLER de to dele
af et tal. Adfærden var endda pinnet af en test (`normalizeAmountPaste('123,99', { allowDecimals: false })`
→ `'12399'`).

**Udviklerens afgørelse (2026-08-28):** decimalløse felter tager imod decimaler og afrunder ved settle,
som resten af programmet – og samme regel for procentfelterne. `allowDecimals` er dermed ophørt med at være
en TEGN-regel og er blevet en SETTLE-regel, udtrykt som `precision`. `400.000,00` → `400.000`;
`400.000,50` → `400.001` (afrundet til hele kroner, hvorefter delelighedsreglen gælder uændret).

Konsekvensen er bredere end de to årslønsfelter: `allowDecimals`-optionen er fjernet helt fra
`parseAmountInput`, fordi `precision` allerede udtrykte reglen, og de to kunne komme i modstrid.

### BB-119 – «Forsørgertabserstatning 0 kr.», hvor de tre linjer over den giver -363.879 kr.

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-24--feltets-grænse-er-sat-af-feltets-art-ikke-af-det-tal-det-trækkes-fra`
- **Prioritet:** **Høj**
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `15-03-1958`, Skadedato `10-06-2020`.
  2. Forsørgertab: Beregningsdato `01-07-2025`, årsløn efter ASL `400.000`,
     Startdato for ASL-ydelse `10-06-2020`, Tilkendt for periode `10`,
     Efterladtes fødselsdato `20-08-1978`.
- **Det sker:** Sektionen «Beregnet forsørgertab» viser

  | Linje | Beløb |
  |---|---|
  | EAL-krav | `701.505 kr.` |
  | Løbende ydelser (efter ASL) | `- 643.653 kr.` |
  | Kapitalbeløb (efter ASL) | `- 421.731 kr.` |
  | **Forsørgertabserstatning** | **`0 kr.`** |

  Regnestykket giver `-363.879 kr.` Nettokravet klampes til nul (`Math.max(0, …)`), og nullet skrives i
  fed uden et ord om, at der er klampet. **Downloadknappen er aktiv, og dokumentet indeholder de samme
  fire linjer ordret.**
- **Det er uhensigtsmæssigt fordi:** Sidens vigtigste tal præsenteres som resultatet af et fradrag,
  brugeren kan lave i hovedet og få et andet svar på. Han kan ikke afgøre, om nullet betyder «der er
  intet krav tilbage» eller «programmet gik i stå». Og fordi de fire linjer trykkes uændret i
  specifikationen, får modparten et regnestykke, der ikke går op – på præcis den flade, hvis eneste
  formål er at kunne efterprøves.
- **Bedre ville være:** Skriv differencen, og forklar klampningen med én linje, når den slår til – fx en
  femte linje «ASL-ydelserne overstiger EAL-kravet, og forsørgertabserstatningen udgør derfor 0 kr.»
  (samme form som «Det beregnede forsørgertab skal ikke forhøjes, dvs. udgør», som fladen allerede
  bruger). Alternativt vis det negative mellemresultat og derefter nullet. Det afgørende er, at de viste
  linjer og det viste resultat hænger sammen.
- **Andre steder det kan gælde:** `clampMoneyOreToZero` i `forsoergertabEalKrav.ts` (samme klamp på
  EAL-kravet, når aldersreduktionen overstiger minimumsbeløbet), EET's differencekrav og EO's
  reguleringsbilag. Generelt: `rg "Math.max\(0," src/domain` og hvert `clampMoneyOreToZero`-kald, der
  ender i en vist linje.

**Tilbagemelding**
Din betragtning strider mod grundlæggende juridiske principper. Der kan beregnes ydelser efter to lovsæt, og formålet med den beregnede forsørgertab er her at beregne, om der er krav på yderligere erstatning efter EAL udover det, som allerede er modtaget fra ASL. Så derfor kan værdien aldrig blive negativ - det vil i erstatningsretlig sammenhænge have den betydning, at vedkommende skal betale noget tilbage, hvilket ikke er korrekt. 0 kr. skal fastholdes som beregnet værdi, hvis den beregnede værdi er negativ.

**Udfald: AFVIST i sin helhed (2026-08-28). Sporet er lukket.** Jeg pressede tilbage på fundets anden
halvdel – at de fire trykte linjer stadig udgør et regnestykke, modparten kan efterregne til
`-363.879 kr.` – og foreslog én forklarende linje, når nullet opstår. **Også det er afvist:** det er
velkendt for målgruppen, at det, der beregnes, er et eventuelt **overskydende** krav efter EAL, og at en
negativ værdi vises som nul. Det behøver ingen forklaring.

**Ingen kodeændring. Foreslå det ikke igen** – hverken den negative visning, en femte linje eller en
anden markering af klampningen. Læren er skrevet ind i M-24, hvis nye generelle regel jeg havde sat for
bredt: **et klampet nul, der ER ydelsens velkendte resultatform, er ikke et fund.** Kun et klampet nul,
der dækker over en umulig mellemregning – som BB-097's `-76 hverdage` – er det.

### BB-120 – Feltet hedder «Startdato for ASL-ydelse», men melder «Virkningsdato kan senest være …»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Lad Beregningsdato være tom.
  2. Skriv `01-01-2030` i «Startdato for ASL-ydelse».
- **Det sker:** Feltet bliver rødt med teksten **«Virkningsdato kan senest være 31. december 2026»**.
  Ordet «Virkningsdato» findes ikke ét eneste sted på skærmen – hverken som label, som overskrift eller i
  dokumentet, hvor feltet heder «Startdato for ASL-ydelse» begge steder. Navnet står som en streng i
  `forsoergertabDescriptors.ts` (`maxBoundFieldLabel: 'Virkningsdato'`).
- **Det er uhensigtsmæssigt fordi:** Brugeren får en fejl om et felt, han ikke kan finde. Det er præcis
  den mekanisme, M-02 blev skrevet om: navnet er skrevet ind i beskeden i stedet for hentet fra feltet,
  og de to er drevet fra hinanden. Feltet ejer sit navn ét sted (`label: 'Startdato for ASL-ydelse'`),
  og grænsebeskeden bruger et andet.
- **Bedre ville være:** `maxBoundFieldLabel` hentes fra descriptorens `label` i stedet for at være en
  parallel streng – så kan de to pr. konstruktion ikke blive uenige. Beskeden bliver «Startdato for
  ASL-ydelse kan senest være 31. december 2026».
- **Andre steder det kan gælde:** Hvert `maxBoundFieldLabel`/`minBoundLabel` i kataloget – prøven er
  billig: `rg "maxBoundFieldLabel" src/inputCore/catalog` og sammenlign hver streng med samme
  descriptors `label`.

**Tilbagemelding**
Virkningsdato og startdato betyder det samme. Virkningsdato er det rent formelle, juridiske udtryk, hvor startdato er et mere folkeligt udtryk. Hvis du mener at det vil gavne, må udtrykke virkningsdato gerne bruges konsekvent om disse.

**Udfald: RETTET (2026-08-28) – «Virkningsdato» overalt.** Udvikleren har valgt det juridisk formelle
udtryk konsekvent: feltets label, dokumentets linje, grænsebeskeden og beregningsdatoens årsagssætning
hedder alle «Virkningsdato». Navnet står som ÉN konstant i descriptoren, som `maxBoundFieldLabel` og
`origin`-teksten læser, så de tre ikke kan drifte igen. Bemærk at feltet allerede hed `virkningsdato` i
koden – rettelsen bringer UI'et i overensstemmelse med koden, ikke omvendt.

### BB-121 – «skadestidspunkt» står tre steder på en sag, programmet selv kalder «Anmeldelsesdato»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Stamdata: Skadestype `Erhvervssygdom`, dato `10-06-2020`, fødselsdato `15-03-1975`.
  2. Udfyld Forsørgertab, så EAL-panelet vises.
- **Det sker:** Øverst omdøber fladen korrekt rækken til **«Anmeldelsesdato: 10-06-2020»** – og
  tolv linjer længere nede står stadig:
  - «Skadelidtes årsløn på **skadestidspunktet**»
  - «Regulering fra **skadesår** 2020 til beregningsår 2025»
  - «Skadelidtes alder på **skadestidspunkt**: 45 år»

  Alderen på 45 år er regnet på præcis den anmeldelsesdato, rækken ovenfor lige har fået sit rigtige
  navn. Samme tre sætninger står ordret i dokumentet.
- **Det er uhensigtsmæssigt fordi:** Udviklerens navneregel af 2026-08-16 er bindende for hele
  programmet: en erhvervssygdomssag har en anmeldelsesdato, ikke en skadedato. Når fladen bruger begge
  ord om den samme dato på den samme skærm, må brugeren gætte, om «skadestidspunktet» er en fjerde dato,
  han ikke har indtastet.
- **Bedre ville være:** De tre afledte tekster hentes fra `resolveSkadestypeDatoLabel`, som fladen
  allerede kalder til rækken ovenfor – «Skadelidtes årsløn på anmeldelsestidspunktet»,
  «Regulering fra anmeldelsesår …», «Skadelidtes alder på anmeldelsestidspunkt» (den præcise ordlyd er
  udviklerens).
- **Andre steder det kan gælde:** Det er BB-072's navngivne kandidat, nu bekræftet. Samme faste ordlyd
  står i `ForsoergertabEalSection.tsx`, `forsoergertabDocument.ts` og – uafprøvet – på **EET efter EAL**
  (flade 11) og i EET's dokumentgeneratorer.

**Tilbagemelding**
Dette strider mod et generelt princip, som du tidligere har forsøgt at implementere universielt for hele programmet - men hvor dette åbenbart ved fejl ikke er blevet rettet. Det skal rettes. Sprogbrugen skal altid lyde sådan, at udtrykke anmeldelsesdato anvendes når skadestypen er erhvervssygdom, og i alle andre situationer anvendes skadedato. Det er fastslået i kontrakterne og burde have været implementeret overalt. Du må gerne lave en grundig gennemgang for at fange eventuelle yderligere hængeparteri.

**Udfald: RETTET (2026-08-28) – og gennemgangen afdækkede, HVORFOR princippet ikke virkede.**

Der var **to plumbing-fejl**, som forklarer, at rettelserne aldrig slog igennem, uanset hvor teksterne blev
rettet: både `erhvervsevnetabReaderProjection.ts` og `forsoergertabReaderProjection.ts` udelod `skadestype`,
når de byggede snapshottets stamdata. På EET blev feltet endda LÆST, men ikke videregivet. Følgen var, at
hvert eneste opslag af `stamdata?.skadestype` på begge flader gav `undefined`, og alt faldt tilbage til
«skade»-formen – også for en erhvervssygdom, hvor rækken øverst korrekt sagde «Anmeldelsesdato». Det er
rodårsagen bag den formulering, at princippet «åbenbart ved fejl ikke er blevet rettet».

Dertil manglede referencen de former, teksterne faktisk bruger. `StamdataDatoReference` bar kun `label` og
`labelLower` (datoens navn), mens «skadestidspunkt» og «skadesår» blev hardkodet – eller, på Varige mén,
skrevet som en inline ternary to steder. Referencen bærer nu også `tidspunkt`, `tidspunktBestemt` og `aar`,
så et nyt kaldssted arver formen frem for at skrive sin egen.

**Rettede hængepartier ud over de tre navngivne:** EET efter EAL (skærm + dokument, hvor skadestypen nu
bæres i beregningens port frem for i brevhoved-stamdata – sidstnævnte findes kun, når brugeren har slået
brevhovedet til), `eetEalCalculation`s `alder-unresolved`-issue (som stod ved siden af to issues, der
allerede gjorde det rigtigt), ASL-årslønnens maksimum-besked, og descriptoren
`ansatPaaSkadestidspunktet`, hvis nabo allerede havde en `contextualLabel`.

### BB-122 – Specifikationen nævner ikke sagens skadedato

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** Udfyld en fuldstændig sag og hent dokumentet.
- **Det sker:** Dokumentets «Grundlæggende oplysninger» indeholder Beregningsdato, Skadelidtes
  fødselsdato, Efterladtes fødselsdato, Køn (når relevant), årsløn, Startdato for ASL-ydelse og Tilkendt
  for periode – men **ikke Skadedato/Anmeldelsesdato**, som skærmen viser som anden række. Datoen kan
  ikke slås til: brevhovedet indeholder kun journalnr., advokat, sagsbehandler og dags dato. Skadeåret
  optræder kun indirekte, i sætningen «Regulering fra skadesår 2020 til beregningsår 2025».
- **Det er uhensigtsmæssigt fordi:** Skadedatoen styrer fire af beregningens opslag – ASL-årslønnens
  maksimum, opreguleringens kildeår, kapitaliseringsbekendtgørelsen og tabelvalget. En modpart kan ikke
  efterregne specifikationen uden den, og et papir uden sagens egen dato kan ikke henføres til sagen.
  **Varige méns dokument gør det rigtige** på nøjagtig samme sagsgrundlag: det trykker både Fødselsdato
  og Skadedato/Anmeldelsesdato med det skadestype-afledte navn.
- **Bedre ville være:** Én linje mere i `addGrundlaeggendeSection`, med samme skadestype-afledte label
  som skærmen – altså en konvergens mod varigemen-dokumentet, ikke et nyt design.
- **Andre steder det kan gælde:** De øvrige dokumenters «Grundlæggende oplysninger». Prøven er:
  sammenlign skærmens forudsætningsrækker med dokumentets, række for række.

**Tilbagemelding**
Jeg er enig. Indsæt, hvor det forekommer konsekvent og i overensstemmelse med praksis fra andre dokumenter i programmet.

**Udfald: RETTET (2026-08-28).** Dokumentets «Grundlæggende oplysninger» trykker nu sagens dato med det
skadestype-afledte navn, som anden række på skærmen – en konvergens mod varigemen-dokumentet. Datoen
kommer fra dokumentets egen projektion og IKKE fra brevhoved-stamdata: brevhovedet projiceres kun, når
brugeren har slået det til, og sagens dato må ikke afhænge af den indstilling.

### BB-123 – De to årslønsfelter er de samme som på Erhvervsevnetab, hedder tre forskellige ting, og intet siger at de deles

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-26--et-delt-felt-med-to-hjem`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Skriv `551.000` i «Skadelidtes årsløn (efter ASL)» på Forsørgertab.
  2. Gå til Erhvervsevnetab → Oplysninger.
- **Det sker:** Feltet «Årsløn» under overskriften «Arbejdsskadesikringsloven» står med `551.000`.
  Det er ikke en kopi – det er det samme felt (`faellesAarsloen.aslAarsloen`), og en rettelse det ene
  sted ændrer det andet. **Ingen af de to sider siger det.** Dertil bærer hvert af de to felter tre navne:

  | Felt | Forsørgertab (skærm) | Erhvervsevnetab (skærm) | Dokumentet | Feltets eget navn (fejltekster, oplæsning) |
  |---|---|---|---|---|
  | ASL | Skadelidtes årsløn (efter ASL) | Årsløn | Skadelidtes årsløn (efter ASL) | Årsløn |
  | EAL | Skadelidtes årsløn efter EAL (hvis forskellig fra ASL) | Årsløn (hvis forskellig fra ASL) | Skadelidtes årsløn (efter EAL) | Årsløn (hvis forskellig fra ASL) |

- **Det er uhensigtsmæssigt fordi:** En bruger, der retter årslønnen på Forsørgertab, ændrer uden at vide
  det sit erhvervsevnetab – og omvendt. Det er den ene form for kobling mellem to sider, som fladen
  faktisk HAR (jf. det lukkede spor 5 fra Satser: et sådant fund kræver netop, at koblingen findes).
  De tre navne gør det værre: brugeren kan ikke genkende feltet fra den ene side til den anden, og
  feltets egne fejlbeskeder navngiver det «Årsløn», mens rækken foran ham siger noget andet.
- **Bedre ville være:** Ét navn pr. felt, brugt på begge sider og i dokumentet – og en kort linje ved
  årslønsblokken på begge flader om, at årslønnen er sagens ene årsløn og deles med den anden side.
  Descriptorens `label` skal være det navn, rækken viser, så fejltekster og oplæsning følger med.
- **Andre steder det kan gælde:** Hele `faellesAarsloen`-sektionen. Efterprøv desuden, om andre
  descriptors renderes fra mere end én flade – `rg "faellesAarsloen" src/components/pages`.

**Tilbagemelding**
Årsløn efter ASL og Årsløn efter EAL er to juridiske begreber. Værdierne fastsættes autoritativt for den pågældende skadelidte vedrørende den givne skade. De skal ikke være ens efter ASL og EAL. Udgangspunktet er, at årslønnen efter ASL lægges til grund, hvis ikke brugeren særskilt angiver en anden årsløn efter EAL. Der er en særlig omstændighed ved, at der er en maks-grænse for årsløn efter ASL, der ikke findes efter EAL. En fastsat årsløn efter ASL anvendes på alle situationer, hvor der beregnes nogen ydelser, hvor årslønnen efter ASL lægges til grund - for den skadelidte findes der således kun én kanonisk årsløn efter ASL, og tilsvarende én kanonisk årsløn efter EAL.

**Udfald: DELVIST – fundets kerne er AFVIST, navnedelen er UDESTÅENDE (2026-08-28).**

Svaret afgør fundets vigtigste påstand: at koblingen mellem de to sider skulle gøres synlig med en linje om,
at årslønnen «deles». Den præmis er forkert. Der findes ét kanonisk årslønsbeløb efter ASL og ét efter EAL
for den skadelidte, og at samme værdi bruges begge steder er ikke en skjult kobling mellem to sider – det er
den samme autoritativt fastsatte størrelse, brugt hvor den hører til. **Ingen «deles med den anden side»-linje
tilføjes.**

**Tilbage står de tre navne**, som svaret ikke tager stilling til: hvert felt hedder én ting på Forsørgertab,
en anden på Erhvervsevnetab og en tredje i sine egne fejlbeskeder («Årsløn»). Feltets `label` er den, oplæsning
og fejltekster bruger, så en bruger kan møde en fejl om «Årsløn» stående ved en række, der hedder «Skadelidtes
årsløn (efter ASL)». Det er samme mekanisme som BB-120, blot uden en afgørelse endnu. **Forelagt udvikleren
særskilt; ingen kodeændring foretaget.**

### BB-124 – Samme situation giver to forskellige gule advarsler på de to sider, der deler feltet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-26--et-delt-felt-med-to-hjem`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Stamdata: Skadedato `10-06-2020`.
  2. Sæt årsløn efter ASL til `551.000` (skadesårets maksimum) og lad EAL-årslønnen være tom.
  3. Læs den gule advarsel på EAL-feltet på Forsørgertab, og derefter på Erhvervsevnetab.
- **Det sker:** Samme felt, samme værdi, samme udløser – to tekster:
  - Forsørgertab: **«Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.»**
  - Erhvervsevnetab: **«Årsløn efter ASL er sat til max-årslønnen»**

  Begge er gule (`rgb(245, 158, 11)`), ingen af dem blokerer. De er implementeret to gange
  (`forsoergertabSnapshot.ts` og `eetFieldWarnings.ts`); den sidste er endda kommenteret med, at den er
  «samlet så feltvisningen og beregningen ikke kan drifte» – den er blot drevet fra sin nabo i stedet.
- **Det er uhensigtsmæssigt fordi:** Den ene tekst konstaterer, den anden beder om en handling. Brugeren,
  der møder begge i samme sag, må tro, at der er tale om to forskellige forhold. Og fordi den ene tekst
  er den, der faktisk siger, hvad man skal gøre, er halvdelen af brugerne dårligere stillet end den anden
  halvdel – uden nogen grund.
- **Bedre ville være:** Én konstant, ét sted, brugt af begge flader. Ordlyden er udviklerens; den
  handlingsanvisende form («… skal den faktiske årsløn indtastes») er den, der hjælper.
- **Andre steder det kan gælde:** Enhver feltadvarsel, der er udledt i en sides eget snapshot frem for i
  en delt modul – `rg "createFieldWarning" src/domain`.

**Tilbagemelding**
Jeg er enig. Tjek også gerne andre steder i programmet, om der gives forskellige fejlmeddelelser eller ens advarsler på ens problemer.

**Udfald: RETTET (2026-08-28).** Den handlingsanvisende ordlyd er nu den ene: «Når årsløn efter ASL svarer
til maksimum, skal den faktiske årsløn indtastes.» Konstanten bor i `domain/aslEalAarsloen/aslAarsloenMaxNotice.ts`
– hos det DELTE årslønsfelt, ikke hos en af de to flader, der viser det. Lå den fortsat i
`erhvervsevnetab/eetFieldWarnings.ts`, ville Forsørgertab læse på tværs af et domæne, den ikke hører til, og
den næste flade ville lige så let skrive en tredje variant.

### BB-125 – Beløbsgrænsens fejltekst skriver «1000» og «551000» og siger ikke, hvor loftet kommer fra

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Stamdata: Skadedato `10-06-2020`.
  2. Skriv `600000` i «Skadelidtes årsløn (efter ASL)».
- **Det sker:** Feltet bliver rødt med **«Værdi skal være mellem 1000 og 551000»** – uden
  tusindseparator, uden enhed, og uden at sige, at `551.000` er **skadesårets ASL-maksimum**. Samme felt
  skriver selv værdien som `600.000`, og feltets anden regel formaterer korrekt:
  «Årsløn skal være deleligt med **1.000**.» De to tekster om samme størrelsesorden står altså i to
  former på det samme felt.
  Programmet HAR den forklarende tekst – `validateAslAarsloenBySkadesaarMax` skriver
  «Årsløn kan ikke overstige maks årslønnen i skadesåret (551.000 kr.)» – men den er **uopnåelig**, fordi
  bounds-validatoren kører først og vinder. Loftet er sat to gange, og kun den mindst oplysende af de to
  beskeder når brugeren.
- **Det er uhensigtsmæssigt fordi:** «551000» kan ikke læses i en fart, og AGENTS.md's regel om danske
  talkonventioner i tooltips er ikke overholdt. Vigtigere: brugeren får at vide, at grænsen findes, men
  ikke hvor den kommer fra – og loftet flytter sig med skadeåret, så det er præcis den oplysning, han
  mangler for at forstå tallet. Det er samme lære som M-24's punkt 1: to grænser, der er den samme
  grænse skrevet to gange, efterlader den ene besked som død kode.
- **Bedre ville være:** `getIntegerRangeErrorMessage` formaterer sine grænser gennem programmets egen
  talformattering (og med feltets enhed, hvor den findes). Og de to ASL-lofter samles til ét, så den
  besked, der navngiver skadesåret, er den, brugeren ser.
- **Andre steder det kan gælde:** `getIntegerRangeErrorMessage` bruges af **alle** beløbs- og
  heltalsfelter i programmet (`integerBoundsValidator`, `amountBoundsValidator`). På denne flade rammer
  den også «Tilkendt for periode», hvor beskeden «Værdi skal være mellem 1 og 10» mangler enheden «år».

**Tilbagemelding**
Hvis det kan løses på en god, velstrukturet måde, som ikke blot skaber nye fejl eller uhensigtsmæssigheder andre steder, må der gerne fx være en særskilt, bedre beskrivende fejlmeddelelse om noget i stil med at "Den indtastede årsløn overstiger årslønsmax (xxx.xxx kr.)".

**Udfald: RETTET (2026-08-28), begge halvdele.**

**Den dublerede grænse er fjernet.** ASL-loftet var sat to gange – som en generisk bounds-grænse på
descriptoren OG som domænereglen `validateAslAarsloenBySkadesaarMax`. Bounds-validatoren kørte først og
vandt, så den forklarende besked var uopnåelig død kode. Bounds-grænsen er nu det faste
repræsentationsloft (1.000–9.999.999), og skadesårets skærpelse ejes alene af domænereglen, hvis besked –
«Årsløn kan ikke overstige maks årslønnen i skadesåret (551.000 kr.)» – er den, brugeren ser. Maksimum har
desuden forrang over delelighedsreglen, når begge er brudt: loftet er den grænse, der reelt binder.

**Talformateringen er generel.** `getIntegerRangeErrorMessage` formaterer sine grænser gennem programmets
egen talformattering og tager en valgfri enhed fra feltet. Det retter samtidig «Værdi skal være mellem 1 og
10» på «Tilkendt for periode», som nu siger «år». Rettelsen rammer alle beløbs- og heltalsfelter i
programmet, ikke kun denne flade.

### BB-126 – Et rødt felt i Stamdata vises med sin fejltekst, men uden den vej tilbage, det tomme felt har

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Lad Stamdata være tom. Læs rækken «Skadelidtes fødselsdato» på Forsørgertab.
  2. Skriv `99-99-9999` i Stamdatas Fødselsdato. Læs samme række igen.
- **Det sker:** I trin 1 står der «Mangler (angiv i **Stamdata**)», hvor «Stamdata» er et klikbart link,
  der navigerer og blinkmarkerer feltet. I trin 2 står der «Der er udfyldt en ugyldig værdi i feltet
  'Fødselsdato'» – **uden link**, og uden at nævne Stamdata. Downloadknappen er grå med «Fejl i
  indtastning».
- **Det er uhensigtsmæssigt fordi:** Den tilstand, der kræver mest af brugeren – en værdi, der skal
  RETTES et andet sted – er den, der har mistet vejen derhen. M-19's rettelse gav fladen den rigtige
  besked, men beholdt navigationen kun i den tomme gren. Bemærk også, at rækken foran brugeren heder
  «Skadelidtes fødselsdato», mens beskeden navngiver feltet «Fødselsdato».
- **Bedre ville være:** Begge grene bærer linket: «Der er udfyldt en ugyldig værdi i feltet Fødselsdato
  (ret i **Stamdata**)». Det er samme `goToSkadelidteFodselsdato`, som allerede er bundet i viewmodellen.
- **Andre steder det kan gælde:** `ForsoergertabOplysningerSection.tsx` har begge rækker i denne form.
  Samme sondring findes på EO-beregningsfanens skadedato-række og på Varige méns to spejlede rækker
  (commit `789d11f7`) – efterprøv, om linket dér følger med den røde gren.

**Tilbagemelding**
Jeg er enig. Sørg for at rette teksten, der hører sammen med det nye link, så den ikke er lige så lang som den nuværende "Der er udfyldt en ugyldig værdi i feltet 'Fødselsdato'" - tilpas gerne til stil for den tekst, der pt. anvendes ved meddelelse med klikbart link, når feltet er tomt.

Der skal laves en tilsvarende korrektion alle andre steder i programmet, hvor det kunne være relevant.

**Udfald: RETTET (2026-08-28) – som en delt komponent, ikke en lokal rettelse.**

Rækken fandtes i **seks nær-identiske kopier** (to på Forsørgertab, fire på Varige mén), hver med sin egen
ternary og sin egen udgave af den ugyldige gren – én med tooltip og generisk tekst, én med den rå fejltekst.
De er nu ÉN komponent, `components/layout/MirroredStamdataRow.tsx`, hvor rækkens tre tilstande ikke kan
drifte fra hinanden, og en syvende række arver den rigtige adfærd frem for den nærmeste nabos.

Ordlyden følger den tomme grens form efter din anvisning: «Ugyldig værdi (ret i **Stamdata**)» mod «Mangler
(angiv i **Stamdata**)» – kort, med linket til sidst. Feltets egen fulde tekst er bevaret som hover-tekst,
så præcisionen ikke går tabt.

### BB-127 – Datoparret: kun den ene af de to røde celler navngiver modparten

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-07--parvise-grænser-begge-felter-markeres-hver-med-sin-egen-udvej`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Beregningsdato `01-07-2025`.
  2. Startdato for ASL-ydelse `31-12-2030`.
- **Det sker:** Begge felter bliver røde – det er rigtigt efter udviklerens regel af 2026-08-16. Men de
  to tekster er ikke hinandens spejlbillede:
  - Startdato for ASL-ydelse: **«Dato skal være mellem 10-06-2020 og 01-07-2025»** – to bare datoer.
    Intet siger, at `01-07-2025` ER Beregningsdatoen, som brugeren netop har skrevet lige ovenfor.
  - Beregningsdato: **«Der findes ingen gyldig dato her: tidligst tilladte (31-12-2030) ligger efter
    senest tilladte (31-12-2026). Grænserne kommer fra Anmeldelsesdato og Startdato for ASL-ydelse.»**

  Den anden tekst har desuden et upræcist led: «senest tilladte (31-12-2026)» kommer fra
  **datadækningen**, ikke fra nogen af de to navngivne felter.
- **Det er uhensigtsmæssigt fordi:** Brugeren står i det felt, han lige har rettet, og får to datoer uden
  afsender. Han skal selv gætte, at loftet er beregningsdatoen. Det er præcis den asymmetri, M-07 blev
  omformuleret om, og løsningen findes allerede i programmet: BF-028 gav EO's datopar den modgående dato
  med navn i hver tooltip.
- **Bedre ville være:** «Datoen kan ikke være efter Beregningsdato (01-07-2025)» i det ene felt og
  «Datoen kan ikke være før Startdato for ASL-ydelse (31-12-2030)» i det andet – hver tekst set fra sit
  eget felts synsvinkel. Og lad årsagssætningen kun navngive de grænser, den faktisk forklarer.
- **Andre steder det kan gælde:** Alle `narrowMin`/`narrowMax`-par i kataloget, hvor `special` ikke
  sætter en `maxBoundKind`/`minBoundKind` og beskeden derfor falder ned i den generiske
  `validateISODateRange`.

**Tilbagemelding**
Jeg er enig.

**Udfald: RETTET (2026-08-28).** Virkningsdatoens øvre grænse navngiver nu den dato, den kommer fra:
«Datoen er efter Beregningsdato (01-07-2025)». De to felter i parret er dermed hinandens spejlbillede, hver
set fra sit eget felts synsvinkel – mekanismen (`maxBoundKind: 'efterFelt'`) fandtes allerede og blev blot
ikke brugt her.

### BB-128 – Feltets nedre grænse giver den generiske «ugyldig værdi», den øvre en konkret tekst

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** Skriv `01-01-1899` og derefter `01-01-2030` i «Efterladte
  ægtefælle/samlevers fødselsdato» (feltets erklærede interval er `01-01-1900` til dags dato).
- **Det sker:**
  - `01-01-1899` → «Der er udfyldt en ugyldig værdi i feltet 'Efterladte ægtefælle/samlevers
    fødselsdato'» – samme besked som en umulig kalenderdato (`31-02-1978`).
  - `01-01-2030` → «Datoen er efter dags dato (27-08-2026)».
- **Det er uhensigtsmæssigt fordi:** De to ender af det samme interval svarer med hver sin slags besked,
  og den nedre siger hverken hvad grænsen er, eller at der overhovedet ER en grænse. Brugeren, der har
  tastet et forkert århundrede, får at vide, at datoen er «ugyldig» – hvilket den ikke er som dato.
  Kontrakten skelner bevidst format-/schemafejl (generisk tekst) fra bounds-fejl (konkret tekst,
  BF-013); her er en bounds-grænse havnet på den forkerte side af den skelnen.
- **Bedre ville være:** «Datoen kan ikke være før 01-01-1900» – altså at den erklærede nedre grænse
  håndhæves som et bounds-issue som alle andre grænser, ikke som en repræsenterbarhedsafvisning.
- **Andre steder det kan gælde:** Alle datofelter med en statisk nedre grænse i `dateRanges.ts`.
  Prøven er billig: skriv en dato ét år under `min` i hvert datofelt og læs beskeden.

**Tilbagemelding**
Jeg er enig.

**Udfald: RETTET (2026-08-28) – årsagen lå ét lag dybere end fundet antog.**

Mekanismen fandtes allerede: parse-kernen skelner `yearOutOfRepresentableRange` fra en umulig kalenderdag,
og `resolveDateFormatIssueText` bygger den konkrete tekst ud fra feltets egne grænser. Men `inputReader`
satte kun teksten som **tooltip** og lod `message` blive ved med at være den generiske «Der er udfyldt en
ugyldig værdi i feltet 'X'». `message` er den, «Fejl og advarsler» og a11y-laget læser – og den, rapporten
citerede. Rettelsen er ét ord: den konkrete tekst er nu også beskeden. Det retter alle datofelter på én
gang, ikke kun dette.

### BB-129 – Aldersreduktion for en afdød under 30 år: «Aldersreduktion 0 =», «(- 0 %)» og «- 0 kr.»

- **Type:** Fornuft
- **Rækkevidde:** Lokal (konvergens mod BB-073)
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** Stamdata: Fødselsdato `15-03-1995`, Skadedato `10-06-2020` (afdøde er
  25 år). Udfyld resten.
- **Det sker:** EAL-panelet skriver tre linjer i træk:

  ```
  Skadelidtes alder på skadestidspunkt      25 år
  Aldersreduktion 0 =                        0 %
  1.375.500 kr. x (- 0 %) =               - 0 kr.
  Beregnet EAL-krav
  1.375.500 kr. - 0 kr. =           1.375.500 kr.
  ```

  «Aldersreduktion 0 =» er ikke en formel; ved 45 år står der «Aldersreduktion (45 - 29) =». Og nullet
  får et minus foran sig to steder.
- **Det er uhensigtsmæssigt fordi:** Det er ordret det fund, udvikleren afgjorde på Varige mén
  (BB-073, gennemført som «fortegnsløst nul»): et fortegn foran et nul påstår en retning, der ikke
  findes. Dertil bruger fladen tre linjer og et regnestykke på at fortælle, at der ikke sker noget.
- **Bedre ville være:** Samme afgørelse som BB-073 – nul vises uden fortegn – og
  `buildAldersreduktionFormelTekst` returnerer ingen formel ved 0 %, så rækken bliver
  «Aldersreduktion: 0 %». Overvej samtidig at udelade de to følgende linjer, når reduktionen er nul.
- **Andre steder det kan gælde:** `buildAldersreduktionFormelTekst` og aldersreduktionslinjerne deles med
  **Erhvervsevnetab efter EAL** (flade 11) og med begge fladers dokumentgeneratorer.

**Tilbagemelding**
Jeg er enig. Følg den praksis, der blev fastlagt på siden med Varige Men.

**Udfald: RETTET (2026-08-28).** Ved 0 % er der ingen formel: rækken hedder blot «Aldersreduktion».
Hele ETIKETTEN bygges nu i helperen, ikke kun formeldelen – præfikset var hardkodet på alle fire
kaldssteder, så en helper, der kun leverede formlen, ikke kunne fjerne lighedstegnet uden at fire filer
rettede deres skabelon i takt. Fortegnet følger BB-073's praksis; se BB-130 for den delte helper.

### BB-130 – Samme nul står som «- 0 kr.» og «0 kr.» på samme skærm

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** Sæt Tilkendt for periode til `2` og Beregningsdato til `27-08-2026`, så
  perioden er udløbet før beregningsdatoen.
- **Det sker:** «Beregnet forsørgertab» skriver «Kapitalbeløb (efter ASL) **- 0 kr.**», mens ASL-panelet
  længere nede skriver «Kapitalbeløb **0 kr.**» for samme værdi. Begge former står i dokumentet.
- **Det er uhensigtsmæssigt fordi:** Det er BB-079's form – to visninger af samme tal på én skærm, som
  er uenige om formen – kombineret med BB-073's fortegnsløse nul. Minusset er en fast del af
  fradragslinjens skabelon og skulle kun stå der, når der faktisk trækkes noget fra.
- **Bedre ville være:** Fradragslinjerne sætter kun fortegn på beløb forskellige fra nul.
- **Andre steder det kan gælde:** Alle sammentællingsblokke, hvor minusset er en fast del af skabelonen
  frem for en egenskab ved tallet. Søg efter fradragslinjer, der sætter et bindestregspræfiks foran et
  `formatKr`-kald, i `src/components/pages` og `src/document/generators`.

**Tilbagemelding**
Jeg er enig.

**Udfald: RETTET (2026-08-28) – bredere end fundet, som en delt helper.**

Gennemgangen fandt **19 uvagtede fradragslinjer** på tværs af Forsørgertab, Erhvervsevnetab efter EAL,
Differencekrav og deres fire dokumentgeneratorer. BB-073 løste det med en inline ternary, gentaget to
steder; med 19 flere kaldssteder er `utils/deductionFormatting.ts` det rigtige – reglen kan ikke længere
glemmes på det tyvende.

**To detaljer, der ikke var åbenlyse:** vagten måler den AFRUNDEDE værdi, ikke råværdien, så en værdi som
`0,004` ikke får et minus foran et synligt nul. Og linjer, der formaterer selv (trimmet valuta med hårdt
mellemrum), måler mod DEN streng – ellers ville dokumentet kunne skrive «- 0 kr.», hvor skærmen skriver
«0 kr.», og fundets selvmodsigelse ville blot være flyttet ét lag ned.

### BB-131 – «(afrundet)» siger ikke til hvad, og regnestykket går ikke op

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** Årsløn `400.000`, skadeår 2020, beregningsår 2025.
- **Det sker:** EAL-panelet skriver «400.000 kr. x (100 % + 14,6699 %) (afrundet) = **458.500 kr.**»
  Det viste regnestykke giver `458.679,60`. Forskellen er afrundingen til nærmeste 500 kr., og det eneste,
  der siger det, er ordet «(afrundet)».
- **Det er uhensigtsmæssigt fordi:** Linjen er sat op som en formel, brugeren skal kunne efterregne –
  det er hele grunden til, at de udførlige mellemregninger står der. Når resultatet ikke følger af de
  viste operander, mister linjen sin funktion, og brugeren må lede efter en fejl, der ikke findes.
- **Bedre ville være:** «(afrundet til nærmeste 500 kr.)». Ét ord mere, og linjen kan efterprøves.
- **Andre steder det kan gælde:** Samme linje bygges af `eetEalCalculation`-familien og står også på
  **Erhvervsevnetab efter EAL**. Prøven er generel: tag hver linje, der viser en formel med et
  lighedstegn, og regn den efter på de viste tal.

**Tilbagemelding**
Jeg afviser fundet. Der er tale om professionelle brugere, som kender til afrundingsprincipperne for ydelsen. Det er ikke påkrævet at gengive, at afrunding sker til nærmeste 500.

**Udfald: AFVIST (2026-08-28). Ingen kodeændring.** Læren er den samme som BB-119's: en formel, hvis
afrundingsprincip er velkendt for målgruppen, behøver ikke gengive det. Ordet «(afrundet)» er nok. Foreslå
det ikke igen.

### BB-132 – Gangetegn og lighedstegn er ikke ensartede i formellinjerne

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** Udfyld en fuldstændig sag og læs ASL-panelet.
- **Det sker:** To ting i samme familie af linjer:
  1. Én linje bruger **begge** gangetegn: «Årlig ydelse i 2025-værdi: 30 % **x** 400.000 kr. **×**
     (632.000 / 551.000) =». Alle fladens øvrige formler bruger `x`.
  2. «Beregnet kapitalbeløb (137.640,65 kr. x 3,064)» mangler det afsluttende `=`, som alle sidens andre
     formellinjer har («Beregnet forsørgertab (…) =», «1.375.500 kr. - 220.080 kr. =»).

  Begge dele står ordret i dokumentet.
- **Det er uhensigtsmæssigt fordi:** To forskellige tegn for samme operation i samme sætning ser ud som
  om, de betyder noget forskelligt. Og en formel uden lighedstegn ved siden af fire formler med ét
  læses som ufærdig. Det er små ting, men de står i et papir, der skal fremstå som et regnskab.
- **Bedre ville være:** Ét gangetegn i hele programmet (`×` er det typografisk rigtige, `x` er det
  fladen mest bruger – valget er udviklerens), og et afsluttende `=` på alle formellinjer, der har et
  resultat i højre kolonne.
- **Andre steder det kan gælde:** `rg " × | x " src/components/pages src/document/generators` – tegnet
  bruges begge steder i flere generatorer.

**Tilbagemelding**
Jeg er enig.

**Udfald: RETTET (2026-08-28) – `x` valgt som programmets gangetegn.** 43 forekomster af `×` er erstattet i
skærm- og dokumentkanalen, herunder i den delte tekstbygger `eetKapitaliseringPresentation.ts`, som fødte
begge kanaler. Det afsluttende `=` er tilføjet på «Beregnet kapitalbeløb»-linjen begge steder plus en
tredje forekomst i `eetKapitaliseringRows.ts`, som rapporten ikke havde målt. Minustegnet `−` (U+2212) er
bevidst urørt – fundet handlede om gangetegnet.

### BB-133 – «Det beregnede forsørgertab skal ikke forhøjes, dvs. udgør» står over et beløb, der er sat NED

- **Type:** Fornuft
- **Rækkevidde:** Lokal (samme mellemregning bruges af Erhvervsevnetab efter EAL)
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Baggrund:** Fundet er en direkte følge af udviklerens svar på åbent spørgsmål 2 (2026-08-27):
  årslønnen har intet loft, men det **beregnede beløb** har – erstatningsansvarslovens loft for 30 %
  erhvervsevnetabserstatning, som programmet allerede indregner. Loftet er efterprøvet, det virker – og
  det er usynligt.
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `15-03-1975`, Skadedato `10-06-2020`.
  2. Forsørgertab: Beregningsdato `01-07-2025`, årsløn efter ASL `400.000`, Startdato for ASL-ydelse
     `10-06-2020`, Tilkendt for periode `10`, Efterladtes fødselsdato `20-08-1978`.
  3. Skadelidtes årsløn efter EAL: `4.000.000` – **præcis det, BB-118's paste-fejl laver ud af
     `400.000,00`**.
- **Det sker:** Tre linjer i træk:

  ```
  Beregnet forsørgertab (4.587.000 kr. x 10 x 30 %) =        13.761.000 kr.
  Mindste erstatningsniveau i beregningsåret 2025             1.182.500 kr.
  Det beregnede forsørgertab skal ikke forhøjes, dvs. udgør  11.052.000 kr.
  ```

  Beløbet er sat **ned** med `2.709.000 kr.` til årets loft, mens sætningen over det siger, at der ikke
  er sket noget. Loftet nævnes ikke med et tal, en overskrift eller en lovhenvisning – i modsætning til
  **minimum**, som har sin egen linje lige ovenfor. Målt ordret i både skærm, `.docx` og PDF.
- **Det er uhensigtsmæssigt fordi:** Det er ikke bare en manglende oplysning – sætningen er **usand** i
  netop den situation, hvor den står. Brugeren, der efterregner, finder `13.761.000 kr.` og møder
  `11.052.000 kr.` under en linje, der siger «skal ikke forhøjes»; der er intet at slutte af.
  Asymmetrien er tydelig, fordi den anden grænse gør det rigtige: minimumsniveauet får både en
  navngiven linje og en formulering om, hvorvidt det slår til. Loftet får ingen af delene.
- **Bedre ville være:** Loftet behandles som minimum – en egen linje «Højeste erstatningsniveau i
  beregningsåret 2025: 11.052.000 kr.», når det er relevant, og en tredelt afsluttende sætning:
  «… skal forhøjes til minimum» / «… skal nedsættes til maksimum» / «… skal ikke reguleres, dvs. udgør».
  Programmet bærer allerede svaret (`eetReduceretTilMaks`); det bliver blot ikke vist.
- **Andre steder det kan gælde:** Mellemregningen kommer fra den fælles `eetEalCalculation`-familie, som
  **Erhvervsevnetab efter EAL** (flade 11) bruger. Efterprøv, om EET viser reduktionen til maksimum, og
  om andre steder har en synlig min-grænse og en usynlig maks-grænse for samme tal.

**Tilbagemelding (indhentet 2026-08-28)**
Symmetri med minimum: loftet får sin egen linje, når det er relevant, og slutsætningen bliver tredelt.

**Udfald: RETTET (2026-08-28).** «Højeste erstatningsniveau i beregningsåret ÅÅÅÅ» vises, når loftet slår
til, og slutsætningen er tredelt: «… skal forhøjes til minimum» / «… skal nedsættes til maksimum» / «… skal
ikke reguleres, dvs. udgør». Bemærk, at den tredje form er ændret fra «skal ikke forhøjes»: sætningen skal
dække, at INGEN af de to grænser slog til, ikke kun minimum.

Begge tal fandtes allerede i beregningen (`eetMaksOre`/`eetReduceretTilMaks`) – de blev bare aldrig vist.
Teksten er samlet i `domain/forsoergertab/forsoergertabReguleringTekst.ts`, så skærm og dokument siger
nøjagtig det samme; de stod før som hver sin inline ternary.

### BB-134 – Rækken «Køn» siger ikke, hvis køn den spørger om

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Baggrund:** Fundet er, hvad der står tilbage af åbent spørgsmål 3, efter at udvikleren har afgjort
  (2026-08-27), at det er **skadelidtes** køn. **Min oprindelige antagelse om, at det var efterladtes,
  var forkert** – rækkens placering blandt skadelidtes oplysninger er altså korrekt, og det er kun
  navnet, der mangler.
- **Sådan fremprovokeres det:** Sæt Beregningsdato til en dato før `01-03-2015` og udfyld resten.
- **Det sker:** Rækken **«Køn»** dukker op i «Grundlæggende oplysninger» med pladsholderen «Vælg køn».
  Der står ikke, hvis køn, og fladen har to personer i sig – skadelidte og den efterladte ægtefælle
  eller samlever, hvis fødselsdato er et af fladens felter. I ASL-panelet gentages værdien som
  «Køn: Kvinde», og dér står den **under «Kapitaliseringsbekendtgørelse»**, altså midt i den blok, der
  ellers handler om efterladtes alder og folkepensionsalder. Læst forfra peger placeringen dér på den
  forkerte person.
- **Det er uhensigtsmæssigt fordi:** To fagfolk ville ikke nødvendigvis udfylde feltet ens, og et forkert
  køn skifter kapitaliseringstabel og dermed beløbet – uden at noget bliver rødt. Feltet vises kun for
  sager før 01-03-2015, altså netop de sager, brugeren sjældnest arbejder med og derfor mindst husker
  reglen for.
- **Bedre ville være:** Rækken hedder **«Skadelidtes køn»** begge steder – i indtastningen og i
  ASL-panelets gengivelse – i samme form som fladens øvrige rækker, der navngiver deres person
  («Skadelidtes fødselsdato», «Efterladtes alder på beregningsdatoen»). Dokumentets linje «Køn» følger med.
- **Andre steder det kan gælde:** Erhvervsevnetab har sit eget `koen`-felt
  (`erhvervsevnetabDescriptors.ts`); efterprøv, om det er navngivet entydigt dér.

**Tilbagemelding (indhentet 2026-08-28)**
«Skadelidtes køn» begge steder – i indtastningen og i dokumentet.

**Udfald: RETTET (2026-08-28).** Rækken hedder «Skadelidtes køn» på skærmen og i dokumentet, i samme form
som fladens øvrige rækker, der navngiver deres person.

## Overvejet uden fund

- **M-22 – usynlig dokumentafhængighed fra Stamdata: BESTÅET.** Isoleret målt: med en ren, gyldig sag og
  Stamdatas Fødselsdato sat til `99-99-9999` er intet felt på Forsørgertab rødt, knappen er grå med
  «Fejl i indtastning» – **men fladen viser årsagen inline** i rækken «Skadelidtes fødselsdato». Mønsterets
  betingelse («grå knap uden afsender») er ikke opfyldt. Knapteksten er «Fejl i indtastning» og ikke
  Årsløns «Ret fejlen i Stamdata», og det er korrekt: på Forsørgertab er fødselsdatoen en reel
  beregningsafhængighed, så fladens egen gate fyrer først. `blockedProjectionForStamdata` er derfor
  uopnåelig på denne flade – en ren kodeobservation uden brugerkonsekvens, fordi rækken bærer beskeden.
  Målt samtidig: **Satser er nu upåvirket** af samme fødselsdato (knappen aktiv), altså BB-080's rettelse
  i drift.
- **M-19 – rødt læses som tomt: BESTÅET.** Fladen er mønsterets eget forlæg. Både «Skadelidtes
  fødselsdato» og «Skadedato/Anmeldelsesdato» viser feltets egen fejltekst frem for «Mangler». Målt med
  `99-99-9999` og med en skadedato uden for Stamdatas interval. (Den manglende vej tilbage er BB-126.)
- **M-23 – aggregatet af-dublerer tiden: UDEN GENSTAND.** Fladen har ingen brugerredigeret periodetabel;
  ASL-tabellen er ren output, bygget år for år af motoren, og kan ikke rumme to ens rækker.
- **M-10 – flydende knap over indhold: BESTÅET, målt.** Ved 1536×864 ligger «Scroll til toppen» på
  x = 1450,7–1505,0, og indholdssøjlen slutter ved x = 1446,2. Ingen overlapning; fladen lægger heller
  intet betjenbart i nederste højre hjørne.
- **Tabellens tal går op.** Løbende ydelser: `10.000 × 6,7000 = 67.000`, `10.236 × 12 = 122.832`,
  `11.471 × 6,0323 = 69.197` – og summen `643.653 kr.` svarer til de seks rækker. Den månedlige ydelse er
  altid et helt kronebeløb, fordi årsydelsen oprundes til nærmeste 12 (`ceilNearest12`); det er et bevidst
  valg, der gør «vist × vist = vist» sandt hele vejen.
- **Øvrige mellemregninger er kontrolregnet og er i orden:** opreguleringen
  `0,3 × 400.000 × (632.000 / 551.000) = 137.640,65`, kapitalbeløbet `137.640,65 × 3,064 → 421.731`
  (oprundet), EAL-kravet `458.500 × 10 × 30 % = 1.375.500`, aldersreduktionen `16 %` af `1.375.500` =
  `220.080`, og nettokravet `1.155.420 - 643.653 - 421.731 = 90.036`. **Ingen af de seksten fund handler
  om en forkert formel.**
- **Skærm mod dokument er ellers enige.** Alle beløb, procenter, datoformater og tabelrækker er ordret
  identiske i de fire hentede `.docx`-udgaver. De to afvigelser er registreret som BB-122 (den manglende
  skadedato) og BB-123 (EAL-årslønnens navn).
- **Tab-ringen er komplet og cirkulær:** Beregningsdato → Indsæt dags dato → downloadknappen →
  årsløn (ASL) → Startdato for ASL-ydelse → Tilkendt for periode → Efterladtes fødselsdato →
  årsløn (EAL) → forfra. Rækkefølgen følger den visuelle.
- **«Indsæt dags dato» virker og beholder fokus** på den aktiverede knap (BF-056), og knappen er inaktiv
  med begrundelse, hvis dags dato ligger uden for datadækningen (BB-068's mønster er implementeret her).
- **Undo/redo og navigation:** Ctrl+Z/Ctrl+Y fortryder og gentager «Indsæt dags dato» korrekt, og alle
  syv værdier overlever navigation til en anden side og tilbage.
- **Dependency-gaterne er præcise.** En rød EAL-årsløn bevarer ASL-panelet, og en rød ASL-årsløn
  blokerer også EAL-delen – korrekt, fordi ASL-årslønnen er EAL-motorens fallback. Målt begge veje.
- **Køn-feltets gate er i orden:** når beregningsdatoen ligger før 01-03-2015 og Køn er tomt, er
  downloadknappen grå med «Indtastning mangler», og feltet er synligt med pladsholderen «Vælg køn».
  Værdien bevares, når feltet skjules igen. (Feltet spørger om **skadelidtes** køn – afgjort
  2026-08-27; at rækken ikke siger det, er BB-134.)
- **De to døde `color="text.secondary"`-props** i `ForsoergertabOplysningerSection.tsx` (M-21's navngivne
  kandidat) er efterprøvet og er **ikke** et fund: de ville nedtone netop «Mangler»- og fejlteksterne, og
  BB-067's afvisning siger, at en nedtoning skal gøre oplysningen lettere at opdage, ikke sværere.
- **Beløbsfelterne afviser decimaler ved tastning** efter den etablerede regel; ørerne i en indsat værdi
  er derimod BB-118.
- **Fladen har hverken kommentarfelt eller «Slet alle indtastninger»** – begge findes kun på
  Renteberegning og er dér knyttet til den delte MinProcesrente-fane. Ingen inkonsistens.
- **Konsollen var tavs gennem hele kørslen:** 199 beskeder, 0 fejl, 0 advarsler.

## Dækningshuller

- Kun Chrome, lyst tema, 1536×864. Ingen måling ved 1244×620 eller i de tre øvrige motorer.
- **PDF-kanalen er læst 2026-08-27** (BB-133's kørsel) og er **ordret identisk med skærmen og med
  `.docx`** for hele dokumentet. Sidebrud og tabelbredder er stadig ikke bedømt visuelt.
- **`Gem`/`Hent` er ikke afprøvet** – filvælgeren kan ikke betjenes headless (samme hul som BB-049).
- **Brevhovedet er ikke slået til** i nogen af kørslerne; dokumenternes brevhoved-linjer er derfor ikke set.
- BB-118's paste er sendt som en syntetisk `ClipboardEvent` med `DataTransfer`, ikke gennem systemets
  udklipsholder. Tastet input gav samme resultat (`400000,50` → `4.000.005`), så mekanismen er dobbelt målt.
- Sammenligningen af downloadknappens tekst med **Årsløns** «Ret fejlen i Stamdata» er ikke målt side om
  side (Årsløn stod uden data i kørslen); Forsørgertabs egen tekst og dens årsag er derimod målt og
  kodeverificeret.

## Åbne spørgsmål

### 1. Hvor mange måneder er allerede udbetalt? · ÅBENT – afventer udviklerens afgørelse

Udvikleren har bedt om de nøjagtige indtastningsværdier. De står her, sammen med de tal, sagen giver,
og en kvantificering af, hvad det andet svar ville koste.

**Sagen, der skal indtastes**

| Side | Felt | Værdi |
|---|---|---|
| Stamdata | Skadelidtes fødselsdato | `15-03-1975` |
| Stamdata | Skadestype | **tom** (ikke Erhvervssygdom) |
| Stamdata | Skadedato | `10-06-2020` |
| Forsørgertab | Beregningsdato | `01-07-2025` |
| Forsørgertab | Skadelidtes årsløn (efter ASL) | `400000` |
| Forsørgertab | Startdato for ASL-ydelse | `10-06-2020` |
| Forsørgertab | Tilkendt for periode | `10` |
| Forsørgertab | Efterladte ægtefælle/samlevers fødselsdato | `20-08-1978` |
| Forsørgertab | Skadelidtes årsløn efter EAL | **tom** |

Journalnr., Advokat, Sagsbehandler og Skadelidte er uden betydning for tallene. Rækken «Køn» vises ikke,
fordi beregningsdatoen ligger efter 01-03-2015. Sagen giver «Forsørgertabserstatning **90.036 kr.**»

**De to tal, der ikke stemmer overens**

Tabellen «Løbende ydelse» viser månederne dag for dag:

| Fra-dato | Til-dato | Måneder |
|---|---|---|
| 10-06-2020 | 31-12-2020 | 6,7000 |
| 01-01-2021 | 31-12-2021 | 12,0000 |
| 01-01-2022 | 31-12-2022 | 12,0000 |
| 01-01-2023 | 31-12-2023 | 12,0000 |
| 01-01-2024 | 31-12-2024 | 12,0000 |
| 01-01-2025 | 01-07-2025 | 6,0323 |
| | **I alt** | **60,7323** |

Fire linjer længere nede står «Resterende periode: **4 år og 10 måneder**», altså **58 måneder** af de
120 tilkendte – hvilket forudsætter, at **62 måneder** er udbetalt. De 62 fremkommer ved at tælle hele
kalendermåneder inklusive begge ender: juni 2020 til og med juli 2025.

**De to læsninger er begge sammenhængende, og det er derfor spørgsmålet stilles**

- **Betalingstælling (det programmet gør nu):** ydelsen udbetales månedsvis, og der er faldet 62
  månedsudbetalinger fra juni 2020 til og med juli 2025. Så er 58 tilbage. Konsistent, hvis de 10 år ses
  som 120 månedlige udbetalinger.
- **Optjeningstælling (det tabellen gør):** ydelserne værdiansættes dag for dag og standser midt i juli
  2025 med 6,0323 måneder i 2025. Så er 120 − 60,7323 = **59,2677** tilbage.

**Fladens to halvdele bruger i dag hver sin læsning.** Under betalingstællingen burde tabellen tælle hele
juli 2025 med; under optjeningstællingen burde den resterende periode være 59,2677 måneder.

**Hvad forskellen koster (tabel H, alder 46, Vejl. 10029/2024: 4 år = 2,528 · 5 år = 3,171)**

| Læsning | Resterende | Kapitalfaktor | Kapitalbeløb | Forsørgertabserstatning |
|---|---|---|---|---|
| Betalingstælling (i dag) | 58 mdr = 4 år 10 mdr | `2,528 + 0,643 × 10/12` = **3,064** | **421.731 kr.** | **90.036 kr.** |
| Optjeningstælling | 59,2677 mdr | `2,528 + 0,643 × 11,2677/12` = **3,132** | 431.091 kr. | 80.676 kr. |
| (afrundet til hele mdr.) | 59 mdr = 4 år 11 mdr | `2,528 + 0,643 × 11/12` = **3,117** | 429.026 kr. | 82.741 kr. |

Forskellen er **9.360 kr.** i kapitalbeløbet i den målte sag.

**Rettelse til min oprindelige formulering:** jeg skrev, at optællingen af hele kalendermåneder er
«systematisk i skadelidtes disfavør», og det er forkert – fortegnet vender den anden vej. Kapitalbeløbet
**trækkes fra** kravet, så flere talte udbetalte måneder giver et mindre kapitalbeløb og dermed en
**større** forsørgertabserstatning. Den nuværende læsning er altså den gunstigste af de to for
efterladte. Jeg skrev også «i størrelsesordenen 14.000 kr.» som et skøn; det efterregnede tal er
9.360 kr.

**Spørgsmålet er dermed:** skal de to halvdele bringes til at bruge samme læsning – og i givet fald
hvilken? Beregningen er ikke rørt.

### 2. Skal EAL-årslønnen have et loft eller et rimelighedssignal? · AFGJORT 2026-08-27 – NEJ

**Udviklerens svar:** skadelidtes årsløn har ikke et loft. Der er derimod et loft på, hvad både det
maksimale og det minimale **beregnede beløb** kan udgøre. Loftet svarer til loftet for 30 %
erhvervsevnetabserstatning efter EAL, som programmet allerede indregner, og mindstebeløbet for
forsørgertab beregnes automatisk efter de årlige takster.

**Efterprøvet, og præmissen holder.** `erhvervsevnetabEalMax[2025] = 11.052.000 kr.` anvendes i
`eetEalCalculation.ts` (`eetReduceretTilMaks` / `eetAnvendtOre`), og `foersoergertabEalMin[2025] =
1.182.500 kr.` som minimum. Målt i drift: en EAL-årsløn på `4.000.000 kr.` giver et beregnet beløb på
`13.761.000 kr.`, som sættes ned til `11.052.000 kr.` **Feltet skal derfor ikke have et loft eller en
advarsel, og M-05's spor er lukket for dette felt.**

**Men efterprøvningen afdækkede et nyt fund, som svaret gør synligt: BB-133.** Loftet virker – og det er
usynligt. Sætningen over det reducerede beløb siger «Det beregnede forsørgertab skal **ikke forhøjes**,
dvs. udgør», mens minimum har sin egen navngivne linje. Se fundet ovenfor.

### 3. Hvis køn spørger rækken «Køn» om? · AFGJORT 2026-08-27 – SKADELIDTES

**Udviklerens svar:** det er skadelidtes køn, ikke den efterladtes.

**Min antagelse var forkert, og det er værd at skrive ned hvorfor.** Jeg sluttede «efterladtes» af
mekanikken: tabelrækkerne slås op på **efterladtes** alder (`calculateAgeYearsMonths(efterladteFodselsdato,
beregningsdato)`), og den kønsopdelte variant vælges i samme opslag – så jeg læste kønnet som hørende til
samme person som alderen. **Læren er generel og hører til M-11's familie: en parameters ejer kan ikke
udledes af, hvilket opslag den indgår i.** Et opslag kan blande to personers oplysninger, og hvem en
værdi tilhører, er en domæneoplysning, ikke en kodeoplysning – den skal spørges om, ikke gættes.

**Konsekvensen for fladen:** rækkens **placering** blandt skadelidtes oplysninger er dermed korrekt og
skal ikke flyttes. Tilbage står, at rækken ikke siger, hvis køn den spørger om, og at ASL-panelets
gengivelse står under «Kapitaliseringsbekendtgørelse», hvor den læses som efterladtes. Det er skrevet
op som **BB-134** (Lav) ovenfor.
