# Brugerblik – Erstatningsopgørelse → Øvrige erstatningskrav (12c)

- Rute/placering: `/erstatningsopgoerelse` → fanen «EO oplysninger», sektionen **Øvrige erstatningskrav**
  (kravvalget «Er der øvrige krav i erstatningsperioden» og kravtabellen Dato · Udgift til · Beløb) –
  samt opgørelsesdokumentets afsnit «Øvrige krav», dets linje i «Samlet erstatningskrav» og de to
  forbeholdssætninger, afsnittet kan bære.
- Gennemgået: 2026-09-23 · commit `1d28db51`
- Afprøvet i: Chrome headless, lyst tema, 1536×864 (M-09 desuden 1244×620). Dokumenter hentet som
  `.pdf` og læst med `pdftotext -layout`.

## Fladen kort

12c er opgørelsens tredje erstatningskrav og det enkleste: et Ja/Nej/Skjul-valg og en tabel, hvor hver
række er én udgift med dato, beskrivelse og beløb. Programmet regner intet ud over summen og en
eventuel forligsreduktion. En ny sag starter bevidst på «Skjul» (`erstatningsopgoerelseNewCaseSeed.ts`,
kommenteret som designbeslutning), til forskel fra svie/smerte og TAF, der starter på «Ja».

Sektionen er lille, men den har **to valideringslag**, der vurderer samme række hver for sig:
rækkebyggeren (`eoRowOevrigeKravRows.ts`) og den gamle validator (`validateOevrigeKrav` i
`erstatningsopgoerelseValidator.ts`). De er uenige om ordlyd, alvor, relevans og om datoen er påkrævet,
og brugeren får begge svar i «Fejl og advarsler». Seks af de ti fund har den rod.

**Afgrænsning.** Bilagsnummerfeltet «Bilagsnr. øvrige erstatningskrav» hører i 12a og er her kun
efterprøvet som konsistensregel. Forbeholdssætningerne udløses af felter i 12d (verserende EET-klage) og
12k (kontanthjælp/ressourceforløbsydelse); her er alene deres afhængighed af kravvalget gennemgået.
Downloadgatens tooltip hører i 12l og er registreret som henvisning.

## Fund

### BB-228 – En skjult, halvudfyldt række spærrer opgørelsen, efter kravvalget er sat til «Nej» eller «Skjul»

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-32--et-skjult-felt-er-ikke-udfyldt--men-kun-nogle-af-dets-læsere-ved-det`
  og `#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** **Høj**
- **Beslutning:** Agent afgør – reglen er afgjort af udvikleren ved BB-222 (et skjult felt er ikke
  udfyldt og må aldrig påvirke fejlmeddelelser), og rettelsen er at give validatoren den gate, dens
  søskende allerede har.
  **GENNEMFØRT** 2026-09-23 – som den fælles løsning, udvikleren bad om; se opfølgningen under
  tilbagemeldingen.
- **Sådan fremprovokeres det:**
  1. Sæt kravvalget til «Ja» og tast en række: «Udgift til» `Medicin`, «Beløb» `1250`, ingen dato.
  2. Skift mening: sæt kravvalget til «Nej» (eller «Skjul»). Tabellen forsvinder.
  3. Gå til Beregning.
- **Det sker:** «Fejl og advarsler» viser den røde linje **«Dato mangler»** – uden link og uden at nævne
  øvrige krav – ved siden af advarslen «Der er ikke rejst krav under nogen af de tre emner – opgørelsen
  vil vise 0 kr.» Downloadknappen er grå med tooltippen «Indtastning mangler». Målt i tre varianter:

  | Skjult række | Kravvalg | Linjen i boksen |
  |---|---|---|
  | `Medicin` · `1.250,00` · ingen dato | Nej | «Dato mangler» |
  | `Medicin` · `1.250,00` · ingen dato | Skjul | «Dato mangler» |
  | `Medicin` · ingen beløb · `15-03-2024` | Skjul | «Beløb mangler» |
  | `Medicin` · `0,00` · `15-03-2024` | Nej | «Beløb skal være større end 0» |

  Programmet siger altså samtidig, at der ikke er rejst noget krav, og at et krav mangler en dato.
  Rækken er ikke væk – sættes valget tilbage til «Ja», står `Medicin` og `1.250,00` der igen (målt) –
  men intet på skærmen fortæller, at det er dér, fejlen bor.
  **Årsagen er én manglende linje.** `validateSvieSmerte` og `validateTAF` begynder begge med
  `if (!beregnes) return errors;`. `validateOevrigeKrav` gør ikke, så den validerer rækker, som
  rækkebyggeren (via `isRowRelevantForEoValues`), neutraliseringen og dokumentet alle har kasseret.
- **Det er uhensigtsmæssigt fordi:** Det er en blindgyde. Brugeren har netop sagt, at der ikke er øvrige
  krav, og kan ikke se tabellen; beskeden har intet link, og ingen af dens tre ord fører ham tilbage til
  sektionen. Den eneste udvej er at gætte, at han skal slå et krav til igen, som han lige har fravalgt.
  Tilstanden er ikke konstrueret: den opstår hver gang en påbegyndt række efterlades, og kravvalget
  derefter ændres – præcis prøvekatalogets B4 «et valg, der skjuler et felt, brugeren allerede havde
  udfyldt».
- **Bedre ville være:** Giv `validateOevrigeKrav` samme første linje som søskendene:
  `if (values.kravPaaOevrigeErstatningskrav !== 'Ja') return errors;`. Rækkerne bevares uændret, så et
  skift tilbage til «Ja» viser både dem og deres fejl igen.
  **Bemærk grænsen:** en række med en **rød** dato (`31-02-2024`) skjult bag «Skjul» spærrer også –
  med «Datoen findes ikke i kalenderen» – men den halvdel kommer fra feltets egne bounds og er dermed
  12b's åbne spørgsmål (a) om validatorens rå værdier, ikke denne rettelse.
- **Andre steder det kan gælde:** Enhver `validate*`-funktion i `erstatningsopgoerelseValidator.ts`, der
  validerer en betinget sektion. Prøven: læs hver funktions første linjer og spørg, om den spejler
  sektionens relevansprædikat i `eoInputRelevance.ts`. De tre krav er nu tjekket; sygeferiegodtgørelse
  (`shouldRequireSygeferiegodtgoerelseInput`) og løn-/reguleringsreglerne er uafprøvede og hører i
  12f–12j.

