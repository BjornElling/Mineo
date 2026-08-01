# Mineo runtime-input-audit — status

## Auditstatus

- Samlet status: Ikke startet
- Senest opdateret: —
- Seneste session: —
- Commit/build: —
- Dirty-state: —
- Browser: —
- Senest afsluttet scenarie: —
- Næste scenarie og starttilstand: Inventér global shell og navigation fra ren, tom sag
- Aktive blokeringer: Ingen

## Dækningsforklaring

En række er først `Dækket`, når alle registrerede inputpartitioner, settle-måder, branches, afhængighedsovergange og relevante downstream-forbrugere er udført. Nye flader og kanter tilføjes, når kildekodeinventaret udvides.

## Fladeinventar

| ID | Route / side / fane / flade | Felter og handlinger | Branches og skæringer | Afhængigheder / downstream | Status | Evidens / mangler | Fund |
|---|---|---|---|---|---|---|---|
| SURF-001 | Global shell og navigation | Skal inventeres | Skal inventeres | routing, re-render, global handling | Ikke startet | — | — |

## Afhængighedskanter

| ID | Styrende input | Afhængigt input/tilstand | Forbruger | Påkrævede sekvenser | Status | Evidens / mangler | Fund |
|---|---|---|---|---|---|---|---|
| EDGE-001 | Skal inventeres | Skal inventeres | Skal inventeres | A→B→C; B→A→C; ændr; ryd; mode-retur | Ikke startet | — | — |

## Skæringspunkter

| ID | Kilde | Styrende værdi | Gren før / på / efter | Berørte felter og forbrugere | Status | Evidens / mangler | Fund |
|---|---|---|---|---|---|---|---|
| CUT-001 | Skal inventeres | Skal inventeres | dag -1 / dag 0 / dag +1 | Skal inventeres | Ikke startet | — | — |

## Sessionslog

| Session | Tidspunkt | Commit/build og dirty-state | Arbejdsenhed | Afsluttet | Næste | Nye fund |
|---|---|---|---|---|---|---|
