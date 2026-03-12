# Implementering — Kapitaliseret EET

Denne fil beskriver implementeringen af kapitaliseret erhvervsevnetab (ASL kapitalisering og EAL-beregning).

For løbende erhvervsevnetab, se: `docs/implementation/implementering-loebende-eet.md`.
For differencekrav, se: `docs/implementation/implementering-differencekrav.md`.

---
> Arbejdsdokument for planlægning og implementering af Erhvervsevnetab-siden.
> Opdateres løbende i denne tråd.

---

## Status

Erhvervsevnetab-siden er under aktiv implementering. Fane 2 (Løbende ydelser) er implementeret.

Sektion 8 (løbende ydelser) er dokumenteret og verificeret mod konkrete beregningseksempler, herunder fuldt layout for fane 2.

Sektion 9 og 10 (kapitalisering, fane 3) er nu dokumenteret samlet, inkl. beregningslogik, layout og issue-katalog. Der er i første implementering ingen særskilte warnings på fane 3.

Fane 2 er fuldt specificeret — ingen uafklarede punkter.

Differencekrav (fane 5) er udskilt til en selvstændig fil: `docs/implementation/implementering-differencekrav.md`.

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
| `fodselsdato` | Tabelopslag i kapitaliseringsbekendtgørelse, aldersberegning |

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
Alle skadelidte har en folkepensionsalder/ophørsalder, som i denne løsning alene bestemmes via opslag i den kapitaliseringsbekendtgørelse, der gælder for skadelidte på kontroltidspunktet.

Hvis skadelidtes fødselsdato ligger før den laveste `foedselsdatoFra` i bekendtgørelsens tabelvalg for det relevante skadesinterval, skal folkepensionsalderen ikke behandles som ukendt. I stedet anvendes følgende normative fortolkning, som anses for den korrekte historiske afspejling af folkepensionsalderen/ophørsalderen for disse ældre fødselskohorter:

- født i første halvår 1955: `66,5 år`
- født i andet halvår 1954: `66 år`
- født i første halvår 1954: `65,5 år`
- født i 1953 eller tidligere: `65 år`

Denne regel er en del af den autoritative opslagslogik for folkepensionsalder. Den er ikke en midlertidig fallback og må ikke behandles som sådan i kode, dokumentation eller dataudtræk.

Ved kapitalisering skal folkepensionsalder/tabelvalg i stedet bestemmes ud fra den konkrete kapitaliseringsbekendtgørelse/vejledning, der er valgt for sagen.

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
| Køn | Dropdown | — | Vises kun hvis skadesdato er før 2015-03-01. Valg: `Mand`, `Kvinde`. Bruges kun ved opslag i historiske, kønsopdelte kapitaliseringstabeller. |
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
| 5 | Kapitaliseringsdato | Datofelt | Min: afgørelsesdato (fallback: 2005-01-01), max: min(DATE_EET_MAX, beregningsdato hvis udfyldt) | Redigerbar. Viser fejlmeddelelse hvis udfyldt og afgørelsestype er `Midlertidig` eller ikke er valgt. |
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
| `Midlertidig` / ikke valgt | Feltet er udfyldt | Fejl: kapitalisering ikke mulig ved midlertidig eller ikke-valgt afgørelse |
| `Endelig` | EET % udfyldt og < 50 %, og samlet kapitaliseringsprocent (aktuel + tidligere kapitaliseringsprocenter) ≠ EET % | Fejl: tvungen fuld kapitalisering ved endeligt EET under 50 % |
| `Endelig` | EET % udfyldt og ≥ 50 %, og kapitaliseringsprocent > 50 % | Fejl: kapitalisering kan højst udgøre 50 % |
| `Endelig` | Kapitaliseringsprocent > EET % | Fejl: kapitalisering kan ikke overstige EET % |
| `Delvist endelig` | Feltet er tomt | Fejl: kapitaliseringsprocent er påkrævet ved delvist endelig afgørelse |
| `Delvist endelig` | Kapitaliseringsprocent < 5 % | Fejl: mindste kapitaliserbare andel er 5 % |
| `Delvist endelig` | Kapitaliseringsprocent > min(EET % − 5, 50 %) | Fejl: kapitaliseret andel overstiger tilladt maksimum (der skal restere mindst 5 % som midlertidig, og kapitalisering kan højst udgøre 50 %) |
| `Delvist endelig` | Kapitaliseringsprocent > EET % | Fejl: kapitalisering kan ikke overstige EET % |
| `Endelig` / `Delvist endelig` | Kapitaliseringsdato < afgørelsesdato | Fejl: kapitaliseringsdato kan ikke være før afgørelsesdato |
| `Endelig` | Skadelidte er `≤ 2 år` fra folkepensionsalderen på kontroltidspunktet, og kapitaliseringsdato ≠ afgørelsesdato | Fejl: ved < 2 år til folkepension sker kapitalisering fra afgørelsesdagen |
| `Endelig` / `Delvist endelig` | Kapitaliseringsprocent er udfyldt, men kapitaliseringsdato er tom | Fejl: der er indtastet kapitaliseringsprocent men ikke -dato |
| `Endelig` / `Delvist endelig` | Kapitaliseringsdato er udfyldt, men kapitaliseringsprocent er tom | Fejl: der er indtastet kapitaliseringsdato men ikke -procent |

