# Brugerblik – Erstatningsopgørelse → AES-afgørelser og erstatningsperiodens afgrænsning (12d)

- Rute/placering: `/erstatningsopgoerelse` → fanen «EO oplysninger», sektionen **AES-afgørelser** (Varige mén ·
  Midlertidigt erhvervsevnetab · Endeligt erhvervsevnetab · Øvrigt) – samt de afskæringsdatoer, sektionen
  sætter for svie/smerte- og TAF-perioderne, og opgørelsesdokumentets Status-linjer om afgørelser,
  klager og differencekrav.
- Gennemgået: 2026-09-24 · commit `7f8fa786`
- Afprøvet i: Chrome headless, lyst tema, 1536×864 (M-09 desuden 1244×620). Dokumenter hentet som `.pdf`
  og læst med `pdftotext -layout`. Sager med skadedato `01-06-2018` (efter 16. juni 2011) og `01-06-2010`
  (før), «Vedrører perioden» `01-01-2024` – `31-12-2024`, «Opgørelse lavet den» `01-02-2025`, TAF ud fra
  angivet månedsløn `30.000 kr.`

## Fladen kort

Sektionen har tre toggles («Truffet afgørelse om …»), seks datofelter, to klagetoggles og
differencekravsdatoen. Den regner intet selv, men hver dato bliver en **afskæringsdato** et andet sted:
ménafgørelsen standser svie/smerte dagen før, den endelige EET-afgørelse og differencekravet standser TAF
dagen før, og – kun for skader før 16. juni 2011 – gør den midlertidige EET-afgørelse det samme. En
verserende klage ophæver mén- henholdsvis EET-afskæringen, men ikke differencekravets. Afskæringerne
håndhæves som røde celler i svie/smerte- og TAF-tabellerne (12b/12e) og trykkes i dokumentet som
Status-linjer: mén under svie/smerte, EET og differencekrav under TAF.

Programmet har **to separate svar på det samme spørgsmål om afskæring**: den rød-celle-validering, der
afgør, om en TAF-dato er lovlig (`tafPeriodeValidation.ts`/`tafPeriodConstraints.ts`), og rækken «TAF-ophør
skyldes», der afgør, om TAF er rejst for hele perioden (`eoRowTaftRows.ts`). De er uenige om klagens
rækkevidde (BB-238). Og det prædikat, der afgør om en midlertidig afgørelse *afskærer TAF*, er genbrugt
til at afgøre om der *burde være indtastet ydelser* – to forskellige spørgsmål (BB-240). Begge er formen i
det nye mønster **M-34**.

**Afgrænsning.** Bilagsnummerfelterne «Bilagsnr. mén-afgørelse»/«Bilagsnr. EET-afgørelser» hører i 12a.
Svie/smerte- og TAF-tabellernes egne regler hører i 12b/12e; her er kun afskæringernes *oprindelse* og
deres beskeder gennemgået. «Midlertidigt EET hentet fra EET-siden» hører i 12k og er kun nævnt som
kandidat ved BB-240.

## Fund