**Tilbagemelding**
Enig. Det er sikkert overflødigt og forholder sig allerede sådan, men undersøg gerne, at der er en ensartet og konsekvent måde at håndtere dette på - og dette på tværs af de forskellige elementer i erstantingsopgørelse, der også indebærer muligheden for at vælge nej eller skjul. Hvis ikke det håndteres ensartet, så overvej meget gerne, om en fælles arkitektonisk løsning ville være hensigtsmæssigt, så alt var dækket godt og ensartet ind.

**Opfølgning (agent, 2026-09-23) – undersøgt: ikke ensartet. Nu løst ét sted.**
Det forholdt sig ikke allerede sådan. Hver læser afgjorde selv, om et felt var skjult: skærmen kaldte
prædikaterne i `eoInputRelevance.ts`, motorerne fik neutraliserede værdier, validatoren fik de RÅ, rækkerne
i «Fejl og advarsler» havde deres egen liste over id-præfikser, og de røde ringe havde ingen gate overhovedet.
Programmets inputkerne har én fælles mekanisme til netop dette – feltets `relevance` – men ingen af EO's
felter brugte den. Det gør de nu, for alle felter bag et valg: svie/smerte («Tidligere beregnet S/S til
max.», perioderne, satsåret, satsen ved delvis sygemelding og begge beløbsfelter), tabt arbejdsfortjeneste
(TAF-perioderne, ferieperioderne, «Tidligere modtaget TAF»), øvrige krav (alle tre kolonner), mén- og
EET-afgørelsernes datoer og klagefelter samt de syv bilagsnumre. Et skjult felt læses derefter som tomt af
ALLE – validatoren, rækkerne, dokumentet og beregningen – og det kan ikke længere være rødt uden for skærmen.
Det, brugeren har tastet, bevares og kommer frem igen ved «Ja».

**Undersøgelsen fandt en beregningsfejl, som er rettet** (rettelsen genskaber den dokumenterede adfærd):
ved 1. opgørelse er «Svie/smerte opgjort i tidligere erstatningsopgørelser» skjult, men et beløb, der stod i
feltet fra før – fx fordi opgørelsesnummeret blev ændret fra 2 til 1 – blev alligevel trukket fra
svie/smerte-maksimum. Målt: en sag med **6.665,00 kr.** i svie/smerte gav **0,00 kr.**, når der stod
1.000.000 kr. i det skjulte felt. Netop den fejl var grunden til, at `eoInputRelevance.ts` blev skrevet, men
den var vendt tilbage ad en anden vej ind i beregningen. Dækket af `eoSkjulteFelterRelevans.test.ts`, som er
kontrolleret til at fejle uden rettelsen.

**Én ændring i oplevelsen, som du skal kende:** programmets fælles regel (`form-contract.md` §7 pkt. 5, som årsløn
allerede følger) er, at når et valg skjuler et felt, der er RØDT, ryddes feltet i samme handling – en rød
fejl, man ikke kan se, kan ikke rettes, og den ville ellers blokere gem. Det gælder nu også i EO. Eksempel:
en øvrige krav-række med datoen `01-01-2017` (før skadedatoen, rød), hvorefter kravvalget sættes til
«Skjul»: datoen ryddes, mens rækkens beskrivelse og beløb bevares. Ctrl+Z gendanner både valget og datoen i
ét trin. Et skjult felt UDEN rød fejl bevares altid uændret. Gemte `.eo`-filer påvirkes ikke: gem og indlæs
læser felterne uden om relevansen.

**Bevidst ikke med:** beregningsgrundlagets felter, der styres af «Beregnes ud fra» (angivet måneds-/dagsløn,
beregningsperiode, fravær, lønindkomst). De skjules også, når beregningen komprimeres fra 2. opgørelse, men
indgår da stadig i beregningen – deres synlighed er altså ikke deres relevans, og de kræver hver sin regel.
De hører til 12f–12j og bør gennemgås dér med samme mekanisme.

### BB-229 – Én manglende dato giver to linjer med to alvorsgrader og to ordlyde

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** **Høj**
- **Beslutning:** **AFGJORT** af udvikleren 2026-09-23: datoen er valgfri; «Udgift til» og «Beløb» er
  påkrævede og blokerer. **GENNEMFØRT** 2026-09-23: rækken vurderes nu ét sted
  (`oevrigeKravRowValidation.ts`), som både validatoren og «Fejl og advarsler» læser. Hver tabelrække giver
  højst ÉN linje, der nævner rækkens navn og alle dens mangler og linker til den første celle, der skal
  rettes: «Medicin: «Beløb» er ikke udfyldt» – «Øvrigt krav (15-03-2024): «Udgift til» og «Beløb» er ikke
  udfyldt». Dokumentet trykker en udateret post uden datopræfiks («Medicin» i stedet for «15-03-2024:
  Medicin») i stedet for at tabe den af listen og alligevel lægge den med i «I alt».
- **Sådan fremprovokeres det:**
  1. Kravvalg «Ja». Tast én række: `Medicin`, `1250`, ingen dato.
  2. Gå til Beregning.
- **Det sker:** Boksen viser to linjer om samme tomme celle:

  | Linje | Alvor | Link |
  |---|---|---|
  | «Dato mangler» | fejl (rødt ikon) | intet |
  | «Dato er ikke angivet» | advarsel (gult ikon) | «EO oplysninger → Øvrige erstatningskrav» |

  Download er spærret, og tooltippen siger «Indtastning mangler». Den ene linje fortæller altså
  brugeren, at datoen er valgfri (en advarsel), den anden, at den er påkrævet (en fejl) – og det er
  kun den valgfri af dem, der kan klikkes.
  **Kravene afsløres ét ad gangen.** Taster brugeren kun et beløb, siger boksen alene «Beskrivelse er
  ikke udfyldt». Retter han det, dukker «Dato mangler» og «Dato er ikke angivet» op. Validatoren
  kendte hele tiden alle tre mangler; i de målte tilfælde (kun beskrivelse, kun beløb, kun dato) viste
  boksen alligevel kun rækkebyggerens ene linje.
  **Og uenigheden er ikke kun kosmetisk.** Rækkebyggeren kalder en række uden dato «advarsel», altså
  hentbar. Præsentationsmodellen (`buildOevrigeKravModel`) springer en række uden dato over i
  dokumentets liste (`if (dateText === '' …) continue;`), men lægger dens beløb med i «I alt»
  (`totalFoerForligOre` er summen af ALLE ikke-tomme rækker). Det er alene validatorens fejl, der i dag
  forhindrer et dokument, hvor «I alt» er større end summen af de viste linjer. Fjernes den ene linje for
  at løse dubletten, bliver papiret forkert.