**Opslagslogik for kapitaliseringsdato — bekendtgørelsesvalg:**

For hver afgørelsesrække gælder følgende prioriterede logik ved valg af bekendtgørelse til kapitaliseringsberegningen:

1. Hvis kolonne 7 (tidligere kap.dato) er udfyldt → opslag på denne dato
2. Ellers hvis kolonne 5 (kapitaliseringsdato) er udfyldt → opslag på denne dato
3. Ellers → ingen kapitalisering kan beregnes; rækken giver en blokerende fejl på kapitaliseringsfanen

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

### Folkepensionsalder

Der findes ingen separat central folkepensionsalder-fil for EET-kapitalisering. Folkepensionsalder/ophørsalder fastsættes udelukkende via tabelvalg-data i den relevante kapitaliseringsbekendtgørelse samt den normative før-minimum-fødselsdato-regel beskrevet i sektion 3, når kilden starter sine fødselsintervaller senere end de ældste berørte fødselskohorter.

### PDF-hjælperen

Kører lokalt af udvikler én gang om året. Læser PDF-filen fra en lokal mappe, udtrækker tabeller og særfaktor, og genererer en ny `[nr]-[år].ts`-fil. Modelleret efter `scripts/import-offentlig-loen.mjs`. Efter kørsel skal udvikler manuelt gennemgå den genererede fil og verificere at alle værdier er korrekt udtrukket, da PDF-filernes layout varierer fra år til år.

---

## 6. Forretningslogik

### Kapitaliseringsfaktor — beregningsregler

Der gælder tre tilfælde afhængigt af skadelidtes alder på **kapitaliseringstidspunktet**, opgjort i år og måneder.

**Kapitaliseringstidspunktet** betyder:
- normalt: kapitaliseringsdatoen
- ved genoptagelse: den tidligere kapitaliseringsdato (kolonne 7)

Undtagelse: Den særskilte kontrol af om skadelidte er `≤ 2 år` fra folkepensionsalderen foretages ikke på kapitaliseringstidspunktet, men efter den særlige regel i afsnittet "Kapitalisering ved ≤ 2 år til folkepensionsalderen (FP)" nedenfor.

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

Kapitaliseringsbekendtgørelsesoversigten vedligeholdes centralt i `src/data/kapitalisering/kapitaliseringsbekendtgørelser.ts` og gengives ikke her.


### Valg af tabel inden for bekendtgørelsen

Opslag sker på **skadesdato** og **fødselsdato** i den konkrete kapitaliseringsbekendtgørelse.

Der må ikke bruges nogen separat fallback-kilde til at fastsætte folkepensionsalderen i dette opslag. Hvis fødselsdatoen ligger før den laveste `foedselsdatoFra` i det relevante skadesinterval, anvendes i stedet den normative kohorteregel for `66,5 / 66 / 65,5 / 65 år`.

Folkepensionsalderen, der anvendes i kapitaliseringen, er den som fremgår af den valgte kapitaliseringsbekendtgørelse/vejledning for det relevante fødselsdatoesnit.

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

