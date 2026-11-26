# Udtræk 2 – Brugerblik: Erhvervsevnetab, Årsløn, Forsørgertab

Kilder: `docs/testing/brugerblik/erhvervsevnetab.md` (EET), `aarsloen.md` (ÅL), `forsoergertab.md` (FT). Alle tre læst
helt. Dækningskontrol: Grep i `src/contracts/`, `docs/architecture/`, `docs/domain/`, `AGENTS.md` samt stikprøver i kode.
Kun manglende, forkerte eller ufuldstændige punkter står nedenfor.

## A. Udviklerens afgørelser (UI/UX og beregning)

### Beskrevet forkert i dag (ret først)

1. **Allerede udbetalte måneder tælles dagbaseret.** Domænedokumentet beskriver stadig hele kalendermåneder
   (`(beregningsaar - virkningsaar) * 12 + … + 1`, eksempel «28 måneder», «4 år og 10 måneder»). Kode
   (`forsoergertabAslYdelser.ts:347`) og `forsoergertab-snapshot-contract.md` §4A følger afgørelsen af 2026-09-04.
   Kilde: FT «Åbne spørgsmål 1». Hjem: `docs/domain/forsoergertab/forsoergertab-beregning.md` §5.3 (omskrives efter §4A).
2. **Kun et skift i en dropdown, der ikke kan være tom, gør ikke en række udfyldt – heller ikke et valg, der ikke er
   standardvalget. Et valg i en dropdown, der kan være tom, gør rækken udfyldt.** `input-field-behavior-contract.md`
   §1.0a siger det modsatte («et valg, der ikke er default, tæller som indhold»). Koden følger afgørelsen
   (`isAslAfgoerelseRowPersistenceEmpty` ignorerer `fsTilbageholdtEet`; `renteberegning-contract.md` regel 6 for
   tillægstidsenhed). Kilde: EET BB-147. Hjem: `input-field-behavior-contract.md` §1.0a.
3. **Årsløns nye sag og Slet alt sætter alle tre standardværdier fra Indstillinger: «Løn indtastes som», «Fuld løn
   under ferie» og «Løn på helligdage».** `aarsloen-contract.md` §2a nævner kun `loenperiode`. Kode:
   `resolveAarsloenNewCaseDefaults`. Kilde: ÅL BB-106. Hjem: `aarsloen-contract.md` §2a.

### Årsløn (første gennemgang 2026-08 – intet af det står i kontrakter)

4. **To lønrækker for samme periode er lovlige og blokerer ikke** (fx to ansættelsesforhold). Kun rækker, der er
   identiske i alle indtastningsfelter målt på beregnet værdi (`1000+1000` = `2000`), får gul ring og en linje i
   «Fejl og advarsler»; kontrollen gælder Årsløn, lønindkomst pr. ansættelsesforhold (ikke på tværs) og offentlige
   ydelser. Kilde: ÅL BB-096. Hjem: `aarsloen-contract.md` §2 (ny regel) + henvisning i `eo-snapshot-contract.md`.
5. **0 kr. i en løn-/ydelsestabel er en lovlig, bevidst indtastning og gengives i dokumentet; kun i renteberegning er
   0 kr. en fejl.** Kilde: ÅL BB-098, BB-109. Hjem: `amount-contract.md` (ny regel) eller `form-contract.md` §9.
6. **En tillægssats på 0 % udelades i dokumentet** (betyder «satsen findes ikke»), mens skærmen viser feltets værdi.
   Afvist som fejl. Kun i kodekommentar (`aarsloenDocument.ts` `erSatsUdeladt`). Kilde: ÅL BB-109. Hjem:
   `document-output-contract.md` (indholdsregler) + `aarsloen-contract.md` §5.
7. **Tomt «Antal feriedage» og ikke-beregnede SH-dage skrives som 0 i dokumentet**; tomt = 0. Afvist som fejl.
   Kilde: ÅL BB-110. Hjem: `aarsloen-contract.md` (dokumentafsnit).
