# Særregel: ≤ 2 år til folkepensionsalderen

Denne fil samler forretningslogikken for sager, hvor skadelidte er inden for eller præcis 2 år fra sin folkepensionsalder på et relevant kontroltidspunkt. Reglerne berører fane 2 (løbende ydelser), fane 3 (kapitalisering) og fane 5 (differencekrav).

Se også:
- [loebende-eet.md](./loebende-eet.md) — fane 2
- [kapitaliseret-eet.md](./kapitaliseret-eet.md) — fane 3
- [differencekrav.md](./differencekrav.md) — fane 5

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

Folkepensionsalderen opslås i kapitaliseringsbekendtgørelsen gældende på kontroltidspunktet (skadesdato × kontroltidspunkt → bekendtgørelse → tabelvalg → folkepensionsalder i måneder).

---

## Generel afgørelseslogik

Disse regler gælder generelt, også uden for særreglen:

- En senere afgørelse erstatter den tidligere afgørelses retsvirkning fra sin egen virkningsdato.
- Tidligere kapitalisering bevares altid. En senere afgørelse ændrer derfor kun den resterende løbende del.
- To afgørelser må godt have samme afgørelsesdato og forskellig virkningsdato. I så fald gælder afgørelsen med den tidligste virkningsdato indtil dagen før den senere virkningsdato.

---

## Fane 2 — Løbende ydelser

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

---

## Fane 3 — Kapitalisering

### Kontroltidspunkt

Normalt afgørelsesdatoen. Ved genoptagelse (kolonne 7 udfyldt): den tidligere kapitaliseringsdato.

### Særfaktor

Hvis skadelidte er ≤ 2 år fra folkepension på kontroltidspunktet, bruges særfaktoren direkte som kapitaliseringsfaktor:

```
kapitaliseringsfaktor = round3(særfaktor)
kapitaliseretPgaUnderToAarTilFp = true
```

Særfaktoren siger kun noget om kapitaliseringsfaktoren. Om der overhovedet skal ske kapitalisering, afhænger af afgørelsestypen og hovedreglen nedenfor.

### Hvilke afgørelser kapitaliseres?

- `Endelig` inden for eller præcis 2 år før folkepension: hele EET kapitaliseres pr. afgørelsesdatoen.
- `Endelig` mere end 2 år før folkepension: de almindelige kapitaliseringsregler gælder fortsat. Særreglen ændrer ikke dette.
- `Delvist endelig`: kun den indtastede andel kapitaliseres. Den skal være mindre end det fulde EET og højst 50 %.
- `Midlertidig`: ingen kapitalisering.

### Kapitaliseringsdatoen ved særreglen

Når en `Endelig` afgørelse er inden for eller præcis 2 år før folkepension, skal kapitaliseringsdatoen være lig afgørelsesdatoen.

---

## Fane 5 — Differencekrav

### Kontroltidspunkt for proformakapitalisering

I fane 5 er kontroltidspunktet for ≤ 2 år-vurderingen beregningsdatoen, ikke afgørelsesdatoen.

Differencekrav ser kun på afgørelser, der både er truffet og har virkning senest på beregningsdatoen.

Hvis der på beregningsdatoen fortsat består en løbende ydelse, kapitaliseres hele rest-EET proforma på beregningsdatoen. Hvis skadelidte på dette tidspunkt er ≤ 2 år fra folkepension, bruges særfaktoren.

Denne vurdering ændres ikke, bare fordi beregningsdatoen ligger på eller efter folkepensionsdatoen. Datoer på eller efter folkepensionsdatoen behandles fortsat som en del af `≤ 2 år`-situationen.

### Fradragslogik

#### Endelig afgørelse inden for eller præcis 2 år, virkningsdato før 2-årsgrænsen

Skadelidte har i denne situation:
- fået løbende ydelser fra virkningsdatoen til og med dagen før afgørelsesdatoen
- fået et kapitalbeløb pr. afgørelsesdatoen

Differencekravet fratrækker derfor:
- de løbende ydelser
- kapitalbeløbet
- ingen proformakapitalisering, hvis hele EET allerede er kapitaliseret

#### Endelig afgørelse inden for eller præcis 2 år, virkningsdato på eller efter 2-årsgrænsen

Skadelidte har i denne situation:
- ikke fået løbende ydelser
- fået et kapitalbeløb pr. afgørelsesdatoen

Differencekravet fratrækker derfor:
- ingen løbende ydelser
- kapitalbeløbet
- ingen proformakapitalisering, hvis hele EET allerede er kapitaliseret

#### Endelig afgørelse mere end 2 år før folkepension, eller ikke-endelig afgørelse

I disse situationer er der ikke sket tvungen fuldkapitalisering efter hovedreglen. Differencekravet fraviger derfor ASL-forløbet på ét punkt:
- løbende ydelser fratrækkes kun til og med dagen før beregningsdatoen, dog aldrig efter dagen før folkepensionsdatoen
- hvis der på beregningsdatoen fortsat består rest-EET, proformakapitaliseres hele rest-EET på beregningsdatoen
- ligger beregningsdatoen inden for, præcis på eller efter 2-årsgrænsen til folkepension, anvendes særfaktoren

#### Delvis kapitalisering med tilbageværende løbende EET

Hvis en del af EET allerede er kapitaliseret, og en del stadig løber:
- de faktisk udbetalte løbende ydelser fratrækkes
- det faktisk udbetalte kapitalbeløb fratrækkes
- den resterende løbende del proformakapitaliseres på beregningsdatoen

---

## Samlet overblik

| Situation | Fane 2 | Fane 3 | Fane 5 |
|---|---|---|---|
| Endelig > 2 år før FP | Løbende til dagen før FP | Almindelige kapitaliseringsregler | Løbende fradrag til dagen før beregningsdatoen, dog aldrig efter dagen før FP, samt proforma af rest-EET på beregningsdatoen |
| Endelig ≤ 2 år før FP, virkning før 2-årsgrænsen | Løbende til dagen før afgørelsesdatoen | Hele EET kapitaliseres | Fradrag for både løbende ydelser og kapitalbeløb |
| Endelig ≤ 2 år før FP, virkning på/efter 2-årsgrænsen | Ingen løbende ydelser | Hele EET kapitaliseres | Kun kapitalbeløbet fratrækkes |
| Delvist endelig eller midlertidig | Løbende til dagen før FP, medmindre andet stopper tidligere | Kun faktisk indtastet kapitalisering | Proforma af rest-EET på beregningsdatoen |

---

## Teknisk reference

### Kode

| Fil | Funktion | Beskrivelse |
|---|---|---|
| `eetLoebendeYdelserCalculation.ts` | `resolveFolkepensionsDagFoer()` | Beregner dagen før folkepensionsdatoen som ophørskandidat for løbende ydelser. |
| `eetKapitaliseringCalculation.ts:363` | `useDirectSaerfaktor` | `controlTabelvalg.folkepensionsalderMaaneder − controlAge.totalMonths ≤ 24` |
| `eetDifferencekravCalculation.ts:194` | `useDirectSaerfaktor` (proforma) | Samme betingelse, men med beregningsdato som referencepunkt |
| `eetKapitaliseringOpslag.ts:309` | `isUnderOrEqualTwoYearsToFpByBekendtgoerelse()` | Eksponeret hjælpefunktion til UI-validering |

### Implementeringsstatus

Dokumentationen beskriver den implementerede forretningslogik. Hvis dokumentation og kode afviger, er denne fil den normative beskrivelse af forretningslogikken.

---

## Kendte udeståender

Dokumentationen afspejler den fastlagte forretningslogik for særreglen.
