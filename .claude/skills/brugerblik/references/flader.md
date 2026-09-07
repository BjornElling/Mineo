# Fladerækkefølge

Rækkefølgen går fra de mindste og enkleste flader til de største og mest sammensatte.

**Hvorfor.** De fleste uhensigtsmæssigheder er ikke enestående – de er ét udslag af en vane, der
går igen overalt i programmet. På en lille flade er vanen let at få øje på, let at bedømme og let
at beskrive, fordi der ikke er noget at forveksle den med. Bliver den fundet og afklaret dér, kan
de store flader senere gennemgås med et færdigt sæt principper i hånden i stedet for at genopdage
det samme mønster ti gange under ti forskellige navne. Den omvendte rækkefølge ville betyde, at det
sværeste blev bedømt først – på det tidspunkt, hvor mindst var afklaret.

Rækkefølgen følges, medmindre brugeren peger på en bestemt flade. Den kan justeres, hvis en flade
viser sig at være væsentligt større eller mindre end antaget; en justering noteres i `STATUS.md`.

## Rækkefølgen

| # | Flade | Rute / placering | Bemærkning |
|---|---|---|---|
| 1 | Stamdata | `/stamdata` | 7 felter, to sektioner, ingen faner. Fladen alt andet afhænger af. |
| 2 | Om | `/mineo` | Næsten ren visning. Godt sted at bedømme tekst, links og tilbagevenden. |
| 3 | Indstillinger | `/indstillinger` | Få valg, men de virker på hele programmet. |
| 4 | Satser | `/satser` | Opslag/visning uden indtastning. Læsbarhed og genfinding. |
| 5 | MinProcesrente | selvstændig app | Lille, offentlig flade med egen indgang og egne forudsætninger. |
| 6 | Global shell | sidemenu, login, Gem/Hent/Slet alt, overlays, undo/redo | Tværgående. Tages her, når de små sider har vist, hvad der er normalt. |
| 7 | Varige mén | `/varigemen` (pr. fane) | Første flade med reelle beregninger og afhængighed af Stamdata. |
| 8 | Renteberegning | `/renteberegning` (pr. fane) | Perioder, datoer og rentesatser. |
| 9 | Årslønsberegning | `/aarsloen` | Første flade med en større indtastningstabel. |
| 10 | Forsørgertab | `/forsoergertab` | Mange indbyrdes afhængige forudsætninger. |
| 11 | Erhvervsevnetab | `/erhvervsevnetab` (pr. fane) | Stor. Tages fane for fane. |
| 12 | Erstatningsopgørelse | `/erstatningsopgoerelse` (pr. fane) | Programmets største flade – for stor til én kørsel pr. fane. **Delt i tretten bidder efter emne, 12a–12m; se afsnittet nedenfor.** |

## Deling af flade 12 – Erstatningsopgørelse

Erstatningsopgørelsen har fire hovedfaner og to betingede kontrolfaner, men fanerne er ikke en brugbar
deling: «EO oplysninger» rummer ni selvstændige sektioner med hver sit erstatningskrav, og «Lønindkomst»
rummer et kort pr. ansættelsesforhold med seks underafsnit hver. Én fane pr. kørsel ville betyde to
kørsler på over 1.300 linjer komponentkode med hver sit halve dusin ubeslægtede emner – præcis den
tilstand, SKILL.md §1's krav om «tæt nok til at hvert felt faktisk er tænkt igennem» udelukker.

**Delingen følger derfor EMNET – det erstatningskrav eller den forudsætning, brugeren arbejder med – og
ikke fanen.** Hver bid tages som sin egen kørsel og føres som sin egen række i `STATUS.md`.

**Skærm og papir hører sammen i samme bid.** Opgørelsesdokumentets afsnit er fordelt ud på de bidder, der
frembringer dem, så prøven «vist = beregnet = trykt» kan stilles i én kørsel. Det er lært af flade 11:
M-13's og M-31's prøver kræver, at samme kørsel har læst både skærmen og papiret.

**Rækkefølgen går fra ramme til krav til grundlag til sammentælling.** 12a lægger sagens ramme. 12b–12c er
de to erstatningskrav, der står ved siden af tabt arbejdsfortjeneste og kan bedømmes for sig. 12d er de
afgørelser, der afgrænser alle perioderne. 12e–12f er TAF-kravets periode og dens beregningsgrundlag.
12g–12i går ned i det enkelte ansættelsesforhold og reguleringen af det. 12j er sygeferiegodtgørelsen, som
hviler på ansættelsesforholdet. 12k er den fane, der modregner. 12l samler alt til opgørelsen. 12m er de
kontrolflader, der findes for at efterprøve resten. De tidlige bidder er dermed også de mindste, som
fladerækkefølgen selv foreskriver.

