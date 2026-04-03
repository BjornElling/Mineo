# Mineo – PDF-kontrakt

**Status:** Gældende arkitektur (normativ)

Denne kontrakt fastlægger tværgående regler for PDF-output. Domænespecifikke snapshot-kontrakter må gerne specificere egne projektioner, men de må ikke afvige fra reglerne her.

---

## 1. Grundregel

1. PDF er trust-kritisk output.
2. PDF-renderere må kun bygge på committed, autoritativt input eller autoritative projektioner.
3. PDF-renderere må ikke læse draft-state, UI-state eller uautoriserede persisted sektioner.

---

## 2. Download-gate-definition

Download er blokeret hvis og kun hvis mindst én af følgende er sand:

1. Der findes blokerende feltfejl på de relevante committed inputfelter.
2. Den autoritative beregning ikke kan dannes (`fail_closed` eller tilsvarende domæne-stop).
3. Det konkrete PDF-output er blokeret af output-specifikke invariants eller guards.

Konsekvens:
- Feltfejl, snapshot-status og output-specifikke blokeringer skal aggregeres eksplicit.
- Ingen download-knap må nøjes med kun én af disse tre kilder.

---

## 3. Toggle-guards for betingede felter

Når et felt i UI vises betinget af et toggle, et valg eller en anden brugerbeslutning, skal den PDF-renderer der kan udskrive feltet have en tilsvarende guard.

Acceptable mønstre:

1. Sektionsniveau:
   - engine/projection returnerer autoritativt `beregnes = false`
   - rendereren undertrykker hele sektionen
2. Feltniveau:
   - rendereren har en eksplicit `if`-guard før værdien skrives

Det er ikke acceptabelt at indføre parallel masking eller skjult data-mutation i entry-pointet kun for PDF.

Manglende guard er en kritisk fejl, fordi stale værdier ellers kan udskrives i et tillidskritisk dokument.

---

## 4. Semantisk fravalg

Hvis en delberegning er semantisk fravalgt i det autoritative beregningslag, må PDF-laget ikke genindføre den via visningsvalg.

Det gælder både:

- sektioner
- fradragslinjer
- mellemregninger
- bilag
- andre afledte visninger

Et PDF-UI-valg er et visningsønske, ikke en ret til at overstyre semantisk fravalg.

---

## 5. Runtime-fejl under download

1. Hvis download var korrekt gated men selve PDF-genereringen fejler ved runtime, er det en systemteknisk fejl.
2. Brugeren må ikke mødes af en `BugReportButton` inline i sideflowet eller i en download-dialog.
3. Fejlen routes via den centrale fejlrapportering jf. `error-debug-contract.md`.

---

## 6. EO-specifikke regler

EO- og TAF-fordelt-på-år-projektioner må supplere denne kontrakt med egne invariants og projektionstyper i `eo-snapshot-contract.md`, men:

1. download-gate-definitionen i §2 gælder stadig,
2. toggle-guard-kravet i §3 gælder stadig,
3. semantisk fravalg i §4 gælder stadig.
