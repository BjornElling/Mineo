# Brugerblik – Erstatningsopgørelse → Tabt arbejdsfortjeneste: perioden (12e)

- Rute/placering: `/erstatningsopgoerelse` → fanen «EO oplysninger», sektionen **Tabt arbejdsfortjeneste**
  (kravvalget, periodetabellen med «Løse feriedage» og den afledte kolonne, «Evt. ferie i perioden» og «Evt.
  allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode») – samt TAF-afsnittets
  periodeliste, ferielinje og «Tidligere betalt erstatning» i opgørelsen og TAF-linjerne i «Fejl og advarsler».
- Gennemgået: 2026-09-24 · commit `d5c51762`
- Afprøvet i: Chrome headless, lyst tema, 1536×864 (M-09 desuden 1244×620). Dokumenter hentet som `.pdf` og
  læst med `pdftotext -layout`. Sag: skadedato `01-06-2018`, «Vedrører perioden» `01-01-2024` – `31-12-2024`,
  «Opgørelse lavet den» `01-02-2025`, lønudvikling «Ingen». TAF ud fra **angivet månedsløn** `30.000 kr.`
  (opgøres i måneder) eller **angivet dagsløn** `1.500 kr.` (opgøres i arbejdsdage).

## Fladen kort

Sektionen har et kravvalg (Ja · Nej · Skjul), to tabeller og et beløbsfelt. Periodetabellen har «Fra o.m.»,
«Til o.m.», «Løse feriedage» og en afledt kolonne, der hedder **«TAF-måneder»** eller **«TAF-arbejdsdage»**
efter den beregningsenhed, programmet selv udleder (`computeTafBeregningsenhed`): «Angivet månedsløn» giver
måneder, «Angivet dagsløn» arbejdsdage, og «Beregningsperiode» giver måneder, medmindre et ansættelsesforhold
under Lønindkomst har andet end almindelig løn på helligdage og fuld løn under ferie. **En ny sag opgøres
derfor i måneder.** Ferietabellen har «Fra o.m.», «Til o.m.» og en afledt «Feriedage».

Perioderne klemmes tavst til «Vedrører perioden» og afskæres med rød celle af afgørelserne fra 12d. I
arbejdsdage fradrages SH-dage, ferie og løse feriedage; **i måneder fradrages ingen af dem**
(`tabt-arbejdsfortjeneste.md` §«Måneder vs. arbejdsdage»). Beløbet «allerede modtaget» trækkes fra kravet,
som klemmes til 0.

**Fladens gennemgående træk:** tabellerne har mange regler, og kun én af dem – afskæringen fra 12d – når
cellen. Overlap, for mange løse feriedage og en ferieperiode uden for sit vindue spærrer alle opgørelsen uden
en eneste rød celle (BB-248, BB-251, BB-252). Og de to afledte kolonner tæller hver sin størrelse uden at sige
hvilken: TAF-kolonnen det, der betales for; ferie-kolonnen hele rækken, også det, der ikke fradrages (BB-249,
BB-250). BB-217's og BB-218's rettelser i 12b nævnte begge netop disse to tabeller som kandidater, og begge
er bekræftet.

**Afgrænsning.** Afskæringsdatoernes oprindelse og beskeder hører i 12d. «Arbejdssituation» og Status-linjen
hører i 12a. Beregningsgrundlaget, «Beregnes ud fra» og ferie i beregningsperioden hører i 12f;
Lønindkomstens indflydelse på beregningsenheden i 12g. Offentlige ydelser og sygeferiegodtgørelse, som også
trækkes fra i TAF-afsnittet, hører i 12k og 12j.

## Fund

