# Brugerblik — Stamdata

- Rute/placering: `/stamdata`
- Gennemgået: 2026-08-16 · commit `8a2d0320`
- Afprøvet i: Chrome (Playwright, headless), CSS-viewport 1536×864, devserver på 4173

## Fladen kort

Stamdata er programmets første side og den, alle øvrige sider hviler på. Den har to bokse:
**Sagsinfo** (Journalnr., Advokat/Sagsbehandler) og **Skadelidte** (Skadelidtes navn, Fødselsdato,
Skadestype, Skadedato/Anmeldelsesdato) — syv felter i alt, ingen faner, ingen tabeller, ingen
beregning.

Alle syv felter er valgfrie. Ingen af dem kan blokere noget på selve Stamdata. Til gengæld er to af
dem forudsætning for det meste af programmet: **skadedatoen** sætter den nedre grænse for stort set
alle andre datofelter på Erhvervsevnetab, Varige mén, Forsørgertab og Erstatningsopgørelsen, og
**skadestypen** afgør, hvad datoen overhovedet betyder — og ved Erhvervssygdom flytter den samtidig
Erstatningsopgørelsens nedre datogrænse fem år tilbage. Journalnr., advokat/sagsbehandler og navn
går videre til dokumenternes brevhoved.

Fladen er altså den mest konsekvenstunge på hele fladelisten og samtidig den, der giver brugeren
mindst feedback.

---

## Brugerens afgørelser (2026-08-16)

Alle ti fund er forelagt og afgjort. Oversigten er bindende; den enkelte afgørelse står i sin helhed
under fundet, sammen med agentens efterprøvning af præmisserne.

| ID | Afgørelse | Kode skal ændres |
|---|---|---|
| BB-001 | Afvist — skiftet må ske tavst; brugeren orienteres via den afledte datofejl | Nej |
| BB-002 | Accepteret — al tekst om datoen skal følge skadestypens navngivning | **Ja** |
| BB-003 | Afvist — tastning må ikke tolke på 3. ciffer; paste må gerne være mere tolerant | Nej |
| BB-004 | Blokeringen er allerede gældende og målt; de to initialfelter skal ned på 6 tegn | **Ja** (ny længdekategori) |
| BB-005 | Afvist — der skal ikke være nogen nedre aldersgrænse | Nej |
| BB-006 | Afvist — manglende indtastninger meldes dér, hvor de bruges, aldrig på Stamdata | Nej |
| BB-007 | Accepteret — indsat tekst normaliseres, men uden at forstyrre de øvrige normaliseringer | **Ja** |
| BB-008 | Afvist | Nej |
| BB-009 | Accepteret som den er — én gennemgående regel for tocifrede årstal | Nej |
| BB-010 | Afvist for markeringen — begge felter skal fortsat markeres; ordlyden skal derimod være feltspecifik | **Ja** (kun ordlyd) |

**Om kontrakterne.** Fire af afgørelserne hører hjemme i `src/contracts/`, men er bevidst **ikke**
skrevet ind endnu: en kontraktændring skal bære et opdateret «Senest verificeret mod kode»-stempel
(håndhævet af `check-contract-verification.mjs` og `contractVerificationPreCommit.test.ts`), og
stemplet ville være usandt, så længe koden ikke er rettet. Hver implementeringsplan nedenfor angiver
derfor den kontraktændring, der skal følge **med** kodeændringen.

