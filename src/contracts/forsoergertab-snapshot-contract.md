# Mineo - Forsørgertab snapshot-kontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`.  
**Senest verificeret mod kode:** 2026-09-04

---

## 1. Autoritativ indgang

`computeForsoergertabSnapshot(...)` er den autoritative entry for Forsørgertab-sidevisning, felt-UI, beregning og
dokumentprojektion.

UI og dokumentflow må ikke lave parallelle Forsørgertab-beregninger uden om snapshot-projektionen.

---

## 2. Inputgrænser

Snapshotprojektionen deklarerer strukturelle dependencies i:

1. `forsoergertab`,
2. `stamdata`,
3. `faellesAarsloen`.

Dependencies resolver gennem én `InputReader`-revision. Snapshotentrypointet modtager kun `ready` input; rejected
input må aldrig omgås via rå canonical sektioner. Andre domæner kræver ændring i `domain-boundary-contract.md`.

---

## 3. Minimumsprojektioner

Snapshot skal mindst deklarere:

1. felt-UI projektioner,
2. gates for ASL/EAL/resultatvisning,
3. beregningsresultat eller tom tilstand,
4. dokumentgate fra den fælles dokumentdefinition,
5. dokumentprojektion,
6. issues/fejlklassifikation.

---

## 4. Fail-closed

Forventelige brugerinputtilstande skal give afledte issues. Uventede runtimefejl må aldrig give gyldige totals eller dokumentprojektion.

Runtimefejl skal routes efter `error-contract.md` og give dansk blokerende brugerbesked.

Dokumentgaten følger disse regler:

1. Er både ASL- og EAL-området uden ydelsesinput, blokeres som `missing-input`.
2. Er ASL-området påbegyndt, kræves alle dets relevante felter, herunder betinget køn.
3. En konkret felt-/domæneregel-fejl hvor som helst på siden blokerer hele dokumentet som ugyldigt input, også
   hvis den anden ydelsesdel isoleret kan beregnes.
4. Beregningsdato, skadedato og skadelidtes fødselsdato er fælles nødvendige input; tomhed er `missing-input`,
   ikke `invalid-input`.

Skadedato vises read-only med link til Stamdata. ASL-maksimum-oplysningen på EAL-årsløn vises som en
ikke-blokerende `FieldWarning`, aldrig som inline-besked.

---

## 4A. Tællemetode for allerede udbetalte måneder

**Afgjort 2026-09-04.** De allerede udbetalte måneder opgøres **dagbaseret** (optjeningstælling) – ikke
som hele kalendermåneder.

`alleredeUdbetaltMaaneder` **skal** være summen af `lobendeYdelser`-tabellens egne `maaneder`-værdier.
Den må ikke beregnes af en selvstændig formel ved siden af tabellen. Reglen er en
**afledningsregel**, ikke blot et valg af formel: fladens to halvdele – tabellen «Løbende ydelse» og
kapitalfaktorens resterende periode – havde før hver sin optælling af de samme udbetalinger, og begge
var internt konsistente. Netop derfor fangede ingen test uenigheden. Ved at aflede den ene af den anden
kan de ikke drifte, hvis periodiseringen senere ændres.

Afkortning til hele år og måneder sker **kun** ved opslaget i kapitaliseringstabellen
(`resterendeAar`/`resterendeMaaneder`), fordi tabellen slår op på netop den opdeling.
`resterendeMaanederTotal` bevarer decimalerne, så visningen kan skelne den faktiske rest fra
opslagsnøglen. Etiketten «Resterende periode (hele år og måneder)» navngiver opslagsnøglen.

En ændring af tællemetoden flytter et beløb i drift og er derfor en godkendelsesgate efter `AGENTS.md`.

---

## 5. Minimumstestflade

Tests skal dække:

1. snapshot bygges kun fra en ready, `EvaluationSourceToken`-bundet inputprojektion,
2. dokumentgaten og dokumentprojektionen kommer fra samme dokumentdefinition og angiver blokerende årsager,
3. runtime exception blokerer output,
4. ændringer i `faellesAarsloen` påvirker snapshot deterministisk,
5. dokumentflow bruger snapshot-projektionen og afviser et stale `EvaluationSourceToken`,
6. `alleredeUdbetaltMaaneder` er identisk med tabellens egen sum (§4A), og en enkelt dag tælles som sin
   brøkdel af måneden – ikke som en hel måned.
