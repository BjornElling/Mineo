# Brugerblik – Indstillinger

## Fornyet gennemgang – 2026-11-11

**Gennemgået. Nye fund: 2 – én Fejl med prioritet Høj og ét Fornuft-fund med prioritet Mellem.**
Commit `1517f1a7` samt eksisterende ændringer i Brugerblik-materialet. Produktet er ikke ændret.
Afprøvet med projektets Playwright CLI i Chrome og Firefox, headless, mod egen Vite-server på
`127.0.0.1:3001`; synligt login. Chrome: 1536×864 og 1366×620; Firefox: 1536×864.
Fornuftsblikket A1–A8 og relevante prøver B0–B7 er gennemgået. Første gennemgangs afgørelser er
historisk grundlag nedenfor; BB-023, BB-025, BB-026, BB-027 og BB-029 genåbnes ikke.

### Inventar, grænser og afhængigheder

Fire bokse med 25 betjeningspunkter i produktion, når hver radiogruppe regnes som ét valg og hver
brevhoved-checkboks som ét punkt. DEV har desuden «Farvemarkering af font-styles».

| Område | Kontroller og tilstande |
|---|---|
| System | Farvetema: Lyst/Mørkt/Følg computeren, standard Følg computeren. Mappe: standard/valgt/utilgængelig/indlæser, Vælg mappe og betinget Nulstil. Dokumentformat: PDF/Word, standard PDF. Ni uafhængige brevhovedvalg for Erstatningsopgørelse, Erhvervsevnetab, Varige mén, Forsørgertab, Årslønsberegning, Renteberegning, Satser, SH-dage og Regulering. |
| Standardværdier, TAF | Løn indtastes som: Måned/Uge/Dato, standard Måned. Fuld løn under ferie: til/fra, standard til. Løn på helligdage: Almindelig løn/SH-udbetaling/Ingen, standard Almindelig løn. To organisationsfiltre med Alle samt katalogets navne, standard Alle; tidligere gemte organisationsnavne bevares også som valg. |
| Standardværdier, øvrige | Delvis sygemelding: Fuld sats/Halv sats, standard Halv sats. Udkast-stempel: til/fra, standard til. Bilagsnumre: til/fra, standard fra. Afslutning: Bekræftet godkendt/Underskrift-linje/Ingen, standard Bekræftet godkendt. |
| Beregningsteknisk | Udløbstolerance: heltal 0–12 måneder, standard 6. Tillad regulering ved udløb før TAF-slut: til/fra, standard fra. |
| Kontrol | Rapportknapper og kontrolfaner: hver til/fra, begge standard fra. DEV-kontrollen er ikke en produktionsindstilling. |

Ingen fritekst, datoeditor, brugeroprettede rækker eller åbne drafts på selve siden. Valgmængderne
afgrænser input; B0 giver derfor ingen manglende tal-/tekstgrænse. Organisationsfiltrenes åbne
lagringstype er en bevidst bevarelse af tidligere valg, ikke en fri teksteditor. Ingen lokal
«tom række» eller dokumentknap. Alle synlige valg har en værdi også i en ny sag; de er ikke i sig
selv sagsindtastninger. Sagens tomhed sammenlignes med ny-sags-grundlaget, ikke med disse flueben.

Valgene gemmes på computeren/browseren og er uden for `.eo` og undo/redo. Standardværdier anvendes
ved ny sag/nyt ansættelsesforhold, mens format, brevhoved, tema, kontrolvisning og de to
beregningstekniske valg virker på den aktuelle visning eller næste dokument. Dette er de tidligere
accepterede forskelle, ikke nye fund. Forbrugerne er sporet gennem `AppSettingsContext`,
`sourceSettings`, ny-sags-seeds, ansættelsesforholdets fabrik og `eoRowIndkomstRows`.

### BB-390 – Et valg i en anden browserfane nulstiller allerede gemte indstillinger

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-44--en-gammel-kopi-overskriver-et-nyere-uvedkommende-valg`
- **Prioritet:** Høj
- **Beslutning:** Godkendt til rettelse 2026-11-11; implementeret i fælles indstillingslag.
- **Sådan fremprovokeres det:**
  1. Åbn Mineo i to faner, A og B, og gå til Indstillinger i begge. Temaet er Følg computeren.
  2. Vælg Mørkt i A.
  3. Slå Bilagsnumre i erstatningsopgørelser til i B.
  4. Genindlæs A.
- **Det sker:** A viser først stadig Mørkt, mens B viser Følg computeren. Efter B's bilagsvalg
  er det gemte tema igen `system`; efter genindlæsning viser også A Følg computeren. Mørkt er
  forsvundet, selv om ingen har ændret temaet tilbage. Bilagsvalget er bevaret. Ingen besked,
  console-fejl eller advarsel. Forløbet er målt i to samtidige Chrome-faner.
- **Det er uhensigtsmæssigt fordi:** Brugeren kan arbejde på to sager og miste sine seneste valg
  ved at ændre noget helt andet. Samme skrivning omfatter også dokumentformat, brevhoveder og
  tolerancen for udløbne reguleringstabeller. Dermed kan følgerne række ud over udseendet;
  tema-forløbet er den browsermålte forekomst, de øvrige følger er sporet i koden.
- **Bedre ville være:** Vis de seneste programindstillinger i alle åbne faner. Ændring af
  bilagsnumre skal bevare det senest valgte farvetema og alle øvrige valg; ændres samme valg to
  gange, gælder det seneste aktive valg.
- **Andre steder det kan gælde:** Om-sidens startsidevalg bruger samme indstillingslag. Alle ni
  brevhovedvalg og begge beregningstekniske kontroller er konkrete kandidater til samme prøve.
  Dette er ikke BB-025 om ryddet/ødelagt browserlager: her nulstiller almindelig brug et gyldigt,
  allerede gemt valg.

### BB-391 – Mappeknappen får en normal browserbegrænsning til at ligne en kodefejl

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-45--en-forventet-browserbegraensning-omtales-som-en-kodefejl`
- **Prioritet:** Mellem
- **Beslutning:** Godkendt til rettelse 2026-11-11; mappevalg følger browserunderstøttelsen.
- **Sådan fremprovokeres det:** Åbn Indstillinger i Firefox, og klik Vælg mappe.
- **Det sker:** Knappen er aktiv og har tooltippen «Vælg mappe». Der åbnes ingen mappevælger;
  placeringen bliver ved med at være «Skrivebord (standard)». I stedet vises den globale boks
  «Teknisk advarsel registreret», som siger «Der er fundet en fejl i den underliggende kode» og
  beder brugeren gennemgå sine beregninger grundigt. Først under tekniske detaljer ligger årsagen
  `showDirectoryPicker ikke tilgængelig i denne browser`. Målt i en rigtig Firefox-runtime, hvor
  API'et er fraværende, uden at ændre browserens egenskaber. Én console-advarsel pr. klik, ingen
  page-fejl; gentaget klik og åbning af tekniske detaljer bekræfter samme årsag.