### BB-238 – En verserende EET-klage får TAF-ophøret ved differencekravet til at se ufuldstændigt ud

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-34--en-regel-genbruger-en-nabo-regels-prædikat--og-arver-dens-undtagelser`
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør – reglen er dokumenteret («Differencekrav-grænsen gælder altid»,
  `docs/domain/taf/tabt-arbejdsfortjeneste.md` §Clamping), og rød-celle-valideringen følger den allerede.
- **Sådan fremprovokeres det:**
  1. TAF-periode `01-01-2024` – `30-06-2024`. «Evt. differencekrav opgjort per» `01-07-2024`.
  2. «Truffet afgørelse om endeligt erhvervsevnetab» Ja, dato `01-09-2024`.
  3. Slå «Verserende klagesag over EET-afgørelse?» til. Gå til Beregning og hent opgørelsen.
- **Det sker:** Uden klagen er alt stille. Med klagen viser «Fejl og advarsler» den gule linje **«Der er
  ikke rejst TAF-krav for hele EO-perioden»** med link til TAF-tabellen. Dokumentet skriver i samme sag
  **«Der er opgjort differencekrav i sagen den 1. juli 2024. Differencekravet bringer retten til tabt
  arbejdsfortjeneste til ophør.»** Samme udfald med den endelige afgørelse dateret FØR differencekravet
  (`01-03-2024`, påklaget). Forlænges TAF-perioden for at få advarslen væk, bliver til-cellen rød med
  «Der er angivet tabt arbejdsfortjeneste, efter differencekrav er opgjort (01-07-2024)» – brugeren kan
  altså ikke rydde advarslen på nogen lovlig måde.
  **Årsagen:** `computeTafCombinedExtraMaxDate` og `resolveTafCutoffDates` lader klagen ophæve de to
  EET-afskæringer og ikke differencekravets. Rækken `taf.ophoerSkyldes` (`eoRowTaftRows.ts:134-137` og
  `:161-164`) har kopieret klage-betingelsen over på differencekravet: `!context.verserendeKlageEet &&
  differencekravMinus1 === lastTafKravDato`. Med klagen falder rækken derfor igennem til «Der er ikke
  rejst TAF-krav for hele EO-perioden» og status `warning`.
  BB-222's rettelse lukkede den skjulte udgave af præcis dette (et efterladt, skjult «Ja» gjorde
  `taf.ophoerSkyldes` til en advarsel); med et synligt, rigtigt «Ja» sker det stadig.
- **Det er uhensigtsmæssigt fordi:** Advarslen påstår, at kravet er ufuldstændigt, i en sag hvor
  programmet selv – i papiret – siger, at retten er ophørt. Den kan ikke ryddes, og den eneste
  handling, den inviterer til, er at forlænge perioden ud over en afskæring, programmet derefter
  afviser.
- **Bedre ville være:** Lad `taf.ophoerSkyldes` læse differencekravet uden klage-betingelsen – præcis som
  valideringen gør. Rækken skal så sige «Differencekrav opgjort (01-07-2024)», og advarslen forsvinder.
  Bedst: lad ophørsrækken hente sine afskæringsdatoer fra `resolveTafCutoffDates`, så de to svar ikke kan
  drifte igen.
- **Andre steder det kan gælde:** `eoInspektionSammentaelling.ts:79-86` og `eoInspektionKontrolModel.ts:692`
  læser også klagen ved siden af afskæringerne (12m). Se M-34's prøve.

**Tilbagemelding**
Enig

**Gennemført (agent, 2026-09-24):** rækken «TAF-ophør skyldes» henter nu sine afskæringsdatoer fra
`resolveTafCutoffDates` – samme opslag som rød-celle-valideringen og motorens clamping – så de to svar ikke kan
drifte igen. Klagen ophæver dermed kun EET-afskæringerne; i sagen ovenfor siger rækken «Differencekrav opgjort
(01-07-2024)», og advarslen er væk. Test: `eoRowTafDifferencekravIndependent.test.ts` (endelig afgørelse både
før og efter differencekravet, påklaget). Kandidaterne i 12m (`eoInspektionSammentaelling.ts`,
`eoInspektionKontrolModel.ts`) er ikke rørt; de hører i 12m.

### BB-239 – Én klagetoggle for to EET-afgørelser, placeret under «Øvrigt»

- **Type:** Fornuft
- **Rækkevidde:** Lokal (placeringsspørgsmålet er det, udvikleren bad om at få undersøgt ved BB-233)
- **Prioritet:** **Høj**
- **Beslutning:** Afventer udvikleren (UI/UX og beregning)
- **Sådan fremprovokeres det:**
  1. Skadedato `01-06-2010` (før 16. juni 2011). TAF-periode `01-01-2024` – `31-12-2024`.
  2. Midlertidig EET-afgørelse Ja, dato `01-03-2023`. Endelig EET-afgørelse Ja, dato `01-09-2024`.
  3. Klagen over den ENDELIGE afgørelse registreres: slå «Verserende klagesag over EET-afgørelse?» til.
  4. Hent opgørelsen.
- **Det sker:** Der er kun én klagetoggle, og den står ikke ved nogen af de to afgørelser, men under
  mellemoverskriften **«Øvrigt»** sammen med differencekravsdatoen – mens ménklagen står under «Varige
  mén» lige under sin afgørelse. Togglen dukker op nederst i sektionen, 340 px under den toggle, der
  udløste den (målt: midlertidig-togglen `y = 413`, klagetogglen `y = 755`), og dens tekst siger ikke,
  hvilken af to afgørelser den gælder.
  Virkningen er, at klagen ophæver **begge** afskæringer. I sagen ovenfor skulle den upåklagede
  midlertidige afgørelse fra 2023 have standset TAF (skaden er fra før 2011); med togglen slået til er
  TAF-perioden 2024 lovlig, og dokumentet opgør **«Beregnet krav 452.037,00 kr.»**. Dokumentets Status
  nævner kun den endelige afgørelse – **«Der er den 1. september 2024 truffet endelig
  erhvervsevnetabsafgørelse. Afgørelsen er påklaget.»** – og den midlertidige afgørelse, der ville have
  bragt retten til ophør, står ingen steder i papiret. Uden togglen er begge TAF-celler røde, og
  download er spærret.
  **Svaret følger dertil med fra én afgørelse til en anden.** Slå den midlertidige afgørelse til, sæt
  klagen, slå den midlertidige fra og den endelige til: klagetogglen dukker op igen – **allerede slået
  til** (målt) – nu som et svar om en afgørelse, brugeren aldrig har sagt er påklaget.
- **Det er uhensigtsmæssigt fordi:** Klagen er en oplysning om ÉN afgørelse, men programmet stiller
  spørgsmålet én gang for to og anvender svaret på begge. Brugeren kan ikke sige «den endelige er
  påklaget, den midlertidige er ikke», og papiret skjuler den afgørelse, der ville have ændret beløbet.
  Det er samme slags adskillelse, udvikleren ved BB-233 kaldte en alvorlig fejl: et klageforhold om EET,
  der ikke står sammen med de øvrige felter om EET.
- **Bedre ville være:** En klagetoggle pr. afgørelse, placeret under afgørelsens egen dato – ordret som
  ménklagen: «Verserende klagesag over den midlertidige afgørelse?» under «Midlertidigt
  erhvervsevnetab» og «Verserende klagesag over den endelige afgørelse?» under «Endeligt
  erhvervsevnetab». Hver klage ophæver kun sin egen afskæring, og dokumentet trykker «Afgørelsen er
  påklaget.» ved den afgørelse, det gælder. «Øvrigt» står så tilbage med differencekravsdatoen.
  **To beslutninger ligger i forslaget, og de kan træffes hver for sig:** (a) placeringen – kan flyttes
  uden at røre beregningen; (b) opdelingen i to toggles – kræver en regel for, hvordan en eksisterende
  gemt klage (`verserendeKlageEet = 'Ja'`) indlæses. Da en ældre `.eo`-fil ikke ved, hvilken afgørelse
  den gjaldt, er det en persistensgate efter CLAUDE.md; det enkleste bagudkompatible valg er at lade et
  gemt «Ja» blive til «Ja» på begge (samme virkning som i dag).
- **Andre steder det kan gælde:** Klageforbeholdet i TAF-afsnittet (BB-233's rettelse) trykkes pr. sag, ikke
  pr. afgørelse, og skal følge med en opdeling.

**Tilbagemelding**
Jeg afviser dit fund. En verserende klagesag vil principielt kunne omgøre alle konsekvenser af tidligere afgørelser, så når der er klaget over EET, er alt EET-relateret oppe til fuld prøvelse. Derfor er det afgørende ikke, hvilken EET-afgørelse, der er klaget over, men alene om der er en verserende klagesag over EET.

**Opfølgning (agent, 2026-09-24):** afvisningen af opdelingen er fulgt – én klage, der gælder alt EET. Fundets
selvstændige del (a), placeringen under «Øvrigt», og følgespørgsmålet om, at papiret kun nævner én af to
EET-afgørelser, blev forelagt igen. **Udviklerens svar:** klagetogglen bliver under «Øvrigt», og TAF-afsnittet
trykker fortsat kun én EET-linje som i dag. **Lukket uden ændring.**

### BB-240 – Advarslen om manglende midlertidige EET-ydelser tier netop dér, hvor ydelsen skal fradrages

- **Type:** Fejl
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-34--en-regel-genbruger-en-nabo-regels-prædikat--og-arver-dens-undtagelser`
- **Prioritet:** **Høj**
- **Beslutning:** Agent afgør – advarslens ordlyd er godkendt og uændret; det er dens udløser, der læser
  det forkerte prædikat. Fradragsreglen er dokumenteret som ubetinget («ingen 2011-grænse»,
  `tabt-arbejdsfortjeneste.md` §TAF-indtægter).
