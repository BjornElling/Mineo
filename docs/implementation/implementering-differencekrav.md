# Implementering — Differencekrav

Denne fil beskriver implementeringen af differencekravet (fane 5 på Erhvervsevnetab-siden).

For løbende erhvervsevnetab (ASL), se: `docs/implementation/implementering-loebende-eet.md`.
For kapitaliseret erhvervsevnetab (ASL) og EET efter EAL, se: `docs/implementation/implementering-kapitaliseret-eet.md`.

---
> Arbejdsdokument for planlægning og implementering af differencekravet.
> Opdateres løbende i denne tråd.

---

## Status

Beregningslogik (sektion 3), brugerflade (sektion 4) og fejl/advarsler (sektion 5) er fuldt dokumenteret. Verificeret taleksempel tilføjet (sektion 3). Filen er klar til implementering.

Forudsætning: fane 2's issue-katalog skal udvides med stabile ID'er for de fire kapitaliseringsrelaterede fejl (se sektion 5, ikke-blokerende issues) inden fane 5 implementeres.

---

## 1. Implementeringsregler

### Filens formål
Denne fil er en komplet, selvstændig implementeringsspecifikation for differencekravet (fane 5). Den skal indeholde tilstrækkelig information til at fanen og al beregningslogik kan udvikles fuldt autonomt uden yderligere afklaring.

### Afhængighed af kanoniske beregningsresultater
Differencekravet beregnes udelukkende på baggrund af resultater fra tre øvrige beregninger:

- **EET efter EAL** (fane 4) — det kapitaliserede EAL-krav
- **Løbende EET** (fane 2) — den løbende ASL-ydelse
- **Kapitaliseret EET** (fane 3) — det kapitaliserede ASL-beløb

For fradrag 2 (kapitaliseret EET) og udgangspunktet (EAL-kravet) er fane 5 udelukkende forbruger — beløbene konsumeres direkte fra fane 3 og fane 4's kanoniske output.

For fradrag 1 (løbende ydelser) gælder en undtagelse: beregningen kan ikke konsumeres direkte fra fane 2, fordi fane 2 beregner frem til og med beregningsdatoen, mens differencekravet kræver frem til og med dagen før. Fane 5 kalder den samme beregningsmotor som fane 2 — 1-til-1 identisk logik, herunder fuld sektion og rest-sektion for alle afgørelser — men med `ophørsdato = beregningsdato − 1 dag` i stedet for beregningsdato. Dette er ikke duplikering af logik, men en parametriseret kørsel af den eksisterende motor med en anden slutdato.

For fradrag 3 (proformakapitalisering) gælder tilsvarende: beregningen genbruger kapitaliseringsmotoren fra fane 3 direkte, med beregningsdatoen som kapitaliseringsdato.

### Isolation
Differencekravet tilhører udelukkende fane 5. Ingen logik, state eller mellemresultater flyder fra fane 5 til andre faner.

---

## 2. Begrebsafklaring

### Differencekrav
Differencekravet er forskellen mellem EET efter EAL og EET efter ASL, når EAL-beregningen er den største. Hvis ASL-erstatningen er større end eller lig med EAL-erstatningen, er der intet differencekrav.

---

## 3. Beregningslogik

### Overordnet princip

Differencekravet er EET efter EAL fratrukket visse ydelser efter ASL, opgjort per beregningsdatoen. Bliver det beregnede differencekrav negativt, sættes det til 0 kr.

### Beregningssekvens

**Udgangspunkt: EAL-kravet**

Beregningen tager udgangspunkt i det beregnede EAL-krav fra fane 4 (`eal_krav`).

---

**Fradrag 1 — Løbende ydelser (ASL)**

Der beregnes en særskilt opgørelse af løbende ydelser til brug for differencekravet. Denne beregning følger nøjagtig samme logik som fane 2, med én afvigelse:

- Fane 2 beregner løbende ydelser frem til og med **beregningsdatoen** (inklusiv).
- Differencekravets beregning af løbende ydelser dækker frem til og med **dagen før beregningsdatoen** (eksklusiv beregningsdatoen).

Denne forskel er bevidst og skal fremgå tydeligt af beregningsspecifikationen.

Fratrækket for løbende ydelser sker **per afgørelse** og er betinget:

| Skadesdato | Afgørelsestype | Fratrækkes? |
|---|---|---|
| Før 16. juni 2011 | `Midlertidig` | Ja |
| Før 16. juni 2011 | `Delvist endelig` | Ja |
| Før 16. juni 2011 | `Endelig` | Ja |
| 16. juni 2011 eller senere | `Midlertidig` | Nej |
| 16. juni 2011 eller senere | `Delvist endelig` | Nej |
| 16. juni 2011 eller senere | `Endelig` | Ja |

