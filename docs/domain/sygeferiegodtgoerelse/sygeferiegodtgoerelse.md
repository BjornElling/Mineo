# Sygeferiegodtgørelse

Denne fil er det normative domænedokument for sygeferiegodtgørelse (`SFGG`) og samtidig statusdokument for den aktuelle implementation.

Formålet er todelt:
- at fastlægge og konsolidere den gældende forretningslogik, så implementationen kan holdes op imod et samlet facit
- at beskrive, hvad der aktuelt er implementeret, og hvor der fortsat er fejl, mangler eller afvigelser

---

## Del 1: Normativ forretningslogik

Dette afsnit er den gældende forretningslogik. Ved konflikt mellem dette afsnit og den aktuelle implementation er det dette afsnit, der er facit, medmindre andet udtrykkeligt står i statusafsnittet nederst.

### 1. Grundidé og beregningsobjekt

SFGG er udtryk for forskellen i feriepengeoptjening efter en skade.

Den overordnede beregningsidé er:
- at identificere feriepengeoptjeningen før skaden eller før det relevante sygefravær
- at identificere feriepengeoptjeningen i SFGG-perioden
- at opgøre differencen efter de særlige regler nedenfor

I denne sammenhæng bruges `feriepenge` som fællesbetegnelse for:
- feriegodtgørelse
- ferietillæg

Kun lønindkomst indgår i SFGG-beregningen.
Offentlige ydelser indgår aldrig.

Hvis der er flere ansættelsesforhold, beregnes SFGG fuldstændigt separat for hvert ansættelsesforhold.
Der må ikke ske sammenblanding mellem ansættelsesforholdene.

### 2. Referencesats

Der skal beregnes eller fastlægges en referencesats.
Referencesatsen er feriepenge pr. relevant dag.

Der findes tre hovedmodeller:
- ferielovens referencesats
- overenskomstbestemt referencesats
- manuelt angivet referencesats

#### 2.1. Ferielovens model

Udgangspunktet er en referenceperiode på 4 uger.

Brugeren angiver referenceperioden manuelt med:
- fra-dato
- til-dato

Normative regler:
- systemet må ikke kontrollere, om perioden er præcis 4 uger
- referenceperioden må gerne ligge efter skadesdatoen
- referenceperioden må ikke gå ind i eller overlappe den første TAF-periode
- forklaringstekst må ikke låse forståelsen til "inden skaden", men skal afspejle, at perioden er referenceperiode før sygefraværet

Referencesatsen beregnes som:

```text
referencesats = (ferieberettiget løn i referenceperioden x FP-sats) / relevante dage i referenceperioden
```

Kun den almindelige feriepengeprocent (`FP-sats`) indgår i referencesatsen.
Andre tillæg som fritvalg, SH/SO og Store Bededag indgår ikke i referencesatsen.

#### 2.2. Relevante dage i referenceperioden

Optællingen afhænger af, hvordan TAF beregnes:
- hvis TAF beregnes som arbejdsdage, bruges arbejdsdage
- hvis TAF beregnes som måneder, bruges kalenderdage

Ved arbejdsdagsmodellen reduceres optællingen med:
- SH-dage
- daterede feriedage
- fraværsdage uden løn

Ved månedsmodellen reduceres optællingen kun med:
- fraværsdage uden løn

Brugeren indtaster ikke SH-dage særskilt i SFGG-delen.
SH-dage skal komme fra den eksisterende centrale funktionalitet.

Brugeren indtaster ikke feriedage særskilt i SFGG-delen.
Feriedage skal komme fra de daterede ferieperioder, som allerede bruges centralt.

Ferieperioder behandles som fælles for alle ansættelsesforhold i SFGG-beregningen.

Feltet `Evt. ferie- og fraværsdage i perioden uden løn` følger derfor disse maksimumregler:
- ved arbejdsdagsmodellen: maksimalt de resterende arbejdsdage efter fradrag af SH-dage og daterede feriedage
- ved månedsmodellen: maksimalt periodens samlede kalenderdage

