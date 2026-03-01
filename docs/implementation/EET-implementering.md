# EET-implementering — Erhvervsevnetab

> Arbejdsdokument for planlægning og implementering af Erhvervsevnetab-siden.
> Opdateres løbende i denne tråd.

---

## Status

Placeholder-side eksisterer. Implementering ikke påbegyndt.

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

## 5. Datastruktur og filorganisering

### Oversigt

Kapitaliseringsberegninger kræver tre typer statiske data, som alle ligger i `src/data/`:

| Fil | Indhold | Opdateres |
|---|---|---|
| `kapitalisering/kapitaliseringsbekendtgørelser.ts` | Matrix: skadesdato × kapitaliseringsdato → bekendtgørelsesnummer + `eetKapitaliseringsDatoMaxFraBekendtgoerelser` | Manuelt, årligt |
| `kapitaliseringsTabeller/[nr]-[år].ts` | Tabeller (alder → faktor) + særfaktor for < 2 år til folkepension | Via hjælper, årligt |
| `folkepensionsalder.ts` | Fødselsdato-fra → folkepensionsalder | Sjældent — kun ved lovændring |

### Bekendtgørelsesoversigt (`kapitalisering/kapitaliseringsbekendtgørelser.ts`)

Filen afspejler hvilken bekendtgørelse/vejledning der gælder for en given kombination af skadesdato og kapitaliseringsdato. Strukturen er en liste af skadesdato-intervaller, hver med en liste af kapitaliseringsdato-intervaller og tilhørende bekendtgørelsesnummer.

Bekendtgørelser og vejledninger behandles ens og identificeres udelukkende ved nummer og årstal, fx `10029/2024`. Der skelnes ikke mellem betegnelserne "bekendtgørelse" og "vejledning". Feltet hedder `id` i koden.

Tomme celler i den eksterne oversigt (kombinationer der ikke kan forekomme) udelades simpelthen — de repræsenteres ikke i filen.

Filen eksporterer to ting:

1. **`kapitaliseringsbekendtgoerelser`** — selve oversigten som `KapitaliseringsSkadesdatoInterval[]`.
2. **`eetKapitaliseringsDatoMaxFraBekendtgoerelser`** — en beregnet `ISODateString` der repræsenterer den seneste dato for hvilken der eksisterer en gyldig bekendtgørelse for **alle** skadesdato-intervaller. Algoritmen: for hvert skadesdato-interval findes den nyeste `kapitaliseringsdatoFra`; derefter tages minimum på tværs af alle intervaller; resultatet konverteres til 31-12 i det fundne år. Denne konstant bruges i `regulationRates.ts` til at capse `eetYearBounds.maxYear`.

**Fail-fast validering:** Alle datostrenge i oversigten konverteres ved modul-load med `toISODateString`. En ugyldig datostreng kaster et exception ved app-start — bevidst, da dette er en trust-kritisk datakilde.

**Udløbsregel for seneste post:** Den sidstnævnte post i hvert skadesdato-interval gælder kun for kapitaliseringsdatoer frem til og med **31-12-X**, hvor X er året i dens `kapitaliseringsdatoFra`. `eetKapitaliseringsDatoMaxFraBekendtgoerelser` beregnes ud fra denne regel.

**Sådan tilføjes et nyt år:**
1. Tilføj en ny `{ kapitaliseringsdatoFra, id }` linje nederst i **hvert** relevant skadesdato-interval i `RAW_KAPITALISERINGSBEKENDTGOERELSER`.
2. Tilføj tilsvarende ny data i `regulationRates.ts` (de fire satser).
3. `eetYearBounds` og `DATE_EET_MAX` opdateres automatisk.
4. Hvis en ny skadesdato-grænse indføres ved lovændring, tilføjes et nyt objekt i hovedarrayet.

