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

**Brugerens afgørelse 2026-08-16 — mønsteret har fået en nedre grænse.** Designmålet er 1920×1080 ved
125 % zoom, altså **1536×864 CSS-pixels, og opefter**. Under den bredde er afskæring accepteret, og
1366×768 er ikke en understøttet skærm. Et planlagt arbejde med automatisk skalering kan senere
udvide grænsen nedad, hvis det kan ske uden besvær.

**Mønsteret er derfor kun i spil på eller over 1536 px.** Målt: ved præcis 1536 er der 0 px
overskud — indholdet passer på stregen. Der er altså ingen margen at tære på, og enhver flade, der
lægger bare lidt mere bredde til end Om-siden, vil afskære indhold **inden for** det understøttede
område.

**Efterprøv, hvor:** en flade er bredere end den rene tekstboks — tabeller med mange kolonner,
sidestillede bokse, indhold med egen minimumsbredde. Prøven er ikke «ombryder det?», men: **passer det
inden for 1536×864, eller skæres noget væk allerede dér?**

- Fundet i: `om.md` BB-015 (sætninger skåret over ved 1366 px) — **afgjort: ikke en understøttet
  bredde**.
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
- Kandidater, ikke efterprøvet: Indstillinger-sidens beskrivelser, «Slet alt»-bekræftelsen,
  overskrivningsadvarslen ved Hent.
