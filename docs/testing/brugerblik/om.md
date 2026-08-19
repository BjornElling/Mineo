# Brugerblik – Om

- Rute/placering: `/mineo` (sidemenuens punkt hedder «Om», sidens overskrift hedder «Mineo»)
- Gennemgået: 2026-08-16 · commit `190f9453`
- Forelagt og besvaret: 2026-08-16 i to runder – **alle tolv fund afgjort**, fire af dem efter
  modpres. De to aftalte tekstrettelser er gennemført; BB-013 var allerede gennemført af brugeren.
- Afprøvet i: Chrome (Playwright, headless), CSS-viewport 1536×864 som hovedmål; layoutet desuden
  målt ved 1920, 1728, 1600, 1440, 1366 og 1280 px bredde. Devserver på 127.0.0.1:3000.

## Fladen kort

Om er programmets **standard-startside**: uden andet valg lander en bruger her efter login. Fladen
har ingen sagsdata og ingen beregning. Den består af fem tekstbokse – Programmet, Teknisk,
Persondata, Licensvilkår, Status – og en fælles bundlinje med kontaktadresse og de tre søskendesider.

Der er præcis tre betjenbare kontroller: knappen «Installér hjælpeprogram», som starter browserens
installation af .eo-filhjælperen; kontakten «Gør stamdata-siden til startside fremover», som ændrer
hvor programmet åbner næste gang; og knappen «MIT-licensen», som åbner licensvinduet. Dertil fem
links: GitHub, kontaktadressen og de tre søskendesider.

Fladen er altså næsten ren visning – men den er også det sted, hvor programmet **udtaler sig om sig
selv**: hvad der sker med brugerens oplysninger, hvad der gemmes, og hvad der sendes. De påstande er
ikke pynt: de er det eneste sted, brugeren kan læse, hvornår hans arbejde forsvinder, og det er dem,
han vil blive spurgt om, hvis hans arbejdsplads spørger til persondata.

**Sidens formål er juridisk.** Brugerens afgørelse af BB-020 tilføjer en oplysning, gennemgangen ikke
selv kunne udlede, og som ændrer læsningen af hele fladen: Om vises som standard-startside, fordi
licensvilkårene fremgår af den, og fremvisningen er en juridisk garanti for, at brugeren har set dem.
Fladen er altså ikke en «kom i gang»-side, og den skal ikke bedømmes som en.

---

## Brugerens afgørelser (2026-08-16)

Alle tolv fund er forelagt, besvaret og – efter en anden runde med modpres på fire af dem –
**afgjort. Ingen fund er åbne.** Den enkelte afgørelse står i sin helhed under fundet, sammen med
agentens efterprøvning af præmisserne.

| ID | Afgørelse | Kode |
|---|---|---|
| BB-011 | **Accepteret efter modpres** – adfærden bevares, teksten rettes. Ny ordlyd aftalt | **Gennemført** (tekst) |
| BB-012 | **Delvist accepteret efter modpres** – de to nøgleord bevares, tre unøjagtigheder rettes. Ny ordlyd aftalt | **Gennemført** (tekst) |
| BB-013 | **Accepteret efter modpres – og gennemført samme dag** som en generel linkregel med to primitiver, AST-værn og e2e-måling | **Gennemført** |
| BB-014 | Accepteret som kendt og acceptabel risiko – få brugere står præcis på 1536×864, og zoom-løsningen ændrer præmissen | Nej |
| BB-015 | Afgjort – 1536×864 og opefter er designmålet; den implementerede shell-kontrakt dækker desuden 1244×620 CSS-px ved 100 % browserzoom | Nej (her) |
| BB-016 | Afgjort – bevidst designvalg. Nu tillige håndhævet strukturelt via BB-013's `ExternalLink` | Nej |
| BB-017 | Afgjort – «klik for at få svar» er et acceptabelt kompromis | Nej |
| BB-018 | **Accepteret – skal rettes.** Brugeren har leveret brødteksten; knappen skrives «Installér» efter husstilen | **Gennemført** (tekst) |
| BB-019 | Afvist – ikonerne er en genkendelsesnøgle, ikke en oplysning | Nej |
| BB-020 | Afvist – bevidst undtagelse; Om-siden vises af juridiske grunde, og fravalget skal være let at nå | Nej |
| BB-021 | Afvist – ét navn i to sammenhænge, ikke to navne | Nej |
| BB-022 | Afvist – professionelle brugere går selv til den beregning, de skal bruge | Nej |

**Modpresset ændrede udfaldet tre gange ud af fire**, og på hver sin måde: BB-011 og BB-013 blev
omgjort, fordi præmissen ikke holdt; BB-012 blev omgjort **delvist**, fordi brugeren havde ret i, at
kritikken var sat for bredt; BB-014 blev fastholdt på en ny og bedre begrundelse. De fire steder er
værd at læse for begrundelserne, ikke kun for udfaldet.

---

## Fund

### BB-011 – Sagen forsvinder med fanen, ikke med browseren – og siden siger ikke, hvordan man beholder den

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11-programmets-egne-påstande-om-sig-selv`
- **Prioritet:** Høj
- **Beslutning:** **Afgjort 2026-08-16** – accepteret efter modpres; adfærden bevares, teksten rettes
- **Sådan fremprovokeres det:**
  1. Skriv `Test Testesen` i Skadelidtes navn på Stamdata.
  2. Gå til Om og læs sidste linje i «Persondata».
  3. Åbn programmet i en **ny fane** i den samme browser (browseren er ikke lukket).
- **Det sker:** Den nye fane står med en **tom sag**. Målt: sagen ligger i fanens egen hukommelse
  (`sessionStorage`, nøglen `mineo_input_v2`), ikke i en hukommelse browseren deler mellem faner.
  Lukker brugeren fanen, er sagen væk – også selv om browseren bliver stående åben. Teksten på
  siden siger derimod: «Mens programmet kører, bliver de indtastede oplysninger midlertidigt gemt i
  browserens hukommelse, som nulstilles, når browseren lukkes.»
- **Det er uhensigtsmæssigt fordi:** Dette er den ENESTE sætning i hele programmet, der fortæller
  brugeren, hvornår hans arbejde forsvinder – og den navngiver den forkerte begivenhed, i den farlige
  retning. En bruger, der lukker fanen ved arbejdsdagens slutning i tillid til, at browseren stadig
  kører, mister en hel sags indtastninger. Sætningen siger heller ikke det ene, der ville have reddet
  ham: at han skal bruge «Gem» for at beholde sagen. Konsekvensen rammer prioritet 1 på skillens
  vægtskala – noget brugeren har skrevet, forsvinder.
- **Bedre ville være:** At sætningen navngiver fanen og peger på udvejen, fx: «Så længe fanen er
  åben, ligger dine indtastninger i browserens hukommelse. Lukker du fanen, er de væk – også hvis
  browseren stadig kører. Brug **Gem** for at beholde sagen som en .eo-fil på din computer.» Det er
  samtidig værd at sige, at en ny fane starter en ny, tom sag; to faner er to sager, ikke to vinduer
  ind i den samme.
- **Andre steder det kan gælde:** Enhver tekst, der beskriver, hvad programmet gør ved brugerens
  data – herunder Indstillinger-sidens beskrivelser og bekræftelsesdialogernes ordlyd
  («Slet alt», overskrivning ved Hent).

**Brugerens afgørelse.** Adfærden er korrekt og bevares. En bruger må kunne forvente, at den åbne sag
hører til den åbne fane; at en ny fane er en ny sag, er den rigtige model.

**Agentens modpres – afgørelsen besvarer ikke fundet.** Jeg er enig i adfærden og har ikke foreslået
at ændre den; hverken «Sådan fremprovokeres det» eller «Bedre ville være» rører ved, hvor sagen
ligger. Fundet handler om **sætningen**, og den siger noget andet end det, du netop har afgjort:

> «Mens programmet kører, bliver de indtastede oplysninger midlertidigt gemt i browserens hukommelse,
> som nulstilles, når browseren lukkes.»

Den nævner browseren, ikke fanen. Din model – sagen hører til fanen – er præcis det, teksten
undlader at sige. En bruger, der læser den ene sætning, programmet har om emnet, og som lukker sin
fane ved fyraften med browseren stående åben, har fulgt teksten og mistet sagen. Og teksten nævner
ikke «Gem», som er den eneste måde at beholde sagen på tværs af fanen.

Spørgsmålet står derfor stadig, nu renset for adfærdsdelen: **skal sætningen rettes, så den siger
«fanen» i stedet for «browseren» og peger på «Gem»?** Adfærdsdelen er lukket og genåbnes ikke.

**Brugerens endelige afgørelse (2026-08-16, anden runde).** Modpresset accepteres: adfærden bevares
uændret, og **teksten rettes**. Fundet er dermed lukket som en ren tekstrettelse.

**Den nye tekst** (erstatter sidste sætning i «Persondata»):

> Så længe fanen er åben, ligger dine indtastninger i browserens hukommelse. Lukker du fanen, er de
> væk – også selv om browseren stadig kører. Brug **Gem** for at beholde sagen som en .eo-fil på din
> computer.

**Agentens bemærkning til ordlyden.** Sætningen om, at «to faner er to sager», er bevidst udeladt.
Den er sand, men den besvarer et spørgsmål, brugeren ikke har stillet, og den forlænger et afsnit, der
skal kunne læses på ti sekunder. Det, der skal frem, er hvornår arbejdet forsvinder, og hvad man gør
ved det – begge dele står nu i tre linjer. Rettelsen gennemføres sammen med BB-012, da de rammer
samme tekstboks.

---

### BB-012 – «Der indsamles, gemmes eller transmitteres ingen data» – programmet gemmer og henter faktisk noget

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11-programmets-egne-påstande-om-sig-selv`
- **Prioritet:** Mellem
- **Beslutning:** **Afgjort 2026-08-16** – delvist accepteret efter modpres; teksten rettes
- **Sådan fremprovokeres det:**
  1. Læs anden og tredje linje i «Persondata»: «Programmet kommunikerer ikke med nogen server under
     brug, og der indsamles, gemmes eller transmitteres ingen data – hverken persondata,
     brugsstatistik eller anden information.»
  2. Skift farvetema på Indstillinger, luk browseren helt, og åbn programmet igen.
