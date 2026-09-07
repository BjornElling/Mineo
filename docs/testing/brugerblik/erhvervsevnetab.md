# Brugerblik – Erhvervsevnetab

- Rute/placering: `/erhvervsevnetab`
- Fladen tages **fane for fane** (fem faner). Dette dokument føres pr. fane.

Fanerækkefølge og status står i [STATUS.md](STATUS.md):
11a EET oplysninger · 11b Løbende ydelser · 11c Kapitalisering · 11d EET efter EAL · 11e Differencekrav.

---

# Fane 1 – EET oplysninger

- Gennemgået: 2026-08-31 · commit `3218c295`
- Afprøvet i: Chrome, lyst tema, 1536×864 (M-09 desuden målt ved 1244×620)

## Fladen kort

Fanen er programmets **indtastningsflade for hele Erhvervsevnetab**: den regner ikke selv, viser intet
resultat og har ingen downloadknap. Den har fire sektioner – «Grundlæggende oplysninger» (Beregningsdato
plus et betinget Køn-felt), «Arbejdsskadesikringsloven» (ASL-årsløn + afgørelsestabellen med otte
kolonner), «Erstatningsansvarsloven» (EAL-årsløn + EET %) og «Bemærk» (tre faste forbehold).

Alt, hvad de fire øvrige faner regner og trykker, kommer herfra. De to årslønsfelter deles med
Forsørgertab (M-26, afgjort). Fanen låner Skadedato og Fødselsdato fra Stamdata: Skadedato er gulv for
alle fem datofelter og bestemmer ASL-årslønnens maksimum, Fødselsdato bestemmer kapitaliseringsalderen.
Køn-feltet vises kun, når en af sagens datoer ligger før 01-03-2015.

**Fanens særkende, og kilden til fire af fundene:** den er den ENESTE af de fem faner uden en «Fejl og
advarsler»-boks. Alt, hvad programmet ved om, hvad der mangler, står på de faner brugeren ikke sidder på,
mens han taster.

## Fund

### BB-135 – Køn-fejlens link fører til den forkerte sektion

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-03 – `missing-koen` fører til «Grundlæggende oplysninger» med Køn-feltet som fokusmål i begge navigationstabeller
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `01-01-1970`, Skadedato `01-06-2010`.
  2. EET oplysninger: Beregningsdato `01-06-2014`, ASL-årsløn `400.000`, én afgørelsesrække med
     Afgørelsesdato `01-06-2012`, Virkningsdato `01-01-2012`, EET % `25`, Endelig, Kap.dato `01-06-2012`,
     Kap. % `25`. Lad **Køn** stå tom.
  3. Gå til Kapitalisering og klik linket i «Fejl og advarsler».
- **Det sker:** Boksen skriver «Ved kapitalisering før 1. marts 2015 skal køn angives» med linket
  «EET oplysninger → **Arbejdsskadesikringsloven**». Klikket skifter fane og blinkmarkerer
  `eet-oplysninger-asl` (målt: klassen `mineo-field-attention-blink` på ASL-boksen, top y = 433).
  Køn-dropdownen står i «Grundlæggende oplysninger» (top y = 157) – **276 px længere op, umarkeret**, og
  intet element får fokus (`document.activeElement` = `BODY`).
- **Det er uhensigtsmæssigt fordi:** brugeren bliver ført til den forkerte af fanens fire bokse og får
  en blinkmarkering, der peger på en boks uden det felt, beskeden handler om. ASL-boksen indeholder
  årslønnen og en tabel med otte kolonner – det er dér han begynder at lede. Fejlen er den samme form som
  EO's «Der er ikke angivet nogen TAF-periode», som `ASL_FIRST_ROW_FIELD_BY_ISSUE_ID` blev bygget for at
  løse.
- **Bedre ville være:** `missing-koen` føres til «Grundlæggende oplysninger» og får Køn-feltet som
  fokusmål, så linket læser «EET oplysninger → Grundlæggende oplysninger» og fokus lander i dropdownen.
  Mekanismen findes allerede (`GRUNDLAEGGENDE_FIELD_BY_ISSUE_ID`).
- **Andre steder det kan gælde:** **den forkerte henvisning står to steder** –
  `eetFormatUtils.ts`' `ASL_IDS` (fanens egen boks) og `eetIssueNavigation.ts`'
  `EET_SECTION_ID_BY_ISSUE_ID` (EO's Beregning-fane). De to tabeller er bevidst adskilt af en
  domænegrænse, men de kan drifte fra hinanden; her er de enige om det forkerte. Kør samme kontrol for de
  øvrige 40+ id'er: sammenlign hvert id's sektion med den sektion, feltet faktisk står i.

**Tilbagemelding**
Enig

### BB-136 – Samme manglende Køn giver to forskellige fejlsætninger på samme skærm

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-03 – én delt `MISSING_KOEN_ISSUE` for alle fire producenter
- **Sådan fremprovokeres det:** samme sag som BB-135; gå til **Differencekrav**.
- **Det sker:** «Fejl og advarsler» viser to linjer over hinanden om det samme tomme felt:
  «Ved **kapitalisering** før 1. marts 2015 skal køn angives» og
  «Ved **beregning** før 1. marts 2015 skal køn angives». Begge har samme (forkerte, jf. BB-135) link.
  Ét valg i Køn-dropdownen fjerner dem begge.
- **Det er uhensigtsmæssigt fordi:** to fejl læses som to problemer. Brugeren, der retter «kapitalisering»,
  forventer at den anden linje bliver stående og handler om noget andet – og går videre på et forkert spor.
  Det er præcis prøvekatalogets A5-punkt om to formuleringer for én brudt regel.
- **Bedre ville være:** én besked for det tomme Køn-felt («Køn skal angives, når en af sagens datoer
  ligger før 1. marts 2015») uanset hvilken af de to beregninger der udløser den.
- **Andre steder det kan gælde:** de øvrige `missing-*`-id'er, der produceres af både
  `eetKapitaliseringCalculation.ts` og `eetDifferencekravCalculation.ts` med hver sin ordlyd.

**Tilbagemelding**
Enig

### BB-137 – Rækken «Køn» siger ikke, hvis køn den spørger om

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** Afvist for Erhvervsevnetab 2026-09-03 – hele fladen omhandler skadelidte. Forsørgertabs ASL-halvdel er derimod rettet, se nedenfor
- **Sådan fremprovokeres det:** sæt en dato før 01-03-2015 (fx Beregningsdato `01-01-2010`) og læs den
  række, der dukker op i «Grundlæggende oplysninger».
- **Det sker:** rækken heder «Køn». Informationsikonet ved siden af siger «Før 01-03-2015 beroede
  kapitalfaktorer på **skadelidtes** køn» – programmet ved altså godt, hvis køn det er, og siger det ét
  klik væk. Samme bare «Køn» står i differencekravs to bokse (`EetProformaKapitaliseringBox`,
  `EetMerErstatningPensionsalderBox`), i kapitaliseringsspecifikationen (`eetKapitaliseringRows.ts`) og to
  steder i differencekravdokumentet.
- **Det er uhensigtsmæssigt fordi:** **det er BB-134 igen, på den flade rettelsen ikke nåede.** Forsørgertab
  havde ordret samme række, udvikleren afgjorde 2026-08-27 at det er *skadelidtes* køn, og rækken heder nu
  «Skadelidtes køn» på skærm og i dokument. På en EET-sag med en efterladt-tabel én fane væk er
  tvetydigheden den samme som den, afgørelsen fjernede.
- **Bedre ville være:** «Skadelidtes køn» på skærmen, i de to differencekrav-bokse og i begge
  dokumentgeneratorer – samme ordlyd som Forsørgertab fik.
- **Andre steder det kan gælde:** `ForsoergertabAslSection.tsx:191` og `forsoergertabDocument.ts:348`
  skriver stadig bare «Køn» (ASL-halvdelen af Forsørgertab); descriptorernes egne `label` er «Køn» i både
  `erhvervsevnetabDescriptors.ts:136` og `forsoergertabDescriptors.ts:134`, og det er den label,
  oplæsningen og fejlteksterne bruger. BB-134's rettelse ramte to af otte steder.

**Tilbagemelding**
Det er kun forsørgertab, der sammenblander skadelidtes forhold med andres. Det er unikt for forsørgertab. Alle andre sider, inklusiv erhvervsevnetab, omhandler udelukkende om skadelidtes forhold - så det vil være oplagt og velkendt for brugerne, at der er tale om skadelidtes køn.

### BB-138 – Beregningsdatoens nedre grænse siger ikke, at den kommer fra Skadedato – fire datoer længere ned gør

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-07--parvise-grænser-begge-felter-markeres-hver-med-sin-egen-udvej`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-03 – `minBoundKind: 'skadedato'` på begge fladers Beregningsdato
- **Sådan fremprovokeres det:**
  1. Stamdata: Skadedato `01-06-2018`.
  2. EET oplysninger: Beregningsdato `01-01-2016`. Læs tooltippen.
  3. Skriv derefter `01-01-2018` i tabellens Afgørelsesdato og læs den tooltip.
- **Det sker:** de to felter forklarer samme grænse på to måder, målt ordret:
  - Beregningsdato: «**Dato skal være mellem 01-06-2018 og 31-12-2026**»
  - Afgørelsesdato, Virkningsdato og Kap.dato: «**Datoen kan ikke være før skadedatoen (01-06-2018)**»

  Målt på tværs af programmet giver det tre forskellige svar for det samme felt på tre flader:
  Varige méns Beregningsdato siger «Datoen kan ikke være før skadedatoen (01-06-2018)», Forsørgertabs og
  Erhvervsevnetabs siger «Dato skal være mellem 01-06-2018 og 31-12-2026».
- **Det er uhensigtsmæssigt fordi:** `01-06-2018` er et tal uden afsender. Brugeren står på
  Erhvervsevnetab og skal gætte, at grænsen kommer fra et felt på **Stamdata** – en anden side. Fire
  felter ti centimeter længere ned på samme skærm fortæller det, og det gør forskellen til en
  selvmodsigelse man kan se uden at skifte side.
- **Bedre ville være:** Beregningsdatoens `special` sætter `minBoundKind: 'skadedato'` med
  `minBoundReferenceISO`, præcis som de fire tabelroller i samme fil gør 200 linjer længere ned. Så siger
  begge halvdele af fanen det samme, og teksten følger automatisk skadestypens navneregel
  («anmeldelsesdatoen» ved erhvervssygdom).
- **Andre steder det kan gælde:** `forsoergertabBeregningsdatoField` har samme mangel (målt).
  Mekanisk prøve for resten: `rg "minBoundKind" src/inputCore/catalog` – hvert datofelt, hvis `min`
  læser et andet felt uden at sætte `minBoundKind`, har samme hul.

**Tilbagemelding**
Enig

### BB-139 – En rød Skadedato slukker årslønnens maksimum og datoernes gulv, uden et ord

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-27--en-rød-værdi-på-en-anden-flade-slukker-en-regel-her`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-03 – ikke som en ny fritekstlinje, men som den fælles navigerbare stamdatarække over ASL-årslønnen
- **Sådan fremprovokeres det:**
  1. Stamdata: Skadedato `01-06-2018`. På EET: skriv `600000` i «Skadelidtes årsløn (efter ASL)» – rød,
     «kan ikke overstige maks årslønnen i skadesåret (527.000 kr.)».
  2. Gå til Stamdata og skriv `99-99-9999` i Skadedato (afvist råtekst, rødt felt).
  3. Tilbage på EET oplysninger: skriv `9999000` i samme årslønsfelt, og `01-01-2006` i Afgørelsesdato.
- **Det sker:** begge værdier accepteres. Årslønsfeltet står med **9.999.000 kr.**, neutral kant og ingen
  besked – det samme felt, der et minut før afviste `600.000`. Afgørelsesdatoen står med **01-01-2006**,
  tolv år før den skadedato brugeren selv har tastet, fordi gulvet tavst er faldet tilbage til
  `01-01-2005`. Fanen skriver intet: den har ingen «Fejl og advarsler»-boks, og ingen celle er rød. Kun de
  fire resultatfaner siger «Der er udfyldt en ugyldig værdi i feltet 'Skadedato'» med et Stamdata-link.
- **Det er uhensigtsmæssigt fordi:** fraværet af en rød kant er programmets måde at sige «det her er i
  orden». Her betyder det «reglen kunne ikke køres», og de to ser ens ud. Brugeren, der har tastet en
  skadedato og fået en tastefejl i den, indtaster hele fanen under en validering, der er slukket – og de
  værdier, han får accepteret, kan være en faktor 20 fra det tilladte. Rettes Skadedato senere, bliver
  felterne røde bagefter (målt), men da har han forlangt fanen for færdig.
- **Bedre ville være:** en oplysningslinje i «Grundlæggende oplysninger», der siger, at fanens grænser
  ikke kan afgøres, fordi Skadedato i Stamdata er ugyldig – samme form som de fire resultatfaners linje,
  med samme link. Alternativt: giv fanen den «Fejl og advarsler»-boks, de øvrige fire har (BB-142), så
  linjen har et sted at stå.
- **Andre steder det kan gælde:** `faellesAarsloen.aslAarsloen`s skadesårsregel er den samme descriptor på
  **Forsørgertab** og i EO, så samme slukning findes dér. Generelt: enhver validator, der læser
  `view.readCanonical` af et felt på en anden flade, og som returnerer `undefined` når læsningen er
  `undefined` – `rg "readCanonical\(stamdata" src/inputCore/catalog` er indgangen.

**Tilbagemelding**
Jeg er i tvivl om, hvorvidt jeg er enig. Det risikerer at tilføre mere visuelt rod at indføje nye linjer. Min forståelse er, at en ugyldig skadesdato vil få rød ring og blokere download, og når brugeren har udfyldt med en gyldig skadedato, vil der blive givet fejl i blandt andet årsløn-funktionen, hvis den er angivet højere end den tilladte max-årsløn i det pågældende år. Hvis det er tilfældet, virker det som et fornuftigt kompromis, herunder i forhold til brugervendt orientering.

### BB-140 – Sortering flytter dublet-fejlen til den anden række

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-03 – BEGGE dubletrækker markeres; se noten om udviklerens modargument nedenfor
- **Sådan fremprovokeres det:**
  1. Lav to afgørelsesrækker med samme Afgørelsesdato `01-06-2020` og samme Virkningsdato `01-01-2020`.
     Giv den ØVERSTE hele resten (EET % `25`, Endelig, Kap.dato `01-06-2020`, Kap. % `25`) og den nederste
     kun EET % `25`.
  2. Klik på kolonneoverskriften «FS tilbageholdt EET» (eller enhver anden overskrift, der bytter de to).
- **Det sker:** før klikket er det den **næsten tomme** række, der er rød med «Der er angivet to identiske
  afgørelser med samme afgørelsesdato og virkningsdato» på begge datoceller. Efter ét klik er det den
  **fuldt udfyldte** række, der er rød, og den tomme er ren. Målt før/efter:

  ```
  før:    01-06-2020 | 01-01-2020 | 25 | Endelig | 01-06-2020 | 25 |  | Nej
         !01-06-2020 |!01-01-2020 | 25 |         |            |    |  | Ja
  efter:  01-06-2020 | 01-01-2020 | 25 |         |            |    |  | Ja
         !01-06-2020 |!01-01-2020 | 25 | Endelig | 01-06-2020 | 25 |  | Nej
  ```
- **Det er uhensigtsmæssigt fordi:** markeringen udpeger «den række, du skal rette», og hvilken række det
  er, afhænger nu af en sortering, der intet har med sagen at gøre. Den nærliggende handling er at slette
  den røde række – og efter et sorteringsklik er den røde række den, der bærer hele kapitaliseringen.
  Dubletreglen læser rækkernes **committede rækkefølge** (`allRows.findIndex`), og sortering skriver netop
  den rækkefølge om.
- **Bedre ville være:** afgør dubletten på rækkens indhold i stedet for dens plads i listen – markér begge
  rækker (som M-07's regel forlanger for to felter, der tilsammen udløser en fejl), eller markér
  konsekvent den række, der kommer sidst efter afgørelses-/virkningsdato. Uanset valget må markeringen ikke
  kunne flyttes af en sortering.
- **Andre steder det kan gælde:** enhver kryds-række-regel, der bruger rækkeindeks frem for rækkeindhold.
  `rg "findIndex" src/domain` – i `eetAslAfgoerelser.ts` er `validateDuplicateAfgoerelse` den eneste;
  `sumPriorKapPct` bruger korrekt datoordenen (`compareAfgoerelseOrder`) og er upåvirket af sortering
  (efterprøvet).

**Tilbagemelding**
Ikke sikker på, om jeg er enig. Brugeren vil naturligt forvente, at det er række nr. to med identisk indhold, der er fejlen og skal rettes - ikke nødvendigvis den række med mindst indhold.

### BB-141 – Under 15 %-advarslen står ved EET %-cellen, men findes kun på en anden fane for Kap. %

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-03 – gul feltadvarsel på Kap. %-cellen efter udviklerens regel: kun første og/eller samlede kapitalisering under 15 %
- **Sådan fremprovokeres det:** i en afgørelsesrække med Endelig: sæt EET % `10` og Kap. % `10`.
- **Det sker:** EET %-cellen får den gule ramme (målt `rgb(245, 158, 11)`) med «Der kan ikke tilkendes
  erhvervsevnetab under 15 %». Kap. %-cellen står **neutral** (`rgba(0, 0, 0, 0.25)`) uden besked – og
  programmet har formuleret advarslen: den står på Kapitaliseringsfanen som «Der er angivet kapitalisering
  med mindre end 15 %».
- **Det er uhensigtsmæssigt fordi:** to nabo-celler, der udtrykker samme lovkrav, behandles forskelligt.
  Den ene siger det, mens brugeren står i cellen; den anden siger det på en fane, han måske først åbner
  til sidst. Advarslen afhænger kun af cellens egen værdi, så der er ingen grund til at flytte den væk.
- **Bedre ville være:** samme gule feltadvarsel på Kap. %-cellen, med samme ordlyd som fanens tekst.
  `resolveEetUnder15Warning` er allerede importeret i `EetAslAfgoerelserTable.tsx` og kaldes ét felt
  ved siden af.
- **Andre steder det kan gælde:** `rg "^  'warn-" src/domain/erhvervsevnetab` – hver `warn-*`-issue, som
  hænger på ét felts egen værdi, hører som feltadvarsel dér. Kandidater fra samme liste:
  `warn-afgoerelsesdato-after-beregningsdato`, `warn-virkningsdato-after-beregningsdato`,
  `warn-kap-dato-after-beregningsdato`.

**Tilbagemelding**
Delvist enig, men der er en særlig omstændighed, du mangler at have med i betragtningen. Det kan godt ske, at der er tale om flere afgørelser, hvor fx. den første giver 20 % EET, hvoraf alle 20 % kapitaliseres. Derefter træffes der senere ny afgørelse om forhøjelse af EET til 30 %, og da kapitaliseres de yderligere 10 %, i hvilket tilfælde det ikke vil være en fejl eller skulle give advarsler, at der kapitaliseres mindre end 15 %. Så der vil kun skulle vises advarsler for kapitaliseirng, når enten a) den første kapitalisering og/eller b) den samlede kapitalisering er under 15 %. Dette skal være det fælles udgangspunkt både for gul ring på siden og advarsel på fanen.

### BB-142 – Fanens egne mangler vises kun på de andre faner

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afvist af udvikleren 2026-09-03 – indtastningsfaner viser kun rød/gul ring med tooltip
- **Sådan fremprovokeres det:** samme sag som BB-135 (Køn tom, alt andet udfyldt). Bliv stående på
  «EET oplysninger» og se efter noget, der siger, at sagen ikke kan regnes.
- **Det sker:** ingenting. Køn-dropdownen er tom med **neutral** kant (målt `rgba(0, 0, 0, 0.12)`), ingen
  tooltip, ingen besked, og fanen har ingen «Fejl og advarsler»-boks. De fire øvrige faner har boksen, og
  to af dem melder, at beregningen ikke kan gennemføres uden Køn. Samme gælder de øvrige rene mangler –
  tom afgørelsestabel, manglende afgørelsestype, manglende ASL-årsløn: de har intet rødt felt og vises
  derfor kun andre steder.
- **Det er uhensigtsmæssigt fordi:** indtastningsfanen er den, brugeren arbejder på, og den er den eneste,
  der ikke fortæller, hvad der mangler. Han udfylder fanen, får ingen indvending, og opdager først på en
  af de fire resultatfaner, at han skal tilbage. Alle links i de fire bokse peger netop hertil – boksen
  mangler dér, hvor rettelsen skal udføres.
- **Bedre ville være:** samme «Fejl og advarsler»-boks øverst på EET oplysninger som på de fire øvrige
  faner, med samme sektionslink (som da også ville pege det rigtige sted efter BB-135). De issues, der
  ALLEREDE har et rødt felt på fanen, kan udelades, så boksen kun bærer de mangler, brugeren ellers ikke
  kan se.
- **Andre steder det kan gælde:** Erstatningsopgørelsens indtastningsfaner (EO-oplysninger, Lønindkomst,
  Offentlige ydelser) mod dens Beregning-fane – samme opdeling i «faner man taster på» og «faner der
  klager». Hører til flade 12.

**Tilbagemelding**
Jeg afviser fundet. EET-siden med indtastningsfelter skal kun vise fejl i faktisk foretagne indtastninger, dvs. med rød eller gul ring og tooltip. Det er kun på undersiderne, der skal vises tekster med fejlbeskrivelser. Dette er et bevidst designvalg.

### BB-143 – To felter, der begge heder «EET %», behandler 0 modsat

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Mellem
- **Beslutning:** Afvist af udvikleren 2026-09-03 – 0 i et procentfelt betyder ikke-udfyldt overalt i programmet
- **Sådan fremprovokeres det:** skriv `0` i «EET % (hvis afviger fra ASL)» og Enter. Skriv derefter `0` i
  tabellens «EET %» og Enter.
- **Det sker:** i EAL-feltet **forsvinder tallet**: feltet står tomt bagefter, uden rød kant og uden
  besked (målt: `val = ""`). I tabelcellen bliver `0` stående, rødt, med «EET % må ikke være 0 %.»
  (målt: `aria-invalid = true`).
- **Det er uhensigtsmæssigt fordi:** de to felter bærer samme navn på samme skærm, og samme tastetryk
  giver modsatte svar – det ene sletter hvad brugeren skrev uden at sige det, det andet kalder det en
  fejl. Brugeren, der taster `0` i EAL-feltet for at udtrykke «ingen afvigelse», kan ikke se, om
  programmet forstod ham eller bare kastede tallet væk.
- **Bedre ville være:** feltet siger, hvad det gjorde. Descriptorens semantik («0 betyder ingen
  afvigelse, og gemmes som tomt») er en truffet beslutning, men den skal være synlig: fx en gul
  feltadvarsel «0 % betyder ingen afvigelse fra ASL – feltet er derfor tomt» ved settle, eller at feltet
  beholder `0` og behandler det som tomt indvendigt.
- **Andre steder det kan gælde:** `rg "value === 0" src/inputCore/catalog` – hvert codec, der
  canonicaliserer en indtastet værdi til `undefined`. Ved samme lejlighed: findes der andre felter, hvor
  én af de to «EET %» kan stå med en værdi, som den anden ville afvise?

**Tilbagemelding**
Jeg afviser fundet. Der er rigtig mange steder i programmet, hvor 0 i et procentfelt skal betragtes som ikke-udfyldt. Det vil skabe unødvendig kompleksitet for en meget lille gevinst, hvis vi begynder at ændre på det.

### BB-144 – Grænseteksten annoncerer 0 som en tilladt procent, som en anden regel forbyder

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 – «Erhvervsevnetabet skal være mellem 5 og 100» på begge EET %-felter
- **Sådan fremprovokeres det:** skriv `101` i tabellens «EET %», læs tooltippen. Skriv derefter `0`, og
  derefter `7`.
- **Det sker:** tre svar for det samme felt: «**Procent skal være mellem 0 og 100**», «EET % må ikke være
  0 %.» og «EET % skal være deleligt med 5.» Grænseteksten oplyser altså et interval, hvis nedre endepunkt
  er den ene værdi feltet med sikkerhed afviser, og den nævner ikke femtrinnene. Samme tekst står på
  Kap. % (hvor loftet reelt er 50) og på EAL'ens EET %.
- **Det er uhensigtsmæssigt fordi:** brugeren læser grænsen som feltets regel og skal derfor fejle to
  gange mere for at finde den rigtige. Den generiske tekst er også den ENESTE af feltets tre beskeder, der
  ikke nævner feltets navn.
- **Bedre ville være:** lad bounds-teksten udtrykke den reelle grænse for netop dette felt, fx «EET % skal
  være mellem 5 og 100 og deleligt med 5». Er den fælles tekst svær at gøre feltspecifik, er alternativet
  at flytte femtrins- og nul-reglen ind i grænsen, så der kun er ét udsagn.
- **Andre steder det kan gælde:** `percentBoundsValidator` bruges af alle procentfelter i programmet;
  overalt hvor et procentfelt har en yderligere regel, står den generiske tekst ved siden af den skarpe.
  EO's og Årsløns procentfelter er de næste kandidater.

**Tilbagemelding**
Jeg er enig - grænseteksten bør lyde på, at erhvervsevnetabet skal være mellem 5 og 100.

### BB-145 – Kap.dato, tidl. kap.dato og Kap. % hedder noget andet i deres egne fejlbeskeder

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Lav
- **Beslutning:** Afvist af udvikleren 2026-09-03 – tabeloverskrifter er forkortet af pladshensyn; henvisende prosa bruger det fulde navn
- **Sådan fremprovokeres det:** i en afgørelsesrække: `31-12-2099` i Kap.dato; `01-07-2012` i
  «Hvis genopt. - tidl. kap.dato» (med Afgørelsesdato `01-06-2012` og en Kap.dato udfyldt); `55` i Kap. %;
  skift derefter Afgørelsestype til Midlertidig.
- **Det sker:** fire beskeder navngiver tre kolonner med tre andre ord end de bærer:
  - «**Kapitaliseringsdato** kan senest være 31. december 2026» – kolonnen heder «Kap.dato»
  - «**Kapitaliseringsdato** må kun udfyldes ved endelig eller delvist endelig afgørelsestype.»
  - «**Tidl. kap.dato** skal være før afgørelsesdatoen (01-06-2012)» – kolonnen heder
    «Hvis genopt. - tidl. kap.dato»
  - «**Kapitaliseringsprocent** kan ikke overstige 50 % (inkl. tidligere kapitaliseringsprocenter).» –
    kolonnen heder «Kap. %»
- **Det er uhensigtsmæssigt fordi:** det er BB-120's prøve, der rammer igen. Brugeren med otte kolonner
  foran sig skal oversætte «Kapitaliseringsprocent» til «Kap. %» selv, og i en tabel med både Kap.dato og
  tidl. kap.dato er «Kapitaliseringsdato» ikke entydigt.
- **Bedre ville være:** beskederne bruger kolonnens eget navn. Fire steder: `maxBoundFieldLabel:
  'Kapitaliseringsdato'` og `'Tidl. kap.dato'` i `erhvervsevnetabDescriptors.ts`, den hardkodede
  «Tidl. kap.dato» i `dateRangeErrorMessages.ts`' `foerAfgoerelsesdato`-gren, og de to prosa-beskeder i
  `eetAslAfgoerelser.ts`.
- **Andre steder det kan gælde:** BB-120's mekaniske prøve er kørt for hele kataloget
  (`rg "maxBoundFieldLabel|minBoundLabel" src/inputCore/catalog`): de to EET-træf ovenfor er de eneste
  tilbageværende afvigelser fra descriptorens `label`. Prosa-beskederne er ikke dækket af den prøve –
  `rg "Kapitaliserings|Afgørelses" src/domain/erhvervsevnetab` er indgangen til dem.

**Tilbagemelding**
Jeg hælder mod at afvise fundet. I tabeloverskrifterne er visse ord forkortet af pladshensyn. Andre steder i programmet henvises der til disse med deres fulde navn. Det forekommer at være en god og ønskværdig adfærd, som ikke bør ændres. Det vil være mærkeligt at bruge en forkortelse i de henvisende prosatekster.

### BB-146 – Beregningsdatoens to grænser skrives i to datoformater

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 – `dd-mm-åååå` i begge grænsebeskeder
- **Sådan fremprovokeres det:** skriv `31-12-2099` i Beregningsdato, læs tooltippen. Skriv derefter
  `01-01-2004`.
- **Det sker:** øvre grænse: «Beregningsdato kan senest være **31. december 2026**». Nedre grænse: «Dato
  skal være mellem 01-01-2005 og **31-12-2026**». Samme dato, samme felt, to formater – i to tooltips man
  får ét tastetryk fra hinanden.
- **Det er uhensigtsmæssigt fordi:** det er M-13's formprøve inden for ét felt (BB-079's form). Skærmens
  eget format er `dd-mm-åååå`, så langformen er afviger.
- **Bedre ville være:** samme form i begge grænsebeskeder – `dd-mm-åååå`, som feltet selv bruger og som
  pladsholderen lover.
- **Andre steder det kan gælde:** `eetDataMax`/`dataCoverageMax`-grenen i `dateRangeErrorMessages.ts`
  bruger langformen for alle felter i programmet; alle øvrige grene bruger `formatISOForTooltip`
  (`dd-mm-åååå`). Rettelsen er derfor ét sted og rammer Forsørgertab og EO med.

**Tilbagemelding**
Jeg er enig.

