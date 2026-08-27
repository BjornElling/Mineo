# Brugerblik – Global shell

- Rute/placering: hele programmet – sidemenu, login-gate, `Gem`/`Hent`/`Slet alt`, beskeder,
  bekræftelsesdialoger, undo/redo og 404-ruten
- Gennemgået: 2026-08-19 · commit `97f616b6`
- **Afgjort: 2026-08-19.** Alle tretten fund er besvaret – **seks accepteret og gennemført** (BB-049,
  BB-050, BB-053, BB-055, BB-056, BB-057), **seks afvist** (BB-051, BB-052, BB-058, BB-060, BB-061 og
  BB-059's mitigering) og **ét delvist gennemført efter modpres** (BB-054: den dobbelte adfærd afvist,
  spærringen af tasten fjernet). Udfaldet pr. fund står ved hvert fund nedenfor; de gennemførte er
  opsummeret i «Gennemført i kode» til sidst.
- Afprøvet i: Chrome (Chromium 1536×864), headless. Filvælgeren kan ikke betjenes headless –
  se Dækningshuller.

## Fladen kort

Shellen er det, brugeren aldrig forlader: sidemenuen med de otte sagssider og de to systemsider,
de tre filhandlinger `Gem`, `Hent` og `Slet alt`, beskedboksen øverst til højre, de tre
bekræftelsesdialoger og de globale genveje Ctrl+S og Ctrl+Z/Ctrl+Y. Foran det hele står login-gaten.

Shellen er også det eneste sted, sagen som HELHED behandles: den er den eneste vej til at gemme,
hente og slette en sag, og den ejer beslutningen om, hvornår en åben felteditor skal afsluttes.
Alt, hvad brugeren indtaster på de øvrige elleve flader, kan kun overleve, hvis shellen gør sit
arbejde – og kan kun gå tabt, hvis den ikke gør.

Sagen lever i browserfanens sessionStorage. To faner er derfor to selvstændige sager, og det er den
eneste måde at have to sager åbne på. Login-flaget og filhåndtaget til direkte `Gem` ligger derimod
i localStorage og IndexedDB, som er FÆLLES for alle faner. Netop den forskel er kilden til BB-049.

## Fund

### BB-049 – `Gem` kan skrive den ene sag ind i den anden sags fil, når Mineo er åben i to faner

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-17--én-oplysning-delt-over-to-lagerscoper`
- **Prioritet:** Kritisk
- **Beslutning:** **Accepteret – gennemført 2026-08-19** (udvikleren bad om, at løsningsmodellerne blev
  undersøgt nøje først; se «Gennemført» nedenfor, hvor det oprindelige forslag blev erstattet af en
  enklere løsning)
- **Sådan fremprovokeres det:**
  1. Åbn Mineo i fane A. Hent eller gem sagen som `Hansen 12-03-2024.eo`.
  2. Åbn Mineo i en ny fane B i samme browser (den eneste måde at have to sager åbne på).
     Hent eller gem dér sagen `Jensen 04-11-2023.eo`.
  3. Gå tilbage til fane A. Ret noget, der IKKE er Skadelidtes navn, Skadestype eller Skadedato –
     fx et beløb, en periode eller journalnummeret.
  4. Tryk `Gem` i fane A.
- **Det sker:** Fane A skriver sag Hansen ind i filen `Jensen 04-11-2023.eo` – uden filvælger, uden
  advarsel, uden at nævne et filnavn. Kvitteringen er ordet «Gemt». Sag Jensen er dermed væk fra
  disken, og `Hansen 12-03-2024.eo` står stadig med den gamle version.
- **Det er uhensigtsmæssigt fordi:** Det er den værste af alle udfald efter fladens egen
  prioritering: noget, brugeren har skrevet, forsvinder uden hans handling, og programmet melder
  succes. Han opdager det først, når han næste gang åbner Jensen-filen og finder Hansen i den. Til
  den tid er der ingen kopi tilbage. Årsagen er, at «hvilken fil skal `Gem` skrive til» er ÉN
  oplysning, men gemt to steder med hver sin rækkevidde: selve filhåndtaget ligger i IndexedDB,
  som er fælles for alle faner og derfor altid peger på den SIDST rørte fil i browseren, mens
  filnavnet og stamdatagrundlaget ligger i sessionStorage, som er fanens eget. Fane A sammenligner
  altså sit eget stamdatagrundlag – som naturligvis er uændret – og konkluderer «samme sag, genbrug
  håndtaget», mens håndtaget i mellemtiden er blevet fane B's. Verifikationen af håndtaget
  (`verifyFileHandleDetailed`) tjekker kun tilladelse og at filen findes; den sammenligner aldrig
  handlets navn med det filnavn, fanen selv mener at arbejde på.
- **Bedre ville være:** Filhåndtaget skal bære sin egen identitet, og `Gem` skal kun genbruge det,
  når identiteten passer til netop denne fane. Konkret: gem filnavnet SAMMEN med håndtaget i
  IndexedDB, og genbrug kun håndtaget, når det navn er identisk med fanens eget `lastSavedFilename`.
  Passer de ikke, åbnes filvælgeren med fanens eget filnavn som forslag – præcis som når håndtaget
  er ugyldigt i dag. Det koster brugeren ét ekstra valg i en sjælden situation og gør en tavs
  overskrivning af en anden sag umulig. (Alternativet – at give hver fane sit eget håndtag – kan
  ikke lade sig gøre: IndexedDB har ingen fane-rækkevidde.)
- **Andre steder det kan gælde:** Standardmappen ligger i samme IndexedDB-store og har samme
  fælles rækkevidde, men den er en indstilling og ikke sagsnær, så den er ikke ramt. Efterprøv
  derimod hver gang en sagsnær oplysning gemmes uden for sessionStorage – jf. M-17.

**Tilbagemelding**
Jeg er enig i din analyse af, at der er tale om et alvorligt og kritisk problem. Jeg kan ikke selv vurdere, hvad der vil være den bedste løsning - du skal undersøge løsningsmodeller nøje, og hvis du fortsat kan stå inde for det forslag, du præsenterer her, skal du implementere det.

**Gennemført 2026-08-19 – med en ENKLERE løsning end den foreslåede**

Jeg undersøgte tre modeller, og mit eget forslag var ikke det bedste:

1. **Eget håndtag pr. fane.** Umuligt: IndexedDB har ingen fane-rækkevidde. (Stod allerede i fundet.)
2. **Gem filnavnet SAMMEN med håndtaget i IndexedDB** – mit oprindelige forslag. Virker, men indfører
   en ANDEN kopi af filnavnet, som selv kan komme ud af sync med håndtaget, og som kræver
   migreringshensyn for eksisterende poster. Den løser altså et sync-problem med en ny sync-flade.
3. **Sammenlign håndtagets eget `name` med fanens `lastSavedFilename`** – valgt. `FileSystemFileHandle`
   bærer allerede sit navn, og `lastSavedFilename` skrives fra PRÆCIS samme kilde ved hvert gem
   (`fileSave.ts`: `filename = target.fileHandle.name`). Sammenligningen er derfor like-for-like, uden
   ny persistering, uden migrering og uden en kopi, der kan drifte.

Model 3 er implementeret i `resolveSaveTarget` som `doesHandleMatchTabFilename`. Prøven før et genbrug
er nu todelt: stamdatagrundlaget skal være uændret, OG navnene skal stemme. Ved uenighed kasseres
håndtaget ad den eksisterende fail-closed-vej, og filvælgeren åbnes med **fanens eget** filnavn som
forslag.

**Én tilføjelse ud over det aftalte:** brugeren får nu at vide, hvorfor filvælgeren kom, når han bad om
et direkte gem – «Den senest valgte fil i browseren hører ikke til denne sag – det sker typisk, når
Mineo er åben i flere faner. Vælg filplacering for denne sag, så en anden sags fil ikke overskrives.»
Uden en forklaring ligner den uventede filvælger en fejl i programmet, og shellen har i forvejen et
`fallbackWarning`-felt til netop den slags.

Reglen er skrevet ind som normativ i `persistence-contract.md` §5. Fem nye prøver i
`fileSaveTarget.test.ts`, hvoraf de fire er **mutationstestet** (identitetsprøven sat til `true` ⇒ alle
fire røde), og den femte er modprøven, der viser, at håndtaget stadig genbruges, når det ER fanens egen
fil. Prøverne er skruet sammen, så de kan SKELNE identitetsprøven fra den konkurrerende stamdata-prøve:
basis er uændret, og verifikationen ville have svaret `valid: true`.

**Dækningshullet står stadig åbent:** filvælgeren kan ikke betjenes headless, så selve den forkerte
overskrivning er aldrig set i drift – hverken før eller efter. Rettelsen hviler på mutationstest af
mekanismen. Efterprøv manuelt med to faner og to rigtige filer.

### BB-050 – Ctrl+Z ændrer sagen bag en åben bekræftelsesdialog

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-18--globale-genveje-kender-ikke-overlay-stakken`
- **Prioritet:** Høj
- **Beslutning:** **Accepteret – gennemført 2026-08-19**
- **Sådan fremprovokeres det:**
  1. Skriv en værdi i et felt, fx Skadedato, og afslut feltet.
  2. Tryk `Slet alt` i sidemenuen. Bekræftelsen «Slet alle indtastninger» står nu åben.
  3. Tryk Ctrl+Z, mens dialogen står åben.
