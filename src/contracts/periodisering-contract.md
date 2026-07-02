# Mineo – Periodiseringskontrakt

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og relevante domænekontrakter.  
**Senest verificeret mod kode:** 2026-06-10  

Dette dokument fastlægger den bindende taksonomi for periodisering, dagtælling og fradragsregler i Mineo.

Kode, der periodiserer beløb eller tæller periodiseringsdage uden at følge den relevante kategori i denne kontrakt, betragtes som arkitektonisk fejl.

---

## 1. Periodiseringstaksonomi

Mineo har flere legitime periodiseringskategorier. De må ikke blandes:

1. EO-TAF/offentlige ydelser: kanonisk motor `src/domain/erstatningsopgoerelse/engines/periodiseringsMotor.ts`.
2. Årsløn/omregning: kanoniske helpers i `src/utils/periodeBeregning.ts` og domænets årslønsmoduler.
3. EET-løbende ydelser: kanonisk EET-motor/projektion, jf. `eet-snapshot-contract.md`.
4. Forsørgertab/kapitalisering: kanonisk Forsørgertab-snapshot og domænemotorer, jf. `forsoergertab-snapshot-contract.md`.

EO's periodiseringsmotor må ikke automatisk antages at gælde for Årsløn, EET eller Forsørgertab.

---

## 1A. Kanonisk EO-motor

Den kanoniske kilde til sandhed for EO-periodisering er:

- `src/domain/erstatningsopgoerelse/engines/periodiseringsMotor.ts`

Følgende ansvar hører normativt hjemme dér:

- periodisering af beløb på kalenderdage
- periodisering af beløb på arbejdsdage
- dagtælling for offentlige ydelser
- optælling af måneder
- optælling af arbejdsdage
- SH-/ferie-/fraværsregler, når de indgår i periodiseringssemantikken
- domænespecifikke undtagelser, fx sygedagpenge før `2012-07-02`

Wrappers og adaptere er tilladt, når de kun:

- konverterer inputformat
- tilpasser returtype til et ældre API
- videresender til den kanoniske motor uden parallel domænelogik

Wrappers må ikke genimplementere periodiseringsregler.

---

## 2. Begreber

- `Kalenderdage`: alle dage i intervallet inkl. weekend og helligdage.
- `Hverdage`: mandag-fredag uden fradrag for SH-dage eller ferie.
- `Arbejdsdage`: hverdage efter de fradrag som den konkrete domæneregel kræver.

`Hverdage` og `arbejdsdage` må ikke bruges som synonymer.

`Hverdage` er basisbegrebet. Domænespecifikke regler kan gøre `arbejdsdage` lig `hverdage` for konkrete perioder, fx sygedagpenge før cutover.

---

## 3. Lønindkomst i EO

For lønindkomst i EO gælder følgende bindende regel:

- Hvis TAF beregnes som `Måneder`, periodiseres løn på kalenderdage.
- Hvis TAF beregnes som `Arbejdsdage`, periodiseres løn på arbejdsdage.

Denne regel gælder for samtlige ansættelsesforhold i samme EO-beregning.
Valget foretages centralt via `computeTafBeregningsenhed(...)` (`src/domain/erstatningsopgoerelse/helpers/tafBeregningsenhed.ts`) og må ikke genfortolkes lokalt i enkelte callsites.

Ved lønperiodisering:

- ferieperioder og SH-dage udgår ikke i måneders-sporet
- ferieperioder og SH-dage udgår i arbejdsdags-sporet
- løse ferie-/fraværsdage er ikke del af lønperiodiseringsgrundlaget

---

## 4. Offentlige ydelser

Offentlige ydelser periodiseres efter den regel, der er deklareret på ydelsestypen i:

- `src/data/ydelsestyper.ts`

Den deklarerede `periodisering` er autoritativ.
Callsites må ikke hardcode egne periodiseringsregler for en ydelsestype, medmindre kontrakten udtrykkeligt kræver en dokumenteret undtagelse.

---

## 5. Sygedagpenge

Sygedagpenge er en domænespecifik undtagelse med særregel:

- Hvis ydelsesrækkens slutdato er før `2012-07-02`, medregnes SH-dage ved arbejdsdagsperiodisering.
- Hvis ydelsesrækkens slutdato er `2012-07-02` eller senere, fratrækkes SH-dage.

Perioder der krydser cutover opdeles ikke automatisk dag-for-dag af denne regel; klassifikationen følger ydelsesrækkens slutdato, medmindre en senere domæneregel eksplicit ændrer dette.

Denne regel skal håndhæves centralt samme sted for:

- dagtælling
- beløbsperiodisering
- ugeopdeling til indsættelse af maksimal sygedagpengesats, ATP og obligatorisk pension

Ved "Indsæt maksimal sygedagpengesats" beregnes sygedagpenge på timer pr. kalenderuge:

- en fuld uge er altid 37 timer
- mandag-torsdag tæller hver 8 timer
- fredag tæller 5 timer
- lørdag-søndag tæller 0 timer
- SH-dage følger cutoff-reglen ovenfor og bidrager med 0 timer, når de ikke medregnes

Afrunding sker altid pr. kalenderuge (mandag-søndag), aldrig pr. dag og aldrig samlet for en længere brugerperiode. Samme ugegrundlag skal bruges til sygedagpenge, ATP og obligatorisk pension.

Det er arkitektonisk fejl, hvis forskellige sygedagpenge-flow kan nå forskellige dagtal eller timegrundlag for samme interval.

---

## 6. Ferie og fravær

Ferie-/fraværsfradrag skal følge den konkrete domænesemantik, ikke UI-bekvemmelighed.

For EO gælder:

- `ferieperioder` og `fravaerPerioder` indgår i lønsporets arbejdsdagsberegning
- `øvrige fraværsdage uden løn` reducerer beregningsgrundlaget, men ikke selve TAF-kravet
- hvis fraværsdage skal udgå af TAF-kravet, skal de udelades af de angivne TAF-perioder

Hvis en beregning bevidst afviger fra de normale løn-/TAF-regler, skal afvigelsen være dokumenteret som domæneregel ved callsite eller i en mere specifik kontrakt.

---

## 7. Forbudte mønstre

Følgende er ikke tilladt:

- lokale ad hoc-beregninger af periodiseringsdage i featurekode
- parallelle arbejdsdagsdefinitioner for samme domæne
- lokale SH-regler udenom den centrale motor
- særskilt fradrag for ferie/SH i UI-komponenter eller PDF-renderere
- forskellig dagtælling mellem beregning, kontrol og PDF for samme semantik

---

## 8. Ændringsregel

Når en periodiseringsregel ændres:

- den kanoniske motor skal opdateres først
- denne kontrakt skal opdateres i samme commit, hvis den normative regel ændres
- regressionstests skal opdateres eller tilføjes for både domæneregel og evt. undtagelser