Hvis referenceperioden efter disse fradrag ikke indeholder nogen relevante dage, skal referenceperiodens datofelter markeres med fejl.

### 3. Overenskomster

Overenskomster kan fravige ferielovens SFGG-regler.

Når en overenskomst finder anvendelse, går dens regler forud for ferieloven i det omfang, overenskomsten faktisk fraviger.

Det afgørende triggerpunkt er, om ansættelsesforholdet er angivet som overenskomstdækket, og hvilken overenskomst der er valgt.

#### 3.1. Krav til overenskomstdata

Alle overenskomster skal have en eksplicit og konstant oplysning om, hvorvidt de fraviger ferielovens regler om SFGG.

Der skal være en eksplicit boolean:
- `true`, hvis overenskomsten fraviger ferielovens regler om SFGG
- `false`, hvis overenskomsten ikke fraviger ferielovens regler om SFGG

Dette må ikke udledes via en dynamisk formel.

Hvis en overenskomst mangler denne oplysning, er det en systemteknisk fejl.

Foreløbige domæneregler:
- KL-overenskomsten fraviger ikke ferielovens regler om SFGG
- læreroverenskomsten fraviger ikke ferielovens regler om SFGG
- fremtidige overenskomster koblet op på KL-overenskomsten behandles foreløbigt også som ikke-fravigende, indtil andet fastlægges

#### 3.2. To typer fravigelse

En overenskomst kan fravige på to kendte måder.

##### Type 1: Samme beregningsprincip, anden referenceperiode

Her gælder fortsat ferielovens beregningsprincip for referencesatsen.
Fravigelsen består alene i, at referenceperioden ikke er 4 uger.

Den alternative referenceperiode skal defineres konkret pr. overenskomst.
Den må ikke hardcodes som en generel regel.

##### Type 2: Direkte referencesats

Her bruges der ikke referenceperiode.
Overenskomsten angiver referencesatsen direkte.

Nogle overenskomster har én sats.
Andre har flere satser afhængigt af:
- faglært eller ufaglært
- København eller provinsen

I så fald skal brugeren vælge mellem præcis disse fire værdier:
- `Faglært-København`
- `Faglært-Provinsen`
- `Ufaglært-København`
- `Ufaglært-Provinsen`

#### 3.3. Arbejdsgiverbetalt sygeløn efter overenskomst

Der skal være en separat boolean på overenskomsten for, om der ikke er ret til SFGG, så længe arbejdsgiver betaler sygeløn.

Hvis denne boolean er `true`:
- skal programmet udlede sygelønsperioder fra lønindtastningerne på det konkrete ansættelsesforhold
- en lønperiode med indtastet løn skal behandles som en periode med arbejdsgiverbetalt sygeløn
- en lønperiode uden indtastet løn skal ikke behandles som arbejdsgiverbetalt sygeløn
- der må ikke beregnes SFGG i disse perioder

Hvis der er huller mellem sådanne perioder, skal der beregnes SFGG i hullerne, hvis hullerne indeholder relevante dage, som ikke allerede er undtaget.

### 4. Udvikling i satsen over tid

Referencesatsen kan ændre sig over tid i følgende tilfælde:

#### 4.1. Direkte overenskomstsats

Hvis referencesatsen fremgår direkte af overenskomsten:
- anvendes den relevante sats frem til den dato, hvor overenskomstdata angiver en forhøjelse
- fra denne dato anvendes den nye sats

#### 4.2. Overenskomstdækket ansættelsesforhold med ferielovsberegnet sats

Hvis ansættelsesforholdet er overenskomstdækket, men referencesatsen beregnes efter ferieloven:
- skal SFGG-satsen forhøjes på samme tidspunkt
- og med samme procentsats
- som TAF forhøjes efter overenskomsten

Dette gælder både:
- almindelig ferielovsmodel
- ferielovsmodel med alternativ referenceperiode efter overenskomsten

#### 4.3. Øvrige tilfælde

I øvrige tilfælde er referencesatsen konstant gennem hele beregningsforløbet.

### 5. Beregning af kravet

