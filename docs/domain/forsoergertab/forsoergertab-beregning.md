# Forsørgertab

**Sidst opdateret:** 2026-03-20
**Status:** Implementeret

## 1. Formål

Dette dokument fastlægger den normative beregningslogik for forsørgertab i Mineo.

Forsørgertab beregnes som:

```text
Nettokrav = max(0, ealKrav - aslLobendeYdelserTotal - aslKapitalbelob)
```

Begge led beregnes udelukkende på baggrund af data i `forsoergertab`, `faellesAarsloen` og `stamdata`.
Persisted data fra `erhvervsevnetab` bruges ikke.

## 2. Input

### `forsoergertab`

| Felt | Type | Betydning |
|---|---|---|
| `efterladteFodselsdato` | `ISODateString` | Den efterladte ægtefælle/samlevers fødselsdato |
| `beregningsdato` | `ISODateString` | Omsætningstidspunktet |
| `virkningsdato` | `ISODateString` | Startdato for de løbende ASL-ydelser |
| `tilkendtForPeriodeAar` | `number` | Tilkendt periode i hele år, 1-10 |
| `koen` | `Koen` \| `undefined` | Køn for den efterladte ægtefælle/samlever. Påkrævet når beregningsdato er før 2015-03-01 |

### `faellesAarsloen`

| Felt | Type | Betydning |
|---|---|---|
| `aslAarsloen` | `AmountValue` | Årsløn til ASL-beregningen |
| `ealAarsloen` | `AmountValue` | Årsløn til EAL-beregningen, med `aslAarsloen` som fallback |

### `stamdata`

| Felt | Type | Betydning |
|---|---|---|
| `skadedato` | `ISODateString` | Skadedato |
| `skadelidteFodselsdato` | `ISODateString` | Skadelidtes fødselsdato. Bruges kun til EAL-aldersreduktion |

## 3. Overordnede valideringsregler

Disse forhold er blokerende fejl og skal forhindre download af specifikation:

- `beregningsdato` mangler
- `virkningsdato` mangler
- `tilkendtForPeriodeAar` mangler
- `skadedato` mangler
- `efterladteFodselsdato` mangler
- EAL-årsløn kan ikke fastlægges
- ASL-årsløn kan ikke fastlægges
- `beregningsdato < virkningsdato`
- Årslønsmaksimum mangler for skadesåret, beregningsåret eller et mellemliggende år i ydelsesperioden
- Kapitaliseringstabeldata mangler for den relevante bekendtgørelse
- Der kan ikke findes relevant kapitaliseringsbekendtgørelse
- Der kan ikke findes relevant forsørgertabstabel
- Der kan ikke findes eksakt aldersrække for den efterladtes fyldte alder
- Der kræves køn til tabelopslag, men køn er ikke valgt

Når `beregningsdato < virkningsdato`, skal begge felter markeres med fejl.

## 4. EAL-krav

### 4.1 Hovedregel

EAL-kravet beregnes ved at genbruge EET efter EAL-logikken med disse faste regler:

- EET-procenten er fast `30`
- `beregningsdato` kommer fra `forsoergertab.beregningsdato`
- `skadedato` kommer fra `stamdata.skadedato`
- skadelidtes fødselsdato kommer fra `stamdata.skadelidteFodselsdato`
- `ealAarsloen` prioriteres
- `aslAarsloen` bruges som fallback, hvis `ealAarsloen` ikke findes

Det anbefalede design er en selvstændig wrapperfunktion i `src/domain/forsoergertab/`, som kalder den eksisterende EAL-beregning med en fast override på 30 %.

### 4.2 Afrunding

`ealKrav` følger samme afrundingsregler som EET efter EAL og ender som helt kronebeløb.

### 4.3 Minimumssats

Der gælder et lovbestemt minimumsbeløb for EAL-kravet pr. beregningsår (`foersoergertabEalMin[beregningsaar]`).

Hvis `eetBeregnet < foersoergertabEalMin[beregningsaar]`, forhøjes beregningen:

```text
eetAnvendt = foersoergertabEalMin[beregningsaar]
aldersreduktionBeloeb = round0(eetAnvendt * (aldersreduktionPct / 100))
ealKrav = max(0, round0(eetAnvendt - aldersreduktionBeloeb))
```

Hvis `eetBeregnet >= foersoergertabEalMin[beregningsaar]`, bruges den ordinære beregning uden forhøjelse.

Til UI eksponeres:
- `foersoergertabEalMinSats`: minimumssatsen for beregningsåret (eller `null` hvis data mangler)
- `foersoergertabForhoejtetTilMin`: `true` hvis forhøjelse er sket, ellers `false`

