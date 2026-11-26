# Mineo – kontrakt for inputfelters brugeradfærd

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Mere specifikke domænekontrakter kan supplere denne kontrakt. Den er underordnet `form-contract.md`, `mineo-field-pattern.md`, `date-contract.md`, `amount-contract.md`, `error-contract.md` og `keyboard-navigation.md` for deres arkitekturelle emner; ved konflikt ejer dette dokument den her beskrevne brugeradfærd for de navngivne felter.  
**Senest verificeret mod kode:** 2026-11-26

Dette dokument beskriver den autoritative brugeradfærd for inputfelter og kontroller. Generelle regler (§1–§2)
gælder alle felter; feltspecifikke regler (§3–§8) gælder de angivne felter.

## 1. Begreber og fælles livscyklus

### 1.1 Afsluttet input

- En åben editor kan indeholde en tom, delvis eller ugyldig draft. Draften må ikke drive beregning,
  validering, fejlvisning eller download-gate.
- Et felt afsluttes ved blur eller Enter. Tab og klik uden for feltet følger samme afslutning, når de forlader
  feltet. Escape annullerer hele den igangværende redigering og gendanner tilstanden fra editorens åbning.
- Et gyldigt resultat gemmes som canonical værdi. Et ugyldigt formatresultat gemmes som afsluttet rejected
  tekst uden en samtidig ikke-tom canonical værdi.
- En korrekt formateret værdi, der kun bryder en aktiv range-, kronologi- eller anden domænegrænse, bevares
  som canonical værdi og markeres med rød feltfejl og konkret tooltip.
- Manglende værdi er ikke automatisk en rød feltfejl. Om tomhed giver en samlet fejl, en gul advarsel eller ingen
  feedback, afgøres af det konkrete felt og den consumer, der kræver værdien.

### 1.1a Totrins-aktivering – også for transiente felter

Et felt åbnes i **to trin**: første klik fokuserer feltet, andet klik (eller et lovligt starttegn, eller
Delete/Backspace) åbner editoren. Et lukket felt er `readOnly`, viser ingen caret og bruger peger-markør.

Reglen gælder **alle** redigerbare felter – også de transiente (overlay- og hjælpefelter, som ikke er
sagsdata). Transiensen angår, hvor værdien lever, ikke hvordan feltet tager imod: to felter side om side i
samme lille vindue må ikke opføre sig forskelligt.

Totrinsmodellen bærer Escape-reglen (`keyboard-navigation.md` §Escape): Escape i en åben editor annullerer
indtastningen, Escape i et lukket felt passerer videre til fladen udenom. Et ettrins-felt er altid «åbent» og
ville opsluge Escape, så det omgivende overlay ikke kunne lukkes.

Åbningstegnene udledes af feltets eget tegnsæt (dets `admission`), ikke skrevet i hånden pr. felt: ellers kan
et felt åbne på et tegn, det afviser i næste øjeblik.

### 1.2 Tegn- og længdeblokering

Et felt, brugeren skriver i, blokerer tegn, der ikke passer til feltets tegnsæt og maksimale længde:

1. Et tegn, som feltets tegnsæt ikke tillader, kommer ikke ind i feltet – hverken ved tastning eller paste.
2. Et tegn ud over feltets maksimale antal tegn, cifre eller decimaler kommer ikke ind i feltet.
3. Blokeringen er tavs: ingen rød ring, ingen fejltekst og ingen tooltip, fordi tegnet aldrig blev en del af
   værdien.

**Blokeringen er modalitetsuafhængig.** Den gælder tegnet, ikke tastetrykket. Et mobilt skærmtastatur skriver
tegnet direkte i `<input>` og fyrer kun et `input`-event; en efterfølgende `keydown` bærer
`key === 'Unidentified'`, som et tegnfilter skal lade passere af hensyn til IME/composition. Værnet ligger
derfor på draft-ændringen (`onDraftChange`) med feltfamiliens prædikat som kilde. Et keydown-filter er kun et
ekstra, caret-bevarende værn og afledes af samme prædikat (`keyFilterFromAdmission`), så tastning, paste,
tabelceller og transiente felter følger samme regel. Prædikaterne bor i `src/components/inputs/draftAdmission.ts`.

**Blokeringen omfatter tegnsæt og længde, ikke talværdi.** En korrekt formateret værdi inden for længdegrænsen,
der bryder en range-, kronologi- eller domænegrænse, kan indtastes og bevares canonical med rød ring efter
§1.1. En méngrad på `121` eller en dato uden for feltets grænser skal kunne indtastes og give en synlig rød fejl.

**Decimalkommaet er altid et lovligt tegn i beløbs- og procentfelter.** Også et felt uden decimaler tager imod
komma og op til to decimaler og afrunder ved settle. Blev kommaet sprunget over, ville decimalerne glide op i
heltalsdelen (`400.000,00` → `4.000.000`) uden rød kant eller besked.

**Grænserne er lofter, ikke tilladelser.** Et felt med færre cifre, et lavere maksimum, forbud mod negative
beløb eller krav om fx delelighed med 1.000 beholder sin strengere regel. En skarpere tegn- eller
længdegrænse blokeres ved indtastningen; en skarpere talværdi- eller domæneregel bliver en canonical rød fejl.

**Grænserne gælder kun brugerens indtastning.** Beregnede, afledte, sammentalte og opregulerede værdier må frit
overskride den grænse, der gælder for det felt, de stammer fra – en sum af lønbeløb tæt på 7-ciffergrænsen er
større end hvert enkeltbeløb, og det er korrekt. En read-only celle, en totalrække eller en resultatvisning
viser det fulde tal uden afkortning eller rød markering. Grænsen for et beregnet beløb er beløbskontraktens
repræsentationsværn (`amount-contract.md` §3). Programmatisk skrivning, `.eo`-load og motorernes output er ikke
tastning og følger deres egne kontrakter.

### 1.2a Paste – samme afgrænsning som tastning

Paste behandles, som hvis brugeren havde tastet den indsatte tekst ét tegn ad gangen fra samme startposition:

1. Tegnene behandles i rækkefølge fra det første tegn.
2. Et tegn, som feltet ville afvise ved tastning, springes over, og paste fortsætter med næste tegn.
3. Præcisions-, ciffer-, tegn- og længdegrænser håndhæves undervejs efter §1.2. Tegn, der ikke længere kan
   rummes, springes over, mens efterfølgende input fortsat vurderes. Et paste, der afkortes af feltets længde,
   er derfor det forventede resultat og ikke et datatab.
4. Er det filtrerede resultat formatmæssigt ugyldigt ved settle, bevares det som afsluttet fejltekst med rød
   ring og tooltip. Det må ikke tavst ændres til en anden gyldig værdi.
5. Bliver paste-resultatet tomt, er paste et no-op – i et lukket felt og i en åben editor. En eksisterende værdi
   forsvinder ikke, fordi clipboard-teksten kun indeholder afviste tegn; rydning kræver Delete/Backspace.
