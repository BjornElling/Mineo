# Brugerblik – Erstatningsopgørelse → Ansættelsesforholdet: ramme, lønforhold og satser (12g)

- Rute/placering: `/erstatningsopgoerelse` → fanen «Lønindkomst»: introboksen «Ansættelsesforhold», tilføj- og
  slet-dialogerne, kortets overskrift og øverste felter («Navn på arbejdssted», «Ansat på skadedatoen», «Opsagt fra
  stillingen», «Sidste dag i ansættelsesforholdet»), underafsnittet «Lønforhold» (overenskomst med filtrene «L:»/«A:»,
  «Fuld løn under ferie», «Løn på helligdage», «Beregn Store Bededagstillæg fra 1. januar 2024», «Evt. særlig fra-dato
  for regulering», «Løn indtastes som», «Tillæg angives som») og satsafsnittet («Satser …») – samt opgørelsens
  bilag «SH-dage» og de linjer i «Fejl og advarsler», kortet udløser.
- Gennemgået: 2026-10-06 · commit `e8ea87f8` · **afgjort og gennemført 2026-10-06** (BB-276 afvist som fejl, men bilagets
  satslinjer dateret; BB-286 delvist afvist; BB-275, BB-276 og BB-283 afgjort efter modsvar)
- Afprøvet i: Chrome headless, lyst tema, 1536×864 og 1536×1400 (M-09 desuden 1244×620). Dokumenter hentet som `.pdf`
  og læst med `pypdf`. Sag: skadedato `01-06-2018` (arbejdsulykke), «Vedrører perioden» og TAF-periode `01-01-2024` –
  `31-12-2024`, «Opgørelse lavet den» `01-02-2025`, beregningsperiode `01-06-2017` – `31-05-2018`. Ét
  ansættelsesforhold «Firma A» med 12 lønrækker à `30.000 kr.` (juni 2017 – maj 2018), lønudvikling og
  sygeferiegodtgørelse «Ingen», standardværdierne «Fuld løn under ferie» til og «Almindelig løn». To ansættelsesforhold
  og Bygge-/anlægsoverenskomsten (3F / Dansk Industri) hvor angivet.

## Fladen kort

Lønindkomst starter tom; den blå knap åbner en bekræftelsesdialog og indsætter et kort nederst. Kortet samler alt om
ét ansættelsesforhold. Øverst står ansættelsens ramme (navn, ansat på skadedatoen, opsigelse), derefter
«Lønforhold», som afgør tre ting, brugeren ikke ser herfra: hvilke satser overenskomsten låser, om tabt
arbejdsfortjeneste opgøres i måneder eller arbejdsdage (`computeTafBeregningsenhed` – «Fuld løn under ferie» og «Løn på
helligdage» skifter enheden, når kortet har løn i beregningsperioden), og hvilken dato satserne slås op på. Satsafsnittets
overskrift nævner datoen («Satser ved beregningsperiodens udløb (31-05-2018)»), og siden 2026-10-06 regnes HELE
beregningsperiodens tillæg og pension med netop de satser.

**Fladens gennemgående træk er, at en sats, programmet ikke har, regnes som 0 % uden et ord.** Et tomt feriefelt
fjerner 45.000 kr. fra kravet, mens 0 og 1 er røde (BB-274); en særlig fra-dato uden for overenskomstens dækning
fjerner SH/SO og pension (BB-275). Det er et nyt tværgående mønster, M-37. Dertil to steder, hvor papiret modsiger sig
selv: bilaget regner tillæg med andre satser end beregningsgrundlaget (BB-276), og et unavngivet ansættelsesforhold
hedder to ting (BB-279).

**Afgrænsning.** Indtægtstabellen hører i 12h, lønudvikling, anciennitet og løntrin-finderen i 12i,
sygeferiegodtgørelsen i 12j. Satsafsnittet er med her, fordi dets satser er det, både tabellen og grundlaget regner på.

## Fund