## 5. ASL-ydelser

### 5.1 Årsløn

ASL-beregningen følger samme struktur som ASL-kapitalisering i EET:

```text
aslAarsloenAfrundet1000 = roundNearest1000(aslAarsloen)
benyttetAarsloen = min(aslAarsloenAfrundet1000, aarsloenMax[skadesaar])
```

### 5.2 Årlig ASL-erstatning

Den løbende forsørgertabsydelse efter ASL udgør 30 % af skadelidtes ASL-årsløn opreguleret til beregningsåret.

Opregulering:

```text
opreguleringsfaktor = aarsloenMax[beregningsaar] / aarsloenMax[skadesaar]
opreguleretAarligYdelse = round2(0.30 * benyttetAarsloen * opreguleringsfaktor)
```

Normativ præcisering:

- Der beregnes ikke grundløn i forsørgertab efter ASL.
- Der anvendes en fast forsørgertabsprocent på 30 % i den løbende ASL-ydelse.
- Der anvendes ikke særskilt AM-bidragsreduktion i den løbende ASL-ydelse.
- Der sker ikke oprunding til nærmeste højere beløb deleligt med 12.
- Der sker alene afrunding til 2 decimaler på den opregulerede årlige ydelse.
- `opreguleretAarligYdelse` bruges **udelukkende** som grundlag for kapitalisering (§8). De løbende ydelsers månedlige beløb beregnes efter en separat formel i §5a.4, som bruger `ceilNearest12` i stedet for `round2`.

### 5.3 Resterende periode

Ydelserne behandles som månedsvise ydelser betalt forud.

Allerede udbetalte måneder beregnes som antallet af kalendermåneder fra og med virkningsdatoens måned til og med beregningsdatoens måned. Opgørelsen er kalendermånedsbaseret — dagspræcision inden for måneden er ikke relevant, fordi ydelserne anses for forfaldne pr. hel kalendermåned:

```text
alleredeUdbetaltMaaneder =
  (beregningsaar - virkningsaar) * 12
  + (beregningsmaaned - virkningsmaaned)
  + 1
```

Eksempel:

- virkningsdato: 2023-05-15 (eller 2023-05-01 — resultatet er det samme)
- beregningsdato: 2025-08-15
- allerede udbetalt: 28 måneder

Samlet tilkendt periode:

```text
samletMaaneder = tilkendtForPeriodeAar * 12
```

Resterende måneder:

```text
resterendeMaanederTotal = max(0, samletMaaneder - alleredeUdbetaltMaaneder)
```

Omskrevet til år og måneder:

```text
resterendeAar = floor(resterendeMaanederTotal / 12)
resterendeMaaneder = resterendeMaanederTotal % 12
```

Hvis `resterendeMaanederTotal === 0`, er `aslKapitalbelob = 0`, og der skal ikke foretages tabelopslag.

## 5a. Løbende ydelser (fradrag)

### 5a.1 Formål

Ud over kapitaliseringen af den fremtidige resterende periode fradrages de løbende ydelser, der allerede er forfaldne i perioden fra virkningsdatoen til og med dagen før beregningsdatoen.

### 5a.2 Afgrænsning

- Fra-dato: `virkningsdato` (inklusiv)
- Til-dato: den mindste af `beregningsdato - 1 dag` og `virkningsdato + tilkendtForPeriodeAar - 1 dag` (inklusiv)
- Perioden afkortes altså af periodens naturlige slutdato, hvis den falder før beregningsdatoen.
- Hvis til-dato beregnet som ovenfor er tidligere end `virkningsdato`, er tabellen tom og `aslLobendeYdelserTotal = 0`.

### 5a.3 Opdeling i kalenderårsrækker

Der beregnes én række pr. kalenderår. Skæringen sker ved kalenderårsskiftet (1. januar).

### 5a.4 Månedlig ydelse pr. år

**Skadesåret:**

```text
aarligYdelseSkadesaar = ceilNearest12(0,30 × benyttetAarsloen)
maanedligYdelse = aarligYdelseSkadesaar / 12
```

**Efterfølgende år:**

```text
aarligYdelseForAar = ceilNearest12(0,30 × benyttetAarsloen × (aarsloenMax[år] / aarsloenMax[skadesaar]))
maanedligYdelse = aarligYdelseForAar / 12
```

`ceilNearest12(x)` = mindste heltal deleligt med 12, som er ≥ x.

### 5a.5 Måneder pr. delperiode

Delvise måneder beregnes dag for dag som 1/x-del af en månedlig ydelse, hvor x er antallet af kalenderdage i den pågældende måned.

