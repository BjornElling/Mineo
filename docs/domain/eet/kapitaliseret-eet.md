# Kapitaliseret EET — ASL (fane 3)

Denne fil beskriver beregningslogikken for kapitalisering af erhvervsevnetab efter Arbejdsskadesikringsloven (ASL). Beregningen udgør fane 3 på EET-siden.

Se også:
- [loebende-eet.md](./loebende-eet.md) — fane 2
- [eal-beregning.md](./eal-beregning.md) — fane 4
- [differencekrav.md](./differencekrav.md) — fane 5
- [fejlkatalog.md](./fejlkatalog.md) — alle fejl og advarsler
- [under-to-aar-til-fp.md](./under-to-aar-til-fp.md) — særregel for ≤ 2 år til folkepensionsalderen

---

## Del 1 — For dig

### Hvad beregner denne fane?

Fane 3 beregner et éngangsbeløb for det erhvervsevnetab, der kapitaliseres. Kapitaliseringen er en konvertering fra løbende ydelse til et kapitalbeløb beregnet som årsydelsen ganget med en aldersafhængig faktor fra kapitaliseringsbekendtgørelsen.

Kun `Endelig` og `Delvist endelig` kan kapitaliseres. `Midlertidig` kan ikke.

Særreglen ved ≤ 2 år til folkepensionsalderen gælder kun for `Endelig`:
- Ved `Endelig` og afgørelsesdato inden for eller præcis 2 år før folkepension skal hele erhvervsevnetabet kapitaliseres.
- Ved `Endelig` og afgørelsesdato mere end 2 år før folkepension gælder de almindelige kapitaliseringsregler fortsat.
- Ved `Delvist endelig` kapitaliseres kun den indtastede andel. Den skal være mindre end det fulde EET og højst 50 %.

### Statiske datakilder

Kapitaliseringsberegningen bruger to typer statiske data:

**Bekendtgørelsesoversigten** (`src/data/kapitalisering/kapitaliseringsbekendtgørelser.ts`):
En matrix der for en given kombination af skadedato og kapitaliseringsdato slår op, hvilken bekendtgørelse eller vejledning der gælder.

**Kapitaliseringstabellerne** (`src/data/kapitalisering/kapitaliseringsTabeller/`):
Én TypeScript-fil per bekendtgørelse. Hver fil indeholder:
- tabelvalgsdata: skadedato og fødselsdato → tabelbogstav og folkepensionsalder
- alderstabeller: alder → faktor
- særfaktor for skadelidte inden for eller præcis 2 år til folkepension

### Trin-for-trin beregning

#### Trin 0 — Forhåndsvurdering: er skadelidte ≤ 2 år fra folkepensionsalderen?

Inden det ordinære tabelopslag vurderes om skadelidte er ≤ 2 år fra sin folkepensionsalder på kontroltidspunktet:
- normalt: afgørelsesdatoen
- ved genoptagelse: den tidligere kapitaliseringsdato

Fremgangsmåde:
1. Find bekendtgørelsen gældende på kontroltidspunktet.
2. Slå folkepensionsalderen op i denne bekendtgørelses tabelvalgsdata.
3. Beregn alder på kontroltidspunktet i hele år og måneder.
4. Hvis `folkepensionsalder_måneder − alder_måneder ≤ 24`: brug særfaktoren direkte.

Hvis særfaktoren bruges direkte, er kapitaliseringsfaktoren lig særfaktoren afrundet til 3 decimaler. Skadelidte der allerede har nået folkepensionsalderen falder også ind under særfaktoren.

Denne vurdering siger kun noget om faktoren. Om der overhovedet skal ske kapitalisering, afhænger af afgørelsestypen og hovedreglen:
- `Endelig` inden for eller præcis 2 år før folkepension: hele EET kapitaliseres.
- `Endelig` mere end 2 år før folkepension: de almindelige kapitaliseringsregler gælder fortsat.
- `Delvist endelig`: kun den indtastede andel kapitaliseres.