- **Det sker:** Farvetemaet – og alle øvrige indstillinger – står, som brugeren efterlod dem. De
  ligger permanent på maskinen (`localStorage`, nøglen `mineo_app_settings_v1`). Har brugeren valgt
  en standardmappe til dokumenter, gemmes desuden en henvisning til den mappe i browserens database
  og overlever ligeledes en genstart. Og programmet **taler** med den server, det kom fra: mens det
  kører, henter det sin egen fortegnelse over programfiler for at opdage, om der er kommet en ny
  version (`serviceWorkerBootstrap.ts`), ligesom dele af programmet først hentes, når de bruges.
- **Det er uhensigtsmæssigt fordi:** Den vigtige og sande del af løftet er, at **ingen oplysninger om
  sagen eller om brugen forlader maskinen**. Men påstanden er formuleret bredere, end den kan holde,
  og netop denne side er den, en bruger vil vise sin arbejdsplads, hvis der bliver spurgt til
  persondata. Én person med et netværksvindue åbent kan se trafik til mineo.dk og konkludere, at
  siden ikke passer – og så mister han også tilliden til den del, der er rigtig. En for bred garanti
  er svagere end en præcis.
- **Bedre ville være:** At skille de to ting ad, fx: «Ingen oplysninger om din sag og ingen
  brugsstatistik forlader din computer – programmet sender ingen data nogen steder hen. Programmet
  henter kun sig selv fra mineo.dk, herunder når det kontrollerer, om der er kommet en ny version.
  Dine indstillinger (fx farvetema og standardmappe) gemmes lokalt på den computer, du bruger.»
- **Andre steder det kan gælde:** Samme prøve – påstand mod målt adfærd – hører til på Indstillinger,
  hvor teksterne beskriver, hvad en indstilling gør.

**Brugerens afgørelse.** Analysen er fejlbehæftet og unødvendigt bekymret. Programmet lover, at det
ikke gemmer nogen data om de skadelidte, som beregningerne vedrører, og det løfte holder.

**Agentens modpres – vi er enige om løftet, uenige om, hvad teksten siger.** Jeg er helt enig i, at
ingen sagsdata forlader maskinen, og at det er det løfte, der betyder noget. Mit ærinde er ikke
bekymring for persondata; det er, at teksten er formuleret bredere end det løfte, den skal bære.
Tre konkrete steder:

1. **«Anden information» er ikke afgrænset til skadelidte.** Sætningen lyder: «der indsamles, gemmes
   eller transmitteres ingen data – hverken persondata, brugsstatistik eller **anden information**».
   Programmet gemmer faktisk noget under den betegnelse: alle indstillinger ligger permanent på
   maskinen, og har brugeren valgt en standardmappe, gemmes også en henvisning til den. Det er
   uskyldigt – men det er «anden information», og teksten siger, at der ikke gemmes nogen.
2. **Den foregående sætning handler slet ikke om skadelidte.** «Programmet kommunikerer ikke med
   nogen server under brug» er en påstand om kommunikation. Programmet henter under drift sin egen
   fortegnelse over programfiler for at opdage en ny version og henter dele af sig selv, når de
   bruges. Ingen af delene sender noget om brugeren eller sagen – men de er serverkommunikation
   under brug.
3. **Konsekvensen er ikke juridisk, men tillidsmæssig.** Det er ikke en persondatarisiko. Det er, at
   en it-afdeling med et netværksvindue åbent kan modbevise sætningen på ti sekunder – og derefter
   ikke tror på resten af afsnittet, som er både sandt og vigtigt. En præcis garanti er stærkere end
   en bred.

**Den mindst mulige rettelse**, hvis du vil have den: lad de to første sætninger stå og skift kun
slutningen af den anden, så løftet bliver dét, du selv formulerer ovenfor – «… og der indsamles,
gemmes eller transmitteres ingen oplysninger om sagen eller om din brug af programmet.» Så er
indstillinger og opdateringstjek ikke længere omfattet, og løftet er skarpere end før. Fastholder du
efter dette, at teksten er dækkende, lukker jeg fundet uden videre.

**Brugerens endelige afgørelse (2026-08-16, anden runde).** Delvis enighed: teksten må gerne
præciseres, så det tydeligere fremgår, at løftet handler om oplysninger om de skadelidte. Men
modpresset er for bredt sat: programmet udveksler **heller ikke** brugsdata eller statistik, og det er
oplysninger om brugerens adfærd, ikke om skadelidte. Betingelsen for at rette er, at den nye tekst er
korrekt **og** kort – en fyldestgørende formulering, der bliver lang og kringlet, er ikke en
forbedring.

**Agentens korrektion – brugeren har ret på det punkt.** Der findes ingen telemetri, ingen
brugsstatistik og intet indsamlingspunkt i programmet; `AGENTS.md` forbyder det, og gennemgangen fandt
intet. Løftets to nøgleord – «persondata» og «brugsstatistik» – er altså begge sande og skal blive
stående. Modpresset gjaldt kun tre ting i sætningen, og de kan rettes uden at gøre den længere:

| Nuværende ordvalg | Hvorfor det udgår |
|---|---|
| «kommunikerer ikke med nogen server under brug» | Programmet henter sin egen filfortegnelse for at opdage en ny version. Erstattes af den positive oplysning om, hvad der faktisk hentes. |
| «gemmes» | Indstillinger og en eventuel standardmappe gemmes faktisk lokalt. Hvor indtastningerne ligger, siger BB-011's nye sidste sætning nu præcist. |
| «eller anden information» | Netop den formulering, indstillingerne falder ind under. Uden den er der intet at modbevise. |

