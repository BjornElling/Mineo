---
name: greenfield
description: Gennemfør en Mineo-greenfield-work item med Codex som uafhængig kortlægger og reviewer.
argument-hint: [scope eller WI-fil]
disable-model-invocation: true
model: opus
effort: medium
---

# Greenfield-arbejdsgang

Gennemfør scopet eller genoptag work item'en i **$ARGUMENTS**.

AGENTS.md og de bindende kontrakter har forrang. Claude Code er eneste skriver i working tree.
Codex bruges read-only som uafhængig kortlægger/arkitekt og reviewer. Codex-fund er hypoteser,
som skal verificeres mod kode, kontrakter og tests — de implementeres ikke blindt.

## Låst modelpolitik

Modelpolitikken i AGENTS.md er en brugerbeslutning og kan ikke ændres af workflowet:

- Claude Code bruger kun Opus. Sonnet må aldrig bruges.
- Codex bruger kun Sol eller Terra. Luna må aldrig bruges.
- Terra kører altid med `model_reasoning_effort="high"` — aldrig low eller medium.

## 1. Preflight og work item

1. Læs den aktuelle status i `docs/architecture/draft-commit-greenfield-design.md`, relevant
   cutover-plan og relevante kontrakter. Claude-memory er kun orientering og aldrig autoritet.
2. Inspicér `git status` og `git diff`. Bevar eksisterende ændringer, og noter baseline i work
   item'en. Hav kun én aktiv greenfield-work item ad gangen.
3. Genoptag en eksisterende WI eller opret én fra `work-items/_TEMPLATE.md`. Udfyld scope,
   invarianter, acceptance criteria, testplan og risikoklasse, før produktionskode ændres.

### Risikoklasse og modelrouting

| Klasse | Kendetegn | Kortlægning | Slutreview |
|---|---|---|---|
| **L** | Dokumentation, mekanik eller helt lokalt kendt mønster; ingen adfærdsrisiko | Claude selv | Dokumentation: intet Codex-kald. Kode: Terra, high |
| **M** | Almindelig kode/refaktorering med afgrænset adfærd | Terra, high | Sol, medium |
| **H** | Beregning, schema/data-integritet, save/load/session, delt state/runtime, dokumentgate eller tværgående/tvetydig arkitektur | Sol, high | Sol, high |

Brug ikke både Terra og Sol til samme fase. Eskalér kun et afgrænset spørgsmål til Sol/high,
hvis ny tvivl opstår. Den dyre model skal løse beslutningen — ikke gentage en bred repo-scan.

Codex-kald angiver altid model og effort eksplicit:

```powershell
# M: læsetung kortlægning
codex exec -m gpt-5.6-terra -s read-only -c 'model_reasoning_effort="high"' `
  "Læs AGENTS.md, relevante kontrakter og <WI-fil>. Kortlæg eksisterende adfærd, invarianter, scope, testbare acceptance criteria og parallel logik. Returnér kun evidens med filreferencer og anbefalede beslutninger."

# H eller afgrænset arkitekturtvivl
codex exec -m gpt-5.6-sol -s read-only -c 'model_reasoning_effort="high"' `
  "Læs AGENTS.md, relevante kontrakter og <WI-fil>. Afgør det afgrænsede trust-kritiske spørgsmål: <spørgsmål>. Bevar beregningsadfærd og dataintegritet. Returnér evidens, beslutning, risici og nødvendige tests."
```

Omsæt konklusionerne kort i work item'en; kopiér ikke rå modeloutput ind.

## 2. Godkendelsesgate

Hvis arbejdet kan ændre synlig UI/UX eller beregningstal/-regler, sæt status
`afventer-godkendelse`, forelæg den konkrete brugeroplevelse og stop før implementering.
Efter eksplicit godkendelse noteres beslutningen og status sættes `klar`. Rent teknisk arbejde
markeres `godkendelse ikke påkrævet` og sættes direkte `klar`.

Skillens Opus/medium-override gælder kun den tur, hvor `/greenfield` påkaldes. Efter en pause
til brugergodkendelse skal handoffen derfor bede brugeren genoptage med
`/greenfield <WI-fil>`. En almindelig bekræftelse må registreres, men implementeringen må først
fortsætte, når skillen er påkaldt igen; ellers falder sessionen tilbage til sit dyrere standardvalg.

## 3. Implementering og gate

Implementér work item'en på skillens Opus/medium. Fordi arkitekturen allerede er afgjort,
skal implementeringen følge WI'en; opstår en ny arkitekturbeslutning, stands den del og kør et
afgrænset Codex-kald efter tabellen. Genbrug før ny kode, og konsolidér kun adfærd der faktisk
skal være ens.

Sæt status `under-implementering`. Kør de mindst omfattende relevante checks fra AGENTS.md
efter sammenhængende delændringer. For klasse H køres den fulde krævede gate før handoff.
Ved cutover-migrering bruges projektets `/verify`-skill, efter at dens kendte mellemtilstand
er kontrolleret mod den aktuelle plan og kode.

## 4. Uafhængigt review

Sæt status `review`, og kør review, når acceptance criteria og den første kvalitetsgate er grønne:

```powershell
# L-kode
codex review --uncommitted -c 'model="gpt-5.6-terra"' -c 'model_reasoning_effort="high"' `
  "Review kun <WI-fil> og dens scope. Find konkrete korrekthedsfejl, regressionsrisici, kontraktbrud og manglende tests. Returnér kun handlingskrævende fund med fil/linje og evidens."

# M
codex review --uncommitted -c 'model="gpt-5.6-sol"' -c 'model_reasoning_effort="medium"' `
  "Review <WI-fil> mod diff og berørte tests. Kontrollér korrekthed, invarianter, utilsigtet adfærdsændring, parallel logik, arkitektur og testhuller. Returnér kun handlingskrævende fund med fil/linje og evidens."

# H
codex review --uncommitted -c 'model="gpt-5.6-sol"' -c 'model_reasoning_effort="high"' `
  "Kritisk review af <WI-fil> mod diff og tests. Kontrollér især beregningstal, datatab, schema/runtime-integritet, stale revisions, atomisk save/load, fail-closed gates, kontrakter og manglende invarianttests. Returnér kun handlingskrævende fund med fil/linje og evidens."
```

Hvis working tree indeholder andre ændringer, må et globalt `--uncommitted`-review ikke bruges
ukritisk. Brug i stedet `codex exec ... -s read-only` med WI'ens præcise filer og afgrænsning,
og bed Codex ignorere baseline-ændringer uden for WI'en.

Registrér hvert fund som `bekræftet`, `afvist med evidens` eller `ny WI`. Ret alle bekræftede
fund i scope og kør relevante checks igen. Kør et fokuseret re-review, hvis rettelsen ændrer
produktionskode på grund af et korrektheds-/integritetsfund; rettelser i klasse H re-reviewes altid.
Afslut først, når alle fund har en dokumenteret disposition, acceptance criteria er opfyldt,
og relevante gates er grønne.

## 5. Handoff

Sæt status `afsluttet`. Rapportér kort: ændrede filer, udførte og bevidst fravalgte checks,
bekræftede/rettede fund, afviste fund med årsag, opfyldte acceptance criteria og resterende
WI'er/risici. Commit kun efter brugerens udtrykkelige besked; push aldrig.