- **Det er uhensigtsmæssigt fordi:** Et tilbud om at vælge en mappe kan slet ikke bruges i denne
  browser. Svaret udpeger kode og beregninger som mistænkelige i stedet for at forklare den
  konkrete begrænsning. Brugeren kan hverken reparere noget eller gennemføre det lovede valg.
- **Bedre ville være:** Vis Vælg mappe inaktiv i browsere uden mappevalg, med tooltippen
  «Denne browser understøtter ikke valg af en fast mappe til gemte filer.» Bevar placeringens
  visning. Det skal ikke udløse en teknisk advarsel om kode eller beregninger.
- **Andre steder det kan gælde:** Manglende eller fejlende persistent storage i
  `fileHandleStorage.ts`, browserafvisning af mappevælgeren i `useDefaultDirectorySetting.ts` og
  forkert filendelse i Gem-vælgeren i `fileSystemAccess.ts`. Kandidaterne er kun kildeundersøgt.
  M-12 passer ikke her: problemet er et ubrugeligt tilbud og forkert fejlklasse, ikke manglende
  kvittering for en indstilling eller manglende vej tilbage til et tidligere valg.

### Efterprøvet og overvejet uden yderligere fund

- **Valgkontroller:** Alle checkbokse/toggles og radiogrupper aktiveret og gendannet; alle seks
  dropdowns åbnet og sammenholdt med valgmængden. Ingen mislykkede kontrolskift i de 38 aflæsninger.
- **Dropdown-grænser:** Valg af 0, 12 og 6 måneder, yderste katalogvalg og tilbage; Escape uden
  valg bevarer værdien. Delete rydder ikke de obligatoriske valg, og felterne er read-only.
- **Farvetema:** Følg computeren følger mørkt/lyst live; et eksplicit Lyst forbliver lyst ved
  mørk systempræference. Der ventes på den faktisk malede tilstand før aflæsning.
- **Tastatur:** Tab passerer mappevalg, format, alle ni brevhoveder, standardværdier og kontrolvalg
  i visningsrækkefølge og cirkulerer tilbage til temaet. Radiogrupper har ét stop hver.
- **Standarder på eksisterende sag:** Ændret svie/smerte-standard til Fuld sats lader den åbne
  sags Halv sats stå. Det er den tilsigtede adfærd fra BB-023.
- **Ny sag:** Efter Slet alt står afslutning til Underskrift-linje, udkast fra, bilagsnumre til og
  delvis sygemelding til Fuld sats; Årsløn står til Uge. Det svarer til de valgte nye standarder.
- **Nyt ansættelsesforhold:** Uge, Ingen løn på helligdage samt filtrene 3F/KL vises på det nye
  kort. Fuld løn under ferie er sporet til samme fabrik; den betingede kontrol er ikke særskilt
  browsermålt i en færdig overenskomstsag.
- **Kontrolfaner:** Tilvalget viser EO-kontrol/Kontroltabel. Fravalg efter besøg på EO-kontrol
  fører ved tilbagevenden til EO oplysninger; der efterlades ingen aktiv, skjult kontrolfane.
- **Rapportknapper:** Tilvalg viser straks fire rapportknapper på Indstillinger; fravalg skjuler
  dem igen. Ingen rapport sendt.
- **Sagsinput og undo/redo:** Navnet «Brugerblik Indstillinger prøvesag» og afsluttet ugyldig
  Skadedato `31-02-2026` bevares gennem indstillingsskift. Ctrl+Z fra Indstillinger fører til
  Stamdata og rydder datoen; Ctrl+Y genskaber den. Bilagsstandardens fravalg forbliver fravalgt.
- **Dokumentformat:** Firefox henter rigtige filer som `Arbejdsskadesatser 2026.pdf` og
  `Arbejdsskadesatser 2026.docx`, begge uden downloadfejl; knappens navn følger formatet.
  Ingen fuld dokument-layoutkontrol er udledt af filnavne eller vellykket download.
- **Layout:** Lyst tema ved 1536×864 og 1366×620 samt mørk visning er screenshot-inspiceret;
  ingen vandret overflow eller felter ud over højre kant i de målte viewporter.
- **Konsol:** Ingen nye `console.error` eller ukontrollerede page-fejl. Chrome-opsamlingen har
  ingen eksterne requests. Firefox har to advarsler fra de to klik på mappeknappen i BB-391 og
  ingen andre opsamlede console-advarsler; dette er ikke talt som en fejlfri kontrol.

### Dækningshuller og videre spor

- Native valg/nulstilling af en rigtig mappe og mistet mappetilladelse er ikke afprøvet headless;
  standardtilstanden er set, de øvrige tilstande er læst i resolver/hook. BB-036's Nulstil-fokus
  er derfor ikke genmålt på en faktisk valgt mappe.
- Udkast, bilagsnumre og alle ni brevhoveder er kontrolleret som valg og sporet til forbrugerne,
  men ikke renderet og sammenlignet i samtlige færdige PDF-/Word-dokumenter. Satser-downloads
  ovenfor lukker kun formatsporet. Ingen ny fuld `.eo`-round-trip i denne gennemgang.
- 0/12-månedersvalg og tilladelses-toggle er set på siden; deres severity-skift og de tidligere
  nævnte kontroltekster kræver en færdig sag med passende reguleringsdækning. De er fortsat
  opfølgning ved Erstatningsopgørelse, ikke nye fund om reglernes rigtighed.
- Edge og WebKit er ikke kørt; BB-391 er bekræftet i Firefox, ikke blot antaget for andre browsere.
- Evidens ligger lokalt i `test-results/brugerblik-indstillinger/`: browserprøvescripts,
  `firefox-mappe.png`, `layout-1366.png`, `layout-1536.png`, `chrome-moerkt.png` og de to downloads.
  Mappen er ignoreret af Git. Ingen test-, lint- eller build-gate kørt, fordi produktkode og tests
  ikke er ændret; kun rapporter. `git diff --check` bestået. Build-info er genereret for at starte
  udviklingsserveren. Egne browser- og serverprocesser er lukket efter gennemgangen.