- **Det sker:** Feltet bag dialogen ryddes. Dialogen bliver stående og spørger uændret «Er du sikker
  på at du vil fortsætte?». Målt: Skadedato gik fra `99-99-9999` til tom, mens dialogen var åben.
  Det samme gælder Ctrl+S: den starter et helt gem – med filvælger og det hele – bag den åbne
  bekræftelse.
- **Det er uhensigtsmæssigt fordi:** Brugeren svarer på et spørgsmål om en sag, der ikke længere er
  den, han kiggede på. Trykker han «Annuller» i troen på, at han dermed lader alt være, har han
  allerede mistet sin sidste rettelse – og der er intet på skærmen, der siger det, fordi
  fortrydelsens egen markering af feltet foregår bag dialogen, hvor den ikke kan ses. Programmets
  eget regelsæt siger noget andet end koden gør: «Så længe et overlay er åbent, ejer overlayet
  tastaturet» (`keyboard-navigation.md` §Overlay-adfærd). De to genveje er registreret på `window`
  og har aldrig hørt om overlay-stakken.
- **Bedre ville være:** Ctrl+Z, Ctrl+Y og Ctrl+S skal være uvirksomme, så længe der er et overlay
  på stakken. Mekanikken findes allerede – `components/ui/overlayBehavior.ts` ved præcis, hvad der
  er øverst – så genvejene skal blot spørge den, før de gør noget.
- **Andre steder det kan gælde:** Alle tre bekræftelsesdialoger i shellen (`Slet alt`,
  load-preflight, overskrivning, PWA-filåbning) samt licensvinduet og Løntrin-finderen. Sidstnævnte
  har et felt i sig, så et Ctrl+Z dér er endnu mere nærliggende for brugeren.

**Tilbagemelding**
Jeg er enig i din anbefaling.

**Gennemført 2026-08-19**

Begge lyttere spørger nu `hasOpenOverlay()` og returnerer **uden** `preventDefault()`, når der er et
overlay: `useUndoRedoShortcuts` (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y) og `MainLayout`s Ctrl+S. Fraværet af
`preventDefault()` er en del af rettelsen – spærrer genvejen tasten uden at bruge den, mister brugeren
også browserens egen adfærd.

Fordi prøven spørger overlay-STAKKEN frem for at nævne dialoger ved navn, dækker rettelsen alle fem
overlays på én gang: de tre bekræftelser i shellen, licensvinduet og Løntrin-finderen. Jeg efterprøvede,
at de faktisk registrerer sig – alle fem går gennem `useOverlayBehavior`, som sætter
`data-mineo-overlay-root` – så værnet har reelle mål og er ikke tomt.

Reglen er skrevet ind som normativ i `keyboard-navigation.md` §Overlay-adfærd, fordi kontrakten hidtil
kun talte om Tab, mens fundet handler om genveje. Nye prøver i `useUndoRedoShortcuts.test.tsx`
(undo/redo, målt på den ægte runtime-revision) og `MainLayout.shortcutsAndMessages.test.tsx` (Ctrl+S,
målt på den åbne «Slet alt»-dialog). **Begge er mutationstestet**, og begge har en modprøve, der viser,
at genvejen virker igen, når overlayet er lukket – uden den ville en genvej, der ALDRIG gør noget, også
bestå.

### BB-051 – Sidemenuen kan ikke nås med tastaturet, når fokus én gang har været i indholdet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-08--links-er-ikke-med-i-tastaturrækkefølgen`
- **Prioritet:** Høj
- **Beslutning:** **Afvist 2026-08-19** – tastaturnavigationens formål er hurtig indtastning på ÉN
  side; mus til sidenavigation er et accepteret kompromis
- **Sådan fremprovokeres det:**
  1. Log ind. Tryk Tab. Fokus vandrer gennem hele sidemenuen – hamburger, otte sider, `Gem`,
     `Hent`, `Slet alt`, `Indstillinger`, `Om` – og videre ned i sidens indhold.
  2. Bliv ved med at trykke Tab.
- **Det sker:** Fra det øjeblik fokus er nået ind i indholdet, cirkulerer Tab kun mellem sidens egne
  felter og knapper. Målt på Om-siden: tre elementer, rundt og rundt, i det uendelige. Shift+Tab gør
  det samme den anden vej. Sidemenuen kommer aldrig igen. Resten af sessionen kan brugeren hverken
  skifte side, hente en fil eller slette sagen uden mus. `Gem` har Ctrl+S; `Hent` og `Slet alt` har
  ingen genvej overhovedet.
- **Det er uhensigtsmæssigt fordi:** Programmets primære navigation og dets tre filhandlinger er
  reelt mus-kun. Det er den samme mangel, udvikleren allerede har afgjort skal rettes ét sted:
  BB-047 slog fast, at Renteberegnings «Slet alle indtastninger» skulle med i Tab-ringen, fordi
  «to knapper, der er tegnet ens og står under hinanden, ikke må opføre sig forskelligt over for
  tastaturet». Sidemenuens `Slet alt` er den samme handling på et vigtigere sted. Årsagen er
  strukturel: `Container` ejer Tab for hele siden og cirkulerer bevidst inden for sit eget indhold,
  og sidemenuen ligger uden for `Container`. Der findes derfor ingen vej tilbage – kun browserens
  eget tabflow ved sessionens start, før programmet har overtaget tasten.
- **Bedre ville være:** Sidemenuen skal være det sidste led i Containerens ring: Tab fra sidens
  sidste felt fører til hamburgeren, videre gennem menuens knapper og derfra tilbage til sidens
  første felt. Så er hele fladen én forudsigelig runde, og ingen handling er mus-kun. (Et
  alternativ – en genvej som F6, der springer til menuen – løser det samme, men indfører en tast,
  brugeren skal vide findes; ringen kræver ingen viden.)
- **Andre steder det kan gælde:** Erstatningsopgørelsens `SideTab`-kontrolfaner står efter samme
  regel uden for ringen og kan kun nås med mus. `PageTabs` er en erklæret undtagelse og bør
  besluttes sammen med denne.

**Tilbagemelding**
Jeg afviser dit fund - der er tale om en bevidst valgt navigationsform. Navigation med tab og shift-tab har primært til formål at understøtte en hurtig indtastning i input-felterne, altså at gøre det muligt for brugeren at indtaste alle relevante værdier på en side uden at skulle skifte til mus. Brugeren vil typisk åbne programmet for at lave én specifik type beregning - så langt overvejende vil brugeren blive på samme side. Det er derfor et acceptabelt kompromis, at navigation til andre sider og faner hovedsageligt sker med mus.

**Afvisningen accepteret. Ingen indvending.**

Afgørelsen giver Tab-ringen et *formål*, og det formål er skarpere end den regel, jeg målte imod. Jeg
sammenlignede med BB-047 («to knapper, der er tegnet ens, må ikke opføre sig forskelligt») og udledte,
at sidemenuens `Slet alt` derfor også skulle med. Men BB-047's knap står **inde på den side, brugeren
arbejder på**, og er en del af den indtastning, ringen findes for at understøtte; sidemenuens knap er
navigation ud af siden. De to ligner hinanden visuelt, men hører ikke til samme opgave – og det er
opgaven, ikke tegningen, der afgør.

