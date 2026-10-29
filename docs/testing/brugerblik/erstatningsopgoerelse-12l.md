# Brugerblik – Erstatningsopgørelse → Beregning: fejlpanelet, sammentællingen og bilagsvalgene (12l)

- Rute/placering: `/erstatningsopgoerelse` → fanen «Beregning»: «Fejl og advarsler», «Beregning» (sammendragslinjerne og
  «Hent opgørelse»), «Bilag» (syv valg plus «Alle»/«Perioden») og «Alternative beregninger» (TAF-krav fordelt på
  kalenderår, TAF opreguleret til beregningsåret, visuel graf over indtægtsniveau) – samt opgørelsens forside og
  sammentælling (`opgoerelseSection`), bilagenes sammensætning (`eoBilagSections`) og de tre alternative dokumenter.
- Gennemgået: 2026-10-29 · commit `a7d91ae3`
- Afprøvet i: Chrome headless, lyst tema, 1536×864, mod e2e-buildet. 20 sager indlæst gennem «Hent» (krypteret `.eo` bygget
  til formålet på den låste testfil «REGULERING-FIKTIV»), ét UI-forløb (skift til «Alle», Ctrl+Z, fravalg af et bilag
  gennem TAF «Nej» → «Ja»). For hver sag er fanens tekst, alle bilagsvalg (markeret, aktiv, tooltip) og de fire
  downloadknapper (aktiv, tooltip) aflæst; alle hentbare dokumenter er hentet som `.pdf` og læst som tekst.
  **Grundsag:** skadedato `11-07-2025`, opgørelse nr. 3 lavet `25-09-2026`, «Vedrører perioden» `25-05-2026` –
  `20-09-2026`, svie/smerte og TAF «Ja», øvrige krav «Skjul», beregningen skjult efter første opgørelse, seks
  sygedagpengerækker, manuel regulering. Papiret: svie/smerte `16.500,00 kr.`, TAF `110.044,38 kr.`, i alt
  `126.544,38 kr.`

## Fladen kort

Fanen er sagens afslutning: «Fejl og advarsler» samler alt, der spærrer eller bør ses, et kort sammendrag viser de tre
krav, og fire knapper henter opgørelsen og tre alternative TAF-dokumenter. Bilagsvalgene afgør, hvad der trykkes efter
opgørelsen.

**Fladens bærende iagttagelse er, at knapperne og bilagsvalgene ikke siger det, programmet ved.** En tom referenceperiode
på sygeferiegodtgørelsen spærrer alle fire dokumenter med to linjer uden link og uden ansættelsesforholdets navn
(BB-369, **Høj**). De tre TAF-dokumenter spærres af fejl i krav, de ikke viser, og siger «Opgørelse kan ikke hentes»
(BB-370) – eller «Indtastning mangler», når intet mangler (BB-371). To bilagsvalg står markeret og aktive, men bilaget
udgår tavst (BB-372, BB-373), og sammendraget skriver «Ingen perioder angivet» om perioder, der står i tabellen (BB-374).

**Beregningerne er ikke vurderet.** Sammentællingen er kontrolregnet mod linjerne; reglerne bag beløbene er 12b–12k's.

**Afgrænsning.** Linjerne i «Fejl og advarsler» er de øvrige bidders – her er prøvet boksens form, links og samspillet med
knapperne. Kontrolfanerne er 12m's.

## Fund

### BB-369 – En tom referenceperiode på sygeferiegodtgørelsen spærrer alle fire dokumenter med to linjer uden link

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
  (sikkerhedsnettets form)
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:**
  1. Grundsagen. Lønindkomst → «Fiktivt arbejdssted» → «Sygeferiegodtgørelse beregnes ud fra» `Ferieloven`.
  2. Lad «Referenceperiode» stå tom, og gå til Beregning.
- **Det sker:** «Fejl og advarsler» har to linjer: «Referenceperiode fra-dato mangler» og «Referenceperiode til-dato
  mangler» – uden fanehenvisning, uden link og uden ansættelsesforholdets navn. Alle fire downloadknapper er inaktive med
  «Opgørelse kan ikke hentes, når der er fejl ovenfor». På Lønindkomst-fanen er begge datofelter tomme og ikke røde
  (`aria-invalid="false"`). Mekanikken: kun validatoren kender reglen (`erstatningsopgoerelseValidator.ts:713-730`);
  rækkebyggeren for sygeferiegodtgørelse har ingen række for en manglende periode, så linjen når boksen gennem
  sikkerhedsnettet, hvis link kun kan pege på et felt øverst på EO oplysninger (`eoInputIssues.ts:42`).