En `Delvist endelig` afgørelse behandles i denne sammenhæng på samme måde som en `Midlertidig` afgørelse — den er reelt en midlertidig afgørelse, som er blevet delvist kapitaliseret. Den kapitaliserede del indgår i fradrag 2; den løbende del indgår her, hvis betingelsen er opfyldt.

Fradraget er summen af de løbende ydelsesbeløb for alle afgørelser der opfylder betingelsen ovenfor, beregnet for perioden frem til og med dagen før beregningsdatoen.

---

**Fradrag 2 — Kapitaliseret EET (ASL)**

Det samlede kapitaliserede beløb fra fane 3 fratrækkes i sin helhed. Der beregnes ingen ny eller alternativ kapitaliseringsberegning her — beløbet konsumeres direkte fra fane 3's kanoniske output.

Kun kapitaliseringer med kapitaliseringsdato ≤ beregningsdato medregnes. En kapitalisering dateret efter beregningsdatoen er endnu ikke sket set fra beregningsdatoens perspektiv og tæller ikke med i fradraget.

---

**Fradrag 3 — Proformakapitalisering af tilbageværende løbende EET**

Proformakapitalisering foretages i alle tilfælde, hvor der er tilbageværende løbende erhvervsevnetab efter ASL — dvs. hvor EET-procenten overstiger de allerede kapitaliserede procentpoint på tværs af alle afgørelser.

Det tilbageværende løbende erhvervsevnetab opgøres i procentpoint som én samlet størrelse:

```
løbende_eet_pct = eet_pct_seneste_afgørelse − sum(kapitaliseringsprocent fra afgørelser hvor kap.dato ≤ beregningsdato)
```

`eet_pct_seneste_afgørelse` er EET-procenten fra den senest gældende ASL-afgørelse (dvs. afgørelsen med den seneste afgørelsesdato, efter samme tie-breaking-logik som EAL-fallbackreglen i fane 4).

Kun kapitaliseringer med kapitaliseringsdato ≤ beregningsdato medregnes i summen. En kapitalisering der er dateret efter beregningsdatoen er endnu ikke sket set fra beregningsdatoens perspektiv og tæller derfor ikke med.

En EET-procent kan sættes ned ved en senere afgørelse, men kan ikke reduceres til mindre end det der allerede er kapitaliseret — inputvalideringen på fane 1 håndhæver dette. `løbende_eet_pct` kan derfor aldrig blive negativ.

Eksempel A (stigende EET): Afgørelse 1 midlertidig EET 45 %, afgørelse 2 delvist endelig EET 60 % kap. 20 %, afgørelse 3 endelig EET 75 % kap. 25 % → `løbende_eet_pct = 75 % − (20 % + 25 %) = 30 %`.

Eksempel B (faldende EET): Afgørelse 1 delvist endelig EET 60 % kap. 20 %, afgørelse 2 midlertidig EET 45 % → `løbende_eet_pct = 45 % − 20 % = 25 %`.

Hvis `løbende_eet_pct = 0` (fuld kapitalisering), springes proformakapitaliseringen over — se betingelsen nedenfor.

Proformakapitaliseringen er én samlet beregning — der laves ikke separate beregninger per afgørelse.

Proformakapitaliseringen foretages nøjagtig som en ordinær kapitalisering (fane 3-logik), men med to undtagelser:

- **Alle afgørelsestyper kan indgå** — `Midlertidig` og `Delvist endelig` er ikke udelukket. Det er de tilbageværende, ikke-kapitaliserede procentpoint der kapitaliseres, uanset hvilken afgørelsestype de stammer fra.
- **50 %-loftet gælder ikke** — der kan proformakapitaliseres mere end 50 %.

Kapitaliseringsdatoen er **beregningsdatoen**. Bekendtgørelse og tabel opslås på beregningsdatoen på samme måde som ved ordinær kapitalisering. Kontroltidspunktet for ≤ 2 år til folkepension er ligeledes beregningsdatoen.

Proformakapitaliseringsbeløbet fratrækkes herefter fra EAL-kravet på linje med de øvrige fradrag.

---

**Endeligt differencekrav**

```
differencekrav = eal_krav
              − fradrag_løbende_ydelser
              − fradrag_kapitaliseret_eet
              − proformakapitalisering

hvis differencekrav < 0: differencekrav = 0
```

### Verificeret eksempel

**Stamdata:**
- Skadesdato: 2023 (skadeår 2023, beregningsår 2026)
- Fødselsdato: 08-01-1972
- Beregningsdato: 01-10-2026

