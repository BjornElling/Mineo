# Værdiklasse-gennemgang – vurdering, kontrolskema og resultat

Dato: 2026-11-24. Anledning: udviklerens ønske om en systematisk gennemgang af alle steder i programmet, der
rummer en værdi, med et kontrolskema for positive, negative, nul, tomme, ugyldige m.fl. værdier – i input, kode,
mellemregninger og sammentællinger – og et fornuftstjek af, om hvert sted håndterer dem rigtigt. Baggrund:
BB-290 (afsnit 9.1 i `kontrolfaner-vurdering-2026-11-24.md`).

## 1. Vurdering

**Hensigtsmæssig – i den rigtige form.** Bogstaveligt («hver variabel × hver værdiklasse») er gennemgangen
uoverskuelig og for det meste tom: de fleste værdier kan kun antage én klasse, fordi en grænse længere oppe
allerede har afgjort det. Den værdifulde enhed er ikke værdien, men **stedet, hvor en værdi bliver klassificeret
eller ændret**: hvor koden sammenligner med nul, afgrænser (`Math.max(0, …)`), springer over (`continue`,
`filter`), erstatter en tom værdi (`?? 0`, `|| 0`), dividerer, afrunder eller viser. De steder kan findes
mekanisk og er endelige (ca. 1.250 sammenligninger med nul, 70 afgrænsninger, 130 erstatninger af tomme
værdier i kildekoden). Hvert sted gennemgås med samme skema, og hvert fund knyttes til, om værdiklassen faktisk
kan nå stedet fra brugerens input.

**Ville gennemgangen have fanget BB-290?** Ja. Fejlen var præcis et klassificeringssted: indtægtsberegningen
sprang en række over med `if (samletContrib <= 0) continue`, mens lønfeltet tog imod negative beløb. Skemaet
spørger ved hvert sådant sted: *kan klassen nå hertil?* (ja – feltet accepterer `-2000`) og *hvad sker der med
den?* (rækken forsvinder uden besked). Kombinationen «tavs udeladelse af en tilladt værdi» er netop skemaets
røde kategori. Gennemgangen afgør ikke, om udeladelsen er fagligt rigtig – det gjorde udvikleren ved BB-290 –
men den finder den, før en bruger gør. Påstanden er afprøvet blindt (afsnit 5.1).

TD-016 (en weekendydelse manglede i tabellen) ville kun blive fanget af datoklasserne nedenfor, ikke af
fortegnsklasserne. Derfor indgår datoklasser i skemaet.

**Hvad gennemgangen ikke kan:** afgøre fortolkningsspørgsmål eller finde forkerte satser. Den finder steder,
hvor en værdi forsvinder, ændres eller giver et uventet resultat, og stiller dem til afgørelse.

**Afgrænsning:** fokus på beregningskæden (input → projektion → motor → snapshot → dokument). UI-geometri,
tastaturnavigation og tabelindeks (`index < 0`, `length === 0`) er uden for, medmindre de bærer en beløbs- eller
datoværdi.

## 2. Værdiklasser

| Kode | Klasse | Eksempel |
|---|---|---|
| K1 | Positiv, almindelig | `30000` |
| K2 | Nul | `0` |
| K3 | Negativ | `-2000` (efterregulering, træk) |
| K4 | Tom / ikke udfyldt | `undefined`, `null`, `''` |
| K5 | Afvist råtekst | `12a` – må aldrig nå en beregning |
| K6 | Ikke-endelig | `NaN`, `±Infinity` (fx division med nul) |
| K7 | Under mindste enhed | `0,005 kr.`, `1/3` dag, procent med mange decimaler |
| K8 | Meget stor | præcisionstab over 2^53, store produkter |
| K9 | Præcis på en grænse | min/max, `>` mod `>=` |
| K10 | Negativt nul | `-0` → «-0,00 kr.» |
| D1 | Tom dato eller halv periode | kun startdato |
| D2 | Omvendt periode | slut før start |
| D3 | Én-dags-periode | start = slut |
| D4 | Skudår, månedsskifte, årsskifte | 29-02, 31-01 → 28-02 |
| D5 | Weekend, helligdag | dag, der ikke er arbejdsdag |
| D6 | Uden for den relevante periode | række helt før/efter |
| D7 | Overlap og dubletter | to rækker for samme dag |
| P1 | Procent > 100, = 0, negativ | forligsgrad, mén, erhvervsevnetab |
| L1 | Tom liste, ét element | ingen rækker, ingen ansættelsesforhold |