Selve SFGG-kravet beregnes i følgende trin:

```text
referencesats = (ferieberettiget løn i referenceperioden x FP-sats) / antal relevante dage i referenceperioden
```

Dernæst:

```text
(antal relevante dage i SFGG-perioden x referencesats)
- feriepenge af sygeløn i SFGG-perioden
- allerede betalt SFGG i perioden
= beregnet SFGG-krav
```

Feriepenge af sygeløn i SFGG-perioden skal beregnes automatisk som:

```text
ferieberettiget løn x FP-sats
```

Kun den almindelige feriepengeprocent indgår i dette fradrag.
Fritvalg, SH/SO og Store Bededag indgår ikke.

`Allerede betalt SFGG i perioden` er ét samlet manuelt indtastet beløb pr. ansættelsesforhold i den konkrete EO-periode.

Efter disse fradrag lægges arbejdsgivers pensionsbidrag til.
Pensionsprocenten følger ansættelsesforholdets almindelige pensionssats.

SFGG-perioden følger som udgangspunkt TAF-perioden, men kan afkortes af:
- første sygedag-reglen efter 1. januar 2015
- bortfald under arbejdsgiverbetalt sygeløn
- ansættelsesophør
- 4-månedersgrænsen ved skader før 1. januar 2015

### 6. Tidsmæssige regler

#### 6.1. Skader før 1. januar 2015

Hvis skadesdatoen er før `1. januar 2015`:
- beregnes SFGG fra første sygedag
- er retten tidsbegrænset til højst 4 måneder

Hver sygedag beregnes som:

```text
1 / x måned
```

hvor `x` er:
- antal hverdage i måneden, når TAF beregnes som arbejdsdage
- antal kalenderdage i måneden, når TAF beregnes som måneder

#### 6.2. Skader fra og med 1. januar 2015

Hvis skadesdatoen er fra og med `1. januar 2015`:
- beregnes SFGG først fra anden sygedag
- er retten tidsubegrænset

Hvis der er tale om første erstatningsopgørelse:
- skal den første TAF-dag udgå af SFGG-beregningen
- hvis der er flere adskilte TAF-perioder, er det kun den kronologisk første sygedag i hele forløbet, der udgår

Hvis der samtidig gælder bortfald under arbejdsgiverbetalt sygeløn:
- skal den første sygedag-regel anses for opfyldt af den første sygedag i hele TAF-forløbet, også hvis denne dag allerede ligger i en periode uden ret til SFGG på grund af arbejdsgiverbetalt sygeløn
- den første dag efter ophør af arbejdsgiverbetalt sygeløn må derfor ikke udgå som en ekstra "første sygedag"

Hvis der ikke er tale om første erstatningsopgørelse, beregnes SFGG på alle TAF-dage.

#### 6.3. Kobling til TAF-perioden

SFGG beregnes i samme periode som den indtastede TAF-periode.
Der må ikke være en særskilt SFGG-periodeindtastning.

#### 6.4. Ophør ved ansættelsesophør

Retten til SFGG ophører automatisk ved ansættelsesophør.

Dette ophør skal ske:
- uden fejlmeddelelse
- men med oplysning i PDF om dato og årsag

Ophørsdatoen er sidste dag med ret til SFGG.

Manglende lønindkomst i længere tid må aldrig i sig selv stoppe SFGG automatisk.
Den situation må højst give en advarsel om muligt stiltiende ophør.

### 7. Særlig 4-månederslogik før 2015

Når skaden er før `1. januar 2015`, skal der være en toggle med teksten:

`Er alle sygeperioder efter skaden indtastet som TAF-periode ovenfor?`

Default skal være `true`.

Hvis togglen er `false`, skal der vises en loose grid med samtlige sygeperioder siden skaden.

Beregningslogikken er:
- hvis togglen er `true`, bruges de indtastede TAF-perioder
- hvis togglen er `false`, bruges de særskilt indtastede sygeperioder

Der skal tælles unikke datoer.
Overlappende perioder må aldrig medføre dobbeltoptælling.