```text
delvisFirsteMaaned = (daysInMonth(startMaaned) - startDag + 1) / daysInMonth(startMaaned)
fulde måneder = antal hele kalendermåneder mellem første og sidste delvis måned
delvisSidsteMaaned = slutDag / daysInMonth(slutMaaned)
maaneder = delvisFirsteMaaned + fuldeMaaneder + delvisSidsteMaaned
```

Særtilfælde: hvis start- og slutdato er i samme måned:

```text
maaneder = (slutDag - startDag + 1) / daysInMonth(maaned)
```

`maaneder` afrundes til 4 decimaler.

### 5a.6 Ydelse i alt pr. række

```text
ydelseIAlt = round0(maanedligYdelse × maaneder)
```

### 5a.7 Samlet fradrag

```text
aslLobendeYdelserTotal = sum af alle rækkers ydelseIAlt
```

Da hvert `ydelseIAlt` allerede er afrundet til 0 decimaler med `round0`, er summen altid et heltal. Der foretages ingen yderligere afrunding på summationsniveauet.

### 5a.8 Indregning i nettokrav

```text
nettokrav = max(0, ealKrav - aslLobendeYdelserTotal - aslKapitalbelob)
```

## 6. Kapitaliseringsbekendtgørelse og tabelvalg

### 6.1 Bekendtgørelse

Bekendtgørelse vælges med samme opslag som i EET:

```text
resolveKapitaliseringsbekendtgoerelseId(skadedato, beregningsdato)
```

Bekendtgørelsen bruges også til at fastlægge folkepensionsalderen for den efterladte på beregningsdatoen.

### 6.2 Relevant forsørgertabstabel

Den relevante forsørgertabstabel vælges ud fra:

- skadedato
- beregningsdato
- om bekendtgørelsen bruger kønsneutral eller kønsopdelt forsørgertabstabel
- køn, når beregningsdato er før 2015-03-01

Normative regler:

- Hvis `beregningsdato >= 2015-03-01`, anvendes kønsneutral forsørgertabstabel.
- Hvis `beregningsdato < 2015-03-01`, anvendes kønsafhængig forsørgertabstabel.
- Når `beregningsdato < 2015-03-01`, er `koen` påkrævet input.
- Systemet skal kunne slå korrekt op i `forsoergertabTabellerMaend` og `forsoergertabTabellerKvinder`.
- Hvis den relevante bekendtgørelse ikke har den tabeltype, der kræves for situationen, er det en blokerende fejl.

Dokumentet forudsætter derfor, at den samlede kapitaliseringsaggregator eksponerer:

- `forsoergertabTabelvalg`
- `forsoergertabTabeller`
- `forsoergertabTabellerMaend`
- `forsoergertabTabellerKvinder`

## 7. Kapitalfaktor

### 7.1 Alder

Den efterladtes alder beregnes som fyldt alder i hele år på beregningsdatoen.

```text
alderHeleAar = calculateAgeYearsMonths(efterladteFodselsdato, beregningsdato).years
```

### 7.2 Aldersrække

Der kræves eksakt match på aldersrække.

Normative regler:

- Find rækken hvor `alder === alderHeleAar`
- Hvis der ikke findes en eksakt række, skal systemet vise fejl og ikke beregne
- Der må ikke bruges nærmest lavere alder
- Der må ikke bruges nærmest højere alder

### 7.3 Faktor for restperiode

Forsørgertabstabellen indeholder faktorer for hele år.
Når restperioden indeholder både år og måneder, skal der interpoleres lineært mellem hele år i overensstemmelse med BEK nr. 1276 af 28. november 2024 § 3, stk. 2.

Hvis `faktorerPraHeleAar` er 0-indekseret, gælder:

- `faktorerPraHeleAar[0]` = faktor for 1 år
- `faktorerPraHeleAar[1]` = faktor for 2 år
- `faktorerPraHeleAar[n - 1]` = faktor for `n` år

Regler:

- Ved `0 år og 0 måneder` bruges ingen faktor, fordi kapitalbeløbet allerede er `0`
- Ved `0 år og X måneder` interpoleres mellem `0` og faktoren for `1 år`
- Ved `X hele år og 0 måneder` bruges faktoren for `X år` direkte
- Ved `X hele år og Y måneder`, hvor `0 < Y < 12`, interpoleres mellem faktoren for `X år` og faktoren for `X + 1 år`

Formel:

```text
faktorX = faktor for X år
faktorXplus1 = faktor for X + 1 år
interpoleretFaktor = faktorX + (faktorXplus1 - faktorX) * (Y / 12)
```

Særligt for `0 år og X måneder`:

```text
interpoleretFaktor = faktorFor1Aar * (X / 12)
```