6. **Samme tekst giver samme resultat.** Når paste erstatter hele værdien, må resultatet ikke afhænge af den
   tidligere værdi, og der må ikke findes en regel, der leder efter et velformet delelement i teksten (fx «find
   årstallet»).

   Indsættelse må være mere tolerant end tastning: tastning må ikke tolke på det tredje ciffer (`16` kan være
   både den 16. og den 1. juni), mens indsættelse kender hele teksten og kan normalisere den, når den
   uomtvisteligt kan opløses til én sikker værdi. Derfor gælder:

   - **Tilladt:** en familie-normalisering af en paste, der erstatter hele værdien. Datofamiliens
     segmentfordeling (`010623` → `01-06-23`, `normalizeDatePaste`) er den eneste.
   - **Forbudt:** at samme paste giver to forskellige resultater. Fortolkningen afgøres af, om paste'en
     efterlader noget af brugerens eksisterende tekst – ikke af, om editoren er åben. Et lukket felt og en åben
     draft med hele teksten markeret (Ctrl+A) er samme situation. Beslutningen ejes af
     `resolvePasteContextDraft` (`inputCore/react/pasteSplice.ts`) og gentages ikke på et kaldssted.

   Tilsigtede konsekvenser, der ikke skal «rettes»:
   - Et årsfelt, der får en dato indsat (`01-02-2026`), optager de fire første cifre (`0102` → 102) og markeres
     rødt – som hvis brugeren havde tastet tegnene.
   - Cifre samles på tværs af sprungne tegn: `2.026` bliver `2026`.
   - Et paste kan efterlade en draft, som settle afviser (punkt 4).
   - En paste midt i en draft, eller som kun erstatter en del af den, får ikke familie-normaliseringen.
   - Der varsles ikke, når en indsættelse tavst fjerner et fortegn eller et tusindtalspunktum, som feltet ikke
     tager imod (afvist ønske): indsættelse følger tastning.
7. **Tabulator og linjeskift afslutter en indsættelse i et typed enkeltlinjefelt.** I beløbs-, procent-, tal-,
   dato-, års-, uge- og brøkfelter bruges kun teksten frem til første tabulator eller linjeskift efter første
   synlige tegn; adskillelser før det springes over (`1200<TAB>200` giver `1200`, og en celle kopieret med
   afsluttende linjeskift giver sin værdi). Frie tekstfelter er ikke omfattet (`takeFirstPastedEntry`).

For frie tekstfelter normaliseres clipboard-teksten først tabsfrit – både ved lukket paste og i en åben editor:

- Windows- og Unix-linjeslutninger bliver én intern linjeslutning. Ikke-brydende mellemrum, smalle mellemrum,
  øvrige Unicode-mellemrum og tab bliver almindelige mellemrum.
- Zero-width space, BOM og soft hyphen fjernes. I enkeltlinjefelter bliver linjeskift mellemrum; kun de tre
  kommentarfelter bevarer linjeskift.
- Gentagne mellemrum kollapses. Der trimmes ikke før settle.

Paste i et fokuseret, lukket felt erstatter værdien og committer straks. Paste i en åben editor indsættes ved
markørens position og følger editorens almindelige settle ved blur/Enter.

### 1.3 Fejl og feedback

- Formatfejl, rangefejl og domænefejl vises som rød ring og tooltip ved hover. Der vises ikke
  inline-valideringstekst under feltet.
- Tooltips for bounds- og domænefejl er konkrete og viser relevante værdier eller grænser, fx den modgående dato.
  En ugyldig kalenderdato viser fejltilstanden uden at blive ændret til en anden dato.
- Ikke-blokerende forhold vises som gul ring og/eller gul linje i sidens «Fejl og advarsler». En advarsel giver
  ikke rød ring og blokerer ikke beregning, dokument eller `.eo`-save.
- En åben draft giver ingen live-fejlfeedback. Ved lukket paste ses feedback straks, fordi paste afslutter feltet.
- En advarsel om en usandsynlig værdi gives kun, hvor værdien er usandsynlig i sagens egen sammenhæng – aldrig på
  et opslagsfelt. Et nul, der er en ydelses velkendte resultatform, er ikke en fejl; et nul, der dækker over en
  umulig mellemregning, forhindres af en grænse på feltet.

### 1.4 History, gentagelser og skjulte værdier

- Én brugerhandling giver højst ét undo-trin.
- En toggle-, radio- eller dropdownændring, der ændrer flere relaterede værdier, kan fortrydes samlet, når
  feltets særlige regler kræver det.
- Hurtige gentagne klik eller tastetryk må ikke udføre samme gyldige overgang dobbelt.
- Et skjult felt bevarer en gyldig værdi og viser den igen, når feltet bliver synligt. En skjult værdi med rød
  feltfejl slettes, så en fejl ikke kan gemme sig og blokere en handling, brugeren ikke kan rette
  (`form-contract.md` §7).

### 1.5 Autofill-suggest i tabelceller

Autofill er aktiv i løntabellerne (Årsløn og erstatningsopgørelsens ansættelsesforhold), Offentlige ydelsers
ydelsestabel og renteberegningens kravtabel (Renteberegning og MinProcesrente). Reglerne er de samme i alle
tabeller og implementeret ét sted. Autofill vises aldrig i MinProcesrentes mobilopstilling (providerens
`enabled` følger samme enhedsgenkendelse som opstillingen), og Mineo vises slet ikke på mobil. Forslaget er kun
en synlig ghost i den fokuserede, tomme celle. Enter indsætter den viste værdi; øvrig navigation og accept
følger reglerne nedenfor og `keyboard-navigation.md`.

#### Fælles adgangskrav

- Målcellen skal være tom, redigerbar og umiddelbart under en brugbar, afsluttet værdi i samme kolonne.
  Draft, rejected tekst, ugyldige værdier og røde feltfejl tæller ikke som brugbare prøver.
- Mønstret genkendes ud fra de to rækker umiddelbart over målet. Begge celler skal indeholde brugbare prøver.
  En tom eller ugyldig celle afbryder prøven; der springes ikke over rækker for at finde ældre værdier. Med
  færre end to prøver gives intet forslag.
- Modellen følger den viste rækkefølge. Den gætter ikke bagud og udfylder ikke celler, som ikke har fokus.
- Forslaget formateres og accepteres gennem målfeltets codec. Forslag uden for feltets repræsentation vises ikke.

#### Perioder

| Værditype | Genkendt skridt |
|---|---|
| Dato | Præcis 7, 14 eller 28 kalenderdage, eller én kalendermåned |
| Uge/år | Præcis 1, 2 eller 4 ISO-uger |
| Måned/år | Én kalendermåned |
| Måned uden år | Én måned frem eller tilbage, med wrap mellem 12 og 1 |

Begge prøver skal vise samme skridt og retning. Andre spring, gentagelser, manglende prøver og retningsskift
giver intet forslag. Uge- og datofremskrivning bruger kalenderaritmetik, så 52/53-ugers år, skudår,
31-dages måneder og årsskifter fortsætter korrekt. En månedsdato bevarer sin nominelle dag eller
sidste-dag-form gennem februar.

Måned og år er én serie. Året følger den fremskrevne måned over årsskiftet. Har målcellen for år allerede en
måned, er årsforslaget det år, der placerer denne måned på den genkendte næste position. Et årstal uden to
gyldige måned/år-prøver kan ikke foreslås alene.

Fra- og til-datoer følges ad, når de to foregående perioder er sammenhængende: anden periodes start er dagen
efter første periodes slut, og til-datoerne har et genkendt skridt. Da sættes næste fra-dato til dagen efter
seneste til-dato. Ellers må fra-datoen kun fortsætte sit eget genkendte skridt, så næste fra-dato ikke kan
falde inde i den seneste periode (23-05 efter en periode, der slutter 24-05).

#### Beløb og dropdownvalg

- Et beløb foreslås kun, hvis de to umiddelbart foregående beløbsceller begge har brugbare og numerisk
  identiske værdier. Udtryk sammenlignes på deres canonical talværdi.
- Er målrækkens kendte indtjeningsperiode længere end en af perioderne, der bar de to ens beløb, vises beløbet
  ikke – samme total må ikke foreslås for fem uger efter to fireugersperioder. Er alle tre perioder hele
  kalendermåneder (fx 01-04 til 30-04 eller 15-01 til 14-02), måles de i måneder, så april efter januar og
  februar ikke tæller som længere; ellers måles i kalenderdage. Er målrækkens periode ikke udfyldt, kan
  sammenligningen ikke foretages.