**Den nye tekst** (erstatter anden sætning i «Persondata»):

> Der indsamles ingen persondata og ingen brugsstatistik, og ingen oplysninger om dig eller om din
> sag forlader din computer. Programmet kontakter udelukkende serveren i forbindelse med, at det
> henter opdateringer og nødvendige ressourcer.

To sætninger mod én, cirka samme længde som i dag. Løftet er samtidig blevet **stærkere**, ikke
svagere: «forlader din computer» er det, brugeren og hans arbejdsplads faktisk vil vide, og det kan
ikke modbevises med et netværksvindue.

**Hele boksen efter BB-011 + BB-012** (første sætning er uændret):

> Mineo er udviklet som en client-side applikation. Det indebærer, at al databehandling finder sted i
> browseren på brugerens egen computer.
>
> Der indsamles ingen persondata og ingen brugsstatistik, og ingen oplysninger om dig eller om din
> sag forlader din computer. Programmet kontakter udelukkende serveren i forbindelse med, at det
> henter opdateringer og nødvendige ressourcer.
>
> Så længe fanen er åben, ligger dine indtastninger i browserens hukommelse. Lukker du fanen, er de
> væk – også selv om browseren stadig kører. Brug **Gem** for at beholde sagen som en .eo-fil på din
> computer.

**Implementering.** Alle tre afsnit er `Typography`-elementer i
[Mineo.tsx](../../../src/components/pages/Mineo.tsx) under overskriften «Persondata». Ingen mekanik,
ingen kontrakt, intet nyt værn – ren tekst. Rettelsen er gennemført i én omgang sammen med BB-011.

---

### BB-013 – Søskendesiderne åbner oven i programmet og skubber sagen til side

- **Type:** Fornuft
- **Rækkevidde:** Lokal (men bunden hører til på enhver flade, der får bundlinjen)
- **Prioritet:** Mellem
- **Beslutning:** **Afgjort 2026-08-16** – accepteret efter modpres og gennemført som generel linkregel
- **Sådan fremprovokeres det:**
  1. Skriv noget på Stamdata, så sagen har indhold.
  2. Gå til Om og klik på «minDomssamling.dk» nederst på siden.
- **Det sker:** Browseren spørger, om siden må forlades, med sin egen generiske advarsel om, at
  ændringer kan gå tabt. Siger brugeren ja, forsvinder programmet ud af fanen og erstattes af den
  anden hjemmeside. Målt: har brugeren i mellemtiden genindlæst programmet (F5), kommer advarslen
  **slet ikke** – så forsvinder programmet uden et ord. Sagen er ikke tabt, hvis brugeren straks går
  tilbage, men det ved han ikke, og lukker han fanen ovre på den anden side, er den væk (BB-011).
  Kører programmet derimod som installeret hjælpeprogram, åbner præcis de samme links i en ny fane.
- **Det er uhensigtsmæssigt fordi:** De tre søskendesider er opslagsværker, man bruger **mens** man
  sidder med en sag – en domssamling, en paradigmesamling, en renteberegner. At slå noget op må ikke
  koste programmet, man arbejder i. Og at den samme handling opfører sig forskelligt alt efter, om
  programmet kører i browseren eller som hjælpeprogram, er en forskel brugeren ikke har nogen måde at
  forudse.
- **Bedre ville være:** At de tre søskendesider – og GitHub-linket – altid åbner i en ny fane, som de
  allerede gør i hjælpeprogrammet. Så er opslaget gratis, og sagen står urørt, hvor den var.
- **Andre steder det kan gælde:** Kontaktadressen i samme bundlinje (mailto) og ethvert andet link ud
  af programmet. Bundlinjen bruges i dag kun her og på standalone MinProcesrente.

**Brugerens afgørelse.** Analysen er fejlbehæftet: alle links til eksterne sider åbner i en ny fane.

**Agentens modpres – påstanden er halvt rigtig, og målingen viser hvilken halvdel.** Jeg efterprøvede
den igen 2026-08-16 med en ren session, netop fordi et faktuelt modsvar kræver, at jeg har ret:

| Link | `target` | Målt udfald ved klik |
|---|---|---|
| github.com/BjornElling/Mineo | `_blank` | **Ny fane.** Fane 1 åbnede med GitHub; Mineo blev stående i fane 0 |
| minDomssamling.dk | *ingen* | **Samme fane.** Der var stadig kun én fane, og den stod på mindomssamling.dk |
| minParadigmesamling.dk | *ingen* | samme mekanisme |
| minProcesrente.dk | *ingen* | samme mekanisme |
| bel@fho.dk (bundlinjen) | *ingen* | samme mekanisme |

GitHub-linket gør altså præcis det, du beskriver – og det er sandsynligvis dét, erindringen bygger
på. De tre søskendesider og kontaktadressen gør det ikke.

Koden forklarer hvorfor, og forklaringen er en let overset omvending. I `SiblingSitesFooter.tsx`
sættes `target="_blank"` **kun**, når `useInstalledPwaDisplayMode()` er sand – altså kun når
programmet kører som det installerede hjælpeprogram. Variablen hedder `openSiteLinksInBrowser`, og
navnet betyder «åbn linkene ude i browseren», ikke «åbn dem i en ny fane i browseren». I en
almindelig browserfane er attributten tom, og linket erstatter derfor programmet.

Fundet står altså ved magt, og spørgsmålet er uændret: **skal de tre søskendesider og
kontaktadressen også åbne i en ny fane, når Mineo kører i browseren – som GitHub-linket allerede
gør?** Bemærk, at afgørelsen af BB-016 (bundlinjen holdes uden for tastaturrækkefølgen) er upåvirket
af dette; de to ting er uafhængige.

**Brugerens endelige afgørelse (2026-08-16, anden runde).** Målingen accepteres, og den oprindelige
præmis trækkes tilbage. Rettelsen laves ikke som en lokal lap på bundlinjen, men som en **generel
strukturel regel** for hele programmet: **eksterne links åbner altid i en ny fane, interne links
åbner i den eksisterende.** Reglen er implementeret i denne ændring og ligger uden for Brugerbliks
bord.

**Gennemført af brugeren samme dag.** Ændringen er ikke et udestående punkt, men implementeret i
arbejdstræet, og den er lavet som en regel frem for en lap:

- to fælles primitiver, `src/components/ui/ExternalLink.tsx` og `InternalLink.tsx`. `ExternalLink`
  sætter `target="_blank"`, `rel="noopener noreferrer"` og `tabIndex={-1}` **fast**, og props-typen
  udelader netop de attributter, så et enkelt kaldssted ikke kan vælge en anden variant;
- de tre søskendesider, GitHub-linket og Satsers retsinfo-henvisninger går nu gennem `ExternalLink`;
- `useInstalledPwaDisplayMode` er slettet – den betingelse, der gjorde adfærden afhængig af, om
  programmet kørte som hjælpeprogram, findes ikke længere;
- reglen er håndhævet, ikke kun beskrevet: AST-reglen `a11y/web-link-policy-single-source` gør et
  utæmmet `<a>` rødt, og `e2e/web-link-policy.spec.ts` måler adfærden i browseren.

**Forbeholdet om `mailto:` er indarbejdet.** Jeg advarede om, at `target="_blank"` på en
`mailto:`-adresse kan efterlade en tom fane, og at reglen derfor burde gælde eksterne
**web**-adresser. Sådan er den skrevet: AST-reglen springer eksplicit `mailto:` over med
begrundelsen i koden, og kontaktadressen i bundlinjen står uændret uden `target`. Det samme gælder
loginskærmens adresse. Ingen efterprøvning i Chrome og Edge er dermed nødvendig – situationen kan
ikke opstå.

**Konsekvens for to andre fund.**

1. **BB-011:** når søskendesiderne åbner i ny fane, forsvinder halvdelen af risikoen – programmet
   bliver stående i sin egen fane, og browserens «forlad siden»-advarsel udløses ikke længere af et
   opslag. Tekstrettelsen er stadig nødvendig; den handler om at lukke fanen, ikke om at forlade den.