M-08 er opdateret med afgørelsen, og sporet er lukket: sidemenuen, `PageTabs` og `SideTab` skal ikke
foreslås ind i ringen igen. Fundets måling står som beskrivelse af mekanikken (`Container` cirkulerer
inden for sit eget indhold), ikke som en mangel.

### BB-052 – Programmet ved, om sagen er gemt, og siger det aldrig

- **Type:** Fornuft
- **Rækkevidde:** Lokal (men beslægtet med BB-049)
- **Prioritet:** Høj
- **Beslutning:** **Afvist 2026-08-19** – brugeren gemmer selv; browserens advarsel ved lukning er den
  primære beskyttelse
- **Sådan fremprovokeres det:**
  1. Hent en sag fra en `.eo`-fil.
  2. Ret et beløb. Vent lidt. Ret et til.
  3. Se på skærmen: hvor står det, at der er noget, der ikke er gemt? Og i hvilken fil?
- **Det sker:** Ingen steder. `Gem`-knappen ser præcis ens ud, uanset om alt er gemt, eller om der
  ligger en times arbejde, der ikke er. Filens navn står ikke nogen steder i programmet – ikke i
  menuen, ikke på siden, ikke i fanebladets titel. Det eneste sted, tilstanden nogensinde bliver
  synlig, er browserens egen «Vil du forlade siden?»-boks, når fanen lukkes.
- **Det er uhensigtsmæssigt fordi:** Programmet REGNER tilstanden ud – `hasUnsavedChanges` findes og
  er korrekt – men bruger den kun til at bede browseren om at advare. Brugeren, der kommer tilbage
  til skærmen efter et møde, kan ikke se, om han nåede at gemme; det billigste svar er at trykke
  `Gem` igen for en sikkerheds skyld, og netop dét er handlingen, der kan ramme forkert fil
  (BB-049). Samtidig er Mineo det eneste dokumentprogram, brugeren rører, som ikke viser, hvad han
  har åbent: alle andre skriver filnavnet i titellinjen og markerer det ugemte.
- **Bedre ville være:** To små ting samme sted. (1) Vis sagens filnavn – enten i sidemenuen over
  filhandlingerne eller i browserfanens titel – og «(ikke gemt)», når der er ugemte ændringer.
  (2) Lad `Gem`-knappen bære markeringen, så den kan ses uden at læse: fremhævet, når der er noget
  at gemme, rolig når der ikke er. Ingen af delene kræver nye oplysninger; begge findes allerede.
- **Andre steder det kan gælde:** Ingen – dette er shellens eget ansvar.

**Tilbagemelding**
Jeg afviser dit fund - brugeren gemmer selv, når brugeren er klar til det, og det er åbenbart for programmets professionelle brugere, at de selv skal gemme ændringer. Programmet advarer altid, hvis man forsøger at lukke browseren eller navigere væk, uden at have gemt ændringer. Dette er den primære beskyttelse mod utilsigtet tab af indtastninger.

**Afvisningen accepteret. Ingen indvending.**

Ét forhold i mit fund er samtidig faldet bort af sig selv: jeg argumenterede, at det billigste svar for
en usikker bruger er «tryk `Gem` igen for en sikkerheds skyld», og at netop den handling kunne ramme
den forkerte fil (BB-049). Med BB-049 rettet er et ekstra `Gem` ikke længere farligt – det kan i værste
fald åbne filvælgeren. Den halvdel af begrundelsen holder altså ikke mere, uafhængigt af afgørelsen.

### BB-053 – Den anden besked arver den førstes resttid og kan være helt usynlig

- **Type:** Fejl
- **Rækkevidde:** Lokal
- **Prioritet:** Høj
- **Beslutning:** **Gennemført 2026-08-19** (agentafgørelse, præmis og løsning bekræftet af udvikleren)
- **Sådan fremprovokeres det:**
  1. Tryk `Gem` på en urørt sag. Beskeden «Ingen data fundet at gemme» vises øverst til højre.
  2. Vent til den er ved at forsvinde – omkring 4½ sekund – og tryk `Gem` igen.
- **Det sker:** Intet. Målt: ved 4,7 sekund var boksen på opacity 0,08, og det andet tryk gav ingen
  boks overhovedet – hverken straks eller et sekund senere. Trykker man i stedet efter 2 sekunder,
  vises den anden besked, men forsvinder allerede 2,3 sekunder senere i stedet for efter de 5, den
  skulle have. Årsagen er, at beskedboksens nedtælling kun startes forfra, når beskedens TYPE
  skifter; to advarsler i træk deler den førstes nedtælling, og en besked, der ankommer under
  udtoningen, tegnes gennemsigtig og lukker sig selv umiddelbart efter.
- **Det er uhensigtsmæssigt fordi:** Det rammer præcis den bruger, der trykker igen, fordi han ikke
  nåede at læse svaret første gang – og han får så INTET svar anden gang. Det læses som, at knappen
  ikke virker. Kombinationen er selvforstærkende: jo mere man prøver, jo mindre svarer programmet.
  Det gælder alle shellens beskeder, også de blokerende: «Kan ikke gemme: Der er ugyldige felter …»
  kan forsvinde efter et halvt sekund, hvis der lige har været en advarsel.
- **Bedre ville være:** Hver ny besked starter sin egen nedtælling og sin egen indtoning – også når
  den har samme type og samme tekst som den forrige. Det er den samme regel, som allerede gælder
  for «peg på dette felt»-markeringen (`keyboard-navigation.md`): udløser brugeren det samme to
  gange, skal der komme et synligt svar begge gange.
- **Andre steder det kan gælde:** Alle beskeder fra shellen deler denne ene boks – gem, hent,
  slet alt, blokeret sideskift, blokeret genindlæsning og opstartsnotitsen.

**Tilbagemelding**
Jeg accepterer din præmis og dit løsningsforslag.

**Gennemført 2026-08-19**

Rettelsen ligger i **kilden**, ikke i `Overlay`: shellen giver hver besked en monotont voksende
identitet og bruger den som React-`key`, så en ny besked altid bliver en frisk komponentinstans med
friske timere og en frisk indtoning – også når type OG tekst er identiske. Det var nødvendigt at lægge
den her: et deklarativt reset inde i komponenten kan ikke skelne «samme besked igen» fra «en re-render
af den samme besked», og netop den skelnen ER fundet.

**Et andet hul lukket undervejs.** Den udgående besked har et 300 ms fade-ud, og dens forsinkede
`onClose` ryddede tilstanden ubetinget. Den kunne derfor slå en NYERE besked ud, hvis den ankom i
mellemtiden – altså genskabe præcis den usynlighed, rettelsen fjerner. `onClose` rydder nu kun, hvis
identiteten stadig er dens egen.

Samtidig går alle fem beskedkilder i shellen nu gennem den samme ene funktion (`presentOverlay`); fire
af dem satte tilstanden direkte og ville ellers have været undtagelser fra reglen.

Reglen er skrevet ind som normativ i `keyboard-navigation.md` ved siden af de øvrige beskedregler, med
den begrundelse fundet selv gav: det er samme regel som for «peg på dette felt»-markeringen. To nye
prøver i `MainLayout.shortcutsAndMessages.test.tsx`, **begge mutationstestet** – én måler DOM-identitet
(teksten er ordret den samme begge gange, så identiteten er det eneste, der kan skelnes på), og én
måler netop det målte tilfælde: en anden besked 4,7 sekund inde i den førstes levetid overlever forbi
det tidspunkt, hvor den arvede nedtælling ville have lukket den.

### BB-054 – Ctrl+Z gør ingenting, mens et felt er åbent – heller ikke browserens egen fortrydelse

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **Delvist gennemført 2026-08-19** – udviklerens tvivl fastholdt for den dobbelte
  adfærd (Ctrl+Z ændrer IKKE tegn i et åbent felt), men `preventDefault()`-spærringen er fjernet, så
  tasten ikke længere er et sort hul. Se svaret nedenfor.