- Et beløb uden tilknyttet periode (renteberegningens krav) og et heltal (tillægstiden) gentages kun, når de
  to foregående værdier er ens. Tillægstiden kræver desuden samme enhed i begge foregående rækker og
  målrækken; to gange 2 måneder foreslår derfor ikke 2 i en ny række med enheden Dage.
- Krydser en periode et årsskifte eller grænser ved 31. december/1. januar eller 28./29. februar/1. marts, må
  forskellige beløb over grænsen foreslå den seneste værdi. Både de to beløbsceller og periodens relevante
  datoer skal være brugbare. Det dækker forventelige lønændringer ved 1. januar og 1. marts. Reglen om længere
  perioder gælder stadig, når beløbene er ens.
- Ydelsestype-dropdownen gentager kun, når de to foregående celler har samme aktuelle, valgbare katalogværdi.
  Ældre eller deaktiverede valg foreslås aldrig.

Et foreslået beløb vises med feltets sædvanlige tusindtalsseparator; acceptteksten følger beløbsfeltets
tegnregler. Forslaget kopierer aldrig et oprindeligt regneudtryk.

#### Visning, accept og afgrænsning

Ghosten vises kun, når cellen har fysisk fokus, er tom efter afsluttet tilstand og ikke har en åben draft.
Den forsvinder, når fokus flyttes, eller brugeren begynder at skrive. Enter accepterer den viste værdi uden at
flytte fokus; `Shift+Enter`, Tab, pile og klik accepterer den ikke. Dropdownens åbne menu ejer sine normale
taster.

Forslaget kontrolleres ikke mod aktive domænegrænser og kan derfor få feltets sædvanlige røde issue, præcis som
en manuelt indtastet værdi. Autofill gemmer ingen historik og skriver intet, før brugeren accepterer.

### 1.6 Dynamiske rækker – tomhed, afvist input og manglende partnerfelter

- En række med canonical indhold eller rejected råtekst er brugerindhold i UI'et: den kan slettes, sorteres som
  indhold og udløser en trailing tom række. Beregningsprojektioner må skjule rejected værdier, men de må ikke
  bruges som UI'ets tomhedstest. Den ene prøve er readerens `hasEntityInput` over collectionens tomhedsregel.
- **Et valg i en dropdown, der ikke kan være tom, gør ikke alene en række udfyldt** – heller ikke et valg, der
  ikke er standardvalget. Et valg i en dropdown, der kan være tom, gør rækken udfyldt. Eksempler:
  EET-afgørelsestabellens «FS tilbageholdt EET» og rentekravenes tillægstidsenhed tæller ikke; Offentlige
  ydelsers «Ydelsestype» tæller.
- En delvist udfyldt række får ikke rød ring på et tomt partnerfelt alene, fordi en anden celle i rækken er
  udfyldt. Manglen vises af den beregning eller download-gate, der kræver den komplette række. Feltet bliver
  fortsat rødt for sit eget format, sin egen grænse eller en konkret tværgående regel, den aktuelle værdi bryder.

## 2. Universelle regler for feltfamilier

### 2.1 Datofelter

- Datoer redigeres med dag, måned og år. Dag og måned har højst to cifre, år højst fire.
- Punktum, mellemrum, skråstreg og tilsvarende separatorer omdannes til bindestreg. Gentagne bindestreger
  afvises efter den første; paste fortsætter gennem dem. Separatorer før det første tal ignoreres og giver ikke
  i sig selv fejl.
- `12-2-2026` er gyldigt input og formateres ved Enter, blur eller lukket paste til `12-02-2026`.
- **En indsættelse, der erstatter hele værdien, fordeles i segmenterne dag/måned/år** (§1.2a punkt 6).
  `010623` bliver draften `01-06-23` (og `01-06-2023` ved settle), mens de samme tegn tastet bliver `01` og
  markeres rødt. Fordelingen gælder både et lukket felt og en åben draft, hvor alt er markeret. En indsættelse
  midt i en draft splices ind tegn for tegn.
- Tocifrede år fortolkes efter den fælles tocifrede-årspolitik (§2.9) og vises med fire cifre ved settle.
- Et femte årsciffer eller et tredje dag-/månedsciffer kommer aldrig ind i feltet.
- En ugyldig kalenderdato som `31-02-2026`, `00-02-2026` eller `12-00-2026` bevares som fejltekst ved settle.
- Begge rangegrænser er inklusive, medmindre feltet angiver andet. En dato uden for en aktiv grænse bevares og
  markeres rødt; den ændres ikke til nærmeste gyldige dato.
- Paste af kun ugyldige tegn ændrer ikke feltets værdi og giver ingen fejl.
- Er feltets øvre grænse kalenderens dags dato, siger grænseteksten «dags dato». En udledt grænse, der
  tilfældigvis falder på i dag, navngiver sin kilde (fx beregningsdatoen). Grænseteksternes ordlyd ejes af
  `date-contract.md`.

**Hvert datofelt erklærer sine grænser, og erklæringen er håndhævet.**

- Grænserne erklæres som `dateBounds(spec)` (`src/inputCore/catalog/dateBoundsValidators.ts`), der leverer
  erklæringen og dens validator samlet, så de ikke kan komme fra hinanden.
- Et felt uden en skarpere domæneregel bruger systemrammen `dateRange_systemramme` (01-01-2005 til 31-12 året
  efter indeværende). Rammen fanger et forkert århundrede uden at påstå en juridisk grænse.
- Et felt uden reelle grænser fravælges aktivt med `unconstrainedDateBounds('<begrundelse>')`.
- `src/__tests__/inputCore/dateFieldsDeclareBounds.test.ts` måler adfærden: hvert datofelt i
  produktionskataloget skal faktisk afvise en dato uden for sine egne erklærede grænser.

**Knappen «Indsæt dags dato».** Knappen indsætter dags dato gennem feltets normale settle-vej og beholder selv
fokus. Den må aldrig indsætte en dato, feltet selv afviser: ligger dags dato efter feltets øvre grænse eller før
en nedre grænse, er knappen inaktiv med årsagen i tooltip – «Der kan kun foretages beregninger frem til
<dato>» henholdsvis «Dags dato er før <grænsens navn> (<dato>)». Årsagen udledes af
`resolveInsertTodayDisabledReason` (`src/utils/insertTodayDate.ts`). Varige mén, Erhvervsevnetab,
Forsørgertab og Renteberegning afprøver den øvre grænse (satsdækningen). Forsørgertab afprøver desuden
virkningsdatoen og skade-/anmeldelsesdatoen som nedre grænser, Renteberegning seneste rentedato. Varige mén og
Erhvervsevnetab behøver ingen nedre afprøvning: deres nedre grænse er satsdatasættets første år henholdsvis
skade-/anmeldelsesdatoen, som selv højst kan være dags dato.
Erstatningsopgørelsens knap er undtaget (§4.6).

### 2.2 Beløbsfelter og beløbsudtryk

- Et beløb må indeholde cifre, komma, matematiske operatorer (`+`, `-`, `*`, `/`, `x`) og parenteser. `x` er
  multiplikation på lige fod med `*`.
- Punktum, mellemrum, bogstaver, `kr.` og `%` blokeres ved tastning og springes over ved paste.
- Minus i begyndelsen er negativt fortegn; minus mellem tal er subtraktion. Plus foran første tal er ugyldigt.
- Hvert talled har højst ét decimalkomma og højst to decimaler. `1,5 + 2,5` er lovligt; `1,2,3` blokeres ved det
  andet komma i samme talled.
- Et afsluttende komma normaliseres ved settle (`123,` bliver `123,00`). `123` vises som `123,00`, `123,4` som
  `123,40`, og indledende nuller normaliseres.