- **Sådan fremprovokeres det:**
  1. Skadedato `01-06-2018`. TAF-periode `01-01-2024` – `31-12-2024`, ingen offentlige ydelser.
  2. «Truffet afgørelse om midlertidigt erhvervsevnetab» Ja, dato `01-03-2023`.
  3. Gå til Beregning og hent opgørelsen.
- **Det sker:** Ingen advarsel. Dokumentet skriver **«Der er den 1. marts 2023 truffet midlertidig
  erhvervsevnetabsafgørelse.»**, derefter «Indtægter i erstatningsperioden / **Ingen**» og «Beregnet krav
  **360.000,00 kr.**» – altså fuld TAF for 2024 uden fradrag for den løbende ydelse, afgørelsen udløser.
  Advarslen «Der er angivet en midlertidig EET-afgørelse men ikke indtastet ydelser» findes og har link
  til Offentlige ydelser; målt vises den **kun** med skadedato `01-06-2010` OG klagen slået til.
  **Årsagen:** `buildEoMidlertidigtEetKonsistensRows` (`eoRowIndkomstRows.ts:55`) finder afgørelsens dato
  med `resolveMidlertidigEetDatoHvisAktiv` – funktionen, der afgør om afgørelsen *afskærer TAF*, og som
  derfor returnerer `undefined` for alle skader fra 16. juni 2011. For en skade før 2011 afskærer
  afgørelsen TAF, så perioden slutter før datoen, og advarslens egen prøve (`lastTafKravDato <
  dato → return []`) tier også. Tilbage er kun hjørnet «skade før 2011 med verserende klage».
- **Det er uhensigtsmæssigt fordi:** Efter 2011 løber TAF videre efter en midlertidig afgørelse, og den
  løbende ydelse skal fradrages. Glemmer brugeren at taste den, er kravet for højt – i målingen med hele
  ydelsesbeløbet – og det eneste værn, programmet har bygget, er slukket i netop det tilfælde.
  Papiret nævner selv afgørelsen, så modparten vil se det, før brugeren gør.
- **Bedre ville være:** Lad advarslen finde datoen direkte: `midlertidigEETVirkningsdato ??
  midlertidigEETAfgoerelseDato`, når afgørelsen er «Ja» – uden 2011-grænsen og uden
  klage-betingelsen. Resten af dens prøve (TAF efter datoen, ingen ydelser) står uændret.
- **Andre steder det kan gælde:** Advarslen kigger kun på `offentligeYdelserRows`. Er «midlertidigt EET
  hentet fra EET-siden» slået til (12k), kan den fyre, selv om ydelsen er med – efterprøves i 12k.
  Øvrige kaldssteder af `resolveMidlertidigEetDatoHvisAktiv` (`eoRowTaftRows.ts`,
  `eoPeriodeBlockingContext.ts`, `useEoOplysningerViewModel.ts`) handler alle om afskæring og er i orden.

