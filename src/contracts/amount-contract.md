# Mineo - Beløbs- og numerisk kontrakt

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Underordnet `form-contract.md` for draft/settle-semantik; overordnet arkitekturdokumenter ved konflikt.
**Senest verificeret mod kode:** 2026-08-19 (§3 er implementeret og verificeret: `MAX_AMOUNT_INPUT_INTEGER_DIGITS`
= 7 gælder indtastning, mens `MAX_AMOUNT_REPRESENTABLE_INTEGER_DIGITS` = 20 og binary64-værnet fortsat ejer
schema-/load-vejen)

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
6. Ved load reparses `expression` gennem den samme canonical beløbsparser. Den gemte tekst skal
   allerede være parserens canonical udtryk, og dens genberegnede slutværdi skal være identisk med
   den gemte `value`. Uoverensstemmelse er en integritetsfejl og fail-closer hele værdien.

---

## 3. Precision

`AmountValue` er absolut bundet til en canonical maksimumprecision på 2 decimaler.

Et felt må erklære den snævrere edit-policy `integerOnly`, når domænet kun tillader heltal. Det er fortsat et
`AmountValue` med 2-decimal canonical sikkerhedsgrænse, men UI, settle og visning accepterer kun heltals-subsettet.
Det indfører hverken en anden afrundingsstrategi eller en ny canonical beløbstype.

Felter med en anden positiv precision end 2 må ikke bruge `AmountValue`. De kræver:

1. ny særskilt type eller schema-adapter,
2. eksplicit kontraktændring,
3. test der dokumenterer precision, settle-normalisering og load-normalisering.

Ad hoc-afrunding i featurekomponenter er arkitektonisk fejl.

For binary64 skal to naboværdier ved 2 decimaler kunne skelnes. Derfor er den tilladte
størrelsesgrænse eksklusivt `2^46` hovedenheder: `abs(value) < 70.368.744.177.664,00`.
Den største positive canonical centværdi er dermed `70.368.744.177.663,99`. Grænsen er
strengere end `Number.MAX_SAFE_INTEGER / 100`, fordi den naive grænse lader forskellige
centværdier kollapse til samme `number`.

**Denne grænse er ikke inputfelternes grænse.** Den er et internt fail-closed-værn for
repræsentation, load og beregning. Brugervendte beløbsfelter har en langt lavere og
brugerforståelig grænse: højst 7 heltalscifre og 2 decimaler, altså `±9.999.999,99`, hvor
det 8. heltalsciffer blokeres allerede ved tastning og paste
(`input-field-behavior-contract.md` §2.2). Binary64-grænsen kan derfor ikke nås gennem
brugerinput; den kan kun rammes af en tolerant `.eo`-load eller et beregnet mellemresultat,
og den forbliver den autoritative fail-closed-grænse for netop de veje.

**Omvendt begrænser feltets 7 cifre ikke beregnede beløb.** Ciffergrænsen gælder kun det,
brugeren taster eller indsætter. Et beregnet beløb – en rækkesum, en årstotal, et
kapitaliseret beløb, en rente – må frit overstige `9.999.999,99`, og det er den forventede
adfærd, når brugeren indtaster flere beløb tæt på grænsen. For beregnede værdier er det
alene binary64-værnet ovenfor, der gælder. En beregnet total må derfor hverken afkortes,
afvises eller markeres rødt, fordi den er længere end det inputfelt, den stammer fra.

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

Indlæste beløb skal følge samme canonical semantik som almindelig settle. Load må ikke sende
uafrundede eller prefix-parsede beløb videre til beregningslaget. Legacy-strenge parses strengt
gennem `parseAmountInput`: et almindeligt tal bliver en `'number'`-værdi, et gyldigt udtryk bliver
en `'expression'`-værdi, og malformed ikke-tom tekst fail-closer. Rå numeriske `'number'`-værdier
normaliseres fortsat med `normalizeAmountToTwoDecimals`; `'expression'`-værdier normaliseres ikke
uafhængigt, men reparses og skal allerede være internt konsistente.

Bemærk: `.refine(Number.isFinite, …)` på `'number'`-variantens `value` er load-bearing, fordi den
ligger **efter** `normalizeAmountToTwoDecimals`-transformen, som kan videreføre et ikke-endeligt
input uændret. Den må ikke fjernes som "død" (Zod 4's `z.number()` afviser ganske vist
Infinity/NaN ved input, men ikke efter en transform).

---

## 6. Testkrav

Trust-kritiske numeriske ændringer skal have tests for:

1. settle-afrunding,
2. load-normalisering,
3. negative værdier hvor det er tilladt,
4. udtryk hvor operander ikke pre-afrundes,
5. domænespecifik afrunding, hvis den afviger fra standarden.
6. streng load-parsing uden prefix-accept,
7. `expression`↔`value`-konsistens og canonical expression-tekst,
8. binary64-kollisionsgrænsen ved feltets precision.

Pengealgebraen skal desuden teste konstruktion, enhedsoperationer, negative værdier,
overflow/fail-closed og krone↔øre-roundtrip. Beregningsændringer skal bevare eksisterende
golden-værdier for de berørte domæner.