### BB-147 – «FS tilbageholdt EET = Ja» alene gør en tom række til en rigtig række, som beregningen ignorerer

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-16--en-komplet-række-programmet-ikke-vil-regne-på`
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 – et valg i en dropdown, der ikke kan være tom, gør ikke en række udfyldt; gennemført for både EET og renteberegning
- **Sådan fremprovokeres det:** sæt «FS tilbageholdt EET» til `Ja` i tabellens tomme indtastningsrække og
  rør ikke andet.
- **Det sker:** rækken bliver en rigtig række: tabellen går fra to til tre rækker (målt), rækken får en
  «Slet rækken»-knap, og den skrives i `.eo`-filen. Beregningen ser den derimod som tom: ingen «Fejl og
  advarsler» på nogen af de fire faner, og downloadknappen er aktiv (målt på en ellers fejlfri sag).
- **Det er uhensigtsmæssigt fordi:** programmet har to svar på «er der noget i denne række?», og de er
  uenige om præcis dette felt (`isAslAfgoerelseRowEmpty` ignorerer `fsTilbageholdtEet`,
  `isAslAfgoerelseRowPersistenceEmpty` gør ikke). Brugeren har svaret «ja» på et spørgsmål, programmet
  aldrig stiller igen: svaret gemmes, kommer tilbage efter Hent, og betyder ingenting. Havde han derimod
  skrevet en dato, ville rækken straks kræve resten.
- **Bedre ville være:** ét svar. Enten tæller dropdown-valget alene ikke som en indtastning (rækken bliver
  ikke oprettet og gemmes ikke), eller rækken behandles som enhver anden påbegyndt række og efterspørger
  sin afgørelsesdato.
- **Andre steder det kan gælde:** BB-098's prøve er den samme: find fladens tomheds-prædikater og hold dem
  op mod hinanden. Her afveg de på et **defaultet dropdown-valg** frem for på værdien 0. Kandidater:
  alle collections med et required-choice-felt – `rg "createRequiredChoiceFieldCodec" src/inputCore/catalog`.

**Tilbagemelding**
Jeg er enig i fundet, og vi havde samme forhold på renteberegning-siden, hvor det at vælge en anden værdi i dropdown for tillægstid også førte til, at rækken blev anset for udfyldt. Det skal være et generelt designprincip i hele programmet, at en linje ikke skal anses for udfyldt, hvis der udelukkende er sket ændring af en dropdown, forudsat at den pågældende dropdown er af typen, der ikke kan være tom. Er den pågældende dropdown af typen, der kan være tom, skal rækken betragtes som værende udfyldt, hvis brugeren har valgt en værdi.

### BB-148 – To nabo-celler beskriver samme regel med modsat fortegn

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 – samme sætningsform i alle TRE kapitaliseringsceller
- **Sådan fremprovokeres det:** udfyld en række med Endelig, Kap.dato og Kap. %, og skift derefter
  Afgørelsestype til `Midlertidig`.
- **Det sker:** de to celler bliver røde med hver sin formulering af samme regel:
  «**Kapitaliseringsdato må kun udfyldes ved** endelig eller delvist endelig afgørelsestype.» og
  «**Kapitaliseringsprocent må ikke udfyldes ved** midlertidig eller ikke-valgt afgørelsestype.»
- **Det er uhensigtsmæssigt fordi:** de står ved siden af hinanden, og den ene siger reglen forlæns og den
  anden baglæns. Brugeren skal læse to sætninger og selv se, at det er den samme.
- **Bedre ville være:** samme sætningsform i begge celler, fx «Kap.dato må kun udfyldes ved endelig eller
  delvist endelig afgørelsestype» / «Kap. % må kun udfyldes ved endelig eller delvist endelig
  afgørelsestype» (og dermed også BB-145's navne).
- **Andre steder det kan gælde:** de to konstanter står i samme fil (`eetAslAfgoerelser.ts`) og er de
  eneste af deres slags på fanen.

**Tilbagemelding**
Enig

### BB-149 – Køn-rækken skydes ind OVER det felt, der frembragte den

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 – Køn-rækken står efter Beregningsdato
- **Sådan fremprovokeres det:** stå med en tom sag, skriv `01-01-2010` i Beregningsdato og tryk Enter.
- **Det sker:** Køn-rækken dukker op som **første** række i «Grundlæggende oplysninger», altså over
  Beregningsdato, som derfor flytter en rækkehøjde ned – under musen, lige efter at brugeren har trykket
  Enter i den.
- **Det er uhensigtsmæssigt fordi:** det felt, brugeren netop arbejdede i, bevæger sig, og det nye felt
  overtager dets plads. Næste klik rammer et andet felt, end brugeren sigtede på. Rækkefølgen er også
  bagvendt at læse: forudsætningen (datoen) står under sin egen konsekvens (Køn).
- **Bedre ville være:** Køn-rækken placeres **efter** Beregningsdato, så det, der udløser den, står først,
  og ingen eksisterende række flytter sig.
- **Andre steder det kan gælde:** enhver betinget række, der renderes før sin udløser.
  `rg "&& \(" src/components/pages` over betingede rækker i en sektion – Differencekravs valgmuligheder er
  den nærmeste kandidat.

**Tilbagemelding**
Enig

### BB-150 – Et umuligt tidl. kap.dato meldes som irrelevant i stedet for ugyldigt

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afvist af udvikleren 2026-09-03 – oplysningen kan udledes af konteksten
- **Sådan fremprovokeres det:** skriv `31-12-2099` i «Hvis genopt. - tidl. kap.dato» i en række, hvor
  Kap.dato er tom.
- **Det sker:** cellen bliver rød med «**Kun relevant ved tidligere kapitalisering.**» Datoen ligger 73 år
  uden for feltets tilladte interval, og det står ingen steder. Samme besked kommer for en helt gyldig
  dato (`01-01-2018` gav ordret samme tekst).
- **Det er uhensigtsmæssigt fordi:** beskeden siger hverken hvad der er galt med datoen, eller hvilket
  felt der mangler. «Tidligere kapitalisering» er præcis det, brugeren tror han er ved at registrere –
  han kan ikke gætte, at programmet mener «rækken har ingen Kap.dato». To fejl er samlet i én tekst, og
  den ene af dem er usynlig.
- **Bedre ville være:** beskeden navngiver det felt, der mangler: «Udfyld Kap.dato først – tidl.
  kap.dato bruges kun ved genoptagelse af en tidligere kapitalisering.» Er datoen samtidig uden for
  intervallet, skal grænsefejlen være den, brugeren ser, eller nævnes i samme tekst.
- **Andre steder det kan gælde:** de øvrige `priority: 'context'`-validatorer, som pr. konstruktion
  vinder over bounds-fejlen: `rg "priority: 'context'" src/inputCore` – på denne fane er den anden
  forekomst `KAP_DATO_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE`, som gør det rigtigt (den navngiver både
  feltet og betingelsen).

**Tilbagemelding**
Jeg afviser fundet. Det er en unødvendig information. Brugeren kan uden vanskeligheder udlede informationen af konteksten.

### BB-151 – «Bemærk»-boksens handleanvisning står under det felt, den handler om

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afvist af udvikleren 2026-09-03 – «Bemærk» er en juridisk fodnote, ikke en handleanvisning
- **Sådan fremprovokeres det:** læs fanen fra top til bund.
- **Det sker:** nederst, efter alle fire sektioner, står «For skadelidte i fleksjob skal altid beregnes ny
  erhvervsevnetabsprocent efter EAL.» Det felt, sætningen beder om at få udfyldt – «EET % (hvis afviger
  fra ASL)» – står i sektionen ovenfor, og intet forbinder de to. De to øvrige linjer i boksen er
  forbehold om, hvad programmet ikke kan (tilskadekomstpension, den grønlandske ASL), altså noget helt
  andet end en handleanvisning.
- **Det er uhensigtsmæssigt fordi:** anvisningen kommer efter handlingen. Brugeren, der udfylder fanen
  oppefra, har passeret feltet, før han læser, at det skal udfyldes i hans sag – og boksen blander en
  instruktion sammen med to forbehold, så den læses som «generel information» og springes over.
- **Bedre ville være:** flyt fleksjob-linjen op i «Erstatningsansvarsloven» ved EET %-feltet (fx som
  informationsikon på rækken eller som en linje i sektionen), og lad «Bemærk» rumme de to forbehold om
  programmets begrænsninger alene.
- **Andre steder det kan gælde:** øvrige «Bemærk»-bokse, der blander handleanvisninger og forbehold.
  `rg "section-header\">Bemærk" src/components/pages`.

**Tilbagemelding**
Jeg afviser fundet. Bemærk-sektionen findes hovedsageligt som en juridisk ansvasrsfraskrivelse. Brugeren skal kende de pågældende forhold, så det skal alene betragtes som en juridisk fodnote for sikkerheds skyld.

## Overvejet uden fund

- **Køn-feltets synlighed er en ægte overmængde af behovet – ingen fund.** Feltet vises, når skadedato,
  beregningsdato eller en kapitaliseringsdato ligger før 01-03-2015. Køn *bruges* kun, når
  kapitaliseringstabellen er kønsopdelt, og det kræver, at bekendtgørelsen vælges på en skadedato før
  01-03-2015 – altså er skadedato-betingelsen alene nok. Konklusion: når køn ændrer et tal, står feltet på
  skærmen med sin værdi. Bemærk at `tidlKapDato` bevidst IKKE er med i betingelsen og heller ikke behøver
  det af samme grund.
- **En skjult Køn-værdi overlever og genindtræder synligt – ingen fund.** Målt: Køn `Kvinde` sat ved
  beregningsdato 2010, feltet skjult ved 2020, vist igen ved 2010 → værdien var uændret `Kvinde`. Værdien
  gik gennem et helt sessionsforløb (stamdataskift, faneskift, mange indtastninger) og stod stadig der.
  Det er den rigtige adfærd efter punkt 1 i prioriteringen (intet må forsvinde), og fordi feltet altid er
  synligt, når værdien betyder noget, ser brugeren den, inden den påvirker et tal.
- **M-20 er efterprøvet på fanens navngivne kandidat og BESTÅET.** BF-019's 15 %-advarsel læser feltets
  eget read, ikke projektionen: målt på en helt tom sag (efter «Slet alt») giver `10` i «EET % (hvis
  afviger fra ASL)» og `10` i tabellens «EET %» den gule ramme med det samme, uden at et andet felt er
  udfyldt. Projektionen er aldrig `blocked` (`erhvervsevnetabReaderProjection.ts`), så mønsterets
  betingelse findes ikke på fanen.
- **M-14/BB-118's prøve er efterprøvet på fanens tre kandidater og BESTÅET.** «551.000,00» i
  ASL-årslønnen giver `551.000` (ikke `5.510.000`), «400.000,00» giver `400.000`, og «15,00» i EET %
  giver `15`. Decimaldelen bevares i draften og afrundes ved settle efter feltets præcision, præcis som
  BB-118's rettelse foreskriver. `0,5` i EET % bliver `1` – synligt i feltet, og femtrinsreglen fanger det.
- **M-26 er efterprøvet og lukket for fanen.** De to årslønsfelter bærer nu de godkendte navne på skærmen
  («Skadelidtes årsløn (efter ASL)», «Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)»), og den
  gule maksimum-advarsel er den fælles konstant fra `aslAarsloenMaxNotice` (målt ordret: «Når Skadelidtes
  årsløn (efter ASL) svarer til maksimum, skal den faktiske årsløn indtastes.»). BB-123's koblingsdel er
  afvist og genrejses ikke.
- **BB-125's rettelse er i drift her.** Grænseteksten skriver dansk talformat og forklarer loftet:
  «Værdi skal være mellem 1.000 kr. og 9.999.999 kr.» og «Skadelidtes årsløn (efter ASL) kan ikke
  overstige maks årslønnen i skadesåret (527.000 kr.)».
- **M-09 er målt og BESTÅET.** Afgørelsestabellen er den bredeste kontrol på fanen (1097 px målt, erklæret
  1130 px). Ved 1536×864: ingen vandret scroll (`scrollWidth` = `innerWidth` = 1536), tabellens højre kant
  ved x = 1443. Ved 1244×620: arbejdsfladen zoomer til 0,79 og der er stadig ingen vandret scroll.
- **M-10 er uden genstand på fanen.** Nederste højre hjørne er «Bemærk»-boksen, som ikke har en eneste
  kontrol; tabellens højre kant (x = 1443) ligger uden for rul-til-toppen-knappens felt (x = 1450–1505).
- **Tab-ringen er komplet og i visuel rækkefølge.** Målt 26 tryk: Køn → Beregningsdato → «Indsæt dags
  dato» → ASL-årsløn → række 1's otte celler → række 2's otte celler → EAL-årsløn → EET % → tilbage til
  Køn. Ingen huller. «Slet rækken» er ikke i ringen, men den er kun synlig ved hover, og en række kan
  fjernes med tastaturet ved at tømme dens celler (BF-030) – med den undtagelse, at BB-147's
  dropdown-række kræver, at valget sættes tilbage til «Nej».
- **«Indsæt dags dato» er efterprøvet.** Knappen er aktiv (dags dato `31-08-2026` ligger inden for
  `31-12-2026`), indsætter `31-08-2026` uden fejl, og fokus bliver på knappen (BF-056).
- **Rækkesletning er fortrydelig.** «Slet rækken» sletter uden bekræftelsesdialog, men Ctrl+Z gendanner
  rækken med alle otte celler (målt ordret identisk). Ingen bekræftelse er derfor det rigtige valg.
- **Forudsætning ændret EFTER at afhængige felter er udfyldt – i orden.** Da Skadedato blev rettet fra
  `99-99-9999` tilbage til `01-06-2018`, blev både ASL-årslønnen (`9.999.000`) og Afgørelsesdatoen
  (`01-01-2006`) røde med konkrete beskeder. Der advares ikke i samme øjeblik, men brugeren står da på
  Stamdata, og de fire resultatfaner melder det.
- **Afgørelsestypens tre valg og de fem rækkeregler er efterprøvet med konkrete tal** og gav konkrete,
  handlingsanvisende beskeder: «Ved endelig afgørelse under 50 % skal samlet kapitaliseringsprocent …
  svare til EET %», «Angivelse af Kap. % skal ske med fradrag for tidligere kapitalisering.»,
  «Kapitaliseringsprocent kan ikke overstige 50 % …». Kun formen er påtalt (BB-145, BB-148).
- **Dubletreglen markerer begge datoceller i rækken** – M-07's dobbeltmarkering er på plads. Kun hvilken
  af de to rækker der markeres, er et fund (BB-140).
- **Sortering påvirker ikke beregningen.** `sumPriorKapPct` og de øvrige rækkefølgeafhængige regler
  sammenligner datoer (`compareAfgoerelseOrder`), ikke listeindeks; kun dubletreglen læser indeks.
- **M-22's prøve er uden genstand på fanen** – den har ingen downloadknap. Prøven hører på 11b–11e.
- **M-25's prøve er uden genstand på fanen** af samme grund; den hører på 11b–11e, hvor de fire
  dokumentgates ligger, og på differencekravs valgfri bilag.
- **M-23's prøve er uden genstand:** fanen har ingen `sum / enheder`-brøk. Afgørelsestabellen er en liste
  af afgørelser, ikke en periodetabel.
- **M-19's prøve er uden genstand:** fanen spejler ikke en eneste stamdataoplysning. Det er selv en del af
  BB-139 og BB-142.
- **Konsollen var tavs gennem hele kørslen:** 181 beskeder, 0 fejl, 0 advarsler.

## Dækningshuller

- Kun Chrome, lyst tema, 1536×864 (M-09 desuden 1244×620). Mørkt tema og de tre øvrige browsere er ikke
  målt.
- `Gem`/`Hent` er ikke afprøvet – filvælgeren kan ikke betjenes headless (samme hul som BB-049). BB-147's
  påstand om, at dropdown-rækken gemmes, hviler derfor på `isAslAfgoerelseRowPersistenceEmpty`, ikke på en
  målt fil.
- Dokumentindhold er ikke hentet på denne fane; den har ingen downloadknap. BB-137's dokumentdel hviler på
  kildelæsning af `eetKapitaliseringRows.ts` og `differencekravDocument.ts`.
- Escape-annullering, undo/redo af enkeltceller og «meget mange rækker» (B3) er ikke systematisk målt;
  kun rækkesletningens undo er.
- Kapitaliseringsfanens «Grundløn 367.000 kr.» mod en indtastet ASL-årsløn på 527.000 kr. er set, men
  ikke undersøgt – det hører til fane 11c.

## Åbne spørgsmål

- **Skal «Bemærk»-boksens to forbehold også stå i de fire dokumenter?** Skærmen fortæller, at programmet
  ikke kan tage højde for tilskadekomstpension til tidligere tjenestemænd, og ikke kan regne efter den
  grønlandske arbejdsskadesikringslov. Ingen af de fire EET-dokumenter nævner det, og det er dokumenterne,
  modparten læser. Efter BB-122's rettelse på Forsørgertab er formen et fund; efter BB-131's og BB-094's
  afvisninger kan svaret lige så godt være, at målgruppen kender begrænsningerne. Spørgsmålet er derfor
  ikke registreret som fund: **skal forbeholdene med i dokumenterne, eller er de alene en oplysning til
  den, der taster?**

**Tilbagemelding**
Nej, der er tale om en rent praktisk information til brugeren, mens vedkommende indtaster. Brugeren skal vide disse forhold i forvejen, så det har alene karakter af en påmindelse. Den skal ikke indgå i dokumenterne.

**Afgjort 2026-09-03.** Ingen kodeændring. Forbeholdene forbliver en påmindelse til den, der taster, og skrives
ikke i de fire EET-dokumenter. Spørgsmålet er dermed lukket og genrejses ikke – det er samme udfald som
BB-131's og BB-094's afvisninger og hviler på samme præmis: målgruppen kender begrænsningerne i forvejen.

## Gennemført i kode – 2026-09-03

**Alle 17 fund er afgjort:** elleve implementeret, seks afvist. Fire forhold rækker ud over det enkelte fund
og er værd at kende, før nogen genlæser afsnittet ovenfor.

**1. BB-140 kunne ikke implementeres som udvikleren beskrev den, og udfaldet er bedre.** Tilbagemeldingen var,
at «brugeren vil naturligt forvente, at det er række nr. to med identisk indhold, der er fejlen». Det kan
programmet ikke afgøre pålideligt: «nr. to» er en plads i en liste, og et klik på en kolonneoverskrift skriver
netop den liste om – det var selve fundet. Der findes ingen anden stabil identitet at hænge «nr. to» på, fordi
de to rækkers datoer pr. definition er ens. **Løsningen er derfor, at BEGGE dubletrækker markeres**
(`validateDuplicateAfgoerelse` returnerer nu beskeden for enhver række med en tvilling, uanset plads). Det er
samme form som M-07's regel for to felter, der tilsammen udløser én fejl, og markeringen kan ikke længere
flyttes af en sortering. Prisen er, at brugeren selv vælger, hvilken af de to identiske rækker han sletter –
men de er identiske på netop de felter, reglen handler om.

**2. BB-137 er afvist for Erhvervsevnetab, men tilbagemeldingens egen begrundelse rettede Forsørgertab.**
Udvikleren skrev, at «det er kun forsørgertab, der sammenblander skadelidtes forhold med andres». Netop dér
stod to visningssteder tilbage med et bart «Køn» efter BB-134: ASL-halvdelens forudsætningsrække på skærmen
(`ForsoergertabAslSection.tsx`) og den tilsvarende linje i dokumentet (`forsoergertabDocument.ts`) – på en
flade, hvis anden halvdel har en efterladt-tabel. Begge siger nu «Skadelidtes køn», og ordlyden er samlet i
`FORSOERGERTAB_SKADELIDTES_KOEN_LABEL`, som også er blevet feltets `label`, så fejltekster og oplæsning bruger
samme navn. Erhvervsevnetab beholder «Køn» efter afgørelsen. **BB-134's lære gentog sig præcist:** en godkendt
ordlyd skal søges som begreb, ikke som streng – rettelsen ramte igen kun de steder, nogen huskede.

**3. BB-148's rettelse dækker tre celler, ikke to.** Fundet navngav Kap.dato og Kap. %. Ved siden af dem stod
en tredje af samme slags, som fundet ikke så: «Tidligere kapitaliseringsdato **må ikke udfyldes ved**
midlertidig eller ikke-valgt afgørelsestype.» Alle tre siger nu reglen forlæns
(`TIDL_KAP_DATO_NOT_ALLOWED_BY_AFGOERELSE_TYPE_MESSAGE`). Navnene er de fulde, jf. BB-145's afvisning.

**4. BB-139 og BB-142 er afgjort hver sin vej, og grænsen mellem dem står nu i kontrakten.** BB-142's
afvisning fastlægger, at indtastningsfaner kun viser fejl som rød eller gul ring med tooltip. BB-139's
rettelse er en tekstlinje på samme fane – men ikke fanens egen fejl: det er den fælles, navigerbare
«Ugyldig værdi (ret i Stamdata)»-række for en FREMMED forudsætning, som brugeren ikke kan rette her, og som
gør fanens egne regler tavse. Undtagelsen er skrevet ind i `error-contract.md` §3.1 pkt. 3, så den ikke kan
læses som en generel åbning for fritekstfejl på indtastningsflader.

---

# Fane 2 – Løbende ydelser

- Gennemgået: 2026-08-31 · commit `35c0fce4`
- Afprøvet i: Chrome, lyst tema, 1536×864

## Fladen kort

Fanen er den **første af Erhvervsevnetabs fire resultatfaner** og den eneste, der viser et faktisk krav
fordelt over tid. Den har to egne kontroller – togglen «Medtag udvidet specifikation i Word/PDF» og
downloadknappen – og alt andet er visning af det, fane 1 er tastet med.

Strukturen er: en «Fejl og advarsler»-boks (fælles `EetIssuesBox`), en «Beregning»-boks med
beregningsdato + toggle + download, **én boks pr. afgørelse** (Type, EET %, evt. kapitalisering, årsløn,
Periodeafgrænsning med fem datolinjer, og tabellen «Beregnede ydelser» med syv kolonner og en I alt-række),
og til sidst boksen «Udvidet specifikation» (årsløn, grundløn, ydelsesniveau, og grundydelsesformlen pr.
afgørelse).

**Fanens særkende, og kilden til seks af fundene:** den producerer et **dokument, der skal kunne
efterregnes af modparten**, og den er den eneste flade i Mineo, hvor beregningen splitter én afgørelse i
delperioder efter skæringsdatoer, kapitaliseringsdatoer og satsår. De delegrænser er det, motoren regner
efter – og de står hverken på skærmen eller i dokumentet.

**Beregningsformlerne selv er kontrolregnet og er i orden.** Efterregnet i browseren på en sag med
skadedato `01-06-2018`, fødselsdato `01-01-1970`, ASL-årsløn `400.000` og beregningsdato `01-07-2026`:
grundløn `400.000 × 367.000/527.000 = 278.558`, grundydelse `278.558 × 25 % × 83 % × 92 % = 53.176,72`,
2024-opregulering `53.176,72 × 1,657 = 88.113,83`, hver af de syv periodelinjer (fx `2020`:
`53.176,72 × 1,501 = 79.818,26` → oprundet til `79.824` → `/12 = 6.652` → `× 12 mdr. = 79.824`),
brøkmåneden `01-01-2026`–`01-07-2026` = `6,0323` og sammentællingen `557.208 kr.` **Ingen af de fjorten
fund handler om et forkert tal** – BB-160 handler om et regnestykke, der er skrevet forkert ned i
dokumentet, mens beløbet er rigtigt.

## Fund

### BB-152 – Overlapperioden regnes med en anden procent end afgørelsens, og intet siger det

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-01 – skæringsdato og difference navngives i en note over tabellen
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `01-01-1970`, Skadedato `01-06-2018`.
  2. EET oplysninger: Beregningsdato `01-07-2026`, ASL-årsløn `400.000`.
  3. Række 1: Afgørelsesdato `01-06-2020`, Virkningsdato `01-01-2020`, EET % `25`, Midlertidig.
  4. Række 2: Afgørelsesdato `01-06-2022`, Virkningsdato `01-01-2022`, EET % `30`, Midlertidig.
  5. Løbende ydelser: læs boksen «Afgørelse 1. juni 2022 (30 %)».
- **Det sker:** tabellens første række er regnet med **5 %**, resten med 30 %, målt ordret:

  ```
  01-01-2022 | 30-06-2022 | 6,0000 | 10.635,34 kr. | + 55,4 % | 1.378 kr. |  8.268 kr.
  01-07-2022 | 31-12-2022 | 6,0000 | 63.812,07 kr. | + 55,4 % | 8.264 kr. | 49.584 kr.
  ```

  `10.635,34` er `278.558 × 5 % × 83 % × 92 %`. De 5 % er `30 % − 25 %`: den tidligere afgørelse blev
  fortsat udbetalt i det halve år, der ligger før skæringsdatoen `01-07-2022`, så den nye afgørelse kun
  giver differencen. Boksens overskrift siger «(30 %)», rækken «Erhvervsevnetab» siger «30 %», og
  «Udvidet specifikation» viser kun grundydelsen for 30 % (`63.812,07 kr.`). Skæringsdatoen `01-07-2022`
  står ingen steder.
- **Det er uhensigtsmæssigt fordi:** hele fanens formål er en specifikation, modparten kan efterregne.
  Her står en linje på 10.635,34 kr. i et dokument om en 30 %-afgørelse, hvor de øvrige linjer er seks
  gange større, og der findes ikke ét tal på siden, differencen kan udledes af. Læseren – og brugeren
  selv, dagen efter – kan kun konkludere, at der er en fejl. Det er dét, prøvekatalogets A8 spørger om:
  det værste, der kan ske, uden at brugeren opdager det.
- **Bedre ville være:** navngiv overlappet dér, hvor det sker. Programmet har allerede tallene:
  `skaeringsDato` og `harOverlap` ligger i `EetLoebendeAfgoerelseComputation` og bruges **ingen steder**
  (`rg "skaeringsDato|harOverlap" src/` giver kun domænemodulet selv). Fx en linje i
  Periodeafgrænsningen – «Afløser tidligere afgørelse fra 01-07-2022» – og en note over tabellen:
  «Frem til 01-07-2022 udbetales den tidligere afgørelse fortsat; perioden er derfor regnet med
  30 % − 25 % = 5 %.»
- **Andre steder det kan gælde:** samme mekanik ejer BB-153 og BB-165. Generelt: et felt, der ligger i
  et kanonisk beregningsoutput og aldrig renderes, er en kandidat – `harOverlap` og `skaeringsDato` er
  de to eneste i dette schema.

**Tilbagemelding**
Enig

### BB-153 – Når overlappet giver 0 kr., begynder tabellen efter afgørelsens egen virkningsdato

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-01 – samme note dækker den delvist tomme afgørelse
- **Sådan fremprovokeres det:** samme sag som BB-152, men giv **række 2 samme EET % som række 1** (`25`).
- **Det sker:** boksen «Afgørelse 1. juni 2022 (25 %)» skriver «Virkningsdato **01-01-2022**» i
  Periodeafgrænsningen, og tabellens første række begynder **01-07-2022**. Det halve år derimellem er
  hverken en række, en note eller en tom celle – det findes ikke. Årsagen er, at overlappet giver
  `25 % − 25 % = 0 %` og dermed `0 kr.`, og motoren udelader perioder med `0 kr.`
  (`eetLoebendeYdelserCalculation.ts:913`, med kommentaren «Tabellerne på siden og i PDF'en viser kun
  perioder med et faktisk krav»).
- **Det er uhensigtsmæssigt fordi:** to udsagn i samme boks er uenige om, hvornår ydelsen begynder, og
  det uenige halvår er præcis det, brugeren ville lede efter, hvis han sammenlignede med
  udbetalingsbilagene. Fraværet ser ud som et hul i beregningen, ikke som en oplysning om, at kravet
  ligger på den tidligere afgørelse.
- **Bedre ville være:** en linje, der siger, hvad der skete med perioden – ikke nødvendigvis en
  `0 kr.`-række. Fx samme note som i BB-152: «Frem til 01-07-2022 udbetales den tidligere afgørelse
  fortsat, og denne afgørelse giver derfor intet yderligere krav.» Bemærk at fanen ALLEREDE har en tekst
  for den helt tomme afgørelse («Afgørelsen giver ingen løbende ydelse i den valgte periode»); den
  mangler blot for den delvist tomme.
- **Andre steder det kan gælde:** `rg "=== 0\) continue|beregnetEetKroner === 0" src/domain` – hver
  beregning, der springer en delperiode over på dens beløb. Bemærk desuden den latente uenighed i samme
  familie: fanen afgør «ingen løbende ydelse» på `perioder.length === 0`, dokumentet på
  `iAltBeregnetEetOre === 0` (`loebendeYdelserDocument.ts:116`). De to er enige i dag, fordi alle rækker
  er positive – men det er to prædikater for samme spørgsmål, jf. BB-098.

**Tilbagemelding**
Enig

### BB-154 – «Løbende ydelse ophører» kan ligge før afgørelsens egen virkningsdato

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-01 – umuligt interval erstattet af årsagslinje
- **Sådan fremprovokeres det:** to måder, målt hver for sig på en sag med en afgørelse, hvis
  Virkningsdato er `01-01-2022`:
  1. Sæt Beregningsdato til `01-01-2021`.
  2. Eller: sæt Fødselsdato til `01-01-1955` (folkepensionsdato `01-07-2021`) og Beregningsdato
     `01-07-2026`.
- **Det sker:** Periodeafgrænsningen skriver et umuligt forløb, målt ordret:

  ```
  (1)  Virkningsdato 01-01-2022 · Løbende ydelse ophører 01-01-2021 · Ophør skyldes Beregningsdato
  (2)  Virkningsdato 01-01-2022 · Løbende ydelse ophører 30-06-2021 · Ophør skyldes Folkepensionsdato
  ```

  Ydelsen «ophører» altså et helt år før den begynder. Tabellen under linjerne siger korrekt
  «Afgørelsen giver ingen løbende ydelse i den valgte periode», og de fem linjer trykkes ordret i
  dokumentet.
- **Det er uhensigtsmæssigt fordi:** en dato, der ligger før sin egen startdato, er ikke en oplysning –
  den er en selvmodsigelse, brugeren skal bruge tid på at afvise. I tilfælde (1) er den også
  handlingsanvisende på en forkert måde: brugeren tror, der er noget galt med afgørelsen, hvor der i
  virkeligheden er noget galt med beregningsdatoen. Og i tilfælde (2) er der reelt to oplysninger i
  klemme: at folkepensionsdatoen er passeret, og at afgørelsen derfor slet ikke kan give en løbende
  ydelse.
- **Bedre ville være:** når ophørsdatoen ville ligge før virkningsdatoen, vises Periodeafgrænsningens
  to sidste linjer ikke som et interval. I stedet én linje, der siger hvorfor: «Afgørelsen ligger helt
  efter beregningsdatoen (01-01-2021)» henholdsvis «Virkningsdatoen ligger efter folkepensionsdatoen
  (01-07-2021)». Tabellens eksisterende sætning kan blive stående.
- **Andre steder det kan gælde:** `finalStop` udledes som det tidligste af fire kandidater uden gulv ved
  virkningsdatoen (`eetLoebendeYdelserCalculation.ts:838`). Samme form kan opstå på Kapitalisering og
  Differencekrav, som bruger de samme fire ophørsårsager – hører til 11c og 11e.

**Tilbagemelding**
Enig

### BB-155 – «Ophør skyldes: Beregningsdato» siger, at ydelsen ophører, hvor beregningen blot stopper

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-01 – «opgjort til og med» ved beregningsdatoen, «ophører» ved de tre ægte årsager
- **Sådan fremprovokeres det:** en helt almindelig sag: én midlertidig afgørelse med Virkningsdato
  `01-01-2020`, Beregningsdato `01-07-2026`.
- **Det sker:** «Løbende ydelse ophører **01-07-2026**» og «Ophør skyldes **Beregningsdato**». Men
  ydelsen ophører ikke: den løber videre, og beregningsdatoen er kun det punkt, brugeren har valgt at
  gøre kravet op til. De tre øvrige værdier i samme felt («Senere afgørelse», «Kapitalisering»,
  «Folkepensionsdato») er ægte ophørsgrunde, så de fire står som ligeværdige svar på samme spørgsmål.
- **Det er uhensigtsmæssigt fordi:** linjen står i det dokument, modparten læser, og den påstår noget om
  sagen, der ikke er sandt. En modpart, der læser «løbende ydelse ophører 01-07-2026, ophør skyldes
  beregningsdato», kan med rimelighed læse det som en oplysning om ydelsen frem for om opgørelsen.
  Beregningsdatoen er den ENESTE af de fire årsager, der ikke er en begivenhed i sagen.
- **Bedre ville være:** skeln de to i teksten. Fx «Løbende ydelse **opgjort til og med** 01-07-2026 ·
  Årsag: Beregningsdatoen» ved den kunstige afgrænsning, og «Løbende ydelse ophører …» ved de tre ægte.
  Alternativt bevares én linje, men årsagsteksten siger «Beregningen er gjort op pr. beregningsdatoen».
- **Andre steder det kan gælde:** `toOphoerAarsagLabel` (`eetLoebendeYdelserCalculation.ts:1091`) er den
  eneste kilde og deles af skærm og dokument, så rettelsen ligger ét sted. Se BB-154 for den skærpede
  form af samme linje.

**Tilbagemelding**
Enig

### BB-156 – Fra «Grundydelse» og «Regulering» kan man ikke nå «Ydelse/md.»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-01 – kolonnen hedder «Grundydelse pr. år», afrundingsreglen forklares i den udvidede specifikation
- **Sådan fremprovokeres det:** tag rækken `01-01-2022`–`30-06-2022` fra en 25 %-afgørelse
  (skadedato `01-06-2018`, ASL-årsløn `400.000`) og regn den efter med det, tabellen viser.
- **Det sker:** tabellen skriver `Grundydelse 53.176,72 kr.` · `Regulering + 55,4 %` ·
  `Ydelse/md. 6.887 kr.` Regnet efter: `53.176,72 × 1,554 = 82.636,62`, og `82.636,62 / 12 = 6.886,39`
  – altså **6.886 kr.**, ikke 6.887. Årsagen er to skridt, der ikke står nogen steder: «Grundydelse» er
  et **årsbeløb**, og den regulerede årsydelse **oprundes til nærmeste 12 kr.** (`82.644`), før den
  divideres med 12. Resten af rækken kan derimod efterregnes: `6 mdr. × 6.887 = 41.322 kr.`
- **Det er uhensigtsmæssigt fordi:** specifikationen er hele fanens produkt, og den kan ikke afstemmes.
  Den, der efterregner – modparten, eller brugeren selv om et halvt år – får et andet tal og må gætte,
  om det er en afrunding eller en fejl. Beløbet er rigtigt, men det er ikke det samme som at være
  dokumenteret. Bemærk at fanen ellers er meget grundig: den udvidede specifikation viser hvert led i
  grundlønnen og i grundydelsen.
- **Bedre ville være:** vis mellemtrinnet. **Programmet har allerede formuleret det:**
  `buildLoebendeAarsydelseReguleringSteps` (`eetLoebendeYdelserCalculation.ts:1002`) beregner pr. satsår
  «årsydelse før afrunding» og reguleringsfaktoren – og funktionen kaldes **ingen steder i
  produktionskoden** (kun i sin egen test). To linjer i den udvidede specifikation pr. satsår
  («Årsydelse 53.176,72 × 1,554 = 82.636,62 kr., oprundet til nærmeste 12 kr. = 82.644 kr.
  → 6.887 kr./md.») lukker hullet. Som minimum bør kolonnen hedde «Grundydelse pr. år».
- **Andre steder det kan gælde:** `rg "ceilNearest12" src/` – hver beregning, hvor et årsbeløb oprundes
  for at give en hel månedsydelse. Generelt: hver tabel, hvis kolonner er tænkt som et regnestykke, skal
  prøves ved at regne én række efter udelukkende med de viste tal.

**Tilbagemelding**
Enig. Undgå gerne for meget visuelt rod, dog. Beregningerne er i forvejen lange og komplicerede, så undgå så vidt muligt gerne at tilføje alt for meget kompliceret beregningsteknisk. Det bliver nemt bare til visuelt rod.

### BB-157 – Kolonnen «Regulering» skifter målestok ved 2024, og «+ 0 %» står ved et grundbeløb, der er steget 65,7 %

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afvist af udvikleren 2026-09-01 – noten er efterprøvet og dækker alle relevante tilfælde
- **Sådan fremprovokeres det:** en sag med skadedato `01-06-2018`, virkningsdato `01-01-2020` og
  beregningsdato `01-07-2026`, så tabellen krydser 1. januar 2024.
- **Det sker:** de to kolonner fortæller modsatte historier ved årsskiftet, målt ordret:

  ```
  01-01-2023 | 31-12-2023 | 53.176,72 kr. | + 60,1 %
  01-01-2024 | 31-12-2024 | 88.113,83 kr. | +  0 %
  01-01-2025 | 31-12-2025 | 88.113,83 kr. | +  3,9 %
  ```

  Grundydelsen stiger 65,7 % fra 2023 til 2024, mens Regulering falder fra 60,1 % til 0 %. Forklaringen
  er, at reguleringsprocenten før 2024 er målt fra 2003-niveau og fra 2024 fra 2024-niveau – 2024 er
  referenceår og derfor 0 %. Den eneste ledetråd er noten over tabellen: «Frem til 1. januar 2024
  beregnes grundydelsen i 2003-niveau og derefter i 2024-niveau», som ikke nævner nogen af de to
  kolonner.
- **Det er uhensigtsmæssigt fordi:** samme kolonne indeholder procenter målt fra to forskellige
  grundbeløb, uden at skiftet er markeret. Den, der sammenholder 2023's «+ 60,1 %» med 2025's «+ 3,9 %»,
  må konkludere, at reguleringen er kollapset. Og «+ 0 %» i det år, hvor beløbet ændrer sig mest, er den
  ene celle, der ser ud som om der ikke skete noget.
- **Bedre ville være:** markér skiftet i tabellen. Fx en skillelinje eller en mellemoverskrift mellem
  2023- og 2024-rækken («Fra 1. januar 2024 – 2024-niveau»), så det fremgår, at kolonnen måles fra et
  nyt grundbeløb. Alternativt bindes noten til kolonnen ved at give den overskriften «Regulering (fra
  niveauåret)».
- **Andre steder det kan gælde:** `visGrundydelseNiveauSkift`-noten er delt af skærm og dokument, så
  begge udgaver har samme mangel. Kapitaliseringsfanen har samme 2003/2024-niveauskift – hører til 11c.

**Tilbagemelding**
Jeg afviser fundet. Brugeren bliver allerede orienteret om årsagen med denne tekst "Frem til 1. januar 2024 beregnes grundydelsen i 2003-niveau og derefter i 2024-niveau.". Tjek gerne, at teksten vises i alle de tilfælde, hvor problemstillingen kunne opstå og være relevant. Hvis den gør det, er dit fund ubegrundet.

### BB-158 – En EET-procent, programmet selv kalder ugyldig, er kun en gul advarsel på en anden fane

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-16--en-komplet-række-programmet-ikke-vil-regne-på`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-01 – gul feltadvarsel på EET %-cellen; «ugyldig» erstattet af «ikke lovmæssig»
- **Sådan fremprovokeres det:**
  1. Stamdata: Skadedato `01-08-2024`, Fødselsdato `01-01-1970`.
  2. EET oplysninger: Beregningsdato `01-07-2026`, ASL-årsløn `400.000`, én række med Afgørelsesdato
     `01-06-2025`, Virkningsdato `01-01-2025`, **EET % `25`**, Midlertidig.
