# Brugerblik – tværgående mønstre

Mønstre, der er fundet på én flade, men som efter deres natur kan gælde flere steder. Hvert mønster
er formuleret uden reference til den flade, det blev fundet på, så det kan efterprøves andre steder.

Et mønster her er **ikke** i sig selv et fund uden for den flade, det blev observeret på – det er en
hypotese med konkrete kandidatsteder. Bekræftede forekomster registreres som almindelige fund på den
pågældende flades dokument og noteres nedenfor.

**Udviklerens afgørelser 2026-08-16 har ændret fire af de syv første mønstre.** Et mønster, hvis
udløsende fund er afvist, forsvinder ikke automatisk – men det skal læses med den trufne beslutning,
ellers genopdager den næste flade et forhold, der er afgjort. Beslutningerne står i sin helhed i
`stamdata.md`; nedenfor er de skrevet ind i det enkelte mønster.

**To nye mønstre 2026-08-27 fra Forsørgertab – M-25 og M-26 – og de handler begge om en GRÆNSE, der er
tegnet det forkerte sted.** M-25 (gaten spørger «findes der noget?», ikke «findes det, brugeren bad om?»)
er den tungeste: Forsørgertabs dokumentgate godkendes af ENTEN en EAL-del ELLER en ASL-del, så en
efterladt under 18 år – et alderstrin, kapitaliseringstabellen ikke har – lader hele ASL-halvdelen
forsvinde uden en rød celle, uden en advarsel og med **aktiv** downloadknap; det hentede dokument
mangler både de fire ASL-oplysninger, brugeren har indtastet, og hele fradraget på `1.065.384 kr.`
(BB-117). M-26 (et delt felt med to hjem) er den bredeste: de to årslønsfelter er ÉN descriptor, der
renderes af både Forsørgertab og Erhvervsevnetab med hver sine labels og hver sin parallelle gule
advarsel – tre navne pr. felt og to ordlyde for samme udløser (BB-123, BB-124), og ingen af siderne
siger, at en rettelse det ene sted ændrer det andet. **Samme kørsel gav nye forekomster af M-02
(BB-120, BB-121 – BB-072's navngivne kandidat bekræftet), M-07 (BB-127), M-13 (BB-122, BB-125, BB-130,
BB-132), M-14 (BB-118 – mønsterets dyreste form hidtil: `400.000,00` indsat bliver `4.000.000` uden et
ord), M-16 (BB-117) og M-24 (BB-119 – klampningen ligger i AGGREGATET, ikke i et felt; **fundet er
afvist 2026-08-28, og afvisningen indsnævrer M-24 – læs mønsteret i sin nye form**).** M-19, M-22 og
M-10 er efterprøvet og **bestået**; M-23 er uden genstand.

**Efterskrift 2026-08-27, og den hører til M-11's familie.** To af fladens tre åbne spørgsmål er afgjort
af udvikleren, og **begge mine antagelser var forkerte – begge fordi jeg sluttede en domæneoplysning af
mekanikken.** Jeg læste et manglende feltloft som et manglende loft (loftet ligger på det BEREGNEDE
beløb og indregnes allerede), og jeg læste et kønsopdelt tabelopslag på efterladtes alder som opdelt
efter efterladtes køn (det er skadelidtes). **Læren, der bliver stående: en parameters ejer og en
grænses placering er domæneoplysninger, ikke kodeoplysninger – de skal spørges om, ikke udledes af,
hvilket opslag værdien indgår i.** Begge svar gav samtidig hvert sit nye fund (BB-133 og BB-134), så
prisen ved at spørge var alene tid – præcis som `STATUS.md`'s observation om de otte tidligere spørgsmål.

**To nye mønstre 2026-08-25 fra Årslønsberegning – M-23 og M-24 – og de er begge om BEREGNINGENS
grundlag, ikke om dens formel.** Det er nyt for programmet: de 22 hidtidige mønstre handler om, hvad
programmet siger, viser, skjuler eller blokerer. M-23 (aggregatet af-dublerer tiden, men ikke pengene)
og M-24 (et felts grænse er sat af feltets egen art, ikke af det tal det trækkes fra) handler om, at
det regner rigtigt på et forkert grundlag – og i begge tilfælde er der **intet** rødt felt og ingen
advarsel. Målt på Årsløn: to identiske lønrækker fordoblede årslønnen til `793.500,00 kr.`
(BB-096), og 99 feriedage i en måned med 23 hverdage gav `-76 hverdage` og årslønnen `0,00 kr.` med
aktiv downloadknap (BB-097). Prøven for begge er billig og hører på hver flade med en periodetabel.
**Samme kørsel gav nye forekomster af M-02 (BB-107, BB-113), M-07 (BB-107 – mønsterets NAVNGIVNE
kandidat, `DATE_ORDER_ERROR_MESSAGE`, bekræftet), M-13 (BB-108, BB-109, BB-111), M-16 (BB-098, BB-105)
og M-19 (BB-110).** M-22 er derimod efterprøvet og **bestået**: BB-080's rettelse navngiver Stamdata på
en flade uden en eneste stamdataoplysning.

**Ingen nye mønstre 2026-08-24 fra Renteberegning → Satser, men tre nye forekomster – og den ene
vender en forudsigelse på hovedet. Alle tre er afgjort 2026-08-25.** Fanen er et rent opslagsværk (to
tabeller, ingen felter, ingen knapper, intet dokument), så M-16, M-19 og M-22 er uden genstand dér.
**M-11 havde denne fane som navngiven kandidat, og kandidaten holdt ikke** – lovhenvisningerne kan
ikke måles mod noget andet sted i programmet, fordi satserne kun vises her, og BB-075's stramning
kræver to *uforenelige* henførsler – men de var **forkerte**, hvilket udvikleren afgjorde 2026-08-25:
begge satser har hjemmel i § 5, stk. 1 (tillægget i 1. pkt., referencesatsen i 2. pkt.), og
henvisningerne er rettet. Læren: umålelig er ikke det samme som rigtig, så en enkeltstående
lovhenvisning skal rejses som spørgsmål. Dertil stod i samme boks en påstand, der KUNNE måles, og den
var forkert: fanens og beregningsforudsætningens «forfaldsdato» mod beregningens rentedato (BB-092,
**gennemført** – teksten navngiver nu rentedatoen, og beregningen står uændret). **Læren er, at
kandidatlisten pegede på den forkerte halvdel af sætningen** – en lovhenvisning er svær at måle,
mens en påstand om HVILKEN DATO der styrer et tal kan fremprovokeres på ét forsøg. Dertil er
**M-15's spor LUKKET for hele programmet** (BB-094 afvist som BB-040) og **M-13's fjerde form afvist**
(BB-095, fortegnets skrivemåde).

**M-22 er tilføjet 2026-08-21 fra Renteberegning → Beregning og afventer udvikleren.** Det er det
bredeste mønster siden M-21 og det første, der handler om en afhængighed på tværs af FLADER: hver af
programmets dokumentdefinitioner kræver en `ready` stamdataprojektion, uanset om dokumentet trykker
et brevhoved. En rød dato i Stamdata slukker derfor downloadknapperne på flader, der ikke viser en
eneste stamdataoplysning – målt på tre flader, hvoraf Satser er den skarpeste (opslagsværk, brevhoved
som standard slået fra). Læs mønsteret sammen med **M-19**: de flader, der spejler stamdata, fik
BB-064's rettelse og kan derfor vise årsagen; de flader, der ikke spejler stamdata, havde intet sted
at skrive den og står tilbage med en grå knap uden afsender.

**Samme dag har M-13, M-14 og M-16 fået hver sin nye forekomst** fra samme flade, og de er alle tre
sat i deres skarpeste hidtidige form:
- **M-13:** de to dokumenter fra ÉN fane skriver samme dato i to formater (BB-087). Prøven er nu ikke
  kun skærm mod dokument og ikke kun inden for én skærm, men **dokument mod dokument fra samme flade**.
  Beløbsformen var til gengæld enig alle tre steder – Varige méns nuldecimalregel er korrekt ikke
  bredt hertil.
- **M-14:** den første målte oplevelse af mønsterets sidste uafprøvede kandidat, en **tabelcelle med
  et indsat regneark** (BB-088). Tre beløb på tre linjer bliver ÉN afvist værdi. Adfærden følger
  udviklerens paste=tastning-regel, men reglen tager ikke stilling til linjeskiftet – og linjeskiftet er
  netop det, et regneark leverer.
- **M-16:** mønsterets **rene mangel-form** (BB-083). BB-037/BB-038 flyttede fanens to
  motorafvisninger ind i feltmodellen; en række med beløb og uden dato blev ikke omfattet, så et
  aggregat spærres fortsat af én række, intet peger på.

**Ingen nye mønstre 2026-08-21 fra Varige mén → Satser, men to skærpelser – og alle fem fund er
afgjort samme dag** (BB-078/BB-079 gennemført som én rettelse, BB-075/BB-076/BB-077 afvist). Fanen
er for lille til at bære et mønster (én tabel, ingen felter), og dens fund faldt i to eksisterende:
**M-11 har fået en skærpelse** – en lovhenvisning eller anden angivelse af, hvor et TAL kommer fra,
er lige så meget en påstand som en tekst om programmets adfærd, og den måles ved at finde samme tal
et andet sted i programmet. Men **BB-075's afvisning strammer prøven**: et fund kræver, at de to
henførsler er *uforenelige*, ikke blot forskelligt afgrænsede. **M-13 har fået to nye forekomster**,
som udvider dens prøve: uenigheden om formen kan stå på ÉN skærm (BB-079), og den kan ligge latent i
forskellige formateringskald for samme værdi (BB-078). Begge er rettet.