Fødselsdato og folkepensionsalder kan begge fremgå i tabelvalg-data i bekendtgørelsesfilen, men den deterministiske opslagsnøgle er fødselsdato-grænserne i den valgte bekendtgørelse.

### Kapitalisering ved ≤ 2 år til folkepensionsalderen (FP)

Hvis skadelidte er ≤ 2 år fra sin folkepensionsalder på det relevante **kontroltidspunkt**, tilsidesættes den ordinære tabelopslag og interpolationsberegning. Der bruges i stedet den særlige kapitaliseringsfaktor fra den bekendtgørelse der gælder på dette kontroltidspunkt. Faktoren er ét fast tal og er uafhængig af alder.

**Kontroltidspunktet** er:
- normalt: afgørelsesdatoen
- ved genoptagelse: den oprindelige kapitaliseringsdato (kolonne 7)

Det er altså ikke altid den aktuelle afgørelsesdato der bruges ved genoptagelse. Ved genoptagelse låses vurderingen til den oprindelige kapitaliseringsafgørelse.

Den fulde beregningssekvens for dette tilfælde er beskrevet i sektion 9 (trin 0). Vurderingen foretages på baggrund af folkepensionsalderen i den bekendtgørelse der er gældende på kontroltidspunktet for skadelidtes fødselsdato.

### Kapitaliseringsdato

Angives manuelt af brugeren. Standardantagelse er afgørelsesdatoen, men i praksis er det oftest den 1. i næstkommende måned efter afgørelsesdatoen.

Undtagelser:
- ved kapitalisering under `≤ 2 år` til folkepension skal kapitaliseringsdatoen være lig afgørelsesdatoen
- ved genoptagelse fra 1. juli 2024 eller senere skal kapitaliseringsdatoen være lig afgørelsesdatoen

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

---

## 9. Beregningslogik — Kapitaliseret EET (fane 3)

Kapitaliseringen omsætter en løbende ydelse — helt eller delvist — til et éngangsbeløb.

### Overordnet princip

Et antal procentpoint (kapitaliseringsprocenten, angivet af brugeren på fane 1) udgår som løbende ydelse og danner grundlag for et kapitaliseret beløb. Beregningssekvensen er:

1. **Forhåndsvurdering** — afgør om særfaktor (≤ 2 år til folkepension) skal bruges, og find i så fald den gældende bekendtgørelse på det relevante **kontroltidspunkt**.
2. Hvis særfaktor ikke gælder: find den gældende bekendtgørelse på **kapitaliseringsdatoen** (eller tidligere kap.dato ved genoptagelse).
3. Beregn grundydelse for de kapitaliserede procentpoint.
4. Regulér grundydelsen til årsydelse på kapitaliseringstidspunktet.
5. Beregn kapitaliseringsfaktoren ud fra skadelidtes alder.
6. Kapitalbeløbet = årsydelse × kapitaliseringsfaktor.

Trin 3–4 genbruger 1-til-1 systematikken fra løbende ydelser (`eetLoebendeYdelserCalculation.ts`). Der må ingen afvigelser være for disse trin — hverken i formler, afrunding, niveauskift (2003/2024) eller regulering.

### Trin 0 — Forhåndsvurdering: ≤ 2 år til folkepension?

Inden den ordinære kapitaliseringssekvens vurderes om skadelidte er ≤ 2 år fra sin folkepensionsalder på det relevante **kontroltidspunkt**.

**Kontroltidspunktet** er:
- normalt: afgørelsesdatoen
- ved genoptagelse: den tidligere kapitaliseringsdato (kolonne 7)

**Fremgangsmåde:**

1. Find den kapitaliseringsbekendtgørelse der er gældende på **kontroltidspunktet** (opslag på skadesdato + kontroltidspunkt).
2. Slå folkepensionsalderen op i denne bekendtgørelses tabelvalg-data for skadelidtes fødselsdato. Hvis fødselsdatoen ligger før den laveste `foedselsdatoFra` i det relevante skadesinterval, anvendes den normative kohorteregel for ældre fødselsdatoer (`66,5 / 66 / 65,5 / 65 år`).
3. Beregn skadelidtes alder på kontroltidspunktet (i hele opnåede år og måneder).
4. Hvis `folkepensionsalder − alder ≤ 2 år`: anvend særfaktoren fra bekendtgørelsen gældende på kontroltidspunktet direkte. Gå ikke videre til ordinær tabelopslag. Kapitaliseringsfaktoren er særfaktoren.
5. Hvis `folkepensionsalder − alder > 2 år`: fortsæt til ordinær kapitaliseringssekvens (trin 1–5 nedenfor).

