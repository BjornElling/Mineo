# WI-<nnn>: <kort titel>

- **Status:** `kladde` → `afventer-godkendelse` / `klar` → `under-implementering` → `review` → `afsluttet`
- **Oprettet:** <ÅÅÅÅ-MM-DD>
- **Slice/scope:** <hvilken greenfield-slice / hvilket område>
- **Kilde:** <Codex-kortlægning / tilfældighedsfund under WI-xxx / brugerønske>
- **Risikoklasse:** <L / M / H — se greenfield-skillens modelrouting>
- **Baseline:** <HEAD + eksisterende ændringer, som ikke tilhører denne WI>

## Scope

Hvad er inde, og — lige så vigtigt — hvad er bevidst uden for scope.

## Autoritativt grundlag

Relevante kontrakter, arkitekturplanens aktuelle trin og kode, der fungerer som
adfærds-/beregningsorakel.

## Invarianter (må ikke brydes)

Konkrete invarianter denne ændring skal bevare (fra AGENTS.md / kontrakter / eksisterende adfærd).
Byg videre på legacy som korrektheds-orakel, ikke som kode der skal bevares.

## Parallel / duplikeret logik

- **Fund:** hvor findes samme problem løst på to måder?
- **Beslutning:** samles i én fælles kerne (med adaptere/config til reelle variationer) ELLER holdes adskilt.
- **Begrundelse:** ensart kun adfærd der *faktisk* skal være ens (jf. AGENTS.md "Konvergens").

## Acceptance criteria

Testbare kriterier. Opfyldt = kan lukkes. Marker beregningslogik/UI/UX-kriterier eksplicit
— de kræver **brugergodkendelse** før implementering (AGENTS.md "Roller").

- [ ] …
- [ ] …

## Godkendelsesgate

- **Påkrævet:** <nej / UI/UX / beregningslogik / begge>
- **Status og beslutning:** <ikke påkrævet / afventer / godkendt ÅÅÅÅ-MM-DD med konkret beslutning>

## Verifikation

- **Plan:** <målrettede tests og øvrige gates fra AGENTS.md>
- **Resultat:** <kommando + udfald; bevidste fravalg med begrundelse>

## Review-fund (udfyldes i review-fasen)

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
|   |   |   | rettet / afvist med evidens / ny WI-xxx | |

Intet fund må ignoreres eller implementeres blindt. Kan et bekræftet fund ikke rettes
forsvarligt her, oprettes en ny work item med begrundelse og acceptance criteria.

## Resterende / risici

Åbne punkter, opfølgnings-WI'er, kendte risici efter afslutning.