**M-19, M-20 og M-21 er tilføjet 2026-08-20 fra Varige mén → Ménberegning; alle tre er afgjort
2026-08-20** (M-19 og M-20 gennemført, M-21's udløsende fund afvist – se hvert mønster). De tre er
ikke varianter af hinanden, men de blev fundet i samme lille flade og deler et træk: hver af dem er et sted, hvor programmet **kender** det rigtige svar og viser noget andet.
M-19 handler om, at et rødt felt læses som et tomt felt af den flade, der låner værdien – så skærmen
siger «Mangler» og citerer tre linjer længere ned den værdi, den siger mangler. M-20 om en feltnær
oplysning (en gul advarsel), der er hængt op på hele sidens beregning og derfor er tavs, indtil
felter uden forbindelse til den er udfyldt. M-21 om en farve, komponenten beder om, og som
programmets eget stylesheet slår ihjel på grund af specificitet – målt syntetisk, så mekanismen står
fast. **M-19 har allerede sin løsning i programmet selv** (Forsørgertabs tilsvarende flade gør det
rigtige), og **M-02 har fået en skærpelse samme dag** (BB-072: de AFLEDTE labels følger ikke
skadestypens navneregel).

**M-17 og M-18 er tilføjet 2026-08-19 fra Global shell og BEGGE afgjort og gennemført samme dag.**
M-17 handler om én oplysning, der er gemt i to lagre med hver sin rækkevidde, så de kan komme til at
beskrive hver sin sag; M-18 om globale tastaturgenveje, der arbejder videre bag et åbent overlay, som
efter programmets eget regelsæt ejer tastaturet. Begge er nu normative i kontrakterne
(`persistence-contract.md` §5 henholdsvis `keyboard-navigation.md` §Overlay-adfærd), og begge
rettelser er mutationstestede. **Samme dag har M-06 og M-08 fået hver sin skærpelse** – læs dem i
den nye form. M-06's udløsende fund (login-trimmet) er gennemført; **M-08's er derimod AFVIST**:
udvikleren fastholder, at Tab-ringen findes for at understøtte hurtig indtastning på ÉN side, og at
navigation mellem sider og faner må være mus-drevet.

**M-15 og M-16 er tilføjet 2026-08-19 fra MinProcesrente og afgjort samme dag** (M-15 afvist for
MinProcesrente, M-16 gennemført for rentetabellen – se hvert mønster). M-15 er
spejlbilledet af M-13: dokumentet bærer et forbehold, skærmen har ingen pendant. M-16 handler om
rækker, der er komplette og fejlfri felt for felt, men som motoren afviser af en grund, feltmodellen
ikke kender – hvorved afvisningen kommer ud som et fravær og spærrer hele fladens dokumenter.
**Samme dag er M-14's sidste åbne kandidat efterprøvet og bekræftet** (datofelternes paste), og
M-02 og M-09 har fået hver sin skærpelse – læs dem i den nye form.

**M-13 og M-14 er tilføjet 2026-08-18 fra Satser-fladen og BEGGE afgjort samme dag.** De handler om, at
to steder i programmet træffer den samme afgørelse hver for sig og bliver uenige: M-13 om skærmens og
dokumentets prøve for «er der noget at vise», M-14 om paste-vejen i et tomt kontra et udfyldt felt.
Fælles for dem er, at uenigheden er usynlig for brugeren, og at den kun opstår i et hjørne af datasættet –
derfor er begge fundet ved at tælle rækker og sammenligne udgaver, ikke ved at læse koden.
**Begge er accepteret og gennemført i kode.** M-14 er samtidig omskrevet: dens oprindelige præmis (at
tegn-for-tegn-reglen er skadelig for positionsformer) blev afvist, og mønsteret handler nu om den
konkurrerende fortolkningsvej – læs det i den nye form.

**Fire af Satser-fladens seks fund blev afvist, og afvisningerne indsnævrer fire prøver mærkbart.** De er
skrevet ind i `satser.md` ved hvert fund; kort her, fordi de gælder alle senere flader:
- Et tilladt interval behøver ikke annonceres, hvis brugere i praksis aldrig rammer grænsen.
- Fælles navn på forskellige visningsformer er ikke en inkonsistens, når formen følger et fagligt behov.
- En fagligt velkendt lovhenvisning (fx «(fra 2024)») behøver ingen forklaring; målgruppen er erfarne
  praktikere.
- Et informationsikons indhold er ikke automatisk noget, dokumentet mangler.

**Og en overordnet afgørelse:** Mineo er en samling **selvstændige værktøjer**, og brugeren forventes at
vide det. Et fund af formen «brugeren kan tro, at denne side hænger sammen med den anden» kræver derfor, at
der faktisk ER en kobling, som virker anderledes end den ser ud – ikke at koblingen mangler.

**M-08 til M-11 er tilføjet 2026-08-16 fra Om-fladen.** De adskiller sig fra M-01–M-07 ved ikke at
handle om indtastning: de handler om siden som helhed – tastaturets rækkevidde, vinduets bredde,
flydende elementer og de tekster, hvor programmet udtaler sig om sig selv. **Tre af dem er skrevet om
samme dag efter udviklerens afgørelser** (M-08 afgjort for bundlinjen, M-09 har fået en nedre grænse,
M-10 er skærpet); M-11 står uændret med to gennemførte tekstrettelser bag sig.

---

## M-01 – Kontekstuelle feltnavne

> Et valg ændrer, hvad en allerede indtastet værdi betyder, uden at værdien eller brugeren følger med.

Når et felts navn, enhed eller rolle afhænger af et andet valg, skifter betydningen af den værdi, der
allerede står i feltet, i samme øjeblik valget ændres. Værdien er uændret; det, den betyder, er ikke.

**Efterprøv, hvor:** et valg styrer en label, en enhed (kr./%), en tidsenhed, en beregningsmetode
eller hvilken af to regler et felt læses efter.

- Fundet i: `stamdata.md` BB-001 (Skadestype → Skadedato/Anmeldelsesdato) – **fundet er afvist af
  udvikleren 2026-08-16**: skadestypen er en deskriptiv angivelse af sagen, og datoen er den samme
  sagsdato under begge navne. Den blotte omdøbning af et felt er dermed **ikke** et fund.
- **Mønsteret er derfor skærpet:** det, der tæller, er ikke navneskiftet, men om valget ændrer, hvad
  programmet *regner* eller *tillader* med den værdi, der allerede står. Netop dét gør skadestypen
  (EO's nedre datogrænse flytter sig fem år), og det er registreret som åbent spørgsmål 1 i
  `stamdata.md` – ikke som en navnesag.
- Kandidater, ikke efterprøvet: felter styret af «Tillæg angives som» (procent/beløb), «Beregnes ud
  fra», og enhver tidsenhedsvælger ved siden af et tal. Efterprøv dem på den skærpede formulering:
  skifter *beregningen* eller *grænserne*, ikke bare ordet.

## M-02 – Beskeder med hardkodede feltnavne

> En besked navngiver et felt med et navn, feltet ikke bærer på skærmen.

Programmet har én mekanisme til, at et felt ejer sit eget navn, så label og besked ikke kan sige hver
sit. Beskeder, der har navnet skrevet ind i teksten, omgår mekanismen.

**Efterprøv, hvor:** en fejl-, advarsels- eller tooltiptekst nævner et feltnavn i prosa i stedet for
at hente det fra feltet – og hvor to tekster om samme begreb bruger forskellige ord for det.

**Skærpelse 2026-08-20 (fra `varigemen.md` BB-072) – de AFLEDTE labels blev ikke omfattet.**
Udviklerens navneregel (nederst i dette mønster) er gennemført for datofeltet selv og for
fejlbeskederne: på en erhvervssygdomssag hedder rækken «Anmeldelsesdato», og beregningsdatoens fejl
siger «kan ikke være før anmeldelsesdatoen (01-06-2020)». Men de labels, der beskriver noget
**udledt af** datoen, står uændret: «Alder på skadestidspunkt» to linjer under den række,
programmet netop omdøbte – og alderen er regnet på præcis den anmeldelsesdato. Samme faste ordlyd
findes på EET efter EAL og Forsørgertab og i tre dokumentgeneratorer («Årsløn på skadestidspunktet»,
«Skadelidtes alder på skadestidspunkt»). **Prøven er derfor bredere end feltnavne og fejltekster:
sæt skadestypen til Erhvervssygdom og læs HELE fladen igennem – hver sætning, der siger «skade»
om sagens dato, er en kandidat.** Bemærk, at kilden findes: `resolveSkadestypeDatoLabel` er allerede
kaldt på de fleste af fladerne til rækken lige ovenover.

**Gennemført 2026-08-28 (fra `forsoergertab.md` BB-121) – og rettelsen afdækkede, hvorfor princippet
ikke virkede.** BB-072's skærpelse ovenfor blev implementeret, og teksterne blev alligevel ved med at
sige «skade». Årsagen lå ikke i teksterne: **to reader-projektioner udelod `skadestype`, når de byggede
snapshottets stamdata** – på Erhvervsevnetab blev feltet endda LÆST og derefter ikke videregivet. Hvert
opslag af `stamdata?.skadestype` på begge flader gav derfor `undefined`, og alt faldt tilbage til
standardnavnet, mens rækken øverst – som læste gennem readeren i stedet – korrekt sagde «Anmeldelsesdato».

**Læren er generel og værd at bruge, næste gang et implementeret princip ikke slår igennem:** når to
kanaler viser samme oplysning og kun den ene er rigtig, så tjek FØRST om den forkerte kanal overhovedet
FÅR de data, den skal træffe valget på. En manglende linje i en projektion er usynlig i både typer og
tests – feltet er valgfrit, `undefined` er en gyldig værdi, og fallbacken ser fornuftig ud.

Samme rettelse viste desuden, at referencen skal bære **alle** de former, teksterne bruger. Den bar kun
datoens navn (`label`/`labelLower`), så «skadestidspunkt» og «skadesår» blev hardkodet – eller skrevet som
en inline ternary de to steder, der gjorde det rigtigt. En reference, der kun dækker halvdelen af
formerne, inviterer til den kopi, mønsteret handler om.

**Skærpelse 2026-08-19 (fra `minprocesrente.md` BB-043).** Mønsteret rammer ikke kun beskeder med et
feltnavn skrevet ind i prosaen. Det rammer også beskeder, der **genkender en grænse på dens værdi i
stedet for på dens ophav**: den fælles dato-fejlregel svarer «Datoen er efter dags dato», så snart
maksimum tilfældigvis er lig med i dag – også når maksimum i virkeligheden er et andet felts værdi.
Brugeren får dermed en forklaring, der peger på kalenderen frem for på det felt, han skal rette. Prøven
er: **kan beskeden skifte ophav, uden at grænsen skifter værdi?** Så er den udledt forkert.

**Gennemført 2026-08-19 for dato-fejlreglen.** «Dags dato»-grenen kræver nu, at grænsen faktisk ER
kalenderen (`bounds.kind === 'static'`), og en udledt grænse navngiver sin kilde i stedet. Konstruktionen
var i forvejen på plads: `DateBoundsSpec.origin` VIDSTE, at grænsen kom fra Beregningsdato – beskeden
spurgte blot ikke. Det er den generelle lære: når en besked genkender noget på en værdi, findes ophavet
ofte allerede i erklæringen ved siden af.

- **Udviklerens regel 2026-08-16 (bindende for hele programmet):** navngivningen i beskeder skal følge
  den til enhver tid værende værdi i skadestype-feltet – «Anmeldelsesdato» ved Erhvervssygdom,
  ellers «Skadedato». De to betegnelser er de eneste korrekte brugervendte betegnelser.
**Ny forekomst 2026-08-25 (fra `aarsloen.md` BB-113) – mønsterets rene prosa-form, tre navne for ét
felt på én skærm.** Feltet hedder «Feriegodtgørelse/-tillæg»; den ene advarsel kalder det
«feriepengesats», den anden «feriegodtgørelsessats». Begge tekster er hardkodet prosa i
`beregnFejlmeddelelser`/`shouldWarnAarsloenFeriePct`. **Nabofeltet «SH/SO-sats» er derimod korrekt i
alle fire tekster** – det er værd at bemærke, fordi det viser, at fejlen ikke er systemisk i modulet,
men opstod ét felt ad gangen. Prøven er billig og hører på hver flade med prosa-advarsler: **læs hver
advarsel og find det felt, den navngiver, på skærmen.** Samme kørsel gav en anden forekomst gennem
M-07: `DATE_ORDER_ERROR_MESSAGE` siger «Til-**dato**» i et **ugefelt** (BB-107).

**To nye forekomster 2026-08-27 fra Forsørgertab, og den ene lukker mønsterets ældste navngivne
kandidat.** (1) **BB-121 bekræfter BB-072's forudsigelse:** på en erhvervssygdomssag omdøber fladen
korrekt rækken til «Anmeldelsesdato» og skriver tolv linjer længere nede «Skadelidtes årsløn på
skadestidspunktet», «Regulering fra skadesår 2020 …» og «Skadelidtes alder på skadestidspunkt» – om
præcis den anmeldelsesdato. Samme tre sætninger står i dokumentet. Kilden findes:
`resolveSkadestypeDatoLabel` kaldes allerede til rækken ovenfor. (2) **BB-120 er mønsterets reneste
form hidtil:** feltet heder «Startdato for ASL-ydelse» på skærmen, i oplæsningen og i dokumentet, og
melder «**Virkningsdato** kan senest være 31. december 2026», fordi descriptoren bærer en parallel
streng `maxBoundFieldLabel: 'Virkningsdato'` ved siden af sin egen `label`. **Prøven er ny, billig og
mekanisk: `rg "maxBoundFieldLabel|minBoundLabel" src/inputCore/catalog` og sammenlign hver streng med
samme descriptors `label`.** Enhver forskel er et fund, uden at fladen skal åbnes.

- Fundet i: `stamdata.md` BB-002 – **accepteret, skal rettes** (implementeringsforslag i fundet).
- Konkrete kandidatsteder: `src/utils/dateRangeErrorMessages.ts`; den fælles besked
  om en dato før stamdatodatoen, som nås fra mindst seks erklæringssteder i
  `erhvervsevnetabDescriptors.ts`, `varigeMenDescriptors.ts` og `config/dateRanges.ts`; teksten
  «Grænserne kommer fra Fødselsdato og Skadedato».
- Bemærk også, at alle tekster om samme dato skal bruge den samme korrekte betegnelse.

## M-03 – Tastning og indsættelse accepterer ikke det samme

> Feltet kan læse en form, brugeren ikke må taste – eller omvendt.

**Afgjort af udvikleren 2026-08-16: forskellen er tilsigtet og er ikke i sig selv et fund.** Tastning må
ikke begynde at tolke på det tredje indtastede ciffer – `16` kan være både den 16. og den 1. juni, og
en automatisk separator ville låse den usikre fortolkning fast. Indsættelse kender derimod hele
teksten på én gang, og kan den uomtvisteligt opløses til én sikker værdi, skal programmet gøre det.
**Indsættelse må altså gerne være mere tolerant end tastning.**

Tilbage af mønsteret står den omvendte retning og et enkelt restforhold:

- **Er der felter, hvor TASTNING accepterer mere end indsættelse?** Det ville være den forkerte vej og
  er stadig værd at lede efter.
- **Er der felter, hvor indsættelse afkorter en tekst, der uomtvisteligt kunne læses?** Det er den
  brugervenlighed, afgørelsen bygger på, og den skal så gælde alle familier.

**Efterprøv, hvor:** et felt har både et tegn-/længdeværn og en normalisering af indsat tekst – dvs.
alle dato-, år-, uge-, beløbs- og procentfelter.

- Fundet i: `stamdata.md` BB-003 (dato tastet som `010623` → `01`; samme tekst indsat → `01-06-2023`)
  – **afvist**; adfærden bevares.
- Kandidater, ikke efterprøvet: uge- og årsfelterne (egne segmentregler), beløbsfelter med
  tusindseparator, procentfelter.

## M-04 – Feltets længdegrænse skal blokere, og værdien skal kunne læses

> Ved en tegn- eller cifferegrænse afskæres brugeren fra at skrive mere – og han skal kunne læse det,
> der står.

**Udviklerens regel 2026-08-16:** hvor der er en grænse for antal tegn eller cifre, skal brugeren
effektivt afskæres fra at indtaste flere. Det gælder universelt i hele programmet.

**Reglen er allerede indført og målt** (kontraktens §1.2, håndhævet 2026-08-15): værnet ligger på
draft-ændringen, grænsen er påkrævet i codec-typen, og `fieldCharLengthPolicy.test.ts` måler hvert
enkelt produktionsfelt. Et for langt **paste** afkortes efter §1.2a's regel «paste behandles som
tastning» – også det en truffet beslutning (2026-08-09). Mønsteret er derfor **ikke** længere «lydløs
afkortning er et fund».

Det, der stadig skal efterprøves på hver flade, er de to reelle rester:

1. **Passer grænsen til feltet?** Et felt, der er tegnet til initialer, men tager imod 60 tegn, har en
  grænse, brugeren aldrig rammer – den afværger intet. **Udviklerens målestok 2026-08-16:** antallet af
   tilladte tegn skal svare til det **synlige** indhold i feltet. De to initialfelter går derfor fra 60
   til 6 tegn. Spørg på hver flade, om et felts kategori er valgt – eller bare arvet.
2. **Kan brugeren læse værdien bagefter?** En værdi, der er bredere end feltet, uden tooltip og med
   centreret tekst, kan hverken læses eller kontrolleres. Efter punkt 1 er dette kun et spørgsmål, hvor
   et felt reelt kan rumme mere tekst, end det viser – konkrete kandidater: EO's bilagsnumre-felter
   (60 tegn) og smalle tabelceller. På Stamdata er spørgsmålet lukket.

**Efterprøv, hvor:** feltets synlige bredde er mindre end den tilladte længde, og hvor grænsen er
arvet fra en kategori frem for valgt til feltet.

- Fundet i: `stamdata.md` BB-004 (60 tegn i et 80 px-felt, ca. 6 tegn synlige) – **afgjort**: ny
  længdekategori på 6 tegn til initialfelterne (implementeringsforslag i fundet).
- Kandidater, ikke efterprøvet: alle korte tekstfelter (samme grænse på 60 tegn), de flerlinjede
  kommentarfelter (512), samt smalle tabelceller med lange værdier.

## M-05 – Ingen rimelighedskontrol af lovlige, men usandsynlige værdier

> Grænsen er sat vidt for ikke at opfinde en regel, og derfor fanger den kun det umulige.

En vid grænse er det rigtige valg, når der ikke findes en juridisk regel – men den efterlader et
stort felt af værdier, der er tilladte og næsten sikkert forkerte. En ikke-blokerende advarsel er
formen, programmet allerede bruger andre steder.

**Efterprøv, hvor:** en grænse er beskrevet som «bevidst vid», og hvor værdien driver en beregning
langt fra det sted, den blev indtastet.

- Fundet i: `stamdata.md` BB-005 (2-årig skadelidt accepteres uden signal) – **afvist 2026-08-16**:
  der skal ikke være nogen nedre aldersgrænse, heller ikke som advarsel. Nyfødte og små børn er
  lovlige skadelidte. **Alder er dermed lukket som emne**; spørg i stedet, om beregningerne regner
  rigtigt på dem.
- Fundet i: `stamdata.md` BB-009 (tocifret fødselsår fortolkes fremadrettet) – **afvist 2026-08-16**:
  der skal være **én** gennemgående regel for tocifrede årstal, og den nuværende (27-31 → 2027-2031 i
  2026) er den rigtige. Et felt må ikke få sin egen årsfortolkning.
- Kandidater, ikke efterprøvet: beløb, der afviger en faktor 10 eller 1000 fra sagens øvrige beløb;
  procenter indtastet som decimal; datoer årtier fra sagens øvrige datoer. **Bemærk grænsen for
  mønsteret efter afgørelserne:** en advarsel kan foreslås, hvor værdien er usandsynlig *i sagens egen
  sammenhæng* – ikke hvor den blot er usædvanlig i almindelighed.
- **Yderligere grænse, afgjort 2026-08-18 (`satser.md`, åbent spørgsmål 2):** mønsteret gælder kun
  felter, der er sagsdata i beregningsmæssig forstand. Et **opslagsfelt** har ingen sagssammenhæng at
  være usandsynlig i: Satser-sidens satsår må frit sættes til 2007 i en 2024-sag, fordi det netop er
  opslagsværkets formål. Spørg derfor først, om feltet indgår i en beregning – ikke blot om programmet
  kender to tal, der kunne sammenlignes.

## M-06 – Usynlige tegn overlever fra indsættelse

> Tekst indsat fra et tekstbehandlingsprogram bærer tegn, brugeren ikke kan se.

Hårde mellemrum, tabulatorer og linjeskift følger med fra Word og Excel og bliver stående i værdien.
Brugeren ser noget, der ligner mellemrum. Værdien går videre i dokumenter og kan ikke sammenlignes
pålideligt.

**Efterprøv, hvor:** et fritekstfelt tager imod indsat tekst.

**Skærpelse 2026-08-19 (fra `globalshell.md` BB-055).** Mønsteret er ikke kun et spørgsmål om, at en
usynlig tegnrest følger med VIDERE i en værdi. Det er også, at to steder i samme flade kan være
uenige om, hvad værdien ER: login-siden trimmer teksten, når den afgør «har brugeren skrevet noget»,
men IKKE når den afgør «er adgangskoden rigtig». Den korrekte adgangskode med ét afsluttende
mellemrum afvises derfor som forkert, og feltet viser prikker, så resten er usynlig. Prøven er:
**normaliserer alle led i den samme beslutning teksten ens?** Et trim i valideringen og ikke i
sammenligningen er to sandheder om det samme felt.

Bemærk også asymmetrien, fundet afdækkede: adgangskoden er bevidst tolerant over for STORE og små
bogstaver, men intolerant over for et blanktegn, brugeren ikke kan se. Hvor et felt allerede HAR en
tolerance, er det værd at spørge, om den dækker den fejl, brugeren faktisk laver.

**BB-055 er accepteret og gennemført 2026-08-19.** Trimmet ligger i `hashPassword`, altså præcis dér
hvor case-neutraliseringen allerede boede – ét sted afgør, hvad adgangskoden ER. Rettelsen er
normativ i `auth-gate-contract.md` §2.3, og prøven skelner de to ting: enderne trimmes, mens
blanktegn INDE i koden fortsat er betydende. **Den generelle lære: læg normaliseringen dér, hvor den
eksisterende normalisering bor, frem for et lag tidligere.** Et trim i kalderen ville have lukket
netop dette hul og efterladt den næste kalder med samme fejl.

- Fundet i: `stamdata.md` BB-007 – **accepteret 2026-08-16, skal rettes** med ét delt
  normaliseringstrin før feltets egen paste-behandling. Udviklerens forbehold er, at det ikke må
  forstyrre de øvrige normaliseringer; det er efterprøvet og skal måles af en ækvivalenstest pr.
  familie (implementeringsforslag i fundet).
- Kandidater, ikke efterprøvet: alle fritekst- og kommentarfelter. Tal-, dato- og procentfelter har
  hver sin normalisering og er verificeret upåvirkede (de filtrerer på tegnsæt eller udtrækker cifre).

## M-07 – Parvise grænser: begge felter markeres, hver med sin egen udvej

> To felter, der afgrænser hinanden, skal begge markeres – og hver tekst skal sige, hvad brugeren kan
> gøre i netop det felt.

**Udviklerens regel 2026-08-16:** udløser to felters værdier tilsammen en fejl, gives der fejl i begge.
Løsningen er forskellig i hvert felt, og teksten skal afspejle den udvej, feltet selv har. Forslaget om
kun at markere det senest ændrede felt er afvist.

Mønsteret er dermed vendt om: det er ikke dobbeltmarkeringen, der skal efterprøves, men om de to
tekster er **hinandens spejlbillede set fra hvert sit felt** – eller om de begge beskriver problemet
fra det ene felts synsvinkel, så det andet felt beder brugeren rette noget, han ikke kan rette dér.

**Efterprøv, hvor:** to felter afleder hinandens grænser: fra/til-perioder, afgørelses- og
virkningsdatoer, kapitaliseringsdatoer, min-/maks-par.

- Fundet i: `stamdata.md` BB-010 – markeringen bevares; **ordlyden skal rettes** (forslag i fundet).
- Kandidater, ikke efterprøvet: alle periodetabeller med fra/til-kolonner. Bemærk især den fælles
  `DATE_ORDER_ERROR_MESSAGE`, som begge parter i et fra/til-par får i dag – samme tekst på to felter
  med hver sin udvej.
- **Kandidaten er bekræftet 2026-08-25 på Årsløn** (`aarsloen.md` BB-107, Mellem, afventer udvikleren).
  Uge fra `10/2025` + Uge til `05/2025` gør begge celler røde med ordret samme tooltip: «Til-dato skal
  være efter fra-dato». Samme i datotilstand. **To skærpelser af mønsteret følger af målingen:**
  (1) teksten er skrevet fra TIL-feltets synsvinkel, så FRA-feltet beder brugeren rette noget, han
  ikke kan rette dér – præcis den form, udviklerens regel af 2026-08-16 forbyder; (2) den samme
  konstant bruges af **ugefelter**, så beskeden siger «dato» om to ugenumre – mønsteret overlapper
  dermed M-02. **Løsningen findes allerede i programmet:** BF-028 gav EO's dato-par den modgående
  dato i hver tooltip. Årsløns tabel står med den gamle form, så en rettelse er en konvergens, ikke
  et nyt design.
- **Ny forekomst 2026-08-27 på Forsørgertab, og den viser mønsterets HALVE form** (`forsoergertab.md`
  BB-127, Mellem). Beregningsdato `01-07-2025` + Startdato for ASL-ydelse `31-12-2030` gør begge felter
  røde – dobbeltmarkeringen er altså i orden – men kun det ene har en tekst med afsender:
  Beregningsdato får «Der findes ingen gyldig dato her … Grænserne kommer fra Anmeldelsesdato og
  Startdato for ASL-ydelse», mens Startdato for ASL-ydelse får den bare `validateISODateRange`-tekst
  «Dato skal være mellem 10-06-2020 og 01-07-2025». **Læren er, at mønsterets to halvdele fejler
  uafhængigt:** en flade kan have dobbeltmarkeringen på plads og stadig efterlade det ene felt uden
  udvej. Prøven skal derfor køres på BEGGE felter, ikke kun konstateres på det ene. Bemærk desuden en
  ny svaghed i den ellers gode tekst: «senest tilladte (31-12-2026)» kommer fra datadækningen, ikke fra
  nogen af de to felter, årsagssætningen navngiver – en årsagssætning må kun navngive de grænser, den
  faktisk forklarer.

## M-08 – Links er ikke med i tastaturrækkefølgen

> Et link kan kun nås med mus, fordi sidens tastaturrækkefølge kun optager felter og markerede knapper.

Programmet ejer selv Tab: tasten flytter fokus i en cirkulær ring, der samles af én selector. Den
optager felter, dropdowns og de knapper, der udtrykkeligt er markeret som fokuserbare – men ingen
`<a>`. Da programmets egen Tab-håndtering samtidig afbryder browserens, findes der ingen anden vej til
et link end musen.

**Udviklerens afgørelse 2026-08-16 (gælder bundlinjen):** boksen med søskendesider – og dermed også
kontaktadressen i den – skal **ikke** være en del af tastaturrækkefølgen, og GitHub-linket er
undtaget specifikt. Fraværet er dér et valg.

**Mønsteret er derfor omformuleret:** eksterne web-links er nu eksplicit ude af tastaturrækkefølgen
via den fælles `ExternalLink`-primitive, mens interne links fortsat vurderes efter deres egne
specifikke regler. Containerens selector optager stadig felter og markerede knapper og aldrig et
`<a>`; den generelle eksterne regel gør derfor fraværet auditérbart i DOM'en på alle flader.

**Efterprøv, hvor:** et link bærer noget, brugeren skal kunne handle på – retsinfo-henvisninger,
«gå til feltet»-links i fejlbokse (verificér først, om de er links eller knapper), henvisninger
mellem sider. Ikke hvor linket blot er en udgang til en anden hjemmeside; dét er afgjort.

- Fundet i: `om.md` BB-016 (fem links, ingen af dem kan nås med Tab) – **afgjort: bevidst designvalg**.
- Efterprøvet: Satser-sidens retsinfo-henvisninger (`satserRows.tsx`) bruger samme primitive og er
  også ude af Tab-rækkefølgen. Interne linkflader er ikke ændret af M-08.
**Skærpelse 2026-08-19 (fra `globalshell.md` BB-051) – mønsteret er STØRRE end links.** Målingen på
shellen viste, at det ikke kun er `<a>`, der falder uden for ringen: **hele sidemenuen gør det.**
`Container` ejer Tab og cirkulerer inden for sit eget indhold, og sidemenuen ligger uden for
`Container`. Browserens eget tabflow når menuen ved sessionens start, men i det øjeblik fokus første
gang er inde i indholdet, kommer det aldrig ud igen – hverken med Tab eller Shift+Tab. Programmets
navigation og dets tre filhandlinger (`Gem`, `Hent`, `Slet alt`) er dermed mus-kun resten af
sessionen.

**Prøven er derfor ikke «er dette element med i selectoren?», men «findes der en vej TILBAGE?»**
En cirkulær ring, der kun omfatter en delmængde af fladen, er en fælde: alt uden for ringen kan nås
én gang og aldrig igen.

**Men udvikleren har AFVIST, at det er en mangel (2026-08-19, BB-051) – og afgørelsen lukker sporet.**
Tab-ringen findes med et bestemt formål: at understøtte hurtig indtastning i felterne, altså at man
kan udfylde alle relevante værdier på en side uden at skifte til mus. Brugeren åbner typisk programmet
for at lave ÉN bestemt type beregning og bliver derfor overvejende på samme side. At navigation til
andre sider og faner hovedsageligt sker med mus, er et **accepteret kompromis**.

Mønsteret står derfor tilbage som en beskrivelse af mekanikken, ikke som en fundkilde: **foreslå ikke
igen, at sidemenuen, `PageTabs` eller `SideTab` skal ind i ringen.** Det gælder også de tre
filhandlinger, selv om `Hent` og `Slet alt` ingen genvej har. Skulle mønsteret alligevel bruges
senere, skal det være om noget ANDET end sidenavigation – fx en kontrol, der er den eneste vej til at
færdiggøre en indtastning på den side, brugeren står på.

- Kandidater, ikke efterprøvet: **interne** links inde i fejl- og advarselsbokse. MinProcesrentes
  titel-link (`href="/"`) er internt og hører til den gruppe, ikke til den eksterne regel.
  `SideTab`-kontrolfanerne på Erstatningsopgørelse står uden for ringen efter samme mekanik som
  sidemenuen og hører til nr. 12.

## M-09 – Fast indholdsbredde

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

**Efterprøv, hvor:** en flade er bredere end den rene tekstboks – tabeller med mange kolonner,
sidestillede bokse eller indhold med egen minimumsbredde. Prøven er: **er indholdet nåbart ved
1536×730 og 1366×620, og fungerer den vandrette fallback under den kontraktlige breddegrænse?**

- Fundet i: `om.md` BB-015 (sætninger skåret over ved 1366 px) – **afgjort: arbejdsfladeskalering
  inden for CSS-viewport-kontrakten**.
- Bekræftet i ny form 2026-08-19: `minprocesrente.md` BB-045. Standalone skiftede til telefonlayout
  på **vinduets bredde**, mens den tilhørende breddefrigørelse af indholdsboksen kun gjaldt
  **touch-enheder**. Et smalt musevindue (eller høj browserzoom) fik derfor telefonens tre kolonner
  spredt over 1174 px i et 567 px felt. **Skærpelse:** når to beslutninger om samme layout hviler på
  hvert sit kriterium (viewport kontra input-modalitet), findes der altid en tilstand mellem dem –
  efterprøv den frem for at antage, at de to kriterier falder sammen.
- **Gennemført 2026-08-19, og udviklerens løsning var en anden end min.** Jeg foreslog at lade
  breddefrigørelsen følge samme kriterium som layoutskiftet (altså også et smalt musevindue). Brugeren
  afviste præmissen: mobilvisningen må slet ikke kunne opstå på en desktop. Opstillingen låses derfor
  til ENHEDEN – berøring plus orienteringsstabil kortside, samme aflæsning som device-gaten – og læses
  én gang ved mount, så resize, rotation og zoom ikke kan flytte den. **Den generelle lære er skarpere
  end min skærpelse ovenfor:** to kriterier for samme layout skal ikke bringes til at falde sammen; der
  skal kun være ÉT kriterium. Og når to signaler beskriver forskellige ting (vinduets størrelse kontra
  hvilken slags maskine brugeren sidder ved), er det sidste ofte det rigtige at bygge på.
- Kandidater, ikke efterprøvet: alle sider med tabeller. Årsløn, Erhvervsevnetab og
  Erstatningsopgørelsen er de bredeste og skal måles ved 1536×864, ikke ved 1920.

## M-10 – Flydende knapper kan dække indhold

> En knap, der ligger fast i vinduets hjørne, dækker det indhold, der havner under den.

Rul-til-toppen-knappen er 56 px og står 32 px fra vinduets nederste højre hjørne, uafhængigt af
sidens indhold. Alt, hvad der lander i det hjørne, kan blive helt eller delvist dækket – og et klik
i det dækkede område rammer knappen, ikke indholdet.

**Skærpelse 2026-08-16 (fra måling, ikke fra en afgørelse).** Det afgørende er ikke, at en fast
placeret knap *kan* dække noget. Det er, at indholdssøjlen ved designmålet 1536×864 går helt ud til
12 px fra vinduets kant, mens knappen står 32 px inde. **Knappen ligger dermed altid inde i
indholdssøjlen ved den understøttede bredde** – der er ingen fri margen ved siden af indholdet, den
kan stå i. Alt, hvad en flade lægger i sit nederste højre hjørne, ligger derfor under knappen.

**Efterprøv, hvor:** en flade har betjenbart indhold nederst til højre: bundlinjer, runde
tilføj-knapper under tabeller, downloadknapper i bunden af en side. Mål ved 1536×864 – ikke ved 1920,
hvor indholdet er smallere end vinduet og problemet forsvinder af sig selv.

- Fundet i: `om.md` BB-014 (knappen dækker 19 px af det sidste søskendelink) – **accepteret risiko**;
  den endelige afgørelse bygger på, at kun få brugere står præcis på 1536×864, og at zoom-løsningen
  ændrer præmissen.
- Kandidater, ikke efterprøvet: alle sider, da knappen er global. Knappen vises først, når der er
  rullet mere end 200 px, så prøven skal gøres på en rullet side.

## M-11 – Programmets egne påstande om sig selv

> En tekst, der lover noget om programmets adfærd, skal måles mod adfærden – ikke læses som pynt.

Hvor programmet beskriver, hvad det gør ved brugerens oplysninger – hvad der gemmes, hvor længe, hvad
der sendes, hvad der slettes – er teksten det eneste, brugeren har at gå efter. En upræcis påstand er
derfor ikke en sproglig detalje: den er enten en forkert forventning om, hvornår arbejdet forsvinder,
eller et løfte, der ikke holder ved et eftersyn.

**Efterprøv, hvor:** en tekst beskriver programmets egen adfærd frem for at bede om en indtastning –
informationssider, bekræftelsesdialoger før destruktive handlinger, beskrivelser af en indstilling.
Prøven er altid den samme: fremprovokér det, teksten beskriver, og mål udfaldet.

**Bemærk fælden i dette mønster.** Begge fund blev første gang læst som indvendinger mod *adfærden* –
og adfærden var i begge tilfælde rigtig. Skriv derfor fundet, så det er umuligt at forveksle: adfærden
er X, teksten siger Y, og det er kun Y, der foreslås ændret. Ellers bliver et tekstfund afvist på et
adfærdsargument, alle er enige i.

**Og bemærk den anden vej.** Da modpresset blev givet, holdt kun det halve: brugeren havde ret i, at
kritikken var sat for bredt – programmet indsamler hverken persondata eller brugsstatistik, og de to
ord i teksten var sande. Et fund i dette mønster skal derfor pege på **den enkelte unøjagtighed**, ikke
på afsnittet som helhed. Ellers bliver rettelsen enten afvist som overdreven eller ender i en lang,
kringlet tekst, der er ringere end den upræcise.

- Fundet i: `om.md` BB-011 (sagen forsvinder med fanen, ikke med browseren, og «Gem» nævnes ikke) og
  BB-012 (påstanden om, at intet gemmes eller sendes, er bredere end det løfte, den skal bære) –
  **begge afgjort 2026-08-16 efter modpres: teksten er rettet, adfærden bevares.** BB-012 blev kun
  delvist accepteret; den aftalte ordlyd står i fundet.
- Efterprøvet 2026-08-18: Indstillinger-siden har **ingen** beskrivende tekst overhovedet – kun
  etiketter. Mønsteret gav derfor intet dér; det, fladen mangler, er dækket af M-12 nedenfor.
- Kandidater, ikke efterprøvet: «Slet alt»-bekræftelsen, overskrivningsadvarslen ved Hent.

**Skærpelse 2026-08-21 (fra `varigemen.md` BB-075) – en påstand om et TALS OPHAV hører også hjemme
her, men prøven er strengere, end fundet antog.** BB-075 blev **afvist**: satsen ER fælles for de to
love, og at Satser-siden placerer den under ét af dem, er ikke en mangel over for en professionel
målgruppe. **Prøven er derfor: er de to henførsler UFORENELIGE – eller blot forskelligt afgrænsede?**
Kun det første er et fund.

Selve mekanismen står ved magt. Mønsteret var indtil nu læst som «tekster om programmets adfærd»,
men en linje, der fortæller hvor et tal kommer fra – en lovhenvisning ved siden af en sats, en
kildeangivelse over en tabel – er den samme slags påstand: brugeren har intet andet at gå efter, og
den kan måles. Den måles bare ikke ved at fremprovokere en adfærd, men ved at **finde samme tal et
andet sted i programmet og sammenligne, hvad det dér henføres til**.

**Og det er netop dér, afvisningen har sin lære.** Målingen viste en ægte forskel (satsfanen henfører
til to love, Satser-siden til én), men en forskel er ikke en modsigelse: den ene henførsel var bare
bredere end den anden. **En placering er en indeksering, ikke en påstand om eksklusivitet** – og over
for en professionel målgruppe skal en indeksering ikke gentages alle de steder, den også kunne stå.
Spørg derfor, om de to tekster kan være sande samtidig, før fundet skrives.

Bemærk desuden, at fælden fra mønsterets øvrige fund vender om her: BB-011 og BB-012 blev læst som
indvendinger mod adfærden, hvor kun teksten var forkert. Ved en kildeangivelse er det omvendt ikke
givet, at teksten er den forkerte halvdel. Skriv derfor fundet med begge udfald og lad udvikleren
vælge – det er en faglig afgørelse, ikke en sproglig.

- Kandidater, ikke efterprøvet: Satser-sidens fire sektionsoverskrifter, som er den eneste henførsel
  af 20 satser, og dokumentgeneratorernes indledende forudsætningsafsnit.
- **Kandidaten «Renteberegning → Satser» er efterprøvet 2026-08-24, og lovhenvisningerne kunne IKKE
  måles.** De to satser vises kun dér i programmet, så der findes ingen konkurrerende henførsel, og
  efter BB-075's stramning er en enkeltstående henvisning ikke et fund. Om «§ 5, stk. 2» er rigtig, er
  et juridisk spørgsmål og blev rejst som sådan (`renteberegning.md`, fane 2, åbent spørgsmål 1).
  **Og den VAR forkert (afgjort af udvikleren 2026-08-25).** Begge satser har hjemmel i § 5, stk. 1:
  tillægget i 1. pkt., referencesatsens definition i 2. pkt. Henvisningerne er rettet.
  **Læren skærper mønsteret i en ny retning:** BB-075's stramning gør en enkeltstående lovhenvisning
  til et *ikke-fund*, fordi den ikke kan MÅLES i programmet – men umålelig er ikke det samme som
  rigtig. En enkeltstående henvisning skal derfor fortsat rejses som **spørgsmål** til udvikleren, ikke
  registreres som «overvejet uden fund». Halvdelen af mønsterets værdi ligger i at spørge.
- **Men i samme boks stod en anden påstand, som kunne måles – og den var forkert** (`renteberegning.md`
  BB-092, Høj). Beregningsforudsætningen skriver «Rentesatsen udgør nationalbankens udlånsrente + 8 %
  (ved **forfaldsdato** før 01-03-2013 dog + 7 %)», og satsfanens kolonne heder tilsvarende
  «Forfaldsdato». Beregningen vælger tillægssatsen på **rentedatoen**. Målt: forfaldsdato `20-02-2013`
  + 30 dages tillægstid → rentedato `22-03-2013` → `6.402,74 kr.` (8,2 %), hvor den trykte
  forudsætning giver `5.621,92 kr.` (7,2 %). Teksten trykkes i BEGGE dokumenter, så modparten kan
  regne efter den og få et andet tal end dokumentets eget.
  **Afgjort 2026-08-25: teksten var den forkerte halvdel.** Udvikleren fastslog, at rentedatoen er den
  juridisk rigtige nøgle; forudsætningen siger nu «rentedato», satsfanens kolonne heder «Gælder fra»,
  og både terminologien og satsvalget er bindende i `renteberegning-contract.md` §2.9–§2.10. Ingen tal
  er ændret. **Bemærk for næste forekomst:** udfaldet gik til teksten her, men det var ikke afgjort på
  forhånd – fundet skal fortsat skrives med begge udfald.
- **Læren om mønsterets prøve, og den er skarp: en lovhenvisning er den svære halvdel, en
  datohenvisning den lette.** En § kan kun måles mod en anden forekomst af samme tal; en påstand om
  hvilken af sagens datoer der styrer et tal kan fremprovokeres direkte ved at vælge en sag, hvor de
  to kandidatdatoer ikke er ens. **Prøv derfor datoerne først:** tag hver sætning i et
  forudsætningsafsnit, find de datoer den navngiver, og lav en sag, hvor de falder forskelligt ud.
  Kandidater: Varige méns og forsørgertabs forudsætningsafsnit og EO-bilagenes indledninger, hvor
  «skadestidspunkt» og «opgørelsesdato» står ved siden af hinanden.

## M-12 – Et valg, hvis virkning hverken kan ses nu eller findes senere

> Brugeren træffer et valg, men kan hverken se, at det skete, hvornår det gælder, eller hvordan han
> kommer tilbage.

**Mønsteret er kraftigt indsnævret af udviklerens afgørelser 2026-08-18. Læs indsnævringen FØR
formuleringen – alle tre udløsende fund blev afvist.** Det oprindelige mønster samlede tre fravær og
kaldte kombinationen et problem:

1. ingen kvittering, når valget gemmes,
2. forskudt virkning (næste nye sag, et senere dokument, en validering et andet sted),
3. ingen vej tilbage (ikke i undo/redo, kan ikke gemmes eller hentes).

**Punkt 1 og 2 er afvist som fund, og punkt 3 er afvist som en egenskab, der skal oplyses.**
Begrundelserne er substantielle og gælder hele programmet:

- **Forskudt virkning er den forventede adfærd, ikke en mangel.** «Standardværdier» betyder
  standarder for nye sager og for tilstanden efter «Slet alt» – det er, hvad en fagperson forventer
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

**Hvad der er tilbage af mønsteret – og det er stadig værd at lede efter.** Ikke «brugeren fik ingen
kvittering», men den skarpere prøve, BB-024 bestod:

> **Er et valg, brugeren har truffet, blevet til en tilstand han ikke kan komme UD af igen?**

Det var den ægte defekt på Indstillinger: farvetemaet læste computerens indstilling ved allerførste
start, og i samme øjeblik brugeren valgte lyst eller mørkt, var automatikken permanent væk. Ikke
fordi valget var uigenkaldeligt af natur, men fordi den tredje tilstand – «følg computeren» –
fandtes i programmet uden at findes i UI'et. **Det er dét, mønsteret nu handler om: en tilstand
programmet kan være i, men som brugeren ikke kan vælge.**

**Efterprøv, hvor:** et valg har færre synlige muligheder, end programmet har tilstande – typisk
hvor en startværdi udledes af omgivelserne (systemtema, dato, lokalitet, en anden sides værdi) og
derefter fryses af brugerens første valg. Prøven er: *kan brugeren komme tilbage til det, programmet
gjorde af sig selv?*

**Bemærk skellet mod M-11.** M-11 handler om tekster, der siger noget forkert om programmet. M-12
handler nu om en manglende valgmulighed – ikke om manglende forklaring. **Et fund, hvis rettelse er
«tilføj en forklarende linje», hører efter afgørelserne ovenfor ikke længere hjemme her.**

- Fundet i: `indstillinger.md` BB-024 (farvetemaet kunne ikke stilles tilbage til at følge
  computeren) – **accepteret og gennemført 2026-08-18**: `themeMode` har nu tre værdier med
  `'system'` som standard, og systemskift følges live. Reglen står i `app-settings.md`.
- Afviste fund i samme mønster: BB-023, BB-025, BB-027 – se indsnævringen ovenfor. **Genåbn dem
  ikke.**
- Bemærk forlægget på samme flade: rækken «Placering til gemte filer» viser sin tilstand ærligt,
  siger «(standard)» når valget er væk, og tilbyder «Nulstil», præcis når der er noget at nulstille.
  Den er mønsterets egen løsning, fundet i programmet selv.
- Kandidater, ikke efterprøvet: Mineo-sidens startside-toggle – men bemærk, at den har præcis to
  tilstande og dermed **ikke** har den fælde, BB-024 havde. Led i stedet efter valg, hvis startværdi
  kommer fra omgivelserne.

## M-13 – Nul er en oplysning, ikke et fravær

> Skærmen og dokumentet bruger hver sin prøve for «er der noget at vise her?», og de er kun enige,
> så længe ingen værdi er nul.

En visningsflade skjuler en række, når der ikke er nogen værdi. Et dokument skjuler den, når værdien
ikke er **større end nul**. De to prøver ser ens ud og er ens i praksis – indtil datasættet
indeholder et lovligt nul. Så viser skærmen «0 %» eller «0 kr.», og dokumentet udelader rækken
uden et ord.

Det gør nullet til to modsatte udsagn: på skærmen «satsen er nul», i dokumentet «satsen er ukendt».
For en juridisk sats er det ikke det samme – 0 % siger, at der ikke er reguleret, og det er en
oplysning, sagen kan afhænge af.

**Efterprøv, hvor:** en flade og dens dokument bygger den samme række hver for sig, og hvor
synligheden afgøres af en talprøve frem for af, om værdien findes. Prøven er: **findes der en
lovlig nulværdi i datasættet – og hvad viser de to udgaver så?** En `> 0`-prøve på synlighed er
altid mistænkelig; en `!== undefined`-prøve er den rigtige.

Bemærk den skærpede form: det gælder ikke bare rækker. En `> 0`-prøve kan også afgøre, om en hel
**kolonne** eller en hel **sektion** vises, og så forsvinder mere end én oplysning.

**Afgjort af udvikleren 2026-08-18: mønsteret er bekræftet og bindende.** «Rækker, hvor værdien er
indtastet, men er 0, vises begge steder.» Præmissen – at siden og dokumentet skal vise det samme – er
accepteret uden forbehold. Et fund i dette mønster skal derfor ikke argumenteres forfra; det skal blot
måles og rettes.

- Fundet i: `satser.md` BB-030 (skærmen viser «Reguleringsprocent for erhvervsevnetab (fra 2024):
  0 %» for år 2024; dokumentet udelod rækken. Gjaldt både PDF og Word, som deler generator).
  Der er i dag præcis ét nul i satsdatasættet, så fundet ramte ét år – men 2024 er et meget brugt år.
  **Gennemført 2026-08-18:** dokumentets prøve er nu «findes værdien?», og to regressionsværn i
  `satserWordContent.test.ts` måler både at nullet står der, og at en manglende sats fortsat udgår.
  Satsdokumentets fri proces-række er rettet i samme omgang (den krævede alle tre beløb; nu pr. linje
  som skærmen).
- Konkret kandidatsted, ikke efterprøvet: `src/document/generators/eo/reguleringDocument.ts` bruger
  `sats > 0` til at afgøre, om en hel kolonne vises for otte tillægssatser plus grundlønnen. Hører
  til Erstatningsopgørelse-fladen.
- Bemærk formen, den latente forekomst havde: den var **ikke** udløst af de aktuelle data (alle tre fri
  proces-beløb findes for hvert dækket år), men den var samme fejl og blev rettet med. En uenighed mellem
  to udgaver skal lukkes, når den findes – ikke først når datasættet udløser den.
- **Ny forekomst 2026-08-20 i familiens svageste form** (`varigemen.md` BB-070, Lav): de to udgaver er
  enige om, at rækken findes, og om tallet – men ikke om **formen**. Skærmen skriver «364.155 kr.»,
  dokumentet «364.155,00 kr.» for samme beløb, fordi generatoren kalder `formatAsAmount(x)` uden
  præcisionsargument og dermed får standardens to decimaler. Prøven er billig og generel: **søg i
  generatorerne efter `formatAsAmount(` uden andet argument** og sammenlign med skærmens kald for
  samme tal. Varige méns øvrige otte linjer var identiske, så det er formen, ikke rækkevalget, der
  driver.
- **To nye forekomster 2026-08-21, og de udvider prøven i hver sin retning** (`varigemen.md` BB-079
  og BB-078, begge Lav):
  - **BB-079 – uenigheden behøver ikke to udgaver. Den kan stå på ÉN skærm.** Varige méns
    ménberegning viser satsen som «11.035 kr.» i satsrækken og som «á 11.035,00 kr.» tre linjer
    længere nede; PDF'en gør nøjagtig det samme, så skærm og dokument er *enige* – og netop derfor
    fangede BB-070's prøve det ikke. **Prøven er derfor bredere: sammenlign alle visninger af samme
    tal, også inden for én skærm, ikke kun skærm mod dokument.**
  - **BB-078 – den latente form: forskellige formateringskald for samme værdi.** Méngrad-satsen
    vises tre steder med tre kald (`formatAsAmountTrimmed(x, 2)` på satsfanen, `formatAsAmount(x, 0)`
    på ménberegningen og i dokumentet, `formatKr(x, 0)` på Satser-siden). Datasættet har kun hele
    kroner, så de er enige i dag; en sats med ører ville give tre former, hvoraf to er afrundet væk
    fra den værdi, beregningen bruger. Efter mønsterets egen lære (fri proces-rækken) lukkes en
    sådan uenighed, når den findes – ikke først når dataene udløser den. **Generel prøve: find de
    kald, der viser samme værdi to steder, og sammenlign precision-argumentet.**
  - **Begge accepteret og gennemført 2026-08-21 som ÉN rettelse:** alle beløb i varige mén går nu
    gennem `formatKr` med nul decimaler, i skærm og begge dokumentformater, og reglen er normativ i
    `varigemen-contract.md` §2.9. **Men udviklerens afgrænsning er en del af afgørelsen og hører med
    her: nul decimaler er varige méns EGEN regel og må ikke udbredes til andre ydelser** –
    `amount-contract.md` §5's to-decimal-standard gælder fortsat alle andre domæner. Mønsteret
    forlanger altså, at de forskellige visninger af samme tal er ENIGE, ikke at de er nul-decimale.
  - **Lære om rettelsens omfang:** det var fristende at afrunde mellemregningerne i domænet med, så
    visningen aldrig kunne afvige fra værdien. Det ville have været en BEREGNINGSændring (resultatet
    ville flytte sig, hvis en sats fik ører) forklædt som en visningsrettelse. Afstemningen holder
    uden den, fordi reduktionen er defineret som differencen mod den oprundede godtgørelse – de to
    uafrundede beløb har derfor samme decimaldel og forskydes ens. **Spørg altid, om en
    visningsrettelse er ved at brede sig ind i domænet.**
- **Ny forekomst 2026-08-21, og den udvider prøven en tredje gang: DOKUMENT mod DOKUMENT fra samme
  flade** (`renteberegning.md` BB-087, Lav). Renteberegning har to udgange, og de skriver samme datoer
  i to formater: rækkens specifikation «Periode: **30-01-2019 - 19-08-2026**», oversigten «Rente
  beregnes til og med **19. august 2026**» og «**30. januar 2019**». Skærmen bruger dd-mm-åååå, så
  oversigten er den ene afviger af tre flader. Begge former er tilladte af `documentDateGuard`, så
  det er et VALG, der er truffet forskelligt to steder i samme domæne – ikke en fejl.
  **Prøven er dermed komplet i tre trin:** skærm mod dokument (BB-070), inden for én skærm (BB-079),
  og mellem to dokumenter fra samme flade (BB-087). Kør alle tre, hvor en flade har mere end ét output.
- **Fjerde form, tilføjet 2026-08-24: FORTEGNETS skrivemåde** (`renteberegning.md` BB-095, Lav).
  Rentesatsfanens tre negative referencesatser vises som `- 0,45 %` – bindestreg, **mellemrum**, tal
  (tegnkoder målt). Formen kommer af et `.replace('-', '- ')`, som findes ét sted i hele programmet
  (`InterestRatesTable.tsx`); alle andre procentvisninger går gennem `formatPercent` uden det. Der er
  ingen anden visning af samme tal at være uenig med, så det er mønsterets latente form (jf. BB-078) –
  men skærpet af, at `-` samtidig ER programmets tegn for «ingen værdi» i en tabelcelle, og fane 1's
  tomme kolonner viser ordret `-` ét klik væk. **Prøven udvides derfor: sammenlign ikke kun tallets
  form, men dets FORTEGNS form – og spørg, om tegnet kolliderer med programmets tegn for fravær.**
  Kandidater, ikke efterprøvet: EO's reguleringsbilag og EET's differencekrav, hvor negative beløb
  kan forekomme.
  **Afvist 2026-08-25, og halvdelen af prøven er trukket tilbage.** Kollisionen med «ingen værdi»
  findes ikke: `-` som fravær står ALTID alene i en celle, og der findes ingen celle i programmet med
  to værdier i, så «- 0,45 %» kan ikke læses som «ingen værdi efterfulgt af 0,45 %». Brugeren har
  fastholdt formen som et bevidst visuelt valg for satstabellerne. **Det, der bliver stående af
  prøven:** sammenlign fortegnets form på tværs af de steder, der viser samme slags tal – men en
  enkeltstående tabel uden nabo at være uenig med er ikke et fund i sig selv. Undtagelsen er nu
  eksplicit i koden med sin begrundelse, så den ikke kan «ryddes op» ved en fejl.
- **Tre nye forekomster 2026-08-25 fra Årsløn, og den ene er mønsterets oprindelige fejl igen**
  (`aarsloen.md` BB-109, BB-108, BB-111):
  - **BB-109 er BB-030 ordret på en ny flade.** Årslønsdokumentets `isEmptyOrZero` behandler `0`,
    `0,00` og `0,00 %` som fravær, så en indtastet fritvalgssats på **0 %** står på skærmen og mangler
    i dokumentets Satser-afsnit. Udviklerens afgørelse af 2026-08-18 er bindende, så fundet skal blot
    måles og rettes. **Bemærk at samme prædikat også afgør, om en tabelRÆKKE kommer med i dokumentet** –
    prøv begge veje i samme rettelse. Den generelle lære står ved magt: en `> 0`- eller
    `=== 0`-prøve på SYNLIGHED er altid mistænkelig; `!== undefined` er den rigtige.
  - **BB-108 er de to formprøver på én gang.** Skærm `12,50 %` mod dokument `12,5 %` (BB-078's
    latente form, nu udløst af data), og skærm «Beregnet årsløn (33.750,00 **/ 1** × 12)» mod dokument
    «(33.750,00 × 12)» – dokumentet har en særregel for én enhed, skærmen ikke. **Ny lære: uenigheden
    kan ligge i FORMLEN, ikke kun i tallet.** Prøven udvides: sammenlign ikke bare hvert vist tal,
    men hver **tekst, der beskriver et regnestykke**, mellem skærm og dokument.
  - **BB-111 flytter prøven fra værdier til NAVNE.** Dokumentgeneratoren har sine egne forkortelser af
    tre kolonneoverskrifter («Ikke-pens. giv. løn», «ATP mv. u. tillæg», «Arb.g.Pension» uden
    mellemrum), selv om kolonnenavnene har ét sandt sted, og modulets egen kommentar begrunder det
    sande sted med, at samme kolonne ellers kunne hedde to ting. **Prøven er ny og generel: sammenlign
    hver kolonneoverskrift i en generator med descriptorens label.**
- **Fire nye forekomster 2026-08-27 fra Forsørgertab, og de to første flytter prøven ud af tallene**
  (`forsoergertab.md` BB-122, BB-125, BB-130, BB-132):
  - **BB-122 er mønsterets oprindelige form vendt om: dokumentet udelader en HEL RÆKKE, skærmen viser.**
    Specifikationen nævner ikke sagens skadedato/anmeldelsesdato, selv om skærmen har den som anden
    række, og selv om fire af beregningens opslag hænger på den. Den kan ikke slås til: brevhovedet
    bærer kun journalnr., advokat, sagsbehandler og dags dato. **Varige méns dokument gør det rigtige
    på samme sagsgrundlag**, så rettelsen er en konvergens. **Prøven er ny og generel: hold skærmens
    forudsætningsrækker op mod dokumentets, række for række – ikke kun værdi for værdi.**
  - **BB-125 flytter prøven fra de viste tal til GRÆNSEBESKEDERNES tal.** Feltet skriver selv `600.000`
    og melder «Værdi skal være mellem **1000** og **551000**», mens dets nabo-regel formaterer korrekt
    («deleligt med **1.000**»). Kilden er `getIntegerRangeErrorMessage`, som ALLE beløbs- og
    heltalsfelter i programmet deler, så formen er ens overalt og forkert overalt. Dertil den anden
    halvdel: loftet `551.000` er skadesårets ASL-maksimum, men beskeden siger det ikke – og den besked,
    der gør (`validateAslAarsloenBySkadesaarMax`), er **uopnåelig**, fordi bounds-validatoren kører
    først. To grænser skrevet to gange, og den mindst oplysende vinder (jf. M-24's punkt 1).
  - **BB-130 er BB-079's form igen:** «Kapitalbeløb (efter ASL) **- 0 kr.**» i sammentællingen mod
    «Kapitalbeløb **0 kr.**» i panelet nedenfor – samme nul, to former, én skærm. Minusset er en fast
    del af fradragslinjens skabelon.
  - **BB-132 udvider prøven til OPERATORERNE.** Én linje bruger begge gangetegn på én gang
    («30 % **x** 400.000 kr. **×** (632.000 / 551.000)»), og én formellinje mangler det afsluttende
    `=`, som alle sidens andre har. **Sammenlign ikke kun tallets form, men tegnene omkring det.**
- **Bestået samme dag på beløbssiden:** renteberegningens `formatKr(x, 2)` på skærmen og
  `formatAmount(x)` i begge generatorer giver to decimaler alle tre steder (`27.111,89 kr.` ordret
  identisk). Det er værd at notere, fordi det bekræfter afgrænsningen fra BB-078/BB-079: Varige méns
  nuldecimalregel er IKKE bredt ud, og mønsteret forlanger enighed, ikke nul decimaler.

## M-14 – En anden fortolkningsvej ved siden af tastningen

> Der findes to veje ind i feltet, og de giver ikke samme svar.

**Mønsteret er omformuleret 2026-08-18 efter udviklerens afgørelse.** Første udgave hed «indsat tekst
samles af cifre uden hensyn til formens positioner» og byggede på, at tegn-for-tegn-reglen er *skadelig*
for en form med faste positioner. Det er afvist: udvikleren fastholder, at paste altid skal give samme
resultat som tastning af de samme tegn, også når det betyder, at `01-02-2026` bliver `102` i et årsfelt.
Fejlen var aldrig tegn-for-tegn-reglen. Fejlen var, at der fandtes **en anden vej ved siden af den**.

**Udviklerens regel (bindende, hele programmet):** paste skal alle steder opføre sig, som hvis brugeren
havde tastet den indsatte værdi ét tegn ad gangen fra det første. Koden behøver ikke være implementeret
som en serie enkelttastninger, men resultatet skal være som var det sket – og **enhver kode eller
kontrakt, der fører til et andet resultat, er forkert og skal ændres.** Reglen står nu som §1.2a punkt 7
i `input-field-behavior-contract.md`, og års-/ugefelterne har fået deres eget §2.9.

Den anden vej har to kendetegn, og det er dem, der skal efterprøves:

1. **En paste-only fortolker.** En funktion, der læser hele clipboard-teksten på én gang og *udleder* en
   værdi af den – «find den første ciffergruppe», «find årstallet», «gæt separatoren». Den kan altid danne
   en værdi, brugeren ikke kunne have tastet sig frem til.
2. **Den kaldes kun i én af feltets tilstande.** Konkret kaldes codecets `normalizePaste` kun, når
   draften er tom (`normalizePasteForDraft`); et udfyldt felt får tegn-for-tegn-filteret. Findes der en
   fortolker, giver samme tekst derfor to forskellige værdier, alt efter om feltet var tomt.

Værst er kombinationen med en **grænse**: forkorter fortolkeren teksten, indtil resultatet ligger inden
for feltets min/maks, ændres en ugyldig værdi tavst til en gyldig, forkert værdi. `2035` med maksimum 2030
blev `2020`. Det er direkte i strid med §1.2a punkt 5.

**Efterprøv, hvor:** et felt erklærer sin egen `normalizePaste`. Tre prøver: (1) indsæt samme tekst i et
**tomt** og i et **udfyldt** felt og sammenlign; (2) indsæt en værdi uden for feltets grænser og se, om
den bevares eller forkortes; (3) sammenlign resultatet med, hvad tegnene ville give tastet ét ad gangen.

**Bemærk forholdet til M-03.** M-03 fastslog, at indsættelse gerne må være mere tolerant end tastning,
når teksten uomtvisteligt kan opløses til én værdi. Den afgørelse gælder stadig for de familier, den blev
truffet for – men den er **ikke** et mandat til at bygge en fortolker, der gætter. Grænsen er, at
tolerancen skal ligge i, hvilke tegn der springes, ikke i en udledning af en værdi.

- Fundet i: `satser.md` BB-031. **Gennemført 2026-08-18:** `normalizeYearPaste` og `normalizeWeekPaste`
  er slettet som fortolkere og erstattet af det delte tegn-for-tegn-filter, som beløb, procent og brøk
  allerede brugte. Hjælperne bag dem (`extractContiguousDigits`, `findNextDigitIndex`, `isWithinBounds`)
  er fjernet med, så byggeklodserne til en ny fortolker ikke ligger og venter.
- **Den sidste paste-only fortolker – datofelternes `normalizeDatePaste` – er efterprøvet, havde
  fejlen og er rettet.** Målt 2026-08-19 (`minprocesrente.md` BB-042): `010623` indsat i et **tomt**
  datofelt blev `01-06-2023`; samme tekst indsat i et **udfyldt** felt (markér alt, indsæt) blev
  `01`, afvist og rødt. Prøve 2 var derimod bestået: `01-01-2045` uden for feltets grænse blev
  bevaret uafkortet, så fortolkeren gætter ikke sig ned i et lovligt interval, som årsfelterne gjorde.

  **Gennemført 2026-08-19 efter udviklerens valg: kun tilstandsafhængigheden (kendetegn 2) er væk.**
  Segmentfortolkningen er bevaret, fordi den ER en truffet beslutning (BB-003/M-03). Fortolkningen
  bruges nu, når paste'en **erstatter hele værdien** – et lukket felt eller en åben draft med alt
  markeret – og springes, når noget af brugerens tekst bliver stående. Betingelsen er samlet i
  `resolvePasteContextDraft` (`inputCore/react/pasteSplice.ts`) og læses af alle tre paste-flader
  (formularfelt, tabelcelle, transient datofelt); den var før skrevet tre gange som
  `ctl.isOpen ? draft : ''`, og netop de tre kopier var fundet.

  **Mønsteret har hermed en skarpere formulering.** Kendetegn 1 (en fortolker findes) er ikke i sig
  selv fejlen – det afgjorde udvikleren. Fejlen er kendetegn 2 og 3: at fortolkningen vælges på
  editorens TILSTAND frem for på, om der er en kontekst at splice ind i, og at en grænse forkorter
  teksten. Efterprøv fremover netop de to.
- Alle fire årsfelter delte codec og er rettet i én omgang: `satser.aargang`,
  `eo.svieSmerteSatserAar`, Årslønssidens årsfelt (`aarsloenDescriptors.ts:332`) og
  Lønindkomst-tabellens `col1_maaned` (`erstatningsopgoerelseLoenDescriptors.ts:296`). De to sidste er
  tabelceller, hvor et indsat regneark er den sandsynlige kilde – den konkrete oplevelse dér er ikke set
  og hører til Årsløn- og EO-fladerne.
- **Sidegevinst, samme klasse:** ugefeltets separatorsæt var erklæret to gange med forskelligt indhold
  (værnet tillod `,` og `\`, som settle ikke normaliserede; settle normaliserede `:`, som ikke kunne
  tastes). Nu én erklæring, begge læser. Efterprøv generelt, om et felts **tegnværn** og dets
  **settle-parser** er enige om det samme tegnsæt – to lister er to sandheder.
- **Den sidste uafprøvede kandidat er nu målt: en tabelcelle med et indsat regneark**
  (`renteberegning.md` BB-088, Lav). Tre beløb på tre linjer (`1.000,00` / `2.000,00` / `3.000,00`)
  indsat i en tom beløbscelle giver ÉN celle med den afviste værdi `1000,00,` – rød, og til
  forveksling lig det første beløb. Mekanismen er ikke en fortolker: `normalizeClipboardText` gør
  linjeskiftene til mellemrum, og tegnfilteret samler resten. **Adfærden overholder derfor reglen
  (paste = tastning) og er ikke et regelbrud.** Men reglen tager ikke stilling til LINJESKIFTET, og
  linjeskiftet er præcis det, et regneark leverer. **Den åbne prøve er derfor ny og smal: hvad SKAL et
  linjeskift betyde i en indsat tekst?** Ved tastning afslutter det værdien; i paste forsvinder det.
  Behandles det som en afslutning, bliver cellen `1.000,00` i stedet for en afvist streng – uden at
  reglen udvides. Spørgsmålet gælder alle tabelceller, ikke kun beløb, og det er forelagt udvikleren.
- **Ny forekomst 2026-08-27, og den er mønsterets DYRESTE hidtil** (`forsoergertab.md` BB-118, **Høj**).
  Samme spørgsmål som BB-088, men om **decimalkommaet** i et beløbsfelt uden decimaler – og med et
  langt værre udfald, fordi resultatet ikke bliver afvist, men accepteret. Målt: `551.000,00` indsat i
  «Skadelidtes årsløn efter EAL» giver `5.510.000`; `400.000,00` giver `4.000.000`; `400.000 kr.` giver
  korrekt `400.000`. Enheden håndteres altså rigtigt – det er kun ørerne, der bliver til kroner. Ingen
  rød kant, ingen besked, og værdien driver hele erstatningen og dokumentet. Tastet input giver samme
  resultat, så det er ikke en paste-only fortolker: det er tegnfilteret, der springer kommaet over og
  lader cifrene bagefter lægge sig i tallet.
  **Afgrænsningen er skarp og gør fundet let at afgøre: `faellesAarsloen` er den ENESTE beløbsfamilie i
  programmet med `allowDecimals: false`** (`rg "allowDecimals: false" src/inputCore/catalog` – de øvrige
  træf er procentfelter). Alle andre beløbsfelter tager `400.000,00` korrekt. De to felter er altså
  uenige med resten af programmet om det tegn, ethvert dansk beløb skrives med.
  **Den generelle prøve: find hvert felt med `allowDecimals: false` og indsæt den form, tallet normalt
  skrives i.** På procentfelterne (`erhvervsevnetabDescriptors.ts:142` og `:422`) bliver «15,00 %» til
  `1500`, men dér fanger 0–100-grænsen det; på EAL-årslønnen findes intet loft, der kan fange en
  faktor 10. **Læren: en tegnregel er kun så sikker som den grænse, der står bag den.**

## M-15 – Skærmen tier, hvor dokumentet taler

> Programmet kender et forbehold til sit eget tal, formulerer det – og viser det kun i den PDF,
> brugeren måske aldrig henter.

Et dokument er ofte skrevet med mere omhu end den flade, tallet stammer fra: generatoren skriver en
advarsel, en note eller en forudsætning, som skærmen ikke har nogen pendant til. Det gør dokumentet
til det eneste sted, forbeholdet findes – og skærmen til et sted, hvor tallet står nøgent og ser
færdigt ud.

Det er en spejling af M-13, men med omvendt fortegn: M-13 handler om, at dokumentet **udelader**
noget, skærmen viser. Her viser dokumentet noget, skærmen **udelader** – og det er alvorligere,
fordi skærmen er det, brugeren regner efter, mens han arbejder.

**Efterprøv, hvor:** en generator skriver fri tekst, der ikke stammer fra en indtastning – advarsler,
forbehold, «hypotetisk», «kun fastsat til», «foreløbig», fodnoter om datadækning. Søg i
generatorerne efter tekstblokke, der ikke er en label eller en værdi, og spørg for hver: **findes
denne sætning nogen steder på den flade, tallet kommer fra?**

Bemærk skellet mod et informationsikon. Satsers afgørelse (lukket spor 4) fastslog, at en tooltips
akademiske baggrund ikke er noget, dokumentet mangler. Dette mønster går den anden vej og handler
ikke om baggrund, men om **et forbehold til rigtigheden af et tal, der allerede står på skærmen**.

- Fundet i: `minprocesrente.md` BB-040. Beregningsdatoen kan sættes fem år frem, mens
  Nationalbankens udlånsrente kun er fastsat et halvt år frem. Skærmen viser `115.775,14 kr.` uden
  et ord; PDF'en skriver med fed skrift «Der er kun fastsat procesrente frem til 31-12-2026.
  Beregning derefter er hypotetisk!». Teksten findes, er formuleret og er dækket af to enhedstests –
  den vises bare kun i den ene kanal.
- **Afvist for MinProcesrente 2026-08-19.** Udvikleren fastholdt, at brugerne stort set udelukkende
  benytter PDF-dokumenterne, så bristen er begrænset og accepteret på netop denne flade. Jeg forelagde
  alligevel en enkel udgave (samme sætning som én linje i «Beregnet rente»-boksen, kun når
  beregningsdatoen ligger efter sidst fastsatte sats); afvisningen blev fastholdt.
- **Mønsteret er dermed ikke afvist som mønster.** Afgørelsen hviler på, at MinProcesrentes brugere
  arbejder i PDF'en. Den præmis holder ikke nødvendigvis på de flader, hvor tallet læses og genbruges
  på skærmen gennem et længere arbejdsforløb – dér skal mønsteret forelægges igen.
- **SPORET ER LUKKET FOR HELE PROGRAMMET 2026-08-25.** BB-094 blev afvist som BB-040, og fundets egen
  betingelse var, at netop den anden afvisning lukker sporet. **Rejs det ikke en tredje gang.**
  Begrundelsen er ikke kun udviklerens præference, men holder som argument: målgruppen er professionel
  og kender datasættets kadence, og et opslagsværk, hvis rækker viser hvert halvår siden 2005, siger
  sin egen dækning – en manglende `01-01-2027`-række ER svaret på «hvor langt rækker satserne?».
  Dokumenterne bærer stadig forbeholdet. **Den generelle regel, der bliver stående:** et
  dataafhængigt forbehold skal ikke skrives i tekst på skærmen, når datasættets egne rækker gør det
  læsbart for den, der kender kadencen. **Undtagelsen, hvis den opstår:** afkortes en satstabel eller
  kollapses ens rækker i visningen, kan dækningen ikke længere læses – og så skal den skrives.
  Renteberegningens egen kadence kan derimod ikke skifte: halvårene følger af rentelovens § 5, stk. 1,
  2. pkt., og er siden 2026-08-25 håndhævet ved modul-load i `interestRates.ts`. **Den generelle
  konsekvens for mønsteret:** når en dækningsgrænse ikke skal skrives på skærmen, skal datasættets
  egen integritet i stedet fail-close, så et hul ikke kan nå brugeren tavst.
- Forekomsten, afvisningen hviler på (`renteberegning.md` BB-094, Mellem, 2026-08-24): samme sætning,
  samme dokumenter – men fladen er
  denne gang **satsfanen**, altså det ene sted i programmet, hvis hele emne er, hvor langt satserne er
  fastsat. Målt: tabellens øverste række er `01-07-2026`, satserne rækker dermed til `31-12-2026`,
  mens fane 1's datofelter tager imod til `31-12-2031`; en beregning på `31-12-2031` giver `27,40 kr.`
  med tabellens nyeste sats, fem og et halvt år efter den er fastsat. Fanen siger intet om sin egen
  dækning – hverken hvor langt den rækker, eller hvad der sker efter sidste række.
  **Afgrænsningen mod BB-040 var hele forskellen:** BB-040 foreslog en advarsel VED RESULTATET, dette
  fund en linje i OPSLAGSVÆRKET om dets egen dækning. Begge er nu afvist, og dermed er begge
  varianter prøvet.
- **Intervalprøven lever videre som KONTROL, ikke som fund-kilde:** find datasættets nyeste række,
  find det felt der læser datasættet, og sammenlign de to intervaller. Er feltets interval bredere,
  findes der lovlige indtastninger uden satsdækning – og så skal det efterprøves, at motoren
  fail-softer som dokumenteret, og at dokumentet siger det. Det er derimod ikke længere et fund, at
  skærmen ikke gentager det.
- Kandidater, som derfor IKKE længere skal rejses som fund: EO's dokumenter og reguleringsbilaget,
  Forsørgertabs og Varige méns forudsætningsafsnit, og Satser-siden (satser 2005–2026 mod
  satsårsfeltets grænse). Er forbeholdet i dokumentet, er kravet opfyldt.

## M-16 – En komplet række, programmet ikke vil regne på

> Alle felter er udfyldt, intet er rødt – og resultatet er alligevel en bindestreg, som spærrer for
> hele sidens dokumenter.

En beregningsmotor har typisk flere afvisningsgrunde end feltmodellen har fejl. Feltet kender sin
egen grænse; motoren kender dertil kombinationen – datoernes indbyrdes rækkefølge efter en afledt
beregning, et beløb der skal være positivt, en periode der skal have længde. Når motoren afviser af
en grund, feltmodellen ikke kender, findes der ingen rød ramme at hænge forklaringen på, og
afvisningen kommer ud som fravær: et `-` i resultatkolonnen, et forsvundet ikon, en grå knap.

Det værste ved formen er, at fejlen ikke bliver i rækken. Aggregatet ser en ikke-tom række uden
resultat, og hele fladens download spærres – også for de rækker, der er i orden.

**Efterprøv, hvor:** en motor eller validator returnerer `null`/`Result.error` for en tilstand, der
ikke svarer til en feltfejl. Konkret prøve pr. flade: **udfyld en række helt, så den er lovlig felt
for felt, men umulig som helhed** – en afledt dato der lander efter sin grænse, et nulbeløb, en
periode på nul dage – og se, om noget som helst på skærmen forklarer, hvorfor resultatet udeblev.

**Rettelsen hører ÉT sted: i feltmodellen.** Årsagen skal kunne ses **ved rækken** – som feltfejl på
det felt, brugeren skal ændre. Det er hele mønsteret.

Jeg formulerede oprindeligt mønsteret med to rettelser, hvor den anden var, at blokeringsbeskeden
skulle udledes af årsagen pr. tilstand (jf. BF-070). **Det viste sig unødvendigt**, og forskellen er
værd at forstå, fordi den sparer arbejde næste gang: gaten udleder i forvejen sin klasse korrekt af de
issues, projektionen bærer. Dens præmis var bare falsk, så længe de to tilstande ikke HAVDE noget
issue. Da feltfejlene kom, blev grenen «kun en ufuldstændig række» sand af sig selv, og teksten skiftede
til «Fejl i indtastning» uden en linjes ændring i gaten. Rettelser i feltmodellen er altså at foretrække
frem for rettelser i gaten: de gør en falsk præmis sand i stedet for at differentiere en besked.

- Fundet i: `minprocesrente.md` BB-037 (tillægstid skubber rentedatoen forbi beregningsdatoen),
  BB-038 (beløb på 0 kr., hvor feltets grænse er «mindst 0» og motorens er «større end 0») og
  BB-039 (begge tilstande blokerer med teksten «Indtastning mangler»).
- **Gennemført for rentetabellen 2026-08-19.** Begge motorafvisninger er flyttet ind i feltmodellen som
  `rule`-validatorer på det felt, brugeren skal rette: Tillægstid får «Beregnet rentedato kan senest
  være …», Beløb får «Beløbet skal være større end 0 kr.». BB-039 bortfaldt, jf. ovenfor. Brugerens
  regel for beskeden er samtidig skarpere end min: «Indtastning mangler» behøver ikke differentiering –
  den er kun forkert, når den står i stedet for en FEJL, eller når en fejl ikke kan ses som et rødt felt
  på samme side.
- **Bemærk den falske præmis, fundene afdækkede.** Gatens kode begrunder sin klasse med, at grenen
  «pr. konstruktion kun kan være en ufuldstændig række». Det var målt forkert to gange. En kommentar,
  der begrunder en genvej med en påstand om, hvad koden ikke kan nå, er selv en kandidat: efterprøv
  påstanden frem for at læse den. Bemærk dog også, at rettelsen ikke var at fjerne påstanden, men at
  gøre den sand.
- **Ny forekomst 2026-08-21 i mønsterets RENE MANGEL-form** (`renteberegning.md` BB-083, Mellem). Tre
  komplette rentekrav kan hentes hver for sig, men «Download samlet oversigt» er grå med «Indtastning
  mangler», fordi en fjerde række har et beløb og ingen dato. Nul røde felter, og rækken er ikke
  markeret – den skiller sig kun ud ved at vise `-`, ligesom tabellens tomme indtastningsrække.
  **Læren om afgrænsningen:** BB-037 og BB-038 flyttede fanens to MOTORafvisninger ind i feltmodellen
  og lukkede dermed halvdelen af mønsteret på netop denne flade. Den anden halvdel – den *ufuldstændige*
  række – har ingen motorafvisning at flytte, og blev derfor ikke omfattet. **Efterprøv altid begge
  halvdele: en række, der er umulig som helhed, OG en række, der blot er halvt udfyldt.** De har ikke
  samme rettelse: motorafvisningen skal ind i feltmodellen, mens den rene mangel bevares som gate-feedback.
  En rød ring på det endnu tomme partnerfelt ville gøre en naturligt halvfærdig række til en fejl under
  indtastningen og er kontraktstridig.
- **Efterprøvet og lukket samme dag:** `DATE_BEFORE_RATE_COVERAGE` kan ikke nås fra brugerfladen.
  «Renter fra»-feltets nedre grænse ER `MIN_INTEREST_DATE` (01-01-2005), som er senere end
  `MIN_SURCHARGE_DATE` (01-08-2002), så en rentedato uden satsdækning bliver et rødt bounds-issue før
  motoren spørges. Tre af de fem afvisningsgrunde er dermed afklaret; de to sidste
  (`MISSING_*`-grenene) er ægte mangler og hører til BB-083.
- **To nye forekomster 2026-08-25 fra Årsløn, og den ene giver mønsteret en ny ÅRSAG**
  (`aarsloen.md` BB-098 og BB-105):
  - **BB-098 (Høj) – to prædikater for «er der noget her?» inden for én flade.** En lønrække med
    Måned `1`, År `2025` og Løn **0,00 kr.** har alt udfyldt, intet rødt, viser «Beregnet årsløn
    (0,00 / 1 × 12): 0,00 kr.» i fed – og downloadknappen er grå med «Indtastning mangler».
    Tabelvalideringen regner et eksplicit 0 som **udfyldt**
    (`isStandardLoenTableValueEffectivelyEmptyForValidation`), mens dokumentgatens
    `hasAtLeastOneValidRow` kræver `samlet !== 0` gennem
    `isStandardLoenTableCellEffectivelyEmpty`. De to er enige om alt andet end netop nullet.
    **Det er en ny årsag i mønsteret:** hidtil kom afvisningen fra en MOTOR med flere afvisningsgrunde
    end feltmodellen; her kommer den fra to **tomheds-prædikater**, der er uenige. Prøven er
    tilsvarende ny og meget billig: **find fladens tomheds-prædikater og hold dem op mod hinanden på
    værdien 0.** Rettelsen hører fortsat ét sted – i feltmodellen (rød celle med «Beløbet skal være
    større end 0 kr.», jf. BB-038) eller ved at gøre 0 lovlig; ikke i gaten.
  - **BB-105 (Mellem) – den rene mangel-form, men udløst af PROGRAMMET.** Et klik på radioknappen
    «Løn indtastes som: Dato» tømmer periodecellerne, slukker omregnings-togglen og gør
    downloadknappen grå med «Indtastning mangler», uden at én celle er rød. Rækken er nu «beløb uden
    periode», altså `partial_period`, som efter kontrakten bevidst ikke må være en rød ring.
    **Forskellen til BB-083 er hele pointen:** dér efterlod brugeren rækken halvfærdig, her gjorde
    programmet det. **Skærpelse af prøven: kør M-16's mangel-halvdel ikke kun ved indtastning, men
    efter hvert valg, der ændrer hvilke kolonner en tabel viser.**
- **Kandidaten «Forsørgertab» er efterprøvet 2026-08-27, havde fejlen – og fejlen var VÆRRE end
  mønsterets hidtidige form** (`forsoergertab.md` BB-117, **Høj**). En efterladt på 17 år (fx tastet som
  `200808`, som feltet selv gør til `20-08-2008`) rammer et alderstrin, kapitaliseringstabellen ikke
  har: tabellerne dækker 18–66 år, feltets erklærede grænse er `01-01-1900` til dags dato. Motoren
  afviser med `forsoergertab-alder-missing` – en besked, programmet HAR formuleret og ingen komponent
  læser – og afvisningen kommer ud som et rent fravær: hele ASL-sektionen forsvinder, uden en rød celle
  og uden en advarsel. Grænsen er målt præcist: 18 år regner, 17 år gør ikke.
  **Men her stopper mønsteret ikke, og det er hele pointen.** M-16's kendetegn er, at afvisningen
  **spærrer** fladens dokumenter – «det værste ved formen er, at fejlen ikke bliver i rækken». På
  Forsørgertab spærrer den ikke: downloadknappen står uændret som «Download som Word», og dokumentet
  bliver hentet uden ASL-halvdelen og uden de fire ASL-oplysninger, brugeren har indtastet.
  Den anden halvdel er derfor blevet sit eget mønster, **M-25**, og de to skal læses sammen: M-16 siger,
  hvor rettelsen hører hjemme (i feltmodellen), M-25 siger, hvorfor gaten ikke fangede det.
- Kandidater, ikke efterprøvet: tilsvarende motorer med interne fejltyper findes i Varige mén
  og EO's rækkebyggere (`EO_ROW_BUILDERS`).

## M-17 – Én oplysning delt over to lagerscoper

> To halvdele af den samme oplysning ligger i hvert sit lager, og de to lagre har ikke samme
> rækkevidde. Så kan halvdelene komme til at beskrive hver sin sag.

Browseren har tre lagre med tre forskellige rækkevidder: `sessionStorage` hører til ÉN fane,
`localStorage` og IndexedDB hører til hele browseren. En oplysning, der er delt over to af dem,
er derfor kun konsistent, så længe der er præcis én fane åben. Fra og med den anden fane kan den
ene halvdel udskiftes uden at den anden ved det – og fordi hver fane sammenligner den halvdel, den
selv ejer, med sin egen tilstand, konkluderer den «uændret» og handler på en halvdel, der i
mellemtiden tilhører nogen andre.

Formen er farlig, fordi den er usynlig i normal drift: alt virker, så længe man tester med én fane,
og fejlen kræver netop den brugssituation, programmet selv lægger op til.

**Efterprøv, hvor:** en sagsnær oplysning skrives til `localStorage` eller IndexedDB, eller hvor to
værdier, der bruges SAMMEN i én beslutning, skrives til hvert sit lager. Prøven er konkret: **åbn
programmet i to faner, lad hver fane sætte sin egen værdi, og gå tilbage til den første.** Læser den
stadig sin egen – eller den andens?

Bemærk skellet mod en almindelig delt indstilling. Farvetema og standardmappe SKAL være fælles for
alle faner; det er hele deres formål. Mønsteret rammer kun oplysninger, der hører til den ENE sag,
fanen har åben.

- Fundet i: `globalshell.md` BB-049 (**Kritisk – accepteret og GENNEMFØRT 2026-08-19**). `Gem`s
  overskrivningsmål er én oplysning i to dele: selve filhåndtaget i IndexedDB (fælles for browseren)
  og filnavnet plus stamdatagrundlaget i `sessionStorage` (fanens eget). Med to faner skrev den ene
  sag ind i den andens fil, og kvitteringen var ordet «Gemt».
- **De to led er eftervist hver for sig i browseren** (fane B ser ikke fane A's `sessionStorage`;
  begge ser samme IndexedDB-base `mineo_file_handles`), men selve den forkerte skrivning kan ikke
  måles headless – filvælgeren åbner ikke. **Rettelsen er derfor mutationstestet frem for målt i
  browseren**, og den manuelle efterprøvning med to faner og to rigtige filer står stadig åben som
  bekræftelse.
- **Den generelle lære, skærpet af rettelsen:** en identitet skal følge det, den identificerer – og
  den BEDSTE identitet er den, der ikke skal vedligeholdes. Det oprindelige løsningsforslag var at
  gemme filnavnet SAMMEN med håndtaget i IndexedDB, men `FileSystemFileHandle` bærer allerede sit
  eget `name`, og `lastSavedFilename` skrives fra præcis samme kilde (`fileHandle.name`) ved hvert
  gem. Sammenligningen kunne derfor laves direkte, uden ny persistering, uden migrering – og uden en
  ekstra kopi, der selv kunne komme ud af sync og genindføre fejlen. **Spørg altid, om den identitet,
  der mangler, allerede findes på objektet**, før der lægges en parallel kopi ved siden af.
- Verifikationen af håndtaget (`verifyFileHandleDetailed`) spurgte kun «må jeg skrive, og findes
  filen?» – aldrig «er det den rigtige fil?». Den skelnen er nu normativ i
  `persistence-contract.md` §5.
- Kandidater, ikke efterprøvet: `fileHandleStorage` rummer også standardmappen (en indstilling og
  derfor uden for mønsteret). Efterprøv derimod enhver fremtidig sagsnær værdi i IndexedDB, og
  `UI_STORAGE_KEYS`-parrene, hvor to nøgler kun giver mening sammen.

## M-18 – Globale genveje kender ikke overlay-stakken

> Et overlay ejer tastaturet efter programmets eget regelsæt – men de genveje, der er registreret
> på `window`, har aldrig hørt om det.

Fokusfangst holder Tab inde i vinduet, og Escape er sendt gennem overlay-stakken. Men en genvej,
der lytter direkte på `window`, rammer uanset hvor fokus står og uanset hvad der ligger ovenpå.
Handlingen sker derfor BAG den åbne dialog, hvor brugeren hverken kan se den ske eller se dens
resultat – og han svarer derefter på et spørgsmål om en tilstand, der ikke længere findes.

Det er værre end en almindelig utilsigtet genvej, fordi et overlay pr. definition står, mens
brugeren tænker: en bekræftelse før en irreversibel handling er præcis det tidspunkt, hvor en
utilsigtet ændring af underlaget er dyrest.

**Efterprøv, hvor:** en `keydown`-lytter er registreret på `window` eller `document` uden for en
komponent, der selv er en del af overlay-stakken. Prøven er: **åbn en dialog, tryk genvejen, og se
om noget bag dialogen ændrer sig.**

- Fundet i: `globalshell.md` BB-050 (**Høj – accepteret og GENNEMFØRT 2026-08-19**). Med
  bekræftelsen «Slet alle indtastninger» åben ryddede Ctrl+Z feltet bagved (målt: Skadedato
  `99-99-9999` → tom), mens dialogen stod uændret og spurgte videre. Ctrl+S startede tilsvarende et
  helt gem – filvælger og det hele – bag den åbne bekræftelse.
- Mekanikken til at lukke hullet fandtes allerede: `components/ui/overlayBehavior.ts` ved præcis,
  hvad der er øverst på stakken. Begge lyttere spørger nu `hasOpenOverlay()`. Reglen er skrevet ind
  som normativ i `keyboard-navigation.md` §Overlay-adfærd.
- **Rettelsen dækker alle fem overlays på én gang**, fordi prøven spørger stakken frem for at nævne
  dialoger ved navn: de tre bekræftelser i shellen, licensvinduet og Løntrin-finderen. Sidstnævnte
  var den mest nærliggende for brugeren, fordi den har felter i sig.
- **`preventDefault()` hører med i reglen.** Genvejen må ikke spærre tasten uden at bruge den; ellers
  mister brugeren også browserens egen adfærd, og tasten bliver et sort hul. Det er samme fejlform,
  BB-054 handler om fra den anden side.
- **Lære om at måle det:** prøven skal hvile på en SYNLIG virkning. Den første udgave af Ctrl+S-prøven
  brugte en udfyldt sag og bestod, uanset om genvejen var spærret – fordi gem-flowet med data ender
  tavst i filvælgeren, som ikke kan betjenes i jsdom. Med en urørt sag svarer gem i stedet «Ingen data
  fundet at gemme», og fraværet af den besked er et positivt bevis. En prøve, der kun kan observere et
  fravær, skal have en modprøve, der viser, at nærværet var muligt.

## M-19 – Rødt læses som tomt af den flade, der låner værdien

> En side viser en værdi, en anden side ejer. Er værdien forkert, siger den lånende side, at den
> mangler – og citerer den to linjer længere ned.

En flade, der spejler et felt fra en anden side, læser typisk gennem den kanoniske vej, som med
vilje **skjuler** en værdi med en rød feltfejl. Læsningen giver derfor `undefined` i to helt
forskellige situationer: feltet er tomt, og feltet er udfyldt med noget forkert. Skriver fladen
samme tekst i begge tilfælde – «Mangler», «Indtastning mangler», «<felt> mangler» – har den samlet to
tilstande, brugeren skal håndtere modsat: den ene kræver, at han **indtaster**, den anden at han
**retter**.

Formen er let at overse, fordi teksten er sand i det ene tilfælde, og fordi den lånende flade
sjældent er den, man tester med forkerte data. Den bliver først synlig, når noget ANDET på samme
skærm citerer værdien: en bounds-fejl, der navngiver sin kilde, læser nemlig den rå canonical værdi
og er derfor upåvirket af den røde markering. Så står de to udsagn side om side.

**Det gør formen ekstra farlig ved parvise grænser (M-07).** To felter, der afgrænser hinanden, gøres
BEGGE røde. Er fødselsdatoen forkert, bliver den **rigtige** skadedato også rød – og den lånende
flade melder derfor en fejlfri værdi som manglende. Brugeren sendes efter det forkerte felt.

**Efterprøv, hvor:** en flade viser en værdi, den ikke selv ejer – spejlede stamdata-rækker,
«Mangler (angiv i …)»-linjer, afledte oplysninger som alder eller årsløn. Prøven er konkret: **giv
feltet en værdi, der er udfyldt men ugyldig** (uden for grænsen, forkert orden, uparsebar) og læs,
om den lånende flade siger «mangler» eller «ugyldig». Læs derefter HELE skærmen: citeres værdien
et andet sted?

**Løsningen findes i programmet selv – og det er dét, der gør mønsteret nemt at afgøre.**
`ForsoergertabOplysningerSection.tsx` gør det rigtige på sin tilsvarende flade: `{error ?? <>Mangler
(angiv i Stamdata)</>}` – feltets egen fejltekst, når der er en, og «Mangler» kun ved reelt tomt
felt. Et fund i dette mønster er derfor en **konvergensrettelse** mod en løsning, der allerede er
truffet, ikke et nyt designforslag.

- Fundet i: `varigemen.md` BB-064 (Høj – de to spejlede stamdata-rækker; en gyldig skadedato meldes
  som manglende, mens to andre linjer på samme skærm citerer den), BB-065 (satsrækkens
  «Beregningsdato mangler» om en udfyldt, rød beregningsdato – sandheden ligger i tooltippen) og
  BB-066 (samme række viser den ENE af to datoers fejl).
- **Alle tre fund accepteret og gennemført 2026-08-20**, og rettelsen blev den forudsagte
  konvergens: de lånende rækker skelner nu tomt fra rødt med `actionGate.ts`' to universelle
  standardbeskeder. Rettelsen er samtidig udbredt til to af de forudsagte kandidatsteder –
  EO-beregningsfanens skadedato-række og Forsørgertabs beregningssektion (commit `789d11f7`).
- Efterprøvet og i orden: Forsørgertabs to spejlede rækker (forlægget ovenfor).
- **Ny forekomst 2026-08-25 i mønsterets SPEJLVENDTE form** (`aarsloen.md` BB-110, Lav). Her siger den
  lånende udgave ikke «mangler» om noget udfyldt – den siger **«0»** om noget tomt. Årslønsdokumentet
  skriver «Antal feriedage (mandag-fredag) i de indtastede perioder **0**» for et felt, skærmen viser
  tomt (`String(antalFeriedage ?? 0)`), og tilsvarende for «Antal SH-dage» ved `null`. **Det er værre
  end «mangler» om noget udfyldt, fordi 0 er en PÅSTAND, der ændrer resultatet:** beregningen trækker
  0 feriedage fra perioden, mens den trækker 30 fra året. Dokumentet dokumenterer et valg, brugeren
  aldrig traf, over for modparten. **Prøven er ny og smal: `rg "\?\? 0" src/document/generators` – for
  hvert træf, hvad viser skærmen samme sted?**
- Kandidater, ikke efterprøvet: EET efter EAL's spejlede stamdata-rækker (flade 11),
  Erstatningsopgørelsens forudsætningsrækker (flade 12) og enhver tekst af formen «<felt> mangler»,
  der er koblet til en `undefined`-læsning frem for til et tomt felt.

## M-20 – En feltnær oplysning hentet fra hele sidens beregning

> Den gule advarsel hører til ét felt, men den læser sin værdi af den samlede projektion – og den
> findes kun, når HELE siden er regneklar.

En sides beregning bygges typisk som én projektion, der er `ready` først, når alle dens input er
gyldige. Det er rigtigt for et resultat. Men henter en **feltnær** oplysning – en gul feltadvarsel,
en enhed, en hjælpetekst om netop det felt – sin værdi fra samme projektion, arver den projektionens
alt-eller-intet-betingelse. Oplysningen bliver dermed usynlig, indtil felter, den intet har med at
gøre, er udfyldt.

Rækkefølgen gør det værre: det felt, advarslen hører til, er ofte det FØRSTE på fladen. Brugeren
taster værdien, får ingen advarsel, og møder den langt senere som en gul ramme, der tændte af sig
selv, da han udfyldte noget helt andet. Advarslen fremstår da som en advarsel om det sidste felt.

**Efterprøv, hvor:** en feltprop (`warning`, `helperText`, en label, en enhed) læser fra en
projektion, et snapshot eller et beregningsresultat frem for fra feltets eget read. Prøven er:
**udfyld KUN det felt, oplysningen hører til, og se om oplysningen findes.** Er den ikke der, er den
hængt op på det forkerte.

Bemærk skellet mod en ægte tværfelt-oplysning. En advarsel, der handler om et **forhold mellem**
felter, skal naturligvis afvente dem begge. Mønsteret rammer den oplysning, der kun afhænger af det
ene felts egen værdi.

- Fundet i: `varigemen.md` BB-062 (Høj). Méngrad `5` gav ingen advarsel, før beregningsdatoen var
  udfyldt; målt som neutral feltramme `rgba(0, 0, 0, 0.12)` uden tooltip, der efter en urelateret
  indtastning skiftede til `rgb(245, 158, 11)` med teksten. Advarslen læste
  `projectionData?.mengrad`, som først findes ved `ready`.
- **Accepteret og gennemført 2026-08-20:** advarslen læser nu méngradfeltets eget read i stedet for
  projektionen, og dens grænse blev i samme omgang rettet fra kun 5 % til 1–4 % – altså netop de
  værdier, hvor der ikke kan tilkendes mén (BB-063).
- Kandidater, ikke efterprøvet: EET-procenternes 15 %-advarsel (`EetOplysningerTab.tsx`, `BF-019`) –
  samme form, flade 11. Generelt: enhver `warning={resolve…(projection?.…)}`.

## M-21 – En CSS-klasse slår komponentens egen farve ihjel

> Koden beder om en nedtonet farve, stylesheetet siger noget andet – og stylesheetet vinder, uden at
> nogen får besked.

Programmets typografi er defineret som `.MuiTypography-root.<klasse> { color: … }`. En sådan regel
har **to** klasser i selektoren. En farve, komponenten selv beder om – MUI's `color`-prop eller
`sx={{ color }}` – ender i en genereret klasse med **én**. Enkeltklassen taber altid, uanset
rækkefølge i dokumentet. Resultatet er en farveangivelse, der står i koden, læses som hensigten og
ikke har nogen virkning.

Der kommer ingen advarsel, hverken fra TypeScript eller fra en test, og fejlen er selvforstærkende:
den næste, der har brug for en nedtonet rækketekst, skriver den samme døde prop, fordi den står i
koden lige ved siden af.

**Efterprøv, hvor:** et element har både en projektklasse fra `typography.css` og en farve fra
komponenten. Prøven er en måling, ikke en læsning: **aflæs `getComputedStyle(el).color` og
sammenlign med naboen uden farveangivelse.** Er de ens, er proppen død. Modprøve, hvis mekanismen
skal bevises: indsæt en enkeltklasse-regel EFTER app-stylesheetet og se den tabe alligevel
(målt 2026-08-20).

Programmet har en virksom vej til samme mål: klasserne `text-muted` og `body-text-secondary` har
selv to-klasse-specificitet og virker. Rettelsen er derfor at bruge klassen frem for proppen – og et
AST-værn, der afviser en farve-prop på et element med en `row--*`-klasse, lukker klassen af fejl.

- Fundet i: `varigemen.md` BB-067 (Mellem). Fire farveangivelser på fanen er døde; de tre
  «mangler»-tekster rendres i `rgba(0, 0, 0, 0.87)` – præcis samme farve som en indtastet værdi – så
  en tom sag ser udfyldt ud. To rækker med hver sin ønskede farve fik SAMME emotion-klasse, hvis
  eneste farveregel er standardfarven.
- **BB-067 er AFVIST af udvikleren 2026-08-20, og afvisningen vender mønsteret på hovedet for
  nedtoning.** Udviklerens indvending var, at rettelsen ville give det modsatte resultat: bliver
  «mangler»-linjerne først nedtonede, kan de blive linjerne, brugeren *ikke* registrerer – og de
  bærer netop det væsentligste, nemlig hvad der er galt. **Et fund om en død farve-prop skal derfor
  vise, at den ønskede farve gør oplysningen lettere at opdage, ikke blot at proppen er død.** Den
  skarpeste kandidat er dermed stadig `DocumentOutcomeMessage`s fejlbesked, hvor den døde prop
  trækker den forkerte vej: en fejl, der ikke er rød.
- Kandidater, ikke efterprøvet: `ForsoergertabOplysningerSection.tsx` (2 døde `color`-props),
  `Satser.tsx:30`, `CannotComputeAggregationNotice.tsx:13`, `DefaultDirectoryRow.tsx:27-30` og
  **`DocumentOutcomeMessage.tsx:34`, der beder om `error.main` til en fejlbesked** – altså en
  fejlbesked, der efter mekanismen ikke er rød. Den sidste er den, der bør efterprøves først.

## M-22 – En usynlig dokumentafhængighed på en anden flade slukker knappen

> Fladen har intet galt på sig, viser sit resultat – og dens downloadknap er grå, fordi et felt på en
> helt anden side er rødt. Knappen siger «Fejl i indtastning» om en fejl, der ikke findes her.

Et dokument har flere dependencies, end den flade der tegner knappen, har felter. Den hyppigste er
brevhovedets stamdata: hver definition læser en stamdataprojektion, og et rødt felt i Stamdata gør
den `blocked`. Blokeringen klassificeres derefter af sine issues, så brugeren får en af programmets
fire universelle tekster – og alle fire er formuleret, som om årsagen var på den flade, han ser.

Formen er farlig, fordi den fjerner enhver ledetråd. Et rødt felt er en synlig, lokal anvisning; en
blokering fra en anden flade er en grå knap uden afsender. Og den findes kun i drift: koden læser
naturligt, testene er grønne, og fejlen kræver, at man har to flader i spil samtidigt.

**Skellet mod M-19.** M-19 handler om en flade, der SPEJLER en fremmed værdi og kalder rødt for tomt.
Dette mønster rammer den flade, der **slet ikke viser** værdien. De to hænger sammen: rettelsen af
M-19 gav de spejlende flader et sted at vise årsagen, og efterlod de øvrige uden.

**Efterprøv, hvor:** en dokumentdefinition læser en projektion, hvis felter ikke findes på fladen –
`projectStamdataForDocument`, en anden sides beregning, en fælles indstilling. Prøven er konkret:
**gør et felt på den fremmede flade UDFYLDT-MEN-UGYLDIGT, og læs så downloadknappen og hele fladen.**
Er knappen grå, uden at noget på fladen er rødt, og uden at teksten navngiver den fremmede flade, er
det en forekomst.

Bemærk **det skarpeste led**: blokeringen er uafhængig af, om dokumentet faktisk bruger den fremmede
værdi. Brevhoved-flagene ligger i renderings-settings og anvendes EFTER gaten (bevidst, jf.
`mineoDocumentDefinition.ts`), så et dokument med brevhovedet slået fra blokerer på stamdata, det
aldrig ville trykke. Spørg derfor ikke bare «er afhængigheden reel?», men «er den reel *i denne
tilstand*?».

- Fundet i: `renteberegning.md` BB-080 (Høj). Målt: én række gav `27.111,89 kr.`, begge downloads
  aktive; en fødselsdato på `99-99-9999` i Stamdata (eller et fødselsdato/skadedato-par i umulig
  rækkefølge) slukkede begge knapper med «Fejl i indtastning», med **nul** røde felter på fanen og
  ordet «Stamdata» ingen steder. Bekræftet uændret med brevhovedet for Renteberegning slået FRA.
- **Bekræftet på to flader mere i samme kørsel.** **Satser**: samme fødselsdato slukker sidens eneste
  downloadknap med «Fejl i indtastning» – på et opslagsværk uden sagsdata, hvis brevhoved er slået fra
  som standard. Det er mønsterets tydeligste form. **Varige mén**: blokerer også, men fladen skriver
  «Stamdata – Fødselsdato: Fejl i indtastning», så brugeren har en ledetråd. Forskellen er præcis
  M-19's rettelse.
- Kun **Fødselsdato** og **Skadedato** kan gå røde i Stamdata; de fire tekstfelter er længdeværnede og
  skadestypen er et valg. Mønsteret har derfor en lille, men meget nem indgang.
- **`document.aarsloen` er efterprøvet 2026-08-25 og BESTÅET.** En fødselsdato på `99-99-9999` i
  Stamdata gør årslønsdokumentets knap grå med teksten **«Ret fejlen i Stamdata»** – fladen navngives,
  selv om Årsløn ikke viser en eneste stamdataoplysning. Det er BB-080's rettelse i drift på den
  flade, mønsteret pegede på. **Bemærk desuden, at rettelsen viser sin anden halvdel her:**
  SH-dage-bilaget på SAMME side blokerer IKKE, fordi dets brevhoved er slået fra som standard
  (`shDage: false`). Afhængigheden er altså blevet betinget, præcis som mønsteret forlangte. At de to
  knapper så står side om side i hver sin tilstand med samme navn, er et andet fund (`aarsloen.md`
  BB-104).
- Kandidater, ikke efterprøvet: `document.eet`, Forsørgertabs og Erstatningsopgørelsens
  reguleringsdefinitioner. Generelt: enhver `context.shared`-kilde, der læser felter uden for fladens
  egen sektion.

## M-23 – Aggregatet af-dublerer tiden, men ikke pengene

> To rækker, der beskriver samme tidsrum, tælles én gang i tiden og to gange i beløbet. Resultatet er
> et tal, der er 100 % forkert, uden et rødt felt og uden en advarsel.

En flade, der omregner et beløb over en periode, har to aggregater: en **tidsside** (dage, hverdage,
måneder, uger) og en **beløbsside**. Tidssiden bygges typisk som en mængde – et `Set` af datoer eller
af måneds-/ugenøgler – fordi den skal svare på «hvor lang tid dækker rækkerne tilsammen?». Beløbssiden
bygges som en simpel `reduce`-sum over rækkerne. De to er kun enige, så længe rækkerne ikke overlapper.

Formen er farlig, fordi **programmet selv ved besked**: det er netop af-dubleringen på tidssiden, der
beviser, at det har set overlappet. Det bruger bare kun viden ét af de to steder.

**Efterprøv, hvor:** et resultat er en brøk med en sum i tælleren og en mængdestørrelse i nævneren –
`sum / antalEnheder × norm`. Prøven er konkret og tager et minut: **indtast den samme række to gange
og se, om resultatet fordobles.** Gør det det, og nævneren står uændret, er det en forekomst.

- Fundet i: `aarsloen.md` BB-096 (Høj, afventer udvikleren). To identiske lønrækker (Måned `1`, År `2025`,
  Løn `30.000`) gav sammentællingen `69.000,00 kr.`, tidslinjen «23 hverdage - 1 SH-dag = 22
  arbejdsdage» og resultatet **`793.500,00 kr.`** mod `396.750,00 kr.` for én række. Ingen rød celle,
  ingen advarsel, begge dokumenter kunne hentes.
- **Bemærk, at der findes et LOVLIGT tilfælde**, og det er derfor fundet er et brugerspørgsmål og ikke
  en ren fejl: to ansættelsesforhold i samme måned skal rigtigt lægges sammen i beløb. Men så er det
  *tiden*, der er talt forkert – perioden bidrager kun én måneds arbejdsdage til nævneren. Uanset
  hvilken vej brugeren vælger, er den nuværende kombination forkert.
- Kandidater, ikke efterprøvet: samme mekanisme i Årsløns **Uge**- og **Dato**-tilstand (`datoSet` er
  en union i alle tre); EO's lønindkomst-fane (samme tabelkomponent, egen aggregering); forsørgertabs
  og EET's periodetabeller. Generelt: `rg "new Set" src/utils/periodeBeregning.ts` og enhver
  `unikkeEnheder`-agtig nævner.

## M-24 – Feltets grænse er sat af feltets art, ikke af det tal det trækkes fra

> Feltet har en grænse, der passer til hvad det ER (et antal dage, en procent, et beløb), men ikke til
> hvad det GØR – og programmet kender det tal, den skulle have været sat efter.

Prøvekatalogets B0 punkt 3 spørger, om en skarpere grænse kunne udledes af konteksten. Dette mønster
er det tilfælde, hvor svaret er ja **og** konteksten står synligt på samme linje. Et felt, hvis værdi
subtraheres fra et beregnet tal, skal have det tal som sit maksimum; ellers kan brugeren producere et
negativt mellemresultat, som programmet derefter er nødt til at gøre noget vilkårligt med – typisk
klampe til nul og præsentere nullet som et beløb.

Nullet er det egentlige onde: det er ikke en fejlmeddelelse, det er et **tal**. Det står i fed, det
kan trykkes i et dokument, og det ser ud som et svar.

**Efterprøv, hvor:** en beregningslinje har formen `(A - B)` og B kommer fra et felt. Prøven er:
**sæt B større end A og læs linjen.** Står der et negativt antal, eller står der `0,00 kr.` som
resultat, er det en forekomst. Læs derefter feltets erklærede grænse og spørg, om den overhovedet kan
rammes.

- Fundet i: `aarsloen.md` BB-097 (Høj, afventer udvikleren). «Antal feriedage» = `99` i en måned med 23
  hverdage gav «Hverdage i beregningsperioden (23 hverdage - 99 feriedage): **-76 hverdage**» og
  «Beregnet årsløn (33.750,00 / **-76** × 231): **0,00 kr.**» – med **aktiv** downloadknap.
- **To lærer af fundet, som gælder mønsteret generelt.** (1) Grænsen `0–99` er valgt efter feltets art;
  den kan aldrig rammes, fordi cifferloftet allerede er to cifre, så dens fejlbesked er **død kode**.
  Et loft, der er dubleret af et cifferloft, afværger intet – spørg altid, om de to grænser er den
  samme grænse skrevet to gange. (2) Motoren fail-softer allerede (`arbejdsdageIPeriode > 0`), men
  fail-soft uden en synlig årsag er værre end fail-closed: den producerer et lovligt udseende beløb.
- **Ny forekomst 2026-08-27 (`forsoergertab.md` BB-119), AFVIST 2026-08-28 – og afvisningen SKÆRPER
  mønsteret, som jeg havde sat for bredt.** Fundet var, at «Beregnet forsørgertab» viser `701.505 kr.`
  `- 643.653 kr.` `- 421.731 kr.` og derefter, med fed, **`0 kr.`** – hvor regnestykket giver
  `-363.879 kr.` De fire linjer trykkes ordret i dokumentet, og downloadknappen er aktiv. Jeg foreslog
  først at vise differencen, derefter – efter udviklerens første svar – blot én forklarende linje.
  **Begge dele er afvist:** værdien kan juridisk aldrig blive negativ (en negativ forsørgertabserstatning
  ville betyde en tilbagebetalingspligt), og det er velkendt for målgruppen, at det, der beregnes, er et
  eventuelt **overskydende** krav efter EAL, og at en negativ værdi vises som nul.
  **Jeg formulerede efter fundet den generelle regel «et klampet nul skal enten forhindres af en grænse
  eller forklares af en linje – det må aldrig bare stå der som et tal». Den regel er for bred og er
  trukket tilbage.** Den rigtige prøve skelner de to slags nul:
  - **Nullet ER ydelsens velkendte resultatform.** Klampningen udtrykker selve den regel, beregningen
    findes for – «er der noget tilbage?» – og målgruppen kender formen. **Ikke et fund**, uanset at de
    viste linjer ikke summerer til det viste resultat.
  - **Nullet DÆKKER OVER en umulig mellemregning.** Klampningen redder et resultat, der aldrig skulle
    være opstået – BB-097's «`23 hverdage - 99 feriedage` = `-76 hverdage`» og derefter årslønnen
    `0,00 kr.` **Det er fundet**, og rettelsen hører i grænsen, ikke i en forklarende linje.
  Prøven `sæt B større end A og læs linjen` gælder uændret som **måling**; det er bedømmelsen bagefter,
  der er skærpet. **Spørg altid: er nullet svaret, eller er det et plaster?** Kun det sidste er et fund.
  Bemærk endelig, at mønsterets oprindelige punkt 1 om aggregatet står ved magt som beskrivelse af
  mekanikken – klampningen kan ligge på en sum og ikke kun på et felt – men den mekanik gør det ikke i
  sig selv til et fund.
- Kandidater, ikke efterprøvet: ethvert felt, hvis værdi trækkes fra et tal programmet selv har
  beregnet – EET's og forsørgertabs fradragsfelter, EO's reguleringsbilag. Generelt:
  `rg " - \$\{" src/components/pages` over mellemregningstekster med et fradrag i parentes, og
  `rg "Math.max\(0,|clampMoneyOreToZero" src/domain` over de klampede aggregater.

## M-25 – Gaten spørger «findes der noget?», ikke «findes det, brugeren bad om?»

> En flade regner to halvdele, og dokumentgaten godkendes af den ENE af dem. Falder den anden ud, sker
> det tavst: intet er rødt, knappen er aktiv, og papiret ser færdigt ud.

En flade med valgfrie dele bygger typisk sin gate som «har vi noget at trykke?» – `!canShowA && !canShowB`
blokerer, alt andet slipper igennem. Betingelsen er sand og rigtig for den bruger, der bevidst kun regner
den ene halvdel. Den er katastrofal for den bruger, der har udfyldt begge og har mistet den ene undervejs:
de to tilstande ser **ens** ud på skærmen og i dokumentet.

Formen er farlig, fordi den vender programmets normale beskyttelse om. En manglende oplysning giver
normalt en grå knap; her giver en manglende BEREGNING en aktiv knap, netop fordi noget andet lykkedes.
Og den kan ikke ses i koden: gaten læser fornuftigt, testene er grønne, og fejlen kræver et input, der
rammer et hul i et datasæt.

**Efterprøv, hvor:** en dokumentdefinition eller en gate indeholder et ELLER mellem to `canShow`-flag,
eller hvor generatoren har `if (x !== null)` omkring en hel sektion. Prøven er konkret: **udfyld begge
halvdele, ødelæg derefter den ene med en værdi, der er lovlig i feltet men uden dækning i beregningen –
og læs downloadknappen.** Er den aktiv, hent dokumentet og tæl, hvad der mangler.

**Skellet mod M-16.** M-16 handler om en afvisning, der kommer ud som et fravær og **spærrer** hele
fladens dokumenter. M-25 er den anden halvdel: den samme afvisning kommer ud som et fravær og spærrer
**ikke**. De to hører sammen – M-16 siger, hvor rettelsen hører hjemme (i feltmodellen, ved det felt
brugeren skal rette), M-25 siger, hvorfor gaten ikke fangede det.

**Den bagvedliggende regel er skarpere end gaten:** en gate må ikke kun spørge, om der er noget at
trykke. Den skal spørge, om alt det, brugeren har udfyldt, er kommet med.

**Rettelsen (2026-08-28) føjede to ting til mønsteret, som ikke var synlige fra fundet:**

1. **En allowlist er den forkerte form.** Forsørgertabs gate navngav fem issue-ID'er, der blokerede.
   `forsoergertab-alder-missing` og fem søskende stod ikke på listen. Retningen skal være omvendt: ethvert
   error-issue blokerer, og en undtagelse skal tilføjes aktivt. De tre øvrige flader var allerede
   fail-closed på præcis den måde – Forsørgertab var outlier'en, og det var ikke synligt fra fladen selv.
2. **«Blokerer den?» og «hvad hedder blokeringen?» er TO beslutninger.** Da gaten blev fail-closed på
   severity, kom en tom sag til at melde «Fejl i indtastning», før brugeren havde skrevet noget – fordi et
   *manglende input*-issue også har severity `error`. Blokeringen skal være bred, klassifikationen smal:
   listen af konkrete inputfejl afgør TEKSTEN, mens severity afgør BLOKERINGEN. En senere ændring, der
   slår de to sammen igen, genindfører den fejl.

- Fundet i: `forsoergertab.md` BB-117 (**Høj**, RETTET 2026-08-28). Målt: en efterladt på 17 år
  (`20-08-2008` på en beregningsdato i 2025) rammer et alderstrin uden for kapitaliseringstabellens
  18–66 år. Hele «ASL-ydelser»-sektionen forsvinder, «Beregnet forsørgertab» med den, ingen celle er
  rød – og knappen står som «Download som Word». Dokumentet indeholder kun Beregningsdato og
  Skadelidtes fødselsdato under «Grundlæggende oplysninger»: de fire ASL-oplysninger, brugeren netop har
  indtastet, er væk, og papiret slutter med «Beregnet EAL-krav 1.155.420 kr.» med fed, uden det fradrag
  på `1.065.384 kr.`, sagen faktisk har. Grænsen er målt: 18 år regner, 17 år gør ikke.
- **Bemærk, hvor smal indgangen er, og hvor almindelig den er.** Datofeltet fortolker selv tocifrede
  årstal, så `200808` bliver `20-08-2008`. Et forkert århundrede i efterladtes fødselsdato er præcis den
  slags tastefejl, skillens præmis handler om – og den er den eneste, der skal til.
- **Den tavse halvdel er værd at kende ved sit navn:** hver af de tre `if (… !== null)` i
  `forsoergertabDocument.ts` udelader en hel side af dokumentet, og `addGrundlaeggendeSection`s `visAsl`
  udelader tre indtastede felter fra forsiden. Ingen af dem efterlader et spor.
- Kandidater, ikke efterprøvet: **Erhvervsevnetab** (to faner, hver med sin del af dokumentet),
  **Erstatningsopgørelsen** (mange valgfri afsnit i ét dokument) og reguleringsbilaget. Generelt:
  `rg "!canShow|=== null \?" src/domain` over dokumentdefinitioner og generatorer, og hvert
  tabelopslag, hvis datasætdækning er smallere end det felt, der slår op i det.

## M-26 – Et delt felt med to hjem

> To sider redigerer det SAMME felt under hver sit navn, med hver sin advarsel – og ingen af dem siger,
> at en rettelse det ene sted ændrer det andet.

Et felt har ét sandt sted: descriptoren, med sin `label`, sin codec og sine validatorer. Men rækken
omkring feltet tegnes af siden, og to sider kan tegne den forskelligt. Når den samme descriptor
renderes fra to flader, opstår tre lag af navne – sidens synlige label, descriptorens eget `label`
(som fejltekster og oplæsning bruger) og dokumentets label – og de kan alle tre være forskellige uden
at nogen test bliver rød.

Værre er de **parallelle afledninger**: hver side udleder sine egne feltadvarsler i sit eget snapshot,
så den samme regel bliver skrevet to gange og driver fra hinanden. Den ene tekst konstaterer, den anden
beder om en handling – og brugeren, der ser begge, tror der er tale om to forskellige forhold.

**Skellet mod M-19.** M-19 handler om en flade, der **spejler** en fremmed værdi read-only. Dette
mønster handler om et felt, der kan **redigeres** fra to steder. Konsekvensen er en anden: ikke en
misvisende tekst, men en ændring af et andet områdes tal, brugeren ikke bad om.

**Skellet mod Satser-fladens lukkede spor 5.** Afgørelsen dér var, at «brugeren kan tro, at de to sider
hænger sammen» kun er et fund, hvis der **faktisk ER en kobling**. Det er netop betingelsen her: værdien
er én og den samme.

**Efterprøv, hvor:** en descriptor bindes fra mere end én sidekomponent. Prøven er konkret: **skriv en
værdi på den ene flade, gå til den anden og se, om den står der** – og sammenlign så rækkens label,
feltets `aria-label` og dokumentets label for samme felt.

- Fundet i: `forsoergertab.md` BB-123 og BB-124 (begge Mellem, afventer udvikleren).
  `faellesAarsloen.aslAarsloen` og `.ealAarsloen` renderes af både **Forsørgertab** og
  **Erhvervsevnetab**. Målt: `551.000` skrevet på Forsørgertab står på Erhvervsevnetab, uden at nogen af
  siderne siger det. Hvert felt bærer tre navne – ASL: «Skadelidtes årsløn (efter ASL)» / «Årsløn» /
  «Skadelidtes årsløn (efter ASL)» i dokumentet, med descriptorens eget `label` = «Årsløn»; EAL:
  «Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)» / «Årsløn (hvis forskellig fra ASL)» /
  «Skadelidtes årsløn (efter EAL)».
- **Den parallelle advarsel er den skarpeste halvdel** (BB-124). Samme udløser – ASL-årslønnen lig
  skadesårets maksimum, EAL-årslønnen tom – giver «Når årsløn efter ASL svarer til maksimum, skal den
  faktiske årsløn indtastes.» på Forsørgertab og «Årsløn efter ASL er sat til max-årslønnen» på
  Erhvervsevnetab. To implementeringer (`forsoergertabSnapshot.ts`, `eetFieldWarnings.ts`), hvoraf den
  ene er kommenteret med, at den er «samlet så feltvisningen og beregningen ikke kan drifte» – den er
  blot drevet fra sin nabo i stedet for fra sin egen motor. **Læren: en regel er ikke samlet, fordi den
  er samlet ÉT sted; den er samlet, når der ikke findes et andet sted, der gør det samme.**
- Bemærk, at koden kender problemet og har løst den ene halvdel af det: begge flader sætter en
  `EditorLocation` med hver sin `route`, netop så undo/redo lander på den side, brugeren stod på.
  Identiteten er altså allerede erkendt som tvetydig – bare ikke over for brugeren.
- Kandidater, ikke efterprøvet: `rg "faellesAarsloen" src/components/pages` (rammer også
  Erstatningsopgørelsen), og generelt enhver descriptor, hvis `bind()` kaldes fra mere end én
  sidekomponent.
