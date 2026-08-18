# Brugerblik — tværgående mønstre

Mønstre, der er fundet på én flade, men som efter deres natur kan gælde flere steder. Hvert mønster
er formuleret uden reference til den flade, det blev fundet på, så det kan efterprøves andre steder.

Et mønster her er **ikke** i sig selv et fund uden for den flade, det blev observeret på — det er en
hypotese med konkrete kandidatsteder. Bekræftede forekomster registreres som almindelige fund på den
pågældende flades dokument og noteres nedenfor.

**Brugerens afgørelser 2026-08-16 har ændret fire af de syv første mønstre.** Et mønster, hvis
udløsende fund er afvist, forsvinder ikke automatisk — men det skal læses med den trufne beslutning,
ellers genopdager den næste flade et forhold, der er afgjort. Beslutningerne står i sin helhed i
`stamdata.md`; nedenfor er de skrevet ind i det enkelte mønster.

**M-13 og M-14 er tilføjet 2026-08-18 fra Satser-fladen.** De handler begge om, at to steder i
programmet træffer den samme afgørelse hver for sig og bliver uenige: M-13 om skærmens og dokumentets
prøve for «er der noget at vise», M-14 om paste-reglen i et tomt kontra et udfyldt felt. Fælles for
dem er, at uenigheden er usynlig for brugeren, og at den kun opstår i et hjørne af datasættet —
derfor er begge fundet ved at tælle rækker og sammenligne udgaver, ikke ved at læse koden.

**M-08 til M-11 er tilføjet 2026-08-16 fra Om-fladen.** De adskiller sig fra M-01–M-07 ved ikke at
handle om indtastning: de handler om siden som helhed — tastaturets rækkevidde, vinduets bredde,
flydende elementer og de tekster, hvor programmet udtaler sig om sig selv. **Tre af dem er skrevet om
samme dag efter brugerens afgørelser** (M-08 afgjort for bundlinjen, M-09 har fået en nedre grænse,
M-10 er skærpet); M-11 står uændret med to gennemførte tekstrettelser bag sig.

---

## M-01 — Kontekstuelle feltnavne

> Et valg ændrer, hvad en allerede indtastet værdi betyder, uden at værdien eller brugeren følger med.

Når et felts navn, enhed eller rolle afhænger af et andet valg, skifter betydningen af den værdi, der
allerede står i feltet, i samme øjeblik valget ændres. Værdien er uændret; det, den betyder, er ikke.

**Efterprøv, hvor:** et valg styrer en label, en enhed (kr./%), en tidsenhed, en beregningsmetode
eller hvilken af to regler et felt læses efter.

- Fundet i: `stamdata.md` BB-001 (Skadestype → Skadedato/Anmeldelsesdato) — **fundet er afvist af
  brugeren 2026-08-16**: skadestypen er en deskriptiv angivelse af sagen, og datoen er den samme
  sagsdato under begge navne. Den blotte omdøbning af et felt er dermed **ikke** et fund.