## 3. Kontrolskema pr. sted

| Felt | Indhold |
|---|---|
| Sted | `fil:linje` |
| Art | A input-grænse · B projektion · C vagt/omformning · D sammentælling · E visning |
| Størrelse | hvad værdien er, og enhed (øre, kr., dage, procent, dato) |
| Klasser, der kan nå stedet | vurderet opstrøms fra feltet; «ikke nåbar» kræver en navngiven grænse |
| Hvad sker der | passerer · afgrænses · springes over · erstattes · kaster · NaN · rød · gul |
| Fornuftstjek | **OK-dok** (reglen står i `docs/domain/`, en kontrakt eller en afgørelse) · **OK-åbenbar** · **TAVS** (en tilladt værdi forsvinder eller ændres uden besked) · **FEJL** (nedbrud, NaN, «-0,00», forkert resultat) |
| Test | findes en test af netop den klasse på netop det sted |

Kun TAVS, FEJL og manglende tests af risikable steder registreres som fund. Fund, der kan ændre et tal, er
beregningslogik og forelægges udvikleren (AGENTS.md); øvrige rettes direkte.

## 4. Udførelse

Stederne findes mekanisk pr. område og gennemgås af parallelle gennemgange med samme skema:

1. Inputgrænsen: Zod-schemas, feltdefinitioner, beløbsudtryk, indlæsning af `.eo`.
2. EO: indtægter, periodisering, dagstællinger og TAF-netto.
3. EO: lønudvikling, regulering og sygeferiegodtgørelse.
4. EO: svie/smerte, forlig, TAF pr. år, snapshot, valideringsregler og rækkevurdering.
5. Erhvervsevnetab.
6. Årsløn, standardløn, forsørgertab, varigt mén, satser, renter og fælles talhjælpere.
7. Visning: dokumentgeneratorer, PDF, Word og beløbstekster.
8. Kalibrering: den gamle `indtaegtPerioder.ts` fra før BB-290, gennemgået blindt med skemaet.

## 5. Resultat

### 5.1 Kalibrering mod BB-290

`indtaegtPerioder.ts` fra `4393526c^` blev gennemgået blindt: uden adgang til dokumentation, git-historik eller den
nuværende kode, kun med skemaet og den samme historiske version af resten af repoet. Gennemgangen fandt selv
`samletContrib <= 0 → continue` (linje 425) som TAVS med beløbsvirkning, sporede den til lønfelternes
`allowNegative: true` og fandt desuden ydelsesvarianten (`amount <= 0 → continue`, linje 474), som BB-290 også
rettede. Skemaet ville altså have fanget fejlen før brugerbliksgennemgangen.

### 5.2 Omfang

Ca. 1.400 klassificeringssteder gennemgået: inputgrænsen (86 steder og 78 talfelter afprøvet med 18 værdiklasser
hver), EO-indtægter (ca. 260), EO-løn/regulering/SFGG (ca. 195), EO-snapshot/validering (ca. 210),
erhvervsevnetab (255), øvrige beregnere og talhjælpere (ca. 265), visning (ca. 145). Hvert fund er afprøvet med en
probe gennem den rigtige kode; afrundingsfundene er desuden efterprøvet særskilt.

### 5.3 Rettet