### BB-274 – Et tomt «Feriegodtgørelse/-tillæg» regnes som 0 % uden et ord – mens 0 og 1 er røde

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-37--en-manglende-sats-regnes-som-0--uden-et-ord`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-06 med ændret form: et felt, brugeren ikke har skrevet i, får ingen rød ring; manglen meldes og blokerer på Beregning. **GENNEMFØRT** 2026-10-06: «Feriegodtgørelse/-tillæg» er påkrævet, når kortet har lønoplysninger i procent-tilstand, uanset reguleringsform og beregningsmåde (`isFeriePctPaakraevet`, `feriepenge-begreber-contract.md` §2b). Tomt felt: ingen ring, men den blokerende linje «Satser ved beregningsperiodens udløb (31-05-2018): Feriegodtgørelse/-tillæg er ikke udfyldt». Den tidligere røde ring på det tomme felt ved «Overenskomst»/«Manuelt angivet» er fjernet. En indtastet værdi under 12 % er fortsat rød. Følge: 0 % kan ikke længere regnes i procent-tilstand (`0` er rød); en sag uden feriegodtgørelse opgøres med «Tillæg angives som» «Beløb».
- **Sådan fremprovokeres det:**
  1. Grundsagen; lønudvikling «Ingen» (eller «Statistik», «KRL satstabel», «KL-lønaftaler», «Manuel procentsats»).
  2. Lad «Feriegodtgørelse/-tillæg» stå tomt. Hent opgørelsen. Udfyld derefter `12,5` og hent igen.
- **Det sker:** Med tomt felt: ingen ring, ingen «Fejl og advarsler»-boks, aktiv download. Papiret: «Løn i
  beregningsperioden 360.000,00 kr. … Månedsløn: 360.000,00 kr. / 12 måneder = 30.000,00 kr.» og **Tabt
  arbejdsfortjeneste 360.000,00 kr.** Med `12,5`: «Feriegodtgørelse/-tillæg (12,5 %) 45.000,00 kr. / I alt: 405.000,00
  kr.» og **405.000,00 kr.** Forskellen er 45.000 kr. Det eneste spor på skærmen er tabellens kolonne «FP/FV/SH/SO/St.B.»,
  der står på `0,00 kr.` i hver række.
  Samtidig er `0`, `1` og `11,99` RØDE med «Ved løn under ferie opgøres ferietillægget beregningsteknisk som
  feriegodtgørelse (12,5 %, eller 15 % ved ret til 6. ferieuge)» og spærrer. Den eneste måde at få 0 % igennem er at lade
  feltet stå tomt. Ved «Overenskomst» og «Manuelt angivet» får det tomme felt derimod rød ring («Feriegodtgørelse/-tillæg
  skal udfyldes»).
  Mekanikken: `isFeriePctRelevant` (`loenindkomstSatsAssessment.ts:68-79`) kræver feltet kun ved de to reguleringsformer,
  der opregulerer med satserne – men lønrækkernes tillæg og beregningsgrundlaget læser feltet ved ALLE former
  (`calculateStandardLoenDerivedFromAmounts`, `resolveBeregningsperiodeEmployerAtReguleringsdato`). Relevansmatricens
  præmis («de øvrige former … rører ikke feltet») gælder lønudviklingen, ikke grundlaget.
- **Det er uhensigtsmæssigt fordi:** En lønmodtager får altid enten feriegodtgørelse eller ferietillæg
  (`feriepenge-begreber-contract.md` regel 1), så et tomt felt er næsten altid glemt. Programmet ved det – det afviser
  selv 1 % – men lader den tomme form passere og trækker 11 % fra kravet, uden at skærmen viser et resultat (BB-226).
- **Bedre ville være:** Feltet er påkrævet i procent-tilstand, når kortet har lønoplysninger, uanset reguleringsform:
  rød ring «Feriegodtgørelse/-tillæg skal udfyldes», som ved «Overenskomst» i dag. Ønsker udvikleren at tillade 0 %
  bevidst, så en gul ring med samme tekst.
- **Andre steder det kan gælde:** Årslønsberegningen (`beregnFejlmeddelelser` i `aarsloenValidationPolicies.ts:143` regner
  et tomt felt som 0 og advarer kun ved en sats over 0) – uafprøvet.

**Tilbagemelding**
Jeg vil ikke have, at et ikke-udfyldt felt skal give rød ring, når brugeren ikke engang har indtastet noget endnu. Det er ikke en ønskværdige UI. Dette er baggrunden for den aktuelle tilstand. Men jeg vil være meget interesseret i, hvis der kunne laves en sikring mod manglende og uønskede indtastninger, fx. ved at de giver fejl og blokerer download på selve beregning-fanen, og der må også gerne fortsat komme rød ring og fejl i indtastningsfeltet, så længe det bare sker på baggrund af en faktisk indtastning, som brugeren har foretaget. 

### BB-275 – Når overenskomsten ikke har satser på reguleringsdatoen, forsvinder SH/SO og pension tavst

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-37--en-manglende-sats-regnes-som-0--uden-et-ord`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** 2026-10-06 med udviklerens præcisering: en privat overenskomst dikterer tillæggene – et tillæg, den ikke har, er 0 % og forbliver låst; felterne låses aldrig op til egen indtastning (de offentlige overenskomster er undtagelsen). Det skal skelnes fra, at programmet slet ikke har satserne. Efter modsvar samme dag: (a) ligger reguleringsdatoen før overenskomstens første satser, blokeres med en navngiven fejl; (b) lønrækker før dækningen regnes uden overenskomstens tillæg med en gul advarsel; (c) Faglærte-overenskomstens fritvalg (den eneste private «ingen sats») låses til 0 %. **GENNEMFØRT** 2026-10-06: satsbindingen er bygget om til tre tilstande – fastsat af overenskomsten, utilgængelig, brugerens eget felt (`OverenskomstSatsBinding`); satsdata håndhæver ved load, at en privat overenskomst fastsætter alle tre tillæg (`assertPrivatOverenskomstFastsaetterTillaeg`). Reguleringsdato før dækningen: felterne står låste og tomme, og linjen «… har ingen satser før 01-03-2011 – vælg en senere reguleringsdato» blokerer; er datoen den særlige fra-dato, bærer feltet rød ring med samme tekst. Lønrækker før dækningen: gul linje «… – lønrækker før denne dato er regnet uden overenskomstens tillæg». Sygeferiegodtgørelsens pension følger samme regel og bruger nu aktiv-prædikatet (toggle OG id).
- **Sådan fremprovokeres det:**
  1. Grundsagen med «Feriegodtgørelse/-tillæg» `12,5` og overenskomsten «Bygge-/anlægsoverenskomsten (3F / Dansk
     Industri)». Satsafsnittet viser låste satser: SH/SO `3,40 %`, pension `8,15 %`.
  2. «Evt. særlig fra-dato for regulering» `01-01-2010` (også `01-01-2005`). Hent opgørelsen.
- **Det sker:** Overskriften bliver «Satser på den manuelt angivne reguleringsdato (01-01-2010)», og fritvalg, SH/SO og
  pension bliver åbne, TOMME felter. Ingen ring, ingen boks. Papiret: «Løn i beregningsperioden 360.000,00 kr. /
  Feriegodtgørelse/-tillæg (12,5 %) 45.000,00 kr. / I alt: 405.000,00 kr.» – mod «… + S/H (3,4 %) 57.240,00 kr. /
  Arbejdsgivers pensionsbidrag (8,15 % af løn + tillæg) 34.005,06 kr. / I alt: 451.245,06 kr.» uden datoen. Kravet falder
  fra 451.245,00 kr. til 405.000,00 kr. Årsagen: overenskomstens satser findes ikke på datoen, og
  `resolveOverenskomstSatsBindings` falder da tilbage til de ulåste felter (`loenindkomstSatser.ts:138-156`) – som
  brugeren aldrig har udfyldt, fordi de var låste.
- **Det er uhensigtsmæssigt fordi:** Brugeren har valgt en overenskomst og set satserne stå der. At de forsvinder, fordi en
  dato flyttede sig, ser ud som en tom indtastning, ikke som «programmet har ingen tal» – og det koster 46.245 kr. uden spor.