#### Trin 1 — Valg af bekendtgørelse

Opslagsgrundlaget bestemmes af:
1. tidligere kapitaliseringsdato ved genoptagelse
2. ellers kapitaliseringsdatoen

Ved genoptagelse foretages bekendtgørelsesvalg, tabelvalg og faktorberegning som om kapitaliseringen skete på den tidligere kapitaliseringsdato. Regulering sker dog til kalenderåret for den nye kapitaliseringsdato.

#### Trin 2 — Valg af tabel og folkepensionsalder

Inden for den fundne bekendtgørelse opslås tabel og folkepensionsalder på baggrund af skadedato og fødselsdato.

For bekendtgørelser før 2015-03-01 er tabellerne kønsopdelte. Her skal køn være angivet.

#### Trin 3 — Grundydelse og regulering

Grundydelsen beregner årsydelsen for de kapitaliserede procentpoint:

```
grundydelse = round2(grundløn × kap_pct × erstatningsniveau × amFaktor)
```

Regulering til kapitaliseringstidspunktet er et direkte tabelopslag:

```
årsydelse = round2(effektiv_grundydelse × reguleringsfaktor[kapitaliseringsår])
```

Årsydelsen afrundes til 2 decimaler. Der sker ikke `ceil12`-oprunding som ved løbende ydelser.

#### Trin 4 — Kapitaliseringsfaktor

Faktoren bestemmes af skadelidtes alder på kapitaliseringstidspunktet og afhænger af om skaden er før eller efter 01-07-2007.

- Inden for tabellen: interpolation efter de almindelige regler.
- Over tabellens maksimum, men stadig mere end 2 år fra folkepension: lineær ekstrapolation mod særfaktoren.
- Inden for eller præcis 2 år til folkepension: særfaktoren direkte.

Ved månedsafhængige tabeller betyder "over tabellens maksimum" også tilfælde, hvor tabellen slutter på et helt år, men skadelidte er ældre end dette med ekstra måneder.
Eksempel: Hvis tabellen slutter ved 64 år, er `64 år, 2 måneder` ikke lig faktor-rækken for 64 år; der skal i stedet interpoleres videre mod særfaktoren frem til 2-årsgrænsen før folkepension.

Kapitaliseringsfaktoren afrundes til 3 decimaler.

#### Trin 5 — Kapitalbeløb

```
kapitalbeløb = ceil0(årsydelse × kapitaliseringsfaktor)
```

Afrunding: op til nærmeste hele krone.

### Kapitaliseringsdato ved særreglen

Når en `Endelig` afgørelse er inden for eller præcis 2 år før folkepension, skal kapitaliseringsdatoen være lig afgørelsesdatoen.

---

## Del 2 — AI-agent: teknisk reference

### Primær fil

`src/domain/erhvervsevnetab/eetKapitaliseringCalculation.ts`

### Internt flow

1. `collectResolvedRows()` filtrerer rækker med `Endelig` og `Delvist endelig`. Ved `Endelig` inden for `≤ 2 år` kan rækken også indgå uden manuel kapitaliseringsindtastning, fordi hele EET kapitaliseres automatisk på afgørelsesdatoen.
2. For hver række beregnes kontroltidspunkt, tabelvalg, alder og eventuel særfaktor.
3. Regulering, årsydelse og kapitalbeløb beregnes.

### Implementeringsstatus

Dokumentationen ovenfor beskriver den fastlagte forretningslogik.
Dokumentationen beskriver den implementerede forretningslogik. Hvis dokumentation og kode afviger, er denne fil den normative beskrivelse af forretningslogikken.

### Tests

`src/__tests__/domain/erhvervsevnetab/eetKapitaliseringCalculation.test.ts`

Dækker kapitaliseringsberegningen, herunder særreglen for `Endelig` ved `≤ 2 år` til folkepension.

---

## Kendte udeståender

Dokumentationen afspejler den fastlagte forretningslogik for kapitalisering.
