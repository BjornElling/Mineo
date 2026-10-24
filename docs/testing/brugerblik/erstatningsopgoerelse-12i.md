# Brugerblik – Erstatningsopgørelse → Lønudvikling og regulering af tabet (12i)

- Rute/placering: `/erstatningsopgoerelse` → blokkene «Lønudvikling» og «Anciennitetstillæg» på BEGGE flader: fanen
  «Lønindkomst» (pr. ansættelsesforhold, kun ved «Beregnes ud fra: Beregningsperiode») og fanen «EO oplysninger» →
  «Indtægt før skadedatoen» (kun ved «Angivet månedsløn»/«Angivet dagsløn»). Dertil de to manuelle tabeller
  (`LoenudviklingManuelTable`, `LoenudviklingManuelProcentsatsTable`), rækken «Tilgængelige reguleringssatser» med dens
  tre dokumenter (Regulering, KRL Satstabeller, KL-lønaftaler), opgørelsens bilag «Regulering» og afsnittet «Forventet
  indkomst», samt løntrin-finderen («Find løntrin»), prøvet fra begge indgange.
- Gennemgået: 2026-10-20 · commit `1e5fe24a` · **afgjort og gennemført 2026-10-23** (18 af 19 fund gennemført, BB-312
  afvist); de fire tillægsspørgsmål (BB-301, BB-306, BB-312, BB-313) er besvaret og gennemført samme dag – ingen åbne
- Afprøvet i: Chrome headless, lyst tema, 1536×864 (M-09 desuden 1244×620), mod e2e-buildet. Sager indlæst gennem «Hent»
  (krypteret `.eo` bygget til formålet, `persistedDataVersion` 3.15), valg foretaget gennem brugerfladen, hvor overgangen
  selv var genstand for prøven. Dokumenter hentet som `.pdf` og læst som tekst; feltfejl aflæst gennem
  automatiseringsbroen, links målt med `animationstart`. **Grundsag:** skadedato `01-06-2018` (arbejdsulykke), «Vedrører
  perioden» og TAF-periode `01-01-2024` – `31-12-2024`, «Opgørelse lavet den» `01-02-2025`, «Beregnes ud fra»
  Beregningsperiode `01-06-2017` – `31-05-2018`, ét ansættelsesforhold «Firma A» med 12 månedsrækker à `30.000 kr.`,
  «Feriegodtgørelse/-tillæg» `12,5`, uden overenskomst, sygeferiegodtgørelse «Ingen». Med lønudvikling «Ingen» er kravet
  `409.841,70 kr.` (254 arbejdsdage á 1.613,55 kr.). Med SBLON2 `476.809,83 kr.`, ILON12 `475.662,28 kr.`, ASL
  `472.834,37 kr.`, KRL KTO (kommuner) `471.940,14 kr.`, KL-lønaftaler `472.290,86 kr.`, Industriens overenskomst
  `558.770,79 kr.` og KL-overenskomsten trin 30, gruppe 2 `471.940,14 kr.`

## Fladen kort

Blokken afgør, hvordan lønnen før skaden føres frem til erstatningsperioden. Brugeren vælger én af syv former –
Overenskomst, Statistik, KRL satstabel, KL-lønaftaler, Manuelt angivet, Manuel procentsats eller Ingen – og formen åbner
sine egne felter: en overenskomst (med løntrin, gruppe og forhøjet grundløn ved de offentlige), en statistisk model, en
satstabel eller en af de to manuelle tabeller. «Anciennitetstillæg» vises kun ved Overenskomst. Skærmen viser ikke
resultatet (BB-226); reguleringen når kun papiret, som faktoren «x (100 % + 16,34 %)» i «Forventet indkomst» og som bilaget
«Regulering» med reguleringsværdierne og «Beregnet regulering».

**Fladens bærende iagttagelse er, at blokken viser én ting og regner på en anden.** Feltet «Ansættelse» viser
«Månedsløn», mens programmet har det for tomt og spærrer opgørelsen – og at vælge «Månedsløn» igen gemmer netop tomt
(BB-300, **Kritisk**). Felter, blokken har skjult, spærrer fortsat med et link, der ikke fører nogen steder hen (BB-301),
og felter, den viser, regnes ikke: et anciennitetstillæg uden dato eller sats forsvinder tavst, mens papiret trykker
«Indtastning mangler» (BB-304), og en procentsatstabel uden satser regnes som 0 %, mens papiret skriver «tillagt
efterfølgende lønstigninger» (BB-303). **Den manuelle lønudvikling har dertil en skjult udløbsdato:** et år efter sidste
række regnes tabellen ikke længere for dækkende, og opgørelsen spærres med «'Reguleringsværdi på slut-dato for TAF' er
ikke angivet» (BB-302).

**Beregningerne er ikke vurderet.** Reguleringen er gennemgået fagligt 2026-10-13 (`docs/review/regulering-taf-gennemgang-
2026-10-13.md`), og dens afklaringslog er bindende. Denne gennemgang har kun holdt skærm, boks og papir op mod hinanden.

**Afgrænsning.** «Evt. særlig fra-dato for regulering» og satsfelterne er 12g's, lønrækkerne 12h's, sygeferiegodtgørelsen
12j's, bilagsvalget «Regulering» og sammendraget 12l's, kontroltabellen 12m's. «Løn på helligdage» under angivet løn er
prøvet her efter 12f's henvisning.

## Fund

### BB-300 – «Månedsløn» kan ikke vælges under «Ansættelse»: valget gemmes som tomt, og opgørelsen spærres med «Ansættelse er ikke valgt»

- **Type:** Fejl
- **Rækkevidde:** Lokal (B6a – programmets «tom» er ikke det, brugeren ser)
- **Prioritet:** **Kritisk**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: «Ansættelse» er et påkrævet valg med
  Månedsløn som standard (som «Løn på helligdage»). Et valg af «Månedsløn» gemmes som Månedsløn, linjen «Ansættelse er ikke
  valgt» findes ikke længere, og en ældre fil med et tomt felt indlæses som Månedsløn – det, feltet hele tiden viste.
- **Sådan fremprovokeres det:**
  1. EO oplysninger: «Beregnes ud fra» Angivet månedsløn `30.000`. «Lønudvikling beregnes ud fra» Overenskomst, «Vælg
     overenskomst» KL-overenskomsten. Gå til Beregning.
  2. Tilbage på EO oplysninger: vælg «Månedsløn» i «Ansættelse» (feltet viser allerede «Månedsløn»).
  3. Vælg «Timeløn», og derefter «Månedsløn» igen.
  4. Lønindkomst: et kort med KL-overenskomsten, «Ansættelse» Månedsløn, trin 30, gruppe 2 (fungerer). Skift til
     «Timeløn» og tilbage til «Månedsløn».
- **Det sker:** I 1–3 står «Ansættelse er ikke valgt» i «Fejl og advarsler» og spærrer, mens feltet viser «Månedsløn»
  (målt efter hvert trin; kun med «Timeløn» forsvinder linjen og afløses af «Løntrin er ikke angivet»). I 4 sker det
  samme på kortet: efter et skift frem og tilbage er der ingen vej tilbage til en hentbar opgørelse med månedsløn.
  Mekanikken: feltet bruger «Månedsløn» som visning for den tomme værdi (`emptyUiValue`), og et valg af netop den værdi
  gemmes derfor som tomt (`ChoiceField.tsx:86`), mens rækken «KL-/RLTN-oplysninger» kræver en værdi. Komponentens egen
  kommentar siger, at «hele domænet læser en tom værdi som månedsløn».
- **Det er uhensigtsmæssigt fordi:** En offentligt ansat på månedsløn med angivet løn – en almindelig sag – kan slet ikke
  opgøres, og feltet viser det rigtige svar. Brugeren kan ikke se, hvad der mangler, og ingen handling på skærmen retter
  det.
- **Bedre ville være:** «Månedsløn» gemmes som månedsløn, når brugeren vælger den, og en tom værdi (fra en ældre fil)
  behandles ens alle steder – som månedsløn – så linjen aldrig står ved et felt, der viser et valg.
- **Andre steder det kan gælde:** `emptyUiValue` bruges ellers kun på overenskomstfiltrene («Alle» = intet filter), hvor
  sammenfaldet er tilsigtet. Ingen andre kandidater.

**Tilbagemelding**
Enig. Det er en fejl og skal rettes. Præmissen for feltet er, at det ikke må kunne være tomt, og at den viste værdi altid er den valgte værdi - helt som andre dropdown-feltet. Det har aldrig været tilsigtet, at dette felt skulle virke på en anden måde. Det er bare en dropdown med to valgmuligheder, hvoraf den ene altid skal være valgt, og hvor Månedsløn blot er defaultværdien.