### BB-247 – I en sag, der opgøres i måneder, tager ferie og løse feriedage imod oplysninger, der intet gør

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-35--et-synligt-felt-som-den-aktuelle-beregningsmåde-ikke-læser`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT delvist** af udvikleren 2026-09-25 og **indsnævret efter modsvar** (se nedenfor):
  i måneder skjules kolonnen «Løse ferie-/feriefridage» uden en forklarende linje; «Evt. ferie i perioden» bliver
  stående. **GENNEMFØRT** 2026-09-25: descriptoren bærer relevansen `erTafLoseFeriedageRelevant` (sektionen aktiv
  OG TAF i arbejdsdage), så readeren giver en skjult værdi som tom for alle læsere, og værdien bevares og kommer
  tilbage, hvis enheden skifter. Fordi enheden i «Beregningsperiode»-grenen udledes af lønindkomstens rækker, har
  `CanonicalView` fået `listEntityIds`, og reducerens rydning af et skjult rødt felt (§7.5 pkt. 2) gælder nu
  enhver ændring, ikke kun et valg. Undervejs fandtes en eksisterende fejl af samme art: rettede man «Nummer»
  fra 2 til 1, mens «Svie/smerte-krav i tidligere erstatningsopgørelser» bar ugyldig tekst, kastede reduceren en
  undtagelse, og indtastningen kunne ikke gennemføres; den er rettet med samme rydning. Dækket af
  `relevanceCleanupOnTextSettle.test.ts`, `tafPerioderBrugerblik12e.test.ts` og
  `e2e/erstatningsopgoerelse-taf-perioder.spec.ts`.
  **Modsvar 2026-09-25:** under implementeringen viste det sig, at ferieperioderne IKKE er virkningsløse i
  måneder – sygeferiegodtgørelsen bruger dem i begge enheder. Udvikleren valgte derfor kun at skjule løse
  feriedage, som reelt er uvirksomme i måneder; ferietabellen vises altid, og ingen beregning er ændret.
- **Sådan fremprovokeres det:**
  1. Ny sag, TAF ud fra angivet månedsløn `30.000 kr.` TAF-periode `01-01-2024` – `30-06-2024`, «Løse
     feriedage» `5`.
  2. «Evt. ferie i perioden» `01-03-2024` – `15-03-2024`. Hent opgørelsen.
  3. Gentag med angivet dagsløn `1.500 kr.`
- **Det sker:** Med månedsløn står ferierækken med «Feriedage **11**», og «Løse feriedage» `5` tages imod
  uden markering. Den afledte kolonne skriver «TAF-måneder **6**» – samme tal som uden ferie og løse dage –
  og papiret skriver «6 måneder á 30.000,00 kr.», **Beregnet krav 180.000,00 kr.**, uden et ord om ferie. Med
  dagsløn fradrages begge: «TAF-arbejdsdage **108**» (130 hverdage – 6 SH – 11 ferie – 5 løse), og papiret
  skriver «I perioden blev der afholdt ferie i perioden 01-03-2024 - 15-03-2024 samt 5 løse
  ferie-/feriefridage.» og **162.000,00 kr.**
  Adfærden er dokumenteret og rigtig: i måneder er ferie og SH-dage lønnet og udgår ikke. Men sektionen er
  ordret den samme i begge enheder (`TabtArbejdsfortjenesteSection.tsx:51-65`). Det eneste, der skifter, er
  kolonneoverskriften «TAF-måneder»/«TAF-arbejdsdage» – og enheden udledes af programmet, i
  «Beregningsperiode»-grenen endda af to valg under Lønindkomst, som brugeren ikke ser herfra.
- **Det er uhensigtsmæssigt fordi:** En ny sag opgøres i måneder, så den, der udfylder ferien fra sine
  lønsedler, gør det som standard forgæves – og programmet tager imod, viser et feriedagstal og tier. Den
  omvendte vej er værre: skifter enheden fra arbejdsdage til måneder, fordi et valg under Lønindkomst
  ændres, holder den allerede tastede ferie op med at tælle, og beløbet stiger uden anden synlig ændring end
  ét ord i en kolonneoverskrift.
- **Bedre ville være:** Sektionen siger det, når ferien ikke bruges. To muligheder, som udvikleren kan vælge
  imellem:
  (a) I måneder skjules «Evt. ferie i perioden» og kolonnen «Løse feriedage», og der står i stedet én linje:
  «Tabt arbejdsfortjeneste opgøres i måneder. Ferie og løse feriedage fradrages derfor ikke.» Skjult er
  ikke udfyldt (M-32), så indtastede værdier bevares, men læses ikke, og kommer tilbage, hvis enheden skifter.
  (b) Felterne bliver stående, men tabellen får samme linje over sig, og en udfyldt ferierække eller et
  udfyldt «Løse feriedage» får en gul ring: «Bruges ikke – tabt arbejdsfortjeneste opgøres i måneder.»
  (a) er det enkleste at forstå; (b) bevarer overblikket for den, der skifter enhed undervejs.
- **Andre steder det kan gælde:** Ferie i beregningsperioden og «Uspecificerede ferie-/fridage» (12f) er efter
  samme domæneregel virkningsløse i måneder og vises ubetinget; `validateBeregningsperiodeLoseFeriedage`
  validerer dem endda. Uverificeret.

**Tilbagemelding**
Delvist enig. Teknisk set er det ikke selve den omstændighed, at tabt arbejdsfortjeneste opgøres i måneder, som er årsagen til, at ferie ikke indregnes - det er den bagvedliggende forudsætning, TAF kun beregnes i måneder, hvis der i alle ansættelsesforhold er ret til løn under ferie.

Når felterne er uvirksomme, er jeg enig i, at de bør skjules. Der behøver ikke bliver skrevet en meddelelse til brugeren om dette - bare skjul dem.

### BB-248 – En ferieperiode uden for sit tilladte vindue spærrer opgørelsen uden rød celle og med en intern besked

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
  (spejlvendt form) og `#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-25 i form (a) efter modsvar: alle tre vinduer spærrer
  fortsat, men cellen bliver rød, og beskeden er i fladens sprog. **GENNEMFØRT** 2026-09-25: vinduet er flyttet
  fra rækkeevalueringen til `tafRowCellIssues.ts`, som projekterer det til begge datoceller – «Ferien ligger før
  skadedatoen (01-06-2018)», «Ferien ligger efter dags dato (24-09-2026)» og «Ferien ligger efter den dato,
  differencekravet er opgjort pr. (01-07-2024)» (tilsvarende for endeligt og midlertidigt EET) – og blokerer
  TAF-grenen som enhver rød feltfejl. «Fejl og advarsler» viser én linje pr. række med rækkens navn, fx
  «Ferieperioden 01-07-2017 - 14-07-2017: Ferien ligger før skadedatoen (01-06-2018)».
  **Modsvar 2026-09-25:** jeg pressede på, at nr. 2 (sommerferien efter afskæringen) typisk er rigtige data, og
  at netop spærringen er det, der gør en tidligere indtastet ferie blokerende, når en afskæring senere tastes.
  Udvikleren fastholdt, at alle tre skal spærre med rød ring.