Én afgørelse er derimod skrevet ind med det samme, fordi koden allerede opfylder den: BB-006's
placeringsprincip står nu som `error-contract.md` §3.1 (og bærer samtidig BB-010's markeringsregel).
BB-001's navnemekanik kunne på samme måde skrives ind uden kodeændring, men Stamdatas felter er
bevidst ikke omfattet af `input-field-behavior-contract.md` endnu (§6), så den hører til, når
BB-002-rettelsen alligevel åbner den kontrakt.

## Fund

### BB-001 — Skadestypen omdøber datofeltet og genfortolker den dato, der allerede står i det

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-01-kontekstuelle-feltnavne`
- **Prioritet:** Høj
- **Beslutning:** **Afvist af brugeren 2026-08-16** — med én faktuel korrektion fra agenten
- **Sådan fremprovokeres det:**
  1. Lad Skadestype stå tom. Feltet nederst hedder «Skadedato».
  2. Skriv `01-06-2020` i Skadedato og tryk Tab.
  3. Vælg Skadestype = «Erhvervssygdom».
- **Det sker:** Labelen skifter til «Anmeldelsesdato», og værdien `01-06-2020` bliver stående. Der
  gives ingen besked. Det samme sker den anden vej: vælges Skadestype fra igen (menupunktet «Vælg
  skadestype»), hedder feltet «Skadedato», og anmeldelsesdatoen står nu som skadedato.
- **Det er uhensigtsmæssigt fordi:** Skadedato og anmeldelsesdato er to forskellige oplysninger i
  en arbejdsskadesag — den dag skaden skete, og den dag sygdommen blev anmeldt. De kan ligge år fra
  hinanden. Programmet flytter altså brugerens tal fra det ene begreb til det andet uden at spørge,
  og datoen er samtidig den værdi, næsten alle andre sider bruger som nedre grænse og
  beregningsudgangspunkt. Brugeren har ingen anledning til at opdage det: feltet ser rigtigt ud,
  labelen passer til den nye skadestype, og tallet er «bare» det, han selv skrev.
- **Bedre ville være:** At programmet siger til, når skadestypen ændres, mens datofeltet er udfyldt
  — fx en advarsel ved feltet i retning af: «Datoen blev indtastet som skadedato. Efter skiftet til
  Erhvervssygdom bruges den som anmeldelsesdato — kontrollér, at det er den rigtige dato.»
  Alternativt at datoen ryddes ved skift af skadestype med en synlig besked om hvorfor. Hvilken af
  de to der er rigtig, er en UI/UX-beslutning; det afgørende er, at skiftet ikke sker i tavshed.
- **Andre steder det kan gælde:** `contextualLabel` bruges i dag kun af dette ene felt, så den
  konkrete mekanisme er lokal. Mønsteret — *et valg ændrer betydningen af en værdi, brugeren
  allerede har indtastet* — er derimod generelt og skal efterprøves overalt, hvor et valg styrer,
  hvordan et allerede udfyldt felt læses (se `TVAERGAAENDE.md`).

**Brugerens afgørelse.** Fundets præmis er forkert. Skadelidte kan ikke både have en arbejdsulykke og
en erhvervssygdom. Skadestypen er en *deskriptiv* angivelse af den skade, beregningen vedrører — «lidt
som at svare på, om et barn er en pige eller en dreng, og derudover spørge til dets fødselsdato».
Datoen er den samme sagsdato under begge navne; feltet hedder blot skadedato eller anmeldelsesdato
afhængigt af typen. Ingen advarsel, ingen rydning. Programmet er korrekt som det er.

**Agentens efterprøvning — én korrektion.** Sætningen «der er ingen forskelle i programmets adfærd»
holder ikke ved en måling. Skadestypen styrer i dag tre ting ud over navnet:

1. **Den nedre datogrænse på hele Erstatningsopgørelsen.** `computeSkadedatoMinRule`
   ([dateRanges.ts:168-192](../../../src/config/dateRanges.ts#L168-L192)) sætter EO-datofelternes gulv til
   *skadedatoen* ved Arbejdsulykke, men til *anmeldelsesdatoen minus 5 år* ved Erhvervssygdom. Skiftes
   typen med datoen stående, flytter gulvet sig altså fem år — og skiftes den tilbage, kan EO-datoer,
   brugeren allerede har indtastet, blive røde uden at han har rørt dem.
2. **Særreglerne for svie/smerte- og TAF-perioder**, der udtrykkeligt tillader datoer før
   anmeldelsesdatoen i erhvervssygdomssager (`erErhvervssygdom` i `eoPeriodeBlockingContext.ts`).
3. **Dokumenternes ordlyd** — `eoPresentationModel.ts` skriver «Erhvervssygdom anmeldt den …».

**Brugerens svar på korrektionen (2026-08-16).** Forholdet var glemt, men afgørelsen står ved magt:
skiftet mellem skadestyperne må fortsat ske tavst. Har brugeren fx sat Erhvervssygdom og angivet en
svie-/smertedato før skadesdatoen, og ændres skadestypen derefter, skal selve skiftet **ikke** give en
orientering. Brugeren orienteres i stedet gennem den afledte konsekvens: svie-/smerteperiodens
startdato bliver rød med beskeden om, at datoen ligger før skadedatoen. Det er tilstrækkeligt.

**Agentens efterprøvning af, at den afledte orientering faktisk kommer.** Den holder strukturelt:
datofelternes grænser læses på valideringstidspunktet fra den canonical view (`dateBoundsValidator`),
og issues er rene projektioner uden en skrivbar store (`error-contract.md` §2). Ændres skadestypen,
genudledes svie-/smertefeltets nedre grænse derfor i samme øjeblik, og feltet bærer et `bounds`-issue
med konkret tooltip. Kombineret med BB-002-rettelsen vil beskeden samtidig navngive datoen korrekt
efter den nye skadestype. **Ikke afprøvet i browseren** — noteret som dækningshul.

Konsekvensen er dermed accepteret og lukket: ingen advarsel ved skiftet, ingen rydning, ingen
kodeændring.

**Til kontrakt, når BB-002-rettelsen alligevel åbner den:** at datoen bevidst bevares ved skift af
skadestype, og at det er en truffet beslutning frem for en overset adfærd. Hører sammen med den
kontekstuelle navneregel (`ContextualLabelRule` i `fieldDescriptor.ts`). Stamdatas felter er endnu ikke
omfattet af `input-field-behavior-contract.md` (§6), så tilføjelsen er en ny feltsektion dér — ikke en
rettelse i en eksisterende.

### BB-002 — Fejlbeskeder kalder feltet «Skadedato», når det på skærmen hedder «Anmeldelsesdato»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02-beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Høj
- **Beslutning:** **Accepteret af brugeren 2026-08-16** — skal rettes; ordlyden forelægges
- **Sådan fremprovokeres det:**
  1. Vælg Skadestype = «Erhvervssygdom». Datofeltet hedder nu «Anmeldelsesdato».
  2. Skriv `01-06-2020` i Anmeldelsesdato.
  3. Skriv `01-06-2021` i Fødselsdato.
- **Det sker:** Begge felter bliver røde. Tooltip på Fødselsdato: «Fødselsdato kan ikke være efter
  **skadedatoen** (01-06-2020)». Tooltip på Anmeldelsesdato: «**Skadedato** kan ikke være før
  fødselsdatoen (01-06-2021)».
- **Det er uhensigtsmæssigt fordi:** Brugeren bliver bedt om at rette et felt, der ikke findes på
  skærmen. Den anden besked navngiver oven i købet det felt, den selv sidder på, med et forkert
  navn. Det er præcis den fejlmåde, feltets kontekstuelle navn blev indført for at fjerne — navnet
  følger med i den synlige label, men de to beskeder har feltnavnet skrevet ind i teksten.
  Sammenlign også de to ord: den ene besked siger «skadedatoen», en anden besked i samme familie
  siger «skadesdagen».
- **Bedre ville være:** At beskederne henter feltets navn fra feltet selv, som labelen gør, så de
  siger «Anmeldelsesdato», når det er det, feltet hedder — og at der vælges ét ord for begrebet
  overalt.
- **Andre steder det kan gælde:** `src/utils/dateRangeErrorMessages.ts` linje 118 og 139 (de to
  ovenstående), samt beskeden «Datoen kan ikke være før skadesdagen (…)», som bruges af mindst seks
  erklæringssteder på Erhvervsevnetab, Varige mén og i den fælles `dateRanges`-hjælper. Alle siger
  «skade», også når sagen er en erhvervssygdom. Den umulige-interval-besked på de to Stamdata-felter
  bærer teksten «Grænserne kommer fra Fødselsdato og Skadedato» med samme problem — den er dog i
  praksis uopnåelig her, da intervallet ikke kan blive umuligt.

**Brugerens afgørelse.** Navngivningen i fejlmeddelelserne skal følge den til enhver tid værende værdi
i skadestype-feltet: står den på Erhvervssygdom, skal **al** tekst om datoen konsekvent kalde den
anmeldelsesdatoen — ellers skadedatoen. Reglen gælder hele programmet, ikke kun Stamdata.

**Agentens bemærkning til ordlyden.** Brugerens eksempler under BB-010 skriver «skadesdato» med
binde-s. Feltet hedder «Skadedato» uden s, og §3.2a-reglen er netop, at beskeden bruger feltets eget
navn. Forslaget nedenfor bruger derfor konsekvent **skadedatoen** / **anmeldelsesdatoen** og afskaffer
samtidig den tredje variant, «skadesdagen». Vælger brugeren i stedet «skadesdato» som prosaform, skal
selve feltlabelen ændres tilsvarende — de to må ikke sige hver sit.

**Forslag til implementering**

1. **Ét navneopslag, ikke syv.** `resolveSkadeEllerAnmeldelsesdatoReference` findes allerede
   ([eoDateReferenceText.ts:25-32](../../../src/domain/erstatningsopgoerelse/helpers/eoDateReferenceText.ts#L25-L32))
   og giver både `label` («Skadedato»/«Anmeldelsesdato») og den bøjede `labelLower`
   («skadedatoen»/«anmeldelsesdatoen») — begge afledt af `resolveSkadestypeDatoLabel`, som er feltets
   ene navneautoritet. Den skal flyttes ned til `src/domain/policies/stamdataCalculations.ts` (samme
   modul som navneautoriteten, og det modul `inputCore/catalog` allerede må importere fra) og
   re-eksporteres fra EO-helperen, så EO's kaldssteder er urørte.
2. **Beskederne tager navnet som data.** Udvid `DateRangeSpecialErrors` med
   `skadedatoNavn?: Readonly<{ label: string; labelLower: string }>`, og brug det i de tre tekster i
   [dateRangeErrorMessages.ts](../../../src/utils/dateRangeErrorMessages.ts): linje 97
   («før skadesdagen» → «før ${labelLower}»), linje 118 og linje 139 (se BB-010 for den nye ordlyd).
   Uden navnet falder teksten tilbage til «Skadedato»/«skadedatoen», så en glemt udfylder giver den
   hidtidige tekst frem for en tom streng.
3. **Ét fabriksted, så et nyt felt ikke kan glemme navnet.** De syv steder, der i dag skriver
   `minBoundKind: 'skadedato'`/`maxBoundKind: 'skadedato'` i hånden (`varigeMenDescriptors.ts:24`,
   `erhvervsevnetabDescriptors.ts:284/292/302/311`, `stamdataDescriptors.ts:74`, `dateRanges.ts:180`)
   erstattes af én hjælper i `dateBoundsValidators.ts`, fx
   `skadedatoBound(context, referenceISO)`, som selv læser `stamdataSkadestypeField` fra
   `context.view` og fylder både `minBoundKind`, `minBoundReferenceISO` og `skadedatoNavn`. Samme
   struktur som `originWhenNarrowed`: reglen er data, ikke gentaget kode.
4. **Den umulige-interval-tekst.** `derivedDateBounds('Fødselsdato og Skadedato')` i
   `stamdataDescriptors.ts` gøres kontekstuel — `origin` accepterer allerede en funktion af konteksten
   (`DateBoundsOriginSpec`), så det er en ren udskiftning af den faste streng med det opslåede `label`.
5. **De to øvrige prosasteder** med samme fejlmåde: `eetAslAfgoerelser.ts:303` («Der er indtastet en
   … før skadedatoen») og `eetEalCalculation.ts:279` («Beregningsdatoen ligger før skadedatoen»).
   Begge skal have skadestypen med i deres kontekst; har de den ikke i dag, er det den egentlige
   opgave i punktet.
6. **Værn.** En tekstregel er ikke nok — den skal måles. Et guard i
   `src/__tests__/quality/` skal fejle, hvis et brugervendt strengliteral i produktionskoden
   indeholder «skadedato», «skadesdag» eller «anmeldelsesdato» uden for
   `domain/policies/stamdataCalculations.ts`. Mutationstest i tre trin efter husreglen: (a) indsæt et
   literal i et andet modul → skal blive rødt; (b) fjern navneautoritetens eksport → skal blive rødt
   (grøn af tomhed); (c) skift skadestype i en testfixture → beskeden skal skifte ord, så testen
   måler navnemekanikken og ikke bare en ordliste.
7. **Kontrakt (sammen med rettelsen).** `error-contract.md` §3 «Feltidentitet og beskeder» udvides
   med, at et felts kontekstuelle navn også binder beskeder på *andre* sider, og
   `input-field-behavior-contract.md`'s stamdataafsnit får den nye ordlyd. Begge med opdateret
   verifikationsstempel, når koden er rettet og målt.

### BB-003 — En dato tastet som seks cifre bliver til «01» — den samme tekst indsat virker

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-03-tastning-og-indsættelse-accepterer-ikke-det-samme`
- **Prioritet:** Høj
- **Beslutning:** **Afvist af brugeren 2026-08-16** — forskellen mellem tastning og indsættelse er tilsigtet
- **Sådan fremprovokeres det:**
  1. Klik i Skadedato og tast `010623` uden bindestreger.
  2. Tryk Enter.
- **Det sker:** Kun `01` når ind i feltet. Ciffer nummer tre og frem forsvinder, mens brugeren
  taster — uden lyd, farve eller besked. Ved Enter står feltet med den afviste tekst `01`, rød ring
  og tooltippet «Fejl i indtastning». Måling pr. tastetryk: `0→0`, `1→01`, `0→01`, `6→01`, `5→01`,
  `6→01`.
  Indsættes præcis samme tekst `010623` i samme felt med Ctrl+V, bliver den derimod til
  `01-06-2023`.
- **Det er uhensigtsmæssigt fordi:** Programmet kan udmærket læse en dato uden separatorer — det
  beviser indsættelsen — men nægter at tage imod den, når brugeren taster den. `ddmmåå` er den
  hurtige indtastningsform, mange sagsbehandlingssystemer bruger, og en bruger, der har vænnet sig
  til den, får en rød fejl på noget, han skrev korrekt. Værst er tavsheden: tegnene forsvinder,
  mens han skriver, så han opdager først problemet, når feltet bliver rødt, og fejlteksten («Fejl i
  indtastning») fortæller ham ikke, at det var indtastningsformen, der var problemet.
- **Bedre ville være:** At tastning tillader den samme cifferform, indsættelse allerede tillader —
  gerne med automatisk indsatte bindestreger undervejs (`01-06-23`), så brugeren kan se, hvordan
  datoen bliver læst, mens han skriver.
- **Andre steder det kan gælde:** Alle programmets datofelter. Reglen er ét delt prædikat
  (`isDateLikeDraftAllowed` med segmenterne 2-2-4), som bruges af `DateField`, gridcellerne og
  overlay-datofeltet; der er 23 datofelter fordelt på otte descriptorfiler. Uge- og årsfelterne har
  tilsvarende segmentregler og skal efterprøves på samme måde.

**Brugerens afgørelse.** Den nuværende opsætning er valgt bevidst. Et datofelt, der begynder at tolke
på det tredje indtastede ciffer, giver anledning til fejl og usikkerhed: skriver brugeren `11`, kan det
både være den 11. i en måned og den 1. januar. Når brugeren derimod *indsætter* en værdi, der
uomtvisteligt kan opløses til én sikker dato, er det mest brugervenlige, at programmet også gør det —
og ikke afkorter efter andet ciffer. Forskellen mellem de to veje er derfor tilsigtet og bevares.

**Agentens efterprøvning — præmissen holder.** Ambivalensen er reel og kan vises konkret: taster
brugeren `1` og `6`, kan det være den 16. eller den 1. juni, og programmet accepterer i dag begge veje
(`1.6.1956` er gyldig tastning). En automatisk bindestreg efter andet ciffer ville låse den fortolkning
fast på det tidligste tidspunkt, hvor den er mest usikker, og ville samtidig ødelægge den
enkeltcifrede indtastningsform, feltet i dag understøtter. Indsættelse har ikke problemet, fordi hele
teksten er kendt på én gang. Restforholdet — at `010623` ender som `01` med rød ring og den generiske
tekst «Fejl i indtastning» — er i overensstemmelse med den vedtagne regel om, at ren formfejl får
generisk tekst (se `project_field_tooltip_vs_error_box`), og ændres ikke.

**Ingen kodeændring.** Kontraktens §2.1 beskriver allerede segmentreglen; den kan ved en senere
kontraktrevision få begrundelsen med, så beslutningen ikke genåbnes af den næste, der undrer sig.

### BB-004 — Lange værdier forkortes lydløst ved 60 tegn, og de to initialfelter viser kun 6

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-04-lydløs-afkortning-ved-længdegrænse`
- **Prioritet:** Mellem
- **Beslutning:** **Afgjort af brugeren 2026-08-16.** Princippet er allerede den gældende, målte
  adfærd; de to initialfelter skal derimod have en grænse på **6 tegn** i stedet for 60
- **Sådan fremprovokeres det:**
  1. Indsæt `Advokatfirmaet Jensen og Partnere I/S, Att. Line Bruun Madsen` i feltet «Advokat».
  2. Tryk Tab.
- **Det sker:** Værdien gemmes som `Advokatfirmaet Jensen og Partnere I/S, Att. Line Bruun Madse` —
  det sidste `n` er væk. Der er ingen besked og ingen rød markering. Feltet er 80 px bredt med ca.
  52 px synligt indhold, så brugeren ser `Advoka`; indholdet er 461 px bredt. Der er ingen tooltip
  med den fulde værdi, og teksten er centreret, så det er ikke engang tydeligt, at der mangler
  noget i begge ender.
- **Det er uhensigtsmæssigt fordi:** Brugeren mister et tegn uden at få det at vide, og han kan
  bagefter ikke se, hvad der står i feltet, uden at klikke ind og pile igennem. En værdi, han ikke
  kan læse, kan han heller ikke kontrollere — og den går videre i dokumenternes brevhoved.
  Dertil kommer et misforhold: feltet hedder «Advokat/Sagsbehandler», har pladsholderen «(init.)»
  og er tegnet til tre-fire tegn, men tager imod 60.
- **Bedre ville være:** (a) at feltet enten viser hele værdien (tooltip ved hover eller et bredere
  felt), og (b) at afkortningen ikke sker i tavshed — enten ved at afvise resten synligt eller ved
  en kort besked om, at værdien blev forkortet. Om de to initialfelter skal have en lavere grænse
  end 60 tegn, er et selvstændigt UI/UX-valg.
- **Andre steder det kan gælde:** Alle korte tekstfelter deler grænsen på 60 tegn
  (`SHORT_TEXT_MAX_LENGTH`), og de flerlinjede kommentarfelter har 512. Adfærden ved overskridelse
  er den samme overalt.

**Brugerens afgørelse.** Det er en fejl, hvis et felt tager imod flere tegn end tilladt og derefter
afkorter tavst. Den korrekte adfærd er en effektiv blokering, så brugeren afskæres fra at indtaste
flere tegn end feltets grænse — og det bør universelt gælde alle felttyper i hele programmet, hvor der
er en grænse for antal tegn eller cifre.

**Agentens efterprøvning — reglen er allerede indført, og målt.** Det ønskede princip er ordret
`input-field-behavior-contract.md` §1.2, som blev gjort til hovedregel 2026-08-09 og håndhævet
2026-08-15:

- **Tastning blokeres.** Værnet ligger på `onDraftChange` — den ene kanal, enhver modalitet passerer
  ([useFormFieldSurface.ts:171-182](../../../src/inputCore/react/useFormFieldSurface.ts#L171-L182)) — og
  gentages som `<input maxLength>`. Tegn nummer 61 kommer aldrig ind i feltet.
- **Grænsen er påkrævet i typen.** `createTextFieldCodec`/`createOptionalTextFieldCodec` kaster uden
  `maxLength`, og `resolveDraftLengthLimit` kaster for enhver tastet feltfamilie uden erklæring, så en
  ny descriptor uden grænse ikke kan kompilere eller køre.
- **Adfærden måles pr. felt.** `src/__tests__/inputCore/fieldCharLengthPolicy.test.ts` går hele
  produktionskataloget igennem. Målingen forud fandt 28 af 31 tekstfelter og 8 af 12 heltalsfelter helt
  uden grænse — det hul er lukket.

Det, fundet observerede, var derfor ikke en manglende blokering, men **paste**: en indsat tekst på 61
tegn splices ind, indtil grænsen er nået, og resten springes over. Det er §1.2a's regel «paste
behandles som tastning», som brugeren tiltrådte 2026-08-09 — og som blev valgt netop for at undgå, at
et paste enten smider hele indsættelsen væk eller kommer forbi en grænse, tastning håndhæver. Skal
paste i stedet afvises *helt*, når teksten er for lang, er det en ændring af den beslutning og ikke en
fejlrettelse; agenten fraråder den, fordi brugeren så mister også den del af værdien, der kunne bruges.

**Brugerens afgørelse om grænsen (2026-08-16).** De to felter er initialfelter og skal have plads til
**færre tegn end et normalt tekstfelt**: antallet af tilladte tegn skal svare til det synlige indhold i
felterne — **6 tegn**, både ved tastning og ved indsættelse.

**Brugerens afgørelse om læsbarheden.** Spørgsmålet bortfalder for disse to felter, når grænsen er 6
tegn: der er da ikke noget skjult indhold at læse. Agenten er enig — og har efterprøvet, at det også
gælder Stamdatas to øvrige tekstfelter, hvor feltbredden er rigelig i forhold til den tekst, en bruger
reelt skriver («Skadelidtes navn» 350 px, «Journalnr.» 220 px). Spørgsmålet er derfor **lukket for
Stamdata**. Det efterprøves i stedet dér, hvor et 60-tegns-felt faktisk er smalt — EO's bilagsnumre og
smalle tabelceller — og er noteret i `TVAERGAAENDE.md` M-04.

**Note til brugerens erindring:** grænsen har ikke tidligere været 6. En gennemsøgning af hele
historikken finder ingen længdegrænse på de to felter før 2026-08-15, hvor de fik kategoriens 60 tegn
sammen med de øvrige tekstfelter (`93b21494`). Det ændrer intet ved afgørelsen.

**Forslag til implementering**

1. **En ny kategori, ikke et tal på kaldsstedet.** I
   [fieldLengthLimits.ts](../../../src/inputCore/catalog/fieldLengthLimits.ts) tilføjes
   `INITIALER_MAX_LENGTH = 6` med samme docblock-form som de øvrige: hvad kategorien dækker, og hvorfor
   tallet er 6 (feltets synlige indhold). Modulets egen begrundelse er netop, at et nyt felt skal vælge
   en **kategori** frem for et tal, så to felter med samme rolle ikke kan drifte fra hinanden.
2. **To descriptorer skifter kategori.** `stamdataAdvokatField` og `stamdataSagsbehandlerField` i
   [stamdataDescriptors.ts](../../../src/inputCore/catalog/stamdataDescriptors.ts) skal bruge den nye
   konstant i stedet for `SHORT_TEXT_MAX_LENGTH`. Den fælles `textField`-hjælper i filen skal derfor
   tage længden som parameter — de øvrige tre stamdatafelter beholder de 60.
3. **Ingen ændring af mekanikken.** Både tastning og indsættelse er allerede dækket af den ene vej
   codec → `resolveTextCharPolicy` → `<input maxLength>` + paste-splice. Grænsen ændres ét sted og
   virker begge steder; `fieldCharLengthPolicy.test.ts` måler automatisk det nye tal for begge felter.
4. **Konsekvens, der skal siges højt:** kontraktens §1.2 punkt 4 afgrænser reglen til det, brugeren
   selv skriver. En sag gemt med et længere navn i et af felterne beholder derfor sin værdi ved
   `.eo`-load, indtil brugeren selv retter feltet — der sker ingen tavs afkortning af gemte data.
   Alternativet (afkortning ved load) ville være datatab og fravælges.
5. **Kontrakt (sammen med rettelsen).** `input-field-behavior-contract.md` §2.5 «Frie tekstfelter»
   bærer i dag kategorien på 60 tegn som den brugergodkendte værdi; den skal have initialkategorien med
   og navngive de to felter, den gælder for.

### BB-005 — Ingen rimelighedskontrol af alder: en 2-årig med erhvervssygdom går glat igennem

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05-ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Mellem
- **Beslutning:** **Afvist af brugeren 2026-08-16** — der skal ikke være nogen nedre aldersgrænse
- **Sådan fremprovokeres det:**
  1. Fødselsdato = `01-06-2021`.
  2. Skadestype = «Erhvervssygdom», Anmeldelsesdato = `01-06-2023`.
- **Det sker:** Ingenting. Begge felter er grønne. Sagen fortsætter med en skadelidt, der var to år
  gammel på anmeldelsestidspunktet.
- **Det er uhensigtsmæssigt fordi:** De to felters indbyrdes kontrol stopper kun det logisk umulige
  (født efter skaden). Alt derimellem er tilladt, selv når det er åbenlyst forkert. Fødselsdatoen
  driver aldersafhængige beregninger længere fremme — kapitalisering, pensionsalder, forsørgertab —
  så en tastefejl i årstallet giver forkerte tal langt fra det sted, fejlen blev begået, og uden at
  noget undervejs undrer sig. Den nedre grænse (1900) og den øvre (dags dato) er så vide, at de i
  praksis kun fanger et forkert århundrede.
- **Bedre ville være:** En gul, ikke-blokerende feltadvarsel, når alderen på skadetidspunktet ligger
  uden for et realistisk arbejdsliv — fx under 13 eller over 100 år. Formen findes allerede i
  programmet (méngrad på 5 %, EET-procenter under 15 %), så adfærden ville være genkendelig.
  Grænserne er brugerens beslutning.
- **Andre steder det kan gælde:** Samme spørgsmål gælder ethvert felt, hvis grænse er sat vidt for
  ikke at opfinde en regel: beløb, procenter og datoer langt fra sagens øvrige datoer.

**Brugerens afgørelse.** Programmet skal ikke have nogen nedre aldersgrænse — heller ikke som gul
advarsel. Det skal kunne håndtere, at et nyfødt barn har taget skade, fordi forælderen har været udsat
for en arbejdsskade, og at små børn kommer til skade i fx trafikuheld. En 2-årig skadelidt er derfor
ikke et usandsynligt input, men et rigtigt et.

**Agentens efterprøvning.** Der findes i dag ingen aldersgrænse noget sted i koden: fødselsdatoens
eneste grænser er 01-01-1900 og dags dato (`dateRanges_skadelidteFodselsdato`), og hverken
`varigeMenCalculations`, `eetEalCalculation` eller forsørgertab afviser eller advarer ved lave aldre.
Afgørelsen bevarer altså den nuværende tilstand fuldt ud, og fundets forslag bortfalder. Det tilhørende
mønster M-05 gælder fortsat for *andre* felttyper, men aldersspørgsmålet er lukket.

**Ingen kodeændring.** Beslutningen er værd at have skrevet ned netop fordi den ligner en mangel: den
næste, der ser en 2-årig med erhvervssygdom gå igennem uden signal, skal kunne se, at det er tilsigtet.

### BB-006 — Stamdata fortæller ikke, hvad resten af programmet har brug for

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **Afvist af brugeren 2026-08-16** — og hævet til et bærende princip for hele programmet
- **Sådan fremprovokeres det:**
  1. Åbn Stamdata på en tom sag.
  2. Udfyld journalnr. og navn. Lad Skadestype og Skadedato stå tomme.
  3. Gå til en beregningsside.
- **Det sker:** Stamdata ser komplet ud — ingen markeringer, ingen tomme-felt-signaler, ingen
  «Fejl og advarsler»-boks. Først på den næste side møder brugeren en blokering, som henviser ham
  tilbage.
- **Det er uhensigtsmæssigt fordi:** Stamdata er den side, der bærer resten af programmet, men den
  eneste side, der aldrig siger noget. Brugeren forlader den i den tro, at han er færdig, og bliver
  standset et andet sted af noget, han skulle have gjort her. At blive sendt tilbage er dyrere end
  at få det at vide med det samme — særligt fordi skadedatoen samtidig fastlægger grænserne for de
  datoer, han lige har siddet og tastet på den anden side.
- **Bedre ville være:** At Stamdata selv viser, hvad der mangler, og hvad det bruges til — fx en
  diskret markering af de felter, resten af programmet forudsætter (skadestype og skadedato), eller
  en kort linje i «Skadelidte»-boksen om, at de to felter er forudsætning for beregningerne. Det
  behøver ikke blokere noget; det skal bare siges på det sted, hvor det kan handles på.
- **Andre steder det kan gælde:** Ingen — men det modsatte spørgsmål er relevant på hver eneste
  senere flade: peger blokeringen konkret tilbage på det felt her, der mangler?

**Brugerens afgørelse — et princip, ikke bare et nej.** Stamdata skal ikke give fejlmeddelelser eller
oplysninger om manglende indtastninger. Stamdatas felter er kun relevante i *visse*
beregningssituationer, og brugeren bruger langtfra altid alle beregningstyper: renteberegning er fx
uafhængig af skadelidtes stamdata, og det ville være direkte forkert, hvis Stamdata i det tilfælde
meldte, at noget manglede. **Alle fejl og advarsler om manglende indtastninger hører derfor hjemme på
den side, hvor oplysningen faktisk mangler og skal bruges i en konkret beregning.**

**Agentens efterprøvning.** Princippet er præcis det, koden gør i dag, og det er den rigtige læsning af
det, fundet observerede: tavsheden på Stamdata er ikke en manglende feedback, men fraværet af en falsk
en. Modstykket findes allerede: fagsiderne viser «Mangler (angiv i Stamdata)» med et link, der både
navigerer og markerer det manglende felt (`MenberegningTab.tsx`), og forsørgertab klassificerer
manglende forudsætninger og linker til Stamdata (BF-011). Bemærk afgrænsningen: princippet gælder
*manglende* indtastninger. En *forkert* indtastning — fx en fødselsdato efter skadedatoen — bliver
fortsat markeret på Stamdata, jf. BB-010, fordi fejlen dér er opstået af det, brugeren faktisk skrev.

**Skrevet i kontrakt 2026-08-16:** princippet står nu som `error-contract.md` §3.1 «Hvor en manglende
forudsætning meldes», sammen med afgrænsningen mod `invalid` og med BB-010's regel om, at begge parter
i en brudt parvis grænse markeres. Det kunne skrives ind med det samme, fordi koden allerede opfylder
påstanden — stemplet er dermed sandt uden en forudgående kodeændring. Kontraktens liveness- og
isolationsværn er kørt grønne efter tilføjelsen.

### BB-007 — Indsat tekst fra Word/Excel beholder usynlige tegn, og linjeskift forsvinder uden erstatning

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-06-usynlige-tegn-overlever-fra-indsættelse`
- **Prioritet:** Lav
- **Beslutning:** **Accepteret af brugeren 2026-08-16** — med udtrykkeligt krav om, at normaliseringen
  ikke må forstyrre de øvrige normaliseringer
- **Sådan fremprovokeres det:**
  1. Kopiér `Sag 2024-<hårdt mellemrum>117<tabulator>/` og på næste linje `Afd. 3` fra et
     Word-dokument.
  2. Indsæt i Journalnr. og tryk Tab.
- **Det sker:** Værdien gemmes som `Sag 2024- 117\t/Afd. 3` — det hårde mellemrum (U+00A0) og
  tabulatortegnet (U+0009) står stadig i værdien, og linjeskiftet er fjernet, så `/` og `Afd.` er
  klistret sammen uden mellemrum. Alt sker uden besked.
- **Det er uhensigtsmæssigt fordi:** Brugeren ser noget, der ligner mellemrum, men er andre tegn.
  Værdien går videre i dokumenternes brevhoved, og et journalnummer med usynlige tegn kan hverken
  søges frem eller sammenlignes pålideligt. Sammenkædningen af to linjer uden mellemrum ændrer
  desuden teksten synligt uden nogen markering.
- **Bedre ville være:** At indsat tekst i korte tekstfelter normaliseres — hårde mellemrum bliver
  til almindelige, tabulator og linjeskift bliver til ét mellemrum, og gentagne mellemrum trykkes
  sammen.
- **Andre steder det kan gælde:** Alle fritekstfelter. Tal-, dato- og procentfelterne har allerede
  hver sin indsættelses-normalisering; tekstfelterne har ingen.

**Brugerens afgørelse.** Der skal laves en forsvarlig normalisering af indsat tekst. Den må ikke give
problemer med de øvrige normaliseringer, fx en indsat dato i et datofelt. Det er i orden, at
normaliseringen kører først, så længe det kan sikres, at den ikke giver problemer længere nede i kæden.

**Agentens efterprøvning af rækkefølgen — den er sikker, og det kan bevises.** De øvrige familier tager
ikke skade af et tidligere trin, fordi ingen af dem læser mellemrumstegn som betydningsbærende:

- **Dato** (`normalizeDatePaste`) arbejder på `text.match(/[0-9]+/g)` — ciffergrupper. Hvad der står
  imellem dem, er allerede uden betydning.
- **Beløb, procent, heltal, brøk** filtrerer tegn for tegn mod feltets draft-prædikat
  (`filterPasteCharacters`). Både hårdt og almindeligt mellemrum afvises af prædikatet, så udfaldet er
  det samme før og efter. Excel-kopieret `1 234,56` med hårdt mellemrum bliver `1234,56` i begge
  tilfælde.
- **Uge og år** udtrækker cifre fra første ciffer og frem.

Normaliseringen er altså et **no-op for alle ikke-tekstfamilier** — og præcis dét skal måles, ikke
antages.

**Forslag til implementering**

1. **Én delt normalisering.** `normalizeClipboardText(raw, { multiline })` i
   `src/utils/inputPasteNormalization.ts`, ved siden af de familiespecifikke:
   `\r\n`/`\r` → `\n`; U+00A0, U+202F, U+2007 og U+2000–U+200A → almindeligt mellemrum; U+200B,
   U+FEFF og U+00AD fjernes; tabulator → mellemrum. **Enkeltlinjefelter** omsætter desuden `\n` til ét
   mellemrum (så `/` og `Afd.` ikke klistrer sammen); **flerlinjede** bevarer `\n`. Gentagne
   mellemrum trykkes sammen til ét. Der trimmes ikke i enderne — det gør `parseForSettle` allerede,
   og en trimning her ville ødelægge en indsættelse midt i en eksisterende draft.
2. **Hvor den kører.** I `normalizePasteForDraft`
   ([pasteSplice.ts:12-16](../../../src/inputCore/react/pasteSplice.ts#L12-L16)), som **altid** —
   både ved lukket paste og ved splice ind i en åben draft. Bemærk forskellen fra codec'ets egen
   `normalizePaste`, som med vilje kun kører fra en tom draft; den betingelse er der, fordi
   familiespecifik normalisering kan flytte separatorer og fortegn. Tegnnormalisering har ikke den
   egenskab og skal derfor ikke arve betingelsen. Da både formular- og gridfladen går gennem denne ene
   funktion, dækkes begge flader af én ændring.
3. **`multiline` udledes af feltet, ikke af kaldsstedet.** `MultilineTextField` er den eneste flade,
   der bevarer linjeskift (`settleOnEnter: false`,
   [MultilineTextField.tsx:41](../../../src/inputCore/react/fields/MultilineTextField.tsx#L41)).
   Flaget hører derfor på codec'et — fx `preservesLineBreaks: true` på kommentarfelternes codec —
   efter samme begrundelse som `maxLength` og `signPolicy`: kan to flader konfigurere samme regel hver
   for sig, gør de det forskelligt.
4. **Værn (tre trin, jf. husreglen for guards).** (a) Fixtures: hårdt mellemrum, tabulator, linjeskift
   og nulbredde-tegn i et kort tekstfelt og i et kommentarfelt. (b) Levende kilde: en
   ækvivalenstest, der for **hver** ikke-tekstfamilie kører et repræsentativt paste gennem
   `normalizePaste` med og uden det nye trin og kræver byte-identisk resultat — den er den egentlige
   sikring af brugerens forbehold, og den bliver rød, hvis en fremtidig familie begynder at læse
   mellemrum. (c) Skelnetest: en indsættelse, hvor kun linjeskiftsreglen adskiller enkeltlinje fra
   flerlinje, så testen ikke kan bestå på den forkerte mekanisme.
5. **Bevidst udenfor:** værdier fra `.eo`-load og programmatiske skrivninger normaliseres ikke —
   §1.2's afgrænsning er, at reglen kun gælder det, brugeren selv skriver eller indsætter. En
   alternativ placering i tekstcodec'ets `parseForSettle` ville også ramme indlæste værdier og
   fravælges derfor.
6. **Kontrakt (sammen med rettelsen).** `input-field-behavior-contract.md` §1.2a får et punkt om, at
   indsat tekst tegnnormaliseres før feltets egen paste-behandling, og at normaliseringen pr.
   definition er uden virkning for de familier, der filtrerer på tegnsæt.

### BB-008 — «Advokat/Sagsbehandler»: to ens felter, hvor kun rækkefølgen fortæller, hvad der er hvad

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **Afvist af brugeren 2026-08-16** — ikke et faktisk problem
- **Sådan fremprovokeres det:** Åbn Stamdata og se på rækken «Advokat/Sagsbehandler».
- **Det sker:** To lige store felter adskilt af en skråstreg, begge med pladsholderen «(init.)».
  Feltets rigtige navn findes kun som skjult skærmlæser-etiket.
- **Det er uhensigtsmæssigt fordi:** Brugeren skal selv koble den sammensatte etiket til de to
  felter i den rigtige rækkefølge. Det er en lille ting hver gang, men den skal gøres hver gang, og
  en ombytning opdages ikke: begge værdier er lovlige, og de vises samme sted i dokumenterne.
- **Bedre ville være:** Forskellige pladsholdere («(adv.)» / «(sagsb.)») eller en lille etiket under
  hvert felt.
- **Andre steder det kan gælde:** Enhver række, hvor én etiket dækker flere felter.

**Brugerens afgørelse.** Fundet afvises; det er ikke et faktisk problem. Ingen kodeændring.
Bemærk, at feltbredden og læsbarheden af de samme to felter fortsat er i spil under BB-004's åbne
spørgsmål — det er en anden sag end etiketten.

### BB-009 — Fødselsår 1927-1931 kan ikke skrives med to cifre, og fejlen forklarer ikke hvorfor

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05-ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Lav
- **Beslutning:** **Afvist af brugeren 2026-08-16** — den nuværende tilstand accepteres
- **Sådan fremprovokeres det:** Skriv `01-06-29` i Fødselsdato på en sag uden skadedato.
- **Det sker:** Feltet viser `01-06-2029` og bliver rødt med teksten «Datoen er efter dags dato
  (16-08-2026)». Til sammenligning bliver `01-06-32` korrekt til `01-06-1932`.
- **Det er uhensigtsmæssigt fordi:** Tocifrede årstal fortolkes efter et femårsvindue omkring
  indeværende år, hvilket er rigtigt for de fleste datofelter — men et *fødselsår* ligger næsten
  altid i fortiden. Konsekvensen er, at årene 1927-1931 ikke kan skrives med to cifre, og at
  fejlbeskeden taler om dags dato i stedet for om det, der faktisk skete: at `29` blev læst som
  2029. Brugeren får ingen anledning til at prøve `1929`.
- **Bedre ville være:** Enten at fødselsdatofeltet fortolker tocifrede årstal bagudrettet (aldrig
  frem i tiden), eller at beskeden nævner fortolkningen: «`29` er læst som 2029, som ligger efter
  dags dato. Skriv årstallet med fire cifre.»
- **Andre steder det kan gælde:** Fødselsdatofeltet findes også på Erhvervsevnetab. De øvrige
  datofelter er fremadrettede og har ikke problemet.

**Brugerens afgørelse.** Den nuværende tilstand accepteres. Der skal være **én gennemgående regel** for,
hvordan et tocifret årstal omsættes til fire cifre, og det er mest intuitivt og mest i tråd med
programmets øvrige indtastninger, at 27-31 læses som 2027-2031. Fødselsdatofeltet skal altså ikke have
sin egen bagudrettede regel.

**Agentens efterprøvning.** Reglen er nøjagtig den, koden har i dag: `interpretYear`
([dateInputValidation.ts:34-57](../../../src/utils/dateInputValidation.ts#L34-L57)) læser et tocifret
årstal som 20xx, indtil det ligger mere end fem år efter indeværende kalenderår, og ellers som 19xx —
i 2026 altså 00-31 → 2000-2031, og 32-99 → 1932-1999. Pivoten følger kalenderåret og er allerede
markeret som en låst designbeslutning i koden; i 2027 rykker grænsen til 32. Konsekvensen — at
fødselsårene 1927-1931 skal skrives med fire cifre — er dermed accepteret. Ingen kodeændring, og
fundets forslag om en særregel for fødselsdato bortfalder.

### BB-010 — Én forkert dato gør to felter røde, og det ubesvarede spørgsmål er, hvilket der er forkert

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-07-parvise-grænser-markerer-begge-parter`
- **Prioritet:** Lav
- **Beslutning:** **Afvist af brugeren 2026-08-16 for markeringen; ordlyden skal derimod rettes**
- **Sådan fremprovokeres det:** Udfyld Skadedato korrekt, og skriv derefter en fødselsdato, der
  ligger efter den.
- **Det sker:** Begge felter bliver røde med hver sin tooltip, selv om brugeren kun har rørt det ene.
- **Det er uhensigtsmæssigt fordi:** Der er ikke noget forkert ved den dato, brugeren indtastede for
  fem minutter siden — kombinationen er forkert. Når begge markeres ens, må brugeren selv gætte,
  hvilket felt han skal rette, og en rød ring på et felt, han ikke har rørt, ligner en fejl, han har
  begået.
- **Bedre ville være:** Enten at markere det senest ændrede felt som det, der bryder forholdet, og
  lade det andet være — eller at beholde begge markeringer, men gøre det tydeligt, at det er
  *forholdet* mellem dem, der er problemet.
- **Andre steder det kan gælde:** Alle parrede dato-grænser: fra/til-perioder, afgørelses- og
  virkningsdatoer, kapitaliseringsdatoer.

**Brugerens afgørelse.** Udløser to felters værdier tilsammen en fejl, skal der gives fejl i **begge**.
Løsningen er forskellig i hvert af de to felter, og fejlmeddelelsen skal afspejle, hvad brugeren kan
gøre netop dér for at fjerne fejlen. Den nuværende markering er derfor korrekt og bevares. Til gengæld
skal tooltip-teksterne afspejle det — fx i det ene felt «Der er angivet en skadesdato før skadelidtes
fødselsdato.» og i det andet «Fødselsdatoen ligger efter den angivne skadesdato.»

**Agentens bemærkning.** Afgørelsen ophæver fundets forslag om kun at markere det senest ændrede felt,
men skærper kravet til de to tekster: de skal være hinandens spejlbillede set fra hvert sit felt.
Bemærk sammenhængen med BB-002 — navnet i teksten skal følge skadestypen, og feltet hedder «Skadedato»
uden binde-s. Forslaget nedenfor bruger derfor **skadedatoen**/**anmeldelsesdatoen** og beholder den
konkrete modgående dato, som `input-field-behavior-contract.md` §1.3 kræver af et bounds-tooltip.

**Forslag til implementering** (samme rettelse som BB-002; her kun ordlyden)

I [dateRangeErrorMessages.ts](../../../src/utils/dateRangeErrorMessages.ts):

- linje 118 — tooltip **på datofeltet**, hvor rettelsen er at flytte datoen frem:
  `Der er angivet en ${labelLower} før skadelidtes fødselsdato (${fødselsdato})`
  → «Der er angivet en skadedato før skadelidtes fødselsdato (01-06-2021)» / «Der er angivet en
  anmeldelsesdato før skadelidtes fødselsdato (01-06-2021)».
- linje 139 — tooltip **på fødselsdatofeltet**, hvor rettelsen er at flytte fødselsdatoen tilbage:
  `Fødselsdatoen ligger efter den angivne ${labelLower} (${skadedato})`
  → «Fødselsdatoen ligger efter den angivne skadedato (01-06-2020)» / «… den angivne anmeldelsesdato
  (01-06-2020)».

Begge tekster går uændret videre til «Fejl og advarsler»-boksene, fordi `bounds`-beskeder citeres
ordret (`project_field_tooltip_vs_error_box`). Ordlyden forelægges brugeren, før den skrives ind.

---

## Overvejet uden fund

- **Datoseparatorer.** `01-06-1956`, `01/06/1956` og `1.6.1956` giver alle `01-06-1956`. Ethvert
  ikke-alfanumerisk tegn accepteres som separator, og et enkeltcifret dag/måned udfyldes med nul.
  Fungerer og er tilgivende.
- **Rydning af Skadestype.** Menupunktet «Vælg skadestype» rydder feltet igen; brugeren er ikke
  låst fast af sit første valg.
- **Rene mellemrum i tekstfelt.** `"   "` i Skadelidtes navn ryddes til tom værdi ved settle. Det er
  det rigtige udfald; at brugeren ser sin indtastning forsvinde, er acceptabelt, da den var tom.
- **Kontekstuel label.** Selve mekanismen virker: labelen skifter korrekt mellem «Skadedato» og
  «Anmeldelsesdato», og skærmlæser-etiketten følger med. Problemet er ikke labelen, men de to ting,
  der ikke følger med den (BB-001 og BB-002).
- **Gensidige datogrænser.** Fødselsdato kan kun sænke datofeltets loft, og skadedatoen kan kun hæve
  fødselsdatoens gulv. Retningen er rigtig, og et umuligt interval (min > max) kan ikke opstå mellem
  de to felter.
- **Dato efter dags dato.** Både Fødselsdato og Skadedato afvises korrekt med «Datoen er efter dags
  dato (…)» og den konkrete dato.
- **Pladsholder.** Datofelterne viser `dd-mm-åååå`, så formatet er kendt før første tastning.
- **Dropdown-valgmuligheder.** «Arbejdsulykke»/«Erhvervssygdom» kommer fra schemaets enum, så listen
  og valideringen kan ikke komme fra hinanden.
- **Konsolsignaler.** Ingen `console.error` eller ukontrollerede sidefejl under hele gennemgangen.

## Dækningshuller

- Kun Chrome ved 1536×864. Edge, Firefox og WebKit samt 1920×1080 er ikke kørt; ingen af fundene
  ovenfor er dog af en art, der plausibelt afhænger af browser.
- Undo/redo umiddelbart efter skift af skadestype er ikke afprøvet — relevant for BB-001, hvis
  rettelsen bliver «ryd datoen ved skift».
- Gem/hent-rundtur med de undersøgte værdier (usynlige tegn, afvist råtekst) er ikke kørt. Hører
  naturligt til fladen «Global shell».
- Det er ikke efterprøvet, hvad de aldersafhængige beregninger konkret producerer for den 2-årige i
  BB-005; kun at Stamdata accepterer den uden signal. Efter brugerens afgørelse er dette ikke længere
  et grænsespørgsmål, men et **korrekthedsspørgsmål**: en meget ung skadelidt er et lovligt input, og
  kapitalisering, pensionsalder og forsørgertab skal derfor kunne regne rigtigt på den. Efterprøves på
  de pågældende flader.
- Virkningen af et skift af skadestype på Erstatningsopgørelsens datogrænser er konstateret i koden,
  men ikke afprøvet i browseren. Efter brugerens afgørelse er det netop den afledte fejlmarkering, der
  BÆRER orienteringen — den bør derfor efterprøves konkret, når Erstatningsopgørelsen gennemgås:
  sæt Erhvervssygdom, angiv en svie-/smertedato mellem anmeldelsesdatoen ÷ 5 år og anmeldelsesdatoen,
  skift til Arbejdsulykke, og kontrollér at feltet bliver rødt med den korrekte besked.

## Åbne spørgsmål

**Ingen.** Alle spørgsmål på denne flade er besvaret af brugeren 2026-08-16 — først de tre
oprindelige (BB-001: datoen bevares uændret; BB-005: ingen aldersgrænse; BB-010: begge felter markeres
fortsat), og derefter de tre, som svarene rejste:

1. **Skadestypens skjulte beregningsvirkning (BB-001):** skiftet må fortsat ske tavst. Brugeren
   orienteres gennem den afledte fejl på det datofelt, hvis grænse flyttede sig.
2. **Grænsen for de to initialfelter (BB-004):** 6 tegn, både ved tastning og indsættelse.
3. **Læsbarhed af korte tekstfelter (BB-004):** bortfalder på Stamdata med den nye grænse;
   efterprøves i stedet dér, hvor et 60-tegns-felt faktisk er smalt (`TVAERGAAENDE.md` M-04).

Fladen er dermed færdigbehandlet. Tre rettelser står klar til gennemførelse: BB-002 + BB-010's ordlyd
(én kodeændring), BB-004's længdekategori og BB-007's normalisering.
