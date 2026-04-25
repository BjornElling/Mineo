Her er min reviderede og strammede version. Den er bevidst kortere, hårdere prioriteret og uden proces-snak. Kun regler, krav og arkitektoniske invarianter.

---

# AGENTS.md — Testpolitik for MinEO

Dette dokument er den autoritative teststandard for MinEO.
Alle tests under `src/__tests__/` skal følge disse regler.

Ved konflikt gælder rodens `AGENTS.md`.

---

# 1. Grundprincip

MinEO er trust-kritisk.
En test må kun eksistere hvis den beskytter:

1. **Numerisk korrekthed**
2. **Arkitektoniske grænser**
3. **Domæneinvarianter**
4. **Regression på kendt adfærd**

Tests der ikke beskytter én af disse, skal fjernes.

Coverage-procent er irrelevant. Invariant-dækning er afgørende.

---

# 2. Hvad der SKAL testes

## 2.1 Beregningslogik (Absolut kritisk)

Omfatter:

* Alle engines
* Alle derived values
* Periodisering
* Renter
* Regulering
* TAF
* Varigt mén
* Årsløn
* Policy-filer der styrer flow

Krav:

* Konkrete taleksempler (ikke relative assertions)
* Edge cases
* Grænseværdier
* Negative tal
* 0
* Store tal
* DST-kryds hvor relevant
* Eksplicit regressionstest ved bugfix

Forbud:

* Mocking af beregningsfunktioner
* Snapshot-tests af taloutput

---

## 2.2 Dato- og dagtælling (Absolut kritisk)

Omfatter:

* utcDayMath
* isoDateHelpers
* dateUtils
* Branded ISO-datoer

Krav:

* Test af samme dag
* Test af 1 dags forskel
* Test over månedsskifte
* Test over årsskifte
* Test over DST-start (marts)
* Test over DST-slut (oktober)

Alle dagtællingsfunktioner skal have DST-eksplicit test.

---

## 2.3 Validering (Absolut kritisk)

Omfatter:

* Alle Zod-schemas
* Form-level validators
* Row-level validators

Krav:

* Test både valid og invalid
* Test grænseværdier
* Test fejlstruktur (ikke kun at den fejler)
* Test at parsing ikke muterer input

Forbud:

* `as any`
* `@ts-ignore`
* Test der kun checker `success === false` uden at validere error-structure

---

## 2.4 Persistens (Absolut kritisk)

Omfatter:

* Save/load
* Serialisering
* Deserialisering
* Sanitering
* Migration
* sessionStorage-synk

Krav:

* Round-trip test (save → load → deep compare)
* Fail-closed ved korrupt data
* Test for manglende felter
* Test for ekstra ukendte felter
* Ingen tavs fallback

Mock kun:

* sessionStorage
* localStorage
* File API
* crypto.subtle

---

## 2.5 Arkitekturelle guard-tests

Placering: `src/__tests__/quality/`

Formål:
Forhindre brud på arkitekturinvarianter.

Eksempler:

* Ingen direkte localStorage-adgang
* Ingen direkte sessionStorage-adgang
* Domæne-isolation
* Encoding-korruption

Guard-tests må gerne læse kildefiler og fejle ved mønsterbrud.

---

## 2.6 Utilities

Omfatter:

* Parsing
* Formattering
* Afrunding
* Numeriske helpers

Krav:

* NaN
* Infinity
* -0
* Tom streng
* Ugyldigt input
* Dansk talformat hvis relevant

Ingen trivielle tests.

---

## 2.7 UI-adfærd (Begrænset)

Test kun:

* Commit-kontrakt
* Draft/commit-semantik
* Keyboard-navigation
* Focus-kontrakter

Test adfærd.
Test ikke implementation details.
Test ikke interne hooks via mocks.

---

# 3. Strukturkrav

* Alle tests i `src/__tests__/`
* Mappestruktur spejler kildekoden
* Én testfil per kildefil som udgangspunkt
* Filnavn: `<module>.test.ts`
* Top-level `describe('<module>')` er obligatorisk

Ingen tests i produktionsmapper.

---

# 4. Assertions-regler

Tilladt:

* Konkrete numeriske assertions
* Deep equality ved strukturer
* Eksplicit error-verifikation

Forbudt:

* `toBeGreaterThan(0)` i stedet for konkret tal
* Snapshot-tests af beregningsoutput
* Test af interne funktionskald
* Meningsløse assertions
* Timing-afhængige tests
* Delayed `waitFor` uden deterministisk årsag

---

# 5. Mocking-regler

Mock kun systemgrænser.

Mock aldrig:

* Domain logic
* Beregningsfunktioner
* Derived calculators

Hooks testes med rigtige providers.

Brug `userEvent` fremfor `fireEvent`.

---

# 6. Testkvalitet

En test skal:

* Være deterministisk
* Være isoleret
* Ikke dele mutable state
* Ikke afhænge af runtime timezone
* Ikke afhænge af systemtid (mock clock hvis nødvendigt)

Fixtures:

* Brug `structuredClone`
* Brug branded ISO helpers

---

# 7. Regression-regel

Ved enhver bugfix:

* Der skal først skrives en fejlgende test
* Derefter fixes koden
* Testen må ikke fjernes

---

# 8. Definition af færdig test

En testfil er først færdig når:

* Alle offentlige funktioner er dækket
* Edge cases er dækket
* DST er dækket hvor relevant
* Failure paths er dækket
* Ingen overflødig mocking
* Ingen type-omgåelser

---

# 9. Det vi ikke tester

Vi tester ikke:

* CSS
* Pixel-rendering
* Interne React state transitions
* Implementation details
* Coverage for coverage

---

# 10. Overordnet princip

Tests i MinEO skal beskytte:

* Korrekte tal
* Korrekte datoer
* Korrekte grænser
* Korrekt arkitektur

Alt andet er sekundært.

---

## Fremdriftssporing

`TEST_COVERAGE.md` er det levende dokument over testdækning. Opdater det når:

- En ny testfil skrives (❌ → ✅⚠️)
- En eksisterende test kvalitetssikres (✅⚠️ → ✅)
- En ny kildefil opdages der bør testes
- En kildefil omdøbes, flyttes eller fjernes

---

## Kontraktreference

Tests for komponent-adfærd skal verificere kontrakterne i:

- `src/contracts/form-contract.md` — commit/draft-semantik
- `src/contracts/keyboard-navigation.md` — tastatur-navigation
- `src/contracts/keyboard-navigation-test-checklist.md` — manuel verifikation
- `src/contracts/mineo-field-pattern.md` — felt-mønster
- `src/contracts/date-contract.md` — dato-invarianter
- `src/contracts/domain-boundary-contract.md` — domæneisolation

Hvis en test verificerer en kontrakt-invariant, bør den referere til kontrakten i en kommentar.
