# Beregningsarkitektur

**Status:** Informativ. Beskriver den gældende arkitektur; bindende regler ligger i `src/contracts/`
**Scope:** Alle beregningsdomæner i Mineo
**Normative kilder:** især `form-contract.md`, `domain-boundary-contract.md`, `snapshot-contract.md`,
`amount-contract.md`, `date-contract.md` og domænekontrakterne

## Beregningsgrænse

Beregningslaget arbejder kun på typed data fra en `ready`, revisionsbundet inputprojektion samt eksplicit read-only
reference-data.

Det afhænger aldrig af React, Zustand, persistence, UI-state, labels, localeformattering eller implicit tid.

```text
InputReader(revision)
        │
        ▼
typed dependency-projektion
   ┌────┴─────┐
   │ blocked  │ ready
   ▼          ▼
 issues    Prepare/Normalize
              │
              ▼
          ren engine
              │
              ▼
        runtime-schema/output
              │
              ▼
     snapshot/view/dokumentprojektion
```

Rå canonical sektioner er ikke en legitim genvej. Et rejected felt maskerer recovery-værdien i `InputReader`, og den
relevante motor kaldes ikke.

Begge projektionsgrene bærer relevante issues. `ready` kan derfor fortsat indeholde warnings eller canonical
range-/bounds-issues, som den konkrete beregning kan arbejde med; blockers er kun den kontekstafhængige delmængde, der gør netop
denne projektion uanvendelig. Dokument- og save-policy evalueres efter deres egne fælles regler.

## Åben editor

Mens en editor er åben, forbliver `InputReader` og beregningen på senest afsluttede revision. Tastning kan derfor ikke
skjule/vise beregnede sektioner eller ændre resultater. Først settle udsteder ny revision og evaluerer projektionen.

Dette ændrer ingen formel, afrunding, clamping, sats eller datoafgrænsning; det fastlægger alene den autoritative
inputgrænse.

## Orkestrering

Snapshot-first-domæner:

```text
ready domæneinput → compute<Domain>Snapshot → UI/kontrol/dokumentprojektion
```

Det gælder EO, EET og Forsørgertab. UI og dokumenter må ikke kalde delmotorer parallelt.

Årsløn, Renteberegning og Varige mén er bevidst ikke snapshot-first. De bruger samme inputprojektion, men har ét
section-/engine-entry, hvis resultat genbruges af UI og dokument uden ny beregning. Der indføres ikke snapshots som
hypotetisk udvidelsespunkt.

## Input og output

Input:

- Zod-valideret og typed,
- bygget fra én inputrevision,
- uden åben draft, rejected afhængigheder eller derived UI-state.

Output:

- deterministisk for givet input/reference-data,
- runtime-afledt og ikke persisted source of truth,
- maskinvenlige tal/datoer uden localeformattering,
- runtime-valideret, når domænekontrakten kræver canonical output-schema.

## Fail-closed

Inputprojektionen ejer `ready`/`blocked`; snapshot-/domænelaget ejer beregningsstatus og outputinvariants.

- Forventelige inputproblemer materialiseres som issues før enginekald.
- `fail_closed` betyder, at autoritativt output ikke må bruges.
- Et domænes `error` kan have sikre delprojektioner, når kontrakten udtrykkeligt tillader det.
- UI/kontrol/dokument må aldrig skabe fallback-tal for manglende autoritativ beregning.

## Placering

- Feltdependencies og inputprojektioner placeres ved domænets inputgrænse.
- Rene engines og afledninger ligger under `src/domain/<domaene>/`.
- EO samler sine mange engines i `engines/`; mindre domæner behøver ikke en tom undermappestruktur.
- Tværgående økonomiske beregninger ligger i dedikerede domænemotorer, ikke selectors eller UI.
- Viewselectors former allerede beregnede outputs og genberegner ikke.

## Teststrategi

Engine-tests kører uden UI/store/persistence og dækker happy path, grænser, afrunding og determinisme.

Projektions-/integritetstests dækker desuden:

- rejected dependency stopper motoren og maskerer recovery-værdien,
- missing/range/rule klassificeres korrekt,
- uafhængige projektioner fortsætter,
- samme revision bruges gennem beregning og output,
- åben draft ændrer ingen beregning,
- stale revision afvises før dokument/output.

Beløbs- og afrundingsregler ejes fortsat af `amount-contract.md`.
