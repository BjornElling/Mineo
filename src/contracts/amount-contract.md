# Mineo - Beløbs- og numerisk kontrakt

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Underordnet `form-contract.md` for draft/settle-semantik; overordnet arkitekturdokumenter ved konflikt.
**Senest verificeret mod kode:** 2026-07-12

Denne kontrakt samler de numeriske regler, som tidligere var spredt mellem form- og beregningsdokumentation.

---

## 1. Grundregel

1. Numeriske værdier, der indgår i beregning, skal komme fra en schema-valideret ready inputprojektion.
2. Featurekode må ikke indføre lokal afrunding, lokal valutaformatering eller lokal parsing.
3. Brug eksisterende canonical helpers for parsing, afrunding og dansk formattering.
4. Beregningslag skal arbejde på maskinvenlige talværdier, ikke locale-formaterede strings.

---

## 2. AmountValue

`AmountValue` er Mineos canonical type for beløbsfelter med brugerindtastet tal eller udtryk. Den er en **diskrimineret union** på `kind` (autoritativ kilde: `src/schemas/amountExpressionSchema.ts`):

- `{ kind: 'number'; value: number }`
- `{ kind: 'expression'; expression: string; value: number }`

Regler:

1. `value` findes på begge varianter og er den autoritative canonical beregningsværdi.
2. `expression` findes **kun** på `'expression'`-varianten og er ren audit-/UI-repræsentation; adgang skal ske via `kind`-narrowing, aldrig som om feltet altid findes.
3. Nedstrøms domæneberegning skal bruge `value`, aldrig genberegne fra `expression`.
4. Operander i brugerens udtryk må ikke pre-afrundes eller pre-afskæres før evaluering.
5. Kun slutresultatet må afrundes ved settle.

---

## 3. Precision

`AmountValue` er absolut bundet til 2 decimaler.

Felter med anden precision må ikke bruge `AmountValue`. De kræver:

1. ny særskilt type eller schema-adapter,
2. eksplicit kontraktændring,
3. test der dokumenterer precision, settle-normalisering og load-normalisering.

Ad hoc-afrunding i featurekomponenter er arkitektonisk fejl.

---

## 4. MoneyOre og pengealgebra

`MoneyOre` er den kanoniske type for beregnede ørebeløb. Den autoritative kilde er
`src/domain/money/money.ts`, hvor typen afledes direkte af det brandede Zod-schema
`moneyOreSchema`.

Regler:

1. Et råt `number` må kun blive til `MoneyOre` gennem `moneyOre(...)`, `fromKroner(...)`
   eller en anden konstruktor i det kanoniske pengemodul.
2. Addition, subtraktion, summering og skalering af `MoneyOre` skal bruge modulets navngivne
   algebra. Rå aritmetik giver et ubundet `number` og må ikke type-castes tilbage til `MoneyOre`.
3. Negative ørebeløb er gyldige mellemresultater. Clamp til nul er en særskilt, eksplicit
   domænehandling via `clampMoneyOreToZero(...)`.
4. `fromKroner(...)` accepterer højst to decimaler og bevarer standardafrundingen. Intermediære
   beregninger med højere præcision skal afrundes efter den relevante domæneregel, før de
   konverteres til øre.
5. Brandet er kun en compile-time-enhed. Runtime-/schema-/JSON-repræsentationen forbliver et
   heltal, så dokumentprojektioner og snapshot-roundtrips ikke får en parallel datastruktur.
6. Direkte `as MoneyOre`/`<MoneyOre>` uden for pengemodulet er en arkitekturfejl og håndhæves
   af det AST-baserede arkitekturværn.
7. Offentlige pengefelter i et canonical beregningsoutput skal være `MoneyOre`. Dette gælder
   også EET-snapshottet og dets EO-importprojektion. Domænets eksisterende afrundingsregel
   anvendes, før beløbet konstrueres som `MoneyOre`; migration til øre må ikke ændre, hvornår
   eller hvordan et beløb afrundes.
8. Konvertering fra `MoneyOre` til kroner må kun ske ved en dokumenteret grænse, hvor en
   eksisterende kontrakt kræver kroner. For EET→EO-importen er denne grænse konstruktionen af
   EO-rækkens `AmountValue`; intern EET-beregning, snapshot og importport forbliver i øre.

## 5. Afrundingsregel

Standard for beløb er 2 decimaler med `half away from zero`, medmindre en mere specifik domænekontrakt definerer en anden regel.

Indlæste beløb skal normaliseres til samme canonical semantik som almindelig settle. Load må ikke sende uafrundede beløb videre til beregningslaget. Den kanoniske normalisering (`normalizeAmountToTwoDecimals` i `src/schemas/amountExpressionSchema.ts`) anvendes både ved settle (`amountNumberSchema`/`amountExpressionSchema`) og ved coercion af persisteret input (`coerceToAmountValue`), så de to veje ikke kan drive fra hinanden.

Bemærk: `.refine(Number.isFinite, …)` på `value` er load-bearing, fordi den ligger **efter** `normalizeAmountToTwoDecimals`-transformen, som kan videreføre et ikke-endeligt input uændret. Den må ikke fjernes som "død" (Zod 4's `z.number()` afviser ganske vist Infinity/NaN ved input, men ikke efter en transform).

---

## 6. Testkrav

Trust-kritiske numeriske ændringer skal have tests for:

1. settle-afrunding,
2. load-normalisering,
3. negative værdier hvor det er tilladt,
4. udtryk hvor operander ikke pre-afrundes,
5. domænespecifik afrunding, hvis den afviger fra standarden.

Pengealgebraen skal desuden teste konstruktion, enhedsoperationer, negative værdier,
overflow/fail-closed og krone↔øre-roundtrip. Beregningsændringer skal bevare eksisterende
golden-værdier for de berørte domæner.