- **Det er uhensigtsmæssigt fordi:** Brugeren ved ikke, om han kan lade datoen stå tom. Svarer han på
  den gule linje («det er kun en advarsel»), sidder han fast på den røde uden link. Og en tabel, hvis
  krav kommer frem ét ad gangen, kræver en tur frem og tilbage mellem fanerne pr. krav.
- **Bedre ville være:** Ét lag, én linje pr. række, som nævner alle rækkens mangler på én gang og
  linker til den første: «Medicin: Dato er ikke udfyldt» – «Række uden beskrivelse (1.250,00 kr.):
  Udgift til og dato er ikke udfyldt». Datoen gøres entydigt påkrævet (fejl), fordi dokumentet ikke kan
  vise en udgift uden den; alternativt gøres den valgfri OVERALT, og præsentationsmodellen trykker så
  rækken uden dato («Medicin» uden datopræfiks) i stedet for at tabe den af listen.
- **Andre steder det kan gælde:** Alle EO-rækketyper, der både har en `validate*RowCompleteness` i
  validatoren og en rækkebygger: svie/smerte-perioder (`'Fra-dato mangler'`, linje 459), TAF-perioder og
  ferieperioder (879/882), de manuelle reguleringsrækker (1154–1199). Uafprøvet; se M-33.

**Tilbagemelding**
Enig. Dato skal være valgfri. Programmet skal kunne håndtere udgifter, hvor der ikke kan angives en nøjagtig dato. Beskrivelse og beløb skal til gengæld være tvungne, og de skal blokere download hvis en eller begge af disse mangler. Sørg gerne for en god, gennemtænkt løsning til fejlmeddelelser og link til brugeren i Fejl og advarsler, så brugeren ikke bliver druknet i fejlmeddelelser, hvis der er flere fejl/advarsler for samme linje med øvrige krav.

### BB-230 – En rød dato meldes som «Dato mangler» – tre gange for tre datoer, der står på skærmen

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-19--rødt-læses-som-tomt-af-den-flade-der-låner-værdien`
  og `#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** **Høj**
- **Beslutning:** Agent afgør (undertrykkelsen findes; den dækker blot ikke rækkeceller)
  **GENNEMFØRT** 2026-09-23 som del af BB-229's ene vurdering: en rød celle meldes med sin egen tekst og
  rækkens navn («Medicin: Datoen findes ikke i kalenderen») og med link til cellen – aldrig som tom. Tre
  røde datoer giver tre linjer i stedet for syv. `suppressMaskedMissingInvariants` dækker nu også øvrige
  krav-rækkens celler.
- **Sådan fremprovokeres det:** Skadedato `01-06-2018`. Tast tre fulde rækker med datoerne
  `01-01-2017` (før skadedatoen), `01-01-2027` (efter dags dato) og `31-02-2024` (findes ikke) samt to
  gyldige rækker. Gå til Beregning.
- **Det sker:** De tre datoceller er røde (`aria-invalid = "true"`). Boksen viser syv linjer:

  ```
  Dato mangler                                              (fejl, intet link)
  Dato mangler                                              (fejl, intet link)
  Dato mangler                                              (fejl, intet link)
  Datoen kan ikke være før skadedatoen (01-06-2018)         (fejl, intet link)
  Datoen er efter dags dato (23-09-2026)                    (fejl, intet link)
  Datoen findes ikke i kalenderen                           (fejl, intet link)
  Dato er ikke angivet          EO oplysninger -> Øvrige erstatningskrav   (advarsel)
  ```

  Hver rød dato giver altså tre linjer: validatorens «Dato mangler», feltets egen grænsetekst og
  rækkebyggerens «Dato er ikke angivet». Begge «mangler»-udsagn er usande: datoerne står på skærmen.
  Ingen af de seks røde linjer siger, hvilken række de handler om, og ingen kan klikkes. Tooltippen på
  downloadknappen er «Indtastning mangler» – kontraktens «Fejl i indtastning» eller «Opgørelse kan
  ikke hentes, når der er fejl ovenfor» ville begge have været sande.
  Årsagen er M-19's: readeren maskerer en rød værdi til `undefined`, og begge lag læser det som tomt.
  `suppressMaskedMissingInvariants` i `eoSnapshot.ts` er skrevet præcis til dette («Readerens maskering
  gør en rødmarkeret værdi `undefined` for legacy-validatoren, som da melder feltet TOMT oveni den ægte
  feltfejl»), men virker ikke på øvrige krav-rækkernes celler.
- **Det er uhensigtsmæssigt fordi:** Brugeren sendes efter den forkerte fejl. «Dato mangler» beder ham
  om at **indtaste**; det rigtige er at **rette**. Tre ens linjer uden rækkeangivelse og uden link kan
  hverken skelnes fra hinanden eller følges, og de fylder boksen, så de tre rigtige beskeder drukner.
