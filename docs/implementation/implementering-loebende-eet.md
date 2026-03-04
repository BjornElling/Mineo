# Implementering — Løbende EET (ASL)

Denne fil beskriver implementeringen af løbende erhvervsevnetab (ASL, fane 2).

For kapitaliseret erhvervsevnetab, se: `docs/implementation/implementering-kapitaliseret-eet.md`.

---
> Arbejdsdokument for planlægning og implementering af Erhvervsevnetab-siden.
> Opdateres løbende i denne tråd.

---

## Status

Erhvervsevnetab-siden er under aktiv implementering. Fane 2 (Løbende ydelser) er implementeret.

Sektion 8 (løbende ydelser) er dokumenteret og verificeret mod konkrete beregningseksempler, herunder fuldt layout for fane 2. Følgende sektioner mangler stadig dokumentation:
- Sektion 9: Kapitalisering (fane 3)
- Sektion 10: Differencekrav (fane 5)

Fane 2 er fuldt specificeret — ingen uafklarede punkter.

---

## 1. Implementeringsregler

### Filens formål
Denne fil er en komplet, selvstændig implementeringsspecifikation for Erhvervsevnetab-siden. Den skal indeholde tilstrækkelig information til at siden og al beregningslogik kan udvikles fuldt autonomt uden yderligere afklaring.

### Filens opbygning
Filen bygges op løbende i en dedikeret tråd. Alt indhold skrives ind under de relevante sektioner efterhånden som det modtages. Sektioner oprettes eller omdøbes løbende efter behov.

### Afhængighed af regulationRates
Alle beregninger på EET-siden — både efter ASL og efter EAL — som beror på regulerede beløb eller satser, skal hente disse fra `regulationRates`. Der må ikke gemmes selvstændige talværdier i EET-systemet. EET-siden er en forbruger af `regulationRates`, ikke en kilde til egne satser.

### Isolation fra øvrige EET-forekomster i programmet
EET forekommer tre steder i programmet. Der må aldrig ske sammenblanding eller dataudveksling mellem dem — hverken i state, beregningslogik eller UI:

1. **EET-siden** (dette dokument) — beregner og opgør EET fuldt ud.
2. **Stamdata-siden** — giver mulighed for at angive om der er truffet midlertidig eller endelig EET-afgørelse. Denne oplysning er udelukkende et stamdata-felt og har ingen kobling til EET-sidens beregninger.
3. **Siden med offentlige ydelser** — giver mulighed for at indtaste værdier for midlertidig EET som en ydelse. Disse værdier tilhører den siden og dens beregningslogik udelukkende.

Alt hvad der hører til EET-siden forbliver på EET-siden. Ingen state, logik eller data flyder mellem de tre forekomster.

Undtagelse: EET-siden er forbruger af stamdata på lige fod med resten af programmet. Se afsnit om stamdata-afhængighed.

### Stamdata-afhængighed
EET-siden læser alle felter fra `stamdataSchema`:

| Felt | Bruges til |
|---|---|
| `skadelidte` | PDF-brevhoved og visning |
| `skadesdato` | Dato-grænser, beregninger |
| `skadestype` | Beregningsregler (arbejdsulykke vs. erhvervssygdom) |
| `journalnr` | PDF-brevhoved |
| `advokat` | PDF-brevhoved |
| `sagsbehandler` | PDF-brevhoved |
| `fodselsdato` | Folkepensionsalder-opslag, aldersberegning |

EET-siden skriver ikke til stamdata — den er udelukkende læsende.

#### Fødselsdato — delt felt mellem varige mén og EET
`fodselsdato` gemmes i `stamdataSchema` (ikke i `varigeMenSchema`). Feltet indtastes af brugeren på to steder:

- **Varige mén-siden**: inputfelt som hidtil — skriver til `stamdata`-storen
- **EET-siden (fane 1)**: identisk inputfelt — skriver til samme felt i `stamdata`-storen

De to inputfelter deler den samme underliggende værdi. En ændring på én side slår øjeblikkeligt igennem på den anden. Dato-grænser og validering er identiske for begge felter (min: 1900-01-01, max: dags dato — samme som den nuværende `dateRanges_varigemen.fodselsdato`).

### Arbejdsproces
Claude og Codex er aktive medspillere i opbygningen: stiller opsøgende spørgsmål, identificerer huller og presser på for præcision. Særligt vigtigt ved beregningslogik: alle tænkelige edge cases skal identificeres og afklares eksplicit, inden de betragtes som dokumenterede. Filen må ikke indeholde tvetydigheder eller uafklarede scenarier.

### Forbud mod antagelser om beregningslogik
Al beregningslogik kommer udelukkende fra brugeren. Claude og Codex må ikke under nogen omstændigheder selv antage, udlede eller konstruere beregningsregler. Ved den mindste usikkerhed skal der spørges. Edge cases skal aktivt opsøges og udfordres, og ingen beregningsregel betragtes som afklaret, før alle tænkelige edge cases er eksplicit behandlet.

---

## 2. Synlighed under udvikling

Den nye EET-side skal være tilgængelig i development-mode, men usynlig for brugere i produktion.

- I `development` (`import.meta.env.DEV === true`): Den fulde EET-side vises.
- I `production`: Placeholder-siden med teksten "kommer" vises uændret.

Der er kun én udvikler, så environment-flag er tilstrækkeligt — ingen behov for `.env.local`-variable eller brugerstyrede flags.

---

## 3. Begrebsafklaring

### EET / Erhvervsevnetab
**EET** er en forkortelse for **Erhvervsevnetab**. De to udtryk er synonyme. I denne specifikation og i koden bruges EET som arbejdsbetegnelse. I brugerfladen — alt hvad brugeren præsenteres for — bruges konsekvent det fulde ord **Erhvervsevnetab**, aldrig forkortelsen. Undtagelse: fanenavne, hvor forkortelser bruges af pladshensyn.

### ASL / Arbejdsskadesikringsloven
**ASL** er forkortelse for **Arbejdsskadesikringsloven**. Når EET omtales uden lovhenvisning, forstås altid EET efter ASL. ASL er dermed standardloven i denne kontekst.

### EAL / Erstatningsansvarsloven
**EAL** er en forkortelse for **Erstatningsansvarsloven**. I denne specifikation og i koden bruges EAL. I brugerfladen bruges konsekvent det fulde ord **Erstatningsansvarsloven**, undtagen i fanenavne.

### EET efter ASL vs. EET efter EAL

Begge love bruger betegnelsen "erhvervsevnetab" og dækker samme tab, men beregningsprincipperne er fundamentalt forskellige:

| | EET efter ASL | EET efter EAL |
|---|---|---|
| Grundform | Løbende ydelse | Kapitaliseret (engangsbetaling) |
| Kan kapitaliseres | Ja — helt, delvist, eller automatisk | Ikke relevant — altid kapitaliseret |
| Løbende ydelse mulig | Ja | Nej |
| Indgår i differencekrav | Ja (endeligt EET) | Ja (som sammenligningsgrundlag) |

