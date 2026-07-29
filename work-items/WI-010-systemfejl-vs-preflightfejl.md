# WI-010: §A5's skel mellem systemfejl og lokale preflight-fejl (rodårsag bag WI-008's C6)

- **Status:** `afsluttet` 2026-07-29 — spørgsmålet er besvaret og kæden pinnet i draft/commit-reviewets
  **etape 12**. Se "Svar" nederst.
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

## Svar (2026-07-29)

**Ja — den synlige centrale systemfejls-overflade FINDES, og en `runtime`-fejl lander på den.** Skellet i §A5 er
altså reelt, ikke kun formelt. Kæden er efterprøvet led for led:

`reportDocumentRuntimeFailure` → `reportSystemIssue` → `logError` → `console.error` → devtools-monitorens
console-patch (`startDevtoolsMonitor`) → `subscribeDevtoolsIssues` → **`DevtoolsIssueNotice`** i `MainLayout`.

Overfladen er brugervendt og **ikke gated bag en indstilling**: `MainLayout` renderer noticen, når monitoren har
en uafvist hændelse. Den viser en dansk overskrift ("Teknisk fejl registreret"), en vejledning i almindeligt
sprog og en rapportknap. Brugeren får altså både signalet og en handling.

Svar på de tre delspørgsmål:

1. **Findes overfladen, og er den brugervendt?** Ja, se ovenfor.
2. **Er `runtime`-fejl fra dokument-download dækket EFTER at den lokale dobbeltrapportering fjernes?** Ja —
   dækningen kommer fra systemfejl-sinken, ikke fra den lokale sidefejl. Den lokale kanal KAN derfor fjernes,
   men det er en selvstændig UI-beslutning (den ville flytte, hvor brugeren ser fejlen) og er ikke gennemført
   her. Invarianten "download blokeres aldrig uden synlig fejl" er urørt: den handler om `rejected`, som
   bevidst IKKE går til systemfejl-fladen.
3. **Skal `dev-server-unavailable` også rapporteres?** Uændret: den rapporteres med TTL-throttling og er ren
   DEV-diagnostik. Ingen ændring — den er billig, og en fjernelse ville koste dev-diagnostik uden gevinst.

**Kæden er nu PINNET** af `src/__tests__/document/documentRuntimeFailureVisibility.test.ts`, som måler gennem
den ÆGTE monitor og den ÆGTE reporter (en mock ville bevise, at kaldet sker — ikke at signalet kommer frem).
Mutationsbevist begge veje:

| Mutation | Udfald |
|---|---|
| `runtime`-fejl rapporteres ikke | ben 1 rødt |
| ALT rapporteres (også `rejected`/dev-server) | ben 2 rødt |

Begrundelsen for at pinne frem for blot at konstatere: kæden er fem moduler lang, og hvert led kunne ændres,
uden at nogen test bemærkede, at signalet var forsvundet.