**Bemærkning (til orientering)**

Ændringen rører, hvordan en ældre gemt sag indlæses, og den slags skal du have set: en sag, hvor «Ansættelse» blev gemt
tomt (enten fra før feltet fandtes, eller fordi brugeren valgte «Timeløn» og så «Månedsløn» igen), åbner nu med
«Månedsløn» valgt. Skærmen viste allerede «Månedsløn» i de sager, så brugeren ser intet nyt – men opgørelsen, som før var
spærret med «Ansættelse er ikke valgt», kan nu hentes og regnes som månedsløn. Jeg har læst din tilbagemelding (feltet må
aldrig være tomt, Månedsløn er standard) som en godkendelse af netop det. Sig til, hvis ikke.

### BB-301 – Skjulte felter i lønudviklingen spærrer opgørelsen med et link til et felt, der ikke er på skærmen

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-32--et-skjult-felt-er-ikke-udfyldt--men-kun-nogle-af-dets-læsere-ved-det`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23, også som en bred gennemgang. **GENNEMFØRT** 2026-10-23 med den
  standardiserede løsning (feltrelevans): alle lønudviklingens og anciennitetens felter og de to manuelle tabeller på begge
  flader, «Evt. særlig fra-dato for regulering», sygeferiegodtgørelsens felter, og indtægtstabellens periode- og
  beløbskolonner. Et skjult felt giver hverken rød ring, linje eller spærring; værdien bevares og kommer igen med feltet.
- **Sådan fremprovokeres det:** Hver for sig:
  1. Kort med Industriens overenskomst og «Anciennitetstillæg» slået til, dato `01-01-2030` (rød). Skift «Lønudvikling
     beregnes ud fra» til Statistik/SBLON2.
  2. Kort med KL-overenskomsten, «Løntrin» `99` (rød) eller «Evt. forhøjet grundløn» `-500` (rød). Skift til
     Statistik/SBLON2.
  3. Kort med «Manuelt angivet» og en række dateret `01-04-2017`. Skift på EO oplysninger «Beregnes ud fra» til Angivet
     månedsløn (kortets lønudvikling skjules).
- **Det sker:** Blokken med feltet er væk, men opgørelsen spærres: 1 «Dato for opnået anciennitetstillæg: Dato skal være
  mellem 01-01-2005 og 31-12-2027», 2 «Løntrin: Værdi skal være mellem 1 og 55» / «Forhøjet grundløn ud over løntrin:
  Værdi skal være 0 kr. eller højere», 3 «Datoen skal være senere end datoen i den låste første række (01-06-2018)» – den
  sidste uden link. Linket «Lønindkomst» i 1 skifter fane og blinker 91 elementer, hele kortet (målt), og fokus havner på
  `body`. Ingen af lønudviklingens eller anciennitetens descriptorer bærer `relevance`; synligheden er alene en
  betingelse i komponenten. (Et skjult manuelt tabelfelt på et SYNLIGT kort spærrer derimod ikke – den regel er bundet
  til formen.)
- **Det er uhensigtsmæssigt fordi:** Brugeren har valgt en anden form og ser ingen rød ring. Han skal gætte sig til, at
  han må vælge den gamle form igen for at finde feltet, og i 3 skal han dertil skifte beregningsmåde.
- **Bedre ville være:** Som de øvrige EO-felter efter BB-228: lønudviklingens og anciennitetens felter bærer relevans
  efter blokkens egen synlighed, så et skjult felt læses som tomt af alle, og et valg, der skjuler et rødt felt, rydder
  det (`form-contract.md` §7 pkt. 5).
- **Andre steder det kan gælde:** Alle felter i `erstatningsopgoerelseLoenDescriptors.ts:275-329` og `:571-604`;
  `collectManualRegulationDateIssues` (`manualRegulationDateIssues.ts:60-81`), der læser alle kort uanset
  beregningsmåde.

**Tilbagemelding**
Enig. Det er udtryk for endnu et eksempel på en gammel fejl, der burde være rettet konsekvent og alle steder - men ved en fejl ikke er rettet her. Undersøg bredt, om der er andre tilsvarende situationer, hvor skjulte indtastninger kan påvirke og blokere indtastninger, og ret dem konsekvent, og så vidt muligt gerne ved brug af den standardiserede løsning, som programmet allerede har for sådanne.

**Modsvar (afventer udviklerens svar) – to steder, hvor et skjult felt stadig ændrer et tal**

Den brede gennemgang fandt seks steder ud over lønudviklingen. Fire er rettet som ovenfor (sygeferiegodtgørelsen, hvor
for mange fraværsdage nu også får rød ring på feltet; indtægtstabellens kolonner efter «Løn indtastes som» og «Tillæg
angives som»; den særlige fra-dato; og to dobbeltlinjer i sygeferiegodtgørelsen – se BB-306). To kan jeg ikke rette uden
at ændre et beløb, så de kræver dit svar:

1. **Satsfelterne, når «Tillæg angives som» er «Beløb».** Eksempel: brugeren har tastet feriegodtgørelse 12,5 % og
   fritvalg 4 %, og skifter så til «Beløb». Procentfelterne forsvinder fra skærmen – men programmet bruger stadig de 12,5 %
   og 4 % i overenskomstreguleringen og i sygeferiegodtgørelsens pension. Et rødt felt (fx 150 %) bliver ved med at spærre,
   og linket fører til et felt, man ikke kan se.
   - *Valg A (anbefalet):* de skjulte satser regnes som ikke angivet, som alle andre skjulte felter. Sager med «Beløb» og en
     gammel, skjult sats kan få et andet beløb end i dag.
   - *Valg B:* uændret – de skjulte satser bruges fortsat, og kun den røde ring fjernes.
2. **«Periode til beregning af før-løn», når TAF er «Nej» eller «Skjul».** Afsnittet med perioden vises slet ikke, men en
   rød dato dér (fx «Til og med» før «Fra») spærrer hele opgørelsen – også svie/smerte. Samtidig bruger programmet
   periodens slutdato til at slå overenskomstsatserne op i lønindkomst-bilaget, som stadig kan vælges uden TAF.
   - *Valg A (anbefalet):* uden TAF er perioden ikke udfyldt: den spærrer ikke og bruges ikke. Bilaget over lønindkomsten
     kan da ikke længere vise satser fra en overenskomst, når TAF er fravalgt.
   - *Valg B:* uændret.

**Supplerende tilbagemelding**
Enig i dine anbefalinger.

**Gennemført 2026-10-23 (valg A i begge):**
1. Ved «Tillæg angives som» = «Beløb» er de fire satsfelter ikke udfyldt: de spærrer ikke og bruges ikke af
   overenskomstreguleringen eller sygeferiegodtgørelsens pension. Værdierne bevares og kommer igen ved «Procent».
2. Uden TAF («Nej»/«Skjul») er «Periode til beregning af før-løn» ikke udfyldt: en rød dato spærrer ikke længere
   svie/smerte eller andet, og lønindkomst-bilaget slår ikke overenskomstsatser op på periodens slutdato.

### BB-302 – En manuelt angivet lønudvikling «udløber» et år efter sidste række, og opgørelsen spærres med «'Reguleringsværdi på slut-dato for TAF' er ikke angivet»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT valg (b)** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: samme grænse som før (sidste
  række + 12 måneder + Indstillingernes tolerance), men nu en gul ring på sidste rækkes dato og den gule linje «Den manuelle
  lønudvikling har ingen ændringer efter 01-04-2023 – lønnen er regnet uændret frem til 31-12-2024». Opgørelsen kan hentes;
  beregningen er uændret (den regnede allerede med sidste rækkes løn). Samme regel gælder «Manuel procentsats» (BB-311).
- **Sådan fremprovokeres det:** Grundsagen med «Manuelt angivet», navn «Lokalaftale», basisrækken `30.000 kr.` og to
  rækker: `01-04-2019` `31.000 kr.` og `01-04-2023` `36.000 kr.` (begge med feriegodtgørelse `12,5`).
- **Det sker:** «Fejl og advarsler»: «'Reguleringsværdi på slut-dato for TAF' er ikke angivet (kun indtil 31-03-2024)» –
  spærrende, med link til kortet. Programmet regner en manuel tabel for gyldig til sidste række + 12 måneder
  (`getRangeForManualRegulering`) og giver derefter den sædvanlige tolerance på 6 måneder fra Indstillinger. Med sidste
  række `01-09-2023` er sagen hentbar (`491.810,04 kr.`) uden et ord om, at TAF-periodens sidste fire måneder ligger uden
  for «dækningen». **«Manuel procentsats» har ingen udløbsdato** – samme to datoer giver `436.891,25 kr.` uden
  bemærkning. Rækken «Tilgængelige reguleringssatser», der ellers viser dækningen, vises ikke ved de manuelle former.
- **Det er uhensigtsmæssigt fordi:** Brugeren har selv angivet lønnen, og en løn, der ikke er steget siden april 2023, er
  stadig lønnen i december 2024. Han kan kun komme videre ved at gentage den sidste løn i en ny række med en senere dato –
  en række, der ikke beskriver noget. Beskeden citerer et internt rækkenavn i anførselstegn og siger «er ikke angivet» om
  noget, der ikke er et felt (jf. BB-306).
- **Bedre ville være:** Udvikleren vælger:
  (a) En manuel tabel gælder, til næste række ændrer den – ingen udløbsdato, som ved «Manuel procentsats»; eller
  (b) udløbsdatoen bevares, men som en gul, ikke-blokerende advarsel med en forståelig tekst: «Den manuelle lønudvikling
  har ingen ændringer efter 01-04-2023 – lønnen er regnet uændret frem til 31-12-2024».
- **Andre steder det kan gælde:** Ingen; de øvrige former har en reel kildedækning.

**Tilbagemelding**
Enig. Vi går med løsning b) - brugeren advares med ikke-blokerende gul ring og advarselstekst som du foreslår.

### BB-303 – «Manuel procentsats» uden en eneste sats regnes som 0 % uden et ord – papiret siger «tillagt efterfølgende lønstigninger»

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-37--en-manglende-sats-regnes-som-0--uden-et-ord`
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: en procentsatstabel uden andre rækker
  end basisrækken spærrer med «Manuel procentsats mangler: angiv mindst én sats – eller vælg «Ingen»» og link til tabellen.
