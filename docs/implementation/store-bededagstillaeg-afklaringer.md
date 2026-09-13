# Store Bededagstillæg – afklaringer før implementering

## Kortlægning

Den nuværende automatiske regel er ikke kun ét sted. Den indgår i EO's ansættelsesforhold i:

- lønindkomstens satser og årslønsberegning,
- alle reguleringsformer, herunder manuel, privat og offentlig overenskomst, KRL og statistik,
- EO-inspektionens løn- og reguleringstabeller,
- regulerings- og lønindkomstdokumenter.

I disse forløb er den nuværende betingelse `Løn på helligdage = Almindelig løn` sammen med datoen fra 1. januar 2024. Det bekræfter din antagelse for ansættelsesforholdene.

Der er samtidig to beslægtede, men selvstændige flader:

1. **Angivet måneds-/dagsløn** på EO-siden bruger samme automatiske regel og har samme dropdown, men intet ansættelsesforholdskort.
2. **Årsløn-siden** har et manuelt, synligt felt for Store Bededagstillæg. Den beregner ikke automatisk satsen og er ikke bundet til EO's ansættelsesforhold.

Den nye toggle er sagsdata: den skal være et persisteret felt pr. ansættelsesforhold, indgå i den typed reader-projektion og i alle relevante dokument- og beregningsprojektioner. Tidligere `.eo`-filer kan migreres tavst med en eksplicit load-policy, uden ændrede preflight-tal eller besked til brugeren.

## Spørgsmål, forståelse og anbefaling

### 1. Omfang: kun ansættelsesforhold eller også angivet løn?

**Min forståelse:** Kravet taler konsekvent om »det enkelte ansættelsesforhold«, om rækken under dropdownen på ansættelsesforholdskortet og om advarsel per ansættelsesforhold. Det peger på, at ændringen kun gælder `loenindkomstAnsaettelsesforhold` i beregningsperioden.

**Problem:** EO's alternative beregningsformer »Angivet månedsløn« og »Angivet dagsløn« får i dag også automatisk Store Bededagstillæg, alene fordi deres fælles dropdown står på »Almindelig løn«. De har ikke et ansættelsesforhold, hvor den beskrevne toggle kan placeres.

**Anbefaling:** Afgræns denne ændring til ansættelsesforholdene og behold den eksisterende automatiske regel for angivet løn, indtil der foreligger et særskilt krav for den flade. Hvis intentionen derimod er »ingen automatisk Store Bededag nogen steder«, skal jeg tilføje en tilsvarende toggle i EO-oplysninger for angivet løn og migrere den også.

**Beslutning ønskes:** Skal angivet måneds-/dagsløn omfattes?

**Svar**
Ingen automatisk store bededags tillæg. tilføj også en toggle for angivet løn.

### 2. Standardværdi i nye ansættelsesforhold

**Min forståelse:** Toggle-værdien skal alene afgøre, om tillægget beregnes, og et nyt ansættelsesforhold med »Almindelig løn« skal derfor vise rækken.

**Problem:** Kravet fastlægger ikke toggleens værdi, før brugeren aktivt ændrer den. `true` bevarer den nuværende beregning, men er i praksis fortsat en automatisk tilkobling. `false` betyder, at tillægget først kommer med efter et eksplicit tilvalg, men ændrer beregningen i nye sager, indtil brugeren vælger det. Begge er synlige beregningsændringer.

**Anbefaling:** Brug `false` som den sikre default for nye ansættelsesforhold. Det stemmer med »hvis brugeren har sat ... til TRUE« og med den generelle konservative schema-regel. Gamle filer får særskilt `true`, hvor de allerede havde »Almindelig løn«, præcis som du har krævet.

**Beslutning ønskes:** Skal nye ansættelsesforhold starte med toggle `false` eller `true`?

**Svar**
Enig.

### 3. Hvad sker der med værdien, når rækken skjules?

**Min forståelse:** Når »Løn på helligdage« ændres væk fra »Almindelig løn«, må Store Bededagstillæg ikke beregnes, uanset den gemte toggle-værdi. Ændres valget tilbage, må en tidligere `true`-værdi igen kunne gælde, hvis programmet følger reglen om at skjulte værdier bevares, men ikke bruges.

**Anbefaling:** Bevar toggle-værdien i sagen, men gate konsekvent alle beregninger, tabeller og dokumenter på både `Almindelig løn` og toggle `true`. Det undgår skjult datatab og betyder, at brugeren ikke mister sit tidligere valg ved et midlertidigt skift i dropdownen.

**Beslutning ønskes:** Bekræft at den skjulte toggle skal bevares og genaktiveres ved et senere skift tilbage til »Almindelig løn«, men være helt uden virkning imens.

**Svar**
Enig.

### 4. Endelig brugervendt tekst

**Min forståelse:** Den nye række skal placeres direkte under »Løn på helligdage« og kun vises ved »Almindelig løn«. Advarslen skal være ikke-blokerende i EO-beregningens eksisterende boks »Fejl og advarsler«.

**Anbefaling:** Brug disse konkrete tekster:

- Togglelabel: `Beregn Store Bededagstillæg fra 1. januar 2024:`
- Advarsel: `Der vil sædvanligvis være krav på Store Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.`

Jeg foreslår »fra« frem for »per«, da satsen gælder fra en dato. Jeg foreslår også den eksisterende dropdowns faktiske betegnelse »almindelig løn på helligdage«, så brugeren kan se præcis hvilket valg advarslen vedrører.

**Beslutning ønskes:** Godkend teksterne eller giv den præcise ordlyd.

**Svar**
Enig

### 5. Advarslens afgrænsning i tid

**Min forståelse:** Advarslen skal vises, når et ansættelsesforhold har »Almindelig løn« og toggle `false`.

**Problem:** Et ansættelsesforhold kan have en TAF-/reguleringsperiode, der slutter før 1. januar 2024. I den situation kan et Store Bededagstillæg ikke påvirke den konkrete opgørelse, selv om dropdownen og togglen har de nævnte værdier. En advarsel dér vil være sagligt rigtig som generel oplysning, men irrelevant for beregningen.

**Anbefaling:** Vis kun advarslen, når ansættelsesforholdets relevante TAF-periode når 1. januar 2024. Det gør advarslen handlingsrelevant og undgår støj. Hvis du bevidst ønsker den som en generel juridisk påmindelse, kan den vises uanset periode.

**Beslutning ønskes:** Skal advarslen være periodeafhængig eller altid vises ved `Almindelig løn` + `false`?

**Svar**
Enig

## Fastlagt kompatibilitetsforløb

Når beslutningerne ovenfor er bekræftet, implementeres load sådan for hver tidligere `.eo`-version:

| Tidligere feltet findes ikke | Løn på helligdage | Ny toggle ved load | Synlig besked |
| --- | --- | --- | --- |
| Ja | Almindelig løn | `true` | Ingen |
| Ja | SH-udbetaling eller Ingen | `false` | Ingen |

Migreringen indsætter kun det manglende felt. En fil, der allerede indeholder feltet, beholder altid sin egen værdi. Det gælder også den aktive browser-session, så en sag åbnet før release ikke mister sin hidtidige beregning ved F5.