| Fund | Klasse | Rettelse |
|---|---|---|
| Et regnestykke med øre i ASL- eller EAL-årsløn («399999,5+0», «1000/3») kastede en intern fejl ved settle; feltet viste den nye tekst, mens beregningen brugte den gamle værdi | K7 | Committes som det afrundede tal, som et almindeligt tal i samme felt (BB-118). `fieldCodecs.ts` |
| Svie/smerte: «(reduceret til max)» blev trykt, når kravet præcis ramte restpladsen ved brøkforlig og et tidligere beløb med øre | K9/K7 | Sammenligningen sker i hele øre som nabofeltet `maksimumNaaet`. Beløbet var og er uberørt. `svieSmerteEngine.ts` |
| Svie/smerte: et modtaget beløb på 0 for perioden gav «á 230 kr. - 0 kr. =» og «Der er tidligere modtaget 0 kr. for denne periode.» | K2 | 0 behandles som intet fradrag (BB-129/BB-130). `eoPresentationSectionBuilders.ts` |
| Bilaget «Regulering» skrev «Indtastning mangler» ved en anciennitetstillægssats på 0, som beregningen regner med | K2 | Viser «0,00 kr./måned fra …». `reguleringSection.ts` |

Nye tests: et værn, der kræver, at hvert ikke-negativt talfelt i produktionskataloget giver en feltfejl på en
negativ værdi (før hvilede det på, at hvert felt huskede sin egen grænse); et negativt år ved positivt krav i
«TAF fordelt på år»; en negativ sygedagpengerække, der kun ligger i en weekend eller på en helligdag. Desuden rettet
`tabt-arbejdsfortjeneste.md` (kun sygedagpenge og feriepenge periodiseres på hverdage) og en forældet kommentar i
`forligsgrad.ts`.

### 5.4 Til udviklerens afgørelse (beregningslogik eller indlæsning)

| # | Fund | Klasse | Virkning |
|---|---|---|---|
| A | Afrunding regner på det binære kommatal. Et resultat, der går lige op, rundes op ét trin for meget; et resultat på præcis ,5 kan rundes ned | K9/K7 | Varigt mén 1 kr. for højt (fx 64.500 × 82 % = 52.890 → 52.891; 83 kombinationer 2020–2027). Forsørgertab 12 kr./år for højt i den løbende ydelse (112 kombinationer). Halv-op-afrundingen rammer bl.a. forsørgertabets aldersreduktion (100.050 × 29 % = 29.014,5 → 29.014) |
| B | «TAF fordelt på år» og grafen: en kilde, der samlet er positiv, men negativ inden for ét kalenderår (eller én måned i grafen), falder ud af det år. Ny variant af BB-290 | K3×D4 | Over 1 kr.: begge årsdokumenter spærres med en uforklaret systemfejl, uden linje i «Fejl og advarsler». Under 1 kr.: forkert årsfradrag, forskellen havner i «Afrunding». Grafen viser måneden uden indtægt |
| C | Sygeferiegodtgørelse ud fra overenskomstens direkte sats: dage før overenskomstens første sats udelades uden besked; kun når alle dage mangler, kommer der en rød linje | D6/K4 | For lav sygeferiegodtgørelse, kan hentes |
| D | Erhvervsevnetab: fanen «EET efter EAL» bruger en afgørelse med virkning efter beregningsdatoen, mens differencekravet ikke gør | D6 | To forskellige EAL-krav i samme sag (målt 3.476.785 mod 2.674.450 kr.) |
| E | Årsløn: en samlet negativ årsløn giver hverken gul ring eller spærring; dokumentet kan hentes med en negativ årsløn | K3 | Afgørelsen fra 2026-10-19 er kun gennemført på EO |
| F | «TAF fordelt på år»: når det samlede krav er 0, fordi allerede modtaget overstiger kravet efter forlig, trykkes «I alt (50 % af 0,00 kr.) 9.523,81 kr.» | K2/P1 | Regnestykket på papiret går ikke op; beløbet (0) er rigtigt |
| G | Indlæsning af `.eo`: en ukendt ydelsestype tæller ikke med uden besked; EAL-årsløn med øre vises afrundet, men regnes uafrundet; EO's månedskolonne tager imod fx «1.5» som januar | K4/K7/K5 | Kun via håndrettede eller ældre filer. En ny advarsel eller fejl ved indlæsning er en godkendelsesgate |