Vurderingen foretages i hele opnåede år og måneder — dage ignoreres (svarende til aldersopgørelse andetsteds i systemet).

Særfaktoren varierer fra bekendtgørelse til bekendtgørelse og læses fra den relevante bekendtgørelsesfil.

### Trin 1 — Valg af kapitaliseringsbekendtgørelse (ordinær sekvens)

Gælder kun hvis trin 0 ikke udløste særfaktor.

Opslagsgrundlaget bestemmes efter prioriteret logik (svarende til sektion 4, opslagslogik for kapitaliseringsdato):

1. Hvis kolonne 7 (tidligere kap.dato) er udfyldt → opslag på denne dato (**genoptagelse**)
2. Ellers hvis kolonne 5 (kapitaliseringsdato) er udfyldt → opslag på denne dato
3. Ellers → beregningen kan ikke gennemføres; rækken giver blokerende fejl

Selve opslagslogikken (skadesdato × kapitaliseringsdato → bekendtgørelse) er beskrevet i sektion 6.

**Ved genoptagelse** gælder: beregningen foretages som om kapitaliseringen skete på den tidligere kapitaliseringsdato i alle henseender — herunder kontrol af `≤ 2 år til FP`, bekendtgørelsesvalg, tabelvalg, folkepensionsalder og kapitaliseringsfaktor — med den ene undtagelse at reguleringen i trin 3 sker frem til årstallet for den **nye** kapitaliseringsdato (kolonne 5), ikke den gamle.

### Trin 2 — Valg af tabel og folkepensionsalder

Inden for den fundne bekendtgørelse opslås tabel og folkepensionsalder på baggrund af skadesdato og fødselsdato, bortset fra de tidligste historiske bekendtgørelser hvor kilden ikke arbejder med fødselsdato-intervaller. For disse bruges den særskilte historiske tabelvalgskontrakt uden fødselsdato, hvor ophørsalder og tabel er knyttet direkte til skadesdato-intervallet. Hvis fødselsdatoen i et fødselsdato-baseret tabelvalg ligger før den laveste `foedselsdatoFra` for det relevante skadesinterval, anvendes den normative kohorteregel for ældre fødselsdatoer (`66,5 / 66 / 65,5 / 65 år`) som korrekt historisk folkepensionsalder. Opslagslogikken er beskrevet i sektion 6.

### Trin 3 — Grundydelse og regulering til kapitaliseringstidspunktet

Grundydelse beregnes for de kapitaliserede procentpoint. Beregningen genbruger 1-til-1 systematikken fra løbende ydelser:

```
grundydelse = round2(grundløn × kap_pct × erstatningsniveau × amFaktor)
```

- `grundløn`, `erstatningsniveau`, `amFaktor` og niveauskiftet 2003/2024: identisk med løbende ydelser
- `kap_pct`: de procentpoint der kapitaliseres (brugerens input, ikke den samlede EET %)

Reguleringen sker til årsydelsen på kapitaliseringstidspunktet. Reguleringssatsen følger **kalenderåret** for kapitaliseringsdatoen — datoen inden for året er uden betydning. Ved genoptagelse bruges kalenderåret for den **nye** kapitaliseringsdato.

Reguleringen på ASL-sporet er et **rent tabelopslag**, ikke en kædeberegning:
- hvis kapitaliseringsåret er 2026, bruges satsen for 2026 direkte
- hvis kapitaliseringsåret er 2025, bruges satsen for 2025 direkte
- osv.

Dette gælder både løbende ydelser og kapitalisering.

Kun EET efter EAL bruger kædeopregning på tværs af flere år. EAL-regulering og ASL-regulering må aldrig dele helper eller beregningssti.