### Rettelse – 2026-11-11

Udvikleren har bedt om at rette begge nye fund og afslutte med commit.

- **BB-390:** Alle indstillingshandlinger sender kun de aktivt ændrede felter, også det enkelte
  brevhovedvalg. Fælleslaget fletter dem ind i senest gemte snapshot og serialiserer samtidige
  skrivninger med Web Locks i understøttede browsere. Storage-events opdaterer åbne faner uden
  tilbageskrivning; gamle events kan ikke rulle nyere valg tilbage. Lagerfejl bevarer valgene i
  hukommelsen. Ingen ændring af lagernøgle, gemt format, `.eo` eller beregningsregler.
- **BB-391:** «Vælg mappe» er inaktiv uden browserunderstøttelse og viser den foreslåede tooltip.
  Placeringens visning bevares, og manglende mappevalg udløser ingen teknisk advarsel.
- Regressionstests gengav begge fund før rettelsen. De 104 målrettede Vitest-tests består.
  19 browserprøver består på det nybyggede E2E-artefakt: indstillingsforløb og eksisterende
  skalerings-/kontrolforløb, med browserafhængige prøver i Chrome, Edge, Firefox og WebKit.
  Faneskrivning er desuden gentaget tre gange; testen holder skriveadgangen tilbage, køer to
  uafhængige brevhovedvalg og afventer derefter begge skrivninger før kontrol af lager og UI.
  Ingen nye runtimefejl eller advarsler. Firefox-skærmbilledet med inaktiv mappeknap og tooltip
  er gennemset ved 1536×864. Egne browser- og serverprocesser er lukket.
- **Slutkontrol:** Fuld Vitest-suite består med 1.041 filer og 11.163 tests. Kildetyper,
  testtyper, E2E-typer, build-konfigurationens typer, lint, LF-kontrol og `git diff --check`
  består. Et uafhængigt kode- og testreview er godkendt. E2E-forløbet byggede og kontrollerede
  begge apps; ingen separat release-build er nødvendig. Afhængighedstjek er udeladt, fordi
  ingen pakker eller manifester er ændret; browserkontrollen bruger de relevante baner frem for
  den fulde 4×4-matrix.

**Åbne beslutninger:** Ingen om BB-390 og BB-391. De kildeundersøgte kandidater er fortsat spor,
ikke bekræftede nye fund eller ændret fejlklassificering.

## Første gennemgang – historik

- Rute/placering: `/indstillinger`
- Gennemgået: 2026-08-18 · commit `a8d2b13c`
- Afprøvet i: Chrome (playwright-cli), 1536×864 – designmålet, jf. M-09

## Fladen kort

Fladen samler programmets device-lokale indstillinger i fire bokse: **System** (farvetema,
filplacering, download-format, brevhoveder), **Standardværdier** (defaults til nye sager),
**Beregningsteknisk** (to regel-toggles) og **Kontrol** (to visnings-toggles, plus en DEV-only).
I alt tyve rækker.

Fladen er usædvanlig på ét afgørende punkt: **ingen af dens værdier er sagsdata.** De gemmes i
`localStorage`, følger ikke med en `.eo`-fil og deles ikke med en kollega. Det gør fladen til det
eneste sted i programmet, hvor brugerens indtastning hverken kan gemmes, hentes eller fortrydes –
og hvor virkningen af et valg som regel indtræffer et helt andet sted, på et helt andet tidspunkt.

Netop dét er kilden til hovedparten af fundene nedenfor. Hver enkelt kontrol virker efter hensigten;
det, der mangler, er fladens svar på brugerens uundgåelige spørgsmål: *hvad skete der lige nu, og
hvornår kan jeg se det?*

## Fund