8. **Procentsatser vises med fast to decimaler i felterne, men uden tvungne decimaler i dokumenterne.** Kilde: ÅL
   BB-108. Hjem: `document-output-contract.md` (talformat i dokumenter).
9. **Dokumentets kolonnenavne må være forkortelser af skærmens (pladshensyn); resultatet for brugeren skal være
   uændret.** Kilde: ÅL BB-111. Hjem: `document-output-contract.md`.
10. **Skift af «Løn indtastes som» tømmer periodecellerne visuelt uden besked; værdierne bevares og vender tilbage ved
    skift tilbage.** Afvist som fejl – forventet adfærd. Kilde: ÅL BB-105. Hjem: `aarsloen-contract.md` §2a.
11. **«Løn» og «Løn (2)» beholder samme navn; info-ikonet står kun ved «Løn (2)».** Afvist omdøbning. `form-contract.md`
    §9 dækker kun ens domænebetydning. Kilde: ÅL BB-116. Hjem: `form-contract.md` §9.
12. **Tillæggenes beregningsgrundlag (FP/FV inkl. ikke-pensionsgivende løn; pension af Løn+Løn (2) opskrevet med
    tillægsprocenterne) forklares ikke på skærmen eller med tooltip** – professionel målgruppe. Kilde: ÅL BB-100.
    Hjem: `aarsloen-contract.md` (afviste ønsker).
13. **En lønperiode efter dags dato er lovlig** (lønsedler forud, helårsvisning); den får gul ring «Perioden ligger
    efter dags dato (…)» og en advarselslinje; den igangværende måned markeres ikke. Kilde: ÅL BB-115. Hjem:
    `aarsloen-contract.md` §2.
14. **Når perioden er præcis et helt år, vises alligevel en afsluttende linje «Beregnet årsløn» (uden formel) på
    skærm og i dokument.** Kilde: ÅL BB-101. Hjem: `aarsloen-contract.md` §2.
15. **«Omregning til fuldt år» er inaktiv med årsagen i tooltip, når ingen lønrække har både periode og beløb.**
    Kilde: ÅL BB-102. Hjem: `aarsloen-contract.md` §2 (henvis `page-component-contract.md` §11.1a).
16. **De to downloadknapper navngiver dokumentet: «Download årsløn som …» / «Download SH-dage som …».** Kun i kode
    (`DocumentDownloadButton` `documentName`). Kilde: ÅL BB-104. Hjem: `page-component-contract.md` (downloadknap).

### Erhvervsevnetab – afviste ønsker og bevidste særtilfælde

17. **Indtastningsfanen «EET oplysninger» har ingen «Fejl og advarsler»-boks og viser kun rød/gul ring med tooltip;
    tekstlige fejlbeskrivelser står kun på resultatfanerne.** `error-contract.md` §3.1 pkt. 3 nævner kun
    BB-139-undtagelsen, ikke selve hovedreglen. Kilde: EET BB-142. Hjem: `error-contract.md` §3.1 pkt. 3.
18. **Rækken hedder «Køn» på Erhvervsevnetab; kun Forsørgertab skriver «Skadelidtes køn»,** fordi kun Forsørgertab
    blander skadelidtes og efterladtes forhold. Kilde: EET BB-137. Hjem: `eet-snapshot-contract.md` (navne) eller
    `docs/domain/eet/eal-beregning.md`.
19. **0 i «EET % (hvis afviger fra ASL)» (og generelt i procentfelter, hvor det er etableret) betyder ikke udfyldt og
    canonicaliseres til tom uden besked.** Kun i descriptor-kommentar. Kilde: EET BB-143. Hjem:
    `input-field-behavior-contract.md` §2.3 + `eet-snapshot-contract.md`.
