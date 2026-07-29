# WI-011: Generatorernes datokontrakt → canonical `ISODateString`

- **Status:** `afsluttet` 2026-07-29 — gennemført i draft/commit-reviewets **etape 12**. Se "Udfald" nederst.
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

## Udfald (2026-07-29)

**Roden er rettet: begge rente-generatorer tager nu `ISODateString`.** `generateRenteDocument`s
`interestStartDate`/`calculationDate`/`latestReferenceRateDate` er canonical, og dansk formatering sker inde i
generatoren, hvor den hører til som præsentation. Formatuenigheden er dermed **urepræsenterbar** frem for noget
en konvertering pr. callsite skal huske.

**Typegrænsen enumererede kalderne — og fandt én mere, end WI'en kendte.** Ud over de to definitioner
(`renteberegningDocumentDefinitions.ts`, `standaloneRenteDocumentDefinitions.ts`) havde standalones
FLERSIDE-output en tredje forekomst af samme fejlklasse: den gik ISO → dansk streng → `Date`, altså to
formatskift for at nå samme dato, med et `?? ''`, der gjorde en manglende konvertering til "ugyldig dato" frem
for til en typefejl. Alle tre parser nu ISO direkte.

**Fjernet som dødt med rettelsen:** `toDanishOrThrow` (Mineo) og `requireDanishDate` (standalone) — to
fail-closed-guards, hvis eneste formål var at fange en `undefined` fra en konvertering, der ikke længere findes.

**Kortlægning af de øvrige generatorer** (`parseDanishDate` i `src/document/generators/**`): kun
`eo/reguleringDocument.ts` er tilbage, og den er en ANDEN sag — dens interval bruger den BRANDEDE
`DanishDateString`, ikke en utypet `string`. Formatet er dermed eksplicit i typen og kan ikke forveksles; den
samme værdi bruges desuden til filnavnet og til `getOffentligLoenForPeriode`. Ingen ændring, og fejlklassen
findes ikke der.

### Acceptance criteria

- [x] Ingen generator tager en utypet dansk datostring som parameter.
- [x] `documentRendererWiring.test.ts`s formatpinning opdateret til den nye ENSARTEDE kontrakt — testen pinnede
      før bevidst, at de to formater var FORSKELLIGE; den pinner nu enigheden, og dens regressionsben er VENDT
      (dansk format er nu det ugyldige for denne generator).
- [x] **Paritet bevist pr. berørt generator:** hele dokument-/PDF-/Word-suiten (22 filer / 160 tests) er grøn
      **uden et enkelt regenereret golden-snapshot** — verificeret med `git status` på `__snapshots__`. Identisk
      dokumentindhold og filnavn.
- [x] `typecheck`, `typecheck:test`, `lint`, `test` grønne.

**Mutationsbevis:** genindføres ISO→dansk-konverteringen i Mineos definition, fejler netop
"definitionen sender ISO uændret til generatoren" med generatorens egen `Ugyldige datoer for renteberegning`.