EET efter ASL er standardformen. EET efter EAL beregnes særskilt og bruges primært til at afgøre om der foreligger et differencekrav.

### Midlertidigt vs. endeligt erhvervsevnetab (ASL)
Gælder udelukkende EET efter ASL. Begge typer beregnes ens og udbetales løbende.

| | Midlertidigt EET | Endeligt EET |
|---|---|---|
| Beregning | Identisk | Identisk |
| Udbetaling | Løbende | Løbende |
| Kan kapitaliseres | Nej | Ja |
| Indgår i differencekrav | Nej | Ja |

### Differencekrav
Differencekravet er forskellen mellem EET efter EAL og EET efter ASL, når EAL-beregningen er den største. Hvis ASL-erstatningen er større end eller lig med EAL-erstatningen, er der intet differencekrav.

### Kapitaliseringsdato
Den dato hvorfra kapitaliseringen beregnes. Angives manuelt af brugeren. Kapitaliseringsdatoen er ikke nødvendigvis lig med afgørelsesdatoen — typisk vil den være den 1. i næstkommende måned efter afgørelsesdatoen. Kapitaliseringsdatoen fastsættes på samme måde uanset hvilken beregningsregel der anvendes.

### Bkg / Vejl — bekendtgørelse og vejledning
**bkg** er forkortelse for **bekendtgørelse**. **vejl** er forkortelse for **vejledning**. Modsat de øvrige forkortelser i projektet bruges disse i brugerfladen (UI-tekst). Forkortelsen **vej** forekommer også som synonym for vejledning i eksterne kilder — programmet skal kunne håndtere denne variant ved indlæsning, men den kanoniske forkortelse i kode og UI er altid **vejl**.

### Folkepensionsalder / FP
Alle skadelidte har en folkepensionsalder, der afhænger af deres fødselsdato. Denne mapping gemmes i en særskilt fil i `src/data/`.

Forkortelsen **FP** bruges i EET-konteksten om **folkepensionsalderen**. Bemærk at FP andre steder i programmet bruges om **feriepenge** — de to må ikke forveksles. FP i kode og kommentarer inden for EET-systemet betyder altid folkepensionsalder.

---

## 4. Brugerflade

### Fanestruktur

Siden er organiseret med faner. Brugeren lander på fane 1. Fanenavne bruger forkortelser af pladshensyn.

| # | Fanenavn | Vedrører | Indhold |
|---|---|---|---|
| 1 | EET oplysninger | ASL + EAL | Fælles inputfelter (se nedenfor) |
| 2 | Løbende ydelser | ASL | Beregning af løbende EET-ydelse |
| 3 | Kapitalisering | ASL | Kapitalisering af endeligt EET |
| 4 | EET efter EAL | EAL | Beregning af det fulde kapitaliserede krav efter EAL |
| 5 | Differencekrav | EAL vs. ASL | Opgørelse af difference, hvis EAL > ASL |

### Input vs. visning

**Fane 1** er den eneste fane med inputfelter. Alle øvrige faner (2–5) er rene visningsfaner — read-only præsentation af mellemregninger og resultater.

**Fane 2–5** har hver en download-knap nederst. Knappen er identisk med den standardiserede download-knap der bruges alle andre steder i programmet (en klikbar boks med `Download`-ikonet fra MUI, 32×32px, borderradius 6px, hover/active states med blå baggrund). Et tryk genererer en PDF med beregningerne fra den pågældende fane. Mellemregningerne fra de enkelte faner indgår desuden i den samlede EO-PDF.

### Fane 1 — EET oplysninger (inputfelter)

Alle rækker i fane 1 er hover-rows.

#### ContentBox: Stamdata

| Felt | Type | Grænser | Noter |
|---|---|---|---|
| Fødselsdato | Datofelt | Min: 1900-01-01, max: dags dato | Identisk med fødselsdagsfelt på varige mén-siden. Skriver til `stamdata`-storen. |
| Beregningsdato | Datofelt | Min: skadesdato (fallback: 2005-01-01), max: DATE_EET_MAX | Den dato løbende ydelser opgøres frem til, EET efter EAL opgøres per, og differencekrav opgøres per. |

#### ContentBox: ASL

**Øverste række:**

| Felt | Type | Grænser | Noter |
|---|---|---|---|
| Årsløn | Beløbsfelt | Min: 1.000 kr., max: 9.999.999 kr. | |

**Underoverskrift: Afgørelser**

Loose grid table med automatisk tilføjelse af nye rækker i takt med indtastning. Ubegrænset antal rækker. Kolonner:

| # | Kolonneoverskrift | Felttype | Grænser | Noter |
|---|---|---|---|---|
| 1 | Afgørelsesdato | Datofelt | Min: skadesdato (fallback: 2005-01-01), max: min(DATE_EET_MAX, beregningsdato hvis udfyldt) | |
| 2 | Virkningsdato | Datofelt | Min: skadesdato (fallback: 2005-01-01), max: min(DATE_EET_MAX, beregningsdato hvis udfyldt) | Den dato de løbende ydelser begynder. Kan ligge før eller efter afgørelsesdatoen. |
| 3 | EET % | Procentfelt | Min: 0 %, max: 100 %. Kun heltal. Skal være deleligt med 5 — ellers fejlmeddelelse. 0 % behandles som tomt felt. Hvis der findes tidligere afgørelser med udfyldt kap. %, skal EET % være større end summen af disse kap. %-værdier. | |
| 4 | Afgørelsestype | Dropdown | — | Valgmuligheder: `Midlertidig`, `Delvist endelig`, `Endelig`. Ved `Delvist endelig`: kolonne 3 (EET %) angiver den samlede procent; kolonne 6 (Kapitaliseringsprocent) angiver den endelige andel der kapitaliseres. Den midlertidige andel er implicit forskellen. |
| 5 | Kapitaliseringsdato | Datofelt | Min: afgørelsesdato (fallback: 2005-01-01), max: min(DATE_EET_MAX, beregningsdato hvis udfyldt) | Redigerbar. Viser fejlmeddelelse hvis udfyldt og afgørelsestype er `Midlertidig`. |
| 6 | Kapitaliseringsprocent | Procentfelt | Se nedenfor | Redigerbar. Kun heltal deleligt med 5 — ellers fejlmeddelelse. Se valideringsregler nedenfor. |
| 7 | Evt. tidl. kap.dato, hvis genoptaget | Datofelt | Min: skadesdato (fallback: 2005-01-01), max: dagen før afgørelsesdato | Udfyldes kun ved genoptagne afgørelser. Indeholder kapitaliseringsdatoen fra den ophævede afgørelse. Bruges som opslagsgrundlag for bekendtgørelsesvalg i stedet for den aktuelle kapitaliseringsdato. |