**ASL-input:**
- Årsløn: 432.000 kr.
- Afgørelse 1: 12-03-2024, virkningsdato 01-01-2024, EET 75 %, Midlertidig
- Afgørelse 2: 17-09-2025, virkningsdato 01-08-2025, EET 60 %, Endelig, ingen kapitalisering

**EAL-input:**
- Årsløn: 700.000 kr.
- EET: 70 %

**Beregning:**

| Trin | Beskrivelse | Beløb |
|---|---|---|
| EAL-krav (udgangspunkt) | 789.000 × 10 × 70 % = 5.523.000 → aldersreduktion 22 % (alder 51) → 5.523.000 − 1.215.060 | 4.307.940 kr. |
| Fradrag 1: løbende ydelser | Kun endelig afgørelse fratrækkes (skadesdato ≥ 16. juni 2011). Beregning frem til og med **30-09-2026** (dagen før beregningsdatoen 01-10-2026) | − 255.813 kr. |
| Fradrag 2: kapitaliseret EET | Ingen kapitaliserede afgørelser | − 0 kr. |
| Fradrag 3: proformakapitalisering | løbende_eet_pct = 60 % − 0 % = 60 %. Kapitaliseringsdato 01-10-2026. Grundydelse 60 %: 204.697,59 kr. Regulering 8,90 %: årsydelse 222.915,68 kr. Vejl. 10056/2025 tabel A, FP 69 år. Alder 54 år 8 mdr. Faktor 10,267. Beløb: 222.915,68 × 10,267 = 2.288.675,29 → ceil0 | − 2.288.676 kr. |
| **Differencekrav** | 4.307.940 − 255.813 − 0 − 2.288.676 | **1.763.451 kr.** |

---

## 4. Brugerflade (fane 5)

Fanen følger den fælles beregningsfanestruktur beskrevet i `implementering-kapitaliseret-eet.md` sektion 4, med de afvigelser der er angivet nedenfor.

---

### ContentBox: Fejl og advarsler

Fane 5 har ingen egne fejl eller advarsler. ContentBoxen viser fejl og advarsler fra fane 2, 3 og 4 — samlet ét sted, deduplikeret på meddelelsestekst.

**Aggregeringsregel:** Alle issues fra fane 2, 3 og 4 overføres og vises på fane 5, med undtagelse af de issues der er listet i "Ikke-blokerende issues" nedenfor. Alle advarsler (warnings) overføres altid og blokerer ikke download — hverken på deres originale fane eller på fane 5.

**Download-blokering:** Download er deaktiveret så længe der er mindst én aktiv fejl der ikke er undtaget nedenfor.

**Ikke-blokerende issues (overføres og vises, men blokerer ikke download på fane 5):**

Disse fejl vedrører kapitaliseringsberegningen på fane 3, og er kun relevante for differencekravet hvis der faktisk er kapitaliserede afgørelser i sagen. Hvis der ingen kapitaliserede afgørelser er, kan differencekravet stadig beregnes med fradrag 2 = 0 kr.

| Issue ID (fane 3) | Meddelelse |
|---|---|
| `kapitaliseringsbekendtgoerelse-missing-control-date` | Der findes ingen gyldig kapitaliseringsbekendtgørelse for kontroltidspunktet |
| `kapitaliseringsbekendtgoerelse-missing-effective-date` | Der findes ingen gyldig kapitaliseringsbekendtgørelse for den effektive kapitaliseringsdato |
| `kapitaliseringstabel-missing` | Bekendtgørelsen indeholder intet matchende tabelvalg |
| `kapitaliseringsalder-under-minimum` | Skadelidtes alder ligger under tabellens laveste alder |
| `kapitaliseringsfaktor-unresolved` | Kapitaliseringsfaktor kan ikke beregnes |
| `kap-dato-without-kap-pct` | Mindst én afgørelse har kapitaliseringsdato men ikke -procent |
| `kap-pct-without-kap-dato` | Mindst én afgørelse har kapitaliseringsprocent men ikke -dato |

Tilsvarende for fane 2: følgende fejl vedrører kapitaliseringsoplysninger og blokerer ikke fane 5 hvis der ingen relevante kapitaliserede afgørelser er. Fane 2 skal have stabile issue-ID'er for disse fejl — analog med fane 3 og 4 — så filtreringen kan ske på ID og ikke på meddelelsestekst:

| Issue ID (fane 2) | Meddelelse |
|---|---|
| `kap-dato-without-kap-pct` | Der er indtastet kapitaliseringsdato men ikke -procent |
| `kap-pct-without-kap-dato` | Der er indtastet kapitaliseringsprocent men ikke -dato |
| `endelig-under-50-missing-kapitalisering` | Endelig afgørelse under 50 % mangler oplysninger om kapitalisering |
| `delvist-endelig-missing-kapitalisering` | Der er angivet delvist endelig afgørelse uden kapitalisering |

Implementationsnote: blokeringslogikken implementeres ved at filtrere de ovenstående issue-ID'er fra før download-blokering evalueres — ikke ved at udelade dem fra visningen. De vises stadig i ContentBoxen.

ContentBoxen vises kun når der er mindst én fejl eller advarsel efter aggregering. Ellers skjules den.

---

### ContentBox: Beregning

| Række | Label (venstre) | Indhold (højre) |
|---|---|---|
| 1 | Beregningsdato | Dato i format `d. MMMM YYYY` |
| 2 | Download specifikation | Download-ikon |
| 3 | Bilag, der indsættes | Afkrydsningsfelter (se nedenfor) |

**Afkrydsningsfelter — "Bilag, der indsættes":**

Følger samme mønster som `EOberegningTab` (`row--label-right-hover`, checkboxes justeret til højre). Alle fire er togglebare:

| Label | Default |
|---|---|
| Løbende ydelser | Afkrydset |
| Kapitalisering | Afkrydset |
| EET efter EAL | Afkrydset |
| Proformakap. af rest-EET | Afkrydset |

Afkrydsningsfelterne styrer hvilke bilag der medtages ved download af differencekravs-PDF'en. Valgte afkrydsninger gemmes som en del af sagens data via programmets almindelige gem-funktion. Feltnavnet i EET-skemaet er `eetDifferencekravBilagSelection`, efter samme mønster som `eoBilagSelection` i `erstatningsopgoerelseSchemas.ts`.

---

### ContentBox: Specifikation

Indeholder den fulde beregning af differencekravet med pædagogiske forklaringstekster. Alle rækker er hoverrows.

#### Undersektion: EAL-krav

| Række | Venstre | Højre |
|---|---|---|
| Overskrift | **EAL-krav** | — |
| 1 | Erhvervsevnetabet udgør [X] % i EAL-sagen. | — |
| 2 | Det svarer til et beregnet erhvervsevnetab på: | [beløb] kr. |

EAL-procenten og beløbet hentes direkte fra fane 4's kanoniske output. Procenten vises altid, uanset om den er identisk med ASL-procenten.

#### Undersektion: Løbende ASL-ydelser

| Række | Venstre | Højre |
|---|---|---|
| Overskrift | **Løbende ASL-ydelser** | — |
| Forklaringslinje 1 | Se tekstvarianter nedenfor | — |
| Forklaringslinje 2 | Se tekstvarianter nedenfor | — |

**Forklaringstekst — skadesdato før 16. juni 2011:**
> Skaden er indtrådt før 16. juni 2011.
> Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser.

**Forklaringstekst — skadesdato 16. juni 2011 eller senere:**
> Skaden er indtrådt den 16. juni 2011 eller senere.
> Der foretages derfor ikke fradrag i differencekravet med midlertidige EET-ydelser.

Herefter vises én blok per ASL-afgørelse (tom linje over hver blok):

**Per afgørelse:**

| Række | Venstre | Højre |
|---|---|---|
| Afgørelsesoverskrift | Afgørelse [d. MMMM YYYY] | — |
| Afgørelsestype | Se tekstvarianter nedenfor | — |
| Løbende ydelser | Se tekstvarianter nedenfor | — |

**Afgørelsestype-tekst:**

Procenten vises i parentes kun når fradraget foretages for den pågældende afgørelse (dvs. når beregningen giver et beløb > 0 og betingelsen er opfyldt):

| Situation | Tekst |
|---|---|
| Midlertidig, fradrag foretages | `Midlertidig afgørelse ([X] %)` |
| Midlertidig, fradrag foretages ikke | `Midlertidig afgørelse` |
| Delvist endelig, fradrag foretages | `Delvist endelig afgørelse ([X] %)` |
| Delvist endelig, fradrag foretages ikke | `Delvist endelig afgørelse` |
| Endelig (altid) | `Endelig afgørelse ([X] %)` |

Endelige afgørelser vises altid med EET-procent — uanset om beløbet er > 0 eller 0 (fx ved fuld kapitalisering).

**Løbende ydelser-tekst:**