**Tilbagemelding**
Jeg anerkender delvist fundet, men mener at løsningen er for vidtrækkende. Der vil kunne opstå situationer, hvor der på et tidspunkt er truffet afgørelse om midlertidigt EET, men hvor retten senere er bortfaldet. Da skal den tidligere afgørelse fortsat nævnes, men det må i den situation ikke kunne blive en blokerende fejl, at der ikke (længere) er angivet midlertidigt EET som offentlig ydelse. Jeg er dog enig i, at der bør være et systematisk mønster til at give en ikke-blokerende advarsel i sådanne situationer. Gennemtænk gerne en god, velstruktureret løsning, der også tager højde for eventuelle andre lignende og/eller afledte forhold.

**Gennemført (agent, 2026-09-24) – ét mønster for afgørelse og ydelse:** en truffet afgørelse er en
*oplysning*, som altid trykkes og aldrig blokerer; den ydelse, afgørelsen normalt udløser, er en *forventning*,
programmet kun kan påpege. Uoverensstemmelsen er derfor altid en ikke-blokerende advarsel – i begge retninger –
og reglen er skrevet ind i koden og i `tabt-arbejdsfortjeneste.md` §TAF-indtægter, så den ikke senere gøres
blokerende. Konkret:
- **Oplysning og anvendelse er skilt ad** (M-34): `resolveMidlertidigEetDato` giver afgørelsens dato uden
  2011-grænse og klage; `resolveMidlertidigEetDatoHvisAktiv` (afskæringen) bygger ovenpå. Advarslen læser nu
  oplysningen, så den virker for skader fra 16. juni 2011 – i sagen ovenfor vises «Der er angivet en midlertidig
  EET-afgørelse men ikke indtastet ydelser». For skader før 2011 afskærer afgørelsen selv TAF; der advares kun,
  hvis TAF alligevel løber efter datoen (verserende klage). Ordlyden er uændret.