**Valideringsregler for kolonne 6 (Kapitaliseringsprocent):**

Alle kolonner er altid frit tilgængelige for input — ingen felter låses eller deaktiveres baseret på andre felters værdier. Fejl vises som fejlmeddelelse direkte på feltet. Fejl der forhindrer en given beregning vises desuden i statusboksen på den relevante fane og blokerer download på den pågældende fane.

Når EET % er tomt eller 0 (behandles som tomt) er kapitaliseringsprocent-reglerne der afhænger af EET %-værdien suspenderet — de aktiveres først når EET % er udfyldt med en reel værdi.

Ved max-kontrol af kapitaliseringsprocent for en afgørelse (50 %-loftet og EET %-loftet) skal værdien i den aktuelle række vurderes kumulativt med kapitaliseringsprocenter fra alle rækker med **tidligere afgørelsesdato**, hvor `Kap. %` er udfyldt. Dvs. kontrollen sker på:

`aktuel kap. % + sum(kap. % fra tidligere afgørelser)`

Rækker med samme eller senere afgørelsesdato indgår ikke i denne max-kontrol.

| Afgørelsestype | Betingelse | Fejlregel |
|---|---|---|
| `Midlertidig` | Feltet er udfyldt | Fejl: kapitalisering ikke mulig ved midlertidig afgørelse |
| `Endelig` | EET % udfyldt og < 50 %, og samlet kapitaliseringsprocent (aktuel + tidligere kapitaliseringsprocenter) ≠ EET % | Fejl: tvungen fuld kapitalisering ved endeligt EET under 50 % |
| `Endelig` | EET % udfyldt og ≥ 50 %, og kapitaliseringsprocent > 50 % | Fejl: kapitalisering kan højst udgøre 50 % |
| `Endelig` | Kapitaliseringsprocent > EET % | Fejl: kapitalisering kan ikke overstige EET % |
| `Delvist endelig` | Feltet er tomt | Fejl: kapitaliseringsprocent er påkrævet ved delvist endelig afgørelse |
| `Delvist endelig` | Kapitaliseringsprocent < 5 % | Fejl: mindste kapitaliserbare andel er 5 % |
| `Delvist endelig` | Kapitaliseringsprocent > min(EET % − 5, 50 %) | Fejl: kapitaliseret andel overstiger tilladt maksimum (der skal restere mindst 5 % som midlertidig, og kapitalisering kan højst udgøre 50 %) |
| `Delvist endelig` | Kapitaliseringsprocent > EET % | Fejl: kapitalisering kan ikke overstige EET % |
| `Endelig` / `Delvist endelig` | Kapitaliseringsdato < afgørelsesdato | Fejl: kapitaliseringsdato kan ikke være før afgørelsesdato |

**Opslagslogik for kapitaliseringsdato — bekendtgørelsesvalg:**

For hver afgørelsesrække gælder følgende prioriterede logik ved valg af bekendtgørelse til kapitaliseringsberegningen:

1. Hvis kolonne 7 (tidligere kap.dato) er udfyldt → opslag på denne dato
2. Ellers hvis kolonne 5 (kapitaliseringsdato) er udfyldt → opslag på denne dato
3. Ellers → opslag på kolonne 1 (afgørelsesdato) som fallback

#### ContentBox: EAL

ASL-værdierne bruges som default i EAL-beregningerne. Felterne nedenfor er overrides — udfyldes kun hvis EAL-beregningen afviger fra ASL.

| Felt | Type | Grænser | Noter |
|---|---|---|---|
| Årsløn (hvis forskellig fra ASL) | Beløbsfelt | Min: 1.000 kr., max: 9.999.999 kr. | Hvis tomt bruges ASL-årslønen. |
| EET %, hvis afviger fra ASL | Procentfelt | Min: 0 %, max: 100 %. Kun heltal deleligt med 5 — ellers fejlmeddelelse. | Hvis tomt bruges EET-procenten fra ASL efter fallback-reglen i sektion 7. 0 % behandles som tomt felt. |

### EETMaxDato

`DATE_EET_MAX` i `dateRanges.ts` er den 31. december i det seneste år der opfylder **begge** nedenstående betingelser:

1. `regulationRates` har komplet dækning for alle fire: `aarsloenMax`, `reguleringsprocentErhvervsevnetabFra2024`, `erhvervsevnetabMax` og `reguleringssats`.
2. Der eksisterer en gyldig kapitaliseringsbekendtgørelse for alle skadesdato-intervaller (dvs. årstallet er ≤ `eetKapitaliseringsDatoMaxFraBekendtgoerelser`).

Beregnes via `eetYearBounds` i `regulationRates.ts` som `Math.min(rate-intersection, bekendtgoerelserMaxYear)`. Bruges som øvre grænse for dato-felter på EET-siden. Opdateres automatisk når ny data tilføjes i `regulationRates` **og** `kapitaliseringsbekendtgørelser.ts`.

### Inputvalidering — grænser og blokering

Alle inputfelter på EET-siden (fane 1) er altid frit tilgængelige for input — ingen felter låses eller deaktiveres baseret på andre felters værdier. Overskrides en grænse eller overtrædes en valideringsregel:

- Feltet markeres med rød kant.
- Der vises en relevant tooltip-meddelelse på feltet.

Fejl der forhindrer en beregning på fane 2–5 vises desuden i statusboksen på den relevante fane og blokerer download på den pågældende fane (se afsnit om download-blokering).

### Download-blokering og statusboks (fane 2–5)

Alle beregningsfaner (fane 2–5) følger samme overordnede layoutstruktur, undtagen fane 1 (EET oplysninger):

1. **"Fejl og advarsler"** (`ContentBox`) øverst.
   - Vises kun når der findes mindst én fejl/advarsel.
   - Fejl vises med `ErrorOutline` (rød), advarsler med `WarningAmber` (orange).
   - Hver linje er en hoverrow.
2. **"Beregning"** (`ContentBox`) under fejl/advarsler.
   - Øverste linje er altid **Beregningsdato**.
   - Linjen under er **Download specifikation**.
   - Begge linjer er hoverrows.
3. **"Specifikation"** (`ContentBox`) under "Beregning".
   - Indeholder den detaljerede beregningsspecifikation/mellemregninger.
   - Alle linjer er hoverrows.

Fejlmeddelelser (blokerer download) vises hvis ét eller flere inputfelter der er nødvendige for den pågældende fanes beregning enten (a) har en ugyldig værdi (overskredet grænse) eller (b) mangler at blive udfyldt.

Advarselsbeskeder (blokerer ikke download) vises i særlige situationer defineret per fane.

Ikke alle inputfelter er nødvendige for alle faner. Hvilke felter der er nødvendige for hvilken fane specificeres per fane (se afsnit om de enkelte faner).