- **Sådan fremprovokeres det:** Dagsløn, TAF `01-01-2024` – `31-12-2024` (eller til `30-06-2024`). Tast én af
  disse ferierækker og gå til Beregning:
  1. `01-07-2017` – `14-07-2017` (før skadedatoen `01-06-2018`).
  2. `01-07-2024` – `12-07-2024` med «Evt. differencekrav opgjort per» `01-07-2024` og TAF til `30-06-2024`.
  3. `01-12-2026` – `10-12-2026` (efter dags dato).
- **Det sker:** I alle tre er begge ferieceller neutrale (målt `aria-invalid = "false"`, ingen tooltip), og
  download er spærret. Boksen skriver hhv.:
  1. «**Ingen gyldige datoer: min-dato (01-06-2018) er efter max-dato (14-07-2017). Værdien afgrænses af:
     Skadedato, til-dato i samme række; Dato skal være mellem 01-06-2018 og 24-09-2026**»
  2. «Ingen gyldige datoer: min-dato (01-07-2024) er efter max-dato (30-06-2024). Værdien afgrænses af:
     fra-dato i samme række, dags dato, differencekrav-dato»
  3. «Ingen gyldige datoer: min-dato (01-12-2026) er efter max-dato (24-09-2026). Værdien afgrænses af:
     fra-dato i samme række, dags dato»
  Linket blinker ferierækkens fra-celle (målt), som ikke bliver rød.
  **Ingen af de tre ferieperioder påvirker beregningen:** ferie fradrages kun i fællesmængden med
  TAF-perioderne (`buildTafFerieFravaerSummary`, `buildTafArbejdsdageSetFromRows`), og ingen af dem overlapper
  TAF. Grænsen kommer fra `evaluateFerieperioder` (`ferieperiodeValidation.ts:58-67`), som låner
  TAF-periodernes vindue: skadedato som gulv, dags dato og afskæringerne som loft. **Descriptoren siger det
  modsatte:** ferieperioderne er erklæret med systemrammen, «(optjeningsår kan ligge før skaden)»
  (`erstatningsopgoerelseDescriptors.ts:837-842`). Cellen følger descriptoren og er neutral; blokeringen følger
  valideringen.
- **Det er uhensigtsmæssigt fordi:** En ferie, der ligger uden for TAF-perioden, er i værste fald overflødig.
  Her standser den hele opgørelsen, uden at cellen siger hvilken, med en tekst der taler om «min-dato» og
  «max-dato» og en «til-dato i samme række», som brugeren ikke har gjort noget forkert med. Nr. 2 er den
  skarpeste: en sommerferie lige efter TAF-periodens afskæring – en ganske almindelig indtastning fra en
  lønseddel – blokerer, fordi ferien ligger efter en dato, der kun afgrænser TAF.
- **Bedre ville være:** (b) Ferieperioden behøver kun sin egen dato-orden og systemrammen, som descriptoren
  allerede siger; den del, der ligger uden for TAF-perioderne, ignoreres som i dag og vises som 0 (BB-249).
  Vil udvikleren beholde en spærring, så (a): rød celle med en besked i fladens sprog, fx «Ferien ligger før
  skadedatoen (01-06-2018)» / «Ferien ligger efter tabt arbejdsfortjeneste er afskåret (30-06-2024)» / «Ferien
  ligger efter dags dato (24-09-2026)».
- **Andre steder det kan gælde:** `buildNoValidDateRangeMessage` («Ingen gyldige datoer: min-dato …») bruges også af
  TAF- og svie/smerte-rækkerne. Ferieperiodernes til-årsag udelader den midlertidige EET-afskæring, selv om
  grænsen indeholder den (erklæret bevidst i `ferieperiodeValidation.ts:25`). Ferie i beregningsperioden (12f)
  har sin egen validering – uafprøvet.

**Tilbagemelding**
Enig, men med et lille forbehold. Det er uhensigtsmæssigt, at der kan bibeholdes ugyldige datoer i programmet, blot fordi de ikke påvirker beregningen lige nu og her. Hvis beregnings- eller erstatningsperioden senere ændres, vil der da pludselig blive introduceret en blokerende fejl fra nogle værdier, som brugeren har indtastet på et tidligere tidspunkt. Så jeg ville gerne, hvis der kunne gøres opmærksom på fejlen, så brugeren har et incitament til at rette den, uanset at den ikke påvirker den nuværende beregning.

### BB-249 – «Feriedage» tæller hele ferierækken, også de dage, der ikke fradrages

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
  (BB-217's form)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-25 som én samlet løsning for alle afledte kolonner (efter
  modsvar, se BB-250): kolonnen viser det tal, der regnes med, og overskriften siger rammen. **GENNEMFØRT**
  2026-09-25: «Feriedage (i TAF-perioden)» tæller ferierækkens feriedage inden for TAF-perioderne
  (`countFeriedageInRanges`, samme optælling som dokumentets ferielinje) – målt 10 og 0 i fundets sag.
  Beregningsgrundlagets ferietabel (12f) følger samme form: «Feriedage (i beregningsperioden)». Findes rammen
  endnu ikke (ingen gyldig TAF-række / ingen beregningsperiode), tælles rækken for sig, som svie/smerte-tabellen
  gør uden en EO-periode.