- **Bedre ville være:** Kan overenskomstens satser ikke slås op, siger kortet det ved satsfelterne med en gul ring og
  linjen «Bygge-/anlægsoverenskomsten (3F / Dansk Industri) har ingen satser for 01-01-2010 – angiv satserne, eller
  vælg en anden dato», og de tomme felter behandles som manglende (rød ring), ikke som 0 %.
- **Andre steder det kan gælde:** En beregningsperiode, der slutter før overenskomstens dækning, giver samme fald uden
  særlig dato – uafprøvet. KRL-/KL-tabellerne uden for dækning (12i) melder i dag «Reguleringsværdi … mangler», men kun
  ved den tilsvarende reguleringsform.

**Tilbagemelding**
Der vil være situationer, hvor en overenskomst ikke har et givent tillæg på beregningsdatoen, fx. SH/SO, men hvor dette senere kommer ind i overenskomsten. Det skal programmet være i stand til at håndtere korrekt sådan, at satsen for SH/SO i dette tilfælde er 0 % på beregningstidspunktet. Det vil i dette tilfælde være forkert, at deaktivere SH/SO. Brugeren må desuden aldrig få låst tillæg-felterne op til egen indtastning, blot fordi overenskomsten ikke indeholder de pågældende tillæg. Fraset det særlige tilfælde med de offentlige overenskomster, dikterer de private overenskomster hvilke tillæg der gives, og brugeren skal ikke kunne tilføje tillæg udover disse. Find gerne en god, velstruktureret løsning til at håndhæve det - og hvis den aktuelle kode er noget rod, er det fint for mig, at du bygger en ny og bedre struktur op fra bunden. Funktionaliteten skal dog kunne sondre disse tilfælde fra, at programmet ved en fejl slet ikke kunne slå overenskomstens satser op.

### BB-276 – Bilaget og løntabellen regner tillæg med månedens satser, beregningsgrundlaget med satserne ved periodens udløb

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (dokument mod dokument)
- **Prioritet:** **Høj**
- **Beslutning:** **AFVIST som fejl** af udvikleren 2026-10-06: rækkerne skal afspejle lønsedlen (månedens satser), og grundlaget lægger tillæg og pension til med satserne på beregningstidspunktet – et bevidst kompromis. Efter modsvar om bilagets udaterede satslinje: **GODKENDT** form (b). **GENNEMFØRT** 2026-10-06: bilagets satslinjer står under satsoverskriften med dato («Satser ved beregningsperiodens udløb (31-05-2018):») efterfulgt af «Tillæg i tabellen er beregnet med de satser, der gjaldt i den enkelte måned.» Overskriften kommer fra samme helper som skærmen (`resolveSatserHeadingForAnsaettelsesforhold`).
- **Sådan fremprovokeres det:** Grundsagen med `12,5` og Bygge-/anlægsoverenskomsten, bilaget «Lønindkomst» valgt. Hent
  opgørelsen.
- **Det sker:** Beregningsgrundlaget: «Feriegodtgørelse/-tillæg (12,5 %) + S/H (3,4 %) 57.240,00 kr. / … / I alt:
  451.245,06 kr.» – hele perioden med satserne ved beregningsperiodens udløb (udviklerens afgørelse 2026-10-06,
  commit `e40b938a`). Lønindkomstbilaget i SAMME pdf skriver øverst «SH/SO-sats: 3,4 %», men dets rækker for juni 2017
  – februar 2018 er regnet med 2,7 %: «30.000,00 · 4.560,00 · 2.816,64 · 37.376,64» (9 rækker), og kun marts – maj 2018
  med 3,4 %: «… 4.770,00 · 2.833,76 · 37.603,75». Rækkerne summerer til 449.201,02 kr. – 2.044,04 kr. under grundlaget.
  Skærmens løntabel viser bilagets tal. Commit-beskeden nævner kun grundlønnen og «Indtægt før skadedatoen»; tabellen og
  bilaget (`loenindkomstRowDerived.ts`, `loenindkomstSection.ts`) regner fortsat månedens satser.
- **Det er uhensigtsmæssigt fordi:** Modparten kan ikke efterregne grundlaget fra bilaget, og bilagets egen satslinje
  står over rækker, der ikke bruger den. På skærmen står samme modsætning mellem satsoverskriften og tabellen.
- **Bedre ville være:** Udvikleren vælger: (a) tabellen og bilaget viser beregningsperiodens rækker med satserne ved
  udløbet, så summen er grundlagets; eller (b) rækkerne beholder månedens satser, bilagets satslinjer får datoen
  («Satser ved beregningsperiodens udløb (31-05-2018): …»), og bilaget får linjen «Tillæg i tabellen er beregnet med de
  satser, der gjaldt i den enkelte måned».
- **Andre steder det kan gælde:** Reguleringsbilaget og KL/RLTN-satserne (12i) – uafprøvet.

**Tilbagemelding**
Dette er et bevidst designprincip og et nødvendigt onde. Angivelserne på lønindkomst-oversigten skal afspejle den nøjagtige løn, som fremgår af lønsedlerne.
Til gengæld skal selve beregningsgrundlaget for TAF ske på baggrund af selve lønbeløbene uden tillæg, og tillæg og pension skal da beregnes og tillægs med den værdi, de havde på beregningstidspunktet.
Dette kan udledes af disse linjer i erstatningsopgørelsen, som ikke er det mest optimale, men den bedst tænkelige, og et acceptabelt kompromis:
Løn i beregningsperioden 366.157,66 kr.
Feriegodtgørelse/-tillæg (15 %) + Fritvalg (9 %) + Store Bededag (0,45 %) 89.525,55 kr.
Arbejdsgivers pensionsbidrag (12 % af løn + tillæg) 54.681,98 kr.
Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg 3.056,58 kr.
I alt: 513.421,77 kr.

### BB-277 – En rød sats eller dato på kortet giver en linje uden navn og link, og Beregning siger «Ingen perioder angivet»

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-19--rødt-læses-som-tomt-af-den-flade-der-låner-værdien` og
  `#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** 2026-10-06. **GENNEMFØRT** 2026-10-06: kortets egne felter med en rød værdi får hver sin linje med feltets navn og link («Arbejdsgivers pensionsbidrag: Procent skal være mellem 0,00 og 100,00», `selectLoenindkomstKortFieldIssues`); en rød «Sidste dag i ansættelsesforholdet» giver ikke også «… er ikke indtastet»; og sammendraget viser de indtastede TAF-perioder, når beregningen er spærret, i stedet for «Ingen perioder angivet».