- **Det er uhensigtsmæssigt fordi:** Det er en blindgyde. Brugeren skal selv regne ud, at «Referenceperiode» hører til
  sygeferiegodtgørelsen på Lønindkomst-fanen, og under hvilket ansættelsesforhold. De øvrige regler for samme felt –
  før første TAF-dag, fraværsdagenes loft, en periode uden løn – står med navn og link efter 12j.
- **Bedre ville være:** Samme form som referenceperiodens øvrige regler: «Fiktivt arbejdssted: Referenceperiode fra-dato
  er ikke udfyldt» med link «Lønindkomst -> Sygeferiegodtgørelse», der blinkmarkerer feltet.
- **Andre steder det kan gælde:** Validatorens øvrige sygeferiegodtgørelsesregler uden række i rækkebyggeren, fx en
  manglende «Sygeferiegodtgørelse beregnes ud fra» (`SFGG_BEREGNINGSKILDE_MANGLER_MESSAGE`, uverificeret). To
  ansættelsesforhold med samme mangel giver sandsynligvis kun én linje, fordi boksen folder ens linjer (uverificeret).

**Tilbagemelding**
Enig


**Gennemført 2026-10-29:** hver tom dato i referenceperioden får sin egen linje, «Referenceperiode, fra: Datoen er ikke
udfyldt» (og «…, til: …»), i samme form som periodens øvrige regler. Linket fører til «Lønindkomst» – ved flere
ansættelsesforhold «Ansættelsesforhold 2» – og blinkmarkerer feltet. Validatorens to linjer uden link står ikke længere i
boksen. Felterne får ikke rød ring: et tomt felt er en mangel, ikke en forkert indtastning. To ansættelsesforhold med samme
mangel giver hver sine linjer. Kravet om en referenceperiode er uændret.

### BB-370 – En fejl i svie/smerte eller øvrige krav spærrer de tre TAF-dokumenter – og tooltippen siger «Opgørelse»

- **Type:** Fornuft
- **Rækkevidde:** Lokal (slægt af M-22: en blokering fra et sted, dokumentet ikke viser)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29 (TAF-dokumenterne spærres ikke). **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** Grundsagen, skiftevis med:
  1. en svie/smerte-periode fra `01-10-2026` til `20-09-2026`;
  2. øvrige krav «Ja» med én post «Medicin» uden beløb.
- **Det sker:** «Fejl og advarsler» har kun svie/smerte- henholdsvis øvrige krav-linjen, og sammendraget viser
  TAF-perioden `25-05-2026 - 20-09-2026` uden fejl. Alle fire knapper er inaktive med samme tooltip: «Opgørelse kan ikke
  hentes, når der er fejl ovenfor» – også «TAF-krav fordelt på kalenderår», «TAF opreguleret til beregningsåret» og
  «Visuel graf over indtægtsniveau». Ingen af de tre indeholder svie/smerte eller øvrige krav (målt i grundsagens
  dokumenter). De fire deler én rækkeblokering (`erstatningsopgoerelseDownloadGate.ts:118-146`).
- **Det er uhensigtsmæssigt fordi:** Den, der skal sende TAF fordelt på kalenderår til skattemyndighederne, kan ikke hente
  den, før et krav, dokumentet ikke viser, er rettet – og tooltippen taler om et andet dokument.
- **Bedre ville være:** Fejl i svie/smerte og øvrige krav spærrer ikke de tre TAF-dokumenter. Tooltippen nævner det
  dokument, knappen henter: «TAF-krav fordelt på kalenderår kan ikke hentes, når der er fejl ovenfor». Fastholdes den
  fælles spærring (forudsigelighed, udviklerbeslutning 2026-08-13), bør i det mindste dokumentnavnet rettes.
- **Andre steder det kan gælde:** Ingen kendte; Erhvervsevnetab-fanerne har hver sin gate (uverificeret).