Kapitalfaktoren afrundes til 3 decimaler.

Hvis der mangler en nødvendig faktor i tabellen for interpolation, er det en blokerende fejl.

## 8. Kapitalbeløb

### 8.1 Folkepensionsalder nået på beregningsdatoen

Hvis den efterladte på beregningsdatoen har nået folkepensionsalderen, fastlagt efter den relevante kapitaliseringsbekendtgørelse på beregningsdatoen, skal der ikke beregnes kapitalværdi af resterende løbende ydelser.

Normative regler:

- folkepensionsalderen fastlægges ved opslag i den relevante kapitaliseringsbekendtgørelse på beregningsdatoen
- hvis den efterladte på beregningsdatoen har nået folkepensionsalderen, udføres intet opslag i forsørgertabstabel
- hvis den efterladte på beregningsdatoen har nået folkepensionsalderen, sættes `kapitalbelob = 0`
- dette er ikke en fejltilstand

UI i ASL-boxen skal i denne situation udtrykkeligt vise, at:

- værdien af løbende ydelser efter folkepensionsalderen udgør `0 kr.`

Visningen skal være simpel og uden mellemregning for kapitalfaktor eller kapitaliseringstabel i denne situation.

### 8.2 Kapitalbeløb i øvrige tilfælde

Kapitalbeløb:

```text
kapitalbelob = ceil0(opreguleretAarligYdelse * kapitalfaktor)
```

Normative regler:

- Den årlige ydelse er allerede afrundet til 2 decimaler
- Kapitalfaktoren er afrundet til 3 decimaler
- Slutproduktet afrundes opad til nærmeste hele krone

## 9. Nettoresultat

```text
nettokrav = max(0, ealKrav - aslLobendeYdelserTotal - aslKapitalbelob)
```

Alle fire outputtal vises som hele kronebeløb:

- EAL-krav
- ASL løbende ydelser
- ASL-kapitalbeløb
- Forsørgertabserstatning

## 10. UI

Øverste contentbox viser inputfelter:

- Efterladte ægtefælle/samlevers fødselsdato
- Beregningsdato
- Startdato for ASL-ydelse
- Tilkendt for periode
- Køn, når beregningsdato er før 2015-03-01
- Skadelidtes årsløn (efter ASL)
- Skadelidtes årsløn (efter EAL)
- Download specifikation

Hvis `skadelidteFodselsdato` mangler eller er ugyldig, skal siden vise blokkerende fejlmeddelelse og henvise brugeren til `Stamdata`, hvor feltet vedligeholdes.

Derudover vises:

- en contentbox for EAL-krav
- en contentbox for ASL-ydelser
- en nederste contentbox for beregnet forsørgertab

## 11. Implementeringsretning

Det anbefalede domænesnit er:

- `forsoergertabTypes.ts`
- `forsoergertabEalKrav.ts`
- `forsoergertabAslYdelser.ts`
- `forsoergertabCalculation.ts`

### `computeForsoergertabEalKrav`

Ansvar:

- bygge syntetisk input til EAL-beregningen
- tvinge EET-procent til 30
- returnere EAL-computation og issues

### `computeForsoergertabAslYdelser`

Ansvar:

- validere ASL-input
- beregne opreguleret årlig ydelse
- beregne restperiode
- vælge bekendtgørelse og tabel
- vælge korrekt kønsopdelt eller kønsneutral tabel
- slå eksakt aldersrække op
- afkorte kapitalisering helt, når folkepensionsalderen er nået på beregningsdatoen
- interpolere kapitalfaktor
- beregne kapitalbeløb

### `computeForsoergertabCalculation`

Ansvar:

- kalde EAL- og ASL-delen
- aggregere issues
- beregne nettokrav, når begge led er gyldige

## 12. Testfokus

Minimumsdækning bør omfatte:

- `beregningsdato < virkningsdato` giver fejl på begge felter og blokerer download
- beregningsdato før 2015-03-01 kræver køn
- korrekt opslag i kønsafhængige tabeller før 2015-03-01
- korrekt opslag i kønsneutral tabel fra og med 2015-03-01
- når folkepensionsalderen er nået på beregningsdatoen, bliver ASL-kapitalbeløb `0 kr.`
- eksakt aldersmatch kræves
- manglende aldersrække giver fejl og ingen beregning
- restperiode 0 måneder giver `aslKapitalbelob = 0`
- interpolation for `0 år og X måneder`
- interpolation for `X år og Y måneder`
- ingen 12-delelig oprunding af den årlige ydelse
- kapitalbeløb afrundes opad til hele kroner
- nettokrav bliver aldrig negativt