- Ufuldstændige eller syntaktisk ugyldige udtryk bevares som fejltekst ved settle – fx `5000-`, `5000+`,
  `5000*`, `5000/`, `(5000` og `5000)`. Gentagne operatorer (`5000--200`, `5000+-200`) og et alene stående minus
  giver rød formatfejl. `0` er et gyldigt beløb.
- Division med nul bevares som fejltekst med tooltippen «Beløbet kan ikke beregnes, fordi der divideres med 0»
  og blokerer, hvor beløbet indgår.
- Hele udtrykket må højst være 512 tegn («Det indtastede må højst være 512 tegn langt»).

**Højst 7 heltalscifre og 2 decimaler pr. talled.** Største beløb er `9.999.999,99`, og et felt med negative
værdier rummer tilsvarende `-9.999.999,99`. Det 8. heltalsciffer og den 3. decimal i et talled kommer ikke ind i
feltet; overskydende cifre springes over ved paste uden at forhindre senere operatorer og tal. Et syntaktisk
gyldigt udtryk, hvis beregnede resultat ligger uden for intervallet, bevares canonical med rød ring og tooltippen
«Beløbet kan ikke overstige 9.999.999,99 kr.» henholdsvis «Beløbet kan ikke være mindre end -9.999.999,99 kr.»
og blokerer de beregninger og dokumenter, hvor beløbet indgår.

**Fortegn.** Om et minustegn kan tastes som fortegn, afgøres af feltets codec (`form-contract.md` §8.2). Et
udtryk er ingen vej uden om fortegnsreglen: et negativt resultat (`100-200`) i et felt, der ikke tillader
negative beløb, bevares canonical med feltets røde grænse – «Værdi skal være 0 kr. eller højere» eller, hvor 0
heller ikke er tilladt, «<emne> skal være større end 0 kr.».

### 2.3 Procentfelter

- Procentfelter accepterer cifre og dansk komma. Punktum, mellemrum, procenttegn og øvrige tegn blokeres ved
  tastning og springes over ved paste.
- Et procentfelt rummer højst 3 heltalscifre og 2 decimaler. Det 4. heltalsciffer og den 3. decimal kommer ikke
  ind i feltet. Et felt uden decimaler afrunder ved settle (§1.2).
- Et afsluttende komma færdiggøres ved settle; afsluttede værdier i et decimalfelt vises med to decimaler.
  Indledende nuller normaliseres.
- En værdi uden for feltets interval bevares canonical med rød ring og konkret tooltip om intervallet og
  blokerer beregning og download, hvor værdien har betydning: `101` i et 0–100-felt kan indtastes og giver en
  synlig rød fejl.
- **Formodningsregel:** et procent-inputfelt har maksimum 100 %, medmindre feltet udtrykkeligt angiver andet.
  Feltet kan angive et højere eller lavere maksimum og sit eget minimum; angivelsen skal være udtrykkelig, så et
  interval aldrig opstår ved en forglemmelse. Méngrad er den kendte fravigelse opad (op til 120 %, heltal;
  `varigemen-contract.md` ejer intervallet). Formodningen ændrer aldrig antallet af tilladte cifre.
- Formodningen gælder kun inputfelter. **Beregnede** procentsatser – fx akkumulerede reguleringssatser ved TAF –
  kan lovligt overstige 100 % og er hverken bundet af maksimum eller af de 3 cifre. Et inputfelt, hvis domæne
  kræver værdier over 999, hører ikke til procentfamilien og skal have sin egen erklærede længde.
- I «EET % (hvis afviger fra ASL)» betyder 0 «ingen afvigelse» og canonicaliseres til tom uden besked. Det er
  feltets egen regel; andre procentfelter behandler 0 som en værdi.

### 2.4 Brøkfelter

- Formatet er tæller/nævner. Tæller og nævner kan hver indeholde cifre og komma; der er højst én skråstreg.
- Punktum, mellemrum, fortegn og øvrige tegn blokeres ved tastning og springes over ved paste. Negative tal er
  forbudt.
- Hver del har højst 10 heltalscifre og 10 decimaler.
- Tæller 0 og nævner 0 afvises med «Tælleren må ikke være 0» henholdsvis «Nævneren må ikke være 0».
- Ufuldstændige værdier som `1`, `1/` og `/3` og et afsluttende decimalkomma som `1,/2` bevares som rød
  fejltekst; de færdiggøres ikke automatisk.
- Indledende nuller normaliseres (`02/04` til `2/4`), men brøken reduceres ikke: `2/4` forbliver `2/4`.
- Domæneregler som «højst 1» er canonical røde fejl (§4.11), ikke formatfejl.

### 2.5 Frie tekstfelter

- Et tekstfelt accepterer almindelig tekst, tal, tegn, danske specialtegn og emoji. Mellemrum inde i teksten
  bevares, og indledende og afsluttende mellemrum fjernes ved settle.
- Programmet ændrer aldrig store og små bogstaver i brugerens tekst – hverken på skærmen eller i dokumenter –
  fordi det ikke kan kende et egennavn.
- Ved paste normaliseres teksten efter §1.2a. Maksimumlængden håndhæves tegn for tegn ved tastning og paste;
  et for langt paste afkortes til de tegn, der kan rummes.
- Accepteret tekst giver aldrig rød feltfejl på grund af sit indhold.

**Hvert tekstfelt erklærer sin maksimumlængde.** Længden er påkrævet på codec'et (`createTextFieldCodec` /
`createOptionalTextFieldCodec`), så et felt uden grænse ikke kan kompilere. Felterne vælger en godkendt kategori
i `src/inputCore/catalog/fieldLengthLimits.ts`: **korte enkeltlinjefelter 60 tegn** (navne, numre, referencer,
korte fritekstangivelser), **bilagsnumre 12 tegn** og **flerlinjede kommentarfelter 512 tegn**. Enkelte felter
har en egen, begrundet grænse: EO-`Nummer` 7 (§4.1), `+ evt. ledsagetekst` 64 (§4.2) og Stamdatas
`Advokat`/`Sagsbehandler` 6 (§7). `src/__tests__/inputCore/fieldCharLengthPolicy.test.ts` måler adfærden: for
hvert felt i produktionskataloget skal et for langt paste faktisk blive afkortet.

### 2.6 Dropdowns

- Paste vælger kun ved fuldt label-match mod en aktiv valgmulighed. Match er ufølsomt over for store/små
  bogstaver og ignorerer indledende/afsluttende mellemrum og linjeskift.
- Delvise labels, ukendt tekst, tom paste, paste med kun mellemrum og deaktiverede valgmuligheder giver no-op:
  det hidtidige valg bevares tavst.
- Almindelig tastning bruger typeahead (`keyboard-navigation.md` §Dropdown-typeahead).
- Valg af menupunkt committes straks. Escape og klik uden for dropdownen lukker uden at ændre valget.
- Delete/Backspace rydder et fokuseret dropdownvalg straks, bortset fra dropdowns, der ikke må være tomme.

**Hvert tastetryk, der ændrer valget, er sin egen handling i undo/redo** (udviklerens afgørelse). Bladrer
brugeren med bogstavtasten i en lukket dropdown – `Arbejdssituation` har fire valgmuligheder, der begynder med
F – giver fire tryk på `f` fire fortryd-trin, ikke ét. Hvert tryk sætter en ny, fuldgyldig værdi, og brugeren
skal kunne gå tilbage til hver enkelt af dem.

- Det er ændringen, der tæller, ikke tastetrykket: et tryk, der lander på den værdi, feltet allerede har, er et
  semantisk no-op uden ny revision og uden history-trin.
- I en åben menu flytter bogstav- og piletasterne kun markeringen; der committes intet før valg med Enter eller
  klik.