- **Sådan fremprovokeres det:** Grundsagen. Vælg «Manuel procentsats» i brugerfladen (basisrækken oprettes), tast intet,
  og hent opgørelsen.
- **Det sker:** Ingen linje i «Fejl og advarsler», download aktiv. Papiret: «Beregnes som lønnen ved
  beregningsperiodens udløb (31-05-2018) tillagt efterfølgende lønstigninger. 01-01-2024 - 31-12-2024: 254 arbejdsdage á
  1.613,55 kr. = 409.841,70 kr.» – præcis «Ingen»'s beløb, og bilaget «Regulering» udgår. Ved «Manuelt angivet» spærrer
  samme tomme tabel med «Manuel regulering mangler: Grundløn».
- **Det er uhensigtsmæssigt fordi:** Brugeren har valgt en reguleringsform og har glemt satserne – det er den eneste
  rimelige læsning af en tom tabel. Kravet er seks år ureguleret, papiret påstår det modsatte, og de to manuelle former
  behandler den samme forglemmelse modsat.
- **Bedre ville være:** Som «Manuelt angivet» og BB-274: en procentsatstabel uden andre rækker end basisrækken spærrer
  med «Manuel procentsats mangler: angiv mindst én sats – eller vælg «Ingen»» og link til første tomme række.
- **Andre steder det kan gælde:** Ingen ud over de to manuelle former.

**Tilbagemelding**
Enig.

**Bemærkning (til orientering)**

«Manuelt angivet» med kun basisrækken spærrer bevidst ikke: dér er basisrækken brugerens egen løn, og valget kan være
brugerens måde at få Store Bededagstillægget med på en løn, der ikke er steget (det får man ikke med «Ingen» ved angivet
løn). Brugeren får i stedet den gule linje fra BB-302 om, at lønnen er regnet uændret. Sig til, hvis også den skal spærre.

**Supplerende tilbagemelding**
Det er et godt kompromis, som jeg accepterer.

### BB-304 – Et anciennitetstillæg uden dato eller sats forsvinder tavst, og opgørelsen trykker «Indtastning mangler»

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-37--en-manglende-sats-regnes-som-0--uden-et-ord` (og M-19's spejlvendte
  form, BB-214)
- **Prioritet:** **Høj**
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: «Anciennitetstillæg er slået til, men
  dato og sats mangler» (eller kun datoen/satsen) spærrer med link til det første tomme felt – på begge flader, uden rød ring.
- **Sådan fremprovokeres det:** Grundsagen med Industriens overenskomst. Slå «Ville skadelidte have opnået
  anciennitetstillæg efter beregningsperiodens udløb (31-05-2018)» til, og lad dato og sats stå tomme (eller udfyld kun
  datoen). Hent opgørelsen.
- **Det sker:** Ingen ring, ingen linje, download aktiv. Kravet er `558.770,79 kr.` – det samme som uden tillæg (med
  `1.000 kr./md.` fra `01-01-2020`: `584.549,15 kr.`). Bilaget «Regulering» trykker under «Særlige lønforhold»:
  «Anciennitetstillæg **Indtastning mangler**» (`reguleringSection.ts:205-215`).
- **Det er uhensigtsmæssigt fordi:** Brugeren har sagt ja til et tillæg, og programmet regner uden det. Papiret, der går
  til modparten, bærer programmets egen mangeltekst – en indrømmelse af, at opgørelsen er ufuldstændig, i et dokument,
  programmet selv lod hente.
- **Bedre ville være:** Som BB-274's afgørelse om den tomme feriesats: ingen rød ring på et felt, brugeren ikke har
  skrevet i, men en spærrende linje på Beregning – «Ansættelsesforhold 1: Anciennitetstillæg er slået til, men dato og
  sats mangler» – med link til det første tomme felt. «Indtastning mangler» kan så aldrig nå papiret.
- **Andre steder det kan gælde:** Samme blok under angivet løn (EO oplysninger) – uafprøvet, samme komponent og
  dokumentlinje.

**Tilbagemelding**
Enig

### BB-305 – En anciennitetsdato før reguleringsdatoen spærrer uden rød ring og uden link

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning` (reglen bor i
  validatoren, ikke på feltet; jf. hukommelsen «rød ring kræver et FieldIssue»)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: datoen får rød ring med «Datoen skal være
  efter beregningsperiodens udløb (31-05-2018)» og en linje med link; en dato efter erstatningsperioden får gul ring og linjen
  «Anciennitetstillæg: Tillægget opnås først efter erstatningsperioden og indgår ikke».
- **Sådan fremprovokeres det:** Industriens overenskomst, anciennitet slået til, dato `01-01-2010`, sats `1.000 kr.` pr.
  måned.
- **Det sker:** Feltet er neutralt. Boksen: «Ansættelsesforhold 1: Dato for anciennitetstillæg skal være efter
  beregningsperiodens udløb (31-05-2018)» – uden link, med et kortnummer, skønt sagen kun har ét kort. Download er grå.
  Feltets egen grænse er systemrammen `01-01-2005` – `31-12-2027`; den nedre grænse siger intet om reguleringsdatoen, den
  øvre er næste års udgang og afværger intet (`2030` er rød, men `2027` efter TAF-perioden passerer).
- **Det er uhensigtsmæssigt fordi:** Spørgsmålet over feltet siger selv «efter beregningsperiodens udløb (31-05-2018)», så
  programmet kender grænsen, men viser den ikke ved feltet, og brugeren må lede efter den dato, linjen handler om.
- **Bedre ville være:** Feltets nedre grænse er reguleringsdatoen: rød ring med «Datoen skal være efter
  beregningsperiodens udløb (31-05-2018)», og linjen i boksen bærer link til feltet. En dato efter TAF-periodens slutning
  får en gul ring: «Tillægget opnås først efter erstatningsperioden og indgår ikke».
- **Andre steder det kan gælde:** Samme felt under angivet løn (reference «skadedatoen» eller den angivne dato).

**Tilbagemelding**
Enig

### BB-306 – Når reguleringsgrundlaget ikke dækker datoen, får brugeren to linjer om ét problem – den ene med et internt rækkenavn, den anden ved et felt, der er rigtigt

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23, også bredt. **GENNEMFØRT** 2026-10-23: én linje pr. problem, med
  ringen på «Lønudvikling beregnes ud fra» (eller på en særlig fra-dato, som brugeren selv har sat): «Reguleringsdatoen
  (31-05-2014) ligger før den første sats i SBLON2, som er fra 01-01-2016 – vælg en anden reguleringsform». Kontroltabellens
  rækker står kun i «Fejl og advarsler», hvis intet felt melder problemet – og da med en almindelig sætning.
