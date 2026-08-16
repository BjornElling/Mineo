# Brugerblik — tværgående mønstre

Mønstre, der er fundet på én flade, men som efter deres natur kan gælde flere steder. Hvert mønster
er formuleret uden reference til den flade, det blev fundet på, så det kan efterprøves andre steder.

Et mønster her er **ikke** i sig selv et fund uden for den flade, det blev observeret på — det er en
hypotese med konkrete kandidatsteder. Bekræftede forekomster registreres som almindelige fund på den
pågældende flades dokument og noteres nedenfor.

**Brugerens afgørelser 2026-08-16 har ændret fire af de syv mønstre.** Et mønster, hvis udløsende fund
er afvist, forsvinder ikke automatisk — men det skal læses med den trufne beslutning, ellers
genopdager den næste flade et forhold, der er afgjort. Beslutningerne står i sin helhed i
`stamdata.md`; nedenfor er de skrevet ind i det enkelte mønster.

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
  den til enhver tid værende værdi i skadestype-feltet — «anmeldelsesdatoen» ved Erhvervssygdom,
  ellers «skadedatoen». Ét ord pr. begreb; «skadesdagen» udgår.
- Fundet i: `stamdata.md` BB-002 — **accepteret, skal rettes** (implementeringsforslag i fundet).
- Konkrete kandidatsteder: `src/utils/dateRangeErrorMessages.ts` linje 118 og 139; beskeden «Datoen
  kan ikke være før skadesdagen (…)», som nås fra mindst seks erklæringssteder i
  `erhvervsevnetabDescriptors.ts`, `varigeMenDescriptors.ts` og `config/dateRanges.ts`; teksten
  «Grænserne kommer fra Fødselsdato og Skadedato».
- Bemærk også ordvalget: «skadedatoen» og «skadesdagen» bruges om det samme.

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