Download er deaktiveret så længe der er aktive fejlmeddelelser. Advarsler deaktiverer ikke download.

Ikonerne (`ErrorOutline`, `WarningAmber`) og `ContentBox`-komponenten er de samme som bruges på `EOberegningTab`.

---


## 8. Beregningslogik — løbende EET-ydelser (ASL, fane 2)

### Overblik

Løbende ydelser beregnes pr. afgørelse. Hver afgørelse producerer én eller to ydelsessektioner:

- **Fuld sektion**: fra virkningsdatoen til og med ophørsdatoen for den fulde EET (dagen før kapitaliseringsdatoen, eller dagen før næste afgørelses virkningsdato, eller beregningsdatoen — se periodeafgrænsning).
- **Rest-sektion**: fra kapitaliseringsdatoen til ophøret af den løbende ydelse, hvis der er en delvis kapitalisering. Gælder kun hvis rest-EET > 0.

Inden for hver sektion opdeles output i kalenderårs-rækker, fordi den løbende ydelse reguleres pr. 1. januar hvert år.

---

### Stamdata og faste konstanter

| Konstant | Værdi | Kilde |
|---|---|---|
| `aslMaxAarsloen2003` | 367.000 kr. | Fast konstant i `regulationRates` — maks. årsløn pr. 1/1-2003 |
| `aslMaxAarsloen2024` | 608.000 kr. | Fast konstant i `regulationRates` — maks. årsløn pr. 1/1-2024 |
| Erstatningsniveau, skade fra 01-01-2011 | 83 % | Fast konstant |
| Erstatningsniveau, skade før 01-01-2011 | 80 % (4/5) | Fast konstant |
| AM-bidragssats | 8 % | Fast konstant — fratrækkes kun ved skade fra 01-01-2011 eller senere |

Disse konstanter gemmes som navngivne konstanter i `regulationRates.ts`. De ændrer sig aldrig.

---

### Trin 1 — Grundløn

Grundlønnen beregnes **én gang per skade** og er uforanderlig. Den beregnes enten i **2003-niveau** (skade før 01-07-2024) eller **2024-niveau** (skade fra 01-07-2024).

**Skade før 01-07-2024 (2003-niveau):**
```
grundløn = round0(årsløn × (aslMaxAarsloen2003 / aarsloenMax[skadesår]))
```

**Skade fra 01-07-2024 (2024-niveau):**
```
grundløn = round0(årsløn × (aslMaxAarsloen2024 / aarsloenMax[skadesår]))
```

`aarsloenMax[skadesår]` er maksimum-årsløn for det kalenderår skadesdatoen falder i (ingen splitdato — altid ét tal per kalenderår).

**Afrunding:** til nærmeste hele krone (0 decimaler, "half away from zero").

---

### Trin 2 — Grundydelse

Grundydelsen beregnes pr. afgørelse og er ligeledes uforanderlig. Den beregnes altid i det samme niveau som grundlønnen (2003- eller 2024-niveau).

**Skade fra 01-01-2011 eller senere (erstatningsniveau 83 %, AM-bidrag fratrækkes):**
```
grundydelse = round2(grundløn × eet_pct × 0,83 × 0,92)
```

**Skade før 01-01-2011 (erstatningsniveau 80 %, intet AM-bidragsfradrag):**
```
grundydelse = round2(grundløn × eet_pct × 0,80)
```

`eet_pct` er afgørelsens EET-procent som decimaltal (fx 0,45 for 45 %).

**Afrunding:** til 2 decimaler ("half away from zero").

**Ved delvis kapitalisering** beregnes to grundydelser pr. afgørelse:
- `grundydelse_fuld`: baseret på afgørelsens effektive EET før aktuel kapitalisering
- `grundydelse_rest`: baseret på rest-EET efter aktuel kapitalisering

Effektiv EET før aktuel kapitalisering:
```
eet_pct_foer_aktuel_kap = afgørelsens_eet_pct − sum(tidligere_kapitaliseringsprocenter)
```

Rest-EET efter aktuel kapitalisering:
```
rest_eet_pct = eet_pct_foer_aktuel_kap − aktuel_kapitaliseringsprocent
```

Rest-grundydelsen er altid proportional:
```
grundydelse_rest = grundydelse_fuld × (rest_eet_pct / eet_pct_foer_aktuel_kap)
```

Reduktionen gælder altid fra kapitaliseringsdatoen, uanset om kapitalisering sker før eller fra 01-01-2024.

Ved skade før 01-07-2024 gælder derudover:
- Hvis kapitalisering sker før 01-01-2024, er det den reducerede 2003-grundydelse der opreguleres til 2024-niveau.
- Hvis kapitalisering sker fra 01-01-2024 eller senere, beregnes rest-grundydelsen først proportionalt i 2003-niveau, og denne rest-grundydelse opreguleres derefter til 2024-niveau.

---

### Trin 3 — Årsydelse for et givent beregningsår

Årsydelsen for et givent kalenderår Y beregnes ud fra grundydelsen ved at gange med én opreguleringsfaktor. Faktoren afhænger af grundlønsniveauet og beregningsåret:

#### Skade før 01-07-2024 (grundydelse i 2003-niveau)

| Beregningsår Y | Formel |
|---|---|
| Y ≤ 2023 | `grundydelse × (1 + reguleringsprocentErhvervsevnetab[Y] / 100)` |
| Y = 2024 | `grundydelse × (1 + reguleringsprocentErhvervsevnetabFoer2024[2024] / 100)` = `grundydelse × 1,657` |
| Y ≥ 2025 | `grundydelse × 1,657 × (1 + reguleringsprocentErhvervsevnetabFra2024[Y] / 100)` |

For Y ≥ 2025 udføres de to multiplikationer separat i denne rækkefølge:
1. `grundydelse × (1 + 65,7/100)` → melllemresultat i 2024-niveau
2. `mellemresultat × (1 + reguleringsprocentErhvervsevnetabFra2024[Y] / 100)` → årsydelse

Afrunding til nærmeste 12-delelige sker **efter** 2024-mellemresultatet er afrundet til 2 decimaler og derefter multipliceret med satsen fra 2024-regimet.

#### Skade fra 01-07-2024 (grundydelse i 2024-niveau)

| Beregningsår Y | Formel |
|---|---|
| Y = 2024 | `grundydelse × (1 + 0,0 / 100)` = `grundydelse × 1,000` |
| Y ≥ 2025 | `grundydelse × (1 + reguleringsprocentErhvervsevnetabFra2024[Y] / 100)` |

**Fejlbetingelse:** Mangler en nødvendig sats for beregningsåret Y, udløses fejl (se fejlhåndtering).

#### Afrunding af årsydelsen

Årsydelsen rundes **op** til nærmeste hele kronebeløb deleligt med 12:
```
årsydelse = ceil12(beregnet_årsydelse)
```
hvor `ceil12(x) = Math.ceil(x / 12) × 12`.