Optællingsmetoden afhænger af `TAF beregnes som`:
- ved arbejdsdage tælles rene hverdage uden fradrag for ferie og SH-dage
- ved måneder tælles kalenderdage uden fradrag for ferie og SH-dage

Resultatet skal være én konkret dato:
- den dato, hvor summen bliver `>= 4` måneder

Denne dato er sidste dag med ret til SFGG.

Hvis togglen står på `true`, og der ikke er indtastet nogen TAF-perioder, accepteres tomt resultat.
Det er ikke fejl eller advarsel, at TAF-perioderne ikke nødvendigvis dækker et sammenhængende sygdomsforløb.

### 8. UI-flow

#### 8.1. Første valg

Brugeren skal indledningsvist kun mødes af dropdownen:

`Sygeferiegodtgørelse beregnes ud fra`

Dropdownen skal have præcis disse fire valgmuligheder:
- `Overenskomst`
- `Manuelt angivet`
- `Ferieloven`
- `Ingen`

#### 8.2. Valg: Overenskomst

Hvis brugeren vælger `Overenskomst`, afhænger de efterfølgende felter af overenskomstens SFGG-regler.

Hvis overenskomsten ikke fraviger ferieloven:
- skal visningen svare til `Ferieloven`

Hvis overenskomsten kun fraviger ved anden referenceperiode:
- skal visningen svare til `Ferieloven`
- men forklaringsteksten skal oplyse den konkrete referenceperiode

Hvis overenskomsten bruger direkte referencesatser og er differentieret:
- skal der vises dropdown med de fire satsvalg

Hvis overenskomsten bruger direkte referencesatser uden differentiering:
- skal denne dropdown ikke vises

#### 8.3. Valg: Ferieloven

Hvis brugeren vælger `Ferieloven`, skal der vises:
- forklarende tekst om referenceperiode på 4 uger før sygefraværet
- linjen `Referenceperiode` med `Fra` og `Til`
- linjen `Evt. ferie- og fraværsdage i perioden uden løn` med integerfelt

For integerfeltet gælder:
- minimum = `0`
- maksimum = det samlede antal arbejdsdage i referenceperioden efter fradrag af ferie- og SH-dage

#### 8.4. Valg: Manuelt angivet

Hvis brugeren vælger `Manuelt angivet`, skal der vises:
- `Dagssats for sygeferiegodtgørelse (mandag-fredag)`
- `Beløbet er i henhold til`
- `Først sygeferiegodtgørelse efter ophør af sygeløn`

Togglens default er `nej`.
Hvis togglen sættes til `ja`, skal samme logik bruges som ved overenskomstbestemt bortfald under arbejdsgiverbetalt sygeløn.

#### 8.5. Valg: Ingen

Hvis brugeren vælger `Ingen`:
- beregnes der ikke SFGG
- genereres der ikke nogen SFGG-side i PDF

### 9. Output, PDF og advarsler

#### 9.1. Tabelvisning

SFGG-beregningen skal kunne vises:
- nederst på EODebug
- som særskilt side i erstatningsopgørelse-PDF'en, hvis brugeren har valgt bilaget på EOBeregningTab

Tabellen skal have kolonnerne:
- `Fra-dato`
- `Til-dato`
- `Sats`
- `Antal arbejdsdage` eller `Antal kalenderdage`
- `Feriepengekrav`

Der skal være en `I alt`-række, når tabellen indeholder mere end én datalinje.

`Feriepengekrav` er altid bruttokravet:

```text
sats x antal dage
```

Fradrag og pension hører til nettoopgørelsen efter tabellen og må ikke indbygges i tabellens `Feriepengekrav`.

Ved skader før `1. januar 2015` skal der altid vises en særskilt tabel for 4-månedersgrænsen.

#### 9.2. PDF-oplysninger

PDF'en skal kunne oplyse:
- at SFGG ophørte på en bestemt dato på grund af ansættelsesophør
- at SFGG ophørte på en bestemt dato, fordi 4-månedersgrænsen blev nået
- at bestemte perioder er undtaget på grund af arbejdsgiverbetalt sygeløn efter overenskomsten