### BB-023 – «Standardværdier» slår ikke igennem på den sag, brugeren har åben

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-12--en-indstilling-uden-synlig-virkning`
- **Prioritet:** Høj
- **Beslutning:** Afvist 2026-08-18 – se afgørelsen under **Tilbagemelding** nedenfor.
- **Sådan fremprovokeres det:**
  1. Åbn en sag, og gå til Erstatningsopgørelse. Feltet «Erstatningsopgørelse afsluttes med» står
     på «Bekræftet godkendt».
  2. Gå til Indstillinger → Standardværdier → «Opgørelse afsluttes med», og vælg «Underskrift-linje».
  3. Gå tilbage til Erstatningsopgørelse.
- **Det sker:** Feltet står stadig på «Bekræftet godkendt». Indstillingen er gemt – den slår først
  igennem på den *næste* nye sag. Målt: efter «Slet alt» viser feltet «Underskrift-linje».
  Fladen siger intet om dette hverken før, under eller efter valget.
- **Det er uhensigtsmæssigt fordi:** Brugeren, der lige har ændret en indstilling for at rette den
  sag, han sidder med, konkluderer rimeligvis at indstillingen ikke virker. Han går tilbage og
  ændrer den igen, eller han retter feltet manuelt i sagen og efterlader indstillingen forkert.
  Ordet «Standardværdier» er teknisk korrekt, men det besvarer ikke spørgsmålet «standard for
  hvad – og fra hvornår?». Alle ni indstillinger under overskriften deler dette forhold.
- **Bedre ville være:** Én forklarende linje under sektionsoverskriften «Standardværdier», fx
  *«Gælder nye sager og nye rækker. Den sag, du har åben nu, ændres ikke.»* Det er den mindste
  rettelse, der fjerner hele misforståelsen, og den kræver ingen ændring af adfærden.
- **Andre steder det kan gælde:** «Beregningsteknisk»-boksens to toggles har den modsatte egenskab
  – de virker *straks* på den åbne sag (de flytter validerings-severity fra error til warning).
  To nabobokse med modsat tidspunkt for virkning, ingen af dem forklaret.

**Tilbagemelding**
De beskrevne forhold afspejler nøjagtig, hvad en professionel bruger vil forvente. Standardindstillinger er netop dette - standarder for nye sager (og efter Slet alt). De to beregningstekniske toggles er omvendt udtryk for hvilken tolerancegrænse, brugeren vil acceptere i forhold til beregningstekniske forhold, og brugeren vil forvente, at det slår igennem straks. Alt er, som brugeren forventer.

**Afgjort 2026-08-18 – AFVIST. Ingen ændring.** Præmissen holdt ikke: fundet behandlede de to
tidspunkter for virkning som en inkonsistens, der skulle forklares, men for en fagperson er de
begge de forventede. «Standardværdier» betyder standarder for nye sager – det er, hvad ordet siger –
og en tolerancegrænse, man netop har sat, skal virke nu. Den forklarende linje ville altså have
forklaret noget, der ikke er overraskende.

Konsekvens for senere flader: **spørgsmålet «hvornår slår denne indstilling igennem?» er lukket**
som generel indvending. Det, der stadig tæller, er, hvis et valg får en virkning, der *modsiger*
dets egen etiket – ikke at virkningen indtræffer på det tidspunkt, etiketten lægger op til.
Mønsteret er skrevet om efter dette (`TVAERGAAENDE.md` M-12).

**Opfølgende spørgsmål 1 (rejst ved gennemgangen, tidligere under «Åbne spørgsmål»).** **Skal
«Standardværdier» kunne anvendes på den åbne sag?** BB-023 foreslår kun en forklarende
linje, fordi kontrakten er entydig: defaults må aldrig overskrive en igangværende sag. Men det
efterlader et reelt behov ubesvaret – brugeren, der opdager midt i en sag, at han vil have
underskrift-linje i stedet for godkendelse, skal rette feltet manuelt inde i sagen. Er det den
rigtige arbejdsgang, eller mangler der en «anvend på denne sag også»-mulighed? Spørgsmålet er
rent brugervendt; kontraktens forbud gælder det automatiske, ikke det brugeren udtrykkeligt beder om.

**Tilbagemelding**
Nej, aldrig. Standardværdier er kun for nye sager og efter 'Slet alt'.

**Afgjort 2026-08-18 – LUKKET.** Ingen «anvend på denne sag også»-mulighed, hverken automatisk eller
som en handling brugeren beder om. Kontraktens forbud i `app-settings.md` er dermed ikke kun teknisk
begrundet, men også den ønskede brugeradfærd: de to veje ind i en sag er ny sag og «Slet alt», og
der kommer ikke en tredje. **Genåbn ikke.**

**Opfølgende spørgsmål 2 (rejst ved gennemgangen, tidligere under «Åbne spørgsmål»).** **Bør de fire
bokse sige, hvornår deres indhold virker?** Fladen rummer i dag tre forskellige
tidspunkter for virkning: straks («System», «Kontrol»), straks på den åbne sag men kun for
validering («Beregningsteknisk»), og først ved næste nye sag («Standardværdier»). De tre er
umulige at skelne fra rækkerne selv. Skal hver boks have én linje, der siger hvornår – eller er
det at fylde fladen med tekst for en forskel, de færreste støder på?

**Tilbagemelding**
Nej, de følger den forventelige og mest naturlige adfærd, som brugeren vil regne med.

**Afgjort 2026-08-18 – LUKKET.** Ingen forklarende linjer i nogen af de fire bokse. Sammen med
BB-023 lukker dette hele «fladen bør sige hvornår»-sporet. Fundene fra en senere flade skal derfor
ikke foreslå forklarende tekst om tidspunktet for en indstillings virkning.

### BB-024 – Farvetemaet kan ikke stilles tilbage til at følge computeren

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-08-18 – se afgørelsen under **Tilbagemelding** nedenfor.
- **Sådan fremprovokeres det:**
  1. Åbn Mineo første gang på en computer indstillet til mørkt tema. Mineo starter i mørkt tema.
  2. Vælg «Lyst» på Indstillinger.
  3. Forsøg at komme tilbage til det, programmet gjorde af sig selv.
- **Det sker:** Det er ikke muligt. Ved allerførste start følger Mineo computerens indstilling
  (`prefers-color-scheme`), men i det øjeblik brugeren vælger enten «Lyst» eller «Mørkt», er valget
  frosset. Skifter computeren senere til mørkt om aftenen, følger Mineo ikke med. De to
  radioknapper viser to tilstande, men programmet har reelt tre.
- **Det er uhensigtsmæssigt fordi:** Brugeren, der har en computer, som skifter tema automatisk
  morgen/aften, mister den automatik permanent ved et enkelt klik – uden nogen vej tilbage og uden
  at være advaret om, at valget var en engangsbeslutning. Han kan kun genskabe automatikken ved at
  rydde browserens lagring, hvilket samtidig sletter alle hans øvrige indstillinger.
- **Bedre ville være:** En tredje valgmulighed «Følg computeren», som er den valgte fra start.
  Så svarer de tre knapper til de tre tilstande, programmet allerede har.
- **Andre steder det kan gælde:** Ingen – dette er det eneste sted, en systempræference bruges som
  startværdi.

**Tilbagemelding**
Du har en god pointe. Jeg vil gerne have indføjet en tredje valgmulighed, som står efter Lyst og Mørkt, som skal være default, og hedde noget i stil med "Følg computer" eller noget andet i den stil - du bestemmer formuleringen. Og denne skal være default, indtil brugeren vælger andet. 

**Afgjort 2026-08-18 – ACCEPTERET. Gennemført.**

Valgt formulering: **«Følg computeren»** – bestemt form, fordi det er brugerens egen maskine, der
tales om, og ikke computere i almindelighed. Står sidst i rækken efter «Lyst» og «Mørkt» som ønsket,
og er standarden.

Gennemført sådan (den vigtige del er, at det ikke kun er en knap mere):

- `themeMode` er nu tre-værdig (`'light' | 'dark' | 'system'`) med `'system'` som default. **Men det
  malede tema er stadig to-værdigt**, og de to begreber er adskilte typer: `AppThemeMode` (valget)
  og `ResolvedThemeMode` (udfaldet). `buildTheme`, `data-mineo-theme` og browser-chromens farve
  tager alle den sidste, så en `'system'`-værdi ikke kan nå frem til noget, der skal tegne – dét
  ville ellers give et lyst tema helt uden fejlmeddelelse. `resolveThemeMode` er den eneste
  oversættelse.
- **Systemskift følges nu live.** Contexten abonnerer på `matchMedia`, så et tema, der skifter på
  maskinen kl. 20, også skifter i en åben Mineo-fane. Målt i browseren: systemet sat til mørkt →
  appen fulgte med uden genindlæsning, mens det gemte valg forblev `'system'`.
- **Vejen tilbage er efterprøvet**, fordi den var selve fundet: «Lyst» låser til lyst trods mørkt
  system, og «Følg computeren» genoptager automatikken med det samme.
- Parse-laget læser **ikke** længere systempræferencen ind i defaults. Det var netop dét, der frøs
  automatikken fast før: den konkrete værdi blev skrevet i storage ved første skrivning.
- Head-scriptet (første paint) gentager reglen i ES5 og kan ikke dele kode med `resolveThemeMode`.
  `themeBootstrapParity.test.ts` måler derfor de to mod hinanden over alle kombinationer af gemt
  valg og systempræference – ellers kunne første paint og runtime drifte fra hinanden og give et
  synligt omslag ved montering.

Reglen er skrevet ind i `src/contracts/app-settings.md`.

### BB-025 – Brugerens indstillinger kan forsvinde tavst og uden spor

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afvist 2026-08-18 – se afgørelsen under **Tilbagemelding** nedenfor.
- **Sådan fremprovokeres det:**
  1. Sæt flere indstillinger, fx «Opgørelse afsluttes med» = «Underskrift-linje».
  2. Ryd browserens lagrede data for stedet (eller åbn Mineo i et privat vindue, eller lad
     browserens oprydning gøre det selv efter en periode).
  3. Åbn Indstillinger igen.
- **Det sker:** Alle indstillinger står på deres oprindelige værdier igen. Målt konkret: efter en
  ødelagt lagring viste feltet «Bekræftet godkendt», selvom brugeren havde valgt «Underskrift-linje».
  Der er ingen besked. Programmet fungerer upåklageligt – det er kun brugerens valg, der er væk.
- **Det er uhensigtsmæssigt fordi:** Indstillingerne er de eneste værdier i Mineo, brugeren ikke kan
  gemme, hente eller fortryde. Han opdager tabet, når en opgørelse pludselig kommer ud med brevhoved
  eller udkast-stempel, han troede var slået fra – altså i et dokument, der måske allerede er sendt.
  Det er lige præcis den klasse, prioriteringens punkt 1 dækker: noget brugeren har skrevet, ændrer
  sig uden hans handling.
  *Bemærk til gengæld, at delvis skade håndteres forbilledligt:* er ét felt ødelagt, falder kun det
  ene tilbage, mens de øvrige bevares. Det er efterprøvet og virker.
- **Bedre ville være:** To muligheder, som brugeren kan vælge imellem:
  (a) **Minimalt:** en linje øverst på fladen, som kun vises, når indstillingerne netop er faldet
  tilbage til standard: *«Dine indstillinger kunne ikke læses og er sat til programmets standard.»*
  (b) **Mere robust:** lad indstillingerne følge med i `.eo`-filen som et separat, valgfrit afsnit,
  så de kan genskabes. Dette bryder imidlertid med kontraktens bærende regel om, at `.eo` kun
  indeholder sagsdata, og er derfor en beslutning, ikke en rettelse.
  Forslaget er (a); (b) nævnes kun, fordi det er den eneste vej til reelt at sikre værdierne.
- **Andre steder det kan gælde:** Filplaceringen («Placering til gemte filer») ligger i to
  forskellige lagre og kan tabes uafhængigt. Den tilstand er allerede håndteret eksemplarisk –
  rækken siger «Skrivebord (standard)» og tilbyder «Nulstil», når registreringen er væk.

**Tilbagemelding**
Jeg vil ikke følge dine forslag, og jeg er godt tilfreds med den aktuelle løsning. Indstillinger må aldrig(!) følge .eo-filen, og det må gerne dokumenteres. Og brugeren bliver selv hurtigt bevidst om, hvis indstillingerne er sat tilbage til defaults. Det behøver vi ikke gøre opmærksom på - særlig ikke, da det må forventes at være usandsynligt sjældent forekommende, at der opstår situationer, hvor meddelelsen overhoved vil blive vist. 

**Afgjort 2026-08-18 – AFVIST. Ingen ændring. Forbuddet mod `.eo` er dokumenteret.**

Begge dele er skrevet ind i `src/contracts/app-settings.md` som normative regler, så en senere
gennemgang ikke foreslår det igen: forslag (b) er udtrykkeligt afvist, og fraværet af en besked er
noteret som et valg frem for en mangel.

**Én præcisering til begrundelsen, som jeg ikke helt køber – men den ændrer ikke afgørelsen.**
«Brugeren bliver selv hurtigt bevidst om det» holder for de synlige indstillinger: farvetema og
kontrolfaner ser man med det samme. Det holder svagere for de tavse – `defaultIndsaetUdkastStempel`
(standard: **til**) og brevhoved-flagene. Har en bruger slået udkast-stemplet fra, og falder
indstillingerne tilbage, får næste nye sag stemplet igen; det opdages i et færdigt dokument, ikke
på fladen.

Jeg presser alligevel ikke på, fordi den anden halvdel af begrundelsen bærer alene: tilstanden
kræver, at browserens lagring ryddes eller ødelægges, og så sjældent en hændelse retfærdiggør ikke
en permanent mekanisme. Det er en rimelig afvejning, og den er nu truffet bevidst frem for
underforstået. **Genåbn ikke** – men bemærk ved en fremtidig ny indstilling, at en tavs standard
«til» er den type, tabet gør mest ondt på.

### BB-026 – Alle brevhoveder kan slås fra, uden at nogen nævner konsekvensen

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afvist 2026-08-18 – se afgørelsen under **Tilbagemelding** nedenfor.
- **Sådan fremprovokeres det:**
  1. Fjern fluebenet ved alle ni dokumenttyper under «Indsæt brevhoved i».
  2. Download en erstatningsopgørelse.
- **Det sker:** Alle ni kan slås fra uden indsigelse (målt). Dokumenterne produceres derefter helt
  uden brevhoved – altså uden skadelidtes navn, skadestype, skadedato og sagsnummer.
- **Det er uhensigtsmæssigt fordi:** Et arbejdsskadedokument uden navn og sagsnummer kan ikke
  henføres til en sag, når det ligger på skrivebordet blandt fem andre. Fravalget er legitimt, men
  konsekvensen er usynlig på det tidspunkt, den vælges, og først mærkbar i et færdigt dokument.
- **Bedre ville være:** Ingen blokering – men en kort, rolig linje under de ni felter, der siger,
  hvad brevhovedet indeholder: *«Brevhovedet viser skadelidtes navn, skadestype, skadedato og
  sagsnr.»* Så træffer brugeren valget oplyst, uden at nogen forhindrer ham i det.
  *Alternativt* kunne det afvises som overflødigt: brugeren, der fjerner ni flueben, ved formentlig
  hvad han gør.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Dette er helt præcis sådan, jeg ønsker det. Brevhovedet er ikke en central eller væsentlig del af dokumentet - det er et tilbud til brugeren om, at få indsat et brevhoved med visse registreringsdata. Brugerne vil ofte ønske ikke at få det.

**Afgjort 2026-08-18 – AFVIST. Ingen ændring.** Fundets præmis var, at brevhovedet bærer noget
væsentligt, og at fravalget derfor har en konsekvens, brugeren bør oplyses om. Den præmis er forkert:
brevhovedet er et tilbud om nogle registreringsdata, ikke en del af dokumentets indhold, og
fravalget er en almindelig, hyppig arbejdsgang – ikke et uheld.

Konsekvens for senere flader: **brevhovedet skal ikke behandles som en integritetsegenskab ved et
dokument.** Et fund om, at et dokument «mangler» identifikation, fordi brevhovedet er fravalgt, er
ikke et fund.

### BB-027 – Ctrl+Z fortryder alt i programmet undtagen her

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-12--en-indstilling-uden-synlig-virkning`
- **Prioritet:** Lav
- **Beslutning:** Afvist 2026-08-18 – se afgørelsen under **Tilbagemelding** nedenfor.
- **Sådan fremprovokeres det:**
  1. Slå «Bilagsnumre i erstatningsopgørelser» til.
  2. Tryk Ctrl+Z.