- **Det sker:** cellen tager imod `25` og står **neutral** (målt `aria-invalid = false`, ingen tooltip) –
  femtrinsreglen er opfyldt. På Løbende ydelser står så «Der er indtastet en **ugyldig** EET-procent
  (25 %) for skader fra 1. juli 2024» som en **gul** advarsel, beregningen kører videre på værdien
  (`121.148 kr.` i alt), og dokumentet kan hentes.
- **Det er uhensigtsmæssigt fordi:** programmet bruger ordet «ugyldig» om en værdi, det selv accepterer,
  regner på og trykker. De to udsagn kan ikke begge være rigtige. Dertil er reglen ikke synlig, hvor den
  brydes: feltet håndhæver femtrin, mens domænet kræver titrin for skader fra 1. juli 2024 – og kun
  domænet ved, at skadedatoen ændrer reglen. Brugeren, der taster `25`, får en neutral celle og skal
  åbne en anden fane for at opdage det.
- **Bedre ville være:** vælg én af de to. Enten er værdien ugyldig, og så hører den som **rød** feltfejl
  på cellen med den konkrete regel («EET % skal være deleligt med 10 for skader fra 1. juli 2024»); eller
  den er lovlig men usædvanlig, og så skal advarslen hedde noget andet end «ugyldig» og stå som gul
  feltadvarsel på cellen. Under alle omstændigheder hører den ved cellen, ikke kun i en boks tre faner
  væk.
- **Andre steder det kan gælde:** `rg "eetPct % 10" src/domain/erhvervsevnetab` – reglen findes kun i
  `collectWarnings`. Generelt: hver advarsel, der bruger ordet «ugyldig», «forkert» eller «kan ikke» om
  en værdi, feltet accepterer – `rg "ugyldig" src/domain` er indgangen.

**Tilbagemelding**
Jeg er kun delvist enig. Selvom juraen siger, at der er særlige mindstegrænser og fastsatte procentsatser for erhvervsevnetab, som ikke kan fraviges, vil det nogen gange alligevel være nødvendigt at kunne lave teoretiske beregninger af værdien for sådanne. Derfor skal der konsekvent kun vises advarsler for indtastninger som er under mindstegrænserne eller uden for de faste procentsatser. Dog skal erhvervsevnetabsprocenter altid være delelige med 5, og de skal være større end nul og højst være hundrede - så fejl vedrørende dette skal gøre dem røde. Rent formuleringsmæssigt er det udtryk for en korrekt gengivelse af juraen at angive, at det er ugyldigt, når der indtastes en EET-procent under mindstegrænsen eller uden for de fastsatte procentsater, men programmet skal alligevel muliggøre dette. Brugeren skal blot advares om, at det er en ikke-lovmæssig beregning. Find en god balance og brug den gerne konsekvent.

### BB-159 – De tre «efter beregningsdatoen»-advarsler står kun i en boks på de andre faner

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-01 – gul feltadvarsel på de tre datoceller, boksens tre linjer samlet til én
- **Sådan fremprovokeres det:** en sag med en afgørelse (Afgørelsesdato `01-06-2022`, Virkningsdato
  `01-01-2022`, Kap.dato `01-06-2022`) og Beregningsdato `01-01-2021`.
- **Det sker:** Løbende ydelser viser tre advarsler over hinanden – «Der er angivet en afgørelsesdato
  efter beregningsdatoen», «… en virkningsdato …», «… en kapitaliseringsdato …» – alle tre med linket
  «EET oplysninger → Arbejdsskadesikringsloven». På fane 1 er alle tre celler **neutrale** (målt
  `aria-invalid = false`, ingen tooltip, ingen gul ramme).
- **Det er uhensigtsmæssigt fordi:** de tre advarsler er netop de kandidater, M-20 navngav, og de er de
  billigst mulige at vise ved feltet: begge de sammenlignede værdier står på samme fane, og
  beregningsdatoen er fanens første felt. Brugeren, der har tastet en beregningsdato før sagens
  afgørelser, får ingen indvending, hvor han sidder – og de tre linjer i boksen læses som tre problemer,
  hvor der er ét (beregningsdatoen).
- **Bedre ville være:** gul feltadvarsel på hver af de tre celler med samme ordlyd som boksens, og
  boksens tre linjer samlet til én, der navngiver årsagen: «Beregningsdatoen (01-01-2021) ligger før
  sagens afgørelser.» Udviklerens afgørelse ved BB-142 peger samme vej: indtastningsfanen skal vise fejl
  i faktisk foretagne indtastninger som rød eller gul ring med tooltip.
- **Andre steder det kan gælde:** `EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS`
  (`eetLoebendeYdelserCalculation.ts:260`) samler præcis de tre id'er, så mængden er kendt. De øvrige
  `warn-*` på fanen er efterprøvet: `warn-asl-eet-under-15` HAR sin feltadvarsel (BF-019), og
  `warn-non-endelig-after-endelig` er en ægte kryds-række-oplysning uden ét felt at hænge på.

**Tilbagemelding**
Enig.

### BB-160 – Dokumentets «Resterende EET (30 - 5 % = 10 %)» er et regnestykke, der ikke går op

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-01 – hele kæden vises: 30 % - 15 % tidl. kap. - 5 % kap. = 10 %
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `01-01-1970`, Skadedato `01-06-2018`. EET oplysninger: Beregningsdato
     `01-07-2026`, ASL-årsløn `400.000`.
  2. Række 1: Afgørelsesdato `01-06-2019`, Virkningsdato `01-01-2019`, EET % `20`, **Delvist endelig**,
     Kap.dato `01-06-2019`, Kap. % `15`.
  3. Række 2: Afgørelsesdato `01-06-2022`, Virkningsdato `01-01-2022`, EET % `30`, **Delvist endelig**,
     Kap.dato `01-06-2022`, Kap. % `5`.
  4. Slå «Medtag udvidet specifikation» til, hent dokumentet, og sammenlign linjen med skærmens.
- **Det sker:** samme linje, to udgaver, målt ordret:
  - Skærm: «Resterende EET (**15** - 5 % = 10 %) efter kapitalisering 01-06-2022»
  - Dokument: «Resterende EET (**30** - 5 % = 10 %) efter kapitalisering 01-06-2022»

  Dokumentets version er aritmetisk falsk: `30 - 5` er 25, ikke 10. Beløbet ved siden af
  (`21.270,69 kr.`) er rigtigt og svarer til de 10 %. Årsagen er, at generatoren bruger
  `afgoerelse.eetPct` (30), hvor fanen bruger `eetPctFoerAktuelKap` (30 − 15 tidligere kap. = 15)
  – `loebendeYdelserDocument.ts:302` og `:319` mod `EetLoebendeYdelserTab.tsx:343`.
- **Det er uhensigtsmæssigt fordi:** det er dokumentet, modparten læser, og et regnestykke, der ikke går
  op, er den slags detalje, en modpart bruger til at afvise hele opgørelsen. Brugeren har ingen chance
  for at opdage det, fordi skærmen viser den rigtige version – han skal hente dokumentet og læse en
  linje, han allerede har set korrekt.
- **Bedre ville være:** generatoren bruger `eetPctFoerAktuelKap`, som fanen gør, og formaterer den med
  `formatPct` frem for som råt tal. Rettelsen er ét udtryk, gentaget to steder i samme fil.
- **Andre steder det kan gælde:** dette er første målte tilfælde i programmet, hvor skærm og dokument er
  uenige om et **led i et regnestykke** frem for om et tals form. Prøven er ny: for hver linje, der
  skriver et regnestykke ud, læs de to udgaver side om side og **regn dem efter hver for sig**.
  `rg "= \$\{formatPct|- \$\{formatPct" src/document/generators` er indgangen.

**Tilbagemelding**
Jeg er enig. Jeg overvejer dog, om det ikke vil være mest brugervenligt konsekvent i disse tilfælde at vise hele beregningen af erhvervsevnetab, altså hvis seneste afgørelse er på 30 %, så tage afsæt i denne procentsats og dels vise, at den tidligere kapitaliseringsprocent bliver trukket fra, og vise at den efterfølgende også bliver trukket fra, så brugeren kan følge hele regnestykket fra den angivne fulde procentsats til slutresultatet.

### BB-161 – Dokumentet nævner ikke beregningsdatoen, som skærmen har som sin første række

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Mellem
- **Beslutning:** Afvist af udvikleren 2026-09-01 – beregningsdatoen har ingen selvstændig juridisk betydning
- **Sådan fremprovokeres det:** hent «Løbende ydelser (EET)» på en almindelig sag og læs det igennem.
- **Det sker:** skærmens første oplysning er «Beregningsdato 1. juli 2026». I dokumentet står den ikke
  – hverken på forsiden, i Periodeafgrænsningen eller i den udvidede specifikation. Sagens **skadedato**
  står kun ét sted, midt i grundlønsformlen («Maks. årsløn 1/6-2018»), og kun hvis den udvidede
  specifikation er slået til – hvilket den **ikke er som standard**. Et dokument hentet med
  standardindstillinger indeholder derfor hverken sagens skadedato eller den beregningsdato, hver enkelt
  periode er afgrænset af. Kun dags dato (`31. august 2026`) står øverst.
- **Det er uhensigtsmæssigt fordi:** beregningsdatoen er den værdi, der bestemmer, hvor hver afgørelses
  sidste periode ender – dokumentet nævner den endda indirekte som ophørsårsag («Ophør skyldes:
  Beregningsdato») uden at sige, hvad datoen er. Modparten kan ikke afgøre, om opgørelsen er lavet til
  det aftalte tidspunkt, og brugeren kan ikke se på et gammelt dokument, hvilken opgørelsesdato det
  hviler på. Det er samme mangel som BB-122 på Forsørgertab, hvor rettelsen var at tilføje sagens dato
  konsekvent.
- **Bedre ville være:** dokumentet får en «Forudsætninger»- eller «Grundlæggende oplysninger»-linje med
  Beregningsdato og Skadedato/Anmeldelsesdato, uafhængigt af togglen for den udvidede specifikation –
  præcis som Forsørgertabs specifikation fik efter BB-122.
- **Andre steder det kan gælde:** de tre øvrige EET-dokumenter er ikke læst i denne kørsel; prøven er
  BB-122's og er mekanisk: hold skærmens forudsætningsrækker op mod dokumentets, række for række. Hører
  til 11c–11e.

**Tilbagemelding**
jeg er ikke sikker på, at jeg er enig. Beregningsdato er blot den dato, som brugeren vælger at lave beregningerne frem til. Der er ikke nogen juridisk eller faktuel betydning tilknyttet den pågældende dato. Jeg tænker derfor, at det er tilstrækkeligt at det blot fremgår af dokumenterne, at opgørelsen kun er lavet frem til en given dato, uden at det er relevant at angive, at den dato i selve programmet omtales som beregningsdatoen.

### BB-162 – «Mdr.» skrives med fire decimaler på skærmen og fem i dokumentet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-01 – fem decimaler begge steder via den fælles formatter
- **Sådan fremprovokeres det:** sammenlign tabellens «Mdr.»-kolonne på skærmen med det hentede dokument.
- **Det sker:** samme tal, to præcisioner, målt ordret:

  ```
  skærm:    12,0000   6,0323
  dokument: 12,00000  6,03226
  ```

  Kilden er to forskellige formattere: fanen har sin **egen lokale** `formatMaaneder` med fast fire
  decimaler (`EetLoebendeYdelserTab.tsx:49`), dokumentet bruger `formatMaanederFixed` med fem
  (`DOCUMENT_MAANEDER_DECIMALS = 5`). Dertil findes EET's **kanoniske** månedsformatter
  (`eetFormatUtils.ts:49`, dokumenteret som «Kanonisk formatter for et månedsantal i EET (4 decimaler,
  trailing zeros trimmet)») – den bruges af Differencekrav-fanen, men ikke af denne, og
  `differencekravDocument.ts:60` har en fjerde, lokal kopi. Fire varianter for samme slags tal i samme
  domæne.
- **Det er uhensigtsmæssigt fordi:** «Mdr.» er den faktor, «Beregnet EET» ganges med, så den, der
  efterregner, får to forskellige grundlag alt efter, om han læser skærmen eller papiret. Og fanen omgår
  en formatter, der i koden er udpeget som den kanoniske for netop dette tal.
- **Bedre ville være:** fanen og dens generator kalder den samme formatter – enten `eetFormatUtils`'
  kanoniske eller `formatMaanederFixed` – og de tre lokale kopier fjernes.
- **Andre steder det kan gælde:** **latent i samme tabel:** kolonnen «Regulering» har også to
  implementeringer, og de er uenige om fortegnet ved en lille negativ værdi. Skærmens
  `formatRegulering` vælger fortegn på den **rå** værdi, dokumentets `formatReguleringPct` på den
  **afrundede** – med den udtrykkelige begrundelse, at «- 0 %» er misvisende. Datasættet har i dag ingen
  negative reguleringsprocenter, så uenigheden er ikke udløst; efter mønsterets egen lære lukkes den,
  når den findes.

**Tilbagemelding**
Jeg er enig. Brug fem decimaler for Mdr begge stedre.

### BB-163 – Ydelsesniveau-sætningen og grundydelsens minustegn er forskellige på skærm og i dokument

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-01 – én ordlyd og ét minustegn (U+002D) på skærm og i dokument
- **Sådan fremprovokeres det:** slå den udvidede specifikation til, hent dokumentet, og sammenlign
  afsnittene «Ydelsesniveau» og «Grundydelse» linje for linje med skærmens.
- **Det sker:** to forskelle, målt ordret:
  - Skærm: «Der trækkes AM-bidrag (8 %) fra årslønnen **og sker dermed** yderligere regulering til» ·
    Dokument: «Der **fratrækkes** AM-bidrag (8 %) **svarende til** en yderligere regulering med».
    Skærmens sætning er desuden grammatisk ufuldstændig – der mangler et grundled efter «og».
  - Skærm: «Grundløn x EET x Erstatningsniveau x (100 % **−** AM-bidrag)» med **U+2212 MINUS SIGN** ·
    Dokument: samme linje med almindelig bindestreg **U+002D**. Målt på tegnkode.
- **Det er uhensigtsmæssigt fordi:** det er samme sætning og samme formel om samme tal, og de to
  udgaver skal kunne lægges ved siden af hinanden. Det er BB-132's form (operatoren, ikke tallet), og
  U+2212 findes i alt to steder i hele programmets brugervendte tekster – det andet sted
  (`EetMerErstatningPensionsalderBox`) bruger det konsekvent i BÅDE skærm og dokument, så netop denne
  linje er den eneste uenige.
- **Bedre ville være:** én tekstkilde for begge udgaver, som fanen og generatoren allerede deler for
  ophørsårsagerne og rest-visningen (`resolveLoebendeAfgoerelseRestVisning`), og ét valg af minustegn.
  Skærmens sætning omskrives til dokumentets, som er den grammatisk hele.
- **Andre steder det kan gælde:** `rg "−" src/components src/document` giver de to brugervendte
  forekomster; alle øvrige træf er kommentarer. Generelt: sammenlign ikke kun tallets form, men tegnene
  omkring det, og gør det på tegnkode – de to minustegn er visuelt næsten ens.

**Tilbagemelding**
Enig

### BB-164 – To toggles i samme sag styrer den samme udvidede specifikation, og ingen af dem nævner den anden

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afvist af udvikleren 2026-09-01 – to uafhængige toggles, én pr. fanes egne dokumenter
- **Sådan fremprovokeres det:**
  1. Løbende ydelser: slå «Medtag udvidet specifikation i Word» **til**.
  2. Gå til Differencekrav og læs «Medtag udvidet specifikation på løbende ydelser».
- **Det sker:** den anden toggle er **fra** (målt). De to er hver sit felt
  (`visUdvidetSpecifikation` og `visUdvidetSpecifikationLoebendeYdelserBilag`), og de styrer det samme
  indhold – begge veje ender i `addLoebendeUdvidetSpecifikationPage`. Differencekravdokumentets
  løbende-ydelser-bilag er ordret det samme bilag som fane 2's dokument, men med sin egen kontakt.
  Ingen af de to flader nævner den anden.
- **Det er uhensigtsmæssigt fordi:** brugeren, der har truffet valget «ja, tag specifikationen med»,
  har kun truffet det for det ene af de to dokumenter, der indeholder bilaget – og opdager det kun ved
  at hente begge og sammenligne sidetal. To kontakter til samme indhold i samme sag er også to steder,
  hvor svaret kan komme til at være forskelligt efter Hent.
- **Bedre ville være:** ét felt. Er der en grund til at kunne vælge forskelligt for det selvstændige
  dokument og for bilaget, skal begge labels sige, hvilket dokument de gælder («… i dokumentet Løbende
  ydelser» / «… i differencekravets bilag»).
- **Andre steder det kan gælde:** `rg "eetDifferencekravBilagSelection" src/components/pages` – de seks
  øvrige bilagsvalg bor alle på Differencekrav, og `visUdvidetSpecifikation` er den ENESTE, der er
  flyttet til en anden fane (håndteret med en særregel i `fieldLocationCatalog.ts:71`). Særreglen er
  selv et spor: et felt, der bor i én datagruppe og renderes fra en anden fane, er en kandidat.

**Tilbagemelding**
Jeg afviser fundet. Det skaber mere forvirring end bidrag, hvis der kun laves én samlet slider, og brugeren derfor skal bruge tid på at lede efter den på en fane, hvor brugerens beregninger reelt hører til på en anden. Brugeren vil benytte beregningen af løbende ydelser og beregningen af differencekrav til helt forskellige formål, så det giver mening - også ud fra en brugers perspektiv - at der er en individuel mulighed på hver af siderne for at vælge, om specifikationer skal indgå. Der skal ikke være nogen indbyrdes sammenhæng overhovedet mellem de to sliders. én slider på hver af de to faner, som udelukkende bestemmer, om der indsættes specifikation på den enkelte fanes specifikke dokumenter.

### BB-165 – Tabellen deler en periode i tre rækker med identiske tal

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-01 – tilstødende rækker med identiske tal slås sammen i visningen
- **Sådan fremprovokeres det:** samme sag som BB-160; læs tabellen i boksen «Afgørelse 1. juni 2022».
- **Det sker:** tre rækker i træk er ordret ens bortset fra datoerne, målt:

  ```
  01-01-2022 | 31-05-2022 |  5,0000 | 21.270,69 kr. | + 55,4 % | 2.755 kr. | 13.775 kr.
  01-06-2022 | 30-06-2022 |  1,0000 | 21.270,69 kr. | + 55,4 % | 2.755 kr. |  2.755 kr.
  01-07-2022 | 31-12-2022 |  6,0000 | 21.270,69 kr. | + 55,4 % | 2.755 kr. | 16.530 kr.
  ```

  Delegrænserne er kapitaliseringsdatoen (`01-06-2022`) og skæringsdatoen (`01-07-2022`). Ingen af de to
  ændrer noget i rækken, og skæringsdatoen står ikke nogen steder på siden (jf. BB-152).
- **Det er uhensigtsmæssigt fordi:** en tabel med tre ens rækker inviterer spørgsmålet «hvorfor er den
  delt her?», og svaret findes ikke på siden. For en modpart ser det ud som en fejl i periodiseringen.
  Ved flere afgørelser vokser antallet af sådanne rækker.
