# Mineo – Snapshot-kontrakt

**Status:** Normativ og gældende
**Type:** Tværgående kontrakt
**Prioritet:** Specialiseres af `eo-snapshot-contract.md`, `eet-snapshot-contract.md` og
`forsoergertab-snapshot-contract.md`.
**Senest verificeret mod kode:** 2026-08-19

## 1. Formål

Et domænesnapshot er et autoritativt, read-only beregnings-/projektionsobjekt bygget fra en `ready`,
`EvaluationSourceToken`-bundet
inputprojektion. Det samler domænets beregnings-entry og forhindrer parallelle beregningsveje i UI, kontrol og dokument.

Et snapshot er ikke persisted state, åben draft, en generel inputreader eller et framework for alle domæner.

## 2. Inputgrænse

1. Snapshot-entrypointet modtager en typed `ready` inputprojektion eller en `InputReader`, som det selv projekterer.
2. Det må ikke modtage rå canonical sektioner som en bypass uden om `InputReader`s feltfejl-skjul (et felt med aktiv rød
   feltfejl eksponerer aldrig sin canonical værdi).
3. Rejected afhængigt input, manglende requirements og blokerende domæneissues skal stoppe den relevante projektion,
   før motoren kaldes.
4. Åben draft er usynlig for snapshottet. Mens en editor er åben, bruges snapshottet for senest afsluttede revision.
5. Snapshot og alle consumerprojektioner bærer det `EvaluationSourceToken` (input- + settingsrevision), de er bygget fra.

## 3. Grundregler

- Snapshottet er read-only og side-effect-frit.
- Domænets motorer modtager deres eksisterende typed input fra en godkendt projektion.
- UI, kontrol og dokument må ikke genberegne canonical værdier uden om snapshottet, når domænet er snapshot-first.
- Runtime-schema- eller invariantbrud giver eksplicit fail-closed status/issue, aldrig tilsyneladende gyldigt tomt output.
- Projektioner må udvælge og formatere snapshotdata, men ikke genberegne canonical resultater.
- En tværdomæneconsumer modtager en navngiven typed port, ikke interne engine-resultater eller rå inputsektioner.

## 4. Minimumsindhold

Et snapshot-first-domæne deklarerer mindst:

1. inputdependencies og tilladte domænegrænser,
2. revision/friskhed,
3. projektioner til UI, kontrol og dokument,
4. issues og blocking-status,
5. runtime fail-closed adfærd,
6. om eksponeret audit-input er originalt afsluttet input eller effektiv/transient beregningsinput.

Hvis snapshotformen er domænets canonical output, skal den runtime-valideres af et Zod-schema, og typen afledes af
schemaet.

## 5. To gyldige snapshotformer

### 5.1 Felt-UI-form

Bruges, når siden primært renderer feltorienteret feedback og få samlede gates. Formen indeholder feltprojektioner,
issues og page-level resultat-/dokumentstatus. Forsørgertab er det nuværende eksempel.

### 5.2 Issue-/tab-projektionsform

Bruges, når domænet har flere tabs eller delberegninger. Hver projektion indeholder issues, blocking-status og et
beregningsresultat eller `null`. EO og EET er de nuværende eksempler.

EET specialiserer formen ved at gøre `EetSnapshot` til Zod-valideret canonical output. Det gør ikke formen obligatorisk
for EO eller Forsørgertab.

## 6. Afgrænsning

Snapshot-first bruges præcis for:

- Erstatningsopgørelse,
- Erhvervsevnetab,
- Forsørgertab.

Årsløn, Renteberegning og Varige mén er ikke snapshot-first, fordi deres engine-resultat allerede beregnes ét sted og
genbruges. De skal stadig bruge den fælles inputprojektionsgrænse og revisionsbundne dokumentpreflight. Der indføres
ikke snapshots alene som hypotetisk udvidelsespunkt.

## 7. Issues og dokumentgate

Snapshotissues er afledt state efter `error-contract.md`; de lagres ikke i history eller en field-error-bus. Relevante
inputissues fra dokumentdefinitionens dependencies skal indgå i dokumentgaten, også hvis det konkrete snapshots
domæneissue-array ikke selv ejer feltvisningen.

Et dokument må kun modtage en godkendt snapshot-/dokumentprojektion med samme revision som preflighten. Den reaktive
gate og click-preflight bruger samme dokumentdefinition.

## 8. Runtimefejl

Uventede runtimefejl må aldrig give gyldige totals, dokumentprojektioner eller kontrol-output. De skal:

1. fail-close i domænets status-/issue-model,
2. rapporteres efter `error-contract.md`,
3. give en dansk blokerende brugerbesked,
4. undgå fallback-beregninger i UI, dokument og kontrol.

## 9. Originalt og effektivt input

Når domænet bruger transient/virtuelt input, skal det originale afsluttede input kunne auditeres uden at eksponere en
rå bypass til consumers. Effektivt input må bruges til beregning, men må ikke persisteres eller fremstilles som
brugerens input. EO's midlertidigt-EET-injection er referenceeksemplet.

## 10. Friskhed

- Snapshottet bindes til det `EvaluationSourceToken`, beregningen brugte – dvs. både inputrevisionen og den relevante
  settingsrevision. En ændring i AppSettings gør snapshottet stale på samme måde som en ændring i input.
- Et stale snapshot må ikke bruges til gate, invariant eller dokument.
- En ny inputtransaktion eller settingsændring udsteder et nyt token; snapshottet genberegnes eller consumeren fail-closer.
- Stale state er et refresh-behov, ikke i sig selv en systemfejl.

## 11. Ikke-krav

Kontrakten kræver ikke en fælles snapshot-base type, generisk factory, identiske feltnavne eller `Calculable<T>` i alle
domæner. Den kræver én autoritativ entry, en uomgåelig inputgrænse og revisionskonsistente projektioner.