- **Det sker:** Intet. Indstillingen forbliver slået til (målt). Der er ingen reaktion overhovedet –
  hverken en fortrydelse eller en oplysning om, at fortrydelse ikke gælder her.
- **Det er uhensigtsmæssigt fordi:** Ctrl+Z virker overalt ellers i Mineo. En bruger, der ved et
  uheld rammer et flueben og trykker Ctrl+Z i vane, tror at han har fortrudt, og går videre med en
  indstilling, han mener er slået fra. Da indstillingerne samtidig ikke kan gemmes eller hentes, er
  der ingen anden vej tilbage end at huske den oprindelige værdi.
- **Bedre ville være:** Adfærden bevares – indstillinger er ikke sagsdata, og at trække dem ind i
  sagens fortrydelseshistorik ville være forkert. Rettelsen er sproglig: den samme forklarende linje,
  BB-023 foreslår, kan bære oplysningen om, at indstillinger gælder med det samme og ikke indgår i
  fortryd.
  *Dette fund kan med rimelighed afvises* som en detalje, hvis brugeren vurderer, at ingen reelt
  trykker Ctrl+Z på en indstillingsside.
- **Andre steder det kan gælde:** Mineo-sidens startside-toggle er samme slags device-lokale valg og
  har samme forhold.

**Tilbagemelding**
Dette er et bevidst design-valg. Valg på indstillinger-siden skal ikke være en del af undo/redo. De må kun ændres på baggrund af brugerens aktive valg. Ellers vil de kunne ændres ved en fejl ved at trykke undo en gang for meget.