- **Bedre ville være:** Lad `suppressMaskedMissingInvariants` omfatte rækkecellerne, så en rød dato kun
  giver sin egen grænsetekst, og lad rækkebyggeren undlade «Dato er ikke angivet», når cellen har en
  feltfejl (samme skelnen som `ForsoergertabOplysningerSection`, M-19's forlæg). Grænseteksterne bør
  bære link til deres celle og rækkens beskrivelse: «Medicin: Datoen findes ikke i kalenderen».
- **Andre steder det kan gælde:** Alle EO-rækketabeller med et datofelt, der både valideres af
  descriptorens bounds og tjekkes for tomhed i validatoren: svie/smerte, TAF, ferie, manuelle
  reguleringsrækker. Prøven er én indtastning pr. tabel: tast `31-02-2024` i en ellers fuld række og tæl
  linjerne i boksen.

**Tilbagemelding**
Enig

### BB-231 – To rækker med samme mangel giver én linje, og linket fører kun til den første

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-20--en-feltnær-oplysning-hentet-fra-hele-sidens-beregning`
  (bagsiden af BB-218's rettelse)
- **Prioritet:** Mellem
- **Beslutning:** **AFGJORT** af udvikleren 2026-09-23 (enig). **GENNEMFØRT** 2026-09-23: linjen bærer
  rækkens beskrivelse, så to rækker ikke giver samme tekst. Har to rækker også samme beskrivelse og samme
  mangel, tilføjes dato og beløb («Medicin (15-03-2024): …» / «Medicin (15-04-2024): …»). Foldningen fra
  BB-218 er bevaret; dens forudsætning – at en linje om en tabelrække navngiver rækken – står nu i koden ved
  foldningen. Den samlede løsning, udvikleren bad om, er BB-229's ene vurdering pr. række: den dækker
  manglende felter (BB-229), røde celler (BB-230), ens linjer (BB-231), 0 kr. (BB-232) og datoen uden for
  perioden (BB-235) i én regel.
- **Sådan fremprovokeres det:** Tast to rækker uden beløb: `15-03-2024` · `Medicin` og `16-03-2024` ·
  `Transport`. Gå til Beregning og klik linjens link.
- **Det sker:** Boksen viser **én** linje, «Beløb er ikke angivet». Linket blinkmarkerer beløbscellen i
  første række (målt ét `mineoFieldAttentionBlink` på `Medicin`-rækkens `beloeb`). At `Transport` også
  mangler et beløb, står ingen steder; ingen celle er rød. Først når Medicin er rettet, dukker samme
  linje op igen – nu om Transport.
  Årsagen er BB-218's foldning i `EOberegningTab.renderEoRows`, som udvikleren bad om for
  overlap-beskeden. Den er lagt i den fælles renderer og folder derfor ALLE ens tekster – også dem, der
  ikke har en rød ring til at bære udpegningen. Rækkens beskrivelse ligger i rækkens `label`
  (`krav.udgiftTil`), men `summaryDisplay: 'messageOnly'` skjuler den, så teksterne bliver ens.
- **Det er uhensigtsmæssigt fordi:** BB-218's foldning hvilede på, at den røde ring viser, hvilke rækker
  det gælder. Her er der ingen ring, så foldningen fjerner selve oplysningen: brugeren retter én række,
  tror han er færdig, og får den samme besked igen.
- **Bedre ville være:** Lad linjen bære rækkens beskrivelse («Transport: Beløb er ikke angivet»), så to
  rækker aldrig giver ens tekst – det løser samtidig BB-229's rækkeangivelse. Alternativt: fold kun
  linjer, hvis regel også farver cellerne.
- **Andre steder det kan gælde:** Enhver `messageOnly`-række pr. tabelrække, hvis tekst ikke nævner
  rækken: `rg "summaryDisplay: 'messageOnly'" src/domain/eoRowEvaluation` – lønindkomstens og
  sygeferiegodtgørelsens rækker (`eoRowIndkomstRows.ts`, `eoRowSygeferiegodtgoerelseRows.ts`) er de
  oplagte kandidater til 12h og 12j.

**Tilbagemelding**
Enig. Men tænk det for god ordens skyld gerne ind i en samlet løsning på alle de problemer, der er med manglende eller fejlbehæftede indtastninger i feltningerne, så alle rettelser løses som led i én gennemtænkt rettelse.

### BB-232 – Et beløb på `0` tages imod af feltet, men spærrer opgørelsen med en besked, der ikke kan findes

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-33--to-lag-vurderer-samme-række-hver-for-sig--og-brugeren-får-begge-svar`
- **Prioritet:** Mellem
- **Beslutning:** **AFGJORT** af udvikleren 2026-09-23: 0 kr. er en fejl. **GENNEMFØRT** 2026-09-23: feltet
  selv afviser 0 med rød ring og tooltippen «Beløbet skal være større end 0 kr.» – samme tekst og samme
  regel som rentekravets beløb (BB-038), nu delt i `positiveAmountValidator`. I «Fejl og advarsler» er det
  rækkens ene linje: «Medicin: Beløbet skal være større end 0 kr.» med link til cellen.
- **Sådan fremprovokeres det:** Tast `15-03-2024` · `Medicin` · `0`. Gå til Beregning.
- **Det sker:** Feltet viser `0,00` med neutral kant (`aria-invalid = "false"`). Boksen viser «Beløb skal
  være større end 0» – uden link, uden at nævne øvrige krav eller rækken. Opgørelsen har dusinvis af
  beløbsfelter. Downloadknappens tooltip er «Indtastning mangler», selv om beløbet netop ER indtastet.
  Feltets egen grænse er `amountBoundsValidator(…, 0, undefined)`, dvs. 0 er lovligt; validatoren kræver
  `> 0`. De to lag har hver sin nedre grænse for samme celle.
- **Det er uhensigtsmæssigt fordi:** Brugeren har ingen vej fra beskeden til feltet, og cellen ser ud som
  alle de andre gyldige celler. Hukommelsens erfaring (`validationerror-vs-fieldissue-asymmetri`) er
  præcis denne: en regel i validatoren blokerer uden rød celle, og repoets egen præcedens er «flyt
  grænsen til descriptoren».
- **Bedre ville være:** Flyt reglen til feltet: en eksklusiv nedre grænse på beløbet, så cellen bliver
  rød med tooltippen «Beløb skal være større end 0», og validatorens linje udgår. Ønsker udvikleren i
  stedet at tillade 0 (en post, der er rejst, men endnu uden beløb), skal validatoren følge feltet.
- **Andre steder det kan gælde:** `rg "skal være større end 0" src/validators` – «Grundløn skal være
  større end 0 på alle manuelle reguleringsrækker» (12i) har samme form.

**Tilbagemelding**
Enig. Indtastning af 0 kr. som beløb her er en fejl, der skal give rød ring og tooltip, og være en blokerende fejl i fejl og advarsler-boksen.

### BB-233 – Forbeholdet om den verserende EET-klage trykkes kun, når øvrige krav er «Ja» – og en ny sag starter på «Skjul»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-15--skærmen-tier-hvor-dokumentet-taler` og
  `#m-28--den-manglende-oplysning-ligger-allerede-i-beregningsoutputtet`
- **Prioritet:** **Høj**
- **Beslutning:** **AFGJORT** af udvikleren 2026-09-23: forbeholdet hører til EET, ikke til øvrige krav.
  **GENNEMFØRT** 2026-09-23 for begge forbehold efter udviklerens svar på opfølgningen: klageforbeholdet og
  kontanthjælps-/ressourceforløbsforbeholdet trykkes sidst i TAF-beregningen under underoverskriften
  «Forbehold», hvert på sin egen linje. «Øvrige krav» bærer ingen forbehold længere.
- **Sådan fremprovokeres det:**
  1. AES-afgørelser: «Midlertidigt EET-afgørelse» slået til med afgørelsesdato `01-03-2024`, «Verserende
     klage over EET» slået til.
  2. Hent opgørelsen med øvrige krav på hhv. «Ja» (ingen rækker), «Nej» og «Skjul».
- **Det sker:**

  | Øvrige krav | Dokumentets afsnit «Øvrige krav» |
  |---|---|
  | Ja, ingen rækker | «Hvis der som følge af den verserende klagesag over erhvervsevnetab sker ændringer i ydelse eller virkningstidspunkt, vil kravet blive reguleret tilsvarende.» |
  | Nej | «Ingen» – forbeholdet er væk |
  | Skjul | hele afsnittet er væk – forbeholdet med |

  «Skjul» er en ny sags udgangspunkt. En bruger, der aldrig rører øvrige krav, får derfor aldrig
  forbeholdet med, uanset hvad han har angivet om klagesagen. Skærmen nævner det intet sted: sætningen
  findes som rækken `oevrigekrav.intro.1` med `status: 'ok'` og vises kun på kontrolfanen «EO-kontrol».
  Samme mekanik (`resolveOevrigeKravIntroLinjer`) styrer forbeholdet «Skadelidte har modtaget
  kontanthjælp … Kræves ydelsen tilbagebetalt … vil kravet blive forhøjet», som udløses af offentlige
  ydelser i TAF-perioden; den variant er kodeverificeret, ikke målt.
  At «Nej» dropper forbeholdet er bevidst (`opgoerelseSection.ts:716`: «'Nej' … viser fortsat overskrift
  + 'Ingen' (uden forbehold-intro)»). Det er kombinationen med default-«Skjul», der gør det tavst.
- **Det er uhensigtsmæssigt fordi:** Et forbehold er det, der holder et krav åbent over for modparten.
  Det udløses af oplysninger i to andre sektioner, men dets eksistens afhænger af et tredje valg, som
  brugeren ingen grund har til at forbinde med dem – og som står på «Skjul», før han har gjort noget.
  Han kan ikke opdage, at forbeholdet mangler, uden at kende programmets indre regel.
- **Bedre ville være:** Udvikleren afgør, hvor forbeholdet hører hjemme:
  (a) forbeholdene er en egenskab ved SAGEN og trykkes uanset øvrige kravs valg – fx under «Samlet
  erstatningskrav» eller i det afsnit, hvis ydelser de handler om; eller
  (b) de hører til øvrige krav, og så skal skærmen sige det: når et forbehold er udløst, og øvrige krav
  står på «Nej»/«Skjul», viser sektionen en linje «Forbeholdet om den verserende klagesag trykkes kun,
  når der er øvrige krav» – eller programmet advarer i «Fejl og advarsler».
- **Andre steder det kan gælde:** Enhver dokumenttekst, der udløses af én sektions felter og gates af en
  anden sektions valg. Prøven: `rg "resolve\w*Intro|Forbehold" src/document/generators/eo` og for hvert
  træf, hvilket valg der skal være sat, for at teksten trykkes.

**Tilbagemelding**
Hvis nogen forhold vedrørende verserende EET-klage på nogen møde er placeret under Øvrige krav, er det en alvorlig fejl. Det har intet at gøre der. Forhold om verserende EET-klage hører til sammen med de øvrige felter om EET. Undersøg meget gerne, om der er andre steder, hvor felterne kunne tænkes at være placeret sammen med andre forhold, de reelt ikke hører sammen med.

**Opfølgning (agent, 2026-09-23) – klageforbeholdet er flyttet; ét forbehold mere står samme forkerte sted og
kræver din afgørelse.**
*Gennemført:* dokumentet oplyser EET-afgørelserne i afsnittet «Tabt arbejdsfortjeneste» under «Status»
(«Der er truffet midlertidig erhvervsevnetabsafgørelse med virkning fra 1. marts 2024. Afgørelsen er
påklaget.»). Forbeholdet står nu lige efter den linje og er væk fra «Øvrige krav». Det trykkes derfor uanset
øvrige kravs valg – også i en ny sag, hvor øvrige krav står på «Skjul». Betingelserne for, HVORNÅR det
trykkes, er uændrede. **Bemærk konsekvensen:** EET-linjerne – og dermed forbeholdet – trykkes kun, når tabt
arbejdsfortjeneste er «Ja». Står TAF på «Nej» eller «Skjul», oplyser dokumentet slet ikke EET-afgørelsen og
derfor heller ikke klagen. Det følger af, hvor EET-oplysningerne i forvejen står, og det er efter min
vurdering rigtigt, fordi et ændret virkningstidspunkt netop regulerer TAF-kravet. Sig til, hvis
EET-oplysningerne også skal kunne stå i en opgørelse uden TAF.
*Kræver din afgørelse:* gennemgangen af opgørelsesdokumentets afsnit fandt ét forhold mere, der står sammen
med noget, det ikke hører til – forbeholdet **«Skadelidte har modtaget kontanthjælp i erstatningsperioden.
Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.»** Det udløses af
kontanthjælp eller ressourceforløbsydelse blandt indtægterne i TAF-perioden, men trykkes under «Øvrige krav»
og har derfor nøjagtig samme fejl: i en ny sag, hvor øvrige krav står på «Skjul», trykkes det aldrig. Mit
forslag er at flytte det til «Tabt arbejdsfortjeneste», lige efter listen «Indtægter i erstatningsperioden»,
hvor kontanthjælpen selv står. Jeg har ikke flyttet det, fordi koden dokumenterer placeringen under øvrige
krav som et bevidst valg, og din tilbagemelding kun afgjorde EET-klagen. **Skal det flyttes?**
De øvrige afsnit er i orden: svie/smerte-afsnittets status trykker mén-afgørelsen og -klagen, der netop
afgrænser svie/smerte-perioden; TAF-afsnittets status trykker EET-afgørelserne og differencekravet, der
afgrænser TAF-perioden; bilagshenvisningerne står under det afsnit, bilaget dokumenterer.

**Svar fra udvikleren (2026-09-23):** begge forbehold – EET-klagen og kontanthjælpen – indsættes sidst i
TAF-beregningen under deres egen underoverskrift «Forbehold», hver på sin egen linje, hvis begge vises. At de
kun trykkes, når TAF er «Ja», er korrekt.

**Gennemført (agent, 2026-09-23):** «Forbehold» står nu som sidste underafsnit i «Tabt arbejdsfortjeneste»,
efter «Beregnet krav». Klageforbeholdet er flyttet væk fra «Status» igen og står først; ydelsesforbeholdet
står under det. Underoverskriften trykkes kun, når mindst ét forbehold er udløst, og betingelserne for hvert
forbehold er uændrede. Dækket af `erstatningsopgoerelsePdf.indkomstBreakdownVisibility.test.ts`.

### BB-234 – Øvrige krav står ingen steder på Beregning-fanen

- **Type:** Fornuft
- **Rækkevidde:** Lokal
- **Prioritet:** Mellem
- **Beslutning:** **AFGJORT** af udvikleren 2026-09-23. **GENNEMFØRT** 2026-09-23: sammendraget har rækken
  «Øvrige krav» med «2 poster» / «1 post» / «Ingen poster angivet» / «Ikke rejst» / «Ikke rejst (skjult)» /
  «Fejl». Se opfølgningen om TAF-rækken under tilbagemeldingen.
- **Sådan fremprovokeres det:** Tast to fulde rækker (`Medicin` 1.250,00 og `Transport til behandling`
  480,50) og gå til Beregning.
- **Det sker:** Sammendraget under «Beregning» viser «Erstatningsopgørelse 1», «Skadedato», «Svie/smerte-
  periode: Ikke rejst» og «TAF-periode: Nej». Om øvrige krav står intet – hverken at de er rejst, at der
  er to poster, eller at de er fravalgt. Det hentede dokument har begge poster og «I alt 1.730,50 kr.»
- **Det er uhensigtsmæssigt fordi:** Udviklerens afgørelse ved BB-226 er, at fladen skal vise **hvilke
  ydelser der indgår i opgørelsen og for hvilken periode**. Øvrige krav er en af de tre ydelser, og den
  er den eneste, sammendraget ikke nævner. Den, der skimmer sammendraget før download, kan ikke se, om
  hans øvrige krav er med – og netop dette krav starter skjult på en ny sag.
- **Bedre ville være:** En række «Øvrige krav» i sammendraget med samme skel som BB-227's rettelse og
  uden beløb, så BB-226 står uberørt: «2 poster» · «Ikke rejst» · «Ikke rejst (skjult)» · «Ingen poster
  angivet».
- **Andre steder det kan gælde:** Ingen – sammendraget har kun de tre krav. Rækken «TAF-periode: Nej»
  bruger stadig det gamle ord, BB-227 rettede for svie/smerte; den hører i 12e (se «Henvisninger»).

**Tilbagemelding**
Enig. Følg dog gerne den samme ordlyd, som anvendes i forhold til svie/smerte og tabt arbejdsfortjeneste.

**Opfølgning (agent, 2026-09-23):** svie/smerte og tabt arbejdsfortjeneste brugte ikke samme ordlyd. Svie/smerte
skriver «Ikke rejst» / «Ikke rejst (skjult)» / «Ingen perioder angivet» (BB-227's rettelse), mens TAF skrev
«Nej» / «Nej (skjult)» – og «Nej» også, når TAF stod på «Ja» uden perioder. Jeg har fulgt svie/smertes ordlyd
for øvrige krav og, for at de tre rækker faktisk er ens, rettet TAF-rækken til de samme tre udtryk.
TAF-rettelsen var registreret som BB-227's uløste søster til 12e; den er dermed gennemført her og skal ikke
tages op igen dér.

### BB-235 – En udgift uden for opgørelsens periode står uden bemærkning i opgørelsen for perioden

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Mellem
- **Beslutning:** **AFGJORT** af udvikleren 2026-09-23: ikke-blokerende advarsel. **GENNEMFØRT** 2026-09-23:
  «Fejl og advarsler» viser «Medicin: Datoen ligger uden for opgørelsens periode (01-01-2024 - 31-12-2024)»
  med link til datocellen, og download er fortsat mulig. Begrundelsen – kvitteringer fra en tidligere periode
  kan legitimt medregnes senere – står ved reglen i `oevrigeKravRowValidation.ts` sammen med forbuddet mod at
  gøre den blokerende. Har rækken også en fejl, vises kun fejlen, så rækken aldrig giver to linjer.
  Efter udviklerens svar på opfølgningen får datocellen desuden en gul ring med samme tekst.
- **Sådan fremprovokeres det:** «Vedrører perioden» `01-01-2024` – `31-12-2024`, «Opgørelse lavet den»
  `01-02-2025`. Tast rækker dateret `15-06-2019`, `15-06-2024` og `15-01-2025`. Hent opgørelsen.
- **Det sker:** Ingen celle er rød eller gul, boksen er tom, og dokumentet skriver alle tre under
  «Øvrige krav» og derefter «Det samlede krav for perioden 01-01-2024 - 31-12-2024 udgør: 600,00 kr.»
  Datofeltets eneste grænser er skadedatoen og dags dato (`tabelOevrigeKravDato`). En dato efter
  «Opgørelse lavet den» – fx `01-06-2026` – tages også imod.
  Sektionens eget spørgsmål er «Er der øvrige krav **i erstatningsperioden**».
- **Det er uhensigtsmæssigt fordi:** Udgiften fra 2019 er næsten sikkert en tastefejl (2019 for 2024) eller
  en post, der hører i en tidligere opgørelse – og den ender i et dokument, der udtrykkeligt siger, at
  kravet gælder 2024. Programmet kender begge datoer og siger intet.
- **Bedre ville være:** En ikke-blokerende gul ring på datocellen, når datoen ligger uden for «Vedrører
  perioden»: «Datoen ligger uden for opgørelsens periode (01-01-2024 – 31-12-2024)». Advarslen blokerer
  ikke, fordi en senere betalt regning for en udgift i perioden kan være legitim – den afgørelse hører
  hos brugeren.
- **Andre steder det kan gælde:** Rækkedatoer i EO, der kun er bundet af skadedato og dags dato. Prøven:
  `rg "type: 'dynamic-min'" src/config/dateRanges.ts` og for hvert træf, om feltet semantisk hører til
  «Vedrører perioden».

**Tilbagemelding**
En angivet dato uden for erstatningsperiodens interval skal give en ikke-blokerende advarsel på fejl og advarsler-siden, men skal ikke i sig selv betragtes som en blokerende fejl. Det vil kunne ske, at brugere har haft udgifter til fx. medicin i en tidligere erstatningsperiode, men først sender kviteringerne senere, så udgiften medregnes i opgørelsen for en senere periode - dette skal dokumenteres, så det ikke fremover flages som en fejl.

**Opfølgning (agent, 2026-09-23):** fundet foreslog også en gul ring på datocellen. Den har jeg ikke lavet,
fordi din tilbagemelding nævner advarslen i «Fejl og advarsler» og ikke ringen, og fordi tabellens celler i
dag ikke kan vise en gul ring – det kræver en ny kanal i tabellen. Linket fra advarslen blinkmarkerer cellen.
Sig til, hvis du også vil have ringen.

**Svar fra udvikleren (2026-09-23):** ja tak.

**Gennemført og rettelse (agent, 2026-09-23):** datocellen får nu en gul ring med tooltippen «Datoen ligger
uden for opgørelsens periode (01-01-2024 - 31-12-2024)» – samme regel og tekst som linjen i «Fejl og
advarsler», og stadig ikke blokerende. **Min begrundelse ovenfor var forkert:** tabellens celler HAR en kanal
til gule advarsler (den bruges fx i EET-afgørelsernes tabel); den krævede ingen ny mekanisme.

### BB-236 – «Ja» uden en eneste post giver tavshed på skærmen og «Ingen» i dokumentet – ordret som «Nej»

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (BB-221's form)
- **Prioritet:** Lav
- **Beslutning:** **AFGJORT** af udvikleren 2026-09-23. **GENNEMFØRT** 2026-09-23: ikke-blokerende advarsel
  «Der er ikke indtastet øvrige krav» med link til tabellens første celle. TAF i samme tilstand hører til 12e.
- **Sådan fremprovokeres det:** Sæt kravvalget til «Ja», tast ingen rækker, gå til Beregning og hent
  opgørelsen.
- **Det sker:** Ingen linje i «Fejl og advarsler». Dokumentet skriver «Øvrige krav / Ingen» – ordret som
  ved «Nej». Svie/smerte advarer i den tilsvarende tilstand («Der er ikke angivet nogen svie/smerte-periode
  i EO-perioden»), og programmet har allerede sætningen for øvrige krav: bilagsnummerfeltet advarer
  «Der er angivet bilagsnummer for øvrige erstatningskrav, men der er ikke indtastet øvrige krav»
  (`bilagWarnings.ts`) – men kun, hvis der ER et bilagsnummer.
- **Det er uhensigtsmæssigt fordi:** «Ja» er et svar om, at der ER øvrige krav. At programmet tier, når
  svaret ikke følges af en eneste post, lader en glemt tabel passere som et færdigt krav.
- **Bedre ville være:** En ikke-blokerende advarsel, når kravvalget er «Ja» og tabellen er tom: «Der er
  ikke indtastet øvrige krav», med link til tabellens første celle.
- **Andre steder det kan gælde:** TAF (12e) i samme tilstand.

**Tilbagemelding**
Enig.

### BB-237 – Kravvalget og boksens beskeder bruger andre navne end skærmen

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne` (BB-211/BB-224's form)
- **Prioritet:** Lav
- **Beslutning:** Agent afgør (ren navnedublering, samme mekanik som BB-224's godkendte rettelse)
  **GENNEMFØRT** 2026-09-23: kravvalgets tilgængelige navn er «Er der øvrige krav i erstatningsperioden», og
  beskederne bruger kolonnenavnene i «»: «Udgift til» og «Beløb».
- **Sådan fremprovokeres det:** Læs sektionens tilgængelige navne i accessibility-træet og boksens
  beskeder ved en række uden beskrivelse.
- **Det sker:**

  | Synligt på skærmen | Andet navn for samme ting | Hvor |
  |---|---|---|
  | «Er der øvrige krav i erstatningsperioden» | `Krav på øvrige erstatningskrav` | radiogruppens tilgængelige navn |
  | kolonnen «Udgift til» | «Beskrivelse er ikke udfyldt» | rækkebyggerens besked |
  | kolonnen «Udgift til» | «Udgift til mangler» | validatorens besked |
  | «Beløb» | «Beløb er ikke angivet» / «Beløb mangler» | samme regel, to lag |

  Tabellens celler har korrekte navne («Dato», «Udgift til», «Beløb»), fordi de tegnes af grid-cellerne
  med descriptorens `label`.
- **Det er uhensigtsmæssigt fordi:** Brugeren leder efter et felt, der hedder «Beskrivelse», og finder
  det ikke; skærmlæseren oplæser et andet spørgsmål end det, der står.
- **Bedre ville være:** Descriptorens `label` = «Er der øvrige krav i erstatningsperioden» (som BB-224),
  og rækkebeskederne bruger kolonnenavnet: «Udgift til er ikke udfyldt». Den dobbelte formulering af
  beløbsreglen forsvinder med BB-229's ene lag.
- **Andre steder det kan gælde:** Kravvalget for TAF (12e); BB-211's prøve `rg 'className="row--label-right-hover"'`
  sammenholdt med descriptorernes `label`.

**Tilbagemelding**
I det væsentligste enig, men med de forbehold, at 'øvrige krav' og 'Udgift til' bør stå i apostrofer eller lignende. Der er tale om udtryk, som også i almindelighed bruges i det danske sprog - så brugeren skal kunne se og vide, at de i denne sammenhæng specifikt relaterer til et sted på siden, som benytter betegnelserne.

**Opfølgning (agent, 2026-09-23):** jeg har brugt «» frem for apostrofer, fordi det er programmets gældende form,
når en besked henviser til et sted på skærmen (fx «Indstillingen «…» er slået fra på fanen «…»»).
Et spørgsmål til dit forbehold om «øvrige krav»: ingen af de nye beskeder bruger ordet som henvisning til et
felt – de står alle i sektionen og nævner kun kolonnerne. Det eneste sted, ordet står i en besked, er
advarslen «Der er ikke indtastet øvrige krav» (BB-236), hvor det er almindelig tale om kravene og ikke navnet
på noget på siden; dér har jeg ladet det stå uden «». Sig til, hvis du mente et andet sted.

**Svar fra udvikleren (2026-09-23):** nej – det var en bekymring ud fra formuleringen, og da det er
undersøgt og ikke aktuelt, er det fint. Afsluttet.

## Overvejet uden fund

- **Summen og forligsreduktionen er kontrolregnet og er i orden.** `1.250,00 + 480,50 = 1.730,50`;
  `1.250,00 + 333,33 = 1.583,33`, `50 % × 1.583,33 = 791,665 → 791,67 kr.`; tre poster
  `99 + 1.250 + 4.000 = 5.349,00`. «Samlet erstatningskrav» gentager beløbet korrekt.
- **Forlig trykkes efterregneligt:** «Beregnet krav på øvrige krav / 50 % x (1.583,33 kr.) = 791,67 kr.»
  – begge led og resultatet står på linjen. BB-219's problem (et loft, der reduceres uden at blive
  trykt) har ingen pendant her, fordi øvrige krav ikke har et loft.
- **Én post trykkes med fed og uden «I alt»; flere poster får «I alt».** Konsistent og forståeligt.
- **Sortering følger med til papiret.** Klik på «Beløb» sorterer tabellen (Afløb 99 · Medicin 1.250 ·
  Briller 4.000), og dokumentet trykker samme rækkefølge. Brugeren styrer rækkefølgen; det er i orden.
- **Kravvalget «Ja/Nej/Skjul» opfører sig ordret som i 12b:** tabellen skjules ved «Nej» og «Skjul»,
  og værdierne bevares, så et skift tilbage til «Ja» viser dem igen (målt). «Skjul» fjerner afsnittet
  og linjen i «Samlet erstatningskrav» helt; «Nej» trykker «Ingen». BB-213's afvisning dækker, at
  «Skjul» ikke forklares. Efter `flader.md` noteres den fælles adfærd som endeligt efterprøvet i 12e.
- **Ny sag på «Skjul» er en dokumenteret designbeslutning** (`erstatningsopgoerelseNewCaseSeed.ts`) og
  ikke et fund i sig selv; det er dens samspil med forbeholdene (BB-233) og sammendraget (BB-234), der er.
- **Datoens faste grænser virker og navngiver deres kilde:** før skadedatoen → «Datoen kan ikke være før
  skadedatoen (01-06-2018)»; efter i dag → «Datoen er efter dags dato (23-09-2026)»; `31-02-2024` →
  «Datoen findes ikke i kalenderen». Cellen bliver rød. Tocifret år følger den fælles regel (`15-03-24`
  → `15-03-2024`). Det, der er galt, er de ledsagende linjer (BB-230), ikke grænserne.
- **Negativt beløb kan ikke tastes** (codec `allowNegative: false`); validatorens «Beløb kan ikke være
  negativt» er dermed kun nåbar via en indlæst fil.
- **En række med kun en ugyldig dato regnes som udfyldt** – slet-knappen vises, og boksen melder
  «Datoen findes ikke i kalenderen». B6a's prøve er bestået: programmet ser det, brugeren ser.
- **«Udgift til» har 60 tegn** (`SHORT_TEXT_MAX_LENGTH`), og feltet viser omtrent 55 (`clientWidth` 382 px,
  `scrollWidth` 422 px ved 60 tegn). Grænsen svarer dermed nogenlunde til det synlige, som M-04's
  målestok kræver. Teksten er centreret, så et fuldt felt skjuler et par tegn i hver ende; det er for
  lidt til et fund. Dokumentet trykker hele værdien.
- **Bilagsnummer-advarslen for øvrige krav dækker begge tilstande** (valg ≠ «Ja» og «Ja» uden poster)
  med hver sin sætning – BB-207's rettelse gælder også her.
- **M-09 bestået:** ingen vandret scroll ved 1244×620 (`scrollWidth = clientWidth = 1244`).
- **M-23 er uden genstand:** to ens poster er to udgifter, ikke en dobbelttælling af tid; der er ingen
  periode at af-duble.
- **Konsollen var tavs:** 163 beskeder i den sidste fulde kørsel, 0 fejl, 0 advarsler, 0 page-errors;
  ingen af de øvrige kørsler gav fejl eller advarsler.

## Henvisninger til andre bidder

- **12l – downloadknappens tooltip afhænger af, hvilket lag fejlen kommer fra.** Ved rækkebyggerens fejl
  er den «Opgørelse kan ikke hentes, når der er fejl ovenfor»; ved validatorens og ved røde celler er den
  «Indtastning mangler» – også når boksen viser fejlen, og også om et beløb på `0`, der netop er
  indtastet. `document-output-contract.md` §A5.1 giver `page-errors` forrang. Målt fem gange i 12c.
- **12e – «TAF-periode: Nej»** i sammendraget er BB-227's uløste søster (allerede nævnt ved BB-227).
- **12e – kravvalget:** den fælles «Ja/Nej/Skjul»-adfærd skal noteres som efterprøvet dér (jf. `flader.md`).

## Dækningshuller

- Kun Chrome, lyst tema; kun PDF-kanalen er læst (Word-udgaven bør læses i 12l).
- **Kontanthjælps-forbeholdet (BB-233) er kun kodeverificeret**, fordi det kræver TAF-perioder og
  offentlige ydelser i perioden. Mekanikken er den samme funktion som klage-forbeholdet, der er målt.
- `Gem`/`Hent` er ikke afprøvet (filvælgeren kan ikke betjenes headless). Relevant for BB-228: en
  `.eo`-fil med en halvudfyldt, skjult række vil åbne direkte i blindgyden.
- Undo/redo efter et skift af kravvalget er ikke målt.
- Indsat tekst fra regneark i tabellen (M-14) er ikke afprøvet; tabellen deler grid-celler med de
  tabeller, hvor M-14 allerede er afgjort.
- Kontrolfanen «EO-kontrol» er ikke gennemgået (12m).