Eksempel på struktur (illustrativ):
```ts
const RAW_KAPITALISERINGSBEKENDTGOERELSER = [
  {
    skadesdatoFra: '1978-04-01',
    kapitaliseringer: [
      { kapitaliseringsdatoFra: '2004-01-01', id: '1068/2003' },
      // ...
      { kapitaliseringsdatoFra: '2026-01-01', id: '10056/2025' }, // seneste post, gælder t.o.m. 31-12-2026
    ],
  },
  // ...
];
```

Nye skadesdato-intervaller kan tilføjes som nye elementer i arrayet. Nye kapitaliseringsdatoer tilføjes som nye elementer i det relevante intervals `kapitaliseringer`-array.

### Kapitaliseringstabeller (auto-genereret via hjælper)

Én fil per bekendtgørelse, navngivet efter bekendtgørelsesnummeret, fx `10029-2024.ts`. Genereres automatisk af en PDF-hjælper og må ikke redigeres manuelt. Indeholder:

- Navngivne tabeller (A, B, C, ...) som arrays af `{ alder: number, faktor: number }`
- Særfaktor for skadelidte < 2 år fra folkepensionsalderen (ét tal)

Tabellerne opstilles i koden som eksplicitte, letlæselige arrays — én række per linje — så værdier let kan kontrolleres manuelt efter indlæsning.

### Alder og interpolation ved ikke-hele år

I tabellerne er alder altid et helt antal år. Når den beregnede alder ikke er et helt antal år, interpoleres faktoren som en vægtet sum af de to nærmeste hele år (se forretningslogik, Tilfælde 1).

Alder opgøres i **hele opnåede år og måneder** — dage medregnes ikke. En skadelidt der er 37 år, 9 måneder og 3 dage behandles som 37 år og 9 måneder.

### Folkepensionsalder (`folkepensionsalder.ts`)

Manuelt vedligeholdt fil. Indeholder en liste af intervaller: fødselsdato-fra → folkepensionsalder (i hele år). Opdateres kun ved lovændring.

### PDF-hjælperen

Kører lokalt af udvikler én gang om året. Læser PDF-filen fra en lokal mappe, udtrækker tabeller og særfaktor, og genererer en ny `[nr]-[år].ts`-fil. Modelleret efter `scripts/import-offentlig-loen.mjs`. Efter kørsel skal udvikler manuelt gennemgå den genererede fil og verificere at alle værdier er korrekt udtrukket, da PDF-filernes layout varierer fra år til år.

---

## 6. Forretningslogik

### Kapitaliseringsfaktor — beregningsregler

Der gælder tre tilfælde afhængigt af skadelidtes alder på afgørelsestidspunktet, opgjort i år og måneder:

**Tilfælde 1: Alder ligger inden for tabellens aldersinterval**
Faktoren beregnes som en vægtet sum af de to nærmeste hele år. Faktoren falder altid med stigende alder (kapitaliseringsfaktoren udtrykker antal år tilbage til folkepensionsalderen):
```
faktor = ((12 − måneder) / 12) × faktor(alder_ned)
       + (måneder / 12) × faktor(alder_op)
```
*(måneder = antal måneder over det nedre hele år; alder_op = alder_ned + 1)*

**Tilfælde 2: Alder ligger mellem tabellens højeste alder og (folkepensionsalder − 2 år)**
Faktoren interpoleres lineært mellem faktoren for den højeste tabelalder og særfaktoren. Interpolationen er måneds-baseret, identisk med tilfælde 1:
```
faktor = faktor(højeste_tabelalder) + (måneder_over_højeste / total_måneder) × (særfaktor − faktor(højeste_tabelalder))
```
hvor `total_måneder` = antal måneder fra højeste tabelalder til (folkepensionsalder − 2 år), og `måneder_over_højeste` = antal måneder skadelidte er ældre end den højeste tabelalder.

**Tilfælde 3: Alder er 2 år eller mindre fra folkepensionsalderen — eller folkepensionsalderen er nået**
Særfaktoren (fx 1,245) anvendes direkte. Ingen interpolation. Gælder også skadelidte der allerede har nået folkepensionsalderen.