- Delete/Backspace, der rydder et valg, er ét trin.

Reglen må ikke fremstilles som en fejl eller «manglende sammenlægning af undo-trin». Den måles af
`src/__tests__/components/inputs/keyboardChoiceUndoSteps.test.tsx`.

### 2.7 Toggles og radio buttons

- En toggle har altid Ja eller Nej, aldrig tom værdi, og har ingen rød fejltilstand.
- Toggle skifter straks ved klik, Enter eller mellemrum. Paste, Delete og Backspace er no-op. Escape og klik uden
  for togglen ændrer ikke værdien. Ét skift giver ét undo-trin.
- Radioknapper committer den valgte option straks. Enter vælger den fokuserede option; pilnavigation flytter
  fokus og valg inden for gruppen (`keyboard-navigation.md`). Paste, Delete og Backspace ændrer ikke gruppen.
- En radiogruppe med et påkrævet valg giver samlet mangelfeedback, ikke en formatfejl.
- Hvert tastetryk, der ændrer det valgte i en radiogruppe, er sin egen handling i undo/redo – samme regel og
  samme afgrænsninger som §2.6, uanset om valget kom fra pil, Enter eller mellemrum. Måles sammen med
  dropdownen af `keyboardChoiceUndoSteps.test.tsx`.

### 2.8 Heltalsfelter

- Et heltalsfelt accepterer kun cifre og – hvor feltet tillader negative værdier – et foranstillet minus.
  Punktum, komma, mellemrum og øvrige tegn blokeres ved tastning og springes over ved paste.
- **Hvert heltalsfelt erklærer sit cifferloft** på codec'et, hvor det er påkrævet.
- **Cifferloftet udledes af feltets eget maksimum, hvor et maksimum findes** (udviklerens afgørelse):
  `Méngrad` (højst 120) giver 3 cifre, `Tilkendt for periode` 1–10 giver 2, `Antal feriedage` 0–99 giver 2, og
  beregningsgrundlagets «Løse ferie-/feriefridage» og «Antal fraværsdage (mandag-fredag)» samt SFGG's «Ferie- og
  fraværsdage uden løn i referenceperioden» (højst 366) giver 3. Så
  kan indtastningsgrænsen og talværdigrænsen ikke komme fra hinanden, hvis maksimum ændres.
- **Felter uden øvre domænemaksimum har 4 cifre** (op til 9999 dage), fx TAF-periodernes «Løse
  ferie-/feriefridage».
- Cifferloftet er en længderegel og løsner aldrig feltets talværdigrænse: en værdi inden for cifferantallet, men
  uden for intervallet, kan indtastes og bevares canonical med rød ring og konkret tooltip.

### 2.9 Års- og ugefelter

§1.2a punkt 6 er den bærende regel; nedenfor er dens feltspecifikke følger.

**Årsfelter**

- Et årsfelt accepterer kun cifre, højst fire. Alt andet blokeres ved tastning og springes over ved paste.
- Tocifrede årstal fortolkes ved settle efter én regel for hele programmet (`interpretYear`: femårsvinduet
  omkring indeværende år afgør århundredet; `mineo-field-pattern.md` §9). Et felt har ikke sin egen
  årsfortolkning.
- **Årsgrænserne (`minYear`/`maxYear`) er bounds, ikke et tegnværn.** De afkorter eller ændrer aldrig den
  indtastede tekst. Et velformet årstal uden for intervallet committes canonical med rød ring og tooltippen
  «Årstallet skal være mellem *min* og *maks*» (§1.1).

**Ugefelter**

