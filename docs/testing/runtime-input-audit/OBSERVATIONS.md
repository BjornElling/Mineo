# Mineo robustheds- og adfærdsaudit – adfærds- og øvrige fund

Registrér ikke-crashende afvigelser, datatabsmistanke, kontraktdrift, parallel eller afvigende logik, mistænkelig beregningsadfærd og manglende eller uforudsigelig feedback. Registrér ikke en klar, forventet valideringsreaktion som fund.

**Rettede fund slettes.** Når et fund er rettet, fjernes både dets indeksrække og dets post fra denne fil – registeret viser
altså kun åbne fund. Huller i ID-rækken er derfor forventede og ikke et tegn på manglende poster. Et rettet fund må heller
ikke stå som reference andre steder i auditdokumenterne; henvisninger til det omskrives til «rettet og lukket», når posten
slettes, så intet dokument peger på et ID, der ikke længere findes.

## Indeks

| ID | Kort titel | Kategori | Flade | Browser/viewport | Alvor | Status | Først set |
|---|---|---|---|---|---|---|---|

*Ingen åbne adfærdsfund. Alle registrerede fund er rettet og slettet – de tre browserfundne fund
(fallback-advarsel, Løntrin-blokering, filvælger-exception) blev lukket 2026-08-13 efter en
Firefox-efterkontrol, hvor hver test først blev bevist at FEJLE mod den genindførte fejl. Kontrollen
lever videre som `e2e/audit-firefox-fallback-verification.spec.ts`.*

## Postskabelon

### OBS-NNN – Kort, observerbar titel

- Status: Ny / Bekræftet / Ustabil / Dublet / Kræver afklaring
- Kategori: Inkonsistens / Dataintegritet / Kontraktdrift / Parallel logik / UX / Beregningsobservation / Browserforskel / Andet
- Alvor: Blokerende / Høj / Mellem / Lav
- Først set: YYYY-MM-DD HH:mm Europe/Copenhagen
- Commit/build: –
- Dirty-state: –
- Browser/viewport: –
- Flade/scenarie: SURF-/EDGE-/CUT-id
- Relaterede fund/spørgsmål: –

**Starttilstand og reproduktion**

1. …

**Observeret adfærd**

Beskriv kun det konkrete, observerbare resultat og eventuelle usynlige, men registrerede systemssignaler.

**Sammenligningsgrundlag**

Angiv den anden flade, kontrakt, schema-/kodegren, implementationssted, browser eller nærliggende værdi, der opfører sig anderledes.

**Forventningsgrundlag**

Angiv den kontrakt eller entydige kodeadfærd, som scenariet sammenholdes med. Hvis korrekt adfærd ikke kan udledes, link et `Q-NNN` i `QUESTIONS.md`.

**Hvorfor det bør undersøges**

Beskriv risikoen eller det nødvendige bruger-/udviklervalg uden at foreslå en kodeændring eller afgøre en juridisk/beregningsteknisk regel.

**Evidens**

- Screenshot/trace/kildereference: –
- Reproducerbarhed: –
- Andre browsere/viewports: –
