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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
- **Beslutning:** Afventer udvikleren
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
