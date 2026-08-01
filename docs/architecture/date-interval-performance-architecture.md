# Dato-/interval-performance

**Status:** Arkitekturforklarende reference, ikke selvstændig kontrakt
**Primært scope:** Datohelpers, periodisering, regulering, kontrol og øvrig beregningskode der tæller eller bygger dato-intervaller

Bindende regler ligger i `src/contracts/date-contract.md` og, for EO-periodisering, `src/contracts/periodisering-contract.md`. Ved konflikt har kontrakterne forrang.

## 1. Formål

Dato- og intervalkode må ikke skjule dyrt arbejde i ellers små beregninger.

Tre mønstre har tidligere været særligt risikable:

- at bygge alle datoer i et interval for derefter kun at tælle dem
- at genberegne samme dag-/arbejdsdage-grundlag inde i en løkke
- at have flere håndskrevne dag-for-dag-løkker med næsten samme semantik

Dette dokument bevarer rationalet bag den nuværende løsning. De konkrete forbud og kanoniske API'er er normative i `date-contract.md`.

## 2. Kanonisk model

`src/utils/isoDateHelpers.ts` ejer den eneste generelle dag-for-dag-iteration:

- `iterateDatesInclusive(start, end, onDate)`
- `iterateIsoDatesInclusive(fra, til, onIso)`
- `collectIsoDatesInclusive(fra, til)`
- `buildIsoDateSetInclusive(fra, til)`

Hvis beregningen kun skal bruge et antal dage, bruges `countInclusiveUtcDays` fra `src/utils/utcDayMath.ts`.

Hvis beregningen skal bruge helligdage i et interval, itereres helligdage pr. år i `src/domain/dates/shDageBeregning.ts`; hele kalenderintervallet materialiseres ikke først.

Hvis beregningen skal bruge månedsbrøker, bruges den domæne-neutrale helper
`sumMaanedsbroekForInterval` i `src/domain/dates/maanedsbroek.ts`. Domænespecifikke fradrag og
afrundinger lægges oven på denne algebra i det domæne, der ejer reglen.

## 3. Tilladte interval-løkker

Ikke alle datoløkker er dag-for-dag-iteration.

Følgende er legitime lokale løkker, når de springer direkte mellem aggregerede perioder og ikke vurderer hver kalenderdag:

- år
- halve år
- måneder
- ISO-uger
- satsperioder
- reguleringssegmenter
- kapitaliserings- eller pensionsaldersperioder

Eksempel: renteberegning må splitte i halvår og år. Forsørgertab må splitte i år. De mønstre er ikke omfattet af kravet om `iterateDatesInclusive`, fordi de ikke materialiserer eller vurderer hver dag.

## 4. Loop-invariant arbejde

Når input til en materialisering eller et opslag er konstant gennem en løkke, skal arbejdet løftes ud før løkken.

Typiske eksempler:

- arbejdsdage-/TAF-sæt bygges én gang pr. beregningsgrundlag, ikke én gang pr. range
- periodiseringsgrundlag for offentlige ydelser bygges én gang pr. række, ikke én gang pr. delinterval
- sats-/reguleringsopslag for et segment laves pr. segment, ikke pr. dag

Dette er ikke kun performance. Det reducerer også risikoen for divergens, fordi der bliver færre lokale steder at holde samme datogrundlag i live.

## 5. Bevidst ikke-optimering

`countTafArbejdsdageInRange` scanner i dag et allerede bygget sæt pr. segment.

Det er accepteret, fordi:

- sættet genberegnes ikke
- segmentantallet er normalt lille
- en hurtigere datastruktur ville øge kompleksiteten og skulle trådes gennem mange kaldsteder

Dette må først ændres, hvis en konkret måling viser, at scanningen er et reelt problem, eller hvis en ny eksisterende datastruktur gør ændringen enkel og adfærdsneutral.

## 6. Test- og reviewkrav

Ved ændringer i dato-/interval-performance skal tests låse adfærdsækvivalens, når ændringen er beregningsnær.

Relevante testtyper:

- ækvivalens mellem ny optimeret helper og enkel reference-implementation
- karakterisering af inklusiv start/slut-semantik
- edge cases ved årsskifte, månedsskifte, helligdage og tomme intervaller
- property-lignende tests for range-merge/materialiser/resegmenter, når ranges erstatter dag-sets

Dato-reglerne i `src/__tests__/quality/architecture/architectureRules.test.ts` beskytter de mest mekaniske regressionsmønstre. De er kun et sikkerhedsnet; de erstatter ikke review af, om ny kode flytter dyrt arbejde ud af løkker.