- **Sådan fremprovokeres det:** Grundsagen. Hver for sig:
  1. «Arbejdsgivers pensionsbidrag» `150`.
  2. «Evt. særlig fra-dato for regulering» `01-01-1990`.
  3. «Opsagt fra stillingen» til og «Sidste dag i ansættelsesforholdet» `01-01-2028`.
- **Det sker:** Feltet er rødt med grænsen i tooltippen. Boksen på Beregning har én linje uden feltnavn, uden kortets navn
  og uden link: «Procent skal være mellem 0,00 og 100,00» / «Dato skal være mellem 01-01-2005 og 31-12-2027».
  Downloadknappen siger «Opgørelse kan ikke hentes, når der er fejl ovenfor». Samtidig skriver Beregnings sammendrag
  «**TAF-periode: Ingen perioder angivet**» om en sag med TAF-perioden `01-01-2024 - 31-12-2024` (i 1 og 2). I 3 står
  desuden «Det angives, at skadelidte er opsagt, men sidste arbejdsdag er ikke indtastet» om en dato, der står på
  skærmen. En regelfejl som `5` i feriefeltet får derimod navn og link («Satser på skadedatoen: …» + «Lønindkomst»).
- **Det er uhensigtsmæssigt fordi:** Kortet har fem procentfelter og tre datoer, og med flere kort mange flere. Brugeren
  får at vide, at en procent er forkert, ikke hvilken – og at der ingen TAF-periode er, hvilket er usandt og sender ham
  til den forkerte fane.
- **Bedre ville være:** Linjen bærer kortets og feltets navn og linker til feltet («Ansættelsesforhold 1 (Firma A):
  Arbejdsgivers pensionsbidrag: Procent skal være mellem 0,00 og 100,00»), en rød «Sidste dag» giver kun den røde
  linje, og sammendraget skriver ikke «Ingen perioder angivet», når perioden findes, men beregningen er spærret.