Der rundes **aldrig ned** i dette trin.

#### Månedlig ydelse

```
månedlig_ydelse = årsydelse / 12
```

Ingen yderligere afrunding — resultatet er altid et helt kronebeløb.

---

### Trin 4 — Periodeafgrænsning

#### Hvilken sats bruges for perioden?

Satsen (beregningsår Y) bestemmes af **enten afgørelsesåret eller virkningsåret**, afhængigt af deres indbyrdes relation:

| Situation | Beregningsår Y (sats) |
|---|---|
| Virkningsdato ≤ afgørelsesdato | Afgørelsesdatoens kalenderår |
| Virkningsdato > afgørelsesdato | Virkningsdatoens kalenderår |

Når virkningsdato = afgørelsesdato: brug afgørelsesdatoens kalenderår (de er identiske).

#### Periodeopbygning for en afgørelses fulde sektion

Perioden løber fra virkningsdatoen til og med ophørsdatoen (se nedenfor). Den opdeles i kalenderårs-rækker med følgende logik:

1. **Første række**: fra virkningsdatoen til og med den sidste dag i virkningsårets kalenderår (eller til ophørsdatoen hvis ophøret er i samme år). Satsen er beregningsåret Y som ovenfor.
2. **Mellemliggende rækker**: hele kalenderår (01-01 til 31-12). Satsen er det pågældende kalenderår.
3. **Sidste række**: fra 01-01 i ophørsåret til og med ophørsdatoen (eller hele kalenderåret hvis ophøret er 31-12). Satsen er ophørsårets kalenderår.

**Undtagelse ved tilbagevirkende kraft**: Hvis virkningsdatoen er i et tidligere kalenderår end afgørelsesdatoen, gælder afgørelsesårets sats for **hele perioden frem til 31-12 i afgørelsesåret** — dvs. perioden fra virkningsdatoen til 31-12 i afgørelsesåret samles i én række med afgørelsesårets sats. Fra 01-01 det følgende år reguleres normalt.

#### Ophørsdato for en afgørelses fulde sektion

Ophørsdatoen er den **tidligste** af følgende datoer, der er relevante for den aktuelle afgørelse:

1. Beregningsdatoen (altid relevant — den absolut seneste mulige dato).
2. Dagen **før** næste afgørelses virkningsdato (relevant hvis der er en efterfølgende afgørelse).
3. Dagen **før** kapitaliseringsdatoen (relevant hvis afgørelsen er fuldt kapitaliseret — dvs. rest-EET = 0).
4. Dagen **før** den dato der er 2 år før skadelidtes folkepensionsalder (relevant ved tvungen kapitalisering).

Da ingen ophørsårsag har forrang over en anden, er det simpelthen den tidligste dato af dem alle, der gælder. Er der ingen kapitalisering og ingen efterfølgende afgørelse, løber den fulde sektion til beregningsdatoen.

#### Rest-sektionens periodeafgrænsning

Rest-sektionen starter på kapitaliseringsdatoen og løber til den tidligste af:

1. Beregningsdatoen.
2. Dagen før næste afgørelses virkningsdato.
3. Dagen før den dato der er 2 år fra folkepensionsalderen (tvungen kapitalisering).

Rest-sektionen opdeles ligeledes i kalenderårs-rækker med normal årsregulering (satsen bestemmes af kalenderåret).

---

### Trin 5 — Beregning af "Beregnet EET" pr. periode-række

For hver kalenderårs-række:

```
beregnet_eet = round0(måneder × månedlig_ydelse)
```

Måneder beregnes med `optaelMaanederPraecis` fra `periodiseringsMotor.ts` (tæller dage/dage-i-måneden for hver dag i perioden, summerer). Det præcise decimaltal bruges i beregningen — kun 4 decimaler vises i UI'et, men beregningen bruger det fulde flydetal.

**Afrunding:** til nærmeste hele krone (0 decimaler, "half away from zero").

#### Samlet EET for en afgørelse

Summen af alle "Beregnet EET"-beløb for alle rækker under den pågældende afgørelse (fuld + rest sektion). Ingen separat afrunding — summen af allerede afrundede tal.

#### Samlet total (I alt)

Én "I alt"-linje pr. afgørelse — summen af alle rækker for den afgørelse (fuld + rest sektion samlet). Ingen samlet total på tværs af afgørelser på fane 2.

Format: tom "Fra o.m."- og "Til o.m."-celle, tom "Mdr."-celle, tom "Ydelse/md."-celle, beløb i "Beregnet EET"-kolonnen.

---

### Kumuleret kapitaliseringslogik på tværs af afgørelser

Kapitaliseringsprocenter fra tidligere afgørelser fragår permanent i alle efterfølgende afgørelsers mulige løbende ydelse. Efterfølgende afgørelser skal derfor både i visning og beregning bruge et reduceret EET-grundlag før ny kapitalisering.

Den effektive EET før aktuel kapitalisering beregnes som:
```
eet_pct_foer_aktuel_kap = afgørelsens_eet_pct − sum(kapitaliseringsprocenter fra alle tidligere afgørelser)
```

Rest-EET efter aktuel kapitalisering beregnes som:

```
rest_eet_pct = eet_pct_foer_aktuel_kap − aktuel_kapitaliseringsprocent
```

**50 %-loftet:** Den samlede kapitaliseringsprocent på tværs af alle afgørelser kan aldrig overstige 50 % — med mindre der er tale om tvungen kapitalisering (≤ 2 år til FP), hvor loftet bortfalder.

**Eksempel:** Afgørelse 1 er delvist endelig med 45 % EET og 25 % kap. Afgørelse 2 er endelig med 75 % EET. Skadelidte har allerede fået 25 % kapitaliseret. Af de 75 % kan han vælge op til 25 % yderligere kapitaliseret (fordi 25 + 25 = 50 % maksimum). Rest-EET som løbende ydelse = 75 % − 50 % = 25 %.

**En afgørelses EET % er altid absolut** — den lægges aldrig oveni en tidligere afgørelses procent. En ny afgørelse på 75 % erstatter fuldt ud den tidligere på 45 %.

**To afgørelser kan aldrig overlappe i tid.** En ny afgørelse trumfer den tidligere afgørelse fra sin virkningsdato.

---

### Ophørslogik — folkepensionsalder og tvungen kapitalisering

**Folkepensionsalder (FP):** Slås op i `folkepensionsalder.ts` ud fra fødselsdato. FP-datoen er den dato skadelidte fylder folkepensionsalderen: `fødselsdato + FP-alder år`.

**Tvungen kapitaliseringsdato:** `FP-dato − 2 år`. Den løbende ydelse ophører dagen **før** denne dato.

Tvungen kapitalisering gælder for afgørelser af typen Endelig eller Delvist endelig — ikke for Midlertidig (midlertidige afgørelser kan pr. definition ikke kapitaliseres).

