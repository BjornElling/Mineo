# WI-010: §A5's skel mellem systemfejl og lokale preflight-fejl (rodårsag bag WI-008's C6)

- **Status:** `ikke-startet`
- **Oprettet:** 2026-07-26
- **Kilde:** codex sol/high-review af Fase 5's første halvdel, fund C6. Udskilt fra WI-008, fordi
  roden kan ligge i den generelle fejlinfrastruktur, ikke i dokumentlaget.
- **Risikoklasse:** **M** — påvirker fejlsynlighed og telemetri, ikke beregningstal eller persisteret
  form.

## Problemet

`src/contracts/document-output-contract.md` §A5 kræver, at UVENTEDE systemfejl og FORVENTELIGE,
lokale preflight-fejl holdes adskilt. Før Fase 5 blev en uventet generatorfejl rapporteret BÅDE til
`reportSystemIssue` OG returneret som en lokal sidefejl — altså begge kanaler for samme hændelse.

Fase 5's pass 0 indførte den korrekte taksonomi i dokumentlaget:
`DocumentOutcome` skelner nu `rejected` (gate/stale/settle — rapporteres IKKE som systemfejl) fra
`failed{dev-server-unavailable}` (miljø, kun DEV) og `failed{runtime}` (den ENESTE klasse, der når
`reportFailure`/systemfejl-sinken).

**Det åbne spørgsmål:** taksonomien er nu rigtig i dokumentlaget, men det er ikke verificeret, at der
findes en SYNLIG central systemfejls-overflade, som en `runtime`-fejl faktisk lander på for brugeren.
Hvis den ikke findes — eller hvis den er tavs — så er den lokale sidefejl fortsat den eneste synlige
kanal, og skellet er kun formelt. Kontraktinvarianten "download blokeres aldrig uden synlig fejl"
(jf. `project_download_gate_visible_error_invariant`) skal fortsat holde efter opdelingen.

## Hvad der skal afklares

1. Findes der en synlig, central systemfejls-overflade i produktionsappen i dag? Hvor rendres
   `reportSystemIssue`-hændelser, og er de brugervendte?
2. Er `runtime`-fejl fra dokument-download dækket af den overflade EFTER at den lokale
   dobbeltrapportering er fjernet? Hvis nej: opret overfladen FØR pass 7's cutover, ellers mister
   brugeren et signal, der findes i dag.
3. Skal `dev-server-unavailable` også rapporteres, eller er den rent DEV-diagnostik? (Pass 0 beholder
   rapporteringen med TTL-throttling; det kan være mere end nødvendigt.)

## Bemærk

Fase 5 kan gennemføres uden dette, fordi pass 0 bevarer BEGGE kanaler for `runtime`-fejl indtil
videre. Men afklaringen skal ske, før den lokale kanal fjernes.

## Relateret

- `work-items/WI-008-fase5-dokumentoutputs.md` — C6 og `documentOutcome.ts`/`documentMessages.ts`.
- `src/contracts/document-output-contract.md` §A5.
- `src/document/service/documentRuntimeFailure.ts` — hovedappens `reportFailure`-port.