20. **Tabeloverskrifter må forkortes («Kap.dato», «Kap. %», «Hvis genopt. - tidl. kap.dato»); henvisende prosa og
    fejlbeskeder bruger det fulde navn.** Kilde: EET BB-145 (også BB-191). Hjem: `error-contract.md` §3 (feltnavne).
21. **EET-procenter: ikke delelig med 5, ≤ 0 eller > 100 er rød; under mindstegrænsen (15 %) eller uden for 10 %-trinene
    for ASL-skader fra 1. juli 2024 er kun gul – teoretiske beregninger skal være mulige. Advarslerne bærer ingen hale
    om «ikke lovmæssig beregning».** 10 %-trinene gælder ikke EAL. Delvis dækning i fejlkatalog/§4; halefraværet og
    princippet står ikke. Kilde: EET BB-158, BB-173, åbent spørgsmål 11d. Hjem: `eet-snapshot-contract.md` §4.
22. **Gul advarsel for kapitalisering under 15 % gives kun, når den første og/eller den samlede kapitalisering er
    under 15 %**, både som ring og fanelinje. Kilde: EET BB-141. Hjem: `eet-snapshot-contract.md` §4.
23. **To afgørelser med samme afgørelses- og virkningsdato markerer BEGGE rækker** (aldrig afhængigt af sortering).
    Kilde: EET BB-140. Hjem: `eet-snapshot-contract.md` §4.
24. **«Kun relevant ved tidligere kapitalisering.» på tidl. kap.dato er tilstrækkelig**, også når datoen samtidig er
    uden for grænsen. Afvist. Kilde: EET BB-150. Hjem: `docs/domain/eet/fejlkatalog.md`.
25. **«Bemærk»-boksen er en juridisk fodnote/påmindelse; den flyttes ikke og trykkes ikke i dokumenterne.** Kilde:
    EET BB-151 + åbent spørgsmål 11a. Hjem: `eet-snapshot-contract.md` eller `docs/domain/eet/eal-beregning.md`.
26. **Kapitalisering-fanen er bevidst uafhængig af beregningsdatoen** (viser også kapitaliseringer efter den, ingen
    beregningsdato-række på skærm eller i dokument); differencekravet medregner kun kapitaliseringer på/før
    beregningsdatoen, og dets bilag viser kun dem («Ingen kapitalisering på eller før beregningsdatoen»). Kilde: EET
    BB-166/167, BB-420. Hjem: `eet-snapshot-contract.md` §3/§4.2 + `docs/domain/eet/kapitaliseret-eet.md`.
27. **Kapitalisering-fanen gengiver myndighedsafgørelser: lempet efterregningskrav (ingen forudsætningsblok med årsløn/
    skadedato, grundløn som tal), ingen «I alt»/samlet kapitaliseringsprocent, ingen forklaring af at
    folkepensionsalderen er den på afgørelsestidspunktet.** Lempelsen gælder IKKE EET efter EAL og mer-erstatning.
    Kilde: EET BB-170, BB-174, BB-169, BB-194. Hjem: `docs/domain/eet/kapitaliseret-eet.md`.
28. **«Kapitaliseringsfaktor» er samme begreb i ASL (tabelopslag) og EAL (altid 10) og hedder ens.** Afvist; afgrænser
    også BB-177's omdøbning. Kilde: EET BB-184. Hjem: `docs/domain/eet/eal-beregning.md`.
29. **EET efter EAL: uden særskilt EAL-procent bruges den seneste ASL-procent uden skelen til, om afgørelsen er
    midlertidig eller endelig** (EAL kender ikke midlertidigt EET); advarslen om midlertidig efter endelig gives også
    her; rækken hedder «Erhvervsevnetab» (ikke «Endeligt …»); en afgørelse efter beregningsdatoen bærer kravet uden
    advarsel, mens Differencekrav korrekt blokerer. Kilde: EET BB-177/178/179. Hjem: `docs/domain/eet/eal-beregning.md`
    (sorteringen står dér; begrundelse og de øvrige mangler).