---

### Layout fane 2 — visningsstruktur

Fanen har følgende ContentBox-struktur i rækkefølge:

1. **"Fejl og advarsler"** (`ContentBox`) — vises kun hvis der er mindst én fejl eller advarsel.
2. **"Beregning"** (`ContentBox`) — tre faste linjer (se nedenfor).
3. **"Specifikation"** (`ContentBox`) — løbende ydelser pr. afgørelse (se nedenfor).
4. **"Udvidet specifikation"** (`ContentBox`) — grundløn og grundydelse (se nedenfor). Vises altid i UI.

#### ContentBox: Fejl og advarsler

Indeholder fejlmeddelelser og advarsler som hoverrows. Vises kun når der er mindst én linje. Fejl markeres med `ErrorOutline` (rød), advarsler med `WarningAmber` (orange). Indhold:

- **Fejlmeddelelser**: alle fejl fra "Fejl og advarsler"-listen (se afsnit om fejlbetingelser) der er relevante for beregningen på fane 2. Feltvalideringsfejl fra fane 1 gengives kun hvis de vedrører felter der indgår i beregningsgrundlaget for løbende ydelser.
- **Advarsel — årsløn svarer til maksimum**: vises hvis den benyttede ASL-årsløn svarer til maksimumårslønnen (`aarsloenMax`) for skadesåret. Samme advarselstekst som `warn-asl-aarsloen-is-max` på fane 4, men udløses udelukkende på baggrund af ASL-årslønnens relation til maks. — EAL-årsløn er irrelevant for fane 2.

#### ContentBox: Beregning

Tre linjer i fast rækkefølge, alle hoverrows:

| Venstre | Højre |
|---|---|
| Beregningsdato | dato i format `d. MMMM YYYY` |
| Medtag udvidet specifikation i PDF | toggle switch (standard: **fra/false**) |
| Download specifikation | download-ikon |

Toggle-linjen styrer kun om den udvidede specifikation skal med i PDF. UI-visningen af "Udvidet specifikation" er altid synlig.

Download er deaktiveret så længe der er aktive fejlmeddelelser (advarsler blokerer ikke).

#### ContentBox: Specifikation

Afgørelserne vises sekventielt i kronologisk rækkefølge (sorteret på afgørelsesdato). For hver afgørelse vises følgende blokke:

**Blok 1: Afgørelsesoverskrift og stamoplysninger**

Øverste linje er en overskrift/header der viser afgørelsesdatoen i format `d. MMMM YYYY` — fx "Afgørelse 1. juli 2023". Dernæst tre indrykkede hoverrows:

| Felt | Eksempel |
|---|---|
| Type | Midlertidig afgørelse / Endelig afgørelse / Endelig afgørelse (delvist kap.) / Delvist endelig afgørelse |
| Erhvervsevnetab | 75 % - 25 % tidligere kap. = 50 % *(hvis tidligere kapitalisering findes)*, ellers fx 45 % |
| Årsløn | 489.000 kr. |

Typebetegnelsen afhænger af afgørelsestypen:
- `Midlertidig` → "Midlertidig afgørelse"
- `Endelig` med kapitalisering og rest-EET > 0 → "Endelig afgørelse (delvist kap.)"
- `Endelig` med fuld kapitalisering (rest-EET = 0) → "Endelig afgørelse (kapitaliseret)"
- `Endelig` uden kapitalisering → "Endelig afgørelse"
- `Delvist endelig` → "Delvist endelig afgørelse"

**Blok 2: Periodeafgrænsning**

Underoverskrift "Periodeafgrænsning" efterfulgt af indrykkede hoverrows:

| Felt | Eksempel |
|---|---|
| Afgørelsesdato | 01-07-2023 |
| Virkningsdato | 01-02-2023 |
| Afgørelse med tilbagevirkende kraft? | Ja / Nej |

"Afgørelse med tilbagevirkende kraft?" vises som Ja hvis virkningsdatoen ligger før afgørelsesdatoen; ellers Nej. Vises altid (ikke skjult ved Nej).

**Blok 3: Ophørslinje**

Én hoverrow — ikke indsendt under en underoverskrift — med to kolonner:

| Venstre | Højre |
|---|---|
| Løbende ydelse ophører | ophørsdato i format `DD-MM-ÅÅÅÅ` |
| Ophør skyldes | årsagstekst (se nedenfor) |

Årsagstekst afhænger af hvilken ophørsårsag der gælder for afgørelsens fulde sektion:

| Årsag | Tekst |
|---|---|
| Beregningsdato | Beregningsdato |
| Næste afgørelses virkningsdato | Senere afgørelse |
| Kapitalisering (fuld — rest-EET = 0) | Kapitalisering |
| Tvungen kapitalisering (< 2 år til FP) | Tvungen kapitalisering |

**Blok 4: Ydelsestabel**

Underoverskrift "Beregnede ydelser" efterfulgt af en tabel med kolonneoverskrifter og datarækkerne:

| Fra o.m. | Til o.m. | Mdr. | Grundydelse | Regulering | Ydelse/md. (afr.) | Beregnet EET |
|---|---|---|---|---|---|---|

- Datoer i format `DD-MM-ÅÅÅÅ`
- Måneder med 4 decimaler (fx `11,0000`)
- Grundydelse i kr. med 2 decimaler
- Regulering i procent med fortegn
- Ydelse/md. (afr.) og Beregnet EET i hele kr. med tusindtalspunktum og "kr."-suffiks
- Alle datarækker er hoverrows

**Rest-sektion:** Hvis afgørelsen er delvist kapitaliseret og rest-EET > 0, fortsætter ydelsesrækkerne for rest-EET i **samme tabel** uden nogen separat overskrift eller visuel adskillelse. Skiftet markeres udelukkende ved at en ny kalenderårs-række begynder på kapitaliseringsdatoen med den lavere ydelse.

**"I alt"-linje:** Én hoverrow i bunden af tabellen. Kun "Fra o.m." ("I alt") og "Beregnet EET"-kolonnen udfyldes; øvrige kolonner er tomme. Beløbet er summen af alle rækker under den pågældende afgørelse (fuld + rest samlet).

Ingen samlet total på tværs af afgørelser.

#### ContentBox: Udvidet specifikation

Vises altid i UI. Indeholder mellemregningerne for grundløn og grundydelse.

**Blok 1: Årslønsafstemning**

Én indrykket hoverrow:

| Felt | Eksempel |
|---|---|
| ASL årsløn (afrundet til nærmeste 1000 og maks. årsløn i skadesåret) | 489.000 kr. |

Den viste værdi er `min(roundNearest1000(årsløn), aarsloenMax[skadesår])`.

**Blok 2: Grundløn**

Underoverskrift "Grundløn" efterfulgt af indrykkede hoverrows.

*Ved skade før 01-07-2024 (2003-niveau):*