- **Sådan fremprovokeres det:** Dagsløn. TAF `01-01-2024` – `30-06-2024`. Ferie `17-06-2024` – `12-07-2024` og
  `01-10-2024` – `11-10-2024`. Hent opgørelsen.
- **Det sker:** Ferietabellen skriver **20** og **9**. Kun 10 dage fradrages: TAF-kolonnen går fra 124 til
  **114**, og papiret skriver «I perioden blev der afholdt ferie i perioden **17-06-2024 - 30-06-2024**.» – den
  anden række er ikke med nogen steder og står i tabellen med 9, umarkeret. Kolonnen er hverdage minus SH-dage
  for hele rækken (`useEoOplysningerViewModel.ts:70`, `calculateFerieHverdageMinusSHDage(row.fra, row.til)`),
  mens beregningen tager fællesmængden med TAF-perioderne.
- **Det er uhensigtsmæssigt fordi:** Det er samme oplevelse, BB-217 rettede: tallet ved siden af rækken er det
  eneste, brugeren kontrollerer sit arbejde mod, og det er ikke det tal, kravet regnes af. Skærmen siger 29,
  papiret nævner 10 dages ferie på andre datoer end dem, der blev tastet.
- **Bedre ville være:** Kolonnen viser de feriedage, der fradrages – rækkens fællesmængde med TAF-perioderne –
  og overskriften bærer årsagen: «Feriedage (i TAF-perioden)». En række helt uden for viser `0`. I måneder
  bortfalder kolonnen med BB-247.
- **Andre steder det kan gælde:** `fravaerFeriedageById` (`useEoOplysningerViewModel.ts:71`) er samme beregning
  for ferie i beregningsperioden (12f).

**Tilbagemelding**
Begge løsninger er som sådan problematiske. Brugeren indtaster en ferieperiode, og enten viser programmet hvor mange dage, der er i den periode, hvilket umiddelbart vil være, hvad brugeren forventer, men uden garanti for, at det faktisk afspejler det antal feriedage, som faktisk fratrækkes i beregningen. Ellers vises det antal feriedage, som faktisk fratrækkes, men så vil brugeren kunne opleve, at antallet af viste feriedage ikke tæller med det antal dage, der er i intervallet.

Jeg vil gerne have, at de steder, hvor problemstillingen er aktuel, får én samlet, logisk løsning, måske ved at teksten ændres til "Feriedage i TAF-perioden" eller noget i det stil. Se gerne hvad vi gjorde sidst og overveje, hvilken løsning, der er bedst.