2. **BB-016:** `tabIndex={-1}` på `ExternalLink` gør beslutningen om, at eksterne links ikke er en
   del af tastaturrækkefølgen, til en **erklæret og håndhævet** regel i stedet for en følge af, at
   sidens Tab-sekvens tilfældigvis ikke optager `<a>`. Se noten under BB-016.

---

### BB-014 – Rul-til-toppen-knappen ligger oven på det sidste søskendelink

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-10-flydende-knapper-kan-dække-indhold`
- **Prioritet:** Mellem
- **Beslutning:** **Afgjort 2026-08-16** – accepteret risiko; efterprøves igen med zoom-løsningen
- **Sådan fremprovokeres det:**
  1. Sæt browservinduet til 1536 px bredde (en helt almindelig bredde på en 1080p-skærm i skala).
  2. Rul til bunden af Om-siden.
  3. Klik på den sidste del af teksten «minProcesrente.dk».
- **Det sker:** Den runde rul-til-toppen-knap ligger oven på linkets højre ende. Målt ved 1536×864:
  linket fylder x = 1347-1467, knappen x = 1448-1504 – de sidste 19 px af linket er dækket. Et klik
  dér rammer knappen, så siden ruller til toppen i stedet for at åbne siden. Ved 1600 px og bredere
  er der ingen overlapning; ved 1536 px og smallere er der.
- **Det er uhensigtsmæssigt fordi:** Brugeren klikker på et link og får en helt anden handling – og
  ikke bare «ingenting», men et spring op i toppen af siden, væk fra det han sad og læste. Han har
  ingen mulighed for at se, at knappen ligger over linket; den er halvgennemsigtig og ligner en del
  af baggrunden. Ved smallere vinduer dækker knappen mere af teksten.
- **Bedre ville være:** At bundlinjen holder fri af knappens hjørne – enten ved at knappen skjules,
  når bundlinjen er rullet frem, eller ved at bundlinjen får en højremargen, der svarer til knappens
  plads (knappen er 56 px bred og står 32 px fra kanten). Den første er at foretrække: står brugeren
  allerede i bunden af siden, er der ikke længere brug for at kunne rulle ned.
- **Andre steder det kan gælde:** Knappen er fastgjort til vinduets nederste højre hjørne på **alle**
  sider. Ethvert indhold, der når helt ud i det hjørne, kan blive dækket – fx de runde
  tilføj-knapper under tabeller og downloadknapper i bunden af en side.

**Brugerens afgørelse.** Knappen ligger kun delvist oven på det sidste link, og kun ved en meget smal
sidebredde. Det er acceptabelt.

**Agentens modpres – «meget smal» er den bredde, du selv udpeger som målet.** Overlapningen indtræder
ved 1536×864, og i afgørelsen af BB-015 lige nedenfor skriver du, at siden skal se rigtig ud netop
for «brugere, der benytter opløsningen 1920×1080 ved 125 % zoom (1536×864) og opefter». Det er
altså ikke en smallere skærm end den understøttede – det er præcis den understøttede.

Målingen ved 1536×864 forklarer, hvorfor det ikke kan blive bedre af sig selv:

- indholdssøjlen fylder x = 324-1524, altså helt ud til 12 px fra vinduets kant;
- knappen står fast 32 px fra kanten og fylder x = 1448-1504.

Knappen ligger dermed **inde i indholdssøjlen**, ikke ved siden af den – 20 px inde fra dens højre
kant. Ved designmålet er der ingen fri margen, den kan stå i. Det er også derfor, det kun er den
sidste af de fire søskendelinks, der rammes: den er den eneste, der når helt ud.

Det ændrer ikke, at konsekvensen er beskeden – 19 px af ét link. Men præmissen «kun ved en meget smal
sidebredde» holder ikke, og spørgsmålet bør derfor stilles igen på den rigtige præmis: **er det
acceptabelt, at knappen dækker en del af det sidste søskendelink ved den opløsning, siden er
designet til?** Den billigste rettelse er stadig at skjule knappen, når bundlinjen er rullet frem.

**Brugerens endelige afgørelse (2026-08-16, anden runde).** Modpresset er læst, og afgørelsen står
fast: 1536×864 er den **nederste** kant af det understøttede område og bruges kun af de få, der
kører 1080p med 125 % zoom. Langt de fleste sidder bredere, hvor overlapningen ikke findes. Dertil
kommer, at den planlagte zoom-løsning vil ændre geometrien og dermed selve præmissen for fundet.
Risikoen accepteres, og der rettes ikke nu.

**Agentens efterprøvning – afgørelsen er indbyrdes konsistent.** Der er ikke modstrid med BB-015, som
jeg først læste det: BB-015 fastlægger, hvor grænsen går, denne afgørelse fastlægger, hvor mange der
står præcis på den. Begge dele kan være sande på én gang, og fundets konsekvens er lille – 19 px af
ét link ud af fire, på den ene flade der har en bundlinje.

**Til den kommende zoom-løsning.** Denne overlapning er en brugbar prøve på, om løsningen virker, og
den koster ingenting at køre: **rul til bunden af Om-siden ved 1536×864 og kontrollér, at hele
«minProcesrente.dk» kan klikkes.** Rammer klikket stadig rul-til-toppen-knappen, har skaleringen
ikke frigjort margen i højre side. Prøven er noteret her, fordi den ellers går tabt sammen med
fundet.

---

### BB-015 – På en 1366-skærm er sætningerne skåret over i højre side

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-09-fast-indholdsbredde`
- **Prioritet:** Mellem
- **Beslutning:** **Afgjort 2026-08-16** – 1366 px er ikke en understøttet bredde
- **Sådan fremprovokeres det:** Åbn Om på en skærm med 1366 px bredde (den næsthyppigste
  bærbar-opløsning efter 1920) med sidemenuen foldet ud.
- **Det sker:** Teksten er skåret over ude i højre side midt i ordene – «men fe…», «nye
  funktionaliteter u…» – og de to sidste søskendelinks er helt ude af billedet. Indholdsboksene er
  1200 px brede uanset vinduets bredde (`--content-box-max-width` bruges som `width`, ikke som
  `max-width`), så der står 158 px indhold uden for det synlige område, som skal rulles frem
  sidelæns.
- **Det er uhensigtsmæssigt fordi:** Det er programmets forside, den første side en ny bruger møder,
  og den består udelukkende af prosa. Prosa er dét indhold, der uden videre kunne have ombrudt.
  At skulle rulle vandret frem og tilbage for at læse en sætning er den slags, brugeren tolker som
  «programmet er i stykker» – ikke som «mit vindue er for smalt».
- **Bedre ville være:** At tekstboksene må blive smallere, når vinduet er det (`max-width` i stedet
  for `width`), så sætningerne ombryder. Det ændrer intet på brede skærme.
- **Andre steder det kan gælde:** Alle sider – den faste bredde er global. Beslutningen er dog ikke
  den samme overalt: en bred indtastningstabel kan have brug for pladsen og kan legitimt kræve
  vandret rul, mens ren tekst ikke kan. **Bemærk bindingen:** `AGENTS.md` §Desktop-only gate
  forbyder viewport-responsiv styling uden for en pinnet filliste. Bundlinjen står allerede på den
  liste; en ændring af tekstbreddens regel vil kræve, at listen udvides, og det er en beslutning
  brugeren skal træffe, ikke en fejlrettelse.

**Brugerens oprindelige afgørelse – designmålet er 1536×864 og opefter.** Skærme på 1366 px er hovedsageligt
ældre budget-bærbare. Mineo henvender sig til brugere, der arbejder professionelt med området, og de
må formodes at have nyere maskiner. Designvalget er derfor, at siden skal se rigtig ud for brugere med
1920×1080 ved 125 % zoom (= 1536×864 CSS-pixels) og opefter – ikke for lavere opløsninger.
Denne afgørelse blev efterfølgende udvidet af den implementerede arbejdsfladeskalering nedenfor.