Årsydelsen afrundes til 2 decimaler — der sker **ikke** oprunding til nærmeste tal deleligt med 12 (`ceil12`), som ellers gælder for løbende ydelser:

```
årsydelse = round2(reguleringsgrundlag × reguleringsfaktor)
```

Hvor:

- `reguleringsfaktor` er den direkte tabelfaktor for kapitaliseringsåret efter ASL-reglerne
- `reguleringsgrundlag` er:
  - `grundydelse`, hvis skaden er fra 2024-07-01 eller senere
  - `grundydelse × (1 + reguleringsprocentErhvervsevnetabFoer2024[2024])`, hvis skaden er før 2024-07-01 og kapitaliseringsåret er 2024 eller senere
  - ellers `grundydelse`

Kapitalisering genbruger dermed samme ASL-reguleringssystematik som løbende ydelser:
- 2005-2023: direkte opslag i `reguleringsprocentErhvervsevnetab[år]`
- 2024 for skader før 2024-07-01: niveauskift via `reguleringsprocentErhvervsevnetabFoer2024[2024]`, hvorefter selve årsfaktoren for 2024 er `1`
- 2024 og frem på nyt niveau: direkte opslag i `reguleringsprocentErhvervsevnetabFra2024[år]`

### Trin 4 — Kapitaliseringsfaktor

Faktoren beregnes ud fra skadelidtes alder i **år og måneder** på det effektive kapitaliseringstidspunkt (kolonne 7 hvis udfyldt, ellers kolonne 5), efter de tre tilfælde i sektion 6.

- Tilfælde 1: alder inden for tabellens interval → interpolation på måneder
- Tilfælde 2: alder over tabellens interval, men > 2 år fra FP → lineær interpolation mod særfaktor
- Tilfælde 3: særfaktor direkte (se trin 0)

```
kapFaktor = round3(tabelopslag_med_interpolation)
```

Indtil videre lægges beregningsteknisk til grund, at alle kapitaliseringsbekendtgørelser anvender månedsafhængige mellemfaktorer. Feltet "Faktor måneds-afhængig?" vises derfor som `Ja` for alle afgørelser.

### Trin 5 — Kapitalbeløbet

```
kapitalbeløb = ceil0(årsydelse × kapFaktor)
```

Afrunding: kapitalbeløbet afrundes **op** til nærmeste hele krone (0 decimaler).

Afrundingshelpers fra `src/utils/rounding.ts`:
- `round2`: `roundByMethod(value, 2, 'halfAwayFromZero')`
- `round3`: `roundByMethod(value, 3, 'halfAwayFromZero')`
- `ceil0`: `roundByMethod(value, 0, 'ceil')`

Hver afgørelse giver sit eget kapitalbeløb. Der beregnes ingen samlet sum på tværs af afgørelser.

---

## 10. Layout — Fane 3 (Kapitalisering)

Fanen følger den fælles beregningsfanestruktur beskrevet i sektion 4. Systematik for fejl/advarsler, hoverrows og download følger fane 2 (løbende ydelser) med de afvigelser der er angivet nedenfor.

### ContentBox: Fejl og advarsler

Vises øverst — kun når der er mindst én fejl eller advarsel. Følger præcis samme systematik som fane 2:

- Fejl vises med `ErrorOutline` (rød), advarsler med `WarningAmber` (orange).
- Hver linje er en hoverrow med navigation til det relevante inputfelt.
- Fejl der stammer fra inputfelter på fane 1 og har betydning for kapitalisering, gengives her.
- Der er pt. ingen særskilte advarsler på denne fane.
- Blokerende fejl skjuler "Beregning"-ContentBox og alle afgørelses-ContentBoxe — kun fejl/advarsler-boksen vises.

#### Teknisk systematik for fejl/advarsler på fane 3

Fane 3 følger samme grundmønster som fane 4:

1. Alle linjer repræsenteres som `EetKapitaliseringIssue` med:
   - `id`
   - `severity` (`error` eller `warning`)
   - `message`