**Afgjort 2026-08-18 – AFVIST. Ingen ændring. Reglen er dokumenteret.**

Begrundelsen vender fundet på hovedet, og det er den rigtige vending: fraværet af fortrydelse er
et **værn**, ikke en mangel. Var indstillingerne med i undo/redo, kunne ét tryk for meget på Fortryd
ændre en indstilling, brugeren aldrig havde rørt – og virkningen ville ramme et andet sted end dér,
fortrydelsen skete. Det ville være langt værre end det, fundet beskrev.

Fundet foreslog subsidiært en oplysning om, at fortrydelse ikke gælder her. Den bortfalder sammen
med BB-023's forklarende linje, som den skulle have hængt på.

Nu normativ regel i `src/contracts/app-settings.md` («indstillinger er uden for undo/redo»), så
mekanismen ikke senere bliver «rettet» af en, der læser fraværet som en forglemmelse.

### BB-028 – To beregningstekniske valg, hvor det ene ikke gør, hvad rækkefølgen antyder

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-08-18 – se afgørelsen under **Tilbagemelding** nedenfor.
- **Sådan fremprovokeres det:**
  1. Læs de to rækker i «Beregningsteknisk» i den rækkefølge, de står:
     «Tillad regulering med overenskomst, der ikke dækker hele perioden» (fra som standard), og
     «Efter udløb anses overenskomst for forældet efter [6] måneder».
  2. Lad den første stå slået **fra**, og betragt en sag, hvor overenskomsten udløber to måneder
     før periodens slutning.
- **Det sker:** Perioden accepteres som dækket, selvom «Tillad …» er slået fra. Grunden er, at
  måneds-grænsen virker helt uafhængigt af den toggle, den står under: inden for de 6 måneder
  regnes dækningen som i orden uanset toggle-tilstanden. Fra og med måned 6 træder toggle'n i kraft
  og afgør, om det er en fejl eller kun en advarsel.
- **Det er uhensigtsmæssigt fordi:** Placeringen – en toggle, og under den et tilhørende talvalg –
  læses naturligt som «grænsen gælder, når jeg har tilladt det». I virkeligheden er der tale om to
  uafhængige regler: én tolerance, der altid gælder, og én severity-omskifter. En bruger, der slår
  «Tillad …» fra for at få den strengeste kontrol, får den ikke i de første seks måneder efter udløb
  og opdager det ikke.
- **Bedre ville være:** Behold begge regler som de er – de er fagligt begrundede. Ret rækkefølgen og
  ordlyden, så uafhængigheden fremgår, fx ved at sætte måneds-rækken **først** og formulere den som
  en selvstændig regel: *«Overenskomsten regnes for dækkende indtil [6] måneder efter udløb»* –
  og derefter toggle'n. Så læses de to som det, de er, frem for som en betingelse og dens
  undtagelse.
- **Andre steder det kan gælde:** Ingen – de to er de eneste af deres art.

**Tilbagemelding**
Jeg accepterer din præmis og er enig. 

**Afgjort 2026-08-18 – ACCEPTERET. Gennemført.**

De to rækker har byttet plads, og tolerancen er omformuleret som en selvstændig regel:

| | Før | Nu |
|---|---|---|
| Første række | «Tillad regulering med overenskomst, der ikke dækker hele perioden» | «Overenskomsten regnes for dækkende indtil **[6]** måneder efter udløb» |
| Anden række | «Efter udløb anses overenskomst for forældet efter **[6]** måneder» | «Tillad regulering med overenskomst, der ikke dækker hele perioden» |