**Dengang betinget åbning.** Der var et udestående punkt om en automatisk skalerende løsning netop til
1536×864 på bærbare. Kan den uden besvær udvides til også at rumme 1366×768, er det et acceptabelt
kompromis. Spørgsmålet var altså bundet til den løsning – ikke til en selvstændig rettelse her.

**Agentens efterprøvning – designmålet er opfyldt, men uden margen.** Ved 1536×864 er der ingen
afskæring: indholdet fylder nøjagtig det, der er plads til, med 12 px til overs (målt: den rullende
beholder har clientWidth 1286 og scrollWidth 1286 – intet overskud). Grænsen er altså ikke sat med
luft, den er ramt på stregen. To ting følger af det, som er værd at have skrevet ned:

1. **Den kommende skaleringsløsning har ikke 1366 px «gratis med».** Der mangler 158 px ved 1366,
   og indholdets bredde er i dag et fast tal, ikke en ombrydning. Om udvidelsen er besværlig, kan
   altså ikke afgøres på forhånd – men den er ikke en biting.
2. **Ved designmålet er der ikke plads ved siden af indholdet.** Det er den samme måling, der bærer
   modpresset i BB-014: den flydende knap kan ikke stå fri af indholdssøjlen ved 1536, fordi søjlen
   går helt ud til kanten.

**Efterfølgende implementering (2026-08-17).** Den betingede åbning er indfriet og dokumenteret i
[app-shell-kontrakten](../../../src/contracts/app-shell-contract.md): Mineo dækker mindst
1244×620 CSS-px ved 100 % browserzoom. Det er ikke en garanti ud fra en fysisk 1366×768-skærm; ved
for eksempel 125 % systemskalering er den faktiske CSS-bredde lavere. Kun arbejdsfladen skaleres,
aldrig shellen, og under grænsen er vandret scroll den bevidste, nåbare fallback frem for beskæring
eller yderligere nedskalering.

---

### BB-016 – Ingen af sidens fem links kan nås med tastaturet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-08-links-er-ikke-med-i-tastaturrækkefølgen`
- **Prioritet:** Mellem
- **Beslutning:** **Afgjort 2026-08-16** – bevidst designvalg; nu tillige håndhævet strukturelt
- **Sådan fremprovokeres det:**
  1. Klik på «Download hjælpeprogram» og tryk derefter Tab igen og igen.
- **Det sker:** Fokus kører rundt i en fast ring på tre: «Download hjælpeprogram» → startside-kontakten
  → «MIT-licensen» → forfra. Målt over flere omgange ved almindelig tastehastighed. Hverken
  GitHub-linket, kontaktadressen eller de tre søskendesider får nogensinde fokus. Sidens
  tastaturrækkefølge optager kun felter og de knapper, der udtrykkeligt er markeret som
  fokuserbare – links indgår slet ikke.
- **Det er uhensigtsmæssigt fordi:** Fem af sidens otte betjenbare ting kan kun nås med mus. På en
  side, der næsten kun består af links, er det halvdelen af indholdet. En bruger, der arbejder på
  tastaturet – og programmets øvrige flader inviterer netop til det – kan ikke komme til
  kontaktadressen, som er den eneste vej til at melde en fejl.
- **Bedre ville være:** At links indgår i sidens tastaturrækkefølge på lige fod med knapperne, så Tab
  også når dem. Mekanismen findes allerede: de to knapper på siden er med, fordi de er markeret som
  fokuserbare.
- **Andre steder det kan gælde:** Satser-siden har retsinfo-henvisninger som links
  (`satserRows.tsx`), MinProcesrente har sin titel som link, og bundlinjen går igen begge steder.
  Uverificeret, men samme mekanisme: intet `<a>` i programmet kan nås med Tab.

**Brugerens afgørelse.** Det er en bevidst designbeslutning. Bundlinjen med links til søskendesiderne
skal ikke være en del af tastaturrækkefølgen, og GitHub-linket er undtaget specifikt og
undtagelsesvis. Ingen kodeændring.

**Agentens efterprøvning – afgørelsen dækker hele bundlinjen, også kontaktadressen.** Adressen
`bel@fho.dk` sidder i samme boks som de tre søskendelinks og er dermed omfattet. Det betyder, at den
eneste vej til at kontakte udvikleren fra denne side kun kan nås med mus. Det siger jeg højt, fordi
konsekvensen ikke fremgår af afgørelsens ordlyd – ikke for at genåbne den. Fejl kan i øvrigt meldes
ad en anden vej: fejlrapport-knappen på indholdsboksene, som er en almindelig knap.

**Én ting, afgørelsen ikke kunne afgøre – og som siden er blevet afgjort.** Årsagen til, at ingen af
de fem links kunne nås, var ikke fem enkeltbeslutninger, men én mekanisme: programmet ejer selv Tab,
og den ring, tasten flytter rundt i, samles af en selector, der optager felter og markerede knapper –
men **intet `<a>` overhovedet**. Fraværet var altså en følge, ikke et valg, og det gjaldt også
Satsers retsinfo-henvisninger, hvor spørgsmålet er reelt.

Det er lukket af den strukturændring, brugeren gennemførte under BB-013: `ExternalLink` sætter nu
`tabIndex={-1}` fast, og AST-reglen `a11y/web-link-policy-single-source` håndhæver det. Beslutningen
er dermed **erklæret på linket selv** frem for at være et biprodukt af sidens Tab-mekanik – og den
gælder nu ensartet for eksterne links overalt, også på Satser. Mønsteret M-08 er dermed afgjort i
sin helhed for eksterne links; tilbage står kun spørgsmålet om et **internt** link, der bærer noget,
brugeren skal kunne handle på (fx et «gå til feltet»-link i en fejlboks). Det efterprøves, hvor et
sådant findes.

---

### BB-017 – Programmet siger ikke, om hjælpeprogrammet allerede er installeret

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **Afgjort 2026-08-16** – acceptabelt kompromis
- **Sådan fremprovokeres det:** Åbn Om og se på «Teknisk».
- **Det sker:** Afsnittet fortæller, at man **skal** installere et hjælpeprogram for at kunne
  dobbeltklikke på .eo-filer, og tilbyder «Download hjælpeprogram». Men siden fortæller intet om, om
  kravet allerede er opfyldt. Brugeren kan kun finde ud af det ved at klikke: er programmet
  installeret, svarer en dialog «Hjælpeprogrammet er allerede installeret. Du behøver ikke hente det
  igen.» Er det ikke, sker der enten en installation eller – hvis browseren ikke har tilbudt
  installationen – vises «Installationsdialogen kunne ikke åbnes. Brug installationsikonet i
  adresselinjen eller browserens menu for at installere hjælpeprogrammet.» Det sidste er præcis dét,
  afsnittets egen indledning allerede har sagt.
- **Det er uhensigtsmæssigt fordi:** Programmet **ved** besked (det slår tilstanden op, når der
  klikkes) og fortæller det ikke. Brugeren skal derfor klikke på en handling for at få et svar på et
  spørgsmål – «er det her klaret?» – og risikerer at lande i en dialog, der hverken siger, hvad der
  gik galt, eller giver ham noget nyt at gøre. En bruger, der har installeret hjælpeprogrammet for
  tre måneder siden, har ingen måde at se det på.
- **Bedre ville være:** At tilstanden står ved handlingen – fx «Hjælpeprogrammet er installeret på
  denne computer» / «Hjælpeprogrammet er ikke installeret på denne computer» – aflæst når siden
  åbnes og igen, når den får fokus, så en installation foretaget i mellemtiden slår igennem. Er
  programmet installeret, kan knappen samtidig skifte til «Åbn hjælpeprogram». Og hvor browseren
  ikke kan svare, bør beskeden sige det som en tilstand, ikke som en fejl: «Browseren kan ikke
  oplyse, om hjælpeprogrammet er installeret.»