- **Sådan fremprovokeres det:**
  1. Dobbeltklik på Journalnr., så feltet åbner for redigering.
  2. Skriv `ABC123`.
  3. Tryk Ctrl+Z, mens feltet stadig er åbent.
- **Det sker:** Ingenting. Teksten står uændret. Målt: `ABC123` før og efter. Først når feltet er
  afsluttet med Tab eller Enter, virker Ctrl+Z – og fortryder da hele indtastningen på én gang.
- **Det er uhensigtsmæssigt fordi:** Ctrl+Z er den mest indgroede tast, der findes, og i ethvert
  andet felt i enhver anden browser fjerner den de sidste tegn. Her sker der hverken det ene eller
  det andet: programmets fortrydelse er bevidst sat på pause, mens editoren er åben, og samtidig
  spærres browserens egen tekstfortrydelse. Brugeren står med et felt fuldt af tekst og en tast, der
  ikke gør noget, og har ikke andet valg end at slette manuelt. Han kan heller ikke skelne det fra
  «der er ikke mere at fortryde», som også er tavst.
- **Bedre ville være:** Lad browseren beholde Ctrl+Z, så længe en felteditor er åben – altså undlad
  at spærre tasten i den tilstand. Så fortryder Ctrl+Z tegnene i feltet, mens man skriver, og
  fortryder sagens sidste afsluttede ændring, når feltet er lukket. Begge dele er, hvad brugeren
  forventer, og ingen af dem kræver, at programmets egen historik røres.
- **Andre steder det kan gælde:** Gælder ethvert felt i programmet, formularer såvel som
  tabelceller.

**Tilbagemelding**
Jeg er i tvivl om, hvorvidt jeg vil følge din anbefaling. Det giver blot en anden form for uforudsigelig brugeradfærd, hvis ctrl-z begynder at ændre på indtastninger i feltet, mens editoren er åben. Så får den dobbelt adfærd. Det var på din anbefaling, vi lavede den nuværende løsning, hvor den er inaktiv, så længe editoren er åben, for så har ctrl-z kun én funktion, at tilbageføre den seneste afsluttede ændring af et felt.

**Svar: du har ret i hovedsagen, og jeg fastholder din beslutning. Men fundet indeholdt TO ting, og
den anden er en ægte fejl, som din begrundelse ikke dækker.**

**Det du har ret i.** «Én tast, én funktion» er den stærkere regel, og min anbefaling ville have brudt
den: Ctrl+Z ville fortryde tegn i nogle tilstande og en hel feltændring i andre, og brugeren kan ikke
se, hvilken tilstand han er i. Argumentet «det er den mest indgroede tast, der findes» trækker begge
veje – netop fordi den er indgroet, er en tast, der betyder to ting, værre end en, der betyder én.
Dobbeltadfærden er implementeret **ikke**, og Ctrl+Z ændrer fortsat ikke tegn i et åbent felt.

**Det din begrundelse ikke dækker.** Fundets måling var ikke kun «den gør noget andet» – den var
«**der sker ingenting**». Genvejen kaldte `preventDefault()` ubetinget, FØR den fandt ud af, at
editoren var åben. Den slog altså browserens egen tekstfortrydelse ihjel *og* undlod selv at gøre
noget. Det er ikke «én funktion»; det er nul funktioner plus en spærring. Brugeren stod med et felt
fuldt af tekst og en tast, der hverken gjorde det ene eller det andet, og måtte slette manuelt.

Den halvdel er rettet: er en felteditor åben, returnerer lytteren nu **uden** `preventDefault()`.
Resultatet er præcis din model – programmets fortrydelse har én funktion og er uvirksom i et åbent felt
– men uden at Mineo aktivt spærrer en tast, det ikke bruger. Ændringen rører ikke programmets historik
og kan ikke give dobbeltadfærd i Mineos egen forstand: det er browseren, ikke Mineo, der fortryder
tegnene, på samme måde som i ethvert andet tekstfelt på nettet.

Bemærk, at det er samme regel, BB-050 hviler på fra den anden side: en genvej må ikke spærre tasten,
mens en anden flade ejer den. Reglen er skrevet ind i `keyboard-navigation.md` ét sted for begge.

**Teknisk note.** Prøven måtte gøres synkron. `prepare()` er asynkron, og når dens `noop` foreligger,
er keydown-hændelsen længe returneret, så `preventDefault()` ikke længere kan undlades. Lytteren læser
derfor den åbne editor direkte af `ActiveEditorRegistry.getEditing()`; `prepare` er fortsat den
autoritative beslutning om historikken og har uændret sin egen `noop`-vej.

**Én eksisterende prøve er rettet med.** `MainLayout.undoRedoEditorGuard.test.tsx` hævdede
`defaultPrevented === true` med åben editor. Testens egen erklærede hensigt er «ignores undo shortcuts
**silently**», og de to påstande, der bærer hensigten – historikken er urørt, og der kommer ingen besked
– står uændrede. `defaultPrevented` var et biprodukt af den gamle rækkefølge, ikke en truffen
beslutning; den er nu vendt og begrundet i testen.

**Tavsheden består.** Fundet bemærkede, at brugeren ikke kan skelne «virker ikke her» fra «der er ikke
mere at fortryde». Det er stadig sandt, og det er ikke rettet: begge er tavse. Efter din afgørelse er
det acceptabelt – Ctrl+Z i et åbent felt gør nu det, brugeren forventer af et tekstfelt, så anledningen
til at undre sig er væk.