- Tekstlinje: "Der sker omregning af årslønnen til 2003-niveau."
- Tekstlinje: "Omregning sker med afsæt i ASL's årslønsmaksimum på henholdsvis skadesdagen og 1/1-2003."
- Tom linje (visuel luft)
- Hoverrow: `Maks. årsløn 1/1-2003 udgør:` → `367.000 kr.`
- Tekstlinje: "Den beregnede grundløn bliver dermed:"
- Formelvisning (se nedenfor)
- Resultatrow: grundløn i kr. (fx `332.955 kr.`)

Formelvisningen er en multi-linje tekstblok med formlen:
```
"Årsløn × (Maks. årsløn 1/1-2003 / Maks. årsløn [skadesdato])
= [årsløn] kr. × ([367.000] / [aarsloenMax[skadesår]]) ="
```
Skadsdato-teksten i formellinjen vises som den faktiske skadesdato (fx "1/4-2019"), ikke blot "skadesdatoen".

*Ved skade fra 01-07-2024 (2024-niveau):*

- Tekstlinje: "Der sker omregning af årslønnen til 2024-niveau."
- Tekstlinje: "Omregning sker med afsæt i ASL's årslønsmaksimum på henholdsvis skadesdagen og 1/1-2024."
- Tom linje (visuel luft)
- Hoverrow: `Maks. årsløn 1/1-2024 udgør:` → `608.000 kr.`
- Tekstlinje: "Den beregnede grundløn bliver dermed:"
- Formelvisning:
  ```
  "Årsløn × (Maks. årsløn 1/1-2024 / Maks. årsløn [skadesdato])
  = [årsløn] kr. × ([608.000] / [aarsloenMax[skadesår]]) ="
  ```
  Skadesdato-teksten i formellinjen vises som den faktiske skadesdato (fx "1/8-2024").
- Resultatrow: grundløn i kr.

**Blok 3: Grundydelse**

Underoverskriften er:
- `"Grundydelse (før 1.1.2024)"` — ved skade **før** 01-07-2024 (grundydelse i 2003-niveau, der efterfølgende opreguleres)
- `"Grundydelse"` — ved skade **fra** 01-07-2024 (grundydelse direkte i 2024-niveau; ingen opregulering)

Indledende hoverrows der afspejler beregningsreglerne — identiske for begge niveauer:

- Hoverrow: `Da skaden er fra 1/1-2011 eller senere, udgør erstatningsniveauet` → `83 %` **(kun ved skade fra 01-01-2011)**
- Hoverrow: `Da skaden er sket den 1/1-2011 eller senere, skal der trækkes AM-bidrag fra årslønnen` **(kun ved skade fra 01-01-2011)**
- Hoverrow: `Da skaden er sket før 1/1-2011, udgør erstatningsniveauet` → `80 %` **(kun ved skade før 01-01-2011; intet AM-bidrag-felt vises)**

Herefter én blok pr. afgørelse (kun afgørelser der indgår i fane 2 — dvs. afgørelser med reel EET %):

- Underoverskrift: `Afgørelse [afgørelsesdato i format "d. MMMM YYYY"] ([EET %])`
- Formelvisning for grundydelse beregnet af den effektive EET før aktuel kapitalisering (`afgørelsens EET % - tidligere kapitaliseringsprocenter`), fx:
  ```
  "Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag)
  = 332.955 kr. × 45 % × 83 % × 92 % ="
  ```
  Ved skade før 01-01-2011 udelades `× (100 % − AM-bidrag)`-delen.
- Resultatrow: grundydelse i kr. (fx `114.410,00 kr.`) — to decimaler
- Efterfølgende linje: `Ikke kapitaliseret.` hvis afgørelsen ikke har kapitalisering, ellers: `Efter kapitalisering fra [kapitaliseringsdato]: ([effektiv EET før aktuel kap] - [aktuel kap.%] = [rest-%])` → `[grundydelse_rest] kr.`.
  Reduktionen vises og anvendes altid fra kapitaliseringsdatoen (også når kapitaliseringen ligger fra 01-01-2024 og frem).

**Blok 4: Grundydelse (fra 1.1.2024)**

Denne blok vises **kun ved skade før 01-07-2024** og viser opreguleringen fra 2003-niveau til 2024-niveau. Ved 2024-niveau-skader er blokken fraværende — årsydelsesberegningen (trin 3) tager direkte udgangspunkt i grundydelsen fra blok 3.

Underoverskrift: `"Grundydelse (fra 1.1.2024)"`.

Én blok pr. afgørelse:

- Underoverskrift: `Afgørelse [dato] ([EET %])`
- Formelvisning for opregulering til 2024-niveau, fx:
  ```
  "Grundydelse i 2003-niveau, opreguleret til 2024-værdi
  = 114.410,00 kr. × 1,657"
  ```
- Resultatrow: 2024-grundydelse (fx `189.577,37 kr.`) — to decimaler
- Efterfølgende linje: `Ikke kapitaliseret.` eller `Efter kapitalisering fra [kapitaliseringsdato]: ([effektiv EET før aktuel kap] - [aktuel kap.%] = [rest-%])` → `[2024-grundydelse_rest] kr.`

---

### Fejlbetingelser (fane 2)

Fanen følger den fælles beregningsfanestruktur (se afsnit 4). Fejl der blokerer beregning og download:

| Fejlbetingelse | Fejlmeddelelse |
|---|---|
| Årsløn mangler | Årsløn er ikke udfyldt |
| Ingen afgørelser med reel EET % | Ingen afgørelser med erhvervsevnetabsprocent er udfyldt |
| Fødselsdato mangler | Fødselsdato er ikke udfyldt |
| Beregningsdato mangler | Beregningsdato er ikke udfyldt |
| Skadesdato mangler | Skadesdato er ikke udfyldt |
| Reguleringstabel mangler sats for et nødvendigt år | Reguleringssats mangler for år [X] |
| `aarsloenMax` mangler for skadesåret | Maksimum årsløn mangler for år [X] |
| Mindst én afgørelsesrække har kapitaliseringsdato udfyldt men kapitaliseringsprocent tomt | Der er indtastet kapitaliseringsdato men ikke -procent |
| Mindst én afgørelsesrække har kapitaliseringsprocent udfyldt men kapitaliseringsdato tomt | Der er indtastet kapitaliseringsprocent men ikke -dato |
| Mindst én afgørelsesrække har type `Endelig`, reel EET % < 50 %, og enten kapitaliseringsdato mangler, kapitaliseringsprocent mangler, eller begge mangler | Endelig afgørelse under 50 % mangler oplysninger om kapitalisering. |
| Mindst én afgørelsesrække har type `Delvist endelig`, og enten kapitaliseringsdato mangler, kapitaliseringsprocent mangler, eller begge mangler | Der er angivet delvist endelig afgørelse uden kapitalisering. |

