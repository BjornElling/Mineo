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
               − fradrag_tilbageværende_eet

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

Differencekravet medregner alle indtastede afgørelser med virkning på eller før beregningsdatoen.
Afgørelsesdatoen må derfor godt ligge efter beregningsdatoen. I så fald indgår afgørelsen fortsat i differencekravet, fordi brugeren opgør differencekravet ud fra de indtastede afgørelser og deres virkningstidspunkt.

Fradragsreglen per afgørelse afhænger fortsat af skadedatoen:

| Skadedato | Afgørelsestype | Fradrages? |
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

#### Tilbagevirkende kraft — endelig afgørelse gør midlertidig ydelse endelig (toggle)

Denne regel styres af den device-lokale toggle `endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft` (se `src/contracts/app-settings.md`). Den påvirker **kun** differencekravet (fane 5), ikke fane 2.

**Når toggle = false:** beregningen er som beskrevet ovenfor (uændret).

**Når toggle = true** og `skadedato ≥ 16-06-2011`:

Hovedreglen er, at midlertidigt EET ikke fradrages i differencekravet for skader fra 16-06-2011 og frem. Denne regel bryder med det princip i ét tilfælde:

- Hvis en `Endelig` afgørelses virkningsdato ligger inden i den periode, hvor der beregnes løbende ydelse for en `Midlertidig` afgørelse (dvs. inden for `[midlertidigs virkningsdato, midlertidigs ophørsdato]`), så bliver den midlertidige ydelse endelig med tilbagevirkende kraft fra den endelige virkningsdato.
- Der foretages derfor fradrag i differencekravet for den midlertidige afgørelses **egen** løbende ydelse — beregnet med den midlertidiges egen rest-EET-procent og egen sats, præcis som fane 2 har beregnet den — for delperioden fra den endelige afgørelses virkningsdato til den midlertidiges normale ophør.

Beløbet beregnes ved at genbruge den midlertidiges allerede beregnede periode-rækker: rækker der starter på eller efter den endelige virkningsdato medregnes fuldt, og en eventuel række der krydser den endelige virkningsdato recomputes for delperioden med samme regel som kilden (`round0(måneder × månedlig ydelse)`).

**Gating:** Reglen er en no-op for skader før 16-06-2011, fordi midlertidige ydelser her allerede fradrages 100 % efter hovedreglen. Den tidligste endelige afgørelses virkningsdato er den, der udløser reglen.

### Fradrag 2 — Kapitaliseret EET

Det samlede kapitaliserede beløb hentes fra fane 3. Kun kapitaliseringer med kapitaliseringsdato på eller før beregningsdatoen medregnes.

Ved særreglen er dette især relevant i to situationer:
- `Endelig` inden for eller præcis 2 år før folkepension: hele kapitalbeløbet fratrækkes.
- `Delvist endelig` inden for eller præcis 2 år før folkepension: kun den faktisk kapitaliserede andel fratrækkes.

### Fradrag 3 — Tilbageværende EET

Fradrag 3 dækker den del af EET, der fortsat består som løbende ydelse på beregningsdatoen.

En resterende løbende del fra en `Delvist endelig` afgørelse behandles altid på samme måde som en midlertidig løbende ydelse med samme procentsats. Det gælder både ophør, fradrag og opgørelsen af fradrag 3.

**Tilbageværende EET-procent:**
```
løbende_eet_pct = seneste_afgørelses_eet_pct − sum(kapPct fra afgørelser med kapDato ≤ beregningsdato)
```

Hvis `løbende_eet_pct = 0`, springes fradrag 3 over.

#### Beregningsdato inden for eller præcis 2 år til folkepension

Hvis beregningsdatoen ligger inden for eller præcis 2 år til folkepensionsalderen, og der fortsat består rest-EET, fratrækkes de tilbageværende løbende ydelser fra beregningsdatoen til og med dagen før folkepensionsdatoen.

Hvis beregningsdatoen er på eller efter folkepensionsdatoen, findes der ingen tilbageværende løbende ydelser, og fradrag 3 springes over.

Beløbet beregnes som:

```
måneder = præcis månedsoptælling fra beregningsdato til dagen før folkepensionsdato
fradrag = round0(måneder × månedlig løbende ydelse på beregningsdatoen)
```

Den månedlige ydelse beregnes efter samme løbende-ydelsesprincip som fane 2: årsydelsen afrundes til nærmeste hele kronebeløb deleligt med 12, og månedssatsen er årsydelsen divideret med 12.

#### Beregningsdato mere end 2 år før folkepension

Hvis beregningsdatoen ligger mere end 2 år før folkepensionsalderen, proformakapitaliseres rest-EET på beregningsdatoen.

Proformakapitaliseringen svarer til spørgsmålet:

"Hvad ville det tilbageværende løbende erhvervsevnetab være værd som éngangsbeløb, hvis det blev kapitaliseret på beregningsdatoen?"

Proformakapitaliseringen genbruger kapitaliseringslogikken fra fane 3 med disse afvigelser:
- kapitaliseringsdatoen = beregningsdatoen
- alle afgørelsestyper kan indgå
- 50 %-loftet gælder ikke
- bekendtgørelse og tabel opslås på beregningsdatoen
- folkepensionsalderen hentes centralt fra `src/data/folkepensionAlderRates.ts`

Proformakapitalisering er differencekravets egen beregningsteknik. Den kan derfor godt forekomme, selv om der i ASL-sporet aldrig er sket nogen faktisk kapitalisering.

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
- hvis beregningsdatoen ligger inden for eller præcis 2 år til folkepension, og beregningsdatoen er før folkepensionsdatoen, fratrækkes de resterende løbende ydelser frem til dagen før folkepensionsdatoen
- hvis beregningsdatoen ligger mere end 2 år før folkepension, proformakapitaliseres hele rest-EET på beregningsdatoen

---

## Del 2 — AI-agent: teknisk reference

### Primær fil

`src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts`

### Interne hjælpefunktioner

| Funktion | Beskrivelse |
|---|---|
| `computeProformaKapitalisering(args, issues)` | Proformaberegning på beregningsdatoen |
| `computeResterendeLoebendeYdelser(args, issues)` | Opgør resterende løbende ydelser frem til folkepensionsalderen ved beregningsdato inden for 2-årsgrænsen |
| `resolveLoebendeEetPct(afgoerelser, kapitaliseringer)` | Bestemmer tilbageværende løbende EET-procent |
| `skalFradragForetages(afgoerelseType, skadedato)` | Afgør om en afgørelse skal fratrækkes |
| `computeTilbagevirkendeKraftFradrag(midlertidig, endeligVirkningsdato)` | Beregner fradraget når en endelig afgørelse gør midlertidig ydelse endelig med tilbagevirkende kraft (toggle) |

### Implementeringsstatus

Dokumentationen ovenfor beskriver den fastlagte forretningslogik.
Dokumentationen beskriver den implementerede forretningslogik. Hvis dokumentation og kode afviger, er denne fil den normative beskrivelse af forretningslogikken.

### Fradrag 3-specifikke issue-ID'er

Se [fejlkatalog.md](./fejlkatalog.md) for komplet beskrivelse.

---

## Kendte udeståender

Dokumentationen afspejler den fastlagte forretningslogik for differencekrav.