Særfaktoren varierer fra bekendtgørelse til bekendtgørelse og læses fra den relevante bekendtgørelsesfil — den er ikke en fast konstant i koden.

### Valg af bekendtgørelse

Opslag sker udelukkende på **skadesdato** og **kapitaliseringsdato**. Fødselsdato indgår ikke i dette opslag.

**Opslagslogik:** Alle datoer i oversigten er fra-datoer og gælder frem til næste fra-dato. Find den seneste `skadesdatoFra` der er ≤ skadesdato, og inden for det interval den seneste `kapitaliseringsdatoFra` der er ≤ kapitaliseringsdato. Eksempel: skadesdato 01-01-2005 og kapitaliseringsdato 01-06-2005 giver interval 01-04-1978 / 01-01-2004 → Bkg. 1068/2003, fordi skadesdatoen ligger i 01-04-1978-intervallet (før 01-07-2007) og kapitaliseringsdatoen ligger i 01-01-2004-intervallet (før 01-07-2007).

**Udløbsregel for seneste post:** Den sidstnævnte post i hvert skadesdato-interval gælder kun for kapitaliseringsdatoer frem til og med **31-12-X**, hvor X er året i dens `kapitaliseringsdatoFra`. Eksempel: posten `{ kapitaliseringsdatoFra: '2026-01-01', id: '10056/2025' }` må udelukkende anvendes for kapitaliseringsdatoer t.o.m. 31-12-2026. Er kapitaliseringsdatoen 01-01-2027 eller senere, mangler der en gyldig bekendtgørelse, og koden skal fejle synligt — aldrig stille falde tilbage til en forældet bekendtgørelse. Implementationen skal sikre dette.

**Note om historiske rækker:** Intervallet 01-04-1978 indeholder bekendtgørelser fra før 2005. Disse kan aldrig forekomme i praksis, da stamdata låser mindste skadesdato til 01-01-2005, og kapitaliseringsdatoen aldrig vil ligge forud for skadesdatoen. De historiske rækker bevares i oversigten af nostalgiske og dokumentationsmæssige årsager.

Den komplette oversigt er:

| Skadesdato fra | Kapitaliseringsdato fra | Bekendtgørelse |
|---|---|---|
| 01-04-1978 | 01-01-2004 | Bkg. 1068/2003 |
| 01-04-1978 | 01-07-2007 | Bkg. 1068/2003 |
| 01-04-1978 | 01-01-2008 | Bkg. 1068/2003 |
| 01-04-1978 | 01-01-2009 | Bkg. 1068/2003 |
| 01-04-1978 | 01-07-2009 | Bkg. 449/2009 |
| 01-04-1978 | 01-01-2010 | Bkg. 449/2009 |
| 01-04-1978 | 01-01-2011 | Bkg. 1221/2010 |
| 01-04-1978 | 01-01-2012 | Bkg. 1403/2011 |
| 01-04-1978 | 01-01-2013 | Bkg. 1403/2011 |
| 01-04-1978 | 01-01-2014 | Bkg. 1403/2011 |
| 01-04-1978 | 01-01-2015 | Bkg. 1403/2011 |
| 01-04-1978 | 01-03-2015 | Bkg. 198/2015 |
| 01-04-1978 | 29-12-2015 | Bkg. 1700/2015 |
| 01-04-1978 | 01-01-2016 | Bkg. 1700/2015 |
| 01-04-1978 | 01-01-2017 | Bkg. 1700/2015 |
| 01-04-1978 | 01-01-2018 | Bkg. 1700/2015 |
| 01-04-1978 | 01-01-2019 | Bkg. 1700/2015 |
| 01-04-1978 | 01-01-2020 | Bkg. 1700/2015 |
| 01-04-1978 | 31-12-2020 | Vejl. 9871/2020 |
| 01-04-1978 | 01-01-2021 | Vejl. 9871/2020 |
| 01-04-1978 | 01-01-2022 | Vejl. 9871/2020 |
| 01-04-1978 | 01-01-2023 | Vejl. 9871/2020 |
| 01-04-1978 | 01-01-2024 | Vejl. 9871/2020 |
| 01-04-1978 | 01-07-2024 | Vejl. 9376/2024 |
| 01-04-1978 | 01-01-2025 | Vejl. 10029/2024 |
| 01-04-1978 | 01-01-2026 | Vejl. 10056/2025 |
| 01-07-2007 | 01-07-2007 | Bkg. 678/2007 |
| 01-07-2007 | 01-01-2008 | Bkg. 1263/2007 |
| 01-07-2007 | 01-01-2009 | Bkg. 1047/2008 |
| 01-07-2007 | 01-07-2009 | Bkg. 440/2009 |
| 01-07-2007 | 01-01-2010 | Bkg. 1022/2009 |
| 01-07-2007 | 01-01-2011 | Bkg. 1221/2010 |
| 01-07-2007 | 01-01-2012 | Bkg. 1403/2011 |
| 01-07-2007 | 01-01-2013 | Bkg. 1403/2011 |
| 01-07-2007 | 01-01-2014 | Bkg. 1403/2011 |
| 01-07-2007 | 01-01-2015 | Bkg. 1403/2011 |
| 01-07-2007 | 01-03-2015 | Bkg. 198/2015 |
| 01-07-2007 | 29-12-2015 | Bkg. 1700/2015 |
| 01-07-2007 | 01-01-2016 | Bkg. 1700/2015 |
| 01-07-2007 | 01-01-2017 | Bkg. 1700/2015 |
| 01-07-2007 | 01-01-2018 | Bkg. 1700/2015 |
| 01-07-2007 | 01-01-2019 | Bkg. 1700/2015 |
| 01-07-2007 | 01-01-2020 | Bkg. 1700/2015 |
| 01-07-2007 | 31-12-2020 | Vejl. 9871/2020 |
| 01-07-2007 | 01-01-2021 | Vejl. 9871/2020 |
| 01-07-2007 | 01-01-2022 | Vejl. 9871/2020 |
| 01-07-2007 | 01-01-2023 | Vejl. 9871/2020 |
| 01-07-2007 | 01-01-2024 | Vejl. 9871/2020 |
| 01-07-2007 | 01-07-2024 | Vejl. 9376/2024 |
| 01-07-2007 | 01-01-2025 | Vejl. 10029/2024 |
| 01-07-2007 | 01-01-2026 | Vejl. 10056/2025 |
| 01-01-2011 | 01-01-2011 | Bkg. 1220/2010 |
| 01-01-2011 | 01-01-2012 | Bkg. 1358/2011 |
| 01-01-2011 | 01-01-2013 | Bkg. 990/2012 |
| 01-01-2011 | 01-01-2014 | Bkg. 1202/2013 |
| 01-01-2011 | 01-01-2015 | Bkg. 1275/2014 |
| 01-01-2011 | 01-03-2015 | Bkg. 199/2015 |
| 01-01-2011 | 29-12-2015 | Bkg. 1663/2015 |
| 01-01-2011 | 01-01-2016 | Bkg. 1664/2015 |
| 01-01-2011 | 01-01-2017 | Bkg. 1275/2016 |
| 01-01-2011 | 01-01-2018 | Bkg. 1156/2017 |
| 01-01-2011 | 01-01-2019 | Bkg. 1233/2018 |
| 01-01-2011 | 01-01-2020 | Vejl. 9921/2019 |
| 01-01-2011 | 31-12-2020 | Vejl. 9870/2020 |
| 01-01-2011 | 01-01-2021 | Vejl. 9741/2020 |
| 01-01-2011 | 01-01-2022 | Vejl. 9864/2021 |
| 01-01-2011 | 01-01-2023 | Vejl. 10141/2022 |
| 01-01-2011 | 01-01-2024 | Vejl. 9820/2023 |
| 01-01-2011 | 01-07-2024 | Vejl. 9376/2024 |
| 01-01-2011 | 01-01-2025 | Vejl. 10029/2024 |
| 01-01-2011 | 01-01-2026 | Vejl. 10056/2025 |
| 01-01-2021 | 01-01-2021 | Vejl. 9741/2020 |
| 01-01-2021 | 01-01-2022 | Vejl. 9864/2021 |
| 01-01-2021 | 01-01-2023 | Vejl. 10141/2022 |
| 01-01-2021 | 01-01-2024 | Vejl. 9820/2023 |
| 01-01-2021 | 01-07-2024 | Vejl. 9376/2024 |
| 01-01-2021 | 01-01-2025 | Vejl. 10029/2024 |
| 01-01-2021 | 01-01-2026 | Vejl. 10056/2025 |

