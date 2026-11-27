# Mineo – Snapshot-kontrakt

**Status:** Normativ og gældende
**Type:** Tværgående kontrakt
**Prioritet:** Specialiseres af `eo-snapshot-contract.md`, `eet-snapshot-contract.md` og
`forsoergertab-snapshot-contract.md`.
**Senest verificeret mod kode:** 2026-11-27

Kontrakten er det fælles hjem for reglerne om domænesnapshots. Domænekontrakterne gentager dem ikke, men henviser
hertil og beskriver kun det domænespecifikke.

## 1. Formål

Et domænesnapshot er et autoritativt, read-only beregnings-/projektionsobjekt bygget fra en `ready`,
`EvaluationSourceToken`-bundet inputprojektion. Det samler domænets beregnings-entry og forhindrer parallelle
beregningsveje i UI, kontrol og dokument.

Et snapshot er ikke persisted state, åben draft, en generel inputreader eller et framework for alle domæner.

## 2. Inputgrænse

Projektionsreglerne i `form-contract.md` §2.3 gælder. For snapshots gælder desuden:

1. Snapshot-entrypointet modtager en typed `ready` inputprojektion eller en `InputReader`, som det selv projekterer.
2. Det må ikke modtage rå canonical sektioner som en bypass uden om `InputReader`s feltfejl-skjul (et felt med aktiv rød
   feltfejl eksponerer aldrig sin canonical værdi).
3. Rejected afhængigt input, manglende requirements og blokerende domæneissues skal stoppe den relevante projektion,
   før motoren kaldes.
4. En rød afhængighed blokerer kun de projektioner eller grene, der læser feltet. Et felt, der kun bruges som
   fallback for et andet (fx ASL-årslønnen for en tom EAL-årsløn), er kun en afhængighed, når fallbacken faktisk
   bruges; en rød primærværdi må aldrig læses som tom og føre fallbacken ind.
5. Åben draft er usynlig for snapshottet. Mens en editor er åben, bruges snapshottet for senest afsluttede revision.
6. Snapshot og alle consumerprojektioner bærer det `EvaluationSourceToken` (input- + settingsrevision), de er bygget fra.

## 3. Grundregler

- Snapshottet er read-only og side-effect-frit.
- Domænets motorer modtager deres typed input fra en godkendt projektion.
- UI, kontrol, dokument og andre domæner må ikke genberegne canonical værdier uden om snapshottet eller de helpers,
  domænekontrakten udpeger.
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

## 5. Snapshotformer

Kontrakten kræver ingen fælles form. De tre domæner bruger hver sin:

- **Felt-UI-form** (Forsørgertab): få samlede gates, feltnær feedback og en dokumentprojektion. Egnet, når siden
  primært renderer feltorienteret feedback.
- **Projektionsform** (Erhvervsevnetab): én projektion pr. fane med `issues`, `hasBlockingErrors` og et
  beregningsresultat eller `null`. Erhvervsevnetab gør formen til Zod-valideret canonical output
  (`eet-snapshot-contract.md` §1–§2).
- **Status-/invariantform** (Erstatningsopgørelse): én samlet status med invariants, blokerede grene og et
  alt-eller-intet-aggregat (`eo-snapshot-contract.md` §3–§4).

## 6. Afgrænsning

Snapshot-first bruges præcis for:

- Erstatningsopgørelse,
- Erhvervsevnetab,
- Forsørgertab.

Årsløn, Renteberegning og Varige mén er ikke snapshot-first, fordi deres engine-resultat allerede beregnes ét sted og
genbruges. De skal stadig bruge den fælles inputprojektionsgrænse og revisionsbundne dokumentpreflight. Der indføres
ikke snapshots alene som hypotetisk udvidelsespunkt.

## 7. Issues og dokumentgate

Snapshotissues er afledt state efter `error-contract.md`; de persisteres ikke og lagres ikke i history eller en
field-error-bus. Rækkeissues afledes af samme `InputReader` som snapshotinputtet og må ikke afhænge af, om en
komponent er mounted.

Snapshottets eget blocking-flag er ikke i sig selv en komplet dokumentgate. Dokumentdefinitionen aggregerer
snapshotissues, relevante inputissues og output-invariants ud fra sine strukturelle dependencies – også
inputissues, som snapshottets eget issue-array ikke ejer.

Et dokument må kun modtage en godkendt snapshot-/dokumentprojektion med samme revision som preflighten. Den reaktive
gate og click-preflight bruger samme dokumentdefinition.

## 8. Runtimefejl

Forventelige brugerinputtilstande rapporteres som issues. Uventede runtimefejl må aldrig give gyldige totals,
dokumentprojektioner eller kontrol-output. De skal:

1. fail-close i domænets status-/issue-model,
2. rapporteres efter `error-contract.md`,
3. give en dansk blokerende brugerbesked,
4. undgå fallback-beregninger i UI, dokument og kontrol.

En blokering skal altid kunne forklares: et blokerende flag uden et issue, der forklarer det, er ikke tilladt.

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