**Tilbagemelding**
Enig


**Gennemført 2026-10-29:** fejl i svie/smerte og øvrige krav spærrer ikke længere de tre TAF-dokumenter. De dannes, som
om de to krav var «Skjul», så hverken en fejl eller et tal derfra kan nå dem; TAF-tallene er de samme som i sagen uden
fejlene. Andre fejl – i TAF, lønindkomst, stamdata – spærrer som før. Tooltippen nævner nu dokumentet: «TAF fordelt på
kalenderår kan ikke hentes, når der er fejl ovenfor», «TAF opreguleret til beregningsåret …», «Visuel graf over
indtægtsniveau …»; «Hent opgørelse» siger fortsat «Opgørelse kan ikke hentes …».

### BB-371 – TAF-dokumenterne siger «Indtastning mangler», når der ikke er krav på TAF eller ingen periode i erstatningsperioden

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** Grundsagen, skiftevis med:
  1. TAF «Nej»;
  2. TAF «Ja» med én periode `01-08-2025` – `31-03-2026` (før erstatningsperioden);
  3. TAF «Ja» uden periode.
- **Det sker:** «Hent opgørelse» er aktiv. De tre alternative knapper er inaktive med «Indtastning mangler». I 1 er der
  ingen «Fejl og advarsler»-boks; i 2 og 3 kun en gul advarsel. Intet felt er rødt. Dokumenternes egen, præcise årsag
  findes, men erstattes af den universelle tekst (`eoDocumentDownloadGate.ts:142-146`).
- **Det er uhensigtsmæssigt fordi:** «Indtastning mangler» sender brugeren på jagt efter et tomt felt, der ikke findes. I 1
  er tilstanden et bevidst valg, ikke en mangel.
- **Bedre ville være:** Sig årsagen med bilagsvalgenes eksisterende ordlyd: 1 «Der er ikke krav på tabt
  arbejdsfortjeneste i erstatningsperioden»; 2 og 3 «Ingen TAF-periode ligger i erstatningsperioden».
- **Andre steder det kan gælde:** Andre dokumentknapper, hvis projektion spærrer med en specifik besked, der
  klassificeres som «unavailable-calculation» (uverificeret).

**Tilbagemelding**
Enig


**Gennemført 2026-10-29:** de tre knapper siger tilstanden med bilagsvalgenes ord: ved TAF «Nej» eller «Skjul» «Der er
ikke krav på tabt arbejdsfortjeneste i EO-perioden», og ved TAF «Ja» uden periode i EO-perioden «Der er ingen
TAF-perioder i EO-perioden» (jf. BB-375 om ordet).