- **Sådan fremprovokeres det:**
  1. Skadedato `01-06-2014`, beregningsperiode `01-06-2013` – `31-05-2014`, SBLON2 (første sats `01-01-2016`).
  2. Grundsagen med «Manuel procentsats» og særlig fra-dato `01-07-2024` (midt i TAF-perioden).
- **Det sker:**
  1. «'Reguleringsværdi på beregningsperiodens udløb (31-05-2014) for TAF' er ikke angivet (først fra 01-01-2016)» med
     link til Lønindkomst, og «Til og med: Reguleringsdatoen ligger før reguleringsgrundlagets første sats (01-01-2016).
     Vælg en anden reguleringsform.» med link til EO oplysninger og rød ring på «Til og med».
  2. «Lønudvikling beregnes ud fra: TAF-perioden starter før reguleringsdatoen. Vælg en anden reguleringsform for at
     nedregulere.» og «'Reguleringsværdi på start-dato for TAF' er ikke angivet (først fra 01-07-2024)». Valgfeltet har
     ingen ring, selv om linjen er stilet som dets.
  Den første linje i hvert par er rækkebyggerens kontrolrække (`eoRowIndkomstRows.ts:766-801`), skrevet til
  kontroltabellen; den anden er dækningsreglen.
- **Det er uhensigtsmæssigt fordi:** Brugeren skal forstå, at to linjer med to links til to faner handler om samme ting.
  «Er ikke angivet» beder ham angive en «Reguleringsværdi», som intet felt hedder. Og den røde ring sidder i 1 på
  beregningsperiodens slutdato, som er korrekt – rettelsen er at vælge en anden form, ikke at ændre datoen.
- **Bedre ville være:** Én linje pr. problem, den med en handling i: «Reguleringsdatoen (31-05-2014) ligger før
  SBLON2's første sats (01-01-2016) – vælg en anden reguleringsform», med link til «Lønudvikling beregnes ud fra», der
  også bærer ringen. Kontrolrækkerne vises kun på kontroltabellen.
- **Andre steder det kan gælde:** Slutdatoens række (BB-302) og alle former med kildedækning; «Ansættelsesforhold N:»-linjer
  fra validatoren (BB-305).

**Tilbagemelding**
Enig. Og undersøg gerne bredere, om andre lignende problemer ville kunne opstå andre steder, og ret konsekvent overalt.

**Bemærkning (til orientering) – den brede gennemgang**

Rettet samme sted: den angivne løns røde felter (fx et løntrin på 99) får nu deres egen linje – før nåede de kun boksen,
når intet andet stod der; reguleringsdatoen efter kildens sidste sats er én linje ved formen i stedet for en linje uden
ring ved «Til og med» plus en kontrolrække; den tolererede slutdækning står kun som den samlede gule linje; en manglende
reguleringsdato meldes kun ved sit eget felt; og i sygeferiegodtgørelsen står tre fejl nu én gang hver (referenceperioden
før første sats, «samlet negativ», og «mangler» om en udfyldt men rød dato).

Ikke rettet: en **privat** overenskomst, der både giver kortets satser og lønudviklingen, og hvor reguleringsdatoen ligger
før overenskomstens første satsperiode, giver stadig to linjer – «… har ingen satser før X – vælg en senere reguleringsdato»
(satserne) og «Reguleringsdatoen … ligger før den første sats …» (lønudviklingen). De to råd peger hver sin vej, så jeg vil
ikke selv vælge, hvilken der skal vige: skal linjen om satserne stå alene og pege på «Evt. særlig fra-dato for regulering»?

**Supplerende tilbagemelding**
Hvis jeg forstår problemet korrekt, er der grundlæggende tale om to fejlmeddelelser, der handler om samme problem og begge afspejler samme budskab, men med forskelle i formuleringen - og jeg forstår ikke dit spørgsmål om, hvorvidt linjen skal stå alene og på på evt. særlig fra-dato. Mener du i forhold til hvad brugeren føres videre til ved at trykke på linket ud for fejlmeddelelsen? Jeg tænker, at link til overenskomst-feltet er mest hensigtsmæssigt, og kan bedst lide fejlmeddelelsen: «… har ingen satser før X – vælg en senere reguleringsdato».

**Gennemført 2026-10-23:** Ja, du har forstået det rigtigt, og ja, spørgsmålet gjaldt linket. Nu står kun «… har ingen
satser før X – vælg en senere reguleringsdato», og linket fører til «Vælg overenskomst». Linjen «Reguleringsdatoen … ligger
før den første sats …» vises ikke længere for samme problem – hverken som egen linje eller fra kontroltabellen.

*Til orientering:* har brugeren selv sat en «Evt. særlig fra-dato for regulering», står den samme ene linje ved det felt
og med rød ring dér – som afgjort i BB-275, fordi det er den dato, brugeren skal flytte. Der er stadig kun én linje.

### BB-307 – Manuel regulering på EO oplysninger: linket fører ingen steder hen, og en rød dato meldes kun som en følgefejl

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-19--rødt-læses-som-tomt-af-den-flade-der-låner-værdien` og M-33
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: linjen peger på basisrækkens celle, og
  hver rød celle i de manuelle tabeller får sin egen linje med rækkens navn, cellens tekst og link – på begge flader.
- **Sådan fremprovokeres det:** Angivet månedsløn `30.000`, «Manuelt angivet»:
  1. Basisrækken uden procenter, en række `01-04-2020` `31.000 kr.` med feriegodtgørelse `12,5`. Klik linket.
  2. En række dateret `01-04-2017` (før basisdatoen `01-06-2018`).
- **Det sker:** 1 «Manuel regulering mangler: Feriegodtgørelse/-tillæg» med link «EO oplysninger -> Indtægt før
  skadedatoen»: fanen skifter, intet blinker (målt nul hændelser), fokus på `body`. Linket peger på `feriePct` under angivet
  løn, som ikke har et felt på fladen; det manglende er basisrækkens celle. 2 Cellen er rød med en god tooltip, men boksen
  nævner den ikke – kun følgen: «'Reguleringsværdi på slut-dato for TAF' er ikke angivet (kun indtil 31-05-2019)». På
  Lønindkomst får samme to tilfælde en linje med link, der blinker cellen (målt).
- **Det er uhensigtsmæssigt fordi:** Samme tabel opfører sig forskelligt på de to flader, og på den ene får brugeren
  enten et link til ingenting eller en linje om en konsekvens i stedet for årsagen.
- **Bedre ville være:** Som på Lønindkomst: linjen peger på den celle, der mangler, og en rød celle i tabellen får sin egen
  linje med cellens tekst og link (BB-291's form).
- **Andre steder det kan gælde:** «Manuel procentsats» på EO oplysninger – uafprøvet, samme rækkekanal.

**Tilbagemelding**
Enig

### BB-308 – «Grundløn skal være større end 0 på alle manuelle reguleringsrækker» spærrer uden ring, uden link og uden række – og først når alt andet er rettet

- **Type:** Edge case
- **Rækkevidde:** Mønster → M-33 (sikkerhedsnettets form, BB-265) og BB-232's afgørelse
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: rød ring med «Grundløn skal være større
  end 0 kr.» og linjen «Manuel regulering, række 01-04-2019: Grundløn skal være større end 0 kr.» – sammen med de øvrige fejl.
- **Sådan fremprovokeres det:** «Manuelt angivet» med en række `01-04-2019` `0 kr.` (også `-31.000 kr.`). Først med
  sidste række i 2019, derefter med en ekstra række `01-04-2024` `36.000 kr.`
- **Det sker:** Cellen tager imod `0,00 kr.` og `-31.000,00 kr.` uden ring. Med sidste række i 2019 står kun BB-302's
  linje («kun indtil 31-03-2020»); først når den er løst, kommer «Grundløn skal være større end 0 på alle manuelle
  reguleringsrækker» – uden link og uden at sige hvilken række.
- **Det er uhensigtsmæssigt fordi:** Reglen er kendt, men vises hverken ved cellen eller sammen med de andre fejl. 12c's
  BB-232 navngav netop denne regel som samme form.
- **Bedre ville være:** Grundløn får grænsen «større end 0» på cellen: rød ring med «Grundløn skal være større end 0», og
  rækken meldes med periode og link («Manuel regulering, række 01-04-2019: Grundløn skal være større end 0»).
- **Andre steder det kan gælde:** Ingen ud over de to manuelle tabeller (procentsatsen har allerede 0–100 på cellen).

**Tilbagemelding**
Enig.

### BB-309 – Bilaget kalder en manuelt angivet grundløn «Timeløn»

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv` (samme form som C5 i
  reguleringsgennemgangen)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23, også bredt. **GENNEMFØRT** 2026-10-23: kolonnen hedder «Grundløn».
  Desuden: «Månedsløn: (A + B kr.) / N måneder» over løn plus offentlige ydelser hedder «Månedsindkomst»; «S/H» → «SH/SO»;
  «Store Bededag»/«st. bededagstillæg» → «Store Bededagstillæg»; «AG pens. bidrag»/«AG pension» → «AG-pension».
