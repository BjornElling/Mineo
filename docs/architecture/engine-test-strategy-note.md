# Engine Test Strategy Note - Mineo (Fase 3)

## Formaal
Definerer teststrategi for beregningslagets engines baseret paa den laaste pipeline.
Noten er normativ og maaler determinisme, edge cases og afrunding uden UI/persistence.

## Overordnede principper (normative)
- Engines testes som rene funktioner: input-snapshot -> output.
- Tests maa ikke bruge React, Zustand, persistence eller UI.
- Alle input i tests skal vaere eksplicitte snapshots (ingen implicit global state).
- Determinisme er et krav: samme input giver altid samme output.

## Hvad der testes pr. engine
For hver engine skal der minimum vaere tests i disse kategorier:

1) Happy path
- Repræsentativt input med forventet output.
- Validerer de centrale regler i engine.

2) Edge cases
- Tomme eller minimale input (fx tomme perioder, ingen rækker).
- Grænseværdier (datoer, procenter, belob, 0-værdier).
- Overlappende/tilstødende perioder, hvis relevant.

3) Rounding/precision
- Tydelig test af afrundingsregler.
- Dokumenterer hvornår afrunding sker (engine vs output schema).

4) Determinisme
- Samme input-snapshot maa give identisk output.
- Ingen outputmaa indeholde metadata om beregningstid/kilde/kontekst.

## Input-snapshots i tests
- Snapshots konstrueres eksplicit i testfiler.
- Reference-data (satser) skal altid injectes som input.
- Ingen implicit afhængighed til imports der loeser global konfiguration.

**Forbud i tests:**
- At bygge input via store/Context.
- At bruge UI helpers, selectors eller draft state.

## Output-validering
- Output valideres som struktureret data (ikke formatted strings).
- Tests skal sammenligne tal som numbers og datoer som ISO strings.
- Hvis output er komplekst, bruges strukturelle assertions (deep equal).

## Hvad der ikke testes her
- UI-rendering.
- Persistence (.eo, sessionStorage).
- Store commands eller Context facade.
- Locale/formatting.

## Example coverage per domæne (illustrativt)

### Erstatningsopgoerelse (samlet)
- Happy path: flere delresultater -> samlet total + delsummer.
- Edge case: manglende delresultater -> tomme felter uden crash.
- Rounding: dokumenter afrundingsregel for total og delsummer.

### Renteberegning
- Happy path: flere krav og perioder -> korrekt totalsum.
- Edge case: dato-intervaller med nul dage, tomme satser.
- Rounding: evt. afrunding pr. periode eller pr. krav.

## Stop-regel
Hvis en engine ikke kan testes uden UI/store/persistence, er den forkert designet
og skal refaktoreres, foer den integreres.
