# Særregel: ≤ 2 år til folkepensionsalderen

Denne fil samler forretningslogikken for sager, hvor skadelidte er inden for eller præcis 2 år fra sin folkepensionsalder på et relevant kontroltidspunkt. Reglerne berører fane 2 (løbende ydelser), fane 3 (kapitalisering) og fane 5 (differencekrav).

Se også:
- [loebende-eet.md](./loebende-eet.md) – fane 2
- [kapitaliseret-eet.md](./kapitaliseret-eet.md) – fane 3
- [differencekrav.md](./differencekrav.md) – fane 5

---

## Hvornår gælder særreglen?

Særreglen gælder når:

```
folkepensionsalder_måneder − alder_måneder ≤ 24
```

på det relevante kontroltidspunkt.

Grænsen er inklusiv:
- Datoen præcis 24 måneder før folkepensionsdatoen er inden for særreglen.
- Dagen før denne dato er uden for særreglen.

Folkepensionsalderen opslås centralt i `src/data/folkepensionAlderRates.ts` ud fra fødselsdato og kontroltidspunkt. Kapitaliseringsbekendtgørelsen bruges fortsat til tabelvalg og særfaktor (skadedato × kontroltidspunkt → bekendtgørelse → tabelvalg/særfaktor).

---

## Generel afgørelseslogik

Disse regler gælder generelt, også uden for særreglen:

- En senere afgørelse erstatter den tidligere afgørelses retsvirkning fra sin egen virkningsdato.
- Tidligere kapitalisering bevares altid. En senere afgørelse ændrer derfor kun den resterende løbende del.
- To afgørelser må godt have samme afgørelsesdato og forskellig virkningsdato. I så fald gælder afgørelsen med den tidligste virkningsdato indtil dagen før den senere virkningsdato.

---

## Fane 2 – Løbende ydelser

### Kontroltidspunkt

Afgørelsesdatoen.

### Hovedregel

Løbende ydelser fortsætter som udgangspunkt til og med dagen før folkepensionsdatoen. Det gælder også når afgørelsen er truffet mere end 2 år før folkepensionsalderen.

Der er kun én særregel med tvungen fuldkapitalisering, og den gælder kun for `Endelig`.

### Endelig afgørelse inden for eller præcis 2 år før folkepension

Hvis en `Endelig` afgørelse træffes inden for eller præcis 2 år før folkepensionsalderen:
- hele erhvervsevnetabet skal kapitaliseres på afgørelsesdatoen
- kapitaliseringsdatoen er derfor lig afgørelsesdatoen

Løbende ydelser afhænger herefter af virkningsdatoen:
- Hvis virkningsdatoen ligger før 2-årsgrænsen, beregnes løbende ydelser fra virkningsdatoen til og med dagen før afgørelsesdatoen.
- Hvis virkningsdatoen ligger på eller efter 2-årsgrænsen, beregnes der ingen løbende ydelser.

### Endelig afgørelse mere end 2 år før folkepension

Hvis en `Endelig` afgørelse træffes mere end 2 år før folkepensionsalderen:
- der sker ingen tvungen kapitalisering
- løbende ydelser fortsætter til og med dagen før folkepensionsdatoen

### Delvist endelig og midlertidig

`Delvist endelig` og `Midlertidig` følger ikke den tvungne fuldkapitalisering:
- løbende ydelser fortsætter til og med dagen før folkepensionsdatoen
- ophør kan dog stadig indtræde tidligere på grund af næste afgørelse eller en faktisk kapitalisering

Den resterende løbende del af en `Delvist endelig` afgørelse behandles i alle henseender som en midlertidig løbende ydelse med samme procentsats. Tidligere delkapitalisering ændrer kun restprocenten; den ændrer ikke den løbende dels ophørs-, fradrags- eller differencekravslogik.

---

## Fane 3 – Kapitalisering

### Kontroltidspunkt

Normalt afgørelsesdatoen. Ved genoptagelse (kolonne 7 udfyldt): den tidligere kapitaliseringsdato.

### Særfaktor

Hvis skadelidte er ≤ 2 år fra folkepension på kontroltidspunktet, bruges særfaktoren direkte som kapitaliseringsfaktor:

```
kapitaliseringsfaktor = round3(særfaktor)
kapitaliseretPgaUnderToAarTilFp = true
```

Særfaktoren siger kun noget om kapitaliseringsfaktoren. Om der overhovedet skal ske kapitalisering, afhænger af afgørelsestypen og hovedreglen nedenfor.

Hvis skadelidte endnu ikke er inden for 2-årsgrænsen, men alderstabellen allerede er udtømt, fortsætter faktorberegningen lineært mod særfaktoren.
Det gælder også i månedsafhængige tabeller, når den sidste tabelrække er et helt år, men skadelidte er ældre end dette med ekstra måneder.
Eksempel: Slutter tabellen ved 64 år, skal `64 år, 2 måneder` interpoleres mellem 64-års-faktoren og særfaktoren ved 65 år, ikke låses til 64-års-faktoren.

### Hvilke afgørelser kapitaliseres?

- `Endelig` inden for eller præcis 2 år før folkepension: hele EET kapitaliseres pr. afgørelsesdatoen.
- `Endelig` mere end 2 år før folkepension: de almindelige kapitaliseringsregler gælder fortsat. Særreglen ændrer ikke dette.
- `Delvist endelig`: kun den indtastede andel kapitaliseres. Den skal være mindre end det fulde EET og højst 50 %.
- `Midlertidig`: ingen kapitalisering.

### Kapitaliseringsdatoen ved særreglen

Når en `Endelig` afgørelse er inden for eller præcis 2 år før folkepension, skal kapitaliseringsdatoen være lig afgørelsesdatoen.

---

