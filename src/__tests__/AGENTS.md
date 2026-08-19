# AGENTS.md – Testpolitik for Mineo

Dette dokument er den autoritative teststandard for Mineo.
Alle tests under `src/__tests__/` skal følge disse regler.

Ved konflikt gælder rodens `AGENTS.md`.

---

# 1. Grundprincip

Mineo er trust-kritisk.
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

### 2.5.1 Ét harness, ikke én walker pr. regel

Grænse-regler hører i regelmanifestet under `src/__tests__/quality/architecture/`, ikke i en ny håndskrevet
scanner. En regel, der medbringer sit eget filglob, får også sit eget liveness-gulv ved siden af harnessets –
og så er det harnessets dækning, der ikke længere gælder for den.

### 2.5.2 Et værn skal kunne fejle – bevis det

Et grønt værn er ikke evidens. Før du stoler på et, skal tre ting være vist:

1. **Mønstret fanger en overtrædelse.** Mutér en fixture og se testen blive rød.
2. **Målet findes stadig.** Et værn, der scanner et tomt sæt, er grønt af tomhed. Det er den hyppigste
   fejlklasse: et værn overlever den kode, det bevogtede, og bliver inert uden at nogen opdager det. Mutér
   derfor mod den **levende kilde**, ikke kun mod syntetiske strenge, og lad reglen bære et mål, harnesset kan
   efterprøve stadig eksisterer.
3. **Testdataene kan skelne mekanismerne.** To mekanismer, der er enige på alle prøvede inputs, er utestede.
   Skal en forrang bevises (fx at et eksplicit hint slår en tekst-heuristik), så skal der findes en case, hvor
   de peger hver sin vej – ellers består værnet en mutation, det burde fange.

Et sidebemærk fra samme fejlklasse: en `hasIdentifier`-probe forbliver sand ved et alias-import
(`import { x as y }`), fordi navnet stadig står i import-clausen. Mål et faktisk **kald**.

### 2.5.3 Kan grænsen udtrykkes i typesystemet, så gør det

En typegrænse slår en AST-regel, fordi den også lukker de indirekte veje. `safeSessionStorage`s branded
`ManifestStorageKey` afviser en ikke-manifesteret nøgle i COMPILEREN – også når den kommer ind som en
variabel, hvor en AST-regel principielt er blind.

Brandede typer har dog et loft: `{} as Brand` kompilerer. En smal AST-regel skal derfor lukke
assertion-hullet. Bedst er begge dele: typen som primær grænse, AST-reglen som sekundær diagnostik.

Stærkest af alt er at fjerne kapabiliteten. Kan et felt tages ud af en context, så en gate strukturelt ikke
KAN afhænge af det, er der ingen regel tilbage at overtræde.

### 2.5.4 Værn mod ansvaret, ikke kun mod navnet

En regel, der opremser historiske fil- og symbolnavne, værner mod *det, vi kom fra* – ikke mod *det ansvar, de
havde*. En ny fil, der genopfinder samme parallelle model under et andet navn, passerer. Navnelister er
nyttige, men de er et supplement til en ansvarsbaseret grænse, ikke en erstatning.

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

Tests i Mineo skal beskytte:

* Korrekte tal
* Korrekte datoer
* Korrekte grænser
* Korrekt arkitektur

Alt andet er sekundært.

---

## Kontraktreference

Tests for komponent-adfærd skal verificere kontrakterne i:

- `src/contracts/form-contract.md` – commit/draft-semantik
- `src/contracts/keyboard-navigation.md` – tastatur-navigation
- `src/contracts/mineo-field-pattern.md` – felt-mønster
- `src/contracts/date-contract.md` – dato-invarianter
- `src/contracts/domain-boundary-contract.md` – domæneisolation

Hvis en test verificerer en kontrakt-invariant, bør den referere til kontrakten i en kommentar.
