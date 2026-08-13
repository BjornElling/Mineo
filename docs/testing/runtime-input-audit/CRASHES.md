# Mineo robustheds- og adfærdsaudit — runtime- og systemfund

Kun uventede systemsignaler registreres her. Forventet feltvalidering uden systemsignal hører ikke til. Usynlige systemsignaler registreres også, selv om appen tilsyneladende fortsætter.

## Indeks

| ID | Kort titel | Flade | Browser/viewport | Signal | Reproduktion | Alvor | Status | Først set |
|---|---|---|---|---|---|---|---|---|

*Ingen åbne runtimefund. Filvælger-exceptionen ved Hent i Firefox blev lukket 2026-08-13: oprydningen
er gjort idempotent, og efterkontrollen blev først bevist at fejle mod den genindførte fejl. Se
`e2e/audit-firefox-fallback-verification.spec.ts`.*

## Postskabelon

### CRASH-NNN — Kort, observerbar titel

- Status: Ny / Bekræftet / Ustabil / Dublet
- Alvor: Blokerende / Høj / Mellem / Lav
- Først set: YYYY-MM-DD HH:mm Europe/Copenhagen
- Commit/build: —
- Dirty-state: —
- Browser/viewport: —
- Flade/scenarie: SURF-/EDGE-/CUT-id
- Relaterede fund/spørgsmål: —

**Starttilstand**

Beskriv ren sag eller alle nødvendige syntetiske værdier.

**Minimal reproduktion**

1. Log ind gennem den synlige loginformular.
2. …

**Udløsende input og settle**

- Felt/handling: —
- Præcis værdi: —
- Metode: typing / paste / dropdown / toggle / tastatur / navigation
- Settle: blur / Enter / Tab / navigation / straks

**Observeret systemsignal**

- Første signal: —
- Synlig adfærd: —
- Fejltekst: —
- Relevant stacktop: —
- Console/pageerror/rejection: —

**Reproducerbarhed og kontrast**

- Rate: 0/0
- Gentaget fra ren tilstand: —
- Nærmeste ikke-fejlende kontrast: —
- Andre browsere/viewports: —

**Påvirkning og rækkevidde**

Beskriv konkret brugerens tabte funktion eller datarisiko uden løsningsforslag.

**Evidens**

- Screenshot/trace: —
- Supplerende noter: —
