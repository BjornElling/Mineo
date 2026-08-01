# Mineo runtime-input-audit — status

## Auditstatus

- Samlet status: I gang
- Senest opdateret: 2026-08-01 17:38 Europe/Copenhagen
- Seneste session: AUDIT-2026-08-01-01
- Commit/build: 9a8da818ce30f941bd718f1d699ac16637f9cdbd / 2026.08.1194.9a8da81
- Dirty-state: Kun auditdokumenter oprettet af denne audit
- Browser: Chromium via playwright-cli 0.1.17
- Senest afsluttet scenarie: SURF-003-S04 / EDGE-004-S02 — EO-/rente-tabelhandlinger, settings, root-redirect og 404
- Næste scenarie og starttilstand: SURF-003-S05 — ren session med minimale gyldige Stamdata, EO-felter og første downstream-beregning
- Aktive blokeringer: Ingen

## Dækningsforklaring

En række er først `Dækket`, når alle registrerede inputpartitioner, settle-måder, branches, afhængighedsovergange og relevante downstream-forbrugere er udført. Nye flader og kanter tilføjes, når kildekodeinventaret udvides.

## Fladeinventar

| ID | Route / side / fane / flade | Felter og handlinger | Branches og skæringer | Afhængigheder / downstream | Status | Evidens / mangler | Fund |
|---|---|---|---|---|---|---|---|
| SURF-001 | Global shell og navigation | Synlig loginformular; sidemenu: Stamdata, Erstatningsopgørelse, Erhvervsevnetab, Varige mén, Forsørgertab, Årslønsberegning, Renteberegning, Satser; værktøjer: Gem, Hent, Slet alt, hamburger, Indstillinger, Om | auth-gate; root-redirect; 404; route-lazy-load; side-/fane-navigation; global save/load/reset; overlay/dialog; ErrorBoundary; bugrapport; devtools-notice; keyboard traversal | routing, re-render, sessionStorage for menu, input-runtime, critical actions, file flows | I gang | Login, alle 10 routes, Gem/Hent/Slet alt, Tab-cirkulation, root-redirect begge veje, 404, ekstern trafik-/console-orakel besøgt uden systemsignal. Hamburger, links, devtools/error-boundary og fuld global handling mangler | — |
| SURF-002 | Stamdata | Journalnr.; advokat; sagsbehandler; skadelidtes navn; fødselsdato; skadestype; skadedato | datoformat-/kalenderissues; skadetypevalg; datoafledte grænser | validering, afledte datoissues, persistence, dokumenter | I gang | Whitespace/Unicode tekstsettle, ugyldige datoer, dropdownvalg, Tab-cirkulation, gemmeblokering, sideskift og F5 gennemført uden systemsignal. Grænser, paste, Escape/Delete, skæringsdatoer og downstream-dokument mangler | — |
| SURF-003 | Erstatningsopgørelse | EO-oplysninger med tekst, dato, valg, toggle, radio, kommentarer og tabeller; faner: EO oplysninger, Lønindkomst, Offentlige ydelser, Beregning | Schema/feltdefinitioner skal inventeres | validering, beregning, kontrol, dokumentgate, PDF, persistence | I gang | DOM-inventar, alle EO-faner, mode-radioer, ny/slet ansættelsesforhold og dialoger gennemført uden systemsignal. EO-felt-, tabel-, dokument- og persistence-matrix mangler | — |
| SURF-004 | Erhvervsevnetab | Felter, tabeller og faner: EET oplysninger, Løbende ydelser, Kapitalisering, EET efter EAL, Differencekrav | Schema/feltdefinitioner skal inventeres | validering, beregning, dokumentgate, PDF, persistence | I gang | Initialt DOM-/feltinventar gennemført; route-load uden console.error. Matrix mangler | — |
| SURF-005 | Varige mén | Méngrad, beregningsdato; faner: Ménberegning, Satser | Schema/feltdefinitioner skal inventeres | validering, beregning, dokumentgate, PDF, persistence | I gang | Initialt DOM-/feltinventar gennemført; route-load uden console.error. Matrix mangler | — |
| SURF-006 | Forsørgertab | Beregningsdato, ASL/EAL-felter, modtagere og beregning; ingen faner i initialt DOM | Schema/feltdefinitioner skal inventeres | validering, beregning, dokumentgate, PDF, persistence | I gang | Initialt DOM-/feltinventar gennemført; route-load uden console.error. Matrix mangler | — |
| SURF-007 | Årslønsberegning | Lønperiode-radio, tillægstype, procentfelter, løntabel og beregning | Schema/feltdefinitioner skal inventeres | validering, beregning, opslag, dokumentgate, PDF, persistence | I gang | Initialt DOM-/feltinventar gennemført; route-load uden console.error. Matrix mangler | — |
| SURF-008 | Renteberegning | Beregningsdato, renteperiode, kravtabel og kommentarer; faner: Beregning, Rentesatser | Schema/feltdefinitioner skal inventeres | validering, beregning, dokumentgate, PDF, persistence | I gang | Ugyldigt beløb/dato, ekstremt tillægstal, enhedsskift Dage→Uger, række-slet/undo/redo og begge faner gennemført uden systemsignal. Skæringer, dokument og persistence mangler | — |
| SURF-009 | Satser | Årstal og satsvisning/download | år-/satsgrænser skal inventeres | opslag, afledninger, persistence | I gang | Initialt DOM-/feltinventar gennemført; route-load uden console.error. Matrix mangler | — |
| SURF-010 | Indstillinger | Tema-radio, dropdown og settings-toggles | settings-schema skal inventeres | theme, startside, session/persistence | I gang | Initialt DOM-/feltinventar gennemført; route-load uden console.error. Matrix mangler | — |
| SURF-011 | Om | Dokumentationsafsnit, MIT-modal, kontakt/GitHub-links, startside-toggle | — | render, overlays, linkhandlinger | I gang | Initialt DOM-/feltinventar gennemført; route-load uden console.error. Link- og modalhandlinger mangler | — |