2. Domænelogik i `computeEetKapitaliseringCalculation` opretter beregningsrelaterede issues.
3. Feltvalideringsfejl fra inputs hentes separat via `useFormFieldErrors(...)` og konverteres til `field-*` issues.
4. De to kilder merges i `EetKapitaliseringTab` og deduplikeres på meddelelsestekst.
5. Mindst én `error` skjuler "Beregning" og alle afgørelsesbokse og blokerer download.
6. Navigation fra issue-linje til inputsektion styres centralt i `resolveIssueNavigation(issueId)`.

#### Issue-katalog (fane 3)

Domænefejl:

Fejltekster på fane 3 skal så vidt muligt være årsagsspecifikke og pege på den konkrete manglende oplysning eller den konkrete manglende faktor, ikke kun på et generisk tabelopslag.

| Issue ID | Severity | Triggerbetingelse |
|---|---|---|
| `aarsloen-missing` | error | ASL-årsløn mangler. |
| `fodselsdato-missing` | error | Fødselsdato mangler i stamdata. |
| `skadesdato-missing` | error | Skadesdato mangler i stamdata. |
| `kapitaliseringsbekendtgoerelse-missing-control-date` | error | Der findes ingen gyldig kapitaliseringsbekendtgørelse for kontroltidspunktet i trin 0. |
| `kapitaliseringsbekendtgoerelse-missing-effective-date` | error | Der findes ingen gyldig kapitaliseringsbekendtgørelse for den effektive kapitaliseringsdato i trin 1. |
| `kapitaliseringstabel-missing` | error | Bekendtgørelsen indeholder intet matchende tabelvalg for kombinationen af skadesdato og fødselsdato. |
| `kapitaliseringsalder-under-minimum` | error | Skadelidtes alder på kapitaliseringstidspunktet ligger under tabellens laveste alder. |
| `kapitaliseringsfaktor-unresolved` | error | Kapitaliseringsfaktor kan ikke beregnes ud fra tabeldata og særfaktor. |
| `reguleringssats-missing` | error | Nødvendig reguleringssats mangler for et eller flere år. |
| `kap-dato-without-kap-pct` | error | Mindst én kapitaliserbar afgørelse har kapitaliseringsdato men ikke kapitaliseringsprocent. |
| `kap-pct-without-kap-dato` | error | Mindst én kapitaliserbar afgørelse har kapitaliseringsprocent men ikke kapitaliseringsdato. |

Derudover gengives som `field-*` issues med `error` severity:

- alle feltfejl fra contentboxen **Arbejdsskadesikringsloven** på fane 1
- `field-fodselsdato` fra stamdata
- `field-skadesdato` fra stamdata

Hvis en historisk, kønsopdelt tabel skal anvendes, og `Køn` ikke er valgt, må kapitaliseringsfaktoren ikke udledes ved gæt. Beregningen skal i stedet fejle synligt via `kapitaliseringstabel-missing`.

Følgende gengives **ikke** på fane 3:

- feltfejl fra contentboxen **Erstatningsansvarsloven**
- feltfejl på **Beregningsdato**, da feltet ikke indgår i kapitaliseringsberegningen

Der er ingen særskilte warnings på fane 3 i første implementering.

### ContentBox: Beregning

| Række | Label (venstre) | Indhold (højre) |
|---|---|---|
| 1 | Download specifikation | Download-ikon (disabled, tooltip: "Download bliver tilgængelig, når PDF-specifikationen er defineret") |

Ingen beregningsdato-række på denne fane — kapitaliseringsdatoen fremgår per afgørelse.

### Ingen kapitaliserede afgørelser

Hvis der ingen afgørelser er med kapitaliseringsprocent > 0, vises en TextHoverRow med teksten "Der er ingen kapitaliserede afgørelser i sagen." — svarende til mønsteret på fane 2 ("Afgørelsen giver ingen løbende ydelse i den valgte periode."). "Beregning"-ContentBox vises stadig.

### ContentBox per kapitaliseret afgørelse

Én ContentBox per afgørelse der har en kapitaliseringsprocent > 0. Afgørelser uden kapitalisering vises ikke på denne fane.

**Overskrift:** `Afgørelse [d. MMMM YYYY]` — afgørelsesdatoen i langt format, svarende til systematikken på fane 2.

Rækkerne inden for hver ContentBox vises i følgende rækkefølge:

#### Blok 1 — Grundydelse og regulering

