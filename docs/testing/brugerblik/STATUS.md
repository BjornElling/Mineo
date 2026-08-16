# Brugerblik — status

Fremdrift for UI/UX-fornufts- og edge case-gennemgangen. Se `.claude/skills/brugerblik/SKILL.md`.

- **Næste flade:** Indstillinger (`/indstillinger`)
- **Næste fund-ID:** BB-023
- **Senest opdateret:** 2026-08-16 (Om-fladen færdigbehandlet: alle tolv fund afgjort efter to runder)

## Flader

Rækkefølgen er fastlagt i `.claude/skills/brugerblik/references/flader.md` (små flader først).
Status: `Ikke startet` · `I gang` · `Gennemgået` · `Afventer bruger`.

| # | Flade | Status | Fund | Dokument |
|---|---|---|---|---|
| 1 | Stamdata | Gennemgået | 10 (BB-001–BB-010) | [stamdata.md](stamdata.md) |
| 2 | Om | Gennemgået | 12 (BB-011–BB-022) | [om.md](om.md) |
| 3 | Indstillinger | Ikke startet | — | — |
| 4 | Satser | Ikke startet | — | — |
| 5 | MinProcesrente | Ikke startet | — | — |
| 6 | Global shell | Ikke startet | — | — |
| 7 | Varige mén | Ikke startet | — | — |
| 8 | Renteberegning | Ikke startet | — | — |
| 9 | Årslønsberegning | Ikke startet | — | — |
| 10 | Forsørgertab | Ikke startet | — | — |
| 11 | Erhvervsevnetab | Ikke startet | — | — |
| 12 | Erstatningsopgørelse | Ikke startet | — | — |

## Fund der afventer brugerens beslutning

**Ingen.** Om-fladens tolv fund blev besvaret i to runder og er alle afgjort; fire af dem efter
modpres fra agenten. Det fulde grundlag står i [om.md](om.md).

| ID | Kort | Afgørelse |
|---|---|---|
| BB-011 | Teksten siger «når browseren lukkes» — sagen forsvinder med **fanen**, og «Gem» nævnes ikke | **Accepteret efter modpres — gennemført**; adfærden bevares |
| BB-012 | «Ingen data … eller anden information» lover bredere end det, sætningen skal bære | **Delvist accepteret efter modpres — gennemført**; nøgleordene bevares, tre unøjagtigheder rettes |
| BB-013 | Søskendesiderne åbner i samme fane og erstatter programmet | **Accepteret efter modpres — gennemført** som generel linkregel |
| BB-014 | Rul-til-toppen-knappen dækker 19 px af det sidste søskendelink | Accepteret risiko — få står præcis på 1536×864, og zoom-løsningen ændrer præmissen |
| BB-015 | Fast indholdsbredde; 1366 px-skærm kræver vandret rul | Afgjort — 1536×864 er designmålet; 1366 håndteres af skaleringsplanen |
| BB-016 | Sidens fem links kan ikke nås med tastaturet | Afgjort — bevidst designvalg, nu håndhævet af `ExternalLink` |
| BB-017 | Hjælpeprogrammets tilstand vises først, når man klikker | Afgjort — acceptabelt kompromis |
| BB-018 | Tre ord for samme handling: download, hente, installere | **Accepteret — gennemført.** Brugeren leverede brødteksten |
| BB-019 | To browserikoner uden tekst | Afvist — ikonerne er en genkendelsesnøgle, ikke en oplysning |
| BB-020 | Startside-valget står under «Teknisk» | Afvist — bevidst undtagelse; Om vises af juridiske grunde |
| BB-021 | «Mineo» og «minEO.dk» på samme skærm | Afvist — ét navn i to sammenhænge |
| BB-022 | Forsiden peger ikke ind i programmet | Afvist — der findes ikke ét rigtigt startsted |

**Gennemført fra Om:** to tekstrettelser i `Mineo.tsx`, lavet i én omgang —
«Persondata»-boksens sætning 2 og 3 (BB-011 + BB-012) og «Teknisk»-boksens ord for handlingen
inklusive knaplabelen «Installér hjælpeprogram» (BB-018). Ordlyden står ordret i [om.md](om.md).

**Gennemført undervejs:** BB-013's generelle linkregel — `ExternalLink`/`InternalLink`, AST-reglen
`a11y/web-link-policy-single-source` og `e2e/web-link-policy.spec.ts`. Brugerens eget arbejde.

Stamdatas ti fund er afgjort 2026-08-16; afgørelserne står i [stamdata.md](stamdata.md).
Tre rettelser derfra står klar til gennemførelse: BB-002 + BB-010's ordlyd (samme kodeændring),
BB-004's nye længdekategori (6 tegn til initialfelterne) og BB-007's normalisering af indsat tekst.

## Åbne spørgsmål

**Ingen.** BB-017's alternative overskrift til fejldialogen blev udeladt som aftalt; BB-018's
tekstrettelse ændrede derfor ikke denne overskrift.

**Rettelse af en tidligere note.** Her stod, at det planlagte skaleringsarbejde ikke var skrevet ned
i `docs/`. Det var forkert — jeg søgte kun i `docs/*.md`, ikke i undermapperne. Planen ligger i
[ui-skalering.md](../../implementation/ui-skalering.md) og afgør separat, at 1366×768 kan omfattes som
en CSS-viewport-kontrakt på mindst 1358×620 CSS-px.

## Tværgående mønstre

Elleve mønstre i [TVAERGAAENDE.md](TVAERGAAENDE.md).

- **M-01 til M-07** stammer fra Stamdata og handler om indtastning. Fire er omskrevet 2026-08-16
  efter brugerens afgørelser — læs dem i deres nye form, ikke i fundenes oprindelige.
- **M-08 til M-11** er tilføjet fra Om-fladen 2026-08-16 og handler om siden som helhed:
  M-08 links uden for tastaturrækkefølgen, M-09 fast indholdsbredde, M-10 flydende knapper der
  dækker indhold, M-11 programmets egne påstande om sig selv. Alle fire er skrevet om samme dag
  efter brugerens afgørelser og skal læses i den nye form:
  - **M-08** er afgjort for eksterne links i hele programmet: `ExternalLink` sætter `tabIndex={-1}`
    fast, og en AST-regel håndhæver det. Tilbage står kun **interne** links, der bærer noget,
    brugeren skal kunne handle på.
  - **M-09** har fået en grænse: 1536×864 er designmålet, og under den er afskæring accepteret.
    Mønsteret er dermed kun relevant **på eller over** den bredde.
  - **M-10** er skærpet: det afgørende er ikke, at en knap kan dække noget, men at indholdssøjlen
    ved designmålet går helt ud til vinduets kant, så en fast placeret knap altid lander oven i den.
  - **M-11** står uændret; begge fund bag det er nu afgjort som tekstrettelser. Mønsterets fælde er
    skrevet ind: et tekstfund om programmets egne påstande bliver let besvaret som et adfærdsfund.

## Noter til rækkefølgen

- Ingen justeringer. Om var nr. 2 som planlagt og viste sig at være en mindre flade at betjene, men
  en større at bedømme end antaget: den er programmets standard-startside og det eneste sted,
  programmet udtaler sig om, hvad der sker med brugerens oplysninger.