- **Midlertidigt EET indsat fra Erhvervsevnetab-siden** tæller som angivet (12k's kandidat) – før advarede
  reglen, selv om ydelsen var med.
- **Den omvendte advarsel** («… indtastede midlertidige EET-ydelser, men ikke angivet en afgørelse») er samlet i
  samme funktion og ser nu også den importerede ydelse.
- **En gemt ydelsestype i label-form** («Midlertidigt EET» frem for nøglen) genkendes gennem `resolveYdelsestype`,
  som resten af programmet.
- **Bevidst ikke udvidet:** endelig EET har ingen tilsvarende ydelsestype at fradrage, og programmet kender ingen
  regel for det; der er ikke opfundet en.
Test: `eoRowMidlertidigtEetKonsistensIndependent.test.ts`.

### BB-241 – En ménafgørelse uden dato forsvinder af papiret – med sin klage

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-13--nul-er-en-oplysning-ikke-et-fravær` (BB-122's form: dokumentet
  udelader en oplysning, skærmen har)
- **Prioritet:** Mellem
- **Beslutning:** Agent afgør – konvergens mod BF-054, som udvikleren har afgjort for EET-afgørelserne.
- **Sådan fremprovokeres det:**
  1. Svie/smerte-periode `01-01-2024` – `31-12-2024`. «Truffet afgørelse om varige mén» Nej. Hent.
  2. Slå den til uden at taste en dato. Hent igen. Slå derefter «Verserende klagesag over ménafgørelse?»
     til og hent en tredje gang.
- **Det sker:** Første dokument: «Der er den 1. februar 2025 ikke truffet afgørelse om varige mén.» Andet
  og tredje: **ingen linje om varige mén overhovedet** – heller ikke «Afgørelsen er påklaget.» Skærmen
  viser den gule «Dato for ménafgørelse er ikke angivet» (BF-044), og download er aktiv. Svie/smerte
  opgøres uden afskæring (366 sygedage).
  For EET gør programmet det modsatte: en afgørelse uden dato trykkes som «Der er truffet endelig
  afgørelse om erhvervsevnetab med 15 % eller derover.», og koden begrunder det med, at dokumentet
  «ellers påstår det modsatte» (`eoPresentationSectionBuilders.ts:313-317`, BF-054). Ménlinjen fik
  ikke samme behandling (`:118`: `varigeMenAfgorelse === 'Ja' && menDato`).
- **Det er uhensigtsmæssigt fordi:** Brugeren har svaret Ja og har slået klagen til; papiret siger intet om
  nogen af delene. Modparten læser et dokument, der hverken nævner afgørelsen eller klagen – og da
  svie/smerte opgøres uden afskæring, er det netop klagen, der forklarer beløbet.
- **Bedre ville være:** Samme form som BF-054: «Der er truffet afgørelse om varige mén.» og, ved klage,
  «Afgørelsen er påklaget.» Advarslen på skærmen står uændret.
- **Andre steder det kan gælde:** Ingen – EET-linjerne har rettelsen, differencekravet har ingen «Ja uden
  dato»-tilstand.

**Tilbagemelding**
Enig. Og overvej desuden om ikke der bør gives ikke-blokerende advarsler om manglende dato, som vises i boksen med fejl og advarsler i begge tilfælde, når der er indtastet en afgørelse, men uden dato.

**Gennemført (agent, 2026-09-24):** en ménafgørelse uden dato trykkes «Der er truffet afgørelse om varige mén.»,
ved klage efterfulgt af «Afgørelsen er påklaget.» – samme form som EET. **Om de manglende datoer:** de
ikke-blokerende advarsler findes allerede i «Fejl og advarsler» for alle tre afgørelser («Dato for første
ménafgørelse er ikke angivet» og «Afgørelses- eller virkningsdato for midlertidig/endelig EET-afgørelse er ikke
angivet»), uden rød ring og uden at spærre download (`eoRowAesRows.missingDateWarnings.test.ts`). Intet at
tilføje. Test: `eoPdfModel.test.ts` («trykker en ménafgørelse uden dato …»).

### BB-242 – En afgørelse dateret efter opgørelsen tages imod uden bemærkning

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Mellem
- **Beslutning:** Afventer udvikleren (ny advarsel)
- **Sådan fremprovokeres det:** «Opgørelse lavet den» `01-02-2025`. «Dato for første ménafgørelse»
  `01-06-2025`. Hent opgørelsen.
- **Det sker:** Feltet er neutralt (grænsen er dags dato), boksen er tavs, og papiret – dateret «1. februar
  2025» øverst – skriver **«Der er den 1. juni 2025 truffet afgørelse om varige mén.»** Samme grænse
  (`get max() { return getToday(); }`) gælder de to EET-afgørelsesdatoer og differencekravsdatoen
  (kodeverificeret, samme `skadedatoBoundedSpec`).
  Programmet behandler selv opgørelsens dato som status-datoen: uden afgørelse skriver det «Der er den
  1. februar 2025 **ikke** truffet afgørelse om varige mén.» En afgørelse efter den dato er dermed en
  begivenhed, dokumentet ikke kan kende.
- **Det er uhensigtsmæssigt fordi:** Den sandsynlige årsag er en tastefejl i året eller en «Opgørelse lavet
  den», der ikke er rettet til, da sagen blev genoptaget. Begge dele ender i et papir, hvor status-linjen
  ligger efter dokumentets egen dato, og programmet kender begge datoer.
- **Bedre ville være:** En ikke-blokerende gul ring på afgørelsesdatoen og en linje i «Fejl og
  advarsler», når den ligger efter «Opgørelse lavet den»: «Afgørelsen er dateret efter opgørelsens dato
  (01-02-2025)». Gælder de tre afgørelsesdatoer og differencekravsdatoen – ikke virkningsdatoerne, som
  lovligt kan ligge frem i tid.
- **Andre steder det kan gælde:** «Evt. dato for forlig» (12a) har samme grænse og samme logik.

**Tilbagemelding**
Jeg afviser fundet. Afgørelsen er en relevant orientering at give til den person, der skal læse opgørelsen - også selvom den ikke har nogen egentlig betydning for selve beregningen eller resultatet. Det vil være forkert at opgørelsen angiver, at der ikke er truffet nogen afgørelser, når der faktisk er en afgørelse, som blot ligger efter erstatningsperioden.

**Opfølgning (agent, 2026-09-24):** svaret ramte et andet forslag end fundets – forslaget var ikke at fjerne
afgørelsen fra papiret, og fundet handler om en dato efter «Opgørelse lavet den», ikke efter
erstatningsperioden. Forelagt igen. **Udviklerens svar: ja, gul advarsel.**
**Gennemført (agent, 2026-09-24):** mén-, midlertidig og endelig afgørelsesdato får en gul ring og en linje i
«Fejl og advarsler» – «Afgørelsen er dateret efter opgørelsens dato (01-02-2025)» – når de ligger efter
«Opgørelse lavet den»; differencekravsdatoen får «Differencekravet er opgjort pr. en dato efter opgørelsens dato
(01-02-2025)». Virkningsdatoerne er udenfor. Papir, beløb og download er uændrede. `DateField` har fået
`warning`-proppen, som `TextField` og cellerne havde. Reglen bor i `aesDatoEfterOpgoerelse.ts` og læses af både
feltet og rækken. Test: `aesDatoEfterOpgoerelse.test.ts`. «Evt. dato for forlig» (12a) er ikke omfattet.

### BB-243 – Afgørelsesdatoerne hedder noget andet i «Fejl og advarsler» end på skærmen

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-02--beskeder-med-hardkodede-feltnavne` (BB-211/BB-224/BB-237's form)
- **Prioritet:** Lav
- **Beslutning:** Agent afgør (ren navnedublering, samme mekanik som BB-224's godkendte rettelse)
- **Sådan fremprovokeres det:** Tast en rød dato (`01-01-2017`) i hvert af sektionens datofelter efter tur
  og læs boksens linje og feltets tilgængelige navn.
- **Det sker:**

  | Synligt på skærmen | «Fejl og advarsler» | Oplæst navn |
  |---|---|---|
  | «Dato for første ménafgørelse» | «**Mén-afgørelsesdato:** Datoen kan ikke …» / «Dato for ménafgørelse er ikke angivet» | `Mén-afgørelsesdato` |
  | «Dato for første midlertidige erhvervsevnetabsafgørelse» | «Dato for midlertidig EET-afgørelse: …» | `Midlertidigt EET-afgørelsesdato` |
  | «Virkningsdato (hvis forskellig fra afgørelsesdatoen)» (midlertidig) | «Virkningsdato for midlertidig EET-afgørelse: …» | `Midlertidigt EET-virkningsdato` |
  | «Dato for endelig erhvervsevnetabsafgørelse» | «**Dato for endelig EET-afgørelse:** Datoen kan ikke …» | `Endeligt EET-afgørelsesdato` |
  | «Virkningsdato (hvis forskellig fra afgørelsesdatoen)» (endelig) | «**Virkningsdato for endelig EET-afgørelse:** …» | `Endeligt EET-virkningsdato` |
  | «Evt. differencekrav opgjort per» | «Dato for differencekrav: …» | `Differencekravsdato` |

  Fed = målt; resten er kodeverificeret i `buildEoAesRows` og descriptorerne. De fire toggles har korrekte navne, fordi de tegnes af `LabeledControlRow`.
- **Det er uhensigtsmæssigt fordi:** Boksen er stedet, brugeren læser fejlen, og den navngiver et felt, der
  ikke står på skærmen; skærmlæseren oplæser et tredje navn. Linket fører dog til det rigtige felt (målt
  ét blink på hhv. mén- og endelig-datoen), så skaden er begrænset.
- **Bedre ville være:** Descriptorernes `label` = den synlige tekst, og rækkebyggerens etiketter i
  `buildEoAesRows` læser samme `label`. For de to «Virkningsdato»-rækker, hvis synlige tekst er ens, er
  det sammensatte navn det rigtige (BB-211's regel): «Virkningsdato for den midlertidige afgørelse».
- **Andre steder det kan gælde:** Ingen nye; mekanikken er BB-211's, og kravvalg/rækker på de øvrige
  sektioner er rettet.

**Tilbagemelding**
Enig

**Gennemført (agent, 2026-09-24):** de seks descriptorer bærer nu skærmens tekst – «Dato for første
ménafgørelse», «Dato for første midlertidige erhvervsevnetabsafgørelse», «Virkningsdato for den midlertidige
afgørelse», «Dato for endelig erhvervsevnetabsafgørelse», «Virkningsdato for den endelige afgørelse» og «Evt.
differencekrav opgjort per» – og `buildEoAesRows` læser samme `label`. Manglende ménafgørelsesdato hedder nu
«Dato for første ménafgørelse er ikke angivet». Test: `aesDatoEfterOpgoerelse.test.ts`.

### BB-244 – Afskæringsbeskeden står to gange i samme linje, når hele perioden ligger efter afgørelsen

- **Type:** Edge case
- **Rækkevidde:** Lokal
- **Prioritet:** Lav
- **Beslutning:** Agent afgør
- **Sådan fremprovokeres det:** Skadedato `01-06-2010`. Midlertidig EET-afgørelse `01-03-2023`. TAF-periode
  `01-01-2024` – `31-12-2024`. Gå til Beregning.
- **Det sker:** Begge celler er røde med hver sin korrekte tooltip. Boksen viser én linje med samme sætning
  to gange: **«Der er angivet tabt arbejdsfortjeneste efter afgørelse om midlertidigt erhvervsevnetab
  (01-03-2023); Der er angivet tabt arbejdsfortjeneste efter afgørelse om midlertidigt erhvervsevnetab
  (01-03-2023)»**. `evaluateOne` i `tafPeriodeValidation.ts:180-188` samler fra- og til-cellens
  afskæringsbesked med `join('; ')` uden at fjerne dubletter.
- **Det er uhensigtsmæssigt fordi:** Gentagelsen ligner to fejl og fylder boksen; det, brugeren skal vide –
  at hele perioden ligger efter afgørelsen – står ingen steder.
- **Bedre ville være:** Fjern dubletter før sammenføjningen. Ligger begge datoer efter afskæringen, kan
  linjen sige det: «Hele perioden ligger efter afgørelsen om midlertidigt erhvervsevnetab (01-03-2023)».
- **Andre steder det kan gælde:** Samme `join('; ')` på ferieperioderne (`ferieperiodeValidation.ts`, 12e)
  og svie/smerte-perioderne (`svieSmertePeriodeValidation.ts`, 12b) – uafprøvet.

**Tilbagemelding**
Enig

**Gennemført (agent, 2026-09-24):** periodens linje nævner hver afskæring én gang, og ligger også fra-datoen
efter den, siger linjen «Hele perioden ligger efter afgørelsen om midlertidigt erhvervsevnetab (01-03-2023)».
Cellerne beholder hver sin besked. Svie/smerte-perioderne følger samme form («Hele perioden ligger efter datoen
for ménafgørelsen (…)»); ferieperioderne havde ingen afskæringsbesked, men deres to intervalbeskeder
dublet-fjernes nu også. Golden master-kataloget (`eoBlockingGateCatalog.test.ts`) viste selv dubletten og er
opdateret. Test: `tafPeriodeCutoffMessage.test.ts`.

### BB-245 – «Differencekrav opgjort **per**» bliver til «opgjort **den**» i papiret

- **Type:** Fornuft
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-11--programmets-egne-påstande-om-sig-selv` (SAGEN-formen: en linje
  om sagen, hvor programmet kun kender sin egen afgrænsning)
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren (ordlyd i dokumentet)
- **Sådan fremprovokeres det:** «Evt. differencekrav opgjort per» `01-07-2024`, TAF til `30-06-2024`.
  Hent opgørelsen.
- **Det sker:** Feltet spørger om den dato, differencekravet er opgjort **pr.** – beregningsdatoen, som
  også er den dato, TAF standser dagen før. Papiret skriver **«Der er opgjort differencekrav i sagen den
  1. juli 2024.»**, og TAF-cellens besked «… efter differencekrav er opgjort (01-07-2024)». Begge læses
  som den dag, kravet blev *udregnet*. Et differencekrav opgjort 15. september pr. 1. juli står dermed
  som opgjort 1. juli.
- **Det er uhensigtsmæssigt fordi:** Beregningsdato og udregningsdato er to forskellige fakta i en sag,
  og modparten kan slå begge op. Papiret skal sige det, feltet spurgte om.
- **Bedre ville være:** «Der er opgjort differencekrav i sagen pr. 1. juli 2024.» og i cellen «… efter den
  dato, differencekravet er opgjort pr. (01-07-2024)».
- **Andre steder det kan gælde:** Erhvervsevnetab → Differencekrav bruger «beregningsdato» om samme dato
  (flade 11e) – et fælles ord på tværs af de to flader kunne afgøres samtidig.

**Tilbagemelding**
Enig

**Gennemført (agent, 2026-09-24):** papiret skriver «Der er opgjort differencekrav i sagen pr. 1. juli 2024.», og
TAF-cellens besked er «Der er angivet tabt arbejdsfortjeneste efter den dato, differencekravet er opgjort pr.
(01-07-2024)». Feltets etiket «opgjort per» og Erhvervsevnetab-fladens «beregningsdato» er ikke rørt.

### BB-246 – Et differencekrav uden en EET-afgørelse giver et papir, der modsiger sig selv

- **Type:** Edge case
- **Rækkevidde:** Mønster → `TVAERGAAENDE.md#m-05--ingen-rimelighedskontrol-af-lovlige-men-usandsynlige-værdier`
- **Prioritet:** Lav
- **Beslutning:** Afventer udvikleren (forudsætter en faglig afklaring, se forslaget)
- **Sådan fremprovokeres det:** Begge EET-toggles Nej. «Evt. differencekrav opgjort per» `01-07-2024`. TAF
  til `30-06-2024`. Hent opgørelsen.
- **Det sker:** Ingen advarsel. Papirets Status skriver i to linjer i træk: **«Der er opgjort differencekrav i
  sagen den 1. juli 2024. Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.»** og
  **«Der er den 1. februar 2025 ikke truffet afgørelse om erhvervsevnetab med 15 % eller derover.»**
- **Det er uhensigtsmæssigt fordi:** Et differencekrav er forskellen mellem erstatningsansvarslovens krav og
  arbejdsskadesikringslovens ydelser for erhvervsevnetab; programmets egen differencekravsflade (11e)
  opstår kun, når der er krav efter begge love. Står de to linjer side om side, har brugeren sandsynligvis
  glemt at slå en afgørelse til – og papiret siger begge dele til modparten.
- **Bedre ville være:** Hvis udvikleren bekræfter, at et differencekrav forudsætter en EET-afgørelse på
  15 % eller derover: en ikke-blokerende advarsel på differencekravsdatoen, når begge EET-toggles er Nej –
  «Der er angivet differencekrav, men ingen afgørelse om erhvervsevnetab». Findes der sager, hvor
  kombinationen er rigtig, er fundet et nej.
- **Andre steder det kan gælde:** Ingen.

**Tilbagemelding**
Jeg afviser fundet. Det er en sproglig detalje, som muligvis er lidt ulogisk, men betegnelsen 'Differencekrav' anvendes også om opgørelse af EET efter EAL, selvom der ikke er truffet en endelige EET-afgørelse efter ASL, som der beregnes differencen i forhold til.

**Lukket uden ændring (afvist af udvikleren):** betegnelsen «differencekrav» bruges også om en opgørelse efter EAL
uden en endelig ASL-afgørelse; kombinationen er derfor lovlig.

## Overvejet uden fund

- **Afskæringerne rammer de rigtige celler og navngiver deres kilde.** Ménafgørelse `01-10-2024` →
  svie/smerte-til-cellen rød med «Der er angivet svie/smerte efter datoen for en ménafgørelse
  (01-10-2024)»; endelig EET `01-03-2024` → TAF-til rød med «… efter afgørelse om endeligt
  erhvervsevnetab (01-03-2024)»; begge spærrer download med link. Afskæringen er dagen før afgørelsen
  (`30-06-2024` er lovlig ved differencekrav `01-07-2024`).
- **Afgørelsesfeltet selv markeres ikke, når det afskærer en periode – og det er rigtigt.** M-07's regel
  gælder to felter, der afgrænser hinanden; her er afgørelsesdatoen en kendsgerning fra et papir, og det
  er kravperioden, der skal rettes. Beskeden i cellen citerer datoen, så en tastefejl i afgørelsen kan
  ses dér.
- **Klagerne ophæver de rigtige afskæringer.** Ménklage → svie/smerte løber videre, papiret skriver
  «Afgørelsen er påklaget.»; EET-klage → EET-afskæringerne ophæves, differencekravets består (i
  valideringen; ophørsrækken er BB-238).
- **Virkningsdatoen har forrang for afgørelsesdatoen**, både som afskæring og i papiret («med virkning fra
  1. juni 2025»). Etiketten «(hvis forskellig fra afgørelsesdatoen)» siger reglen; M-28's rækker
  «Beregnet startdato for … EET» (`status: 'ok'`) er derfor et negativt træf efter trin 3.
- **Virkningsdato efter afgørelsesdatoen og frem i tid tages imod** (grænse 31-12 året efter). En
  virkningsdato kan lovligt ligge efter afgørelsen; ingen parregel er forsvarlig.
- **Midlertidig afgørelse efter en endelig** (endelig `01-03-2023`, midlertidig `01-10-2024`) giver ingen
  advarsel. BB-178's afgørelse fastslog, at en senere midlertidig lovligt kan følge en endelig; EO's
  afskæring følger den endelige, og det er ikke vurderet her.
- **Manglende ménafgørelsesdato er kun en advarsel** (BF-044) og lader svie/smerte løbe uden afskæring –
  afgjort af udvikleren, ikke registreret igen. Det, der er nyt, er papirets tavshed (BB-241).
- **Rød eller umulig dato** (`01-01-2017`, `31-02-2024`) giver én linje i boksen med feltets egen tekst og
  spærrer download; afskæringen slukkes (M-27), men spærringen gør det synligt. Ingen «mangler»-linje oveni
  (M-19 bestået her).
- **Kun den tidligste afskæringskilde trykkes i TAF-afsnittet** – dokumenteret i
  `tabt-arbejdsfortjeneste.md` §PDF. Efter 2011 er den midlertidige afgørelse ingen afskæringskilde og
  udgår, når der også er en endelig (målt). I sig selv i orden; det er klagens sammenblanding, der gør
  udeladelsen skadelig (BB-239).
- **Differencekravet trykkes kun, når det faktisk afskærer TAF**, mens EET-afgørelser trykkes også
  informativt. Et differencekrav efter TAF-periodens slutning er uden betydning for kravet; forskellen er
  forsvarlig.
- **Undo/redo efter en toggle:** «Ja» → dato `01-10-2024` → «Nej» → Ctrl+Z gendanner toggle og dato i ét
  trin; Ctrl+Y fjerner begge igen. En skjult gyldig dato bevares og kommer frem ved «Ja»; en skjult RØD
  dato ryddes (`form-contract.md` §7 pkt. 5) – begge målt.
- **Boksens links markerer det rigtige felt:** «Dato for ménafgørelse er ikke angivet» → ét blink på
  ménfeltet; «Afgørelses- eller virkningsdato for endelig EET-afgørelse er ikke angivet» → ét blink på
  den endelige afgørelsesdato.
- **Dags dato-grænsen navngiver sig selv** («Datoen er efter dags dato (24-09-2026)» på
  differencekravsdatoen) – BB-208's rettelse holder her.
- **M-09 bestået:** ingen vandret scroll ved 1244×620 (`scrollWidth = clientWidth = 1244`).
- **M-32 bestået:** alle felter bag et valg bærer `relevance` (mén-dato og -klage, de fire EET-datoer,
  EET-klagen); differencekravsdatoen er altid synlig og har ingen.
- **Konsollen var tavs:** 0 fejl, 0 advarsler, 0 page-errors i samtlige elleve kørsler.

## Henvisninger til andre bidder

- **12e:** «Der er ikke rejst TAF-krav for hele EO-perioden» er rækken `taf.ophoerSkyldes`; BB-238 retter
  dens klage-gren, men rækkens øvrige tilstande hører i 12e.
- **12k:** BB-240's advarsel bor i offentlige ydelsers status og ser ikke «midlertidigt EET hentet fra
  EET-siden».
- **12m:** kontrolmodellerne læser klagen ved siden af afskæringerne og skal holdes op mod BB-238's rettelse.

## Dækningshuller

- Kun Chrome, lyst tema; kun PDF-kanalen er læst.
- Erhvervssygdom (anmeldelsesdato minus 5 år som nedre grænse, og om 2011-grænsen skal læses på
  anmeldelsesdatoen) er ikke afprøvet; 2011-reglen læser feltet `skadedato` uanset skadestype.
- `Gem`/`Hent` er ikke afprøvet (filvælgeren kan ikke betjenes headless). Relevant for BB-239(b).
- Tastatur/Tab-rækkefølge gennem sektionen er ikke målt; den følger DOM-rækkefølgen, hvor EET-klagen
  kommer efter den endelige afgørelse.

## Åbne spørgsmål

Ingen. Alle ni fund er afgjort 2026-09-24: syv gennemført (BB-238, BB-240–BB-245), to afvist
(BB-239, BB-246) og BB-239's to opfølgende spørgsmål besvaret «som i dag».