- Formen er uge + separator + årstal, kanonisk «UU/ÅÅÅÅ» efter settle (ugenummeret nul-polstret).
- **De lovlige separatorer er `.` `,` `/` `\` og `-`. Mellemrum er ikke en separator** (udviklerens afgørelse).
  Mellemrum springes over ved paste: `uge 23/2025` bliver `23/2025`. `23 2025` har ingen gyldig separator;
  cifrene løber sammen til `232025` og afvises.
- Separatorsættet er én erklæring, som både tegnværnet og settle-parseren læser (`normalizeWeekSeparators` i
  `utils/numericDraftAdmission.ts`).
- Ugenummeret 1–52/53 er en repræsenterbarhedsgrænse og forbliver en formatfejl med konkret tooltip; årsdelens
  grænser er bounds som for årsfelter.

## 3. Gennemgåede felter – Offentlige ydelser

### 3.1 `Til-dato` i ydelsestabellen

- En helt tom række giver ingen fejl, heller ikke på Beregning-siden.
- Er rækken delvist udfyldt, men Fra-dato mangler, er Til-dato ikke rød på grund af manglen; rækkens
  ufuldstændighed vises på Beregning-siden.
- Til-dato følger de universelle datoregler, den aktive skadedato-/rækkegrænse og skal være på eller efter
  Fra-dato. Samme dato som Fra-dato er tilladt.
- Ligger Til-dato før Fra-dato, markeres begge rødt; hver tooltip viser den modgående dato.

### 3.2 `Ydelse` og `Tillæg`

`Tillæg` følger præcis samme regler som `Ydelse`:

- Negative værdier og beløbsudtryk er tilladt (`5000-200`, `1000+250`, `500*2`).
- De universelle beløbsregler i §2.2 gælder, herunder grænsen `±9.999.999,99` for et beregnet udtryksresultat.
- En formatfejl i udtrykket vises i beløbsfeltet; manglende øvrige rækkeværdier vises samlet på Beregning-siden.

### 3.3 `Ydelsestype`

- Paste vælger den aktive valgmulighed ved fuldt, trimmet og case-insensitivt label-match. Delvis, ukendt, tom
  eller deaktiveret paste ændrer ikke valget og viser ingen fejl.
- Typeahead, Delete/Backspace, Escape, straks-commit og undo følger dropdownreglerne i §2.6.

### 3.4 `Kommentarer`

- Feltet er et frit, flerlinjet tekstfelt (§2.5) på højst 512 tegn. Enter indsætter linjeskift og afslutter
  ikke feltet.
- Delete/Backspace på det lukkede felt rydder straks. Escape gendanner teksten fra editorens åbning. Blur, Tab og
  klik uden for feltet gemmer.

### 3.5 `Midlertidigt EET indsættes fra Erhvervsevnetab-siden`

- Kontrollen er en Ja/Nej-toggle (§2.7). Paste er altid no-op.
- Aktivering med eksisterende manuelle rækker af ydelsestypen `Midlertidigt EET` kræver bekræftelse.
  Annullering holder toggle og rækker uændrede.
- Bekræftelse sletter alle manuelle Midlertidigt EET-rækker, bevarer øvrige rækker, markerer bilaget
  `Midlertidigt EET` som valgt og kan fortrydes samlet med ét undo-trin.
- Aktivering uden sådanne rækker skifter straks uden dialog. Deaktivering fravælger bilaget; slettede manuelle
  rækker gendannes ikke.
- Ved intern fejl bevares den tidligere toggle-værdi, og siden viser en tydelig fejlmeddelelse.

### 3.6 Sygedagpenge-hjælperen

Hjælperens `Fra-dato` og `Til-dato` er transiente felter (`form-contract.md` §12):

- Begge følger de universelle datoregler og de samme paste-, separator-, format- og fejlregler som øvrige
  datofelter. Hjælperens datoer er bundet til satsdækningen; tabellens rækker til sagens ydre ramme.
- En afvist indtastning bliver stående synligt med rød ring og konkret tooltip; feltet bliver ikke blankt.
  Omvendt datofølge markerer begge felter med tabellens to kronologitekster.
- En tom eller enkelt udfyldt dato giver ingen feltfejl, men `Indsæt` er inaktiv, indtil begge datoer er gyldige
  og inden for deres grænser, og inaktiv, når et af felterne har fejl.
- Indeholder perioden ingen sygedagpengedage, siger hjælperen «Den valgte periode indeholder ingen
  sygedagpenge-dage, så der blev ikke indsat nogen rækker.». Beskeden forsvinder, når en dato ændres.
- Står der allerede sygedagpenge for dage i perioden, kræver indsættelsen bekræftelse i dialogen «Sygedagpenge
  for perioden er allerede indtastet» med «Indsæt alligevel» og «Annuller». Uden bekræftelse ville samme dage
  blive fradraget to gange. Overlappende rækker af samme ydelse lægges ellers sammen uden advarsel (afvist
  overlapregel).
- Ved gyldig indsættelse ryddes begge hjælpefelter.

## 4. Gennemgåede felter – EO oplysninger

**Skadedatogrænsen.** Hvor en dato nedenfor har «skadedatogrænsen» som tidligste dato, er grænsen den seneste
af skadedatoen og 01-01-2005. Ved Erhvervssygdom er den i stedet den seneste af anmeldelsesdatoen minus 5 år og
01-01-2005 (`skadedatoBoundedSpec`). Uden skadedato er grænsen 01-01-2005.

### 4.1 `Erstatningsopgørelse → Nummer`

- Feltet er frivilligt og kan stå tomt uden feltfejl, men manglende nummer giver en samlet advarsel på
  Beregning-siden.
- Alle tegn er tilladt op til 7 tegn. Indledende og afsluttende mellemrum fjernes ved settle.
- **Nummeret afgør, om sagen er første opgørelse** (`erDetteFoersteErstatningsopgoerelse`). Det er ikke første
  opgørelse, når første bogstav-eller-ciffer er et ciffer forskelligt fra 1, eller er 1 efterfulgt af et ciffer:
  `2`, `12` og `2A` er ikke første, mens tom, `1`, `1A`, `A2` og `Nr. 2` er første. Udledningen styrer bl.a.
  feltet for tidligere svie/smerte og «Skjul beregning efter første opgørelse». Det er bevidst, at `2` og
  `Nr. 2` kan give forskellige beløb; en forklarende linje og et eksplicit Ja/Nej-valg er afvist.

### 4.2 `+ evt. ledsagetekst`

- Feltet er frivilligt og kan stå tomt uden fejl eller advarsel.
- Frit tekstfelt (§2.5) på højst 64 tegn.

### 4.3 `Revideret opgørelse`

- Toggle (§2.7) med standardværdien Nej. Ændringen ændrer kun selve feltet.

### 4.4 `Vedrører perioden`

- Fra- og Til-dato kan stå tomme uden direkte rød fejl. Er perioden ufuldstændig, vises manglen på
  Beregning-siden.
- Tidligste dato er skadedatogrænsen; seneste er 31-12 året efter indeværende år. Samme Fra- og Til-dato er
  tilladt. Ligger Fra-dato efter Til-dato, markeres begge rødt med hver sin modgående dato. Slettes den ene
  dato, bliver den anden stående, og kronologifejlen forsvinder.
- En ældre `.eo`-fil med en periode før skaden indlæses uændret og viser derefter en rød fejl, der blokerer
  download.

### 4.5 `Opgørelse lavet den`

- Feltet kan stå tomt uden direkte rød fejl, men tomhed giver samlet feedback på Beregning-siden.
- Tidligste dato er skadedatogrænsen; seneste er dags dato. Begge grænser er inklusive. Værdier uden for
  intervallet bevares med rød ring og konkret tooltip.

### 4.6 Knappen `Indsæt dags dato`

- Klik, Enter og mellemrum indsætter dags dato i `Opgørelse lavet den`, erstatter også ugyldig eller
  uafsluttet tekst og gemmer straks. Knappen beholder fokus.
- Knappen er med i den almindelige Tab-rækkefølge. Den er aldrig inaktiv: feltets øvre grænse er dags dato, så
  dags dato kan ikke ligge uden for den (§2.1). En rød dato kan kun opstå, hvis skadedatogrænsen ligger efter
  dags dato, og den vises da som feltets almindelige rangefejl.
- Én aktivering kan fortrydes med ét undo-trin. Gentagne aktiveringer med samme dato giver ikke overflødige
  undo-trin.

### 4.6a `Indsæt årstal` ved svie/smerte-satsår

- Knappen står til højre for `Hvilket års svie/smerte-satser lægges til grund?`, har samme udseende og knapadfærd
  som `Indsæt dags dato`, tooltippen `Indsæt årstal` og indgår i den almindelige Tab-rækkefølge.
- Ved aktivering anvendes kalenderåret én måned efter `Opgørelse lavet den`, hvis feltet har en afsluttet
  canonical dato; ellers kalenderåret én måned efter dags dato. Månedstilføjelsen følger den fælles
  clamp-semantik for månedsslut.
- Knappen indsætter det afledte år, når både svie/smerte-dagssatsen og maksimumssatsen findes for året; ellers
  det højeste tidligere år med begge satser. Indsættelsen går gennem årsfeltets settle-vej, bevarer knapfokus og
  giver højst ét undo-trin.
- Skærmen forklarer bevidst ikke reglen om én måned; brugeren kender den. Den juridiske regel bag året står i
  `eo-snapshot-contract.md` §16.

### 4.7 `Indsæt udkast-stempel`

- Toggle (§2.7). Standardværdien kommer fra standardindstillingen på Indstillinger-siden, ikke fra en fast
  Nej-default.

### 4.8 `Helbredsforhold`

- Valgmulighederne er `Sygemeldt`, `Delvist Sygemeldt` og `Raskmeldt`. Der er ingen standardværdi ved ny sag.
- Feltet kan stå tomt uden direkte rød fejl. Er svie-/smertegodtgørelse relevant og feltet tomt, vises kun samlet
  fejl på Beregning-siden.
- Underoverskriften er «Status ved erstatningsperiodens udløb», så længe `Vedrører perioden` til mangler, og
  ellers «Status den <dagen efter til-datoen>» (fx «Status den 1. juli 2024»). Ordlyden ensrettes ikke.
- Er en status valgt, godtgørelsen relevant og statusdatoen senere end `Opgørelse lavet den`, får feltet en
  ikke-blokerende gul ring og linjen «Statusdatoen ligger efter opgørelsens dato (<dato>)». Ved lighed ingen
  advarsel. Dokument, beløb og download er uændrede.
- Øvrig adfærd følger dropdownreglerne i §2.6.

### 4.9 `Arbejdssituation`

- Feltet er altid synligt og har ingen standardværdi ved ny sag.
- Valgmulighederne er `Uarbejdsdygtig`, `Delvist raskmeldt`, `Fuldt arbejdsdygtig`, `Efterløn`, `Fleksjob`,
  `Folkepension`, `Førtidspension`, `Kontanthjælp`, `Revalidering`, `Seniorpension` og `Uddannelse`.
- Er tabt arbejdsfortjeneste ikke relevant, kan feltet stå tomt uden fejl. Er det relevant og tomt, vises kun
  samlet fejl på Beregning-siden.
- Samme gule statusdato-advarsel som `Helbredsforhold`, når tabt arbejdsfortjeneste er relevant.

### 4.10 `Forlig om ansvarsgrad → Procent`

- Feltet er frivilligt. Både Procent og Brøk må være tomme uden fejl; er begge udfyldt, markeres begge rødt med
  tooltip om, at kun én må udfyldes.
- Procentfelt efter §2.3 uden særregel: 3 heltalscifre og 2 decimaler, maksimum 100 efter formodningsreglen og
  et udtrykkeligt minimum på 1. `0` og værdier over 100 bevares canonical med rød ring og tooltippen «Procent
  skal være mellem 1 og 100» og blokerer download, hvor ansvarsgraden har betydning.

### 4.11 `Forlig om ansvarsgrad → Brøk`

- Feltet er frivilligt; samme gensidige udelukkelse som Procent (§4.10).
- Brøkfelt efter §2.4.
- En brøk over 1 bevares canonical med rød ring og tooltippen `Brøk skal angives som fx "1/3" og kan ikke
  overstige 1`.
- En brøk under 1/100 er en domænegrænse svarende til procentfeltets minimum: den bevares canonical med rød ring
  og tooltippen «Brøk skal svare til mindst 1 %» og blokerer download på begge sider, der deler felterne. `1/100`
  og `2/200` er gyldige; `1/101` og `1/200` er røde. En ældre `.eo` med fx `1/200` indlæses uændret uden
  preflight og viser feltet rødt.
- `Evt. dato for forlig` efter `Opgørelse lavet den` giver på Erstatningsopgørelsen en ikke-blokerende gul ring og
  linjen «Forliget er dateret efter opgørelsens dato (<dato>)». Ved lighed ingen advarsel; dokument, beløb og
  download er uændrede. EET oplysninger har ingen dokumentdato at sammenligne med (dokumenterne dateres med dags
  dato, og forligsdatoen kan ikke ligge efter dags dato), så reglen gælder kun Erstatningsopgørelsen.

### 4.12 Varige mén: afgørelse og klage

- «Truffet afgørelse om varige mén på 5 % eller derover» og «Verserende klagesag over ménafgørelse?» er toggles
  (§2.7) med standardværdien Nej.
- Ja viser `Dato for første ménafgørelse` og klage-togglen; Nej skjuler dem. Gyldige skjulte værdier bevares,
  skjulte værdier med rød fejl slettes (§1.4), og skjulte felter indgår ikke i beregning eller fejl.

### 4.13 `Dato for første ménafgørelse`

- Når afgørelsen er Ja, er datoen indholdsmæssigt obligatorisk, men manglende dato giver kun en ikke-blokerende
  gul advarsel på Beregning-siden og ingen rød ring.
- Tidligste dato er skadedatogrænsen; seneste er dags dato. Værdier uden for intervallet bevares rødt med konkret
  tooltip. Flyttes skadedatoen senere efter datoen, bevares datoen og markeres rødt. Datoen er uafhængig af
  `Vedrører perioden`.
- Ligger datoen efter `Opgørelse lavet den`, får den en ikke-blokerende gul ring og linjen «Afgørelsen er dateret
  efter opgørelsens dato (<dato>)». Dokument, beløb og download er uændrede; afgørelsen trykkes fortsat.
- Uden dato trykkes afgørelsen alligevel: «Der er truffet afgørelse om varige mén.», ved klage efterfulgt af
  «Afgørelsen er påklaget.».

### 4.14 Midlertidigt EET: afgørelse og datoer

#### «Truffet afgørelse om midlertidigt erhvervsevnetab på 15 % eller derover»

- Toggle (§2.7) med standardværdien Nej. Ja viser afgørelsesdato og virkningsdato; Nej skjuler dem efter
  reglerne i §1.4.
- Ja er tilladt, selv om begge datoer mangler; da vises kun en ikke-blokerende gul advarsel på Beregning-siden.

#### `Dato for første midlertidige erhvervsevnetabsafgørelse`

- Datoen er ikke obligatorisk. Mangler både denne dato og virkningsdatoen, vises en ikke-blokerende gul
  Beregning-advarsel; datofelterne får ingen rød ring.
- Tidligste dato er skadedatogrænsen; seneste er dags dato. Range-ugyldige datoer bevares rødt. Datoen er
  uafhængig af `Vedrører perioden`.
- Samme gule advarsel som §4.13, når datoen ligger efter `Opgørelse lavet den`.

#### `Virkningsdato (hvis forskellig fra afgørelsesdatoen)` – midlertidig EET

- Feltet er frivilligt. En udfyldt virkningsdato fjerner alene den gule advarsel, selv om afgørelsesdatoen mangler.
- Tidligste dato er skadedatogrænsen; seneste er 31-12 året efter indeværende år. Datoen må ligge før, lig med
  eller efter afgørelsesdatoen og er uafhængig af `Vedrører perioden` og `Opgørelse lavet den`.
- Når den er udfyldt, afgrænser virkningsdatoen retten til TAF; ellers bruges afgørelsesdatoen. For skader før
  16. juni 2011 kan midlertidig eller endelig EET-dato efter de øvrige regler være afgrænsende.

### 4.15 Endeligt EET og klagesag

#### «Truffet afgørelse om endeligt erhvervsevnetab på 15 % eller derover»

- Toggle (§2.7) med standardværdien Nej. Ja viser afgørelsesdato og virkningsdato; Nej skjuler dem efter
  reglerne i §1.4. Ja er tilladt med begge datoer tomme; da vises kun en ikke-blokerende gul Beregning-advarsel.

#### `Dato for endelig erhvervsevnetabsafgørelse` og virkningsdato

- Følger samme dato-, interval-, skjulings-, frivilligheds- og advarselsregler som de midlertidige datoer (§4.14).
- Når endelig EET er aktiv, afgrænser en udfyldt endelig EET-dato TAF uanset skadedato. En udfyldt virkningsdato
  er den aktive dato; ellers bruges afgørelsesdatoen.

#### `Verserende klagesag over EET-afgørelse?`

- Én toggle under «Øvrigt» gælder alle EET-afgørelser og vises, når mindst én af de to EET-afgørelser er Ja. En
  klage sætter alt EET-relateret til fuld prøvelse, og TAF-afsnittet trykker kun én EET-linje. En toggle pr.
  afgørelse og en anden placering er afvist.
- Står den på Ja, afgrænser EET-datoerne ikke TAF, så længe klagesagen er verserende.
- Er både midlertidig og endelig EET ellers relevante, bruges den tidligste relevante afgrænsende dato. Endelig EET
  er afgrænsende uanset skadedato; midlertidig EET kun for skader før 16. juni 2011.

### 4.16 `Evt. differencekrav opgjort per`

- Feltet er frivilligt og kan stå tomt uden fejl eller advarsel. Et differencekrav uden EET-afgørelse er lovligt
  og giver ingen advarsel.
- Tidligste dato er skadedatogrænsen; seneste er dags dato. Datoer uden for intervallet bevares med rød ring og
  konkret tooltip. Feltet er uafhængigt af `Vedrører perioden`.
- Ligger datoen efter `Opgørelse lavet den`, får den en ikke-blokerende gul ring og linjen «Differencekravet er
  opgjort pr. en dato efter opgørelsens dato (<dato>)».
- Dokumentet skriver «Der er opgjort differencekrav i sagen pr. <dato>.», og en TAF-dato på eller efter
  afskæringen får beskeden «… på eller efter den dato, differencekravet er opgjort pr. (<dato>)» – datoen er den,
  kravet er opgjort pr., ikke den dag, det blev udregnet.
- En udfyldt dato afgrænser TAF ved dagen før datoen og supplerer andre afgrænsende datoer: den tidligste
  relevante dato gælder, også når en EET-klagesag ellers er verserende.

### 4.17 `Erstatningsopgørelse afsluttes med`

- Valgene er `Bekræftet godkendt`, `Underskrift-linje` og `Ingen`. Valgene og kravvalgenes «Skjul» forklares
  ikke på skærmen (afvist infoikon og forklaring).
- Ved `Underskrift-linje` trykkes skadelidtes navn under underskriftslinjen, og et tomt «Skadelidte» i Stamdata
  blokerer da download. Ved de to andre valg er et manglende navn kun en advarsel. Reglen gælder også ældre
  `.eo`-filer: de indlæses uændret uden preflight og viser fejlen bagefter.

### 4.18 `Eventuelle særlige bemærkninger`

- Sektionen hedder «Eventuelle særlige bemærkninger» på indtastningsfladen, mens feltet og dokumentet siger
  «Særlige bemærkninger». «Eventuelle» signalerer, at feltet er valgfrit, og ensrettes ikke væk.
- Feltet er et flerlinjet kommentarfelt (§2.5).

### 4.19 Bilagsnumre

- De syv bilagsnummerfelter er frie tekstfelter på højst 12 tegn.
- Er et bilagsnummer udfyldt, men passer det ikke til sagen (fx bilagsnummer for ménafgørelse uden truffet
  afgørelse), får feltet en gul ring med samme ordlyd som linjen i «Fejl og advarsler». Bilagsnummeret udelades da
  af dokumentet; kun advarslen fortæller det.

## 5. Gennemgåede felter – svie-/smerte-tabellen

### 5.1 Fælles rækkeadfærd

- En helt tom række er gyldig og giver ingen fejl, heller ikke på Beregning-siden.
- En delvist udfyldt række kræver Fra-dato, Til-dato og Tilstand. Manglende dele vises samlet på Beregning-siden;
  en dato i en delvis række bliver ikke rød alene på grund af den manglende nabo.
- Når hele rækken tømmes, fjernes den automatisk, så der kun er én tom trailing-række tilbage.
- En dato i en Erhvervssygdom-sag må ligge før anmeldelsesdatoen efter skadedatogrænsen (§4); anmeldelsesdatoen er
  ikke i sig selv en nedre grænse. De øvrige systemgrænser gælder fortsat.
- Overlap mellem perioder giver rød markering af de involverede datofelter og konkret overlap-tooltip.
- To perioder med samme tilstand, hvor den ene begynder dagen efter, at den anden slutter, giver gul ring på de to
  datoer, der mødes, og en ikke-blokerende linje i «Fejl og advarsler»: perioden kan skrives i én række.
  Forskellig tilstand giver ingen advarsel. TAF-perioderne følger samme regel uden tilstandskravet.

### 5.2 `Fra-dato` og `Til-dato`

- I en delvis række bliver en manglende dato en Beregning-fejl, uden at den tomme celle får rød ring.
- En dato markeres rødt ved aktiv nedre/øvre rangefejl, ved Fra-dato efter Til-dato og ved overlap. Ved omvendt
  kronologi markeres begge datofelter med hver sin modgående dato. Samme Fra- og Til-dato er tilladt.
- De universelle datoregler gælder uændret.

## 6. Gennemgåede felter – øvrige erstatningskrav

- «Er der øvrige krav i erstatningsperioden» starter på «Skjul» i en ny sag.
- I en række er «Udgift til» og «Beløb» påkrævede og blokerer, mens datoen er valgfri. En udateret post trykkes
  uden datopræfiks og tælles med i «I alt».
- «Beløb» skal være større end 0 kr.; 0 og negative resultater er røde fejl med tooltippen «Beløbet skal være
  større end 0 kr.».
- En dato uden for `Vedrører perioden` giver en gul ring og linjen «Datoen ligger uden for opgørelsens periode
  (<fra> - <til>)» og må aldrig blive blokerende: en kvittering fra en tidligere periode kan legitimt medregnes
  senere. Har rækken også en fejl, vises kun fejlen.
- Hver række giver højst én linje i «Fejl og advarsler» med rækkens navn og alle dens mangler; en rød celle
  meldes med sin egen tekst, aldrig som manglende. Vurderingen ejes af `assessOevrigeKravRow`, som både
  rækkebyggeren og validatoren læser.
- «Ja» uden poster giver den ikke-blokerende advarsel «Der er ikke indtastet øvrige krav».

## 7. Stamdata

- `Advokat` og `Sagsbehandler` står under én fælles etiket «Advokat/Sagsbehandler» med samme pladsholder
  «(init.)» i begge felter. De er enkeltlinjefelter på højst 6 tegn. Grænsen håndhæves ved tastning og paste,
  men et eksisterende længere input afkortes ikke ved `.eo`-load. `Skadelidte` følger sin egen grænse.
- Feltet, der internt hedder `skadedato`, vises som `Skadedato` ved Arbejdsulykke eller ukendt skadestype og som
  `Anmeldelsesdato` ved Erhvervssygdom. Samme betegnelse bruges i datogrænser og fejltekster på Stamdata, EO og
  EET. Ændring af skadestype omdøber kun feltet og fejlteksterne; datoen bevares.
- Ved omvendt datofølge markeres begge felter med hver sin rettelsesvej:
  `Der er angivet en [skadedato/anmeldelsesdato] før skadelidtes fødselsdato (dd-mm-åååå)` og
  `Fødselsdatoen ligger efter den angivne [skadedato/anmeldelsesdato] (dd-mm-åååå)`.
- Der er ingen nedre aldersgrænse og ingen advarsel ved lav alder: nyfødte og små børn kan være skadelidte, og
  de aldersafhængige beregninger skal regne korrekt for dem.

## 8. Find løntrin

Løntrin-finderen er et transient hjælpeværktøj på Lønindkomst (én knap pr. ansættelsesforhold) og EO
oplysninger. Dens tastatur- og fokusadfærd står i `keyboard-navigation.md` §Overlay note: Løntrin-finder.

- Datoen starter på reguleringsdatoen. Beløb, dato og løntype huskes pr. knap, indtil `Slet alt`.
- Ændres løntype, beløb eller dato, eller afvises en indtastning, fjernes resultatlisten, så et gammelt svar ikke
  kan indsættes under nye forudsætninger. En afvist dato bliver stående synligt med rød ring.
- Grupper med samme beløb på samme løntrin samles i én linje («Løntrin 50, alle grupper»); da indsættes kun
  løntrinnet, og gruppen gættes ikke. «55+» kan ikke indsættes.
- Afviger opslagets løntype fra sagens «Ansættelse», er indsættelsen spærret med årsagen i tooltip. Finderen
  ændrer aldrig sagens løntype.
- En indsættelse sætter løntrin – og gruppen, når linjen kun har én – i ét fortryd-trin.

## 9. Autoritative kilder og testkobling

Feltfamiliernes fælles implementeringsgrænser ejes af `form-contract.md`, `mineo-field-pattern.md`,
`date-contract.md`, `amount-contract.md`, `error-contract.md` og `keyboard-navigation.md`. De konkrete
feltdefinitioner og domæneprojektioner findes i `src/inputCore/catalog/`, `src/domain/erstatningsopgoerelse/`,
`src/domain/eoRowEvaluation/` og de relevante tabel- og sektionskomponenter.

Kontraktens testkoblinger er:

- `src/__tests__/inputCore/editor/fieldEditor.test.ts`
- `src/__tests__/inputCore/react/useFormFieldSurface.test.tsx`
- `src/__tests__/inputCore/runtime/dispatchInput.test.ts`
- `src/__tests__/schemas/amountExpressionSchema.test.ts`
- `src/__tests__/domain/erstatningsopgoerelse/eoSnapshot.test.ts`
- `src/__tests__/domain/erstatningsopgoerelse/periodiseringsMotor.test.ts`
- `src/__tests__/components/tables/tableKeyboardNavigation.arrowWrap.test.tsx`
- `src/__tests__/inputCore/fieldCharLengthPolicy.test.ts` og `src/__tests__/inputCore/dateFieldsDeclareBounds.test.ts`
  (§2.1, §2.5)
- `src/__tests__/components/inputs/keyboardChoiceUndoSteps.test.tsx` (§2.6–§2.7)
- `src/__tests__/utils/insertTodayDate.test.ts` («Indsæt dags dato», §2.1)