| Række | Label (venstre) | Indhold (højre) |
|---|---|---|
| 1 | Kapitaliseringsdato | `DD-MM-YYYY` |
| 2 | Kapitalisering | `[kap.pct] %` |
| 3 | Grundydelse ([kap.pct] %): `Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) = [grundløn] kr. × [kap.pct] % × 83 % × 92 % =` | `[grundydelse] kr.` (2 decimaler) |
| 4 | Reguleringsprocent ([kapitaliseringsdato lang]) | `[regulering] %` |
| 5 | Årlig ydelse på kapitaliseringstidspunkt | `[reguleret_ydelse] kr.` (2 decimaler) |

Række 3's formeltekst varierer efter erstatningsniveau (83 %/80 %) og AM-bidragsstatus, svarende til systematikken i den udvidede specifikation på fane 2.

Reguleringsprocenten (række 4) vises med op til 4 decimaler med trimmede efterfølgende nuller, svarende til systematikken på fane 4.

#### Blok 2 — Kapitaliseringsbekendtgørelse og tabel

| Række | Label (venstre) | Indhold (højre) |
|---|---|---|
| 1 | Kapitaliseringsbekendtgørelse | `[bkg/vejl.] [nr]/[år], tabel [bogstav]` — fx "Vejl. 10029/2024, tabel B" |
| 2 | Folkepensionsalder | `[alder] år` |
| 3 | Særfaktor (< 2 år til folkepension) | `[særfaktor]` — fx "1,245" |

#### Blok 3 — Kapitaliseringsfaktor

| Række | Label (venstre) | Indhold (højre) |
|---|---|---|
| 1 | Alder ved kapitalisering | `[år] år, [måneder] måneder` |
| 2 | Faktor måneds-afhængig? | `Ja` |
| 3 | Kapitaliseret pga. < 2 år til folkepension? | `Ja` / `Nej` |
| 4 | Kapitaliseringsfaktor | `[faktor]` — fx "5,312" |

#### Blok 4 — Kapitalbeløb

| Række | Label (venstre) | Indhold (højre) |
|---|---|---|
| 1 | Beregnet kapitalbeløb | `[beløb] kr.` (0 decimaler, fed) |

### Eksempler (verificerede)

**Afgørelse 1. juli 2025**

| Felt | Værdi |
|---|---|
| Kapitaliseringsdato | 01-10-2025 |
| Kapitalisering | 25 % |
| Grundydelse (25 %): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) = 432.000 kr. × 25 % × 83 % × 92 % = | 82.468,80 kr. |
| Reguleringsprocent (1. oktober 2025) | 3,90 % |
| Årlig ydelse på kapitaliseringstidspunkt | 85.685,08 kr. |
| Kapitaliseringsbekendtgørelse | Vejl. 10029/2024, tabel B |
| Folkepensionsalder | 68 år |
| Særfaktor (< 2 år til folkepension) | 1,245 |
| Alder ved kapitalisering | 59 år, 8 måneder |
| Faktor måneds-afhængig? | Ja |
| Kapitaliseret pga. < 2 år til folkepension? | Nej |
| Kapitaliseringsfaktor | 5,312 |
| **Beregnet kapitalbeløb** | **455.160 kr.** |

**Afgørelse 1. november 2025**

| Felt | Værdi |
|---|---|
| Kapitaliseringsdato | 15-07-2026 |
| Kapitalisering | 25 % |
| Grundydelse (25 %): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag) = 432.000 kr. × 25 % × 83 % × 92 % = | 82.468,80 kr. |
| Reguleringsprocent (15. juli 2026) | 8,90 % |
| Årlig ydelse på kapitaliseringstidspunkt | 89.808,52 kr. |
| Kapitaliseringsbekendtgørelse | Vejl. 10056/2025, tabel C |
| Folkepensionsalder | 68 år |
| Særfaktor (< 2 år til folkepension) | 1,246 |
| Alder ved kapitalisering | 60 år, 6 måneder |
| Faktor måneds-afhængig? | Ja |
| Kapitaliseret pga. < 2 år til folkepension? | Nej |
| Kapitaliseringsfaktor | 4,798 |
| **Beregnet kapitalbeløb** | **430.902 kr.** |

---