Reglerne selv er uændrede – kun rækkefølgen og ordlyden. Pointen er, at tolerancen nu **læses som
det den er**: en regel, der altid gælder, og som derfor står først. Toggle'n, der kun afgør
severity uden for vinduet, følger efter.

Rækkefølgen er betydningsbærende og må ikke byttes tilbage; begrundelsen står som kommentar i
`Indstillinger.tsx`, så den ikke går tabt ved en senere oprydning.

### BB-029 – «0 måneder» kan vælges, men gør noget andet end det, tallet siger

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afvist 2026-08-18 – se afgørelsen under **Tilbagemelding** nedenfor.
- **Sådan fremprovokeres det:**
  1. Sæt «Efter udløb anses overenskomst for forældet efter» til `0` måneder.
- **Det sker:** Grænsen bliver reelt slået fra: ingen periode kan falde inden for et vindue på nul
  måneder, så enhver overskridelse – også én på en enkelt dag – behandles nu efter «Tillad …»-toggle'n.
  Valget er tilladt (dropdownen tilbyder 0–12), og der siges intet om, at 0 betyder «ingen
  tolerance».
- **Det er uhensigtsmæssigt fordi:** «0 måneder» kan lige så rimeligt læses som «forældes aldrig»
  som «forældes straks». Ordlyden «anses for forældet efter 0 måneder» peger nærmest på det
  modsatte af, hvad der sker. Den bruger, der vælger 0 for at slå tolerancen fra, gætter rigtigt;
  den, der vælger 0 for at slå forældelsen fra, gætter forkert – og får den strengeste kontrol i
  stedet for den mildeste.
- **Bedre ville være:** Behold 0 som valgmulighed, men vis den som noget andet end et tal, fx
  «Ingen tolerance» i stedet for «0». Så kan valget ikke læses baglæns.
- **Andre steder det kan gælde:** Ingen anden indstilling har et talvalg, hvor 0 betyder noget
  kvalitativt andet end de øvrige værdier.

**Tilbagemelding**
Jeg accepterer ikke din præmis. Den naturlige læsning af '0 måneder' i relation til resten af teksten vil være, at den anses for forældet straks. 

**Afgjort 2026-08-18 – AFVIST. Ingen ændring af valgmuligheden.** Du har ret, og jeg trækker
indvendingen: «anses for forældet efter 0 måneder» læses naturligt som «forældes straks», og det er
præcis, hvad der sker. Fundet konstruerede en tvetydighed, der ikke er der. «Ingen tolerance» som
etiket er dermed ikke nødvendig – og efter BB-028's omformulering ville den heller ikke passe ind i
sætningen længere.

**Ét smalt modpres, som IKKE handler om valgmuligheden – det er en tekst, brugeren aldrig kan
komme til at se korrekt.** Sættes grænsen til 0, kan én bestemt visning på EO-kontrolfanen ikke
længere være rigtig:

- Ligger TAF-slutdatoen inden for vinduet, viser rækken teksten `(< N måneder)` – altså
  `(< 6 måneder)` ved standardværdien.
- Ved grænsen 0 er betingelsen `månederSidenUdløb < 0` aldrig sand. Grenen nås derfor ikke, og
  teksten `(< 0 måneder)` kan aldrig vises.

Det er ikke et problem i sig selv – udfaldet er korrekt, og brugeren ser bare den almindelige
«Nej (kun indtil …)». Jeg noterer det udelukkende, fordi teksten `(< N måneder)` er formateret med
grænsen som variabel og dermed lover en form, den ikke kan udfylde for én af sine tretten værdier.
**Ingen handling foreslået her**; det hører til gennemgangen af EO-kontrolfanen (flade 12), hvor
rækken faktisk kan ses. Registreret som dækningshul frem for som fund, da jeg ikke har set rækken
i en kørende sag.

**Opfølgning 2026-10-30 (fra `erstatningsopgoerelse-12m.md` §«Efterfølgende rettelser»):** rækken «Reguleringsværdi
på … slut-dato for TAF» siger nu «Ja (sidste værdi under N måneder før)» i stedet for kun «(< N måneder)» – ren
ordlyd, status og beregning uændrede. Fortsat ikke målt i browseren; kræver en overenskomst-, KRL-, KL- eller
statistiksag, hvis sidste sats ligger kort før TAF-slutdatoen.

### BB-036 – «Nulstil» får browserens sorte fokusramme

- **Type:** Fornuft (udviklerens eget fund)
- **Rækkevidde:** Mønster – se «Andre steder» nedenfor
- **Prioritet:** Lav
- **Beslutning:** Gennemført 2026-08-18

**Udviklerens fund (tidligere afsnittet «Mit eget supplerende fund»):**
Når 'nulstil' får fokus, ser det ikke kønt ud. der kommer en sort boks rundt om selve teksten - det afviger fra resten af sidens hover-effekt og er ikke særlig elegang. jeg kunne godt tænke mig en hover-effekt, der er bedre i tråd med resten af programmet. måske en grå cirkel eller en grå firkant eller noget helt tredje.

- **Det sker (målt):** Knappen havde ingen fokus-styling og fik derfor browserens standard:
  `outline: rgb(16,16,16) auto` med `border-radius: 0` – en skarp, næsten sort firkant tæt om
  bogstaverne. Naboknappen «Vælg mappe» er en rund MUI-IconButton uden outline, og programmets
  øvrige fokusmarkering (`.auth-login-button`) er en primærfarvet ramme med luft omkring. «Nulstil»
  lignede altså hverken sin nabo eller resten af programmet.
- **Præcisering af fundet:** det er **fokus**, ikke hover, der ser forkert ud. Hover-effekten
  findes allerede (understregning + primærfarve) og er uændret. Rammen kommer kun frem ved
  tastaturnavigation – eller ved klik, hvis man ikke skelner; se `:focus-visible` nedenfor.