- **Sådan fremprovokeres det:** Grundsagen med «Manuelt angivet»: basis `30.000 kr.`, `01-04-2019` `31.000 kr.`,
  `01-04-2024` `36.000 kr.` Hent opgørelsen.
- **Det sker:** «Reguleringsværdier: Fra-dato **Timeløn** Feriegodtg./-till. 31-05-2018 30.000,00 12,50 % …». Skærmens
  kolonne hedder «Grundløn», og 30.000 er en månedsløn. Overskriften udledes af TAF-periodens enhed – arbejdsdage giver
  «Timeløn», måneder «Månedsløn» (`reguleringsPresentation.ts:217-227`) – fordi en manuel række ikke bærer en enhed.
- **Det er uhensigtsmæssigt fordi:** Modparten læser, at timelønnen var 30.000 kr. Programmet ved ikke, hvilken enhed
  brugeren har tastet, og påstår det alligevel.
- **Bedre ville være:** Ved «Manuelt angivet» hedder kolonnen «Grundløn», som på skærmen.
- **Andre steder det kan gælde:** Øvrige former uden `wageUnit` i reguleringsbeviset – uafprøvet.

**Tilbagemelding**
Enig, og undersøg gerne bredt, om der måtte være andre steder, hvor programmet blandter månedsløn, timeløn og grundløn sammen rent sprogligt, eller der vil kunne opstå situationer, hvor en ydelse navngives forkert, og løs gerne dem alle. Men gør det kort og simpelt - ingen lange komplicerede beskrivelser.

### BB-310 – Løntrin-finderen: datoen afgør svaret, men står tom; en dato efter de nyeste satser bruges tavst; og fundet kan ikke sættes ind

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23 med tilføjelse. **GENNEMFØRT** 2026-10-23: «Dato» starter på
  reguleringsdatoen; over resultaterne står «Lønsatser pr. 01-04-2018» (og «– de nyeste satser i programmet», når det er
  dem); ens beløb samles («Løntrin 50, alle grupper»); linjerne har hover og tooltip «Indsæt i programmet», og et klik (eller
  Enter/mellemrum) sætter løntrin og gruppe ind, lukker overlayet og sætter fokus i «Gruppe». Ét Ctrl+Z fortryder indsætningen.
- **Sådan fremprovokeres det:** Kort med KL-overenskomsten. «Find løntrin», Månedsløn `31.000`:
  1. Dato `01-06-2018` → Beregn. 2. Dato `01-06-2030` → Beregn. 3. `52.000`, dato `01-06-2024` → Beregn.
- **Det sker:** 1 «Løntrin 38, gruppe 4 – 30.986,17 kr.» øverst; 2 «Løntrin 27, gruppe 0 – 30.981,50 kr.» – satserne fra
  den nyeste tabel (`01-10-2026`) uden bemærkning; 3 fem ens linjer «Løntrin 50, gruppe 0 … 4 – 50.527,42 kr.». Datoen er
  tom ved åbning, og intet siger, hvilken dato brugeren bør bruge eller hvilken tabel svaret kommer fra. Resultaterne kan
  ikke vælges; trin og gruppe skal tastes af i kortet. På Lønindkomst husker finderen sine felter pr. ansættelsesforhold,
  på EO oplysninger ingenting (målt).
- **Det er uhensigtsmæssigt fordi:** Samme løn giver trin 38 eller trin 27 efter datoen, og trinnet bestemmer, hvordan
  lønnen reguleres. Den relevante dato er reguleringsdatoen, som programmet kender.
- **Bedre ville være:** «Dato» udfyldes med reguleringsdatoen («31-05-2018»), resultatet siger «Lønsatser pr.
  01-04-2018», en dato efter nyeste tabel giver «Nyeste satser er fra 01-10-2026», ens beløb samles til én linje
  («Løntrin 50, alle grupper»), og et klik på en linje sætter løntrin og gruppe ind i kortet.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Enig. Måske en meningsfyldt løsning kunne være, at på satsfinderen får rækkerne under 'Nærmeste lønsatser' hover-farve og -effekt, og gøres klik-bare med en tooltip om noget i stil med "Indsæt i programmet", som når man klikker på det, lukkes overlayet, og løntrin og gruppe indsættes i programmet, og gruppe-feltet får fokus.

**Bemærkning (til orientering)**

- En samlet linje («alle grupper» eller «gruppe 1 og 2») sætter kun løntrinnet ind; gruppen lades urørt, og fokus lander i
  «Gruppe», så brugeren selv vælger. Grupperne har samme løn på datoen, men programmet skal ikke gætte på én af dem.
- «55+» kan ikke sættes ind (løntrinsfeltet tager 1–55) og har derfor ingen hover.
- EO oplysninger husker fortsat ikke finderens felter mellem åbninger (Lønindkomst gør) – uændret.