- **Andre steder det kan gælde:** Ingen – men det generelle spørgsmål (viser programmet en
  forudsætning, det selv kan aflæse?) hører til på Indstillinger, hvor standardmappen har samme
  karakter.

**Måleforbehold.** Den dialog, jeg fik at se, var «Installationsdialogen kunne ikke åbnes», fordi den
automatiserede browser ikke tilbyder en installationsprompt. Hvad en almindelig Chrome-bruger møder,
når browseren HAR tilbudt prompten, er ikke afprøvet – noteret som dækningshul. Det ændrer ikke
fundet: uanset udfaldet fortæller siden ikke tilstanden, før der klikkes.

**Brugerens afgørelse.** Det er et acceptabelt kompromis, at brugeren – som nu – får en popup, hvis
hjælpeprogrammet allerede er installeret, og han klikker på linket. Tilstanden skal altså ikke vises
på siden på forhånd. Ingen kodeændring.

**Agentens efterprøvning.** Afgørelsen bevarer den nuværende tilstand fuldt ud, og den er
sammenhængende med, at afsnittet er en engangshandling: har brugeren først installeret
hjælpeprogrammet, har han ingen anledning til at komme tilbage til afsnittet.

**Restspørgsmål – kun én ordlyd.** Fundet dækkede to situationer, og afgørelsen besvarer den ene
(«allerede installeret»). Tilbage står den situation, hvor browseren ikke har tilbudt en
installation: der vises «**Installationsdialogen kunne ikke åbnes.** Brug installationsikonet i
adresselinjen eller browserens menu for at installere hjælpeprogrammet.» Overskriften lyder som en
fejl i programmet, selv om der oftest ikke er sket noget forkert – browseren har bare ikke tilbudt
installationen (endnu). Et forslag, der kan tages med BB-018's tekstrettelse og ikke koster andet:
«**Installationen skal startes fra browseren.** Brug installationsikonet yderst til højre i
adresselinjen eller browserens menu.» Sig til, hvis den skal med – ellers falder den bort sammen med
resten af fundet.

---

### BB-018 – Tre ord for den samme handling: download, hente, installere

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Accepteret af brugeren 2026-08-16** – skal rettes
- **Sådan fremprovokeres det:** Læs «Teknisk» fra ende til anden og klik derefter på knappen.
- **Det sker:** Afsnittet siger «skal du **installere** et hjælpeprogram», «Det kan **hentes** via
  **linket** nedenfor», knappen hedder «**Download** hjælpeprogram», den efterfølgende linje siger
  «kun kan **installeres**», og dialogen siger «Du behøver ikke **hente** det igen». Selve knappen er
  desuden en knap, ikke et link, selv om teksten kalder den et link – og handlingen henter ingen fil;
  den beder browseren om at installere siden som program.
- **Det er uhensigtsmæssigt fordi:** Brugeren skal selv regne ud, at download, hentning og
  installation er den samme ene handling – og «Download» skaber en forventning om en fil i
  overførselsmappen, som aldrig kommer. Når intet sker (fordi browseren allerede har installeret det,
  eller ikke vil), har han ikke engang et entydigt navn på det, der ikke skete.
- **Bedre ville være:** Ét ord hele vejen igennem. «Installér» er det rigtige, fordi det er dét, der
  sker: knappen «Installér hjælpeprogram», teksten «Det kan installeres med knappen nedenfor eller
  ved at klikke på installationsikonet …», og dialogerne tilsvarende.
- **Andre steder det kan gælde:** Ingen – hjælpeprogrammet omtales kun her.

**Brugerens afgørelse – accepteret, skal rettes.** Der skal bruges ét ord, «installer»/«installere».
Gentagelsen af det samme ord må dog ikke gøre teksten kluntet, og brugeren har derfor selv leveret
brødteksten:

> «For at kunne dobbeltklikke på lokale .eo-filer og åbne dem direkte i Mineo, skal du installere et
> hjælpeprogram. Det sker via linket nedenfor eller ved at klikke på installationsikonet yderst til
> højre i browserens adresselinje (Google Chrome ▣ / Microsoft Edge ▣).»

**Agentens bemærkning.** Formuleringen løser netop gentagelsen: «Det sker via linket nedenfor» bærer
handlingen videre uden at nævne den igen. Ordet «linket» beholdes bevidst, selv om kontrollen teknisk
er en knap – den er tegnet som et link, og brugeren skal genkende det, han ser, ikke det, koden
kalder det. Fundets sidebemærkning om knap-versus-link bortfalder dermed.

**Implementering**

Alle strenge ligger i [Mineo.tsx](../../../src/components/pages/Mineo.tsx); ingen af dem er delt med
andre flader, så rettelsen er ren tekst uden mekanik.

1. **Brødteksten** i «Teknisk» erstattes med brugerens formulering ovenfor. Kun første punktum
   ændres reelt; ikonerne og resten af sætningen står uændret (BB-019 er afvist).
2. **Knappen** «Download hjælpeprogram» → «Installér hjælpeprogram» (bydeform med accent, jf.
   afgørelsen om stavemåde nedenfor).
3. **Dialogen «Hjælpeprogrammet er allerede åbent»:** «Du bruger det lige nu. Du behøver ikke
   ~~hente~~ **installere** det igen.»
4. **Dialogen «Hjælpeprogrammet er allerede installeret»:** «Du behøver ikke ~~hente~~ **installere**
   det igen. Vil du åbne det nu? …» Resten af dialogen er uændret.
5. **Uændret:** «Bemærk, at hjælpeprogrammet kun kan installeres, hvis du benytter Google Chrome
   eller Microsoft Edge» bruger allerede det rigtige ord.
6. **Værn.** Ingen ny mekanik og dermed intet nyt værn. De eksisterende dialogtekst-tests i
   `src/__tests__/components/pages/` skal følge med ordlyden, så en senere tilbagerulning bliver rød.
7. **Kontrakt.** Ingen. Teksterne er ikke kontraktbundne.

**Spørgsmål om stavemåden.** Programmet skriver ellers bydeform med accent – «kontrollér altid dine
beregninger grundigt» står på den samme side.

**Brugerens afgørelse (2026-08-16, anden runde).** Husstilen følges; stavemåderne skal være
konsekvente. Knappen hedder derfor **«Installér hjælpeprogram»** med accent.

**Agentens afgrænsning af reglen.** Accenten hører kun på **bydeformen**. Brugerens egen brødtekst
skriver «skal du installere et hjælpeprogram» og dialogerne «Du behøver ikke installere det igen» –
begge er infinitiv og skal **ikke** have accent. Reglen rammer altså præcis ét sted på fladen: selve
knappen. Det er også kun -ere-verberne, mønsteret gælder; programmets øvrige knapper («Gem»,
«Hent», «Åbn program», «Luk») er ikke omfattet og ændres ikke.

---

### BB-019 – Sætningen om browserne ender i to ikoner uden ord

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Afvist af brugeren 2026-08-16**
- **Sådan fremprovokeres det:** Læs første sætning i «Teknisk» til ende.
- **Det sker:** Sætningen slutter «… ved at klikke på installationsikonet yderst til højre i
  browserens adresselinje (Google Chrome ▣ / Microsoft Edge ▣).» De to tegn er små billeder uden
  tekst. Aflæses siden uden billederne – af en skærmlæser eller når ikonerne ikke tegnes – står der
  «(Google Chrome  / Microsoft Edge )» med to tomme pladser.
- **Det er uhensigtsmæssigt fordi:** Ikonerne bærer hele pointen: de viser, **hvad** brugeren skal
  lede efter i adresselinjen. Uden dem er parentesen indholdsløs, og med dem er de så små, at de
  først giver mening, når man allerede har set det rigtige ikon.
- **Bedre ville være:** At ikonerne får et tekstalternativ («installationsikonet i Google Chrome»
  henholdsvis «… i Microsoft Edge»), så sætningen også kan læses uden dem.
- **Andre steder det kan gælde:** Andre steder, hvor et ikon står inde i en sætning frem for ved
  siden af en etiket. Ikke systematisk eftersøgt.

