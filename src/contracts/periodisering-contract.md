# MinEO – Periodiseringskontrakt

**Status:** Gældende arkitektur (normativ)  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og relevante domænekontrakter.  

Dette dokument fastlægger den bindende model for periodisering, dagtælling og fradragsregler i MinEO.

Kode, der periodiserer beløb eller tæller periodiseringsdage uden at følge denne kontrakt, betragtes som arkitektonisk fejl.

---

## 1. Kanonisk motor

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

---

## 3. Lønindkomst i EO

For lønindkomst i EO gælder følgende bindende regel:

- Hvis TAF beregnes som `Måneder`, periodiseres løn på kalenderdage.
- Hvis TAF beregnes som `Arbejdsdage`, periodiseres løn på arbejdsdage.

Denne regel gælder for samtlige ansættelsesforhold i samme EO-beregning.
Valget foretages centralt via `computeTafBeregningsenhed(...)` og må ikke genfortolkes lokalt i enkelte callsites.

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

- Til og med `2012-07-01` medregnes SH-dage ved arbejdsdagsperiodisering.
- Fra og med `2012-07-02` fratrækkes SH-dage.

Denne regel skal håndhæves centralt samme sted for:

- dagtælling
- beløbsperiodisering
- ugeopdeling til ATP-beregning

Det er arkitektonisk fejl, hvis forskellige sygedagpenge-flow kan nå forskellige dagtal for samme interval.

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
- forskellig dagtælling mellem beregning, debug og PDF for samme semantik

---

## 8. Ændringsregel

Når en periodiseringsregel ændres:

- den kanoniske motor skal opdateres først
- denne kontrakt skal opdateres i samme commit, hvis den normative regel ændres
- regressionstests skal opdateres eller tilføjes for både domæneregel og evt. undtagelser