**Afgørelse 2026-11-25: A–G godkendt og gennemført.**

| # | Gennemførelse |
|---|---|
| A | `rounding.ts` fjerner binær regnestøj før afrunding (15 betydende cifre, kun når forskellen er under en milliontedel af afrundingsenheden, så store tal bevarer deres sidste ciffer). Ændrede tal i eksisterende tests: manuel procentsats 0,2 % + 2,5 % giver nu 2,71 % (før 2,70 %), og et golden-bilag i Årsløn 2.158,28 (før 2.158,27) – begge den decimalt korrekte halv-op-afrunding. |
| B | `buildIncomeForRanges(…, 'include')` i årsfordelingen: en kilde, der er negativ i ét år, giver året et negativt fradrag, vist som «+ 1.000,00 kr.». Hovedopgørelsen og spærringen af en samlet negativ kilde er uændret. Grafen viser fortsat en negativ måned som intet indtægtsniveau; et negativt bånd kræver et nyt grafdesign. |
| C | Dage med krav, men uden overenskomstsats, registreres (`foersteDagUdenSats`) og spærrer med den eksisterende linje «Dagssats kunne ikke fastsættes for den valgte overenskomst i TAF-perioden». |
| D | «EET efter EAL» bruger samme afgrænsning til beregningsdatoen som differencekravet (`filterAslRowsKnownAtBeregningsdato`). `eal-beregning.md` opdateret. |
| E | Årsløn: negativ række får den gule EO-advarsel; en samlet negativ løn spærrer med «Lønnen i tabellen er samlet negativ (… kr.) – kontrollér lønrækkerne». |
| F | Når kravet er 0, fordi det betalte overstiger kravet efter forlig, vises årets regnestykke helt med den del af det betalte, der modregnes i året. `eo-snapshot-contract.md` §10 opdateret. |
| G | Rød ring ved indlæsning: ukendt ydelsestype («Ukendt ydelsestype «…» – vælg en ydelsestype»), EAL-årsløn med øre («Beløbet skal angives i hele kroner») og EO's måneds-/ugekolonner med en værdi, codecet ikke kan fortolke (samme værn som Årsløn). Filen og de indlæste værdier ændres ikke. |

### 5.5 Svagheder uden nåbar virkning i dag

- `formatKr(Infinity)` giver «0 kr.», og `formatDeductionKr(-2000)` giver «- -2.000 kr.». Ingen motorværdi når
  hertil i dag.
- `roundFloor`/`roundCeil` havde samme kommatalsproblem med decimaler (0,07 → ceil 0,08); lukket sammen med fund A.
- `src/validators/erstatningsopgoerelseValidator.ts` tillader forligsprocent 0–100, mens feltet kræver 1–100. Feltets
  røde ring spærrer, så forskellen er uden virkning.

### 5.6 Vurdering af metoden efter udførelsen

Gennemgangen fandt fire fejl, der er rettet, og syv sager til afgørelse (A–G), hvoraf seks kan ændre et beløb –
blandt dem én ny variant af BB-290. Det bekræfter, at
enheden «klassificeringsstedet» er den rigtige: de fleste fund ligger netop i en `<= 0`-vagt, en kommatals-
sammenligning eller en `continue`, og de blev kun fundet, fordi værdiklassen blev sporet til et felt, der faktisk
tillader den. Tre af fundene (B, C, D) er kombinationer af en værdiklasse og en datoklasse; de ville ikke være
fundet med fortegnsklasserne alene. Skemaet bør bruges igen ved hver ny beregning eller ny inputflade: kør stederne
mekanisk frem for den ændrede fil, og kræv en navngiven grænse for hvert «ikke nåbar».