| # | Bid | Flade og afsnit | Dokumentafsnit, der hører med |
|---|---|---|---|
| 12a | Opgørelsens ramme | EO oplysninger: «Erstatningsopgørelse» (sagsinfo, titel, udkast-stempel, «Opgørelse afsluttes med») · «Forlig» · «Eventuelle særlige kommentarer» · «Bilagsnumre» | Brevhoved, dokumenttitel, udkast-stempel, bilagsnummerering, afslutningsformlen |
| 12b | Svie- og smertegodtgørelse | EO oplysninger: «Svie- og smertegodtgørelse» – kravvalget, periodetabellen, satsåret, «Tidligere svie- og smertegodtgørelse» og allerede modtaget godtgørelse | Svie/smerte-afsnittet i opgørelsen |
| 12c | Øvrige erstatningskrav | EO oplysninger: «Øvrige erstatningskrav» – kravvalget og kravtabellen | Øvrige krav-afsnittet i opgørelsen |
| 12d | AES-afgørelser og erstatningsperiodens afgrænsning | EO oplysninger: «AES-afgørelser» (varige mén, midlertidigt og endeligt EET, verserende klage, differencekravsdato) og de afskæringsdatoer, de sætter for de øvrige krav | Forudsætningslinjerne om afgørelser i opgørelsen |
| 12e | Tabt arbejdsfortjeneste: perioden | EO oplysninger: «Tabt arbejdsfortjeneste» – kravvalget, periodetabellen med afskæringsdatoer, ferie i perioden og allerede modtaget TAF | TAF-afsnittet i opgørelsen |
| 12f | Beregningsgrundlaget for TAF | EO oplysninger: «Indtægt før skadedatoen» – valget «Beregnes ud fra» og alle dens grene (Beregningsperiode · Angivet månedsløn · Angivet dagsløn) samt ferie og øvrigt fravær i beregningsperioden | `tafBeregningsgrundlagSection` |
| 12g | Ansættelsesforholdet: ramme, lønforhold og satser | Lønindkomst: introboksen, tilføj-/slet-dialogerne, kortets overskrift, «Lønforhold» (herunder «Løn på helligdage» og «Løn indtastes som») og satsafsnittet | `shDageSection` (SH-dage-bilaget) |
| 12h | Ansættelsesforholdets indtægtsoplysninger | Lønindkomst: kortets «Indtægtsoplysninger» – perioderne, beløbene og tillæggene | `loenindkomstSection` (lønindkomstbilaget) |
| 12i | Lønudvikling og regulering af tabet | «Lønudvikling» + «Anciennitetstillæg» på BEGGE flader (både «Indtægt før skadedatoen» og hvert ansættelsesforhold): de fire grundlag Overenskomst · Statistik · Manuelt angivet · Manuel procentsats, KRL- og KL-satstabellerne, dækningsreglen og **løntrin-finder-overlayet**, hvis knap «Find løntrin» bor i netop denne blok | `reguleringSection`, `reguleringDocument` samt KRL- og KL-dokumenterne |
| 12j | Sygeferiegodtgørelse | Lønindkomst: kortets sygeferiegodtgørelses-afsnit, herunder 6-måneders-advarslen, kildevalget og periodiseringen | Sygeferiegodtgørelses-bilaget i `eoBilagSections` |
| 12k | Offentlige ydelser | Hele fanen: ydelsestabellen, «Tilføj særligt» (maksimal sygedagpengesats, midlertidigt EET hentet fra EET-siden) og «Kommentarer» | `offentligeYdelserSection` og `renderMidlertidigtEetSection` |
| 12l | Beregning: fejlpanelet, sammentællingen og bilagsvalgene | Beregning-fanen i sin helhed: «Fejl og advarsler», «Beregning» (sammendragslinjerne og «Hent opgørelse»), «Bilag» (syv valg plus Alle/Perioden) og «Alternative beregninger» (TAF fordelt på kalenderår, TAF opreguleret, TAF-kravgrafen) – alle downloadknapper og deres gates | `opgoerelseSection` (opgørelsens forside og sammentælling), `eoBilagSections`' sammensætning, og de tre alternative dokumenter |
| 12m | EO-gennemsyn og Kontroltabel | De to kontrolfaner, der kun vises når indstillingen «Vis kontrolfaner på Erstatningsopgørelse-side» er slået til | – |