Tomme celler i den originale matrix (kombinationer der ikke kan forekomme) er udeladt.

### Valg af tabel inden for bekendtgørelsen

Opslag sker på **skadesdato** og **folkepensionsalder**. Fødselsdato bruges udelukkende til at udlede folkepensionsalderen — selve opslaget beror på pensionsalderen. To skadelidte med samme folkepensionsalder lander altid i samme tabel.

Skadesdato-grænserne i tabelvalget er de samme fire som i bekendtgørelsesoversigten (01-04-1978, 01-07-2007, 01-01-2011, 01-01-2021).

Oversigtsstrukturen er ens på tværs af alle bekendtgørelser, men de konkrete tabelnavne, skadesdatoer og fødselsdatoer varierer fra bekendtgørelse til bekendtgørelse. Oversigten gemmes derfor per bekendtgørelsesfil.

Eksempel på struktur (fra Vejl. 10029/2024 — illustrativ):

| Skadesdato fra | Fødselsdato fra | Folkepensionsalder | Tabel |
|---|---|---|---|
| 01-01-2021 | 01-01-1967 | 69 år | A |
| 01-01-2021 | 01-01-1963 | 68 år | B |
| 01-01-2021 | 01-07-1955 | 67 år | C |
| 01-01-2011 | 01-01-1967 | 69 år | E |
| 01-01-2011 | 01-01-1963 | 68 år | F |
| 01-01-2011 | 01-07-1955 | 67 år | G |
| 01-07-2007 | 01-01-1967 | 69 år | I |
| 01-07-2007 | 01-01-1963 | 68 år | J |
| 01-07-2007 | 01-07-1955 | 67 år | K |
| 01-01-2004 | 01-01-1967 | 69 år | M |
| 01-01-2004 | 01-01-1963 | 68 år | N |
| 01-01-2004 | 01-07-1955 | 67 år | O |

Fødselsdato og folkepensionsalder angives begge i koden — fødselsdato for menneskeligt overblik, folkepensionsalder som den faktiske opslagsnøgle.

### Kapitalisering ved < 2 år til folkepensionsalderen (FP)

Hvis skadelidte på **afgørelsesdatoen** for endeligt EET er 2 år eller mindre fra sin folkepensionsalder, tilsidesættes alle tabeller. Der bruges i stedet den særlige kapitaliseringsfaktor fra den bekendtgørelse der gælder på **afgørelsesdatoen** — ikke kapitaliseringsdatoen. Dette er en undtagelse fra den normale opslagslogik, hvor kapitaliseringsdatoen bruges. Faktoren er ét fast tal og er uafhængig af alder.

### Kapitaliseringsdato

Angives manuelt af brugeren. Standardantagelse er afgørelsesdatoen, men i praksis er det oftest den 1. i næstkommende måned efter afgørelsesdatoen. Kapitaliseringsdatoen fastsættes på samme måde uanset hvilken beregningsregel der anvendes — reglen om kapitalisering ved < 2 år til FP påvirker udelukkende hvilken bekendtgørelse der bruges til at hente faktoren.

---

## 7. Beregningslogik — EET efter EAL

EAL-beregningen er fuldstændig adskilt fra ASL-beregningen. Ingen logik, satser eller mellemresultater deles mellem de to. EAL-beregningen foregår udelukkende på fane 4.