## Fane 5 – Differencekrav

### Kontroltidspunkt for fradrag 3

I fane 5 er kontroltidspunktet for ≤ 2 år-vurderingen beregningsdatoen, ikke afgørelsesdatoen.

Differencekrav medregner alle indtastede afgørelser med virkning på eller før beregningsdatoen. Afgørelsesdatoen må godt ligge efter beregningsdatoen; det udelukker ikke afgørelsen fra differencekravet.

Hvis der på beregningsdatoen fortsat består en løbende ydelse, afhænger fradrag 3 af afstanden til folkepensionsalderen:
- Ved beregningsdato inden for eller præcis 2 år til folkepension fratrækkes de tilbageværende løbende ydelser fra beregningsdatoen til og med dagen før folkepensionsdatoen.
- Ved beregningsdato mere end 2 år før folkepension proformakapitaliseres hele rest-EET på beregningsdatoen.

Hvis beregningsdatoen er på eller efter folkepensionsdatoen, findes der ingen tilbageværende løbende ydelser, og fradrag 3 springes over.

### Fradragslogik

#### Endelig afgørelse inden for eller præcis 2 år, virkningsdato før 2-årsgrænsen

Skadelidte har i denne situation:
- fået løbende ydelser fra virkningsdatoen til og med dagen før afgørelsesdatoen
- fået et kapitalbeløb pr. afgørelsesdatoen

Differencekravet fratrækker derfor:
- de løbende ydelser
- kapitalbeløbet
- ingen fradrag 3, hvis hele EET allerede er kapitaliseret

#### Endelig afgørelse inden for eller præcis 2 år, virkningsdato på eller efter 2-årsgrænsen

Skadelidte har i denne situation:
- ikke fået løbende ydelser
- fået et kapitalbeløb pr. afgørelsesdatoen

Differencekravet fratrækker derfor:
- ingen løbende ydelser
- kapitalbeløbet
- ingen fradrag 3, hvis hele EET allerede er kapitaliseret

#### Endelig afgørelse mere end 2 år før folkepension, eller ikke-endelig afgørelse

I disse situationer er der ikke sket tvungen fuldkapitalisering efter hovedreglen. Differencekravet fraviger derfor ASL-forløbet på ét punkt:
- løbende ydelser fratrækkes kun til og med dagen før beregningsdatoen, dog aldrig efter dagen før folkepensionsdatoen
- hvis beregningsdatoen er inden for eller præcis 2 år til folkepension og før folkepensionsdatoen, fratrækkes de resterende løbende ydelser frem til dagen før folkepensionsdatoen
- hvis beregningsdatoen er mere end 2 år før folkepension, proformakapitaliseres rest-EET på beregningsdatoen

#### Delvis kapitalisering med tilbageværende løbende EET

Hvis en del af EET allerede er kapitaliseret, og en del stadig løber:
- de faktisk udbetalte løbende ydelser fratrækkes
- det faktisk udbetalte kapitalbeløb fratrækkes
- den resterende løbende del behandles som en midlertidig løbende ydelse med samme procentsats

---

## Samlet overblik

| Situation | Fane 2 | Fane 3 | Fane 5 |
|---|---|---|---|
| Endelig > 2 år før FP | Løbende til dagen før FP | Almindelige kapitaliseringsregler | Løbende fradrag til dagen før beregningsdatoen, dog aldrig efter dagen før FP, samt restydelser til dagen før FP hvis beregningsdatoen er ≤ 2 år til FP; ellers proforma af rest-EET på beregningsdatoen |
| Endelig ≤ 2 år før FP, virkning før 2-årsgrænsen | Løbende til dagen før afgørelsesdatoen | Hele EET kapitaliseres | Fradrag for både løbende ydelser og kapitalbeløb |
| Endelig ≤ 2 år før FP, virkning på/efter 2-årsgrænsen | Ingen løbende ydelser | Hele EET kapitaliseres | Kun kapitalbeløbet fratrækkes |
| Delvist endelig eller midlertidig | Løbende til dagen før FP, medmindre andet stopper tidligere | Kun faktisk indtastet kapitalisering | Restydelser til dagen før FP hvis beregningsdatoen er ≤ 2 år til FP; ellers proforma af rest-EET på beregningsdatoen |

---

## Teknisk reference

### Kode

| Fil | Funktion | Beskrivelse |
|---|---|---|
| `folkepensionAlderRates.ts` | `getFolkepensionAlder()` / `getFolkepensionsdato()` | Central kilde til folkepensionsalder i måneder, label og folkepensionsdato. |
| `eetLoebendeYdelserCalculation.ts` | `resolveFolkepensionsDagFoer()` | Beregner dagen før folkepensionsdatoen som ophørskandidat for løbende ydelser via den centrale ratefil. |
| `eetKapitaliseringCalculation.ts` | `useDirectSaerfaktor` | `controlTabelvalg.folkepensionsalderMaaneder − controlAge.totalMonths ≤ 24`, hvor `folkepensionsalderMaaneder` kommer fra den centrale ratefil. |
| `eetDifferencekravCalculation.ts` | Fradrag 3 | Ved beregningsdato ≤ 2 år til FP opgøres rest-EET som resterende løbende ydelser til dagen før FP; ved beregningsdato > 2 år proformakapitaliseres rest-EET. |
| `eetKapitaliseringOpslag.ts:309` | `isUnderOrEqualTwoYearsToFpByBekendtgoerelse()` | Eksponeret hjælpefunktion til UI-validering |

### Implementeringsstatus

Dokumentationen beskriver den implementerede forretningslogik. Hvis dokumentation og kode afviger, er denne fil den normative beskrivelse af forretningslogikken.

---

## Status

Dokumentationen afspejler den fastlagte forretningslogik for særreglen.