### BB-372 – Bilagsvalget «Midlertidigt EET» står markeret og aktivt, men bilaget udgår tavst, når intet hentes

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-25--gaten-spørger-findes-der-noget-ikke-findes-det-brugeren-bad-om`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29 efter modsvaret (begge linjer, valg A, bilagsvalget inaktivt). **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** Grundsagen med «Midlertidigt EET indsættes fra Erhvervsevnetab-siden» slået til, ingen
  afgørelse på Erhvervsevnetab-siden og «Midlertidigt EET-afgørelse» `Nej` på EO oplysninger.
- **Det sker:** «Midlertidigt EET» er markeret og aktivt. «Fejl og advarsler» har kun den gule «Der er indtastet midlertidige
  EET-ydelser, men ikke angivet en afgørelse» med link til «AES-afgørelser» – men brugeren har ikke indtastet ydelser, kun
  slået togglen til. Download er aktiv; papiret har hverken bilaget «Midlertidigt EET» eller en EET-linje. Bilagsvalget er
  aktivt, alene fordi togglen er slået til (`eoBilagRules.ts:300`). BB-358's advarsel om, at intet hentes, kræver
  «Midlertidigt EET-afgørelse» `Ja` og står derfor ikke her.
- **Det er uhensigtsmæssigt fordi:** Brugeren har valgt bilaget og ser det valgt, og papiret ser færdigt ud.
- **Bedre ville være:** Henter togglen intet, er «Midlertidigt EET» inaktivt med «Der hentes ingen midlertidige EET-ydelser
  fra Erhvervsevnetab-siden». Advarslen siger, hvad der er sket: «Midlertidigt EET hentes fra Erhvervsevnetab-siden, men der
  er ikke angivet en midlertidig EET-afgørelse».
- **Andre steder det kan gælde:** BB-373 (sygeferiegodtgørelse ved TAF «Nej»). Forudsagt i 12k BB-358.

**Tilbagemelding**
Jeg mistænker, at dette allered er dækket af beslutnignerne i den forudgående erstatningsopgørelse-fil. Der blev taget stilling til hvornår fejlmeddelelser skulle vises og ikke ved tomt import af midlertidigt erhvervsevnetab. Hvis ikke svaret er dækkende, så pres tilbage. Dog en væsentlig bemærkning til dit fund - jeg er enig i, at hvis der ikke er angivet midlertidig EET-afgørelse på EOoplysninger, men togglen med at indlæse EET er slået til, skal programmet give besked til brugeren. Der vil kunne opstå en situation, hvor der faktisk er indtastet afgørelser på selve erhvervsevnetab-siden, men ikke er angivet på eooplysninger, at der er truffet midlertidig EET-afgørelse, men det bør høre under en særskilt meddelelse om denne indbyrdes uoverensstemmelse.

**Modsvar** (besvaret)

12k dækker ikke fundets sag. BB-358's advarsel («Erhvervsevnetab-siden har ingen midlertidig afgørelse med ydelser i
TAF-perioden – der fradrages intet midlertidigt EET») kræver, at «Midlertidigt EET-afgørelse» på EO oplysninger er `Ja`
– det var din betingelse. Her er den `Nej`. Tre ting står åbne:

*1. Beskeden, når togglen er slået til uden afgørelse.* I dag står der altid «Der er indtastet midlertidige
EET-ydelser, men ikke angivet en afgørelse» – også når intet er indtastet eller hentet; togglen alene udløser den. Mit
forslag skelner dine to tilfælde. Begge linjer er gule og spærrer ikke (samme mønster som BB-240: afgørelsen er en
oplysning), og begge linker til «Midlertidigt EET-afgørelse» på EO oplysninger:

- a) Erhvervsevnetab-siden giver intet at hente: «Midlertidigt EET hentes fra Erhvervsevnetab-siden, men der er ikke
  angivet en midlertidig EET-afgørelse – der fradrages intet midlertidigt EET».
- b) Erhvervsevnetab-siden giver ydelser (din uoverensstemmelse): «Erhvervsevnetab-siden har en midlertidig afgørelse,
  men der er ikke angivet en midlertidig EET-afgørelse på EO oplysninger».

Den nuværende linje bliver stående for ydelser, brugeren selv har tastet i tabellen.

*2. Hvad beregningen gør i b) – det er en beregningsregel, så den er din.* Efter koden henter og fradrager programmet
ydelserne fra Erhvervsevnetab-siden, alene fordi togglen er slået til; valget på EO oplysninger indgår ikke. Eksempel:
EO oplysninger siger `Nej`, Erhvervsevnetab-siden har en midlertidig afgørelse fra 01-06-2026 med ydelser i
TAF-perioden → TAF-kravet nedsættes med ydelsen, og linjen ovenfor er den eneste markering.

- *Valg A (anbefalet):* som i dag – fradraget sker, og linje b) gør brugeren opmærksom på uoverensstemmelsen. Det
  svarer til, at en indtastet ydelse altid fradrages, selv når afgørelsen ikke er angivet.
- *Valg B:* fradraget sker først, når «Midlertidigt EET-afgørelse» er `Ja`. Linje b) siger så «… – der fradrages
  intet midlertidigt EET, før afgørelsen er angivet». Risikoen: et glemt `Ja` giver et for højt krav.

*3. Bilagsvalget – fundets egentlige kerne, som svaret ikke berører.* I tilfælde a) står «Midlertidigt EET» under
Bilag markeret og aktivt, men bilaget kommer ikke med på papiret, fordi der intet er at trykke. Brugeren ser det valgt
og tror, papiret har det. Forslag: valget er inaktivt med tooltippen «Der hentes ingen midlertidige EET-ydelser fra
Erhvervsevnetab-siden», som de øvrige bilagsvalg, der intet har at trykke. Det gemte valg kommer igen, når der er
noget at hente. Skal det med?

**Supplerende tilbagemelding**
Enig i alle anbefalingerne: begge linjer, valg A og bilagsvalget inaktivt.

**Gennemført 2026-10-29:** med togglen slået til og «Midlertidigt EET-afgørelse» ikke `Ja` står én af to gule linjer i
«Fejl og advarsler», begge med link til «Midlertidigt EET-afgørelse» under «AES-afgørelser»: henter togglen intet,
«Midlertidigt EET hentes fra Erhvervsevnetab-siden, men der er ikke angivet en midlertidig EET-afgørelse – der fradrages
intet midlertidigt EET»; henter den en afgørelse, «Erhvervsevnetab-siden har en midlertidig afgørelse, men der er ikke
angivet en midlertidig EET-afgørelse på EO oplysninger». Fradraget er uændret (valg A). Den gamle linje «Der er indtastet
midlertidige EET-ydelser, men ikke angivet en afgørelse» står nu kun for ydelser, brugeren selv har tastet. Henter togglen
intet, er bilagsvalget «Midlertidigt EET» inaktivt med «Der hentes ingen midlertidige EET-ydelser fra
Erhvervsevnetab-siden»; det gemte valg kommer igen, når der er noget at hente.

### BB-373 – TAF «Nej» med «Alle»: «Sygeferiegodtgørelse» kan vælges uden at blive trykt, og de øvrige valg giver forkerte grunde

- **Type:** Edge case
- **Rækkevidde:** Mønster → M-25
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** Grundsagen med TAF «Nej», «Lønindkomst og offentlige ydelser, der indsættes som bilag»
  `Alle`, «Sygeferiegodtgørelse beregnes ud fra» `Ferieloven` og bilagsvalget «Sygeferiegodtgørelse» markeret.
- **Det sker:** «Sygeferiegodtgørelse» er markeret og aktivt; papiret har intet sygeferiegodtgørelsesbilag. De andre er
  inaktive, men med «Lønindkomst – Der er ingen lønoplysninger i TAF-perioden» (sagen har 21 lønrækker og ingen
  TAF-periode), «Offentlige ydelser – Der er ingen offentlige ydelser i TAF-perioden» og «Regulering – Der er ingen løn
  eller offentlige ydelser, der reguleres». Med «Perioden» siger alle seks «Der er ikke krav på tabt arbejdsfortjeneste
  i erstatningsperioden». Undtagelsen for «Alle» (`eoBilagRules.ts:248-252`) er skrevet, fordi «Alle» skulle medtage
  oplysningerne uanset periode. Efter BB-360 er lønindkomst og ydelser ikke relevante ved TAF «Nej». Undtagelsen giver
  derfor kun forkerte grunde og ét tomt valg.
- **Det er uhensigtsmæssigt fordi:** Ét valg lover et bilag, der ikke kommer. Tre grunde siger noget om sagen, der ikke er
  sandt, og skifter mening med et valg, der ikke har noget med årsagen at gøre.
- **Bedre ville være:** TAF «Nej» eller «Skjul» giver alle seks bilagsvalg samme grund, «Der er ikke krav på tabt
  arbejdsfortjeneste i erstatningsperioden», uanset «Alle»/«Perioden».
- **Andre steder det kan gælde:** «SH-dage», når TAF regnes i arbejdsdage (samme undtagelse, uverificeret).

**Tilbagemelding**
Enig


**Gennemført 2026-10-29:** ved TAF «Nej» eller «Skjul» er alle seks bilagsvalg inaktive med «Der er ikke krav på tabt
arbejdsfortjeneste i EO-perioden» – også ved «Alle». Det gemte valg kommer igen ved TAF «Ja».

### BB-374 – Sammendraget skriver «Ingen perioder angivet» om perioder, der står i tabellen

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** Grundsagen (erstatningsperioden `25-05-2026` – `20-09-2026`), skiftevis med:
  1. én TAF-periode `01-08-2025` – `31-03-2026`;
  2. én svie/smerte-periode `11-07-2025` – `31-03-2026`.
- **Det sker:** Sammendraget skriver «TAF-periode: Ingen perioder angivet» henholdsvis «Svie/smerte-periode: Ingen
  perioder angivet». I 1 står i boksen «Der er indtastet TAF-perioder, men ingen af perioderne ligger inden for
  erstatningsperioden. TAF beregnes derfor til 0 kr.»; i 2 kun «Ikke rejst svie/smerte-krav for hele perioden». Papiret
  skriver «Ingen» og `0,00 kr.`; download er aktiv.
- **Det er uhensigtsmæssigt fordi:** Sammendraget modsiger tabellen, brugeren lige har udfyldt, og i 1 også boksen
  ovenover. For svie/smerte er der intet, der siger, at perioden ligger forkert.
- **Bedre ville være:** «Ingen periode i erstatningsperioden», når der er tastet perioder, men alle ligger uden for;
  «Ingen perioder angivet» kun, når tabellen er tom. Svie/smerte får TAF's advarsel: «Der er indtastet
  svie/smerte-perioder, men ingen af perioderne ligger inden for erstatningsperioden. Svie/smerte beregnes derfor til 0 kr.»
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig


**Gennemført 2026-10-29:** står der perioder, som alle ligger uden for EO-perioden, skriver sammendraget «Ingen periode i
EO-perioden»; «Ingen perioder angivet» står kun ved en tom tabel. Svie/smerte har fået TAF's advarsel: «Der er indtastet
svie/smerte-perioder, men ingen af perioderne ligger inden for EO-perioden. Svie/smerte beregnes derfor til 0 kr.», gul,
med link til tabellen. Den erstatter «Ikke rejst svie/smerte-krav for hele perioden», som ikke står ved siden af.

### BB-375 – Tre ord for erstatningsperioden i samme boks og samme bilagsvalg

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29 med forbehold for korthed. **GENNEMFØRT** 2026-10-29 («EO-perioden»).
- **Sådan fremprovokeres det:** BB-371's sag 2 og 3 og BB-373.
- **Det sker:** I «Fejl og advarsler» står «Der er ikke angivet nogen TAF-periode i EO-perioden» og «…ingen af perioderne
  ligger inden for erstatningsperioden». Bilagsvalgene siger «Der er ingen TAF-perioder i EO-perioden» og «Der er ikke krav
  på tabt arbejdsfortjeneste i erstatningsperioden». Feltet hedder «Vedrører perioden», kravvalgene og papiret siger
  «erstatningsperioden».
- **Det er uhensigtsmæssigt fordi:** Brugeren kan ikke vide, at «EO-perioden» og «erstatningsperioden» er det samme.
  «EO-perioden» blev indført i tabellernes tooltips efter udviklerens ordlyd i BB-217.
- **Bedre ville være:** Ét ord i alle brugertekster. Forslag: «erstatningsperioden», som papiret og kravvalgene bruger;
  ellers «EO-perioden» overalt.
- **Andre steder det kan gælde:** Tabellernes info-ikoner («Kun dage i EO-perioden fremgår», `SvieSmerteTable.tsx:74`,
  `TafPeriodeTable.tsx:97`) og rækkebyggernes tekster i `eoRowIssueCatalog.ts`.

**Tilbagemelding**
Brugeren vil vide, at EO-perioden er en forkortelse for erstatningsperioden, og at EO i almindelighed er en velkendt forkortelse for erstatningsopgørelse. Den forkortede udgave er som udgangspunkt valgt af pladshensyn for ikke at gøre indholdet for langt og tungt. Det hensyn skal fortsat opretholdes. Hvis der kan benyttes en ensartet formulering uden at teksten bliver for lang eller tung, er det ok, men kort, klar kommunikation er en høj prioritet, der trækker i den modsatte retning.

**Gennemført 2026-10-29:** «EO-perioden» – den korte form – overalt i «Fejl og advarsler», bilagsvalgene og
knappernes tooltips. Ændret: TAF's «… ligger inden for EO-perioden …», bilagsvalgets «Der er ikke krav på tabt
arbejdsfortjeneste i EO-perioden» og fire linjer fra andre faner, der også står i boksen (negativ løn/ydelse «… samlet
negativ i EO-perioden», anciennitetstillægget «… først efter EO-perioden …», sygelønnen «… sygeløn i EO-perioden …» og
EET-importen «… EO-periodens slutdato mangler»). Uændret: feltnavnene på EO oplysninger («… i erstatningsperioden») og
papiret, hvor modtageren ikke nødvendigvis kender forkortelsen.

### BB-376 – De alternative dokumenter hedder noget andet på papiret og i filnavnet end på knappen

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-29 med forbehold for korthed. **GENNEMFØRT** 2026-10-29.
- **Sådan fremprovokeres det:** Hent de to første alternative dokumenter i grundsagen.
- **Det sker:** «TAF-krav fordelt på kalenderår» giver titlen og filen «Tabt arbejdsfortjeneste fordelt på år»; «TAF
  opreguleret til beregningsåret» giver «TAF opreguleret til beregningsår». Grafen hedder det samme alle steder. Kun
  grafens række mangler et informationsikon.
- **Det er uhensigtsmæssigt fordi:** Brugeren genfinder ikke filen under det navn, han klikkede på, og to af tre navne
  siger noget forskelligt om, hvordan der fordeles (kalenderår/år).
- **Bedre ville være:** Samme navn på knap, titel og fil: «TAF fordelt på kalenderår» og «TAF opreguleret til
  beregningsåret».
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Hvis det kan gøre uden at teksten bliver for lang og tung og visuelt kluntet, så ok.

**Gennemført 2026-10-29:** knap, titel og fil hedder nu «TAF fordelt på kalenderår» (knappen blev kortere) og «TAF
opreguleret til beregningsåret» (titel og fil fik «-et» med).

### BB-377 – Bilagsvalgene styrer også «TAF opreguleret til beregningsåret» – det siger fladen ikke

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **AFVIST** af udvikleren 2026-10-29; modsvaret besvaret med valg A (uændret).
- **Sådan fremprovokeres det:** Hent «TAF opreguleret til beregningsåret» i grundsagen, og igen med alle bilag fravalgt.
- **Det sker:** Første gang har dokumentet bilagene «Offentlige ydelser» og «Regulering»; anden gang ingen. «TAF-krav
  fordelt på kalenderår» har aldrig bilag. Bilagsboksen står under «Beregning» og siger kun «Vælg elementer, der skal
  indgå».
- **Det er uhensigtsmæssigt fordi:** Den, der har fravalgt et bilag til opgørelsen, ved ikke, at det samtidig forsvinder
  fra et af de alternative dokumenter.
- **Bedre ville være:** Et informationsikon ved «Vælg elementer, der skal indgå»: «Bilagene trykkes efter opgørelsen og
  efter «TAF opreguleret til beregningsåret»».
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Ikke enig. De alternative dokumenter er bare andre måder at præsentere samme opgørelse på - brugeren vil forvente, at hvis man har fravalgt bilag til én visningsform, fravælges den også for de øvrige.

**Modsvar** (besvaret)

Informationsikonet er droppet. Men din begrundelse rækker videre end fravalget, og så halter de to andre dokumenter:
følger bilagsvalget med til «andre måder at præsentere samme opgørelse på», vil brugeren også forvente, at et TILVALGT
bilag kommer med. Det gør det kun i «TAF opreguleret til beregningsåret». «TAF fordelt på kalenderår» og «Visuel graf
over indtægtsniveau» har aldrig bilag, uanset valget.

*Eksempel:* bilagene «Lønindkomst» og «Offentlige ydelser» er valgt. Opgørelsen og «TAF opreguleret til
beregningsåret» har begge bilag; «TAF fordelt på kalenderår» har ingen.

- *Valg A (anbefalet):* som i dag. Kalenderårsdokumentet er et kort talgrundlag til skattemyndighederne, og grafen er
  én side; bilagene hører til de dokumenter, der viser beregningen.
- *Valg B:* «TAF fordelt på kalenderår» får de valgte bilag som de to andre.

**Supplerende tilbagemelding**
Enig i anbefalingen (valg A). Intet ændres.

### BB-378 – «Perioden» siger ikke, hvilken periode

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **AFVIST** af udvikleren 2026-10-29.
- **Sådan fremprovokeres det:** Se valget «Lønindkomst og offentlige ydelser, der indsættes som bilag»: `Alle` / `Perioden`.
- **Det sker:** Der er ingen forklaring. «Perioden» betyder TAF-perioderne inden for erstatningsperioden. Beregningsperioden
  er med, når beregningen vises (`periodRangeGroups.ts:116`). Valget styrer også «Regulering». I grundsagen giver «Perioden»
  6 → 4 sygedagpengerækker og ingen lønrækker; «Alle» giver alle 21 lønrækker.
- **Det er uhensigtsmæssigt fordi:** Brugeren kan ikke forudsige, hvad der kommer med – «perioden» kan lige så vel læses
  som erstatningsperioden eller beregningsperioden.
- **Bedre ville være:** Et informationsikon: «Perioden: lønindkomst og ydelser i TAF-perioden – og i beregningsperioden,
  når beregningen vises».
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Ikke enig - det er overforklarende. Brugeren vil forstå sondringen mellem, om alt skal med, eller kun det, som vedrører den relevante periode.

### BB-379 – «Opgørelse» står gråt og låst uden forklaring

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **AFVIST** af udvikleren 2026-10-29.
- **Sådan fremprovokeres det:** Hold musen over «Opgørelse» i bilagsboksen.
- **Det sker:** Valget er markeret, gråt og kan ikke ændres – det ligner de utilgængelige valg ved siden af, men har som
  det eneste ingen tooltip.
- **Det er uhensigtsmæssigt fordi:** Et gråt valg betyder overalt ellers på fladen «ikke muligt, se hvorfor». Her er
  meningen den modsatte, og brugeren får ingen forklaring.
- **Bedre ville være:** Tooltippen «Opgørelsen indgår altid».
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Jeg afviser. Dette er selvforklarende. Brugeren har ingen interesse i kun at få bilagene. Brugeren vil altid forvente en opgørelse. Det eneste valgfrie element er, om brugeren ønsker bilag med eller ej.

## Overvejet uden fund

- «Fejl og advarsler»: fejl før advarsler, hver linje med fane og link (bortset fra BB-369); boksen forsvinder, når den er tom.
- Spærring med fejl: «Hent opgørelse» siger «Opgørelse kan ikke hentes, når der er fejl ovenfor» – rigtigt for opgørelsen.
- Advarsler alene spærrer ikke (BB-215's nulopgørelse, TAF uden periode): rigtigt.
- Skadedato mangler: sammendraget «Indtastning mangler», linje med link til Stamdata, alle fire spærret – rigtigt.
- Sammendraget: «Ikke rejst», «Ikke rejst (skjult)», «Maksimum nået i tidligere opgørelse», «1 post», «Fejl» – efter
  BB-227/BB-234.
- Sammentællingen er summen af linjerne (`16.500,00 + 110.044,38 = 126.544,38`); «Skjul» udelader linjen, «Nej» giver
  `0,00 kr.`, som BB-227 afgjorde. TAF fordelt på kalenderår summerer til samme TAF-beløb.
- Et utilgængeligt bilag vises umarkeret med grund; det gemte valg kommer igen, når bilaget bliver muligt. Et fravalgt
  bilag forbliver fravalgt gennem TAF «Nej» → «Ja».
- «Alle» → Ctrl+Z gendanner «Perioden» og bilagstilstanden.
- Bilagenes rækkefølge på papiret følger skærmens.
- Konsollen var tavs i UI-forløbet.
- Valglistens tilgængelige navn er «Bilag: lønindkomst/off. ydelser indgår», ikke den synlige label – kun for skærmlæser.
- `okSatser` gemmes, men vises ikke; standard `true`, så kun en håndredigeret fil kan slå satserne i lønindkomstbilaget fra.

## Dækningshuller

- Kun PDF; Word-formatet er ikke hentet. Grafens tegning er ikke læst, kun at den hentes.
- «SH-dage» i en arbejdsdagssag og BB-369 med to ansættelsesforhold er ikke målt.
- Et afbrudt download («pdfDownloadErrorMessage») og brevhoved slået fra er ikke fremprovokeret.
- Linkene i «Fejl og advarsler» er aflæst, ikke klikket (dækket i 12a–12k).
- Kun viewport 1536×864.

## Åbne spørgsmål

- Ingen ud over fundene. BB-370 indeholder ét valg: om TAF-dokumenterne skal kunne hentes, mens et andet krav har fejl.