## Afhængighedskanter

| ID | Styrende input | Afhængigt input/tilstand | Forbruger | Påkrævede sekvenser | Status | Evidens / mangler | Fund |
|---|---|---|---|---|---|---|---|
| EDGE-001 | Skal inventeres | Skal inventeres | Skal inventeres | A→B→C; B→A→C; ændr; ryd; mode-retur | Ikke startet | — | — |
| EDGE-002 | Global navigation | Aktivt felt/editor | critical-action coordinator og route | åben draft → sideskift; rejected input → sideskift; faneskift | I gang | Rejected input overlevede sideskift/F5; unsaved beforeunload-dialog blev håndteret ved stateful navigation. Åben draft, Escape efter navigation og fuld fanesekvens mangler | — |
| EDGE-003 | Global filhandling | afsluttet canonical/rejected input | save/load/reset, overlay og navigation | Gem/Hent/Slet alt fra tom, delvis, ugyldig sag | I gang | Gem tom sag, Hent-filechooser, Slet alt med rejected/row-state og save-block ved invalid gennemført uden systemsignal. Faktisk fil-load/preflight/round-trip mangler | — |
| EDGE-004 | Global tastatur | fokuseret felt, popup eller tabel | Container/grid navigation | Tab, Shift+Tab, Enter, Shift+Enter, Escape, Delete/Backspace, piletaster | I gang | Tab-cirkulation uden selection og rentekrav undo/redo gennemført. Enter, Shift+Tab/Enter, Escape, Delete/Backspace, popup- og tabelpilnavigation mangler | — |

## Skæringspunkter

| ID | Kilde | Styrende værdi | Gren før / på / efter | Berørte felter og forbrugere | Status | Evidens / mangler | Fund |
|---|---|---|---|---|---|---|---|
| CUT-001 | Skal inventeres | Skal inventeres | dag -1 / dag 0 / dag +1 | Skal inventeres | Ikke startet | — | — |

## Sessionslog

| Session | Tidspunkt | Commit/build og dirty-state | Arbejdsenhed | Afsluttet | Næste | Nye fund |
|---|---|---|---|---|---|---|
| AUDIT-2026-08-01-01 | 2026-08-01 17:38 Europe/Copenhagen | 9a8da818 / 2026.08.1194.9a8da81; kun auditdokumenter og testartefakt | Global shell, route-load, Stamdata/EO/rente/settings/state-smoke | Login, routes, reset/save/Hent, invalid input, navigation/F5, tabs, toggles/radioer, add/delete, undo/redo, redirect/404 | SURF-003-S05 — minimale gyldige Stamdata og første downstream-beregning | Ingen |
| AUDIT-2026-08-01-01 | 2026-08-01 17:23 Europe/Copenhagen | 9a8da818 / 2026.08.1194.9a8da81; kun auditdokumenter og testartefakt | Global shell, route-load, Stamdata input/state-smoke | Login, routes, reset/save/Hent, dropdown, invalid input, navigation/F5, keyboard traversal | SURF-003-S01 — EO-faner fra ren sag | Ingen |
| AUDIT-2026-08-01-01 | 2026-08-01 17:08 Europe/Copenhagen | 9a8da818 / 2026.08.1194.9a8da81; kun docs/testing/runtime-input-audit/ er nye | Kodeinventar for global shell/navigation | Routes, menuitems, globale handlinger og relevante orakler identificeret | SURF-001-S01 browserbaseline og global shell-smoke fra ren session | — |