### BB-250 – TAF-kolonnen tæller kun det, der ligger i EO-perioden, men siger det ikke – og en række helt uden for står med 0

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
  (BB-217's form)
- **Prioritet:** Mellem
- **Beslutning:** Først **afvist**, derefter **GODKENDT efter modsvar** 2026-09-25. **GENNEMFØRT** 2026-09-25:
  «TAF-måneder (i EO-perioden)» / «TAF-arbejdsdage (i EO-perioden)». Afgrænsningen forbliver tavs; der er ingen
  ny advarsel.
  **Modsvar 2026-09-25:** afvisningen begrundede, at tavs afgrænsning til EO-perioden er korrekt. Det var ikke
  til debat – fundet foreslog kun overskriften, ordret som udvikleren selv krævede for svie/smerte ved BB-217, og
  BB-249's tilbagemelding bad om én samlet løsning. Udvikleren valgte samme form overalt.
- **Sådan fremprovokeres det:**
  1. Månedsløn. TAF `01-07-2023` – `30-06-2024` og `01-02-2025` – `28-02-2025`.
  2. «Nummer» `2`. TAF `01-07-2023` – `31-12-2023` (fra sidste opgørelse) og `01-01-2024` – `31-12-2024`.
- **Det sker:** 1: «TAF-måneder» skriver **6** for en række på 12 måneder og **0** for 2025-rækken, begge
  umarkeret. Boksen har kun «Der er ikke rejst TAF-krav for hele EO-perioden»; advarslen om perioder uden for
  erstatningsperioden (`taf.perioder.clampedAway`) kommer kun, når ALLE rækker ligger uden for. Papiret skriver
  «01-01-2024 - 30-06-2024» – den klemte periode. 2: 2023-rækken står med **0** – præcis den tilstand,
  informationsikonet ved «Periode:» beder om («Tidligere indtastede perioder skal ikke slettes ved senere
  opgørelse»).
  Tallet er rigtigt: kolonnen tæller efter klemningen (`tafRowDerived.ts:36-47`), som BB-217 bad om. Det, der
  mangler, er BB-217's anden halvdel: overskriften hedder bare «TAF-måneder».
- **Det er uhensigtsmæssigt fordi:** Brugeren taster tolv måneder og ser 6 – eller en hel række, der giver 0 –
  uden at noget siger hvorfor. Ved 2. opgørelse er 0-rækkerne normaltilstanden.
- **Bedre ville være:** «TAF-måneder (i EO-perioden)» / «TAF-arbejdsdage (i EO-perioden)», ordret BB-217's
  form.
- **Andre steder det kan gælde:** Ingen nye.

**Tilbagemelding**
Jeg afviser fundet. Det er programmets korrekte og forventelige adfærd, at brugeren indtaster samtlige oplysninger om skadelidtes forhold, også forhold, der ligger uden for den aktuelle erstatningsperiode. Brugeren laver da løbende erstatningsopgørelse 1 for perioden xx-xx, og derefter erstatningsopgørelse 2 for periode yy-yy, og så videre. Og det er en helt normalt og forventelig adfærd, at brugeren senere fx vil skulle revidere erstatningsopgørelse 1, og i den forbindelse danner et nyt dokument med en ny opgørelse 1, derved at brugeren blot indtaster den EO-periode, som denne vedrører, og ændrer opgørelsens nummer til 1. Programmet beror dermed på en grundlæggende, bærende præmis om, at alle TAF- og Svie/smerte-perioder indtastet, men at programmet kun danner en opgørelse svarende til EO perioden, og clamper tavst. Dette er korrekt og ønskelig adfærd.

### BB-251 – Overlappende TAF- og ferieperioder spærrer opgørelsen uden en eneste rød celle

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
  (BB-218's form)
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-25. **GENNEMFØRT** 2026-09-25: overlappet projekteres som
  `FieldIssue` på begge celler i begge rækker i begge tabeller (`periodOverlapIssues.ts`, delt med svie/smerte), og
  tooltippen navngiver modparten. Boksens linje navngiver nu tabellen – «Der er overlappende TAF-perioder» /
  «Der er overlappende ferieperioder» – så ens linjer foldes pr. tabel og ikke på tværs. Svie/smerte og
  beregningsgrundlagets ferie har fået samme form («… svie/smerte-perioder», «… ferieperioder i
  beregningsperioden»), fordi den fælles tekst foldede alle fire tabellers overlap sammen.
- **Sådan fremprovokeres det:** Dagsløn. TAF `01-01-2024` – `30-06-2024` og `01-06-2024` – `31-12-2024`. Ferie
  `01-03-2024` – `15-03-2024` og `10-03-2024` – `20-03-2024`. Gå til Beregning og klik linket.
- **Det sker:** Alle ti celler er neutrale (målt `aria-invalid = "false"`). Boksen har **én** linje, «Der er
  overlappende perioder», for begge tabellers overlap (BB-231's foldning), og linket blinker den første
  TAF-rækkes fra-celle (målt). Ferieoverlappet er ikke nævnt for sig. Download er spærret.
  Tabellen skriver dertil **110** og **150** arbejdsdage for de to rækker – 260 i alt i et halvår med 254
  mulige.
  Mekanikken til rettelsen findes: TAF-tabellen tager allerede `cutoffIssues` ind som `collectionRuleIssue`
  (`TafPeriodeTable.tsx:28-32`), præcis som svie/smerte-tabellen fik overlappet ind ved BB-218
  (`svieSmerteOverlapIssues.ts`). Ferietabellen har ingen indgang.
- **Det er uhensigtsmæssigt fordi:** Dato-orden og afskæring farver de samme celler; overlappet er ene om ikke
  at gøre det. Med to tabeller og én foldet linje kan brugeren ikke se, at der er to fejl, og linket fører kun
  til den ene.
- **Bedre ville være:** BB-218's løsning i begge tabeller: de overlappende rækkers datoceller røde med en tooltip,
  der nævner den anden række («Overlapper perioden 01-06-2024 - 31-12-2024»), og én linje pr. tabel i boksen.
- **Andre steder det kan gælde:** Fravær i beregningsperioden (`eoRowTafBeregningsgrundlagRows.ts:209`, 12f) og
  lønindkomstens perioder (12h) bruger samme `detectOverlappingPeriods` – uafprøvet.

**Tilbagemelding**
Enig

### BB-252 – For mange løse feriedage spærrer opgørelsen uden rød celle og uden link

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning` og
  `#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-25. **GENNEMFØRT** 2026-09-25: reglen bor i
  `tafRowRules.ts` og læses af validatoren, cellen (rød ring med samme tekst) og «Fejl og advarsler», hvis linje
  linker til cellen. Maksimum regnes nu kun mod TAF-afsnittets egne ferieperioder – dem, beregningen fradrager
  løse feriedage efter; ferie i beregningsperioden talte før med og kunne sænke maksimum under det, beregningen
  brugte.
- **Sådan fremprovokeres det:** Dagsløn. TAF `01-01-2024` – `31-01-2024`, «Løse feriedage» `999`. Gå til
  Beregning.
- **Det sker:** Cellen er neutral (målt), den afledte kolonne skriver **0**, og boksen har linjen «**Løse
  feriedage overstiger mulige arbejdsdage i perioden (maksimalt 22)**» – **uden link**. Download er spærret.
  Reglen findes kun i den gamle validator (`validateTafLoseFeriedage`, `erstatningsopgoerelseValidator.ts:804`),
  hvis `ValidationError` har en streng-`path` og derfor hverken kan farve cellen eller linkes (M-33).
- **Det er uhensigtsmæssigt fordi:** Brugeren ser et 0 i tabellen, en spærret knap og en linje, han ikke kan
  klikke på. Grænsen (22) er kendt, og den afhænger af rækkens egne værdier – den hører på cellen.
- **Bedre ville være:** Rød celle på «Løse feriedage» med samme tekst i tooltippen, og linjen i boksen linker til
  cellen.
- **Andre steder det kan gælde:** «Uspecificerede ferie-/feriefridage overstiger mulige arbejdsdage i
  beregningsperioden» (`validateBeregningsperiodeLoseFeriedage`, 12f) har samme form. Bemærk dertil, at
  `validateTafLoseFeriedage` regner maksimum med BÅDE ferie i TAF-perioden og fravær i beregningsperioden
  (`:809`), mens beregningen kun bruger den første – uafprøvet, fordi de to sjældent overlapper.

**Tilbagemelding**
Enig

### BB-253 – TAF-rækken vurderes af to lag, og en række med kun løse feriedage spærrer uden link

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
  (mønsterets navngivne kandidat, validatorlinje 879/882)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-25. **GENNEMFØRT** 2026-09-25: én linje pr. række med rækkens
  navn og alle dens mangler, link til den første – fx «TAF-perioden med 3 løse ferie-/feriefridage: Fra- og
  til-dato er ikke angivet» og «Ferieperioden fra 01-03-2024: Til-dato er ikke angivet». Validatoren bruger samme
  ordlyd (`assessPeriodeDatoMangler`). En rød celle meldes med sin egen tekst frem for som manglende: en TAF-fra-dato
  før skadedatoen gav før linjen «Fra-dato er ikke angivet».
- **Sådan fremprovokeres det:**
  1. TAF `01-01-2024` – `31-12-2024`. I den tomme række derunder tastes kun «Løse feriedage» `3`.
  2. Ny sag: TAF-række med kun fra `01-01-2024`, og en ferierække med kun fra `01-03-2024`.
- **Det sker:** 1: Boksen skriver «**Fra-dato mangler**» og «**Til-dato mangler**» – begge uden link – og download
  er spærret. Rækkebyggeren ser rækken som tom (den filtrerer på `fra || til`, `eoRowTaftRows.ts:52`); det er
  validatoren (`validateTAF`), der melder den. 2: Boksen har **én** linje, «**Til-dato er ikke angivet**», med
  link til TAF-rækkens til-celle (målt ét blink). Ferierækkens ordret samme mangel er foldet ind i den og
  står ingen steder for sig (BB-231's bagside).
  Samme mangel har dermed to ordlyde efter hvilket lag, der melder den, og det ene lag kan ikke pege.
- **Det er uhensigtsmæssigt fordi:** I 1 kan brugeren se et `3` i en række uden datoer, men beskederne nævner
  hverken rækken eller kolonnen, og der er intet at klikke på. I 2 tror han, at der er én ting at rette.
  (At en halvfærdig række ikke får rød ring, er afgjort ved BB-083 og ikke en del af fundet.)
- **Bedre ville være:** Som øvrige krav efter 12c: én vurdering pr. række, som validator og boks læser; én linje
  pr. række med rækkens navn og alle dens mangler og link til første manglende celle – fx «Periode (række 2):
  Fra-dato og til-dato er ikke angivet» og «Ferieperiode (række 1): Til-dato er ikke angivet».
- **Andre steder det kan gælde:** Svie/smerte-perioderne er M-33's anden navngivne kandidat (12b målte kun
  spærringen).

**Tilbagemelding**
Enig

### BB-254 – Et allerede modtaget beløb større end kravet giver et regnestykke, der ikke går op

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
  og `#m-13--nul-er-en-oplysning-ikke-et-fravær` (BB-160's form: et aritmetisk falsk regnestykke i papiret)
- **Prioritet:** Mellem
- **Beslutning:** **AFVIST** af udvikleren 2026-09-25: at selskabet har betalt mere, end programmet opgør, er
  normalt. **Modsvar 2026-09-25:** jeg spurgte, om papiret i det mindste skulle sige klemningen («… = -140.000,00
  kr., som sættes til 0,00 kr.»); udvikleren valgte at lade papiret stå. Intet ændret.
- **Sådan fremprovokeres det:** Månedsløn. TAF `01-01-2024` – `31-12-2024`. «Evt. allerede modtaget tabt
  arbejdsfortjeneste …» `500.000`. Hent opgørelsen.
- **Det sker:** Feltet er neutralt, boksen er væk (ingen fejl eller advarsler), og papiret skriver:
  «Tidligere betalt erstatning **500.000,00 kr.** / Der er allerede betalt tabt arbejdsfortjeneste for perioden
  med» og derefter «Beregnet krav **0,00 kr.** / **360.000,00 kr. - 500.000,00 kr. =**». Kravet klemmes til 0
  (`clampMoneyOreToZero`), og de 140.000 kr., der er betalt for meget, står ingen steder.
- **Det er uhensigtsmæssigt fordi:** Den sandsynlige årsag er et ekstra nul eller et beløb for hele sagen i et
  felt, der kun gælder den nuværende periode. Programmet kender begge tal. Papiret, modparten læser, indeholder
  et regnestykke, hvis resultat ikke er differencen – og som skjuler, at der er betalt mere end opgjort.
- **Bedre ville være:** En ikke-blokerende gul ring på feltet og en linje i boksen, når beløbet overstiger kravet
  før fradrag: «Beløbet overstiger det opgjorte krav for perioden (360.000,00 kr.)». I papiret regnestykket, som
  det er, med klemningen sagt: «360.000,00 kr. - 500.000,00 kr. = -140.000,00 kr., som sættes til 0,00 kr.»
  Om det overskydende skal modregnes i andre krav, er en beregningsregel og ikke en del af forslaget.
- **Andre steder det kan gælde:** Svie/smertes «Evt. allerede modtaget svie/smerte for nuværende
  erstatningsperiode» (12b) trækkes også fra et opgjort beløb – uafprøvet.

**Tilbagemelding**
Jeg afviser fundet. hvis der allerede er modtaget erstatning, vil det bero på en anden opgørelse, som forsikringsselskabet har lavet. opgørelserne er ikke nødvendigvis ens - og det er en helt normal og forventligt forekommende omstændighed, at et forsikringsselskab kan have betalt mere i erstatning for en EO-periode, end programmet opgør kravet til.

### BB-255 – Beløbsfeltet hedder tre ting

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne` (BB-211/BB-224/BB-243's form)
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-25 (begge dele). **GENNEMFØRT** 2026-09-25: feltet hedder
  «Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode» i oplæsning og fejltekster, og
  papirets overskrift er «Allerede modtaget tabt arbejdsfortjeneste».
- **Sådan fremprovokeres det:** Læs feltets tilgængelige navn, og hent en opgørelse med et beløb i feltet.
- **Det sker:** Skærmen: «Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode».
  Oplæst navn og feltets fejltekster: «**Tidligere modtaget TAF**» (`erstatningsopgoerelseDescriptors.ts:688`).
  Papiret: «**Tidligere betalt erstatning**» / «Der er allerede betalt tabt arbejdsfortjeneste for perioden med».
  Svie/smertes tvillingefelt fik ved BB-224 netop skærmens tekst som navn, og BB-224 skelnede
  «tidligere» (andre opgørelser) fra «nuværende periode» – her siger to af de tre navne «tidligere».
- **Det er uhensigtsmæssigt fordi:** «Tidligere» kan læses som tidligere opgørelser, som feltet netop ikke
  handler om, og «erstatning» er bredere end tabt arbejdsfortjeneste.
- **Bedre ville være:** (a) Descriptorens `label` = skærmens tekst. (b) Papirets overskrift «Allerede modtaget
  tabt arbejdsfortjeneste» i stedet for «Tidligere betalt erstatning».
- **Andre steder det kan gælde:** Periodetabellens celler oplæses kun som «Fra o.m.», «Til o.m.» og «Løse
  feriedage» uden tabellens navn – ens i begge tabeller. Ikke vurderet her; formen er fælles for programmets
  tabelceller.

**Tilbagemelding**
Enig

### BB-256 – Papirets ferielinje siger «i perioden» to gange og kalder løse feriedage noget andet

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (skærm og dokument om samme
  oplysning)
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-25 med «løse ferie-/feriefridage» som det faglige ord.
  **GENNEMFØRT** 2026-09-25: kolonnen og feltet hedder «Løse ferie-/feriefridage», og papiret skriver «I perioden
  blev der afholdt ferie 01-03-2024 - 15-03-2024 samt 5 løse ferie-/feriefridage.»
- **Sådan fremprovokeres det:** Dagsløn, TAF `01-01-2024` – `30-06-2024`, «Løse feriedage» `5`, ferie `01-03-2024` –
  `15-03-2024`. Hent opgørelsen.
- **Det sker:** «I perioden blev der afholdt ferie **i perioden** 01-03-2024 - 15-03-2024 samt 5 **løse
  ferie-/feriefridage**.» (`eoPresentationSectionBuilders.ts:31-56`). Skærmen kalder kolonnen «Løse feriedage».
- **Det er uhensigtsmæssigt fordi:** Første «i perioden» er TAF-perioden, andet er ferien; sætningen læses som en
  gentagelse. Kolonnen og papiret bruger to ord om samme tal.
- **Bedre ville være:** «I erstatningsperioden blev der afholdt ferie 01-03-2024 - 15-03-2024 samt 5 løse
  feriedage.» – eller kolonnen omdøbes til «Løse ferie-/feriefridage», hvis det er det rigtige faglige ord.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig. De fleste lønmodtagere vil både have ret til feriedage og til feriefridage. Det er to forskellige rettigheder, men som dækker over samme grundlæggende forhold - at medarbejderen kan holde fri. Modsat sammenhængende ferieperioder, er det for enkeltstående fridage ikke muligt at se, om det er en feriedag eller en feriefridag, så 'løse ferie-/feriefridage' er most korrekt.

### BB-257 – En TAF-periode uden arbejdsdage står i papirets periodeliste, men ikke i beregningen

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-09-25. **GENNEMFØRT** 2026-09-25: i arbejdsdage får en periode
  uden én arbejdsdag inden for opgørelsen en gul, ikke-blokerende ring på begge datoceller og linjen «TAF-perioden
  23-11-2024 - 24-11-2024: Perioden indeholder ingen arbejdsdage»; papirets periodeliste skriver «23-11-2024 -
  24-11-2024 (0 arbejdsdage)». En række helt uden for opgørelsen advares ikke – den er normaltilstanden fra 2.
  opgørelse.
- **Sådan fremprovokeres det:** Dagsløn. TAF `01-01-2024` – `31-10-2024` og `23-11-2024` – `24-11-2024` (en
  weekend). Hent opgørelsen.
- **Det sker:** Tabellen skriver **0** for anden række uden markering. Papiret skriver under «Erstatningsperioder
  med tabt arbejdsfortjeneste» begge perioder, men regnestykket har kun én linje, «01-01-2024 - 31-10-2024: 213
  arbejdsdage á 1.500,00 kr.» Boksen har kun den almindelige «Der er ikke rejst TAF-krav for hele EO-perioden».
- **Det er uhensigtsmæssigt fordi:** En periode på to weekenddage er næsten altid en tastefejl (her fx `23-11` for
  `23-12`), og papiret gengiver den som krævet uden at regne på den.
- **Bedre ville være:** En gul ring på rækken: «Perioden indeholder ingen arbejdsdage». Papiret lader være med at
  liste en periode, der ikke indgår i regnestykket – eller viser den med «0 arbejdsdage».
- **Andre steder det kan gælde:** I måneder kan en periode ikke blive 0; formen findes kun i arbejdsdage.

**Tilbagemelding**
Enig

## Overvejet uden fund

- **Kravvalget:** «Nej» efter indtastning skjuler sektionen, fjerner alle TAF-linjer fra boksen (også en
  halvudfyldt række) og giver papiret «Tabt arbejdsfortjeneste / Ingen»; «Ja» igen gendanner rækkerne og beløbet
  `10.000,00` (målt). «Ja» uden rækker giver den gule «Der er ikke angivet nogen TAF-periode i EO-perioden» og et
  papir med Status og «Ingen» – skelnes fra «Nej». Adfærden er ordret den samme som i 12b/12c (flader.md's
  fællespunkt): efterprøvet, ingen fund. M-32 bestået: alle fem felter bærer `relevance`.
- **Beregningerne er kontrolregnet** i fire sager: 130 hverdage – 6 SH-dage – 11 ferie – 5 løse = 108; 124 – 10
  = 114; 124 – 10 – 5 = 109; 12 og 6 måneder à 30.000 kr. Ferie fradrages kun i fællesmængden med TAF.
- **Afskæringen fra 12d virker i tabellen** og er ikke gennemgået igen.
- **Stille klemning til EO-perioden** er dokumenteret og rigtig; kun overskriften mangler (BB-250). Ligger alle
  rækker uden for, siger boksen det («… TAF beregnes derfor til 0 kr.»).
- **«Der er ikke rejst TAF-krav for hele EO-perioden»**, når TAF slutter før EO-perioden uden en afskæring, er en
  rimelig, ikke-blokerende påmindelse og kan ryddes ved at rette perioden. Linket blinker rækkens til-celle.
- **Folkepensionsadvarslen** («TAF-perioden løber til efter skadelidtes folkepensionsalder (01-03-2023).») kommer
  på rette tidspunkt og blokerer ikke. Ordet «alder» om en dato er uheldigt, men forståeligt.
- **Negativt beløb** i «allerede modtaget» tages ikke imod (feltet er tomt efter `-5000`), ligesom i de øvrige
  beløbsfelter (BF-032).
- **Slet og fortryd:** «Slet rækken» på en ferierække og Ctrl+Z gendanner begge datoer (målt).
- **M-09 bestået:** ingen vandret scroll ved 1244×620 (`scrollWidth = clientWidth = 1244`). Rul-op-knappen
  dækker kun sektionens hjørne, intet felt (M-10 bestået).
- **Konsollen var tavs:** 0 fejl, 0 advarsler, 0 page-errors i samtlige kørsler.

## Henvisninger til andre bidder

- **12f:** BB-247's mønster (M-35) har to kandidater dér – ferie i beregningsperioden og «Uspecificerede
  ferie-/fridage» i måneder. BB-249's kolonne (`fravaerFeriedageById`), BB-251's overlap og BB-252's
  maksimumsregel har hver en tvilling i beregningsperioden.
- **12g:** beregningsenheden kan skifte af to valg på Lønindkomst («Løn på helligdage», «Fuld løn under ferie»);
  det er BB-247's bagside og skal prøves fra dén side.
- **12b:** BB-254's form på svie/smertes «allerede modtaget» og M-33's svie/smerte-kandidat.

## Dækningshuller

- Kun Chrome, lyst tema; kun PDF-kanalen er læst.
- Beregningsenheden er kun styret gennem «Angivet månedsløn/dagsløn»; skiftet via Lønindkomst (12g) er ikke
  målt.
- Erhvervssygdom (skadedato-gulvet er anmeldelsesdato minus 5 år) er ikke afprøvet for ferieperioderne.
- `Gem`/`Hent` er ikke afprøvet (filvælgeren kan ikke betjenes headless).
- Forlig om ansvarsgrad kombineret med «allerede modtaget» er ikke afprøvet.

## Åbne spørgsmål

Ingen. Alle elleve fund er afgjort 2026-09-25: ni rettet (BB-247 indsnævret, BB-248–BB-253, BB-255–BB-257) og ét
afvist (BB-254). BB-247, BB-248, BB-250 og BB-254 blev afgjort efter modsvar.

**Henvisning til 12f:** «Ferie i beregningsperioden» og «Uspecificerede ferie-/feriefridage» er ikke skjult i
måneder – deres virkning i måneder er ikke undersøgt her og hører til 12f's gennemgang.