### Inputværdier

| Værdi | Kilde |
|---|---|
| Årsløn | EAL-årsløn fra fane 1, hvis udfyldt. Ellers ASL-årsløn fra fane 1. |
| EET % | EAL EET % fra fane 1, hvis udfyldt. Ellers EET % fra ASL efter fallback-reglen nedenfor. |
| Beregningsdato | Fane 1. |
| Skadesdato | Stamdata. |
| Fødselsdato | Stamdata. |

**Fallback-regel for EET % fra ASL (når EAL-feltet er tomt):**
1. Find ASL-afgørelsen med seneste **afgørelsesdato**.
2. Hvis der er flere, vælg den med seneste **virkningsdato**.
3. Hvis der stadig er flere med samme afgørelsesdato + virkningsdato:
   - vælg en række med `Endelig`, hvis en sådan findes
   - ellers vælg en række med `Delvist endelig`, hvis en sådan findes
4. Hvis der i dette tie-sæt findes **to eller flere `Endelig`-rækker**, udløses fejl:
   - "Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato, begge markeret som Endelig"
5. Hvis den valgte række ikke har en reel EET %-værdi (tom eller 0), kan EET % ikke bestemmes.

### Trin 1 — Regulering af årsløn

Årslønen reguleres fra skadesår til beregningsår ved hjælp af `reguleringssats` fra `regulationRates`.

**Skadesår** = det kalenderår skadesdatoen falder i. **Beregningsår** = det kalenderår beregningsdatoen falder i.

Der sker ingen regulering i skadesåret. Reguleringen sker fra og med det første hele kalenderår efter skadesåret, frem til og med beregningsåret.

Reguleringsfaktoren beregnes som et kædeprodukt:

```
reguleringsfaktor = ∏ (1 + sats[år]) for år = skadesår+1 → beregningsår
```

Til både beregning og visning rundes reguleringsprocenten til 4 decimaler:

```
regulerings_pct = round4((reguleringsfaktor - 1) * 100)
reguleringsfaktor_afrundet = 1 + regulerings_pct / 100
```

Reguleret årsløn:
```
reguleret_årsløn = round500(årsløn × reguleringsfaktor_afrundet)
```

**Afrunding:** til nærmeste 500 kr.

**Hvis skadesår = beregningsår:** ingen regulering foretages. Reguleringslinjen vises ikke i outputtet.

**Visning af reguleringsprocent:** vises med op til 4 decimaler. Efterfølgende nuller trimmes (fx `22,8178 %`, `22,81 %`, `23 %`).

**Fejlbetingelse:** Hvis `reguleringssats` mangler én eller flere satser for de nødvendige år, udløses en fejl (se afsnit om fejlhåndtering).

### Trin 2 — Beregning af erhvervsevnetab

Kapitaliseringsfaktoren efter EAL er altid **10**, uden undtagelser. Der bruges ingen kapitaliseringstabeller eller bekendtgørelser i EAL-beregningen.

```
eet_beløb = round0(reguleret_årsløn × 10 × eet_procent)
```

**Afrunding:** til nærmeste hele krone (0 decimaler).

Beregnet beløb sammenlignes med `erhvervsevnetabMax` fra `regulationRates` for beregningsåret:

- Hvis `eet_beløb ≤ erhvervsevnetabMax[beregningsår]`: bruges `eet_beløb`. Visningstekst: "Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør: X kr."
- Hvis `eet_beløb > erhvervsevnetabMax[beregningsår]`: bruges `erhvervsevnetabMax[beregningsår]`. Visningstekst: "Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum."

**Fejlbetingelse:** Hvis `erhvervsevnetabMax` mangler en værdi for beregningsåret, udløses en fejl.

Lad `eet_anvendt` betegne den værdi der bruges videre (enten `eet_beløb` eller maks.).

### Trin 3 — Aldersreduktion