- **Mønsteret er derfor skærpet:** det, der tæller, er ikke navneskiftet, men om valget ændrer, hvad
  programmet *regner* eller *tillader* med den værdi, der allerede står. Netop dét gør skadestypen
  (EO's nedre datogrænse flytter sig fem år), og det er registreret som åbent spørgsmål 1 i
  `stamdata.md` — ikke som en navnesag.
- Kandidater, ikke efterprøvet: felter styret af «Tillæg angives som» (procent/beløb), «Beregnes ud
  fra», og enhver tidsenhedsvælger ved siden af et tal. Efterprøv dem på den skærpede formulering:
  skifter *beregningen* eller *grænserne*, ikke bare ordet.

## M-02 — Beskeder med hardkodede feltnavne

> En besked navngiver et felt med et navn, feltet ikke bærer på skærmen.

Programmet har én mekanisme til, at et felt ejer sit eget navn, så label og besked ikke kan sige hver
sit. Beskeder, der har navnet skrevet ind i teksten, omgår mekanismen.

**Efterprøv, hvor:** en fejl-, advarsels- eller tooltiptekst nævner et feltnavn i prosa i stedet for
at hente det fra feltet — og hvor to tekster om samme begreb bruger forskellige ord for det.

- **Brugerens regel 2026-08-16 (bindende for hele programmet):** navngivningen i beskeder skal følge
  den til enhver tid værende værdi i skadestype-feltet — «Anmeldelsesdato» ved Erhvervssygdom,
  ellers «Skadedato». De to betegnelser er de eneste korrekte brugervendte betegnelser.
- Fundet i: `stamdata.md` BB-002 — **accepteret, skal rettes** (implementeringsforslag i fundet).
- Konkrete kandidatsteder: `src/utils/dateRangeErrorMessages.ts`; den fælles besked
  om en dato før stamdatodatoen, som nås fra mindst seks erklæringssteder i
  `erhvervsevnetabDescriptors.ts`, `varigeMenDescriptors.ts` og `config/dateRanges.ts`; teksten
  «Grænserne kommer fra Fødselsdato og Skadedato».
- Bemærk også, at alle tekster om samme dato skal bruge den samme korrekte betegnelse.

## M-03 — Tastning og indsættelse accepterer ikke det samme

> Feltet kan læse en form, brugeren ikke må taste — eller omvendt.

**Afgjort af brugeren 2026-08-16: forskellen er tilsigtet og er ikke i sig selv et fund.** Tastning må
ikke begynde at tolke på det tredje indtastede ciffer — `16` kan være både den 16. og den 1. juni, og
en automatisk separator ville låse den usikre fortolkning fast. Indsættelse kender derimod hele
teksten på én gang, og kan den uomtvisteligt opløses til én sikker værdi, skal programmet gøre det.
**Indsættelse må altså gerne være mere tolerant end tastning.**

Tilbage af mønsteret står den omvendte retning og et enkelt restforhold:

- **Er der felter, hvor TASTNING accepterer mere end indsættelse?** Det ville være den forkerte vej og
  er stadig værd at lede efter.
- **Er der felter, hvor indsættelse afkorter en tekst, der uomtvisteligt kunne læses?** Det er den
  brugervenlighed, afgørelsen bygger på, og den skal så gælde alle familier.

**Efterprøv, hvor:** et felt har både et tegn-/længdeværn og en normalisering af indsat tekst — dvs.
alle dato-, år-, uge-, beløbs- og procentfelter.

- Fundet i: `stamdata.md` BB-003 (dato tastet som `010623` → `01`; samme tekst indsat → `01-06-2023`)
  — **afvist**; adfærden bevares.
- Kandidater, ikke efterprøvet: uge- og årsfelterne (egne segmentregler), beløbsfelter med
  tusindseparator, procentfelter.

## M-04 — Feltets længdegrænse skal blokere, og værdien skal kunne læses

> Ved en tegn- eller cifferegrænse afskæres brugeren fra at skrive mere — og han skal kunne læse det,
> der står.

**Brugerens regel 2026-08-16:** hvor der er en grænse for antal tegn eller cifre, skal brugeren
effektivt afskæres fra at indtaste flere. Det gælder universelt i hele programmet.

**Reglen er allerede indført og målt** (kontraktens §1.2, håndhævet 2026-08-15): værnet ligger på
draft-ændringen, grænsen er påkrævet i codec-typen, og `fieldCharLengthPolicy.test.ts` måler hvert
enkelt produktionsfelt. Et for langt **paste** afkortes efter §1.2a's regel «paste behandles som
tastning» — også det en truffet beslutning (2026-08-09). Mønsteret er derfor **ikke** længere «lydløs
afkortning er et fund».

Det, der stadig skal efterprøves på hver flade, er de to reelle rester:

1. **Passer grænsen til feltet?** Et felt, der er tegnet til initialer, men tager imod 60 tegn, har en
   grænse, brugeren aldrig rammer — den afværger intet. **Brugerens målestok 2026-08-16:** antallet af
   tilladte tegn skal svare til det **synlige** indhold i feltet. De to initialfelter går derfor fra 60
   til 6 tegn. Spørg på hver flade, om et felts kategori er valgt — eller bare arvet.
2. **Kan brugeren læse værdien bagefter?** En værdi, der er bredere end feltet, uden tooltip og med
   centreret tekst, kan hverken læses eller kontrolleres. Efter punkt 1 er dette kun et spørgsmål, hvor
   et felt reelt kan rumme mere tekst, end det viser — konkrete kandidater: EO's bilagsnumre-felter
   (60 tegn) og smalle tabelceller. På Stamdata er spørgsmålet lukket.

**Efterprøv, hvor:** feltets synlige bredde er mindre end den tilladte længde, og hvor grænsen er
arvet fra en kategori frem for valgt til feltet.

- Fundet i: `stamdata.md` BB-004 (60 tegn i et 80 px-felt, ca. 6 tegn synlige) — **afgjort**: ny
  længdekategori på 6 tegn til initialfelterne (implementeringsforslag i fundet).
- Kandidater, ikke efterprøvet: alle korte tekstfelter (samme grænse på 60 tegn), de flerlinjede
  kommentarfelter (512), samt smalle tabelceller med lange værdier.

## M-05 — Ingen rimelighedskontrol af lovlige, men usandsynlige værdier

> Grænsen er sat vidt for ikke at opfinde en regel, og derfor fanger den kun det umulige.

En vid grænse er det rigtige valg, når der ikke findes en juridisk regel — men den efterlader et
stort felt af værdier, der er tilladte og næsten sikkert forkerte. En ikke-blokerende advarsel er
formen, programmet allerede bruger andre steder.

**Efterprøv, hvor:** en grænse er beskrevet som «bevidst vid», og hvor værdien driver en beregning
langt fra det sted, den blev indtastet.

- Fundet i: `stamdata.md` BB-005 (2-årig skadelidt accepteres uden signal) — **afvist 2026-08-16**:
  der skal ikke være nogen nedre aldersgrænse, heller ikke som advarsel. Nyfødte og små børn er
  lovlige skadelidte. **Alder er dermed lukket som emne**; spørg i stedet, om beregningerne regner
  rigtigt på dem.
- Fundet i: `stamdata.md` BB-009 (tocifret fødselsår fortolkes fremadrettet) — **afvist 2026-08-16**:
  der skal være **én** gennemgående regel for tocifrede årstal, og den nuværende (27-31 → 2027-2031 i
  2026) er den rigtige. Et felt må ikke få sin egen årsfortolkning.
- Kandidater, ikke efterprøvet: beløb, der afviger en faktor 10 eller 1000 fra sagens øvrige beløb;
  procenter indtastet som decimal; datoer årtier fra sagens øvrige datoer. **Bemærk grænsen for
  mønsteret efter afgørelserne:** en advarsel kan foreslås, hvor værdien er usandsynlig *i sagens egen
  sammenhæng* — ikke hvor den blot er usædvanlig i almindelighed.

## M-06 — Usynlige tegn overlever fra indsættelse

> Tekst indsat fra et tekstbehandlingsprogram bærer tegn, brugeren ikke kan se.

Hårde mellemrum, tabulatorer og linjeskift følger med fra Word og Excel og bliver stående i værdien.
Brugeren ser noget, der ligner mellemrum. Værdien går videre i dokumenter og kan ikke sammenlignes
pålideligt.

**Efterprøv, hvor:** et fritekstfelt tager imod indsat tekst.

- Fundet i: `stamdata.md` BB-007 — **accepteret 2026-08-16, skal rettes** med ét delt
  normaliseringstrin før feltets egen paste-behandling. Brugerens forbehold er, at det ikke må
  forstyrre de øvrige normaliseringer; det er efterprøvet og skal måles af en ækvivalenstest pr.
  familie (implementeringsforslag i fundet).
- Kandidater, ikke efterprøvet: alle fritekst- og kommentarfelter. Tal-, dato- og procentfelter har
  hver sin normalisering og er verificeret upåvirkede (de filtrerer på tegnsæt eller udtrækker cifre).

## M-07 — Parvise grænser: begge felter markeres, hver med sin egen udvej

> To felter, der afgrænser hinanden, skal begge markeres — og hver tekst skal sige, hvad brugeren kan
> gøre i netop det felt.

**Brugerens regel 2026-08-16:** udløser to felters værdier tilsammen en fejl, gives der fejl i begge.
Løsningen er forskellig i hvert felt, og teksten skal afspejle den udvej, feltet selv har. Forslaget om
kun at markere det senest ændrede felt er afvist.

Mønsteret er dermed vendt om: det er ikke dobbeltmarkeringen, der skal efterprøves, men om de to
tekster er **hinandens spejlbillede set fra hvert sit felt** — eller om de begge beskriver problemet
fra det ene felts synsvinkel, så det andet felt beder brugeren rette noget, han ikke kan rette dér.

**Efterprøv, hvor:** to felter afleder hinandens grænser: fra/til-perioder, afgørelses- og
virkningsdatoer, kapitaliseringsdatoer, min-/maks-par.

- Fundet i: `stamdata.md` BB-010 — markeringen bevares; **ordlyden skal rettes** (forslag i fundet).
- Kandidater, ikke efterprøvet: alle periodetabeller med fra/til-kolonner. Bemærk især den fælles
  `DATE_ORDER_ERROR_MESSAGE`, som begge parter i et fra/til-par får i dag — samme tekst på to felter
  med hver sin udvej.

## M-08 — Links er ikke med i tastaturrækkefølgen

> Et link kan kun nås med mus, fordi sidens tastaturrækkefølge kun optager felter og markerede knapper.

Programmet ejer selv Tab: tasten flytter fokus i en cirkulær ring, der samles af én selector. Den
optager felter, dropdowns og de knapper, der udtrykkeligt er markeret som fokuserbare — men ingen
`<a>`. Da programmets egen Tab-håndtering samtidig afbryder browserens, findes der ingen anden vej til
et link end musen.

**Brugerens afgørelse 2026-08-16 (gælder bundlinjen):** boksen med søskendesider — og dermed også
kontaktadressen i den — skal **ikke** være en del af tastaturrækkefølgen, og GitHub-linket er
undtaget specifikt. Fraværet er dér et valg.

**Mønsteret er derfor omformuleret:** eksterne web-links er nu eksplicit ude af tastaturrækkefølgen
via den fælles `ExternalLink`-primitive, mens interne links fortsat vurderes efter deres egne
specifikke regler. Containerens selector optager stadig felter og markerede knapper og aldrig et
`<a>`; den generelle eksterne regel gør derfor fraværet auditérbart i DOM'en på alle flader.

**Efterprøv, hvor:** et link bærer noget, brugeren skal kunne handle på — retsinfo-henvisninger,
«gå til feltet»-links i fejlbokse (verificér først, om de er links eller knapper), henvisninger
mellem sider. Ikke hvor linket blot er en udgang til en anden hjemmeside; dét er afgjort.

- Fundet i: `om.md` BB-016 (fem links, ingen af dem kan nås med Tab) — **afgjort: bevidst designvalg**.
- Efterprøvet: Satser-sidens retsinfo-henvisninger (`satserRows.tsx`) bruger samme primitive og er
  også ude af Tab-rækkefølgen. Interne linkflader er ikke ændret af M-08.
- Kandidater, ikke efterprøvet: **interne** links inde i fejl- og advarselsbokse. MinProcesrentes
  titel-link (`href="/"`) er internt og hører til den gruppe, ikke til den eksterne regel.

## M-09 — Fast indholdsbredde

> Indholdet er lige bredt uanset vinduet, så et smallere vindue skjuler enden af hver linje.

Tekstboksene har en fast bredde på 1200 px (`--content-box-max-width` bruges som `width`). Er vinduet
smallere end bredden plus menuen, skæres højresiden af, og indholdet må rulles frem sidelæns.
Beslutningen er bundet: `AGENTS.md` §Desktop-only gate forbyder viewport-responsiv styling uden for en
pinnet filliste, så en ændring er en beslutning, ikke en fejlrettelse.

**Den implementerede grænse.** Designreferencen er fortsat 1536×864 CSS-px og opefter, men Mineos
arbejdsflade skaleres nu trinvist uden reflow. Den dækkede smalle grænse er 1244×620 CSS-px ved
100 % browserzoom; den kan ikke udledes af en fysisk skærmopløsning. Under grænsen fastholdes 75 %,
og `Container` giver bevidst vandret scroll frem for mindre tekst eller skjult indhold.

**Mønsteret gælder derfor den uforanderlige indholdsgeometri, ikke fravær af skalering.** Kun den
navngivne arbejdsflade må zoome; menu, shell og portaler forbliver i normal størrelse. En flade, der
lægger bredde til ud over den fælles 1200-px-indholdsboks, kan stadig kræve vandret scroll under den
dækkede grænse og skal måles konkret.

**Efterprøv, hvor:** en flade er bredere end den rene tekstboks — tabeller med mange kolonner,
sidestillede bokse eller indhold med egen minimumsbredde. Prøven er: **er indholdet nåbart ved
1536×730 og 1366×620, og fungerer den vandrette fallback under den kontraktlige breddegrænse?**

- Fundet i: `om.md` BB-015 (sætninger skåret over ved 1366 px) — **afgjort: arbejdsfladeskalering
  inden for CSS-viewport-kontrakten**.
- Kandidater, ikke efterprøvet: alle sider med tabeller. Årsløn, Erhvervsevnetab og
  Erstatningsopgørelsen er de bredeste og skal måles ved 1536×864, ikke ved 1920.

## M-10 — Flydende knapper kan dække indhold

> En knap, der ligger fast i vinduets hjørne, dækker det indhold, der havner under den.

Rul-til-toppen-knappen er 56 px og står 32 px fra vinduets nederste højre hjørne, uafhængigt af
sidens indhold. Alt, hvad der lander i det hjørne, kan blive helt eller delvist dækket — og et klik
i det dækkede område rammer knappen, ikke indholdet.

**Skærpelse 2026-08-16 (fra måling, ikke fra en afgørelse).** Det afgørende er ikke, at en fast
placeret knap *kan* dække noget. Det er, at indholdssøjlen ved designmålet 1536×864 går helt ud til
12 px fra vinduets kant, mens knappen står 32 px inde. **Knappen ligger dermed altid inde i
indholdssøjlen ved den understøttede bredde** — der er ingen fri margen ved siden af indholdet, den
kan stå i. Alt, hvad en flade lægger i sit nederste højre hjørne, ligger derfor under knappen.

**Efterprøv, hvor:** en flade har betjenbart indhold nederst til højre: bundlinjer, runde
tilføj-knapper under tabeller, downloadknapper i bunden af en side. Mål ved 1536×864 — ikke ved 1920,
hvor indholdet er smallere end vinduet og problemet forsvinder af sig selv.

- Fundet i: `om.md` BB-014 (knappen dækker 19 px af det sidste søskendelink) — **accepteret risiko**;
  den endelige afgørelse bygger på, at kun få brugere står præcis på 1536×864, og at zoom-løsningen
  ændrer præmissen.
- Kandidater, ikke efterprøvet: alle sider, da knappen er global. Knappen vises først, når der er
  rullet mere end 200 px, så prøven skal gøres på en rullet side.

## M-11 — Programmets egne påstande om sig selv

> En tekst, der lover noget om programmets adfærd, skal måles mod adfærden — ikke læses som pynt.

Hvor programmet beskriver, hvad det gør ved brugerens oplysninger — hvad der gemmes, hvor længe, hvad
der sendes, hvad der slettes — er teksten det eneste, brugeren har at gå efter. En upræcis påstand er
derfor ikke en sproglig detalje: den er enten en forkert forventning om, hvornår arbejdet forsvinder,
eller et løfte, der ikke holder ved et eftersyn.

**Efterprøv, hvor:** en tekst beskriver programmets egen adfærd frem for at bede om en indtastning —
informationssider, bekræftelsesdialoger før destruktive handlinger, beskrivelser af en indstilling.
Prøven er altid den samme: fremprovokér det, teksten beskriver, og mål udfaldet.

**Bemærk fælden i dette mønster.** Begge fund blev første gang læst som indvendinger mod *adfærden* —
og adfærden var i begge tilfælde rigtig. Skriv derfor fundet, så det er umuligt at forveksle: adfærden
er X, teksten siger Y, og det er kun Y, der foreslås ændret. Ellers bliver et tekstfund afvist på et
adfærdsargument, alle er enige i.

**Og bemærk den anden vej.** Da modpresset blev givet, holdt kun det halve: brugeren havde ret i, at
kritikken var sat for bredt — programmet indsamler hverken persondata eller brugsstatistik, og de to
ord i teksten var sande. Et fund i dette mønster skal derfor pege på **den enkelte unøjagtighed**, ikke
på afsnittet som helhed. Ellers bliver rettelsen enten afvist som overdreven eller ender i en lang,
kringlet tekst, der er ringere end den upræcise.

- Fundet i: `om.md` BB-011 (sagen forsvinder med fanen, ikke med browseren, og «Gem» nævnes ikke) og
  BB-012 (påstanden om, at intet gemmes eller sendes, er bredere end det løfte, den skal bære) —
  **begge afgjort 2026-08-16 efter modpres: teksten er rettet, adfærden bevares.** BB-012 blev kun
  delvist accepteret; den aftalte ordlyd står i fundet.
- Efterprøvet 2026-08-18: Indstillinger-siden har **ingen** beskrivende tekst overhovedet — kun
  etiketter. Mønsteret gav derfor intet dér; det, fladen mangler, er dækket af M-12 nedenfor.
- Kandidater, ikke efterprøvet: «Slet alt»-bekræftelsen, overskrivningsadvarslen ved Hent.

## M-12 — Et valg, hvis virkning hverken kan ses nu eller findes senere

> Brugeren træffer et valg, men kan hverken se, at det skete, hvornår det gælder, eller hvordan han
> kommer tilbage.

**Mønsteret er kraftigt indsnævret af brugerens afgørelser 2026-08-18. Læs indsnævringen FØR
formuleringen — alle tre udløsende fund blev afvist.** Det oprindelige mønster samlede tre fravær og
kaldte kombinationen et problem:

1. ingen kvittering, når valget gemmes,
2. forskudt virkning (næste nye sag, et senere dokument, en validering et andet sted),
3. ingen vej tilbage (ikke i undo/redo, kan ikke gemmes eller hentes).

**Punkt 1 og 2 er afvist som fund, og punkt 3 er afvist som en egenskab, der skal oplyses.**
Begrundelserne er substantielle og gælder hele programmet:

- **Forskudt virkning er den forventede adfærd, ikke en mangel.** «Standardværdier» betyder
  standarder for nye sager og for tilstanden efter «Slet alt» — det er, hvad en fagperson forventer
  af ordet. At de beregningstekniske valg omvendt slår igennem straks, er lige så forventeligt: de
  udtrykker den tolerancegrænse, brugeren vil arbejde med lige nu. **De to forskellige tidspunkter
  er altså ikke en inkonsistens, der skal forklares.** Forslaget om en forklarende linje pr. boks
  blev afvist netop derfor (BB-023 og åbent spørgsmål 2).
- **Fravær af fortrydelse er et VÆRN.** Indstillinger må kun kunne ændres ved brugerens aktive valg;
  var de med i undo/redo, kunne ét tryk for meget ændre en indstilling, brugeren ikke havde rørt, og
  virkningen ville ramme et andet sted end fortrydelsen. Nu normativt i `app-settings.md` (BB-027).
- **Tab af indstillinger bæres bevidst.** De må aldrig følge `.eo`, og der skal ikke vises nogen
  besked, når de er faldet tilbage til standard: tilstanden er for sjælden til, at meddelelsen
  nogensinde ville blive vist. Nu normativt i `app-settings.md` (BB-025).

**Hvad der er tilbage af mønsteret — og det er stadig værd at lede efter.** Ikke «brugeren fik ingen
kvittering», men den skarpere prøve, BB-024 bestod:

> **Er et valg, brugeren har truffet, blevet til en tilstand han ikke kan komme UD af igen?**

Det var den ægte defekt på Indstillinger: farvetemaet læste computerens indstilling ved allerførste
start, og i samme øjeblik brugeren valgte lyst eller mørkt, var automatikken permanent væk. Ikke
fordi valget var uigenkaldeligt af natur, men fordi den tredje tilstand — «følg computeren» —
fandtes i programmet uden at findes i UI'et. **Det er dét, mønsteret nu handler om: en tilstand
programmet kan være i, men som brugeren ikke kan vælge.**

**Efterprøv, hvor:** et valg har færre synlige muligheder, end programmet har tilstande — typisk
hvor en startværdi udledes af omgivelserne (systemtema, dato, lokalitet, en anden sides værdi) og
derefter fryses af brugerens første valg. Prøven er: *kan brugeren komme tilbage til det, programmet
gjorde af sig selv?*

**Bemærk skellet mod M-11.** M-11 handler om tekster, der siger noget forkert om programmet. M-12
handler nu om en manglende valgmulighed — ikke om manglende forklaring. **Et fund, hvis rettelse er
«tilføj en forklarende linje», hører efter afgørelserne ovenfor ikke længere hjemme her.**

- Fundet i: `indstillinger.md` BB-024 (farvetemaet kunne ikke stilles tilbage til at følge
  computeren) — **accepteret og gennemført 2026-08-18**: `themeMode` har nu tre værdier med
  `'system'` som standard, og systemskift følges live. Reglen står i `app-settings.md`.
- Afviste fund i samme mønster: BB-023, BB-025, BB-027 — se indsnævringen ovenfor. **Genåbn dem
  ikke.**
- Bemærk forlægget på samme flade: rækken «Placering til gemte filer» viser sin tilstand ærligt,
  siger «(standard)» når valget er væk, og tilbyder «Nulstil», præcis når der er noget at nulstille.
  Den er mønsterets egen løsning, fundet i programmet selv.
- Kandidater, ikke efterprøvet: Mineo-sidens startside-toggle — men bemærk, at den har præcis to
  tilstande og dermed **ikke** har den fælde, BB-024 havde. Led i stedet efter valg, hvis startværdi
  kommer fra omgivelserne.

## M-13 — Nul er en oplysning, ikke et fravær

> Skærmen og dokumentet bruger hver sin prøve for «er der noget at vise her?», og de er kun enige,
> så længe ingen værdi er nul.

En visningsflade skjuler en række, når der ikke er nogen værdi. Et dokument skjuler den, når værdien
ikke er **større end nul**. De to prøver ser ens ud og er ens i praksis — indtil datasættet
indeholder et lovligt nul. Så viser skærmen «0 %» eller «0 kr.», og dokumentet udelader rækken
uden et ord.

Det gør nullet til to modsatte udsagn: på skærmen «satsen er nul», i dokumentet «satsen er ukendt».
For en juridisk sats er det ikke det samme — 0 % siger, at der ikke er reguleret, og det er en
oplysning, sagen kan afhænge af.

**Efterprøv, hvor:** en flade og dens dokument bygger den samme række hver for sig, og hvor
synligheden afgøres af en talprøve frem for af, om værdien findes. Prøven er: **findes der en
lovlig nulværdi i datasættet — og hvad viser de to udgaver så?** En `> 0`-prøve på synlighed er
altid mistænkelig; en `!== undefined`-prøve er den rigtige.

Bemærk den skærpede form: det gælder ikke bare rækker. En `> 0`-prøve kan også afgøre, om en hel
**kolonne** eller en hel **sektion** vises, og så forsvinder mere end én oplysning.

- Fundet i: `satser.md` BB-030 (skærmen viser «Reguleringsprocent for erhvervsevnetab (fra 2024):
  0 %» for år 2024; dokumentet udelader rækken. Gælder både PDF og Word, som deler generator).
  Der er i dag præcis ét nul i satsdatasættet, så fundet rammer ét år — men 2024 er et meget brugt
  år.
- Konkret kandidatsted, ikke efterprøvet: `src/document/generators/eo/reguleringDocument.ts` bruger
  `sats > 0` til at afgøre, om en hel kolonne vises for otte tillægssatser plus grundlønnen. Hører
  til Erstatningsopgørelse-fladen.
- Latent, ikke udløst i dag: satsdokumentets fri proces-række kræver, at alle tre beløb findes,
  mens skærmen filtrerer hver linje for sig. Uenigheden opstår først, hvis et år får to af de tre.

## M-14 — Indsat tekst samles af cifre uden hensyn til formens positioner

> Paste springer de forbudte tegn over — og for en form med faste positioner flytter det cifrene
> til de forkerte pladser.

Den afgjorte familieregel er, at indsat tekst behandles som tastning: forbudte tegn springes over
frem for at fortolkes (`docs/brugerfund-der-skal-rettes.md` BF-032, BF-040, BF-041). For et beløb
eller en procent er det harmløst — cifrenes rækkefølge og betydning er den samme, når et mellemrum
forsvinder.

For en **form med faste positioner** er reglen skadelig. Et årstal er fire pladser; en dato er
dag-måned-år. Springes separatorerne over, glider cifrene sammen til et tal, der aldrig stod i
teksten: `01-02-2026` bliver `0102` bliver `102`. Feltet opfinder altså en værdi frem for at afvise
en tekst, det ikke kunne læse.

Oven i det ligger en anden vej: paste-normaliseringen kaldes **kun**, når draften er tom. Er der en
værdi i feltet i forvejen — også når brugeren har markeret den for at erstatte den — bruges den
tegn-for-tegn-springende regel i stedet. Samme indsatte tekst giver derfor to forskellige værdier,
alt efter feltets forudgående tilstand, og brugeren har ingen mulighed for at vide hvilken.

**Efterprøv, hvor:** et felt har en form med faste positioner — år, dato, uge, måned — og kan
modtage indsat tekst. To prøver hver gang: (1) indsæt en tekst, hvor den rigtige værdi står
entydigt men omgivet af separatorer eller ord; (2) gør det både i et **tomt** og i et **udfyldt**
felt, og sammenlign de to resultater.

**Bemærk fælden.** Det ser ud som en gentagelse af M-03, som er afgjort. Det er det ikke: M-03
handler om, at indsættelse må være **mere tolerant** end tastning, når teksten uomtvisteligt kan
opløses til én værdi — og den afgørelse er netop det argument, der gør dette til et fund. Her
opløses teksten ikke; den stykkes sammen. Skriv derfor fundet, så det er tydeligt, at forslaget
udvider den trufne beslutning frem for at gå imod den.

- Fundet i: `satser.md` BB-031 (`01-02-2026` → 102 i et udfyldt felt, → 2001 i et tomt; `2.026` →
  2026 i et udfyldt felt, men → **2002** i et tomt, hvor det er en gyldig og forkert værdi uden
  nogen markering).
- Alle fire årsfelter deler codec og har derfor samme adfærd: `satser.aargang`,
  `eo.svieSmerteSatserAar`, Årslønssidens årsfelt (`aarsloenDescriptors.ts:332`) og
  Lønindkomst-tabellens `col1_maaned` (`erstatningsopgoerelseLoenDescriptors.ts:296`). De to
  sidste er tabelceller, hvor et indsat regneark er den sandsynlige kilde — efterprøv dem der.
- Kandidater, ikke efterprøvet: **datofelterne** har deres egen `normalizeDatePaste` og skal måles
  for sig; uge-felterne har egne segmentregler. Prøv især en dato indsat i et felt, der allerede
  har en dato.