**Brugerens afgørelse.** Adfærden er acceptabel. Ikonerne står der udelukkende, for at brugeren kan
se, hvad han skal kigge efter i adresselinjen i henholdsvis Chrome og Edge. En beskrivende tekst
ville være overflødig. Ingen kodeændring.

**Agentens efterprøvning.** Afgørelsen hviler på en skelnen, fundet ikke gjorde: ikonerne er en
**genkendelsesnøgle**, ikke en oplysning. Sætningen siger allerede i ord, hvad brugeren skal gøre og
hvor – «klikke på installationsikonet yderst til højre i browserens adresselinje» – og ikonerne
tilføjer kun, hvordan det ser ud. Falder de bort, mister sætningen ikke sin mening, kun sin
genvej. Præmissen i fundet («ikonerne bærer hele pointen») var altså forkert, og forslaget bortfalder
med den.

---

### BB-020 – Startside-valget står under «Teknisk» og findes ikke på Indstillinger

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Afvist af brugeren 2026-08-16**
- **Sådan fremprovokeres det:**
  1. Åbn Indstillinger og led efter, hvor programmet skal starte.
  2. Åbn derefter Om og se nederst i boksen «Teknisk».
- **Det sker:** Valget «Gør stamdata-siden til startside fremover» findes kun her, som sidste linje i
  et afsnit, der ellers handler om at installere .eo-filhjælperen og om, at det kræver Chrome eller
  Edge. Der er ingen overskrift eller adskillelse imellem. På Indstillinger – som har afsnittene
  System, Standardværdier, Beregningsteknisk og Kontrol og rummer alle programmets øvrige valg –
  står det ikke.
- **Det er uhensigtsmæssigt fordi:** Brugeren leder efter en indstilling dér, hvor indstillinger er,
  og finder den ikke. Og står han på Om, hører linjen ikke sammen med det, den står under: den
  handler hverken om hjælpeprogrammet eller om browsere. Placeringen er bevidst valgt (så nye
  brugere møder valget dér, hvor de lander), og det argument holder – men det taler for, at valget
  skal stå tydeligt for sig selv, ikke for at det skal gemmes i et teknisk afsnit.
- **Bedre ville være:** At beholde valget her, men give det sin egen linje uden for «Teknisk» – fx en
  kort boks «Start» nederst på siden – **og** at det samme valg står på Indstillinger under «System».
  Det er én indstilling vist to steder, ikke to indstillinger; formen findes allerede i programmet,
  hvor samme værdi kan vises flere steder.
- **Andre steder det kan gælde:** Enhver indstilling, der bor uden for Indstillinger. Ikke
  systematisk eftersøgt; efterprøves når Indstillinger gennemgås som næste flade.

**Brugerens afgørelse – en bevidst undtagelse med en begrundelse, gennemgangen ikke kendte.**
Om-siden er standard-startside af **juridiske** grunde: licensvilkårene fremgår af den, og
fremvisningen er garantien for, at brugeren har set dem. Brugeren går ind i programmet mange gange
uden at komme forbi Indstillinger, og han vil meget hurtigt ønske at starte på Stamdata i stedet.
Fravalget skal derfor være let at få øje på og let at nå netop dér, hvor han står – ikke gemt bag en
side, han ikke besøger. Valget bliver stående, hvor det er. Ingen kodeændring.

**Agentens efterprøvning.** Begrundelsen ændrer bedømmelsen, ikke bare udfaldet. Fundet læste
kontakten som en indstilling, der var havnet et forkert sted; med den juridiske begrundelse er den i
stedet **modstykket til selve fremvisningen** – den knap, der lukker en side, brugeren er blevet vist
uden at bede om det. Så hører den hjemme på siden, den lukker. Forslaget om også at vise valget på
Indstillinger bortfalder med samme argument: står det to steder, er det ikke længere entydigt, hvor
det hører til, og Indstillinger-kopien ville kun blive fundet af den bruger, der ikke havde brug for
den.

Placeringen **inde i** boksen «Teknisk» er stadig en tilfældighed frem for et valg – men det er en
ren layout-detalje uden konsekvens, og efter afgørelsen om, at kontakten skal være let at få øje på,
er den heller ikke skjult: den er sidste linje i den boks, brugeren møder midt på siden. Jeg
registrerer den ikke som et selvstændigt fund.

---

### BB-021 – Programmet hedder to ting på den samme skærm

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Afvist af brugeren 2026-08-16**
- **Sådan fremprovokeres det:** Se på Om-siden fra top til bund.
- **Det sker:** Overskriften siger «Mineo», brødteksten siger «Mineo er et specialiseret
  regneprogram», og bundlinjen fremhæver den aktuelle side som «minEO.dk». Loginskærmen, brugeren
  lige har passeret, hed også «minEO.dk». Sidemenuens punkt hedder «Om».
- **Det er uhensigtsmæssigt fordi:** Programmet præsenterer sig med to navne på én skærm. For en
  bruger, der skal fortælle en kollega, hvad han bruger, eller skrive det i et sagsnotat, er der ikke
  ét rigtigt svar. Det er en lille ting, men det er netop på præsentationssiden, navnet skal være
  entydigt.
- **Bedre ville være:** At vælge ét navn til brugerens øjne og bruge det begge steder. Er
  «minEO.dk» det, sitet hedder – og det er det, både login og bundlinjen siger – bør overskriften
  også være «minEO.dk».
- **Andre steder det kan gælde:** Loginskærmen, den blokerende side for mobil/tablet (som bruger
  «minEO.dk» i overskriften og «Mineo» i brødteksten), browserfanens titel («Mineo
  Erstatningsberegner») og dokumenternes brevhoved.

**Brugerens afgørelse.** Bevidst designvalg; skal ikke ændres. Målgruppen ved, at EO er
fagbetegnelsen for erstatningsopgørelse, og at programmets fulde navn dermed er «min
erstatningsopgørelse». I løbende tekst er «Mineo» det pænere og mere naturlige udtryk, mens
«minEO.dk» er det rigtige dér, hvor programmet står side om side med søskendesiderne, der alle hedder
min***.dk – i bundlinjen og på loginskærmen. Ingen kodeændring.

**Agentens efterprøvning.** Afgørelsen opløser fundets præmis: det er ikke to navne, men **ét navn i
to sammenhænge** – skrevet som ord, hvor det er en tekst, og som domæne, hvor det står blandt
domæner. Bundlinjens skrivemåde er dermed ikke en afvigelse fra overskriften, men netop det, der får
rækken af søskendesider til at hænge sammen. Reglen er værd at have skrevet ned, fordi den ligner en
inkonsistens for enhver, der ser den udefra.

---

### BB-022 – Forsiden fortæller ikke, hvor man begynder

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Afvist af brugeren 2026-08-16**
- **Sådan fremprovokeres det:** Log ind som ny bruger uden at ændre noget. Programmet lander på Om.
- **Det sker:** Brugeren møder fem tekstbokse og en bundlinje. Sidens egne betjenbare ting er: hent
  et hjælpeprogram, skift startside, læs licensen – og fem links, hvoraf de fire fører **ud** af
  programmet. Intet på siden peger på, hvor en sag begynder.
- **Det er uhensigtsmæssigt fordi:** Standard-startsiden er den eneste side, hvor programmet kan
  tage imod. Som den står nu, er alt det, den tilbyder, enten forberedelse eller udgange. Sidemenuen
  har ganske vist «Stamdata» øverst, så vejen ind er synlig – men den er ikke **udpeget**, og en
  bruger, der ikke kender programmet, læser fem afsnit uden at have fået at vide, hvad han skal gøre.
- **Bedre ville være:** En enkelt linje i «Programmet», der siger, hvor man starter, fx: «Begynd på
  **Stamdata** i menuen til venstre – de oplysninger, du skriver der, bruges af de øvrige
  beregninger.» Det er en sætning, ikke en ny funktion.