Alderen opgøres i **hele opnåede år** på skadesdatoen (måneder og dage ignoreres).

```
alder = floor((skadesdato − fødselsdato) i hele år)
```

Aldersreduktionen beregnes som:

```
hvis alder > 29:
    reduktion_pct = (min(alder, 69) − 29)
                  + (hvis alder > 54: 2 × (min(alder, 69) − 54), ellers 0)
ellers:
    reduktion_pct = 0
```

Det naturlige loft på 70 % fremkommer automatisk af `min(alder, 69)` — ingen separat cap-regel er nødvendig.

Eksempler:
| Alder | Formel | Reduktion |
|---|---|---|
| ≤ 29 | 0 | 0 % |
| 30 | (30−29) | 1 % |
| 53 | (53−29) | 24 % |
| 54 | (54−29) | 25 % |
| 55 | (55−29) + 2×(55−54) | 28 % |
| 69 | (69−29) + 2×(69−54) | 70 % |
| 86 | (69−29) + 2×(69−54) | 70 % |

Beregnet aldersreduktionsbeløb:

```
aldersreduktion_beløb = round0(eet_anvendt × reduktion_pct)
```

**Afrunding:** til nærmeste hele krone (0 decimaler).

### Trin 4 — Endeligt EAL-krav

```
eal_krav = eet_anvendt − aldersreduktion_beløb
```

Hvis resultatet er negativt, sættes `eal_krav = 0`.

**Ingen yderligere afrunding** — resultatet er allerede i hele kroner fra trin 2 og 3.

### Fejlhåndtering og layout (fane 4)

Fanen følger den fælles beregningsfanestruktur med tre ContentBoxe:

1. **"Fejl og advarsler"** — viser fejlmeddelelser (ErrorOutline-ikon, rød) eller advarsler (WarningAmber-ikon, orange).
2. **"Beregning"** — indeholder kun:
   - `Beregningsdato` (venstre label, dato til højre)
   - `Download specifikation` (inaktiv indtil PDF-specifikation er defineret)
3. **"Specifikation"** — viser den trinvise beregning som beskrevet i trin 1–4 ovenfor.

Fejlbetingelser der skjuler både **"Beregning"** og **"Specifikation"** (så kun "Fejl og advarsler" står tilbage) samt blokerer download:

| Fejlbetingelse | Fejlmeddelelse |
|---|---|
| Årsløn mangler | Årsløn er ikke udfyldt |
| EET % kan ikke bestemmes (ingen ASL-afgørelse og ingen EAL-override) | Erhvervsevnetabsprocent er ikke udfyldt |
| Fødselsdato mangler | Fødselsdato er ikke udfyldt |
| Beregningsdato mangler | Beregningsdato er ikke udfyldt |
| `reguleringssats` mangler for ét eller flere nødvendige år | Reguleringssats mangler for år [X] |
| `erhvervsevnetabMax` mangler for beregningsåret | Maksimum for erhvervsevnetab mangler for år [X] |

Derudover vises inputvalideringsfejl i "Fejl og advarsler", **men kun** de feltfejl der har betydning for EET efter EAL (dvs. felter der indgår i beregningsgrundlaget for denne fane).

#### Teknisk systematik for fejl/advarsler på fane 4

For at sikre ensartet implementering af både manuelt definerede fejl/advarsler og fejl gengivet fra inputfelter på "EET oplysninger", bruges følgende faste mønster:

1. Alle linjer repræsenteres som `EetEalIssue` med tre felter:
   - `id` (stabil teknisk nøgle)
   - `severity` (`error` eller `warning`)
   - `message` (dansk brugertekst)
2. Domænelogik i `computeEetEalCalculation` opretter alle beregningsrelaterede issues:
   - fejl via `toIssue(...)`
   - advarsler via `toWarning(...)`
3. Feltvalideringsfejl hentes separat via `useFormFieldErrors(...)` og konverteres til issues med `field-`-prefiks i `id` (fx `field-beregningsdato`).
4. De to kilder merges i `EetEfterEalTab`:
   - `issues = uniqueIssues([...calculationResult.issues, ...fieldIssues])`
   - deduplikering sker på meddelelsestekst, så samme brugerbesked ikke vises flere gange.
