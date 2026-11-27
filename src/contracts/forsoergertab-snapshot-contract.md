# Mineo – Forsørgertab snapshot-kontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`.
**Senest verificeret mod kode:** 2026-11-27

De fælles snapshotregler (inputgrænse, afhængighedsspecifik blokering, runtimefejl, issues og dokumentgate,
friskhed) står i `snapshot-contract.md` og gentages ikke her.

---

## 1. Autoritativ indgang

`computeForsoergertabSnapshot(...)` er den autoritative entry for Forsørgertab-sidevisning, felt-UI, beregning og
dokumentprojektion. Den kaldes kun gennem `buildForsoergertabReaderProjection(...)`, som læser alle værdier gennem
`InputReader`; en rød feltfejl skjuler værdien og føres ind i snapshottet som feltets besked. Projektionen er altid
`ready` og bærer snapshottet; det er snapshottets egne gates, der afgør konsekvenserne.

---

## 2. Inputgrænser

Snapshotprojektionen deklarerer strukturelle dependencies i:

1. `forsoergertab`,
2. `stamdata`,
3. `faellesAarsloen`.

Dependencies resolver gennem én `InputReader`-revision. Andre domæner kræver ændring i `domain-boundary-contract.md`.

Beregningen består af to dependency-grupper, ASL og EAL. En rød afhængighed blokerer sin egen gruppe og bevarer den
anden; en stamdata-datoordensfejl er fælles for begge. ASL-årslønnen er kun en EAL-afhængighed, når EAL-årslønnen er
tom og fallbacken bruges (`snapshot-contract.md` §2).

---

## 3. Minimumsprojektioner

Snapshot skal mindst deklarere:

1. felttilstande: kønsfeltets synlighed og fejl, datogrænser, domænets `FieldIssue`s og EAL-oplysningen (§4),
2. gates for ASL/EAL/resultatvisning (`canShowAsl`, `canShowEal`, `canShowResult`),
3. beregningsresultat eller tom tilstand,
4. dokumentgate (`pdfGate`),
5. dokumentprojektion,
6. issues/fejlklassifikation.

---

## 4. Dokumentgate og feltvisning

Ethvert `error`-issue fra motoren blokerer dokumentet. Kun issues om felter, brugeren endnu ikke har udfyldt, er
undtaget og håndteres som mangler efter reglerne nedenfor; et nyt motorissue blokerer derfor som udgangspunkt.

1. Er både ASL- og EAL-området uden ydelsesinput, blokeres som `missing-input`.
2. ASL-området er påbegyndt, når ASL-årsløn, virkningsdato, tilkendt periode eller efterladtes fødselsdato
   er udfyldt. Er det påbegyndt, kræves alle dets relevante felter, herunder betinget køn. Kønnet tæller ikke
   selv som påbegyndt ASL-område. Det vises og kræves kun ved en påbegyndt ASL-ydelse med beregningsdato før
   1. marts 2015; et tidligere valg bevares og vises igen, når det bliver relevant.
3. En konkret felt-/domæneregel-fejl hvor som helst på siden blokerer hele dokumentet som ugyldigt input, også
   hvis den anden ydelsesdel isoleret kan beregnes.
4. En udfyldt del, som motoren har afvist, blokerer som ugyldigt input. Et dokument med kun EAL-kravet må ikke
   kunne hentes, når ASL-delen er udfyldt, men ikke kunne beregnes – det ville ligne en bevidst ren EAL-sag.
5. Beregningsdato, skadedato og skadelidtes fødselsdato er fælles nødvendige input; tomhed er `missing-input`,
   ikke `invalid-input`.

Skadedato og skadelidtes fødselsdato vises read-only fra Stamdata; er en af dem tom eller ugyldig, fører et link
til feltet i Stamdata (`MirroredStamdataRow`). ASL-maksimum-oplysningen på
EAL-årsløn vises som en ikke-blokerende `FieldWarning`, aldrig som inline-besked: der findes den sjældne,
legitime sag, hvor den faktiske EAL-årsløn er præcis ASL-maksimum.

---

## 4A. Tællemetode for allerede udbetalte måneder

De allerede udbetalte måneder opgøres **dagbaseret** (optjeningstælling) – ikke som hele kalendermåneder.

`alleredeUdbetaltMaaneder` **skal** være summen af `lobendeYdelser`-tabellens egne `maaneder`-værdier.
Den må ikke beregnes af en selvstændig formel ved siden af tabellen. Reglen er en **afledningsregel**,
ikke blot et valg af formel: tabellen «Løbende ydelse» og kapitalfaktorens resterende periode tæller de
samme udbetalinger, og to selvstændige optællinger kan hver for sig være internt konsistente og alligevel
uenige, uden at nogen test opdager det. Ved at aflede den ene af den anden kan de ikke drifte, hvis
periodiseringen ændres.

Afkortning til hele år og måneder sker **kun** ved opslaget i kapitaliseringstabellen
(`resterendeAar`/`resterendeMaaneder`), fordi tabellen slår op på netop den opdeling.
`resterendeMaanederTotal` bevarer decimalerne, så visningen kan skelne den faktiske rest fra
opslagsnøglen. Etiketten «Resterende periode (hele år og måneder)» navngiver opslagsnøglen.

En ændring af tællemetoden flytter et beløb i drift og er derfor en godkendelsesgate efter `AGENTS.md`.

---

## 4B. Forsørgertabserstatningen

Forsørgertabserstatningen er EAL-kravet minus de løbende ASL-ydelser og ASL-kapitalbeløbet. Bliver regnestykket
negativt, vises og trykkes «Forsørgertabserstatning» som 0 kr. – uden negativ difference, uden en forklarende linje
og uden anden markering. Forsørgertab er pr. definition et overskydende krav; forslaget om at vise differencen
genrejses ikke. Afrundede led bærer kun «(afrundet)»; afrundingsenheden skrives ikke.

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
