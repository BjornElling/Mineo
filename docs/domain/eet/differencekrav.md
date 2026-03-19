# Differencekrav (fane 5)

Denne fil beskriver beregningslogikken for differencekravet. Beregningen udgør fane 5 på EET-siden.

Se også:
- [loebende-eet.md](./loebende-eet.md) — fane 2
- [kapitaliseret-eet.md](./kapitaliseret-eet.md) — fane 3
- [eal-beregning.md](./eal-beregning.md) — fane 4
- [fejlkatalog.md](./fejlkatalog.md) — alle fejl og advarsler
- [under-to-aar-til-fp.md](./under-to-aar-til-fp.md) — særregel for ≤ 2 år til folkepensionsalderen

---

## Del 1 — For dig

### Hvad er differencekravet?

Differencekravet er det beløb skadelidte kan kræve derudover, når EAL-erstatningen overstiger den samlede ASL-erstatning. Hvis ASL-erstatningen er større end eller lig med EAL-erstatningen, er differencekravet 0 kr.

### Overordnet princip

```
differencekrav = eal_krav
               − fradrag_løbende_ydelser
               − fradrag_kapitaliseret_eet
               − proformakapitalisering

hvis differencekrav < 0: differencekrav = 0
```

Fane 5 beregner ikke nye ASL- eller EAL-typer. Den trækker de øvrige faners resultater ind, men fradrag 1 og 3 har deres egen særlogik.

### Dataflow

| Kilde | Særlighed |
|---|---|
| **EAL-krav (fane 4)** | Kørsel af `computeEetEalCalculation` |
| **Kapitaliseret EET (fane 3)** | Kørsel af `computeEetKapitaliseringCalculation` |
| **Løbende ydelser (fane 2)** | Kørsel af `computeEetLoebendeYdelser` med `beregningsdato = dagFørBeregningsdato` |

### Fradrag 1 — Løbende ydelser

Fradrag 1 beregnes med samme grundmodel som fane 2, men altid kun til og med dagen før beregningsdatoen.

Differencekravet ser kun på afgørelser, der både er truffet og har virkning senest på beregningsdatoen.

Fradragsreglen per afgørelse afhænger fortsat af skadesdatoen:

| Skadesdato | Afgørelsestype | Fradrages? |
|---|---|---|
| Før 16-06-2011 | Midlertidig | Ja |
| Før 16-06-2011 | Delvist endelig | Ja |
| Før 16-06-2011 | Endelig | Ja |
| 16-06-2011 eller senere | Midlertidig | Nej |
| 16-06-2011 eller senere | Delvist endelig | Nej |
| 16-06-2011 eller senere | Endelig | Ja |

Ved særreglen for ≤ 2 år til folkepension gælder derudover:
- Hvis der er truffet `Endelig` afgørelse inden for eller præcis 2 år før folkepensionsalderen, og virkningsdatoen ligger før 2-årsgrænsen, fratrækkes løbende ydelser kun frem til og med dagen før afgørelsesdatoen.
- Hvis der er truffet `Endelig` afgørelse inden for eller præcis 2 år før folkepensionsalderen, og virkningsdatoen ligger på eller efter 2-årsgrænsen, fratrækkes ingen løbende ydelser.
- Hvis der er truffet `Endelig` afgørelse mere end 2 år før folkepension, eller afgørelsen ikke er endelig, fratrækkes løbende ydelser til og med den faktiske sidste dag, som ydelsen er beregnet til, dog aldrig efter dagen før folkepensionsdatoen.

### Fradrag 2 — Kapitaliseret EET

Det samlede kapitaliserede beløb hentes fra fane 3. Kun kapitaliseringer med kapitaliseringsdato på eller før beregningsdatoen medregnes.

Ved særreglen er dette især relevant i to situationer:
- `Endelig` inden for eller præcis 2 år før folkepension: hele kapitalbeløbet fratrækkes.
- `Delvist endelig` inden for eller præcis 2 år før folkepension: kun den faktisk kapitaliserede andel fratrækkes.