### BB-311 – To rækker med samme dato i de manuelle tabeller tages imod uden et ord – procentsatserne lægges oven i hinanden

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-23--aggregatet-af-dublerer-tiden-men-ikke-pengene` (BB-289's afgørelse:
  «alle steder, hvor det kunne være aktuelt»)
- **Prioritet:** Mellem
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: to rækker med samme dato giver rød ring
  og spærrende linje på den seneste – «Der er allerede en række pr. 01-04-2019» – i begge manuelle tabeller. De to tabellers
  regler bor nu ét sted (`manualRegulationIssues.ts`), og de afveg også på udløb og tom tabel (BB-302, BB-303).
- **Sådan fremprovokeres det:** «Manuel procentsats» med to rækker `01-04-2019` `2 %`. Og «Manuelt angivet» med to rækker
  `01-04-2019`, `31.000 kr.` og `40.000 kr.`
- **Det sker:** Procentsatsen giver «x (100 % + 4,04 %)», `426.399,30 kr.` – begge rækker regnes. Ingen ring, ingen
  linje. Den manuelle tabel tager imod to lønninger på samme dato; hvilken der gælder, kunne ikke måles, fordi sagen
  spærres af BB-302.
- **Det er uhensigtsmæssigt fordi:** En kopieret række er den mest sandsynlige forklaring og øger kravet tavst; to
  forskellige lønninger på samme dag kan ikke begge være rigtige.
- **Bedre ville være:** Procentsats: en række med samme dato og sats som en tidligere får BB-289's gule ring og linje.
  Manuelt angivet: to rækker med samme dato er en rød fejl på den seneste: «Der er allerede en række pr. 01-04-2019».
- **Andre steder det kan gælde:** Ingen ud over de to manuelle tabeller.

**Tilbagemelding**
Ved både manuelt angivet regulering og manuel procentsats bør det give rød ring og blokerende fejl, hvis der indtastes to reguleringer på samme dato. Det lyder umiddelbart som om dette allerede er implementeret korrekt for 'manuelt angivet' - hvis det er tilfældet, skal samme gøres gældende for 'manuel procentsats'. du må i det hele taget gerne undersøge og vurdere fordelen ved at samle og koordinere kontrol og behandling af indtastninger for 'manuelt angivet' og 'manuel procentsats'. Som udgangspunkt vil afvigelser mellem dem bero på misforståelser og fejl.

**Bemærkning (til orientering)**

«Manuelt angivet» havde ikke reglen i forvejen: fundet viste, at den tog imod to lønninger på samme dato uden et ord (hvilken
der gjaldt, kunne ikke måles, fordi sagen var spærret af BB-302). Reglen er derfor indført i begge tabeller. Bemærk, at det
afviger bevidst fra indtægtstabellerne, hvor identiske rækker kun er gule (BB-289): en lønseddel kan forekomme to gange, men
en løn kan ikke reguleres til to værdier på samme dag.

**Supplerende tilbagemelding**
Det er korrekt og ønskelig adfærd, at ved regulering er det en blokerende fejl, der giver rød ring, hvis der indtastes to reguleringer med samme datoer. Hvorimod det ved lønindkomst og offentlige ydelser kun skal udløse gul ring, hvis to rækker er identiske, altså med samme dato og beløb.

### BB-312 – Hver manuel række kræver feriegodtgørelsen tastet igen, og en tom procentcelle viser «0,00 %»

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **AFVIST** af udvikleren 2026-10-23 for den automatiske udfyldning. Intet udfyldes automatisk.
- **Sådan fremprovokeres det:** Grundsagen med «Manuelt angivet» (feriegodtgørelse `12,5` i satsfelterne). Tast en række
  `01-04-2019` med kun grundløn `31.000`.
- **Det sker:** «Manuel regulering mangler: Feriegodtgørelse/-tillæg» spærrer; linket blinker cellen (godt). Basisrækken
  viser `12,50 %` låst, men hver ny række skal have satsen tastet igen. De tomme celler står med en grå «0,00 %», som
  ligner en indtastet værdi.
- **Det er uhensigtsmæssigt fordi:** Feriegodtgørelsen ændrer sig sjældent; brugeren skriver samme tal på hver række og
  får at vide, at noget «mangler» i en celle, der ser udfyldt ud.
- **Bedre ville være:** En ny række arver forrige rækkes procenter, som brugeren kan overskrive – eller en tom procent
  betyder «uændret fra rækken før». Den grå pladsholder i en procentcelle er «%», ikke «0,00 %».
- **Andre steder det kan gælde:** Pladsholderen «0,00 kr.»/«0,00 %» i øvrige tabellers tomme celler (gennemgående,
  ikke vurderet).

**Tilbagemelding**
Ikke enig. Felter i tabeller med manuel regulering/procentsats må ikke automatisk udfyldes, heller ikke feriegodtgørelse, selvom udvikling af procentsatsen er sjælden. Det vil dog ske en sjælden gang imellem. Du må gerne lave andre, sekundære forbedringer, men brugeren skal være tvunget til selv at indtaste de løbende reguleringer.

**Spørgsmål (afventer udviklerens svar) – den grå «0,00 %» i en tom celle**

Den anden halvdel af fundet er ikke besvaret: en tom procentcelle viser en grå «0,00 %», der ligner en indtastet værdi, og
linjen «Manuel regulering mangler: Feriegodtgørelse/-tillæg» peger på den. Jeg har ikke ændret den, fordi den grå
pladsholder er programmets fælles form for alle beløbs- og procentfelter («0,00 kr.», «0,00 %») – en ændring her alene vil
skille sig ud.
- *Valg A:* uændret.
- *Valg B (anbefalet):* en tom procentcelle viser kun et gråt «%» – i alle tabeller og felter, så formen er ens.
- *Valg C:* som B, og tilsvarende kun «kr.» i tomme beløbsfelter.

**Supplerende tilbagemelding**
Det vil for en bruger være helt uforståeligt, hvis der bare står et procenttegn uden noget tal foran. Tilsvarende med "kr." uden et beløb foran. Jeg tenderer mod at holde fast i A, altså uændret.

**Afgjort 2026-10-23:** valg A – uændret. Enig: et bart «%» eller «kr.» ville være sværere at forstå end i dag.

### BB-313 – En sats på 100 % og en grundløn ti gange de øvrige tages imod uden bemærkning

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23 med fundets grænser: en procentsats over
  10 % og en grundløn over ti gange rækken før (i datoorden) giver gul ring og en gul linje; ingen af dem spærrer.
- **Sådan fremprovokeres det:** «Manuel procentsats» `01-04-2019` `100`. «Manuelt angivet» `01-04-2019` `310.000 kr.` efter
  basis `30.000 kr.` (et nul for meget).
- **Det sker:** Procentsatsen: «x (100 % + 100 %)», `819.683,40 kr.` – kravet fordobles uden ring. Grundlønnen tages imod
  uden ring (beløbet blev ikke regnet færdigt, fordi BB-302 spærrer).
- **Det er uhensigtsmæssigt fordi:** En reguleringsprocent over ca. 10 % pr. trin er næsten altid en tastefejl
  (`10` for `1,0`), og den flytter kravet mest af alle felter på fladen.
- **Bedre ville være:** Gul, ikke-blokerende ring: procentsats over 10 % pr. række («usædvanligt stor regulering –
  kontrollér satsen»), og grundløn over ti gange forrige række efter BB-297's regel. Grænserne er udviklerens.
- **Andre steder det kan gælde:** «Evt. forhøjet grundløn udover løntrin» (`500 kr./time` = 80.165 kr./md. oven på en
  trinløn på 27.157 kr. tages imod).

**Tilbagemelding**
Enig.

**Spørgsmål (afventer udviklerens svar) – «Evt. forhøjet grundløn udover løntrin»**

Fundet nævnte også, at 500 kr. pr. time (80.165 kr. om måneden oven på en trinløn på 27.157 kr.) tages imod uden
bemærkning, men foreslog ingen grænse. Jeg har derfor ikke indført en. Forslag: gul ring og linje, når den forhøjede
grundløn er større end selve trinlønnen («Den forhøjede grundløn er større end løntrinnets løn – kontrollér beløb og
enhed»). Ja eller nej?

**Supplerende tilbagemelding**
Enig

**Gennemført 2026-10-23:** når den forhøjede grundløn – regnet om til løntrinnets enhed – er større end løntrinnets løn på
reguleringsdatoen, får feltet en gul ring, og «Fejl og advarsler» viser den gule linje «Den forhøjede grundløn er større
end løntrinnets løn – kontrollér beløb og enhed». Eksempel: trin 30, gruppe 2 med `500 kr.` pr. time giver advarslen;
`500 kr.` pr. måned gør ikke. Den spærrer ikke, og beregningen er uændret. Gælder begge flader.

### BB-314 – Papiret siger «tillagt efterfølgende lønstigninger», også når lønnen reguleres ned eller slet ikke

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: «… reguleret efter lønudviklingen før og
  efter denne dato», når noget af perioden ligger før reguleringsdatoen; «Opgøres på baggrund af lønnen …» uden regulering;
  ellers uændret – i forside, ansættelsesforhold og bilag.
- **Sådan fremprovokeres det:** Grundsagen med KRL KTO (kommuner) og særlig fra-dato `01-10-2024`. Og BB-303's tomme
  procentsats.
- **Det sker:** «Beregnes som lønnen på den manuelt angivne reguleringsdato (01-10-2024) tillagt efterfølgende
  lønstigninger. 01-01-2024 - 31-03-2024: … x (100 % - 5,08 %) …» – i forside og bilag. KL-bilaget forklarer den baglæns
  beregning; KRL's og de øvriges gør ikke. Uden regulering står samme sætning over et tal uden faktor.
- **Det er uhensigtsmæssigt fordi:** Sætningen beskriver en opregulering, og modparten ser en nedregulering lige under.
- **Bedre ville være:** «Beregnes som lønnen på … reguleret efter lønudviklingen før og efter denne dato», når nogen del
  af perioden ligger før reguleringsdatoen; uden regulering «Opgøres på baggrund af lønnen …» som ved «Ingen».
- **Andre steder det kan gælde:** `eoDateReferenceText.ts`-sætningerne i sygeferiegodtgørelsens afsnit (12j).

**Tilbagemelding**
Enig.

### BB-315 – «Løn på helligdage» står åben under angivet løn, men ændrer kun noget ved Overenskomst

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-35--et-synligt-felt-som-den-aktuelle-beregningsmåde-ikke-læser`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: under angivet løn vises og læses «Løn på
  helligdage» kun ved Overenskomst og «Manuelt angivet»; valget bevares og kommer igen med formen. Feltet står over
  «Lønudvikling beregnes ud fra» og dukker derfor op over valget, når en af de to former vælges.
- **Sådan fremprovokeres det:** Angivet månedsløn `30.000` og angivet dagsløn `1.500`, SBLON2. Skift «Løn på helligdage»
  mellem Almindelig løn, SH-udbetaling og Ingen.
- **Det sker:** Kravet er uændret i alle tre (`418.824,00 kr.` / `443.255,40 kr.`). Med Industriens overenskomst flytter
  samme skift kravet (`443.514,00` → `442.704,00 kr.`). Store Bededag-knappen skjules efter afklaringslog 9b, når den
  ingen virkning har; feltet, den afhænger af, gør ikke.
- **Det er uhensigtsmæssigt fordi:** Brugeren tager stilling til et spørgsmål, der under de fleste former intet betyder.
- **Bedre ville være:** Feltet vises (og læses) under angivet løn kun ved de former, der bruger det – efter koden
  Overenskomst og «Manuelt angivet» – med samme relevansregel som knappen.
