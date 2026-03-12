# Implementering — Differencekrav

Denne fil beskriver implementeringen af differencekravet (fane 5 på Erhvervsevnetab-siden).

For løbende erhvervsevnetab (ASL), se: `docs/implementation/implementering-loebende-eet.md`.
For kapitaliseret erhvervsevnetab (ASL) og EET efter EAL, se: `docs/implementation/implementering-kapitaliseret-eet.md`.

---
> Arbejdsdokument for planlægning og implementering af differencekravet.
> Opdateres løbende i denne tråd.

---

## Status

Differencekrav-fanen er ikke påbegyndt. Beregningslogik og UI mangler dokumentation.

---

## 1. Implementeringsregler

### Filens formål
Denne fil er en komplet, selvstændig implementeringsspecifikation for differencekravet (fane 5). Den skal indeholde tilstrækkelig information til at fanen og al beregningslogik kan udvikles fuldt autonomt uden yderligere afklaring.

### Afhængighed af kanoniske beregningsresultater
Differencekravet beregnes udelukkende på baggrund af resultater fra tre øvrige beregninger:

- **EET efter EAL** (fane 4) — det kapitaliserede EAL-krav
- **Løbende EET** (fane 2) — den løbende ASL-ydelse
- **Kapitaliseret EET** (fane 3) — det kapitaliserede ASL-beløb

Differencekrav-fanen er udelukkende forbruger af disse resultater. Den genberegner ikke og duplikerer ikke logik fra de øvrige faner. Alle tre beregninger skal have et kanonisk beregningsgrundlag som fane 5 kan konsumere direkte.

### Isolation
Differencekravet tilhører udelukkende fane 5. Ingen logik, state eller mellemresultater flyder fra fane 5 til andre faner.

---

## 2. Begrebsafklaring

### Differencekrav
Differencekravet er forskellen mellem EET efter EAL og EET efter ASL, når EAL-beregningen er den største. Hvis ASL-erstatningen er større end eller lig med EAL-erstatningen, er der intet differencekrav.

---

## 3. Beregningslogik

*Mangler. Beskrives i kommende arbejdssessioner.*

Åbne spørgsmål der skal afklares:
- Hvilke konkrete ASL-beløb indgår i sammenligningen med EAL-kravet? (Kapitaliseret beløb, løbende ydelse, eller begge?)
- Hvad sker der ved blandede afgørelsestyper (midlertidig, delvist endelig, endelig)?
- Hvornår og hvordan opgøres differencen — per dato, samlet, eller fordelt over perioder?

---

## 4. Brugerflade (fane 5)

*Mangler. Beskrives i kommende arbejdssessioner.*

Fanen følger den fælles beregningsfanestruktur (Fejl og advarsler / Beregning / Specifikation) som beskrevet i `implementering-kapitaliseret-eet.md` sektion 4.

---

## 5. Fejl og advarsler

*Mangler. Beskrives i kommende arbejdssessioner.*