- **Bedre ville være:** slå tilstødende rækker sammen, når satsår, grundydelse og månedsydelse er ens –
  eller, hvis delingen skal bevares som dokumentation, navngiv grænsen i rækken (BB-152's forslag).
  Bemærk at domænet med vilje bevarer den komplette tekniske periodisering
  (`assertValidPeriodSectionRows` kræver, at delintervallerne er sammenhængende); sammenlægningen hører
  derfor i visningen, ikke i motoren.
- **Andre steder det kan gælde:** `splitPeriodByBoundaries` bruges kun her. Generelt: hver flade, der
  splitter en periode på interne grænser, kan vise rækker uden forskel – EO's TAF-periodisering er den
  nærmeste kandidat (flade 12).

**Tilbagemelding**
Enig. Sørg for at finde en god, velstruktureret måde at gøre det på.

## Overvejet uden fund

- **Beregningen er kontrolregnet i tre sagsformer og er i orden** (se «Fladen kort»): 2003-niveau med
  2024-skift, 2024-niveau (`400.000 × 608.000/608.000 = 400.000`, grundydelse `76.360,00`,
  I alt `121.148 kr.`) og en delvist kapitaliseret kæde med to afgørelser
  (`278.558 × 15 % × 83 % × 92 % = 31.906,03`, rest `21.270,69`). Overlapperioderne er efterregnet
  som `currentRest − previousRest` og summerer korrekt: for `01-01-2022`–`30-06-2022` giver de to
  afgørelser tilsammen `41.322 + 8.268 = 49.590 kr.`, hvor 30 % alene giver `49.584 kr.` for det
  følgende halvår – forskellen er de 12 kr./år, oprundingen medfører (BB-156).
- **I alt-rækken kan efterregnes af præcis de hele kroner, tabellen viser** (`79.824 + 81.684 + 82.644 +
  85.140 + 88.116 + 91.560 + 48.240 = 557.208`). Skærm og dokument bruger samme
  `sumRoundedValues`/`buildSummedTotalRowSpec`-regel. Det er «vist = beregnet» efterlevet.
- **M-22 er efterprøvet og BESTÅET.** Fødselsdato `99-99-9999` i Stamdata giver «Der er udfyldt en
  ugyldig værdi i feltet 'Fødselsdato'» med linket «Stamdata → Skadelidte» øverst på fanen, og
  downloadknappen er grå med «Fejl i indtastning». Fanen navngiver altså den fremmede flade – BB-080's
  rettelse i drift.
- **M-25 er efterprøvet og BESTÅET.** Fanens dokument har ét valgfrit afsnit (den udvidede
  specifikation), og gaten er fail-closed på severity (`buildGatedProjection` +
  `evaluateEetFaneDownloadGate`), ikke en allowlist. En afgørelse, der falder helt uden for
  beregningsperioden, forsvinder ikke tavst: både skærm og dokument skriver «Afgørelsen giver ingen
  løbende ydelse i den valgte periode». Det tavse fravær ligger i **delperioden**, ikke i afsnittet, og
  er registreret som BB-153.
- **M-27 er uden genstand.** Fanen har ingen feltregler – dens eneste input er en toggle.
- **M-23 er uden genstand.** Tabellen er en periodisering af én afgørelse, ikke et aggregat med en
  `sum / enheder`-brøk; dubletter af afgørelser fanges på fane 1 (BB-140).
- **M-19 er uden genstand.** Fanen spejler ingen stamdataoplysning; de to stamdatoer optræder kun som
  issues med link.
- **M-09 er målt og BESTÅET.** Tabellen er 1100 px bred, højre kant ved x = 1446. Ved 1536×864 er
  `scrollWidth = innerWidth = 1536` – ingen vandret scroll.
- **M-10 er målt og BESTÅET.** «Scroll til toppen» ligger på x = 1451–1505, y = 779–833; fanens
  nederste højre indhold (den sidste højrestillede værdi) slutter ved x = 1435, y = 708. Ingen
  overlapning.
- **Den tomme sag er velbehandlet – ingen fund.** Efter «Slet alt» viser fanen fem linjer, der hver
  navngiver sit felt og sin vej: «Fødselsdato er ikke udfyldt» → Stamdata → Skadelidte, «Skadedato er
  ikke udfyldt» → samme, «Beregningsdato er ikke udfyldt» → EET oplysninger → Grundlæggende oplysninger,
  «Skadelidtes årsløn (efter ASL) er ikke udfyldt» og «Ingen ASL-afgørelser er indtastet» → EET
  oplysninger → Arbejdsskadesikringsloven. Alle fem sektionsnavne er efterprøvet mod de faktiske
  sektioner og er rigtige – BB-135's fejl findes ikke her. Knappen er grå med «Indtastning mangler».
- **Tab-ringen er komplet.** To elementer: togglen → downloadknappen → togglen. Mellemrum skifter
  togglen, Ctrl+Z fortryder den, Ctrl+Y gentager den (målt `false → true → false → true`), og
  downloadknappen kan fokuseres med sit rigtige navn «Download som Word».
- **Den grå downloadknap er ikke registreret som fund.** Den er `disabled` med `tabindex=-1` og bærer
  blokeringsårsagen som `aria-label`/tooltip i stedet for handlingsnavnet. Det er den aftalte grammatik
  for enhver grå knap i hele programmet (BF-059, `actionGate.ts`) og er allerede afgjort på flade 7a.
- **Togglens virkning er ærlig.** Labelen siger «i Word»/«i PDF» og følger dokumentformatet fra
  Indstillinger; skærmens egen «Udvidet specifikation»-boks vises uanset togglen, hvilket er korrekt –
  togglen handler kun om dokumentet. Se dog BB-164 om den anden toggle og BB-161 om det, der IKKE er
  dækket af togglen.
- **Manglende reguleringssats fail-closer korrekt.** `resolveAslReguleringRateForSatsAar` giver et
  blokerende issue pr. år (`reguleringssats-missing-<år>`), ikke en sprunget periode – i modsætning til
  `beregnetEetKroner === 0`, som er BB-153. Tilstanden kan ikke nås fra brugerfladen, fordi
  beregningsdatoens interval er afledt af satsdækningen (samme lukkede spor som Varige mén).
- **Kapitaliseringens virkning på den løbende ydelse ER forklaret.** I sagen fra BB-160 falder afgørelse
  1's grundydelse fra `42.541,38` til `10.635,34` ved `01-06-2019`, og boksen bærer linjen «Delvist
  kapitaliseret (15 %) 01-06-2019». Det er netop den ledetråd, overlapperioden mangler (BB-152) – og
  den viser, at fanens eget formsprog allerede rummer løsningen.
- **Grundlønsformlen for en 2024-skade ganger med 1** («Maks. årsløn 1/1-2024 / Maks. årsløn 1/8-2024» =
  `608.000 / 608.000`). Det er ikke registreret som fund: linjen er den samme formel som for ældre
  skader, og at brøken er 1 er selv oplysningen om, at der ikke omregnes.
- **To navneforskelle mellem skærm og dokument er bevidst IKKE registreret** efter udviklerens
  tilbagemelding på BB-145 (fulde navne i henvisende tekster er ønskværdige): skærmens «ASL-årsløn» mod
  dokumentets «ASL årsløn (afrundet til nærmeste 1000 og maks. 527.000 kr.)», og skærmens boksoverskrift
  «Afgørelse 1. juni 2020 (25 %)» mod dokumentets «Afgørelse 1. juni 2020». Bemærk dog, at
  afrundingen til nærmeste 1.000 ikke kan opstå fra brugerfladen: feltet kræver selv, at årslønnen er
  delelig med 1.000 (målt: `400.500` → rød med «skal være deleligt med 1.000»), så dokumentets
  parentes beskriver en afrunding, der aldrig sker.
- **Konsollen var tavs gennem hele kørslen:** 185 beskeder, 0 fejl, 0 advarsler.

## Dækningshuller

- Kun Chrome, lyst tema, 1536×864. Mørkt tema og de tre øvrige browsere er ikke målt.
- PDF-kanalen er ikke læst; alle dokumenter er hentet som `.docx`. BB-160, BB-161, BB-162 og BB-163
  hviler derfor på Word-udgaven plus kildelæsning af den fælles generator (de to kanaler deler
  `loebendeYdelserDocument.ts`).
- `Gem`/`Hent` er ikke afprøvet – filvælgeren kan ikke betjenes headless (samme hul som BB-049).
  BB-164's persistensdel hviler på de to felters `bilagToggle`-erklæring, ikke på en målt fil.
- Brevhovedet er ikke slået til i nogen kørsel, så BB-161's «forsiden nævner ikke beregningsdatoen» er
  målt uden brevhoved. Brevhovedet bærer journalnr., advokat, sagsbehandler og dags dato og indeholder
  ikke beregningsdatoen (kildelæst).
- «Meget mange afgørelser» (B3) er ikke målt; højst tre rækker er brugt. Med én boks og én tabel pr.
  afgørelse er sidelængden lineær i antallet, og det er ikke efterprøvet, hvordan fanen læses ved fx
  otte afgørelser.
- Differencekravdokumentets løbende-ydelser-bilag er ikke hentet; BB-164's udfald hviler på
  `differencekravDocument.ts:542`.
- M-21's navngivne kandidat `DocumentOutcomeMessage.tsx:34` (den døde `error.main`-prop) kunne ikke
  måles: `download.errorMessage` sættes kun ved en stale-afbrydelse eller en DEV-serverfejl, og ingen af
  dem kunne fremprovokeres.

---

# Fane 3 – Kapitalisering

- Gennemgået: 2026-09-03 · commit `7a6f0b00`
- Afprøvet i: Chrome, lyst tema, 1536×864

## Fladen kort

Fanen er **Erhvervsevnetabs anden resultatfane** og den eneste, der opgør et engangsbeløb. Den har præcis
én kontrol – downloadknappen – og alt andet er visning. Strukturen er: «Fejl og advarsler» (fælles
`EetIssuesBox`), en «Beregning»-boks med downloadknappen, og derefter **én boks pr. kapitaliseret
afgørelse** med fire underafsnit: Grundydelse og regulering · Kapitaliseringsbekendtgørelse og tabel ·
Kapitaliseringsfaktor · Kapitalbeløb. Er der ingen kapitaliserede afgørelser, står i stedet boksen
«Specifikation» med linjen «Der er ingen kapitaliserede afgørelser i sagen.»

Fanen deler præsentationsmodel med sit dokument (`eetKapitaliseringRows.ts`), så skærm og PDF/Word viser
samme rækker i samme rækkefølge. Tre forskelle er erklærede options: datoformatet i
reguleringsprocent-linjen, `<`/`≤` i særfaktor-etiketten, og om Køn-rækken vises ved tom værdi. Dertil
tilføjer skærmen én række, dokumentet ikke har: **Beregningsdato**.

**Fanens særkende, og kilden til fire af fundene:** den er den ENESTE af de fire resultatfaner, hvor
beregningsdatoen **ikke** er en afhængighed. Det er en bevidst beslutning
(`eetSnapshot.ts`: «beregningsdato er BEVIDST ikke en kapitaliserings-afhængighed»), og den er rigtig –
et kapitalbeløb hører til sin kapitaliseringsdato, ikke til den dato, brugeren gør sagen op pr. Men fanen
skriver alligevel beregningsdatoen øverst i hver eneste boks, og den siger intet, når de to er i modstrid.

**Beregningsformlerne selv er kontrolregnet og er i orden.** Efterregnet i browseren på skadedato
`01-06-2018`, fødselsdato `01-01-1970`, ASL-årsløn `400.000`: grundløn
`400.000 × 367.000/527.000 = 278.558`; 15 %-kapitaliseringen `278.558 × 15 % × 83 % × 92 % = 31.906,03`,
reguleret `× 146,9 % = 46.869,96`, kapitaliseret `× 10,772 = 504.883,26` oprundet til `504.884 kr.`;
5 %-kapitaliseringen `10.635,34 → 16.527,32 → × 10,073 = 166.480 kr.` Også 2024-niveauskiftet
(`10.635,34 × 1,657 = 17.622,76`, `× 103,9 % = 18.310,05`, `× 8,408 = 153.951`) og særfaktor-grenen
(`85.082,76 → 136.217,50 → × 1,245 = 169.591`) er efterregnet. **Ingen af de elleve fund handler om et
forkert tal.**

## Fund

### BB-166 – Kapitaliseringer, der ligger efter beregningsdatoen, regnes med uden et ord – nabofanen erklærer de samme afgørelser for uden virkning

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **Trukket tilbage 2026-09-03 – fundet hviler på en fejlagtig præmis**
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `01-01-1970`, Skadedato `01-06-2018`.
  2. EET oplysninger: ASL-årsløn `400.000`, **Beregningsdato `01-06-2018`**.
  3. Række 1: Afgørelsesdato `01-06-2019`, Virkningsdato `01-01-2019`, EET % `20`, Delvist endelig,
     Kap.dato `01-06-2019`, Kap. % `15`.
  4. Række 2: Afgørelsesdato `01-06-2022`, Virkningsdato `01-01-2022`, EET % `30`, Delvist endelig,
     Kap.dato `01-06-2022`, Kap. % `5`.
  5. Læs Kapitalisering, og derefter Løbende ydelser.
- **Det sker:** de to faner behandler nøjagtig samme sag modsat, målt ordret:
  - **Kapitalisering:** ingen «Fejl og advarsler»-boks overhovedet. To fulde afgørelsesbokse, hver med
    «Beregningsdato **01-06-2018**» øverst og derefter en kapitalisering dateret 2019 henholdsvis 2022 –
    `504.884 kr.` og `166.480 kr.` Downloadknappen er aktiv.
  - **Løbende ydelser:** «**Beregningsdatoen (01-06-2018) ligger før sagens afgørelser.**» øverst, og i
    hver afgørelsesboks «Afgørelsen ligger helt efter beregningsdatoen (01-06-2018)» og «Afgørelsen giver
    ingen løbende ydelse i den valgte periode.»
- **Det er uhensigtsmæssigt fordi:** brugeren har sagt, at sagen gøres op pr. 1. juni 2018. Den ene fane
  svarer, at der derfor ikke er noget krav; den anden opgør `671.364 kr.` i kapitalbeløb for
  kapitaliseringer, der ikke var truffet på den dato – og skriver oven i købet opgørelsesdatoen øverst i
  hver boks, som om beløbet hørte til den. To faner i samme sag, to modsatte svar på «hvad er der pr.
  denne dato?», og ingen af dem nævner den anden. Fejlformen er den samme, uanset hvilken af de to der er
  juridisk rigtig: brugeren kan ikke se, at der findes to svar.
- **Bedre ville være:** fanen siger, hvad den gør. Enten samme gule advarsel som Løbende ydelsers
  – «Beregningsdatoen (01-06-2018) ligger før sagens afgørelser» – med en linje i den enkelte boks om, at
  kapitaliseringen ligger efter opgørelsesdatoen og alligevel medtages, fordi et kapitalbeløb hører til
  sin kapitaliseringsdato; eller, hvis afgørelsen er, at sådanne kapitaliseringer ikke hører med i en
  opgørelse pr. den valgte dato, at de udelades med en linje, der siger hvorfor. Advarslen findes allerede
  (`EET_DATO_EFTER_BEREGNINGSDATO_WARNING_ID`, BB-159); den produceres i dag kun af løbende ydelser og
  differencekrav.
- **Andre steder det kan gælde:** de to øvrige resultatfaner (EET efter EAL, Differencekrav) har
  beregningsdatoen som ægte afhængighed og er derfor ikke i familien. Generelt: hver flade, hvor en
  oplysning vises **uden** at være en afhængighed, mens en nabo-flade blokerer eller advarer på den samme
  oplysning. Se BB-167 for rækkens egen del af problemet.

**Tilbagemelding**
Fundet er forkert og beror på en fejlagtig præmis. Hver fane beregner en unik, individuel ydelse. I visse tilfælde indgår den beregnede ydelse uændret i opgørelsen af differencekrav, mens der i andre tilfælde beregnes en anden variation af ydelsen i differencekravet.

Beregning af kapitalbeløb på selve den specifikke fane er uafhængig af beregningsdatoen og skal ikke tage højde for denne. Det er derfor heller ikke en fejl, at der på denne fane fremgår kapitalafgørelser efter beregningsdatoen. Eftersom visningen på selve fanen er uafhængig af beregningsdatoen, ville det omvendt være en fejl, hvis kapitaliseringsafgørelserne på fanen på nogen måde blev påvirket af beregningsdatoen.

Bemærk, at forholdet er helt omvendt ved beregning af differencekrav - her beregnes kapitaliseringsværdier særskilt, og der medregnes kun kapitalisering, der ligger før beregningsdatoen.

### BB-167 – «Beregningsdato» står øverst i hver afgørelsesboks og styrer intet på fanen

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-03 – rækken fjernet helt fra fanen; ingen erstatning øverst i «Beregning»
- **Sådan fremprovokeres det:**
  1. Byg sagen fra BB-166 med Beregningsdato `01-07-2026`, og læs rækken «Beregningsdato» i hver boks.
  2. Ret Beregningsdato til `01-06-2018`. Læs fanen igen.
  3. Ryd Beregningsdato helt. Læs fanen igen.
- **Det sker:** intet tal på fanen ændrer sig i trin 2 – kun rækkens egen værdi. I trin 3 står rækken
  tilbage med **tom værdi** øverst i hver boks, alle kapitalbeløb er uændrede, og downloadknappen er
  fortsat aktiv (målt). De tre øvrige resultatfaner blokerer i samme tilstand med «Beregningsdato er ikke
  udfyldt». Målt på en helt tom sag lister denne fane fire mangler (Fødselsdato, Skadedato, ASL-årsløn,
  «Ingen ASL-afgørelser er indtastet») – Løbende ydelser lister de samme plus beregningsdatoen. **Og
  dokumentet har slet ikke rækken** (målt i den hentede `.docx`).
- **Det er uhensigtsmæssigt fordi:** en række øverst i en boks læses som boksens forudsætning. Her er den
  det ikke – den er den eneste værdi i boksen, som intet i boksen afhænger af. Er den tom, ser boksen
  ufærdig ud, selv om beregningen er komplet; er den forkert, ser boksen rigtig ud, selv om
  opgørelsesdatoen modsiger den (BB-166). Og fordi dokumentet ikke har rækken, kan brugeren ikke bruge
  skærmen som facit for, hvad modparten får at se.
- **Bedre ville være:** rækken fjernes fra afgørelsesboksene. Skal fanen vise en dato for opgørelsen, hører
  den én gang øverst i «Beregning»-boksen – ikke gentaget pr. afgørelse – og så skal den ledsages af
  BB-166's linje, når den er i modstrid med kapitaliseringsdatoerne. Fanen bør ikke være det eneste sted i
  programmet, hvor en tom beregningsdato ser ud som en tom celle frem for som en manglende oplysning.
- **Andre steder det kan gælde:** `rg "values.beregningsdato" src/components/pages/erhvervsevnetab` – rækken
  er bygget uden om den delte præsentationsmodel og er kommenteret som «bevidst kun i UI'en». Generelt:
  hver værdi, en fane viser, men ikke læser. Prøven er BB-167's egen: **ændr værdien og se, om noget andet
  på fladen ændrer sig.**

**Tilbagemelding**
Jeg er enig i fundet. Eftersom beregningsdatoen ingen betydning har for beregningerne på selve kapitalisering-fanen, bør den heller ikke fremgå, hverken på siden eller dokumenterne. Bemærk, at dette princip kun gør sig gældende for kapitalisering-fanen. På differencekrav-siden indgår en særskilt beregning af kapitalisering, som er afhængig af beregningsdatoen, hvor den derfor er relevant at vise.

### BB-168 – Ved ≤ 2 år til folkepension er både «udfyld» og «lad stå tomt» en fejl, og ingen af beskederne siger hvad der skal stå

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-29--to-regler-der-tilsammen-ikke-efterlader-en-lovlig-indtastning`
- **Prioritet:** **Høj**
- **Beslutning:** Implementeret 2026-09-03 – ≤2-års-undtagelsen givet til den delte samler, og de to celletekster navngiver nu handlingen
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `01-01-1958`, Skadedato `01-06-2018`.
  2. EET oplysninger: Beregningsdato `01-07-2026`, ASL-årsløn `400.000`.
  3. Én række: Afgørelsesdato `01-06-2023`, Virkningsdato `01-01-2023`, EET % `40`, **Endelig**.
  4. Prøv først med Kap.dato `01-01-2024` og Kap. % `25`. Ryd dem derefter begge.
- **Det sker:** begge tilstande er blokerende, målt ordret:
  - **Udfyldt:** begge celler bliver røde (`aria-invalid = true`) med hver sin tooltip – Kap.dato: «Ved
    ≤ 2 år til folkepension sker kapitalisering fra afgørelsesdagen.», Kap. % : «Ved ≤ 2 år til
    folkepension kapitaliseres hele EET.» Kapitaliseringsfanen viser **kun den ene af de to** («… sker
    kapitalisering fra afgørelsesdagen»), ingen specifikation overhovedet, og downloadknappen er grå med
    «Fejl i indtastning».
  - **Tomt:** ingen celle er rød, og Kapitaliseringsfanen skriver «**Endelig afgørelse under 50 % mangler
    oplysninger om kapitalisering**» med grå knap og «Indtastning mangler».
  - Den eneste lovlige indtastning er Kap.dato = **afgørelsesdatoen** (`01-06-2023`) og
    Kap. % = **hele EET-procenten** (`40`). Med dem kører fanen igennem og skriver «Kapitaliseret pga.
    < 2 år til folkepension? Ja» og «Særfaktor (< 2 år til folkepension) 1,245».
- **Det er uhensigtsmæssigt fordi:** de tre beskeder oplyser hver sin **regel** og ingen af dem den
  **handling**, brugeren skal foretage. Han står med to røde celler, retter dem til tomme, får en ny fejl,
  og har ingen anledning til at gætte, at han skal skrive netop afgørelsesdatoen og hele EET-procenten i
  de to felter, programmet lige har fortalt ham ikke må bruges frit. Det er en blindgyde i en helt
  almindelig sagstype – en endelig afgørelse tæt på folkepensionsalderen. Dertil kommer, at
  **beregningsmotoren i forvejen kan klare de tomme felter**: `collectResolvedRows`
  (`eetKapitaliseringCalculation.ts:384-397`) sætter selv kapitaliseringsdato = afgørelsesdato og
  kapitaliseringsprocent = EET % − tidligere kapitalisering i netop dette tilfælde. Det, der spærrer, er
  `hasEndeligUnder50MissingKap` i `eetAslAfgoerelser.ts:549-556`, som **mangler** ≤2-års-undtagelsen –
  mens søskende-reglen 250 linjer væk (`eetKapitaliseringCalculation.ts:264-277`) HAR den.
- **Bedre ville være:** de tomme felter er den rigtige indtastning. Giv
  `hasEndeligUnder50MissingKap` samme ≤2-års-undtagelse som sin søskende, så rækken går igennem med
  motorens egne værdier, og lad fanen sige det, den allerede kan sige: «Kapitaliseret pga. < 2 år til
  folkepension? Ja». De to røde celletekster skal samtidig navngive handlingen frem for reglen – fx
  «Kapitaliseringsdato udfyldes ikke: ved ≤ 2 år til folkepension kapitaliseres hele erhvervsevnetabet fra
  afgørelsesdagen».
- **Andre steder det kan gælde:** mønsterets prøve (M-29) er ny og billig: **find hvert felt, hvor både en
  udfyldt og en tom værdi kan udløse hver sin fejl, og læs de to beskeder efter hinanden.** Kandidater fra
  samme familie er de øvrige par af «må ikke udfyldes ved …»-feltregler og «mangler oplysninger om …»
  -fanefejl: `rg "mangler oplysninger om|må kun udfyldes ved" src/domain`.

**Tilbagemelding**
Jeg er enig.

### BB-169 – Skadelidtes folkepensionsalder er 68 år i den ene boks og 69 år i den anden

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afvist af udvikleren 2026-09-03 – velkendt for målgruppen at pensionsalderen er den, der gjaldt på afgørelsestidspunktet
- **Sådan fremprovokeres det:** sagen fra BB-166 med Beregningsdato `01-07-2026`. Læs rækken
  «Folkepensionsalder» i begge afgørelsesbokse.
- **Det sker:** samme person, to bokse på samme skærm, målt ordret:

  ```
  Afgørelse 1. juni 2019 · Folkepensionsalder  68 år
  Afgørelse 1. juni 2022 · Folkepensionsalder  69 år
  ```

  Intet på fanen forklarer forskellen. Årsagen er, at folkepensionsalderen slås op **på
  kapitaliseringstidspunktet** og derfor følger den lov, der gjaldt dengang (`folkepensionAlderRates.ts`).
  **Programmet kan godt formulere det:** Differencekrav-fanen skriver i samme sag «Mer-erstatning ved
  forhøjet folkepensionsalder – Forhøjelse pr. **31-12-2020 (68 år → 69 år)**».
- **Det er uhensigtsmæssigt fordi:** rækken hedder «Folkepensionsalder» og læses som en oplysning om
  skadelidte. En person har én folkepensionsalder, så to forskellige tal om samme person er en
  selvmodsigelse, brugeren skal bruge tid på at afvise – og i en sag, hvor netop pensionsalderens
  forhøjelse er et selvstændigt erstatningskrav (differencekravets mer-erstatning), er det den værst
  tænkelige oplysning at være i tvivl om. Rækken er ikke forkert; den mangler sin afsender.
- **Bedre ville være:** rækken navngiver sit opslagstidspunkt – «Folkepensionsalder (efter reglerne pr.
  01-06-2019)» – eller, hvis linjen skal være kort, en note i boksen om, at folkepensionsalderen er den,
  der gjaldt på kapitaliseringstidspunktet. Ordlyden bør være den samme som Differencekravs, som allerede
  siger det rigtige.
- **Andre steder det kan gælde:** `rg "folkepensionsalderLabel" src` – rækken vises også i Differencekravs
  proformakapitalisering og i mer-erstatningsboksen, hvor den kan optræde med en TREDJE værdi i samme sag
  (målt: `69 år` ved proformakapitalisering pr. `01-07-2026`). Generelt: hver værdi, der slås op på en
  dato, og hvis række ikke nævner datoen.

**Tilbagemelding**
Jeg afviser fundet. Det er tilstrækkeligt velkendt for brugeren, at erstatningen beregnes på baggrund af folkepensionsalderen på afgørelsestidspunktet. Det behøves ikke blive udpenslet.

### BB-170 – Specifikationen kan ikke efterregnes: hverken skadedato, årsløn eller afgørelsens EET-procent står i den

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **Delvist implementeret 2026-09-03** – efterregningskravet lempet for grundløn/årsløn/skadedato; afgørelsens egen EET-procent tilføjet i boksens overskrift
- **Sådan fremprovokeres det:** hent «Kapitalisering (EET)» på en almindelig sag og læs dokumentet fra
  top til bund. Sammenlign med skærmen.
- **Det sker:** dokumentet begynder ved et tal, der ikke kan udledes af noget i dokumentet. Målt ordret
  fra den hentede `.docx`:

  ```
  Kapitalisering (EET) · 3. september 2026
  Afgørelse 1. juni 2023
  Kapitaliseringsdato                                     01-06-2023
  Grundydelse og regulering
  Kapitalisering                                          40 %
  Grundydelse (40 %): Grundløn x EET x Erstatningsniveau x (100 % − AM-bidrag) =
  278.558 kr. x 40 % x 83 % x 92 %                        85.082,76 kr.
  ```

  **Grundløn `278.558 kr.` står som et bart tal.** Den er `400.000 × 367.000/527.000`, men hverken
  ASL-årslønnen (`400.000 kr.`) eller skadedatoen (`01-06-2018`) findes noget sted i dokumentet – og det
  er skadedatoen, der bestemmer både brøkens nævner (skadesårets maksimale årsløn), erstatningsniveauet
  (83 %) og AM-fradraget (92 %). Afgørelsens egen EET-procent står heller ikke: ved en delvist endelig
  afgørelse på 30 %, hvoraf 5 % kapitaliseres, skriver dokumentet kun «Kapitalisering 5 %». Skærmen har
  nøjagtig samme mangler.
- **Det er uhensigtsmæssigt fordi:** det er fanens eneste produkt, og det er dét papir, modparten skal
  kunne regne efter. Uden årsløn og skadedato kan han hverken kontrollere grundlønnen eller de to
  procentsatser – han kan kun tro på `278.558 kr.` Uden EET-procenten kan han ikke se, hvor stor en del af
  erhvervsevnetabet kapitalbeløbet dækker. **Samme program gør det rigtigt på nabofanen:** Løbende ydelsers
  udvidede specifikation viser grundlønnen led for led med skadedatoen i brøken («Maks. årsløn 1/6-2018»).
  Det er BB-122's rettelse på Forsørgertab, der ikke er nået hertil.
- **Bedre ville være:** dokumentet (og skærmen) får en forudsætningsblok øverst med skadedato/anmeldelsesdato
  og ASL-årsløn, og grundlønslinjen skrives som en formel i stedet for som et resultat – præcis som Løbende
  ydelser gør det. Afgørelsens EET-procent tilføjes i boksens overskrift, som Løbende ydelser allerede gør
  («Afgørelse 1. juni 2022 (30 %)»); det løser samtidig BB-171.
- **Andre steder det kan gælde:** samme forudsætningsprøve på EET efter EAL og Differencekrav (11d/11e), som
  begge trykker grundlønnen på samme måde. Prøven er BB-161's, skærpet: **læs dokumentets STANDARDUDGAVE og
  spørg, om hvert tal i den kan udledes af noget andet i den.**

**Tilbagemelding**
Beregningerne på kapitalisering-siden er gengivelser af afgørelser, som er modtaget fra en offentlig myndighed, hvor mellemregningerne har været inkluderet. På denne specifikke fane kan vi derfor tillade os at lempe kravet til efterberegning.

### BB-171 – To afgørelser truffet samme dag giver to bokse med samme overskrift

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 via BB-170's overskrift – se noten om hvorfor betinget udspecificering blev opgivet
- **Sådan fremprovokeres det:** to rækker med samme Afgørelsesdato `01-06-2019`, forskellig Virkningsdato
  (`01-01-2019` og `01-02-2019`), forskellig EET % (`20` og `30`) og forskellig Kap.dato
  (`01-06-2019` og `01-09-2019`), begge Delvist endelig.
- **Det sker:** fanen viser to bokse, og begge hedder ordret «**Afgørelse 1. juni 2019**» (målt). Kun
  linjen «Kapitaliseringsdato» inde i boksen skiller dem. Dokumentet trykker de to afgørelser på hver sin
  side, også med samme overskrift.
- **Det er uhensigtsmæssigt fordi:** overskriften er brugerens eneste holdepunkt for, hvilken række i
  afgørelsestabellen boksen svarer til. To identiske overskrifter tvinger ham til at læse indholdet for at
  finde ud af, hvad han kigger på – og i dokumentet, hvor de to sider ikke kan ses samtidig, er der ingen
  vej tilbage til rækken overhovedet. To afgørelser samme dag er ikke en kunstig konstruktion: en
  afgørelse om erhvervsevnetab og en om kapitalisering af en del af det træffes ofte samme dag.
- **Bedre ville være:** overskriften bærer det, der skiller de to – fx «Afgørelse 1. juni 2019 (30 %)» som
  på Løbende ydelser, eller «… – kapitaliseret 01-09-2019». Løbende ydelsers form løser begge behov og er
  allerede i drift.
- **Andre steder det kan gælde:** `rg "Afgørelse \\$\\{formatIsoDateLong" src` – samme overskriftsform bruges
  af kapitaliseringsdokumentet og af differencekravets afgørelsesafsnit.

**Tilbagemelding**
Jeg vil gerne begrænse mængden af visuelt rod, så jeg er enig i, at i det tilfælde, hvor der er tale om to afgørelser med identiske overskrifter, vil det være relevant at udspecificere nærmere, hvilken der er hvilken. Men kun i det tilfælde - ikke generelt, der er den nuværende tekst fint dækkende.

### BB-172 – Dokumentet siger «< 2 år» og «≤ 2 år» om samme regel i to linjer i træk

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 – `≤ 2 år` som delte konstanter i alle fire brugervendte forekomster
- **Sådan fremprovokeres det:** sagen fra BB-168 med de lovlige værdier (Kap.dato `01-06-2023`,
  Kap. % `40`). Hent dokumentet og læs de to linjer under «Kapitaliseringsbekendtgørelse og tabel».
- **Det sker:** tre skrivemåder for samme betingelse, målt ordret:
  - Dokument, linje 1: «Kapitaliseret pga. **< 2 år** til folkepension?» → `Ja`
  - Dokument, linje 2: «Særfaktor (**≤ 2 år** til folkepension)» → `1,245`
  - Skærm: **begge** linjer med `<`; feltbeskederne på EET oplysninger: **begge** med `≤`.
- **Det er uhensigtsmæssigt fordi:** de to linjer står lige over hinanden og handler om samme regel, og
  operatoren er hele reglens indhold. Læseren, der ser `<` og `≤` i træk, må gå ud fra, at der er to
  forskellige grænser. Programmets egen kommentar
  (`kapitaliseringDocument.ts:19-25`) siger udtrykkeligt, at `<` er en forenkling, og at reglen også
  omfatter kontroltidspunktet præcis 2 år før – altså er det `<`-linjen, der er upræcis, og den står i
  begge kanaler.
- **Bedre ville være:** `≤ 2 år` begge steder i begge kanaler, som feltbeskederne og som beregningen
  (`folkepensionsalderMaaneder − alder <= 24`) allerede siger. Den bevidste forenkling er ikke værd at
  betale to skrivemåder for.
- **Andre steder det kan gælde:** `rg "2 år til folkepension" src` giver fire brugervendte forekomster;
  `saerfaktorLabel` er den eneste, der er en erklæret option. Generelt: sammenlign ikke kun tallet, men
  operatoren omkring det – det er BB-163's lære med et andet tegn.

**Tilbagemelding**
Jeg er enig. ≤ 2 år skal være den korrekte og universelt anvendte betegnelse hver gang noget relaterer til dette.

### BB-173 – Kapitaliseringens 15 %-advarsel siger ikke, hvad den betyder, hvor EET-procentens gør

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 med **omvendt fortegn** – halen fjernet overalt i stedet for tilføjet; BB-158's halesætning er dermed omgjort
- **Sådan fremprovokeres det:** én række med EET % `20`, Delvist endelig, Kap. % `10`. Læs Kap. %-cellens
  gule advarsel og Kapitaliseringsfanens linje. Sammenlign med EET %-cellens advarsel ved værdien `10`.
- **Det sker:** to søskende-advarsler om samme lovgrænse, målt ordret:
  - Kap. % (gul ramme `rgb(245, 158, 11)` – BB-141's rettelse i drift) og fanens linje:
    «Der er angivet kapitalisering med mindre end 15 %»
  - EET %: «Der kan ikke tilkendes erhvervsevnetab under 15 % **– beregningen er derfor ikke lovmæssig**»
- **Det er uhensigtsmæssigt fordi:** den ene advarsel siger, hvad konsekvensen er; den anden gentager blot,
  hvad brugeren selv har skrevet. Læst efter hinanden ligner det to forskellige alvorsgrader for samme
  15 %-grænse. Udviklerens afgørelse på BB-158 var netop, at en værdi under mindstegrænsen skal advares som
  en **ikke-lovmæssig beregning**, og at balancen skal bruges **konsekvent** – halen mangler her.
- **Bedre ville være:** samme hale på begge: «Der er angivet kapitalisering med mindre end 15 % – beregningen
  er derfor ikke lovmæssig». Konstanterne står i samme fil
  (`eetFieldWarnings.ts`: `EET_UNDER_15_WARNING` og `KAPITALISERING_UNDER_15_WARNING`), og suffikset er
  allerede en delt konstant (`IKKE_LOVMAESSIG_BEREGNING_SUFFIX`).
- **Andre steder det kan gælde:** `rg "IKKE_LOVMAESSIG_BEREGNING_SUFFIX" src` – to af programmets fire
  under-mindstegrænse-advarsler bærer den i dag. Den fjerde kandidat er
  `warn-invalid-eet-pct-after-2024-07-01`, som HAR den.

**Tilbagemelding**
Jeg er enig i fundet, men ikke i løsningen. Halen med " – beregningen er derfor ikke lovmæssig" er problemet og burde ikke være der.

### BB-174 – Fanen viser to kapitalbeløb og ingen sum – heller ikke den samlede kapitaliseringsprocent, som feltreglen håndhæver

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afvist af udvikleren 2026-09-03 – fanen gengiver trufne afgørelser; intet trækkes fra her
- **Sådan fremprovokeres det:** sagen fra BB-166 med Beregningsdato `01-07-2026`. Rul til bunden af fanen.
- **Det sker:** det sidste, der står på fanen, er «Beregnet kapitalbeløb (16.527,32 kr. x 10,073) =
  **166.480 kr.**» (målt). Ovenfor står `504.884 kr.` i den anden boks. Summen `671.364 kr.` står ingen
  steder – hverken på skærmen eller i dokumentet. Det samme gælder procenterne: boksene siger
  «Kapitalisering 15 %» og «Kapitalisering 5 %», men ikke de samlede 20 %.
- **Det er uhensigtsmæssigt fordi:** kapitalbeløbet er fanens eneste produkt, og det tal, brugeren skriver
  i sit brev, er summen. Han skal lægge sammen selv – og ved fire afgørelser er det fire tal, han skal
  finde og addere korrekt i et dokument, der ellers regner alt for ham. Den samlede kapitaliseringsprocent
  er dertil den værdi, EET-oplysningernes egen feltregel håndhæver («… kan ikke overstige 50 % (inkl.
  tidligere kapitaliseringsprocenter)»), og den er usynlig netop dér, hvor kapitaliseringerne står samlet.
- **Bedre ville være:** en afsluttende «I alt»-boks med samlet kapitaliseringsprocent og samlet
  kapitalbeløb, i samme form som Løbende ydelsers I alt-række – med samme regel om, at summen dannes af de
  viste, afrundede beløb (`sumRoundedValues`), så «vist = beregnet» holder.
- **Andre steder det kan gælde:** EET efter EAL og Differencekrav (11d/11e) opgør hver sit enkeltbeløb og
  har ikke problemet; men Differencekrav trækker de samme kapitalbeløb fra ét ad gangen og viser heller
  ikke deres sum.

**Tilbagemelding**
Jeg afviser dit fund. Den nuværende adfærd er korrekt. Indholdet på selve kapitalisering-siden skal afspejle afgørelser, der allerede er truffet af myndighederne. I alt værdien har ingen betydning her, for indholdet trækkes ikke fra nogen steder. Der er heller ikke behov for at vise den samlede kapitalseringsprocent.

Bemærk, at forholdet er helt modsat, når der beregnes differencekrav og kapitaliseringsværdier indgår. Da fratrækkes den samlede sum af disse, og der sker proformakapitalisering af et tilbageværende ikke-kapitaliseret erhvervsevnetab.

### BB-175 – Rækken, der bærer kapitaliseringsprocenten, hedder bare «Kapitalisering»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Lav
- **Beslutning:** Delvist implementeret 2026-09-03 – «Kapitaliseringsprocent» indført; «Faktoropslag» afvist, og underoverskriften forbliver «Kapitaliseringsfaktor»
- **Sådan fremprovokeres det:** læs de to øverste rækker i en afgørelsesboks.
- **Det sker:** værdien `15 %` står ud for etiketten «**Kapitalisering**», mens datoen lige over står ud
  for «Kapitaliseringsdato». Samme værdi hedder «Kap. %» i afgørelsestabellen, «Kapitaliseringsprocent» i
  sine egne fejlbeskeder og «Kapitaliseret (15 %)» på Differencekrav – fire navne. Dertil står
  underoverskriften «Kapitaliseringsfaktor» umiddelbart over en række, der også hedder
  «Kapitaliseringsfaktor».
- **Det er uhensigtsmæssigt fordi:** «Kapitalisering» er ikke et navn på et tal, det er navnet på hele
  handlingen – og rækken står ved siden af «Kapitaliseringsdato», som netop navngiver sin egen art.
  Udviklerens afgørelse på BB-145 var, at tabeloverskriften må forkortes, mens henvisende tekster bruger
  det fulde navn; her er navnet hverken forkortet eller fuldt.
- **Bedre ville være:** «Kapitaliseringsprocent», som feltets egne fejlbeskeder allerede bruger. Rettelsen
  er ét sted (`eetKapitaliseringRows.ts`) og rammer skærm og dokument samtidig. Underoverskriften
  «Kapitaliseringsfaktor» kan samtidig blive «Faktoropslag», så den ikke gentager sin egen rækkes navn.
- **Andre steder det kan gælde:** Differencekravs proformaboks bruger samme builder med etiketten
  «Proformakapitalisering» og har derfor samme form.

**Tilbagemelding**
Enig i rettelsen til kapitaliseringsprocent. Ikke enig i rettelsen til Faktoropslag, det er et dårligt udtryk - vil det give mening at den hed Kapitaliseringsfaktor i stedet?

### BB-176 – Reguleringsdatoen skrives i lang form på skærmen og kort form i dokumentet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Implementeret 2026-09-03 – kort dansk form i begge kanaler; optionen fjernet, og differencekravs proformaboks rettet med
- **Sådan fremprovokeres det:** sammenlign rækken «Reguleringsprocent (…)» på skærmen med den samme række
  i det hentede dokument.
- **Det sker:** samme dato, to former, målt ordret:

  ```
  skærm:    Reguleringsprocent (1. juni 2023)     60,1 %
  dokument: Reguleringsprocent (01-06-2023)       60,1 %
  ```

  Divergensen er en erklæret option (`formatReguleringsdato`). Bemærk, at boksens to øvrige datoer er
  enige: overskriften «Afgørelse 1. juni 2023» er lang begge steder, og «Kapitaliseringsdato 01-06-2023»
  er kort begge steder. **Skærmen bruger dermed begge former i samme boks, og de to kanaler er kun uenige
  om den ene linje, hvor skærmen har valgt den lange.**
- **Det er uhensigtsmæssigt fordi:** de to udgaver skal kunne lægges ved siden af hinanden, og en dato er
  det, læseren bruger til at parre linjerne. Det er BB-087's og BB-146's form: samme værdi, samme flade, to
  skrivemåder – her endda med den ekstra ejendommelighed, at det er skærmen, der er internt uenig med sig
  selv.
- **Bedre ville være:** kort dansk form (`dd-mm-åååå`) i begge kanaler, som kapitaliseringsdatoen allerede
  bruger begge steder. `formatReguleringsdato`-optionen kan da fjernes.
- **Andre steder det kan gælde:** `rg "formatReguleringsdato" src` – optionen sættes af
  `EetKapitaliseringTab.tsx`, `kapitaliseringDocument.ts` og differencekravets to bokse; kun de to første
  er uenige.

**Tilbagemelding**
Enig

## Overvejet uden fund

- **Beregningen er kontrolregnet i tre sagsformer og er i orden** (se «Fladen kort»): 2003-niveau uden
  skift, 2003-niveau med 2024-opregulering, og særfaktor-grenen ved ≤ 2 år til folkepension. Grundløn,
  grundydelse, opregulering, årlig ydelse, faktoropslag og oprundingen af kapitalbeløbet er efterregnet i
  browseren for hver af dem.
- **2024-niveauskiftet er forklaret bedre her end på Løbende ydelser – ingen fund.** Linjen står i
  beregningen selv: «Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ 65,7 %):
  10.635,34 kr. x 1,657 = 17.622,76 kr.» Det er præcis den oplysning, BB-157 savnede i tabelform, og den
  behøver ingen note her, fordi mellemtrinnet er en egen række.
- **M-28's prøve er kørt og giver ét træf, som IKKE er et fund.** `tabelLabel` i
  `EetKapitaliseringAfgoerelseComputation` skrives af motoren og læses ingen steder
  (`rg "tabelLabel" src` giver kun schema og producent). Feltet er redundant, ikke manglende: tabellen står
  allerede i `kapitaliseringsbekendtgoerelseLabel` («Bkg. 1233/2018, tabel A»). Alle øvrige felter i
  schemaet renderes. **Det er mønsterets første negative træf, og det skærper prøven:** et urenderet felt er
  kun et brugerfund, hvis oplysningen ikke allerede står et andet sted i samme boks.
- **M-22 er efterprøvet og BESTÅET.** Fødselsdato `99-99-9999` i Stamdata giver «Der er udfyldt en ugyldig
  værdi i feltet 'Fødselsdato'» med linket «Stamdata → Skadelidte» og grå knap med «Fejl i indtastning».
- **Den tomme sag er velbehandlet – ingen fund.** Efter «Slet alt» viser fanen fire linjer, der hver
  navngiver sit felt og sin vej: «Fødselsdato er ikke udfyldt» og «Skadedato er ikke udfyldt» → Stamdata →
  Skadelidte, «Skadelidtes årsløn (efter ASL) er ikke udfyldt» og «Ingen ASL-afgørelser er indtastet» →
  EET oplysninger → Arbejdsskadesikringsloven. Knappen er grå med «Indtastning mangler». At der er fire
  linjer og ikke fem (beregningsdatoen mangler) er korrekt for denne fane – og er selv en del af BB-167.
- **Tom-specifikations-tilstanden findes og siger det rigtige.** Med én Endelig afgørelse på `50 %` uden
  kapitaliseringsfelter viser fanen advarslen «Der er ikke angivet kapitaliseringsdato eller -procent for
  nogen afgørelse» og boksen «Specifikation – Der er ingen kapitaliserede afgørelser i sagen.»
  Downloadknappen er **aktiv**, og dokumentet skriver samme sætning. Det er M-25 efterlevet: skærm og
  dokument er enige om fraværet, og gaten er fail-closed på severity, ikke en allowlist.
- **BB-141's rettelse er i drift her.** Kap. %-cellen får den gule ramme (målt `rgb(245, 158, 11)`) ved
  `10 %`, og fanens linje er den samme tekst. Reglen om, at kun første og samlede kapitalisering tæller,
  er efterprøvet: en anden afgørelse på `5 %` oven på en første på `15 %` giver ingen advarsel.
- **Særfaktor-grenen skjuler ikke sit tal.** Ved «Kapitaliseret pga. < 2 år til folkepension? Ja» udelades
  rækkerne «Faktor måneds-afhængig?» og «Kapitaliseringsfaktor», men kapitalbeløbslinjen skriver faktoren
  ud («136.217,50 kr. x **1,245**»), og 1,245 er netop den særfaktor, rækken ovenfor viser. Ingen usynlig
  faktor.
- **M-09 er målt og BESTÅET.** Bredeste boks 1164 px, højre kant ved x = 1478. Ved 1536×864 er
  `scrollWidth = innerWidth = 1536` – ingen vandret scroll.
- **M-10 er målt og BESTÅET.** «Scroll til toppen» ligger på x = 1451–1505, y = 779–833; fanens nederste
  højre indhold (kapitalbeløbets værdicelle) slutter ved x = 1435, y = 747. Ingen overlapning.
- **Tab-ringen er komplet.** Fanen har præcis ét fokuserbart element i indholdet – «Download som Word» –
  og Tab fra fanebladet lander på det. Det er den rigtige ring for en flade uden indtastning.
- **M-19, M-23 og M-27 er uden genstand.** Fanen spejler ingen stamdataoplysning (alder og
  folkepensionsalder er afledte, ikke spejlede), den har ingen `sum / enheder`-brøk, og den har ingen
  feltregler, en fremmed rød værdi kunne slukke.
- **Den grå downloadknap følger den aftalte grammatik** (`disabled` + blokeringsårsagen som `aria-label`)
  i alle tre målte blokeringer: «Fejl i indtastning», «Indtastning mangler» og den tomme specifikation.
  Bemærk dog, at den blokerede og den normale «Beregning»-boks er visuelt identiske bortset fra knappen
  (`EetDocumentDownloadBox` mod fanens egen boks) – det er bevidst og er allerede afgjort på flade 7a.
- **Konsollen var tavs gennem hele kørslen:** 184 beskeder, 0 fejl, 0 advarsler.

## Dækningshuller

- Kun Chrome, lyst tema, 1536×864. Mørkt tema og de tre øvrige browsere er ikke målt.
- PDF-kanalen er ikke læst; dokumentet er hentet som `.docx`. De to kanaler deler
  `kapitaliseringDocument.ts` og den delte rækkebuilder, så BB-170, BB-172 og BB-176 hviler på
  Word-udgaven plus kildelæsning.
- `Gem`/`Hent` er ikke afprøvet – filvælgeren kan ikke betjenes headless (samme hul som BB-049).
- Brevhovedet er ikke slået til i nogen kørsel; BB-170's «dokumentet nævner ikke skadedatoen» er målt uden
  brevhoved, som heller ikke bærer skadedatoen (kildelæst).
- «Meget mange afgørelser» (B3) er ikke målt; højst to kapitaliserede afgørelser er brugt. Med én boks pr.
  afgørelse er sidelængden lineær, og BB-174's sum-problem vokser med antallet.
- BB-168's grænsetilfælde er kun målt ved EET % `40`. Af kilden følger, at spærringen ikke opstår ved
  EET % ≥ 50, hvor `hasEndeligUnder50MissingKap` ikke rammer – det er ikke efterprøvet i browseren.
- Undo/redo og Escape er ikke afprøvet på fanen; den har ingen indtastningsfelter, så prøven hører på
  11a.

## Gennemført i kode – 2026-09-03

**Alle elleve fund er afgjort:** seks implementeret, to delvist, to afvist, ét trukket tilbage. Fem
forhold rækker ud over det enkelte fund og er værd at kende, før nogen genlæser afsnittet ovenfor.

**1. BB-166 var mit fund, og præmissen var forkert.** Jeg læste de to faners uenighed som en
selvmodsigelse, programmet skjulte for brugeren. Den rigtige læsning er, at hver fane opgør sin egen
ydelse: et kapitalbeløb hører til sin kapitaliseringsdato, og fanen er derfor bevidst uafhængig af
beregningsdatoen – ville den lade beregningsdatoen påvirke kapitaliseringerne, VILLE det være fejlen.
Det omvendte gælder i differencekravet, hvor kapitaliseringsværdier beregnes særskilt og kun medregnes
før beregningsdatoen. Fundet er trukket tilbage og genrejses ikke. **Læren for mønsteret «to flader,
to svar»:** to flader, der svarer forskelligt på det, der ser ud som samme spørgsmål, er kun et fund,
hvis de faktisk besvarer samme spørgsmål. Afklar først, hvad hver flade opgør – ellers registreres en
korrekt arbejdsdeling som en selvmodsigelse.

**2. BB-167's rettelse er hele forklaringen på, hvorfor BB-166 ikke er en fejl.** Beregningsdatoen er
væk fra fanen – ikke flyttet op i «Beregning»-boksen, som fundet foreslog, for der er ingen dato at
vise på en flade, hvis resultat ikke afhænger af en. Rækken var netop det, der fik den bevidste
uafhængighed til at ligne en fejl: den stod øverst i hver boks som en forudsætning, intet i boksen
læste. Princippet gælder KUN kapitalisering-fanen; på differencekrav er beregningsdatoen en ægte
afhængighed for proformakapitaliseringen og skal blive vist.

**3. BB-173 endte med omvendt fortegn, og det omgør BB-158.** Fundet var, at Kap. %-advarslen manglede
halen «– beregningen er derfor ikke lovmæssig», som EET %-advarslen havde. Udviklerens svar var, at
halen selv er problemet. Jeg pressede på, fordi BB-158 (2026-09-01) netop havde indført den og
forlangt den brugt konsekvent, og fordi fjernelsen også rammer
`warn-invalid-eet-pct-after-2024-07-01`. Afgørelsen blev alligevel at fjerne den overalt: hvad der kan
bruges juridisk, er brugerens vurdering, ikke programmets. Halen er derfor fjernet fra
`EET_UNDER_15_WARNING` og `EET_TITRIN_FRA_2024_WARNING`, og konstanten
`IKKE_LOVMAESSIG_BEREGNING_SUFFIX` findes ikke længere. Testen, der låste halen, er vendt om, så den
nu låser fraværet – ellers ville næste læsning af BB-158 genindføre den i god tro.

**4. BB-170's og BB-171's løsninger faldt sammen til én, og BB-171's «kun ved kollision» blev opgivet.**
Udviklerens ønske var at udspecificere overskriften alene i de tilfælde, hvor to afgørelser har
identisk overskrift. Det er ikke gennemførligt uden at gøre det værre: overskriften ville skifte form,
når en anden række i tabellen ændres, og i dokumentet, hvor de to sider ikke kan ses samtidig, kan
læseren ikke se, at der ER en kollision at udspecificere for. Løsningen på BB-170 – afgørelsens egen
EET-procent i overskriften, som Løbende ydelser allerede gør – dækker begge behov ubetinget og koster
fire tegn: «Afgørelse 1. juni 2023 (40 %)». Den skiller samtidig to afgørelser fra samme dag med
forskellig EET %, så BB-171's kollisionsfald skrumper til «samme dato OG samme EET %», hvor rækken
«Kapitaliseringsdato» inde i boksen gør arbejdet. BB-170's øvrige del – forudsætningsblok med
skadedato og årsløn, grundlønnen som formel – er droppet efter udviklerens lempelse: fanen gengiver en
myndighedsafgørelse, hvis mellemregninger har stået i den.

**5. Tre af rettelserne fjernede en «bevidst forskel» mellem skærm og dokument.** Rækkebuilderen bar
tre erklærede options, fordi de to kanaler med vilje skrev det samme forskelligt. To af dem var selve
fundet: særfaktor-etiketten (`<` mod `≤`, BB-172) og reguleringsdatoens format (lang mod kort,
BB-176). Begge er nu delte konstanter, og `KapitaliseringRowOptions` har kun Køn-rækkens synlighed
tilbage. **Læren:** en erklæret option, der bærer to skrivemåder af samme oplysning, er ikke en løsning
på divergensen – den er divergensen, dokumenteret. En option skal bære en forskel, der har en grund
(Køn-rækkens tomme værdi hører på en indtastningsflade, ikke i et dokument). BB-172's `≤` bliver dog
normaliseret til `<=` i PDF-kanalen, fordi jsPDF-fonten ikke kan sætte tegnet; begge linjer
normaliseres ens, så kravet om én operator holder også der.

**Efterprøvet i browseren** på BB-168's egen sag (fødselsdato `01-01-1958`, skadedato `01-06-2018`,
beregningsdato `01-07-2026`, ASL-årsløn `400.000`, én endelig afgørelse `01-06-2023` på 40 % med
Kap.dato og Kap. % TOMME): begge celler står neutrale (`aria-invalid = false`), fanen viser ingen
«Fejl og advarsler»-boks, downloadknappen er aktiv, og specifikationen skriver «Afgørelse 1. juni 2023
(40 %)», «Kapitaliseringsprocent 40 %», «Reguleringsprocent (01-06-2023)», «Kapitaliseret pga. ≤ 2 år
til folkepension? Ja», «Særfaktor (≤ 2 år til folkepension) 1,245» og kapitalbeløbet `169.591 kr.` –
samme tal som den håndregnede kontrol i «Fladen kort». Ingen Beregningsdato-række nogen steder.

**Gates:** 8193 unit-tests grønne, 156 e2e-tests grønne, `check:types`, `lint`, `check:mojibake` og
`verify:ledgers` rene. Karakteriseringstestens fire golden-hashes er opdateret, og snapshottet blev
dumpet før og efter for at bevise, at diffen KUN indeholder de to advarselstekster og de fire nye
`eetPct`-felter – **intet beløb flyttede sig**. Den fremgangsmåde står nu i testfilens egen header som
kravet til enhver senere hash-opdatering.

# Fane 4 – EET efter EAL

- Gennemgået: 2026-09-04 · commit `8b34f3b5`
- Afprøvet i: Chrome, lyst tema, 1536×864. Dokumentet hentet som `.docx` og læst linje for linje.

## Fladen kort

Fanen er **Erhvervsevnetabs tredje resultatfane** og den, der opgør kravet efter
**erstatningsansvarsloven**: årsløn, opregulering til beregningsåret, erhvervsevnetab gange den faste
faktor 10, loft ved årets maksimum og til sidst aldersreduktionen. Den har præcis én kontrol –
downloadknappen – og alt andet er visning. Strukturen er «Fejl og advarsler» (fælles `EetIssuesBox`), en
«Beregning»-boks med Beregningsdato og downloadknappen, og derefter én «Specifikation»-boks med fire
underafsnit: Årsløn · Erhvervsevnetab · Aldersreduktion · Beregnet EAL-krav.

**Skærm og dokument er ordret identiske.** `EetEfterEalTab.tsx` og `renderEfterEalBody` skriver de samme
19 linjer i samme rækkefølge med de samme formattere; dokumentet har ingen valgfri afsnit, så dets
standardudgave ER dens eneste udgave. Den ENESTE forskel er, at dokumentet udelader Beregningsdato-rækken,
når kroppen kaldes som bilag i differencekravet (`includeBeregningsdatoHeader`).

**Fanens særkende, og kilden til fem af fundene: den har TO fallbacks, og den siger aldrig hvilken vej den
gik.** Årslønnen er EAL-årslønnen, hvis den er udfyldt og positiv – ellers ASL-årslønnen. EET-procenten er
«EET % (hvis afviger fra ASL)», hvis den er udfyldt og ikke 0 – ellers den EET-procent, der findes ved at
vælge afgørelsen med den seneste afgørelsesdato, derefter den seneste virkningsdato, derefter `Endelig` frem
for `Delvist endelig` frem for resten. Begge valg er lagt i det kanoniske output som `aarsloenSource` og
`eetPctSource`; ingen af dem renderes nogen steder.

**Beregningsformlerne selv er kontrolregnet i fire sagsformer og er i orden.** Efterprøvet i browseren på
fødselsdato `01-01-1970`, skadedato `01-06-2018`, beregningsdato `01-07-2026`:
`400.000 × 1,255198 = 502.079,20` afrundet til nærmeste 500 → `502.000`; `× 10 × 30 % = 1.506.000`;
maksimum 2026 `11.582.500` (ikke ramt); alder 48 → aldersreduktion `48 − 29 = 19 %` → `286.140`;
EAL-krav `1.219.860 kr.` Dertil maksimum-grenen (`1.000.000 → 1.255.000 → 12.550.000 > 11.582.500`,
reduceret, EAL-krav `9.381.825 kr.`), aldersreduktionens loft (alder 75 → `(75 − 29) + (75 − 54) × 2
(max 70 %)` → `70 %`, EAL-krav `3.474.750 kr.`) og halvdelsafrundingen
(`6.588.750 × 19 % = 1.251.862,5 → 1.251.863`). **Ingen af de otte fund handler om en forkert formel** –
BB-178 handler om, hvilken afgørelse formlen får sin procent fra.

## Fund

### BB-177 – «Endeligt erhvervsevnetab» står over en procent, der kan komme fra en midlertidig afgørelse – og de tre andre faner navngiver typen

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-04 – «Erhvervsevnetab» som delt konstant `ERHVERVSEVNETAB_EAL_PCT_LABEL`; udviklerens begrundelse er stærkere end fundets: EAL kender slet ikke et midlertidigt erhvervsevnetab, så adjektivet er meningsløst frem for blot upræcist. Ordet BEVARES i Erstatningsopgørelsens ASL-sektion, hvor det navngiver en faktisk endelig afgørelse
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `01-01-1970`, Skadedato `01-06-2018`, Skadestype Arbejdsulykke.
  2. EET oplysninger: Beregningsdato `01-07-2026`, ASL-årsløn `400.000`. Lad EAL-felterne stå tomme.
  3. Én afgørelsesrække: Afgørelsesdato `01-01-2020`, Virkningsdato `01-01-2020`, EET % `30`,
     Afgørelsestype **Midlertidig**.
  4. Læs EET efter EAL, og derefter Løbende ydelser og Differencekrav.
- **Det sker:** EET efter EAL skriver «**Endeligt erhvervsevnetab** 30 %» og opgør `1.219.860 kr.` Ingen
  «Fejl og advarsler»-boks. På de to nabofaner står i samme sag ordret «Type: **Midlertidig afgørelse**»
  (Løbende ydelser) og «**Midlertidig afgørelse**» plus «Erhvervsevnetabet udgør 30 %» (Differencekrav).
  Samme måling med Afgørelsestype `Delvist endelig` og EET % `50` giver «Endeligt erhvervsevnetab **50 %**».
- **Det er uhensigtsmæssigt fordi:** ordet «Endeligt» er en påstand om sagen, ikke om beregningen.
  Programmet ved, at afgørelsen er midlertidig – det står ét faneklik væk og trykkes i to af de fire
  dokumenter – og fanen skriver alligevel det modsatte i den linje, der bærer specifikationens
  vigtigste tal. Linjen trykkes ordret i dokumentet, så en modpart læser, at erhvervsevnetabet er endeligt
  fastsat til 30 %, i en sag hvor det ikke er. Ved en `Delvist endelig` afgørelse er påstanden endnu
  skævere: netop den type betyder, at kun en del er endelig.
- **Bedre ville være:** rækken navngiver den EET-procent, fanen faktisk bruger, uden at udtale sig om
  afgørelsens karakter – «Erhvervsevnetab», som Forsørgertabs dokument allerede kalder præcis samme tal
  fra præcis samme beregning (`forsoergertabDocument.ts`, «Fuldt erhvervsevnetab» → «Erhvervsevnetab»).
  Skal typen med, kan den stå som Løbende ydelsers egen linje: «Erhvervsevnetab (midlertidig afgørelse)
  30 %». Det andet valg er billigere og fjerner påstanden helt; det første oplyser mere.
- **Andre steder det kan gælde:** `resolveErhvervsevnetabMaksimumTekst`s to grene siger «Skadelidtes
  erhvervsevnetab …» uden at kalde det endeligt og er upåvirkede. Generelt: hver linje på en resultatflade,
  der lægger et **kvalificerende adjektiv** på et tal, motoren blot har valgt efter en
  sorteringsregel – «endeligt», «samlet», «faktisk», «aktuel». Konkret kandidat: differencekravets
  «Resterende erhvervsevnetab».

**Tilbagemelding**
Erhvervsevnetab efter ASL og efter EAL har mange ligheder, men også mange forskelle. Præmissen for beregning efter EAL er, at hvis der ikke er angivet en specifik EET-procent for EAL lægges den seneste procent fra ASL til grund. Modsat ASL har EAL ikke midlertidigt EET. Jeg er enig i dit forslag om blot at omformulere fra "Endeligt erhvervsevnetab" til "Erhvervsevnetab" på al brugervendt tekst der relaterer til EET efter EAL.

### BB-178 – En senere midlertidig afgørelse fortrænger en endelig, og fanen siger intet – de to nabofaner advarer

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
- **Prioritet:** **Høj**
- **Beslutning:** Delvist implementeret 2026-09-04 – **udvælgelsen står uændret** efter udviklerens afgørelse: mangler en særskilt EET-procent efter EAL, gælder den seneste ASL-procent uden skelen til type, fordi EAL ikke kender et midlertidigt erhvervsevnetab. Kun tavsheden er rettet: `warn-non-endelig-after-endelig` er løftet fra løbende ydelsers motor til afgørelsestabellens eget modul og produceres nu også af EAL-motoren (kun ved fallbacken). Fundets punkt (2) – at sortere type før dato – er dermed AFVIST
- **Sådan fremprovokeres det:**
  1. Grundlaget som i BB-177 (fødselsdato `01-01-1970`, skadedato `01-06-2018`, beregningsdato
     `01-07-2026`, ASL-årsløn `400.000`, EAL-felterne tomme).
  2. Række 1: Afgørelsesdato `01-01-2020`, Virkningsdato `01-01-2020`, EET % **`50`**, **Endelig**.
  3. Række 2: Afgørelsesdato `01-01-2022`, Virkningsdato `01-01-2022`, EET % **`30`**, **Midlertidig**.
  4. Læs EET efter EAL. Ryd derefter række 2 og læs fanen igen.
- **Det sker:** med begge rækker skriver fanen «Endeligt erhvervsevnetab **30 %**» og
  «Beregnet EAL-krav **1.219.860 kr.**» – og har **ingen «Fejl og advarsler»-boks overhovedet**;
  downloadknappen er aktiv. Ryddes række 2, står «Endeligt erhvervsevnetab **50 %**» og
  «**2.033.100 kr.**» I samme tilstand skriver **både** Løbende ydelser **og** Differencekrav
  «Der er angivet en midlertidig afgørelse efter en endelig afgørelse.» med link til
  Arbejdsskadesikringsloven.
- **Det er uhensigtsmæssigt fordi:** den midlertidige afgørelse på 30 % fortrænger den endelige på 50 %,
  fordi udvælgelsen først sorterer på dato og først derefter på type. Forskellen er **813.240 kr.** i
  det tal, dokumentet slutter med, og fanen giver ikke det mindste signal: ingen boks, ingen linje,
  ingen grå knap. Brugeren har netop indtastet en endelig afgørelse på 50 % og ser et krav, der er regnet
  på 30 %. Programmet har allerede formuleret advarslen og viser den to faner væk – på faner, brugeren ikke
  behøver åbne for at hente EAL-specifikationen. Det er §5's punkt 2: et misvisende tal, brugeren ikke har
  nogen anledning til at betvivle.
- **Bedre ville være:** to ting, hvoraf den første er den vigtige. **(1)** EAL-motoren bærer samme advarsel
  som sine to søsterberegninger, når afgørelsestabellen indeholder en ikke-endelig afgørelse efter en
  endelig – issuet findes (`warn-non-endelig-after-endelig`) og skal blot føjes til `computeEetEalCalculation`
  og til `EAL_IDS`/navigationstabellen. **(2)** Udvælgelsen forelægges: er det rigtigt, at en senere
  midlertidig afgørelse fortrænger en tidligere endelig, når EAL-kravet skal opgøres? Sorterer man type før
  dato, ville 50 % vinde. Afgør ikke reglen her – men uanset hvilken vej den falder, skal fanen sige, at der
  er to afgørelser at vælge mellem.
- **Andre steder det kan gælde:** `resolveLoebendeEetPct` i `eetDifferencekravCalculation.ts:460-499` bruger
  ordret samme sorteringsrækkefølge (kommentaren siger selv «Tie-breaking matches fane 4's
  resolveEetPctFromAslRows»), så differencekravets rest-EET vælger samme afgørelse – dér med advarslen på
  plads. Generelt: hver motor, der **vælger én** ud af brugerens rækker efter en usynlig sorteringsregel.
  `rg "latestAfgoerelsesdato|reduce\(\(latest" src/domain` er indgangen.

**Tilbagemelding**
Se tilbagemelding på BB-177. Den korrekte, ønskværdige og forventelige adfærd for brugeren vil være, at hvis ikke der er angivet en særskilt EET-procent for EAL, anvendes den seneste EET-procent efter ASL, uden skelen til, om den er midlertidig eller endelig.

Jeg er dog enig i, at det vil være hensigtsmæssigt at gentage advarslen om, at der er indtastet en midlertidig afgørelse efter en endelig.

### BB-179 – En afgørelse truffet efter beregningsdatoen giver et fuldt EAL-krav her og blokerer nabofanen helt

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afvist for denne fane 2026-09-04 – EET efter EAL lægger forudsætningsvist ASL-procenten til grund, og afgørelsens tidspunkt er derfor uden betydning for EAL-kravet. **Uenigheden med Differencekrav er ikke løst her, men flyttet:** se det omformulerede åbne spørgsmål nedenfor og flade 11e
- **Sådan fremprovokeres det:**
  1. Grundlaget som i BB-177, men **Beregningsdato `01-01-2021`**.
  2. Én afgørelsesrække: Afgørelsesdato `01-06-2024`, Virkningsdato `01-06-2024`, EET % `30`, **Endelig**.
  3. Læs de fire faner efter hinanden.
- **Det sker:** de tre andre flader reagerer, EET efter EAL gør ikke:
  - **EET oplysninger:** begge datoceller bærer en **gul** ring (målt `rgb(245, 158, 11)`) med tooltip
    «Afgørelsesdatoen ligger efter beregningsdatoen (01-01-2021)» henholdsvis «Virkningsdatoen …».
  - **Løbende ydelser:** «Beregningsdatoen (01-01-2021) ligger før sagens afgørelser.»
  - **Differencekrav:** **blokeret** – «Der er ingen ASL-afgørelser med virkningsdato på eller før
    beregningsdatoen», downloadknappen grå.
  - **EET efter EAL:** ingen boks. Fuld specifikation og «Beregnet EAL-krav **1.038.825 kr.**»,
    downloadknappen aktiv (målt `disabled = false`).
- **Det er uhensigtsmæssigt fordi:** brugeren har sagt, at sagen gøres op pr. 1. januar 2021, og
  beregningsdatoen er **en ægte forudsætning her** – både opreguleringen («til beregningsår 2021») og
  maksimumsloftet («i beregningsåret 2021») kommer fra den. Alligevel henter fanen sin EET-procent fra en
  afgørelse, der først blev truffet tre og et halvt år senere, mens nabofanen erklærer, at der slet ikke
  findes en afgørelse pr. den dato – og det tal, Differencekrav nægter at regne, er præcis det tal, denne
  fane udleverer (fanens EAL-krav trykkes ordret i differencekravets «EAL-krav»-afsnit). Uanset hvilken af
  de to der er juridisk rigtig, kan brugeren ikke se, at der findes to svar.
- **Bedre ville være:** fanen bærer samme advarsel som Løbende ydelsers – «Beregningsdatoen (01-01-2021)
  ligger før sagens afgørelser» – og siger i én linje, hvad den så gør: at EAL-kravet opgøres på den
  fastsatte erhvervsevnetabsprocent, uanset hvornår afgørelsen blev truffet. Advarslen findes allerede som
  `EET_DATO_EFTER_BEREGNINGSDATO_WARNING_ID`. Er svaret i stedet, at en afgørelse efter beregningsdatoen
  ikke må bære EAL-kravet, skal fanen blokere som Differencekrav gør.
  **Bemærk BB-166's afgørelse, som IKKE må genrejses her:** Kapitalisering-fanen er bevidst uafhængig af
  beregningsdatoen, og dér ville det være fejlen, hvis den ikke var. Dette fund hviler på det modsatte
  forhold – beregningsdatoen ER en afhængighed på denne fane – og på uenigheden med Differencekrav om det
  SAMME tal.
- **Andre steder det kan gælde:** ingen. De to øvrige resultatfaner er målt i samme tilstand og
  reagerer begge (Løbende advarer, Differencekrav blokerer); Kapitalisering er uden genstand efter BB-166.

**Tilbagemelding**
Jeg tror, jeg afviser fundet. EET efter EAL er lidt specielt i den forstand, at det forudsætningsvist blot skal lægge EET-procenten fra ASL-sagen til grund, medmindre brugeren specifikt angiver en EET-procent efter EAL. Man bruger så at sige, hvad man kan finde i ASL. Så derfor har det heller ikke større betydning for EET efter EAL, hvis afgørelsen først kommer efter beregningstidspunktet.

**Modsvar 2026-09-04 – afvisningen er fulgt for fanen, men den flytter uenigheden i stedet for at lukke den**

Afvisningen er accepteret for denne fane: fanen regner videre uden advarsel, og fundets ønske om en
advarsel eller blokering HER er trukket tilbage. Men afvisningens egen begrundelse gør nabofanens
adfærd til problemet, og det er efterprøvet i koden:

- Differencekrav **blokerer** hele opgørelsen, når ingen afgørelse har virkningsdato ≤ beregningsdato:
  `no-asl-afgoerelser-known-at-beregningsdato` (`eetDifferencekravCalculation.ts:195-196`).
- Og differencekravsdokumentet trykker netop denne fanes krop som bilag:
  `renderEfterEalBody(writer, computation.ealComputation, false)` (`differencekravDocument.ts:527`).

I den målte sag kan brugeren derfor hente EAL-kravet `1.038.825 kr.` fra fane 4, mens fane 5 nægter
at trykke samme beløb som bilag. Er afgørelsens tidspunkt uden betydning for EAL-kravet, følger
deraf, at blokeringen er for hård – i hvert fald for EAL-halvdelen. Alternativt er blokeringen
rigtig for differencekravets ASL-halvdel, hvor virkningsdatoen faktisk styrer periodiseringen, og så
skal den blot ikke slå EAL-bilaget ud. **Det er beregningslogik og er ikke ændret.**

**AFGJORT 2026-09-04 – fundet er afvist i sin helhed, og modsvaret er besvaret.** Udviklerens svar:
differencekrav opstår udelukkende, når der er krav efter BÅDE ASL og EAL, så fladens forudsætninger
er anderledes end ved en «ren» EET efter EAL. Derfor kan en fejlmeddelelse være relevant på
differencekrav-fanen uden at være det på EAL-fanen, selv om de i en vis grad udspringer af samme
forhold. Differencekravets blokering er altså **korrekt**, og de to svar er ikke en selvmodsigelse.

**Læren, og den retter fundets egen præmis:** fundet sluttede fra «to faner siger forskelligt om
samme tal» til «de kan ikke begge være rigtige». Det holder kun, hvis de to faner besvarer samme
spørgsmål under samme forudsætninger. Her gør de ikke: EAL-fanen opgør ét krav isoleret, mens
differencekravet forudsætter en dobbeltdækket sag og skal kunne periodisere ASL-ydelserne. **Det er
BB-166's lære i en ny form** – dér var det arbejdsdelingen mellem to beregninger, her er det
forudsætningerne for to flader. Prøven for de resterende flader: før en divergens registreres, afklar
om de to flader har samme INPUT-forudsætning, ikke blot om de viser samme tal.

### BB-180 – Fanen bruger den ene af to udfyldte årsløn- og procentkilder og siger aldrig hvilken

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** Mellem
- **Beslutning:** Afvist af udvikleren 2026-09-04 – målgruppen ved, at der skal vurderes en årsløn efter EAL, og at ASL-årslønnen ofte er fallbacken. Det behøver ikke tydeliggøres. `aarsloenSource`/`eetPctSource` forbliver urenderede og er dermed et bevidst udfald af M-28, ikke et hul
- **Sådan fremprovokeres det:**
  1. Grundlaget som i BB-177 (ASL-årsløn `400.000`, én **Endelig** afgørelse på **50 %**).
  2. Udfyld dertil «Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)» = `700.000` og
     «EET % (hvis afviger fra ASL)» = `75`.
  3. Læs EET efter EAL, og derefter Løbende ydelser.
- **Det sker:** EET efter EAL skriver «Årsløn på skadestidspunktet **700.000 kr.**» og «Endeligt
  erhvervsevnetab **75 %**»; Løbende ydelser skriver i samme sag «Årsløn **400.000 kr.**» og
  «Erhvervsevnetab **50 %**». Ingen af fanens rækker siger, hvilket felt tallet kommer fra, og der er
  ingen tooltip på nogen af specifikationens rækker (målt: 0 af 19 rækker har `title` eller
  `aria-describedby`). De to ASL-værdier, brugeren også har indtastet, forsvinder tavst ud af opgørelsen.
- **Det er uhensigtsmæssigt fordi:** fanen har fire mulige indgange til to tal, og valget mellem dem er en
  regel, brugeren ikke kan se: «udfyldt og positiv vinder». En bruger, der har tastet begge årsløn (fordi
  ASL- og EAL-årslønnen faktisk er forskellige) og senere retter den ene, kan ikke se på specifikationen,
  om rettelsen slog igennem. Værre er den modsatte vej: et gammelt tal i det valgfri EAL-felt fortrænger
  den ASL-årsløn og den afgørelse, brugeren netop har opdateret – og de to faner viser da hver sit
  grundlag uden en linje om, at de har hvert sit. Feltnavnenes «(hvis forskellig fra ASL)» og «(hvis
  afviger fra ASL)» oplyser, hvornår man SKAL udfylde dem, ikke hvad der så sker.
  **Programmet ved besked:** `aarsloenSource` og `eetPctSource` ligger i det kanoniske output
  (`eetCanonicalOutput.ts:25,30`) og renderes ingen steder – `rg "aarsloenSource|eetPctSource" src/components
  src/document` giver nul træf.
- **Bedre ville være:** de to rækker navngiver deres kilde med de ord, felterne bærer på skærmen – «Årsløn
  på skadestidspunktet (efter EAL)» / «(efter ASL)» og «Endeligt erhvervsevnetab (angivet efter EAL)» /
  «(fra afgørelse 1. januar 2020)». Kilden er allerede afgjort og typet; det koster ingen beregning at
  skrive den. Samme linje hører i dokumentet, hvor den dertil besvarer BB-182's spørgsmål om, hvilket af
  sagens to årslønsbegreber modparten skal regne efter.
- **Andre steder det kan gælde:** `forsoergertabEalKrav.ts:117,131` fører `aarsloenSource` videre til
  Forsørgertabs port, hvor den heller ikke renderes – samme fund på flade 10, samme rettelse. Generelt:
  hver beregning med en `source`-diskriminant i sit output. `rg "Source: z.enum" src/domain` er indgangen.

**Tilbagemelding**
Jeg tror, jeg afviser dit fund. Det vil være velkendt, at der skal vurderes en årsløn efter EAL, og at man ofte vil falde tilbage på at bruge årslønnen efter ASL som fallback. Det behøves ikke tydeliggjort.

### BB-181 – «Erhvervsevnetabsprocent er ikke udfyldt» fører til det valgfrie EAL-felt, hvor de tre andre faner peger på afgørelsen, der mangler sin EET %

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** **Høj**
- **Beslutning:** Implementeret 2026-09-04 efter det opdelte forslag – fundets ORIGINALE anbefaling er afvist (EAL er udgangspunktet, ikke ASL), men de to tilstande skelnes nu: en påbegyndt afgørelse uden EET % peger på afgørelsestabellen med cellen som fokusmål, mens en sag helt uden afgørelser får en besked, der nævner begge veje og linker til EAL-feltet
- **Sådan fremprovokeres det:**
  1. Grundlaget som i BB-177, men lad afgørelsesrækkens **EET %** stå tom: Afgørelsesdato `01-01-2020`,
     Virkningsdato `01-01-2020`, Afgørelsestype `Endelig`, EET % **tom**.
  2. Læs «Fejl og advarsler» på alle fire faner.
- **Det sker:** tre faner peger på afgørelsen, én peger et andet sted – målt ordret:
  - **Løbende ydelser:** «Der er en afgørelse uden EET %» → EET oplysninger → **Arbejdsskadesikringsloven**
  - **Kapitalisering:** «Der er en afgørelse uden EET %» → EET oplysninger → **Arbejdsskadesikringsloven**
  - **Differencekrav:** «Der er en afgørelse uden EET %» → EET oplysninger → **Arbejdsskadesikringsloven**
  - **EET efter EAL:** «**Erhvervsevnetabsprocent er ikke udfyldt**» → EET oplysninger →
    **Erstatningsansvarsloven**
  På en helt tom sag står samme linje i fanens boks, umiddelbart under «Skadelidtes årsløn (efter ASL) er
  ikke udfyldt» – som navngiver sit felt ordret. Afgørelsestabellens EET %-celle er neutral i begge
  tilstande (målt `aria-invalid = false`).
- **Det er uhensigtsmæssigt fordi:** linjen navngiver et begreb, der ikke er navnet på nogen af de to
  felter, den kan handle om, og linket fører til det **valgfrie** – feltet, hvis egen etiket siger «(hvis
  afviger fra ASL)». Brugeren, der følger linket og udfylder feltet, får fanen til at regne, men har
  samtidig sat en EAL-afvigelse, han ikke mente, mens den afgørelse, han faktisk skulle gøre færdig, står
  tilbage uden sin EET-procent – så de tre andre faner bliver blokeret, uden at han har rørt dem. Det er
  både en fejlanvisning (§5's punkt 5: feedback, der ikke kan handles på rigtigt) og en blindgyde for de
  øvrige tre dokumenter. Nabolinjen i samme boks viser, hvordan det skal se ud: «Skadelidtes årsløn (efter
  ASL) er ikke udfyldt» med link til Arbejdsskadesikringsloven, selv om **den** værdi har præcis samme
  to-kilde-struktur.
- **Bedre ville være:** fanen bruger de tre andre faners besked og deres mål, når manglen ligger i
  afgørelsestabellen: «Der er en afgørelse uden EET %» → Arbejdsskadesikringsloven, med den tomme
  indtastningsrækkes celle som fokusmål (`ASL_FIRST_ROW_FIELD_BY_ISSUE_ID` har allerede
  `missing-eet-pct` → `aslAfgoerelseEetPctField.template`). Kun når der hverken findes en afgørelsesrække
  eller en EAL-procent, skal beskeden nævne begge veje – «Erhvervsevnetabsprocenten mangler: udfyld EET %
  på en afgørelse, eller angiv en afvigende procent efter EAL».
- **Andre steder det kan gælde:** samme fane, samme struktur, for årslønnen – dér er `aarsloen-missing`
  korrekt bundet til ASL-feltet, og `eal-aarsloen-missing`/`eal-aarsloen-zero` til EAL-feltet, så
  halvdelen er allerede rigtig. Generelt: hvert issue, hvis besked navngiver et **begreb** frem for et
  felt, i en beregning med mere end én kilde. `rg "er ikke udfyldt" src/domain/erhvervsevnetab` er
  indgangen.

**Tilbagemelding**
Jeg tror dit anbefaling er forkert. Udgangspunktet for EET efter EAL er, at brugeren angiver det specifikt for EAL. Visse sager er kun omfattet af EAL, og ikke af ASL, så der giver det ingen mening at pege brugeren i retning af, at skulle indtaste værdier efter ASL. ASL er kun en fallback, og den vil kun være udfyldt i de sager, som både er omfattet af EAL og ASL. Så det mest korrekte må være, at hvis der hverken er oplysninger efter EAL eller ASL, at pege brugeren i retning af EAL, når der er tale om EET efter EAL.

**Modsvar 2026-09-04 – tilbagemeldingen dækker den rene sag, ikke den målte**

Rangordenen (EAL er udgangspunktet, ASL kun fallback) er accepteret og lægges til grund. Men den
besvarer kun den ene af to tilstande, `eet-pct-missing` opstår i, og fundets måling er den anden:

1. **Ingen afgørelsesrækker og ingen EAL-procent** – den rene sag. Her er tilbagemeldingen
   utvivlsomt rigtig: linket skal føre til Erstatningsansvarsloven.
2. **Der ER en fuldt udfyldt Endelig afgørelse, men dens EET %-celle står tom.** Dette er den
   tilstand, fundet målte. `resolveEetPct` finder rækken, men `parseCommittedPercent` giver
   `undefined`, så `resolved` er `null` (`eetEalCalculation.ts:152-155`), og fanen skriver
   «Erhvervsevnetabsprocent er ikke udfyldt» med link til det VALGFRIE EAL-felt. Brugeren, der
   følger linket, sætter en EAL-afvigelse han ikke mente, mens den afgørelse han skulle gøre færdig
   står tilbage uden sin procent – og de tre andre faner er nu blokeret, uden at han har rørt dem.

Tre målinger viser dertil, at koden i dag ikke selv følger rangordenen: feltets etiket er
«EET % (hvis afviger fra ASL)» (altså erklæret valgfrit), nabolinjen for årslønnen med samme
to-kilde-struktur peger på **Arbejdsskadesikringsloven**
(`SKADELIDTES_AARSLOEN_ASL_LABEL`, `eetEalCalculation.ts:251`), og de tre øvrige faner peger på
afgørelsen. Efter tilbagemeldingen vil to linjer i SAMME boks udpege hvert sit lovsæt som
udgangspunkt for samme sag.

**Forelagt forslag, som følger rangordenen men skelner de to tilstande:**

| Tilstand | Besked | Link |
|---|---|---|
| Ingen EAL-procent, og en afgørelsesrække mangler sin EET % | «Der er en afgørelse uden EET %» | Arbejdsskadesikringsloven |
| Ingen EAL-procent, og ingen afgørelsesrækker | «Erhvervsevnetabsprocenten er ikke udfyldt» | **Erstatningsansvarsloven** |

Dermed er EAL udgangspunktet, når der ikke er noget ASL – præcis som tilbagemeldingen beskriver –
mens en halvfærdig ASL-afgørelse udpeger sin egen tomme celle.

**Godkendt og gennemført 2026-09-04.** Udvikleren tilsluttede sig opdelingen. Implementeringen:

- `hasStartedRowMissingEetPct` og `MISSING_EET_PCT_MESSAGE` er løftet til afgørelsestabellens eget
  modul (`eetAslAfgoerelser.ts`), så EAL-motoren og `collectIncompleteRowIssues` ikke kan drifte fra
  hinanden. Tabelmodulets egen inline-streng er erstattet af konstanten.
- EAL-motoren vælger nu mellem de to id'er: er en række påbegyndt uden procent, udsendes
  `missing-eet-pct` (ordret de tre andre faners besked, med `aslAfgoerelseEetPctField.template` som
  fokusmål gennem den eksisterende `ASL_FIRST_ROW_FIELD_BY_ISSUE_ID`); ellers `eet-pct-missing`.
- Den generelle besked er samtidig omformuleret fra «Erhvervsevnetabsprocent er ikke udfyldt» til
  **«Erhvervsevnetabsprocenten mangler: angiv EET % efter EAL, eller udfyld EET % på en afgørelse»**.
  Den navngav før et BEGREB frem for et felt (M-02's form) og fortalte ikke, at manglen kunne
  afhjælpes ad to veje. Den linker fortsat til EAL-feltet, fordi det er den vej, der altid er åben.

**Efterprøvet, at differencekravets to undertrykkelser af `eet-pct-missing` fortsat er sikre**
(`eetDifferencekravCalculation.ts:706,709`): når EAL-motoren nu udsender `missing-eet-pct` i stedet,
rejser differencekravets egen kæde allerede samme id med samme ordlyd gennem
`kapResult.issues` → `collectIncompleteRowIssues`, og `dedupeIssuesByIdentity` fjerner dubletten på
nøglen `id|severity|message`. Download-gaten klassificerer begge id'er som «Indtastning mangler», så
gate-adfærden er uændret. Låst af tre unittests og to e2e-tests, hvoraf den ene følger linket og
hævder, at fokus lander i afgørelsestabellens EET %-celle.

### BB-182 – Specifikationen mangler skadedatoen, som både alderen og opreguleringen hviler på

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-04 – skadedato-række på skærm og i dokument. **Placeret i «Specifikation» og ikke i «Beregning», som fundet foreslog:** differencekravet trykker kroppen som bilag med `includeBeregningsdatoHeader = false`, så en række i headeren var forsvundet i netop det dokument, der har mest brug for den – og differencekravets egen krop skriver ikke datoen. Formen er kort `dd-mm-åååå` som fødselsdato-rækken, så de to datoer bag aldersreduktionen kan læses op mod hinanden (BB-146)
- **Sådan fremprovokeres det:** grundlaget fra BB-177; hent dokumentet («Download som Word») og læs det
  linje for linje. Sammenlign med Forsørgertabs dokument på samme sagsgrundlag.
- **Det sker:** dokumentet indeholder 19 linjer, og sagens skadedato er ikke en af dem. Det nærmeste er
  «Regulering fra skadesår **2018** til beregningsår 2026» – som udgår helt, hvis skadesår og beregningsår
  er det samme. Derimod står **Fødselsdato `01-01-1970`** som selvstændig række, umiddelbart over «Alder på
  skadestidspunkt **48 år**». Skærmen viser præcis det samme. Forsørgertabs dokument, som opgør det samme
  EAL-krav af den samme beregning, skriver skadedatoen i sin «Grundlæggende oplysninger»-sektion
  (`forsoergertabDocument.ts:91-92`, rettet ved BB-122 2026-08-28).
- **Det er uhensigtsmæssigt fordi:** de to tal, der bærer hele aldersreduktionen, er fødselsdatoen og
  skadedatoen – og dokumentet giver kun den ene. En modpart, der læser «Fødselsdato 01-01-1970» og «Alder
  på skadestidspunkt 48 år», kan ikke kontrollere alderen, kun indsnævre skadedatoen til et interval på
  et år; og netop et års forskel er hvad der flytter aldersreduktionen et procentpoint og
  opreguleringen et helt reguleringsår. Fanen har taget den vanskelige halvdel med og udeladt den lette.
  Dokumentet har ingen valgfri afsnit, så manglen kan ikke slås til, og brevhovedet bærer heller ikke
  datoen.
- **Bedre ville være:** en «Skadedato»-række (ved erhvervssygdom «Anmeldelsesdato», som resten af fanen
  allerede navngiver korrekt) i «Beregning»-boksen ved siden af Beregningsdato – på skærmen og i
  dokumentet. Det er samme rettelse, Forsørgertab og Varige mén allerede har fået, så det er en
  konvergens, ikke et nyt design.
- **Andre steder det kan gælde:** Kapitalisering-fanen (BB-170's forudsætningsdel blev droppet dér, fordi
  fanen gengiver en myndighedsafgørelse – lempelsen gælder udtrykkeligt IKKE denne fane) og
  Differencekrav, som trykker EAL-kroppen som bilag og dertil har sin egen forudsætningsblok. Generelt:
  BB-170's prøve, kørt på hvert dokument – læs standardudgaven og spørg for hvert tal, om det kan
  kontrolleres af noget ANDET i dokumentet.

**Tilbagemelding**
Jeg er enig.

### BB-183 – «Skadelidtes årsløn efter EAL skal udfyldes med den fulde årsløn» står kun i boksen, hvor nabofeltets samme regel har en gul ring

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
- **Prioritet:** Mellem
- **Beslutning:** Implementeret 2026-09-04 – EAL-feltet bærer nu den gule ring i BEGGE halvdele af reglen. **Fundets egen beskrivelse var delvist forkert, se rettelsen efter tilbagemeldingen**
- **Sådan fremprovokeres det:**
  1. Grundlaget fra BB-177 (skadedato `01-06-2018`, hvis ASL-maksimum er `527.000 kr.`).
  2. Sæt «Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)» til **`527.000`**.
  3. Læs feltet på EET oplysninger, og derefter boksen på EET efter EAL.
- **Det sker:** feltet er **neutralt** – målt notched border `rgba(0, 0, 0, 0.12)`, ingen tooltip, ingen
  `aria-describedby`. Advarslen «Skadelidtes årsløn efter EAL skal udfyldes med den fulde årsløn – ikke
  maks. årslønnen efter ASL» står udelukkende i «Fejl og advarsler» på EET efter EAL (og på
  Differencekrav). Den **spejlvendte** situation – ASL-årslønnen på maksimum og EAL-feltet tomt – giver
  derimod en gul ring på ASL-feltet med samme tekst (`resolveEetAslAarsloenMaxWarning`,
  `EetOplysningerTab.tsx:186`).
- **Det er uhensigtsmæssigt fordi:** advarslen afhænger af ét felts egen værdi og sagens skadedato – den
  samme præmis, som `resolveEetTitrinWarning` blev accepteret på ved BB-158 – og hører derfor ved feltet,
  hvor brugeren sidder og taster. Som det er nu, får den ene halvdel af den samme regel en ring, og den
  anden halvdel kun en linje på en resultatfane, brugeren ikke behøver åbne. Udviklerens afgørelse ved
  BB-142 peger samme vej: indtastningsfanen viser fejl i faktisk foretagne indtastninger som rød eller gul
  ring med tooltip.
- **Bedre ville være:** `resolveEetAslAarsloenMaxWarning` udvides (eller får en søster), så EAL-feltet
  bærer den gule ring med samme tekst, når dets egen værdi er lig skadesårets ASL-maksimum. Motorens
  `warn-eal-aarsloen-is-max` bliver da feltets spejl, præcis som `warn-asl-aarsloen-is-max` allerede er.
- **Andre steder det kan gælde:** `warn-eal-aarsloen-empty-for-2024-07-01` («For skader fra 1. juli 2024 og
  frem beregnes årsløn forskelligt efter EAL og ASL») har samme form – udløst af ét felts tomhed plus
  skadedatoen, vist kun i boksen. Den er ikke målt i denne kørsel. Generelt: BB-141's prøve, kørt på
  fanens `warn-*`-issues – `EAL_IDS` i `eetFormatUtils.ts:223-233` er listen.

**Tilbagemelding**
Jeg er enig.

**Rettelse af fundet 2026-09-04 – to påstande i fundet holdt ikke ved kildelæsning**

Tilbagemeldingen er fulgt, men mit eget fund beskrev mekanikken forkert på to punkter, og det ændrer,
hvad rettelsen bestod i:

1. **Ringen sad allerede på EAL-feltet, ikke på ASL-feltet.** `resolveEetAslAarsloenMaxWarning` var
   bundet til `ealAarsloen` (`EetOplysningerTab.tsx:186`), og ASL-feltet har slet ingen
   `warning`-prop. Fundets sætning om «en gul ring på ASL-feltet» var forkert. Reglen var altså ikke
   implementeret på det forkerte felt – den var på det rigtige felt, men dækkede kun den ene af to
   tilstande: EAL-feltet TOMT plus ASL-årslønnen på maksimum.
2. **De to advarsler bar to forskellige tekster.** Feltringen brugte `ASL_AARSLOEN_MAX_NOTICE` («Når
   Skadelidtes årsløn (efter ASL) svarer til maksimum, skal den faktiske årsløn indtastes.»), mens
   boksens `warn-eal-aarsloen-is-max` brugte en helt anden sætning. Fundet antog, at ordlyden var
   fælles.

**Rettelsen er derfor:** en søsterfunktion `hasEetEalAarsloenMaxWarning` for den manglende tilstand –
EAL-feltet udfyldt MED skadesårets ASL-maksimum – og `resolveEetAslAarsloenMaxWarning` vælger nu
mellem de to i samme rækkefølge som beregningen (udfyldt felt først). Beregningens to `toWarning`-kald
bruger den nye delte konstant `EET_EAL_AARSLOEN_MAX_WARNING`, så feltringen og boksen ikke længere kan
sige to ting om samme regel. Verificeret i browseren (`e2e/eetEfterEalSpecifikation.spec.ts`).

**Læren, der rækker ud over fundet:** en advarsel kan være «implementeret» og alligevel kun dække den
halve regel. Prøven er ikke «har feltet en ring?», men «har feltet en ring i HVER af de tilstande,
reglen kan brydes i?» – her var der to, og kun én var dækket.

### BB-184 – «Kapitaliseringsfaktor» er navnet på to helt forskellige størrelser på to faner af samme side

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Lav
- **Beslutning:** Afvist af udvikleren 2026-09-04 – kapitaliseringsfaktor er SAMME begreb i ASL og EAL; eneste forskel er, at ASL fastsætter den ved tabelopslag og EAL altid ved 10. Målgruppen kender og forventer det. **Afledt følge:** BB-177's omdøbning er dermed afgrænset til ordet «Endeligt» og må ikke brede sig til «Kapitaliseringsfaktor»
- **Sådan fremprovokeres det:** en sag med både en kapitaliseret afgørelse og et EAL-krav; læs rækken
  «Kapitaliseringsfaktor» på Kapitalisering og på EET efter EAL.
- **Det sker:** på **Kapitalisering** er «Kapitaliseringsfaktor» både et underafsnit og en række, og
  værdien er den aldersafhængige faktor fra kapitaliseringsbekendtgørelsen – målt `10,772` for en
  49-årig efter Bkg. 1233/2018 tabel A, med tre decimaler. På **EET efter EAL** hedder rækken det samme
  og bærer værdien **`10`** – erstatningsansvarslovens faste faktor, uden decimaler og uden nogen
  bekendtgørelse bag sig.
- **Det er uhensigtsmæssigt fordi:** to naborækker med identisk navn og værdierne `10,772` og `10` ser ud
  som samme størrelse med afrunding. De er det ikke: den ene er en tabelopslagsfaktor, der afhænger af
  alder, køn og bekendtgørelse; den anden er en lovbestemt konstant. Fanen giver ingen ledetråd om
  forskellen – hverken en lovhenvisning, en decimalform eller et informationsikon – og de to faner ligger
  ét klik fra hinanden i samme sag.
- **Bedre ville være:** rækken på EET efter EAL navngiver sin egen faktor: «Kapitaliseringsfaktor (EAL)»
  eller, tættere på loven, «Faktor efter erstatningsansvarsloven». Alternativt et informationsikon som
  Køn-rækkens, der siger, at faktoren er fast efter loven. Kapitalisering-fanens navn er det, der har
  hjemmel i en bekendtgørelse, og bør blive.
- **Andre steder det kan gælde:** Forsørgertabs dokument skriver samme række med samme navn og samme faste
  faktor 10 (`forsoergertabDocument.ts:196`), og «Fladen kort» i `forsoergertab.md` kalder den
  «kapitaliseringsfaktor 10». Generelt: hvert begreb, der bærer samme navn i ASL- og EAL-halvdelen af
  programmet uden at være samme størrelse. Kandidater: «Erhvervsevnetab», «Årsløn», «Regulering».

**Tilbagemelding**
Jeg afviser fundet. Kapitaliseringsfaktor er det samme begreb i EAL og ASL. Eneste forskel er, at efter ASL fastsættes den ved tabelopslag, og i EAL er den altid 10. Brugeren ved dette og vil forvente det. Det behøves ikke udpenslet.

## Overvejet uden fund

- **Beregningen er kontrolregnet i fire sagsformer** (basis, maksimum-grenen, aldersreduktionens 70 %-loft
  og halvdelsafrundingen) – alle tal går op, se «Fladen kort».
- **Skærm mod dokument: ordret identiske.** Alle 19 linjer, alle tal, alle formler og alle tegn er
  sammenlignet i Word-udgaven. `formatPct`, `formatKr`, `formatDeductionKr` og `formatDeductionPercent` er
  de samme kald i de to kanaler, og `buildAldersreduktionEtiket` og `resolveErhvervsevnetabMaksimumTekst`
  er delte konstanter. Dokumentet har ingen valgfri afsnit, så BB-161's «læs standardudgaven»-prøve er
  uden genstand.
- **M-13's tredje trin (dokument mod dokument) er uden genstand:** fanen har ét dokument. EAL-kroppen
  optræder dertil som bilag i differencekravet gennem samme funktion, så en divergens kan ikke opstå;
  prøven på bilagets placering hører på 11e.
- **«(afrundet)» uden angivelse af hvad der afrundes til** er **BB-131 igen, ordret samme linje** – afvist
  2026-08-28, fordi målgruppen kender afrundingsprincippet for årslønnen efter EAL. Rejses ikke.
  (Målt: `400.000 × 1,255198 = 502.079,20`, vist `502.000` – afrunding til nærmeste 500.)
- **BB-167's prøve («ændr hver værdi og se, om noget andet ændrer sig») er kørt og bestået.** Fanens
  Beregningsdato-række er ikke dekorativ: den styrer både opreguleringens slutår og maksimumsloftets år,
  målt ved skiftet `01-07-2026` → `01-01-2021` (`+ 25,5198 %` → `+ 6,8507 %`, maksimum `11.582.500` →
  `9.859.500`). Rækken «Kapitaliseringsfaktor» er en konstant, men indgår i næste linjes formel og er
  derfor ikke dekorativ.
- **M-02/BB-121's skadestype-prøve er kørt og BESTÅET på hele fanen.** Med Skadestype `Erhvervssygdom`
  skriver fanen «Årsløn på **anmeldelsestidspunktet**», «Regulering fra **anmeldelsesår** 2018» og «Alder
  på **anmeldelsestidspunkt**», og den røde skadedatos besked hedder «feltet 'Anmeldelsesdato'». Navnet
  udledes af beregningens egen `skadestype`, ikke af dokumentets `stamdata`, så bilaget i differencekravet
  får samme navn med brevhovedet slået fra.
- **M-19/M-22/M-27's prøve er kørt og BESTÅET.** Med Skadedato `99-99-9999` i Stamdata blokerer fanen med
  «Der er udfyldt en ugyldig værdi i feltet 'Anmeldelsesdato'» → **Stamdata →** (navngivet link) og
  knappen «Fejl i indtastning». Rødt læses altså ikke som tomt, den fremmede flade navngives, og ingen
  feltregel slukkes tavst – fanen har i øvrigt ingen egne felter, så M-27 er uden genstand.
- **M-10's prøve er kørt og BESTÅET.** Ved 1536×864 og fuldt rullet fane ligger «Scroll til toppen» på
  x 1451–1505, y 779–833; specifikationens værdikolonne ender ved x 1435, og ingen `p` eller `button` i
  indholdsboksene overlapper knappen (målt: tom overlap-liste).
- **M-28's prøve (trin 1 og 2) er kørt.** Af `eetEalComputationSchema`s 22 felter renderes 18; de fire
  urenderede er `aarsloenSource` og `eetPctSource` (**BB-180**), `alderVedSkadeCapped` og `skadedato`
  (**BB-182**). `alderVedSkadeCapped` er mønsterets **andet negative træf** og er ikke et brugerfund:
  loftet står allerede i etiketten som «(max 70 %)», så feltet er redundant, ikke manglende – præcis
  `tabelLabel`s form fra BB-176. Trin 2 gav intet: modulets to eksporter (`computeEetEalCalculation`,
  `buildAldersreduktionEtiket`) har begge produktionskaldssider.
- **M-25's prøve er uden genstand.** Fanen har én beregning og ét dokument uden valgfri afsnit, så der
  findes ikke et ELLER mellem to `canShow`-flag. Dens to fallbacks vælger mellem kilder til det samme tal;
  konsekvensen af det er BB-180, ikke en tavs udeladelse af en halv opgørelse.
- **M-29 og M-07 er uden genstand:** fanen har ingen indtastningsfelter og dermed hverken feltregler eller
  parvise grænser.
- **M-16's begge halvdele er kørt.** En række, der er umulig som helhed, findes ikke på denne fane
  (motoren har ingen afvisningsgrund, feltmodellen ikke kender); den rene mangel-halvdel giver korrekt
  «Indtastning mangler» med fem navngivne, linkede linjer på en tom sag.
- **Den tomme sags fem linjer er efterprøvet enkeltvis** og peger alle på et rigtigt felt eller en rigtig
  sektion: Fødselsdato → Stamdata, Skadedato → Stamdata, Beregningsdato → Grundlæggende oplysninger,
  Skadelidtes årsløn (efter ASL) → Arbejdsskadesikringsloven. Den femte er BB-181.
- **Aldersreduktionens 0 %-gren er efterprøvet i kilden:** ved alder ≤ 29 hedder rækken blot
  «Aldersreduktion» uden formel, og `formatDeductionPercent`/`formatDeductionKr` giver «(0 %)» og «0 kr.»
  uden minus – BB-129/BB-130's rettelse er delt kode og gælder derfor også her.
- **Aldersreduktionens loft er efterprøvet og er ærligt.** Ved alder 75 skriver rækken
  «Aldersreduktion (75 - 29) + (75 - 54) x 2 **(max 70 %)** =» og værdien `70 %`; formlens egne led giver
  88, og parentesen siger, hvorfor der står 70. BB-133's krav om, at et virksomt loft skal nævnes, er
  opfyldt – ligesom i maksimum-grenen, hvor teksten skifter til «Skadelidtes erhvervsevnetab **reduceres
  til det lovbestemte maksimum**».
- **`warn-beregningsdato-foer-skadedato` kan ikke nås fra brugerfladen.** Beregningsdatoens nedre grænse
  ER skadedatoen, så en tidligere dato er en rød bounds-fejl, der blokerer panelet, før advarslen
  formuleres. Advarslen er dermed død kode – ét linjes kodefund, ikke et brugerfund.
- **`eet-max-missing` og `reguleringssats-missing` kan heller ikke nås:** beregningsdatoens øvre grænse er
  datasættets dækning, og feltet har dertil sin egen røde `reguleringssats`-regel. Begge motorissues er
  uopnåelige på samme måde som `DATE_BEFORE_RATE_COVERAGE` på Renteberegning.
- **Tie-break-rækkefølgens ordensafhængighed er efterprøvet og lukket.** `endelig[0]` afhænger af rækkernes
  committede rækkefølge, men to afgørelser med samme afgørelsesdato OG samme virkningsdato gør begge
  rækker røde (`validateDuplicateAfgoerelse`, BB-140's rettelse) og blokerer fanen. BB-140's
  sorteringsprøve kan derfor ikke flytte et tal her.
- **EAL-procentens trinregel er ikke et fund.** Feltet «EET % (hvis afviger fra ASL)» får ikke
  `resolveEetTitrinWarning`, hvor afgørelsestabellens EET %-celle gør. Det er rigtigt: 10 %-trinnene er en
  ASL-regel for skader fra 1. juli 2024, og EAL-procenten fastsættes selvstændigt. Feltets egen regel
  (delelig med 5, mellem 5 og 100) er den, der gælder. Se dog det åbne spørgsmål nedenfor.
- **15 %-advarslen er efterprøvet og virker begge veje.** EAL-procent `10` giver «Der kan ikke tilkendes
  erhvervsevnetab under 15 %» både som gul ring på feltet og som linje i fanens boks. BB-173's afgørelse
  er i drift: advarslen bærer ingen hale om lovmæssighed.
- **Den blokerede «Beregning»-boks** viser kun downloadrækken og ingen Beregningsdato, mens den bærer
  samme overskrift. Det er `EetDocumentDownloadBox`, som deles af alle fire resultatfaner, og forholdet
  er allerede afgjort på flade 7a.
- **Konsollen var tavs gennem hele kørslen:** 195 beskeder, 0 fejl, 0 advarsler.

## Dækningshuller

- Kun Chrome, lyst tema, 1536×864. Mørkt tema og de tre øvrige browsere er ikke målt.
- PDF-kanalen er ikke læst; dokumentet er hentet som `.docx`. De to kanaler deler `renderEfterEalBody`, så
  BB-182 hviler på Word-udgaven plus kildelæsning.
- `Gem`/`Hent` er ikke afprøvet – filvælgeren kan ikke betjenes headless (samme hul som BB-049).
- Brevhovedet er ikke slået til i nogen kørsel. BB-182 er målt uden brevhoved; brevhovedet bærer kun
  journalnr., advokat, sagsbehandler og dags dato (kildelæst), så det lukker ikke hullet.
- `warn-eal-aarsloen-empty-for-2024-07-01` er ikke målt (kræver en skadedato fra 1. juli 2024 og frem);
  den er kildelæst som BB-183's søster.
- Aldersreduktionens 0 %-gren (alder ≤ 29) er kildelæst, ikke målt i browseren.
- «Meget mange afgørelser» (B3) er ikke målt; højst to afgørelsesrækker er brugt. Fanens output er
  uafhængigt af antallet, da kun én afgørelse vælges – men netop derfor vokser BB-178's risiko med
  antallet af rækker.
- Undo/redo, Escape og celle-annullering er ikke afprøvet på fanen; den har ingen indtastningsfelter, så
  prøven hører på 11a.

## Åbne spørgsmål

- **AFGJORT 2026-09-04: Skal en senere midlertidig afgørelse kunne fortrænge en tidligere endelig, når
  EAL-kravet opgøres?** **Ja – sorteringen står uændret.** Mangler en særskilt EET-procent efter EAL,
  lægges den seneste procent efter ASL til grund uden skelen til, om den er midlertidig eller endelig,
  fordi erstatningsansvarsloven ikke kender et midlertidigt erhvervsevnetab. Den samme begrundelse
  afgjorde BB-177. Fanen siger nu, at der er to afgørelser at vælge imellem (BB-178's advarselsdel), men
  vælger fortsat den seneste. `resolveLoebendeEetPct` i differencekravet bruger samme rækkefølge og er
  dermed fortsat korrekt spejlet.
- **AFGJORT 2026-09-04: Skal en afgørelse, der er truffet efter beregningsdatoen, bære EAL-kravet?**
  **Ja på EAL-fanen, og Differencekravs blokering er samtidig korrekt.** Differencekrav opstår
  udelukkende, når der er krav efter BÅDE ASL og EAL, så fladens forudsætninger er anderledes end ved
  en «ren» EET efter EAL – og en fejlmeddelelse kan derfor være relevant dér uden at være det her,
  selv om de udspringer af samme forhold. De to svar er ikke en selvmodsigelse, og der er ingen
  udestående uenighed at tage op på 11e (BB-179).
- **AFGJORT 2026-09-04: Gælder 10 %-trinnene for erhvervsevnetabsprocenten efter EAL?** **Nej – de nye
  10 %-intervaller gælder kun erhvervsevnetab efter ASL.** Efter EAL anvendes fortsat de gamle
  intervaller: 15 % som mindstegrænse og derefter løbende 5 %-intervaller op til 100 %. Antagelsen bag
  gennemgangen holdt altså, og **fraværet af `resolveEetTitrinWarning` på «EET % (hvis afviger fra ASL)»
  er korrekt** – advarslen ville være urigtig på det felt. Feltets egen regel (delelig med 5, mellem 5
  og 100) er den, der gælder, og den svarer netop til EAL's intervaller. Ingen kodeændring.

  **Læren, og den hører til M-30's trin 4:** det var netop den prøve, der holdt spørgsmålet ude af
  fund-listen. En manglende advarsel og en advarsel, der ikke skal være der, ser ens ud i skemaet
  `rg "toWarning\('warn-" src/domain/erhvervsevnetab`; kun domænet kan skelne dem. Havde fraværet
  været registreret som fund, ville rettelsen have indført en forkert advarsel på det felt, hvor
  EAL-kravet faktisk opgøres. **`warn-invalid-eet-pct-after-2024-07-01`s fravær i EAL-motoren er dermed
  bekræftet korrekt og genrejses ikke.**

---

# Fane 5 – Differencekrav

- Gennemgået: 2026-09-07 · commit `9c39f977`
- Afprøvet i: Chrome, lyst tema, 1536×864 (M-09 desuden målt ved 1244×620). Fire dokumenter hentet som
  `.docx` og læst linje for linje: differencekravet i to sagsformer samt de to nabofaners egne dokumenter
  til sammenligning.

## Fladen kort

Fanen er **Erhvervsevnetabs fjerde og sidste resultatfane** og den eneste, der samler alle de øvrige. Den
opgør differencekravet: EAL-kravet fratrukket fire ASL-fradrag – de udbetalte løbende ydelser, de modtagne
kapitalbeløb, værdien af det resterende erhvervsevnetab og mer-erstatningen ved forhøjet folkepensionsalder
– og til sidst reduceret med et eventuelt forlig om ansvarsgrad.

**Fanen er samtidig den eneste resultatfane med egne indtastningsfelter.** Strukturen er «Fejl og
advarsler» (fælles `EetIssuesBox`), en «Beregning»-boks med Beregningsdato, downloadknappen, fem
bilagsvalg og én toggle, en «Valgmuligheder»-boks med to toggles og tre forligsfelter, en
«Specifikation»-boks med fem underafsnit, og til sidst to betingede bokse: «Proformakapitalisering af
rest-EET» og «Mer-erstatning ved forhøjet folkepensionsalder».

**Fanens særkende, og kilden til de to Høj-fund: dens dokument er det eneste i programmet med bilag, og
bilagene er nabofanernes dokumenter regnet på et ANDET input.** `computeEetDifferencekravCalculation`
bygger grafen selv: den filtrerer afgørelsesrækkerne til dem med virkningsdato på eller før
beregningsdatoen (`filterAslRowsKnownAtBeregningsdato`) og kalder derefter EAL-, kapitaliserings- og
løbende-ydelsesmotoren på den filtrerede liste – løbende ydelser dertil med beregningsdatoen sat én dag
tilbage. Begge justeringer er bevidste og rigtige for differencekravet. Men de tre resultater trykkes som
bilag under **nøjagtig samme titler** som nabofanernes egne dokumenter, så samme sag kan udlevere to
papirer med samme overskrift og to forskellige tal.

**Fanens andet gennemgående tema er mer-erstatningen ved forhøjet folkepensionsalder,** som bærer fem af
fundene: den hedder fire ting, dens bilag trykker samtlige beløb uden «kr.», dens to bokse er ordret ens
ved to kapitaliseringer, dens to kapitaliseringsfaktorer er unavngivne, og dens bilagsvalg forklarer sig
med en påstand, der er forkert i netop den tilstand, hvor den vises.

**Beregningsformlerne selv er kontrolregnet i fire sagsformer og er i orden.** Efterprøvet ordret:
`4.201.875 − 88.113 − 389.275 − 834.979 − 797.783 − 43.453 = 2.048.272` (fire fradrag, ingen forlig),
`3.940.650 − 122.936 − 516.226 − 834.979 − 332.960 − 26.072 − 43.453 = 2.064.024` (to kapitaliseringer, to
mer-erstatningsevents), `2.064.024 × 2/3 = 1.376.016` og `2.064.024 × 1/3 = 688.008` (forlig som brøk),
`2.064.024 × 12,5 % = 258.003` (forlig som decimalprocent). Proformakapitaliseringens egen kæde er
efterregnet af de viste tal: `278.558 × 25 % × 83 % × 92 % = 53.176,72`, `× 1,657 = 88.113,83`,
`× 9,054 = 797.783`. Mer-erstatningen ligeledes: `31.906,03 × 153,6 % = 49.007,66`, `× 10,157 =
497.770,80`, `× 10,689 = 523.842,88`, difference `26.072`. **Ingen af de 17 fund handler om en forkert
formel** – BB-185 og BB-186 handler om, hvilket INPUT formlen får, når den kaldes som bilag.

## Fund

### BB-185 – To papirer med titlen «EET efter EAL» i samme sag: 60 % og 2.101.950 kr. mod 30 % og 1.050.975 kr.

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-31--samme-beregning-kørt-med-et-justeret-input-udleveres-under-samme-navn`
- **Prioritet:** **Høj**
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `01-01-1970`, Skadedato `01-06-2018`, J.nr. `BB-11e-2`.
  2. EET oplysninger: Beregningsdato `01-06-2022`, ASL-årsløn `400.000`.
  3. Række 1: Afgørelsesdato `01-06-2020`, Virkningsdato `01-01-2020`, EET % `30`, Midlertidig.
  4. Række 2: Afgørelsesdato `01-06-2023`, Virkningsdato `01-01-2023`, EET % `60`, Midlertidig.
  5. Hent dokumentet fra fanen «EET efter EAL». Hent derefter differencekravet med bilagsvalget
     «EET efter EAL» slået til (standard).
- **Det sker:** de to papirer er ordret ens på hver linje bortset fra tre – målt i de hentede `.docx`-filer:

  | Linje | «EET efter EAL» (fane 4) | Bilaget «EET efter EAL» i differencekravet |
  |---|---|---|
  | Erhvervsevnetab | **60 %** | **30 %** |
  | Erhvervsevnetab (432.500 kr. x 10 x …) | 2.595.000 kr. | 1.297.500 kr. |
  | Beregnet EAL-krav | **2.101.950 kr.** | **1.050.975 kr.** |

  Skadedato, Årsløn, reguleringen (`+ 8,1329 %`), den opregulerede årsløn (`432.500 kr.`),
  Kapitaliseringsfaktor `10`, maksimum, Fødselsdato, alder og aldersreduktionen (`19 %`) er identiske i
  begge. Ingen af de to papirer nævner, at der findes en anden udgave, og bilaget udelader dertil
  Beregningsdato-rækken (`includeBeregningsdatoHeader = false`), så den dato, filtreringen hviler på, står
  slet ikke i bilaget. **Forskellen er 1.050.975 kr. – halvdelen af kravet.**
- **Det er uhensigtsmæssigt fordi:** to papirer med samme overskrift i samme sag skal vise samme tal, ellers
  er det ene forkert. Her er de begge rigtige – differencekravet SKAL kun regne på afgørelser med virkning
  på eller før beregningsdatoen – men brugeren og modparten kan ikke se det. Den, der lægger begge papirer i
  sagen, har lagt to modstridende opgørelser af det samme krav ved siden af hinanden og kan ikke forklare
  forskellen. Fane 5 advarer korrekt («Beregningsdatoen (01-06-2022) ligger før sagens afgørelser.» med
  link), men advarslen siger ikke, at EAL-kravet på denne fane derfor er et andet tal end nabofanens, og
  **advarslen kommer ikke med i bilaget.**
- **Bedre ville være:** bilaget navngives som det, det er, og bærer sin egen forudsætning. Konkret:
  bilagstitlen skriver, at det er differencekravets grundlag («EET efter EAL – opgjort på afgørelser med
  virkning til og med 01-06-2022»), og bilagskroppen beholder Beregningsdato-rækken plus én linje om, at
  senere afgørelser er holdt uden for. Alternativt viser fane 5's specifikation begge tal, så divergensen
  er synlig dér, hvor den opstår.
- **Andre steder det kan gælde:** `filterAslRowsKnownAtBeregningsdato` fodrer ALLE tre nabomotorer i
  `eetCalculationGraph.ts`, så samme form gælder kapitaliseringsbilaget (en kapitalisering på en afgørelse
  med senere virkningsdato falder ud af bilaget, men står i fane 3's eget dokument) og
  løbende-ydelsesbilaget (BB-186 er dens målte udgave). Prøven for resten af programmet er M-31's:
  `rg "\.\.\.input\.|filtered|dagFoerBeregningsdato" src/domain` over graf- og kompositionsmoduler – hvert
  sted, hvor et input justeres før et nabomodul kaldes, er en kandidat, hvis begge udgaver kan nå brugeren
  under samme navn.

**Tilbagemelding**
Den beskrevne adfærd er den korrekte og forventelige adfærd. Beregning på fanen EET efter EAL er en anden opgørelsestype end beregning af Differencekrav. Til differencekrav er der knyttet et helt fast, ufravigeligt princip om, at det er de specifikke forhold, som sagen så ud på beregningsdatoen, der lægges til grund - uanset hvad der senere måtte være sket (jeg tror måske der er en undtagelse ved en senere afgørelse, der får virkning før beregningsdatoen). Modsat dette er beregningen på siden med EET efter EAL udtryk for en beregning af den sluttelige tilstand for erhvervsevnetabsafgørelser, blot opgjort med den værdi et erhvervsevnetab efter EAL ville have med samme procentsats, beregningsteknisk opgjort med den værdi det ville have på beregningsdatoen.

### BB-186 – Samme afgørelse, samme titel, to dokumenter: 123.028 kr. mod 122.936 kr.

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-31--samme-beregning-kørt-med-et-justeret-input-udleveres-under-samme-navn`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Stamdata: Fødselsdato `01-01-1970`, Skadedato `01-06-2018`.
  2. EET oplysninger: Beregningsdato `01-06-2022`, ASL-årsløn `400.000`, EAL-årsløn `900.000`.
  3. Række 1: `01-12-2018` / `01-01-2019` / `30` / Delvist endelig / Kap.dato `01-01-2019` / Kap. % `15`.
  4. Række 2: `01-06-2020` / `01-07-2019` / `50` / Endelig / Kap.dato `01-06-2020` / Kap. % `25`.
  5. Hent dokumentet fra «Løbende ydelser» og derefter differencekravet med bilaget «Løbende ydelser».
- **Det sker:** begge papirer bærer titlen «Løbende ydelser (EET)» og samme boksoverskrift «Afgørelse
  1. juni 2020». De afviger på tre linjer, målt:

  | | Dokumentet «Løbende ydelser (EET)» | Bilaget «Løbende ydelser (EET)» |
  |---|---|---|
  | Løbende ydelse opgjort til og med | **01-06-2022** | **31-05-2022** |
  | Sidste periodelinje | `01-01-2022 · 01-06-2022 · 5,03333 mdr. · 13.867 kr.` | `01-01-2022 · 31-05-2022 · 5,00000 mdr. · 13.775 kr.` |
  | I alt | **123.028 kr.** | **122.936 kr.** |

  Samme forskel ses på skærmen: fane 2 skriver «Løbende ydelse opgjort til og med 01-06-2022» og
  «I alt 123.028 kr.», mens fane 5's specifikation skriver «Løbende ydelser (01-07-2019 - 31-05-2022):
  − 122.936 kr.» Ingen af de to steder forklarer dagen. (I sagen med beregningsdato `01-06-2024` er samme
  afvigelse målt til 389.520 kr. mod 389.275 kr. – 245 kr.)
- **Det er uhensigtsmæssigt fordi:** 92 kr. er lille nok til at se ud som en afrundingsfejl og stort nok til
  at koste tid. Modparten, der efterregner, finder to «I alt» for samme afgørelse og må gætte, hvilket der
  gælder. Årsagen – at ydelserne fradrages til og med dagen FØR beregningsdatoen, mens fane 2 opgør dem til
  og med beregningsdatoen – er en rigtig regel, som ingen af de to papirer nævner. Dertil er selve rækken
  «Løbende ydelse opgjort til og med» den eneste ledetråd, og den står kun i bilaget, ikke i fane 5's egen
  specifikation.
- **Bedre ville være:** fane 5's fradragslinje siger, hvorfor den slutter en dag før («… til og med
  31-05-2022, dagen før beregningsdatoen»), og bilaget bærer samme sætning i sin
  «Periodeafgrænsning»-blok. Er det for meget tekst, er alternativet at give bilaget en titel, der skiller
  det fra fane 2's dokument, som i BB-185.
- **Andre steder det kan gælde:** `dagFoerBeregningsdato` sættes ét sted (`eetCalculationGraph.ts:56`) og
  bruges både som ophørsdato og som `fradragesTil`. Samme mønster som BB-185; se M-31's prøve.

**Tilbagemelding**
Løbende ydelser beregnes altid kun til og med dagen før kapitalisering. Hvis der fortsat er løbende ydelser, fordi der kun sker kapitalisering af en del af erhvervsevnetabet, fortsætter de løbende ydelser fra og med datoen for kapitalisering.

Ved beregning af differencekrav sker der proformakapitalisering af ethvert tilbageværende erhvervsevnetab. Derfor regnes løbende ydelser i det tilfælde også altid kun til og med dagen før proformakapitaliseringen.

Hvis der er beregninger noget sted i programmet, som medregner de løbende ydelser til og med datoen for kapitalisering, er det en fejl - de skal kun medregnes til og med dagen før (og eventuelt med den nye sats for kapitaliseringsdatoen og frem, hvis der ikke sker fuld kapitalisering og derfor fortsat er ret til reducerede løbende ydelser).

Det er kun, hvis beregning af løbende ydelser på fanen med Løbende Ydelser ophører på grund af selve beregningsdatoen, at der regnes løbende ydelser til og med beregningsdatoen. Her vil der opstå en forskel i de beregnede resultater på siden med Løbende Ydelser (der beregner dem til og med beregningsdatoen) og differencekrav-siden (hvor der sker proformakapitalisering, og de løbende ydelser derfor kun beregnes til og med dagen før beregningsdatoen).

### BB-187 – «Løbende ydelser derfor ikke relevante» for en afgørelse, hvis bilag to sider senere viser 66.827 kr.

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** **Høj**
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-186. Læs afsnittet «Løbende ASL-ydelser» i
  specifikationen, og læs derefter løbende-ydelsesbilagets første side i det samme dokument.
- **Det sker:** specifikationen skriver, ordret:

  ```
  Løbende ASL-ydelser
  Skaden er indtrådt den 16. juni 2011 eller senere.
  Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser.
  Afgørelse 1. december 2018
  Delvist endelig afgørelse
  Løbende ydelser derfor ikke relevante.
  ```

  To sider længere inde i **samme dokument** står den samme afgørelse med sine periodelinjer og
  «I alt **66.827 kr.**» Afgørelsen er ikke midlertidig – den er *delvist endelig* – så den begrundelse,
  ordet «derfor» henviser til, handler om en afgørelsestype, rækken ikke har. Målt i koden:
  `skalFradragForetages` returnerer kun `true` for `'Endelig'`, når skadedatoen er 16-06-2011 eller senere;
  `'Delvist endelig'` behandles altså som `'Midlertidig'`, uden at nogen tekst siger det.
- **Det er uhensigtsmæssigt fordi:** «ikke relevante» er programmets stærkeste påstand om et fradrag – den
  siger, at der ikke er noget at fradrage. Her er der 66.827 kr., og programmet trykker dem selv få sider
  senere. Brugeren, der læser papiret igennem, finder to udsagn om samme afgørelse, der ikke kan være sande
  samtidig, og kan ikke se hvilket der styrer beløbet. Er reglen rigtig, er teksten forkert; er teksten
  rigtig, er der 66.827 kr. for meget i differencekravet.
- **Bedre ville være:** linjen siger reglen med afgørelsens egen type: «Delvist endelige afgørelsers
  løbende ydelser fradrages ikke ved skader fra 16. juni 2011» – og forbeholdssætningen ovenfor nævner
  begge typer, så «derfor» peger et sted hen. Er det meningen, at delvist endelige ydelser SKAL fradrages,
  hører rettelsen i `skalFradragForetages` og ikke i teksten. **Se det åbne spørgsmål nedenfor:
  bedømmelsen af reglen er udviklerens.**
- **Andre steder det kan gælde:** `rg "derfor ikke relevante|Der foretages derfor" src/components src/document`
  – hver «derfor»-sætning, hvis begrundelse står i en anden linje, er en kandidat. Generelt: for hver
  forbeholdssætning, der opregner nogle af en enums værdier, spørg hvilke værdier den udelader, og hvad de
  så får som begrundelse.

**Tilbagemelding**
Begrebet 'delvist endelige afgørelser' er en kompliceret størrelse rent formuleringsmæssigt. Der er rent praktisk tale om en midlertidig afgørelse, hvor en del af ydelsen kan kapitaliseres efter reglerne for endelige afgørelser. Det ændrer ikke på, at den løbende ydelse både før og efter kapitaliseringstidspunktet er midlertidig - den afviger blot fra en sædvanlig midlertidig afgørelse derved, at der (modsat midlertidige afgørelser) har kunnet finde kapitalisering sted.

Jeg er bange for, at formuligeringerne bliver for lange og kluntede, hvis man skal have beskrevet alt dette, og brugeren ved godt, at den løbende ydelse fra en delvist endelig afgørelse i praksis bare er en midlertidig ydelse. Hvis du kan finde en god, kort, præcis måde at formulere dette på, så fint, men hvis ikke, så undgå at drukne dokumenter i lange, komplicerede beskrivelser, der bare skaber unødvendigt rod.

### BB-188 – Et afkrydset bilag kan udgå af dokumentet uden et ord, mens to andre bilag gøres inaktive med en grund

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-25--gaten-spørger-findes-der-noget-ikke-findes-det-brugeren-bad-om`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Byg en sag med **kun midlertidige** afgørelser: Beregningsdato `01-06-2022`, ASL-årsløn `400.000`,
     EAL-årsløn `900.000`, række 1 `01-12-2018` / `01-01-2019` / `30` / Midlertidig, række 2 `01-06-2020` /
     `01-07-2019` / `50` / Midlertidig, ingen kapitalisering.
  2. Bliv på Differencekrav med alle fem bilagsvalg som de står (alle afkrydsede), og hent dokumentet.
- **Det sker:** differencekravet regner (`2.275.852 kr.`), der er **ingen «Fejl og advarsler»-boks**, og
  knappen står som «Download som Word». Bilagsvalget **«Kapitalisering» er afkrydset og aktivt** – men det
  hentede dokument indeholder kun fire afsnit, målt i `.docx`-filen: `Differencekrav (EET)`,
  `EET efter EAL`, `Løbende ydelser (EET)`, `Proformakapitalisering af rest-EET`. Der er **ingen
  Kapitalisering-side**, heller ikke den tomtilstand, generatoren ellers har («Der er ingen kapitaliserede
  afgørelser i sagen.»). Fane 3 er samtidig helt blokeret med «Ingen endelig eller delvist endelig
  afgørelser indtastet» – præcis det issue, differencekravet bevidst filtrerer væk
  (`eetDifferencekravCalculation.ts:687`), så det aldrig når fanen.
  **Samme boks behandler «har intet indhold» på tre måder:**
  - «Proformakap. af rest-EET» og «Mer-erstatning forhøjet folkepension»: inaktive og umarkerede med
    årsagen i tooltippet (målt: «Der er intet rest-EET at proformakapitalisere» / «Mer-erstatning er
    fravalgt nedenfor» / «Pensionsalderen er ikke forhøjet i perioden»).
  - «Løbende ydelser», «Kapitalisering», «EET efter EAL»: altid aktive (`unavailableReason={null}`) og
    udgår tavst eller giver en «ingen»-side.
  - Togglen «Medtag udvidet specifikation på løbende ydelser»: altid aktiv, også når
    løbende-ydelsesbilaget er fravalgt – målt: bilaget fravalgt, togglen slået **til**, og den styrer
    ingenting.
- **Det er uhensigtsmæssigt fordi:** et afkrydset felt er et løfte om en side i papiret. Brugeren, der har
  set «Proformakap. af rest-EET» blive grå med en forklaring, læser rimeligt en aktiv «Kapitalisering» som
  «der ER noget her» – og opdager først ved at tælle sider, at der ikke er. I den målte sag ville bilaget
  ganske vist have været tomt, men brugeren kan ikke skelne «bilaget var tomt» fra «noget faldt ud», og det
  er netop den skelnen, gaten skulle levere.
- **Bedre ville være:** de fem bilagsvalg får samme regel som EO's seks, der allerede har den: ét
  `bilagAvailability`-opslag pr. valg, så et bilag uden indhold gøres inaktivt og umarkeret med årsagen i
  tooltippet («Der er ingen kapitaliserede afgørelser i sagen»). Udvidet-spec-togglen følger
  løbende-ydelsesbilaget på samme måde. Så kan et afkrydset felt ikke længere love en side, dokumentet ikke
  har.
- **Andre steder det kan gælde:** `rg "unavailableReason=\{null\}" src/components` giver fire træf – de tre
  her plus EO's «Opgørelse», som er `lockedOn` og altså et andet tilfælde.
  `rg "bilagSelection\." src/document/generators` giver de seks vagter i
  `differencekravDocument.ts:524-568`; hver `&& computation.X`-vagt er et bilag, der kan udgå tavst.
  EO's `renderBilagCheckbox` er den færdige model.

**Tilbagemelding**
Jeg er enig. Hvis der ikke er noget indhold i et givent bilag, skal boksen gøres deaktiveret med en kort, klar, beskrivende tooltip-meddelelse. Det er vist allerede tilfældet for forhøjet folkepensionsalder. Sørg for at lave en god, velstruktureret løsning. Ingen vilkårlige lappeløsninger.

Jeg vil desuden gerne have at der også indsættes et lockedOn opgørelses-felt for differencekrav magen til det på EO. Hvis det ændrer schama eller andet tilsvarende, som kan give problemer med bagudkompatibilitet, så sørg for at tage højde for det. Det burde dog ikke være tilfældet. Opgørelsen dannes altid - både nu og med ændringen. Eneste forskel er, at der nu vises en symbolsk boks, hvor det fremgår.

### BB-189 – «Pensionsalderen er ikke forhøjet i perioden» er forkert, når årsagen er, at der ikke er nogen kapitalisering

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-188 (kun midlertidige afgørelser, ingen kapitalisering).
  Lad «Indregn mer-erstatning ved forhøjet pensionsalder» stå på **Ja**, og hold musen over det inaktive
  bilagsvalg «Mer-erstatning forhøjet folkepension».
- **Det sker:** tooltippet siger ordret «**Pensionsalderen er ikke forhøjet i perioden**». Det er ikke
  rigtigt: folkepensionsalderen blev forhøjet fra 68 til 69 år **31-12-2020**, som ligger mellem
  skadedatoen `01-06-2018` og beregningsdatoen `01-06-2022`, og programmet kender datoen
  (`forhoejetPensionsalderEvents`). Den virkelige årsag er, at der ikke er nogen kapitalisering at
  regulere: `computeMerErstatningPensionsalder` kaldes slet ikke, fordi vagten
  `input.indregnMerErstatningVedForhoejetPensionsalder && kapResult.computation` fejler på det andet led.
- **Det er uhensigtsmæssigt fordi:** brugeren har netop slået beregningen TIL, fordi han tror, sagen kan
  have en mer-erstatning. Svaret er en påstand om lovgivningen, ikke om hans sag – og påstanden er usand.
  Han har ingen anledning til at betvivle den og kan konkludere, at der intet er at rejse. Fundets form
  står i programmets egen kodekommentar ved nabogrenen: «… ville da være en påstand om et regnestykke,
  programmet ikke har udført – altså potentielt forkert». Den anden gren gør præcis det.
- **Bedre ville være:** en tredje grund, der siger, hvad der mangler: «Der er ingen kapitalisering at
  regulere for en forhøjet pensionsalder». «Pensionsalderen er ikke forhøjet i perioden» beholdes til det
  tilfælde, hvor beregningen ER kørt og fandt ingen forhøjelse.
- **Andre steder det kan gælde:** `resolveMerErstatningPensionsalderBilagDisabledReason` har to grunde til
  tre tilstande. Samme prøve for de øvrige: `rg "DisabledReason|unavailableReason" src/domain` – for hver
  grund, tæl de tilstande der kan udløse den, og spørg om teksten er sand i dem alle. Dette er BB-181's
  lære i en ny form: **ét udsagn kan opstå i flere tilstande, og prøven skal navngive dem hver for sig.**
  Dertil: `computeMerErstatningPensionsalder` skriver sine issues i en lokal liste
  (`eetDifferencekravCalculation.ts:868`), som **aldrig merges** – fejler et faktoropslag, udgår fradraget
  tavst og differencekravet bliver for højt. Ikke fremprovokeret fra brugerfladen (se dækningshuller).

**Tilbagemelding**
Jeg er enig. Men dit forslag til meddelelse bliver meget langt og kluntet. Kan det gøres kortere og mere præcist, eventuelt bare i retning af, at der ikke er nogen kapitaliseringsafgørelser at forhøje.

### BB-190 – Hele bilaget «Forhøjet pensionsalder» trykker beløb uden «kr.»

- **Type:** Fejl
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-186 (to kapitaliseringer). Hent differencekravet og læs
  fradragslinjen i specifikationen og bilaget «Forhøjet pensionsalder».
- **Det sker:** samtlige beløb i mer-erstatningen står **uden enhed** – målt ordret i `.docx`-filen:

  ```
  Grundydelse (15 %): … =   278.558 x 15 % x 83 % x 92 % =   31.906,03
  Årlig ydelse (31.906,03 x 153,6 %) =                       49.007,66
  Kapitalværdi (49.007,66 x 10,157) =                       497.770,80
  Kapitalværdi (49.007,66 x 10,689) =                       523.842,88
  Mer-erstatning (523.842,88 − 497.770,80)                      26.072
  ```

  og fradragslinjen på forsiden: «Forhøjelse pr. 31-12-2020 (68 år → 69 år): **- 26.072**» – umiddelbart
  under «Kapitaliseret (15 %) den 01-01-2019: **- 516.226 kr.**» og «Proformakapitalisering (10 %) den
  01-06-2022: **- 332.960 kr.**» **På skærmen har de samme linjer «kr.» overalt** («278.558 kr. x 15 %»,
  «497.770,80 kr.», «26.072 kr.»). Årsagen er målt i koden: mer-erstatningsafsnittet er det eneste i
  `differencekravDocument.ts`, der bruger `formatCurrencyFromOre`/`formatCurrencyFromOreTrimmed` (15
  forekomster) i stedet for `formatKr`; de to første formattere returnerer tallet UDEN «kr.», og
  varianterne med enheden heder `formatMoneyOreWithKr`/`…Trimmed`.
- **Det er uhensigtsmæssigt fordi:** et beløb uden enhed i et papir til modparten er en fejl, ikke en
  formvariation – og den står side om side med linjer, der har enheden, så det læses som om de to slags
  tal er forskellige størrelser. `278.558 x 15 %` ligner en indeksberegning frem for kroner. Skærmen og
  dokumentet er samtidig uenige om samme linje, hvilket er M-13's kerne.
- **Bedre ville være:** mer-erstatningsafsnittet bruger `formatKr` som resten af dokumentet, eller
  `formatMoneyOreWithKr(Trimmed)`, så alle beløb i papiret bærer «kr.».
- **Andre steder det kan gælde:** `rg "formatCurrencyFromOre\b|formatCurrencyFromOreTrimmed" src/document/generators`
  giver syv filer. `differencekravDocument.ts` er den eneste, der bruger BÅDE dem og `formatKr` i samme
  dokument. De øvrige seks er EO- og TAF-generatorer, hvor beløbene står i tabeller med enheden i
  kolonneoverskriften – hver af dem skal efterprøves for, om et beløb er sluppet ud i en prosalinje.

**Tilbagemelding**
Jeg er enig i dit fund. Jeg vil have én ensartet standard, så hvis der anvendes 'kr.' alle andre steder i opgørelsen af erhvervsevnetab og differencekrav, skal det selvfølgelig også gøres her.

### BB-191 – Mer-erstatningen hedder fire ting på fire steder i samme sag

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-186. Læs bilagsrækken, togglen, specifikationen og den
  nederste boks – og derefter det hentede dokument.
- **Det sker:** fire forskellige navne for én størrelse, målt ordret:

  | Sted | Ordlyd |
  |---|---|
  | Bilagsvalg (afkrydsningsfelt) | «Mer-erstatning forhøjet folkepension» |
  | Toggle i «Valgmuligheder» | «Indregn mer-erstatning ved forhøjet **pensionsalder**» |
  | Underoverskrift i specifikationen og boksens overskrift | «Mer-erstatning ved forhøjet **folkepensionsalder**» |
  | Dokumentets sektionsoverskrift OG bilagstitel | «**Forhøjet pensionsalder**» |

  Descriptorens `label` – det navn oplæsning og fejltekster bruger – er togglens form («Indregn
  mer-erstatning ved forhøjet pensionsalder»).
- **Det er uhensigtsmæssigt fordi:** brugeren skal selv koble fire navne til én størrelse på tværs af to
  bokse og et papir, og det navn, dokumentet bruger, er det eneste, der ikke indeholder ordet
  «mer-erstatning» – altså det ord, der siger, hvad linjen ER. Modparten, der får papiret, læser en
  sektion, som hedder noget andet end det fradrag, den indeholder. Det er BB-134's og BB-177's prøve igen:
  **en godkendt ordlyd skal søges som begreb, ikke som streng.**
- **Bedre ville være:** ét navn som delt konstant – «Mer-erstatning ved forhøjet folkepensionsalder» –
  brugt i boksen, i specifikationen, i dokumentets sektion og bilagstitel og i descriptorens label.
  Bilagsvalget må gerne forkortes af pladshensyn (BB-145's afgørelse), men skal da forkorte det samme navn
  («Mer-erstatning (folkepension)»).
- **Andre steder det kan gælde:** `rg "pensionsalder|folkepension" src/components/pages/erhvervsevnetab src/document/generators/differencekrav src/inputCore/catalog`
  – de fem ordlyd står i fem filer. Prøven for resten af fladen: for hvert bilagsvalg, sammenlign de fire
  navne (afkrydsningsfelt · skærmoverskrift · dokumentsektion · bilagstitel). «Proformakap. af rest-EET»
  mod «Proformakapitalisering af rest-EET» er samme form i mildere grad.

**Tilbagemelding**
Jeg er enig. 'Forhøjet pensionsalder' er vist det bedste udtryk.

### BB-192 – Dokumentets samlede «Differencekrav» havner under sektionen «Forhøjet pensionsalder»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-186. Hent differencekravet og læs forsidens
  overskriftshierarki.
- **Det sker:** forsiden har to sektionsoverskrifter, «Beregning» og «Specifikation», og under den sidste
  fire underoverskrifter (EAL-krav · Løbende ASL-ydelser · Kapitaliserede ASL-beløb · Resterende
  erhvervsevnetab). Derefter kommer **en tredje sektionsoverskrift, «Forhøjet pensionsalder»** – og først
  derefter underoverskriften «Differencekrav» med sagens bundlinje. Sagens resultat står altså som et
  underafsnit af pensionsalderen. Målt i koden: `differencekravDocument.ts:452` bruger
  `writeSectionHeader`, hvor de fire søskende bruger `writeBoldSubheader`, og
  `writeBoldSubheader('Differencekrav')` følger på linje 465. **På skærmen er alle fem søskende
  `row--subheading` inde i «Specifikation»,** så hierarkiet er rigtigt dér og forkert i papiret.
- **Det er uhensigtsmæssigt fordi:** overskriftsniveauet er den eneste anvisning på, hvad der hører til
  hvad, i et papir uden indholdsfortegnelse. Læseren, der leder efter kravet, leder under «Specifikation»
  og finder det ikke; og den, der læser sekventielt, får bundlinjen præsenteret som en konsekvens af
  pensionsalderen. Dertil bruges ordlyden «Forhøjet pensionsalder» både til dette afsnit og til bilagets
  titel længere inde, så samme overskrift optræder to gange med to betydninger (jf. BB-191).
- **Bedre ville være:** `writeBoldSubheader` som de fire andre fradragsafsnit, med samme ordlyd som
  skærmen («Mer-erstatning ved forhøjet folkepensionsalder»), så «Differencekrav» bliver det femte
  underafsnit i «Specifikation».
- **Andre steder det kan gælde:** `rg "writeSectionHeader" src/document/generators` – hvert kald inde i en
  krop, der allerede har en åben sektion, er en kandidat. Prøven er billig: læs generatorens kald i
  rækkefølge og hold niveauerne op mod skærmens `section-header`/`row--subheading`.

**Tilbagemelding**
Enig

### BB-193 – To kapitaliseringer giver to ordret identiske «Forhøjelse pr. 31-12-2020 (68 år → 69 år)»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-186 (kapitalisering 15 % pr. `01-01-2019` og 25 % pr.
  `01-06-2020`, beregningsdato `01-06-2022`).
- **Det sker:** specifikationen skriver to fradragslinjer med **ordret samme tekst** og to forskellige
  beløb:

  ```
  Forhøjelse pr. 31-12-2020 (68 år → 69 år):   - 26.072 kr.
  Forhøjelse pr. 31-12-2020 (68 år → 69 år):   - 43.453 kr.
  ```

  og boksen nedenfor får to blokke med ordret samme overskrift «Forhøjelse pr. 31. december 2020
  (68 år → 69 år)». Den eneste forskel inde i blokkene er «Grundydelse (15 %)» mod «(25 %)». Programmet
  KENDER forskellen: `MerErstatningPensionsalderEvent` bærer `rowId`, `afgoerelsesdato` og
  `kapitaliseringsdato`, og React bruger dem allerede som `key` – de renderes blot ingen steder.
- **Det er uhensigtsmæssigt fordi:** det er BB-171's fund igen, på den fane rettelsen ikke nåede. Brugeren
  kan ikke se, hvilken kapitalisering hver linje hører til, og kan derfor ikke efterprøve nogen af dem;
  to identiske overskrifter læses desuden let som en dublet, brugeren tror han skal slette.
- **Bedre ville være:** samme løsning som BB-170/BB-171 gav kapitaliseringsfanen – overskriften bærer
  afgørelsen: «Forhøjelse pr. 31. december 2020 (68 år → 69 år) · kapitalisering 15 % den 01-01-2019».
  Fradragslinjen i specifikationen får samme tilføjelse.
- **Andre steder det kan gælde:** `rg "\.map\(\(event" src/components/pages/erhvervsevnetab src/document/generators/differencekrav`
  – hver liste, hvis overskrift kun består af felter, der er FÆLLES for alle elementer, er en kandidat.
  Generelt: for hver `.map` over en liste med en overskrift, spørg om to elementer kan give samme
  overskrift.

### BB-194 – Mer-erstatningsboksen navngiver ikke sine to faktorer og mangler alderen, de hviler på

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-186. Sammenlign boksen «Proformakapitalisering af
  rest-EET» med boksen «Mer-erstatning ved forhøjet folkepensionsalder» lige under den.
- **Det sker:** de to bokse viser samme slags oplysninger i to former. Proformaboksen har navngivne rækker:

  ```
  Kapitaliseringsbekendtgørelse      Vejl. 9864/2021, tabel E
  Alder ved proformakapitalisering   52 år, 5 måneder
  Folkepensionsalder                 69 år
  Faktor måneds-afhængig?            Ja
  Kapitaliseringsfaktor              10,073
  ```

  Mer-erstatningsboksen skriver i stedet bekendtgørelsen i VENSTRE kolonne med faktoren til højre og uden
  et navn: «Vejl. 9921/2019, tabel A **10,157**» og «Vejl. 9870/2020, tabel A **10,689**». Der er ingen
  række, der siger, at tallene er kapitaliseringsfaktorer, **ingen alder** og ingen folkepensionsalder ud
  over de to labels i overskrifterne. M-28's prøve er kørt: `alderAar`, `alderMaaneder`,
  `faktorMaanedsAfhaengig`, `gammel.folkepensionsalderLabel`, `ny.folkepensionsalderLabel`,
  `afgoerelsesdato` og `kapitaliseringsdato` ligger alle i `merErstatningEventSchema` i det kanoniske
  output – **og renderes ingen steder,** hverken på skærmen eller i dokumentet (målt:
  `rg "event\.alderAar|event\.faktorMaanedsAfhaengig|\.gammel\.folkepensionsalderLabel"` giver nul træf).
- **Det er uhensigtsmæssigt fordi:** alderen på forhøjelsesdatoen er den ENESTE nøgle ind i de to
  faktortabeller. Uden den kan hverken brugeren eller modparten slå `10,157` og `10,689` op og kontrollere
  fradraget – og fradraget er hele mer-erstatningen. Naboboksen ti centimeter længere op viser præcis de
  rækker, der mangler, så uensartetheden er synlig uden at skifte fane. Det er BB-170's efterregningskrav,
  som udtrykkeligt ikke er lempet for denne fane.
- **Bedre ville være:** mer-erstatningsboksen får proformaboksens rækkeform: «Alder ved forhøjelsen»,
  «Folkepensionsalder (hidtidig / forhøjet)», «Faktor måneds-afhængig?» og to navngivne
  «Kapitaliseringsfaktor»-rækker under hver sin bekendtgørelse. Alle fire tal ligger i outputtet i
  forvejen.
- **Andre steder det kan gælde:** M-28's søgning på denne fane gav to træf mere ved siden af de syv
  ovenfor: `EetDifferencekravComputation.fradragLoebendeYdelserOre` og `fradragKapitaliseretEetOre` er de
  to sammentællinger af hver sit fradragsafsnit, og ingen af dem renderes – specifikationen viser kun de
  enkelte linjer og springer direkte til bundlinjen. (BB-174's afvisning dækker den manglende sum for
  kapitaliseringsfanen; her er forholdet, at mer-erstatningsboksen SELV har en «Samlet
  mer-erstatning»-række, som specifikationen og dokumentet ikke har – se BB-201.)

### BB-195 – Forligsfejlene er de eneste linjer i «Fejl og advarsler» uden et link

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:**
  1. Byg en regnende sag (som BB-186) og gå til Differencekrav.
  2. Skriv `150` i «Procent» under «Forlig om ansvarsgrad». Læs boksen.
  3. Ryd feltet, skriv `2/3` i brøken og `01-01-2010` i «Evt. dato for forlig». Læs boksen.
- **Det sker:** boksens rækker mangler den «Erhvervsevnetab → sektion»-henvisning, alle andre rækker har.
  Målt side om side i samme boks:

  ```
  Skadelidtes årsløn (efter ASL) er ikke udfyldt      EET oplysninger → Arbejdsskadesikringsloven
  Beregningsdato er ikke udfyldt                      EET oplysninger → Grundlæggende oplysninger
  Fødselsdato er ikke udfyldt                         Stamdata → Skadelidte
  Forlig om ansvarsgrad indeholder en ugyldig værdi    (intet link)
  Datoen kan ikke være før skadedatoen (01-06-2018)    (intet link)
  ```

  Forligsdatoens række er dertil den eneste i boksen, der **ikke navngiver sit felt**: «Datoen» kan i
  denne sag være en af otte datoer. Målt i koden: `forlig-ansvarsgrad-invalid`, `field-forlig-dato` og
  `differencekrav-beregningsgrundlag-missing` står i ingen af `resolveEetIssueNavigation`s fire id-sæt, så
  `navigation` er `null`, og `EetIssuesBox` udelader hele højre halvdel af rækken.
- **Det er uhensigtsmæssigt fordi:** boksen har lært brugeren, at hver linje kan klikkes hen til sit felt.
  De to linjer, der ikke kan, ser ud som de andre – og den ene af dem siger ikke engang hvilket felt den
  handler om. På denne fane er skaden begrænset, fordi felterne står i boksen nedenfor, men rækkerne vises
  efter samme sortering som alle andre, og et manglende link læses som «her er intet at rette». Dertil
  bliver `differencekrav-beregningsgrundlag-missing` – en ren blindgyde-besked – helt uden anvisning.
- **Bedre ville være:** de tre id'er får en navigation til fanens egen «Valgmuligheder»-sektion med
  forligsfeltet som fokusmål, præcis som `GRUNDLAEGGENDE_FIELD_BY_ISSUE_ID` gør for Køn og Beregningsdato.
  Det kræver, at `EetIssuesBox`' `handleNavigate` kan pege på Differencekrav-fanen og ikke kun på «EET
  oplysninger» (i dag fører ALLE EET-ruter til `onGoToEetOplysninger`). Forligsdatoens række navngiver
  samtidig sit felt.
- **Andre steder det kan gælde:** prøven er mekanisk og hører på hver EET-fane:
  `rg "toIssue\('|toWarning\('|toFieldIssue\('" src/domain/erhvervsevnetab` giver alle producerede id'er;
  hold dem op mod de fire sæt i `eetFormatUtils.ts`. Alt, hvad der ikke står i et sæt, vises uden link.
  Bemærk at `EetIssuesBox`' antagelse om, at enhver `APP_ROUTES.erhvervsevnetab`-rute betyder «EET
  oplysninger», er selve låsen: den gør et link til et felt på en anden EET-fane umuligt at udtrykke.

### BB-196 – Boksen skriver «indeholder en ugyldig værdi», hvor programmet selv har den konkrete sætning

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** på Differencekrav, i tre trin med hver sin læsning af boksen OG feltets
  tooltip: (a) `150` i Procent, (b) `50` i Procent og `1/3` i brøk, (c) `4/3` i brøk.
- **Det sker:** boksen skriver **den samme generiske sætning i alle tre tilfælde** – «Forlig om ansvarsgrad
  indeholder en ugyldig værdi» – mens feltets eget tooltip er konkret, målt ordret:

  | Indtastning | Boksen | Feltets tooltip |
  |---|---|---|
  | Procent `150` | Forlig om ansvarsgrad indeholder en ugyldig værdi | Procent skal være mellem 1,00 og 100,00 |
  | Procent `50` + brøk `1/3` | Forlig om ansvarsgrad indeholder en ugyldig værdi | Kan ikke udfylde både procent og brøk (på BEGGE felter) |
  | Brøk `4/3` | Forlig om ansvarsgrad indeholder en ugyldig værdi | Brøk skal angives som fx "1/3" og kan ikke overstige 1 |

  Programmet har dertil to ordlyd, det aldrig får brugt: `evaluateForligsgrad` returnerer «Angiv enten
  procent eller brøk – ikke begge» og «Brøk skal angives som fx "1/3" og kan ikke overstige 1», som
  `resolveForligBlocking` ville skrive som «Forlig om ansvarsgrad: …». Men begge de felter, der kan udløse
  dem, har allerede sat en rød feltfejl, så `forlig.hasRejectedInput` er sand, og den generiske gren vinder
  hver gang. **De to konkrete beskeder i `eetSnapshot.ts:272-279` er dermed uopnåelige fra brugerfladen.**
- **Det er uhensigtsmæssigt fordi:** boksens linje er den, brugeren læser først – den står øverst på fanen,
  og de øvrige linjer i den er konkrete og handlingsanvisende. Her siger den kun *at* noget er galt, hvor
  programmet i samme øjeblik ved *hvad*. Og det er tre forskellige regler, der får én tekst, så brugeren
  ikke kan se, om han skal ændre en værdi, fjerne en værdi eller vælge mellem to felter. Prøvekatalogets
  A5 om to formuleringer for én brudt regel rammer her i sin omvendte form: én formulering for tre regler.
- **Bedre ville være:** boksens linje bærer feltets egen besked, som de øvrige `field-*`-issues gør (de
  føres ind gennem `toFieldIssue` med feltets `errorMessage`). Konkret: `resolveForligBlocking` får
  procentens og brøkens `errorMessage` med og skriver «Forlig om ansvarsgrad: Brøk skal angives som fx
  "1/3" og kan ikke overstige 1». Den generiske sætning beholdes kun som sidste udvej.
- **Andre steder det kan gælde:** `rg "indeholder en ugyldig værdi" src` – hver generisk «ugyldig
  værdi»-sætning, hvor det udløsende felt har sin egen besked, er samme form. Prøven: for hvert issue, der
  udspringer af et felts `errorMessage`, spørg om beskeden er feltets egen eller en ny, vagere sætning.

### BB-197 – Et forlig på 100 % forsvinder helt fra specifikationen

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** på en regnende sag, skriv `50` i «Procent» og læs specifikationens
  «Differencekrav»-afsnit. Skriv derefter `100` og læs det igen.
- **Det sker:** ved `50` står der to linjer, målt ordret:

  ```
  Der er indgået forlig i sagen på betaling af 50 %.
  Beregnet differencekrav (50 % af 2.064.024 kr.)      1.032.012 kr.
  ```

  Ved `100` står der: «Beregnet differencekrav **2.064.024 kr.**» – og **ingen forligssætning**.
  Specifikationen er ordret identisk med en sag helt uden forlig (målt: begge giver samme ene linje). Målt
  i koden: `reducerer = forlig.factor < 1`, og både `forligLabel` og `forligDato` sættes til `null`, når
  den er falsk.
- **Det er uhensigtsmæssigt fordi:** et forlig på 100 % ansvarsgrad er et almindeligt udfald – modparten
  har anerkendt fuldt ansvar – og det er en oplysning, brugeren netop har indtastet, fordi den skal stå i
  papiret. At beløbet ikke reduceres, er rigtigt; at oplysningen forsvinder, er ikke. Brugeren kan ikke se,
  om programmet forstod hans indtastning eller kastede den væk, og han kan heller ikke se det på feltet,
  som beholder «100,00». Har han også udfyldt forligsdatoen, forsvinder den med.
- **Bedre ville være:** forligssætningen skrives, når der ER angivet et gyldigt forlig, uanset procenten:
  «Der er den 1. maj 2022 indgået forlig i sagen på betaling af 100 %.» Kun parentesen i «Beregnet
  differencekrav (… af …)» udelades ved 100 %, fordi der ikke er nogen reduktion at vise.
- **Andre steder det kan gælde:** samme `reducerer`-betingelse styrer forligets synlighed i
  differencekravdokumentet. `rg "factor < 1" src/domain` – hvert sted, hvor en neutral faktor bruges som
  «ingen oplysning», er en kandidat. Det er M-13's kerne i en ny form: **en værdi, der ikke ændrer
  regnestykket, er stadig en oplysning.**

### BB-198 – «Reguleringsprocent (01-06-2022)» og «Reguleringsprocent (2021)» i to nabobokse

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-186 (beregningsdato `01-06-2022`, så begge bokse har en
  reguleringsrække). Læs de to bokse nederst på fanen.
- **Det sker:** samme rækkenavn med to slags parentesindhold, målt på samme skærm:

  ```
  Proformakapitalisering af rest-EET:             Reguleringsprocent (01-06-2022)   55,4 %
  Mer-erstatning ved forhøjet folkepensionsalder: Reguleringsprocent (2021)         53,6 %
  ```

  Den ene parentes er en dato, den anden et årstal – og de to tal er forskellige, fordi de hører til
  forskellige satsår (`satsAar` = året én måned efter forhøjelsesdatoen). Kapitaliseringsfanen skriver
  datoformen («Reguleringsprocent (01-06-2020)»), så mer-erstatningen er den eneste af de tre, der bruger
  årstallet.
- **Det er uhensigtsmæssigt fordi:** brugeren, der ser to rækker med samme navn og to forskellige tal,
  skal selv slutte, at parentesen betyder to forskellige ting – og at forskellen i tal er en konsekvens af
  det, ikke en fejl. Årstallet er dertil ikke en oplysning, brugeren har givet: det er afledt af
  forhøjelsesdatoen plus én måned, og den regel står ingen steder.
- **Bedre ville være:** samme form som de to øvrige bokse – «Reguleringsprocent (31-01-2021)», altså den
  dato satsen slås op på. Skal årstallet bevares, skal rækken sige hvorfor: «Reguleringsprocent (satsår
  2021)». BB-176's rettelse valgte datoformen for kapitaliseringsfanen; den er den etablerede.
- **Andre steder det kan gælde:** `rg "Reguleringsprocent \(" src` giver fire kaldssteder i fire filer
  (skærm og dokument for hver af de to bokse). Prøven: for hver rækkeetiket med en parentes, tjek om
  parentesens ART (dato · årstal · procent) er den samme overalt, hvor etiketten optræder.

### BB-199 – «Beregningsdato → 1. juni 2022» og «Kapitaliseringsdato → 01-06-2022» er samme dag i to formater

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** samme sag som BB-186. Læs «Beregning»-boksens første række, og læs derefter
  «Proformakapitalisering af rest-EET»-boksens første række. Hent til sidst dokumentet og læs dets
  «Beregningsdato»-række.
- **Det sker:** tre visninger af den 1. juni 2022, målt ordret:

  | Sted | Ordlyd |
  |---|---|
  | «Beregning» → Beregningsdato (skærm) | **1. juni 2022** |
  | «Proformakapitalisering af rest-EET» → Kapitaliseringsdato (skærm) | **01-06-2022** |
  | Dokumentets «Beregning» → Beregningsdato | **01-06-2022** |

  Proformakapitaliseringen sker pr. definition på beregningsdatoen, så de to skærmrækker viser samme dag.
  Fladens øvrige datobrug er ellers konsekvent: overskrifter er lange («Afgørelse 1. juni 2020»,
  «Forhøjelse pr. 31. december 2020»), indlejrede datoer er korte («Kapitaliseret (25 %) den 01-06-2020»).
  **Beregningsdato-rækken er den eneste undtagelse:** den er en etiketteret række som
  Kapitaliseringsdato-rækken, men skrives i langform – og kun på skærmen.
- **Det er uhensigtsmæssigt fordi:** to etiketterede datorækker i samme kolonne på samme skærm bør se ens
  ud, ellers læses forskellen som en forskel i indhold. Og at dokumentet skriver kortformen af netop den
  række, skærmen skriver i langform, er BB-176's fund igen – det blev rettet for kapitaliseringsfanen og
  står tilbage her.
- **Bedre ville være:** kortformen `dd-mm-åååå` i Beregningsdato-rækken på begge kanaler, som
  Kapitaliseringsdato-rækken og som feltet selv bruger.
- **Andre steder det kan gælde:** `rg "formatIsoDateLong" src/components/pages src/document/generators` –
  hvert kald i en etiketteret RÆKKE (frem for en overskrift eller en prosasætning) er en kandidat. Fanens
  øvrige `formatIsoDateLong`-kald er alle overskrifter eller forligssætningen og er derfor i orden.

### BB-200 – Forligsprocenten står som «50,00» i feltet og «50 %» i sætningen, og grænsen siger «mellem 1,00 og 100,00»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** skriv `50` i «Procent» under «Forlig om ansvarsgrad» og tryk Enter. Læs
  feltet, læs specifikationens forligssætning, og skriv derefter `150` og læs tooltippet.
- **Det sker:** fire skrivemåder for samme tal på samme skærm, målt ordret:

  ```
  feltet:                50,00
  forligssætningen:      Der er indgået forlig i sagen på betaling af 50 %.
  label:                 Beregnet differencekrav (50 % af 2.064.024 kr.)
  grænsetooltip (150):   Procent skal være mellem 1,00 og 100,00
  ```

  `12,5` bliver «12,50» i feltet og «12,5 %» i sætningen; `100` bliver «100,00». Feltet er det eneste
  procentfelt på fanen (og det eneste, brugeren møder på hele EET-siden) med tvungne to decimaler, og
  grænseteksten er den eneste med decimaler – EET %-felterne fik ved BB-144 «Erhvervsevnetabet skal være
  mellem 5 og 100».
- **Det er uhensigtsmæssigt fordi:** «50,00» læses som en præcisionsangivelse, brugeren ikke har givet, og
  grænsen «mellem 1,00 og 100,00» får det til at se ud som om decimalerne er påkrævede. Brugeren, der
  sammenligner feltet med sætningen ti centimeter længere ned, ser to tal og skal selv se, at det er
  samme. Bemærk at decimalerne SKAL kunne indtastes (12,5 % er et virkeligt forlig) – det er visningen af
  hele tal, der er afvigeren.
- **Bedre ville være:** feltet trimmer «,00» ved settle, som `formatPercent` gør i sætningen, så `50`
  bliver «50» og `12,5` bliver «12,5». Grænseteksten følger samme regel: «Procent skal være mellem 1 og
  100».
- **Andre steder det kan gælde:** felterne bor på Erstatningsopgørelsen (`eo.forligAnsvarsgradProcent`) og
  renderes af begge sider, så rettelsen rammer to flader. `rg "allowDecimals: true" src/inputCore/catalog`
  – hvert procentfelt med decimaler er en kandidat for både visningsformen og grænseteksten.

### BB-201 – «Ikke kapitaliseret.» står ved en midlertidig afgørelse, som programmet selv forbyder at kapitalisere

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren
- **Sådan fremprovokeres det:** byg sagen fra BB-188 (to midlertidige afgørelser, ingen kapitalisering) og
  læs afsnittet «Kapitaliserede ASL-beløb».
- **Det sker:** afsnittet består udelukkende af negationer, målt ordret:

  ```
  Kapitaliserede ASL-beløb
  Værdien af modtagne kapitalbeløb fratrækkes.
  Afgørelse 1. december 2018
  Ikke kapitaliseret.
  Afgørelse 1. juni 2020
  Ikke kapitaliseret.
  ```

  Begge afgørelser er midlertidige, og en midlertidig afgørelse KAN ikke kapitaliseres – fanen «EET
  oplysninger» afviser en Kap.dato på den med «Kapitaliseringsdato må kun udfyldes ved endelig eller
  delvist endelig afgørelsestype.» Programmet skriver altså «ikke kapitaliseret» om noget, det selv
  forbyder. I samme afsnit står den generelle sætning «Værdien af modtagne kapitalbeløb fratrækkes» over et
  afsnit uden et enkelt beløb.
- **Det er uhensigtsmæssigt fordi:** «Ikke kapitaliseret.» læses som en oplysning om, hvad der mangler –
  altså som en opfordring til at udfylde noget. Brugeren, der går tilbage for at rette det, møder en rød
  celle, der siger, at han ikke må. Fire linjer bruges på at oplyse et fravær, der er en følge af
  afgørelsestypen, og som brugeren allerede ved.
- **Bedre ville være:** afgørelser, der ikke KAN kapitaliseres, udelades af afsnittet, og er ingen af
  sagens afgørelser kapitaliserbare, skriver afsnittet én linje: «Ingen af sagens afgørelser er
  kapitaliseret.» «Ikke kapitaliseret.» beholdes til en endelig eller delvist endelig afgørelse, hvor
  kapitaliseringen faktisk mangler. **Naboiagttagelse til samme fane:** mer-erstatningsboksen har en
  «Samlet mer-erstatning»-række ved flere events (målt: `69.525 kr.`), mens specifikationen lister de to
  fradrag uden sum, og dokumentets bilag heller ikke har nogen sum. De tre steder bør være enige om,
  hvorvidt summen vises.
- **Andre steder det kan gælde:** `aslRowsForDisplay` i `eetDifferencekravCalculation.ts:802` filtrerer kun
  på EET % og afgørelsesdato, ikke på afgørelsestype. `rg "Ikke kapitaliseret|ikke relevante" src` – hver
  «ikke»-linje om et felt, brugeren ikke må udfylde, er samme form. Jf. BB-187, som er den tunge udgave af
  samme forhold i naboafsnittet.

## Åbne spørgsmål til udvikleren

**Skal løbende ydelser under en DELVIST ENDELIG afgørelse fradrages i differencekravet ved skader fra
16. juni 2011?** `skalFradragForetages` (`eetDifferencekravCalculation.ts:505-511`) returnerer `true` for
`'Endelig'` alene, så en delvist endelig afgørelse behandles som en midlertidig. I den målte sag betyder
det, at 66.827 kr. faktisk udbetalte løbende ydelser ikke fradrages. Spørgsmålet er rejst her og ikke
afgjort, fordi det er beregningslogik; BB-187 registrerer alene, at TEKSTEN begrunder sig med en regel om
midlertidige ydelser, som ikke omfatter rækkens egen type. **Svaret afgør, om BB-187 er en tekstrettelse
eller en beregningsrettelse.**

## Overvejet uden fund

- **Det klampede nul er ydelsens svar, ikke et plaster – ingen fund (M-24's skærpede prøve).** Målt:
  `1.867.050 − 88.113 − 389.275 − 834.979 − 797.783 − 43.453 = −286.553`, og fanen skriver «Beregnet
  differencekrav **0 kr.**» med fed. Formen er ordret BB-119's, som er **afvist**: et differencekrav er pr.
  definition det OVERSKYDENDE krav efter EAL, en negativ værdi er juridisk umulig, og nullet er
  målgruppens velkendte resultatform. Prøven er kørt (`sæt B større end A og læs linjen`), og bedømmelsen
  falder på samme side som forsørgertabets. Genrejses ikke.
- **De tre forligsfelter er delt med Erstatningsopgørelsen – efterprøvet, ingen fund.** Målt: `2/3` tastet
  på Differencekrav står bagefter i EO-oplysningers «Forlig»-boks, og de tre felter er ÉN descriptor
  (`eoForligAnsvarsgradProcentField` m.fl. gennem `forligInputPort`). Men de synlige etiketter er ordret
  ens på de to flader («Forlig om ansvarsgrad» · «Procent» · «eller brøk» · «Evt. dato for forlig»), så
  M-26's navnedel – den del af BB-123, der blev godkendt – er allerede opfyldt. Koblingsdelen er afvist to
  gange (BB-123, og TVAERGAAENDE's afgørelse om at Mineo er en samling selvstændige værktøjer, hvor et
  fund kræver en kobling, der virker anderledes end den ser ud). Her ER der én ansvarsgrad pr. sag, og den
  ser ud og virker ens på begge flader. Registreres derfor som efterprøvet, ikke som fund.
- **BB-184's «Kapitaliseringsfaktor» står nu i ÉT dokument – afgørelsen holder alligevel.** I det hentede
  differencekrav står «Kapitaliseringsfaktor 10» (EAL-bilaget), «Kapitaliseringsfaktor 10,461»
  (kapitaliseringsbilaget) og «Kapitaliseringsfaktor 10,073» (proformabilaget). BB-184 blev afvist med, at
  det er samme begreb med to fastsættelsesmåder; at de tre nu kan stå i samme papir ændrer ikke
  begrundelsen, og fundet genrejses ikke.
- **M-25's prøve gav ÉT træf og er dermed lukket for fanen** (BB-188). Efterprøvet for de øvrige fire
  bilag: `ealComputation` kan ikke være `null`, når gaten slipper igennem, `loebendeComputation` kun sammen
  med et blokerende issue, og de to betingede bilag er allerede gated på deres indhold. **Kun
  `no-endelig-afgoerelser`-grenen er reachable, fordi netop det issue filtreres væk.**
- **M-30's skema er kørt for fanen og er BESTÅET.** `rg "toWarning\('warn-" src/domain/erhvervsevnetab`:
  differencekravet producerer `warn-dato-efter-beregningsdato` selv (og genindsætter den EFTER dedupe, så
  nabomotorernes udgave ikke maskerer den), og det aftager kapitaliserings- og løbende-ydelsesmotorens
  advarsler direkte. Målt: advarslen «Beregningsdatoen (01-06-2022) ligger før sagens afgørelser.» står på
  fanen med link til Grundlæggende oplysninger, hvor fane 4 i samme sag er tavs – men det er BB-179's
  afviste forhold, ikke et nyt.
- **M-29 er uden genstand.** Fanens egne felter er tre forligsfelter og syv boolske kontroller; der findes
  altid en lovlig indtastning (lad forliget stå tomt), og de to forligsregler udelukker ikke hinanden.
- **B0-grænseeftersynet er kørt for alle tre indtastningsfelter, og alle tre har en skarp grænse.**
  Procent: `1–100` med decimaler. Brøk: tæller ≤ nævner, ingen nul-tæller, cifferloft. **Forligsdatoen har
  dags dato som maksimum** – målt: `31-12-2026` er rød med «Dato skal være mellem 01-06-2018 og
  07-09-2026», `07-09-2026` (dags dato) er grøn. En forligsdato i fremtiden er altså afvist, hvor fanens
  øvrige datoer går til `31-12-2026`. Det er den rigtige grænse for netop dette felt, og B5's prøve om en
  «lovlig men umulig» dato er dermed uden genstand.
- **Forligsdato uden ansvarsgrad er dækket.** Målt: `01-05-2022` alene giver rød kant og «Dato for forlig
  kræver, at ansvarsgrad angives som procent eller brøk» – en konkret, feltnavngivende besked. Reglen bor i
  `forligAnsvarsgradRules.ts` som delt kilde med EO.
- **Den tomme sag er velopdragen.** Efter «Slet alt» viser fanen fem issues, alle med link («Fødselsdato er
  ikke udfyldt → Stamdata → Skadelidte», «Skadedato er ikke udfyldt», «Beregningsdato er ikke udfyldt → EET
  oplysninger → Grundlæggende oplysninger», «Skadelidtes årsløn (efter ASL) er ikke udfyldt», «Ingen
  ASL-afgørelser er indtastet»), og downloadknappen er «Indtastning mangler». BB-181's rettelse virker:
  `eet-pct-missing` undertrykkes, når tabellen er tom, så der er ÉN besked om den manglende procent og ikke
  to. «Slet alt» åbner fanen «EET oplysninger» (BF-052).
- **M-19/M-22 er efterprøvet og BESTÅET.** Med `99-99-9999` i Stamdatas Skadedato skriver fanen «Der er
  udfyldt en ugyldig værdi i feltet 'Skadedato'» med link til Stamdata → Skadelidte, og knappen bliver
  «Fejl i indtastning». Rettes datoen, forsvinder boksen, og knappen bliver aktiv igen i samme øjeblik.
- **BB-167's prøve er kørt for hver værdi i «Beregning»-boksen og BESTÅET.** Beregningsdatoen styrer alt på
  denne fane – målt ved at flytte den fra `01-06-2024` til `01-06-2022`: EAL-kravet, alle fire fradrag,
  proformaens dato/alder/faktor og bundlinjen ændrede sig. Rækken er ikke dekorativ.
- **M-09 er målt og BESTÅET.** Ved 1536×864: `document.scrollWidth = innerWidth = 1536`, boksenes højre
  kant ved 1478, ingen boks med indre overløb, indholdsskala 0,97. Ved 1244×620: skala 0,79, højre kant
  1204, fortsat ingen vandret scroll.
- **M-10 er målt og BESTÅET, men med en tæt margin værd at kende.** «Scroll til toppen»-knappen ligger ved
  x = 1451–1505. De to toggles i «Valgmuligheder» har højre kant ved **1471**, altså 20 px inde i knappens
  søjle – men de står så højt på siden, at de er rullet forbi knappens y-bånd (779–833), før knappen
  overhovedet vises. Gennemrullet i 60 px-trin uden en enkelt overlapning mellem knappen og en kontrol.
  Ændres boksrækkefølgen, kan marginen forsvinde.
- **Tab-ringen er komplet og i visuel rækkefølge.** Målt 12 stop og retur: downloadknap → de fem bilagsvalg
  → «Medtag udvidet specifikation» → «Endelig EET-afgørelse …» → «Indregn mer-erstatning …» → Procent →
  brøk → Forligsdato → downloadknappen igen. Ingen huller. De tre toggles har korrekt `aria-labelledby` til
  deres synlige etiket (BF-057), og de tre forligsfelter bærer descriptorens navne («Forlig ansvarsgrad
  (%)» / «(brøk)» / «Forligsdato»), som er mere sigende end de synlige «Procent» / «eller brøk» alene –
  ikke registreret som fund.
- **Escape, Delete og undo/redo er efterprøvet på fanens egne felter.** Escape efter en ændring bevarer den
  afsluttede værdi (`50,00` → `77` + Escape → `50,00`). Delete og Backspace på et fokuseret,
  ikke-redigerende felt rydder hele feltet. Ctrl+Z gendanner både en ryddet feltværdi og et bilagsvalg.
  Faneskift med en åben draft settler den (`33` → `33,00`, BF-066).
- **Rækkefølgen «bilag før valgmuligheder» er efterprøvet.** Bilagsvalgene står i «Beregning»-boksen ØVERST
  og de to beregnings-toggles i «Valgmuligheder» NEDERST, selv om togglene bestemmer, om bilagene findes.
  Tooltippet «Mer-erstatning er fravalgt **nedenfor**» navngiver retningen, og rækkefølgen er den, brugeren
  arbejder i (vælg beregning, hent papir). Ikke registreret som fund.
- **Konsollen var tavs gennem hele kørslen:** 191 beskeder i den første session og 182 i den anden, 0 fejl
  og 0 advarsler i begge.

## Dækningshuller

- Kun Chrome, lyst tema, 1536×864 (M-09 desuden 1244×620). Mørkt tema og de tre øvrige browsere er ikke
  målt.
- `Gem`/`Hent` er ikke afprøvet – filvælgeren kan ikke betjenes headless (samme hul som BB-049).
  Bilagsvalgenes og de to togglers overlevelse gennem en `.eo`-runde hviler derfor på schemaet, ikke på en
  målt fil. Det er værd at måle, fordi begge toggles har `true` som default: en ældre fil uden felterne får
  dem sat til Ja.
- Brevhovedet er ikke slået til. Dokumenterne er hentet som `.docx`; **PDF-kanalen er ikke læst**, så
  BB-190's manglende «kr.» er verificeret i Word-udgaven og i generatorkoden, som er fælles for begge
  kanaler.
- **Mer-erstatningens tavse issue-tab er kildelæst, ikke målt.** `computeMerErstatningPensionsalder` skriver
  sine fejl i en lokal liste, der aldrig merges (BB-189's sidste afsnit). Jeg fandt ingen indtastning, der
  når den gren, uden at et søskende-issue blokerer fanen i forvejen, så den er registreret som en
  kodeiagttagelse under BB-189 og ikke som et selvstændigt fund.
- «Meget mange afgørelser» (B3) er ikke målt – højst tre rækker og to mer-erstatningsevents er brugt.
- Differencekravets adfærd ved skader **før** 16-06-2011 (hvor alle løbende ydelser fradrages) er kun
  kildelæst; kun `fradragGaelderForFoer2011 = false`-grenen er målt.
