# Mineo robustheds- og adfærdsaudit — uafklarede spørgsmål om korrekt adfærd

Registrér kun spørgsmål, hvor korrekt brugeradfærd ikke kan udledes sikkert af bindende kontrakter eller entydig kodeadfærd. Gæt ikke. Uafklarede spørgsmål må ikke skjule et allerede observeret kontraktbrud eller en runtimefejl; link i så fald også det relevante fund.

## Indeks

| ID | Kort spørgsmål | Flade | Afventende rækker | Status | Først set |
|---|---|---|---|---|---|
| Q-001 | Skal Escape fra Løntrin-finder returnere fokus til Find løntrin-knappen? | SURF-003 / PAR-003 / Løntrin-finder | SURF-003 | Afventer svar | 2026-08-09 06:28 Europe/Copenhagen |

### Q-001 — Skal Escape fra Løntrin-finder returnere fokus til Find løntrin-knappen?

- Status: Afventer svar
- Først set: 2026-08-09 06:28 Europe/Copenhagen
- Commit/build: `d5e652550635` / `2026.08.1325.d5e6525`
- Berørte flader/scenarier: SURF-003 / PAR-003 / Løntrin-finder; AUDIT-2026-08-14-21
- Afventende dækningsrækker: SURF-003
- Relaterede fund: —

**Starttilstand og handling**

1. Synligt login, `/erstatningsopgoerelse`, `Lønindkomst`, ét ansættelsesforhold, `KL-overenskomsten` og `Lønudvikling beregnes ud fra=Overenskomst`.
2. Fokuser `Find løntrin`, aktiver med Enter, og tryk Escape fra overlayet.

**Observerede eller mulige alternativer**

- Alternativ A: Escape lukker overlayet og gendanner fokus til `Find løntrin`.
- Alternativ B: Escape lukker overlayet, men fokus ender på `body`.

**Kildegrundlag**

`keyboard-navigation.md` beskriver, at Escape lukker popupen og at overlayet ejer sin interne focus-trap, men fastlægger ikke et restore-target efter lukning. Den aktuelle kode fokuserer ved åbning på overlayets `Ansættelse`-felt og har ingen entydig kontrakt for fokus efter lukning.

**Spørgsmål**

Skal brugeren efter Escape kunne fortsætte direkte fra knappen `Find løntrin`, eller er det accepteret, at fokus ender på `body`?

**Hvorfor svaret er nødvendigt**

I AUDIT-2026-08-14-21 endte fokus på `body` i Chrome, Edge, Firefox og WebKit, selv om overlayets interne Tab/Shift+Tab-cyklus fungerede. Uden et svar kan afvigelsen ikke klassificeres som korrekt adfærd eller kontraktbrud.

**Svar og afklaring**

—

## Postskabelon

### Q-NNN — Kort spørgsmål om korrekt adfærd

- Status: Afventer svar / Besvaret / Indarbejdet / Dublet
- Først set: YYYY-MM-DD HH:mm Europe/Copenhagen
- Commit/build: —
- Berørte flader/scenarier: SURF-/EDGE-/CUT-id
- Afventende dækningsrækker: —
- Relaterede fund: —

**Starttilstand og handling**

1. …

**Observerede eller mulige alternativer**

- Alternativ A: —
- Alternativ B: —

**Kildegrundlag**

Angiv de relevante kontrakter, kodekilder eller eksisterende brugerflader, og hvorfor de ikke entydigt afgør valget.

**Spørgsmål**

Hvad skal brugeren konkret se, kunne gøre eller opleve i denne situation?

**Hvorfor svaret er nødvendigt**

Beskriv hvilke scenarier, kombinationer eller fund der ikke kan klassificeres eller afsluttes uden svaret.

**Svar og afklaring**

—