30. **Kilden til årsløn/EET-procent (EAL eller ASL-fallback) vises ikke i specifikationen** (`aarsloenSource`/
    `eetPctSource` er bevidst urenderede). Kilde: EET BB-180. Hjem: `docs/domain/eet/eal-beregning.md`.
31. **Røde Kap.dato, Kap. % og tidl. kap.dato blokerer ikke EET efter EAL; afgørelsesdato, virkningsdato, EET % og type
    gør.** Kilde: EET BB-419. Hjem: `eet-snapshot-contract.md` §3.
32. **Differencekravets bilag er regnet på sagen pr. beregningsdatoen og må vise andre tal end nabofanernes dokumenter
    under samme titel** (EAL-bilag kun afgørelser med virkning ≤ beregningsdato; løbende ydelser til og med dagen før
    beregningsdatoen pga. proformakapitalisering). Afvist som fejl. Kilde: EET BB-185, BB-186. Hjem:
    `docs/domain/eet/differencekrav.md` (reglen står; tilføj at forskellen er tilsigtet og ikke skal forklares).
33. **Løbende ydelser regnes altid kun til og med dagen før en (proforma)kapitalisering; kun ophør pga.
    beregningsdatoen medregner selve dagen.** Enhver beregning, der medtager kapitaliseringsdagen, er en fejl. Kilde: EET
    BB-186. Hjem: `docs/domain/eet/loebende-eet.md`.
34. **Differencekrav og løbende ydelser har hver sin uafhængige toggle for udvidet specifikation.** Afvist samling.
    Kilde: EET BB-164. Hjem: `eet-snapshot-contract.md` §4.2.
35. **«Ikke kapitaliseret.» bevares ved midlertidige afgørelser** (pædagogisk værdi). Kilde: EET BB-201. Hjem:
    `docs/domain/eet/differencekrav.md`.
36. **Mer-erstatningens «Reguleringsprocent (ÅÅÅÅ)» viser bevidst satsåret, ikke en dato.** Kilde: EET BB-198. Hjem:
    `docs/domain/eet/mer-erstatning-pensionsalder.md`.
37. **Niveauskift-noten (2003→2024) er tilstrækkelig forklaring på «Regulering»-kolonnens skift**; vises netop ved
    2003-grundløn og rækker før og fra 2024. Kilde: EET BB-157. Hjem: `docs/domain/eet/loebende-eet.md`.
38. **Beregningsdatoen nævnes ikke som «beregningsdato» i Løbende ydelser-dokumentet**; det er nok, at opgørelsens
    slutdato fremgår. Kilde: EET BB-161. Hjem: `document-output-contract.md` eller `loebende-eet.md`.
39. **Præsentationskonventioner for EET-specifikationerne** (implementeret, kun i kode/tests): «Mdr.» med fem decimaler
    på skærm og i dokument (BB-162/424); minus i formler er U+002D (BB-163); afgørelsesoverskrift bærer altid EET-procent
    «Afgørelse 1. juni 2023 (40 %)» (BB-170/171), og kun ved ellers ens overskrifter tilføjes «– virkning fra
    dd-mm-åååå» (BB-411); «≤ 2 år» overalt (PDF normaliserer til «<=») (BB-172); datoer i etiketterede rækker i kort
    form (BB-176/199); «Kapitaliseringsprocent» som rækkenavn, underoverskriften forbliver «Kapitaliseringsfaktor»
    (BB-175); «Særfaktor pga. ≤ 2 år til folkepension?» (BB-414); formlen «Grundløn x Kap. % …»/«Rest-EET» (BB-416);
    kapitalbeløb «(oprundet) =» (BB-417); «opgjort til og med» ved beregningsdato vs. «ophører» ved ægte årsager
    (BB-155); kolonnen «Grundydelse pr. år» og noten «gange (100 % + reguleringen)» uden eksempel (BB-156/412);
    tilstødende identiske rækker slås sammen i visningen (BB-165; står i §3 for pengetabellen); tilbageholdt-note
    (BB-408/409); «Forhøjet pensionsalder» som ét navn (står i domænedok.); alle beløb med «kr.» (BB-190); forligsprocent
    trimmer «,00» kun for dette felt (BB-200). Hjem: ny sektion «Præsentation» i `eet-snapshot-contract.md`.