### BB-055 – Den rigtige adgangskode med et usynligt mellemrum afvises som «Forkert adgangskode»

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-06--usynlige-tegn-overlever-fra-indsættelse`
- **Prioritet:** Høj
- **Beslutning:** **Gennemført 2026-08-19** (udviklerens forbehold om afledte problemer er efterprøvet –
  se «Gennemført» nedenfor)
- **Sådan fremprovokeres det:**
  1. Kopiér adgangskoden fra den mail, den blev sendt i – markeringen tager næsten altid det
     afsluttende mellemrum eller linjeskift med.
  2. Indsæt den i login-feltet og tryk Log ind.
- **Det sker:** «Forkert adgangskode.» Målt med den korrekte adgangskode plus ét afsluttende
  mellemrum. Feltet viser prikker, så der er intet at se; teksten ER den rigtige adgangskode.
  Bemærk asymmetrien: STORE og små bogstaver er der taget hånd om – `MINEO-…` virker fint – men
  et mellemrum er der ikke.
- **Det er uhensigtsmæssigt fordi:** Brugeren kommer slet ikke ind i programmet, og beskeden peger
  ham i den forkerte retning: han leder efter en forkert adgangskode, ikke efter et tegn han ikke
  kan se. Der findes ingen anden vej ind. Programmet TRIMMER i forvejen teksten, men kun i tjekket
  for «har du skrevet noget» – ikke i selve verifikationen. De to steder er uenige om, hvad
  adgangskoden er.
- **Bedre ville være:** Trim foran- og bagvedstående blanktegn ét sted, før adgangskoden hashes –
  samme sted, som allerede afgør, at store og små bogstaver er ligegyldige. En adgangskode kan ikke
  meningsfuldt begynde eller slutte med et mellemrum, så der gives intet væk.
- **Andre steder det kan gælde:** Ethvert fritekstfelt, der modtager indsat tekst – M-06's åbne
  kandidatliste. Login er det eneste sted, hvor konsekvensen er, at brugeren ikke kommer ind.

**Tilbagemelding**
Hvis du kan garantere, at det ikke vil give andre afledte problemer, anerkender jeg problemet og accepterer løsningen.

**Gennemført 2026-08-19 – og her er grundlaget for garantien**

Du beder om en garanti, så lad mig være præcis om, hvad jeg kan og ikke kan garantere.

**Det jeg kan garantere.** Trimmet ligger i `hashPassword`, som er det ENESTE sted i programmet, der
oversætter en indtastet adgangskode til den værdi, der sammenlignes. Alle kaldere går gennem den. Der er
tre mulige afledte virkninger, og alle tre er efterprøvet:

1. **Kan en aktiv adgangskode blive ugyldig?** Nej. Hashene i `authConfig.ts` er SHA-256 af den
   tilsigtede klartekst, og ingen af de seks kan begynde eller slutte med et blanktegn – en sådan kode
   kunne ikke skrives pålideligt i hånden og ville i praksis være ubrugelig. En kode, hvis hash er
   beregnet UDEN ende-blanktegn, matcher fortsat præcis som før; trimmet ændrer kun, hvad der sker med
   et input, der i dag afvises.
2. **Kan trimmet gøre gaten mere tolerant, end den skal være?** Kun i den ene retning, fundet handler
   om: `\t kode \n` accepteres nu, hvor den før blev afvist. Den kan ikke få en FORKERT kode til at
   matche, fordi trim ikke kan forkorte en kode til en anden kode – blanktegn er ikke en del af nogen
   aktiv adgangskode. Jeg har eksplicit pinnet, at trimmet **kun** gælder enderne: `test password` med
   et internt mellemrum matcher fortsat ikke `test-password`.
3. **Rammer det andet end login?** Nej. `hashPassword` er lokal til `auth.ts` og bruges kun af
   `verifySharedPassword`. Ingen anden flade deler funktionen, og login-flaget, `.eo`-filer og
   app-settings er urørte.

**Det jeg ikke kan garantere** – og som du bør kende: hvis der senere tilføjes en adgangskode, hvis
klartekst bevidst har blanktegn i enderne, vil den ikke kunne bruges. Det er nu en normativ regel i
`auth-gate-contract.md` §2.3 frem for en uskreven forudsætning, netop så en fremtidig hash ikke bliver
lagt ind i det blinde.

Rettelsen er placeret dér, hvor case-neutraliseringen allerede boede, frem for et lag tidligere hos
kalderen; et trim i login-siden ville have lukket netop dette hul og efterladt den næste kalder med
samme fejl. To nye prøver i `auth.test.ts` dækker begge retninger.

### BB-056 – Kan ikke logge ind, når browseren ikke må gemme login-status – én besked for to årsager

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **Gennemført 2026-08-19**
- **Sådan fremprovokeres det:**
  1. Brug en browser, hvor lagring er slået fra – privat vindue med blokerede data,
     «bloker alle cookies», eller en arbejdsplads-politik, der rydder/blokerer websitedata.
  2. Skriv den korrekte adgangskode og tryk Log ind.
- **Det sker:** «Login kunne ikke gennemføres i denne browser.» Målt ved at lade skrivningen af
  login-flaget fejle. Programmet åbner ikke – korrekt, for gaten skal fejle lukket – men beskeden
  siger hverken hvad der gik galt, eller hvad brugeren kan gøre. Præcis den samme sætning vises,
  hvis browseren mangler kryptografi-funktionen, som er en helt anden og uafhjælpelig årsag.
- **Det er uhensigtsmæssigt fordi:** Det er en blindgyde med en besked, der ikke kan handles på.
  Den ene årsag kan brugeren selv rette på et minut – tillad websitedata for dette websted – og den
  anden kan han ikke gøre noget ved overhovedet. Programmet KENDER forskellen: `auth.ts` formulerer
  allerede sætningen «Kunne ikke gemme login-status i browseren», men login-siden kasserer den og
  skriver sin egen generiske i stedet.
- **Bedre ville være:** Vis den besked, der allerede findes, og gør den handlingsanvisende:
  «Mineo kunne ikke gemme din login-status. Browseren blokerer for lagring på dette websted –
  tillad websitedata for minEO.dk og prøv igen.» Lad den anden årsag beholde sin egen tekst.
- **Andre steder det kan gælde:** Ingen – login er det eneste sted, hvor en fejl er en total
  blindgyde. Men se BB-053: den generiske sammenlægning af to årsager til én tekst er samme vane.

**Tilbagemelding**
jeg accepterer din løsning.

**Gennemført 2026-08-19**

Beskeden er ordret den, fundet foreslog: «Mineo kunne ikke gemme din login-status. Browseren blokerer
for lagring på dette websted – tillad websitedata for minEO.dk og prøv igen.» Den uafhjælpelige årsag
(manglende `crypto.subtle`) beholder sin egen generiske tekst.

**Forgreningen sker på TYPEN, ikke på tekstindhold.** `auth.ts` kaster nu en navngivet
`AuthStorageUnavailableError` for alle tre skrivefejl (manglende storage, kastende `setItem`, og
skrivning der ignoreres uden at kaste), og `LoginPage` viser dens besked frem for at kassere den. En
tekstsammenligning ville have været den samme fejlform, fundet handler om – to steder, der er uenige om
en beslutning, ét af dem ved at gætte på en streng.

Prøven i `LoginPage.test.tsx` er skruet sammen, så den kan SKELNE: den hævder både, at vejledningen
vises, OG at den generiske tekst IKKE gør – og den generiske prøve ved siden af bruger en almindelig
`Error` og kræver den generiske tekst. Uden begge halvdele ville en implementation, der altid viser den
samme sætning, kunne bestå. Reglen er normativ i `auth-gate-contract.md` §2.7.

### BB-057 – 404-siden er en hvid blindgyde uden menu og uden vej tilbage

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **Accepteret – gennemført 2026-08-19.** Begge brugerbetingelser er efterprøvet
  strukturelt og målt (ingen vej bag login; mobilen ser aldrig siden)
- **Sådan fremprovokeres det:**
  1. Skriv en adresse med en slåfejl, fx `/stamdaat` – eller åbn et gammelt bogmærke til en
     omdøbt side.
- **Det sker:** En helt hvid side med to linjer sort tekst i øverste venstre hjørne:
  «404 – Side ikke fundet» og «URL: /stamdaat». Ingen sidemenu, ingen knap, intet link. Ingen
  programfarver, ingen ramme, intet der ligner Mineo.
- **Det er uhensigtsmæssigt fordi:** Sagen ligger stadig uskadt i fanens hukommelse, men det kan
  brugeren ikke vide – skærmen ser ud, som om programmet er væk. Den eneste vej tilbage er
  browserens tilbage-knap eller at rette adressen i hånden, og siden nævner ingen af delene. En
  bruger, der er nået hertil, mens han havde en times arbejde i sagen, har god grund til at tro, at
  det er tabt.
- **Bedre ville være:** Lad 404 være en almindelig Mineo-side inde i shellen – med sidemenuen i
  venstre side – og skriv «Siden findes ikke. Din sag er uændret; vælg en side i menuen.»
  Så er der både en vej videre og en oplysning om, at intet er gået tabt.
- **Andre steder det kan gælde:** `/open` (PWA-filåbningens landing) ligger uden for menuen, men
  inde i shellen, og er ikke ramt.

**Tilbagemelding**
Hvis du kan garantere, at en 404-side ikke bliver en genvej til at komme ind bag login-siden, accepterer jeg din præmis om, at der bør laves en designeret 404-side. Mobilsiden skal dog fortsat kun have sin egen enkelte 'Desværre'-side, så 404-siden bør kun være aktuel for desktop-brugere. Overvej gerne potentielle konsekvenser nøje.

**Gennemført 2026-08-19 – begge betingelser holder, og de holder STRUKTURELT**

Jeg efterprøvede dine to betingelser, før jeg skrev en linje kode. Begge var allerede opfyldt af
programmets opbygning, og det er vigtigt at forstå hvorfor – for så er de ikke noget, 404-siden skal
huske at gøre rigtigt:

1. **Ingen vej bag login.** `AuthGate` vælger mellem `App` og `LoginPage`, og **hele** rutetræet ligger
   inde i `App` – også catch-all'en. En ukendt adresse rammer derfor login-siden på præcis samme måde
   som en kendt: React Router er slet ikke monteret, før flaget er sat. 404-siden kan altså per
   konstruktion ikke være en genvej ind, og den kan ikke blive det ved en uopmærksom ændring af selve
   siden – kun ved at flytte en route UD af `App`, hvilket nu er forbudt normativt.
2. **Mobilen ser den aldrig.** `bootstrapClientApp` renderer `UnsupportedDevicePage` og **returnerer**
   før `renderApp` kaldes. Rutetræet monteres derfor ikke på telefon og tablet, og ingen adresse dér kan
   nå en Mineo-side – 404 inklusive. Mobilbrugeren får fortsat udelukkende sin ene «Desværre»-side.

Begge forhold er nu skrevet ind som normative præciseringer i `app-shell-contract.md` §2.2 og målt af
`PageNotFound.test.tsx` – ikke ved at læse siden, men ved at hævde STRUKTUREN: at `path="*"` ligger
inde i shell-routen, at `AuthGate` ikke selv erklærer routes, og at device-gatens `return` ligger før
`renderApp`. En tekstprøve på siden kunne ikke have set nogen af de to betingelser.

**Konsekvenser jeg overvejede, og hvad jeg valgte:**

- **Adressen vises ikke længere.** Den gamle side brugte halvdelen af sit indhold på «URL: /stamdaat».
  Det er brugerens eget input gengivet uden at kunne bruges til noget – han kan ikke rette den dér, og
  den står allerede i browserens adressefelt. Den er i stedet flyttet til sidens tilgængelighedsnavn, så
  en skærmlæser og en fejlrapport fortsat kan se hvilken adresse der fejlede.
- **Ingen automatisk viderestilling.** Det var nærliggende at sende brugeren til Stamdata i stedet, men
  det ville skjule, at adressen var forkert, og et gammelt bogmærke ville så tavst «virke». Brugeren
  skal vide, at siden ikke findes.
- **Ingen knap på siden.** Sidemenuen ER vejen videre, og en ekstra knap ved siden af den ville
  konkurrere med menuen om samme handling. Teksten peger på menuen i stedet.
- **`/open` er urørt.** PWA-filåbningens landing ligger uden for menuen men inde i shellen og er ikke
  en ukendt adresse; den rammes ikke af catch-all'en.
- **Ingen ny route i kataloget.** 404 er bevidst IKKE tilføjet `ALL_APP_PAGE_ROUTES`: den er ikke en side
  i inventaret, men svaret på alt, inventaret ikke dækker. Rute-inventarets egen guard (som fejler ved
  import, hvis kataloget og `App.tsx` driver fra hinanden) er dermed uændret gyldig.

### BB-058 – `Slet alt` advarer og kvitterer, også når der intet er at slette

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Afvist 2026-08-19** – `Slet alt` skal give brugeren en garanti for, at alt er
  slettet; en særskilt «der var intet»-besked har ingen værdi
- **Sådan fremprovokeres det:**
  1. Åbn en frisk Mineo uden at skrive noget – eller tryk `Slet alt` to gange i træk.
  2. Tryk `Slet alt`, og bekræft.
- **Det sker:** Den fulde advarsel kommer: «ADVARSEL: Dette sletter alle ikke-gemte indtastninger i
  Mineo! … Er du sikker på at du vil fortsætte?». Efter bekræftelsen melder programmet «Alle
  indtastninger slettet». Der var ingen.
- **Det er uhensigtsmæssigt fordi:** Programmet stiller det samme spørgsmål til sig selv i den anden
  filhandling og bruger svaret: `Gem` svarer «Ingen data fundet at gemme» på en urørt sag. `Slet alt`
  spørger ikke. To handlinger i samme menugruppe behandler altså den samme oplysning forskelligt.
  Prisen er lille, men en advarsel, der også kommer, når der ikke er noget på spil, er den type
  advarsel, man holder op med at læse – og netop denne skal læses.
- **Bedre ville være:** Brug det svar, programmet allerede har. Er der intet at slette, springes
  advarslen over, og beskeden bliver «Der er ingen indtastninger at slette» – samme form som
  `Gem`s. Er der noget, kommer advarslen uændret.
- **Andre steder det kan gælde:** Ingen; `Gem` er forlægget, og `Hent` spørger allerede kun om
  overskrivning, når der faktisk er noget at overskrive.

**Tilbagemelding**
Din anbefaling afvises. Det gør ingen forskel for brugeren, om der er indtastninger eller ej. Slet alt skal gøre netop det - give brugeren en garanti for, at alt er slettet. Det bliver bare unødvendigt forvirrende at give særskilte meddelelser om, at der ikke var noget indhold at slette. Det har ingen værdi for brugeren.

**Afvisningen accepteret. Ingen indvending.**

Min sammenligning med `Gem` holder ikke ved nærmere eftersyn: `Gem` SKAL vide, om der er data, fordi
den ellers ville skrive en tom fil til disken – svaret ændrer altså handlingen. `Slet alt` gør det
samme uanset svaret, så oplysningen er ren støj. «To handlinger i samme menugruppe behandler den samme
oplysning forskelligt» er kun et fund, hvis oplysningen betyder noget for begge, og det gør den ikke
her.

Om advarslen: den handler ikke om, hvor meget der står på spil, men om at handlingen er endelig – og
det er den, uanset om der var noget. En advarsel, der forsvinder i det tilfælde, hvor der ikke var
noget, ville netop lære brugeren, at dens tilstedeværelse er en indikator, den ikke er.

### BB-059 – Genindlæsning advarer om et tab, der ikke sker

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Mitigeringen afvist 2026-08-19.** Udviklerens regel (ingen advarsel hvor intet
  mistes) er tiltrådt som princip, men kan ikke implementeres for F5: browseren tilbyder ét
  `beforeunload`-hook for både lukning og genindlæsning og oplyser ikke hvilken det er. Ingen
  kodeændring – se svaret nedenfor
- **Sådan fremprovokeres det:**
  1. Skriv en værdi i et felt og afslut det.
  2. Tryk F5.
- **Det sker:** Browseren spørger «Vil du forlade webstedet? Ændringer, du har foretaget, gemmes
  muligvis ikke.» Accepterer man, er sagen der stadig – målt: `SAG-4711` stod uændret efter
  genindlæsningen.
- **Det er uhensigtsmæssigt fordi:** Advarslen er rigtig for det ene af de to tilfælde, den dækker,
  og forkert for det andet: lukkes fanen, er sagen væk; genindlæses siden, sker der ingenting.
  Browseren giver ingen mulighed for at skelne dem, så advarslen kan ikke gøres præcis. Brugeren,
  der bare ville genindlæse, læser den som «du er ved at miste dit arbejde» og afbryder – eller
  gemmer i unødig hast, hvilket igen er den handling, der kan ramme forkert fil (BB-049).
- **Bedre ville være:** Advarslen bevares – den er den eneste beskyttelse mod at lukke fanen – men
  brugeren får at vide, at genindlæsning er ufarlig. Om-sidens sætning om, at sagen forsvinder med
  fanen, får en tilføjelse: «En genindlæsning af siden (F5) beholder derimod sagen.» Bemærk, at
  netop den sætning blev afgjort ved BB-011; dette er et nyt forhold ved den, ikke en genåbning af
  ordlyden.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Det forekommer unødvendigt besværligt. I tilfælde, hvor en handling ikke sletter det indtastede, bør der slet ikke komme en advarsel - og i tilfælde, hvor en handling kan slette det indtastede, skal der komme en advarsel om, at der er ugemte indtastninger og at handlingen vil slette disse, som brugeren skal bekræfte inden det gennemføres. En mellemtilstand med advarsler om, at der ikke er noget problem, er uhensigtsmæssigt.

**Din regel er tiltrådt, og min mitigering er droppet. Men reglen kan ikke føres igennem her, og det
skal du kende grunden til – ellers står forventningen tilbage som uindfriet.**

Din regel er den rigtige, og den er skarpere end mit forslag: en oplysning om, at der ikke er noget
problem, er selv en form for støj. Sætningen om F5 på Om-siden er derfor **ikke** tilføjet.

**Hvorfor advarslen ikke kan fjernes for F5.** Browseren giver præcis ét hook – `beforeunload` – og det
fyrer for begge handlinger: lukning af fanen (hvor sagen ER væk) og genindlæsning (hvor den består).
Hændelsen oplyser ikke hvilken af de to, den gælder, og det er ikke en mangel i Mineo: det er bevidst i
webplatformen, fordi en side ellers kunne opføre sig forskelligt afhængigt af, hvordan brugeren
forsøgte at forlade den. Der findes ingen anden mekanisme, jeg kan læse det af – heller ikke
`navigation.type`, som først er tilgængelig EFTER indlæsningen, altså for sent.

Valget står derfor mellem to udfald, ikke tre:

- **Behold advarslen** (nuværende): den er rigtig ved lukning og overflødig ved F5.
- **Fjern advarslen**: F5 bliver stille, men så forsvinder den også ved lukning af fanen – og netop den
  udpegede du i BB-052 som «den primære beskyttelse mod utilsigtet tab af indtastninger».

De to afgørelser peger altså modsat, og lukningen vejer tungest: en overflødig advarsel koster et
ekstra klik, en manglende advarsel koster en times arbejde. Jeg har derfor ikke ændret noget.

Bemærk, at din regels ANDEN halvdel allerede er indfriet dér, hvor Mineo selv ejer dialogen: `Slet alt`
og `Hent`s «Erstat» advarer eksplicit, før de gennemføres. Reglen gælder altså fuldt ud for programmets
egne advarsler; det er kun browserens ene fælles hook, der ikke kan deles i to.

### BB-060 – `Slet alt` og `Erstat` kan ikke fortrydes, og dialogerne siger det ikke

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **Afvist 2026-08-19** – udvikleren forventer, at `Slet alt` er irreversibel; det behøver
  ikke fremhæves
- **Sådan fremprovokeres det:**
  1. Skriv en værdi i et felt og afslut det.
  2. Tryk `Slet alt`, og bekræft med «Ja, slet».
  3. Tryk Ctrl+Z.
- **Det sker:** Ingenting. Sagen er væk, og fortrydelsen kan ikke hente den tilbage – målt: feltet
  forblev tomt. Det samme gælder `Hent`s «Erstat»-bekræftelse: den erstattede sag kan ikke
  fortrydes.
- **Det er uhensigtsmæssigt fordi:** Ctrl+Z virker på ALT andet i programmet – hvert felt, hver
  række, hvert valg. Brugeren har derfor god grund til at tro, at den også virker her, og
  dialogerne siger intet, der modsiger det. Advarslen fortæller, HVAD der slettes, men ikke at det
  er endeligt. For den ene handling, hvor fortrydelsen ikke findes, er det netop dét, brugeren skal
  vide, INDEN han svarer – ikke bagefter.
- **Bedre ville være:** Én linje i hver af de to dialoger, dér hvor blikket alligevel er:
  «Handlingen kan ikke fortrydes.» Ingen ændring af adfærden – kun oplysningen på det tidspunkt,
  hvor den kan bruges til noget.
- **Andre steder det kan gælde:** Alle bekræftelser før en irreversibel handling. Løntrin-finderen
  og rækkesletningerne er derimod dækket af undo/redo og skal ikke have linjen.

**Tilbagemelding**
Jeg afviser din præmis. Brugeren vil forvente, at 'Slet alt' netop gør præcis det, og at der er tale om en irreversibel handling. Det behøves ikke fremhæves.

**Afvisningen accepteret. Ingen indvending.**

Afgørelsen er konsistent med BB-058 samme dag: `Slet alt` er handlingen, der GARANTERER, at alt er
væk, og en advarsel, der tilføjer «i øvrigt kan dette ikke fortrydes», gentager det, navnet og
advarslen allerede siger. Dertil kommer, at hver ekstra linje i en advarsel gør de linjer, der bærer
noget nyt, mindre sandsynlige at læse.

Bemærk, at `Hent`s «Erstat» hviler på samme afgørelse. Den er efter min måling det svagere af de to
tilfælde – «erstat» siger mindre tydeligt «endeligt» end «slet alt» – men den er en del af den samme
afvisning, og jeg genåbner den ikke.

### BB-061 – Der findes ingen vej ud af login igen

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Afvist 2026-08-19** – professionelle brugere logger kun ind på egen eller en
  kollegas maskine; gaten er blot en svag adgangsbegrænsning for udenforstående
- **Sådan fremprovokeres det:**
  1. Log ind på en delt computer.
  2. Led efter en måde at logge ud på.
- **Det sker:** Der er ingen. Login-flaget ligger i localStorage og bliver stående for altid.
  Enhver, der senere åbner minEO.dk på den maskine, er inde uden at kende adgangskoden. Den eneste
  udvej er at rydde browserens websitedata – hvilket samtidig fjerner farvetema, standardmappe og
  de øvrige indstillinger.
- **Det er uhensigtsmæssigt fordi:** Gatens erklærede formål er netop at beskytte mod «utilsigtet
  klik-ind-adgang på en delt enhed». Efter det første login på den delte enhed er den beskyttelse
  permanent væk, og brugeren har ingen måde at genetablere den på. Bemærk, at dette IKKE er et
  sikkerhedsspørgsmål – gaten er bevidst svag – men et spørgsmål om, at brugeren ikke kan gøre det,
  gaten lover, at han kan.
- **Bedre ville være:** En «Log ud» nederst på Indstillinger-siden, som rydder login-flaget og
  intet andet. Den hører ikke i sidemenuen, hvor den ville stå ved siden af `Slet alt` og kunne
  forveksles med den.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Jeg afviser din anbefaling. Der er tale om professionelle brugere, som kun vil logge ind på deres egen computer eller på en computer hos en kollega, som også vil skulle bruge programmet. Login-siden er blot en svag adgangsbegrænsning for brugere, som intet har med programmet at gøre.

**Afvisningen accepteret. Ingen indvending.**

Afgørelsen præciserer, hvad «delt enhed» betyder i gatens formålsbeskrivelse: en kollegas maskine, ikke
en offentlig terminal. Med den læsning er der ikke noget at genetablere – kollegaen skal også bruge
programmet – og fundets præmis (at gaten lover noget, den ikke kan holde) falder bort.

Dette lukker samtidig et spor: **foreslå ikke en «Log ud» igen**, og læs ikke gatens formålssætning om
«utilsigtet klik-ind-adgang på en delt enhed» som et løfte om at kunne fjerne adgangen igen.

## Overvejet uden fund

- **Sideskift med en åben felteditor.** Skrevet `UAFSLUTTET` i Journalnr. uden at afslutte feltet,
  klikket `Satser` i menuen og derefter tilbage: værdien stod korrekt. Barrieren afslutter feltet
  FØR skiftet, som kontrakten kræver.
- **Blokeret `Gem` fra en anden side.** Afvist dato på Stamdata, gået til Satser, trykket `Gem`:
  programmet fører brugeren tilbage til Stamdata, fokuserer Skadedato og viser «Kan ikke gemme:
  Der er ugyldige felter …». Fungerer på tværs af sider.
- **`Gem` med et satsår uden for det dækkede interval** (1999). Blokerer IKKE – korrekt efter
  `form-contract` §1.6: en bounds-fejl på en ellers repræsenterbar værdi må gemmes. Feltet bærer
  `aria-invalid`, og siden skriver «Vælg et gyldigt år for at se satserne». Dermed er det spor,
  STATUS lagde ud til denne flade, lukket.
- **Escape og backdrop-klik på `Slet alt`-bekræftelsen.** Begge lukker uden at slette, og fokus
  vender begge gange tilbage til `Slet alt`-knappen i menuen – også selv om menuknappen aldrig selv
  fik fokus ved klikket. Popup-fokus-restoren holder.
- **Fortryd/gentag efter et afsluttet felt.** Ctrl+Z ryddede feltet, Ctrl+Y satte det tilbage, og
  fokus landede begge gange på det felt, ændringen kom fra.
- **Fortryd, når der intet er at fortryde.** Tavs. Acceptabelt i sig selv – men se BB-054, hvor
  tavsheden ikke kan skelnes fra «virker ikke her».
- **Annulleret filvælger.** Programmet er tavs og sætter fokus tilbage. Rigtigt: en annullering er
  ikke noget, brugeren skal kvitteres for.
- **Sidemenuens sammenfoldede tilstand.** Labels forsvinder, tooltips træder til, ikonaksen holder,
  og den aktive side er stadig markeret. Tilstanden huskes i fanen. Ingen indvending.
- **Menuens tilgængelige navne.** Alle fjorten knapper har fast `aria-label`, også når labelen er
  skjult. `Fold menuen ud`/`Fold menuen sammen` følger tilstanden.
- **To faner er to sager.** Fane B åbner med en tom sag og deler ikke sagsdata med fane A. Det er
  den tilsigtede model. Kun filhåndtaget deles – se BB-049.
- **Klik på den side, man allerede står på.** Ingen navigation, ingen re-render, intet blink.
- **Beskedboksens fejlvariant.** Den blivende røde besked har lukkeknap, Escape og `role="alert"`
  som besluttet ved BF-062. Ikke genbesøgt.
- **Console.** Ingen `console.error` eller `console.warn` fra programmet under hele gennemgangen.
  De 97 fejl, der blev observeret undervejs, kom alle fra Vites HMR under en samtidig masseændring
  af filer i arbejdstræet og er ikke produktadfærd.

## Dækningshuller

- **Selve skrivningen til disk kan ikke afprøves headless.** `showSaveFilePicker` og
  `showOpenFilePicker` findes i den headless browser, men åbner ingen dialog, og kaldet falder
  tilbage som «brugeren annullerede». `Gem` til en fil, `Hent` fra en fil, overskrivnings- og
  preflight-dialogerne og filnavnsforslaget er derfor **ikke** set i drift. BB-049's mekanisme er
  eftervist i sine to led – at IndexedDB deles mellem faner, og at sessionStorage ikke gør – men
  selve den forkerte overskrivning er udledt af koden, ikke målt. **Efter rettelsen (2026-08-19) står
  hullet stadig åbent:** identitetsprøven er mutationstestet i `fileSaveTarget.test.ts` (prøven sat til
  altid at acceptere ⇒ fire røde værn), men hverken fejlen eller rettelsen er set i en rigtig browser med
  rigtige filer. Den manuelle efterprøvning med to faner og to filer er derfor stadig den eneste
  bekræftelse, der mangler.
- **PWA-filåbning** (dobbeltklik på en `.eo`-fil) kræver et installeret program og kan ikke
  fremkaldes i Playwright. Dialogen «En anden fil er klar til at blive indlæst» er ikke set.
- **Lazy-chunk-recovery og devtools-notitsen** kræver hver sin kunstige fejltilstand og er ikke
  fremprovokeret.
- **Kun Chrome.** Fokus- og Tab-adfærd (BB-051) kan afvige i WebKit og Firefox. Fundet er
  strukturelt – `Container` cirkulerer inden for sit eget indhold – så det forventes ens, men det
  er ikke målt. Efter afvisningen af BB-051 er forholdet ikke længere en mangel, så hullet lukkes
  uden yderligere måling.
- **Rettelserne til BB-050, BB-053 og BB-054 er målt i jsdom, ikke i en browser.** De tre hviler på
  DOM-tilstand (`hasOpenOverlay()`), komponent-identitet og `defaultPrevented`, som jsdom gengiver
  troværdigt – i modsætning til tab-fangst, som kontrakten udtrykkeligt kræver målt i e2e. Selve den
  BROWSER-adfærd, BB-054 frigiver (at Ctrl+Z fortryder tegn i et åbent felt, når Mineo ikke spærrer
  tasten), kan derimod pr. konstruktion ikke måles i jsdom, som ikke har en tekstfortrydelse. Den bør
  bekræftes manuelt i Chrome.

## Åbne spørgsmål

- **Skal Ctrl+S kunne ses nogen steder?** Genvejen findes og er den eneste tastaturvej til `Gem`,
  men den står ikke nævnt i menuen, i en tooltip eller på Om-siden. Skal den frem – fx som
  «Gem (Ctrl+S)» i menuens tooltip – eller er den bevidst en genvej for dem, der prøver den?
  (Spørgsmålet er skærpet af BB-051's afvisning: `Hent` og `Slet alt` har ingen genveje, og det er nu
  afgjort som acceptabelt. Ctrl+S er dermed den ENESTE tastaturvej til nogen af de tre filhandlinger.)

  **BESVARET OG LUKKET 2026-08-25: nej – genvejen forbliver skjult.** Den er der for dem, der prøver
  den, ikke som en oplyst funktion, og asymmetrien over for `Hent` og `Slet alt` er accepteret. Ingen
  kodeændring – den nuværende tavshed ER afgørelsen. Normativ i `keyboard-navigation.md` under
  «`Ctrl+S` annonceres ikke i brugerfladen», så en «hjælpsom» tooltip ikke sniger sig ind senere.
- **Hvad skal `Gem` gøre, når skadelidtes navn rettes efter et gem?** I dag afgør Skadelidtes navn,
  Skadestype og Skadedato, hvilken fil `Gem` skriver til. Retter brugeren en stavefejl i navnet
  efter at have gemt, åbner næste `Gem` filvælgeren med et NYT filnavn, og han ender med to filer
  for samme sag uden at få det at vide. Skal programmet i stedet spørge «Skal sagen gemmes i den
  hidtidige fil eller i en ny?» – eller er to filer det rigtige udfald? (Forholdet er udledt af
  koden; det kan ikke afprøves headless, jf. Dækningshuller.)

  **Uændret af BB-049's rettelse, men værd at kende sammenhængen:** de to forhold deler samme
  beslutningspunkt i `resolveSaveTarget`. BB-049 tilføjede en betingelse (håndtaget skal være fanens
  eget) og ændrede ikke den eksisterende (stamdatagrundlaget skal være uændret), som netop er den, der
  giver to filer ved en rettet stavefejl. Spørgsmålet står derfor åbent præcis som før – men et svar
  vil skulle skrives ind på samme sted og bør læse `persistence-contract.md` §5 først.

  **BESVARET OG LUKKET 2026-08-25: to filer er det rigtige udfald.** Filnavnet følger sagens egne
  oplysninger, og en fil skrevet under det gamle navn forbliver den, den var. Programmet skal derfor
  hverken spørge «hidtidig fil eller ny?» eller tavst skrive videre under et navn, der ikke længere
  passer til sagen. Ingen kodeændring – den nuværende adfærd ER afgørelsen. Normativ i
  `persistence-contract.md` §5 ved siden af BB-049's navneprøve, fordi de to regler bor i samme
  `resolveSaveTarget`-beslutning og ellers kan forveksles: navneprøven værner mod at skrive i en
  ANDEN fanes fil, mens denne regel siger, at et ændret filnavn i EGEN fane bevidst giver en ny fil.
  Med denne besvarelse har Global shell ingen åbne spørgsmål tilbage.

## Gennemført i kode (2026-08-19)

| Fund | Kode | Kontrakt | Værn |
|---|---|---|---|
| BB-049 | `utils/fileSaveTarget.ts` (`doesHandleMatchTabFilename` + forklarende `fallbackWarning`) | `persistence-contract.md` §5 | 5 prøver i `fileSaveTarget.test.ts`, 4 mutationstestet + 1 modprøve |
| BB-050 | `inputCore/react/useUndoRedoShortcuts.ts`, `components/layout/MainLayout.tsx` (`hasOpenOverlay()`, ingen `preventDefault()`) | `keyboard-navigation.md` §Overlay-adfærd | 2+2 prøver i `useUndoRedoShortcuts.test.tsx` og `MainLayout.shortcutsAndMessages.test.tsx`, alle mutationstestet, hver med modprøve |
| BB-053 | `components/layout/MainLayout.tsx` (besked-identitet som React-`key`, `presentOverlay` som ene kilde, id-betinget `onClose`) | `keyboard-navigation.md` §Escape/beskeder | 2 prøver i `MainLayout.shortcutsAndMessages.test.tsx`, mutationstestet |
| BB-054 (delvist) | `inputCore/react/useUndoRedoShortcuts.ts` (synkron `registry.getEditing()`, spærring fjernet) | samme som BB-050 | `MainLayout.undoRedoEditorGuard.test.tsx` (rettet påstand, begrundet) |
| BB-055 | `auth/auth.ts` (`trim()` i `hashPassword`) | `auth-gate-contract.md` §2.3 | 2 prøver i `auth.test.ts` (begge retninger) |
| BB-056 | `auth/auth.ts` (`AuthStorageUnavailableError`), `auth/LoginPage.tsx` (forgrening på typen) | `auth-gate-contract.md` §2.7 | 2 prøver i `LoginPage.test.tsx` + 4 i `auth.test.ts` |
| BB-057 | `components/system/PageNotFound.tsx` (ny), `App.tsx` (catch-all inde i shell-routen) | `app-shell-contract.md` §2.2 | 5 prøver i `PageNotFound.test.tsx`, heraf 3 strukturelle garantier |

Fuld vitest grøn efter rettelserne. `npm run lint` og `npm run check:types` grønne.