| Situation | Venstre | Højre |
|---|---|---|
| Fradrag foretages, beløb > 0 | `Løbende ydelser ([startdato] - [slutdato]):` | `- [beløb] kr.` |
| Fradrag foretages ikke (midlertidig/delvist endelig, skadesdato ≥ 2011) | `Løbende ydelser derfor ikke relevante.` | — |
| Beløb = 0 (fx fuld kapitalisering) | `Ingen løbende ydelser` | — |

`[startdato]` er virkningsdatoen for den pågældende afgørelse. `[slutdato]` bestemmes per afgørelse som følger:
- For den seneste afgørelse (sorteret på virkningsdato): dagen før beregningsdatoen.
- For tidligere afgørelser: dagen før næste afgørelses virkningsdato.

Dette svarer til periodeafgrænsningen i fane 2. `[beløb]` er det samlede beregningsbeløb for afgørelsen (summen over alle kalenderårs-rækker i den pågældende afgørelses beregning). Mellemregningerne pr. kalenderår fremgår af bilaget for løbende ydelser, ikke af specifikationen på fane 5.

Datoer vises i format `DD-MM-YYYY`.

#### Undersektion: Kapitaliserede ASL-beløb

| Række | Venstre | Højre |
|---|---|---|
| Overskrift | **Kapitaliserede ASL-beløb** | — |
| Forklaringslinje | Værdien af modtagne kapitalbeløb fratrækkes. | — |

Herefter vises én blok per ASL-afgørelse (tom linje over hver blok):

| Situation | Venstre | Højre |
|---|---|---|
| Afgørelsesoverskrift | Afgørelse [d. MMMM YYYY] | — |
| Kapitaliseret | `Kapitaliseret ([X] %) den [dato]:` | `- [beløb] kr.` |
| Ikke kapitaliseret | `Ikke kapitaliseret` | — |

Datoen for kapitaliseringen vises i format `DD-MM-YYYY`. Beløb og dato hentes fra fane 3's kanoniske output.

Alle afgørelser vises her — også dem uden kapitalisering.

#### Undersektion: Resterende erhvervsevnetab

Vises kun når `løbende_eet_pct > 0` (dvs. der er tilbageværende ikke-kapitaliserede procentpoint).

| Række | Venstre | Højre |
|---|---|---|
| Overskrift | **Resterende erhvervsevnetab** | — |
| Forklaringslinje | Der foretages fradrag med kapitaliseringsværdien af resterende EET. | — |
| Proformakapitalisering | `Proforma-kapitalisering ([X] %) per [beregningsdato]:` | `- [beløb] kr.` |

Beregningsdatoen vises i format `d. MMMM YYYY`. Procenten er `løbende_eet_pct`. Beløbet er resultatet af proformakapitaliseringen.

#### Undersektion: Differencekrav

| Række | Venstre | Højre |
|---|---|---|
| Overskrift | **Differencekrav** | — |
| Resultat | Beregnet differencekrav | [beløb] kr. |

Beløbet er altid ≥ 0 kr. (negativ difference vises som 0 kr.).

---

### ContentBox: Proformakapitalisering af rest-EET

Vises kun når `løbende_eet_pct > 0`.

Indeholder en detaljeret beregningsspecifikation af proformakapitaliseringen. Strukturen følger nøjagtig fane 3's ContentBox per kapitaliseret afgørelse (blok 1–4) med følgende afvigelser:

**Ingen afgørelsesoverskrift.** ContentBox-overskriften er "Proformakapitalisering af rest-EET".

**Blok 1 — afvigende rækker:**

| Række | Label (venstre) | Indhold (højre) | Note |
|---|---|---|---|
| 1 | Kapitaliseringsdato | `DD-MM-YYYY` (beregningsdatoen) | Uændret fra fane 3 |
| 2 | **Proformakapitalisering** | `[løbende_eet_pct] %` | Label ændret fra "Kapitalisering" |
| 3 | Grundydelse ([løbende_eet_pct] %): `...` | `[grundydelse] kr.` | Procenten er løbende_eet_pct |
| 4–5 | Som fane 3 | | Uændret |

Blok 2, 3 og 4 er identiske med fane 3.

---

## 5. Fejl og advarsler

Fane 5 har ingen egne fejl eller advarsler. Al fejl- og advarselshåndtering sker ved at aggregere issues fra fane 2, 3 og 4 med den blokeringslogik der er specificeret i sektion 4 (ContentBox: Fejl og advarsler).

Issue-aggregeringen implementeres ved at merge de tre kanoniske issue-lister og deduplikere på meddelelsestekst, analogt med merge-mønsteret beskrevet i `implementering-kapitaliseret-eet.md` sektion 8 (`uniqueIssues`). De ikke-blokerende issues filtreres fra i blokeringsevalueringen, men vises stadig i ContentBoxen.