**Dækningskontrol.** Delingen er lagt, så hvert af Erstatningsopgørelsens elementer optræder præcis én
gang. Før flade 12 erklæres `Gennemgået`, holdes den op mod disse seks lister:

- **Fanerne:** EO oplysninger (12a–12f) · Lønindkomst (12g, 12h, 12j) · Offentlige ydelser (12k) ·
  Beregning (12l) · EO-gennemsyn og Kontroltabel (12m). **12i går på tværs af de to første.**
- **De ni sektioner på EO oplysninger:** Erstatningsopgørelse (12a) · Forlig (12a) · Eventuelle særlige
  kommentarer (12a) · Bilagsnumre (12a) · Svie- og smertegodtgørelse (12b) · Øvrige erstatningskrav (12c) ·
  AES-afgørelser (12d) · Tabt arbejdsfortjeneste (12e) · Indtægt før skadedatoen (12f, med
  lønudviklingsdelen i 12i).
- **De seks underafsnit i ansættelsesforhold-kortet:** overskrift og «Lønforhold» (12g) · satsafsnittet
  (12g) · «Indtægtsoplysninger» (12h) · «Lønudvikling» (12i) · «Anciennitetstillæg» (12i) ·
  sygeferiegodtgørelse (12j).
- **De ti tabeller, EO renderer:** `SvieSmerteTable` (12b) · `OevrigeKravTable` (12c) ·
  `TafPeriodeTable` (12e) · `FerieperiodeTable` (12e for ferie i TAF-perioden, 12f for ferie i
  beregningsperioden) · `StandardLoenTable` (12h) · `LoenudviklingManuelTable` og
  `LoenudviklingManuelProcentsatsTable` (12i) · `OffentligeYdelserTable` (12k) ·
  `StandardDisplayTable` og `VirtualizedDisplayTable` (12m – kontrolfladernes visningstabeller).
- **De syv dokumenter:** opgørelsen (12l, med sine afsnit fordelt som i tabellen) · TAF fordelt på
  kalenderår (12l) · TAF opreguleret (12l) · TAF-kravgrafen (12l) · regulering (12i) · KRL (12i) ·
  KL-lønaftaler (12i).
- **Løntrin-finder-overlayet** hører i 12i, fordi knappen «Find løntrin» bor i `LoenudviklingFields` og
  altså i lønudviklingsblokken – ikke i satsafsnittet, hvor den visuelt ligger tæt på. Den åbnes fra
  BEGGE flader (EO oplysninger og hvert ansættelsesforhold), og 12i skal prøve begge indgange.

En bid, der møder et element uden for sin egen liste, registrerer det som en henvisning til den bid, det
hører til, frem for at gennemgå det. Er et element ikke på nogen liste, er delingen mangelfuld, og
`STATUS.md` skal have en ny række – ikke en udvidet eksisterende.

**To forhold, der bevidst tages i FLERE bidder.** De er tværgående mekanismer, ikke sektioner, og kan
ikke gennemgås uden den sammenhæng, de virker i:

- **Kravvalget «Ja / Nej / Skjul»** står øverst i svie/smerte-, TAF- og øvrige krav-sektionerne og styrer,
  om resten af sektionen findes. Hver af 12b, 12c og 12e prøver det for sin egen sektion; er adfærden
  ordret den samme alle tre steder, noteres det som efterprøvet i den sidste af dem frem for som tre fund.
- **Ansættelsesforhold-kortet findes i N udgaver.** 12g, 12h, 12i og 12j gennemgår ÉT kort hver, men skal
  hver især også prøve det med to kort i sagen – det er dér, prøven om identiske overskrifter og om
  krydsvirkninger mellem kortene hører (jf. BB-171 og BB-193).

## Deling af store flader

Har en flade faner, er **én fane = én kørsel**. Er en enkelt fane stadig for stor til en tæt
gennemgang, deles den i afsnit efter sidens egne sektioner (`ContentBox`/`section-header`), og
`STATUS.md` fører hvert afsnit som sin egen række.

En flade er først `Gennemgået`, når alle dens faner og afsnit er det.