- **Andre steder det kan gælde:** Ingen.

**Brugerens afgørelse.** Programmet er målrettet professionelle brugere og kan lave mange forskellige
typer beregninger. Brugeren går selv til den side, der svarer til den beregning, han skal lave. Der
skal ikke udpeges ét sted at begynde. Ingen kodeændring.

**Agentens efterprøvning – fundet havde en forkert forudsætning, og BB-020 afslører hvilken.** Jeg
læste Om som en forside, der skulle tage imod. Efter din begrundelse i BB-020 er den ikke det: siden
vises af juridiske grunde, og dens opgave er at fremvise licensvilkårene, ikke at lede nogen i gang.
Dertil kommer din pointe her – at der ikke findes ét rigtigt startsted, når programmet kan syv
forskellige beregninger. En anvisning som «Begynd på Stamdata» ville være direkte forkert for en
bruger, der kun skal lave en renteberegning, og den ville pege det samme sted hen hver gang uanset
opgaven. Forslaget bortfalder.

---

## Overvejet uden fund

- **Grænse-eftersynet (B0).** Fladen har ingen indtastningsfelter. Den eneste kontrol med en værdi er
  startside-kontakten, som er ja/nej og ikke kan have en uheldig grænse. Intet at efterprøve.
- **Tomhed (B6a).** Ingen rækker, ingen tabeller, intet begreb om «udfyldt». Ikke relevant her.
- **De to vinduers lukkeveje.** Både licensvinduet og installationsdialogen lukkes korrekt med
  Escape, med klik uden for vinduet og med browserens tilbage-knap – og fokus vender hver gang
  tilbage til netop den knap, der åbnede vinduet (målt for begge veje i begge vinduer). Tilbage-knappen
  lukkede vinduet uden at forlade siden.
- **Tastaturet bliver i licensvinduet.** Seks Tab i træk blev alle inde i vinduet.
- **Aktivering med tastatur.** Både Enter og mellemrum aktiverer «MIT-licensen» og «Download
  hjælpeprogram». Målt for begge knapper og begge taster.
- **Tab-rækkefølgen er stabil ved menneskelig hastighed.** Ved 30, 60, 120 og 250 ms mellem tryk er
  ringen den samme hver gang. Kun ved maskinhastighed (under ét skærmbillede mellem tryk) kunne
  fokus lande på siden selv og starte forfra – knappernes fokusskift sker først i næste billede. Det
  kan ikke nås med hånden og er derfor ikke registreret som fund.
- **Startside-kontakten virker og slår igennem.** Klik og mellemrum skifter den, værdien gemmes med
  det samme, og programmet lander derefter på Stamdata (målt: `/` → `/stamdata`). En kontakt af den
  slags skal ikke kvittere med en besked.
- **Fortryd (Ctrl+Z) på Om.** Fortryder den seneste ændring i sagen og flytter brugeren til den side,
  ændringen skete på. Det er det rigtige: fortryd skal vise, hvad den fortrød – også når man står på
  en side uden sagsdata.
- **Versionslinjen.** «Aktuel version: 2026.08.1350.190f945» er kryptisk, men fejlrapporter bærer
  selv versionen med, så brugeren skal ikke aflæse den. Informationslinje, ikke en arbejdsopgave.
- **Licensteksten.** Vinduet viser den originale engelske MIT-tekst med copyright 2026 Bjørn Elling.
  Det er den rigtige form for en licens – teksten er retligt bindende i sin egen ordlyd – og siden
  giver i forvejen de tre danske hovedpunkter uden for vinduet.
- **Dobbeltklik på «Installér hjælpeprogram».** Der kan kun være ét installationsforsøg i gang ad
  gangen; der kom ingen dobbelt dialog.
- **Bundlinjens markering af den aktuelle side.** «minEO.dk» vises som aktiv og er ikke et link – man
  kan ikke klikke sig hen, hvor man allerede er.
- **Kontaktadressen.** Bundlinjens mailadresse åbner et almindeligt mailudkast uden emnefelt, mens
  loginskærmens samme adresse har «Adgang til mineo.dk» som emne. Forskellen er rimelig: de to
  henvendelser handler om hver sit.
- **Konsolsignaler.** 73 konsolbeskeder under hele gennemgangen, 0 fejl og 0 advarsler.

## Dækningshuller

- Kun Chrome (headless). Edge, Firefox og WebKit er ikke kørt. BB-017 er den eneste, hvor det
  plausibelt kan gøre en forskel: hvilken af de fire dialogtekster en bruger møder, afhænger af
  browseren.
- **Installationens lykkelige udfald er ikke set.** Den automatiserede browser tilbyder ikke en
  installationsprompt, så kun fejlteksten kunne fremprovokeres. Hverken «allerede installeret»,
  «kører inde i hjælpeprogrammet» eller en gennemført installation er afprøvet i praksis.
- **Søskendesiderne er ikke åbnet i virkeligheden.** Det er ikke efterprøvet, at de fire adresser
  svarer. Ved efterprøvningen af BB-013 blev de tre adresser aflyttet lokalt, så klikket kunne måles
  uden at gå på nettet; det viser, hvor fanen lander, ikke hvad der er i den anden ende.
- **BB-013's rettelse er ikke efterprøvet af Brugerblik.** Linkreglen blev gennemført af brugeren
  efter gennemgangen, og jeg har læst den i koden, ikke målt den i browseren. Den bærer sin egen
  dækning med (`e2e/web-link-policy.spec.ts` og AST-reglen), så en efterprøvning her ville være en
  gentagelse – men det skal stå, at fladens målte tilstand er den **før** rettelsen.
- **Opdateringstjekket er ikke målt i browseren.** BB-012's påstand om, at programmet henter sin egen
  filfortegnelse under drift, hviler på koden (`serviceWorkerBootstrap.ts`); devserverens trafik kan
  ikke skelnes fra produktionens.
- **Browserens sessionsgendannelse.** Om en sag kommer tilbage, hvis browseren lukkes og genåbnes med
  «gendan faner», er ikke afprøvet. Det påvirker kun, hvor præcis BB-011's nye tekst skal formuleres.
- **Vandret rullebjælke ved 1366 px.** Indholdet kan rulles 158 px sidelæns, men om browseren tegner
  en synlig rullebjælke afhænger af platformens indstilling; den automatiserede browser tegnede ingen.

## Gennemførte rettelser

Fladen efterlod **to tekstrettelser**. Begge er ren tekst i
[Mineo.tsx](../../../src/components/pages/Mineo.tsx): ingen mekanik, ingen kontraktændring, intet nyt
værn. De kan gennemføres i én omgang.

| Rettelse | Hvad | Fra fund |
|---|---|---|
| «Persondata»-boksen | Sætning 2 og 3 erstattet med den aftalte ordlyd (står ordret under BB-012) | BB-011 + BB-012 |
| «Teknisk»-boksen | Brødtekst, knaplabel «Installér hjælpeprogram» og to dialogtekster bruger ét ord for handlingen | BB-018 |

**Gennemført undervejs:** BB-013's generelle linkregel (`ExternalLink`/`InternalLink`, AST-værn og
e2e-måling) er allerede i arbejdstræet – den er brugerens eget arbejde og ligger uden for denne
rettelsesliste.

## Åbne spørgsmål

**Ingen.** Alle tolv fund er afgjort, og de to oprindelige spørgsmål er besvaret undervejs:
arbejdsfladen dækker 1244×620 CSS-px ved 100 % browserzoom (BB-015), og ordlyden i «Persondata» er
aftalt ordret under BB-011 og BB-012.

Ét forslag er fortsat udeladt, sådan som det blev stillet: **BB-017's
alternative overskrift** til fejldialogen («Installationen skal startes fra browseren» i stedet for
«Installationsdialogen kunne ikke åbnes»). Den falder bort efter den regel, jeg selv satte, da den
blev foreslået; BB-018's gennemførte rettelse ændrer derfor ikke denne overskrift.

Fladen er dermed færdigbehandlet.