40. **Undgå visuelt rod: korte, præcise forklaringer frem for lange beregningstekniske beskrivelser; målgruppen kender
    afrundings- og beregningsprincipper.** Gennemgående begrundelse for flere afvisninger. Kilde: EET BB-156, BB-187,
    BB-189; FT BB-131. Hjem: `AGENTS.md` (tekst til brugerfladen) eller `page-component-contract.md`.

### Forsørgertab

41. **Nettokravet klampes til 0 kr. uden forklaring; der vises hverken negativ difference, femte linje eller anden
    markering.** Forsørgertab og differencekrav er pr. definition overskydende krav. Foreslå det ikke igen. Domænedok.
    har kun clampen. Kilde: FT BB-119 (+ EET 11e). Hjem: `forsoergertab-snapshot-contract.md` + `differencekrav.md`.
42. **«(afrundet)» er nok; afrundingsenheden (nærmeste 500 kr.) skrives ikke.** Kilde: FT BB-131. Hjem:
    `docs/domain/eet/eal-beregning.md` (delt tekst).
43. **Der findes én kanonisk årsløn efter ASL og én efter EAL; at Forsørgertab og Erhvervsevnetab bruger samme felt er
    ingen skjult kobling og forklares ikke.** Navnene «Skadelidtes årsløn (efter ASL)» og «Skadelidtes årsløn efter EAL
    (hvis forskellig fra ASL)». Kilde: FT BB-123. Hjem: `domain-boundary-contract.md` (faellesAarsloen).
44. **Ved aldersreduktion 0 % vises ingen formel («Aldersreduktion»), og nul vises uden fortegn i fradragslinjer;
    vagten måler den afrundede/formaterede værdi.** Delt `utils/deductionFormatting.ts`. Kilde: FT BB-129/130. Hjem:
    `amount-contract.md` (visning).
45. **`x` er programmets gangetegn; formellinjer med resultat ender med «=».** Kilde: FT BB-132. Hjem:
    `document-output-contract.md` + `page-component-contract.md`.
46. **EAL-loftet vises som minimum: «Højeste erstatningsniveau i beregningsåret ÅÅÅÅ», og slutsætningen er tredelt
    (forhøjes til minimum / nedsættes til maksimum / ikke reguleres).** EAL-årslønnen har intet loft eller
    rimelighedssignal. Kilde: FT BB-133 + spørgsmål 2. Hjem: `forsoergertab-beregning.md`.
47. **Feltet hedder «Virkningsdato» overalt** (domænedok. har «Startdato for de løbende ASL-ydelser» som beskrivelse).
    Kilde: FT BB-120. Hjem: `forsoergertab-beregning.md` (felttabel).
48. **Dokumentets «Grundlæggende oplysninger» indeholder sagens skade-/anmeldelsesdato fra dokumentprojektionen, ikke
    fra brevhovedet.** Kilde: FT BB-122 (og EET BB-182, hvor rækken står i «Specifikation»). Hjem:
    `document-output-contract.md`.
49. **«Indsæt dags dato» er inaktiv med årsag, når dags dato ligger før feltets nedre grænse (virkningsdato/
    skadedato)**; samme øvre-grænse-regel på Varige mén og Erhvervsevnetab. Kilde: FT BB-405. Hjem:
    `input-field-behavior-contract.md` §4.6.

## B. Varige regler for adfærd, test og udvikling