Beregningsdatoen er beskyttet af `DATE_EET_MAX`-valideringen — det er umuligt at angive et beregningsår uden satsdækning via UI'et.

---

### Verificerede beregningseksempler

Følgende eksempler er gennemregnet og bekræftet korrekte. Bruges som referencegrundlag ved implementering og test.

#### Eksempel A — skade 01-04-2019, beregningsdato 27-02-2026, to afgørelser

- Årsløn: 489.000 kr., `aarsloenMax[2019]` = 539.000 kr.
- Grundløn (2003-niveau): `round0(489.000 × 367.000 / 539.000)` = **332.955 kr.**

**Afgørelse 1:** Midlertidig, 45 %, afgørelsesdato 01-07-2023, virkningsdato 01-02-2023
- Grundydelse: `round2(332.955 × 0,45 × 0,83 × 0,92)` = **114.410,00 kr.**
- Ikke tilbagevirkende kraft efter kalenderårsdefinitionen (virkning og afgørelse i 2023) → sats = 2023 (60,1 %) for perioden 01-02-2023→31-12-2023
- 2023-årsydelse: `114.410,00 × 1,601 = 183.170,41` → `ceil12` = **183.180 kr.** → **15.265 kr./md.**
- 2024-grundydelse: `round2(114.410,00 × 1,657)` = **189.577,37 kr.**
- 2024-årsydelse: `189.577,37 × 1,000 = 189.577,37` → `ceil12` = **189.588 kr.** → **15.799 kr./md.**
- 2025-årsydelse: `189.577,37 × 1,039 = 196.970,48` → `ceil12` = **196.980 kr.** → **16.415 kr./md.**
- Ophør pga. ny afgørelses virkningsdato 01-10-2025 → løber til 30-09-2025
- Perioder: 01-02-2023→31-12-2023 (11,0000 mdr.), 01-01-2024→31-12-2024 (12,0000 mdr.), 01-01-2025→30-09-2025 (9,0000 mdr.)
- I alt: 167.915 + 189.588 + 147.735 = **505.238 kr.**

**Afgørelse 2:** Endelig (delvist kap.), 75 %, kap. 50 %, afgørelsesdato 01-11-2025, virkningsdato 01-10-2025, kapitaliseringsdato 15-01-2026
- Rest-EET = 75 % − 50 % = 25 %
- Grundydelse fuld (75 %): `round2(332.955 × 0,75 × 0,83 × 0,92)` = **190.683,33 kr.**
- Grundydelse rest (25 %): `round2(332.955 × 0,25 × 0,83 × 0,92)` = **63.561,11 kr.**
- Sats = afgørelsesåret 2025 (3,9 %); virkningsdato = afgørelsesdato, så ingen tilbagevirkende kraft
- 2024-grundydelse rest: `round2(63.561,11 × 1,657)` = **105.320,76 kr.**
- Fuld sektion (75 %): 01-10-2025→14-01-2026 (før kapitaliseringsdatoen)
  - 2025-årsydelse fuld: `190.683,33 × 1,657 × 1,039 = 315.962,28 × 1,039` = ... → `ceil12` → **27.358 kr./md.**
  - Perioder: 01-10-2025→31-12-2025 (3,0000 mdr.) = 82.074 kr., 01-01-2026→14-01-2026 (0,4516 mdr.) = 12.950 kr.
- Rest-sektion (25 %): 15-01-2026→27-02-2026
  - 2026-årsydelse rest: `105.320,76 × 1,089` = ... → `ceil12` → **9.558 kr./md.**
  - Periode: 15-01-2026→27-02-2026 (1,5127 mdr.) = 14.458 kr.
- I alt: 82.074 + 12.950 + 14.458 = **109.482 kr.**

#### Eksempel B — skade 01-07-2024, beregningsdato i 2026 (illustrativt)

- Årsløn: 401.000 kr., `aarsloenMax[2024]` = 608.000 kr.
- Grundløn (2024-niveau): `round0(401.000 × 608.000 / 632.000)` = **385.772 kr.**
- Grundydelse (40 %, 83 %, AM-bidrag): `round2(385.772 × 0,40 × 0,83 × 0,92)` = **117.830,20 kr.**
- 2026-årsydelse: `117.830,20 × 1,089 = 128.317,09` → `ceil12` = **128.328 kr.** → **10.694 kr./md.**

#### Eksempel C — skade fra 01-01-2011, beregningsdato i 2026 (illustrativt)

- Årsløn: 401.000 kr., `aarsloenMax[skadesår]` = 498.000 kr. (antaget 2015)
- Grundløn (2003-niveau): `round0(401.000 × 367.000 / 498.000)` = **295.516 kr.**
- Grundydelse (40 %, 83 %, AM-bidrag): `round2(295.516 × 0,40 × 0,83 × 0,92)` = **90.262,41 kr.**
- 2024-grundydelse: `round2(90.262,41 × 1,657)` = **149.564,81 kr.**
- 2026-årsydelse: `149.564,81 × 1,089 = 162.876,08` → `ceil12` = **162.888 kr.** → **13.574 kr./md.**

#### Eksempel D — skade før 01-01-2011, beregningsdato i 2026 (illustrativt)

- Årsløn: 401.000 kr., `aarsloenMax[skadesår]` = 434.000 kr. (antaget 2009)
- Grundløn (2003-niveau): `round0(401.000 × 367.000 / 434.000)` = **339.094 kr.**
- Grundydelse (40 %, 80 %, **intet AM-bidrag**): `round2(339.094 × 0,40 × 0,80)` = **108.510,08 kr.**
- 2024-grundydelse: `round2(108.510,08 × 1,657)` = **179.801,20 kr.**
- 2026-årsydelse: `179.801,20 × 1,089 = 195.803,51` → `ceil12` = **195.804 kr.** → **16.317 kr./md.**

---

### Advarselsbetingelser (fane 2)

Følgende situationer udløser advarsler (WarningAmber, orange) uden at blokere download:

| Betingelse | Advarselstekst |
|---|---|
| Den benyttede ASL-årsløn svarer til `aarsloenMax` for skadesåret | *(samme tekst som `warn-asl-aarsloen-is-max` på fane 4)* |
| Der er angivet en afgørelse af typen `Midlertidig` eller `Delvist endelig` med afgørelsesdato **efter** afgørelsesdatoen for en `Endelig`-afgørelse | "Der er angivet en midlertidig afgørelse efter en endelig afgørelse." |
| Mindst én afgørelse har en reel EET % (> 0) der er **< 15 %** | "Der er indtastet en afgørelse med < 15 % erhvervsevnetab." |
| Skadesdato er fra 01-07-2024, og mindst én afgørelse har en EET % **> 15 %** der ikke er deleligt med 10 (dvs. 25, 35, 45, 55, 65, 75, 85, 95) | "Der er indtastet en ugyldig EET-procent ( [X] %) for skader fra 1. juli 2024." |