Hvis både sygelønsperioder og senere ansættelsesophør er relevante, skal begge forklaringer vises i denne rækkefølge:
- først forklaring om ret først efter ophør af sygeløn
- derefter forklaring om ansættelsesophør

Teksten ved ansættelsesophør skal være:

`Retten til sygeferiegodtgørelse bortfaldt den dd-mm-åååå som følge af ansættelsesforholdets ophør.`

Ved skader før `1. januar 2015` skal forklaringsteksten over tabellen være:

`Da skaden er sket/anmeldt, afhængigt af om det er en arbejdsulykke eller erhvervssygdom, før 1. januar 2015, er retten til sygeferiegodtgørelse tidsbegrænset til 4 måneder.`

Ordvalget `sket` eller `anmeldt` skal styres deterministisk af skadestype.

#### 9.3. Advarsel om muligt stiltiende ophør

Hvis der fortsat beregnes SFGG for et ansættelsesforhold 6 måneder efter sidste registrerede lønindkomst, skal der vises én samlet advarsel pr. ansættelsesforhold.

Advarselsteksten skal være:

`Der beregnes fortsat sygeferiegodtgørelse mere end 6 måneder efter sidste registrerede lønindkomst.`

Ved valg af `Ingen` skal EODebug stadig vise én linje med den valgte værdi og ikke yderligere SFGG-indhold.

---

## Del 2: Implementeringsstatus

Dette afsnit beskriver status på den faktiske implementation pr. `28. marts 2026`.

Status er gennemgået mod den aktuelle kode i især:
- `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts`
- `src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx`
- `src/validators/erstatningsopgoerelseValidator.ts`
- `src/domain/erstatningsopgoerelse/sygeferiegodtgoerelse.ts`
- `src/domain/debug/eoDebugErstatningsopgoerelseModel.ts`
- `src/utils/pdf/erstatningsopgoerelsePdf.ts`
- relevante tests under `src/__tests__`

### Overordnet status

SFGG er implementeret ende til ende med:
- schema og persisted felter
- UI i EO-oplysninger
- validering
- domæneberegning
- debug-visning
- PDF-visning
- testdækning på centrale dele

Løsningen er dog ikke fuldt i overensstemmelse med hele den normative forretningslogik ovenfor.

### Implementeret

#### 1. Datamodel og persistence

Den nye persisted model omfatter:
- `sfggAlleSygeperioderErTafPerioder`
- `sfggSygeperioderFoer2015`
- `sfggAnsaettelsesforhold`

Pr. ansættelsesforhold persisted blandt andet:
- beregningskilde
- referenceperiode
- ferie- og fraværsdage uden løn
- manuel dagssats
- manuel begrundelsestekst
- toggle for først SFGG efter ophør af sygeløn
- satsvalg
- allerede betalt SFGG

#### 2. UI

Der er implementeret særskilt SFGG-contentbox i `EOOplysningerTab` med:
- beregningskilde
- referenceperiodefelter
- integerfelt for ferie-/fraværsdage uden løn
- manuel sats og begrundelsestekst
- toggle for først efter sygeløn
- felt for allerede betalt SFGG
- præ-2015-toggle
- særskilt tabel for supplerende sygeperioder før 2015

#### 3. Validering

Der er implementeret særskilt validering for:
- manglende beregningskilde
- manglende manuel sats
- manglende overenskomstvalg
- referenceperiodekrav
- datoorden
- krav om satsvalg ved differentierede satser
- ingen arbejdsdage i referenceperioden
- maksimum for ferie-/fraværsdage uden løn
- præ-2015-supplerende sygeperioder

#### 4. Beregningsmotor

Der er implementeret beregning for:
- separat beregning pr. ansættelsesforhold
- `Ingen`, `Manuelt angivet`, `Ferieloven` og `Overenskomst`
- ferielovsberegnet referencesats
- direkte overenskomstsatser
- overenskomstregulering af ferielovsberegnet sats
- fradrag for feriepenge af sygeløn
- fradrag for allerede betalt SFGG
- pensionstillæg
- præ-2015-4-månedersgrænse
- post-2015-første-sygedag-regel
- ophør ved ansættelsesophør
- bortfald under arbejdsgiverbetalt sygeløn
- seksmånedersadvarsel

