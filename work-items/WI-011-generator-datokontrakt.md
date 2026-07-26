# WI-011: Generatorernes datokontrakt → canonical `ISODateString`

- **Status:** `ny` — ikke påbegyndt.
- **Oprettet:** 2026-07-26
- **Kilde:** codex sol/high-review af Fase 5's cutover, fund K1's ROD (WI-008 Review-fund).
- **Risikoklasse:** **M** — ændrer generatorsignaturer og dermed dokumentoutput, men uden
  beregningslogik. Kræver paritetstest pr. berørt generator.

## Problemet

To generatorer i SAMME domæne har hver sit datoformat:

| Generator | Datoparameter | Parser |
|---|---|---|
| `generateRenteDocument` | `dd-mm-åååå` (utypet `string`) | `parseDanishDate` |
| `generateRenteOversigtDocument` | `ISODateString` | `parseISODate` |

Det er ikke en detalje. Ved Fase 5's cutover kostede det en **kritisk fejl**: definitionerne sendte
canonical ISO til begge, så hver eneste enkeltrente-download kastede "Ugyldige datoer for
renteberegning" — i BEGGE apps. Fejlen var usynlig for typecheckeren, fordi parameteren er en bar
`string`, og integrationstesten aktiverede kun oversigts-outputtet, altså netop den generator hvis
kontrakt tilfældigvis passede.

Symptomet er lukket i WI-008: definitionerne konverterer nu eksplicit med `isoToDanish`, og
`documentRendererWiring.test.ts` pinner begge formater. **Men roden består:** grænsen bruger stadig
en utypet dansk datostring, hvor resten af systemet bruger canonical ISO, og næste kalder kan begå
præcis samme fejl.

## Scope

**Inde:**

- `generateRenteDocument`s datoparametre (`interestStartDate`, `calculationDate`) og
  `latestReferenceRateDate` ændres til `ISODateString`; formateringen til dansk sker INDE i
  generatoren, hvor den hører til som præsentation.
- Kortlægning af, om andre generatorer har samme utypede datogrænse — `parseDanishDate`-kald i
  `src/document/generators/**` er startpunktet.
- Konverteringen i `renteberegningDocumentDefinitions.ts` og
  `standaloneRenteDocumentDefinitions.ts` fjernes igen, når kontrakten er canonical.
- Paritetstest pr. berørt generator: samme input skal give samme dokumentindhold og filnavn før og
  efter. Dette er kravet, ikke en formalitet — ændringen rører dokumentoutput.

**Uden for:**

- Beregningslogik og modeller.
- Fase 5's definitioner ud over at fjerne den nu overflødige konvertering.

## Hvorfor det ikke blev gjort i WI-008

Fase 5 holder eksplicit generatorsignaturerne uændrede ("kun kalderen ændres"). At ændre en
generators kontrakt midt i en cutover af 21 outputs ville blande to risikoklasser og gøre det
uklart, om en indholdsændring stammede fra cutoveren eller fra formatændringen. Codex anbefalede
selv rodrettelsen; den er accepteret, men udskilt.

## Acceptance criteria

- [ ] Ingen generator tager en utypet dansk datostring som parameter.
- [ ] `documentRendererWiring.test.ts`s formatpinning opdateres til den nye ENSARTEDE kontrakt.
- [ ] Paritet bevist pr. berørt generator: identisk dokumentindhold og filnavn.
- [ ] `typecheck`, `typecheck:test`, `lint`, `test` grønne.