- **Gennemført:** ny fælles klasse `.text-action-button` i `layout.css` – en **udfyldt, afrundet
  flade uden ring**, med samme tone som det aktive menupunkt i sidemenuen
  (`--color-active-bg-hover`). Ingen outline overhovedet.

  **To forsøg undervejs; begge forkastet efter at være set i browseren:**

  1. *Primærfarvet ring* (som Log ind-knappen). Afvist af udvikleren: den så «fjollet og forkert»
     ud. Grunden er reel – login-siden står uden for app-shellen og har sit eget udtryk, så dens
     fokusramme er ikke sidernes sprog. Inde i programmet lagde ringen en form oven på et element,
     der ellers ingen form har.
  2. *Neutral grå flade* (`--color-hover`). Målt til at være reelt usynlig: knappen ligger inde i
     en række, der **selv** toner sig grå ved hover, så grå på grå forsvandt bag understregningen.
     En fokusmarkering, tastaturbrugeren ikke kan se, er ingen markering.

  Den valgte tone er programmets egen «dette element er aktivt nu»-farve og findes i begge temaer:
  `rgba(25,118,210,0.12)` i lyst, `rgba(144,202,249,0.18)` i mørkt – begge efterprøvet visuelt.
  Padding giver fladen plads at være i; en modsvarende negativ margin gør, at naboerne ikke
  flytter sig, når fokus rammer.
- **`:focus-visible` frem for `:focus`:** en museklikker skal ikke se en fokusramme, kun
  tastaturbrugeren. Det er også grunden til, at rammen ikke er en «hover-effekt» – de to tilstande
  skal ikke se ens ud.
- **Andre steder det kan gælde (ikke rettet):** samme mangel findes på alle tekstbaserede knapper,
  dvs. de øvrige elementer med `data-mineo-focusable-button` som ikke er MUI-IconButtons.
  Konkrete kandidater: `InlineActionButton`, `LazyChunkRecoveryNotice`, `Overlay`'s knap,
  `SpecifikationDownloadBox`. Klassen er lavet fælles, så de kan tage den, men jeg har kun sat den
  på «Nulstil» – resten bør efterprøves visuelt på deres egne flader frem for at blive ændret
  usete.

## Overvejet uden fund

- **Alle tyve kontroller kan nås med Tab, i den rækkefølge de står visuelt** – målt hele vejen
  gennem fladen. Radiogrupper optager ét stop (piletaster vælger inden i), mens de ni
  brevhoved-checkbokse har hvert sit. Begge dele er korrekt tastaturadfærd. M-08 gav intet her.
- **Alle værdier gemmes øjeblikkeligt** – verificeret i `localStorage` efter hvert enkelt valg.
  Ingen «Gem»-knap er nødvendig, og ingen ændring kan gå tabt ved at forlade fladen.
- **Delvis ødelagt lagring redder de gyldige felter.** Målt konkret: med ét ugyldigt enum og ét tal
  uden for sit interval faldt netop de to tilbage til deres egne standarder, mens et samtidig ændret
  `themeMode: dark` overlevede uændret. Præcis som kontrakten lover.
- **Farvetemaet skifter øjeblikkeligt** og sætter både `data-mineo-theme` og browserens
  `theme-color`. Ingen genindlæsning kræves; intet blink.
- **«Vis kontrolfaner» håndterer den svære vej ud.** Slås fanerne fra, mens brugeren *står på*
  EO-kontrol-fanen, føres han til «EO oplysninger» i stedet for at hænge på en forsvunden fane.
  Målt. Det er den slags edge case, der ofte er overset – her er den ikke.
- **«Vis knap til at rapportere fejl» virker straks** på alle indholdsbokse, også Indstillinger-siden
  selv. Knappen ligger 14 px uden for boksens hjørne og rammer hverken sidemenuen eller
  betjenbart indhold ved 1536×864 (målt). M-10 gav intet her.
- **«Placering til gemte filer» er fladens bedst gennemtænkte række.** Navn og udseende har én
  fælles kilde, en tabt mappe vises ærligt som «Skrivebord (standard)», «Nulstil» findes kun når der
  er noget at nulstille, og annullering af mappevælgeren gør ingenting. Ingen indvending.
- **Ingen døde indstillinger.** Hver af de tyve blev sporet til sin forbruger.
  `showEOInspektionMenu` så først ud til at mangle en – den går gennem EO-sidens view-model og
  virker (efterprøvet i browseren).
- **Dropdown-værdier kan ikke skrives frit:** felterne er skrivebeskyttede og tilbyder kun gyldige
  valg. Sidens B0-grænseeftersyn er derfor uden fund – der er ingen fritekst at fejle i.
- **DEV-indstillingen «Farvemarkering af font-styles»** vises kun i udviklingsmiljøet og kan ikke nå
  en produktionsbygning, heller ikke via en gemt værdi. Uden for brugerens flade.

## Dækningshuller

- **Mappevælgeren kunne ikke afprøves headless.** `showDirectoryPicker` kræver en ægte
  brugerhandling i et rigtigt browservindue. Rækkens tre tilstande er derfor bedømt fra koden og fra
  standardtilstanden i browseren; selve valget af en mappe, og hvad brugeren ser bagefter, er ikke
  set med egne øjne.
- **Den faktiske virkning i et færdigt dokument er ikke set.** BB-026 (brevhoved fravalgt) og
  virkningen af «Udkast-stempel» og «Bilagsnumre» er sporet i koden til deres forbrugere, men der er
  ikke downloadet en PDF for at se resultatet. Det kræver en fuldt udfyldt sag og hører naturligt
  til gennemgangen af Erstatningsopgørelse-fladen.
- **BB-028 og BB-029 er bedømt fra reglerne, ikke fra en kørende sag.** De to beregningstekniske
  valg kræver en sag med en overenskomst, der udløber midt i en periode. Selve reglen er læst
  direkte i den kode, der afgør udfaldet, og er utvetydig – men den konkrete oplevelse på
  EO-kontrolfanen er ikke set. Bør efterprøves, når Erstatningsopgørelse gennemgås.
- **Teksten `(< N måneder)` på EO-kontrolfanen er ikke set i en kørende sag.** Fra BB-029's
  afgørelse: ved grænsen `0` kan den gren aldrig nås, så teksten `(< 0 måneder)` er uopnåelig.
  Udfaldet er korrekt, men formuleringen lover en form, den ikke kan udfylde for én af sine tretten
  værdier. Efterprøv den, når flade 12 (EO-kontrol) gennemgås – ikke som et fund herfra. (Ordlyden er
  ændret 2026-10-30, men rækken er fortsat ikke set; se opfølgningen under BB-029.)

## Åbne spørgsmål

**Ingen.** Fladens to spørgsmål er besvaret og lukket 2026-08-18; de står som opfølgende spørgsmål under BB-023.