### Fradrag 3 — Proformakapitalisering af tilbageværende EET

Proformakapitaliseringen svarer til spørgsmålet:

"Hvad ville det tilbageværende løbende erhvervsevnetab være værd som éngangsbeløb, hvis det blev kapitaliseret på beregningsdatoen?"

**Tilbageværende EET-procent:**
```
løbende_eet_pct = seneste_afgørelses_eet_pct − sum(kapPct fra afgørelser med kapDato ≤ beregningsdato)
```

Hvis `løbende_eet_pct = 0`, springes proformakapitaliseringen over.

Proformakapitaliseringen genbruger kapitaliseringslogikken fra fane 3 med disse afvigelser:
- kapitaliseringsdatoen = beregningsdatoen
- alle afgørelsestyper kan indgå
- 50 %-loftet gælder ikke
- bekendtgørelse og tabel opslås på beregningsdatoen
- kontroltidspunktet for ≤ 2 år til folkepension er beregningsdatoen

Proformakapitalisering er differencekravets egen beregningsteknik. Den kan derfor godt forekomme, selv om der i ASL-sporet aldrig er sket nogen faktisk kapitalisering.

Hvis der på beregningsdatoen fortsat består en løbende ydelse, kapitaliseres hele rest-EET proforma på beregningsdatoen.

Ved vurderingen af om beregningsdatoen falder inden for `≤ 2 år` til folkepension, behandles datoer på eller efter folkepensionsdatoen på samme måde som andre `≤ 2 år`-tilfælde. Særfaktoren kan derfor fortsat blive relevant.

### Særreglen i differencekrav

#### Endelig afgørelse ≤ 2 år før folkepension, virkning før 2-årsgrænsen

Skadelidte har i denne situation:
- fået løbende ydelser fra virkningsdatoen til og med dagen før afgørelsesdatoen
- fået et kapitalbeløb pr. afgørelsesdatoen

Differencekravet fratrækker derfor både de løbende ydelser og kapitalbeløbet.

#### Endelig afgørelse ≤ 2 år før folkepension, virkning på eller efter 2-årsgrænsen

Skadelidte har i denne situation:
- ikke fået løbende ydelser
- fået et kapitalbeløb pr. afgørelsesdatoen

Differencekravet fratrækker derfor kun kapitalbeløbet.

#### Endelig afgørelse > 2 år før folkepension, eller ikke-endelig afgørelse

I disse situationer er der ikke sket tvungen fuldkapitalisering efter hovedreglen. Differencekravet fraviger derfor ASL-forløbet på ét punkt:
- løbende ydelser fratrækkes kun til og med dagen før beregningsdatoen, dog aldrig efter dagen før folkepensionsdatoen
- hvis der på beregningsdatoen fortsat består rest-EET, proformakapitaliseres hele rest-EET på beregningsdatoen
- ligger beregningsdatoen inden for, præcis på eller efter 2-årsgrænsen til folkepension, anvendes særfaktoren, også når beregningsdatoen er på eller efter folkepensionsdatoen

---

## Del 2 — AI-agent: teknisk reference

### Primær fil

`src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts`

### Interne hjælpefunktioner

| Funktion | Beskrivelse |
|---|---|
| `computeProformaKapitalisering(args, issues)` | Proformaberegning på beregningsdatoen |
| `resolveLoebendeEetPct(afgoerelser, kapitaliseringer)` | Bestemmer tilbageværende løbende EET-procent |
| `skalFradragForetages(afgoerelseType, skadesdato)` | Afgør om en afgørelse skal fratrækkes |

### Implementeringsstatus

Dokumentationen ovenfor beskriver den fastlagte forretningslogik.
Dokumentationen beskriver den implementerede forretningslogik. Hvis dokumentation og kode afviger, er denne fil den normative beskrivelse af forretningslogikken.

### Proforma-specifikke issue-ID'er

Se [fejlkatalog.md](./fejlkatalog.md) for komplet beskrivelse.

---

## Kendte udeståender

Dokumentationen afspejler den fastlagte forretningslogik for differencekrav.