- **Andre steder det kan gælde:** Lønindkomst-kortets «Løn på helligdage» ved Statistik/KRL/KL – bruges dér også til
  SH-dage i beregningsperioden og er derfor ikke en kandidat uden videre (12g).

**Tilbagemelding**
Enig

### BB-316 – Boksens linjer om lønudviklingen taler programmets sprog: «Regulering er sat til 'KRL'», «Gruppe er ikke valgt» og én mangel ad gangen

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne`
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: «Statistisk beregningsmodel er ikke
  valgt», «Satstabel er ikke valgt», «Løntrin og gruppe er ikke angivet» (eller hver for sig, «Gruppe er ikke angivet»), og
  overenskomstlinjen har link til knappen «Overenskomst». Hver linje fører til sit eget felt.
- **Sådan fremprovokeres det:** Lad henholdsvis «Statistisk beregningsmodel», «Satstabel» og «Vælg overenskomst» stå tom;
  lad løntrin og gruppe stå tomme ved KL-overenskomsten; slå kortets «Overenskomst» fra efter at have valgt formen
  Overenskomst.
- **Det sker:** «Regulering er sat til 'Statistik', men ingen statistisk beregningsmodel er valgt», «Regulering er sat til
  'KRL', men ingen KRL-satstabel er valgt» (feltet hedder «Satstabel», valget «KRL satstabel»). Ved trin og gruppe står kun
  «Løntrin er ikke angivet»; gruppen meldes først bagefter, og et talfelt kaldes «Gruppe er ikke valgt». Den slukkede
  overenskomst giver «Overenskomst skal slås til, når lønudviklingen beregnes ud fra overenskomst» uden link, mens blokken
  stadig viser «Overenskomst KL-overenskomsten …». Ingen af valgfelterne får ring (BB-274's afgørelse – i orden).
- **Det er uhensigtsmæssigt fordi:** Brugeren skal oversætte «Regulering» og 'KRL' til de felter, han ser, og rette ét
  felt ad gangen.
- **Bedre ville være:** Linjerne bruger feltets navn og nævner alle mangler: «Statistisk beregningsmodel er ikke valgt»,
  «Satstabel er ikke valgt», «Løntrin og gruppe er ikke angivet»; overenskomstlinjen får link til togglen.
- **Andre steder det kan gælde:** Validatorens parallelle tekster («Løngruppe skal være mellem 0 og 4», «Lønregulering
  skal vælges, evt. "Ingen"»), som ikke når boksen i dag.

**Tilbagemelding**
Enig

### BB-317 – Dokumentet «KRL Satstabeller» trykker alle fire tabeller, uanset hvilken der er valgt

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** **DELVIST GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: alle fire tabeller vises fortsat;
  den anvendte står med fed og «(anvendt)» i overskriften (PDF og Word), og alle tre satsdokumenter står ældste først –
  samme kronologiske orden som bilagene (BB-294).
- **Sådan fremprovokeres det:** «KRL satstabel» → «SHK (regioner)». Hent fra «Tilgængelige reguleringssatser».
- **Det sker:** «KRL Satstabeller» med fire kolonner – KTO og SHK for kommuner og regioner – alle datoer siden 2001,
  nyeste først. Intet markerer den valgte; regionskolonnerne er tomme før `01-10-2018`. KL-lønaftalerne trykkes ældste
  først, de øvrige dokumenter nyeste først.
- **Det er uhensigtsmæssigt fordi:** Brugeren vedlægger et bilag, hvor læseren skal gætte, hvilken af fire kolonner sagen
  bygger på.
- **Bedre ville være:** Dokumentet viser den valgte satstabel alene, med dens navn i overskriften, og alle tre
  satsdokumenter sorterer ens.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Delvist enig. Alle fire tabeller skal fortsat vises, men sorteringen skal være ens, og der må gerne være en fremhævelse af hvilken kolonne, der anvendes.

### BB-318 – Samme reguleringsprocent og samme omregning skrives på to måder i samme opgørelse

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (formen fra BB-078/BB-079)
- **Prioritet:** Lav
- **Beslutning:** **GODKENDT** af udvikleren 2026-10-23. **GENNEMFØRT** 2026-10-23: procenter med to decimaler («x (100 % +
  11,40 %)», «12,50 %») og beløb med øre i begge omregninger («500,00 kr./time x 160,33 = 80.165,00 kr./måned») – kun
  visningen er ændret. Bevidst uændret: offentlige ydelsers og KRL's reguleringsprocent, der står med kildens fire decimaler.
- **Sådan fremprovokeres det:** KRL KTO (kommuner); og KL-overenskomsten med forhøjet grundløn `500 kr.` pr. time og
  anciennitet `10 kr.` pr. time. Hent opgørelsen.
- **Det sker:** «Forventet indkomst» skriver «x (100 % + 11,4 %)», bilagets «Beregnet regulering» «+ 11,40 %». Under
  «Særlige lønforhold» står «Forhøjet grundløn + 500 kr./time x 160,33 = 80.165 kr./måned» og lige under
  «Anciennitetstillæg 10,00 kr./time x 160,33 = 1.603,30 kr./måned».
- **Det er uhensigtsmæssigt fordi:** Den, der afstemmer forside og bilag, møder samme tal i to skrivemåder, og to ens
  omregninger i to former.
- **Bedre ville være:** Én form pr. størrelse i hele opgørelsen: procenter med to decimaler, beløb med øre.
- **Andre steder det kan gælde:** Overenskomstsatserne i bilaget («12,5 %») mod Manuelt angivet («12,50 %»).

**Tilbagemelding**
Enig

## Overvejet uden fund

- **De syv former** giver hver deres felter; et skift væk og tilbage bevarer alle værdier uden dialog (målt), og en ny
  manuel form får sin basisrække i samme trin som valget.
- **Tomt valg** («Vælg...») giver «Lønudvikling er ikke angivet» med link og uden ring (BB-274's afgørelse).
- **«Tilgængelige reguleringssatser»** viser dækningen for Overenskomst, Statistik, KRL og KL; dokumentet «Regulering»
  er hentbart for overenskomster og modeller. Den grå knap siger «Indtastning mangler» uden detalje – BF-059's afgjorte
  generiske tekst.
- **Dækningens tolerance:** ILON12 (data til `30-09-2026`) med TAF til `15-10-2026` regnes med sidste niveau uden bemærkning
  – Indstillingernes «regnes for dækkende indtil 6 måneder efter udløb» og afklaringslog 4.
- **ILON12-noten** står under modelvalget og i bilaget (afklaringslog 4).
- **Særlig fra-dato midt i TAF-perioden ved SBLON2** giver 0 % for hele 2024 – indekset er årligt (K1), så det er korrekt.
- **Nedregulering** (KRL og KL med særlig fra-dato `01-10-2024`) regnes og vises; KL forklarer den baglæns kæde
  (afklaringslog 1–2). Kun sætningen over er et fund (BB-314).
- **Manuel procentsats i omvendt rækkefølge** sorteres og regnes ens (`436.891,25 kr.`), og bilaget viser «Dato Procent
  Indeks Akkumuleret» med basis `0,00 %`.
- **En manuel række efter TAF-perioden** påvirker intet – lønnen stiger først efter perioden.
- **Manuel dato før basisdatoen** på Lønindkomst: rød ring med «Datoen skal være senere end datoen i den låste første række
  (31-05-2018)», linjen «Manuel regulering: Dato» blinker netop cellen (målt).
- **Forhøjet grundløn og anciennitet** omregnes med 160,33 og vises i bilaget (afklaringslog 10a). At en forhøjet
  grundløn sænker kravet (`471.940,14` → `425.548,32 kr.` med `500 kr./time`), følger af pakkemodellen (afklaringslog 10)
  og er ikke vurderet.
- **To kort** med hver sin form: linjerne navngiver «Ansættelsesforhold 2», og linket blinker cellen (BB-278 virker).
- **Store Bededag-advarslen** vises ved Overenskomst, «Manuelt angivet» og reguleringsdato i 2024 – afklaringslog 9b.
- **Løntrin-finderen** åbnes fra begge flader, fokus vender tilbage til knappen ved Escape, og tegnværnet afviser
  bogstaver i beløbet. Overlayets «Overenskomst» viser kun navnet uden parter – for småt til et fund.
- **Anciennitetsblokken** vises kun ved Overenskomst – i overensstemmelse med motoren, som kun bruger tillægget dér.
- **M-09 bestået:** ved 1244×620 er `scrollWidth = clientWidth = 1244`.
- **Konsollen** var tavs: ingen runtime-fejl, signaler eller eksterne kald i seks målte forløb.

## Henvisninger til andre bidder

- **12g:** «Evt. særlig fra-dato for regulering» bærer dækningsfejlen, når den leverer reguleringsdatoen (BB-306).
- **12j:** sygeferiegodtgørelsens referencesats følger reguleringsformen (afklaringslog 8); BB-314's sætning kan gå igen.
- **12l:** bilagsvalget «Regulering» udgår ved 0 % (BB-303) uden at brugeren får det at vide på fladen.
- **12m:** kontrolrækkerne «Reguleringsværdi på … for TAF» hører på kontroltabellen (BB-306).

## Dækningshuller

- Kun Chrome, lyst tema; kun PDF-kanalen er læst (Word deler dokumentmodellen).
- RLTN- og Læreroverenskomsten, offentlig timeløn ud over løntrin-finderen, og ASL ud over sidste indeksår er ikke afprøvet.
- Erhvervssygdom («anmeldelsesdatoen») og komprimeringen ved opgørelse nr. 2 er ikke afprøvet.
- Gem/Hent-rundturen og tastaturrækkefølgen gennem blokken er ikke afprøvet.
- Anciennitet og manuel procentsats under angivet løn er kun læst i koden (BB-304, BB-307).

### Efterfølgende dækningstjek mod Brugerblik (2026-10-24)

- **Oprindeligt browsermålt:** Udvalgte reguleringsformer, satser og manuelle tabeller på begge indgange, løntrin-finderen fra begge steder, to kort og PDF-dokumenter. De målte eksempler omfatter flere, men ikke alle, valg, satser og afhængige tilstande.
- **Inventar og B0:** Rapporten kortlægger flader og felter, men giver ikke en komplet grænsevurdering for hvert felt af erklærede grænser, passende grænser og grænser udledt af sagens øvrige værdier. Enkelte afprøvede feltfejl dokumenterer kun de konkrete værdier.
- **B6a og kombinationer:** Kildeskift, tilbagevalg, manuelle reguleringer og enkelte tomme/manglende værdier er prøvet. Der er ikke dokumenteret en fuld tilstandsrække fra tom til delvis, gyldig og igen ryddet/ugyldig for alle former og begge indgange eller en udtømmende rækkefølgeprøve. Undo efter indsættelse fra løntrin-finderen er målt; generel tastaturrækkefølge og undo/redo efter kildeskift er ikke.
- **Kun kodeaflæst eller ikke prøvet:** Anciennitet og manuel procentsats under angivet løn er statisk gennemgået, ikke browsermålt. De konkrete manglende kilder, indeksår og erhvervssygdomsforløb står i de oprindelige huller.
- **Uddata, persistens og miljø:** Chrome headless og lyst tema; PDF blev læst, Word ikke. `.eo`-sager blev indlæst, men save→load-rundtur og sagsdata-sammenligning blev ikke prøvet. Edge, Firefox, WebKit og mørkt tema er ikke målt.
- **Efterfølgende audit:** Ingen yderligere konkret brugerfejl blev bekræftet i 12i.

#### Afstemning mod hele prøvekataloget A1–A8 og B0–B7

| Prøve | Browsermålt i den oprindelige kørsel eller efterfølgende audit | Kildeaflæst eller fortsat udækket |
|---|---|---|
| A1 – forventning | De syv reguleringsvalg, tilhørende felter, løntrin-finderens to indgange og udvalgte dokumentlabels blev set. | Ingen systematisk vurdering af alle labels, enheder eller om valg af form er forståeligt uden kendskab til programmets opdeling. |
| A2 – overblik og mangler | Tomt valg, manglende sats, skjulte fejl, manuelle tabeller, deaktivt dokument og «Indtastning mangler» blev målt i de konkrete fund. | Ikke alle færdig-/ikke-færdig-kombinationer eller årsager til inaktive felter/knapper er browserafprøvet. |
| A3 – rækkefølge | Formskift væk/tilbage, oprettelse af manuel basisrække og løntrin-finderens vej fra begge flader blev afprøvet. | Ingen systematisk inputrækkefølge af alle forudsætninger, navigation mellem faner eller fuldt slut-til-slut-flow for hver form. |
| A4 – tavshed | Skjulte felter, ikke-dækkende manuel tabel, tom procentsatstabel, manglende anciennitet og forskelle mellem viste og anvendte regulering blev konkret målt. | Ikke alle skjulte værdier er fulgt efter skift/rydning gennem beregning, alle dokumenter og load. |
| A5 – fejl | Udvalgte røde datoer/satser, manglende kilder, dobbelt besked, forkert link, dubletdatoer og ekstreme satser blev afprøvet. | Ingen komplet prøve af hver fejltekst, grænse, linkfokus og reparationsvej i alle syv former. |
| A6 – fortrydelse | Escape fra løntrin-finder og undo efter indsættelse fra finderen blev målt; formskift bevarede input. | F5, browser tilbage, save/load, alle feltsettle-forløb og undo/redo efter alle formskift er ikke afprøvet. |
| A7 – ensartethed | Skærm, PDF, Regulering/KRL/KL-dokumenter og labels mellem de to indgange blev sammenholdt i konkrete forløb. | Word blev ikke hentet; ingen fuld sammenligning af alle satstabeller, talformater og samme felt på alle søsterflader. |
| A8 – helhed | Flere reguleringsformer blev ført gennem resultat og PDF, og løntrin-finderens to brugerrejser blev gennemført. | Ingen samlet førstegangsbrugerprøve af begge indgange eller vurdering af det værste oversete valg for alle former. |
| B0 – grænser | Konkrete dato-/satsdækninger, tidligere manuel dato, dubletdatoer, 100 % og en grundløn ti gange øvrige blev prøvet. | Ingen komplet felt-for-felt-inventering af deklarerede, passende og kontekstafledte grænser for alle former. |
| B1 – feltinput | Udvalgte satser, datoer, manuel procentsats og forhøjet grundløn blev afprøvet; værktøjet afviste bogstaver i løntrin-finderens beløb. | Blanktegn, paste-støj, Unicode, ekstrem længde, formateringsvarianter, Escape/Enter/blur og hele grænsepartitioner er ikke dækket. |
| B2 – datoer | Manuel dato før basis, dækning efter sidste sats, særlig reguleringsdato og datovalg i løntrin-finder blev afprøvet. | Skudår, ugyldig kalenderdato, præcis før/på/efter alle grænser og ændring af dato efter afhængige felter er ikke prøvet samlet. |
| B3 – perioder/tabeller | Manuel tabel i omvendt orden, gentagne reguleringsdatoer, manglende tabelsatser og basisrækker blev målt. | Store tabeller, mange dubletter, tomme trailing rows, sletning med afhængigheder og redigering samtidig med indsættelse er ikke dækket. |
| B4 – kombinationer | Skift mellem de syv former og tilbage, to ansættelsesforhold, løntrin-finder og bestemte anciennitets-/feriesatskombinationer blev prøvet. | Ikke alle rækkefølger eller rydning/ændring af hver forudsætning; kombination med rejected input på andre flader er uafprøvet. |
| B5 – lovligt, usandsynligt | Procentsats `100` og grundløn ti gange øvrige blev målt; udvikleren godkendte gul advarsel for den store løn. | Andre faktor-10/1000-beløb, alder/datoer langt fra sagen og plausibilitetsbånd for hver form er ikke afsøgt. |
| B6 – tilstandsskift | Finder åbnet fra begge indgange, Escape/fokusretur og undo efter indsættelse blev målt. | Navigation med åben editor, F5, browser tilbage, save/load, reset, hurtigt gentagne handlinger og alle undo/redo-skift er ikke prøvet. |
| B6a – tomhed | Tomt reguleringsvalg, manuelle tabeller uden satser og manglende anciennitetsfelter blev prøvet i konkrete forløb. | Ingen systematisk tom → kun formateringsvalg → kun afvist input → delvis → gyldig → ryddet rækkeprøve for hver af de to tabeller og begge indgange. |
| B7 – nedstrøms | Regulering og forventet indkomst blev fulgt til PDF; løntrin-finderens valg og satstabeller indgik i konkrete output. | Word ikke læst; ingen save→load-rundtur med data-sammenligning; ikke alle felter i alle former er fulgt gennem beregning og hvert dokument. |

Der blev kørt seks browserforløb i den oprindelige gennemgang; matricen gør ikke kilde- eller unit-testbeviser til browserdækning.

## Åbne spørgsmål

Ingen. Fundenes egne valg og de fire tillægsspørgsmål (BB-301, BB-306, BB-312, BB-313) er afgjort 2026-10-23.