- **Andre steder det kan gælde:** Enhver bounds-fejl, der kun når boksen gennem sikkerhedsnettet (BB-265's form):
  lønudviklingens og anciennitetens datoer og beløb (12i), indtægtstabellens celler (12h). Sammendragets
  «Ingen perioder angivet» hører i 12l.

**Tilbagemelding**
Enig

### BB-278 – Linjer om et ansættelsesforhold siger ikke hvilket, og ens linjer for to kort bliver til én

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning` (BB-231's
  form)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** 2026-10-06 med forbehold: kun ved flere ansættelsesforhold, og kun hvis linjerne ikke bliver for lange eller rodede. **GENNEMFØRT** 2026-10-06 i en kortere form: kortet navngives i linkets navn – «Lønindkomst -> Ansættelsesforhold 2» – i stedet for foran beskeden, fordi et præfiks med kortets fulde overskrift gjorde de lange satslinjer to-tre linjer høje. Ved ét kort hedder linket «Lønindkomst» (også sygeferiegodtgørelsens linjer, som før hed «Ansættelsesforhold»). To kort med samme mangel giver nu to linjer.
- **Sådan fremprovokeres det:** To ansættelsesforhold, begge uden navn; det andet uden lønudvikling og
  sygeferiegodtgørelse. Gå til Beregning og klik linkene.
- **Det sker:** Boksen: «Lønudvikling er ikke angivet · Lønindkomst -> Lønindkomst», «Beregningsgrundlag for
  sygeferiegodtgørelse er ikke valgt · Lønindkomst -> Ansættelsesforhold» og ÉN «'Navn på arbejdssted' er ikke angivet ·
  Lønindkomst -> Lønindkomst». Linkene virker (målt blink på det rigtige korts felt), men navnelinjen blinker kun kort 1;
  at kort 2 også mangler navn, står ingen steder, før kort 1 er rettet. Ingen linje siger «Ansættelsesforhold 2».
  Linkenes navn veksler mellem «Lønindkomst» og «Ansættelsesforhold» for samme kort.
- **Det er uhensigtsmæssigt fordi:** Med flere kort skal brugeren klikke for at finde ud af, hvilket kort en linje gælder,
  og han retter én mangel og får samme linje igen.
- **Bedre ville være:** Linjer, der gælder et kort, begynder med kortets overskrift («Ansættelsesforhold 2: Lønudvikling er
  ikke angivet»), så to kort aldrig giver ens tekst, og linket hedder kortets overskrift.
- **Andre steder det kan gælde:** Lønrækkernes og sygeferiegodtgørelsens `messageOnly`-linjer (12h, 12j) – BB-231's
  navngivne kandidater.

**Tilbagemelding**
Hvis der kun er ét ansættelsesforhold, bliver det for omstændigt og bøvlet at angive navn på det. Da ved brugeren godt, hvilket der er tale om.
Ved flere ansættelsesforhold er jeg principielt tilbøjgelig til at være enig, men det er væsentligt, at du grundigt undersøger om de pågældende bliver for lange eller det bliver visuelt rodet at se på, hvis de nærmest fylder hele skærmen ud. Jeg vil kun acceptere rettelsen, hvis de ikke gør.

### BB-279 – Et unavngivet ansættelsesforhold hedder «Arbejdssted» i opgørelsen og «Ansættelsesforhold 2» i bilaget

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (skærm og dokument om samme
  oplysning)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** 2026-10-06. **GENNEMFØRT** 2026-10-06: ét navn overalt, skærmens «Ansættelsesforhold N» (positionen i hele listen), via `resolveAnsaettelsesforholdNavn`; reserverne «Arbejdssted», «Arbejdssted N» og «Lønindkomst» er væk, og bilaget nummererer ikke længere efter de viste kort.
- **Sådan fremprovokeres det:** To ansættelsesforhold uden navn, begge med løn i beregningsperioden (det andet én række
  januar 2018 à `10.000 kr.`). Navnelinjen er gul og spærrer ikke. Hent opgørelsen med bilaget «Lønindkomst».
- **Det sker:** Beregningsgrundlaget har to afsnit, der begge hedder «**Arbejdssted**», og «Forventet indkomst» skriver
  «Beregnes som lønnen opgjort således: Arbejdssted ved beregningsperiodens udløb (31-05-2018) og Arbejdssted ved
  beregningsperiodens udløb (31-05-2018).» efterfulgt af to afsnit «Arbejdssted». Bilaget kalder de samme to
  «Ansættelsesforhold 1» og «Ansættelsesforhold 2», som skærmen gør. Fire moduler har hver sin reserve: «Arbejdssted»
  (`indkomstSkadestidspunktBeregning.ts:199`, `loenudviklingBeregning.ts:342`, `sfggAnsaettelsesforhold.ts:78`,
  `tafNettoBeregning.ts:84`) og «Ansættelsesforhold N» (`loenindkomstSection.ts:180`, `reguleringSection.ts:489`).
- **Det er uhensigtsmæssigt fordi:** Modparten kan ikke se, hvilket beløb der hører til hvilket ansættelsesforhold, og
  ordet «Arbejdssted» ligner et egennavn.
- **Bedre ville være:** Ét navn overalt: skærmens «Ansættelsesforhold 2», når navnet mangler.
- **Andre steder det kan gælde:** Sygeferiegodtgørelsens afsnit (12j) og reguleringsbilaget (12i) bruger hver sin reserve.

**Tilbagemelding**
Enig

### BB-280 – SH-dage-bilaget dokumenterer ikke de SH-dage, opgørelsen trækker fra beregningsperioden

- **Type:** Fejl
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** 2026-10-06. **GENNEMFØRT** 2026-10-06: afsnittet «Beregningsperiode» kommer med, når beregningsgrundlaget trækker SH-dage fra (arbejdsdage, ikke komprimeret).
- **Sådan fremprovokeres det:** Grundsagen med «Feriegodtgørelse/-tillæg» `12,5`. Slå «Fuld løn under ferie» fra (sagen
  opgøres nu i arbejdsdage). Vælg bilaget «SH-dage» og hent opgørelsen.
- **Det sker:** Beregningsgrundlaget: «I perioden var der 261 hverdage - **10 SH-dage** = 251 arbejdsdage». Bilaget
  «SH-dage» lister kun «TAF-periode 1. januar 2024 - 31. december 2024» med «SH-dage i alt 8». Beregningsperiodens ti
  SH-dage står ingen steder. Afsnittet «Beregningsperiode» renderes kun, når sygeferiegodtgørelsen også regnes i
  arbejdsdage (`shDageSection.ts:132`), ikke når selve grundlaget gør.
- **Det er uhensigtsmæssigt fordi:** Bilaget findes for at dokumentere SH-fradraget, og det fradrag, der står med tal i
  opgørelsen, er netop det, bilaget udelader – mens TAF-periodens otte, som opgørelsen ikke nævner, er med.
- **Bedre ville være:** Afsnittet «Beregningsperiode» kommer med, når beregningsgrundlaget opgøres i arbejdsdage.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig

### BB-281 – Skift til «Almindelig løn» viser Store Bededag-knappen slået fra og advarer straks

- **Type:** Fornuft
- **Rækkevidde:** Lokal (BB-267's søskende)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** 2026-10-06. **GENNEMFØRT** 2026-10-06: et nyt kort får altid knappen slået til – også når det oprettes med SH-udbetaling, hvor knappen er skjult og værdien ikke læses – så «Almindelig løn» viser den slået til. Brugerens eget fravalg bevares ved skift frem og tilbage (`indskudte-loentillaeg-contract.md` §2a pkt. 2–3). Kort oprettet før rettelsen er uændrede.
- **Sådan fremprovokeres det:** Indstillinger → Standardværdier → «Løn på helligdage» `SH-udbetaling`. Grundsagen; vælg
  derefter «Almindelig løn» på kortet.
- **Det sker:** «Beregn Store Bededagstillæg fra 1. januar 2024» dukker op slået FRA, og boksen skriver straks «Der vil
  sædvanligvis være krav på Store Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.» Et kort, der
  oprettes med «Almindelig løn», får knappen slået TIL (`resolveDefaultStoreBededagstillaeg`). Samme tilstand giver to
  udfald efter, hvilken vej brugeren kom.
- **Det er uhensigtsmæssigt fordi:** Brugeren advares om et valg, programmet traf – den passive `false` fra oprettelsen –
  og ikke om et, han traf. Det er BB-267's form, nu på kortet.
- **Bedre ville være:** Første gang «Almindelig løn» vælges på et kort, hvis knap aldrig har været vist, får knappen
  samme standard som et nyt kort (til). Har brugeren selv slået den fra, bevares fravalget (`indskudte-loentillaeg-contract.md`
  §2a pkt. 3).
- **Andre steder det kan gælde:** Ingen; den angivne løn sætter allerede knappen ved valget (`angivetLoenBeregningsgrundlagCommit.ts`).

**Tilbagemelding**
Enig

### BB-282 – «Evt. særlig fra-dato for regulering» tager imod en dato efter opgørelsen

- **Type:** Edge case
- **Rækkevidde:** Lokal (B0)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** 2026-10-06. **GENNEMFØRT** 2026-10-06: loft ved dags dato med BB-208's ordlyd (`systemrammeTilDagsDatoSpec`, delt med de angivne beløbs dato), også for tvillingen under angivet løn.
- **Sådan fremprovokeres det:** Grundsagen med Bygge-/anlægsoverenskomsten. «Evt. særlig fra-dato for regulering»
  `31-12-2026` (dags dato er 06-10-2026, «Opgørelse lavet den» 01-02-2025).
- **Det sker:** Tages imod uden ring. Overskriften bliver «Satser på den manuelt angivne reguleringsdato (31-12-2026)»
  med SH/SO `9,80 %`, pension `11,15 %` og Store Bededagstillæg `0,45 %`, og papiret skriver «Opgøres på baggrund af
  lønnen på den manuelt angivne reguleringsdato» for en TAF-periode i 2024. Grænsen er systemrammen «Dato skal være
  mellem 01-01-2005 og 31-12-2027».
- **Det er uhensigtsmæssigt fordi:** En reguleringsdato er den dato, lønnen afspejler; en dato efter opgørelsen er en
  tastefejl i årstallet. Tvillingen under angivet løn («Det angivne beløb afspejler månedslønnen per dato») fik dags dato
  som loft ved BB-261.
- **Bedre ville være:** Dags dato som loft med BB-208's ordlyd: «Dato skal være mellem 01-01-2005 og dags dato
  (06-10-2026)».
- **Andre steder det kan gælde:** Den tilsvarende særlige dato under angivet løn (`eoAngivetLoenFields.saerligFraDatoRegulering`,
  12i) – uafprøvet.

**Tilbagemelding**
Enig

### BB-283 – «Sidste dag i ansættelsesforholdet» kan ligge før skadedatoen, og feltet hedder noget andet i boks og papir

- **Type:** Edge case
- **Rækkevidde:** Lokal (B0) og `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** **(a) GODKENDT** 2026-10-06 med udviklerens præcisering: et ansættelsesforhold kan sagtens slutte før skaden, men er skadelidte angivet som ansat på skadedatoen, er en sidste dag før skadedatoen en fejl. **(b)** «Sidste dag i ansættelsesforholdet» og «sidste arbejdsdag» er samme dato; efter modsvar bruges feltets betegnelse overalt. **GENNEMFØRT** 2026-10-06: rød ring og blokering «Sidste dag i ansættelsesforholdet skal ligge på eller efter skadedatoen (01-06-2018), når skadelidte var ansat på skadestidspunktet»; boksen og papiret siger «sidste dag i ansættelsesforholdet».
- **Sådan fremprovokeres det:** «Ansat på skadedatoen» til (standard), «Opsagt fra stillingen» til, «Sidste dag i
  ansættelsesforholdet» `31-05-2018` (dagen før skaden). Hent opgørelsen. Prøv også `01-01-2017`.
- **Det sker:** `31-05-2018` tages imod uden ring og uden advarsel. Med `01-01-2017` kommer kun «Der er angivet løn efter
  sidste arbejdsdag (01-01-2017). Kontrollér om dette er korrekt.», fordi lønrækkerne fortsætter. Papiret skriver
  «Skadelidte er opsagt fra stillingen med sidste arbejdsdag 1. januar 2017.» Feltet har kun systemrammen. Feltet hedder
  «Sidste dag i ansættelsesforholdet», men boksen og papiret siger «sidste arbejdsdag».
- **Det er uhensigtsmæssigt fordi:** Skadelidte kan ikke både være ansat på skadedatoen og have haft sidste dag før den;
  én af de to oplysninger er forkert, og programmet ved det. Om «sidste dag i ansættelsesforholdet» og «sidste
  arbejdsdag» er to forskellige ting (fx ved fritstilling), er et fagligt spørgsmål.
- **Bedre ville være:** (a) Rød ring «Sidste dag i ansættelsesforholdet skal ligge på eller efter skadedatoen
  (01-06-2018), når skadelidte var ansat på skadedatoen» (eller gul, hvis udvikleren foretrækker det). (b) Udvikleren
  afgør, hvilket af de to udtryk der er det rigtige, og det bruges i feltet, boksen og papiret.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
'Sidste dag i ansættelsesforholdet' og 'Sidste arbejdsdag' er nøjagtig samme dato, blot emd to forskellige betegnelser. 
Der kan dog sagtens opstå situationer, hvor skadelidte er opsagt og har haft sidste dag i ansættelsesforholdet før skadesdatoen. Har skadelidte fx. fra 12 til 6 måneder før skaden haft ét arbejde, og i perioden 6 måneder før skaden og fremefter haft et andet, vil det være helt almindeligt og forventeligt, at beregningsperioden udgør 12 måneder før skaden, og dermed indkluderer begge ansættelsesforhold, hvoraf det ene er opsagt før skaden.
Men enig i, at hvis det angives, at skadelidte både havde sidste arbejdsdag før skadesdatoen, og det angives, at skadelidte var ansat på skadestidspunktet, så er det en fejl, og den skal vises med rød ring og være blokerende for download.

### BB-284 – Satslinjen i boksen hedder «Satser på skadedatoen» og siger «Forkert værdi» om en regel, feltet forklarer

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** 2026-10-06. **GENNEMFØRT** 2026-10-06: linjen bruger skærmens overskrift og feltets egen tekst («Satser ved beregningsperiodens udløb (31-05-2018): Ved løn under ferie opgøres …»).
- **Sådan fremprovokeres det:** Grundsagen. «Feriegodtgørelse/-tillæg» `5`; derefter tomt med lønudvikling «Manuelt angivet».
- **Det sker:** Skærmen: overskriften «Satser ved beregningsperiodens udløb (31-05-2018)» og tooltippen «Ved løn under
  ferie opgøres ferietillægget beregningsteknisk som feriegodtgørelse (12,5 %, eller 15 % ved ret til 6. ferieuge)» /
  «Feriegodtgørelse/-tillæg skal udfyldes». Boksen: «**Satser på skadedatoen**: Forkert værdi indtastet i
  Feriegodtgørelse/-tillæg» / «Satser på skadedatoen: Feriegodtgørelse/-tillæg er ikke udfyldt». Prefikset er fast
  (`eoRowIndkomstRows.ts:213`), og beskeden omskrives (`resolveSatserErrorField`).
- **Det er uhensigtsmæssigt fordi:** Boksen henviser til en overskrift, der ikke står på skærmen, og siger, at værdien er
  forkert, uden at sige hvad der forventes – det står kun i tooltippen. En regeltekst skal stå ordret begge steder.
- **Bedre ville være:** Boksens linje bruger skærmens overskrift og feltets egen tekst: «Satser ved beregningsperiodens
  udløb (31-05-2018): Ved løn under ferie opgøres ferietillægget …».
- **Andre steder det kan gælde:** Papirets «S/H (3,4 %)» i beregningsgrundlaget mod feltets «SH/SO-sats» (BB-276's pdf).

**Tilbagemelding**
Enig

### BB-285 – «Fuld løn under ferie» står åben ved angivet måneds- og dagsløn, men ændrer intet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-35--et-synligt-felt-som-den-aktuelle-beregningsmåde-ikke-læser`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** 2026-10-06 på betingelse af, at feltet beviseligt ingen betydning har. **Verificeret**: ved angivet løn læses feltet kun af enhedsudledningen (som da returnerer tidligt), ferieadvarslen (kun ved beregningsperiode) og valget af vejledningstekst ved en for lav feriesats – intet tal, ingen spærring, intet dokument. **GENNEMFØRT** 2026-10-06: feltet skjules ved angivet løn (descriptor-relevans `erFuldLoenUnderFerieRelevant`); værdien bevares.
- **Sådan fremprovokeres det:** «Angivet månedsløn» `30.000 kr.`; et kort med to lønrækker i 2024. Hent opgørelsen med
  «Fuld løn under ferie» til og fra.
- **Det sker:** De to pdf'er er tegn for tegn ens (målt). M-35's trin 4 er gået: feltet læses kun af enhedsudledningen
  og ferieadvarslen, begge kun ved «Beregningsperiode» (`tafBeregningsenhed.ts:132-145`,
  `eoRowTafBeregningsgrundlagRows.ts:211-214`), og ellers kun af feriefeltets tooltiptekst.
- **Det er uhensigtsmæssigt fordi:** Brugeren besvarer et spørgsmål, programmet ikke bruger, og kan tro, at svaret
  påvirker kravet.
- **Bedre ville være:** Som BB-263: ved angivet løn skjules «Fuld løn under ferie» uden forklarende linje (relevans, så
  værdien bevares og kommer tilbage).
- **Andre steder det kan gælde:** Ingen; «Løn på helligdage» og Store Bededag-knappen læses af satserne for indtægten i
  erstatningsperioden.

**Tilbagemelding**
Hvis du kan grundigt undersøge og verificere, at den ingen betydning har nogen steder i det tilfælde, så enig.

### BB-286 – Feriesatsen accepterer 12 %, mens teksten siger 12,5 %, og 25 % og 100 % uden bemærkning

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Lav
- **Beslutning:** **AFVIST** præmissen om 12 % (lovligt, om end sjældent). **GODKENDT** gul, ikke-blokerende ring over 20 %. **GENNEMFØRT** 2026-10-06: «Feriegodtgørelse/-tillæg over 20 % er usædvanligt – kontrollér satsen» som gul ring og linje.
- **Sådan fremprovokeres det:** «Feriegodtgørelse/-tillæg» `12`, `25`, `100`.
- **Det sker:** Alle tre tages imod uden ring. Grænsen er `< 12` (`loenindkomstSatsAssessment.ts:100`), mens den røde
  tekst under 12 nævner 12,5 % og 15 %. 100 % fordobler lønnen i hver række.
- **Det er uhensigtsmæssigt fordi:** `12` er næsten altid `12,5` med et tabt ciffer, og satser over ca. 17 % (kommunalt
  forhøjet ferietillæg, regel 3) er næsten altid tastefejl.
- **Bedre ville være:** Gul ring med teksten fra kontrakten, når satsen ligger mellem 12 og 12,5 % eller over fx 20 %.
  Grænserne er udviklerens.
- **Andre steder det kan gælde:** Den manuelle lønudviklings feriesats (12i).

**Tilbagemelding**
Nej, din præmis er forkert. I visse særlige tilfælde vil der kunne være tale om en feriegodtgørelse på 12 %. Det er dog yderst sjældent, så feriegodtgørelse vil stort set altid være 12,5 % eller 15 %, eller nogen gange 16,95 % eller en anden procentsats større end 12,5 %. Men muligheden for at indtaste 12 % skal være til stede. Til gengæld er jeg enig i, at en sats for feriegodtgodtgørelse på over 20 % skal udløse en ikke-blokerende gul ring. 

### BB-287 – Låste satsfelter og overenskomstfiltrene forklarer ikke sig selv

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** 2026-10-06. **GENNEMFØRT** 2026-10-06: låste satser oplæses med eget navn og har tooltippen «Fastsat af overenskomsten på 31-05-2018» (eller «… har ingen satser før …»); «L:»/«A:» har tooltippen «Lønmodtagerorganisation»/«Arbejdsgiverorganisation» på kortet, under angivet løn og i Indstillinger.
- **Sådan fremprovokeres det:** Vælg en overenskomst; hold musen over «SH/SO-sats» og over filtrene ved «Vælg
  overenskomst»; læs de tilgængelige navne.
- **Det sker:** Fritvalg, SH/SO og pension bliver grå og låste uden tooltip, og alle fire låste felter (med Store
  Bededagstillæg) oplæses som «**Beregnet procent**» (`DerivedPercentField`, `PercentField.tsx:104`). Filtrene står som
  «L:» og «A:» i 11 px uden tooltip (oplæst «Lønmodtagerfilter»/«Arbejdsgiverfilter»); samme forkortelse står i
  Indstillinger under «Overenskomstparter».
- **Det er uhensigtsmæssigt fordi:** Brugeren ser et felt, han ikke kan skrive i, uden at vide hvorfor, og skal gætte,
  hvad «L» og «A» står for.
- **Bedre ville være:** Låste satser får tooltippen «Fastsat af overenskomsten på 31-05-2018» og deres eget navn som
  tilgængeligt navn; filtrene får tooltippen «Lønmodtagerorganisation»/«Arbejdsgiverorganisation».
- **Andre steder det kan gælde:** Indstillingers «Overenskomstparter»; angivet løns overenskomstfiltre (12i).

**Tilbagemelding**
Enig

### BB-288 – «Tilføj» kræver en bekræftelse, og det nye kort rulles ikke frem

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** 2026-10-06. **GENNEMFØRT** 2026-10-06: «Tilføj» sker uden dialog (Ctrl+Z fortryder), og det nye kort rulles frem.
- **Sådan fremprovokeres det:** Med ét udfyldt kort: klik den blå knap nederst på kortet og «Ja, tilføj».
- **Det sker:** Dialogen «Dette vil tilføje et nyt ansættelsesforhold nederst på siden. Bekræft venligst.» står foran en
  handling, Ctrl+Z fortryder (målt). Efter bekræftelsen bliver siden stående: det nye korts top lå ved 822 af 864 px,
  så det eneste synlige tegn er, at den blå knap forsvinder fra det kort, man stod ved.
- **Det er uhensigtsmæssigt fordi:** Bekræftelsen beskytter ikke mod noget, og brugeren skal selv rulle ned for at se,
  at handlingen lykkedes.
- **Bedre ville være:** Tilføj sker uden dialog, og det nye kort rulles frem (som «Flyt op/ned» allerede gør med
  `scrollTargetIntoView`). Ønsker udvikleren at beholde dialogen, så alene rul frem.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig

## Overvejet uden fund

- **Dialogernes fortrydelse:** Escape og «Annuller» gør intet; Ctrl+Z fortryder Tilføj, Slet (kortet kommer igen med alt)
  og Flyt, Ctrl+Y gentager. Slet-dialogen navngiver kortet, når det har navn («… ansættelsesforholdet (Firma A)»).
- **Grænsen på 10 kort** er kun læst i koden: knappen bliver grå med «Maksimalt 10 ansættelsesforhold».
- **Overenskomstfiltrene** indsnævrer listen (28 → 4), og et valgt id bliver stående, når det filtreres væk.
- **«Overenskomst» slået fra** skjuler valget og bevarer det; satserne bliver de åbne felter. Modstriden «valgt, men slået
  fra» meldes ved reguleringsformen «Overenskomst» (12i).
- **Enhedsskiftet fra Lønindkomst:** «Fuld løn under ferie» fra flytter sagen til arbejdsdage (krav 405.000,00 →
  409.841,70 kr.), og ferie i beregningsperioden dukker op på EO oplysninger. Boksen siger «Ingen ferie i
  beregningsperiode på > 6 måneder forekommer tvivlsomt» med link, så brugeren føres videre. Den modsatte vej skjuler
  felterne uden linje – BB-247's afgørelse («bare skjul dem»).
- **Feriesatsen ved fuld løn:** 1 % er rød med vejledningen om omregning til 12,5 %. Årsløn advarer det modsatte (≥ 12 %
  med fuld løn er «højst usandsynligt»), men de to flader opgør hver sin størrelse, og kontraktens regel 3 siger «til
  tider» – M-31's fjerde spørgsmål giver nej.
- **Tillæg som beløb:** satsafsnittet skjules, en skjult rød feriesats spærrer ikke (M-32 bestået), og værdien kommer
  tilbage ved «Procent».
- **Skjult rød særlig fra-dato:** forsvinder af boksen, når «Angivet månedsløn» vælges (M-32 bestået).
- **«Løn indtastes som»** er ikke prøvet igen: BB-105 er afvist for samme radiogruppe.
- **«Navn på arbejdssted»** blokerer ved 60 tegn; feltet viser 38, men overskriften viser hele navnet (M-04 bestået).
  Navnet er en gul advarsel ved «Beregningsperiode» og spærrer ikke.
- **«Ansat på skadedatoen» fra** skjuler opsigelsen og sygeferiegodtgørelsen; de skjulte værdier neutraliseres.
- **Satsoverskriften** følger referencen (skadedatoen, beregningsperiodens udløb, den manuelle dato), og
  informationsikonet siger, hvilken dato der bruges. Store Bededagstillæg `0,00 %` ved en 2018-dato forklares af den.
- **Kolonerne i etiketterne** («Fuld løn under ferie:» mod «Tillæg angives som») er mikroæstetik og registreres ikke.
- **SH-dage-bilaget** er gråt i måneder med «TAF beregnes som måneder, og SH-dage er derfor ikke relevante».
- **M-09 bestået:** ved 1244×620 er `scrollWidth = clientWidth = 1244` (zoom 0,79). **M-10 bestået:** rul-op-knappen står
  lige uden for datofeltets højre kant, og kortenes runde knapper overlapper intet felt.
- **Kortets runde knapper og tastaturet:** Enter på en programmatisk fokuseret «Slet»/«Flyt»/«Tilføj» flytter fokus til
  næste felt i stedet for at aktivere knappen, og fokus havner i sidemenuen eller på `body` efter handlingen. Knapperne
  er bevidst mus-betjente og uden for Containerens inventar (`keyboard-navigation.md` §Knapper er OPT-IN; M-08), så det
  registreres ikke.
- **Konsollen** var tavs i alle forløb: 0 fejl, 0 advarsler.

## Henvisninger til andre bidder

- **12h:** løntabellens tillægskolonner (BB-276), lønrækkernes `messageOnly`-linjer (BB-278), bounds-fejl i cellerne
  (BB-277).
- **12i:** reguleringsformens forhold til feriesatsen (BB-274), KRL/KL uden dækning (BB-275), den særlige dato under
  angivet løn (BB-282), reguleringsbilagets reservenavn (BB-279), den manuelle feriesats (BB-286).
- **12j:** sygeferiegodtgørelsens «Arbejdssted» (BB-279) og linkets navn «Ansættelsesforhold» (BB-278).
- **12l:** sammendragets «Ingen perioder angivet» (BB-277).
- **Årsløn:** M-37's kandidat – tom feriesats regnes som 0 uden advarsel.

## Dækningshuller

- Kun Chrome, lyst tema; kun pdf-kanalen er læst.
- Erhvervssygdom («anmeldelsesdatoen») og offentlige overenskomster (KL/RLTN, løntrin) er ikke afprøvet.
- Uge- og datolønperiode er ikke afprøvet (BB-105).
- Tastaturrækkefølgen gennem kortets felter er ikke gennemgået.
- `Gem`/`Hent` er ikke afprøvet (filvælgeren kan ikke betjenes headless).

## Åbne spørgsmål

Ingen. Besvaret 2026-10-06: en tom feriesats må ikke regnes stille – den blokerer (BB-274), og «sidste dag i
ansættelsesforholdet» og «sidste arbejdsdag» er samme dato (BB-283 b).