5. Blokering af beregningsvisning/download styres udelukkende af severity:
   - mindst én `error` => "Beregning" + "Specifikation" skjules.
   - kun `warning` => beregning vises stadig.
6. Alle issue-linjer vises i samme hoverrow-format i ContentBox "Fejl og advarsler":
   - `ErrorOutline` (rød) for `error`
   - `WarningAmber` (orange) for `warning`
7. Navigation fra issue-linje til inputsektion styres centralt i `resolveIssueNavigation(issueId)`:
   - hver relevant `id` skal mappe til `pageName`, `sectionName`, `route`, `sectionId`.
   - på "EET oplysninger" skal sektionsnavne være præcist: `Stamdata`, `Arbejdsskadesikringsloven`, `Erstatningsansvarsloven`.
8. Når en ny fejl/advarsel tilføjes, er det obligatorisk at opdatere:
   - issue-oprettelse i domænelogik eller felt-issue-konvertering
   - navigation mapping (`resolveIssueNavigation`)
   - testdækning i `eetEalCalculation.test.ts` (mindst ét testcase for ny regel)

Denne systematik er normativ for fremtidige fejl/advarsler på EET-faner med samme struktur.

##### Nuværende issue-katalog (fane 4)

| Issue ID | Severity | Triggerbetingelse |
|---|---|---|
| `aarsloen-missing` | error | Ingen gyldig årsløn fra EAL-override eller ASL-årsløn. |
| `eet-pct-missing` | error | EET % kan ikke bestemmes fra EAL-override eller ASL-fallback. |
| `fodselsdato-missing` | error | Fødselsdato mangler i stamdata. |
| `beregningsdato-missing` | error | Beregningsdato mangler i EET-oplysninger. |
| `skadesdato-missing` | error | Skadesdato mangler i stamdata. |
| `reguleringssats-missing` | error | Mindst ét nødvendigt reguleringsår mangler sats. |
| `eet-max-missing` | error | `erhvervsevnetabMax` mangler for beregningsåret. |
| `eal-eet-pct-invalid` | error | EAL EET %-override er ikke heltal deleligt med 5. |
| `asl-selected-eet-pct-invalid` | error | Valgt ASL-fallback-række har ugyldig EET %-værdi. |
| `asl-identical-endelig` | error | To `Endelig`-rækker har samme afgørelsesdato + virkningsdato i tie-sæt. |
| `alder-unresolved` | error | Alder på skadestidspunkt kan ikke beregnes ud fra fødselsdato/skadesdato. |
| `warn-eal-eet-under-15` | warning | EAL EET %-override er udfyldt og under 15 %. |
| `warn-asl-eet-under-15` | warning | ASL-fallback EET % vælges og er under 15 %. |
| `warn-eal-aarsloen-empty-for-2024-07-01` | warning | Skadesdato er 1. juli 2024 eller senere, og EAL-årsløn er ikke udfyldt. |
| `warn-eal-aarsloen-is-max` | warning | EAL-årsløn svarer til maksimum-årsløn for skadesåret. |
| `warn-asl-aarsloen-is-max` | warning | EAL-årsløn er tom, og ASL-årsløn svarer til maksimum-årsløn for skadesåret. |

Feltvalideringsfejl fra fane 1 gengives derudover som `field-*` issues med `error` severity efter samme merge-regel.

Download-row på fane 4:
- Der vises en hoverrow med teksten **"Download specifikation"** til venstre og download-ikon til højre.
- Knappen er foreløbigt inaktiv, indtil PDF-indhold og struktur er defineret.

### Datoformatering på fane 4

- Beregningsdato i "Beregning"-boksen: format `d. MMMM YYYY` (fx "27. februar 2026").
- Alle øvrige datoer: format `DD-MM-YYYY`.