#### 5. Overenskomstdata

Der er indført eksplicit SFGG-policy pr. overenskomst med felter for:
- fravigelse af ferielov
- model
- differentierede direkte satser
- bortfald under arbejdsgiverbetalt sygeløn
- referenceperiode-label

Der er også runtime-assert for fuld policy-dækning af overenskomsterne.

#### 6. Debug og PDF

SFGG er koblet på:
- EODebug
- EO's nettoflow
- PDF-generatoren
- bilagsvalg på EOBeregningTab

#### 7. Tests

Der findes tests for blandt andet:
- referencesatsberegning
- fradrag for feriepenge af sygeløn
- segmentering
- første sygedag efter 2015
- præ-2015-4-månedersgrænse
- seksmånedersadvarsel
- validatorregler
- debug-rækker
- PDF-accept af valgt SFGG-bilag

### Afvigelser fra den normative forretningslogik

#### 1. Referencesatsens dagoptælling ved månedsbaseret TAF afviger fra den tidligere dokumentation

Den aktuelle kode bruger kalenderdage, når SFGG følger referenceperiode og TAF beregnes som måneder.

Eksempel:
- referenceperiode `01-01-2024` til `31-01-2024`
- `1` fraværsdag uden løn

Aktuel kode:
- divisor = `31 kalenderdage - 1 = 30`

Tidligere dokumentation:
- divisor = periodens hverdage minus fravær

Denne dokumentation er nu opdateret til at afspejle den aktuelle beregningslogik.

#### 2. PDF-ordlyd matcher ikke fuldt de normative tekster

Der genereres funktionelle forklaringslinjer for:
- 4-månedersophør
- ansættelsesophør
- bortfald under arbejdsgiverbetalt sygeløn

Men ordlyden matcher ikke fuldt de præcist fastlagte normative tekster i Del 1.

#### 3. SFGG-tabellens `I alt`-række vises ikke altid

Den aktuelle kode viser kun `I alt`-rækken, når der er mere end én datalinje i tabellen.

Eksempel:
- én sammenhængende SFGG-periode giver én datalinje
- her vises ingen `I alt`-række i hverken EODebug eller PDF

Denne dokumentation er nu opdateret til at afspejle den aktuelle visningslogik.

#### 4. Seksmånedersadvarsel er ikke fuldt verificeret på EOBeregningTab

Der findes beregning og debug-visning af seksmånedersadvarslen.
Ved denne gennemgang er den konkrete slutbrugerplacering på EOBeregningTab ikke verificeret som selvstændig advarsel uden for debug.

#### 5. SFGG-bilaget er aktivt i UI

Den tidligere dokumentation beskrev bilagsvalget som deaktiveret.
Det passer ikke længere.
Checkboxen for `Sygeferiegodtgørelse` er aktiv i den aktuelle UI.

---

## Fejl, mangler og uafklarede spørgsmål

### Fejl

### Mangler

1. PDF-teksterne for præ-2015 og ansættelsesophør er ikke tilpasset den præcist fastlagte normative ordlyd.

2. Den præcise brugerplacering af seksmånedersadvarslen bør verificeres og eventuelt justeres, hvis kravet fortsat er, at advarslen skal fremgå tydeligt på EOBeregningTab.

3. Der er ikke fundet særskilt domænelogik, som driver en alternativ referenceperiode ud over brugerens manuelle datoindtastning, selv om denne type fravigelse er en del af den normative forretningslogik.

### Uafklarede spørgsmål

1. Skal SFGG-bilaget behandles som produktionsklart nu, hvor det er aktivt i UI, eller som foreløbigt, indtil afvigelserne ovenfor er lukket?

2. Skal de præcise PDF-tekster i Del 1 fortsat betragtes som bindende, eller er funktionelt tilsvarende formuleringer acceptable?