1. **Tekst, der beskriver samme regel, skal komme fra én delt konstant – en godkendt ordlyd søges som begreb, ikke som
   streng.** Gentaget læring (BB-134/137, 177, 191). Hjem: `AGENTS.md` §Konvergens.
2. **En erklæret option, der bærer to skrivemåder af samme oplysning mellem skærm og dokument, er divergensen – ikke en
   løsning.** Options må kun bære forskelle med en grund. Kilde: EET BB-176. Hjem: `document-output-contract.md`.
3. **Før en divergens mellem to flader registreres som fejl, afklares om de besvarer samme spørgsmål under samme
   input-forudsætninger.** Kilde: EET BB-166, BB-179. Hjem: `docs/vejledninger/` (gennemgangsvejledning) eller `AGENTS.md`.
4. **En advarsel skal dække hver tilstand, reglen kan brydes i; et udsagn (fx en disabled-årsag) skal være sandt i hver
   tilstand, der kan udløse det.** Kilde: EET BB-183, BB-189. Hjem: `error-contract.md`.
5. **En parameters ejer (hvis køn, hvis alder) er domæneviden og skal spørges om, ikke udledes af det opslag, den
   indgår i.** Kilde: FT spørgsmål 3. Hjem: `AGENTS.md` (domæneafklaring).
6. **Når to dele af samme opgørelse regner samme tal, afledes den ene af den anden.** Kilde: FT spørgsmål 1. Hjem:
   `docs/architecture/calculation-architecture.md`.
7. **Opdatering af karakteriserings-golden-hashes kræver dump før/efter, der beviser at kun de tilsigtede felter er
   ændret og intet beløb flyttet.** Står i testfilens header ifølge kilden. Kilde: EET 11c «Gates». Hjem:
   `src/__tests__/AGENTS.md`.
8. **Gennemgangsprøver værd at bevare:** regn hver vist formel efter med de viste tal (skærm og dokument hver for sig);
   læs dokumentets standardudgave og spørg om hvert tal kan udledes; ændr en vist værdi og se om noget andet ændres
   (dekorativ række); sammenlign operatorer/tegn på tegnkode. Kilde: EET BB-156/160/163/167/170. Hjem:
   `docs/vejledninger/` (brugerblik-prøvekatalog).

## C. Åbne punkter

1. **Uopnåelige motorissues:** `warn-beregningsdato-foer-skadedato` og `eet-max-missing` (`eetEalCalculation.ts`) samt
   `blockedProjectionForStamdata` på Forsørgertab kan ikke nås fra brugerfladen (findes stadig i kode). Afgør om de er
   bevidst forsvarskode (så notér det) eller skal fjernes.
2. **BB-147-reglen bør efterprøves for alle collections med required-choice-felter** (fx EO-lønrækker) – kontrakten
   (A2) og evt. kode skal stemme.
3. **EET-oplysningers BB-139-slukning på andre flader:** samme stamdata-afhængige ASL-skadesårsregel bruges på
   Forsørgertab og EO; det er ikke verificeret, at de har den navigerbare «Ugyldig værdi (ret i Stamdata)»-række.
4. **Differencekrav før 16-06-2011** (alle løbende ydelser fradrages) er kun kildelæst, aldrig browserprøvet.
5. **Differencekravets to beregnings-toggles har default `true`;** en ældre `.eo` uden felterne får dem slået til ved
   load – ikke målt med en rigtig fil (persistensgrænse).

---
Undersøgte kandidater: 112. Allerede dækket: 49 (bl.a. Årslønnens overenskomst/§2b, BB-097/400/401/402, tom
feriesats, feriepengebegreber, forsørgertabs §4A og BB-403/404, EET forlig §4.1, bilagsvalg §4.2, ≤ 2 år-reglerne,
delvist endelige afgørelser, TAF-advarsel ved kapitalisering, stamdata-datoreferencen, row-level issues BB-406).
