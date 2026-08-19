# Mineo robustheds- og adfærdsaudit – status

## Auditstatus

- Samlet status: Ikke startet
- Aktuel auditpass: –
- Senest opdateret: –
- Seneste session: –
- Commit/build: –
- Dirty-state: –
- Senest afsluttede scenarie: –
- Næste scenarie og starttilstand: Inventér global shell og navigation fra ren, tom sag
- Aktive blokeringer: Ingen
- Uafklarede spørgsmål: Se `QUESTIONS.md`

## Dækningsforklaring

En række er først `Dækket`, når alle registrerede brugerhandlinger, inputpartitioner, settle-måder, branches, afhængighedsovergange, relevante downstream-forbrugere og understøttede browsere/viewports er håndteret. Nye flader, implementationssteder, kanter og skæringer tilføjes, når kildekode- eller kontraktinventaret udvides. En række med uafklaret forventet adfærd er `Afventer afklaring` og tæller ikke som dækket.

## Browser- og viewportmatrix

| Browser | Minimum 1920×1080 | Større desktop-viewport | Seneste baseline | Dækningshul/fund |
|---|---|---|---|---|
| Chrome | Ikke startet | Ikke startet | – | – |
| Edge | Ikke startet | Ikke startet | – | – |
| Safari | Ikke startet | Ikke startet | – | – |

## Fladeinventar

| ID | Route / side / fane / flade | Felter og handlinger | Forventningsgrundlag | Branches og skæringer | Afhængigheder / downstream | Status | Evidens / mangler | Fund / spørgsmål |
|---|---|---|---|---|---|---|---|---|
| SURF-001 | Global shell og navigation | Skal inventeres | Skal afstemmes mod kontrakter og kode | Skal inventeres | routing, re-render, global handling | Ikke startet | – | – |

## Afhængighedskanter

| ID | Styrende input | Afhængigt input/tilstand | Forbruger | Påkrævede sekvenser | Status | Evidens / mangler | Fund / spørgsmål |
|---|---|---|---|---|---|---|---|
| EDGE-001 | Skal inventeres | Skal inventeres | Skal inventeres | A→B→C; B→A→C; ændr; ryd; mode-retur; navigation; save/load | Ikke startet | – | – |

## Skæringspunkter

| ID | Kilde | Styrende værdi | Gren før / på / efter | Berørte felter og forbrugere | Status | Evidens / mangler | Fund / spørgsmål |
|---|---|---|---|---|---|---|---|
| CUT-001 | Skal inventeres | Skal inventeres | dag -1 / dag 0 / dag +1 | Skal inventeres | Ikke startet | – | – |

## Parallelle implementationssteder

| ID | Concern / brugerhandling | Flader eller kodekilder | Sammenlignede scenarier | Status | Evidens / forskelle | Fund / spørgsmål |
|---|---|---|---|---|---|---|
| PAR-001 | Skal inventeres | Skal inventeres | Skal inventeres | Ikke startet | – | – |

## Dækningshuller

Registrér konkrete manglende browsere, viewports, rækker, kilder, artefakter eller afklaringer. Alvor ændrer ikke gennemgangens rækkefølge.

| ID | Hul | Berørte rækker | Årsag | Næste handling |
|---|---|---|---|---|
| GAP-001 | Skal inventeres | – | – | – |

## Sessionslog

| Session | Tidspunkt | Commit/build, dirty-state, browser og viewport | Arbejdsenhed | Afsluttet | Næste | Nye fund/spørgsmål |
|---|---|---|---|---|---|---|
